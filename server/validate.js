// Tiny declarative validator. Each rule describes one field; failures come back
// as { field: message } so the frontend can print them under the right input.
// The same limits are mirrored in public/js/forms.js for instant feedback.

export const RULES = {
  username: { type: 'string', required: true, min: 3, max: 20, pattern: /^[a-z0-9_]+$/i, hint: 'letters, numbers and underscores' },
  email: { type: 'string', required: true, max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, hint: 'a valid email address' },
  password: { type: 'string', required: true, min: 8, max: 72 },
  displayName: { type: 'string', required: true, min: 2, max: 32 },
  bio: { type: 'string', max: 160 },
  favoriteSuit: { type: 'enum', values: ['ember', 'tide', 'moss', 'sol'] },
  tableName: { type: 'string', required: true, min: 3, max: 40 },
  seats: { type: 'enum', values: [3, 4] },
  turnSeconds: { type: 'int', min: 10, max: 60 },
  bool: { type: 'bool' },
  visibility: { type: 'enum', values: ['public', 'private'] },
};

const label = (k) => k.replace(/([A-Z])/g, ' $1').toLowerCase();

export function check(input, schema, { partial = false } = {}) {
  const value = {};
  const fields = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = input?.[key];
    if (typeof v === 'string') v = v.trim();
    const missing = v === undefined || v === null || v === '';
    if (missing) {
      if (rule.required && !partial) fields[key] = `Enter your ${label(key)}`;
      continue;
    }
    const name = label(key);
    if (rule.type === 'string') {
      if (typeof v !== 'string') fields[key] = `The ${name} must be text`;
      else if (rule.min && v.length < rule.min) fields[key] = `The ${name} needs at least ${rule.min} characters`;
      else if (rule.max && v.length > rule.max) fields[key] = `The ${name} can be at most ${rule.max} characters`;
      else if (rule.pattern && !rule.pattern.test(v)) fields[key] = `The ${name} should be ${rule.hint}`;
    } else if (rule.type === 'int') {
      v = Number(v);
      if (!Number.isInteger(v) || v < rule.min || v > rule.max) fields[key] = `The ${name} must be a whole number from ${rule.min} to ${rule.max}`;
    } else if (rule.type === 'enum') {
      if (typeof rule.values[0] === 'number') v = Number(v);
      if (!rule.values.includes(v)) fields[key] = `The ${name} must be one of: ${rule.values.join(', ')}`;
    } else if (rule.type === 'bool') {
      if (typeof v !== 'boolean') fields[key] = `The ${name} must be true or false`;
    }
    if (!fields[key]) value[key] = v;
  }
  return { value, fields, ok: Object.keys(fields).length === 0 };
}

/** Express middleware: validated body lands on req.valid, otherwise 422. */
export const validate = (schema, opts) => (req, res, next) => {
  const r = check(req.body, schema, opts);
  if (!r.ok) return res.status(422).json({ error: 'Some fields need attention', fields: r.fields });
  req.valid = r.value;
  next();
};
