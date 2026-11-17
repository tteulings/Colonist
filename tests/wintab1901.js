// v1.90.1 / v1.90.2 ONE SET OF NUMBERS: once the step ledger is complete, every screen that shows a win chance (the Win chance tab and its moment bars, the scorecard chart, the turn cards, the play-by-play,
// the Replay) shows the ledger's values, so a turn has the same win chance everywhere (before: up to 17 points apart).
// v1.90.2 the check is on EVERY turn (not the round ends), on every export given, and it compares what the screens RENDER (aria labels, texts, the drawn path) with a series recomputed here from the stored data
// (R.luck.res entries and R.recs, read directly: its own decoder of the entries, its own "which record is the first of step s", its own "first record at or after event e"), not with the app's ledger functions.
//   node tests/wintab1901.js PORT [EXPORT.json ...]   (server: node step105/tests/serve.mjs ROOT PORT; no export given: the three exports of the owner's games)
const { chromium } = require("playwright"); const fs = require("fs");
const port = +process.argv[2] || 9990, UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const files = process.argv.length > 3 ? process.argv.slice(3) : ["867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json"].map((f) => UP + f);
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── in the page: the independent series, from the stored entries and the records ──
const INDEP = () => {
  const g = window.__colonistGame, R = g._rv, res = R.luck.res, recs = R.recs, N = recs.length, n = g.players.length, win = g.winner.id;
  const entry = (k) => { const a = res[`ref:${k}`], b = res[`pos:${k}`]; return a && b ? (a.F >= b.F ? a : b) : a || b || null; };
  // the value of the position BEFORE record i: the nearest earlier-or-equal record with a stored entry (identical consecutive positions are stored once); the end of the game: the result
  const valAt = (i) => { if (i >= N) return Array.from({ length: n }, (_, q) => (q === win ? 1 : 0)); for (let k = i; k >= 0; k--) { const e = entry(k); if (e && Array.isArray(e.v)) return e.v.slice(); } return null; };
  const first = {}; recs.forEach((r, i) => { if (r && (r.k === "roll" || r.k === "turn") && !(r.s in first)) first[r.s] = i; });
  const atEvent = (upto) => { for (let i = 0; i < N; i++) if (recs[i] && typeof recs[i].e === "number" && recs[i].e >= upto) return valAt(i); return valAt(N); };
  const afterStep = (s) => (s >= g._st.N ? valAt(N) : valAt(first[s]));
  const pct = (v) => { const t = v.reduce((a, c) => a + c, 0) || 1; return v.map((x) => Math.round((x / t) * 100)); };
  return { valAt, first, atEvent, afterStep, pct, N, n };
};

