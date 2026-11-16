// does the decision engine's value of the played move (win, d20 n100) agree with the luck series (d7 MC) at the end of that step?
const { load } = require("./ledger.js"); const S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/", UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const files = ["23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f).concat(S + "mwbvik30avfn.json");
const pairs = [], sums = [];
for (const f of files) {
  const G = load(f), res = G.rv.luck.res, N = G.state.stats.steps.length;
  const bRaw = new Map(), aRaw = new Map();
  for (const k in res) { const r = res[k]; if (r.k === "dice" && r.b) { bRaw.set(r.s, r.b); aRaw.set(r.s, r.b.map((v, q) => v + r.l[q])); } }
  for (const q in G.rv.reviews) for (const x of G.rv.reviews[q].results) {
    if (!x.seats || x.skip === "forced" || x.k === "setup") continue;
    const s = x.s; const nb = bRaw.get(s), aa = aRaw.get(s - 1); if (!nb || !aa) continue;
    pairs.push({ w: x.win, post: nb[x.pid], rollA: aa[x.pid], k: x.k });
  }
  for (const k of bRaw.keys()) sums.push(bRaw.get(k).reduce((a, b) => a + b, 0));
  // repeated dice-b sum drift
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const cor = (a, b) => { const ma = mean(a), mb = mean(b); let c = 0, va = 0, vb = 0; a.forEach((x, i) => { c += (x - ma) * (b[i] - mb); va += (x - ma) ** 2; vb += (b[i] - mb) ** 2; }); return c / Math.sqrt(va * vb); };
console.log("pairs", pairs.length);
console.log("decision.win vs next pre-roll b (raw): corr", cor(pairs.map((p) => p.w), pairs.map((p) => p.post)).toFixed(2), "mean|diff| pts", (mean(pairs.map((p) => Math.abs(p.w - p.post))) * 100).toFixed(1), "mean signed", (mean(pairs.map((p) => p.w - p.post)) * 100).toFixed(1));
console.log("decision.win vs post-roll a=b+l (raw): corr", cor(pairs.map((p) => p.w), pairs.map((p) => p.rollA)).toFixed(2), "mean|diff|", (mean(pairs.map((p) => Math.abs(p.w - p.rollA))) * 100).toFixed(1));
console.log("sum of seats' b across events: mean", mean(sums).toFixed(3), "min", Math.min(...sums).toFixed(2), "max", Math.max(...sums).toFixed(2));
