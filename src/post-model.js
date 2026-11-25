// v1.99 post-game UI: the numbers every screen reads (pure data code, no DOM). ONE model per review and player, computed once and cached on the
// review (key = what the review has checked so far), so the Overview, Moves, Strategy, Luck, the Numbers sheet and the end screen can never disagree.
// It reads the review's own results (src/review/score.js decide / totals), the luck run and the stats digest (game._st). When the analysis data
// layer (src/review/analysis-facts.js `analyseGame`, built on claude/wip-ana199) is present, its decision splits, start review and coach rules
// are used instead of the local fallbacks below (see `analysis()`).
import { summarize, decide, totals } from "./review/evaluate.js";
import { tileOf } from "./review/luck.js";
import { stdGeo, boardOf } from "./lessons-geo.js";
import { spotInfo, R5 } from "./lessons-view.js";
import { analyseGame, luckSplit, headline as headlineParts } from "./review/analysis-facts.js";
import { tr as atr } from "./review/analysis-text.js";
import { lang } from "./i18n.js";
import { inScope } from "./review/coach-rules.js";
import { buildFacts, headPlan, register, buildKindAt, swings } from "./post-facts.js";

export const ERR = ["mistake", "blunder", "missed"]; // a clear error (the review only gives these classes to clear gaps)
export const FAMILY = { best: "strong", great: "strong", good: "strong", close: "close", lean: "close", could: "costly", mistake: "costly", blunder: "costly", missed: "costly" };
export const FAMILIES = ["strong", "close", "costly"];
export const PHASES = ["opening", "mid", "end"];
const fin = (v) => (Number.isFinite(v) ? v : null);
const r0 = Math.round;

/** dynamic thirds of the game: [{ k, from, to }] in turns */
export function phaseLimits(T) {
  T = Math.max(3, T || 3);
  const a = Math.max(1, Math.round(T / 3)), b = Math.max(a + 1, Math.round((2 * T) / 3));
  return [{ k: "opening", from: 1, to: a }, { k: "mid", from: a + 1, to: b }, { k: "end", from: b + 1, to: Math.max(b + 1, T) }];
}
export const phaseOf = (t, T) => { const L = phaseLimits(T); return (L.find((p) => t <= p.to) || L[2]).k; };

/** integers that add up to `total` exactly (largest remainder), keeping signs */
export function fitInts(vals, total) {
  const base = vals.map((v) => Math.trunc(v)), rem = vals.map((v, i) => [Math.abs(v - base[i]), i]).sort((a, b) => b[0] - a[0]);
  let left = total - base.reduce((a, b) => a + b, 0);
  const step = left >= 0 ? 1 : -1;
  for (let k = 0; left !== 0 && k < 40; k += 1) { const i = rem[k % rem.length][1]; base[i] += step; left -= step; }
  return base;
}

const sumGp = (l) => l.reduce((a, d) => a + d.gp, 0);
export const isErr = (d) => d.k !== "setup" && ERR.includes(d.cls);

/** the points a player had in view at a step (stats digest; hidden point cards are not known before the end) */
export function ptsAtStep(st, pid, s) { const row = st?.vp?.[Math.max(0, Math.min(s, st.N))]; return row ? fin(row[pid]) : null; }
export function ptsAtTurn(st, pid, t) { if (!st) return null; let s = 0; for (let i = 1; i <= st.N; i += 1) { if (st.turnOf[i] <= t) s = i; else break; } return ptsAtStep(st, pid, s); }

/** the 19-hex island of a saved game, or null (Seafarers, 5-6 players: no board snippets) */
export function boardFor(g) {
  try { const hx = g._rv?.base?.hexes; if (!Array.isArray(hx) || hx.length !== 19 || g.sea) return null; return boardOf({ hexes: hx, sea: !!g.sea }); } catch (_) { return null; }
}
const specOf = (f) => (f?.node != null ? ["n", f.node] : f?.edge != null ? ["e", f.edge] : f?.hex != null ? ["h", f.hex] : null);
export const kindOf = (l) => { l = String(l || ""); return /^city/i.test(l) ? "city" : /^settlement/i.test(l) ? "settlement" : /^road/i.test(l) ? "road" : /^bank/i.test(l) ? "bank" : /^end/i.test(l) ? "end" : /^play|^buy|^dev/i.test(l) ? "card" : /^robber/i.test(l) ? "robber" : "other"; };
/** "Trade X, then City on ..." -> the kind after the last "then" */
export const bestKindOf = (l) => { l = String(l || ""); const m = l.split(/, then /); return kindOf(m[m.length - 1]); };

