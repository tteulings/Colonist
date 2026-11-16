// v1.84 Compose mode, client side: the model composes the AI page from the fact index in ONE call (Function mode "compose"); every returned spec
// goes through the same validator as the recipes (src/review/ai-page.js). Invalid widgets are dropped; fewer than 2 survivors -> the recipes page.
// Pure apart from fetch: the fact index `fx` comes from buildFacts (loaded lazily so this file also runs under node tests).
import { validatePage, recipePage, CAPS, textOk, blockOk, sigsOf, partsOk } from "./ai-page.js";

export const COMPOSE_URL = "https://katan-recap-fn.azurewebsites.net/api/recap";
export const MIN_WIDGETS = 2;
/** v1.86 feature flag: the LLM-composed page (background compose call + swap-in + compose-question widgets) is OFF by default; the AI tab shows the validated recipes page and
 *  questions use the text chat. Enable for testing with localStorage katan_ai_compose=1. */
export const COMPOSE_ENABLED = false;
export function composeEnabled() { try { return COMPOSE_ENABLED || (typeof localStorage !== "undefined" && localStorage.getItem("katan_ai_compose") === "1"); } catch (_) { return COMPOSE_ENABLED; } }
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const RES = ["wood", "brick", "sheep", "wheat", "ore"];

/** The compact, typed index the model sees: players, result and every bindable ref with kind and a value hint. */
export function composeIndex(fx) {
  const refs = {}, add = (r) => { const v = tryv(() => fx.ref(r)); if (v) refs[r] = v.k === "b" ? "b" : `${v.k}:${v.k === "player" ? fx.nameOf(v.v) : v.v}`; };
  const keys = fx.keys, T = fx.T, me = fx.me;
  keys.forEach((k, q) => { add(`name.${k}`); add(`pts.${k}`); add(`luck.total.${k}`);
    ["plan", "idleN", "turns", "waitN", "waitRes", "E", "SD", "verdict", "feeds", "steady", "wobbly", "headless", "pivot", "pivot.t", "pivot.to"].forEach((f) => add(`strat.${k}.${f}`));
    RES.forEach((r) => add(`rate.${r}.${k}`)); ["s", "c", "v", "L", "A", "I", "total"].forEach((f) => add(`score.${k}.${f}`)); });
  RES.forEach((r) => { add(`rate.${r}.top`); add(`rate.${r}.low`); });
  ["sx.mover", "sx.actor", "sx.victim", "sx.prev", "sx.t", "sx.gain", "sx.need", "sx.before", "sx.after", "sx.public", "sx.hidden", "sx.odds", "sx.roll", "sx.by.s", "sx.by.c", "sx.by.v", "sx.by.L", "sx.by.A", "sx.by.I"].forEach(add);
  ["luck.dominant", "game.winner", "game.decisive.t", "game.decisive.player", "game.T", "near.pts", "near.wpts", "near.goal", "near.margin", "near.res", "near.n", "near.label"].forEach(add);
  // win chance at the turns that matter: the biggest swings of every player (before and after), a quarter way, half way, the end
  const turns = new Set([T, Math.round(T / 4), Math.round(T / 2), Math.round((3 * T) / 4)].filter((t) => t >= 1));
  if (fx.hasWc) keys.forEach((k, q) => fx.swings(q, 3).forEach((s) => { turns.add(s.t); if (s.t > 1) turns.add(s.t - 1); add(`d.${k}@${s.t}`); }));
  const bd = fx.board, rob = bd ? bd.robber.slice(0, 8) : [];
  rob.forEach((m) => { turns.add(m.turn); add(`rob.${m.turn}.hex`); add(`rob.${m.turn}.by`); });
  if (bd) keys.forEach((k) => { add(`setup.${k}.1`); add(`setup.${k}.2`); });
  const dts = (fx.decs || []).slice(0, 5).map((d) => d.turn);
  dts.forEach((t) => { turns.add(t); ["gap", "neg", "played", "best"].forEach((f) => add(`dec.${t}.${f}`)); });
  [...turns].sort((a, b) => a - b).forEach((t) => { add(`turn.${t}`); if (fx.hasWc) keys.forEach((k) => add(`wc.${k}@${t}`)); });
  return {
    game: { turns: T, players: fx.players.map((p) => ({ key: p.key, name: p.name, you: p.you })), you: keys[me], winner: fx.winner != null ? keys[fx.winner] : null, youWon: !!fx.won,
      winChance: !!fx.hasWc, luck: !!fx.luck, turnRange: [0, T],
      decisive: fx.decisive ? { player: fx.decisive.key, turn: fx.decisive.t, from: fx.decisive.from, to: fx.decisive.to } : null,
      shape: fx.shape ? { id: fx.shape.id, winnerLedFromTurn: fx.shape.tLead, biggestStepTurn: fx.shape.step.t } : null, // v1.87 how the game went (ai-shape.js)
      suddenWhy: fx.surprise ? { kind: fx.surprise.kind, sentence: tryv(() => fx.surpriseFact()?.sentence, null) } : null },   // v1.86.2 why the decisive swing was so sudden (the app's classification; refs sx.*)
    decisions: (fx.decs || []).slice(0, 5).map((d) => ({ turn: d.turn, verdict: d.vc, board: !!d.pos })),   // compare / board bind to these turns only
    board: bd ? { hexes: bd.hexes.map((h) => `${h.id}:${h.res}${h.num ? " " + h.num : ""}`).join(", "), robberMoves: rob.map((m) => ({ turn: m.turn, by: keys[m.seat], hex: m.hex })) } : null,   // board blocks: dec (above), turn 0 + players (set-up), turn + show robber (a turn above), turn + players (network), hexes (ids above)
    strategy: keys.map((k, q) => ({ key: k, hasPlan: !!fx.strat[q]?.verdict, planStalled: !!fx.strat[q]?.idleN, pointsLog: !!fx.strat[q]?.srcTotal, startFeeds: !!fx.strat[q]?.feeds })),
    rollsAvailable: !!fx.dice?.N, refs,
  };
}

