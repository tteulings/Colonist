// Action API (architecture step 2): `createEngine(game)` is a facade over the existing ColonistFullGame. It answers four questions without
// the caller touching a game field:
//
//   prompt() / prompts()  who has to decide what, now                               (derived from the game's own fields)
//   legalActions(seat)    every action that seat may take                           (calls canBuild*, canPlayDevelopmentCard, ...)
//   isLegal(action)       {ok} | {ok:false, reason}
//   apply(action)         do it, report events                                      (calls _commitBuild, playDevelopmentCard, endTurn, ...)
//   view(seat)            the position as that seat may see it (hidden cards redacted)
//   clone()               an independent engine value, built on master/sim.js snapshot/restore
//
// No rule is rewritten: legality and effects are the old methods. What is new is only the glue the UI used to own (which prompt follows which,
// how a 7 sequences discards -> robber -> steal) and the JSON surface. Notes on what could not be expressed without touching the rules are at
// the bottom of this comment block.
//
// Two ways to use it
//   * Driven: `newGame(game, spec)` / `engine.takeControl()`: the engine's seats are decided only through apply(); nothing plays by itself
//     (no bots, no timers). This is the mode for UI intents, user bots, replays and Monte Carlo.
//   * Observed: leave the game's own bots running and `engine.observe(cb)`: every move a bot makes is reported as an action, with the
//     prompt it was made under and whether it is legal, then recorded in engine.log(). This is how the API is checked against the old code.
//
// Randomness. The game's chance is `Math.random` in three places: the dice (rollDice), the card a steal takes (_doSteal), the board / deck
// shuffles at set-up. The development deck is a hidden permutation fixed at set-up, so a draw is `pop()`, not a random call. The engine
// exposes the dice and the steal as an injectable ChanceSource ({ dice(), steal({hand}) }, both optional); with none set nothing changes (not
// one Math.random call is added or moved). Forcing a roll leaves the dice-deck modes' deck untouched. A seed is the caller's business:
// `newGame` seeds the global Math.random exactly as the AI Lab sim does, so the same seed makes the same board.
//
// What needed more than a facade (see tests/api201.js and the step-2 report):
//   * Rush's clock (the roll timer, the 7 stages, bot ticks, offer expiry) lives in timers inside the class. Seat actions (build, buyDev,
//     playDev, tradeBank, ready) work and are checked against the bots; the roll itself and the 7 stage are not actions here (`tick` is
//     listed in the catalogue, not applied) and a Rush game cannot be cloned or replayed. Needs the clock to become state (step 5-7).
//   * Offers: the class has no offer object outside Rush (the trade sheet asks every bot at once and the human taps a name). The engine keeps
//     its own offer list; a bot seat that is not controlled answers by aiEvaluateTrade at once.
//   * Discards in a 7 are asked one seat at a time, in seat order (the class does the same); simultaneous discards would need a rewrite.
//   * Which cards a steal robbed and the dev card a buy drew are chance outcomes and appear in the log; the engine cannot "choose" them.
import { snapshot, restore, mulberry32 } from "../master/sim.js";
import { RESOURCES as RES, DEV_CARD_TYPES, DEV_DECK, BIG_DEV_DECK, COSTS } from "../core/constants.js";
import { Seafarers } from "../seafarers/rules.js";
import { PROMPTS, validateShape, actionKey, cleanHand, handSize, emptyHand } from "./actions.js";

const sum = (h) => RES.reduce((n, r) => n + (h[r] || 0), 0);
const has = (hand, cost) => RES.every((r) => (hand[r] || 0) >= (cost[r] || 0));
const copy = (h) => ({ ...h });
const devSum = (h) => DEV_CARD_TYPES.reduce((n, t) => n + (h[t] || 0), 0);
const refuse = (reason) => ({ ok: false, reason, events: [], prompts: [] });
const keyOf = actionKey;

// ── hooks on the live game object (installed once; inert unless an engine is active) ──────────────────────────────────────────────────
function hooks(g) {
  if (g.__api) return g.__api;
  const H = (g.__api = { active: null, later0: undefined, laterSaved: false });
  const rollDice0 = g.rollDice;
  g.rollDice = function () {
    const e = H.active, f = e && e._diceSource();
    let r;
    if (f) { const d = f(); r = { total: d[0] + d[1], d1: d[0], d2: d[1] }; this.lastDiceTotal = r.total; } else r = rollDice0.call(this);
    if (e) e._note({ node: "dice", outcome: [r.d1, r.d2] });
    return r;
  };
  const doSteal0 = g._doSteal;
  g._doSteal = function (cur, victimId) {
    const e = H.active, victim = this.players[victimId], before = e ? copy(victim.resources) : null;
    const f = e && e._stealSource();
    const avail = RES.filter((r) => victim.resources[r] > 0);
    if (f && avail.length) {
      const want = f({ thief: cur.id, victim: victimId, hand: copy(victim.resources) });
      if (!avail.includes(want)) throw new Error(`chance: victim ${victimId} holds no ${want}`);
      let cum = 0; for (const r of avail) { if (r === want) break; cum += victim.resources[r]; }
      const u = (cum + victim.resources[want] / 2) / sum(victim.resources); // chooseRandomWeighted lands on `want` for exactly this draw
      const saved = Math.random; Math.random = () => u;
      try { doSteal0.call(this, cur, victimId); } finally { Math.random = saved; }
    } else doSteal0.call(this, cur, victimId);
    if (e) { const r = RES.find((x) => victim.resources[x] < before[x]); if (r) e._note({ node: "steal", outcome: r }); }
  };
  const interactive0 = g._isInteractive;
  g._isInteractive = function (p) { const e = H.active; return (!!e && e.controls(p.id)) || interactive0.call(this, p); };
  const resolveRobber0 = g.resolveRobber;
  g.resolveRobber = function (cur, reason) {
    const e = H.active;
    if (e && e.controls(cur.id)) { e._resolveSeven(cur, reason); return Promise.resolve(); }
    return resolveRobber0.call(this, cur, reason);
  };
  return H;
}

const boardCache = new WeakMap();
/** Immutable board data (shared by every view and clone of a game). */
function boardOf(g) {
  const geo = g.geometry;
  let b = boardCache.get(geo);
  if (!b) {
    b = Object.freeze({
      hexes: geo.hexes.map((h) => ({ id: h.id, resource: h.resource, number: h.number ?? null, nodes: [...h.nodes], edges: [...(h.edges || [])] })),
      nodes: geo.nodes.map((n) => ({ id: n.id, neighbors: [...n.neighbors], edgeIds: [...n.edgeIds], hexes: [...n.adjacentHexes], ports: [...(n.ports || [])] })),
      edges: geo.edges.map((e) => ({ id: e.id, nodes: [...e.nodes], hexes: [...(e.hexIds || [])] })),
    });
    boardCache.set(geo, b);
  }
  return b;
}

// small non-cryptographic hash (works in a browser and in Node), 53 bits as hex
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** A JSON-clean copy of an action (what JSON.parse(JSON.stringify(a)) gave): one level of arrays / hands is all an action ever nests. */
function cloneAction(a) {
  const c = {};
  for (const k in a) {
    const v = a[k];
    if (v === undefined) continue;
    c[k] = v === null || typeof v !== "object" ? v : Array.isArray(v) ? v.slice() : { ...v };
  }
  return c;
}

export class Engine {
  constructor(g, opts = {}) {
    this.g = g;
    this.H = opts.noHooks ? { active: this, later0: undefined, laterSaved: false } : hooks(g); // noHooks: the UI's engine (src/ui/intent.js) leaves the game's methods alone
    this.meta = opts.meta || null;           // how the game was made (newGame spec): the first line of a log
    this._control = opts.control ? new Set(opts.control) : new Set();
    this._src = { dice: null, steal: null }; // user ChanceSource
    this._queue = null;                       // one apply()'s forced chance
    this._offers = []; this._offerSeq = 0;
    this._log = [];                           // [{ a, chance }]
    this._evlog = []; this._seq = 0; this._applying = 0; this._via = null;
    this._snap = null;                        // state parked while another engine uses the same game object
    this._obs = null;
    if (!opts.parked && !opts.noHooks) { const H = this.H; if (H.active && H.active !== this && !H.active._dead) H.active._snap = H.active._save(); H.active = this; }
  }