// ── the table (everyone), cheap enough to rebuild when the review moves ──
export function soloPid(g) { try { return g._rvSoloPid?.() ?? g._rvPid ?? g.players.find((p) => p.isHuman)?.id ?? 0; } catch (_) { return 0; } }
export function rankOf(g) {
  const w = g.winner, ranked = w ? [w, ...g.players.filter((p) => p !== w).sort((a, b) => b.victoryPoints - a.victoryPoints)] : [...g.players];
  return ranked.map((p) => p.id);
}
const lsplit = (g, q) => { try { return luckSplit(g._rv?.luck, g.stats, q, g.players.length); } catch (_) { return null; } };
export function tableOf(g) {
  const R = g._rv, n = g.players.length, st = g._st, LK = (() => { try { return g._lkState(); } catch (_) { return { na: "x" }; } })();
  const order = rankOf(g), me = soloPid(g);
  const lkOk = !LK.na && LK.done && LK.cover >= 0.9;
  let L = null; try { L = g._rvLuck(me); } catch (_) { L = null; }
  const seats = g.players.map((p) => {
    const s = (() => { try { return g._rvSeat(p.id); } catch (_) { return { st: "none" }; } })();
    const rv = R?.revs?.[p.id];
    let moves = null, cls = null;
    if (s.sum && rv?.results?.length) { try { moves = totals(decide(rv.results.filter((x) => !x.skip || x.skip === "trivial"), n, p.id)).moves; } catch (_) { moves = null; } cls = s.sum.cls || null; }
    const d = L && !L.na ? L.all?.[p.id] : null, cards = d && Number.isFinite(d.luck) ? r0(d.luck) : null;
    return {
      id: p.id, p, name: p.name, you: p.id === me && !g.hotseat && p.isHuman, pts: p.victoryPoints, rank: order.indexOf(p.id) + 1, won: g.winner === p,
      src: st?.sources?.[p.id] || null, acc: s.sum?.acc ?? null, accDone: !!s.done, accSt: s.st, running: s.running || null,
      luck: lkOk ? (lsplit(g, p.id)?.total ?? null) : null, seatLuck: lkOk ? (lsplit(g, p.id)?.seat ?? 0) : 0, cards, tile: d ? (() => { try { return tileOf({ me: d }); } catch (_) { return null; } })() : null,
      moves, cls, todo: s.todo || 0, level: p.isHuman ? null : (() => { try { return g._rvLevel(p); } catch (_) { return null; } })(),
      bank: st?.bankTrades?.[p.id] ?? null, ptrades: st?.playerTrades?.[p.id] ?? null, devs: st?.devBought?.[p.id] ?? null, prod: st?.prodTot?.[p.id] ?? null,
      built: st?.built?.[p.id] || null,
    };
  });
  return { seats, order, me, LK, lkOk, n, T: st ? st.turnOf[st.N] || g.turn : g.turn };
}

/** every source of a seat's points as [[key, pts, label]] for the bar (settlements, cities, longest road, largest army, point cards) */
export const SRC_PARTS = [["settlements", "Settlements"], ["cities", "Cities"], ["road", "Longest road"], ["army", "Largest army"], ["cards", "Point cards"], ["islands", "Islands"]];

// ── one player's model ──
function ledgerParts(W, total) {
  if (!W) return null;
  const s = r0(W.start * 100), l = r0(W.luck * 100), m = total != null ? total : W.moves != null ? r0(W.moves * 100) : null;
  const all = r0((W.end - W.even) * 100);
  if (m == null) return { setup: s, luck: l, moves: null, rest: all - s - l, end: r0(W.end * 100), even: r0(W.even * 100) };
  return { setup: s, luck: l, moves: m, rest: all - s - l - m, end: r0(W.end * 100), even: r0(W.even * 100) };
}

/** "the others fell away (+111%) and luck helped (+51%), despite 68% lost to your moves" as structured parts the UI words */
export function headline(won, led) {
  if (!led || led.moves == null) return null;
  const items = [["rest", led.rest], ["luck", led.luck], ["setup", led.setup]];
  if (won) {
    const pos = items.filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return { won: true, pos, moves: led.moves, clean: led.moves > -10, none: !pos.length };
  }
  const neg = [...items, ["moves", led.moves]].filter(([, v]) => v <= -5).sort((a, b) => a[1] - b[1]).slice(0, 2);
  return { won: false, neg, moves: led.moves, none: !neg.length };
}

export function modelOf(g, pid) {
  const R = g._rv, st = g._st;
  if (!R?.revs || !st) return null;
  const rv = R.revs[pid];
  if (!rv?.results?.length) return null;
  const tab = tableOf(g);
  const key = [lang(), R.recs?.length, rv.results.length, rv.results.filter((x) => x.refined).length, tab.LK.j ?? "", tab.LK.done ? 1 : 0, pid, g._rvSeat(pid).done ? 1 : 0, g.winner?.id ?? "-"].join("|");
  const cache = (R.__pm ||= Object.create(null));
  if (cache[pid]?.key === key) return cache[pid].m;
  const m = build(g, pid, rv, tab);
  cache[pid] = { key, m };
  return m;
}
// the review object is serialised when saved: keep the cache out of it
export function hideCache(R) { if (R && !Object.getOwnPropertyDescriptor(R, "__pm")) Object.defineProperty(R, "__pm", { value: Object.create(null), enumerable: false, writable: true, configurable: true }); }

