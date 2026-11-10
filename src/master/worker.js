// v0.90 Master bot: the Web Worker. It owns a private, headless copy of the game (src/game.js against a stub
// DOM, made synchronous by the lab's "sim" stubs) and runs the search there, so the page keeps animating.
// It never sees more than the bot may: opponents' hands, dev cards and the deck are re-dealt in every
// future from the public card tracker (sent along as `trk`).
//   → { type: "decide", id, kind: "setup" | "main" | "robber", state, trk, turnSerial, seat, opts, lab }
//   ← { type: "decision", id, kind, choice, record }          (choice null: nothing to choose between)
//   → { type: "game", id, seed, strategies: [4], opts }        (lab tournament: one whole game)
//   ← { type: "progress", id, turn, setup, vp, think, d, state? }  (lab-131: while that game runs; `state` only with m.watch)
//   ← { type: "game", id, winner, turns, vp, ms, stats }
//   → { type: "detect", id, base, recs }                        (v1.02 review: the person's missed chances)
//   ← { type: "detect", id, findings, ms }
//   → { type: "evaluate", id, base, rec, opts }                 (v1.03 Game review: one decision, Monte Carlo)
//   ← { type: "evaluate", id, result }
//   → { type: "sprep" | "srun" | "send", sid, ... }               (eng-130 Grandmaster: a share of one parallel search, src/master/parallel.js)
//   → { type: "luck", id, base, ev, opts }                      (v1.31 luck in win chance: one chance event, src/review/luck-mc.js)
//   ← { type: "luck", id, result }
//   ← { type: "ready" } once loaded, { type: "error", id, message } on failure
import "./dom.js";
await import("../game.js"); // constructs a stub game as self.__colonistGame (no page, no saving)
const { makeMaster, prepareEngine } = await import("./search.js");
const { detectMissed } = await import("../review/detect.js");
const { loadPosition, loadRecord } = await import("../review/engine.js");
const { evaluateRecord } = await import("../review/evaluate.js");
const { luckEvent } = await import("../review/luck-mc.js");
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

// eng-130 Grandmaster: a share of one decision's futures (src/master/parallel.js coordinates; see agent.session in search.js)
const sessions = new Map();
let loadedSid = null;
function sprep(m) {
  const P = load(m);
  loadedSid = null;
  const agent = makeMaster(m.opts || {});
  const S = agent.session(g, P, m.kind, g._masterBaseInit);
  if (!S) return { K: 0 };
  sessions.set(m.sid, { m, agent, S });
  while (sessions.size > 6) sessions.delete(sessions.keys().next().value);
  loadedSid = m.sid;
  const named = S.P.named();
  return { K: S.K, depth: S.depth, kind: S.P.kind, named, choices: S.P.cands.map((_, k) => S.P.choiceOf(k)), sig: JSON.stringify(named.map((x) => x.label)) };
}
function srun(m) {
  const x = sessions.get(m.sid);
  if (!x) throw new Error("no such search session");
  if (loadedSid !== m.sid) { load(x.m); loadedSid = m.sid; } // another request used this copy in between: the same position again
  return x.agent.sessionRun(g, x.S, m.alive, m.js, m.budgetMs ?? Infinity, !!m.force);
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
  // v1.13: a Super Expert seat searches with its own (bigger) budget (m.budgets[i]); a Master with m.opts
  const agents = m.strategies.map((s, i) => (s.policy === "master" || s.policy === "super" || s.policy === "superplus" || s.policy === "grandmaster" ? makeMaster(m.budgets?.[i] || m.opts || {}) : null));
  // lab-131: the page hears how the game goes (turn, points, which seat is searching; with m.watch the position too, so
  // Watch can follow a Master / Super game): before every searched decision and after every turn, at most every 300 ms
  let last = 0, decisions = 0;
  const script = []; // lab-131: every searched decision's outcome in order [seat, 0 setup | 1 main | 2 robber, choice], so the page can play the same game again (recorded, for Replay and the review)
  const tell = (think, force = false) => {
    const now = performance.now();
    if (!force && now - last < 300) return;
    last = now;
    self.postMessage({ type: "progress", id: m.id, turn: g.turn, setup: !!g.setupPhase, vp: g.players.map((p) => p.victoryPoints), think, d: decisions, state: m.watch ? g.serializeState() : undefined });
  };
  agents.forEach((a, i) => {
    if (!a) return;
    ["decideSetup", "decideMain", "decideRobber"].forEach((f, fi) => { const o = a[f]; a[f] = (...x) => { decisions += 1; tell(i); quiet += 1; let d; try { d = o(...x); } finally { quiet -= 1; } script.push([i, fi, d ? d.choice : null]); return d; }; });
  });
  // lab-137: the game log of the real moves (not the searches' imagined futures), so a watched game has its ticker
  const noLog = g.addLog;
  let quiet = 0;
  if (m.watch) g.addLog = (text, meta = null) => { if (!quiet) { g.logEntries.push({ text, meta, time: Date.now() }); if (g.logEntries.length > 80) g.logEntries.splice(0, 30); } return 0; };
  try {
    g._labSimStart(m.strategies, { players: m.strategies.length, map: m.map || "random", seed: m.seed, agents });
    let r = { done: false };
    tell(null, true);
    while (!r.done) { r = g._labSimStep(1); if (!r.done) tell(null); }
    return { winner: r.winner, turns: r.turns, vp: g.players.map((p) => p.victoryPoints), ms: Math.round(performance.now() - t0), script,
      stats: agents.map((a) => (a ? { d: a.stats.decisions, dev: a.stats.deviations, ms: a.stats.ms } : null)) };
  } finally { Math.random = orig; g.players.forEach((p) => { p.agent = null; }); g.addLog = noLog; }
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === "decide") { loadedSid = null; self.postMessage({ type: "decision", id: m.id, kind: m.kind, ...decide(m) }); }
    else if (m.type === "sprep") self.postMessage({ type: "sprep", id: m.id, ...sprep(m) });
    else if (m.type === "srun") self.postMessage({ type: "srun", id: m.id, ...srun(m) });
    else if (m.type === "send") { sessions.delete(m.sid); if (loadedSid === m.sid) loadedSid = null; if (m.id != null) self.postMessage({ type: "send", id: m.id }); }
    else if (m.type === "game") { loadedSid = null; self.postMessage({ type: "game", id: m.id, ...playGame(m) }); }
    else if (m.type === "detect") { loadedSid = null; self.postMessage({ type: "detect", id: m.id, ...detect(m) }); }
    else if (m.type === "luck") { loadedSid = null; self.postMessage({ type: "luck", id: m.id, result: luckEvent(g, m.base, m.ev, m.opts || {}) }); }
    else if (m.type === "evaluate") { loadedSid = null; self.postMessage({ type: "evaluate", id: m.id, result: evaluateRecord(g, m.rec, (rec) => loadRecord(g, m.base, rec), m.opts || {}) }); }
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, message: String(err && err.stack || err) });
  }
};
self.postMessage({ type: "ready" });
