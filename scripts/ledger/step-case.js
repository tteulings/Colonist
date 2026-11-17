const { build, norm, sub, add, P } = require("./step-an.js");
const [id, T, topN = 12] = [process.argv[2], +process.argv[3], +process.argv[4] || 12];
const A = build(id, "A"), { R, E, n, V, names, res } = A, st = E.state.stats, W = A.win;
const labelOf = {}; for (const q in E.rv.reviews) E.rv.reviews[q].results.forEach((x) => { labelOf[x.i] = x.label; });
const luckAt = (kind, s) => { const k = Object.keys(res).find((k) => res[k].k === kind && res[k].s === s); if (!k) return null; const r = res[k], sc = r.b ? r.b.reduce((a, c) => a + c, 0) : 1; return r.l.map((x) => x / (sc || 1)); };
const idx = R.recs.map((r, i) => i).filter((i) => (R.recs[i].k === "setup" ? 1 : R.recs[i].t) === T);
const first = idx[0], last = idx[idx.length - 1];
const rows = [];
for (const i of idx) {
  const r = R.recs[i]; if (!V[i] || !V[i + 1]) continue; const d = sub(V[i + 1], V[i]); let ch = null, what = r.k;
  if (r.k === "roll" || r.k === "turn") { const sp = st.steps[r.s]; what = `${names[r.pid]} rolls ${sp ? sp[2] + sp[3] : "?"}`; ch = d; }
  else { const mv = names[r.pid]; what = `${mv} ${r.k}: ${labelOf[i] || ""}`; const l = r.k === "robber" || r.k === "pirate" ? luckAt("steal", r.s) : r.k === "buy" ? luckAt("dev", r.s) : null; if (l) ch = l; }
  rows.push({ i, what, d, ch, k: r.k, pid: r.pid });
}
const tot = rows.reduce((a, r) => add(a, r.d), Array(n).fill(0));
console.log(`${id} round ${T}: recs ${first}..${last} (${rows.length} steps)  seats ${names.join(" / ")}  winner ${names[W]}`);
console.log("win chance start", V[first].map((x) => (x * 100).toFixed(0) + "%").join(" "), " end", V[last + 1].map((x) => (x * 100).toFixed(0) + "%").join(" "));
console.log("sum of step deltas", P(tot), "  (endpoint difference", P(sub(V[last + 1], V[first])), ")");
const chanceSum = rows.reduce((a, r) => (r.ch ? add(a, r.ch) : a), Array(n).fill(0));
console.log("of which chance (dice + steal + dev draw)", P(chanceSum), " | actions (rest)", P(sub(tot, chanceSum)));
console.log("top steps by |Δ You|+|Δ winner| (cols: You, then each seat), chance part in brackets:");
const sc = (r) => Math.abs(r.d[0]) + (W !== 0 ? Math.abs(r.d[W]) : 0);
rows.sort((a, b) => sc(b) - sc(a)).slice(0, topN).forEach((r) => console.log(` #${String(r.i).padStart(3)} ${r.what.slice(0, 58).padEnd(58)} ${P(r.d)}${r.ch ? "  [chance " + P(r.ch) + "]" : ""}`));
