// v1.82 "Why is A better than B" from the engine's own futures (src/review/why-mc.js). When a decision is opened in the AI tab or the Why?
// panel (or the AI asks get_decision), the played move B and its best alternative A are run again on the SAME paired futures with a
// tracer on the mover (200 futures, time capped: ~15 s desktop, ~40 s phone); the features that differ significantly AND move the win
// chance become up to 3 typed reasons, saved with the stored decision (x.rsn) so it is never computed twice. Never during bot play.
import { reviewRequest, reviewAvailable } from "./master.js";
import { aiCacheReset, aiPick } from "./review/ai-tools.js";
import { REVIEW_ENGINE } from "./review/evaluate.js";
import { vcOf } from "./review/score.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const coarse = () => { try { return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches; } catch (_) { return false; } };
export const RSN_N = 200;
export const RSN_CAP_MS = 15000; // desktop; a phone 40 s
export const rsnCap = () => (coarse() ? 40000 : RSN_CAP_MS);
export const RSN_V = 1;
/** Opts of the explain request for a stored result (null: nothing to explain). Pure. */
export const rsnOpts = (x, cap = RSN_CAP_MS) => (x?.best?.label && x.cands?.length > 1 ? { engine: x.eng && x.eng !== REVIEW_ENGINE ? x.eng : undefined, explain: true, budget: { only: x.best.label, nPer: RSN_N, timeMs: cap } } : null);
/** The record kept with the stored decision from an evaluate result (null: the run gave nothing usable). Pure. */
export function rsnFold(out) {
  const e = out?.explain; if (!e || !(e.n >= 20)) return null;
  return { v: RSN_V, n: e.n, gap: e.gap, se: e.se, ms: e.ms, reasons: (e.reasons || []).slice(0, 3) };
}

export const ReviewReasonsMixin = {
  _rsnX(i, pid = this._rvPid) { return this._rvOf?.(pid)?.results?.find((y) => y.i === i) || null; },
  /** A stored decision that can be explained (a real choice with a better move, the position stored, the engine there). */
  _rsnCan(x, pid = this._rvPid) {
    const R = this._rv;
    if (!R?.base || !x || !x.best || x.trivial || R.rsnFail?.has(x.i) || !reviewAvailable()) return false;
    if (R.again || (R.run && !this.players?.[R.run.pid]?.isHuman)) return false; // bots are being checked: do not take the engine
    return !!rsnOpts(x) && !!R.recs?.[x.i]?.st;
  },
  _rsnDone(x) { return !!x?.rsn; },
  _rsnRunning(i) { return !!this._rv?.rsnBusy?.has(i); },
  /** Compute (or reuse) the reasons of decision i. Resolves the record { reasons, n, gap, se, ms } or null (cannot / failed). */
  _rsnRun(i, pid = this._rvPid) {
    const R = this._rv, x = this._rsnX(i, pid);
    if (!R || !x) return Promise.resolve(null);
    if (x.rsn) return Promise.resolve(x.rsn);
    R.rsnBusy = R.rsnBusy || new Map(); R.rsnFail = R.rsnFail || new Set();
    if (R.rsnBusy.has(i)) return R.rsnBusy.get(i);
    if (!this._rsnCan(x, pid)) return Promise.resolve(null);
    const rv = this._rvOf(pid), cap = rsnCap(), opts = rsnOpts(x, cap), t0 = now();
    const p = (async () => {
      let rec = null;
      try {
        const m = await reviewRequest({ type: "evaluate", base: R.base, rec: R.recs[i], opts }, cap + 60000, 0);
        if (this._rv !== R) return null;
        rec = m?.result ? rsnFold(m.result) : null;
        if (rec) { const y = rv.results.find((q) => q.i === i); if (y) y.rsn = rec; }
      } catch (e) { console.warn("reasons", e); }
      if (this._rv !== R) return null;
      if (!rec) R.rsnFail.add(i);
      R.rsnBusy.delete(i);
      aiCacheReset(this); this._rvSave?.(); this._rvTick?.();
      return rec;
    })();
    R.rsnBusy.set(i, p);
    return p;
  },
  /** For a tool request { turn, player, n }: make sure the reasons of that decision are computed (the "working out why…" state shows meanwhile). */
  async _rsnTool(a) {
    const r = aiPick(this, a || {}); if (r.err) return null;
    const x = r.e.x; if (x.rsn || !this._rsnCan(x, r.e.seat)) return x.rsn || null;
    if (!x.best || vcOf(x) == null) return null;
    this._rsnWorking = (this._rsnWorking || 0) + 1; this._aiRefresh?.();
    try { return await this._rsnRun(x.i, r.e.seat); } finally { this._rsnWorking -= 1; this._aiRefresh?.(); }
  },
};
