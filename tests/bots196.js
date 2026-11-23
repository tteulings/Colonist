// Bots behind the Bot interface (architecture step 4). Node only, no browser:  node tests/bots196.js [--quick]
//   (a) one list      the registry lists equal what the new-game screen, the AI Lab pool, the Bots page and the review's reference player showed before
//                     (tests/fixtures/bots-lists-195.json, taken from v1.95); every entry has a profile and a bot bound to it
//   (b) every bot     each registry bot plays a full seeded game through the host loop in classic, Rush played as turns, Seafarers and 5-6 players,
//                     never answers illegally (the host's error list stays empty), and the game ends (a winner, or the lab's turn cap)
//   (c) same game     the host loop plays the golden bot games to the move: moves, random calls, final state equal the legacy loop's (tests/golden)
//   (d) the contract  an illegal answer never reaches the game (the host plays a legal action and reports it); a bot written against the Action API
//                     alone (examples/random-bot.js) and a bot that answers late (a Promise) both play a full game
//   (e) lab opt-in    g._labSimStart(strategies, { host }) is the same game as the legacy lab loop
// Boots the game exactly like tests/golden (same Proxy DOM, same seeds).
const QUICK = process.argv.includes("--quick");
const fs = require("fs"), path = require("path");
let fails = 0;
const check = (ok, msg, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}${extra !== "" ? "  (" + extra + ")" : ""}`); if (!ok) fails++; };

(async () => {
  const lib = await import("./golden/lib.mjs");
  const { GAMES } = await import("./golden/games.mjs");
  const BOTS = await import("../src/bots/index.js");
  const API = await import("../src/api/engine.js");
  const { loadPosition } = await import("../src/review/engine.js");
  const { makeMaster } = await import("../src/master/search.js");
  const { BOT_PROFILES } = await import("../src/bot-profiles.js");
  const { byStrength } = await import("../src/bot-stats.js");
  const { g, H, mulberry32 } = lib;
  const root = path.resolve(__dirname, "..");
  const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ── (a) one list ──
  console.log("(a) one list of bots");
  const before = J("tests/fixtures/bots-lists-195.json");
  const ids = BOTS.botIds();
  check(same(ids, before.presetKeys), "registry order = the preset order of the new-game screen", ids.join(","));
  check(same(H.AI_PRESETS, before.presets), "game.js AI_PRESETS (setup screen presets, dials and policies) = v1.95");
  check(same(H.AI_PRESET_INFO, before.info), "game.js AI_PRESET_INFO (names, taglines, glyphs, new flags) = v1.95");
  check(same(byStrength(BOTS.botIds()), before.byStrength), "new-game picker / AI Lab pool order (byStrength of the registry ids) = v1.95", byStrength(BOTS.botIds()).join(","));
  check(same(BOTS.byLevel(BOTS.botIds()), before.labDrawPool), "AI Lab Random draw pool (by level) = v1.95", BOTS.byLevel(BOTS.botIds()).join(","));
  check(same(BOTS.listBots({ order: "page" }).map((e) => e.id), before.botsPageKeys), "Bots page rows = v1.95", BOTS.listBots({ order: "page" }).map((e) => e.id).join(","));
  check(same(BOTS.listBots({ search: true }).map((e) => e.id), before.slow), "the search bots (slow in the AI Lab) = v1.95", before.slow.join(","));
  check(same(BOTS.botIds().filter((k) => BOTS.isSearchBot(k)), before.slow) && BOTS.isSearchBot("master") && !BOTS.isSearchBot("expert"), "isSearchBot");
  const prof = BOTS.botIds().every((k) => { const p = BOT_PROFILES[k], e = BOTS.getBot(k), b = before.profiles[k]; return p && e.level === b.level && !!e.beyond === b.beyond && e.name === b.label && e.tagline === b.tagline && BOTS.profileFor(k) === p; });
  check(prof, "every entry carries its profile (level, beyond, label, tagline equal the Bots page profile)");
  check(same(BOTS.referenceStrategy(), before.presets.expert) && BOTS.REFERENCE_BOT === "expert", "the review's reference player = the Hard bot");
  check(BOTS.botIds().every((k) => { const b = BOTS.createBot(k, BOTS.isSearchBot(k) ? { agent: makeMaster({ n: 2, timeMs: 0, depth: 1, setupDepth: 1 }) } : {}); return b.id === k && typeof b.decide === "function" && b.level === BOTS.getBot(k).level; }), "createBot(id) gives a Bot with decide() for every id");
  let threw = false; try { BOTS.createBot("nope"); } catch (_) { threw = true; }
  check(threw, "createBot of an unknown id throws");

  // ── (b) every bot plays every mode ──
  console.log("\n(b) every registry bot, every mode, through the host loop");
  const SMALL = { n: 3, timeMs: 0, depth: 2, setupDepth: 2, wallCapMs: 1e9, capMs: 1e9 }; // counted, tiny: the point is that it plays legally, not that it plays well
  const agentFor = (id, sea) => (BOTS.isSearchBot(id) ? makeMaster({ ...SMALL, ...(id === "master" ? {} : { leaf: "gbm" }), ...(sea ? { leaf: "gbm" } : {}) }) : null);
  const seatsOf = (n, id) => [id, ...Array.from({ length: n - 1 }, (_, i) => (i % 2 ? "expert" : "intermediate"))];
  function playMode(id, mode, seed) {
    const sea = mode === "sea", n = mode === "six" ? 6 : sea ? 3 : 4;
    const spec = { seats: n, mode: "classic", sea, seed };
    const names = seatsOf(n, id), strategies = names.map((k) => BOTS.getBot(k).strategy);
    g._labSettings = () => API.settingsFor(g, spec);
    const engine = BOTS.startLabGame(g, strategies.map((s) => ({ ...s })), { players: n, map: "random", seed });
    const bots = names.map((k, i) => BOTS.createBot(k, i === 0 && agentFor(id, sea) ? { agent: agentFor(id, sea) } : {}));
    const host = BOTS.newHost({ seed });
    const r = BOTS.runSync(engine, bots, { host });
    engine.release();
    return { r, host, n };
  }
  /** Rush as turns: a saved Rush game loaded the way the review loads it (a Rush position becomes turn play), then every seat is a Bot. */
  function playRushTurns(id, seed) {
    const d = JSON.parse(fs.readFileSync(path.join(root, "tests/golden/fixtures/rush-save.json"), "utf8"));
    const m = d.origins ? Object.fromEntries(d.origins[0].localStorage.map((x) => [x.name, x.value])) : d;
    const st = JSON.parse(m.colonist_save_v3);
    loadPosition(g, { state: JSON.parse(JSON.stringify(st)), seat: st.currentPlayerIndex ?? 0, trk: null, turnSerial: 0 });
    const n = g.players.length, names = seatsOf(n, id);
    g.players.forEach((p, i) => { p.strategy = { ...BOTS.getBot(names[i]).strategy }; });
    Math.random = mulberry32(seed >>> 0);
    const engine = BOTS.createEngine(g, { meta: { host: true } }); engine.legacyBotOrder = true; engine.takeControl("all");
    const bots = names.map((k, i) => BOTS.createBot(k, i === 0 && agentFor(id, false) ? { agent: agentFor(id, false) } : {}));
    const host = BOTS.newHost({ seed });
    const t0 = g.turn, r = BOTS.runSync(engine, bots, { host, until: () => g.turn >= t0 + (QUICK ? 6 : 12) });
    engine.release();
    return { r, host, n, rushPos: !!g._rushPos };
  }
  const MODES = ["classic", "rush-as-turns", "sea", "six"];
  const pad = (s, n) => String(s).padEnd(n);
  for (const mode of MODES) {
    let bad = [], games = 0, moves = 0, t0 = performance.now();
    for (const [i, id] of BOTS.botIds().entries()) {
      if (QUICK && BOTS.isSearchBot(id) && (mode === "sea" || mode === "six") && id !== "master") continue;
      const seed = 96000 + i * 7 + MODES.indexOf(mode);
      let res;
      try { res = mode === "rush-as-turns" ? playRushTurns(id, seed) : playMode(id, mode, seed); } catch (e) { bad.push(`${id}: threw ${e.message.slice(0, 160)}`); continue; }
      games++; moves += res.host.steps;
      const ended = mode === "rush-as-turns" ? res.r.winner != null || res.r.done || res.host.turns > 0 : res.r.done;
      if (res.host.errors.length) bad.push(`${id}: ${res.host.errors.length} illegal/odd answers, first ${JSON.stringify(res.host.errors[0]).slice(0, 220)}`);
      else if (!ended) bad.push(`${id}: the game did not end`);
      else if (mode === "rush-as-turns" && !res.rushPos) bad.push(`${id}: not a Rush position`);
    }
    check(!bad.length && games > 0, `${pad(mode, 14)} ${games} bots, ${moves} moves, no illegal answer, every game ends`, bad.length ? bad.join(" | ") : `${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }

  // ── (c) the host plays the golden games to the move ──
  console.log("\n(c) the host loop is the legacy loop");
  const specs = GAMES.filter((s) => s.mode !== "rush").filter((s) => !QUICK || ["classic-expert", "classic-ladder", "classic-master", "sea-ladder", "six-ladder"].includes(s.id));
  let diff = [];
  for (const spec of specs) {
    lib.hostMode.on = false; const a = lib.playGame({ ...spec });
    lib.hostMode.on = true; const b = lib.playGame({ ...spec });
    lib.hostMode.on = false;
    if (a.movesHash !== b.movesHash || a.stateHash !== b.stateHash || a.randomCalls !== b.randomCalls || a.decisionsHash !== b.decisionsHash || a.winner !== b.winner) diff.push(`${spec.id} ${a.movesHash}/${b.movesHash} rnd ${a.randomCalls}/${b.randomCalls}`);
  }
  check(!diff.length, `${specs.length} seeded games (classic, search bots, Seafarers, 5-6): moves, decisions, random calls and final state equal`, diff.join(" | "));

  // ── (d) the contract ──
  console.log("\n(d) the Bot contract");
  const meta = { id: "x", name: "x", level: 1, needs: {} };
  function runWith(botFor, { seats = 3, seed = 4242, run = "sync" } = {}) {
    g._labSettings = () => API.settingsFor(g, { seats, seed });
    const strategies = Array.from({ length: seats }, () => ({ ...H.AI_PRESETS.intermediate }));
    const engine = BOTS.startLabGame(g, strategies, { players: seats, map: "random", seed });
    const bots = Array.from({ length: seats }, (_, i) => botFor(i));
    const host = BOTS.newHost({ seed });
    const out = run === "sync" ? BOTS.runSync(engine, bots, { host }) : BOTS.runUntilHuman(engine, bots, { host });
    return { engine, host, out };
  }
  { // a bot that answers illegally every other time: the host must still finish the game and say so
    let n = 0;
    const naive = BOTS.createBot("beginner");
    const buggy = { ...meta, view: false, legal: false, decide(v, p, l, ctx) {
      if (p.kind === "main" && n++ % 2 === 0) return { actor: p.actor, type: "build", piece: "city", node: 9999 }; // nowhere
      if (p.kind === "main" && n % 5 === 0) return null;                                                          // no answer at all
      return naive.decide(v, p, l, ctx);
    } };
    const { engine, host, out } = runWith((i) => (i === 0 ? buggy : BOTS.createBot("beginner")), { seats: 3, seed: 515 });
    check(out.done && host.errors.length > 3 && host.errors.every((e) => e.reason || e.warn || e.action === null), "illegal and missing answers are caught, the game still ends", `${host.errors.length} reported, winner ${out.winner}, ${host.steps} moves`);
    check(host.errors.some((e) => /city|cannot|not/.test(String(e.reason || ""))), "the reason of the refusal is reported", String(host.errors[0]?.reason || ""));
    engine.release();
  }
  { // a bot written against the Action API alone (no game access): examples/random-bot.js
    const { pickAction } = require("../examples/random-bot.js");
    const mk = (i) => { const rnd = mulberry32(900 + i); return { ...meta, id: "random", view: true, legal: true, decide: (view, prompt, legal, ctx) => pickAction(view, prompt, ctx.enumerate(40), rnd) }; };
    const { engine, host, out } = runWith(mk, { seats: 3, seed: 616 });
    check(out.done && out.winner != null && !host.errors.length, "a bot using only view / prompt / legal (examples/random-bot.js) plays a full game, no illegal answer", `${host.steps} moves, winner ${out.winner}`);
    engine.release();
  }
  { // a bot that answers late
    const inner = BOTS.createBot("intermediate");
    const late = { ...inner, decide: (v, p, l, ctx) => new Promise((res) => setTimeout(() => res(inner.decide(v, p, l, ctx)), 0)) };
    const t = await new Promise((resolve) => { const r = runWith((i) => (i === 0 ? late : BOTS.createBot("intermediate")), { seats: 3, seed: 717, run: "async" }); resolve(r); });
    const out = await t.out;
    check(out.done && !t.host.errors.length, "a bot that answers with a Promise plays a full game through runUntilHuman", `${t.host.steps} moves`);
    t.engine.release();
    let threw2 = false;
    try { const r = runWith((i) => (i === 0 ? late : BOTS.createBot("intermediate")), { seats: 3, seed: 717 }); void r; } catch (e) { threw2 = /asynchronously/.test(e.message); }
    check(threw2, "runSync refuses an async bot with a clear message");
    g._later = g._later; // (the aborted run left its engine on the game object: the next game takes it over)
  }
  { // a person's seat: the host stops at a prompt no bot owns
    g._labSettings = () => API.settingsFor(g, { seats: 3, seed: 818 });
    const strategies = Array.from({ length: 3 }, () => ({ ...H.AI_PRESETS.intermediate }));
    const engine = BOTS.startLabGame(g, strategies, { players: 3, map: "random", seed: 818 });
    const bots = [null, BOTS.createBot("expert"), BOTS.createBot("expert")]; // seat 0 is a person
    const r = BOTS.runSync(engine, bots, { host: BOTS.newHost({ seed: 818 }) });
    const pr = engine.prompt();
    check(!r.done && pr && pr.actor === 0 && pr.kind === "setupSettlement", "runUntilHuman-style stop: the host returns when a seat without a bot is asked", pr ? `${pr.kind} for seat ${pr.actor}` : "none");
    engine.release();
  }

  // ── (e) the lab opt-in ──
  console.log("\n(e) AI Lab sim, opt-in host driver");
  {
    const spec = { id: "lab", seed: 1313, seats: ["expert", "intermediate", "builder", "beginner"] };
    const run = (host) => {
      g._labSettings = () => API.settingsFor(g, { seats: 4, seed: spec.seed });
      const st = spec.seats.map((k) => ({ ...H.AI_PRESETS[k] }));
      g._labSimStart(st, { players: 4, map: "random", seed: spec.seed, ...(host ? { host: BOTS } : {}) });
      let r = { done: false }; while (!r.done) r = g._labSimStep(12);
      return { r, vp: g.players.map((p) => p.victoryPoints), hash: lib.stateHash(g.serializeState()) };
    };
    const a = run(false), b = run(true);
    check(a.r.winner === b.r.winner && a.r.turns === b.r.turns && same(a.vp, b.vp) && a.hash === b.hash, "_labSimStart(..., { host }) plays the same game as the legacy lab loop", `winner ${b.r.winner}, ${b.r.turns} turns, vp ${b.vp.join("/")}`);
    const c = run(false);
    check(c.hash === a.hash, "the legacy lab loop still works after a host game (the game's own timers are back)");
  }

  console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL bots196 CHECKS PASSED");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
