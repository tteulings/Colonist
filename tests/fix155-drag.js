const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const port = +process.argv[2];
(async () => {
  const { b, page, ctx } = await openApp(port); const G = (f, a) => page.evaluate(f, a);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator("[data-hrow]").first().tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 15000 }); await sleep(2500);
  await page.locator('.rv [data-rvt="win"]').tap(); await sleep(1500);
  const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const box = await G(() => { const r = document.querySelector(".rvw-c svg").getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  const res = await G(async (bx) => {
    const c = document.querySelector(".rvw-c"), times = [], frames = []; let last = performance.now(), on = true;
    const loop = (t) => { frames.push(t - last); last = t; if (on) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    const mk = (type, x) => new PointerEvent(type, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: bx.y, bubbles: true });
    const el = c.querySelector("svg"); el.dispatchEvent(mk("pointerdown", bx.x + 10));
    for (let i = 0; i <= 120; i++) { const x = bx.x + 10 + (bx.w - 20) * (0.5 - 0.5 * Math.cos(i / 120 * Math.PI * 2)); const t0 = performance.now(); el.dispatchEvent(mk("pointermove", x)); times.push(performance.now() - t0); await new Promise((r) => requestAnimationFrame(r)); }
    el.dispatchEvent(mk("pointerup", bx.x)); on = false;
    times.sort((a, b) => a - b); frames.sort((a, b) => a - b);
    return { moveMedianMs: +times[60].toFixed(2), moveP95Ms: +times[114].toFixed(2), frameMedianMs: +frames[Math.floor(frames.length / 2)].toFixed(1), frameP95Ms: +frames[Math.floor(frames.length * .95)].toFixed(1) };
  }, box);
  console.log(port, JSON.stringify(res)); await b.close();
})();
