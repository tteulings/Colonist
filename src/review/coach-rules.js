// v1.99 Coach rules and the points helpers of the post-game analysis (pure: no DOM, no engine, runs in the page, a worker and node).
//
//  - phase limits: dynamic thirds of the game length (phaseLimits / phaseOf / turnsOf)
//  - points: the VISIBLE points of every seat at every step, by replaying the event log (pointsLog / visibleSeries / pointsBefore, exact), and the
//    recorder's own series minus the hidden victory-point cards (vpSeries; the recorder has transient off-by-one steps in the 6-player special build phase)
//  - RULES: a data table (id, phase, when, chip, text). Add a rule by adding a row: no caller changes. firedRules() fires a rule only for a CLEAR
//    could / mistake / blunder / missed decision in the rule's own phase, never for a close call or a slight difference.
//  Scope (v1.99): nothing here reads ports, the longest road / largest army race, trades or the robber's target.
import { R5, incomeAt } from "./ai-mech.js";
import { kindOf } from "../lessons-row.js";
import { SEVERE } from "./score.js";

/** Rule thresholds, RELATIVE to the target points (so a game to 8 or to 12 reads the same). A separate calibration pass will tune these on more games. */
export const THRESHOLDS = { half: 0.5, lastGap: 1 };
export const PHASES = ["opening", "mid", "end"];

// ── phases ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Dynamic thirds of a game of `nTurns` turns: { nTurns, opening: [from, to], mid, end } (inclusive; an empty range has to < from; a game under 3 turns is all opening). */
export function phaseLimits(nTurns) {
  const T = Math.max(0, Math.floor(+nTurns || 0));
  if (T < 3) return { nTurns: T, opening: [1, T], mid: [T + 1, T], end: [T + 1, T] };
  const a = Math.max(1, Math.round(T / 3)), b = Math.min(T - 1, Math.max(a + 1, Math.round((2 * T) / 3)));
  return { nTurns: T, opening: [1, a], mid: [a + 1, b], end: [b + 1, T] };
}
/** "opening" | "mid" | "end" for a turn (a turn after the last one counts as end). */
export function phaseOf(turn, limits) {
  if (turn <= limits.opening[1]) return "opening";
  if (turn <= limits.mid[1]) return "mid";
  return "end";
}
/** The inclusive turn range [from, to] of a phase (printed on the phase bands). */
export const turnsOf = (limits, phase) => limits[phase].slice();
/** The number of turns of a recorded game (the largest turn a dice step belongs to). */
export const turnsOfGame = (stats) => (stats?.steps || []).reduce((m, s) => Math.max(m, s[0] || 0), 0);

// ── piece kind ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The kind of the BETTER move from its label: "Trade Ore for Brick, then City on ..." is a city (the trade only pays for it). */
export function bestKindOf(label) {
  const l = String(label || ""), m = /\bthen\s+(.+)$/i.exec(l);
  return kindOf(m ? m[1] : l);
}
export { kindOf };

// ── visible points, by replaying the log ───────────────────────────────────────────────────────────────────────────────────────────────────
const CACHE = new WeakMap();
/** The visible points of every seat after every step (step 0 = after set-up), from the event log alone:
 *  1 per settlement, 2 per city, 2 per award held (the recorder logs awards as "a kind holder prev"). Hidden victory-point cards are NOT counted.
 *  Returns { N, n, pts: [step][seat], hidden: [step][seat] (victory-point cards bought so far), turnOf: [turn per step], firstStep: Map turn -> first step of that turn }. */
export function pointsLog(stats, n) {
  if (!stats?.ev || !stats?.steps) return null;
  let c = CACHE.get(stats); if (c && c.n === n) return c;
  const N = stats.steps.length, own = new Map(), award = Array(n).fill(0), hid = Array(n).fill(0);
  const byStep = Array.from({ length: N + 1 }, () => []);
  stats.ev.forEach((e) => { if (e[0] >= 0 && e[0] <= N) byStep[e[0]].push(e); }); // the log is in play order; a stable bucket keeps it inside a step
  const pts = [], hidden = [];
  for (let s = 0; s <= N; s++) {
    for (const e of byStep[s]) {
      const [, code, a, b, x] = e;
      if (code === "b") { if (b === "s") own.set(x, [a, 1]); else if (b === "c") own.set(x, [a, 2]); }
      else if (code === "u") { if (b === "s") own.delete(x); else if (b === "c" && own.has(x)) own.set(x, [a, 1]); }
      else if (code === "a") { if (b >= 0 && b < n) award[b] += 2; if (x >= 0 && x < n) award[x] -= 2; } // ["a", kind, holder, prev]
      else if (code === "v" && b === "victoryPoint" && a >= 0 && a < n) hid[a] += 1;
    }
    const row = award.slice(); own.forEach(([q, k]) => { if (q >= 0 && q < n) row[q] += k; });
    pts.push(row); hidden.push(hid.slice());
  }
  const turnOf = [0, ...stats.steps.map((s) => s[0])], firstStep = new Map();
  turnOf.forEach((t, s) => { if (s > 0 && !firstStep.has(t)) firstStep.set(t, s); });
  c = { N, n, pts, hidden, turnOf, firstStep };
  CACHE.set(stats, c);
  return c;
}
/** visibleSeries(stats, n) -> [step][seat] visible points (exact). */
export const visibleSeries = (stats, n) => pointsLog(stats, n)?.pts || null;
/** The recorder's own series minus the hidden victory-point cards: [step][seat]. Same shape as visibleSeries; can be off by one for a step in the 6-player special build phase. */
export function vpSeries(stats, n) {
  const pl = pointsLog(stats, n); if (!pl || !stats.vp) return null;
  let last = stats.vp[0] || Array(n).fill(0);
  return pl.pts.map((_, s) => { last = stats.vp[s] || last; return last.map((v, q) => v - (pl.hidden[s][q] || 0)); });
}
/** Visible points of seat q at the START of `turn` (after the last step of the turn before; turn 1 = after set-up). */
export function pointsBefore(plog, turn, q) {
  if (!plog) return null;
  const s = plog.firstStep.get(turn);
  const step = s == null ? (turn > (plog.turnOf[plog.N] || 0) ? plog.N : 0) : s - 1;
  return plog.pts[Math.max(0, step)]?.[q] ?? null;
}
/** Visible points of seat q at the END of `turn` (after the last step of the turn; a turn without a step reads the points before it). */
export function pointsAfter(plog, turn, q) {
  if (!plog) return null;
  let s = -1; plog.turnOf.forEach((t, i) => { if (i > 0 && t <= turn) s = i; });
  return plog.pts[s < 0 ? 0 : s]?.[q] ?? null;
}

