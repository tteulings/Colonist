// v1.99 fixA regression: the start picks must survive a reload / Continue before the first End turn, and are scored first.   node tests/start199.js PORT
// Before the fix the review recording was only saved at End turn: tap the two start spots, reload (or the phone kills the page) and the start picks were gone,
// so the review said "0 start picks checked". Real taps on the board, a real reload.
const { chromium } = require("playwright");
const port = +process.argv[2] || 9131, sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { if (!sessionStorage.getItem("keep")) localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); });
  await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const G = (f, a) => page.evaluate(f, a); await G(() => sessionStorage.setItem("keep", "1"));
  await page.locator(".hm-start").tap(); await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, { timeout: 15000 });
  const pt = (id, edge) => G(([id, edge]) => { const g = window.__colonistGame; let x, y; if (edge) { const [a, c] = g.geometry.edges[id].nodes, A = g.geometry.nodes[a], C = g.geometry.nodes[c]; x = (A.x + C.x) / 2; y = (A.y + C.y) / 2; } else { const n = g.geometry.nodes[id]; x = n.x; y = n.y; } const s = g.worldToScreen(x, y), r = g.canvas.getBoundingClientRect(); return { x: r.left + s.x * r.width / g.boardWidth, y: r.top + s.y * r.height / g.boardHeight }; }, [id, edge]);
  const mine = () => G(() => { const g = window.__colonistGame; return g._rv.recs.filter((r) => r.k === "setup" && g.players[r.pid].isHuman).length; });
  // first pick by real taps, then a reload before anything else (no End turn yet)
  await page.waitForFunction(() => { const g = window.__colonistGame; return g.setupPhase && g.currentPlayer?.isHuman && g.setupAction === "settlement"; }, null, { timeout: 60000 });
  let id = await G(() => { const g = window.__colonistGame; return g.getBestInitialSettlementNode(g.currentPlayer); }); let p = await pt(id); await page.touchscreen.tap(p.x, p.y); await sleep(400);
  ok((await mine()) === 1, "after the first tap the start pick is recorded");
  await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); await sleep(1200);
  ok((await mine()) === 1, "after a reload mid set-up the first start pick is still recorded (before the fix: 0)", await mine());
  // finish the first road, take the second spot, then Continue (saved game loaded again) before the first End turn
  await page.waitForFunction(() => window.__colonistGame.setupAction === "road", null, { timeout: 10000 });
  let e = await G(() => { const g = window.__colonistGame; return g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)).id; }); p = await pt(e, true); await page.touchscreen.tap(p.x, p.y); await sleep(500);
  await page.waitForFunction(() => { const g = window.__colonistGame; return g.setupPhase && g.currentPlayer?.isHuman && g.setupAction === "settlement"; }, null, { timeout: 60000 });
  id = await G(() => { const g = window.__colonistGame; return g.getBestInitialSettlementNode(g.currentPlayer); }); p = await pt(id); await page.touchscreen.tap(p.x, p.y); await sleep(400);
  e = await G(() => { const g = window.__colonistGame; return g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)).id; }); p = await pt(e, true); await page.touchscreen.tap(p.x, p.y); await sleep(500);
  await page.waitForFunction(() => !window.__colonistGame.setupPhase, null, { timeout: 60000 });
  ok((await mine()) === 2, "both start picks are recorded after set-up");
  await G(() => { const g = window.__colonistGame; g.saveToStorage(); g.loadFromStorage(); }); await sleep(500);
  ok((await mine()) === 2, "after saving and loading the game again (Home / Continue) both start picks are still recorded", await mine());
  // the review queue scores the start picks before any move decision
  const order = await G(() => { const g = window.__colonistGame, rv = { results: [{ i: 5, k: "end", loss: 0.2 }, { i: 6, k: "end", loss: 0.1 }, { i: 7, k: "setup", loss: 0 }, { i: 8, k: "setup", loss: 0.01 }] }; return g._rvDeepOrder(rv, [[{}, 5], [{}, 6], [{}, 7], [{}, 8]]).map(([, i]) => i); });
  ok(order[0] === 7 && order[1] === 8, "the deep round does the two start picks first", order);
  ok(!errors.length, "no page errors", errors.slice(0, 2));
  await b.close(); console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})();
