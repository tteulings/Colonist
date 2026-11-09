// v0.90 Master bot (ISMCTS), search helpers: snapshot / restore of the engine state, a fresh
// determinization of what the searching seat cannot see, a static evaluation, and policy rollouts.
// Ported from the research branch (research/sim.mjs, measured there). Runs on a private headless copy of
// the game (the Web Worker in src/master/worker.js, or the Node harness), never on the game you play.
import { FIT_W } from "./leaf-fit.js";
export const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
export const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
export const hasResources = (res, cost) => Object.entries(cost).every(([t, a]) => res[t] >= a);
export const sumResources = (r) => RESOURCES.reduce((a, k) => a + r[k], 0);
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const SCAL = ["turn", "currentPlayerIndex", "phase", "longestRoadHolder", "largestArmyHolder", "currentTurnPlayedDevCard",
  "freeRoadsRemaining", "lastRoll", "lastDiceTotal", "turnSerial", "robberHexId", "pendingAction", "devPlayed", "tradeLocked", "robberContext", "pendingRobberFlow",
  "setupStep", "setupPhase", "setupAction", "lastSetupNodeId",
  "lastDice", "lastRollPlayer", "highlightRoll", "_stMover"]; // eng-124: the roll's display / stats fields too (kept by reference: the engine replaces them, never edits them)
const PNUM = ["devVictoryPoints", "knightsPlayed", "longestRoadLength", "victoryPoints", "publicVictoryPoints"];

export function snapshot(g) {
  const nodes = g.geometry.nodes, edges = g.geometry.edges;
  const no = new Int8Array(nodes.length), ns = new Int8Array(nodes.length), eo = new Int8Array(edges.length);
  for (let i = 0; i < nodes.length; i++) { no[i] = nodes[i].owner ?? -1; ns[i] = nodes[i].structure === "city" ? 2 : nodes[i].structure === "settlement" ? 1 : 0; }
  for (let i = 0; i < edges.length; i++) eo[i] = edges[i].owner ?? -1;
  // v1.19 Seafarers: ships (edge flag + player set), pirate, this turn's ship moves, island bonuses, pending gold picks
  const sea = g.sea ? { es: Uint8Array.from(edges, (e) => (e.ship ? 1 : 0)), pirate: g.sea.pirateHexId, built: [...g.sea.builtThisTurn], moved: [...g.sea.moved], bonus: JSON.parse(JSON.stringify(g.sea.bonus)), bonusNode: { ...g.sea.bonusNode }, gold: JSON.parse(JSON.stringify(g.sea.gold)), thief: g.sea.thief } : null;
  return { sea, sbp: g.sbp ? JSON.parse(JSON.stringify(g.sbp)) : null, no, ns, eo, bank: { ...g.bank }, devDeck: g.devDeck.slice(), winner: g.winner ? g.winner.id : -1, sc: SCAL.map((k) => g[k]),
    rh: g.rollHistory ? { ...g.rollHistory } : null, // eng-124: edited in place by every roll (and saved with the game)
    trk: g._aiCardTrack?.players === g.players ? g._aiCardTrack.est.map((e) => ({ ...e })) : null,
    pl: g.players.map((p) => ({ res: { ...p.resources }, roads: [...p.roads], sett: [...p.settlements], cities: [...p.cities], ships: p.ships ? [...p.ships] : null, dev: { ...p.devCards }, nd: { ...p.newDevCards }, num: PNUM.map((k) => p[k]), strategy: p.strategy, agent: p.agent })) };
}

