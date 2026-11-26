// v1.99 SHELL: the screens around the game (design: docs/design/start-en-navigatie.md).
//  - Home            Play tab (Continue row, Daily puzzle card "Coming soon", New game card) and the Daily puzzle tab
//  - Chrome          the tab bar (Play, Daily puzzle, Review, Bots) and the gear; shown on the four tab roots only
//  - openNewGame()   the New game bottom sheet (+ the "More rules" and "Levels" second layers)
//  - GameMenu        the Pause sheet (5 rows)
//  - explainOn()     the "Explain the set-up" preference
// The screens are DOM layers (see nav.js); the strings are English and the localizer (src/i18n.js) turns them into Dutch.
import { avatarSvg, setPalette } from "./themes/manager.js"; // (no new export of an older module is imported: during an upgrade a stale cached manager.js must not stop the app)
import { oicon } from "./ui-icons.js";
import { toast } from "./toast.js";
import { reviewAvailable } from "./master.js";
import { isNL } from "./i18n.js";
import { mapThumb } from "./map-thumbs.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
};
const q = (s, r = document) => r.querySelector(s);
/** Did the player ever pick a palette (or Auto)? Same rule as manager.js paletteAutoMode(). */
const paletteChosen = () => store.get("colonist.paletteAuto") != null || store.get("colonist.palette") != null;
const PLAY_IC = `<svg class="hm-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.5" fill="currentColor" opacity=".2"/><path d="M9.6 7.4v9.2l7.4-4.6z" fill="currentColor"/></svg>`;
const PUZZLE_IC = `<svg class="ic oi" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4.5a2 2 0 0 1 4 0V6H18v4.5h-1.5a2 2 0 0 0 0 4H18V19h-4.5v-1.5a2 2 0 0 0-4 0V19H5v-4.5h1.5a2 2 0 0 0 0-4H5V6h4.5z"/></svg>`;
const PERSON_IC = `<svg viewBox="0 0 12 16" width="7" height="10" focusable="false"><circle cx="6" cy="4.2" r="3.2" fill="currentColor"/><path d="M0.6 15.5c0-4.2 2.4-6.2 5.4-6.2s5.4 2 5.4 6.2z" fill="currentColor"/></svg>`;
const STATS_ART = `<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke-linejoin="round"><polygon points="24,5 34,11 34,23 24,29 14,23 14,11" fill="#EDC25E" stroke="#D3A341" stroke-width="2"/><polygon points="14,25 24,31 24,43 14,49 4,43 4,31" transform="translate(5 -6)" fill="#B8D57A" stroke="#97B95C" stroke-width="2"/><polygon points="34,25 44,31 44,43 34,49 24,43 24,31" transform="translate(-1 -6)" fill="#E07E5A" stroke="#C0623F" stroke-width="2"/><circle cx="24" cy="17" r="2.4" fill="#fff"/></svg>`;
const CHEV = `<svg class="sh-chev" viewBox="0 0 20 20" aria-hidden="true" width="18" height="18"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BACK = `<svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const UPDATE_IC = `<svg class="hm-upd-ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 10a5.5 5.5 0 1 1-1.8-4.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14.6 1.8v4.6H10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const LEVELS = [["beginner", "Easy"], ["intermediate", "Medium"], ["expert", "Hard"]];
const MAX_BOTS = 5;
const SEA_MAX_BOTS = 3;

// ── the Explain preference ("Explain the set-up": on until the first finished game, then whatever the player chose) ──
const EXPLAIN_KEY = "colonist.explain";
export function explainOn(game) {
  const v = store.get(EXPLAIN_KEY);
  if (v === "on") return true;
  if (v === "off") return false;
  const n = game?.hist?.count;
  return !(typeof n === "number" && n > 0);
}
export function setExplain(on) { store.set(EXPLAIN_KEY, on ? "on" : "off"); }

// ───────────────────────────── the tab bar and the gear ─────────────────────────────
const TABS = [["play", "Play", () => oicon("dice")], ["daily", "Daily puzzle", () => PUZZLE_IC], ["review", "Review", () => oicon("history")], ["bots", "Bots", () => oicon("bars")]];

/** The tab bar and the gear are one pair of fixed elements; they show only while a tab root is on screen (Home open, no sheet or deeper screen over it). */
export class Chrome {
  constructor(game) {
    this.game = game;
    this.tab = null;
    const nav = document.createElement("nav");
    nav.className = "sh-tabs"; nav.setAttribute("aria-label", "Main menu"); nav.hidden = true;
    nav.innerHTML = TABS.map(([k, l, ic]) => `<button type="button" class="sh-tab" data-tab="${k}"><span class="sh-tab-i">${ic()}<i class="sh-badge" hidden></i></span><span class="sh-tab-l"${k === "play" ? " data-i18n-skip" : ""}>${k === "play" && isNL() ? "Spelen" : l}</span></button>`).join("");
    nav.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) this.go(b.dataset.tab); });
    const gear = document.createElement("button");
    gear.type = "button"; gear.className = "sh-gear"; gear.setAttribute("aria-label", "Settings"); gear.hidden = true;
    gear.innerHTML = oicon("settings");
    gear.addEventListener("click", () => this.game.settingsUI?.open("look", { from: "tab" }));
    document.body.append(nav, gear);
    this.nav = nav; this.gear = gear;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => this.sync(), 30); }).observe(document.body, { childList: true });
    addEventListener("colonist:lang", () => { const p = nav.querySelector('[data-tab="play"] .sh-tab-l'); if (p) p.textContent = isNL() ? "Spelen" : "Play"; this.sync(); }); // "Play" has an older Dutch ("Speel"): the tab says "Spelen"
  }
  /** Which tab root is on screen (null: none, the bar is hidden). */
  current() {
    const g = this.game;
    if (!g.home?.open) return null;
    const over = q(".newgame-modal, .tm-settings, .welcome, .nm-sheet, .bp-sheet, .menu-sheet, .hs-sheet, .rv-info, .tm-modal.menu-sheet") || g._rvEl || g._lnEl || g._rpUi || g.settingsUI?.el;
    if (over) return null;
    if (g._histEl) return "review";
    if (g._bpgEl) return "bots";
    return g.home.tab === "daily" ? "daily" : "play";
  }
  sync() {
    const cur = this.current();
    this.tab = cur;
    const on = !!cur;
    this.nav.hidden = !on; this.gear.hidden = !on;
    document.body.classList.toggle("sh-tabs-on", on);
    document.body.dataset.shTab = cur || "";
    this.nav.querySelectorAll("[data-tab]").forEach((b) => { const a = b.dataset.tab === cur; b.classList.toggle("on", a); if (a) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    if (on) this.game.home?.afterTabs?.();
  }
  /** Open a tab root: the other roots are closed first (no history entry per tab, nav.js counts the overlays). */
  go(tab) {
    const g = this.game;
    if (this.tab === tab) { // the active tab again: back to the top
      const sc = tab === "play" || tab === "daily" ? g.home.el : q(".hs .hs-scroll, .hs");
      sc?.scrollTo?.({ top: 0, behavior: "smooth" }); return;
    }
    g.histClose?.(); g.botsClose?.(); g.lessonsClose?.();
    if (tab === "review") { g.home.tab = "play"; g.home.render(); g.histOpen?.(); }
    else if (tab === "bots") { g.home.tab = "play"; g.home.render(); g.botsOpen?.(); }
    else { g.home.tab = tab; g.home.render(); }
    this.sync();
    q(".sh-tabs [aria-current] ")?.focus?.({ preventScroll: true });
  }
}

// ───────────────────────────── a review that is not finished ─────────────────────────────
/** v1.99.2: the newest past game whose review was started and is not complete (the history entry knows: provisional, with a "moves checked" count).
 *  After a reload the review is gone from the screen, so Home offers it again. null when there is none or this browser cannot run the review. */
export function reviewInProgress(game) {
  try {
    const m = game?.hist?.metas?.[0];
    if (!m || !m.prov || !m.rp || !m.rec || m.me == null || m.acc == null || !reviewAvailable()) return null;
    return m;
  } catch (_) { return null; }
}
const RV_CHEV = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;
const REVIEW_IC = `<svg class="sh-rv-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4h4M12 8v4.5l3 1.8"/></svg>`;
/** The small Home entry for it (empty when there is nothing to continue). */
export function reviewEntryHtml(game) {
  const m = reviewInProgress(game);
  if (!m) return "";
  return `<button type="button" class="sh-rvcont" data-home="review"><span class="sh-rvi">${REVIEW_IC}</span><span class="sh-rvt"><b>Review in progress</b><small>Continue · ${m.rp[0]} of ${m.rp[1]} moves checked</small></span><span class="sh-rvgo" aria-hidden="true">${RV_CHEV}</span></button>`;
}

// ── the quick picks (Home card and New game sheet share these, so both always agree) ──
/** Map picker: two small cards, thumbnail on top and the name below (Home and the New game sheet). Seafarers needs 3–4 players: disabled, the reason sits on the thumbnail.
 *  `attrs(id)` gives the data attributes of a card (Home: data-q, sheet: data-set). */
export const mapCardsHtml = (board, players, attrs) => {
  const bigT = players > SEA_MAX_BOTS + 1;
  const card = (id, name) => { const on = board === id, off = id === "seafarers" && bigT;
    return `<button type="button" role="radio" class="hm-map${on ? " on" : ""}" ${attrs(id)} aria-checked="${on}"${off ? " disabled" : ""}><span class="hm-map-th">${mapThumb(id)}<span class="hm-map-why">Needs 3–4 players</span></span><span class="hm-map-n"><b>${name}</b></span></button>`; };
  return `<div class="hm-maps" role="radiogroup" aria-label="Map">${card("island", "Island")}${card("seafarers", "Seafarers")}</div>`;
};
const seaOn = (d) => d.board === "seafarers";
const maxBotsOf = (D, d) => (seaOn(d) ? SEA_MAX_BOTS : D.PLAYER_CONFIG.length - 1);
/** 5–6 players: Rush rolls every 15 s by default (back to the 8 s default for a smaller table). `prev` = the bots before the change. */
export function bigAdjustD(D, d, prev) {
  if (D.isBigTable(d.numBots + 1) !== D.isBigTable(prev + 1)) {
    if (D.isBigTable(d.numBots + 1) && d.rushInterval < D.BIG_RUSH_INTERVAL) d.rushInterval = D.BIG_RUSH_INTERVAL;
    else if (!D.isBigTable(d.numBots + 1) && d.rushInterval === D.BIG_RUSH_INTERVAL) d.rushInterval = D.DEFAULT_SETTINGS.rushInterval;
  }
}
export function setModeD(d, raw) { d.mode = raw; if (raw === "rush") d.humans = d.humans.map(() => false); }
export function setBoardD(game, D, d, raw) {
  const prev = d.numBots;
  d.board = raw;
  if (seaOn(d) && d.numBots > SEA_MAX_BOTS) { game._ngBotsIsland = d.numBots; d.numBots = SEA_MAX_BOTS; }
  else if (!seaOn(d) && game._ngBotsIsland) { d.numBots = game._ngBotsIsland; game._ngBotsIsland = 0; }
  bigAdjustD(D, d, prev);
}
/** Total players at the table (you included). */
export function setPlayersD(D, d, n) { const prev = d.numBots; d.numBots = clampN(n - 1, 1, maxBotsOf(D, d)); bigAdjustD(D, d, prev); }

// ───────────────────────────── Home: the Play tab and the Daily puzzle tab ─────────────────────────────
const bigN = (n) => n >= 4;

export class Home {
  /**
   * opts: { saved(): null | { mode, turn, players: [{ name, vp, seat }] }, last(): settings, introSeen(), historyCount(),
   *         onContinue(), onStartLast(), onAdjust(), onSettings() }
   */
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.el = null;
    this.tab = "play";
    this.histReady = false;
    this.chrome = null;
    this.onKey = (e) => { if (e.key === "Enter" && e.target === document.body && this.opts.saved()) this.opts.onContinue(); };
    this.onUpdate = () => { if (this.el) this.render(); };
  }

  get open() { return !!this.el; }

  show() {
    if (!this.el) {
      this.tab = "play";
      this.el = document.createElement("div");
      this.el.className = "home sh-home";
      this.el.setAttribute("role", "region");
      this.el.setAttribute("aria-label", "Katan home");
      document.addEventListener("keydown", this.onKey);
      document.addEventListener("colonist:update", this.onUpdate);
      document.body.appendChild(this.el);
      document.body.classList.add("home-open");
    }
    if (!this.chrome) this.chrome = new Chrome(this.game);
    this.render();
    this.chrome.sync();
    try {
      const open = this.game.hist?.open?.();
      if (!open) this.histReady = true;
      else open.then(() => { this.histReady = true; this.histLoaded(); }, () => { this.histReady = true; this.histLoaded(); });
    } catch (_) { this.histReady = true; }
    this.autoDarkToast();
  }

  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    document.body.classList.remove("home-open");
    document.removeEventListener("keydown", this.onKey);
    document.removeEventListener("colonist:update", this.onUpdate);
    this.chrome?.sync();
  }

  /** Anyone who never chose a palette follows the phone since v1.99: say so once, with a way back. */
  autoDarkToast() {
    if (store.get("colonist.autoDarkToast") || paletteChosen()) return;
    store.set("colonist.autoDarkToast", "1");
    // v1.99.2: never over a sheet (it sat on the Start button of the New game sheet): wait until no sheet is open (twice a second, for 30 s at most)
    let tries = 0;
    const show = () => {
      if (document.querySelector(".sh-sheet-wrap") && tries++ < 60) { window.setTimeout(show, 500); return; }
      toast({ text: "Colours follow your phone.", icon: "moon", action: { label: "Undo", onClick: () => { setPalette("light"); this.game.requestBoardDraw?.(); } } });
    };
    window.setTimeout(show, 900);
  }

  /** The rest of the settings, as short parts for the one muted line under the quick picks (level, points, Explain, then only what is not the default). */
  summaryParts(last) {
    const lvl = last.botStyleMode === "each" ? "Mixed levels" : (this.game.shellLevelLabel?.(last.allPreset) || "Medium");
    const people = 1 + (last.mode === "rush" ? 0 : last.humans.slice(0, last.numBots).filter(Boolean).length);
    const pts = last.board === "seafarers" ? 14 : last.winPoints;
    return [lvl, `${pts} pt`, explainOn(this.game) ? "Explain on" : "Explain off",
      people > 1 ? `${people} people` : "", last.friendlyRobber ? "Friendly robber" : "",
      last.dice && last.dice !== "random" ? `${last.dice === "deck" ? "event deck" : last.dice} dice` : "",
      last.map && last.map !== "random" ? `${last.map} map` : "", last.numBots === 1 ? "2 players" : ""].filter(Boolean);
  }

  /** The three quick picks: Type, Map, Players. One tap = saved through the same path as the sheet. */
  quickHtml(last) {
    const rush = last.mode === "rush", sea = last.board === "seafarers", hot = !rush && last.humans.slice(0, last.numBots).some(Boolean);
    const seg = (key, label, opts, value, off = [], lab = null) => `<div class="hm-qrow"><span class="hm-ql" aria-hidden="true">${esc(label)}</span><div class="sh-seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, l]) =>
      `<button type="button" role="radio" data-q="${key}:${v}" data-k="${key}:${v}" aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? "on" : ""}"${lab ? ` aria-label="${lab(v)}"` : ""}${off.includes(v) ? ' disabled' : ""}>${l}</button>`).join("")}</div></div>`;
    const note = hot ? "Classic only with a friend" : "";
    return `<div class="hm-quick">${seg("mode", "Type", [["classic", "Classic"], ["rush", "Rush"]], last.mode, hot ? ["rush"] : [])}
      <div class="hm-qrow hm-qmap"><span class="hm-ql" aria-hidden="true">Map</span>${mapCardsHtml(last.board, last.numBots + 1, (id) => `data-q="board:${id}" data-k="board:${id}"`)}</div>
      ${seg("players", "Players", [3, 4, 5, 6].map((n) => [n, `<span class="hm-pp" aria-hidden="true">${PERSON_IC.repeat(n)}</span><b class="hm-pn" aria-hidden="true">${n}</b>`]), last.numBots + 1, sea ? [5, 6] : [], (v) => `${v} players`)}
      ${note ? `<p class="hm-qnote">${note}</p>` : ""}</div>`;
  }

  render() {
    if (!this.el) return;
    const keep = this.el.scrollTop;
    this.el.dataset.tab = this.tab;
    this.el.classList.toggle("has-save", !!this.opts.saved());
    this.el.innerHTML = this.tab === "daily" ? this.dailyHtml() : this.playHtml();
    const on = (sel, fn) => this.el.querySelectorAll(sel).forEach((b) => b.addEventListener("click", fn));
    on("[data-home='continue']", () => this.opts.onContinue());
    on("[data-home='update']", (e) => { const b = e.currentTarget, sm = b.querySelector("small"); if (sm) sm.textContent = "Starting the new version…";
      if (window.__colonistReload) window.__colonistReload(b); else window.location.reload(); });
    on("[data-home='review']", () => { const m = reviewInProgress(this.game); if (m) this.game.histView?.(m.id, "review", m.me); });
    on("[data-q]", (e) => this.quickPick(e.currentTarget.dataset.q));
    on("[data-home='games']", () => this.chrome?.go("review"));
    on("[data-home='adjust']", () => this.opts.onAdjust());
    on("[data-home='start']", () => this.opts.onStartLast());
    this.el.scrollTop = keep;
  }

  /** The history is loaded: only the stats card changes (its box is the same size, so nothing moves). A review in progress adds a row, which needs one full render. */
  histLoaded() {
    if (!this.el || this.tab !== "play") return;
    if (reviewInProgress(this.game) && !this.el.querySelector(".sh-rvcont")) { this.render(); return; }
    this.patchStats();
  }
  patchStats() {
    const el = this.el?.querySelector(".hm-stats");
    if (!el) return;
    const t = document.createElement("div"); t.innerHTML = this.statsHtml();
    const n = t.firstElementChild;
    if (!n || n.outerHTML === el.outerHTML) return;
    el.className = n.className; el.innerHTML = n.innerHTML;
    for (const a of ["disabled", "aria-hidden", "aria-labelledby", "tabindex"]) { if (n.hasAttribute(a)) el.setAttribute(a, n.getAttribute(a)); else el.removeAttribute(a); }
  }

  /** "Your games": only what the history already holds (won / lost games with you at the table). */
  statsHtml() {
    if (!this.histReady) return `<button type="button" class="sh-card hm-stats sk" data-home="games" disabled aria-hidden="true" tabindex="-1"></button>`; // same box, filled in when the history has loaded
    const all = (this.game.hist?.metas || []).filter((m) => m.me != null && (m.result === "won" || m.result === "lost")); // newest first
    if (!all.length) return `<button type="button" class="sh-card hm-stats empty" data-home="games"><span class="hm-st-art" aria-hidden="true">${STATS_ART}</span><span class="hm-st-tx"><b>Your games</b><small>Play your first game, your overview shows up here.</small></span></button>`;
    const won = all.filter((m) => m.result === "won").length, pct = Math.round(100 * won / all.length);
    let streak = 0; for (const m of all) { if (m.result === "won") streak++; else break; }
    const last = all[0], mine = last.seats?.find((x) => x.you), best = Math.max(0, ...(last.seats || []).filter((x) => !x.you).map((x) => x.vp || 0));
    const profs = [...new Set((last.seats || []).filter((x) => !x.you).map((x) => x.prof))].filter(Boolean);
    const lvl = profs.length === 1 && !last.hot ? (this.game.shellLevelLabel?.(profs[0]) || "") : "";
    const days = Math.max(0, Math.round((Date.now() - (last.end || Date.now())) / 864e5));
    const ago = days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
    const accs = all.filter((m) => typeof m.acc === "number" && !m.prov).map((m) => m.acc);
    const dots = all.slice(0, 10).reverse().map((m) => `<i class="${m.result === "won" ? "w" : "l"}"></i>`).join("");
    const C = 2 * Math.PI * 21;
    return `<button type="button" class="sh-card hm-stats" data-home="games" aria-labelledby="hmStH">
      <span class="hm-st-head"><b id="hmStH">Your games</b><span class="hm-st-go" aria-hidden="true">${CHEV}</span></span>
      <span class="hm-st-main">
        <svg class="hm-ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="21" class="bg"/><circle cx="26" cy="26" r="21" class="fg" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 26 26)"/><text x="26" y="30.5" text-anchor="middle">${pct}%</text></svg>
        <span class="hm-st-n"><b>${all.length}</b><small>Played</small></span><span class="hm-st-n"><b>${won}</b><small>Won</small></span><span class="hm-st-n"><b>${streak}</b><small>Win streak</small></span>
        <span class="hm-dots" aria-hidden="true">${dots}</span>
      </span>
      <span class="hm-st-last">${mine ? avatarSvg(last.me, "hm-sav") : ""}<span class="hm-st-lt"><span>Last game</span> <b>${last.result === "won" ? "Won" : "Lost"}</b> <span>${mine ? mine.vp : "?"}–${best}</span>${lvl ? ` <span>vs</span> <span>${esc(lvl)}</span>` : ""} · <span>${esc(ago)}</span>${accs.length ? ` · <span>Best accuracy</span> <span>${Math.max(...accs)}</span>` : ""}</span></span>
    </button>`;
  }

  /** A tap on a quick pick: same rules and same saved settings as the New game sheet. */
  quickPick(spec) {
    const D = this.opts.deps?.();
    if (!D) return;
    const i = spec.indexOf(":"), key = spec.slice(0, i), raw = spec.slice(i + 1);
    const d = D.normalizeSettings(JSON.parse(JSON.stringify(D.loadLast())));
    if (key === "mode") setModeD(d, raw);
    else if (key === "board") setBoardD(this.game, D, d, raw);
    else if (key === "players") setPlayersD(D, d, Number(raw));
    else return;
    try { D.saveLast(d); } catch (_) { /* private mode */ }
    this.game.sfx?.click?.();
    this.patchQuick(D.normalizeSettings(d));
  }
  /** Update the pressed / disabled state of the quick picks and the summary line in place: nothing is rebuilt, so nothing flickers, moves or loses focus. */
  patchQuick(last) {
    const root = this.el;
    if (!root) return;
    const sea = last.board === "seafarers", big = last.numBots + 1 > SEA_MAX_BOTS + 1, hot = last.mode !== "rush" && last.humans.slice(0, last.numBots).some(Boolean);
    const want = { mode: last.mode, board: last.board, players: String(last.numBots + 1) };
    root.querySelectorAll("[data-q]").forEach((b) => {
      const [k, v] = b.dataset.q.split(":"), on = want[k] === v;
      b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on));
      b.disabled = (k === "mode" && v === "rush" && hot) || (k === "board" && v === "seafarers" && big) || (k === "players" && sea && Number(v) > SEA_MAX_BOTS + 1);
    });
    const sum = root.querySelector(".hm-sum");
    if (sum) sum.innerHTML = this.summaryParts(last).map((x) => `<span>${esc(x)}</span>`).join(" · ");
  }

  updateHtml(s) {
    const upd = window.__colonistUpdate;
    return upd ? `<button type="button" class="hm-update" data-home="update" aria-live="polite">${UPDATE_IC}<span><b>${upd.version ? `Update to v${upd.version}` : "Update ready"}</b><small>New version ready · tap to reload${s ? " · your game is saved" : ""}</small></span><span class="hm-chev" aria-hidden="true">›</span></button>` : "";
  }

  playHtml() {
    const s = this.opts.saved();
    const last = this.opts.last();
    const parts = this.summaryParts(last);
    return `<div class="hm-col sh-col">
      <header class="hm-brand sh-brand"><svg class="hm-logo" viewBox="0 0 100 100" aria-hidden="true"><use href="#kt-logo" width="100" height="100"/></svg>
        <h1>Katan<small class="hm-sub">Traders and Builders</small></h1></header>
      ${this.updateHtml(s)}
      ${s ? `<button type="button" class="sh-continue" data-home="continue">${PLAY_IC}<span class="sh-ct"><b>Resume game</b><small>${esc(s.mode)} · ${s.mode.startsWith("Rush") ? "roll" : "turn"} ${s.turn}</small></span><span class="sh-avs" aria-hidden="true">${s.players.slice(0, 4).map((p) => `<span class="pc-${p.seat}">${avatarSvg(p.seat, "sh-av")}</span>`).join("")}</span></button>` : ""}
      ${reviewEntryHtml(this.game)}
      <section class="sh-card gold sh-soon" aria-labelledby="shDailyH" aria-disabled="true">
        <span class="sh-soon-ic" aria-hidden="true">${PUZZLE_IC}</span>
        <div class="sh-soon-tx"><div class="sh-soon-h"><h2 id="shDailyH">Daily puzzle</h2><span class="sh-chip soon">Coming soon</span></div><p>The same rolls for everyone, every day.</p></div>
      </section>
      <section class="sh-card sh-new" aria-labelledby="shNewH">
        <div class="sh-card-head"><h2 id="shNewH">New game</h2><button type="button" class="btn sm" data-home="adjust">Adjust</button></div>
        ${this.quickHtml(last)}
        <p class="hm-sum" aria-label="Your last settings">${parts.map((x) => `<span>${esc(x)}</span>`).join(" · ")}</p>
        <button type="button" class="btn primary block hm-start" data-home="start" data-mode="${last.mode}">Start game</button>
      </section>
      ${this.statsHtml()}
    </div>`;
  }

  dailyHtml() {
    return `<div class="hm-col sh-col">
      <header class="sh-title"><h1>Daily puzzle</h1></header>
      ${this.updateHtml(false)}
      <section class="sh-card gold sh-daily" aria-labelledby="shDailyH2" aria-disabled="true">
        <div class="sh-daily-top"><span class="sh-chip soon">Coming soon</span></div>
        <div class="sh-daily-art" aria-hidden="true">${PUZZLE_IC}</div>
        <h2 id="shDailyH2">Daily puzzle</h2>
        <p>One board, the same rolls for everyone, a new one every day. Race the daily bots and keep your streak.</p>
        <button type="button" class="btn block" disabled aria-disabled="true">Coming soon</button>
      </section>
    </div>`;
  }
}

// ───────────────────────────── New game sheet ─────────────────────────────
/** Open the New game sheet. `deps` are the game.js internals it needs (presets, settings rules, names). */
export function openNewGame(game, deps, { friend = false } = {}) {
  const D = deps;
  q(".newgame-modal")?.remove();
  game.onboarding?.close();
  game.settingsUI?.close();
  const last = D.normalizeSettings(D.loadLast());
  let d = D.normalizeSettings(JSON.parse(JSON.stringify(last)));
  if (friend) {
    d.mode = "classic"; d.board = "island"; d.numBots = Math.max(1, d.numBots);
    d.humans = d.humans.map((h, i) => (i === 0 ? true : h));
    if (!d.names[0] && D.Names.me()) d.names = d.names.map((n, i) => (i === 0 ? D.Names.me() : n));
  }
  game.uiPaused = true;
  const wrap = document.createElement("div");
  wrap.className = "newgame-modal sh-sheet-wrap tm-modal";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-labelledby", "shNgT");
  let layer = ""; // "" | "rules" | "levels"
  let enter = false, focusKey = "";
  const P = D.PLAYER_CONFIG;
  const levelName = (k) => D.AI_PRESET_INFO[k]?.label || "Custom";
  const allKeys = () => D.byStrength(Object.keys(D.AI_PRESETS));
  const sea = () => d.board === "seafarers";
  const maxBots = () => (sea() ? SEA_MAX_BOTS : P.length - 1);
  const botSeats = () => Array.from({ length: d.numBots }, (_, i) => i + 1).filter((id) => !(d.mode !== "rush" && d.humans[id - 1]));
  const seg = (key, options, value, label, off = []) => `<div class="sh-seg" role="radiogroup" aria-label="${esc(label)}">${options.map(([v, l]) =>
    `<button type="button" role="radio" data-set="${key}:${v}" data-k="${key}:${v}" ${key === "mode" ? `data-mode="${v}"` : ""} ${key === "board" ? `data-board="${v}"` : ""} aria-checked="${String(v) === String(value)}" class="${String(v) === String(value) ? "on" : ""}"${off.includes(v) ? " disabled" : ""}>${l}</button>`).join("")}</div>`;
  const stepper = (key, value, min, max, label) => `<div class="sh-stepper" data-stepper="${key}" data-min="${min}" data-max="${max}" role="group" aria-label="${esc(label)}">
      <button type="button" data-step="-1" data-k="${key}:-" aria-label="Decrease" ${value <= min ? "disabled" : ""}>&minus;</button><output aria-live="polite">${value}</output><button type="button" data-step="1" data-k="${key}:+" aria-label="Increase" ${value >= max ? "disabled" : ""}>+</button></div>`;
  const sw = (action, on, label) => `<button type="button" class="sh-switch${on ? " on" : ""}" role="switch" aria-checked="${on}" data-action="${action}" data-k="${action}" aria-label="${esc(label)}"><i></i></button>`;
  const botCount = () => botSeats().length;
  const levelSummary = () => (d.botStyleMode === "each" ? "A level per bot" : levelName(d.allPreset));
  const rulesSummary = () => [sea() ? "14 points" : `${d.winPoints} points`, `${d.dice === "deck" ? "event deck" : d.dice} dice`,
    1 + d.humans.slice(0, d.numBots).filter((h) => h && d.mode !== "rush").length > 1 ? "friend on this phone" : ""].filter(Boolean).join(", ");

  const avatars = () => P.slice(1).map((cfg, i) => {
    const id = i + 1, on = id <= d.numBots, offSea = sea() && id > SEA_MAX_BOTS;
    return `<button type="button" class="sh-bot pc-${id}${on ? " on" : ""}" data-bot="${id}" data-k="bot${id}" aria-pressed="${on}" ${offSea ? "disabled" : ""} aria-label="${esc(cfg.name)}">${avatarSvg(id, "sh-bot-av")}<span class="sh-bot-n">${esc(cfg.name)}</span></button>`;
  }).join("");

  const mainHtml = () => {
    const lv = d.botStyleMode === "all" ? d.allPreset : "";
    const inMain = LEVELS.some(([k]) => k === lv);
    const hot = D.hotseatOn(d);
    const nBots = botCount();
    return `
      <section class="sh-sec"><h3 class="sh-lab">Type</h3>
        <div class="sh-tiles">
          <button type="button" class="sh-tile${d.mode === "classic" ? " on" : ""}" data-set="mode:classic" data-mode="classic" data-k="mode:classic" aria-pressed="${d.mode === "classic"}"><b>Classic</b><small>Take turns</small></button>
          <button type="button" class="sh-tile${d.mode === "rush" ? " on" : ""}" data-set="mode:rush" data-mode="rush" data-k="mode:rush" aria-pressed="${d.mode === "rush"}"${hot ? " disabled" : ""}><b>Rush</b><small>${hot ? "Classic only with a friend" : "Everyone at once"}</small></button>
        </div></section>
      <section class="sh-sec"><div class="sh-lab-row"><h3 class="sh-lab" id="shOppL">Opponents</h3><span class="sh-chip" aria-live="polite">${nBots === 1 ? "1 bot" : `${nBots} bots`}</span></div>
        <div class="sh-bots" role="group" aria-labelledby="shOppL">${avatars()}</div>
        ${sea() ? `<p class="sh-help">Seafarers is a 3–4 player scenario.</p>` : bigN(d.numBots) ? `<p class="sh-help">${d.numBots + 1} players: the bigger island and a build window between turns.</p>` : ""}</section>
      <section class="sh-sec"><h3 class="sh-lab">Level</h3>
        ${seg("level", LEVELS, inMain ? lv : "", "Bot level")}
        ${inMain ? "" : `<p class="sh-help">Now: <b>${esc(levelSummary())}</b></p>`}
        <button type="button" class="sh-row sh-row-link" data-action="levels" data-k="levels"><span class="sh-row-t"><b>More levels and a level per bot</b><small>${esc(`${allKeys().length} levels, up to Grandmaster`)}</small></span>${CHEV}</button></section>
      <section class="sh-sec"><h3 class="sh-lab">Map</h3>
        ${mapCardsHtml(d.board, d.numBots + 1, (id) => `data-set="board:${id}" data-board="${id}" data-k="board:${id}"`)}</section>
      <section class="sh-sec"><div class="sh-row sh-row-sw"><span class="sh-row-t" id="shExpT"><b>Explain the set-up</b><small>On until you have finished your first game</small></span>${sw("explain", explainOn(game), "Explain the set-up")}</div>
        <button type="button" class="sh-row sh-row-link" data-action="more" data-k="more"><span class="sh-row-ic" aria-hidden="true">${oicon("sliders")}</span><span class="sh-row-t"><b>More rules</b><small>${esc(rulesSummary())}</small></span>${CHEV}</button></section>`;
  };

  // pass & play seats (Classic only): the same controls and names as before, now inside More rules
  const seatRows = () => P.slice(0, d.numBots + 1).map((cfg, id) => {
    const human = id === 0 || (d.mode !== "rush" && d.humans[id - 1]);
    const hot = D.hotseatOn(d);
    const taken = d.names.filter((n, i) => i !== id && i <= d.numBots && (i === 0 || (d.mode !== "rush" && d.humans[i - 1])));
    const chips = hot && human ? D.Names.suggest([...taken, d.names[id]], 4) : [];
    const def = id === 0 ? "Your name" : "Name";
    const kind = id === 0 ? `<div class="hs-kind" aria-label="Person"><button type="button" class="on fixed" tabindex="-1">Human</button></div>`
      : `<div class="hs-kind" role="radiogroup" aria-label="${esc(cfg.name)}: bot or person">
          <button type="button" role="radio" data-kind="bot" data-seat="${id}" data-k="kind${id}b" class="${human ? "" : "on"}" aria-checked="${!human}">Bot</button>
          <button type="button" role="radio" data-kind="human" data-seat="${id}" data-k="kind${id}h" class="${human ? "on" : ""}" aria-checked="${human}"${d.mode === "rush" ? ` disabled title="Pass &amp; play is Classic only"` : ""}>Human</button></div>`;
    const main = human
      ? (hot ? `<input class="hs-name-in" data-name="${id}" value="${esc(d.names[id] || "")}" placeholder="${esc(def)}" maxlength="14" aria-label="Name for seat ${id + 1}" autocomplete="off" spellcheck="false">${chips.length ? `<div class="hp-chips" role="group" aria-label="Remembered names">${chips.map((n) => `<button type="button" class="hp-chip" data-chip="${id}" data-n="${esc(n)}">${esc(n)}</button>`).join("")}</div>` : ""}` : `<div class="hs-seat-name">You</div>`)
      : `<div class="hs-seat-name">${esc(cfg.name)}</div>`;
    return `<div class="hs-seat pc-${id}">${avatarSvg(id, "ng-bot-avatar")}<div class="hs-seat-main">${main}</div>${kind}</div>`;
  }).join("");

  const rulesHtml = () => {
    const rush = d.mode === "rush";
    const limit = D.discardLimitFor(d);
    return `<header class="sh-sheet-head sh-layer-head"><button type="button" class="sh-x sh-back" data-action="back" aria-label="Back">${BACK}</button><h2 id="shMoreT" tabindex="-1">More rules</h2></header>
      <div class="sh-sheet-body">
        <section class="sh-sec"><h3 class="sh-lab">Points to win</h3>
          ${sea() ? `<p class="sh-help">14 points in the Seafarers scenario.</p>` : stepper("winPoints", d.winPoints, 5, 15, "Points to win")}</section>
        <section class="sh-sec"><h3 class="sh-lab">Dice</h3>
          ${seg("dice", [["random", "Random"], ["balanced", "Balanced"], ["deck", "Event deck"]], d.dice, "Dice")}
          <p class="sh-help">${{ random: "Two independent dice, every roll a fresh throw.", balanced: "Real dice odds, but long streaks and droughts are smoothed out.", deck: "All 36 dice results drawn from a deck, reshuffled when empty." }[d.dice]}</p></section>
        <section class="sh-sec"><h3 class="sh-lab">Board layout</h3>
          ${seg("map", [["random", "Random"], ["balanced", "Balanced"], ["beginner", "Beginner (fixed)"]], d.map, "Board layout")}
          <p class="sh-help">${D.isBigTable(d.numBots + 1) && d.map === "beginner" ? "There is no official 5–6 player starter layout, so you get a balanced island." : { random: "Tiles and numbers shuffled freely.", balanced: "No adjacent 6/8 or equal numbers, every resource on fair numbers.", beginner: "The official fixed starter layout." }[d.map]}</p></section>
        <section class="sh-sec"><div class="sh-row sh-row-sw"><span class="sh-row-t"><b>Friendly robber</b><small>Can't block or rob players with 2 points or fewer</small></span>${sw("friendly", d.friendlyRobber, "Friendly robber")}</div></section>
        <section class="sh-sec"><h3 class="sh-lab">Discard limit</h3>
          ${stepper("discardLimit", limit, rush ? D.RUSH_DISCARD_LIMIT : 7, 12, "Discard limit")}
          <p class="sh-help">On a 7, anyone holding more than ${limit} cards discards half.</p></section>
        ${rush ? `<section class="sh-sec"><h3 class="sh-lab">Roll every</h3>${seg("rushInterval", D.RUSH_INTERVALS.map((s) => [s, `${s}s`]), d.rushInterval, "Roll every")}</section>` : ""}
        <section class="sh-sec"><h3 class="sh-lab">Friend on this phone</h3>
          <div class="hs-seats">${seatRows()}</div>
          <p class="hs-help">${D.hotseatOn(d) ? `${1 + d.humans.slice(0, d.numBots).filter(Boolean).length} people share this phone${D.Names.list().length ? ` · <button type="button" class="hp-link" data-action="names">Names</button>` : ""}` : "Tap Human to play with a friend on this phone (Classic only)."}</p></section>
      </div>
      <footer class="sh-sheet-foot"><button type="button" class="btn primary block" data-action="back">Done</button></footer>`;
  };

  const levelsHtml = () => {
    const keys = allKeys();
    const each = d.botStyleMode === "each";
    const seats = botSeats();
    return `<header class="sh-sheet-head sh-layer-head"><button type="button" class="sh-x sh-back" data-action="back" aria-label="Back">${BACK}</button><h2 id="shLvT" tabindex="-1">Levels</h2></header>
      <div class="sh-sheet-body">
        <section class="sh-sec">${seg("styleMode", [["all", "All bots"], ["each", "Each bot separately"]], d.botStyleMode, "Style for")}</section>
        ${each ? `<section class="sh-sec sh-each">${seats.length ? seats.map((id) => `<label class="sh-each-row pc-${id}">${avatarSvg(id, "sh-bot-av")}<span class="sh-each-n">${esc(P[id].name)}</span>
            <select data-bot-level="${id - 1}" data-k="lv${id}" aria-label="${esc(P[id].name)} level">${keys.map((k) => `<option value="${k}"${d.perBot[id - 1] === k ? " selected" : ""}>${esc(levelName(k))}</option>`).join("")}</select></label>`).join("") : `<p class="sh-help">No bots at this table.</p>`}</section>`
        : `<section class="sh-sec"><div class="sh-levels" role="radiogroup" aria-label="Level for all bots">${keys.map((k) => `<button type="button" role="radio" class="sh-level${d.allPreset === k ? " on" : ""}" data-level="${k}" data-k="lvl:${k}" aria-checked="${d.allPreset === k}"><b>${esc(levelName(k))}</b><small>${esc(D.AI_PRESET_INFO[k]?.tagline || "")}</small></button>`).join("")}</div></section>`}
      </div>
      <footer class="sh-sheet-foot"><button type="button" class="btn primary block" data-action="back">Done</button></footer>`;
  };

  const render = () => {
    const sc = wrap.querySelector(".sh-main .sh-sheet-body")?.scrollTop || 0;
    const lsc = wrap.querySelector(".sh-layer .sh-sheet-body")?.scrollTop || 0;
    wrap.innerHTML = `<div class="sh-sheet" role="document">
      <div class="sh-main"><div class="sh-grab" aria-hidden="true"></div>
        <header class="sh-sheet-head"><h2 id="shNgT" tabindex="-1">New game</h2><button type="button" class="sh-x" data-action="cancel" aria-label="Close">${oicon("close")}</button></header>
        <div class="sh-sheet-body">${mainHtml()}</div>
        <footer class="sh-sheet-foot"><button type="button" class="btn primary block ng-start" data-action="start">Start game</button></footer></div>
      ${layer ? `<div class="sh-layer sh-more${enter ? " enter" : ""} open" data-layer="${layer}" role="dialog" aria-modal="true" aria-labelledby="${layer === "rules" ? "shMoreT" : "shLvT"}">${layer === "rules" ? rulesHtml() : levelsHtml()}</div>` : ""}
    </div>`;
    enter = false;
    const m = wrap.querySelector(".sh-main .sh-sheet-body"); if (m) m.scrollTop = sc;
    const l = wrap.querySelector(".sh-layer .sh-sheet-body"); if (l) l.scrollTop = lsc;
    if (layer) wrap.querySelector(".sh-main")?.setAttribute("inert", "");
    if (focusKey) { const f = wrap.querySelector(`[data-k="${focusKey}"]`); focusKey = ""; f?.focus({ preventScroll: true }); }
  };

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); layer ? goBack() : close(); }
    else if (e.key === "Tab") { // focus trap
      const root = wrap.querySelector(".sh-layer") || wrap.querySelector(".sh-main");
      const f = [...root.querySelectorAll("button:not([disabled]), input, select")].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  };
  const trigger = document.activeElement;
  // v1.99.1: every choice is saved the moment it is picked (leaving the sheet before Start used to drop Master / 8 points); a friend game's one-off overrides are not
  const persist = () => { if (!friend) { try { D.saveLast?.(d); } catch (_) { /* private mode */ } } };
  const closeEls = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const close = (started = false) => {
    if (!wrap.isConnected) return;
    wrap.classList.add("closing");
    const done = () => {
      closeEls();
      game.uiPaused = false;
      game._rushLastTs = performance.now();
      if (!started && game.onboardingHold && !game.home.open) game.home.show(); // opened from a game kept behind Home
      if (!started && game.home?.open) game.home.render(); // the chips show what was picked
      if (!started) try { trigger?.focus?.({ preventScroll: true }); } catch (_) { /* gone */ }
    };
    if (started || document.documentElement.dataset.motion === "reduced") done(); else window.setTimeout(done, 190);
  };
  wrap._close = close;
  const goBack = () => { const was = layer; layer = ""; focusKey = was === "rules" ? "more" : "levels"; render(); };
  const start = () => {
    if (D.hotseatOn(d)) {
      const seen = [];
      d.names = d.names.map((n, i) => {
        if (i > d.numBots || !(i === 0 || d.humans[i - 1])) return n;
        let v = D.cleanName(n) || `Player ${i + 1}`;
        if (seen.some((x) => D.sameName(x, v))) v = `${v.slice(0, 12)} ${i + 1}`;
        seen.push(v);
        return v;
      });
      D.Names.remember(seen);
    }
    close(true);
    game.startNewGame(d);
  };

  const set = (key, raw) => {
    if (key === "mode") setModeD(d, raw);
    else if (key === "level") { d.botStyleMode = "all"; d.allPreset = raw; if (D.AI_PRESETS[raw]) d.allStrategy = { ...D.AI_PRESETS[raw] }; }
    else if (key === "board") setBoardD(game, D, d, raw);
    else if (key === "styleMode") d.botStyleMode = raw === "each" ? "each" : "all";
    else if (key === "dice" || key === "map") d[key] = raw;
    else if (key === "rushInterval") d.rushInterval = Number(raw);
  };
  const bigAdjust = (prev) => bigAdjustD(D, d, prev);

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) { layer ? goBack() : close(); return; }
    const t = e.target.closest("button");
    if (!t || !wrap.contains(t)) return;
    focusKey = t.dataset.k || "";
    let changed = true;
    const a = t.dataset.action;
    if (t.dataset.set) { const i = t.dataset.set.indexOf(":"); set(t.dataset.set.slice(0, i), t.dataset.set.slice(i + 1)); }
    else if (t.dataset.bot) { // opponents are the first N seats: tapping a seat sets the table to that seat (min 1 bot)
      const id = Number(t.dataset.bot), prev = d.numBots;
      d.numBots = clampN(id <= d.numBots ? id - 1 : id, 1, maxBots());
      bigAdjust(prev);
    } else if (t.dataset.level) { set("level", t.dataset.level); }
    else if (t.dataset.step) {
      const box = t.closest("[data-stepper]"), key = box.dataset.stepper;
      if (key === "discardLimit") d[key] = D.discardLimitFor(d);
      d[key] = clampN(d[key] + Number(t.dataset.step), Number(box.dataset.min), Number(box.dataset.max));
    } else if (t.dataset.kind) {
      d.humans = d.humans.map((h, i) => (i === Number(t.dataset.seat) - 1 ? t.dataset.kind === "human" : h));
      if (D.hotseatOn(d)) { d.mode = "classic"; if (!d.names[0] && D.Names.me()) d.names = d.names.map((n, i) => (i === 0 ? D.Names.me() : n)); }
    } else if (t.dataset.chip) d.names = d.names.map((n, i) => (i === Number(t.dataset.chip) ? t.dataset.n : n));
    else if (a === "names") { D.openNamesSheet({ onRename: (x, y) => { d.names = d.names.map((n) => (D.sameName(n, x) ? y : n)); game.histRenameName?.(x, y); }, onChange: () => render() }); changed = false; }
    else if (a === "friendly") d.friendlyRobber = !d.friendlyRobber;
    else if (a === "explain") setExplain(!explainOn(game));
    else if (a === "more") { layer = "rules"; enter = true; focusKey = ""; }
    else if (a === "levels") { layer = "levels"; enter = true; focusKey = ""; }
    else if (a === "back") { goBack(); return; }
    else if (a === "cancel") { close(); return; }
    else if (a === "start") { start(); return; }
    else changed = false;
    if (changed) { persist(); game.sfx?.click?.(); render(); if (layer && enter === false && !focusKey) wrap.querySelector(layer === "rules" ? "#shMoreT" : "#shLvT")?.focus({ preventScroll: true }); }
  });
  wrap.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-name]");
    if (inp) { d.names = d.names.map((n, i) => (i === Number(inp.dataset.name) ? inp.value.slice(0, 14) : n)); persist(); }
  });
  wrap.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-bot-level]");
    if (sel) { d.perBot = d.perBot.map((p, i) => (i === Number(sel.dataset.botLevel) ? sel.value : p)); focusKey = sel.dataset.k; persist(); render(); }
  });
  // swipe down on the grab bar / header closes the sheet
  let y0 = null;
  wrap.addEventListener("pointerdown", (e) => { if (e.target.closest(".sh-grab, .sh-sheet-head") && !e.target.closest("button") && !layer) y0 = e.clientY; });
  wrap.addEventListener("pointerup", (e) => { if (y0 != null && e.clientY - y0 > 70) close(); y0 = null; });
  wrap.addEventListener("pointercancel", () => { y0 = null; });

  document.addEventListener("keydown", onKey);
  render();
  document.body.appendChild(wrap);
  wrap.querySelector("#shNgT")?.focus({ preventScroll: true });
  return wrap;
}
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ───────────────────────────── Pause sheet ─────────────────────────────
/** The in-game menu: bot speed and five ways out. opts: { onIntro, onStats, onSettings, onNewGame, onHome, onCheck } */
export class GameMenu {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.el = null;
    this.onKey = (e) => { if (e.key === "Escape") this.close(); };
  }
  get open() { return !!this.el; }
  show() {
    this.close();
    const g = this.game;
    const el = document.createElement("div");
    el.className = "menu-sheet sh-sheet-wrap sh-pause tm-modal";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "shPauseT");
    const sr = g.speedRange;
    const fast = sr ? Number(sr.value) >= 70 : true;
    const statsOk = !!(g.liveStatsAvailable?.() && !g._lsNeedsBoard?.());
    const row = (k, ic, t, sub, off = false) => `<button type="button" class="sh-row sh-row-pause" data-menu="${k}"${off ? ` disabled aria-disabled="true"` : ""}><span class="sh-row-ic" aria-hidden="true">${ic}</span><span class="sh-row-t"><b>${t}</b><small>${sub}</small></span>${CHEV}</button>`;
    el.innerHTML = `<div class="sh-sheet sh-sheet-pause" role="document"><div class="sh-grab" aria-hidden="true"></div>
      <header class="sh-sheet-head"><h2 id="shPauseT" tabindex="-1">Pause</h2><button type="button" class="sh-x" data-menu-x aria-label="Close">${oicon("close")}</button></header>
      <div class="sh-sheet-body">
        ${sr ? `<div class="sh-speed"><div class="sh-lab-row"><h3 class="sh-lab">Bots</h3>${g._botLevelLabel?.() ? `<span class="sh-chip">${esc(g._botLevelLabel())}</span>` : ""}</div>
          <div class="sh-speed-row"><span id="shSpT">Bot speed</span><div class="sh-seg sh-seg-sm" role="radiogroup" aria-labelledby="shSpT"><button type="button" role="radio" data-speed="slow" aria-checked="${!fast}" class="${fast ? "" : "on"}">Slow</button><button type="button" role="radio" data-speed="fast" aria-checked="${fast}" class="${fast ? "on" : ""}">Fast</button></div></div></div>` : ""}
        <div class="sh-rows">
          ${row("intro", oicon("book"), "Explain", "Numbers, ports, robber")}
          ${row("stats", oicon("bars"), "Standings and stats", "Dice, points and income", !statsOk)}
          ${row("settings", oicon("settings"), "Settings", "Sound, colours, language")}
          ${row("newgame", oicon("dice"), "New game", "Your current game is kept")}
          ${row("home", oicon("home"), "To start", "Your game is saved")}
        </div>
      </div></div>`;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-menu-x]")) this.close(); });
    const go = { intro: "onIntro", stats: "onStats", settings: "onSettings", newgame: "onNewGame", home: "onHome" };
    el.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => { const fn = this.opts[go[b.dataset.menu]]; this.close(true); fn?.(); }));
    el.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
      if (!sr) return;
      sr.value = b.dataset.speed === "slow" ? 40 : 93;
      sr.dispatchEvent(new Event("input", { bubbles: true })); sr.dispatchEvent(new Event("change", { bubbles: true }));
      el.querySelectorAll("[data-speed]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
    }));
    let y0 = null;
    el.addEventListener("pointerdown", (e) => { if (e.target.closest(".sh-grab, .sh-sheet-head") && !e.target.closest("button")) y0 = e.clientY; });
    el.addEventListener("pointerup", (e) => { if (y0 != null && e.clientY - y0 > 70) this.close(); y0 = null; });
    document.addEventListener("keydown", this.onKey);
    this.trigger = document.activeElement;
    document.body.appendChild(el);
    this.el = el;
    el.querySelector("#shPauseT")?.focus({ preventScroll: true });
  }
  close(navigating = false) {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    document.removeEventListener("keydown", this.onKey);
    if (!navigating) try { this.trigger?.focus?.({ preventScroll: true }); } catch (_) { /* gone */ }
  }
}
