// v1.23 The numbers behind the Bots page (leaderboard, strength ladder, strength-vs-accuracy chart), in ONE place.
// Every number says what it is: value, interval, n, how it was measured, which code version, when, and a label:
//   "measured"    an experiment of exactly this set-up
//   "estimate"    worked out from other experiments, NOT a measurement (the source says how)
//   "early test"  a first run, not final
//   "unknown"     no number yet
// Classic island, 4 players (10 VP): every bot. v1.34 Rush, 5 players, 6 players and Seafarers: the Expert, the Master and the
// Super Expert+ (MODE_STATS); every other bot there is "not measured".
// To re-measure (the scoring bots' figures are from the v1.03 code; Master and the Super Experts from bot-125): replace the entry, keep the set-up text honest, change code/date.
// Review accuracy lives in review/bands.js (one source with the review screen); its SE and n are read from there.
import { botBand } from "./review/bands.js";

export const SETUPS = {
  vs3int: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 2000 games (500 boards x 4 seats, paired seeds, seat rotated). 95% interval.",
  vsExpert: "One Master against 3 Experts, Classic island, 4 players, 10 VP, same seat as the Expert it is compared with. 500 games (common random numbers). 95% interval.",
  vs3intMaster: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 800 games (200 boards x 4 seats, paired seeds, seat rotated). The Master searches as in the app (100 futures, at most 0.5 s). 95% interval.",
  vs3intFixed: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 400 games (100 boards x 4 seats, paired seeds, seat rotated). Searched WITHOUT a time limit, with a fixed budget (1000 futures, 14 turns deep, 18 in set-up, early stop), so the machine's speed does not change the result; in the app the search stops at 3 s. 95% interval.",
  vs3intApp: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 200 games (50 boards x 4 seats, paired seeds, seat rotated). Searched with the app's budgets counted in futures (Super Expert and Super Expert+ 545 a move, Grandmaster 1090, 14 turns deep, 18 in set-up, early stop) on the app's clock rules, so the figure is what the app plays. 95% interval.",
  h2h: "Super Expert, Super Expert+ and 2 Experts at one table, Classic island, 4 players, 10 VP; per board 8 games (4 seat orders, the two Supers swapped). Both without a time limit. 95% interval.",
  review: "The bot's own moves scored by the deep review check (k 0.10), 300 positions, the seat plays on as Expert. Bootstrap standard error (SE).",
  vsExperts: "One bot against 3 Experts (the best bot without a search), Classic island, 4 players, 10 VP: 50 boards x 4 seats, seat rotated, the same boards as against the Intermediates; the search bots with the app's budgets (Master 100 futures a move, Super Expert and Super Expert+ 545, Grandmaster 1090). A fair share is 25%; the Expert itself is 25 by construction. 95% interval.",
  rating: "One number from every table measured in Classic (against 3 Intermediates, against 3 Experts, the head to heads Super Expert / Super Expert+ and Grandmaster / Super Expert+): the chance to win a game is the softmax of the players' ratings (Plackett-Luce, Bradley-Terry for one winner), Elo scale (+400 = 10x the odds), Intermediate = 1000, ± 95% bootstrap over the games. The search bots at the app's budgets.",
  // v1.34 the other game types (scratchpad eng130/h/rate: gm.mjs runs, one jsonl line per game). Expert, Master and Super Expert+ played the
  // same boards and seats, so each is also compared with the Expert in the same seat (paired).
  modeRush: "One bot against 3 Intermediate bots, island, 4 players, 10 VP, Rush searched as turn-by-turn play (the way the bots see Rush): 50 boards x 4 seats, seat rotated. The search gets what a phone does in a quarter of a second (about 20 futures, an estimate), the set-up its full budget. Not modelled: the clock itself. 95% interval.",
  modeFive: "One bot against 4 Intermediate bots, island, 5 players, 10 VP: 40 boards x 5 seats, seat rotated. The search bots with the futures a move shown in the table (the app's: Master 100, Super Expert 545, Grandmaster 1090; the Super Expert+ was measured at 1000, not the app's 545), no time limit for the 1000-future run, the others with the app's clock. 95% interval.",
  modeSix: "One bot against 5 Intermediate bots, island, 6 players, 10 VP: 34 boards x 6 seats, seat rotated. The search bots with the futures a move shown in the table (the app's: Master 100, Super Expert 545, Grandmaster 1090; the Super Expert+ was measured at 1000, not the app's 545). 95% interval.",
  modeSea: "One bot against 3 Intermediate bots, Seafarers (Heading for New Shores), 4 players, 14 VP: 50 boards x 4 seats, seat rotated. The search bots score futures with the Seafarers model; futures a move as shown in the table (the app plays Master 100, Super Expert and Super Expert+ 182, Grandmaster 363 there; the Super Expert+ was measured at 1000, no time limit). 95% interval.",
};
const WIN = (p, ci) => ({ v: p, ci, n: 2000, setup: "vs3int", code: "v1.03", date: "2026-11-04", label: "measured" });

