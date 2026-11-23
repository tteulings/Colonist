// node tests/tourn196.mjs : the tournament tool is reproducible (same args twice, and workers 1 vs 4) and resumable.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tourn196-"));
const T = new URL("../scripts/tournament.mjs", import.meta.url).pathname;
const run = (name, workers, extra = []) => {
  const out = path.join(dir, name + ".jsonl");
  const r = spawnSync("node", ["--no-warnings", T, "--bots", "expert,intermediate,master@6", "--games", "40", "--mode", "classic", "--seats", "4", "--seed", "7", "--workers", String(workers), "--out", out, "--quiet", ...extra], { encoding: "utf8" });
  if (r.status) throw new Error(r.stderr + r.stdout);
  return { out, text: r.stdout };
};
const rows = (f) => fs.readFileSync(f, "utf8").split("\n").filter((l) => l.startsWith("{") && l.endsWith("}")).map((l) => JSON.parse(l)).filter((r) => r.game != null).map(({ ms, ...r }) => r).sort((a, b) => a.game - b.game);
let bad = 0; const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) bad++; };
const a = run("a", 2), b = run("b", 2), c = run("c", 1), d = run("d", 4);
eq("40 games written", rows(a.out).length, 40);
eq("same args twice -> identical games", rows(a.out), rows(b.out));
eq("workers 1 vs 4 -> identical games", rows(c.out), rows(d.out));
eq("summary text identical (modulo speed line)", a.text.split("\n").slice(0, -2), d.text.split("\n").slice(0, -2));
// resume: keep the first 15 lines of a, finish with 3 workers -> same games
const e = path.join(dir, "e.jsonl"); fs.writeFileSync(e, fs.readFileSync(a.out, "utf8").split("\n").slice(0, 15).join("\n") + "\n{\"game\":3"); // + a torn line
const r = spawnSync("node", ["--no-warnings", T, "--bots", "expert,intermediate,master@6", "--games", "40", "--seed", "7", "--workers", "3", "--out", e, "--quiet"], { encoding: "utf8" });
if (r.status) throw new Error(r.stderr);
eq("resume completes to the identical set", rows(e).length === 40 && JSON.stringify(rows(e).map((x) => x.game)) === JSON.stringify([...Array(40).keys()]), true);
eq("resume: same results as uninterrupted", rows(e), rows(a.out));
// seat balance: 3 bots on 4 seats rotate; every bot sits in every seat equally over 12 games
const per = {}; rows(a.out).slice(0, 12).forEach((g) => g.bots.forEach((x, s) => { per[x + s] = (per[x + s] || 0) + 1; }));
eq("seat rotation balanced over a cycle (12 games)", new Set(Object.values(per)).size, 1);
// header: the budgets are pinned; app budgets by default, golden ones with --golden-budgets; resume refuses a different budget
const head = (f) => JSON.parse(fs.readFileSync(f, "utf8").split("\n")[0]).header;
eq("header holds the search budget (master@6 -> n 6, app depth, no wall brake)", [head(a.out).budgets["master@6"].n, head(a.out).budgets["master@6"].wallCapMs], [6, 1e9]);
const gout = path.join(dir, "g.jsonl");
const gr = spawnSync("node", ["--no-warnings", T, "--bots", "master,expert", "--games", "2", "--workers", "1", "--golden-budgets", "--out", gout, "--quiet"], { encoding: "utf8" });
const gold = { out: gout }; if (gr.status) throw new Error(gr.stderr);
eq("--golden-budgets is recorded in the header", head(gold.out).budgets, "golden");
const app = spawnSync("node", ["--no-warnings", T, "--bots", "master", "--games", "1", "--workers", "1", "--budget", "master=77", "--out", path.join(dir, "h.jsonl"), "--quiet", "--seats", "2"], { encoding: "utf8" });
eq("--budget master=77 lands in the header", app.status === 0 && head(path.join(dir, "h.jsonl")).budgets.master.n, 77);
const bad1 = spawnSync("node", ["--no-warnings", T, "--bots", "master", "--games", "2", "--workers", "1", "--budget", "master=78", "--out", path.join(dir, "h.jsonl"), "--quiet", "--seats", "2"], { encoding: "utf8" });
eq("resume with another budget is refused", bad1.status !== 0 && /header differs/.test(bad1.stderr), true);
console.log(bad ? bad + " FAILED" : "ALL OK"); process.exit(bad ? 1 : 0);
