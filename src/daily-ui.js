// v1.99.5 DAILY PUZZLE screens (spec: docs/design/dagpuzzel.md, docs/design/start-en-navigatie.md 1.1-1.5, 2.1-2.2). Strings are English, the localizer turns them
// into Dutch (patterns in src/i18n-nl-199.js); dates and the share text are made in the language directly.
//   cardHtml()  the gold card (Home and the tab)   tabHtml()  the Dagpuzzel tab   bind(root)  its taps
//   finish(rec) a run ended -> record, result screen, the smart bot   sheets: intro, gate, already played, late run, update, give up, share, compare
import { oicon } from "./ui-icons.js";
import { avatarChar } from "./themes/manager.js";
import { toast } from "./toast.js";
import { isNL } from "./i18n.js";
import * as D from "./daily.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const q = (s, r = document) => r.querySelector(s);
const SUN = `<svg class="dl-sun" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"/></svg>`;
const ICON = {
  back: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5 7.5 12l7 7"/></svg>`,
  share: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5h14V12"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>`,
  retry: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4.2h4.2"/></svg>`,
  chev: `<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,
  users: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-5.6 6-5.6s6 2 6 5.6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.6c2 .6 3.4 2.3 3.4 5.4"/></svg>`,
};
const NAMES = ["Roodhart", "Blaauw", "Geelen", "Groen", "De Wit", "Pimpel"];
const TERRAIN = { wood: ["#5E9A55", "#457A42"], sheep: ["#B8D57A", "#97B95C"], wheat: ["#EDC25E", "#D3A341"], brick: ["#E07E5A", "#C0623F"], ore: ["#93A2B4", "#728399"], desert: ["#F0DAA8", "#DCBF85"] };

