// Monte Carlo toolkit: collectors. A collector sees every finished future (add(branch, j, g, leafVector)), may listen to the game's events while
// the futures run (attach / detach), and reports plain JSON (result()), so a worker's partial results merge: merge(parts) of the parts of futures
// split over workers equals the result of one run over all of them (addition and concatenation only).
import { traceStart, featuresOf } from "../review/why-mc.js";
const sumTo = (a, b) => { for (let i = 0; i < b.length; i += 1) a[i] += b[i]; return a; };

/** How often each seat won (and how often nobody did within the horizon), per branch. */
export function winCounts(n, branches = 1) {
  const wins = Array.from({ length: branches }, () => Array(n).fill(0)), none = Array(branches).fill(0), runs = Array(branches).fill(0);
  return { name: "wins", add(b, j, g) { runs[b] += 1; if (g.winner) wins[b][g.winner.id] += 1; else none[b] += 1; }, result: () => ({ wins, none, runs }),
    merge(parts) { const r = { wins: wins.map((w) => w.map(() => 0)), none: none.map(() => 0), runs: runs.map(() => 0) }; parts.forEach((p) => { p.wins.forEach((w, b) => sumTo(r.wins[b], w)); p.none.forEach((x, b) => { r.none[b] += x; }); p.runs.forEach((x, b) => { r.runs[b] += x; }); }); return r; } };
}

/** Mean victory points per seat at the end of each future, per branch. */
export function points(n, branches = 1) {
  const sum = Array.from({ length: branches }, () => Array(n).fill(0)), runs = Array(branches).fill(0);
  return { name: "points", add(b, j, g) { runs[b] += 1; g.players.forEach((p, q) => { sum[b][q] += p.victoryPoints; }); },
    result: () => ({ sum, runs, mean: sum.map((s, b) => s.map((x) => (runs[b] ? x / runs[b] : 0))) }),
    merge(parts) { const r = { sum: sum.map((s) => s.map(() => 0)), runs: runs.map(() => 0) }; parts.forEach((p) => { p.sum.forEach((s, b) => sumTo(r.sum[b], s)); p.runs.forEach((x, b) => { r.runs[b] += x; }); }); r.mean = r.sum.map((s, b) => s.map((x) => (r.runs[b] ? x / r.runs[b] : 0))); return r; } };
}

/** The leaf vectors per branch (every future kept: what the paired comparisons and the standard errors are made of), and their mean / se. */
export function leafSamples(branches = 1) {
  const W = Array.from({ length: branches }, () => []);
  return { name: "leaf", add(b, j, g, v) { W[b].push(v); }, result: () => ({ W }),
    merge(parts) { const r = { W: W.map(() => []) }; parts.forEach((p) => p.W.forEach((w, b) => { r.W[b].push(...w); })); return r; } };
}
/** mean and standard error of one seat's samples (the order of summation is part of the contract: sequential from 0). */
export const meanSe = (xs) => { const F = xs.length, m = xs.reduce((a, x) => a + x, 0) / F; return { mean: m, se: F > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (F - 1) / F) : 0 }; };

/** Tally of the game's events during the futures (type -> count), per branch; `types` null: every type. Listens on the game's emitter (g.events). */
export function eventTally(types = null, branches = 1) {
  const counts = Array.from({ length: branches }, () => ({})); let cur = 0;
  const fn = (ev) => { if (!types || types.includes(ev.type)) counts[cur][ev.type] = (counts[cur][ev.type] || 0) + 1; };
  return { name: "events", attach(g) { g.events?.on("mc-tally", fn); }, detach(g) { g.events?.off("mc-tally"); },
    add() {}, before(b) { cur = b; /* the events of the next future of branch b are counted under b */ }, result: () => ({ counts }),
    merge(parts) { const r = { counts: counts.map(() => ({})) }; parts.forEach((p) => p.counts.forEach((c, b) => Object.entries(c).forEach(([k, v]) => { r.counts[b][k] = (r.counts[b][k] || 0) + v; }))); return r; } };
}

/** The feature trace of one seat (src/review/why-mc.js traceStart / featuresOf) per future and branch: what the "why is A better than B" reading
 *  attributes. Observers are installed at the start of each future and removed at its end (also when a future throws). result(): { feats[b][j] }. */
export function featureTrace(me, branches = 1) {
  let ts = null; const feats = Array.from({ length: branches }, () => []);
  const c = { name: "trace", hook: null,
    begin(g) { ts = traceStart(g, me); c.hook = ts.hook; },
    add(b, j, g) { const tr = ts.end(); ts = null; c.hook = null; feats[b][j] = featuresOf(tr, { vp: g.players[me].victoryPoints, won: !!g.winner && g.winner.id === me }); },
    abort() { if (ts) ts.end(); ts = null; c.hook = null; },
    result: () => ({ feats }),
    merge(parts) { const r = { feats: feats.map(() => []) }; parts.forEach((p) => p.feats.forEach((f, b) => { f.forEach((x, j) => { r.feats[b][j] = x; }); })); return r; } };
  return c;
}
