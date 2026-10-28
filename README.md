# Spillway

A real-time multiplayer card game for three or four players, built as the capstone **Gaming App** (project 4 in the list).

Spillway is a shedding game: everyone gets seven cards and the first to empty their hand wins. Its own rule is the **spill**: after you play a number, you can keep laying down more of the same suit as long as each card steps up or down by one (Tide 4, 5, 6, 7). A spill of three or more makes the next player draw a card. Four action cards (Surge, Eddy, Gift, Prism) change how a round goes.

House bots fill empty seats. They **learn from past games**: every finished match nudges their move-scoring weights toward what the winner did, and the live weights are shown on the home page.

| Requirement from the brief | Where it lives |
| --- | --- |
| Frontend in HTML, CSS and JavaScript | `public/` (plain ES modules, no build step) |
| Backend in Node.js + Express | `server/` |
| MongoDB database | `server/models.js` (Mongoose) |
| Requirements doc with user stories and wireframes | [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) |
| Database design and REST API list | [`docs/DATABASE.md`](docs/DATABASE.md), [`docs/API.md`](docs/API.md) |
| Login and logout; full CRUD on one collection | JWT cookie auth; **Tables** have create, read, update and delete (Users also have read, update and delete) |
| Validation and clear errors on frontend and backend | `public/js/forms.js` + `server/validate.js` (same limits, field-level messages) |
| WebSockets for real-time play | Socket.IO, `server/game/rooms.js` |
| Player data, leaderboards, learning from past games | Elo ratings, match history, `server/game/bot.js` |
| Graphics rendering | Three.js scene on the landing page (`public/js/hero3d.js`) |

## Run it

You need **Node.js 22 or newer**. MongoDB is optional: without one, the server starts an embedded MongoDB and stores its files in `./.data`.

```bash
npm install
npm start
```

Open <http://localhost:3000>. On first boot the empty database is filled with demo data: 14 players, 7 tables and 140 matches. These are real simulated games, so the ratings, stats and bot weights all agree with each other.

**Demo login:** `demo` / `deal-me-in-7`. Every seeded player uses the same password, e.g. `arjun_m`, so you can open a second browser (or a private window) and sit two people at one table.

> The first `npm install` / `npm start` downloads a MongoDB binary (~600 MB) for the embedded database. To skip that, point `MONGODB_URI` at your own MongoDB or Atlas cluster.

### Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONGODB_URI` | *(empty)* | Use this MongoDB instead of the embedded one |
| `JWT_SECRET` | dev value | Secret for signing session tokens. **Required** when `NODE_ENV=production` |
| `PORT` | `3000` | HTTP port |
| `AUTO_SEED` | `1` | Load demo data when the database is empty |

### Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start and restart on file changes |
| `npm run seed` | Wipe the database and reload the demo data (stop the server first when using the embedded DB) |
| `npm test` | Rules engine tests (including 1,000 simulated bot matches) and an end-to-end API + Socket.IO test against an in-memory database |

## How to play

1. Sign in, open the **Lobby**, and either sit down at a table or create one. You choose the seats, turn clock, bot fill and house rules.
2. The host presses **Deal**. Empty seats are filled by bots.
3. On your turn, click a card that matches the top card's suit or number. To spill, keep clicking cards of that suit one step up or down, then press **Play** (or Enter). Press **D** to draw.
4. When the match ends, ratings update and the bots train on the match.

Full rules are at `/rules` once the server is running.

## Project layout

```
server/
  index.js          Express app, security headers, static files, Socket.IO
  db.js             MongoDB connection (or the embedded fallback)
  models.js         User, Table, Match, BotBrain schemas
  auth.js           JWT session cookie, auth middleware
  validate.js       Field validation used by every write endpoint
  routes/           auth.js, tables.js (CRUD), players.js (profiles, leaderboard, stats)
  game/engine.js    Pure rules engine: deck, legal moves, spills, scoring
  game/bot.js       Bot move scoring and the learning step
  game/rooms.js     Live tables: seats, turn clock, bots, saving finished matches
  seed.js           Demo data from simulated matches
public/
  index.html        Landing page (Three.js hand of cards, GSAP scroll scenes)
  auth.html         Sign in / create account
  lobby.html        Tables (CRUD), leaderboard, recent matches
  play.html         The game table
  profile.html      Stats, rating chart, match history, edit or delete account
  rules.html        Complete rules
  js/, css/         Page scripts and styles
test/               node:test suites
docs/               Requirements, database design, API, viva notes
```

## Why this project

We scored the twelve options on uniqueness, how well they fit the required stack, how much the brief asks for real-time and data work, how naturally 3D fits, and whether a team can finish it in three days. The Gaming App came out ahead: almost no other team builds a real-time multiplayer game, it uses the mandatory stack directly, and the "learns from past games" line gives the backend real work to do. The brief describes a game "like UNO". To keep the project original we designed our own ruleset (spills, splash, gift, the four suits) instead of copying an existing game.

## Security notes

- Passwords are hashed with bcrypt. Sessions are an `httpOnly`, `SameSite=Lax` JWT cookie.
- All writes require `Content-Type: application/json`, which a cross-site form cannot send.
- Strict Content Security Policy: scripts load only from this origin.
- Login and register are rate-limited. Login errors don't reveal whether an account exists.
- Every field is validated on the server, and the client never sees other players' hands.
- The only third-party request is Google Fonts (CSS can't be pinned with SRI because Google tailors it per browser). The CSP allows only `fonts.googleapis.com` and `fonts.gstatic.com`.
