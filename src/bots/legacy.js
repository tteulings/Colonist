// The legacy bots as Bots (design 4.2, phase 1): heuristic presets (beginner ... expert, trader, builder, shark), the rulebook bot (Simple)
// and, for a search bot without a search (Master & co when no search is attached), the Expert it falls back to. One adapter: the dials in
// player.strategy decide which legacy planner runs; Seafarers and 5-6 players use the same planners through their own hooks
// (g.sea.aiSetupPiece / aiGoldPicks / chooseThiefHex, g._aiSbpPlannedStep).
//
// decide(view, prompt, legal, ctx) answers ONE prompt. Quick prompts (set-up spot, robber tile, victim, discard, picks, gold) call the legacy
// decider directly. The main phase is a plan: each planner step is probed (probe.js), its actions queue up, and the queue is played one
// action per call, each re-judged by ctx.isLegal before it is returned. Phase 1 plays against ctx.game, the one legacy game object (so it
// declares view:false, legal:false: the host does not build a redacted view or enumerate the legal set for it).
import { probe, suspended } from "./probe.js";
import { isRulesBot } from "../ai-rules.js";

const DEALS = new Set(); // deals a planner agreed with its partner and queued: "from:to:give:want"
const dealKey = (from, to, give, want) => `${from}:${to}:${JSON.stringify(give)}:${JSON.stringify(want)}`;
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const AI_SBP_MAX = 4; // six.js AI_SBP_MAX_ACTIONS

