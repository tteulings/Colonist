// node tests/golden/run.mjs [--only substr] [--quiet]     The golden net: seeded games, saved-game replays and review numbers, all headless.
// Exit 0 only when every value equals its golden (tests/golden/*.json). Prints a table and games/second per group.
import fs from "node:fs";
import { checks, FILES } from "./checks.mjs";
const here = new URL("./", import.meta.url).pathname;
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
const gold = {}; for (const k of Object.keys(FILES)) gold[k] = fs.existsSync(here + FILES[k]) ? JSON.parse(fs.readFileSync(here + FILES[k], "utf8")) : {};
const rows = [], per = {}; let bad = 0; const t00 = Date.now();
if (process.argv.includes("--reverse")) checks.reverse(); // order-independence: no game may leak state into the next
for (const c of checks) {
  if (only && !c.id.includes(only)) continue;
  const t0 = performance.now(); let val, err = null;
  try { val = await c.run(); } catch (e) { err = e; }
  const ms = Math.round(performance.now() - t0), want = gold[c.file][c.id];
  const ok = !err && want !== undefined && stable(val) === stable(want);
  if (!ok) bad++;
  (per[c.group] ||= { n: 0, ms: 0 }); per[c.group].n++; per[c.group].ms += ms;
  rows.push([ok ? "ok" : err ? "ERROR" : want === undefined ? "NEW" : "DIFF", c.file, c.id, val?.movesHash || val?.series || val?.loaded || "", String(ms) + " ms"]);
  if (!ok) console.log(`${c.id}: ${err ? err.stack : want === undefined ? "no golden" : "got  " + stable(val).slice(0, 400) + "\n      want " + stable(want).slice(0, 400)}`);
}
const w = [0, 1, 2, 3, 4].map((i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log(r.map((x, i) => x.padEnd(w[i])).join("  "));
console.log("\ngroup                 checks   s total   per second");
for (const [k, v] of Object.entries(per)) console.log(`${k.padEnd(20)}  ${String(v.n).padStart(5)}  ${(v.ms / 1000).toFixed(1).padStart(8)}  ${(v.n / (v.ms / 1000)).toFixed(2).padStart(10)}`);
console.log(`\n${bad ? bad + " FAILED" : "ALL " + rows.length + " MATCH"} in ${((Date.now() - t00) / 1000).toFixed(1)} s`);
process.exit(bad ? 1 : 0);
