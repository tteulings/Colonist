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
  /\b(?:turns?|beurten|beurt)\s+\d+(?:\s*(?:[–-]|and|en)\s*\d+)?/gi, /\b[TB]\d+\b/g, /(?:pick|keuze)\s+\d+/gi, /\b(?:Lesson|Les)\s+\d\b/g, /\b(?:version|versie)\s+\d+/gi, /\bv\d+(?:\.\d+)+\b/g,
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
    if (inOrder) shown.forEach((d, i) => { const at = txt.indexOf(d.replace(".", /\d,\d/.test(txt) ? "," : ".").replace(/^0+(?=\d)/, ""), pos); const nxt = at >= 0 ? txt.slice(at + String(d).length, at + String(d).length + 2) : ""; pos = at >= 0 ? at + 1 : pos; const pct = /^\s?%/.test(nxt) || nxt[0] === "%"; const f = seq[i]; if (f && wcU.has(f.unit) !== pct) out.bad.push({ why: `unit ${f.unit} ${pct ? "has" : "lacks"} %`, keys, txt }); });
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
        await page.evaluate(() => document.querySelector("[data-sact=review]").click()); await page.waitForSelector(".rv .rv-tabs", { timeout: 45000 }); await sleep(1100);
        summary.games.add(gm.tag);
        for (const tab of ["overview", "moves", "strategy", "luck"]) {
          await G((t) => { const g = window.__colonistGame; g._rvTab = t; g._rvDrawReview(); }, tab); await sleep(550);
          if (tab === "overview") await page.waitForSelector(".px-verdict", { timeout: 20000 });
          await unfold(); await audit(tab, ".rv");
          if (tab === "moves") { // finding 1: the tiles and the list are one source: each tile equals the number of list rows of its kind, and no row word contradicts a zero tile
            const t = await G(() => { const tiles = {}; document.querySelectorAll("[data-famtile]").forEach((e) => { tiles[e.dataset.famtile] = +e.querySelector("b").textContent.replace(/\D/g, ""); }); const rows = {}; document.querySelectorAll(".px-mv[data-fam]").forEach((e) => { rows[e.dataset.fam] = (rows[e.dataset.fam] || 0) + 1; }); const words = [...document.querySelectorAll(".px-mv[data-fam] .px-cls")].map((e) => e.textContent.trim()); return { tiles, rows, words }; });
            ["strong", "close", "could", "err"].forEach((k) => ok((t.tiles[k] ?? -1) === (t.rows[k] || 0), `${lang} ${curGame} moves: tile "${k}" equals its list rows`, t));
            if (!t.tiles.could) ok(!t.words.some((w) => /^(Could be better|Kan beter|Kon beter)$/.test(w)), `${lang} ${curGame} moves: no "Could be better" row next to a 0 tile`, t.words);
            if (!t.tiles.close) ok(!t.words.some((w) => /^(Close call|Nipt verschil)$/.test(w)), `${lang} ${curGame} moves: no "Close call" row next to a 0 tile`, t.words);
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
  console.log(`\n${summary.games.size} games · ${summary.screens} screens · ${summary.tagged} tagged elements · ${summary.tokens} numbers checked against the store · ${checks} checks`);
  console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
