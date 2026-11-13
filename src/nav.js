// v1.26 Back gesture (Android / browser Back): one small, central stack on top of the browser history.
//
// The app never navigates; screens and sheets are DOM layers. This module counts the layers that are open
// (LAYERS below, top first) and keeps exactly that many history entries above the page's own entry:
//   - a layer opens (any way: a tap, a code path)        -> pushState, one entry per layer
//   - a layer closes by its own button / scrim / Escape  -> history.go(-n): the entries go too, no doubles
//   - Back (popstate)                                    -> the top layer closes through its own close path
// The count is read from the DOM / game state, so no screen has to call in here: a MutationObserver
// re-syncs (throttled) after every change. Each entry carries its depth ({nav: d}), so a reload (entries
// survive it) or a forward step is put right on the next sync.
//
// Home with nothing open: no entry, so Back leaves the app (no trap). A running game is one layer of its own
// (the "guard"): Back closes the top sheet first; with nothing open it shows "Press Back again to leave" and
// drops the guard for 2.5 s, so a second Back leaves (the game is saved) and a stray edge swipe while
// panning the board does not. Pass & play covers are not a layer: Back never lifts a cover.
import { closeSheet as closeProfileSheet } from "./bot-profile-ui.js";

const q = (s) => document.querySelector(s);
const shown = (el) => !!el && el.isConnected && el.style.display !== "none" && !el.hidden;
const tap = (s) => { const b = q(s); if (b) b.click(); return !!b; };
const GUARD_OFF_MS = 2500;

/** [name, open?(game), close(game)]; the first open one is the top. */
const LAYERS = [
  ["profile", () => q(".bp-sheet"), () => closeProfileSheet()],
  ["names", () => q(".nm-sheet"), () => tap(".nm-sheet [data-close]")],
  ["rvinfo", () => q(".rv-info"), () => tap(".rv-info [data-rvinfo-x]")],
  ["gamesheet", () => q(".hs-sheet"), () => tap(".hs-sheet [data-sclose]")],
  ["intro", (g) => g.onboarding?.open, (g) => g.onboarding.endIntro()],
  ["settings", (g) => g.settingsUI?.el, (g) => g.settingsUI.close()],
  ["newgame", () => q(".newgame-modal"), () => tap(".newgame-modal [data-action=cancel]") || q(".newgame-modal")?.remove()],
  ["menu", (g) => g.menu?.open, (g) => g.menu.close()],
  ["livestats", (g) => g._lsEl, (g) => g.liveStatsClose()],
  ["sea", () => q(".sea-chooser"), (g) => g._seaCloseChooser?.()],
  ["trade", (g) => !g.home?.open && shown(g.tradeModal), (g) => g.closeTradeModal()],
  ["devcards", (g) => !g.home?.open && shown(g.devCardPicker), (g) => { g.hideDevCardPicker(); g._syncScrim?.(); }],
  ["build", (g) => !g.home?.open && g.app?.classList.contains("build-open"), (g) => g.toggleBuildSheet(false)],
  ["log", (g) => !g.home?.open && g.isMobileLayout && g.railLog?.classList.contains("open"), (g) => g.toggleLog(false)],
  ["tray", (g) => !g.home?.open && !g.winner && g.trayMode, (g) => g.closeTray()],
  ["playbyplay", (g) => g._rvEl && g._rvPbp && q("[data-rvpbpx]"), () => tap("[data-rvpbpx]")],
  ["rpinfo", (g) => g._rpUi && q(".gs-rp-note:not([hidden])"), () => tap("[data-rpinfo]")],
  ["replay", (g) => g._rpUi, (g) => g._rpExit()],
  ["step", (g) => g._rvEl && g._rvStep != null, () => tap("[data-rvclose-step]")],
  ["player", (g) => g._rvEl && !g._rvMid && g._rvTab === "player" && (g._rvStep == null || g._rvStepFrom?.tab === "player"), () => tap(".pp-bar [data-rvt]")], // v1.52 a player's page is a level above the Overview
  ["review", (g) => g._rvEl, (g) => tap("[data-rvclose]") || g._rvCloseReview(true)],
  ["bots", (g) => g._bpgEl, (g) => g.botsClose()],
  ["pastgames", (g) => g._histEl, (g) => g.histClose()],
  ["finalboard", () => q(".gs-seeback"), () => tap(".gs-seeback")],
  ["endscreen", (g) => !g.home?.open && q(".game-over-overlay, .gs-count"), (g) => g._stLeave()],
  ["game", (g) => g._navGuardOn(), (g) => g._navGuardPop()],
];

export const NavMixin = {
  /** A running game (not on Home, not over, not a past game): Back must not leave it by accident. */
  _navGuardOn() {
    if (this.home?.open || this.onboardingHold || this.winner || this._histView || this.labMode) return false;
    return !(this._nav && Date.now() < this._nav.guardOff);
  },
  /** Back with nothing open in a running game: a quiet note, and the next Back within 2.5 s leaves. */
  _navGuardPop() {
    const N = this._nav;
    N.guardOff = Date.now() + GUARD_OFF_MS;
    clearTimeout(N.guardT);
    const back = () => { const left = N.guardOff - Date.now(); if (left > 0) N.guardT = setTimeout(back, left + 30); else this._navSoon(); };
    N.guardT = setTimeout(back, GUARD_OFF_MS + 30);
    q(".nav-toast")?.remove();
    const t = document.createElement("div");
    t.className = "nav-toast";
    t.setAttribute("role", "status");
    t.textContent = "Press Back again to leave";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), GUARD_OFF_MS);
  },
  _navDepth() { return LAYERS.reduce((n, [, on]) => n + (on(this) ? 1 : 0), 0); },
  _navTop() { return LAYERS.find(([, on]) => on(this)); },
  /** Make the history entries above the page match the open layers. */
  _navSync() {
    const N = this._nav;
    if (!N || N.busy) return;
    N.t = 0;
    const want = this._navDepth();
    if (want > N.at) {
      while (N.at < want) { N.at += 1; history.pushState({ nav: N.at }, ""); }
    } else if (want < N.at) {
      N.busy = true;
      clearTimeout(N.busyT); N.busyT = setTimeout(() => { N.busy = false; N.at = history.state?.nav ?? 0; this._navSoon(); }, 1500); // a popstate that never came
      history.go(want - N.at);
    }
  },
  _navSoon() { const N = this._nav; if (N && !N.t) N.t = setTimeout(() => this._navSync(), 40); },
  _navPop(e) {
    const N = this._nav, d = e.state?.nav ?? 0;
    if (N.busy) { N.busy = false; clearTimeout(N.busyT); N.at = d; this._navSoon(); return; } // our own go(): only the count
    let pops = N.at - d;
    N.at = d;
    for (; pops > 0; pops -= 1) { const top = this._navTop(); if (!top) break; try { top[2](this); } catch (_) { /* a screen that is already gone */ } }
    this._navSoon();
  },
  _navInstall() {
    if (this._nav || typeof history?.pushState !== "function" || document.documentElement.dataset.lab || document.documentElement.dataset.labwatch) return;
    const N = (this._nav = { at: history.state?.nav ?? 0, busy: false, t: 0, guardOff: 0 });
    if (history.state?.nav == null) history.replaceState({ ...(history.state || {}), nav: 0 }, "");
    addEventListener("popstate", (e) => this._navPop(e));
    new MutationObserver(() => this._navSoon()).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    N.t = 0; this._navSync();
  },
};
