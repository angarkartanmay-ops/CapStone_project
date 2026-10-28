import { api, me, themeToggle } from './core.js';
import { validateForm, setErrors, liveValidate, busy } from './forms.js';
import { cardEl } from './cards.js';

document.querySelector('.auth-main').prepend(themeToggle());

const params = new URLSearchParams(location.search);
// Only allow same-site paths as a redirect target.
const next = /^\/(?!\/)/.test(params.get('next') || '') ? params.get('next') : '/lobby';

me().then((u) => { if (u) location.replace(next); });

const tabs = [...document.querySelectorAll('[role="tab"]')];
function show(mode) {
  for (const t of tabs) {
    const on = t.dataset.mode === mode;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  }
  history.replaceState(null, '', mode === 'register' ? '?mode=register' : location.pathname + (params.has('next') ? `?next=${encodeURIComponent(next)}` : ''));
}
tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.mode)));
document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const t = tabs[(i + 1) % tabs.length];
  show(t.dataset.mode);
  t.focus();
});
show(params.get('mode') === 'register' ? 'register' : 'login');

async function submit(form, path) {
  const { ok, values } = validateForm(form);
  if (!ok) return;
  const btn = form.querySelector('[type="submit"]');
  busy(btn, true, 'One moment…');
  try {
    await api(path, { method: 'POST', body: values });
    location.replace(next);
  } catch (err) {
    setErrors(form, err.fields, err.message);
    busy(btn, false);
  }
}

for (const [id, path] of [['form-login', '/auth/login'], ['form-register', '/auth/register']]) {
  const form = document.getElementById(id);
  liveValidate(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form, path);
  });
}

document.querySelector('[data-demo]').addEventListener('click', () => {
  document.getElementById('login').value = 'demo';
  document.getElementById('login-password').value = 'deal-me-in-7';
  document.querySelector('#form-login [type="submit"]').focus();
});

// Decorative hand on the left panel.
const fan = document.querySelector('[data-fan]');
[
  { suit: 'sol', kind: 'num', rank: 3 },
  { suit: 'tide', kind: 'num', rank: 4 },
  { suit: null, kind: 'prism' },
  { suit: 'tide', kind: 'num', rank: 5 },
  { suit: 'ember', kind: 'surge' },
].forEach((c, i, all) => {
  const el = cardEl(c);
  el.style.setProperty('--i', i - (all.length - 1) / 2);
  fan.appendChild(el);
});
