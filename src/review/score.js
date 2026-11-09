// v1.21 Game review, the ONE place where a checked decision becomes numbers and words. No imports, no DOM, no engine:
// the review screen, the end screen, the history list and the migration of saved reviews all read this file, so the
// same decision says the same thing everywhere.
//
// Unit: percentage points of win chance ("%"). A decision's gap `gp` is a whole number:
//   gp = round(100 × (best gap − 1 standard error))   (x.loss in the stored result; the best of several noisy estimates
//   is otherwise biased upward). B (what you did) = round(100 × its win chance), A (the better move) = B + gp, so
//   A − B is always the gap that the class uses, on every screen.
// Everything below is derived from the stored candidates (`cands`), so a saved review can be re-scored without the engine.

export const FMT = 3; // stamp on a review (`rv.fmt`) and on its history entry: numbers, classes and labels of this file

// Classes on the gap in whole percent. The upper bound of each class (the gap must be under it). Best: under 1 (0).
export const LIMITS = [[1, "best"], [3, "good"], [6, "could"], [12, "mistake"], [Infinity, "blunder"]];
// Set-up decisions: the options are far apart (the median shortfall of a set-up spot is 6 points, of any other move 0) and the
// model's verdict on a spot is a stable judgement, not noise (run to run 0.9 points), so the same gap there is no
// sign of a worse move. Measured on 175 real decisions of 20 games (set-up n = 18): with these limits a set-up
// blunder is as rare as any other blunder (6 %), a set-up mistake 28 % (other moves 7 %). See the v1.21 notes.
export const SETUP_LIMITS = [[2, "best"], [5, "good"], [10, "could"], [18, "mistake"], [Infinity, "blunder"]];
export const GREAT = 8; // Great: the best move with the next one at least this many percent behind (not in set-up / End turn)
export const BEST_LEAD = 0;
export const CLASSES = ["best", "great", "good", "could", "mistake", "blunder", "missed"];
export const TRIVIAL = 0.02; // every option within 2 points of the played one: no real choice
export const SE_SHRINK = 1;
export const limitsFor = (k) => (k === "setup" ? SETUP_LIMITS : LIMITS);

const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** Re-derive the numbers of one result from its candidates (cands[0] is the move that was played). */
export function derive(cands, trivialAt = TRIVIAL) {
  let best = 0;
  cands.forEach((c, k) => { if (k && c.fin && c.n >= 2 && c.m > (best ? cands[best].m : 0)) best = k; });
  const b = cands[best];
  const alts = cands.filter((c, k) => k && c.n >= 2);
  const lossRaw = best ? Math.max(0, b.m) : 0, loss = best ? Math.max(0, b.m - SE_SHRINK * (b.se || 0)) : 0;
  const spread = Math.max(0, ...alts.map((c) => Math.abs(c.m)));
  const lead = alts.length ? Math.max(0, -Math.max(...alts.map((c) => c.m))) : spread;
  return { best, b, lossRaw: r4(lossRaw), loss: r4(loss), spread: r4(spread), lead: r4(lead), trivial: spread < trivialAt, win: cands[0].win };
}

/** The gap of a decision in whole percent (0 for forced / trivial / nothing better). */
export function gpOf(x) {
  if (!x || x.loss == null || x.trivial || !x.best || x.win == null) return 0;
  return Math.max(0, Math.round(x.loss * 100));
}

/** The class of a result, or null when it has none (forced, not searched, error, no real choice). */
export function clsOf(x) {
  if (!x || x.skip === "forced" || x.skip === "n/a" || x.skip === "error" || x.loss == null) return null;
  if (x.trivial || x.skip === "trivial") return null;
  const gp = gpOf(x), lead = Math.round((x.lead ?? x.spread ?? 0) * 100);
  const c = limitsFor(x.k).find(([m]) => gp < m)[1];
  if (c !== "best" && c !== "good" && ["end", "bank"].includes(x.k) && /^(City|Settlement|Road|Development)/.test(x.best?.label || "")) return "missed";
  if (c === "best") return lead >= GREAT && (x.cands?.length ?? 0) >= 3 && x.k !== "setup" && x.k !== "end" ? "great" : "best";
  return c;
}
/** The old three-way mark (good / inacc / miss) that stored results carry, from the class. */
export const markOfCls = (c) => (c === "mistake" || c === "blunder" || c === "missed" ? "miss" : c === "could" ? "inacc" : "good");

/** Seat chances with my seat set to `mine` (0–1) and the others scaled to fill the rest. */
export function fitSeats(seats, me, mine) {
  const n = seats.length, rest = seats.reduce((a, v, q) => a + (q === me ? 0 : v), 0);
  return seats.map((v, q) => (q === me ? mine : rest > 0 ? (v / rest) * (1 - mine) : (1 - mine) / Math.max(1, n - 1)));
}

/** The decisions with a win chance, in play order, all in whole percent:
 *  B (what you did), A = B + gp, gp, and `chance` = what moved your chance between your previous move and the best line here
 *  (the first decision starts from an even share, 100 / players). */
