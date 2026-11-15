// v1.79 VISUAL BLOCKS. The model composes an answer from a small toolkit (board, compare, line, bars, route, timeline, text); it names only
// WHAT to show (turn / player / move ids). Every number, position and label is fetched here from the stored review or the tool results.
// A block with an unresolvable ref is dropped; at most 3 visual blocks per card; text blocks are 1-2 short sentences.
export const BLOCK_TYPES = ["board", "compare", "line", "bars", "route", "timeline", "text"];
export const MAX_VISUAL = 3, MARK_KINDS = ["played", "better", "alt", "robber", "focus"], METRICS = ["luck", "points", "income"];
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const pc = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100));
const clean = (s, n) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const int = (v) => (v != null && v !== "" && Number.isInteger(+v) ? +v : null);

/** A spot id of the model ("n12" node, "e5" edge, "h7" hex) to a focus the board renderer knows, or null. */
export function spotFocus(g, at) {
  const m = /^([neh])\s*(\d{1,3})$/i.exec(String(at ?? "").trim()); if (!m || !g) return null;
  const k = m[1].toLowerCase(), i = +m[2];
  if (k === "n") return g.nodes?.[i] ? { node: i } : null;
  if (k === "e") return g.edges?.[i] ? { edge: i } : null;
  return g.hexes?.[i] ? { hex: i } : null;
}
const sameF = (a, b) => !!a && !!b && (a.node ?? a.city ?? null) === (b.node ?? b.city ?? null) && (a.edge ?? null) === (b.edge ?? null) && (a.hex ?? null) === (b.hex ?? null);

/** The moves of one decision by ref: played, best, alt1..3 (the other evaluated moves by win chance). { label, focus, win (%), kind } or null. */
export function decMoves(dm) {
  const x = dm?.d?.x || dm?.x; if (!x?.cands?.length) return null;
  const c0 = x.cands[0], base = x.win != null ? x.win : c0.win;
  const played = { label: clean(x.label || c0.label, 80), focus: x.focus || c0.focus || null, win: pc(c0.win ?? base), kind: "played" };
  const b = x.best, bc = b ? x.cands.find((c) => c !== c0 && c.label === b.label) || x.cands.find((c) => c !== c0 && sameF(c.focus, b.focus)) : null;
  const best = b ? { label: clean(b.label, 80), focus: b.focus || null, win: pc(bc?.win ?? (base != null && b.gain != null ? base + b.gain : null)), kind: "best" } : null;
  const alts = x.cands.slice(1).filter((c) => c.win != null && !(best && (c.label === best.label || sameF(c.focus, best.focus)))).sort((p, q) => q.win - p.win).slice(0, 3).map((c) => ({ label: clean(c.label, 80), focus: c.focus || null, win: pc(c.win), kind: "alt" }));
  const gap = Math.max(0, dm.gap ?? dm.d?.gap ?? 0);
  if (best && played.win != null && gap >= 0.005) best.win = played.win + Math.round(gap * 100); // the review's own cost: the bars and the chip agree (the two rounded win chances may differ by 1)
  return { played, best, alts, gap, x };
}
/** One move by ref ("played", "best", "alt2") of a decision. */
export function moveOf(mv, ref) {
  const r = String(ref ?? "").toLowerCase(); if (!mv) return null;
  if (r === "played") return mv.played;
  if (r === "best" || r === "better") return mv.best;
  const m = /^alt([1-3])$/.exec(r); return m ? mv.alts[+m[1] - 1] || null : null;
}
/** A tool-result ref "k3" / "k3:1" / "k3:played": a row of an engine run (simulate_moves) or of a decision lookup (get_decision), from the stored evidence. */
export function evRow(ev, ref) {
  const m = /^(k\d+|app\d+)(?::(played|\d))?$/i.exec(String(ref ?? "").trim()); if (!m || !Array.isArray(ev)) return null;
  const e = ev.find((x) => String(x.id).toLowerCase() === m[1].toLowerCase()); if (!e?.r) return null;
  const r = e.r;
  if (e.t === 2 && Array.isArray(r.results)) {
    if (m[2] === "played") return r.storedPlayedWinPct != null ? { label: clean(r.playedLabel || "", 80), win: Math.round(r.storedPlayedWinPct), kind: "played" } : null;
    const rows = r.results.filter((x) => x.winPct != null), row = rows[m[2] != null ? +m[2] : 0]; return row ? { label: clean(row.label, 80), win: Math.round(row.winPct), kind: "alt", pm: row.plusMinusPct || 0 } : null;
  }
  const evl = r.evaluated || [];
  if (m[2] === "played") return r.playedWinPct != null ? { label: clean(r.played, 80), win: Math.round(r.playedWinPct), kind: "played" } : null;
  const row = evl.filter((c) => !c.played && c.winPct != null)[m[2] != null ? +m[2] : 0]; return row ? { label: clean(row.label, 80), win: Math.round(row.winPct), kind: "alt" } : null;
}

