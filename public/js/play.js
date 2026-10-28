import { io } from '/socket.io/socket.io.esm.min.js';
import { gsap } from '/vendor/gsap/index.js';
import { requireUser, esc, badge, toast, prefersReducedMotion, themeToggle } from './core.js';
import { cardEl, describe, SUIT_NAMES, glyphSvg } from './cards.js';

document.querySelector('.pb-right').prepend(themeToggle());
const user = await requireUser();
const tableId = new URLSearchParams(location.search).get('t');
const reduced = prefersReducedMotion();
const $ = (s) => document.querySelector(s);

const el = {
  name: $('[data-table-name]'), code: $('[data-code]'), opps: $('[data-opps]'), center: $('[data-center]'),
  drawPile: $('[data-draw-pile]'), drawCount: $('[data-draw-count]'), discard: $('[data-discard]'),
  suitRing: $('[data-suit-ring]'), suitLabel: $('[data-suit-label]'), dir: $('[data-dir]'), pending: $('[data-pending]'),
  waiting: $('[data-waiting]'), seatList: $('[data-seat-list]'), waitingNote: $('[data-waiting-note]'),
  waitingTitle: $('[data-waiting-title]'), waitingEyebrow: $('[data-waiting-eyebrow]'),
  deal: $('[data-deal]'), dealError: $('[data-deal-error]'), log: $('[data-log]'), logList: $('[data-log-list]'),
  meId: $('[data-me-id]'), status: $('[data-status]'), hand: $('[data-hand]'),
  play: $('[data-play]'), draw: $('[data-draw]'), clear: $('[data-clear]'), picker: $('[data-suit-picker]'),
  results: $('#results'), resultsList: $('[data-results]'), resultsMeta: $('[data-results-meta]'), again: $('[data-again]'),
  rules: $('#rules'),
};

let S = null; // latest table state from the server
let sel = []; // selected card ids, in play order
let giftMode = false;

if (!/^[a-f0-9]{24}$/.test(tableId || '')) fatal('That table link looks broken.');

/* ---------- helpers ---------- */
const G = () => S?.game;
const myTurn = () => G() && G().winner === null && G().you >= 0 && G().turn === G().you;
const hand = () => G()?.hand || [];
const byId = (id) => hand().find((c) => c.id === id);
const seatName = (gi) => G()?.players[gi]?.name || 'Someone';
const isHost = () => S && S.ownerId === user.id;
const hostSeated = () => S?.seats.some((s) => s && s.userId === S.ownerId);

function isSpill(cards) {
  if (cards.length < 2) return true;
  if (cards.some((c) => c.kind !== 'num' || c.suit !== cards[0].suit)) return false;
  const step = cards[1].rank - cards[0].rank;
  return Math.abs(step) === 1 && cards.every((c, i) => !i || c.rank - cards[i - 1].rank === step);
}

function fatal(message) {
  document.body.classList.add('is-fatal');
  el.waiting.hidden = false;
  el.waitingEyebrow.textContent = 'Table unavailable';
  el.waitingTitle.textContent = message;
  el.seatList.innerHTML = '';
  el.waitingNote.innerHTML = '<a class="btn" href="/lobby">Back to the lobby</a>';
  el.deal.hidden = true;
}

/* ---------- socket ---------- */
const socket = io({ transports: ['websocket', 'polling'] });
socket.on('connect', () => {
  socket.emit('table:join', { tableId }, (r) => r?.error && fatal(r.error));
});
socket.on('connect_error', (e) => {
  if (e.message === 'unauthorized') location.replace(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
  else el.status.textContent = 'Reconnecting…';
});
socket.on('table:closed', ({ message }) => fatal(message));
socket.on('table:state', onState);
// Leaving the page just disconnects; the server holds the seat for a few seconds
// so a refresh mid-match doesn't hand your cards to a bot.

function send(event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, (r) => {
    if (r?.error) toast(r.error, { type: 'error' });
    resolve(r);
  }));
}

