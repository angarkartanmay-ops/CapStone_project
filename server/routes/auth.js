import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';
import { RULES, validate, check } from '../validate.js';
import { setSession, clearSession } from '../auth.js';

const router = Router();

router.post('/register', validate({
  username: RULES.username, email: RULES.email, password: RULES.password, displayName: RULES.displayName,
}), async (req, res) => {
  const { username, email, password, displayName } = req.valid;
  const taken = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
  if (taken) {
    const field = taken.username === username.toLowerCase() ? 'username' : 'email';
    return res.status(409).json({ error: 'Already registered', fields: { [field]: `That ${field} is already taken` } });
  }
  const user = await User.create({ username, email, displayName, passwordHash: await bcrypt.hash(password, 10) });
  setSession(res, user);
  res.status(201).json({ user: user.toPublic() });
});

router.post('/login', async (req, res) => {
  const r = check(req.body, { login: { type: 'string', required: true, max: 120 }, password: { type: 'string', required: true, max: 72 } });
  if (!r.ok) return res.status(422).json({ error: 'Some fields need attention', fields: r.fields });
  const login = r.value.login.toLowerCase();
  const user = await User.findOne({ $or: [{ username: login }, { email: login }] });
  // Same message either way, so the form can't be used to probe which accounts exist.
  if (!user || !(await bcrypt.compare(r.value.password, user.passwordHash))) {
    return res.status(401).json({ error: "That username and password don't match" });
  }
  setSession(res, user);
  res.json({ user: user.toPublic() });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ user: req.user ? req.user.toPublic() : null }));

export default router;
