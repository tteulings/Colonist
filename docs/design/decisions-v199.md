# v1.99 product-owner decisions and build notes (rebuild record)

## PO decisions
- Hand cards: current app fan and layout (light curve). Current app icons; button look as current app (no icons on Build etc. buttons as in mockups).
- Player cards: new style but compact; board at least as large as now.
- Tab bar variant A (Spelen, Dagpuzzel, Terugblik, Bots); Dagpuzzel tab/card shows disabled "Binnenkort" in v1.99.
- Default language ENGLISH for anyone without a stored choice (stored choice wins; no navigator sniffing).
- Auto dark mode for anyone who never chose a palette; one toast "Colours follow your phone." with Undo.
- All 11 bot levels stay reachable: Nieuw spel sheet shows main levels, "More levels and a level per bot" second layer.
- Nieuw spel sheet with "More rules" second layer; Pauze with 5 rows (Uitleg, Stand, Instellingen, Nieuw spel, Naar start); Instellingen in 5 groups (Uiterlijk, Spel, Leren, Gegevens, Over).
- Post-game: Geluk as win chance; Precisie and Geluk for all players; point bars in seat colour; warmer; green/red with ▲▼ for ALL players (old "only Jij" rule retired).
- Analysis: see analysis-v199.md (three lessons, v1.99 scope, luck unbalanced).
- Board layouts (Meer, Landengte, Willekeurig): NOT in v1.99; next version.
- Host-in-app default ON: not approved, not in v1.99.

## Integration notes from the lost first build (avoid re-learning)
- NL strings: shell table NL_199 loaded first (older tables win), post table NL_199P loaded last (post wins). No shared keys.
- Remove the v1.98 type-scale override in themes/shell.css for post screens; then let `.rs-key .x` and `.rv-list .x` wrap.
- Terugblik: only post-ui's Games | Lessons door ([data-pxdoor=lessons]); keep tab-root frame (gear, no back arrow, tab bar).
- lessons194 long task: during analysis update only the progress line in place, redraw the Lessons page once at the end (max long task went 127 -> 74 ms).
- tests/verdict182.js regex for "Miss": `Miss(?![a-z])`. i18n-walk must click end-screen tabs inside the closed "More" card.
- aitab173/why182/verdict182 need redesign/state9383.json (copy of state9101.json) in the test root.
- Version bump: APP_VERSION 1.99, all ?v=198 -> ?v=199 (avatar ?v=57 stays), cache colonist-v199, new files in sw.js SHELL.

## Post-game analysis, fix round 6 (critic r5)
- "Why won / lost" headline = the 1-2 biggest swings of THAT player's win chance on their side of the result (post-model `whyOf`, from the review's look, steps with a 7 and award steps left out), each named by its cause (own build, lucky / unlucky roll, own clear error of that turn, what another player did). Format "You won mostly in turn 12 (built a city, +25%) and 7 (lucky roll, +18%)." Max 2 lines at 360px. Income / cities / tempo live only in Strategy and are compared with the best other player, never an average.
- The timeline pins and key moments are now computed from the same per-player swings (they used to depend on the current player only and were empty for some games).
- Start advice: the played spot and the best spot carry the review's refined win chances B and A, so "29% -> 38% (+9%)" is the same number as the start cost in the tiles. When the counted start cost is shrunk by the cap on total moves cost, the tile says "measured -11%, counted -9%". Dots are explained once ("numbers on the tiles are dice numbers; dots = how often they roll"); a better spot with fewer dots says why ("fewer dots, but brick added").
- One error vocabulary: Real errors = clear mistakes, blunders and missed chances (count on every page, tiles, Numbers sheet); Could be better = every other weaker move. Moves rows show the move's own margin (+-1,5); a gap under twice the margin is not an error ("noise correction" is never written; plain words only).
- Luck: the other players' rolls are ONE group whose sum is exactly the sum of its rows; the toggle label follows its state; "B18" is "Turn 18"; board stops are plain numbers under a "Turn" label.
- Scorecard: up / down triangles in the cells of every highest / lowest value of a row.
- Tests: analysis199-ui.js measures line boxes (max 2 lines on headline, captions, notes), no "B<number>" tokens, triangles in scorecard cells, headline names measured moments, start advice arithmetic, luck group sign and toggle state, one vocabulary for errors on all pages.
- Long comparison suites (events197, inapp197) run only when engine/host code changes, not on UI-only rounds.

## r1: one number per roll (luck consistency)
- A roll's effect on a seat's win chance is ONE number: the luck run's own value for that roll (`R.luck.res["dice:s:e"].l[seat]`, whole percent). The timeline pins ("dice"), the Overview's "biggest roll", the headline's named rolls, the Luck tab, and the AI tab's roll steps all read it (`rollLuckMap` in src/post-facts.js; `describeStep` in src/review/ledger.js sets `dl`). The review's before/after look only supplies the step's TOTAL swing and the actor's own move; the pin's "rest" is what is left of that swing (`d - dice - move`).
- The Luck tab lists ONE EVENT per row (a roll, a steal and a card of one turn are three rows); no "(+n) more events" sums. The other players' rolls group is the exact sum of its rows (whole numbers).
- The luck headline ("bad luck in total (−16%)") is the Luck tab's total for the seat (rolls of everybody, steals, draws and seat order), not "your own rolls". A single roller is named only in the roller clause ("Groen's roll in turn 3 helped you (+8%)").
- AI tab: every signed number carries a %; turns read "Turn n" / "Beurt n" (no "B2" / "T10" tokens); the roll sentence reads "Groen rolled 4 (+4%) and Geelen 9 (+6%); Groen got wheat."; no "open the AI tab" row on the AI tab; what is known already (who won, when, points) shows while the ranked part settles.
- Test: tests/facts199-ui.js "one value per roll on every screen" and the AI tab checks.
