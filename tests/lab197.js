// v1.97 AI Lab on the bot host: a lab game played by the host (g._labSimStart(..., { host })) records exactly what the old lab loop records.
//   (a) heuristic games, review recorder ON (recordOn): the recorder's decision records, the statistics log, the end state are equal
//   (b) Master / Super games, replayed in the sim frame from a worker's script (replayScript): same recorded moves, same result; the scripted seats
//       are played by the host (decide = the script) instead of the executeAiMainPhase / getBestInitialSettlementNode / moveRobber hooks
//   node tests/lab197.js [ROOT=repo] [PORT=8905]
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 8905;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT);
let fails = 0; const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + x + ")" : ""}`); if (!ok) fails++; };

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ serviceWorkers: "block" })).newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/index.html?lab=sim`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const out = await page.evaluate(async () => {
    const g = window.__colonistGame, H = g.constructor.labHelpers, P = H.AI_PRESETS;
    const HOST = await import("/src/bots/index.js"), LG = await import("/src/lab-games.js?v=196"), { makeMaster } = await import("/src/master/search.js");
    const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === "time" || k === "ms" || k === "start" || k === "end" || k === "t0" ? undefined : v)));
    const grab = () => ({ recs: (g._rv ? g._rv.recs : []).map((r) => r.k + r.pid + "@" + r.t + JSON.stringify(r.a || {})), full: strip(g._rv ? g._rv.recs : []), ev: g.stats ? g.stats.ev : null, steps: g.stats ? g.stats.steps.map((s) => s.slice(0, 4)) : null, vp: g.players.map((p) => p.victoryPoints), turn: g.turn, winner: g.winner ? g.winner.id : null });
    const results = [];
    const win = (x, y) => { const n = Math.max(x.length, y.length); let i = 0; while (i < n && JSON.stringify(x[i]) === JSON.stringify(y[i])) i++; return `@${i} old[${x.slice(Math.max(0, i - 3), i + 3).map((e) => JSON.stringify(e).slice(0, 60)).join(" ")}] host[${y.slice(Math.max(0, i - 3), i + 3).map((e) => JSON.stringify(e).slice(0, 60)).join(" ")}]`; };
    const first = (x, y) => { const n = Math.max(x.length, y.length); for (let i = 0; i < n; i++) if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) { const A = JSON.stringify(x[i]), B = JSON.stringify(y[i]); let j = 0; while (j < A.length && A[j] === B[j]) j++; return `@${i} ...${A.slice(Math.max(0, j - 60), j + 80)} vs ...${(B || "").slice(Math.max(0, j - 60), j + 80)}`; } return ""; };
    const same = (a, b) => (JSON.stringify(a) === JSON.stringify(b) ? "" : Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => (k === "ev" ? k + " " + win(a[k], b[k]) : k === "recs" ? k + " " + win(a[k].map((r) => r.k + r.pid + (r.a ? JSON.stringify(r.a) : "")), b[k].map((r) => r.k + r.pid + (r.a ? JSON.stringify(r.a) : ""))) + " | " + first(a[k], b[k]) : k)).join(" | "));
    // (a)
    const sets = [[P.expert, P.intermediate, P.beginner, P.shark], [P.trader, P.builder, P.expert, P.intermediate]];
    for (const [si, strategies] of sets.entries()) for (const seed of [11, 12]) {
      const run = (host) => { LG.recordOn(g, true); g._labSimStart(strategies, { players: 4, seed, host }); let r = { done: false }; while (!r.done) r = g._labSimStep(40); LG.recordOn(g, false); if (host) g._labHost?.engine?.release?.(); return grab(); };
      const a = run(null), c = run(HOST);
      const info = (a.full.length === c.full.length ? a.full.filter((r, i) => JSON.stringify(r) !== JSON.stringify(c.full[i])).length : -1) + " records' position data, " + (JSON.stringify(a.ev) === JSON.stringify(c.ev) ? 0 : "some") + " stats-event order";
      delete a.full; delete c.full;
      results.push({ kind: "heuristic", si, seed, info, diff: same({ ...a, ev: 0 }, { ...c, ev: 0 }), recs: a.recs.length, ev: a.ev.length, turn: a.turn });
    }
    // (b) a worker-like game (searched seat 0: record its decisions), then the page's replay with and without the host
    const mk = (s) => (s.policy === "master" ? makeMaster({ n: 6, timeMs: 0 }) : null);
    for (const seed of [21, 22]) {
      const strategies = [P.master || { ...P.expert, policy: "master" }, P.intermediate, P.expert, P.beginner];
      strategies[0] = { ...strategies[0], policy: "master" };
      const agents = strategies.map(mk), script = [];
      agents.forEach((a, i) => { if (!a) return; ["decideSetup", "decideMain", "decideRobber"].forEach((f, fi) => { const o = a[f]; a[f] = (...x) => { const d = o(...x); script.push([i, fi, d ? d.choice : null]); return d; }; }); });
      LG.recordOn(g, false);
      // the worker's game: the old lab loop with the agents (the hooks of lab-games.js route the seat to its agent)
      LG.hook(g);
      g._labSimStart(strategies, { players: 4, seed, agents }); let r = { done: false }; while (!r.done) r = g._labSimStep(40);
      agents.forEach((a) => a && ["decideSetup", "decideMain", "decideRobber"].forEach((f) => { /* leave */ }));
      g.players.forEach((p) => { p.agent = null; });
      const result = { winner: r.winner, turns: r.turns, vp: g.players.map((p) => p.victoryPoints) };
      const play = async (host) => { const ok = await LG.replayScript(g, { strategies, seed, map: "random", script, result }, true, host); const o = grab(); o.ok = ok; return o; };
      const a = await play(null), c = await play(HOST);
      const info = (a.full.length === c.full.length ? a.full.filter((r, i) => JSON.stringify(r) !== JSON.stringify(c.full[i])).length : -1) + " records' position data, " + (JSON.stringify(a.ev) === JSON.stringify(c.ev) ? 0 : "some") + " stats-event order";
      delete a.full; delete c.full;
      results.push({ kind: "script", seed, info, diff: same({ ...a, ev: 0 }, { ...c, ev: 0 }), ok: [a.ok, c.ok], recs: a.recs.length, script: script.length, turn: a.turn });
    }
    return results;
  });
  for (const r of out) check(!r.diff && (r.kind === "heuristic" ? r.recs > 20 : r.ok[0] && r.ok[1] && r.recs > 20), `${r.kind} ${r.si ?? ""} seed ${r.seed}: host = old loop (${r.recs} recorded decisions${r.ev ? ", " + r.ev + " stats events" : ", script " + r.script + " choices, replay ok " + r.ok}, turn ${r.turn}); not identical yet: ${r.info}`, r.diff);
  check(!errors.length, "no page errors", errors[0] || "");
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
