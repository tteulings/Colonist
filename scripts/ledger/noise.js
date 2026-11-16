// noise floor of the win-chance series: if W_k = true_k + e_k (independent e), then cov(ΔW_k, ΔW_{k+1}) = -var(e)  (true increments uncorrelated)
const { load, norm } = require("./ledger.js"); const S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/", UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const files = ["23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f).concat(S + "mwbvik30avfn.json");
let c1 = 0, n1 = 0, v1 = 0, ses = [], c2 = 0, n2 = 0, v2 = 0;
for (const f of files) {
  const G = load(f), res = G.rv.luck.res, N = G.state.stats.steps.length, n = G.state.players.length;
  const W = []; for (const k in res) { const r = res[k]; if (r.k === "dice" && r.b) W[r.s] = norm(r.b); if (r.se) ses.push(Math.max(...r.se)); }
  // luck-removed series: V_k = W_k - cumulative luck is not clean; use raw step increments of W
  for (let q = 0; q < n; q++) for (let k = 2; k < N - 1; k++) { if (!W[k - 1] || !W[k] || !W[k + 1]) continue; const a = W[k][q] - W[k - 1][q], b = W[k + 1][q] - W[k][q]; c1 += a * b; v1 += a * a; n1++; }
  // 4-step (round) increments
  for (let q = 0; q < n; q++) for (let k = 4; k + 8 < N; k += 4) { if (!W[k] || !W[k + 4] || !W[k + 8]) continue; const a = W[k + 4][q] - W[k][q], b = W[k + 8][q] - W[k + 4][q]; c2 += a * b; v2 += a * a; n2++; }
}
ses.sort((a, b) => a - b);
console.log(`step increments: n=${n1} var ${(v1 / n1 * 1e4).toFixed(1)} pts², lag-1 cov ${(c1 / n1 * 1e4).toFixed(1)} => noise sd per W value ~ ${(Math.sqrt(Math.max(0, -c1 / n1)) * 100).toFixed(1)} pts (corr ${(c1 / v1).toFixed(2)})`);
console.log(`4-step increments: n=${n2} var ${(v2 / n2 * 1e4).toFixed(1)} lag-1 cov ${(c2 / n2 * 1e4).toFixed(1)} => noise sd ~ ${(Math.sqrt(Math.max(0, -c2 / n2)) * 100).toFixed(1)} pts (corr ${(c2 / v2).toFixed(2)})`);
console.log(`stored luck se (max over seats) per event: median ${(ses[ses.length >> 1] * 100).toFixed(1)}, p90 ${(ses[Math.floor(ses.length * .9)] * 100).toFixed(1)} pts`);
