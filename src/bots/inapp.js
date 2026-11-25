// The bot host in the app (architecture step 4, follow-up): a bot's main phase in a game you are playing is decided by Bot.decide, judged by the
// engine (isLegal) and then applied (apply), exactly like the headless host loop (host.js), while everything the app puts around a bot's turn
// stays where it was: the dice animation and the pause before the first move (game.js autoPlayCurrentTurn), the card for a deal asked of a person,
// the log, the sounds, the stats and review recorders, the end of the turn. What this module adds is only the glue:
//
//   * AppEngine: the engine the host applies through. A bot seat's moves are carried out by the doors the old bots used (tryBuildSettlement, _aiBuildRoad,
//     performBankTrade, ...), not by the doors a tap uses (_commitBuild would show an Undo bar and save / draw after every piece).
//   * the probe's mute: a planner step is run on the game and put back (probe.js); here, while it runs, the log, sounds, toasts, stats and the review
//     recorder are switched off, so what the app shows and records is what the apply does (once), not what the planning did.
//   * the flag HOST_INAPP: per mode, so a mode that is not proven identical stays on the old driver.
//
// Flag: window.__HOST_INAPP or localStorage "colonist.hostInApp": "0" (old driver everywhere), "1" (every mode this module supports), or a list of
// modes "classic,sea,six". Unset: HOST_DEFAULT.
import { Engine } from "../api/engine.js";
import { legacyBot } from "./legacy.js";
import { hostStep, newHost } from "./host.js";
import { probeHooks } from "./probe.js";
import { getBot } from "./registry.js";

/** Modes whose in-app bot turns are proven identical to the old driver (tests/inapp197.js); the rest never leaves it. */
export const HOST_DEFAULT = { classic: false, sea: false, six: false }; // v1.97: off unless colonist.hostInApp enables it (it cost +18..61% CPU on a throttled phone)
export const HOST_MODES = ["classic", "sea", "six"];

function flag() {
  try {
    const w = typeof window !== "undefined" ? window.__HOST_INAPP : undefined;
    if (w !== undefined && w !== null) return String(w);
    const s = typeof localStorage !== "undefined" ? localStorage.getItem("colonist.hostInApp") : null;
    return s == null ? null : s;
  } catch (_) { return null; }
}
/** The mode of a game as the flag names it. */
export const modeOf = (g) => (g.isRush?.() ? "rush" : g.sea ? "sea" : g.players.length > 4 ? "six" : "classic");
/** Does the host drive the bot turns of this game? Only the game on the screen (not the AI Lab's or the review's headless games), no bot with a search agent. */
export function hostOn(g, player = null) {
  if (g._hostBroken || g.labMode || g._labSim || g._replay || (player && (player.agent || (player.isHuman && !g.autoplayInterval))) || typeof window === "undefined" || window.__colonistGame !== g) return false;
  const f = flag(), m = modeOf(g);
  if (f === "0" || f === "off" || f === "false") return false;
  if (f === "1" || f === "on" || f === "true" || f === "all") return HOST_MODES.includes(m);
  if (f) return f.split(",").map((x) => x.trim()).includes(m);
  return !!HOST_DEFAULT[m];
}

// ── the mute ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Things a planner's own moves touch that sim snapshot / restore does not give back (the log, the sounds, the stats events, the review's records,
// the animations): switched off while a probe runs, so only the apply shows them. Same list the AI Lab's headless frame stubs (ai-analysis.js _labSimStubs).
const NOOP = () => {};
const QUIET = new Proxy({}, { get: () => NOOP });
const SILENT_FNS = ["addLog", "render", "drawCanvasScene", "showResourceGainToasts", "_showStealAnimation", "_animateTradeCards", "_showDevCardPopup", "showGameOverOverlay", "pushToast",
  "saveToStorage", "_queueSave", "_renderAnalysis", "requestBoardDraw", "_animateCardDeal", "animateResourceGain", "_flashPrompt"];
const SILENT_OBJS = ["sfx", "fx"];
const SILENT_SUBS = ["log", "sfx", "fx", "anim", "stats"]; // the emitter's presentation subscribers (the card tracker "trk" stays: it is the bots' own knowledge)
const FLAGS = { _replay: true, _rvBusy: "probe" }; // stats recorder off; the review recorder busy

function mute(g, { suspend }) {
  const live = app.has(g); // the game on the screen; any other (the AI Lab's sim frame, a headless game) is stubbed already and only needs its recorders told a probe is no move
  if (!live) { // headless (every probe of a lab / tournament game): the three flags, without the closures of the general path
    const has = Object.prototype.hasOwnProperty, own = { _replay: has.call(g, "_replay"), _rvBusy: has.call(g, "_rvBusy"), _stMover: has.call(g, "_stMover") };
    const saved = { _replay: g._replay, _rvBusy: g._rvBusy, _stMover: g._stMover };
    g._replay = true; g._rvBusy = "probe";
    return { own, saved, anims: null, api: null, keepActive: null, headless: true };
  }
  const own = {}, saved = {};
  const swap = (k, v) => { own[k] = Object.prototype.hasOwnProperty.call(g, k); saved[k] = g[k]; g[k] = v; };
  SILENT_FNS.forEach((k) => swap(k, NOOP));
  SILENT_OBJS.forEach((k) => { if (g[k]) swap(k, QUIET); });
  const bus = g.events, mutedBefore = bus?.muted ? new Set(bus.muted) : null;
  if (bus?.mute) SILENT_SUBS.forEach((n) => bus.mute(n)); // emit() reaches no journal / sound / animation / stats subscriber while a probe runs
  Object.keys(FLAGS).forEach((k) => swap(k, FLAGS[k]));
  swap("_stMover", g._stMover);
  const anims = g.placementAnims ? g.placementAnims.slice() : null;
  const api = g.__api, eng = app.get(g)?.engine;
  const keepActive = api ? api.active : null;
  if (api && eng && !suspend) { eng.actor = app.get(g).seat; api.active = eng; } // seat control: a card stops at the prompts it opens (the apply plays them out)
  return { own, saved, anims, api, keepActive, bus, mutedBefore };
}
function unmute(g, m) {
  Object.keys(m.saved).forEach((k) => { if (m.own[k]) g[k] = m.saved[k]; else delete g[k]; });
  if (m.bus?.unmuteAll) m.bus.unmuteAll(m.mutedBefore);
  if (m.anims) g.placementAnims.splice(0, g.placementAnims.length, ...m.anims); // restore() empties the list
  if (m.api) m.api.active = m.keepActive;
}

