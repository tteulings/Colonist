// v1.59 Live win chance: an optional thin bar under the player strip (Settings > Game, or the Menu sheet).
// The numbers are the Quick review model's: the boosted-tree leaf straight on the position (gbmProbs, ~1 ms), never a search.
// It reads the game and changes nothing; it runs after the position has settled (debounced, idle), never while a bot searches.
// v1.60 "Keep refining": like a chess engine's eval bar it keeps deepening while the position stands still. The quick value shows at once,
// then ONE background worker (src/master/worker.js "live") plays futures of the position (20 turns of normal bot play each, the gbm leaf at
// the end, the Standard review's way) in batches of 10 up to 400 and posts the running average; the bar moves toward it and its end says
// how many futures it stands on. A new position cancels the job; a searching bot or a hidden tab pauses it. The worker has its own RNG.
import { gbmProbs } from "./master/leaf-gbm.js";

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
const NOTE = "Quick model, then refined by simulating futures. Not a promise.";
export const LIVE_MC = { cap: 400, batch: 10, depth: 20 };

export const LiveBarMixin = {
  /** Called from render(): cheap; schedules an evaluation only when the position changed. */
  _lbTick() {
    if (!this._lbInit) {
      this._lbInit = true;
      window.addEventListener("livewin-change", () => { this._lbKey = null; this._lbTick(); });
    }
    const on = liveWinOn() && !this.hotseat && this.players?.length && this.geometry;
    if (!on) { this._lbStop(); if (this._lbEl) this._lbEl.hidden = true; return; }
    const P = this.players;
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
        const w = new Worker(new URL("./master/worker.js?v=160", import.meta.url), { type: "module" });
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
  _lbEnsure() {
    if (this._lbEl && this._lbEl.isConnected) return this._lbEl;
    const host = document.querySelector("#mtop");
    if (!host) return null;
    const el = document.createElement("div");
    el.id = "liveBar"; el.className = "livebar"; el.hidden = true; el.setAttribute("role", "img");
    el.innerHTML = `<div class="lb-row"><div class="lb-track"></div><span class="lb-depth"></span></div><div class="lb-note" hidden>${NOTE}</div>`;
    el.addEventListener("click", () => {
      const n = el.querySelector(".lb-note"); n.hidden = !n.hidden;
      clearTimeout(this._lbNoteT); if (!n.hidden) this._lbNoteT = setTimeout(() => { n.hidden = true; }, 4000);
    });
    host.insertAdjacentElement("afterend", el);
    return (this._lbEl = el);
  },
  _lbDraw(w, n = 0) {
    const el = this._lbEnsure();
    if (!el) return;
    if (!w || !w.length || w.some((x) => !Number.isFinite(x))) { el.hidden = true; return; }
    const P = this.players, track = el.querySelector(".lb-track");
    el.querySelector(".lb-depth").textContent = n ? `${n} futures` : "quick";
    const me = P.findIndex((p) => p.isHuman);
    if (track.children.length !== P.length) {
      track.innerHTML = P.map((p, i) => `<i class="lb-seg${i === me ? " me" : ""}" style="background:${p.color}"><b></b></i>`).join("");
    }
    const pct = w.map((x) => Math.round(x * 100));
    P.forEach((p, i) => {
      const seg = track.children[i];
      seg.style.flexGrow = String(Math.max(w[i], 0.002));
      seg.firstChild.textContent = w[i] >= 0.09 ? pct[i] + "%" : "";
    });
    el.setAttribute("aria-label", (n ? `Win chance (${n} futures): ` : "Win chance (quick model): ") + P.map((p, i) => `${i === me ? "you" : p.name} ${pct[i]}%`).join(", "));
    el.hidden = false;
  },
};
