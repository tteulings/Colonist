# v1.99 post-game glossary: one definition per number

Every number on a post-game screen is a fact of ONE store (`src/post-facts.js`, built with the model in `src/post-model.js`, one store per review and seat).
A fact is `{ id, seat, unit, value, label, source }`. The screens never calculate a displayed number: they ask the store for a fact id and the formatter writes it by its unit.
Every rendered number carries `data-fact="<id>:<seat>"`; `tests/facts199-ui.js` fails on any visible number that is not a fact (explicit allow-list inside the test).

If a definition here conflicts with an older rule in `analysis-v199.md` or `decisions-v199.md`, this file wins and the conflict is listed at the bottom.

## Units and how they are written

| unit | what | EN example | NL example | rule |
|---|---|---|---|---|
| `wc` | a win chance | `38%` | `38%` | whole percent, never signed |
| `wcDelta` | a change of win chance (a cost, a swing, luck) | `+7%` / `−8%` / `±0%` | same, decimal comma if needed | always signed, real minus sign (U+2212); a pill shows ▲ (green) for plus and ▼ (tinted red) for minus, for every player; `±0` is neutral. With the word: `+7% win chance` / `+7% winkans` |
| `lead` | how far a best move was ahead of the next option, in win-chance points | `+17% lead` | `+17% voorsprong` | written with the % sign and the word lead / voorsprong, never as a plain win chance (it is a gap between two options, not a chance) |
| `pts` | game points | `3 points` / `3` | `3 punten` / `3` | whole numbers; "points" always means game points (visible points before the end; hidden point cards only in the final score) |
| `count` | a count | `12 dots`, `3 turns` | `12 stippen` | whole numbers; ordinal form `1st` / `1e` for ranks |
| `cards` | a card difference against expectation | `+2 cards`, `1 card` | `+2 kaarten`, `1 kaart` | signed, singular for 1; spelled out as `Cards from dice: −6 cards against expected` / `Kaarten uit dobbelstenen: −6 kaarten t.o.v. verwachting` |
| `acc` | Accuracy 0 to 100 | `90` | `90` | no unit sign; the word is `Accuracy` / `Precisie`, no other accuracy word |
| `turn` | a turn number | `Turn 12` | `Beurt 12` | label only (allow-listed in the audit) |
| `margin` | the ± of one move | `±1.5%` | `±1,5%` | win-chance points; one decimal |
| `rate` | win chance lost per scored move | `0.2%` | `0,2%` | one decimal |

Numbers are written in the language's style (Dutch decimal comma). A fact id renders with the same digits and sign on every screen.

## Concepts

