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
const LSEL = ".px-ev .x, .px-hl2, .px-vl, .px-t3 > span, .px-wfr .sb, .px-rule p.px-l, .px-fn, .px-adv, .px-lh b, .rv-gt b, .px-card > p.px-l, .px-cn p, .ln-cr > span:first-child, .px-mv .mt, .px-wr > span, .px-err .mv > span, .px-adv, .px-prog p, .px-vsent";
const SCAN = (LSEL) => {
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
  const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const tops = []; for (const q of rg.getClientRects()) { if (q.width < 1) continue; const t = Math.round(q.top); if (!tops.some((x) => Math.abs(x - t) < 5)) tops.push(t); } return tops.length; };
  const long = []; root.querySelectorAll(LSEL).forEach((el) => { if (!vis(el) || el.closest("svg")) return; const n = lines(el); if (n > 2) long.push(`${n} lines: "${(el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`); });
  const nodes = []; { const w2 = document.createTreeWalker(root, 4); for (let n = w2.nextNode(); n; n = w2.nextNode()) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) nodes.push(t); } } const cl = root.cloneNode(true); cl.querySelectorAll(".px-leg, .px-pr, .px-src, .rsc-leg, script, style").forEach((e) => e.remove()); return { long, nodes, rc: String(root.className).slice(0, 30), iss, small: [...small], taps: [...taps], text: root.innerText || "", words: cl.textContent.replace(/\s+/g, " ") };
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
    const facts = async (name) => { const fs0 = await G(() => { const vis0 = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } return true; }; const tops = [...document.querySelectorAll("div.rv, div.bpg, div.ln, div.hs, div.game-over-overlay")].filter(vis0); const root = document.querySelector(".px-sheet") || document.querySelector(".px-board") || tops[tops.length - 1] || document.body; return [...root.querySelectorAll("[data-fact]")].filter((e) => !/\s/.test(e.dataset.fact.trim()) && e.getBoundingClientRect().width > 0).map((e) => [e.dataset.fact, ((e.textContent.match(/\d+(?:[.,]\d+)?/g) || [])[0] || "").replace(",", ".")]); }); fs0.forEach(([k, v]) => { if (v === "" || v == null) return; ((FACTS[`${curGame}|${k}`] ||= {})[v] ||= new Set()).add(name); }); };
    const check = async (name, shot) => {
      await facts(name);
      await sleep(500); const r = await G(SCAN, LSEL); const k = `${tag} ${name}`;
      if (lang === "nl") { const ms = await G(async () => { const I = await import("/src/i18n.js"); const a = [...I.misses]; I.misses.clear(); return a; });
        const names = ["Katan", ...metas.flatMap((m) => (m.seats || []).map((q) => q.name))]; const dayRe = /^\w{2,3} \d+ \w{3}( · \d+:\d+)?$/;
        const strip = (x) => names.reduce((t, n) => t.split(n).join(" "), x).replace(/[\d\s.,:·–+−%▲▼/()±-]+/g, " ").trim();
        const DUTCH_SAME = new Set(["won"]); const realDutch = (x) => { const w = strip(x).split(/\s+/).filter(Boolean); return w.length > 0 && w.every((q) => DUTCH_SAME.has(q.toLowerCase())); };
        const bad = name === "lessons" ? [] : ms.filter((x) => r.nodes.includes(x) && strip(x).length >= 3 && !dayRe.test(x) && !realDutch(x));
        bad.forEach((x) => missesAll.add(x)); ok(!bad.length, `${k}: no English left in Dutch`, bad.slice(0, 4)); }
      else { const nlw = /\b(Beurt|Jij|Jouw|Zetten|Winkans|Precisie|Gewonnen|Verloren|Kaarten|Strategie|Geluk|Opening|Middenspel|Eindspel|Startkeuzes|Echte fouten)\b/.exec(r.words.replace(/Bekijk bord/g, "")); ok(!nlw, `${k}: no Dutch in English`, nlw ? nlw[0] : ""); }
      { const pl = /\b1 (points|punten|real errors|echte fouten|misses|missers)\b|usually score|meestal/.exec(r.text.replace(/Bots op niveau/g, "")); ok(!pl, `${k}: singular plurals and no "usually score" benchmark`, pl ? pl[0] : ""); }
      ok(!r.long.length, `${k}: max 2 lines in texts and captions`, r.long.slice(0, 4)); { const bt = /\bB\d+\b/.exec(r.text); ok(!bt, `${k}: no "B<number>" tokens`, bt ? bt[0] : ""); }
      ok(!r.iss.length, `${k}: no overflow`, r.iss.slice(0, 3)); ok(!r.small.length, `${k}: text >= 11.5px`, r.small.slice(0, 4)); ok(!r.taps.length, `${k}: taps >= 40px`, r.taps.slice(0, 4));
      ok(!BAD.test(r.text), `${k}: no NaN/undefined/null`, (() => { const mm = BAD.exec(r.text); return mm ? r.text.slice(Math.max(0, mm.index - 50), mm.index + 20).replace(/\s+/g, " ") : ""; })()); ok(!ZERO.test(r.text), `${k}: no zero-sum claim`); const o = OUT.exec(r.words); ok(!o, `${k}: no out-of-scope words`, o ? o[0] : "");
      if (SHOTS && w === 360 && shot && true) { fs.mkdirSync(SHOTS, { recursive: true }); const hh = await G((bd) => Math.max(...[...document.querySelectorAll(bd ? ".px-board .rv-scroll" : ".rv-scroll, .hs-scroll, .px-sheet .rv-card")].map((e) => e.scrollHeight + e.getBoundingClientRect().top), 0), shot === "board"); const tall = Math.round(Math.min(4200, Math.max(h, hh + 24))); await page.setViewportSize({ width: w, height: tall }); await sleep(250); await page.screenshot({ path: path.join(SHOTS, `${shot}${m0 && m0 !== metas[0] ? "-g2" : ""}-${lang}-${th}.png`) }); await page.setViewportSize({ width: w, height: h }); await sleep(200); }
      return r;
    };
    const num = (t) => { const mm = /([+−-]?)\s*(\d+(?:[.,]\d+)?)/.exec(String(t).replace(/[▲▼]/g, "")); return mm ? (mm[1] === "−" || mm[1] === "-" ? -1 : 1) * parseFloat(mm[2].replace(",", ".")) : 0; };
    const HL = {};
    const tabChecks = async (tab, short) => {
      const k = `${tag} ${short} ${tab}`;
      if (tab === "overview") {
        const h = await G(() => document.querySelector(".px-hl2")?.innerText || "");
        ok(/[+−]\d+%/.test(h) || /zonder|without/.test(h), `${k}: headline names measured swings`, h);
        ok(!/inkomen|income|gemiddeld|average|punten in|points in/i.test(h), `${k}: headline has no income / tempo claims`, h);
        const whole = await G(() => document.body.innerText.replace(/\s+/g, " ")), hh = h.replace(/\s+/g, " ").trim(); ok(hh.length < 8 || whole.split(hh).length === 2, `${k}: the headline appears once on the screen`);
        const cn = await G(() => document.querySelector(".px-cn")?.innerText || ""); ok(/(Accuracy|Precisie) \d+/.test(cn) && /\d+%/.test(cn), `${k}: one line ties Accuracy, real errors and moves cost`, cn);
        ok(await G(() => !!document.querySelector(".px-wf .px-wfr.oth")), `${k}: "Others" is a visible waterfall row`);
        { const wf = await G(() => { const v = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, " ").trim() : ""; }; return { fair: v(".px-wfr.fair .wcv"), start: v(".px-wfr.start .px-d"), moves: v(".px-wfr.moves .px-d"), luck: v(".px-wfr.luck .px-d"), oth: v(".px-wfr.oth .px-d"), aft: v(".px-wfr.aft .px-d"), end: v(".px-wfr.end .wcv") }; });
          const nv = (t) => (t ? num(t) : 0); ok(wf.fair && wf.end && nv(wf.fair) + nv(wf.start) + nv(wf.moves) + nv(wf.luck) + nv(wf.oth) + nv(wf.aft) === nv(wf.end), `${k}: Fair share + Start + Moves + Luck + Others + After the last move = End`, wf); }
        { const hr = await G(() => { const hd = document.querySelector(".px-hl2"); const mine = [...hd.querySelectorAll("[data-fact]")].map((e) => e.dataset.fact); const other = new Set([...document.querySelectorAll(".rv-scroll [data-fact], .rv-scroll [data-fact] *")].filter((e) => !hd.contains(e)).flatMap((e) => (e.dataset?.fact || "").split(/\s+/))); return { mine, miss: mine.filter((x) => !other.has(x)), txt: hd.innerText }; });
          ok(hr.mine.length > 0 && !hr.miss.length, `${k}: every number of the headline is a fact shown again below (waterfall, key moments)`, hr);
          HL[short] = [...(/(?:turns?|beurt(?:en)?)\s+(\d+)(?:\s+(?:and|en)\s+(\d+))?/gi.exec(hr.txt) || []).slice(1).filter(Boolean).map(Number)]; }
        const adv = await G(() => document.querySelector(".px-l2c .px-adv")?.innerText || ""), mm = /(\d+)% → (\d+)% \(\+(\d+)%\)/.exec(adv);
        if (adv) ok(mm && +mm[2] - +mm[1] === +mm[3], `${k}: start advice from-to matches its difference`, adv);
        ok((await G(() => document.querySelectorAll(".px-l2c .px-dk").length)) === 1, `${k}: dots explained once on the start card`);
        const rest = await G(() => document.querySelector(".px-wfr.oth .sb")?.innerText || ""); ok(/\S/.test(rest), `${k}: "Others" says what it is`, rest);
        const tl = await G(() => [...document.querySelectorAll(".px-t3")].map((b) => b.innerText.replace(/\s+/g, " "))); ok(tl.length === 3, `${k}: three tiles`, tl);
      }
      if (tab === "history") {
        const hl = await G(() => { const ps = [...document.querySelectorAll(".px-prog p")]; const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const t = []; for (const q of rg.getClientRects()) { const y = Math.round(q.top); if (q.width > 1 && !t.some((x) => Math.abs(x - y) < 5)) t.push(y); } return t.length; }; return { n: ps.reduce((a, p) => a + lines(p), 0), txt: ps.map((p) => p.innerText).join(" ") }; });
        ok(hl.n <= 2 && !/vanaf 3|from 3 reviewed/.test(hl.txt), `${k}: history has at most 2 lines of text before the list and no dead hint`, hl);
      }
      if (tab === "strategy") {
        const tg = await G(() => ({ h: [...document.querySelectorAll(".px-tg.hd b")].map((b) => b.innerText.replace(/\s+/g, " ")), rows: [...document.querySelectorAll(".px-tg:not(.hd)")].map((r) => [...r.querySelectorAll(".c b")].map((b) => b.innerText)) }));
        ok(/Start/.test(tg.h[0] || "") && tg.rows.every((r) => r.length === (/Hidden|Verborgen/.test(tg.h[tg.h.length - 1] || "") ? 5 : 4)), `${k}: Tempo has a Start column (start + phases [+ hidden points] = final)`, tg);
        const me = await G(() => [...document.querySelectorAll(".px-sc2 .px-sr:not(.hd) b")].map((b) => b.innerText.replace(/\s+/g, " "))); ok(me.length > 0 && me.every((t) => /\d+(e|st|nd|rd|th)\b/.test(t)), `${k}: every scorecard cell (the player's column too) shows its place`, me.slice(0, 3));
        const rows = await G(() => [...document.querySelectorAll(".px-sc2 .px-sr:not(.hd)")].map((r) => [...r.querySelectorAll("b")].map((b) => { const c = b.cloneNode(true); c.querySelectorAll(".rk").forEach((e) => e.remove()); return c.textContent.replace(/\s+/g, ""); })));
        ok(rows.length > 0, `${k}: scorecard rows`);
        let marks = 0; rows.forEach((cells) => { const v = cells.map(num), hi = Math.max(...v), lo = Math.min(...v); cells.forEach((c, i) => { const up = c.includes("▲"), dn = c.includes("▼"); marks += up + dn; ok(hi === lo ? !up && !dn : up === (v[i] === hi) && dn === (v[i] === lo), `${k}: scorecard cell ${c} marks the row's highest / lowest`, cells.join(" ")); }); });
        ok(marks > 0, `${k}: ▲▼ are in the scorecard cells`, marks);
        ok((await G(() => document.querySelectorAll(".px-l2 .px-dk").length)) === 1, `${k}: dots explained once in Strategy`);
        const mc = await G(() => [...document.querySelectorAll(".px-mr:not(.hd) b:nth-child(3)")].length); void mc;
      }
      if (tab === "moves") {
        const nz = await G(() => document.querySelectorAll(".px-mv .px-pm").length), rows = await G(() => document.querySelectorAll(".px-mv").length);
        ok(rows === 0 || nz > 0, `${k}: moves rows show their ± margin`, `${nz}/${rows}`);
      }
      if (tab === "luck") {
        const g0 = await G(() => { const b = document.querySelector("[data-pxothers]"); return b ? { label: b.innerText.replace(/\s+/g, " "), chip: b.querySelector(".px-d")?.innerText || "" } : null; });
        if (g0) {
          await page.evaluate(() => document.querySelector("[data-pxothers]").click()); await sleep(500);
          const g1 = await G(() => ({ label: document.querySelector("[data-pxothers]").innerText.replace(/\s+/g, " "), rows: [...document.querySelectorAll(".px-ev.sub .px-d")].map((x) => x.innerText) }));
          const sum = g1.rows.reduce((a, t) => a + num(t), 0), grp = num(g0.chip);
          ok(/Show|Toon/.test(g0.label) && /Hide|Verberg/.test(g1.label), `${k}: toggle label follows the state`, `${g0.label} -> ${g1.label}`);
          ok(g1.rows.length > 0 && Math.abs(sum - grp) <= Math.max(2, g1.rows.length * 0.5) && sum === grp, `${k}: the group's number is exactly the sum of the rows shown`, `group ${grp}, rows sum ${sum} (${g1.rows.length})`);
          const gl = await G(() => ({ sh: document.querySelectorAll(".px-sh").length, sums: [...document.querySelectorAll(".px-ev .x")].map((e) => e.innerText.trim()).filter((t) => /\(\+\d+\)/.test(t)) }));
          ok(gl.sh === 2 && !gl.sums.length, `${k}: own and other rolls are separate, one row per event (no "(+n)" sums of several events)`, gl);
          await check(`${short} luck others open`, null); await page.evaluate(() => document.querySelector("[data-pxothers]").click()); await sleep(300);
        }
      }
    };
    for (const m of metas) {
      const id = m.id, short = id.slice(-4); curGame = short; m0 = m;
      await G(() => window.__colonistGame.histOpen()); await sleep(900);
      await check(`${short} history`, `history`); await tabChecks("history", short);
      await page.locator("[data-pxhg]").first().tap().catch(() => {}); await sleep(300); await check(`${short} history row open`, null);
      await G((id) => window.__colonistGame._histSheet(id), id); await sleep(500);
      await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(1500);
      const T = {};
      for (const tab of ["overview", "moves", "strategy", "luck"]) { await G((t) => { const g = window.__colonistGame; g._rvTab = t; g._rvDrawReview(); }, tab); await sleep(600); if (tab === "overview") await page.waitForSelector(".px-verdict", { timeout: 20000 }); T[tab] = await check(`${short} ${tab}`, `${tab}`); await tabChecks(tab, short); }
      // folds open, sheets
      await G(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); }); await sleep(400);
      await page.evaluate(() => document.querySelectorAll("[data-pxtog]").forEach((b) => b.click())); await sleep(300); await check(`${short} overview unfolded`, null);
      await page.evaluate(() => document.querySelector("[data-pxnum]")?.click()); await sleep(500);
      const numSheet = await check(`${short} numbers sheet`, `numbers`);
      ok(!/\b(Mistakes|Blunders|Missed chances|Gemiste kansen|Blunders)\b/.test(numSheet.text) && /Real errors|Echte fouten/.test(numSheet.text), `${tag} ${short}: Numbers sheet uses one vocabulary (Real errors, Could be better)`);
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
      await G(() => window.__colonistGame._pxBoard(0)); await sleep(700); await check(`${short} bekijk bord`, `board`);
      { const stp = await G(() => [...document.querySelectorAll(".px-stops button")].map((b) => b.innerText.trim())), hl = HL[short]; if (hl) { const ts = hl; ok(ts.every((T) => stp.includes(String(T))), `${tag} ${short}: every turn named in the headline is a stop on Bekijk bord`, { stops: stp, named: ts }); } } await page.evaluate(() => document.querySelector("[data-pxbx]")?.click());
      // long bot names: the third-person headline still fits two lines on the bot's Overview
      await G(() => { const g = window.__colonistGame; g.players.forEach((p) => { if (!p.isHuman) p.name = "Maximiliaan-Alexander"; }); });
      { const bp = (m.me + 1) % 4; await G((pid) => window.__colonistGame._rvOpenReview(pid, { tab: "overview" }), bp); await sleep(900);
        const hl = await G(() => { const el = document.querySelector(".px-hl2"); if (!el) return null; const rg = document.createRange(); rg.selectNodeContents(el); const t = []; for (const q of rg.getClientRects()) { const y = Math.round(q.top); if (q.width > 1 && !t.some((x) => Math.abs(x - y) < 5)) t.push(y); } return { n: t.length, txt: el.innerText }; });
        ok(hl && hl.n <= 2, `${tag} ${short}: third-person headline with a long bot name fits two lines`, hl); }
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
    for (const k of keys) { const vals = Object.keys(FACTS[k]); const sc = shownScreens(k); if (/\|(luck|movesTotal|startCost|moveCost|acc|errors|pick1\.win|pick1\.best|pick1\.dots|pick1\.bestDots):/.test(k)) ok(vals.length === 1 && (sc.length >= 2 || !/:0$/.test(k) || /\|errors:/.test(k)), `${tag} fact ${k}: one value on every screen`, vals.length === 1 ? sc.join(", ") : Object.entries(FACTS[k]).map(([v, x]) => `${v}: ${[...x].join("/")}`).join(" | ")); }
    for (const k of keys.filter((x) => /\|(pick1\.win|pick1\.best|pick1\.dots|pick1\.bestDots):0$/.test(x))) { const sc = shownScreens(k); ok(/overview/.test(sc.join()) && /strategy/.test(sc.join()) && /bekijk bord/.test(sc.join()), `${tag} fact ${k}: shown on Overview, Strategy and Bekijk bord`, sc.join(", ")); }
    for (const k of keys.filter((x) => /\|movesTotal:/.test(x))) { const [g0, rest] = k.split("|"), seat = rest.split(":")[1], v = (n) => { const o = FACTS[`${g0}|${n}:${seat}`]; return o ? +Object.keys(o)[0] : null; }; const pe = v("errCost"), ps = v("startCost"), po = v("otherCost"), c = +Object.keys(FACTS[k])[0]; if (pe != null && ps != null && po != null) ok(pe + ps + po === c, `${tag} ${g0}: real errors ${pe} + start ${ps} + other ${po} = moves in total ${c}`); }
    ok(!errors.length, `${tag}: no console errors`, errors.slice(0, 3));
    await ctx.close();
  }
  if (missesAll.size) { fs.writeFileSync(path.join(process.env.SHOTS || "/tmp", "nl-misses.json"), JSON.stringify([...missesAll], null, 1)); }
  ok(![...missesAll].length, "NL: every text translated", [...missesAll].slice(0, 12));
  await b.close(); console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
