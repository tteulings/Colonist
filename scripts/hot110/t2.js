// real-tap pass & play: setup, a turn, win, end screen, both reviews run after each other
const L = require("./lib.js");
(async () => {
  const { browser, page } = await L.open(process.argv[2] || "light", "http://localhost:8771/index.html");
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await L.reachEnd(page, "Tim", "Rosa");
  await L.shot(page, "t2-end");
  // wait for both reviews
  for (let i = 0; i < 90; i++) { const st = await L.G(page, (g) => ({ run: g._rv?.run?.pid ?? null, q: g._rv?.queue, d0: g._rvReviewComplete(0), d1: g._rvReviewComplete(1), todo: [g._rvTodo(0).length, g._rvTodo(1).length] })); if (i % 5 === 0) console.log(JSON.stringify(st)); if (st.d0 && st.d1) break; await page.waitForTimeout(2000); }
  await L.shot(page, "t2-end-done");
  console.log(await page.evaluate(() => document.querySelector("[data-rvbox]")?.innerText.slice(0, 400)));
  // other person's seg -> gate cover
  const seg = page.locator('[data-rvfor]'); console.log("seg", await seg.count());
  await page.locator('[data-rvfor]').nth(1).click(); await page.waitForTimeout(500);
  await L.shot(page, "t2-gate");
  console.log("gate", await L.vis(page, "#hsGate"));
  await page.locator("#hsGate .hs-go").click(); await page.waitForTimeout(500);
  await L.shot(page, "t2-end-other");
  await page.locator(".rvb").first().click(); await page.waitForTimeout(1500);
  await L.shot(page, "t2-review");
  console.log(await L.G(page, (g) => ({ pid: g._rvPid, saved: Object.keys(JSON.parse(localStorage.getItem("colonist_review_v1") || "{}").reviews || {}), v: JSON.parse(localStorage.getItem("colonist_review_v1") || "{}").v })));
  console.log("ERRS", errs);
  await browser.close();
})().catch(e => { console.log("ERR", e.message); process.exit(1); });
