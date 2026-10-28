import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Table, Match, getBrain } from '../models.js';
import { RULES, validate, check } from '../validate.js';
import { requireAuth, clearSession } from '../auth.js';
import { onlineCount, tableChanged } from '../game/rooms.js';
import { FEATURES } from '../game/bot.js';

const router = Router();

const matchRow = (m) => ({
  id: m._id,
  tableName: m.tableName,
  players: m.players,
  winnerName: m.winnerName,
  winnerUser: m.winnerUser,
  turns: m.turns,
  longestSpill: m.longestSpill,
  durationMs: m.durationMs,
  createdAt: m.createdAt,
});

router.get('/leaderboard', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const users = await User.find({ 'stats.played': { $gt: 0 } }).sort({ rating: -1, 'stats.won': -1 }).limit(limit);
  res.json({ players: users.map((u) => u.toPublic()) });
});

router.get('/users/:username', async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user) return res.status(404).json({ error: 'No player by that name' });
  const [matches, rank] = await Promise.all([
    Match.find({ 'players.user': user._id }).sort({ createdAt: -1 }).limit(15),
    User.countDocuments({ rating: { $gt: user.rating }, 'stats.played': { $gt: 0 } }),
  ]);
  res.json({ user: user.toPublic(), rank: rank + 1, matches: matches.map(matchRow), isYou: String(req.user?._id) === String(user._id) });
});

router.patch('/users/me', requireAuth, validate({
  displayName: RULES.displayName, bio: RULES.bio, favoriteSuit: RULES.favoriteSuit,
}, { partial: true }), async (req, res) => {
  req.user.set(req.valid);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

// Deleting an account needs the password; match history keeps the name but loses the link.
router.delete('/users/me', requireAuth, async (req, res) => {
  const r = check(req.body, { password: { type: 'string', required: true, max: 72 } });
  if (!r.ok) return res.status(422).json({ error: 'Confirm with your password', fields: r.fields });
  if (!(await bcrypt.compare(r.value.password, req.user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong password', fields: { password: "That password isn't right" } });
  }
  const tables = await Table.find({ owner: req.user._id }, '_id');
  await Table.deleteMany({ owner: req.user._id });
  await Promise.all(tables.map((t) => tableChanged(t._id, true)));
  await Match.updateMany({ 'players.user': req.user._id }, { $set: { 'players.$[p].user': null } }, { arrayFilters: [{ 'p.user': req.user._id }] });
  await req.user.deleteOne();
  clearSession(res);
  res.json({ ok: true });
});

router.get('/matches', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const matches = await Match.find().sort({ createdAt: -1 }).limit(limit);
  res.json({ matches: matches.map(matchRow) });
});

router.get('/bot', async (_req, res) => {
  const brain = await getBrain();
  res.json({
    features: FEATURES,
    weights: brain.weights,
    matchesTrained: brain.matchesTrained,
    botWins: brain.botWins,
    history: brain.history,
  });
});

router.get('/stats', async (_req, res) => {
  const [players, matches, best, tables] = await Promise.all([
    User.countDocuments(),
    Match.countDocuments(),
    Match.findOne().sort({ longestSpill: -1, createdAt: 1 }).select('longestSpill winnerName'),
    Table.countDocuments({ visibility: 'public' }),
  ]);
  res.json({ players, matches, tables, online: onlineCount(), longestSpill: best?.longestSpill || 0 });
});

export default router;
