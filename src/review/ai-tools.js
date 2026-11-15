// v1.77 AI tab tools. The model gets a compact INDEX and asks for details; the app answers from the stored review.
//   Tier 1 (instant, local): get_decision, get_turn, get_luck, get_plan, get_lessons, list_swings.
//   Tier 2 (the review engine in its worker, seconds): simulate_moves, can_still_win. Planned here (aiSimPlan), run by review-ai.js.
// Every number a tool returns comes from the stored review or from the engine; nothing is invented.
import { aiFacts, aiSeries, wcChange } from "./ai-facts.js";
import { decide } from "./evaluate.js";
import { turningSteps } from "./recap-facts.js";
import { swingCause, causeEvent } from "./ai-cause.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const unesc = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/<[^>]+>/g, "");
const clip = (s, n) => { s = unesc(s); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const pc = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100));
export const TIER2 = new Set(["simulate_moves", "can_still_win"]);
export const TOOL_NAMES = ["get_decision", "get_turn", "get_luck", "get_plan", "get_lessons", "list_swings", "simulate_moves", "can_still_win"];
export const CAPS = { rounds: 6, calls: 12, sims: { insights: 2, game: 3 }, moves: 4 };
const R5 = ["wood", "brick", "sheep", "wheat", "ore"];

const nameOf = (g, q) => (g._rvIsYou(q) ? "You" : unesc(g.players[q]?.name || `Player ${q + 1}`));
/** A player name (as in the index) to a seat; "You", "me", the player's name, or a seat number. */
export function aiSeatOf(g, who) {
  const w = String(who ?? "").trim().toLowerCase(); if (!w) return null;
  if (["you", "me", "i", "jij", "ik"].includes(w)) return g._rvPid;
  const i = g.players.findIndex((p) => nameOf(g, p.id).toLowerCase() === w || unesc(p.name || "").toLowerCase() === w);
  return i >= 0 ? g.players[i].id : null;
}
const cache = new WeakMap();
const memo = (g, key, f) => { const R = g._rv; if (!R) return f(); let m = cache.get(R); if (!m) cache.set(R, (m = new Map())); if (!m.has(key)) m.set(key, f()); return m.get(key); };

/** All reviewed decisions of every player: { seat, turn, n (nth of that player on that turn), d, x }. */
export function aiDecList(g) {
  return memo(g, "decs", () => {
    const n = g.players.length, pid = g._rvPid, out = [];
    g.players.forEach((p) => {
      const r = tryv(() => g._rvOf(p.id)); if (!r?.results?.length) return;
      const rs = r.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
      const ds = tryv(() => (p.id === pid ? g._rvDecisions(rs) : decide(rs, n, p.id)), []), seen = {};
      ds.forEach((d) => {
        const x = d.x || d; if (!x?.cands) return;
        const turn = d.k === "setup" ? 0 : (g._rcTurnOf?.(d) ?? d.t), key = `${p.id}|${turn}`; seen[key] = (seen[key] ?? -1) + 1;
        out.push({ seat: p.id, turn, n: seen[key], d, x, gap: Math.max(0, d.gap || 0) });
      });
    });
    return out;
  });
}
const steps = (g) => memo(g, "steps", () => {
  const L = tryv(() => g._lkState()), luckOk = L && !L.na && L.done && L.cover >= 0.9, n = g.players.length;
  return tryv(() => turningSteps(g, (q) => nameOf(g, q), { luckOk, pid: g._rvPid, n }), { all: [] }).all || [];
});
/** v1.78 { player, event, delta (win-chance points of the viewed player), turn } for the biggest part of the viewed player's change in turn T, from the app. */
const causeOf = (g, T) => { const c = tryv(() => swingCause(g, T, g._rvPid)); return c ? { player: nameOf(g, c.actor), event: causeEvent(c, (q) => nameOf(g, q)), delta: c.delta, turn: T, of: "the win chance of You" } : null; };
const facts = (g) => memo(g, "facts", () => tryv(() => aiFacts(g)?.obj, null));

