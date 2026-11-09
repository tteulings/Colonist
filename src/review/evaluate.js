// v1.03 Game review: one recorded decision, checked by the Master's Monte Carlo search (src/master/search.js
// agent.evaluate). The move that was played races the moves the Master would consider on the same random
// futures (the hidden cards re-dealt and the dice fixed the same way for every move, 14 turns of normal bot
// play, scored as a win chance). Loss = max(0, win%(best) − win%(played)), the best taken over the moves
// still in the race at the end, less one standard error of its paired gap (the best of several noisy
// estimates is otherwise biased upward). Accuracy per decision is chess.com-style on that loss in
// percentage points, and the game's accuracy is the mean over the decisions that were a real choice
// (development-card buys and plays are scored since the 14-turn look-ahead sees them, see SCORED_KINDS).
// Forced (nothing else to compare) and trivial (every move within TRIVIAL of the played one) decisions
// are left out. Player trades, discards and turn starts are not searched (the Master doesn't either).
import { makeMaster } from "../master/search.js";
import { explain } from "./why.js";
import { BOT_BANDS } from "./bands.js";
import { FMT, LIMITS, SETUP_LIMITS, GREAT, BEST_LEAD, CLASSES, TRIVIAL as TRIV, SE_SHRINK as SHRINK, clsOf, markOfCls, derive, gpOf, avgLost, rescoreResult, unknownRateLabel, liftSameStep } from "./score.js";
export { FMT, LIMITS, SETUP_LIMITS, GREAT, BEST_LEAD, CLASSES, clsOf, markOfCls, gpOf, tradeShow, decide, totals } from "./score.js";

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
  // eng-124 (study-124): Monte Carlo with the boosted-tree leaf "gbm" (src/master/leaf-gbm.js). Against played-out truth (301
  // positions, 625 futures per move to the end) MC gbm 100 futures x 14 turns: MAE 5.3 win-% points, same best move 69 % (fit leaf
  // 1000 x 14: 5.9, 63 %; the old full engine is close to fit 250-1000 x 14). nPer: futures per move on average (budget = nPer x
  // number of moves, successive halving as before), so a decision with many moves gets more. Formula v5 (ACC.ver): a result
  // judged by the old leaf ("fit") is provisional and gets Re-check (needsFull / reviewStatus.stale).
  full: { budget: { nPer: 100, timeMs: 12000, depth: 14, setupDepth: 18, leaf: "gbm" }, sec: 3, k: 0.10, trivial: 0.02, scored: ["setup", "build", "bank", "buy", "play", "robber", "end"],
    // v1.16: k 0.10 (stricter curve, was 0.06) and Best = any move under 1 point. Bands: every preset's own moves scored like a
    // human's (the seat plays on as Expert), the same 300 positions as v1.21, now with the gbm leaf (eng-124). [name, accuracy, SE]
    bands: BOT_BANDS },
  b: { budget: { n: 300, timeMs: 6000, depth: 12, setupDepth: 16 }, sec: 2, bands: null },
  m100: { budget: { n: 160, timeMs: 700, leaf: "fit" }, sec: 0.5, k: 0.08, trivial: 0.02, scored: ["setup", "build", "bank", "robber", "end"], bands: [["Simple", 85], ["Beginner", 86], ["Intermediate", 88], ["Expert", 89]] },
};
export const REVIEW_ENGINE = "full";
export const REVIEW = REVIEW_ENGINES[REVIEW_ENGINE];
export const REVIEW_BUDGET = REVIEW.budget;

// accuracy = a·e^(−k·loss%) − b: chess.com's win%-based curve, steeper (k 0.08 instead of 0.0435) because
// these win chances come from an 8-turn look-ahead and move less than a chess engine's. Calibrated on the
// bots' own decisions (2 × 24 games per level, see BANDS in src/review-game.js).
// v1.08 formula version 2: per move on the raw gap A−B (what the screen shows), the game's accuracy = (weighted mean +
// harmonic mean) / 2 over the real choices, weighted by the stake (spread of the options). ACC.id tags stored scores.
export const ACC = { a: 103.1668, k: REVIEW.k ?? 0.08, b: 3.1669, ver: 5, // eng-124 v5: the gbm leaf (v4: fit)
  get id() { return `k${this.k}v${this.ver}`; } };
// Development cards (buy / play) are checked and marked but not scored: their value lies mostly beyond the
// 8-turn look-ahead (a hidden deck, Largest Army later), and scoring them put the bot levels out of order.
export const SCORED_KINDS = REVIEW.scored || ["setup", "build", "bank", "robber", "end"];
export const TRIVIAL = REVIEW.trivial ?? TRIV; // every alternative within 2 points of win chance: not a real choice (calibrated)
export const SE_SHRINK = SHRINK;  // the loss is the best gap less this many standard errors (winner's curse)
export const EVAL_KINDS = ["setup", "build", "bank", "buy", "play", "robber", "end"];

