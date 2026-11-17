// v1.83 Grand Strategy facts, all derived by the app from the build log (never by a model): the hand of every player at the end of every turn,
// the points they gained by source and turn, the plan (the family of the first two builds after set-up), a pivot, the stalled turns (no points
// while holding >= 4 cards), what they were waiting for, whether the start could feed the plan, and a verdict with an honest confidence.
// Pure: reads g._st (stats.js computeStats) and the win-chance series; no DOM.
import { aiStart, wcAt } from "./ai-facts.js";
import { finalScore as finalScoreOf } from "./score.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
import { RESOURCES } from "../core/constants.js";
export const R5 = RESOURCES;
const COST = { s: [1, 1, 1, 1, 0], c: [0, 0, 0, 2, 3], r: [1, 1, 0, 0, 0], h: [1, 0, 1, 0, 0], d: [0, 0, 1, 1, 1] }; // wood brick sheep wheat ore
export const STALL_HAND = 4, STALL_SHARE = 0.25, SD_UNIT = 3;
const FAM = { r: "X", s: "X", h: "X", c: "C", d: "C" };
export const PLAN_NAME = { X: "expanding", C: "cities and cards", M: "a mix" };
const memo = new WeakMap();

/** { T, last[t] (last step of turn t), hand[q][t] total cards at the end of turn t, res[q][t] per resource (best effort: trades with players, discards
 *  and Year of Plenty carry no resource in the log), pts[q] [{t, k, n}] point events (k: s c v L A), builds[q] [{t, k}] after set-up (k: r s c h d) }. */
export function handLog(g) {
  const st = g?._st; if (!st?.stepEvents || !st.turnOf) return null;
  if (memo.has(st)) return memo.get(st);
  const n = g.players.length, N = Math.min(st.N, st.stepEvents.length - 1), T = Math.max(0, ...st.turnOf.slice(0, N + 1));
  const res = Array.from({ length: n }, () => [0, 0, 0, 0, 0]), wild = Array(n).fill(0), free = Array(n).fill(0);
  const hand = Array.from({ length: n }, () => Array(T + 1).fill(0)), snap = Array.from({ length: n }, () => Array.from({ length: T + 1 }, () => [0, 0, 0, 0, 0]));
  const pts = Array.from({ length: n }, () => []), builds = Array.from({ length: n }, () => []), last = Array(T + 1).fill(0);
  const tot = (q) => res[q].reduce((a, b) => a + b, 0) + wild[q];
  const take = (q, ri, k) => { // remove k cards of ri; what is missing comes from the wildcards, then from the biggest pile
    const a = Math.min(res[q][ri], k); res[q][ri] -= a; let rest = k - a;
    const w = Math.min(wild[q], rest); wild[q] -= w; rest -= w;
    while (rest > 0 && tot(q) > 0) { let b = 0; res[q].forEach((v, i) => { if (v > res[q][b]) b = i; }); if (res[q][b] > 0) { res[q][b] -= 1; } else wild[q] -= 1; rest -= 1; }
  };
  const pay = (q, cost) => cost.forEach((k, ri) => { if (k) take(q, ri, k); });
  const refund = (q, cost) => cost.forEach((k, ri) => { res[q][ri] += k; });
  const drop = (q, k) => { while (k-- > 0 && tot(q) > 0) { let b = 0; res[q].forEach((v, i) => { if (v > res[q][b]) b = i; }); if (res[q][b] > 0) res[q][b] -= 1; else wild[q] -= 1; } };
  const adj = (q, d) => { if (d > 0) wild[q] += d; else drop(q, -d); };
  const addPt = (q, t, k, v = 1) => { if (pts[q]) pts[q].push({ t, k, n: v }); };
  const snapshot = (t) => { for (let q = 0; q < n; q++) { hand[q][t] = tot(q); snap[q][t] = res[q].slice(); } };
  for (let k = 0; k <= N; k++) {
    const t = st.turnOf[k] ?? 0;
    (st.stepEvents[k] || []).forEach((e) => {
      const c = e[1], a = e[2], b = e[3];
      if (c === "P" && res[a]) res[a][e[4]] += e[5] || 1;
      else if (c === "t" && res[a] && res[b] != null) { res[a][e[4]] += 1; take(b, e[4], 1); }
      else if (c === "d" && res[a]) drop(a, b);
      else if (c === "k" && res[a]) { take(a, b, e[4]); res[a][e[5]] += 1; }
      else if (c === "x" && res[a] && res[b]) { const d = (e[5] || 0) - (e[4] || 0); adj(a, d); adj(b, -d); }
      else if (c === "o" && res[a]) wild[a] += b || 0;
      else if (c === "m" && res[a]) { const lost = e.slice(5); let got = 0; lost.forEach((l, q) => { if (l && res[q] && q !== a) { const m = Math.min(res[q][b], l); res[q][b] -= m; got += l; } }); res[a][b] += got; }
      else if (c === "y" && res[a] && b === "roadBuilding") free[a] = 2;
      else if (c === "v" && res[a]) { if (t > 0) pay(a, COST.d); builds[a].push({ t, k: "d" }); if (b === "victoryPoint") addPt(a, t, "v"); }
      else if (c === "b" && res[a]) {
        if (t === 0) { if (b === "s") addPt(a, 0, "s"); return; }
        if (b === "r" || b === "h") { if (free[a] > 0) free[a] -= 1; else { pay(a, COST[b]); builds[a].push({ t, k: b }); } }
        else if (b === "s" || b === "c") { pay(a, COST[b]); builds[a].push({ t, k: b }); addPt(a, t, b); }
      } else if (c === "u" && res[a]) {
        if (t === 0) return;
        if (b === "s" || b === "c") { refund(a, COST[b]); addPt(a, t, b, -1); }
        else if (b === "r" || b === "h") refund(a, COST[b]);
      }
    });
    last[t] = k;
    const nx = st.turnOf[k + 1]; if (k === N || (nx ?? t) !== t) snapshot(t);
  }
  (st.awards || []).forEach((a) => { const t = st.turnOf[a.s] ?? 0; if (a.pid >= 0) addPt(a.pid, t, a.kind === "L" ? "L" : "A", 2); if (a.prev >= 0) addPt(a.prev, t, a.kind === "L" ? "L" : "A", -2); });
  pts.forEach((l) => l.sort((x, y) => x.t - y.t));
  // v1.86.2 the points at the end of each turn are the game's own record (st.vp, what the scoreboard showed), not a sum of build events: a point card
  // counts from the next turn on, a Seafarers island bonus is not an event, an undone build leaves no trace. The events stay for WHAT was gained (icons, sources).
  const vp = Array.from({ length: n }, (_, q) => { let prev = st.vp?.[0]?.[q] ?? 0; return Array.from({ length: T + 1 }, (_, t) => { const k = t === 0 ? 0 : last[t]; const v = k > 0 || t === 0 ? st.vp?.[k]?.[q] : null; if (v != null) prev = v; return prev; }); });
  const out = { T, last, hand, res: snap, pts, builds, vp };
  memo.set(st, out);
  return out;
}

