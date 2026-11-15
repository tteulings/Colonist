// v1.73 AI tab: the data the tab shows and sends. Series = win chance of every player after each turn (luck run when it covers the game,
// else the seats of the reviewed player's decisions); timeline = what each player built / took on which turn. Facts = the recap facts
// plus explicit decisions, per-player win chance per turn and the points timeline. Nothing here is guessed: a part we lack is left out.
import { decide } from "./evaluate.js";
import { luckKey } from "../review-luck.js";
import { recapFacts } from "./recap-facts.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const unesc = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const clip = (s, n) => { s = unesc(s).replace(/<[^>]+>/g, ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
export const AI_FACTS_MAX = 30000;

/** { byTurn: Map(turn -> fractions per seat), maxT } : turn 0 = after set-up, turn T = after the last step of turn T. */
export function aiSeries(g) {
  const st = g._st, n = g.players.length, by = new Map();
  if (!st?.steps?.length || !g.winner) return { by, maxT: 0, src: null };
  const L = tryv(() => g._lkState()), ok = L && !L.na && L.done && L.cover >= 0.9;
  const N = Math.min(st.N, st.steps.length);
  let src = null;
  if (ok) {
    const store = g._lkStore(), b = new Map();
    g._lkEvents().forEach((ev) => { const r = store.res[luckKey(ev)]; if (ev.kind === "dice" && r?.b) b.set(ev.s, r.b); });
    const w = g.winner.id, fin = Array.from({ length: n }, (_, q) => (q === w ? 1 : 0));
    const win = (k) => (k <= 0 ? (store.res["seat:0:-1"]?.v || b.get(0)) : k >= N ? fin : b.get(k));
    const last = new Map();
    for (let k = 1; k <= N; k++) last.set(st.turnOf[k] ?? 0, k);
    const v0 = win(0); if (v0) by.set(0, v0);
    [...last.entries()].sort((a, c) => a[0] - c[0]).forEach(([t, k]) => { const v = win(k); if (v && t >= 1) by.set(t, v); else if (v && t === 0) by.set(0, v); });
    if (by.size > 1) src = "luck";
  }
  if (!src) {
    by.clear();
    const rv = g._rvOf?.(g._rvPid);
    if (rv?.results?.length) {
      const ds = tryv(() => g._rvDecisions(rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i)), []);
      ds.forEach((d) => { if (!d.seats) return; const s = d.seats.reduce((a, c) => a + c, 0) || 1; by.set(d.k === "setup" ? 0 : (g._rcTurnOf?.(d) ?? d.t), d.seats.map((v) => v / s)); });
      if (by.size > 1) src = "moves";
    }
  }
  const maxT = Math.max(0, ...by.keys(), g.turn || 0);
  return { by, maxT, src };
}
/** The seat's win chance in whole % after turn t (the nearest earlier turn when that one has none). */
export function wcAt(ser, seat, t) {
  for (let q = t; q >= 0; q--) { const v = ser.by.get(q); if (v && v[seat] != null) return Math.round(v[seat] * 100); }
  return null;
}
/** The real change of a seat's win chance over turns [t0..t1]: { from, to, d } in whole %, or null. */
export function wcChange(ser, seat, t0, t1) {
  if (!ser?.by?.size || seat == null || !Number.isFinite(t0)) return null;
  t1 = Number.isFinite(t1) ? t1 : t0;
  const from = wcAt(ser, seat, Math.max(0, Math.min(t0, t1) - 1)), to = wcAt(ser, seat, Math.max(t0, t1));
  return from == null || to == null ? null : { from, to, d: to - from };
}
/** What each player built or took, by turn: [[turn, kind]] with kind s settlement, c city, L longest road, A largest army, v point card. */
export function aiTimeline(g) {
  const st = g._st, out = g.players.map(() => []);
  if (!st?.stepEvents) return out;
  for (let k = 0; k <= (st.N || 0); k++) (st.stepEvents[k] || []).forEach((e) => {
    const t = st.turnOf?.[k] ?? 0;
    if (e[1] === "b" && out[e[2]] && (e[3] === "s" || e[3] === "c")) out[e[2]].push([t, e[3]]);
    else if (e[1] === "v" && e[3] === "victoryPoint" && out[e[2]]) out[e[2]].push([t, "v"]);
  });
  (st.awards || []).forEach((a) => { if (a.pid >= 0 && out[a.pid]) out[a.pid].push([st.turnOf?.[a.s] ?? 0, a.kind === "L" ? "L" : "A"]); });
  out.forEach((l) => l.sort((a, b) => a[0] - b[0]));
  return out;
}

const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const COST = { settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, road: { wood: 1, brick: 1 }, dev: { sheep: 1, wheat: 1, ore: 1 } };
const scale = (c, k) => Object.fromEntries(Object.entries(c).map(([r, a]) => [r, a * k]));
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
/** The start position: dice dots per resource of the two set-up settlements, the plan that FITS it (computed here) and how much of the real building
 *  matched that plan (coherence 0-100). null without data. */
