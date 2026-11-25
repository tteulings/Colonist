// The bot host loop (design 4.2 / architecture step 4): one loop that plays every bot seat of an engine until a person (a seat with no bot)
// has to decide, or the game is over. It replaces, for headless and lab play, the legacy drivers (_labSimStep / executeRollPhase /
// executeAiMainPhase / the Master's mainPhase): every move is a bot's `decide(view, prompt, legal, ctx)` answer, judged by the engine
// (isLegal) and then applied (apply). An illegal answer never reaches the game: the host plays the first legal action instead and
// reports it (opts.onError / host.errors), so a buggy bot cannot stall or corrupt a game.
//
//   const engine = startLabGame(g, strategies, { seed, map, agents });        // a seeded, set-up game with every seat under the engine
//   const bots = botsFor(strategies, { agents });                              // one Bot per seat (registry, adapters)
//   const r = runSync(engine, bots);                                           // { done, winner, turns, errors }   (async bots: await runUntilHuman)
//
// Both runners take `pace(action)` (UI delay between bot moves; headless: none).
import { createEngine } from "../api/engine.js";
import { mulberry32 } from "../master/sim.js";
import { probeHooks } from "./probe.js";

const TURN_LIMIT = 250; // the lab sim's cut-off (ai-analysis.js _labSimStep): a game still running after this many turns is "no winner"

/** Which prompt a bot answers next: an open offer first (the deal is one move), then the first prompt a bot owns. null: nobody is a bot, or the game is over. */
export function nextPrompt(engine, bots) {
  const ps = engine.prompts();
  let first = null;
  for (const p of ps) {
    if (!bots[p.actor]) continue;
    if (p.kind === "respondTrade") return p;
    if (!first) first = p;
  }
  return first;
}

const NOBUDGET = { ms: Infinity, nodes: Infinity, deadline: Infinity, spent: () => 0 };
// v1.99: one ctx object per host and engine, its seat / prompt / rng refreshed for every decision (a decision is over before the next begins; nothing keeps a ctx)
function makeCtx(engine, host, bot, prompt) {
  let c = host.ctx;
  if (!c || c.engine !== engine) {
    c = host.ctx = {
      game: engine.g, engine, seat: 0, prompt: null,
      adoptOk: !host.events, // a quiet headless host lets the probe's move stand (probe.js adopt); with events the apply must run it (the events need the position before)
      adopt: (a) => { host.adopted = a; },
      isLegal: (a) => { if (host.adopted === a) return true; const pr = c.prompt, ok = engine.isLegal(a, { prompt: pr }).ok; host.judged = ok ? a : null; host.judgedPrompt = pr; return ok; }, // finish() does not judge the same answer a second time
      enumerate: (max = 200) => engine.enumerate(c.prompt.actor, { prompt: c.prompt, max }), // concrete legal actions (the `legal` list holds descriptors for discards, offers, ...)
      warn: (m) => host.errors.push({ seat: c.prompt.actor, prompt: c.prompt.kind, warn: m }),
      rng: null, note() {}, sim: null, signal: null, humanTrade: false, budget: NOBUDGET,
    };
  }
  c.seat = prompt.actor; c.prompt = prompt; c.rng = host.rng(prompt.actor); c.signal = host.signal; c.humanTrade = !!host.humanTrade;
  return c;
}

/** One decision: ask the bot, judge the answer, apply it. Returns the action applied, a Promise of it (async bot), or null (nothing to decide). */
export function hostStep(engine, bots, host) {
  const prompt = nextPrompt(engine, bots);
  if (!prompt) return null;
  const bot = bots[prompt.actor];
  const ctx = makeCtx(engine, host, bot, prompt);
  const view = bot.view === false ? null : engine.view(prompt.actor);
  const legal = bot.legal === false ? null : engine.legalActions(prompt.actor, prompt);
  const answer = bot.decide(view, prompt, legal, ctx);
  if (answer && typeof answer.then === "function") return answer.then((a) => finish(engine, host, prompt, a));
  return finish(engine, host, prompt, answer);
}

