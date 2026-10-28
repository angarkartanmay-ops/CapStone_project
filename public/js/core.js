// Shared by every page: API calls, the signed-in user, the header, toasts.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.fields = body?.fields || {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, { error: "Can't reach the server. Check that it's running." });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

let mePromise;
export const me = () => (mePromise ||= api('/auth/me').then((d) => d.user).catch(() => null));
export const forgetMe = () => { mePromise = null; };

/** Redirects to sign-in when there is no session; resolves to the user otherwise. */
export async function requireUser() {
  const user = await me();
  if (!user) {
    location.replace(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
    return new Promise(() => {});
  }
  return user;
}

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function badge(name, suit, { bot = false, size = '' } = {}) {
  return `<span class="mono-badge ${size} ${bot ? 'bot' : ''}" data-suit="${esc(suit || '')}" aria-hidden="true">${bot ? 'AI' : esc(initials(name))}</span>`;
}

const NAV = [
  ['/lobby', 'Lobby'],
  ['/rules', 'Rules'],
  ['/lobby#leaderboard', 'Leaderboard'],
];

/** Light/dark switch. The theme itself is applied by js/theme.js before first paint. */
export function themeToggle() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'theme-toggle';
  b.innerHTML = `<svg class="moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    <svg class="sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const sync = () => {
    const dark = window.spillwayTheme?.current() === 'dark';
    b.setAttribute('aria-pressed', dark);
    b.setAttribute('aria-label', 'Dark theme');
    b.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  };
  b.addEventListener('click', () => {
    window.spillwayTheme?.set(window.spillwayTheme.current() === 'dark' ? 'light' : 'dark');
  });
  addEventListener('themechange', sync);
  sync();
  return b;
}

export async function mountHeader() {
  const head = document.querySelector('[data-header]');
  if (!head) return;
  const here = location.pathname.replace(/\.html$/, '');
  head.className = 'site-head';
  head.innerHTML = `<div class="wrap">
    <a class="wordmark" href="/" aria-label="Spillway home"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Spillway</a>
    <nav class="nav-links" aria-label="Main">${NAV.map(([href, label]) => `<a href="${href}" ${href === here ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div class="nav-user"></div>
  </div>`;
  head.querySelector('.nav-user').before(themeToggle());
  const slot = head.querySelector('.nav-user');
  const user = await me();
  if (user) {
    slot.innerHTML = `<a class="chip-user" href="/profile?u=${esc(user.username)}">${badge(user.displayName, user.favoriteSuit)}<span class="name">${esc(user.displayName)}</span></a>
      <button class="btn ghost sm" type="button" data-logout>Sign out</button>`;
    slot.querySelector('[data-logout]').addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
      location.href = '/';
    });
  } else {
    slot.innerHTML = `<a class="btn ghost sm" href="/auth">Sign in</a><a class="btn sm" href="/auth?mode=register">Create account</a>`;
  }
}

let toastBox;
export function toast(message, { type = '', suit = '', ms = 3200 } = {}) {
  toastBox ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'toasts' });
  toastBox.setAttribute('role', 'status');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  if (suit) el.dataset.suit = suit;
  el.textContent = message;
  toastBox.appendChild(el);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date)) / 1000);
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let v = s;
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round(v), unit);
    v /= n;
  }
  return '';
}

export const winRate = (st) => (st.played ? `${((st.won / st.played) * 100).toFixed(1)}%` : '–');
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
