// v1.28 Running win chance for the Replay (and the review's play-by-play).
//
// Two sources, shown differently:
//   - an ESTIMATE at every replay step: the boosted-tree model (src/master/leaf-gbm.js, gbmProbs) on the
//     position rebuilt from the game's event log (src/stats.js). Against played-out truth the model alone is
//     ~9 win-% points off on average (study-124, Spearman 0.86): good for the trend, not for exact numbers.
//   - EXACT points where the person's decision was checked by the Game review (deep Monte Carlo, the seats'
//     win chances of the move played): the review result closest to the end of that step.
//
// Rebuilding a position: the board (builds, robber) is exact; the hands are rebuilt from production, build
// costs, bank trades, steals, Monopoly, dev cards bought (the card is logged) and played; what the log does not
// say (which cards were discarded, given in a player trade, taken with Year of Plenty) is guessed (the biggest
// piles go first, Year of Plenty fills the smallest). Where the review recorded a decision, every hand, the dev
// cards and the deck are set to the recorded position, so a person's game drifts only between two decisions.
// Seafarers (eng-130): the island model on the rebuilt position, rougher. Older saves without a full log: n/a.
//
// The work runs in a small module worker (src/replay-odds-worker.js) one step at a time, posting each result;
// without workers it runs on the page in slices of ~6 ms. Results are kept in memory per game (not saved).
import { gbmProbs } from "./master/leaf-gbm.js";

const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const DEV = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const COST = { r: { wood: 1, brick: 1 }, s: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, c: { wheat: 2, ore: 3 }, h: { wood: 1, sheep: 1 } };
const DEV_COST = { sheep: 1, wheat: 1, ore: 1 };
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Why there is no win chance for this game (null: it can be computed). */
export function oddsNa(game, st = game._st) {
  // eng-130 Seafarers: estimated too, with the island model (the Seafarers model needs the ships and the sea potential, which the
  // log rebuild does not keep; ships count as roads, gold as nothing): rougher than on the island board (log-loss 1.17 vs 1.32 uniform)
  if (!st || st.partial || !game.stats?.ev || !game.geometry) return "log";
  if ((game.players?.length || 0) < 2) return "log";
  return null;
}

/** The review recording belongs to this game (a past game: the entry it was opened from). */
const sameRv = (game) => !!game._rv && (game._rv.id === game.stats?.id || (!!game._histView && game._rv.id === game._histView.id));

/** Everything the rebuild needs, as plain data (it goes to the worker). */
export function oddsInput(game, st = game._st) {
  const G = game.geometry, S = game.stats;
  const recs = sameRv(game) ? game._rv.recs || [] : [];
  const anchors = [];
  recs.forEach((r) => {
    if (!r || r.e == null || !r.st) return;
    try {
      const s = typeof r.st === "string" ? JSON.parse(r.st) : r.st;
      if (!s?.players) return;
      anchors.push({ e: r.e, players: s.players.map((p) => ({ resources: { ...p.resources }, devCards: { ...p.devCards }, newDevCards: { ...(p.newDevCards || {}) }, devVictoryPoints: p.devVictoryPoints | 0, knightsPlayed: p.knightsPlayed | 0 })),
        deck: Array.isArray(s.devDeck) ? s.devDeck.length : null, robber: s.robberHexId ?? null, lr: s.longestRoadHolder ?? null, la: s.largestArmyHolder ?? null });
    } catch (_) { /* a record we cannot read: no anchor there */ }
  });
  anchors.sort((a, b) => a.e - b.e);
  const bought = S.ev.reduce((n, e) => n + (e[1] === "v" ? 1 : 0), 0);
  return {
    geo: {
      nodes: G.nodes.map((n) => ({ adjacentHexes: n.adjacentHexes.slice(), neighbors: n.neighbors.slice(), edgeIds: n.edgeIds.slice(), ports: (n.ports || []).slice() })),
      edges: G.edges.map((e) => ({ nodes: e.nodes.slice() })),
      hexes: G.hexes.map((h) => ({ number: h.number, resource: h.resource })),
    },
    n: game.players.length, winPoints: game.winPoints, discardLimit: game.settings?.discardLimit || 7,
    deck0: (game.devDeck?.length || 0) + bought, steps: S.steps.map((s) => s.slice()), vp: st.vp, ev: S.ev, r0: S.r0,
    winner: game.winner ? game.winner.id : null, anchors,
  };
}

