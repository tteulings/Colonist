// v1.99 The data layer of the post-game analysis (pure: no DOM, no engine; runs in the page, a worker and node). Every screen of the analysis reads ONE object,
// analyseGame(...), computed once per review and cached by the caller. Nothing here invents a number: it is the review's own results (decisions with their win
// chances), the recorder's event log and the board, put together. See docs/design/analysis-v199.md ("Data layer").
//
// Hard rules kept here: (1) a close call is never an error; (2) set-up picks follow SETUP_LIMITS; (3) the three pillars of "moves cost" and the phase costs add up
// to the same total (capped like totals()); (4) phases are dynamic thirds; (5) points are VISIBLE points (log replay); (6) luck is shown as each seat's own estimate,
// unbalanced (luckBalance / balanceLuck exist but are NOT used for display); (7) every number of the Numbers sheet is finite or null; (8) v1.99 scope: no ports,
// no longest road / largest army race, no trades fed to others and no robber targeting anywhere in the output.
import { decide, totals, SEVERE, SETUP_LIMITS, seOf, vcMeta, CLASSES } from "./score.js";
import { rescoreReview, summarize, FMT } from "./evaluate.js";
import { R5, incomeAt } from "./ai-mech.js";
import { PIPS } from "../core/constants.js";
import { stdGeo, boardOf } from "../lessons-geo.js";
import { rawOf, kindOf } from "../lessons-row.js";
import { PHASES, THRESHOLDS, phaseLimits, turnsOfGame, pointsLog, pointsAfter, pointsBefore, bestKindOf, isClearError, firedRules, kindOfDecision, tallyKinds } from "./coach-rules.js";
import { tr } from "./analysis-text.js";

const rnd = Math.round, sum = (a) => a.reduce((x, y) => x + y, 0);
const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const safe = (f, dflt = null) => { try { const v = f(); return v === undefined ? dflt : v; } catch (_) { return dflt; } };

// ── game facts ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Per seat, from the event log: pieces built after set-up (net of undo), the set-up pieces, development cards bought (and the hidden victory-point cards among them),
 *  knights played, bank trades and player trades (separate counts), and the turn of the first city (null: none). */
export function buildFacts(stats, n) {
  const per = Array.from({ length: n }, () => ({ road: 0, settlement: 0, city: 0, startRoad: 0, startSettlement: 0, cards: 0, vpCards: 0, knights: 0, bank: 0, player: 0, firstCity: null }));
  const turnOf = (s) => stats.steps[s - 1]?.[0] ?? 0;
  for (const e of stats?.ev || []) {
    const [s, code, a, b, x] = e, P = per[a];
    if (code === "b" && P) { const set = s === 0, k = b === "r" ? "road" : b === "s" ? "settlement" : b === "c" ? "city" : null; if (!k) continue; if (set) { if (k !== "city") P["start" + k[0].toUpperCase() + k.slice(1)] += 1; } else P[k] += 1; if (k === "city" && P.firstCity == null) P.firstCity = turnOf(s) || null; }
    else if (code === "u" && P && !(s === 0)) { const k = b === "r" ? "road" : b === "s" ? "settlement" : b === "c" ? "city" : null; if (k && P[k] > 0) P[k] -= 1; }
    else if (code === "v" && P) { P.cards += 1; if (b === "victoryPoint") P.vpCards += 1; }
    else if (code === "y" && P && b === "knight") P.knights += 1;
    else if (code === "k" && P) P.bank += 1;
    else if (code === "x") { if (per[a]) per[a].player += 1; if (per[b]) per[b].player += 1; }
  }
  // a settlement that became a city is no longer a settlement; "b s" then "b c" on one spot is a build of a city only (the recorder writes the city alone)
  return per;
}

/** The set-up of every seat from the board: dots per resource of the two start settlements (the income before the first roll, dice dots out of 36), the kinds you can produce, the ones you cannot. null without a board. */
export function startFacts(raw, n) {
  if (!raw) return null;
  return Array.from({ length: n }, (_, q) => {
    const inc = incomeAt(raw, 0, q), dots = inc.dots, total = sum(R5.map((r) => dots[r]));
    return { dots: { ...dots }, total, kinds: R5.filter((r) => dots[r] > 0), missing: R5.filter((r) => !dots[r]) };
  });
}

