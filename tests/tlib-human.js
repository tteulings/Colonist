// shared helpers for the v1.02 review tests (CommonJS, playwright from the global modules)
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function newPage(browser, { seed = 1, speed = 25, palette = "light", viewport = { width: 360, height: 780 }, port = 9840 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  await page.addInitScript(({ seed, speed, palette }) => {
    if (!sessionStorage.getItem("keep")) localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", palette); localStorage.setItem("colonist.paletteAuto", "off");
    if (seed != null) { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    if (speed > 1) { const st = window.setTimeout, si = window.setInterval; window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) >= 4000 ? ms : (ms || 0) / speed, ...r); window.setInterval = (f, ms, ...r) => si(f, Math.max(1, (ms || 0) / speed), ...r); }
  }, { seed, speed, palette });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  return { ctx, page, errors };
}
/** Home screen → Classic (a real tap) */
async function startClassic(page) {
  const c = page.locator(".hm-start");
  await c.waitFor({ timeout: 10000 });
  await c.tap();
  await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, { timeout: 15000 });
}
/** In-page: one step of a "sloppy human" (handlers only, the way the buttons call them). Returns a tag. */
function humanStepFn() {
  window.__humanStep = (opt = {}) => {
    const g = window.__colonistGame;
    const me = g.players.find((p) => p.isHuman);
    if (g.winner) return "over";
    if (g.hsCoverOn != null) { g._hsAck(); return "cover"; }
    const rnd = window.__hr || (window.__hr = (() => { let a = opt.seed || 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })());
    if (g.pendingIncomingTrade) { g.resolveIncomingTrade(false); return "decline"; }
    if (g.pendingDiscard?.player?.isHuman) {
      const pd = g.pendingDiscard; const h = { ...pd.player.resources };
      ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { pd.selected[r] = 0; });
      for (let i = 0; i < pd.count; i++) { const r = ["wood", "brick", "sheep", "wheat", "ore"].sort((a, b) => h[b] - h[a])[0]; h[r]--; pd.selected[r]++; }
      g._confirmDiscard(); return "discard";
    }
    const cur = g.currentPlayer;
    if (!cur?.isHuman) return "wait";
    if (g.robberVictimOptions?.length) { g.stealFromVictim(cur, g.robberVictimOptions[0]); g.robberContext = null; g.robberVictimOptions = []; g.render(); return "victim"; }
    if (g.pendingAction === "robber") {
      const legal = g._legalRobberHexes(cur).map((h) => h.id);
      const hex = opt.badRobber && rnd() < 0.7 ? legal.find((id) => g.geometry.hexes[id].resource === "desert") ?? legal[0] : g.chooseRobberHex(cur);
      g._commitRobber(cur, hex); return "robber";
    }
    if (g.setupPhase) {
      if (g.setupAction === "settlement") { g._commitSetup(cur, { type: "settlement", id: g.getBestInitialSettlementNode(cur) }); return "setup-s"; }
      if (g.setupAction === "road") { const e = g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)); g._commitSetup(cur, { type: "road", id: e.id }); return "setup-r"; }
      return "wait";
    }
    if (g.phase === "pre_roll") { if (g.rollDiceBtn?.disabled) return "wait"; g.handleHumanRoll(); return "roll"; }
    if (g.phase !== "main" || g._robberInProgress() || g.devPick) return "wait";
    // main: sometimes play like the planner, sometimes sloppily
    const keep = cur.strategy; cur.strategy = { placement: "complex", expansion: "complex", trading: "balanced", devCards: "strategic", awareness: "advanced" };
    let plan; try { plan = g._aiPlan(cur); } finally { cur.strategy = keep; }
    const goal = plan.goals[0];
    const has = (c) => Object.entries(c).every(([r, n]) => cur.resources[r] >= n);
    const sloppy = rnd() < (opt.sloppy ?? 0.4);
    window.__acts = (window.__acts || 0) + 1;
    window.__dbg = { goal: goal && { type: goal.type, dist: goal.dist, cost: goal.cost }, hand: { ...cur.resources } };
    if (window.__acts % 12 === 0) { g.handleHumanEndTurn(); return "end"; }
    if (!sloppy && goal && goal.type === "city" && has(goal.cost)) { g._commitBuild(cur, { type: "city", id: goal.nodeId }); return "city"; }
    if (!sloppy && goal && goal.type === "settlement" && !goal.dist && has(goal.cost)) { g._commitBuild(cur, { type: "settlement", id: goal.nodeId }); return "sett"; }
    if (!sloppy && goal && goal.type === "settlement" && goal.dist && goal.edge != null && has({ wood: 1, brick: 1 })) { g._commitBuild(cur, { type: "road", id: goal.edge }); return "road"; }
    if (sloppy && has({ sheep: 1, wheat: 1, ore: 1 }) && rnd() < 0.5 && g.devDeck.length) { g.handleHumanBuyDevCard(); return "buy"; }
    if (cur.devCards.knight > 0 && !g.currentTurnPlayedDevCard && !sloppy && rnd() < 0.5) { g.handleHumanPlayDevCard("knight"); return "knight"; }
    g.handleHumanEndTurn(); return "end";
  };
}
async function playSloppy(page, opt = {}, maxMs = 240000) {
  await page.evaluate(humanStepFn);
  const t0 = Date.now();
  const tags = {};
  while (Date.now() - t0 < maxMs) {
    const r = await page.evaluate((o) => window.__humanStep(o), opt);
    tags[r] = (tags[r] || 0) + 1;
    if (r === "over") break;
    await sleep(r === "wait" ? 60 : 30);
  }
  return tags;
}
module.exports = { chromium, sleep, newPage, startClassic, playSloppy, humanStepFn };