  // ── plumbing ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Make this engine the one the game object currently shows (clones share one object; switching costs one snapshot + one restore). */
  _enter() {
    const H = this.H;
    if (H.active === this) return this;
    if (H.active && !H.active._dead) H.active._snap = H.active._save();
    H.active = this;
    if (this._snap) { this._load(this._snap); this._snap = null; }
    return this;
  }
  _save() {
    const g = this.g;
    return {
      s: snapshot(g),
      x: { diceDeck: Array.isArray(g.diceDeck) ? g.diceDeck.slice() : g.diceDeck, devPick: g.devPick ? JSON.parse(JSON.stringify(g.devPick)) : null, victims: (g.robberVictimOptions || []).slice(),
        flow: g.pendingRobberFlow ? JSON.parse(JSON.stringify(g.pendingRobberFlow)) : null, busy: g.robberBusy, thief: g.sea ? g.sea.thief : null, logLen: g.logEntries?.length ?? 0,
        offers: JSON.parse(JSON.stringify(this._offers)), offerSeq: this._offerSeq, via: this._via },
    };
  }
  _load(snap) {
    const g = this.g, x = snap.x;
    restore(g, snap.s);
    g.diceDeck = Array.isArray(x.diceDeck) ? x.diceDeck.slice() : x.diceDeck;
    g.devPick = x.devPick ? JSON.parse(JSON.stringify(x.devPick)) : null;
    g.robberVictimOptions = x.victims.slice();
    g.pendingRobberFlow = x.flow ? JSON.parse(JSON.stringify(x.flow)) : null;
    g.robberBusy = x.busy;
    if (g.sea) g.sea.thief = x.thief;
    if (g.logEntries && g.logEntries.length > x.logLen) g.logEntries.length = x.logLen;
    this._offers = JSON.parse(JSON.stringify(x.offers)); this._offerSeq = x.offerSeq; this._via = x.via;
  }
  _note(c) { // a chance outcome happened: it belongs to the apply() in progress, else to the observed move in progress
    if (this._applying) this._chanceUsed.push(c);
    else if (this._obs?.stack.length) this._obs.stack[this._obs.stack.length - 1].chance.push(c);
  }
  _diceSource() {
    if (this._queue) { const i = this._queue.findIndex((c) => c.node === "dice"); return i < 0 ? null : () => this._queue.splice(i, 1)[0].outcome; }
    if (this._forceDice) { const d = this._forceDice; this._forceDice = null; return () => d; }
    return this._src.dice ? () => this._src.dice(this) : null;
  }
  _stealSource() {
    if (this._queue) { const i = this._queue.findIndex((c) => c.node === "steal"); return i < 0 ? null : () => this._queue.splice(i, 1)[0].outcome; }
    return this._src.steal ? (info) => this._src.steal(info, this) : null;
  }
  /** Inject chance: { dice(engine) -> [d1,d2], steal({thief, victim, hand}) -> resource }; either may be left out (the game's own Math.random). */
  setChance(src) { this._src = { dice: src?.dice || null, steal: src?.steal || null }; return this; }

  mode() {
    const g = this.g, rush = g.isRush(), sea = !!g.sea, big = !!g.bigBoard, wp = g.winPoints, dl = g._discardLimit();
    const m = this._mode; // v1.99: the same object while nothing in it changed (isLegal / apply ask on every judged action)
    if (m && m.rush === rush && m.sea === sea && m.big === big && m.winPoints === wp && m.discardLimit === dl) return m;
    return (this._mode = { id: rush ? "rush" : "classic", rush, sea, big, winPoints: wp, discardLimit: dl });
  }
  controls(seat) { return this._control.has(seat); }
  /** Decide these seats (default all) only through apply(): the game stops running them itself. Headless use; timers are dropped. */
  takeControl(seats = "all") {
    this._enter();
    const g = this.g;
    (seats === "all" ? g.players.map((p) => p.id) : seats).forEach((s) => this._control.add(s));
    if (!this.H.laterSaved) { this.H.laterSaved = true; this.H.later0 = Object.prototype.hasOwnProperty.call(g, "_later") ? g._later : undefined; }
    g._later = () => 0; // the engine is the clock; the game's own timers (discard idle, offer expiry, SBP window) must not fire
    if (g.setupPhase && !g.setupAction && !g.winner) g.processSetupQueue();
    return this;
  }
  winner() { this._enter(); return this.g.winner ? this.g.winner.id : null; }