/** Game points per phase: for every dynamic third { id, from, to, empty, start[seat], end[seat], gain[seat] } (VISIBLE points), plus final visible, hidden victory-point cards and the recorder's totals. */
export function tempo(stats, n, limits = phaseLimits(turnsOfGame(stats))) {
  const pl = pointsLog(stats, n); if (!pl) return null;
  const seats = Array.from({ length: n }, (_, q) => q);
  let prev = pl.pts[0].slice();
  const phases = PHASES.map((id) => {
    const [from, to] = limits[id], empty = to < from, end = empty ? prev.slice() : seats.map((q) => pointsAfter(pl, to, q));
    const ph = { id, from, to, empty, start: prev.slice(), end, gain: end.map((v, q) => v - prev[q]) };
    prev = end; return ph;
  });
  const final = pl.pts[pl.N].slice(), hidden = pl.hidden[pl.N].slice();
  return { phases, setup: pl.pts[0].slice(), final, hidden, total: final.map((v, q) => v + hidden[q]), limits };
}
/** The phase you trailed most, with the opponent who gained most in it (never the last-place bot as such): { phase, rival, myGain, rivalGain, deficit } or null when nobody out-scored you in any phase. */
export function rivalPhase(tp, me) {
  if (!tp) return null;
  let best = null;
  for (const ph of tp.phases) {
    if (ph.empty) continue;
    let rv = -1, rg = -Infinity; ph.gain.forEach((g, q) => { if (q !== me && g > rg) { rg = g; rv = q; } });
    const deficit = rg - ph.gain[me];
    if (rv >= 0 && deficit > 0 && (!best || deficit > best.deficit)) best = { phase: ph.id, rival: rv, myGain: ph.gain[me], rivalGain: rg, deficit };
  }
  return best;
}

// ── decisions ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The stored review of one seat -> its decisions in play order (score.js decide(): whole percent, gap gp, B you / A better), re-scored with today's formula when it was saved by an older one.
 *  Every decision also carries kind (the piece played), bestKind (of the better move, after "then"), vc (clear | lean | close), why { line, chips[≤3] } from the stored explain(). Returns { ds, all, forced } (all = results of that seat, forced = one legal option). */
export function decisionsOf(review, n, me) {
  if (!review?.results?.length) return { ds: [], all: 0, forced: 0 };
  let rv = review;
  if (rv.fmt !== FMT) { rv = JSON.parse(JSON.stringify(review)); try { rescoreReview(rv); } catch (_) { /* shown as stored */ } }
  const ds = decide(rv.results.filter((x) => !x.skip || x.skip === "trivial"), n, me).map((d) => ({ ...d, kind: kindOf(d.x.label), bestKind: bestKindOf(d.x.best?.label), why: whyOf(d), vm: vcMeta(d.x) }));
  return { ds, all: rv.results.length, forced: rv.results.filter((x) => x.skip === "forced").length };
}
/** The stored feature attribution of a decision: one line and up to 3 chips (null when the review has none). */
export function whyOf(d) {
  const w = d?.x?.why; if (!w || (!w.head && !w.plan)) return null;
  return { line: String(w.head || w.plan), chips: (w.chips || []).slice(0, 3).map(String) };
}
/** Is this decision a real error? Class could / mistake / blunder / missed, and a "missed" with only a slight verdict is NOT one. A close call or a slight difference never is.
 *  (Set-up picks can be errors too: they use SETUP_LIMITS; they are counted as "start", see splitMoves.) */
export const isError = isClearError;
/** Why a decision is or is not an error, for the (i) sheet: gap, the gap it needed (2 x its own noise, 6 when no noise is stored; set-up: SETUP_LIMITS) and the verdict. */
export function errorRule(d) {
  const se = seOf(d.x), setup = d.k === "setup", noise = se == null ? null : Math.max(1, rnd(se * 100));
  return { gap: d.gp, setup, noise, fallback: se == null, need: setup ? SETUP_LIMITS[1][0] : noise == null ? 6 : 2 * noise, clear: d.vc === "clear", error: isError(d), cls: d.cls };
}
/** Sort and file the decisions: errors (clear, not set-up: Lesson 1), setupErrors (clear set-up picks: Lesson 2), notErrors (cost 1% or more but not clear: close calls, slight differences),
 *  small (cost under 1%), trivial (no real choice). counts.scored = the decisions that were really checked ("22 of 25"). */