/** Classic, 4 players. win.v = percent, win.ci = ± 95% (measured only). */
export const BOT_STATS = {
  simple: { win: WIN(4.7, 0.9) },
  beginner: { win: WIN(11.2, 1.4) },
  intermediate: { win: WIN(25.0, 1.9) },
  shark: { win: WIN(28.8, 2.0) },
  trader: { win: WIN(29.1, 2.0) },
  builder: { win: WIN(36.7, 2.1) },
  expert: { win: WIN(41.1, 2.2) },
  // bot-125 MEASURED in the standard set-up (vs 3 Intermediates, paired seeds, seat rotated). The Super Experts searched WITHOUT a time
  // limit (fixed budget), so machine load did not change their strength; in the app they stop at 3 s. Master as in the app (0.5 s cap).
  // Expert keeps its 2000-game figure; on the same 800 boards as the Master it won 40.9% (±3.4).
  master: {
    win: { v: 55.6, ci: 3.4, n: 800, setup: "vs3intMaster", code: "v1.28 engine (bot-125)", date: "2026-11-09", label: "measured",
      src: "On the same 800 boards and seats as the Expert (40.9%): +14.8 pp (±4.3)." },
    vsExpert: { v: 8.4, ci: 5.4, n: 500, setup: "vsExpert", code: "v0.91", date: "2026-11-04", label: "measured", own: { v: 33.4, ci: 4.1 } },
  },
  super: {
    // v1.43 replaced: the figure of the app's budget (545 futures), 200 games (scratchpad eng130/runs/rate-classic-X5.jsonl)
    win: { v: 64.0, ci: 6.7, n: 200, setup: "vs3intApp", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured",
      src: "Measured at the app's 545 futures a move. Paired with the Expert on the same boards: +23.0 pp (±9.3). Earlier, at 1000 futures a move (no time limit): 71.0% (±4.4, 400 games)." },
  },
  grandmaster: {
    // v1.43 measured against 3 Intermediates at the app's 1090 futures; also head to head with the Super Expert+ (eng-130 E1 v2, scratchpad eng130/h/gm-app2)
    win: { v: 70.0, ci: 6.4, n: 200, setup: "vs3intApp", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured",
      src: "Measured at the app's 1090 futures a move. Paired with the Expert on the same boards: +29.0 pp (±8.3). Head to head with the Super Expert+ and 2 Experts at one table, Classic island, 4 players, 10 VP, every seat order with the two swapped (100 games), both at the app setting counted in futures (Grandmaster 1090, Super Expert+ 545 a move): Grandmaster won 48.0% (±9.8), Super Expert+ 25.0% (±8.5), the Experts 13.5% a seat; Grandmaster minus Super Expert+ +23.0 pp (±14.9 over 50 seat-swapped pairs); it finished above the Super Expert+ in 59.0% (±9.6)." },
    h2h: { n: 100, gm: 48.0, gmci: 9.8, sp: 25.0, spci: 8.5, diff: 23.0, diffci: 14.9, higher: 59.0, higherci: 9.6, setup: "h2hGM", code: "v1.31 engine (eng-130)", date: "2026-11-10", label: "measured" },
  },
  superplus: {
    win: { v: 69.0, ci: 6.4, n: 200, setup: "vs3intApp", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured",
      src: "Measured at the app's 545 futures a move. Paired with the Expert on the same boards: +28.0 pp (±8.7). Earlier, at 1000 futures a move (no time limit): 71.5% (±4.4, 400 games), a tie with the Super Expert at that setting (+0.5 pp, ±5.4). Head to head (Super Expert, Super Expert+ and 2 Experts at one table, every seat order with the two Supers swapped, 112 games, 1000 futures, no time limit): Super Expert+ won 41.1% (±9.1), Super Expert 28.6% (±8.4), the Experts 30.4%. Super Expert+ finished above Super Expert in 58.0% of the games (±9.0; 50% = equal). Per seat-swapped pair: +12.5 pp (±14.0). A slight lean toward Super Expert+, not significant." },
    h2h: { n: 112, sg: 41.1, sgci: 9.1, se: 28.6, seci: 8.4, higher: 58.0, higherci: 9.0, diff: 12.5, diffci: 14.0, setup: "h2h", code: "v1.28 engine (bot-125)", date: "2026-11-09", label: "measured" },
  },
};

