# v1.99 post-game analysis: approved design (rebuild spec)

The approved design reached 8.0/10 with an independent critic after four rounds. Round 4 polish then fixed every remaining defect. The mockups were lost in a container restart, so this file reconstructs the final design from the round reports. It overrides `na-het-spel.md` wherever the two disagree. For the shell, design system and other screens, `na-het-spel.md` and the other files in this folder still apply.

## Goal (product owner)

The analysis must TEACH. The player should come away with three lessons:

1. **"Here I made a dumb mistake."** Only real blunders count; a close call is never called a mistake.
2. **"With this board I should broadly have done this."** This includes the start placement.
3. **"At this point in the game you should do this."** These are reusable phase rules, shown only when a move in that phase broke them.

The analysis must also say why I won or lost, at two levels: individual decisions and the overall strategy.

Depth must be at least that of v1.98. It must be a fresh, coherent design with progressive disclosure, not the old widgets bolted back on.

## Hard rules

**Layout and sizing**
- Phone first: 360x780 and 412x923, with no horizontal overflow.
- Text is at least 11.5px. Tap targets are at least 40px (44px in the shell).
- Visuals first: at most 2 short lines of text per block, and no walls of text. Worked/Hurt use ▲▼ chip rows with numbers.

**Wording**
- "punten" means game points only. Win-chance gaps are written "6% or more", never "points".
- Use dorp, stad, weg, ontwikkelkaart, hout/baksteen/wol/graan/erts, and "langste weg".
- NL says "Precisie", EN says "Accuracy". There is no other accuracy word.
- Bot pages never say "Jouw zetten"; they say "Zetten"/"Moves".
- No jargon such as "hefboom" or "Maten".
- English is the default language.

**Numbers and colour**
- Luck is shown as win chance ("Geluk −12%"), with a Cards switch.
- Precisie and Geluk are shown for ALL players.
- Green and red for plus and minus apply to ALL players, always with ▲▼.
- Point bars use the seat colour. The overall palette is warm.
- Loss red must not collide with the red of the Jij seat: losses use tinted ▼ pills, not plain red bars.
- Auto dark mode applies to anyone who never picked a palette.
- Never sum % across games. Use only numbers the app computes, or a small derivation from the game log.

**Assets**
- Keep the current app icons, current buttons and the current hand-card fan.

**v1.99 scope**
- Excluded: ports, longest road/largest army race analysis, who you fed in trades, and robber targeting. No rows, chips or claims may rely on them (e.g. no "no port"). These are deferred to v2.0.
- Luck (PO decision): show each seat's luck UNBALANCED. These are independent estimates, as live in v1.98. Make no zero-sum claim anywhere. Seat-order luck itself is zero-sum.

## Pattern

Every number has three layers, opened the same way:

1. **Calm first layer.**
2. **Tap a row or column:** it unfolds in place.
3. **"Numbers/Cijfers" bottom sheet:** exact values per player.

An (i) sheet holds the definitions:
- **The error rule.** An error is a gap of at least 2 × the move's own noise, about 6% when no SE is stored. Set-up picks follow `SETUP_LIMITS` instead (could be better 5–10%, mistake 10–18%, blunder 18%+).
- **"Accuracy vs moves cost".** Accuracy = how often you were near the best move. Moves cost = what every miss lost, added up.
- **Phase limits.**
- **Model/version.**

## Tabs

Overview, Moves, Strategy, Luck, AI. There is no standalone Win chance tab. The win chance lives in the overview timeline, and the full scrubbable chart opens via "Bekijk bord".

## Screens

### End screen (01, 01b)

**Rows**
- One row per player: place, avatar, points, a source bar for where the points came from (seat colour), Precisie, and luck %.
- Rows expand per player, bots included.
- The verdict line comes from `verdictLine`.

**Buttons**
- Review, with done or progress status.
- Rematch.

### Overview (02)

**1. Verdict card**
- **Headline:** leads with the biggest REAL driver and cites evidence. Example: "the others fell away (+111%) and luck helped (+51%), despite 68% lost to your moves".
- **Accuracy line:** one line explaining Accuracy vs moves cost.
- **Pillars:** three exclusive pillars that sum to the total moves cost. They are Real errors −48%, Start picks −6% and Other moves −14%, totalling −68%. Each pillar is tappable.

**2. Win chance timeline**
- One line per player.
- Phase bands: opening, midgame and end. They are dynamic thirds of game length, with the turn ranges printed on them.
- Numbered pins equal the key moments.
- Key moments are total swings, split into move / dice / rest.
- An "S" pin marks the start picks.

