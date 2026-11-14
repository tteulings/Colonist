// v1.59 Live win chance: an optional thin bar under the player strip (Settings > Game, or the Menu sheet).
// The numbers are the Quick review model's: the boosted-tree leaf straight on the position (gbmProbs, ~1 ms), never a search.
// It reads the game and changes nothing; it runs after the position has settled (debounced, idle), never while a bot searches.
import { gbmProbs } from "./master/leaf-gbm.js";

const KEY = "colonist_live_win";
export const liveWinOn = () => { try { return localStorage.getItem(KEY) === "on"; } catch (_) { return false; } };
export function setLiveWin(on) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (_) {}
  window.dispatchEvent(new CustomEvent("livewin-change", { detail: on }));
}
const NOTE = "Estimated by the quick model from the current position. Not a promise.";

export const LiveBarMixin = {
  /** Called from render(): cheap; schedules an evaluation only when the position changed. */
  _lbTick() {
    if (!this._lbInit) {
      this._lbInit = true;
      window.addEventListener("livewin-change", () => { this._lbKey = null; this._lbTick(); });
    }
    const on = liveWinOn() && !this.hotseat && this.players?.length && this.geometry;
    if (!on) { if (this._lbEl) this._lbEl.hidden = true; return; }
    const P = this.players;
    const key = [this.turn, this.currentPlayerIndex, this.setupPhase ? 1 : 0, this.winner ? 1 : 0, this.robberHexId,
      ...P.map((p) => `${p.victoryPoints}.${p.settlements.size}.${p.cities.size}.${p.roads.size}.${p.ships?.size ?? 0}`)].join("|");
    if (key === this._lbKey) return;
    this._lbKey = key;
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
      this._lbDraw(w);
    };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1200 }); else setTimeout(go, 0);
  },
  _lbEnsure() {
    if (this._lbEl && this._lbEl.isConnected) return this._lbEl;
    const host = document.querySelector("#mtop");
    if (!host) return null;
    const el = document.createElement("div");
    el.id = "liveBar"; el.className = "livebar"; el.hidden = true; el.setAttribute("role", "img");
    el.innerHTML = `<div class="lb-track"></div><div class="lb-note" hidden>${NOTE}</div>`;
    el.addEventListener("click", () => {
      const n = el.querySelector(".lb-note"); n.hidden = !n.hidden;
      clearTimeout(this._lbNoteT); if (!n.hidden) this._lbNoteT = setTimeout(() => { n.hidden = true; }, 4000);
    });
    host.insertAdjacentElement("afterend", el);
    return (this._lbEl = el);
  },
  _lbDraw(w) {
    const el = this._lbEnsure();
    if (!el) return;
    if (!w || !w.length || w.some((x) => !Number.isFinite(x))) { el.hidden = true; return; }
    const P = this.players, track = el.querySelector(".lb-track");
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
    el.setAttribute("aria-label", "Win chance (quick model): " + P.map((p, i) => `${i === me ? "you" : p.name} ${pct[i]}%`).join(", "));
    el.hidden = false;
  },
};