export function restore(g, s) {
  const nodes = g.geometry.nodes, edges = g.geometry.edges;
  for (let i = 0; i < nodes.length; i++) { const o = s.no[i]; nodes[i].owner = o < 0 ? null : o; nodes[i].structure = s.ns[i] === 2 ? "city" : s.ns[i] === 1 ? "settlement" : null; }
  for (let i = 0; i < edges.length; i++) edges[i].owner = s.eo[i] < 0 ? null : s.eo[i];
  if (s.sea && g.sea) {
    for (let i = 0; i < edges.length; i++) edges[i].ship = !!s.sea.es[i];
    const q = g.sea; q.pirateHexId = s.sea.pirate; q.builtThisTurn = new Set(s.sea.built); q.moved = new Set(s.sea.moved);
    q.bonus = JSON.parse(JSON.stringify(s.sea.bonus)); q.bonusNode = { ...s.sea.bonusNode }; q.gold = JSON.parse(JSON.stringify(s.sea.gold)); q.thief = s.sea.thief;
  }
  g.sbp = s.sbp ? JSON.parse(JSON.stringify(s.sbp)) : null; // 5–6 players: a build window is never open at a decision, but a cut-off rollout must not leave one behind
  g.bank = { ...s.bank }; g.devDeck = s.devDeck.slice(); g.winner = s.winner < 0 ? null : g.players[s.winner];
  SCAL.forEach((k, i) => { g[k] = s.sc[i]; });
  if (s.rh) g.rollHistory = { ...s.rh };
  if (s.trk) g._aiCardTrack = { players: g.players, est: s.trk.map((e) => ({ ...e })) }; else g._aiCardTrack = null;
  g.players.forEach((p, i) => { const q = s.pl[i]; p.resources = { ...q.res }; p.roads = new Set(q.roads); p.settlements = new Set(q.sett); p.cities = new Set(q.cities); if (q.ships) p.ships = new Set(q.ships);
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

/** v1.05: the same softmax for every seat at once (the review's stacked win-chance bar); same numbers as winProb. */
export function winProbs(g, T = 1.2) {
  if (g.winner) return g.players.map((p) => (p.id === g.winner.id ? 1 : 0));
  const v = seatValues(g);
  const mx = Math.max(...v);
  const e = v.map((x) => Math.exp((x - mx) / T));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}

/** Play `turns` turn ends with every seat's normal policy (lab weights jittered ±jitter for variety). */
export function rollout(g, turns, rng, { jitter = 0.15, maxRounds = 250 } = {}) {
  const orig = Math.random; Math.random = rng;
  const ownDice = Object.prototype.hasOwnProperty.call(g, "rollDice"), saveDice = g.rollDice;
  g.rollDice = function () { const d1 = 1 + Math.floor(rng() * 6), d2 = 1 + Math.floor(rng() * 6); this.lastDiceTotal = d1 + d2; return { total: d1 + d2, d1, d2 }; };
  const keep = g.players.map((p) => [p.strategy, p.agent]);
  g.players.forEach((p) => { p.agent = null; if (jitter) { const w = { ...(p.strategy.w || {}) }; ["num", "variety", "scarcity", "port", "road", "prod", "patience", "card", "leader"].forEach((k) => { w[k] = (w[k] ?? 1) * Math.exp((rng() * 2 - 1) * jitter); }); p.strategy = { ...p.strategy, w }; } });
  g._planMemo = []; // eng-130: the plan memo (game.js _aiPlan), fresh for this rollout
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
    g._planMemo = null;
    Math.random = orig;
    if (ownDice) g.rollDice = saveDice; else delete g.rollDice;
    g.players.forEach((p, i) => { p.strategy = keep[i][0]; p.agent = keep[i][1]; });
  }
}

/** Run fn with every seat's agent off (searches simulate the plain bots and never nest a search).
 *  eng-124: and with the timers muted (unless g._searchTimers): endTurn() and friends schedule window.setTimeout every turn
 *  (UI ticks); in a synchronous search they cannot fire before the search ends, then fire on a restored position, and they pile
 *  up (~80 per playout, ~33 KB of heap each playout in a long headless run). Nothing in the game rules waits on them. */
const NO_TIMER = () => 0;
export function withoutAgents(g, fn) {
  const keep = g.players.map((p) => p.agent);
  const T = globalThis, st = T.setTimeout, si = T.setInterval, quiet = !g._searchTimers;
  g.players.forEach((p) => { p.agent = null; });
  if (quiet) { T.setTimeout = NO_TIMER; T.setInterval = NO_TIMER; }
  try { return fn(); } finally { if (quiet) { T.setTimeout = st; T.setInterval = si; } g.players.forEach((p, i) => { p.agent = keep[i]; }); }
}

// ── v1.10 leaf function 'fit': per-seat features and a conditional-logit (generalised softmax) over the seats ──
// seatFeatures(g) → one vector per seat; fitValues(g, W) → seat scores w·f; the win chance is the softmax (T = 1) of those.
// W is fitted offline on bot games (scratchpad/step105/tests/fit.py) and shipped as FIT_W in src/master/leaf-fit.js.
export const FEATURE_NAMES = ["vp", "vp2", "incTot", "incTot*tLeft", "wood", "brick", "sheep", "wheat", "ore", "hand", "over7", "devHand", "knightsHand", "roadYop", "monoHand",
  "devVP", "knightsPlayed", "hasArmy", "armyGap", "roadLen", "hasRoad", "roadGap", "ports2", "port2match", "port3", "spots0", "spots1", "spots2", "diversity", "zeroRes", "robberLoss", "cities", "settlements", "roads"];
const hexNum = (n) => ({ 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[n] || 0) / 36;
const IDX_HAS_ROAD = FEATURE_NAMES.indexOf("hasRoad"), IDX_HAS_ARMY = FEATURE_NAMES.indexOf("hasArmy");
export function seatFeatures(g) {
  const G = g.geometry, wp = g.winPoints, lead = Math.max(...g.players.map((p) => p.victoryPoints));
  const tLeft = Math.max(2, Math.min(16, (wp - lead) * 2.2));
  const lim = (g.settings && g.settings.discardLimit) || 7;
  const maxKn = (id) => Math.max(0, ...g.players.filter((q) => q.id !== id).map((q) => q.knightsPlayed));
  const maxRd = (id) => Math.max(4, ...g.players.filter((q) => q.id !== id).map((q) => q.longestRoadLength));
  return g.players.map((p) => {
    const inc = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, full = { ...inc };
    const add = (n, amt) => G.nodes[n].adjacentHexes.forEach((hid) => {
      const h = G.hexes[hid]; if (!h.number || h.resource === "desert") return;
      const v = hexNum(h.number) * amt; full[h.resource] += v; if (hid !== g.robberHexId) inc[h.resource] += v;
    });
    p.settlements.forEach((n) => add(n, 1)); p.cities.forEach((n) => add(n, 2));
    const incTot = RESOURCES.reduce((a, r) => a + inc[r], 0), fullTot = RESOURCES.reduce((a, r) => a + full[r], 0);
    const hand = sumResources(p.resources);
    const dv = (t) => p.devCards[t] + p.newDevCards[t];
    let ports2 = 0, p2m = 0, p3 = 0;
    RESOURCES.forEach((r) => { const rt = g.getPlayerTradeRate(p, r); if (rt === 2) { ports2++; p2m += inc[r]; } else if (rt === 3) p3 = 1; });
    // free building spots: 0 / 1 / 2 roads away from the network (distance rule: no building next to it)
    const net = new Set([...p.settlements, ...p.cities]);
    p.roads.forEach((e) => G.edges[e].nodes.forEach((n) => net.add(n)));
    const spot = (n) => G.nodes[n].owner == null && G.nodes[n].neighbors.every((m) => G.nodes[m].owner == null);
    const seen = new Map(); net.forEach((n) => seen.set(n, 0));
    let fr = [...net];
    for (let d = 1; d <= 2; d++) {
      const nx = [];
      fr.forEach((n) => G.nodes[n].edgeIds.forEach((e) => {
        const ed = G.edges[e]; if (ed.owner != null && ed.owner !== p.id) return;
        const m = ed.nodes[0] === n ? ed.nodes[1] : ed.nodes[0];
        if (seen.has(m) || (G.nodes[m].owner != null && G.nodes[m].owner !== p.id)) return;
        seen.set(m, d); nx.push(m);
      }));
      fr = nx;
    }
    const cnt = [0, 0, 0]; seen.forEach((d, n) => { if (spot(n)) cnt[d] += 1; });
    const kn = p.knightsPlayed;
    return [p.victoryPoints, (p.victoryPoints * p.victoryPoints) / 10, incTot, (incTot * tLeft) / 4, ...RESOURCES.map((r) => inc[r]), Math.min(hand, 9) / 4, hand > lim ? 1 : 0,
      dv("knight") + dv("roadBuilding") + dv("yearOfPlenty") + dv("monopoly"), dv("knight"), dv("roadBuilding") + dv("yearOfPlenty"), dv("monopoly"), p.devVictoryPoints,
      kn, g.largestArmyHolder === p.id ? 1 : 0, Math.max(-3, Math.min(3, kn - maxKn(p.id))), p.longestRoadLength / 2, g.longestRoadHolder === p.id ? 1 : 0, Math.max(-4, Math.min(4, p.longestRoadLength - maxRd(p.id))),
      ports2, p2m, p3, Math.min(cnt[0], 4), Math.min(cnt[1], 4), Math.min(cnt[2], 4), RESOURCES.filter((r) => inc[r] > 0.02).length, RESOURCES.filter((r) => inc[r] <= 0.02).length,
      fullTot - incTot, p.cities.size, p.settlements.size, p.roads.size];
  });
}

/** Win chances from the fitted score function (softmax of w·features over the seats).
 *  v1.19 `adj` (leaf 'fit2', see FIT2_ADJ in leaf-fit.js): a stage-scaled score offset for holding Longest Road / Largest Army.
 *  The fit weights are fitted on whole games, where a holder is also the stronger player; two moves compared in the same future
 *  differ only in who holds the award at the horizon, and there the fit over-credits it (measured against the game played out). */
export function fitProbs(g, W = FIT_W, adj = null) {
  if (g.winner) return g.players.map((p) => (p.id === g.winner.id ? 1 : 0));
  const F = seatFeatures(g);
  const sc = F.map((f) => { let t = 0; for (let i = 0; i < W.length; i++) t += W[i] * f[i]; return t; });
  if (adj) {
    const lead = Math.max(...g.players.map((p) => p.victoryPoints));
    const stage = (Math.max(2, Math.min(16, (g.winPoints - lead) * 2.2)) - 2) / 14; // 0 near the end, 1 far from it (as tLeft in seatFeatures)
    F.forEach((f, i) => { sc[i] += stage * (adj.lr * f[IDX_HAS_ROAD] + (adj.la || 0) * f[IDX_HAS_ARMY]); });
  }
  const mx = Math.max(...sc), e = sc.map((x) => Math.exp(x - mx)), z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}
