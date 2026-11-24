// One moment for bots and people to score and to win (v1.97 -> aligned). Node only, no browser:  node tests/align198.js
// A player wins the moment they reach the target on their own turn: right after the Knight that gives Largest Army (before the robber moves), right
// after the purchase of the last Victory Point card, right after the free road of Road Building that gives Longest Road (before the second road).
// The bots used to count a Knight after the robbery, a bought card and the two free roads of Road Building only when their main phase closed.
// Each scenario is played for a person (the tap UI's own door, g.api), for a bot of the old driver (maybePlayBestDevCard / the build functions),
// and for a seat the engine decides (the bot host's way, with and without legacyBotOrder), and the outcomes must be the same. The same positions one
// point short must not win, but must count the award / card at once.
let fails = 0;
const check = (ok, msg, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}${extra !== "" ? "  (" + extra + ")" : ""}`); if (!ok) fails++; };

(async () => {
  const lib = await import("./golden/lib.mjs");
  const API = await import("../src/api/engine.js");
  const BOTS = await import("../src/bots/index.js");
  const { g, H } = lib;
  const RES = ["wood", "brick", "sheep", "wheat", "ore"];
  const SEED = 5;

  /** A fresh seeded game, after a few turns, with seat 0 to move in its main phase and nothing on the table to move the awards. */
  function fresh() {
    const strategies = [0, 1, 2, 3].map(() => ({ ...H.AI_PRESETS.expert }));
    g._labSettings = () => API.settingsFor(g, { seats: 4, seed: SEED });
    g._labSimStart(strategies, { players: 4, map: "random", seed: SEED });
    for (let i = 0; i < 4; i++) g._labSimStep(1);
    g.players.forEach((p) => { RES.forEach((r) => { p.resources[r] = 0; }); p.knightsPlayed = 0; p.devCards = { knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 }; p.newDevCards = { ...p.devCards }; p.devVictoryPoints = 0; p.isHuman = false; });
    g.currentPlayerIndex = 0; g.phase = "main"; g.lastRoll = 8; g.diceResult = null; g.currentTurnPlayedDevCard = false; g.pendingAction = null; g.freeRoadsRemaining = 0;
    g.largestArmyHolder = null; g.longestRoadHolder = null; g.winner = null; g.settings.winPoints = 10; g.autoplayInterval = null;
    g.devDeck = ["knight", "knight", "victoryPoint"];
    g.recomputeScores();
    return g.players[0];
  }
  /** Watch the events that say when something was counted. */
  function watch() {
    const seq = [], e0 = g.emit;
    g.emit = function (e, ...r) { if (e && ["award", "won", "devPlayed", "devBought", "robberMoved", "stole"].includes(e.type)) seq.push(e.type === "award" ? `award:${e.award}` : e.type === "built" ? "built" : e.type); if (e && e.type === "built" && e.how === "free") seq.push("free"); return e0.call(this, e, ...r); };
    return { seq, stop() { g.emit = e0; } };
  }
  const outcome = (p, w, extra = {}) => ({ won: g.winner ? g.winner.id : null, phase: g.phase, vp: p.victoryPoints, army: g.largestArmyHolder, road: g.longestRoadHolder, awards: w.seq.filter((s) => s.startsWith("award") || s === "won").join(","), ...extra });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const DRIVERS = ["person", "bot-driver", "bot-engine-legacy", "engine-api"];
  /** run `act(driver, p)` for each driver on its own fresh copy of `setup`; returns { driver: outcome } */
  function allDrivers(setup, act, read) {
    const out = {};
    for (const d of DRIVERS) {
      const p = fresh();
      const ctx = setup(p);
      p.isHuman = d === "person";
      let engine = null;
      if (d === "bot-engine-legacy" || d === "engine-api") { engine = BOTS.createEngine(g, { meta: { host: true } }); engine.legacyBotOrder = d === "bot-engine-legacy"; engine.takeControl([p.id]); }
      const w = watch();
      try { act(d, p, ctx, engine); out[d] = read(p, w, ctx); } finally { w.stop(); if (engine) engine.release(); p.isHuman = false; }
    }
    return out;
  }
  const agree = (name, res, expect) => {
    const ref = res.person;
    check(DRIVERS.every((d) => same(res[d], ref)), `${name}: person, bot driver and both engines agree`, DRIVERS.length && !DRIVERS.every((d) => same(res[d], ref)) ? JSON.stringify(res) : JSON.stringify(ref));
    if (expect) check(expect(ref), `${name}: expected outcome`, JSON.stringify(ref));
  };

  // ── 1 Knight giving Largest Army ──
  console.log("(1) Knight -> Largest Army");
  for (const short of [false, true]) {
    const res = allDrivers((p) => {
      p.knightsPlayed = 2; p.devCards.knight = 1;
      g.recomputeScores();
      const base = p.victoryPoints;
      g.settings.winPoints = base + (short ? 3 : 2);
      // the robber sits on one of the player's own tiles, so a bot plays the Knight
      const hex = g.geometry.hexes.find((h) => h.nodes.some((n) => g.geometry.nodes[n].owner === p.id) && h.resource !== "desert" && h.resource !== "sea");
      g.robberHexId = hex.id;
      return { base, robber: hex.id };
    }, (d, p, ctx, engine) => {
      if (d === "person") g.api.act({ actor: p.id, type: "playDev", card: "knight" });
      else if (d === "bot-driver") g.maybePlayBestDevCard(p);
      else engine.apply({ actor: p.id, type: "playDev", card: "knight" });
    }, (p, w, ctx) => outcome(p, w, { gain: p.victoryPoints - ctx.base, robberMoved: g.robberHexId !== ctx.robber || w.seq.includes("robberMoved") }));
    // a person (or an engine seat) is asked where the robber goes after a card that does not win; a bot has moved it: that is the only difference allowed
    const keys = (o) => { const c = { ...o }; delete c.robberMoved; return c; };
    const ref = keys(res.person);
    check(DRIVERS.every((d) => same(keys(res[d]), ref)), `Knight ${short ? "one point short" : "to the target"}: person, bot driver and both engines agree`, JSON.stringify(res));
    if (!short) check(ref.won === 0 && ref.phase === "game_over" && ref.gain === 2 && DRIVERS.every((d) => res[d].robberMoved === false), "Knight to the target wins at once, before the robber moves", JSON.stringify(res));
    else check(ref.won === null && ref.army === 0 && ref.gain === 2 && ref.phase === "main", "Knight one point short: no win, Largest Army counted at once", JSON.stringify(res));
  }

  // ── 2 the last Victory Point card ──
  console.log("(2) buying the last Victory Point card");
  for (const short of [false, true]) {
    const res = allDrivers((p) => {
      p.resources.sheep = 1; p.resources.wheat = 1; p.resources.ore = 1;
      g.recomputeScores();
      const base = p.victoryPoints;
      g.settings.winPoints = base + (short ? 2 : 1);
      return { base };
    }, (d, p, ctx, engine) => {
      if (d === "person") g.api.act({ actor: p.id, type: "buyDev" });
      else if (d === "bot-driver") { const s = p.strategy; p.strategy = { ...s, expansion: "simple", devCards: "reactive" }; for (const fn of g._getActionPriority(p)) if (fn()) break; p.strategy = s; }
      else engine.apply({ actor: p.id, type: "buyDev" });
    }, (p, w, ctx) => outcome(p, w, { gain: p.victoryPoints - ctx.base, devVP: p.devVictoryPoints, deck: g.devDeck.length }));
    agree(`VP card ${short ? "one point short" : "to the target"}`, res, (r) => (short ? r.won === null && r.gain === 1 && r.devVP === 1 : r.won === 0 && r.phase === "game_over" && r.gain === 1 && r.devVP === 1));
  }
  { // the planned bots buy through _aiTryGoal: the same
    const p = fresh(); p.resources.sheep = 1; p.resources.wheat = 1; p.resources.ore = 1; g.recomputeScores(); g.settings.winPoints = p.victoryPoints + 1;
    const ok = g._aiTryGoal(p, { type: "dev" });
    check(ok && g.winner === p && g.phase === "game_over", "VP card bought by a planned bot (_aiTryGoal) wins at once");
  }
  { // a bot's whole main phase stops at the win: it does not go on to buy a second card with the rest of its hand
    const p = fresh(); p.resources = { wood: 0, brick: 0, sheep: 2, wheat: 2, ore: 2 }; p.strategy = { ...p.strategy, expansion: "simple", devCards: "reactive", trading: "none" };
    g.recomputeScores(); g.settings.winPoints = p.victoryPoints + 1;
    const w = watch();
    try { g.executeAiMainPhase(p); } finally { w.stop(); }
    check(g.winner === p && g.devDeck.length === 2 && sum(p.resources) === 3, "bot main phase: the VP card wins, no second card is bought", `deck ${g.devDeck.length}, hand ${JSON.stringify(p.resources)}`);
  }
  function sum(h) { return RES.reduce((n, r) => n + h[r], 0); }
  { // a bot's whole main phase: a Knight to the target ends it before the robber, the trade and the builds
    const p = fresh(); p.knightsPlayed = 2; p.devCards.knight = 1; p.resources = { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 3 }; p.strategy = { ...p.strategy, devCards: "reactive", expansion: "simple" };
    g.recomputeScores(); g.settings.winPoints = p.victoryPoints + 2;
    const hex = g.geometry.hexes.find((h) => h.nodes.some((n) => g.geometry.nodes[n].owner === p.id) && h.resource !== "desert" && h.resource !== "sea"); g.robberHexId = hex.id;
    const hand = JSON.stringify(p.resources), w = watch();
    try { g.executeAiMainPhase(p); } finally { w.stop(); }
    check(g.winner === p && g.robberHexId === hex.id && JSON.stringify(p.resources) === hand && !w.seq.includes("robberMoved"), "bot main phase: the Knight wins at once (robber unmoved, hand unspent)", w.seq.join(","));
  }

  // ── 3 Road Building giving Longest Road ──
  console.log("(3) Road Building -> Longest Road");
  /** Strip the seat's roads and lay a chain of 4 from one settlement; returns the two free edges: the first makes 5 (Longest Road), the second is any other legal one. */
  function chain4(p) {
    const G = g.geometry;
    p.roads.forEach((e) => { G.edges[e].owner = null; }); p.roads.clear();
    const free = (e) => G.edges[e].owner == null;
    const other = (e, n) => (G.edges[e].nodes[0] === n ? G.edges[e].nodes[1] : G.edges[e].nodes[0]);
    const adj = (n) => G.nodes[n].edges || G.edges.filter((x) => x.nodes.includes(n)).map((x) => x.id);
    const owned = (n) => G.nodes[n].owner != null && G.nodes[n].owner !== p.id;
    for (const s of [...p.settlements]) {
      const dfs = (n, path, seen) => {
        if (path.length === 4) return path;
        for (const e of adj(n)) {
          const m = other(e, n);
          if (!free(e) || seen.has(m) || owned(m)) continue;
          const r = dfs(m, [...path, e], new Set([...seen, m])); if (r) return r;
        }
        return null;
      };
      const path = dfs(s, [], new Set([s]));
      if (!path) continue;
      path.forEach((e) => { G.edges[e].owner = p.id; p.roads.add(e); });
      g.recomputeScores();
      if (g.computeLongestRoadLength(p) !== 4) { path.forEach((e) => { G.edges[e].owner = null; p.roads.delete(e); }); continue; }
      const legal = G.edges.map((e) => e.id).filter((e) => g.canBuildRoad(p, e, { free: true }));
      const ext = legal.filter((e) => { G.edges[e].owner = p.id; p.roads.add(e); const L = g.computeLongestRoadLength(p); G.edges[e].owner = null; p.roads.delete(e); return L === 5; });
      if (!ext.length) { path.forEach((e) => { G.edges[e].owner = null; p.roads.delete(e); }); continue; }
      const second = legal.find((e) => e !== ext[0]);
      return { e1: ext[0], e2: second };
    }
    throw new Error("no chain");
  }
  for (const short of [false, true]) {
    const res = allDrivers((p) => {
      p.devCards.roadBuilding = 1;
      const ed = chain4(p);
      g.players.forEach((q) => { if (q !== p) q.longestRoadLength = 0; });
      g.recomputeScores();
      const base = p.victoryPoints;
      g.settings.winPoints = base + (short ? 3 : 2);
      return { ...ed, base, roads: p.roads.size };
    }, (d, p, ctx, engine) => {
      if (d === "person" || d.startsWith("bot-engine") || d === "engine-api") {
        const act = (a) => (d === "person" ? g.api.act({ actor: p.id, ...a }) : engine.apply({ actor: p.id, ...a }));
        act({ type: "playDev", card: "roadBuilding" });
        act({ type: "build", piece: "road", edge: ctx.e1 });
        if (!g.winner && g.freeRoadsRemaining > 0) act({ type: "build", piece: "road", edge: ctx.e2 });
      } else {
        const orig = g.chooseStrategicRoadEdge;
        g.chooseStrategicRoadEdge = () => (g.geometry.edges[ctx.e1].owner == null ? ctx.e1 : ctx.e2); // (what the bot would pick is not under test, when it is counted is)
        p.strategy = { ...p.strategy, devCards: "reactive" };
        try { g.maybePlayBestDevCard(p); } finally { g.chooseStrategicRoadEdge = orig; }
      }
    }, (p, w, ctx) => outcome(p, w, { gain: p.victoryPoints - ctx.base, placed: p.roads.size - ctx.roads, free: w.seq.filter((s) => s === "free").length }));
    agree(`Road Building ${short ? "one point short" : "to the target"}`, res, (r) => (short ? r.won === null && r.gain === 2 && r.placed === 2 && r.road === 0 : r.won === 0 && r.phase === "game_over" && r.gain === 2 && r.placed === 1 && r.road === 0));
  }

  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
