// eng-130 Grandmaster: one decision searched by several Web Workers at once (src/master/worker.js "sprep" / "srun").
// Every worker loads the same position and builds the same moves (agent.prepare); future j re-deals the hidden cards and fixes the
// dice the same way in every worker, so the futures can be split over the workers freely. This coordinator runs the race of
// src/master/search.js search0 (rounds, successive halving, the time slices, the early stop, the paired pick against the Expert's
// move) on the merged results. With a fixed budget and no early stop the result is the same as one worker's search0; with the
// early stop it is checked after each batch (search0: every 4 futures). Pure logic: `send(w, msg)` talks to worker w.
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const DEF = { n: 100, timeMs: 0, z: 1.0, minAdv: 0.002 };

const meanOf = (a) => { let s = 0, c = 0; for (const x of a) if (x != null) { s += x; c++; } return c ? s / c : 0; };
function pairedGap(a, b) {
  const d = []; a.forEach((v, j) => { const w = b[j]; if (v != null && w != null) d.push(v - w); });
  if (d.length < 2) return { m: d[0] || 0, se: Infinity, n: d.length };
  const m = d.reduce((x, y) => x + y, 0) / d.length;
  const se = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / (d.length - 1) / d.length);
  return { m, se, n: d.length };
}
/** search0's earlyLead on sparse arrays: the best live move leads each other one by more than z paired SE on >= nMin shared futures. */
function earlyLead(alive, vals, z, nMin) {
  let best = alive[0], bm = meanOf(vals[best]);
  for (const k of alive) { const m = meanOf(vals[k]); if (m > bm) { best = k; bm = m; } }
  for (const k of alive) {
    if (k === best) continue;
    const p = pairedGap(vals[best], vals[k]);
    if (p.n < nMin) return false;
    if (!(p.m > z * p.se + 1e-9)) return false;
  }
  return true;
}

/**
 * msg: { kind, state, trk, turnSerial, seat, opts }. W workers (W >= 1). Returns { choice, record } or null (nothing to choose, or a
 * worker failed: the caller then asks the Expert / a single worker).
 */
