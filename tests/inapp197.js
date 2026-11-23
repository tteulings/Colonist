// v1.97 follow-up of step 4: the bots of a game you play are decided through the bot host (src/bots/inapp.js). Proof that nothing changed.
// Real page, seeded Math.random (counted), a virtual clock (page.clock), so a game is the same game every time: the same moves AND the same timers.
// Every seeded game is played twice (host ON / host OFF = the old driver) and once on a pristine copy of the previous release (BASE), and the runs are compared
// at every 250 ms of game time: hands, pieces, bank, deck, robber, scores, the log text, the animations queue, the stats events, the review recorder's records,
// the number of Math.random calls. Modes: classic, Seafarers, 5-6 players, Rush; bots only (watch mode) and one human with scripted taps.
//   node tests/inapp197.js [ROOT=repo] [BASE=pristine v1.96 copy] [PORT=8901]      env ONLY=classic,sea  GAMES=n  TURNS=n  HOST=1|0|modes (the flag of the ON run)
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), BASE = process.argv[3] && process.argv[3] !== "-" ? path.resolve(process.argv[3]) : null, PORT = +process.argv[4] || 8901;
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean), GAMES = +process.env.GAMES || 2, TURNS = +process.env.TURNS || 40, ONFLAG = process.env.HOST || "1";
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }); s.listen(port, () => res(s)); });
let fails = 0; const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + x + ")" : ""}`); if (!ok) fails++; };

const PRESETS = ["expert", "trader", "beginner", "shark", "builder", "simple", "intermediate"];
const perBot = (seed, n) => Array.from({ length: n }, (_, i) => PRESETS[(seed + i * 3) % PRESETS.length]);
const MODES = {
  classic: (seed) => ({ mode: "classic", board: "island", map: seed % 2 ? "balanced" : "random", numBots: 3, botStyleMode: "each", perBot: perBot(seed, 5) }),
  sea: (seed) => ({ mode: "classic", board: "seafarers", map: "beginner", numBots: 3, botStyleMode: "each", perBot: perBot(seed + 1, 5) }),
  six: (seed) => ({ mode: "classic", board: "island", map: "random", numBots: 4, botStyleMode: "each", perBot: perBot(seed + 2, 5) }),
  rush: (seed) => ({ mode: "rush", board: "island", numBots: 3, rushInterval: 8, botStyleMode: "each", perBot: perBot(seed, 5) }),
};

/** one in-page step of a scripted person (handlers only, the way the buttons call them); seeded by its own little generator */
function humanSetup() {
  window.__humanStep = () => {
    const g = window.__colonistGame, R = ["wood", "brick", "sheep", "wheat", "ore"];
    const me = g.players.find((p) => p.isHuman);
    if (g.winner) return "over";
    if (g.hsCoverOn != null) { g._hsAck(); return "cover"; }
    const rnd = window.__hr || (window.__hr = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })());
    if (g.pendingIncomingTrade) { g.resolveIncomingTrade(rnd() < 0.5); return "incoming"; }
    if (g.pendingDiscard?.player?.isHuman) {
      const pd = g.pendingDiscard, h = { ...pd.player.resources };
      R.forEach((r) => { pd.selected[r] = 0; });
      for (let i = 0; i < pd.count; i++) { const r = R.slice().sort((a, b) => h[b] - h[a])[0]; h[r]--; pd.selected[r]++; }
      g._confirmDiscard(); return "discard";
    }
    const cur = g.currentPlayer;
    if (g.rush) return g.rush.paused ? "wait" : (me && g.rush.ready && !g.rush.ready.includes(me.id) && window.__ready ? (g.handleHumanReady?.(), "ready") : "wait");
    if (!cur?.isHuman) return "wait";
    if (g.robberVictimOptions?.length) { g.stealFromVictim(cur, g.robberVictimOptions[0]); g.robberContext = null; g.robberVictimOptions = []; g.render(); return "victim"; }
    if (g.pendingAction === "robber") { g._commitRobber(cur, g.chooseRobberHex(cur)); return "robber"; }
    if (g.setupPhase) {
      if (g.setupAction === "settlement") { g._commitSetup(cur, { type: "settlement", id: g.getBestInitialSettlementNode(cur) }); return "setup-s"; }
      if (g.setupAction === "road") { const e = g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)); g._commitSetup(cur, { type: e.ship ? "ship" : "road", id: e.id }); return "setup-r"; }
      return "wait";
    }
    if (g.phase === "sbp") { g.api.act({ actor: cur.id, type: "passSbp" }); return "sbp"; }
    if (g.phase === "pre_roll") { if (g.rollDiceBtn?.disabled) return "wait"; g.handleHumanRoll(); return "roll"; }
    if (g.phase !== "main" || g._robberInProgress() || g.devPick) return "wait";
    const has = (c) => Object.entries(c).every(([r, n]) => cur.resources[r] >= n);
    window.__acts = (window.__acts || 0) + 1;
    if (has({ wood: 1, brick: 1 }) && rnd() < 0.5) { const e = g.api.legalOfType(cur.id, "build").find((a) => a.piece === "road"); if (e) { g.api.act(e); return "road"; } }
    if (has({ sheep: 1, wheat: 1, ore: 1 }) && rnd() < 0.5 && g.devDeck.length) { g.handleHumanBuyDevCard(); return "buy"; }
    if (cur.devCards.knight > 0 && !g.currentTurnPlayedDevCard && rnd() < 0.5) { g.handleHumanPlayDevCard("knight"); return "knight"; }
    g.handleHumanEndTurn(); return "end";
  };
}

/** the state worth comparing, as one string */
function snapshotFn() {
  window.__snap = () => {
    const g = window.__colonistGame, R = ["wood", "brick", "sheep", "wheat", "ore"], D = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
    return JSON.stringify({ t: g.turn, ph: g.phase, cp: g.currentPlayerIndex, w: g.winner ? g.winner.id : null, rc: window.__rc, lr: g.lastRoll,
      pl: g.players.map((p) => [R.map((r) => p.resources[r]), [...p.roads].sort((a, b) => a - b), [...p.settlements].sort((a, b) => a - b), [...p.cities].sort((a, b) => a - b), p.ships ? [...p.ships].sort((a, b) => a - b) : 0, D.map((d) => p.devCards[d] + "/" + p.newDevCards[d]), p.devVictoryPoints, p.victoryPoints, p.publicVictoryPoints, p.knightsPlayed, p.longestRoadLength]),
      bank: R.map((r) => g.bank[r]), dd: g.devDeck.length, ddt: g.devDeck.slice(-3), rob: g.robberHexId, pir: g.sea ? g.sea.pirateHexId : null, la: g.largestArmyHolder, lrh: g.longestRoadHolder?.id ?? g.longestRoadHolder,
      lg: g.logEntries.length, ll: g.logEntries.length ? g.logEntries[g.logEntries.length - 1].text : null, pa: g.placementAnims.length, ps: g.pendingAction, un: !!g.undoState, dice: g._aiDiceAnimating ? 1 : 0, pit: !!g.pendingIncomingTrade, ce: g.currentTurnPlayedDevCard,
      st: g.stats ? g.stats.ev.length + "/" + g.stats.steps.length : null, rv: g._rv ? g._rv.recs.length : null, rush: g.rush ? [g.rush.rollNo, g.rush.paused, g.rush.offers.length] : null });
  };
}

async function play({ root, port, flag, seed, settings, human, maxTurns }) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  await page.clock.install({ time: 1_700_000_000_000 });
  await page.addInitScript(({ seed, flag }) => {
    localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    if (flag != null) localStorage.setItem("colonist.hostInApp", flag);
    let a = seed >>> 0; window.__rc = 0;
    Math.random = () => { window.__rc++; a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { seed, flag });
  await page.goto(`http://localhost:${port}/`);
  await page.clock.pauseAt(1_700_000_005_000); // time stands still but for runFor: the run is the same every time
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__colonistGame && !!document.body.dataset.gameReady)); i++) await page.clock.runFor(100);
  await page.evaluate(humanSetup); await page.evaluate(snapshotFn);
  await page.evaluate(({ settings, human }) => {
    const g = window.__colonistGame;
    window.__hostCalls = 0;
    g.startNewGame(settings);
    if (!human) g.startAutoplay();
    window.__ready = true;
  }, { settings, human });
  const snaps = [], tags = {};
  let last = null, polls = 0;
  for (; polls < 12000; polls++) {
    await page.clock.runFor(250);
    const [t, s] = await page.evaluate((h) => [h ? window.__humanStep() : null, window.__snap()], human);
    if (t) tags[t] = (tags[t] || 0) + 1;
    if (s !== last) { snaps.push([polls, s]); last = s; }
    const st = JSON.parse(s);
    if (st.w != null || st.t >= maxTurns) break;
  }
  const end = await page.evaluate(() => {
    const g = window.__colonistGame;
    return { log: g.logEntries.map((e) => (typeof e === "string" ? e : e.text)), ev: g.stats ? JSON.stringify(g.stats.ev) : null, steps: g.stats ? JSON.stringify(g.stats.steps) : null,
      rv: g._rv ? JSON.stringify(g._rv.recs.map((r) => ({ k: r.k, a: r.a, pid: r.pid, t: r.t }))) : null, rc: window.__rc, turn: g.turn, winner: g.winner ? g.winner.id : null,
      host: window.__hostSteps || 0, toasts: document.querySelectorAll(".toast").length };
  });
  await b.close();
  return { snaps, end, tags, errors, polls };
}

