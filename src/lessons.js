// v1.71 Lessons: the mistakes of your reviewed games, by kind (src/lessons-data.js). The page lists the categories (most win chance lost
// first, "Your focus"), a category shows your examples (each opens the review's step view at that decision), "Train this" asks "What
// would you do?" on one of your own mistake positions (the step view with the answer hidden), and "Ask" sends your numbers to the same
// explain endpoint as Why?. Practice results and Ask answers live in localStorage (best effort). Styles: themes/lessons.css.
import { CATS, CAT, CLS_WORD, gameLessons, aggregate, moveText, betterText, practiceOptions, loadPractice, savePractice, practiceStats, pickPractice, exKey, askFacts } from "./lessons-data.js";
import { RECAP_URL, recapLang } from "./review-recap.js";
import { esc } from "./review-ui.js";

const CHEV_L = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEV_R = `<svg class="ic ln-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const LESSONS_ICON = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C4 5 4.5 4.5 5 4.5h5c1.1 0 2 .9 2 2V19c0-.8-.7-1.5-1.5-1.5H5c-.5 0-1-.4-1-1zM20 5.5c0-.5-.5-1-1-1h-5c-1.1 0-2 .9-2 2V19c0-.8.7-1.5 1.5-1.5H19c.5 0 1-.4 1-1z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
const CAT_IC = { setup: "⌖", robber: "♟", build: "⚒", dev: "♣", trade: "⇄", timing: "⏱" };
const TREND = { better: ["↓", "Getting better"], worse: ["↑", "Getting worse"], same: ["→", "About the same"] };
const PRESETS = ["How do I get better at this?", "What do I keep doing wrong?", "Give me one rule to follow"];
const ASK_KEY = "colonist_lessons_ask";
const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
const day = (t) => new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
const RL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const askCache = () => { try { return JSON.parse(localStorage.getItem(ASK_KEY) || "{}") || {}; } catch (_) { return {}; } };
const askSave = (o) => { try { const ks = Object.keys(o); if (ks.length > 60) ks.slice(0, ks.length - 60).forEach((k) => delete o[k]); localStorage.setItem(ASK_KEY, JSON.stringify(o)); } catch (_) { /* private mode */ } };
const norm = (q) => String(q).trim().toLowerCase().replace(/\s+/g, " ");

export const LessonsMixin = {
  /** All reviewed games of this device (one person's review each), newest first; cached until the list changes. */
  async _lnLoad() {
    const H = this.hist; await H.open();
    const metas = H.metas.filter((m) => m.me != null && m.rec && m.acc != null).sort((a, b) => b.end - a.end);
    const key = metas.map((m) => `${m.id}:${m.acc}:${m.fmt}:${m.prov ? 1 : 0}`).join(",");
    if (this._lnCache?.key === key) return this._lnCache;
    const games = [];
    for (const m of metas) { try { const g = gameLessons(m, await H.get(m.id)); if (g) games.push(g); } catch (_) { /* skip an unreadable game */ } }
    return (this._lnCache = { key, games, cats: aggregate(games) });
  },
  async lessonsOpen(o = {}) {
    this.lessonsClose();
    const el = document.createElement("div");
    el.className = "hs ln tm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Lessons");
    document.body.appendChild(el); this._lnEl = el;
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") this.lessonsClose(); });
    this._ln = { view: o.cat ? "cat" : "home", cat: o.cat || null, ask: null, all: false };
    this._lnDraw(true);
    try { this._lnData = await this._lnLoad(); } catch (_) { this._lnData = { games: [], cats: aggregate([]) }; }
    if (this._lnEl !== el) return;
    this._lnDraw();
  },
  lessonsClose() { this._lnEl?.remove(); this._lnEl = null; },
  _lnDraw(loading = false) {
    const el = this._lnEl; if (!el) return;
    const S = this._ln, D = this._lnData, pr = loadPractice();
    const scroll = el.querySelector(".hs-scroll")?.scrollTop || 0;
    const c = S.view === "cat" ? D?.cats.find((x) => x.id === S.cat) : null;
    const title = c ? c.name : "Lessons", sub = loading || !D ? "Loading…" : c ? `${c.n} ${c.n === 1 ? "mistake" : "mistakes"} in ${D.games.length} reviewed ${D.games.length === 1 ? "game" : "games"}` : D.games.length ? `From ${D.games.length} reviewed ${D.games.length === 1 ? "game" : "games"} on this device` : "Learn from your reviewed games";
    let body = "";
    if (loading || !D) body = `<p class="hs-note" role="status">Reading your reviews…</p>`;
    else if (!D.games.length) body = this._lnEmpty();
    else if (c) body = this._lnCat(c, pr);
    else body = this._lnHome(D, pr);
    el.innerHTML = `<div class="hs-bar"><button type="button" class="hs-x" data-lnback aria-label="${c ? "Back to Lessons" : "Back"}">${CHEV_L}</button><div><h3>${esc(title)}</h3><small>${esc(sub)}</small></div></div><div class="hs-scroll ln-scroll">${body}</div>`;
    el.querySelector(".hs-scroll").scrollTop = scroll;
    this._lnBind(el, c);
  },
  _lnEmpty() {
    return `<section class="ln-card ln-empty"><i class="ln-ico" aria-hidden="true">${LESSONS_ICON}</i><h4>Lessons appear after you review games</h4><p>Play a game, then open its game review. Your mistakes are then sorted by kind (set-up, robber, building…) so you can see what costs you the most and train it.</p><button type="button" class="hs-btn pri" data-lnpast>Past games</button></section>`;
  },
  _lnHome(D, pr) {
    const top = D.cats[0]?.lost > 0 ? D.cats[0].id : null;
    return `<ul class="ln-list">${D.cats.map((c) => {
      const p = practiceStats(pr, c.id), tr = c.trend && TREND[c.trend];
      return `<li><button type="button" class="ln-cat${c.id === top ? " focus" : ""}" data-lncat="${c.id}">
        <i class="ln-ci" aria-hidden="true">${CAT_IC[c.id]}</i>
        <span class="ln-main"><b>${c.name}${c.id === top ? `<em class="ln-focus">Your focus</em>` : ""}</b>
          <small>${c.n ? `${c.n} ${c.n === 1 ? "mistake" : "mistakes"} · <span class="neg">−${c.lost}% win chance</span>` : "No mistakes yet"}${tr ? ` · <span class="ln-tr ${c.trend}">${tr[0]} ${tr[1]}</span>` : ""}</small>
          ${c.titles.length ? `<span class="ln-tt">${c.titles.slice(0, 2).map((t) => `<i>${esc(t)}</i>`).join("")}</span>` : ""}
          ${p.n ? `<small class="ln-pr">practised ${p.n} · correct ${p.ok}</small>` : ""}</span>${CHEV_R}</button></li>`;
    }).join("")}</ul><p class="ln-foot">Counted from your reviewed games: moves marked could be better, mistake, blunder or missed chance.</p>`;
  },
  _lnCat(c, pr) {
    const p = practiceStats(pr, c.id), tr = c.trend && TREND[c.trend], S = this._ln, lang = recapLang();
    const ex = S.all ? c.ex : c.ex.slice(0, 12);
    const ans = S.ask && S.ask.cat === c.id ? S.ask : null;
    const ask = !online() ? "" : `<section class="ln-card ln-ask" aria-label="Ask about ${esc(c.name)}"><h4>Ask</h4>
      <div class="ln-chips">${PRESETS.map((q) => `<button type="button" class="ln-chip${ans?.q === q ? " on" : ""}" data-lnq="${esc(q)}"${ans?.loading ? " disabled" : ""}>${esc(q)}</button>`).join("")}</div>
      <form class="ln-form" data-lnform><input type="text" maxlength="200" enterkeyhint="send" autocomplete="off" placeholder="Ask about ${esc(c.name.toLowerCase())}…" aria-label="Your question" data-lnin${ans?.loading ? " disabled" : ""}><button type="submit" class="hs-btn pri"${ans?.loading ? " disabled" : ""}>Ask</button></form>
      <div class="ln-ans" aria-live="polite">${this._lnAns(ans)}</div></section>`;
    return `<section class="ln-card ln-rule"><small>The rule of thumb</small><p>${esc(c.rule)}</p></section>
      <section class="ln-stats" aria-label="Your numbers"><div><b>${c.n}</b><small>${c.n === 1 ? "mistake" : "mistakes"}</small></div><div><b class="neg">−${c.lost}%</b><small>win chance</small></div><div><b>${tr ? tr[0] : "–"}</b><small>${tr ? tr[1] : "trend"}</small></div></section>
      ${c.titles.length ? `<section class="ln-card"><small>Lessons from your AI recaps</small><ul class="ln-titles">${c.titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
      <button type="button" class="hs-btn pri ln-train" data-lntrain${c.ex.length ? "" : " disabled"}>Train this${p.n ? ` <small>practised ${p.n} · correct ${p.ok}</small>` : ""}</button>
      ${c.ex.length ? "" : `<p class="ln-foot">Nothing to train yet: no marked moves of this kind in your reviewed games.</p>`}
      ${ask}
      ${c.ex.length ? `<section class="ln-card ln-exs"><h4>Your examples</h4><ul class="ln-exl">${ex.map((e) => `<li><button type="button" class="ln-ex" data-lnex="${exKey(e)}" aria-label="Open ${esc(day(e.end))}, ${e.k === "setup" ? "set-up" : `turn ${e.t}`}">
        <span class="ln-exh"><small>${esc(day(e.end))} · ${e.k === "setup" ? "Set-up" : `Turn ${e.t}`} · ${CLS_WORD[e.cls]}</small><em class="neg">−${e.gp}%</em></span>
        <span class="ln-exm">${esc(moveText(e))}</span><span class="ln-exb">Better: ${esc(betterText(e))}</span></button></li>`).join("")}</ul>
        ${!S.all && c.ex.length > 12 ? `<button type="button" class="hs-btn" data-lnall>Show all ${c.ex.length}</button>` : ""}</section>` : ""}`;
  },
  _lnAns(a) {
    if (!a) return "";
    if (a.loading) return `<p class="rc-wait" role="status"><i class="rc-spin" aria-hidden="true"></i>Thinking…</p>`;
    if (a.err) return `<p class="rc-err" role="alert">${esc(a.err)}</p>`;
    const m = String(a.answer || "").match(/^(.+?[.!?])(\s+[\s\S]*)?$/), lead = m ? m[1] : String(a.answer || ""), rest = m?.[2]?.trim() || "";
    return `<div class="ex-a"><p><b>${esc(lead)}</b>${rest ? ` ${esc(rest)}` : ""}</p>${a.points?.length ? `<ul class="ex-pts">${a.points.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<small>Written by AI from your reviews · may contain mistakes</small></div>`;
  },
  _lnBind(el, c) {
    el.querySelector("[data-lnback]").addEventListener("click", () => { if (this._ln.view === "cat") { this._ln = { view: "home", cat: null, ask: null, all: false }; this._lnDraw(); } else this.lessonsClose(); });
    el.querySelector("[data-lnpast]")?.addEventListener("click", () => { this.lessonsClose(); this.histOpen(); });
    el.querySelectorAll("[data-lncat]").forEach((b) => b.addEventListener("click", () => { this._ln = { view: "cat", cat: b.dataset.lncat, ask: null, all: false }; this._lnDraw(); el.querySelector(".hs-scroll").scrollTop = 0; }));
    if (!c) return;
    el.querySelector("[data-lnall]")?.addEventListener("click", () => { this._ln.all = true; this._lnDraw(); });
    el.querySelector("[data-lntrain]")?.addEventListener("click", () => this.lessonsPractice(c.id));
    el.querySelectorAll("[data-lnex]").forEach((b) => b.addEventListener("click", () => { const e = c.ex.find((x) => exKey(x) === b.dataset.lnex); if (e) this._lnGo(e, null); }));
    el.querySelectorAll("[data-lnq]").forEach((b) => b.addEventListener("click", () => this._lnAsk(c, b.dataset.lnq)));
    el.querySelector("[data-lnform]")?.addEventListener("submit", (ev) => { ev.preventDefault(); const v = el.querySelector("[data-lnin]").value.trim(); if (v) this._lnAsk(c, v.slice(0, 200)); });
  },
  async _lnAsk(c, q) {
    const lang = recapLang(), key = `${c.id}|${lang}|${norm(q)}`, cache = askCache();
    const S = this._ln, A = S.ask = { cat: c.id, q, loading: false, err: null, answer: null, points: null };
    if (cache[key]) { Object.assign(A, cache[key]); this._lnDraw(); return; }
    if (!online()) { A.err = "No connection. Check your internet and try again."; this._lnDraw(); return; }
    A.loading = true; this._lnDraw();
    const pr = practiceStats(loadPractice(), c.id), facts = askFacts(c, pr, (e) => day(e.end));
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 45000);
    let err = null, ans = null;
    try {
      const r = await fetch(RECAP_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "explain", lang, question: q.slice(0, 300), facts }), signal: ctl.signal });
      let j = null; try { j = await r.json(); } catch (_) { j = null; }
      if (r.status === 429) err = "The AI is busy right now (too many requests). Try again in a minute."; else if (!r.ok || !j?.explain?.answer) err = "No answer this time. Try again later.";
      else ans = { answer: String(j.explain.answer), points: (j.explain.points || []).map(String).slice(0, 4) };
    } catch (e) { err = e?.name === "AbortError" ? "That took too long. Try again." : "No connection. Check your internet and try again."; }
    clearTimeout(to);
    if (this._ln !== S || S.ask !== A) return;
    A.loading = false; A.err = err; if (ans) { Object.assign(A, ans); const o = askCache(); o[key] = ans; askSave(o); }
    if (this._lnEl) this._lnDraw();
  },

  // ── going to a position in the review ──
  /** Opens the game of an example in the review's step view at that decision; practice (a state) hides the answer there. */
  async _lnGo(e, practice) {
    this._lnPr = practice; this._lnOpening = true; this.lessonsClose();
    await this.histView(e.gid, "review", e.pid);
    this._lnOpening = false; this._lnReturn = { cat: e.cat };
    let n = 0;
    const go = () => {
      if (!this._lnReturn || this._histView?.id !== e.gid) return;
      const ok = this._rvEl && this._rvPid === e.pid && this._rvOf?.(e.pid)?.results?.length && document.querySelector(".rv .rv-tabs");
      if (ok) { this._lnStepIn = true; this._rvEnterStep(e.i); this._rvStepFrom = null; return; }
      if (n++ < 150) setTimeout(go, 100);
    };
    go();
  },
  async lessonsPractice(cat, skip = null) {
    const D = this._lnData || (await this._lnLoad()), c = D.cats.find((x) => x.id === cat), pr = loadPractice();
    const e = c && pickPractice(cat, c.ex, pr, skip); if (!e) return;
    const st = { e, cat, opts: practiceOptions(e), pick: null };
    if (this._lnStepIn && this._histView?.id === e.gid && this._rvPid === e.pid) { this._lnPr = st; this._rvDrawReview(e.i); return; } // same game: stay in the step view
    this._lnGo(e, st);
  },
  _lnPracticeDraw() {
    const P = this._lnPr, el = this._rvEl;
    if (!P || this._rvStep !== P.e.i || !el?.classList.contains("step")) return;
    const card = el.querySelector(".rs-card"), e = P.e;
    el.classList.add("ln-p"); el.classList.toggle("ln-q", P.pick == null);
    if (P.pick == null) {
      const h = this.players?.[e.pid]?.resources, hand = h ? Object.entries(RL).filter(([r]) => h[r] > 0).map(([r, l]) => `${h[r]} ${l}`).join(", ") : "";
      card.innerHTML = `<section class="ln-pq"><small>Train · ${esc(CAT[P.cat].name)}</small><h4>What would you do?</h4>
        <p class="ln-ctx">${esc(day(e.end))} · ${e.k === "setup" ? "Set-up" : `Turn ${e.t}`}${hand ? ` · You hold ${esc(hand)}` : ""}</p>
        <div class="ln-opts">${P.opts.map((o, k) => `<button type="button" class="ln-opt" data-lnpick="${k}">${esc(o.label)}</button>`).join("")}</div></section>`;
      card.querySelectorAll("[data-lnpick]").forEach((b) => b.addEventListener("click", () => this._lnPick(+b.dataset.lnpick)));
      return;
    }
    const A = P.opts.find((o) => o.kind === "A"), pick = P.opts[P.pick], ok = pick.kind === "A" || pick.win >= A.win;
    card.insertAdjacentHTML("afterbegin", `<section class="ln-pa ${ok ? "ok" : "no"}"><div class="ln-pah"><i aria-hidden="true">${ok ? "✓" : "✕"}</i><b>${ok ? "Correct: that is the better move." : `Not quite. The better move was ${esc(A.label)}.`}</b></div>
      <ul class="ln-ol">${[...P.opts].sort((a, b) => b.win - a.win).map((o) => `<li class="${o.kind === "A" ? "a" : ""}${o === pick ? " pick" : ""}"><span><span class="ln-on">${o.kind === "A" ? "<s>A</s>" : o.kind === "B" ? `<s class="alt">B</s>` : ""}${esc(o.label)}</span><small>${[o.kind === "A" ? "better" : "", o.kind === "B" ? "played in the game" : "", o === pick ? "your pick" : ""].filter(Boolean).join(" · ")}</small></span><b>${o.win}%</b></li>`).join("")}</ul>
      <div class="ln-pbt"><button type="button" class="hs-btn pri" data-lnnext>Next question</button><button type="button" class="hs-btn" data-lndone>Done</button></div></section>`);
    card.querySelector("[data-lnnext]").addEventListener("click", () => this.lessonsPractice(P.cat, exKey(e)));
    card.querySelector("[data-lndone]").addEventListener("click", () => this._rvStepBack());
  },
  _lnPick(k) {
    const P = this._lnPr; if (!P || P.pick != null) return;
    P.pick = k;
    const list = loadPractice(); list.push({ key: exKey(P.e), cat: P.cat, ok: P.opts[k].kind === "A" || P.opts[k].win >= P.opts.find((o) => o.kind === "A").win, at: Date.now(), pick: P.opts[k].label });
    savePractice(list);
    this._rvAB = "both"; this._rvDrawReview();
  },
};

export function installLessons(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  wrap("_rvStepDraw", function (orig, ...a) { document.body.toggleAttribute("data-ln-practice", !!(this._lnPr && this._rvStep === this._lnPr.e.i)); const r = orig.apply(this, a); try { this._lnPracticeDraw(); } catch (_) { /* the plain step view stays */ } return r; });
  // Back from a step opened from Lessons: out of the game, back to the category
  wrap("_rvStepBack", function (orig, ...a) { if (this._lnStepIn && this._lnReturn) { this._rvStep = null; this._rvPbp = null; return this.histExit(); } return orig.apply(this, a); });
  wrap("histView", function (orig, ...a) { if (!this._lnOpening) { this._lnReturn = null; this._lnStepIn = false; this._lnPr = null; } return orig.apply(this, a); });
  wrap("histExit", async function (orig, ...a) {
    const back = this._lnReturn; this._lnReturn = null; this._lnStepIn = false; this._lnPr = null; this._rvEl?.classList.remove("ln-q"); document.body.removeAttribute("data-ln-practice");
    const r = await orig.apply(this, a);
    if (back) { this.histClose(); this.lessonsOpen({ cat: back.cat }); }
    return r;
  });
}