const focusId = (f) => (f ? (f.node ?? f.edge ?? f.hex ?? f.city ?? null) : null);

/** The compact index sent first: who, result, near miss, plans, win chance per turn, the biggest swings, the reviewed decisions. */
export function aiIndex(g) {
  const f = facts(g); if (!f) return null;
  const idx = { ...f };
  ["turningPointCandidates", "dice", "costliestDecisions", "bestDecisions", "decisions"].forEach((k) => delete idx[k]);
  Object.values(idx.plans || {}).forEach((p) => { delete p.timeline; });
  const sw = steps(g).map((s) => ({ turn: s.turn, player: s.player, score: s.score, you: s.winChancePct?.You })).sort((a, b) => b.score - a.score).slice(0, 6).sort((a, b) => a.turn - b.turn);
  idx.topSwings = sw.map((s) => ({ turn: s.turn, player: s.player, youWinChancePct: s.you }));
  const list = aiDecList(g).filter((e) => e.x.best && e.gap > 0.005).sort((a, b) => b.gap - a.gap).slice(0, 18).sort((a, b) => a.turn - b.turn || a.seat - b.seat);
  idx.reviewedDecisions = list.map((e) => ({ turn: e.turn, player: nameOf(g, e.seat), n: e.n, played: clip(e.x.label, 70), better: clip(e.x.best.label, 70), costPct: Math.round(e.gap * 1000) / 10 }));
  idx.turns = g.turn || null;
  idx.note = "INDEX only. Players are named as here. Fetch details with the tools (get_decision{turn,player,n}, get_turn, get_luck, get_plan, get_lessons, list_swings; engine: simulate_moves, can_still_win).";
  const json = JSON.stringify(idx);
  return { obj: idx, json };
}

const pick = (g, a, needMain = false) => {
  const seat = aiSeatOf(g, a.player); if (seat == null) return { err: `unknown player "${a.player}"` };
  const turn = Number.isInteger(+a.turn) ? +a.turn : null; if (turn == null) return { err: "turn must be a number" };
  const here = aiDecList(g).filter((e) => e.seat === seat && e.turn === turn);
  if (!here.length) return { err: `no reviewed decision for ${nameOf(g, seat)} on turn ${turn}`, seat, turn };
  const n = a.n != null && Number.isInteger(+a.n) ? +a.n : null;
  const e = n != null ? here.find((x) => x.n === n) : [...here].sort((x, y) => y.gap - x.gap)[0];
  return e ? { e, seat, turn, of: here.length } : { err: `${nameOf(g, seat)} has ${here.length} reviewed decision(s) on turn ${turn} (n 0..${here.length - 1})`, seat, turn };
};

const lessonsKind = { setup: ["setup"], robber: ["robber"], build: ["build", "shipmove"], dev_cards: ["buy", "play"], trading: ["bank"], timing: ["end"] };