function same(a, b) {
  if (a.snaps.length !== b.snaps.length) { const n = Math.min(a.snaps.length, b.snaps.length); for (let i = 0; i < n; i++) if (a.snaps[i][1] !== b.snaps[i][1] || a.snaps[i][0] !== b.snaps[i][0]) return `first snapshot difference at #${i} (poll ${a.snaps[i][0]} vs ${b.snaps[i][0]})`; return `snapshot counts ${a.snaps.length} vs ${b.snaps.length}`; }
  for (let i = 0; i < a.snaps.length; i++) if (a.snaps[i][1] !== b.snaps[i][1] || a.snaps[i][0] !== b.snaps[i][0]) {
    const x = JSON.parse(a.snaps[i][1]), y = JSON.parse(b.snaps[i][1]), keys = Object.keys(x).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
    return `snapshot #${i} (poll ${a.snaps[i][0]}/${b.snaps[i][0]}) differs in ${keys.join(",")}: ${keys.slice(0, 2).map((k) => JSON.stringify(x[k]).slice(0, 160) + " vs " + JSON.stringify(y[k]).slice(0, 160)).join(" | ")}`;
  }
  if (a.end.log.length !== b.end.log.length) return `log lengths ${a.end.log.length} vs ${b.end.log.length}`;
  const li = a.end.log.findIndex((l, i) => l !== b.end.log[i]); if (li >= 0) return `log line ${li}: "${a.end.log[li]}" vs "${b.end.log[li]}"`;
  for (const k of ["ev", "steps", "rv", "rc", "turn", "winner"]) if (a.end[k] !== b.end[k]) return `${k} differs: ${String(a.end[k]).slice(0, 120)} vs ${String(b.end[k]).slice(0, 120)}`;
  return "";
}

