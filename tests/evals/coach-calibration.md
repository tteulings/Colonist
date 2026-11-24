# v1.99 Faseregels: calibration on calib199 (37 reviewed games, 148 seat views, 6182 decisions)

Clear error = `isClearError` (class could/mistake/blunder/missed, clear verdict, in scope, not a set-up pick): **234** (seat 0 scripted: 80, weak bots beginner/simple/intermediate: 101, strong bots: 53). Phases are the dynamic thirds. Weak bots are the learner proxy; seat 0 errors are partly artificial.

## 1 Error table
| | opening | mid | end | all |
|---|---|---|---|---|
| clear errors | 65 | 84 | 85 | 234 |
| seat 0 / weak / strong | 29 / 25 / 11 | 30 / 35 / 19 | 21 / 41 / 23 | 80 / 101 / 53 |
| played = End turn | 20 | 36 | 33 | 89 (38%) |
| better = play a dev card ("Play X") | 4 | 22 | 16 | 42 |
| better = buy a dev card (incl. trade first) | 13 | 20 | 14 | 47 |
| better = trade then settlement/city | 9 | 10 | 9 | 28 |
| road played, other road better | 22 | 10 | 9 | 41 (18%) |
| seat has a resource with no income at that moment | 47 | 61 | 40 | 148 |

Other facts: visible points relative to target at the error are low (opening < 0.3 of target: 41 of 65; mid 0.3 to 0.5: 48 of 84; end 0.5 to 0.7: 48 of 85; only 5 errors at >= 0.9), so "points near target" is a rare condition (only the last-point rule uses it). A bank trade was the move played in 35 errors (8 / 12 / 15). A city was played and a dev card was better in 7. A city was the better move (as such or after a trade) in few errors, which is why city-at-half is dropped.
Dominant pattern: **doing too little in the turn: ending it (38%), or trading/building small, while a dev card could be played (18%) or bought (20%) or a trade + build was available (12%)**. Second: **the wrong road** (41 road-vs-road errors, 18%).

## 2 Rules (data table `RULES` in `src/review/coach-rules.js`; `THRESHOLDS.lastGap` 1 -> 2)
| id | phase | fires when (clear error and ...) |
|---|---|---|
| missing-resource | opening | you have a resource with no income and the better move is a bank/trade move or builds/heads to that resource |
| open-spend | opening | you ended the turn, the better move was any action |
| open-road-resource | opening | road vs better road; the better road names a missing resource yours does not |
| open-trade-settle | opening | better = trade then settlement, you did something else |
| mid-play-card | mid | better = play a dev card, you did not play one |
| mid-buy-card | mid | better = buy a dev card (maybe after a trade), you did not |
| mid-spend | mid | you ended the turn, better = build or bank trade |
| mid-trade-build | mid | better = trade then settlement/city, you did something else (not ending the turn) |
| last-point | end | points >= target - 2 and better = settlement, city or buying a dev card |
| end-play-card | end | as mid-play-card |
| end-spend | end | you ended the turn, better = build, bank trade or buy a dev card |
| end-trade | end | better = trade then build / bank trade, you did not end the turn |

EN/NL sentences: `rule.*.text` in `src/review/analysis-text.js` (the chip `rule.pts.chip` = "{pts} of {target} points", missing/road rules `rule.missing.chip` "No {res}"). Out of scope kept: nothing reads ports, robber targets, longest road / largest army, or trades with players.

## 3 Firing and coverage
Per rule (148 seat views; "views" = seat views where it fired, "moments" = errors it fired on):
| rule | views | % of views | moments |
|---|---|---|---|
| missing-resource | 19 | 12.8 | 22 |
| open-spend | 16 | 10.8 | 20 |
| open-road-resource | 8 | 5.4 | 9 |
| open-trade-settle | 5 | 3.4 | 6 |
| mid-play-card | 11 | 7.4 | 19 |
| mid-buy-card | 18 | 12.2 | 19 |
| mid-spend | 11 | 7.4 | 15 |
| mid-trade-build | 8 | 5.4 | 8 |
| last-point | 4 | 2.7 | 4 |
| end-play-card | 9 | 6.1 | 13 |
| end-spend | 14 | 9.5 | 21 |
| end-trade | 10 | 6.8 | 12 |

At least one rule fired in 74 of 148 seat views (50%; the other views have no clear error in a covered pattern or none at all). Before: 1 of 25 on the small sample, here the old rules fired in about 30 of 148 views.

Coverage = share of (seat, phase) with >= 1 clear error where a rule of that phase fired:
| phase | seat-phases with an error | covered | |
|---|---|---|---|
| opening | 49 | 32 | 65% |
| mid | 55 | 42 | 76% |
| end | 45 | 29 | 64% |
| all | 149 | 103 | **69.1%** (seat 0 65%, weak 73%, strong 68%) |

Share of clear errors that a rule fired on: 145 of 234 (62%). The rest are mostly other-road choices and rare patterns.

## 4 False-fire check (two random samples of 15 firings, 30 total; sentence vs move)
Sample 1 found 2 misfits (missing-resource fired when the better move was a plain dev card / play card; fixed by requiring a trade or the missing resource in the better move). Sample 2, after the fix, with the final conditions:
fits: mid-spend (road, trade+settlement), 3x mid-play-card (end turn, Play Monopoly), mid-play-card (bank trade played, YoP better; wording "instead of leaving it in your hand" now fits), mid-play-card (bought a card, Knight better), end-trade (dev card played, trade + city better), missing-resource (trade + settlement better at turn 3), last-point (9 of 10, trade + settlement), end-spend (trade + settlement), open-spend (dev card), open-road-resource (road to Ore/Wool vs Grain/Lumber), end-play-card (blunder, -37%), mid-buy-card (trade then dev card; text reworded to "when you can pay for it").
Verdict: 13 of 15 fit exactly, 2 fit loosely before the wording was relaxed (both rewritten); 0 wrong-pattern firings left in sample 2. Sample 1 (before the missing-resource fix): 13 of 15 fit, 2 misfits (fixed). A remaining weakness: missing-resource names the first resource with no income, which is not always the one the better move addresses when it is a pure trade.