export function realErrors(ds, { all = ds.length } = {}) {
  const byGap = (a, b) => b.gp - a.gp || a.i - b.i;
  const errors = ds.filter((d) => d.k !== "setup" && isError(d)).sort(byGap), setupErrors = ds.filter((d) => d.k === "setup" && isError(d)).sort(byGap);
  const notErrors = ds.filter((d) => !isError(d) && d.cls !== "triv" && d.gp >= 1).sort(byGap), small = ds.filter((d) => !isError(d) && d.cls !== "triv" && d.gp < 1), trivial = ds.filter((d) => d.cls === "triv");
  const scored = ds.length - trivial.length;
  return { errors, setupErrors, notErrors, small, trivial, counts: { errors: errors.length, setupErrors: setupErrors.length, notErrors: notErrors.length, small: small.length, trivial: trivial.length, scored, all: Math.max(all, ds.length), oneOption: Math.max(0, Math.max(all, ds.length) - scored) } };
}
/** How far the next best option was behind this (best / great) move, whole percent. */
export const nextBestGain = (d) => Math.max(0, rnd(100 * (d?.x?.lead ?? d?.x?.spread ?? 0)));
/** The best moves with the next-best gain, biggest first (best / great decisions that beat the next option by 1% or more). */
export function bestMoves(ds, k = 3) {
  return ds.filter((d) => (d.cls === "best" || d.cls === "great") && d.k !== "setup").map((d) => ({ d, gain: nextBestGain(d) })).filter((o) => o.gain >= 1).sort((a, b) => b.gain - a.gain || a.d.i - b.d.i).slice(0, k);
}
/** Largest-remainder rounding: the integer parts keep their ratios and add up to `total` exactly. */
function scaleTo(parts, total) {
  const keys = Object.keys(parts), s = sum(keys.map((k) => parts[k]));
  if (s === total) return { ...parts };
  if (!s) return Object.fromEntries(keys.map((k) => [k, 0]));
  const raw = keys.map((k) => (parts[k] * total) / s), out = raw.map(Math.floor);
  let rest = total - sum(out);
  raw.map((v, j) => [v - Math.floor(v), j]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, j]) => { if (rest > 0) { out[j] += 1; rest -= 1; } });
  return Object.fromEntries(keys.map((k, j) => [k, out[j]]));
}
/** The three EXCLUSIVE pillars of what your moves cost, adding up to the total (capped like totals(): you cannot give away more than the best chance you ever had):
 *  errors (real errors, not set-up), start (all set-up picks) and other (every other move). headline = -total. counts.nErrors excludes set-up errors. */
export function splitMoves(ds) {
  const t = totals(ds), raw = { errors: 0, start: 0, other: 0 }, counts = { nErrors: 0, nStart: 0, nOther: 0 };
  ds.forEach((d) => {
    if (d.k === "setup") { raw.start += d.gp; if (d.gp > 0) counts.nStart += 1; }
    else if (isError(d)) { raw.errors += d.gp; counts.nErrors += 1; }
    else { raw.other += d.gp; if (d.gp > 0) counts.nOther += 1; }
  });
  const total = Math.min(t.sum, t.cap), p = scaleTo(raw, total);
  return { ...p, total, sum: t.sum, cap: t.cap, capped: t.sum > t.cap, headline: -total, counts };
}
/** The cost per phase, for Lesson 3: opening / mid / end = the real errors of that phase, start = set-up picks, small = every other move. They add up to the same total as the pillars
 *  (phase costs + start + small = total; opening + mid + end = the errors pillar). */