/** Points at the end of each turn t (0 = after set-up): the game's own per-step record (log.vp); only a log without it falls back to the sum of the point events. */
export function ptsByTurn(log, q) {
  if (log.vp?.[q]) return log.vp[q].slice();
  const out = Array(log.T + 1).fill(0); let s = 0, i = 0; const l = log.pts[q] || [];
  for (let t = 0; t <= log.T; t++) { while (i < l.length && l[i].t <= t) { s += l[i].n; i++; } out[t] = s; }
  return out;
}

/** THE final score breakdown lives in score.js (a neutral module: the end screen, Overview, history, chat and the AI tab all read it). Default log: this game's hand log. */
export const finalScore = (g, q, log = handLog(g)) => finalScoreOf(g, q, log);

const famOf = (list) => list.map((b) => FAM[b.k]);
/** The strategy facts of one player. ser = aiSeries(g). null without the log. */
export function stratOf(g, q, ser) {
  const log = handLog(g); if (!log || !g.players[q]) return null;
  const T = log.T, builds = log.builds[q].filter((b) => b.t > 0), fam = famOf(builds);
  const first2 = fam.slice(0, 2), nX = first2.filter((f) => f === "X").length;
  const planFam = first2.length < 2 ? null : nX === 2 ? "X" : nX === 0 ? "C" : "M";
  // direction: a lone development card is not a change of plan (v1.84), so only roads, settlements and cities count here
  const dbuilds = builds.filter((b) => b.k !== "d"), dfam = famOf(dbuilds), won = g.winner?.id === q;
  let sw = 0, swAt = null; for (let i = 1; i < dfam.length; i++) if (dfam[i] !== dfam[i - 1]) { sw++; if (sw === 1) swAt = i; }
  const after = swAt != null ? dfam.length - swAt : 0;
  const dir = !planFam ? "none" : sw === 1 && after >= 2 && dfam.length - after >= 2 ? "pivot" : sw >= 4 ? "wobbly" : "steady";
  const pivot = dir === "pivot" ? { t: dbuilds[swAt].t, to: PLAN_NAME[dfam[swAt]], toFam: dfam[swAt] } : null;
  const turns = Math.max(0, T - 1), pb = ptsByTurn(log, q), stalled = [], wait = {}, ptl = log.pts[q].filter((e) => e.n > 0 && e.t > 0);
  const waitTurns = {};
  for (let t = 1; t <= T - 1; t++) {
    if (pb[t] - pb[t - 1] > 0 || (log.hand[q][t] || 0) < STALL_HAND) continue;
    stalled.push(t);
    const nxt = ptl.find((e) => e.t > t && (e.k === "s" || e.k === "c" || e.k === "v")), cost = nxt ? COST[nxt.k === "v" ? "d" : nxt.k] : null;
    if (cost) cost.forEach((k, ri) => { if (k && log.res[q][t][ri] < k) { wait[R5[ri]] = (wait[R5[ri]] || 0) + 1; (waitTurns[R5[ri]] ||= []).push(t); } });
  }
  const wr = Object.entries(wait).sort((a, b) => b[1] - a[1])[0], waitRes = wr && wr[1] >= 2 ? wr[0] : null;
  // stretches of consecutive stalled turns and the win chance they cost
  const stretches = []; stalled.forEach((t) => { const l = stretches[stretches.length - 1]; if (l && t === l[1] + 1) l[1] = t; else stretches.push([t, t]); });
  let E = null;
  if (ser?.by?.size) {
    let sum = 0, ok = 0;
    stretches.forEach(([a, b]) => { const v0 = wcAt(ser, q, a - 1), v1 = wcAt(ser, q, b); if (v0 != null && v1 != null) { sum += v0 - v1; ok++; } });
    E = ok === stretches.length ? Math.max(0, Math.round(sum)) : null;
  }
  const SD = Math.round(SD_UNIT * Math.sqrt(Math.max(1, stretches.length)));
  const sp = tryv(() => aiStart(g, q)), dots = sp?.startDots || null;
  // every resource the plan's builds need (a settlement also needs sheep and wheat), plus the one it was stalled on
  const needSet = new Set(); builds.slice(0, 2).forEach((b) => COST[b.k].forEach((k, ri) => { if (k) needSet.add(R5[ri]); })); if (waitRes) needSet.add(waitRes);
  const need = planFam ? R5.filter((r) => needSet.has(r)) : [];
  const good = dots ? need.filter((r) => dots[r] >= 3).length : 0, feeds = !dots || !need.length ? null : good === need.length ? "yes" : good > 0 ? "partly" : "no";
  const share = turns ? stalled.length / turns : 0, bad = (share >= STALL_SHARE ? 1 : 0) + (feeds === "no" ? 1 : 0) + (dir === "wobbly" ? 1 : 0);
  let verdict = null;
  const V = (tone, dots, label, code) => ({ tone, dots, label, code });
  if (planFam && E != null) {
    if (bad && E >= 2 * SD) verdict = V("bad", 3, "Weak plan", "weak");
    else if (bad && E >= SD) verdict = V("bad", 2, "Probably weak plan", "probably-weak");
    else if (!bad && E <= 0.5 * SD) verdict = V("good", 3, "Solid plan", "solid");
    else if (!bad && E < SD) verdict = V("good", 2, "Probably solid plan", "probably-solid");
    else verdict = V("mid", 1, "Hard to say", "unclear");
  } else if (planFam) verdict = V("mid", 1, "Hard to say", "unclear");
  // a winner's plan is never called weak: the result says otherwise (and the labels may not contradict it)
  if (won && verdict?.tone === "bad") verdict = V("mid", 1, "Hard to say", "unclear");
  const headless = !!planFam && verdict?.tone === "bad" && !won && share >= STALL_SHARE && dir === "wobbly";
  const fs_ = finalScore(g, q, log), src = fs_.by, total = fs_.total;
  return { seat: q, plan: planFam ? PLAN_NAME[planFam] : null, planFam, first2: builds.slice(0, 2), builds, dir, switches: sw, pivot, steady: dir === "steady", wobbly: dir === "wobbly",
    won, turns, stalled, idleN: stalled.length, waitN: waitRes ? waitTurns[waitRes].length : 0, waitRes, stretches, E, SD, startDots: dots, need, feeds, share, bad, verdict, headless, src, srcTotal: total, hand: log.hand[q], ptsBy: pb };
}
