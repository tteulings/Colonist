// v1.99 SCREEN AUDIT: every number on every post-game screen is a fact of the store (src/post-facts.js).
//   node tests/facts199-ui.js PORT        (server: node tests/serve.mjs ROOT PORT)
//   env LANGS=en,nl (default both) · GAMES=<regex on the game tag> · CALIB=<n> (only the first n calib games) · QUICK=1 (fixtures + 3 calib games)
// For each screen the visible text is walked:
//   1. every number token (digits, %, +, −, ±) must sit inside an element with data-fact="<id>:<seat> [...]"  - or match the explicit ALLOW list below;
//   2. a tagged element must show exactly the numbers of the facts it names (same digits, same sign, % only after a win-chance unit, nothing else);
//   3. the same fact id shows the same number wherever it appears in a game (all screens);
//   4. no NaN / undefined / null.
//   5. TEXT on every screen of every game (v1.99 r2): no English words in Dutch and no Dutch words in English (an independent word scan, not the localizer's own `misses`),
//      no port / robber / road-race / fed words, and a max of 2 lines for the headline, captions, rows and sub-lines (line boxes measured).
// Games: the 2 fixtures (tests/fixtures/post199) and the 37 calibration games (tests/evals/calib199): Overview, Moves, Strategy, Luck (win chance, cards, other players' rolls),
// the Numbers and (i) sheets and the player pages for every seat on the fixtures; Overview, Moves, Strategy, Luck, Numbers, (i), Bekijk bord and two player pages on the calibration games.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path"), zlib = require("zlib");
const port = +process.argv[2] || 8781, ROOT = path.join(__dirname, ".."), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, checks = 0; const ok = (c, m, x = "") => { checks += 1; if (!c) { fails += 1; console.log(`FAIL ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); } };
const games = [];
for (const f of fs.readdirSync(path.join(__dirname, "fixtures", "post199")).filter((x) => x.endsWith(".json")).sort()) games.push({ tag: f.replace(".json", ""), fixture: true, j: JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "post199", f), "utf8")) });
{ const cdir = path.join(__dirname, "evals", "calib199"); fs.readdirSync(cdir).filter((x) => x.endsWith(".json.gz")).sort().forEach((f) => games.push({ tag: f.replace(".json.gz", ""), fixture: false, j: null, file: path.join(cdir, f) })); }
let sel = games; if (process.env.GAMES) sel = sel.filter((g) => new RegExp(process.env.GAMES).test(g.tag));
if (process.env.QUICK) sel = sel.filter((g, i) => g.fixture || i < 5); if (process.env.CALIB) sel = sel.filter((g) => g.fixture).concat(sel.filter((g) => !g.fixture).slice(0, +process.env.CALIB));

// ── the explicit ALLOW list: numbers that are labels, not measurements ──
//   selectors: rank in a list, lesson badge, timeline pins, board stop buttons, dice numbers on board tiles, chart axis ticks, the 0/50/100 scale, tab labels ("5 players"), the pick number badge
const ALLOW_SEL = [".rk", ".px-nb", ".pin", ".px-dash", ".px-tile", ".px-stops", ".px-sk", ".px-tl text", ".px-sc text", ".px-scat", ".px-scale", ".bpg-tabs", ".px-seg", ".px-bd", ".ltr", ".pn", ".px-mdots", ".px-tk > i", ".px-ln", ".rv-tabs", ".px-door", ".hs-bar", ".px-pips", ".px-leg", ".px-cls", ".px-av", ".rt-av", "[data-i18n-av]", ".px-bt", ".px-crops"];
//   text patterns (EN + NL): turn numbers inside labels, pick numbers, version, dates, the "T14" chart label
const ALLOW_RE = [
  /\b(?:turns?|beurten|beurt)\s+\d+(?:\s*(?:[–-]|and|en)\s*\d+)?/gi, /\b[TB]\d+\b/g, /(?:pick|keuze)\s+\d+/gi, /\b(?:version|versie)\s+\d+/gi, /\bv\d+(?:\.\d+)+\b/g,
  /\b(?:jan(?:uary|uari)?|feb(?:ruary|ruari)?|mar(?:ch)?|mrt|apr(?:il)?|may|mei|jun[ei]?|jul[iy]?|aug(?:ust(?:us)?)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s+\d{1,2}\b/gi, /\b\d{1,2}\s+(?:jan(?:uary|uari)?|feb(?:ruary|ruari)?|mar(?:ch)?|mrt|apr(?:il)?|may|mei|jun[ei]?|jul[iy]?|aug(?:ust(?:us)?)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/gi, /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat|zo|ma|di|wo|do|vr|za)[a-z]*\.?,?\s+\d{1,2}\s+(?:jan|feb|mar|mrt|apr|may|mei|jun|jul|aug|sep|oct|okt|nov|dec)[a-z]*/gi, /\b\d{1,2}:\d{2}\b/g,
  /\b(?:Lumber|Brick|Wool|Grain|Ore|Hout|Baksteen|Wol|Graan|Erts|Desert|Woestijn)\s+\d+(?:\s*\+\s*\d+)*/gi, /\b\d+\s+(?:Lumber|Brick|Wool|Grain|Ore|hout|baksteen|wol|graan|erts)\b/gi, /\b(?:Trade|Ruil)\s+\d+/g, /\+\d+ (?:roads?|wegen|weg)\b/g,
];
//   plus the review engine's own explanation sentences (src/review/why.js: tile numbers and dot counts inside "Reaches Grain 4, ... (8 dice dots)"): marked data-explain in the UI. KNOWN GAP, listed in the report.
ALLOW_SEL.push("[data-explain]");

// ── in-page audit (a function, serialised) ──
const AUDIT = ({ rootSel, allowSel, allowRe }) => {
  const root = document.querySelector(rootSel); if (!root) return { missing: rootSel };
  const PF = window.__postFacts;
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = { untagged: [], bad: [], tagged: 0, tokens: 0, keys: {}, nan: [] };
  const res = allowRe.map((r) => new RegExp(r[0], r[1]));
  const TOK = /[+−±-]?\s?\d+(?:[.,]\d+)?/g, digits = (t) => (String(t).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(",", "."));
  // tagged elements first (outermost only)
  const tagged = [...root.querySelectorAll("[data-fact]")].filter((e) => !e.parentElement.closest("[data-fact]") && vis(e));
  tagged.forEach((el) => {
    const keys = el.dataset.fact.trim().split(/\s+/); let txt = el.textContent.replace(/[▲▼]/g, "").replace(/\s+/g, " ").trim(); res.forEach((r) => { txt = txt.replace(r, " "); });
    const facts = keys.map((k) => PF.fact(k)); out.tagged += 1;
    if (facts.some((f) => !f)) { out.bad.push({ why: "unknown fact", keys, txt }); return; }
    const exp = keys.map((k) => digits(PF.text(k)));
    // the numbers shown must be the numbers of the facts: same digits (as a multiset), in order when the count agrees
    const shown = digits(txt), want = exp.flat();
    out.tokens += shown.length;
    const norm = (a) => a.map((x) => String(parseFloat(x))).sort().join("|");
    if (norm(shown) !== norm(want)) { out.bad.push({ why: "digits differ", keys, txt, want }); return; }
    // unit: a % belongs right after a win-chance number and nowhere else (checked in order when it lines up)
    const wcU = new Set(["wc", "wcDelta", "margin", "rate", "lead"]); const seq = []; facts.forEach((f, i) => digits(PF.text(keys[i])).forEach(() => seq.push(f)));
    let pos = 0; const inOrder = shown.every((d, i) => parseFloat(d) === parseFloat(want[i]));
    if (inOrder) shown.forEach((d, i) => { const needle = d.replace(".", /\d,\d/.test(txt) ? "," : ".").replace(/^0+(?=\d)/, ""), mt = new RegExp(`(?<!\\d)${needle.replace(/[.]/g, "\\.")}(?!\\d)`, "g"); mt.lastIndex = pos; const hit = mt.exec(txt), at = hit ? hit.index : -1; const nxt = at >= 0 ? txt.slice(at + String(d).length, at + String(d).length + 2) : ""; pos = at >= 0 ? at + 1 : pos; const pct = /^\s?%/.test(nxt) || nxt[0] === "%"; const f = seq[i]; if (f && wcU.has(f.unit) !== pct) out.bad.push({ why: `unit ${f.unit} ${pct ? "has" : "lacks"} %`, keys, txt }); });
    // sign: a shown sign must be the value's sign (single-number elements)
    if (facts.length === 1 && shown.length === 1) { const f = facts[0], m = /([+−±-])\s?\d/.exec(txt); if (m && f.value !== 0 && f.unit !== "margin") { const s = m[1] === "+" ? 1 : m[1] === "±" ? 0 : -1; if (s !== 0 && s !== Math.sign(f.value) && !(f.unit === "count" || f.unit === "pts")) out.bad.push({ why: "sign", keys, txt, value: f.value }); } }
    if (keys.length === 1) { const k = keys[0]; (out.keys[k] ||= []).push(shown.map((x) => String(parseFloat(x))).join("/")); }
  });
  // every other visible text node: numbers must be allowed
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement; if (!el || el.closest("script,style,[data-fact],[hidden]") || !vis(el)) continue;
    let t = n.nodeValue.replace(/\s+/g, " "); if (!/\d/.test(t)) { if (/NaN|undefined|null|\[object/.test(t)) out.nan.push(t.trim().slice(0, 60)); continue; }
    if (allowSel.some((s) => el.closest(s))) continue;
    // an element whose own text is a bare dice number / label inside a fact-less ancestor is allowed only through the lists above
    res.forEach((r) => { t = t.replace(r, " "); });
    const m = t.match(TOK); if (m) m.forEach((tok) => out.untagged.push({ tok: tok.trim(), ctx: n.nodeValue.replace(/\s+/g, " ").trim().slice(0, 70), cls: (el.className && String(el.className).slice(0, 30)) || el.tagName }));
  }
  const all = (root.innerText || ""); if (/\bNaN\b|\bundefined\b|\[object|Infinity/.test(all)) out.nan.push(all.slice(0, 60));
  return out;
};

// ── in-page SUMS audit (finding 4): every "adds up to" claim of the screens, read from the facts only ──
//   tempo: start + phases + hidden points = final · cost split: errors + start picks + other moves = moves in total, start + moves = moves in total · phase costs = real errors
//   waterfall: each step of the run is the fact it is labelled with · counts: decisions = scored + one sensible option
const SUMS = () => {
  const PF = window.__postFacts, v = (r) => { const f = PF.fact(r); return f ? f.value : null; }, out = [], n = window.__colonistGame.players.length;
  const add = (refs) => { const x = refs.map(v); return x.some((y) => y == null) ? null : x.reduce((a, b) => a + b, 0); };
  const chk = (name, a, b) => { if (a == null || b == null) return; if (Math.abs(a - b) > 1e-9) out.push(`${name}: ${a} != ${b}`); };
  let tempo = 0;
  for (let q = 0; q < n; q += 1) { if (v(`tempo.start:${q}`) == null) continue; tempo += 1; const h = v(`tempo.hidden:${q}`); chk(`tempo seat ${q} start + phases + hidden = final`, add([`tempo.start:${q}`, `tempo.opening:${q}`, `tempo.mid:${q}`, `tempo.end:${q}`, `tempo.hidden:${q}`]), v(`pts:${q}`)); if (h != null && h < 0) out.push(`tempo seat ${q}: hidden points ${h} < 0`); }
  chk("errors + start + other = moves in total", add(["errCost", "startCost", "otherCost"]), v("movesTotal")); chk("start + moves = moves in total", add(["startCost", "moveCost"]), v("movesTotal")); chk("errors + other = moves", add(["errCost", "otherCost"]), v("moveCost"));
  chk("phase costs = real errors", add(["phase.opening", "phase.mid", "phase.end"]), v("errCost"));
  if (v("wf.run.0") != null) { chk("waterfall start", v("wf.run.1") - v("wf.run.0"), v("startCost")); chk("waterfall moves", v("wf.run.2") - v("wf.run.1"), v("moveCost")); chk("waterfall others", v("wf.run.4") - v("wf.run.3"), v("others")); const dl = v("wf.run.3") - v("wf.run.2"); if (dl !== 0) chk("waterfall luck", dl, v("luck")); chk("waterfall fair", v("wf.run.0"), v("fair")); }
  chk("decisions = scored + one option", add(["scored", "oneOption"]), v("decisions"));
  // v1.99 r2 (finding 3): every scored decision has ONE kind: scored = start picks + real errors + strong + close + could + outside this analysis; the "other decisions" are the three move tiles + outside
  const me = window.__colonistGame._rvPid;
  chk("scored = start picks + real errors + strong + close + could + outside", add([`startN:${me}`, `fam.err:${me}`, `fam.strong:${me}`, `fam.close:${me}`, `fam.could:${me}`, `fam.out:${me}`]), v(`scored:${me}`));
  chk("other decisions = strong + close + could + outside", add([`fam.strong:${me}`, `fam.close:${me}`, `fam.could:${me}`, `fam.out:${me}`]), v(`otherN:${me}`));
  return { out, tempo };
};
const LSEL = ".px-ev .x, .px-hl2, .px-vl, .px-t3 > span, .px-wfr .sb, .px-wfr .lb, .px-rule p.px-l, .px-fn, .px-adv, .px-lh b, .rv-gt b, .px-card > p.px-l, .px-cn p, .px-prog p, .px-vsent, .px-err .mv > span, .px-ne2, .px-tk small, .px-tk > span > span, .px-mv .mt, .px-cc, .px-wr > span, .px-nr > span, .ln-cr > span:first-child, .px-wr > b, .px-ev .t";
// ── in-page TEXT audit: language purity, out-of-scope words, line counts ──
const TEXTAUDIT = ({ rootSel, lang, names, lsel, third }) => {
  const root = document.querySelector(rootSel); if (!root) return { missing: true };
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden || +cs.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cl = root.cloneNode(true); cl.querySelectorAll("script,style,svg,[hidden]").forEach((e) => e.remove());
  // the text as the reader sees it: hidden parts of the LIVE root are skipped through the live tree walk
  const nodes = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodesOut = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || el.closest("script,style,svg") || !vis(el)) continue; if (!el.closest(".px-leg, .px-pr, .px-src, .rsc-leg")) nodesOut.push(n.nodeValue); const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) nodes.push(t); }
  let text = nodes.join(" \n "); names.forEach((n) => { text = text.split(n).join(" "); }); text = text.replace(/Katan/g, " ");
  const EN = /\b(the|then|and|with|for|from|your|you|you'll|turn|turns|move|moves|win|chance|real|error|errors|luck|lucky|rolled|rolls|built|instead|better|could|mistake|missed|points?|others|show|hide|dice|dots?|port|ports|trade|trades|traded|lumber|brick|wool|grain|ore|settlement|city|road|roads|cards?|completes|adds|blocks|takes|reaches|uses|needs|keeps|income|spots?|resources?|short|gave|knight|robber|play|dev|biggest|worse|loss|lost|gain|why|what|this|that|are|not|only|more|less|about|which|each|after|before|because|checked|played|picks?|moves)\b/gi;
  const NLR = /\b(beurt|beurten|jij|jou|jouw|zetten|zet|winkans|precisie|kaart|kaarten|dorp|dorpen|stad|steden|weg|wegen|hout|baksteen|wol|graan|erts|ruil|ruilen|ontwikkelkaart|voorsprong|stippen|geluk|fout|fouten|keuze|keuzes|startkeuzes|bekijk|eerlijk|anderen|eind|waarom|deed|beter|niet|geen|het|een|van|voor|naar|met|dat|bij|worp|worpen|gooide|punten|spel|speler|spelers|tegenstanders|grootste|misser|missers|nipte|kleine|dit|bord|plek|plekken)\b/gi;
  const OUT = /\brobber\b|\brover\b|\bports?\b|\bharbou?rs?\b|\bhaven\b|\bhavens\b|longest road|largest army|langste weg|langste handelsroute|grootste riddermacht|who you fed|\bfed\b/gi;
  const textOut = nodesOut.join(" \n "); const hit = (re, tt = text) => { const m = tt.match(re); return m ? [...new Set(m.map((x) => x.toLowerCase()))].slice(0, 6) : []; };
  const MINUS = text.match(/(?:^|[\s(+·])-\d/g);
  const SEC = third ? hit(lang === "nl" ? /\b(jij|jou|jouw|jullie|je)\b/gi : /\b(you|your|yours)\b/gi) : [];
  const out = { second: SEC, minus: MINUS ? MINUS.slice(0, 4).map((x) => x.trim()) : [], en: lang === "nl" ? hit(EN) : [], nl: lang === "en" ? hit(NLR) : [], out: hit(OUT, textOut), long: [] };
  const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const tops = []; for (const q of rg.getClientRects()) { if (q.width < 1) continue; const t = Math.round(q.top); if (!tops.some((x) => Math.abs(x - t) < 5)) tops.push(t); } return tops.length; };
  root.querySelectorAll(lsel).forEach((el) => { if (!vis(el) || el.closest("svg")) return; const n = lines(el); if (n > 2) out.long.push(`${n} lines: "${(el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 44)}"`); });
  return out;
};

(async () => {
  const b = await chromium.launch();
  const LANGS = process.env.LANGS ? process.env.LANGS.split(",") : ["en", "nl"];
  const summary = { screens: 0, tokens: 0, tagged: 0, games: new Set() };
  for (const lang of LANGS) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript((l) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); }, lang);
    const boot = async () => { await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); };
    await boot(); const G = (fn, a) => page.evaluate(fn, a);
    let KEYS = {}, curGame = "", NAMES = ["Katan"];
    const audit = async (name, rootSel, o = {}) => { if (process.env.DEBUG) console.log("  ..", name);
      const r = await G(AUDIT, { rootSel, allowSel: ALLOW_SEL, allowRe: ALLOW_RE.map((x) => [x.source, x.flags]) });
      const k = `${lang} ${curGame} ${name}`; summary.screens += 1;
      if (r.missing) { ok(!!o.optional, `${k}: root ${rootSel} missing`); return r; }
      summary.tokens += r.tokens; summary.tagged += r.tagged;
      ok(!r.untagged.length, `${k}: every number is a tagged fact`, r.untagged.slice(0, 6));
      ok(!r.bad.length, `${k}: tagged numbers equal the store`, r.bad.slice(0, 4));
      ok(!r.nan.length, `${k}: no NaN/undefined`, r.nan.slice(0, 3));
      { // v1.99 r2 (finding 6): ONE vocabulary on every screen: no "Better option" / "Betere optie", "kon beter" next to "kan beter", no "nauwkeurigheid", no "1 points", no "not close calls" caption
        const txt = await G((s) => document.querySelector(s)?.innerText || "", rootSel); const bad = [];
        if (/(?<![−+\d.,])1 points\b|(?<![−+\d.,])1 punten\b/i.test(txt)) bad.push("1 points"); if (/Better option|Betere optie|Slightly better/.test(txt)) bad.push("Better option"); if (/not close calls|geen nipte keuzes/i.test(txt)) bad.push("not close calls");
        if (lang === "nl" && /nauwkeurig|\bkon beter\b|Nipt verschil|Kleine keuze|Betere optie/i.test(txt)) bad.push("old Dutch term"); if (lang === "en" && /\bAccuracy\b/.test(txt) === false && /nauwkeurig/i.test(txt)) bad.push("nauwkeurig");
        ok(!bad.length, `${k}: one vocabulary (Close call / Could be better / Precisie), no "1 points"`, bad); }
      { const tx = await G(TEXTAUDIT, { rootSel, lang, names: NAMES, lsel: LSEL, third: /^(overview bot|player \d+)$/.test(name) }); if (!tx.missing) { ok(!tx.en.length, `${k}: no English words in Dutch`, tx.en); ok(!tx.nl.length, `${k}: no Dutch words in English`, tx.nl); ok(!tx.out.length, `${k}: no port / robber / road-race words`, tx.out); ok(!tx.second.length, `${k}: third person only on a bot's page`, tx.second); ok(!tx.minus.length, `${k}: one minus sign style (U+2212)`, tx.minus); ok(!tx.long.length, `${k}: max 2 lines`, tx.long.slice(0, 3)); } }
      Object.entries(r.keys).forEach(([key, v]) => { (KEYS[key] ||= new Map()); v.forEach((x) => KEYS[key].set(x, [...(KEYS[key].get(x) || []), name])); });
      return r;
    };
    const sheet = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await sleep(450); };
    const unfold = async () => { await page.evaluate(() => document.querySelectorAll("[data-pxtog]").forEach((b) => { if (b.getAttribute("aria-expanded") !== "true") b.click(); })); await sleep(250); };
    const closeSheet = async () => { await page.evaluate(() => document.querySelector("[data-pxx]")?.click()); await sleep(200); };
    for (const gm of sel) {
      try {
        const j = gm.j || JSON.parse(zlib.gunzipSync(fs.readFileSync(gm.file))); const { meta, format, v, calib, ...rec } = j; const me = meta.me ?? 0; curGame = gm.tag.slice(0, 14); KEYS = {}; NAMES = ["Katan", ...(meta.seats || []).map((q) => q.name)];
        await G(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec });
        await G(() => window.__colonistGame.histOpen()); await sleep(500);
        if (gm.fixture) { await audit("history", ".hs", { optional: false }); await G(() => document.querySelector("[data-pxhg]")?.click()); await sleep(200); await audit("history row open", ".hs"); }
        await G((id) => window.__colonistGame._histSheet(id), meta.id); await sleep(350);
        // v1.99 r2 (finding 3): the game sheet says Real errors / Could be better / Close calls: read here, compared with the review's own tiles below (it fills itself in from the saved review)
        let HK = null; for (let k = 0; k < 40; k += 1) { HK = await G(() => { const o = {}; document.querySelectorAll(".hs-sheet [data-hk]").forEach((e) => { o[e.dataset.hk] = e.textContent.trim(); }); return o; }); if (HK.err && HK.err !== "–") break; await sleep(250); }
        ok(HK && /^\d+$/.test(HK.err || "") && /^\d+$/.test(HK.could || "") && /^\d+$/.test(HK.close || ""), `${lang} ${curGame} game sheet: Real errors / Could be better / Close calls are numbers`, HK);
        { const sh = await G(() => document.querySelector(".hs-sheet")?.innerText || ""); ok(!/Marked moves|Gemarkeerde zetten|kon beter|nauwkeurig/i.test(sh), `${lang} ${curGame} game sheet: no legacy "marked moves" / "kon beter" / "nauwkeurigheid"`, sh.slice(0, 200)); }
        await page.evaluate(() => document.querySelector("[data-sact=review]").click()); await page.waitForSelector(".rv .rv-tabs", { timeout: 45000 }); await sleep(1100);
        summary.games.add(gm.tag);
        for (const tab of ["overview", "moves", "strategy", "luck"]) {
          await G((t) => { const g = window.__colonistGame; g._rvTab = t; g._rvDrawReview(); }, tab); await sleep(550);
          if (tab === "overview") await page.waitForSelector(".px-verdict", { timeout: 20000 });
          if (tab === "overview") { // v1.99 r1 the luck headline: spread over many rolls (the Luck tab's own total, no roller named) or ONE large roll named with its roller (a roll of its own fact, at least 5% and half of the total)
            const hl = await G(() => { const e = document.querySelector(".px-hl2"); const sp = [...(e?.querySelectorAll("[data-fact]") || [])].map((x) => x.dataset.fact); return { txt: e?.innerText || "", facts: sp }; });
            const spread = /spread over many rolls|verspreid over veel worpen/.test(hl.txt), named = hl.facts.some((f) => f.startsWith("hl.ev.d:"));
            ok(!/in total|in totaal|own rolls|eigen worpen/.test(hl.txt), `${lang} ${curGame} luck headline: no "in total" / "own rolls" wording`, hl.txt);
            if (spread) { ok(hl.facts.some((f) => /^luck:\d+$/.test(f)) && !named, `${lang} ${curGame} luck headline (spread): the number is the Luck tab's luck fact, no roller named`, hl); summary.lkSpread = (summary.lkSpread || 0) + 1; }
            if (named) { const ln = await G(() => { const g = window.__colonistGame; return { v: window.__postFacts.fact(`hl.ev.d:${g._rvPid}`)?.value, t: window.__postFacts.fact(`luck:${g._rvPid}`)?.value }; }); ok(ln.v != null && Math.sign(ln.v) === Math.sign(ln.t) && Math.abs(ln.v) >= 5 && Math.abs(ln.v) >= Math.abs(ln.t) / 2, `${lang} ${curGame} luck headline (named roll): at least 5% and half of the total, on its side`, ln); summary.lkNamed = (summary.lkNamed || 0) + 1; }
          }
          await unfold(); await audit(tab, ".rv");
          if (tab === "overview" || tab === "strategy") { const su = await G(SUMS); ok(!su.out.length, `${lang} ${curGame} ${tab}: every "adds up" claim adds up`, su.out.slice(0, 4)); }
          if (tab === "luck") { // finding 5: luck is unbalanced: no text anywhere says it sums to zero, evens out or cancels; the effect is named as the effect on a win chance
            const lk = await G(() => ({ txt: document.querySelector(".rv")?.innerText || "", seats: document.querySelectorAll("[data-pxlk]").length }));
            ok(!/zero.?sum|sums? to (?:zero|0)|nul.?som|optellen tot (?:nul|0)|cancel|even(?:s)? out|balanc|compens|heffen .* op|egaliseer/i.test(lk.txt), `${lang} ${curGame} luck: no zero-sum wording`);
            ok(/win chance|winkans/i.test(lk.txt), `${lang} ${curGame} luck: the effect is named as a win-chance effect`);
          }
          { // finding 6: the header summary is never cut off (wraps instead of "provisio...")
            const hd = await G(() => { const s = document.querySelector(".rv .rv-bar small"); if (!s) return null; const cs = getComputedStyle(s); return { cut: s.scrollWidth > s.clientWidth + 1 || (cs.textOverflow === "ellipsis" && cs.whiteSpace === "nowrap"), txt: s.textContent }; });
            ok(!hd || !hd.cut, `${lang} ${curGame} ${tab}: the review header summary is not cut off`, hd);
          }
          if (tab !== "luck") { // finding 2: no lesson numbers (a "1" badge next to "2 REAL ERRORS" reads like a count; numbering 1, 3 had a gap)
            const ln = await G(() => ({ badges: [...document.querySelectorAll(".rv .px-nb")].filter((e) => e.offsetParent).length, txt: (document.querySelector(".rv")?.innerText || "").match(/\b(?:Lesson|Les)\s+\d\b/g) }));
            ok(!ln.badges && !ln.txt, `${lang} ${curGame} ${tab}: no lesson numbers`, ln);
          }
          if (tab === "moves") { // finding 1: the tiles and the list are one source: each tile equals the number of list rows of its kind, and no row word contradicts a zero tile
            const t = await G(() => { const tiles = {}; document.querySelectorAll("[data-famtile]").forEach((e) => { tiles[e.dataset.famtile] = +e.querySelector("b").textContent.replace(/\D/g, ""); }); const rows = {}; document.querySelectorAll(".px-mv[data-fam]").forEach((e) => { rows[e.dataset.fam] = (rows[e.dataset.fam] || 0) + 1; }); const words = [...document.querySelectorAll(".px-mv[data-fam] .px-cls")].map((e) => e.textContent.trim()); return { tiles, rows, words }; });
            ["strong", "close", "could", "err"].forEach((k) => ok((t.tiles[k] ?? -1) === (t.rows[k] || 0), `${lang} ${curGame} moves: tile "${k}" equals its list rows`, t));
            if (HK && /^\d+$/.test(HK.err || "")) ok(+HK.err === t.tiles.err && +HK.could === t.tiles.could && +HK.close === t.tiles.close, `${lang} ${curGame} moves: the game sheet (errors ${HK.err}, could ${HK.could}, close ${HK.close}) reads the same counts as the tiles`, { HK, tiles: t.tiles });
            if (!t.tiles.could) ok(!t.words.some((w) => /^(Could be better|Kan beter|Kon beter)$/.test(w)), `${lang} ${curGame} moves: no "Could be better" row next to a 0 tile`, t.words);
            if (!t.tiles.close) ok(!t.words.some((w) => /^(Close call|Nipt verschil)$/.test(w)), `${lang} ${curGame} moves: no "Close call" row next to a 0 tile`, t.words);
          }
          if (tab === "overview") { // v1.99 r2: the header of Real errors and its cards reconcile; the small differences are the Moves rows; the loser's waterfall reads from the loser's side
            const o = await G(() => { const PF = window.__postFacts, me = window.__colonistGame._rvPid, val = (r) => PF.fact(r)?.value ?? null;
              const cards = [...document.querySelectorAll(".px-l1 .px-err .h [data-fact]")].map((e) => val(e.dataset.fact)), note = document.querySelector(".px-capnote");
              const noteKeys = note ? [...note.querySelectorAll("[data-fact]")].flatMap((e) => e.dataset.fact.split(/\s+/)) : [];
              const ne = [...document.querySelectorAll(".px-l1 .px-ne2")].map((e) => ({ w: e.querySelector(".px-cls")?.textContent.trim(), f: val(e.querySelector("[data-fact]")?.dataset.fact) }));
              const aft = document.querySelector(".px-wfr.aft .lb")?.textContent.trim() || "", oth = document.querySelector(".px-wfr.oth .sb")?.textContent.trim() || "";
              return { sum: cards.reduce((a, b) => a + (b ?? 0), 0), n: cards.length, errRaw: val(`errRaw:${me}`), errCost: val(`errCost:${me}`), errors: val(`errors:${me}`), noteKeys, note: !!note, ne, nErr: val(`notErrors:${me}`), close: val(`fam.close:${me}`), could: val(`fam.could:${me}`), aft, oth, others: val(`others:${me}`), after: val(`afterLast:${me}`), lost: !!document.querySelector(".px-eb") && /lost|verloren/i.test(document.querySelector(".px-wfr.end .lb")?.textContent || ""), head: document.querySelector(".px-vh b")?.innerText.replace(/\s+/g, " ").trim() || "" }; });
            if (o.n) { ok(o.errRaw == null || (o.n >= o.errors ? o.sum === o.errRaw : Math.abs(o.sum) <= Math.abs(o.errRaw)), `${lang} ${curGame} overview: the error cards add up to the raw errors fact`, o);
              ok(o.note === (o.errRaw != null && o.errRaw !== o.errCost), `${lang} ${curGame} overview: the header (${o.errCost}) and the cards (${o.sum}) reconcile: an "overlap counts once" line says so exactly when they differ`, o);
              if (o.note) ok(o.noteKeys.some((k) => k.startsWith("errRaw:")) && o.noteKeys.some((k) => k.startsWith("errCost:")), `${lang} ${curGame} overview: the overlap line names the raw and the counted fact`, o.noteKeys); }
            if (await G(() => !!document.querySelector(".px-l1"))) ok(o.ne.length === Math.min(3, o.nErr ?? 0) && (o.nErr ?? 0) <= (o.close ?? 0) + (o.could ?? 0), `${lang} ${curGame} overview: the small differences (${o.ne.length}) are Moves rows (close ${o.close} + could ${o.could}), never a start pick`, o);
            if (o.lost && o.after != null) { ok(/^(Rest of the game|Rest van het spel)$/.test(o.aft), `${lang} ${curGame} overview: a loser's last row reads "Rest of the game"`, o.aft); }
            if (o.lost && o.others) ok(/helped you|cost you|hielp jou|kostte jou/.test(o.oth), `${lang} ${curGame} overview: the others row says whether it helped or cost the loser`, o.oth);
            { // finding 4: one mistake feeds at most one "Take with you" rule (the turn-2 mistake was listed as rule 1 AND as the opening rule 3)
              const tk = await G(async () => { const M = await import("/src/post-model.js"), g = window.__colonistGame, m = M.modelOf(g, g._rvPid), t = m.takeaway || [], l1 = t.find((x) => x.lesson === 1), l3 = t.find((x) => x.lesson === 3), r = l3 && (m.lesson3 || []).find((q) => q.id === l3.key);
                const a = (m.lesson3 || [])[0]; return { keys: t.map((x) => x.key), dup: !!(l1 && r && (r.ids || r.chips.map((c) => c.i)).includes(l1.i)), wouldDup: !!(l1 && a && (a.ids || a.chips.map((c) => c.i)).includes(l1.i)) }; });
              ok(!tk.dup && new Set(tk.keys).size === tk.keys.length, `${lang} ${curGame} overview: no mistake is listed under two Take-with-you rules`, tk); if (tk.wouldDup) console.log(`  (dedupe fired: ${curGame})`); }
            ok(/\d+–\d+/.test(o.head), `${lang} ${curGame} overview: the result line carries the score`, o.head);
          }
          if (tab === "overview") for (const pil of ["errors", "start", "other"]) { await page.evaluate((k) => document.querySelector(`[data-pxpil=${k}]`)?.click(), pil); await sleep(150); await audit(`overview pillar ${pil}`, ".rv"); }
          if (tab === "luck") {
            if (await G(() => !!document.querySelector("[data-pxunit=cards]"))) { await sheet("[data-pxunit=cards]"); await audit("luck cards", ".rv"); }
            if (await G(() => !!document.querySelector("[data-pxothers]"))) { await sheet("[data-pxothers]"); await unfold(); await audit("luck others open", ".rv"); await sheet("[data-pxunit=win]"); await audit("luck others open win", ".rv"); }
            const seats = await G(() => [...document.querySelectorAll("[data-pxlk]")].map((b) => +b.dataset.pxlk));
            for (const q of seats.slice(0, gm.fixture ? 4 : 2)) { await sheet(`[data-pxlk="${q}"]`); await unfold(); await audit(`luck seat ${q}`, ".rv"); }
          }
        }
        await G(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); }); await sleep(400);
        await sheet("[data-pxnum]"); await audit("numbers sheet", ".px-sheet", { optional: true }); await closeSheet();
        await sheet("[data-pxinfo]"); await audit("info sheet", ".px-sheet", { optional: true }); await closeSheet();
        const seatsN = await G(() => window.__colonistGame.players.length), pids = gm.fixture ? [...Array(seatsN).keys()] : [me, (me + 1) % seatsN];
        for (const pid of pids) { await G((pid) => window.__colonistGame._rvOpenReview(pid, { tab: "player" }), pid); await sleep(800); await audit(`player ${pid}${pid === me ? " (you)" : ""}`, ".rv"); if (gm.fixture) { await sheet("[data-pxnum]"); await audit(`numbers sheet seat ${pid}`, ".px-sheet", { optional: true }); await closeSheet(); } }
        // a bot's overview (third person headline)
        await G((pid) => window.__colonistGame._rvOpenReview(pid, { tab: "overview" }), (me + 1) % seatsN); await sleep(800); await audit("overview bot", ".rv");
        await G((pid) => window.__colonistGame._rvOpenReview(pid, { tab: "overview" }), me); await sleep(500);
        // v1.99 r1 ONE NUMBER PER ROLL: every fact that is the number of one roll (timeline pin "dice", the Overview's biggest roll, a Luck tab row, the biggest of the other players' rolls) is the same
        // for the same roll and seat, on every screen; and a Luck tab row is one event (never a roll added to a steal)
        { const rl = await G(() => window.__postFacts.rolls()); const by = {}; rl.forEach((r) => { (by[`${r.seat}|${r.step}`] ||= new Map()).set(r.value, [...((by[`${r.seat}|${r.step}`].get(r.value)) || []), r.id]); });
          const bad = Object.entries(by).filter(([, m]) => m.size > 1).map(([k, m]) => `${k}: ${[...m.entries()].map(([v, ids]) => `${v} (${ids.slice(0, 2).join(", ")})`).join(" vs ")}`);
          ok(bad.length === 0, `${lang} ${curGame} one value per roll on every screen`, bad.slice(0, 3)); summary.rolls = (summary.rolls || 0) + rl.length;
        }
        if (gm.fixture) { // the AI tab: the roll steps of its rounds carry the luck run's number for that roll, every number of the ledger has a % and turns read "Turn n" / "Beurt n"
          await G(() => { const g = window.__colonistGame; g._rvTab = "ai"; g._rvDrawReview(); });
          await page.waitForFunction(() => !document.querySelector(".rv .ap-sk") && document.querySelector(".rv [data-lg]"), null, { timeout: 120000 }).catch(() => {});
          await sleep(800);
          const ai = await G(() => { const g = window.__colonistGame, fx = g._pgState().fx, M = fx.lg, out = { steps: 0, bad: [], txt: "", lg: "", coach: !!document.querySelector(".rv [data-rcai]"), M: !!M };
            if (M) { const recs = g._rv.recs, me = fx.me, lk = {}; Object.values(g._lkStore().res).forEach((r) => { if (r && r.k === "dice" && r.l) lk[r.s + 1] = Math.round(r.l[me] * 100); });
              M.focus().forEach((t) => { const v = M.view(t); (v ? v.shown : []).forEach((s) => { if (s.type === "roll" && Array.isArray(s.dl)) { out.steps += 1; const S = recs[s.i].s + 1; if (lk[S] !== s.pts) out.bad.push(`turn ${t} step ${S}: ${s.pts} vs luck ${lk[S]}`); } }); }); }
            out.txt = document.querySelector(".rv")?.innerText || ""; out.lg = document.querySelector("[data-lg]")?.innerText || ""; return out; });
          ok(ai.M, `${lang} ${curGame} AI tab: the ledger model is there`);
          ok(!ai.bad.length, `${lang} ${curGame} AI tab: every roll step shows the luck run's number for that roll (${ai.steps} checked)`, ai.bad.slice(0, 3));
          ok(!/(?:^|[\s(])[BT]\d+\b/.test(ai.txt.replace(/\bv\d+(?:\.\d+)+/g, "")), `${lang} ${curGame} AI tab: no B2 / T10 turn tokens`, (ai.txt.match(/(?:^|[\s(])[BT]\d+\b/g) || []).slice(0, 3));
          ok(!/[+−±]\d+(?![\d%.,])/.test(ai.lg.replace(/\s+/g, " ")), `${lang} ${curGame} AI tab: every signed number of the ledger rows has a %`, (ai.lg.replace(/\s+/g, " ").match(/[+−±]\d+(?![\d%.,]).{0,10}/g) || []).slice(0, 3));
          ok(!ai.coach, `${lang} ${curGame} AI tab: no "open the AI tab" row on the AI tab`);
          ok(!/\b(?:Groens|Geelens|Blaauws|Groen’s|Geelen’s)\s+\d+\s*\(/i.test(ai.lg.replace(/\s+/g, " ")) && !/(?:gaven|gave) .*\(/.test(""), `${lang} ${curGame} AI tab: "who rolled what" has the roller as the subject, no possessive-before-a-number`, (ai.lg.match(/\S+[s’]\s+\d+\s*\(/g) || []).slice(0, 2));
          await G(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); }); await sleep(300); }
        // Bekijk bord: every stop
        await G(() => window.__colonistGame._pxBoard(0)); await sleep(600);
        const nStops = await G(() => document.querySelectorAll(".px-stops button").length);
        for (let i = 0; i < nStops; i += 1) { await sheet(`[data-pxs="${i}"]`); await audit(`board stop ${i}`, ".px-board"); }
        await page.evaluate(() => document.querySelector("[data-pxbx]")?.click()); await sleep(200);
        // the end screen
        if (gm.fixture) {
          await G(() => window.__colonistGame._rvCloseReview?.(true)); await G(() => window.__colonistGame.histOpen()); await sleep(500); await G((id) => window.__colonistGame._histSheet(id), meta.id); await sleep(350);
          await page.evaluate(() => document.querySelector("[data-sact=stats]")?.click()); await page.waitForSelector("[data-rvtable]", { timeout: 20000 }).catch(() => {}); await sleep(1200);
          await audit("end screen", ".px-end", { optional: true });
          { // finding 8: equal points share a place and say so ("tied 3rd" / "gedeeld 3e"), as a fact; nobody else carries the tag
            const rk = await G(() => [...document.querySelectorAll(".px-row")].map((r) => ({ pts: +r.querySelector(".pts")?.textContent, rk: +r.querySelector(".rk")?.textContent, tie: r.querySelector(".px-tie")?.textContent.trim() || "", tieFact: r.querySelector(".px-tie [data-fact]")?.dataset.fact || "" })));
            const rest = rk.slice(1); let good = rk.length > 1 && rk[0].rk === 1 && !rk[0].tie;
            rest.forEach((r) => { const same = rest.filter((z) => z.pts === r.pts).length, place = 2 + rest.filter((z) => z.pts > r.pts).length; if (r.rk !== place) good = false; if (same > 1 ? !(new RegExp(lang === "nl" ? `^gedeeld ${place}e$` : `^tied ${place}(?:st|nd|rd|th)$`).test(r.tie) && /^place:\d+$/.test(r.tieFact)) : r.tie) good = false; });
            ok(good, `${lang} ${curGame} end screen: equal points share a place and read "${lang === "nl" ? "gedeeld" : "tied"} Nth"`, rk);
          }
          const rows = await G(() => [...document.querySelectorAll("[data-rsx]")].map((b) => +b.dataset.rsx));
          for (const q of rows) { await page.evaluate((q) => document.querySelector(`[data-rsx="${q}"]`)?.click(), q); await sleep(250); await audit(`end screen row ${q} open`, ".px-end", { optional: true }); }
        }
        // identical fact ids render identically everywhere in this game
        Object.entries(KEYS).forEach(([key, m]) => ok(m.size === 1, `${lang} ${curGame} fact ${key}: one number on every screen`, [...m.entries()].map(([v, sc]) => `${v}: ${[...new Set(sc)].join("/")}`).join(" | ")));
        await G(() => window.__colonistGame._rvCloseReview?.(true));
        console.log(`done ${lang} ${gm.tag} (checks ${checks}, fails ${fails})`);
      } catch (e) { ok(false, `${lang} ${gm.tag}: exception`, e.message.slice(0, 200)); await boot(); }
    }
    // history + bots (global stores)
    try {
      await G(() => { const g = window.__colonistGame; g._rvCloseReview?.(true); g.histClose?.(); }); await G(() => window.__colonistGame.histOpen()); await sleep(900); curGame = "all"; KEYS = {};
      await audit("history", ".hs"); await G(() => document.querySelector("[data-pxhg]")?.click()); await sleep(250); await audit("history row open", ".hs");
      await G(() => { const g = window.__colonistGame; g.histClose(); g.botsOpen(); }); await sleep(900);
      for (const s of ["strength", "precision", "you"]) { await page.evaluate((s) => document.querySelector(`[data-pxseg=${s}]`)?.click(), s); await sleep(500); await audit(`bots ${s}`, ".px-bots"); }
    } catch (e) { ok(false, `${lang} history/bots: exception`, e.message.slice(0, 200)); }
    // Lessons over all games of this run: language, out-of-scope words, two-line labels
    try {
      await G(() => { const g = window.__colonistGame; g.botsClose?.(); g.lessonsOpen(); }); await page.waitForSelector(".ln h5.ln-sec, .ln .ln-c", { timeout: 90000 }).catch(() => {}); await sleep(2500);
      const tx = await G(TEXTAUDIT, { rootSel: ".ln", lang, names: ["Katan", "Blaauw", "Geelen", "Groen", "Rood", "Oranje"], lsel: LSEL + ", .ln-c p, .ln-c h4", third: false });
      ok(!tx.missing, `${lang} lessons: screen found`); if (!tx.missing) { ok(!tx.en.length, `${lang} lessons: no English words in Dutch`, tx.en); ok(!tx.nl.length, `${lang} lessons: no Dutch words in English`, tx.nl); ok(!tx.long.length, `${lang} lessons: max 2 lines`, tx.long.slice(0, 3)); }
    } catch (e) { ok(false, `${lang} lessons: exception`, e.message.slice(0, 200)); }

    ok(!errors.length, `${lang}: no console errors`, errors.slice(0, 3));
    await ctx.close();
  }
  await b.close();
  console.log(`\nluck headline: ${summary.lkSpread || 0} spread, ${summary.lkNamed || 0} named roll`);
  console.log(`\n${summary.games.size} games · ${summary.screens} screens · ${summary.tagged} tagged elements · ${summary.tokens} numbers checked against the store · ${checks} checks`);
  console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