export { DEALS, dealKey };
export function legacyBot(meta, { strategy = null } = {}) {
  const memo = new Map(); // seat -> this turn's plan state
  const state = (seat) => { let m = memo.get(seat); if (!m) memo.set(seat, (m = { queue: [], stage: 0, actions: 0, deals: 0, fns: null, knight: false, sbp: 0 })); return m; };
  const fresh = (seat) => memo.delete(seat);
  const bot = {
    ...meta, view: false, legal: false, legacy: true,
    init(seat, setup) { fresh(seat); const g = setup?.game; if (g && strategy) g.players[seat].strategy = { ...strategy }; },
    decide(view, prompt, legal, ctx) {
      const g = ctx.game, seat = prompt.actor, p = g.players[seat];
      const A = (o) => ({ actor: seat, ...o });
      switch (prompt.kind) {
        case "setupSettlement": { const n = g.getBestInitialSettlementNode(p); return n == null ? null : A({ type: "place", piece: "settlement", node: n }); }
        case "setupRoad": {
          if (g.sea) { const pc = g.sea.aiSetupPiece(p, prompt.node); return pc ? A({ type: "place", piece: pc.type, edge: pc.id }) : null; }
          const e = g.getBestRoadFromNode(p, prompt.node, null);
          return e == null ? null : A({ type: "place", piece: "road", edge: e });
        }
        case "preRoll": {
          const m = state(seat);
          if (!m.knight) { m.knight = true; const r = probe(g, () => g.maybePlayKnightBeforeRoll(p)); if (r.actions[0]?.type === "playDev") return r.actions[0]; }
          return A({ type: "roll" });
        }
        case "main": return mainStep(g, p, ctx);
        case "sbp": return sbpStep(g, p, ctx);
        case "discard": return A({ type: "discard", cards: discardOf(g, p, prompt.count) });
        case "moveRobber": {
          const hex = g.chooseRobberHex(p);
          // the legacy robber move draws one random number to pick the victim even when there is only one (_aiChooseVictim): keep the stream aligned
          if (!isRulesBot(p) && g._stealVictims(hex, p).length === 1) Math.random();
          const a = A({ type: "moveRobber", hex }); if (g.sea) a.target = g._seaHexKind(hex); return a;
        }
        case "steal": return A({ type: "steal", victim: g._aiChooseVictim(p, prompt.victims) });
        case "yearOfPlenty": return A({ type: "pick", resources: g.chooseYearOfPlentyResources(p).slice(0, prompt.count ?? 2) });
        case "monopoly": return A({ type: "pick", resource: g.chooseBestMonopolyResource(p) });
        case "freeRoad": {
          if (g.sea) { const pc = g.sea.aiFreePiece(p); return pc ? A({ type: "build", piece: pc.type, edge: pc.id }) : A({ type: "skipFree" }); }
          const e = g.chooseStrategicRoadEdge(p, true);
          return e == null ? A({ type: "skipFree" }) : A({ type: "build", piece: "road", edge: e });
        }
        case "chooseGold": return A({ type: "pickGold", resources: g.sea.aiGoldPicks(p, prompt.count) });
        case "respondTrade": {
          const o = ctx.engine._offers.find((x) => x.id === prompt.offer);
          if (!o) return A({ type: "respondTrade", offer: prompt.offer, answer: "reject" });
          const from = g.players[o.from], key = dealKey(o.from, seat, o.give, o.want);
          const planned = DEALS.delete(key); // the proposer's planner already asked this partner (and the tracker already knows): the answer was yes
          const ok = RES.every((r) => p.resources[r] >= (o.want[r] || 0) && from.resources[r] >= (o.give[r] || 0)) && (planned || g._aiTradeVerdict(p, o.give, o.want, from).ok);
          return A({ type: "respondTrade", offer: o.id, answer: ok ? "accept" : "reject" });
        }
        default: return null;
      }
    },
  };

  /** the cards a bot hands back after a 7: _autoDiscard decides and pays; ask it on a probe and read the payment off the hand */
  function discardOf(g, p, count) {
    const before = { ...p.resources };
    const r = probe(g, () => { g._autoDiscard(p, count); return { ...p.resources }; }, { eager: true });
    const cards = {}; RES.forEach((k) => { const d = before[k] - r.result[k]; if (d) cards[k] = d; });
    g.__noTrk = true; // payToBank in the probe has noted the discard already
    return cards;
  }

  /** the next queued action, if it is still legal. A planner step has already been carried out in its probe (its tracker notes included): flag the
   *  apply so the engine does not note it twice; a card is the exception (the probe only opened it, the prompts that follow do the work). */
  function takeQueued(g, m, ctx) {
    while (m.queue.length) {
      const a = m.queue.shift();
      if (ctx.isLegal(a)) { g.__noTrk = a.type !== "playDev"; if (a.type === "offerTrade") DEALS.add(dealKey(a.actor, a.to[0], a.give, a.want)); return a; }
      ctx.warn(`plan queue: ${JSON.stringify(a)} no longer legal, planning again`);
      m.queue.length = 0;
    }
    return null;
  }

  function mainStep(g, p, ctx) {
    const seat = p.id, m = state(seat);
    const done = () => { fresh(seat); return { actor: seat, type: "endTurn" }; };
    for (let guard = 0; guard < 64; guard++) {
      const next = takeQueued(g, m, ctx);
      if (next) return next;
      if (g.winner) return done();
      if (!m.fns) m.fns = g._getActionPriority(p);
      if (m.stage === 0) { // a card first
        m.stage = 1;
        const r = probe(g, () => g.maybePlayBestDevCard(p));
        if (r.actions.length) { m.queue = r.actions; continue; }
      }
      if (m.stage === 1) { // then one deal with the other bots
        m.stage = 2;
        const r = probe(g, () => g.aiTryPlayerTrade(p), { eager: true, suspend: true });
        if (r.actions.length) { m.queue = r.actions; continue; }
      }
      if (m.actions < 10) {
        let acted = false;
        for (const fn of m.fns) {
          const r = probe(g, fn);
          if (!r.result) continue;
          m.actions++; acted = true;
          if (!r.actions.length) ctx.warn("a planner step changed the game without an action (not recorded)");
          m.queue = r.actions;
          break;
        }
        if (acted) continue;
      }
      if (m.deals < 2 && g._aiStrat(p).trading === "aggressive") { // aggressive traders keep dealing with the bots after building (up to 2 more)
        m.deals++;
        const r = probe(g, () => g.aiTryPlayerTrade(p, { botsOnly: true }), { eager: true, suspend: true });
        if (r.result?.type === "done" && r.actions.length) { m.queue = r.actions; continue; }
      }
      return done();
    }
    return done();
  }


  // 5-6 players: the build window. One planned step at a time, at most AI_SBP_MAX of them, then pass.
  function sbpStep(g, p, ctx) {
    const seat = p.id, m = state(seat);
    const q = takeQueued(g, m, ctx);
    if (q) return q;
    if (m.sbp < AI_SBP_MAX && !g.winner) {
      const s = g._aiStrat(p);
      const r = probe(g, () => (s.expansion === "simple" ? g._aiSbpSimpleStep(p, s) : g._aiSbpPlannedStep(p)));
      if (r.result && r.actions.length) { m.sbp++; m.queue = r.actions; return takeQueued(g, m, ctx); }
    }
    fresh(seat);
    return { actor: seat, type: "passSbp" };
  }
  return bot;
}
