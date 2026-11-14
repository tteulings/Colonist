// v1.64 "Why?": ask the AI why a move was bad / why A is better / what usually happens next, for one moment of the review. The board
// with the A and B rings is the picture; the answer's "highlight" flips the A / A+B / B toggle and pulses that ring. Answers are kept
// per moment + question in the saved review (R.explain), so reopening does not ask again. Online only (cached answers still show).
import { momentFacts } from "./review/moment-facts.js";
import { RECAP_URL, recapLang } from "./review-recap.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = {
  en: { why: "Why?", title: "Ask why", close: "Close", bad: "Why is this bad?", better: "Why is A better?", next: "What usually happens next?", ph: "Ask about this move…", send: "Ask", wait: "Thinking…", foot: "Written by AI from this review · may contain mistakes",
    rate: "The AI is busy right now (too many requests). Try again in a minute.", time: "That took too long. Try again.", net: "No connection. Check your internet and try again.", fail: "No answer this time. Try again later.", none: "Not enough in this review to explain this move." },
  nl: { why: "Waarom?", title: "Vraag waarom", close: "Sluiten", bad: "Waarom is dit slecht?", better: "Waarom is A beter?", next: "Wat gebeurt er daarna?", ph: "Vraag iets over deze zet…", send: "Vraag", wait: "Even denken…", foot: "Geschreven door AI op basis van deze review · kan fouten bevatten",
    rate: "De AI is nu druk (te veel verzoeken). Probeer het over een minuut opnieuw.", time: "Dat duurde te lang. Probeer opnieuw.", net: "Geen verbinding. Controleer je internet en probeer opnieuw.", fail: "Nu geen antwoord. Probeer het later opnieuw.", none: "Er staat te weinig in deze review om deze zet uit te leggen." },
};
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const keyOf = (i, lang, q) => `${i}|${lang}|${String(q).trim().toLowerCase().replace(/\s+/g, " ")}`;