**3. Lesson 1, Real errors**
- Only clear mistakes, blunders and missed chances get a card.
- Each card shows:
  - the class chip;
  - the win-chance gap;
  - a board snippet with the played move and the better move ringed;
  - "You did / Better (A)";
  - two bars captioned "win chance after this move", which equal the chart line;
  - one "why" line plus up to 3 chips from the existing `explain()` feature attribution.
- A "Not errors" row keeps close calls and slight differences out of the list.
- The header count equals the list length.
- Explain once that, for example, 22 of 25 decisions are scored because 3 had only one sensible option.
- Footnotes are one line each.

**4. Lessons 2 and 3 (compact) and "Take with you"**
- Compact versions of Lessons 2 and 3. Their full versions live on Strategy.
- "Take with you" turns the three lessons into one actionable card with up to 3 rules for the next game, plus "Practise these", which links to the existing lessons practice.

**5. Ledger "What moved your win chance"**
- Four parts: Set-up, Luck, Moves and Rest. Rest is neutral in colour and is the opponents' remainder.
- It leads with the cost per move (e.g. "3.1% per move").
- A "How to read this" section unfolds.
- The winner story is explicit and never contradictory. Example: "Your moves gave up 68% against best play. You still won: the opponents fell away."
- Set-up is the seat plus your two start spots before the first roll. It is never reused for any other number.

### Numbers sheet (02c)

- Exact values per player.
- Every value is labelled; there are no bare slash pairs. Bank trades and player trades are separate rows, and points per phase are three labelled rows.
- Class counts per player.

### Player page (03 you, 03b bot)

- Full breakdown, with the pip rail for points.
- Accuracy band.
- Luck.
- Errors list.
- Bot pages use bot wording.

### Luck tab (04, 04b)

- Win chance is the default, with a Cards switch.
- Rows are visibly sorted by the unit shown.
- Near-±0 events are folded. Seat order is an event row.
- A Total row closes the list.
- Steals, discards and the 7 have no card count, so they stay in win chance even in Cards mode. Their label is neutral, e.g. "Cards lost (7 rolled)".
- No NaN appears.

### Moves tab (05)

- **Three headline families** of move classes.
- **Fine sub-labels:** the nine classes appear as fine class sub-labels on every move row.
- **Two lists:**
  - **"Biggest misses":** the same 4 misses as Lesson 1, then 3 others, then a folded set of "15 more moves costing under 1% each".
  - **"Best moves":** with the next-best gain.

### Strategy tab (05b)

**Lessons**
- Full Lesson 2, "This board":
  - the board plan label (city plan ore/grain, expansion wood/brick, or mixed);
  - your two start picks against the "Top of the spots checked" (a shortlist of at most 6), with dots, resource mix and win chance after each pick;
  - "Followed?" chips;
  - an advice line ("Take ore with pick 1: 6% more win chance") only when the gap is 5% or more and the pick adds a resource.
- Full Lesson 3, "At this point in the game":
  - per phase, a reusable coach rule with its phase cost and chips linking to the turns;
  - a rule shows only when a clear error in that phase broke it;
  - chips carry the visible points at that turn ("8 of 10 visible points");
  - the reconcile line "−59% and −9% = −68%" shows that phase costs plus small moves equal the total.
- A teaser for Lesson 1 links to the Moves tab. There is no "Take with you" here; it lives only on Overview.

**Analysis blocks**
- **Tempo:** game points per phase, as bars only, with no win-chance chart.
- **Build timeline:** per player, with dorp/stad/weg/kaart glyphs.
- **Income per resource:** per player.
- **Measures table:** you vs the table, with ▲▼. The best value in each row is underlined.
- **Rival card:** compares you with the opponent who out-scored you in your weakest phase, never with the last-place bot.

### History/Terugblik (06)

- Scrub chart with marks per game.
- "Most missed", with dots per game.
- Unfoldable game rows.
- Average Precisie over the reviewed games, e.g. "63 over 8 games". Never a sum of %.

### Bots (07 strength, 07b precision, 07c you vs them)

- **Strength (07):** a ladder with whiskers and a "You" diamond.
- **Precision (07b):** a scatter readable at 360, with overlapping glyphs merged into a count chip.
- **You vs them (07c):** per level, won x of n, a Wilson range whisker, and your Accuracy in those games.
- **Wording:** bot precision bands are always a range ("usual 50–60"). Chips are unambiguous ("Master wins 56% vs Medium").

### Bekijk bord (08, 08b)

