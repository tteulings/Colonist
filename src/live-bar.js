// v1.59 Live win chance: an optional thin bar under the player strip (Settings > Game, or the Menu sheet).
// The numbers are the Quick review model's: the boosted-tree leaf straight on the position (gbmProbs, ~1 ms), never a search.
// It reads the game and changes nothing; it runs after the position has settled (debounced, idle), never while a bot searches.
// v1.99.9: no bar any more: the numbers ride on the player chips (see _lbDraw). Everything below about "the bar" means those numbers.
// v1.60 "Keep refining": like a chess engine's eval bar it keeps deepening while the position stands still. The quick value shows at once,
// then ONE background worker (src/master/worker.js "live") plays futures of the position (20 turns of normal bot play each, the gbm leaf at
// the end, the Standard review's way) in batches of 10 up to 400 and posts the running average; the bar moves toward it and its end says
// how many futures it stands on. A new position cancels the job; a searching bot or a hidden tab pauses it. The worker has its own RNG.
import { gbmProbs } from "./master/leaf-gbm.js";
import { t } from "./i18n.js";

const KEY = "colonist_live_win";
export const liveWinOn = () => { try { return localStorage.getItem(KEY) === "on"; } catch (_) { return false; } };
export function setLiveWin(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (_) {}
  window.dispatchEvent(new CustomEvent("livewin-change", { detail: on }));
}
const RKEY = "colonist_live_refine";
/** "Keep refining" (default on whenever the live bar is on). */
export const liveRefineOn = () => { try { return localStorage.getItem(RKEY) !== "off"; } catch (_) { return true; } };
export function setLiveRefine(on) {
  try { localStorage.setItem(RKEY, on ? "on" : "off"); } catch (_) {}
  window.dispatchEvent(new CustomEvent("livewin-change", { detail: liveWinOn() }));
}
export const LIVE_MC = { cap: 400, batch: 10, depth: 20 };

