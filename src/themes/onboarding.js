// The optional, skippable three-card "How to play" intro (from the home screen, Menu and Settings ›
// About). Seen-state is remembered in localStorage; the home screen highlights it until then.
import { icon } from "./manager.js";

const INTRO_KEY = "colonist.intro";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};

export function introSeen() { return store.get(INTRO_KEY) === "done"; }

export class Onboarding {
  /** opts: { costs: {road, settlement, city, development}, labels: {wood: "Lumber", …} } */
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

  /** The three intro cards. fromHome: opened from the home screen (which stays underneath). */
  showIntro(step = 0, fromHome = false) {
    this.mode = "intro";
    this.fromHome = fromHome;
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
    this.el.querySelector("[data-intro='next']").addEventListener("click", () => (last ? this.endIntro() : this.showIntro(step + 1, fromHome)));
    this.el.querySelector("[data-intro='skip']").addEventListener("click", () => (last ? this.showIntro(step - 1, fromHome) : this.endIntro()));
  }

  endIntro() {
    store.set(INTRO_KEY, "done");
    this.close();
    if (this.fromHome && this.game.home?.open) this.game.home.render(); // drop the "New here?" hint
  }
}