/* ---------- state ---------- */
function snapshotRects() {
  const rects = { hand: {}, opp: {} };
  for (const c of el.hand.querySelectorAll('.card[data-id]')) rects.hand[c.dataset.id] = c.getBoundingClientRect();
  for (const o of el.opps.querySelectorAll('[data-gi]')) rects.opp[o.dataset.gi] = o.querySelector('.opp-hand').getBoundingClientRect();
  rects.discard = el.discard.getBoundingClientRect();
  rects.draw = el.drawPile.getBoundingClientRect();
  return rects;
}

function onState(next) {
  const before = snapshotRects();
  const prevGame = S?.game;
  S = next;
  document.title = `${S.tableName} — Spillway`;
  el.name.textContent = S.tableName;
  el.code.hidden = !S.code;
  el.code.textContent = S.code;

  const g = S.game;
  const live = g && g.winner === null;
  document.body.classList.toggle('is-live', !!live);
  // Selections that no longer make sense are dropped.
  if (!myTurn()) { sel = []; giftMode = false; }
  sel = sel.filter(byId);

  renderWaiting();
  if (g) {
    renderOpponents();
    renderCenter();
    renderHand();
    renderLog();
  } else {
    el.opps.innerHTML = '';
    el.hand.innerHTML = '';
    el.discard.innerHTML = '';
  }
  renderMe();
  renderStatus();
  animate(S.event, before, prevGame);
  if (S.event?.type === 'over' && S.results) showResults();
}

/* ---------- waiting room ---------- */
function renderWaiting() {
  const g = S.game;
  const show = !g || g.winner !== null;
  el.waiting.hidden = !show;
  if (!show) return;
  const empty = S.seats.filter((s) => !s).length;
  el.waitingEyebrow.textContent = g ? 'Match finished' : `Table for ${S.seatsTotal}`;
  el.waitingTitle.textContent = g ? 'Another round?' : S.seats.filter((s) => s && !s.isBot).length > 1 ? 'Nearly ready.' : 'Pull up a chair.';
  el.seatList.innerHTML = S.seats.map((s, i) => {
    if (!s) return `<li class="open"><span class="mono-badge bot" aria-hidden="true">${i + 1}</span><span>Open seat</span></li>`;
    const tags = [s.userId === S.ownerId && 'host', i === S.you && 'you', s.isBot && 'bot'].filter(Boolean);
    return `<li>${badge(s.name, s.suit, { bot: s.isBot })}<span>${esc(s.name)}</span>${tags.map((t) => `<em>${t}</em>`).join('')}</li>`;
  }).join('');
  const canDeal = S.you >= 0 && (isHost() || !hostSeated());
  el.deal.hidden = !canDeal;
  el.deal.textContent = g ? 'Deal again' : 'Deal the cards';
  const notes = [];
  if (S.you < 0) notes.push('This table is full. You can watch, and you will get a seat when one frees up.');
  else if (!canDeal) notes.push('Waiting for the host to deal.');
  if (empty && S.botFill) notes.push(`${empty} empty seat${empty > 1 ? 's' : ''} will be filled by house bots.`);
  if (empty && !S.botFill) notes.push(`Bots are off here, so ${Math.max(0, 3 - S.seats.filter(Boolean).length)} more player(s) needed. Share code ${S.code}.`);
  notes.push(`${S.turnSeconds}s per turn · surges ${S.rules?.surgeStack ? 'stack' : "don't stack"} · gifts ${S.rules?.gift ? 'on' : 'off'}`);
  el.waitingNote.textContent = notes.join(' ');
}

el.deal.addEventListener('click', async () => {
  el.dealError.textContent = '';
  const r = await send('game:start');
  if (r?.error) el.dealError.textContent = r.error;
});
el.again.addEventListener('click', async () => {
  el.results.close();
  if (isHost() || !hostSeated()) await send('game:start');
});

/* ---------- seats ---------- */
function viewer() {
  const g = G();
  return g.you >= 0 ? g.you : 0;
}

