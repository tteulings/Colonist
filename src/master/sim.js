// v0.90 Master bot (ISMCTS), search helpers: snapshot / restore of the engine state, a fresh
// determinization of what the searching seat cannot see, a static evaluation, and policy rollouts.
// Ported from the research branch (research/sim.mjs, measured there). Runs on a private headless copy of
// the game (the Web Worker in src/master/worker.js, or the Node harness), never on the game you play.
export const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
export const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
export const hasResources = (res, cost) => Object.entries(cost).every(([t, a]) => res[t] >= a);
export const sumResources = (r) => RESOURCES.reduce((a, k) => a + r[k], 0);
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const SCAL = ["turn", "currentPlayerIndex", "phase", "longestRoadHolder", "largestArmyHolder", "currentTurnPlayedDevCard",
  "freeRoadsRemaining", "lastRoll", "lastDiceTotal", "turnSerial", "robberHexId", "pendingAction", "devPlayed", "tradeLocked", "robberContext", "pendingRobberFlow",
  "setupStep", "setupPhase", "setupAction", "lastSetupNodeId"];
const PNUM = ["devVictoryPoints", "knightsPlayed", "longestRoadLength", "victoryPoints", "publicVictoryPoints"];

export function snapshot(g) {
  const nodes = g.geometry.nodes, edges = g.geometry.edges;
  const no = new Int8Array(nodes.length), ns = new Int8Array(nodes.length), eo = new Int8Array(edges.length);
  for (let i = 0; i < nodes.length; i++) { no[i] = nodes[i].owner ?? -1; ns[i] = nodes[i].structure === "city" ? 2 : nodes[i].structure === "settlement" ? 1 : 0; }
  for (let i = 0; i < edges.length; i++) eo[i] = edges[i].owner ?? -1;
  return { no, ns, eo, bank: { ...g.bank }, devDeck: g.devDeck.slice(), winner: g.winner ? g.winner.id : -1, sc: SCAL.map((k) => g[k]),
    trk: g._aiCardTrack?.players === g.players ? g._aiCardTrack.est.map((e) => ({ ...e })) : null,
    pl: g.players.map((p) => ({ res: { ...p.resources }, roads: [...p.roads], sett: [...p.settlements], cities: [...p.cities], dev: { ...p.devCards }, nd: { ...p.newDevCards }, num: PNUM.map((k) => p[k]), strategy: p.strategy, agent: p.agent })) };
}

export function restore(g, s) {
  const nodes = g.geometry.nodes, edges = g.geometry.edges;
  for (let i = 0; i < nodes.length; i++) { const o = s.no[i]; nodes[i].owner = o < 0 ? null : o; nodes[i].structure = s.ns[i] === 2 ? "city" : s.ns[i] === 1 ? "settlement" : null; }
  for (let i = 0; i < edges.length; i++) edges[i].owner = s.eo[i] < 0 ? null : s.eo[i];
  g.bank = { ...s.bank }; g.devDeck = s.devDeck.slice(); g.winner = s.winner < 0 ? null : g.players[s.winner];
  SCAL.forEach((k, i) => { g[k] = s.sc[i]; });
  if (s.trk) g._aiCardTrack = { players: g.players, est: s.trk.map((e) => ({ ...e })) }; else g._aiCardTrack = null;
  g.players.forEach((p, i) => { const q = s.pl[i]; p.resources = { ...q.res }; p.roads = new Set(q.roads); p.settlements = new Set(q.sett); p.cities = new Set(q.cities);
    p.devCards = { ...q.dev }; p.newDevCards = { ...q.nd }; PNUM.forEach((k, j) => { p[k] = q.num[j]; }); p.strategy = q.strategy; p.agent = q.agent; });
  if (g.placementAnims) g.placementAnims.length = 0;
}

/** Resample what `me` cannot see: opponents' hand compositions (from the public card tracker, hand sizes
 *  kept), opponents' unplayed dev cards + hidden VP cards, and the dev deck order. */