// ── the model answers in a flat strict schema (nullable fields = unused); turn it into the validator's spec ──
const nn = (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);
export function partsOf(ps) {
  if (!Array.isArray(ps)) return ps;
  return ps.map((p) => {
    if (!p || typeof p !== "object") return p;
    if (p.k === "s") return p.s ?? "";
    if (p.k === "ref") return { ref: p.ref, ...(nn(p.fmt) ? { fmt: p.fmt } : {}) };
    if (p.k === "dir") return { dir: [p.a, p.b], up: p.up, down: p.down, ...(nn(p.same) ? { same: p.same } : {}) };
    return p;
  });
}
function blockOf(b) {
  if (!b || typeof b !== "object") return b;
  const o = { p: b.p };
  for (const k of ["metric", "player", "players", "range", "marks", "show", "hexes", "rows", "unit", "dec", "turn", "of"]) if (nn(b[k])) o[k] = b[k];
  if (b.diverging) o.diverging = true;
  if (b.link) o.link = true;
  if (nn(b.parts)) o.parts = partsOf(b.parts);
  if (Array.isArray(b.items)) o.items = b.items.map((it) => { if (!it) return it; const r = { kind: it.kind }; for (const k of ["label", "ref", "of", "subIf", "player"]) if (nn(it[k])) r[k] = it[k]; if (nn(it.sub)) r.sub = partsOf(it.sub); return r; });
  return o;
}
export function widgetOf(w) {
  if (!w || typeof w !== "object") return w;
  const o = { id: w.id, level: w.level, short: w.short, title: partsOf(w.title), blocks: (w.blocks || []).map(blockOf), expand: (w.expand || []).map(blockOf), notes: (w.notes || []).map(partsOf) };
  if (nn(w.who)) o.who = w.who;
  if (nn(w.requires)) o.requires = w.requires;
  if (w.chip && typeof w.chip === "object") o.chip = { ref: w.chip.ref, fmt: w.chip.fmt, ...(nn(w.chip.tone) ? { tone: w.chip.tone } : {}) };
  return o;
}
/** Deterministic repairs of what a model slips on, before validation (each one is listed in spec._repairs): refs written "turn:17", an invalid block or a block repeating a fact already on the page,
 *  a start-feed tile next to a sentence that the same player waited on a resource, the badge of a player who won with a weak verdict. Never invents a fact. */
