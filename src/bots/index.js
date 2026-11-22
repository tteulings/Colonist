// Binds the adapters to the registry: import this module (not just registry.js) when you want to PLAY a bot: createBot("expert").
import { listBots, setBotFactory } from "./registry.js";
import { legacyBot } from "./legacy.js";
import { searchBot } from "./search.js";

export * from "./registry.js";
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
