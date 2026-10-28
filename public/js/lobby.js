import { io } from '/socket.io/socket.io.esm.min.js';
import { api, esc, badge, mountHeader, requireUser, toast, timeAgo, winRate } from './core.js';
import { checkField, setErrors, busy } from './forms.js';

mountHeader();
const user = await requireUser();

const $ = (s) => document.querySelector(s);
const list = $('[data-tables]');
let tables = [];
let filter = 'all';
let query = '';

/* ---------- Greeting + my numbers ---------- */
const hour = new Date().getHours();
$('[data-greet]').textContent = `${hour < 5 ? 'Late one' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'}, ${user.displayName.split(' ')[0]}.`;
$('[data-today]').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

api(`/users/${encodeURIComponent(user.username)}`).then(({ user: u, rank }) => {
  const vals = [u.rating, u.stats.played ? `#${rank}` : '–', u.stats.played, winRate(u.stats)];
  document.querySelectorAll('[data-me] dd').forEach((dd, i) => {
    dd.classList.remove('skel');
    dd.textContent = vals[i];
  });
}).catch(() => {});

/* ---------- Tables ---------- */
const seatDots = (t) => Array.from({ length: t.seats }, (_, i) => `<i class="${i < t.seated ? 'on' : ''}"></i>`).join('');

function row(t) {
  const chips = [
    `${t.turnSeconds}s turns`,
    t.botFill ? 'Bots fill seats' : 'Humans only',
    t.rules.surgeStack ? 'Surges stack' : 'No stacking',
    t.rules.gift ? 'Gifts on' : 'No gifts',
    t.visibility === 'private' ? `Code ${t.code}` : null,
  ].filter(Boolean);
  const status = t.status === 'playing' || t.live
    ? '<span class="t-status live"><span class="live-dot"></span>In play</span>'
    : `<span class="t-status">${t.seated ? `${t.seated} waiting` : 'Empty'}</span>`;
  const host = t.owner ? `${badge(t.owner.displayName, t.owner.suit)}<span>${t.isOwner ? 'Your table' : `Hosted by ${esc(t.owner.displayName)}`}</span>` : '';
  return `<li class="t-row" data-id="${t.id}">
    <div class="t-main">
      <a class="t-name" href="/play?t=${t.id}">${esc(t.name)}</a>
      <span class="t-host">${host}</span>
    </div>
    <div class="t-seats" aria-label="${t.seated} of ${t.seats} seats taken">${seatDots(t)}</div>
    <ul class="t-chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    ${status}
    <div class="t-actions">
      ${t.isOwner ? `<button class="icon-btn" type="button" data-edit aria-label="Edit ${esc(t.name)}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
        <button class="icon-btn" type="button" data-delete aria-label="Close ${esc(t.name)}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>` : ''}
      <a class="btn sm" href="/play?t=${t.id}" data-suit="${t.owner?.suit || 'tide'}">${t.status === 'playing' ? 'Watch' : 'Sit down'}</a>
    </div>
  </li>`;
}

function render() {
  const shown = tables.filter((t) => (filter === 'mine' ? t.isOwner : filter === 'open' ? t.status !== 'playing' && t.seated < t.seats : true));
  if (!shown.length) {
    const msg = query ? `No table is called anything like “${esc(query)}”.` : filter === 'mine' ? "You aren't hosting a table yet." : 'Every seat is taken right now.';
    list.innerHTML = `<li class="empty">
      <div class="empty-cards" aria-hidden="true"><span></span><span></span><span></span></div>
      <p>${msg}</p>
      <button class="btn sm" type="button" data-new>Open a table</button>
    </li>`;
    return;
  }
  list.innerHTML = shown.map(row).join('');
}

async function load() {
  try {
    const { tables: t } = await api(`/tables${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    tables = t;
    render();
  } catch (err) {
    list.innerHTML = `<li class="empty"><p>${esc(err.message)}</p><button class="btn sm outline" type="button" data-retry>Try again</button></li>`;
  }
}
load();

document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-pressed', x === b);
  });
  render();
}));

let searchTimer;
$('[data-search]').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query = e.target.value.trim();
    load();
  }, 220);
});

/* ---------- Create / edit dialog ---------- */
const dialog = $('#table-dialog');
const form = dialog.querySelector('form');
const turnOut = $('[data-turn-out]');
let editing = null;

form.turnSeconds.addEventListener('input', () => { turnOut.textContent = `${form.turnSeconds.value}s`; });