function renderOpponents() {
  const g = G();
  const n = g.players.length;
  const v = viewer();
  const others = Array.from({ length: n - 1 }, (_, k) => (v + 1 + k) % n);
  const pos = others.length === 3 ? ['left', 'top', 'right'] : ['top-left', 'top-right'];
  el.opps.innerHTML = others.map((gi, k) => {
    const p = g.players[gi];
    const seat = S.seats.find((s) => s && s.name === p.name && (s.userId || null) === (p.userId || null));
    const turn = g.winner === null && g.turn === gi;
    const backs = Array.from({ length: Math.min(p.count, 12) }, (_, i) => `<span class="mini-back" style="--i:${i - Math.min(p.count, 12) / 2}"></span>`).join('');
    return `<div class="opp pos-${pos[k]} ${turn ? 'is-turn' : ''} ${seat?.away ? 'is-away' : ''}" data-gi="${gi}">
      <div class="opp-id">${badge(p.name, seat?.suit, { bot: p.isBot })}<span class="opp-name">${esc(p.name)}</span>${seat?.away ? '<em>away</em>' : ''}</div>
      <div class="opp-hand" aria-label="${p.count} cards">${backs}</div>
      <span class="opp-count mono" aria-hidden="true">${p.count}</span>
      ${turn ? clockHtml(p.isBot || seat?.away) : ''}
    </div>`;
  }).join('');
}

function clockHtml(thinking) {
  if (thinking || !S.deadline) return '<span class="thinking" aria-label="Thinking"><i></i><i></i><i></i></span>';
  const left = Math.max(0, S.deadline - Date.now());
  return `<svg class="clock" viewBox="0 0 36 36" aria-hidden="true" style="--dur:${left}ms;--from:${1 - left / (S.turnSeconds * 1000)}"><circle cx="18" cy="18" r="15"/></svg>`;
}

/* ---------- center ---------- */
function renderCenter() {
  const g = G();
  el.drawCount.textContent = g.drawCount;
  el.drawPile.disabled = !myTurn() || !!g.drawn;
  el.discard.innerHTML = '';
  g.recent.forEach((c, i) => {
    const card = cardEl(c);
    card.style.setProperty('--r', `${((i * 37) % 17) - 8}deg`);
    card.style.setProperty('--dx', `${((i * 13) % 9) - 4}px`);
    el.discard.appendChild(card);
  });
  el.suitRing.dataset.suit = g.suit;
  el.suitRing.innerHTML = `${glyphSvg(g.suit, 18)}<span class="sr-only">Active suit: ${SUIT_NAMES[g.suit]}</span>`;
  el.suitRing.title = `Active suit: ${SUIT_NAMES[g.suit]}`;
  el.dir.textContent = g.dir === 1 ? '↻' : '↺';
  el.dir.title = g.dir === 1 ? 'Play goes to the left' : 'Play goes to the right';
  el.pending.hidden = !g.pendingDraw;
  el.pending.textContent = `+${g.pendingDraw}`;
}

/* ---------- my hand ---------- */
function renderMe() {
  const seat = S.you >= 0 ? S.seats[S.you] : null;
  const name = seat ? seat.name : 'Watching';
  el.meId.innerHTML = `${badge(seat?.name || user.displayName, seat?.suit || user.favoriteSuit)}<span>${esc(name)}</span>${myTurn() ? clockHtml(false) : ''}`;
  document.body.classList.toggle('my-turn', myTurn());
}

function renderHand() {
  const g = G();
  const cards = g.you >= 0 ? g.hand : Array.from({ length: g.players[0].count }, () => null);
  const playable = new Set(g.playable);
  const n = cards.length;
  el.hand.style.setProperty('--n', n);
  el.hand.innerHTML = '';
  cards.forEach((c, i) => {
    const b = cardEl(c, { tag: c ? 'button' : 'div' });
    b.style.setProperty('--i', i - (n - 1) / 2);
    if (c) {
      b.type = 'button';
      const order = sel.indexOf(c.id);
      const can = myTurn() && (giftMode ? !sel.includes(c.id) : playable.has(c.id) || order >= 0 || canExtend(c));
      b.classList.toggle('playable', can);
      b.classList.toggle('dim', myTurn() && !can);
      b.classList.toggle('selected', order >= 0);
      b.classList.toggle('drawn', g.drawn === c.id);
      if (order >= 0) b.insertAdjacentHTML('beforeend', `<span class="order mono" aria-hidden="true">${order + 1}</span>`);
      b.setAttribute('aria-pressed', order >= 0);
      b.setAttribute('aria-label', `${describe(c)}${can ? ', playable' : ''}${order >= 0 ? `, selected ${order + 1}` : ''}`);
    }
    el.hand.appendChild(b);
  });
  updateButtons();
}

