// Action API (architecture step 2) checks. Node only, no browser:  node tests/api201.js [--quick]
//   (a) legality agreement   every move the game's own bots make is in the engine's legal set (judged before the move), and every legal
//                            action sampled on a clone is accepted by the old methods with the effect the old code has; illegal ones are refused
//   (b) replay               a seeded game recorded as an action log (bot games observed, random games driven) replays on a fresh engine to the same state hash
//   (c) modes                classic, Rush, Seafarers and 5-6 players each exercise their action and prompt types
//   (d) redaction            view(seat) leaks no opponent hand / dev card: it does not change when the hidden cards are re-dealt
//   (e) performance          legalActions / isLegal / apply / clone / view numbers
// Boots the game exactly like tests/golden (same Proxy DOM, same seeds).
const QUICK = process.argv.includes("--quick");
let fails = 0;
const check = (ok, msg, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}${extra !== "" ? "  (" + extra + ")" : ""}`); if (!ok) fails++; };
const pad = (s, n) => String(s).padEnd(n);

(async () => {
  const lib = await import("./golden/lib.mjs");
  const { GAMES } = await import("./golden/games.mjs");
  const API = await import("../src/api/engine.js");
  const ACT = await import("../src/api/actions.js");
  const { g, H, vclock, mulberry32, SIM } = lib;
  const { createEngine, newGame, replay, settingsFor } = API;
  const RES = ["wood", "brick", "sheep", "wheat", "ore"];
  const sum = (h) => RES.reduce((n, r) => n + (h[r] || 0), 0);

  // ── drivers ──
  const metaOf = (spec) => ({ seats: spec.seats.length, mode: spec.mode || "classic", sea: !!spec.sea, map: spec.map || "random", dice: spec.dice || "random", winPoints: spec.winPoints || 10, seed: spec.seed });
  const apiSpec = (spec) => ({ seats: spec.seats.length, mode: spec.mode || "classic", sea: !!spec.sea, map: spec.map || "random", dice: spec.dice || "random", winPoints: spec.winPoints || 10, seed: spec.seed });
  /** Play one all-bot game of the golden kind with an observer on it. Returns { engine, stop result, hash, winner }. */
  function observedGame(spec, cb) {
    const e = createEngine(g, { meta: metaOf(spec) });
    const stop = e.observe(cb);
    const strategies = spec.seats.map((n) => ({ ...H.AI_PRESETS[n] }));
    let r = { done: false };
    try {
      if (spec.mode === "rush") {
        const simLater = g._later;
        delete g._later; vclock.install();
        try {
          Math.random = mulberry32(spec.seed >>> 0);
          g.settings = settingsFor(g, apiSpec(spec));
          g.onboardingHold = true; g.uiPaused = false; g.resetGame();
          g.players.forEach((p, i) => { p.isHuman = false; p.strategy = { ...strategies[i] }; p.agent = null; });
          g.onboardingHold = false; document.hidden = false;
          if (g.setupPhase) { g.setupAction = null; g.processSetupQueue(); }
          let guard = 0;
          while (!g.winner && guard++ < 400000 && vclock.now < (spec.maxVirtualMs || 1.2e6)) if (!vclock.step()) break;
          r = { winner: g.winner ? g.winner.id : null, turns: g.turn };
        } finally { vclock.uninstall(); g._later = simLater; g.uiPaused = true; }
      } else {
        g._labSettings = () => settingsFor(g, apiSpec(spec));
        g._labSimStart(strategies, { players: spec.seats.length, map: spec.map || "random", seed: spec.seed });
        while (!r.done && !(spec.stopTurn && g.turn >= spec.stopTurn)) r = g._labSimStep(1);
      }
    } finally { g.players.forEach((p) => { p.agent = null; }); }
    const entries = stop();
    return { e, entries, hash: e.stateHash(), winner: r.winner, turns: r.turns };
  }

  /** Re-deal everything seat `me` cannot see, conserving every public count (hand sizes, dev card counts, bank, deck size, public VP). */
  const DEVT = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
  function redeal(G, me, rnd) {
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const others = G.players.filter((p) => p.id !== me);
    const pool = []; others.forEach((p) => RES.forEach((r) => { for (let k = 0; k < p.resources[r]; k++) pool.push(r); }));
    shuffle(pool);
    others.forEach((p) => { const n = sum(p.resources); RES.forEach((r) => { p.resources[r] = 0; }); for (let k = 0; k < n; k++) p.resources[pool.pop()]++; });
    const dpool = G.devDeck.slice();
    const shape = others.map((p) => ({ p, dev: DEVT.reduce((n, t) => n + p.devCards[t], 0), nw: DEVT.reduce((n, t) => n + p.newDevCards[t], 0), vp: p.devVictoryPoints }));
    shape.forEach(({ p }) => { DEVT.forEach((t) => { for (let k = 0; k < p.devCards[t] + p.newDevCards[t]; k++) dpool.push(t); }); for (let k = 0; k < p.devVictoryPoints; k++) dpool.push("victoryPoint"); });
    shuffle(dpool);
    shape.forEach(({ p, dev, nw, vp }) => {
      DEVT.forEach((t) => { p.devCards[t] = 0; p.newDevCards[t] = 0; }); p.devVictoryPoints = 0;
      for (let k = 0; k < dev + nw + vp; k++) { const c = dpool.pop(); if (c === "victoryPoint") p.devVictoryPoints++; else if (k < dev) p.devCards[c]++; else p.newDevCards[c]++; }
      p.victoryPoints = p.publicVictoryPoints + p.devVictoryPoints;
    });
    G.devDeck = dpool;
  }

  // a small deterministic generator for the random driver
  const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
  const W = { build: 6, buyDev: 3, playDev: 5, tradeBank: 1.5, offerTrade: 1, respondTrade: 3, cancelOffer: 0.5, moveShip: 1.5, endTurn: 2, passSbp: 3, ready: 0.2 };
  /** Pick one legal action (concrete) for the first prompt that has any. Weighted by type; descriptors expanded. */
  function choose(e, rnd) {
    const ps = e.prompts();
    if (!ps.length) return null;
    const order = ps.slice().sort(() => rnd() - 0.5);
    for (const pr of order) {
      const acts = e.enumerate(pr.actor, { prompt: pr, max: 24 });
      if (!acts.length) continue;
      const w = acts.map((a) => (W[a.type] ?? 1) * (a.type === "respondTrade" && a.answer === "counter" ? 0.1 : 1) * (a.type === "build" && a.piece === "city" ? 2 : 1));
      let u = rnd() * w.reduce((x, y) => x + y, 0), i = 0;
      while (i < acts.length - 1 && u >= w[i]) { u -= w[i]; i++; }
      return acts[i];
    }
    return null;
  }
  /** Play random legal actions until the game ends or `max` actions; calls hook(e, action, i) before each apply. */
  function randomGame(spec, seed, max, hook) {
    const e = newGame(g, spec), rnd = lcg(seed), seen = { types: {}, prompts: {}, mode: e.mode() };
    let i = 0;
    for (; i < max && e.winner() == null; i++) {
      const ps = e.prompts();
      ps.forEach((p) => { seen.prompts[p.kind] = (seen.prompts[p.kind] || 0) + 1; });
      const a = choose(e, rnd);
      if (!a) break;
      if (hook && hook(e, a, i) === false) break;
      const r = e.apply(a);
      if (!r.ok) { check(false, `random game ${JSON.stringify(spec)}: apply refused ${JSON.stringify(a)}`, r.reason); break; }
      seen.types[a.type] = (seen.types[a.type] || 0) + 1;
    }
    seen.steps = i;
    return { e, seen };
  }

  // ═══ (a0) the facade changes nothing: golden games played with an engine attached and observing keep their hashes and Math.random call counts ═════
  console.log("\n(a0) engine attached, behaviour identical");
  {
    const fs = await import("node:fs");
    const gold = JSON.parse(fs.readFileSync(new URL("./golden/games.json", "file://" + __dirname + "/").pathname, "utf8"));
    for (const id of QUICK ? ["classic-expert", "sea-expert"] : ["classic-expert", "classic-intermediate", "sea-expert", "six-expert", "classic-rules8-deck"]) {
      const spec = GAMES.find((x) => x.id === id), want = gold[id];
      const e = createEngine(g, { meta: null });
      const stop = e.observe();
      const r = lib.playGame(spec);
      stop(); e.dispose();
      check(r.movesHash === want.movesHash && r.stateHash === want.stateHash && r.randomCalls === want.randomCalls, `${id}: move-log hash, state hash and Math.random call count equal the golden`, `${r.randomCalls} calls`);
    }
  }

  // ═══ (a) legality agreement ═══════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n(a) legality agreement");
  const heuristic = (s) => s.seats.every((n) => H.AI_PRESETS[n]);
  const botSpecs = GAMES.filter((s) => heuristic(s) && (!QUICK || ["classic-expert", "classic-2p", "sea-ladder", "six-ladder", "rush-expert"].includes(s.id)));
  const extra = QUICK ? [] : [
    { id: "classic-deck-8", seed: 61, seats: ["expert", "trader", "builder", "shark"], dice: "deck", winPoints: 8 },
    { id: "classic-balanced-3p", seed: 62, seats: ["intermediate", "expert", "shark"], dice: "balanced", map: "balanced" },
    { id: "sea-5p-like", seed: 63, seats: ["shark", "builder", "trader", "expert"], sea: true },
    { id: "six-deck", seed: 64, seats: ["expert", "expert", "intermediate", "shark", "builder", "trader"], dice: "deck" },
  ];
  const tally = {}, bad = [], coverage = {}; // per mode: action types seen
  let moves = 0;
  const recorded = []; // { spec, log, hash } for the replay check
  for (const spec of [...botSpecs, ...extra]) {
    const mode = spec.mode === "rush" ? "rush" : spec.sea ? "sea" : spec.seats.length >= 5 ? "six" : "classic";
    const t0 = performance.now();
    let n = 0;
    const out = observedGame(spec, (en) => {
      n++;
      tally[en.a.type] = (tally[en.a.type] || 0) + 1;
      (coverage[mode] ||= {})[en.a.type] = ((coverage[mode] ||= {})[en.a.type] || 0) + 1;
      if (en.ok && !en.legal.ok) bad.push(`${spec.id}: made but not legal  ${JSON.stringify(en.a)} under ${JSON.stringify(en.prompt)}: ${en.legal.reason}`);
      if (!en.ok && en.legal.ok) bad.push(`${spec.id}: legal but the old code refused  ${JSON.stringify(en.a)} under ${JSON.stringify(en.prompt)}`);
    });
    moves += n;
    if (spec.mode !== "rush") recorded.push({ spec, log: out.e.log(), hash: out.hash, winner: out.winner, vp: g.players.map((p) => p.victoryPoints) });
    console.log(`  ${pad(spec.id, 22)} ${pad(n + " moves", 11)} winner ${out.winner} turns ${out.turns}  ${Math.round(performance.now() - t0)} ms`);
    out.e.dispose();
  }
  check(bad.length === 0, `every bot move in ${botSpecs.length + extra.length} seeded games is legal and every legal-by-engine call was accepted`, `${moves} moves, ${bad.length} disagreements`);
  bad.slice(0, 15).forEach((b) => console.log("    " + b));
  console.log("  move types: " + Object.entries(tally).sort().map(([k, v]) => `${k} ${v}`).join(", "));

  // sample-apply on clones (random driven games, all modes) + illegal actions refused
  const SPECS = [
    { seats: 4, seed: 101 }, { seats: 3, seed: 102, dice: "deck" }, { seats: 4, seed: 103, sea: true }, { seats: 3, seed: 104, sea: true, map: "balanced" }, { seats: 5, seed: 105 }, { seats: 6, seed: 106, dice: "balanced" },
  ];
  let sampled = 0, sampleBad = 0, refusedOk = 0, refusedBad = 0, cloneLeak = 0;
  const effects = (c, a, pre) => { // what the old code must have done, read from the game object itself (not from the engine)
    const G = c.g, p = G.players[a.actor], A = {
      place: () => (a.piece === "road" ? p.roads.has(a.edge) : a.piece === "ship" ? p.ships.has(a.edge) : p.settlements.has(a.node)),
      build: () => (a.piece === "road" ? p.roads.has(a.edge) : a.piece === "ship" ? p.ships.has(a.edge) : a.piece === "settlement" ? p.settlements.has(a.node) : p.cities.has(a.node)),
      moveShip: () => p.ships.has(a.to) && !p.ships.has(a.from),
      buyDev: () => G.devDeck.length === pre.deck - 1,
      tradeBank: () => p.resources[a.get] === pre.hand[a.get] + 1 && p.resources[a.give] < pre.hand[a.give],
      playDev: () => p.devCards[a.card] === pre.dev[a.card] - 1,
      roll: () => G.lastRoll != null || G.phase !== "pre_roll",
      endTurn: () => G.currentPlayerIndex !== pre.cur || G.phase === "sbp" || !!G.winner,
      moveRobber: () => (G.sea && G.geometry.hexes[a.hex].resource === "sea" ? G.sea.pirateHexId === a.hex : G.robberHexId === a.hex),
      discard: () => sum(p.resources) === pre.total - sum(a.cards),
      steal: () => sum(p.resources) === pre.total + 1,
      pick: () => (a.resource ? true : sum(p.resources) === pre.total + a.resources.length),
      pickGold: () => sum(p.resources) === pre.total + a.resources.length,
      passSbp: () => true, skipFree: () => G.freeRoadsRemaining === 0, offerTrade: () => true, respondTrade: () => true, cancelOffer: () => true, ready: () => true,
    };
    return A[a.type] ? A[a.type]() : true;
  };
  for (const spec of SPECS) {
    const rndI = lcg(spec.seed + 9);
    randomGame(spec, spec.seed, QUICK ? 500 : 1500, (e, a, i) => {
      if (i % 9 !== 0) return true;
      const h0 = e.stateHash();
      const all = e.enumerate(a.actor, { max: 40 });
      const take = [a, ...all.sort(() => rndI() - 0.5).slice(0, 4)];
      for (const x of take) {
        const c = e.clone();
        const pl = c.g.players[x.actor];
        const pre = { deck: c.g.devDeck.length, hand: { ...pl.resources }, dev: { ...pl.devCards }, cur: c.g.currentPlayerIndex, total: sum(pl.resources) };
        const r = c.apply(x);
        sampled++;
        if (!r.ok || r.bug || !effects(c, x, pre)) { sampleBad++; if (sampleBad < 6) console.log("    clone sample failed", JSON.stringify(x), r.reason || "(effect missing)"); }
        c.dispose();
        if (e.stateHash() !== h0) { cloneLeak++; break; }
      }
      // illegal actions: a made-up build / trade / roll for a seat that may not act, shape-valid
      const holders = new Set(e.prompts().map((p) => p.actor));
      const idle = e.g.players.map((p) => p.id).find((id) => !holders.has(id)); // a seat that has no prompt at all
      const bogus = [{ actor: a.actor, type: "build", piece: "road", edge: 99999 }, { actor: a.actor, type: "tradeBank", give: "wood", get: "wood" }, { actor: a.actor, type: "buyDev", extra: 1 },
        { actor: a.actor, type: "discard", cards: { wood: 99 } }, { actor: a.actor, type: "moveRobber", hex: -1 },
        ...(idle != null ? [{ actor: idle, type: "endTurn" }, { actor: idle, type: "roll" }, { actor: idle, type: "buyDev" }] : [])];
      const legalNow = new Set(e.legalActions(a.actor).map(ACT.actionKey));
      for (const b of bogus) {
        const r = e.apply(b);
        if (!r.ok && e.stateHash() === h0) refusedOk++;
        else { refusedBad++; if (refusedBad < 4) console.log("    illegal action accepted or state changed", JSON.stringify(b)); }
      }
      void legalNow;
      return true;
    });
  }
  check(sampleBad === 0, "sample-apply: legal actions are accepted by the old methods with their effect", `${sampled} samples`);
  check(cloneLeak === 0, "clone isolation: applying on a clone leaves the original unchanged");
  check(refusedBad === 0, "illegal / malformed actions are refused and change nothing", `${refusedOk} refused`);

  // legalActions agrees with the pieces of the old rules directly (all nodes / edges), at sampled positions
  let propBad = 0, propN = 0;
  for (const spec of SPECS.slice(0, 4)) randomGame(spec, spec.seed + 5, 700, (e, a, i) => {
    if (i % 25 !== 0) return true;
    const pr = e.promptFor(a.actor);
    if (!pr || pr.kind !== "main") return true;
    const G = e.g, p = G.players[a.actor], L = new Set(e.legalActions(a.actor).map(ACT.actionKey));
    const key = (o) => ACT.actionKey({ actor: a.actor, ...o });
    G.geometry.edges.forEach((ed) => { propN++; if (G.canBuildRoad(p, ed.id, { free: false }) !== L.has(key({ type: "build", piece: "road", edge: ed.id }))) propBad++; });
    G.geometry.nodes.forEach((nd) => { propN += 2; if (G.canBuildSettlement(p, nd.id, false) !== L.has(key({ type: "build", piece: "settlement", node: nd.id }))) propBad++; if (G.canBuildCity(p, nd.id, false) !== L.has(key({ type: "build", piece: "city", node: nd.id }))) propBad++; });
    RES.forEach((t) => { propN++; if (G.canPlayDevelopmentCard(p, t === "wood" ? "knight" : "monopoly") !== L.has(key({ type: "playDev", card: t === "wood" ? "knight" : "monopoly" }))) propBad++; });
    return true;
  });
  check(propBad === 0, "legalActions equals the old canBuild* / canPlayDevelopmentCard over every node and edge", `${propN} comparisons`);

  // ═══ (b) replay ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n(b) replay");
  let replayed = 0, replayBad = 0, early = 0;
  for (const rec of recorded) {
    let h2 = null, err = null, info = null, same = false;
    try {
      const e2 = replay(g, rec.log); h2 = e2.stateHash(); info = e2.replayInfo;
      // a bot may act on after its winning move (it checks for the win at the end of its phase); then the engine's game ended at the winning move
      same = h2 === rec.hash || (info.skipped > 0 && e2.winner() === rec.winner && e2.g.players.every((p, i) => (i === rec.winner ? p.victoryPoints >= e2.g.winPoints && rec.vp[i] >= e2.g.winPoints : p.victoryPoints === rec.vp[i])));
      if (h2 !== rec.hash && same) early++;
      e2.dispose();
    } catch (e) { err = e.message; }
    replayed++;
    if (!same) replayBad++;
    console.log(`  ${pad(rec.spec.id, 22)} ${pad(rec.log.actions.length + " actions", 13)} ${same ? (h2 === rec.hash ? "same state hash " + h2 : `ends at the winning move (${info.skipped} trailing bot action${info.skipped > 1 ? "s" : ""} skipped), same winner and points`) : "DIFFERENT " + (err || rec.hash + " vs " + h2 + ` (skipped ${info && info.skipped}, winner ${rec.winner}, vp ${rec.vp})`)}`);
  }
  check(replayBad === 0, `${replayed} observed bot games replay to the same final state`, `${replayed - early} identical hash, ${early} end at the winning move`);
  let rr = 0, rrBad = 0;
  for (const spec of SPECS) {
    const { e } = randomGame(spec, spec.seed + 1, QUICK ? 800 : 2500);
    const h1 = e.stateHash(), log = e.log();
    let h2 = null;
    try { const e2 = replay(g, JSON.parse(JSON.stringify(log))); h2 = e2.stateHash(); e2.dispose(); } catch (err) { console.log("    " + err.message); }
    rr++; if (h1 !== h2) rrBad++;
    console.log(`  random ${pad(JSON.stringify(spec), 44)} ${pad(log.actions.length + " actions", 13)} ${h1 === h2 ? "same state hash" : "DIFFERENT"}`);
    e.dispose();
  }
  check(rrBad === 0, `${rr} random driven games (all modes) replay to an identical state hash`);

  // injectable chance: forced dice and a forced steal card come out as asked, and a log carries them
  {
    const e = newGame(g, { seats: 3, seed: 140 }), rnd = lcg(3);
    let guard = 0; while (e.g.setupPhase && guard++ < 60) e.apply(choose(e, rnd));
    e.setChance({ dice: () => [3, 4] });
    const cur = e.prompts()[0].actor;
    const r = e.apply({ actor: cur, type: "roll" });
    check(r.ok && e.g.lastRoll === 7 && r.events.some((x) => x.type === "roll" && x.total === 7), "ChanceSource.dice forces the roll (a 7)", `prompts after: ${r.prompts.map((p) => p.kind).join(",")}`);
    e.setChance(null);
    const e2 = newGame(g, { seats: 3, seed: 140 }); let n2 = 0; const rnd2 = lcg(3); while (e2.g.setupPhase && n2++ < 60) e2.apply(choose(e2, rnd2));
    const r2 = e2.apply({ actor: e2.prompts()[0].actor, type: "roll", forced: [6, 1] });
    check(r2.ok && e2.g.lastRoll === 7, "roll carries forced dice (replay / what-if)");
    e.dispose(); e2.dispose();
    const calls0 = lib.randomCalls();
    const e3 = newGame(g, { seats: 3, seed: 141 }); let n3 = 0; const rnd3 = lcg(4); while (e3.g.setupPhase && n3++ < 60) e3.apply(choose(e3, rnd3));
    const c1 = lib.randomCalls(); e3.apply({ actor: e3.prompts()[0].actor, type: "roll" }); const c2 = lib.randomCalls();
    check(c2 - c1 === 2 || c2 - c1 === 0, "with no ChanceSource a roll draws from the game's own Math.random exactly as before", `${c2 - c1} calls`);
    void calls0; e3.dispose();
  }
  {
    const { e } = randomGame(SPECS[0], 77, 600);
    const v0 = JSON.stringify(e.view(0)), o0 = JSON.stringify(e.view("omniscient"));
    const c = e.clone(); c._enter(); redeal(c.g, 0, lcg(1)); const o1 = JSON.stringify(c.view("omniscient")), v1 = JSON.stringify(c.view(0));
    check(v0 === v1 && o0 !== o1, "negative control: the re-deal changes the omniscient view but not seat 0's view");
    c.dispose(); e.dispose();
  }

  // ═══ (c) modes ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n(c) modes");
  const seenBy = { classic: {}, sea: {}, six: {}, rush: {} }, promptsBy = { classic: {}, sea: {}, six: {}, rush: {} };
  for (const [m, c] of Object.entries(coverage)) Object.assign(seenBy[m], c);
  const covSpecs = [...SPECS, { seats: 4, seed: 111 }, { seats: 4, seed: 112, sea: true }, { seats: 6, seed: 113 }, { seats: 3, seed: 114 }];
  for (const spec of covSpecs) {
    const { seen } = randomGame(spec, spec.seed + 3, QUICK ? 800 : 2500);
    const m = spec.sea ? "sea" : spec.seats >= 5 ? "six" : "classic";
    for (const [t, n] of Object.entries(seen.types)) seenBy[m][t] = (seenBy[m][t] || 0) + n;
    for (const [t, n] of Object.entries(seen.prompts)) promptsBy[m][t] = (promptsBy[m][t] || 0) + n;
  }
  // Rush: the seat actions over the engine (clock events are not actions: documented), after a set-up played through the engine
  {
    const e = newGame(g, { seats: 4, mode: "rush", seed: 120 }), rnd = lcg(5);
    for (let i = 0; i < 80 && e.g.setupPhase; i++) e.apply(choose(e, rnd));
    check(!e.g.setupPhase && !!e.g.rush, "Rush: set-up is played through the engine and the game enters Rush");
    const p0 = e.g.players[0]; RES.forEach((r) => { p0.resources[r] += 4; });
    const ps = e.prompts();
    promptsBy.rush.rushAny = ps.filter((p) => p.kind === "rushAny").length;
    const acts = e.legalActions(0);
    for (const t of ["build", "buyDev", "tradeBank", "ready"]) { const a = acts.find((x) => x.type === t); if (a) { const r = e.apply(a); seenBy.rush[t] = (seenBy.rush[t] || 0) + (r.ok ? 1 : 0); } }
    seenBy.rush.ready = seenBy.rush.ready || 0;
    let thrown = false; try { e.clone(); } catch (err) { thrown = /Rush/.test(err.message); }
    check(thrown, "Rush: clone() refuses (the clock is timers; documented)");
    e.dispose();
  }
  const need = { classic: ["place", "roll", "build", "endTurn", "buyDev", "playDev", "pick", "tradeBank", "offerTrade", "respondTrade", "discard", "moveRobber", "steal"],
    sea: ["place", "roll", "build", "endTurn", "buyDev", "playDev", "moveShip", "tradeBank", "moveRobber", "discard"], six: ["place", "roll", "build", "endTurn", "passSbp", "buyDev", "discard", "moveRobber"],
    rush: ["build", "ready", "tradeBank"] };
  for (const [m, list] of Object.entries(need)) {
    const missing = list.filter((t) => !seenBy[m][t]);
    check(!missing.length, `${m}: action types exercised`, `${Object.keys(seenBy[m]).sort().join(" ")}${missing.length ? "  MISSING " + missing.join(" ") : ""}`);
  }
  const allPromptKinds = new Set(Object.values(promptsBy).flatMap((o) => Object.keys(o)));
  console.log("  prompt kinds seen: " + [...allPromptKinds].sort().join(", "));
  check(["setupSettlement", "setupRoad", "preRoll", "main", "discard", "moveRobber", "sbp", "rushAny"].every((k) => allPromptKinds.has(k)), "core prompt kinds appear (setup x2, preRoll, main, discard, moveRobber, sbp, rushAny)");
  const shapeBad = ACT.SEAT_ACTION_TYPES.filter((t) => t !== "pick" && ACT.ACTIONS[t].req && Object.keys(ACT.ACTIONS[t].req).length === 0 && !ACT.validateShape({ actor: 0, type: t }, { rush: t === "ready", sea: false, big: t === "passSbp" }).ok);
  check(shapeBad.length === 0, "catalogue: every parameterless action type validates in its mode", shapeBad.join(","));
  check(!ACT.validateShape({ actor: 0, type: "moveShip", from: 1, to: 2 }, { rush: false, sea: false, big: false }).ok && ACT.validateShape({ actor: 0, type: "moveShip", from: 1, to: 2 }, { rush: false, sea: true, big: false }).ok
    && !ACT.validateShape({ actor: 0, type: "passSbp" }, { rush: false, sea: false, big: false }).ok && !ACT.validateShape({ actor: 0, type: "ready" }, { rush: false, sea: false, big: false }).ok
    && !ACT.validateShape({ actor: 0, type: "tick", dtMs: 5 }, { rush: true }).ok, "catalogue: mode gating (ships Seafarers-only, passSbp 5-6 only, ready Rush-only, tick host-only)");

  // ═══ (d) redaction ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n(d) redaction");
  let dChecks = 0, dBad = 0, structBad = 0;
  for (const spec of [SPECS[0], SPECS[2], SPECS[4]]) {
    randomGame(spec, spec.seed + 7, QUICK ? 600 : 1200, (e, a, i) => {
      if (i < 150 || i % 130 !== 0) return true;
      for (let v = 0; v < e.g.players.length; v++) {
        const s0 = JSON.stringify(e.view(v));
        const view = JSON.parse(s0);
        view.seats.forEach((st, k) => { if (k !== v && ("hand" in st || "dev" in st || "newDev" in st || "vpCards" in st || "hiddenVp" in st)) structBad++; });
        if (/"devDeck"|"resources"|"devCards"/.test(s0)) structBad++;
        const c = e.clone(); c._enter();
        redeal(c.g, v, lcg(900 + i + v)); // re-deal everything the seat cannot see
        const s1 = JSON.stringify(c.view(v));
        dChecks++;
        if (s0 !== s1) {
          dBad++;
          if (dBad < 3) { const d = []; const walk = (x, y, path) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === "object" && typeof y === "object") for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], path + "." + k); else d.push(`${path}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`); }; walk(JSON.parse(s0), JSON.parse(s1), ""); console.log("    view changed for seat", v, d.slice(0, 4).join(" | ")); }
        }
        c.dispose();
        // a spectator and the omniscient view bracket it
        const sp = e.view("spectator"); if (sp.seats.some((st) => "hand" in st)) structBad++;
        if (!e.view("omniscient").seats.every((st) => "hand" in st)) structBad++;
      }
      return true;
    });
  }
  check(structBad === 0, "view(seat) carries no opponent hand, dev card, hidden VP or deck order (structure)");
  check(dChecks > 0 && dBad === 0, "view(seat) is unchanged when every hidden card (opponent hands, dev cards, deck order) is re-dealt", `${dChecks} positions x seats`);
  {
    const { e } = randomGame({ seats: 4, seed: 130 }, 77, 900);
    const evs = e.eventsSince(0, "omniscient"), rawSteals = evs.filter((x) => x.type === "stolen" || (x.type === "chance" && x.node === "steal"));
    const third = rawSteals.length ? rawSteals.every((x) => { const t = e.redact([x], 99)[0]; return t.res == null && t.outcome == null; }) : true;
    const buys = evs.filter((x) => x.type === "devBought");
    const buyOk = buys.every((x) => e.redact([x], (x.actor + 1) % 4)[0].card == null && e.redact([x], x.actor)[0].card === x.card);
    check(third && buyOk, "events: a steal's card and a bought dev card are hidden from third parties", `${rawSteals.length} steal facts, ${buys.length} purchases`);
  }

  // ═══ (e) performance ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n(e) performance");
  const perf = {};
  const timeIt = (name, n, fn) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); const dt = performance.now() - t0; perf[name] = (dt / n) * 1000; };
  {
    const states = [];
    for (const spec of [SPECS[0], SPECS[2], SPECS[4]]) randomGame(spec, spec.seed + 11, 900, (e, a, i) => { if (i > 300 && i % 40 === 0 && e.promptFor(a.actor)?.kind === "main") states.push([e, a.actor]); return true; });
    const e = states.length ? states[states.length - 1][0] : null;
    void e;
    // positions are re-created per measurement (engines are values; the latest one holds the game object)
    const { e: e1 } = randomGame(SPECS[0], 5151, 600, (en, a, i) => i < 599 || (en.promptFor(a.actor)?.kind !== "main" ? true : false));
    const seat = e1.prompts()[0].actor, nL = e1.legalActions(seat).length;
    timeIt("legalActions", 3000, () => e1.legalActions(seat));
    const act = e1.legalActions(seat).find((a) => a.type === "build") || e1.legalActions(seat)[0];
    timeIt("isLegal", 5000, () => e1.isLegal(act));
    timeIt("view", 1000, () => e1.view(seat));
    timeIt("stateHash", 1000, () => e1.stateHash());
    timeIt("clone", 3000, () => { const c = e1.clone(); c.dispose(); });
    timeIt("clone+apply+discard", 1500, () => { const c = e1.clone(); c.apply(e1.legalActions(seat).find((a) => a.type === "endTurn") || act); c.dispose(); });
    console.log(`  position: seat ${seat}, ${nL} legal actions/descriptors, turn ${e1.g.turn}`);
    e1.dispose();
  }
  // apply throughput: whole random games
  let applied = 0, t0 = performance.now(), gamesN = 0;
  for (const spec of SPECS.slice(0, QUICK ? 2 : 4)) { const { seen, e } = randomGame(spec, spec.seed + 21, 3000); applied += seen.steps; gamesN++; e.dispose(); }
  const dtApply = performance.now() - t0;
  // the same positions played by the old bots, for scale
  t0 = performance.now(); let botMoves = 0;
  for (const spec of GAMES.filter((s) => ["classic-expert", "classic-intermediate", "six-expert", "sea-expert"].includes(s.id))) { const o = observedGame(spec, () => { botMoves++; }); o.e.dispose(); }
  const dtBot = performance.now() - t0;
  for (const [k, v] of Object.entries(perf)) console.log(`  ${pad(k, 22)} ${v.toFixed(1).padStart(9)} us`);
  console.log(`  ${pad("apply (random driver)", 22)} ${Math.round(applied / (dtApply / 1000)).toString().padStart(9)} actions/s  (${applied} actions in ${gamesN} games, includes enumerate() to choose)`);
  console.log(`  ${pad("old bots, observed", 22)} ${Math.round(botMoves / (dtBot / 1000)).toString().padStart(9)} moves/s    (${botMoves} moves; the observer adds an isLegal per move)`);
  check(perf.legalActions < 3000 && perf.clone < 2000 && perf.isLegal < 3000, "performance sanity bounds (legalActions < 3 ms, isLegal < 3 ms, clone < 2 ms)");

  console.log(fails ? `\n${fails} FAILED` : "\nALL api201 CHECKS PASSED");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