export const LiveBarMixin = {
  /** Called from render(): cheap; schedules an evaluation only when the position changed. */
  _lbTick() {
    if (!this._lbInit) {
      this._lbInit = true;
      window.addEventListener("livewin-change", () => { this._lbKey = null; this._lbTick(); });
    }
    const on = liveWinOn() && !this.hotseat && this.players?.length && this.geometry;
    if (!on) { this._lbStop(); if (this._lbW || document.querySelector(".lb-pct")) this._lbClear(); return; }
    const P = this.players;
    if (this._lbPl !== P) { this._lbPl = P; this._lbW = null; } // a new game: the old numbers are not shown
    const key = [this.turn, this.phase, this.currentPlayerIndex, this.setupPhase ? 1 : 0, this.winner ? 1 : 0, this.robberHexId,
      ...P.map((p) => `${p.victoryPoints}.${p.settlements.size}.${p.cities.size}.${p.roads.size}.${p.ships?.size ?? 0}`)].join("|");
    if (key === this._lbKey) return;
    this._lbKey = key;
    this._lbStop(); // a new position: the running job is dropped at once
    clearTimeout(this._lbTimer);
    this._lbTimer = setTimeout(() => this._lbRun(key), 350);
  },
  _lbRun(key) {
    if (key !== this._lbKey) return;
    if (this._masterBusy) { this._lbTimer = setTimeout(() => this._lbRun(key), 500); return; } // never while a bot searches
    const go = () => {
      if (key !== this._lbKey || !liveWinOn()) return;
      let w = null;
      const t0 = performance.now();
      try { w = gbmProbs(this); } catch (_) { w = null; }
      const ms = performance.now() - t0;
      const s = (window.__lbStats ||= { n: 0, ms: 0, max: 0, last: null }); s.n++; s.ms += ms; s.max = Math.max(s.max, ms); s.last = w;
      this._lbDraw(w, 0);
      this._lbDeep(key);
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1200 }); else setTimeout(go, 0);
  },
  _lbStop() {
    this._lbJob = null;
    if (this._lbWorker) { try { this._lbWorker.postMessage({ type: "live", op: "stop" }); } catch (_) {} }
    clearInterval(this._lbPoll); this._lbPoll = null;
  },
  /** Can the futures be played from here? A settled turn start or main phase of a turn-based game (not set-up, Rush, a pending 7). */
  _lbCanDeep() {
    return liveRefineOn() && !this.setupPhase && !this.winner && this.settings?.mode !== "rush" && (this.phase === "pre_roll" || this.phase === "main")
      && !this.sbp && this.pendingAction !== "robber" && typeof Worker !== "undefined" && !this._lbBroken;
  },
  _lbDeep(key) {
    if (key !== this._lbKey || !this._lbCanDeep()) return;
    if (!this._lbWorker) {
      try {
        const w = new Worker(new URL("./master/worker.js?v=1999", import.meta.url), { type: "module" });
        w.addEventListener("message", (e) => {
          const m = e.data;
          if (m.type === "live" && m.job === this._lbJob) { this._lbN = m.n; this._lbDraw(m.p, m.n); const s = (window.__lbStats ||= { n: 0, ms: 0, max: 0, last: null }); s.deep = { n: m.n, p: m.p }; }
        });
        w.addEventListener("error", () => { this._lbBroken = true; try { w.terminate(); } catch (_) {} this._lbWorker = null; this._lbJob = null; });
        this._lbWorker = w;
        this._lbReady = new Promise((res) => { const f = (e) => { if (e.data?.type === "ready") { w.removeEventListener("message", f); res(true); } }; w.addEventListener("message", f); setTimeout(() => res(false), 10000); });
      } catch (_) { this._lbBroken = true; return; }
    }
    const job = (this._lbJobSeq = (this._lbJobSeq || 0) + 1);
    this._lbJob = job;
    const st = this.serializeState();
    delete st.logEntries; delete st.stats;
    if (st.pendingAction) st.pendingAction = null;
    const trk = this._aiCardTrack?.players === this.players ? this._aiCardTrack.est.map((e) => ({ ...e })) : null;
    const humans = this.players.map((p) => !!p.isHuman);
    const msg = { type: "live", op: "start", job, state: st, trk, turnSerial: this.turnSerial, seat: this.currentPlayerIndex, humans, ...LIVE_MC };
    this._lbReady.then((ok) => {
      if (!ok || this._lbJob !== job || key !== this._lbKey) return;
      this._lbWorker.postMessage(msg);
      this._lbPaused = false;
      clearInterval(this._lbPoll);
      // pause while a bot searches or the tab is hidden; resume after
      this._lbPoll = setInterval(() => {
        if (this._lbJob !== job) return;
        const stop = document.hidden || !!this._masterBusy;
        if (stop !== this._lbPaused) { this._lbPaused = stop; this._lbWorker.postMessage({ type: "live", op: stop ? "pause" : "resume", job }); }
        if (this._lbN >= LIVE_MC.cap) { clearInterval(this._lbPoll); this._lbPoll = null; }
      }, 250);
      this._lbN = 0;
    });
  },
  /** v1.99.9 no separate bar row: each player's win chance is a small number in the player strip (and the scoreboard row on wide screens).
   *  The numbers are shown as the model gives them (rounded, never rescaled to hit 100); the model label sits in the tap-a-player info and the tooltip. */
  _lbModel(n = this._lbNn) { return n ? t("{n} games simulated", { n }) : t("quick"); },
  _lbSumNote(w = this._lbW) {
    const sum = w ? w.reduce((a, b) => a + b, 0) : 1;
    return Math.abs(sum - 1) > 0.03 ? t("They add up to {x}%, as the model gives them", { x: Math.round(sum * 100) }) : "";
  },
  /** The win chance of seat i as { pct, title } (null while off or not yet known). */
  _lbOf(i) {
    if (!liveWinOn() || !this._lbW || this.hotseat || !Number.isFinite(this._lbW[i])) return null;
    const pct = Math.round(this._lbW[i] * 100) + "%", note = this._lbSumNote();
    return { pct, title: `${t("Win chance")} ${pct} (${this._lbModel()})${note ? ". " + note : ""}` };
  },
  /** Markup for the chip / scoreboard row being built right now (so a re-render never loses the number). */
  _lbPctHtml(i) {
    const o = this._lbOf(i);
    return o ? `<em class="lb-pct" title="${o.title}" aria-hidden="true">${o.pct}</em>` : "";
  },
  _lbAria(i) { const o = this._lbOf(i); return o ? `, ${t("Win chance")} ${o.pct}` : ""; },
  _lbClear() {
    this._lbW = null;
    document.querySelectorAll(".lb-pct").forEach((e) => e.remove());
    document.querySelectorAll("[data-lb-base]").forEach((c) => { c.setAttribute("aria-label", c.dataset.lbBase); delete c.dataset.lbBase; });
  },
  _lbDraw(w, n = 0) {
    if (!w || !w.length || w.length !== this.players?.length || w.some((x) => !Number.isFinite(x))) { this._lbClear(); return; }
    this._lbW = w; this._lbNn = n;
    // the live elements are updated in place (fixed-width tabular numbers; a short fade marks a change, no movement)
    document.querySelectorAll(".pstrip .pchip[data-seat], #scoreboard .prow[data-seat]").forEach((c) => {
      const i = Number(c.dataset.seat), o = this._lbOf(i);
      if (!o) return;
      const host = c.classList.contains("pchip") ? c.querySelector(".row") : c.querySelector(".stats");
      if (!host) return;
      let e = host.querySelector(".lb-pct");
      if (!e) { host.insertAdjacentHTML("beforeend", this._lbPctHtml(i)); e = host.querySelector(".lb-pct"); }
      else if (e.textContent !== o.pct) { e.textContent = o.pct; e.classList.remove("tk"); void e.offsetWidth; e.classList.add("tk"); }
      e.title = o.title;
      const base = c.dataset.lbBase ?? (c.dataset.lbBase = (c.getAttribute("aria-label") || "").replace(new RegExp(`, ${t("Win chance")} \\d+%$`, "i"), ""));
      if (c.classList.contains("pchip")) c.setAttribute("aria-label", base + this._lbAria(i));
    });
    window.__lbPct = this.players.map((_, i) => this._lbOf(i)?.pct);
  },
};
