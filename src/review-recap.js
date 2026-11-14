// v1.62 AI recap: a short story of a finished game, written by an LLM behind an Azure Function (azure/recap-fn). The app sends
// the facts of the review (src/review/recap-facts.js) and the language; no key is in the app. The text is kept in the saved
// review (R.recap), so reopening the game does not ask again; "Regenerate" asks anew. Only online; not in a mid-game check.
import { recapFacts } from "./review/recap-facts.js";

export const RECAP_URL = "https://katan-recap-fn.azurewebsites.net/api/recap";
export const RECAP_LANG_KEY = "colonist_recap_lang";
export const recapLang = () => { try { return localStorage.getItem(RECAP_LANG_KEY) === "nl" ? "nl" : "en"; } catch (_) { return "en"; } };
export const setRecapLang = (l) => { try { localStorage.setItem(RECAP_LANG_KEY, l === "nl" ? "nl" : "en"); } catch (_) { /* private mode */ } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = {
  en: { btn: "AI recap", wait: "Writing recap…", foot: "Written by AI from this review · may contain mistakes", regen: "Regenerate", retry: "Try again", title: "AI recap",
    rate: "The recap service is busy right now (too many requests). Try again in a minute.", time: "The recap took too long. Try again.", net: "No connection to the recap service. Check your internet and try again.", fail: "The recap could not be written. Try again later.", none: "There is not enough in this review to write a recap." },
  nl: { btn: "AI-terugblik", wait: "Terugblik schrijven…", foot: "Geschreven door AI op basis van deze review · kan fouten bevatten", regen: "Opnieuw", retry: "Probeer opnieuw", title: "AI-terugblik",
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

export const ReviewRecapMixin = {
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
      return `<section class="rv-card rc-card"><div class="rv-gt"><b>${T[rl].title}</b>${this._rcOnline() ? `<button type="button" class="rc-link" data-rcgo>${t.regen}</button>` : ""}</div>${err}<div class="rc-text" lang="${rl}">${recapHtml(S.text)}</div><p class="rc-foot">${T[rl].foot}</p></section>`;
    }
    if (!this._rcOnline()) return "";
    return `<div class="rc-row">${err}<button type="button" class="rv-btn rc-btn" data-rcgo>${t.btn}</button></div>`;
  },
  _rcBind(root) {
    const box = root.querySelector("[data-rcbox]");
    if (!box) return;
    box.querySelector("[data-rcgo]")?.addEventListener("click", () => this._rcRun());
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
    let err = null, text = null;
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, facts: f.json }), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) err = "rate";
      else if (!r.ok || !j?.text) err = "fail";
      else text = String(j.text);
    } catch (e) { err = e?.name === "AbortError" ? "time" : "net"; }
    clearTimeout(to);
    this._rcUi = { pid, loading: false, err };
    if (text && this._rv === R) {
      R.recap = { text, lang, pid, at: Date.now(), n: f.json.length };
      try { this._rvSave?.(); } catch (_) { /* best effort */ }
      try { this._histSoon?.(); } catch (_) { /* best effort */ }
    }
    this._rcRefresh();
  },
};
