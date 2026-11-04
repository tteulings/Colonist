// Theme registry + persistence + lazy fonts + motion preference + DOM sprite.
// A theme = CSS tokens on [data-theme="<id>"] (themes/*.css) + one art module (src/themes/<name>/art.js).
// Themes: A Sunny Island, B Wooden Board Game, C Silhouette, Classic.
import { timePhase, estimatePlace } from "./daylight.js";
import sunny from "./sunny/art.js";
import wood from "./wood/art.js";
import silhouette from "./silhouette/art.js";
import classic from "./classic/art.js";
import { RESOURCE_KEYS, DEV_KEYS } from "./art-util.js";
import { addExtraSeats, applyExtraSeatTokens, applySeatTokens } from "./seats.js";
import { SEAT_PERSONAS } from "./portraits.js";
import { seaIcons } from "../seafarers/art.js"; // ⚓ Seafarers icons (themes may draw their own)

export const THEMES = { A: sunny, B: wood, C: silhouette, classic };
Object.values(THEMES).forEach(addExtraSeats); // seats 5–6 (5–6 player games)
applyExtraSeatTokens();
export const THEME_ORDER = ["A", "B", "C", "classic"];
export const DEFAULT_THEME = "A";
const THEME_KEY = "colonist.theme";
const MOTION_KEY = "colonist.motion";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};

export function storedThemeId() {
  const id = store.get(THEME_KEY);
  return THEMES[id] ? id : DEFAULT_THEME;
}
export function saveThemeId(id) { store.set(THEME_KEY, id); }

// ── motion ───────────────────────────────────────────────────────────────
// "full" | "reduced" | "system" (follow prefers-reduced-motion)
export function motionPref() {
  const v = store.get(MOTION_KEY);
  return v === "full" || v === "reduced" ? v : "system";
}
const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
export function motionReduced() {
  const p = motionPref();
  return p === "reduced" || (p === "system" && !!mq?.matches);
}
export function setMotionPref(v) {
  store.set(MOTION_KEY, v);
  applyMotionAttr();
}
// Sunny Island colour palette: "light" (default) | "vivid" | "night" (v0.85). Contract: scratchpad/palette-contract.md
// colonist.palette = the palette you picked; colonist.paletteAuto = "on" follows the system: Night while the OS is in
// dark mode, otherwise your day palette (colonist.dayPalette, the last Light / Vivid you picked). The head script in
// index.html / lab.html runs the same rule before first paint, so there is no light flash.
const PALETTE_KEY = "colonist.palette", AUTO_KEY = "colonist.paletteAuto", DAY_KEY = "colonist.dayPalette", PHASE_KEY = "colonist.autoPalette";
// v1.04 proposal (dusk-104): + "dusk", and colonist.paletteAuto = "time" — Auto · time of day: your day palette by day,
// Dusk around sunset / sunrise, Night after dark (src/themes/daylight.js; place estimated from the time zone, no
// location permission). "on" (Follow system) stays as Auto's second source.
const PALETTES = ["light", "vivid", "dusk", "night"];
const darkMq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export function palettePref() { const v = store.get(PALETTE_KEY); return PALETTES.includes(v) ? v : "light"; }
/** false | "system" | "time" */
export function paletteAutoMode() { const v = store.get(AUTO_KEY); return v === "on" ? "system" : v === "time" ? "time" : false; }
export function paletteAuto() { return !!paletteAutoMode(); }
export function dayPalette() { const v = store.get(DAY_KEY); return v === "vivid" ? "vivid" : palettePref() === "vivid" ? "vivid" : "light"; }
export function systemDark() { return !!darkMq?.matches; }
/** Test / mockup hook: ?clock=19:05 (or window.__colonistClock = Date) pins the time Auto reads. */
function clockNow() {
  if (typeof window !== "undefined" && window.__colonistClock) return new Date(window.__colonistClock);
  const m = typeof location !== "undefined" && /[?&]clock=(\d{1,2}):(\d{2})/.exec(location.search);
  if (m) { const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); return d; }
  return new Date();
}
export function autoTimeInfo(now = clockNow()) { return timePhase(now, estimatePlace(now)); }
/** The palette on screen: your pick, or Auto (time of day / follow system). */
export function effectivePalette() {
  const mode = paletteAutoMode();
  if (mode === "time") { const ph = autoTimeInfo().phase; return ph === "day" ? dayPalette() : ph; }
  if (mode === "system") return systemDark() ? "night" : dayPalette();
  return palettePref();
}
function applyPaletteAttr({ soft = false } = {}) {
  const p = effectivePalette();
  if (paletteAutoMode() === "time") store.set(PHASE_KEY, p); // the index.html head script paints this before first frame
  if (document.documentElement.dataset.palette === p) return;
  const root = document.documentElement;
  if (soft) { // a slow cross-fade instead of a jump (CSS: html.pal-fade; game.js fades a snapshot of the board)
    root.classList.add("pal-fade");
    window.clearTimeout(applyPaletteAttr._t);
    applyPaletteAttr._t = window.setTimeout(() => root.classList.remove("pal-fade"), 2400);
  }
  root.dataset.palette = p;
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.content = root.dataset.theme === "A" && p === "night" ? "#0E1B22" : root.dataset.theme === "A" && p === "dusk" ? "#1D1828" : "#2d6888";
  document.dispatchEvent(new CustomEvent("colonist:palette", { detail: { palette: p, soft } }));
}
/** Pick a palette: an explicit pick switches Auto off. */
export function setPalette(v) {
  const p = PALETTES.includes(v) ? v : "light";
  if (p === "light" || p === "vivid") store.set(DAY_KEY, p);
  store.set(AUTO_KEY, "off");
  store.set(PALETTE_KEY, p);
  applyPaletteAttr();
}
/** mode: false | true (= "system", the v0.85 switch) | "system" | "time" */
export function setPaletteAuto(mode) {
  const m = mode === true ? "system" : mode;
  store.set(AUTO_KEY, m === "system" ? "on" : m === "time" ? "time" : "off");
  applyPaletteAttr();
}
darkMq?.addEventListener?.("change", () => { if (paletteAutoMode() === "system") applyPaletteAttr({ soft: true }); });
/** Auto · time of day: called every minute and by the game at calm moments (a new turn, a Rush roll, the home
 *  screen). The game may hold the switch while you are mid-action (window.__colonistPaletteGate returns false);
 *  the next tick or turn picks it up. The switch itself is a ~1.2 s cross-fade. */
