// node tests/evals/run.js [--specs dir] [--lang en|nl] [--game id] [--why] [--json]
//   no --specs: scores the app's recipe pages (recipePage in src/review/ai-page.js) for every fixture = the baseline.
//   --specs dir: dir/<fixtureId>.json holds the page spec an LLM composed for that game ({headline, widgets, follow}); a missing file scores as an empty page.
//   --why: list every failed check with its reasons.   Exit code 1 when any check fails.
const fs = require("fs"), path = require("path");
const { evalPage } = require("./score.js"), { rehydrate } = require("./fx.js"), { tagsOf } = require("./tags.js");
const a = process.argv.slice(2), opt = (n) => { const i = a.indexOf("--" + n); return i < 0 ? null : a[i + 1]; }, flag = (n) => a.includes("--" + n);
const DIR = path.join(__dirname, "fixtures");

/** All fixtures, plus synthetic variants (marked ~) that remove luck data, so "luck card only when relevant" is testable. */
function fixtures() {
  const F = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));
  const syn = F.slice(0, 2).map((f) => { const g = JSON.parse(JSON.stringify(f)); g.id += "~noluck"; g.luck = null; Object.keys(g.refs).filter((r) => r.startsWith("luck.")).forEach((r) => delete g.refs[r]); g.tags = tagsOf(rehydrate(g)); return g; });
  return [...F, ...syn];
}
(async () => {
  const sdir = opt("specs"), lang = opt("lang"), only = opt("game"), { recipePage } = await import("../../src/review/ai-page.js");
  const rows = [];
  for (const F of fixtures()) {
    if (only && !F.id.startsWith(only)) continue;
    let spec;
    if (sdir) { const f = path.join(sdir, `${F.id}.json`); try { spec = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { spec = {}; } }
    else spec = recipePage(rehydrate(F));
    rows.push(await evalPage(spec, F, { lang: lang || undefined }));
  }
  if (flag("json")) { console.log(JSON.stringify(rows, null, 1)); return; }
  const names = Object.keys(rows[0].checks), short = (n) => n.replace("no-contradiction", "contra").replace("traceable", "trace").replace("validator", "valid").replace("text-limits", "limits").replace("points-not-vp", "pts").replace("luck-relevant", "luckok").replace("no-causal", "causal").replace("language", "lang").replace("max-cards", "max6").replace("cov-", "cov-").replace("no-dup", "dup");
  const W = Math.max(...rows.map((r) => r.id.length)), cols = names.map(short);
  console.log(`${"game".padEnd(W)} ${"won".padEnd(4)} ` + cols.map((c) => c.padEnd(Math.max(c.length, 4))).join(" ") + "  score");
  rows.forEach((r) => console.log(`${r.id.padEnd(W)} ${(r.tags.includes("won") ? "won" : "lost").padEnd(4)} ` + names.map((n, i) => (r.checks[n].pass ? "ok" : "FAIL").padEnd(Math.max(cols[i].length, 4))).join(" ") + `  ${r.passed}/${r.total}`));
  console.log(`${"checks passed".padEnd(W)} ${"".padEnd(4)} ` + names.map((n, i) => `${rows.filter((r) => r.checks[n].pass).length}/${rows.length}`.padEnd(Math.max(cols[i].length, 4))).join(" "));
  if (flag("why")) rows.forEach((r) => names.filter((n) => !r.checks[n].pass).forEach((n) => console.log(`  ${r.id} [${n}] ${r.checks[n].why.slice(0, 4).join(" | ")}`)));
  const tot = rows.reduce((s, r) => s + r.passed, 0), all = rows.reduce((s, r) => s + r.total, 0); console.log(`total ${tot}/${all}`);
  process.exitCode = tot === all ? 0 : 1;
})();
