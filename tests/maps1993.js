// v1.99.3 maps: Lake, Isthmus, Random shape.  node tests/maps1993.js PORT [games=20] [SHOTS=dir]   (server: node tests/serve.mjs ROOT PORT)
//  1. every map for many seeds (headless engine): 19 hexes, the classic tile and number counts, connected land, 9 harbours on the coast, no adjacent 6/8, the robber on the desert / lake,
//     Random shape: reproducible from its seed, 34-42 coast edges, fits a phone, plenty of different shapes;
//  2. headless bot games on every map (`games` per map, all finish, no host errors, win distribution per seat);
//  3. the save: serializeState -> loadFromStorage restores hexes, ports and the shape (in the page, 2-4 players, Rush too);
//  4. in the browser: the Home and sheet map cards (5 maps, 5-6 players disable all but Island), a real game on every map to the end, the reload keeps the map, the past game and its review open.
const fs = require("fs"), path = require("path");
const port = +process.argv[2] || 9231, GAMES = +process.argv[3] || 20, SHOTS = process.env.SHOTS || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails += 1; };
const MAPS = ["lake", "isthmus", "shape"];
const COUNTS = { wood: 4, brick: 3, sheep: 4, wheat: 4, ore: 3, desert: 1 };
const NUMS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function headless() {
  const { g, playGame, hostMode } = await import("./golden/lib.mjs");
  const M = await import("../src/maps.js");
  // ── 1. the boards ──
  const SEEDS = 200, bad = {};
  const note = (map, why) => { bad[map + ": " + why] = (bad[map + ": " + why] || 0) + 1; };
  const shapes = new Set(); let coastMin = 99, coastMax = 0, wMax = 0, rowsMax = 0;
  for (const map of MAPS) for (let seed = 1; seed <= SEEDS; seed += 1) for (const mode of seed % 2 ? ["random"] : ["balanced", "beginner"]) {
    g._labNewBoard({ board: map, seed, players: 2 + (seed % 3), map: mode });
    const G = g.geometry, hs = G.hexes, nb = hs.map(() => new Set());
    G.edges.forEach((e) => { if (e.hexIds.length === 2) { nb[e.hexIds[0]].add(e.hexIds[1]); nb[e.hexIds[1]].add(e.hexIds[0]); } });
    if (hs.length !== 19) note(map, "hex count");
    const cnt = {}; hs.forEach((h) => { cnt[h.resource] = (cnt[h.resource] || 0) + 1; });
    if (!same(cnt, COUNTS) && !Object.keys(COUNTS).every((k) => cnt[k] === COUNTS[k])) note(map, "tile counts " + JSON.stringify(cnt));
    if (!same(hs.filter((h) => h.number).map((h) => h.number).sort((a, b) => a - b), NUMS)) note(map, "number tokens");
    const seen = new Set([0]), st = [0]; while (st.length) { const i = st.pop(); nb[i].forEach((j) => { if (!seen.has(j)) { seen.add(j); st.push(j); } }); }
    if (seen.size !== 19) note(map, "land not connected");
    for (const h of hs) for (const j of nb[h.id]) { const a = h.number, b = hs[j].number; if (a && b && (a === 6 || a === 8) && (b === 6 || b === 8)) note(map, "adjacent 6/8"); if (mode !== "random" && a && a === b) note(map, "equal neighbours (balanced)"); }
    const des = hs.filter((h) => h.resource === "desert"); if (des.length !== 1 || des[0].number) note(map, "desert");
    if (g.robberHexId !== des[0]?.id) note(map, "robber not on the desert");
    if (map === "lake" && !(hs.filter((h) => h.lake).length === 1 && hs.find((h) => h.lake).q === 0 && hs.find((h) => h.lake).r === 0 && hs.find((h) => h.lake).resource === "desert")) note(map, "lake hex");
    if (map === "lake" && hs.find((h) => h.lake).edges.some((e) => G.edges[e].hexIds.length !== 2)) note(map, "lake not surrounded");
    if (map === "isthmus" && !(hs.find((h) => h.neck)?.resource === "desert")) note(map, "neck is not the desert");
    if (map !== "lake" && hs.some((h) => h.lake)) note(map, "stray lake");
    // harbours: 9 distinct coast edges, 4 x 3:1 + one of each kind, no two sharing a corner, every pier corner knows its harbour
    const ps = g.ports; if (ps.length !== 9) note(map, "harbour count");
    if (!ps.every((p) => G.edges[p.edgeId].hexIds.length === 1)) note(map, "harbour off the coast");
    if (!same(ps.map((p) => p.type).sort(), ["any", "any", "any", "any", "brick", "ore", "sheep", "wheat", "wood"])) note(map, "harbour kinds");
    const corners = ps.flatMap((p) => p.nodes); if (new Set(corners).size !== corners.length) note(map, "harbours share a corner");
    if (!ps.every((p) => p.nodes.every((n) => G.nodes[n].ports.includes(p.type)))) note(map, "node ports");
    const coast = G.edges.filter((e) => e.hexIds.length === 1).length;
    if (map === "shape") { coastMin = Math.min(coastMin, coast); coastMax = Math.max(coastMax, coast); const e = M.extent(hs); wMax = Math.max(wMax, e.w); rowsMax = Math.max(rowsMax, e.rows); shapes.add(JSON.stringify(g.mapShape.map((c) => [c.q, c.r]))); if (g.mapShape.length !== 19) note(map, "shape size"); }
    // the save: one serialised board comes back as it was (here, in the same game object: geometry rebuilt from the state alone)
    const state = JSON.parse(JSON.stringify(g.serializeState()));
    const before = { hexes: hs.map((h) => [h.q, h.r, h.resource, h.number, !!h.lake]), ports: ps.map((p) => [p.edgeId, p.type]), robber: g.robberHexId };
    g.mapShape = null; g.geometry = null; g.onboardingHold = true; const r = g.loadFromStorage(state);
    const G2 = g.geometry, after = r && { hexes: G2.hexes.map((h) => [h.q, h.r, h.resource, h.number, !!h.lake]), ports: g.ports.map((p) => [p.edgeId, p.type]), robber: g.robberHexId };
    if (!r || !same(before, after)) note(map, "save/restore differs");
  }
  ok(!Object.keys(bad).length, `${MAPS.length} maps x ${SEEDS} boards (random / balanced / beginner): counts, connected, harbours, 6/8, robber, save-restore`, bad);
  ok(coastMin >= 34 && coastMax <= 42 && wMax <= 6.5 && rowsMax <= 7, `Random shape: coast ${coastMin}-${coastMax} edges, at most ${wMax} wide and ${rowsMax} rows`);
  ok(shapes.size >= 80, `Random shape: ${shapes.size} different shapes in ${SEEDS} games`);
  ok(same(M.randomShapeHexes(12345), M.randomShapeHexes(12345)) && !same(M.randomShapeHexes(12345), M.randomShapeHexes(12346)), "Random shape: the same seed gives the same shape, another seed another");
  { // a few thousand seeds: the generator never falls back
    let fb = 0; const iso = JSON.stringify(M.isthmusHexes()); for (let s = 1; s <= 3000; s += 1) if (JSON.stringify(M.randomShapeHexes(s)) === iso) fb += 1;
    ok(fb === 0, "Random shape: 3000 seeds, no fallback shape", fb);
  }
  // ── 2. the bots: `GAMES` games with four equal Medium bots (the seat order), `GAMES` with a ladder of levels (who wins), 2 with the search bot ──
  hostMode.on = true;
  const LADDER = [["expert", "intermediate", "simple", "trader"], ["shark", "builder", "expert"], ["expert", "beginner", "intermediate", "shark"], ["trader", "expert", "intermediate"]];
  const out = {};
  for (const map of MAPS) {
    const rows = [], mk = MAPS.indexOf(map); let err = null;
    const run = (kind, i, seats) => { const r = playGame({ id: "m", seed: 7000 + i * 13 + mk, seats, board: map, map: i % 3 === 1 ? "balanced" : "random" }); rows.push({ kind, seats, winner: r.winner, turns: r.turns, vp: r.vp }); };
    try {
      for (let i = 0; i < GAMES; i += 1) run("eq", i, ["intermediate", "intermediate", "intermediate", "intermediate"]);
      for (let i = 0; i < GAMES; i += 1) run("ladder", 100 + i, LADDER[i % LADDER.length]);
      for (let i = 0; i < 2; i += 1) run("master", 200 + i, ["master", "intermediate", "expert", "trader"]);
    } catch (e) { err = String(e.stack || e).split("\n").slice(0, 3).join(" | "); }
    const fin = rows.filter((r) => r.winner != null && Math.max(...r.vp) >= 10), t = rows.map((r) => r.turns).sort((a, b) => a - b);
    const eqBy = [0, 0, 0, 0]; rows.filter((r) => r.kind === "eq").forEach((r) => { if (r.winner != null) eqBy[r.winner] += 1; });
    const lad = {}; rows.filter((r) => r.kind === "ladder").forEach((r) => { if (r.winner != null) { const k = r.seats[r.winner]; lad[k] = (lad[k] || 0) + 1; } });
    const seen = {}; rows.filter((r) => r.kind === "ladder").forEach((r) => r.seats.forEach((k) => { seen[k] = (seen[k] || 0) + 1; }));
    const rate = Object.fromEntries(Object.keys(seen).map((k) => [k, `${lad[k] || 0}/${seen[k]}`]));
    const mas = rows.filter((r) => r.kind === "master").map((r) => r.winner);
    out[map] = { games: rows.length, finished: fin.length, turns: `${t[0]}-${t[t.length - 1]} (median ${t[t.length >> 1]})`, equalLevelWinsBySeat: eqBy, ladderWinsPerGamesSeated: rate, masterGameWinners: mas };
    ok(!err && fin.length === rows.length && rows.length === 2 * GAMES + 2, `${map}: ${rows.length} bot games, all finished, no host errors`, err || out[map]);
    ok(Math.max(...eqBy) <= 0.6 * GAMES, `${map}: with equal bots no seat wins more than 60% (${eqBy.join("/")})`);
  }
  console.log("BOT GAMES " + JSON.stringify(out));
}

