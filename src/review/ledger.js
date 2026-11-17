// v1.90 THE STEP LEDGER (pure: no DOM, no engine). Every recorded position of a game is valued once (src/review/step-mc.js, in the review's worker, 25 futures, the same
// seeds in every position), so the change of every seat's win chance between two consecutive positions is a STEP, and the steps of a round add up to the round's change
// EXACTLY (telescoping: step i = value(position i+1) - value(position i), always from the stored values). The card's chart, its headline and the ledger numbers all read this one
// series (the Win chance tab keeps its own).
//   store (R.luck.res): "pos:<i>" { F, v, w }  A, every position (w: the futures, packed, paired by index across positions)
//                       "ref:<i>" { F, v, w }  the same position again at more futures (the steps that are shown are refined until their +-se is at most SE_MAX)
//                       "pas:<i>" { F, v, w }  B, the position "end the turn instead" before the first action of a player-turn (the progress credit, an estimate, never in a total)
// A step's +-se comes from the futures of its two positions (futures j of both positions share their seeds, so the difference is much steadier than either value).
export const LG = { F: 25, REF: [100, 300, 800], LAST_STEPS: 3, SE_MAX: 0.02, SHOW_MIN: 0.025, REFINE_MIN: 0.02, TOP: 5, ROWS: 3, ROW_MIN: 0.1, PASS_F: 25, PASS_MIN: 0.02 };

