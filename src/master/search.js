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
import { DEV_CARD_TYPES, hasResources, mulberry32, snapshot, restore, determinize, rollout, winProb, winProbs, fitProbs, withoutAgents } from "./sim.js";
import { gbmProbs } from "./leaf-gbm.js";
import { GBM_MODEL } from "./leaf-gbm-model.js";
import { FIT2_ADJ } from "./leaf-fit.js";

export const MASTER_OPTS = { n: 100, timeMs: 0, depth: 8, setupDepth: 12, z: 1.0, minAdv: 0.002, jitter: 0.15, T: 1.2, topSetup: 6, topRobber: 4, maxCands: 7 };
const RES = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const DEV = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The best live move (mean) leads each other live move by more than z paired standard errors on >= nMin shared futures. */
function earlyLead(alive, vals, z, nMin) {
  const mean = (k) => { const v = vals[k].filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
  let best = alive[0], bm = mean(best);
  for (const k of alive) { const m = mean(k); if (m > bm) { best = k; bm = m; } }
  for (const k of alive) {
    if (k === best) continue;
    const d = []; vals[best].forEach((v, j) => { const w = vals[k][j]; if (v != null && w != null) d.push(v - w); });
    if (d.length < nMin) return false;
    const m = d.reduce((a, b) => a + b, 0) / d.length;
    const se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1) / d.length);
    if (!(m > z * se + 1e-9)) return false;
  }
  return true;
}

/** eng-130 Seafarers: pirate hexes that rob someone (legal for the mover, a rival's ship next to it). */
function pirateHexes(g, p) {
  if (!g.sea) return [];
  return g.sea.legalThiefHexes(p, "pirate").filter((h) => h.resource === "sea" && g.sea.shipVictims(h.id, p).length).map((h) => h.id);
}
/** eng-130 Seafarers: "Move a ship toward 6·9" (the land end of the edge it moves to, else just "Move a ship"). */
export function shipBuildLabel(g, p, to) {
  try {
    const e = g.geometry.edges[to];
    const land = e.nodes.find((n) => g.sea?.nodeIsLand(n) && g.geometry.nodes[n].owner !== p.id);
    return land != null ? `Ship toward ${g._spotLabel(land)}` : "Ship";
  } catch (_) { return "Ship"; }
}
export function shipMoveLabel(g, p, to) {
  try {
    const e = g.geometry.edges[to];
    const land = e.nodes.find((n) => g.sea?.nodeIsLand(n) && g.geometry.nodes[n].owner !== p.id);
    return land != null ? `Move a ship toward ${g._spotLabel(land)}` : "Move a ship";
  } catch (_) { return "Move a ship"; }
}

