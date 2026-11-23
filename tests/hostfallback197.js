// v1.97 a throw in the in-app bot host (or an answer judged illegal) must not hang the bot's turn: the old driver plays the phase.
//   node tests/hostfallback197.js [ROOT=repo] [PORT=8946]
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 8946;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT);
(async () => {
  const b = await chromium.launch(), page = await (await b.newContext({ serviceWorkers: "block" })).newPage();
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist.hostInApp", "1"); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    const g = window.__colonistGame; g.startNewGame({ mode: "classic", board: "island", map: "balanced", numBots: 3 });
    const { Engine } = await import("/src/api/engine.js"), apply = Engine.prototype.apply; let threw = 0;
    const errs = []; const ce = console.error; console.error = (...a) => { errs.push(String(a[0])); };
    Engine.prototype.apply = function (...a) { if (!threw) { threw++; throw new Error("boom"); } return apply.apply(this, a); };
    const bot = g.players.find((p) => !p.isHuman); g.setupPhase = false; g.phase = "main"; g.currentPlayerIndex = bot.id;
    bot.resources = { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 };
    let out; try { out = g.executeAiMainPhase(bot); } catch (e) { out = "THROWN " + e.message; }
    Engine.prototype.apply = apply; console.error = ce;
    return { threw, out: String(out), broken: !!g._hostBroken, errs };
  });
  const ok = r.threw === 1 && r.broken && !String(r.out).startsWith("THROWN");
  console.log(`${ok ? "PASS" : "FAIL"} host throw -> old driver finishes the phase`, JSON.stringify(r));
  await b.close(); srv.close(); process.exit(ok ? 0 : 1);
})();
