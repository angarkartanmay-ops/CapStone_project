import { api, esc, badge, mountHeader, toast, timeAgo, winRate, forgetMe } from './core.js';
import { validateForm, setErrors, liveValidate, busy } from './forms.js';
import { SUITS, SUIT_NAMES, glyphSvg } from './cards.js';

mountHeader();
const root = document.querySelector('[data-profile]');
const username = new URLSearchParams(location.search).get('u');

function ratingChart(values) {
  if (values.length < 2) return '<p class="muted">The chart appears after a couple of rated matches.</p>';
  const W = 640;
  const H = 180;
  const pad = 28;
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const x = (i) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(values.length - 1)},${H - pad}L${x(0)},${H - pad}Z`;
  const ticks = [min + 10, Math.round((min + max) / 2), max - 10];
  const last = values.length - 1;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating over the last ${values.length} matches, from ${values[0]} to ${values[last]}">
    ${ticks.map((t) => `<g><line x1="${pad}" x2="${W - pad}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${W - pad + 4}" y="${y(t) + 4}" class="tick">${Math.round(t)}</text></g>`).join('')}
    <path d="${area}" class="area"/>
    <path d="${line}" class="line"/>
    <circle cx="${x(last)}" cy="${y(values[last])}" r="4.5" class="dot"/>
  </svg>`;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n] || 'th'}`;
const mine = (m, id) => m.players.find((p) => String(p.user) === String(id));
const place = (m, me) => [...m.players].sort((a, b) => a.cardsLeft - b.cardsLeft).indexOf(me) + 1;

async function render() {
  if (!username) {
    location.replace('/lobby');
    return;
  }
  let data;
  try {
    data = await api(`/users/${encodeURIComponent(username)}`);
  } catch (err) {
    root.innerHTML = `<section class="empty big"><h1 class="display">${err.status === 404 ? 'No such player.' : 'Something went wrong.'}</h1><p>${esc(err.message)}</p><a class="btn" href="/lobby">Back to the lobby</a></section>`;
    return;
  }
  const { user: u, rank, matches, isYou } = data;
  document.title = `${u.displayName} — Spillway`;
  const joined = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(u.createdAt));

  root.innerHTML = `
    <section class="p-head" data-suit="${esc(u.favoriteSuit)}">
      ${badge(u.displayName, u.favoriteSuit, { size: 'lg' })}
      <div class="p-id">
        <p class="eyebrow">@${esc(u.username)} · joined ${joined}</p>
        <h1 class="display">${esc(u.displayName)}</h1>
        ${u.bio ? `<p class="p-bio">${esc(u.bio)}</p>` : ''}
      </div>
      <span class="p-suit" title="Favourite suit">${glyphSvg(u.favoriteSuit, 20)} ${SUIT_NAMES[u.favoriteSuit]}</span>
    </section>

    <dl class="p-stats">
      <div><dt>Rating</dt><dd class="mono big">${u.rating}</dd></div>
      <div><dt>Rank</dt><dd class="mono">${u.stats.played ? `#${rank}` : '–'}</dd></div>
      <div><dt>Played</dt><dd class="mono">${u.stats.played}</dd></div>
      <div><dt>Won</dt><dd class="mono">${u.stats.won} <small>${winRate(u.stats)}</small></dd></div>
      <div><dt>Longest spill</dt><dd class="mono">${u.stats.longestSpill || '–'}</dd></div>
      <div><dt>Points</dt><dd class="mono">${u.stats.points}</dd></div>
    </dl>

    <div class="p-grid">
      <section class="p-chart" aria-labelledby="ch-h">
        <h2 id="ch-h" class="sub-h">Rating, last ${u.ratingHistory.length - 1 > 0 ? u.ratingHistory.length - 1 : 0} matches</h2>
        ${ratingChart(u.ratingHistory)}
      </section>

      <section aria-labelledby="mh-h">
        <h2 id="mh-h" class="sub-h">Match history</h2>
        ${matches.length ? `<ul class="history">${matches.map((m) => {
          const me = mine(m, u.id);
          const won = String(m.winnerUser) === String(u.id);
          const delta = me?.ratingDelta || 0;
          return `<li class="${won ? 'won' : ''}">
            <span class="h-place mono">${won ? 'WON' : ordinal(place(m, me))}</span>
            <span class="h-main"><b>${esc(m.tableName)}</b><small>vs ${m.players.filter((p) => p !== me).map((p) => esc(p.name)).join(', ')}</small></span>
            <span class="h-meta mono">${m.turns} turns<br>${timeAgo(m.createdAt)}</span>
            <span class="h-delta mono ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${delta}</span>
          </li>`;
        }).join('')}</ul>` : '<div class="empty"><p>No matches yet. The lobby has seats open.</p><a class="btn sm" href="/lobby">Find a table</a></div>'}
      </section>
    </div>

    ${isYou ? `
    <section class="p-edit" aria-labelledby="ed-h">
      <h2 id="ed-h" class="sub-h">Edit profile</h2>
      <form class="edit-form" novalidate>
        <p class="form-error" role="alert"></p>
        <div class="field">
          <label for="displayName">Display name</label>
          <input id="displayName" name="displayName" type="text" maxlength="32" value="${esc(u.displayName)}" required>
          <span class="error"></span>
        </div>
        <div class="field">
          <label for="bio">Bio <span class="hint" data-count></span></label>
          <textarea id="bio" name="bio" maxlength="160">${esc(u.bio)}</textarea>
          <span class="error"></span>
        </div>
        <fieldset class="field suit-pick">
          <legend class="label">Favourite suit</legend>
          <div>${SUITS.map((s) => `<label data-suit="${s}"><input type="radio" name="favoriteSuit" value="${s}" ${s === u.favoriteSuit ? 'checked' : ''}><span>${glyphSvg(s, 18)} ${SUIT_NAMES[s]}</span></label>`).join('')}</div>
        </fieldset>
        <div class="edit-actions">
          <button class="btn" type="submit" data-suit="${esc(u.favoriteSuit)}">Save profile</button>
          <button class="btn ghost danger-text" type="button" data-delete-account>Delete account…</button>
        </div>
      </form>
    </section>` : ''}
  `;

  if (isYou) wireEdit(u);
}

function wireEdit(u) {
  const form = root.querySelector('.edit-form');
  const count = form.querySelector('[data-count]');
  const updateCount = () => { count.textContent = `${form.bio.value.length}/160`; };
  updateCount();
  form.bio.addEventListener('input', updateCount);
  liveValidate(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { ok, values } = validateForm(form);
    if (!ok) return;
    const btn = form.querySelector('[type="submit"]');
    busy(btn, true, 'Saving…');
    try {
      await api('/users/me', { method: 'PATCH', body: values });
      toast('Profile saved', { suit: values.favoriteSuit });
      forgetMe();
      await render();
      mountHeader();
    } catch (err) {
      setErrors(form, err.fields, err.message);
      busy(btn, false);
    }
  });

  const dlg = document.getElementById('delete-account');
  const dform = dlg.querySelector('form');
  form.querySelector('[data-delete-account]').addEventListener('click', () => {
    setErrors(dform, {}, '');
    dform.reset();
    dlg.showModal();
  });
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  dform.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dform.password.value) return setErrors(dform, { password: 'Enter your password' }, '');
    try {
      await api('/users/me', { method: 'DELETE', body: { password: dform.password.value } });
      location.href = '/';
    } catch (err) {
      setErrors(dform, err.fields, err.message);
    }
  });
}

render();
