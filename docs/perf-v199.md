# Performance v1.99: profile and fixes

Branch `claude/wip-perf199`. Re-derived after the first round was lost. All numbers measured on a shared, noisy 4-core container (other agents running), so every row is a best-of or a median of several runs; differences under about 10% are noise.

How to reproduce: headless `node scripts/tournament.mjs ... [--host]` and the in-process A/B used here (alternating old and host batches in one process, `tests/golden/lib.mjs` `hostMode`); in-app `node tests/perf199.js [ROOT] [PORT]` (env `THROTTLE=4 SECS=60 PROFILE=1 SPEED=93 HOST=0|1 TRADES=answer|ignore`). 360x780 mobile page, one scripted person who ends every turn at once, three Intermediate bots, bot speed 93 (the default, "Fast / Snel": 425 ms per bot move).

## Results

| Measure | Before (v1.98 + docs) | After | Note |
| --- | --- | --- | --- |
| Headless, host route vs old route (same process, same games, best of 8 batches of 15, CPU time) | host about 29% slower in games/s (ratio 0.71), 49% longer per game at the median (0.67) | ratio 0.74 best-of, 0.77 median: 30 to 35% longer per game | the aim of 10% is NOT reached, see "Host route" |
| Headless host route, games/s per core (4 seats expert/simple/intermediate/expert) | 38 to 46 | 42 to 48 | about +10% |
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

What is left is the double execution itself: a planner runs for real inside the probe, the game is restored from a snapshot, and `apply` runs the same move again through the engine. That costs the snapshot and restore (about 6% of a game), the second execution of builds, trades and cards (about 10%) and the judging. Removing it means adopting the probe's resulting state instead of restoring (a different design: the apply must then replay only its events and the planner's random draws must stay in order). It is not done here because it cannot be proven identical without a new golden net for the event stream. As already agreed in the design doc, this only matters for tournaments and the lab, not for a phone.

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