(async () => {
  const sv = [await serve(ROOT, PORT)]; if (BASE) sv.push(await serve(BASE, PORT + 1));
  for (const [mode, mk] of Object.entries(MODES)) {
    if (ONLY.length && !ONLY.includes(mode)) continue;
    for (let gi = 0; gi < GAMES; gi++) for (const human of [false, true]) {
      const seed = 1000 + gi * 77 + (mode.length * 13), settings = mk(seed), maxTurns = mode === "rush" ? 12 : TURNS;
      const tag = `${mode} ${human ? "1 human" : "bots only"} seed ${seed}`;
      const off = await play({ root: ROOT, port: PORT, flag: "0", seed, settings, human, maxTurns });
      const on = await play({ root: ROOT, port: PORT, flag: ONFLAG, seed, settings, human, maxTurns });
      const d = same(off, on) || (on.end.host > 0 || ONFLAG === "0" || mode === "rush" ? "" : "the host never played a move") || (mode === "rush" && on.end.host ? "Rush must stay on the old driver" : "") || (off.end.host ? "the old-driver run used the host" : "");
      check(!d && off.snaps.length > 40 && !on.errors.length && !off.errors.length, `${tag}: host ON = old driver (${off.snaps.length} states, ${off.end.log.length} log lines, turn ${off.end.turn}, ${off.end.rc} random calls, ${on.end.host} host moves${human ? ", taps " + JSON.stringify(off.tags) : ""})`, d || on.errors.concat(off.errors)[0] || "");
      if (BASE) { const base = await play({ root: BASE, port: PORT + 1, flag: null, seed, settings, human, maxTurns }); const d2 = same(off, base); check(!d2, `${tag}: old driver = previous release`, d2); }
    }
  }
  sv.forEach((s) => s.close());
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS"); process.exit(fails ? 1 : 0);
})();
