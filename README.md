# Five Totems

Browser version of the **Five Totems** card game: one human against a heuristic AI,
built to let people try the game before buying the physical edition.

- React + TypeScript + Vite, no backend, no database.
- Rules engine is framework-free and fully unit-tested (`src/engine`).
- Deploys to Railway as a static build served by a tiny zero-dependency Node server.

## Running locally

```bash
npm install
```

```bash
npm run dev
```

Other scripts: `npm test` (engine + AI tests, including hundreds of simulated games),
`npm run build` (typecheck + production build), `npm start` (serve `dist/` on `$PORT`, default 3000).

## Deploying to Railway

1. Push this repo to GitHub and create a Railway project from it.
2. Railway detects Node and uses `railway.json`:
   - build: `npm run build`
   - start: `npm start` (binds `0.0.0.0:$PORT`, health check on `/health`)
3. Generate a public domain under the service's *Networking* settings.

Optional: set `VITE_STORE_URL` (build-time variable) to show a "Get the physical game"
button on the end-of-game screen.

Build tooling (Vite, TypeScript) lives in `dependencies` on purpose, so the build
works even if the platform installs with `NODE_ENV=production`.

## Project structure

| Path | Responsibility |
|---|---|
| `src/engine/types.ts` | Game state, actions, pending decisions |
| `src/engine/rules.ts` | **All configurable / open rules** with defaults |
| `src/engine/cards.ts` | Card registry: name, colour, text, and the effect functions |
| `src/engine/engine.ts` | State machine: turns, plays, counter windows, effects, win checks |
| `src/engine/win.ts` | Five Colors / Five Copies validation |
| `src/engine/view.ts` | Per-player view (hides opponent hand and deck order) |
| `src/ai/ai.ts` | Heuristic AI, decides only from its player view |
| `src/ui/*` | React UI: board, cards, dialogs, log, rule variants |

The engine is a pure function `applyAction(state, player, action) → newState`. It clones
the state, validates the action against the single `pending` decision, and throws
`IllegalActionError` for anything illegal (wrong player, wrong phase, invalid target,
game over). Every test step checks that all 50 cards exist exactly once.

### Adding a new card

Add the type to `CardType` in `types.ts` and a definition in `CARD_DEFS` (`cards.ts`) with
`hasTarget`, `begin` (returns the choice the player must make, or `null`) and `resolve`
(applies the choice; may return a nested effect, as Repeat does). The UI picks up colour,
glyph and text from the definition. Teach the AI to value it in `effectValue`/`threatOf`.

## Rule interpretations

The design document lists open questions (section 12). Each is a switch in
`src/engine/rules.ts` and in the in-game **Rule variants** dialog. Defaults:

| Question | Default | Alternatives |
|---|---|---|
| 1. Cancel: arrange top 3 | Look at top 3 of the shared deck, free reorder, all stay on top | Allow sending any of them to the bottom; disallow reorder |
| 2. Repeat targeting Repeat | Not allowed | Allowed; each card activates at most once per chain (no infinite loops), depth cap 5 |
| 3. Countering a counter | Not allowed | Allowed, alternating; an odd number of counters cancels the play |
| 4. No valid target | Card may be played; it enters the table and the effect fizzles | Card can't be played without a target |
| 5. Empty deck | Draw is skipped; if no one can play, the game is a draw | Reshuffle both discard piles into a new deck; or the game ends in a draw |

Other interpretations the document doesn't spell out, also configurable:

- **When a played card enters the table:** before its effect resolves (so the card that
  completes your set wins at once). Option: after the effect.
- **A countered card** goes to its owner's discard pile.
- **"Either player's deck"** in Cancel's text is read as the single shared deck.
- **Turn limit:** 300 turns, then a draw (a safety valve; real games last ~15 turns).
- First player is random by default.

### Playtest variant: Yellow card — Repeat vs Draw 1

`rules.yellowEffect` switches the Yellow card between **Repeat** (default, per the design
document) and **Draw 1** (draw the top card of the shared deck; it fizzles on an empty deck,
or reshuffles discards first under that empty-deck rule). The card keeps its id `repeat`
internally. The variant is engine/AI only — the card face and Rule variants dialog still show Repeat.

`npm run sim -- sim/yellow-variant.sim.ts` compares the variants over 2,000 AI-vs-AI games each (three runs, ±~1.1 pp each):

| Variant | 1st-player wins | Avg turns (p90) | Five Colors wins | Five-Yellow wins | Yellow plays/game | Yellow on winner's table |
|---|---|---|---|---|---|---|
| Repeat | 47–50% | 16.9 (24) | 91% | 2–3% | 4.1 | 1.5 |
| Draw 1 | 52–54% | 16.5 (22) | 90% | ~1% | 3.1 | 1.2 |

Draw 1 never fizzles (Repeat ~2%) and is countered about as often (~10%). The main
effect is a ~4-point swing toward the first player, and Yellow becomes a weaker play
(the AI plays it a quarter less often). Neither variant produces draws.

### Playtest strategy: hoarding Cancels

`npm run sim -- sim/cancel-hoard.sim.ts` pits a "Hoarder" against the normal AI (2,000 games
per row, seats and first player alternated). The Hoarder never plays a Cancel from hand while
holding up to N of them, only counters plays that would win, and counters back when its own
winning play is countered. N = 0 is the control (same bot, no hoarding).

| Counter-the-counter | Cancels kept | Hoarder wins | Winning plays countered | …of those, countered back |
|---|---|---|---|---|
| Off (default) | 0 | 54% | 8% | — |
| Off | 2 | 40% | 5% | — |
| Off | 4 | 38% | 5% | — |
| On | 0 | 55% | 7% | 10% |
| On | 2 | 40% | 6% | 35% |
| On | 4 | 38% | 4% | 29% |

Against this AI, hoarding costs ~15 points of win rate: Cancels held in hand aren't building
the table, so games run ~20 turns instead of ~16. The insurance is small because a winning
play is only countered 5–8% of the time. These numbers come from the AI opponent, which does
not hoard itself; human opponents who also sit on Cancels may change the picture.

## AI

`src/ai/ai.ts` scores every option by how it changes each table's distance to a win
("heat"), following the priorities in the design document: take a win if available, then
block the opponent's threats (Shatter, Discard, deck arrangement, counters), then improve
its own position. It counters only when the play is a real threat (it would win, or does
significant damage), not just because it holds two Cancels. It does not see your hand or
the deck order unless a card effect reveals them. Its counter decision is applied without
a delay, so the timing doesn't reveal that it holds two Cancels.

In simulations it beats a random player about 94% of the time. AI vs AI is roughly even.
