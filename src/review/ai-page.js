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
export const CAUSAL = /\b(because|caused?|causing|due to|thanks to|therefore|led to|leads to|lead to|since|as a result|resulted in|owing to|so that|hence)\b/i;
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
          const lb = label(it.label); if (!lb || !numRef(fx, it.ref)) continue;
          const of = it.of && numRef(fx, it.of) ? it.of : null, sub = it.subIf && tryv(() => fx.ref(it.subIf)) && it.sub ? partsOk(it.sub, fx, { words: 10 }) : null;
          items.push({ kind: "num", label: lb, ref: it.ref, of, subIf: sub ? it.subIf : null, sub });
        } else if (it.kind === "startfeed") { const q = key(fx, it.player); if (q != null && fx.strat[q]?.feeds) items.push({ kind: "startfeed", player: it.player }); }
        else if (it.kind === "miss") { if (tryv(() => fx.ref("near.n")) && tryv(() => fx.ref("near.res"))) items.push({ kind: "miss" }); }
      }
      return items.length ? { p: "tiles", items } : null;
    }
    case "compare": return isInt(b.dec) && fx.decAt(b.dec) ? { p: "compare", dec: b.dec } : null;
    case "board": return isInt(b.turn) && fx.decAt(b.turn)?.pos ? { p: "board", turn: b.turn } : null;
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
    case "board": return [`board|${b.turn}`];
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
  [...w.blocks, ...(w.expand || [])].forEach((b) => { if (b.p === "line") (b.marks || []).forEach((t) => out.add(t)); if (b.p === "compare") out.add(b.dec); if (b.p === "board") out.add(b.turn); if (b.p === "text") walk(b.parts); });
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
    if (w0.chip && typeof w0.chip === "object") { const r = numRef(fx, w0.chip.ref); if (r && ["sgpct", "pct", "n"].includes(w0.chip.fmt)) w.chip = { ref: w0.chip.ref, fmt: w0.chip.fmt, tone: w0.chip.tone === "up" || w0.chip.tone === "dn" ? w0.chip.tone : null }; }
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