const RL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const DEV = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 } };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function accuracyOf(loss, k = ACC.k) {
  return Math.max(0, Math.min(100, ACC.a * Math.exp(-k * loss * 100) - ACC.b));
}
// v1.21 classes, the gap in whole percent and the totals live in ./score.js (one definition for every screen).

/** "Road toward 10·12·5": the end of the new road that is not already part of the player's network. */
function roadLabel(g, p, edgeId) {
  try {
    const G = g.geometry, ed = G.edges[edgeId];
    const mine = (n) => G.nodes[n].owner === p.id || G.nodes[n].edgeIds.some((e) => e !== edgeId && G.edges[e].owner === p.id);
    const far = ed.nodes.find((n) => !mine(n));
    return far != null ? `Road toward ${g._spotLabel(far)}` : `Road ${g._spotLabel(ed.nodes[0])} – ${g._spotLabel(ed.nodes[1])}`; // v1.17 a road between two spots of your own network says where it is
  } catch (_) { return "Road"; }
}

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
      if (t === "road") return { label: roadLabel(g, p, a.id), focus: { edge: a.id },
        apply(gg, q) { const free = gg.freeRoadsRemaining > 0; if (!gg.placeRoad(q, a.id, { free })) return false; if (free) gg.freeRoadsRemaining -= 1; else gg.payToBank(q, COST.road); return done(gg, q); } };
      if (t === "settlement") return { label: `Settlement on ${g._spotLabel(a.id)}`, focus: { node: a.id },
        apply(gg, q) { if (!gg.placeSettlement(q, a.id, false)) return false; gg.payToBank(q, COST.settlement); return done(gg, q); } };
      if (t === "city") return { label: `City on ${g._spotLabel(a.id)}`, focus: { city: a.id },
        apply(gg, q) { if (!gg.placeCity(q, a.id, false)) return false; gg.payToBank(q, COST.city); return done(gg, q); } };
      return null;
    }
    case "bank": {
      // v1.21 the label counts CARDS: a 4:1 trade gives 4 (the rate was noted with the trade, or comes from the harbours at that moment)
      const give = {}, get = {};
      (a.tr || []).forEach(([x, y, rt]) => { give[x] = (give[x] || 0) + (rt || (g.getPlayerTradeRate ? g.getPlayerTradeRate(p, x) : 4)); get[y] = (get[y] || 0) + 1; });
      return { label: `Bank trade ${Object.entries(give).map(([r, n]) => `${n} ${RL[r]}`).join(" + ")} → ${Object.entries(get).map(([r, n]) => `${n} ${RL[r]}`).join(" + ")}`, focus: null,
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
  // v1.04 opts.engine: "m100" is the quick first round after a game (the deep round is "full", the default)
  const eng = opts.engine && REVIEW_ENGINES[opts.engine] ? opts.engine : REVIEW_ENGINE, E = REVIEW_ENGINES[eng];
  const agent = makeMaster({ ...(eng === REVIEW_ENGINE ? REVIEW_BUDGET : E.budget), seats: true, ...(opts.budget || {}) }); // seats: every seat's win chance, no extra rollouts
  base.eng = eng;
  base.leaf = (eng === REVIEW_ENGINE ? REVIEW_BUDGET : E.budget).leaf || "v1"; // which score function judged it
  const scored = eng === REVIEW_ENGINE ? SCORED_KINDS : E.scored; // the 8-turn look-ahead can't judge development cards
  const kind = rec.k === "setup" ? "setup" : rec.k === "robber" ? "robber" : "main";
  const r = agent.evaluate(g, p, kind, played);
  const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
  if (!r) return { ...base, skip: "forced", label: played.label, ms };
  const mean = (v) => { const x = v.filter((y) => y != null); return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null; };
  const last = r.rounds[r.rounds.length - 1];
  const finalists = last ? last.alive.filter((k) => !last.out.includes(k)) : [0];
  const winP = mean(r.vals[0]);
  const wl = (l) => (g._rushPos ? String(l).replace(/^End turn/, "Wait") : l); // Rush has no turn to end: "do nothing now"
  const cands = r.cands.map((x, k) => ({ label: wl(x.label), focus: x.focus || null, m: r.paired[k].m, se: r.paired[k].se, n: r.paired[k].n, fin: finalists.includes(k), win: winP == null ? null : r4(winP + r.paired[k].m) }));
  const d = derive(cands, REVIEW.trivial ?? TRIV);
  const { best, b, lossRaw, loss, spread, lead, trivial } = d;
  // v1.11 the likely reason A was stronger, read from the position (src/review/why.js); null when nothing clear separates them
  const why = best && !trivial && b.m >= 0.01 ? explain(g, p, rec, { label: b.label, focus: b.focus }, { label: played.label, focus: played.focus || null }) : null;
  const res = { ...base, rush: g._rushPos || undefined, why, label: played.label, focus: played.focus || null, move: { k: rec.k, a: rec.a || {} }, win: winP == null ? null : r4(winP), best: best ? { label: b.label, focus: b.focus, gain: r4(b.m), se: b.se, seats: r.seats?.[best] || null } : null, seats: r.seats?.[0] || null,
    loss, lossRaw, spread, lead, trivial, skip: trivial ? "trivial" : null, acc: trivial || !scored.includes(rec.k) ? null : Math.round(accuracyOf(lossRaw) * 10) / 10,
    cands, futures: r.vals[0].filter((v) => v != null).length, rollouts: r.rollouts, ms };
  res.mark = trivial ? "good" : markOfCls(clsOf(res)); // the old three-way mark, now from the same class as everywhere
  return res;
}

/** The game's numbers from the per-decision results. */
/** Game accuracy (v1.08): the per-move accuracies on the raw gap, weighted by the stake of the position (the spread of
 *  the options, 3–25 points), as (weighted mean + harmonic mean) / 2: a few big mistakes cannot hide among many easy moves. */
export function gameAccuracy(results) {
  const real = results.filter((x) => x.acc != null);
  if (!real.length) return null;
  const a = real.map((x) => Math.max(3, accuracyOf(x.lossRaw ?? x.loss ?? 0))), w = real.map((x) => Math.min(25, Math.max(3, (x.spread ?? 0.1) * 100)));
  const wm = a.reduce((p, v, i) => p + v * w[i], 0) / w.reduce((p, v) => p + v, 0), hm = a.length / a.reduce((p, v) => p + 1 / v, 0);
  return (wm + hm) / 2;
}
export function summarize(results) {
  const real = results.filter((x) => x.acc != null);
  const acc = gameAccuracy(results);
  const cls = Object.fromEntries(CLASSES.map((c) => [c, 0]));
  results.forEach((x) => { const c = clsOf(x); if (c) cls[c] += 1; });
  const count = { good: 0, inacc: 0, miss: 0 };
  results.forEach((x) => { const c = clsOf(x); if (c) count[markOfCls(c)] += 1; });
  return { acc: acc == null ? null : Math.round(acc), n: real.length, checked: results.length, count, cls, lost: avgLost(results) };
}

// ── v1.21 saved reviews: the same numbers and words for every review, old or new ──
/** A result that still needs the deep (full) engine: it comes from the quick round (m100) and is a real choice, or the score function (leaf) it was judged by is not the current one. */
export const needsFull = (x) => !["forced", "n/a"].includes(x.skip) && ((x.eng || "full") === "m100" || (x.leaf || "v1") !== (REVIEW.budget.leaf || "v1"));
const TODO_KINDS = ["setup", "build", "bank", "buy", "play", "robber", "end"];
/** The recorded decisions of one person that the review checks (record index i). */
export const todoOf = (recs, pid) => (recs || []).map((r, i) => [r, i]).filter(([r]) => r.pid === pid && TODO_KINDS.includes(r.k) && !(r.k === "build" && r.a?.free));
/** Where a review stands: complete (every decision has its deep result), stale (judged by an old score function), checked/total, deep/total. */
export function reviewStatus(recs, rv) {
  const todo = todoOf(recs, rv?.pid), res = rv?.results || [];
  const at = (i) => res.find((y) => y.i === i);
  const complete = !!rv && todo.length > 0 && todo.every(([, i]) => { const x = at(i); return !!x && !needsFull(x); });
  const stale = res.some((r) => r.eng === REVIEW_ENGINE && (r.leaf || "v1") !== (REVIEW.budget.leaf || "v1"));
  return { complete, stale, todo: todo.length, deep: res.filter((x) => !needsFull(x)).length, any: res.length > 0 };
}
/** Bring a saved review to the current format from its own candidates (no engine): the gap, class inputs, accuracy and bank-trade labels.
 *  Stamps rv.fmt. Returns true when it changed something. */
export function rescoreReview(rv) {
  if (!rv?.results || rv.fmt === FMT) return false;
  rv.results = rv.results.map((x) => {
    const E = REVIEW_ENGINES[x.eng || REVIEW_ENGINE] || REVIEW;
    const { lift0, lifted, ...y } = x; // re-derived from the candidates: the lift is applied afresh below
    return rescoreResult(y, { trivial: E.trivial ?? TRIV, scored: x.eng && x.eng !== REVIEW_ENGINE ? E.scored || SCORED_KINDS : SCORED_KINDS, acc: (l) => accuracyOf(l) });
  });
  liftReview(rv);
  rv.fmt = FMT;
  return true;
}
/** v1.29 the same-step lift (score.js liftSameStep) on a review's results, with the accuracy curve. */
export function liftReview(rv) { if (rv?.results) liftSameStep(rv.results, (l) => accuracyOf(l)); return rv; }
