// can "value of the played move vs End turn (doing nothing)" (cands[].win, mover only) explain the part of delta the ledger leaves open?
const { ledger, load } = require("./ledger.js"); const S = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/ledger/", UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const files = ["23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f).concat(S + "mwbvik30avfn.json");
const rows = []; let withEnd = 0, tot = 0;
for (const f of files) {
  const G = load(f), L = ledger(G), n = L.n;
  const gain = {}; // `${t}|${pid}` -> sum (win played - win end) over kinds build/buy/play/bank
  for (const q in G.rv.reviews) for (const x of G.rv.reviews[q].results) {
    if (x.skip === "forced" || x.skip === "n/a" || !x.cands) continue; if (!["build", "buy", "play", "bank"].includes(x.k)) continue; tot++;
    const end = x.cands.find((c) => /^End turn/.test(c.label)); if (!end || x.win == null || end.win == null) continue; withEnd++;
    const t = x.t; const key = `${t}|${x.pid}`; gain[key] = (gain[key] || 0) + (x.win - end.win);
  }
  for (let t = 2; t <= L.T; t++) { const R = L.rows[t]; if (!R) continue; for (let q = 0; q < n; q++) { const lk = R.luck[q], dec = R.dec[q]; rows.push({ x: gain[`${t}|${q}`] || 0, y: R.d[q] - lk - dec, y2: R.d[q] - lk, d: R.d[q] }); } }
}
const m = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const cov = (a, b) => { const ma = m(a), mb = m(b); return m(a.map((v, i) => (v - ma) * (b[i] - mb))); };
const x = rows.map((r) => r.x), y = rows.map((r) => r.y);
const nz = rows.filter((r) => r.x !== 0);
console.log("decisions with an End-turn candidate:", withEnd, "of", tot, "(build/buy/play/bank, not forced)");
console.log("seat-rounds", rows.length, "with a mover gain-vs-pass term:", nz.length);
const b = cov(x, y) / cov(x, x), r = cov(x, y) / Math.sqrt(cov(x, x) * cov(y, y));
console.log(`(Δ−luck−dec) ~ mover gain-vs-pass: slope ${b.toFixed(2)}, corr ${r.toFixed(2)}, R² ${(r * r * 100).toFixed(0)}%`);
const res = rows.map((r) => r.y - b * r.x);
console.log("mean|Δ−luck−dec| before", (m(y.map(Math.abs)) * 100).toFixed(1), "after progress term", (m(res.map(Math.abs)) * 100).toFixed(1), " (rows with the term only: before", (m(nz.map((r) => Math.abs(r.y))) * 100).toFixed(1), "after", (m(nz.map((r) => Math.abs(r.y - b * r.x))) * 100).toFixed(1) + ")");
