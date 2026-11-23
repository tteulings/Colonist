// ux-132: Seafarers taps with a movable ship next to a buildable island corner; Road/Ship chooser; Classic unchanged.
// Real touch taps, 360x780 @2x. Usage: node tap132.js ROOT PORT [classicOut.json]
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [ROOT, PORTS = "9873", CLASSIC_OUT] = process.argv.slice(2); const PORT = +PORTS;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const serve = () => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT, () => res(s)); });
const G = (page, f, a) => page.evaluate(f, a);
let fails = 0;
const check = (ok, msg, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}${extra !== "" ? "  (" + extra + ")" : ""}`); if (!ok) fails++; };
(async () => {
  const server = await serve(); const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.addInitScript(() => { if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  await sleep(500);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
  const pt = (wx, wy) => G(page, ([wx, wy]) => { const g = window.__colonistGame; const s = g.worldToScreen(wx, wy); const r = g.canvas.getBoundingClientRect(); return { x: r.left + (s.x * r.width) / g.boardWidth, y: r.top + (s.y * r.height) / g.boardHeight }; }, [wx, wy]);
  const nodePt = async (id) => pt(...(await G(page, (id) => { const n = window.__colonistGame.geometry.nodes[id]; return [n.x, n.y]; }, id)));
  const edgePt = async (id, f = 0.5) => { const [a, c] = await G(page, (id) => window.__colonistGame.geometry.edges[id].nodes, id); const pa = await nodePt(a), pc = await nodePt(c); return { x: pa.x + (pc.x - pa.x) * f, y: pa.y + (pc.y - pa.y) * f }; };
  const tap = async (p) => { await page.touchscreen.tap(p.x, p.y); await sleep(450); };
  const state = () => G(page, () => { const g = window.__colonistGame; const h = g.players[0]; return { cb: g.confirmBuild ? g.confirmBuild.type : null, pa: g.pendingAction, set: h.settlements.size, roads: h.roads.size, ships: [...h.ships].sort((a, b) => a - b).join(","), move: g.sea?.moveSel?.from ?? null, chooser: [...document.querySelectorAll(".sea-chooser button")].map((x) => x.dataset.piece).join("|") || null }; });
  const zoomTo = async (zoom, nodeId) => {
    await G(page, () => { const g = window.__colonistGame; g.fitView(); g.render(); });
    if (zoom === "2x") { const xy = await G(page, (id) => { const n = window.__colonistGame.geometry.nodes[id]; return [n.x, n.y]; }, nodeId); await G(page, ([cx, cy]) => { const g = window.__colonistGame; const s = g.worldToScreen(cx, cy); g.zoomAt(s.x, s.y, 2); g.render(); }, xy); }
    await sleep(300);
  };

  // ── Seafarers ──
  await G(page, () => window.__colonistGame.startNewGame({ mode: "classic", board: "seafarers", map: "beginner", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }));
  await sleep(1000);
  await G(page, () => {
    const g = window.__colonistGame, geo = g.geometry, sea = g.sea; g._later = () => {}; g.stopAutoplay?.();
    const clear = () => {
      g._seaCloseChooser?.(); sea.moveSel = null;
      geo.nodes.forEach((n) => { n.owner = null; n.structure = null; }); geo.edges.forEach((e) => { e.owner = null; e.ship = false; });
      g.players.forEach((p) => { p.roads.clear(); p.ships.clear(); p.settlements.clear(); p.cities.clear(); });
      g.setupPhase = false; g.setupAction = null; g.phase = "main"; g.currentPlayerIndex = 0; g.winner = null;
      g.pendingAction = null; g.confirmBuild = null; g.trayMode = null; g.freeRoadsRemaining = 0; g._autoPick = false; g._dropUndo?.();
      g.confirmMode = "unsure"; sea.onNewTurn(); sea.moved?.clear?.(); sea.builtThisTurn?.clear?.();
      const h = g.players[0]; const R = ["wood", "brick", "sheep", "wheat", "ore"];
      R.forEach((r) => { g.bank[r] += h.resources[r]; h.resources[r] = 0; });
      Object.assign(h.resources, { wood: 3, brick: 2, sheep: 3, wheat: 1 }); R.forEach((r) => { g.bank[r] -= h.resources[r]; });
      return h;
    };
    window.__t = {};
    // ship route arriving at island corner C: back - A - seaE - C
    window.__t.ships = () => {
      const h = clear();
      const C = geo.nodes.find((n) => sea.islandOfNode(n.id) === 2 && n.adjacentHexes.length === 3 && n.adjacentHexes.filter((x) => sea.isLandHex(x)).length === 1
        && n.edgeIds.every((e) => !sea.pirateTouches(e)) && n.edgeIds.filter((e) => sea.edgeKind(e) === "sea").length >= 1).id;
      const seaE = geo.nodes[C].edgeIds.find((e) => sea.edgeKind(e) === "sea");
      const A = geo.edges[seaE].nodes.find((n) => n !== C);
      const back = geo.nodes[A].edgeIds.find((e) => e !== seaE && !geo.edges[e].hexIds.includes(sea.pirateHexId));
      [back, seaE].forEach((id) => { geo.edges[id].owner = 0; geo.edges[id].ship = true; h.ships.add(id); });
      const X = geo.nodes[A].edgeIds.find((e) => e !== seaE && e !== back);
      g.recomputeScores(); g._syncAutoGlow?.(); g.render();
      return { C, A, seaE, back, X, xShip: X != null && g.canBuildShip(h, X), movable: sea.movableShips(h) };
    };
    // a settlement on a main-island coast corner, no ships: a coast edge that takes a road or a ship
    window.__t.coast = () => {
      const h = clear();
      for (const n of geo.nodes) {
        if (sea.islandOfNode(n.id) !== 0 || n.adjacentHexes.length < 2) continue;
        n.owner = 0; n.structure = "settlement"; h.settlements.add(n.id);
        const e = n.edgeIds.find((id) => g.canBuildRoad(h, id, {}) && g.canBuildShip(h, id, {}));
        if (e != null) { g.recomputeScores(); g._syncAutoGlow?.(); g.render(); return { M: n.id, E: e }; }
        n.owner = null; n.structure = null; h.settlements.delete(n.id);
      }
      return null;
    };
  });
  if (!process.env.SKIPSEA) for (const zoom of ["fit", "2x"]) {
    const L = await G(page, () => window.__t.ships());
    if (zoom === "fit") console.log("layout", JSON.stringify(L));
    const prep = async () => { await G(page, () => window.__t.ships()); await zoomTo(zoom, L.C); };
    const toward = async (px) => { const c = await nodePt(L.C), a = await nodePt(L.A); const d = Math.hypot(a.x - c.x, a.y - c.y); return { x: c.x + (a.x - c.x) * px / d, y: c.y + (a.y - c.y) * px / d, len: d }; };
    // 1. a tap on the island corner: the settlement (shown, Confirm builds), never the ship
    await prep();
    await tap(await toward(3)); let s = await state();
    check(s.cb === "settlement" && s.move == null && !s.chooser, `${zoom}: tap on the island corner picks the settlement, not the ship`, JSON.stringify(s));
    if (zoom === "fit") await shot("sea-1-corner-picked");
    await page.locator("[data-place]").tap(); await sleep(400); s = await state();
    check(s.set === 1 && s.ships === `${Math.min(L.seaE, L.back)},${Math.max(L.seaE, L.back)}`, `${zoom}: Confirm builds the settlement on the island`, JSON.stringify(s));
    // 2. a tap between the corner and the ship: chooser Settlement · Move ship; Settlement builds (When unsure)
    await prep();
    const len = (await toward(1)).len; const mid = await toward(zoom === "fit" ? 14 : 0.41 * len);
    await tap(mid); s = await state();
    check(s.chooser === "settlement|move" && s.move == null && s.set === 0, `${zoom}: a tap between corner and ship asks (Settlement · Move ship)`, JSON.stringify(s));
    if (zoom === "fit") await shot("sea-2-chooser");
    const btnSz = await G(page, () => [...document.querySelectorAll(".sea-chooser button")].map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    check(btnSz.length === 2 && btnSz.every((v) => v >= 44), `${zoom}: chooser buttons >= 44 px`, btnSz.join(","));
    const pv = await G(page, () => { const g = window.__colonistGame; return { pv: g._seaPreview, icons: document.querySelectorAll(".sea-chooser button canvas").length, nums: [...document.querySelectorAll(".sea-chooser button i")].map((e) => e.textContent).join(",") }; });
    check(pv.icons === 2 && pv.nums === "1,2" && pv.pv?.numbered && pv.pv.items.map((i) => `${i.n}${i.type}`).join(",") === "1settlement,2move", `${zoom}: tiles carry a piece icon and a number; the board previews both (numbered)`, JSON.stringify(pv));
    await page.locator('.sea-chooser [data-piece="settlement"]').tap(); await sleep(400); s = await state();
    check(s.set === 1 && !s.chooser && s.move == null, `${zoom}: chooser Settlement builds it`, JSON.stringify(s));
    check(await G(page, () => window.__colonistGame._seaPreview == null), `${zoom}: preview gone once picked`);
    // 3. same tap, chooser Move ship lifts the ship; a dotted spot moves it
    await prep();
    await tap(mid);
    await page.locator('.sea-chooser [data-piece="move"]').tap(); await sleep(400); s = await state();
    check(s.pa === "moveShip" && s.move === L.seaE && s.set === 0, `${zoom}: chooser Move ship lifts the ship`, JSON.stringify(s));
    const tgt = await G(page, () => window.__colonistGame.sea.moveSel.targets.find((t) => true));
    await tap(await edgePt(tgt)); s = await state();
    check(s.pa !== "moveShip" && s.ships.split(",").map(Number).includes(tgt) && !s.ships.split(",").map(Number).includes(L.seaE), `${zoom}: a dotted spot moves the ship`, JSON.stringify({ ...s, tgt }));
    // 4. a tap on the far ship's middle lifts it at once
    await prep();
    await tap(await edgePt(L.back, 0.5)); s = await state();
    check(s.pa === "moveShip" && s.move === L.back, `${zoom}: a tap on the ship's middle lifts it`, JSON.stringify(s));
    // 5. a tap on the sea edge beyond the ships (a new ship): builds / shows the new ship, never lifts a ship
    if (L.xShip) {
      await prep();
      await tap(await edgePt(L.X, 0.6)); s = await state();
      check(s.pa !== "moveShip" && (s.cb === "ship" || s.ships.split(",").length === 3 || s.chooser === "ship|move"), `${zoom}: a tap on the next sea edge makes a new ship (or asks), never just lifts`, JSON.stringify(s));
    }
  }
  // 6. Road / Ship chooser still works
  if (!process.env.SKIPSEA) for (const zoom of ["fit", "2x"]) {
    const L = await G(page, () => window.__t.coast());
    await zoomTo(zoom, L.M);
    await tap(await edgePt(L.E, 0.55)); let s = await state();
    check(s.chooser === "road|ship", `${zoom}: coast edge asks Road / Ship`, JSON.stringify(s));
    const pv2 = await G(page, () => window.__colonistGame._seaPreview);
    check(pv2?.numbered && pv2.items.length === 2, `${zoom}: Road / Ship chooser previews both on the board`, JSON.stringify(pv2));
    if (zoom === "2x") await shot("sea-6-road-ship");
    await page.locator('.sea-chooser [data-piece="ship"]').tap(); await sleep(400); s = await state();
    check(s.ships === String(L.E) || s.cb === "ship", `${zoom}: chooser Ship builds the ship`, JSON.stringify(s));
  }

  // ── Classic: outcomes of a fixed set of taps (compared with the base build by the caller) ──
  await G(page, () => window.__colonistGame.startNewGame({ mode: "classic", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }));
  await sleep(1000);
  const out = [];
  await G(page, () => {
    const g = window.__colonistGame, geo = g.geometry; g._later = () => {}; g.stopAutoplay?.();
    window.__t.classic = () => {
      geo.nodes.forEach((n) => { n.owner = null; n.structure = null; }); geo.edges.forEach((e) => { e.owner = null; });
      g.players.forEach((p) => { p.roads.clear(); p.settlements.clear(); p.cities.clear(); });
      g.setupPhase = false; g.setupAction = null; g.phase = "main"; g.currentPlayerIndex = 0; g.winner = null;
      g.pendingAction = null; g.confirmBuild = null; g.trayMode = null; g.freeRoadsRemaining = 0; g._autoPick = false; g._dropUndo?.(); g.confirmMode = "unsure";
      const h = g.players[0], R = ["wood", "brick", "sheep", "wheat", "ore"];
      R.forEach((r) => { g.bank[r] += h.resources[r]; h.resources[r] = 0; });
      Object.assign(h.resources, { wood: 3, brick: 3, sheep: 1, wheat: 3, ore: 3 }); R.forEach((r) => { g.bank[r] -= h.resources[r]; });
      const n0 = geo.nodes.find((n) => n.adjacentHexes.length === 3); n0.owner = 0; n0.structure = "settlement"; h.settlements.add(n0.id);
      const e1 = n0.edgeIds[0]; geo.edges[e1].owner = 0; h.roads.add(e1);
      const n1 = geo.edges[e1].nodes.find((n) => n !== n0.id);
      const e2 = geo.nodes[n1].edgeIds.find((e) => e !== e1); geo.edges[e2].owner = 0; h.roads.add(e2);
      const n2 = geo.edges[e2].nodes.find((n) => n !== n1);
      g.recomputeScores(); g._syncAutoGlow?.(); g.render();
      return { n0: n0.id, n2, e3: geo.nodes[n2].edgeIds.find((e) => e !== e2) };
    };
  });
  for (const zoom of ["fit", "2x"]) {
    const C = await G(page, () => window.__t.classic());
    const cases = [["city", () => nodePt(C.n0)], ["settlement corner", () => nodePt(C.n2)], ["road mid", () => edgePt(C.e3, 0.5)], ["road near corner", () => edgePt(C.e3, 0.25)]];
    for (const [lab, where] of cases) {
      await G(page, () => window.__t.classic()); await zoomTo(zoom, C.n2);
      await tap(await where()); const s = await state();
      out.push({ zoom, lab, ...s });
    }
  }
  console.log("classic", JSON.stringify(out));
  if (CLASSIC_OUT) {
    if (fs.existsSync(CLASSIC_OUT)) { const ref = fs.readFileSync(CLASSIC_OUT, "utf8"); check(ref === JSON.stringify(out), "Classic: tap outcomes equal to the base build", ref === JSON.stringify(out) ? "" : ref); }
    else fs.writeFileSync(CLASSIC_OUT, JSON.stringify(out));
  }
  check(!errors.length, "no page errors", errors.join(" | "));
  await b.close(); server.close();
  console.log(fails ? `${fails} FAILED` : "ALL PASS"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("FAIL exception", e.stack); process.exit(1); });
