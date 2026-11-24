// v1.99 Post-game UI: swaps the v1.98 review screens (Overview, Win chance, Luck, Moves, player page, end-screen scorecard, (i)) for the v1.99 ones.
// Loaded after installReviewGame in src/game.js; nothing else in the v1.98 review changes (step view, AI tab, progress, saving).
import { esc } from "./review-ui.js";
import { summarize, modelOfId } from "./review/evaluate.js";
import { scoreHtml, overviewTab, infoSheet, numbersSheet } from "./post-ui.js";
import { movesTab, strategyTab, luckTab, playerTab } from "./post-tabs.js";
import { installPostHist } from "./post-hist.js";

const TABS = [["overview", "Overview"], ["moves", "Moves"], ["strategy", "Strategy"], ["luck", "Luck"]];
export function installPost(Cls) {
  const P = Cls.prototype;
  P._rvScoreHtml = function () { return scoreHtml(this); };
  P._rvTabsBar = function (on) {
    const T = [...TABS]; if (this._aiAvail?.()) T.push(["ai", "AI · beta"]);
    return `<div class="rv-tabs px-tabs${T.length > 4 ? " t5" : ""}" role="tablist" aria-label="Game review">${T.map(([k, l]) => `<button type="button" role="tab" class="${k === on ? "on" : ""}" aria-selected="${k === on}" data-rvt="${k}">${l}</button>`).join("")}</div>`;
  };
  P._rvTabOverview = function (ds, rv, prov) { return overviewTab(this, ds, rv, prov); };
  P._rvTabMoves = function (ds, res, rv) { return movesTab(this, ds, res, rv); };
  P._rvTabLuck = function (ds) { return luckTab(this, ds); };
  P._rvTabStrategy = function (ds, rv) { return strategyTab(this, ds, rv); };
  P._rvTabPlayer = function (ds, rv, prov) { return playerTab(this, ds, rv, prov); };
  P._rvShowInfo = function () { this._rvInfoOpen = false; infoSheet(this, "error"); };
  P._pxNumbers = function () { return numbersSheet(this); };
  // the review frame: same as v1.98 with the five v1.99 tabs (a "Win chance" tab from an older session maps to the Overview)
  P._rvOverview = function (ds, res, rv) {
    if (this._rvMid) return this._rvOverviewMid(ds, res, rv);
    const el = this._rvEl, pid = this._rvPid, prov = !this._rvReviewComplete(pid);
    if (this._rvTab === "win") this._rvTab = "overview";
    const tab = (this._rvTab = ["overview", "moves", "strategy", "luck", "player", ...(this._aiAvail?.() ? ["ai"] : [])].includes(this._rvTab) ? this._rvTab : "overview");
    this._rvWinOff2?.(); this._rvWinOff2 = null;
    this._rvT = this._rvTotals(ds);
    const part = { overview: () => this._rvTabOverview(ds, rv, prov), moves: () => this._rvTabMoves(ds, res, rv), strategy: () => this._rvTabStrategy(ds, rv), luck: () => this._rvTabLuck(ds), player: () => this._rvTabPlayer(ds, rv, prov), ai: () => this._rvTabAi(ds, rv, prov) }[tab]();
    const scroll = this._rvTabDrawn === `${pid}|${tab}` ? el.querySelector(".rv-scroll")?.scrollTop || 0 : 0;
    this._rvTabDrawn = `${pid}|${tab}`;
    el.className = "rv rs tm px";
    const pop0 = el.querySelector(".rv-pop"), sh = el.querySelector(".px-sheet");
    const label = { overview: "Overview", moves: "Moves", strategy: "Strategy", luck: "Luck", ai: "AI coach" }[tab];
    el.innerHTML = `${tab === "player" ? part.bar : this._rvBar(`${ds.length} decisions · ${prov ? "provisional" : ({ quick: "Quick model, rough", deep: "Deep model" })[modelOfId(rv.engId)] || "deep Monte Carlo"}`, label)}${tab === "player" ? "" : this._rvTabsBar(tab)}
      <div class="rv-scroll">${part.html}${tab === "overview" || tab === "ai" ? (this._rcBox?.() || "") + (this._raBox?.() || "") : ""}</div>${part.foot || ""}`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    if (pop0) el.appendChild(pop0);
    if (sh) el.appendChild(sh);
    this._rvBindTop(el); this._raBind?.(el); this._rcBind?.(el); this._rvBindTable(el); this._rvBindMoves?.(el);
    el.querySelectorAll("[data-rvt]").forEach((b) => b.addEventListener("click", () => { const bk = b.dataset.rvpp && this._aiBack?.R === this._rv ? this._aiBack : null; if (bk) { this._aiBack = null; this._aiScrollY ??= 0; if (bk.pid !== this._rvPid) this._rvOpenReview(bk.pid, { tab: "ai" }); else { this._rvTab = "ai"; this._rvDrawReview(); } return; } if (this._rvTab !== b.dataset.rvt || b.dataset.rvpp) { this._rvTab = b.dataset.rvt; this._rvDrawReview(); } }, { once: false }));
    el.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = b.dataset.rvq || "all"; this._rvEnterStep(+b.dataset.rvj); }));
    part.bind?.(el);
    this._rvChipSync?.();
  };
  installPostHist(Cls);
}
