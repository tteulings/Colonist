import { unpackRecs } from "../../src/review/pack.js";
import { g } from "./node-engine.mjs";
const { valueAt } = await import("../../src/review/step-mc.js");
import fs from "fs";
const E = JSON.parse(fs.readFileSync("/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "utf8"));

const recs = unpackRecs(E.rv.recs), base = E.rv.base;
console.log(recs.length, recs.filter(r=>typeof r.st!=="string").length);
for (const i of [10, 30, 60]) { const r = valueAt(g, base, recs[i], { futures: 50 }); console.log(i, recs[i].k, r.v.map(x=>x.toFixed(3)).join(" "), r.se.map(x=>x.toFixed(3)).join(" "), Math.round(r.ms)); }
process.exit(0);
