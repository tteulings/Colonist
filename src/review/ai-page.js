// v1.83 The dynamic AI page: a COMPOSITION SPEC (page > widgets > blocks = primitives bound to facts), its VALIDATOR and the app-side RECIPES that
// write a spec from facts alone (no model call). Pure: no DOM, no game; every fact comes through `fx` (src/review/ai-index.js).
// Rules the validator enforces (tech.md section 4):
//  - numbers only through refs: free text has no digits and no causal word (because, caused, due to ...), titles stay short;
//  - every ref / player / turn / range resolves against the facts, otherwise the title falls back or the block is dropped;
//  - complexity caps (extra elements are dropped, not an error), closed vocabulary (level, roles, formats, metrics);
//  - per-primitive fallback: an invalid block is dropped, a widget with no valid block is dropped, no widget left -> recipes;
//  - DEDUPE: a primitive that shows the same fact binding as one already on the page is dropped (the same tile twice, the same bars twice).
export const LEVELS = ["Game", "Near miss", "Decision", "Strategy", "Luck"];
export const PRIMS = ["line", "bars", "strip", "stack", "tiles", "compare", "board", "badge", "table", "text"];
export const FMTS = ["player", "turn", "pct", "sgpct", "n", "x"];
export const CAPS = { widgets: 6, blocks: 4, expand: 3, notes: 3, boards: 1, lines: 2, rows: 5, tiles: 3, marks: 4, follow: 4, words: 26, label: 28 };
export const CAUSAL = /\b(because|caused?|causing|due to|thanks to|therefore|led to|leads to|lead to|since|as a result|resulted in|owing to|so that|hence|omdat|doordat|dankzij|daardoor|waardoor|vandaar)\b/i;
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const isInt = (v) => Number.isInteger(v);
const KIND_OK = { player: ["player"], turn: ["turn"], pct: ["pct", "n"], sgpct: ["pct", "n"], n: ["n", "pct"], x: ["x"] };

/** Free text: no digits, no causal word. */
export const textOk = (s, max = 160) => typeof s === "string" && s.length <= max && !/\d/.test(s) && !CAUSAL.test(s);

/** Validate Parts (an array of string | {ref, fmt} | {dir:[a,b], up, down, same}). Returns normalised parts or null. */
export function partsOk(parts, fx, { words = CAPS.words } = {}) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 24) return null;
  const out = []; let w = 0;
  for (const p of parts) {
    if (typeof p === "string") { if (!textOk(p)) return null; w += p.trim() ? p.trim().split(/\s+/).length : 0; out.push(p); continue; }
    if (!p || typeof p !== "object") return null;
    if (typeof p.ref === "string") {
      const r = tryv(() => fx.ref(p.ref)); if (!r) return null;
      const fmt = p.fmt ?? (r.k === "player" ? "player" : r.k === "turn" ? "turn" : r.k === "pct" ? "pct" : r.k === "x" ? "x" : "n");
      if (!FMTS.includes(fmt) || !KIND_OK[fmt].includes(r.k)) return null;
      w += 1; out.push({ ref: p.ref, fmt }); continue;
    }
    if (Array.isArray(p.dir) && p.dir.length === 2) {
      const a = tryv(() => fx.ref(p.dir[0])), b = tryv(() => fx.ref(p.dir[1]));
      if (!a || !b || typeof a.v !== "number" || typeof b.v !== "number" || !textOk(p.up, 20) || !textOk(p.down, 20) || (p.same != null && !textOk(p.same, 20))) return null;
      w += 1; out.push({ dir: [p.dir[0], p.dir[1]], up: p.up, down: p.down, same: p.same ?? "held" }); continue;
    }
    return null; // {hex} and anything else is not in this release
  }
  return w <= words ? out : null;
}

const key = (fx, k) => { const q = fx.seatOf(k); return q >= 0 ? q : null; };
const numRef = (fx, r) => { const v = typeof r === "string" ? tryv(() => fx.ref(r)) : null; return v && (v.k === "n" || v.k === "pct") ? v : null; };
const tileRef = (fx, r) => { const v = typeof r === "string" ? tryv(() => fx.ref(r)) : null; return v && (v.k === "n" || v.k === "pct" || v.k === "x" || v.k === "turn") ? v : null; }; // a tile can also say a word (the set-up spots) or a turn
const label = (s) => (typeof s === "string" && textOk(s, CAPS.label) && s.trim() ? s.trim() : null);

