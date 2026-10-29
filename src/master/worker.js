// v0.90 Master bot: the Web Worker. It owns a private, headless copy of the game (src/game.js against a stub
// DOM, made synchronous by the lab's "sim" stubs) and runs the search there, so the page keeps animating.
// It never sees more than the bot may: opponents' hands, dev cards and the deck are re-dealt in every
// future from the public card tracker (sent along as `trk`).
//   → { type: "decide", id, kind: "setup" | "main" | "robber", state, trk, turnSerial, seat, opts, lab }
//   ← { type: "decision", id, kind, choice, record }          (choice null: nothing to choose between)
//   → { type: "game", id, seed, strategies: [4], opts }        (lab tournament: one whole game)
//   ← { type: "game", id, winner, turns, vp, ms, stats }
//   ← { type: "ready" } once loaded, { type: "error", id, message } on failure
import "./dom.js";
await import("../game.js"); // constructs a stub game as self.__colonistGame (no page, no saving)
const { makeMaster, prepareEngine } = await import("./search.js");
const g = prepareEngine(self.__colonistGame);
const H = g.constructor.labHelpers;
g.analysis = { on: false, paused: false, budget: 0, parked: null, last: null, seq: 0, min: false, lab: null, capture: false };

/** Load the page's position. Lab boards past set-up can still ask for a set-up spot ("as if" one more). */
function load(m) {
  g.onboardingHold = true; // loadFromStorage must not continue the game by itself
  g.loadFromStorage(JSON.parse(JSON.stringify(m.state)));
  g.onboardingHold = false;
  g.players.forEach((p) => { p.isHuman = false; p.agent = null; if (!p.strategy) p.strategy = { ...H.AI_PRESETS.intermediate }; });
  g.turnSerial = m.turnSerial || 0;
  g._aiCardTrack = Array.isArray(m.trk) && m.trk.length === g.players.length ? { players: g.players, est: m.trk.map((e) => ({ ...e })) } : null;
  g.robberVictimOptions = [];
  g.pendingRobberFlow = null;
  const P = g.players[m.seat];
  if (m.lab) { // AI Lab: decide for this seat as if it were its turn
    g.winner = null;
    g.currentPlayerIndex = m.seat;
    g.pendingAction = null;
    if (m.kind === "setup") {
      const need = (p) => Math.max(0, 2 - p.settlements.size - p.cities.size);
      const ids = g.players.map((p, i) => g.players[(m.seat + i) % g.players.length].id);
      const left = new Map(ids.map((id) => [id, need(g.players[id])]));
      const q = [];
      [...ids, ...ids.slice().reverse()].forEach((id) => { if (left.get(id) > 0) { q.push(id); left.set(id, left.get(id) - 1); } });
      if (q[0] !== m.seat) q.unshift(m.seat);
      g.setupPhase = true; g.setupQueue = q; g.setupStep = 0; g.setupAction = null;
    } else { g.setupPhase = false; g.phase = "main"; }
  }
  return P;
}

function decide(m) {
  const P = load(m);
  const agent = makeMaster(m.opts || {});
  let d = null;
  if (m.kind === "setup") d = agent.decideSetup(g, P, g._masterBaseInit);
  else if (m.kind === "robber") d = agent.decideRobber(g, P);
  else d = agent.decideMain(g, P);
  return { choice: d ? d.choice : null, record: d ? d.record : null };
}

/** One whole lab-tournament game (same board and dice stream as the lab's own headless engine). */
function playGame(m) {
  const t0 = performance.now();
  const orig = Math.random;
  const agents = m.strategies.map((s) => (s.policy === "master" ? makeMaster(m.opts || {}) : null));
  try {
    g._labSimStart(m.strategies, { players: 4, map: m.map || "random", seed: m.seed, agents });
    let r = { done: false };
    while (!r.done) r = g._labSimStep(40);
    return { winner: r.winner, turns: r.turns, vp: g.players.map((p) => p.victoryPoints), ms: Math.round(performance.now() - t0),
      stats: agents.map((a) => (a ? { d: a.stats.decisions, dev: a.stats.deviations, ms: a.stats.ms } : null)) };
  } finally { Math.random = orig; g.players.forEach((p) => { p.agent = null; }); }
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === "decide") self.postMessage({ type: "decision", id: m.id, kind: m.kind, ...decide(m) });
    else if (m.type === "game") self.postMessage({ type: "game", id: m.id, ...playGame(m) });
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, message: String(err && err.stack || err) });
  }
};
self.postMessage({ type: "ready" });
