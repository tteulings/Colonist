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
  en: { btn: "AI recap", wait: "Writing recap…", foot: "Written by AI from this review · may contain mistakes", regen: "Regenerate", retry: "Try again", title: "AI recap", turn: "Turn", luckOrPlay: "Luck or play", v: { luck: "Luck", play: "Play", both: "Both" }, luck: "luck", moves: "moves", tip: "Tip", go: "Show this turn",
    rate: "The recap service is busy right now (too many requests). Try again in a minute.", time: "The recap took too long. Try again.", net: "No connection to the recap service. Check your internet and try again.", fail: "The recap could not be written. Try again later.", none: "There is not enough in this review to write a recap." },
  nl: { btn: "AI-terugblik", wait: "Terugblik schrijven…", foot: "Geschreven door AI op basis van deze review · kan fouten bevatten", regen: "Opnieuw", retry: "Probeer opnieuw", title: "AI-terugblik", turn: "Beurt", luckOrPlay: "Geluk of spel", v: { luck: "Geluk", play: "Spel", both: "Beide" }, luck: "geluk", moves: "zetten", tip: "Tip", go: "Toon deze beurt",
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
      return `<li><button type="button" class="rc-tp" data-rctp="${isNum(tp.turn) ? tp.turn : ""}" data-rcq="${q ?? ""}" aria-label="${esc(t.go)}: ${esc(t.turn)} ${esc(tp.turn)}"><span class="rc-top"><span class="rc-chip">${t.turn} ${esc(tp.turn)}</span>${dot}${who}${chg}</span><b class="rc-ti">${esc(tp.title)}</b><span class="rc-tx">${inline(tp.text)}</span></button></li>`;
    }).join("");
    const lp = rc.luckOrPlay, vd = lp && t.v[lp.verdict] ? lp.verdict : null;
    const nums = lp && (isNum(lp.luck) || isNum(lp.moves)) ? `<span class="rc-nums">${isNum(lp.luck) ? `${t.luck} ${sgn(lp.luck)}%` : ""}${isNum(lp.luck) && isNum(lp.moves) ? " \u00b7 " : ""}${isNum(lp.moves) ? `${t.moves} ${sgn(lp.moves)}%` : ""}</span>` : "";
    return `${rc.headline ? `<p class="rc-head"><b>${inline(rc.headline)}</b></p>` : ""}${rows ? `<ol class="rc-tps">${rows}</ol>` : ""}`
      + (lp?.text ? `<div class="rc-lop"><div class="rc-lh"><b>${t.luckOrPlay}</b>${vd ? `<span class="rc-badge ${vd}">${t.v[vd]}</span>` : ""}${nums}</div><p>${inline(lp.text)}</p></div>` : "")
      + (rc.tip ? `<p class="rc-tip"><b>${t.tip}:</b> ${inline(rc.tip)}</p>` : "");
  },
  /** Tap on a turning point: the review's step mode on that turn (the nearest turn the person has a decision in). */
  _rcGoTurn(T, q) {
    try {
      const me = this._rvPid, rv = this._rvOf?.(me); if (!rv?.results?.length || !Number.isFinite(T)) return;
      const ds = this._rvDecisions(rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i));
      const turns = this._tvTurns(ds); if (!turns.length) return;
      const near = turns.reduce((a, x) => (Math.abs(x.T - T) < Math.abs(a.T - T) ? x : a), turns[0]);
      const open = new Set(q != null && q !== "" ? [+q] : [me]);
      this._tv = { pid: me, ov: !open.has(me), open }; this._tvKeep = true; this._rvQ = "all";
      try { this._rvEnterStep(near.d.i); } finally { this._tvKeep = false; }
    } catch (e) { console.warn("recap goto", e); }
  },
  _rcOnline() { return typeof navigator === "undefined" || navigator.onLine !== false; },
  _rcSaved() { const r = this._rv?.recap; return r?.text && r.pid === this._rvPid ? r : null; },
  /** The card (a finished game's Overview only). Empty when there is nothing to show. */
  _rcBox() {
    if (!this.winner || this._rvMid || !this._rv) return "";
    return `<div data-rcbox>${this._rcInner()}</div>`;
  },
  _rcInner() {
    const lang = recapLang(), t = T[lang], S = this._rcSaved(), U = this._rcUi;
    const load = U?.pid === this._rvPid && U.loading;
    if (load) return `<section class="rv-card rc-card" role="status" aria-live="polite"><div class="rv-gt"><b>${t.title}</b></div><p class="rc-wait"><i class="rc-spin" aria-hidden="true"></i>${t.wait}</p></section>`;
    const err = U?.pid === this._rvPid && U.err ? `<p class="rc-err" role="alert">${esc(t[U.err] || t.fail)}</p>` : "";
    if (S) {
      const rl = T[S.lang] ? S.lang : lang;
      return `<section class="rv-card rc-card"><div class="rv-gt"><b>${T[rl].title}</b>${this._rcOnline() ? `<button type="button" class="rc-link" data-rcgo>${t.regen}</button>` : ""}</div>${err}<div class="rc-text" lang="${rl}">${S.recap?.turningPoints ? this._rcStructHtml(S.recap, T[rl]) : recapHtml(S.text)}</div><p class="rc-foot">${T[rl].foot}</p></section>`;
    }
    if (!this._rcOnline()) return "";
    return `<div class="rc-row">${err}<button type="button" class="rv-btn rc-btn" data-rcgo>${t.btn}</button></div>`;
  },
  _rcBind(root) {
    const box = root.querySelector("[data-rcbox]");
    if (!box) return;
    box.querySelector("[data-rcgo]")?.addEventListener("click", () => this._rcRun());
    box.querySelectorAll("[data-rctp]").forEach((b) => b.addEventListener("click", () => this._rcGoTurn(parseInt(b.dataset.rctp, 10), b.dataset.rcq)));
  },
  _rcRefresh() {
    const box = document.querySelector("[data-rcbox]");
    if (!box) return;
    box.innerHTML = this._rcInner();
    this._rcBind(box.parentElement);
  },
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
