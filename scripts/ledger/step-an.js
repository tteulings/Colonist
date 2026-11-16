// node step-an.js  : telescoping per-step ledger from step.mjs output
const fs = require("fs"); const S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/step/", UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const EXP = { mwfdvqb2dmnw: UP + "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", mwg74y2d49gz: UP + "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", mwg5v7k7j2cc: UP + "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", mwb26snvis5o: UP + "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", mwbvik30avfn: S + "mwbvik30avfn.export.json" };
const norm = (v) => { const s = v.reduce((a, c) => a + c, 0); return s > 0 ? v.map((c) => c / s) : v; };
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]);
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const P = (v) => v.map((x) => ((x >= 0 ? "+" : "") + (x * 100).toFixed(1)).padStart(6)).join(" ");
function build(id, which = "A") {
  const R = JSON.parse(fs.readFileSync(S + id + ".F50.json")), E = JSON.parse(fs.readFileSync(EXP[id])), n = E.state.players.length, N = E.state.stats.steps.length;
  const fin = Array.from({ length: n }, (_, q) => (q === E.state.winnerId ? 1 : 0));
  const arr = R.runs[which].arr, V = [];
  for (let i = 0; i < arr.length; i++) V.push(arr[i] ? norm(arr[i].v) : null);
  V.push(fin);
  return { id, R, E, n, N, V, names: E.state.players.map((p) => p.name), win: E.state.winnerId, res: E.rv.luck.res };
}
module.exports = { build, EXP, S, norm, sub, add, sd, P };
if (require.main === module) {
  const out = [];
  let tot = { A: 0, B: 0, pos: 0 };
  const noiseV = [], noiseD = [], noiseDk = {}, endAbs = [], diffW = [], diffA = [], roundNoise = [], dmag = [];
  for (const id of Object.keys(EXP)) {
    const A = build(id, "A"), B = build(id, "B"), { R, E, n } = A;
    tot.A += R.runs.A.totalMs; tot.B += R.runs.B.totalMs; tot.pos += R.runs.A.arr.filter(Boolean).length;
    const nr = R.recs.length;
    // consecutive steps
    for (let i = 0; i < nr; i++) {
      if (!A.V[i] || !B.V[i]) continue;
      for (let q = 0; q < n; q++) noiseV.push((A.V[i][q] - B.V[i][q]) / Math.SQRT2);
      if (A.V[i + 1] && B.V[i + 1]) { const dA = sub(A.V[i + 1], A.V[i]), dB = sub(B.V[i + 1], B.V[i]); for (let q = 0; q < n; q++) { noiseD.push((dA[q] - dB[q]) / Math.SQRT2); dmag.push((dA[q] + dB[q]) / 2); (noiseDk[R.recs[i].k] = noiseDk[R.recs[i].k] || []).push([(dA[q] - dB[q]) / Math.SQRT2, (dA[q] + dB[q]) / 2]); } }
    }
    // compare with the existing luck series endpoints: pre-roll b (avg over variants) of dice event s == my V at the roll/turn rec with that s
    for (let i = 0; i < nr; i++) { const r = R.recs[i]; if (r.k !== "roll" && r.k !== "turn") continue; const key = Object.keys(A.res).find((k) => A.res[k].k === "dice" && A.res[k].s === r.s); if (!key || !A.V[i]) continue; const b = norm(A.res[key].b), a = norm(A.res[key].b.map((v, q) => v + A.res[key].l[q]));
      for (let q = 0; q < n; q++) diffW.push(A.V[i][q] - b[q]);
      // after the roll: my value of the next record's position vs a = b + l
      if (A.V[i + 1]) for (let q = 0; q < n; q++) diffA.push(A.V[i + 1][q] - a[q]);
    }
  }
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length, ab = (a) => m(a.map(Math.abs));
  console.log(`positions valued ${tot.pos}; time per game at F=50 (run A): ${(tot.A / 5000).toFixed(0)} s avg`);
  console.log(`position noise sd at F=50: ${(sd(noiseV) * 100).toFixed(2)} pts (per seat)`);
  console.log(`step-delta noise sd (common futures within a run): ${(sd(noiseD) * 100).toFixed(2)} pts; mean|step delta| ${(ab(dmag) * 100).toFixed(2)}`);
  for (const k of Object.keys(noiseDk)) console.log(`   ${k.padEnd(7)} n=${noiseDk[k].length / 4} step: noise sd ${(sd(noiseDk[k].map((x) => x[0])) * 100).toFixed(2)}  mean|Δ| ${(ab(noiseDk[k].map((x) => x[1])) * 100).toFixed(2)}`);
  console.log(`my pre-roll V vs existing series b: mean|diff| ${(ab(diffW) * 100).toFixed(2)} pts, signed ${(m(diffW) * 100).toFixed(2)}; my post-roll V vs existing a=b+l: mean|diff| ${(ab(diffA) * 100).toFixed(2)}`);
}
