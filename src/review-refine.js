// v1.81 Targeted refinement. A decision of the person that is a "close call" or only "leans" (src/review/score.js vcOf: the gap against its
// own standard error) is run again with the played move and its best alternative ONLY, on 400 paired futures each (the noise of the gap falls
// with 1/sqrt(n)). The stored gap, se and class follow and the decision is marked `refined` (saved with the review: it is not run twice).
//   Deep review: automatically once the review is complete. Standard: lazily when the move is opened (or the AI asks, tool refine_decision).
//   Quick: only on request. Never while a bot is being checked; the total extra time of a review is capped (REFINE_CAP_MS).
import { reviewRequest, reviewAvailable } from "./master.js";
import { vcOf, REFINE_N, refineOpts, refineResult, liftReview, modelOfId, reviewModel } from "./review/evaluate.js";
import { aiCacheReset, aiPick } from "./review/ai-tools.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const coarse = () => { try { return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches; } catch (_) { return false; } };
export const REFINE_CAP_MS = 20000; // desktop; a phone gets 2.25x (its cores are ~3-4x slower)
export const rfCap = () => (coarse() ? REFINE_CAP_MS * 2.25 : REFINE_CAP_MS);

export const ReviewRefineMixin = {
  _rfX(i, pid = this._rvPid) { return this._rvOf?.(pid)?.results?.find((y) => y.i === i) || null; },
  /** Can this stored decision be refined now? (the person's own, a deep result, close / lean, not yet refined, position stored) */
  _rfCan(x, pid = this._rvPid) {
    const R = this._rv;
    if (!R?.base || !x || x.refined || R.rfFail?.has(x.i) || !reviewAvailable()) return false;
    if (!this.players?.[pid]?.isHuman || !this._rvReviewComplete?.(pid)) return false;
    const vc = vcOf(x); if (vc !== "close" && vc !== "lean") return false;
    return !!refineOpts(x) && !!R.recs?.[x.i]?.st;
  },
  /** Bots are being checked or the review is run again: do not take the engine. */
  _rfBusyElse() { const R = this._rv; return !!(R?.again || (R?.run && !this.players?.[R.run.pid]?.isHuman)); },
  _rfLeft(pid = this._rvPid) { return rfCap() - (this._rvOf?.(pid)?.rfMs || 0); },
  /** Time left in the cap for another run: at least 1.5 s and as much as the longest run so far (a run never starts that would overshoot by much). */
  _rfRoom(pid = this._rvPid) { return this._rfLeft(pid) >= Math.max(1500, this._rvOf?.(pid)?.rfLast || 0); },
  /** "auto" (Standard / Deep may start it by themselves) for this person's review. */
  _rfModel(pid = this._rvPid) { const rv = this._rvOf?.(pid); return modelOfId(rv?.engId) || "standard"; },
  _rfAutoOk(x) { return this._rfModel() !== "quick" && this._rfCan(x) && !this._rfBusyElse() && this._rfRoom(); },
  _rfRunning(i) { return !!this._rv?.rfBusy?.has(i); },
  /** Re-run decision i (record index). Resolves true when the stored result changed. */
  _rfRun(i, pid = this._rvPid) {
    const R = this._rv, x = this._rfX(i, pid);
    if (!R || !x) return Promise.resolve(false);
    R.rfBusy = R.rfBusy || new Map(); R.rfFail = R.rfFail || new Set();
    if (R.rfBusy.has(i)) return R.rfBusy.get(i);
    if (!this._rfCan(x, pid) || this._rfBusyElse() || !this._rfRoom(pid)) return Promise.resolve(false);
    const rv = this._rvOf(pid), opts = refineOpts(x), t0 = now();
    const p = (async () => {
      let ok = false;
      try {
        const m = await reviewRequest({ type: "evaluate", base: R.base, rec: R.recs[i], opts }, 90000, 0);
        if (this._rv !== R) return false;
        const z = m?.result ? refineResult(x, m.result) : null;
        if (z) { const k = rv.results.findIndex((y) => y.i === i); rv.results[k] = z; liftReview(rv); ok = true; }
      } catch (e) { console.warn("refine", e); }
      if (this._rv !== R) return false;
      rv.rfLast = Math.max(rv.rfLast || 0, now() - t0); rv.rfMs = (rv.rfMs || 0) + (now() - t0);
      if (!ok) R.rfFail.add(i);
      R.rfBusy.delete(i);
      aiCacheReset(this); this._rvSave?.(); this._rvTick?.();
      if (this._rvEl) { try { this._rvLiveFlag = false; this._rvStep != null ? this._rvDrawReview(this._rvStep) : this._rvDrawReview(); } catch (_) { /* closed */ } }
      return ok;
    })();
    R.rfBusy.set(i, p);
    return p;
  },
  /** The person tapped "Check with more futures": run it now (also in Quick), show the state. */
  _rfRunNow(i) { const R = this._rv; if (!R) return; this._rfRun(i); setTimeout(() => { if (this._rvEl && this._rfRunning(i) && this._rvStep === i) this._rvDrawReview(i); }, 0); },
  /** Deep review: every close / lean decision of the person, biggest gap first, one after the other until the cap. */
  _rfAuto(pid) {
    const R = this._rv; if (!R || this._rfModel(pid) !== "deep") return null;
    const todo = (this._rvOf(pid)?.results || []).filter((x) => this._rfCan(x, pid)).sort((a, b) => (b.lossRaw || 0) - (a.lossRaw || 0)).map((x) => x.i);
    return todo.length ? this._rfAutoRun(R, pid, todo) : null;
  },
  async _rfAutoRun(R, pid, todo) {
    for (const i of todo) { if (this._rv !== R || this._rfBusyElse() || !this._rfRoom(pid)) break; await this._rfRun(i, pid); }
  },
  /** The AI tool refine_decision{turn, player, n}: refine the person's own decision (or tell why not) and return the fresh numbers. */
  async _rfTool(a) {
    const R = this._rv, r = aiPick(this, a); if (r.err) return { error: r.err };
    const x = r.e.x, pid = r.e.seat;
    if (pid !== this._rvPid || !this.players[pid]?.isHuman) return { error: "only the player's own decisions can be refined" };
    if (x.refined) return { note: "already refined", futures: x.refined.n };
    const vc = vcOf(x); if (vc === "clear") return { note: "already a clear verdict: no refinement needed" };
    if (!vc) return { error: "no real choice there" };
    if (!this._rfCan(x, pid)) return { error: "this decision cannot be refined now" };
    if (this._rfBusyElse()) return { error: "the engine is busy with the bots' check; try later" };
    if (!this._rfRoom(pid)) return { error: "the refinement time of this review is used up" };
    const ok = await this._rfRun(x.i, pid);
    return ok ? { refined: true, futures: REFINE_N } : { error: "the engine could not refine this decision" };
  },
  /** The small state under a decision's verdict (step view): refining…, refined, or the offer. */
  _rfHtml(d) {
    const x = d?.x; if (!x || d.cls === "triv" || !this.players?.[this._rvPid]?.isHuman) return "";
    if (this._rfRunning(x.i) || (this._rfAutoOk(x) && this._rfModel() !== "quick")) return `<p class="rs-rf" role="status"><i class="rv-spin" aria-hidden="true"></i>Refining… more futures on this move</p>`;
    if (x.refined) return `<p class="rs-rf done">Refined · ${x.refined.n} futures each</p>`;
    if (this._rfCan(x) && !this._rfBusyElse() && this._rfRoom()) return `<button type="button" class="rv-btn rs-rfb" data-rvrf="${x.i}">Check with more futures</button>`;
    return "";
  },
  /** Called after the step view is drawn: start the lazy refinement of the opened move. */
  _rfKick(d) { const x = d?.x; if (x && this._rfAutoOk(x) && !this._rfRunning(x.i)) setTimeout(() => { if (this._rvStep === x.i) this._rfRun(x.i); }, 0); },
};
