// Spillway rules engine. Pure state + functions, no I/O, so the server, the bots
// and the tests all share one source of truth for what a legal move is.

export const SUITS = ['ember', 'tide', 'moss', 'sol'];
export const HAND_SIZE = 7;
// Safety net: a match this long is a stalemate, so the smallest hand wins.
export const MAX_TURNS = 500;
const VALUES = { surge: 10, eddy: 10, gift: 10, prism: 20 };

/** 100 cards; 92 when gifts are switched off (an unplayable card could never leave a hand). */
export function buildDeck({ gift = true } = {}) {
  const deck = [];
  let n = 0;
  for (const suit of SUITS) {
    for (let copy = 0; copy < 2; copy++) {
      for (let rank = 1; rank <= 9; rank++) deck.push({ id: `c${n++}`, suit, kind: 'num', rank });
      for (const kind of gift ? ['surge', 'eddy', 'gift'] : ['surge', 'eddy']) deck.push({ id: `c${n++}`, suit, kind });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: `c${n++}`, suit: null, kind: 'prism' });
  return deck;
}

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const cardValue = (c) => (c.kind === 'num' ? c.rank : VALUES[c.kind]);
export const top = (s) => s.discard[s.discard.length - 1];
export const nextIndex = (s, from = s.turn) => (from + s.dir + s.players.length) % s.players.length;

export function newGame(players, rules = {}, rng = Math.random) {
  if (players.length < 3 || players.length > 4) throw new Error('Spillway needs 3 or 4 players');
  const gift = rules.gift !== false;
  const s = {
    players: players.map((p) => ({ ...p, hand: [] })),
    draw: shuffle(buildDeck({ gift }), rng),
    discard: [],
    suit: null,
    turn: 0,
    dir: 1,
    pendingDraw: 0,
    drawn: null, // id of the card drawn this turn; only that card may then be played
    winner: null,
    turnCount: 0,
    longestSpill: { length: 0, by: null },
    log: [],
    rules: { surgeStack: rules.surgeStack !== false, gift },
    rng,
  };
  for (let i = 0; i < HAND_SIZE; i++) for (const p of s.players) p.hand.push(s.draw.pop());
  // The opening card is always a number; actions are tucked back under the pile.
  let first = s.draw.pop();
  while (first.kind !== 'num') {
    s.draw.unshift(first);
    first = s.draw.pop();
  }
  s.discard.push(first);
  s.suit = first.suit;
  s.turn = Math.floor(rng() * s.players.length);
  return s;
}

function takeFromPile(s) {
  if (!s.draw.length) {
    const keep = s.discard.pop();
    s.draw = shuffle(s.discard, s.rng);
    s.discard = [keep];
  }
  return s.draw.pop() || null;
}

function giveCards(s, idx, count) {
  const got = [];
  for (let i = 0; i < count; i++) {
    const c = takeFromPile(s);
    if (!c) break;
    s.players[idx].hand.push(c);
    got.push(c);
  }
  return got;
}

/** Can `card` legally open a play on the current table? */
export function canStart(s, card) {
  if (s.pendingDraw > 0) return s.rules.surgeStack && card.kind === 'surge';
  if (card.kind === 'prism') return true;
  if (card.kind === 'gift' && !s.rules.gift) return false;
  if (card.suit === s.suit) return true;
  const t = top(s);
  if (card.kind === 'num') return t.kind === 'num' && t.rank === card.rank;
  return t.kind === card.kind;
}

/** A spill: number cards of one suit stepping by exactly +1 or -1 each time. */
export function isSpill(cards) {
  if (cards.length < 2) return true;
  if (cards.some((c) => c.kind !== 'num' || c.suit !== cards[0].suit)) return false;
  const step = cards[1].rank - cards[0].rank;
  if (Math.abs(step) !== 1) return false;
  return cards.every((c, i) => i === 0 || c.rank - cards[i - 1].rank === step);
}

function assertTurn(s, idx) {
  if (s.winner !== null) throw new Error('This match is over');
  if (s.turn !== idx) throw new Error("It's not your turn");
}

function log(s, entry) {
  s.log.push({ t: s.turnCount, ...entry });
  if (s.log.length > 40) s.log.shift();
}

/**
 * Play one card, or a spill of several. move = { cards: [ids], suit?, giftId? }
 * Throws with a player-readable message when the move is illegal.
 */
