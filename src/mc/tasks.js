// Monte Carlo toolkit: the named jobs a runner can run on a headless game (a worker's, or the Node harness's). A task is a pure function of
// (g, args) with JSON args and a JSON result, so the same job gives the same answer inline and on a pool (futures j are independent given the seed).
import { loadPosition } from "../review/engine.js";
import { referenceStrategy } from "../bots/registry.js";
import { futures } from "./futures.js";
import { capture, simulate } from "./simulate.js";
import { winCounts, points, leafSamples } from "./collectors.js";
import { leafOf, luckEvent } from "../review/luck-mc.js";

export const TASKS = {
  /** The review's luck of one chance event (src/review/luck-mc.js). args: { base, ev, opts } */
  luck: (g, a) => luckEvent(g, a.base, a.ev, a.opts || {}),
  /** Futures j0..j1-1 of one recorded position, every seat the reference bot. args: { base, rec, seed, j0, j1, turns, leaf, jitter } -> collector results */
  futures: (g, a) => {
    const st = JSON.parse(a.rec.st), humans = (st.players || []).map((p) => !!p?.isHuman);
    loadPosition(g, { state: { ...st, ...(a.base || {}) }, trk: a.rec.trk, turnSerial: a.rec.ts, seat: a.rec.pid });
    g.players.forEach((p, i) => { if (humans[i] || !p.strategy) p.strategy = referenceStrategy(); });
    const n = g.players.length, cols = [winCounts(n), points(n), leafSamples()];
    const r = simulate({ g, world: capture(g), F: futures({ seed: a.seed }), j0: a.j0, j1: a.j1, turns: a.turns ?? 7, jitter: a.jitter ?? 0.15, leaf: leafOf(a.leaf || "gbm"), collect: cols });
    return { j0: a.j0, j1: a.j1, parts: Object.fromEntries(cols.map((c) => [c.name, c.result()])), samples: r.samples[0] };
  },
};
