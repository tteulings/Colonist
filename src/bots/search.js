// Master / Super Expert / Super Expert+ / Grandmaster as Bots (design 4.2): the Expert's planner plus a search over its options. `decide` for the
// searched prompts (set-up spot, robber tile, main-phase step) asks the search agent (master/search.js makeMaster, the one the worker runs);
// every other prompt (discard, steals, picks, deals, the roll) stays with the Expert, exactly as the legacy `agent.mainPhase / setupNode /
// robberHex` hooks did. The agent runs its own playouts on the game object, so the engine's seat control is suspended around it.
//
// The agent is `opts.agent` (a ready makeMaster agent: the golden harness hands in counted budgets) or built from the budget of the bot's policy
// (master.js budgetFor). A Grandmaster fans its futures out over workers (parallel.js) in the browser; in Node and in the lab sim it is the same
// search as the Super Expert+ on one core, which is what the golden games pin.
import { legacyBot, DEALS, dealKey } from "./legacy.js";
import { probe, suspended } from "./probe.js";
import { makeMaster } from "../master/search.js";
import { budgetFor } from "../master.js";

export function searchBot(meta, { strategy = null, agent = null, rush = false, sea = false } = {}) {
  const A = agent || makeMaster(budgetFor(meta.id, rush, sea));
  const base = legacyBot(meta, { strategy });
  const memo = new Map();
  const state = (seat) => { let m = memo.get(seat); if (!m) memo.set(seat, (m = { queue: [], trade: false, steps: 0 })); return m; };
  const bot = {
    ...base, agent: A, legacy: true,
    decide(view, prompt, legal, ctx) {
      const g = ctx.game, seat = prompt.actor, p = g.players[seat];
      switch (prompt.kind) {
        case "setupSettlement": {
          const n = suspended(g, () => A.setupNode(g, p, g._masterBaseInit || ((pp) => g.getBestInitialSettlementNode(pp))));
          return n == null ? null : { actor: seat, type: "place", piece: "settlement", node: n };
        }
        case "moveRobber": {
          const hex = suspended(g, () => A.robberHex(g, p));
          if (g._stealVictims(hex, p).length === 1) Math.random(); // the legacy move's one-victim draw (see legacy.js)
          const a = { actor: seat, type: "moveRobber", hex }; if (g.sea) a.target = g._seaHexKind(hex); return a;
        }
        case "main": return mainStep(g, p, ctx);
        case "endTurnDone": return null;
        default: return base.decide(view, prompt, legal, ctx);
      }
    },
  };
  function mainStep(g, p, ctx) {
    const seat = p.id, m = state(seat);
    const done = () => { memo.delete(seat); base.init(seat); return { actor: seat, type: "endTurn" }; };
    for (let guard = 0; guard < 64; guard++) {
      while (m.queue.length) {
        const a = m.queue.shift();
        if (ctx.isLegal(a)) { g.__noTrk = a.type !== "playDev"; if (a.type === "offerTrade") DEALS.add(dealKey(a.actor, a.to[0], a.give, a.want)); return a; }
        ctx.warn(`plan queue: ${JSON.stringify(a)} no longer legal`);
        m.queue.length = 0;
      }
      if (g.winner) return done();
      if (!m.trade) { // the Expert's own deal first (mainPhase: g.aiTryPlayerTrade(p))
        m.trade = true;
        const r = probe(g, () => g.aiTryPlayerTrade(p), { eager: true, suspend: true });
        if (r.actions.length) { m.queue = r.actions; continue; }
      }
      if (m.steps >= 12) return done();
      m.steps++;
      const d = suspended(g, () => A.decideMain(g, p));
      if (!d) { // nothing to choose between: the Expert's step
        const r = probe(g, () => g._aiPlannedStep(p));
        if (!r.result) return done();
        m.queue = r.actions; continue;
      }
      if (d.choice.kind === "end") return done();
      const r = probe(g, () => A.applyMain(g, p, d.choice)); // engine seat control stays on: a card opens its prompts instead of playing itself out
      if (r.result === false || r.result === "noop") return done();
      m.queue = r.actions;
    }
    return done();
  }
  return bot;
}
