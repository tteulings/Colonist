// node story.mjs : per game, A (from data/*.A.json) + refine + B (pass valuation) for the top rounds + C (mechanism); writes data/<id>.story.json
import fs from "fs";
import { createRequire } from "module";
import { load, delta, roundOf, DIR } from "./lib.mjs";
import { g } from "../wt-190/scripts/ledger/node-engine.mjs";
import * as M from "../wt-190/src/review/ai-mech.js";
const { valueAt } = await import("../wt-190/src/review/step-mc.js");
const require = createRequire(import.meta.url);
const { rehydrate } = require("../wt-190/tests/evals/fx.js");
const { gameShape } = await import("../wt-190/src/review/ai-shape.js");
const FIX = (id) => JSON.parse(fs.readFileSync(`../wt-190/tests/evals/fixtures/${id}.json`));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const norm = (v) => { const s = v.reduce((a, c) => a + c, 0); return s > 0 ? v.map((c) => c / s) : v; };
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const pair = (Wa, Wb, n) => { const F = Math.min(Wa.length, Wb.length), d = [], se = []; for (let q = 0; q < n; q++) { const x = Array.from({ length: F }, (_, j) => Wb[j][q] - Wa[j][q]), m = mean(x); d.push(m); se.push(Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, F - 1) / F)); } return { d, se }; };
const T = { A: 0, refine: { n: 0, ms: 0 }, B: { n: 0, ms: 0 } };
for (const id of Object.keys(JSON.parse(JSON.stringify({ mwg5v7k7j2cc: 1, mwg74y2d49gz: 1, mwb26snvis5o: 1 })))) {
  const G = load(id), { recs, n, names, win, me, steps, ev } = G, base = G.E.rv.base, F0 = FIX(id), raw = F0.behindRaw, fx = rehydrate(F0), shape = gameShape(fx);
  const label = {}; for (const q in G.E.rv.reviews) G.E.rv.reviews[q].results.forEach((x) => { label[x.i] = x.label; });
  const hex = G.E.state.hexes;
  // rounds
  const byR = new Map(); recs.forEach((r, i) => { const t = roundOf(r); if (!byR.has(t)) byR.set(t, []); byR.get(t).push(i); });
  const rounds = [...byR].map(([t, idx]) => { const a = idx[0], b = idx[idx.length - 1]; return { t, a, b, v0: G.V[a], v1: G.V[b + 1], d: G.V[b + 1].map((x, q) => x - G.V[a][q]) }; });
  const top = rounds.filter((r) => r.t > 1).sort((x, y) => Math.max(Math.abs(y.d[me]), Math.abs(y.d[win])) - Math.max(Math.abs(x.d[me]), Math.abs(x.d[win]))).slice(0, 4).sort((x, y) => x.t - y.t);
  const posW = (i) => G.W[i]; const refined = new Map();
  const itemOf = (i) => {
    const r = recs[i], dl = delta(G, i), s = r.s; const it = { i, k: r.k, pid: r.pid, d: dl.d, se: dl.se, chance: false, label: label[i] || null };
    if (r.k === "roll" || r.k === "turn") {
      const st = steps[s]; it.type = "roll"; it.chance = true; it.sum = st ? st[2] + st[3] : null;
      const P = ev.filter((e) => e[0] === s + 1 && e[1] === "P"); it.prod = {}; P.forEach((e) => { (it.prod[e[2]] = it.prod[e[2]] || []).push(...Array(e[5] || 1).fill(RES[e[4]])); });
      it.prodHex = [...new Set(P.map((e) => e[3]))].map((h) => ({ id: h, res: hex[h].resource, num: hex[h].number }));
    } else if (r.k === "robber") { it.type = "robber"; const h = hex[r.a.hex]; it.hex = { id: r.a.hex, res: h.resource, num: h.number }; const t = ev.find((e) => e[0] === s && e[1] === "t" && e[2] === r.pid); if (t) it.steal = { from: t[3] }; }
    else if (r.k === "build") { it.type = "build"; it.what = r.a.type; it.at = r.a.id; }
    else if (r.k === "buy") { it.type = "dev"; it.chance = true; const v = ev.find((e) => e[0] === s && e[1] === "v" && e[2] === r.pid); it.card = v ? v[3] : null; }
    else if (r.k === "play") { it.type = "play"; it.card = r.a.t; }
    else if (r.k === "bank") { it.type = "bank"; it.tr = r.a.tr; }
    else if (r.k === "ptrade") { it.type = "ptrade"; }
    else it.type = r.k;
    return it;
  };
  const focus = [];
  for (const R of top) {
    const items = []; for (let i = R.a; i <= R.b; i++) { if (!G.W[i] || !G.W[i + 1]) continue; items.push(itemOf(i)); }
    // refine the big items at F=100 (paired seeds: the first 25 futures are the A ones)
    for (const it of items) {
      if (Math.max(Math.abs(it.d[me]), Math.abs(it.d[win])) < 0.05) continue;
      const t0 = performance.now(); const a = valueAt(g, base, recs[it.i], { futures: 100 }), Wa = a.W.map(norm);
      let Wb; if (it.i + 1 < recs.length) Wb = valueAt(g, base, recs[it.i + 1], { futures: 100 }).W.map(norm); else Wb = Wa.map(() => G.W[G.W.length - 1][0]);
      const p = pair(Wa, Wb, n); it.d100 = p.d; it.se100 = p.se; it.va = Array.from({ length: n }, (_, q) => mean(Wa.map((f) => f[q]))); it.vb = Array.from({ length: n }, (_, q) => mean(Wb.map((f) => f[q]))); T.refine.n++; T.refine.ms += performance.now() - t0;
    }
    // round endpoints at F=100 (telescoping total of the round)
    { const t0 = performance.now(), A0 = valueAt(g, base, recs[R.a], { futures: 100 }).W.map(norm); const Wb = R.b + 1 < recs.length ? valueAt(g, base, recs[R.b + 1], { futures: 100 }).W.map(norm) : A0.map(() => G.W[G.W.length - 1][0]);
      R.p100 = pair(A0, Wb, n); R.v0r = Array.from({ length: n }, (_, q) => mean(A0.map((f) => f[q]))); R.v1r = Array.from({ length: n }, (_, q) => mean(Wb.map((f) => f[q]))); T.refine.n++; T.refine.ms += performance.now() - t0; }
    // B: progress credit per player-turn: the position at the end of the turn's actions vs "end turn instead" right after the roll (same futures)
    const turns = [];
    for (const pidv of [...new Set(items.map((x) => x.pid))]) {
      const mine = items.filter((x) => x.pid === pidv && ["build", "bank", "play", "ptrade", "dev"].includes(x.type)); if (!mine.length) continue;
      const first = mine[0], lastAct = mine[mine.length - 1], endIdx = lastAct.i + 1; // the position after the last action
      const t0 = performance.now(), pv = valueAt(g, base, recs[first.i], { futures: 25, pass: true }), Wp = pv.W.map(norm);
      const p = pair(Wp, G.W[endIdx], n); T.B.n++; T.B.ms += performance.now() - t0;
      turns.push({ pid: pidv, from: first.i, to: lastAct.i, acts: mine.map((x) => x.i), d: p.d, se: p.se, drawn: mine.some((x) => x.type === "dev") });
    }
    focus.push({ t: R.t, a: R.a, b: R.b, v0: R.v0r, v1: R.v1r, d: R.p100.d, se: R.p100.se, d25: R.d, items, turns });
  }
  // C: mechanism for me and the winner at the focus rounds
  const mech = {};
  for (const R of top) {
    const m = {}; for (const q of new Set([me, win])) {
      const t = R.t, inc = M.incomeAt(raw, t, q), nv = M.needsVsIncome(raw, t, q), rb = M.reachSpots(raw, t - 1, q), ra = M.reachSpots(raw, t + 1, q), rl = M.robberLosses(raw, t, q);
      const lost = []; for (let u = t; u <= t + 3; u++) { const rr = M.reachSpots(raw, u, q); rb.spots.filter((s) => s.d <= 1).forEach((s) => { if (!rr.spots.some((x) => x.n === s.n) && !lost.some((l) => l.n === s.n)) { const b = raw.ev.find((e) => e[0] === u && e[1] === "b" && e[3] !== "r" && (e[4] === s.n || raw.nodes[s.n].nb.includes(e[4]))); lost.push({ n: s.n, pips: s.pips, d: s.d, turn: u, by: b ? b[2] : null, on: b ? b[4] : null }); } }); }
      m[q] = { inc, need: nv, reachBefore: { w0: rb.within0, w1: rb.within1, w2: rb.within2, best: rb.spots.slice(0, 3) }, reachAfter: { w0: ra.within0, w1: ra.within1, w2: ra.within2 }, lost, rob: rl };
    }
    mech[R.t] = m;
  }
  const out = { id, names, me, winner: win, T: F0.T, n, shape, wc: Array.from({ length: n }, (_, q) => Array.from({ length: F0.T + 1 }, (_, t) => fx.wc(q, t))), rounds: rounds.map((r) => ({ t: r.t, d: r.d, v0: r.v0, v1: r.v1 })), focus, mech, F: G.A.F, timeA: G.A.total, valuedA: G.A.valued };
  fs.writeFileSync(DIR + id + ".story.json", JSON.stringify(out));
  console.log(id, "shape", shape?.id, "focus rounds", top.map((r) => r.t).join(","), "items", focus.reduce((a, f) => a + f.items.length, 0));
}
console.log("refine", T.refine.n, "positions-pairs, s", (T.refine.ms / 1000).toFixed(1), "| B", T.B.n, "valuations s", (T.B.ms / 1000).toFixed(1));
process.exit(0);
