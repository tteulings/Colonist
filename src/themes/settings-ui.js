// Settings dialog (desktop modal / mobile bottom sheet): Game · Look & feel · Bots · About.
// "Game" hosts the game controls from index.html (#settingsDrawer body, moved here so their
// listeners stay intact): New game first, then sound and pace. The bot-autoplay controls live in
// About › Developer. Look & feel: theme cards, Motion, quick toggle. Applies instantly.
import { refreshAvatars } from "../avatar-anim.js";
import { THEMES, THEME_ORDER, motionPref, setMotionPref, avatarAnimOn, setAvatarAnim, palettePref, setPalette, paletteAutoMode, autoTimeInfo, setPaletteAuto, effectivePalette, dayPalette, prefetchFonts, avatarSvg } from "./manager.js";
import { dateLocale } from "../i18n.js";

import { Names, openNamesSheet } from "../names.js";
import { explainOn, setExplain } from "../shell.js";
import { toast } from "../toast.js";

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
import { liveWinOn, setLiveWin, liveRefineOn, setLiveRefine } from "../live-bar.js";
import { recapPoints, setRecapPoints } from "../review-recap.js";
import { langChoice, setLang } from "../i18n.js";

/** v1.67 Text size (Compact / Normal / Large): a device preference, applied to <html data-textsize> (themes/base.css scales it). */
export function getTextSize() { try { const v = localStorage.getItem("colonist_textsize"); return v === "normal" || v === "large" ? v : "compact"; } catch (_) { return "compact"; } }
export function setTextSize(v) { try { localStorage.setItem("colonist_textsize", v); } catch (_) {} document.documentElement.dataset.textsize = v; window.__colonistAppH?.(); window.dispatchEvent(new Event("resize")); }
try { document.documentElement.dataset.textsize = getTextSize(); window.__colonistAppH?.(); } catch (_) {}
/** Shown in Settings › About and on the settings button; bumped with every release. */
export const APP_VERSION = "1.99";

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

const TS_LABEL = { compact: "Small", normal: "Normal", large: "Large" };
const CHEV = `<svg class="sh-chev" viewBox="0 0 20 20" aria-hidden="true" width="18" height="18"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BACK = `<svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const seg = (attr, label, items, on) => `<div class="sh-seg" role="radiogroup" aria-label="${label}">${items.map(([v, l, x]) => `<button type="button" role="radio" ${attr}="${v}" aria-checked="${String(v) === String(on)}" class="${String(v) === String(on) ? "on" : ""}"${x || ""}>${l}</button>`).join("")}</div>`;
const swBtn = (attr, on, labelledby) => `<button type="button" class="sh-switch${on ? " on" : ""}" role="switch" aria-checked="${on}" aria-labelledby="${labelledby}" ${attr}><i></i></button>`;

/** v1.99 Settings: one page (level 2, back arrow) in five groups: Appearance, Game, Learn, Data, About. The old tabs are gone; Theme is a layer of its own.
 *  open(target, { from }): target "look" | "game" | "bots" | "about" scrolls to that group; from "pause" makes Back return to the Pause sheet. */
export class SettingsUI {
  constructor(game) {
    this.game = game;
    this.el = null;
    this.tab = "look";
    this.view = "main";
    this.from = "tab";
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
    // v0.85: Follow system can flip the palette while Settings is open (the OS goes dark): keep the controls in step
    document.addEventListener("colonist:palette", () => { if (this.el) this.renderBody(true); });
  }

  open(tab = "look", { from } = {}) {
    this.tab = tab;
    this.from = from || "tab";
    this.view = "main";
    this.close();
    const el = document.createElement("div");
    el.className = "tm-settings tm-modal sh-settings";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Settings");
    el.innerHTML = `<div class="st-card sh-page"><header class="sh-appbar"><button type="button" class="st-close sh-back" aria-label="Back">${BACK}</button><h1 tabindex="-1">Settings</h1></header><div class="st-body"></div></div>`;
    el.querySelector(".st-close").addEventListener("click", () => this.backStep());
    this.onKey = (e) => { if (e.key === "Escape") this.backStep(); };
    document.addEventListener("keydown", this.onKey);
    document.body.appendChild(el);
    this.el = el;
    this.renderBody();
    const target = { bots: ".sh-bots-d", about: "#shAboutH", game: "#shGameH" }[tab];
    if (target) { const t = el.querySelector(target); if (t) { if (t.tagName === "DETAILS") t.open = true; t.scrollIntoView({ block: "start" }); } }
    else el.querySelector("h1")?.focus({ preventScroll: true });
  }

