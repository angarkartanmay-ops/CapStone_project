import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, newGame, play, draw, pass, canStart, isSpill, viewFor, scores } from '../server/game/engine.js';
import { chooseMove, train, DEFAULT_WEIGHTS, FEATURES } from '../server/game/bot.js';

// Small deterministic PRNG so failures are reproducible.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const n = (suit, rank) => ({ id: `${suit}${rank}`, suit, kind: 'num', rank });
const players = (k) => Array.from({ length: k }, (_, i) => ({ name: `P${i}` }));
const total = (s) => s.draw.length + s.discard.length + s.players.reduce((a, p) => a + p.hand.length, 0);

test('deck has 100 unique cards, 92 without gifts', () => {
  const d = buildDeck();
  assert.equal(d.length, 100);
  assert.equal(new Set(d.map((c) => c.id)).size, 100);
  assert.equal(buildDeck({ gift: false }).filter((c) => c.kind === 'gift').length, 0);
  assert.equal(buildDeck({ gift: false }).length, 92);
});

test('deal: 7 each, a number card on top', () => {
  const s = newGame(players(4), {}, seeded(1));
  assert.ok(s.players.every((p) => p.hand.length === 7));
  assert.equal(s.discard[0].kind, 'num');
  assert.equal(total(s), 100);
});

test('spill shape', () => {
  assert.ok(isSpill([n('tide', 4), n('tide', 5), n('tide', 6)]));
  assert.ok(isSpill([n('tide', 4), n('tide', 3)]));
  assert.ok(!isSpill([n('tide', 4), n('tide', 6)]));
  assert.ok(!isSpill([n('tide', 4), n('moss', 5)]));
  assert.ok(!isSpill([n('tide', 4), n('tide', 5), n('tide', 4)]));
});

test('matching rules and the splash', () => {
  const s = newGame(players(3), {}, seeded(2));
  s.discard = [n('tide', 4)];
  s.suit = 'tide';
  s.turn = 0;
  s.players[0].hand = [n('tide', 5), n('tide', 6), n('tide', 7), n('ember', 4), n('moss', 9)];
  assert.ok(canStart(s, n('ember', 4)));
  assert.ok(!canStart(s, n('moss', 9)));
  assert.throws(() => play(s, 0, { cards: ['moss9'] }), /match/);
  assert.throws(() => play(s, 1, { cards: ['tide5'] }), /turn/);
  const before = s.players[1].hand.length;
  play(s, 0, { cards: ['tide5', 'tide6', 'tide7'] });
  assert.equal(s.players[1].hand.length, before + 1, 'three-card spill splashes the next player');
  assert.equal(s.turn, 1);
  assert.equal(s.longestSpill.length, 3);
});

test('surge stacks and draw takes the penalty', () => {
  const s = newGame(players(3), {}, seeded(3));
  const surge = (id, suit) => ({ id, suit, kind: 'surge' });
  s.discard = [n('sol', 2)];
  s.suit = 'sol';
  s.turn = 0;
  s.players[0].hand = [surge('a', 'sol'), n('sol', 3)];
  s.players[1].hand = [surge('b', 'moss'), n('moss', 1)];
  s.players[2].hand = [n('ember', 1), n('ember', 2)];
  play(s, 0, { cards: ['a'] });
  assert.equal(s.pendingDraw, 2);
  assert.throws(() => play(s, 1, { cards: ['moss1'] }));
  play(s, 1, { cards: ['b'] });
  assert.equal(s.pendingDraw, 4);
  draw(s, 2);
  assert.equal(s.players[2].hand.length, 6);
  assert.equal(s.turn, 0);
});

test('gift needs a target card and hands it on', () => {
  const s = newGame(players(3), {}, seeded(4));
  s.discard = [n('moss', 2)];
  s.suit = 'moss';
  s.turn = 0;
  s.players[0].hand = [{ id: 'g', suit: 'moss', kind: 'gift' }, n('ember', 9), n('sol', 1)];
  assert.throws(() => play(s, 0, { cards: ['g'] }), /gift/);
  assert.equal(s.players[0].hand.length, 3, 'failed move leaves the hand untouched');
  const before = s.players[1].hand.length;
  play(s, 0, { cards: ['g'], giftId: 'ember9' });
  assert.equal(s.players[1].hand.length, before + 1);
  assert.deepEqual(s.players[0].hand.map((c) => c.id), ['sol1']);
});

test('draw then pass, and the view hides other hands', () => {
  const s = newGame(players(3), {}, seeded(5));
  const i = s.turn;
  const r = draw(s, i);
  if (!r.ended) pass(s, i);
  assert.notEqual(s.turn, i);
  const v = viewFor(s, 0);
  assert.equal(v.players[1].hand, undefined);
  assert.equal(typeof v.players[1].count, 'number');
});

test('1,000 bot-only matches under every house rule finish, conserve cards and train', () => {
  let weights = { ...DEFAULT_WEIGHTS };
  const rng = seeded(42);
  // Every combination of house rules, 250 matches each.
  const variants = [{}, { gift: false }, { surgeStack: false }, { gift: false, surgeStack: false }];
  let stalled = 0;
  for (let g = 0; g < 1000; g++) {
    const rules = variants[g % 4];
    const s = newGame(players(3 + (g % 2)), rules, rng);
    const deckSize = rules.gift === false ? 92 : 100;
    const history = [];
    for (let turn = 0; s.winner === null; turn++) {
      assert.ok(turn < 2000, `match ${g} did not finish`);
      const i = s.turn;
      const pick = chooseMove(s, i, weights, rng);
      history.push({ player: i, f: pick.f });
      if (pick.move.draw) {
        const r = draw(s, i);
        if (!r.ended) pass(s, i);
      } else play(s, i, pick.move);
      assert.equal(total(s), deckSize);
    }
    if (s.players[s.winner].hand.length) stalled++;
    assert.ok(scores(s)[s.winner] >= 0);
    weights = train(weights, history, s.winner);
  }
  assert.ok(stalled < 10, `${stalled} matches hit the turn limit`);
  assert.ok(FEATURES.every((k) => Number.isFinite(weights[k]) && Math.abs(weights[k]) <= 3));
});