/** Tier 1: run a lookup. Always returns a plain, small object. */
export function aiToolRun(g, name, a = {}) {
  try {
    if (name === "get_decision") {
      const r = pick(g, a); if (r.err) return { error: r.err };
      const { e } = r, x = e.x, base = x.cands[0]?.win;
      const cands = x.cands.map((c, i) => ({ label: clip(c.label, 80), at: focusId(c.focus), winPct: pc(c.win), vsPlayedPct: base != null && c.win != null ? pc(c.win) - pc(base) : null, futures: c.n, ...(i === 0 ? { played: true } : {}) }))
        .sort((p, q) => (q.winPct ?? -1) - (p.winPct ?? -1)).slice(0, 8);
      const out = { player: nameOf(g, e.seat), turn: e.turn, n: e.n, decisionsThatTurn: r.of, kind: x.k, played: clip(x.label, 80), playedWinPct: pc(base), better: x.best ? clip(x.best.label, 80) : null, costPct: Math.round(e.gap * 1000) / 10, rating: e.d.cls || null, evaluated: cands };
      if (x.aim) out.aims = JSON.parse(JSON.stringify(x.aim, (k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v))); // where the points of the better (A) and played (B) futures come from
      if (x.simple) out.simpleChoice = x.simple;
      if (JSON.stringify(out).length > 4200) delete out.aims;
      return out;
    }
    if (name === "get_turn") {
      const T = +a.turn; if (!Number.isInteger(T)) return { error: "turn must be a number" };
      const st = steps(g).filter((s) => s.turn === T).slice(0, 6).map((s) => { const { score, ...r } = s; return r; });
      const ser = tryv(() => aiSeries(g)), wc = ser ? Object.fromEntries(g.players.map((p) => { const c = wcChange(ser, p.id, T, T); return [nameOf(g, p.id), c ? [c.from, c.to] : null]; }).filter(([, v]) => v)) : {};
      const decs = aiDecList(g).filter((e) => e.turn === T).map((e) => ({ player: nameOf(g, e.seat), n: e.n, played: clip(e.x.label, 70), better: e.x.best ? clip(e.x.best.label, 70) : null, costPct: Math.round(e.gap * 1000) / 10 }));
      if (!st.length && !decs.length && !Object.keys(wc).length) return { error: `no data for turn ${T} (the game lasted ${g.turn} turns)` };
      const cause = causeOf(g, T);
      return { turn: T, winChancePctBeforeAfter: wc, ...(cause ? { cause } : {}), steps: st, reviewedDecisions: decs };
    }
    if (name === "get_luck") {
      const seat = aiSeatOf(g, a.player); if (seat == null) return { error: `unknown player "${a.player}"` };
      const p = facts(g)?.players?.find((x) => x.name === nameOf(g, seat));
      return p ? { player: p.name, luckInWinChancePct: p.luckInWinChancePct || null, resourceCards: p.resourceCards || null, winChanceLostByMovesPct: p.winChanceLostByMovesPct ?? null } : { error: "no luck data for that player" };
    }
    if (name === "get_plan") {
      const seat = aiSeatOf(g, a.player); if (seat == null) return { error: `unknown player "${a.player}"` };
      const f = facts(g), nm = nameOf(g, seat), pl = f?.plans?.[nm]; if (!pl) return { error: "no plan data" };
      const { timeline, ...rest } = pl;
      return { player: nm, ...rest, timeline: (timeline || []).slice(0, 14), ...(seat === g._rvPid && f.nearMiss ? { nearMiss: f.nearMiss } : {}) };
    }
    if (name === "get_lessons") {
      const kinds = lessonsKind[a.category]; if (!kinds) return { error: "category: setup, robber, build, dev_cards, trading or timing" };
      const mine = aiDecList(g).filter((e) => e.seat === g._rvPid && kinds.includes(e.x.k));
      const cost = mine.reduce((s, e) => s + e.gap, 0);
      return { category: a.category, decisions: mine.length, totalCostPct: Math.round(cost * 1000) / 10, worst: mine.filter((e) => e.gap > 0.005).sort((p, q) => q.gap - p.gap).slice(0, 4).map((e) => ({ turn: e.turn, n: e.n, played: clip(e.x.label, 70), better: e.x.best ? clip(e.x.best.label, 70) : null, costPct: Math.round(e.gap * 1000) / 10 })) };
    }
    if (name === "list_swings") {
      const n = Math.max(1, Math.min(8, +a.n || 5));
      return { swings: steps(g).sort((p, q) => q.score - p.score).slice(0, n).sort((p, q) => p.turn - q.turn).map((s) => { const { score, ...r } = s, cause = causeOf(g, s.turn); return { ...r, swingPct: score, ...(cause ? { cause } : {}) }; }) };
    }
  } catch (e) { return { error: "lookup failed" }; }
  return { error: `unknown tool ${name}` };
}

const TYPE_LABEL = { city: /^City/i, settlement: /^Settlement/i, road: /^Road/i, ship: /^Ship/i };
const RES = { wood: "wood", lumber: "wood", brick: "brick", sheep: "sheep", wool: "sheep", wheat: "wheat", grain: "wheat", ore: "ore" };
const DEVC = { knight: "knight", roadbuilding: "roadBuilding", road_building: "roadBuilding", yearofplenty: "yearOfPlenty", monopoly: "monopoly" };