export function phaseCosts(ds, limits, split = splitMoves(ds)) {
  const raw = { opening: 0, mid: 0, end: 0 };
  ds.forEach((d) => { if (d.k !== "setup" && isError(d)) raw[phaseKey(d.t, limits)] += d.gp; });
  const ph = scaleTo(raw, split.errors);
  return { ...ph, start: split.start, small: split.other, errors: split.errors, total: split.total, capped: split.capped };
}
const phaseKey = (turn, limits) => (turn <= limits.opening[1] ? "opening" : turn <= limits.mid[1] ? "mid" : "end");

// ── board and start ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** One spot of the standard island: dots per resource, total dots, the kinds it produces and its numbers. null when the board has no standard geometry. */
export function spotOf(board, node) {
  const g = stdGeo(), nd = g.nodes[node]; if (!board || !nd) return null;
  const dots = Object.fromEntries(R5.map((r) => [r, 0])), nums = [];
  nd.hx.forEach((h) => { const x = board[h]; if (x?.num && dots[x.res] != null) { dots[x.res] += PIPS[x.num]; nums.push(x.num); } });
  return { node, dots, total: sum(R5.map((r) => dots[r])), kinds: R5.filter((r) => dots[r] > 0), nums };
}
/** The plan a spot (or a list of spots) points at: "city" (ore + grain), "expansion" (wood + brick) or "mixed". */
export function planFromSpot(spots) {
  const l = (Array.isArray(spots) ? spots : [spots]).filter(Boolean), d = Object.fromEntries(R5.map((r) => [r, 0]));
  l.forEach((s) => R5.forEach((r) => { d[r] += s.dots?.[r] || 0; }));
  const t = sum(R5.map((r) => d[r])); if (!t) return "mixed";
  return (d.ore + d.wheat) / t >= 0.55 ? "city" : (d.wood + d.brick) / t >= 0.55 ? "expansion" : "mixed";
}
const pctOf = (v) => (v == null ? null : rnd(v * 100));
/** (The played spot and the best spot carry the review's refined win chances B and A, so the gap shown between them is exactly the decision's gap `gp`: one number everywhere.)
 *  Your two start picks against the shortlist the review checked (at most 6 spots; cands[0] = the pick you made; only options with n >= 2 futures count, like derive()).
 *  Returns { picks: [{ n (1|2), node, i, win (B), best (A), gp, cls, followed, top, spot, bestSpot, adds, advice, shortlist }], plan } or null without set-up decisions.
 *  advice only when the gap is `min` (5%) or more and the better spot adds a resource you do not get from the pick you made. */
export function startReview(ds, board, min = 5) {
  const su = ds.filter((d) => d.k === "setup").sort((a, b) => a.i - b.i).slice(0, 2); if (!su.length) return null;
  const have = new Set(), picks = su.map((d, j) => {
    const x = d.x, cs = (x.cands || []).map((c, k) => ({ c, k })).filter(({ c, k }) => k === 0 || c.n >= 2);
    const shortlist = cs.map(({ c, k }) => ({ label: c.label, node: c.focus?.node ?? null, win: k === 0 ? d.B : !!x.best && c.label === x.best.label ? d.A : pctOf(c.win), played: k === 0, best: !!x.best && c.label === x.best.label, spot: c.focus?.node != null ? spotOf(board, c.focus.node) : null }))
      .sort((a, b) => (b.win ?? -1) - (a.win ?? -1) || (b.played ? 1 : 0) - (a.played ? 1 : 0)).slice(0, 6);
    const node = x.focus?.node ?? null, spot = node != null ? spotOf(board, node) : null, bn = x.best?.focus?.node ?? null, bestSpot = bn != null ? spotOf(board, bn) : null;
    const mine = new Set(have); spot?.kinds.forEach((r) => mine.add(r));
    const adds = bestSpot ? bestSpot.kinds.filter((r) => !mine.has(r)) : [];
    spot?.kinds.forEach((r) => have.add(r));
    const advice = d.gp >= min && adds.length && bestSpot ? { gap: d.gp, adds, node: bn } : null;
    return { n: j + 1, node, i: d.i, win: d.B, best: d.A, gp: d.gp, cls: d.cls, followed: d.cls === "best" || d.cls === "good" || d.cls === "great", top: shortlist[0]?.played === true, spot, bestSpot, adds, advice, shortlist };
  });
  return { picks, plan: planFromSpot(picks[0].shortlist.slice(0, 3).map((s) => s.spot)) };
}