async function browser() {
  const { chromium } = require("playwright");
  const T = require("./tlib-human.js");
  const b = await chromium.launch();
  const page0 = await T.newPage(b, { seed: null, speed: 25, palette: "night", viewport: { width: 412, height: 923 }, port });
  const { page } = page0;
  const G = (f, a) => page.evaluate(f, a);
  const shot = async (f) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, f) }); } };
  // ── Home and the sheet ──
  ok(await G(() => document.querySelectorAll(".hm-quick .hm-map").length) === 5, "Home: five map cards");
  const names = await G(() => [...document.querySelectorAll(".hm-quick .hm-map b")].map((e) => e.textContent));
  ok(same(names, ["Island", "Seafarers", "Lake", "Isthmus", "Random shape"]), "Home: map names (EN)", names);
  ok(await G(() => [...document.querySelectorAll(".hm-quick .hm-map")].every((c) => c.querySelector("svg path, svg polygon"))), "Home: every card has a thumbnail");
  for (const m of ["lake", "isthmus", "shape", "seafarers", "island"]) {
    await page.locator(`[data-q="board:${m}"]`).tap(); await sleep(150);
    const st = await G(() => JSON.parse(localStorage.getItem("colonist_last_settings") || "null")); ok(st?.board === m, `Home: ${m} saved`, st?.board);
  }
  await page.locator(`[data-q="players:6"]`).tap(); await sleep(150);
  const dis = await G(() => [...document.querySelectorAll(".hm-quick .hm-map")].map((c) => [c.dataset.k, c.disabled]));
  ok(dis.every(([k, d]) => d === (k !== "board:island")), "Home: at 6 players every map but Island is disabled", dis);
  await page.locator(`[data-q="players:3"]`).tap(); await page.locator(`[data-q="board:isthmus"]`).tap(); await sleep(150);
  ok(await G(() => ["players:5", "players:6"].every((k) => document.querySelector(`[data-q="${k}"]`).disabled)), "Home: on a map the 5 and 6 player buttons are disabled");
  await page.locator(`[data-q="players:4"]`).tap(); await sleep(150);
  ok(await G(() => JSON.parse(localStorage.getItem("colonist_last_settings")).board) === "isthmus", "Home: the map stays chosen when the players change");
  await page.locator(`[data-q="players:4"]`).tap(); await page.locator(`[data-q="board:island"]`).tap(); await sleep(150);
  await shot("home-en-night.png");
  await page.locator("[data-home=adjust]").tap(); await sleep(500);
  ok(await G(() => document.querySelectorAll(".sh-sheet .hm-map").length) === 5 && await G(() => document.querySelectorAll(".sh-sheet .hm-map small").length) === 5, "Sheet: five cards with a subtitle");
  await page.locator('[data-set="board:lake"]').tap(); await sleep(200);
  ok(await G(() => /Lake is a 3–4 player map/.test(document.querySelector(".sh-sheet").innerText)), "Sheet: the 3-4 player note for a map");
  ok(await G(() => JSON.parse(localStorage.getItem("colonist_last_settings")).board) === "lake", "Sheet: Lake saved");
  ok(await G(() => document.querySelectorAll('.sh-bots [data-bot="4"][disabled], .sh-bots [data-bot="5"][disabled]').length) === 2, "Sheet: the 5th and 6th seat are off on a map");
  await page.locator('[data-action=cancel]').tap(); await sleep(400);
  await page.locator(`[data-q="board:island"]`).tap();
  // ── a real game on every map ──
  for (const map of MAPS) {
    const ctx = page0.ctx;
    await G(() => { const g = window.__colonistGame; g.goHome(); });
    await sleep(300);
    await G((m) => { const g = window.__colonistGame; g.startNewGame({ mode: "classic", board: m, numBots: 3, winPoints: 5 }); }, map);
    await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, { timeout: 15000 });
    const info = await G(() => { const g = window.__colonistGame; return { board: g.settings.board, n: g.geometry.hexes.length, ports: g.ports.length, shape: g.mapShape?.length || 0, robber: g.robberHexId, des: g.geometry.hexes.findIndex((h) => h.resource === "desert"), lake: g.geometry.hexes.filter((h) => h.lake).length }; });
    ok(info.board === map && info.n === 19 && info.ports === 9 && info.robber === info.des && (map === "shape" ? info.shape === 19 : info.shape === 0) && (map === "lake" ? info.lake === 1 : info.lake === 0), `${map}: a real game starts on the map`, info);
    // the fitted board is inside the screen and clear of the hand (phone fit)
    const fit = await G(() => { const g = window.__colonistGame, v = g.view, hs = g.geometry.hexes.map((h) => ({ x: h.center.x * v.scale + v.offsetX, y: h.center.y * v.scale + v.offsetY })), r = g.geometry.hexSize * v.scale; return { l: Math.min(...hs.map((h) => h.x)) - r, r: Math.max(...hs.map((h) => h.x)) + r, t: Math.min(...hs.map((h) => h.y)) - r, b: Math.max(...hs.map((h) => h.y)) + r, w: g.boardWidth, h: g.boardHeight }; });
    ok(fit.l >= -2 && fit.r <= fit.w + 2 && fit.t >= -2 && fit.b <= fit.h + 2, `${map}: the whole land is on screen at Fit`, fit);
    await G(T.humanStepFn);
    // set-up, then play to the end (5 points); saved in the middle: the save comes back identically after a reload
    let saved = null, t0 = Date.now(), tags = {};
    for (let i = 0; i < 4000 && Date.now() - t0 < 200000; i += 1) {
      const r = await G(() => window.__humanStep()); tags[r] = (tags[r] || 0) + 1;
      if (!saved && (await G(() => { const g = window.__colonistGame; return !g.setupPhase && g.turn >= 3; }))) {
        saved = await G(() => { const g = window.__colonistGame; g.saveToStorage(); const s = g.serializeState(); return { hexes: s.hexes, ports: s.ports, shape: s.shape || null, board: s.settings.board }; });
        await G(() => sessionStorage.setItem("keep", "1")); // (the helper's init script clears the storage unless this is set)
        await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(500);
        const cont = await G(() => !!document.querySelector("[data-home=continue]")), live = await G(() => !!window.__colonistGame.geometry?.hexes?.some((h) => h.resource) && !!window.__colonistGame.players?.length);
        ok(cont || live, `${map}: after the reload the game is there to continue (Continue row ${cont}, resumed ${live})`);
        if (cont) await page.locator("[data-home=continue]").tap();
        await sleep(800);
        const back = await G(() => { const g = window.__colonistGame; const s = g.serializeState(); return { hexes: s.hexes, ports: s.ports, shape: s.shape || null, board: s.settings.board }; });
        ok(same(back, saved), `${map}: after a reload the saved game has the same tiles, numbers, harbours${map === "shape" ? " and the same random shape" : ""}`);
        await G(T.humanStepFn);
        continue;
      }
      if (r === "over") break;
      await sleep(r === "wait" ? 40 : 15);
    }
    const fin = await G(() => { const g = window.__colonistGame; return { over: !!g.winner, turn: g.turn, vp: g.players.map((p) => p.victoryPoints) }; });
    ok(!!saved && fin.over, `${map}: a game with a person at the table plays to the end (${JSON.stringify(fin.vp)} after ${fin.turn} turns)`, tags);
    await sleep(1200);
    // past game + review
    const meta = await G(async () => { const g = window.__colonistGame; await g.histArchive(); await g.hist.open(); const m = g.hist.metas.find((x) => x.id === g.stats.id); return m ? { id: m.id, board: m.board } : null; });
    ok(meta?.board === map, `${map}: the Past games entry names the board`, meta);
    const endState = await G(() => { const s = window.__colonistGame.serializeState(); return { hexes: s.hexes, shape: s.shape || null }; });
    const rev = await G(async () => { const g = window.__colonistGame; try { g._rvOpenReview(g.players.findIndex((p) => p.isHuman)); } catch (e) { return "ERR " + e.message; } await new Promise((r) => setTimeout(r, 900)); return { open: !!document.querySelector(".rv"), base: !!g._rv?.base, baseShape: g._rv?.base?.shape?.length || 0, recs: g._rv?.recs?.length || 0 }; });
    ok(rev && rev.open && rev.base && rev.recs > 0 && (map === "shape" ? rev.baseShape === 19 : true), `${map}: the review opens, with the board kept once`, rev);
    await shot(`review-${map}.png`);
    await G(() => { window.__colonistGame._rvCloseReview?.(true); });
    // the finished game is in the history with its state: it opens again with the same board
    const re = await G(async (id) => { const g = window.__colonistGame; const rec = await g.hist.get(id); const s = rec?.state; return s ? { hexes: s.hexes, shape: s.shape || null } : null; }, meta?.id);
    ok(re && same(re, endState), `${map}: the past game holds the same board (tiles, numbers${map === "shape" ? ", shape" : ""})`);
    await G((id) => window.__colonistGame.histView(id, "stats"), meta?.id); await sleep(900);
    const opened = await G(() => { const g = window.__colonistGame, s = g.serializeState(); return { hexes: s.hexes, shape: s.shape || null, over: !!document.querySelector(".game-over-overlay") }; });
    ok(opened.over && same({ hexes: opened.hexes, shape: opened.shape }, endState), `${map}: opening the past game shows the same board`);
    await G(() => { const g = window.__colonistGame; g._histView = null; });
  }
  ok(!page0.errors.length, "no page errors", page0.errors.slice(0, 3));
  await b.close();
}

(async () => {
  if (process.env.ONLY !== "browser") await headless();
  if (process.env.ONLY !== "headless") await browser();
  console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