/** Tier 2: turn the model's request into engine requests (one per move) on the stored position. Returns { reqs:[{label?, rec}], base, meta } or { error }. */
export function aiSimPlan(g, name, a = {}) {
  const R = g._rv; if (!R?.base) return { error: "no stored position" };
  if (name === "can_still_win") {
    const seat = aiSeatOf(g, a.player); if (seat == null) return { error: `unknown player "${a.player}"` };
    const T = +a.turn; if (!Number.isInteger(T)) return { error: "turn must be a number" };
    const e = aiDecList(g).filter((x) => x.seat === seat && x.turn >= T && x.x.k !== "setup").sort((p, q) => p.turn - q.turn || p.n - q.n)[0] || (T === 0 ? aiDecList(g).find((x) => x.seat === seat) : null);
    if (!e) return { error: `no reviewed decision for ${nameOf(g, seat)} from turn ${T}` };
    const rec = R.recs[e.x.i]; if (!rec?.st) return { error: "position not stored" };
    return { base: R.base, reqs: [{ rec, opts: { budget: { nPer: 120 } } }], meta: { tool: name, player: nameOf(g, seat), turn: e.turn, n: e.n, stored: { bestWinPct: pc(Math.max(...e.x.cands.map((c) => c.win ?? 0))), playedWinPct: pc(e.x.win) } } };
  }
  if (name !== "simulate_moves") return { error: `unknown tool ${name}` };
  const r = pick(g, a); if (r.err) return { error: r.err };
  const moves = Array.isArray(a.moves) ? a.moves.slice(0, CAPS.moves) : []; if (!moves.length) return { error: "no moves given" };
  const { e } = r, rec0 = R.recs[e.x.i]; if (!rec0?.st) return { error: "position not stored" };
  const reqs = [], pos = tryv(() => JSON.parse(rec0.st)), me = pos?.players?.[e.seat], hand = me?.resources || null;
  const COSTS = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, ship: { wood: 1, sheep: 1 }, buy: { sheep: 1, wheat: 1, ore: 1 } };
  const lacks = (c) => (hand && rec0.k !== "setup" && !(pos.freeRoadsRemaining > 0) ? Object.entries(COSTS[c]).filter(([r, n]) => (hand[r] || 0) < n).map(([r, n]) => `${n - (hand[r] || 0)} ${r}`) : []);
  const pips = (id) => (g.geometry?.nodes?.[id]?.adjacentHexes || []).reduce((a, h) => a + ({ 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }[g.geometry.hexes[h]?.number] || 0), 0);
  for (const m of moves) {
    let k = null, act = null;
    const kind = String(m.kind || "").toLowerCase(), type = String(m.type || "").toLowerCase();
    if (rec0.k === "robber") { if (kind !== "robber" || !Number.isInteger(+m.hex)) { reqs.push({ error: "at a robber decision only a robber move (hex) can be tried" }); continue; } k = "robber"; act = { hex: +m.hex }; }
    else if (rec0.k === "setup") {
      if (kind !== "build" || type !== "settlement") { reqs.push({ error: "at a set-up decision only a settlement spot can be tried" }); continue; }
      const id = m.at != null ? +m.at : null; if (!Number.isInteger(id)) { reqs.push({ error: "give the spot id (at) from get_decision" }); continue; } k = "setup"; act = { n: id };
    } else if (kind === "build") {
      if (!TYPE_LABEL[type]) { reqs.push({ error: "build type: road, settlement, city or ship" }); continue; }
      let id = m.at != null && Number.isInteger(+m.at) ? +m.at : null;
      { const lk = lacks(type); if (lk.length) { reqs.push({ error: `not affordable there: a ${type} needs ${lk.join(" + ")} more than ${nameOf(g, e.seat)} had` }); continue; } }
      if (id == null && type === "city") id = (me?.settlements || []).slice().sort((a, b) => pips(b) - pips(a))[0] ?? null; // the player's own settlement with the most dice dots
      if (id == null) { // the engine's own best spot of that type among the evaluated candidates
        const c = e.x.cands.filter((c) => TYPE_LABEL[type].test(String(c.label)) && focusId(c.focus) != null).sort((p, q) => (q.win ?? 0) - (p.win ?? 0))[0];
        if (!c) { reqs.push({ error: `no ${type} spot was among the engine's candidates there (give "at")` }); continue; } id = focusId(c.focus);
      }
      k = "build"; act = { type, id };
    } else if (kind === "bank") {
      const gv = RES[String(m.give || "").toLowerCase()], gt = RES[String(m.get || "").toLowerCase()];
      if (!gv || !gt || gv === gt) { reqs.push({ error: "bank trade needs give and get resources" }); continue; } k = "bank"; act = { tr: [[gv, gt]] };
    } else if (kind === "buy") { const lk = lacks("buy"); if (lk.length) { reqs.push({ error: `not affordable there: a development card needs ${lk.join(" + ")} more` }); continue; } k = "buy"; act = {}; }
    else if (kind === "play") { const c = DEVC[String(m.card || "").toLowerCase().replace(/\s+/g, "")]; if (!c) { reqs.push({ error: "card: knight, roadBuilding, yearOfPlenty or monopoly" }); continue; } k = "play"; act = { t: c }; }
    else if (kind === "end") { k = "end"; act = {}; }
    else { reqs.push({ error: "unknown move kind" }); continue; }
    reqs.push({ rec: { ...rec0, k, a: act } });
  }
  if (!reqs.some((q) => q.rec)) return { error: reqs[0]?.error || "no valid move" };
  return { base: R.base, reqs, meta: { tool: name, player: nameOf(g, e.seat), turn: e.turn, n: e.n, stored: { playedWinPct: pc(e.x.win), playedLabel: clip(e.x.label, 70), bestStoredWinPct: pc(Math.max(...e.x.cands.map((c) => c.win ?? 0))) } } };
}