function build(g, pid, rv, tab) {
  const n = g.players.length, st = g._st, me = g.players[pid], T = tab.T || g.turn;
  const res = rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
  const ds = decide(res, n, pid), tot = totals(ds), sum = summarize(rv.results);
  const board = boardFor(g);
  const you = tab.seats[pid].you;
  const seat = tab.seats[pid];
  const todo = (() => { try { return g._rvTodo(pid).length; } catch (_) { return ds.length; } })();
  const scored = ds.filter((d) => d.cls !== "triv" && d.x.acc != null).length || sum.n || 0;
  const real = ds.filter((d) => d.k !== "setup" && d.cls !== "triv");
  const errs = ds.filter(isErr).sort((a, b) => b.gp - a.gp || a.i - b.i);
  const setups = ds.filter((d) => d.k === "setup");
  const other = ds.filter((d) => d.k !== "setup" && !isErr(d));
  // pillars: exclusive, add up to the total moves cost (capped like the totals)
  const raw = [sumGp(errs), sumGp(setups), sumGp(other)], rawSum = raw[0] + raw[1] + raw[2], capped = rawSum > Math.abs(tot.moves);
  const scale = rawSum ? Math.abs(tot.moves) / rawSum : 0;
  const pv = fitInts(raw.map((v) => -v * scale), tot.moves);
  const pillars = { errors: pv[0], start: pv[1], other: pv[2], total: tot.moves, capped, cap: tot.cap };
  let W = null; try { W = g._rvWhyBars(pid); } catch (_) { W = null; }
  const led = ledgerParts(W, tot.moves);
  const won = g.winner === me;
  // lesson 1: real errors; "not errors" = close calls and slight differences that stay out of the list
  const notErr = ds.filter((d) => d.k !== "setup" && (d.cls === "lean" || d.cls === "close")).length;
  const lesson1 = errs.slice(0, 4).map((d) => errCard(g, d, board, T, st, pid));
  // moves tab
  const next = other.filter((d) => d.gp >= 1 || true).sort((a, b) => b.gp - a.gp || a.i - b.i);
  const missRows = [...errs.slice(0, 4), ...next.slice(0, 3)];
  const shown = new Set(missRows.map((d) => d.i));
  const restRows = ds.filter((d) => !shown.has(d.i) && d.cls !== "triv").sort((a, b) => b.gp - a.gp || a.i - b.i);
  const bestRows = ds.filter((d) => inScope(d) && (d.cls === "best" || d.cls === "great") && d.k !== "setup" && fin(d.x.lead ?? d.x.spread) != null && (d.x.lead ?? d.x.spread) > 0.005)
    .map((d) => ({ d, gain: r0((d.x.lead ?? d.x.spread) * 100) })).sort((a, b) => b.gain - a.gain).slice(0, 5);
  const counts = { total: todo, scored, forced: Math.max(0, todo - ds.length), triv: ds.filter((d) => d.cls === "triv").length, errors: errs.length, shownErrors: lesson1.length, notErrors: notErr };
  const fam = { strong: 0, close: 0, costly: 0 }; ds.forEach((d) => { if (FAMILY[d.cls]) fam[FAMILY[d.cls]] += 1; });
  const cls = {}; ds.forEach((d) => { if (d.cls !== "triv") cls[d.cls] = (cls[d.cls] || 0) + 1; });
  // strategy
  const phases = phaseLimits(T);
  const phaseCost = phases.map((p) => { const l = errs.filter((d) => d.t >= p.from && d.t <= p.to); return { ...p, cost: -sumGp(l) * scale, errs: l }; });
  const phaseInt = fitInts(phaseCost.map((p) => p.cost), r0(phaseCost.reduce((a, p) => a + p.cost, 0)));
  phaseCost.forEach((p, i) => { p.cost = phaseInt[i]; });
  const small = pillars.total - phaseCost.reduce((a, p) => a + p.cost, 0);
  const start = startReview(g, setups, board, pid, st);
  const m = { pid, n, T, you, me, seat, won, ds, tot, sum, board, todo, errs, other, setups, pillars, led, W, counts, fam, cls, lesson1, missRows, restRows, bestRows, phases, phaseCost, small,
    start, lesson3: coachRules(g, phaseCost, T, st, pid, n), headline: headline(won, led) };
  m.A = analysis(g, pid);
  m.tempo = tempoOf(g, st, tab, T);
  m.timeline = timelineOf(g, pid, T, won, m.A);
  m.measures = measuresOf(tab, pid);
  m.income = incomeOf(g, st, tab);
  m.builds = buildsOf(g, st, T);
  m.rival = rivalOf(m, tab, pid);
  m.takeaway = takeaway(m);
  m.seats = tab.seats; m.tab = tab;
  overlay(g, m, board, st, T);
  m.F = buildFacts(g, m, tab); register(g._rv, pid, m.F);
  return m;
}

