# Database design

MongoDB, accessed with Mongoose. Four collections. Schemas live in [`server/models.js`](../server/models.js).

```
 users 1 ──── * tables          (a user hosts up to 5 tables)
 users * ──── * matches         (via matches.players[].user)
 tables 1 ─── * matches         (matches.table)
 botbrains: a single document ("main") holding the learned weights
```

Live seat assignments and the running game are kept **in server memory** (`server/game/rooms.js`), not in MongoDB. They change several times a second and don't need to survive a restart. A match is written to the database once, when it ends.

## users

| Field | Type | Rules |
| --- | --- | --- |
| `_id` | ObjectId | |
| `username` | String | required, unique, lowercase, 3–20 chars, `[a-z0-9_]` |
| `email` | String | required, unique, lowercase |
| `passwordHash` | String | bcrypt, cost 10. Never sent to clients |
| `displayName` | String | required, 2–32 chars |
| `bio` | String | up to 160 chars |
| `favoriteSuit` | String | `ember` \| `tide` \| `moss` \| `sol` |
| `rating` | Number | Elo, starts at 1200 |
| `ratingHistory` | [Number] | last 60 ratings, for the profile chart |
| `stats.played / won / points / longestSpill` | Number | updated after each match |
| `createdAt`, `updatedAt` | Date | timestamps |

Indexes: unique `username`, unique `email`.

## tables (full CRUD)

| Field | Type | Rules |
| --- | --- | --- |
| `name` | String | required, 3–40 chars |
| `owner` | ObjectId → users | required |
| `seats` | Number | 3 or 4 |
| `turnSeconds` | Number | 10–60 |
| `botFill` | Boolean | fill empty seats with bots when dealing |
| `rules.surgeStack` | Boolean | a surge may answer a surge |
| `rules.gift` | Boolean | gift cards in the deck (off = 92-card deck) |
| `visibility` | String | `public` \| `private` (code only) |
| `code` | String | unique six-character hex invite code |
| `status` | String | `open` \| `playing` (edits and deletes are blocked while playing) |
| `matchesPlayed` | Number | counter |

## matches

| Field | Type | Notes |
| --- | --- | --- |
| `table` | ObjectId → tables | may point to a deleted table, so `tableName` is copied in |
| `tableName` | String | |
| `players[]` | `{ user, name, isBot, cardsLeft, points, ratingDelta }` | `user` is null for bots and for deleted accounts |
| `winnerName`, `winnerUser` | String, ObjectId | |
| `turns`, `longestSpill`, `durationMs` | Number | |
| `createdAt` | Date | |

Index: `{ 'players.user': 1, createdAt: -1 }` for profile history.

## botbrains

| Field | Type | Notes |
| --- | --- | --- |
| `key` | String | always `main` |
| `weights` | Object | one number per feature: `shed, action, prism, holdPrism, pressure, suitStay, draw` |
| `matchesTrained` | Number | |
| `botWins` | Number | |
| `history` | [Object] | weight snapshots (last 80) for the sparklines on the home page |

### How the bot learns

For every move made in a match (by bots *and* people), the server records a feature vector, for example "this move sheds 3 cards and keeps a prism back". When the match ends, each weight moves toward the features of the winner's moves and slightly away from the losers' moves:

```
w[k] += 0.005 * (+1 for winner, -1/(losers) for others) * (feature[k] - 0.5)
```

Weights are clamped to ±3. Bots score each legal move as `Σ w[k]·feature[k]` and play the best one, with a 6% chance to explore a different move.

## Deleting an account

A deleted user's tables are removed and their live rooms closed. In past matches, `players[].user` is set to `null` but the name is kept, so other players' history stays correct.