export function makeMaster(opts = {}) {
  const o = { ...MASTER_OPTS, ...opts };
  const stats = { decisions: 0, deviations: 0, ms: [], setupMs: [], robMs: [], mainMs: [], rollouts: 0, chose: {} };
  const agent = { name: "master", stats, busy: false, last: null, opts: o };
  let rng = null;
  const seedRng = (g, p) => { rng = mulberry32((g.turn * 7919 + p.id * 104729 + (g.turnSerial || 0) * 31 + (o.seed || 0)) | 0); };

  /** The race: every candidate into the same futures; successive halving; a budget of o.n rollouts or
   *  o.timeMs (whichever ends first, at least 2 futures each). Candidate 0 is the Expert's pick. */
  function search(g, me, cands, apply, depth) {
    const rec = withoutAgents(g, () => search0(g, me, cands, apply, depth));
    // v1.03 ADAPTIVE (review / "Super Expert" tests): a close call between the two best moves (paired gap
    // within adaptZ standard errors) is searched again with the deep budget (o.deep: { n, depth, setupDepth })
    if (!o.deep || !closeCall(rec, o.adaptZ ?? 2)) return rec;
    const keep = { n: o.n, timeMs: o.timeMs };
    o.n = o.deep.n; o.timeMs = o.deep.timeMs || 0;
    try {
      const d2 = depth === o.setupDepth ? (o.deep.setupDepth ?? o.deep.depth + 4) : (o.deep.depth ?? depth);
      const rec2 = withoutAgents(g, () => search0(g, me, cands, apply, d2));
      rec2.escalated = { ms: rec.ms, rollouts: rec.rollouts };
      rec2.ms += rec.ms; rec2.rollouts += rec.rollouts;
      stats.escalated = (stats.escalated || 0) + 1;
      return rec2;
    } finally { o.n = keep.n; o.timeMs = keep.timeMs; }
  }
  /** The two best moves of the last round are within z standard errors of each other (paired). */
  function closeCall(rec, z) {
    const last = rec.rounds[rec.rounds.length - 1];
    if (!last) return false;
    const alive = last.alive;
    if (alive.length < 2) return false;
    const mean = (k) => { const v = rec.vals[k].filter((x) => x != null); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
    const [a, b] = alive.slice().sort((x, y) => mean(y) - mean(x));
    const d = []; rec.vals[a].forEach((v, j) => { const w = rec.vals[b][j]; if (v != null && w != null) d.push(v - w); });
    if (d.length < 2) return true;
    const m = d.reduce((x, y) => x + y, 0) / d.length;
    const se = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / (d.length - 1) / d.length);
    return Math.abs(m) < z * se + 1e-9;
  }
  function search0(g, me, cands, apply, depth) {
    const t0 = now();
    // eng-130 o.rollClock (measurements only): the time budget counted in rollouts instead of ms (timeMs = rollouts), so a "3 s
    // on this device" search can be replayed exactly and machine-independently in the Node harness
    let used = 0;
    const clk = o.rollClock ? () => used : now;
    const c0 = o.rollClock ? 0 : t0;
    const deadline = o.timeMs ? c0 + o.timeMs : Infinity;
    const root = snapshot(g);
    const K = cands.length;
    const NB = o.nPer ? o.nPer * K : o.n; // eng-124 o.nPer (the review): the budget scales with the number of moves (o.nPer futures per move on average)
    const vals = cands.map(() => []), vps = cands.map(() => []), seatW = o.seats ? cands.map(() => []) : null; // v1.05 o.seats: every seat's win chance per future (review only)
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
      if (a !== false) {
        if (!g.winner && depth > 0) rollout(g, a === "ended" ? depth - 1 : depth, r, { jitter: o.jitter }); // (v1.42 depth 0: the leaf straight on the position, the review's Quick model)
        if (o.leaf === "gbm" || o.leaf === "gbm0") { const ws = gbmProbs(g, o.leaf === "gbm0" ? GBM_MODEL : null); v = ws[me]; if (seatW) seatW[k][j] = ws; } // eng-124 o.leaf 'gbm': boosted trees (src/master/leaf-gbm.js; the review's leaf); eng-130: the Seafarers model on a Seafarers board ('gbm0': always the island model, for measurements)
        else if (o.leaf === "fit" || o.leaf === "fit2") { const ws = fitProbs(g, undefined, o.leaf === "fit2" ? FIT2_ADJ : null); v = ws[me]; if (seatW) seatW[k][j] = ws; } // v1.10 o.leaf 'fit': the fitted score function; v1.19 'fit2': plus the Longest Road / Largest Army offset
        else if (seatW) { const ws = winProbs(g, o.T); v = ws[me]; seatW[k][j] = ws; } else v = winProb(g, me, o.T);
      }
      vals[k][j] = v;
      vps[k][j] = g.players[me].victoryPoints;
    };
    const rounds = [];
    let stop = "n";
    try {
      let alive = cands.map((_, i) => i);
      const R = o.noHalve ? 1 : Math.max(1, Math.ceil(Math.log2(K))); // o.noHalve: every candidate on every future (paired calibration)
      let j0 = 0;
      for (let r = 0; r < R && alive.length; r++) {
        const per = o.timeSlice ? 1e9 : Math.max(1, Math.floor((NB / R) / alive.length));
        let j = j0;
        // v1.09 experiment o.timeSlice: anytime search, the time budget split evenly over the halving rounds (a round ends at
        // its slice, the next one starts; n is then only an upper bound)
        const sliceEnd = o.timeSlice && o.timeMs ? c0 + o.timeMs * (r + 1) / R : Infinity;
        for (; j < j0 + per && used < NB * 1.05; j++) {
          if (j >= 2 && clk() > deadline) { stop = "time"; break; }
          if (j >= j0 + 2 && clk() > sliceEnd) break;
          for (const k of alive) { evalOne(k, j); used++; }
          // v1.10 o.earlyZ ("Super Expert"): one move leads every other live move by more than earlyZ standard errors (paired,
          // futures shared) after at least o.earlyMin futures: the rest of the time budget is not needed
          if (o.earlyZ && (j + 1) >= (o.earlyMin || 40) && (j + 1) % 4 === 0 && alive.length >= 2 && earlyLead(alive, vals, o.earlyZ, o.earlyMin || 40)) { j += 1; stop = "early"; break; }
        }
        const rec = { j0, j1: j, alive: alive.slice(), out: [] };
        rounds.push(rec);
        j0 = j;
        if (stop === "time" || stop === "early") break;
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
    // paired comparison against the Expert's pick on the futures both played. v0.91: only a move that is
    // still in the race at the end may be picked (one dropped after round 1 has a few, noisy futures)
    const finalists = rounds.length ? rounds[rounds.length - 1].alive.filter((k) => !rounds[rounds.length - 1].out.includes(k)) : [0];
    let pick = 0, bestAdv = 0;
    const paired = cands.map((_, k) => {
      if (k === 0) return { m: 0, se: 0, n: vals[0].filter((v) => v != null).length };
      const d = []; vals[k].forEach((v, j) => { if (v != null && vals[0][j] != null) d.push(v - vals[0][j]); });
      if (d.length < 2) return { m: d[0] || 0, se: Infinity, n: d.length };
      const m = d.reduce((a, b) => a + b, 0) / d.length;
      const se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1) / d.length);
      // eng-130 o.minFut: never leave the Expert's move on fewer shared futures than this (Rush in Seafarers: a few futures are noise)
      if (finalists.includes(k) && d.length >= (o.minFut || 0) && m > o.z * se + o.minAdv && m > bestAdv) { bestAdv = m; pick = k; }
      return { m, se, n: d.length };
    });
    const ms = now() - t0;
    stats.ms.push(ms);
    const seats = seatW ? seatW.map((arr) => { const a = arr.filter(Boolean); return a.length ? a[0].map((_, q) => r4(a.reduce((x, w) => x + w[q], 0) / a.length)) : null; }) : null;
    return { K, seats, vals: vals.map((v) => v.map((x) => (x == null ? null : r4(x)))), vps: vps.map((v) => v.slice()), rounds, pick, paired: paired.map((p) => ({ m: r4(p.m), se: Number.isFinite(p.se) ? r4(p.se) : null, n: p.n })),
      rule: { z: o.z, minAdv: o.minAdv }, finalists, ms: Math.round(ms), rollouts: used, budget: { n: NB, timeMs: o.timeMs }, stop, depth };
  }

  // ── what a candidate does, in words, and where it is on the board ──
  const diffOf = (g, p, before) => {
    const pl = before.pl[p.id];
    const sett = [...p.settlements].filter((n) => !pl.sett.includes(n));
    const cities = [...p.cities].filter((n) => !pl.cities.includes(n));
    const roads = [...p.roads].filter((e) => !pl.roads.includes(e));
    const ships = p.ships && pl.ships ? [...p.ships].filter((e) => !pl.ships.includes(e)) : []; // eng-130 Seafarers
    const devBought = Object.values(p.devCards).reduce((a, b) => a + b, 0) + Object.values(p.newDevCards).reduce((a, b) => a + b, 0)
      - Object.values(pl.dev).reduce((a, b) => a + b, 0) - Object.values(pl.nd).reduce((a, b) => a + b, 0)
      + p.devVictoryPoints - pl.num[0]; // a VP card is a bought card too (else the label would give the top card away); num[0] = devVictoryPoints
    const res = {};
    Object.keys(RES).forEach((r) => { res[r] = p.resources[r] - pl.res[r]; });
    return { sett, cities, roads, ships, shipMoved: !!(p.ships && pl.ships && p.ships.size === pl.ships.length), devBought, res };
  };
  const sig = (g, p) => `${[...p.settlements].sort()}|${[...p.cities].sort()}|${[...p.roads].sort()}|${p.ships ? [...p.ships].sort() : ""}|${JSON.stringify(p.resources)}|${JSON.stringify(p.devCards)}|${JSON.stringify(p.newDevCards)}`;
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
    if (dif.ships?.length) { const to = dif.ships[0]; const moved = dif.shipMoved; return { label: moved ? shipMoveLabel(g, p, to) : shipBuildLabel(g, p, to), focus: { edge: to } }; }
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

  // ── eng-130 parallel search (Grandmaster): one decision raced by several workers, each on its own share of the futures. A session
  // holds the position and the moves; sessionRun plays the given futures for the given moves exactly as search0's evalOne does
  // (future j: the same re-deal and dice in every worker), so splitting the futures over workers changes nothing but the time.
  // The race itself (rounds, halving, early stop, the pick) runs in src/master/parallel.js. ──
  agent.session = (g, p, kind, base = null) => {
    const P = withoutAgents(g, () => agent.prepare(g, p, kind, base));
    if (!P) return null;
    seedRng(g, p);
    const seed = Math.floor(rng() * 2 ** 31);
    return { P, me: p.id, root: snapshot(g), seed, K: P.cands.length, depth: P.depth };
  };
  /** Play futures js (in order) for moves `alive` until `budgetMs` (this worker's clock; at least one future when `force`).
   *  Returns { done, vals: per alive move the values of js[0..done), vps, seats (o.seats) }. */
  agent.sessionRun = (g, S, alive, js, budgetMs = Infinity, force = false) => withoutAgents(g, () => {
    const t0 = now(), end = t0 + budgetMs;
    const vals = alive.map(() => []), vps = alive.map(() => []), seatW = o.seats ? alive.map(() => []) : null;
    const orig = Math.random;
    agent.busy = true;
    let done = 0;
    try {
      for (let q = 0; q < js.length; q++) {
        if ((q > 0 || !force) && now() > end) break;
        const j = js[q];
        alive.forEach((k, ai) => {
          const r = mulberry32(S.seed + j * 7919);
          Math.random = r;
          restore(g, S.root);
          determinize(g, S.me, r);
          const a = S.P.apply(g, S.P.cands[k]);
          let v = 0;
          if (a !== false) {
            if (!g.winner) rollout(g, a === "ended" ? S.depth - 1 : S.depth, r, { jitter: o.jitter });
            const lv = leafValue(g, S.me, !!seatW);
            v = lv.v; if (seatW) seatW[ai][q] = lv.ws;
          }
          vals[ai][q] = v;
          vps[ai][q] = g.players[S.me].victoryPoints;
        });
        done++;
      }
    } finally { restore(g, S.root); Math.random = orig; agent.busy = false; }
    stats.rollouts += done * alive.length;
    return { done, vals, vps, seats: seatW };
  });
  /** The leaf: the searching seat's win chance at the end of a playout (and every seat's when asked), as in search0. */
  const leafValue = (g, me, all) => {
    if (o.leaf === "gbm" || o.leaf === "gbm0") { const ws = gbmProbs(g, o.leaf === "gbm0" ? GBM_MODEL : null); return { v: ws[me], ws }; }
    if (o.leaf === "fit" || o.leaf === "fit2") { const ws = fitProbs(g, undefined, o.leaf === "fit2" ? FIT2_ADJ : null); return { v: ws[me], ws }; }
    if (all) { const ws = winProbs(g, o.T); return { v: ws[me], ws }; }
    return { v: winProb(g, me, o.T), ws: null };
  };

  // ── set-up: the Expert's top spots ──
  /** eng-130: the candidates of one decision, how to play each, the look-ahead and the labels; null: nothing to choose between.
   *  kind "setup" | "robber" | "main"; base: the set-up spot of a plain bot (setup only). Shared by the decisions below and by
   *  the parallel search sessions (agent.session), so both race exactly the same moves. */
  agent.prepare = (g, p, kind, base = null) => {
    if (kind === "setup") {
      const def = base(p);
      const ids = [def, ...g._aiSetupCandidates(p).sort((a, b) => b.score - a.score).map((c) => c.id).filter((id) => id !== def)].slice(0, o.topSetup);
      if (ids.length <= 1 || def == null) return null;
      return { kind, cands: ids, depth: o.setupDepth, choiceOf: (k) => ids[k],
        named: () => ids.map((id) => ({ c: { kind: "spot", node: id }, label: `Spot ${g._spotLabel(id)}`, focus: { node: id } })),
        apply: (gg, node) => {
          const once = { used: false };
          const save = Object.prototype.hasOwnProperty.call(gg, "getBestInitialSettlementNode") ? gg.getBestInitialSettlementNode : null;
          gg.getBestInitialSettlementNode = (q) => { if (!once.used && q.id === p.id) { once.used = true; return node; } return base(q); };
          try { gg.processSetupQueue(); } finally { if (save) gg.getBestInitialSettlementNode = save; else delete gg.getBestInitialSettlementNode; }
          return true;
        } };
    }
    if (kind === "robber") {
      const all = g._aiRobberCandidates(p).sort((a, b) => b.score - a.score);
      const def = g.chooseRobberHex(p);
      const pir = pirateHexes(g, p); // v1.19 Seafarers: pirate hexes that rob someone
      const ids = [def, ...all.map((c) => c.id).filter((id) => id !== def), ...pir.slice(0, 2).filter((id) => id !== def)].slice(0, o.topRobber + (pir.length ? 2 : 0));
      if (ids.length <= 1) return null;
      return { kind, cands: ids, depth: o.depth, choiceOf: (k) => ids[k],
        named: () => ids.map((id) => ({ c: { kind: "hex", hex: id }, label: g._thiefLabel(id), focus: { hex: id } })),
        apply: (gg, hex) => { gg.moveRobberAndSteal(gg.players[p.id], hex); return true; } };
    }
    const { plan, cands } = withoutAgents(g, () => mainCands(g, p));
    const named = labelMain(g, p, plan, cands);
    if (named.length <= 1) return null;
    return { kind: "main", cands: named.map((x) => x.c), depth: o.depth, choiceOf: (k) => named[k].c, named: () => named,
      apply: (gg, c) => {
        const q = gg.players[p.id];
        if (c.kind === "end") { gg.endTurn(); return "ended"; }
        const r = applyMain(gg, q, c);
        if (r === "noop") { gg.endTurn(); return "ended"; }
        return r;
      } };
  };
  const decide = (g, p, kind, base) => {
    const P = agent.prepare(g, p, kind, base);
    if (!P) return null;
    seedRng(g, p);
    stats.decisions++;
    // eng-130 o.setupTimeMs: a set-up spot gets its own (longer) time budget (it shapes the whole game; only 2 per player)
    const keepT = o.timeMs;
    if (kind === "setup" && o.setupTimeMs) o.timeMs = o.setupTimeMs;
    let rec;
    try { rec = search(g, p.id, P.cands, P.apply, P.depth); } finally { o.timeMs = keepT; }
    (kind === "setup" ? stats.setupMs : kind === "robber" ? stats.robMs : stats.mainMs).push(rec.ms);
    rec.kind = P.kind;
    rec.cands = P.named();
    agent.last = rec;
    const choice = P.choiceOf(rec.pick);
    if (kind === "main") stats.chose[choice.kind] = (stats.chose[choice.kind] || 0) + 1;
    if (rec.pick !== 0) stats.deviations++;
    return { choice, record: rec };
  };

  // ── set-up: the Expert's top spots ──
  agent.decideSetup = (g, p, base) => decide(g, p, "setup", base);

  // ── robber: the Expert's top tiles ──
  agent.decideRobber = (g, p) => decide(g, p, "robber");

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
    if (g.sea) seaMoves(g, p, plan).forEach((m) => out.push({ kind: "shipmove", from: m.from, to: m.to }));
    return { plan, cands: out };
  };
  /** v1.19 Seafarers: the free ship move (once per turn) is a candidate too: the few moves that raise the sea potential
   *  (the Expert's own measure, src/seafarers/ai.js) most, or free a dead-end ship. Not a ship built this turn, never the pirate's. */
  const seaMoves = (g, p, plan) => {
    const sea = g.sea;
    if (!sea.canMoveNow(p) || !p.ships?.size) return [];
    const spots = sea._seaSpotList(p);
    if (!spots.length) return [];
    const base = sea._seaPotential(p, spots).v, out = [];
    for (const from of sea.movableShips(p)) {
      for (const to of sea.moveTargets(p, from)) {
        const e = g.geometry.edges[from], t = g.geometry.edges[to];
        e.owner = null; e.ship = false; p.ships.delete(from); t.owner = p.id; t.ship = true; p.ships.add(to);
        let v; try { v = sea._seaPotential(p, spots).v; } finally { t.owner = null; t.ship = false; p.ships.delete(to); e.owner = p.id; e.ship = true; p.ships.add(from); }
        if (v > base + 0.5) out.push({ from, to, v });
      }
    }
    return out.sort((a, b) => b.v - a.v).slice(0, 3);
  };
  /** Apply a main-phase candidate. true: done; false: illegal; "noop": the Expert's step does nothing
   *  (it would end its turn). */
  const applyMain = (g, p, c) => {
    if (c.kind === "end") return true;
    if (c.kind === "policy") return g._aiPlannedStep(p) ? true : "noop";
    if (c.kind === "dev") return g.playDevelopmentCard(p, c.t) !== false;
    if (c.kind === "shipmove") return !!g.sea && g.sea.moveShip(p, c.from, c.to);
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
        else if (c.kind === "shipmove") { label = shipMoveLabel(g, p, c.to); focus = { edge: c.to }; }
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
  agent.decideMain = (g, p) => decide(g, p, "main");

  // ── v1.03 Game review: how good was a move someone actually made? The played move is candidate 0 (it is
  // never dropped by the halving, like the Expert's pick in a decision), raced against the moves the Master
  // would consider here, on the same futures. `played`: { apply(g, seat) → true | "ended" | false, label }.
  // Returns the race record (rec.paired[k].m = candidate k's win-chance gain over the played move) or null
  // when there is nothing to compare (the played move is the only one). ──
  agent.evaluate = (g, p, kind, played) => {
    let named;
    const playedC = { kind: "played" };
    if (kind === "setup") {
      const ids = g._aiSetupCandidates(p).sort((a, b) => b.score - a.score).map((c) => c.id).filter((id) => id !== played.node).slice(0, o.topSetup - 1);
      named = [{ c: playedC, label: played.label, focus: { node: played.node } }, ...ids.map((id) => ({ c: { kind: "spot", node: id }, label: `Settlement on ${g._spotLabel(id)}`, focus: { node: id } }))];
    } else if (kind === "robber") {
      const ids = g._aiRobberCandidates(p).sort((a, b) => b.score - a.score).map((c) => c.id).filter((id) => id !== played.hex).slice(0, o.topRobber - 1);
      const pir = pirateHexes(g, p).filter((id) => id !== played.hex && !ids.includes(id)).slice(0, 2); // eng-130 Seafarers: the pirate too
      named = [{ c: playedC, label: played.label, focus: { hex: played.hex } }, ...[...ids, ...pir].map((id) => ({ c: { kind: "hex", hex: id }, label: g._thiefLabel(id), focus: { hex: id } }))];
    } else {
      const { plan, cands } = withoutAgents(g, () => mainCands(g, p));
      const others = labelMain(g, p, plan, cands);
      // the played move's outcome; a candidate with the same outcome IS the played move
      const root = snapshot(g), orig = Math.random;
      let ps = null;
      try {
        Math.random = mulberry32(12345);
        const r = withoutAgents(g, () => played.apply(g, p));
        ps = r === false ? null : r === "ended" ? "end" : sig(g, p);
        const outs = others.map((x) => {
          if (x.c.kind === "dev") return null;
          restore(g, root); Math.random = mulberry32(12345);
          const rr = withoutAgents(g, () => applyMain(g, p, x.c));
          return rr === "noop" || x.c.kind === "end" ? "end" : rr === false ? null : sig(g, p);
        });
        named = [{ c: playedC, label: played.label, focus: played.focus || null }, ...others.filter((x, i) => !(ps && outs[i] === ps) && !(x.c.kind === "dev" && played.dev === x.c.t))];
      } finally { restore(g, root); Math.random = orig; }
      if (ps == null) return null;
    }
    if (named.length <= 1) return null;
    seedRng(g, p);
    const rec = search(g, p.id, named.map((x) => x.c), (gg, c) => {
      const q = gg.players[p.id];
      if (c.kind === "played") return played.apply(gg, q);
      if (c.kind === "spot") {
        const save = Object.prototype.hasOwnProperty.call(gg, "getBestInitialSettlementNode") ? gg.getBestInitialSettlementNode : null;
        const base = gg._masterBaseInit || ((x) => gg.constructor.prototype.getBestInitialSettlementNode.call(gg, x));
        let used = false;
        gg.getBestInitialSettlementNode = (x) => { if (!used && x.id === q.id) { used = true; return c.node; } return base(x); };
        try { gg.setupAction = null; gg.processSetupQueue(); } finally { if (save) gg.getBestInitialSettlementNode = save; else delete gg.getBestInitialSettlementNode; }
        return true;
      }
      if (c.kind === "hex") { gg.moveRobberAndSteal(q, c.hex); return true; }
      if (c.kind === "end") { gg.endTurn(); return "ended"; }
      const r = applyMain(gg, q, c);
      if (r === "noop") { gg.endTurn(); return "ended"; }
      return r;
    }, kind === "setup" ? o.setupDepth : o.depth);
    rec.kind = kind;
    rec.cands = named;
    return rec;
  };

  // ── v1.09 paired calibration: several policies' proposals for ONE position raced together on the same futures
  // (no halving), plus the engine's own top candidates. moves: [{ c, label }], c = { kind: "fn", fn(gg, seat) } | { kind: "spot", node }
  // | { kind: "hex", hex } | a main-phase candidate. Returns { rec, named, idx: the race index of each move (-1: illegal) }. ──
  agent.race = (g, p, kind, moves, base = null) => {
    const root = snapshot(g), orig = Math.random, keepStrat = p.strategy;
    // every candidate fixes the seat's follow-up strategy: the proposing policy's own (c.follow), else `base` (the engine's Expert)
    const named = [], seen = new Map();
    const applyC = (gg, c) => {
      const q = gg.players[p.id];
      if (c.follow || base) q.strategy = { ...(c.follow || base) };
      if (c.kind === "fn") return c.fn(gg, q);
      if (c.kind === "spot") {
        const save = Object.prototype.hasOwnProperty.call(gg, "getBestInitialSettlementNode") ? gg.getBestInitialSettlementNode : null;
        const base = gg._masterBaseInit || ((x) => gg.constructor.prototype.getBestInitialSettlementNode.call(gg, x));
        let used = false;
        gg.getBestInitialSettlementNode = (x) => { if (!used && x.id === q.id) { used = true; return c.node; } return base(x); };
        try { gg.setupAction = null; gg.processSetupQueue(); } finally { if (save) gg.getBestInitialSettlementNode = save; else delete gg.getBestInitialSettlementNode; }
        return true;
      }
      if (c.kind === "hex") { gg.moveRobberAndSteal(q, c.hex); return true; }
      if (c.kind === "end") { gg.endTurn(); return "ended"; }
      const r = applyMain(gg, q, c);
      if (r === "noop") { gg.endTurn(); return "ended"; }
      return r;
    };
    const keyFor0 = (c) => {
      if (c.kind === "spot") return `n${c.node}`;
      if (c.kind === "hex") return `h${c.hex}`;
      if (c.kind === "dev") return `dev${c.t}`;
      restore(g, root); Math.random = mulberry32(12345);
      const r = withoutAgents(g, () => applyC(g, c));
      return r === false ? null : r === "ended" || r === "noop" || c.kind === "end" ? "end" : sig(g, p);
    };
    const keyFor = (c) => { const k = keyFor0(c); return k == null ? null : `${k}#${c.fid || ""}`; };
    const add = (m) => { const k = keyFor(m.c); if (k == null) return -1; if (!seen.has(k)) { seen.set(k, named.length); named.push({ c: m.c, label: m.label || k, focus: m.focus || null }); } return seen.get(k); };
    let idx;
    try {
      idx = moves.map(add);
      if (kind === "setup") g._aiSetupCandidates(p).sort((a, b) => b.score - a.score).slice(0, o.topSetup).forEach((x) => add({ c: { kind: "spot", node: x.id }, label: `Settlement on ${g._spotLabel(x.id)}` }));
      else if (kind === "robber") g._aiRobberCandidates(p).sort((a, b) => b.score - a.score).slice(0, o.topRobber).forEach((x) => add({ c: { kind: "hex", hex: x.id }, label: `Robber on ${g._hexName(x.id)}` }));
      else { const { plan, cands } = withoutAgents(g, () => mainCands(g, p)); labelMain(g, p, plan, cands).forEach((x) => add(x)); }
    } finally { restore(g, root); Math.random = orig; p.strategy = keepStrat; }
    if (named.length < 1) return null;
    seedRng(g, p);
    let rec;
    try { rec = search(g, p.id, named.map((x) => x.c), applyC, kind === "setup" ? o.setupDepth : o.depth); } finally { p.strategy = keepStrat; }
    rec.kind = kind;
    return { rec, named, idx };
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
