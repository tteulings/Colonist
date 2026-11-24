// Cost of the Monte Carlo toolkit's building blocks per mode (architecture step 6):  node scripts/mc-bench.mjs [--json]
//   capture / reinstate  src/mc/simulate.js (snapshot + the roll's extras, and putting it back)
//   Engine.clone         src/api/engine.js clone() (parked snapshot) and the first use (one restore)
//   rollout              7 turn ends of bot play from a mid-game position (ms), and per turn end
// bytes: v8.serialize size of the captured position (structured-clone size, what a worker message or a stored snapshot costs).
import v8 from "node:v8";
import { bootHeadless } from "../src/api/headless.js";
import { newGame } from "../src/api/engine.js";
import { mulberry32, rollout } from "../src/master/sim.js";
import { capture, reinstate, playTurns } from "../src/mc/simulate.js";
import { futures } from "../src/mc/futures.js";
import { withoutAgents } from "../src/master/sim.js";

const g = await bootHeadless();
const now = () => performance.now();
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const time = (fn, reps, rounds = 7) => { for (let i = 0; i < reps; i++) fn(); const r = []; for (let k = 0; k < rounds; k++) { const t = now(); for (let i = 0; i < reps; i++) fn(); r.push(((now() - t) / reps) * 1000); } return med(r); }; // microseconds, median of rounds
const MODES = [["classic (4p)", { seats: 4 }], ["Seafarers (3p)", { seats: 3, sea: true }], ["5-6 players (6p)", { seats: 6 }]];
const rows = [];
for (const [name, spec] of MODES) {
  const e = newGame(g, { ...spec, seed: 5 });
  e.release();
  const rng = mulberry32(11); Math.random = rng;
  let k = 0; while (g.setupPhase && k++ < 80) { g.setupAction = null; g.processSetupQueue(); }
  rollout(g, 36, mulberry32(3), {}); // mid game
  if (g.phase !== "pre_roll") rollout(g, 1, mulberry32(4), {});
  const w = capture(g);
  const bytes = v8.serialize(w).length, json = JSON.stringify(w).length;
  const cap = time(() => capture(g), 400), back = time(() => reinstate(g, w), 400);
  const eng = newGame(g, { ...spec, seed: 5 }); // (clone() needs an Engine on the position: re-create and load)
  Math.random = mulberry32(11); // the engine game is a fresh one; position it the same way through the engine's game object
  reinstate(g, w);
  const clone = time(() => { const c = eng.clone(); c.dispose(); eng._enter(); }, 100, 5);
  eng.release();
  const turns = 7, F = futures({ seed: 131 });
  const roll = time(() => { reinstate(g, w); const f = F.rngs(0); withoutAgents(g, () => playTurns(g, turns, f.policy, f.dice)); }, 6, 5);
  rows.push({ mode: name, captureUs: +cap.toFixed(1), reinstateUs: +back.toFixed(1), cloneUs: +clone.toFixed(1), bytesV8: bytes, bytesJson: json, rollout7Ms: +(roll / 1000).toFixed(2), perTurnMs: +(roll / 1000 / turns).toFixed(2) });
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
else { console.log("mode               capture(us) reinstate(us) clone+enter(us) bytes(v8) bytes(json) rollout-7-turns(ms) per-turn(ms)"); rows.forEach((r) => console.log(`${r.mode.padEnd(18)} ${String(r.captureUs).padStart(10)} ${String(r.reinstateUs).padStart(12)} ${String(r.cloneUs).padStart(15)} ${String(r.bytesV8).padStart(10)} ${String(r.bytesJson).padStart(11)} ${String(r.rollout7Ms).padStart(20)} ${String(r.perTurnMs).padStart(12)}`)); }
process.exit(0);