/** One primitive -> a normalised block or null. */
export function blockOk(b, fx) {
  if (!b || typeof b !== "object" || !PRIMS.includes(b.p)) return null;
  const T = fx.T;
  switch (b.p) {
    case "line": {
      if (b.metric === "points") {
        const q = key(fx, b.player), s = q == null ? null : fx.strat[q]; if (!s || !fx.log) return null;
        const show = (Array.isArray(b.show) ? b.show : []).filter((x, i, a) => ["plan", "stalls", "pivot"].includes(x) && a.indexOf(x) === i && (x !== "plan" || s.planFam) && (x !== "pivot" || s.pivot));
        return { p: "line", metric: "points", player: b.player, show };
      }
      if (b.metric !== "winchance" || !fx.hasWc) return null;
      const players = (Array.isArray(b.players) ? b.players : [fx.keys[fx.me]]).filter((k, i, a) => key(fx, k) != null && a.indexOf(k) === i).slice(0, 2); if (!players.length) return null;
      let range = null; if (Array.isArray(b.range)) { const [a, c] = b.range; if (isInt(a) && isInt(c) && a >= 0 && c <= T && c - a >= 2) range = [a, c]; }
      const [t0, t1] = range || [0, T], marks = [...new Set((Array.isArray(b.marks) ? b.marks : []).filter((t) => isInt(t) && t >= t0 && t <= t1))].slice(0, CAPS.marks);
      return { p: "line", metric: "winchance", players, range, marks };
    }
    case "bars": {
      const rows = (Array.isArray(b.rows) ? b.rows : []).filter((r) => r && key(fx, r.player) != null && numRef(fx, r.ref)).slice(0, CAPS.rows); if (!rows.length) return null;
      const unit = typeof b.unit === "string" ? (textOk(b.unit, 60) ? b.unit : "") : "";
      return { p: "bars", rows: rows.map((r) => ({ player: r.player, ref: r.ref })), diverging: !!b.diverging, unit };
    }
    case "strip": {
      if (b.metric === "hand") { const q = key(fx, b.player); return q != null && fx.log && fx.strat[q] ? { p: "strip", metric: "hand", player: b.player } : null; }
      if (b.metric === "rolls") return fx.dice?.N ? { p: "strip", metric: "rolls" } : null;
      return null;
    }
    case "stack": { const q = key(fx, b.player), s = q == null ? null : fx.strat[q]; return s && s.srcTotal > 0 ? { p: "stack", player: b.player } : null; }
    case "tiles": {
      const items = [];
      for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, CAPS.tiles)) {
        if (!it) continue;
        if (it.kind === "num") {
          const lb = label(it.label); if (!lb || !tileRef(fx, it.ref)) continue;
          const of = it.of && numRef(fx, it.of) ? it.of : null, sub = it.subIf && tryv(() => fx.ref(it.subIf)) && it.sub ? partsOk(it.sub, fx, { words: 10 }) : null;
          items.push({ kind: "num", label: lb, ref: it.ref, of, subIf: sub ? it.subIf : null, sub });
        } else if (it.kind === "startfeed") { const q = key(fx, it.player); if (q != null && fx.strat[q]?.feeds) items.push({ kind: "startfeed", player: it.player }); }
        else if (it.kind === "miss") { if (tryv(() => fx.ref("near.n")) && tryv(() => fx.ref("near.res"))) items.push({ kind: "miss" }); }
      }
      return items.length ? { p: "tiles", items } : null;
    }
    case "compare": return isInt(b.dec) && fx.decAt(b.dec) ? { p: "compare", dec: b.dec } : null;
    case "board": { // a decision (dec: played vs better), or a moment: set-up spots (turn 0), where the robber went (show robber), a player's network (players + turn), highlighted hexes
      const bd = fx.board, seats = (Array.isArray(b.players) ? b.players : []).filter((k, i, a) => key(fx, k) != null && a.indexOf(k) === i).slice(0, 3);
      const hexes = [...new Set((Array.isArray(b.hexes) ? b.hexes : []).filter((h) => isInt(h) && bd?.hexes.some((x) => x.id === h)))].slice(0, 4);
      const rob = Array.isArray(b.show) && b.show.includes("robber");
      let dec = isInt(b.dec) ? b.dec : null, turn = isInt(b.turn) && b.turn >= 0 && b.turn <= T ? b.turn : null;
      if (dec == null && turn != null && !seats.length && !hexes.length && !rob && fx.decAt(turn)?.pos) { dec = turn; turn = null; } // the v1.83 shape {p:"board", turn: <decision turn>}
      if (dec != null && fx.decAt(dec)?.pos) return { p: "board", dec, turn: null, players: [], hexes: [], robber: false };
      if (dec != null && turn == null) turn = isInt(dec) && dec >= 0 && dec <= T ? dec : null; // no such decision: the turn may still be a moment (robber / network)
      if (!bd || !(seats.length || hexes.length || rob)) return null;
      if (rob && !bd.robber.some((m) => m.turn === turn)) return null;
      return { p: "board", dec: null, turn: turn ?? T, players: seats, hexes, robber: rob };
    }
    case "badge": { const q = key(fx, b.player), s = q == null ? null : fx.strat[q]; return s?.verdict ? { p: "badge", player: b.player } : null; }
    case "table": return b.of === "luck" && fx.luck ? { p: "table", of: "luck" } : null;
    case "text": { const parts = partsOk(b.parts, fx, { words: 18 }); return parts ? { p: "text", parts, link: !!b.link } : null; }
    default: return null;
  }
}

