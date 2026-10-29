// v0.90 Master bot: information-set Monte Carlo search at the root (ported from research/ismcts.mjs, where
// it measured +11 pp over Expert against 3 Experts). It starts from the Expert's own pick and a few
// alternatives, plays each one into the same random futures (common random numbers: future j re-deals the
// hidden cards and fixes the dice the same way for every candidate), lets the normal bots play 8 turns
// (12 in set-up), and scores the end position as a win chance. Successive halving drops the weakest after
// each round. It overrides the Expert only when the paired gain over the Expert's pick (same futures) beats
// one standard error.
//
// Every decision returns its whole race (per-future results, rounds, eliminations, paired gaps), so the
// game can show how the choice was made, step by step.
//
// Decisions searched: the set-up spot, main-phase build / trade-then-build / dev-card play / end turn, and
// the robber tile. Player-to-player trades, discards and the pre-roll Knight stay with the Expert.
import { DEV_CARD_TYPES, hasResources, mulberry32, snapshot, restore, determinize, rollout, winProb, withoutAgents } from "./sim.js";

export const MASTER_OPTS = { n: 100, timeMs: 0, depth: 8, setupDepth: 12, z: 1.0, minAdv: 0.002, jitter: 0.15, T: 1.2, topSetup: 6, topRobber: 4, maxCands: 7 };
const RES = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const DEV = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r4 = (v) => Math.round(v * 1e4) / 1e4;

