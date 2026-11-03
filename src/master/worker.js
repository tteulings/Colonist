// v0.90 Master bot: the Web Worker. It owns a private, headless copy of the game (src/game.js against a stub
// DOM, made synchronous by the lab's "sim" stubs) and runs the search there, so the page keeps animating.
// It never sees more than the bot may: opponents' hands, dev cards and the deck are re-dealt in every
// future from the public card tracker (sent along as `trk`).
//   → { type: "decide", id, kind: "setup" | "main" | "robber", state, trk, turnSerial, seat, opts, lab }
//   ← { type: "decision", id, kind, choice, record }          (choice null: nothing to choose between)
//   → { type: "game", id, seed, strategies: [4], opts }        (lab tournament: one whole game)
//   ← { type: "game", id, winner, turns, vp, ms, stats }
//   → { type: "detect", id, base, recs }                        (v1.02 review: the person's missed chances)
//   ← { type: "detect", id, findings, ms }
//   ← { type: "ready" } once loaded, { type: "error", id, message } on failure
import "./dom.js";
await import("../game.js"); // constructs a stub game as self.__colonistGame (no page, no saving)
const { makeMaster, prepareEngine } = await import("./search.js");
const { detectMissed } = await import("../review/detect.js");
const { loadPosition, loadRecord } = await import("../review/engine.js");
const g = prepareEngine(self.__colonistGame);
g._rvOff = true; // v1.02: this copy never records a review
const H = g.constructor.labHelpers;
g.analysis = { on: false, paused: false, budget: 0, parked: null, last: null, seq: 0, min: false, lab: null, capture: false };

/** Load the page's position (src/review/engine.js; the review's detectors use the same loader). */
const load = (m) => loadPosition(g, m);

function decide(m) {
  const P = load(m);
  const agent = makeMaster(m.opts || {});
  let d = null;
  if (m.kind === "setup") d = agent.decideSetup(g, P, g._masterBaseInit);
  else if (m.kind === "robber") d = agent.decideRobber(g, P);
  else d = agent.decideMain(g, P);
  return { choice: d ? d.choice : null, record: d ? d.record : null };
}

function detect(m) {
  const t0 = performance.now();
  const findings = detectMissed(g, m.recs, (rec) => loadRecord(g, m.base, rec), m.opts || {});
  return { findings, ms: Math.round(performance.now() - t0) };
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
    else if (m.type === "detect") self.postMessage({ type: "detect", id: m.id, ...detect(m) });
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, message: String(err && err.stack || err) });
  }
};
self.postMessage({ type: "ready" });
