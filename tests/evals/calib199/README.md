# calib199: real in-app reviewed games (v1.98 app)

37 four-player classic games played in the real app (Chromium) with the app's own post-game review run for every seat. For calibrating the coach rules of the post-game analysis. 2.5 MB in total.

## Files
`<tag>.json.gz`, one per game. `tag = s<seed>-<level1>+<level2>+<level3>-<human>-p<points>`.
Unzipped: exactly what the app's "Export file" writes (`histExport`, format `colonist-game` v1), the same shape `tests/lessons194-lib.js` and `tests/evals/build-fixtures.js` consume, plus one extra key `calib`:

- `format`, `v`, `meta`: the Past-games entry (id, mode, pts, `seats[{name,vp,you,prof}]`, `me` = 0, `winner`, `result`, `turns`, review summary `acc/rn/lost/cls/mist/rp`, and the Lessons row `lr`).
- `state`: the finished game (`serializeState()`, log entries stripped).
- `rv`: the review recording. `rv.base` (board, ports, settings), `rv.recs` (packed decision records; `unpackRecs` from `src/review/pack.js`), `rv.reviews[pid]` for **all four seats 0-3** (`pid`, `results[]` = one result per decision: candidates, loss, class; `done`, `engId`, ...), `rv.luck` (win-chance luck per event), `rv.bots: 1`.
- `calib`: `tag, seed, levels {0: "human:<kind>", 1..3: preset id}, points, map, winner (seat), turns, seats[{id,name,human,personality,vp}], reviewComplete (always true here), seatsReview[{pid,todo,done,res}], playMs, reviewMs`.

## How it was produced
`node tests/evals/play-reviewed199.js batch --plan tests/evals/calib199-plan.json --par 2` (one game: `... game --seed N --levels a,b,c --human learner|solid [--points P]`).
The script serves the repo, opens the app, starts a game with `startNewGame({mode:classic, board:island, numBots:3, botStyleMode:"each", perBot:[l1,l2,l3], winPoints})`, then drives seat 0 as a scripted person through the app's own handlers (`handleHumanRoll`, `api.act` builds, `handleHumanBuyDevCard`, `handleHumanBankTrade`, `handleHumanEndTurn`, ...) while the bots play at their levels. The review recorder only runs when a person is at the table, which is why seat 0 is a scripted person; seats 1-3 are bots whose decisions the app records and reviews too ("the others"). Play runs on a virtual clock (`page.clock`, 250 ms steps) with a seeded `Math.random` (mulberry32 of `--seed`; the human script has its own seeded generator); then the clock is released and the app's review (quick + deep round for every seat, then the luck run) runs in its workers in real time until every seat is complete, then the game is archived and exported via `hist.get`. Play is deterministic per seed; the review's Monte Carlo is not seed-fixed, so results can differ slightly on a rerun.

Seat 0 kinds (`human`): `learner` = ends turns early, picks random legal builds/setup spots/robber victims, sometimes a random discard or bank trade (learner-like mistakes; it is passive and never won); `solid` = spends on city > settlement > dev card > road, best set-up spot, bank trades with a surplus.

## Mix (seats 1-3 levels; ids are the app's preset keys: beginner = "Easy", intermediate = "Medium", expert = "Hard")
- Seats 1-3 over 37 games: beginner 19, simple 16, intermediate 21 (weak: 56 seat-games), expert 16, builder 13, shark 12, trader 12, master 2 (strong).
- Seat 0: learner 15, solid 22.
- Tables: 8 weak-only, 10 mixed, 10 strong-only, 2 with Master, plus the first test game (seed 1, weak). Points target: 31 x 10, 4 x 8 (seeds 130-133), 2 x 6 (seeds 134-135). Rush is not covered (the recorder does not run in Rush).
- 6182 reviewed decisions in total (seats 0-3). Winners: expert 8, intermediate 9, shark 6, trader 5, beginner 4, simple 2, builder 2, master 1; the scripted seat 0 never won.
- Games are short: 12-33 turns (the app's turn counter), seats end 3-11 VP.

## Load
```js
const { load } = require("./tests/evals/calib199-load.js");   // or: node tests/evals/calib199-load.js  (table of all games)
for (const g of load()) { /* g.calib, g.meta, g.state, g.rv.reviews[0..3].results */ }
```
To open one in the app: `await game.hist.put({ ...g.meta }, { state: g.state, rv: g.rv }, { quiet: true })` (as `tests/lessons194-lib.js importGames` does with `{ meta, ...rec }`).

## Timing (4 cores, 2 games in parallel)
Per game 232 s play + 418 s review on average (about 11 min each at par 2; the whole batch of 36 took 200 min, 5.6 min per game). A single game alone: about 100 s play + 200 s review (seed 1, learner, weak bots). **Do not run 3 in parallel**: the review workers (up to 3 lanes each) starve and the review did not finish in 25 min (those runs were discarded). The script refuses to save a game whose review is incomplete.