export function makeMaster(opts = {}) {
  const o = { ...MASTER_OPTS, ...opts };
  const stats = { decisions: 0, deviations: 0, ms: [], setupMs: [], robMs: [], mainMs: [], rollouts: 0, chose: {} };
  const agent = { name: "master", stats, busy: false, last: null, opts: o };
  let rng = null;
  const seedRng = (g, p) => { rng = mulberry32((g.turn * 7919 + p.id * 104729 + (g.turnSerial || 0) * 31 + (o.seed || 0)) | 0); };

  /** The race: every candidate into the same futures; successive halving; a budget of o.n rollouts or
   *  o.timeMs (whichever ends first, at least 2 futures each). Candidate 0 is the Expert's pick. */
  function search(g, me, cands, apply, depth) { return withoutAgents(g, () => search0(g, me, cands, apply, depth)); }
  function search0(g, me, cands, apply, depth) {
    const t0 = now();
    const deadline = o.timeMs ? t0 + o.timeMs : Infinity;
    const root = snapshot(g);
    const K = cands.length;
    const vals = cands.map(() => []), vps = cands.map(() => []);
    const orig = Math.random;
    agent.busy = true;
    const base = Math.floor(rng() * 2 ** 31);
    const evalOne = (k, j) => {
      const r = mulberry32(base + j * 7919);
      Math.random = r;
      restore(g, root);
      determinize(g, me, r);
      const a = apply(g, cands[k]);
      let v = 0;
      if (a !== false) { if (!g.winner) rollout(g, a === "ended" ? depth - 1 : depth, r, { jitter: o.jitter }); v = winProb(g, me, o.T); }
      vals[k][j] = v;
      vps[k][j] = g.players[me].victoryPoints;
    };
    const rounds = [];
    let used = 0, stop = "n";
    try {
      let alive = cands.map((_, i) => i);
      const R = Math.max(1, Math.ceil(Math.log2(K)));
      let j0 = 0;
      for (let r = 0; r < R && alive.length; r++) {
        const per = Math.max(1, Math.floor((o.n / R) / alive.length));
        let j = j0;
        for (; j < j0 + per && used < o.n * 1.05; j++) {
          if (j >= 2 && now() > deadline) { stop = "time"; break; }
          for (const k of alive) { evalOne(k, j); used++; }
        }
        const rec = { j0, j1: j, alive: alive.slice(), out: [] };
        rounds.push(rec);
        j0 = j;
        if (stop === "time") break;
        if (r < R - 1) {
          const mean = (k) => vals[k].reduce((a, b) => a + b, 0) / vals[k].length;
          const keep = Math.max(2, Math.ceil(alive.length / 2));
          const sorted = alive.slice().sort((a, b) => mean(b) - mean(a));
          let next = sorted.slice(0, keep);
          if (!next.includes(0)) next.push(0); // the Expert's pick always stays for the final paired test
          rec.out = alive.filter((k) => !next.includes(k));
          alive = next;
        }
      }
    } finally { restore(g, root); Math.random = orig; agent.busy = false; }
    stats.rollouts += used;
    // paired comparison against the Expert's pick on the futures both played
    let pick = 0, bestAdv = 0;
    const paired = cands.map((_, k) => {
      if (k === 0) return { m: 0, se: 0, n: vals[0].filter((v) => v != null).length };
      const d = []; vals[k].forEach((v, j) => { if (v != null && vals[0][j] != null) d.push(v - vals[0][j]); });
      if (d.length < 2) return { m: d[0] || 0, se: Infinity, n: d.length };
      const m = d.reduce((a, b) => a + b, 0) / d.length;
      const se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1) / d.length);
      if (m > o.z * se + o.minAdv && m > bestAdv) { bestAdv = m; pick = k; }
      return { m, se, n: d.length };
    });
    const ms = now() - t0;
    stats.ms.push(ms);
    return { K, vals: vals.map((v) => v.map((x) => (x == null ? null : r4(x)))), vps: vps.map((v) => v.slice()), rounds, pick, paired: paired.map((p) => ({ m: r4(p.m), se: Number.isFinite(p.se) ? r4(p.se) : null, n: p.n })),
      rule: { z: o.z, minAdv: o.minAdv }, ms: Math.round(ms), rollouts: used, budget: { n: o.n, timeMs: o.timeMs }, stop, depth };
  }

  // ── what a candidate does, in words, and where it is on the board ──
  const diffOf = (g, p, before) => {
    const pl = before.pl[p.id];
    const sett = [...p.settlements].filter((n) => !pl.sett.includes(n));
    const cities = [...p.cities].filter((n) => !pl.cities.includes(n));
    const roads = [...p.roads].filter((e) => !pl.roads.includes(e));
    const devBought = Object.values(p.devCards).reduce((a, b) => a + b, 0) + Object.values(p.newDevCards).reduce((a, b) => a + b, 0)
      - Object.values(pl.dev).reduce((a, b) => a + b, 0) - Object.values(pl.nd).reduce((a, b) => a + b, 0);
    const res = {};
    Object.keys(RES).forEach((r) => { res[r] = p.resources[r] - pl.res[r]; });
    return { sett, cities, roads, devBought, res };
  };
  const sig = (g, p) => `${[...p.settlements].sort()}|${[...p.cities].sort()}|${[...p.roads].sort()}|${JSON.stringify(p.resources)}|${JSON.stringify(p.devCards)}|${JSON.stringify(p.newDevCards)}`;
  const tradeText = (tr) => {
    const give = {}, get = {};
    tr.forEach(([a, b]) => { give[a] = (give[a] || 0) + 1; get[b] = (get[b] || 0) + 1; });
    return `${Object.keys(give).map((r) => RES[r]).join(" + ")} → ${Object.entries(get).map(([r, n]) => `${n} ${RES[r]}`).join(" + ")}`;
  };
  const goalName = (g, goal) => (goal.type === "settlement" ? `Settlement ${g._spotLabel(goal.nodeId)}${goal.dist ? ` +${goal.dist} road${goal.dist > 1 ? "s" : ""}` : ""}`
    : goal.type === "city" ? `City on ${g._spotLabel(goal.nodeId)}` : goal.type === "road" ? "Longest Road" : goal.type === "dev" ? "Dev card" : goal.label);
  const goalFocus = (goal) => (goal.type === "settlement" ? { node: goal.nodeId } : goal.type === "city" ? { city: goal.nodeId } : goal.type === "road" && goal.edge != null ? { edge: goal.edge } : null);
  const describeDiff = (g, p, dif, plan) => {
    if (dif.cities.length) return { label: `City on ${g._spotLabel(dif.cities[0])}`, focus: { city: dif.cities[0] } };
    if (dif.sett.length) return { label: `Settlement ${g._spotLabel(dif.sett[0])}`, focus: { node: dif.sett[0] } };
    if (dif.roads.length) {
      const g0 = plan.goals[0];
      if (g0?.type === "settlement" && g0.dist > 0) return { label: `Road toward ${g._spotLabel(g0.nodeId)}`, focus: { edge: dif.roads[0], node: g0.nodeId } };
      return { label: g0?.type === "road" ? "Road (Longest Road)" : "Road", focus: { edge: dif.roads[0] } };
    }
    if (dif.devBought > 0) return { label: "Dev card", focus: null };
    const gave = Object.keys(RES).filter((r) => dif.res[r] < 0), got = Object.keys(RES).filter((r) => dif.res[r] > 0);
    if (gave.length && got.length) return { label: `Bank trade ${gave.map((r) => RES[r]).join(" + ")} → ${got.map((r) => RES[r]).join(" + ")}`, focus: null };
    return null;
  };

  // ── set-up: the Expert's top spots ──
  agent.decideSetup = (g, p, base) => {
    const def = base(p);
    const ids = [def, ...g._aiSetupCandidates(p).sort((a, b) => b.score - a.score).map((c) => c.id).filter((id) => id !== def)].slice(0, o.topSetup);
    if (ids.length <= 1 || def == null) return null;
    seedRng(g, p);
    stats.decisions++;
    const rec = search(g, p.id, ids, (gg, node) => {
      const once = { used: false };
      const save = Object.prototype.hasOwnProperty.call(gg, "getBestInitialSettlementNode") ? gg.getBestInitialSettlementNode : null;
      gg.getBestInitialSettlementNode = (q) => { if (!once.used && q.id === p.id) { once.used = true; return node; } return base(q); };
      try { gg.processSetupQueue(); } finally { if (save) gg.getBestInitialSettlementNode = save; else delete gg.getBestInitialSettlementNode; }
      return true;
    }, o.setupDepth);
    stats.setupMs.push(rec.ms);
    if (rec.pick !== 0) stats.deviations++;
    rec.kind = "setup";
    rec.cands = ids.map((id) => ({ c: { kind: "spot", node: id }, label: `Spot ${g._spotLabel(id)}`, focus: { node: id } }));
    agent.last = rec;
    return { choice: ids[rec.pick], record: rec };
  };

  // ── robber: the Expert's top tiles ──
  agent.decideRobber = (g, p) => {
    const all = g._aiRobberCandidates(p).sort((a, b) => b.score - a.score);
    const def = g.chooseRobberHex(p);
    const ids = [def, ...all.map((c) => c.id).filter((id) => id !== def)].slice(0, o.topRobber);
    if (ids.length <= 1) return null;
    seedRng(g, p);
    stats.decisions++;
    const rec = search(g, p.id, ids, (gg, hex) => { gg.moveRobberAndSteal(gg.players[p.id], hex); return true; }, o.depth);
    stats.robMs.push(rec.ms);
    if (rec.pick !== 0) stats.deviations++;
    rec.kind = "robber";
    rec.cands = ids.map((id) => ({ c: { kind: "hex", hex: id }, label: `Robber on ${g._hexName(id)}`, focus: { hex: id } }));
    agent.last = rec;
    return { choice: ids[rec.pick], record: rec };
  };

  // ── main phase: the Expert's next step, end turn, each affordable build, trade-then-build, dev cards ──
  const findGoal = (plan, key) => plan.goals.find((x) => x.type === key.type && (x.nodeId ?? null) === (key.nodeId ?? null) && (x.edge ?? null) === (key.edge ?? null) && (x.via ?? null) === (key.via ?? null));
  const keyOf = (goal) => ({ type: goal.type, nodeId: goal.nodeId ?? null, edge: goal.edge ?? null, via: goal.via ?? null });
  const mainCands = (g, p) => {
    const plan = g._aiPlan(p);
    const out = [{ kind: "policy" }, { kind: "end" }];
    if (!g.currentTurnPlayedDevCard) DEV_CARD_TYPES.forEach((t) => { if (g.canPlayDevelopmentCard(p, t)) out.push({ kind: "dev", t }); });
    plan.goals.forEach((goal, i) => {
      const step = g._aiStepCost(goal);
      if (hasResources(p.resources, step)) out.push({ kind: "build", i, g: keyOf(goal) });
      else if (plan.rates && i < 3) {
        const next = plan.goals.find((x) => x !== goal)?.cost || {};
        const tr = g._aiTradesToComplete(p.resources, step, plan.rates, next);
        if (tr && tr.length) out.push({ kind: "tradebuild", i, tr, g: keyOf(goal) });
      }
    });
    return { plan, cands: out };
  };
  /** Apply a main-phase candidate. true: done; false: illegal; "noop": the Expert's step does nothing
   *  (it would end its turn). */
  const applyMain = (g, p, c) => {
    if (c.kind === "end") return true;
    if (c.kind === "policy") return g._aiPlannedStep(p) ? true : "noop";
    if (c.kind === "dev") return g.playDevelopmentCard(p, c.t) !== false;
    const goal = findGoal(g._aiPlan(p), c.g);
    if (!goal) return false;
    if (c.kind === "tradebuild") for (const [give, get] of c.tr) if (!g.performBankTrade(p, give, get)) return false;
    return g._aiTryGoal(p, goal) ? true : false;
  };
  agent.applyMain = applyMain;
  /** Name each candidate and drop exact duplicates of an earlier one (same pieces, same hand: e.g. the
   *  Expert's step IS "build the city"); the Expert's step stays first. */
  const labelMain = (g, p, plan, cs) => {
    const root = snapshot(g);
    const orig = Math.random;
    const out = [], seen = new Map();
    try {
      for (const c of cs) {
        Math.random = mulberry32(12345);
        restore(g, root);
        let label = null, focus = null, s = null;
        const r = withoutAgents(g, () => applyMain(g, p, c));
        if (r === false) continue;
        if (c.kind !== "dev") s = r === "noop" || c.kind === "end" ? "end" : sig(g, p);
        if (c.kind === "policy") {
          const d = r === "noop" ? null : describeDiff(g, p, diffOf(g, p, root), plan);
          label = d ? d.label : "End turn (saves its cards)"; focus = d?.focus || null;
        } else if (c.kind === "end") { label = "End turn"; }
        else if (c.kind === "dev") { label = `Play ${DEV[c.t]}`; }
        else {
          const goal = findGoal(plan, c.g);
          const gn = goal ? goalName(g, goal) : "Build";
          label = c.kind === "tradebuild" ? `Trade ${tradeText(c.tr)}, then ${gn}` : (goal?.type === "settlement" && goal.dist > 0 ? `Road toward ${g._spotLabel(goal.nodeId)}` : gn);
          focus = goal ? goalFocus(goal) : null;
          if (goal?.type === "settlement" && goal.dist > 0) focus = { node: goal.nodeId, edge: goal.edge };
        }
        if (s && seen.has(s)) continue; // same outcome as an earlier candidate
        if (s) seen.set(s, true);
        out.push({ c, label, focus });
      }
    } finally { restore(g, root); Math.random = orig; }
    return out.slice(0, o.maxCands);
  };
  /** One searched main-phase decision (not applied). null: nothing to choose between. */
  agent.decideMain = (g, p) => {
    const { plan, cands } = withoutAgents(g, () => mainCands(g, p));
    const named = labelMain(g, p, plan, cands);
    if (named.length <= 1) return null;
    seedRng(g, p);
    stats.decisions++;
    const rec = search(g, p.id, named.map((x) => x.c), (gg, c) => {
      const q = gg.players[p.id];
      if (c.kind === "end") { gg.endTurn(); return "ended"; }
      const r = applyMain(gg, q, c);
      if (r === "noop") { gg.endTurn(); return "ended"; }
      return r;
    }, o.depth);
    stats.mainMs.push(rec.ms);
    rec.kind = "main";
    rec.cands = named;
    agent.last = rec;
    const best = named[rec.pick].c;
    stats.chose[best.kind] = (stats.chose[best.kind] || 0) + 1;
    if (rec.pick !== 0) stats.deviations++;
    return { choice: best, record: rec };
  };

  // ── whole-game play (Web Worker tournaments, Node harness): synchronous hooks ──
  agent.setupNode = (g, p, base) => { const d = agent.decideSetup(g, p, base); return d ? d.choice : base(p); };
  agent.robberHex = (g, p) => { const d = agent.decideRobber(g, p); return d ? d.choice : g.chooseRobberHex(p); };
  agent.mainPhase = (g, p) => {
    if (!g.winner) g.aiTryPlayerTrade(p); // player-to-player offers: the Expert's own logic
    for (let step = 0; step < 12 && !g.winner; step++) {
      const d = agent.decideMain(g, p);
      if (!d) { if (!g._aiPlannedStep(p)) break; continue; }
      if (d.choice.kind === "end") break;
      const r = applyMain(g, p, d.choice);
      if (r === false || r === "noop") break;
    }
    g.recomputeScores(); g.checkForWinner(p);
  };
  return agent;
}

