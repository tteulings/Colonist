// v1.03 Game review: one recorded decision, checked by the Master's Monte Carlo search (src/master/search.js
// agent.evaluate). The move that was played races the moves the Master would consider on the same random
// futures (the hidden cards re-dealt and the dice fixed the same way for every move, 14 turns of normal bot
// play, scored as a win chance). Loss = max(0, win%(best) − win%(played)), the best taken over the moves
// still in the race at the end, less one standard error of its paired gap (the best of several noisy
// estimates is otherwise biased upward). Accuracy per decision is chess.com-style on that loss in
// percentage points, and the game's accuracy is the mean over the decisions that were a real choice
// (development-card buys and plays are marked but not scored, see SCORED_KINDS).
// Forced (nothing else to compare) and trivial (every move within TRIVIAL of the played one) decisions
// are left out. Player trades, discards and turn starts are not searched (the Master doesn't either).
import { makeMaster } from "../master/search.js";

// v1.03 review engines: the ONE place where the depth of the Game review is chosen. After the game there is
// time, so each decision gets a deeper search than a Master move. `sec`: seconds per decision in a desktop
// worker (the screen's time estimate; a phone is ~3–4× slower). `bands`: the bots' accuracy measured with that
// engine (src/review-game.js shows them only as an average over 5+ games).
//   full  1000 rollouts, 14-turn look-ahead (18 in set-up). As a playing seat (rel89 harness, paired):
//         +12.5 ± 12.7 pp over Master-100 vs 3 Experts; loss SD between two runs 0.85 pp (Master-100: 3.3).
//   b     300 rollouts, 12-turn look-ahead (16 in set-up): the lighter option, not yet measured.
//   m100  the Master's own budget (100 rollouts, 8 turns): the v1.03 first calibration.
export const REVIEW_ENGINES = {
  // calibrated (seat 0 at each level vs 3 Intermediate, 16 games per level, mean per game ± SE; the per-game
  // SD is 4–17, highest for the weak bots): Simple 78.3 ± 4.3, Beginner 82.1 ± 3.1, Intermediate 87.5 ± 1.9,
  // Expert 88.1 ± 1.4, Master-100 90.6 ± 1.0. In order with every decision kind scored, dev cards included
  // (the 14-turn look-ahead sees them; with the 8-turn m100 engine they had to be left out).
  full: { budget: { n: 1000, timeMs: 12000, depth: 14, setupDepth: 18 }, sec: 7, k: 0.08, trivial: 0.02, scored: ["setup", "build", "bank", "buy", "play", "robber", "end"],
    bands: [["Simple", 78.3], ["Beginner", 82.1], ["Intermediate", 87.5], ["Expert", 88.1], ["Master", 90.6]] },
  b: { budget: { n: 300, timeMs: 6000, depth: 12, setupDepth: 16 }, sec: 2, bands: null },
  m100: { budget: { n: 160, timeMs: 700 }, sec: 0.5, k: 0.08, trivial: 0.02, scored: ["setup", "build", "bank", "robber", "end"], bands: [["Simple", 85], ["Beginner", 86], ["Intermediate", 88], ["Expert", 89]] },
};
export const REVIEW_ENGINE = "full";
export const REVIEW = REVIEW_ENGINES[REVIEW_ENGINE];
export const REVIEW_BUDGET = REVIEW.budget;

// accuracy = a·e^(−k·loss%) − b: chess.com's win%-based curve, steeper (k 0.08 instead of 0.0435) because
// these win chances come from an 8-turn look-ahead and move less than a chess engine's. Calibrated on the
// bots' own decisions (2 × 24 games per level, see BANDS in src/review-game.js).
export const ACC = { a: 103.1668, k: REVIEW.k ?? 0.08, b: 3.1669 };
// Development cards (buy / play) are checked and marked but not scored: their value lies mostly beyond the
// 8-turn look-ahead (a hidden deck, Largest Army later), and scoring them put the bot levels out of order.
export const SCORED_KINDS = REVIEW.scored || ["setup", "build", "bank", "robber", "end"];
export const TRIVIAL = REVIEW.trivial ?? 0.02; // every alternative within 2 points of win chance: not a real choice (calibrated)
export const SE_SHRINK = 1;  // the loss is the best gap less this many standard errors (winner's curse)
export const MARKS = { inacc: 0.025, miss: 0.06 }; // loss ≥ 2.5 points: could be sharper; ≥ 6: missed chance
export const EVAL_KINDS = ["setup", "build", "bank", "buy", "play", "robber", "end"];

const RL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const DEV = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 } };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function accuracyOf(loss, k = ACC.k) {
  return Math.max(0, Math.min(100, ACC.a * Math.exp(-k * loss * 100) - ACC.b));
}
export function markOf(loss) { return loss >= MARKS.miss ? "miss" : loss >= MARKS.inacc ? "inacc" : "good"; }

