// node step.mjs export.json out.json [F=50] [runs=A,B]   value of EVERY recorded position (luck-MC scale)
import { unpackRecs } from "../../src/review/pack.js";
import { g } from "./node-engine.mjs";
import fs from "fs";
const { valueAt } = await import("../../src/review/step-mc.js");
const [file, out, F = "50", runs = "A,B"] = process.argv.slice(2);
const E = JSON.parse(fs.readFileSync(file, "utf8")), recs = unpackRecs(E.rv.recs), base = E.rv.base;
const R = { id: E.meta.id, F: +F, recs: recs.map((r) => ({ k: r.k, pid: r.pid, t: r.t, s: r.s, e: r.e, a: r.a, ok: typeof r.st === "string" })), runs: {} };
for (const run of runs.split(",")) {
  const t0 = performance.now(), arr = [];
  for (const r of recs) { if (typeof r.st !== "string") { arr.push(null); continue; } const x = valueAt(g, base, r, { futures: +F, jOff: run === "A" ? 0 : run === "B" ? 1000 : 5000 }); arr.push({ v: x.v, se: x.se, ms: Math.round(x.ms) }); }
  R.runs[run] = { arr, totalMs: Math.round(performance.now() - t0) };
  console.log(R.id, "run", run, "F", F, "total s", Math.round(R.runs[run].totalMs / 1000), "positions", arr.filter(Boolean).length);
}
fs.writeFileSync(out, JSON.stringify(R)); process.exit(0);
