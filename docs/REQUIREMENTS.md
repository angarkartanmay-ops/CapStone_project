# Spillway — Requirements

## 1. Problem and goal

Card games are better with friends, but getting three or four people around a physical table is hard. Spillway lets a small group (or one person and the house bots) play a quick rated card game in the browser, with no installs.

**Goal for the 3-day build:** a working full-stack web app where players register, open or join tables, play real-time matches against people and bots, and track their rating and history.

## 2. Users

| Persona | Needs |
| --- | --- |
| **Casual player** (e.g. a student on a lunch break) | Sit down fast, learn the rules in a minute, play against bots when friends are busy |
| **Host** | Set up a table for a group, choose house rules, share a private code |
| **Competitive player** | Rating, rank, match history, proof of improvement |
| **Spectator** | Watch a match already in progress at a full table |

## 3. User stories

Priority: **M** = must have (done), **S** = should have (done), **C** = could have (later).

### Accounts
| # | Story | Priority |
| --- | --- | --- |
| U1 | As a visitor, I want to create an account with a username, email, display name and password so I can keep my rating. | M |
| U2 | As a player, I want to sign in with my username *or* email so I don't have to remember which one I used. | M |
| U3 | As a player, I want to sign out so nobody else can use my seat on a shared lab computer. | M |
| U4 | As a player, I want clear messages under each field when something is wrong, so I know exactly what to fix. | M |
| U5 | As a player, I want to edit my display name, bio and favourite suit. | S |
| U6 | As a player, I want to delete my account and data, confirmed with my password. | S |
| U7 | As a player, I want a dark theme that follows my device setting and remembers my choice, so late-night games are easy on the eyes. | S |

### Tables (the CRUD collection)
| # | Story | Priority |
| --- | --- | --- |
| T1 | As a host, I want to **create** a table with a name, 3 or 4 seats, a turn clock, bot fill and house rules. | M |
| T2 | As a player, I want to **browse and search** open tables and see how many seats are taken, live. | M |
| T3 | As a host, I want to **edit** my table's settings between matches. | M |
| T4 | As a host, I want to **close (delete)** a table I no longer need. | M |
| T5 | As a host, I want a private table that only people with a six-character code can join. | S |
| T6 | As a player, I want to join a table from an invite code. | S |

### Playing
| # | Story | Priority |
| --- | --- | --- |
| P1 | As a player, I want to see my own hand and only the *number* of cards others hold. | M |
| P2 | As a player, I want the game to show me which cards I can play right now. | M |
| P3 | As a player, I want to select a run of cards in one suit and play them in one turn (a spill). | M |
| P4 | As a player, I want empty seats filled by bots so I can always play. | M |
| P5 | As a player, I want a turn clock so nobody can stall the table. | M |
| P6 | As a player, I want to refresh or briefly lose connection without losing my seat. | S |
| P7 | As a player, I want to watch a match when the table is full. | S |
| P8 | As a player, I want keyboard shortcuts (Enter to play, D to draw). | S |
| P9 | As a player, I want in-table chat. | C |

### Progress and data
| # | Story | Priority |
| --- | --- | --- |
| D1 | As a competitive player, I want an Elo rating that changes after every match. | M |
| D2 | As a player, I want a leaderboard and my rank. | M |
| D3 | As a player, I want my match history and a rating chart on my profile. | M |
| D4 | As anyone, I want to see that the bots improve from past games. | S |

## 4. Acceptance criteria (selected)

- **T1:** a table name shorter than 3 or longer than 40 characters is rejected on the client *and* the server with the message "The table name needs at least 3 characters" (or "at most 40"). A host can own at most 5 tables.
- **T3/T4:** only the owner may edit or delete a table (others get `403`). Nobody can edit or delete a table while a match is running (`409`).
- **P2:** cards that can't be played are dimmed on your turn. Clicking one shakes it and does nothing.
- **P3:** the server re-checks every spill. A run that skips a number or switches suit is rejected with "A spill must be one suit, climbing or falling by exactly one".
- **P5:** when the clock runs out, the server draws for the player and passes the turn.
- **P6:** a disconnected player keeps their seat for 8 seconds before giving it up. In a running match, a bot plays their hand until they come back.

## 5. Wireframes

Low-fidelity layouts that the built pages follow.