/** Engine results (one per request) to the object the model reads. */
export function aiSimResult(plan, outs) {
  const M = plan.meta, rows = plan.reqs.map((q, i) => {
    if (!q.rec) return { error: q.error };
    const o = outs[i];
    if (!o || o.skip || o.win == null) return { error: o?.skip === "forced" ? "that move is not possible there (or it is the only move)" : "the engine could not run this move" };
    const p = o.win, n = o.futures || 0, se = n ? Math.sqrt(Math.max(0.0001, p * (1 - p)) / n) : null;
    return { label: clip(o.label, 80), winPct: pc(p), plusMinusPct: se != null ? Math.max(1, Math.round(se * 100)) : null, futures: n, ...(M.stored.playedWinPct != null ? { vsPlayedPct: pc(p) - M.stored.playedWinPct } : {}), ...(M.tool === "can_still_win" ? { bestLineWinPct: pc(Math.max(...(o.cands || []).map((c) => c.win ?? 0))), bestMove: o.best ? clip(o.best.label, 80) : clip(o.label, 80) } : {}) };
  });
  const games = rows.reduce((s, r) => s + (r.futures || 0), 0);
  return { tool: M.tool, player: M.player, turn: M.turn, n: M.n, playedLabel: M.stored.playedLabel || null, storedPlayedWinPct: M.stored.playedWinPct, results: rows, games, note: "100 futures a move: differences under about 8 points are within noise" };
}