export function decide(results, n, me) {
  const base = Math.round(100 / n);
  const norm = (a, w) => (Array.isArray(a) && a.length === n ? a : Array.from({ length: n }, (_, q) => (q === me ? w : (1 - w) / Math.max(1, n - 1))));
  const sorted = results.filter((x) => x.win != null).sort((a, b) => a.i - b.i);
  // proef: within one roll step and turn, after a move without chance (build / bank trade) the next move's best line was still open,
  // so the played move is worth at least that (B >= next A); otherwise the evaluator's miss shows up twice (gap, then "luck" back).
  const SAFE = ["build", "bank"], floor = sorted.map(() => null);
  for (let k = sorted.length - 2; k >= 0; k -= 1) {
    const x = sorted[k], y = sorted[k + 1];
    const yB = Math.max(Math.round(y.win * 100), floor[k + 1] ?? -1), yA = Math.max(yB, Math.round(y.win * 100) + gpOf(y));
    if (SAFE.includes(x.k) && x.s != null && x.s === y.s && x.t === y.t) floor[k] = yA;
  }
  let prev = null;
  return sorted.map((x, k) => {
    let cls = clsOf(x) || (x.trivial || x.skip === "trivial" ? "triv" : "best");
    let gp = cls === "triv" ? 0 : gpOf(x), B = Math.round(x.win * 100), A = B + gp;
    if (floor[k] != null && floor[k] > B) { B = Math.min(A, floor[k]); gp = A - B; if (gp < 1 && cls !== "triv") cls = "best"; }
    const cp = A - (prev == null ? base : prev);
    prev = B;
    return { i: x.i, x, t: x.t, k: x.k, cls, gp, B, A, cp, base, loss: x.loss || 0,
      win: B / 100, vBest: A / 100, gap: gp / 100, chance: cp / 100,
      seats: fitSeats(norm(x.seats, x.win), me, B / 100), bseats: fitSeats(norm(x.best?.seats, x.win + (x.best?.gain || 0)), me, A / 100),
      same: cls === "triv" || !x.best || gp < 1 };
  });
}

/** Your moves and Luck for the whole game, in whole percent. Always: Luck + Your moves = (win chance after your last move) − (an even share).
 *  Your moves is capped at the most win chance you ever had or could have had (you cannot give away more than that);
 *  Luck takes the rest, so the sum stays true. */
export function totals(ds) {
  if (!ds.length) return { moves: 0, luck: 0, capped: false, sum: 0, cap: 0, from: 0, to: 0 };
  const sum = ds.reduce((a, d) => a + d.gp, 0), cap = Math.max(...ds.map((d) => d.A));
  const lost = Math.min(sum, cap), from = ds[0].base, to = ds[ds.length - 1].B;
  return { moves: -lost, luck: to - from + lost, capped: sum > cap, sum, cap, from, to };
}

/** Average win chance given away per real choice (whole decisions that are scored), in percent with one decimal. */
export function avgLost(results) {
  const real = results.filter((x) => x.acc != null);
  return real.length ? Math.round((real.reduce((a, x) => a + gpOf(x), 0) / real.length) * 10) / 10 : null;
}

// ── labels ──
// A bank trade is `Bank trade 4 Ore → 1 Brick` when the rate is known (v1.21+ reviews). Older saved reviews counted trades,
// not cards ("1 Ore → 1 Brick" for a 4:1 trade), so their counts are dropped: `Bank trade Ore → Brick`.
export const RATE_KNOWN = /^Bank trade \d+ /;
export function unknownRateLabel(l) {
  const m = String(l).match(/^Bank trade (.+?) → (.+)$/);
  if (!m || !RATE_KNOWN.test(l)) return l;
  const strip = (s) => s.split(" + ").map((p) => p.replace(/^\d+ /, "")).join(" + ");
  return `Bank trade ${strip(m[1])} → ${strip(m[2])}`;
}
/** How a bank trade reads on screen: "Gave 4 Ore for 1 Brick" (rate known) or "Traded Ore for Brick" (rate not recorded). */
export function tradeShow(l) {
  const m = String(l).match(/^Bank trade (.+?) → (.+)$/);
  if (!m) return l;
  return RATE_KNOWN.test(l) ? `Gave ${m[1]} for ${m[2]}` : `Traded ${m[1]} for ${m[2]}`;
}

/** One saved result in the current format, from its own candidates; `cfg` = { trivial, acc(lossRaw) -> number, scored: [kinds] } for its engine.
 *  Returns the result itself when there is nothing to derive from (forced, not searched, error). */
export function rescoreResult(x, cfg) {
  if (!x || !x.cands?.length || x.skip === "forced" || x.skip === "n/a" || x.skip === "error") return x;
  const d = derive(x.cands, cfg.trivial);
  const label = x.k === "bank" ? unknownRateLabel(x.label) : x.label;
  const cands = x.k === "bank" ? x.cands.map((c) => ({ ...c, label: unknownRateLabel(c.label) })) : x.cands;
  const best = d.best ? { label: cands[d.best].label, focus: cands[d.best].focus || null, gain: r4(d.b.m), se: d.b.se, seats: x.best && x.best.label === cands[d.best].label ? x.best.seats ?? null : null } : null;
  const y = { ...x, label, cands, best, loss: d.loss, lossRaw: d.lossRaw, spread: d.spread, lead: d.lead, trivial: d.trivial, skip: d.trivial ? "trivial" : null,
    win: d.win == null ? x.win : r4(d.win),
    acc: d.trivial || !cfg.scored.includes(x.k) ? null : Math.round(cfg.acc(d.lossRaw) * 10) / 10 };
  y.mark = d.trivial ? "good" : markOfCls(clsOf(y));
  return y;
}
