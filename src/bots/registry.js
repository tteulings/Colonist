// The one list of bots (architecture step 4). Every place that offers, draws, ranks or builds a bot reads it: the new-game screen
// (game.js presets), the AI Lab pool, the Bots page and its profiles, the review's reference player. Data only: this module imports nothing
// from the game, so any of them can load it. The adapters that turn an entry into a playing Bot (src/bots/adapters.js) register their
// factories here; `createBot(id)` builds one.
//
//   interface Bot {
//     id, name, level, needs: { sim?, worker? }
//     init?(seat, setup, rng)                    per-game memory
//     decide(view, prompt, legal, ctx) -> Action | Promise<Action>      one of `legal` (the host checks isLegal, see host.js)
//   }
//
// Ids are the preset keys the app has always used (beginner, simple, intermediate, expert, trader, builder, shark, master, super, superplus,
// grandmaster): they are in saved games, lab results and profiles. `name` is the English text the i18n layer translates (tr(name)).

/** v1.39 Grandmaster is released; the kill switch for support: ?gm=0 or localStorage colonist.gm = "0" hides it again. */
export function gmFlag() {
  try { return !((typeof location !== "undefined" && /[?&]gm=0\b/.test(location.search || "")) || (typeof localStorage !== "undefined" && localStorage.getItem("colonist.gm") === "0")); } catch (_) { return true; }
}

const ENTRIES = new Map();   // id -> entry, in registration (= the app's AI_PRESETS) order
const FACTORIES = new Map(); // id -> (opts, entry) => Bot

/** Add a bot. `strategy` are the five dials (+ policy) the game keeps in player.strategy; `family`: heuristic | rules | search. */
export function registerBot(e) {
  if (!e || !e.id || ENTRIES.has(e.id)) throw new Error("registerBot: missing or duplicate id " + (e && e.id));
  ENTRIES.set(e.id, Object.freeze({ needs: {}, family: "heuristic", beyond: false, isNew: false, glyph: "", ...e, needs: Object.freeze({ ...(e.needs || {}) }), strategy: Object.freeze({ ...e.strategy }) }));
  return ENTRIES.get(e.id);
}
/** Bind the code that plays an entry (the adapters do this once). */
export function setBotFactory(id, fn) { if (!ENTRIES.has(id)) throw new Error("setBotFactory: unknown bot " + id); FACTORIES.set(id, fn); }

const visible = (e) => e.id !== "grandmaster" || gmFlag();
/** Metadata of one bot (or null). */
export const getBot = (id) => (ENTRIES.has(id) && visible(ENTRIES.get(id)) ? ENTRIES.get(id) : null);
/** All bots in the app's preset order, optionally filtered ({family, search: true|false, order: "page"}). The Grandmaster only while its flag is on. */
export function listBots(f = {}) {
  const out = [...ENTRIES.values()].filter(visible).filter((e) => (f.family == null || e.family === f.family) && (f.search == null || !!e.needs.sim === f.search));
  return f.order === "page" ? out.sort((a, b) => a.page - b.page) : out; // "page": the Bots page's own order (strongest first, by measured rank)
}
export const botIds = (f) => listBots(f).map((e) => e.id);
/** Preset dials by id ({beginner: {placement, ...}, ...}): what game.js calls AI_PRESETS. A fresh object whose keys are in preset order. */
export function presetStrategies() { const o = {}; listBots().forEach((e) => { o[e.id] = { ...e.strategy }; }); return o; }
/** { id: {label, tagline, glyph, isNew} } (game.js AI_PRESET_INFO) plus the "custom" entry of the pickers. */
export function presetInfo() {
  const o = {}; listBots().forEach((e) => { o[e.id] = { label: e.name, tagline: e.tagline, glyph: e.glyph, ...(e.isNew ? { isNew: true } : {}) }; });
  o.custom = { label: "Custom", tagline: "your mix", glyph: "" };
  return o;
}
/** The reference player of the review and its Monte Carlo (what "a good player" does in a position): the Hard bot, the best one without a search. */
export const REFERENCE_BOT = "expert";
/** Dials of the reference player (a fresh copy). */
export const referenceStrategy = () => ({ ...ENTRIES.get(REFERENCE_BOT).strategy });
/** The search bots (Master, Super Expert, ...): the ones that think in a worker and are slow in the AI Lab. */
export const isSearchBot = (id) => !!ENTRIES.get(id)?.needs.sim;
/** Strongest first by `level` (a stable order; the pickers sort by measured win chance, bot-stats.js byStrength). */
export const byLevel = (ids = botIds()) => ids.slice().sort((a, b) => (ENTRIES.get(b)?.level ?? 0) - (ENTRIES.get(a)?.level ?? 0) || ids.indexOf(a) - ids.indexOf(b));
/** The profile text/figures of bot-profiles.js attach here as metadata. */
const PROFILES = new Map();
export function attachProfiles(P) { Object.keys(P).forEach((id) => PROFILES.set(id, P[id])); }
/** The profile (text, strength figures) of a bot, once bot-profiles.js is loaded; null otherwise. */
export const profileFor = (id) => PROFILES.get(id) || null;