/** The recorded move as something the search can play again in any future (null: not searchable). */
export function playedMove(g, p, rec) {
  const a = rec.a || {};
  const done = (gg, q) => { gg.recomputeScores(); gg.checkForWinner(q); return true; };
  switch (rec.k) {
    case "setup": return { node: a.n, label: `Settlement on ${g._spotLabel(a.n)}`, focus: { node: a.n },
      apply(gg, q) {
        const save = Object.prototype.hasOwnProperty.call(gg, "getBestInitialSettlementNode") ? gg.getBestInitialSettlementNode : null;
        const base = gg._masterBaseInit || ((x) => gg.constructor.prototype.getBestInitialSettlementNode.call(gg, x));
        let used = false;
        gg.getBestInitialSettlementNode = (x) => { if (!used && x.id === q.id) { used = true; return a.n; } return base(x); };
        try { gg.setupAction = null; gg.processSetupQueue(); } finally { if (save) gg.getBestInitialSettlementNode = save; else delete gg.getBestInitialSettlementNode; }
        return used ? true : false;
      } };
    case "build": {
      const t = a.type;
      if (t === "road") return { label: "Road", focus: { edge: a.id },
        apply(gg, q) { const free = gg.freeRoadsRemaining > 0; if (!gg.placeRoad(q, a.id, { free })) return false; if (free) gg.freeRoadsRemaining -= 1; else gg.payToBank(q, COST.road); return done(gg, q); } };
      if (t === "settlement") return { label: `Settlement on ${g._spotLabel(a.id)}`, focus: { node: a.id },
        apply(gg, q) { if (!gg.placeSettlement(q, a.id, false)) return false; gg.payToBank(q, COST.settlement); return done(gg, q); } };
      if (t === "city") return { label: `City on ${g._spotLabel(a.id)}`, focus: { city: a.id },
        apply(gg, q) { if (!gg.placeCity(q, a.id, false)) return false; gg.payToBank(q, COST.city); return done(gg, q); } };
      return null;
    }
    case "bank": {
      const give = {}, get = {};
      (a.tr || []).forEach(([x, y]) => { give[x] = (give[x] || 0) + 1; get[y] = (get[y] || 0) + 1; });
      return { label: `Bank trade ${Object.keys(give).map((r) => RL[r]).join(" + ")} → ${Object.entries(get).map(([r, n]) => `${n} ${RL[r]}`).join(" + ")}`, focus: null,
        apply(gg, q) { for (const [x, y] of a.tr || []) if (!gg.performBankTrade(q, x, y)) return false; return true; } };
    }
    case "buy": return { label: "Development card", focus: null, apply(gg, q) { return gg.buyDevelopmentCard(q) ? done(gg, q) : false; } };
    case "play": return { label: `Play ${DEV[a.t] || a.t}`, dev: a.t, focus: null, apply(gg, q) { return gg.playDevelopmentCard(q, a.t) !== false ? done(gg, q) : false; } };
    case "end": return { label: "End turn", focus: null, apply(gg) { gg.endTurn(); return "ended"; } };
    case "robber": return { hex: a.hex, label: `Robber on ${g._hexName(a.hex)}`, focus: { hex: a.hex },
      apply(gg, q) { gg.moveRobberAndSteal(q, a.hex); return true; } };
    default: return null;
  }
}

/** Evaluate one record. `load(rec)` puts the engine on its position (the seat playing like the Expert). */
export function evaluateRecord(g, rec, load, opts = {}) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const base = { k: rec.k, pid: rec.pid, t: rec.t, s: rec.s, e: rec.e };
  if (!EVAL_KINDS.includes(rec.k) || (rec.k === "build" && rec.a?.free)) return { ...base, skip: "n/a" };
  const p = load(rec);
  if (g.winner) return { ...base, skip: "n/a" };
  if (rec.k === "robber") { g.pendingAction = null; g.robberContext = null; }
  const played = playedMove(g, p, rec);
  if (!played) return { ...base, skip: "n/a" };
  const agent = makeMaster({ ...REVIEW_BUDGET, ...(opts.budget || {}) });
  const kind = rec.k === "setup" ? "setup" : rec.k === "robber" ? "robber" : "main";
  const r = agent.evaluate(g, p, kind, played);
  const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
  if (!r) return { ...base, skip: "forced", label: played.label, ms };
  const mean = (v) => { const x = v.filter((y) => y != null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
  const last = r.rounds[r.rounds.length - 1];
  const finalists = last ? last.alive.filter((k) => !last.out.includes(k)) : [0];
  const winP = mean(r.vals[0]);
  const cands = r.cands.map((x, k) => ({ label: x.label, focus: x.focus || null, m: r.paired[k].m, se: r.paired[k].se, n: r.paired[k].n, fin: finalists.includes(k), win: winP == null ? null : r4(winP + r.paired[k].m) }));
  let best = 0;
  cands.forEach((c, k) => { if (k && c.fin && c.n >= 2 && c.m > (best ? cands[best].m : 0)) best = k; });
  const b = cands[best];
  const lossRaw = best ? Math.max(0, b.m) : 0;
  const loss = best ? Math.max(0, b.m - SE_SHRINK * (b.se || 0)) : 0;
  const spread = Math.max(0, ...cands.filter((c, k) => k && c.n >= 2).map((c) => Math.abs(c.m)));
  const trivial = spread < TRIVIAL;
  return { ...base, label: played.label, focus: played.focus || null, win: winP == null ? null : r4(winP), best: best ? { label: b.label, focus: b.focus, gain: r4(b.m), se: b.se } : null,
    loss: r4(loss), lossRaw: r4(lossRaw), spread: r4(spread), trivial, skip: trivial ? "trivial" : null, acc: trivial || !SCORED_KINDS.includes(rec.k) ? null : Math.round(accuracyOf(loss) * 10) / 10,
    mark: trivial ? "good" : markOf(loss), cands, futures: r.vals[0].filter((v) => v != null).length, rollouts: r.rollouts, ms };
}

/** The game's numbers from the per-decision results. */
export function summarize(results) {
  const real = results.filter((x) => x.acc != null);
  const acc = real.length ? real.reduce((a, x) => a + x.acc, 0) / real.length : null;
  const count = { good: 0, inacc: 0, miss: 0 };
  results.filter((x) => x.mark).forEach((x) => { count[x.mark] += 1; });
  return { acc: acc == null ? null : Math.round(acc), n: real.length, checked: results.length, count };
}