/** one real-error card */
function errCard(g, d, board, T, st, pid, chip = null) {
  const x = d.x, pk = kindOf(x.label), bk = bestKindOf(x.best?.label);
  const pts = ptsAtStep(st, pid, Math.max(0, (x.s ?? 1) - 1)), win = g.winPoints || 10;
  let why = null; try { why = d.why?.line || x.why?.head || null; } catch (_) { why = null; }
  const chips = Array.isArray(d.why?.chips) ? d.why.chips.slice(0, 3) : Array.isArray(x.why?.chips) ? x.why.chips.slice(0, 3) : [];
  return { d, se: d.se ?? null, i: d.i, t: d.t, cls: d.cls, gp: d.gp, B: d.B, A: d.A, played: x.label, better: x.best?.label, pk, bk, pts, win, why, chips, p: board ? specOf(x.focus) : null, q: board ? specOf(x.best?.focus) : null, phase: phaseOf(d.t, T), vis: chip?.pts ?? pts, target: chip?.target ?? win };
}

// ── Lesson 2: this board, including the start ──
const RES_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
export const resLabel = (r) => RES_LABEL[r] || r;
function mixOf(board, node, other = null) { try { const si = spotInfo(board, ["n", node], other); return { dots: si.dots, res: Object.keys(si.ownCnt), cnt: si.ownCnt, missing: si.missing, all: si.cnt }; } catch (_) { return null; } }
export function planFromMixes(a, b) {
  const sum = (r) => (a?.cnt?.[r] || 0) + (b?.cnt?.[r] || 0);
  const c = sum("ore") + sum("wheat"), e = sum("wood") + sum("brick");
  if (!a && !b) return null;
  return c >= e + 2 ? "city" : e >= c + 2 ? "expand" : "mixed";
}
function startReview(g, setups, board, pid, st) {
  if (!setups.length) return null;
  const picks = setups.slice(0, 2).map((d, k) => {
    const x = d.x, node = x.focus?.node, bnode = x.best?.focus?.node;
    const cands = (x.cands || []).filter((c) => c.win != null).slice(0, 6).map((c) => ({ label: c.label, win: r0(c.win * 100), node: c.focus?.node ?? null, n: c.n }));
    const mix = board && node != null ? mixOf(board, node) : null, bmix = board && bnode != null ? mixOf(board, bnode) : null;
    const add = mix && bmix ? Object.keys(bmix.cnt).filter((r) => !mix.cnt[r]) : [];
    return { k: k + 1, i: d.i, t: d.t, label: x.label, B: d.B, A: d.A, gp: d.gp, cls: d.cls, node: node ?? null, bnode: bnode ?? null, mix, bmix, cands, followed: d.gp <= 2, add, bestLabel: x.best?.label || null, advice: d.gp >= 5 && add.length ? { res: add[0], gp: d.gp } : null };
  });
  const plan = board ? planFromMixes(picks[0]?.mix, picks[1]?.mix) : null;
  return { picks, plan, board: !!board, top: picks[0]?.cands || [] };
}

// ── Lesson 3: phase rules, only when a clear error in that phase broke them ──
// (until claude/wip-ana199's coach rules are merged: a small local table, one rule per phase and error kind)
export const RULES = {
  open: { build: ["road-first", "Build settlements before roads, and roads only toward a good spot."], end: ["spend-early", "Spend your cards before you end an early turn."], bank: ["trade-to-build", "Trade early only to finish a build you can make this turn."], buy: ["cards-late", "Early on, build before you buy development cards."] },
  mid: { build: ["city-at-half", "Upgrade to a city when you have the ore and grain: cities pay double."], end: ["spend-mid", "Do not end the turn with a build in hand."], bank: ["trade-to-build", "Trade only to finish a build you can make this turn."], buy: ["cards-spare", "Buy cards with spare ore, grain and wool, not instead of a build."] },
  end: { build: ["last-point", "Late in the game, take the points you can reach now."], end: ["spend-late", "In the last third, never end a turn with points in reach."], bank: ["trade-to-points", "Late trades must end in points, not in a better hand."], buy: ["cards-points", "A card is worth it late only if it can win; otherwise build."] },
};
function coachRules(g, phaseCost, T, st, pid, n) {
  const out = [];
  phaseCost.forEach((p) => {
    if (!p.errs.length) return;
    const top = p.errs[0], kind = top.k === "setup" ? "build" : ["build", "end", "bank", "buy"].includes(top.k) ? top.k : top.cls === "missed" ? "end" : null;
    const r = kind && RULES[p.k]?.[kind]; if (!r) return;
    const chips = p.errs.slice(0, 3).map((d) => ({ t: d.t, i: d.i, vis: ptsAtStep(st, pid, Math.max(0, (d.x.s ?? 1) - 1)), win: g.winPoints || 10, gp: d.gp }));
    out.push({ phase: p.k, id: r[0], text: r[1], cost: p.cost, from: p.from, to: p.to, chips });
  });
  return out;
}