/** v1.34 the other game types: one bot vs Intermediates (SETUPS.modeRush / modeFive / modeSix / modeSea), with n and ± 95%. vsE: the same
 *  boards and seats with the Expert there, paired difference in points. A bot not listed here is "not measured" in that tab. */
export const MODE_STATS = {
  rush: {
    superplus: { v: 63.5, ci: 6.7, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "20 futures (a quarter of a second)", vsE: {"v": 22.5, "ci": 9.4, "n": 200}, src: "Same boards and seats as the Expert: +22.5 pp (\u00b19.4)." },
    super: { v: 46.0, ci: 9.8, n: 100, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "20 futures (a quarter of a second)", vsE: {"v": 5.0, "ci": 13.5, "n": 100}, src: "100 games (25 boards), a run of half the size. Same boards and seats as the Expert: +5.0 pp (\u00b113.5)." },
    master: { v: 46.5, ci: 6.9, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "100 futures, 0.25 s cap", vsE: {"v": 5.5, "ci": 8.2, "n": 200}, src: "Same boards and seats as the Expert: +5.5 pp (\u00b18.2)." },
    expert: { v: 41.0, ci: 6.8, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "no search" },
    builder: { v: 34.0, ci: 6.6, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -7.0, "ci": 7.4, "n": 200}, src: "Same boards and seats as the Expert: -7.0 pp (\u00b17.4)." },
    trader: { v: 27.5, ci: 6.2, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -13.5, "ci": 8.4, "n": 200}, src: "Same boards and seats as the Expert: -13.5 pp (\u00b18.4)." },
    shark: { v: 32.5, ci: 6.5, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -8.5, "ci": 8.5, "n": 200}, src: "Same boards and seats as the Expert: -8.5 pp (\u00b18.5)." },
    intermediate: { v: 25.0, ci: 6.0, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -16.0, "ci": 8.6, "n": 200}, src: "Same boards and seats as the Expert: -16.0 pp (\u00b18.6)." },
    beginner: { v: 8.0, ci: 3.8, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -33.0, "ci": 7.9, "n": 200}, src: "Same boards and seats as the Expert: -33.0 pp (\u00b17.9)." },
    simple: { v: 3.0, ci: 2.4, n: 200, setup: "modeRush", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -38.0, "ci": 6.9, "n": 200}, src: "Same boards and seats as the Expert: -38.0 pp (\u00b16.9)." },
  },
  five: {
    grandmaster: { v: 54.0, ci: 9.8, n: 100, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "1090 futures", vsE: {"v": 28.0, "ci": 12.5, "n": 100}, src: "100 games (20 boards), a run of half the size. Same boards and seats as the Expert: +28.0 pp (\u00b112.5)." },
    superplus: { v: 51.0, ci: 6.9, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "1000 futures", vsE: {"v": 23.5, "ci": 9.3, "n": 200}, src: "Measured at 1000 futures a move (no time limit); the app plays 545 here (not re-measured). Same boards and seats as the Expert: +23.5 pp (\u00b19.3)." },
    super: { v: 44.0, ci: 9.7, n: 100, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "545 futures", vsE: {"v": 18.0, "ci": 12.6, "n": 100}, src: "100 games (20 boards), a run of half the size. Same boards and seats as the Expert: +18.0 pp (\u00b112.6)." },
    master: { v: 39.0, ci: 6.8, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "100 futures", vsE: {"v": 11.5, "ci": 8.6, "n": 200}, src: "Same boards and seats as the Expert: +11.5 pp (\u00b18.6)." },
    expert: { v: 27.5, ci: 6.2, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "no search" },
    builder: { v: 24.0, ci: 5.9, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -3.5, "ci": 7.7, "n": 200}, src: "Same boards and seats as the Expert: -3.5 pp (\u00b17.7)." },
    trader: { v: 24.0, ci: 5.9, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -3.5, "ci": 8.6, "n": 200}, src: "Same boards and seats as the Expert: -3.5 pp (\u00b18.6)." },
    shark: { v: 18.0, ci: 5.3, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -9.5, "ci": 7.3, "n": 200}, src: "Same boards and seats as the Expert: -9.5 pp (\u00b17.3)." },
    intermediate: { v: 20.0, ci: 5.5, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -7.5, "ci": 7.7, "n": 200}, src: "Same boards and seats as the Expert: -7.5 pp (\u00b17.7)." },
    beginner: { v: 6.0, ci: 3.3, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -21.5, "ci": 6.6, "n": 200}, src: "Same boards and seats as the Expert: -21.5 pp (\u00b16.6)." },
    simple: { v: 2.0, ci: 1.9, n: 200, setup: "modeFive", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -25.5, "ci": 6.5, "n": 200}, src: "Same boards and seats as the Expert: -25.5 pp (\u00b16.5)." },
  },
  six: {
    grandmaster: { v: 51.1, ci: 10.3, n: 90, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "1090 futures", prov: true, vsE: {"v": 31.1, "ci": 13.4, "n": 90}, src: "Provisional: the run was stopped at 90 games (204 planned). Same boards and seats as the Expert: +31.1 pp (\u00b113.4)." },
    superplus: { v: 51.5, ci: 6.9, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "1000 futures", vsE: {"v": 25.5, "ci": 8.8, "n": 204}, src: "Measured at 1000 futures a move (no time limit); the app plays 545 here (not re-measured). Same boards and seats as the Expert: +25.5 pp (\u00b18.8)." },
    super: { v: 44.1, ci: 9.6, n: 102, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "545 futures", vsE: {"v": 22.5, "ci": 11.9, "n": 102}, src: "102 games (17 boards), a run of half the size. Same boards and seats as the Expert: +22.5 pp (\u00b111.9)." },
    master: { v: 37.7, ci: 6.7, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "100 futures", vsE: {"v": 11.8, "ci": 7.8, "n": 204}, src: "Same boards and seats as the Expert: +11.8 pp (\u00b17.8)." },
    expert: { v: 26.0, ci: 6.0, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "no search" },
    builder: { v: 22.5, ci: 5.7, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -3.4, "ci": 7.0, "n": 204}, src: "Same boards and seats as the Expert: -3.4 pp (\u00b17.0)." },
    trader: { v: 19.1, ci: 5.4, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -6.9, "ci": 7.8, "n": 204}, src: "Same boards and seats as the Expert: -6.9 pp (\u00b17.8)." },
    shark: { v: 17.2, ci: 5.2, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -8.8, "ci": 7.1, "n": 204}, src: "Same boards and seats as the Expert: -8.8 pp (\u00b17.1)." },
    intermediate: { v: 16.7, ci: 5.1, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -9.3, "ci": 8.2, "n": 204}, src: "Same boards and seats as the Expert: -9.3 pp (\u00b18.2)." },
    beginner: { v: 1.5, ci: 1.7, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -24.5, "ci": 5.9, "n": 204}, src: "Same boards and seats as the Expert: -24.5 pp (\u00b15.9)." },
    simple: { v: 1.0, ci: 1.4, n: 204, setup: "modeSix", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -25.0, "ci": 6.0, "n": 204}, src: "Same boards and seats as the Expert: -25.0 pp (\u00b16.0)." },
  },
  sea: {
    superplus: { v: 70.0, ci: 9.0, n: 100, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "1000 futures", vsE: {"v": 46.0, "ci": 11.6, "n": 100}, src: "Measured at 1000 futures a move (no time limit); the app plays 182 a move in Seafarers (not re-measured). 100 games (25 boards), a run of half the size. Same boards and seats as the Expert: +46.0 pp (\u00b111.6)." },
    master: { v: 52.5, ci: 6.9, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "100 futures", vsE: {"v": 22.0, "ci": 9.0, "n": 200}, src: "Same boards and seats as the Expert: +22.0 pp (\u00b19.0)." },
    expert: { v: 30.5, ci: 6.4, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "no search" },
    builder: { v: 25.0, ci: 6.0, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -5.5, "ci": 6.4, "n": 200}, src: "Same boards and seats as the Expert: -5.5 pp (\u00b16.4)." },
    trader: { v: 29.5, ci: 6.3, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -1.0, "ci": 8.9, "n": 200}, src: "Same boards and seats as the Expert: -1.0 pp (\u00b18.9)." },
    shark: { v: 27.5, ci: 6.2, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -3.0, "ci": 7.7, "n": 200}, src: "Same boards and seats as the Expert: -3.0 pp (\u00b17.7)." },
    intermediate: { v: 25.0, ci: 6.0, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -5.5, "ci": 8.2, "n": 200}, src: "Same boards and seats as the Expert: -5.5 pp (\u00b18.2)." },
    beginner: { v: 4.5, ci: 2.9, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -26.0, "ci": 7.3, "n": 200}, src: "Same boards and seats as the Expert: -26.0 pp (\u00b17.3)." },
    simple: { v: 0.5, ci: 1.0, n: 200, setup: "modeSea", code: "v1.31 engine (eng-131)", date: "2026-11-11", label: "measured", fut: "scoring bot, no search", vsE: {"v": -30.0, "ci": 6.5, "n": 200}, src: "Same boards and seats as the Expert: -30.0 pp (\u00b16.5)." },
  },
};

