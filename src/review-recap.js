// v1.62 AI recap: a short story of a finished game, written by an LLM behind an Azure Function (azure/recap-fn). The app sends
// the facts of the review (src/review/recap-facts.js) and the language; no key is in the app. The text is kept in the saved
// review (R.recap), so reopening the game does not ask again; "Regenerate" asks anew. Only online; not in a mid-game check.
import { recapFacts } from "./review/recap-facts.js";

export const RECAP_URL = "https://katan-recap-fn.azurewebsites.net/api/recap";
export const RECAP_LANG_KEY = "colonist_recap_lang";
export const recapLang = () => { try { return localStorage.getItem(RECAP_LANG_KEY) === "nl" ? "nl" : "en"; } catch (_) { return "en"; } };
export const setRecapLang = (l) => { try { localStorage.setItem(RECAP_LANG_KEY, l === "nl" ? "nl" : "en"); } catch (_) { /* private mode */ } };
export const RECAP_POINTS_KEY = "colonist_recap_points";
export const recapPoints = () => { try { const n = parseInt(localStorage.getItem(RECAP_POINTS_KEY), 10); return n >= 2 && n <= 4 ? n : 3; } catch (_) { return 3; } };
export const setRecapPoints = (n) => { try { localStorage.setItem(RECAP_POINTS_KEY, String(Math.max(2, Math.min(4, parseInt(n, 10) || 3)))); } catch (_) { /* private mode */ } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = {
  en: { btn: "AI recap", wait: "Writing recap…", foot: "Written by AI from this review · may contain mistakes", regen: "Regenerate", retry: "Try again", title: "AI recap", turn: "Turn", luckOrPlay: "Luck or play", v: { luck: "Luck", play: "Play", both: "Both" }, luck: "luck", moves: "moves", tip: "Tip", lesson: "Lesson", go: "Show this turn", why: "Why?", whyL: "Ask why about this moment",
    rate: "The recap service is busy right now (too many requests). Try again in a minute.", time: "The recap took too long. Try again.", net: "No connection to the recap service. Check your internet and try again.", fail: "The recap could not be written. Try again later.", none: "There is not enough in this review to write a recap." },
  nl: { btn: "AI-terugblik", wait: "Terugblik schrijven…", foot: "Geschreven door AI op basis van deze review · kan fouten bevatten", regen: "Opnieuw", retry: "Probeer opnieuw", title: "AI-terugblik", turn: "Beurt", luckOrPlay: "Geluk of spel", v: { luck: "Geluk", play: "Spel", both: "Beide" }, luck: "geluk", moves: "zetten", tip: "Tip", lesson: "Les", go: "Toon deze beurt", why: "Waarom?", whyL: "Vraag waarom bij dit moment",
    rate: "De terugblik-service is nu druk (te veel verzoeken). Probeer het over een minuut opnieuw.", time: "De terugblik duurde te lang. Probeer opnieuw.", net: "Geen verbinding met de terugblik-service. Controleer je internet en probeer opnieuw.", fail: "De terugblik kon niet worden geschreven. Probeer het later opnieuw.", none: "Er staat te weinig in deze review voor een terugblik." },
};
const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
/** Simple formatting of the model's text: # headings, **bold heading** lines, - bullets, paragraphs. Everything is escaped first. */
export function recapHtml(text) {
  const out = []; let ul = false;
  const close = () => { if (ul) { out.push("</ul>"); ul = false; } };
  String(text || "").split(/\r?\n/).forEach((raw) => {
    const l = raw.trim();
    if (!l) { close(); return; }
    let m;
    if ((m = l.match(/^#{1,6}\s+(.*)$/)) || (m = l.match(/^\*\*([^*]+?)\*\*:?$/))) { close(); out.push(`<h4>${inline(m[1])}</h4>`); }
    else if ((m = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/))) { if (!ul) { out.push("<ul>"); ul = true; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^(?:\*\*)?(?:Tip|Tipp?)(?:\*\*)?:(?:\*\*)?\s*(.+)$/i))) { close(); out.push(`<p class="rc-tip"><b>${/^tip/i.test(l.replace(/^\*\*/, "")) ? l.replace(/^\*\*/, "").slice(0, 3) : "Tip"}:</b> ${inline(m[1])}</p>`); }
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  });
  close();
  return out.join("");
}

const KIND_IC = { played_well: "\u2713", placement: "\u2316", plan: "\u2192", robber: "\u265f", trading: "\u21c4", development_cards: "\u2663", timing: "\u23f1", board_reading: "\u25ce" };
const KIND = { played_well: { en: "Played well", nl: "Goed gespeeld" }, placement: { en: "Placement", nl: "Plaatsing" }, plan: { en: "Plan", nl: "Plan" }, robber: { en: "Robber", nl: "Rover" }, trading: { en: "Trading", nl: "Handelen" }, development_cards: { en: "Development cards", nl: "Ontwikkelingskaarten" }, timing: { en: "Timing", nl: "Timing" }, board_reading: { en: "Reading the board", nl: "Het bord lezen" } };
const lang_ = (t) => (t === T.nl ? "nl" : "en");
const sgn = (v) => (v > 0 ? `+${Math.round(v)}` : v < 0 ? `\u2212${Math.abs(Math.round(v))}` : "0");
const isNum = (v) => typeof v === "number" && isFinite(v);

export const ReviewRecapMixin = {
  /** The seat a turning point's player name stands for (null when it matches nobody). */
  _rcSeat(name) {
    const nm = String(name ?? "").trim().toLowerCase(), P = this.players || [];
    if (!nm) return null;
    const hit = P.find((p) => String(this._rvNm?.(p.id) ?? p.name).toLowerCase() === nm) || P.find((p) => String(p.name ?? "").toLowerCase() === nm);
    if (hit) return hit.id;
    if (/^(you|jij|je|jou|u)$/.test(nm)) { const y = P.find((p) => this._rvIsYou?.(p.id)); return y ? y.id : null; }
    const part = P.find((p) => nm.includes(String(p.name ?? "\u0000").toLowerCase()));
    return part ? part.id : null;
  },
  /** The structured recap: headline, turning points (tap = that turn in the review), luck or play, tip. */
  _rcStructHtml(rc, t) {
    const me = this._rvPid, rows = (rc.turningPoints || []).map((tp) => {
      const q = this._rcSeat(tp.player), you = q != null && this._rvIsYou?.(q), has = isNum(tp.from) && isNum(tp.to), up = has && tp.to >= tp.from;
      const chg = has ? `<span class="rc-chg ${you ? (up ? "up" : "dn") : q != null ? `pc-${q} opp` : ""}">${Math.round(tp.from)}% \u2192 ${Math.round(tp.to)}%</span>` : "";
      const dot = q != null ? `<i class="rvw-dot pc-${q}" aria-hidden="true"></i>` : "";
      const who = `<span class="rc-who${q != null ? ` pc-${q}` : ""}">${esc(tp.player)}</span>`;
      return `<li><button type="button" class="rc-tp" data-rctp="${isNum(tp.turn) ? tp.turn : ""}" data-rcq="${q ?? ""}" aria-label="${esc(t.go)}: ${esc(t.turn)} ${esc(tp.turn)}"><span class="rc-top"><span class="rc-chip">${t.turn} ${esc(tp.turn)}</span>${dot}${who}${chg}</span><b class="rc-ti">${esc(tp.title)}</b><span class="rc-tx">${inline(tp.text)}</span></button>${isNum(tp.turn) && this._rcOnline() ? `<button type="button" class="rv-btn rc-why" data-rcwhy="${tp.turn}" data-rcq="${q ?? ""}" aria-label="${esc(t.whyL)}: ${esc(t.turn)} ${esc(tp.turn)}"><i aria-hidden="true">?</i>${t.why}</button>` : ""}</li>`;
    }).join("");
    const lp = rc.luckOrPlay && rc.luckOrPlay.verdict !== "none" && rc.luckOrPlay.text ? rc.luckOrPlay : null, vd = lp && t.v[lp.verdict] ? lp.verdict : null;
    const nums = lp && (isNum(lp.luck) || isNum(lp.moves)) ? `<span class="rc-nums">${isNum(lp.luck) ? `${t.luck} ${sgn(lp.luck)}%` : ""}${isNum(lp.luck) && isNum(lp.moves) ? " \u00b7 " : ""}${isNum(lp.moves) ? `${t.moves} ${sgn(lp.moves)}%` : ""}</span>` : "";
    return `${rc.headline ? `<p class="rc-head"><b>${inline(rc.headline)}</b></p>` : ""}${rows ? `<ol class="rc-tps">${rows}</ol>` : ""}`
      + (lp?.text ? `<div class="rc-lop"><div class="rc-lh"><b>${t.luckOrPlay}</b>${vd ? `<span class="rc-badge ${vd}">${t.v[vd]}</span>` : ""}${nums}</div><p>${inline(lp.text)}</p></div>` : "")
      + (rc.lessonTitle && rc.tip ? `<div class="rc-lesson"><div class="rc-lh"><i class="rc-ki" aria-hidden="true">${KIND_IC[this._rcKind(rc)] || "\u2605"}</i><small>${t.lesson}${KIND[this._rcKind(rc)]?.[lang_(t)] ? ` \u00b7 ${KIND[this._rcKind(rc)][lang_(t)]}` : ""}</small></div><b>${inline(rc.lessonTitle)}</b><p>${inline(rc.tip)}</p></div>` : rc.tip ? `<p class="rc-tip"><b>${t.tip}:</b> ${inline(rc.tip)}</p>` : "");
  },
  /** Tap on a turning point: the review's step mode on that turn (the nearest turn the person has a decision in). */
  _rcGoTurn(T, q, why = false) {
    try {
      const me = this._rvPid, rv = this._rvOf?.(me); if (!rv?.results?.length || !Number.isFinite(T)) return;
      const ds = this._rvDecisions(rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i));
      const turns = this._tvTurns(ds); if (!turns.length) return;
      const near = turns.reduce((a, x) => (Math.abs(x.T - T) < Math.abs(a.T - T) ? x : a), turns[0]);
      const open = new Set(!why && q != null && q !== "" ? [+q] : [me]);
      this._tv = { pid: me, ov: !open.has(me), open }; this._tvKeep = true; this._rvQ = "all";
      if (why) this._exUi = { i: near.d.i, pid: me, open: true, tp: T };
      try { this._rvEnterStep(near.d.i); } finally { this._tvKeep = false; }
    } catch (e) { console.warn("recap goto", e); }
  },
  /** The recap's description of a turn (only when a recap is saved; never a network call). */
  _rcTp(T, P = this._rvPid) {
    const rc = this._rcSaved()?.recap; if (!rc?.turningPoints || T == null) return null;
    return rc.turningPoints.find((x) => x.turn === T && (P == null || this._rcSeat(x.player) == null || this._rcSeat(x.player) === P)) || null;
  },
  _rcTurnOf(d) { return this._st?.turnOf?.[d?.x?.s ?? 0] ?? d?.t ?? null; },
  /** One-line AI subtitle for a key moment row. */
  _rcSub(d) { const tp = this._rcTp(this._rcTurnOf(d)); return tp ? `<small class="rc-sub"><i>AI</i>${esc(tp.title)}: ${esc(tp.text)}</small>` : ""; },
  /** The turn's AI description at the top of the turn view / moment card. */
  _rcLine(d) {
    if (d?.k === "setup") return "";
    const tp = this._rcTp(this._rcTurnOf(d)); if (!tp) return "";
    return `<div class="rc-line"><i>AI</i><div><b>${esc(tp.title)}</b> <span>${inline(tp.text)}</span></div></div>`;
  },
  _rcOnline() { return typeof navigator === "undefined" || navigator.onLine !== false; },
  _rcSaved() { const r = this._rv?.recap; return r?.text && r.pid === this._rvPid ? r : null; },
  /** v1.64 the AI is woven through the Overview (no standalone card): the headline card on top, the turning points merged into the key
   *  moments (_rcMergeKeys), the luck-or-play verdict next to the luck summary (_rcLuckPlay), the lesson at the end (_rcBox). */
  _rcOk() { return !!this.winner && !this._rvMid && !!this._rv; },
  /** The lead of the Overview's Why card: label + Regenerate, the headline full width, a small footer (or the button / spinner / error). */
  _rcLead() {
    if (!this._rcOk()) return "";
    const lang = recapLang(), t = T[lang], S = this._rcSaved(), U = this._rcUi, mine = U?.pid === this._rvPid;
    if (mine && U.loading) return `<div class="rc-lead" role="status" aria-live="polite"><p class="rc-wait"><i class="rc-spin" aria-hidden="true"></i>${t.wait}</p></div>`;
    const err = mine && U.err ? `<p class="rc-err" role="alert">${esc(t[U.err] || t.fail)}</p>` : "";
    if (S) {
      const rl = T[S.lang] ? S.lang : lang, h = S.recap?.headline;
      return `<div class="rc-lead"><div class="rc-lh2"><small>${T[rl].title}</small>${this._rcOnline() ? `<button type="button" class="rc-link" data-rcgo>${t.regen}</button>` : ""}</div>${err}${h ? `<p class="rc-head" lang="${rl}"><b>${inline(h)}</b></p>` : `<div class="rc-text" lang="${rl}">${recapHtml(S.text)}</div>`}<p class="rc-foot">${T[rl].foot}</p></div>`;
    }
    if (!this._rcOnline() && !err) return "";
    return `<div class="rc-lead">${err}${this._rcOnline() ? `<button type="button" class="rv-btn rc-btn" data-rcgo>${t.btn}</button>` : ""}</div>`;
  },
  /** Standalone fallback when the Overview has no Why card (no luck analysis). */
  _rcHead() { const l = this._rcLead(); return l ? `<section class="rv-card rc-card rc-top">${l}</section>` : ""; },
  /** Luck or play, next to the luck summary (hidden when the recap says "none" or has none). */
  _rcLuckPlay() {
    const S = this._rcSaved(), lp = S?.recap?.luckOrPlay; if (!this._rcOk() || !lp || lp.verdict === "none" || !lp.text) return "";
    const t = T[T[S.lang] ? S.lang : recapLang()], vd = t.v[lp.verdict] ? lp.verdict : null;
    const nums = isNum(lp.luck) || isNum(lp.moves) ? `<span class="rc-nums">${isNum(lp.luck) ? `${t.luck} ${sgn(lp.luck)}%` : ""}${isNum(lp.luck) && isNum(lp.moves) ? " \u00b7 " : ""}${isNum(lp.moves) ? `${t.moves} ${sgn(lp.moves)}%` : ""}</span>` : "";
    return `<div class="rc-lop"><div class="rc-lh"><b>${t.luckOrPlay}</b>${vd ? `<span class="rc-badge ${vd}">${t.v[vd]}</span>` : ""}${nums}</div><p>${inline(lp.text)}</p></div>`;
  },
  /** The merged key moments: rows = [{ T, m, h }] (engine rows, by size). Each gets the AI title + text of its turn and a Why?; AI turning
   *  points with no engine row are added in turn order with an AI marker. Returns the html list, or null when there is no recap. */
  _rcMergeKeys(rows, { extra = true } = {}) {
    const S = this._rcSaved(), tps = S?.recap?.turningPoints; if (!this._rcOk() || !tps?.length) return null;
    const t = T[T[S.lang] ? S.lang : recapLang()], used = new Set(), ico = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const block = (tp) => { const q = this._rcSeat(tp.player), on = this._rcOnline(); return `<div class="rc-km"><b class="rc-ti">${esc(tp.title)}</b><p class="rc-tx" data-rcx tabindex="0" role="button" aria-expanded="false">${inline(tp.text)}</p>${isNum(tp.turn) && on ? `<button type="button" class="rv-btn rc-why" data-rcwhy="${tp.turn}" data-rcq="${q ?? ""}" aria-label="${esc(t.whyL)}: ${esc(t.turn)} ${esc(tp.turn)}"><i aria-hidden="true">?</i>${t.why}</button>` : ""}</div>`; };
    const out = rows.map((r) => {
      const tp = r.T != null ? tps.find((x) => x.turn === r.T && !used.has(x) && (r.P == null || this._rcSeat(x.player) == null || this._rcSeat(x.player) === r.P)) : null;
      if (tp) used.add(tp);
      return { T: r.T ?? 1e9, h: tp ? `<div class="rc-kw">${r.h}${block(tp)}</div>` : r.h };
    });
    if (extra) tps.forEach((tp) => {
      if (!isNum(tp.turn) || used.has(tp)) return; used.add(tp);
      const q = this._rcSeat(tp.player), has = isNum(tp.from) && isNum(tp.to), up = has && tp.to >= tp.from, you = q != null && this._rvIsYou?.(q);
      const chg = has ? `<b class="${you ? (up ? "pos" : "neg") : ""}">${Math.round(tp.from)}\u2192${Math.round(tp.to)}%</b>` : "";
      out.push({ T: tp.turn, h: `<div class="rc-kw ai"><button type="button" class="rs-key" data-rctp="${tp.turn}" data-rcq="${q ?? ""}" aria-label="${esc(t.go)}: ${esc(t.turn)} ${esc(tp.turn)}"><i class="rc-aim">AI</i><span class="t">${t.turn} ${esc(tp.turn)}</span><span class="x">${esc(tp.player)}</span>${chg}${ico}</button>${block(tp)}</div>` });
    });
    return out.sort((a, b) => a.T - b.T).map((x) => x.h).join("");
  },
  /** The lesson kind to show: "played_well" only when the luck-or-play verdict is luck and the moves cost is small; else no kind badge. */
  _rcKind(rc) {
    const k = rc?.lessonKind; if (k !== "played_well") return k;
    const lp = rc.luckOrPlay;
    return lp?.verdict === "luck" && (!isNum(lp.moves) || Math.abs(lp.moves) <= 5) ? k : null;
  },
  /** The lesson card, last on the Overview. */
  _rcBox() {
    const S = this._rcSaved(), rc = S?.recap; if (!this._rcOk() || !rc?.tip) return "";
    const rl = T[S.lang] ? S.lang : recapLang(), t = T[rl];
    if (!rc.lessonTitle) return `<section class="rv-card rc-card"><p class="rc-tip"><b>${t.tip}:</b> ${inline(rc.tip)}</p></section>`;
    const lk = this._rcKind(rc);
    return `<section class="rv-card rc-card"><div class="rc-lesson"><div class="rc-lh"><i class="rc-ki" aria-hidden="true">${KIND_IC[lk] || "\u2605"}</i><small>${t.lesson}${KIND[lk]?.[rl] ? ` \u00b7 ${KIND[lk][rl]}` : ""}</small></div><b>${inline(rc.lessonTitle)}</b><p>${inline(rc.tip)}</p></div></section>`;
  },
  _rcBind(root) {
    root.querySelectorAll("[data-rcgo]").forEach((b) => b.addEventListener("click", () => this._rcRun()));
    root.querySelectorAll("[data-rcwhy]").forEach((b) => b.addEventListener("click", () => this._rcGoTurn(parseInt(b.dataset.rcwhy, 10), b.dataset.rcq, true)));
    root.querySelectorAll("[data-rctp]").forEach((b) => b.addEventListener("click", () => this._rcGoTurn(parseInt(b.dataset.rctp, 10), b.dataset.rcq)));
    root.querySelectorAll("[data-rcx]").forEach((b) => { const f = () => { const o = b.classList.toggle("open"); b.setAttribute("aria-expanded", String(o)); }; b.addEventListener("click", f); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } }); });
  },
  _rcRefresh() { if (this._rvEl && !this._rvStep) { try { this._rvDrawReview(); } catch (e) { console.warn("recap refresh", e); } } },
  async _rcRun() {
    const R = this._rv, pid = this._rvPid, lang = recapLang();
    if (!R || !this.winner || this._rcUi?.loading) return;
    let f = null; try { f = recapFacts(this); } catch (_) { f = null; }
    this._rcUi = { pid, loading: !!f, err: f ? null : "none" };
    this._rcRefresh();
    if (!f) return;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000);
    let err = null, text = null, recap = null;
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, turningPoints: recapPoints(), facts: f.json }), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) err = "rate";
      else if (!r.ok || !j?.text) err = "fail";
      else { text = String(j.text); recap = j.recap?.turningPoints ? j.recap : null; }
    } catch (e) { err = e?.name === "AbortError" ? "time" : "net"; }
    clearTimeout(to);
    this._rcUi = { pid, loading: false, err };
    if (text && this._rv === R) {
      R.recap = { text, ...(recap ? { recap } : {}), lang, pid, at: Date.now(), n: f.json.length };
      try { this._rvSave?.(); } catch (_) { /* best effort */ }
      try { this._histSoon?.(); } catch (_) { /* best effort */ }
    }
    this._rcRefresh();
  },
};
