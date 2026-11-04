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
// v1.10 "Super Expert": the same search, up to 1000 rollouts in an anytime, time-sliced search (about 3 s cap per decision),
// 14 turns deep (18 in set-up). `leaf` is the one place that picks the position evaluator at the end of a rollout (v1 now).
// earlyZ/earlyMin: stop once one move leads all others by 3 standard errors after 40 futures (saves time in clear spots).
export const SUPER_BUDGET = { n: 1000, timeMs: 3000, timeSlice: true, depth: 14, setupDepth: 18, earlyZ: 3, earlyMin: 40 };
/** The search budget of a policy ("master" | "super"). */
export const budgetFor = (policy, rush = false) => (rush ? { ...RUSH_BUDGET } : { ...(policy === "super" ? SUPER_BUDGET : MASTER_BUDGET) });
// v1.17 Rush: a bot moves every 1-2 s while the dice clock runs, so its search gets a small cap (the 7's robber too; set-up has no clock
// and keeps the full budget). Master and Super Expert search alike there (a Super Expert's longer look-ahead needs the time it doesn't get).
export const RUSH_BUDGET = { n: 100, timeMs: 250, depth: 8, setupDepth: 12 };
export const isSearchPolicy = (policy) => policy === "master" || policy === "super";
const ASK_TIMEOUT_MS = 6000;   // a decision that takes longer falls back to the Expert (the cap + 3 s: Super Expert 3 s + 3 s)
const READY_TIMEOUT_MS = 8000;
// Pacing: the Expert makes all its builds of a turn at once; a Master shows each searched step, a short
// beat apart (the search itself takes ~0.2–0.5 s), so its turn takes only a little longer
const STEP_GAP_MS = 120; // the worker loads the whole game code once (~0.4 s on a laptop)
const RES5 = ["wood", "brick", "sheep", "wheat", "ore"], DEV5 = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const RUSH_TICK = [1000, 2000], RUSH_HURRY_MS = 300; // as RUSH_TICK_MS / RUSH_HURRY_TICK_MS in game.js
const shared = { worker: null, ready: null, broken: false, seq: 0, waiting: new Map() };

/** A worker of src/master/worker.js with its request queue (`pool`: the bots' own, or the review's). */
function poolWorker(pool) {
  if (pool.broken || typeof Worker === "undefined") return null;
  if (pool.worker) return pool.ready;
  try {
    pool.worker = new Worker(new URL("./master/worker.js?v=117", import.meta.url), { type: "module" });
  } catch (_) { pool.broken = true; return null; }
  pool.ready = new Promise((resolve) => {
    const t = setTimeout(() => { pool.broken = true; resolve(null); }, READY_TIMEOUT_MS);
    pool.worker.addEventListener("message", (e) => {
      const m = e.data;
      if (m.type === "ready") { clearTimeout(t); resolve(pool.worker); return; }
      const w = pool.waiting.get(m.id);
      if (!w) return;
      pool.waiting.delete(m.id);
      w(m);
    });
    pool.worker.addEventListener("error", (e) => { console.warn("Master worker failed", e.message || e); pool.broken = true; clearTimeout(t); resolve(null); pool.waiting.forEach((w) => w({ type: "error" })); pool.waiting.clear(); });
  });
  return pool.ready;
}
function poolRequest(pool, msg, timeoutMs) {
  const ready = poolWorker(pool);
  if (!ready) return Promise.resolve(null);
  return ready.then((w) => new Promise((resolve) => {
    if (!w) { resolve(null); return; }
    const id = ++pool.seq;
    const t = timeoutMs ? setTimeout(() => { pool.waiting.delete(id); resolve(null); }, timeoutMs) : 0;
    pool.waiting.set(id, (m) => { clearTimeout(t); resolve(m.type === "error" ? (console.warn("Master search failed", m.message), null) : m); });
    w.postMessage({ ...msg, id });
  }));
}
/** The worker, created once per page (null when workers are unavailable). */
export function masterWorker() { return poolWorker(shared); }
/** Send one request; resolves with the reply, or null (no worker, error, timeout). */
export function masterRequest(msg, timeoutMs = ASK_TIMEOUT_MS) { return poolRequest(shared, msg, timeoutMs); }
// v1.04 the Game review has a worker of its own: a check during the game never makes a Master bot wait
// (one shared worker queued the bots' searches behind ~5 s review steps: 4.4 s mean think time, timeouts).
const review = { worker: null, ready: null, broken: false, seq: 0, waiting: new Map() };
export function reviewRequest(msg, timeoutMs) { return poolRequest(review, msg, timeoutMs); }
export const reviewAvailable = () => !review.broken && typeof Worker !== "undefined";
export const masterAvailable = () => !shared.broken && typeof Worker !== "undefined";