/** v1.43 Classic, two more measures. VS_EXPERTS: one bot against 3 Experts (the best bot without a search), the same boards and
 *  seats as the runs against Intermediates (50 boards x 4 seats), the app's budgets; a fair share is 25%, the Expert itself is 25 by
 *  construction. RATING: one number from every table measured (Plackett-Luce: the chance to win a game is the softmax of the seats'
 *  ratings; Elo scale, Intermediate = 1000; ± 95% bootstrap over the games). Generated from the runs (scratchpad eng130/h/bt.py). */
export const VS_EXPERTS = {"expert": {"v": 25.0, "ci": 0.0, "n": 0, "note": "fair share by construction"}, "master": {"v": 30.5, "ci": 6.4, "n": 200}, "super": {"v": 41.0, "ci": 6.8, "n": 200}, "superplus": {"v": 56.0, "ci": 6.9, "n": 200}, "grandmaster": {"v": 58.5, "ci": 6.8, "n": 200}};
export const RATING = {"grandmaster": {"v": 1374, "ci": 31, "games": 504}, "superplus": {"v": 1332, "ci": 34, "games": 504}, "super": {"v": 1277, "ci": 37, "games": 400}, "master": {"v": 1222, "ci": 21, "games": 1000}, "expert": {"v": 1136, "ci": 16, "games": 2027}, "builder": {"v": 1096, "ci": 15, "games": 2000}, "trader": {"v": 1036, "ci": 17, "games": 2000}, "shark": {"v": 1034, "ci": 18, "games": 2000}, "intermediate": {"v": 1000, "ci": 0, "games": 13200}, "beginner": {"v": 831, "ci": 23, "games": 2000}, "simple": {"v": 668, "ci": 37, "games": 2000}};
/** The Classic figure a list shows for a bot: "win" (vs 3 Intermediates), "vse" (vs 3 Experts) or "rating". */
export function metricOf(key, metric = "win") {
  if (metric === "vse") { const x = VS_EXPERTS[key]; return x ? { ...x, label: "measured" } : { v: null, ci: null, label: "unknown" }; }
  if (metric === "rating") { const x = RATING[key]; return x ? { ...x, label: "measured", rating: true } : { v: null, ci: null, label: "unknown" }; }
  return winOf(key);
}

