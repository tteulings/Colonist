// node tests/evals/run.js [--specs dir] [--lang en|nl] [--game id] [--why] [--json]
//   no --specs: scores the app's recipe pages (recipePage in src/review/ai-page.js) for every fixture = the baseline.
//   --specs dir: dir/<fixtureId>.json holds the page spec an LLM composed for that game ({headline, widgets, follow}); a missing file scores as an empty page.
//   --live [--out dir] [--lang en|nl|both] [--game id] [--n N]: calls the DEPLOYED compose endpoint for every fixture (EN and NL; the synthetic ~noluck ones in EN only), scores
//        the composed pages with the same checks, saves the raw answers and specs in --out (default ./live-out under the scratch dir) and prints the DISTINCTNESS metric
//        (how different the pages are across games: composed vs the recipe pages). --rescore dir scores saved specs again without a call.
//   --why: list every failed check with its reasons.   Exit code 1 when any check fails.
const fs = require("fs"), path = require("path");
const { evalPage } = require("./score.js"), { rehydrate } = require("./fx.js"), { tagsOf } = require("./tags.js");
const a = process.argv.slice(2), opt = (n) => { const i = a.indexOf("--" + n); return i < 0 ? null : (a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : "1"); }, flag = (n) => a.includes("--" + n);
const DIR = path.join(__dirname, "fixtures");

/** All fixtures, plus synthetic variants (marked ~) that remove luck data, so "luck card only when relevant" is testable. */
function fixtures() {
  const F = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")));
  const syn = F.slice(0, 2).map((f) => { const g = JSON.parse(JSON.stringify(f)); g.id += "~noluck"; g.luck = null; Object.keys(g.refs).filter((r) => r.startsWith("luck.")).forEach((r) => delete g.refs[r]); g.tags = tagsOf(rehydrate(g)); return g; });
  return [...F, ...syn];
}
const { spawnSync } = require("child_process");
const URL_ = process.env.COMPOSE_URL || "https://katan-recap-fn.azurewebsites.net/api/recap";
/** POST through curl (it honours the sandbox proxy). Returns the parsed JSON or { error }. */
function post(body) {
  const r = spawnSync("curl", ["-sS", "--max-time", "120", "-H", "Content-Type: application/json", "-w", "\n%{http_code}", "--data-binary", "@-", URL_], { input: JSON.stringify(body), encoding: "utf8", maxBuffer: 1 << 26 });
  const out = (r.stdout || ""), i = out.lastIndexOf("\n"), code = +out.slice(i + 1), txt = out.slice(0, i);
  try { const j = JSON.parse(txt); return code === 200 ? j : { error: `${code} ${j.error || ""}` }; } catch (e) { return { error: `${code || "curl"} ${(r.stderr || txt).slice(0, 120)}` }; }
}
/** Structure features of a validated page: what it contains and in which order. Player keys become roles so that two games can share a feature. */
function features(page, fx) {
  const Y = fx.keys[fx.me], W = fx.winner != null ? fx.keys[fx.winner] : null, role = (k) => (k === Y ? "you" : k === W ? "winner" : "other");
  const norm = (sig) => String(sig).replace(/\b(?:name|pts|strat|luck\.total|rate\.[a-z]+)\.([a-z0-9]+)/g, (m, k) => m.replace(k, role(k))).replace(/\d+/g, "#");
  const f = new Set(), w = page.widgets || [];
  w.forEach((x, i) => { const bl = [...x.blocks, ...x.expand]; f.add(`pos${i}:${x.level}`); f.add(`seq:${x.level}:${bl.map((b) => b.p).join("+")}`); bl.forEach((b) => f.add(`blk:${norm(JSON.stringify({ p: b.p, m: b.metric, o: b.of, r: !!b.robber, d: b.dec != null, t: b.turn === 0 ? 0 : undefined, pl: (b.players || []).map(role), show: b.show }))}`)); });
  f.add(`n:${w.length}`); f.add(`head:${page.headline ? 1 : 0}`);
  return f;
}
const jac = (a, b) => { const i = [...a].filter((x) => b.has(x)).length, u = new Set([...a, ...b]).size; return u ? 1 - i / u : 0; };
/** Mean pairwise distance (0..100) of the pages of different games. */
const distinct = (sets) => { const d = []; for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) d.push(jac(sets[i], sets[j])); return d.length ? Math.round((100 * d.reduce((a, b) => a + b, 0)) / d.length) : 0; };
const wordsOf = (page, fx) => { const w = new Set(); const walk = (ps) => (ps || []).forEach((p) => { if (typeof p === "string") p.toLowerCase().match(/[a-zà-ÿ]+/g)?.forEach((x) => x.length > 3 && w.add(x)); }); (page.widgets || []).forEach((x) => walk(x.title)); return w; };