/** Exact points: per step, the reviewed decision closest to the end of the step (its seats' win chances). */
export function oddsMarks(game) {
  const R = game._rv;
  if (!sameRv(game)) return new Map();
  const best = new Map();
  Object.values(R.revs || {}).forEach((rv) => (rv?.results || []).forEach((x) => {
    if (!x || x.s == null || !Array.isArray(x.seats) || x.seats.length !== game.players.length) return;
    const o = best.get(x.s);
    if (!o || (x.e ?? 0) >= (o.e ?? 0)) best.set(x.s, x);
  }));
  const out = new Map();
  best.forEach((x, s) => { const z = x.seats.reduce((a, b) => a + b, 0) || 1; out.set(s, { p: x.seats.map((v) => v / z), pid: x.pid, k: x.k, e: x.e }); });
  return out;
}

/** eng-147 Exact set-up points: the reviewed set-up decisions (their seats' win chances), keyed by the event index they were taken at. */
export function setupMarks(game) {
  if (!sameRv(game)) return [];
  const out = [];
  Object.values(game._rv.revs || {}).forEach((rv) => (rv?.results || []).forEach((x) => {
    if (!x || x.k !== "setup" || x.s !== 0 || x.e == null || !Array.isArray(x.seats) || x.seats.length !== game.players.length) return;
    const z = x.seats.reduce((a, b) => a + b, 0) || 1;
    out.push({ e: x.e, p: x.seats.map((v) => v / z), pid: x.pid });
  }));
  return out;
}
/** eng-147 The seat order's win chances from the empty board (equal bots), when the luck run measured them. */
export function seatOdds(game) {
  const sv = Object.values(game._rv?.luck?.res || {}).find((r) => r?.k === "seat" && r.v);
  if (!sameRv(game) || !sv || sv.v.length !== game.players.length) return null;
  const z = sv.v.reduce((a, b) => a + b, 0) || 1;
  return sv.v.map((v) => v / z);
}