export function aiStart(g, q) {
  const st = g._st, geo = g.geometry, s = st?.sources?.[q]; if (!st?.stepEvents || !geo?.nodes || !s) return null;
  const pips = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; let n = 0;
  for (let k = 0; k <= (st.N || 0); k++) { if ((st.turnOf?.[k] ?? 0) !== 0) continue; (st.stepEvents[k] || []).forEach((e) => { if (e[1] === "b" && e[2] === q && e[3] === "s") { n++; (geo.nodes[e[4]]?.adjacentHexes || []).forEach((h) => { const hx = geo.hexes[h]; if (hx?.number && pips[hx.resource] != null) pips[hx.resource] += PIPS[hx.number] || 0; }); } }); }
  if (!n) return null;
  const A = pips.ore + pips.wheat, B = pips.wood + pips.brick, tot = Math.max(1, s.total);
  const fit = A >= 1.35 * B && pips.ore >= 3 ? "cities" : B >= 1.35 * A ? "roads" : "balanced";
  const match = fit === "cities" ? s.cities + s.army + s.cards : fit === "roads" ? Math.max(0, s.settlements - 2) + s.road : s.settlements + s.cities;
  const roads = st.built?.[q]?.road || 0;
  return { startDots: pips, fit, fitting: fit === "cities" ? "cities + development cards / army (ore and grain heavy)" : fit === "roads" ? "settlements + roads / longest road (wood and brick heavy)" : "balanced: settlements first, then cities", coherencePct: Math.round(Math.min(1, match / tot) * 100), roadsBuilt: roads };
}
/** One player's plan: where the points came from, when, and a one-line label computed here ("cities + army + point cards"). */
export function aiPlan(g, q, tl = aiTimeline(g)) {
  const s = g._st?.sources?.[q]; if (!s) return null;
  const EN = { cities: "cities", settlements: "settlements", road: "longest road", army: "army", cards: "point cards", islands: "islands" };
  const parts = [["cities", s.cities], ["settlements", s.settlements], ["road", s.road], ["army", s.army], ["cards", s.cards], ["islands", s.islands]]
    .filter(([k, v]) => v >= (k === "settlements" ? 4 : k === "cards" || k === "islands" ? 1 : 2) && !(k === "cards" && v < 2 && s.cities + s.road + s.army >= 4));
  parts.sort((a, b) => b[1] - a[1]);
  const keys = (parts.length ? parts : [["settlements", s.settlements]]).slice(0, 3).map((x) => x[0]);
  return { keys, label: keys.map((k) => EN[k]).join(" + "), total: s.total, sources: { settlements: s.settlements, cities: s.cities, longestRoad: s.road, largestArmy: s.army, pointCards: s.cards }, timeline: tl[q] || [] };
}
/** How close the reviewed player came: points vs the winner, the best win chance, what the cheapest next point needed with the final hand
 *  and an ESTIMATE of how many turns away that was (from the player's own production per turn). null when there is nothing to say. */
export function aiNearMiss(g, ser = aiSeries(g)) {
  const me = g._rvPid, st = g._st, P = g.players[me], W = g.winner; if (!P || !W || !st) return null;
  const others = g.players.filter((p) => p !== P), top = others.length ? Math.max(...others.map((p) => p.victoryPoints)) : 0;
  const won = W === P, margin = won ? P.victoryPoints - top : W.victoryPoints - P.victoryPoints;
  const goal = g.winPoints || 10, T = Math.max(1, g.turn || 1);
  const out = { result: won ? "won" : "lost", youPoints: P.victoryPoints, winnerPoints: W.victoryPoints, margin, pointsToWin: goal };
  let best = null, lead = null;
  for (const [t, v] of [...ser.by.entries()].sort((a, b) => a[0] - b[0])) {
    if (v[me] == null) continue;
    if (!best || v[me] >= best.v) best = { turn: t, pct: Math.round(v[me] * 100), v: v[me] };
    if (v[me] >= Math.max(...v) - 1e-9) lead = { turn: t, pct: Math.round(v[me] * 100) };
  }
  if (best) out.bestWinChance = { turn: best.turn, pct: best.pct };
  if (lead) out.lastTurnAsFavourite = lead;
  if (won) return out;
  const hand = Object.fromEntries(R5.map((r) => [r, P.resources?.[r] || 0])), cands = [];
  const miss = (c) => Object.fromEntries(Object.entries(c).map(([r, a]) => [r, Math.max(0, a - hand[r])]).filter(([, a]) => a > 0));
  const add = (kind, label, cost, extra = {}) => { const m = miss(cost); cands.push({ kind, label, missing: m, cards: Object.values(m).reduce((a, b) => a + b, 0), ...extra }); };
  if (P.cities.size < 4 && P.settlements.size) add("city", "a city", COST.city);
  if (P.settlements.size < 5) add("settlement", "a settlement", COST.settlement);
  const lrH = g.longestRoadHolder, lrLen = lrH != null && lrH >= 0 ? g.players[lrH]?.longestRoadLength || 0 : 4;
  if (lrH !== me) { const k = Math.max(1, Math.max(5, lrLen + 1) - (P.longestRoadLength || 0)); if (k <= 2) add("road", "Longest road", scale(COST.road, k)); }
  const laH = g.largestArmyHolder, laKn = laH != null && laH >= 0 ? g.players[laH]?.knightsPlayed || 0 : 2;
  if (laH !== me && Math.max(3, laKn + 1) - (P.knightsPlayed || 0) === 1) add("army", "Largest army", COST.dev);
  add("dev", "a development card", COST.dev, { chance: true });
  const rank = { city: 0, settlement: 1, road: 2, army: 3, dev: 9 };
  cands.sort((a, b) => (a.chance ? 1 : 0) - (b.chance ? 1 : 0) || a.cards - b.cards || rank[a.kind] - rank[b.kind]);
  const c = cands[0];
  if (c) {
    let away = 0;
    for (const [r, a] of Object.entries(c.missing)) { const rate = (st.prod?.[me]?.[R5.indexOf(r)] || 0) / T; if (!rate) { away = null; break; } away = Math.max(away, Math.ceil(a / rate)); }
    out.needed = { kind: c.kind, label: c.label, missing: c.missing, ...(c.chance ? { note: "only a chance of a point card" } : {}) };
    out.turnsAway = away == null ? null : Math.max(away, 1);
    out.turnsAwayNote = "ESTIMATE from your own production per turn; trades and ports could be faster";
  }
  out.finalHand = hand;
  out.pointsShort = Math.max(0, goal - P.victoryPoints);
  return out;
}