/** Review accuracy of a bot level: { v, se, n, setup, code, date, label } (from review/bands.js) or an "unknown" entry. */
export function accOf(key, label) {
  const b = botBand(label);
  return b ? { v: b[0], se: b[1], n: 300, setup: "review", code: "v1.21", date: "2026-11-08", label: "measured" }
    : { v: null, se: null, n: null, setup: null, code: null, date: null, label: "unknown" };
}
/** Win chance of a bot in a tab ("classic" by default; v1.34 also rush / five / six / sea for the bots in MODE_STATS). */
export const winOf = (key, tab = "classic") => (tab === "classic" ? BOT_STATS[key]?.win : MODE_STATS[tab]?.[key]) || { v: null, ci: null, label: "unknown" };
/** lab-131: preset keys strongest first, by the measured win chance above (one source for every bot picker, so the order
 *  follows the numbers). A key without a measured figure (a new preset) leads, in the given order; ties keep the given order. */
export function byStrength(keys) {
  const w = (k) => { const x = winOf(k); return x.label === "measured" && x.v != null ? x.v : Infinity; };
  return keys.slice().sort((a, b) => w(b) - w(a) || keys.indexOf(a) - keys.indexOf(b));
}

/** Do two ± ranges overlap? (value ± half-width) */
export const rangesOverlap = (a, ah, b, bh) => a - ah <= b + bh && b - bh <= a + ah;

/** Fair share of one seat by table size: 25% at 4 players, 20% at 5, 17% at 6. */
export const FAIR = { classic: 25, rush: 25, five: 20, six: 16.7, sea: 25 };

/** Which tab a finished game belongs to. v1.34: 5 and 6 players are two tabs. */
export const tabOf = (m) => (m.board === "seafarers" ? "sea" : m.n >= 6 ? "six" : m.n === 5 ? "five" : m.mode === "rush" ? "rush" : "classic");
/** Tabs with the full measurement (every bot, accuracy, charts). The others have MODE_STATS for a few bots. */
export const MEASURED_TABS = new Set(["classic"]);