export const ReviewExplainMixin = {
  _exUiOf(d) { const U = this._exUi; return U && U.i === d.i && U.pid === this._rvPid ? U : null; },
  _exAny(d) { const c = this._rv?.explain, p = `${d.i}|`; return !!c && Object.keys(c).some((k) => k.startsWith(p)); },
  /** Only the person's real choices (not trivial ones, not the others' moves) get a Why?. */
  _exCan(d) { return !!d?.x?.label && d.cls !== "triv" && !this._rvMid && this._rvIsYou?.(this._rvPid) && this._rv && !d.x.trivial; },
  _exBox(d) { return this._exCan(d) ? `<div class="ex" data-exbox>${this._exInner(d)}</div>` : ""; },
  _exInner(d) {
    const lang = recapLang(), t = T[lang], U = this._exUiOf(d);
    if (!U?.open) return online() || this._exAny(d) ? `<button type="button" class="rv-btn ex-btn" data-exopen aria-expanded="false"><i aria-hidden="true">?</i>${t.why}</button>` : "";
    const chips = [...(d.same ? [] : [["bad", t.bad], ["better", t.better]]), ["next", t.next]].map(([k, l]) => `<button type="button" class="ex-chip${U.q === l ? " on" : ""}" data-exq="${esc(l)}"${U.loading || !online() && !this._rv?.explain?.[keyOf(d.i, lang, l)] ? " disabled" : ""}>${esc(l)}</button>`).join("");
    let body = "";
    if (U.loading) body = `<p class="rc-wait" role="status" aria-live="polite"><i class="rc-spin" aria-hidden="true"></i>${t.wait}</p>`;
    else if (U.err) body = `<p class="rc-err" role="alert">${esc(t[U.err] || t.fail)}</p>`;
    else if (U.ans) {
      const a = U.ans, m = String(a.answer || "").match(/^(.+?[.!?])(\s+[\s\S]*)?$/), lead = m ? m[1] : String(a.answer || ""), rest = m?.[2] ? m[2].trim() : "";
      body = `<div class="ex-a" lang="${lang}"><p><b>${esc(lead)}</b>${rest ? ` ${esc(rest)}` : ""}</p>${a.points?.length ? `<ul class="ex-pts">${a.points.slice(0, 4).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}<small>${t.foot}</small></div>`;
    }
    return `<section class="ex-p" aria-label="${t.title}"><div class="ex-h"><b>${t.why}</b><button type="button" class="ex-x" data-exclose aria-label="${t.close}">&times;</button></div>
      <div class="ex-chips">${chips}</div>
      <form class="ex-f" data-exform><input type="text" maxlength="300" enterkeyhint="send" autocomplete="off" placeholder="${esc(t.ph)}" aria-label="${esc(t.ph)}" data-exin${U.loading ? " disabled" : ""}><button type="submit" class="rv-btn pri" ${U.loading ? "disabled" : ""}>${t.send}</button></form>${body}</section>`;
  },
  _exRefresh(d) {
    const box = this._rvEl?.querySelector("[data-exbox]"); if (!box) return;
    const kept = box.querySelector("[data-exin]")?.value;
    box.innerHTML = this._exInner(d); this._exBind(box.parentElement, d);
    if (kept) { const i = box.querySelector("[data-exin]"); if (i && !i.disabled) i.value = kept; }
  },
  _exBind(root, d) {
    const box = root.querySelector?.("[data-exbox]"); if (!box) return;
    box.querySelector("[data-exopen]")?.addEventListener("click", () => { this._exUi = { ...(this._exUiOf(d) || {}), i: d.i, pid: this._rvPid, open: true }; this._exRefresh(d); box.querySelector("[data-exin]")?.focus?.({ preventScroll: true }); });
    box.querySelector("[data-exclose]")?.addEventListener("click", () => { if (this._exUi) this._exUi.open = false; this._exRefresh(d); });
    box.querySelectorAll("[data-exq]").forEach((b) => b.addEventListener("click", () => this._exAsk(d, b.dataset.exq)));
    box.querySelector("[data-exform]")?.addEventListener("submit", (e) => { e.preventDefault(); const v = box.querySelector("[data-exin]").value.trim(); if (v) this._exAsk(d, v.slice(0, 300)); });
  },
  /** The answer's highlight: switch the board toggle to A or B and pulse that ring. */
  _exHighlight(d, h) {
    if ((h !== "A" && h !== "B") || d.same || this._rvStep !== d.i) return;
    this._rvAB = h; this._exPulse = h;
    this._rvDrawReview();
    this._rvEl?.querySelector(".rs-marks")?.classList.add(`pulse-${h}`);
    this._rvEl?.querySelector(".rs-board")?.scrollIntoView?.({ block: "nearest" });
  },
  async _exAsk(d, q) {
    const R = this._rv, lang = recapLang(), pid = this._rvPid, key = keyOf(d.i, lang, q);
    if (!R || !q) return;
    const U = this._exUi = { i: d.i, pid, open: true, q, tp: this._exUi?.i === d.i ? this._exUi.tp : null, loading: false, err: null, ans: null };
    const hit = R.explain?.[key];
    if (hit) { U.ans = hit; this._exRefresh(d); this._exHighlight(d, hit.highlight); return; }
    if (!online()) { U.err = "net"; this._exRefresh(d); return; }
    let f = null; try { f = momentFacts(this, d, { tpTurn: U.tp }); } catch (_) { f = null; }
    if (!f) { U.err = "none"; this._exRefresh(d); return; }
    U.loading = true; this._exRefresh(d);
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
    let err = null, ans = null;
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "explain", lang, question: q.slice(0, 300), facts: f.json }), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) err = "rate"; else if (!r.ok || !j?.explain?.answer) err = "fail";
      else ans = { answer: String(j.explain.answer), points: (j.explain.points || []).map(String).slice(0, 4), highlight: ["A", "B"].includes(j.explain.highlight) ? j.explain.highlight : "none" };
    } catch (e) { err = e?.name === "AbortError" ? "time" : "net"; }
    clearTimeout(to);
    if (this._exUi !== U) return; // another question or moment took over
    U.loading = false; U.err = err; U.ans = ans;
    if (ans && this._rv === R) { (R.explain ||= {})[key] = ans; try { this._rvSave?.(); } catch (_) { /* best effort */ } try { this._histSoon?.(); } catch (_) { /* best effort */ } }
    if (this._rvStep === d.i) { this._exRefresh(d); if (ans) this._exHighlight(d, ans.highlight); }
  },
};
