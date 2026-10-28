// Live tables. MongoDB holds each table's settings; this module holds the seats and
// the running match in memory and pushes per-seat views over Socket.IO.
// ponytail: one process owns all rooms; running several servers needs the socket.io Redis adapter + shared state.
import * as engine from './engine.js';
import { chooseMove, features, train } from './bot.js';
import { Table, User, Match, getBrain } from '../models.js';
import { userIdFromCookie } from '../auth.js';

const BOT_NAMES = ['Wren', 'Halyard', 'Tamsin', 'Oriel', 'Bramble', 'Quayle', 'Juno', 'Sorrel'];
const BOT_RATING = 1300;
const rooms = new Map();
let io = null;
let weights = null;

const key = (tableId) => `table:${tableId}`;

export function occupancy(tableId) {
  const r = rooms.get(String(tableId));
  if (!r) return { seated: 0, humans: 0, live: false };
  const filled = r.seats.filter(Boolean);
  return { seated: filled.length, humans: filled.filter((s) => !s.isBot).length, live: !!r.game && r.game.winner === null };
}

export const onlineCount = () => (io ? io.engine.clientsCount : 0);

function lobbyPing(room) {
  io?.to('lobby').emit('lobby:update', { tableId: room.tableId, ...occupancy(room.tableId), status: room.status });
}

function seatOf(room, userId) {
  return room.seats.findIndex((s) => s && !s.isBot && s.userId === userId);
}

function publicSeats(room) {
  return room.seats.map((s) => s && { name: s.name, isBot: s.isBot, userId: s.userId || null, away: !!s.away, suit: s.suit || null });
}

function emitState(room, event = null) {
  if (!io) return;
  const meta = {
    tableId: room.tableId,
    tableName: room.table.name,
    code: room.table.code,
    ownerId: String(room.table.owner),
    seatsTotal: room.table.seats,
    turnSeconds: room.table.turnSeconds,
    botFill: room.table.botFill,
    rules: room.table.rules,
    status: room.status,
    seats: publicSeats(room),
    deadline: room.deadline,
    results: room.results,
    event,
  };
  for (const sid of io.sockets.adapter.rooms.get(key(room.tableId)) || []) {
    const socket = io.sockets.sockets.get(sid);
    if (!socket) continue;
    const seat = seatOf(room, socket.data.userId);
    const gameSeat = room.game ? room.order.indexOf(seat) : -1;
    socket.emit('table:state', { ...meta, you: seat, game: room.game ? engine.viewFor(room.game, gameSeat) : null });
  }
}

async function loadRoom(tableId) {
  if (rooms.has(tableId)) return rooms.get(tableId);
  const table = await Table.findById(tableId).lean().catch(() => null);
  if (!table) return null;
  const room = {
    tableId, table, seats: Array(table.seats).fill(null), status: 'open',
    game: null, order: [], history: [], timer: null, deadline: null, results: null, startedAt: 0,
  };
  rooms.set(tableId, room);
  return room;
}

/** Called by the REST layer after a table is edited or deleted. */
export async function tableChanged(tableId, deleted = false) {
  const room = rooms.get(String(tableId));
  if (!room) return;
  if (deleted) {
    clearTimeout(room.timer);
    io?.to(key(room.tableId)).emit('table:closed', { message: 'The host closed this table.' });
    io?.in(key(room.tableId)).socketsLeave(key(room.tableId));
    rooms.delete(room.tableId);
    return;
  }
  const fresh = await Table.findById(tableId).lean();
  if (!fresh) return;
  room.table = fresh;
  if (!room.game || room.game.winner !== null) {
    // Seat count may have changed: keep whoever fits, drop extra bots first.
    const people = room.seats.filter((s) => s && !s.isBot);
    const bots = room.seats.filter((s) => s && s.isBot);
    const kept = [...people, ...bots].slice(0, fresh.seats);
    room.seats = Array.from({ length: fresh.seats }, (_, i) => kept[i] || null);
  }
  emitState(room);
}