export function repairSpec(sp, fx) {
  const rep = [], seen = new Set(), fixRef = (r) => (typeof r === "string" && /^(turn|name):/.test(r) ? r.replace(":", ".") : r);
  const fixParts = (ps) => (Array.isArray(ps) ? ps.map((p) => (p && typeof p === "object" ? { ...p, ...(p.ref ? { ref: fixRef(p.ref) } : {}), ...(p.dir ? { dir: p.dir.map(fixRef) } : {}) } : p)) : ps);
  const W = fx.winner != null ? fx.keys[fx.winner] : null;
  const waits = (w, k) => new RegExp(`strat\\.${k}\\.(waitN|waitRes)`).test(JSON.stringify([w.title, w.notes, w.blocks, w.expand]));
  sp.widgets = (sp.widgets || []).map((w) => {
    if (!w || typeof w !== "object") return w;
    const o = { ...w, short: typeof w.short === "string" ? w.short.replace(/\d+/g, "").replace(/\s+/g, " ").trim() : w.short, title: fixParts(w.title), notes: (w.notes || []).map(fixParts), requires: (w.requires || []).map(fixRef) };
    const fixBlocks = (list) => (list || []).map((b) => {
      if (!b || typeof b !== "object") return null;
      const fb = { ...b, ...(b.parts ? { parts: fixParts(b.parts) } : {}), ...(b.rows ? { rows: b.rows.map((r) => ({ ...r, ref: fixRef(r.ref) })) } : {}), ...(b.items ? { items: b.items.map((i) => ({ ...i, ref: fixRef(i.ref), ...(i.sub ? { sub: fixParts(i.sub) } : {}) })) } : {}) };
      if (fb.p === "tiles" && Array.isArray(fb.items)) fb.items = fb.items.filter((i) => { const bad = i.kind === "startfeed" && W != null && i.player && fx.strat[fx.seatOf(i.player)]?.feeds === "yes" && fx.strat[fx.seatOf(i.player)]?.waitRes && fx.strat[fx.seatOf(i.player)]?.waitN >= 3 && (waits(w, i.player) || (fx.rate && JSON.stringify(sp.widgets).includes(`rate.${fx.strat[fx.seatOf(i.player)].waitRes}.`))); if (bad) rep.push(`${w.id}: start feed next to waiting`); return !bad; });
      if (fb.p === "badge" && W != null && fb.player === W && /weak/i.test(fx.strat[fx.seatOf(W)]?.verdict?.label || "")) { rep.push(`${w.id}: badge of the winner`); return null; }
      const nb = blockOk(fb, fx); if (!nb) { rep.push(`${w.id}: invalid ${fb.p}`); return null; }
      const sg = nb.p === "tiles" ? nb.items.map((i) => sigsOf({ p: "tiles", items: [i] })[0]) : sigsOf(nb);
      if (sg.some((x) => seen.has(x))) { rep.push(`${w.id}: repeated ${fb.p}`); return null; }
      sg.forEach((x) => seen.add(x)); return fb;
    }).filter(Boolean);
    o.blocks = fixBlocks(w.blocks); o.expand = fixBlocks(w.expand);
    return o;
  }).filter((w) => !w || typeof w !== "object" || w.blocks.length || (rep.push(`${w.id}: no block left`), false));
  // Dutch causal words (the validator knows the English ones and the common Dutch ones; these are the rest) and a winner called weak: the sentence goes, the widget goes
  const NLC = /\b(omdat|doordat|waardoor|daardoor|daarom|vanwege|dankzij|veroorzaakt|veroorzaakte|leidde tot|leidt tot|resulteerde in|aangezien|zodat|dus)\b/i, WEAK = /\b(weak|headless|aimless|no plan|zwak|doelloos|kip zonder kop)\b/i;
  const flat = (ps) => (Array.isArray(ps) ? ps.filter((p) => typeof p === "string").join(" ") : "");
  sp.widgets.forEach((w) => { if (!w) return; const n = (w.notes || []).length; w.notes = (w.notes || []).filter((x) => !NLC.test(flat(x))); if (w.notes.length !== n) rep.push(`${w.id}: causal note`); });
  if (W != null) sp.widgets = sp.widgets.filter((w) => { const bad = w && w.who === W && WEAK.test([flat(w.title), ...(w.notes || []).map(flat), ...[...w.blocks, ...w.expand].map((b) => flat(b.parts))].join(" ")); if (bad) rep.push(`${w.id}: winner called weak`); return !bad; });
  // a widget whose title cannot stand (unknown ref, a claim whose `requires` fails) is dropped when the page keeps at least 3 others: a card titled "Strategy · Name" says nothing
  const titled = (w) => (w.requires || []).every((r) => fx.ref(r)) && !!partsOk(w.title, fx);
  if (sp.widgets.filter((w) => w && titled(w)).length >= 3) sp.widgets = sp.widgets.filter((w) => { const ok = !w || titled(w); if (!ok) rep.push(`${w.id}: title cannot stand`); return ok; });
  // the app never leaves out what the game is about: a narrow loss gets its Near miss card and a game decided by luck its Luck card (the recipe card, same validator)
  try {
    const have = (l) => sp.widgets.some((w) => w?.level === l), rp = recipePage(fx).widgets;
    for (const [l, id] of [["Near miss", "near"], ["Luck", "luck"]]) {
      const w = rp.find((x) => x.id === id); if (!w || have(l) || sp.widgets.length >= CAPS.widgets || (id === "luck" && !fx.luck?.dominant)) continue;
      const mine = new Set(w.blocks.flatMap((b) => { const nb = blockOk(b, fx); return nb ? (nb.p === "tiles" ? nb.items.map((i) => sigsOf({ p: "tiles", items: [i] })[0]) : sigsOf(nb)) : []; }));
      sp.widgets.forEach((x) => { if (!x) return; ["blocks", "expand"].forEach((k) => { x[k] = x[k].filter((b) => { const nb = blockOk(b, fx); return !nb || nb.p === "tiles" || !sigsOf(nb).some((g) => mine.has(g)); }); }); });
      sp.widgets = sp.widgets.filter((x) => !x || x.blocks.length); sp.widgets.push(w); rep.push(`added the ${l} card`);
    }
  } catch (_) { /* recipes only add */ }
  Object.defineProperty(sp, "_repairs", { value: rep, enumerable: false, writable: true });
  return sp;
}
/** The flat compose answer -> a page spec {headline, widgets, follow} in the validator's schema (repaired when the facts `fx` are given). */
export function toSpec(c, fx = null) {
  const sp = { widgets: [], follow: [] };
  if (!c || typeof c !== "object") return sp;
  if (nn(c.headline)) sp.headline = partsOf(c.headline);
  sp.widgets = (Array.isArray(c.widgets) ? c.widgets : []).slice(0, CAPS.widgets).map(widgetOf);
  sp.follow = (Array.isArray(c.follow) ? c.follow : []).map((q) => ({ q: typeof q === "string" ? q : q?.q }));
  return fx ? repairSpec(sp, fx) : sp;
}

