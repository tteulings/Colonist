// v1.90.1 ONE SET OF NUMBERS: once the step ledger is complete, the Win chance tab (O.get, the line's look, the scorecard chart) reads the ledger's values, so a turn has the same win chance on the card
// and on the tab (before: up to 17 points apart).   node tests/wintab1901.js PORT [EXPORT.json]   (server: node step105/tests/serve.mjs ROOT PORT)
const { chromium } = require("playwright"); const fs = require("fs");
const port = +process.argv[2] || 9990, file = process.argv[3] || "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json";
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" }), page = await ctx.newPage(), errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_recap_lang", "nl"); });
  await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const ex = JSON.parse(fs.readFileSync(file, "utf8")), id = ex.meta.id;
  await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 });
  await page.evaluate(() => { window.__colonistGame._rvTab = "ai"; }); await page.locator(".rv .rv-tabs button", { hasText: /AI/ }).first().tap();
  let ready = false; for (let i = 0; i < 300 && !ready; i++) { ready = await page.evaluate(() => !!window.__colonistGame._ldReady?.()); if (!ready) await sleep(300); }
  ok(ready, "the ledger is complete");
  const R = await page.evaluate(() => {
    const g = window.__colonistGame, led = g._ldReady(), M = g._rvLedgerMap(), O = g._rvOdds(), fx = g._pgState().fx, out = { n: 0, bad: [], lookBad: 0, flag: !!O.ledger, max: 0 };
    for (const r of led.rounds()) { if (r.t < 1) continue; const i = r.b + 1, s = i >= led.N ? O.N : [...M.first.entries()].find(([, k]) => k === i)?.[0]; if (s == null) continue; const v = O.get(s); out.n++;
      for (let q = 0; q < g.players.length; q++) { const card = fx.wc(q, r.t), tab = Math.round(v[q] * 100); out.max = Math.max(out.max, Math.abs(card - tab)); if (card !== tab) out.bad.push([r.t, q, card, tab]); } }
    const L = g._rvLook(); out.look = !!(L && L.ledger); if (L) L.steps.forEach((x) => { if (Math.abs(x.b.reduce((a, c) => a + c, 0) - 1) > 1e-4 || Math.abs(x.e.reduce((a, c) => a + c, 0) - 1) > 1e-4 || Math.abs(x.a.reduce((a, c) => a + c, 0) - 1) > 1e-4) out.lookBad++; });
    return out;
  });
  ok(R.flag && R.n >= 10, `the tab's odds come from the ledger (${R.n} round ends compared)`);
  ok(!R.bad.length && R.max === 0, "every seat's win chance at the end of every round is the same number on the card and on the Win chance tab", R.bad.slice(0, 4));

  // the tab itself draws
  await page.evaluate(() => { window.__colonistGame._rvTab = "win"; }); await page.locator(".rv .rv-tabs button", { hasText: /Winkans/ }).first().tap(); await sleep(1500);
  const T = await page.evaluate(() => ({ svg: !!document.querySelector("[data-rvwc] svg"), paths: document.querySelectorAll("[data-rvwc] svg path").length }));
  ok(T.svg && T.paths >= 4, "the Win chance tab draws its chart from those numbers", T);
  ok(!errs.length, "no page errors", errs.slice(0, 2));
  await b.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