function canExtend(c) {
  if (!sel.length || c.kind !== 'num' || G().drawn) return false;
  return isSpill([...sel.map(byId), c]);
}

function updateButtons() {
  const g = G();
  const mine = myTurn();
  el.play.disabled = !mine || !sel.length || giftMode;
  el.play.innerHTML = `${sel.length > 1 ? `Spill ${sel.length}` : 'Play'} <kbd>&crarr;</kbd>`;
  el.clear.hidden = !sel.length && !giftMode;
  el.draw.disabled = !mine || giftMode;
  if (g?.drawn) el.draw.innerHTML = 'Pass <kbd>P</kbd>';
  else if (g?.pendingDraw) el.draw.innerHTML = `Take +${g.pendingDraw} <kbd>D</kbd>`;
  else el.draw.innerHTML = 'Draw <kbd>D</kbd>';
}

function renderStatus() {
  const g = G();
  let msg = '';
  if (!g) msg = S.you >= 0 ? 'Seated. The match starts when the host deals.' : 'Watching.';
  else if (g.winner !== null) msg = `${seatName(g.winner)} emptied their hand.`;
  else if (g.you < 0) msg = `Watching. ${seatName(g.turn)} to play.`;
  else if (giftMode) msg = `Pick a card to hand to ${seatName((g.you + g.dir + g.players.length) % g.players.length)}.`;
  else if (myTurn()) {
    const top = g.top;
    const match = top.kind === 'num' ? `${SUIT_NAMES[g.suit]} or any ${top.rank}` : `${SUIT_NAMES[g.suit]} or a ${top.kind}`;
    if (g.pendingDraw) msg = g.playable.length ? `Surge on you. Answer with a surge, or take ${g.pendingDraw}.` : `Surge on you. Take ${g.pendingDraw}.`;
    else if (g.drawn) msg = `You drew ${describe(byId(g.drawn))}. Play it or pass.`;
    else if (sel.length) msg = sel.length > 1 ? `Spilling ${sel.length}. Add the next step or press Play.` : 'Add more of the same suit, one step up or down, or press Play.';
    else msg = g.playable.length ? `Your turn. Match ${match}.` : `Your turn. Nothing fits ${match}, so draw.`;
  } else {
    const p = g.players[g.turn];
    msg = p.isBot ? `${p.name} is thinking…` : `Waiting for ${p.name}.`;
  }
  el.status.textContent = msg;
}

/* ---------- interaction ---------- */
el.hand.addEventListener('click', (e) => {
  const b = e.target.closest('.card[data-id]');
  if (!b || !myTurn()) return;
  const c = byId(b.dataset.id);
  if (giftMode) {
    if (sel.includes(c.id)) return;
    commit({ giftId: c.id });
    return;
  }
  const at = sel.indexOf(c.id);
  if (at === 0) sel = [];
  else if (at > 0) sel = sel.slice(0, at);
  else if (canExtend(c)) sel.push(c.id);
  else if (G().playable.includes(c.id)) sel = [c.id];
  else {
    shake(b);
    return;
  }
  renderHand();
  renderStatus();
});

el.hand.addEventListener('dblclick', (e) => {
  const b = e.target.closest('.card[data-id]');
  if (b && myTurn() && !giftMode && G().playable.includes(b.dataset.id)) {
    sel = [b.dataset.id];
    tryPlay();
  }
});

function shake(node) {
  if (reduced) return;
  gsap.fromTo(node, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)', clearProps: 'transform' });
}

function tryPlay() {
  if (!myTurn() || !sel.length) return;
  const last = byId(sel[sel.length - 1]);
  if (last.kind === 'prism') {
    el.picker.hidden = false;
    el.picker.querySelector('[data-pick]').focus();
    return;
  }
  if (last.kind === 'gift' && hand().length > sel.length) {
    giftMode = true;
    renderHand();
    renderStatus();
    return;
  }
  commit({});
}

