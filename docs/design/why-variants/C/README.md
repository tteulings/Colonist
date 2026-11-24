# Variant C "Waterval" (waterfall): why you won / lost

A vertical waterfall on the win-chance axis, from your fair share (25% at 4 players) to the end. Four steps, then the end row. One sentence on top.

## Rule (all numbers are the app's own `m.led`, i.e. `ledgerOf` in `analysis-facts.js`)

Fair share + Start + Your moves + Luck + What the others did = End, exactly (whole percent; "others" is the remainder, so it always closes). The extractor asserts the sum for all 39 games (`sums-all-39-games.txt`, 0 failures).

| Row | Value | Sub-line (one fact, checkable elsewhere) |
|---|---|---|
| Start | `led.setup` = minus the cost of the start picks (Strategy "Start picks") | worst pick: "start picks: 29% instead of 38%" (Strategy, Bekijk bord) |
| Your moves | `led.moves` = minus real errors minus other moves (Moves tab total) | costliest non-start move: "biggest miss: turn 13, X instead of Y -4%" (Moves, "Biggest misses") |
| Luck | `led.luck` = Luck tab total incl. seat order | biggest roll (not a 7) on the side of the luck total: "biggest roll: 6 in turn 14 +12%" (key-moment dice component) |
| What the others did | `led.rest` | fixed text: their moves and luck, plus the remainder |

Top sentence: the larger of the two own-controlled steps (Start vs Your moves, both are costs against best play, so both are <= 0): "Your biggest own loss: your start picks (▼ -9%)." For moves it adds "mostly turn N" when the single move is >= 3%. If both are above -3%: "Your own choices cost little (▼ -4%)."

Seat order is part of Luck (as everywhere in v1.99, "ONE luck number"), so Start is the picks only. This differs from the brief's "Start (seat + picks)" on purpose: Start and Luck then equal the numbers on Strategy and the Luck tab.

Display: bars float from the running total to the new total on one common 0-100% axis (dashed tick = where the step starts). Own steps use tinted bars (never solid red) with ▲▼ pills (green/red). No percent is ever summed across games.

## Scale and the "others" step

In a win from 25% to 100% the remainder is easily +88%: bigger than everything the player did. To keep it from reading as "the others beat/lost it for you":
- hatched, grey, outlined bar, grey title (the only non-attributed row), on the true scale (never shrunk or clipped);
- its sub-line says it is the remainder (their moves and luck, plus what the estimates cannot tell apart);
- the sentence on top never names it (only own-controlled steps).
The pill keeps ▲▼ colour (rule), but the row title is muted.

## Files
- `extract.cjs`: headless Chromium on the real app (`node tests/serve.mjs $S/post199 8910`; `S=<scratchpad> node extract.cjs`). Loads the 2 fixtures + 37 calib games, opens the review, calls `modelOf` and replicates `swingsFor` for the roll/move names. Writes `data/<game>.json` (only 6 kept here; all 39 sums in `sums-all-39-games.txt`).
- `build.cjs`: data -> self-contained HTML (`html/<game>-<nl|en>-<light|dark>.html`, no external requests). `shot.cjs`: screenshots + checks (no horizontal scroll, text >= 11.5px, sub/sentence <= 2 lines; 360x780 dsf2 and 412 for r1/r2 nl-light).
- Games: `r1` = win (10-7, 25 -> 100), `r2` = loss; `s1, s103, s122, s127` = extra calib games (all lost; s1 has no move miss >= 1%, s122 has luck +51% and others -57%, s127 ends at 6%).
- Shots: `shots/*-360.png` (dsf2), `*-412.png`. The block has no tap targets (rows are not interactive; a "Cijfers" button would come from the shell).

## Pros
- Shows the arithmetic: every % on screen adds up to the end; the audience sees where 25% went.
- Start, moves, luck and others have equal visual grammar; own-controlled vs not is visible at a glance (muted hatched bar).
- Sub-lines name one concrete, checkable thing each (pick, turn, roll).

## Cons
- Tall (~600px at 360): the heaviest of the variants; needs the fold or a compact mode.
- "Your moves" is a cost against best play (always <= 0), so a win still shows ▼ for own steps; a good move (+X) is never shown. Needs a one-line "how to read".
- The remainder is large and unexplained by nature; the sub-line is honest but not insightful.
- The Luck sub-line (biggest roll +12%) can sit under a step of +1%, since other rolls offset it.

## Edge cases
- Running total can leave 0-100% (e.g. s128: 25, 25, -56, -96): the axis widens to the real range, so extreme games get thin bars. Alternative: clip with a marker.
- End is not always 0/100: r2 ends at 39% ("After your last move", "then you lost"); s127 at 6%. Rows with end <= 3% or >= 97% read "End: won/lost".
- No move miss >= 1% (s1): "no miss of 1% or more". Start 0: "start picks fine" and a thin neutral bar for ±0%.
- No luck data / unreviewed game: `led` is null, so the block must be hidden (never NaN). No roll found: "no big roll".
- Kinds not in dorp/stad/weg/ontwikkelkaart/bankruil/end fall back to "weaker move".
- 5-6 players: fair share is 1/n (20%, 17%); works unchanged. Rush/Seafarers: hide if `led` is missing.
