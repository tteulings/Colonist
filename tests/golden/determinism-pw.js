// (v0.87: + games with the Simple rulebook bot) Same seed -> same moves with analysis mode off, on, and on with Pause + Step driving every decision.
// Math.random is replaced by a seeded generator before the app loads; 3 seeded all-bot games (watch mode).
// Browser variant of the golden net (the Node runner tests/golden/run.mjs is the fast one). Real page, seeded Math.random, timers sped up 25x.
//   node tests/golden/determinism-pw.js [ROOT=repo] [TURNS=40]     env PORT (default 9921)
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), G = (page, f, a) => page.evaluate(f, a);
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }); s.listen(port, () => res(s)); });
const ROOT = process.argv[2] || path.join(__dirname, "..", ".."), PORT = Number(process.env.PORT || 9921);
const TURNS = Number(process.argv[3] || 40);
let fails = 0; const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x ? "  (" + x + ")" : ""}`); if (!ok) fails++; };
async function play(b, seed, mode, settings) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(({ seed, mode }) => {
    localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist.aiAnalysis", mode === "off" ? "off" : "on");
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const st = window.setTimeout, si = window.setInterval, sp = 25;
    window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) / sp, ...r);
    window.setInterval = (f, ms, ...r) => si(f, Math.max(1, (ms || 0) / sp), ...r);
  }, { seed, mode });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  await G(page, ({ settings, mode }) => {
    const g = window.__colonistGame;
    window.__moves = [];
    const R = ["wood", "brick", "sheep", "wheat", "ore"];
    const wrap = (k, f) => { const o = g[k].bind(g); g[k] = (...a) => { const r = o(...a); if (r !== false) window.__moves.push(f(...a)); return r; }; };
    wrap("placeRoad", (p, e) => `${p.id} road ${e}`);
    wrap("placeSettlement", (p, n) => `${p.id} set ${n}`);
    wrap("placeCity", (p, n) => `${p.id} city ${n}`);
    wrap("performBankTrade", (p, a, b) => `${p.id} bank ${a}>${b}`);
    wrap("buyDevelopmentCard", (p) => `${p.id} buy`);
    wrap("playDevelopmentCard", (p, t) => `${p.id} play ${t}`);
    wrap("moveRobberAndSteal", (p, h) => `${p.id} robber ${h}`);
    const al = g.addLog.bind(g); g.addLog = (t, m) => { if (/traded|discard|stole|rolled/i.test(t)) window.__moves.push(t); return al(t, m); };
    g.startNewGame(settings);
    if (mode === "step") g.aiPause();
    g.startAutoplay();
    if (mode === "step") {
      // a "user" pressing Step whenever the bots wait (and checking that they really wait)
      window.__steps = 0; window.__heldOk = 0;
      const tick = () => {
        if (g.winner || g.turn > window.__TURNS) return;
        if (g._aiHeld()) {
          const n = window.__moves.length;
          setTimeout(() => { if (window.__moves.length === n) window.__heldOk++; window.__steps++; g.aiStep(); setTimeout(tick, 5); }, 8);
        } else setTimeout(tick, 5);
      };
      tick();
    }
  }, { settings, mode });
  await G(page, (t) => { window.__TURNS = t; }, TURNS);
  await page.waitForFunction((t) => { const g = window.__colonistGame; return g.winner || g.turn > t; }, TURNS, { timeout: 400000, polling: 200 });
  const r = await G(page, () => { const g = window.__colonistGame; return { moves: window.__moves.slice(), turn: g.turn, winner: g.winner && g.winner.id, steps: window.__steps, heldOk: window.__heldOk, last: g.analysis.last && g.analysis.last.kind }; });
  await ctx.close();
  return { ...r, errors };
}
(async () => {
  const s = await serve(ROOT, PORT); const b = await chromium.launch();
  const games = [
    [101, { mode: "classic", map: "random", dice: "random", numBots: 3, botStyleMode: "all", allPreset: "intermediate", allStrategy: { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" } }],
    [202, { mode: "classic", map: "balanced", dice: "random", numBots: 3, botStyleMode: "each", perBot: ["expert", "trader", "beginner", "shark", "builder"] }],
    [303, { mode: "classic", map: "random", dice: "random", numBots: 3, botStyleMode: "each", perBot: ["shark", "builder", "trader", "expert", "beginner"] }],
    // v0.87: the Simple rulebook bot (and analysis on also builds the Step through data for every decision)
    [404, { mode: "classic", map: "random", dice: "random", numBots: 3, botStyleMode: "each", perBot: ["simple", "intermediate", "simple", "expert", "beginner"] }],
    [505, { mode: "classic", map: "balanced", dice: "random", numBots: 3, botStyleMode: "all", allPreset: "simple", allStrategy: { placement: "simple", expansion: "simple", trading: "conservative", devCards: "reactive", awareness: "none", policy: "rules" } }],
  ];
  for (const [seed, settings] of games) {
    const off = await play(b, seed, "off", settings);
    const on = await play(b, seed, "on", settings);
    const same = (x) => x.moves.length === off.moves.length && x.moves.every((m, i) => m === off.moves[i]);
    const firstDiff = (x) => x.moves.findIndex((m, i) => m !== off.moves[i]);
    check(off.moves.length > 50, `seed ${seed}: game played (${off.moves.length} moves, turn ${off.turn}, winner ${off.winner})`);
    check(same(on), `seed ${seed}: analysis ON gives identical moves`, same(on) ? `${on.moves.length} moves, last decision ${on.last}` : `diff at ${firstDiff(on)}: ${off.moves[firstDiff(on)]} vs ${on.moves[firstDiff(on)]}`);
    if (seed === 101) {
      const st = await play(b, seed, "step", settings);
      check(same(st), `seed ${seed}: Pause + Step every decision gives identical moves`, same(st) ? `${st.steps} steps` : `diff at ${firstDiff(st)}: ${off.moves[firstDiff(st)]} vs ${st.moves[firstDiff(st)]}`);
      check(st.heldOk === st.steps && st.steps > 30, "bots made no move while held", `${st.heldOk}/${st.steps}`);
      check(!st.errors.length, "step run: no page errors", st.errors.join(" | "));
    }
    check(!off.errors.length && !on.errors.length, `seed ${seed}: no page errors`, [...off.errors, ...on.errors].join(" | "));
  }
  console.log(fails ? `${fails} FAILED` : "ALL PASS");
  await b.close(); s.close(); process.exit(fails ? 1 : 0);
})();
