# Variant B: "Verhaal in drie fasen" (Waarom won/verloor je)

One compact card at the top of the Overview. Top: a one-sentence verdict. Below: three rows, Opening / Middenspel / Eindspel (the app's dynamic thirds, turn ranges printed), each with ONE measured moment, a pill with its win-chance swing, and a small spark of the player's win-chance line in that phase. Tap a row = "Bekijk bord" at that turn (same `data-pxstop` as the key-moment rows).

Files: `html/*.html` (self-contained, fonts embedded; `#dark` / `#light` in the URL picks the theme, default = system), `shots/*.png` (360 wide dsf2; two at 412), `extract.cjs` (real data), `build.cjs` (mockups), `shoot.cjs` (screenshots + checks), `stats.cjs` (robustness over 37 calib games + 2 fixtures), `data-*.json` (extracted values).

Run: `node tests/serve.mjs $APP 8900 &`, then `APP=$APP node extract.cjs OUT.json nl GAME.json[,GAME2...]` (add `PID=1` for a bot seat), `node build.cjs`, `node shoot.cjs`.
`extract.cjs` loads the real reviewed game in the app (headless Chromium), calls the app's own `modelOf` / `momentFor` / `causeText`, and returns per phase: start and end win chance, the player's line, and every listed moment (pins plus "All N moments") with move / dice / rest.

## The rule (all numbers are win chance, player's own line)

1. Phases = `phaseLimits(T)` (dynamic thirds, same as the timeline bands). Phase start % = the value at the end of the previous phase, so the three rows chain (26 > 40 > 71 > 100).
2. Candidate moments = the swings the Overview already lists (3 pins + "All 15 moments", no 7s, no award steps). So every row number can be found in the key-moment list.
3. Per phase, the row's moment = the biggest swing with |d| >= 3% that goes the way the phase went (net of the phase >= 3% up: biggest rise; >= 3% down: biggest fall; |net| < 3%: biggest either way). Reason: the row then explains the phase, instead of showing a lucky roll inside a losing opening.
4. Row text: line 1 `Beurt N · <label>` (label = the app's `causeText`: "dorp gebouwd", "worp van Groen", "te vroeg gestopt"), line 2 the split `zet · worp · rest` = the same three parts as the key-moment rows; pill = their sum (checked: always equal). zet = the player's own play after the roll, worp = the roll, rest = what others did. Signs on %, green up / red down.
5. No such swing in a phase: quiet row "Geen duidelijk moment" + `winkans a% → b%` (or "bleef x%"), no pill, spark only.
6. Verdict = the phase with the biggest net move on the side of the result (won: biggest rise, lost: biggest fall), if >= 5%: "Je won in het middenspel: winkans 40% → 71% (+31%)." Otherwise "Geen fase gaf de doorslag: elke fase onder 5%." That phase row gets an accent dot.
7. Spark: the player's line only, y auto-ranged (min span 40%) so small phases stay readable, dotted 50% line when in range, dot = the moment (green/red).

## Checks (shoot.cjs, 15 shots)
No overflow at 360 / 412, text >= 11.5px, taps >= 40px (rows 76-88px), every text block <= 2 lines, no NaN/"punten"/robber/port words. NL + EN, light + dark. Card height ~ 400px at 360.
Over 39 real games (117 phase rows): pill = move+dice+rest in all rows; rows chain without gaps; 29% of rows are quiet; 0 games without a decisive phase for the verdict; games of 12-33 turns.

## Pros
- Reads as a story in time, matches the phase bands and the Lesson-3 phase vocabulary the app already has; always three rows, so the layout is stable.
- Every number is already in the key-moment list or on the chart (same split, same turn), so nothing new to verify; no heuristics, only win chance.
- Verdict and rows agree (the row explains the phase's direction); spark shows shape, not just a number.
## Cons
- Honest data is dominated by the dice: the largest part was the roll in 50 of 83 shown rows, the player's own move in 24, others' play in 9. So the card often says "worp van Groen", which is true but teaches little; the own-move lesson stays in Lesson 1.
- Three rows can repeat one story ("worp" three times); 29% quiet rows look empty in short games.
- Sparks are small (64px) and step-shaped (several swings per turn); the 3 pins of the timeline below may differ from these 3 moments, so two "key moment" systems sit close together.
- Calib seat 0 lost every game, so wins are only shown by the fixture win game.

## Edge cases
- No clear moment: quiet row (rule 5). All three quiet: verdict falls back to the "no phase decided" sentence, rows show a/b only.
- Very short game (12-14 turns): thirds of 4-5 turns; the last phase is often already 0% / 100% (`s107`: "winkans bleef 0%"); nothing breaks, rows stay >= 76px.
- Bots (viewing another seat, `bot-nl`): same rule on that seat's line; the title and verdict use the bot's name ("Waarom Blaauw verloor"), never "Je". A bot's own-move parts are real (they play), but the app has no bot "Jouw zetten" wording, so the labels stay neutral.
- Phase with only another player's moments: label names that player ("Groen speelde door", "worp van Groen").
- Unreviewed/partial reviews: `modelOf` returns null, the card is not drawn (same as the verdict card today).
