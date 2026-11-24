// Action API (architecture step 2): the JSON catalogue of actions and prompts, and the validators. Pure data and functions: no game, no DOM,
// no imports beyond the rule constants, so a bot, a worker or a test can use it on its own.
//
//   action  = { actor: seat, type, ...fields }          what a seat does (never how it looks)
//   prompt  = { kind, actor, ...context }               what the engine asks a seat right now (src/api/engine.js prompt())
//   events  = JSON facts the engine reports back from apply()
//
// Modes: classic, Rush (no turns), Seafarers (ships, pirate, gold), 5-6 players (Special Building Phase). A mode is a flag set
// { rush, sea, big }; `modeAllows(type, mode)` says whether an action type exists there at all.
import { RESOURCES, DEV_CARD_TYPES } from "../core/constants.js";

export const RES = RESOURCES;
export const DEV_TYPES = DEV_CARD_TYPES; // the four cards that are played (victory points are held, never played)

/** Prompt kinds: who is asked, when, and which action types may answer (design section 1.2). */
export const PROMPTS = {
  setupSettlement: { types: ["place"], desc: "set-up: place a settlement" },
  setupRoad: { types: ["place"], desc: "set-up: place the road (Seafarers: or a ship) next to the new settlement" },
  preRoll: { types: ["roll", "playDev"], desc: "before the dice: roll (or play a Knight)" },
  main: { types: ["build", "moveShip", "buyDev", "playDev", "tradeBank", "offerTrade", "cancelOffer", "endTurn"], desc: "the turn: build, buy, trade, play, end" },
  discard: { types: ["discard"], desc: "a 7: hand back half of an over-limit hand" },
  moveRobber: { types: ["moveRobber"], desc: "move the robber (Seafarers: or the pirate)" },
  steal: { types: ["steal"], desc: "several victims on the tile: choose whom to rob" },
  respondTrade: { types: ["respondTrade"], desc: "answer an open trade offer" },
  freeRoad: { types: ["build", "skipFree"], desc: "Road Building: place a free road (Seafarers: or ship)" },
  yearOfPlenty: { types: ["pick"], desc: "Year of Plenty: take two cards from the bank" },
  monopoly: { types: ["pick"], desc: "Monopoly: name one resource" },
  chooseGold: { types: ["pickGold"], desc: "Seafarers: choose the cards a gold field pays" },
  sbp: { types: ["build", "buyDev", "passSbp"], desc: "5-6 players: Special Building Phase window (no trade, no dev cards played)" },
  rushAny: { types: ["build", "moveShip", "buyDev", "playDev", "tradeBank", "offerTrade", "cancelOffer", "ready"], desc: "Rush: any seat, any time between rolls" },
};

// ── field checkers ──
const isInt = (v) => Number.isInteger(v) && v >= 0;
const isRes = (v) => RES.includes(v);
const isHand = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => isRes(k) && isInt(v[k]));
const isResList = (v) => Array.isArray(v) && v.length > 0 && v.every(isRes);
const oneOf = (...xs) => (v) => xs.includes(v);
const F = {
  seat: isInt, id: isInt, res: isRes, hand: isHand, resList: isResList,
  piece: oneOf("settlement", "road", "ship"), buildPiece: oneOf("settlement", "road", "city", "ship"),
  card: oneOf(...DEV_TYPES), answer: oneOf("accept", "reject", "counter"), target: oneOf("robber", "pirate"),
  to: (v) => v === "all" || (Array.isArray(v) && v.length > 0 && v.every(isInt)),
  forced: (v) => Array.isArray(v) && v.length === 2 && v.every((d) => Number.isInteger(d) && d >= 1 && d <= 6),
};

/**
 * The catalogue. req/opt: field name -> checker name. `modes` (optional): flags the mode must have. `host: true`: never a seat's choice.
 * `chance`: the outcome the engine draws (or takes from `apply(a, {chance})` / a forced source).
 */
