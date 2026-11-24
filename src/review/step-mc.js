// v1.90 STEP LEDGER (worker side): the value (every seat's win chance) of a recorded position, on the SAME scale as luck-mc.js (same leaf, depth, play, dice streams),
// so that the change between two consecutive positions telescopes. Futures j use the same seeds in every position (common random numbers).
import { withoutAgents } from "../master/sim.js";
import { futures } from "../mc/futures.js";
import { simulate, capture } from "../mc/simulate.js"; // step 6: the futures run on the Monte Carlo toolkit
import { referenceStrategy } from "../bots/registry.js"; // step 4: the review's reference player comes from the bot registry
import { loadPosition } from "./engine.js";
import { leafOf } from "./luck-mc.js";
import { packW } from "./ledger.js";
export const STEP_MC = { futures: 50, depth: 7, seed: 131 };
/** { v: [seats], se: [seats], F } ; rec.st is the position BEFORE the record. */
export function valueAt(g, base, rec, opts = {}) {
  const o = { ...STEP_MC, ...opts }, t0 = performance.now();
  const st = JSON.parse(rec.st), humans = (st.players || []).map((p) => !!p?.isHuman);
  loadPosition(g, { state: { ...st, ...base }, trk: rec.trk, turnSerial: rec.ts, seat: rec.pid });
  g.players.forEach((p, i) => { if (humans[i] || !p.strategy) p.strategy = referenceStrategy(); });
  const n = g.players.length;
  if (o.pass && g.phase === "main" && !g.winner) withoutAgents(g, () => g.endTurn()); // B: "end turn instead" (the pass valuation)
  if (g.winner) return { v: Array.from({ length: n }, (_, q) => (q === g.winner.id ? 1 : 0)), se: Array(n).fill(0), F: 0, W: [], ms: 0 };
  const S0 = capture(g), keepR = Math.random, leaf = leafOf(o.leaf);
  let W;
  try { W = simulate({ g, world: S0, F: futures({ seed: o.seed, offset: o.jOff || 0 }), n: o.futures, turns: o.depth, leaf, headless: false }).samples[0]; } finally { Math.random = keepR; }
  const F = W.length, v = Array.from({ length: n }, (_, q) => W.reduce((a, w) => a + w[q], 0) / F);
  const se = v.map((m, q) => Math.sqrt(W.reduce((a, w) => a + (w[q] - m) ** 2, 0) / Math.max(1, F - 1) / F));
  return { v, se, F, W, ms: performance.now() - t0 };
}

const norm = (v) => { const s = v.reduce((a, c) => a + c, 0); return s > 0 ? v.map((c) => c / s) : v; };
/** v1.90 one ledger position for the page: { v, se, F, w } with w = the futures (every one normalised to 100%) packed as 2 base-36 characters a value (src/review/ledger.js packW),
 *  so two positions of a game can be paired future by future (same seeds). ev = { rec, F, pass? }; pass: value of "end the turn instead" (progress credit). */
export function posValue(g, base, ev, opts = {}) {
  const o = { futures: ev.F || STEP_MC.futures, ...(ev.pass ? { pass: true } : {}), ...(opts.leaf ? { leaf: opts.leaf } : {}) };
  const x = valueAt(g, base, ev.rec, o), W = x.W.length ? x.W.map(norm) : Array.from({ length: o.futures }, () => x.v), F = W.length, n = W[0]?.length || 0;
  const v = Array.from({ length: n }, (_, q) => W.reduce((a, w) => a + w[q], 0) / Math.max(1, F));
  const se = v.map((m, q) => Math.sqrt(W.reduce((a, w) => a + (w[q] - m) ** 2, 0) / Math.max(1, F - 1) / Math.max(1, F)));
  return { kind: "pos", v: v.map((c) => Math.round(c * 1e6) / 1e6), se: se.map((c) => Math.round(c * 1e4) / 1e4), F, w: packW(W), ms: Math.round(x.ms) };
}
