// v0.90 "Master" bot, page side. A Master seat plays like the Expert, except that its set-up spot, its
// main-phase steps (build / trade-then-build / dev card / end turn) and its robber tile are searched by
// the Web Worker in src/master/worker.js (about 500 ms or 100 rollouts per decision, whichever comes
// first). The page keeps animating meanwhile; the bot simply takes its usual time. Without a worker (old
// browser, worker failed to load, or a game the search doesn't cover: Seafarers, 5–6 players, Rush) a
// Master seat plays exactly like the Expert.
//
// Analysis mode: a Master decision is noted with the Expert's own steps plus the Race and the Verdict
// (src/ai-tree.js masterSteps), and the panel shows a one-line verdict.
import { masterSteps, masterLineHtml } from "./ai-tree.js";

export const MASTER_BUDGET = { n: 100, timeMs: 500 };
const ASK_TIMEOUT_MS = 6000;   // a decision that takes longer falls back to the Expert
const READY_TIMEOUT_MS = 8000;
// Pacing: the Expert makes all its builds of a turn at once; a Master shows each searched step, a short
// beat apart (the search itself takes ~0.2–0.5 s), so its turn takes only a little longer
const STEP_GAP_MS = 120; // the worker loads the whole game code once (~0.4 s on a laptop)
const shared = { worker: null, ready: null, broken: false, seq: 0, waiting: new Map() };

/** The worker, created once per page (null when workers are unavailable). */
export function masterWorker() {
  if (shared.broken || typeof Worker === "undefined") return null;
  if (shared.worker) return shared.ready;
  try {
    shared.worker = new Worker(new URL("./master/worker.js?v=90", import.meta.url), { type: "module" });
  } catch (_) { shared.broken = true; return null; }
  shared.ready = new Promise((resolve) => {
    const t = setTimeout(() => { shared.broken = true; resolve(null); }, READY_TIMEOUT_MS);
    shared.worker.addEventListener("message", (e) => {
      const m = e.data;
      if (m.type === "ready") { clearTimeout(t); resolve(shared.worker); return; }
      const w = shared.waiting.get(m.id);
      if (!w) return;
      shared.waiting.delete(m.id);
      w(m);
    });
    shared.worker.addEventListener("error", (e) => { console.warn("Master worker failed", e.message || e); shared.broken = true; clearTimeout(t); resolve(null); shared.waiting.forEach((w) => w({ type: "error" })); shared.waiting.clear(); });
  });
  return shared.ready;
}
/** Send one request; resolves with the reply, or null (no worker, error, timeout). */
export function masterRequest(msg, timeoutMs = ASK_TIMEOUT_MS) {
  const ready = masterWorker();
  if (!ready) return Promise.resolve(null);
  return ready.then((w) => new Promise((resolve) => {
    if (!w) { resolve(null); return; }
    const id = ++shared.seq;
    const t = timeoutMs ? setTimeout(() => { shared.waiting.delete(id); resolve(null); }, timeoutMs) : 0;
    shared.waiting.set(id, (m) => { clearTimeout(t); resolve(m.type === "error" ? (console.warn("Master search failed", m.message), null) : m); });
    w.postMessage({ ...msg, id });
  }));
}
export const masterAvailable = () => !shared.broken && typeof Worker !== "undefined";