// ── the engine ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
class AppEngine extends Engine {
  constructor(g) {
    super(g, { meta: { host: "app" } });
    this.legacyBotOrder = true;
    this.H.active = null; // the seat control is on only while a planner runs (mute); an apply plays a card out as the old bots did
    this.actor = null;
  }
  _enter() { return this; }
  controls(seat) { return seat === this.actor; }
  // the old bots' doors: each is the whole move (pay, log, sound, scores, win check) as the planner made it
  _do_build(a, p) {
    const g = this.g;
    if (a.piece === "road") return g._aiBuildRoad(p, a.edge);
    if (a.piece === "settlement") return g.tryBuildSettlement(p, a.node);
    if (a.piece === "city") return g.tryBuildCity(p, a.node);
    if (a.piece === "ship") return g.sea.aiBuildShip(p, a.edge);
    return false;
  }
  _do_moveShip(a, p) {
    const g = this.g;
    if (!g.sea.moveShip(p, a.from, a.to)) return false;
    g.emit({ type: "shipMoved", seat: p.id, from: a.from, to: a.to }); // the journal line and the sound are its subscribers
    g.recomputeScores();
    g.checkForWinner(p);
    return true;
  }
  _do_tradeBank(a, p) { return !!this.g.performBankTrade(p, a.give, a.get); }
  _do_buyDev(a, p) { return !!this.g.buyDevelopmentCard(p); }
  _do_playDev(a, p) { return !!this.g.playDevelopmentCard(p, a.card); } // a card and the robber / free roads / picks it opens, in one call
  // a deal the planner agreed with its partner (a bot): the swap, the one stats event and the one log line the old planner made (its tracker notes were made while planning)
  _do_offerTrade(a, p) {
    const g = this.g, q = g.players[a.to[0]];
    g._stTrade(p, q, a.give, a.want);
    RES.forEach((r) => { const give = a.give[r] || 0, want = a.want[r] || 0; p.resources[r] += want - give; q.resources[r] += give - want; });
    g.emit({ type: "traded", seat: p.id, partner: q.id, gave: a.give, got: a.want, style: "api" });
  }
  // the end of a main phase: the scores are counted once and a win is looked for; the caller (game.js) ends the turn when it is time to
  _do_endTurn(a, p) { const g = this.g; this._offers = []; g.recomputeScores(); g.checkForWinner(p); }
}

// ── the host in a game ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
probeHooks.enter = mute; probeHooks.leave = unmute;
const app = new WeakMap(); // game -> { engine, host, bots: Map(seat -> { key, bot }), seat }
function appFor(g) {
  let A = app.get(g);
  if (!A) {
    A = { engine: new AppEngine(g), host: newHost({ humanTrade: true, strict: true }), bots: new Map(), seat: null };
    app.set(g, A);
  }
  return A;
}
/** A bot for this seat: the legacy planner of its dials (the registry's adapter), kept for as long as the seat's strategy stays the same object. */
function botFor(A, p) {
  const st = p.strategy || {};
  let b = A.bots.get(p.id);
  if (!b || b.key !== st) {
    const meta = { id: "app", name: p.name, level: 3, needs: {} };
    b = { key: st, bot: legacyBot(meta, {}) };
    A.bots.set(p.id, b);
  }
  return b.bot;
}

/**
 * A bot's main phase, played by the host. Returns "done" (the scores are counted: the caller ends the turn), "async" (a deal is asked of the person
 * at the table: `then` is called with the turn's continuation) or null (not a turn the host plays: the old driver does it).
 * `onHuman(trade, resume)`: the caller shows the card; `resume()` carries on the turn once it is answered (without asking for a deal again).
 */
export function mainPhase(g, player, skipTrade = false) {
  const A = appFor(g);
  const { engine, host } = A;
  const seat = player.id;
  if (g.phase !== "main" || g.currentPlayer !== player) return null;
  const bot = botFor(A, player);
  bot.begin(seat, { skipTrade });
  const bots = { [seat]: bot };
  for (let guard = 0; guard < 400; guard++) {
    A.seat = seat; engine.actor = seat;
    let r;
    try { r = hostStep(engine, bots, host); } finally { engine.actor = null; if (engine._log.length > 64) engine._log.length = 0; }
    if (r === null) return guard === 0 ? null : "done";
    host.used = (host.used || 0) + 1; if (typeof window !== "undefined") window.__hostSteps = host.used; // (the tests read it)
    if (r.type === "pause") return { human: r.trade };
    if (r.type === "endTurn") return "done";
  }
  return "done";
}
/** The host threw (or a bot's answer was refused): put back what a planner's mute and the host's seat control change, so the old driver can take the phase over. */
export function hostRecover(g) {
  const A = app.get(g);
  if (A) { A.engine.actor = null; A.seat = null; if (A.engine._log) A.engine._log.length = 0; }
  try { g.events?.unmuteAll?.(null); } catch (_) { /* nothing to put back */ }
  g.__noTrk = false;
}
export { getBot };
