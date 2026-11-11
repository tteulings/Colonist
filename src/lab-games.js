// lab-131 AI Lab: the games of the last run, kept to look at again, and (Review: 5 / 10 / All) the first ones checked by the review.
//
// Recording. A lab game is played in the sim frame (index.html?lab=sim); a game with a Master / Super seat is played in the lab
// worker, which sends back every searched decision's outcome (`script`). The page then plays that same game again in the sim
// frame with "scripted" seats (same seed, same choices: no search), which takes well under a second, so every game is recorded
// the same way: the statistics log (for Replay and its running win chance) and, for a game to review, the review's recorder for
// every seat (review.js records the bots' real choices since v1.29). A script that does not lead to the same result is not kept.
//
// Keeping. The games go to an IndexedDB store of their own (history.js HistoryStore "colonist_lab": the Past-games format, the
// review records packed by review/pack.js, gzip), the last run only, at most 50 games / 5 MB; a new run clears it. They open
// in index.html?labgame=ID on the real end screen, Replay and review (history.js histOpenLab); Back returns to the lab.
//
// Reviewing. One game at a time in a third frame of its own (so games keep being played meanwhile), with the review as it is:
// review.js _rvQueueNext plans the others' quick round, then the deep round on their real choices (OTHERS). Nothing of the
// scoring is changed here; the lab only reads the result (history.js revMeta via the frame's _histRev).
import { HistoryStore, LAB_DB, LAB_LIMITS } from "./history.js?v=149";
import { packRecs } from "./review/pack.js?v=149";

export const labStore = new HistoryStore(LAB_DB, LAB_LIMITS);

let applyMainFn = null;
async function applyMain() {
  if (!applyMainFn) { const { makeMaster } = await import("./master/search.js?v=149"); applyMainFn = makeMaster({}).applyMain; }
  return applyMainFn;
}

/** The sim frame's game routes a seat with `agent` to it (as the worker's prepareEngine does); seats without one play as before. */
function hook(g) {
  if (g._labHooked) return;
  g._labHooked = true;
  const bestInit = g.getBestInitialSettlementNode.bind(g), moveRobber = g.moveRobber.bind(g), mainPhase = g.executeAiMainPhase.bind(g);
  g.getBestInitialSettlementNode = (p) => (p.agent ? p.agent.setupNode(g, p, bestInit) : bestInit(p));
  g.moveRobber = (p) => (p.agent ? g.moveRobberAndSteal(p, p.agent.robberHex(g, p)) : moveRobber(p));
  g.executeAiMainPhase = (p, skip) => { if (p.agent) { p.agent.mainPhase(g, p); return "done"; } return mainPhase(p, skip); };
}

/** Seats that replay the worker's decisions in order (the worker's agent.mainPhase / setupNode / robberHex, with the choices read back). */
function scripted(g, script, n, apply, bad) {
  let k = 0;
  const next = (seat, kind) => {
    const s = script[k];
    if (!s || s[0] !== seat || s[1] !== kind) { bad.off = true; return null; }
    k += 1;
    return s[2];
  };
  const agent = (seat) => ({
    setupNode: (gg, p, base) => { const c = next(seat, 0); return c == null ? base(p) : c; },
    robberHex: (gg, p) => { const c = next(seat, 2); return c == null ? gg.chooseRobberHex(p) : c; },
    mainPhase: (gg, p) => {
      if (!gg.winner) gg.aiTryPlayerTrade(p);
      for (let step = 0; step < 12 && !gg.winner; step++) {
        const c = next(seat, 1);
        if (!c) { if (bad.off || !gg._aiPlannedStep(p)) break; continue; }
        if (c.kind === "end") break;
        const r = apply(gg, p, c);
        if (r === false || r === "noop") break;
      }
      gg.recomputeScores(); gg.checkForWinner(p);
    },
  });
  return { agents: Array.from({ length: n }, (_, i) => (script.some((s) => s[0] === i) ? agent(i) : null)), used: () => k };
}

/** Turn the review's recorder on (every seat's real choices) or off, on a lab frame's game (the lab never has a person at the table). */
export function recordOn(g, on) {
  if (on) g._rvOn = function () { return !!this.stats && !this.sea && !this._replay && !this.winner; };
  else delete g._rvOn;
}

