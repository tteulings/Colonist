const { chromium } = require("playwright"); const fs = require("fs");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/", S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/story190/";
const GAMES = { mwg5v7k7j2cc: "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", mwb26snvis5o: "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", mwg74y2d49gz: "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json" };
const SPECS = JSON.parse(fs.readFileSync(S + "boardspecs.json"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = {};
  for (const id of Object.keys(SPECS)) {
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage(); page.on("pageerror", (e) => console.log("ERR", e.message));
    await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_recap_lang", "nl"); localStorage.setItem("colonist.palette", "night"); });
    await page.goto("http://localhost:9931/"); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const ex = JSON.parse(fs.readFileSync(UP + GAMES[id], "utf8"));
    await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${id}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
    out[id] = await page.evaluate(async (specs) => { const g = window.__colonistGame; const { renderBoardPrimitive } = await import("/src/review/ai-board.js"); return specs.map(({ spec, opts }) => renderBoardPrimitive(spec, g, opts)); }, SPECS[id]);
    await b.close();
  }
  fs.writeFileSync(S + "boards.json", JSON.stringify(out)); console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.map((s) => s.length)])));
})();