// ── luck ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The luck of seat q in win-chance percent, in its parts, from the review's luck run (the same sum as lessons-row luckOf, split): dice, steals (a steal by or from you), drawn cards and the seat order.
 *  null when the game has no complete luck run. Each seat is its OWN estimate: nothing is balanced to zero. */
export function luckSplit(luck, stats, q, n) {
  const res = luck?.res, steps = stats?.steps?.length; if (!res || !steps || q == null || !n) return null;
  const out = { dice: 0, steal: 0, draw: 0, seat: 0 }; let nd = 0;
  for (const [key, r] of Object.entries(res)) {
    if (!r) continue;
    if (r.k === "seat") { if (r.v && r.v[q] != null) out.seat += r.v[q] - 1 / n; continue; }
    if (!r.l || r.l[q] == null) continue;
    if (r.k === "dice") { out.dice += r.l[q]; nd += 1; }
    else if (r.k === "steal") { const e = stats.ev?.[+key.split(":")[2]]; if (e && (e[2] === q || e[3] === q)) out.steal += r.l[q]; }
    else if (r.k === "dev") { const e = stats.ev?.[+key.split(":")[2]]; if (e && e[2] === q) out.draw += r.l[q]; }
  }
  if (nd < 0.9 * steps) return null;
  const p = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, rnd(v * 100)]));
  return { ...p, total: rnd(sum(Object.values(out)) * 100) };
}
/** Seat luck values summed and averaged. (For tests and for the seat-order event only: the screens show the values as they are.) */
export const luckBalance = (arr) => { const v = arr.filter((x) => fin(x) != null); return { n: v.length, sum: sum(v), mean: v.length ? sum(v) / v.length : 0 }; };
/** The luck values minus their mean (they would sum to 0). NOT used for display: v1.99 shows every seat's own estimate and makes no zero-sum claim. */
export const balanceLuck = (arr) => { const m = luckBalance(arr).mean; return arr.map((x) => (fin(x) == null ? null : x - m)); };

