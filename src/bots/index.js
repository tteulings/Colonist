// Binds the adapters to the registry: import this module (not just registry.js) when you want to PLAY a bot: createBot("expert").
import { listBots, setBotFactory } from "./registry.js";
import { legacyBot } from "./legacy.js";
import { searchBot } from "./search.js";
import "./inapp.js"; // (tells the recorders of a game that a probe is no move)

export * from "./registry.js";
export { createEngine } from "../api/engine.js";
export { runSync, runUntilHuman, hostStep, startLabGame, newHost, nextPrompt } from "./host.js";

listBots().forEach((e) => {
  const meta = { id: e.id, name: e.name, level: e.level, needs: e.needs };
  if (e.needs.sim) setBotFactory(e.id, (opts = {}) => searchBot(meta, { strategy: e.strategy, ...opts }));
  else setBotFactory(e.id, (opts = {}) => legacyBot(meta, { strategy: e.strategy, ...opts }));
});
// a hand-tuned mix of dials (the AI Lab's "custom mix"): the strategy decides which legacy planner runs
export function botForStrategy(strategy, opts = {}) {
  const e = listBots().find((x) => x.strategy.policy === strategy.policy && x.needs.sim) || null;
  const meta = { id: "custom", name: "Custom", level: 3, needs: {} };
  return e && opts.agent ? searchBot({ ...meta, id: e.id, needs: e.needs }, { strategy, ...opts }) : legacyBot(meta, { strategy });
}

import { startLabGame, runSync, newHost } from "./host.js";
/**
 * A lab game played by the host loop (ai-analysis.js `_labSimStart(strategies, { host: <this module>, ... })`): same seed, board, set-up and dials as the
 * legacy lab loop, and the same game to the move (tests/golden/run.mjs --host), but every decision is a Bot's `decide` judged by the engine.
 * `o.agents`: search agents per seat (Worker / golden harness). Returns { engine, bots, host, step(turns) -> { done, winner, turns } }.
 */
export function labSession(g, strategies, o = {}) {
  const engine = startLabGame(g, strategies, o);
  const list = Array.isArray(strategies) ? strategies : g.players.map((p) => p.strategy);
  const bots = list.map((st, i) => botForStrategy(st, o.agents?.[i] ? { agent: o.agents[i] } : {}));
  const host = newHost({ seed: o.seed });
  return { engine, bots, host, step: (turns) => { const r = runSync(engine, bots, { host, maxTurns: turns }); if (r.done) engine.release(); return { done: r.done, winner: r.winner, turns: r.turns }; } };
}