// ── packing: the futures of one position (futures x seats, every future normalised to 100%) as 2 base-36 characters a value ──
export function packW(W) {
  let s = "";
  for (const w of W) for (const x of w) { const k = Math.max(0, Math.min(1295, Math.round(x * 1295))); s += (k < 36 ? "0" : "") + k.toString(36); }
  return s;
}
export function unpackW(s, n) {
  const W = []; if (!s || !n) return W;
  for (let p = 0; p + 2 * n <= s.length; p += 2 * n) { const w = []; for (let q = 0; q < n; q++) w.push(parseInt(s.slice(p + 2 * q, p + 2 * q + 2), 36) / 1295); W.push(w); }
  return W;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const posKey = (r) => `${r.st}|${JSON.stringify(r.trk)}|${r.pid}|${r.ts}`;

/** alias[i] = the record whose valuation stands for position i (identical positions are valued once); null: no position recorded. */
export function aliasOf(recs) {
  const out = []; let prevKey = null, prev = null;
  recs.forEach((r, i) => {
    if (!r || typeof r.st !== "string") { out.push(null); return; }
    const k = posKey(r);
    if (prev != null && k === prevKey) { out.push(prev); return; }
    prevKey = k; prev = i; out.push(i);
  });
  return out;
}
/** The events the worker runs: one per distinct position (src/review-luck.js adds them to the luck run). */
export function posEvents(recs) {
  const al = aliasOf(recs), out = [];
  al.forEach((c, i) => { if (c === i) out.push({ kind: "pos", s: 0, i, e: 1e6 + i, rec: { st: recs[i].st, trk: recs[i].trk, ts: recs[i].ts, pid: recs[i].pid }, F: LG.F }); });
  return out;
}
export const roundOf = (r) => (r.k === "setup" ? 0 : r.t);

/** The ledger of a game. recs: the records ({ k, pid, t, st? }), n seats, winner (a seat), res: the stored entries (see above). */
export function makeLedger({ recs, n, winner, res = {} }) {
  const N = recs.length, alias = aliasOf(recs), fin = Array.from({ length: n }, (_, q) => (q === winner ? 1 : 0)), unp = new Map();
  const led = { N, n, winner, recs, res, alias, fin };
  const ent = (i) => { // the best entry of position i (null: not valued yet)
    if (i >= N) return { F: Infinity, v: fin, fin: true };
    const c = alias[i]; if (c == null) return null;
    const ok = (e) => (e && Array.isArray(e.v) && e.w ? e : null), r = ok(res[`ref:${c}`]), p = ok(res[`pos:${c}`]);
    return r && p ? (r.F >= p.F ? r : p) : r || p || null;
  };
  const Wof = (e) => { if (!e) return null; if (e.fin) return null; let w = unp.get(e); if (!w) { w = unpackW(e.w, n); unp.set(e, w); } return w; };
  /** the seats' win chances at position i (0 .. N): the last valued position at or before i; null before the first. */
  led.v = (i) => { for (let k = Math.min(i, N); k >= 0; k--) { const e = ent(k); if (e) return e.v; } return null; };
  /** the win chances at a moment inside the game: after the events before global event index `upto` (the first record that starts at or after it; the final result when none does) */
  led.atEvent = (upto) => { let k = N; for (let i = 0; i < N; i++) { const r = recs[i]; if (r && typeof r.e === "number" && r.e >= upto) { k = i; break; } } return led.v(k); };
  led.F = (i) => { const e = ent(i); return e ? e.F : 0; };
  led.complete = () => alias.every((c, i) => c == null || c !== i || !!res[`pos:${i}`]) && !!ent(0);
  led.valued = () => alias.filter((c, i) => c === i && res[`pos:${i}`]).length;
  led.total = () => alias.filter((c, i) => c === i).length;
  /** step i (record i): { d: change per seat (value(i+1) - value(i)), se: per seat, F } */
  led.step = (i) => {
    const a = ent(i), b = ent(i + 1), va = led.v(i), vb = led.v(i + 1); if (!va || !vb) return null;
    const d = vb.map((x, q) => x - va[q]);
    if (!a || !b || a === b) return { d, se: Array(n).fill(0), F: a ? a.F : 0 };
    const Wa = Wof(a), Wb = Wof(b), F = Math.min(Wa ? Wa.length : Infinity, Wb ? Wb.length : Infinity), se = [];
    if (!Number.isFinite(F) || F < 2) return { d, se: Array(n).fill(0), F: Number.isFinite(F) ? F : 0 };
    for (let q = 0; q < n; q++) { const x = Array.from({ length: F }, (_, j) => (Wb ? Wb[j][q] : fin[q]) - (Wa ? Wa[j][q] : fin[q])), m = mean(x); se.push(Math.sqrt(x.reduce((s, y) => s + (y - m) ** 2, 0) / (F - 1) / F)); }
    return { d, se, F };
  };
  /** the futures of position i for pairing ([] when unknown / final) */
  led.W = (i) => Wof(ent(i));
  led.entry = ent;
  /** rounds: set-up is round 0, then 1..T. { t, a, b (first / last record), v0, v1 (before / after), d } */
  led.rounds = () => {
    if (led._rounds && led._rn === N) return led._rounds;
    const by = new Map(); recs.forEach((r, i) => { if (!r) return; const t = roundOf(r); if (!Number.isFinite(t)) return; const g = by.get(t); if (g) { g.b = i; } else by.set(t, { t, a: i, b: i }); });
    led._rounds = [...by.values()].sort((x, y) => x.t - y.t); led._rn = N; return led._rounds;
  };
  led.round = (t) => { const r = led.rounds().find((x) => x.t === t); if (!r) return null; const v0 = led.v(r.a), v1 = led.v(r.b + 1); return v0 && v1 ? { ...r, v0, v1, d: v1.map((x, q) => x - v0[q]) } : null; };
  /** the chart's series: Map turn -> fractions per seat (0: after set-up, t: after round t), the shape of src/review/ai-facts.js aiSeries */
  led.series = () => {
    const by = new Map(); let maxT = 0;
    led.rounds().forEach((r) => { const v = led.v(r.b + 1); if (v) { by.set(r.t, v); maxT = Math.max(maxT, r.t); } });
    if (!by.has(0)) { const v = led.v(0); if (v) by.set(0, v); }
    return { by, maxT, src: "ledger" };
  };
  return led;
}

/** Every step's change for a round, with the exact telescoping total: { steps: [{ i, d, se }], d (round) } (null while a position is missing). */
export function roundSteps(led, t) {
  const r = led.round(t); if (!r) return null;
  const steps = []; for (let i = r.a; i <= r.b; i++) { const s = led.step(i); if (!s) return null; steps.push({ i, ...s }); }
  return { ...r, steps };
}

// ── what a step was (page side data: the records, the statistics log, the hexes) ──
const RES5 = ["wood", "brick", "sheep", "wheat", "ore"];
/** { i, k, pid, type, chance, ... }: type roll (sum, prod: seat -> [resources], hexes), robber (hex, steal), build (what, at), dev (card), play (card), bank, ptrade, setup, other. */
export function describeStep(i, ctx) {
  const { recs, steps, ev, hexes } = ctx, r = recs[i], it = { i, k: r.k, pid: r.pid, chance: false };
  if (r.k === "roll" || r.k === "turn") {
    const st = steps?.[r.s]; it.type = "roll"; it.chance = true; it.sum = st ? st[2] + st[3] : null; it.prod = {}; const hx = new Set();
    (ev || []).forEach((e) => { if (e[0] === r.s + 1 && e[1] === "P") { (it.prod[e[2]] = it.prod[e[2]] || []).push(...Array(e[5] || 1).fill(RES5[e[4]])); hx.add(e[3]); } });
    it.hexes = [...hx].map((h) => ({ id: h, res: hexes?.[h]?.resource, num: hexes?.[h]?.number }));
  } else if (r.k === "robber") { it.type = "robber"; it.hex = r.a?.hex; const t = (ev || []).find((e) => e[0] === r.s && e[1] === "t" && e[2] === r.pid); if (t) it.taken = { from: t[3] }; }
  else if (r.k === "build") { it.type = "build"; it.what = r.a?.type; it.at = r.a?.id; }
  else if (r.k === "buy") { // v1.90.2 a purchase is two things: its expected value (the player CHOSE to buy: Keuze) and how much the card drawn differs from the expected card (Geluk, the luck run's own number for that draw)
    it.type = "dev"; it.chance = true; const v = (ev || []).find((e) => e[0] === r.s && e[1] === "v" && e[2] === r.pid); it.card = v ? v[3] : null;
    const j = (ev || []).findIndex((e, k) => k >= (r.e ?? 0) && e && e[0] === r.s && e[1] === "v" && e[2] === r.pid), x = ctx.res && j >= 0 ? ctx.res[`dev:${r.s}:${j}`] : null;
    if (x && Array.isArray(x.l)) it.dl = x.l; else if (x && x.skip === "one kind") it.dl = "none"; // (no luck result yet: the whole step stays luck, as before; one kind left in the deck: nothing was left to chance)
  }
  else if (r.k === "play") { it.type = "play"; it.card = r.a?.t; }
  else if (r.k === "bank") { it.type = "bank"; it.tr = r.a?.tr; }
  else if (r.k === "ptrade") it.type = "ptrade";
  else it.type = r.k;
  return it;
}
const ACTION = new Set(["build", "bank", "play", "ptrade", "dev"]);

/** The biggest rounds (not the set-up): by the larger of |change| of `seats`, biggest first. */
export function bigRounds(led, seats, k = LG.TOP) {
  return led.rounds().filter((r) => r.t >= 1).map((r) => led.round(r.t)).filter(Boolean).sort((x, y) => Math.max(...seats.map((q) => Math.abs(y.d[q]))) - Math.max(...seats.map((q) => Math.abs(x.d[q]))) || x.t - y.t).slice(0, k);
}
/** The steps of a round worth showing: the larger of |change| of `seats` at least SHOW_MIN (whole points: 3 and up after rounding), at most 7, in play order. */
export function shownSteps(led, t, seats, min = LG.SHOW_MIN) {
  const rs = roundSteps(led, t); if (!rs) return [];
  return rs.steps.filter((s) => Math.max(...seats.map((q) => Math.abs(s.d[q]))) >= min).sort((x, y) => Math.max(...seats.map((q) => Math.abs(y.d[q]))) - Math.max(...seats.map((q) => Math.abs(x.d[q])))).slice(0, 7).sort((x, y) => x.i - y.i);
}
/** The largest +-se (win chance fraction) over the shown steps of a round, for `seats`. */
export function roundMaxSe(led, t, seats) { return Math.max(0, ...shownSteps(led, t, seats).map((s) => Math.max(...seats.map((q) => s.se[q])))); }

/** Adaptive refinement of the steps of one round: the steps that matter (|change| >= REFINE_MIN for `seats`) get their two positions at more futures, in rounds of REF = [100, 300, 800] (the last level for the biggest few only),
 *  until the +-se of every one of them is at most SE_MAX or the budget is used. value(i, F) -> Promise<{ v, se, F, w }>; store(key, entry) keeps it. live(): false stops.
 *  Returns { positions, maxSe, capped } (capped: steps still above SE_MAX at the end: the card says so). */
export async function refineRound(led, t, seats, value, store, { live = () => true, lanes = 1 } = {}) {
  let positions = 0;
  const need = () => { const rs = roundSteps(led, t); return rs ? rs.steps.filter((s) => Math.max(...seats.map((q) => Math.abs(s.d[q]))) >= LG.REFINE_MIN) : []; };
  const bad = (s) => Math.max(...seats.map((q) => s.se[q])) > LG.SE_MAX;
  for (const F of LG.REF) {
    let todo = need().filter((s) => bad(s) && led.F(s.i) < F || bad(s) && led.F(s.i + 1) < F); const pos = new Set();
    if (F === LG.REF[LG.REF.length - 1]) todo = todo.sort((a, b) => Math.max(...seats.map((q) => Math.abs(b.d[q]))) - Math.max(...seats.map((q) => Math.abs(a.d[q])))).slice(0, LG.LAST_STEPS); // the last, costly level: the biggest few only
    todo.forEach((s) => { [s.i, s.i + 1].forEach((p) => { const c = p >= led.N ? null : led.alias[p]; if (c != null && led.F(p) < F) pos.add(c); }); });
    // the first pass also refines the steps that are shown but already steady, so the two positions of a step carry the same number of futures
    if (F === LG.REF[0]) need().forEach((s) => { [s.i, s.i + 1].forEach((p) => { const c = p >= led.N ? null : led.alias[p]; if (c != null && led.F(p) < F && shownLike(s, seats)) pos.add(c); }); });
    const list = [...pos]; let next = 0;
    const lane = async (w) => { while (next < list.length && live()) { const c = list[next++]; const x = await value(c, F, { lane: w }); if (!x || !live()) return; store(`ref:${c}`, { F: x.F, v: x.v, w: x.w }); positions++; } };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(lanes, list.length)) }, (_, w) => lane(w)));
    if (!live()) break;
    if (!need().some(bad)) break;
  }
  const maxSe = roundMaxSe(led, t, seats), capped = need().filter((s) => shownLike(s, seats) && bad(s)).length;
  return { positions, maxSe, capped };
}
const shownLike = (s, seats) => Math.max(...seats.map((q) => Math.abs(s.d[q]))) >= LG.SHOW_MIN;

