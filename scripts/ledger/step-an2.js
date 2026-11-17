const { build, EXP, norm, sub, add } = require("./step-an.js");
const m = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1), ab = (a) => m(a.map(Math.abs));
const cor = (a, b) => { const ma = m(a), mb = m(b); let c = 0, va = 0, vb = 0; a.forEach((x, i) => { c += (x - ma) * (b[i] - mb); va += (x - ma) ** 2; vb += (b[i] - mb) ** 2; }); return c / Math.sqrt(va * vb); };
const rows = [], pairs = [], rd = [];
for (const id of Object.keys(EXP)) {
  const A = build(id, "A"), B = build(id, "B"), { R, E, n, V, res } = A, nr = R.recs.length;
  const costOf = {}; for (const q in E.rv.reviews) E.rv.reviews[q].results.forEach((x) => { if (x.seats && x.best && x.best.seats && !x.skip) costOf[x.i] = norm(x.seats)[x.pid] - norm(x.best.seats)[x.pid]; });
  const steps = E.state.stats.steps, N = steps.length;
  const T = Math.max(...R.recs.map((r) => r.t || 0)); const byRound = {};
  for (let i = 0; i < nr; i++) { if (!V[i] || !V[i + 1]) continue; const r = R.recs[i], t = r.k === "setup" ? 1 : r.t; if (!t) continue; const d = sub(V[i + 1], V[i]); const o = (byRound[t] = byRound[t] || { chance: Array(n).fill(0), own: Array(n).fill(0), opp: Array(n).fill(0), setup: Array(n).fill(0), end: Array(n).fill(0), first: i, last: i, tot: Array(n).fill(0) }); o.last = i;
    const chance = r.k === "roll" || r.k === "turn" || r.k === "buy" || r.k === "robber";
    const bucket = r.k === "setup" ? "setup" : chance ? "chance" : r.k === "end" ? "end" : null;
    for (let q = 0; q < n; q++) { o.tot[q] += d[q]; if (bucket) o[bucket][q] += d[q]; else (q === r.pid ? o.own : o.opp)[q] += d[q]; }
    if (costOf[i] != null && (r.k === "build" || r.k === "bank" || r.k === "play" || r.k === "end")) pairs.push([d[r.pid], costOf[i]]);
  }
  for (const t in byRound) { const o = byRound[t]; for (let q = 0; q < n; q++) rows.push({ id, t: +t, q, tot: o.tot[q], chance: o.chance[q], own: o.own[q], opp: o.opp[q], setup: o.setup[q], end: o.end[q] });
    // existing series round delta
  }
}
const stat = (name, sel) => { const r = rows.filter(sel); console.log(`${name}: n=${r.length} mean|Δ| ${(ab(r.map((x) => x.tot)) * 100).toFixed(1)}; mean|chance steps| ${(ab(r.map((x) => x.chance)) * 100).toFixed(1)}; |own actions| ${(ab(r.map((x) => x.own)) * 100).toFixed(1)}; |opponents' actions| ${(ab(r.map((x) => x.opp)) * 100).toFixed(1)}; |end turn| ${(ab(r.map((x) => x.end)) * 100).toFixed(1)}; |setup| ${(ab(r.map((x) => x.setup)) * 100).toFixed(1)}; share of Σ|Δ| carried by chance steps (sign-consistent part): corr(chance,Δ)=${cor(r.map((x) => x.chance), r.map((x) => x.tot)).toFixed(2)}, R² ${(cor(r.map((x) => x.chance), r.map((x) => x.tot)) ** 2 * 100).toFixed(0)}%; corr(own+opp actions,Δ) ${cor(r.map((x) => x.own + x.opp), r.map((x) => x.tot)).toFixed(2)}`); };
stat("all rounds", () => true); stat("t>1", (x) => x.t > 1); stat("big |Δ|>=10", (x) => Math.abs(x.tot) >= 0.1);
// others' moves: mover vs non-mover
console.log(`mover step delta vs played-minus-best cost (scored decisions, mover seat): n=${pairs.length}, corr ${cor(pairs.map((p) => p[0]), pairs.map((p) => p[1])).toFixed(2)}, mean Δmover ${(m(pairs.map((p) => p[0])) * 100).toFixed(2)}, mean cost ${(m(pairs.map((p) => p[1])) * 100).toFixed(2)}`);