  // ── prompts ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _setupNode(seatId) { // the set-up settlement that still waits for its road
    const g = this.g, pl = g.players[seatId], E = g.geometry.edges;
    for (const n of pl.settlements) if (!g.geometry.nodes[n].edgeIds.some((e) => E[e].owner === seatId)) return n;
    return null;
  }
  /** What the engine asks right now. Usually one prompt; several when seats may act together (Rush, open offers, gold). */
  prompts() {
    this._enter();
    const g = this.g, out = [];
    if (g.winner || g.phase === "game_over") return out;
    if (g.setupPhase) {
      const id = g.setupQueue[g.setupStep];
      if (id == null) return out;
      const node = this._setupNode(id);
      out.push(node != null ? { kind: "setupRoad", actor: id, node } : { kind: "setupSettlement", actor: id });
      return out;
    }
    const rush = g.rush;
    if (rush?.seven) { // Rush 7 (observed games only: the stage machine is timers)
      const s = rush.seven;
      if (s.stage === "discard" && s.discards[0]) return [{ kind: "discard", actor: s.discards[0].playerId, count: s.discards[0].count }];
      if (g.robberVictimOptions?.length) return [{ kind: "steal", actor: s.moverId, victims: g.robberVictimOptions.slice() }];
      return [{ kind: "moveRobber", actor: s.moverId, via: "seven" }];
    }
    const cur = g.currentPlayer;
    const pd = g.pendingDiscard || null, flow = g.pendingRobberFlow;
    if (pd) return [{ kind: "discard", actor: pd.player.id, count: pd.count }];
    if (flow?.discards?.length) return [{ kind: "discard", actor: flow.discards[0].playerId, count: flow.discards[0].count }];
    if (g.robberVictimOptions?.length) return [{ kind: "steal", actor: g.robberContext?.playerId ?? cur.id, victims: g.robberVictimOptions.slice() }];
    if (g.pendingAction === "robber") return [{ kind: "moveRobber", actor: g.robberContext?.playerId ?? cur.id, via: this._via || (g.lastRoll === 7 ? "seven" : "knight") }];
    if (g.sea?.gold?.length) g.sea.gold.forEach((it) => out.push({ kind: "chooseGold", actor: it.pid, count: it.count }));
    if (out.length) return out;
    if (g.devPick) return [{ kind: g.devPick.type === "monopoly" ? "monopoly" : "yearOfPlenty", actor: cur.id, count: g.devPick.count }];
    if (g.freeRoadsRemaining > 0) return [{ kind: "freeRoad", actor: cur.id, remaining: g.freeRoadsRemaining }];
    if (rush) {
      g.players.forEach((p) => out.push({ kind: "rushAny", actor: p.id }));
      this._offers.forEach((o) => o.to.forEach((s) => { if (!o.answered[s]) out.push({ kind: "respondTrade", actor: s, offer: o.id, from: o.from }); }));
      const me = g._me?.();
      if (me) (rush.offers || []).forEach((o) => out.push({ kind: "respondTrade", actor: me.id, offer: o.id, from: o.fromId, legacy: true })); // a bot's offer to the human (Rush card)
      return out;
    }
    if (g.phase === "pre_roll") out.push({ kind: "preRoll", actor: cur.id });
    else if (g.phase === "sbp") out.push({ kind: "sbp", actor: cur.id });
    else if (g.phase === "main") {
      out.push({ kind: "main", actor: cur.id });
      this._offers.forEach((o) => o.to.forEach((s) => { if (!o.answered[s]) out.push({ kind: "respondTrade", actor: s, offer: o.id, from: o.from }); }));
    }
    return out;
  }
  /** The first prompt (who must decide what now), or null when the game is over. Most of the time it is the only one. */
  prompt() { return this.prompts()[0] ?? null; }
  /** The prompt a seat holds (the first), or null. */
  promptFor(seat) { return this.prompts().find((p) => p.actor === seat) || null; }

  // ── legal actions ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Concrete builds for a seat: roads, ships (Seafarers), settlements, cities; only road/ship when `free`. */
  _builds(p, free) {
    const g = this.g, id = p.id, out = [];
    const edges = g.geometry.edges, nodes = g.geometry.nodes;
    for (let i = 0; i < edges.length; i++) {
      if (g.canBuildRoad(p, i, { free })) out.push({ actor: id, type: "build", piece: "road", edge: i });
      if (g.sea && g.canBuildShip(p, i, { free })) out.push({ actor: id, type: "build", piece: "ship", edge: i });
    }
    if (!free) for (let i = 0; i < nodes.length; i++) {
      if (g.canBuildSettlement(p, i, false)) out.push({ actor: id, type: "build", piece: "settlement", node: i });
      if (g.canBuildCity(p, i, false)) out.push({ actor: id, type: "build", piece: "city", node: i });
    }
    return out;
  }
  _bankTrades(p) {
    const g = this.g, out = [];
    if (g.phase === "sbp") return out;
    RES.forEach((give) => {
      if (p.resources[give] < g.getPlayerTradeRate(p, give)) return;
      RES.forEach((get) => { if (get !== give && g.bank[get] >= 1) out.push({ actor: p.id, type: "tradeBank", give, get }); });
    });
    return out;
  }
  _combos(n, limit) { // multisets of n resources, bank permitting
    const out = [], g = this.g;
    const rec = (i, left, acc) => {
      if (left === 0) { out.push(acc.slice()); return; }
      if (i >= RES.length) return;
      for (let k = Math.min(left, g.bank[RES[i]]); k >= 0; k--) { rec(i + 1, left - k, acc.concat(Array(k).fill(RES[i]))); }
    };
    rec(0, n, []);
    return limit ? out.slice(0, limit) : out;
  }
  /**
   * Legal actions of a prompt (for its actor). Concrete and finished, except for the combinatorial ones, which come as one descriptor
   * `{type, actor, choose: true, ...}` (discard, offerTrade, pickGold, counter): isLegal() judges those, enumerate() expands them.
   * `only` restricts to one action type (cheaper).
   */
  _legalOf(prompt, only = null) {
    const g = this.g, id = prompt.actor, p = g.players[id], out = [];
    const on = (t) => !only || only === t;
    const A = (o) => out.push({ actor: id, ...o });
    switch (prompt.kind) {
      case "setupSettlement":
        if (on("place")) g.geometry.nodes.forEach((n) => { if (g.canBuildSettlement(p, n.id, true)) A({ type: "place", piece: "settlement", node: n.id }); });
        break;
      case "setupRoad":
        if (on("place")) g.geometry.edges.forEach((e) => {
          if (g.canBuildRoad(p, e.id, { free: true, setupNode: prompt.node })) A({ type: "place", piece: "road", edge: e.id });
          if (g.sea && g.canBuildShip(p, e.id, { free: true, setupNode: prompt.node })) A({ type: "place", piece: "ship", edge: e.id });
        });
        break;
      case "preRoll":
        if (on("roll")) A({ type: "roll" });
        if (on("playDev") && g.canPlayDevelopmentCard(p, "knight")) A({ type: "playDev", card: "knight" });
        break;
      case "main": case "sbp": case "rushAny": {
        const sbp = prompt.kind === "sbp";
        if (on("build")) out.push(...this._builds(p, false));
        if (on("moveShip") && g.sea && !sbp) g.sea.movableShips(p).forEach((from) => g.sea.moveTargets(p, from).forEach((to) => A({ type: "moveShip", from, to })));
        if (on("buyDev") && g.devDeck.length > 0 && has(p.resources, COSTS.development)) A({ type: "buyDev" });
        if (on("playDev") && !sbp) DEV_CARD_TYPES.forEach((t) => { if (g.canPlayDevelopmentCard(p, t)) A({ type: "playDev", card: t }); });
        if (on("tradeBank") && !sbp) out.push(...this._bankTrades(p));
        if (on("offerTrade") && !sbp && sum(p.resources) > 0 && g.players.length > 1) A({ type: "offerTrade", choose: true });
        if (on("cancelOffer") && !sbp) this._offers.forEach((o) => { if (o.from === id) A({ type: "cancelOffer", offer: o.id }); });
        if (on("passSbp") && sbp) A({ type: "passSbp" });
        if (on("endTurn") && prompt.kind === "main") A({ type: "endTurn" });
        if (on("ready") && prompt.kind === "rushAny" && !g.rush.ready.includes(id) && !g.rush.paused && !g._rushChoiceOpen?.()) A({ type: "ready" });
        break;
      }
      case "freeRoad": {
        if (on("build")) out.push(...this._builds(p, true));
        if (on("skipFree")) A({ type: "skipFree" }); // the old bots may leave a free road unused (a human could only undo the card)
        break;
      }
      case "discard": if (on("discard")) A({ type: "discard", choose: true, count: prompt.count }); break;
      case "moveRobber":
        if (on("moveRobber")) {
          if (g.sea) g.geometry.hexes.forEach((h) => { if (g._robberHexAllowed(h.id, p)) A({ type: "moveRobber", hex: h.id, target: g._seaHexKind(h.id) }); });
          else { const L = g._legalRobberHexes(p); L.forEach((h) => A({ type: "moveRobber", hex: h.id })); }
        }
        break;
      case "steal": if (on("steal")) prompt.victims.forEach((v) => A({ type: "steal", victim: v })); break;
      case "yearOfPlenty": if (on("pick")) this._combos(prompt.count ?? Math.min(2, sum(g.bank))).forEach((c) => A({ type: "pick", resources: c })); break;
      case "monopoly": if (on("pick")) RES.forEach((r) => A({ type: "pick", resource: r })); break;
      case "chooseGold": if (on("pickGold")) A({ type: "pickGold", choose: true, count: prompt.count }); break;
      case "respondTrade":
        if (on("respondTrade")) {
          const o = prompt.legacy ? g.rush?.offers.find((x) => x.id === prompt.offer) && (({ id, fromId, give, want }) => ({ id, from: fromId, give, want }))(g.rush.offers.find((x) => x.id === prompt.offer)) : this._offers.find((x) => x.id === prompt.offer);
          if (o) {
            if (prompt.legacy) { if (has(p.resources, o.want) && has(g.players[o.from].resources, o.give)) A({ type: "respondTrade", offer: o.id, answer: "accept" }); A({ type: "respondTrade", offer: o.id, answer: "reject" }); break; }
            if (has(p.resources, o.want) && has(g.players[o.from].resources, o.give)) A({ type: "respondTrade", offer: o.id, answer: "accept" });
            A({ type: "respondTrade", offer: o.id, answer: "reject" });
            A({ type: "respondTrade", offer: o.id, answer: "counter", choose: true });
          }
        }
        break;
      default: break;
    }
    return out;
  }
  /** Every action a seat may take now (under all its prompts). Descriptors carry `choose: true`. */
  legalActions(seat, prompt = null) {
    this._enter();
    const ps = prompt ? [prompt] : this.prompts().filter((p) => p.actor === seat);
    return ps.flatMap((p) => this._legalOf(p));
  }
  /** Expand the descriptors of a prompt into concrete actions (at most `max`). */
  enumerate(seat, { prompt = null, max = 200 } = {}) {
    this._enter();
    const g = this.g, p = g.players[seat], out = [];
    for (const a of this.legalActions(seat, prompt)) {
      if (!a.choose) { out.push(a); continue; }
      if (a.type === "discard") {
        const rec = (i, left, acc) => {
          if (out.length >= max) return;
          if (left === 0) { out.push({ actor: seat, type: "discard", cards: cleanHand(acc) }); return; }
          if (i >= RES.length) return;
          for (let k = Math.min(left, p.resources[RES[i]]); k >= 0; k--) rec(i + 1, left - k, { ...acc, [RES[i]]: k });
        };
        rec(0, a.count, {});
      } else if (a.type === "pickGold") this._combos(a.count).slice(0, max).forEach((c) => out.push({ actor: seat, type: "pickGold", resources: c }));
      else if (a.type === "offerTrade") RES.forEach((give) => { if (p.resources[give] > 0) RES.forEach((want) => { if (want !== give && out.length < max) out.push({ actor: seat, type: "offerTrade", to: "all", give: { [give]: 1 }, want: { [want]: 1 } }); }); });
      else if (a.type === "respondTrade") { // counters: swap one card each way
        const o = this._offers.find((x) => x.id === a.offer);
        if (o) RES.forEach((give) => { if (p.resources[give] > 0) RES.forEach((want) => { if (want !== give && out.length < max && g.players[o.from].resources[want] > 0) out.push({ actor: seat, type: "respondTrade", offer: o.id, answer: "counter", give: { [give]: 1 }, want: { [want]: 1 } }); }); });
      }
    }
    return out.slice(0, max);
  }
  _validateChoose(desc, a, prompt) {
    const g = this.g, p = g.players[a.actor];
    switch (a.type) {
      case "discard":
        if (handSize(a.cards) !== desc.count) return `discard exactly ${desc.count} cards`;
        return RES.every((r) => (a.cards[r] || 0) <= p.resources[r]) ? null : "you do not hold those cards";
      case "pickGold": {
        if (a.resources.length !== desc.count) return `pick exactly ${desc.count} cards`;
        const n = {}; a.resources.forEach((r) => { n[r] = (n[r] || 0) + 1; });
        return RES.every((r) => (n[r] || 0) <= g.bank[r]) ? null : "the bank does not hold that";
      }
      case "offerTrade": {
        if (!has(p.resources, a.give)) return "you do not hold the cards you offer";
        const to = a.to === "all" ? g.players.filter((q) => q.id !== a.actor).map((q) => q.id) : a.to;
        return to.every((s) => s !== a.actor && g.players[s]) ? null : "unknown seat in the offer";
      }
      case "respondTrade": {
        const o = this._offers.find((x) => x.id === a.offer);
        if (!o) return "no such offer";
        return has(p.resources, a.give) && has(g.players[o.from].resources, a.want) ? null : "a counter must be payable on both sides";
      }
      default: return "not a choice action";
    }
  }
  /** {ok:true} or {ok:false, reason}. Judged against the prompts the actor holds (or `opts.prompt`, for moves made inside a bot's turn). */
  isLegal(a, opts = {}) {
    this._enter();
    const sh = validateShape(a, this.mode());
    if (!sh.ok) return sh;
    const ps = opts.prompt ? [opts.prompt] : this.prompts().filter((p) => p.actor === a.actor);
    if (!ps.length) return { ok: false, reason: `seat ${a.actor} has no prompt right now` };
    let k = null; // the action's canonical key: only the scan below needs it (v1.99: not built for the common answers _quick judges)
    let why = null;
    for (const pr of ps) {
      if (!PROMPTS[pr.kind].types.includes(a.type)) { why = why || `${a.type} is not an answer to ${pr.kind}`; continue; }
      if (this._quick(a, pr)) return { ok: true }; // the common answers, judged by one call instead of a scan (the scan below gives the reason when refused)
      if (k === null) k = keyOf(this._canon(a));
      for (const l of this._legalOf(pr, a.type)) {
        if (!l.choose) { if (keyOf(this._canon(l)) === k) return { ok: true }; continue; }
        if (l.type !== a.type || (l.answer && l.answer !== a.answer)) continue;
        const bad = this._validateChoose(l, a, pr);
        if (!bad) return { ok: true };
        why = bad;
      }
      why = why || this._whyNot(a, pr);
    }
    return { ok: false, reason: why };
  }
  /** True when the old rule methods accept `a` under `pr` (the same calls _legalOf makes, for this one action); false = ask the scan. */
  _quick(a, pr) {
    const g = this.g, p = g.players[a.actor], k = pr.kind;
    const inRange = (n, arr) => Number.isInteger(n) && n >= 0 && n < arr.length;
    switch (a.type) {
      case "build": {
        if (k !== "main" && k !== "sbp" && k !== "freeRoad" && k !== "rushAny") return false;
        const free = k === "freeRoad";
        if (a.piece === "road") return inRange(a.edge, g.geometry.edges) && !!g.canBuildRoad(p, a.edge, { free });
        if (a.piece === "ship") return !!g.sea && inRange(a.edge, g.geometry.edges) && !!g.canBuildShip(p, a.edge, { free });
        if (free || !inRange(a.node, g.geometry.nodes)) return false;
        return a.piece === "settlement" ? !!g.canBuildSettlement(p, a.node, false) : !!g.canBuildCity(p, a.node, false);
      }
      case "place":
        if (k === "setupSettlement") return inRange(a.node, g.geometry.nodes) && !!g.canBuildSettlement(p, a.node, true);
        if (k !== "setupRoad" || !inRange(a.edge, g.geometry.edges)) return false;
        return a.piece === "road" ? !!g.canBuildRoad(p, a.edge, { free: true, setupNode: pr.node }) : !!g.sea && !!g.canBuildShip(p, a.edge, { free: true, setupNode: pr.node });
      case "tradeBank": return (k === "main" || k === "rushAny") && g.phase !== "sbp" && a.give !== a.get && p.resources[a.give] >= g.getPlayerTradeRate(p, a.give) && g.bank[a.get] >= 1;
      case "buyDev": return (k === "main" || k === "sbp" || k === "rushAny") && g.devDeck.length > 0 && has(p.resources, COSTS.development);
      case "endTurn": return k === "main";
      case "roll": return k === "preRoll";
      default: return false;
    }
  }
  _canon(a) { // a replay-only field and a default target do not make a different action
    const c = { ...a };
    delete c.forced;
    if (c.target === "robber" && !this.g.sea) delete c.target;
    return c;
  }
  _whyNot(a, pr) {
    const g = this.g, p = g.players[a.actor];
    if (a.type === "build" || a.type === "place") {
      const cost = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, ship: { wood: 1, sheep: 1 } }[a.piece];
      if (pr.kind !== "freeRoad" && pr.kind !== "setupRoad" && pr.kind !== "setupSettlement" && !has(p.resources, cost)) return `not enough cards for a ${a.piece}`;
      return `${a.piece} cannot go there`;
    }
    if (a.type === "buyDev") return g.devDeck.length ? "not enough cards for a development card" : "the development deck is empty";
    if (a.type === "tradeBank") return "cannot afford that maritime trade";
    if (a.type === "playDev") return `${a.card} cannot be played now`;
    return `${a.type} is not legal here`;
  }

  // ── apply ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _brief() {
    const g = this.g;
    return { hands: g.players.map((p) => copy(p.resources)), vp: g.players.map((p) => p.publicVictoryPoints), nd: g.players.map((p) => copy(p.newDevCards)), dvp: g.players.map((p) => p.devVictoryPoints), turn: g.turn, robber: g.robberHexId, pirate: g.sea?.pirateHexId ?? null,
      dev: g.players.map((p) => devSum(p.devCards) + devSum(p.newDevCards) + p.devVictoryPoints), lr: g.longestRoadHolder?.id ?? null, la: g.largestArmyHolder?.id ?? null, cur: g.currentPlayerIndex };
  }
  /**
   * Do an action. Returns { ok, events, prompts } (events are JSON facts, see _events). An illegal action changes nothing and returns
   * { ok:false, reason }. `opts.chance` ([{node:"dice",outcome:[d1,d2]} | {node:"steal",outcome:"ore"}]) forces the chance of this one call.
   */
  apply(a, opts = {}) {
    this._enter();
    if (!opts.trusted) { const sh = validateShape(a, this.mode()); if (!sh.ok) return refuse(sh.reason); } // `trusted`: the host has just judged the shape (isLegal) of this very action
    if (!this.controls(a.actor)) return refuse(`seat ${a.actor} is not controlled by this engine`);
    if (!opts.trusted) { const lg = this.isLegal(a); if (!lg.ok) return refuse(lg.reason); } // `trusted`: the caller (the bot host) has just judged it
    const g = this.g, before = opts.quiet ? null : this._brief(), hit = a.type === "roll" ? null : undefined;
    this._chanceUsed = []; this._queue = opts.chance ? opts.chance.map((c) => ({ ...c })) : null;
    if (a.type === "roll" && a.forced) this._forceDice = a.forced;
    this._applying++; g._applyDepth = (g._applyDepth || 0) + 1; // the UI's doors (_confirmDiscard, _finishPick, sbpSkip) see they are being called by an apply() and do the work
    let err = null;
    let done;
    try { if (opts.adopted) { g.__adoptFlush?.(); if (a.type === "buyDev") this._after_buyDev(g.players[a.actor]); done = true; } else done = this[`_do_${a.type}`](a, g.players[a.actor]); } catch (e) { err = e; } finally { this._applying--; g._applyDepth--; this._queue = null; this._forceDice = null; }
    if (err) throw err;
    if (done === false) return { ok: false, bug: true, reason: `the old code rejected a legal ${a.type} (engine/legacy disagreement)`, events: [], prompts: this.prompts() };
    const events = opts.quiet ? [] : this._events(a, before); // `quiet`: no event list (headless bot play)
    const entry = { a: cloneAction(a), chance: this._chanceUsed };
    this._log.push(entry);
    if (opts.quiet) { const eng = this; return { ok: true, events, get prompts() { return eng.prompts(); } }; } // headless bot play never reads them: asked for only when read (v1.99)
    return { ok: true, events, prompts: this.prompts() };
  }
  _asHuman(p, fn) { const h = p.isHuman; p.isHuman = true; try { return fn(); } finally { p.isHuman = h; } }
  _do_place(a, p) {
    const g = this.g, cb = { type: a.piece, id: a.node ?? a.edge };
    if (this.legacyBotOrder && a.piece === "settlement" && g._rvHostSetup) return g._rvHostSetup(p, a.node, () => g._commitSetup(p, cb)); // the review recorder's record of a bot's set-up settlement
    g._commitSetup(p, cb);
    if (this.legacyBotOrder && a.piece !== "settlement") g.recomputeScores(); // a bot's set-up turn ends with its scores counted (_aiSetupRoad), so the next seat's choice sees them
  }
  _do_build(a, p) {
    const g = this.g, cb = { type: a.piece, id: a.node ?? a.edge };
    return g._commitBuild(p, cb); // every road, free ones too, is counted (and a win declared) as it is placed
  }
  _do_roll(a, p) {
    const g = this.g;
    g._dropUndo?.(); g.devPlayed = null;
    this._via = null;
    if (this.legacyBotOrder) { g.executeRollPhase(p); return; } // the old bots' roll: the call rolls the dice itself (the recorders look at the position before the dice)
    g.diceResult = g.rollDice();
    g.executeRollPhase(p);
  }
  _do_endTurn(a, p) {
    const g = this.g;
    g._dropUndo?.(); this._offers = [];
    // legacyBotOrder: a bot's main phase closes with one count of the scores and one look for a winner (executeAiMainPhase finish); a win ends the game there
    if (this.legacyBotOrder) { g.recomputeScores(); g.checkForWinner(p); if (g.winner) return; }
    g.endTurn();
  }
  _do_buyDev(a, p) {
    const g = this.g;
    if (!g.buyDevelopmentCard(p)) return false;
    this._after_buyDev(p);
  }
  _after_buyDev(p) { // what follows the purchase (also what an adopted purchase still needs: the planner has bought the card)
    const g = this.g;
    if (g.sbp) g._sbpAfterHumanBuild();
    g.recomputeScores(); // (a bot's seat has counted the card at the purchase already: buyDevelopmentCard)
    if (g.rush) g._rushAfterAction(p); else g.checkForWinner(p);
  }
  _do_playDev(a, p) {
    const g = this.g;
    g._dropUndo?.();
    if (a.card === "knight") { this._via = "knight"; this._knightSeat = this.legacyBotOrder ? p.id : null; }
    if (!g.playDevelopmentCard(p, a.card)) return false;
    g.recomputeScores();
    g.checkForWinner(p); // a Knight's Largest Army wins at once, before the robber moves (playDevelopmentCard has already looked)
    if (g.winner) { this._via = null; this._knightSeat = null; }
    return true;
  }
  _do_pick(a, p) {
    const g = this.g;
    this._asHuman(p, () => {
      (a.resources || [a.resource]).forEach((r) => g._pickTap(r));
      if (g.devPick) g._finishPick();
    });
  }
  _do_tradeBank(a, p) { const g = this.g; if (!g.performBankTrade(p, a.give, a.get)) return false; g._dropUndo?.(); if (g.rush) g._rushAfterAction(p); return true; }
  _do_moveShip(a, p) { const g = this.g, n = p.ships.size; g._seaCommitMove(p, a.from, a.to); return p.ships.has(a.to) && p.ships.size === n && !p.ships.has(a.from); }
  _do_skipFree(a, p) { const g = this.g; g.freeRoadsRemaining = 0; g.pendingAction = null; g.recomputeScores(); g.checkForWinner(p); }
  _do_passSbp() { this.g.sbpSkip(); }
  _do_ready(a) { const r = this.g.rush; r.ready.push(a.actor); r.readyAt = r.clockMs; }
  _do_pickGold(a, p) { const g = this.g; a.resources.forEach((r) => g.sea.pickGold(p, r)); g.recomputeScores(); g.checkForWinner(p); }
  _do_discard(a, p) {
    const g = this.g, pd = g.pendingDiscard;
    if (pd) { pd.selected = { ...emptyHand(), ...a.cards }; g._confirmDiscard(); return; } // the UI's own discard flow
    const flow = g.pendingRobberFlow, item = flow.discards[0];
    g.payToBank(p, a.cards);
    g.emit({ type: "discarded", seat: p.id, n: item.count, reason: "rolled a 7" });
    flow.discards.shift();
    if (!flow.discards.length) { g.robberBusy = false; g.pendingRobberFlow = null; this._enterRobber(g.players[flow.rollerId], "seven"); }
  }
  /** A 7 was rolled by a seat the engine controls: ask the over-limit seats for their discards, then the roller for the robber. */
  _resolveSeven(roller, reason) {
    const g = this.g, discards = [];
    g.players.forEach((pl) => {
      const total = sum(pl.resources);
      if (total <= g._discardLimit()) return;
      const count = Math.floor(total / 2);
      if (g._isInteractive(pl)) discards.push({ playerId: pl.id, count });
      else { g._autoDiscard(pl, count); g.emit({ type: "discarded", seat: pl.id, n: count, reason }); }
    });
    if (!discards.length) { this._enterRobber(roller, "seven"); return; }
    g.pendingRobberFlow = { rollerId: roller.id, discards };
    g.robberBusy = true;
  }
  _enterRobber(mover, via) {
    const g = this.g;
    this._via = via;
    g.moveRobber(mover); // a controlled seat: sets pendingAction = "robber" (the mode the tap flow uses); a seat the game plays itself: it moves and robs now
  }
  _do_moveRobber(a, p) {
    const g = this.g;
    if (g.sea) g.sea.thief = g._seaHexKind(a.hex);
    if (this.legacyBotOrder && g._rvHostRobber) g._rvHostRobber(p, a.hex, () => g._commitRobber(p, a.hex, null)); else g._commitRobber(p, a.hex, null);
    this._via = null;
    if (!g.robberVictimOptions?.length) this._robberDone(p);
  }
  _robberDone() {
    const g = this.g, ks = this._knightSeat;
    this._knightSeat = null;
    if (ks != null && g.stats) { // the old bots' Knight was one call: its robbery was counted before the card ("t", "R", then "y")
      const ev = g.stats.ev;
      for (let i = ev.length - 1; i >= 0 && i >= ev.length - 6; i--) if (ev[i][1] === "y" && ev[i][2] === ks) { ev.push(ev.splice(i, 1)[0]); break; }
    } g.checkForWinner(g.currentPlayer); }
  _do_steal(a, p) {
    const g = this.g;
    g.stealFromVictim(p, a.victim);
    if (this.legacyBotOrder && g.stats) { const ev = g.stats.ev, n = ev.length; if (n > 1 && ev[n - 1][1] === "t" && (ev[n - 2][1] === "R" || ev[n - 2][1] === "Q")) { const t = ev[n - 1]; ev[n - 1] = ev[n - 2]; ev[n - 2] = t; } } // the old bots' move robbed first and was counted after (R after t)
    g.robberContext = null; g.robberVictimOptions = [];
    this._robberDone();
  }
  // trades: the engine keeps the offers. A seat it does not control answers by the game's own evaluator, at once.
  _do_offerTrade(a, p) {
    const g = this.g;
    const to = a.to === "all" ? g.players.filter((q) => q.id !== a.actor).map((q) => q.id) : [...new Set(a.to)];
    const o = { id: ++this._offerSeq, from: a.actor, to, give: cleanHand(a.give), want: cleanHand(a.want), answered: {} };
    this._offers.push(o);
    if (!this.legacyBotOrder) g.emit({ type: "offered", seat: p.id, to: o.to, give: o.give, want: o.want, style: "api" });
    for (const s of to) { // bots that nobody controls decide now
      if (this.controls(s) || g._isInteractive(g.players[s])) continue;
      const q = g.players[s];
      if (has(q.resources, o.want) && g.aiEvaluateTrade(q, o.give, o.want, p)) { this._settle(o, s); return; }
      o.answered[s] = "reject";
    }
    this._closeIfAnswered(o);
  }
  _settle(o, s) {
    const g = this.g, from = g.players[o.from], resp = g.players[s];
    if (this.legacyBotOrder) { // the old bots' deal: one stats event, the swap by hand (the planner never called _swapCards)
      g._stTrade(from, resp, o.give, o.want);
      RES.forEach((r) => { const give = o.give[r] || 0, want = o.want[r] || 0; from.resources[r] += want - give; resp.resources[r] += give - want; });
    } else {
      g._stTrade(from, resp, o.give, o.want);
      g._swapCards(from, o.give, resp, o.want);
    }
    g.emit({ type: "traded", seat: from.id, partner: resp.id, gave: o.give, got: o.want, style: "api" }); // the old bots' wording (golden logs compare it)
    this._offers = this._offers.filter((x) => x !== o);
    if (g.rush) g._rushAfterAction(from);
  }
  _closeIfAnswered(o) { if (o.to.every((s) => o.answered[s])) this._offers = this._offers.filter((x) => x !== o); }
  _do_respondTrade(a) {
    const g = this.g, o = this._offers.find((x) => x.id === a.offer);
    if (!o && g.rush?.offers.some((x) => x.id === a.offer)) { g._resolveRushOffer(a.offer, a.answer === "accept"); return; } // a bot's Rush offer to the human
    if (a.answer === "accept") { this._settle(o, a.actor); return; }
    o.answered[a.actor] = a.answer;
    if (a.answer === "counter") { // a counter closes the offer and opens one from the responder, one level deep
      this._offers = this._offers.filter((x) => x !== o);
      this._offers.push({ id: ++this._offerSeq, from: a.actor, to: [o.from], give: cleanHand(a.give), want: cleanHand(a.want), answered: {}, counterOf: o.id });
      return;
    }
    this._closeIfAnswered(o);
  }
  _do_cancelOffer(a) { this._offers = this._offers.filter((x) => x.id !== a.offer); }

  // ── events ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Facts of one apply(), JSON. Cards a viewer may not see carry `priv: [seats that may]`; view() removes them for everyone else. */
  _events(a, before) {
    const g = this.g, ev = [], push = (e) => { e.seq = ++this._seq; ev.push(e); };
    const now = this._brief();
    const seat = a.actor;
    switch (a.type) {
      case "place": case "build": push({ type: "built", actor: seat, piece: a.piece, node: a.node ?? null, edge: a.edge ?? null, free: a.type === "place" || undefined }); break;
      case "moveShip": push({ type: "shipMoved", actor: seat, from: a.from, to: a.to }); break;
      case "roll": {
        const d = this._chanceUsed.find((c) => c.node === "dice")?.outcome || [g.lastDice?.d1, g.lastDice?.d2];
        push({ type: "roll", actor: seat, dice: d, total: g.lastRoll ?? d[0] + d[1] });
        push({ type: "chance", node: "dice", outcome: d, p: (6 - Math.abs(d[0] + d[1] - 7)) / 36 });
        break;
      }
      case "buyDev": {
        const pl = g.players[seat];
        const card = pl.devVictoryPoints > before.dvp[seat] ? "victoryPoint" : DEV_CARD_TYPES.find((t) => pl.newDevCards[t] > before.nd[seat][t]) || null;
        push({ type: "devBought", actor: seat, card, priv: [seat] }); push({ type: "chance", node: "devDraw", outcome: card, priv: [seat] });
        break;
      }
      case "playDev": push({ type: "devPlayed", actor: seat, card: a.card }); break;
      case "pick": push({ type: "picked", actor: seat, resources: a.resources || [a.resource] }); break;
      case "tradeBank": push({ type: "tradeBank", actor: seat, give: a.give, get: a.get, rate: g.getPlayerTradeRate(g.players[seat], a.give) }); break;
      case "discard": push({ type: "discard", seat, n: handSize(a.cards), cards: cleanHand(a.cards), priv: [seat] }); break;
      case "moveRobber": push({ type: "robberMoved", actor: seat, from: before.robber, to: a.hex, target: a.target || "robber" }); break;
      case "endTurn": push({ type: "turnEnd", seat }); break;
      default: push({ type: a.type, actor: seat }); break;
    }
    // what every seat gained or lost, derived from the hands
    g.players.forEach((pl, i) => {
      const gain = {}; RES.forEach((r) => { const d = pl.resources[r] - before.hands[i][r]; if (d) gain[r] = d; });
      if (!Object.keys(gain).length) return;
      if (a.type === "roll") push({ type: "produce", seat: i, cards: gain });
      else if (a.type === "moveRobber" || a.type === "steal") { if (i !== seat && sum(gain) < 0) push({ type: "stolen", actor: seat, victim: i, n: 1, res: RES.find((r) => gain[r] < 0), priv: [seat, i] }); }
    });
    for (const c of this._chanceUsed) {
      if (c.node !== "steal") continue;
      const victim = g.players.findIndex((pl, i) => i !== seat && RES.some((r) => pl.resources[r] < before.hands[i][r]));
      push({ type: "chance", node: "steal", outcome: c.outcome, priv: victim >= 0 ? [seat, victim] : [seat] });
    }
    if (now.lr !== before.lr) push({ type: "award", award: "longestRoad", seat: now.lr, prev: before.lr });
    if (now.la !== before.la) push({ type: "award", award: "largestArmy", seat: now.la, prev: before.la });
    g.players.forEach((pl, i) => { if (now.vp[i] !== before.vp[i]) push({ type: "score", seat: i, vp: pl.publicVictoryPoints }); });
    if (g.winner) push({ type: "win", seat: g.winner.id });
    this._evlog.push(...ev);
    if (this._evlog.length > 400) this._evlog.splice(0, this._evlog.length - 400);
    return ev;
  }

  // ── view ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The position for a seat id, "spectator" or "omniscient". Plain JSON (the board is one shared frozen object). Hidden: opponents' hands, dev cards, hidden VP, deck order. */
  view(who) {
    this._enter();
    const g = this.g, omni = who === "omniscient", me = typeof who === "number" ? who : -1;
    const sees = (i) => omni || i === me;
    const geo = g.geometry;
    const seats = g.players.map((p, i) => {
      const pub = { id: i, name: p.name, vp: sees(i) ? p.victoryPoints : p.publicVictoryPoints, knightsPlayed: p.knightsPlayed, longestRoad: p.longestRoadLength,
        handCount: sum(p.resources), devCount: devSum(p.devCards) + devSum(p.newDevCards) + p.devVictoryPoints,
        roads: [...p.roads].sort((x, y) => x - y), ships: [...(p.ships || [])].sort((x, y) => x - y), settlements: [...p.settlements].sort((x, y) => x - y), cities: [...p.cities].sort((x, y) => x - y),
        left: { road: g.piecesLeft(p, "road"), settlement: g.piecesLeft(p, "settlement"), city: g.piecesLeft(p, "city"), ...(g.sea ? { ship: g.piecesLeft(p, "ship") } : {}) },
        rates: Object.fromEntries(RES.map((r) => [r, g.getPlayerTradeRate(p, r)])) };
      if (sees(i)) { pub.hand = copy(p.resources); pub.dev = copy(p.devCards); pub.newDev = copy(p.newDevCards); pub.vpCards = p.devVictoryPoints; pub.hiddenVp = p.victoryPoints - p.publicVictoryPoints; }
      else pub.handCount = sum(p.resources);
      return pub;
    });
    // what the viewer may legitimately believe about each opponent's hand: the game's public card tracker (read without disturbing it)
    const est = [];
    const trk = g._aiTrk?.();
    g.players.forEach((p, i) => {
      if (sees(i) || !trk) { est.push(null); return; }
      const saved = copy(trk.est[i]); est.push(copy(g._aiEstimate(p))); Object.assign(trk.est[i], saved);
    });
    const known = me >= 0 ? devSum(g.players[me].devCards) + devSum(g.players[me].newDevCards) + g.players[me].devVictoryPoints : 0;
    const deck = g.bigBoard ? BIG_DEV_DECK : DEV_DECK;
    const v = {
      mode: { ...this.mode() }, turn: g.turn, phase: g.phase, current: g.currentPlayerIndex, winner: g.winner ? g.winner.id : null, prompts: this.prompts(),
      board: boardOf(g),
      pieces: { nodeOwner: geo.nodes.map((n) => n.owner ?? -1), nodeStruct: geo.nodes.map((n) => (n.structure === "city" ? 2 : n.structure === "settlement" ? 1 : 0)),
        edgeOwner: geo.edges.map((e) => e.owner ?? -1), edgeShip: geo.edges.map((e) => (e.ship ? 1 : 0)) },
      robber: g.robberHexId, pirate: g.sea ? g.sea.pirateHexId : null, bank: copy(g.bank), devDeckCount: g.devDeck.length,
      lastRoll: g.lastRoll, lastDice: g.lastDice ? [g.lastDice.d1, g.lastDice.d2] : null, longestRoadHolder: g.longestRoadHolder?.id ?? null, largestArmyHolder: g.largestArmyHolder?.id ?? null,
      seats, belief: { est, devUnknownCount: g.devDeck.length + seats.reduce((n, s, i) => n + (sees(i) ? 0 : s.devCount), 0), devDeckSize: sum(deck), ownDevCards: known },
      offers: this._offers.map((o) => ({ id: o.id, from: o.from, to: o.to.slice(), give: copy(o.give), want: copy(o.want) })),
      lastEvents: this._evlog.slice(-30).map((e) => this._redact(e, who)).filter(Boolean),
    };
    if (g.sea) v.gold = (g.sea.gold || []).map((it) => ({ pid: it.pid, count: it.count }));
    if (g.rush) v.rush = { rollNo: g.rush.rollNo, remainingMs: g.rush.remainingMs, ready: g.rush.ready.slice(), paused: g.rush.paused, hold: !!g._rushChoiceOpen?.() }; // hold (v1.95): the human is mid dev-card choice, the clock and bots stand still
    return v;
  }
  _redact(e, who) {
    if (who === "omniscient" || !("priv" in e)) return e;
    if (e.priv === null || e.priv === undefined) return e;
    if (typeof who === "number" && e.priv.includes(who)) return e;
    const o = { ...e }; delete o.priv; delete o.cards; delete o.res;
    if (o.type === "devBought") o.card = null;
    if (o.type === "stolen") o.res = null;
    if (o.type === "chance") o.outcome = null;
    return o;
  }
  /** apply() returns the events as they happened (omniscient); this is what a seat may see of them. */
  redact(events, who) { return events.map((e) => this._redact(e, who)); }
  /** Events seq > n as `who` may see them. */
  eventsSince(n, who) { this._enter(); return this._evlog.filter((e) => e.seq > n).map((e) => this._redact(e, who)); }

  // ── state, clone, log ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** A hash of the whole position (pieces, hands, decks, holders, phase); equal positions have equal hashes. Log text and clocks are not part of it. */
  stateHash() {
    this._enter();
    const g = this.g, geo = g.geometry;
    const st = [g.turn, g.phase, g.currentPlayerIndex, g.setupStep, g.setupAction, g.freeRoadsRemaining, g.pendingAction, g.robberHexId, g.sea?.pirateHexId ?? null,
      g.longestRoadHolder?.id ?? null, g.largestArmyHolder?.id ?? null, g.winner?.id ?? null, g.lastRoll, g.currentTurnPlayedDevCard, RES.map((r) => g.bank[r]), g.devDeck,
      geo.nodes.map((n) => (n.owner == null ? "" : n.owner + (n.structure === "city" ? "C" : "s"))).join(""), geo.edges.map((e) => (e.owner == null ? "" : e.owner + (e.ship ? "S" : ""))).join("|"),
      g.players.map((p) => [RES.map((r) => p.resources[r]), DEV_CARD_TYPES.map((t) => p.devCards[t]), DEV_CARD_TYPES.map((t) => p.newDevCards[t]), p.devVictoryPoints, p.knightsPlayed,
        p.longestRoadLength, p.victoryPoints, p.publicVictoryPoints, [...p.roads].sort((x, y) => x - y), [...p.settlements].sort((x, y) => x - y), [...p.cities].sort((x, y) => x - y), [...(p.ships || [])].sort((x, y) => x - y)]),
      g.sea ? [g.sea.gold.length, JSON.stringify(g.sea.bonus)] : null, g.sbp ? [g.sbp.after, g.sbp.pos] : null];
    return hash53(JSON.stringify(st));
  }
  /** An independent engine value for search and rollouts. Built on master/sim.js snapshot/restore: clones share the one game object, and
   *  whichever engine you call next is put back on it first (one restore). Cheap (tens of microseconds), not free; no Rush. */
  clone() {
    this._enter();
    if (this.g.rush) throw new Error("clone(): Rush keeps its clock in timers; not supported (see engine.js notes)");
    const c = new Engine(this.g, { control: [...this._control], meta: this.meta, parked: true });
    c._snap = this._save();
    c._src = { ...this._src }; c._log = this._log.slice(); /* entries are never edited once pushed */ c._offers = JSON.parse(JSON.stringify(this._offers)); c._offerSeq = this._offerSeq; c._via = this._via;
    c._seq = this._seq; c._evlog = this._evlog.slice();
    return c; // parked until its first use
  }
  /** Give the game object back (drops a parked clone's snapshot). */
  dispose() { this._dead = true; this._snap = null; if (this.H.active === this) this.H.active = null; }
  /** dispose(), and give the game its own timers back (takeControl dropped them): for a host that is finished with the game object. */
  release() {
    const H = this.H, g = this.g, was = H.active === this;
    this.dispose();
    if (was && H.laterSaved) { H.laterSaved = false; if (H.later0 !== undefined) g._later = H.later0; else delete g._later; }
  }
  /** The record of this game: how it started and every action with the chance it drew. replay(game, log) plays it again. */
  log() { return { setup: this.meta, actions: JSON.parse(JSON.stringify(this._log)) }; }

  // ── observing a game that plays itself ──────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Report every move the game's own bots make as an action. For each, cb({ a, prompt, legal, ok, chance }) when it is over: `legal` is
   * isLegal() judged BEFORE the move, `ok` whether the old method accepted it, `chance` the dice / steal it drew. Accepted moves are also
   * kept in log() (a replayable record). Returns stop() -> all reported moves. A move made inside a card (the roads of Road Building, the
   * knight's robber) is reported after the card, in the order it happens; a trade a bot makes is an offerTrade plus the answer's accept;
   * and a seat that could build in a Special Building Phase window ends it with passSbp, as the driven game requires.
   */
  observe(cb = () => {}) {
    this._enter();
    const g = this.g, self = this, restoreFns = [];
    const obs = (this._obs = { stack: [], entries: [], ctx: null });
    const live = () => !self._applying && self.H.active === self && self._obs === obs;
    // a wrapper is put back only if nobody wrapped over it meanwhile (the golden harness wraps the same methods); if someone did, ours stays inert
    const wrap = (obj, k, fn) => { const o = obj[k]; const mine = function (...args) { return live() ? fn.call(this, o, args) : o.apply(this, args); }; obj[k] = mine; restoreFns.push(() => { if (obj[k] === mine) obj[k] = o; }); };
    const judge = (a, prompt) => { try { return self.isLegal(a, { prompt }); } catch (e) { return { ok: false, reason: `exception: ${e.message}` }; } };
    const emit = (entry) => { obs.entries.push(entry); self._log.push({ a: entry.a, chance: entry.chance }); cb(entry); };
    const run = (a, prompt, call, okOf = (r) => r !== false) => { // one reported move around the old method call
      const entry = { a, prompt, legal: judge(a, prompt), ok: false, chance: [] };
      obs.stack.push(entry);
      const at = obs.entries.length, atLog = self._log.length;
      obs.entries.push(entry); self._log.push({ a, chance: entry.chance }); // reserve the place: moves made inside come after it
      let r;
      try { r = call(); } finally { obs.stack.pop(); }
      entry.ok = !!okOf(r);
      if (!entry.ok) { obs.entries.splice(obs.entries.indexOf(entry), 1); self._log.splice(atLog, 1); } else void at;
      cb(entry);
      return r;
    };
    const seatPrompt = (id) => self.promptFor(id) || { kind: "main", actor: id };
    const inCtx = (ctx, fn) => { const prev = obs.ctx; obs.ctx = ctx; try { return fn(); } finally { obs.ctx = prev; } };
    const freeCtx = () => !!obs.ctx?.free;
    const edgePrompt = (p, opts) => (opts.setupNode != null ? seatPrompt(p.id) : opts.free || freeCtx() ? { kind: "freeRoad", actor: p.id } : seatPrompt(p.id));

    wrap(g, "placeSettlement", function (o, [p, node, setup]) {
      return run({ actor: p.id, type: setup ? "place" : "build", piece: "settlement", node }, seatPrompt(p.id), () => o.call(this, p, node, setup));
    });
    wrap(g, "placeCity", function (o, [p, node, free]) { return run({ actor: p.id, type: "build", piece: "city", node }, seatPrompt(p.id), () => o.call(this, p, node, free)); });
    wrap(g, "placeRoad", function (o, [p, edge, opts = {}]) {
      const r = run({ actor: p.id, type: opts.setupNode != null ? "place" : "build", piece: "road", edge }, edgePrompt(p, opts), () => o.call(this, p, edge, opts));
      if (r !== false && freeCtx()) obs.ctx.placed++;
      return r;
    });
    { // Seafarers rules are an object rebuilt with every game: wrap their prototype (shared by every game)
      const P = Seafarers.prototype;
      const wrapP = (k, fn) => wrap(P, k, fn);
      wrapP("placeShip", function (o, [p, edge, opts = {}]) {
        const r = run({ actor: p.id, type: opts.setupNode != null ? "place" : "build", piece: "ship", edge }, edgePrompt(p, opts), () => o.call(this, p, edge, opts));
        if (r !== false && freeCtx()) obs.ctx.placed++;
        return r;
      });
      wrapP("moveShip", function (o, [p, from, to]) { return run({ actor: p.id, type: "moveShip", from, to }, seatPrompt(p.id), () => o.call(this, p, from, to)); });
      wrapP("aiGoldPicks", function (o, [p, can]) {
        const picks = o.call(this, p, can);
        if (picks?.length) { const a = { actor: p.id, type: "pickGold", resources: picks.slice() }, prompt = { kind: "chooseGold", actor: p.id, count: can }; emit({ a, prompt, legal: judge(a, prompt), ok: true, chance: [] }); }
        return picks;
      });
    }
    wrap(g, "performBankTrade", function (o, [p, give, get]) { return run({ actor: p.id, type: "tradeBank", give, get }, seatPrompt(p.id), () => o.call(this, p, give, get)); });
    wrap(g, "buyDevelopmentCard", function (o, [p]) { return run({ actor: p.id, type: "buyDev" }, seatPrompt(p.id), () => o.call(this, p)); });
    wrap(g, "playDevelopmentCard", function (o, [p, card]) {
      const prompt = self.g.phase === "pre_roll" ? { kind: "preRoll", actor: p.id } : seatPrompt(p.id);
      const G = self.g, ctx = { free: card === "roadBuilding", card, placed: 0, expected: card === "roadBuilding" ? Math.min(2, G.piecesLeft(p, "road") + (G.sea ? G.sea.shipsLeft(p) : 0)) : 0 };
      const r = run({ actor: p.id, type: "playDev", card }, prompt, () => inCtx(ctx, () => o.call(this, p, card)));
      if (r !== false && ctx.free && ctx.placed < ctx.expected && G._hasLegalRoad(p, true)) { // the bot left a free road unused: the driven game asks, so the log answers
        const a = { actor: p.id, type: "skipFree" }, pr = { kind: "freeRoad", actor: p.id, remaining: ctx.expected - ctx.placed };
        emit({ a, prompt: pr, legal: judge(a, pr), ok: true, chance: [] });
      }
      return r;
    });
    wrap(g, "chooseYearOfPlentyResources", function (o, [p]) {
      const picks = o.call(this, p);
      if (picks?.length && obs.ctx?.card === "yearOfPlenty") { const a = { actor: p.id, type: "pick", resources: picks.slice() }, prompt = { kind: "yearOfPlenty", actor: p.id, count: Math.min(2, sum(self.g.bank)) }; emit({ a, prompt, legal: judge(a, prompt), ok: true, chance: [] }); }
      return picks;
    });
    wrap(g, "chooseBestMonopolyResource", function (o, [p]) {
      const r = o.call(this, p);
      if (obs.ctx?.card === "monopoly") { const a = { actor: p.id, type: "pick", resource: r }, prompt = { kind: "monopoly", actor: p.id, count: 1 }; emit({ a, prompt, legal: judge(a, prompt), ok: true, chance: [] }); }
      return r;
    });
    wrap(g, "moveRobberAndSteal", function (o, [p, hex]) {
      const a = { actor: p.id, type: "moveRobber", hex }; if (self.g.sea) a.target = self.g._seaHexKind(hex);
      const victims = self.g._stealVictims(hex, p);
      return run(a, { kind: "moveRobber", actor: p.id, via: obs.ctx?.card === "knight" ? "knight" : "seven" }, () => inCtx({ victims }, () => o.call(this, p, hex)), () => true);
    });
    wrap(g, "_doSteal", function (o, [p, victim]) {
      const vs = obs.ctx?.victims;
      if (vs && vs.length > 1) return run({ actor: p.id, type: "steal", victim }, { kind: "steal", actor: p.id, victims: vs }, () => o.call(this, p, victim), () => true);
      return o.call(this, p, victim); // one victim: the move itself robs, no second decision
    });
    wrap(g, "_autoDiscard", function (o, [p, count]) {
      const pre = copy(p.resources), limit = self.g._discardLimit();
      const sel = o.call(this, p, count);
      if (sel) {
        const a = { actor: p.id, type: "discard", cards: cleanHand(sel) }, prompt = { kind: "discard", actor: p.id, count };
        const ok = sum(pre) > limit && count === Math.floor(sum(pre) / 2) && sum(sel) === count && RES.every((r) => (sel[r] || 0) <= pre[r]);
        emit({ a, prompt, legal: ok ? { ok: true } : { ok: false, reason: "discard does not match the hand" }, ok: true, chance: [] });
      }
      return sel;
    });
    wrap(g, "executeRollPhase", function (o, [p]) {
      const fresh = self.g.phase === "pre_roll" && !self.g.setupPhase;
      return run({ actor: p.id, type: "roll" }, seatPrompt(p.id), () => o.call(this, p), () => fresh);
    });
    wrap(g, "endTurn", function (o) {
      const p = this.currentPlayer, fresh = !this.winner;
      return run({ actor: p.id, type: "endTurn" }, seatPrompt(p.id), () => o.call(this), () => fresh);
    });
    wrap(g, "_stTrade", function (o, [a, b, aGives, bGives]) {
      const offer = { actor: a.id, type: "offerTrade", to: [b.id], give: cleanHand(aGives), want: cleanHand(bGives) };
      emit({ a: offer, prompt: seatPrompt(a.id), legal: judge(offer, seatPrompt(a.id)), ok: true, chance: [] });
      const rsp = { actor: b.id, type: "respondTrade", offer: ++self._offerSeq, answer: "accept" };
      const lg = has(b.resources, bGives) && has(a.resources, aGives) ? { ok: true } : { ok: false, reason: "a side of the swap cannot pay" };
      emit({ a: rsp, prompt: { kind: "respondTrade", actor: b.id, offer: rsp.offer, from: a.id }, legal: lg, ok: true, chance: [] });
      return o.call(this, a, b, aGives, bGives);
    });
    wrap(g, "_aiSpecialBuild", function (o, [p]) {
      const could = self.g._sbpCanAct(p), r = o.call(this, p);
      if (could) emit({ a: { actor: p.id, type: "passSbp" }, prompt: { kind: "sbp", actor: p.id }, legal: { ok: true }, ok: true, chance: [] });
      return r;
    });
    return () => { restoreFns.reverse().forEach((f) => f()); this._obs = null; return obs.entries; };
  }
}