(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" }), errs = [];
  for (const file of files) {
    const page = await ctx.newPage(); page.on("pageerror", (e) => errs.push(e.message));
    await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_recap_lang", "nl"); });
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const ex = JSON.parse(fs.readFileSync(file, "utf8")), id = ex.meta.id, tag = id.slice(-12);
    await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${id}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 });
    await page.evaluate(() => { window.__colonistGame._rvTab = "ai"; }); await page.locator(".rv .rv-tabs button", { hasText: /AI/ }).first().tap();
    let ready = false; for (let i = 0; i < 400 && !ready; i++) { ready = await page.evaluate(() => !!window.__colonistGame._ldReady?.()); if (!ready) await sleep(300); }
    let settled = false; for (let i = 0; i < 300 && !settled; i++) { settled = await page.evaluate(() => { const g = window.__colonistGame; return !!g._ldJob && !g._ldJob.busy; }); if (!settled) await sleep(400); } await sleep(500); // (the shown rounds are refined once, in the worker: the numbers settle, then every screen is compared)
    ok(ready, `${tag}: the ledger is complete`);
    const flag = await page.evaluate(() => !!window.__colonistGame._rvOdds().ledger); ok(flag, `${tag}: the odds every screen reads are the ledger's`);

    // 1 the Win chance tab: for EVERY turn, the three bars (before the roll, after it, end of the turn) as rendered
    await page.evaluate(() => { window.__colonistGame._rvTab = "win"; window.__colonistGame._rvDrawReview(); }); await sleep(1200);
    const T1 = await page.evaluate((src) => {
      const I = (new Function(`return (${src})()`))(), g = window.__colonistGame, out = { n: 0, bad: [], steps: g._st.N }, me = g._rvPid;
      for (let S = 1; S <= g._st.N; S++) {
        g._rvWc = S; g._rvWcAuto = false; g._rvWinRepaint(); const bars = [...document.querySelectorAll(".rvw-bar")].map((el) => (el.getAttribute("aria-label") || "").split(", ").map((x) => +/(\d+)%$/.exec(x)?.[1]));
        const i0 = I.first[S - 1], want = [I.valAt(i0), I.valAt(i0 + 1), I.afterStep(S)].map((v) => (v ? I.pct(v) : null));
        for (let k = 0; k < 3; k++) { out.n += 1; if (!bars[k] || !want[k] || JSON.stringify(bars[k]) !== JSON.stringify(want[k])) out.bad.push([S, k, bars[k], want[k]]); }
      }
      return out;
    }, INDEP.toString());
    ok(T1.n >= 3 * (T1.steps - 1) && !T1.bad.length, `${tag}: the Win chance tab's moment bars equal the stored values at every one of ${T1.steps} steps (3 bars each, all seats)`, T1.bad.slice(0, 3));

    // 2 the chart on the Win chance tab and on the scorecard: every drawn vertex (the y of the path) against the stored values
    const T2 = await page.evaluate((src) => {
      const I = (new Function(`return (${src})()`))(), g = window.__colonistGame, out = { n: 0, bad: [] };
      // the scorecard chart (src/review-game.js _rvWinDraw): viewBox 304x112, top 6, bottom 98; the line of seat p: set-up points, then before the first roll, after each roll and at each turn's end
      g._rvTab = "overview"; g._rvDrawReview();
      const card = document.querySelector("[data-rvwin]"); if (!card) return { ...out, none: true };
      g._rvWinDraw(card, g._rvPid);
      const Y = (y) => 1 - (y - 6) / (98 - 6), st = g._st;
      g.players.forEach((p) => {
        const d = card.querySelector(`path.pc-${p.id}`)?.getAttribute("d") || ""; const ys = [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => Y(+m[2]));
        // the last N*2+1 vertices are the turns: [before the first roll], then (after the roll, end of turn) per step
        const want = [I.valAt(I.first[0])[p.id]]; for (let s = 1; s <= st.N; s++) { want.push(I.valAt(I.first[s - 1] + 1)[p.id]); want.push(I.afterStep(s)[p.id]); }
        const got = ys.slice(ys.length - want.length); out.n += want.length;
        if (got.length !== want.length) out.bad.push([p.id, "count", got.length, want.length]); else got.forEach((y, k) => { if (Math.abs(y - want[k]) > 0.0008) out.bad.push([p.id, k, +y.toFixed(4), +want[k].toFixed(4)]); });
      });
      return out;
    }, INDEP.toString());
    ok(!T2.none && T2.n > 100 && !T2.bad.length, `${tag}: every vertex of the scorecard chart is the stored value (${T2.n} points, all seats)`, T2.bad.slice(0, 3));

    // 3 the turn cards and the turn block of step mode (the end of every turn and the start -> end of each row)
    const decs = await page.evaluate(() => { const g = window.__colonistGame; return (g._rvOf(g._rvPid)?.results || []).filter((x) => x.win != null && (!x.skip || x.skip === "trivial")).map((x) => x.i).sort((a, c) => a - c); });
    ok(decs.length >= 3, `${tag}: ${decs.length} decisions to step through`);
    let T3 = { n: 0, bad: [], rows: 0 }, T4 = { n: 0, bad: [], beats: 0 };
    const pick = decs.filter((_, k) => k % Math.max(1, Math.floor(decs.length / 12)) === 0).slice(0, 14); // spread over the game (the turn cards cover every turn at once, the beats of each decision are all read)
    for (const i of pick) {
      await page.evaluate((i) => window.__colonistGame._rvEnterStep(i), i); await sleep(500);
      const a = await page.evaluate((src) => {
        const I = (new Function(`return (${src})()`))(), g = window.__colonistGame, out = { n: 0, bad: [], rows: 0 }, st = g._st, me = g._rvPid;
        const rangeOf = (T) => { let lo = 0, hi = 0; for (let q = 1; q <= st.N; q++) if (st.turnOf[q] === T) { if (!lo) lo = q; hi = q; } return lo ? { lo, hi } : null; };
        document.querySelectorAll(".tv-card").forEach((el) => { const T = +el.querySelector("b")?.textContent, rg = rangeOf(T), txt = el.querySelector("small")?.textContent || ""; if (!rg || !txt) return; const want = Math.round(100 * I.afterStep(rg.hi)[me] / (I.afterStep(rg.hi).reduce((x, y) => x + y, 0) || 1)); out.n += 1; if (+txt.replace("%", "") !== want) out.bad.push(["card", T, txt, want]); });
        const T = g._tv && g._tv.T, rg = T != null ? rangeOf(T) : null;
        if (rg) document.querySelectorAll(".tv-row").forEach((row) => { const q = g.players.findIndex((p) => row.querySelector("b")?.textContent === g._rvNm(p.id)), em = row.querySelector(".tv-h em")?.textContent || "", m = /(\d+)\s*→\s*(\d+)%/.exec(em); if (q < 0 || !m) return; const pre = I.pct(I.afterStep(rg.lo - 1))[q], post = I.pct(I.afterStep(rg.hi))[q]; out.rows += 1; out.n += 1; if (+m[1] !== pre || +m[2] !== post) out.bad.push(["row", T, q, em, pre, post]); });
        return out;
      }, INDEP.toString());
      T3.n += a.n; T3.rows += a.rows; T3.bad.push(...a.bad);
      // 4 the play-by-play: every beat of this decision; the win chance shown on the board corner
      const btn = page.locator("[data-rvpbp]").first(); if (await btn.count()) {
        await btn.tap(); await sleep(250);
        const nb = await page.evaluate(() => window.__colonistGame._rvPbp?.beats?.length || 0);
        for (let j = 0; j < nb; j++) {
          if (j) await page.evaluate(() => { document.querySelector('[data-rvbeatnav="1"]')?.click(); });
          await sleep(60);
          const r = await page.evaluate((src) => {
            const I = (new Function(`return (${src})()`))(), g = window.__colonistGame, P = g._rvPbp, bt = P && P.beats[P.j], el = document.querySelector(".rs-wc"); if (!bt || !el) return null;
            const shown = [...el.querySelectorAll("span")].map((s) => ({ q: +/pc-(\d+)/.exec(s.className)?.[1], v: +/(\d+)%/.exec(s.querySelector("b")?.textContent || "")?.[1], est: /≈/.test(s.textContent) }));
            const v = bt.start ? I.valAt(0) : bt.upto != null ? I.atEvent(bt.upto) : I.afterStep(bt.s), want = I.pct(v);
            return { j: P.j, upto: bt.upto, shown, want, wait: /…/.test(el.textContent) };
          }, INDEP.toString());
          if (!r) continue; T4.beats += 1;
          const badOne = r.wait || r.shown.length < 2 || r.shown.some((x) => x.v !== r.want[x.q]); T4.n += r.shown.length; if (badOne) T4.bad.push([i, r.j, r.upto, r.shown.map((x) => `${x.q}:${x.v}`).join(" "), r.want.join(",")]);
        }
        await page.evaluate(() => { document.querySelector("[data-rvpbpx]")?.click(); }); await sleep(150);
      }
    }
    ok(T3.n >= 20 && T3.rows >= 4 && !T3.bad.length, `${tag}: the turn cards (every turn of the game) and the start -> end of the turn rows show the stored values (${T3.n} numbers, ${T3.rows} rows)`, T3.bad.slice(0, 3));
    ok(T4.beats >= 15 && !T4.bad.length, `${tag}: the play-by-play shows the stored value at every move (${T4.beats} moves, ${T4.n} numbers, over ${pick.length} decisions)`, T4.bad.slice(0, 3));

    // 5 the Replay: the win chance of every seat at every step (the top rows) and the set-up pane
    await page.evaluate(() => { window.__colonistGame._rvCloseReview?.(); }); await sleep(200);
    const T5 = await page.evaluate(async (src) => {
      const I = (new Function(`return (${src})()`))(), g = window.__colonistGame, out = { n: 0, bad: [], steps: g._st.N, su: 0 };
      g._rpStart("replay"); await new Promise((r) => setTimeout(r, 800));
      const ui = document.querySelector(".gs-replay"), scrub = ui?.querySelector(".gs-rp-scrub"); if (!ui || !scrub) return { ...out, none: true };
      ui.querySelector(".gs-rp-play")?.click(); await new Promise((r) => setTimeout(r, 100)); // (paused)
      for (let s = 1; s <= g._st.N; s++) {
        scrub.value = String(s); scrub.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 25));
        const got = [...ui.querySelectorAll(".gs-vpr")].map((row) => ({ q: +row.dataset.pid, v: +/(\d+)%/.exec(row.querySelector(".gs-vpw")?.textContent || "")?.[1] })), want = I.pct(I.afterStep(s));
        got.forEach((x) => { out.n += 1; if (x.v !== want[x.q]) out.bad.push([s, x.q, x.v, want[x.q]]); });
      }
      // the set-up points the Replay draws (its data): the stored value after each placement
      const su = g._rvOdds().setup(); su.forEach((q) => { const w = I.atEvent(q.g), p = q.p; out.su += 1; if (!w || p.some((x, k) => Math.round(100 * x) !== I.pct(w)[k])) out.bad.push(["setup", q.g]); });
      g._rpClose?.();
      return out;
    }, INDEP.toString());
    ok(!T5.none && T5.n >= 3 * T5.steps && !T5.bad.length, `${tag}: the Replay shows the stored value for every seat at every one of ${T5.steps} steps, and its ${T5.su} set-up points are the stored ones`, T5.bad.slice(0, 3));
    await page.close();
  }
  ok(!errs.length, "no page errors", errs.slice(0, 2));
  await b.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