async function live() {
  const lang = opt("lang") || "both", only = opt("game"), rescore = opt("rescore"), outDir = opt("out") || (rescore && rescore !== "1" ? rescore : path.join(__dirname, "live-out")), cap = +opt("n") || 99;
  fs.mkdirSync(outDir, { recursive: true });
  const { composeIndex, toSpec } = await import("../../src/review/ai-compose.js"), { recipePage, validatePage } = await import("../../src/review/ai-page.js");
  const rows = [], pages = { en: [], nl: [], rec: [] }; let calls = 0;
  for (const F of fixtures()) {
    if (only && !F.id.startsWith(only)) continue;
    const syn = F.id.includes("~"), langs = lang === "both" ? (syn ? ["en"] : ["en", "nl"]) : [lang];
    const fx = rehydrate(F);
    if (!syn) pages.rec.push({ id: F.id, f: features(validatePage(recipePage(fx), fx), fx), w: wordsOf(validatePage(recipePage(fx), fx), fx) });
    for (const L of langs) {
      const file = path.join(outDir, `${F.id}.${L}.json`); let spec = null, raw = null, err = null;
      if (rescore || (fs.existsSync(file) && process.argv.includes("--cache"))) { try { ({ raw } = JSON.parse(fs.readFileSync(file, "utf8"))); spec = toSpec(raw, rehydrate({ ...F, lang: L })); } catch (e) { err = "no saved answer"; } }
      else {
        if (calls >= cap) continue;
        calls++; const t0 = Date.now(), r = post({ mode: "compose", lang: L, index: composeIndex(rehydrate({ ...F, lang: L })), examples: recipePage(rehydrate({ ...F, lang: L })) });
        if (r.error || !r.compose) err = r.error || "no compose"; else { raw = r.compose; spec = toSpec(raw, rehydrate({ ...F, lang: L })); fs.writeFileSync(file, JSON.stringify({ raw, spec, repairs: spec._repairs, ms: Date.now() - t0, usage: r.usage }, null, 1)); }
      }
      if (err) { rows.push({ id: F.id, lang: L, err, checks: {}, passed: 0, total: 14, tags: [] }); console.log(`${F.id} ${L} ERROR ${err}`); continue; }
      const row = await evalPage(spec, F, { lang: L }); row.lang = L; row.repairs = (spec._repairs || []).length; row.rawDrops = validatePage(toSpec(raw), rehydrate({ ...F, lang: L })).dropped.length; rows.push(row);
      if (!syn) { const v = validatePage(spec, fx); pages[L].push({ id: F.id, f: features(v, fx), w: wordsOf(v, fx) }); }
    }
  }
  const names = rows.find((r) => r.passed != null && Object.keys(r.checks).length)?.checks; if (!names) { console.log("no scored rows"); process.exitCode = 1; return; }
  const ck = Object.keys(names), W = Math.max(...rows.map((r) => r.id.length));
  console.log(`\n${"game".padEnd(W)} lang ` + ck.map((c) => c.slice(0, 6).padEnd(6)).join(" ") + "  score");
  rows.forEach((r) => console.log(`${r.id.padEnd(W)} ${r.lang}   ` + (r.err ? r.err : ck.map((c) => (r.checks[c].pass ? "ok" : "FAIL").padEnd(6)).join(" ") + `  ${r.passed}/${r.total}  (repaired ${r.repairs}, raw validator drops ${r.rawDrops})`)));
  ["en", "nl"].forEach((L) => { const rr = rows.filter((r) => r.lang === L && !r.err); if (rr.length) console.log(`${L}: ` + ck.map((c) => `${c}=${rr.filter((r) => r.checks[c].pass).length}/${rr.length}`).join(" ")); });
  if (flag("why") || true) rows.forEach((r) => ck.filter((c) => r.checks?.[c] && !r.checks[c].pass).forEach((c) => console.log(`  ${r.id} ${r.lang} [${c}] ${r.checks[c].why.slice(0, 3).join(" | ").slice(0, 300)}`)));
  const rec = distinct(pages.rec.map((p) => p.f)), recW = distinct(pages.rec.map((p) => p.w));
  const line = (k, P) => P.length > 1 ? `${k}: structure ${distinct(P.map((p) => p.f))}  titles ${distinct(P.map((p) => p.w))}  (${P.length} games)` : `${k}: n/a`;
  console.log(`\nDISTINCTNESS (mean pairwise distance across games, 0 = identical pages, 100 = nothing shared)\n  recipes  structure ${rec}  titles ${recW}  (${pages.rec.length} games)\n  ${line("composed en", pages.en)}\n  ${line("composed nl", pages.nl)}`);
  console.log(`calls ${calls}`);
  const bad = rows.filter((r) => r.err || r.passed < r.total).length; process.exitCode = bad ? 1 : 0;
}

(async () => {
  if (flag("live") || flag("rescore") || opt("rescore")) return live();
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