/** The facts for the insights / game question: recap facts + decisions + win chance per turn + points timeline. */
export function aiFacts(g, { max = AI_FACTS_MAX } = {}) {
  const base = recapFacts(g, { max: Math.round(max * 0.6) });
  if (!base) return null;
  const f = { ...base.obj }, n = g.players.length;
  const nm = (q) => (g._rvIsYou(q) ? "You" : unesc(g.players[q]?.name || `Player ${q + 1}`));
  delete f.winChanceByTurn; delete f.tableWinChanceAt;
  const ser = aiSeries(g);
  if (ser.by.size > 1) {
    f.winChancePctByTurn = { note: `[turn, win chance %] after that turn, per player (turn 0 = after set-up)${ser.src === "moves" ? "; only the turns with a decision" : ""}`, ...Object.fromEntries(g.players.map((p) => [nm(p.id), [...ser.by.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, Math.round(v[p.id] * 100)])])) };
  }
  const tl = aiTimeline(g), KN = { s: "settlement", c: "city", L: "Longest road", A: "Largest army", v: "point card" };
  f.plans = Object.fromEntries(g.players.map((p) => { const a = tryv(() => aiPlan(g, p.id, tl)); const sp = tryv(() => aiStart(g, p.id)); return [nm(p.id), a ? { plan: a.label, ...(sp ? { start: sp.startDots, fittingPlanFromStart: sp.fitting, planCoherencePct: sp.coherencePct, roadsBuilt: sp.roadsBuilt } : {}), points: a.total, from: a.sources, timeline: a.timeline.map(([t, k]) => `${KN[k]} t${t}`) } : { timeline: tl[p.id].map(([t, k]) => `${KN[k]} t${t}`) }]; }));
  const nmz = tryv(() => aiNearMiss(g, ser)); if (nmz) f.nearMiss = nmz;
  const decs = [];
  g.players.forEach((p) => {
    const r = tryv(() => g._rvOf(p.id));
    if (!r?.results?.length) return;
    const res = r.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
    const ds = tryv(() => (p.id === g._rvPid ? g._rvDecisions(res) : decide(res, n, p.id)), []);
    ds.filter((d) => d.x?.best && !d.same && d.gap > 0.01).sort((a, b) => b.gap - a.gap).slice(0, p.id === g._rvPid ? 6 : 2).forEach((d) => {
      decs.push({ player: nm(p.id), turn: d.k === "setup" ? 0 : (g._rcTurnOf?.(d) ?? d.t), played: clip(d.x.label, 90), better: clip(d.x.best.label, 90), costPct: Math.round(d.gap * 1000) / 10, rating: d.cls });
    });
  });
  if (decs.length) f.decisions = decs.sort((a, b) => a.turn - b.turn);
  let json = JSON.stringify(f);
  const trim = [(o) => { o.decisions = o.decisions?.slice(0, 10); }, (o) => Object.values(o.plans || {}).forEach((x) => delete x.timeline), (o) => delete o.dice, (o) => { o.turningPointCandidates = o.turningPointCandidates?.slice(0, 4); }];
  for (const t of trim) { if (json.length <= max) break; t(f); json = JSON.stringify(f); }
  return { obj: f, json };
}
