// v1.90 The step ledger on the page side (the AI tab's game card): the store (R.luck.res, filled by the luck run in the review's worker, src/review-luck.js), the adaptive
// refinement of the steps that are shown (more futures, in the worker, until their +-se is at most 2 points), the progress credit B (lazily, on opening the AI tab), and the
// card block and the round view (tap a round). The numbers are src/review/ledger.js + ai-ledger.js; this file only schedules, draws and binds.
import { reviewRequest, reviewLaneCount, reviewAvailable, SEA_LEAF } from "./master.js";
import { makeLedger, refineRound, creditRound, LG } from "./review/ledger.js";
import { ledgerModel, segsText, ledgerRoute, ledgerAnswer } from "./review/ai-ledger.js";
import { mechRaw } from "./review/ai-mech.js";
import { REVIEW } from "./review/evaluate.js";
import { stateOfSpec } from "./review/ai-board.js";
import { recapLang } from "./review-recap.js";
import { gameOdds } from "./replay-odds.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const IC = {
  dice: '<svg class="lg-ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.8" cy="5.8" r="1.05"/><circle cx="10.2" cy="5.8" r="1.05"/><circle cx="5.8" cy="10.2" r="1.05"/><circle cx="10.2" cy="10.2" r="1.05"/></svg>',
  pick: '<svg class="lg-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.4l8.4 5.2-3.7 1 2 3.7-1.6.9-2-3.7L4.4 12z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  chev: '<svg class="lg-ic lg-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const RS = ["wood", "brick", "sheep", "wheat", "ore"];

