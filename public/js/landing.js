import { gsap } from '/vendor/gsap/index.js';
import { ScrollTrigger } from '/vendor/gsap/ScrollTrigger.js';
import Lenis from '/vendor/lenis/lenis.mjs';
import { api, esc, badge, mountHeader, timeAgo, winRate, prefersReducedMotion } from './core.js';
import { cardEl } from './cards.js';

gsap.registerPlugin(ScrollTrigger);
mountHeader();

const reduced = prefersReducedMotion();
if (reduced) document.documentElement.classList.add('no-motion');

/* ---------- Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync ---------- */
if (!reduced) {
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Hero entrance ---------- */
const heroTl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 1.3 } });
heroTl
  .from('.hero-title .line > span', { yPercent: 110, stagger: 0.09 }, 0.1)
  .to('.hero .reveal', { opacity: 1, y: 0, stagger: 0.08, duration: 1 }, 0.35);
if (reduced) heroTl.progress(1);

/* ---------- 3D hand ---------- */
const canvas = document.querySelector('.stage');
let scene = null;
const supportsGL = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
})();

if (supportsGL) {
  import('./hero3d.js').then(async ({ createCardScene }) => {
    scene = await createCardScene(canvas);
    canvas.classList.add('ready');
    addEventListener('pointermove', (e) => {
      scene.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
  }).catch((err) => console.warn('3D scene unavailable:', err));
}

/* ---------- Pinned spill section ---------- */
const steps = [...document.querySelectorAll('.step')];
const bar = document.querySelector('.spill-progress i');
ScrollTrigger.create({
  trigger: '.spill',
  start: 'top top',
  end: '+=220%',
  pin: true,
  scrub: true,
  onUpdate(self) {
    const p = self.progress;
    scene?.setProgress(p);
    bar.style.transform = `scaleX(${p})`;
    const active = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
  },
});
// The canvas only needs to draw while the hero or the spill section is on screen.
ScrollTrigger.create({
  trigger: '.specials',
  start: 'top bottom',
  onToggle: (self) => scene?.setVisible(!self.isActive),
});

/* ---------- Specials: cards with a tilt that follows the pointer ---------- */
for (const art of document.querySelectorAll('.special-art')) {
  const c = JSON.parse(art.dataset.card);
  const stack = document.createElement('div');
  stack.className = 'stack';
  for (let i = 0; i < 2; i++) {
    const ghost = cardEl(null);
    ghost.classList.add('ghost');
    stack.appendChild(ghost);
  }
  stack.appendChild(cardEl(c));
  art.appendChild(stack);

  if (!reduced) {
    gsap.from(stack, {
      rotate: art.closest('.flip') ? 14 : -14, y: 80, opacity: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: art, start: 'top 82%' },
    });
    gsap.from(art.nextElementSibling.children, {
      y: 30, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: art, start: 'top 78%' },
    });
    art.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      stack.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 18}deg)`;
    });
    art.addEventListener('pointerleave', () => { stack.style.transform = ''; });
  }
}

if (!reduced) {
  for (const h of document.querySelectorAll('.section-head, .learns-copy, .closer-grid')) {
    gsap.from(h.children, { y: 40, opacity: 0, stagger: 0.08, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 80%' } });
  }
}

/* ---------- Live data ---------- */
const fmt = new Intl.NumberFormat('en-IN');

api('/stats').then((s) => {
  const set = (k, v) => { document.querySelector(`[data-k="${k}"]`).textContent = v; };
  set('matches', fmt.format(s.matches));
  set('players', fmt.format(s.players));
  set('longestSpill', s.longestSpill ? `${s.longestSpill} cards` : '–');
  set('online', fmt.format(s.online));
  if (!reduced) {
    for (const k of ['matches', 'players']) {
      const el = document.querySelector(`[data-k="${k}"]`);
      const obj = { v: 0 };
      gsap.to(obj, { v: s[k], duration: 1.6, ease: 'power3.out', delay: 0.6, onUpdate: () => { el.textContent = fmt.format(Math.round(obj.v)); } });
    }
  }
}).catch(() => {
  document.querySelector('[data-stats]').hidden = true;
});

const TRAITS = {
  shed: ['Shed cards fast', 'cards played / 4'],
  action: ['Play actions', 'surge, eddy, gift'],
  prism: ['Spend a prism', 'play the wild'],
  holdPrism: ['Keep a prism back', 'still holding one'],
  pressure: ['Punish a short hand', 'next player ≤ 3 cards'],
  suitStay: ['Stay in my suit', 'share of hand that fits'],
  draw: ['Draw instead', 'skip playing'],
};

function sparkline(values) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24 - 2}`).join('');
  return `<svg class="w-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}

api('/bot').then((b) => {
  const box = document.querySelector('[data-weights]');
  const max = Math.max(...b.features.map((f) => Math.abs(b.weights[f])), 1);
  box.innerHTML = `<div class="sr-only" role="row"><span role="columnheader">Trait</span><span role="columnheader">Weight</span></div>` + b.features.map((f) => {
    const w = b.weights[f];
    const width = (Math.abs(w) / max) * 50;
    const [name, sub] = TRAITS[f] || [f, ''];
    return `<div class="w-row" role="row">
      <span class="w-name" role="cell">${name}<small>${sub}</small></span>
      <span class="w-bar" aria-hidden="true"><i class="${w >= 0 ? 'pos' : 'neg'}" style="width:${width}%"></i></span>
      <span class="w-val mono" role="cell">${w >= 0 ? '+' : ''}${w.toFixed(2)}</span>
      ${sparkline(b.history.map((h) => h[f]))}
    </div>`;
  }).join('');
  ScrollTrigger.create({ trigger: box, start: 'top 80%', once: true, onEnter: () => box.classList.add('in') });
  const share = b.matchesTrained ? ((b.botWins / b.matchesTrained) * 100).toFixed(1) : '0';
  document.querySelector('[data-brain-meta]').textContent =
    `Trained on ${fmt.format(b.matchesTrained)} matches · bots took ${share}% of them · sparklines show the last ${b.history.length} snapshots`;
}).catch(() => {
  document.querySelector('[data-weights]').innerHTML = '<p>The bot is offline right now.</p>';
});

api('/leaderboard?limit=6').then(({ players }) => {
  const board = document.querySelector('[data-board]');
  if (!players.length) {
    board.innerHTML = '<li><span></span><span></span><span class="nm">No rated matches yet. Be the first.</span></li>';
    return;
  }
  board.innerHTML = players.map((p, i) => `<li>
    <span class="rk">${String(i + 1).padStart(2, '0')}</span>
    ${badge(p.displayName, p.favoriteSuit)}
    <span class="nm"><a href="/profile?u=${esc(p.username)}">${esc(p.displayName)}</a><small>@${esc(p.username)}</small></span>
    <span class="rt">${p.rating}</span>
    <span class="wr">${p.stats.won}–${p.stats.played - p.stats.won}<br>${winRate(p.stats)}</span>
  </li>`).join('');
  if (!reduced) gsap.from(board.children, { x: -20, opacity: 0, stagger: 0.06, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: board, start: 'top 85%' } });
}).catch(() => {});

api('/matches?limit=5').then(({ matches }) => {
  document.querySelector('[data-recent]').innerHTML = matches.map((m) => `<li>
    <b>${esc(m.winnerName)}</b> won at ${esc(m.tableName)}
    <small>${m.players.length} players · ${m.turns} turns · best spill ${m.longestSpill} · ${timeAgo(m.createdAt)}</small>
  </li>`).join('') || '<li>No matches yet.</li>';
}).catch(() => {});
