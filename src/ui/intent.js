// Architecture step 3: the UI talks to the game through the Action API (src/api/engine.js), here.
//
//   tap / key / button ──► intentFor(target, tool, prompt, legal) ──► Action ──► UiEngine.apply(action) ──► the game's own commit
//        ▲                                                                             │
//        └────────── spots(seat) / legal sets: the highlights are legalActions ◄───────┘
//
// The UI keeps only view state (selected tool, staged `confirmBuild`, the in-turn undo, trays, hover). Which spot is legal, and whether an action is
// allowed at all, is answered by the engine: `legalActions` for the highlights and for the hit-test predicates, `isLegal` for the reason a tap does
// nothing, `apply` for every committed move. No rule is rewritten: UiEngine runs the same commit methods the handlers always ran (_commitBuild,
// _commitSetup, _commitRobber, buyDevelopmentCard, playDevelopmentCard, performBankTrade, ...), so behaviour, animations, sounds, Undo and the
// Math.random order are the same as before.
import { Engine } from "../api/engine.js";
import { RESOURCES as RES } from "../core/constants.js";
import { cleanHand } from "../api/actions.js";

const PLACE = new Set(["build", "place"]);

/**
 * Pure: which of the legal actions does a tap mean?
 *   target  { node } | { edge } | { hex } | { button: { type, ...fields } }   (what the hit-test found; ids are engine ids)
 *   tool    the selected piece ("road" | "settlement" | "city" | "ship" | "moveShip" | "build" | null); a piece narrows build/place actions
 *   prompt  the actor's prompt (used for a button: it must be one of the prompt's answers)
 *   legal   engine.legalActions(seat) (finished actions only; descriptors with `choose` never match a board target)
 * Returns the matching actions: none (the caller shows `isLegal(...).reason`), one (the candidate), several (a picker: road or ship).
 */
export function intentFor(target, tool, prompt, legal) {
  if (!target) return [];
  const piece = tool && tool !== "build" ? tool : null;
  return legal.filter((a) => {
    if (a.choose) return false;
    if (target.button) return Object.entries(target.button).every(([k, v]) => (k === "resources" ? JSON.stringify([...(a[k] || [])].sort()) === JSON.stringify([...v].sort()) : a[k] === v));
    if (target.hex != null) return a.type === "moveRobber" && a.hex === target.hex;
    if (target.node != null) return PLACE.has(a.type) && a.node === target.node && (!piece || a.piece === piece);
    if (target.edge != null) {
      if (a.type === "moveShip") return piece === "moveShip" && a.to === target.edge;
      return PLACE.has(a.type) && a.edge === target.edge && (!piece || a.piece === piece);
    }
    return false;
  });
}

/** The legal board spots of a list of build / place actions, by piece: { settlement, city, road, ship } as Sets of node / edge ids. */
export function spotsOf(legal) {
  const S = { settlement: new Set(), city: new Set(), road: new Set(), ship: new Set() };
  for (const a of legal) if (PLACE.has(a.type) && S[a.piece]) S[a.piece].add(a.node ?? a.edge);
  return S;
}

const EMPTY = Object.freeze({ settlement: new Set(), city: new Set(), road: new Set(), ship: new Set() });

/** The engine the UI plays through: seats whose `isHuman` flag is set are decided by apply(); everything else keeps running as before. */
export class UiEngine extends Engine {
  constructor(g) {
    super(g, { noHooks: true });
    this._ui = null;
    this._onBehalf = null;
    this._offerSeq = 1000000; // the game's own offer ids (the card in the corner, Rush offers) stay below this
  }
  // one engine, one game object: nothing to park or restore, and the game's own methods stay untouched (no hooks)
  _enter() { return this; }
  controls(seat) { const p = this.g.players[seat]; return !!p && (!!p.isHuman || this._onBehalf === seat); }

  /** apply() for a human's tap, with UI-only context (`ui`: { victim } the robber's staged victim, ...). Never throws for a refusal. */
  dispatch(a, ui = null) {
    const prev = this._ui;
    this._ui = ui;
    try { return this.apply(a); } finally { this._ui = prev; }
  }
  /** A bot's answer carried out by the UI (a partner's yes to an offer the human then confirms): the same apply(), the bot as actor. */
  dispatchFor(seat, a, ui = null) {
    const prev = this._onBehalf;
    this._onBehalf = seat;
    try { return this.dispatch({ ...a, actor: seat }, ui); } finally { this._onBehalf = prev; }
  }