// ── tempo: points per phase, from the stats digest ──
function tempoOf(g, st, tab, T) {
  if (!st?.vp?.length) return null;
  const phases = phaseLimits(T);
  const rows = tab.seats.map((s) => {
    const at = (t) => ptsAtTurn(st, s.id, t) ?? 0;
    const start = ptsAtStep(st, s.id, 0) ?? 0, ends = phases.map((p) => (p.k === "end" ? s.pts : at(p.to)));
    const gains = ends.map((e, i) => Math.max(0, e - (i ? ends[i - 1] : start)));
    return { id: s.id, start, gains };
  });
  return { phases, rows, max: Math.max(1, ...rows.flatMap((r) => r.gains)) };
}
// ── the win chance of every player through the game (one line each), the numbered key moments, the phase bands ──
function timelineOf(g, pid, T, won, A) {
  let look = null; try { look = g._rvLook(); } catch (_) { look = null; }
  const st = g._st; if (!look || !st) return null;
  const lines = g.players.map(() => []);
  look.steps.forEach((x, k) => { if (k === 0) g.players.forEach((p) => lines[p.id].push([0, x.b[p.id]])); const t = st.turnOf[x.S]; g.players.forEach((p) => lines[p.id].push([t, x.e[p.id]])); });
  // the swings of THIS player (see swingsFor), biggest first
  const sw = swingsFor(g, pid).filter((x) => Math.abs(x.d) >= 1 && !x.seven).sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
  // every step named in the headline is a pin (and so a stop on Bekijk bord); the rest is filled with the biggest swings, 3 pins in all
  const plan = headPlan(g, pid, won, A), sw0 = swingsFor(g, pid), forced = plan ? sw0.filter((x) => (plan.own?.k === "best" && plan.own.S === x.S) || (plan.luck?.k === "roller" && plan.luck.steps.includes(x.S))) : [];
  const pins = forced.filter((x, i, a) => a.findIndex((q) => q.S === x.S) === i);
  sw.forEach((x) => { if (pins.length >= 3 || pins.some((q) => Math.abs(q.T - x.T) < 2)) return; pins.push(x); });
  pins.sort((a, b) => a.T - b.T);
  const lastT = Math.max(T, ...lines[pid].map((q) => q[0])), mk = (x) => ({ T: x.T, S: x.S, d: x.d, actor: x.actor, move: x.actor === pid, b: x.b, a: x.a, e: x.e, dice: x.dice });
  return { lines, pins: pins.map((x, k) => ({ n: k + 1, ...mk(x) })), all: sw.slice(0, 15).sort((a, b) => a.T - b.T).map(mk), T: lastT, phases: phaseLimits(lastT) };
}
// ── measures: the player against the table ──
function measuresOf(tab, pid) {
  const S = tab.seats, rows = [
    ["prod", "Cards collected", (s) => s.prod],
    ["cities", "Cities", (s) => s.built?.city ?? null],
    ["settlements", "Settlements (incl. start)", (s) => s.built?.settlement ?? null],
    ["roads", "Roads (incl. start)", (s) => s.built?.road ?? null],
    ["devs", "Development cards", (s) => s.devs],
    ["bank", "Bank trades", (s) => s.bank],
    ["ptr", "Player trades", (s) => s.ptrades],
  ].map(([k, label, f]) => {
    const vals = S.map((s) => fin(f(s))); if (vals.some((v) => v == null)) return null;
    // compared with the BEST other player (never the average: a lead is only claimed when nobody else had more)
    const mine = vals[pid], oth = vals.filter((_, i) => i !== pid), bo = oth.length ? Math.max(...oth) : 0;
    return { k, label, vals, mine, bestOther: bo, best: Math.max(...vals), low: Math.min(...vals), diff: Math.round((mine - bo) * 10) / 10, mark: oth.length && mine > bo ? "up" : oth.length && mine < Math.min(...oth) ? "dn" : "" };
  }).filter(Boolean);
  return rows;
}
// ── income per resource (cards the board paid) ──
function incomeOf(g, st, tab) {
  if (!st?.prod) return null;
  return tab.seats.map((s) => ({ id: s.id, res: st.prod[s.id].slice(0, 5), tot: st.prod[s.id].slice(0, 5).reduce((a, b) => a + b, 0) }));
}
// ── build timeline: [turn, kind] per player ──
function buildsOf(g, st, T) {
  if (!st?.steps) return null;
  const rows = g.players.map(() => []);
  (g._st.stepEvents || []).forEach((evs, s) => (evs || []).forEach((e) => {
    const t = s === 0 ? 0 : st.turnOf[s];
    if (e[1] === "b" && rows[e[2]] && ["s", "c", "r"].includes(e[3])) rows[e[2]].push([t, e[3]]);
    else if (e[1] === "v" && rows[e[2]]) rows[e[2]].push([t, "d"]);
  }));
  return { rows, T };
}
// ── rival: the opponent who out-scored the player in the player's weakest phase ──
function rivalOf(m, tab, pid) {
  const tp = m.tempo; if (!tp) return null;
  let worst = null;
  tp.phases.forEach((p, i) => {
    const mine = tp.rows[pid].gains[i], others = tp.rows.filter((r) => r.id !== pid).map((r) => ({ id: r.id, g: r.gains[i] })).sort((a, b) => b.g - a.g);
    const diff = mine - (others[0]?.g ?? 0);
    if (!worst || diff < worst.diff) worst = { k: p.k, i, diff, mine, rival: others[0], from: p.from, to: p.to };
  });
  if (!worst || worst.diff >= 0 || !worst.rival) return null;
  const rv = tab.seats[worst.rival.id];
  const builds = (id) => (m.builds?.rows?.[id] || []).filter(([t]) => t >= worst.from && t <= worst.to);
  return { ...worst, rid: worst.rival.id, rname: rv.name, theirs: worst.rival.g, mine: worst.mine, myBuilds: builds(pid).length, theirBuilds: builds(worst.rival.id).length };
}
// ── take with you: up to three rules for the next game, one from each lesson ──
function takeaway(m) {
  const out = [];
  const e = m.errs[0];
  if (e) out.push({ lesson: 1, key: e.k === "end" || e.cls === "missed" ? "spend" : e.k === "bank" ? "trade" : "build", i: e.i, t: e.t });
  const s = m.start?.picks?.find((p) => p.advice) || null;
  if (s) out.push({ lesson: 2, key: "start", res: s.advice.res, k: s.k });
  else if (m.start?.picks?.some((p) => p.gp >= 5)) out.push({ lesson: 2, key: "start-any" });
  const r = m.lesson3?.[0];
  if (r) out.push({ lesson: 3, key: r.id, text: r.text, phase: r.phase, cost: -r.cost });
  return out.slice(0, 3);
}

