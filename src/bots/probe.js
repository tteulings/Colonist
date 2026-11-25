// Phase 1 of the bot adapters (design 4.2): run one of the legacy planners ("what does this bot do now?") and get its decision back as
// a list of Actions instead of as effects. The planners decide and act in the same call (placeRoad, performBankTrade, buyDevelopmentCard,
// playDevelopmentCard, a trade's _stTrade, Seafarers placeShip / moveShip). `probe(g, fn)` runs `fn` with those calls RECORDING: they
// still run for real (the planner's next sentence depends on their effect, e.g. bank trade, then build with what the trade bought), the
// call is written down as an Action, and when `fn` returns the game is put back exactly as it was (master/sim.js snapshot / restore, the
// same codec the Master search rolls out on). The host then applies the actions through the engine, one prompt at a time.
//
// What a probe never does: change the game, draw on the engine, show anything. What it does use: the game's Math.random in the order
// the legacy code does (a planner draws its random numbers while planning, the engine's apply draws only dice and steals), which is why
// the plan can be played from the queue without planning again.
import { snapshot, restore } from "../master/sim.js";
import { Seafarers } from "../seafarers/rules.js";

let REC = null; // the recording in progress: { g, actions, depth, snap }
/** The in-app host (bots/inapp.js) mutes what a planner shows while it plans (log, sounds, stats, review recorder) and gives the engine seat control; headless: none. */
export const probeHooks = { enter: null, leave: null, verify: null };
// v1.99 "adopt the probe": a planner step that did exactly ONE of these (and the mute says nobody watches: headless) leaves the game where the
// planner put it instead of restoring and letting the host's apply do the same move again. The host then only books the action (engine.apply
// `adopted`). Proven equal to restore + apply by tests/adopt199.mjs (probeHooks.verify: both ways, every state field compared).
const ADOPT = new Set(["build", "buyDev", "tradeBank"]);
const installed = new WeakSet();

const hand = (h) => { const o = {}; Object.keys(h).forEach((k) => { if (h[k]) o[k] = h[k]; }); return o; };

function install(g) {
  if (installed.has(g)) return;
  installed.add(g);
  // a wrapper is transparent outside a probe; inside it snapshots before the first change, runs the real method and writes the action down
  const wrap = (obj, k, rec) => {
    const o = obj[k];
    obj[k] = function (a0, a1, a2) { // (every wrapped method takes at most three arguments: no rest array on the way through)
      if (!REC) return o.call(this, a0, a1, a2);
      if (!REC.snap) { REC.snap = snapshot(REC.g); REC.x = extras(REC.g); }
      const a = [a0, a1, a2], r = o.call(this, a0, a1, a2);
      if (r !== false && REC.depth === 0) { const act = rec(a, r, this); if (act) REC.actions.push(act); }
      return r;
    };
  };
  wrap(g, "placeRoad", ([p, edge, opts = {}]) => (opts.setupNode != null ? null : { actor: p.id, type: "build", piece: "road", edge }));
  wrap(g, "placeSettlement", ([p, node, setup]) => (setup ? null : { actor: p.id, type: "build", piece: "settlement", node }));
  wrap(g, "placeCity", ([p, node]) => ({ actor: p.id, type: "build", piece: "city", node }));
  wrap(g, "performBankTrade", ([p, give, get]) => ({ actor: p.id, type: "tradeBank", give, get }));
  wrap(g, "buyDevelopmentCard", ([p]) => ({ actor: p.id, type: "buyDev" }));
  const P = Seafarers.prototype;
  wrap(P, "placeShip", ([p, edge, opts = {}]) => (opts.setupNode != null ? null : { actor: p.id, type: "build", piece: "ship", edge }));
  wrap(P, "moveShip", ([p, from, to]) => ({ actor: p.id, type: "moveShip", from, to }));
  // a card: its own free roads / picks / robber are the prompts it opens, not part of the plan
  const pdc = g.playDevelopmentCard;
  g.playDevelopmentCard = function (p, card) {
    if (!REC) return pdc.call(this, p, card);
    if (!REC.snap) { REC.snap = snapshot(REC.g); REC.x = extras(REC.g); }
    REC.depth++;
    let r; try { r = pdc.call(this, p, card); } finally { REC.depth--; }
    if (r !== false && REC.depth === 0) REC.actions.push({ actor: p.id, type: "playDev", card });
    return r;
  };
  // a bot-to-bot deal: the planner has already chosen the partner (who said yes); the swap itself is the engine's
  // the public card tracker is read-modify-write state (a read reconciles it with the hand sizes) that the sim snapshot cannot give back without
  // changing what the next read finds; a probe therefore leaves the tracker exactly as the planner left it, and the engine's apply of the actions
  // the planner already carried out (flag g.__noTrk, set by the bot, cleared by the host; _aiTrkNote itself checks it) does not note them a second time.
  const st = g._stTrade;
  g._stTrade = function (a, b, aGives, bGives) {
    if (REC && REC.depth === 0) { if (!REC.snap) { REC.snap = snapshot(REC.g); REC.x = extras(REC.g); } REC.actions.push({ actor: a.id, type: "offerTrade", to: [b.id], give: hand(aGives), want: hand(bGives) }); }
    return st.call(this, a, b, aGives, bGives);
  };
}

