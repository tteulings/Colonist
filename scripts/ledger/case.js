const { ledger, load, norm } = require("./ledger.js");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const [file, T] = [process.argv[2], +process.argv[3]];
const G = load(UP + file), L = ledger(G), st = G.state.stats, res = G.rv.luck.res, names = G.state.players.map((p) => p.name);
const P = (v) => v.map((x) => ((x >= 0 ? "+" : "") + (x * 100).toFixed(1)).padStart(6)).join(" ");
const Pw = (v) => v.map((x) => (x * 100).toFixed(0).padStart(5) + "%").join(" ");
console.log(file, "round", T, "| seats:", names.join(" / "));
const k0 = L.lastStep[T - 1], k1 = L.lastStep[T];
console.log("win chance (normalised) after round", T - 1, Pw(L.W.get(k0)), "  after round", T, Pw(L.W.get(k1)));
const R = L.rows[T];
console.log("Δ                      ", P(R.d));
console.log("luck dice / steal / dev", P(R.lD), "|", P(R.lS), "|", P(R.lV));
console.log("luck total             ", P(R.luck), `(${R.nEv} events)`);
console.log("decisions (played-best)", P(R.dec), `(${R.nDec} costed)`, "  own:", P(R.decOwn));
console.log("residual Δ-luck-dec    ", P(R.d.map((x, q) => x - R.luck[q] - R.dec[q])));
console.log("residual Δ-luck        ", P(R.d.map((x, q) => x - R.luck[q])));
console.log("\nevents (step s, 0-based; roller from steps):");
for (let s = k0; s < k1; s++) {
  const stp = st.steps[s]; const keys = Object.keys(res).filter((k) => res[k].k !== "seat" && (res[k].k === "dice" ? res[k].s === s : res[k].s === s + 1));
  const rn = keys.map((k) => { const r = res[k]; const ln = r.k === "dice" ? (() => { const a = norm(r.b.map((v, q) => v + r.l[q])), b0 = norm(r.b); return a.map((v, q) => v - b0[q]); })() : r.l; return `${r.k}${r.k === "dice" ? "(" + (stp[2] + stp[3]) + ")" : ""} ${P(ln)}  se±${(Math.max(...r.se) * 100).toFixed(1)}`; });
  console.log(` step ${s} turn ${stp[0]} roller ${names[stp[1]]} rolled ${stp[2] + stp[3]}:`); rn.forEach((x) => console.log("     luck:", x));
  // the log events (builds etc.)
  const evs = st.ev.filter((e) => e[0] === s + 1 || e[0] === s).filter((e) => e[0] === s + 1 && e[1] !== "P");
}
console.log("\ndecisions in this round (every seat):");
L.decList.filter((d) => d.t === T).forEach((d) => console.log(` ${names[d.pid]} [${d.k}${d.skip ? "/" + d.skip : ""} ${d.cls}] played "${d.label}"  best "${d.best}"  effect ${P(d.eff)}  mover loss(shrunk) ${(d.loss * 100).toFixed(1)}`));
console.log("\nunscored/forced decisions this round:");
const kinds = {}; for (const q in G.rv.reviews) G.rv.reviews[q].results.forEach((x) => { const t = x.k === "setup" ? 1 : L.turnOf(Math.max(1, x.s)); if (t !== T) return; const key = `${names[x.pid]} ${x.k}/${x.skip || (x.best ? "scored" : "played=best")}`; kinds[key] = (kinds[key] || 0) + 1; }); console.log(kinds);
console.log("\nboard events this round (b=build ..):", st.ev.filter((e) => e[0] > k0 && e[0] <= k1 && ["b", "t", "v", "a", "d", "X", "x", "k", "y", "m", "o"].includes(e[1])).map((e) => JSON.stringify(e)).join(" "));
console.log("vp before/after", JSON.stringify(st.vp[k0]), JSON.stringify(st.vp[k1]));
