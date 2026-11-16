// time of paired-future runs in the real worker (headless Chromium, desktop). node cost.js export.json
const fs = require("fs"); const { open, sleep } = require("../../tests/evals/browser.js");
const file = process.argv[2];
(async () => {
  const { b, page, errors } = await open({});
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(2500);
  const out = await page.evaluate(async () => {
    const g = window.__colonistGame, M = await import("./src/master.js"), R = g._rv, res = { hw: navigator.hardwareConcurrency, luck: [], explain: [] };
    const now = () => performance.now();
    const evs = g._lkEvents();
    const pick = (f) => evs.filter(f)[0];
    const tests = [["dice7", pick((e) => e.kind === "dice" && e.roll === 7 && e.s > 20)], ["dice-other", pick((e) => e.kind === "dice" && e.roll !== 7 && e.s > 20)], ["steal", pick((e) => e.kind === "steal")], ["dev", pick((e) => e.kind === "dev")]];
    for (const [name, ev] of tests) {
      if (!ev) continue; const { i, ...plain } = ev;
      for (const [lab, o] of [["default(25-75)", {}], ["200 futures", { futures: 200, maxFutures: 200, seMax: 1 }]]) {
        const t0 = now(); const m = await M.reviewRequest({ type: "luck", base: R.base, ev: plain, opts: { leaf: "gbm", ...o } }, 300000, 0); const wall = now() - t0;
        const r = m?.result || {}; res.luck.push({ name, s: ev.s, roll: ev.roll, lab, wall: Math.round(wall), F: r.F, engMs: r.ms, skip: r.skip, luck: r.luck && r.luck.map((x) => Math.round(x * 1000) / 10), se: r.se && r.se.map((x) => Math.round(x * 1000) / 10) });
      }
    }
    // explain runs (mover traced) for decisions of seat 0 and of opponents
    const { aiDecList } = await import("./src/review/ai-tools.js");
    const list = aiDecList(g).filter((e) => g._rsnCan(e.x, e.seat));
    const want = [["own build/any", list.find((e) => e.seat === 0)], ["opp build", list.find((e) => e.seat !== 0 && e.x.k === "build")], ["opp robber", list.find((e) => e.seat !== 0 && e.x.k === "robber")], ["opp other", list.find((e) => e.seat !== 0 && e.x.k !== "build" && e.x.k !== "robber")]];
    res.nExplainable = list.length;
    for (const [name, e] of want) {
      if (!e) continue; const t0 = now();
      const rsn = await g._rsnRun(e.x.i, e.seat); const wall = now() - t0;
      res.explain.push({ name, seat: e.seat, turn: e.turn, k: e.x.k, label: e.x.label, wall: Math.round(wall), n: rsn?.n, ms: rsn?.ms, gap: rsn?.gap, nReasons: rsn?.reasons?.length, reasons: rsn?.reasons?.map((r) => r.text) });
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); if (errors.length) console.log("errors", errors.slice(0, 3));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