/** The fact binding of a block, as one or more signatures: two blocks sharing a signature show the same fact. */
export function sigsOf(b) {
  switch (b.p) {
    case "line": return [b.metric === "points" ? `line|pts|${b.player}` : `line|wc|${b.players.join(",")}|${b.range ? b.range.join("-") : "all"}`];
    case "bars": return [`bars|${b.rows.map((r) => r.ref).sort().join(",")}`];
    case "strip": return [`strip|${b.metric}|${b.player || ""}`];
    case "stack": return [`stack|${b.player}`];
    case "tiles": return b.items.map((i) => (i.kind === "num" ? `num|${i.ref}|${i.of || ""}` : i.kind === "startfeed" ? `startfeed|${i.player}` : "miss"));
    case "compare": return [`compare|${b.dec}`];
    case "board": return [b.dec != null ? `board|dec|${b.dec}` : `board|${b.turn}|${b.players.join(",")}|${b.hexes.join(",")}|${b.robber ? "r" : ""}`];
    case "badge": return [`badge|${b.player}`];
    case "table": return [`table|${b.of}`];
    case "text": return [`text|${JSON.stringify(b.parts)}`];
    default: return [];
  }
}

/** Apply caps and the dedupe to a list of blocks (in page order). `seen` is the set of signatures shown so far. Returns the kept blocks. */
function keep(blocks, seen, max, dropped, wid) {
  const out = []; let boards = 0, lines = 0;
  for (const raw of blocks) {
    if (out.length >= max) { dropped.push({ id: wid, why: `cap blocks ${raw?.p}` }); continue; }
    let b = raw;
    if (b.p === "board" && boards >= CAPS.boards) { dropped.push({ id: wid, why: "cap board" }); continue; }
    if (b.p === "line" && lines >= CAPS.lines) { dropped.push({ id: wid, why: "cap lines" }); continue; }
    if (b.p === "tiles") { // dedupe item by item: a tile already on the page goes, the others stay
      const items = b.items.filter((i) => !seen.has(sigsOf({ p: "tiles", items: [i] })[0]));
      if (items.length !== b.items.length) dropped.push({ id: wid, why: `dup tile ${b.items.length - items.length}` });
      if (!items.length) continue; b = { ...b, items };
    } else {
      const sg = sigsOf(b); if (sg.some((s) => seen.has(s))) { dropped.push({ id: wid, why: `dup ${b.p}` }); continue; }
    }
    sigsOf(b).forEach((s) => seen.add(s));
    if (b.p === "board") boards++; if (b.p === "line") lines++;
    out.push(b);
  }
  return out;
}

const titleFallback = (w, fx) => { const q = w.who != null ? key(fx, w.who) : null; return [`${w.level}${q != null ? " · " : ""}`, ...(q != null ? [{ ref: `name.${w.who}`, fmt: "player" }] : [])]; };