// ── verdict ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The four parts of "what moved your win chance", whole percent, adding up to (win chance after your last move) - (an even share):
 *  setup (the seat plus your start picks: -start cost + seat luck), luck (dice, steals and cards), moves (-errors -other) and rest (the opponents' remainder: positive when they fell away). */
export function ledgerOf(ds, split, luck) {
  if (!ds.length) return null;
  const t = totals(ds), seat = luck?.seat ?? 0, lk = luck ? luck.total - luck.seat : 0;
  const setup = seat - split.start, moves = -(split.errors + split.other), luckV = lk, total = t.to - t.from;
  return { setup, luck: luckV, moves, rest: total - setup - luckV - moves, total, from: t.from, to: t.to, hasLuck: !!luck, perMove: ds.filter((d) => d.cls !== "triv").length ? Math.round((split.total / ds.filter((d) => d.cls !== "triv").length) * 10) / 10 : 0 };
}
/** What led the game, from the four parts: { won, lead: [{ id, v }] (up to 2 drivers on the side of the result), despite: { id, v } | null }. Drivers need 3% or more; "despite" needs 5% or more. */
export function headline(parts, { won } = {}) {
  if (!parts) return null;
  const items = ["rest", "luck", "setup", "moves"].filter((id) => id !== "luck" || parts.hasLuck).map((id) => ({ id, v: parts[id] }));
  const pos = items.filter((o) => o.v >= 3).sort((a, b) => b.v - a.v), neg = items.filter((o) => o.v <= -3).sort((a, b) => a.v - b.v);
  const lead = (won ? pos : neg).slice(0, 2), other = (won ? neg : pos).filter((o) => Math.abs(o.v) >= 5 && !lead.some((l) => l.id === o.id));
  return { won: !!won, lead, despite: other[0] || null };
}
const mag = (v) => Math.abs(Math.round(v));
/** One line: the biggest real drivers with their numbers, e.g. "The others fell away (+111%) and luck helped (+51%), despite 68% lost to your moves". */
export function verdictLine(parts, { won } = {}, lang = "en") {
  const h = headline(parts, { won }); if (!h) return null;
  const say = (o) => tr(lang, `head.${h.won ? "won" : "lost"}.${o.id}`, { v: mag(o.v) });
  if (!h.lead.length && !h.despite) return tr(lang, "head.even");
  const lead = h.lead.length ? h.lead.map(say).join(` ${tr(lang, "and")} `) : tr(lang, h.won ? "head.won.none" : "head.lost.none");
  const out = h.despite ? `${lead}, ${tr(lang, `head.${h.won ? "despite" : "though"}.${h.despite.id}`, { v: mag(h.despite.v) })}` : lead;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
/** Two short sentences that never contradict the result, e.g. "Your moves gave up 68% against best play. You still won: the opponents fell away." */
export function verdictText(parts, { won } = {}, lang = "en") {
  const h = headline(parts, { won }); if (!h) return null;
  const cost = Math.max(0, -parts.moves), big = cost >= 10, pick = (list) => list.find((o) => o.id !== "moves");
  const s1 = tr(lang, cost >= 5 ? "vt.cost" : "vt.close", { v: cost });
  let s2;
  const c = pick(h.lead);
  if (won) s2 = big ? (c ? tr(lang, `vt.stillwon.${c.id}`) : tr(lang, "vt.stillwon.none")) : tr(lang, "vt.won.solid");
  else s2 = c && (!big || mag(c.v) > cost) ? tr(lang, `vt.lost.${c.id}`) : big ? tr(lang, "vt.lost.moves") : tr(lang, "vt.lost.none");
  return `${s1} ${s2}`;
}

// ── bots ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Wilson range of k wins in n games, in whole percent, always inside 0..100 (z = 1.96: 95%). [0, 100] for n = 0. */
export function wilsonPct(k, n, z = 1.96) {
  if (!(n > 0)) return [0, 100];
  k = Math.min(Math.max(0, k), n);
  const p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, Math.min(100, rnd((c - h) * 100))), Math.max(0, Math.min(100, rnd((c + h) * 100)))];
}
const LEVELS = ["beginner", "simple", "intermediate", "expert", "master", "super", "superplus", "grandmaster"];
/** The level of a game's bots (the seats that are not you): their profile when they all share one, else "mixed". */
export function levelOf(meta) {
  const ps = (meta?.seats || []).filter((s, i) => !s.you && i !== meta.me).map((s) => s.prof || (s.custom ? "custom" : "")).filter(Boolean);
  return ps.length && ps.every((p) => p === ps[0]) ? ps[0] : ps.length ? "mixed" : null;
}
/** You against one level: { level, n, won, pct (0..100), lo, hi (Wilson), acc (mean Accuracy of your reviewed games there, or null) }. metas = the saved game list entries. */
export function youVsLevel(metas, level) {
  const g = metas.filter((m) => levelOf(m) === level), won = g.filter((m) => m.result === "won" || (m.winner != null && m.winner === m.me)).length, a = g.map((m) => m.acc).filter((v) => fin(v) != null);
  const [lo, hi] = wilsonPct(won, g.length);
  return { level, n: g.length, won, pct: g.length ? rnd((100 * won) / g.length) : null, lo, hi, acc: a.length ? rnd(sum(a) / a.length) : null };
}
/** One row per level you have played, in ladder order. */
export function youVsLevels(metas) {
  const lv = [...new Set(metas.map(levelOf).filter(Boolean))].sort((a, b) => (LEVELS.indexOf(a) < 0 ? 99 : LEVELS.indexOf(a)) - (LEVELS.indexOf(b) < 0 ? 99 : LEVELS.indexOf(b)));
  return lv.map((l) => youVsLevel(metas, l));
}

