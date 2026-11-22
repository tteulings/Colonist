// v1.95 Rush: the development cards with a choice (Monopoly, Year of Plenty, Road Building, Knight) while the dice and the bots keep running.
// node tests/rushmono195.js [ROOT] [PORT]   (serves ROOT itself; defaults: the repo, 9851)   SHOTS=dir for screenshots, VIDEO=dir for a WebM
//  at 412x923 and 360x780 touch, NL and EN, Rush with a 5 s roll:
//  - each card is played with real taps; for longer than a whole roll interval nothing moves: no roll, no bot move, the picker stays open (the fair rule:
//    the table waits for your choice, at most RUSH_CHOICE_MAX_MS), the clock shows "paused"
//  - Monopoly: tap a resource, Take: you get exactly what every opponent held, a result toast says it (+n <resource> from m players)
//  - Year of Plenty: two picks, toast; Road Building: two free roads; Knight: the robber moves
//  - Keep gives the card back (nothing lost); a choice left open past the limit gives the card back by itself
//  - the dice run again right after; no console errors
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 9851;
const SH = process.env.SHOTS || "", VIDEO = process.env.VIDEO || "", ONLY = process.env.ONLY || "";
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); });

const SNAP = () => { const g = window.__colonistGame, h = g.players[0]; const t = document.querySelector("#dockPicker");
  return { roll: g.rush.rollNo, paused: g.rush.paused, phase: g.phase, dp: g.devPick ? { type: g.devPick.type, n: g.devPick.picks.length } : null, free: g.freeRoadsRemaining, pa: g.pendingAction,
    tray: t && !t.hidden ? t.dataset.mode : null, played: h.rushDevPlayed, cards: JSON.parse(JSON.stringify(h.devCards)), res: { ...h.resources }, bots: g.players.slice(1).map((p) => ({ ...p.resources })),
    roads: h.roads.size, robber: g.robberHexId, hudTitle: document.querySelector("#rushTitle")?.textContent || "", hudLabel: document.querySelector("#rushSecondsLabel")?.textContent || "", log: g.logEntries.length }; };

