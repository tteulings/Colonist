// v1.99 in-app profile: a real page at 360 px, optional CDP CPU throttling, one scripted person who ends every turn at once, three bots. Measures the
// bot rounds (person ends turn -> person's next turn) and, with a CPU profile, where the time goes (fx.js, renderLog, the bots' thinking).
//   node tests/perf199.js [ROOT=repo] [PORT=8811]      env  THROTTLE=4  SECS=60  SPEED=93 (bot speed slider, 93 = default "Snel")  HOST=0|1  PROFILE=1  TRADES=answer|ignore
//   TRADES=answer (default): the person answers a bot's offer at once; ignore: the offer sits on the table until it expires (the 8 s rule), so its share can be told apart.
// Prints one JSON line.  Not a pass/fail test: numbers for docs/perf-v199.md.
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 8811;
const THROTTLE = +(process.env.THROTTLE || 1), SECS = +(process.env.SECS || 60), SPEED = process.env.SPEED || "93", HOST = process.env.HOST || "0", PROFILE = process.env.PROFILE === "1", TRADES = process.env.TRADES || "answer";
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream", "Cache-Control": "no-store" }); r.end(d); }); }); s.listen(port, () => res(s)); });

(async () => {
  const srv = await serve(ROOT, PORT);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(({ speed, host }) => {
    localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist.botSpeed", speed); localStorage.setItem("colonist.hostInApp", host);
    let a = 12345; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { speed: SPEED, host: HOST });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => !!window.__colonistGame && !!document.body.dataset.gameReady, null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate((trades) => {
    const g = window.__colonistGame, R = ["wood", "brick", "sheep", "wheat", "ore"];
    window.__perf = { rounds: [], lastEnd: null, thinkMs: 0, tradeWaitMs: 0, tradeSeen: 0, turns: 0 };
    const P = window.__perf;
    // the bots' thinking: executeAiMainPhase wall time (the planning and the moves of one bot turn)
    const ex = g.executeAiMainPhase.bind(g);
    g.executeAiMainPhase = (...a) => { const t = performance.now(); try { return ex(...a); } finally { P.thinkMs += performance.now() - t; P.turns++; } };
    window.__step = () => {
      if (g.winner) return "over";
      if (g.pendingIncomingTrade) {
        if (!P.tradeAt) { P.tradeAt = performance.now(); P.tradeSeen++; }
        if (trades === "answer") { P.tradeWaitMs += performance.now() - P.tradeAt; P.tradeAt = 0; g.resolveIncomingTrade(false); return "incoming"; }
        return "wait-trade";
      }
      if (P.tradeAt) { P.tradeWaitMs += performance.now() - P.tradeAt; P.tradeAt = 0; }
      if (g.pendingDiscard?.player?.isHuman) {
        const pd = g.pendingDiscard, h = { ...pd.player.resources };
        R.forEach((r) => { pd.selected[r] = 0; });
        for (let i = 0; i < pd.count; i++) { const r = R.slice().sort((x, y) => h[y] - h[x])[0]; h[r]--; pd.selected[r]++; }
        g._confirmDiscard(); return "discard";
      }
      const cur = g.currentPlayer;
      if (!cur?.isHuman) return "wait";
      if (g.robberVictimOptions?.length) { g.stealFromVictim(cur, g.robberVictimOptions[0]); g.robberContext = null; g.robberVictimOptions = []; g.render(); return "victim"; }
      if (g.pendingAction === "robber") { g._commitRobber(cur, g.chooseRobberHex(cur)); return "robber"; }
      if (g.setupPhase) {
        if (g.setupAction === "settlement") { g._commitSetup(cur, { type: "settlement", id: g.getBestInitialSettlementNode(cur) }); return "setup-s"; }
        if (g.setupAction === "road") { const e = g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)); g._commitSetup(cur, { type: e.ship ? "ship" : "road", id: e.id }); return "setup-r"; }
        return "wait";
      }
      if (g.phase === "pre_roll") {
        if (P.lastEnd != null) { P.rounds.push(performance.now() - P.lastEnd); P.lastEnd = null; }
        if (g.rollDiceBtn?.disabled) return "wait"; g.handleHumanRoll(); return "roll";
      }
      if (g.phase !== "main" || g._robberInProgress() || g.devPick) return "wait";
      g.handleHumanEndTurn(); P.lastEnd = performance.now(); return "end";
    };
    g.startNewGame({ mode: "classic", board: "island", map: "random", numBots: 3, botStyleMode: "all", allPreset: "intermediate" });
    if (g.speedRange) { g.speedRange.value = localStorage.getItem("colonist.botSpeed"); }
    setInterval(() => { try { window.__step(); } catch (e) { window.__err = String(e); } }, 50);
  }, TRADES);
  if (process.env.EXP === "nocss") await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  if (process.env.EXP === "nofx") await page.evaluate(() => { window.__colonistGame.fx = null; });
  if (process.env.EXP === "nodice") await page.evaluate(() => { window.__colonistGame.fx.diceRoll = () => 600; });
  if (process.env.EXP === "nofly") await page.evaluate(() => { const f = window.__colonistGame.fx; f.flyResources = () => {}; });
  if (process.env.EXP === "hidden") await page.addStyleTag({ content: "#fxLayer{display:none!important}" });
  if (THROTTLE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  if (PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 250 }); await cdp.send("Profiler.start"); }
  await cdp.send("Performance.enable");
  const met = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const m0 = await met();
  const t0 = Date.now();
  await page.waitForTimeout(SECS * 1000);
  const wall = Date.now() - t0;
  const m1 = await met(), dm = (k) => m1[k] - m0[k];
  let prof = null;
  if (PROFILE) { prof = (await cdp.send("Profiler.stop")).profile; if (process.env.PROFILE_OUT) fs.writeFileSync(process.env.PROFILE_OUT, JSON.stringify(prof)); }
  const P = await page.evaluate(() => ({ ...window.__perf, turn: window.__colonistGame.turn, err: window.__err || null, hostSteps: window.__hostSteps || 0 }));
  const out = { root: path.basename(ROOT), throttle: THROTTLE, speed: SPEED, host: HOST, trades: TRADES, secs: +(wall / 1000).toFixed(1), game_turn: P.turn, bot_turns: P.turns, think_ms_per_bot_turn: +(P.thinkMs / Math.max(1, P.turns)).toFixed(1), think_share_pct: +(100 * P.thinkMs / wall).toFixed(2),
    rounds: P.rounds.length, round_s_mean: P.rounds.length ? +(P.rounds.reduce((a, x) => a + x, 0) / P.rounds.length / 1000).toFixed(2) : null, round_s_median: P.rounds.length ? +([...P.rounds].sort((x, y) => x - y)[P.rounds.length >> 1] / 1000).toFixed(2) : null,
    trade_offers: P.tradeSeen, trade_wait_s: +(P.tradeWaitMs / 1000).toFixed(1), host_steps: P.hostSteps, layouts: dm("LayoutCount"), layout_ms: +(1000 * dm("LayoutDuration")).toFixed(0), restyles: dm("RecalcStyleCount"), restyle_ms: +(1000 * dm("RecalcStyleDuration")).toFixed(0), script_ms: +(1000 * dm("ScriptDuration")).toFixed(0), task_ms: +(1000 * dm("TaskDuration")).toFixed(0), err: P.err || errors[0] || null };
  if (prof) {
    const byId = new Map(prof.nodes.map((n) => [n.id, n])), self = new Map(), dt = prof.timeDeltas;
    prof.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (dt[i] || 0)));
    let tot = 0, idle = 0; const url = {}, fn = {};
    for (const [id, t] of self) { const n = byId.get(id), nm = n.callFrame.functionName || "(anon)"; if (nm === "(idle)") { idle += t; continue; } tot += t; const u = n.callFrame.url.split("/").slice(-1)[0] || nm; url[u] = (url[u] || 0) + t; fn[nm + "@" + u + ":" + n.callFrame.lineNumber] = (fn[nm + "@" + u + ":" + n.callFrame.lineNumber] || 0) + t; }
    const par = new Map(); prof.nodes.forEach((n) => (n.children || []).forEach((c) => par.set(c, n.id)));
    const incl = (pred) => { // inclusive time of the outermost frames that match
      let s = 0; for (const [id, t] of self) { let a = id, hit = false; while (a != null) { if (pred(byId.get(a).callFrame)) { hit = true; break; } a = par.get(a); } if (hit) s += t; } return s; };
    const pc = (x) => +(100 * x / tot).toFixed(1);
    out.cpu_busy_pct = +(100 * tot / (tot + idle)).toFixed(1);
    out.fx_incl_pct = pc(incl((c) => /fx\.js$/.test(c.url)));
    out.renderLog_incl_pct = pc(incl((c) => c.functionName === "renderLog"));
    out.render_incl_pct = pc(incl((c) => c.functionName === "render"));
    out.think_incl_pct = pc(incl((c) => c.functionName === "executeAiMainPhase"));
    out.top_self = Object.entries(fn).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${pc(v)}% ${k}`);
    out.top_files = Object.entries(url).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${pc(v)}% ${k}`);
  }
  console.log(JSON.stringify(out));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
