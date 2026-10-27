// Home screen (shown on every launch and via Menu › Home) and the in-game Menu sheet.
// Home: Continue (when a game is saved) · New game: Classic / Rush tiles that start at once with the
// chosen opponents and bot level · More settings (full New game screen) · How to play · Settings.
import { icon } from "./manager.js";

const MENU_IC = `<svg class="ic ic-menu" viewBox="-50 -50 100 100" aria-hidden="true"><path d="M-30 -22H30M-30 0H30M-30 22H30" stroke="currentColor" stroke-width="9" stroke-linecap="round" fill="none"/></svg>`;
const PLAY_IC = `<svg class="hm-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11.5" fill="currentColor" opacity=".2"/><path d="M9.6 7.4v9.2l7.4-4.6z" fill="currentColor"/></svg>`;
const CLOCK_IC = `<svg class="ic hm-clock" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="26.5" r="16.5" fill="#FFD25A" stroke="#7A4B12" stroke-width="3"/><path d="M24 16v10.5l6.5 4.5" stroke="#7A4B12" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M19 5.5h10M24 5.5v4" stroke="#7A4B12" stroke-width="3.4" stroke-linecap="round"/></svg>`;
const SLIDERS_IC = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="15" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="9" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
const BOOK_IC = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5c3-1.4 5.8-1.2 8.5.8v13c-2.7-2-5.5-2.2-8.5-.8zM20.5 5.5c-3-1.4-5.8-1.2-8.5.8v13c2.7-2 5.5-2.2 8.5-.8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="none"/></svg>`;
/** A theme may draw its own version of these glyphs (Silhouette does): use its sprite icon when it has one. */
const themed = (game, k, fallback, cls = "") => (game?.theme?.icons?.[k] ? icon(k, cls) : fallback);
const INFO_IC = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.4" fill="currentColor"/></svg>`;
const LAB_IC = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3l-5.5-9.5V3.5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" fill="none"/><circle cx="10" cy="16" r="1.3" fill="currentColor"/><circle cx="13.6" cy="14" r="1" fill="currentColor"/></svg>`;
const CHEV = `<span class="hm-chev" aria-hidden="true">›</span>`;

export const LEVELS = [["beginner", "Easy"], ["intermediate", "Medium"], ["expert", "Hard"]];

function seg(name, label, items, on, off = []) {
  return `<div class="hm-seg" role="radiogroup" aria-label="${label}">${items.map(([v, l, aria]) =>
    `<button type="button" role="radio" data-${name}="${v}" aria-checked="${String(v) === String(on)}" class="${String(v) === String(on) ? "on" : ""}"${aria ? ` aria-label="${aria}"` : ""}${off.includes(v) ? " disabled" : ""}>${l}</button>`).join("")}</div>`;
}
// Opponents 1–5; 4–5 bots play the 5–6 player game (bigger island, build between turns)
const MAX_BOTS = 5;
const BIG_FROM_BOTS = 4;
// ⚓ Seafarers (Heading for New Shores) is a 3–4 player scenario: at most 3 bots on that map
const SEA_MAX_BOTS = 3;
const BIG_RUSH_SECONDS = 20;