// ── the sheets ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The Numbers sheet: exact values per player, every row labelled, every value finite or null. rows: [{ id, key, label, unit ("pts" | "pct" | "n" | "turn"), values: [per seat] }]. */
export function numbersSheet(a, lang = "en") {
  if (!a) return null;
  const n = a.n, cols = Array.from({ length: n }, (_, q) => q), row = (id, unit, f) => ({ id, key: `num.${id}`, label: tr(lang, `num.${id}`), unit, values: cols.map((q) => fin(safe(() => f(q)))) });
  const rows = [], tp = a.tempo, bf = a.facts, bs = a.bySeat || [];
  rows.push(row("points", "pts", (q) => a.points.total[q]));
  tp?.phases.forEach((ph) => rows.push(row(`pts.${ph.id}`, "pts", (q) => ph.gain[q])));
  rows.push(row("acc", "pct", (q) => bs[q]?.acc), row("cost", "pct", (q) => bs[q]?.cost), row("luck", "pct", (q) => a.luck?.[q]?.total));
  if (bf) rows.push(row("settlements", "n", (q) => bf[q].settlement), row("cities", "n", (q) => bf[q].city), row("roads", "n", (q) => bf[q].road), row("cards", "n", (q) => bf[q].cards), row("bank", "n", (q) => bf[q].bank), row("player", "n", (q) => bf[q].player), row("firstCity", "turn", (q) => bf[q].firstCity));
  // ONE vocabulary (the v1.99 kinds of coach-rules.js kindOfDecision): Strong moves, Close calls, Could be better (every other weaker move), Real errors (clear mistakes, blunders and missed chances). Start picks are counted on their own.
  if (bs.some((s) => s?.kinds)) { [["strong", "strong"], ["close", "close"], ["could", "could"], ["errors", "err"]].forEach(([id, k]) => rows.push(row(`cls.${id}`, "n", (q) => bs[q]?.kinds?.[k]))); }
  return { cols, rows };
}
/** The (i) sheet: the error rule, accuracy vs moves cost, the phase limits and the model. [{ id, title, body }] in the language. */
export function infoSheet(a, lang = "en") {
  const lim = a?.limits, ph = (id) => (lim && lim[id][1] >= lim[id][0] ? `${lim[id][0]}–${lim[id][1]}` : "–");
  const su = SETUP_LIMITS;
  return [
    { id: "error", title: tr(lang, "info.error.t"), body: tr(lang, "info.error.b", { pct: 6, c1: su[1][0], c2: su[2][0], c3: su[3][0] }) },
    { id: "acc", title: tr(lang, "info.acc.t"), body: tr(lang, "info.acc.b") },
    { id: "phases", title: tr(lang, "info.phases.t"), body: tr(lang, "info.phases.b", { a: ph("opening"), b: ph("mid"), c: ph("end"), ...(lim ? { n: lim.nTurns } : { n: 0 }) }) },
    { id: "model", title: tr(lang, "info.model.t"), body: tr(lang, "info.model.b", { fmt: a?.model?.fmt ?? FMT, engine: a?.model?.engine || "" }) },
  ];
}

// ── the one object ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const clsCounts = (ds) => Object.fromEntries(CLASSES.map((c) => [c, ds.filter((d) => d.cls === c).length]));
/** Everything the screens read, from one saved game. Any block whose data is missing is null (the screen hides it): old saved reviews, Rush, Seafarers, 5-6 players.
 *  input: { state (the saved game state: stats, players, hexes, settings) or { stats, n, target, raw, board }, rv (the saved review: reviews{seat}, luck), me, names, winner, finalPts, meta }.
 *  Returns { v, n, me, target, T, limits, flags, points, facts, start, tempo, rival, bySeat, luck, you: { ds, counts, errors, ..., split, phase, best, rules, startReview, ledger, verdict }, numbers, info, model } */