// ── the analysis data layer (src/review/analysis-facts.js analyseGame) ──
export function analysis(g, pid) {
  const R = g._rv; if (!R) return null;
  try {
    const st = g.stats, state = { stats: st, players: g.players.map((p) => ({ name: p.name, victoryPoints: p.victoryPoints })), hexes: R.base?.hexes, sea: !!g.sea, settings: { winPoints: g.winPoints || 10, mode: g.isRush?.() ? "rush" : "classic" }, winnerId: g.winner?.id ?? null };
    return analyseGame({ state, rv: { reviews: R.revs, luck: R.luck, rk: R.engId }, me: pid, names: g.players.map((p) => p.name), winner: g.winner?.id ?? null, finalPts: g.players.map((p) => p.victoryPoints), lang: lang() });
  } catch (e) { console.warn("analyseGame", e); return null; }
}
const PH_ID = { opening: "opening", mid: "mid", end: "end" };
/** replace the local fallbacks by the data layer's numbers wherever it has them (one source for every screen) */
function overlay(g, m, board, st, T) {
  const A = m.A, Y = A?.you; if (!Y) return;
  const sp = Y.split, nega = (v) => -v;
  m.ds = Y.ds; m.errs = Y.errors; m.other = Y.ds.filter((d) => d.k !== "setup" && !Y.errors.includes(d)); m.setups = Y.ds.filter((d) => d.k === "setup");
  m.pillars = { errors: nega(sp.errors), start: nega(sp.start), other: nega(sp.other), total: sp.headline, capped: sp.capped, cap: sp.cap, startRaw: -Y.ds.filter((d) => d.k === "setup").reduce((a, d) => a + d.gp, 0) };
  const c = Y.counts; const startN = Y.ds.filter((d) => d.k === "setup" && d.cls !== "triv").length; m.counts = { startN, otherN: Math.max(0, c.scored - c.errors - startN), total: c.all, scored: c.scored, forced: c.oneOption ?? Math.max(0, c.all - Y.ds.length), triv: c.trivial, small: c.small, errors: c.errors, shownErrors: Math.min(4, c.errors), notErrors: c.notErrors, setupErrors: c.setupErrors };
  m.lesson1 = Y.errors.slice(0, 4).map((d) => errCard(g, d, board, T, st, m.pid, Y.chips?.[d.i]));
  const ph = Y.phase; m.phaseCost = ["opening", "mid", "end"].map((k) => ({ k, from: A.limits[k][0], to: A.limits[k][1], cost: -ph[k], errs: Y.errors.filter((d) => d.t >= A.limits[k][0] && d.t <= A.limits[k][1]) }));
  m.small = -ph.small; m.startCost = -ph.start; m.phases = m.phaseCost.map((p) => ({ k: p.k, from: p.from, to: p.to }));
  m.start = Y.startReview ? { ...Y.startReview, board: !!board } : null;
  // {res} in a rule text / chip is a resource KEY (wood, brick, sheep, wheat, ore): the UI words it in the app language
  const rp = (q) => (q?.res ? { ...q, res: atr(lang(), `res.${q.res}`).toLowerCase() } : q || {});
  m.lesson3 = (Y.rules || []).map((r) => ({ id: r.id, phase: r.phase, cost: -r.cost, n: r.n, from: A.limits[r.phase][0], to: A.limits[r.phase][1],
    text: atr(lang(), r.moments[0].text, rp(r.moments[0].params)), chips: r.moments.slice(0, 3).map((q) => ({ turn: q.turn, i: q.i, gp: q.gp, chip: atr(lang(), q.chip, rp(q.params)), ck: q.chip, cp: rp(q.params), pts: q.pts, target: q.target })) }));
  if (Y.ledger) {
    const L = Y.ledger, seat = A.luck?.[m.pid]?.seat ?? 0, lt = A.luck?.[m.pid]?.total, hasLuck = !!A.luck?.[m.pid];
    // ONE luck number everywhere: rolls, steals, draws AND seat order. Set-up is then only the start picks (what they cost against the best spots).
    const parts = { setup: hasLuck ? L.setup - seat : L.setup, luck: hasLuck ? lt : L.luck, moves: L.moves, total: L.total, from: L.from, to: L.to, hasLuck, perMove: L.perMove };
    parts.rest = parts.total - parts.setup - parts.luck - parts.moves;
    m.led = { ...parts, end: L.to, even: L.from };
    m.headline = headlineParts(parts, { won: m.won });
  }
  m.notErrs = Y.notErrors || [];
  m.why = whyOf(m, A, g);
  m.verdict = Y.verdict;
  m.bestRows = (Y.best || []).filter((o) => inScope(o.d)).map((o) => ({ d: o.d, gain: o.gain }));
  m.numbers = A.numbers; m.infoRows = A.info;
  if (A.tempo?.phases) { const tp = A.tempo; m.tempo = { phases: tp.phases.map((q) => ({ k: q.id, from: q.from, to: q.to, empty: q.empty })), rows: g.players.map((p) => ({ id: p.id, start: tp.setup[p.id], gains: tp.phases.map((q) => Math.max(0, q.gain[p.id])) })), max: Math.max(1, ...tp.phases.flatMap((q) => q.gain.map((v) => Math.max(0, v)))) }; }
  if (A.rival) { const r = A.rival, rv = m.tab.seats[r.rival], ph = tpPh(m, r.phase); m.rival = { k: r.phase, rid: r.rival, rname: rv.name, mine: r.myGain, theirs: r.rivalGain, from: ph?.from, to: ph?.to, myBuilds: (m.builds?.rows?.[m.pid] || []).filter(([t]) => t >= ph?.from && t <= ph?.to).length, theirBuilds: (m.builds?.rows?.[r.rival] || []).filter(([t]) => t >= ph?.from && t <= ph?.to).length }; } else if (A.tempo) m.rival = null;
  m.takeaway = takeaway2(m);
}
const tpPh = (m, k) => (m.phases || []).find((q) => q.k === k);
function takeaway2(m) {
  const out = [], e = m.errs[0];
  if (e) out.push({ lesson: 1, key: e.kind === "end" || e.cls === "missed" ? "spend" : e.kind === "bank" ? "trade" : "build", i: e.i, t: e.t, cost: e.gp });
  const p = m.start?.picks?.find((q) => q.advice);
  if (p) out.push({ lesson: 2, key: "start", res: p.advice.adds[0], k: p.n, cost: p.gp, a: p.win, b: p.shortlist?.[0]?.win ?? p.best });
  else if (m.start?.picks?.some((q) => q.gp >= 5)) out.push({ lesson: 2, key: "start-any" });
  const r = m.lesson3?.[0]; if (r) out.push({ lesson: 3, key: r.id, text: r.text, phase: r.phase, cost: -r.cost });
  return out.slice(0, 3);
}