function schedule(room) {
  clearTimeout(room.timer);
  const g = room.game;
  if (!g || g.winner !== null) return;
  const seat = room.seats[room.order[g.turn]];
  if (seat.isBot || seat.away) {
    room.deadline = null;
    room.timer = setTimeout(() => botTurn(room), seat.away ? 1200 : 700 + Math.random() * 900);
  } else {
    const ms = room.table.turnSeconds * 1000;
    room.deadline = Date.now() + ms;
    room.timer = setTimeout(() => act(room, g.turn, () => engine.autoMove(g, g.turn), { type: 'timeout' }), ms);
  }
}

// Feature snapshot of a move, taken before it is applied. Every legal move made in a
// match feeds the bot's learning when the match ends.
function snapshot(g, idx, move) {
  const hand = g.players[idx].hand;
  const run = move.draw ? [] : move.cards.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
  const rest = hand.filter((c) => !run.includes(c));
  return { player: idx, f: features(g, idx, { move, run, rest }) };
}

function act(room, idx, fn, event) {
  const g = room.game;
  let evts;
  try {
    const out = fn();
    evts = Array.isArray(out) ? out : [];
  } catch (err) {
    return err.message;
  }
  const main = evts.find((e) => e.type === 'play');
  const ev = { ...event, player: idx, cards: main?.cards, extra: evts.filter((e) => e !== main).map((e) => e.type) };
  // Schedule first so the state we send carries the new turn's deadline.
  if (g.winner === null) schedule(room);
  emitState(room, ev);
  if (g.winner !== null) finish(room);
  return null;
}

function botTurn(room) {
  const g = room.game;
  if (!g || g.winner !== null) return;
  const idx = g.turn;
  const pick = chooseMove(g, idx, weights);
  room.history.push({ player: idx, f: pick.f });
  let err;
  if (pick.move.draw) {
    err = act(room, idx, () => {
      const r = engine.draw(g, idx);
      if (!r.ended) {
        // A drawn card that fits gets played straight away.
        const again = chooseMove(g, idx, weights, Math.random, 0);
        if (again.move.draw) engine.pass(g, idx);
        else return engine.play(g, idx, again.move);
      }
      return [];
    }, { type: 'draw' });
  } else {
    err = act(room, idx, () => engine.play(g, idx, pick.move), { type: pick.move.cards.length > 1 ? 'spill' : 'play' });
  }
  if (err) {
    // Should never happen; never let a bot stall the table.
    console.error('[rooms] bot move rejected:', err);
    act(room, idx, () => engine.autoMove(g, idx), { type: 'draw' });
  }
}

function eloDeltas(ratings, winner) {
  const n = ratings.length;
  return ratings.map((ri, i) => {
    let d = 0;
    ratings.forEach((rj, j) => {
      if (i === j) return;
      const expected = 1 / (1 + 10 ** ((rj - ri) / 400));
      const score = i === winner ? 1 : j === winner ? 0 : 0.5;
      d += (32 / (n - 1)) * (score - expected);
    });
    return Math.round(d);
  });
}

