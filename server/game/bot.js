// Bot policy: score every legal move with a weighted feature vector and take the best.
// The weights live in MongoDB (BotBrain) and are nudged after every finished match
// toward the moves the winner made, so the table "learns" from past games.
import { SUITS, canStart, isSpill, nextIndex, cardValue } from './engine.js';

export const FEATURES = ['shed', 'action', 'prism', 'holdPrism', 'pressure', 'suitStay', 'draw'];

export const DEFAULT_WEIGHTS = {
  shed: 1.2,      // cards leaving the hand this turn
  action: 0.4,    // playing a surge / eddy / gift
  prism: -0.6,    // spending a wild
  holdPrism: 0.3, // still holding a wild after this move
  pressure: 0.8,  // hitting a nearly-empty next player with a surge or gift
  suitStay: 0.9,  // share of my remaining hand that matches the suit I leave on the table
  draw: -1.5,     // drawing instead of playing
};

function runsFrom(hand, start) {
  // Every spill that starts with `start`: climb or fall by one inside its suit.
  const out = [[start]];
  if (start.kind !== 'num') return out;
  for (const step of [1, -1]) {
    let run = [start];
    for (;;) {
      const want = run[run.length - 1].rank + step;
      const nxt = hand.find((c) => c.kind === 'num' && c.suit === start.suit && c.rank === want && !run.includes(c));
      if (!nxt) break;
      run = [...run, nxt];
      out.push(run);
    }
  }
  return out;
}

function majoritySuit(hand) {
  const counts = Object.fromEntries(SUITS.map((s) => [s, 0]));
  for (const c of hand) if (c.suit) counts[c.suit] += 1;
  return SUITS.reduce((a, b) => (counts[b] > counts[a] ? b : a));
}

export function candidateMoves(s, idx) {
  const hand = s.players[idx].hand;
  const starts = hand.filter((c) => (s.drawn ? c.id === s.drawn : canStart(s, c)));
  const moves = [];
  for (const card of starts) {
    for (const run of s.drawn ? [[card]] : runsFrom(hand, card)) {
      if (!isSpill(run)) continue;
      const rest = hand.filter((c) => !run.includes(c));
      const move = { cards: run.map((c) => c.id) };
      const last = run[run.length - 1];
      if (last.kind === 'prism') move.suit = majoritySuit(rest.length ? rest : hand);
      if (last.kind === 'gift' && rest.length) {
        // Hand over the card that fits my hand worst: off-suit and expensive.
        const keep = majoritySuit(rest);
        const give = [...rest].filter((c) => c.kind !== 'prism').sort((a, b) =>
          (a.suit === keep) - (b.suit === keep) || cardValue(b) - cardValue(a))[0] || rest[0];
        move.giftId = give.id;
      }
      moves.push({ move, run, rest });
    }
  }
  moves.push({ move: { draw: true }, run: [], rest: hand });
  return moves;
}

export function features(s, idx, cand) {
  const { run, rest } = cand;
  const last = run[run.length - 1];
  const nextCount = s.players[nextIndex(s, idx)].hand.length;
  const leaveSuit = !last ? s.suit : last.kind === 'prism' ? cand.move.suit : last.suit;
  return {
    shed: run.length / 4,
    action: last && ['surge', 'eddy', 'gift'].includes(last.kind) ? 1 : 0,
    prism: last?.kind === 'prism' ? 1 : 0,
    holdPrism: rest.some((c) => c.kind === 'prism') ? 1 : 0,
    pressure: last && ['surge', 'gift'].includes(last.kind) && nextCount <= 3 ? 1 : 0,
    suitStay: rest.length ? rest.filter((c) => c.suit === leaveSuit).length / rest.length : 1,
    draw: run.length ? 0 : 1,
  };
}

export function chooseMove(s, idx, weights = DEFAULT_WEIGHTS, rng = Math.random, epsilon = 0.06) {
  const cands = candidateMoves(s, idx);
  const scored = cands.map((c) => {
    const f = features(s, idx, c);
    const score = FEATURES.reduce((sum, k) => sum + (weights[k] ?? 0) * f[k], 0);
    return { ...c, f, score };
  });
  // A little exploration keeps the learned weights from locking in too early.
  // The draw move is always last, so exploring never picks it.
  if (rng() < epsilon && scored.length > 1) return scored[Math.floor(rng() * (scored.length - 1))];
  return scored.reduce((a, b) => (b.score > a.score ? b : a));
}

/**
 * One step of learning after a match. Moves made by the winner pull the weights
 * toward their features, losers' moves push gently away.
 * ponytail: linear model + hand-picked features; a real policy net is the upgrade path.
 */
export function train(weights, history, winner, lr = 0.02) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const losers = new Set(history.map((h) => h.player).filter((p) => p !== winner)).size || 1;
  for (const { player, f } of history) {
    const sign = player === winner ? 1 : -1 / losers;
    for (const k of FEATURES) w[k] = Math.max(-3, Math.min(3, w[k] + lr * sign * (f[k] - 0.5)));
  }
  for (const k of FEATURES) w[k] = Math.round(w[k] * 1000) / 1000;
  return w;
}