### Landing (`/`)
```
+--------------------------------------------------------------------------+
| SPILLWAY            Lobby  Rules  Leaderboard          [Sign in][Create] |
+--------------------------------------------------------------------------+
| A card game for three or four / live tables / bots that learn            |
|                                                                          |
| PLAY IT                                        .--.--.--.                |
| IN RUNS.                                      / 3D fan of \              |
| Empty your hand first.                        \  7 cards  /              |
| [Take a seat ->]  [Read the rules]             '--'--'--'                |
|--------------------------------------------------------------------------|
| MATCHES 140 | PLAYERS 14 | LONGEST SPILL 6 | ONLINE 2                    |
+--------------------------------------------------------------------------+
| (pinned while scrolling)                                                 |
| 01 MATCH THE TABLE.          [E4] <- [T4][T5][T6][T7] fly from the hand  |
| 02 KEEP CLIMBING.                                                        |
| 03 SPLASH.                   ---- progress bar ----                      |
+--------------------------------------------------------------------------+
| [card]  SURGE  The next player draws two...                              |
|          EDDY  The table turns around...                         [card]  |
| [card]  GIFT   Hand your worst card...                                   |
+--------------------------------------------------------------------------+
| THE TABLE LEARNS.     | Shed cards fast   |----####      | +1.24 ~~~    |
| (live bot weights)    | Draw instead  ####|              | -1.51 ~~~    |
+--------------------------------------------------------------------------+
| STANDINGS (top 6)                         | JUST FINISHED (feed)         |
+--------------------------------------------------------------------------+
| DEAL ME IN.                                        [Open the lobby ->]   |
+--------------------------------------------------------------------------+
```

### Sign in / create account (`/auth`)
```
+------------------------------+-------------------------------------------+
| SPILLWAY                     |  Sign in | Create account                 |
|                              |  WELCOME BACK.                            |
|      fanned cards            |  [ error banner                       ]   |
|                              |  Username or email  [_______________]     |
|  "Tide 4, 5, 6, 7.           |  Password           [_______________]     |
|   Sorry, Arjun..."           |  [Sign in ->]                             |
|                              |  Demo: demo / deal-me-in-7  [Fill it in]  |
+------------------------------+-------------------------------------------+
```

### Lobby (`/lobby`)
```
+--------------------------------------------------------------------------+
| Wednesday 28 October                  RATING | RANK | PLAYED | WIN RATE  |
| EVENING, RHEA.                         1287  |  #3  |   41   |  34.1%    |
+==========================================================================+
| TABLES   [All|Open seats|Mine]  [search____]  [New table] | LEADERBOARD |
| Have an invite code? [______] [Join]                      | 1 AM Arjun  |
|-----------------------------------------------------------| 2 NV Noor   |
| Monsoon Room       [#][#][ ][ ]  25s Bots Stack  Open  [Sit down]| ... |
|   hosted by Arjun                                         |             |
| Lab 4 Lunch Break  [ ][ ][ ][ ]  Code 7F2A9C  [edit][del][Sit down]|   |
| ...                                                       | RECENT      |
+-----------------------------------------------------------+-------------+

New/Edit table (modal)
+----------------------------------+
| NEW TABLE                 Close |
| Table name [________________]   |
| Seats [3|4]   Visibility [Pub|Code]
| Turn clock  25s  ----o-------   |
| Fill empty seats with bots  (o) |
| Surges stack                (o) |
| Gift cards in play          (o) |
|            [Cancel] [Create]    |
+----------------------------------+
```

### Game table (`/play?t=<id>`)
```
+--------------------------------------------------------------------------+
| <- Lobby   MONSOON ROOM  [7F2A9C]                       How to play | Log |
+--------------------------------------------------------------------------+
|                         (Bot Wren) [backs x5] 5                          |
|  (Noor) [backs x7] 7      ...thinking                (Bot Oriel) 3       |
|                                                                          |
|                 [ draw pile ]      [ discard: T7 ]                       |
|                     62            (suit) (dir) (+2)                      |
|--------------------------------------------------------------------------|
| (RC) Rhea  (clock)   Your turn. Match Tide or any 7.  [Clear][Draw][Play]|
|        [T4] [T5^] [M9] [E-surge] [prism] [S2] [T6^]                      |
+--------------------------------------------------------------------------+
   ^ = playable (lifted); selected cards rise further and show 1, 2, 3
```

### Profile (`/profile?u=<username>`)
```
+--------------------------------------------------------------------------+
| (RC)  @demo · joined September 2026                         [Tide]       |
|       RHEA CASTELLAN                                                     |
|       Plays every lunch break in Lab 4...                                |
|--------------------------------------------------------------------------|
| RATING 1287 | RANK #3 | PLAYED 41 | WON 14 34.1% | SPILL 5 | POINTS 612  |
|--------------------------------------------------------------------------|
| Rating chart (SVG line)          | Match history                         |
|   /\    /\_/\                    | WON  Monsoon Room  vs ...   +14       |
|  /  \__/     \__.                | 3rd  Slow Tide     vs ...   -9        |
|--------------------------------------------------------------------------|
| Edit profile: name, bio (n/160), favourite suit   [Save] [Delete acct.]  |
+--------------------------------------------------------------------------+
```

## 6. Non-functional requirements

- **Responsive** down to 360 px wide. **Accessible**: keyboard play, visible focus, labelled controls, reduced-motion support.
- **Secure**: hashed passwords, httpOnly cookie sessions, server-side validation, CSRF guard, strict CSP.
- **Fair**: the server is the only judge of legal moves and never sends a player another player's hand.
- **Runs anywhere**: `npm install && npm start` works without a database installed.

## 7. Out of scope (for now)

Chat, friends lists, tournaments, mobile apps, and running more than one server process.
