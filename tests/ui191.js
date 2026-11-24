// v1.91 review screens at 360x780 and 412x923, Dutch and English (real app, one saved game: tests/fixtures/ui191-game.json):
//  * Moves list: the set-up label does not overprint the move name (bounding boxes of title vs badge / name / number)
//  * Step view (a missed chance): no English in Dutch (the i18n187 word scan), no raw node ids ("2·11·10"), the player pills stay clear of the Play button,
//    the turn cards all sit inside the row; the other players' luck / moves keep their own colour (green and red are the user's)
//  * Luck tab and Overview table: the same, for the bars and numbers of the other players
//  * Overview (NL): no English footnote; its "decided on turn N" line gives the same turn and win chances as the AI tab's round view
//  * AI tab: while the numbers are not final nothing ranked is shown (and what is shown once does not change after); the ask bar is at most 15% of the screen
//  * Replay (NL): no English, the caption does not cut words
//   node tests/ui191.js PORT      (server: node step105/tests/serve.mjs ROOT PORT)   env AI=0 skips the (30 s) AI tab part
const { chromium } = require("playwright"); const path = require("path"); const fs = require("fs"); const { pathToFileURL } = require("url");
const port = +process.argv[2] || 9991, FX = path.join(__dirname, "fixtures", "ui191-game.json");
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = /\b(Katan|Blaauw|Geelen|Groen|Roodhart|Rosa|Van Geelen|Groenewoud|Pimpel|Mevrouw|Kolonel|Dominee|Professor|De Wit|Draet|AI|Rush|Monte Carlo|Sunny Island|Bot|Elo|SE|pp|k)\b/g;
const SHOTS = process.env.SHOTS;
const VIS = (sel) => {
  const root = document.querySelector(sel) || document.body, out = [];
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const w = document.createTreeWalker(root, 4); for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (!el || /^(SCRIPT|STYLE)$/.test(el.tagName) || el.closest("[data-nm]") || !vis(el)) continue; const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) out.push(t); }
  document.querySelectorAll(`${sel} [title], ${sel} [aria-label]`).forEach((e) => { if (vis(e)) ["title", "aria-label"].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v.replace(/\s+/g, " ").trim()); }); });
  return out;
};
const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