export class Home {
  /**
   * opts: { saved(): null | { mode, turn, players: [{ name, vp, seat }] }, last(): settings,
   *         onContinue(), onStart({ mode, numBots, preset }), onMore(), onIntro(), onSettings(), introSeen() }
   */
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.el = null;
    this.pick = null;
    this.onKey = (e) => {
      if (e.key === "Enter" && e.target === document.body && this.opts.saved()) this.opts.onContinue();
    };
  }

  get open() { return !!this.el; }

  show() {
    const last = this.opts.last();
    const custom = last.botStyleMode === "each" || !LEVELS.some(([k]) => k === last.allPreset);
    this.pick = { numBots: Math.min(last.numBots || 3, last.board === "seafarers" ? SEA_MAX_BOTS : MAX_BOTS), preset: custom ? "custom" : last.allPreset, rushInterval: last.rushInterval || 15, board: last.board === "seafarers" ? "seafarers" : "island" }; // ⚓ board
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.className = "home";
      this.el.setAttribute("role", "dialog");
      this.el.setAttribute("aria-modal", "true");
      this.el.setAttribute("aria-label", "Colonist home");
      document.addEventListener("keydown", this.onKey);
      document.body.appendChild(this.el);
      document.body.classList.add("home-open");
    }
    this.render();
  }

  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    document.body.classList.remove("home-open");
    document.removeEventListener("keydown", this.onKey);
  }

  render() {
    const s = this.opts.saved();
    const p = this.pick;
    const sea = p.board === "seafarers";
    const lvl = (LEVELS.find(([k]) => k === p.preset) || [, "Custom"])[1];
    const vs = `vs ${p.numBots} bot${p.numBots > 1 ? "s" : ""} · ${lvl}${p.board === "seafarers" ? " · Seafarers" : ""}`;
    const levels = p.preset === "custom" ? [...LEVELS, ["custom", "Custom"]] : LEVELS;
    const fresh = !this.opts.introSeen();
    this.el.classList.toggle("has-save", !!s);
    this.el.innerHTML = `<div class="hm-col">
      <header class="hm-brand"><svg class="hm-logo" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-logo" x="-50" y="-50" width="100" height="100"/></svg>
        <h1>Colonist</h1>${s ? "" : `<p>Settle the island, trade with friendly bots, reach 10 points first.</p>`}</header>
      ${s ? `<button type="button" class="hm-continue" data-home="continue">${PLAY_IC}<span class="hm-ct"><b>Continue game</b><small>${s.mode} · ${s.mode.startsWith("Rush") ? "roll" : "turn"} ${s.turn}</small></span>${CHEV}
        <span class="hm-score">${s.players.map((q) => `<span class="pc-${q.seat}" title="${q.name}: ${q.vp} points"><i></i><em class="nm">${q.name}</em><em class="ini" aria-hidden="true">${q.name.slice(0, 1)}</em> <b>${q.vp}</b></span>`).join("")}</span></button>` : ""}
      <section class="hm-card hm-new" aria-labelledby="hmNewH">
        <h2 class="hm-h" id="hmNewH">${s ? "Start a new game" : "Choose a game"}</h2>
        <div class="hm-tiles">
          <button type="button" class="hm-tile" data-mode="classic">${icon("dice")}<b>Classic</b><small>Take turns at your own pace</small><span class="hm-vs">${vs}</span></button>
          <button type="button" class="hm-tile" data-mode="rush">${themed(this.game, "clock", CLOCK_IC, "hm-clock")}<b>Rush</b><small>Everyone plays at once, dice every ${p.numBots >= BIG_FROM_BOTS ? Math.max(p.rushInterval, BIG_RUSH_SECONDS) : p.rushInterval}s</small><span class="hm-vs">${vs}</span></button>
        </div>
        <div class="hm-row"><span>Opponents</span>${seg("bots", "Opponents", Array.from({ length: MAX_BOTS }, (_, i) => [i + 1, String(i + 1), `${i + 1} bot${i ? "s" : ""}`]), p.numBots, sea ? [4, 5] : [])}</div>
        ${!sea && p.numBots >= BIG_FROM_BOTS ? `<p class="hm-cap">${p.numBots + 1} players · bigger island · build between turns</p>` : ""}
        <div class="hm-row"><span>Bots play</span>${seg("level", "Bot level", levels, p.preset)}</div>
        <div class="hm-row hm-map"><span>Map</span>${seg("board", "Map", [["island", "Island"], ["seafarers", "Seafarers"]], p.board)}</div>
        ${sea ? `<p class="hm-note">Heading for New Shores · 14 points · <span class="hm-seacap">up to 4 players</span></p>` : ""}
      </section>
      <nav class="hm-card hm-list" aria-label="More">
        <button type="button" data-home="more">${themed(this.game, "sliders", SLIDERS_IC)}<span>More settings<small>Rules, map, bots · play with friends</small></span>${CHEV}</button>
        <button type="button" data-home="intro" class="${fresh ? "fresh" : ""}">${themed(this.game, "book", BOOK_IC)}<span>How to play${fresh ? `<small>New here? 3 short cards</small>` : ""}</span>${CHEV}</button>
        <div class="hm-pair"><button type="button" data-home="settings">${icon("settings")}<span>Settings</span>${CHEV}</button>
        <a class="hm-lab" href="./lab.html" data-home="lab" title="See how the bots score the board">${LAB_IC}<span>AI Lab</span>${CHEV}</a></div>
      </nav>
    </div>`;
    const on = (sel, fn) => this.el.querySelectorAll(sel).forEach((b) => b.addEventListener("click", fn));
    on("[data-home='continue']", () => this.opts.onContinue());
    on(".hm-tile", (e) => this.opts.onStart({ mode: e.currentTarget.dataset.mode, numBots: p.numBots, preset: p.preset, board: p.board }));
    on("[data-board]", (e) => { p.board = e.currentTarget.dataset.board === "seafarers" ? "seafarers" : "island";
      // ⚓ 4–5 bots → 3 on Seafarers; back on the island the earlier count returns
      if (p.board === "seafarers" && p.numBots > SEA_MAX_BOTS) { p.botsIsland = p.numBots; p.numBots = SEA_MAX_BOTS; }
      else if (p.board === "island" && p.botsIsland) { p.numBots = p.botsIsland; p.botsIsland = 0; } this.render(); this.el.querySelector(`[data-board="${p.board}"]`)?.focus(); }); // ⚓
    on("[data-bots]", (e) => { p.numBots = Number(e.currentTarget.dataset.bots); this.render(); this.el.querySelector(`[data-bots="${p.numBots}"]`)?.focus(); });
    on("[data-level]", (e) => { p.preset = e.currentTarget.dataset.level; this.render(); this.el.querySelector(`[data-level="${p.preset}"]`)?.focus(); });
    on("[data-home='more']", () => this.opts.onMore());
    on("[data-home='intro']", () => this.opts.onIntro());
    on("[data-home='settings']", () => this.opts.onSettings());
  }
}

