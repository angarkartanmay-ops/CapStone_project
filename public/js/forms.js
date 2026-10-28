// Client-side checks mirroring server/validate.js, plus helpers to show the
// server's field errors under the matching inputs.

const RULES = {
  username: { min: 3, max: 20, pattern: /^[a-z0-9_]+$/i, hint: 'Use letters, numbers and underscores only' },
  email: { max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, hint: "That doesn't look like an email address" },
  password: { min: 8, max: 72 },
  displayName: { min: 2, max: 32 },
  bio: { max: 160, optional: true },
  name: { min: 3, max: 40 },
  login: { max: 120 },
};

const NAMES = { displayName: 'display name', name: 'table name', login: 'username or email' };

export function checkField(name, value) {
  const r = RULES[name];
  if (!r) return '';
  const v = String(value ?? '').trim();
  const label = NAMES[name] || name;
  if (!v) return r.optional ? '' : `Enter your ${label}`;
  if (r.min && v.length < r.min) return `The ${label} needs at least ${r.min} characters`;
  if (r.max && v.length > r.max) return `The ${label} can be at most ${r.max} characters`;
  if (r.pattern && !r.pattern.test(v)) return r.hint;
  return '';
}

export function setErrors(form, fields = {}, message = '') {
  for (const f of form.querySelectorAll('.field')) {
    const input = f.querySelector('input, textarea, select');
    const out = f.querySelector('.error');
    const msg = input && fields[input.name];
    f.classList.toggle('has-error', !!msg);
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (out) out.textContent = msg || '';
  }
  const box = form.querySelector('.form-error');
  if (box) box.textContent = message;
}

/** Validate every named input that has a rule; returns { ok, values }. */
export function validateForm(form) {
  const values = Object.fromEntries(new FormData(form));
  const fields = {};
  for (const [k, v] of Object.entries(values)) {
    const err = checkField(k, v);
    if (err) fields[k] = err;
  }
  setErrors(form, fields, Object.keys(fields).length ? 'Fix the highlighted fields and try again.' : '');
  if (Object.keys(fields).length) form.querySelector('.has-error input, .has-error textarea')?.focus();
  return { ok: !Object.keys(fields).length, values };
}

/** Re-check a field when it loses focus so errors clear as people fix them. */
export function liveValidate(form) {
  form.addEventListener('focusout', (e) => {
    const input = e.target;
    if (!input.name || !RULES[input.name]) return;
    const f = input.closest('.field');
    const msg = input.value ? checkField(input.name, input.value) : '';
    f?.classList.toggle('has-error', !!msg);
    const out = f?.querySelector('.error');
    if (out) out.textContent = msg;
  });
}

export function busy(button, on, label) {
  if (on) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.textContent = label || 'Working…';
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}
