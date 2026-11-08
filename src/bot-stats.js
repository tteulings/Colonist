// v1.23 The numbers behind the Bots page (leaderboard, strength ladder, strength-vs-accuracy chart), in ONE place.
// Every number says what it is: value, interval, n, how it was measured, which code version, when, and a label:
//   "measured"    an experiment of exactly this set-up
//   "estimate"    worked out from other experiments, NOT a measurement (the source says how)
//   "early test"  a first run, not final
//   "unknown"     no number yet
// Only the Classic island with 4 players (10 VP) is measured. Rush, 5–6 players and Seafarers have no numbers: "not measured yet".
// To re-measure (the figures below are from the v1.03 code): replace the entry, keep the set-up text honest, change code/date.
// Review accuracy lives in review/bands.js (one source with the review screen); its SE and n are read from there.
import { botBand } from "./review/bands.js";

export const SETUPS = {
  vs3int: "One bot against 3 Intermediate bots, Classic island, 4 players, 10 VP. 2000 games (500 boards x 4 seats, paired seeds, seat rotated). 95% interval.",
  vsExpert: "One Master against 3 Experts, Classic island, 4 players, 10 VP, same seat as the Expert it is compared with. 500 games (common random numbers). 95% interval.",
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
  // Never measured against 3 Intermediates. 49.5 is a SUM of two different experiments, shown as an estimate with its source, never as a result.
  master: {
    win: { v: 49.5, ci: null, n: null, setup: null, code: "v0.91 + v1.03", date: "2026-11-04", label: "estimate",
      src: "Expert 41.1 (vs 3 Intermediates) + 8.4 pp (Master vs Expert, vs 3 Experts): two experiments added up, no interval." },
    vsExpert: { v: 8.4, ci: 5.4, n: 500, setup: "vsExpert", code: "v0.91", date: "2026-11-04", label: "measured", own: { v: 33.4, ci: 4.1 } },
  },
  // No number: the early test is text only (the list shows it, the ladder and the chart do not place it).
  super: {
    win: { v: null, ci: null, n: 400, setup: null, code: "v1.10", date: "2026-11-04", label: "early test",
      text: "+8 pp vs Master", src: "Early test, not final: about +8 pp over the Master in the same seat (400 games against 3 Experts, ±3). To be measured again." },
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