export function play(s, idx, move) {
  assertTurn(s, idx);
  const p = s.players[idx];
  const ids = Array.isArray(move?.cards) ? move.cards : [];
  if (!ids.length) throw new Error('Choose at least one card');
  if (new Set(ids).size !== ids.length) throw new Error('A card can only be played once');
  const cards = ids.map((id) => p.hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) throw new Error("That card isn't in your hand");
  if (s.drawn && (ids.length > 1 || ids[0] !== s.drawn)) throw new Error('After drawing you may only play the card you drew');
  if (!canStart(s, cards[0])) throw new Error("That card doesn't match the table");
  if (!isSpill(cards)) throw new Error('A spill must be one suit, climbing or falling by exactly one');

  const last = cards[cards.length - 1];
  if (last.kind === 'prism' && !SUITS.includes(move.suit)) throw new Error('Pick a suit for the prism');
  const gift = last.kind === 'gift' && p.hand.length > ids.length
    ? p.hand.find((c) => c.id === move.giftId && !ids.includes(c.id))
    : null;
  if (last.kind === 'gift' && p.hand.length > ids.length && !gift) throw new Error('Choose a card to gift');

  p.hand = p.hand.filter((c) => !ids.includes(c.id));
  s.discard.push(...cards);
  s.suit = last.kind === 'prism' ? move.suit : last.suit;
  s.drawn = null;
  s.turnCount++;
  const events = [{ type: 'play', player: idx, cards }];
  log(s, { who: idx, did: cards.length > 1 ? 'spill' : 'play', cards: cards.map(label) });

  if (cards.length > s.longestSpill.length) s.longestSpill = { length: cards.length, by: idx };

  if (last.kind === 'eddy') s.dir *= -1;
  if (last.kind === 'surge') s.pendingDraw += 2;

  const next = nextIndex(s, idx);
  if (gift) {
    p.hand = p.hand.filter((c) => c !== gift);
    s.players[next].hand.push(gift);
    events.push({ type: 'gift', from: idx, to: next });
  }

  if (!p.hand.length) {
    s.winner = idx;
    events.push({ type: 'win', player: idx });
    return events;
  }

  if (cards.length >= 3) {
    giveCards(s, next, 1);
    events.push({ type: 'splash', player: next });
    log(s, { who: next, did: 'splashed' });
  }
  s.turn = next;
  return events;
}

// Passing the turn on without a play. Stalemates can only build up this way,
// so this is where the turn limit is enforced.
function advance(s, idx) {
  s.turn = nextIndex(s, idx);
  if (s.turnCount >= MAX_TURNS) {
    const sizes = s.players.map((p) => p.hand.length);
    s.winner = sizes.indexOf(Math.min(...sizes));
    log(s, { who: s.winner, did: 'won on the turn limit' });
  }
}

/** Draw. Under a surge this takes the whole penalty and ends the turn. */
export function draw(s, idx) {
  assertTurn(s, idx);
  if (s.drawn) throw new Error('You already drew this turn');
  s.turnCount++;
  if (s.pendingDraw > 0) {
    const got = giveCards(s, idx, s.pendingDraw);
    log(s, { who: idx, did: `took ${got.length}` });
    s.pendingDraw = 0;
    advance(s, idx);
    return { card: null, ended: true };
  }
  const [card] = giveCards(s, idx, 1);
  log(s, { who: idx, did: 'drew' });
  if (card && canStart(s, card)) {
    s.drawn = card.id;
    return { card, ended: false };
  }
  advance(s, idx);
  return { card, ended: true };
}

export function pass(s, idx) {
  assertTurn(s, idx);
  if (!s.drawn) throw new Error('Draw before passing');
  s.drawn = null;
  log(s, { who: idx, did: 'passed' });
  advance(s, idx);
}

/** What happens when a turn clock runs out. */
export function autoMove(s, idx) {
  if (s.drawn) return pass(s, idx);
  const r = draw(s, idx);
  if (!r.ended) pass(s, idx);
}

export function scores(s) {
  const pts = s.players.map((p) => p.hand.reduce((sum, c) => sum + cardValue(c), 0));
  return s.players.map((p, i) => (i === s.winner ? pts.reduce((a, b) => a + b, 0) : 0));
}

export function label(c) {
  if (c.kind === 'num') return `${c.suit} ${c.rank}`;
  return c.kind === 'prism' ? 'prism' : `${c.suit} ${c.kind}`;
}

const strip = ({ id, suit, kind, rank }) => ({ id, suit, kind, rank });

/** The state one seat is allowed to see: own hand, everyone else's card counts. */
export function viewFor(s, idx) {
  const me = s.players[idx];
  return {
    you: idx,
    hand: me ? me.hand.map(strip) : [],
    playable: me && s.turn === idx && s.winner === null
      ? me.hand.filter((c) => (s.drawn ? c.id === s.drawn : canStart(s, c))).map((c) => c.id)
      : [],
    players: s.players.map((p) => ({ name: p.name, isBot: !!p.isBot, count: p.hand.length, userId: p.userId || null })),
    top: strip(top(s)),
    recent: s.discard.slice(-4).map(strip),
    suit: s.suit,
    turn: s.turn,
    dir: s.dir,
    pendingDraw: s.pendingDraw,
    drawn: s.drawn,
    drawCount: s.draw.length,
    winner: s.winner,
    turnCount: s.turnCount,
    log: s.log.slice(-12),
    rules: s.rules,
  };
}
