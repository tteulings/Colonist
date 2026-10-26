// First launch: a calm welcome sheet (Quick game / Choose settings) and an optional, skippable
// three-card "How to play" intro. Both are remembered in localStorage.
import { icon } from "./manager.js";

const WELCOMED_KEY = "colonist.welcomed";
const INTRO_KEY = "colonist.intro";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};

/** True until the player has picked Quick game / Choose settings once. */
export function isFirstLaunch() { return !store.get(WELCOMED_KEY); }
export function introSeen() { return store.get(INTRO_KEY) === "done"; }

export class Onboarding {
  /** opts: { costs: {road, settlement, city, development}, labels: {wood: "Lumber", …}, onQuick(), onSettings() } */
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.el = null;
    this.onKey = (e) => { if (e.key === "Escape" && this.mode === "intro") this.endIntro(); };
  }

  get open() { return !!this.el; }

  mount(html, label) {
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "welcome tm-modal";
      this.el.setAttribute("role", "dialog");
      this.el.setAttribute("aria-modal", "true");
      document.addEventListener("keydown", this.onKey);
      document.body.appendChild(this.el);
    }
    this.el.setAttribute("aria-label", label);
    this.el.innerHTML = `<div class="wl-card">${html}</div>`;
    this.el.querySelector(".wl-card button")?.focus({ preventScroll: true });
  }

  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    this.mode = null;
    document.removeEventListener("keydown", this.onKey);
  }

  showWelcome() {
    this.mode = "welcome";
    this.mount(`
      <svg class="wl-logo" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-logo" x="-50" y="-50" width="100" height="100"/></svg>
      <h2 class="wl-title">Welcome to Colonist</h2>
      <p class="wl-lead">Settle a sunny island, trade with friendly bots and be the first to reach 10 points.</p>
      <div class="wl-actions">
        <button type="button" class="wl-btn primary" data-welcome="quick">${icon("dice")}<span><b>Quick game</b><small>Classic vs 3 bots</small></span></button>
        <button type="button" class="wl-btn" data-welcome="settings">${icon("settings")}<span><b>Choose settings</b><small>Mode, rules and opponents</small></span></button>
      </div>
      <button type="button" class="wl-link" data-welcome="intro">${introSeen() ? "How to play" : "New here? How to play in 3 short cards"}</button>`, "Welcome");
    this.el.querySelector("[data-welcome='quick']").addEventListener("click", () => { store.set(WELCOMED_KEY, "1"); this.close(); this.opts.onQuick(); });
    this.el.querySelector("[data-welcome='settings']").addEventListener("click", () => { store.set(WELCOMED_KEY, "1"); this.close(); this.opts.onSettings(); });
    this.el.querySelector("[data-welcome='intro']").addEventListener("click", () => this.showIntro(0, true));
  }

  /** The three intro cards. fromWelcome: return to the welcome sheet afterwards. */
  showIntro(step = 0, fromWelcome = false) {
    this.mode = "intro";
    this.fromWelcome = fromWelcome;
    const { costs, labels } = this.opts;
    const res = (cost) => Object.entries(cost).filter(([, n]) => n > 0)
      .map(([r, n]) => `<span class="wl-res" title="${n} ${labels[r]}">${n > 1 ? `<i>${n}×</i>` : ""}${icon(r)}</span>`).join("");
    const cards = [
      {
        ic: "build", title: "Resources & build costs",
        body: "Tiles pay out when their number is rolled: every settlement or city on the tile collects. Spend the cards to build.",
        extra: `<div class="wl-costs">${[["road", "Road"], ["settlement", "Settlement"], ["city", "City"], ["development", "Card"]]
          .map(([k, l]) => `<div class="wl-cost">${icon(k === "development" ? "devcard" : k)}<b>${l}</b><span class="wl-res-row">${res(costs[k])}</span></div>`).join("")}</div>`,
      },
      {
        ic: "robber", title: "The 7 and the robber",
        body: "A 7 pays nobody. Anyone holding more than 7 cards hands back half. Then the robber moves: that tile stops paying, and the mover steals one card from a neighbour.",
        extra: `<div class="wl-note">${icon("knight")}<span>A Knight card moves the robber too.</span></div>`,
      },
      {
        ic: "vp", title: "How to win",
        body: "Points come from what you build and a few awards. The first to 10 points wins on their turn.",
        extra: `<div class="wl-points">${[["settlement", "Settlement", 1], ["city", "City", 2], ["longestRoad", "Longest road (5+)", 2], ["largestArmy", "Largest army (3 knights)", 2], ["victoryPoint", "Victory point card", 1]]
          .map(([k, l, n]) => `<div>${icon(k)}<span>${l}</span><b>+${n}</b></div>`).join("")}</div>`,
      },
    ];
    const c = cards[step];
    const last = step === cards.length - 1;
    this.mount(`
      <div class="wl-step">${cards.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}<span>${step + 1} of ${cards.length}</span></div>
      <div class="wl-hero">${icon(c.ic)}</div>
      <h2 class="wl-title">${c.title}</h2>
      <p class="wl-lead">${c.body}</p>
      ${c.extra}
      <div class="wl-nav">
        <button type="button" class="wl-btn ghost" data-intro="skip">${last ? "Back" : "Skip"}</button>
        <button type="button" class="wl-btn primary" data-intro="next">${last ? "Got it" : "Next"}</button>
      </div>`, "How to play");
    this.el.querySelector("[data-intro='next']").addEventListener("click", () => (last ? this.endIntro() : this.showIntro(step + 1, fromWelcome)));
    this.el.querySelector("[data-intro='skip']").addEventListener("click", () => (last ? this.showIntro(step - 1, fromWelcome) : this.endIntro()));
  }

  endIntro() {
    store.set(INTRO_KEY, "done");
    if (this.fromWelcome && this.game.onboardingHold) this.showWelcome();
    else this.close();
  }
}
