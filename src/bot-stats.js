// v1.23 The numbers behind the Bots page (leaderboard, strength ladder, strength-vs-accuracy chart), in ONE place.
// Every number says what it is: value, interval, n, how it was measured, which code version, when, and a label:
//   "measured"    an experiment of exactly this set-up
//   "estimate"    worked out from other experiments, NOT a measurement (the source says how)
//   "early test"  a first run, not final
//   "unknown"     no number yet
// Only the Classic island with 4 players (10 VP) is measured. Rush, 5–6 players and Seafarers have no numbers: "not measured yet".
// To re-measure (the scoring bots' figures are from the v1.03 code; Master and the Super Experts from bot-125): replace the entry, keep the set-up text honest, change code/date.
// Review accuracy lives in review/bands.js (one source with the review screen); its SE and n are read from there.
import { botBand } from "./review/bands.js";

export const SETUPS = {
  vs3int: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 2000 games (500 boards x 4 seats, paired seeds, seat rotated). 95% interval.",
  vsExpert: "One Master against 3 Experts, Classic island, 4 players, 10 VP, same seat as the Expert it is compared with. 500 games (common random numbers). 95% interval.",
  vs3intMaster: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 800 games (200 boards x 4 seats, paired seeds, seat rotated). The Master searches as in the app (100 futures, at most 0.5 s). 95% interval.",
  vs3intFixed: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 400 games (100 boards x 4 seats, paired seeds, seat rotated). Searched WITHOUT a time limit, with a fixed budget (1000 futures, 14 turns deep, 18 in set-up, early stop), so the machine's speed does not change the result; in the app the search stops at 3 s. 95% interval.",
  h2h: "Super Expert, Super Expert+ and 2 Experts at one table, Classic island, 4 players, 10 VP; per board 8 games (4 seat orders, the two Supers swapped). Both without a time limit. 95% interval.",
  review: "The bot's own moves scored by the deep review check (k 0.10), 300 positions, the seat plays on as Expert. Bootstrap standard error (SE).",
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
    win: { v: 71.0, ci: 4.4, n: 400, setup: "vs3intFixed", code: "v1.28 engine (bot-125)", date: "2026-11-09", label: "measured",
      src: "No time limit (fixed budget); in the app it stops at 3 s. Paired with the Expert on the same boards: +32.5 pp (±5.9)." },
  },
  grandmaster: {
    win: { v: null, ci: null, label: "unknown" },
  },
  superplus: {
    win: { v: 71.5, ci: 4.4, n: 400, setup: "vs3intFixed", code: "v1.28 engine (bot-125)", date: "2026-11-09", label: "measured",
      src: "No time limit (fixed budget); in the app it stops at 3 s. Against 3 Intermediates it ties the Super Expert: +0.5 pp (±5.4, same boards and seats). Head to head (Super Expert, Super Expert+ and 2 Experts at one table, every seat order with the two Supers swapped, 112 games, no time limit): Super Expert+ won 41.1% (±9.1), Super Expert 28.6% (±8.4), the Experts 30.4%. Super Expert+ finished above Super Expert in 58.0% of the games (±9.0; 50% = equal). Per seat-swapped pair: +12.5 pp (±14.0). A slight lean toward Super Expert+, not significant." },
    h2h: { n: 112, sg: 41.1, sgci: 9.1, se: 28.6, seci: 8.4, higher: 58.0, higherci: 9.0, diff: 12.5, diffci: 14.0, setup: "h2h", code: "v1.28 engine (bot-125)", date: "2026-11-09", label: "measured" },
  },
};

/** Review accuracy of a bot level: { v, se, n, setup, code, date, label } (from review/bands.js) or an "unknown" entry. */
export function accOf(key, label) {
  const b = botBand(label);
  return b ? { v: b[0], se: b[1], n: 300, setup: "review", code: "v1.21", date: "2026-11-08", label: "measured" }
    : { v: null, se: null, n: null, setup: null, code: null, date: null, label: "unknown" };
}
export const winOf = (key) => BOT_STATS[key]?.win || { v: null, ci: null, label: "unknown" };

/** Do two ± ranges overlap? (value ± half-width) */
export const rangesOverlap = (a, ah, b, bh) => a - ah <= b + bh && b - bh <= a + ah;

/** Fair share of one seat by table size: 25% at 4 players, 17–20% at 5–6. */
export const FAIR = { classic: "25%", six: "17–20%" };

/** Which tab a finished game belongs to. */
export const tabOf = (m) => (m.board === "seafarers" ? "sea" : m.n >= 5 ? "six" : m.mode === "rush" ? "rush" : "classic");
export const MEASURED_TABS = new Set(["classic"]);
