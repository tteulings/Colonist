// v1.90.2 adds the development-card luck of every card purchase (the app's own luck run: src/review/luck-mc.js, kind "dev": V(card drawn) - sum p(card) V(card)) to tests/evals/ledger/<id>.json,
// under "dev:<s>:<e>" like the app's store (R.luck.res). The ledger splits a purchase into Keuze (the expectation) and Geluk (this).  node tests/evals/add-devluck190.mjs <export.json> <id> [...]
import fs from "fs";
import { unpackRecs } from "../../src/review/pack.js";
import { g } from "../../scripts/ledger/node-engine.mjs";
import { luckEvent, luckEvents } from "../../src/review/luck-mc.js";
const args = process.argv.slice(2), OUT = new URL("./ledger/", import.meta.url).pathname;
for (let k = 0; k < args.length; k += 2) {
  const E = JSON.parse(fs.readFileSync(args[k])), id = args[k + 1], recs = unpackRecs(E.rv.recs), base = E.rv.base, L = JSON.parse(fs.readFileSync(OUT + id + ".json"));
  const evs = luckEvents(recs, E.state.stats, {}).filter((e) => e.kind === "dev"); let n = 0;
  for (const ev of evs) { const x = luckEvent(g, base, ev, {}); const key = `dev:${ev.s}:${ev.e}`; if (x && x.luck) { L.res[key] = { k: "dev", s: ev.s, e: ev.e, l: x.luck.map((v) => Math.round(v * 1e4) / 1e4), F: x.F }; n++; } else L.res[key] = { k: "dev", s: ev.s, e: ev.e, skip: x?.skip || "error" }; }
  fs.writeFileSync(OUT + id + ".json", JSON.stringify(L)); console.log(id, "dev draws", evs.length, "with luck", n, evs.map((e) => [e.i, e.pid, e.card]).join(" "));
}
process.exit(0);