/** Build a playing Bot: createBot("expert"), createBot("master", {n: 100}). opts are passed to the adapter. */
export function createBot(id, opts = {}) {
  const e = getBot(id);
  if (!e) throw new Error("unknown bot " + id);
  const f = FACTORIES.get(id);
  if (!f) throw new Error(`bot ${id} has no player bound: import src/bots/index.js`);
  return f(opts, e);
}

const D = (placement, expansion, trading, devCards, awareness, policy) => ({ placement, expansion, trading, devCards, awareness, ...(policy ? { policy } : {}) });
// v0.87 "simple": a rulebook bot (src/ai-rules.js), policy "rules" (its dials are only what the new-game screen shows)
registerBot({ id: "beginner", page: 9, name: "Easy", tagline: "gentle, learns rules", level: 2, strategy: D("simple", "simple", "conservative", "reactive", "none") });
registerBot({ id: "simple", page: 10, name: "Simple", tagline: "plays by 7 rules", level: 1, isNew: true, family: "rules", strategy: D("simple", "simple", "conservative", "reactive", "none", "rules") });
registerBot({ id: "intermediate", page: 8, name: "Medium", tagline: "solid all-rounder", level: 3, strategy: D("medium", "medium", "balanced", "reactive", "basic") });
registerBot({ id: "expert", page: 4, name: "Hard", tagline: "plays to win", level: 4, strategy: D("complex", "complex", "balanced", "strategic", "advanced") });
registerBot({ id: "trader", page: 6, name: "Trader", tagline: "deals all game", level: 3, glyph: "⇄", isNew: true, strategy: D("medium", "medium", "aggressive", "reactive", "basic") });
registerBot({ id: "builder", page: 5, name: "Builder", tagline: "roads & cities", level: 4, glyph: "⚒", isNew: true, strategy: D("complex", "complex", "balanced", "reactive", "basic") });
registerBot({ id: "shark", page: 7, name: "Shark", tagline: "hunts the leader", level: 3, glyph: "▲", isNew: true, strategy: D("medium", "medium", "balanced", "strategic", "advanced") });
// v0.90: the Expert plus a search over its options (src/master.js, src/master/); opt-in, never a default
registerBot({ id: "master", page: 3, name: "Master", tagline: "Hard + looks ahead", level: 5, glyph: "★", isNew: true, family: "search", needs: { sim: true, worker: true }, strategy: D("complex", "complex", "balanced", "strategic", "advanced", "master") });
// v1.10: the Master's search with ten times the thinking (up to 1000 rollouts, 14 turns deep, ~3 s a move)
registerBot({ id: "super", page: 2, name: "Super Expert", tagline: "Master with 10x more thinking", level: 5, beyond: true, glyph: "★★", isNew: true, family: "search", needs: { sim: true, worker: true }, strategy: D("complex", "complex", "balanced", "strategic", "advanced", "super") });
// bot-125: the Super Expert's search, scored at the end of every playout by the boosted value model (leaf "gbm")
registerBot({ id: "superplus", page: 1, name: "Super Expert+", tagline: "Super Expert with a learned eye", level: 5, beyond: true, glyph: "★★+", isNew: true, family: "search", needs: { sim: true, worker: true }, strategy: D("complex", "complex", "balanced", "strategic", "advanced", "superplus") });
// eng-130 "Grandmaster": the Super Expert+ search on several cores at once (src/master/parallel.js)
registerBot({ id: "grandmaster", page: 0, name: "Grandmaster", tagline: "Super Expert+ on every core", level: 5, beyond: true, glyph: "★★★", isNew: true, family: "search", needs: { sim: true, worker: true }, strategy: D("complex", "complex", "balanced", "strategic", "advanced", "grandmaster") });
