const { ledger, load } = require("./ledger.js");
const fs = require("fs"), UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/";
const files = [UP + "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", UP + "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", UP + "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", UP + "c96a5156-colonist-2026-11-11-mwb26snvis5o.json", S + "mwbvik30avfn.json"];
const P = (x) => (x * 100).toFixed(1);
const pool = []; // {t, q, d, L, Dall, Down, R, game}
for (const f of files) {
  const G = load(f); if (!G.id) G.id = "mwbvik30avfn"; const L = ledger(G);
  console.log("game", L.id, "T", L.T, "missingRounds", L.miss.join(), "decisions", JSON.stringify(L.cover));
  for (let t = 1; t <= L.T; t++) { const R = L.rows[t]; if (!R) continue; for (let q = 0; q < L.n; q++) pool.push({ g: L.id, t, q, d: R.d[q], dr: R.dr[q], lk: R.luck[q], lr: R.lr[q], dec: R.dec[q], decR: R.decR[q], own: R.decOwn[q], opp: R.decOpp[q], lD: R.lD[q], lS: R.lS[q], lV: R.lV[q], vp: R.vp[q], vpo: (R.vp.reduce((a, b) => a + b, 0) - R.vp[q]) / (L.n - 1) }); }
}
const stat = (name, sel) => {
  const rows = pool.filter(sel); if (!rows.length) return;
  const m = (f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const sumAbs = (f) => rows.reduce((a, r) => a + Math.abs(f(r)), 0), sumSq = (f) => rows.reduce((a, r) => a + f(r) ** 2, 0);
  const dA = sumAbs((r) => r.d), dS = sumSq((r) => r.d);
  const rep = (lab, exp) => {
    const res = (r) => r.d - exp(r);
    const signOk = rows.filter((r) => Math.abs(r.d) > 0.02 && Math.abs(exp(r)) > 0.005).length;
    const agree = rows.filter((r) => Math.abs(r.d) > 0.02 && Math.abs(exp(r)) > 0.005 && Math.sign(r.d) === Math.sign(exp(r))).length;
    return `${lab.padEnd(26)} mean|res| ${P(sumAbs(res) / rows.length)}  explained(1-Σ|res|/Σ|Δ|) ${(100 * (1 - sumAbs(res) / dA)).toFixed(0)}%  R² ${(100 * (1 - sumSq(res) / dS)).toFixed(0)}%  signAgree ${agree}/${signOk}`;
  };
  console.log(`\n== ${name}: n=${rows.length} seat-rounds, mean|Δ| ${P(sumAbs((r) => r.d) / rows.length)} pts`);
  console.log(rep("luck only", (r) => r.lk));
  console.log(rep("own decisions only", (r) => r.own));
  console.log(rep("all decisions only", (r) => r.dec));
  console.log(rep("luck + own decisions", (r) => r.lk + r.own));
  console.log(rep("luck + all decisions", (r) => r.lk + r.dec));
  console.log(rep("RAW scale luck+all dec", (r) => r.lr + r.decR) + `  (raw Δ: ${P(sumAbs((r) => r.dr) / rows.length)})`);
  console.log(`mean luck ${P(m((r) => r.lk))} mean dec ${P(m((r) => r.dec))}  mean Δ ${P(m((r) => r.d))}; mean|luck| ${P(sumAbs((r) => r.lk) / rows.length)}, mean|dec| ${P(sumAbs((r) => r.dec) / rows.length)} mean|dec of others'| ${P(sumAbs((r) => r.opp) / rows.length)}`);
  console.log(`luck parts mean|.|: dice ${P(sumAbs((r) => r.lD) / rows.length)} steal ${P(sumAbs((r) => r.lS) / rows.length)} dev ${P(sumAbs((r) => r.lV) / rows.length)}`);
};
stat("ALL", () => true);
stat("BIG |Δ|>=10", (r) => Math.abs(r.d) >= 0.10);
stat("SMALL |Δ|<10", (r) => Math.abs(r.d) < 0.10);
stat("ALL excluding round 1 (setup)", (r) => r.t > 1);
const dump = pool.filter((r) => Math.abs(r.d) >= 0.10).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log("\nbig swings", dump.length, "of", pool.length);
fs.writeFileSync(S + "pool.json", JSON.stringify(pool));