export function determinize(g, me, rng) {
  g.players.forEach((p) => {
    if (p.id === me) return;
    const n = sumResources(p.resources);
    if (!n) return;
    const est = g._aiEstimate(p);
    RESOURCES.forEach((r) => { g.bank[r] += p.resources[r]; p.resources[r] = 0; });
    for (let k = 0; k < n; k++) {
      let tot = 0; const w = RESOURCES.map((r) => { const x = g.bank[r] > 0 ? Math.max(0.05, est[r] - p.resources[r]) : 0; tot += x; return x; });
      let u = rng() * tot, j = 0; while (j < 4 && u >= w[j]) { u -= w[j]; j++; }
      const r = RESOURCES[j]; p.resources[r]++; g.bank[r]--;
    }
  });
  const pool = g.devDeck.slice();
  const counts = [];
  g.players.forEach((p) => {
    if (p.id === me) return;
    const c = { dev: {}, nd: {}, vp: p.devVictoryPoints };
    DEV_CARD_TYPES.forEach((t) => { c.dev[t] = p.devCards[t]; c.nd[t] = p.newDevCards[t]; for (let k = 0; k < p.devCards[t] + p.newDevCards[t]; k++) pool.push(t); p.devCards[t] = 0; p.newDevCards[t] = 0; });
    for (let k = 0; k < p.devVictoryPoints; k++) pool.push("victoryPoint");
    p.victoryPoints -= p.devVictoryPoints; p.devVictoryPoints = 0;
    counts.push([p, c]);
  });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  counts.forEach(([p, c]) => {
    const deal = (into, n) => { for (let k = 0; k < n; k++) { const t = pool.pop(); if (t === "victoryPoint") { p.devVictoryPoints++; p.victoryPoints++; } else into[t]++; } };
    deal(p.devCards, DEV_CARD_TYPES.reduce((a, t) => a + c.dev[t], 0));
    deal(p.newDevCards, DEV_CARD_TYPES.reduce((a, t) => a + c.nd[t], 0));
    deal(p.devCards, c.vp);
  });
  g.devDeck = pool;
}

/** Static value of the position for each seat (VP-equivalents): VP + production over the turns left + a
 *  small hand / dev-card term. */
export function seatValues(g, handW = 0.06) {
  const W = g.constructor.labHelpers.AI_PLAN_WEIGHTS, R = g.players.length, wp = g.winPoints;
  const lead = Math.max(...g.players.map((p) => p.victoryPoints));
  const tLeft = Math.max(2, Math.min(16, (wp - lead) * 2.2));
  return g.players.map((p) => {
    const inc = g._aiIncome(p);
    let prod = 0; RESOURCES.forEach((r) => { prod += inc[r]; });
    const hand = Math.min(sumResources(p.resources), 9) * handW;
    const dev = DEV_CARD_TYPES.reduce((a, t) => a + p.devCards[t] + p.newDevCards[t], 0) * 0.25;
    return p.victoryPoints + prod * R * tLeft * W.prodVPPerCard + hand + dev;
  });
}

/** The searching seat's win chance at the end of a rollout: 1 / 0 on a real win, else a softmax of the
 *  seat values (temperature T). */
export function winProb(g, me, T = 1.2) {
  if (g.winner) return g.winner.id === me ? 1 : 0;
  const v = seatValues(g);
  const mx = Math.max(...v);
  let z = 0; v.forEach((x) => { z += Math.exp((x - mx) / T); });
  return Math.exp((v[me] - mx) / T) / z;
}

/** Play `turns` turn ends with every seat's normal policy (lab weights jittered ±jitter for variety). */
export function rollout(g, turns, rng, { jitter = 0.15, maxRounds = 250 } = {}) {
  const orig = Math.random; Math.random = rng;
  const ownDice = Object.prototype.hasOwnProperty.call(g, "rollDice"), saveDice = g.rollDice;
  g.rollDice = function () { const d1 = 1 + Math.floor(rng() * 6), d2 = 1 + Math.floor(rng() * 6); this.lastDiceTotal = d1 + d2; return { total: d1 + d2, d1, d2 }; };
  const keep = g.players.map((p) => [p.strategy, p.agent]);
  g.players.forEach((p) => { p.agent = null; if (jitter) { const w = { ...(p.strategy.w || {}) }; ["num", "variety", "scarcity", "port", "road", "prod", "patience", "card", "leader"].forEach((k) => { w[k] = (w[k] ?? 1) * Math.exp((rng() * 2 - 1) * jitter); }); p.strategy = { ...p.strategy, w }; } });
  try {
    let ended = 0;
    while (!g.winner && g.turn <= maxRounds) {
      const p = g.currentPlayer;
      if (g.phase === "pre_roll") { g.maybePlayKnightBeforeRoll(p); g.executeRollPhase(p); }
      if (g.winner) break;
      if (g.phase === "main") g.executeAiMainPhase(p);
      if (g.winner) break;
      g.endTurn();
      if (++ended >= turns) break;
    }
  } finally {
    Math.random = orig;
    if (ownDice) g.rollDice = saveDice; else delete g.rollDice;
    g.players.forEach((p, i) => { p.strategy = keep[i][0]; p.agent = keep[i][1]; });
  }
}

/** Run fn with every seat's agent off (searches simulate the plain bots and never nest a search). */
export function withoutAgents(g, fn) {
  const keep = g.players.map((p) => p.agent);
  g.players.forEach((p) => { p.agent = null; });
  try { return fn(); } finally { g.players.forEach((p, i) => { p.agent = keep[i]; }); }
}
