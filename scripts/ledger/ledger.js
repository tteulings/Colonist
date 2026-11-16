// Win-chance accounting ledger: per round t and seat q   delta = luck + decisions + residual   (measurement script, no product code)
// usage: node ledger.js out.json game1.json game2.json ...   (review exports {state,rv} ; fixture-style also fine)
const fs = require("fs");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const norm = (v) => { const s = v.reduce((a, c) => a + (c || 0), 0); return s > 0 ? v.map((c) => (c || 0) / s) : v; };
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const zeros = (n) => Array(n).fill(0);
function load(f) { const E = JSON.parse(fs.readFileSync(f, "utf8")); return { id: E.meta?.id || E.state?.stats?.id, state: E.state, rv: E.rv, meta: E.meta }; }

function ledger(G) {
  const { state, rv } = G, st = state.stats, steps = st.steps, N = steps.length, n = state.players.length;
  const res = rv.luck.res, W = new Map(); // W[k] normalised win chance after k steps (pre-roll of 0-based step k)
  const fin = Array.from({ length: n }, (_, q) => (q === state.winnerId ? 1 : 0));
  const raw = new Map();
  for (const key in res) { const r = res[key]; if (r.k === "dice" && r.b) { W.set(r.s, norm(r.b)); raw.set(r.s, r.b); } }
  const v0 = res["seat:0:-1"]?.v; if (v0) { W.set(0, norm(v0)); raw.set(0, v0); } // k=0 is also a dice b, seat v wins
  W.set(N, fin); raw.set(N, fin);
  const turnOf = (k) => (k <= 0 ? 0 : steps[Math.min(k, N) - 1][0]);
  const T = turnOf(N);
  const lastStep = [0]; for (let t = 1; t <= T; t++) { let l = lastStep[t - 1]; for (let k = 1; k <= N; k++) if (turnOf(k) === t) l = k; lastStep.push(l); }
  const rows = []; // rows[t] = per-seat arrays
  const mk = () => ({ d: zeros(n), dr: zeros(n), luck: zeros(n), lr: zeros(n), lD: zeros(n), lS: zeros(n), lV: zeros(n), dec: zeros(n), decR: zeros(n), decOwn: zeros(n), decOpp: zeros(n), nDec: 0, nEv: 0, seatLoss: zeros(n) });
  for (let t = 1; t <= T; t++) rows[t] = mk();
  const miss = [];
  for (let t = 1; t <= T; t++) {
    const a = W.get(lastStep[t - 1]), b = W.get(lastStep[t]);
    if (!a || !b) { rows[t] = null; miss.push(t); continue; }
    rows[t].d = sub(b, a);
    rows[t].dr = sub(raw.get(lastStep[t]), raw.get(lastStep[t - 1]));
    rows[t].vp = sub(st.vp[Math.min(lastStep[t], st.vp.length - 1)], st.vp[Math.min(lastStep[t - 1], st.vp.length - 1)]);
  }
  // dice event s = the roll of 1-based step s+1; steal / dev events and decision records with s are inside step s (steps recorded when they happen)
  for (const key in res) {
    const r = res[key]; if (!r.l || r.k === "seat") continue;
    const t = r.k === "dice" ? turnOf(r.s + 1) : turnOf(Math.max(1, r.s)); const R = rows[t]; if (!R) continue;
    const bn = W.get(r.s); let ln;
    if (r.k === "dice") { const aft = norm(add(r.b, r.l)); ln = sub(aft, norm(r.b)); }
    else { const bb = (r.b ? norm(r.b) : bn); const sc = r.b ? r.b.reduce((x, y) => x + y, 0) : 1; ln = r.l.map((x) => x / (sc || 1)); }
    R.luck = add(R.luck, ln); R.lr = add(R.lr, r.l); R.nEv++;
    const bucket = r.k === "dice" ? "lD" : r.k === "steal" ? "lS" : "lV"; R[bucket] = add(R[bucket], ln);
  }
  // decisions of every seat
  const cover = { total: 0, scored: 0, trivial: 0, forced: 0, noBest: 0 };
  const decList = [];
  for (const pid of Object.keys(rv.reviews)) for (const x of rv.reviews[pid].results) {
    cover.total++;
    if (x.skip === "forced" || x.skip === "n/a") { cover.forced++; continue; }
    if (!x.seats) continue;
    if (!x.best || !x.best.seats) { cover.noBest++; continue; }
    if (x.skip === "trivial") cover.trivial++; else cover.scored++;
    const t = x.k === "setup" ? 1 : turnOf(Math.max(1, x.s)); const R = rows[t]; if (!R) continue;
    const eff = sub(norm(x.seats), norm(x.best.seats)); // played minus best, normalised
    const effR = sub(x.seats, x.best.seats);
    R.dec = add(R.dec, eff); R.decR = add(R.decR, effR); R.nDec++;
    for (let q = 0; q < n; q++) (q === x.pid ? R.decOwn : R.decOpp)[q] += eff[q];
    decList.push({ t, pid: x.pid, k: x.k, label: x.label, best: x.best.label, eff, loss: x.loss, cls: x.mark, skip: x.skip });
  }
  return { id: G.id, n, T, N, rows, miss, cover, decList, turnOf, lastStep, W, raw };
}
module.exports = { ledger, load, norm };

if (require.main === module) {
  const [out, ...files] = process.argv.slice(2); const all = {};
  for (const f of files) { const G = load(f); const L = ledger(G); all[G.id] = { id: L.id, T: L.T, miss: L.miss, cover: L.cover, rows: L.rows, decList: L.decList }; }
  fs.writeFileSync(out, JSON.stringify(all)); console.log("ok", Object.keys(all));
}
