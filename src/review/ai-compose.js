// v1.84 Compose mode, client side: the model composes the AI page from the fact index in ONE call (Function mode "compose"); every returned spec
// goes through the same validator as the recipes (src/review/ai-page.js). Invalid widgets are dropped; fewer than 2 survivors -> the recipes page.
// Pure apart from fetch: the fact index `fx` comes from buildFacts (loaded lazily so this file also runs under node tests).
import { validatePage, recipePage, CAPS } from "./ai-page.js";

export const COMPOSE_URL = "https://katan-recap-fn.azurewebsites.net/api/recap";
export const MIN_WIDGETS = 2;
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const RES = ["wood", "brick", "sheep", "wheat", "ore"];

/** The compact, typed index the model sees: players, result and every bindable ref with kind and a value hint. */
export function composeIndex(fx) {
  const refs = {}, add = (r) => { const v = tryv(() => fx.ref(r)); if (v) refs[r] = v.k === "b" ? "b" : `${v.k}:${v.k === "player" ? fx.nameOf(v.v) : v.v}`; };
  const keys = fx.keys, T = fx.T, me = fx.me;
  keys.forEach((k, q) => { add(`name.${k}`); add(`pts.${k}`); add(`luck.total.${k}`);
    ["plan", "idleN", "turns", "waitN", "waitRes", "E", "SD", "verdict", "feeds", "steady", "wobbly", "headless", "pivot", "pivot.t", "pivot.to"].forEach((f) => add(`strat.${k}.${f}`));
    RES.forEach((r) => add(`rate.${r}.${k}`)); });
  RES.forEach((r) => { add(`rate.${r}.top`); add(`rate.${r}.low`); });
  ["luck.dominant", "game.winner", "game.T", "near.pts", "near.wpts", "near.goal", "near.margin", "near.res", "near.n", "near.label"].forEach(add);
  // win chance at the turns that matter: the biggest swings of every player (before and after), a quarter way, half way, the end
  const turns = new Set([T, Math.round(T / 4), Math.round(T / 2), Math.round((3 * T) / 4)].filter((t) => t >= 1));
  if (fx.hasWc) keys.forEach((k, q) => fx.swings(q, 3).forEach((s) => { turns.add(s.t); if (s.t > 1) turns.add(s.t - 1); add(`d.${k}@${s.t}`); }));
  const dts = (fx.decs || []).slice(0, 5).map((d) => d.turn);
  dts.forEach((t) => { turns.add(t); ["gap", "neg", "played", "best"].forEach((f) => add(`dec.${t}.${f}`)); });
  [...turns].sort((a, b) => a - b).forEach((t) => { add(`turn.${t}`); if (fx.hasWc) keys.forEach((k) => add(`wc.${k}@${t}`)); });
  return {
    game: { turns: T, players: fx.players.map((p) => ({ key: p.key, name: p.name, you: p.you })), you: keys[me], winner: fx.winner != null ? keys[fx.winner] : null, youWon: !!fx.won,
      winChance: !!fx.hasWc, luck: !!fx.luck, turnRange: [0, T] },
    decisions: (fx.decs || []).slice(0, 5).map((d) => ({ turn: d.turn, verdict: d.vc, board: !!d.pos })),   // compare / board bind to these turns only
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
  for (const k of ["metric", "player", "players", "range", "marks", "show", "rows", "unit", "dec", "turn", "of"]) if (nn(b[k])) o[k] = b[k];
  if (b.diverging) o.diverging = true;
  if (b.link) o.link = true;
  if (nn(b.parts)) o.parts = partsOf(b.parts);
  if (Array.isArray(b.items)) o.items = b.items.map((it) => { if (!it) return it; const r = { kind: it.kind }; for (const k of ["label", "ref", "of", "subIf", "player"]) if (nn(it[k])) r[k] = it[k]; if (nn(it.sub)) r.sub = partsOf(it.sub); return r; });
  return o;
}
/** The flat compose answer -> a page spec {headline, widgets, follow} in the validator's schema. */
export function toSpec(c) {
  const sp = { widgets: [], follow: [] };
  if (!c || typeof c !== "object") return sp;
  if (nn(c.headline)) sp.headline = partsOf(c.headline);
  sp.widgets = (Array.isArray(c.widgets) ? c.widgets : []).slice(0, CAPS.widgets).map((w) => {
    if (!w || typeof w !== "object") return w;
    const o = { id: w.id, level: w.level, short: w.short, title: partsOf(w.title), blocks: (w.blocks || []).map(blockOf), expand: (w.expand || []).map(blockOf), notes: (w.notes || []).map(partsOf) };
    if (nn(w.who)) o.who = w.who;
    if (nn(w.requires)) o.requires = w.requires;
    if (w.chip && typeof w.chip === "object") o.chip = { ref: w.chip.ref, fmt: w.chip.fmt, ...(nn(w.chip.tone) ? { tone: w.chip.tone } : {}) };
    return o;
  });
  sp.follow = (Array.isArray(c.follow) ? c.follow : []).map((q) => ({ q: typeof q === "string" ? q : q?.q }));
  return sp;
}

/** Ask the model to compose the page; returns the raw flat answer or null (offline, 429, timeout, bad answer). */
export async function composeCall(fx, lang, { url = COMPOSE_URL, ms = 40000, fetchFn } = {}) {
  const f = fetchFn || (typeof fetch === "function" ? fetch : null); if (!f) return null;
  const ctl = typeof AbortController === "function" ? new AbortController() : null, to = ctl ? setTimeout(() => ctl.abort(), ms) : null;
  try {
    const body = { mode: "compose", lang: lang === "nl" ? "nl" : "en", index: composeIndex(fx), examples: recipePage(fx) };
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
  const page = validatePage(toSpec(raw), fx);
  if (page.widgets.length < MIN_WIDGETS) return { page: recipes(), source: "recipes", dropped: [...page.dropped, { id: "compose", why: `only ${page.widgets.length} valid` }] };
  if (!page.follow.length) page.follow = recipes().follow;
  return { page, source: "ai", dropped: page.dropped };
}
