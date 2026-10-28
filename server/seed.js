// Demo data. Instead of typing fake numbers, it plays real matches with the engine
// and the bot policy, so ratings, stats, match history and the bot's learned weights
// all agree with each other.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from './game/engine.js';
import { chooseMove, train, DEFAULT_WEIGHTS } from './game/bot.js';
import { User, Table, Match, BotBrain } from './models.js';

export const DEMO_PASSWORD = 'deal-me-in-7';

const PEOPLE = [
  ['demo', 'Rhea Castellan', 'tide', 'Plays every lunch break in Lab 4. Will spill a 2-3-4 just to watch you sigh.'],
  ['arjun_m', 'Arjun Mehrotra', 'ember', 'Hoards surges. Apologises for nothing.'],
  ['noorv', 'Noor Vaswani', 'moss', 'Long runs, longer silences.'],
  ['tobias_k', 'Tobias Kehlmann', 'sol', 'Counts cards out loud. Still loses to bots sometimes.'],
  ['ishita_r', 'Ishita Raghavan', 'tide', 'Runs the Night Shift table. Fifteen-second turns, no mercy.'],
  ['devon_ok', 'Devon Okafor', 'ember', 'Gifts you his worst card with a smile.'],
  ['mirabel', 'Mirabel Santos', 'moss', ''],
  ['kabir_l', 'Kabir Lalwani', 'sol', 'Third year CSE. Thinks prisms are overrated, plays them anyway.'],
  ['yuki_t', 'Yuki Tanabe', 'tide', 'Slow Tide host. Take your time.'],
  ['farah_q', 'Farah Qureshi', 'ember', 'Undefeated on Tuesdays (sample size: 2).'],
  ['lev_o', 'Lev Ostrovsky', 'moss', 'Here for the eddies.'],
  ['anais_p', 'Anaïs Pellerin', 'sol', 'Saffron Sundays regular.'],
  ['sid_b', 'Siddharth Bhonsle', 'ember', ''],
  ['priya_nk', 'Priya Nandakumar', 'sol', 'Keeps a spreadsheet of every spill she has ever made.'],
];

const TABLES = [
  ['Monsoon Room', 'arjun_m', { seats: 4, turnSeconds: 25 }],
  ['Night Shift Spills', 'ishita_r', { seats: 3, turnSeconds: 15 }],
  ['Lab 4 Lunch Break', 'demo', { seats: 4, turnSeconds: 30, visibility: 'private' }],
  ['Slow Tide', 'yuki_t', { seats: 4, turnSeconds: 60 }],
  ['Saffron Sundays', 'anais_p', { seats: 4, turnSeconds: 25 }],
  ['No Gifts Allowed', 'kabir_l', { seats: 3, turnSeconds: 20, rules: { surgeStack: true, gift: false } }],
  ['Stackless Sprint', 'farah_q', { seats: 4, turnSeconds: 12, rules: { surgeStack: false, gift: true } }],
];

const BOTS = ['Bot Wren', 'Bot Halyard', 'Bot Tamsin', 'Bot Oriel'];