async function finish(room) {
  clearTimeout(room.timer);
  room.deadline = null;
  room.status = 'open';
  const g = room.game;
  const seats = room.order.map((s) => room.seats[s]);
  const points = engine.scores(g);
  const users = await Promise.all(seats.map((s) => (s.isBot ? null : User.findById(s.userId))));
  const deltas = eloDeltas(users.map((u) => (u ? u.rating : BOT_RATING)), g.winner);

  const results = seats.map((s, i) => ({
    name: s.name, isBot: s.isBot, userId: s.userId || null,
    cardsLeft: g.players[i].hand.length, points: points[i], ratingDelta: users[i] ? deltas[i] : 0,
  }));
  room.results = { winner: g.winner, players: results, turns: g.turnCount, longestSpill: g.longestSpill.length };

  try {
    await Promise.all(users.map((u, i) => {
      if (!u) return null;
      u.rating += deltas[i];
      u.ratingHistory.push(u.rating);
      if (u.ratingHistory.length > 60) u.ratingHistory.shift();
      u.stats.played += 1;
      if (i === g.winner) u.stats.won += 1;
      u.stats.points += points[i];
      if (g.longestSpill.by === i) u.stats.longestSpill = Math.max(u.stats.longestSpill, g.longestSpill.length);
      return u.save();
    }));
    await Match.create({
      table: room.table._id,
      tableName: room.table.name,
      players: results.map((r) => ({ user: r.userId, name: r.name, isBot: r.isBot, cardsLeft: r.cardsLeft, points: r.points, ratingDelta: r.ratingDelta })),
      winnerName: seats[g.winner].name,
      winnerUser: seats[g.winner].userId || null,
      turns: g.turnCount,
      longestSpill: g.longestSpill.length,
      durationMs: Date.now() - room.startedAt,
    });
    await Table.updateOne({ _id: room.table._id }, { $set: { status: 'open' }, $inc: { matchesPlayed: 1 } });
    const brain = await getBrain();
    brain.weights = train(brain.weights, room.history, g.winner);
    brain.matchesTrained += 1;
    if (seats[g.winner].isBot) brain.botWins += 1;
    brain.history.push({ n: brain.matchesTrained, ...brain.weights });
    if (brain.history.length > 80) brain.history.shift();
    brain.markModified('weights');
    await brain.save();
    weights = brain.weights;
  } catch (err) {
    console.error('[rooms] could not save match', err);
  }
  room.history = [];
  // People who dropped out mid-match leave their seat now.
  room.seats = room.seats.map((s) => (s && s.away ? null : s));
  emitState(room, { type: 'over' });
  lobbyPing(room);
}

async function start(room, userId) {
  if (room.game && room.game.winner === null) throw new Error('A match is already running');
  const isHost = String(room.table.owner) === userId;
  const hostSeated = room.seats.some((s) => s && s.userId === String(room.table.owner));
  if (!isHost && hostSeated) throw new Error('Only the host can deal');
  if (room.table.botFill) {
    const used = new Set(room.seats.filter((s) => s?.isBot).map((s) => s.name));
    const free = BOT_NAMES.filter((n) => !used.has(`Bot ${n}`));
    room.seats = room.seats.map((s) => s || { isBot: true, name: `Bot ${free.shift()}` });
  }
  const filled = room.seats.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
  if (filled.length < 3) throw new Error('Spillway needs 3 players. Turn on bot fill or wait for friends.');
  room.order = filled;
  room.game = engine.newGame(filled.map((i) => ({ name: room.seats[i].name, isBot: room.seats[i].isBot, userId: room.seats[i].userId })), room.table.rules);
  room.history = [];
  room.results = null;
  room.status = 'playing';
  room.startedAt = Date.now();
  await Table.updateOne({ _id: room.table._id }, { $set: { status: 'playing' } });
  schedule(room);
  emitState(room, { type: 'deal' });
  lobbyPing(room);
}

function leave(room, userId) {
  const seat = seatOf(room, userId);
  if (seat < 0) return;
  const live = room.game && room.game.winner === null;
  if (live) room.seats[seat].away = true; // a bot plays their hand out
  else room.seats[seat] = null;
  if (live && room.order[room.game.turn] === seat) schedule(room);
  if (!room.seats.some((s) => s && !s.isBot && !s.away)) {
    // Nobody real left: stop the clock and forget the room.
    clearTimeout(room.timer);
    if (room.status === 'playing') Table.updateOne({ _id: room.table._id }, { $set: { status: 'open' } }).catch(() => {});
    rooms.delete(room.tableId);
    room.status = 'open';
    lobbyPing(room);
    return;
  }
  emitState(room);
  lobbyPing(room);
}