/** Make a constructed game headless and synchronous (the lab's "sim" stubs) and route a seat's set-up,
 *  robber and main phase to its agent (p.agent) when it has one. Plain bots are untouched. */
export function prepareEngine(g) {
  g._labBoot("sim");
  const noop = () => {};
  ["renderTopPanels", "renderResourceCards", "renderScoreboard", "renderLog", "renderStatusAndControls", "fitView", "_buildStrategyUI", "_applyThemeToPlayers", "hideTradePanel", "removeGameOverOverlay", "clearStorage", "_renderRushHud", "_renderRushOffers"].forEach((k) => { g[k] = noop; });
  g.boardRenderer = null;
  g.addLog = () => 0;
  g._stReset = function () { this.stats = null; }; g._stRestore = noop; g._stSave = () => null; g._stEv = noop; g._stRoll = noop; g._stTrade = noop;
  g.checkForWinner = ((orig) => function (p) { const r = orig.call(this, p); if (this.placementAnims) this.placementAnims.length = 0; return r; })(g.checkForWinner);
  const bestInit = g.getBestInitialSettlementNode.bind(g);
  const hookInit = (p) => (p.agent?.setupNode && !p.agent.busy ? p.agent.setupNode(g, p, bestInit) : bestInit(p));
  g.getBestInitialSettlementNode = hookInit;
  g._masterBaseInit = bestInit;
  const moveRobber = g.moveRobber.bind(g);
  g.moveRobber = (p) => { if (p.agent?.robberHex && !p.agent.busy) return g.moveRobberAndSteal(p, p.agent.robberHex(g, p)); return moveRobber(p); };
  const mainPhase = g.executeAiMainPhase.bind(g);
  g.executeAiMainPhase = (p, skip) => { if (p.agent?.mainPhase && !p.agent.busy) { p.agent.mainPhase(g, p); return "done"; } return mainPhase(p, skip); };
  return g;
}
