# Headless bot tournaments

`node scripts/tournament.mjs` plays thousands of bot-vs-bot games in Node (no browser), on the same seeded harness as the golden net (`tests/golden/lib.mjs`: real `src/game.js`, one seeded `Math.random`, search bots with counted budgets, virtual clock for Rush). Bot behaviour is untouched.

```
node scripts/tournament.mjs --bots expert,master,rules --games 2000 --mode classic --seats 4 --seed 1 --workers 4 --out results.jsonl
```

| flag | meaning |
|---|---|
| `--bots a,b,c` | presets of `AI_PRESETS` (`beginner simple intermediate expert trader builder shark`) and the search bots `master super superplus grandmaster` (the fixed counted budgets of `lib.mjs`, not the app's). `rules` = alias of `simple`. Selection lives in one function (`botSpec`) so it can move to `src/bots/registry.js`. |
| `--games N` | total games (default 100) |
| `--mode` | `classic` (default, 4 seats), `rush` (4), `seafarers` (3), `56` (5 or 6 seats, `--seats`) |
| `--seats S` | seats per game |
| `--seed K` | base seed; same args give the same games, whatever `--workers` is |
| `--workers N` | worker threads (default: all cores) |
| `--out f.jsonl` | one line per game; rerunning with the same args **resumes** (a torn last line is replayed; other args on the same file are refused) |
| `--anchor bot` | rating anchor (that bot = 1000); default: mean of the bots = 1000 |
| `--dump-states` | also write training rows (needs `--out`), `--dump-every K` turns (default 4) |
| `--quiet` | no progress line |

## Seats and boards
Game `i` uses bot list rotated by `i % nbots` (seat `s` gets `bots[(i+s) % nbots]`), so every bot sits in every seat equally over `nbots` games (use a multiple of it). The board seed is shared by the `nbots` rotations of one cycle (paired boards, less variance). Consequence: games of one cycle are not independent, so the confidence intervals are slightly optimistic. With more seats than bots a bot can sit twice in a game; its win rate is wins per seat played.

## Output line
`{"game":0,"seed":..,"mode":"classic","bots":[per seat],"winner":seat|null,"points":[per seat],"turns":18,"ms":66}` (`turns` = the game's turn counter at the end; `ms` = wall time of that game, the only non-reproducible field).

## Summary
Per bot: seats played, wins, win rate with 95% Wilson interval, average points, rating, win rate per seat; plus win rate per play-order seat, average turns, games/s.

Rating: Plackett-Luce (Bradley-Terry for one winner), the model of the Bots page (`src/bot-stats.js`): P(seat wins) = softmax of the ratings, Elo scale (+400 = 10x the odds), fitted by MM iterations over all games (half a virtual win keeps a 0-win bot finite), 95% interval from a 200-resample bootstrap over games (fixed seed). The page anchors Medium = 1000; here use `--anchor intermediate` to get comparable numbers when Intermediate is in the field.

## Training rows (`--dump-states`)
The repo has no training data format in this tree (the GBM was trained offline, `exp/vm-120/train.py`, not present), so the rows use the model's own features: `<out>.states.jsonl`, one row per seat per sampled turn (not in Rush):
`{"game","turn","seat","x":[features],"vp","y":1|0 (that seat won),"final":final points,"sea":bool}`.
`x` = `gbmFeatures(g)` (`GBM_NAMES`, 74) or, on a Seafarers board, `gbmFeaturesSea(g)` (`GBM_NAMES` + `SEA_NAMES`). The names are in `<out>.states.names.json`. Rows join to the game line by `game`.

## Test and speed
`node tests/tourn196.mjs` : same args twice, workers 1 vs 4, resume and seat balance must give identical games.