/** Ask the model to compose the page; returns the raw flat answer or null (offline, 429, timeout, bad answer). */
export async function composeCall(fx, lang, { url = COMPOSE_URL, ms = 60000, fetchFn, question = null, shown = [] } = {}) {
  const f = fetchFn || (typeof fetch === "function" ? fetch : null); if (!f) return null;
  const ctl = typeof AbortController === "function" ? new AbortController() : null, to = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    const body = { mode: "compose", lang: lang === "nl" ? "nl" : "en", index: composeIndex(fx), ...(question ? { question: String(question).slice(0, 300), shown } : { examples: recipePage(fx) }) };
    const r = await f(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), ...(ctl ? { signal: ctl.signal } : {}) });
    if (!r.ok) return null;
    const j = await r.json(); return j && typeof j.compose === "object" ? j.compose : null;
  } catch (_) { return null; } finally { if (to) clearTimeout(to); }
}

/** The composed page of a game, validated. { page, source: "ai" | "recipes", dropped }. Never throws; falls back to the recipes page. */
export async function composePage(g, lang = "en", opts = {}) {
  let fx = opts.fx;
  if (!fx) { const { buildFacts } = await import("./ai-index.js"); fx = buildFacts(g); }
  const recipes = () => validatePage(recipePage(fx), fx);
  const raw = await composeCall(fx, lang, opts);
  if (!raw) return { page: recipes(), source: "recipes", dropped: [{ id: "compose", why: "no answer" }] };
  const spec = toSpec(raw, fx), page = validatePage(spec, fx);
  if (page.widgets.length < MIN_WIDGETS) return { page: recipes(), source: "recipes", dropped: [...page.dropped, { id: "compose", why: `only ${page.widgets.length} valid` }] };
  if (!page.follow.length) page.follow = recipes().follow;
  return { page, source: "ai", dropped: page.dropped, spec };
}

let FU_N = 0;
/** A follow-up question answered with ONE new widget: { widget (validated), answer (plain text, validated), spec } or null (no valid widget: the caller falls back to the text chat). */
export async function composeAnswer(g, lang = "en", question, opts = {}) {
  let fx = opts.fx;
  if (!fx) { const { buildFacts } = await import("./ai-index.js"); fx = buildFacts(g, lang); }
  const raw = await composeCall(fx, lang, { ...opts, question, shown: opts.shown || [] });
  return answerOf(raw, fx);
}
/** Validate a question-mode answer {answer, widgets:[w]} against the facts. */
export function answerOf(raw, fx, id = `fu${Date.now().toString(36)}${++FU_N}`) {
  const w0 = raw && Array.isArray(raw.widgets) ? raw.widgets[0] : null; if (!w0) return null;
  const spec = widgetOf({ ...w0, id });
  const v = validatePage({ widgets: [spec], follow: [] }, fx), widget = v.widgets[0];
  if (!widget || widget.titleFallback) return null;               // the title is the answer: a fallback title says nothing
  const answer = typeof raw.answer === "string" && textOk(raw.answer.trim(), 260) ? raw.answer.trim() : "";
  return { widget, answer, spec };
}