export async function parallelDecide(send, W, msg) {
  const o = { ...DEF, ...(msg.opts || {}) };
  const sid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const t0 = now();
  const preps = await Promise.all(Array.from({ length: W }, (_, w) => send(w, { ...msg, type: "sprep", sid })));
  const done = () => { for (let w = 0; w < W; w++) send(w, { type: "send", sid }); };
  if (preps.some((x) => !x || x.type === "error")) { done(); return null; }
  const P0 = preps[0];
  if (!P0.K) { done(); return null; }
  if (preps.some((x) => x.K !== P0.K || x.sig !== P0.sig)) { done(); return null; } // the workers disagree on the moves: never mix
  const K = P0.K;
  const NB = o.nPer ? o.nPer * K : o.n;
  const deadline = o.timeMs ? t0 + o.timeMs : Infinity;
  const vals = Array.from({ length: K }, () => []), vps = Array.from({ length: K }, () => []), seatW = o.seats ? Array.from({ length: K }, () => []) : null;
  const rounds = [];
  let used = 0, stop = "n", first = true;
  const R = o.noHalve ? 1 : Math.max(1, Math.ceil(Math.log2(K)));
  const B = Math.max(1, o.batch || 4); // futures per worker per message
  let alive = Array.from({ length: K }, (_, i) => i), j0 = 0;
  try {
    for (let r = 0; r < R && alive.length; r++) {
      const per = o.timeSlice ? 1e9 : Math.max(1, Math.floor((NB / R) / alive.length));
      const sliceEnd = o.timeSlice && o.timeMs ? t0 + o.timeMs * (r + 1) / R : Infinity;
      let j = j0, roundStop = null;
      while (j < j0 + per && used < NB * 1.05) {
        const end = Math.min(deadline, sliceEnd);
        if (j >= j0 + 2 && now() > end) { roundStop = now() > deadline ? "time" : "slice"; break; }
        // the next batch: futures j.. (as many as the budget allows), dealt round-robin over the workers
        const left = Math.min(j0 + per - j, Math.ceil((NB * 1.05 - used) / alive.length));
        const nb = Math.max(1, Math.min(left, B * W));
        const js = Array.from({ length: nb }, (_, q) => j + q);
        const share = Array.from({ length: W }, (_, w) => js.filter((_, q) => q % W === w));
        const budgetMs = Number.isFinite(end) ? Math.max(0, end - now()) : Infinity;
        const res = await Promise.all(share.map((sj, w) => (sj.length ? send(w, { type: "srun", sid, alive, js: sj, budgetMs, force: first || j < j0 + 2 }) : null)));
        if (res.some((x, w) => share[w].length && (!x || x.type === "error"))) { done(); return null; }
        first = false;
        let got = 0, short = false;
        res.forEach((x, w) => {
          if (!x) return;
          const sj = share[w];
          for (let q = 0; q < x.done; q++) {
            const jj = sj[q];
            alive.forEach((k, ai) => { vals[k][jj] = x.vals[ai][q]; vps[k][jj] = x.vps[ai][q]; if (seatW && x.seats) seatW[k][jj] = x.seats[ai][q]; });
          }
          got += x.done;
          if (x.done < sj.length) short = true;
        });
        used += got * alive.length;
        j += nb;
        if (short) { roundStop = now() > deadline ? "time" : "slice"; break; }
        if (o.earlyZ && j >= (o.earlyMin || 40) && alive.length >= 2 && earlyLead(alive, vals, o.earlyZ, o.earlyMin || 40)) { roundStop = "early"; break; }
      }
      const rec = { j0, j1: j, alive: alive.slice(), out: [] };
      rounds.push(rec);
      j0 = j;
      if (roundStop === "time" || roundStop === "early") { stop = roundStop; break; }
      if (r < R - 1) {
        const keep = Math.max(2, Math.ceil(alive.length / 2));
        const sorted = alive.slice().sort((a, b) => meanOf(vals[b]) - meanOf(vals[a]));
        const next = sorted.slice(0, keep);
        if (!next.includes(0)) next.push(0); // the Expert's pick always stays for the final paired test
        rec.out = alive.filter((k) => !next.includes(k));
        alive = next;
      }
    }
  } finally { done(); }
  // the pick: as search0 (paired against the Expert's move on the futures both played; only a finalist)
  const last = rounds[rounds.length - 1];
  const finalists = last ? last.alive.filter((k) => !last.out.includes(k)) : [0];
  let pick = 0, bestAdv = 0;
  const paired = vals.map((v, k) => {
    if (k === 0) return { m: 0, se: 0, n: v.filter((x) => x != null).length };
    const p = pairedGap(v, vals[0]);
    if (finalists.includes(k) && p.m > o.z * p.se + o.minAdv && p.m > bestAdv) { bestAdv = p.m; pick = k; }
    return p;
  });
  const ms = now() - t0;
  const dense = (a) => Array.from({ length: a.length }, (_, j) => (a[j] == null ? null : a[j]));
  const seats = seatW ? seatW.map((arr) => { const a = arr.filter(Boolean); return a.length ? a[0].map((_, q) => r4(a.reduce((x, w) => x + w[q], 0) / a.length)) : null; }) : null;
  const record = { K, seats, vals: vals.map((v) => dense(v).map((x) => (x == null ? null : r4(x)))), vps: vps.map((v) => dense(v)), rounds, pick,
    paired: paired.map((p) => ({ m: r4(p.m), se: Number.isFinite(p.se) ? r4(p.se) : null, n: p.n })), rule: { z: o.z, minAdv: o.minAdv }, finalists,
    ms: Math.round(ms), rollouts: used, budget: { n: NB, timeMs: o.timeMs }, stop, depth: P0.depth, kind: P0.kind, cands: P0.named, workers: W };
  return { choice: P0.choices[pick], record };
}
