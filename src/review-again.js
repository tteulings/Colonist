// v1.41 Review again: a saved game checked anew with today's engine: the people's own reviews (quick, then deep), the luck, then the
// bots' reviews (OTHERS' policy). It runs beside the old results: every block (a player's review, the luck) is computed into a copy
// and replaces the old one only when it is complete, so the screen keeps the old numbers until then and Stop keeps them for good.
// The history keeps one entry per game (the same record is written again), and your accuracy record takes the new accuracy.
// Each review and the luck carry a stamp (the app version and an id of the engine): "reviewed with v1.40", and the button gets more
// weight when the engine has changed since.
import { reviewRequest, reviewLaneCount, GM_WORKERS, SEA_LEAF } from "./master.js";
import { REVIEW, REVIEW_ENGINE, REVIEW_ENGINES, FMT, needsFull, liftReview, analysisOpts, engineId } from "./review/evaluate.js";
import { OTHERS } from "./review.js";
import { LUCK_ID, luckKey, luckRecord } from "./review-luck.js";
import { APP_VERSION } from "./themes/settings-ui.js";

/** Today's engine on this device (src/review/evaluate.js engineId: one lane looks 14 turns ahead, several 20). */
export const currentEngineId = () => engineId(Math.max(1, Math.min(3, GM_WORKERS())));
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hiddenTab = () => typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden");
// seconds of one desktop core: a decision in the quick round, in the deep round, a luck event (measured: 4 players, 87 events in ~35 s)
// CAL: measured on this machine (4 cores, 3 lanes): the sum below divided by the lanes came out 0.6x (12 decisions, 17 s) to 4.3x
// (124 decisions and 87 events, 417 s) too low; 2.5 keeps both within a factor 2
const SEC = { quick: REVIEW_ENGINES.m100?.sec ?? 0.5, deep: REVIEW.sec ?? 3, luck: 0.45, phone: 2.5, cal: 2.5 };