/** The position rebuilt from the log, one event at a time (pure data: it runs in the worker or on the page). */
export class OddsSim {
  constructor(D) {
    this.D = D;
    const nodes = D.geo.nodes.map((n, id) => ({ id, owner: null, structure: null, ...n }));
    const edges = D.geo.edges.map((e, id) => ({ id, owner: null, ...e }));
    this.G = { nodes, edges, hexes: D.geo.hexes };
    this.players = Array.from({ length: D.n }, (_, id) => ({
      id, resources: Object.fromEntries(RES.map((r) => [r, 0])), devCards: Object.fromEntries([...DEV, "victoryPoint"].map((d) => [d, 0])), newDevCards: Object.fromEntries([...DEV, "victoryPoint"].map((d) => [d, 0])),
      settlements: new Set(), cities: new Set(), roads: new Set(), knightsPlayed: 0, longestRoadLength: 0, devVictoryPoints: 0, victoryPoints: 0,
    }));
    this.robber = D.r0; this.lr = null; this.la = null; this.deck = D.deck0; this.free = Array(D.n).fill(0);
    this.setupS = Array(D.n).fill(0); // settlements placed in the set-up (the 2nd one pays)
    this.k = 0; this.a = 0; // next event, next anchor
    this.dirty = true;
  }
  /** Take n cards from a hand, biggest piles first (what the log does not say). Returns what was taken. */
  _take(p, n) {
    const got = {};
    for (let i = 0; i < n; i += 1) {
      let r = null; RES.forEach((x) => { if (p.resources[x] > 0 && (r == null || p.resources[x] > p.resources[r])) r = x; });
      if (!r) break;
      p.resources[r] -= 1; got[r] = (got[r] || 0) + 1;
    }
    return got;
  }
  _pay(p, c, sign = -1) { for (const r in c) p.resources[r] = Math.max(0, p.resources[r] + sign * c[r]); }
  _anchor(A) {
    A.players.forEach((q, i) => {
      const p = this.players[i]; if (!p) return;
      RES.forEach((r) => { p.resources[r] = q.resources?.[r] | 0; });
      [...DEV, "victoryPoint"].forEach((d) => { p.devCards[d] = (q.devCards?.[d] | 0) + (q.newDevCards?.[d] | 0); });
      p.devVictoryPoints = q.devVictoryPoints; p.knightsPlayed = q.knightsPlayed;
    });
    if (A.deck != null) this.deck = A.deck;
    if (A.robber != null) this.robber = A.robber;
    this.lr = A.lr; this.la = A.la;
  }
  /** Apply events up to (not including) global index `upto`. */
  run(upto) {
    const ev = this.D.ev, AN = this.D.anchors, G = this.G;
    while (this.k < upto && this.k < ev.length) {
      while (this.a < AN.length && AN[this.a].e <= this.k) { if (AN[this.a].e === this.k) this._anchor(AN[this.a]); this.a += 1; }
      const e = ev[this.k]; this.k += 1;
      const [step, c, a, b, x, y] = e, p = this.players[a];
      switch (c) {
        case "P": if (p) p.resources[RES[x]] += y || 1; break;
        case "b": case "u": {
          if (!p) break;
          const add = c === "b", setup = step === 0;
          if (b === "r" || b === "h") {
            const ed = G.edges[x]; if (!ed) break;
            ed.owner = add ? a : null; p.roads[add ? "add" : "delete"](x);
            if (add && !setup) { if (this.free[a] > 0) this.free[a] -= 1; else this._pay(p, COST[b]); } else if (!add && !setup) this._pay(p, COST[b], 1);
          } else {
            const nd = G.nodes[x]; if (!nd) break;
            if (b === "s") {
              nd.owner = add ? a : null; nd.structure = add ? "settlement" : null; p.settlements[add ? "add" : "delete"](x); if (!add) p.cities.delete(x);
              if (setup && add) { this.setupS[a] += 1; if (this.setupS[a] === 2) nd.adjacentHexes.forEach((h) => { const r = G.hexes[h]?.resource; if (RES.includes(r)) p.resources[r] += 1; }); }
              else if (!setup) this._pay(p, COST.s, add ? -1 : 1);
            } else {
              nd.owner = a; nd.structure = add ? "city" : "settlement"; p.cities[add ? "add" : "delete"](x); p.settlements[add ? "delete" : "add"](x);
              if (!setup) this._pay(p, COST.c, add ? -1 : 1);
            }
          }
          this.dirty = true;
          break;
        }
        case "R": this.robber = b; break;
        case "t": { const v = this.players[b]; if (p && v) { const r = RES[x]; if (v.resources[r] > 0) v.resources[r] -= 1; p.resources[r] += 1; } break; }
        case "d": if (p) this._take(p, b); break;
        case "k": if (p) { p.resources[RES[b]] = Math.max(0, p.resources[RES[b]] - x); p.resources[RES[y]] += 1; } break;
        case "x": { const q = this.players[b]; if (p && q) { const ga = this._take(p, x), gb = this._take(q, y); for (const r in ga) q.resources[r] += ga[r]; for (const r in gb) p.resources[r] += gb[r]; } break; }
        case "v": if (p) { this._pay(p, DEV_COST); this.deck = Math.max(0, this.deck - 1); if (b === "victoryPoint") p.devVictoryPoints += 1; else if (p.devCards[b] != null) p.devCards[b] += 1; } break;
        case "y": if (p) { if (p.devCards[b] > 0) p.devCards[b] -= 1; if (b === "knight") p.knightsPlayed += 1; if (b === "roadBuilding") this.free[a] = 2; } break;
        case "m": if (p) { const r = RES[b]; e.slice(5).forEach((l, i) => { const q = this.players[i]; if (q && i !== a) q.resources[r] = Math.max(0, q.resources[r] - (l | 0)); }); p.resources[r] += x | 0; } break;
        case "o": if (p) for (let i = 0; i < (b | 0); i += 1) { let r = RES[0]; RES.forEach((z) => { if (p.resources[z] < p.resources[r]) r = z; }); p.resources[r] += 1; } break;
        case "a": if (a === "L") this.lr = b >= 0 ? b : null; else if (a === "A") this.la = b >= 0 ? b : null; break;
        default: break;
      }
    }
  }
  _roadLen(p) {
    if (!p.roads.size) return 0;
    const G = this.G, inc = new Map();
    p.roads.forEach((id) => G.edges[id].nodes.forEach((n) => { if (!inc.has(n)) inc.set(n, []); inc.get(n).push(id); }));
    const blocked = (n) => G.nodes[n].owner != null && G.nodes[n].owner !== p.id;
    const used = new Set();
    const dfs = (n) => {
      if (used.size && blocked(n)) return 0;
      let best = 0;
      for (const id of inc.get(n) || []) {
        if (used.has(id)) continue;
        used.add(id);
        const ed = G.edges[id], m = ed.nodes[0] === n ? ed.nodes[1] : ed.nodes[0];
        const v = 1 + dfs(m); if (v > best) best = v;
        used.delete(id);
      }
      return best;
    };
    let L = 0; inc.forEach((_, n) => { const v = dfs(n); if (v > L) L = v; });
    return L;
  }
  /** Win chances for the position now (step s: VP from the log, the mover is the step's roller). */
  probs(s, final = false, mid = false) {
    const D = this.D, P = this.players;
    if (this.dirty) { P.forEach((p) => { p.longestRoadLength = this._roadLen(p); }); this.dirty = false; }
    // mid: inside the set-up, the points are what stands on the board (the log's per-step points are after the whole set-up)
    const vp = mid ? P.map((p) => p.settlements.size + 2 * p.cities.size) : D.vp[Math.min(s, D.vp.length - 1)] || [];
    P.forEach((p, i) => { p.victoryPoints = vp[i] | 0; });
    const step = D.steps[s - 1] || D.steps[0];
    const sim = this, self = {
      geometry: this.G, winPoints: D.winPoints, players: P, settings: { discardLimit: D.discardLimit }, robberHexId: this.robber,
      largestArmyHolder: this.la, longestRoadHolder: this.lr, devDeck: { length: this.deck }, currentPlayerIndex: step && step[1] >= 0 ? step[1] : 0, turn: step ? step[0] : 0,
      winner: final && D.winner != null ? P[D.winner] : null,
      getPlayerTradeRate(p, r) {
        let rate = 4;
        p.settlements.forEach((id) => sim.G.nodes[id].ports.forEach((t) => { if (t === "any") rate = Math.min(rate, 3); if (t === r) rate = Math.min(rate, 2); }));
        p.cities.forEach((id) => sim.G.nodes[id].ports.forEach((t) => { if (t === "any") rate = Math.min(rate, 3); if (t === r) rate = Math.min(rate, 2); }));
        return rate;
      },
    };
    return gbmProbs(self);
  }
}