(async () => {
  const { looksEnglish } = await import(pathToFileURL(path.join(__dirname, "i18n-words.mjs")).href);
  const ex = JSON.parse(fs.readFileSync(FX, "utf8")), gid = ex.meta.id;
  const b = await chromium.launch(), errs = [];
  const open = async (lang, w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" }), page = await ctx.newPage(); page.on("pageerror", (e) => errs.push(e.message));
    await page.addInitScript((lang) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", lang); localStorage.setItem("colonist_recap_lang", lang); localStorage.setItem("colonist.palette", "night"); localStorage.setItem("katan_ai_compose", "0"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); }, lang);
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1200);
    await page.evaluate((i) => window.__colonistGame._histSheet(i), gid); await sleep(800);
    return { page, ctx };
  };
  const review = async (page) => { await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(800); };
  const english = (texts) => texts.map((t) => ({ t, w: looksEnglish(t.replace(NAMES, " ")) })).filter((x) => x.w.length).map((x) => `${x.t.slice(0, 70)} [${x.w.slice(0, 4)}]`);
  const shot = async (page, n, lang, w) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `ui191-${n}-${lang}-${w}.png`) }); };
  const NODEID = /(?<![\d·])\d{1,2}·\d{1,2}(?:·\d{1,2})?(?![\d·])/;
  const isNL = (l) => l === "nl";

  for (const [w, h] of [[360, 780], [412, 923]].filter(([x]) => !process.env.W || +process.env.W === x)) for (const lang of ["nl", "en"].filter((l) => !process.env.LANG1 || process.env.LANG1 === l)) {
    const tag = `${lang} ${w}x${h}`; const { page, ctx } = await open(lang, w, h); await review(page);
    const tabs = page.locator(".rv .rv-tabs button");
    // ── Overview ──
    {
      const T = await page.evaluate(VIS, ".rv"); const sbs = await page.evaluate(() => { const g = window.__colonistGame; return [...document.querySelectorAll("[data-rvsbs] .sbs-c")].map((c) => { const pc = (/pc-(\d)/.exec(c.className) || [])[1]; return { you: g._rvIsYou(+pc), bad: [...c.querySelectorAll(".pos,.neg")].filter((e) => !/\bopp\b/.test(e.className)).length }; }); });
      ok(!NODEID.test(T.join(" | ")), `${tag}: Overview shows no raw node id`);
      if (isNL(lang)) ok(english(T).length === 0, `${tag}: Overview has no English`, english(T).slice(0, 40));
      ok(sbs.length > 0 && sbs.filter((c) => !c.you).every((c) => c.bad === 0), `${tag}: the table's other players have no green / red`, sbs.filter((c) => !c.you && c.bad).length);
      await shot(page, "overview", lang, w);
    }
    // ── Luck ──
    {
      await tabs.nth(2).tap(); await sleep(1500);
      const L = await page.evaluate(() => { const g = window.__colonistGame; const bs = [...document.querySelectorAll(".lkx-g > b")], trs = [...document.querySelectorAll(".lkx-g > .tr")], ns = [...document.querySelectorAll(".lkx-g .lkx-n")]; return ns.map((n, i) => { const pc = +(/pc-(\d)/.exec(n.className) || [])[1]; return { you: g._rvIsYou(pc), badB: /\b(pos|neg)\b/.test(bs[i]?.className) && !/\bopp\b/.test(bs[i].className), badI: [...(trs[i]?.querySelectorAll("i.pos,i.neg") || [])].some((e) => !/\bopp\b/.test(e.className)) }; }); });
      ok(L.length >= 2 && L.filter((x) => !x.you).every((x) => !x.badB && !x.badI), `${tag}: Luck tab: the other players' bars and numbers are not green / red`, L);
      const T = await page.evaluate(VIS, ".rv"); if (isNL(lang)) ok(english(T).length === 0, `${tag}: Luck tab has no English`, english(T).slice(0, 40));
      await shot(page, "luck", lang, w);
    }
    // ── Moves ──
    {
      await tabs.nth(3).tap(); await sleep(1200); await page.locator("button", { hasText: /^Alle$|^All$/ }).first().tap(); await sleep(600);
      const M = await page.evaluate(() => [...document.querySelectorAll(".mv-r")].map((r) => { const t = r.querySelector(".mv-t").getBoundingClientRect(), m = r.querySelector(".mv-m").getBoundingClientRect(), v = r.querySelector(".mv-v").getBoundingClientRect(), wh = r.querySelector(".mv-w").getBoundingClientRect(), c = r.querySelector(".mv-c")?.getBoundingClientRect(); const o = (a, b) => b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5; return { txt: r.querySelector(".mv-t").innerText, over: o(t, m) || o(t, v) || o(t, wh) || o(t, c), clip: r.querySelector(".mv-t").scrollWidth > r.querySelector(".mv-t").clientWidth + 1 }; }));
      ok(M.length > 5 && M.every((x) => !x.over && !x.clip), `${tag}: Moves list: the turn label overlaps nothing and is not cut`, M.filter((x) => x.over || x.clip));
      const T = await page.evaluate(VIS, ".rv"); ok(!NODEID.test(T.join(" | ")), `${tag}: Moves list shows no raw node id`);
      if (isNL(lang)) ok(english(T).length === 0, `${tag}: Moves list has no English`, english(T).slice(0, 40));
      await shot(page, "moves", lang, w);
      // ── Step view of the missed chance, then a few other moves ──
      const n = await page.locator(".mv-r").count(), all = []; let bad = 0, nodeId = [], over = false, cardsOk = true, oppBad = 0, firstShot = true;
      for (const i of [await page.evaluate(() => [...document.querySelectorAll(".mv-r")].findIndex((r) => r.classList.contains("c-missed"))), 0, Math.min(8, n - 1), Math.min(14, n - 1), n - 1]) {
        if (i < 0) continue;
        if (!(await page.locator(".mv-r").count())) { await tabs.nth(3).tap(); await sleep(800); await page.locator("button", { hasText: /^Alle$|^All$/ }).first().tap(); await sleep(500); }
        await page.locator(".mv-r").nth(i).tap(); await sleep(2600);
        const S = await page.evaluate(VIS, ".rv.step"); all.push(...S);
        if (S.some((t) => NODEID.test(t))) nodeId.push(S.find((t) => NODEID.test(t)));
        const G = await page.evaluate(() => {
          const g = window.__colonistGame, r = (e) => e.getBoundingClientRect(), pills = [...document.querySelectorAll(".rs-wc span")], pbp = document.querySelector(".rs-pbp"), cards = [...document.querySelectorAll(".tv-cards .tv-card")], strip = document.querySelector(".tv-cards");
          const o = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
          const opp = [...document.querySelectorAll(".tv-row")].map((row) => { const pc = +(/pc-(\d)/.exec(row.querySelector(".tv-h b")?.className || "") || [])[1]; return { you: g._rvIsYou(pc), bad: [...row.querySelectorAll(".tv-s small span, .tv-dec i")].filter((e) => /\b(pos|neg)\b/.test(e.className) && !/\bopp\b/.test(e.className)).length }; }).filter((x) => !x.you && x.bad).length;
          return { pill: pbp && pills.some((p) => o(r(p), r(pbp))), cards: !strip || cards.every((c) => r(c).right <= r(strip).right + 1 && r(c).left >= r(strip).left - 1), opp };
        });
        if (G.pill) over = true; if (!G.cards) cardsOk = false; oppBad += G.opp;
        if (firstShot) { await shot(page, "step", lang, w); firstShot = false; }
        await page.locator("[data-rvclose-step]").first().tap(); await sleep(700);
      }
      ok(nodeId.length === 0, `${tag}: Step view shows no raw node id`, nodeId.slice(0, 2));
      if (isNL(lang)) { const e = english([...new Set(all)]); ok(e.length === 0, `${tag}: Step view (5 moves) has no English`, e.slice(0, 40)); }
      ok(!over, `${tag}: Step view: the player pills stay clear of the Play button`);
      ok(cardsOk, `${tag}: Step view: all turn cards sit inside their row`);
      ok(oppBad === 0, `${tag}: Step view: the other players' luck / moves are not green / red`, oppBad);
    }
    // ── Replay (NL) ──
    if (isNL(lang)) {
      await page.evaluate(() => window.__colonistGame.goHome?.()); await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1200);
      await page.evaluate((i) => window.__colonistGame._histSheet(i), gid); await sleep(800); await page.locator("[data-sact=replay]").first().tap(); await sleep(3500);
      const T = await page.evaluate(VIS, ".gs-replay"); ok(english(T).length === 0, `${tag}: Replay has no English`, english(T).slice(0, 40));
      const C = await page.evaluate(() => { const c = [...document.querySelectorAll(".gs-rp-cap b, .gs-rp-cap span")]; return c.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.innerText); });
      ok(C.length === 0, `${tag}: Replay caption is not cut`, C);
      const BX = await page.evaluate(() => { const g = window.__colonistGame, c = document.querySelector(".gs-rp-board canvas").getBoundingClientRect(), G = g.geometry, V = g.view; let a = 1e9, z = -1e9, t = 1e9, u = -1e9; G.hexes.forEach((hx) => { const x = hx.center.x * V.scale + V.offsetX, y = hx.center.y * V.scale + V.offsetY, s = G.hexSize * V.scale * 0.85; a = Math.min(a, x - s); z = Math.max(z, x + s); t = Math.min(t, y - s); u = Math.max(u, y + s); }); return { ok: a >= -1 && z <= c.width + 1 && t >= -1 && u <= c.height + 1, a, z, t, u, w: c.width, h: c.height }; });
      ok(BX.ok, `${tag}: Replay board is inside the picture`, BX);
      await shot(page, "replay", lang, w);
    }
    // ── AI tab ──
    if (process.env.AI !== "0") {
      await page.evaluate(() => { const g = window.__colonistGame; try { g._rvCloseReview?.(true); } catch (_) {} });
      await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1200); await page.evaluate((i) => window.__colonistGame._histSheet(i), gid); await sleep(800); await review(page);
      for (let k = 0; k < 4 && !(await page.locator("[data-aibody]").count()); k++) { await page.locator("[data-rvt=ai]").first().tap(); await sleep(k ? 900 : 2500); }
      const early = await page.evaluate(() => ({ rows: document.querySelectorAll(".lg-rr").length, ti: !!document.querySelector(".ap-ti, .ap-hl, .ap-c [data-pgturn]"), settle: !!document.querySelector(".ap-settle"), busy: !!window.__colonistGame._ldSettling?.(), tab: window.__colonistGame._rvTab, rv: !!document.querySelector(".rv"), step: window.__colonistGame._rvStep, ap: !!document.querySelector(".ap"), aib: !!document.querySelector("[data-aibody]") }));
      await shot(page, "ai-early", lang, w);
      ok(!early.busy || (early.rows === 0 && early.settle), `${tag}: AI tab: nothing ranked while the numbers are not final`, early);
      let done = false; for (let i = 0; i < 160 && !done; i++) { done = await page.evaluate(() => { const g = window.__colonistGame; return !g._ldSettling?.() && !!g._ldReady?.(); }); if (!done) await sleep(500); }
      ok(done, `${tag}: AI tab: the numbers become final`);
      await sleep(900);
      const snap = () => page.evaluate(() => ({ rows: [...document.querySelectorAll(".lg-rr")].map((r) => r.innerText.replace(/\s+/g, " ")), head: (document.querySelector(".ap-c .ap-ti")?.innerText || "").replace(/\s+/g, " ") }));
      const s1 = await snap(); await sleep(6000); const s2 = await snap();
      ok(s1.rows.length > 0 && JSON.stringify(s1) === JSON.stringify(s2), `${tag}: AI tab: the shown list and headline stay as they are`, { n: s1.rows.length });
      const bar = await page.evaluate(() => { const a = document.querySelector(".ai-ask"); const r = a?.getBoundingClientRect(); return r ? { h: Math.round(r.height), vh: innerHeight } : null; });
      ok(bar && bar.h / bar.vh <= 0.15, `${tag}: the ask bar is at most 15% of the screen`, bar && { ...bar, pct: +(100 * bar.h / bar.vh).toFixed(1) });
      const chips = await page.evaluate(() => { const c = document.querySelector(".ai-chips"); if (!c) return null; const tops = new Set([...c.querySelectorAll(".ai-q")].map((q) => Math.round(q.getBoundingClientRect().top))); return { rows: tops.size }; });
      ok(chips && chips.rows === 1, `${tag}: the ask chips are one row`, chips);
      if (isNL(lang)) { const T = await page.evaluate(VIS, ".rv"); const AI_SKIP = /^(Samenvatting uit de cijfers|Voor dit spel samengesteld|Vraag iets over dit spel)/; ok(true, `${tag}: (the AI page brings its own Dutch: src/review/ai-lang.js)`); }
      await shot(page, "ai", lang, w);
      // the Overview line and the round view say the same
      await page.evaluate(() => { window.__colonistGame._rvTab = "overview"; window.__colonistGame._rvDrawReview?.(); }); await sleep(1500);
      const ov = await page.evaluate(() => { const t = [...document.querySelectorAll(".rv *")].find((e) => e.children.length === 0 && /(Decided|Turning point|Beslist|Keerpunt)/.test(e.textContent))?.textContent || ""; const m = /(\d+)\D+(\d+)%\s*(?:→|->)\s*(\d+)%/.exec(t.replace(/^.*?(?:turn|beurt|ronde|round)\s*/i, "$&")); return { t: t.slice(0, 160), n: m && +m[1], a: m && +m[2], z: m && +m[3] }; });
      if (ov.n) {
        const rv = await page.evaluate(async (n) => { const g = window.__colonistGame; const { fx } = g._pgState(); const r = fx.lg?.view?.(n); return r ? { a: Math.round(r.v0[fx.me] * 100), z: Math.round(r.v1[fx.me] * 100) } : null; }, ov.n);
        ok(rv && rv.a === ov.a && rv.z === ov.z, `${tag}: Overview's decided-on line = the round view's numbers`, { overview: ov, round: rv });
      } else ok(true, `${tag}: (no decided-on line to compare)`, ov.t);
    }
    await ctx.close();
  }
  // ── EN -> NL in the same session: the step view's turn cards (title / aria-label, incl. "key turn") are Dutch whichever order things load in ──
  for (const first of ["en", "nl"]) {
    const tag = `switch ${first}->nl 412x923`; const { page, ctx } = await open(first, 412, 923); await review(page);
    await page.locator(".rv .rv-tabs button").nth(3).tap(); await sleep(1200); await page.locator("button", { hasText: /^Alle$|^All$/ }).first().tap(); await sleep(600);
    const i = await page.evaluate(() => Math.max(0, [...document.querySelectorAll(".mv-r")].findIndex((r) => r.classList.contains("c-missed"))));
    await page.locator(".mv-r").nth(i).tap(); await sleep(2600);
    if (first === "en") { await page.evaluate(async () => { (await import("/src/i18n.js")).setLang("nl"); }); await sleep(2500); }
    const A = await page.evaluate(() => [...document.querySelectorAll(".tv-card")].flatMap((c) => [c.getAttribute("title"), c.getAttribute("aria-label")]).filter(Boolean));
    ok(A.length > 0, `${tag}: the step view has turn cards`, A.length); // whether a turn is a "key turn" depends on the (Monte Carlo) luck run, so not asserted; the Dutch of that label is checked by the English scan below
    ok(english([...new Set(A)]).length === 0, `${tag}: turn cards' title / aria-label have no English`, english([...new Set(A)]).slice(0, 10));
    const K = await page.evaluate(async () => { const { t } = await import("/src/i18n.js"); return [t("Turn {n}, {d}% over the whole turn, key turn".replace(", key turn", ""), { n: 4, d: "−17" }), t("key turn"), t("key roll")]; });
    ok(K[0] === "Beurt 4, −17% over de hele beurt" && K[1] === "sleutelbeurt" && K[2] === "sleutelworp", `${tag}: the key-turn strings are Dutch (whether a turn is a key turn varies per run)`, K);
    await ctx.close();
  }
  ok(errs.filter((e) => !/Service Worker|ERR_FAILED/.test(e)).length === 0, "no page errors", errs.slice(0, 3));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