/** raw.blocks -> validated blocks. env: { C (context), g (geometry), seats(names), decAt(turn, seats), ev, maxT }. Invalid ones are dropped. */
export function aiBlocks(rawBlocks, env) {
  const { C, g, ev } = env, out = []; let vis = 0, txt = 0;
  (Array.isArray(rawBlocks) ? rawBlocks : []).forEach((b) => {
    if (!b || typeof b !== "object" || !BLOCK_TYPES.includes(b.type)) return;
    if (b.type === "text") { const md = textOf(b.md); if (md && txt < 2) { out.push({ type: "text", md }); txt++; } return; }
    if (vis >= MAX_VISUAL) return;
    const r = tryv(() => ONE[b.type](b, env)); if (r) { out.push(r); vis++; }
  });
  return out;
}
/** At most 2 short sentences, no markup. */
export function textOf(md) {
  const t = clean(md, 400); if (!t) return "";
  const s = (t.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*(?:\s+|$)/g) || [t]).map((x) => x.trim()).filter(Boolean).slice(0, 2).join(" ");
  return s.length > 240 ? `${s.slice(0, 239).replace(/\s+\S*$/, "")}…` : s;
}
const turnOk = (t, env) => { const v = int(t); return v != null && v >= 0 && v <= env.maxT ? v : null; };
const ONE = {
  board(b, env) {
    const T = turnOk(b.turn, env); if (T == null || !env.C.st || !env.g) return null;
    const seats = env.seats(b.player == null ? [] : [b.player]), dm = env.decAt(T, seats.length ? seats : null), mv = dm ? decMoves(dm) : null;
    let alt = 0; const marks = [];
    (Array.isArray(b.marks) ? b.marks : []).slice(0, 8).forEach((m) => {
      const kind = MARK_KINDS.includes(m?.kind) ? m.kind : null; if (!kind) return;
      const at = String(m.at ?? "").trim().toLowerCase(); let focus = null, mvr = null;
      if (/^(played|best|better|alt[1-3])$/.test(at)) { mvr = moveOf(mv, at); focus = mvr?.focus || null; }
      else focus = spotFocus(env.g, at);
      if (!focus || !env.pos(focus)) return;
      if (marks.some((x) => sameF(x.focus, focus) && x.kind === kind)) return;
      if (kind === "alt") { if (alt >= 3) return; alt++; }
      marks.push({ kind, focus, n: kind === "alt" ? alt : null, win: mvr?.win ?? null, label: clean(mvr?.label || m.label, 40), id: at });
    });
    if (!marks.length) return null;
    const arrows = (Array.isArray(b.arrows) ? b.arrows : []).slice(0, 3).map((a) => {
      const f = (r) => { const q = String(r ?? "").trim().toLowerCase(); return /^(played|best|better|alt[1-3])$/.test(q) ? moveOf(mv, q)?.focus || null : spotFocus(env.g, q); };
      const from = f(a?.from), to = f(a?.to); return from && to && env.pos(from) && env.pos(to) && !sameF(from, to) ? { from, to, kind: a.kind === "alt" ? "alt" : "move" } : null;
    }).filter(Boolean);
    return { type: "board", turn: T, seat: dm?.seat ?? seats[0] ?? null, dec: dm ? { d: dm.d, turn: dm.turn, seat: dm.seat } : null, marks, arrows, zoom: b.zoom === "full" ? "full" : "auto" };
  },
  compare(b, env) {
    const T = turnOk(b.turn, env); if (T == null) return null;
    const ev = env.ev, seats = env.seats(b.player == null ? [] : [b.player]), dm = env.decAt(T, seats.length ? seats : null), mv = dm ? decMoves(dm) : null, opts = [];
    (Array.isArray(b.options) ? b.options : []).slice(0, 4).forEach((o) => {
      const ref = String(o?.ref ?? "").trim(), m = /^(played|best|better|alt[1-3])$/i.test(ref) ? moveOf(mv, ref) : evRow(ev, ref);
      if (!m || m.win == null) return;
      if (opts.some((x) => x.label === m.label && x.win === m.win && x.kind === m.kind)) return;
      opts.push({ label: m.label || clean(o.label, 60), v: m.win, kind: m.kind, pm: m.pm || 0, ref });
    });
    if (opts.length < 2) return null;
    const max = Math.max(...opts.map((o) => o.v)), bestIdx = opts.findIndex((o) => o.v === max), played = opts.find((o) => o.kind === "played");
    const cost = played && max - played.v >= 1 && opts[bestIdx] !== played ? max - played.v : 0;
    return { type: "compare", turn: T, seat: dm?.seat ?? seats[0] ?? env.C.me, options: opts, bestIdx, cost };
  },
  line(b, env) {
    const ser = env.C.ser; if (!ser || ser.by.size < 2) return null;
    const series = (Array.isArray(b.series) ? b.series : []).slice(0, 3).map((s) => {
      const seat = env.seats([s?.player])[0]; if (seat == null) return null;
      let from = int(s.from), to = int(s.to); if (from == null && to == null) { from = 0; to = env.maxT; } from = Math.max(0, from ?? 0); to = Math.min(env.maxT, to ?? env.maxT); if (from > to) [from, to] = [to, from];
      return { seat, from, to };
    }).filter((s, i, a) => s && a.findIndex((x) => x && x.seat === s.seat) === i);
    if (!series.length) return null;
    const t0 = Math.min(...series.map((s) => s.from)), t1 = Math.max(...series.map((s) => s.to));
    if ([...ser.by.keys()].filter((t) => t >= t0 && t <= t1).length < 2) return null;
    const marks = [...new Set([...(Array.isArray(b.turns) ? b.turns : []), ...(Array.isArray(b.marks) ? b.marks.filter((x) => typeof x === "number") : [])].map((t) => turnOk(t, env)).filter((t) => t != null && t >= t0 && t <= t1))].slice(0, 3);
    return { type: "line", series, t0, t1, marks };
  },
  bars(b, env) {
    const metric = METRICS.includes(b.metric) ? b.metric : null; if (!metric) return null;
    let seats = env.seats(b.players || []); if (!seats.length) seats = env.C.all || [];
    if (metric === "luck" && !env.C.luck) return null;
    if (metric === "points" && !env.C.st?.sources) return null;
    if (metric === "income") { seats = seats.filter((s) => tryv(() => env.C.route(s))?.income); if (!seats.length) return null; }
    return seats.length ? { type: "bars", metric, seats: seats.slice(0, 6) } : null;
  },
  route(b, env) {
    let seats = env.seats(b.players || []); if (!seats.length) seats = env.C.all || [];
    seats = seats.filter((s) => tryv(() => env.C.route(s))); return seats.length ? { type: "route", seats: seats.slice(0, 4) } : null;
  },
  timeline(b, env) {
    const seat = env.seats([b.player])[0] ?? null; if (seat == null) return null;
    let from = int(b.from) ?? 0, to = int(b.to) ?? env.maxT; from = Math.max(0, from); to = Math.min(env.maxT, to); if (from > to) [from, to] = [to, from];
    const items = (env.C.tl?.[seat] || []).filter(([t]) => t >= from && t <= to).slice(0, 24); return items.length ? { type: "timeline", seat, from, to, items } : null;
  },
};

