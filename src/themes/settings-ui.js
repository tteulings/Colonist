// Settings dialog (desktop modal / mobile bottom sheet): Game · Look & feel · Bots · About.
// "Game" hosts the game controls from index.html (#settingsDrawer body, moved here so their
// listeners stay intact): New game first, then sound and pace. The bot-autoplay controls live in
// About › Developer. Look & feel: theme cards, Motion, quick toggle. Applies instantly.
import { THEMES, THEME_ORDER, motionPref, setMotionPref, palettePref, setPalette, paletteAuto, paletteAutoMode, autoTimeInfo, setPaletteAuto, effectivePalette, dayPalette, prefetchFonts, icon } from "./manager.js";

/** Shown in Settings › About and on the settings button; bumped with every release. */
export const APP_VERSION = "1.38";

/** v1.34 Settings: the running version and "Check for updates" (index.html: reg.update() + a version compare). */
function versionRow() {
  const row = document.createElement("div");
  row.className = "st-row st-version";
  row.innerHTML = `<div><b>Version v${APP_VERSION}</b><small data-upd-msg>Updates install by themselves; a reload starts them.</small></div><button type="button" class="btn" data-upd-check>Check for updates</button>`;
  const msg = row.querySelector("[data-upd-msg]"), btn = row.querySelector("[data-upd-check]");
  const ready = (v) => {
    msg.textContent = v ? `v${v} is ready. Your game is saved.` : "A new version is ready. Your game is saved.";
    btn.textContent = v ? `Update to v${v}` : "Update now"; btn.classList.add("primary"); btn.disabled = false;
    btn.onclick = () => { btn.disabled = true; btn.textContent = "Starting…"; if (window.__colonistReload) window.__colonistReload(btn); else window.location.reload(); };
  };
  const known = window.__colonistUpdate;
  if (known && known.version !== APP_VERSION) { ready(known.version); return row; }
  btn.onclick = async () => {
    if (!window.__colonistCheckUpdate) { msg.textContent = "Updates are checked in the installed app."; return; }
    btn.disabled = true; btn.textContent = "Checking…"; msg.textContent = "Looking for a new version…";
    let r = null;
    try { r = await window.__colonistCheckUpdate(); } catch (_) { /* offline */ }
    if (r?.ready) { ready(r.latest); return; }
    btn.disabled = false; btn.textContent = "Check for updates";
    msg.textContent = r?.latest ? `Up to date (v${r.current || APP_VERSION})` : "Couldn't check. Are you offline?";
  };
  return row;
}