/** Play a worker game again in the sim frame, recorded. Returns true when it ends exactly as the worker's did. */
export async function replayScript(g, { strategies, seed, map, script, result }, rec) {
  const apply = await applyMain();
  hook(g);
  const bad = { off: false };
  const sc = scripted(g, script, strategies.length, apply, bad);
  recordOn(g, rec);
  try {
    g._labSimStart(strategies, { players: strategies.length, map, seed, agents: sc.agents });
    let r = { done: false };
    while (!r.done && !bad.off) r = g._labSimStep(40);
    const vp = g.players.map((p) => p.victoryPoints);
    return !bad.off && sc.used() === script.length && r.winner === result.winner && r.turns === result.turns && vp.join() === result.vp.join();
  } finally { recordOn(g, false); g.players.forEach((p) => { p.agent = null; }); }
}

/** The entry and the payload of the sim frame's finished game (as history.js keeps a game). */
export function entryOf(g, { keys, labels, i, run }) {
  const state = g.serializeState();
  state.logEntries = [];
  // the seats carry the bots' names (the sim frame's seat 0 is called "You"); the same bot twice: "Expert", "Expert 2"
  const seen = {};
  (state.players || []).forEach((p, s) => { const l = labels[s]; seen[l] = (seen[l] || 0) + 1; p.name = seen[l] > 1 ? `${l} ${seen[l]}` : l; p.isHuman = false; if (keys[s] !== "mix") p.personality = keys[s]; });
  const R = g._rv && g._rv.id === g.stats?.id && g._rv.recs.length ? g._rv : null;
  const meta = {
    id: g.stats.id, v: 1, start: Date.now(), end: Date.now() - i, mode: "classic", board: "island", n: g.players.length, pts: g.winPoints, hot: false,
    seats: g.players.map((p, s) => ({ name: labels[s], vp: p.victoryPoints, prof: keys[s], custom: false })),
    me: null, winner: g.winner ? g.winner.id : null, result: "table", turns: g.turn, ms: g.stats.ms || 0, star: false, rec: !!R, acc: null,
    lab: { run, game: i, keys },
  };
  const payload = { state, rv: R ? { base: R.base, recs: packRecs(R.recs), reviews: {}, bots: 1 } : null };
  return { meta, payload };
}

/** A new run: the last run's games go. */
export async function clearStore() {
  await labStore.open();
  for (const m of labStore.metas.slice()) await labStore.remove(m.id, true);
  labStore.pruned = 0;
}

/**
 * Review one kept game in the review frame `rg` (a lab=sim frame of its own). onTick({ pid, j, n, stage }) while it runs.
 * Resolves with { [pid]: { acc, rn, prov } } (history.js revMeta per seat), or null when stopped / failed. `stop()` ends it.
 */
export function reviewGame(rg, id, ctl) {
  return (async () => {
    const rec = await labStore.get(id);
    if (!rec?.rv) return null;
    rg._cancelPendingWork?.();
    rg.loadFromStorage(rec.state);
    rg.players.forEach((p, i) => { const sp = rec.state.players?.[i]; if (p.isHuman && sp?.strategy) Object.assign(p, { strategy: { ...sp.strategy }, personality: sp.personality || null }); p.isHuman = false; }); // every seat is a bot (the review checks "the others")
    const { unpackRecs } = await import("./review/pack.js?v=149");
    const R = { id: rg.stats?.id ?? id, base: rec.rv.base, recs: unpackRecs(rec.rv.recs), res: null, busy: false, ms: 0, revs: {}, queue: [], bots: true, noLuck: true }; // v1.32: the lab checks accuracy only (no luck in win chance: src/review-luck.js)
    rg._rv = R;
    if (rg.stats) rg.stats.id = R.id;
    rg._rvQueueNext(); // the others: everyone's quick round, then the deep round on real choices (review.js OTHERS)
    for (;;) {
      if (ctl.stopped) { rg._rvStop?.(); R.queue = []; R.othersOff = true; return null; }
      const run = R.run;
      if (!run && !(R.queue || []).length) break;
      if (run) ctl.onTick?.({ pid: run.pid, j: run.round?.j || 0, n: run.round?.n || 0, stage: run.round?.eng === "m100" ? "quick" : "deep" });
      await new Promise((r) => setTimeout(r, 400));
    }
    const out = {};
    rg.players.forEach((p) => { const m = rg._histRev(R.revs[p.id], p.id, null, R.recs); out[p.id] = { acc: m.acc ?? null, rn: m.rn ?? 0, done: !!rg._rvReviewComplete(p.id) }; });
    // keep the reviews with the game (Review opens on them)
    const meta = labStore.metas.find((m) => m.id === id);
    if (meta) await labStore.put({ ...meta, accs: out }, { state: rec.state, rv: { ...rec.rv, reviews: rg._rvAll(R) } }, { quiet: true });
    return out;
  })().catch((e) => { console.warn("lab review", e); return null; });
}