/** The old `view` of a card as blocks (the same visual, one toolkit). */
export function legacyBlocks(card, env) {
  const seats = card.seats || [], T0 = card.focus ?? card.turns?.[0] ?? null, out = [];
  switch (card.view) {
    case "winchance": { const s = seats.length ? seats.slice(0, 3) : [env.C.me], t0 = card.turns?.length ? Math.max(0, Math.min(...card.turns) - 4) : 0, t1 = card.turns?.length ? Math.min(env.maxT, Math.max(...card.turns) + 4) : env.maxT; out.push({ type: "line", series: s.map((seat) => ({ seat, from: t0, to: t1 })), t0, t1, marks: (card.turns || []).slice(0, 3), legacy: true }); break; }
    case "luck": out.push({ type: "bars", metric: "luck", seats: seats.length ? seats : env.C.all || [], legacy: true }); break;
    case "points": out.push({ type: "bars", metric: "points", seats: seats.length ? seats : env.C.all || [], legacy: true }); break;
    case "plan": out.push({ type: "route", seats: seats.length ? seats : env.C.all || [], legacy: true }); break;
    case "board": if (T0 != null) out.push({ type: "board", turn: T0, marks: [], legacy: true }); break;
    case "moves": if (T0 != null) out.push({ type: "compare", turn: T0, options: [], legacy: true }); break;
    case "nearmiss": out.push({ type: "nearmiss", legacy: true }); break;
    default: break;
  }
  return out;
}
