// End-to-end: real server, in-memory MongoDB, real HTTP and Socket.IO.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connectSocket } from 'socket.io-client';

process.env.EMBEDDED_DB_PATH = ':memory:';
process.env.AUTO_SEED = '0';
const { start } = await import('../server/index.js');
const { disconnect } = await import('../server/db.js');

let server;
let ioServer;
let base;

before(async () => {
  ({ server, io: ioServer } = await start(0));
  base = `http://localhost:${server.address().port}`;
});

after(async () => {
  ioServer.close();
  await disconnect();
});

function client() {
  let cookie = '';
  const call = async (path, { method = 'GET', body, type = 'application/json' } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': type, cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { call, cookie: () => cookie };
}

const alice = client();
const bob = client();
let tableId;

test('register validates input', async () => {
  const r = await alice.call('/api/auth/register', { method: 'POST', body: { username: 'a!', email: 'nope', password: 'short', displayName: '' } });
  assert.equal(r.status, 422);
  assert.ok(r.body.fields.username && r.body.fields.email && r.body.fields.password && r.body.fields.displayName);
});

test('register, duplicate, login, me, logout', async () => {
  const ok = await alice.call('/api/auth/register', { method: 'POST', body: { username: 'alice_v', email: 'alice@example.com', password: 'tide-4567', displayName: 'Alice Varga' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.username, 'alice_v');
  assert.equal(ok.body.user.passwordHash, undefined, 'hash never leaves the server');

  const dup = await bob.call('/api/auth/register', { method: 'POST', body: { username: 'Alice_V', email: 'b@example.com', password: 'whatever1', displayName: 'Bob' } });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.fields.username);

  assert.equal((await bob.call('/api/auth/register', { method: 'POST', body: { username: 'bob_r', email: 'bob@example.com', password: 'ember-9999', displayName: 'Bob Rasku' } })).status, 201);

  assert.equal((await alice.call('/api/auth/me')).body.user.displayName, 'Alice Varga');
  assert.equal((await alice.call('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await alice.call('/api/auth/me')).body.user, null);
  assert.equal((await alice.call('/api/auth/login', { method: 'POST', body: { login: 'alice_v', password: 'wrong-pass' } })).status, 401);
  assert.equal((await alice.call('/api/auth/login', { method: 'POST', body: { login: 'ALICE@example.com', password: 'tide-4567' } })).status, 200);
});

test('writes must be JSON (CSRF guard)', async () => {
  const r = await alice.call('/api/tables', { method: 'POST', body: { name: 'x' }, type: 'text/plain' });
  assert.equal(r.status, 415);
});

test('tables: full CRUD with ownership', async () => {
  assert.equal((await client().call('/api/tables', { method: 'POST', body: { name: 'Nope' } })).status, 401);
  const bad = await alice.call('/api/tables', { method: 'POST', body: { name: 'ab', seats: 5, turnSeconds: 3 } });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(bad.body.fields).sort(), ['name', 'seats', 'turnSeconds']);

  const made = await alice.call('/api/tables', { method: 'POST', body: { name: 'Test Harbour', seats: 3, turnSeconds: 20, botFill: true, gift: false } });
  assert.equal(made.status, 201);
  tableId = made.body.table.id;
  assert.equal(made.body.table.rules.gift, false);
  assert.equal(made.body.table.rules.surgeStack, true);

  const list = await bob.call('/api/tables');
  assert.ok(list.body.tables.some((t) => t.id === tableId));

  assert.equal((await bob.call(`/api/tables/${tableId}`, { method: 'PATCH', body: { name: 'Hijacked' } })).status, 403);
  const edited = await alice.call(`/api/tables/${tableId}`, { method: 'PATCH', body: { name: 'Test Harbour II', surgeStack: false } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.table.name, 'Test Harbour II');
  assert.equal(edited.body.table.rules.surgeStack, false);
  assert.equal(edited.body.table.rules.gift, false, 'partial update keeps other rules');

  const byCode = await bob.call(`/api/tables/code/${made.body.table.code}`);
  assert.equal(byCode.body.table.id, tableId);
  assert.equal((await bob.call('/api/tables/not-an-id')).status, 404);
});

test('a live match over Socket.IO with bots filling the seat', async () => {
  const socket = connectSocket(base, { extraHeaders: { cookie: alice.cookie() }, transports: ['websocket'] });
  const states = [];
  const waitFor = (pred, ms = 8000) => new Promise((resolve, reject) => {
    const hit = states.find(pred);
    if (hit) return resolve(hit);
    const timer = setTimeout(() => reject(new Error('timed out waiting for state')), ms);
    socket.on('table:state', function onS(s) {
      if (pred(s)) {
        clearTimeout(timer);
        socket.off('table:state', onS);
        resolve(s);
      }
    });
  });
  socket.on('table:state', (s) => states.push(s));
  const emit = (ev, payload) => new Promise((resolve) => socket.emit(ev, payload, resolve));

  assert.deepEqual(await emit('table:join', { tableId }), { ok: true, seat: 0 });
  await waitFor((s) => s.seats[0]?.name === 'Alice Varga');
  assert.deepEqual(await emit('game:start', {}), { ok: true });
  const dealt = await waitFor((s) => s.game);
  assert.equal(dealt.game.players.length, 3);
  assert.equal(dealt.game.hand.length, 7);
  assert.ok(dealt.game.players.filter((p) => p.isBot).length === 2);

  // Wait for our turn, then make a legal move.
  const mine = await waitFor((s) => s.game && s.game.turn === s.game.you, 15000);
  const before = mine.game.hand.length;
  const res = mine.game.playable.length
    ? await emit('game:play', { cards: [mine.game.playable[0]], suit: 'tide', giftId: mine.game.hand.find((c) => c.id !== mine.game.playable[0])?.id })
    : await emit('game:draw', {});
  assert.equal(res.error, undefined, res.error);
  const after = await waitFor((s) => s.game && s.game.hand.length !== before, 5000).catch(() => null);
  assert.ok(after || mine.game.playable.length === 0, 'hand changed after our move');

  // Moving out of turn is rejected.
  const now = states[states.length - 1];
  if (now.game.turn !== now.game.you) {
    const nope = await emit('game:play', { cards: [now.game.hand[0].id] });
    assert.match(nope.error, /turn/);
  }

  // Editing a table mid-match is refused.
  assert.equal((await alice.call(`/api/tables/${tableId}`, { method: 'PATCH', body: { name: 'Mid Match' } })).status, 409);
  socket.emit('table:leave');
  socket.close();
});

test('profile edit, leaderboard and account deletion', async () => {
  const bad = await bob.call('/api/users/me', { method: 'PATCH', body: { bio: 'x'.repeat(200), favoriteSuit: 'hearts' } });
  assert.equal(bad.status, 422);
  const ok = await bob.call('/api/users/me', { method: 'PATCH', body: { bio: 'Plays Moss.', favoriteSuit: 'moss' } });
  assert.equal(ok.body.user.favoriteSuit, 'moss');
  assert.equal((await bob.call('/api/users/bob_r')).body.user.bio, 'Plays Moss.');
  assert.equal((await bob.call('/api/leaderboard')).status, 200);
  assert.equal((await bob.call('/api/bot')).body.features.length, 7);

  assert.equal((await bob.call('/api/users/me', { method: 'DELETE', body: { password: 'nope-nope' } })).status, 401);
  assert.equal((await bob.call('/api/users/me', { method: 'DELETE', body: { password: 'ember-9999' } })).status, 200);
  assert.equal((await bob.call('/api/users/bob_r')).status, 404);
});

test('host can close their table', async () => {
  // Wait for the bots to clear the match Alice walked away from.
  for (let i = 0; i < 50; i++) {
    const r = await alice.call(`/api/tables/${tableId}`, { method: 'DELETE' });
    if (r.status === 200) return;
    await new Promise((res) => setTimeout(res, 200));
  }
  assert.fail('table could not be deleted');
});