/** Attach an engine to a booted game object. `opts.control`: seat ids the engine decides ("all" = every seat, headless). */
export function createEngine(game, opts = {}) {
  const e = new Engine(game, { meta: opts.meta || null });
  if (opts.control) e.takeControl(opts.control);
  return e;
}

/**
 * A new game decided only through the engine. `spec`: { seats = 4, mode = "classic" | "rush", sea, map = "random" | "balanced", dice = "random" | "deck" | "balanced",
 * winPoints = 10, seed }. Same settings and seeding as the AI Lab sim, so a seed gives the same board in both. `game` must be a headless-ready
 * game (src/api/headless.js, or a lab/sim page).
 */
export function settingsFor(game, spec = {}) {
  const H = game.constructor.labHelpers, n = spec.seats ?? 4;
  return H.normalizeSettings({ ...H.DEFAULT_SETTINGS, mode: spec.mode || "classic", map: spec.map || "random", dice: spec.dice || "random", board: spec.sea ? "seafarers" : "island",
    numBots: n - 1, rushInterval: spec.rushInterval || 8, winPoints: spec.winPoints || 10, botStyleMode: "all", allPreset: "intermediate", allStrategy: { ...H.AI_PRESETS.intermediate } });
}

export function newGame(game, spec = {}) {
  const H = game.constructor.labHelpers, n = spec.seats ?? 4;
  const settings = settingsFor(game, spec);
  if (spec.seed != null) Math.random = mulberry32(Number(spec.seed) >>> 0);
  game.settings = settings;
  game.onboardingHold = true;
  game.resetGame();
  game.players.forEach((p) => { p.isHuman = false; p.strategy = { ...H.AI_PRESETS.intermediate }; p.agent = null; });
  game.onboardingHold = false;
  const meta = { seats: n, mode: spec.mode || "classic", sea: !!spec.sea, map: spec.map || "random", dice: spec.dice || "random", winPoints: spec.winPoints || 10, seed: spec.seed ?? null };
  const e = new Engine(game, { meta });
  return e.takeControl("all");
}

/**
 * Play a log (engine.log()) on a fresh game; returns the engine (engine.replayInfo = { played, skipped }). Throws on the first action the
 * engine refuses. A seat that wins is declared at once by the engine, the tap UI and the bots alike (a Knight, a bought card, each
 * free road and every build are counted the moment they happen), so a log from an older version, whose bots counted some of these only when their
 * main phase closed, may still hold actions after the winning move. With `untilWin` (default) those trailing actions of the winner are skipped instead of refused.
 */
export function replay(game, log, { untilWin = true } = {}) {
  const e = newGame(game, log.setup);
  let played = 0, skipped = 0;
  for (const it of log.actions) {
    if (untilWin && e.winner() != null) {
      if (it.a.actor !== e.winner()) throw new Error(`replay: step ${played + skipped + 1} ${JSON.stringify(it.a)} follows a win by another seat`);
      skipped++; continue;
    }
    const r = e.apply(it.a, { chance: it.chance });
    if (!r.ok) throw new Error(`replay: step ${played + skipped + 1} ${JSON.stringify(it.a)} refused: ${r.reason}`);
    played++;
  }
  e.replayInfo = { played, skipped };
  return e;
}