export function paletteTick() {
  if (paletteAutoMode() !== "time") return;
  const gate = typeof window !== "undefined" && window.__colonistPaletteGate;
  if (gate && !gate()) return;
  applyPaletteAttr({ soft: true });
}
if (typeof window !== "undefined") window.setInterval(paletteTick, 60000);
if (typeof document !== "undefined" && paletteAutoMode() === "time") applyPaletteAttr(); // correct a stale first paint
export function applyMotionAttr() {
  document.documentElement.dataset.motion = motionReduced() ? "reduced" : "full";
}
mq?.addEventListener?.("change", applyMotionAttr);

// ── fonts (Google Fonts, per theme, loaded lazily) ───────────────────────
export function prefetchFonts(theme) {
  if (!theme?.fonts?.url || document.querySelector(`link[data-font="${theme.id}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = theme.fonts.url;
  l.dataset.font = theme.id;
  document.head.append(l);
}
/** Resolves once the theme's fonts are usable (or after a short timeout — system fallbacks apply). */
export async function loadFonts(theme) {
  if (!theme?.fonts) return;
  prefetchFonts(theme);
  const wait = Promise.all(theme.fonts.families.map((fam) => document.fonts.load(`400 24px "${fam}"`).catch(() => null)));
  await Promise.race([wait, new Promise((r) => setTimeout(r, 2500))]);
}

// ── DOM sprite: icons, cards, avatars, dice as <symbol>s ─────────────────
// Seat → portrait (src/themes/portraits.js): Rosa Roodhart (you), Blaauw, Van Geelen, Groenewoud, De Wit, Pimpel
export const SEAT_PRESETS = SEAT_PERSONAS;
export const BOT_PROFILE = {
  rosa: { name: "You", botName: "Roodhart", full: "Rosa Roodhart", tag: "Your colony" },
  blaauw: { name: "Blaauw", full: "Mevrouw Blaauw van Draet", tag: "The Trader" },
  geelen: { name: "Van Geelen", full: "Kolonel Van Geelen", tag: "The Builder" },
  groenewoud: { name: "Groenewoud", full: "Dominee Groenewoud", tag: "The Shark" },
  dewit: { name: "De Wit", full: "Mevrouw De Wit", tag: "Seat 5" },
  pimpel: { name: "Pimpel", full: "Professor Pimpel", tag: "Seat 6" },
};
export function buildSprite(T) {
  let s = `<svg id="themeSprite" class="sprites" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${T.uiDefs ? T.uiDefs() : ""}`;
  // the Menu glyph: three lines unless the theme draws its own; the default ⚓ ship icon in neutral ink (a build icon is UI, not a seat colour)
  const icons = { menu: `<path d="M-30 -22H30M-30 0H30M-30 22H30" stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none"/>`, ...seaIcons(T.youPc || { base: "#22313A", dark: "#16222A", light: "#4A5A64", line: "#0E161B" }, T.palette?.ink), ...T.icons };
  for (const [k, v] of Object.entries(icons)) s += `<symbol id="ic-${k}" viewBox="-50 -50 100 100" overflow="visible">${v}</symbol>`;
  for (const k of [...RESOURCE_KEYS, ...DEV_KEYS]) s += `<symbol id="card-${k}" viewBox="0 0 250 350">${T.card(k)}</symbol><symbol id="cardm-${k}" viewBox="0 0 250 350">${T.card(k, true)}</symbol>`;
  s += `<symbol id="card-back" viewBox="0 0 250 350">${T.cardBack()}</symbol>`;
  SEAT_PRESETS.forEach((p, i) => { s += `<symbol id="av-${i}" viewBox="-50 -50 100 100">${T.avatar(p)}</symbol>`; });
  for (let n = 1; n <= 6; n += 1) s += `<symbol id="die-${n}" viewBox="-50 -50 100 100" overflow="visible">${T.die(n)}</symbol>`;
  return s + "</defs></svg>";
}
export function installSprite(T) {
  applySeatTokens(T); // v0.78: UI seat colours = this theme's pieces (also re-run on a palette change)
  document.getElementById("themeSprite")?.remove();
  document.body.insertAdjacentHTML("afterbegin", buildSprite(T));
}

// ── tiny markup helpers shared by the DOM UI ─────────────────────────────
export const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-${n}" x="-50" y="-50" width="100" height="100"/></svg>`;
/** v0.75 player chip stat for knights played / road length, only once it means something (knights > 0, a road
 *  of 3+) or for the holder of the award (Largest Army / Longest Road): then the number sits on a gold pill with
 *  "+2" — gold is never a seat colour. Returns "" when there is nothing to show (keeps the chips calm). */
export function awardStat(stat, n, held, title, ic) {
  if (!held && n < (stat === "road" ? 3 : 1)) return "";
  return `<span data-stat="${stat}"${held ? ' class="award"' : ""} title="${title}">${icon(ic)}${n}${held ? '<b class="aw-plus">+2</b>' : ""}</span>`;
}
export const avatarSvg = (seat, cls = "") => `<span class="avatar pc-${seat} ${cls}"><svg viewBox="-50 -50 100 100" aria-hidden="true"><use href="#av-${seat}" x="-50" y="-50" width="100" height="100"/></svg></span>`;
export const dieSvg = (n, cls = "") => `<svg class="die ${cls}" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#die-${n}" x="-50" y="-50" width="100" height="100"/></svg>`;
export const cardSvg = (k, big = false) => `<svg viewBox="0 0 250 350" aria-hidden="true"><use href="#${big ? "card" : "cardm"}-${k}"/></svg>`;
export const cardBackSvg = () => `<svg viewBox="0 0 250 350" aria-hidden="true"><use href="#card-back"/></svg>`;