export const ACTIONS = {
  place: { req: { piece: "piece" }, opt: { node: "id", edge: "id" }, desc: "set-up placement; the set-up flag is implied by the prompt" },
  roll: { req: {}, opt: { forced: "forced" }, chance: "dice", desc: "roll the dice (forced = replay / what-if only)" },
  endTurn: { req: {}, opt: {}, desc: "pass the dice" },
  ready: { req: {}, opt: {}, modes: { rush: true }, desc: "Rush: vote to roll now" },
  build: { req: { piece: "buildPiece" }, opt: { node: "id", edge: "id" }, desc: "road / settlement / city / ship; free under the freeRoad prompt" },
  moveShip: { req: { from: "id", to: "id" }, opt: {}, modes: { sea: true }, desc: "Seafarers: move an open-ended ship" },
  buyDev: { req: {}, opt: {}, chance: "devDraw", desc: "buy the top development card" },
  playDev: { req: { card: "card" }, opt: {}, desc: "play a development card (then the prompts it opens)" },
  pick: { req: {}, opt: { resources: "resList", resource: "res" }, desc: "Year of Plenty (resources: two) or Monopoly (resource)" },
  tradeBank: { req: { give: "res", get: "res" }, opt: {}, desc: "maritime trade at the best rate the seat has" },
  offerTrade: { req: { to: "to", give: "hand", want: "hand" }, opt: {}, desc: "offer cards to some or all seats" },
  respondTrade: { req: { offer: "id", answer: "answer" }, opt: { give: "hand", want: "hand" }, desc: "accept / reject / counter (a counter carries give and want from the responder's side)" },
  cancelOffer: { req: { offer: "id" }, opt: {}, desc: "withdraw an open offer" },
  discard: { req: { cards: "hand" }, opt: {}, desc: "hand back exactly the asked number of cards" },
  moveRobber: { req: { hex: "id" }, opt: { target: "target" }, chance: "steal", desc: "move the robber (Seafarers: target robber|pirate); a single victim is robbed at once" },
  steal: { req: { victim: "seat" }, opt: {}, chance: "steal", desc: "rob this player (one random card)" },
  pickGold: { req: { resources: "resList" }, opt: {}, modes: { sea: true }, desc: "Seafarers gold field: choose the cards" },
  skipFree: { req: {}, opt: {}, desc: "Road Building without a legal spot: forfeit the free road" },
  passSbp: { req: {}, opt: {}, modes: { big: true, rush: false }, desc: "5-6 players: end this seat's build window" },
  // host-only inputs: the clock and the table, never a seat's decision. Listed so a log can carry them; apply() refuses them from seats.
  tick: { req: { dtMs: "id" }, opt: {}, host: true, desc: "Rush clock input (not implemented over the legacy class, see engine.js notes)" },
  timeout: { req: { prompt: "id" }, opt: {}, host: true, desc: "apply the default action of a prompt that timed out" },
};
export const ACTION_TYPES = Object.keys(ACTIONS);
export const SEAT_ACTION_TYPES = ACTION_TYPES.filter((t) => !ACTIONS[t].host);

/** Does this action type exist in the mode? mode = { rush, sea, big }. */
const ENTRIES = new Map(); // spec -> { req: [[field, check]...], modes: [[flag, want]...] }, built once (validateShape runs on every judged action)
const entriesOf = (spec) => { let e = ENTRIES.get(spec); if (!e) ENTRIES.set(spec, (e = { req: Object.entries(spec.req), modes: Object.entries(spec.modes || {}) })); return e; };
export function modeAllows(type, mode) {
  const spec = ACTIONS[type];
  if (!spec) return false;
  const ms = entriesOf(spec).modes;
  for (let i = 0; i < ms.length; i++) if (!!mode[ms[i][0]] !== ms[i][1]) return false;
  return true;
}