/**
 * Run `fn()` (a legacy planner step) and return { result, actions }. The game is restored afterwards, so a probe is a pure question;
 * `eager` snapshots before `fn` starts (needed when the planner changes the game before its first recorded call, as a trade's tracker notes do).
 */
export function probe(g, fn, { eager = false, suspend = false, adopt = false } = {}) {
  install(g);
  if (REC) throw new Error("probe: nested");
  const rec = (REC = { g, actions: [], depth: 0, snap: eager ? snapshot(g) : null, x: eager ? extras(g) : null });
  const api = g.__api, act = api?.active;
  if (suspend && api) api.active = null; // the engine's seat control is off: every bot seat is a bot again (a deal asks the partner bot, not "a person")
  g.__probing = true; // the golden harness's move log skips what a probe does
  let result, mute = null, done = false, adopted = false;
  try { mute = probeHooks.enter ? probeHooks.enter(g, { suspend }) : null; result = fn(); done = true; } finally {
    REC = null; g.__probing = false; if (api) api.active = act;
    if (rec.snap) {
      adopted = done && adopt && rec.actions.length === 1 && ADOPT.has(rec.actions[0].type) && !!mute?.headless && !g.winner && !g.sbp; // the 5-6 build window books a seat's build in the apply (sbp.human.built)
      const V = probeHooks.verify;
      if (adopted && V) V.pending = { a: rec.actions[0], rewind: () => { const trk = g._aiCardTrack; restore(g, rec.snap); putExtras(g, rec.x); g._aiCardTrack = trk; } }; // verify: the host plays it both ways and compares
      if (!adopted) { const trk = g._aiCardTrack; restore(g, rec.snap); putExtras(g, rec.x); g._aiCardTrack = trk; }
    }
    if (mute && probeHooks.leave) probeHooks.leave(g, mute);
  }
  return adopted ? { result, actions: rec.actions, adopted: true } : { result, actions: rec.actions };
}

/**
 * Run `fn` with the engine's seat control off: a search runs its own playouts on the game object, where seats play themselves and timers run at
 * once again, and it must see the position as the legacy bot saw it (a robber or a set-up spot is being decided, nothing "is waiting for a tap").
 */
export function suspended(g, fn) {
  const api = g.__api, act = api?.active;
  if (!api) return fn();
  const swap = api.laterSaved, cur = g._later, own = Object.prototype.hasOwnProperty.call(g, "_later");
  const keep = { pendingAction: g.pendingAction, robberContext: g.robberContext, setupAction: g.setupAction, moveSel: g.sea ? g.sea.moveSel : undefined };
  api.active = null;
  g.pendingAction = null; g.robberContext = null; g.setupAction = null; if (g.sea) g.sea.moveSel = null;
  if (swap) { if (api.later0 !== undefined) g._later = api.later0; else delete g._later; }
  try { return fn(); } finally {
    api.active = act;
    g.pendingAction = keep.pendingAction; g.robberContext = keep.robberContext; g.setupAction = keep.setupAction; if (g.sea) g.sea.moveSel = keep.moveSel;
    if (swap) { if (own) g._later = cur; else delete g._later; }
  }
}

// state a card's interactive branch sets that the sim snapshot does not carry (the engine's own save lists the same)
const extras = (g) => ({ devPick: g.devPick ? JSON.parse(JSON.stringify(g.devPick)) : null, victims: (g.robberVictimOptions || []).slice(), busy: g.robberBusy, thief: g.sea ? g.sea.thief : null });
const putExtras = (g, x) => { g.devPick = x.devPick; g.robberVictimOptions = x.victims; g.robberBusy = x.busy; if (g.sea) g.sea.thief = x.thief; };
