// v1.94 Lessons: what your reviewed games teach, across games. Home = the lessons the evidence supports (a lesson needs >= 3 marked moves in >= 2 games), "too little to say yet" with its progress,
// and "going well"; a second tab lists the games next to each other. A lesson page shows your examples as mini board crops ("You chose" / "Better"), "Practise this" (A or B from your own position)
// and "Ask" (the three questions are answered from your own numbers; a free question goes to the explain endpoint). The numbers come from one row per game (src/lessons-row.js) that lives in
// the game's list entry; games saved before it existed are analysed in the background, one at a time, in a worker (src/lessons-worker.js). Rules and words: src/lessons-eval.js, src/lessons-view.js.
import { loadPractice, savePractice, practiceStats, pickPractice, exKey } from "./lessons-data.js";
import { buildLessons } from "./lessons-eval.js";
import { rowKey } from "./lessons-row.js";
import { boardUnpack } from "./lessons-geo.js";
import { L, pl, esc, day, cropSvg, tileHtml, exModel, spotHexes, QS, answerDec } from "./lessons-view.js";
import { RECAP_URL, recapLang } from "./review-recap.js";
import { resName } from "./resources.js";
import { lang, onLang, num } from "./i18n.js";
import { oicon } from "./ui-icons.js";

const CHEV_L = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const LESSONS_ICON = oicon("lessons");
const ICON = { setup: "target", build: "build", timing: "clock", trade: "trade", dev: "devcard", robber: "robber", road: "build", settlement: "target", city: "target", bank: "trade", end: "clock", card: "devcard" };
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const ASK_KEY = "colonist_lessons_ask";
const askCache = () => { try { return JSON.parse(localStorage.getItem(ASK_KEY) || "{}") || {}; } catch (_) { return {}; } };
const askSave = (o) => { try { const ks = Object.keys(o); if (ks.length > 40) ks.slice(0, ks.length - 40).forEach((k) => delete o[k]); localStorage.setItem(ASK_KEY, JSON.stringify(o)); } catch (_) { /* private mode */ } };
const norm = (q) => String(q).trim().toLowerCase().replace(/\s+/g, " ");
const TITLES = { setup: ["Starting spot", "Startplek"], build: ["What to build", "Wat bouw je"], timing: ["Ending your turn early", "Beurt te vroeg beëindigd"], trade: ["Trading", "Ruilen"], dev: ["Development cards", "Ontwikkelkaarten"], robber: ["Robber", "Rover"] };
const UNITS = { setup: ["Your starts", "Jouw starts"], build: ["Your builds", "Jouw bouwkeuzes"], timing: ["Your turns", "Jouw beurten"], trade: ["Your trades", "Jouw ruilen"], dev: ["Your cards", "Jouw kaarten"], robber: ["Your robber moves", "Jouw rover-zetten"] };
const SUBS = { setup: ["Weaker start", "Zwakkere start"], build: ["A better build", "Een betere bouwzet"], timing: ["Turn ended early", "Beurt te vroeg beëindigd"], trade: ["A better trade", "Een betere ruil"], dev: ["A better card move", "Een betere kaartzet"], robber: ["A better robber spot", "Een betere roverplek"] };
const rname = (r) => resName(r, lang()).toLowerCase();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titleOf = (l) => (l.kind === "dec" ? L(...TITLES[l.cat]) : l.kind === "res" ? L(`${cap(rname(l.res))} is scarce`, `${cap(rname(l.res))} is schaars`) : l.kind === "rob" ? L("Robber and 7s", "Rover en 7") : l.kind === "b4" ? L("Often 4:1 with the bank", "Vaak 4:1 bij de bank") : l.kind === "learned" ? L(...TITLES[l.cat]) : L("Games without a marked move", "Potjes zonder gemarkeerde zet"));
const gamesN = (n) => pl(n, "game", "games", "potje", "potjes");
const movesN = (n) => pl(n, "move", "moves", "zet", "zetten");
const pct = (v) => `${num(Math.round(v))}%`;
const resWord = (r) => (r === "won" ? L("won", "gewonnen") : r === "lost" ? L("lost", "verloren") : "");
const resCls = (r) => (r === "won" ? "pos" : r === "lost" ? "neg" : "");

