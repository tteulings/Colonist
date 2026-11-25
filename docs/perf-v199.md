# Performance v1.99: profile and fixes

Branch `claude/wip-perf199`. Re-derived after the first round was lost. All numbers measured on a shared, noisy 4-core container (other agents running), so every row is a best-of or a median of several runs; differences under about 10% are noise.

How to reproduce: headless `node scripts/tournament.mjs ... [--host]` and the in-process A/B used here (alternating old and host batches in one process, `tests/golden/lib.mjs` `hostMode`); in-app `node tests/perf199.js [ROOT] [PORT]` (env `THROTTLE=4 SECS=60 PROFILE=1 SPEED=93 HOST=0|1 TRADES=answer|ignore`). 360x780 mobile page, one scripted person who ends every turn at once, three Intermediate bots, bot speed 93 (the default, "Fast / Snel": 425 ms per bot move).

## Results

| Measure | Before (v1.98 + docs) | After | Note |
| --- | --- | --- | --- |
| Headless, host route vs old route (same process, same games, best of 8 batches of 15, CPU time) | host about 29% slower in games/s (ratio 0.71), 49% longer per game at the median (0.67) | ratio 0.74 best-of, 0.77 median: 30 to 35% longer per game | the aim of 10% is NOT reached, see "Host route" |
| Headless host route, games/s per core (4 seats expert/simple/intermediate/expert) | 38 to 46 | 42 to 48 | about +10% |
| Round 2 (adopt the probe etc.), same A/B (`tests/perf199-headless.mjs`: per-batch ratio of CPU time, same seeds, back to back, median of 20 batches of 5 games, 3 runs, loaded 4-core container) | base tree (31171ac): ratio 0.65, 0.70, 0.66 | ratio 0.75, 0.77, 0.73 | host about 12% less CPU per game than before; still about 27% slower than the old route (target 10%: not reached). Games/s per core, medians of the batches: old 58 to 67, host 42 to 44 before, 43 to 50 after |
| In-app bot thinking per bot turn, host ON (`tests/perf199.js`, 4x throttle, 40 s) | 34.5 ms | 37 ms (same, noise: adoption is headless only) | the app still runs the muted probe + apply, by design |
| Headless old route, games/s per core | 52 to 65 | 58 to 64 | unchanged, as expected |
| In-app bot thinking per bot turn (4x CPU throttle) | 57 ms (1.4% of play time) | 58 to 64 ms (2.0%, because the rest got shorter) | bots were never the problem |
| In-app share of renderLog (inclusive, 4x throttle) | 14.0 to 14.5% | 0.2 to 0.3% | incremental append, no scroll read |
| In-app share of fx.js (inclusive, 4x throttle) | 17.8 to 19.7% | 28% | share went up because everything else shrank; per bot turn the main thread works 25 to 30% less (task time per bot turn 3.8 to 3.9 s -> 2.7 to 3.1 s at 4x) |
| Style recalculation per bot turn (4x) | about 2.45 s | about 1.99 s | -19% |
| Bot round, 4x throttled phone, Fast (median of rounds) | 11.2 to 11.8 s | 7.9 s | |
| Bot round, normal CPU, Fast (median, two runs) | 9.1 to 9.2 s | 5.9 to 6.2 s | target of the design doc was 6 to 8 s: met |
| Bot round when the person ignores a bot's trade offer, normal CPU | 15.8 s mean (17.7 median); 27.7 s waited on offers in 90 s | 12.6 s mean (13.4 median); 47.4 s waited on offers in 90 s | the 8 s rule (CLASSIC_OFFER_MS) was NOT changed, see below |

Golden net: ALL 37 MATCH plain and with `--host` (never `--force`), on the final tree.

## Findings

* Bot thinking is 0.6 to 2% of play time. What takes the time is drawing: style recalculation (about 60% of main thread task time in the profile at 4x), the dice and card flights, and the journal rebuild.
* Run `EXP=nofx` of `tests/perf199.js` (effects off) halves the style recalculation and brings the throttled round from 10 to 11 s to 7.9 s: the flying cards are the costly part (each is an SVG that instantiates the whole card drawing through `<use>`), not the dice.
* The old numbers "fx 18%, renderLog 10%" reproduce (18% and 14% here).

## Fixes

### Host route (bots/host.js, api/engine.js, api/actions.js, bots/inapp.js)

* A queued answer was judged twice (once by the bot through `ctx.isLegal`, once by the host in `finish`): now judged once (`host.judged`, same action object and prompt, nothing changed in between).
* `engine.apply(..., {trusted})` no longer validates the shape again; `isLegal` builds the canonical action key only when `_quick` cannot answer; `mode()` returns one cached object; `validateShape` reads precomputed entry tables; the action log copy is a flat clone instead of a JSON round trip; the `prompts` of a quiet apply are computed only when read.
* Headless probe mute is a flat path (no closures).