function rngFrom(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function simulate(players, rules, weights, rng) {
  const g = engine.newGame(players, rules, rng);
  const history = [];
  while (g.winner === null) {
    const i = g.turn;
    const pick = chooseMove(g, i, weights, rng);
    history.push({ player: i, f: pick.f });
    if (pick.move.draw) {
      const r = engine.draw(g, i);
      if (!r.ended) engine.pass(g, i);
    } else engine.play(g, i, pick.move);
  }
  return { g, history };
}

export async function seed({ quiet = false } = {}) {
  const say = (...a) => !quiet && console.log('[seed]', ...a);
  const rng = rngFrom(20261028);
  await Promise.all([User.deleteMany({}), Table.deleteMany({}), Match.deleteMany({}), BotBrain.deleteMany({})]);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const created = Date.now() - 52 * 864e5;
  const users = await User.insertMany(PEOPLE.map(([username, displayName, favoriteSuit, bio], i) => ({
    username, displayName, favoriteSuit, bio, email: `${username}@spillway.test`, passwordHash: hash,
    createdAt: new Date(created + i * 2.7 * 864e5),
  })));
  const byName = Object.fromEntries(users.map((u) => [u.username, u]));
  say(`${users.length} players`);

  const tables = await Table.insertMany(TABLES.map(([name, owner, opts]) => ({ name, owner: byName[owner]._id, ...opts })));
  say(`${tables.length} tables`);

  // Warm-up: the bot plays itself so the brain starts with some experience.
  let weights = { ...DEFAULT_WEIGHTS };
  const snapshots = [];
  let trained = 0;
  let botWins = 0;
  for (let k = 0; k < 160; k++) {
    const { g, history } = simulate(BOTS.slice(0, 3 + (k % 2)).map((name) => ({ name, isBot: true })), {}, weights, rng);
    weights = train(weights, history, g.winner);
    trained++;
    if (k % 8 === 0) snapshots.push({ n: trained, ...weights });
  }

  // Recorded history: 140 matches between seeded players (and the odd bot) over ~6 weeks.
  const matches = [];
  // ~140 matches spread over the last six weeks, the newest a couple of hours ago.
  let clock = Date.now() - 42 * 864e5;
  const ratingOf = (p) => (p.isBot ? 1300 : p.user.rating);
  for (let k = 0; k < 140; k++) {
    clock = Math.min(clock + (0.08 + rng() * 0.44) * 864e5, Date.now() - (140 - k) * 25 * 60000);
    const table = tables[Math.floor(rng() * tables.length)];
    const size = table.seats === 3 ? 3 : 3 + Math.floor(rng() * 2);
    const pool = [...users].sort(() => rng() - 0.5);
    const seats = [];
    for (let s = 0; s < size; s++) {
      if (s > 0 && rng() < 0.22) seats.push({ name: BOTS[s % BOTS.length], isBot: true });
      else seats.push({ user: pool.pop(), isBot: false });
    }
    // Hosts sit at their own table about half the time.
    const host = users.find((u) => u._id.equals(table.owner));
    if (rng() < 0.5 && !seats.some((s) => s.user === host)) seats[0] = { user: host, isBot: false };
    const players = seats.map((s) => ({ name: s.isBot ? s.name : s.user.displayName, isBot: s.isBot }));
    const { g, history } = simulate(players, table.rules, weights, rng);
    weights = train(weights, history, g.winner);
    trained++;
    if (seats[g.winner].isBot) botWins++;
    if (trained % 8 === 0) snapshots.push({ n: trained, ...weights });

    const pts = engine.scores(g);
    const ratings = seats.map(ratingOf);
    const deltas = ratings.map((ri, i) => Math.round(ratings.reduce((d, rj, j) => {
      if (i === j) return d;
      const score = i === g.winner ? 1 : j === g.winner ? 0 : 0.5;
      return d + (32 / (ratings.length - 1)) * (score - 1 / (1 + 10 ** ((rj - ri) / 400)));
    }, 0)));
    seats.forEach((s, i) => {
      if (s.isBot) return;
      const u = s.user;
      u.rating += deltas[i];
      u.ratingHistory.push(u.rating);
      u.stats.played += 1;
      if (i === g.winner) u.stats.won += 1;
      u.stats.points += pts[i];
      if (g.longestSpill.by === i) u.stats.longestSpill = Math.max(u.stats.longestSpill, g.longestSpill.length);
    });
    table.matchesPlayed += 1;
    const turns = g.turnCount;
    matches.push({
      table: table._id,
      tableName: table.name,
      players: seats.map((s, i) => ({
        user: s.isBot ? null : s.user._id, name: players[i].name, isBot: s.isBot,
        cardsLeft: g.players[i].hand.length, points: pts[i], ratingDelta: s.isBot ? 0 : deltas[i],
      })),
      winnerName: players[g.winner].name,
      winnerUser: seats[g.winner].isBot ? null : seats[g.winner].user._id,
      turns,
      longestSpill: g.longestSpill.length,
      durationMs: Math.round(turns * (3800 + rng() * 5200)),
      createdAt: new Date(clock),
      updatedAt: new Date(clock),
    });
  }
  await Match.collection.insertMany(matches);
  await Promise.all([...users.map((u) => u.save()), ...tables.map((t) => t.save())]);
  await BotBrain.create({ key: 'main', weights, matchesTrained: trained, botWins, history: snapshots.slice(-80) });
  say(`${matches.length} matches, bot trained on ${trained}`);
  say(`demo login: demo / ${DEMO_PASSWORD}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(); } catch { /* no .env */ }
  const { connect, disconnect } = await import('./db.js');
  await connect();
  await seed();
  await disconnect();
  await mongoose.disconnect().catch(() => {});
}
