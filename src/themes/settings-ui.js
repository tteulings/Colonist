// Settings dialog (desktop modal / mobile bottom sheet): Game · Look & feel · Bot personalities · About.
// "Game" hosts the existing game controls from index.html (#settingsDrawer body, moved here so
// their listeners stay intact). Look & feel: theme cards, Motion, quick toggle. Applies instantly.
import { THEMES, THEME_ORDER, UPCOMING, motionPref, setMotionPref, palettePref, setPalette, prefetchFonts, icon } from "./manager.js";

/** A tiny live preview of a theme: seven hexes in the theme's palette on its sea. */
function miniBoard(dots, sea) {
  const hex = (cx, cy, c) => {
    let d = "";
    for (let i = 0; i < 6; i += 1) { const a = ((60 * i - 30) * Math.PI) / 180; d += (i ? "L" : "M") + (cx + 15 * Math.cos(a)).toFixed(1) + "," + (cy + 15 * Math.sin(a)).toFixed(1); }
    return `<path d="${d}Z" fill="${c}" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>`;
  };
  const pos = [[0, 0], [26, 0], [-26, 0], [13, 22.5], [-13, 22.5], [13, -22.5], [-13, -22.5]];
  return `<svg viewBox="-80 -45 160 90" preserveAspectRatio="xMidYMid slice"><rect x="-80" y="-45" width="160" height="90" fill="${sea}"/>${pos.map(([x, y], i) => hex(x, y, dots[(i + 1) % dots.length])).join("")}<circle cx="0" cy="0" r="6" fill="#FBF6EA"/></svg>`;
}

export class SettingsUI {
  constructor(game) {
    this.game = game;
    this.el = null;
    this.tab = "look";
    // Move the game controls (and bot personalities) out of the legacy drawer, once.
    const body = document.querySelector("#settingsDrawer .settings-float-body");
    this.gamePane = document.createElement("div");
    this.gamePane.className = "st-game";
    this.botPane = document.createElement("div");
    this.botPane.className = "st-game";
    if (body) {
      const strat = body.querySelector(".ai-strategy-section");
      if (strat) { strat.open = true; this.botPane.appendChild(strat); }
      while (body.firstChild) this.gamePane.appendChild(body.firstChild);
    }
  }

