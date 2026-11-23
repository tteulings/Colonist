// v1.96: a game saved between a set-up settlement and its road resumes on the road (not a second settlement).
// Classic single human, hot-seat (2 humans), Seafarers, 5 players; reload after the settlement in set-up round 1 and round 2.
//   node tests/resume196.js [ROOT=repo] [PORT=8872]
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 8872;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT);
let fails = 0;
const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + JSON.stringify(x) + ")" : ""}`); if (!ok) fails++; };
const CASES = [
  { name: "classic", s: { mode: "classic", board: "island", numBots: 3 } },
  { name: "hotseat", s: { mode: "classic", board: "island", numBots: 1, humans: [true] } },
  { name: "seafarers", s: { mode: "classic", board: "seafarers", map: "beginner", numBots: 3 } },
  { name: "5 players", s: { mode: "classic", board: "island", numBots: 4 } },
];

async function run(b, c, round) {
  const tag = `${c.name} round ${round}`;
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("i")) { sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); }
    const st = window.setTimeout; window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) >= 4000 ? ms : (ms || 0) / 25, ...r);
  });
  const boot = async () => { await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); };
  await boot();
  await page.evaluate((s) => window.__colonistGame.startNewGame(s), c.s);
  const mineTurn = () => page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase && g.currentPlayer?.isHuman && g.setupAction; }, null, { timeout: 30000 });
  const ack = async () => { await page.evaluate(() => { const g = window.__colonistGame; if (g.hotseat && g.hsCoverOn != null) g._hsAck(); }); await sleep(300); };
  const tapAt = async (kind) => { // tap the first legal spot of this kind on the canvas
    await ack();
    const p = await page.evaluate((kind) => {
      const g = window.__colonistGame, pl = g.currentPlayer, sp = g.api.spots(pl.id);
      const P = (x, y) => { const s = g.worldToScreen(x, y), r = g.canvas.getBoundingClientRect(); return { x: r.left + s.x * r.width / g.boardWidth, y: r.top + s.y * r.height / g.boardHeight }; };
      if (kind === "settlement") { const id = [...sp.settlement][0]; const n = g.geometry.nodes[id]; return { id, ...P(n.x, n.y) }; }
      const id = [...(sp.road.size ? sp.road : sp.ship || [])][0]; const ed = g.geometry.edges[id], a = g.geometry.nodes[ed.nodes[0]], d = g.geometry.nodes[ed.nodes[1]];
      return { id, ...P((a.x + d.x) / 2, (a.y + d.y) / 2) };
    }, kind);
    await page.touchscreen.tap(p.x, p.y); await sleep(500);
    if (await page.evaluate(() => !!window.__colonistGame.confirmBuild)) { await page.touchscreen.tap(p.x, p.y); await sleep(500); }
    return p;
  };
  const pieces = () => page.evaluate(() => window.__colonistGame.players.map((p) => [p.settlements.size, p.roads.size + (p.ships?.size || 0)]));
  // play human set-up turns until the target round's settlement
  for (let guard = 0; guard < 20; guard++) {
    await mineTurn();
    const step = await page.evaluate(() => ({ s: window.__colonistGame.setupStep, n: window.__colonistGame.players.length }));
    if ((step.s >= step.n ? 2 : 1) === round) break;
    await tapAt("settlement"); await tapAt("road");
  }
  const seat = await page.evaluate(() => window.__colonistGame.currentPlayer.id);
  const before = await pieces();
  const node = (await tapAt("settlement")).id;
  check(await page.evaluate(() => window.__colonistGame.setupAction) === "road", `${tag}: settlement placed, road next`);
  await page.reload(); await boot(); await sleep(800);
  if (await page.locator("[data-home='continue']").count()) { await page.locator("[data-home='continue']").first().tap(); }
  await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, { timeout: 15000 });
  await sleep(600); await ack();
  const st = await page.evaluate(() => { const g = window.__colonistGame; const sp = g.api.spots(g.currentPlayer.id); return { cur: g.currentPlayer.id, sa: g.setupAction, last: g.lastSetupNodeId, roadSpots: sp.road.size + (sp.ship?.size || 0), askLog: g.logEntries.slice(-3).some((e) => /Place your settlement/.test(e.text)), n: g.currentPlayer.settlements.size }; });
  check(st.cur === seat && st.sa === "road" && st.last === node, `${tag}: resumed on the road`, st);
  check(st.roadSpots > 0, `${tag}: road spots highlighted`, st.roadSpots);
  check(!st.askLog, `${tag}: no "Place your settlement" line`);
  const hl = await page.evaluate(() => { const g = window.__colonistGame; return g._setupNodeWaiting ? g._setupNodeWaiting(g.currentPlayer) : null; });
  check(hl === node, `${tag}: the waiting node is the settlement`, hl);
  await tapAt("road");
  const after = await pieces();
  check(after[seat][0] === before[seat][0] + 1 && after[seat][1] === before[seat][1] + 1, `${tag}: one settlement + one road placed`, { before: before[seat], after: after[seat] });
  // play the rest of set-up
  for (let guard = 0; guard < 24; guard++) {
    const done = await page.evaluate(() => !window.__colonistGame.setupPhase);
    if (done) break;
    try { await mineTurn(); } catch (_) { break; }
    const a = await page.evaluate(() => window.__colonistGame.setupAction);
    if (a === "settlement") await tapAt("settlement");
    await tapAt("road");
  }
  await page.waitForFunction(() => !window.__colonistGame.setupPhase, null, { timeout: 30000 }).catch(() => {});
  const fin = await page.evaluate(() => ({ setup: window.__colonistGame.setupPhase, pl: window.__colonistGame.players.map((p) => [p.settlements.size, p.roads.size + (p.ships?.size || 0)]) }));
  check(!fin.setup, `${tag}: set-up continues to the main game`);
  check(fin.pl.every((x) => x[0] >= 2 && x[1] >= 2) && fin.pl.slice(0, c.s.humans ? 2 : 1).every((x) => x[0] === 2), `${tag}: everyone has 2+ settlements and roads/ships, humans exactly 2 settlements`, fin.pl);
  check(errors.length === 0, `${tag}: no page errors`, errors);
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  for (const c of CASES) for (const round of [1, 2]) { try { await run(b, c, round); } catch (e) { check(false, `${c.name} round ${round}: threw`, String(e.message).slice(0, 200)); } }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
