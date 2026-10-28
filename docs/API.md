# REST API and socket events

Base URL: `/api`. All request and response bodies are JSON. Writes (`POST`, `PATCH`, `DELETE`) **must** send `Content-Type: application/json`, otherwise the server answers `415`.

Authentication is a JWT in an `httpOnly` cookie named `sw_token`, set by register and login.

### Error format

```json
{ "error": "Some fields need attention", "fields": { "name": "The table name needs at least 3 characters" } }
```

| Status | Meaning |
| --- | --- |
| 400 | Body is not valid JSON |
| 401 | Not signed in, or wrong password |
| 403 | Signed in, but not allowed (e.g. editing someone else's table) |
| 404 | Not found |
| 409 | Conflict: username taken, table busy, host limit reached |
| 415 | Write without a JSON content type |
| 422 | Validation failed, see `fields` |
| 429 | Too many auth attempts |

## Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | `username, email, password, displayName` | `201 { user }`, sets cookie |
| POST | `/auth/login` | `login` (username or email), `password` | `{ user }`, sets cookie |
| POST | `/auth/logout` | `{}` | `{ ok: true }`, clears cookie |
| GET | `/auth/me` | | `{ user }` or `{ user: null }` |

## Tables: full CRUD

| Method | Path | Auth | Body / query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/tables` | optional | `?q=` name search, `?mine=1` | `{ tables: [...] }` public tables plus your own, with live `seated`, `humans`, `live` |
| GET | `/tables/:id` | optional | | `{ table }` |
| GET | `/tables/code/:code` | required | | `{ table }` find a private table by invite code |
| POST | `/tables` | required | `name`, `seats` (3/4), `turnSeconds` (10–60), `botFill`, `surgeStack`, `gift`, `visibility` | `201 { table }` |
| PATCH | `/tables/:id` | owner | any subset of the POST fields | `{ table }`. `409` while a match runs |
| DELETE | `/tables/:id` | owner | | `{ ok: true }`. Seated players get `table:closed` |

## Players

| Method | Path | Auth | Returns |
| --- | --- | --- | --- |
| GET | `/users/:username` | optional | `{ user, rank, matches, isYou }` |
| PATCH | `/users/me` | required | body: `displayName`, `bio`, `favoriteSuit` → `{ user }` |
| DELETE | `/users/me` | required | body: `password` → `{ ok: true }` |
| GET | `/leaderboard?limit=20` | | `{ players }` sorted by rating (players with at least one match) |
| GET | `/matches?limit=12` | | `{ matches }` most recent first |
| GET | `/bot` | | `{ features, weights, matchesTrained, botWins, history }` |
| GET | `/stats` | | `{ players, matches, tables, online, longestSpill }` |

## Socket.IO events

The connection is authenticated with the same cookie. Without it the handshake is refused (`unauthorized`).

### Client → server

| Event | Payload | Ack |
| --- | --- | --- |
| `lobby:watch` | | joins the lobby feed |
| `table:join` | `{ tableId }` | `{ ok, seat }` (seat `-1` = watching) or `{ error }` |
| `table:leave` | | |
| `game:start` | | host (or anyone, if the host isn't seated) deals |
| `game:play` | `{ cards: [ids], suit?, giftId? }` | `{ ok }` or `{ error }` |
| `game:draw` | | draw one, or take the pending surge |
| `game:pass` | | after drawing a playable card you keep |

### Server → client

| Event | Payload |
| --- | --- |
| `table:state` | table settings, seats, `you` (seat index), turn `deadline`, `results`, last `event`, and `game`: **your** hand, which cards are playable, every player's card *count*, the top cards, active suit, direction, pending draw, log |
| `table:closed` | `{ message }` when the host deletes the table |
| `lobby:update` | `{ tableId, seated, humans, live }` |