/** One line of real viewport numbers for bug reports (Settings › About). */
function viewportDebug() {
  const vv = window.visualViewport, d = document.documentElement;
  const mode = ["fullscreen", "standalone", "minimal-ui"].find((m) => matchMedia(`(display-mode: ${m})`).matches) || "browser";
  let sab = 0, sat = 0;
  try {
    const p = document.createElement("div");
    p.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
    document.body.appendChild(p); const cs = getComputedStyle(p); sat = parseFloat(cs.paddingTop) || 0; sab = parseFloat(cs.paddingBottom) || 0; p.remove();
  } catch (e) { /* ignore */ }
  const app = document.getElementById("app");
  const r = (n) => Math.round(n * 10) / 10;
  return `Viewport: inner ${innerHeight} · visual ${vv ? r(vv.height) : "–"} · client ${d.clientHeight} · app ${app ? r(app.getBoundingClientRect().height) : "–"} (--app-h ${d.style.getPropertyValue("--app-h") || "–"}) · screen ${screen.height} (avail ${screen.availHeight}) · ${mode} · safe-area top ${r(sat)} bottom ${r(sab)}`;
}

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
    this.devPane = document.createElement("div");
    this.devPane.className = "st-game";
    if (body) {
      const strat = body.querySelector(".ai-strategy-section");
      if (strat) { strat.open = true; this.botPane.appendChild(strat); }
      const dev = body.querySelector(".dev-tools");
      if (dev) this.devPane.appendChild(dev);
      while (body.firstChild) this.gamePane.appendChild(body.firstChild);
    }
    // v1.34: the Game pane is already out of the document here, so its "Katan … v1.03" line is set through it
    [document, this.gamePane].forEach((root) => root.querySelectorAll(".app-version, .version-label").forEach((el) => { el.textContent = `v${APP_VERSION}`; }));
    // v0.85: Follow system can flip the palette while Look & feel is open (the OS goes dark): keep the control in step
    document.addEventListener("colonist:palette", () => { if (this.el && this.tab === "look") this.renderBody(); });
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
        ${[["game", "Game"], ["look", "Look & feel"], ["bots", "Bots"], ["about", "About"]].map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}
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
    this.devPane.remove();
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
    this.devPane.remove();
    if (this.tab === "game") {
      body.innerHTML = this.head("Game", "");
      body.appendChild(this.gamePane);
      g._renderConfirmSetting?.();
      // v1.04 the Game review starts by itself after a game (a device preference)
      let auto = true; try { auto = localStorage.getItem("colonist_review_auto") !== "off"; } catch (_) {}
      const row = document.createElement("div");
      row.className = "st-row";
      row.innerHTML = `<div><b id="rvAutoLbl">Review automatically after a game</b><small>Checks your moves in the background.</small></div><button type="button" class="st-switch${auto ? " on" : ""}" role="switch" aria-checked="${auto}" aria-labelledby="rvAutoLbl" data-rv-auto><i></i></button>`;
      row.querySelector("button").addEventListener("click", (e) => { const b = e.currentTarget, on = b.getAttribute("aria-checked") !== "true"; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); try { localStorage.setItem("colonist_review_auto", on ? "on" : "off"); } catch (_) {} });
      body.appendChild(row);
      body.appendChild(versionRow());
    } else if (this.tab === "bots") {
      body.innerHTML = this.head("Bot personalities", "");
      const lb = document.createElement("button"); // v1.23 the leaderboard lives on its own page
      lb.type = "button"; lb.className = "st-botsrow";
      lb.innerHTML = `<span><b>Leaderboard and profiles</b><small>Who is strongest, and how you do against each bot</small></span><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      lb.addEventListener("click", () => g.botsOpen());
      body.appendChild(lb);
      body.appendChild(this.botPane);
    } else if (this.tab === "about") {
      body.innerHTML = this.head("About", "") + `<p class="sub">Katan: Handelaren en Bouwers ${"v" + APP_VERSION} — a settle-and-trade island game against friendly bots.</p>
        <button type="button" class="st-howto">${icon("hint")}How to play</button>
        <p class="sub">Keyboard: R roll dice · E end turn · 1–3 build · B buy card · T trade · V fit board · Esc cancel.</p>
        <p class="sub st-screen">Screen: ${innerWidth}×${innerHeight} @${+(window.devicePixelRatio || 1).toFixed(2)}x${matchMedia("(display-mode: standalone)").matches ? " · installed app" : ""}</p>
        <p class="sub st-viewport">${viewportDebug()}</p>`;
      body.querySelector(".st-howto").addEventListener("click", () => { this.close(); g.onboarding?.showIntro(0, false); });
      body.querySelector(".st-howto").after(versionRow());
      body.appendChild(this.devPane);
    } else {
      const cur = g.theme.id;
      const card = (T) => `<button type="button" class="tc ${T.id === cur ? "on" : ""}" data-theme-id="${T.id}" aria-pressed="${T.id === cur}">
          <div class="pv">${T.thumb ? T.thumb() : miniBoard(T.paletteDots, T.id === "A" ? "#3CA9B0" : "#2a6a88")}</div><span class="radio"></span>
          <div class="meta"><div class="nm"><b>${T.name}</b><span class="aa" style="font-family:${T.sampleFont || (T.id === "A" ? "Outfit,system-ui,sans-serif" : "Inter,sans-serif")}">Aa</span></div>
          <p>${T.mood}</p><div class="dots">${T.paletteDots.map((c) => `<i style="background:${c}"></i>`).join("")}</div></div></button>`;
      const m = motionPref();
      body.innerHTML = this.head("Look &amp; feel", "Pick a world for your island. Board, cards, pieces and motion follow the theme. Applies instantly.") +
        `<div class="tcards">${THEME_ORDER.map((id) => card(THEMES[id])).join("")}</div>
        ${(() => {
          // Palettes only exist for Sunny Island: in other themes they stay visible but disabled, with the reason.
          // v1.04 proposal (dusk-104): Light · Vivid · Dusk · Night · Auto. Auto follows the time of day (default) or
          // the device's dark mode; the line under it says what is on screen now and when it changes next.
          const on = g.theme?.id === "A", mode = paletteAutoMode(), cur = mode ? "auto" : palettePref();
          const shown = effectivePalette(), NAME = { light: "Light", vivid: "Vivid", dusk: "Dusk", night: "Night" };
          const hm = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          let autoLine = "", autoMore = "";
          if (mode === "time") {
            const t = autoTimeInfo(), place = t.place.how === "zone" ? t.place.tz.split("/").pop().replace(/_/g, " ") : "your time zone";
            const ne = t.edges?.find((e) => e[0] === t.next), nxt = ne ? ` · ${NAME[ne[1] === "day" ? dayPalette() : ne[1]]} from ${hm(ne[0])}` : "";
            autoLine = `Now ${NAME[shown]}${nxt}`;
            autoMore = `Sunrise ${t.sun.rise ? hm(t.sun.rise) : "–"}, sunset ${t.sun.set ? hm(t.sun.set) : "–"}, estimated for ${place} from your time zone; no location is used. The switch waits for the end of a turn and fades slowly.`;
          } else if (mode === "system") { autoLine = `Now ${NAME[shown]}`; autoMore = `Night while your device is in dark mode, otherwise ${NAME[dayPalette()]}.`; }
          return `<div class="st-row st-row-pal${on ? "" : " st-row-off"}" style="margin-top:14px"><div><b>Colours</b><small>${on ? "Light is soft · Vivid is bold · Dusk is golden hour · Night is calm and dark." : "Only for Sunny Island."}</small></div>
          <div class="seg pal-seg pal-seg5" role="radiogroup" aria-label="Colours"${on ? "" : ` aria-disabled="true"`}>${[["light", "Light"], ["vivid", "Vivid"], ["dusk", "Dusk"], ["night", "Night"], ["auto", "Auto"]].map(([v, l]) => `<button type="button" data-palette="${v}" class="${cur === v ? "on" : ""}${mode && v === shown ? " shown" : ""}" aria-checked="${cur === v}" role="radio"${on ? "" : " disabled"}><i class="pal-dot pal-${v === "auto" ? "autodot" : v}"></i>${l}</button>`).join("")}</div></div>
          ${mode && on ? `<div class="st-row st-row-pal pal-auto"><div><b>Auto follows<button type="button" class="pal-info" data-pal-info aria-label="More about Auto" aria-expanded="false">i</button></b><small>${autoLine}</small><small class="pal-more" hidden>${autoMore}</small></div>
          <div class="seg" role="radiogroup" aria-label="Auto follows">${[["time", "Time of day"], ["system", "Device dark mode"]].map(([v, l]) => `<button type="button" data-pal-auto="${v}" class="${mode === v ? "on" : ""}" aria-checked="${mode === v}" role="radio">${l}</button>`).join("")}</div></div>` : ""}`;
        })()}
        <div class="st-row"><div><b>Motion</b><small>Reduced replaces travel and spin with short fades.</small></div>
          <div class="seg" role="radiogroup" aria-label="Motion">${[["full", "Full"], ["reduced", "Reduced"], ["system", "Follow system"]].map(([v, l]) => `<button type="button" data-motion="${v}" class="${m === v ? "on" : ""}" aria-checked="${m === v}" role="radio">${l}</button>`).join("")}</div></div>
        <div class="st-row"><div><b>Quick toggle</b><small>The same swatches sit in the top bar on wide screens.</small></div><div class="theme-toggle" data-qt></div></div>`;
      body.querySelectorAll("[data-theme-id]").forEach((b) => {
        b.addEventListener("pointerenter", () => prefetchFonts(THEMES[b.dataset.themeId]));
        b.addEventListener("click", () => { g.setTheme(b.dataset.themeId); this.renderBody(); });
      });
      body.querySelectorAll("button[data-palette]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.palette === "auto") setPaletteAuto(paletteAutoMode() || "time"); else setPalette(b.dataset.palette); g.requestBoardDraw(); this.renderBody(); }));
      body.querySelector("[data-pal-info]")?.addEventListener("click", (e) => { const m = body.querySelector(".pal-more"); m.hidden = !m.hidden; e.currentTarget.setAttribute("aria-expanded", String(!m.hidden)); });
      body.querySelectorAll("[data-pal-auto]").forEach((b) => b.addEventListener("click", () => { setPaletteAuto(b.dataset.palAuto); g.requestBoardDraw(); this.renderBody(); }));
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
