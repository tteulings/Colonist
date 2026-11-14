const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/explain/shots";
(async () => {
  const { b, page, errors } = await openApp(9978); const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  await G(async (ex) => { localStorage.setItem("colonist_recap_lang", "nl"); const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  await page.screenshot({ path: `${SH}/ov-0-before.png` });
  await G(() => { const g = window.__colonistGame; g._rv.recap = { text: "x", lang: "nl", pid: g._rvPid, recap: { headline: "Blaauw won met twee steden en een verborgen puntenkaart.", turningPoints: [{ turn: 7, player: "Blaauw", title: "Stad op erts", text: "Blaauw bouwde een stad op erts 6 en ging van 2 naar 5 punten, daarmee kreeg hij ruim de meeste kaarten per worp.", from: 12, to: 20 }, { turn: 19, player: "Jij", title: "Rover op graan", text: "Je zette de rover op Graan 9 in plaats van Erts 6, waardoor Van Geelen en Blaauw hun productie hielden.", from: 51, to: 46 }], luckOrPlay: { verdict: "both", luck: 1, moves: -2, text: "Zowel dobbelstenen als zetten speelden mee." }, tip: "Zet de rover op de beste productie van de leider.", lessonTitle: "Blokkeer de sterkste bron", lessonKind: "robber" } }; g._rvDrawReview(); });
  await sleep(800); await page.screenshot({ path: `${SH}/ov-1-top.png` });
  const sc = () => G(() => document.querySelector(".rv-scroll"));
  for (const [n, y] of [["2", 700], ["3", 1400], ["4", 2100]]) { await G((y) => { document.querySelector(".rv-scroll").scrollTop = y; }, y); await sleep(300); await page.screenshot({ path: `${SH}/ov-${n}.png` }); }
  console.log(await G(() => ({ rows: document.querySelectorAll(".rc-kw").length, ai: document.querySelectorAll(".rc-kw.ai").length, lop: !!document.querySelector(".rc-lop"), lesson: !!document.querySelector(".rc-lesson"), old: !!document.querySelector(".rc-tps"), why: document.querySelectorAll("[data-rcwhy]").length })), errors);
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 0; }); await page.locator("[data-rcwhy]").first().tap(); await sleep(1500);
  console.log(await G(() => ({ step: !!document.querySelector(".rv.step"), panel: !!document.querySelector(".ex-p"), line: document.querySelector(".rc-line")?.innerText })));
  await page.screenshot({ path: `${SH}/nl-step-line.png` });
  await b.close();
})();