  /** Back arrow, Escape and the back gesture: a layer (Theme) goes back to the page, the page goes back to where Settings was opened from. */
  backStep() {
    if (this.view !== "main") { this.view = "main"; this.renderBody(); this.el?.querySelector("h1")?.focus({ preventScroll: true }); return; }
    this.back();
  }
  back() {
    const from = this.from;
    this.close();
    if (from === "pause" && !this.game.home?.open) this.game.menu?.show();
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

  /** The title of the page / layer and the back button's label */
  bar(title) {
    const h = this.el.querySelector(".sh-appbar h1"); if (h) h.textContent = title;
    this.el.querySelector(".st-close").setAttribute("aria-label", this.view === "main" ? "Back" : "Back to Settings");
  }

  group(id, title, inner) { return `<section class="sh-group" aria-labelledby="${id}"><h2 class="sh-group-h" id="${id}">${title}</h2><div class="sh-group-card">${inner}</div></section>`; }

  renderBody(keep = false) {
    if (!this.el) return;
    const body = this.el.querySelector(".st-body");
    const sc = keep ? body.scrollTop : 0;
    this.gamePane.remove(); this.botPane.remove(); this.devPane.remove();
    if (this.view === "theme") this.renderTheme(body); else this.renderMain(body);
    body.scrollTop = sc;
    this.bar(this.view === "theme" ? "Theme" : "Settings");
  }

  renderMain(body) {
    const g = this.game;
    const mode = paletteAutoMode(), pal = palettePref();
    const colour = mode ? "auto" : pal === "light" ? "light" : pal === "night" ? "night" : "";
    const lc = langChoice() || "en";
    const T = THEMES[g.theme.id];
    const tsz = getTextSize();
    let auto = true; try { auto = localStorage.getItem("colonist_review_auto") !== "off"; } catch (_) {}
    let mdl = "standard"; try { mdl = localStorage.getItem("colonist_review_model") || "standard"; } catch (_) {}
    const me = Names.me();
    const row = (t, sub, right = "", id = "") => `<div class="sh-set-row${right.includes('class="sh-seg') ? " sh-set-col" : ""}"><div class="sh-set-t"${id ? ` id="${id}"` : ""}><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</div>${right}</div>`;
    const link = (k, t, sub, ic = "") => `<button type="button" class="sh-set-row sh-set-link" data-go="${k}"><span class="sh-set-t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</span>${ic}${CHEV}</button>`;
    body.innerHTML = `
      <section class="sh-profile" aria-label="Profile"><span class="sh-profile-av" aria-hidden="true">${avatarSvg(0, "sh-av")}</span><div class="sh-set-t"><b>${me ? esc(me) : "You"}</b><small>Your name in games and reviews</small></div><button type="button" class="btn sm" data-go="names">Change</button></section>
      ${this.group("shLookH", "Appearance",
        row("Colours", mode === "time" ? "Auto follows the time of day." : "Auto follows the dark mode of your phone. The default until you pick one.", seg("data-pal", "Colours", [["auto", "Auto"], ["light", "Light"], ["night", "Dark"]], colour), "shColT") +
        link("theme", "Theme", esc(T.name), `<span class="sh-dots" aria-hidden="true">${T.paletteDots.slice(0, 4).map((c) => `<i style="background:${c}"></i>`).join("")}</span>`) +
        row("Text size", "Scales the whole app.", seg("data-ts", "Text size", [["compact", "Small"], ["normal", "Normal"], ["large", "Large"]], tsz), "shTsT"))}
      ${this.group("shGameH", "Game",
        row("Language", "Menus, the game, reviews and the AI recap.", seg("data-lang", "Language", [["en", "English", " data-i18n-skip"], ["nl", "Nederlands", " data-i18n-skip"]], lc), "shLgT") +
        `<div class="sh-set-embed" data-mount="game"></div>` +
        row("Live win chance", "A thin bar under the players. Quick model, a rough guide.", swBtn("data-live", liveWinOn(), "shLwT"), "shLwT") +
        row("Keep refining (simulates more games)", "Like a chess engine: the bar deepens by playing out more games while you think. Off saves battery.", swBtn("data-refine", liveRefineOn(), "shLrT"), "shLrT") +
        row("Review automatically after a game", "Checks your moves in the background.", swBtn("data-rvauto", auto, "shRaT"), "shRaT") +
        row("Review model", "Quick is rough; Deep takes almost 3x as long.", seg("data-rvmodel", "Review model", [["quick", "Quick"], ["standard", "Standard"], ["deep", "Deep"]], mdl), "shRmT") +
        row("Recap turning points", "How many moments the AI recap tells about.", seg("data-pts", "Recap turning points", [2, 3, 4].map((k) => [k, String(k)]), recapPoints()), "shRpT") +
        `<details class="sh-bots-d"><summary><b>Bot personalities</b><small>Fine-tune each bot, and see how you do against them</small></summary><button type="button" class="sh-set-row sh-set-link" data-go="bots"><span class="sh-set-t"><b>Leaderboard and profiles</b><small>Who is strongest, and how you do against each bot</small></span>${CHEV}</button><div class="sh-set-embed" data-mount="bots"></div></details>`)}
      ${this.group("shLearnH", "Learn",
        row("Explain the set-up", "For new games", swBtn("data-explain", explainOn(g), "shExT"), "shExT") +
        link("intro", "How does Katan work?", "Cards, robber, winning"))}
      ${this.group("shDataH", "Data",
        link("export", "Save my data", "Games, results and settings as a file"))}
      ${this.group("shAboutH", "About", `<div class="sh-set-embed" data-mount="version"></div>` +
        `<a class="sh-set-row sh-set-link" href="./lab.html"><span class="sh-set-t"><b>AI Lab</b><small>For curious players</small></span>${CHEV}</a>` +
        `<details class="sh-dev"><summary><b>Developer</b><small>Let a bot play for you, screen details</small></summary><div class="sh-set-embed" data-mount="dev"></div></details>` +
        `<p class="sh-set-note">Katan, a settle-and-trade island game against friendly bots. Keyboard: R roll dice · E end turn · 1–3 build · B buy card · T trade · V fit board · Esc cancel.</p>`)}`;
    const mount = (k, el) => body.querySelector(`[data-mount="${k}"]`)?.appendChild(el);
    mount("game", this.gamePane);
    g._renderConfirmSetting?.();
    mount("bots", this.botPane);
    mount("version", versionRow());
    this.devPane.querySelector(".st-vpinfo")?.remove();
    const vp = document.createElement("details");
    vp.className = "st-vpinfo"; vp.setAttribute("data-i18n-skip", "");
    vp.innerHTML = `<summary>Screen details</summary><p class="sub st-screen">Screen: ${innerWidth}×${innerHeight} @${+(window.devicePixelRatio || 1).toFixed(2)}x${matchMedia("(display-mode: standalone)").matches ? " · installed app" : ""}</p><p class="sub st-viewport">${viewportDebug()}</p>`;
    this.devPane.appendChild(vp);
    mount("dev", this.devPane);

    const on = (sel, fn) => body.querySelectorAll(sel).forEach((b) => b.addEventListener("click", fn));
    const pick = (sel, attr, fn) => on(sel, (e) => { const b = e.currentTarget; b.parentElement.querySelectorAll("button").forEach((x) => { const o = x === b; x.classList.toggle("on", o); x.setAttribute("aria-checked", String(o)); }); fn(b.getAttribute(attr)); });
    const sw = (sel, fn) => on(sel, (e) => { const b = e.currentTarget, v = b.getAttribute("aria-checked") !== "true"; b.classList.toggle("on", v); b.setAttribute("aria-checked", String(v)); fn(v); });
    on("[data-pal]", (e) => { const v = e.currentTarget.dataset.pal; if (v === "auto") setPaletteAuto(paletteAutoMode() === "time" ? "time" : "system"); else setPalette(v === "night" ? "night" : "light"); g.requestBoardDraw?.(); this.renderBody(true); });
    pick("[data-ts]", "data-ts", (v) => { setTextSize(v); });
    pick("[data-lang]", "data-lang", (v) => { setLang(v); });
    sw("[data-live]", setLiveWin);
    sw("[data-refine]", setLiveRefine);
    sw("[data-rvauto]", (v) => { try { localStorage.setItem("colonist_review_auto", v ? "on" : "off"); } catch (_) {} });
    pick("[data-rvmodel]", "data-rvmodel", (v) => { try { localStorage.setItem("colonist_review_model", v); } catch (_) {} });
    pick("[data-pts]", "data-pts", (v) => setRecapPoints(v));
    sw("[data-explain]", setExplain);
    on("[data-go]", (e) => {
      const k = e.currentTarget.dataset.go;
      if (k === "theme") { this.view = "theme"; this.renderBody(); this.el.querySelector("h1")?.focus({ preventScroll: true }); }
      else if (k === "intro") { this.close(); g.onboarding?.showIntro(0, false); }
      else if (k === "bots") g.botsOpen?.();
      else if (k === "names") openNamesSheet({ onRename: (a, b) => g.histRenameName?.(a, b), onChange: () => { if (this.el && this.view === "main") this.renderBody(true); } });
      else if (k === "export") this.exportData(e.currentTarget);
    });
  }

  /** Save my data: the settings and every finished game of this device as one JSON file. */
  async exportData(btn) {
    const g = this.game; btn.disabled = true;
    try {
      const out = { app: "katan", version: APP_VERSION, exported: new Date().toISOString(), settings: {}, games: [] };
      try { for (let i = 0; i < localStorage.length; i += 1) { const k = localStorage.key(i); if (/^colonist/.test(k) && !/^colonist\.(auto|live|hist)/.test(k)) out.settings[k] = localStorage.getItem(k); } } catch (_) { /* storage blocked */ }
      try { await g.hist.open(); for (const m of g.hist.metas.slice(0, 500)) { const r = await g.hist.get(m.id); if (r) out.games.push({ id: m.id, meta: m, ...r }); } } catch (_) { /* no history */ }
      const blob = new Blob([JSON.stringify(out)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `katan-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast({ text: "File saved", icon: "check" });
    } catch (_) { toast({ text: "Couldn't save the file" }); }
    btn.disabled = false;
  }

  /** Layer: the four themes, the extra colour modes, motion and avatar animations */
  renderTheme(body) {
    const g = this.game;
    const cur = g.theme.id;
    const card = (T) => `<button type="button" class="tc ${T.id === cur ? "on" : ""}" data-theme-id="${T.id}" aria-pressed="${T.id === cur}">
          <div class="pv">${T.thumb ? T.thumb() : miniBoard(T.paletteDots, T.id === "A" ? "#3CA9B0" : "#2a6a88")}</div><span class="radio"></span>
          <div class="meta"><div class="nm"><b>${T.name}</b><span class="aa" style="font-family:${T.sampleFont || (T.id === "A" ? "Outfit,system-ui,sans-serif" : "Inter,sans-serif")}">Aa</span></div>
          <p>${T.mood}</p><div class="dots">${T.paletteDots.map((c) => `<i style="background:${c}"></i>`).join("")}</div></div></button>`;
    const m = motionPref();
    const on = g.theme?.id === "A", mode = paletteAutoMode(), pcur = mode ? "auto" : palettePref();
    const shown = effectivePalette(), NAME = { light: "Light", vivid: "Vivid", dusk: "Dusk", night: "Night" };
    const hm = (ms) => new Date(ms).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
    let autoLine = "";
    if (mode === "time") {
      const t = autoTimeInfo(), ne = t.edges?.find((e) => e[0] === t.next);
      autoLine = `Now ${NAME[shown]}${ne ? ` · ${NAME[ne[1] === "day" ? dayPalette() : ne[1]]} from ${hm(ne[0])}` : ""}`;
    } else if (mode === "system") autoLine = `Now ${NAME[shown]}`;
    body.innerHTML = `<p class="sh-set-note">Pick a world for your island. Board, cards, pieces and motion follow the theme. Applies instantly.</p>
      <div class="tcards">${THEME_ORDER.map((id) => card(THEMES[id])).join("")}</div>
      ${this.group("shMoreColH", "More colour modes", `<div class="sh-set-row sh-set-col${on ? "" : " st-row-off"}"><div class="sh-set-t"><b>Colours</b><small>${on ? "Light is soft · Vivid is bold · Dusk is golden hour · Night is calm and dark." : "Only for Sunny Island."}</small></div>
          <div class="sh-seg sh-seg5" role="radiogroup" aria-label="Colours"${on ? "" : ` aria-disabled="true"`}>${[["light", "Light"], ["vivid", "Vivid"], ["dusk", "Dusk"], ["night", "Night"], ["auto", "Auto"]].map(([v, l]) => `<button type="button" role="radio" data-palette="${v}" aria-checked="${pcur === v}" class="${pcur === v ? "on" : ""}"${on ? "" : " disabled"}>${l}</button>`).join("")}</div></div>
          ${mode && on ? `<div class="sh-set-row sh-set-col"><div class="sh-set-t"><b>Auto follows</b><small>${autoLine}</small></div>
          <div class="sh-seg" role="radiogroup" aria-label="Auto follows">${[["time", "Time of day"], ["system", "Phone dark mode"]].map(([v, l]) => `<button type="button" role="radio" data-pal-auto="${v}" class="${mode === v ? "on" : ""}" aria-checked="${mode === v}">${l}</button>`).join("")}</div></div>` : ""}`)}
      ${this.group("shMotionH", "Motion", `<div class="sh-set-row sh-set-col"><div class="sh-set-t"><b>Motion</b><small>Reduced replaces travel and spin with short fades.</small></div>
          <div class="sh-seg" role="radiogroup" aria-label="Motion">${[["full", "Full"], ["reduced", "Reduced"], ["system", "Follow system"]].map(([v, l]) => `<button type="button" role="radio" data-motion="${v}" class="${m === v ? "on" : ""}" aria-checked="${m === v}">${l}</button>`).join("")}</div></div>
        <div class="sh-set-row sh-set-col"><div class="sh-set-t"><b>Avatar animations</b><small>Blinking, reactions and the turn pulse on the portraits.</small></div>
          <div class="sh-seg" role="radiogroup" aria-label="Avatar animations">${[[true, "On"], [false, "Off"]].map(([v, l]) => `<button type="button" role="radio" data-avanim="${v}" class="${avatarAnimOn() === v ? "on" : ""}" aria-checked="${avatarAnimOn() === v}">${l}</button>`).join("")}</div></div>
        <div class="sh-set-row"><div class="sh-set-t"><b>Quick toggle</b><small>The same swatches sit in the top bar on wide screens.</small></div><div class="theme-toggle" data-qt></div></div>`)}`;
    body.querySelectorAll("[data-theme-id]").forEach((b) => {
      b.addEventListener("pointerenter", () => prefetchFonts(THEMES[b.dataset.themeId]));
      b.addEventListener("click", () => { g.setTheme(b.dataset.themeId); this.renderBody(true); });
    });
    body.querySelectorAll("button[data-palette]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.palette === "auto") setPaletteAuto(paletteAutoMode() || "time"); else setPalette(b.dataset.palette); g.requestBoardDraw(); this.renderBody(true); }));
    body.querySelectorAll("[data-pal-auto]").forEach((b) => b.addEventListener("click", () => { setPaletteAuto(b.dataset.palAuto); g.requestBoardDraw(); this.renderBody(true); }));
    body.querySelectorAll("[data-motion]").forEach((b) => b.addEventListener("click", () => { setMotionPref(b.dataset.motion); g.requestBoardDraw(); this.renderBody(true); }));
    body.querySelectorAll("[data-avanim]").forEach((b) => b.addEventListener("click", () => { setAvatarAnim(b.dataset.avanim === "true"); g.render(); refreshAvatars(); this.renderBody(true); }));
    renderQuickToggle(body.querySelector("[data-qt]"), g, () => this.renderBody(true));
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
