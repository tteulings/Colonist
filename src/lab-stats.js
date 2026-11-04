// AI Lab Tournament: the pure parts (no DOM, no game), so they can be tested in node.
//  - drawSeats   a line-up with "random" seats: each game draws its bots from its own seeded stream, so game i
//                is the same line-up in every run (reproducible, paired)
//  - seatKeys    which bot sits in which seat in game i (rotation: every bot plays every seat)
//  - aggregate   results per bot PROFILE over all games it played (n = seats it played)
//  - verdict     the one-line result ("Expert beats Intermediate: 41% vs 20%, 95% sure")
//  - compareRuns two saved runs, profile by profile

export const mulberry32 = (a) => () => {
  a = (a + 0x6D2B79F5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const DRAW_SEED = 20110;
export const MIN_N = 20; // seats a bot must have played before a verdict names it

export function wilson(w, n) {
  if (!n) return [0, 1];
  const z = 1.96, p = w / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Resolve the "random" seats of a line-up for game `i`. `pool`: the presets a Random seat may draw. `distinct`: no bot twice in a game. */
export function drawSeats(spec, i, pool, distinct = false) {
  const rnd = mulberry32((DRAW_SEED + Math.imul(i + 1, 2654435761)) >>> 0);
  rnd(); rnd();
  const used = new Set(spec.filter((k) => k !== "random"));
  return spec.map((k) => {
    if (k !== "random") return k;
    let from = pool;
    if (distinct) { const free = pool.filter((p) => !used.has(p)); if (free.length) from = free; }
    const pick = from[Math.floor(rnd() * from.length)];
    used.add(pick);
    return pick;
  });
}

/** Bot per seat in game i. Rotate: the line-up shifts one seat every game. */
export function seatKeys(drawn, i, rotate) {
  const n = drawn.length;
  return drawn.map((_, seat) => drawn[rotate ? (seat - (i % n) + n) % n : seat]);
}

/** results: [{ keys: [bot per seat], winner: seat|null, turns, vp: [per seat] }] → one row per bot, best first. */
export function aggregate(results, labelOf = (k) => k) {
  const rows = new Map();
  let seats = 0;
  results.forEach((r) => {
    seats = r.keys.length;
    r.keys.forEach((k, s) => {
      const row = rows.get(k) || { key: k, label: labelOf(k), n: 0, wins: 0, vp: 0, turns: 0 };
      row.n += 1; row.vp += r.vp[s] || 0; row.turns += r.turns;
      if (r.winner === s) row.wins += 1;
      rows.set(k, row);
    });
  });
  return [...rows.values()].map((r) => {
    const [lo, hi] = wilson(r.wins, r.n);
    return { ...r, p: r.n ? r.wins / r.n : 0, lo, hi, fair: seats ? 1 / seats : 0.25, avgVp: r.n ? r.vp / r.n : 0, avgTurns: r.n ? r.turns / r.n : 0 };
  }).sort((a, b) => b.p - a.p || b.n - a.n);
}

/** Two win rates apart? Normal approximation, 95%. */
export function diffSig(a, b) {
  const diff = a.p - b.p;
  const se = Math.sqrt((a.p * (1 - a.p)) / Math.max(1, a.n) + (b.p * (1 - b.p)) / Math.max(1, b.n));
  const z = se > 0 ? diff / se : diff === 0 ? 0 : Math.sign(diff) * 9;
  return { diff, z, sig: Math.abs(z) >= 1.96 };
}

const pc = (x) => `${Math.round(x * 100)}%`;
/** { line, pairs: [{ a, b, sig }] } from aggregate() rows (best first). */
export function verdict(rows) {
  const ok = rows.filter((r) => r.n >= MIN_N);
  if (rows.length < 2) return { line: "One bot type only: nothing to compare.", pairs: [], kind: "none" };
  if (ok.length < 2) return { line: "Too few games yet.", pairs: [], kind: "wait" };
  const pairs = [];
  for (let i = 0; i < ok.length; i += 1) for (let j = i + 1; j < ok.length; j += 1) pairs.push({ a: ok[i].key, b: ok[j].key, ...diffSig(ok[i], ok[j]) });
  const best = ok[0], worst = ok[ok.length - 1];
  if (!diffSig(best, worst).sig) return { line: "No clear difference yet. Run more games.", pairs, kind: "unclear" };
  const line = ok.length === 2
    ? `${best.label} beats ${worst.label}: ${pc(best.p)} vs ${pc(worst.p)}, 95% sure.`
    : `${best.label} wins most: ${pc(best.p)}. ${worst.label} is last: ${pc(worst.p)}. 95% sure.`;
  return { line, pairs, kind: "clear" };
}

/** Saved runs a and b (their `rows`): the bots they share, with the gap and whether it is clear. */
export function compareRuns(a, b) {
  return a.rows.filter((x) => b.rows.some((y) => y.key === x.key)).map((x) => {
    const y = b.rows.find((r) => r.key === x.key);
    return { key: x.key, label: x.label, a: x.p, b: y.p, na: x.n, nb: y.n, ...diffSig(x, y) };
  });
}