  /**
   * The prompts, plus one rule of the old UI the strict prompt model lacks: while Road Building's free roads or a Year of Plenty / Monopoly pick are
   * open the rest of the turn (buy, trade, end the turn) is still reachable, as it always was (the dock greys End turn out, the E key did not).
   */
  _prompts0() {
    const ps = super.prompts(), g = this.g, p0 = ps[0];
    if (p0 && (p0.kind === "freeRoad" || p0.kind === "yearOfPlenty" || p0.kind === "monopoly") && (g.phase === "main" || g.phase === "sbp")) ps.push({ kind: g.rush ? "rushAny" : g.phase === "sbp" ? "sbp" : "main", actor: p0.actor });
    return ps;
  }
  /** The prompt the seat holds right now, or null. */
  promptOf(seat) { return this.promptFor(seat); }
  /** legalActions of one action type for a seat (cheaper than all of them). */
  legalOfType(seat, type) {
    const pr = this.promptFor(seat);
    return pr ? this._legalOf(pr, type) : [];
  }
  /**
   * Highlights and hit-test predicates: the legal build / place spots of a seat as { settlement, city, road, ship } Sets of ids. It asks the engine
   * the question the screen is in: set-up (the settlement, or the roads / ships beside the new settlement), Road Building (`free`, roads and ships
   * only) or an ordinary turn. `free` overrides the game's own Road Building count (the Seafarers "does this corner take anything else" test).
   */
  spots(seat, o = {}) {
    const g = this.g;
    if (g.setupPhase) {
      if (g.setupAction === "settlement") return spotsOf(this._legalOf({ kind: "setupSettlement", actor: seat }, "place"));
      if (g.setupAction === "road" && g.lastSetupNodeId != null) return spotsOf(this._legalOf({ kind: "setupRoad", actor: seat, node: g.lastSetupNodeId }, "place"));
      return EMPTY;
    }
    const free = o.free ?? g.freeRoadsRemaining > 0;
    return spotsOf(this._legalOf({ kind: free ? "freeRoad" : "main", actor: seat }, "build"));
  }
  /** Seafarers: every legal ship move of a seat as { from, to } (an ordinary turn's or a Rush seat's prompt, whatever the seat holds now). */
  shipMoves(seat) {
    const g = this.g;
    return g.sea ? this._legalOf({ kind: g.rush ? "rushAny" : "main", actor: seat }, "moveShip").map((a) => ({ from: a.from, to: a.to })) : [];
  }
  /** The tiles the robber (Seafarers: or the pirate) may go to, as a Set of hex ids. */
  robberHexes(seat) { return new Set(this._legalOf({ kind: "moveRobber", actor: seat }, "moveRobber").map((a) => a.hex)); }
  /** Why this action is refused, in the words of the engine ("" when it is legal). */
  reasonFor(a) { const r = this.isLegal(a); return r.ok ? "" : r.reason; }

  // ── the commit methods are the UI's own (what the handlers ran before the API existed) ──
  _do_roll(a, p) { this.g._humanRollNow(p); }
  _do_buyDev(a, p) { this.g._humanBuyDevNow(p); }
  _do_playDev(a, p) { return this.g._humanPlayDevNow(p, a.card); }
  _do_tradeBank(a, p) { return this.g.performBankTrade(p, a.give, a.get); }
  _do_moveRobber(a, p) { this.g._commitRobber(p, a.hex, this._ui?.victim ?? null); }
  _do_steal(a, p) { this.g._humanStealNow(p, a.victim); }
  _do_pick(a, p) { this.g._humanPickNow(p, a); }
  _do_discard() { this.g._confirmDiscardNow(); }
  _do_ready(a, p) { this.g._humanReadyNow(p); }
  // trades: the engine keeps the open offer (one at a time: what the trade sheet shows), the bots' answers are the game's own evaluator
  _do_offerTrade(a, p) {
    const g = this.g, to = a.to === "all" ? g.players.filter((q) => q.id !== a.actor).map((q) => q.id) : [...new Set(a.to)];
    const o = { id: ++this._offerSeq, from: a.actor, to, give: cleanHand(a.give), want: cleanHand(a.want), answered: {} };
    this._offers = [o];
    g._humanOfferNow(p, { ...a.give }, { ...a.want }, o.id);
  }
  _do_respondTrade(a, p) {
    const g = this.g, ui = this._ui;
    if (ui?.incoming) return g._resolveIncomingNow(ui.incoming.accepted, ui.incoming.expired);
    if (ui?.swap) { this._offers = []; return g._playerTradeSwapNow(g.currentPlayer, ui.swap.partner, ui.swap.gave, ui.swap.got); }
    return super._do_respondTrade(a, p);
  }
  _do_endTurn(a, p) { this._offers = []; this.g._humanEndTurnNow(p); }
  hasOffer(id) { return this._offers.some((o) => o.id === id); }
  /** A bot's counter-offer to the human, as an open offer the human can accept; returns its id. */
  openCounter(counter, human) {
    const o = { id: ++this._offerSeq, from: counter.player.id, to: [human.id], give: cleanHand(counter.give), want: cleanHand(counter.want), answered: {}, counterOf: this._offers[0]?.id ?? null };
    this._offers.push(o);
    return o.id;
  }

  // an offer a bot made to the human (Classic: the card in the corner; the game keeps it in pendingIncomingTrade)
  prompts() {
    const ps = this._prompts0();
    const pit = this.g.pendingIncomingTrade;
    if (pit?.to && !this.g.rush) ps.push({ kind: "respondTrade", actor: pit.to.id, offer: pit.id, from: pit.fromPlayer.id, incoming: true });
    return ps;
  }
  _legalOf(prompt, only = null) {
    if (prompt.incoming) {
      if (only && only !== "respondTrade") return [];
      const pit = this.g.pendingIncomingTrade, p = this.g.players[prompt.actor], out = [];
      if (!pit) return out;
      if (RES.every((r) => (p.resources[r] || 0) >= (pit.want[r] || 0)) && RES.every((r) => (pit.fromPlayer.resources[r] || 0) >= (pit.give[r] || 0))) out.push({ actor: prompt.actor, type: "respondTrade", offer: pit.id, answer: "accept" });
      out.push({ actor: prompt.actor, type: "respondTrade", offer: pit.id, answer: "reject" });
      return out;
    }
    return super._legalOf(prompt, only);
  }
}

export function createUiEngine(game) { return new UiEngine(game); }
export { RES };