/** A full page spec from the facts alone. */
export function recipePage(fx) {
  const Y = fx.keys[fx.me], W = fx.winner != null ? fx.keys[fx.winner] : null, S = fx.strat[fx.me], widgets = [];
  const headline = fx.won ? [P(Y), " won on ", R(`turn.${fx.T}`), " with ", R(`pts.${Y}`), " points."]
    : W ? [P(W), " won on ", R(`turn.${fx.T}`), ". ", P(Y), " stood on ", R(`pts.${Y}`), " points."] : null;
  // 1. win chance: the biggest swing of the reviewed player, against the winner (or the strongest rival)
  const sw = fx.hasWc ? fx.swings(fx.me, 6).filter((s) => s.t < fx.T).slice(0, 3) : [];
  if (sw.length && Math.abs(sw[0].d) >= 3) {
    const t = sw[0].t, rival = !fx.won && W ? W : fx.keys[[...fx.players].filter((p) => !p.you).sort((a, b) => (fx.wc(b.seat, Math.max(1, Math.floor(fx.T * 0.7))) ?? 0) - (fx.wc(a.seat, Math.max(1, Math.floor(fx.T * 0.7))) ?? 0))[0]?.seat] ?? null;
    widgets.push({ id: "wc", level: "Game", short: "win chance", chip: { ref: `d.${Y}@${t}`, fmt: "sgpct", tone: sw[0].d > 0 ? "up" : "dn" },
      title: [P(Y), " stood at ", R(`wc.${Y}@${t - 1}`), " until ", R(`turn.${t}`), ", then it ", { dir: [`wc.${Y}@${t - 1}`, `wc.${Y}@${t}`], up: "rose", down: "slid" }, "."],
      blocks: [{ p: "line", metric: "winchance", players: [Y, ...(rival && rival !== Y ? [rival] : [])], marks: sw.map((s) => s.t).sort((a, b) => a - b) }],
      notes: [["Dots mark the turns where the win chance moved most. Tap one to open that turn."], ["Each win chance is a set of futures played out from that position, so a rerun moves it a little."]] });
  }
  // 4. near miss
  const nm = fx.near;
  if (nm && !fx.won && nm.youPoints >= nm.pointsToWin - 3 && nm.margin > 0) {
    const one = tryv(() => fx.ref("near.res"));
    widgets.push({ id: "near", level: "Near miss", short: "near miss",
      title: one ? [R(`pts.${Y}`), " of ", R("near.goal"), " points. ", R("near.n"), " ", R("near.res", "x"), " short on ", R(`turn.${fx.T}`), "."] : [R(`pts.${Y}`), " of ", R("near.goal"), " points at the end."],
      blocks: [{ p: "stack", player: Y }, { p: "tiles", items: [{ kind: "miss" }] }] });
  }
  // 2. grand strategy of the reviewed player
  if (S?.verdict) {
    const base = [P(Y)];
    const title = S.headless ? [...base, " spent ", R(`strat.${Y}.idleN`), " of ", R(`strat.${Y}.turns`), " turns stuck, with no steady plan."]
      : S.pivot ? [...base, " planned ", R(`strat.${Y}.plan`, "x"), ", then pivoted to ", R(`strat.${Y}.pivot.to`, "x"), " at ", R(`strat.${Y}.pivot.t`, "turn"), "."]
      : S.steady ? [...base, " planned ", R(`strat.${Y}.plan`, "x"), " and stayed on it. ", R(`strat.${Y}.idleN`), S.idleN === 1 ? " stalled turn." : " stalled turns."]
      : [...base, " had ", R(`strat.${Y}.idleN`), S.idleN === 1 ? " stalled turn of " : " stalled turns of ", R(`strat.${Y}.turns`), "."];
    const req = S.headless ? [`strat.${Y}.headless`] : S.pivot ? [`strat.${Y}.pivot`] : S.steady ? [`strat.${Y}.steady`] : [];
    widgets.push({ id: "gs", level: "Strategy", short: "the plan", who: Y, requires: req, title,
      blocks: [{ p: "badge", player: Y }, { p: "line", metric: "points", player: Y, show: ["plan", "stalls", "pivot"] }, { p: "stack", player: Y },
        { p: "tiles", items: [{ kind: "num", label: "Stalled turns", ref: `strat.${Y}.idleN`, of: `strat.${Y}.turns`, subIf: `strat.${Y}.waitN`, sub: [R(`strat.${Y}.waitN`), " waiting on ", R(`strat.${Y}.waitRes`, "x")] }, { kind: "startfeed", player: Y }] }],
      notes: [["Plan: the first two builds after set-up. A stalled turn: no points while holding four cards or more."],
        ...(S.E != null ? [["Stalled turns cost about ", R(`strat.${Y}.E`, "pct"), " of win chance, give or take ", R(`strat.${Y}.SD`, "pct"), "."]] : [])] });
  }
  // 5. the decision that cost the most
  const d = fx.decs.find((x) => x.gap >= 3 && x.vc !== "close");
  if (d) {
    widgets.push({ id: "dec", level: "Decision", short: "the decision", chip: { ref: `dec.${d.turn}.neg`, fmt: "sgpct", tone: "dn" },
      title: ["On ", R(`turn.${d.turn}`), " another move was ", R(`dec.${d.turn}.gap`, "pct"), " better."],
      blocks: [{ p: "compare", dec: d.turn }], expand: d.pos ? [{ p: "board", turn: d.turn }] : [],
      notes: [["Win chance after each move, from futures played out by the review."]] });
  }
  // 3. waiting on one resource while holding cards
  if (S?.waitRes && S.waitN >= 3 && fx.rate?.[S.waitRes]) {
    const r = S.waitRes, others = fx.players.filter((p) => !p.you).map((p) => p.key);
    widgets.push({ id: "wait", level: "Strategy", short: `${r} and cards`, who: Y,
      title: ["Cards in hand, no points. ", R(`strat.${Y}.waitRes`, "x"), " came ", R(`rate.${r}.${Y}`), " a turn, the top rival ", R(`rate.${r}.top`), "."],
      blocks: [{ p: "strip", metric: "hand", player: Y }, { p: "bars", rows: [...others, Y].map((k) => ({ player: k, ref: `rate.${r}.${k}` })), unit: `${r} cards per turn` },
        { p: "tiles", items: [{ kind: "startfeed", player: Y }, { kind: "num", label: `Waiting on ${r}`, ref: `strat.${Y}.waitN`, of: `strat.${Y}.idleN` }] }] });
  }
  // 6. luck, only when it was big
  if (fx.luck && Math.max(...fx.luck.tot.map(Math.abs)) >= 5) {
    const rows = fx.players.slice().sort((a, b) => (b.you ? 1 : 0) - (a.you ? 1 : 0) || Math.abs(fx.luck.tot[b.seat]) - Math.abs(fx.luck.tot[a.seat])).slice(0, CAPS.rows).map((p) => ({ player: p.key, ref: `luck.total.${p.key}` }));
    widgets.push({ id: "luck", level: "Luck", short: "luck", chip: { ref: `luck.total.${Y}`, fmt: "sgpct", tone: fx.luck.tot[fx.me] >= 0 ? "up" : "dn" },
      title: [P(Y), " got ", R(`luck.total.${Y}`, "sgpct"), " of win chance from chance."],
      blocks: [{ p: "bars", rows, diverging: true, unit: "win chance gained or lost to chance" }], expand: [{ p: "table", of: "luck" }, ...(fx.dice ? [{ p: "strip", metric: "rolls" }] : [])] });
  }
  const follow = (fx.won ? [{ q: "Why did I win?" }] : [{ q: "Why did I lose?" }]).concat([{ q: "Best move of the game?" }, { q: "Who was luckiest?" }, { q: "What was the winner's plan?" }]);
  return { headline, widgets, follow };
}

/** The page of a game: the recipes, validated (so a recipe can never put a bad fact on the page). */
export function recipeValidated(fx) { return validatePage(recipePage(fx), fx); }
export { cap };
