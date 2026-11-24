# Variant D: "Jij tegen je grootste rivaal" (Waarom won/verloor je)

A side-by-side mini comparison of you and the strongest other player, on 3-4 facts the app already measures, with the decisive difference marked, one sentence on top and one measured own move underneath.

## Rule (all numbers come from `analyseGame` / `decisionsOf`, nothing invented)
1. **Rival** = the other seat with most game points (incl. hidden cards). Winner if you lost, runner-up if you won. Tie: the real winner, then the more accurate seat. Never the average, never the last-place bot.
2. **Candidate facts** (you vs rival), each with a "real difference" size: start win chance after pick 2 (5%), dots at the start (3), first city turn (3 turns; a city against none counts), points in the one phase where the two differ most (1 point), moves cost (5%, the same number as the Numbers sheet), luck (8%, each seat's own estimate, unbalanced).
3. **Rows**: up to 4 facts with score = gap / size >= 1, biggest first, shown in game-flow order. Fewer than 3 real differences: fill to 3 with the closest ones, shown without arrows.
4. **Arrows**: the better side of a row gets a green up arrow, the worse side a red down arrow; no arrows if the gap is below its size. Levels have no sign, deltas do (+4, -14%, +1%).
5. **Decisive row** = highest score among rows where the *result's* side is ahead (you if you won, rival if you lost). Highlighted ("Beslissend"/"Decisive") and used as the one sentence (template per fact, subject = the leader, past tense, numbers from both sides).
6. **No decisive row** = the facts do not explain the result. Then the sentence says so and never claims a lead: lost -> "Op deze maten stond je niet achter {R}; het verlies zit elders" or "Dicht bij {R}: geen maat verschilt duidelijk"; won -> "{R} stond op deze maten voor, toch won jij" or the "close" sentence.
7. **Moment** (own move, in win chance, with turn): lost = your move with the biggest win-chance loss (>= 3%), neutral label "Je duurste zet", never called an error unless the app's own error rule says so (we only print the number); won = your best move (gain over next-best move >= 3%). Robber moves are skipped (v1.99 scope). Hidden when nothing reaches 3%.
8. Text: sentence max 2 lines, moment max 2 lines, labels 1 line; all text >= 11.5px; rows, moment strip and link are buttons >= 44px (mockup: rows would open the Numbers sheet, the moment would open Bekijk bord).

## Files
- `extract.mjs`: runs the real `analyseGame` on the 2 fixtures (`r1` win, `r2` loss) and all 37 calib games, writes `data.json` (`node extract.mjs POST199 CALIB_DIR data.json`). Language-neutral facts.
- `build.mjs`: data -> self-contained HTML (fonts embedded, NL + EN, light + dark: `#light`/`#dark` in the URL, or the prefers-color-scheme default; buttons appear on desktop width). Output in `html/`.
- `shoot.cjs`: screenshots (360 wide dsf2, one 412 each win/loss) and checks (no overflow, text >= 11.5px, taps >= 40px, <= 2 lines). Last run: ALL OK, 14 shots.
- `shots/`: `win|loss-{nl|en}-{light|dark}-360.png`, `loss-nl-light-412.png`, `win-en-dark-412.png`, calib: `calib-s122-factsmine`, `calib-s115-cost`, `calib-s126-luck`, `calib-s1-blowout` (NL light 360).

## Over the 39 real games (37 calib + 2 fixtures)
Decisive row exists in 38: luck 14, points per phase 7, start 7, first city 5, moves cost 5. A moment exists in 38. 2 games have fewer than 4 rows. Calib games are almost all losses for seat 0 (learner/solid bots), so the win case is covered by one fixture only.

## Pros
- Answers "why" with a person, concrete and checkable: every cell exists on another screen (Numbers sheet, Strategy tempo/scorecard, Luck tab).
- Compares with the best other player only; honest by construction, a row where the rival is ahead is shown as such.
- The decisive row is chosen mechanically, so sentence, highlight and numbers can never disagree.

## Cons
- Luck is the decisive fact in about 1 in 3 games; luck is a weak lesson ("you could not change it"). Could be down-weighted, or luck shown as its own line instead of competing.
- Start win chance and moves cost overlap (start picks are inside moves cost); a start-heavy loss shows two red cells for one cause. Kept the app's total so numbers match; an exclusive "moves without start" would be cleaner.
- Four rows plus the moment is a tall block (about 560px at 360), pushing the timeline below the first screen.
- Rows are fixed facts, not a causal story: "decisive" means largest gap in the winner's favour, not proven cause.
- Green on a negative number (a smaller loss, e.g. luck -21% vs -80%) can read odd; the arrow is the meaning.

## Edge cases
- **Facts disagree with the result** (e.g. calib s122: lost 7-10, you ahead on start, first city, midgame points, moves cost): no decisive row, no highlight; sentence says the loss is elsewhere. Won while the rival leads (the reverse): "{R} stond op deze maten voor, toch won jij".
- **Everything close**: fewer than 3 real differences -> arrow-less rows and the "Dicht bij {R}" sentence.
- **Tied top score** (r1: Blaauw and Groen both 8): winner first, then Accuracy; the pick is stated by name, nothing implies he is uniquely strongest.
- **City: one side never built one**: shown as "geen"/"none", counted as a gap only in games of 12+ turns; sentence "{S} bouwde een stad (beurt n), {o} geen".
- **Missing data** (old review, no luck run, no board, Rush/Seafarers, 5-6 players): that row is simply dropped; no reviewed decisions for the rival drops the start row; no moment -> the strip is hidden; block hidden if `analyseGame` gives no `you`.
- **Luck null for either seat**: row dropped (never compared with a missing value).
- **Long bot names**: header cell ellipsizes, sentence wraps to 2 lines (name + two numbers still fit at 360).
- **Moment of a loss is a close call**: still the biggest loss, but only the number is printed, the label stays neutral.