What is left is the double execution itself: a planner runs for real inside the probe, the game is restored from a snapshot, and `apply` runs the same move again through the engine. That costs the snapshot and restore (about 6% of a game), the second execution of builds, trades and cards (about 10%) and the judging. Removing it means adopting the probe's resulting state instead of restoring (a different design: the apply must then replay only its events and the planner's random draws must stay in order). Round 1 did not do it because it could not be proven identical without a golden net for the event stream; round 2 below has that net and does it for the common moves. As already agreed in the design doc, this only matters for tournaments and the lab, not for a phone.

### Host route, second round: adopt the probe (probe.js, host.js, engine.js, legacy.js, search.js)

Safety net first: `tests/golden-events/run.mjs` (see "Event golden" below). It was recorded on the tree before any of the changes here and still matches byte for byte.

* **Adopt the probe.** A planner step that did exactly one `build`, `buyDev` or `tradeBank` (and nothing else: no winner, no 5-6 build window) no longer restores the game from the snapshot to let `apply` play the same move again. The game stays where the planner put it; the host books the action (`engine.apply(a, {adopted})`: log entry, and for a bought card the tail `_do_buyDev` has, `_after_buyDev`: scores and win check). It applies only to a quiet headless host (`host.events` false, probe mute of the headless kind): with events the apply must run the move (the events are made from the position before it), and in the app the planner is muted, so the apply stays the one that shows and records. A queued action that was adopted is not judged again (the planner's own rules judged it when it was played; the position is already after it). Cards and deals (`playDev`, `offerTrade`) open prompts and offers of the engine and are not adopted (they are 17 of 280 steps of a game and cost 0.25 ms of an apply).
* **Proof that adoption equals restore + apply**: `tests/adopt199.mjs` plays host games the adopted way and, at every adopted step, rewinds, plays the move the old way and compares the two positions: every field `snapshot()` copies, the whole `serializeState()` (time stamps dropped), the card tracker and the `Math.random` count. 7776 adopted steps over classic (4 line-ups, deck dice, 8 points), Seafarers, 5-6 and Master games: no difference. It found two real ones that are now handled: a bought card's `recomputeScores`/win check (the apply has them, the planner leaves them for the end of the phase), and the 5-6 build window's `sbp.human.built` (those builds are not adopted).
* **Trade probes snapshot lazily** (at the `_stTrade` call, before the swap) instead of before the planner starts: 1287 of 1468 eager snapshot + restore pairs per 20 games were deals that never happened. `discardOf` stays eager (it pays inside the probe).
* **`isLegal` quick path** for the answers a bot gives most (`steal`, `discard`, `playDev`, a non-Seafarers `moveRobber`), and the canonical action key is built only when a concrete legal action is compared. `tests/quick199.mjs` judges 13 828 real and mutated answers both ways (quick path on / scan): no difference.
* One ctx object per host instead of one with eight closures per decision; the probe wrappers (`placeRoad`, ..., `_aiTrkNote`) take fixed parameters, no rest array on the pass-through path.
* The golden harness's move log (`tests/golden/lib.mjs`) keeps what a probe would have logged and writes it when the engine books an adopted action, so `tests/golden --host` has the same move log (`g.__adoptFlush`).

What is left (measured, per game of about 15 ms): no extra planning work (the call counts of `_aiPlan`, `_aiEta`, `getNodeProductionScore`, `_aiTradeVerdict`, ... are equal on both routes, and so are their times per call). The difference is the host's own code, about 3 ms of CPU per game by file (`api/engine.js` 1.1 ms, `master/sim.js` snapshot/restore 0.5, `bots/legacy.js` 0.4, `bots/host.js` 0.35, `bots/probe.js` 0.3, `api/actions.js` 0.15, mute 0.13) plus about 3% more GC: 280 host steps per game (prompts, judging, apply bookkeeping, log entry), 340 probes at 0.4 us, 60 snapshots at 2.3 us and 25 restores at 2.8 us. No single item is above 1.5% of a game; the target of "within 10% of the old route" is NOT reached with what can be proven equal (see the table).

### Event golden (`tests/golden-events/run.mjs`)

34 seeded games: the 22 of `tests/golden/games.mjs` plus 10 more seeds (expert, mixed ladder, trader/shark/builder, deck dice, Seafarers x2, 6 players, Master, Super, Rush). Old route (all 34, Rush included): the legacy loop observed through `engine.observe()`: every move as an action with its prompt, legality, drawn chance, the hash of the whole serialized state after it and the random-call count, plus every line of the golden move log and the result. Host route (the 28 non-Rush games): every applied action with seat, prompt kind, canonical action, the engine's events of that apply (JSON with seq), state hash and random count after it, plus the result. Each host game is played a second time with quiet apply (what a tournament does, where adoption is on) and its step lines must equal those of the events run. Baseline in `old.txt.gz` / `host.txt.gz` (1.1 MB), `--regen` rewrites it, a difference prints the first differing line of the game. Checked to catch a one-field change in one event (`turnEnd.seat` of one turn): reported at line 76 of classic-expert.

### fx.js and base.css

* `diceRoll` reads the board, the dice chip and the dice slots first and writes (`.fx-hold`, the tumbling dice) afterwards; the Turn spotlight reads `offsetParent` before it starts its animations; the `+n` badge gets its rectangle before the pulse animation starts; `flyResources` reads the canvas rectangle once, not once per card.
* `#fxLayer` has `contain: layout style`, so an actor added to the layer never re-lays-out the page.
* The unavoidable first read after a render still forces that layout (it would have been done at the next frame anyway); the gain is that the layout is not done twice per effect.

### renderLog (game.js)

* The rows of the lines already shown are kept: a new line appends its row(s) and the oldest drop off. A full rebuild remains for a new game, undo, a language, theme or player name change, and a line edited in place.
* The scroll to the newest line (a layout read on every log line) is done only where the journal is visible: always on a wide screen, on a phone only while its sheet is open (opening it scrolls already).
* Not done: grouping per turn (the rows already carry a "Turn n" header per roll).

### Bot pacing on Fast / "Snel" (game.js, fx.js)

Only when the slider gives a bot move every 450 ms or faster (the default 93 and above); Normal and slower are unchanged. Reduced motion keeps its own short cross-fades and still shows the cards (no flights are skipped under reduced motion).

* The beat before the first bot of a round 500 -> 250 ms.
* The wait after a bot's roll, before it acts: 800 -> 450 ms (7: 1800 -> 1400 ms).
* The dice tumble and come to rest in 0.7 of the time.
* A bot's gain is no longer five flying cards: its portrait pulses and says `+n` when the card would have arrived. Your own cards still fly to your hand.

## The 8 s trade offer rule (PO decides)

`CLASSIC_OFFER_MS = 8000` is unchanged. Measured on normal CPU, with a person who never answers: a bot round takes 12.6 s on average instead of 6 s, and in 90 s of play 47 s (53%) was spent waiting for offers (4 to 6 offers; one round can hold several). The "16 to 32 s" rounds of the design test come mostly from this rule. If the PO wants rounds of 6 to 8 s with a person who does not answer, the offer must expire sooner (for instance 4 s on Fast) or be answered "no" by Skip (the design says Skip never answers an offer).

## Tests run

Golden plain and `--host`: ALL 37 MATCH. `tests/golden/determinism-pw.js`: ALL PASS. `tests/api201.js`: ALL PASSED. `tests/tourn196.mjs`: ALL OK. `tests/hostfallback197.js`: PASS. `tests/tap132.js`: ALL PASS. `tests/ui191.js`: one failure, an English word in a Dutch aria-label ("Turn 4, ... key turn"), from the i18n/analysis work of another agent, not from these files. `tests/rushmono195.js` (known flaky): 7 failures on the first run, 1 on the rerun, 4 on the untouched v1.98 tree: the same dev-card picker checks fail there too. `tests/inapp197.js` (BASE = v1.96 + the aligned-scoring patch, built with `git archive d1fc3ec` and `tests/fixtures/base196-aligned-scoring.patch`; classic, bots only, 1 game): host ON = old driver PASS; against the previous release it differs by one poll (26 vs 27) on the final tree, which is the intended Fast pacing, and PASSES on a copy of the tree with the two Fast switches (`_botsFast`, `Fx.fast`) forced off, so the games themselves are unchanged. The rest of its matrix (human, Seafarers, 5-6, Rush) is too slow on this loaded machine to finish inside the time box: not run. `tests/events197.js --quick` against the same BASE: PASS on the tree with the Fast switches off in two of five runs and on both halves of the change (game.js alone, fx.js + base.css alone) and on the host trims alone; the failing runs differ in the order of near-simultaneous timers (a devCard / buildSettlement sound against the 900 ms resourceGain sound; one fx call order) at a different place each time, at load average 14 to 18, so it is timing flake under load, and it cannot pass with the Fast pacing on by design (that shortens those timers). Both tests should be rerun on a quiet machine with the pacing off (`_botsFast` false) as the proof of equal games.

## Tests run (round 2, final tree)

`tests/golden/run.mjs` plain and `--host`: ALL 37 MATCH (never `--force`). `tests/golden-events/run.mjs`: ALL 62 MATCH (34 old-route streams, 28 host-route streams, 28 quiet re-plays). `tests/adopt199.mjs 20`: 6159 adopted steps equal their restore + apply. `tests/quick199.mjs 20`: 11 583 judgements equal. `tests/api201.js`: ALL PASSED. `tests/tourn196.mjs`: ALL OK. Browser: `tests/golden/determinism-pw.js` ALL PASS, `tests/hostfallback197.js` PASS, `tests/intent196.js` and `tests/intent197.js` (BASE = the aligned v1.96 tree) ALL PASS, `tests/tap132.js` ALL PASS, `tests/rushmono195.js` ALL OK (first run), all on the tree before the last three micro-commits (apply dispatch table, quiet result class, `_aiTrkNote` check); hostfallback197 and intent196 were run again on the final tree.