async function commit(extra) {
  const cards = [...sel];
  el.play.disabled = true;
  const r = await send('game:play', { cards, ...extra });
  if (!r?.error) {
    sel = [];
    giftMode = false;
  } else updateButtons();
}

el.play.addEventListener('click', tryPlay);
el.clear.addEventListener('click', () => {
  sel = [];
  giftMode = false;
  renderHand();
  renderStatus();
});
async function drawOrPass() {
  if (!myTurn()) return;
  sel = [];
  giftMode = false;
  await send(G().drawn ? 'game:pass' : 'game:draw');
}
el.draw.addEventListener('click', drawOrPass);
el.drawPile.addEventListener('click', () => !G()?.drawn && drawOrPass());

el.picker.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    el.picker.hidden = true;
    commit({ suit: pick.dataset.pick });
  }
  if (e.target.closest('[data-pick-cancel]')) el.picker.hidden = true;
});

el.code.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(S.code);
    toast(`Code ${S.code} copied`);
  } catch {
    toast(`Invite code: ${S.code}`);
  }
});

$('[data-open-rules]').addEventListener('click', () => el.rules.showModal());
$('[data-close-rules]').addEventListener('click', () => el.rules.close());
$('[data-toggle-log]').addEventListener('click', (e) => {
  el.log.hidden = !el.log.hidden;
  e.currentTarget.setAttribute('aria-expanded', !el.log.hidden);
});

addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || e.target.matches('input, textarea')) return;
  if (e.key === 'Escape') {
    el.picker.hidden = true;
    sel = [];
    giftMode = false;
    if (G()) { renderHand(); renderStatus(); }
  } else if (e.key === 'Enter' && sel.length && !e.target.matches('button')) {
    e.preventDefault();
    tryPlay();
  } else if (e.key.toLowerCase() === 'd' && myTurn() && !G().drawn) drawOrPass();
  else if (e.key.toLowerCase() === 'p' && myTurn() && G().drawn) drawOrPass();
});

/* ---------- log ---------- */
function renderLog() {
  const g = G();
  el.logList.innerHTML = [...g.log].reverse().map((l) => {
    const who = esc(seatName(l.who));
    const what = l.cards ? `${l.did === 'spill' ? 'spilled' : 'played'} ${l.cards.map(esc).join(' → ')}` : esc(l.did);
    return `<li><span class="mono">${String(l.t).padStart(3, '0')}</span> <b>${who}</b> ${what}</li>`;
  }).join('');
}

/* ---------- motion ---------- */
function fly(card, from, to, delay = 0) {
  const node = cardEl(card);
  node.classList.add('flyer');
  node.style.setProperty('--cw', `${to.width}px`);
  document.body.appendChild(node);
  return gsap.fromTo(node,
    { x: from.left, y: from.top, scale: from.width / to.width || 1, rotate: gsap.utils.random(-14, 14) },
    {
      x: to.left, y: to.top, scale: 1, rotate: gsap.utils.random(-6, 6), duration: 0.55, delay, ease: 'power3.inOut',
      onComplete: () => node.remove(),
    });
}

