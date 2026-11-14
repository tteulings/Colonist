const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/explain/shots";
(async () => {
  const { b, page, errors } = await openApp(9978); const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  await G(async (ex) => { localStorage.setItem("colonist_recap_lang", "nl"); const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  await G(() => { const g = window.__colonistGame; g._rv.recap = { text: "x", lang: "nl", pid: g._rvPid, recap: { headline: "Blaauw won met steden.", turningPoints: [{ turn: 19, player: "Blaauw", title: "Rover op graan", text: "Je zette de rover op Graan 9.", from: 46, to: 40 }], luckOrPlay: { verdict: "both", luck: 1, moves: -2, text: "Beide." }, tip: "Let op de rover." } }; g._rcRefresh(); });
  await page.locator("[data-rcwhy]").first().scrollIntoViewIfNeeded(); await sleep(300); await page.screenshot({ path: `${SH}/nl-recap-why.png` });
  await page.locator("[data-rcwhy]").first().tap(); await sleep(1500);
  console.log(await G(() => ({ step: !!document.querySelector(".rv.step"), open: !!document.querySelector(".ex-p"), chips: [...document.querySelectorAll(".ex-chip")].map((c) => c.innerText) })));
  await page.locator("[data-exq]").nth(1).tap(); await page.waitForSelector(".ex-a, .rc-err", { timeout: 40000 }); await sleep(1500);
  await page.screenshot({ path: `${SH}/nl-answer.png` });
  await G(() => document.querySelector(".ex-p").scrollIntoView()); await sleep(300); await page.screenshot({ path: `${SH}/nl-answer-panel.png` });
  console.log(await G(() => document.querySelector(".ex-a, .rc-err")?.innerText), errors); await b.close();
})();