/** The turns a widget is about (for "Open ..." in the turn sheet): turn refs of its title / notes, line marks, the decision turn, the pivot. */
export function turnsOf(w, fx) {
  const out = new Set(), walk = (parts) => (parts || []).forEach((p) => { if (p?.ref) { const r = tryv(() => fx.ref(p.ref)); if (r?.k === "turn") out.add(r.v); const m = /@(\d+)$/.exec(p.ref); if (m) out.add(+m[1]); } if (p?.dir) p.dir.forEach((d) => { const m = /@(\d+)$/.exec(d); if (m) out.add(+m[1]); }); });
  walk(w.title); (w.notes || []).forEach(walk);
  [...w.blocks, ...(w.expand || [])].forEach((b) => { if (b.p === "line") (b.marks || []).forEach((t) => out.add(t)); if (b.p === "compare") out.add(b.dec); if (b.p === "board") { if (b.dec != null) out.add(b.dec); else if (b.robber || b.turn < fx.T) out.add(b.turn); } if (b.p === "text") walk(b.parts); });
  return [...out].filter((t) => Number.isInteger(t) && t >= 0 && t <= fx.T).sort((a, b) => a - b);
}

/** Validate a whole page spec against the facts. Never throws. { headline, widgets, follow, dropped: [{id, why}] }; widgets may be empty (the caller then uses recipes). */
export function validatePage(spec, fx) {
  const dropped = [], seen = new Set(), widgets = [], ids = new Set();
  const sp = spec && typeof spec === "object" ? spec : {};
  let headline = null;
  if (sp.headline) {
    const req = (Array.isArray(sp.headlineRequires) ? sp.headlineRequires : []).every((r) => tryv(() => fx.ref(r)));
    headline = req ? partsOk(sp.headline, fx) : null; if (!headline) dropped.push({ id: "headline", why: "invalid" });
  }
  for (const w0 of (Array.isArray(sp.widgets) ? sp.widgets : []).slice(0, CAPS.widgets + 4)) {
    if (widgets.length >= CAPS.widgets) { dropped.push({ id: w0?.id, why: "cap widgets" }); continue; }
    if (!w0 || typeof w0 !== "object" || !LEVELS.includes(w0.level)) { dropped.push({ id: w0?.id, why: "level" }); continue; }
    const id = typeof w0.id === "string" && /^[\w-]{1,24}$/.test(w0.id) && !ids.has(w0.id) ? w0.id : `w${widgets.length + 1}`;
    const w = { id, level: w0.level, short: label(w0.short) || w0.level.toLowerCase(), who: w0.who != null && key(fx, w0.who) != null ? w0.who : null, chip: null, title: null, titleFallback: false, blocks: [], expand: [], notes: [] };
    // title: valid parts whose `requires` hold, else the app's fallback title
    const req = (Array.isArray(w0.requires) ? w0.requires : []).every((r) => tryv(() => fx.ref(r)));
    w.title = req ? partsOk(w0.title, fx) : null;
    if (!w.title) { w.title = titleFallback(w, fx); w.titleFallback = true; dropped.push({ id, why: req ? "title invalid" : "requires failed" }); }
    if (w0.chip && typeof w0.chip === "object") { const r = numRef(fx, w0.chip.ref); if (r && ["sgpct", "pct", "n"].includes(w0.chip.fmt)) w.chip = { ref: w0.chip.ref, fmt: w0.chip.fmt, tone: r.v > 0 ? "up" : r.v < 0 ? "dn" : null }; } // the tone is the sign of the value (the app decides, a model cannot contradict the number)
    const valid = (l) => (Array.isArray(l) ? l : []).map((b) => { const v = blockOk(b, fx); if (!v) dropped.push({ id, why: `block ${b?.p} invalid` }); return v; }).filter(Boolean);
    w.blocks = keep(valid(w0.blocks), seen, CAPS.blocks, dropped, id);
    w.expand = keep(valid(w0.expand), seen, CAPS.expand, dropped, id);
    w.notes = (Array.isArray(w0.notes) ? w0.notes : []).slice(0, CAPS.notes).map((n) => partsOk(n, fx)).filter(Boolean);
    if (!w.blocks.length) { dropped.push({ id, why: "no valid block" }); continue; }
    ids.add(id); widgets.push(w);
  }
  const follow = (Array.isArray(sp.follow) ? sp.follow : []).map((f) => (f && typeof f.q === "string" ? f.q.trim() : "")).filter((q, i, a) => q && q.length <= 40 && textOk(q, 40) && a.indexOf(q) === i).slice(0, CAPS.follow).map((q) => ({ q }));
  return { headline, widgets, follow, dropped };
}