- A dock slot opens a board screen with a scrubbable timeline.
- Stops: a Start stop that rings your two picks (dashed, 1 and 2) and the Top spot (A) with their win chances, then one stop per key moment.

### Missing data

- Hide a block gracefully when its data is missing. This covers old saved reviews, Rush, Seafarers and 5–6 players.
- Never show NaN, undefined or empty cards.
- Older saved reviews must still open.

## Data layer (to rebuild; first build passed 1517 checks)

### Files

| File | Holds |
|---|---|
| `src/review/coach-rules.js` | `RULES` table, `THRESHOLDS` relative to target, `phaseLimits(nTurns)` (dynamic thirds), `phaseOf`, `turnsOf`, `firedRules(ds, {stats, n, me, target})`, points helpers |
| `src/review/analysis-facts.js` | game facts, decision splits, start review, tempo, verdict, bots helpers, sheets, `analyseGame` |
| `src/review/analysis-text.js` | EN/NL key tables with `tr()`; no robber, port, road-race or fed strings |

### coach-rules.js

- `RULES`: each rule has id, phase, `when(m, ctx)`, chip and text key.
- `firedRules` fires a rule only for a clear could/mistake/blunder/missed decision in its own phase. It never fires on near-equal choices.
- Points helpers:
  - `pointsLog`/`pointsBefore`/`visibleSeries`: visible points by replaying the log. This is exact.
  - `vpSeries`: `stats.vp[step]` minus hidden victory-point cards. It has transient off-by-one errors in the 6-player special build phase.

### analysis-facts.js

**Game facts**
- `buildFacts(stats, n)`: builds, cards bought, bank and player trades, first city.
- `startFacts`: start dots and income per resource via `incomeAt`.
- `tempo`: points and gains per phase.
- `rivalPhase`: the phase you trailed most, and the opponent who gained most there.

**Decisions**
- `decisionsOf`.
- `splitMoves(ds)`: exclusive pillars {errors, start, other, total, headline, capped, counts}.
- `phaseCosts`: costs per phase plus `small`, which add up to the total.
- `realErrors`: errors, not-errors, small and trivial moves. The UI header uses `counts`.
- `isError` / `errorRule`.
- `nextBestGain` / `bestMoves`.
- Classes come from `clsOf`. "missed" is only possible for end or bank moves whose best option is a build or card.

**Board and start**
- `spotOf` / `planFromSpot`.
- `startReview(ds, board, min=5)`.
- Set-up candidates come from `review/evaluate.js` `cands` (shortlist ≤ 6; `cands[0]` = the move played; `derive` ignores n < 2).

**Verdict and text**
- `headline` / `verdictLine` / `verdictText`.
- `numbersSheet`: values are finite or null.
- `infoSheet`.

**Bots**
- `wilsonPct` / `youVsLevel`. Wilson also exists in `lessons-eval.js` and `lab-stats.js`.

**Luck and the screen object**
- `luckBalance` / `balanceLuck` exist but are NOT used for display (PO decision).
- `analyseGame({...})` is the one object the screens read. Compute it once per review and cache it.

### Piece kind and better-move kind

- Use `kindOf` (export it from `lessons-row.js`) for the kind of the move played.
- `bestKindOf(label)` handles labels like "Trade X, then City on ..." by taking the kind after "then".

## Coach rules calibration (open)

On 6 real reviewed games (25 seat views), the first three rules rarely fired: `missing-resource` 1/25, `city-at-half` 0/25 and `last-point` 0/25. So the rule set needs real data:

1. Generate at least 30 reviewed 4-player games by driving the real app (bot games plus the in-app review), including weaker bots.
2. Tabulate the real errors by phase and kind.
3. Redesign the set to 2–4 rules per phase, so that in most games with a clear error in a phase that phase shows a lesson.

The headless lab sim bypasses the review recorder, so it cannot be used.

## Tests (required)

- `tests/analysis199.js`: data-layer invariants on real fixtures:
  - pillars and phase costs reconcile;
  - lists equal their headers;
  - a close call is never an error;
  - EN and NL keys match;
  - no NaN/undefined/null/[object anywhere;
  - Wilson stays within 0..100;
  - visible points from the log equal `stats.vp` minus hidden victory-point cards.
- `tests/analysis199-ui.js`: every screen at 360 and 412, EN and NL, light and dark:
  - no overflow, text ≥ 11.5px, taps ≥ 40px;
  - numbers consistent across screens;
  - no zero-sum claim;
  - no robber, port, road-race or fed strings.
- The golden suite must be ALL 37 MATCH, plain and with `--host`. Never use `--force`.