export const ReviewLedgerMixin = {
  /** The ledger of this review (null: not valued completely yet, or a game the review cannot value). Rebuilt when the store was replaced. */
  _ldLed() {
    const R = this._rv, L = tryv(() => this._lkStore()); if (!R?.recs?.length || !L || !this.winner) return null;
    let c = R._ldC; if (!c || c.res !== L.res || c.N !== R.recs.length) { c = { res: L.res, N: R.recs.length, led: makeLedger({ recs: R.recs, n: this.players.length, winner: this.winner.id, res: L.res }) }; Object.defineProperty(R, "_ldC", { value: c, configurable: true, writable: true, enumerable: false }); }
    return c.led;
  },
  /** The ledger when every position is valued (the card draws from it), else null. */
  _ldReady() { const led = this._ldLed(); return led && led.complete() ? led : null; },
  _ldCtx() { return { recs: this._rv.recs, steps: this.stats?.steps || [], ev: this.stats?.ev || [], hexes: this.geometry?.hexes || [] }; },
  _ldRaw() { const R = this._rv; if (!R) return null; const k = `${R.recs.length}|${this.stats?.ev?.length || 0}`; if (R._ldRaw?.k !== k) Object.defineProperty(R, "_ldRaw", { value: { k, raw: tryv(() => mechRaw(this)) }, configurable: true, writable: true, enumerable: false }); return R._ldRaw.raw; },
  /** A key that changes when a ledger number may have changed (the page's memo). */
  _ldKey() { const led = tryv(() => this._ldLed()); return led ? `${led.valued()}|${this._ldN || 0}|${this._ldJob?.busy ? 1 : 0}` : "0"; },
  /** The ledger model for the facts: marks = the turns the headline names, sx = the surprise fact. */
  _ldModel(fx, marks, sx) {
    const led = this._ldReady(); if (!led || fx.me == null) return null;
    return ledgerModel({ led, ctx: this._ldCtx(), raw: this._ldRaw(), me: fx.me, win: fx.winner, marks, sx, lang: fx.lang, lg: fx.t.lg });
  },

  // ── v1.90.1 the Win chance tab reads the SAME numbers as the card: the ledger's value of every position, once the ledger is complete (until then the tab keeps its own run) ──
  /** the ledger and where each player-turn's roll sits in its records: roll step s (the stats' 0-based index) = the record whose position is "before that roll". null while the ledger is not complete. */
  _rvLedgerMap() {
    const led = tryv(() => this._ldReady?.()); if (!led || !this._st || !this.winner) return null;
    const R = this._rv, k = `${led.valued()}|${led.N}`; if (R._ldFirst?.k === k) return R._ldFirst.m;
    const first = new Map(); led.recs.forEach((r, i) => { if (r && (r.k === "roll" || r.k === "turn") && !first.has(r.s)) first.set(r.s, i); });
    const m = first.size >= 3 ? { led, first } : null; Object.defineProperty(R, "_ldFirst", { value: { k, m }, configurable: true, writable: true, enumerable: false }); return m;
  },
  /** The win chances of the game as every screen reads them (the Win chance tab, the scorecard chart, the card, the play-by-play, the Replay, the turn view): O.get(s) = after step s, O.at(s, upto) a moment inside a step,
   *  O.setup() the placements. The ledger's numbers whenever the ledger is complete (checked at every call, so a screen that is open when it completes switches too), else the run of src/replay-odds.js (an estimate).
   *  With the ledger there is no second "exact" number: the reviewed decisions' own deep checks are a different thing (the move, not the position) and are shown as such. */
  _rvOdds() {
    const O = gameOdds(this); if (O.na) return O;
    const live = () => tryv(() => this._rvLedgerMap()), W = Object.create(O), cp = (v) => (v ? v.slice() : null);
    W.get = (s) => { const M = live(); if (!M) return O.get(s); const i = s >= O.N ? M.led.N : M.first.get(s), v = i == null ? null : tryv(() => M.led.v(i)); return v ? v.slice() : O.get(s); };
    W.exact = (s) => (live() ? null : O.exact(s));
    W.setup = () => { const M = live(), su = O.setup(); return !M ? su : su.map((q) => { const v = cp(tryv(() => M.led.atEvent(q.g))); return v ? { ...q, p: v, est: v.slice(), x: null } : q; }); };
    W.at = (s, upto) => { const M = live(); return M ? Promise.resolve(cp(tryv(() => M.led.atEvent(upto)))) : O.at(s, upto); };
    Object.defineProperty(W, "ledger", { get: () => !!live() });
    Object.defineProperty(W, "marks", { get: () => (live() ? new Map() : O.marks) });
    Object.defineProperty(W, "seat", { get: () => { const M = live(); return M ? cp(tryv(() => M.led.v(0))) : O.seat; } });
    return W;
  },
  /** The line of the Win chance tab from the ledger (before each roll, right after it, at the end of the turn), or null while the ledger is not complete. */
  _rvLedgerLook() {
    const M = tryv(() => this._rvLedgerMap()); if (!M) return null;
    const { led, first } = M, st = this._st, N = st.N, steps = [];
    for (let s = 0; s < N; s++) {
      const i = first.get(s); if (i == null) continue; const b = led.v(i), a = led.v(i + 1), e = s + 1 >= N ? led.v(led.N) : led.v(first.get(s + 1) ?? led.N), d = st.steps?.[s]; if (!b || !a || !e) continue;
      steps.push({ S: s + 1, b, a, e, roll: d ? d[2] + d[3] : null });
    }
    return steps.length >= 3 ? { steps, ledger: true } : null;
  },

  // ── refinement and the progress credit, in the review's worker ──
  _ldValue(lanes) {
    const R = this._rv, leaf = this.sea ? SEA_LEAF : REVIEW.budget.leaf || "gbm", id = R.id;
    return async (c, F, o = {}) => {
      const r = R.recs[c]; if (!r || this._rv !== R || R.id !== id) return null;
      const m = await reviewRequest({ type: "luck", base: R.base, ev: { kind: "pos", s: 0, rec: { st: r.st, trk: r.trk, ts: r.ts, pid: r.pid }, F, ...(o.pass ? { pass: true } : {}) }, opts: { leaf } }, 120000, o.lane ? o.lane % Math.max(1, lanes) : 0);
      return m?.result?.w ? m.result : null;
    };
  },
  /** Run what the card shows at more futures (the focus rounds), then the progress credit of the biggest rounds. Once per game (kept in R.luck.ld); safe to call again. */
  async _ldKick() {
    const R = this._rv, led = this._ldReady(); if (!R || !led || this._ldJob?.busy || !reviewAvailable() || R.noLuck) return;
    const L = this._lkStore(), ld = (L.ld ||= { r: {}, c: [] }), fx = this._pgState().fx, model = fx.lg; if (!model) return;
    const todoR = model.focus().filter((t) => !ld.r[t]), todoC = model.creditTurns().filter((t) => !ld.c.includes(t));
    if (!todoR.length && !todoC.length) return;
    const job = (this._ldJob = { busy: true, t0: now(), rounds: todoR.length, positions: 0, tR: 0, tC: 0 }), id = R.id, live = () => this._rv === R && R.id === id && !!this._ldJob && this._ldJob === job;
    this._ldPaint("calc");
    try {
      const lanes = await reviewLaneCount(), value = this._ldValue(lanes), store = (k, e) => { L.res[k] = e; this._ldN = (this._ldN || 0) + 1; };
      // refining moves the numbers, so the biggest rounds can change: take the focus again until every round that is shown is refined (3 passes at most)
      for (let pass = 0; pass < 3 && live(); pass++) {
        const todo = model.focus().filter((t) => !ld.r[t]); if (!todo.length) break;
        for (const t of todo) {
          if (!live()) break; const a = now(), r = await refineRound(led, t, model.seats, value, store, { live, lanes }); job.positions += r.positions; job.tR += now() - a;
          if (live()) ld.r[t] = { se: Math.round(r.maxSe * 1e4) / 1e4, cap: r.capped };
        }
      }
      for (const t of model.creditTurns().filter((x) => !ld.c.includes(x))) {
        if (!live()) break; const a = now(); await creditRound(led, t, model.seats, this._ldCtx(), value, store, { live }); job.tC += now() - a;
        if (live()) ld.c.push(t);
      }
    } catch (e) { console.warn("ledger refine", e); }
    job.busy = false; job.ms = now() - job.t0; job.done = true;
    if (this._rv === R) { this._rvSave?.(); this._ldPaint("final"); }
    return job;
  },
  /** One round the user opened that is not refined yet: refine it and credit its player-turns, then draw it again. */
  async _ldEnsure(t) {
    const R = this._rv, led = this._ldReady(); if (!R || !led || !reviewAvailable() || R.noLuck) return;
    const L = this._lkStore(), ld = (L.ld ||= { r: {}, c: [] }); if (ld.r[t] && ld.c.includes(t)) return;
    const fx = this._pgState().fx, model = fx.lg; if (!model) return;
    const job = (this._ldJob = this._ldJob?.busy ? this._ldJob : { busy: true, t0: now(), positions: 0 }), id = R.id, live = () => this._rv === R && R.id === id;
    this._ldPaint("calc");
    try {
      const lanes = await reviewLaneCount(), value = this._ldValue(lanes), store = (k, e) => { L.res[k] = e; this._ldN = (this._ldN || 0) + 1; };
      if (!ld.r[t]) { const r = await refineRound(led, t, model.seats, value, store, { live, lanes }); ld.r[t] = { se: Math.round(r.maxSe * 1e4) / 1e4, cap: r.capped }; }
      if (!ld.c.includes(t)) { await creditRound(led, t, model.seats, this._ldCtx(), value, store, { live }); ld.c.push(t); }
    } catch (e) { console.warn("ledger round", e); }
    job.busy = false; if (this._rv === R) { this._rvSave?.(); this._ldPaint(); }
  },
  /** The luck run ended: the ledger may be complete now; draw the card from it and start the refinement. */
  _ldAfterRun() { this._pgMemo = null; if (this._rvTab === "win" && this._rvStep == null) tryv(() => this._rvWinRepaint?.()); if (this._rvTab === "ai" && this._rvStep == null && this._ldReady()) { this._ldPaint("final"); this._ldKick(); } },
  /** Draw again what shows ledger numbers. "calc": only the wait line moves (the numbers change once, at the end, so the card does not flicker); "final": the card is swapped in softly, or the round view that is open is redrawn. */
  _ldPaint(mode = "final") {
    this._pgMemo = null; const el = this._rvEl; if (!el || this._rvTab !== "ai") return;
    if (this._ldViewT != null && el.querySelector("[data-lgview]")) { this._ldView(this._ldViewT, true); if (mode === "calc") return; }
    if (mode === "calc") { const fx = this._pgState().fx; el.querySelectorAll("[data-lg] .lg-sec").forEach((sec) => { sec.querySelector(".lg-calc")?.remove(); sec.insertAdjacentHTML("beforeend", this._ldCalc(fx)); }); return; }
    if (this._rvStep != null) return;
    // the swap waits while the reader is busy with the page (a card open, a tap a moment ago): it never moves a card under a finger
    const busy = () => !!el.querySelector(".ap-c.open, [data-pgsheet].on, [data-lgview].on") || Date.now() - (this._ldTouch || 0) < 1500;
    if (!el._ldT) { el._ldT = 1; el.addEventListener("pointerdown", () => { this._ldTouch = Date.now(); }, true); }
    const go = (n) => { if (this._rvEl !== el || this._rvTab !== "ai" || this._rvStep != null) return; if (busy() && n < 40) { setTimeout(() => go(n + 1), 800); return; } this._pgSwap?.(); };
    go(0);
  },
  /** The wait line of the card: "Rekent…" while the shown steps are refined. */
  _ldCalc(fx) { return this._ldJob?.busy ? `<span class="lg-calc" role="status"><i aria-hidden="true"></i>${esc(fx.t.lg.calc)}</span>` : ""; },

  // ── words and numbers as HTML ──
  _ldSegs(segs, fx) {
    const me = fx.me, nl = fx.lang === "nl";
    return (segs || []).map((s) => {
      if (typeof s === "string") return esc(s);
      if (s.pl != null) return `<span class="ap-pl pc-${s.pl}">${esc(fx.nameOf(s.pl))}</span>`;
      if (s.pos != null) return `<span class="ap-pl pc-${s.pos}">${esc(segsText([s], fx))}</span>`;
      if (s.d != null) { const cls = s.q === me ? (s.d > 0 ? "up" : s.d < 0 ? "dn" : "") : `pc-${s.q}`; return `<b class="lg-d ${cls}">${s.est ? "≈" : ""}${s.d > 0 ? "+" : s.d < 0 ? "−" : "±"}${Math.abs(s.d)}${s.se ? ` <small>±${s.se}</small>` : ""}</b>`; }
      return `<b>${esc(s.x)}</b>`;
    }).join("");
  },
  _ldPill(q, d, fx) { const n = d === 0 ? "±0" : d > 0 ? `+${d}` : `−${-d}`; return q === fx.me ? `<span class="lg-pill ${d > 0 ? "up" : d < 0 ? "dn" : ""}">${n}</span>` : `<span class="lg-pill pc-${q}"><i class="lg-dot"></i>${esc(fx.nameOf(q))} ${n}</span>`; },
  /** the tiny income bars of a mechanism line: five resources, the missing one marked */
  _ldMicro(g) {
    const mx = Math.max(8, ...RS.map((r) => g.dots[r]));
    return `<svg class="lg-mi" viewBox="0 0 30 20" aria-hidden="true">${g.mark ? `<rect x="${RS.indexOf(g.mark) * 6 - 0.6}" y="17.2" width="5.4" height="2.2" rx="1" class="lg-mkb"/>` : ""}${RS.map((r, i) => { const h = Math.max(1, (g.dots[r] / mx) * 15); return `<rect x="${i * 6}" y="${(16 - h).toFixed(1)}" width="4.2" height="${h.toFixed(1)}" rx="1.2" class="lg-rb r-${r}${r === g.mark ? " mk" : ""}"/>`; }).join("")}</svg>`;
  },

  // ── the card block ──
  _pgLedger(b, fx) {
    const M = fx.lg; if (!M) return "";
    const rows = b.rounds ? b.rounds.map((t) => M.row(t, b.seat)).filter(Boolean) : M.rows(); if (!rows.length) return "";
    const L = fx.t.lg, tL = fx.t.tL || "T";
    const html = rows.map((r) => {
      const who = r.subj === fx.me ? `<span class="lg-who me">${esc(fx.t.you)}</span>` : `<span class="lg-who pc-${r.subj}">${esc(fx.nameOf(r.subj))}</span>`;
      return `<button type="button" class="lg-rr" data-lground="${r.t}" aria-label="${esc(L.open)} ${r.t}"><span class="lg-rt">${tL}${r.t}</span><div class="lg-rm"><div class="lg-r1">${who} <span class="lg-fr">${Math.round(r.v0 * 100)}% → ${Math.round(r.v1 * 100)}%</span>${this._ldPill(r.subj, r.d, fx)}</div>
        <div class="lg-r2"><span class="lg-ri">${IC[r.icon]}</span><span>${this._ldSegs(r.text, fx)}</span></div>${r.mech ? `<div class="lg-r3">${r.mech.glyph ? this._ldMicro(r.mech.glyph) : ""}<span>${this._ldSegs(r.mech.segs, fx)}.</span></div>` : ""}</div>${IC.chev}</button>`;
    }).join("");
    return `<div class="lg" data-lg>${b.rounds ? "" : `<div class="lg-sec"><span>${esc(L.decided)}</span>${this._ldCalc(fx)}</div>`}${html}<div class="lg-key"><span>${IC.dice} ${esc(L.key[0])}</span><span>${IC.pick} ${esc(L.key[1])}</span><span><b>≈</b> ${esc(L.key[2])}</span></div></div>`;
  },

  // ── the round view ──
  /** Open (or redraw) the view of round t: a full-height layer over the AI tab with a back button. */
  _ldView(t, keep = false) {
    const el = this._rvEl, { fx } = this._pgState(); if (!el || !fx.lg) return false;
    const v = tryv(() => fx.lg.view(t)); if (!v) return false;
    this._ldViewT = t; const L = fx.t.lg, tL = fx.t.Turn;
    let w = el.querySelector("[data-lgview]"), sc0 = w?.querySelector(".lg-sc")?.scrollTop || 0;
    if (!w) { w = document.createElement("div"); w.className = "lg-view"; w.dataset.lgview = "1"; el.appendChild(w); }
    const sg = (n) => (n === 0 ? "±0" : n > 0 ? `+${n}` : `−${-n}`), cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : ""), me = fx.me, win = fx.winner;
    const mx = Math.max(10, ...v.shown.map((s) => Math.abs(s.pts))), bar = (n) => `<span class="lg-bar"><i class="z"></i><b class="${cls(n)}" style="${n >= 0 ? "left:50%" : "right:50%"};width:${Math.min(50, (Math.abs(n) / mx) * 50).toFixed(1)}%"></b></span>`;
    const steps = v.shown.map((s) => `<div class="lg-wf"><span class="lg-wi">${s.chance ? IC.dice : IC.pick}</span><div class="lg-wt"><div>${this._ldSegs(s.title.a, fx)}</div>${s.title.b.length ? `<div class="lg-ws">${this._ldSegs(s.title.b, fx)}</div>` : ""}</div><div class="lg-wv">${bar(s.pts)}<b class="lg-d ${cls(s.pts)}">${sg(s.pts)}</b>${s.ptsW != null && Math.abs(s.ptsW) >= 3 ? `<span class="lg-wo pc-${win}"><i class="lg-dot"></i>${esc(fx.nameOf(win))} ${sg(s.ptsW)}</span>` : ""}</div></div>`).join("");
    const credit = v.credit.map((c) => `<div class="lg-wf est"><span class="lg-wi">${IC.pick}</span><div class="lg-wt"><div>${this._ldSegs(c.title.a, fx)}</div><div class="lg-ws">≈ ${esc(L.vs)}</div></div><div class="lg-wv"><b class="lg-d ${cls(c.pts)}">≈${sg(c.pts)} <small>±${c.seN}</small></b>${c.pid !== me ? `<span class="lg-wo pc-${c.pid}"><i class="lg-dot"></i>${esc(fx.nameOf(c.pid))} ≈${sg(c.ptsMover)}</span>` : `<span class="lg-wo">≈${sg(c.ptsMover)}</span>`}</div></div>`).join("");
    const m = v.why, nv = m.scarce, sp = m.spot;
    let why = "";
    if (nv) why += `<div class="lg-mv"><div class="lg-mh">${esc(nv.q === me ? L.income : L.incomeOf(fx.nameOf(nv.q)))}</div><div class="lg-ib">${RS.map((r) => `<div class="lg-ibr${r === nv.res ? " low" : ""}"><span class="lg-ibn">${esc(fx.t.res[r])}</span><span class="lg-ibt"><i class="r-${r}" style="width:${Math.min(100, (nv.all[r] / 8) * 100)}%"></i></span><b>${nv.all[r]}</b></div>`).join("")}</div><div class="lg-cap">${this._ldSegs(L.cap1(nv), fx)}.</div></div>`;
    if (sp) { const bk = `lg:${t}`, spec = this._ldBoardSpec(sp, sp.q); if (spec) { (this._aiBkSpec ||= new Map()).set(bk, spec); why += `<div class="lg-mv"><div class="ai-vz ap-bdv"><div class="ai-bd" data-aibd="${spec.turn}" data-aibk="${esc(bk)}"><span class="ai-bdw" aria-hidden="true"></span></div><div class="ap-leg">${[sp.q, sp.by].map((q) => `<span class="pc-${q}"><i></i>${esc(fx.nameOf(q))}</span>`).join("")}</div></div><div class="lg-cap">${this._ldSegs(L.cap2(sp), fx)}.</div></div>`; } }
    const busy = this._ldJob?.busy ? `<span class="lg-calc" role="status"><i aria-hidden="true"></i>${esc(L.calc)}</span>` : "";
    w.innerHTML = `<div class="lg-sc"><div class="lg-top"><button type="button" class="lg-bk" data-lgback aria-label="${esc(L.back)}">${IC.back}</button><div><div class="lg-tt">${tL} ${t}</div><div class="lg-ts">${esc(fx.t.you)} ${esc(L.sub(Math.round(v.v0[me] * 100), Math.round(v.v1[me] * 100), v.tot, L.pointsWord))}</div></div>${busy}</div>
      <section class="ap-c lg-c">${v.tag ? `<div class="lg-hd"><span class="lg-lv">${esc(L.cause[v.tag])}</span></div>` : ""}<p class="lg-ti">${this._ldSegs(v.head, fx)}</p>
      <div class="lg-split"><div class="lg-sb"><span class="lg-sh">${IC.dice} ${esc(L.chance)}</span><b class="lg-d ${cls(v.chance)}">${sg(v.chance)}</b><span class="lg-ss">${esc(L.chanceSub)}</span></div><div class="lg-sb"><span class="lg-sh">${IC.pick} ${esc(L.choice)}</span><b class="lg-d ${cls(v.choice)}">${sg(v.choice)}</b><span class="lg-ss">${esc(L.choiceSub)}</span></div></div></section>
      <section class="ap-c lg-c"><div class="lg-sec first">${esc(L.steps)}</div>${steps}<div class="lg-wf oth"><span class="lg-wi"></span><div class="lg-wt"><div>${esc(L.other)}</div></div><div class="lg-wv"><b class="lg-d ${cls(v.other)}">${sg(v.other)}</b></div></div>
      <div class="lg-wf tot"><span class="lg-wi"></span><div class="lg-wt"><div>${esc(L.total)}</div></div><div class="lg-wv"><b class="lg-d ${cls(v.tot)}">${sg(v.tot)}</b></div></div><div class="lg-note">${esc(L.noteA(v.seN))}</div></section>
      ${credit ? `<section class="ap-c lg-c"><div class="lg-sec first">${esc(L.progressFor([...new Set(v.credit.map((c) => c.pid))].map((q) => ({ you: q === me, name: fx.nameOf(q) }))))} <em>≈</em></div>${credit}<div class="lg-note">${esc(L.noteB)}</div></section>` : ""}
      ${why ? `<section class="ap-c lg-c"><div class="lg-sec first">${esc(L.ctx)}</div>${why}<div class="lg-key"><span>${IC.dice} ${esc(L.key[0])}</span><span>${IC.pick} ${esc(L.key[1])}</span><span><b>≈</b> ${esc(L.key[2])}</span></div></section>` : `<div class="lg-key lg-keyo"><span>${IC.dice} ${esc(L.key[0])}</span><span>${IC.pick} ${esc(L.key[1])}</span><span><b>≈</b> ${esc(L.key[2])}</span></div>`}</div>`;
    w.querySelector("[data-lgback]").onclick = () => this._ldClose();
    w.onkeydown = (e) => { if (e.key === "Escape") this._ldClose(); };
    const sc = w.querySelector(".lg-sc"); if (keep && sc) sc.scrollTop = sc0;
    this._aiBoards?.(w); this._pgWire?.(w);
    if (!keep) { requestAnimationFrame(() => w.classList.add("on")); w.querySelector("[data-lgback]").focus?.({ preventScroll: true }); this._ldEnsure(t); } else w.classList.add("on");
    return true;
  },
  _ldClose() { const w = this._rvEl?.querySelector("[data-lgview]"); this._ldViewT = null; if (w) { w.classList.remove("on"); setTimeout(() => w.remove(), 180); } },
  /** The board crop of a lost spot: the spot ringed, the pieces of you and of the one who took it near it, the board at the end of that turn (the Replay's themed renderer, like the page's board block). */
  _ldBoardSpec(sp, me) {
    const geo = this.geometry; if (!geo?.nodes?.[sp.n]) return null;
    const st = tryv(() => stateOfSpec(this, { turn: sp.turn })), P = geo.nodes[sp.n], near = (i) => Math.hypot(geo.nodes[i].x - P.x, geo.nodes[i].y - P.y) <= geo.hexSize * 3.4, seats = [me, sp.by], crop = [{ node: sp.n }];
    if (st) { st.nodes.forEach((n, i) => { if (n[0] != null && seats.includes(n[0]) && near(i)) crop.push({ node: i }); }); st.edges.forEach((e, i) => { if (e[0] != null && seats.includes(e[0]) && near(geo.edges[i].nodes[0])) crop.push({ edge: i }); }); }
    return { type: "board", turn: sp.turn, seat: sp.by, dec: null, marks: [{ kind: "focus", focus: { node: sp.n } }], arrows: [], crop: crop.slice(0, 40), zoom: "auto" };
  },
  // ── the chat: questions the ledger answers itself ("why did my win chance fall", "what happened in turn 7"): an app-built card and answer, no model, offline too ──
  _ldAnswer(q) {
    const { fx } = this._pgState(), M = fx.lg; if (!M) return null;
    const rt = ledgerRoute(String(q || ""), { me: fx.me, players: fx.players }); if (!rt || (rt.t != null && (rt.t < 1 || rt.t > fx.T))) return null;
    const L = fx.t.lg, a = tryv(() => ledgerAnswer(M, fx, rt)); if (!a) return null;
    const tr = (t) => ({ ref: `turn.${t}`, fmt: "turn" }), who = (q) => ({ ref: `name.${fx.keys[q]}`, fmt: "player" }), ask = rt.kind === "behind" ? (a.seat === fx.me ? L.askBehind : L.askBehindOf) : a.seat === fx.me ? L.askTurn : L.askTurnOf;
    let title;
    if (a.all.length > 1 || rt.kind === "player") { const nm = []; a.all.forEach((x, i) => { if (i) nm.push(i === a.all.length - 1 ? ` ${L.and} ` : ", "); nm.push(who(x.seat)); }); const ts = [...new Set(a.all.map((x) => x.t))]; title = [...nm, ` · ${fx.t.winChance}`, ...(ts.length === 1 ? [" · ", tr(ts[0])] : [])]; }
    else title = a.seat === fx.me ? [ask[0], tr(a.t), ask[1]] : [ask[0], who(a.seat), ask[1], tr(a.t), ask[2]];
    return { t: a.t, kind: a.kind, seat: a.seat, answer: a.answer, spec: { id: `ld${Date.now().toString(36)}${a.t}`, level: "Game", short: fx.t.short_.wc, title, blocks: a.all.slice(0, 3).map((x) => ({ p: "ledger", rounds: [x.t], seat: x.seat })) } };
  },
  /** Answer a typed / chip question from the ledger when it can; true when it did (the page shows the card under the follow-ups). */
  _ldFollow(q) {
    const R = this._rv, lang = recapLang(), ai = R?.ai; if (!R || !ai || !q) return false;
    const a = tryv(() => this._ldAnswer(q)); if (!a) return false;
    const rec = ai.page || (ai.page = { k: lang, L: false, at: 0, spec: null, fu: [] }); rec.fu = rec.fu || [];
    if (rec.fu.some((f) => f.q === q)) { this._rvEl?.querySelector(`[data-pgc="${CSS.escape(rec.fu.find((f) => f.q === q).id)}"]`)?.scrollIntoView?.({ block: "center", behavior: "smooth" }); return true; }
    rec.fu.push({ id: a.spec.id, q, spec: a.spec, answer: a.answer }); rec.fu = rec.fu.slice(-6);
    this._aiSave?.(); this._pgMemo = null; this._pgFuPaint?.(false, a.spec.id); this._aiRefreshAsk?.(); return true;
  },
};