function animate(ev, before, prevGame) {
  const g = G();
  if (!ev || !g || reduced) return notify(ev);
  const discardRect = el.discard.getBoundingClientRect();
  const target = el.discard.lastElementChild;

  if (ev.cards?.length) {
    const from = ev.player === g.you ? null : before.opp[ev.player];
    const tops = [...el.discard.children].slice(-ev.cards.length);
    tops.forEach((t) => { t.style.opacity = 0; });
    const tl = gsap.timeline({ onComplete: () => tops.forEach((t) => { t.style.opacity = ''; }) });
    ev.cards.forEach((c, i) => {
      const src = from || before.hand[c.id] || before.draw;
      tl.add(fly(c, src, discardRect, 0), i * 0.12);
    });
    if (ev.cards.length >= 3) tl.add(() => gsap.fromTo(el.discard, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' }));
  }

  if (ev.type === 'draw' || ev.type === 'timeout') {
    const to = ev.player === g.you ? el.hand.getBoundingClientRect() : before.opp[ev.player];
    if (to) {
      const box = { left: to.left + to.width / 2 - 40, top: to.top, width: 80, height: 112 };
      fly(null, before.draw, box);
    }
  }

  if (ev.type === 'deal') {
    const cards = [...el.hand.children];
    gsap.from(cards, { y: -260, x: () => gsap.utils.random(-80, 80), rotate: () => gsap.utils.random(-30, 30), opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
    gsap.from(el.opps.querySelectorAll('.mini-back'), { scale: 0, opacity: 0, duration: 0.4, stagger: 0.02, delay: 0.2, clearProps: 'transform,opacity' });
  }

  // Newly arrived cards in my hand rise in from the pile.
  if (prevGame && g.you >= 0 && ev.type !== 'deal') {
    const old = new Set(prevGame.hand.map((c) => c.id));
    const fresh = [...el.hand.querySelectorAll('.card[data-id]')].filter((n) => !old.has(n.dataset.id));
    if (fresh.length) gsap.from(fresh, { y: 80, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.15, clearProps: 'transform,opacity' });
  }
  if (target && !ev.cards?.length) target.style.opacity = '';
  notify(ev);
}

function notify(ev) {
  const g = G();
  if (!ev || !g) return;
  const who = seatName(ev.player);
  const nextIdx = (ev.player + g.dir + g.players.length) % g.players.length;
  const last = ev.cards?.[ev.cards.length - 1];
  if (ev.cards?.length > 1) toast(`${who} spilled ${ev.cards.length}: ${ev.cards.map((c) => c.rank).join('-')}`, { suit: last.suit });
  if (last?.kind === 'surge') toast(`Surge. ${g.players[g.turn]?.name || 'Next player'} faces +${g.pendingDraw}`, { suit: last.suit });
  if (last?.kind === 'eddy') toast(`${who} reversed the table`, { suit: last.suit });
  if (last?.kind === 'prism') toast(`${who} called ${SUIT_NAMES[g.suit]}`, { suit: g.suit });
  if (ev.extra?.includes('gift')) toast(ev.player === g.you ? 'Gift delivered' : `${who} gifted ${nextIdx === g.you ? 'you' : seatName(nextIdx)} a card`, { suit: last?.suit });
  if (ev.extra?.includes('splash')) toast(`Splash. ${nextIdx === g.you ? 'You draw' : `${seatName(nextIdx)} draws`} one`, { suit: last?.suit });
  if (ev.type === 'timeout' && ev.player === g.you) toast('Your clock ran out', { type: 'error' });
}

/* ---------- results ---------- */
function showResults() {
  const r = S.results;
  const order = r.players.map((p, i) => ({ ...p, i })).sort((a, b) => (a.i === r.winner ? -1 : b.i === r.winner ? 1 : a.cardsLeft - b.cardsLeft));
  el.resultsMeta.textContent = `${r.turns} turns · best spill ${r.longestSpill}`;
  el.results.querySelector('h2').textContent = r.players[r.winner].userId === user.id ? 'You win.' : `${r.players[r.winner].name} wins.`;
  el.resultsList.innerHTML = order.map((p, k) => `<li class="${p.i === r.winner ? 'win' : ''}">
    <span class="mono rk">${k + 1}</span>
    <span class="nm">${esc(p.name)}${p.isBot ? ' <em>bot</em>' : ''}</span>
    <span class="mono">${p.i === r.winner ? `+${p.points} pts` : `${p.cardsLeft} left`}</span>
    <span class="mono delta ${p.ratingDelta > 0 ? 'up' : p.ratingDelta < 0 ? 'down' : ''}">${p.isBot ? '' : `${p.ratingDelta > 0 ? '+' : ''}${p.ratingDelta}`}</span>
  </li>`).join('');
  el.again.hidden = !(S.you >= 0 && (isHost() || !hostSeated()));
  if (!el.results.open) el.results.showModal();
}

// Keep the turn clock honest if the tab was in the background.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && G()) {
    renderOpponents();
    renderMe();
  }
});