export function analyseGame(input) {
  const { state, rv = null, meta = null } = input, stats = input.stats || state?.stats, n = input.n || state?.players?.length || stats?.n || 0, me = input.me ?? meta?.me ?? 0;
  const target = input.target || state?.settings?.winPoints || meta?.pts || 10, lang = input.lang || "en";
  if (!stats?.steps || !stats?.ev || !n) return null;
  const T = turnsOfGame(stats), limits = phaseLimits(T);
  const board = input.board !== undefined ? input.board : state ? safe(() => boardOf(state)) : null;
  const raw = input.raw !== undefined ? input.raw : state ? safe(() => rawOf(state)) : null;
  const a = { v: 1, n, me, target, T, limits, names: input.names || meta?.seats?.map((s) => s.name) || state?.players?.map((p) => p.name) || Array.from({ length: n }, (_, q) => String(q + 1)) };
  a.flags = { sea: !!(state?.sea || meta?.mode === "seafarers"), rush: !!(state?.settings?.mode === "rush" || meta?.mode === "rush"), partial: !!stats.partial, big: n > 4, board: !!board, raw: !!raw, reviewed: false };
  const plog = safe(() => pointsLog(stats, n)); if (!plog) return null;
  const tp = safe(() => tempo(stats, n, limits)); a.tempo = tp;
  const finalPts = input.finalPts || state?.players?.map((p) => p.victoryPoints) || stats.vp?.[stats.steps.length] || tp.total, total = tp.total.map((v, q) => (finalPts[q] != null ? finalPts[q] : v));
  const winner = input.winner ?? meta?.winner ?? (state?.winnerId ?? null) ?? total.indexOf(Math.max(...total));
  a.points = { visible: plog.pts, final: tp.final, hidden: tp.hidden, total, winner, won: winner === me, place: 1 + total.filter((v, q) => q !== me && v > total[me]).length };
  a.facts = safe(() => buildFacts(stats, n)); a.start = safe(() => startFacts(raw, n)); a.rival = safe(() => rivalPhase(tp, me));
  const reviews = rv?.reviews || (rv?.review?.results?.length ? { [rv.review.pid]: rv.review } : {});
  a.luck = Array.from({ length: n }, (_, q) => safe(() => luckSplit(rv?.luck, stats, q, n)));
  a.bySeat = Array.from({ length: n }, (_, q) => {
    const rev = reviews[q]; if (!rev?.results?.length) return null;
    const { ds, all, forced } = decisionsOf(rev, n, q), sp = splitMoves(ds), sm = safe(() => summarize(rev.results.filter((x) => x.skip !== "error")));
    const er0 = realErrors(ds, { all }), rawSum = (l) => l.reduce((a, d) => a + d.gp, 0), errIds = new Set(er0.errors.map((d) => d.i));
    // raw = the review's own gaps, whole percent, NOT scaled: start (all set-up picks), errors (clear errors after the start), other (every other scored move), cap (the best win chance ever held: all the moves after the start together cannot cost more)
    const raw = { start: rawSum(ds.filter((d) => d.k === "setup")), errors: rawSum(ds.filter((d) => d.k !== "setup" && errIds.has(d.i))), other: rawSum(ds.filter((d) => d.k !== "setup" && !errIds.has(d.i))), cap: totals(ds).cap };
    return { seat: q, errors: er0.counts.errors, acc: sm?.acc ?? null, nScored: sm?.n ?? 0, cls: clsCounts(ds), kinds: tallyKinds(ds), cost: sp.total, lost: sm?.lost ?? null, all, forced, split: { errors: sp.errors, start: sp.start, other: sp.other }, raw };
  });
  a.model = { fmt: reviews[me]?.fmt ?? null, engine: rv?.rk || meta?.rk || null };
  const rev = reviews[me];
  if (rev?.results?.length) {
    a.flags.reviewed = true;
    const { ds, all, forced } = decisionsOf(rev, n, me), er = realErrors(ds, { all }), split = splitMoves(ds), parts = safe(() => ledgerOf(ds, split, a.luck[me]));
    const ctx = { won: a.points.won };
    a.you = { ds, all, forced, ...er, split, phase: phaseCosts(ds, limits, split), best: bestMoves(ds), rules: safe(() => firedRules(ds, { stats, n, me, target, raw, th: THRESHOLDS }), []), startReview: safe(() => startReview(ds, board)), ledger: parts,
      verdict: parts ? { head: headline(parts, ctx), line: verdictLine(parts, ctx, lang), text: verdictText(parts, ctx, lang) } : null,
      cls: clsCounts(ds), chips: Object.fromEntries(er.errors.map((d) => [d.i, { turn: d.t, pts: pointsBefore(plog, d.t, me), target }])) };
  } else a.you = null;
  a.numbers = safe(() => numbersSheet(a, lang)); a.info = safe(() => infoSheet(a, lang));
  return a;
}
export { PHASES, THRESHOLDS, SEVERE, kindOfDecision, tallyKinds };