  open(tab = this.tab) {
    this.tab = tab;
    this.close();
    const el = document.createElement("div");
    el.className = "tm-settings tm-modal";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Settings");
    el.innerHTML = `<div class="st-card"><nav class="st-nav"><h1>Settings</h1>
        ${[["game", "Game"], ["look", "Look & feel"], ["bots", "Bot personalities"], ["about", "About"]].map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}
      </nav><div class="st-body"></div></div>`;
    el.addEventListener("click", (e) => { if (e.target === el) this.close(); });
    el.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { this.tab = b.dataset.tab; this.renderBody(); el.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b)); }));
    this.onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this.onKey);
    document.body.appendChild(el);
    this.el = el;
    this.renderBody();
  }

  close() {
    if (!this.el) return;
    // park the moved game controls so they survive
    this.gamePane.remove();
    this.botPane.remove();
    this.el.remove();
    this.el = null;
    document.removeEventListener("keydown", this.onKey);
  }

  head(title, sub) {
    return `<div class="st-head"><h2>${title}</h2><button type="button" class="btn ghost icon-only st-close" aria-label="Close">${icon("close")}</button></div>${sub ? `<p class="sub">${sub}</p>` : ""}`;
  }

  renderBody() {
    const body = this.el.querySelector(".st-body");
    const g = this.game;
    this.gamePane.remove();
    this.botPane.remove();
    if (this.tab === "game") {
      body.innerHTML = this.head("Game", "Start a new game, let the bots play, sounds and speed.");
      body.appendChild(this.gamePane);
    } else if (this.tab === "bots") {
      body.innerHTML = this.head("Bot personalities", "How each bot plays. New games use the choices from the New game screen.");
      body.appendChild(this.botPane);
    } else if (this.tab === "about") {
      body.innerHTML = this.head("About", "") + `<p class="sub">Colonist — a settle-and-trade island game against friendly bots. Themes: Sunny Island and Classic; Wooden Board Game and Storybook are on the way.</p><p class="sub">Keyboard: R roll dice · E end turn · 1–3 build · B buy card · T trade · V fit board · Esc cancel.</p>`;
    } else {
      const cur = g.theme.id;
      const card = (T) => `<button type="button" class="tc ${T.id === cur ? "on" : ""}" data-theme-id="${T.id}" aria-pressed="${T.id === cur}">
          <div class="pv">${miniBoard(T.paletteDots, T.id === "A" ? "#3CA9B0" : "#2a6a88")}</div><span class="radio"></span>
          <div class="meta"><div class="nm"><b>${T.name}</b><span class="aa" style="font-family:${T.id === "A" ? "'DM Serif Display',Georgia,serif" : "Inter,sans-serif"}">Aa</span></div>
          <p>${T.mood}</p><div class="dots">${T.paletteDots.map((c) => `<i style="background:${c}"></i>`).join("")}</div></div></button>`;
      const soon = (U) => `<div class="tc soon" aria-disabled="true"><div class="pv"><div class="ph">preview coming soon</div></div><span class="soon-tag">Coming soon</span>
          <div class="meta"><div class="nm"><b>${U.name}</b></div><p>${U.mood}</p><div class="dots">${U.dots.map((c) => `<i style="background:${c}"></i>`).join("")}</div></div></div>`;
      const m = motionPref();
      body.innerHTML = this.head("Look &amp; feel", "Pick a world for your island. Board, cards, pieces and motion follow the theme. Applies instantly.") +
        `<div class="tcards">${THEME_ORDER.map((id) => card(THEMES[id])).join("")}${UPCOMING.map(soon).join("")}</div>
        ${g.theme?.id === "A" ? `<div class="st-row" style="margin-top:14px"><div><b>Colours</b><small>Light is soft and airy · Vivid is bold and saturated.</small></div>
          <div class="seg pal-seg" role="radiogroup" aria-label="Colours">${[["light", "Light"], ["vivid", "Vivid"]].map(([v, l]) => `<button type="button" data-palette="${v}" class="${palettePref() === v ? "on" : ""}" aria-checked="${palettePref() === v}" role="radio"><i class="pal-dot pal-${v}"></i>${l}</button>`).join("")}</div></div>` : ""}
        <div class="st-row"><div><b>Motion</b><small>Reduced replaces travel and spin with short fades.</small></div>
          <div class="seg" role="radiogroup" aria-label="Motion">${[["full", "Full"], ["reduced", "Reduced"], ["system", "Follow system"]].map(([v, l]) => `<button type="button" data-motion="${v}" class="${m === v ? "on" : ""}" aria-checked="${m === v}" role="radio">${l}</button>`).join("")}</div></div>
        <div class="st-row"><div><b>Quick toggle</b><small>The same swatches sit in the top bar on wide screens.</small></div><div class="theme-toggle" data-qt></div></div>`;
      body.querySelectorAll("[data-theme-id]").forEach((b) => {
        b.addEventListener("pointerenter", () => prefetchFonts(THEMES[b.dataset.themeId]));
        b.addEventListener("click", () => { g.setTheme(b.dataset.themeId); this.renderBody(); });
      });
      body.querySelectorAll("button[data-palette]").forEach((b) => b.addEventListener("click", () => { setPalette(b.dataset.palette); g.requestBoardDraw(); this.renderBody(); }));
      body.querySelectorAll("[data-motion]").forEach((b) => b.addEventListener("click", () => { setMotionPref(b.dataset.motion); g.requestBoardDraw(); this.renderBody(); }));
      renderQuickToggle(body.querySelector("[data-qt]"), g, () => this.renderBody());
    }
    body.querySelector(".st-close")?.addEventListener("click", () => this.close());
  }
}

/** Round theme swatches (top bar on desktop, Look & feel). */
export function renderQuickToggle(container, game, after) {
  if (!container) return;
  container.innerHTML = THEME_ORDER.map((id) => `<button type="button" role="radio" data-q="${id}" aria-checked="${game.theme.id === id}" class="${game.theme.id === id ? "on" : ""}" title="${THEMES[id].name}" aria-label="${THEMES[id].name}">${THEMES[id].swatch()}</button>`).join("");
  container.querySelectorAll("[data-q]").forEach((b) => {
    b.addEventListener("pointerenter", () => prefetchFonts(THEMES[b.dataset.q]));
    b.addEventListener("click", () => { game.setTheme(b.dataset.q); after?.(); });
  });
}
