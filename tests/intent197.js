// Architecture step 3 leftovers (v1.97): gold picks, hot-seat asks, host timeouts, the coast chooser, the tools' enable state.
// (The base script is intent196.js: Architecture step 3 (v1.96): the UI dispatches actions. A scripted human plays Classic (real canvas taps for every board move, the real
// handlers for the buttons) through: set-up, build (road, settlement, city), Year of Plenty, Monopoly, Road Building, Knight + steal, a bought card,
// a 7 with a discard, robber + steal, a bank trade, a player trade offer, end turn; then Rush (Ready) and Seafarers (set-up, a ship built and moved).
//
//   node tests/intent197.js [ROOT=repo] [PORT=8811] [BASE=dir of origin/main]     env SHOTS=dir  ONLY=classic|rush|sea|gold|hotseat|rush7|chooser|buttons
//
// With BASE the very same script (same seeds) runs against that tree (serve a checkout of origin/main, v1.95) and every state snapshot after every
// step is compared: the UI must end in exactly the state main does (hands, pieces, bank, robber, log). Without BASE only the assertions run.
// On the new tree it also asserts that the moves went through the API (engine log holds the action types) and that the highlights are legalActions.
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 8811, BASE = process.argv[4] ? path.resolve(process.argv[4]) : null;
const ONLY = process.env.ONLY || "", SH = process.env.SHOTS || "";
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(port, () => res(s)); });
let fails = 0;
const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + (typeof x === "string" ? x : JSON.stringify(x)) + ")" : ""}`); if (!ok) fails++; };

/** the whole scripted session on one tree; returns { trace, api, errors }. */
async function session(b, port, seed, viewport, mode = "classic") {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.addInitScript(({ seed }) => {
    if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", "1");
    localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", "light"); localStorage.setItem("colonist.paletteAuto", "off");
    let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const st = window.setTimeout, si = window.setInterval, sp = 25; // the bots' pauses run 25x faster (the same on every tree)
    window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) >= 4000 ? ms : (ms || 0) / sp, ...r);
    window.setInterval = (f, ms, ...r) => si(f, Math.max(1, (ms || 0) / sp), ...r);
  }, { seed });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const E = (f, a) => page.evaluate(f, a);
  const trace = [];
  const snap = async (label) => { const s = await E((mode) => {
    const g = window.__colonistGame, R = ["wood", "brick", "sheep", "wheat", "ore"];
    return { turn: g.turn, phase: g.phase, cur: g.currentPlayerIndex, setup: g.setupPhase ? g.setupStep : -1, pa: g.pendingAction || null, free: g.freeRoadsRemaining, robber: g.robberHexId, pirate: g.sea?.pirateHexId ?? null,
      bank: R.map((r) => g.bank[r]).join(","), deck: g.devDeck.length, winner: g.winner?.id ?? null, played: !!g.currentTurnPlayedDevCard,
      seats: g.players.map((p) => [R.map((r) => p.resources[r]).join(","), [...p.roads].sort((x, y) => x - y).join("."), [...(p.ships || [])].sort((x, y) => x - y).join("."), [...p.settlements].sort((x, y) => x - y).join("."), [...p.cities].sort((x, y) => x - y).join("."),
        p.victoryPoints, p.knightsPlayed, Object.values(p.devCards).join("") + "/" + Object.values(p.newDevCards).join("")].join("|")),
      log: g.logEntries.slice(-3).map((l) => l.text),
      btn: ["buildRoadBtn", "buildSettlementBtn", "buildCityBtn", "buildShipBtn", "buyDevBtn", "mBuildBtn", "moveShipBtn"].map((id) => { const e = document.getElementById(id); return e ? id + ":" + (e.disabled ? 1 : 0) + (e.getAttribute("aria-disabled") || "") + "|" + (e.title || "") : id + ":-"; }).join(";"),
      rv: (g._rv?.recs || []).map((r) => r.k + JSON.stringify(r.a ?? null)).join(";"), ev: g.stats?.ev?.length ?? null }; }, mode); // the review recorder and the stats recorder see the same moves
    trace.push({ label, ...s }); if (process.env.DEBUG) console.log("  snap", label, JSON.stringify({ t: s.turn, ph: s.phase, cur: s.cur, pa: s.pa, log: s.log.slice(-1) })); return s; };
  // set-up and the bots' pauses run on timers: only the human's own pieces are compared there
  const snapLite = async (label) => { const s = await E(() => { const me = window.__colonistGame.players.find((p) => p.isHuman); return { s: [...me.settlements].sort((x, y) => x - y).join("."), r: [...me.roads].sort((x, y) => x - y).join("."), sh: me.ships ? [...me.ships].sort((x, y) => x - y).join(".") : "" }; }); trace.push({ label, ...s }); if (process.env.DEBUG) console.log("  lite", label, JSON.stringify(s)); };
  // ── pointer helpers: real taps on the canvas ──
  const pt = (wx, wy) => E(([wx, wy]) => { const g = window.__colonistGame, s = g.worldToScreen(wx, wy), r = g.canvas.getBoundingClientRect(); return { x: r.left + (s.x * r.width) / g.boardWidth, y: r.top + (s.y * r.height) / g.boardHeight }; }, [wx, wy]);
  const nodePt = async (id) => pt(...(await E((id) => { const n = window.__colonistGame.geometry.nodes[id]; return [n.x, n.y]; }, id)));
  const edgePt = async (id) => { const [a, c] = await E((id) => window.__colonistGame.geometry.edges[id].nodes, id); const pa = await nodePt(a), pc = await nodePt(c); return { x: (pa.x + pc.x) / 2, y: (pa.y + pc.y) / 2 }; };
  const hexPt = async (id) => pt(...(await E((id) => { const h = window.__colonistGame.geometry.hexes[id]; return [h.x ?? h.cx ?? h.center?.x, h.y ?? h.cy ?? h.center?.y]; }, id)));
  const tap = async (p, ms = 350) => { await page.touchscreen.tap(p.x, p.y); await sleep(ms); };
  const until = (f, a, ms = 60000) => page.waitForFunction(f, a, { timeout: ms, polling: 40 });
  // the human's discard when a BOT rolls a 7 (the script keeps a big hand)
  const botSeven = () => E(() => { const g = window.__colonistGame, pd = g.pendingDiscard; if (!pd?.player?.isHuman || g.currentPlayer?.isHuman) return false; let left = pd.count; for (const r of ["wood", "brick", "sheep", "wheat", "ore"]) { while (left > 0 && pd.selected[r] < pd.player.resources[r]) { g._discardMark(r); left--; } } g._confirmDiscard(); return true; });
  const myTurn = async (phase) => {
    const t0 = Date.now();
    for (;;) {
      const ok = await E((phase) => { const g = window.__colonistGame; return !g.winner && g.currentPlayer?.isHuman && g.phase === phase && !g.setupPhase && !g._robberInProgress() && !g.devPick; }, phase);
      if (ok) return;
      await botSeven();
      if (Date.now() - t0 > 60000) throw new Error("myTurn timeout " + phase);
      await sleep(40);
    }
  };
  /** a tap on a piece spot; a second tap if the game showed the spot first (confirm level "when unsure") */
  /** a real tap on a dock button (when it is there) */
  const dockTap = async (sel) => { const l = page.locator(sel).first(); await l.waitFor({ state: "visible", timeout: 8000 }); await l.tap(); await sleep(250); };
  const tapSpot = async (p, check) => { await tap(p); if (!(await E(check))) { await sleep(450); await tap(p); } };

  // ── set-up ──
  const startMode = async (mode) => {
    if (mode === "classic") { const c = page.locator(".hm-start"); await c.waitFor({ timeout: 10000 }); await c.tap(); }
    else await E((mode) => { const g = window.__colonistGame; g.startNewGame(mode === "rush" ? { mode: "rush", map: "random", dice: "random", numBots: 3, botStyleMode: "all", allPreset: "intermediate", allStrategy: { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" } }
      : { mode: "classic", board: "seafarers", map: "random", dice: "random", numBots: 3, botStyleMode: "all", allPreset: "intermediate", allStrategy: { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" } }); }, mode);
    await until(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, 20000);
  };
  const doSetup = async (tag) => {
    for (let i = 0; i < 2; i++) {
      await until(() => { const g = window.__colonistGame; return !g.setupPhase || (g.currentPlayer?.isHuman && g.setupAction); }, null, 60000);
      if (!(await E(() => window.__colonistGame.setupPhase))) break;
      const act = await E(() => window.__colonistGame.setupAction);
      if (act === "settlement") {
        const id = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; if (g.sea) { const c = g.geometry.nodes.filter((n) => g.canBuildSettlement(me, n.id, true) && n.edgeIds.some((e) => g.canBuildShip(me, e, { free: true, setupNode: n.id }))); if (c.length) return c[0].id; } return g.getBestInitialSettlementNode(me); });
        const before = await E(() => window.__colonistGame.players.find((p) => p.isHuman).settlements.size);
        await tapSpot(await nodePt(id), (before) => window.__colonistGame.players.find((p) => p.isHuman).settlements.size > before ? true : window.__colonistGame.setupAction === "road", before);
      }
      await until(() => { const g = window.__colonistGame; return g.setupAction === "road" || !g.setupPhase; }, null, 8000);
      if ((await E(() => window.__colonistGame.setupAction)) === "road") {
        const ship = await E(() => { const g = window.__colonistGame; if (!g.sea) return null; const n = g.lastSetupNodeId; return g.geometry.nodes[n].edgeIds.find((id) => g.canBuildShip(g.currentPlayer, id, { free: true, setupNode: n })) ?? null; });
        if (ship != null && i === 0) { // Seafarers: the first piece is a ship when the settlement is on the coast (the "Ship" chip in the dock)
          if (await E(() => !!document.querySelector('[data-setup-piece="ship"]'))) await dockTap('[data-setup-piece="ship"]');
          await tapSpot(await edgePt(ship), () => window.__colonistGame.setupAction !== "road");
        } else {
          const e = await E(() => { const g = window.__colonistGame; const n = g.lastSetupNodeId; const cand = g.sea ? g.geometry.nodes[n].edgeIds.filter((id) => g.canBuildRoad(g.currentPlayer, id, { free: true, setupNode: n })) : g.geometry.nodes[n].edgeIds.filter((id) => g.geometry.edges[id].owner == null); return cand[0]; });
          await tapSpot(await edgePt(e), () => window.__colonistGame.setupAction !== "road");
        }
      }
      await snapLite(`${tag} set-up piece ${i + 1}`);
    }
    await until(() => !window.__colonistGame.setupPhase, null, 90000);
    await snapLite(`${tag} set-up done`);
  };
  const giveHand = (res, dev = {}) => E(([res, dev]) => { const g = window.__colonistGame, me = g.players.find((p) => p.isHuman); Object.assign(me.resources, res); Object.assign(me.devCards, dev); g.render(); }, [res, dev]);
  const forceDice = (total) => E((total) => { const g = window.__colonistGame; if (!g.__rd0) { g.__rd0 = g.rollDice; g.rollDice = function () { const t = window.__fd; if (t && this.currentPlayer?.isHuman) { window.__fd = null; const d1 = Math.ceil(t / 2), d2 = t - d1; this.lastDiceTotal = t; return { total: t, d1, d2 }; } return g.__rd0.call(this); }; } window.__fd = total; }, total);
  const roll = async () => { await myTurn("pre_roll"); await E(() => window.__colonistGame.handleHumanRoll()); await until(() => { const g = window.__colonistGame; return g.phase !== "pre_roll"; }, null, 20000); await sleep(150); };
  const sets = () => E(() => { const me = window.__colonistGame.players.find((p) => p.isHuman); return { s: me.settlements.size, c: me.cities.size, r: me.roads.size, sh: me.ships ? me.ships.size : 0 }; });

  const classic = async () => {
    await startMode("classic"); await doSetup("classic");
    // ── turn 1: build ──
    await forceDice(8); await roll(); await myTurn("main");
    await giveHand({ wood: 6, brick: 6, sheep: 6, wheat: 6, ore: 6 }, { knight: 2, yearOfPlenty: 1, monopoly: 1, roadBuilding: 1 });
    await snap("main, rich");
    // a road by the build tool and a tap on the legal edge
    await E(() => window.__colonistGame.setPendingAction("road"));
    const roadEdge = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return g.geometry.edges.find((e) => g.canBuildRoad(me, e.id))?.id; });
    await tapSpot(await edgePt(roadEdge), () => window.__colonistGame.players.find((p) => p.isHuman).roads.size > 2 || !window.__colonistGame.confirmBuild);
    await snap("road built");
    // a settlement where a road of ours leads: first build a road further, then settle (when the distance rule allows), else a city
    await E(() => window.__colonistGame.setPendingAction("road"));
    const road2 = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return g.geometry.edges.find((e) => g.canBuildRoad(me, e.id) && e.id !== undefined && e.nodes.some((n) => g.geometry.nodes[n].owner == null && !g.geometry.nodes[n].neighbors.some((m) => g.geometry.nodes[m].structure != null)))?.id ?? g.geometry.edges.find((e) => g.canBuildRoad(me, e.id))?.id; });
    await tapSpot(await edgePt(road2), () => !window.__colonistGame.confirmBuild);
    await snap("second road");
    const settleNode = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return g.geometry.nodes.find((n) => g.canBuildSettlement(me, n.id, false))?.id ?? null; });
    if (settleNode != null) { await E(() => window.__colonistGame.setPendingAction("settlement")); await tapSpot(await nodePt(settleNode), () => !window.__colonistGame.confirmBuild); await snap("settlement built"); }
    const cityNode = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return [...me.settlements].find((n) => g.canBuildCity(me, n)) ?? null; });
    if (cityNode != null) { await E(() => window.__colonistGame.setPendingAction("city")); await tapSpot(await nodePt(cityNode), () => !window.__colonistGame.confirmBuild); await snap("city built"); }
    // a tap on a spot that is not legal does nothing (and nothing is spent)
    await E(() => window.__colonistGame.setPendingAction("settlement"));
    const taken = await E(() => { const g = window.__colonistGame; return g.geometry.nodes.find((n) => n.structure != null)?.id; });
    await tap(await nodePt(taken)); await snap("tap on a taken corner"); await E(() => { const g = window.__colonistGame; g.pendingAction = null; g.confirmBuild = null; g.render(); });
    // ── development cards ──
    await E(() => window.__colonistGame.handleHumanBuyDevCard()); await snap("bought a card");
    await E(() => window.__colonistGame.handleHumanPlayDevCard("yearOfPlenty")); await snap("Year of Plenty open");
    await E(() => { const g = window.__colonistGame; g._pickTap("ore"); g._pickTap("wheat"); }); await snap("Year of Plenty taken");
    // one card per turn: the rest next turn
    await E(() => window.__colonistGame.handleHumanEndTurn());
    // ── turn 2: the 7 (a discard), the robber and a steal ──
    await forceDice(7); await roll();
    await until(() => { const g = window.__colonistGame; return g.pendingDiscard?.player?.isHuman || g.pendingAction === "robber"; }, null, 20000);
    await snap("seven rolled");
    if (await E(() => !!window.__colonistGame.pendingDiscard)) {
      await E(() => { const g = window.__colonistGame, pd = g.pendingDiscard; const order = ["wood", "brick", "sheep", "wheat", "ore"]; let left = pd.count; for (const r of order) { while (left > 0 && pd.selected[r] < pd.player.resources[r]) { g._discardMark(r); left--; } } });
      await snap("discard marked");
      await dockTap("[data-discard-ok]"); // the dock's Hand back button
      await until(() => window.__colonistGame.pendingAction === "robber", null, 20000);
      await snap("discard done");
    }
    const hex = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; const L = g._legalRobberHexes(me).map((h) => h.id).filter((id) => id !== g.robberHexId); return L.find((id) => g._stealVictims(id, me).length > 1) ?? L.find((id) => g._stealVictims(id, me).length === 1) ?? L[0]; });
    await tap(await hexPt(hex));
    await until(() => { const g = window.__colonistGame; return g.pendingAction !== "robber" || g.confirmBuild?.type === "robber"; }, null, 8000);
    if (await E(() => window.__colonistGame.pendingAction === "robber" && window.__colonistGame.robberVictimOptions?.length === 0)) {
      await snap("robber tile chosen"); await dockTap("[data-rob-now], [data-victim]"); // "Rob now" (or the chosen victim's portrait)
    }
    if (await E(() => window.__colonistGame.robberVictimOptions?.length > 0)) { await snap("victims offered"); await dockTap("[data-steal]"); }
    await sleep(300); await snap("robber moved + stolen");
    // ── the other cards (a new turn would be needed; the tests of the cards themselves are in rushmono195): Knight before the roll is next turn ──
    await myTurn("main");
    // bank trade and a player offer
    await giveHand({ wood: 5, brick: 2, sheep: 2, wheat: 1, ore: 1 });
    await E(() => { const g = window.__colonistGame; g.tradeOffer = { wood: 4, brick: 0, sheep: 0, wheat: 0, ore: 0 }; g.tradeRequest = { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 0 }; g.handleHumanBankTrade(); });
    await snap("bank trade");
    await giveHand({ wood: 3, brick: 2, sheep: 2, wheat: 2, ore: 2 });
    for (const [give, want] of [["wood", "ore"], ["sheep", "wheat"], ["brick", "sheep"]]) {
      await E(([give, want]) => { const g = window.__colonistGame; const z = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }); g.tradeOffer = z(); g.tradeRequest = z(); g.tradeOffer[give] = 1; g.tradeRequest[want] = 1; g.handleHumanPlayerTrade(); }, [give, want]);
      const acc = await E(() => { const a = window.__colonistGame._tradeAnswers; return a ? a.responses.filter((r) => r.accepts).map((r) => r.player.id) : []; });
      await snap(`player offer ${give}>${want} accepted by ${acc.join(",") || "nobody"}`);
      if (acc.length) { await E((acc) => { const g = window.__colonistGame, a = g._tradeAnswers; g._executePlayerTrade(g.players[acc[0]], a.offer, a.request); }, acc); await snap("player trade done"); break; }
    }
    await E(() => window.__colonistGame.handleHumanEndTurn());
    // ── turn 3: Monopoly, Road Building, Knight ──
    await forceDice(6); await roll(); await myTurn("main");
    await giveHand({ wood: 3, brick: 3 }, { knight: 1, monopoly: 1, roadBuilding: 1 });
    await E(() => window.__colonistGame.handleHumanPlayDevCard("roadBuilding")); await snap("Road Building open");
    for (let i = 0; i < 2; i++) {
      const e = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return g.freeRoadsRemaining > 0 ? g.geometry.edges.find((x) => g.canBuildRoad(me, x.id, { free: true }))?.id ?? null : null; });
      if (e == null) break; await tapSpot(await edgePt(e), () => !window.__colonistGame.confirmBuild); await snap(`free road ${i + 1}`);
    }
    await E(() => window.__colonistGame.handleHumanEndTurn());
    await forceDice(5); await roll(); await myTurn("main");
    await E(() => window.__colonistGame.handleHumanPlayDevCard("monopoly")); await snap("Monopoly open");
    await E(() => { const g = window.__colonistGame; g._pickTap("ore"); g._finishPick(); }); await snap("Monopoly taken");
    await E(() => window.__colonistGame.handleHumanEndTurn());
    await forceDice(9); await roll(); await myTurn("main");
    await E(() => window.__colonistGame.handleHumanPlayDevCard("knight"));
    await until(() => window.__colonistGame.pendingAction === "robber", null, 4000); await snap("Knight played");
    const hex2 = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; const L = g._legalRobberHexes(me).map((h) => h.id).filter((id) => id !== g.robberHexId); return L.find((id) => g._stealVictims(id, me).length >= 1) ?? L[0]; });
    await tap(await hexPt(hex2)); await sleep(200);
    if (await E(() => window.__colonistGame.pendingAction === "robber" && window.__colonistGame.confirmBuild?.type === "robber")) await dockTap("[data-rob-now], [data-victim]");
    if (await E(() => window.__colonistGame.robberVictimOptions?.length > 0)) await dockTap("[data-steal]");
    await sleep(300); await snap("Knight robbed");
    await E(() => window.__colonistGame.handleHumanEndTurn());
  };

  const rush = async () => {
    await startMode("rush");
    await E(() => { window.__rushLog = []; });
    // set-up as in Classic (the same taps)
    await doSetup("rush");
    await until(() => { const g = window.__colonistGame; return g.rush && !g.rush.paused && !g.setupPhase; }, null, 30000);
    await E(() => { const g = window.__colonistGame; g.rush.remainingMs = Math.max(g.rush.remainingMs, 600000); });
    const before = await E(() => { const g = window.__colonistGame; return { ready: g.rush.ready.slice(), roll: g.rush.rollNo }; });
    await E(() => window.__colonistGame.toggleRushReady());
    // Ready is the human's vote: it stands in rush.ready, or the dice have already rolled on it (the clock runs 25x here)
    const r = await E(() => { const g = window.__colonistGame; return { ready: g.rush.ready.slice(), roll: g.rush.rollNo, hn: g._me().id }; });
    trace.push({ label: "rush ready", voted: r.ready.includes(r.hn) || r.roll > before.roll, before: before.ready.includes(r.hn) });
  };

  const sea = async () => {
    await startMode("sea");
    await doSetup("sea");
    await forceDice(8); await roll(); await myTurn("main");
    await giveHand({ wood: 6, brick: 6, sheep: 6, wheat: 6, ore: 6 });
    await snap("sea main");
    await E(() => window.__colonistGame.setPendingAction("ship"));
    const ship = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; return g.geometry.edges.find((e) => g.canBuildShip(me, e.id))?.id ?? null; });
    if (ship != null) {
      await tapSpot(await edgePt(ship), () => !window.__colonistGame.confirmBuild); await snap("ship built");
      // move a ship that may move (a ship built this turn may not): next turn
      await E(() => window.__colonistGame.handleHumanEndTurn());
      await forceDice(6); await roll(); await myTurn("main");
      const mv = await E(() => { const g = window.__colonistGame, me = g.currentPlayer; for (const from of g.sea.movableShips(me)) { const t = g.sea.moveTargets(me, from); if (t.length) return { from, to: t[0] }; } return null; });
      if (mv) {
        await E((mv) => { const g = window.__colonistGame; g.setPendingAction("moveShip"); g._seaStartMove(g.currentPlayer, mv.from); }, mv);
        await tapSpot(await edgePt(mv.to), () => true); await snap("ship moved");
      } else trace.push({ label: "no movable ship" });
    } else trace.push({ label: "no ship spot" });
  };


  // the buttons' enabled states + what setPendingAction does for every tool, with the hand set to each cost
  const buttons = async () => {
    await startMode("classic"); await doSetup("buttons");
    await forceDice(8); await roll(); await myTurn("main");
    const hands = [["empty", {}], ["road", { wood: 1, brick: 1 }], ["settlement", { wood: 1, brick: 1, sheep: 1, wheat: 1 }], ["city", { wheat: 2, ore: 3 }], ["dev", { sheep: 1, wheat: 1, ore: 1 }], ["rich", { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 }]];
    for (const [name, h] of hands) {
      await giveHand({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...h });
      for (const t of ["road", "settlement", "city", "ship"]) {
        await E((t) => { const g = window.__colonistGame; g.pendingAction = null; g.confirmBuild = null; g.setPendingAction(t); }, t);
        const pa = await E(() => window.__colonistGame.pendingAction);
        await E(() => { const g = window.__colonistGame; g.pendingAction = null; g.render(); });
        trace.push({ label: `buttons ${name} tool ${t}`, pa });
      }
      await snap(`buttons ${name}`);
    }
    await giveHand({ wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 });
    await E(() => { const g = window.__colonistGame; g.__deck = g.devDeck.splice(0); g.render(); }); await snap("buttons deck empty");
    await E(() => { const g = window.__colonistGame; g.devDeck.push(...g.__deck); g.freeRoadsRemaining = 2; g.render(); }); await snap("buttons free roads");
    trace.push({ label: "free roads tool", ok: await E(() => { const g = window.__colonistGame; g.pendingAction = null; g.setPendingAction("road"); const r = g.pendingAction; g.pendingAction = null; g.freeRoadsRemaining = 0; g.render(); return r; }) });
    await E(() => { const g = window.__colonistGame; const me = g.players.find((p) => p.isHuman); while (me.roads.size < 15) me.roads.add(900 + me.roads.size); g.render(); }); await snap("buttons no roads left");
    await E(() => { const g = window.__colonistGame; const me = g.players.find((p) => p.isHuman); [...me.roads].filter((x) => x >= 900).forEach((x) => me.roads.delete(x)); g.render(); });
  };

  // Seafarers gold: per-card taps with Undo (each tap takes the card at once, as v1.96)
  const gold = async () => {
    await startMode("sea"); await doSetup("gold");
    await forceDice(8); await roll(); await myTurn("main");
    await giveHand({ wood: 2, brick: 0, sheep: 1, wheat: 0, ore: 0 });
    const view = async (label) => trace.push({ label, ...(await E(() => { const g = window.__colonistGame, me = g.players.find((p) => p.isHuman), it = g.sea.goldFor(me.id), tc = document.querySelector("#tickerCancel");
      return { open: !!it, tray: [...document.querySelectorAll("[data-gold]")].map((b) => b.dataset.gold + (b.disabled ? "!" : "") + ":" + (b.querySelector(".pk")?.textContent || "")).join(","), hint: g._seaTrayGold(me, () => "")?.hint ?? null, undoable: !!g._seaGoldUndoable(), word: tc && !tc.hidden ? tc.textContent : null }; })) });
    const open = (n) => E((n) => { const g = window.__colonistGame, me = g.players.find((p) => p.isHuman); g.sea.gold.push({ pid: me.id, count: n, total: n }); g.render(); }, n);
    const goldTap = async (r) => { if (await E((r) => document.querySelector(`[data-gold="${r}"]`)?.disabled, r)) { trace.push({ label: `gold ${r} disabled` }); return; } await dockTap(`[data-gold="${r}"]`); await sleep(120); };
    await open(2); await view("gold open");
    await goldTap("ore"); await view("gold ore");
    await dockTap("#tickerCancel"); await view("gold ore undone");
    await goldTap("ore"); await goldTap("wheat"); await sleep(200); await view("gold complete"); await snap("gold complete state");
    await E(() => window.__colonistGame.undoLast()); await view("gold undo after complete"); await snap("gold undone state");
    await goldTap("ore"); await goldTap("ore"); await sleep(200); await snap("gold ore ore");
    // the bank runs short: only one sheep left
    await E(() => { const g = window.__colonistGame; g.__sh = g.bank.sheep; g.bank.sheep = 1; }); await open(2); await view("gold bank short");
    await goldTap("sheep"); await view("gold sheep"); await goldTap("sheep"); await view("gold sheep again (refused)"); await goldTap("brick"); await sleep(200); await snap("gold bank short done");
    await E(() => { const g = window.__colonistGame; g.bank.sheep = g.__sh; });
    // a pick the host makes for the human (the Rush roll): the same cards the bots' rule would take
    await open(3); await E(() => { const g = window.__colonistGame, me = g.players.find((p) => p.isHuman); if (g._goldAuto) g._goldAuto(me); else g.sea.autoGold(me); g.render(); }); await snap("gold auto");
    trace.push({ label: "gold auto left", left: await E(() => window.__colonistGame.sea.gold.length) });
  };

  // Seafarers coast edge: road or ship chooser
  const chooser = async () => {
    await startMode("sea"); await doSetup("chooser");
    await forceDice(8); await roll(); await myTurn("main");
    await giveHand({ wood: 8, brick: 8, sheep: 8, wheat: 8, ore: 8 }, { roadBuilding: 1 });
    const findBoth = () => E(() => { const g = window.__colonistGame, me = g.currentPlayer, S = g.api.spots(me.id); return [...S.road].find((e) => S.ship.has(e)) ?? null; });
    const open = async (e) => { await E(() => { const g = window.__colonistGame; g.pendingAction = null; g.confirmBuild = null; g.render(); }); await tap(await edgePt(e), 500); return E(() => [...document.querySelectorAll(".sea-chooser button span")].map((x) => x.textContent).join("|")); };
    for (const [label, pick] of [["ship", "Ship"], ["road", "Road"]]) {
      const e = await findBoth();
      if (e == null) { trace.push({ label: `chooser ${label}: no coast edge` }); continue; }
      const opts = await open(e);
      trace.push({ label: `chooser ${label} options`, e, opts });
      const b = page.locator(".sea-chooser button", { hasText: pick }).first();
      if (await b.count()) { await b.tap(); await sleep(400); }
      if (await E(() => !!window.__colonistGame.confirmBuild)) { await tap(await edgePt(e), 700); }
      await snap(`chooser ${label} built`);
    }
    // Road Building: the free pieces ask road or ship on a coast edge as well
    await E(() => window.__colonistGame.handleHumanPlayDevCard("roadBuilding")); await snap("chooser Road Building open");
    const e2 = await findBoth();
    if (e2 != null) { trace.push({ label: "chooser free options", e: e2, opts: await open(e2) }); const b = page.locator(".sea-chooser button", { hasText: "Ship" }).first(); if (await b.count()) { await b.tap(); await sleep(500); } await snap("chooser free ship built"); }
  };

  // pass & play: one person asks another for a trade
  const hotseat = async () => {
    await E(() => window.__colonistGame.startNewGame({ mode: "classic", board: "island", map: "random", dice: "random", numBots: 1, humans: [true], botStyleMode: "all", allPreset: "intermediate", allStrategy: { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" } }));
    const ack = async () => { await E(() => { const g = window.__colonistGame; if (g.hotseat && g.hsCoverOn != null) g._hsAck(); }); await sleep(200); };
    for (let guard = 0; guard < 40; guard++) {
      await until(() => { const g = window.__colonistGame; return !g.setupPhase || (g.currentPlayer?.isHuman && g.setupAction && !g.onboardingHold); }, null, 60000);
      await ack();
      const done = await E(() => { const g = window.__colonistGame; if (!g.setupPhase) return true; const me = g.currentPlayer, sp = g.api.spots(me.id); if (g.setupAction === "settlement") g._applyPiece(me, { type: "settlement", id: [...sp.settlement][0] }, true); else if (g.setupAction === "road") g._applyPiece(me, { type: "road", id: [...sp.road][0] }, true); return false; });
      if (done) break; await sleep(500);
    }
    await until(() => !window.__colonistGame.setupPhase, null, 90000);
    const hsSnap = async (label) => { const s = await E(() => { const g = window.__colonistGame, R = ["wood", "brick", "sheep", "wheat", "ore"]; return { turn: g.turn, cur: g.currentPlayerIndex, phase: g.phase, h: g.players.map((p) => R.map((r) => p.resources[r]).join(",")).join("/"), pit: g.pendingIncomingTrade ? [g.pendingIncomingTrade.fromPlayer.id, g.pendingIncomingTrade.to.id, !!g.pendingIncomingTrade.ask].join(",") : null, note: g._hsNote?.html?.replace(/<[^>]*>/g, "") ?? null, offer: Object.values(g.tradeOffer || {}).join(""), log: g.logEntries.slice(-3).map((l) => l.text), btn: ["acceptTradeBtn", "rejectTradeBtn"].map((id) => { const e = g[id]; return e ? e.disabled + "" : "-"; }).join(",") }; }); trace.push({ label, ...s }); };
    // seat 0 rolls
    for (let guard = 0; guard < 400; guard++) { await ack(); if (await E(() => { const g = window.__colonistGame; return g.currentPlayer?.isHuman && g.phase === "pre_roll"; })) break; await sleep(100); }
    await forceDice(8); await E(() => window.__colonistGame.handleHumanRoll()); await until(() => window.__colonistGame.phase !== "pre_roll", null, 20000); await sleep(200);
    const hands = (a, b) => E(([a, b]) => { const g = window.__colonistGame, cur = g.currentPlayer, other = g.players.find((p) => p.isHuman && p !== cur); Object.assign(cur.resources, a); Object.assign(other.resources, b); g.render(); return [cur.id, other.id]; }, [a, b]);
    const ask = (give, want) => E(([give, want]) => { const g = window.__colonistGame, cur = g.currentPlayer, other = g.players.find((p) => p.isHuman && p !== cur); const z = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }); g.tradeOffer = { ...z(), ...give }; g.tradeRequest = { ...z(), ...want }; g._hsAsk(other); }, [give, want]);
    const answer = async (yes) => { await ack(); await until(() => !!window.__colonistGame.pendingIncomingTrade, null, 5000); await ack(); await sleep(150); await E((yes) => { const g = window.__colonistGame; (yes ? g.acceptTradeBtn : g.rejectTradeBtn).click(); }, yes); await sleep(300); };
    await hands({ wood: 4, ore: 0 }, { wood: 0, ore: 3 });
    await ask({ wood: 2 }, { ore: 1 }); await hsSnap("hs ask open"); await answer(true); await hsSnap("hs accepted");
    await ask({ wood: 1 }, { ore: 1 }); await hsSnap("hs ask 2 open"); await answer(false); await hsSnap("hs declined");
    // the partner cannot pay: the answer is no
    await hands({ wood: 4 }, { ore: 0 });
    await ask({ wood: 1 }, { ore: 2 }); await hsSnap("hs unpayable open"); await answer(true); await hsSnap("hs unpayable answered");
    // the offering person cannot pay: nothing is asked
    await hands({ wood: 0 }, { ore: 2 });
    await ask({ wood: 1 }, { ore: 1 }); await sleep(200); await hsSnap("hs offer unpayable");
    // a bot's counter-offer to the table: the human accepts (Classic, one human)
    await ack();
    const api = await E(() => window.__colonistGame._api?.log()?.actions.map((x) => x.a.type + (x.auto ? "*" : "")).join(",") ?? null);
    trace.push({ label: "hs done", n: 1 }); globalThis.__hsApi = api;
  };

  // Rush: the host's timeouts for the human (the 7's robber / discard clock, the dev-card hold)
  const rush7 = async () => {
    if (process.env.RANDLOG) await E(() => { window.__rl = []; const m = Math.random; Math.random = function () { window.__rl.push(new Error().stack.split("\n").slice(2, 7).map((l) => l.trim().replace(/^at /, "").replace(/ \(.*$/, "")).join("<")); return m(); }; });
    await startMode("rush"); await doSetup("rush7");
    await until(() => { const g = window.__colonistGame; return g.rush && !g.rush.paused && !g.setupPhase; }, null, 30000);
    await E(() => { const g = window.__colonistGame; g.rush.remainingMs = 1e9; g.rush.paused = true; g._rushBotTick = () => {}; g._scheduleBotTick = () => {}; let a = 777; const m = Math.random; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }); // the bots' timers (their pauses draw Math.random by the wall clock) stay still: the run is then the same on every tree
    await sleep(300);
    const R = (f, a) => E(f, a);
    const rs = async (label) => { const s = await E(() => { const g = window.__colonistGame, Rr = ["wood", "brick", "sheep", "wheat", "ore"]; return { rob: g.robberHexId, pa: g.pendingAction || null, vo: (g.robberVictimOptions || []).join(","), cb: g.confirmBuild?.type ?? null, free: g.freeRoadsRemaining, dp: !!g.devPick, played: g.devPlayed?.type ?? null, disc: !!g.pendingDiscard, seven: g.rush?.seven ? g.rush.seven.stage : null, hands: g.players.map((p) => Rr.map((r) => p.resources[r]).join(",")).join("/"), dev: g.players.map((p) => Object.values(p.devCards).join("") + "/" + Object.values(p.newDevCards).join("")).join(" "), log: g.logEntries.slice(-3).map((l) => l.text), btn: ["buildRoadBtn", "buyDevBtn"].map((id) => { const e = document.getElementById(id); return e ? e.disabled + "" : "-"; }).join(",") }; }); trace.push({ label, ...s }); };
    const sevenAs = (hand) => E((hand) => { const g = window.__colonistGame, me = g._me(); Object.assign(me.resources, { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, hand); g.rush.paused = false; g.rush.robberOrder = [me.id]; g.rush.robberIdx = 0; const r0 = g.rollDice; g.rollDice = function () { g.rollDice = r0; g.lastDiceTotal = 7; return { total: 7, d1: 3, d2: 4 }; }; g._rushRoll(); }, hand);
    const victimHex = (n) => E((n) => { const g = window.__colonistGame, me = g._me(); const L = g._legalRobberHexes(me).map((h) => h.id).filter((id) => id !== g.robberHexId); return L.find((id) => g._stealVictims(id, me).length >= n) ?? null; }, n);
    // 1. the clock runs out with no tile chosen: the robber is placed for you
    await sevenAs({ wood: 2 }); await sleep(300); await rs("rush7 robber open");
    await E(() => window.__colonistGame._rushSevenTimeout()); await sleep(300); await rs("rush7 robber auto");
    if (process.env.RANDLOG) console.log("RL", mode, JSON.stringify(await E(() => window.__rl)));
    await E(() => { const g = window.__colonistGame; if (g.rush.seven) g._rushEndSeven(); g.rush.paused = true; });
    // 2. a tile is chosen (not confirmed): the timeout finishes that move
    const h1 = await victimHex(1);
    await sevenAs({ wood: 2 }); await sleep(300);
    await E((h) => { const g = window.__colonistGame; g.confirmBuild = { type: "robber", id: h, victim: null }; g.render(); }, h1); await rs("rush7 tile chosen");
    await E(() => window.__colonistGame._rushSevenTimeout()); await sleep(300); await rs("rush7 tile chosen auto");
    await E(() => { const g = window.__colonistGame; if (g.rush.seven) g._rushEndSeven(); g.rush.paused = true; });
    // 3. a tile with several victims: the first victim is robbed when the time is up
    const h2 = await victimHex(2);
    await sevenAs({ wood: 2 }); await sleep(300);
    if (h2 != null) { await E((h) => { const g = window.__colonistGame; g._commitRobber(g._me(), h, null); }, h2); await rs("rush7 victims offered"); }
    await E(() => window.__colonistGame._rushSevenTimeout()); await sleep(300); await rs("rush7 victim auto");
    await E(() => { const g = window.__colonistGame; if (g.rush.seven) g._rushEndSeven(); g.rush.paused = true; });
    // 4. a discard that is not made in time
    await sevenAs({ wood: 6, brick: 5, sheep: 4, wheat: 4, ore: 4 }); await sleep(300); await rs("rush7 discard open");
    await E(() => window.__colonistGame._rushSevenTimeout()); await sleep(400); await rs("rush7 discard auto");
    await E(() => window.__colonistGame._rushSevenTimeout()); await sleep(300); await rs("rush7 after discard, robber auto");
    await E(() => { const g = window.__colonistGame; g._rushEndSeven?.(); g.rush.paused = true; });
    // 5. the dev-card hold: Road Building left open, a Knight not yet used, Year of Plenty open
    await E(() => { const g = window.__colonistGame; g.rush.paused = false; g.rush.seven = null; g.phase = "main"; const me = g._me(); Object.assign(me.resources, { wood: 4, brick: 4, sheep: 2, wheat: 2, ore: 2 }); Object.assign(me.devCards, { roadBuilding: 1, knight: 1, yearOfPlenty: 1 }); me.rushDevPlayed = false; g.render(); });
    await E(() => window.__colonistGame.handleHumanPlayDevCard("roadBuilding")); await rs("rush7 Road Building open");
    if (process.env.DEBUG) console.log("  rb", JSON.stringify(await E(() => { const g = window.__colonistGame, me = g._me(); return { pr: g.api.prompts(), l: g.api.isLegal({ actor: me.id, type: "skipFree" }), me: me.id, pa: g.pendingAction, f: g.freeRoadsRemaining, ch: g._rushChoiceOpen() }; })));
    await E(() => { const g = window.__colonistGame; g.rush.remainingMs = 1e9; g._rushChoiceExpire(); }); await sleep(300); await rs("rush7 Road Building expired");
    await E(() => { const g = window.__colonistGame; g._me().rushDevPlayed = false; g.render(); });
    await E(() => window.__colonistGame.handleHumanPlayDevCard("knight")); await rs("rush7 Knight open");
    await E(() => window.__colonistGame._rushChoiceExpire()); await sleep(300); await rs("rush7 Knight expired");
    await E(() => { const g = window.__colonistGame; g._me().rushDevPlayed = false; g.render(); });
    await E(() => window.__colonistGame.handleHumanPlayDevCard("yearOfPlenty")); await rs("rush7 Year of Plenty open");
    await E(() => window.__colonistGame._rushChoiceExpire()); await sleep(300); await rs("rush7 Year of Plenty expired");
    // Road Building with one road placed: the rest is let go (the human's skipFree, made by the host)
    await E(() => { const g = window.__colonistGame, me = g._me(); me.rushDevPlayed = false; me.devCards.roadBuilding = 1; g.render(); });
    await E(() => window.__colonistGame.handleHumanPlayDevCard("roadBuilding"));
    await E(() => { const g = window.__colonistGame, me = g._me(); const e = [...g.api.spots(me.id, { free: true }).road][0]; if (e != null) g._applyPiece(me, { type: "road", id: e }, false); }); await rs("rush7 Road Building one road");
    await E(() => window.__colonistGame._rushChoiceExpire()); await sleep(300); await rs("rush7 Road Building rest let go");
    // a Knight whose robber has moved but whose victim is not chosen yet: the hold runs out
    await E(() => { const g = window.__colonistGame; g._me().rushDevPlayed = false; g.render(); });
    const h3 = await victimHex(2);
    if (h3 != null) {
      await E(() => window.__colonistGame.handleHumanPlayDevCard("knight"));
      await E((h) => { const g = window.__colonistGame; g._commitRobber(g._me(), h, null); }, h3); await rs("rush7 Knight victims offered");
      await E(() => window.__colonistGame._rushChoiceExpire()); await sleep(300); await rs("rush7 Knight victim auto");
    }
  };

  await ({ classic, rush, sea, gold, hotseat, rush7, chooser, buttons }[mode])();
  const apiLog = await E(() => window.__colonistGame._api?.log()?.actions.map((x) => x.a.type + (x.auto ? "*" : "")) ?? null);
  if (SH) await page.screenshot({ path: `${SH}/intent197-${mode}-${port}.png` });
  await ctx.close();
  return { trace, errors, apiLog };
}

(async () => {
  const s1 = await serve(ROOT, PORT); const s2 = BASE ? await serve(BASE, PORT + 1) : null;
  const b = await chromium.launch();
  const runs = [["classic", 4242, { width: 360, height: 780 }], ["classic", 99, { width: 412, height: 923 }], ["rush", 7, { width: 360, height: 780 }], ["sea", 21, { width: 360, height: 780 }], ["sea", 5, { width: 412, height: 923 }],
    ["buttons", 31, { width: 360, height: 780 }], ["buttons", 32, { width: 412, height: 923 }], ["gold", 21, { width: 360, height: 780 }], ["gold", 5, { width: 412, height: 923 }], ["chooser", 21, { width: 360, height: 780 }], ["chooser", 5, { width: 412, height: 923 }],
    ["hotseat", 11, { width: 360, height: 780 }], ["hotseat", 12, { width: 412, height: 923 }], ["rush7", 7, { width: 360, height: 780 }], ["rush7", 8, { width: 412, height: 923 }]].filter(([m]) => !ONLY || ONLY === m);
  for (const [mode, seed, viewport] of runs) {
    const tag = `${mode} ${viewport.width}x${viewport.height} seed ${seed}`;
    const mine = await session(b, PORT, seed, viewport, mode);
    if (process.env.SHOW) mine.trace.filter((t) => new RegExp(process.env.SHOW).test(t.label)).forEach((t) => console.log("     trace", JSON.stringify(t).slice(0, 500)));
    check(mine.errors.length === 0, `${tag}: no page errors`, mine.errors.slice(0, 2).join(" | "));
    check(mine.trace.length > (mode === "classic" ? 20 : 3), `${tag}: the script ran (${mine.trace.length} snapshots)`);
    if (mine.apiLog) {
      const types = [...new Set(mine.apiLog)];
      console.log(`     api log: ${mine.apiLog.length} actions: ${types.join(", ")}`);
      const want = { gold: ["pickGold*"], hotseat: ["offerTrade", "respondTrade"], rush7: ["moveRobber*", "steal*", "discard*", "skipFree*"], chooser: ["build"] }[mode];
      for (const w of want || []) check(types.includes(w), `${tag}: the API log holds ${w}`);
    }
    if (BASE) {
      const ref = await session(b, PORT + 1, seed, viewport, mode);
      check(ref.errors.length === 0, `${tag}: main has no page errors`);
      const n = Math.max(ref.trace.length, mine.trace.length);
      let bad = 0;
      for (let i = 0; i < n; i++) {
        const A = JSON.stringify(ref.trace[i]), B = JSON.stringify(mine.trace[i]);
        if (A !== B) { bad++; if (bad <= 3) console.log(`     DIFF at step ${i} (${ref.trace[i]?.label} | ${mine.trace[i]?.label})\n       main: ${A}\n       new : ${B}`); }
      }
      check(bad === 0, `${tag}: all ${n} snapshots equal to main`, bad ? `${bad} differ` : "");
    }
  }
  await b.close(); s1.close(); s2?.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
