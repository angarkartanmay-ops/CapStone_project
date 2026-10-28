import { Router } from 'express';
import mongoose from 'mongoose';
import { Table } from '../models.js';
import { RULES, validate } from '../validate.js';
import { requireAuth } from '../auth.js';
import { occupancy, tableChanged } from '../game/rooms.js';

const router = Router();
const MAX_TABLES_PER_HOST = 5;

const tableRules = {
  name: RULES.tableName,
  seats: RULES.seats,
  turnSeconds: RULES.turnSeconds,
  botFill: RULES.bool,
  surgeStack: RULES.bool,
  gift: RULES.bool,
  visibility: RULES.visibility,
};

function shape(t, viewer) {
  const isOwner = viewer && String(t.owner?._id || t.owner) === String(viewer._id);
  return {
    id: t._id,
    name: t.name,
    owner: t.owner?.displayName ? { username: t.owner.username, displayName: t.owner.displayName, suit: t.owner.favoriteSuit } : null,
    isOwner,
    seats: t.seats,
    turnSeconds: t.turnSeconds,
    botFill: t.botFill,
    rules: t.rules,
    visibility: t.visibility,
    code: isOwner || t.visibility === 'public' ? t.code : undefined,
    status: t.status,
    matchesPlayed: t.matchesPlayed,
    createdAt: t.createdAt,
    ...occupancy(t._id),
  };
}

// The form sends house rules flat; the document nests them under `rules`.
function toDoc({ surgeStack, gift, ...rest }, create = false) {
  if (create) return { ...rest, rules: { surgeStack: surgeStack ?? true, gift: gift ?? true } };
  if (surgeStack !== undefined) rest['rules.surgeStack'] = surgeStack;
  if (gift !== undefined) rest['rules.gift'] = gift;
  return rest;
}

async function ownTable(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Table not found' }), null;
  const t = await Table.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Table not found' }), null;
  if (String(t.owner) !== String(req.user._id)) return res.status(403).json({ error: 'Only the host can change this table' }), null;
  if (t.status === 'playing') return res.status(409).json({ error: 'Wait for the current match to end' }), null;
  return t;
}

// READ (list): public tables plus your own private ones, live seat counts merged in.
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40);
  const filter = { $or: [{ visibility: 'public' }, ...(req.user ? [{ owner: req.user._id }] : [])] };
  if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (req.query.mine === '1' && req.user) filter.owner = req.user._id;
  const tables = await Table.find(filter).populate('owner', 'username displayName favoriteSuit').sort({ updatedAt: -1 }).limit(60);
  res.json({ tables: tables.map((t) => shape(t, req.user)) });
});

router.get('/code/:code', requireAuth, async (req, res) => {
  const t = await Table.findOne({ code: String(req.params.code).toUpperCase().slice(0, 6) }).populate('owner', 'username displayName favoriteSuit');
  if (!t) return res.status(404).json({ error: 'No table uses that code' });
  res.json({ table: { ...shape(t, req.user), code: t.code } });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Table not found' });
  const t = await Table.findById(req.params.id).populate('owner', 'username displayName favoriteSuit');
  if (!t) return res.status(404).json({ error: 'Table not found' });
  res.json({ table: shape(t, req.user) });
});

// CREATE
router.post('/', requireAuth, validate(tableRules), async (req, res) => {
  const count = await Table.countDocuments({ owner: req.user._id });
  if (count >= MAX_TABLES_PER_HOST) return res.status(409).json({ error: `You can host up to ${MAX_TABLES_PER_HOST} tables. Close one first.` });
  const t = await Table.create({ ...toDoc(req.valid, true), owner: req.user._id });
  await t.populate('owner', 'username displayName favoriteSuit');
  res.status(201).json({ table: shape(t, req.user) });
});

// UPDATE (partial)
router.patch('/:id', requireAuth, validate(tableRules, { partial: true }), async (req, res) => {
  const t = await ownTable(req, res);
  if (!t) return;
  t.set(toDoc(req.valid));
  await t.save();
  await t.populate('owner', 'username displayName favoriteSuit');
  await tableChanged(t._id);
  res.json({ table: shape(t, req.user) });
});

// DELETE
router.delete('/:id', requireAuth, async (req, res) => {
  const t = await ownTable(req, res);
  if (!t) return;
  await t.deleteOne();
  await tableChanged(t._id, true);
  res.json({ ok: true });
});

export default router;
