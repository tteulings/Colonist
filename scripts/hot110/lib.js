const { chromium } = require("playwright");
const path = require("path");
const SHOTS = path.join(__dirname, "..", "shots");
exports.SHOTS = SHOTS;
exports.open = async (palette = "light", url = "http://localhost:8771/index.html") => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.addInitScript((p) => { try { localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.motion", "reduced"); } catch (_) {} }, palette);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERR", e.message));
  await page.goto(url);
  await page.waitForTimeout(1500);
  return { browser, page };
};
exports.shot = async (page, name) => { await page.screenshot({ path: path.join(SHOTS, `audit-${name}.png`) }); console.log("shot", name); };
exports.G = (page, fn, arg) => page.evaluate(new Function("arg", `const g=window.__colonistGame; return (${fn.toString()})(g,arg)`), arg);
// tap a world point on the canvas with a real touch tap
exports.tapWorld = async (page, wx, wy) => {
  const p = await page.evaluate(([wx, wy]) => { const g = window.__colonistGame; const s = g.worldToScreen(wx, wy); const r = g.canvas.getBoundingClientRect(); return { x: r.left + s.x * r.width / g.boardWidth, y: r.top + s.y * r.height / g.boardHeight }; }, [wx, wy]);
  await page.touchscreen.tap(p.x, p.y);
  return p;
};
exports.vis = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return !e.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; }, sel);
// New game with 2 humans (+1 bot), names, through setup by real taps, then a cheated win -> end screen
exports.reachEnd = async (page, n0 = "You", n1 = "Rosa") => {
  const wait = (ms) => page.waitForTimeout(ms);
  const G = (fn, a) => exports.G(page, fn, a);
  await page.getByText("More settings").click(); await wait(500);
  await page.locator('[data-seg="numBots"] [data-value="2"]').click();
  await page.locator('[data-kind="human"][data-seat="1"]').click();
  await page.locator('[data-name="0"]').fill(n0);
  await page.locator('[data-name="1"]').fill(n1);
  await page.locator(".ng-start").click(); await wait(1500);
  for (let n = 0; n < 60 && (await G((g) => g.setupPhase)); n++) {
    if ((await G((g) => g.hsCoverOn)) != null) { await page.locator(".hs-go").click(); await wait(700); continue; }
    const st = await G((g) => ({ act: g.setupAction, cur: g.players[g.setupQueue[g.setupStep]]?.isHuman }));
    if (!st.cur || !st.act) { await wait(300); continue; }
    if (st.act === "settlement") {
      const node = await G((g) => { const p = g.players[g.setupQueue[g.setupStep]]; let best = null, bs = -1; g.geometry.nodes.forEach((nd) => { if (g.canBuildSettlement(p, nd.id, true)) { const s = nd.adjacentHexes.length + Math.random(); if (s > bs) { bs = s; best = { x: nd.x, y: nd.y }; } } }); return best; });
      await exports.tapWorld(page, node.x, node.y); await wait(600);
    } else {
      const e = await G((g) => { const ed = g.geometry.edges.find((e) => e.owner == null && e.nodes.includes(g.lastSetupNodeId)); const a = g.geometry.nodes[ed.nodes[0]], b = g.geometry.nodes[ed.nodes[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; });
      await exports.tapWorld(page, e.x, e.y); await wait(700);
    }
  }
  for (let i = 0; i < 60; i++) { const s = await G((g) => ({ c: g.hsCoverOn, h: g.currentPlayer?.isHuman, ph: g.phase, sp: g.setupPhase })); if (s.c != null) { await page.locator(".hs-go").click(); await wait(600); continue; } if (!s.sp && s.h && s.ph === "pre_roll") break; await wait(400); }
  await G((g) => { g.settings.winPoints = 5; const p = g.currentPlayer; p.devVictoryPoints = 3; g.recomputeScores(); g.checkForWinner(p); });
  await wait(2500);
};
