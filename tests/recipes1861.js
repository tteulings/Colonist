// v1.86.1 property checks on the recipe cards of every available game: points by source sum to final points (city = 2, base settlement not
// counted twice), the game card leads with the decisive swing (largest |delta| of You or the winner, final turns included), direction words
// match the delta sign, markers sit on the decisive turn.   node recipes1861.js PORT
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9940; let fails = 0;
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json"].map((f) => UP + f);
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/hot1861"; fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  for (let gi = 0; gi < FILES.length; gi++) {
    const ex = JSON.parse(fs.readFileSync(FILES[gi], "utf8"));
    await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await G(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
    await page.locator("[data-rvt=ai]").tap(); await sleep(2200);
    const tag = `game${gi + 1}`;
    const S = await G(() => {
      const g = window.__colonistGame, st = g._pgState(), fx = st.fx, me = fx.me, P = g.players[me];
      const cards = [...document.querySelectorAll(".ap-c")], wcW = st.page.widgets.find((w) => w.id === "wc");
      const wcCard = cards.find((c) => c.querySelector(".ap-lv, .ap-ti") && /win chance/i.test(c.querySelector(".ap-ti").textContent));
      const duo = [me, ...(fx.winner != null && fx.winner !== me ? [fx.winner] : [])];
      let best = null; if (fx.hasWc) duo.forEach((q) => fx.swings(q, 99).forEach((s) => { if (!best || Math.abs(s.d) > Math.abs(best.d) || (Math.abs(s.d) === Math.abs(best.d) && s.t > best.t)) best = { q, ...s }; }));
      const chip = wcW?.chip?.ref || null, m = /^d\.(.+)@(\d+)$/.exec(chip || "");
      const stacks = [...document.querySelectorAll(".ap-stack")].map((e) => { const c = {}; e.querySelectorAll(".ap-cell:not(.need)").forEach((x) => { const k = [...x.classList].find((n) => n !== "ap-cell"); c[k] = (c[k] || 0) + 1; }); return { c, have: e.querySelectorAll(".ap-cell:not(.need)").length }; });
      const mine = g.players[me];
      return { won: fx.won, best, chip, chipT: m ? +m[2] : null, chipSeat: m ? fx.seatOf(m[1]) : null, title: wcCard?.querySelector(".ap-ti").textContent || null,
        marks: wcW?.blocks?.[0]?.marks || null, vp: P.victoryPoints, nS: mine.settlements.size, nC: mine.cities.size, stacks, titles: cards.map((c) => c.querySelector(".ap-ti").textContent), T: fx.T,
        hl: document.querySelector(".ap-hl")?.textContent, strat: fx.strat[me] && { idleN: fx.strat[me].idleN, turns: fx.strat[me].turns, plan: fx.strat[me].plan, src: fx.strat[me].src, total: fx.strat[me].srcTotal },
        pts: g.players.map((p, q) => [p.victoryPoints, fx.strat[q]?.srcTotal]),
        dir: wcW ? (() => { const q = m ? fx.seatOf(m[1]) : me, d = fx.change(q, +m[2]); return d; })() : null };
    });
    console.log(tag, JSON.stringify({ title: S.title, marks: S.marks, best: S.best, stacks: S.stacks, strat: S.strat, hl: S.hl }));
    ok(S.pts.every(([v, t]) => t == null || v === t), `${tag}: points by source sum to every player's final points`, S.pts);
    const st0 = S.stacks[0];
    if (st0) {
      ok(st0.have === S.vp && st0.have === S.strat.total, `${tag}: squares = final points`, [st0.have, S.vp]);
      
      ok((st0.c.c || 0) === 2 * S.nC, `${tag}: a city is 2 squares`, [st0.c.c || 0, S.nC]);
      ok((st0.c.s || 0) === S.nS, `${tag}: settlements counted only while still settlements`, [st0.c.s || 0, S.nS]);
    }
    if (S.best) {
      ok(Math.abs(S.best.d) >= 3 ? S.chipT === S.best.t && S.chipSeat === S.best.q : true, `${tag}: game card turn/player = the decisive swing`, [S.chipT, S.chipSeat, S.best]);
      ok(!S.marks || S.marks.includes(S.best.t), `${tag}: marker on the decisive turn`, S.marks);
      if (S.title && S.dir) { const up = S.dir.d > 0; ok(up ? /\brose\b|steeg/.test(S.title.split(";")[0]) && !/slid/.test(S.title.split(";")[0]) : /\bslid\b|daalde/.test(S.title.split(";")[0]), `${tag}: direction word matches the sign`, [S.dir.d, S.title]); }
    }
    if (gi === 0) {
      ok(S.chipT >= 21 && /(Blaauw|win chance)/.test(S.title) && /turn 2[12]/.test(S.title), "owner game: card leads with the final collapse on turns 21-22", S.title);
      await page.evaluate(() => { document.documentElement.dataset.palette = "night"; }); await sleep(600); // the owner's Night theme
      await page.screenshot({ path: `${SH}/ai-top.png` });
      await page.evaluate(() => { const e = document.querySelector(".ap-stack"); e && e.scrollIntoView({ block: "center" }); }); await sleep(400);
      await page.screenshot({ path: `${SH}/ai-near.png` });
    }
  }
  ok(errors.length === 0, "no page errors", errors.slice(0, 3));
  await b.close(); console.log(fails ? `FAILED ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