export class DailyUi {
  constructor(game) {
    this.game = game; this.screen = null; this.sheet = null; this.boards = new Map(); this.botJobs = new Map(); this.month = null; this.day0 = null;
    if (typeof document === "undefined") return;
    this.timer = window.setInterval(() => this.tick(), 20000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.tick(); });
  }
  nl() { return isNL(); }
  today() { return D.dayIdOf(); }
  label(day) { return D.dayLabel(day, this.nl()); }
  days() { return D.loadDays(); }
  state() { return D.stateOf(this.today(), this.days()); }

  // ── the clock: the countdown and the midnight in Amsterdam ──
  countdown() { const ms = D.msToNextDay(), m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `New puzzle in ${h} h ${m % 60} min` : `New puzzle in ${m} min`; }
  tick() {
    const t = this.today();
    if (this.day0 != null && t !== this.day0) { this.day0 = t; const h = this.game.home; if (h?.open && !this.screen && !this.sheet) { h.render(); h.chrome?.sync(); } }
    else document.querySelectorAll("[data-dl-count]").forEach((e) => { e.textContent = this.countdown(); });
  }
  sync() { this.strip(); this.game.home?.chrome?.sync?.(); }
  /** The dot on the Dagpuzzel tab: today is not played (and not behind the first-game gate). */
  badge() { const s = this.state(); return (s === "open" || s === "busy" || s === "late") && !this.gate(); }
  gate() { const n = this.game.home?.opts?.historyCount?.(); return n === 0; }
  hidesResume() { return D.stateOf(this.today(), this.days()) === "busy" || this.state() === "late"; }

  // ── the day's board as a small picture ──
  boardSvg(day, size = 84) {
    let hexes = this.boards.get(day);
    if (!hexes) { try { hexes = this.game.constructor.dailyBoard(day); } catch (_) { hexes = []; } this.boards.set(day, hexes); }
    if (!hexes.length) return `<svg viewBox="0 0 10 10" width="${size}" height="${size}" aria-hidden="true"></svg>`;
    const R = 10, W = Math.sqrt(3) * R, pts = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return `${(cx + R * 0.97 * Math.cos(a)).toFixed(1)},${(cy + R * 0.97 * Math.sin(a)).toFixed(1)}`; }).join(" ");
    const P = hexes.map((h) => ({ ...h, x: W * (h.q + h.r / 2), y: 1.5 * R * h.r }));
    const x0 = Math.min(...P.map((p) => p.x)) - W / 2, x1 = Math.max(...P.map((p) => p.x)) + W / 2, y0 = Math.min(...P.map((p) => p.y)) - R, y1 = Math.max(...P.map((p) => p.y)) + R;
    return `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}" width="${size}" height="${size}" role="img" aria-label="Board of today">${P.map((p) => { const [f, s] = TERRAIN[p.resource] || TERRAIN.desert;
      return `<polygon points="${pts(p.x, p.y)}" fill="${f}" stroke="${s}" stroke-width="1"/>${p.number ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#FFF9EC"/><text x="${p.x.toFixed(1)}" y="${(p.y + 1.7).toFixed(1)}" text-anchor="middle" font-size="4.8" font-weight="700" fill="${p.number === 6 || p.number === 8 ? "#B3321F" : "#3A3A33"}" font-family="Outfit,system-ui,sans-serif">${p.number}</text>` : ""}`; }).join("")}</svg>`;
  }
  avatars(size = 22) {
    const look = D.dayLook(this.game.constructor.loadLastSettings?.()?.look?.[0] ?? 0);
    const av = (i) => avatarChar(look[i], "dl-av");
    const nm = (i) => NAMES[look[i]];
    return `<span class="dl-vs" data-i18n-skip><b>${this.nl() ? "Jij" : "You"}</b> <i>${this.nl() ? "tegen" : "vs"}</i> ${av(1)}<b>${nm(1)}</b> ${av(2)}<b>${nm(2)}</b></span>`;
  }
  streakChip(day = null) {
    const s = D.streakOf(this.days(), this.today());
    return s.cur > 0 ? `<span class="sh-chip dl-streak" role="img" aria-label="${s.cur} days in a row">${SUN}<span data-i18n-skip>${s.cur} ${this.nl() ? (s.cur === 1 ? "dag" : "dagen") : (s.cur === 1 ? "day" : "days")}</span></span>` : "";
  }

  // ── the gold card ──
  cardHtml(where = "play") {
    const day = this.today(); this.day0 = day;
    const days = this.days(), st = D.stateOf(day, days), run = D.loadRunMeta(), head = (id) => `<div class="dl-top"><span class="dl-eyebrow">Today</span><span class="sh-chip dl-date" data-i18n-skip>${this.label(day)}</span>${this.streakChip()}</div><h2 id="${id}">Daily puzzle</h2>`;
    const id = `dlH-${where}`;
    if (where === "play" && st === "open" && this.gate()) return `<section class="sh-card gold sh-dcard compact" data-dl-card="gate" aria-labelledby="${id}"><div class="dl-top"><span class="dl-eyebrow">Today</span><span class="sh-chip dl-date" data-i18n-skip>${this.label(day)}</span></div><div class="dl-cmp-row"><div class="dl-cmp-tx"><h2 id="${id}">Daily puzzle</h2><p>Play one practice game first</p></div><button type="button" class="btn" data-dl="start-anyway">Play anyway</button></div></section>`;
    if (where === "play" && st === "done") { // played: one compact row (result, countdown, See it) so New game stays in view
      const r = days[day], won = !!r.w, k = D.kindOf(r), label = won ? `Won in ${r.t} turns` : k === "timeup" ? `Time's up, ${r.p[0]} points after ${r.t} turns` : `Lost with ${r.p[0]} points`;
      return `<section class="sh-card gold sh-dcard compact done" data-dl-card="done" aria-labelledby="${id}"><div class="dl-top"><span class="dl-eyebrow">Today</span><span class="sh-chip dl-date" data-i18n-skip>${this.label(day)}</span>${this.streakChip()}</div><h2 id="${id}" class="sr">Daily puzzle</h2>
        <div class="dl-cmp-row"><div class="dl-cmp-tx"><span class="dl-hero" role="img" aria-label="${label}"><b>${won ? r.t : r.p[0]}</b><small>${won ? "turns" : "points"}</small></span><span class="sh-chip dl-status${won ? " won" : ""}">${won ? oicon("check") : k === "timeup" ? oicon("clock") : ""}${won ? "Won" : k === "timeup" ? "Time's up" : "Lost"}</span></div><button type="button" class="btn" data-dl="view" data-day="${day}">See it</button></div>
        <p class="dl-count" data-dl-count aria-live="off">${this.countdown()}</p></section>`;
    }
    let mid = "", btns = "";
    if (st === "done") {
      const r = days[day], bot = r.bot, k = D.kindOf(r), won = !!r.w;
      const hero = won ? `<span class="dl-hero" aria-label="Won in ${r.t} turns"><b>${r.t}</b><small>turns</small></span>` : `<span class="dl-hero" aria-label="${k === "timeup" ? "Time's up" : "Lost"} with ${r.p[0]} points"><b>${r.p[0]}</b><small>points</small></span>`;
      const fast = won && bot > r.t ? `<span class="sh-chip dl-good">${bot - r.t} faster</span>` : "";
      const botLine = won ? (bot === undefined ? `<span class="dl-botline dl-think" data-dl-bot="${day}">Smart bot is thinking</span>` : bot === 0 ? `<span class="dl-botline" data-dl-bot="${day}">Smart bot: lost</span>` : `<span class="dl-botline" data-dl-bot="${day}">Smart bot: ${bot} turns</span>`)
        : `<span class="dl-botline">${k === "timeup" ? "40 turns played, no 10 points" : r.by ? `<span data-i18n-skip>${esc(r.by)} ${this.nl() ? "won op beurt" : "won on turn"} ${r.t}</span>` : ""}</span>`;
      mid = `<div class="dl-done"><span class="sh-chip dl-status${won ? " won" : ""}">${won ? oicon("check") : k === "timeup" ? oicon("clock") : ""}${won ? "Won" : k === "timeup" ? "Time's up" : "Lost"}</span><div class="dl-herorow">${hero}${fast}</div>${botLine}</div>`;
      btns = `<div class="dl-two"><button type="button" class="btn primary" data-dl="share" data-day="${day}">${ICON.share}Share your result</button><button type="button" class="btn" data-dl="view" data-day="${day}">See it</button></div><p class="dl-count" data-dl-count aria-live="off">${this.countdown()}</p>`;
    } else if (st === "busy" || st === "late") {
      const late = st === "late", n = run?.turn || 1;
      mid = `<div class="dl-busy"><span class="sh-chip">In progress</span><b class="dl-turn">Turn ${n} of ${D.TURN_LIMIT}</b>${late ? `<small class="dl-late" data-i18n-skip>${this.label(run.day)}</small>` : ""}<span class="dl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${D.TURN_LIMIT}" aria-valuenow="${n}" aria-label="Turn ${n} of ${D.TURN_LIMIT}"><i style="width:${Math.round(100 * n / D.TURN_LIMIT)}%"></i></span></div>`;
      btns = `<button type="button" class="btn primary block" data-dl="${late ? "late" : "resume"}">${oicon("dice")}Finish it</button>`;
    } else {
      mid = `<div class="dl-open"><span class="dl-same">The same rolls for everyone</span><span class="sh-chip">Not played yet</span></div>`;
      btns = `<button type="button" class="btn primary block" data-dl="${st === "practice" ? "practice-today" : "start"}">${oicon("dice")}${st === "practice" ? "Practise today" : "Play the daily puzzle"}</button>`;
    }
    return `<section class="sh-card gold sh-dcard" data-dl-card="${st}" aria-labelledby="${id}">${head(id)}<div class="dl-mid"><span class="dl-board" role="img" aria-label="Board of today">${this.boardSvg(day)}</span>${mid}</div>${this.avatars()}${btns}</section>`;
  }

  // ── the Dagpuzzel tab ──
  weekStrip(days, today) {
    const minDay = Math.min(today, ...Object.keys(days).map(Number)), wd = D.dateOfDay(today).wd, mon = today - ((wd + 6) % 7), names = this.nl() ? ["ma", "di", "wo", "do", "vr", "za", "zo"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    return `<div class="dl-week" role="img" aria-label="This week" data-i18n-skip>${names.map((n, i) => { const d = mon + i, r = days[d]; const c = r ? "played" : d === today ? "today" : d > today ? "future" : d >= minDay ? "missed" : "old"; return `<span class="dl-wd ${c}${d === today ? " now" : ""}"><small>${n}</small><i>${r ? SUN : ""}</i></span>`; }).join("")}</div>`;
  }
  rowHtml(day, r) {
    const line = D.resultLine(r, this.nl());
    return `<div class="dl-row"><button type="button" class="dl-row-main" data-dl="view" data-day="${day}"><span class="dl-row-t" data-i18n-skip><b>${this.label(day)}</b><small>${line}</small></span></button>${r.h ? `<button type="button" class="btn sm dl-rev" data-dl="review" data-day="${day}" data-nl="Review" aria-label="Review of ${this.label(day)}">Review</button>` : ""}</div>`;
  }
  tabHtml() {
    const today = this.today(), days = this.days(), s = D.streakOf(days, today), recent = Object.keys(days).map(Number).sort((a, b) => b - a).slice(0, 3);
    return `<div class="hm-col sh-col">
      <header class="sh-title"><h1>Daily puzzle</h1></header>
      ${this.game.home.updateHtml(false)}
      ${this.cardHtml("tab")}
      <section class="sh-card dl-mydays" aria-labelledby="dlMD"><div class="sh-card-head"><h2 id="dlMD">My days</h2><span class="dl-best" data-i18n-skip>${SUN}${this.nl() ? "Beste reeks" : "Best streak"} ${s.best} ${this.nl() ? "dagen" : "days"}</span></div>
        ${this.weekStrip(days, today)}
        ${recent.length ? `<div class="dl-rows">${recent.map((d) => this.rowHtml(d, days[d])).join("")}</div>` : `<p class="dl-empty">No days yet. Play the daily puzzle and your first day shows up here.</p>`}
        <button type="button" class="btn block" data-dl="all">All days</button></section>
      <button type="button" class="sh-card dl-link" data-dl="compare"><span class="dl-link-ic">${ICON.users}</span><span class="dl-link-t"><b>Compare with a friend</b><small>Paste your friend's code</small></span>${ICON.chev}</button>
      <button type="button" class="sh-card dl-link" data-dl="practice"><span class="dl-link-ic">${ICON.retry}</span><span class="dl-link-t"><b>Practise an earlier day</b><small>Doesn't count for your streak</small></span>${ICON.chev}</button>
    </div>`;
  }

  // ── taps ──
  bind(root) {
    root.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => this.act(b.dataset.dl, b)));
    const day = this.today(); if (D.stateOf(day, this.days()) === "done" && this.days()[day]?.w && this.days()[day].bot === undefined) this.ensureBot(day);
  }
  act(a, el) {
    const day = el?.dataset?.day ? Number(el.dataset.day) : this.today();
    if (a === "start") this.begin(); else if (a === "start-anyway") this.intro(false);
    else if (a === "resume") this.resume(); else if (a === "late") this.lateSheet();
    else if (a === "share") this.shareSheet(day); else if (a === "view") this.result(day, { from: "home" });
    else if (a === "review") this.review(day); else if (a === "all") this.mydays();
    else if (a === "compare") this.compare(); else if (a === "practice") this.mydays({ practice: true });
    else if (a === "practice-today") this.start(this.today(), true);
    this.game.sfx?.click?.();
  }
  /** "Speel de dagpuzzel": the gate (no finished game yet), the intro (first time) or straight into the run. */
  begin() {
    if (this.gate()) return this.intro(true);
    if (!D.introSeen()) return this.intro(false);
    this.start(this.today(), false);
  }
  start(day, practice) {
    this.closeSheet(true); this.closeScreen(true);
    if (!practice) D.markIntroSeen();
    this.game.startDaily(day, { practice });
  }
  resume() {
    const m = D.loadRunMeta();
    if (m && m.rules !== D.DAILY_RULES) return this.updateSheet(m);
    this.closeSheet(true); this.game.resumeDaily();
  }
  review(day) { const r = this.days()[day]; if (r?.h) { this.closeScreen(true); this.game.histView?.(r.h, "review", 0); } }

  // ── sheets ──
  openSheet({ id, title, body, foot, onClose, tall = false }) {
    this.closeSheet(true);
    const el = document.createElement("div");
    el.className = "sh-sheet-wrap tm-modal dl-sheet-wrap"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "dlSheetT"); el.dataset.dlSheet = id;
    el.innerHTML = `<div class="sh-sheet${tall ? "" : " sh-sheet-pause"}" role="document"><div class="sh-grab" aria-hidden="true"></div><header class="sh-sheet-head"><h2 id="dlSheetT" tabindex="-1">${title}</h2><button type="button" class="sh-x" data-x aria-label="Close">${oicon("close")}</button></header><div class="sh-sheet-body">${body}</div>${foot ? `<div class="sh-sheet-foot dl-foot">${foot}</div>` : ""}</div>`;
    el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("[data-x]")) this.closeSheet(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") this.closeSheet(); });
    document.body.appendChild(el);
    this.sheet = { el, onClose };
    
    el.querySelector("#dlSheetT")?.focus({ preventScroll: true });
    return el;
  }
  closeSheet(quiet = false) { const s = this.sheet; if (!s) return; this.sheet = null; s.el.remove(); if (!quiet) s.onClose?.(); }
  /** Back (the Back gesture): the top layer closes. */
  back() { if (this.sheet) this.closeSheet(); else if (this.screen) this.closeScreen(); }

  intro(gated) {
    const day = this.today(), tile = (ic, t) => `<span class="dl-tile">${ic}<b>${t}</b></span>`;
    const gate = gated ? `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b>Play your first game first</b><small>That way you know the rules. The daily puzzle can't be undone.</small></span></div>` : "";
    const foot = gated ? `<button type="button" class="btn primary block" data-s="game">${oicon("dice")}Play a game</button><button type="button" class="btn block" data-s="go">Start anyway</button>` : `<button type="button" class="btn primary block" data-s="go">Start the daily puzzle</button>`;
    const el = this.openSheet({ id: "intro", title: "Daily puzzle", body: `<div class="dl-intro-top"><span class="dl-board">${this.boardSvg(day, 88)}</span><span class="dl-intro-tx"><b>The same rolls for everyone</b><small>You and 2 bots · 10 points wins</small></span></div>
      <p class="dl-lead">Every day: the same board, the same rolls. Who wins in the fewest turns?</p>${gate}
      <div class="dl-tiles">${tile(oicon("harbor"), "Trade with the bank")}${tile(ICON.lock, "No undo")}${tile(oicon("clock"), "40 turns at most")}</div>`, foot });
    el.querySelector("[data-s=go]")?.addEventListener("click", () => this.start(this.today(), false));
    el.querySelector("[data-s=game]")?.addEventListener("click", () => { this.closeSheet(true); this.game.home.opts.onAdjust(); });
  }
  doneSheet() {
    const el = this.openSheet({ id: "played", title: "Already played today", body: `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b>You can practise</b><small>The same board, the same rolls. Practising doesn't count for your result or your streak.</small></span></div>`,
      foot: `<button type="button" class="btn primary block" data-s="p">Practise today</button><button type="button" class="btn block" data-s="x">Close</button>` });
    el.querySelector("[data-s=p]").addEventListener("click", () => this.start(this.today(), true));
    el.querySelector("[data-s=x]").addEventListener("click", () => this.closeSheet());
  }
  lateSheet() {
    const m = D.loadRunMeta(); if (!m) return this.game.home.render();
    const el = this.openSheet({ id: "late", title: "Your unfinished run", body: `<div class="dl-msg"><span class="dl-msg-ic">${oicon("clock")}</span><span><b data-i18n-skip>${this.nl() ? `Beurt ${m.turn} van ${D.TURN_LIMIT} op ${this.label(m.day)}` : `Turn ${m.turn} of ${D.TURN_LIMIT} on ${this.label(m.day)}`}</b><small>Finish it and it counts for that day. You can start today's puzzle after that.</small></span></div>`,
      foot: `<button type="button" class="btn primary block" data-s="r"><span data-i18n-skip>${this.nl() ? "Maak af voor" : "Finish for"} ${this.label(m.day)}</span></button><button type="button" class="btn block" data-s="d">Drop it</button>` });
    el.querySelector("[data-s=r]").addEventListener("click", () => this.resume());
    el.querySelector("[data-s=d]").addEventListener("click", () => this.discardSheet(m));
  }
  discardSheet(m) {
    const same = m.day === this.today(), el = this.openSheet({ id: "discard", title: "Discard the run?", onClose: () => {},
      body: `<div class="dl-msg"><span class="dl-msg-ic">${oicon("clock")}</span><span><b data-i18n-skip>${this.nl() ? `Beurt ${m.turn} van ${D.TURN_LIMIT} ${same ? "van vandaag" : "op " + this.label(m.day)}` : `Turn ${m.turn} of ${D.TURN_LIMIT} ${same ? "of today" : "on " + this.label(m.day)}`}</b><small>${same ? "You can start again." : "That day then counts as not played. You can still practise it."}</small></span></span></div>`,
      foot: `<button type="button" class="btn primary block" data-s="c">Cancel</button><button type="button" class="btn block dl-danger" data-s="w">Drop it</button>` });
    el.querySelector("[data-s=c]").addEventListener("click", () => this.closeSheet());
    el.querySelector("[data-s=w]").addEventListener("click", () => { D.clearRun(); this.closeSheet(true); if (this.game.daily && !this.game.daily.practice) this.game.daily = null; toast({ text: "Run discarded." }); this.game.home?.render(); this.game.home?.chrome?.sync(); });
  }
  updateSheet(m) {
    const el = this.openSheet({ id: "update", title: "The app was updated", body: `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b>Your run can't continue</b><small data-i18n-skip>${this.nl() ? `De regels zijn aangepast, dus beurt ${m.turn} kan niet meer worden afgespeeld. Begin opnieuw als oefening.` : `The rules changed, so turn ${m.turn} can't be played any more. Start over as practice.`}</small></span></div>`,
      foot: `<button type="button" class="btn primary block" data-s="p">Start over as practice</button><button type="button" class="btn block" data-s="l">Later</button>` });
    el.querySelector("[data-s=p]").addEventListener("click", () => { const day = m.day; D.clearRun(); this.start(day, true); });
    el.querySelector("[data-s=l]").addEventListener("click", () => this.closeSheet());
  }
  giveUpSheet() {
    const g = this.game, d = g.daily; if (!d) return;
    const pts = g.players?.[0]?.victoryPoints ?? 0;
    const el = this.openSheet({ id: "giveup", title: "Give up?", body: `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b data-i18n-skip>${this.nl() ? `Verloren met ${pts} punten` : `Lost with ${pts} points`}</b><small>${d.practice ? "This is only practice, nothing is counted." : "Giving up counts as a loss. It keeps your streak going."}</small></span></div>`,
      foot: `<button type="button" class="btn primary block" data-s="c">Keep playing</button><button type="button" class="btn block dl-danger" data-s="g">Give up</button>` });
    el.querySelector("[data-s=c]").addEventListener("click", () => this.closeSheet());
    el.querySelector("[data-s=g]").addEventListener("click", () => { this.closeSheet(true); g.dailyGiveUp(); });
  }

  // ── share ──
  shareText(rec) { return D.shareText(rec, this.nl(), D.dayLink(rec.code)); }
  shareSheet(day) {
    const r = this.days()[day]; if (!r) return;
    const text = this.shareText(r), canShare = typeof navigator.share === "function";
    const el = this.openSheet({ id: "share", title: "Share your result", tall: true,
      body: `<div class="dl-share-text" role="group" aria-label="Preview of the text" data-i18n-skip>${esc(text).replace(/\n/g, "<br>").replace(/(https?:\/\/\S+)/, '<span class="dl-link-in">$1</span>')}</div>
        ${canShare ? `<p class="dl-hint">Your friend sees the result in the text. With the link the app opens the comparison.</p>` : `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b>Sharing isn't possible here</b><small>Copy the text and paste it in your app.</small></span></div>`}`,
      foot: `${canShare ? `<button type="button" class="btn primary block" data-s="share">${ICON.share}Share</button>` : ""}<button type="button" class="btn${canShare ? "" : " primary"} block" data-s="copy">${ICON.copy}Copy text</button>` });
    el.querySelector("[data-s=copy]").addEventListener("click", () => this.copy(text, "Text copied. Paste it in your app."));
    el.querySelector("[data-s=share]")?.addEventListener("click", async () => {
      try { await navigator.share({ text }); } catch (e) { if (e && e.name === "AbortError") return; this.copy(text, navigator.onLine === false ? "No internet. Text copied, paste later." : "Text copied. Paste it in your app."); }
    });
  }
  async copy(text, msg) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
      try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (_2) { /* no clipboard */ }
    }
    toast({ text: ok ? msg : "Couldn't copy. Select the text yourself.", icon: ok ? "check" : "" });
    return ok;
  }

  // ── a layer on top of Home: result, My days ──
  openScreen(kind, html, { from = "home", day = null } = {}) {
    this.closeScreen(true);
    const el = document.createElement("div");
    el.className = "home sh-home dl-screen"; el.dataset.dlScreen = kind; el.setAttribute("role", "region");
    el.innerHTML = `<div class="hm-col sh-col dl-col">${html}</div>`;
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-dl]"); if (b) this.screenAct(b.dataset.dl, b); });
    document.body.appendChild(el);
    this.screen = { el, kind, from, day };
    
    el.scrollTop = 0; el.querySelector("[data-dl=back]")?.focus({ preventScroll: true });
    return el;
  }
  closeScreen(quiet = false) {
    const s = this.screen; if (!s) return; this.screen = null; s.el.remove();
    if (quiet) return;
    if (s.from === "game") this.leaveGame();
    else { this.game.home?.render?.(); this.game.home?.chrome?.sync?.(); }
  }
  /** From a result that came out of a run: Home on the Dagpuzzel tab. */
  leaveGame() {
    const g = this.game;
    g.removeGameOverOverlay?.(); g.stopAutoplay?.(); g._histView = null;
    g.goHome(); g.home.tab = "daily"; g.home.render(); g.home.chrome?.sync();
  }
  screenAct(a, el) {
    const day = el?.dataset?.day ? Number(el.dataset.day) : this.screen?.day;
    if (a === "back") this.closeScreen();
    else if (a === "share") this.shareSheet(day);
    else if (a === "copycode") this.copy(this.days()[day]?.code || "", "Code copied.");
    else if (a === "compare") this.compare(day);
    else if (a === "review") this.review(day);
    else if (a === "practice-day") this.start(Number(el.dataset.day), true);
    else if (a === "prev-month" || a === "next-month") { this.month = this.shiftMonth(a === "prev-month" ? -1 : 1); this.mydays({ keep: true }); }
    else if (a === "view") this.result(day, { from: "mydays" });
    else if (a === "practice-this") this.start(day, true);
  }
  head(title, sub, right = "") { return `<header class="dl-head"><button type="button" class="sh-x dl-back" data-dl="back" aria-label="Back">${ICON.back}</button><div class="dl-head-t"><h1>${title}</h1>${sub ? `<small data-i18n-skip>${sub}</small>` : ""}</div>${right}</header>`; }

  /** The result of a finished day (a record), or of a practice run (rec.practice). */
  result(day, { from = "home", rec = null } = {}) {
    const r = rec || this.days()[day]; if (!r) return;
    const k = D.kindOf(r), won = !!r.w, practice = !!r.practice, nl = this.nl(), bot = r.bot;
    const hero = won ? `<b>${r.t}</b><small>turns</small>` : `<b>${r.p[0]}</b><small>points</small>`;
    const label = won ? `Won in ${r.t} turns` : k === "timeup" ? `Time's up, ${r.p[0]} points after ${r.t} turns` : `Lost with ${r.p[0]} points`;
    const fast = won && bot > r.t ? `<span class="sh-chip dl-good">${bot - r.t} faster</span>` : "";
    const botLine = !won || practice ? (k === "timeup" ? `<p class="dl-botline">40 turns played, no 10 points</p>` : !won && r.by ? `<p class="dl-botline" data-i18n-skip>${esc(r.by)} ${nl ? "won op beurt" : "won on turn"} ${r.t}</p>` : "")
      : `<p class="dl-botline${bot === undefined ? " dl-think" : ""}" data-dl-bot="${day}" aria-live="polite">${bot === undefined ? "Smart bot is thinking" : bot === 0 ? "Smart bot: lost" : `Smart bot: ${bot} turns`}${fast}</p>`;
    const look = D.dayLook(this.game.constructor.loadLastSettings?.()?.look?.[0] ?? 0), names = [nl ? "Jij" : "You", ...(r.n || ["Blaauw", "Geelen"])];
    const tiles = [0, 1, 2].map((i) => `<div class="dl-pt${i === 0 ? " me" : ""}">${avatarChar(look[i], "dl-av big")}<b>${r.p[i]}</b><small data-i18n-skip>${esc(names[i])}${!won && i > 0 && r.by === names[i] && D.kindOf(r) === "lost" ? ` ${oicon("trophy")}` : ""}</small></div>`).join("");
    const s = D.streakOf(this.days(), this.today());
    const chip = `<span class="sh-chip dl-status${won ? " won" : ""}">${won ? oicon("check") : k === "timeup" ? oicon("clock") : ""}${won ? "Won" : k === "timeup" ? "Time's up" : "Lost"}</span>`;
    const html = `${this.head("Daily puzzle", `${this.label(day)}${practice ? " · " + (nl ? "oefening" : "practice") : ""}`, practice ? "" : this.streakChip())}
      <section class="sh-card dl-result"><div class="dl-r-top">${chip}</div><div class="dl-r-hero" role="img" aria-label="${label}">${hero}</div>${botLine}
        <div class="dl-pts">${tiles}</div>
        ${practice ? `<p class="dl-note">Practising doesn't count for your result or your streak.</p>` : `<p class="dl-streak-line" aria-label="${s.cur} days in a row">${SUN}<span data-i18n-skip><b>${s.cur}</b> ${nl ? (s.cur === 1 ? "dag op rij" : "dagen op rij") : (s.cur === 1 ? "day in a row" : "days in a row")}</span></p>
        <div class="dl-code"><span class="dl-code-t" data-i18n-skip>${r.code}</span><button type="button" class="sh-x" data-dl="copycode" data-day="${day}" aria-label="Copy code">${ICON.copy}</button></div>
        <button type="button" class="btn primary block" data-dl="share" data-day="${day}">${ICON.share}Share your result</button>
        <div class="dl-two"><button type="button" class="btn" data-dl="compare" data-day="${day}">Compare</button>${r.h ? `<button type="button" class="btn" data-dl="review" data-day="${day}" data-nl="Review">Review</button>` : `<button type="button" class="btn" data-dl="back">Done</button>`}</div>`}
        ${practice ? `<button type="button" class="btn primary block" data-dl="back">Done</button>` : ""}
      </section>`;
    this.openScreen("result", html, { from, day });
    if (won && !practice && bot === undefined) this.ensureBot(day);
  }

  /** A run ended (from the game): the record, the result, the smart bot. */
  finish(res) {
    if (res.practice) return this.result(res.day, { from: "game", rec: res });
    const days = this.days();
    if (!days[res.day]) { const { practice, ...rec } = res; D.saveDay(res.day, rec); } // the first finished run of a day is the one that counts
    this.result(res.day, { from: "game" });
  }

  // ── the smart bot: the reference player plays the day in a worker, once per day, cached ──
  ensureBot(day) {
    if (this.botJobs.has(day)) return this.botJobs.get(day);
    const c = D.loadBot(day);
    if (c !== undefined) { D.patchDay(day, { bot: c }); return Promise.resolve(c); }
    const job = new Promise((resolve) => {
      let w = null, done = false;
      const end = (v) => { if (done) return; done = true; try { w?.terminate(); } catch (_) { /* gone */ } this.botJobs.delete(day); if (v !== undefined) { D.saveBot(day, v); D.patchDay(day, { bot: v }); } resolve(v); this.botDone(day); };
      try {
        w = new Worker(new URL("./master/worker.js?v=1997", import.meta.url), { type: "module" });
        w.onmessage = (e) => { const m = e.data; if (m.type === "daily" && m.day === day) end(m.turns ?? 0); else if (m.type === "error") end(undefined); else if (m.type === "ready") w.postMessage({ type: "daily", id: 1, day }); };
        w.onerror = () => end(undefined);
        window.setTimeout(() => end(undefined), 60000);
      } catch (_) { end(undefined); }
    });
    this.botJobs.set(day, job);
    return job;
  }
  /** The smart bot answered: the lines that wait for it change in place (the card keeps its size). */
  botDone(day) {
    const r = this.days()[day], b = r?.bot;
    document.querySelectorAll(`[data-dl-bot="${day}"]`).forEach((e) => {
      e.classList.remove("dl-think");
      if (b === undefined) { e.textContent = ""; return; }
      const fast = r.w && b > r.t ? `<span class="sh-chip dl-good">${b - r.t} faster</span>` : "";
      e.innerHTML = (b === 0 ? "Smart bot: lost" : `Smart bot: ${b} turns`) + (e.closest(".dl-result") ? fast : "");
      
    });
    if (this.game.home?.open && !this.screen) { this.game.home.render(); }
  }

  // ── My days ──
  shiftMonth(d) { const m = this.month || { y: D.amsterdam().y, m: D.amsterdam().m }; let y = m.y, mo = m.m + d; if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; } return { y, m: mo }; }
  mydays({ practice = false, keep = false } = {}) {
    const now = D.amsterdam(), today = this.today(), days = this.days(), nl = this.nl();
    if (!keep || !this.month) this.month = { y: now.y, m: now.m };
    const { y, m } = this.month, first = D.dayIdOf(Date.UTC(y, m - 1, 1, 12)), dim = new Date(Date.UTC(y, m, 0)).getUTCDate(), last = first + dim - 1;
    const played = Object.keys(days).map(Number), minDay = played.length ? Math.min(...played) : today;
    const lead = (D.dateOfDay(first).wd + 6) % 7, wdn = nl ? ["ma", "di", "wo", "do", "vr", "za", "zo"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const cells = [...Array(lead).fill(`<span class="dl-cell off"></span>`)];
    for (let d = first; d <= last; d++) { const r = days[d], dd = D.dateOfDay(d).d, c = r ? "played" : d === today ? "today" : d > today ? "future" : d >= minDay ? "missed" : "old";
      cells.push(`<span class="dl-cell ${c}${d === today ? " now" : ""}" aria-label="${dd} ${D.monthName(m, nl).slice(0, 3)}, ${r ? (nl ? "gespeeld" : "played") : (nl ? "niet gespeeld" : "not played")}">${dd}</span>`); }
    const inM = Object.keys(days).map(Number).filter((d) => d >= first && d <= last), won = inM.filter((d) => days[d].w).length, s = D.streakOf(days, today);
    const rows = []; for (let d = Math.min(last, today); d >= first; d--) { if (days[d]) rows.push(this.rowHtml(d, days[d])); else if (d >= minDay && d < today) rows.push(`<div class="dl-row missed"><button type="button" class="dl-row-main" data-dl="practice-this" data-day="${d}"><span class="dl-row-ic">${ICON.retry}</span><span class="dl-row-t" data-i18n-skip><b>${this.label(d)}</b><small>${nl ? "Niet gespeeld. Oefen deze dag" : "Not played. Practise this day"}</small></span>${ICON.chev}</button></div>`); }
    const html = `${this.head("My days", "", this.streakChip())}
      <section class="sh-card dl-cal"><div class="dl-cal-head"><button type="button" class="sh-x" data-dl="prev-month" aria-label="Previous month"${y === D.dateOfDay(minDay).y && m <= D.dateOfDay(minDay).m ? " disabled" : ""}>${ICON.back}</button><h2 aria-live="polite" data-i18n-skip>${D.monthName(m, nl)}${y !== now.y ? " " + y : ""}</h2><button type="button" class="sh-x" data-dl="next-month" aria-label="Next month"${y === now.y && m === now.m ? " disabled" : ""}><span style="display:grid;transform:scaleX(-1)">${ICON.back}</span></button></div>
        <div class="dl-grid" role="img" aria-label="${D.monthName(m, nl)} ${y}" data-i18n-skip>${wdn.map((n) => `<small>${n}</small>`).join("")}${cells.join("")}</div>
        <div class="dl-counts" data-i18n-skip><span>${nl ? "Gespeeld" : "Played"} <b>${inM.length}</b></span><span>${nl ? "Gewonnen" : "Won"} <b>${won}</b></span><span>${nl ? "Beste reeks" : "Best streak"} <b>${s.best}</b></span></div></section>
      <section class="sh-card dl-list">${played.length || rows.length ? `<div class="dl-rows">${rows.join("") || `<p class="dl-empty">Not played</p>`}</div>` : `<div class="dl-none"><b>No days yet</b><p>Play the daily puzzle and your first day shows up here. Your streak starts at 1.</p><button type="button" class="btn primary block" data-dl="back">Play the daily puzzle</button></div>`}</section>`;
    const el = this.openScreen("mydays", html, { from: "home" });
    if (practice) toast({ text: "Pick a day to practise." });
    return el;
  }

  // ── compare with a friend (code in, verdict out) ──
  compare(day = null) {
    const nl = this.nl(), el = this.openSheet({ id: "compare", title: "Compare with a friend", tall: true,
      body: `<p class="dl-lead">Paste your friend's code. Got a link? Then the app opens here by itself.</p><label class="dl-field"><span class="sr">Your friend's code</span><input type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="KD1-XXXX-XXXX-XXXX" aria-label="Your friend's code" data-code></label><div class="dl-cmp" aria-live="polite"></div>`,
      foot: `<button type="button" class="btn block" data-s="paste">Paste from clipboard</button>` });
    const inp = el.querySelector("[data-code]"), out = el.querySelector(".dl-cmp");
    const run = () => {
      const v = inp.value.trim(); out.innerHTML = "";
      if (!v) return;
      const f = D.decode(v);
      if (f.error === "short") { out.innerHTML = `<div class="dl-msg"><span><b>Not complete yet</b></span></div>`; inp.setAttribute("aria-invalid", "false"); return; }
      if (f.error) { inp.setAttribute("aria-invalid", "true"); out.innerHTML = `<div class="dl-msg" role="alert"><span><b>This code is not right</b><small>There is a typo in it. Check the last group.</small></span></div>`; return; }
      inp.setAttribute("aria-invalid", "false");
      const mine = this.days()[f.day], today = this.today();
      const fl = D.resultLine(f, nl);
      if (!mine) {
        out.innerHTML = f.day === today ? `<div class="dl-msg"><span class="dl-msg-ic">${ICON.lock}</span><span><b>Play today first</b><small>Your friend's result stays hidden until you have played, so the board stays a surprise.</small></span></div>`
          : `<div class="dl-msg"><span class="dl-msg-ic">${oicon("info")}</span><span><b>This is another day</b><small data-i18n-skip>${nl ? `Je vriend: ${fl} op ${this.label(f.day)}. Jij hebt die dag niet gespeeld, dus je kunt niet vergelijken.` : `Your friend: ${fl} on ${this.label(f.day)}. You didn't play that day, so you can't compare.`}</small></span></div>`;
        return;
      }
      const c = D.compare(mine, f);
      const verdict = c === 0 ? (nl ? "Gelijkspel" : "A tie") : c > 0 ? (nl ? "Jij was beter" : "You did better") : (nl ? "Je vriend was beter" : "Your friend did better");
      out.innerHTML = `<h3 class="dl-verdict" data-i18n-skip>${verdict}</h3><div class="dl-cols" data-i18n-skip><div class="dl-col2"><small>${nl ? "Jij" : "You"}</small><b>${mine.w ? mine.t : mine.p[0]}</b><small>${mine.w ? (nl ? "beurten" : "turns") : (nl ? "punten" : "points")}</small></div><div class="dl-col2"><small>${nl ? "Vriend" : "Friend"}</small><b>${f.w ? f.t : f.p[0]}</b><small>${f.w ? (nl ? "beurten" : "turns") : (nl ? "punten" : "points")}</small></div></div><p class="dl-note" data-i18n-skip>${this.label(f.day)} · ${nl ? "Jij" : "You"} ${mine.p.join("-")} · ${nl ? "Vriend" : "Friend"} ${f.p.join("-")}</p>`;
    };
    inp.addEventListener("input", () => { const raw = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, ""); let s = raw.startsWith("KD1") ? raw.slice(3) : raw; const g = s.slice(0, 12).match(/.{1,4}/g) || []; inp.value = g.length ? "KD1-" + g.join("-") : raw.length ? "KD1" : ""; run(); });
    el.querySelector("[data-s=paste]").addEventListener("click", async () => { try { inp.value = await navigator.clipboard.readText(); inp.dispatchEvent(new Event("input")); } catch (_) { out.innerHTML = `<div class="dl-msg" role="alert"><span><b>Pasting didn't work</b><small>Hold the field and choose Paste, or type the code.</small></span></div>`; inp.focus(); } });
    const link = /[#&]dag=([^&]+)/.exec(location.hash || ""); if (link) { inp.value = decodeURIComponent(link[1]); inp.dispatchEvent(new Event("input")); }
  }

  _refit() { window.setTimeout(() => { try { this.game.fitCanvasToContainer?.(); this.game.requestBoardDraw?.(); } catch (_) { /* no board yet */ } }, 60); }
  // ── in the game: the strip with the turn ──
  strip() {
    const g = this.game, d = g.daily;
    let el = q(".dl-strip");
    if (!d || g.home?.open || g.winner || g.onboardingHold) { if (el) { el.remove(); this._refit(); } document.body.classList.remove("dl-run"); return; }
    const n = Math.min(D.TURN_LIMIT, g.turn || 1), nl = this.nl();
    const html = `<span class="dl-strip-ic" aria-hidden="true">${SUN}</span><b class="dl-strip-t" data-i18n-skip>${nl ? "Dagpuzzel" : "Daily puzzle"}${d.practice ? ` · ${nl ? "oefening" : "practice"}` : ""}</b><span class="dl-strip-d" data-i18n-skip>${this.label(d.day)}</span><span class="dl-strip-n" data-i18n-skip>${nl ? "Beurt" : "Turn"} ${n} ${nl ? "van" : "of"} ${D.TURN_LIMIT}</span><span class="dl-steps" aria-hidden="true">${Array.from({ length: D.TURN_LIMIT }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</span>`;
    const host = q("#mtop"), ps = q("#playerStrip");
    if (!el) { el = document.createElement("div"); el.className = "dl-strip"; el.setAttribute("role", "status"); }
    if (host && ps && el.nextElementSibling !== ps) { host.insertBefore(el, ps); this._refit(); } else if (!el.isConnected) document.body.appendChild(el);
    el.setAttribute("aria-label", `Daily puzzle ${this.label(d.day)}, turn ${n} of ${D.TURN_LIMIT}`);
    if (el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
    document.body.classList.add("dl-run");
  }
}