/** Static check of an action's shape (and of the mode it is used in). Never looks at a game state. */
export function validateShape(a, mode = { rush: false, sea: false, big: false }) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return { ok: false, reason: "an action is an object" };
  const spec = ACTIONS[a.type];
  if (!spec) return { ok: false, reason: `unknown action type ${JSON.stringify(a.type)}` };
  if (spec.host) return { ok: false, reason: `${a.type} is a host input, not a seat action` };
  if (!F.seat(a.actor)) return { ok: false, reason: "actor must be a seat id" };
  if (!modeAllows(a.type, mode)) return { ok: false, reason: `${a.type} does not exist in this mode` };
  for (const [k, c] of entriesOf(spec).req) if (!(k in a) || !F[c](a[k])) return { ok: false, reason: `${a.type}.${k} is missing or not a ${c}` };
  for (const k of Object.keys(a)) {
    if (k === "type" || k === "actor") continue;
    const c = spec.req[k] || spec.opt[k];
    if (!c) return { ok: false, reason: `${a.type} has no field ${k}` };
    if (!F[c](a[k])) return { ok: false, reason: `${a.type}.${k} is not a ${c}` };
  }
  switch (a.type) {
    case "place": case "build": {
      const edgeLike = a.piece === "road" || a.piece === "ship";
      if (a.piece === "ship" && !mode.sea) return { ok: false, reason: "ships exist in Seafarers only" };
      if (a.type === "place" && a.piece === "city") return { ok: false, reason: "no city in set-up" };
      if (edgeLike ? a.edge == null || a.node != null : a.node == null || a.edge != null) return { ok: false, reason: `${a.piece} needs ${edgeLike ? "edge" : "node"} only` };
      break;
    }
    case "pick":
      if ((a.resources == null) === (a.resource == null)) return { ok: false, reason: "pick needs resources (Year of Plenty) or resource (Monopoly)" };
      if (a.resources && a.resources.length !== 2 && a.resources.length !== 1) return { ok: false, reason: "Year of Plenty takes one or two cards" };
      break;
    case "tradeBank": if (a.give === a.get) return { ok: false, reason: "give and get differ" }; break;
    case "offerTrade":
      if (handSize(a.give) === 0 || handSize(a.want) === 0) return { ok: false, reason: "an offer gives and asks at least one card" };
      if (RES.some((r) => a.give[r] > 0 && a.want[r] > 0)) return { ok: false, reason: "cannot give and ask the same resource" };
      if (Array.isArray(a.to) && a.to.includes(a.actor)) return { ok: false, reason: "cannot offer to yourself" };
      break;
    case "respondTrade":
      if ((a.answer === "counter") !== (a.give != null && a.want != null)) return { ok: false, reason: "only a counter carries give and want" };
      break;
    case "moveRobber": if (a.target === "pirate" && !mode.sea) return { ok: false, reason: "no pirate outside Seafarers" }; break;
    case "discard": if (handSize(a.cards) === 0) return { ok: false, reason: "discard at least one card" }; break;
    default: break;
  }
  return { ok: true };
}

export const handSize = (h) => RES.reduce((n, r) => n + (h[r] || 0), 0);
export const emptyHand = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });
/** a hand with the zeros left out, resource order fixed (canonical) */
export const cleanHand = (h) => { const o = {}; RES.forEach((r) => { if (h?.[r]) o[r] = h[r]; }); return o; };

/** Canonical string of an action (stable key order, zero entries dropped): equal actions have equal keys. */
export function actionKey(a) {
  const o = {};
  Object.keys(a).sort().forEach((k) => {
    const v = a[k];
    if (v == null) return;
    o[k] = k === "give" || k === "want" || k === "cards" ? cleanHand(v) : k === "resources" ? [...v].sort() : v;
  });
  return JSON.stringify(o);
}

/** The catalogue as plain JSON (for docs, bots and tools). */
export function catalogue() {
  return { actions: JSON.parse(JSON.stringify(ACTIONS)), prompts: JSON.parse(JSON.stringify(PROMPTS)) };
}
