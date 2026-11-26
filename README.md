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
`npm run sim` (AI-vs-AI balance report for the rule variants listed in `src/sim/balance.test.ts`;
`SIM_GAMES=1000 npm run sim` for more games),
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
| `src/ui/totemArt.ts` | Totem face art (generated): five faces per card type |
| `design/totem-faces.html` | Design page the faces were drawn on; open it in a browser to see all 25 and try stacking |

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
- **Copies win:** five of a kind by default. Option: four ("Four Copies").
- **Face-up row** (off by default): 3–5 cards lie face up next to the deck. Each draw takes one of
  them (the row refills from the deck) or the top of the deck. A set bonus draw works the same way.
- **Set bonus** (off by default): when the 3rd (or 4th) totem of one color enters your table, you
  draw a card, activate that card's effect again, or choose between the two. The bonus comes after
  the card's own effect; a countered card earns nothing. It needs a lower number than the copies win.
- **Turn limit:** 300 turns, then a draw (a safety valve; real games last ~15 turns).
- First player is random by default.

## AI

`src/ai/ai.ts` scores every option by how it changes each table's distance to a win
("heat"), following the priorities in the design document: take a win if available, then
block the opponent's threats (Shatter, Discard, deck arrangement, counters), then improve
its own position. It counters only when the play is a real threat (it would win, or does
significant damage), not just because it holds two Cancels. It does not see your hand or
the deck order unless a card effect reveals them. Its counter decision is applied without
a delay, so the timing doesn't reveal that it holds two Cancels.

In simulations it beats a random player about 94% of the time. AI vs AI is roughly even.

### Card art

Each card type is an animal carved as a totem block: Repeat is an owl, Shatter a bear,
Discard a raven, Return a turtle and Cancel a frog. Every type has five faces, and a card's
face comes from the number at the end of its id (`shatter-1` … `shatter-10`), so each face
appears on two of the ten copies.

The block sits in the bottom 48/140 of the card. On the table, each card in a stack sits
exactly that much higher than the one below it, so the blocks join into one totem pole and
only the top card shows its wings.

The faces live in `design/totem-faces.html`. After changing that page, regenerate the
game's copy with `node scripts/export-totem-art.cjs` (needs Playwright with Chromium).

