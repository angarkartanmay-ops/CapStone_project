# How Spillway works

This is the complete guide to the game: the cards, every rule, what happens in the edge cases, how scoring and ratings work, and how the house bots learn. Everything here matches what the server actually enforces (`server/game/engine.js`). If this file and the code ever disagree, the code wins and this file needs fixing.

- [The idea in one minute](#the-idea-in-one-minute)
- [The deck](#the-deck)
- [Setting up a match](#setting-up-a-match)
- [Your turn](#your-turn)
- [Matching: what can you play?](#matching-what-can-you-play)
- [Spills](#spills)
- [Action cards](#action-cards)
- [Drawing](#drawing)
- [Winning and scoring](#winning-and-scoring)
- [Ratings](#ratings)
- [House rules](#house-rules)
- [The turn clock, leaving and reconnecting](#the-turn-clock-leaving-and-reconnecting)
- [Tables, hosts and spectators](#tables-hosts-and-spectators)
- [The house bots and how they learn](#the-house-bots-and-how-they-learn)
- [Controls](#controls)
- [Edge cases and FAQ](#edge-cases-and-faq)

---

## The idea in one minute

Three or four players each get seven cards. On your turn you put a card on the pile that matches the top card, by **suit** or by **number**. The first player with an empty hand wins.

Spillway's own rule is the **spill**. After you play a number, you can keep going with more numbers **of the same suit**, as long as each one is exactly one step up (or each one step down) from the last. With Tide 4, 5, 6 and 7 in your hand, you can play all four in one turn. A spill of three or more cards also **splashes** the next player, who has to draw a card.

---

## The deck

100 cards in four suits. Each suit has its own colour **and** its own mark, so the cards stay readable for colour-blind players.

| Suit | Colour | Mark |
| --- | --- | --- |
| Ember | red | triangle |
| Tide | blue | two waves |
| Moss | green | leaf |
| Sol | gold | disc |

| Card | Per suit | Total | Points if left in hand |
| --- | --- | --- | --- |
| Numbers 1–9 | two of each number | 72 | face value (1–9) |
| Surge | 2 | 8 | 10 |
| Eddy | 2 | 8 | 10 |
| Gift | 2 | 8 | 10 |
| Prism (wild, no suit) | – | 4 | 20 |
| **Total** | | **100** | |

With gifts switched off (a [house rule](#house-rules)), the eight gift cards are taken out and the deck has 92 cards.

---

## Setting up a match

1. Everyone at the table is dealt **7 cards**.
2. The top card of the deck is turned face up to start the discard pile. It's always a **number**: any action card or prism turned up is tucked back under the deck until a number shows.
3. That card's suit becomes the **active suit**.
4. A **random player** goes first. Play then moves around the table (the on-screen arrow shows the direction).

---

## Your turn

On your turn you do exactly one of these:

- **Play** one card, or a [spill](#spills) of several, that fits the table.
- **Draw** one card. If the card you drew fits, you may play it straight away. Otherwise your turn ends. (You may also keep a playable drawn card and **pass**.)

If a [surge](#surge) is aimed at you, the choice is different: answer with a surge, or take the cards.

The game marks the cards you're allowed to play: they sit a little higher in your hand, and on your turn the others are dimmed.

---

## Matching: what can you play?

The table always has a **top card** and an **active suit**. Usually the active suit is just the top card's suit; after a prism it's the suit the prism player named.

| You want to play… | It's legal when… |
| --- | --- |
| A **number** | its suit is the active suit, **or** the top card is a number with the same value |
| A **surge, eddy or gift** | its suit is the active suit, **or** the top card is the same kind of action (surge on surge, eddy on eddy, gift on gift) |
| A **prism** | always, except while a surge is waiting to be paid |

Examples, with **Ember 4** on top:

```
Ember 9   ✔  same suit
Tide 4    ✔  same number
Moss 5    ✘  different suit, different number
Ember gift ✔ same suit
Tide surge ✘ different suit, and the top card isn't a surge
Prism     ✔  plays on anything
```

After an action card or a prism is on top, numbers can only match by **suit**: there is no number on top to match.

---

## Spills

A spill is several number cards played in one turn.

1. The **first card** has to be a legal play by itself (see [matching](#matching-what-can-you-play)).
2. Every following card must be a number of the **same suit as that first card**.
3. Each card must be **exactly one higher** than the one before, or each **exactly one lower**. You choose the direction with the second card and can't change it partway.
4. There is **no wrapping**: 9 is not followed by 1.
5. Only numbers can be in a spill. Actions and prisms are always played on their own.

```
Top: Ember 4

Tide 4 → Tide 5 → Tide 6 → Tide 7      ✔ starts on the matching 4, climbs in Tide
Ember 6 → Ember 5 → Ember 4 → Ember 3   ✔ starts by suit, falls
Ember 5 → Ember 7                       ✘ skips a step
Tide 4 → Tide 5 → Moss 6                ✘ changes suit
Ember 3 → Ember 4 → Ember 3             ✘ changes direction
Ember 9 → Ember 1                       ✘ no wrapping
```

### Splash

If your spill is **three or more cards**, the next player immediately draws **one card** before their turn starts. A two-card spill is allowed but doesn't splash.

If the spill empties your hand, you've won and nobody is splashed.

The longest spill of every match is recorded and shows up on profiles and the home page.

---

## Action cards

### Surge

The next player draws **two** and loses their turn.

- **Stacking:** if they hold a surge of any suit, they can play it instead. The penalty grows to **four** and passes to the player after them, then six, and so on. The first player who can't (or won't) answer takes the whole pile of penalty cards and their turn ends.
- While a surge is waiting, nothing else can be played. **A prism does not dodge a surge.**
- Hosts can switch stacking off. Then a surge always means "draw two" with no answer.

### Eddy

Reverses the direction of play. The player who just went is suddenly next.

### Gift

You pick one of your **other** cards and hand it to the **next player**, who must take it. Use it to dump an awkward card on someone close to winning.

- If the gift is your **last card**, you simply win; nothing is handed over.
- Gifts can be switched off by the host. That removes them from the deck entirely.

### Prism

The wild card. Play it on anything (except a waiting surge) and **name the suit** that the next player has to follow. A prism can't be part of a spill.

---

## Drawing

- You may draw even if you could play. Sometimes holding a card back is the better move.
- After drawing, the **only** card you may play this turn is the one you just drew, and only by itself (you can't start a spill with it).
- If the drawn card doesn't fit, your turn ends automatically.
- When the draw pile runs out, the discard pile (all but its top card) is shuffled to make a new one.

---

## Winning and scoring

The first player to **empty their hand wins** the match.

The winner scores the value of every card still in the other players' hands: numbers count their face value, surge/eddy/gift 10 each, prisms 20 each. Points add up on your profile.

> Example: Wren is left holding Moss 3, Sol 8 and a prism (3 + 8 + 20 = 31). Halyard holds Tide 6 and an eddy (6 + 10 = 16). The winner scores **47 points**.

**Safety limit:** if a match somehow reaches 500 turns without a winner (it practically never happens), the player holding the fewest cards wins.

---

## Ratings

Every account starts at **1200**. After each match, ratings change using the **Elo** system:

- Each match is treated as a set of one-on-one results: the winner "beat" every other player, and the losers count as a **draw** with each other.
- For every pair, you gain or lose according to how surprising the result was. Beating stronger players earns more; losing to weaker players costs more.
- The total swing is **K = 32**, shared across your opponents.
- House bots count as **1300** and their rating never changes.

> Example: you're rated 1231 and beat two bots (1300 each). Against each bot, Elo expected you to win about 40% of the time, so each win is worth 16 × (1 − 0.40) ≈ 9.6. You gain **+19**.

Your profile shows your rating, your rank (among players with at least one match), and a chart of your last 30 ratings.

---

## House rules

Each table's host chooses:

| Setting | Options | Effect |
| --- | --- | --- |
| Seats | 3 or 4 | how many players the match needs |
| Turn clock | 10–60 seconds | how long each person gets per turn |
| Fill empty seats with bots | on / off | bots take any empty seat when the host deals |
| Surges stack | on / off | whether a surge can be answered with a surge |
| Gift cards in play | on / off | off removes the 8 gifts from the deck |
| Visibility | public / code only | private tables don't appear in the lobby; join with the six-character code |

Settings can be changed between matches, never during one.

---

## The turn clock, leaving and reconnecting

- **Clock runs out:** the server draws a card for you. If a surge was waiting, you take it. If the drawn card fits, you keep it and the turn passes. The ring next to your name shows the time left.
- **Refresh or lose connection:** your seat is held for **8 seconds**, so a quick refresh changes nothing.
- **Gone longer during a match:** you're marked *away* and a bot plays your hand for you until you come back. When you return you take over again, including the rest of your current turn.
- **Gone between matches:** your seat is freed for someone else.
- **Every person leaves mid-match:** the match is abandoned, nothing is recorded, and the table opens again.

---

## Tables, hosts and spectators

- Anyone signed in can **open a table** (up to five each) and is its **host**.
- The host presses **Deal**. If the host isn't sitting at their table, any seated player can deal.
- A match needs **3 players**. With bot fill on, bots (Wren, Halyard, Tamsin, Oriel, …) fill the gaps. With it off, you need enough people.
- If a table is full of bots between matches, a person arriving takes over a bot's seat.
- Arriving **during** a match makes you a **spectator**: you see the table and everyone's card counts, but no one's cards.
- Only the host can edit or close a table, and only while no match is running. When a table is closed, everyone at it sees a notice with a link back to the lobby. Past matches stay in everyone's history.

---

## The house bots and how they learn

Bots don't cheat. They see exactly what a player in their seat would see.

On each turn a bot lists **every legal move** (every playable card, every spill it could make, drawing) and scores each one with seven traits:

| Trait | Meaning |
| --- | --- |
| Shed cards fast | how many cards the move gets rid of |
| Play actions | the move plays a surge, eddy or gift |
| Spend a prism | the move uses the wild |
| Keep a prism back | the bot still holds a prism afterwards |
| Punish a short hand | a surge or gift aimed at a player with 3 or fewer cards |
| Stay in my suit | how much of the remaining hand matches the suit left on the table |
| Draw instead | drawing rather than playing |

Score = Σ (weight × trait). The bot plays the highest-scoring move, and 6% of the time tries a different one so it keeps exploring.

**Learning:** every move in a match, by people *and* bots, is remembered. When the match ends, each weight is nudged toward the traits of the **winner's** moves and slightly away from the losers':

```
weight += 0.005 × (+1 for the winner, −1 ÷ number of losers otherwise) × (trait − 0.5)
```

Weights are kept between −3 and +3 and saved in MongoDB, so the bots carry what they've learned across restarts. The home page shows the live weights, how they've moved over recent matches, and which trait has shifted most since training began.

---

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Select a card | click it | Tab to it, then Enter or Space |
| Add the next card of a spill | click it (it lights up when it fits) | Tab + Enter |
| Shorten a spill | click a selected card: it and every card after it are removed | |
| Clear the selection | click the first selected card, or **Clear** | **Esc** |
| Play the selection | **Play** / **Spill n** | **Enter** |
| Play one card instantly | double-click it | |
| Draw / take a surge | **Draw**, or the draw pile | **D** |
| Pass after drawing | **Pass** | **P** |

Playing a **prism** opens a suit picker. Playing a **gift** asks you to click the card you want to hand over.

**How to play** in the top bar opens a short rules card, and **Log** shows the last few moves. The sun/moon button anywhere on the site switches between light and dark themes. Your choice is remembered; until you pick one, the site follows your device's setting.

---

## Edge cases and FAQ

**Can a spill start with a card that matches by number and then continue in that card's suit?**
Yes. That's the classic move: Ember 4 on top, play Tide 4 (same number), then Tide 5, 6, 7.

**Can I spill with the card I just drew?**
No. After drawing, only that single card may be played.

**What if my last card is a surge?**
You win the moment your hand is empty; the surge doesn't matter any more.

**Does a spill of 3+ that ends the game splash anyone?**
No. The match ends before the splash.

**Does a prism stop a surge?**
No. Only another surge can answer a surge, and only if stacking is on.

**What can follow a prism?**
A card of the suit that was named, or another prism.

**What can follow an action card such as a Tide surge (once it's resolved)?**
Any Tide card, another surge of any suit, or a prism.

**Can I see other players' cards?**
No. The server only ever sends you your own hand and everyone's card *count*. The client can't cheat because it never has the information.

**Who decides whether a move is legal, the page or the server?**
The server. The page highlights legal cards to help you, but every move is checked again on the server, and an illegal one is rejected with a message.