/** The player-turns of a round that did something (a build, a trade, a card): [{ pid, from, to, acts }] (record indexes; from = the first action, to = the last). */
export function actionTurns(led, t, ctx) {
  const r = led.round(t); if (!r) return [];
  const by = new Map();
  for (let i = r.a; i <= r.b; i++) { const it = describeStep(i, ctx); if (!ACTION.has(it.type)) continue; const g = by.get(it.pid); if (g) { g.to = i; g.acts.push(i); if (it.type === "dev") g.drawn = true; } else by.set(it.pid, { pid: it.pid, from: i, to: i, acts: [i], drawn: it.type === "dev" }); }
  return [...by.values()];
}
/** B, the progress credit of a player-turn: the position after its last action against "end the turn instead" right before its first action (same futures), per seat:
 *  { d, se, F, pid, from, to } or null (not valued yet). An estimate: it never enters a total. */
export function progressOf(led, turn) {
  const p = led.res[`pas:${turn.from}`]; if (!p) return null;
  const Wp = unpackW(p.w, led.n), Wb = led.W(turn.to + 1), n = led.n, fin = led.fin, F = Math.min(Wp.length, Wb ? Wb.length : Infinity);
  if (!Number.isFinite(F) || F < 2) return null;
  const d = [], se = [];
  for (let q = 0; q < n; q++) { const x = Array.from({ length: F }, (_, j) => (Wb ? Wb[j][q] : fin[q]) - Wp[j][q]), m = mean(x); d.push(m); se.push(Math.sqrt(x.reduce((s, y) => s + (y - m) ** 2, 0) / (F - 1) / F)); }
  return { d, se, F, pid: turn.pid, from: turn.from, to: turn.to, drawn: !!turn.drawn };
}
/** Value the progress credit of the player-turns of a round that matter. value(i, F, { pass: true }). Returns the credits (>= PASS_MIN for the seats or the mover). */
export async function creditRound(led, t, seats, ctx, value, store, { live = () => true } = {}) {
  const out = [];
  for (const turn of actionTurns(led, t, ctx)) {
    if (!live()) break;
    const c0 = led.alias[turn.from]; if (c0 == null) continue;
    if (!led.res[`pas:${turn.from}`]) { const x = await value(turn.from, LG.PASS_F, { pass: true }); if (!x || !live()) break; store(`pas:${turn.from}`, { F: x.F, v: x.v, w: x.w }); }
    let c = progressOf(led, turn);
    if (c && Math.max(...seats.map((q) => c.se[q])) > LG.SE_MAX && c.F < 100) { const x = await value(turn.from, 100, { pass: true }); if (x && live()) { store(`pas:${turn.from}`, { F: x.F, v: x.v, w: x.w }); c = progressOf(led, turn); } }
    if (c) out.push(c);
  }
  return out;
}