| id (store) | NL label | EN label | unit | sign | definition | source |
|---|---|---|---|---|---|---|
| `winkans` (`pick*.win`, `end`, `mv.<i>.B`, `tl.from/to`) | Winkans | Win chance | wc | none | The review's estimate of the chance to win, in percent, after a given move (`B`) or at the end of your last move. The best alternative's value is `A`. | review results `win`; `score.js decide` |
| `fair` | Eerlijk deel | Fair share | wc | none | The seat's start win chance before anything happened: 100 / number of players (25% at 4). | `decide` `base` |
| `startCost` | Startkosten | Start picks | wcDelta | ≤ 0 | The RAW win-chance difference between your start picks and the best spot checked for each pick (A − B), summed over both picks. Never corrected for noise, never scaled by the cap. Shown negative. | `analysis-facts bySeat.raw.start`, `post-facts costOf` |
| `moveCost` | Zetkosten | Moves | wcDelta | ≤ 0 | The cost of ALL your scored moves after the start, against best play (the sum of every move's gap). Together they cannot cost more than the best win chance you held (the cap); the note "Together your moves cannot cost more than …" shows when that bound applies. | `costOf` |
| `movesTotal` | Zetten totaal | Moves in total | wcDelta | ≤ 0 | `startCost + moveCost`. The one number that the headline, the connecting line, the tiles, the Moves tab, the player page and the Numbers sheet call the cost of your own play. | `costOf` |
| `errCost`, `otherCost` | Echte fouten, Overige zetten | Real errors, Other moves | wcDelta | ≤ 0 | The two parts of `moveCost`: clear errors after the start, every other scored move. `errCost + otherCost = moveCost`. | `costOf` |
| `phase.<k>` | Opening / Middenspel / Eindspel | Opening / Midgame / End | wcDelta | ≤ 0 | The real errors of one phase (dynamic thirds); the three add up to `errCost`. | `post-facts` |
| `luck` | Geluk | Luck | wcDelta | either | Dice + steals + drawn cards + seat order, per seat, as win chance. Each seat is its OWN estimate: unbalanced, no zero-sum claim anywhere. Seat order is zero-sum on its own (`lkSeat`). | `luckSplit` |
| `others` | Wat de anderen deden | What the others did | wcDelta | either | The remainder of the waterfall (one row; its sub-line is only a PART of it: `of which {y}'s rolls (turns 2 and 14): +21%`): `end − fair − startCost − moveCost − luck` (their moves and luck plus what the estimates cannot tell apart). Muted, hatched, never used as a cause in the headline. | `waterfall` |
| `lead.<i>` | Voorsprong | Lead | lead | + | How far a best move was ahead of the next option, in win-chance points (`+17% voorsprong`). A decision's own quantity, not the chance of winning. | `nextBestGain` |
| class "Real error" (`errors`) | Echte fout | Real error | count | – | A mistake, a blunder or a missed chance: a gap of at least twice the move's own margin (about 6% when none is stored). Start picks follow their own limits (could be better from 5%, mistake from 10%, blunder from 18%). A close call is never an error. | `isClearError` |
| class "Could be better" (`fam.could`) | Kan beter | Could be better | count | – | Every other weaker move that is not a real error. | `clsOf` |
| `margin` (`mv.<i>.margin`) | Marge (±) | Margin (±) | margin | ± | The move's own uncertainty. A gap under twice the margin is not an error. | `seOf` |
| `decisions`, `oneOption`, `scored` | Beslissingen: totaal, één zinnige optie, beoordeeld | Decisions: total, one sensible option, scored | count | – | `decisions` = every choice the recorder saw; `oneOption` = those with one sensible option (not scored); `scored` = the rest. `decisions = oneOption + scored`; `scored = errors + startN + otherN`. | `realErrors`, `post-facts` |
| `pts`, `src.<kind>`, `tempo.<phase>` | Punten | Points | pts | – | Game points: final per seat, per source (settlements, cities, …), gained per phase. "Visible points" at a turn exclude hidden point cards (replayed from the log). | `stats`, `tempo` |
| Accuracy (`acc`) | Precisie | Accuracy | acc | – | How often a seat was near the best move; 0 to 100. Shown for ALL seats. Not a win chance and not summed over games. | `summarize` |
| `pick<n>.dots`, `…bestDots` | Stippen | Dots | count | – | How often a start spot's numbers roll, summed (more dots = more income). Explained once on each start card. | `spotOf` |
| `mom.<step>.d/.move/.dice/.rest` | Beurt-uitslag (zet / worp / rest) | Key moment (move / dice / rest) | wcDelta | either | One step's swing of the seat's win chance, split in what the seat's own move did, what the roll did and the rest. `move + dice + rest = d`. | `swings` |
| `hl.rolls` | Worpen van X | X's rolls | wcDelta | either | The dice parts of the key moments rolled by ONE other player, on the side of the result (8% or more together). Shown in the headline and on the Others row. | `headPlan` |
| Precisie (the word) | Precisie | Accuracy | – | – | The only accuracy words. | – |
| `lim.*`, `target`, `ph.<k>.from/to` | Grenzen | Limits | count / wc / turn | – | Constants the texts quote (error rule 6%, start limits, phase ranges, win target, number of turns), so even a rule's number is a fact. | `post-facts` |

## The waterfall (Overview) and the headline

`fair + startCost + moveCost + luck + others = end`, exactly, in whole percent. Own steps (start picks, moves, luck) are tinted ▲▼ pills; `others` is hatched and muted.
Sub-lines (one checkable fact each): start picks (`pick 1 29% instead of 38%`), moves (`biggest miss: turn 13, … ( −4% )`), luck (`biggest roll: Groen rolled 6 in turn 14 (+12%)`), others (`Groen's rolls in turns 2 and 14: +21%` when the headline names them).

The headline leads with the biggest OWN-controlled part (start picks, the biggest single miss, or the best move when it is worth 8% or more), names luck only when it is large (own luck 8% or more, or one other player's rolls 8% or more on the side of the result) and then with the roller's name, all in win chance. Every number in it is the same fact id as a row of the waterfall or a key moment.

## Conflicts with earlier rules (flagged, not invented)

1. `analysis-v199.md` "Ledger": "Set-up is the seat plus your two start spots". Since round 6 the seat order is part of Luck ("ONE luck number"), so Start picks are the picks only. This file follows round 6 (and the Variant C README).
2. `analysis-v199.md` "Pillars … Start picks −6%" and the earlier "measured −11%, counted −9%": the start cost was scaled together with the other moves when the cap applied. Now the start is raw and only the moves after it are capped. The pillar numbers can therefore differ from v1.99 round 8 in the 8 of 37 calibration games where the cap binds (e.g. `s101`: the start now shows its raw −29%).
3. `analysis-v199.md` "Moves cost = what every miss lost". The Moves tab used to call `start + moves` "Moves cost" while the ledger tile called `moves` "Moves". Now: `startCost`, `moveCost`, `movesTotal`, three names, one meaning each.
4. `analysis-v199.md` headline example "the others fell away (+111%) and luck helped (+51%), despite 68% lost to your moves" is superseded by the PO-approved headline (own part first, luck only when large and with the roller's name); `others` is never a cause in a headline of a win.
5. `analysis-v199.md` Moves tab "Best moves: with the next-best gain" used "+14%": round 1 made it `+14 lead` (no %); round 2 (check 7.0) writes `+14% lead`, because it is a win-chance gap and a unit-less number next to % elsewhere read as a different quantity.
6. `decisions-v199.md` "Luck is shown as win chance … with a Cards switch": kept. Steals, discards and the 7 stay in win chance in Cards mode; a turn group is in cards when one of its events has a card figure, else in win chance (before, one group could sum cards and win chance).
7. The review engine's own explanation sentences ("Reaches Grain 4, Grain 10 (this road, 8 dice dots)", `src/review/why.js`) contain tile numbers and dot counts that are not yet facts: marked `data-explain` and allow-listed by the audit. Open item.
8. Round 2 (check 7.0): the minus sign is U+2212 everywhere; a move row's class word is neutral when the shown cost is negative (never a green word next to a red number); "Small differences" lists the close calls and is hidden when there are none; on a bot's page the human player is "the human player" (never "you"); move labels and the engine's why sentences are written in the app language by `src/post-text.js` (ports, Longest road, Largest army and robber items are dropped, a fragment the grammar does not know fails `tests/text199.js`).