/** The in-game Menu (dock button on phones, top bar on desktop): Home · New game · Settings · How to play · About. */
const STATS_IC = `<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M3 11h3v6H3zM8.5 4h3v13h-3zM14 8h3v9h-3z"/></svg>`;

export class GameMenu {
  /** opts: { onHome(), onNewGame(), onSettings(), onIntro(), onAbout() } */
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.el = null;
    this.onKey = (e) => { if (e.key === "Escape") this.close(); };
  }

  get open() { return !!this.el; }

  show() {
    this.close();
    const el = document.createElement("div");
    el.className = "menu-sheet tm-modal";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Menu");
    const item = (k, ic, label, sub = "") => `<button type="button" data-menu="${k}">${ic}<span>${label}${sub ? `<small>${sub}</small>` : ""}</span></button>`;
    el.innerHTML = `<div class="mn-card">
      <div class="mn-head"><h2>${themed(this.game, "menu", MENU_IC, "ic-menu")}Menu</h2><button type="button" class="btn ghost icon-only mn-close" aria-label="Close">${icon("close")}</button></div>
      <div class="mn-list">
        ${item("home", `<svg class="ic" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-logo" x="-50" y="-50" width="100" height="100"/></svg>`, "Home", this.game.winner ? "" : "Your game is saved")}
        ${this.game.liveStatsAvailable?.() && !this.game._lsNeedsBoard?.() ? item("stats", STATS_IC, "Stats", "Dice, points and income so far") : ""}
        ${item("newgame", icon("dice"), "New game", "Mode, rules and opponents")}
        ${item("settings", icon("settings"), "Settings", "Sound, bot speed, look")}
        ${item("intro", themed(this.game, "book", BOOK_IC), "How to play")}
        ${item("about", themed(this.game, "info", INFO_IC), "About")}
      </div></div>`;
    el.addEventListener("click", (e) => { if (e.target === el) this.close(); });
    el.querySelector(".mn-close").addEventListener("click", () => this.close());
    const go = { stats: "onStats", home: "onHome", newgame: "onNewGame", settings: "onSettings", intro: "onIntro", about: "onAbout" };
    el.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => { const fn = this.opts[go[b.dataset.menu]]; this.close(); fn?.(); }));
    document.addEventListener("keydown", this.onKey);
    document.body.appendChild(el);
    this.el = el;
    el.querySelector("[data-menu]")?.focus({ preventScroll: true });
  }

  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    document.removeEventListener("keydown", this.onKey);
  }
}