export const MasterMixin = {
  /** This seat's decisions are searched (live game, worker available, a game the search covers). */
  _masterLive(p) {
    return !!p && !p.isHuman && isSearchPolicy(p.strategy?.policy) && !this.labMode && masterAvailable()
      && this._searchGame();
  },
  /** A game the search covers: the island board, 2–6 players, Classic or Rush (Rush is searched as turn-based play, see rushToTurns
   *  in src/review/engine.js). Seafarers is not covered yet. */
  _searchGame() { return !this.sea; },
  /** Load the worker early when the table has a Master (the first decision then doesn't wait for it). */
  _masterWarm() { if (this.players?.some((p) => this._masterLive(p))) masterWorker(); },

  /** Ask the worker; resolves { choice, record } or null (then the Expert decides). */
  _masterReq(kind, player) {
    const trk = this._aiCardTrack?.players === this.players ? this._aiCardTrack.est : null;
    const state = this.serializeState();
    const { logEntries, stats, ...pos } = state; // (the log and the stats don't change a decision)
    const key = JSON.stringify([kind, player.id, pos, trk, this.turnSerial]);
    const opts = budgetFor(player.strategy?.policy, this.isRush() && !this.setupPhase);
    return { key, cap: opts.timeMs, send: () => masterRequest({ type: "decide", kind, state, trk, turnSerial: this.turnSerial, seat: player.id, opts }, Math.max(ASK_TIMEOUT_MS, opts.timeMs + 3000)) };
  },
  /** Right after a Master's roll: start its first main-phase search during the usual pause before a bot
   *  acts (the answer is used only if nothing changed in between). */
  _masterPrefetch(player) {
    this._masterPre = null;
    if (!this._masterLive(player) || this.phase !== "main" || this.currentPlayer !== player || this.winner) return;
    const r = this._masterReq("main", player);
    this._masterPre = { key: r.key, promise: r.send(), t0: performance.now() };
  },
  _masterAsk(kind, player) {
    const gen = this.gameGen;
    const r = this._masterReq(kind, player);
    const pre = this._masterPre?.key === r.key ? this._masterPre.promise : null;
    this._masterBusy = { pid: player.id, kind, t0: pre ? this._masterPre.t0 : performance.now(), cap: r.cap, super: player.strategy?.policy === "super" };
    try { this.renderLog(); this.renderStatusAndControls(); } catch (_) { /* headless */ } // the dock says "… is thinking…"
    this._thinkTick(true);
    this._masterPre = null;
    return (pre || r.send())
      .then((m) => {
        if (gen !== this.gameGen) return { stale: true };
        this._masterBusy = null;
        this._thinkTick(false);
        try { this.renderLog(); this.renderStatusAndControls(); } catch (_) { /* headless */ }
        if (!m || !m.record) return null;
        return { choice: m.choice, record: m.record };
      });
  },

  /** v1.10 the seconds counter ("thinking… 2s") on the dock, the ticker and the bot's chip, and a fill over the cap time on the
   *  chip. Pure DOM (no render): on = start the 250 ms clock; it stops itself when nobody is thinking any more. */
  _thinkTick(on) {
    if (typeof document === "undefined") return;
    const paint = () => {
      const b = this._masterBusy;
      const live = !!b && b.kind !== "trade" && b.t0 != null;
      const sec = live ? Math.floor((performance.now() - b.t0) / 1000) : 0;
      const txt = live && sec >= 1 ? `${sec}s` : "";
      document.querySelectorAll("[data-think]").forEach((el) => { if (el.textContent !== txt) el.textContent = txt; });
      document.querySelectorAll(".pchip.thinking, .pstrip .pchip .th-s").forEach((el) => {
        if (el.classList.contains("th-s")) { if (!live || b.pid !== Number(el.closest(".pchip")?.dataset.seat)) el.remove(); }
        else if (!live || b.pid !== Number(el.dataset.seat)) { el.classList.remove("thinking"); el.style.removeProperty("--think"); }
      });
      if (live) {
        const chip = document.querySelector(`.pstrip .pchip[data-seat="${b.pid}"]`);
        if (chip) {
          chip.classList.add("thinking");
          if (b.cap) chip.style.setProperty("--think", Math.min(1, (performance.now() - b.t0) / b.cap).toFixed(3));
          let t = chip.querySelector(".th-s");
          if (!t) { t = document.createElement("span"); t.className = "th-s"; t.setAttribute("aria-hidden", "true"); chip.querySelector(".pn")?.appendChild(t); }
          if (t.textContent !== txt) t.textContent = txt;
        }
      }
      return live;
    };
    if (!on) { paint(); clearInterval(this._thinkTimer); this._thinkTimer = 0; return; }
    paint();
    if (!this._thinkTimer) this._thinkTimer = setInterval(() => { if (!paint()) { clearInterval(this._thinkTimer); this._thinkTimer = 0; } }, 250);
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

  // ── Rush (v1.17): the bot's tick asks the worker, one search at a time, and applies the answer if the roll interval is still the same ──
  /** A tick of a Master / Super Expert seat in Rush. True: this call took the tick over (it schedules the next one itself). */
  _rushMasterTick(player) {
    const hasCards = RES5.reduce((a, k) => a + player.resources[k], 0);
    const hasDev = DEV5.some((t) => player.devCards[t] > 0);
    if (hasCards < 2 && !hasDev) return false; // nothing to choose between: the Expert's tick (it votes Ready)
    const next = (ms) => { if (!this.winner) this._scheduleBotTick(player, ms); };
    if (this._rushMasterBusy) { next(120 + Math.random() * 120); return true; } // the worker takes one search at a time
    this._rushMasterBusy = player.id;
    const r = this.rush, roll = r.rollNo, gen = this.gameGen;
    const stale = () => gen !== this.gameGen || this.rush !== r || r.rollNo !== roll || r.paused || this.winner;
    const finish = (acted) => {
      if (acted) { r.ready = r.ready.filter((id) => id !== player.id); this._rushAfterAction(player); }
      else if (!r.ready.includes(player.id)) { r.ready.push(player.id); this._renderRushHud(); this._lastScoreKey = null; this.renderScoreboard(); }
      next(this._rushHumanReady() ? RUSH_HURRY_MS : RUSH_TICK[0] + Math.random() * (RUSH_TICK[1] - RUSH_TICK[0]));
    };
    this._masterReq("main", player).send().then((m) => {
      if (gen !== this.gameGen) return;
      if (stale()) { this._rushMasterBusy = null; next(250); return; } // the roll came in between: ask again for the new position
      const choice = m && m.record ? m.choice : null;
      const go = (hexPick) => {
        this._rushMasterBusy = null;
        if (stale()) { next(250); return; }
        let acted;
        if (!choice) acted = this._rushBotAct(player);
        else if (choice.kind === "end") acted = this._rushBotAct(player, true); // "do nothing now": only the Expert's player trade, then Ready
        else {
          if (hexPick != null) this._masterRobberPick = hexPick;
          let res;
          try { res = this._masterApply(player, choice); } finally { this._masterRobberPick = null; }
          acted = res === "noop" ? this._rushBotAct(player, true) : !!res;
        }
        finish(acted);
      };
      if (choice && choice.kind === "dev" && choice.t === "knight") { // the Knight's tile is searched too
        this._masterReq("robber", player).send().then((rr) => { if (gen !== this.gameGen) return; go(rr && rr.choice != null && this._robberHexAllowed(rr.choice, player) && rr.choice !== this.robberHexId ? rr.choice : null); });
      } else go(null);
    });
    return true;
  },
  /** The 7 in Rush: the robber tile of a Master seat (null: the Expert's own pick). */
  _rushMasterHex(player) {
    return this._masterReq("robber", player).send().then((m) => {
      const c = m && m.record ? m.choice : null;
      return c != null && this._robberHexAllowed(c, player) && c !== this.robberHexId ? c : null;
    });
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
