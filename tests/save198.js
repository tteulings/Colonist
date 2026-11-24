// v1.98 save / load / history: a game in progress or a finished game is never lost.
//   S1 Menu > Home keeps the running game (no dialog, nothing abandoned): relaunch (persistent profile, closed like the user test) offers Continue, same board and turn
//   S2 a game that finished but whose history write never completed (closed first) is rescued into Past games on the next launch (also after the first-run migration flag is set)
//   S3 a full localStorage: the game save prunes cached review data first and is kept; when nothing can be pruned a message shows and nothing throws
//   S4 a game that ends while the tab is hidden is archived at once
//   node tests/save198.js [ROOT=repo] [PORT=9035]
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 9035;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT);
let fails = 0;
const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + JSON.stringify(x) + ")" : ""}`); if (!ok) fails++; };
const OPTS = { viewport: { width: 412, height: 923 }, isMobile: true, hasTouch: true, serviceWorkers: "block" };
const SETTINGS = { mode: "classic", board: "seafarers", map: "beginner", numBots: 3, winPoints: 14, botStyleMode: "all", allPreset: "grandmaster" };
const dirs = [];
async function launch(dir, errors) {
  const ctx = await chromium.launchPersistentContext(dir, OPTS);
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_review_auto", "off"); } catch (_) {} });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  return { ctx, page };
}
const newDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "save198-")); dirs.push(d); return d; };
async function playTo(page, turn) {
  await page.evaluate((s) => { const g = window.__colonistGame; g.startNewGame(s); setTimeout(() => g.startAutoplay(), 300); }, SETTINGS);
  await page.waitForFunction((t) => { const g = window.__colonistGame; return g.turn >= t && !g.setupPhase; }, turn, { timeout: 90000, polling: 200 });
  await page.evaluate(() => window.__colonistGame.stopAutoplay());
  await sleep(500);
}
const sig = (page) => page.evaluate(() => { const g = window.__colonistGame; return { turn: g.turn, hexes: g.geometry.hexes.map((h) => h.resource + (h.number || "")).join(","), vp: g.players.map((p) => p.victoryPoints).join(",") }; });
const win = (page) => page.evaluate(() => { const g = window.__colonistGame; const p = g.currentPlayer; p.victoryPoints = 99; g.checkForWinner(p); return g.stats?.id; });

(async () => {
  const errors = [];
  // ── S1 Menu > Home, then close the browser like the user test and come back
  {
    const dir = newDir();
    let { ctx, page } = await launch(dir, errors);
    await playTo(page, 3);
    const before = await sig(page);
    await page.locator("#mMenuBtn").first().tap();
    await page.locator("[data-menu=home]").tap();
    await sleep(600);
    check(await page.locator("[data-home='continue']").count() === 1, "S1 Menu > Home shows the home screen at once (no confirm dialog) with Continue");
    check(await page.evaluate(() => !!localStorage.getItem("colonist_save_v3")), "S1 the game is in storage after Home");
    await ctx.close();
    ({ ctx, page } = await launch(dir, errors));
    await sleep(500);
    check(await page.locator("[data-home='continue']").count() === 1, "S1 after closing and reopening the browser: Continue game is offered");
    await page.locator("[data-home='continue']").first().tap(); await sleep(800);
    const after = await sig(page);
    check(after.hexes === before.hexes && after.turn === before.turn && after.vp === before.vp, "S1 same board, turn and points after Continue", { before, after });
    await ctx.close();
  }
  // ── S2 finished, closed before the history write completed; the first-run flag is long set
  {
    const dir = newDir();
    let { ctx, page } = await launch(dir, errors);
    await sleep(800); // first launch: the migration flag is set now
    check(await page.evaluate(() => localStorage.getItem("colonist_hist_migrated") === "1"), "S2 the first-run flag is set");
    await playTo(page, 2);
    await page.evaluate(() => { window.__colonistGame.hist.put = () => new Promise(() => {}); }); // the browser closes before IndexedDB answers
    const id = await win(page);
    await sleep(500);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem("colonist_save_v3") || "null")?.winnerId != null), "S2 the finished game is in the slot");
    await ctx.close();
    ({ ctx, page } = await launch(dir, errors));
    await sleep(1500);
    const n = await page.evaluate((id) => ({ count: window.__colonistGame.hist.count, has: window.__colonistGame.hist.metas.some((m) => m.id === id) }), id);
    check(n.has, "S2 the finished game is in Past games after the next launch", n);
    await ctx.close();
  }
  // ── S3 full storage
  {
    const dir = newDir();
    let { ctx, page } = await launch(dir, errors);
    await playTo(page, 2);
    const r = await page.evaluate(() => {
      const g = window.__colonistGame, out = {};
      const fill = () => { let n = 0; for (const sz of [1e6, 1e5, 1e4, 1e3, 100, 10, 1]) for (;;) { try { localStorage.setItem("pad" + n, "x".repeat(sz)); n++; } catch (_) { break; } } return n; };
      localStorage.setItem("colonist_review_v1", "r".repeat(200000));
      localStorage.removeItem("colonist_save_v3"); // (a save that is replaced has room of its own: take it away so the new one needs space)
      const pads = fill();
      const bump = () => { g.turn += 1; g._lastSavedJson = null; g.saveToStorage(); };
      try { bump(); out.err = null; } catch (e) { out.err = e.message; }
      out.savedTurn = JSON.parse(localStorage.getItem("colonist_save_v3") || "null")?.turn; out.turn = g.turn;
      out.reviewGone = localStorage.getItem("colonist_review_v1") == null;
      out.padsKept = [...Array(pads).keys()].every((i) => localStorage.getItem("pad" + i) != null);
      // nothing left to prune: the message, no throw
      localStorage.removeItem("colonist_save_v3"); fill();
      try { bump(); out.err2 = null; } catch (e) { out.err2 = e.message; }
      out.toast = [...document.querySelectorAll(".toast")].some((t) => /storage is full/.test(t.textContent));
      out.saved2 = localStorage.getItem("colonist_save_v3") != null;
      return out;
    });
    check(r.err == null && r.savedTurn === r.turn, "S3 a full storage: the game is saved after the cached review data was dropped", r);
    check(r.reviewGone && r.padsKept, "S3 only the cached review recording was pruned");
    check(r.err2 == null && !r.saved2 && r.toast, "S3 nothing to prune: no exception, and a message says the game could not be saved", r);
    await ctx.close();
  }
  // ── S4 the game ends while the tab is hidden
  {
    const dir = newDir();
    let { ctx, page } = await launch(dir, errors);
    await playTo(page, 2);
    const other = await ctx.newPage(); await other.goto("about:blank"); await other.bringToFront(); await sleep(400);
    const hidden = await page.evaluate(() => document.hidden);
    const id = await win(page);
    await sleep(1200);
    const has = await page.evaluate((id) => window.__colonistGame.hist.metas.some((m) => m.id === id), id);
    check(has, `S4 a game that ends in a ${hidden ? "hidden" : "(not reported hidden here)"} tab is in Past games`);
    await ctx.close();
  }
  check(errors.length === 0, "no page errors", errors.slice(0, 3));
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  srv.close(); console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(fails ? 1 : 0);
})();
