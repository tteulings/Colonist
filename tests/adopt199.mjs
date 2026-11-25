// Proof of "adopt the probe" (src/bots/probe.js): a planner step that did exactly one build / buyDev / tradeBank is let stand by the host. This test plays
// games the OLD way (restore, then apply) and, at every such step, compares the position the planner left (what would have been adopted) with the position
// the apply produces: snapshot() of every field the sim copies, the whole serializeState() (time stamps dropped), the card tracker and the Math.random call count.
//   node tests/adopt199.mjs [games-per-shape=20]
import { g, playGame, hostMode, randomCalls } from "./golden/lib.mjs";
import { probeHooks } from "../src/bots/probe.js";
import { snapshot } from "../src/master/sim.js";

const N = +(process.argv[2] || 20);
const strip = (k, v) => (k === "time" || k === "agent" || k === "strategy" ? undefined : v);
const grab = (G) => ({ snap: JSON.stringify(snapshot(G), strip), ser: JSON.stringify(G.serializeState(), strip), rc: randomCalls(), trk: JSON.stringify(G._aiCardTrack?.est ?? null) });
let checked = 0; const bad = [], kinds = {};
probeHooks.verify = {
  pending: null, by: {}, shown: {},
  /** the host has just applied `a` ADOPTED; put the game back, play it the old way (restore + apply), compare the two positions, and carry on from the old one */
  check(engine, a, opts) {
    const V = probeHooks.verify, p = V.pending; V.pending = null; checked++; kinds[a.type] = (kinds[a.type] || 0) + 1;
    const X = grab(g), nlog = engine._log.length;
    p.rewind(); engine._log.length = nlog - 1;
    engine.apply(a, opts);
    const Y = grab(g);
    for (const k of ["snap", "ser", "rc", "trk"]) if (X[k] !== Y[k]) {
      const key = a.type + ":" + k; V.by[key] = (V.by[key] || 0) + 1;
      if (!V.shown[key]) { V.shown[key] = 1; const x = X[k], y = Y[k]; let i = 0; while (i < x.length && x[i] === y[i]) i++; bad.push(`${a.type} ${k} differs at ${i}:\n  adopted: ${String(x).slice(Math.max(0, i - 100), i + 140)}\n  applied: ${String(y).slice(Math.max(0, i - 100), i + 140)}`); } else bad.push(null);
      break;
    }
  },
};
const SHAPES = [
  { m: "classic", seats: ["expert", "simple", "intermediate", "expert"] },
  { m: "classic", seats: ["trader", "builder", "shark", "beginner"], map: "balanced" },
  { m: "classic-deck", seats: ["expert", "expert", "intermediate", "simple"], dice: "deck", winPoints: 8 },
  { m: "sea", seats: ["expert", "intermediate", "expert", "trader"], sea: true },
  { m: "six", seats: ["expert", "shark", "intermediate", "trader", "builder", "expert"] },
  { m: "master", seats: ["master", "expert", "super", "intermediate"] },
];
hostMode.on = true;
for (const S of SHAPES) {
  const n = /master/.test(S.m) ? Math.max(2, N >> 2) : N;
  for (let i = 0; i < n; i++) playGame({ id: "v", seed: 7000 + i * 13, ...S });
  console.log(`${S.m}: ${n} games, ${checked} checked so far, ${bad.filter(Boolean).length} differ`);
}
console.log(JSON.stringify(kinds), JSON.stringify(probeHooks.verify.by));
console.log(bad.length ? bad.filter(Boolean).join("\n") + `\n${bad.length} DIFFER of ${checked}` : `ALL ${checked} adopted steps equal their restore+apply`);
process.exit(bad.length ? 1 : 0);