function finish(engine, host, prompt, action) {
  if (action && action.type === "pause" && host.humanTrade) return action; // the in-app host: a person has to answer first (bots/inapp.js)
  let a = action, why = null;
  const adopted = !!a && host.adopted === a; host.adopted = null; // the probe has played this very action on the live game already (judged by the planner's own rules)
  if (!a) why = "no answer";
  else if (adopted) { /* judged when it was played */ }
  else if (host.judged === a && host.judgedPrompt === prompt) { /* the bot asked ctx.isLegal about this very action a moment ago: nothing has changed since */ }
  else { const j = engine.isLegal(a, { prompt }); if (!j.ok) why = j.reason; }
  host.judged = null; host.judgedPrompt = null;
  if (why && host.strict) throw Object.assign(new Error(`host: seat ${prompt.actor} answered illegally under ${prompt.kind} (${why})`), { hostFallback: true }); // in the app: the old driver plays the phase instead
  if (why) { // a buggy or stuck bot: the first legal action, and a record of it
    host.errors.push({ seat: prompt.actor, prompt: prompt.kind, action: a, reason: why });
    a = engine.enumerate(prompt.actor, { prompt, max: 1 })[0];
    if (!a) throw new Error(`host: seat ${prompt.actor} has no legal action under ${prompt.kind} (${why})`);
  }
  let r; try { r = engine.apply(a, { trusted: true, quiet: !host.events, adopted }); if (adopted && probeHooks.verify?.pending?.a === a) probeHooks.verify.check(engine, a, { trusted: true, quiet: !host.events }); } finally { engine.g.__noTrk = false; }
  if (!r.ok) throw new Error(`host: the engine refused a judged-legal ${a.type}: ${r.reason}`);
  host.steps++;
  if (a.type === "endTurn") host.turns++;
  host.onAction?.(a, prompt, r);
  return a;
}

export function newHost(opts = {}) {
  const rngs = new Map();
  return { errors: [], judged: null, judgedPrompt: null, adopted: null, ctx: null, steps: 0, turns: 0, events: !!opts.onEvent, humanTrade: !!opts.humanTrade, strict: !!opts.strict, onAction: opts.onAction || null, signal: opts.signal || null,
    rng: (seat) => { let r = rngs.get(seat); if (!r) rngs.set(seat, (r = mulberry32((opts.seed ?? 1) * 7919 + seat))); return r; } };
}

const over = (engine) => engine.winner() != null || engine.g.turn > TURN_LIMIT;
const result = (engine, host, done) => ({ done, winner: engine.winner(), turns: engine.g.turn, steps: host.steps, errors: host.errors });

/** Synchronous host loop for bots that answer at once (every adapter but a worker-backed search). Stops at a person's prompt, a win, or `maxTurns` more turns. */
export function runSync(engine, bots, opts = {}) {
  const host = opts.host || newHost(opts), t0 = host.turns;
  while (!over(engine) && !(opts.maxTurns && host.turns - t0 >= opts.maxTurns) && !opts.until?.(engine)) {
    const a = hostStep(engine, bots, host);
    if (a === null) break;
    if (typeof a.then === "function") throw new Error("runSync: a bot answered asynchronously; use runUntilHuman");
  }
  return result(engine, host, over(engine));
}

/** The full host loop of the design: awaits async bots (Master/Super/Grandmaster in a worker), paces the UI. */
export async function runUntilHuman(engine, bots, opts = {}) {
  const host = opts.host || newHost(opts);
  while (!over(engine) && !opts.until?.(engine)) {
    if (opts.signal?.aborted) break;
    const a = hostStep(engine, bots, host);
    if (a === null) break;
    const done = await a;
    if (opts.pace) await opts.pace(done);
  }
  return result(engine, host, over(engine));
}

/**
 * Start a seeded all-bot game for the host (what ai-analysis.js _labSimStart does for the legacy loop): the same seed, settings, per-seat
 * dials and set-up, but every seat is decided through the engine. `o`: { seed, players, map }. Returns the engine (g is engine.g).
 */
export function startLabGame(g, strategies, o = {}) {
  if (o.seed != null) Math.random = mulberry32(Number(o.seed) >>> 0);
  g.settings = g._labSettings(o);
  g.onboardingHold = true;
  g.resetGame();
  const I = g.constructor.labHelpers.AI_PRESETS.intermediate;
  g.players.forEach((p, i) => { p.isHuman = false; p.strategy = Array.isArray(strategies) ? { ...(strategies[i] || I) } : i === 0 ? { ...strategies } : { ...I }; p.agent = null; });
  g.onboardingHold = false;
  if (g.setupPhase) g.setupAction = null;
  const e = createEngine(g, { meta: { host: true, seed: o.seed ?? null } });
  e.legacyBotOrder = true; // the old bots' order of play for the rest (set-up scores, roll, trades, stats events: see engine.js); scoring and winning are the same as for a person
  return e.takeControl("all");
}