// ── recipes: the same specs a model could return, written by the app from facts ──
const P = (k) => ({ ref: `name.${k}`, fmt: "player" });
const R = (ref, fmt) => ({ ref, ...(fmt ? { fmt } : {}) });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** A full page spec from the facts alone. All words come from fx.t (src/review/ai-lang.js: EN / NL). */
export function recipePage(fx) {
  const t = fx.t, r = t.r, Y = fx.keys[fx.me], W = fx.winner != null ? fx.keys[fx.winner] : null, S = fx.strat[fx.me], widgets = [], youIs = !!fx.players[fx.me]?.you;
  const headline = fx.won ? [P(Y), ...r.won(R(`turn.${fx.T}`), R(`pts.${Y}`))]
    : W ? [P(W), r.lostA, R(`turn.${fx.T}`), ". ", P(Y), r.lostB, R(`pts.${Y}`), r.lostC] : null;
  // 1. win chance: the DECISIVE swing (fx.decisive, one source: ai-facts.js aiDecisive), who moved which way, plus the other of the two on that turn.
  const D = fx.decisive;
  if (fx.hasWc && D) {
    const tn = D.t, K = D.key, oc = D.other, duo = [Y, ...(W && W !== Y ? [W] : [])];
    const lead = (k) => r.wcLead(k === Y && youIs, P(k)), mv = (k) => ({ dir: [`wc.${k}@${tn - 1}`, `wc.${k}@${tn}`], up: r.up, down: r.down });
    const clause = (k) => [...lead(k), mv(k), r.wcFrom, R(`wc.${k}@${tn - 1}`), r.wcTo, R(`wc.${k}@${tn}`)];
    widgets.push({ id: "wc", level: "Game", short: t.short_.wc, chip: { ref: `d.${K}@${tn}`, fmt: "sgpct", tone: D.d > 0 ? "up" : "dn" },
      title: [...clause(K), r.wcOn, R(`turn.${tn}`), ...(oc ? ["; ", ...clause(oc.key).map((x, i) => (i === 0 && typeof x === "string" ? x.charAt(0).toLowerCase() + x.slice(1) : x))] : []), "."],
      blocks: [{ p: "line", metric: "winchance", players: duo.includes(K) ? duo : [K, ...duo], marks: D.marks }],
      notes: [[r.wcN1], [r.wcN2]] });
  }
  // 4. near miss
  const nm = fx.near; let hasNear = false;
  if (nm && !fx.won && nm.youPoints >= nm.pointsToWin - 3 && nm.margin > 0) {
    const one = tryv(() => fx.ref("near.res"));
    widgets.push({ id: "near", level: "Near miss", short: t.short_.near,
      title: one ? [R(`pts.${Y}`), r.nearOne.a, R("near.goal"), r.nearOne.b, R("near.n"), " ", R("near.res", "x"), r.nearOne.c, R(`turn.${fx.T}`), "."] : [R(`pts.${Y}`), r.nearOne.a, R("near.goal"), r.nearEnd],
      blocks: [{ p: "stack", player: Y }, ...(one ? [{ p: "tiles", items: [{ kind: "miss" }] }] : [])] }); // the "short" tile only when exactly one resource was missing (else the block cannot resolve)
    hasNear = true;
  }
  // 2. grand strategy of the reviewed player
  if (S?.verdict) {
    const base = [P(Y)], n = S.idleN;
    const title = S.headless ? [...base, r.headless.a, R(`strat.${Y}.idleN`), r.headless.b, R(`strat.${Y}.turns`), r.headless.c]
      : S.pivot ? [...base, r.pivot.a, R(`strat.${Y}.plan`, "x"), r.pivot.b, R(`strat.${Y}.pivot.to`, "x"), r.pivot.c, R(`strat.${Y}.pivot.t`, "turn"), "."]
      : S.steady ? [...base, r.steady.a, R(`strat.${Y}.plan`, "x"), r.steady.b, R(`strat.${Y}.idleN`), r.steady.n(n)]
      : [...base, r.plain.a, R(`strat.${Y}.idleN`), r.plain.n(n), R(`strat.${Y}.turns`), r.plain.z];
    const req = S.headless ? [`strat.${Y}.headless`] : S.pivot ? [`strat.${Y}.pivot`] : S.steady ? [`strat.${Y}.steady`] : [];
    widgets.push({ id: "gs", level: "Strategy", short: t.short_.gs, who: Y, requires: req, title,
      blocks: [{ p: "badge", player: Y }, { p: "line", metric: "points", player: Y, show: ["plan", "stalls", "pivot"] }, ...(hasNear ? [] : [{ p: "stack", player: Y }]),
        { p: "tiles", items: [{ kind: "num", label: t.tStalled, ref: `strat.${Y}.idleN`, of: `strat.${Y}.turns`, subIf: `strat.${Y}.waitN`, sub: [R(`strat.${Y}.waitN`), r.waiting, R(`strat.${Y}.waitRes`, "x")] }, { kind: "startfeed", player: Y }] }],
      notes: [[r.gsN1], ...(S.E > 0 ? [[r.gsN2.a, R(`strat.${Y}.E`, "pct"), r.gsN2.b]] : [])] });
  }
  // 5. the decision that cost the most
  const d = fx.decs.find((x) => x.gap >= 3 && x.vc !== "close");
  if (d) {
    widgets.push({ id: "dec", level: "Decision", short: t.short_.dec, chip: { ref: `dec.${d.turn}.neg`, fmt: "sgpct", tone: "dn" },
      title: [r.dec.a, R(`turn.${d.turn}`), r.dec.b, R(`dec.${d.turn}.gap`, "pct"), r.dec.c],
      blocks: [{ p: "compare", dec: d.turn }], expand: d.pos ? [{ p: "board", dec: d.turn }] : [],
      notes: [[r.decN]] });
  }
  // 3. waiting on one resource while holding cards (the stalled / start tiles live on the plan card: no repeat here)
  if (S?.waitRes && S.waitN >= 3 && fx.rate?.[S.waitRes]) {
    const res = S.waitRes, others = fx.players.filter((p) => !p.you).map((p) => p.key);
    widgets.push({ id: "wait", level: "Strategy", short: t.short_.wait(t.res[res]), who: Y,
      title: [r.wait.a, R(`strat.${Y}.waitRes`, "x"), r.wait.b, R(`rate.${res}.${Y}`), r.wait.c, R(`rate.${res}.top`), r.wait.d],
      blocks: [{ p: "strip", metric: "hand", player: Y }, { p: "bars", rows: [...others, Y].map((k) => ({ player: k, ref: `rate.${res}.${k}` })), unit: r.waitUnit(t.res[res]) }] });
  }
  // 6. luck, only when it was big
  if (fx.luck && Math.max(...fx.luck.tot.map(Math.abs)) >= 5) {
    const rows = fx.players.slice().sort((a, b) => (b.you ? 1 : 0) - (a.you ? 1 : 0) || Math.abs(fx.luck.tot[b.seat]) - Math.abs(fx.luck.tot[a.seat])).slice(0, CAPS.rows).map((p) => ({ player: p.key, ref: `luck.total.${p.key}` }));
    widgets.push({ id: "luck", level: "Luck", short: t.short_.luck, chip: { ref: `luck.total.${Y}`, fmt: "sgpct", tone: fx.luck.tot[fx.me] >= 0 ? "up" : "dn" },
      title: [P(Y), r.luck.a, R(`luck.total.${Y}`, "sgpct"), r.luck.b],
      blocks: [{ p: "bars", rows, diverging: true, unit: r.luckUnit }], expand: [{ p: "table", of: "luck" }, ...(fx.dice ? [{ p: "strip", metric: "rolls" }] : [])] });
  }
  const f = r.follow, follow = [{ q: fx.won ? f.won : f.lost }, { q: f.best }, { q: f.lucky }, { q: f.plan }];
  return { headline, widgets, follow };
}

/** The page of a game: the recipes, validated (so a recipe can never put a bad fact on the page). */
export function recipeValidated(fx) { return validatePage(recipePage(fx), fx); }
export { cap };
