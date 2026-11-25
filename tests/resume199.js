// v1.99 finding 3: a review resumes (never restarts) after closing, reopening and a page reload; a scored decision stays scored; a verdict from a partial review says "quick estimate".
//   node tests/resume199.js PORT   (server: node tests/serve.mjs ROOT PORT)
// A fixture game is cut back to its first 30% of results (all marked as quick-round results), put in the history and opened; the engine runs on in the page.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const port = +process.argv[2] || 8781, FIX = path.join(__dirname, "fixtures", "post199"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails += 1; };
(async () => {
  const b = await chromium.launch();
  for (const file of fs.readdirSync(FIX).filter((f) => f.endsWith(".json")).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(FIX, file), "utf8")), { meta, format, v, calib, ...rec } = j, me = meta.me ?? 0;
    const rv = rec.rv.reviews[me], cut = Math.floor(rv.results.length * 0.3);
    rv.results = rv.results.slice(0, cut).map((x) => (x.skip ? x : { ...x, eng: "m100", leaf: "fit" })); rv.done = false; delete rv.engId; meta.prov = true; delete meta.acc; delete meta.lr; meta.acc = null;
    Object.keys(rec.rv.reviews).forEach((k) => { if (+k !== me) delete rec.rv.reviews[k]; });
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", "en"); });
    const boot = async () => { await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); await sleep(600); };
    const st = () => page.evaluate(() => { const g = window.__colonistGame, rv = g._rv?.revs?.[g._rvPid ?? 0], res = rv?.results || []; return { n: res.length, scored: res.filter((x) => x.acc != null && !x.skip).length, done: !!rv?.done, est: !!document.querySelector(".rv .px-est") }; });
    const open = async () => { await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(500); await page.evaluate((id) => window.__colonistGame._histSheet(id), meta.id); await sleep(350); await page.evaluate(() => document.querySelector("[data-sact=review]").click()); await page.waitForSelector(".rv .rv-tabs", { timeout: 45000 }); await sleep(300); };
    await boot();
    await page.evaluate(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec });
    await open(); const a = await st(); ok(a.n >= cut && a.n <= cut + 3 && !a.done, `${file}: opens on the partial review (fixA scores the start picks first, so the run may already have added one or two)`, a);
    { const hd = await page.evaluate(() => { const s = document.querySelector(".rv .rv-bar small"); return s ? { cut: s.scrollWidth > s.clientWidth + 1 || getComputedStyle(s).textOverflow === "ellipsis" && getComputedStyle(s).whiteSpace === "nowrap", txt: s.textContent, w: innerWidth } : null; }); ok(hd && !hd.cut && /provisional|Monte|decisions scored/.test(hd.txt), `${file}: the header summary at 360px is not cut off`, hd); }
    ok(a.est, `${file}: the Overview verdict of a partial review says "quick estimate"`);
    // finding 7: the Lessons list knows a game as soon as its review has results (the entry is written when the Lessons open), not only when the review has ended
    await sleep(700); await page.evaluate(() => window.__colonistGame._rvCloseReview(true)); await page.evaluate(() => window.__colonistGame.lessonsOpen()); await page.waitForSelector(".ln", { timeout: 20000 }); await sleep(1500);
    { const ln = await page.evaluate(() => ({ empty: /Lessons appear after you review games/.test(document.querySelector(".ln")?.innerText || ""), n: window.__colonistGame._ln?.items?.length ?? -1 })); ok(!ln.empty && ln.n >= 1, `${file}: the Lessons list is not empty once a review has results`, ln); }
    await page.evaluate(() => window.__colonistGame.lessonsClose()); await open();
    // run on; the scored count never goes down (sampled), then close and reopen: not restarted
    let prev = a, mono = true; for (let i = 0; i < 80; i += 1) { await sleep(250); const c = await st(); if (c.scored < prev.scored) mono = false; prev = c; if (c.n >= a.n + 6 || c.done) break; }
    ok(mono, `${file}: scored decisions only grow while the review runs`);
    await page.evaluate(() => window.__colonistGame._rvCloseReview(true)); await sleep(300);
    await open(); const r = await st(); ok(r.n >= prev.n && r.scored >= prev.scored, `${file}: reopening resumes (${prev.n} -> ${r.n} results, ${prev.scored} -> ${r.scored} scored)`, r);
    // a reload: what was checked is kept (saved every few results; the history entry follows within a second)
    await sleep(1800); const pre = await st(); await page.reload(); await boot(); await open(); const z = await st();
    ok(z.n > a.n + 2 && z.n >= pre.n - 3, `${file}: after a reload the review resumes from what was checked (${a.n} start, ${pre.n} before, ${z.n} after)`, z);
    ok(z.scored >= pre.scored - 1, `${file}: ... and the scored decisions stay scored (${pre.scored} before, ${z.scored} after)`);
    // it finishes; then the quick-estimate label is gone, and the scored count is not lower than the best seen
    let fin = z, best = Math.max(pre.scored, z.scored); for (let i = 0; i < 240 && !fin.done; i += 1) { await sleep(500); fin = await st(); best = Math.max(best, fin.scored); }
    ok(fin.done, `${file}: the resumed review completes`, fin); ok(fin.scored >= best - 0 && fin.scored >= z.scored, `${file}: the finished review scores at least what it had (${z.scored} -> ${fin.scored})`);
    await sleep(800); await page.evaluate(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); }); await sleep(400);
    ok(!(await st()).est, `${file}: a complete review shows no "quick estimate"`);
    ok(!errs.length, `${file}: no page errors`, errs.slice(0, 2));
    await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