/** First event index of each step: step s ends just before ends[s] (the log is in step order). */
export function stepEnds(D) {
  const N = D.steps.length, ends = Array(N + 1).fill(D.ev.length);
  let s = 0;
  D.ev.forEach((e, i) => { while (s < e[0] && s <= N) { ends[s] = i; s += 1; } });
  return ends;
}

/** Step by step: { next() -> { s, p, ms } | null, at(s, upto) -> p }. */
export function oddsRunner(D) {
  const ends = stepEnds(D), N = D.steps.length;
  const sim = new OddsSim(D);
  let s = 0;
  return {
    N,
    next() {
      if (s > N) return null;
      const t0 = now();
      // eng-147 the set-up: the empty board, then the position after every placement (settlement, road, ship) of step 0
      let su = null;
      if (s === 0) {
        su = [{ g: 0, p: sim.probs(0, false, true) }];
        for (let i = 0; i < ends[0]; i += 1) {
          const e = D.ev[i];
          if (e[0] === 0 && e[1] === "b" && (e[3] === "s" || e[3] === "r" || e[3] === "h")) { sim.run(i + 1); su.push({ g: i + 1, a: e[2], b: e[3], p: sim.probs(0, false, true) }); }
        }
      }
      sim.run(ends[s]);
      const p = sim.probs(s, s === N);
      const out = { s, p, ms: now() - t0 };
      if (su) out.su = su;
      s += 1;
      return out;
    },
    /** A moment inside step s (the events before global index `upto`), on a fresh copy. */
    at(st, upto) {
      const q = new OddsSim(D);
      q.run(Math.min(upto, ends[Math.min(st, N)]));
      return q.probs(st, false);
    },
  };
}

// ── the page side: one computation per game, kept in memory ──────────────────────────────────────
const CACHE = new Map(); // stats.id -> { p: [], ms: [], done, subs: Set, worker, runner, D }
const MAX_GAMES = 6;
let workerBroken = false;