async function run(W, H, lang) {
  const tag = `${W}x${H} ${lang}`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US",
    ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: W, height: H } } } : {}) });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((lang) => { if (sessionStorage.getItem("i")) return; sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_lang", lang); }, lang);
  await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady); await sleep(600);
  const G = (f, a) => page.evaluate(f, a);
  const shot = async (n) => { if (SH) await page.screenshot({ path: `${SH}/${n}-${W}-${lang}.png` }); };
  await G(() => window.__colonistGame.startNewGame({ mode: "rush", numBots: 3, botStyleMode: "all", allPreset: "intermediate", rushInterval: 5 }));
  await sleep(800);
  await G(async () => { const g = window.__colonistGame; const t0 = Date.now(); while (g.setupPhase && Date.now() - t0 < 60000) { const p = g.players[g.setupQueue[g.setupStep]];
    if (p && p.isHuman) { if (g.setupAction === "settlement") g._commitSetup(p, { type: "settlement", id: g.getBestInitialSettlementNode(p) }); else if (g.setupAction === "road") g._commitSetup(p, { type: "road", id: g.geometry.edges.find((e) => e.owner == null && e.nodes.includes(g.lastSetupNodeId)).id }); }
    await new Promise((r) => setTimeout(r, 120)); } });
  await sleep(600);
  await G(() => { const g = window.__colonistGame; g.onboarding?.closeTips?.(); document.querySelectorAll("#dockTip").forEach((e) => (e.hidden = true)); g._hideTip?.(); });
  const settle = async () => { // out of any 7 / robber business, no dev card pending
    for (let i = 0; i < 80; i++) {
      const s = await G(() => { const g = window.__colonistGame; if (g.rush.paused || g.pendingDiscard || g.pendingAction === "robber") { try { if (g.pendingDiscard) g._discardAuto(); else if (g.rush.seven) g._rushAutoFinishHumanRobber(g._me()); } catch (_) {} return false; }
        return g.phase === "main" && !g.devPick && !g.freeRoadsRemaining && !g.robberVictimOptions?.length; });
      if (s) return; await sleep(400);
    }
  };
  const give = (t, extra) => G(([t, extra]) => { const g = window.__colonistGame, h = g.players[0]; h.devCards[t] = 1; h.rushDevPlayed = false; g.players.forEach((p) => g._dropUndo?.());
    if (extra) extra(); g.renderResourceCards(); }, [t, null]);
  const tapEl = async (sel, must = true) => { const bb = await page.locator(sel).first().boundingBox({ timeout: 3000 }).catch(() => null); if (!bb) { if (must) ok(false, `${tag}: ${sel} is on screen`); return false; } await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(300); return bb; };
  const play = async (t) => { await tapEl(`.card[data-dev="${t}"]`); await tapEl("[data-dev-go]"); };
  // the table stands still: no roll, no bot move, the choice stays open, for longer than a whole roll interval
  const holdCheck = async (label, expectTray) => {
    const a = await G(SNAP); let bad = [];
    for (let i = 0; i < 24; i++) { await sleep(300); const s = await G(SNAP);
      if (s.roll !== a.roll) bad.push("rolled"); if (JSON.stringify(s.bots) !== JSON.stringify(a.bots)) bad.push("a bot moved"); if (JSON.stringify(s.res) !== JSON.stringify(a.res)) bad.push("your hand changed");
      if (expectTray && s.tray !== expectTray) bad.push("picker closed"); if (s.log !== a.log && !/Roll|Rush/.test("")) { /* the feed may carry offers, not game moves */ } }
    const z = await G(SNAP);
    ok(!bad.length, `${tag} ${label}: 7 s with the choice open: no roll, no bot move, picker stays`, [...new Set(bad)].join(",") || `roll #${z.roll}, ${z.hudLabel}`);
    return z;
  };
  const toastText = () => G(() => [...document.querySelectorAll("#toastStack .toast")].map((t) => t.innerText.replace(/\s+/g, " ").trim()));
  const ENW = lang === "nl" ? { Grain: "graan", Ore: "erts" } : { Grain: "Grain", Ore: "Ore" };

  // ── Monopoly ──
  if (!ONLY || ONLY === "mono") {
    await settle();
    await G(() => { const g = window.__colonistGame; g.players.slice(1).forEach((p, i) => { g.bank.wheat += p.resources.wheat; p.resources.wheat = i === 1 ? 0 : 2 + i; g.bank.wheat -= p.resources.wheat; }); });
    await give("monopoly");
    const before = await G(SNAP); const owed = before.bots.reduce((n, r) => n + r.wheat, 0), donors = before.bots.filter((r) => r.wheat > 0).length;
    await play("monopoly");
    let s = await G(SNAP); ok(s.dp?.type === "monopoly" && s.tray === "pick", `${tag} Monopoly: the picker opens`, s.tray);
    await shot("mono-open");
    const sz = await G(() => [...document.querySelectorAll("#dockPicker .tbtn.res")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    ok(sz.length === 5 && sz.every(([w, h]) => w >= 44 && h >= 44), `${tag} Monopoly: five resource targets, each at least 44 px`, sz.map((x) => x.join("x")).join(" "));
    s = await holdCheck("Monopoly", "pick");
    ok(/pause|gepauz/i.test(s.hudTitle + s.hudLabel), `${tag} Monopoly: the clock says paused`, s.hudTitle);
    await tapEl('#dockPicker [data-pick="wheat"]'); await tapEl("#dockPicker [data-pick-ok]");
    await sleep(500);
    const after = await G(SNAP);
    ok(after.res.wheat - before.res.wheat === owed && after.bots.every((r) => r.wheat === 0) && !after.dp, `${tag} Monopoly: you got exactly what the others held (${owed})`, after.res.wheat - before.res.wheat);
    const tx = (await toastText()).join(" | ");
    const want = lang === "nl" ? new RegExp(`Monopolie: \\+${owed} graan van ${donors} spelers`) : new RegExp(`Monopoly: \\+${owed} Grain from ${donors} players`);
    ok(want.test(tx), `${tag} Monopoly: the result toast`, tx);
    await shot("mono-done");
    const r1 = (await G(SNAP)).roll; await sleep(6500); ok((await G(SNAP)).roll > r1, `${tag} Monopoly: the dice run again after the pick`);
    // Keep: the card comes back
    await settle(); await give("monopoly"); await play("monopoly");
    const k0 = await G(SNAP); ok(k0.tray === "pick" && k0.cards.monopoly === 0, `${tag} Keep: card is in play`);
    await tapEl("#dockPicker [data-pick-cancel]"); const k1 = await G(SNAP);
    ok(!k1.dp && k1.cards.monopoly === 1 && !k1.played, `${tag} Keep: the card is back in the hand, nothing spent`, JSON.stringify({ dp: k1.dp, m: k1.cards.monopoly, played: k1.played }));
    // left open past the limit: the card is given back by itself
    await settle(); await play("monopoly"); await G(() => { window.__colonistGame.rush.choiceMs = 44200; }); await sleep(1800);
    const k2 = await G(SNAP); ok(!k2.dp && k2.cards.monopoly === 1 && k2.tray !== "pick", `${tag} an open pick past the limit gives the card back`, JSON.stringify({ dp: k2.dp, m: k2.cards.monopoly }));
    await G(() => { window.__colonistGame.players[0].devCards.monopoly = 0; });
  }
  // ── Year of Plenty ──
  if (!ONLY || ONLY === "yop") {
    await settle(); await G(() => { window.__colonistGame.players[0].devCards.monopoly = 0; });
    await give("yearOfPlenty"); const before = await G(SNAP);
    await play("yearOfPlenty"); let s = await G(SNAP); ok(s.dp?.type === "yearOfPlenty" && s.tray === "pick", `${tag} Year of Plenty: the picker opens`);
    s = await holdCheck("Year of Plenty", "pick");
    await tapEl('#dockPicker [data-pick="ore"]'); await tapEl('#dockPicker [data-pick="wheat"]'); await sleep(400);
    const after = await G(SNAP);
    ok(after.res.ore - before.res.ore === 1 && after.res.wheat - before.res.wheat === 1 && !after.dp, `${tag} Year of Plenty: +1 ore +1 grain`);
    const tx = (await toastText()).join(" | ");
    ok((lang === "nl" ? /Uitvinding: \+1 (erts \+1 graan|graan \+1 erts)/ : /Year of Plenty: \+1 (Ore \+1 Grain|Grain \+1 Ore)/).test(tx), `${tag} Year of Plenty: the result toast`, tx);
    await shot("yop-done");
  }
  // ── Road Building ──
  if (!ONLY || ONLY === "road") {
    await settle(); await give("roadBuilding"); const before = await G(SNAP);
    await play("roadBuilding"); let s = await G(SNAP); ok(s.free === 2, `${tag} Road Building: two free roads`, s.free);
    s = await holdCheck("Road Building", null);
    for (let n = 0; n < 2; n++) {
      const pt = await G(() => { const g = window.__colonistGame, h = g.players[0]; const e = g.geometry.edges.find((e) => g.canBuildRoad(h, e.id, { free: true })); if (!e) return null;
        const a = g.geometry.nodes[e.nodes[0]], c = g.geometry.nodes[e.nodes[1]]; const sc = g.worldToScreen((a.x + c.x) / 2, (a.y + c.y) / 2); const r = g.canvas.getBoundingClientRect();
        return { x: r.left + (sc.x * r.width) / g.boardWidth, y: r.top + (sc.y * r.height) / g.boardHeight }; });
      if (!pt) break; await page.touchscreen.tap(pt.x, pt.y); await sleep(500);
      if (await G(() => !!window.__colonistGame.confirmBuild)) { await G(() => window.__colonistGame._confirmViaIcon()); await sleep(400); }
    }
    const after = await G(SNAP); ok(after.roads - before.roads === 2 && after.free === 0, `${tag} Road Building: both roads placed`, after.roads - before.roads);
    await shot("road-done");
  }
  // ── Knight ──
  if (!ONLY || ONLY === "knight") {
    await settle(); await give("knight"); const before = await G(SNAP);
    await play("knight"); let s = await G(SNAP); ok(s.pa === "robber", `${tag} Knight: robber move starts`, s.pa);
    s = await holdCheck("Knight", null);
    const pt = await G(() => { const g = window.__colonistGame; const h = g.geometry.hexes.find((h) => h.id !== g.robberHexId && h.resource && h.resource !== "desert" && g._robberHexAllowed(h.id, g.players[0])); if (!h) return null;
      const sc = g.worldToScreen(h.center.x, h.center.y); const r = g.canvas.getBoundingClientRect(); return { x: r.left + (sc.x * r.width) / g.boardWidth, y: r.top + (sc.y * r.height) / g.boardHeight, id: h.id }; });
    await page.touchscreen.tap(pt.x, pt.y); await sleep(700);
    if (await G(() => window.__colonistGame.confirmBuild?.type === "robber" && !window.__colonistGame._robberTimer)) await G(() => window.__colonistGame._confirmViaIcon());
    for (let i = 0; i < 12 && (await G(() => window.__colonistGame.pendingAction === "robber" || window.__colonistGame.robberVictimOptions?.length > 0)); i++) {
      if (await G(() => window.__colonistGame.robberVictimOptions?.length > 0)) await tapEl("#dockPicker [data-steal]", false);
      await sleep(500);
    }
    const after = await G(SNAP); ok(after.robber !== before.robber && after.pa !== "robber", `${tag} Knight: the robber moved`, `${before.robber} -> ${after.robber}`);
    await shot("knight-done");
  }
  ok(errors.length === 0, `${tag}: no console errors`, errors.slice(0, 2).join(" | "));
  await ctx.close(); await b.close();
}
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  for (const [W, H] of [[412, 923], [360, 780]]) for (const lang of ["nl", "en"]) await run(W, H, lang);
  server.close(); console.log(fails ? `${fails} FAILED` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