/** Why the game was won or lost: the one or two biggest swings of this player's win chance on their own side of the result, read off the win-chance
 *  timeline (the same swings as the pins under the chart; each is split into dice / the actor's move / the rest). Each moment is named by what caused it:
 *  the player's own move (a build, or the clear error / weaker choice of that turn), a roll, or what another player did. No heuristic income or tempo
 *  claims here: those stay in Strategy, compared with the best other player. */
/** every step of the game as this PLAYER's win-chance swing: { S, T, actor, roll, seven, b, a, e, d, dice, move } in whole percent. dice = what the roll did (a - b), move = what the actor's own
 *  play after it did (e - a, only when this player is the actor). Award steps are left out (v1.99 scope: no longest road / largest army); a 7 is kept but flagged (never named as luck). */
const swingsFor = swings; // ONE copy (src/post-facts.js): the roll's number is the luck run's
/** The headline parts: the player's biggest OWN move swing (best move in a win; the worst real error, else the costliest move, in a loss), the biggest LUCK swings (the dice part only, on the side of the result)
 *  and the start cost when it is the main own lesson. Component values, never a whole swing named as a roll. Income / cities / tempo stay in Strategy. */
/** The steps the headline names, as win-chance COMPONENTS of that step's swing (the same numbers as the key-moment rows): own = the biggest "move" part on the side of the result (>= 3),
 *  luck = up to two biggest "dice" parts on that side, in different turns. */
