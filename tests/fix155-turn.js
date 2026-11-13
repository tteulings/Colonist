const { open: openApp, sleep, S } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js"); const fs = require("fs");
const port = +process.argv[2]; let bad = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m} ${typeof x === "string" ? x : JSON.stringify(x)}`); if (!c) bad++; };
(async () => {
  const { b, page, errors } = await openApp(port); const G = (f, a) => page.evaluate(f, a);
  const gm = JSON.parse(fs.readFileSync("/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/c96a5156-colonist-2026-11-11-mwb26snvis5o.json"));
  await G(async (g) => { const gg = window.__colonistGame; await gg.hist.open(); await gg.hist.put(g.meta, { state: g.state, rv: g.rv }); }, gm);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${gm.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 15000 }); await sleep(2500);
  const o = await G(() => window.__colonistGame._rvStepWhat(57)); console.log("step57", JSON.stringify(o.lines)); const o2 = await G(() => window.__colonistGame._rvStepWhat(58)); console.log("step58", JSON.stringify(o2.lines));
  await page.locator('.rv [data-rvt="win"]').tap(); await sleep(800);
  await G(() => { const g = window.__colonistGame; g._rvWc = 58; g._rvWcAuto = false; g._rvTab = "win"; g._rvDrawReview(); }); await sleep(600);
  console.log("card", (await G(() => document.querySelector("[data-rvwi]")?.innerText.replace(/\s+/g, " ").slice(0, 700))));
  await G(() => { const g = window.__colonistGame; g._rvTab = "moves"; g._rvDrawReview(); }); await sleep(500);
  const first = await G(() => [...document.querySelectorAll("[data-rvj]")].pop()?.dataset.rvj); await G((i) => window.__colonistGame._rvEnterStep(+i), first); await sleep(800);
  const t = await G(() => { const d = document.querySelector(".rv-turn"); if (!d) return null; d.open = true; return d.innerText.replace(/\s+/g, " "); }); ok(t, "turn summary present", t || "");
  await page.screenshot({ path: S + "/../fix155/step-" + port + ".png" });
  ok(!errors.length, "no page errors", errors.join("|")); await b.close(); process.exit(bad ? 1 : 0);
})();