export const ReviewAgainMixin = {
  /** The stamp a finished block gets. */
  _raStamp(eid = null) { return { app: APP_VERSION, engId: eid || currentEngineId() }; },
  /** What the shown review was made with: { app: "1.40" | null, old: true when the engine (or the luck) has changed since }. */
  _raMadeWith() {
    const R = this._rv, me = this._rvPid ?? this.players?.find((p) => p.isHuman)?.id;
    const rv = R?.revs?.[me] || Object.values(R?.revs || {}).find((x) => this.players[x?.pid]?.isHuman);
    if (!rv) return null;
    return { app: rv.app || null, old: rv.engId !== currentEngineId() || (!!R.luck && R.luck.id !== LUCK_ID) };
  },
  /** Can this game be reviewed again now (a finished game with records, nothing else running)? */
  _raCan() {
    const R = this._rv;
    return !!R?.recs?.length && !!this.winner && !this._rvMid && !this.hotseat && this._rvCovered?.() && !R.again
      && this.players.some((p) => p.isHuman && this._rvTodo(p.id).length && this._rvReviewComplete(p.id));
  },
  /** The work and an estimate of its time, in seconds on this device (lanes: the review's parallel workers). */
  _raEstimate() {
    const lanes = Math.max(1, Math.min(3, GM_WORKERS())), phone = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent || "") ? SEC.phone : 1;
    let s = 0, n = 0;
    this.players.forEach((p) => {
      if (!p.isHuman && !this._rv.bots) return;
      const k = this._rvTodo(p.id).length; n += k;
      s += k * (SEC.quick + (p.isHuman ? 1 : 0.4) * SEC.deep); // a bot's deep round covers its real choices (about 40 %)
    });
    const ev = this._lkNa?.() ? 0 : this._lkEvents?.().length || 0;
    s += ev * SEC.luck;
    return { decisions: n, events: ev, sec: Math.round((s * phone * SEC.cal) / lanes) };
  },
  _raTime(sec) { return sec >= 90 ? `about ${Math.round(sec / 60)} min` : `about ${Math.max(10, Math.round(sec / 10) * 10)} s`; },

  /** The row under the review button: what made the review, and Review again (with weight when the engine changed). While it runs:
   *  its progress and Stop. */
  _raRowHtml() {
    const R = this._rv;
    if (!R?.recs?.length || !this.winner || this._rvMid || this.hotseat) return "";
    const A = R.again;
    if (A) {
      const pct = A.n ? Math.round((100 * A.j) / A.n) : 0;
      return `<div class="ra-row run" role="status"><i class="rv-ring" style="--p:${pct}%" aria-hidden="true"></i><span>Reviewing again · ${A.what}<small>${A.j} of ${A.n}${A.paused ? " · paused" : ""} · the old review stays until each part is done</small></span><button type="button" class="rv-btn" data-rastop>Stop</button></div>`;
    }
    const M = this._raMadeWith();
    if (!M || !this._raCan()) return "";
    const conf = this._raAsk ? (() => { const E = this._raEstimate(); return `<div class="ra-ask" role="dialog" aria-label="Review again"><p>Review this game again with v${APP_VERSION}? ${this._raTime(E.sec)}.</p><div><button type="button" class="rv-btn" data-raa="no">Cancel</button><button type="button" class="rv-btn pri" data-raa="go">Review again</button></div></div>`; })() : "";
    return `<div class="ra-row${M.old ? " old" : ""}"><small>${M.app ? `reviewed with v${M.app}` : "reviewed with an older version"}</small><button type="button" class="rv-btn${M.old ? " pri" : ""}" data-raagain aria-expanded="${!!this._raAsk}">Review again</button></div>${conf}`;
  },
  _raBind(root) {
    root.querySelectorAll("[data-raagain]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._raAsk = !this._raAsk; this._raRedraw(); }));
    root.querySelectorAll("[data-raa]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const go = b.dataset.raa === "go"; this._raAsk = false; if (go) this._raStart(); else this._raRedraw(); }));
    root.querySelectorAll("[data-rastop]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._raStop(); }));
  },
  /** Redraw the rows (end screen and the open review), the rest stays. */
  _raRedraw() {
    const h = this._raRowHtml();
    document.querySelectorAll("[data-rabox]").forEach((box) => { if (box.__h === h) return; box.__h = h; box.innerHTML = h; this._raBind(box); });
  },
  _raBox() { return `<div data-rabox>${this._raRowHtml()}</div>`; },

  /** Stop: what is not finished keeps its old results. */
  _raStop() { const A = this._rv?.again; if (!A) return; A.stop = true; this._rv.again = null; this._raRedraw(); this._rvTick?.(); },

  /** Review again: the people first, then the luck, then the bots; each block replaces the old one when it is complete. */
  async _raStart() {
    const R = this._rv;
    if (!R || R.again || !this._raCan()) return;
    // what runs now stops (the others' check, the luck); it is all done again below
    if (R.run) { R.run.stop = true; R.run = null; }
    if (R.lrun) { R.lrun.stop = true; R.lrun = null; }
    R.queue = [];
    const A = { stop: false, j: 0, n: 0, what: "", paused: false };
    R.again = A;
    const id = R.id, live = () => this._rv === R && R.id === id && R.again === A && !A.stop;
    const people = this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length).map((p) => p.id);
    const bots = R.bots ? this.players.filter((p) => !p.isHuman && this._rvTodo(p.id).length).map((p) => p.id) : [];
    const tick = () => { this._raRedraw(); };
    this._raRedraw();
    try {
      for (const pid of people) {
        if (!live()) break;
        const rv = await this._raSeat(pid, false, A, live, tick);
        if (!rv || !live()) break;
        R.revs[pid] = rv; if (this.players[pid]?.isHuman) R.review = rv;
        this._rvSave(); this._rvLogGame?.(pid, true); this._rvTick?.(); this._rvRender?.();
      }
      if (live() && !R.noLuck && !this._lkNa?.()) {
        const L = await this._raLuck(A, live, tick);
        if (L && live()) { R.luck = L; this._rvSave(); this._rvTick?.(); this._rvRender?.(); }
      }
      for (const pid of bots) {
        if (!live()) break;
        const rv = await this._raSeat(pid, true, A, live, tick);
        if (!rv || !live()) break;
        R.revs[pid] = rv; this._rvSave(); this._rvTick?.();
      }
    } catch (e) { console.warn("review again", e); }
    if (R.again === A) R.again = null;
    if (this._rv === R) { this._rvSave(); this._histSoon?.(); this._raRedraw(); this._rvTick?.(); this._rvRender?.(); if (this._rvEl) this._rvDrawReview?.(); }
  },

  /** Run items on the review lanes (results by record index). */
  async _raItems(items, eng, A, live, tick, into) {
    const lanes = await reviewLaneCount(), opts = analysisOpts(eng, lanes), R = this._rv;
    if (eng === REVIEW_ENGINE) A.eid = engineId(lanes);
    let next = 0;
    const lane = async (w) => {
      while (next < items.length) {
        while (live() && hiddenTab()) { if (!A.paused) { A.paused = true; tick(); } await sleep(400); }
        if (A.paused) { A.paused = false; tick(); }
        if (!live() || next >= items.length) return;
        const [rec, i] = items[next++];
        const m = await reviewRequest({ type: "evaluate", base: R.base, rec, opts }, 40000, w);
        if (!live()) return;
        const r = m?.result ? { ...m.result, i } : { k: rec.k, pid: rec.pid, t: rec.t, s: rec.s, e: rec.e, i, skip: "error", eng };
        const k = into.findIndex((x) => x.i === i);
        if (k >= 0) into[k] = r; else into.push(r);
        A.j += 1; tick();
      }
    };
    await Promise.all(Array.from({ length: lanes }, (_, w) => lane(w)));
  },
  /** One seat's review into a new object: quick round for every decision, then the deep round (a person: every real choice; a bot:
   *  OTHERS' policy, the moves its quick round found to be a real choice). null when stopped. */
  async _raSeat(pid, bot, A, live, tick) {
    const todo = this._rvTodo(pid), results = [];
    A.what = bot ? `${this.players[pid].name}’s moves` : this._rvIsYou?.(pid) ? "your moves" : `${this.players[pid].name}’s moves`;
    A.j = 0; A.n = todo.length * 2; tick();
    await this._raItems(todo, "m100", A, live, tick, results);
    if (!live()) return null;
    const quickDone = (x) => x.eng === "m100" && !x.err && (x.trivial || x.skip === "trivial");
    const deep = todo.filter(([, i]) => { const x = results.find((y) => y.i === i); return x && needsFull(x) && !(bot && OTHERS.policy === "real" && quickDone(x)); });
    A.n = todo.length + deep.length; tick();
    await this._raItems(deep, bot ? OTHERS.engine : REVIEW_ENGINE, A, live, tick, results);
    if (!live()) return null;
    results.sort((a, b) => a.i - b.i);
    const rv = { pid, results, fmt: FMT, total: todo.length, done: true, ...this._raStamp(A.eid) };
    liftReview(rv);
    return rv;
  },
  /** The luck of every chance event into a new store. null when stopped. */
  async _raLuck(A, live, tick) {
    const evs = this._lkEvents(), L = { id: LUCK_ID, res: {}, ...this._raStamp() }, R = this._rv;
    A.what = "luck"; A.j = 0; A.n = evs.length; tick();
    const lanes = await reviewLaneCount();
    const keep = R.luck; R.luck = L; let budget; try { budget = this._lkBudget(lanes); } finally { R.luck = keep; } // the budget as for a new run
    let next = 0;
    const lane = async (w) => {
      while (next < evs.length) {
        while (live() && hiddenTab()) { if (!A.paused) { A.paused = true; tick(); } await sleep(400); }
        if (A.paused) { A.paused = false; tick(); }
        if (!live() || next >= evs.length) return;
        const ev = evs[next++];
        const { i, ...plain } = ev;
        const m = await reviewRequest({ type: "luck", base: R.base, ev: plain, opts: { leaf: this.sea ? SEA_LEAF : REVIEW.budget.leaf || "gbm", ...budget } }, 120000, w);
        if (!live()) return;
        L.res[luckKey(ev)] = luckRecord(ev, m?.result);
        A.j += 1; tick();
      }
    };
    await Promise.all(Array.from({ length: lanes }, (_, w) => lane(w)));
    return live() ? L : null;
  },
};