// ── v1.77 consistency: the app reads "X instead of Y on turn T" itself, so the answer is about that comparison, from one engine record ──
const KINDRE = [["city", /\b(?:cit(?:y|ies)|stad|steden)\b/], ["settlement", /\b(?:settlements?|villages?|dorpen|dorp)\b/], ["road", /\b(?:roads?|wegen|weg)\b/], ["ship", /\bships?\b/], ["buy", /\b(?:dev(?:elopment)? cards?|ontwikkelingskaarten?)\b/], ["end", /\b(?:end(?:ed)?(?: my| the)? turn|just end|passed|do nothing|beurt (?:be\u00ebindigd|beëindigd))\b/]];
const kindIn = (t) => { let b = null; KINDRE.forEach(([k, re]) => { const m = re.exec(t); if (m && (!b || m.index < b.i)) b = { k, i: m.index }; }); return b?.k || null; };
/** "What if I had built a city instead of a road on turn 12?" -> { turn: 12, x: "city", y: "road" }; null when it is no what-if about a move on a turn. */
export function aiIntent(q) {
  const s = String(q ?? "").toLowerCase(), tm = s.match(/\b(?:turn|beurt)\s*(\d+)/); if (!tm || !/\b(?:what if|what would|had i|if i had|would have|wat als|als ik)\b/.test(s)) return null;
  const parts = s.split(/\b(?:instead of|rather than|in plaats van)\b/), x = kindIn(parts[0].replace(/\b(?:turn|beurt)\s*\d+/g, "")); if (!x) return null;
  const y = parts[1] ? kindIn(parts[1].replace(/\b(?:turn|beurt)\s*\d+/g, "")) : null;
  return { turn: +tm[1], x, y };
}
export const aiKindOf = (label) => { const l = String(label || ""); return /^city/i.test(l) ? "city" : /^settlement/i.test(l) ? "settlement" : /^road/i.test(l) ? "road" : /^ship/i.test(l) ? "ship" : /^(?:end|pass)/i.test(l) ? "end" : /dev|^buy|card/i.test(l) ? "buy" : null; };
/** The args of the simulate_moves call that tests an intent on the player's own decision of that turn whose played move is of kind y. */
export function aiIntentArgs(g, it) {
  const mine = aiDecList(g).filter((e) => e.seat === g._rvPid && e.turn === it.turn); if (!mine.length) return null;
  const e = (it.y && mine.find((q) => aiKindOf(q.x.label) === it.y)) || (it.y ? null : [...mine].sort((a, b) => b.gap - a.gap)[0]); if (!e) return null;
  const mv = it.x === "end" || it.x === "buy" ? { kind: it.x } : { kind: "build", type: it.x };
  return { player: "You", turn: it.turn, n: e.n, moves: [mv] };
}
const WHAT = { en: { city: "a city", settlement: "a settlement", road: "a road", ship: "a ship", buy: "a development card", end: "ending the turn" }, nl: { city: "een stad", settlement: "een dorp", road: "een weg", ship: "een schip", buy: "een ontwikkelingskaart", end: "de beurt beëindigen" } };
export const aiWhat = (k, lang = "en") => (WHAT[lang] || WHAT.en)[k] || k;
/** A plain sentence for a move the engine cannot test (never the tool's own wording). */
export function aiCantMsg(err, it, lang = "en") {
  const nl = lang === "nl", w = aiWhat(it.x, lang), T = it.turn, e = String(err || ""), short = (e.match(/needs ([^]*?) more than/) || [])[1], nm = (x) => x.replace(/\b(wood|brick|sheep|wheat|ore)\b/g, (r) => (nl ? { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" }[r] : r));
  const why = /not affordable/.test(e) ? (nl ? `je had de kaarten niet${short ? ` (tekort: ${nm(short)})` : ""}` : `you didn\u2019t have the cards${short ? ` (short: ${short})` : ""}`) : /no (?:city|settlement|road|ship) spot|spot was among/.test(e) ? (nl ? `er is geen plek of geen dorp om uit te breiden` : `there was no ${it.x} spot (a city needs one of your own settlements)`) : (nl ? "de engine kan die zet daar niet doorrekenen" : "the engine can\u2019t run that move there");
  return nl ? `De engine kan ${w} in beurt ${T} niet testen: ${why}.` : `The engine can\u2019t test ${w} on turn ${T}: ${why}.`;
}
/** The record of a get_decision result a card keeps (small): the one source its numbers come from. */
export const aiSlimDecision = (r) => (r && !r.error ? { player: r.player, turn: r.turn, n: r.n, kind: r.kind, played: r.played, playedWinPct: r.playedWinPct, better: r.better, costPct: r.costPct, rating: r.rating, evaluated: (r.evaluated || []).slice(0, 4) } : null);