export const LessonsMixin = {
  // ── data ──
  /** The reviewed games of this device (one person's review each), newest first, each with its row when it has one. */
  async _lnItems() {
    const H = this.hist; await H.open();
    const metas = H.metas.filter((m) => m.me != null && m.rec && m.acc != null).sort((a, b) => b.end - a.end);
    return metas.map((m) => ({ id: m.id, end: m.end, result: m.result, vp: m.seats?.[m.me]?.vp ?? null, me: m.me, n: m.n, meta: m, lr: m.lr && m.lr.k === rowKey(m) && !m.lr.none ? m.lr : null, none: !!(m.lr && m.lr.k === rowKey(m) && m.lr.none) }));
  },
  async lessonsOpen(o = {}) {
    this.lessonsClose();
    const el = document.createElement("div");
    el.className = "hs ln tm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", L("Lessons", "Lessen"));
    document.body.appendChild(el); this._lnEl = el;
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") this.lessonsClose(); else if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[role=button][data-lnopen]")) { e.preventDefault(); e.target.click(); } });
    el.addEventListener("click", (e) => this._lnClick(e));
    el.addEventListener("submit", (e) => this._lnSubmit(e));
    this._lnOff = onLang(() => { if (this._lnEl) this._lnDraw(); });
    this._ln = { view: o.lesson ? "lesson" : "home", tab: o.tab || "les", id: o.lesson || null, all: false, ask: null, pr: null, items: null, D: null, an: null };
    this._lnDraw(true);
    await this._lnRefresh();
    if (this._lnEl !== el) return;
    if (this._ln.view === "lesson" && !this._lnCur()) { this._ln.view = "home"; this._ln.id = null; }
    this._lnDraw(); this._lnAnalyse();
  },
  lessonsClose() { this._lnCancel(); this._lnOff?.(); this._lnOff = null; this._lnEl?.remove(); this._lnEl = null; },
  async _lnRefresh() {
    try { const items = await this._lnItems(); this._ln.items = items; this._ln.D = buildLessons(items); } catch (_) { this._ln.items = []; this._ln.D = buildLessons([]); }
  },
  _lnCur() { const S = this._ln; return S?.id && S.D ? [...S.D.lessons, ...S.D.watch].find((l) => l.id === S.id) || null : null; },
  _lnBoard(gid) { const it = this._ln.items?.find((x) => x.id === gid); return it?.lr?.bd ? boardUnpack(it.lr.bd) : null; },
  _lnColor(pid) { return this.players?.[pid]?.color || this.theme?.seatColors?.[pid] || "#D1453A"; },
  /** the examples of a lesson as the page shows them: the row's move plus its board, its model and where it belongs */
  _lnExamples(les) {
    if (!les.examples) return [];
    return les.examples.map((e, i) => { const board = this._lnBoard(e.gid), it = this._ln.items.find((x) => x.id === e.gid); return { ...e, i0: i, board, model: exModel(e, board), pid: it?.me ?? 0, x: { best: true } }; });
  },

  // ── the background analysis of games that have no row yet ──
  _lnTodo() { return (this._ln?.items || []).filter((x) => !x.lr && !x.none); },
  _lnAnalyse() {
    const S = this._ln; if (!S || S.an?.running) return;
    const todo = this._lnTodo(); if (!todo.length) return;
    const an = (S.an = { running: true, done: 0, total: todo.length, token: (this._lnTok = (this._lnTok || 0) + 1) });
    this._lnDraw();
    const step = async () => {
      if (this._ln !== S || S.an !== an || this._lnTok !== an.token) return;
      const next = this._lnTodo()[0];
      if (!next) { an.running = false; await this._lnRefresh(); S.an = null; this._lnDraw(); return; }
      const row = await this._lnRowOf(next, an);
      if (this._ln !== S || S.an !== an) return;
      if (row === undefined) { next.none = true; } // could not be analysed (kept as it is, not tried again now)
      else { await this.hist.patch(next.id, { lr: row }); next.lr = row.none ? null : row; next.none = !!row.none; next.meta.lr = row; }
      an.done += 1;
      S.D = buildLessons(S.items.filter((x) => !x.none || x.lr)); this._lnDraw();
      this._lnIdle(step);
    };
    this._lnIdle(step);
  },
  _lnIdle(f) { const run = () => { try { f(); } catch (_) { /* the next idle slice */ } }; if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 60); },
  _lnCancel() { this._lnTok = (this._lnTok || 0) + 1; if (this._ln) this._ln.an = null; try { this._lnW?.terminate(); } catch (_) { /* gone */ } this._lnW = null; this._lnWait?.(undefined); this._lnWait = null; },
  /** the row of one game, made in the worker (the stored blob goes there as it is); the page's thread falls back to doing it itself only when there is no worker. undefined: not possible. */
  async _lnRowOf(item) {
    const H = this.hist, m = item.meta;
    try {
      if (this._lnW === undefined || this._lnW === null) { try { this._lnW = typeof Worker === "function" && !this._lnNoW ? new Worker(new URL("./lessons-worker.js?v=193", import.meta.url), { type: "module" }) : null; } catch (_) { this._lnW = null; } }
      const w = this._lnW;
      if (w) {
        const blob = await H.getRaw(m.id); if (!blob) return undefined;
        const copy = { id: blob.id, enc: blob.enc, data: blob.data instanceof ArrayBuffer ? blob.data.slice(0) : blob.data };
        const meta = JSON.parse(JSON.stringify({ ...m, lr: undefined }));
        const r = await new Promise((ok) => {
          const to = setTimeout(() => { w.removeEventListener("message", on); ok(null); }, 30000);
          const on = (ev) => { if (ev.data?.id === m.id) { clearTimeout(to); w.removeEventListener("message", on); ok(ev.data); } };
          w.addEventListener("message", on); w.addEventListener("error", () => { clearTimeout(to); ok(null); }, { once: true });
          this._lnWait = (v) => { clearTimeout(to); w.removeEventListener("message", on); ok(v); };
          w.postMessage({ id: m.id, meta, blob: copy }, copy.data instanceof ArrayBuffer ? [copy.data] : []);
        });
        this._lnWait = null;
        if (r?.row) return r.row;
        if (r === undefined) return undefined; // cancelled
        this._lnNoW = true; try { w.terminate(); } catch (_) { /* gone */ } this._lnW = null; // the worker failed: this page goes on by itself
      }
      const { rowOf, ROW_V } = await import("./lessons-row.js"), payload = await H.get(m.id);
      if (!payload) return undefined;
      await new Promise((r) => setTimeout(r, 0));
      return rowOf(payload, { ...m, lr: undefined }) || { v: ROW_V, k: rowKey(m), none: 1 };
    } catch (_) { return undefined; }
  },
  _lnDrawSoon() { if (this._lnDT) return; this._lnDT = setTimeout(() => { this._lnDT = 0; if (this._lnEl) this._lnDraw(); }, 250); },

  // ── drawing ──
  _lnDraw(loading = false) {
    const el = this._lnEl; if (!el) return;
    const S = this._ln, D = S.D, les = S.view === "lesson" ? this._lnCur() : null;
    const scroll = el.querySelector(".hs-scroll")?.scrollTop || 0;
    let title = L("Lessons", "Lessen"), sub = "", body = "";
    if (loading || !D) { sub = L("Loading…", "Laden…"); body = `<p class="hs-note" role="status">${L("Reading your games…", "Je potjes lezen…")}</p>`; }
    else if (!S.items.length) { sub = L("Learn from your reviewed games", "Leer van je beoordeelde potjes"); body = this._lnEmpty(); }
    else if (les) { title = titleOf(les); sub = this._lnSub(les); body = this._lnLesson(les); }
    else { sub = D.N ? L(`From ${gamesN(D.N)} reviewed · ${movesN(D.moves)} marked`, `Uit ${gamesN(D.N)} beoordeeld · ${movesN(D.moves)} gemarkeerd`) : L("Your games are being read", "Je potjes worden gelezen"); body = this._lnHome(); }
    if (S.view === "home" && S.tab === "potjes" && D?.N) title = L("Your games", "Jouw potjes");
    el.innerHTML = `<div class="hs-bar"><button type="button" class="hs-x" data-lnback aria-label="${les ? L("Back to Lessons", "Terug naar Lessen") : L("Back", "Terug")}">${CHEV_L}</button><div><h3>${esc(title)}</h3><small>${esc(sub)}</small></div></div><div class="hs-scroll ln-scroll">${body}</div>`;
    el.querySelector(".hs-scroll").scrollTop = scroll;
  },
  _lnEmpty() {
    return `<section class="ln-c ln-empty"><i class="ln-ico" aria-hidden="true">${LESSONS_ICON}</i><h4>${L("Lessons appear after you review games", "Lessen verschijnen nadat je potjes hebt beoordeeld")}</h4><p>${L("Play a game, then open its game review. Your marked moves are then collected across games, so you see what costs you the most.", "Speel een potje en open dan de spelreview. Je gemarkeerde zetten worden dan over potjes heen verzameld, zodat je ziet wat je het meest kost.")}</p><button type="button" class="hs-btn pri" data-lnpast>${L("Past games", "Eerdere spellen")}</button></section>`;
  },
  _lnSub(les) {
    const unit = les.kind === "dec" ? L(...SUBS[les.cat]) : null;
    if (les.kind === "dec") return L(`${unit} in ${les.k} of ${les.N} games`, `${unit} in ${les.k} van ${les.N} potjes`);
    return L(`In ${les.k} of ${les.N} games`, `In ${les.k} van ${les.N} potjes`);
  },
  _lnAn() {
    const a = this._ln.an; if (!a?.running) return "";
    return `<p class="ln-an" role="status"><i class="ln-spin" aria-hidden="true"></i>${L(`${a.done} of ${gamesN(a.total)} analysed`, `${a.done} van ${gamesN(a.total)} geanalyseerd`)}</p>`;
  },
  /** per game bars: win chance points lost (dec), or the game's value; the bar is the size of the loss, never a sum */
  _lnStrip(series, kind = "dec", extra = "") {
    const mx = Math.max(1, ...series.map((s) => s.v)), many = series.length > 6;
    return `<div class="ln-strip${many ? " many" : ""}" style="--cols:${series.length}" role="img" aria-label="${esc(L("Per game", "Per potje"))}">${series.map((s) => {
      const h = s.v ? Math.max(6, (s.v / mx) * 40) : 3;
      const label = kind === "dec" ? (s.v ? `−${num(Math.round(s.v))}` : "0") : kind === "flag" ? (s.v ? L("yes", "ja") : L("no", "nee")) : num(Math.round(s.v));
      return `<div class="ln-sp" data-game="${esc(s.id)}"><div class="ln-bx"><i class="${s.v ? (kind === "flag" ? "flag" : "") : "ok"}" style="height:${h}px"></i></div><b class="${s.v && kind === "dec" ? "neg" : ""}">${label}</b><small>${many ? new Date(s.end).getDate() : esc(day(s.end))}</small>${many ? `<i class="ln-dot ${resCls(s.result)}" title="${esc(resWord(s.result))}"></i>` : `<span class="${resCls(s.result)}">${esc(resWord(s.result))}</span>`}</div>`;
    }).join("")}</div>${extra}`;
  },
  _lnHome() {
    const S = this._ln, D = S.D;
    const tabs = `<div class="hs-seg ln-tabs" role="tablist">${[["les", L("Lessons", "Lessen")], ["potjes", L("Your games", "Jouw potjes")]].map(([k, n]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" class="${S.tab === k ? "on" : ""}" data-lntab="${k}">${esc(n)}</button>`).join("")}</div>`;
    if (S.tab === "potjes") return tabs + this._lnAn() + this._lnGames() + this._lnFoot();
    let out = tabs + this._lnAn();
    if (!D.N) return out + `<section class="ln-c"><h4>${L("Reading your games", "Je potjes worden gelezen")}</h4><p>${L("The lessons appear as soon as the first games are read.", "De lessen verschijnen zodra de eerste potjes zijn gelezen.")}</p></section>` + this._lnFoot();
    if (D.lessons.length) out += `<h5 class="ln-sec">${L("Your lessons, biggest loss first", "Jouw lessen, grootste verlies eerst")}</h5>` + D.lessons.map((l, i) => this._lnCard(l, i === 0 && l.kind === "dec")).join("");
    else out += `<section class="ln-c"><h4>${L("No lesson yet", "Nog geen les")}</h4><p>${L("A lesson needs 3 marked moves of one kind in 2 games.", "Een les vraagt 3 gemarkeerde zetten van één soort in 2 potjes.")}</p></section>`;
    if (D.watch.length) out += `<h5 class="ln-sec">${L("Too little to say yet", "Nog te weinig om te zeggen")}</h5>` + D.watch.map((l) => this._lnWatch(l)).join("");
    if (D.strong.length) out += `<h5 class="ln-sec">${L("Going well", "Dit gaat goed")}</h5>` + D.strong.map((l) => this._lnStrong(l)).join("");
    return out + this._lnFoot();
  },
  _lnFoot() {
    const S = this._ln, D = S.D, all = S.items.length, seen = D.N + D.skipped;
    const cov = L(`${num(S.items.length)} reviewed games on this device.`, `${num(S.items.length)} beoordeelde potjes op dit apparaat.`);
    return `<p class="ln-foot">${L("A lesson needs 3 marked moves in 2 games. Percentages are win chance per game, ± is the spread over your games.", "Een les vraagt ≥3 zetten in ≥2 potjes. Percentages zijn winkans per potje, ± = spreiding over je potjes.")}${D.skipped ? ` ${L(`${gamesN(D.skipped)} reviewed with an older method are left out.`, `${gamesN(D.skipped)} met een oudere beoordeling tellen niet mee.`)}` : ""}${all > seen + (this._lnTodo().length) ? "" : ""}</p><p class="ln-foot soft">${cov}</p>`;
  },
  _lnCard(l, focus) {
    const progress = this._lnProgress(l);
    if (l.kind === "dec") {
      const ex = this._lnExamples(l), line = answerDec(l, "wrong", ex.map((e) => e.model)), txt = l.cat === "setup" ? line?.lead : line?.text;
      return `<div role="button" tabindex="0" class="ln-c ln-les${focus ? " focus" : ""}" data-lnopen="${l.id}"><span class="ln-row"><b class="ln-t">${esc(titleOf(l))}</b>${focus ? `<em class="ln-tag">${L("Your focus", "Jouw focus")}</em>` : ""}</span>
        <span class="ln-row end"><span class="ln-big neg">−${num(Math.max(1, Math.round(l.cost)))}%<small> ${L("win chance per game", "winkans per potje")}${l.se != null ? ` ±${num(Math.round(l.se))}` : ""}</small></span><span class="ln-sub">${L("in", "in")} <b>${l.k} ${L("of", "van")} ${l.N}</b> ${L("games", "potjes")}</span></span>
        ${this._lnStrip(l.series)}<span class="ln-two"><span>${esc(txt || "")}</span>${progress ? `<span class="soft">${progress}</span>` : ""}</span></div>`;
    }
    const mech = this._lnMech(l);
    return `<div role="button" tabindex="0" class="ln-c ln-les" data-lnopen="${l.id}"><span class="ln-row"><b class="ln-t">${esc(titleOf(l))}</b></span><span class="ln-row end"><span class="ln-big2">${mech.big}</span><span class="ln-sub">${L("in", "in")} <b>${l.k} ${L("of", "van")} ${l.N}</b> ${L("games", "potjes")}</span></span><span class="ln-two"><span class="soft">${esc(mech.line)}</span></span></div>`;
  },
  _lnProgress(l) {
    const out = [];
    if (l.clean >= 1) out.push(L(`The last ${gamesN(l.clean)} without this`, `De laatste ${gamesN(l.clean)} zonder dit`));
    else if (l.trend) out.push(L(`Last 3 games −${num(Math.round(l.trend.recent))}%, before −${num(Math.round(l.trend.earlier))}% per game`, `Laatste 3 potjes −${num(Math.round(l.trend.recent))}%, daarvoor −${num(Math.round(l.trend.earlier))}% per potje`));
    return esc(out.join(" · "));
  },
  _lnMech(l) {
    if (l.kind === "res") return { big: `${l.k}/${l.N}`, line: L(`Bots: ${l.opp} of ${l.oppN} (at most 1 dot at turn 5)`, `Bots: ${l.opp} van ${l.oppN} (hooguit 1 stip bij beurt 5)`) };
    if (l.kind === "rob") return { big: num(Math.round(l.mine)), line: L(`cards lost per game, bots ${num(Math.round(l.opp))}`, `kaarten kwijt per potje, bots ${num(Math.round(l.opp))}`) };
    return { big: num(Math.round(l.mine * 10) / 10), line: L(`4:1 trades per game, bots ${num(Math.round(l.opp * 10) / 10)}`, `4:1 ruilen per potje, bots ${num(Math.round(l.opp * 10) / 10)}`) };
  },
  _lnWatch(l) {
    let txt;
    if (l.kind === "dec") {
      if (l.need?.spread) txt = L(`${l.k} of ${l.N} games, but 1 move counts for ${l.need.spread}%.`, `${l.k} van ${l.N} potjes, maar 1 zet telt voor ${l.need.spread}%.`);
      else txt = L(`${movesN(l.moves)} in ${gamesN(l.k)} (−${num(Math.round(l.total))}%).`, `${movesN(l.moves)} in ${gamesN(l.k)} (−${num(Math.round(l.total))}%).`);
    } else txt = this._lnMech(l).line;
    const need = l.need?.games ? L(`${l.need.games} more ${l.need.games === 1 ? "game" : "games"}`, `nog ${gamesN(l.need.games)}`) : l.need?.moves ? L(`${movesN(l.need.moves)} more`, `nog ${movesN(l.need.moves)}`) : "";
    return `<div role="button" tabindex="0" class="ln-c ln-les ln-w" data-lnopen="${l.id}"><span class="ln-row"><b class="ln-t">${esc(titleOf(l))}</b><em class="ln-tag soft">${L("Watch", "Let op")}</em></span><span class="ln-two"><span>${esc(txt)}</span></span>
      <span class="ln-row"><span class="ln-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((l.prog || 0) * 100)}"><i style="width:${Math.round((l.prog || 0) * 100)}%"></i></span><span class="ln-need">${esc(need)}</span></span></div>`;
  },
  _lnStrong(l) {
    let big = "", line = "", sub = "";
    if (l.kind === "rob") { big = `<b class="ln-big2 pos">${num(Math.round(l.mine))}</b> <span class="ln-sub">${L(`cards lost, bots ${num(Math.round(l.opp))}`, `kaarten kwijt, bots ${num(Math.round(l.opp))}`)}</span>`; line = L("Averaged per game, you against the 3 bots.", "Gemiddeld per potje, jij tegen de bots."); sub = L(`in <b>${l.k} of ${l.N}</b> games`, `in <b>${l.k} van ${l.N}</b> potjes`); }
    else if (l.kind === "learned") { big = `<b class="ln-big2 pos">${L("Learned", "Geleerd")}</b>`; line = L(`The last ${gamesN(l.m)} without this mistake.`, `De laatste ${gamesN(l.m)} zonder deze fout.`); sub = ""; }
    else { big = `<b class="ln-big2 pos">${l.k}</b> <span class="ln-sub">${L("games", "potjes")}</span>`; line = L("No move was marked in them.", "Er was geen zet gemarkeerd."); sub = L(`of <b>${l.N}</b>`, `van <b>${l.N}</b>`); }
    return `<div class="ln-c ln-st"><span class="ln-row"><b class="ln-t">${esc(titleOf(l))}</b><em class="ln-tag ok">${L("Strong", "Sterk")}</em></span><span class="ln-row end"><span>${big}</span><span class="ln-sub">${sub}</span></span><span class="ln-two"><span class="soft">${esc(line)}</span></span></div>`;
  },
  /** the second tab: the games next to each other */
  _lnGames() {
    const S = this._ln, items = S.items.filter((x) => x.lr);
    if (!items.length) return `<section class="ln-c"><p>${L("The games are being read.", "De potjes worden gelezen.")}</p></section>`;
    const mx = Math.max(1, ...items.map((x) => x.lr.gp));
    return `<h5 class="ln-sec">${L("Per game, newest first", "Per potje, nieuwste eerst")}</h5>` + items.map((it) => {
      const r = it.lr, rob = r.rob ? L(`Robber and 7s: ${num(Math.round(r.rob[0]))} cards lost, bots ${num(Math.round(r.rob[1]))}`, `Rover en 7: ${num(Math.round(r.rob[0]))} kaarten kwijt, bots ${num(Math.round(r.rob[1]))}`) : "";
      return `<div class="ln-c ln-gm" data-lngame="${esc(it.id)}"><span class="ln-row"><b class="ln-t">${esc(day(it.end))}${it.vp != null ? ` · ${pl(it.vp, "point", "points", "punt", "punten")}` : ""}</b><b class="${resCls(it.result)}">${esc(resWord(it.result))}</b></span>
        <span class="ln-gr"><span>${L("Your choices", "Jouw keuzes")}</span><span class="ln-gb"><i class="${r.gp ? "" : "ok"}" style="width:${r.gp ? Math.max(4, (r.gp / mx) * 100) : 2}%"></i></span><b class="${r.gp ? "neg" : ""}">${r.gp ? `−${num(Math.round(r.gp))}` : "0"}</b></span>
        <span class="ln-two"><span class="soft">${esc(r.marks ? L(`${movesN(r.marks)} marked`, `${movesN(r.marks)} gemarkeerd`) : L("No move marked", "Geen zet gemarkeerd"))}</span>${rob ? `<span class="soft">${esc(rob)}</span>` : ""}</span></div>`;
    }).join("");
  },

  // ── a lesson ──
  _lnLesson(les) {
    const S = this._ln;
    if (les.kind !== "dec") return this._lnMechPage(les);
    const ex = this._lnExamples(les), models = ex.map((e) => e.model), line = answerDec(les, "wrong", models), showN = S.all ? ex.length : Math.min(2, ex.length);
    const head = `<section class="ln-c ln-focus"><span class="ln-row end"><span class="ln-big neg">−${num(Math.max(1, Math.round(les.cost)))}%<small> ${L("win chance per game", "winkans per potje")}${les.se != null ? ` ±${num(Math.round(les.se))}` : ""}</small></span><span class="ln-sub">${L("in", "in")} <b>${les.k} ${L("of", "van")} ${les.N}</b></span></span>
      ${this._lnStrip(les.series)}<span class="ln-two"><span>${esc(les.cat === "setup" ? line?.lead || "" : line?.text || "")}</span><span class="soft">${esc(les.status === "les" ? L(`Measured on your ${movesN(les.moves)} marked.`, `Gemeten op jouw ${movesN(les.moves)} gemarkeerd.`) : L("Not enough yet to call this a lesson.", "Nog niet genoeg om dit een les te noemen."))}${this._lnProgress(les) ? ` ${this._lnProgress(les)}` : ""}</span></span></section>`;
    const exs = `<h5 class="ln-sec">${esc(L(...UNITS[les.cat]))}${L(", biggest loss first", ", grootste verlies eerst")}</h5>` + ex.slice(0, showN).map((e, i) => this._lnEx(e, i)).join("")
      + (ex.length > showN ? `<button type="button" class="hs-btn ln-more" data-lnmore>${L("More examples", "Meer voorbeelden")} (${ex.length - showN})</button>` : "");
    return head + exs + this._lnPractice(les, ex) + this._lnAsk(les, ex);
  },
  _lnExSide(e, which, w) {
    const kind = which === "p" ? e.pk : e.bk, d = which === "p" ? e.pd : e.bd, spec = which === "p" ? e.p : e.q;
    if (e.model.spot && e.board && spec) return cropSvg(e.board, spec, { w, color: this._lnColor(e.pid), label: this._lnAlt(e, which) });
    return tileHtml(kind, d, oicon(ICON[kind] || "target"), which === "q");
  },
  _lnAlt(e, which) {
    const kind = which === "p" ? e.pk : e.bk, spec = which === "p" ? e.p : e.q, b = e.board; if (!b || !spec) return "";
    const hx = spec[0] === "h" ? [spec[1]] : e.model.spot ? spotHexes(spec) : [];
    return `${which === "p" ? L("You chose", "Jij koos") : L("Better", "Beter")}: ${hx.map((h) => `${rname(b[h].res)} ${b[h].num || ""}`.trim()).join(", ")}`;
  },
  _lnEx(e, i) {
    const idx = e.i0 + 1, m = e.model, turn = e.c === "setup" ? L("Start", "Start") : L(`Turn ${e.t}`, `Beurt ${e.t}`);
    return `<article class="ln-c ln-exc" id="lnex${e.i0}" data-ex="${e.i0}" data-gid="${esc(e.gid)}" data-turn="${e.t}"><div class="ln-row"><span class="ln-sub"><b class="ln-ref big">${idx}</b> <b>${esc(turn)}</b> · ${esc(day(e.end))} · <span class="${resCls(e.result)}">${esc(resWord(e.result))}</span></span><button type="button" class="ln-open" data-lnex="${e.i0}">${L("Open", "Open")} ›</button></div>
      <div class="ln-pair"><div><div class="ln-lbl"><span>${L("You chose", "Jij koos")}</span><b class="neg">${num(e.b)}%</b></div>${this._lnExSide(e, "p", 150)}</div><div><div class="ln-lbl"><span>${L("Better", "Beter")}</span><b class="pos">${num(e.a)}%</b></div>${this._lnExSide(e, "q", 150)}</div></div>
      ${m.lines?.length ? `<div class="ln-two"><span>${esc(m.lines[0])}</span><span class="soft">${esc(m.lines[1])}</span></div>` : ""}</article>`;
  },
  _lnPractice(les, ex) {
    if (!ex.length) return "";
    const S = this._ln, pr = loadPractice(), st = practiceStats(pr, les.cat);
    let P = S.pr; if (!P || P.lesson !== les.id) { P = S.pr = this._lnPick(les, ex, pr, null); }
    if (!P) return "";
    const e = ex[P.ex], sides = P.flip ? ["q", "p"] : ["p", "q"], opt = (k) => `<div class="ln-opt"><div class="ln-lbl"><span class="ln-ab">${"AB"[k]}</span>${P.pick != null ? `<b class="${sides[k] === "q" ? "pos" : "neg"}">${num(sides[k] === "q" ? e.a : e.b)}%</b>` : ""}</div>${this._lnExSide(e, sides[k], 150)}</div>`;
    const ok = P.pick != null && sides[P.pick] === "q" || (P.pick != null && e.a === e.b);
    const fb = P.pick == null ? `<div class="ln-btns"><button type="button" class="hs-btn pri" data-lnpick="0">${L("Choose A", "Kies A")}</button><button type="button" class="hs-btn pri" data-lnpick="1">${L("Choose B", "Kies B")}</button></div>`
      : `<div class="ln-fb ${ok ? "ok" : "no"}" role="status"><i aria-hidden="true">${ok ? "✓" : "✕"}</i><b>${ok ? L("Right: that was the better move.", "Goed: dat was de betere zet.") : L(`Not quite: ${"AB"[sides.indexOf("q")]} was better.`, `Niet helemaal: ${"AB"[sides.indexOf("q")]} was beter.`)}</b></div><div class="ln-btns"><button type="button" class="hs-btn pri" data-lnnext>${L("Next question", "Volgende vraag")}</button><button type="button" class="hs-btn" data-lnex="${P.ex}">${L("Open", "Open")} ›</button></div>`;
    return `<section class="ln-c ln-pr"><div class="ln-row"><h4>${L("Practise this", "Oefen dit")}</h4><span class="ln-sub">${esc(day(e.end))} · ${e.c === "setup" ? L("set-up", "beginopstelling") : L(`turn ${e.t}`, `beurt ${e.t}`)} <b class="ln-ref">${P.ex + 1}</b></span></div>
      <div class="ln-two"><span>${L("Your own position. Which would you pick?", "Jouw eigen stand. Wat kies je?")}</span>${st.n ? `<span class="soft">${L(`Practised ${st.n} · right ${st.ok}`, `Geoefend ${st.n} · goed ${st.ok}`)}</span>` : ""}</div>
      <div class="ln-pair">${opt(0)}${opt(1)}</div>${fb}</section>`;
  },
  _lnPick(les, ex, pr, skip) {
    const e = pickPractice(les.cat, ex.map((x) => ({ ...x, gid: x.gid, i: x.i, end: x.end, x: { best: true } })), pr, skip); if (!e) return null;
    return { lesson: les.id, ex: ex.findIndex((x) => x.gid === e.gid && x.i === e.i), flip: Math.random() < 0.5, pick: null };
  },
  _lnAsk(les, ex) {
    const A = this._ln.ask && this._ln.ask.lesson === les.id ? this._ln.ask : null;
    const chips = QS.map((q) => `<button type="button" class="ln-chip${A?.q === q.id ? " on" : ""}" data-lnq="${q.id}">${esc(L(q.en, q.nl))}</button>`).join("");
    const form = !online() ? "" : `<form class="ln-form" data-lnform><input type="text" maxlength="200" enterkeyhint="send" autocomplete="off" placeholder="${esc(L("Ask your own question…", "Stel je eigen vraag…"))}" aria-label="${esc(L("Your question", "Je vraag"))}" data-lnin${A?.loading ? " disabled" : ""}><button type="submit" class="hs-btn pri"${A?.loading ? " disabled" : ""}>${L("Ask", "Vraag")}</button></form>`;
    return `<section class="ln-c ln-ask" aria-label="${esc(L("Ask", "Vraag"))}"><h4>${L("Ask", "Vraag")}</h4><div class="ln-chips">${chips}</div>${form}<div class="ln-ans" aria-live="polite">${this._lnAns(A, ex)}</div></section>`;
  },
  _lnChip(ex, c) {
    const e = ex[c.ex]; if (!e) return "";
    const thumb = e.model.spot && e.board ? cropSvg(e.board, c.side === "p" ? e.p : e.q, { w: 56, color: this._lnColor(e.pid), label: "" }) : `<i class="ln-ti sm" aria-hidden="true">${oicon(ICON[c.side === "p" ? e.pk : e.bk] || "target")}</i>`;
    return `<button type="button" class="ln-rc" data-lnref="${c.ex}"><span class="ln-ref">${c.ex + 1}</span>${thumb}<small>${c.side === "q" ? L("better", "beter") : esc(day(e.end))}</small></button>`;
  },
  _lnAns(a, ex) {
    if (!a) return "";
    if (a.loading) return `<p class="ln-wait" role="status"><i class="ln-spin" aria-hidden="true"></i>${L("Thinking…", "Aan het denken…")}</p>`;
    if (a.err) return `<p class="ln-err" role="alert">${esc(a.err)}</p>`;
    if (a.local) {
      const x = a.local;
      return `<div class="ln-a"><p class="ln-lead">${esc(x.lead)}</p>${x.text ? `<p class="ln-two"><span class="soft">${esc(x.text)}</span></p>` : ""}<div class="ln-refs">${x.chips.map((c) => this._lnChip(ex, c)).join("")}</div>${x.extra ? `<p class="ln-two"><span class="soft">${esc(x.extra.text)}</span></p><div class="ln-refs">${x.extra.chips.map((c) => this._lnChip(ex, c)).join("")}</div>` : ""}</div>`;
    }
    const used = []; const html = esc(a.answer || "").replace(/\[(\d{1,2})\]/g, (m, d) => { const i = +d - 1; if (!ex[i]) return ""; if (!used.includes(i)) used.push(i); return `<button type="button" class="ln-ref in" data-lnref="${i}" aria-label="${esc(L("Example", "Voorbeeld"))} ${d}">${d}</button>`; });
    const m = html.match(/^(.+?[.!?])(\s+[\s\S]*)?$/), lead = m ? m[1] : html, rest = m?.[2]?.trim() || "";
    return `<div class="ln-a"><p class="ln-lead">${lead}</p>${rest ? `<p>${rest}</p>` : ""}${a.points?.length ? `<ul class="ln-pts">${a.points.slice(0, 4).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}${used.length ? `<div class="ln-refs">${used.map((i) => this._lnChip(ex, { ex: i, side: "p" })).join("")}</div>` : ""}<small class="ln-note">${L("Written by AI from your games · may contain mistakes", "Geschreven door AI uit je potjes · kan fouten bevatten")}</small></div>`;
  },
  /** a mechanism lesson (a scarce resource, robber losses, 4:1 trades): the numbers per game next to the bots', and the same Ask */
  _lnMechPage(les) {
    const m = this._lnMech(les), ser = les.series;
    const head = `<section class="ln-c ln-focus"><span class="ln-row end"><span class="ln-big2">${m.big}</span><span class="ln-sub">${L("in", "in")} <b>${les.k} ${L("of", "van")} ${les.N}</b> ${L("games", "potjes")}</span></span>
      ${this._lnStrip(ser, les.kind === "res" ? "flag" : "n")}<span class="ln-two"><span class="soft">${esc(m.line)}</span><span class="soft">${L("Counted from your saved games; the bots are the baseline.", "Geteld uit je bewaarde potjes; de bots zijn de maatstaf.")}</span></span></section>`;
    const A = this._ln.ask && this._ln.ask.lesson === les.id ? this._ln.ask : null;
    const chips = QS.map((q) => `<button type="button" class="ln-chip${A?.q === q.id ? " on" : ""}" data-lnq="${q.id}">${esc(L(q.en, q.nl))}</button>`).join("");
    const ans = A?.local ? `<div class="ln-a"><p class="ln-lead">${esc(A.local.lead)}</p><p class="ln-two"><span class="soft">${esc(A.local.text)}</span></p></div>` : "";
    return head + `<section class="ln-c ln-ask"><h4>${L("Ask", "Vraag")}</h4><div class="ln-chips">${chips}</div><div class="ln-ans" aria-live="polite">${ans}</div></section>`;
  },
  _lnMechAnswer(les, q) {
    const m = this._lnMech(les);
    const lead = les.kind === "res" ? L(`${cap(rname(les.res))} was scarce at turn 5 in ${les.k} of ${les.N} games.`, `${cap(rname(les.res))} was schaars bij beurt 5 in ${les.k} van ${les.N} potjes.`) : les.kind === "rob" ? L(`You lost ${num(Math.round(les.mine))} cards a game to the robber and 7s.`, `Je verloor ${num(Math.round(les.mine))} kaarten per potje aan de rover en 7.`) : L(`You traded 4:1 about ${num(Math.round(les.mine * 10) / 10)} times a game.`, `Je ruilde ${num(Math.round(les.mine * 10) / 10)} keer per potje 4:1.`);
    const tip = q === "rule" ? (les.kind === "res" ? L("Check early whether a port or a trade can bring it in.", "Kijk vroeg of een haven of ruil het kan aanvoeren.") : les.kind === "rob" ? L("Keep fewer cards in hand when a 7 is likely.", "Houd minder kaarten vast als een 7 waarschijnlijk is.") : L("Look for a port or a player before you trade 4:1.", "Zoek een haven of speler voor je 4:1 ruilt.")) : m.line;
    return { lead, text: tip, chips: [], extra: null };
  },

  // ── events ──
  _lnClick(e) {
    const t = e.target.closest("[data-lnback],[data-lnpast],[data-lntab],[data-lnopen],[data-lnmore],[data-lnex],[data-lnref],[data-lnpick],[data-lnnext],[data-lnq]"); if (!t || !this._lnEl) return;
    const S = this._ln, d = t.dataset;
    if ("lnback" in d) { if (S.view === "lesson") { S.view = "home"; S.id = null; S.all = false; S.ask = null; S.pr = null; this._lnDraw(); this._lnEl.querySelector(".hs-scroll").scrollTop = 0; } else this.lessonsClose(); return; }
    if ("lnpast" in d) { this.lessonsClose(); this.histOpen(); return; }
    if ("lntab" in d) { S.tab = d.lntab; this._lnDraw(); return; }
    if ("lnopen" in d) { S.view = "lesson"; S.id = d.lnopen; S.all = false; S.ask = null; S.pr = null; this._lnDraw(); this._lnEl.querySelector(".hs-scroll").scrollTop = 0; return; }
    const les = this._lnCur(); if (!les) return;
    if ("lnmore" in d) { S.all = true; this._lnDraw(); return; }
    if ("lnex" in d) { const ex = this._lnExamples(les)[+d.lnex]; if (ex) this._lnGo({ gid: ex.gid, pid: ex.pid, i: ex.i, cat: les.cat }, les.id); return; }
    if ("lnref" in d) { const i = +d.lnref; if (i >= 2 && !S.all) { S.all = true; this._lnDraw(); } const a = this._lnEl.querySelector(`#lnex${i}`); if (a) { a.scrollIntoView({ block: "center", behavior: "smooth" }); a.classList.add("flash"); setTimeout(() => a.classList.remove("flash"), 1400); } return; }
    if ("lnpick" in d) { this._lnDoPick(les, +d.lnpick); return; }
    if ("lnnext" in d) { const pr = loadPractice(), ex = this._lnExamples(les); S.pr = this._lnPick(les, ex, pr, S.pr ? exKey(ex[S.pr.ex]) : null); this._lnDraw(); return; }
    if ("lnq" in d) {
      const ex = les.kind === "dec" ? this._lnExamples(les) : [];
      S.ask = { lesson: les.id, q: d.lnq, local: les.kind === "dec" ? answerDec(les, d.lnq, ex.map((x) => x.model)) : this._lnMechAnswer(les, d.lnq) }; this._lnDraw();
    }
  },
  _lnDoPick(les, k) {
    const S = this._ln, P = S.pr; if (!P || P.pick != null) return;
    P.pick = k; const ex = this._lnExamples(les), e = ex[P.ex], sides = P.flip ? ["q", "p"] : ["p", "q"], ok = sides[k] === "q" || e.a === e.b;
    const list = loadPractice(); list.push({ key: exKey(e), cat: les.cat, ok, at: Date.now(), pick: sides[k] }); savePractice(list);
    this._lnDraw();
  },
  _lnSubmit(e) {
    if (!e.target.matches?.("[data-lnform]")) return;
    e.preventDefault(); const les = this._lnCur(), v = this._lnEl.querySelector("[data-lnin]")?.value.trim(); if (les && v) this._lnAskAI(les, v.slice(0, 200));
  },
  /** a free question: your numbers and your three biggest examples (numbered) go to the same explain endpoint as "Why?"; the answer's [1] [2] become chips */
  async _lnAskAI(les, q) {
    const lg = recapLang(), key = `${les.id}|${lg}|${norm(q)}`, cache = askCache(), S = this._ln, ex = this._lnExamples(les);
    const A = (S.ask = { lesson: les.id, q: "free", loading: false, err: null, answer: null, points: null });
    if (cache[key]) { Object.assign(A, cache[key]); this._lnDraw(); return; }
    if (!online()) { A.err = L("No connection. Check your internet and try again.", "Geen verbinding. Controleer je internet en probeer het opnieuw."); this._lnDraw(); return; }
    A.loading = true; this._lnDraw();
    const facts = this._lnFacts(les, ex), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
    let err = null, ans = null;
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "lesson", lang: lg, question: q.slice(0, 300), facts }), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) err = L("The AI is busy right now (too many requests). Try again in a minute.", "De AI is nu druk (te veel verzoeken). Probeer het over een minuut opnieuw."); else if (!r.ok || !j?.explain?.answer) err = L("No answer this time. Try again later.", "Nu geen antwoord. Probeer het later opnieuw.");
      else ans = { answer: String(j.explain.answer), points: (j.explain.points || []).map(String).slice(0, 4) };
    } catch (e) { err = e?.name === "AbortError" ? L("That took too long. Try again.", "Dat duurde te lang. Probeer het opnieuw.") : L("No connection. Check your internet and try again.", "Geen verbinding. Controleer je internet en probeer het opnieuw."); }
    clearTimeout(to);
    if (this._ln !== S || S.ask !== A) return;
    A.loading = false; A.err = err; if (ans) { Object.assign(A, ans); const o = askCache(); o[key] = ans; askSave(o); }
    if (this._lnEl) this._lnDraw();
  },
  _lnFacts(les, ex) {
    const exs = ex.slice(0, 3).map((e) => ({ ref: `[${e.i0 + 1}]`, game: day(e.end), turn: e.c === "setup" ? "set-up" : e.t, played: e.model.lines?.[0] || e.pk, better: e.model.lines?.[1] || e.bk, winChanceYouChose: `${e.b}%`, winChanceBetter: `${e.a}%` }));
    const mk = (l) => JSON.stringify({ note: "These are the player's own marked moves of one kind over several reviewed games. Answer the question from these facts only, in at most 3 short sentences; refer to an example by its ref like [1].", lesson: titleOf(les), games: `${les.k} of ${les.N}`, winChanceLostPerGame: les.cost != null ? `${Math.round(les.cost)}%` : undefined, examples: l });
    let s = mk(exs); for (let k = exs.length; s.length > 3800 && k > 0; k -= 1) s = mk(exs.slice(0, k - 1));
    return s.slice(0, 3900);
  },

  // ── going to a position in the review ──
  /** Opens the game of an example in the review's step view at that decision; Back returns to this lesson. */
  async _lnGo(e, lessonId) {
    this._lnOpening = true; this.lessonsClose();
    await this.histView(e.gid, "review", e.pid);
    this._lnOpening = false; this._lnReturn = { lesson: lessonId };
    let n = 0;
    const go = () => {
      if (!this._lnReturn || this._histView?.id !== e.gid) return;
      const ok = this._rvEl && this._rvPid === e.pid && this._rvOf?.(e.pid)?.results?.length && document.querySelector(".rv .rv-tabs");
      if (ok) { this._lnStepIn = true; this._rvEnterStep(e.i); this._rvStepFrom = null; return; }
      if (n++ < 150) setTimeout(go, 100);
    };
    go();
  },
};

export function installLessons(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  // Back from a step opened from Lessons: out of the game, back to the lesson
  wrap("_rvStepBack", function (orig, ...a) { if (this._lnStepIn && this._lnReturn) { this._rvStep = null; this._rvPbp = null; return this.histExit(); } return orig.apply(this, a); });
  wrap("histView", function (orig, ...a) { if (!this._lnOpening) { this._lnReturn = null; this._lnStepIn = false; } return orig.apply(this, a); });
  wrap("histExit", async function (orig, ...a) {
    const back = this._lnReturn; this._lnReturn = null; this._lnStepIn = false;
    const r = await orig.apply(this, a);
    if (back) { this.histClose(); this.lessonsOpen({ lesson: back.lesson }); }
    return r;
  });
}
