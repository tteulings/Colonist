const pool = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/pool.json");
function ols(X, y) { // normal equations
  const k = X[0].length, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  X.forEach((x, i) => { for (let a = 0; a < k; a++) { b[a] += x[a] * y[i]; for (let c = 0; c < k; c++) A[a][c] += x[a] * x[c]; } });
  for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < k; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < k; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
  const w = Array(k).fill(0); for (let i = k - 1; i >= 0; i--) { w[i] = (b[i] - A[i].slice(i + 1).reduce((s, v, j) => s + v * w[i + 1 + j], 0)) / A[i][i]; } return w;
}
const P = (x) => (x * 100).toFixed(1);
for (const [name, sel] of [["ALL", () => true], ["t>1", (r) => r.t > 1], ["BIG", (r) => Math.abs(r.d) >= 0.1]]) {
  const rows = pool.filter(sel); const y = rows.map((r) => r.d - r.lk);
  const my = y.reduce((a, b) => a + b, 0) / y.length; const sst = y.reduce((a, v) => a + (v - my) ** 2, 0);
  const fit = (lab, f) => { const X = rows.map((r) => [1, ...f(r)]); const w = ols(X, y); const sse = X.reduce((a, x, i) => a + (y[i] - x.reduce((s, v, j) => s + v * w[j], 0)) ** 2, 0);
    const mae = X.reduce((a, x, i) => a + Math.abs(y[i] - x.reduce((s, v, j) => s + v * w[j], 0)), 0) / y.length;
    console.log(`${name} n=${rows.length} (Δ−luck) ~ ${lab}: coef ${w.map((v) => v.toFixed(2)).join(", ")}  R² ${(100 * (1 - sse / sst)).toFixed(0)}%  mean|res| ${P(mae)}`); };
  console.log(`${name}: mean|Δ−luck| ${P(y.reduce((a, v) => a + Math.abs(v), 0) / y.length)}`);
  fit("own", (r) => [r.own]); fit("vp", (r) => [r.vp]); fit("vp,vpOthers", (r) => [r.vp, r.vpo]); fit("vp,vpo,own,opp", (r) => [r.vp, r.vpo, r.own, r.opp]); fit("own+opp", (r) => [r.own, r.opp]); fit("dec(all)", (r) => [r.dec]);
}