function headSteps(g, pid, won) {
  const all = swingsFor(g, pid), side = (v) => (won ? v : -v);
  const own = all.filter((x) => side(x.move) >= 3).sort((p, q) => side(q.move) - side(p.move))[0] || null;
  const lk = all.filter((x) => !x.seven && side(x.dice) >= 3).sort((p, q) => side(q.dice) - side(p.dice)), luck = [];
  lk.forEach((x) => { if (luck.length < 2 && !luck.some((q) => q.T === x.T)) luck.push(x); });
  luck.sort((p, q) => p.T - q.T);
  return { own, luck };
}
function whyOf(m, A, g) {
  const st = g?._st, pid = m.pid, won = m.won, H = headSteps(g, pid, won);
  // the own part: that step's "move" component, named with the real move (the build of that step, else the decision of that turn)
  let own = null;
  if (H.own) { const x = H.own, dec = m.ds.filter((d) => d.t === x.T && d.k !== "setup" && d.cls !== "triv").sort((a, b) => b.gp - a.gp || a.i - b.i)[0] || null;
    const bk = buildKindAt(st, x.S, pid), dk = dec ? (won ? dec.bestKind || dec.kind : dec.kind) : null;
    own = { dec, T: x.T, S: x.S, d: x.move, what: ["city", "settlement", "road", "card"].find((k) => k === bk || k === dk) || "move" }; }
  const luck = H.luck.map((x) => ({ T: x.T, S: x.S, d: x.dice, actor: x.actor }));
  const P = m.pillars || {}, startN = Math.abs(Math.round(P.start || 0)), errN = Math.abs(Math.round(P.errors || 0)), start = startN >= 5 && startN >= errN ? startN : null;
  const movesN = Math.abs(Math.round(P.total || 0)), bestRoll = luck[0] ? { T: luck[0].T, d: luck[0].d } : null;
  return { won, own, luck, luckSum: luck.reduce((a, x) => a + x.d, 0), start, movesN, bestRoll, moments: own || luck.length ? [own, ...luck].filter(Boolean) : [] };
}
/** the cause of one swing of this player's win chance (see whyOf); x = { S, T, actor, a, b, e, d } */
export { buildKindAt };
export const momentFor = (g, m, x) => momentOf(m, g._st, x, m.won);
function momentOf(m, st, x, won) {
  const pid = m.pid, dice = x.dice ?? x.a - x.b, after = x.e - x.a, mine = x.actor === pid, step = st?.steps?.[x.S - 1], roll = step ? step[2] + step[3] : null;
  const base = { T: x.T, S: x.S, d: x.d, actor: x.actor };
  if (Math.abs(dice) >= Math.abs(after) && roll) return { ...base, k: "roll", own: mine, roll, good: dice > 0 };
  const bk = buildKindAt(st, x.S, x.actor);
  if (!mine) return { ...base, k: "by", what: bk || "turn" };
  if (won) return { ...base, k: "build", what: bk || "good" };
  // a loss caused by the player's own move: the clear error of that turn, else the biggest weaker choice of that turn, else the build
  const inT = m.ds.filter((d) => d.t === x.T && d.k !== "setup" && d.cls !== "triv").sort((a, b) => b.gp - a.gp);
  const d = m.errs.find((e) => e.t === x.T) || inT.find((e) => e.gp >= 2) || null;
  if (d) {
    const pk = d.kind || kindOf(d.x?.label), bkd = d.bestKind || bestKindOf(d.x?.best?.label);
    if (pk === "end") return { ...base, k: "error", what: "end" };
    if (pk === bkd && ["settlement", "city", "road", "bank", "card"].includes(pk)) return { ...base, k: "error", what: `weak.${pk}` };
    if (["settlement", "city", "road", "bank", "card"].includes(pk) && ["settlement", "city", "road", "bank", "card"].includes(bkd)) return { ...base, k: "error", what: "instead", a: pk, b: bkd };
    return { ...base, k: "error", what: "weak" };
  }
  return { ...base, k: "build", what: bk || "move" };
}
