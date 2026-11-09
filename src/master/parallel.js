// eng-130 Grandmaster: one decision searched by several Web Workers at once (src/master/worker.js "sprep" / "srun").
// Every worker loads the same position and builds the same moves (agent.prepare); future j re-deals the hidden cards and fixes the
// dice the same way in every worker, so the futures can be split over the workers freely. This coordinator runs the race of
// src/master/search.js search0 (rounds, successive halving, the time slices, the early stop, the paired pick against the Expert's
// move) on the merged results. With a fixed budget and no early stop the result is the same as one worker's search0; with the
// early stop it is checked after each answer of a worker (search0: every 4 futures). Pure logic: `send(w, msg)` talks to worker w.
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
  if (msg.kind === "setup" && o.setupTimeMs) o.timeMs = o.setupTimeMs; // a set-up spot's own (longer) budget, as in search.js decide
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
  let alive = Array.from({ length: K }, (_, i) => i), j0 = 0;
  try {
    for (let r = 0; r < R && alive.length; r++) {
      const per = o.timeSlice ? 1e9 : Math.max(1, Math.floor((NB / R) / alive.length));
      const sliceEnd = o.timeSlice && o.timeMs ? t0 + o.timeMs * (r + 1) / R : Infinity;
      // work queue (no barrier inside a round): every worker takes the next C futures as soon as it is free, so a slow or busy
      // core never holds the others up; the round ends when the futures, the budget or the time run out (or the early stop)
      let j = j0, roundStop = null, failed = false, doneF = 0;
      const end = Math.min(deadline, sliceEnd);
      const C = Math.max(1, o.chunk || 2);
      const A = alive.slice();
      const take = () => {
        if (roundStop || failed || j >= j0 + per) return null;
        if (used + (j - j0 - doneF) * A.length >= NB * 1.05) return null; // budget (counting what is out at the workers)
        if (j >= j0 + 2 && now() > end) { roundStop = now() > deadline ? "time" : "slice"; return null; }
        const left = Math.min(j0 + per - j, Math.ceil((NB * 1.05 - used) / A.length) - (j - j0 - doneF));
        const n = Math.max(1, Math.min(C, left));
        const js = Array.from({ length: n }, (_, q) => j + q);
        j += n;
        return js;
      };
      const worker = async (w) => {
        for (let js = take(); js; js = take()) {
          const budgetMs = Number.isFinite(end) ? Math.max(0, end - now()) : Infinity;
          const x = await send(w, { type: "srun", sid, alive: A, js, budgetMs, force: first || js[0] < j0 + 2 });
          if (!x || x.type === "error") { failed = true; return; }
          first = false;
          for (let q = 0; q < x.done; q++) { const jj = js[q]; A.forEach((k, ai) => { vals[k][jj] = x.vals[ai][q]; vps[k][jj] = x.vps[ai][q]; if (seatW && x.seats) seatW[k][jj] = x.seats[ai][q]; }); }
          doneF += js.length; used += x.done * A.length;
          if (x.done < js.length && !roundStop) roundStop = now() > deadline ? "time" : "slice";
          if (!roundStop && o.earlyZ && A.length >= 2) {
            let c = 0; for (const v of vals[A[0]]) if (v != null) c++;
            if (c >= (o.earlyMin || 40) && earlyLead(A, vals, o.earlyZ, o.earlyMin || 40)) roundStop = "early";
          }
        }
      };
      await Promise.all(Array.from({ length: W }, (_, w) => worker(w)));
      if (failed) { done(); return null; }
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
    if (finalists.includes(k) && p.n >= (o.minFut || 0) && p.m > o.z * p.se + o.minAdv && p.m > bestAdv) { bestAdv = p.m; pick = k; }
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
