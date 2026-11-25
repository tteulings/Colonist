// v1.99 the TEXT localizer (src/post-text.js) against every label, why line and chip of the 39 games (2 fixtures + 37 calibration games), EN and NL:
//   node tests/text199.js        (no browser)   - every engine fragment parses (unknown = FAIL), nothing English / port / road-race is left in Dutch, no "undefined".
const fs = require("fs"), path = require("path"), zlib = require("zlib");
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = path.join(__dirname, "..");
(async () => {
  const T = await import(path.join(ROOT, "src/post-text.js"));
  const files = [];
  for (const f of fs.readdirSync(path.join(__dirname, "evals/calib199")).filter((x) => x.endsWith(".json.gz")).sort()) files.push(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, "evals/calib199", f)))));
  for (const f of fs.readdirSync(path.join(__dirname, "fixtures/post199")).filter((x) => x.endsWith(".json")).sort()) files.push(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/post199", f), "utf8")));
  const S = { label: new Set(), why: new Set(), chip: new Set() };
  for (const j of files) for (const rid of Object.keys(j.rv?.reviews || {})) for (const x of j.rv.reviews[rid].results || []) {
    [x.label, x.best?.label, ...(x.cands || []).map((c) => c.label)].filter(Boolean).forEach((l) => S.label.add(l));
    if (x.why) { [x.why.plan, x.why.vs, x.why.head].filter(Boolean).forEach((w) => S.why.add(w)); (x.why.chips || []).forEach((c) => S.chip.add(c)); }
  }
  let fails = 0; const bad = (m) => { fails += 1; if (fails < 40) console.log("FAIL", m); };
  const EN_NL = /\b(the|then|and|of|with|completes|trade|dice|dots?|port|lumber|brick|wool|grain|ore|settlement|city|road|roads|turns?|cards?|reaches|adds|blocks|takes|nothing|builds|income|doubles|spot|spots|room|resources?|short|affordable|keeps|uses|needs|missing|gave|traded|knight|robber|play|end|dev)\b/i;
  const OUT = /\bports?\b|\bhaven\b|longest road|largest army|langste|grootste|:1\b/i;
  for (const lg of ["en", "nl"]) {
    for (const l of S.label) { const a = T.moveFull(l, lg), b = T.moveTerse(l, lg); if (!a || !b) { bad(`${lg} label unparsed: ${l}`); continue; } if (lg === "nl" && (EN_NL.test(a.replace(/\b(Rover)\b/, "")) || EN_NL.test(b))) bad(`nl label has English: ${l} -> ${a} | ${b}`); if (/undefined|NaN/.test(a + b)) bad(`bad text ${l}`); }
    for (const w of S.why) { T.whyLine(w, lg); }
    for (const c of S.chip) { const r = T.whyItem(c, lg); if (r.unknown) bad(`${lg} chip unknown: ${c}`); }
    for (const w of S.why) for (const it of w.split(" · ")) { const r = T.whyItem(it, lg); if (r.unknown) bad(`${lg} why item unknown: ${it}`); else if (r.t) { if (OUT.test(r.t)) bad(`${lg} out-of-scope word: ${it} -> ${r.t}`); if (lg === "nl" && EN_NL.test(r.t)) bad(`nl why has English: ${it} -> ${r.t}`); if (/undefined|NaN/.test(r.t)) bad(`bad text ${it}`); } }
  }
  console.log(`${S.label.size} labels, ${S.why.size} why lines, ${S.chip.size} chips x EN+NL; unknown: ${T.unknown.size}`); [...T.unknown].slice(0, 30).forEach((u) => console.log("  unknown", u));
  console.log(fails || T.unknown.size ? `${fails + T.unknown.size} FAILED` : "ALL OK"); process.exit(fails || T.unknown.size ? 1 : 0);
})();