// ── the rules ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// m = the moment of one decision: { d (the decision), turn, phase, pts (your visible points then), target, missing (resources with no income then, [] when unknown),
//     pk (kind of the move played), bk (kind of the better move) }.   ctx = { target, th: THRESHOLDS }.
// when(m, ctx) -> falsy | true | { params for the chip }.   chip / text: keys of analysis-text.js (params: {res}, {pts, target}).
export const RULES = [
  { id: "missing-resource", phase: "opening", chip: "rule.missing.chip", text: "rule.missing.text",
    when: (m) => m.missing.length > 0 && ["settlement", "city", "bank", "card", "road"].includes(m.bk) && { res: m.missing[0], missing: m.missing } },
  { id: "city-at-half", phase: "mid", chip: "rule.city.chip", text: "rule.city.text",
    when: (m, c) => m.bk === "city" && m.pk !== "city" && m.pts != null && m.pts >= c.th.half * c.target && { pts: m.pts, target: c.target } },
  { id: "last-point", phase: "end", chip: "rule.last.chip", text: "rule.last.text",
    when: (m, c) => m.pts != null && m.pts >= c.target - c.th.lastGap && ["settlement", "city", "card"].includes(m.bk) && { pts: m.pts, target: c.target } },
];
export const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]));

/** v1.99 scope: robber moves and anything about ports or the longest road / largest army race are not analysed (deferred to v2.0): they keep their cost in "other moves" but are never listed as an error or used by a rule. */
export const OUT_OF_SCOPE = /longest road|largest army|harbou?r|\bports?\b/i;
export const inScope = (d) => !!d && d.k !== "robber" && !OUT_OF_SCOPE.test(`${d.x?.label || ""} ${d.x?.best?.label || ""}`);
/** Was this decision a CLEAR error? (the one rule: class could / mistake / blunder / missed AND a clear verdict, i.e. a gap of at least 2 x the move's own noise; a "missed" with only a slight verdict is not an error) */
export const isClearError = (d) => !!d && SEVERE.includes(d.cls) && d.gp >= 1 && !!d.x?.best && d.vc === "clear" && inScope(d);

const missingAt = (raw, turn, me) => {
  if (!raw) return [];
  try { const dots = incomeAt(raw, Math.max(0, turn - 1), me).dots; return R5.filter((r) => !dots[r]); } catch (_) { return []; }
};
/** The moment of a decision (what a rule reads). */
export function momentOf(d, { plog, limits, raw, me, target }) {
  const turn = d.t ?? d.x?.t ?? 0;
  return { d, turn, phase: d.k === "setup" ? "start" : phaseOf(turn, limits), pts: d.k === "setup" ? null : pointsBefore(plog, turn, me), target,
    missing: d.k === "setup" ? [] : missingAt(raw, turn, me), pk: kindOf(d.x?.label), bk: bestKindOf(d.x?.best?.label) };
}
/** The rules that fired in one game: [{ id, phase, cost (win chance lost, whole %), n, moments: [{ turn, i, gp, cls, pts, target, params, chip, text }] }], opening to end, the dearest first inside a phase.
 *  ds = decisions of YOUR seat (decide() output). A rule fires only on a clear error of its own phase, set-up picks are not part of it (they are Lesson 2). */
export function firedRules(ds, { stats, n, me, target = 10, raw = null, rules = RULES, th = THRESHOLDS }) {
  const plog = pointsLog(stats, n), limits = phaseLimits(turnsOfGame(stats)), ctx = { target, th }, out = [];
  if (!plog || !Array.isArray(ds)) return out;
  const moments = ds.filter((d) => d.k !== "setup" && isClearError(d)).map((d) => momentOf(d, { plog, limits, raw, me, target }));
  for (const r of rules) {
    const hit = [];
    for (const m of moments) {
      if (m.phase !== r.phase) continue;
      const w = r.when(m, ctx); if (!w) continue;
      hit.push({ turn: m.turn, i: m.d.i, gp: m.d.gp, cls: m.d.cls, pts: m.pts, target, params: w === true ? {} : w, chip: r.chip, text: r.text });
    }
    if (hit.length) out.push({ id: r.id, phase: r.phase, cost: hit.reduce((a, h) => a + h.gp, 0), n: hit.length, moments: hit.sort((a, b) => a.turn - b.turn || a.i - b.i) });
  }
  return out.sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || b.cost - a.cost);
}
