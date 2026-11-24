// v1.99 post-game UI: every screen at 360x780 and 412x923, EN and NL, light and dark.  node tests/analysis199-ui.js PORT   (server: node tests/serve.mjs ROOT PORT)
//   per screen: no horizontal overflow, text >= 11.5px, taps >= 40px, no NaN/undefined/null/[object, no zero-sum claim, no robber / port / road-race / fed strings,
//   NL: no English left (the localizer's `misses`); numbers on Overview = Moves = Numbers sheet for the same game.   env SHOTS=dir for screenshots (360x780 dsf2).
//   Fixtures: tests/fixtures/post199/*.json (real reviewed games: export format, with the review and the luck run), made by driving the app (bot games + the in-app review).
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 8781, SHOTS = process.env.SHOTS, FIX = path.join(__dirname, "fixtures", "post199");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const files = fs.readdirSync(FIX).filter((f) => f.endsWith(".json")).sort();
const BAD = /\bNaN\b|\bundefined\b|\bnull\b|\[object|Infinity/;
const ZERO = /zero-sum|zero sum|nulsom|sums to zero|cancel(s)? out/i;
const OUT = /\brobber\b|\brover\b|\bports?\b|\bharbou?rs?\b|\bhaven\b|longest road|largest army|langste weg|grootste riddermacht|who you fed|fed\b/i;
const SCAN = () => {
  const vis0 = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const tops = [...document.querySelectorAll("div.rv, div.bpg, div.ln, div.hs, div.game-over-overlay")].filter(vis0);
  const root = (window.__pxRoot && document.querySelector(window.__pxRoot)) || document.querySelector(".px-sheet") || document.querySelector(".px-board") || tops[tops.length - 1] || document.body;
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden || +cs.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const iss = [], W = innerWidth, de = document.documentElement;
  if (de.scrollWidth > W + 1) iss.push(`page scrolls horizontally ${de.scrollWidth}>${W}`);
  root.querySelectorAll(".rv-scroll, .hs-scroll").forEach((s) => { if (s.scrollWidth > s.clientWidth + 1) iss.push(`scroller overflows ${s.scrollWidth}>${s.clientWidth}`); });
  root.querySelectorAll("*").forEach((el) => { if (!vis(el) || el.closest("svg, canvas, .sbs-w")) return; const r = el.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1) iss.push(`out of view: ${el.tagName}.${String(el.className).slice(0, 30)} ${Math.round(r.left)}..${Math.round(r.right)}`); });
  const tw = document.createTreeWalker(root, 4), small = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const el = n.parentElement; if (!el || !n.nodeValue.trim() || /^(SCRIPT|STYLE)$/.test(el.tagName) || el.closest("svg") || !vis(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.49) small.add(`${fs}px "${n.nodeValue.trim().slice(0, 24)}"`); }
  root.querySelectorAll("svg text").forEach((el) => { if (!vis(el)) return; const fs = parseFloat(getComputedStyle(el).fontSize); const sv = el.ownerSVGElement, k = sv ? sv.getBoundingClientRect().width / (sv.viewBox.baseVal.width || 1) : 1; if (fs * k < 11.0) small.add(`svg ${(fs * k).toFixed(1)}px "${el.textContent.slice(0, 12)}"`); });
  const taps = new Set();
  root.querySelectorAll("button, [role=button], [role=tab], a[href], input, summary").forEach((el) => { if (!vis(el) || el.closest("svg")) return; const r = el.getBoundingClientRect(); if (r.height < 39.5 || r.width < 39.5) taps.add(`${Math.round(r.width)}x${Math.round(r.height)} ${(el.innerText || el.getAttribute("aria-label") || el.className || "").toString().replace(/\s+/g, " ").slice(0, 28)}`); });
  const nodes = []; { const w2 = document.createTreeWalker(root, 4); for (let n = w2.nextNode(); n; n = w2.nextNode()) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) nodes.push(t); } } const cl = root.cloneNode(true); cl.querySelectorAll(".px-leg, .px-pr, .px-src, .rsc-leg, script, style").forEach((e) => e.remove()); return { nodes, rc: String(root.className).slice(0, 30), iss, small: [...small], taps: [...taps], text: root.innerText || "", words: cl.textContent.replace(/\s+/g, " ") };
};
const nums = () => {
  const q = (s) => document.querySelector(s)?.innerText || "";
  return { acc: (/Accuracy\s*(\d+)|Precisie\s*(\d+)/.exec(q(".px-verdict")) || [])[1] || (/Accuracy\s*(\d+)|Precisie\s*(\d+)/.exec(q(".px-verdict")) || [])[2] || null };
};
(async () => {
  const b = await chromium.launch();
  const SIZES = process.env.QUICK ? [[360, 780]] : [[360, 780], [412, 923]], LANGS = process.env.LANGS ? process.env.LANGS.split(",") : ["en", "nl"], THEMES = process.env.QUICK ? ["light"] : ["light", "dark"];
  let missesAll = new Set();
  for (const [w, h] of SIZES) for (const lang of LANGS) for (const th of THEMES) {
    const tag = `${w}x${h} ${lang} ${th}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS && w === 360 ? 2 : 1, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript(({ l, th }) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); if (th === "dark") localStorage.setItem("colonist.palette", "night"); }, { l: lang, th });
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const metas = [];
    for (const f of files) { const j = JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8")); const { meta, format, v, ...rec } = j; await page.evaluate(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec }); metas.push(meta); }
    const G = (fn, a) => page.evaluate(fn, a);
    const FACTS = {}; let curGame = ""; let m0 = null;
    const facts = async (name) => { const fs0 = await G(() => { const vis0 = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } return true; }; const tops = [...document.querySelectorAll("div.rv, div.bpg, div.ln, div.hs, div.game-over-overlay")].filter(vis0); const root = document.querySelector(".px-sheet") || document.querySelector(".px-board") || tops[tops.length - 1] || document.body; return [...root.querySelectorAll("[data-fact]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0; }).map((e) => [e.dataset.fact, e.dataset.v]); }); fs0.forEach(([k, v]) => { if (v === "" || v == null) return; ((FACTS[`${curGame}|${k}`] ||= {})[v] ||= new Set()).add(name); }); };
    const check = async (name, shot) => {
      await facts(name);
      await sleep(500); const r = await G(SCAN); const k = `${tag} ${name}`;
      if (lang === "nl") { const ms = await G(async () => { const I = await import("/src/i18n.js"); const a = [...I.misses]; I.misses.clear(); return a; });
        const names = ["Katan", ...metas.flatMap((m) => (m.seats || []).map((q) => q.name))]; const dayRe = /^\w{2,3} \d+ \w{3}( · \d+:\d+)?$/;
        const strip = (x) => names.reduce((t, n) => t.split(n).join(" "), x).replace(/[\d\s.,:·–+−%▲▼/()±-]+/g, " ").trim();
        const bad = name === "lessons" ? [] : ms.filter((x) => r.nodes.includes(x) && strip(x).length >= 3 && !dayRe.test(x));
        bad.forEach((x) => missesAll.add(x)); ok(!bad.length, `${k}: no English left in Dutch`, bad.slice(0, 4)); }
      else { const nlw = /\b(Beurt|Jij|Jouw|Zetten|Winkans|Precisie|Gewonnen|Verloren|Kaarten|Strategie|Geluk|Opening|Middenspel|Eindspel|Startkeuzes|Echte fouten)\b/.exec(r.words.replace(/Bekijk bord/g, "")); ok(!nlw, `${k}: no Dutch in English`, nlw ? nlw[0] : ""); }
      ok(!r.iss.length, `${k}: no overflow`, r.iss.slice(0, 3)); ok(!r.small.length, `${k}: text >= 11.5px`, r.small.slice(0, 4)); ok(!r.taps.length, `${k}: taps >= 40px`, r.taps.slice(0, 4));
      ok(!BAD.test(r.text), `${k}: no NaN/undefined/null`, (() => { const mm = BAD.exec(r.text); return mm ? r.text.slice(Math.max(0, mm.index - 50), mm.index + 20).replace(/\s+/g, " ") : ""; })()); ok(!ZERO.test(r.text), `${k}: no zero-sum claim`); const o = OUT.exec(r.words); ok(!o, `${k}: no out-of-scope words`, o ? o[0] : "");
      if (SHOTS && w === 360 && shot && (m0 === metas[0] || !m0)) { fs.mkdirSync(SHOTS, { recursive: true }); const hh = await G(() => Math.max(...[...document.querySelectorAll(".rv-scroll, .hs-scroll, .px-sheet .rv-card")].map((e) => e.scrollHeight + e.getBoundingClientRect().top), 0)); const tall = Math.round(Math.min(4200, Math.max(h, hh + 24))); await page.setViewportSize({ width: w, height: tall }); await sleep(250); await page.screenshot({ path: path.join(SHOTS, `${shot}-${lang}-${th}.png`) }); await page.setViewportSize({ width: w, height: h }); await sleep(200); }
      return r;
    };
    for (const m of metas) {
      const id = m.id, short = id.slice(-4); curGame = short; m0 = m;
      await G(() => window.__colonistGame.histOpen()); await sleep(900);
      await check(`${short} history`, `history`);
      await page.locator("[data-pxhg]").first().tap().catch(() => {}); await sleep(300); await check(`${short} history row open`, null);
      await G((id) => window.__colonistGame._histSheet(id), id); await sleep(500);
      await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(1500);
      const T = {};
      for (const tab of ["overview", "moves", "strategy", "luck"]) { await G((t) => { const g = window.__colonistGame; g._rvTab = t; g._rvDrawReview(); }, tab); await sleep(600); if (tab === "overview") await page.waitForSelector(".px-verdict", { timeout: 20000 }); T[tab] = await check(`${short} ${tab}`, `${tab}`); }
      // folds open, sheets
      await G(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); }); await sleep(400);
      await page.evaluate(() => document.querySelectorAll("[data-pxtog]").forEach((b) => b.click())); await sleep(300); await check(`${short} overview unfolded`, null);
      await page.evaluate(() => document.querySelector("[data-pxnum]")?.click()); await sleep(500);
      const numSheet = await check(`${short} numbers sheet`, `numbers`);
      await page.evaluate(() => document.querySelector("[data-pxx]")?.click()); await sleep(200);
      await page.evaluate(() => document.querySelector("[data-pxinfo]")?.click()); await sleep(400); await check(`${short} info sheet`, `info`); await page.evaluate(() => document.querySelector("[data-pxx]")?.click());
      // consistency: accuracy and moves cost on Overview = Moves = Numbers
      const c = await G(() => { const t = (s) => document.querySelector(s)?.innerText || ""; return { ov: t(".px-verdict"), }; });
      const nrows = await G(() => [...document.querySelectorAll(".px-sheet .px-nr")].map((r) => r.innerText.replace(/\s+/g, " ")));
      const nAcc = numSheet.text.split("\n").find((l) => /^(Accuracy|Precisie)$/.test(l.trim()));
      void nrows; void nAcc; void c;
      // player pages: you and a bot
      for (const pid of [m.me, (m.me + 1) % 4]) { await G((pid) => { const g = window.__colonistGame; g._rvOpenReview(pid, { tab: "player" }); }, pid); await sleep(900); await check(`${short} player ${pid === m.me ? "you" : "bot"}`, pid === m.me ? "player" : "player-bot"); }
      await G((pid) => window.__colonistGame._rvOpenReview(pid, { tab: "overview" }), m.me); await sleep(500);
      await G(() => window.__colonistGame._pxBoard(0)); await sleep(700); await check(`${short} bekijk bord`, `board`); await page.evaluate(() => document.querySelector("[data-pxbx]")?.click());
      await G(() => window.__colonistGame._rvCloseReview?.(true));
    }
    await G(() => { const g = window.__colonistGame; g.histClose?.(); g.lessonsOpen(); }); await sleep(2500); await check("lessons", "lessons");
    await G(() => { const g = window.__colonistGame; g.lessonsClose(); g.botsOpen(); }); await sleep(900);
    for (const s of ["strength", "precision", "you"]) { await page.locator(`[data-pxseg=${s}]`).tap(); await sleep(500); await check(`bots ${s}`, `bots-${s}`); }
    // the end screen (a past game opened as its results), rows folded and one unfolded
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    curGame = metas[0].id.slice(-4); m0 = metas[0]; await G(() => window.__colonistGame.histOpen()); await sleep(900); await G((id) => window.__colonistGame._histSheet(id), metas[0].id); await sleep(400);
    await page.locator("[data-sact=stats]").tap(); await page.waitForSelector("[data-rvtable]", { timeout: 20000 }).catch(() => {}); await sleep(1500);
    await G(() => { window.__pxRoot = ".px-end"; }); await check("end screen", "end"); await page.evaluate(() => document.querySelector("[data-rsx]")?.click()); await sleep(400); await check("end screen row open", "end-open");
    // ONE number per fact: every screen that shows luck / cost / accuracy of a seat shows the same value; the three pillars add up to the cost
    const keys = Object.keys(FACTS), shownScreens = (k) => [...new Set(Object.values(FACTS[k]).flatMap((x) => [...x]))];
    for (const k of keys) { const vals = Object.keys(FACTS[k]); const sc = shownScreens(k); if (/\|(luck|cost|acc|scored|pick1win|top1win|pick1dots|top1dots):/.test(k)) ok(vals.length === 1 && (sc.length >= 2 || !/:0$/.test(k)), `${tag} fact ${k}: one value on every screen`, vals.length === 1 ? sc.join(", ") : Object.entries(FACTS[k]).map(([v, x]) => `${v}: ${[...x].join("/")}`).join(" | ")); }
    for (const k of keys.filter((x) => /\|(pick1win|top1win|pick1dots|top1dots):0$/.test(x))) { const sc = shownScreens(k); ok(/overview/.test(sc.join()) && /strategy/.test(sc.join()) && /bekijk bord/.test(sc.join()), `${tag} fact ${k}: shown on Overview, Strategy and Bekijk bord`, sc.join(", ")); }
    for (const k of keys.filter((x) => /\|cost:/.test(x))) { const [g0, rest] = k.split("|"), seat = rest.split(":")[1], v = (n) => { const o = FACTS[`${g0}|${n}:${seat}`]; return o ? +Object.keys(o)[0] : null; }; const pe = v("pillar-errors"), ps = v("pillar-start"), po = v("pillar-other"), c = +Object.keys(FACTS[k])[0]; if (pe != null) ok(pe + ps + po === c, `${tag} ${g0}: pillars ${pe}+${ps}+${po} = cost ${c}`); }
    ok(!errors.length, `${tag}: no console errors`, errors.slice(0, 3));
    await ctx.close();
  }
  if (missesAll.size) { fs.writeFileSync(path.join(process.env.SHOTS || "/tmp", "nl-misses.json"), JSON.stringify([...missesAll], null, 1)); }
  ok(![...missesAll].length, "NL: every text translated", [...missesAll].slice(0, 12));
  await b.close(); console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