function startWorker(job, D) {
  if (workerBroken || typeof Worker === "undefined") return false;
  let w;
  try { w = new Worker(new URL("./replay-odds-worker.js?v=168", import.meta.url), { type: "module" }); } catch (_) { workerBroken = true; return false; }
  job.worker = w; job.seq = 0; job.wait = new Map();
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === "step") { job.p[m.s] = m.p; job.ms[m.s] = m.ms; if (m.su) job.su = m.su; job.subs.forEach((f) => f(m.s)); }
    else if (m.type === "done") { job.done = true; job.subs.forEach((f) => f(-1)); }
    else if (m.type === "at") { const f = job.wait.get(m.id); job.wait.delete(m.id); f?.(m.p); }
    else if (m.type === "error") { console.warn("replay odds failed", m.message); job.failed = true; job.subs.forEach((f) => f(-1)); }
  };
  w.onerror = (e) => { e.preventDefault?.(); workerBroken = true; try { w.terminate(); } catch (_) {} job.worker = null; startPage(job, D, job.p.length); };
  w.postMessage({ type: "start", D });
  return true;
}
function startPage(job, D, from = 0) {
  const R = oddsRunner(D);
  job.runner = R;
  for (let k = 0; k < from; k += 1) R.next(); // (a worker that failed half-way: catch up)
  const slice = () => {
    if (job.stopped) return;
    const t0 = now();
    let r;
    while ((r = R.next())) { job.p[r.s] = r.p; job.ms[r.s] = r.ms; if (r.su) job.su = r.su; job.subs.forEach((f) => f(r.s)); if (now() - t0 > 6) break; }
    if (r) setTimeout(slice, 16); else { job.done = true; job.subs.forEach((f) => f(-1)); }
  };
  setTimeout(slice, 0);
}

/** The running win chances of this game: { na, get(s), exact(s), done, on(fn) -> off, at(s, upto) -> Promise }. */
export function gameOdds(game) {
  const na = oddsNa(game);
  if (na) return { na, get: () => null, exact: () => null, on: () => () => {}, at: async () => null, setup: () => [], seat: null, done: true, N: game._st?.N || 0 };
  const id = game.stats.id || "cur";
  const marks = oddsMarks(game);
  let job = CACHE.get(id);
  if (job && job.n !== game.stats.ev.length) { job.stop(); job = null; }
  if (!job) {
    const D = oddsInput(game);
    job = { p: [], ms: [], done: false, subs: new Set(), n: game.stats.ev.length, D, stopped: false };
    job.stop = () => { job.stopped = true; try { job.worker?.terminate(); } catch (_) {} job.worker = null; };
    if (!startWorker(job, D)) startPage(job, D);
    CACHE.set(id, job);
    while (CACHE.size > MAX_GAMES) { const [k, j] = CACHE.entries().next().value; j.stop(); CACHE.delete(k); }
  }
  return {
    na: null, N: job.D.steps.length, marks,
    get done() { return job.done; },
    get: (s) => job.p[s] || null,
    seat: seatOdds(game),
    /** eng-147 the set-up points: [{ g (events applied), a, b, p (estimate), x (exact, from a reviewed set-up decision), pid }], the first is the empty board (the seat value when measured, else the even share). */
    setup() {
      const su = job.su; if (!su) return [];
      const ms = setupMarks(game), seat = seatOdds(game);
      return su.map((q, i) => {
        // a reviewed decision belongs to the first point after it (its placement), if that comes right behind it
        const m = i ? ms.filter((z) => z.e < q.g && q.g - z.e <= 3 && !(su[i - 1].g > z.e)).sort((a, b) => b.e - a.e)[0] : null;
        return { ...q, est: i ? q.p : (seat || q.p.map(() => 1 / q.p.length)), p: i ? q.p : (seat || q.p.map(() => 1 / q.p.length)), x: i ? (m || null) : (seat ? { p: seat } : null) };
      });
    },
    exact: (s) => marks.get(s) || null,
    ms: () => job.ms.filter((x) => x != null),
    on(fn) { job.subs.add(fn); return () => job.subs.delete(fn); },
    at(s, upto) {
      if (job.worker) return new Promise((ok) => { const i = ++job.seq; job.wait.set(i, ok); job.worker.postMessage({ type: "at", id: i, s, upto }); setTimeout(() => { if (job.wait.has(i)) { job.wait.delete(i); ok(null); } }, 4000); });
      try { return Promise.resolve((job.runner || oddsRunner(job.D)).at(s, upto)); } catch (_) { return Promise.resolve(null); }
    },
  };
}
/** Forget a game's numbers (its log changed, or a test). */
export function oddsForget(id) { const j = CACHE.get(id); if (j) { j.stop(); CACHE.delete(id); } }