export async function initRealtime(server) {
  io = server;
  weights = (await getBrain()).weights;
  await Table.updateMany({ status: 'playing' }, { $set: { status: 'open' } }); // matches don't survive restarts

  io.use(async (socket, next) => {
    const id = userIdFromCookie(socket.handshake.headers.cookie);
    const user = id && (await User.findById(id).catch(() => null));
    if (!user) return next(new Error('unauthorized'));
    socket.data.userId = String(user._id);
    socket.data.name = user.displayName;
    socket.data.suit = user.favoriteSuit;
    next();
  });

  io.on('connection', (socket) => {
    const uid = socket.data.userId;
    const ack = (cb, error, extra = {}) => typeof cb === 'function' && cb(error ? { error } : { ok: true, ...extra });
    const roomOf = () => rooms.get(socket.data.tableId);

    socket.on('lobby:watch', () => socket.join('lobby'));

    socket.on('table:join', async ({ tableId } = {}, cb) => {
      if (typeof tableId !== 'string' || !/^[a-f0-9]{24}$/.test(tableId)) return ack(cb, 'That table link looks broken');
      const room = await loadRoom(tableId);
      if (!room) return ack(cb, 'This table no longer exists');
      socket.data.tableId = tableId;
      socket.join(key(tableId));
      let seat = seatOf(room, uid);
      if (seat >= 0) {
        const wasAway = room.seats[seat].away;
        room.seats[seat].away = false; // reconnect
        if (wasAway && room.game?.winner === null && room.order[room.game.turn] === seat) schedule(room);
      } else if (room.status !== 'playing') {
        seat = room.seats.findIndex((s) => !s);
        if (seat < 0) {
          const botSeat = room.seats.findIndex((s) => s.isBot);
          seat = botSeat; // a human bumps a bot when the table is full of them
        }
        if (seat >= 0) room.seats[seat] = { userId: uid, name: socket.data.name, isBot: false, suit: socket.data.suit };
      }
      ack(cb, null, { seat });
      emitState(room);
      lobbyPing(room);
    });

    socket.on('table:leave', () => {
      const room = roomOf();
      if (!room) return;
      socket.leave(key(room.tableId));
      socket.data.tableId = null;
      leave(room, uid);
    });

    socket.on('game:start', async (_ = {}, cb) => {
      const room = roomOf();
      if (!room || seatOf(room, uid) < 0) return ack(cb, 'Take a seat first');
      try {
        await start(room, uid);
        ack(cb);
      } catch (err) {
        ack(cb, err.message);
      }
    });

    const turnAction = (type, run) => (payload = {}, cb) => {
      const room = roomOf();
      const g = room?.game;
      if (!g || g.winner !== null) return ack(cb, 'No match is running');
      const idx = room.order.indexOf(seatOf(room, uid));
      if (idx < 0) return ack(cb, "You're watching this match");
      if (g.turn !== idx) return ack(cb, "It's not your turn");
      const err = act(room, idx, () => run(g, idx, payload, room), { type });
      ack(cb, err);
    };

    socket.on('game:play', turnAction('play', (g, idx, p, room) => {
      const move = { cards: Array.isArray(p.cards) ? p.cards.slice(0, 9).map(String) : [], suit: p.suit, giftId: p.giftId };
      const snap = snapshot(g, idx, move);
      const events = engine.play(g, idx, move); // throws before changing anything if illegal
      room.history.push(snap);
      return events;
    }));
    socket.on('game:draw', turnAction('draw', (g, idx, _p, room) => {
      const snap = snapshot(g, idx, { draw: true });
      engine.draw(g, idx);
      room.history.push(snap);
      return [];
    }));
    socket.on('game:pass', turnAction('pass', (g, idx) => {
      engine.pass(g, idx);
      return [];
    }));

    socket.on('disconnect', () => {
      const room = roomOf();
      if (!room) return;
      // Give a refresh a few seconds to come back before giving the seat up.
      setTimeout(() => {
        const still = [...(io.sockets.adapter.rooms.get(key(room.tableId)) || [])]
          .some((sid) => io.sockets.sockets.get(sid)?.data.userId === uid);
        if (!still && rooms.get(room.tableId) === room) leave(room, uid);
      }, 8000);
    });
  });
}