function openDialog(t = null) {
  editing = t;
  setErrors(form, {}, '');
  $('#table-dialog-h').textContent = t ? 'Edit table' : 'New table';
  form.querySelector('[data-save]').textContent = t ? 'Save changes' : 'Create table';
  form.name.value = t?.name || '';
  form.querySelector(`[name="seats"][value="${t?.seats || 4}"]`).checked = true;
  form.querySelector(`[name="visibility"][value="${t?.visibility || 'public'}"]`).checked = true;
  form.turnSeconds.value = t?.turnSeconds || 25;
  turnOut.textContent = `${form.turnSeconds.value}s`;
  form.botFill.checked = t ? t.botFill : true;
  form.surgeStack.checked = t ? t.rules.surgeStack : true;
  form.gift.checked = t ? t.rules.gift : true;
  dialog.showModal();
  form.name.focus();
}

form.addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'save') return;
  e.preventDefault();
  const nameErr = checkField('name', form.name.value);
  if (nameErr) {
    setErrors(form, { name: nameErr }, '');
    form.name.focus();
    return;
  }
  const body = {
    name: form.name.value.trim(),
    seats: Number(form.seats.value),
    visibility: form.visibility.value,
    turnSeconds: Number(form.turnSeconds.value),
    botFill: form.botFill.checked,
    surgeStack: form.surgeStack.checked,
    gift: form.gift.checked,
  };
  const btn = form.querySelector('[data-save]');
  busy(btn, true, 'Saving…');
  try {
    const { table } = editing
      ? await api(`/tables/${editing.id}`, { method: 'PATCH', body })
      : await api('/tables', { method: 'POST', body });
    dialog.close();
    toast(editing ? `Saved “${table.name}”` : `“${table.name}” is open`, { suit: 'moss' });
    if (!editing) location.href = `/play?t=${table.id}`;
    else load();
  } catch (err) {
    setErrors(form, err.fields?.tableName ? { name: err.fields.tableName } : err.fields, err.message);
  } finally {
    busy(btn, false);
  }
});

/* ---------- Delete ---------- */
const del = $('#delete-dialog');
let deleting = null;
del.addEventListener('close', async () => {
  if (del.returnValue !== 'delete' || !deleting) return;
  const t = deleting;
  deleting = null;
  try {
    await api(`/tables/${t.id}`, { method: 'DELETE' });
    tables = tables.filter((x) => x.id !== t.id);
    render();
    toast(`Closed “${t.name}”`);
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-new]')) return openDialog();
  if (e.target.closest('[data-retry]')) return load();
  const rowEl = e.target.closest('.t-row');
  const t = rowEl && tables.find((x) => x.id === rowEl.dataset.id);
  if (!t) return;
  if (e.target.closest('[data-edit]')) openDialog(t);
  if (e.target.closest('[data-delete]')) {
    deleting = t;
    $('[data-delete-text]').textContent = `“${t.name}” disappears from the lobby. Past matches stay in everyone's history.`;
    del.returnValue = '';
    del.showModal();
  }
});

/* ---------- Join by code ---------- */
$('[data-join]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('[data-join-error]');
  const code = e.target.code.value.trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(code)) {
    out.textContent = 'Codes are six characters, letters A–F and numbers.';
    return;
  }
  out.textContent = '';
  try {
    const { table } = await api(`/tables/code/${code}`);
    location.href = `/play?t=${table.id}`;
  } catch (err) {
    out.textContent = err.message;
  }
});

/* ---------- Leaderboard + feed ---------- */
api('/leaderboard?limit=10').then(({ players }) => {
  $('[data-board]').innerHTML = players.map((p, i) => `<li class="${p.username === user.username ? 'me' : ''}">
    <span class="rk mono">${i + 1}</span>${badge(p.displayName, p.favoriteSuit)}
    <a href="/profile?u=${esc(p.username)}">${esc(p.displayName)}</a>
    <span class="mono">${p.rating}</span>
  </li>`).join('') || '<li>No rated matches yet.</li>';
});

api('/matches?limit=6').then(({ matches }) => {
  $('[data-feed]').innerHTML = matches.map((m) => `<li><b>${esc(m.winnerName)}</b> won at ${esc(m.tableName)}<small class="mono">${m.turns} turns · spill ${m.longestSpill} · ${timeAgo(m.createdAt)}</small></li>`).join('') || '<li>Nothing yet.</li>';
});

/* ---------- Live seat counts ---------- */
const socket = io({ transports: ['websocket', 'polling'] });
socket.on('connect', () => socket.emit('lobby:watch'));
socket.on('lobby:update', (u) => {
  const t = tables.find((x) => x.id === u.tableId);
  if (!t) return;
  Object.assign(t, { seated: u.seated, humans: u.humans, live: u.live, status: u.live ? 'playing' : 'open' });
  render();
});