export const MasterMixin = {
  /** This seat's decisions are searched (live game, worker available, a game the search covers). */
  _masterLive(p) {
    return !!p && !p.isHuman && p.strategy?.policy === "master" && !this.labMode && masterAvailable()
      && !this.sea && !this.isRush() && this.players.length <= 4;
  },
  /** Load the worker early when the table has a Master (the first decision then doesn't wait for it). */
  _masterWarm() { if (this.players?.some((p) => this._masterLive(p))) masterWorker(); },

  /** Ask the worker; resolves { choice, record } or null (then the Expert decides). */
  _masterReq(kind, player) {
    const trk = this._aiCardTrack?.players === this.players ? this._aiCardTrack.est : null;
    const state = this.serializeState();
    const { logEntries, stats, ...pos } = state; // (the log and the stats don't change a decision)
    const key = JSON.stringify([kind, player.id, pos, trk, this.turnSerial]);
    return { key, send: () => masterRequest({ type: "decide", kind, state, trk, turnSerial: this.turnSerial, seat: player.id, opts: { ...MASTER_BUDGET } }) };
  },
  /** Right after a Master's roll: start its first main-phase search during the usual pause before a bot
   *  acts (the answer is used only if nothing changed in between). */
  _masterPrefetch(player) {
    this._masterPre = null;
    if (!this._masterLive(player) || this.phase !== "main" || this.currentPlayer !== player || this.winner) return;
    const r = this._masterReq("main", player);
    this._masterPre = { key: r.key, promise: r.send() };
  },
  _masterAsk(kind, player) {
    const gen = this.gameGen;
    this._masterBusy = { pid: player.id, kind, t0: performance.now() };
    const r = this._masterReq(kind, player);
    const pre = this._masterPre?.key === r.key ? this._masterPre.promise : null;
    this._masterPre = null;
    return (pre || r.send())
      .then((m) => {
        if (gen !== this.gameGen) return { stale: true };
        this._masterBusy = null;
        if (!m || !m.record) return null;
        return { choice: m.choice, record: m.record };
      });
  },

  /** Analysis: the Expert's note for this decision, upgraded to the Master's: its title, the Race and
   *  Verdict steps, and the one-line verdict for the panel. */
  _masterNote(player, rec, title) {
    const a = this.analysis;
    if (!a || !rec || !a.last || a.last.pid !== player.id) return;
    const d = a.last;
    d.master = rec;
    d.masterLine = masterLineHtml(rec);
    if (title) d.title = title;
    const base = d.steps?.length ? d.steps : this._aiGenericSteps(d);
    d.steps = masterSteps(base, rec, player.name);
    a.last = d;
    this._renderAnalysis();
    this.requestBoardDraw?.();
  },

  // ── set-up ──
  _masterSetup(player) {
    this._masterAsk("setup", player).then(this._guard((res) => {
      if (res?.stale) return;
      const ok = res && res.choice != null && this.canBuildSettlement(player, res.choice, true);
      const nodeId = ok ? res.choice : this.getBestInitialSettlementNode(player);
      this._aiSetupPlace(player, nodeId);
      if (ok && this._aiRec()) this._masterNote(player, res.record, `Settlement on ${this._spotLabel(nodeId)}`);
    }));
    return true;
  },

  // ── robber (after a 7, or before a Knight it chose) ──
  _masterRobberHex(player) {
    this.robberBusy = true;
    return this._masterAsk("robber", player).then(this._guard((res) => {
      this.robberBusy = false;
      if (res?.stale) return null;
      const legal = res && res.choice != null && this._robberHexAllowed(res.choice, player) && res.choice !== this.robberHexId;
      return legal ? res : null;
    }));
  },
  _masterRobber(player) {
    return this._masterRobberHex(player).then(this._guard((res) => {
      const hex = res ? res.choice : this.chooseRobberHex(player);
      if (this._aiRec()) { this._aiNoteRobber(player, hex); if (res) this._masterNote(player, res.record, `Robber on ${this._hexName(hex)}`); }
      this.moveRobberAndSteal(player, hex);
      this.render();
    }));
  },

  // ── main phase: the Expert's player trade, then one searched step at a time ──
  _masterMainPhase(player, skipPlayerTrade = false) {
    let steps = 0, traded = skipPlayerTrade;
    const alive = () => !this.winner && this.currentPlayer === player && this.phase === "main";
    const finish = () => {
      this._masterBusy = null;
      if (this._aiRec() && !this.winner) this._aiNoteEnd(player);
      this.recomputeScores();
      this.checkForWinner(player);
      this._aiMainPhaseDone(player);
    };
    const later = (fn, ms) => this._later(() => (this._aiHeld() && !this.winner ? this._aiPark(fn) : fn()), ms);
    const run = () => {
      if (!alive()) { this._masterBusy = null; this.render(); return; }
      if (this._aiHeld()) { this._aiPark(run); return; }
      if (!traded) {
        traded = true;
        this._masterBusy = { pid: player.id, kind: "trade" }; // keep the bot loop off this turn
        const tr = this.aiTryPlayerTrade(player);
        if (tr && tr.type === "human") {
          this._pendingAiTradePlayer = player;
          this.showIncomingTrade(tr.fromPlayer, tr.give, tr.want, tr.toPlayer).then(this._guard(() => {
            if (this.winner || this.currentPlayer !== player) return;
            this._masterMainPhase(player, true);
          }));
          return;
        }
        if (tr) { this.render(); later(run, 0); return; }
      }
      if (steps >= 12) { finish(); return; }
      // the Expert's view of this step, for analysis mode (taken before anything changes)
      let snap = null;
      if (this._aiRec()) { const plan = this._aiPlan(player); snap = this._aiPlanSnap(player, plan); snap.steps = this._aiStepsNow("build", player); snap.goal0 = plan.goals[0] || null; }
      this._masterAsk("main", player).then(this._guard((res) => {
        if (res?.stale) return;
        if (!alive()) { this._masterBusy = null; this.render(); return; }
        steps += 1;
        if (!res) { // nothing to choose between (or no worker): the Expert's own step
          this._masterBusy = { pid: player.id, kind: "main" };
          if (!this._aiPlannedStep(player)) { finish(); return; }
          this.render(); later(run, STEP_GAP_MS); return;
        }
        const c = res.choice, rec = res.record, label = rec.cands[rec.pick]?.label;
        const note = () => { if (snap) { this._aiNote(this._aiPlanDecision(player, snap, snap.goal0, c.kind === "end" ? "end" : "build")); this._masterNote(player, rec, label); } };
        if (c.kind === "end") { note(); this._masterBusy = null; this.recomputeScores(); this.checkForWinner(player); this._aiMainPhaseDone(player); return; }
        const apply = (hexPick) => {
          this._masterBusy = { pid: player.id, kind: "main" };
          const a = this.analysis, cap = a?.capture;
          if (a && a.on) a.capture = true; // the inner steps' own notes are folded into this one
          let r;
          try {
            if (hexPick != null) this._masterRobberPick = hexPick;
            r = this._masterApply(player, c);
          } finally { this._masterRobberPick = null; if (a) { a.capture = cap; a.captured = null; } }
          note();
          if (r === false || r === "noop") { finish(); return; }
          this.render();
          later(run, STEP_GAP_MS);
        };
        if (c.kind === "dev" && c.t === "knight") { // the Knight's robber tile is searched too
          this._masterRobberHex(player).then(this._guard((rr) => { if (alive()) apply(rr ? rr.choice : null); }));
          return;
        }
        apply(null);
      }));
    };
    run();
    return "async";
  },
  /** Play a searched main-phase choice with the game's own functions. */
  _masterApply(player, c) {
    if (c.kind === "policy") return this._aiPlannedStep(player) ? true : "noop";
    if (c.kind === "dev") return this.canPlayDevelopmentCard(player, c.t) && this.playDevelopmentCard(player, c.t) !== false;
    const plan = this._aiPlan(player);
    const goal = plan.goals.find((x) => x.type === c.g.type && (x.nodeId ?? null) === c.g.nodeId && (x.edge ?? null) === c.g.edge && (x.via ?? null) === c.g.via);
    if (!goal) return this._aiPlannedStep(player) ? true : "noop"; // the position moved on: the Expert's step
    if (c.kind === "tradebuild") for (const [give, get] of c.tr) if (!this.performBankTrade(player, give, get)) return false;
    return this._aiTryGoal(player, goal) ? true : false;
  },
};
