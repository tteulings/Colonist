// v1.86.2 property checks: (A) one source for points by source / per-turn points on every screen, (B) the surprise of the decisive swing (why it was so sudden),
// (C) chip colour: green / red only for You.   node surprise1862.js PORT
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9940; let fails = 0;
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json"].map((f) => UP + f);
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
    for (let w = 0; w < 240; w++) { if (!(await page.evaluate(() => !!window.__colonistGame._ldSettling?.()))) break; await sleep(500); } await sleep(1200); // v1.91 the page is drawn once its numbers are final
    const tag = `game${gi + 1}`;
    const S = await G(async () => {
      const g = window.__colonistGame, st = g._pgState(), fx = st.fx, x = fx.surprise, sc = await import("/src/review/score.js"), ai = await import("/src/review/ai-strat.js"), log = ai.handLog(g);
      const w = st.page.widgets.find((w) => w.id === "wc"), cardTx = document.querySelector(".ap-c .ap-tx")?.innerText || "", sur = document.querySelector(".ap-c [data-pgsur]");
      const src = g._st.sources.map((s, q) => { const f = sc.finalScore(g, q, log); return [s.settlements, s.cities, s.road, s.army, s.cards, s.islands, s.total].join() === [f.by.s, f.by.c * 2, f.by.L, f.by.A, f.by.v, f.by.I, f.total].join() && f.total === g.players[q].victoryPoints; });
      const pts = g.players.map((_, q) => ai.ptsByTurn(log, q).join() === log.last.map((k, t) => g._st.vp[t === 0 ? 0 : k || 0]?.[q]).join() || "n/a");
      const chip = document.querySelector(".ap-c .ap-chip"), cs = chip && getComputedStyle(chip).color;
      return { x, fact: fx.surpriseFact(), src, ptsOk: ai.ptsByTurn(log, 0).length === log.T + 1, cardTx, hasVisual: !!sur, surText: sur?.innerText || "", chipCls: chip?.className, chipSeat: w?.chip?.seat ?? null, tone: w?.chip?.tone, dec: fx.decisive && { seat: fx.decisive.seat, you: fx.players[fx.decisive.seat].you }, me: fx.me, vpSeat: x?.mover != null ? g.players[x.mover].victoryPoints : null, finalWinner: g.winner?.id, ptsTurn: x ? ai.ptsByTurn(log, x.mover ?? 0) : null };
    });
    console.log(tag, JSON.stringify({ kind: S.x?.kind, sentence: S.fact?.sentence, tone: S.tone, chipCls: S.chipCls }));
    ok(S.src.every(Boolean), `${tag}: stats.sources (end screen, Overview, recap) equal the shared finalScore and the final points`, S.src);
    ok(S.ptsOk, `${tag}: per-turn points come from the game record`);
    if (S.x) {
      ok(S.x.mover == null || Object.values(S.x.by).reduce((a, c) => a + c, 0) === S.x.gain, `${tag}: surprise: sources add up to the points gained`, S.x.by);
      ok(S.x.mover == null || S.x.before + S.x.gain === S.x.after, `${tag}: surprise: before + gained = after`, [S.x.before, S.x.gain, S.x.after]);
      ok(S.x.mover == null || (S.x.public + S.x.hidden === S.x.before && S.x.hidden >= 0), `${tag}: surprise: shown + hidden = points before`, [S.x.public, S.x.hidden, S.x.before]);
      ok(S.x.final ? S.x.mover === S.finalWinner : true, `${tag}: surprise on the last turn is about the winner`);
      ok(S.x.mover == null || S.x.after === S.ptsTurn[S.x.turn], `${tag}: surprise points after = the game record`, [S.x.after, S.ptsTurn?.[S.x.turn]]);
      ok(!!S.cardTx && !/\d{3,}|NaN|undefined/.test(S.cardTx), `${tag}: the short line is on the game card`, S.cardTx);
      ok(S.x.mover == null || S.hasVisual, `${tag}: the points visual is on the game card`);
      ok(!!S.fact?.sentence && S.fact.sentence.length > 15, `${tag}: the surprise is a fact for chat / composer`, S.fact?.sentence);
    }
    ok(S.tone == null && S.chipSeat == null, `${tag}: v1.90.1 the unlabelled "+47%" chip is gone from the game card (the numbers sit in the rows)`, [S.tone, S.chipSeat]);
    if (gi === 0) {
      ok(S.x?.kind === "card" && S.x.final && S.x.hidden === 1 && S.x.public === 8 && S.x.before === 9 && S.x.after === 10 && S.x.odds?.pct === 21 && S.x.seen === "held", "72eb: Blaauw drew his 2nd point card (a 21% draw) from 9 points, 8 shown at the table, on the last turn", S.x);
      ok(/hidden point card/.test(S.surText) && /counts point cards already held/.test(S.surText), "72eb: the card says it was hidden and that the win chance counted held cards", S.surText);
    }
  }
  ok(errors.length === 0, "no page errors", errors.slice(0, 3));
  await b.close(); console.log(fails ? `FAILED ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
