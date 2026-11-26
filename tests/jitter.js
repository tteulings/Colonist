// Home jitter probe + assertions: node tests/jitter.js PORT   (layout-shift entries + per-frame position tracking of Home elements)
const { chromium } = require("playwright");
let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const port = +process.argv[2] || 9190, URL = `http://localhost:${port}/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROBE = () => {
  window.__cls = { total: 0, items: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__cls.total += e.value; window.__cls.items.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => (s.node && (s.node.className || s.node.nodeName)) + "").slice(0, 3) }); } }).observe({ type: "layout-shift", buffered: true }); } catch (_) {}
  window.__track = { on: true, jumps: [], last: {} };
  const SEL = [".sh-brand", ".sh-continue", ".sh-soon", ".sh-new", ".hm-start", ".hm-stats", ".sh-tabs"];
  const tick = () => { const T = window.__track; if (T.on) { SEL.forEach((s) => { const el = document.querySelector(s); const r = el ? el.getBoundingClientRect() : null; const k = r ? Math.round(r.top * 10) / 10 + "/" + Math.round(r.height * 10) / 10 : "none"; if (T.last[s] !== undefined && T.last[s] !== k) T.jumps.push({ s, from: T.last[s], to: k, t: Math.round(performance.now()) }); T.last[s] = k; }); } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
const mkctx = async (browser, lang, theme, vw, vh) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  await ctx.addInitScript(([l, th]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", th); } } catch (_) {} }, [lang, theme]);
  await ctx.addInitScript(PROBE);
  return ctx;
};
const ready = async (page) => { await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); };
const reset = (page) => page.evaluate(() => { window.__cls.total = 0; window.__cls.items = []; window.__track.jumps = []; window.__track.last = {}; window.__track.on = true; });
const read = (page) => page.evaluate(() => ({ cls: +window.__cls.total.toFixed(4), items: window.__cls.items, jumps: window.__track.jumps }));
async function seed(page) {
  await page.evaluate(async () => { const g = window.__colonistGame, H = g.hist; await H.open(); const now = Date.now(), D = 864e5;
    const mk = (i, res, ago, vp, bvp, acc) => ({ id: "seed" + i, v: 1, start: now - ago * D - 3e6, end: now - ago * D, mode: "classic", board: "island", n: 4, pts: 10, hot: false, me: 0, winner: res === "won" ? 0 : 1, result: res, turns: 40, ms: 3e6, star: false, rec: false, acc: acc ?? null, seats: [{ name: "You", vp, you: true }, { name: "A", vp: bvp, prof: "intermediate" }, { name: "B", vp: 4, prof: "intermediate" }, { name: "C", vp: 3, prof: "intermediate" }] });
    for (const m of [mk(1, "lost", 9, 6, 10), mk(2, "won", 6, 10, 7, 71), mk(3, "won", 4, 10, 8, 84), mk(4, "won", 2, 10, 7)]) await H.put(m, {});
    g.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 }); });
  await sleep(800); await page.evaluate(() => window.__colonistGame.goHome()); await sleep(700);
}
const real = (r) => r.jumps.filter((j) => j.from !== "none" && j.to !== "none" && j.s !== ".sh-tabs");
const fmt = (r) => `CLS ${r.cls}  jumps ${real(r).length}` + (real(r).length ? "  " + JSON.stringify(real(r).slice(0, 8)) : "") + (r.items.length ? "\n      shifts " + JSON.stringify(r.items.slice(0, 5)) : "");
module.exports = { real, mkctx, ready, reset, read, seed, fmt, sleep, URL };
if (require.main === module) (async () => {
  const browser = await chromium.launch();
  for (const [lang, th] of [["nl", "night"], ["en", "light"]]) {
    const ctx = await mkctx(browser, lang, th, 412, 923), page = await ctx.newPage();
    await page.goto(URL); await ready(page); await sleep(500); await seed(page);
    console.log(`== ${lang} ${th}`);
    // cold load with stored history + a saved game
    await reset(page); await page.reload(); await ready(page); await sleep(2000);
    const cold = await read(page); console.log("cold load      ", fmt(cold));
    const hs = (r) => real(r).filter((j) => j.from.split("/")[1] !== j.to.split("/")[1]);
    ok(cold.cls < 0.02, `[${lang}] cold load: CLS ${cold.cls} < 0.02`);
    ok(hs(cold).length === 0, `[${lang}] cold load: no card changes height (stats card is reserved)`);
    ok(real(cold).filter((j) => j.t > cold.jumps.reduce((m, x) => Math.min(m, x.t), 1e9) + 1500).length === 0, `[${lang}] cold load: everything is still 1.5 s after the first paint`);
    ok(real(cold).filter((j) => j.s === ".hm-start" && j.to.split("/")[0] - j.from.split("/")[0] > 5).length <= 1, `[${lang}] cold load: the intro plays once`);
    const run = async (name, fn) => { await reset(page); await fn(); await sleep(900); console.log(name.padEnd(15), fmt(await read(page))); };
    for (const k of ["mode:rush", "mode:classic", "board:seafarers", "board:island", "players:5", "players:3"]) { await run(k, () => page.locator(`[data-q="${k}"]`).tap()); const r = await read(page); ok(r.cls < 0.02 && real(r).length === 0, `[${lang}] tap ${k}: no shift (CLS ${r.cls}, ${real(r).length} jumps)`); }
    await run("adjust open", () => page.locator("[data-home=adjust]").tap());
    await run("adjust close", () => page.keyboard.press("Escape"));
    await run("tab Review", () => page.locator('.sh-tab[data-tab=review]').tap());
    await run("tab Bots", () => page.locator('.sh-tab[data-tab=bots]').tap());
    await run("tab Play", () => page.locator('.sh-tab[data-tab=play]').tap());
    await ctx.close();
  }
  await browser.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
