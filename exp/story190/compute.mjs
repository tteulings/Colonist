// node compute.mjs  : A (per-step ledger, F=25) for the 3 fixtures + timings; writes $S/story190/data/<id>.A.json
import fs from "fs";
import { unpackRecs } from "../wt-190/src/review/pack.js";
import { g } from "../wt-190/scripts/ledger/node-engine.mjs";
const { valueAt } = await import("../wt-190/src/review/step-mc.js");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const EXP = { mwg5v7k7j2cc: "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", mwg74y2d49gz: "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", mwb26snvis5o: "c96a5156-colonist-2026-11-11-mwb26snvis5o.json" };
const F = 25, OUT = new URL("./data/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const norm = (v) => { const s = v.reduce((a, c) => a + c, 0); return s > 0 ? v.map((c) => c / s) : v; };
for (const [id, f] of Object.entries(EXP)) {
  const E = JSON.parse(fs.readFileSync(UP + f)), recs = unpackRecs(E.rv.recs), base = E.rv.base, t0 = performance.now();
  const key = (r) => r.st + "|" + JSON.stringify(r.trk) + "|" + r.pid + "|" + r.ts;
  const W = [], ms = []; let skipped = 0, valued = 0;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (typeof r.st !== "string") { W.push(null); ms.push(0); continue; }
    if (i > 0 && W[i - 1] && key(r) === key(recs[i - 1])) { W.push(W[i - 1]); ms.push(0); skipped++; continue; }
    const x = valueAt(g, base, r, { futures: F }); valued++;
    W.push(x.W.map(norm)); ms.push(Math.round(x.ms));
  }
  const total = Math.round(performance.now() - t0);
  fs.writeFileSync(OUT + id + ".A.json", JSON.stringify({ id, F, W, ms, total, valued, skipped, n: recs.length }));
  console.log(id, "recs", recs.length, "valued", valued, "skipped", skipped, "total s", (total / 1000).toFixed(1), "ms/position", Math.round(total / valued));
}
process.exit(0);
