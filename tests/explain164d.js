const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/explain/shots";
(async () => {
  const { b, page, errors } = await openApp(9978); const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  await G(async (ex) => { localStorage.setItem("colonist_recap_lang", "en"); const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  await page.locator("[data-rcgo]").first().tap(); await page.waitForFunction(() => document.querySelector(".rc-head") || document.querySelector(".rc-err"), null, { timeout: 90000 }); await sleep(800);
  const H = await G(() => document.querySelector(".rv-scroll").scrollHeight); console.log("scrollH", H, await G(() => document.querySelector(".rc-head, .rc-err")?.innerText));
  const y0 = await G(() => document.querySelector(".rc-lead").getBoundingClientRect().top - document.querySelector(".rv-scroll").getBoundingClientRect().top + document.querySelector(".rv-scroll").scrollTop);
  let n = 1; for (let y = Math.max(0, y0 - 20); y < H && n <= 4; y += 560, n++) { await G((y) => { document.querySelector(".rv-scroll").scrollTop = y; }, y); await sleep(300); await page.screenshot({ path: `${SH}/live-ov-${n}.png` }); }
  console.log(errors); await b.close();
})();
