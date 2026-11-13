// v1.03 Game review (an option under the missed chances): every real decision of yours checked by the Master
// bot's Monte Carlo search in the Web Worker (src/review/evaluate.js), ~0.5 s each, with progress and Stop.
//   · v1.03 layout B: the counts and your win chance first; accuracy (0–100, chess.com-style on the win
//     chance each move gave away) as one line below, next to the luck you had
//     (cards from your numbers vs expected, the robber on your tiles vs the table), and where it sits among
//     the bots (bands measured on their own decisions, see BANDS)
//   · your win chance after each decision, marked strong / could be sharper / missed chance
//   · a tappable turn strip and a list of your turns; Show on board for a marked decision
//   · the missed-chance lines on the end screen then come from the Master's check (verified)
import { esc, IC, cmpHtml, whyHtml } from "./review-ui.js";
import { reviewModel, REVIEW_MODELS, modelOfId } from "./review/evaluate.js";
import { summarize, REVIEW, REVIEW_ENGINE, REVIEW_ENGINES, ACC, clsOf, LIMITS, SETUP_LIMITS, CLASSES, GREAT, gpOf, decide, totals, tradeShow, needsFull } from "./review/evaluate.js";
import { reviewAvailable } from "./master.js";
import { cardsText, topText, tileOf, sentence } from "./review/luck.js";
import { BOT_PROFILES } from "./bot-profiles.js";
import { profileOf } from "./bot-profile-ui.js";
import { botBand } from "./review/bands.js";
import { gameOdds } from "./replay-odds.js";
import { wpText, luckKey } from "./review-luck.js";
import { currentEngineId } from "./review-again.js";
import { LUCK_MC } from "./review/luck-mc.js";

// The bots' accuracy with the review engine in use (src/review/evaluate.js REVIEW_ENGINES), if measured.
export const BANDS = REVIEW.bands || [];
const mk = (m, cls = "") => `<i class="rv-mk mk-${m} ${cls}" aria-hidden="true"></i>`;
const pct = (x) => `${Math.round(x * 100)}%`;
const sgn = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`; // whole percent with a real minus sign
export const MC = "deep Monte Carlo (100 futures a move)"; // what runs the check, named once
// v1.29 the bots' lighter deep check against checking all their moves with the full engine (scratchpad others129 budget-an.mjs)
const OTHERS_NOTE = "1.1 points of accuracy apart on average, 5 at most, in about 60% of the time";
// v1.05 chess-style classes: name, glyph (own icons, one hue each in review.css)
export const CLS = { best: ["Best", "★"], great: ["Great", "⇈"], good: ["Good", "●"], could: ["Could be better", "↗"], mistake: ["Mistake", "▲"], blunder: ["Blunder", "✕"], missed: ["Missed chance", "◎"], triv: ["No real choice", "·"] };
const IMP = ["could", "mistake", "blunder", "missed"];
const badge = (c, sz = "") => `<i class="rs-b c-${c} ${sz}" aria-hidden="true">${CLS[c][1]}</i>`;
const rvPos = (g, f) => {
  if (f.hex != null) return { ...g.hexes[f.hex].center, hex: true };
  if (f.city != null || f.node != null) { const n = g.nodes[f.city ?? f.node]; return { x: n.x, y: n.y }; }
  const [a, b] = g.edges[f.edge].nodes.map((i) => g.nodes[i]);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, edge: true };
};
/** A (better: accent ring, letter) and B (what was done: white dashed ring + class badge) on the zoomed board, with an arrow B to A. */
function rvMarks(game, d, Af, Bf) {
  const g = game.geometry, V = game.view, xy = (p) => [p.x * V.scale + V.offsetX, p.y * V.scale + V.offsetY];
  const at = (f) => { if (!f) return null; const p = rvPos(g, f); return { c: xy(p), r: p.hex ? g.hexSize * V.scale * 0.6 : p.edge ? 15 : 17, hex: !!p.hex }; };
  const A = at(Af), B = at(Bf);
  const ring = (m, alt) => {
    if (!m) return "";
    const [x, y] = m.c, r = m.r, fill = m.hex ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${alt ? "#fff" : "var(--primary)"}" opacity=".22"/>` : "";
    const o = alt ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="3.5" stroke-dasharray="6 4"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="7"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="3.6"/>`;
    return `${fill}${o}<g transform="translate(${(x + r * 0.78).toFixed(1)} ${(y - r * 0.78).toFixed(1)})"><circle r="11" fill="${alt ? "#fff" : "var(--primary)"}" stroke="${alt ? "var(--primary)" : "#fff"}" stroke-width="2"/><text y="4.6" text-anchor="middle" font-size="13" font-weight="800" fill="${alt ? "var(--primary)" : "#fff"}">${alt ? "B" : "A"}</text></g>`;
  };
  let arrow = "";
  if (A && B && !A.hex) {
    const [x1, y1] = B.c, [x2, y2] = A.c, L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, e1 = [x1 + ux * (B.r + 4), y1 + uy * (B.r + 4)], e2 = [x2 - ux * (A.r + 6), y2 - uy * (A.r + 6)];
    if (L > A.r + B.r + 14) arrow = `<g class="mk-arrow"><line x1="${e1[0]}" y1="${e1[1]}" x2="${e2[0]}" y2="${e2[1]}" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/><line x1="${e1[0]}" y1="${e1[1]}" x2="${e2[0]}" y2="${e2[1]}" stroke="var(--primary)" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/><path d="M${e2[0]},${e2[1]} l${-ux * 11 - uy * 7},${-uy * 11 + ux * 7} M${e2[0]},${e2[1]} l${-ux * 11 + uy * 7},${-uy * 11 - ux * 7}" stroke="var(--primary)" stroke-width="3.4" stroke-linecap="round" fill="none"/></g>`;
  }
  const cls = B ? `<g transform="translate(${(B.c[0] - B.r * 0.78).toFixed(1)} ${(B.c[1] - B.r * 0.78).toFixed(1)})"><circle r="10" class="rs-cb c-${d.cls}"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${CLS[d.cls][1]}</text></g>` : "";
  // v1.11 the plan behind A: the road route to the target, and the rival spots it takes away
  const W = d.x.why?.mark, wp = (f) => { const p = rvPos(g, f); return xy(p); };
  let why = "";
  if (W && !d.same) {
    (W.edges || []).forEach((e) => { const [a, b] = g.edges[e].nodes.map((n) => xy(g.nodes[n])); why += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".85"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--primary)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${e === W.edges[0] ? "0" : "1 9"}"/>`; });
    (W.rivals || []).forEach((n) => { const [x, y] = wp({ node: n }); why += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#D9714E" stroke-width="2.6" stroke-dasharray="3 3"/><path d="M${x - 4},${y - 4} l8,8 M${x + 4},${y - 4} l-8,8" stroke="#D9714E" stroke-width="2.6" stroke-linecap="round"/>`; });
  }
  return `<g class="mk-b">${ring(B, true)}${cls}</g>${arrow}<g class="mk-why">${why}</g><g class="mk-a">${ring(A, false)}</g>`;
}

export const ReviewGameMixin = {
  /** The review is offered for every island game with a person at the table (v1.17: Rush and 5–6 players too; Seafarers not yet). */
  _rvReviewable() { return !!this._rv?.recs?.length && this._rvCovered(); },

  /** The one person a review can start for by itself: Classic, one human, not Rush, not pass & play. */
  _rvSoloPid() {
    if (this.hotseat || this._replay || !this._rvReviewable()) return null;
    const hs = this.players.filter((p) => p.isHuman);
    return hs.length === 1 && this._rvTodo(hs[0].id).length ? hs[0].id : null;
  },
  /** v1.04 after a game the review starts by itself (Settings › Game › Review automatically after a game). */
  _rvAutoPid() {
    let on = true;
    try { on = localStorage.getItem("colonist_review_auto") !== "off"; } catch (_) { on = true; }
    return on && this.winner && reviewAvailable() ? this._rvSoloPid() : null;
  },
  /** v1.04 Menu › Check my moves so far: one person, Classic, not Rush, not pass & play, something to check. */
  _rvMidPid() { return this.winner || this.home?.open || this.isRush?.() ? null : this._rvSoloPid(); }, // not in Rush: the clock keeps running
  _rvMidSub() {
    const pid = this._rvMidPid();
    if (pid == null) return "";
    const rv = this._rvOf(pid), left = this._rvTodo(pid).filter(([, i]) => !rv?.results.some((x) => x.i === i)).length;
    const when = left ? `about ${Math.max(1, Math.round((left * REVIEW.sec) / 60))} min` : "already checked";
    return `Up to turn ${this.turn} · ${when}`;
  },
  _rvOpenMid() { const pid = this._rvMidPid(); if (pid != null) this._rvOpenReview(pid, { mid: true }); },

  /** v1.11 A saved full result judged by an older score function (the leaf tag): its number is not comparable. */
  _rvStale(pid) {
    const rv = this._rvOf(pid);
    return !!rv && rv.pid === pid && rv.results.some((r) => r.eng === REVIEW_ENGINE && (r.leaf || "v1") !== (REVIEW.budget.leaf || "v1"));
  },
  /** v1.17 How many of this person's moves the finished review marks could be better / mistake / blunder / missed (what the review screen counts). */
  _rvBadCount(pid) {
    const rv = this._rvOf(pid);
    if (!rv || rv.pid !== pid || !rv.results.length) return 0;
    const c = summarize(rv.results).cls;
    return (c.could || 0) + (c.mistake || 0) + (c.blunder || 0) + (c.missed || 0);
  },
  /** The inside of the end screen's review button, one line: "Game review" + a status chip (checking 12/24 ·
   *  provisional · accuracy 92 · Re-check for an old formula); never started: "Review this game" + the time. */
  _rvRowInner(p) {
    const rv = this._rvOf(p.id), mine = !!rv, run = this._rv.run;
    const sum = mine && rv.results.length && this._rvCovered1(p.id) ? summarize(rv.results) : null;
    const done = mine && this._rvReviewComplete(p.id);
    const n = this._rv.recs.filter((r) => r.pid === p.id && ["setup", "build", "bank", "buy", "play", "robber", "end", "shipmove"].includes(r.k)).length;
    let x = "Game review", g = "";
    if (run?.pid === p.id && run.round) g = run.paused ? "paused" : "checking"; // v1.52 the numbers are in the progress card above
    else if (done) g = this._rvStale(p.id) ? "Re-check" : `accuracy ${sum?.acc ?? "–"}`;
    else if (sum) g = this._rvStale(p.id) ? "Re-check" : "provisional";
    else { x = "Review this game"; g = `≈${Math.max(1, Math.round((n * REVIEW.sec) / 60))} min`; }
    const mc = done && rv.midCheck ? `<small class="mc">checked during the game</small>` : ""; // v1.04: such a game stays out of the bot average
    return `<span class="t">${IC.review}</span><span class="x">${x}${mc}</span><span class="g">${g}</span>${IC.chev}`;
  },
  _rvReviewRowHtml(p) {
    if (!this._rvReviewable()) return "";
    return `<button type="button" class="rvb" data-rvreview="${p.id}">${this._rvRowInner(p)}</button>`;
  },
  // ── v1.52 one progress for the whole review on the end screen: Quick look → Luck → Your moves → Bots ──
  _rvEtaText(sec) { return sec >= 90 ? `about ${Math.round(sec / 60)} min` : sec < 10 ? "a few seconds" : `about ${Math.round(sec / 10) * 10} s`; },
  /** Where the whole check stands: { steps: [{ k, label, st: done|run|wait|stop, j, n }], cur, etaMine, etaLuck, etaBots, running, stopped } or null when everything is done. */
  _rvFlow() {
    const R = this._rv;
    if (!R?.recs?.length || this._rvMid || !this.winner) return null;
    const hum = this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length), bots = this._rvOthers();
    if (!hum.length && !bots.length) return null;
    const LK = this._lkState(), run = R.run, lrun = R.lrun, U = this._raUnit ? this._raUnit() : { quick: 0.5, deep: 3, luck: 0.45 };
    const quickModel = reviewModel() === "quick", hrun = run?.round && this.players[run.pid]?.isHuman ? run : null, brun = run?.round && !this.players[run.pid]?.isHuman ? run : null;
    const per = (r, d) => (r?.times?.length >= 2 ? r.times.reduce((a, b) => a + b, 0) / r.times.length / 1000 : d);
    const left = (p, quick) => this._rvTodo(p.id).filter(([, i]) => { const x = R.revs[p.id]?.results.find((y) => y.i === i); return quick ? !x : !x || this._rvNeedsFull(x); }).length;
    const qDone = hum.every((p) => this._rvCovered1(p.id)), dDone = hum.every((p) => this._rvReviewComplete(p.id)), hStop = hum.some((p) => R.revs[p.id]?.stopped && !this._rvReviewComplete(p.id));
    const steps = [];
    const qLeft = hum.reduce((a, p) => a + left(p, true), 0), dLeft = hum.reduce((a, p) => a + left(p, false), 0);
    if (hum.length) {
      const q = hrun && (quickModel || hrun.round.eng === "m100");
      steps.push({ k: "quick", label: quickModel ? "Your moves" : "Quick look", st: qDone ? "done" : q ? "run" : hStop && !qDone ? "stop" : "wait", j: q ? Math.min(hrun.round.j, hrun.round.n) : null, n: q ? hrun.round.n : null });
    }
    let luckSec = 0;
    if (!LK.na) {
      const lj = LK.j, ln = LK.n, perL = per(lrun, U.luck);
      luckSec = LK.done ? 0 : Math.max(0, ln - lj) * perL;
      steps.push({ k: "luck", label: "Luck", st: LK.done ? "done" : LK.run ? "run" : LK.stopped ? "stop" : "wait", j: LK.run ? lj : null, n: LK.run ? ln : null, paused: !!LK.paused });
    }
    if (hum.length && !quickModel) {
      const d = hrun && hrun.round.eng !== "m100";
      steps.push({ k: "deep", label: "Your moves", st: dDone ? "done" : d ? "run" : hStop && qDone ? "stop" : "wait", j: d ? Math.min(hrun.round.j, hrun.round.n) : null, n: d ? hrun.round.n : null });
    }
    const botsLeft = bots.filter((p) => !this._rvReviewComplete(p.id) && !(R.revs[p.id]?.top && this._rvCovered1(p.id)));
    if (bots.length) {
      steps.push({ k: "bots", label: `Bots (${bots.length})`, st: !botsLeft.length ? "done" : brun ? "run" : R.othersOff ? "stop" : "wait", j: brun ? Math.min(brun.round.j, brun.round.n) : null, n: brun ? brun.round.n : null, name: brun ? this.players[brun.pid].name : "", eng: brun?.round.eng, left: botsLeft.length });
    }
    if (steps.every((x) => x.st === "done")) return null;
    // time left: the person's part (quick look, luck, deep), the bots apart
    const qSec = hrun && (quickModel || hrun.round.eng === "m100") ? Math.max(0, hrun.round.n - hrun.round.j) * per(hrun, U.quick) : qLeft * U.quick;
    const dRun = hrun && hrun.round.eng !== "m100" && !quickModel;
    const dSec = quickModel ? 0 : dRun ? Math.max(0, hrun.round.n - hrun.round.j) * per(hrun, U.deep) + Math.max(0, dLeft - hrun.round.n) * U.deep : dLeft * U.deep;
    const bSec = botsLeft.reduce((a, p) => a + left(p, true) * U.quick + 0.4 * (this._rvTodo(p.id).length) * U.deep, 0);
    const cur = steps.find((x) => x.st !== "done") || null;
    return { steps, cur, etaLuck: luckSec + (qDone ? 0 : qSec), etaMine: qSec + luckSec + dSec, etaBots: bSec, running: steps.some((x) => x.st === "run"), stopped: steps.some((x) => x.st === "stop"), started: steps.some((x) => x.st === "done" || x.st === "run" || (x.j || 0) > 0) };
  },
  _rvFlowHtml() {
    const F = this._rvFlow();
    if (!F) return "";
    const by = (k) => F.steps.find((x) => x.k === k), q = by("quick"), d = by("deep"), lk = by("luck"), bt = by("bots");
    const rows = [];
    if (q) { // your moves: the quick look (first), then the deep check (after the luck and the bots' quick look)
      const cur = d && q.st === "done" ? d : q, st = d ? (d.st === "done" ? "done" : q.st === "done" ? d.st : q.st) : q.st;
      const phase = d && q.st === "done" ? "deep check" : d ? "quick look" : "";
      rows.push({ label: "Your moves", st, j: cur.j, n: cur.n, txt: st === "done" ? "done" : st === "run" ? `${phase ? phase + " " : ""}${cur.j}/${cur.n}` : st === "stop" ? "stopped" : phase ? `${phase} waiting` : "waiting" });
    }
    if (lk) rows.push({ label: "Luck", st: lk.st, j: lk.j, n: lk.n, txt: lk.st === "done" ? "done" : lk.st === "run" ? `${lk.paused ? "paused " : ""}${lk.j}/${lk.n}` : lk.st === "stop" ? "stopped" : "waiting" });
    if (bt) rows.push({ label: `Bots (${bt.left || 0} to check)`.replace(/ \(0 to check\)/, ""), st: bt.st, j: bt.j, n: bt.n, txt: bt.st === "done" ? "done" : bt.st === "run" ? `${esc(bt.name)} ${bt.eng === "m100" ? "first look" : "deep"} ${bt.j}/${bt.n}` : bt.st === "stop" ? "stopped" : "waiting" });
    const ico = { done: `<i class="ok" aria-hidden="true">✓</i>`, run: `<i class="rv-ring" aria-hidden="true"></i>`, stop: `<i class="pz" aria-hidden="true">II</i>`, wait: `<i class="wt" aria-hidden="true"></i>` };
    const eta = (F.etaMine + F.etaBots) > 3 ? `${this._rvEtaText(F.etaMine + F.etaBots)} left` : "";
    const head = !F.running ? (F.stopped ? "Stopped" : F.started ? "Waiting" : "Not started") : "Checking this game";
    const btn = F.running ? `<button type="button" class="rv-btn" data-rvfs="stop">Stop</button>` : `<button type="button" class="rv-btn pri" data-rvfs="go">${F.started ? "Continue" : "Start"}</button>`;
    return `<section class="rv-card rsp" data-rvflow role="status" aria-label="Review progress"><div class="rsp-rows">${rows.map((r) => `<div class="rsp-r ${r.st}"><span class="ic">${ico[r.st]}</span><b>${r.label}</b><span class="tx">${r.txt}</span><i class="bar"><i style="width:${r.st === "done" ? 100 : r.n ? Math.round((100 * r.j) / Math.max(1, r.n)) : 0}%"></i></i></div>`).join("")}</div>
      <div class="rsp-f"><span><b>${head}</b>${eta ? `<small>${eta}</small>` : ""}</span>${btn}</div></section>`;
  },
  _rvFlowStop() { const R = this._rv; if (R?.run) this._rvStop(); if (R?.lrun) this._lkStop(); this._rvTick?.(); },
  _rvFlowGo() {
    const R = this._rv;
    if (!R) return;
    const hum = this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length && !this._rvReviewComplete(p.id));
    hum.forEach((p) => { if (R.revs[p.id]) R.revs[p.id].stopped = false; });
    this._lkStore().stopped = false;
    R.othersOff = false; R.othersPlanned = false;
    this._rvOthers().forEach((p) => { if (R.revs[p.id]) R.revs[p.id].stopped = false; });
    R.queue = !this.hotseat && hum.length === 1 ? this._rvSoloQueue(hum[0].id) : hum.map((p) => ({ pid: p.id, stage: "deep" }));
    R.othersPlanned = !this.hotseat && hum.length === 1;
    const need = hum.find((p) => !this._rvCovered1(p.id));
    if (need && !R.run) { this._rvReviewRun(need.id, null, { stage: "quick" }).then((rv) => { if (rv?.done && this._rv === R) this._rvRender?.(); }); this._rvTick?.(); return; }
    this._rvQueueNext();
    this._rvTick?.();
  },
  /** The end screen's progress card follows the check (and goes away when everything is done). */
  _rvPatchFlow() {
    const box = this._stOverlay?.isConnected ? this._stOverlay.querySelector("[data-rvbox]") : null;
    if (!box || !this._rv) return;
    const f = box.querySelector("[data-rvflow]"), h = this._rvFlowHtml();
    if (!h) { f?.remove(); return; }
    if (f && f.__h === h) return;
    const tmp = document.createElement("div"); tmp.innerHTML = h; const n = tmp.firstElementChild; n.__h = h;
    if (f) f.replaceWith(n); else (box.querySelector("[data-rvtable]") || box.firstElementChild)?.before(n);
    this._rvBindTable(n);
  },
  _rvPatchRows() {
    document.querySelectorAll("[data-rvreview]").forEach((b) => { const p = this.players[+b.dataset.rvreview]; if (p) b.innerHTML = this._rvRowInner(p); });
    // v1.29 the table on the end screen follows the others' checks (the review screen redraws itself)
    this._rvPatchTable(this._stOverlay?.isConnected ? this._stOverlay.querySelector("[data-rvbox] [data-rvtable]") : null);
    this._rvPatchFlow();
  },
  /** Replace one table in place (only when it changed): the screen around it is not redrawn. */
  _rvPatchTable(t, cur = null, luckFor = null) {
    if (!t || !this._rv) return;
    const h = t.classList.contains("rsc") ? this._rvScoreHtml() : this._rvTableHtml(cur, luckFor); // v1.48 the end screen's scorecard or the review's table
    if (t.__h === h) return;
    const tmp = document.createElement("div"); tmp.innerHTML = h; const n = tmp.firstElementChild;
    if (n) { n.__h = h; t.replaceWith(n); this._rvBindTable(n); }
  },
  _rvBindReview(box) {
    box.querySelectorAll("[data-rvreview]").forEach((b) => b.addEventListener("click", () => this._rvOpenReview(+b.dataset.rvreview)));
  },

  /** The biggest mistakes once the deep check is done, by the class the review shows (mistake / blunder / missed chance), biggest gap first (a detector line
   *  stays when the check agrees with it). The gap is the one on the review screen. */
  _rvVerified(pid) {
    const rv = this._rvOf(pid);
    if (!rv || !this._rvReviewComplete(pid)) return null;
    const recs = this._rv.recs;
    return rv.results.filter((x) => ["mistake", "blunder", "missed"].includes(clsOf(x)) && x.best).sort((a, b) => gpOf(b) - gpOf(a) || a.i - b.i).slice(0, 3).map((x) => {
      const det = this._rv.res?.findings?.find((f) => f.pid === pid && f.i === x.i);
      return this._rvEvalFinding(x, recs[x.i], det);
    });
  },
  _rvEvalFinding(x, rec, det = null) {
    let hand = null;
    try { hand = JSON.parse(rec.st).players[rec.pid].resources; } catch (_) { hand = null; }
    const gp = gpOf(x), B = Math.round(x.win * 100), A = B + gp, cls = clsOf(x), gain = `+${gp}%`;
    const did = tradeShow(x.label), better = tradeShow(x.best.label);
    return { kind: det?.kind || "eval", pid: rec.pid, i: x.i, t: x.t, s: x.s, e: x.e, size: gp, verified: true, markLabel: CLS[cls][0],
      line: det?.line || `${better} was stronger`, gain, gainLong: `${gain} win chance was possible`,
      did, better, hand: det?.hand || hand,
      why: `${det?.kind === "seven" ? `A 7 then took ${det.n} of your ${det.T7} cards. ` : ""}Checked by ${MC}: ${better} kept ${A}% win chance, ${did.charAt(0).toLowerCase() + did.slice(1)} ${B}%.`.replace(/  +/g, " "),
      cmp: { a: better, b: did, total: "Win chance %", int: true, sa: A, sb: B,
        rows: [{ k: "win", label: "Win chance", a: A, b: B }, { k: "eta", label: "Futures played", a: x.futures || 0, b: x.futures || 0 }] },
      focus: { a: x.best.focus || det?.focus?.a || null, b: x.focus || det?.focus?.b || null } };
  },

  // ── v1.29 everyone at the table ──
  /** "You" is the one person in a solo game; anyone else (a bot, each person in pass & play) goes by name. */
  _rvIsYou(pid) { return !this.hotseat && !!this.players[pid]?.isHuman; },
  _rvNm(pid) { return this._rvIsYou(pid) ? "You" : esc(this.players[pid]?.name || "Someone"); },
  _rvWhose(pid) { return this._rvIsYou(pid) ? "Your" : `${esc(this.players[pid]?.name || "Their")}’s`; },
  /** A bot's level and its accuracy band (src/review/bands.js): { label, band: [acc, SE] | null }. */
  _rvLevel(p) {
    const pr = profileOf(this, p);
    if (!pr) return null;
    const P = BOT_PROFILES[pr.key], label = P?.label || pr.key;
    return { label: pr.custom ? `custom, like ${label}` : label, band: P?.acc || botBand(label) || null };
  },
  /** Where one seat's review stands, for the table: st = run | done | prov | queued | stopped | idle | norec | none. */
  _rvSeat(pid) {
    const R = this._rv, p = this.players[pid], rv = R.revs[pid], run = R.run;
    if (!p.isHuman && !R.bots) return { st: "norec" };
    const todo = this._rvTodo(pid).length;
    if (!todo) return { st: "none" };
    const cov = !!rv?.results?.length && this._rvCovered1(pid);
    const done = this._rvReviewComplete(pid);
    // a bot's accuracy only from the deep round (the quick round's numbers are on another scale than its band); yours as on your review
    // v1.44 (user: "no first estimate for the bots"): a bot's quick look gives a provisional "~NN" too, replaced by the deep check
    const sum = cov ? summarize(rv.results) : null;
    // the biggest mistake: from deep results (a bot's: once its biggest moments are checked deeply)
    const deep = (rv?.results || []).filter((x) => !this._rvNeedsFull(x) && (!x.skip || x.skip === "trivial"));
    const deepTodo = (rv?.results || []).filter((x) => !["forced", "n/a"].includes(x.skip) && !(this._rvBotSeat(pid) && this._rvQuickDone(x))).length;
    let worst = null;
    if (cov && (p.isHuman || done || deep.length >= Math.min(6, deepTodo))) worst = this._rvImp(decide(p.isHuman ? rv.results.filter((x) => !x.skip || x.skip === "trivial") : deep, this.players.length, pid))[0] || null;
    const running = run?.pid === pid && run.round ? { j: run.round.j, n: run.round.n, quick: run.round.eng === "m100", paused: run.paused } : null;
    const st = running ? "run" : done ? "done" : cov && p.isHuman ? "prov" : rv?.stopped || (!p.isHuman && R.othersOff) ? "stopped" : cov ? "quick" : this._rvQueued(pid) || (!p.isHuman && !R.othersPlanned) ? "queued" : "idle";
    return { st, sum, running, worst, todo, done, cov, deepN: deep.length };
  },
  /** The progress line above the table / scorecard: the bots' check, the luck run, or stopped with Continue (empty when nothing runs). */
  _rvTableProg(R, LK) {
    const run = R.run, runBot = run && !this.players[run.pid]?.isHuman && run.round;
    const left = this._rvOthers().filter((p) => !this._rvReviewComplete(p.id) && !(R.revs[p.id]?.top && this._rvCovered1(p.id)));
    let prog = "";
    if (runBot) prog = `<div class="rt-prog" role="status"><i class="rv-ring" style="--p:${Math.round((100 * run.round.j) / Math.max(1, run.round.n))}%" aria-hidden="true"></i><span>${run.paused ? "Paused" : `Checking the bots: ${esc(this.players[run.pid].name)}`}<small>${run.round.eng === "m100" ? "first look" : "deep check"} ${run.round.j}/${run.round.n}${left.length > 1 ? ` · ${left.length} to go` : ""}</small></span><button type="button" class="rv-btn" data-rvostop>Stop</button></div>`;
    else if (!LK.na && (LK.run || (LK.stopped && !LK.done && !(R.othersOff && left.length)))) prog = LK.run ? `<div class="rt-prog" role="status"><i class="rv-ring" style="--p:${Math.round((100 * LK.j) / Math.max(1, LK.n))}%" aria-hidden="true"></i><span>${LK.paused ? "Paused" : `Luck: replaying every roll ${LK.j}/${LK.n}`}<small>with every other outcome</small></span><button type="button" class="rv-btn" data-rvlkstop>Stop</button></div>`
      : `<div class="rt-prog" role="status"><span>Luck stopped<small>${LK.j} of ${LK.n} chance events</small></span><button type="button" class="rv-btn pri" data-rvlkgo>Continue</button></div>`;
    else if (R.othersOff && left.length) prog = `<div class="rt-prog" role="status"><span>Stopped<small>${left.length} ${left.length === 1 ? "player" : "players"} not checked</small></span><button type="button" class="rv-btn pri" data-rvogo>Continue</button></div>`;
    return prog;
  },
  /** v1.29 "At this table": one row per player: name and level, accuracy (or checking…), dice luck and the biggest mistake.
   *  Tap a row: that player's moves in step mode (at the biggest mistake). On the end screen right under the result; in the
   *  review overview it is the dice-luck card too (`luckFor`: whose luck the notes under it explain). */
  _rvTableHtml(cur = null, luckFor = null) {
    const R = this._rv;
    if (!R?.recs?.length || this._rvMid || !this.players.some((p) => !p.isHuman)) return "";
    const L = this._rvLuck(this._rvPid ?? this.players.find((p) => p.isHuman)?.id ?? 0);
    const LK = this._lkState(); // v1.31 luck in win chance (src/review-luck.js)
    const rows = this.players.map((p) => ({ p, s: this._rvSeat(p.id), lv: p.isHuman ? null : this._rvLevel(p) }));
    rows.sort((a, b) => (b.s.sum?.acc ?? -1) - (a.s.sum?.acc ?? -1) || a.p.id - b.p.id); // a ranking: checked players by accuracy, the rest after them
    const prog = this._rvTableProg(R, LK);
    // v1.29 design A (user's choice): fixed columns Player | Accuracy | Luck | Biggest slip; the numbers and names bold, what explains them light
    const pct = (v) => Math.max(0, Math.min(100, v));
    const accCell = ({ p, s, lv }) => {
      const meter = s.sum?.acc != null ? `<i class="rt-meter" aria-hidden="true">${lv?.band ? `<i class="bd" style="left:${pct(lv.band[0] - lv.band[1])}%;width:${2 * lv.band[1]}%"></i>` : ""}<i class="dot" style="left:${pct(s.sum.acc)}%"></i></i>` : "";
      if (s.sum?.acc != null) return `<span class="rt-c rt-ac"><b class="rt-acc${s.done ? "" : " prov"}">${s.done ? "" : "~"}${s.sum.acc}</b>${meter}</span>`;
      if (s.st === "run") return `<span class="rt-c rt-ac"><span class="rt-st rt-now"><i class="rv-ring" style="--p:${Math.round((100 * s.running.j) / Math.max(1, s.running.n))}%" aria-hidden="true"></i>${s.running.j}/${s.running.n}</span></span>`;
      return `<span class="rt-c rt-ac"><span class="rt-st">${{ queued: p.isHuman ? "queued" : "waiting", stopped: "stopped", idle: p.isHuman ? "not checked" : "waiting", norec: "n/a", none: "no choices", prov: "–", done: "–", quick: "waiting" }[s.st]}</span></span>`;
    };
    const slipWord = (d) => (d.cls === "missed" ? (d.k === "end" ? "ended" : "traded") : { setup: "set-up", build: "build", bank: "trade", buy: "card", play: "card", robber: "robber", end: "ended" }[d.k] || "move");
    const items = rows.map(({ p, s, lv }) => {
      const nm = this._rvNm(p.id), w = s.worst;
      const d = !L || L.na ? null : L.all?.[p.id], t = d ? tileOf({ me: d }) : null, top = d ? topText(d.top) : "";
      const n = t ? t.n.replace(/ cards?$/, "") : "–";
      // v1.31 design B (user's choice): luck in win chance as the number, the cards from the dice small under it
      const cardsSm = t ? `${esc(n)} ${Math.abs(parseInt(n.replace(/[^\d]/g, ""), 10)) === 1 ? "card" : "cards"}` : "";
      const wv = LK.na ? null : LK.done && LK.cover >= 0.9 ? LK.tot[p.id] : null, wc = wv == null ? "" : Math.round(wv * 100) > 0 ? "pos" : Math.round(wv * 100) < 0 ? "neg" : "";
      const luck = LK.na ? `<span class="rt-c rt-l"${top ? ` title="${esc(top)}"` : ""}><b class="${t?.cls || ""}">${esc(n)}</b><small>${t ? (Math.abs(parseInt(n.replace(/[^\d]/g, ""), 10)) === 1 ? "card" : "cards") : "n/a"}</small></span>`
        : `<span class="rt-c rt-l rt-lw"${top ? ` title="${esc(top)}"` : ""}>${wv != null ? `<b class="${wc}">${wpText(wv)}</b>` : `<span class="rt-st">${LK.run && !LK.paused ? `<i class="rv-ring" style="--p:${Math.round((100 * LK.j) / Math.max(1, LK.n))}%" aria-hidden="true"></i>` : ""}${LK.done ? "n/a" : "…"}</span>`}<small>${cardsSm || "–"}</small></span>`;
      const when = w ? this._rvWhen(w).replace(/^(Turn|Roll) /, this.isRush?.() ? "R" : "T").replace("Setup", "set-up") : "";
      const slip = w ? `<span class="rt-c rt-sl"><b>−${w.gp}%</b><small>${when === "set-up" ? "set-up" : `${when} · ${slipWord(w)}`}</small></span>`
        : `<span class="rt-c rt-sl"><small>${s.cov && (p.isHuman || s.done || s.deepN) ? "none" : "–"}</small></span>`;
      const at = w ? w.i : this._rvNearI(p.id, 0);
      const band = lv?.band ? `, usual for ${esc(lv.label)} ${Math.round(lv.band[0] - lv.band[1])} to ${Math.round(lv.band[0] + lv.band[1])}` : "";
      const lab = `${nm}${lv ? `, ${esc(lv.label)}` : ""}: ${s.sum?.acc != null ? `accuracy ${s.sum.acc}${s.done ? "" : ", provisional"}${band}` : esc(s.st === "norec" ? "accuracy not available" : "accuracy: checking")}${!LK.na && LK.done && LK.cover >= 0.9 ? `, luck ${wpText(LK.tot[p.id])} win chance` : ""}${t ? `, dice luck ${esc(t.n)}${top ? `, ${esc(top)}` : ""}` : ""}${w ? `, biggest slip ${esc(this._rvTerse(w))} minus ${w.gp}%` : ""}. ${at != null ? "Step through the moves" : "Open the review"}`;
      return `<button type="button" class="rt-row pc-${p.id}${p.id === cur ? " cur" : ""}" data-rvtab="${p.id}"${at != null ? ` data-rvat="${at}"` : ""} aria-label="${lab}"><span class="rt-who">${this._av(p, "rt-av")}<span><b class="rt-nm">${nm}</b>${lv ? `<small>${esc(lv.label)}</small>` : ""}</span></span>${accCell({ p, s, lv })}${luck}${slip}</button>`;
    }).join("");
    const head = `<div class="rt-hd" aria-hidden="true"><span>Player</span><span>Accuracy</span><span>Luck</span><span>Biggest slip</span></div>`;
    const foot = !R.bots ? `<p class="rt-foot">Played before the bots’ moves were recorded: their accuracy is not available.</p>` : "";
    let note = "";
    if (luckFor != null && L && !L.na && L.all?.[luckFor]) {
      const me = L.all[luckFor], you = this._rvIsYou(luckFor), nm = this.players[luckFor]?.name || "";
      note = `<p class="rs-lost">Dice: ${you ? "you" : esc(nm)} got ${me.got + (me.short || 0)} cards, ${Math.round(me.exp)} expected${me.blockedCards ? `; the robber took ${me.blockedCards}` : ""}.</p>`; // v1.34 one line (the rest is behind the (i))
    }
    const lkd = this._lkDetailsHtml(LK);
    return `<section class="rv-card rt${luckFor != null ? " rs-dice" : ""}" data-rvtable${luckFor != null ? ' id="rvdice"' : ""} aria-label="At this table"><div class="rv-gt"><b>At this table</b><small>tap a player for their moves</small></div>${prog}${head}${items}${lkd}${note}${foot}</section>`;
  },
  // ── v1.48 the end screen's scorecard: points and where they came from, accuracy and luck per player, each row folds open to "Why won / lost?" ──
  /** The four numbers of "Why": Start (seat order + set-up), Dice luck (own rolls, steals, draws), Own moves, The others (their luck and moves, and what the estimates cannot tell apart) -> from the even share to the result. null: not there yet. */
  _rvWhyBars(pid) {
    const LK = this._lkState?.();
    if (!LK || LK.na || !LK.done || LK.cover < 0.9 || !this.winner) return null;
    const B = this._lkBook(pid);
    if (!B) return null;
    const n = this.players.length, start = B.start - 1 / n, luck = B.luck, moves = B.moves;
    const others = B.end - B.start - luck - (moves || 0); // with the moves not checked yet this holds them too (the row says so)
    return { n, even: 1 / n, end: B.end, start, luck, moves, others, seat: this._lkSeat(pid), tot: LK.tot[pid] };
  },
  /** One short sentence: the biggest reason, from the bars (a winner: what carried it; a loser: what cost most, and whether it was the dice). */
  _rvWhyVerdict(pid, W, worst) {
    const you = this._rvIsYou(pid), nm = you ? "You" : esc(this.players[pid].name), won = W.end === 1;
    const pc = (v) => `${Math.abs(Math.round(v * 100))}%`, sg = (v) => wpText(v);
    if (won) {
      const best = [["a strong start (seat, set-up)", W.start], ["the dice", W.luck]].sort((a, b) => b[1] - a[1])[0];
      const mv = W.moves != null && W.moves > -0.05 ? ` and clean play (moves cost only ${pc(W.moves)})` : "";
      if (best[1] >= 0.05) return `${nm} won on ${best[0]} (${sg(best[1])})${mv}.`;
      return `${nm} won without a big edge${mv}: the others fell away.`;
    }
    const c = [["a weak start", W.start], ["the dice", W.luck]];
    if (W.moves != null) c.push([you ? "your moves" : "their moves", W.moves]);
    const bad = c.sort((a, b) => a[1] - b[1])[0];
    if (W.moves == null) return `Start ${sg(W.start)}, dice ${sg(W.luck)}. ${you ? "Your" : "Their"} moves are still being checked.`;
    if (bad[1] > -0.04) return `No big weakness of ${you ? "your" : "their"} own: the others pulled ahead.`;
    const dice = bad[0] !== "the dice" ? ` Not the dice (${sg(W.luck)}).` : "";
    const slip = worst && bad[0].includes("moves") ? ` Biggest slip: ${esc(this._rvWhen(worst).replace("Setup", "set-up"))} (${sgn(-worst.gp)}%).` : "";
    return `${bad[0].charAt(0).toUpperCase() + bad[0].slice(1)} cost ${pc(bad[1])}.${dice}${slip}`;
  },
  /** "Why won / lost": four bars from the even share to the result, one sentence and a note (or a line saying why not yet). */
  _rvWhyHtml(pid, s = this._rvSeat(pid)) {
    const LK = this._lkState(), W = this._rvWhyBars(pid), wd = s.worst, you = this._rvIsYou(pid);
    const track = (v) => { const wd2 = Math.min(50, (Math.abs(v) / 0.5) * 50); return `<i class="tr"><i class="z"></i><i class="${v < 0 ? "neg" : "pos"}" style="${v < 0 ? "right" : "left"}:50%;width:${wd2.toFixed(1)}%"></i></i>`; };
    const row = (l, v) => (v == null ? `<span>${l}</span><i class="tr"></i><b class="mut">…</b>` : `<span>${l}</span>${track(v)}<b class="${Math.round(v * 100) > 0 ? "pos" : Math.round(v * 100) < 0 ? "neg" : ""}">${wpText(v)}</b>`);
    if (W) {
      const big = W.moves != null && Math.abs(W.others) >= 0.2;
      return `<div class="rsc-wy"><b>${W.end === 1 ? "Why won" : "Why lost"}</b><small>win chance ${Math.round(W.even * 100)}% → ${Math.round(W.end * 100)}%</small></div>
        <div class="rsc-wf">${row("Start", W.start)}${row("Dice luck", W.luck)}${row(you ? "Your moves" : "Own moves", W.moves)}${row(W.moves == null ? "Moves + others" : "The others", W.others)}</div>
        <p class="rsc-v">${this._rvWhyVerdict(pid, W, wd)}</p>
        <p class="rsc-n">Start = seat order and set-up${Math.round(W.seat * 100) ? ` (seat order ${wpText(W.seat)})` : ""}. ${W.moves == null ? "" : `The others = what their luck and moves did${big ? ", and what the estimates cannot tell apart. It is large here, so read it as a rough share" : ""}.`}</p>`;
    }
    if (LK.na) return "";
    if (LK.done) return `<p class="rsc-n">No reasons available for this game.</p>`;
    const F = this._rvFlow?.(), t = F?.etaLuck != null ? ` in ${this._rvEtaText(F.etaLuck)}` : "";
    return `<p class="rsc-n">Luck in win chance ${LK.run ? `is being worked out (${LK.j}/${LK.n})` : "follows your review"}${t}; the reasons come with it.</p>`;
  },
  _rvScoreHtml() {
    const R = this._rv, st = this._st;
    if (!R?.recs?.length || this._rvMid || !this.players.some((p) => !p.isHuman)) return "";
    const LK = this._lkState();
    const L = this._rvLuck(this._rvPid ?? this.players.find((p) => p.isHuman)?.id ?? 0);
    const w = this.winner;
    const ranked = w ? [w, ...this.players.filter((p) => p !== w).sort((a, b) => b.victoryPoints - a.victoryPoints)] : [...this.players];
    const src = st?.sources;
    const maxV = Math.max(this.winPoints || 10, ...this.players.map((p) => p.victoryPoints));
    const parts = [["settlements", "Settlements"], ["cities", "Cities"], ["road", this.sea ? "Longest trade route" : "Longest road"], ["army", "Largest army"], ["cards", "VP card"], ["islands", "Islands"]];
    const used = src ? parts.filter(([k]) => src.some((s) => s?.[k] > 0)) : [];
    const open = this._rsOpen != null && this.players[this._rsOpen] ? this._rsOpen : null;
    const rows = ranked.map((p, k) => {
      const s = this._rvSeat(p.id), lv = p.isHuman ? null : this._rvLevel(p), nm = this._rvNm(p.id);
      const acc = s.sum?.acc != null ? `<b class="rt-acc${s.done ? "" : " prov"}">${s.done ? "" : "~"}${s.sum.acc}</b>`
        : s.st === "run" ? `<span class="rt-st rt-now"><i class="rv-ring" style="--p:${Math.round((100 * s.running.j) / Math.max(1, s.running.n))}%" aria-hidden="true"></i>${s.running.j}/${s.running.n}</span>`
        : `<span class="rt-st">${{ queued: p.isHuman ? "queued" : "waiting", stopped: "stopped", idle: p.isHuman ? "not checked" : "waiting", norec: "n/a", none: "–", prov: "–", done: "–", quick: "waiting" }[s.st] || "–"}</span>`;
      const d = !L || L.na ? null : L.all?.[p.id], t = d ? tileOf({ me: d }) : null, top = d ? topText(d.top) : "";
      const wv = LK.na ? null : LK.done && LK.cover >= 0.9 ? LK.tot[p.id] : null, wc = wv == null ? "" : Math.round(wv * 100) > 0 ? "pos" : Math.round(wv * 100) < 0 ? "neg" : "";
      const pend = wv == null && !LK.na && !LK.done && t; // v1.52 the win chance impact is coming: say so, cards underneath
      const luck = wv != null ? `<b class="${wc}">${wpText(wv)}</b>` : pend ? `<b class="pend" title="Luck in win chance follows">${LK.run && !LK.paused ? `<i class="rv-ring" style="--p:${Math.round((100 * LK.j) / Math.max(1, LK.n))}%" aria-hidden="true"></i>` : ""}…%</b><small>${esc(t.n)}</small>` : t ? `<b class="${t.cls || ""}">${esc(t.n.replace(/ cards?$/, ""))}</b><small>cards</small>` : `<span class="rt-st">${LK.run && !LK.paused ? `<i class="rv-ring" style="--p:${Math.round((100 * LK.j) / Math.max(1, LK.n))}%" aria-hidden="true"></i>` : ""}${LK.na || LK.done ? "–" : "…"}</span>`;
      const sc = src?.[p.id];
      const bar = sc ? `<div class="rsc-src" role="img" aria-label="${esc(nm)}: ${used.filter(([q]) => sc[q] > 0).map(([q, l]) => `${l} ${sc[q]}`).join(", ")}"><div class="trk" style="--w:${Math.max(8, Math.min(100, Math.round((p.victoryPoints / maxV) * 100)))}">${used.map(([q], i) => (sc[q] > 0 ? `<i class="s${i}" style="flex:${sc[q]} 1 0">${sc[q]}</i>` : "")).join("")}</div></div>` : "";
      const isOpen = open === p.id;
      let det = "";
      if (isOpen) {
        const W = this._rvWhyBars(p.id), wd = s.worst, at = wd ? wd.i : this._rvNearI(p.id, 0), you = this._rvIsYou(p.id);
        const why = this._rvWhyHtml(p.id, s);
        const bandTxt = s.sum?.acc != null && lv?.band ? `<p class="rsc-slip">Accuracy ${s.done ? "" : "~"}${s.sum.acc}, usual for ${esc(lv.label)} bots: ${Math.round(lv.band[0] - lv.band[1])} to ${Math.round(lv.band[0] + lv.band[1])}</p>` : "";
        const slip = bandTxt + (wd ? `<p class="rsc-slip">Biggest slip <b>−${wd.gp}%</b> · ${esc(this._rvWhen(wd).replace("Setup", "Set-up"))} · ${esc(this._rvTerse(wd))}</p>` : "");
        det = `<div class="rsc-d">${why}${slip}${at != null || s.todo ? `<button type="button" class="rv-btn rsc-open" data-rvtab="${p.id}"${at != null ? ` data-rvat="${at}"` : ""}>${you ? "Your moves" : `${nm}’s moves`}${IC.chev}</button>` : ""}</div>`;
      }
      return `<div class="rsc-p pc-${p.id}${p === w ? " win" : ""}${isOpen ? " open" : ""}" data-pid="${p.id}"><button type="button" class="rsc-h" data-rsx="${p.id}" aria-expanded="${isOpen}" aria-label="${esc(nm)}, ${p.victoryPoints} points${wv != null ? `, luck ${wpText(wv)}` : ""}${s.sum?.acc != null ? `, accuracy ${s.sum.acc}${s.done ? "" : ", provisional"}${lv?.band ? `, usual for ${esc(lv.label)} ${Math.round(lv.band[0] - lv.band[1])} to ${Math.round(lv.band[0] + lv.band[1])}` : ""}` : ""}. ${isOpen ? "Hide" : "Show"} why">
        <span class="rk">${k + 1}</span>${this._av(p, "rt-av")}<span class="nm"><b class="rt-nm">${nm}</b>${lv ? `<small>${esc(lv.label)}</small>` : ""}</span><span class="rt-c rt-ac">${acc}</span><span class="rt-c rt-l"${top ? ` title="${esc(top)}"` : ""}>${luck}</span><span class="pts">${p.victoryPoints}</span>${IC.chev}</button>${bar}${det}</div>`;
    }).join("");
    const leg = used.length ? `<div class="rsc-leg">${used.map(([q, l], i) => `<span><i class="s${i}"></i>${l}</span>`).join("")}</div>` : "";
    return `<section class="rv-card rt rsc" data-rvtable aria-label="Result"><div class="rv-gt"><b>Result</b><small>tap a player: why they won or lost</small></div><div class="rsc-hd" aria-hidden="true"><span>Accuracy</span><span>Luck</span><span>Points</span></div>${rows}${leg}${!R.bots ? `<p class="rt-foot">Played before the bots’ moves were recorded: their accuracy is not available.</p>` : ""}</section>`;
  },
  /** The win chance of every player through the game (set-up first), under the scorecard; tap: the review's Win chance. "" when there is none (Seafarers, no move log). */
  _rvWinCardHtml() {
    const R = this._rv;
    if (!R?.recs?.length || this._rvMid || !this.players.some((p) => !p.isHuman) || !this._st) return "";
    let O; try { O = gameOdds(this); } catch (_) { return ""; }
    if (O.na) return "";
    const pid = this._rvSoloPid?.();
    return `<section class="rv-card rsw" data-rvwin${pid != null ? ` role="button" tabindex="0" data-rvwpid="${pid}"` : ""} aria-label="Win chance through the game${pid != null ? ", open in the review" : ""}"><div class="rv-gt"><b>Win chance through the game</b><small>${pid != null ? "tap to open" : "set-up and every turn"}</small></div><div class="rsw-c"></div><div class="rsw-leg">${this.players.map((p) => `<span class="pc-${p.id}"><i></i>${this._rvNm(p.id)}</span>`).join("")}</div></section>`;
  },
  /** v1.52 the win chance line from the luck check's own numbers: for every roll the table's win chance before it (the expectation over its outcomes, looking ahead
   *  with the Monte Carlo), right after it (the roll that came), and at the end of the turn (= the next roll's "before": the moves are in). A predictable build
   *  is already in "after the roll", so it no longer jumps. null until the luck check has covered the rolls (then the line is the model's ≈ estimate). */
  _rvLook() {
    const LK = this._lkState?.();
    if (!LK || LK.na || !LK.done || LK.cover < 0.9 || !this._st || !this.winner) return null;
    const L = this._lkStore(), by = new Map();
    this._lkEvents().forEach((e) => { if (e.kind !== "dice") return; const r = L.res[luckKey(e)]; if (r?.b && r.l) by.set(e.s + 1, { b: r.b, a: r.b.map((v, q) => v + (r.l[q] || 0)), roll: e.roll }); });
    if (by.size < 3) return null;
    const keys = [...by.keys()].sort((x, y) => x - y), res = this.players.map((p) => (p.id === this.winner.id ? 1 : 0));
    return { steps: keys.map((S, i) => { const nx = by.get(keys[i + 1]); return { S, b: by.get(S).b, a: by.get(S).a, e: nx ? nx.b : res, roll: by.get(S).roll }; }) };
  },
  /** One player's line as [[step (fractional), value]]: from the look (before the first roll, then after each roll and at each turn's end) or the model's estimate. */
  _rvLinePts(O, pid, look) {
    const pts = [];
    if (look) { pts.push([0, look.steps[0].b[pid]]); look.steps.forEach((x) => { pts.push([x.S - 0.45, x.a[pid]]); pts.push([x.S, x.e[pid]]); }); return { pts, look: true }; }
    for (let s = 0; s <= this._st.N; s += 1) { const v = O.get(s); if (v) pts.push([s, v[pid]]); }
    return { pts, look: false };
  },
  _rvWinDraw(card, who = null) {
    const st = this._st, c = card.querySelector(".rsw-c");
    if (!st || !c) return;
    let O; try { O = gameOdds(this); } catch (_) { return; }
    if (O.na) return;
    const W = 304, H = 112, x0 = 24, x1 = W - 4, top = 6, bot = H - 14, N = Math.max(1, st.N);
    const su = O.setup(), M = su.length - 1, f = M >= 1 ? 0.14 : 0, gap = M >= 1 ? 6 : 0, w = x1 - x0 - gap;
    const Xs = (i) => x0 + (i / Math.max(1, M)) * f * w, Xt = (s) => x0 + f * w + gap + (s / N) * (1 - f) * w, Y = (p) => top + (1 - p) * (bot - top);
    const me = who ?? this._rvSoloPid?.();
    const look = this._rvLook();
    const lines = this.players.map((p) => {
      const pts = [];
      if (M >= 1) su.forEach((q, i) => { const v = (q.x ? q.x.p : q.p)?.[p.id]; if (v != null) pts.push([Xs(i), Y(v)]); });
      this._rvLinePts(O, p.id, look).pts.forEach(([s, v]) => pts.push([Xt(s), Y(v)]));
      return pts.length > 1 ? `<path class="pc-${p.id}${p.id === me ? " me" : ""}" d="${pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("")}"/>` : "";
    });
    const have = lines.some(Boolean);
    const grid = [0, 0.5, 1].map((p) => `<line x1="${x0}" x2="${x1}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" class="g"/><text x="${x0 - 4}" y="${(Y(p) + 3).toFixed(1)}" text-anchor="end">${p * 100}</text>`).join("");
    const sep = M >= 1 ? `<line x1="${(x0 + f * w + gap / 2).toFixed(1)}" x2="${(x0 + f * w + gap / 2).toFixed(1)}" y1="${top}" y2="${bot}" class="sep"/><text x="${x0}" y="${H - 2}">set-up</text>` : `<text x="${x0}" y="${H - 2}">start</text>`;
    c.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Win chance of every player, set-up and every ${this._stTurnWord?.() || "turn"}">${grid}${have ? lines.filter((l, i) => this.players[i].id !== me).join("") + lines.filter((l, i) => this.players[i].id === me).join("") : ""}${sep}<text x="${x1}" y="${H - 2}" text-anchor="end">${this.isRush?.() ? "roll" : "turn"} ${this.isRush?.() ? (this.rush?.rollNo ?? st.N) : this.turn}</text></svg>${have ? "" : `<p class="rsw-wait" role="status">Working out the win chance…</p>`}`;
  },
  /** Draw the win chance card and keep it current while the numbers come in (a worker, a few seconds). */
  _rvWinBind(root) {
    const card = root.querySelector("[data-rvwin]");
    this._rvWinOff?.(); this._rvWinOff = null;
    if (!card) return;
    this._rvWinDraw(card, card.dataset.rvwho != null ? +card.dataset.rvwho : null);
    let O; try { O = gameOdds(this); } catch (_) { return; }
    let t = 0;
    const off = O.on?.(() => { if (!card.isConnected) { off?.(); return; } if (!t) t = setTimeout(() => { t = 0; if (card.isConnected) this._rvWinDraw(card, card.dataset.rvwho != null ? +card.dataset.rvwho : null); }, 150); });
    this._rvWinOff = () => { off?.(); clearTimeout(t); };
    const go = () => { const pid = +card.dataset.rvwpid; if (card.dataset.rvwpid == null || Number.isNaN(pid)) return; this._rvOpenReview(pid, { tab: "win" }); };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  },
  _rvBindTable(root) {
    // a row: that player's moves in step mode, at the biggest mistake (no checked move yet: the review with its progress)
    root.querySelectorAll("[data-rvfs]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.rvfs === "stop") this._rvFlowStop(); else this._rvFlowGo(); this._rvLive?.(true); this._rvPatchRows(); }));
    // v1.48 the scorecard's rows fold open (Why won / lost) in place
    root.querySelectorAll("[data-rsx]").forEach((b) => b.addEventListener("click", () => { const pid = +b.dataset.rsx; this._rsOpen = this._rsOpen === pid ? null : pid; this._rvPatchTable(b.closest("[data-rvtable]")); }));
    root.querySelectorAll("[data-rvtab]").forEach((b) => b.addEventListener("click", () => { const pid = +b.dataset.rvtab, at = b.dataset.rvat != null ? +b.dataset.rvat : null; this._rvOpenReview(pid, at != null ? { at } : {}); }));
    root.querySelector("[data-rvostop]")?.addEventListener("click", () => { this._rvStop(); this._rvLive(true); this._rvPatchRows(); });
    root.querySelector("[data-rvogo]")?.addEventListener("click", () => { this._rvOthersGo(); this._rvLive(true); this._rvPatchRows(); });
    root.querySelector("[data-rvlkstop]")?.addEventListener("click", () => { this._lkStop(); this._rvPatchRows(); });
    root.querySelector("[data-rvlkgo]")?.addEventListener("click", () => { this._lkGo(); this._rvPatchRows(); });
    this._lkBindDetails(root);
  },
  /** The decision of this seat at or after record i (the last one before it when none follows). */
  _rvNearI(pid, i) {
    const res = (this._rvOf(pid)?.results || []).filter((x) => x.win != null && (!x.skip || x.skip === "trivial")).map((x) => x.i).sort((a, b) => a - b);
    if (!res.length) return null;
    return res.find((k) => k >= i) ?? res[res.length - 1];
  },
  /** Step mode: whose moves (everyone with a review or recorded choices). */
  _rvWhoPop() {
    const el = this._rvEl;
    if (!el) return;
    const had = el.querySelector(".rs-whopop");
    if (had) { had.remove(); return; }
    const d = document.createElement("div");
    d.className = "rs-whopop";
    d.setAttribute("role", "menu");
    d.setAttribute("aria-label", "Whose moves");
    d.innerHTML = `<small class="h">Whose moves</small>${this.players.filter((p) => this._rvTodo(p.id).length && (p.isHuman || this._rv.bots)).map((p) => { const s = this._rvSeat(p.id), lv = p.isHuman ? null : this._rvLevel(p); return `<button type="button" role="menuitemradio" aria-checked="${p.id === this._rvPid}" class="pc-${p.id}${p.id === this._rvPid ? " on" : ""}" data-rvwhopick="${p.id}">${this._av(p, "rt-av")}<span><b>${this._rvNm(p.id)}</b><small>${[lv?.label, s.sum?.acc != null ? `accuracy ${s.done ? "" : "~"}${s.sum.acc}` : s.st === "run" ? "checking…" : "not checked yet"].filter(Boolean).join(" · ")}</small></span></button>`; }).join("")}`;
    el.appendChild(d);
    d.querySelectorAll("[data-rvwhopick]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const pid = +b.dataset.rvwhopick; d.remove(); if (pid !== this._rvPid) this._rvOpenReview(pid, { near: this._rvStep ?? 0 }); }));
    setTimeout(() => { const off = (e) => { if (!d.contains(e.target)) { d.remove(); document.removeEventListener("click", off, true); } }; document.addEventListener("click", off, true); }, 0);
  },

  /** Dice luck (src/review/luck.js, from the game's event log): cards collected against cards expected, for every player. { na } when it cannot be told. */
  _rvLuck(pid) {
    const st = this._st;
    if (!st || st.partial || !st.dl) return { na: "not available" };
    return { me: st.dl[pid], all: st.dl, mode: st.diceMode };
  },
  /** v1.03 rolling record of your game accuracies (this device): one entry per reviewed game. */
  _rvHistory(add = null) {
    const KEY = "colonist_review_hist_v1";
    let h = [];
    try { h = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(h)) h = []; } catch (_) { h = []; }
    if (add && add.acc != null) { // v1.41 a game reviewed again replaces its entry (the average counts the new accuracy)
      const k = h.findIndex((x) => x.id === add.id);
      if (k >= 0) { if (JSON.stringify(h[k]) === JSON.stringify({ ...add, at: h[k].at })) return h; h[k] = { ...add, at: h[k].at }; } else h.push(add);
      h = h.slice(-30);
      try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (_) { /* private mode: this game only */ }
    }
    return h;
  },
  /** The finished review goes into the history once (also when it ran in the background). */
  _rvLogGame(pid) {
    const rv = this._rvOf(pid);
    if (!rv || !this.winner || !this.players[pid]?.isHuman || !this._rvReviewComplete(pid)) return this._rvHistory(); // (a bot's review never goes into your record)
    const sum = summarize(rv.results);
    const w = this.hotseat ? this.players[pid]?.name : undefined; // pass & play: one entry per person
    return this._rvHistory(sum.acc != null ? { id: w ? `${this._rv.id}:${pid}` : this._rv.id, ...(w ? { w } : {}), acc: sum.acc, n: sum.n, at: Date.now(), eng: REVIEW_ENGINE, midCheck: !!rv.midCheck, k: ACC.id, eid: rv.engId || null } : null);
  },
  /** The comparison with the bots: only over 5+ games (one game spreads about ±8, the bands only 4). */
  _rvCompare(hist) {
    // accuracies of one engine only, and only games nobody checked during play (v1.04: a check mid-game helps)
    // v1.41 only reviews of today's engine (its id includes the look-ahead): an older one counts again once it is reviewed again
    // v1.42 within one review model: the one of the review on screen (else the chosen one), named in the line
    const model = modelOfId(this._rvOf?.(this._rvPid)?.engId) || reviewModel(), mlab = REVIEW_MODELS[model].label;
    const mine = hist.filter((x) => (!this.hotseat ? !x.w : x.w === this.players[this._rvPid]?.name) && !x.midCheck), eid = currentEngineId(model);
    const last = mine.filter((x) => (x.eng || "m100") === REVIEW_ENGINE && (x.k ?? "k0.08v1") === ACC.id && x.eid === eid).slice(-10).map((x) => x.acc);
    const older = mine.filter((x) => x.eid !== eid).length, olderTxt = older ? ` ${older} ${older === 1 ? "review" : "reviews"} of another engine or model not counted · Review again.` : "";
    if (!BANDS.length) return { n: last.length, text: "" };
    if (last.length < 5) return { n: last.length, text: `Average vs the bots after 5 games (${last.length} of 5), ${mlab} model.${olderTxt}` };
    const m = last.reduce((a, b) => a + b, 0) / last.length;
    const sd = Math.sqrt(last.reduce((a, b) => a + (b - m) ** 2, 0) / (last.length - 1));
    const se = sd / Math.sqrt(last.length);
    // "around X" only when the average overlaps one level's band alone; two or more: "between A and B" (bands are ± one SE)
    const sorted = BANDS.slice().sort((x, y) => x[1] - y[1]);
    const hit = sorted.filter(([, v, bs = 3]) => m + se >= v - bs && m - se <= v + bs);
    const where = hit.length === 1 ? `around ${hit[0][0]}` : hit.length > 1 ? `between ${hit[0][0]} and ${hit[hit.length - 1][0]}`
      : m < sorted[0][1] ? `below the bots’ range` : m > sorted[sorted.length - 1][1] ? `above the ${sorted[sorted.length - 1][0]} bot` : `between ${sorted.filter((b) => b[1] < m).pop()[0]} and ${sorted.find((b) => b[1] > m)[0]}`;
    return { n: last.length, m, se, text: `Your last ${last.length} games (${mlab} model): ${Math.round(m)} ± ${Math.max(1, Math.round(se))}, ${where}.${olderTxt}` };
  },
  /** v1.04 the accuracy strip at the top: the number, a 70–100 bar with the bots' narrow band (a score
   *  outside is pinned to the end and says so), your 5+ game average on it, and "one game is a rough
   *  measure" once, small. */
  _rvStrip(acc, cmp, mid, prov = false) {
    const lo = 50, hi = 100, pc = (v) => Math.max(0, Math.min(100, (100 * (v - lo)) / (hi - lo)));
    // the bands are measured with the full engine: a provisional (quick) accuracy has none
    const bv = BANDS.map((b) => b[1]), B = BANDS.length && !(prov && !mid) ? [["", Math.min(...bv)], ["", Math.max(...bv)]] : null;
    const out = acc != null && (acc < lo || acc > hi);
    const when = mid ? "so far" : prov ? "" : "this game";
    const bar = `<div class="rv-abar" aria-hidden="true">${B ? `<i class="b" style="left:${pc(B[0][1])}%;width:${pc(B[1][1]) - pc(B[0][1])}%"></i>` : ""}${cmp?.m != null ? `<i class="avg" style="left:${pc(cmp.m - cmp.se)}%;width:${Math.max(1, pc(cmp.m + cmp.se) - pc(cmp.m - cmp.se))}%"></i><i class="avgd" style="left:${pc(cmp.m)}%"></i>` : ""}${acc != null ? `<i class="me" style="left:${pc(acc)}%"></i>` : ""}</div>`;
    return `<div class="rv-astrip${prov ? " prov" : ""}" role="group" aria-label="Accuracy ${acc ?? "not available"} ${when || "provisional"}${B ? `, the bots ${Math.round(B[0][1])} to ${Math.round(B[1][1])}` : ""}">
      <b class="n">${acc ?? "–"}</b><div class="l"><span><b>accuracy</b> ${when}${prov && !mid ? `<em class="pv">provisional</em>` : ""}</span>${B ? `<span>bots ${Math.round(B[0][1])}–${Math.round(B[1][1])}</span>` : ""}</div>
      <div class="rv-arow"><small>${lo}</small>${bar}<small>${hi}</small>${out ? `<span class="o ${acc < lo ? "lo" : "hi"}">${acc < lo ? `&lt;${lo}` : `&gt;${hi}`}: ${acc}</span>` : ""}</div></div>`;
  },

  /** The running (or stopped) check as a card above the review: what is done, the time left from the pace so far, Stop. */
  _rvProgHtml(pid) {
    const R = this._rv, run = R.run, rv = R.revs[pid], mid = !!this._rvMid;
    if (run && run.pid === pid && run.round) {
      const r = run.round, n = Math.max(1, r.n), j = Math.min(r.j, n);
      const per = run.times.length >= 2 ? run.times.reduce((a, b) => a + b, 0) / run.times.length : (REVIEW_ENGINES[r.eng]?.sec || REVIEW.sec) * 1000;
      const left = Math.round((per * (r.n - j)) / 1000);
      const t = left >= 90 ? `${Math.round(left / 60)} min` : `${Math.max(1, left)} s`;
      const title = mid ? "Checking your moves" : r.eng === "m100" ? "Quick look" : "Deepening";
      return `<section class="rv-card rv-prog" role="status"><div class="pr"><b>${title}</b><small>${run.paused ? "paused" : `${j} of ${r.n}${j < r.n && (run.times.length >= 2 || j === 0) ? ` · ~${t}` : ""}`}</small><button type="button" class="rv-btn" data-rvstop>Stop</button></div>
        <div class="rv-pbar"><i style="width:${Math.round((100 * j) / n)}%"></i></div></section>`;
    }
    if (run && run.pid !== pid && !this._rvReviewComplete(pid) && (this.hotseat || !this.players[pid]?.isHuman)) {
      return `<section class="rv-card rv-prog" role="status"><div class="pr"><b>Waiting</b><small>${esc(this.players[run.pid]?.name || "the other check")} is being checked first</small></div></section>`;
    }
    if (rv?.pid === pid && rv.stopped && !this._rvReviewComplete(pid)) {
      const todo = this._rvTodo(pid), left = todo.filter(([, i]) => { const x = rv.results.find((y) => y.i === i); return !x || this._rvNeedsFull(x); }).length;
      return `<section class="rv-card rv-prog" role="status"><div class="pr"><b>Stopped</b><small>${todo.length - left} of ${todo.length}</small><button type="button" class="rv-btn pri" data-rvgo>Continue</button></div></section>`;
    }
    return "";
  },
  /** Redraw while a check runs (at most about once a second). */
  _rvLive(force = false) {
    const el = this._rvEl;
    if (!el) return;
    // v1.29 someone else is being checked (the others after your review): only the table follows, the screen you read stays still
    const run = this._rv?.run;
    if (!force && run && run.pid !== this._rvPid && this._rvOf(this._rvPid)?.results?.length) { if (this._rvStep == null) { if (el.querySelector("[data-rvsbs-card]")) this._rvPatchSbs(el); else this._rvPatchTable(el.querySelector(".rv-scroll [data-rvtable]"), this._rvPid, this._rvPid); } return; }
    const t = Date.now();
    if (!force && this._rvLastDraw && t - this._rvLastDraw < 1000) { if (!this._rvDrawT) this._rvDrawT = setTimeout(() => { this._rvDrawT = 0; this._rvLive(true); }, 1000); return; }
    clearTimeout(this._rvDrawT); this._rvDrawT = 0;
    this._rvLastDraw = t;
    this._rvLiveFlag = true;
    try { this._rvDrawReview(); } finally { this._rvLiveFlag = false; }
  },

  // ── the screen ──
  /** Step mode from a review screen: remember which player and tab it came from, so Back returns exactly there. */
  _rvEnterStep(i) { if (this._rvStep == null && !this._rvMid) this._rvStepFrom = { pid: this._rvPid, tab: this._rvTab }; this._rvDrawReview(i); },
  /** Back from step mode: one level up, to where you came from (a review tab or a player's page, or the end screen when you came from there). */
  _rvStepBack() {
    this._rvStep = null; this._rvPbp = null;
    const f = this._rvStepFrom;
    if (this._rvMid) { this._rvDrawReview(); return; }
    if (f) { this._rvStepFrom = null; if (f.pid !== this._rvPid) this._rvOpenReview(f.pid, { tab: f.tab }); else { this._rvTab = f.tab; this._rvDrawReview(); } return; }
    if (this._rvOrigin === "end") { this._rvCloseReview(true); return; }
    this._rvDrawReview();
  },
  _rvOpenReview(pid, { mid = false, at = null, near = null, tab = null } = {}) {
    if (!this._rvReviewable()) return;
    if (!this._rvGateOk(pid)) { this._hsGate?.(pid, "Your game review", () => this._rvOpenReview(pid, { mid, at, near })); return; } // pass & play: hand the phone over first
    const inReview = !!this._rvEl; // v1.52 opened from inside the review (a column, Whose moves): the way back stays where you came from
    if (!inReview) { this._rvOrigin = mid ? "game" : "end"; this._rvStepFrom = null; }
    this._rvMid = mid;
    this._rvTab = tab || "overview"; this._rvKm = null; this._rvWc = null; this._rvWhyP = null; if (this._lkUi) this._lkUi.pid = null; // v1.49 a review opened anew starts on its Overview (or the tab asked for)
    this._rvPbp = null; // v1.36 a review opened anew starts at the decision, never inside an old play-by-play
    if (mid) this._st = this._stCompute(); // the stats so far (luck, the board for Show)
    this._rvCloseReview();
    const host = this._stHost();
    const el = document.createElement("div");
    el.className = "rv tm";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Game review");
    host.appendChild(el);
    this._rvEl = el;
    this._rvPid = pid;
    if (this._stOverlay) this._stOverlay.hidden = true;
    this._rvStep = null;
    const live = () => { if (this._rvEl === el) this._rvLive(); };
    this._rvListener = live;
    // v1.29 straight to a move (the table's biggest mistake), or the same moment for another player (step mode's Whose moves)
    const step = at != null ? at : near != null ? this._rvNearI(pid, near) : null;
    if (step != null) this._rvQ = "all";
    if (this._rvReviewComplete(pid)) { this._rvDrawReview(step); if (!mid) setTimeout(() => this._rvQueueNext?.(), 0); return; } // (your review done: the others follow)
    this._rvDrawReview(step);
    this._rvReviewRun(pid, live, { mid }).then((rv) => { if (this._rvEl !== el) return; this._rvLive(true); if (rv?.done) this._rvRender(); });
  },
  _rvCloseReview(back = false) {
    // a check during the game stops here (what is checked is kept); after the game it goes on in the background
    if (this._rvMid && this._rv?.run) this._rvStop();
    clearTimeout(this._rvDrawT); this._rvDrawT = 0;
    this._rvListener = null;
    this._rvCloseBoard?.();
    this._rvWinOff2?.(); this._rvWinOff2 = null;
    this._rvStep = null; this._rvAB = null; this._rvQ = null;
    this._rvEl?.remove();
    this._rvEl = null;
    if (back && this._stOverlay) { this._stOverlay.hidden = false; this._rvRender(); }
  },
  _rvBindTop(el) {
    el.querySelector("[data-rvclose]")?.addEventListener("click", () => this._rvCloseReview(true));
    el.querySelector("[data-rvback-game]")?.addEventListener("click", () => this._rvCloseReview(true));
    el.querySelector("[data-rvinfo]")?.addEventListener("click", () => { this._rvInfoOpen = true; this._rvShowInfo(); });
    el.querySelectorAll("[data-rvfor]").forEach((b) => b.addEventListener("click", () => { const pid = +b.dataset.rvfor; if (pid !== this._rvPid) this._rvOpenReview(pid); }));
    if (this._rvInfoOpen) this._rvShowInfo();
    this._rvBindProg(el);
  },
  _rvBindProg(el) {
    el.querySelector("[data-rvstop]")?.addEventListener("click", () => { this._rvStop(); this._rvLive(true); });
    el.querySelector("[data-rvgo]")?.addEventListener("click", () => { const pid = this._rvPid, live = this._rvListener; this._rvReviewRun(pid, live, { mid: this._rvMid }).then((rv) => { if (this._rvEl !== el) return; this._rvLive(true); if (rv?.done) this._rvRender(); }); this._rvLive(true); });
  },
  /** All the caveats live here, behind the (i) in the header. */
  _rvShowInfo() {
    const el = this._rvEl;
    if (!el) return;
    el.querySelector(".rv-info")?.remove();
    const lim = (L) => `${L.map(([m, c], k) => `${CLS[c][0]} ${k ? (Number.isFinite(m) ? `${L[k - 1][0]}–${m - 1}` : `${L[k - 1][0]}+`) : `under ${m}`}`).join(", ")} %`, ds0 = Math.round(100 / (this.players.length || 4));
    const bands = BANDS.length ? ` (${BANDS.map(([n, v]) => `${n} ${Math.round(v)}`).join(", ")}, each ± ${BANDS[0][2] ?? 3})` : "";
    const d = document.createElement("div");
    d.className = "rv-info";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "About this review");
    d.innerHTML = `<div class="rv-card"><div class="rv-ih"><b>About this review</b><button type="button" class="rv-btn" data-rvinfo-x aria-label="Close">✕</button></div>
      <p><b>Win chance</b>: your chance to win, in %. It comes from ${MC}: the position is played on for 20 turns, 100 times for every move (Standard model).</p>
      <p><b>A and B</b>: A is the best move, B is what you played. A − B is what that move cost. Classes: ${lim(LIMITS)}. Set-up spots use wider limits (${lim(SETUP_LIMITS)}).</p>
      <p><b>Play</b>: shows every move since your last decision: rolls, builds, trades, the robber. Win chances exist at your decisions only.</p>
      <p><b>Plan</b>: the likely reason A is better, read from the position. No clear reason, no Plan.</p>
      <p><b>Missed chance</b>: you ended the turn or traded while a build was worth 3+ %. <b>Great</b>: the best move, the next one ${GREAT}+ % behind. <b>No real choice</b>: every option within 2 %.</p>
      <p><b>Dice luck</b>: the cards your tiles paid, against the cards they were expected to pay: every roll, with the board as it stood then (cities count double, the robber where it sat). "Top 12%" means 12 in 100 games pay that much or more. Rolls are independent, so this is sound (tested against simulated dice). Balanced and deck dice even rolls out: no percentile. Year of Plenty, Monopoly and steals do not count. It says how good the rolls were, not how much win chance they cost.</p>
      <p><b>Luck</b> (in win chance): every roll, steal and card draw is replayed with every outcome it could have had. A player's luck is what their own cards, steals and draws did to their win chance, against what was to be expected. Tap Luck details for every event; its (i) buttons say more.</p>
      <p><b>Your moves</b> adds up what your moves cost in win chance. Win chance bookkeeping: ${this._rvT ? `${this._rvT.from}% at the start, ${this._rvT.to}% after your last move: Your moves ${sgn(this._rvT.moves)}%, dice and the others ${sgn(this._rvT.luck)}%. Your moves never count more than your best win chance.` : "your win chance at the start plus Your moves plus what dice and the others did equals your win chance after your last move."}</p>
      <p><b>Accuracy</b> runs 0–100; 100 is always the best move. It averages your real choices, so a few slips in a long game still score high. Big mistakes weigh more. One game spreads about ± 8. The line under it gives the plain number: % given away per choice.</p>
      <p><b>The bots</b>: scored on their own moves with this same check${bands}. Compare over 5+ games.</p>
      <p><b>The others at the table</b>: after your review each bot is checked too, one at a time, in the background (Stop holds it; it goes on when you come back). First the quick look, then the deep check of the moves the quick look found to be a real choice (the others have no accuracy anyway). Measured on 16 bots against checking every move deeply: ${OTHERS_NOTE}. A bot's accuracy appears when its check is done; dice luck is there at once.</p>
      <p><b>A check during the game</b> keeps its moves for the review at the end, but that game stays out of your average. The board is shown after the game.</p>
      <p><b>Provisional</b> is the quick look (about half a second a move). The deep check (about ${REVIEW.sec} s a move) follows, biggest differences first, and the numbers shift as it goes.</p>${this.isRush?.() ? `
      <p><b>Approximate in Rush</b>: Rush has no turns, so each move you made is checked as if it were your turn in a Classic game: the same position, then the table plays on turn by turn with one dice roll per turn. A roll in the list is the roll interval you moved in. “Wait” means building nothing right then. Not modelled: the clock, several players moving within one interval, and a spot lost to a faster bot. In a test of 17 positions the Rush-shaped and the turn-by-turn futures ranked the moves no differently than two runs of the same method do, but treat the numbers as a guide, not a verdict. Turn starts and End turn do not exist here, so they are not checked.</p>` : ""}${this.players.length >= 5 ? `
      <p><b>5–6 players</b>: moves in the build window between turns are not checked (it is nobody's turn there). The check looks 20 turns ahead, which is ${(20 / this.players.length).toFixed(1)} rounds at this table (3.5 with four players); with more players the check takes longer (the budget is the same).</p>` : ""}</div>`;
    const close = () => { this._rvInfoOpen = false; d.remove(); };
    d.addEventListener("click", (e) => { if (e.target === d) close(); });
    d.querySelector("[data-rvinfo-x]").addEventListener("click", close);
    el.appendChild(d);
  },
  _rvBar(sub, tab = "") {
    return `<div class="rv-bar"><button type="button" class="rv-btn" data-rvclose aria-label="${this._rvMid ? "Back to the game" : "Back to results"}">‹</button><div><h3${tab ? ' class="ht"' : ""}>Game review${tab ? ` · ${tab}` : this._rvPid != null && !this._rvIsYou(this._rvPid) ? ` · <span class="pc-${this._rvPid} rv-who">${esc(this.players[this._rvPid].name)}</span>` : ""}</h3><small>${tab && this._rvPid != null && !this._rvIsYou(this._rvPid) ? `${esc(this.players[this._rvPid].name)}’s review · ` : ""}${sub}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>${this._rvForSeg()}`;
  },

  /** Pass & play: "Review for [Rosa] [You]": one person's moves at a time, with where each check stands. */
  _rvStatusWord(pid) {
    const R = this._rv, run = R.run, rv = R.revs[pid];
    if (this._rvReviewComplete(pid)) { const a = summarize(rv.results).acc; return a != null ? `accuracy ${a}` : "checked"; }
    if (run?.pid === pid && run.round) return run.paused ? "paused" : `checking ${run.round.j} of ${run.round.n}`;
    if (rv?.stopped) return "stopped";
    if (run || R.queue?.includes(pid)) return "queued";
    return this._rvTodo(pid).length ? "tap to start" : "no moves";
  },
  _rvForSeg(sel = this._rvPid) {
    if (!this.hotseat || this._rvMid) return "";
    const hs = this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length);
    if (hs.length < 2) return "";
    return `<div class="rv-for" role="radiogroup" aria-label="Review for"><span class="rv-for-l">Review for</span><div class="rv-seg">${hs.map((p) => `<button type="button" role="radio" aria-checked="${p.id === sel}" class="pc-${p.id}${p.id === sel ? " on" : ""}" data-rvfor="${p.id}">${this._av(p, "rv-for-av")}<span><b>${esc(p.name)}</b><small>${this._rvStatusWord(p.id)}</small></span></button>`).join("")}</div></div>`;
  },
  /** Who gets a review without asking: the person holding the phone. Anyone else's goes through a hand-over cover. */
  _rvGateOk(pid) { return !this.hotseat || pid === this.viewerId || !this.players[pid]?.isHuman; }, // (a bot's moves need no hand-over)

  /** After a game: the people whose checks start by themselves, in seat order (one person: just them). */
  _rvAutoQueue() {
    let on = true;
    try { on = localStorage.getItem("colonist_review_auto") !== "off"; } catch (_) { on = true; }
    if (!on || !this.winner || !reviewAvailable() || !this._rvReviewable() || this._replay) return [];
    if (!this.hotseat) { const p = this._rvSoloPid(); return p == null ? [] : [p]; }
    return this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length).map((p) => p.id);
  },
  // ── v1.05 the review: overview + step mode (board first) ──
  /** The decisions with a win chance, in play order, in whole percent (src/review/score.js): class, gap, A and B, and the luck term between two of them. */
  _rvDecisions(res) { return decide(res, this.players.length, this._rvPid); },
  _rvTotals(ds) { return totals(ds); },
  _rvWhen(d) { return d.k === "setup" ? "Setup" : `${this._rvTW()} ${d.t}`; },
  _rvLine(d) {
    const x = d.x, who = this._rvNm(this._rvPid), lc = (t) => t.charAt(0).toLowerCase() + t.slice(1), gain = `+${d.gp}%`;
    if (d.cls === "triv") return "No real choice: every option was about as good.";
    if (d.cls === "missed") return `${who} ${x.k === "end" ? "ended the turn" : "traded"}; ${esc(lc(x.best.label))} was worth ${gain}.`;
    if (d.cls === "best") return `${esc(x.label)}: the best move.`;
    if (d.cls === "great") return `${esc(x.label)}: far ahead of the rest.`;
    if (d.cls === "good") return d.gp >= 1 ? `${esc(x.label)} kept ${d.B}%; ${esc(lc(tradeShow(x.best.label)))} kept ${d.A}%.` : `${esc(x.label)}: a good move.`;
    return `${who} played ${esc(lc(x.label))}; ${esc(lc(x.best.label))} was worth ${gain}.`;
  },
  /** One short line for the key moments: "Ended turn · road 2·11·10". */
  _rvTerse(d) {
    const tail = (l) => String(l).replace(/ \+\d+ roads?/, "");
    const t = (l) => {
      l = String(l || "");
      if (/^Trade .*, then /.test(l)) { const n = (l.match(/Trade /g) || []).length; return `${n > 1 ? `${n}× ` : ""}trade → ${t(tail(l.replace(/^.*, then /, "")))}`; }
      return tail(l).replace(/^Road toward /, "road ").replace(/^City on /, "city ").replace(/^Settlement on /, "settlement ").replace(/^Robber on /, "robber ").replace(/^Bank trade /, "trade ").replace(/ \(.*\)$/, "").replace(/^Settlement /, "settlement ");
    };
    const w = d.cls === "missed" ? (d.k === "end" ? "Ended turn" : "Traded") : t(d.x.label), up = (q) => q.charAt(0).toUpperCase() + q.slice(1);
    return d.x.best && !d.same ? `${up(w)} → ${t(d.x.best.label)}` : up(w);
  },
  /** Why the chance term moved between two decisions: the rolls that paid you, the robber, a steal. From the game's log. */
  _rvCause(ds, k) {
    const st = this._st, me = this._rvPid, d = ds[k], p = ds[k - 1];
    if (!st || !p || !d) return "Dice and the table";
    let cards = 0, best = null, robbed = 0, shift = false;
    for (let s = (p.x.s ?? 0) + 1; s <= (d.x.s ?? 0) && s <= st.N; s++) {
      let c = 0;
      (st.stepEvents[s] || []).forEach((e) => { if (e[1] === "P" && e[2] === me) c += e[5] || 1; else if (e[1] === "t" && e[3] === me) robbed += 1; });
      cards += c;
      const step = st.steps[s - 1];
      if (step && c && (!best || c > best.c)) best = { c, roll: step[2] + step[3] };
      if (step && step[2] + step[3] === 7) shift = true;
    }
    if ((p.x.s ?? 0) === (d.x.s ?? 0)) return "Same turn · re-estimate, no dice"; // proef: nothing rolled and nobody else moved in between
    if (d.chance >= 0) return best ? `${best.roll} rolled · +${cards} ${cards === 1 ? "card" : "cards"}` : "The others' moves";
    if (robbed) return `Robbed · ${robbed} stolen`;
    return cards ? `Others pulled ahead · +${cards} for ${this._rvIsYou(me) ? "you" : "them"}` : shift ? "A 7 and no cards" : "No cards from your numbers";
  },
  _rvKind(d) { return { setup: "Setup", build: "Build", bank: "Bank", buy: "Dev card", play: "Dev card", robber: "Robber", end: "Turn end" }[d.k] || ""; },
  _rvShort(d) { const l = d.x.label || ""; return d.k === "end" ? "End turn" : l.replace(/ toward .*/, "").replace(/ on .*/, "").replace(/^Bank trade.*/, "Bank trade"); },
  /** Win-chance chart: a thin line per player, yours thick; below it bars for the chance term (grey) and your moves (red). */
  _rvChart(ds, { w = 318, h = 150, cur = -1, axis = true, bars = true } = {}) {
    const n = ds.length, me = this._rvPid, X0 = axis ? 30 : 6, X1 = w - 6, bh = bars ? Math.round(h * 0.27) : 0, top = 6, bot = h - bh - (axis ? 14 : 4);
    const X = (k) => X0 + (k / Math.max(1, n - 1)) * (X1 - X0), Y = (p) => top + (1 - p) * (bot - top);
    const line = (f) => ds.map((d, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(f(d)).toFixed(1)}`).join("");
    const others = this.players.filter((p) => p.id !== me).map((p) => `<g class="pc-${p.id}"><path d="${line((d) => d.seats[p.id])}" class="g-oth"/></g>`).join("");
    const mid = h - bh / 2 - (axis ? 12 : 2), sc = (bh / 2) / 0.2, bw = Math.max(3, Math.min(9, (X1 - X0) / n - 2));
    const bar = (v, cls, dx, x) => `<rect x="${(x + dx).toFixed(1)}" y="${(v > 0 ? mid - Math.min(bh / 2, v * sc) : mid).toFixed(1)}" width="${(bw / 2).toFixed(1)}" height="${Math.max(1, Math.min(bh / 2, Math.abs(v) * sc)).toFixed(1)}" rx="1" class="${cls}"/>`;
    const barSvg = bars ? `<line x1="${X0}" x2="${X1}" y1="${mid}" y2="${mid}" class="g-grid"/>${ds.map((d, k) => bar(d.chance, "b-luck", -bw / 2, X(k)) + bar(-d.gap, "b-skill", 0, X(k))).join("")}` : "";
    const grid = axis ? [0, 0.5, 1].map((p) => `<line x1="${X0}" x2="${X1}" y1="${Y(p)}" y2="${Y(p)}" class="g-grid"/><text x="${X0 - 4}" y="${Y(p) + 4}" text-anchor="end" class="g-ax">${p * 100}</text>`).join("") : `<line x1="${X0}" x2="${X1}" y1="${Y(0.5)}" y2="${Y(0.5)}" class="g-grid"/>`;
    const dots = ds.map((d, k) => `<circle cx="${X(k).toFixed(1)}" cy="${Y(d.win).toFixed(1)}" r="${["best", "great", "good", "triv"].includes(d.cls) ? 2.4 : 4}" class="gd c-${d.cls}"/>`).join("");
    const curL = cur >= 0 && ds[cur] ? `<line x1="${X(cur)}" x2="${X(cur)}" y1="${top - 2}" y2="${h - (axis ? 12 : 2)}" class="g-sel"/><circle cx="${X(cur)}" cy="${Y(ds[cur].win)}" r="6" class="g-cur"/>` : "";
    const hit = ds.map((d, k) => `<rect data-rvj="${d.i}" x="${(X(k) - (X1 - X0) / Math.max(1, n) / 2).toFixed(1)}" y="0" width="${((X1 - X0) / Math.max(1, n)).toFixed(1)}" height="${h}" fill="transparent"/>`).join("");
    const lab = (d) => (d.k === "setup" ? "setup" : `${this._rvTW().toLowerCase()} ${d.t}`);
    return `<svg class="rs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Win chance of every player after each of your decisions; bars: dice and others, and your moves">${grid}${others}<g class="pc-${me} g-me"><path d="${line((d) => d.win)} L${X(n - 1)},${Y(0)} L${X(0)},${Y(0)}Z" class="g-area"/><path d="${line((d) => d.win)}" class="g-halo"/><path d="${line((d) => d.win)}" class="g-line"/></g>${barSvg}${dots}${curL}${hit}${axis ? `<text x="${X0}" y="${h - 1}" class="g-ax">${lab(ds[0])}</text><text x="${X1}" y="${h - 1}" text-anchor="end" class="g-ax">${lab(ds[n - 1])}</text>` : ""}</svg>`;
  },
  /** The stacked bar: one segment per player in their colour (sum 100 %), yours at the bottom, outlined, with your % beside it. */
  _rvStack(seats) {
    const me = this._rvPid, order = [me, ...this.players.map((p) => p.id).filter((q) => q !== me)];
    const sum = seats.reduce((a, b) => a + b, 0) || 1;
    return `<div class="rs-stack" role="img" aria-label="Win chance: ${this.players.map((p) => `${p.id === me ? "you" : esc(p.name)} ${Math.round((seats[p.id] / sum) * 100)}%`).join(", ")}">${order.slice().reverse().map((q) => `<i class="pc-${q}${q === me ? " me" : ""}" data-pid="${q}" data-pct="${Math.round((seats[q] / sum) * 100)}" style="flex:${(seats[q] / sum).toFixed(4)} 1 0">${seats[q] / sum >= 0.06 ? `<b>${Math.round((seats[q] / sum) * 100)}</b>` : ""}</i>`).join("")}</div>`;
  },
  _rvDrawReview(selI = null) {
    const el = this._rvEl, R = this._rv, pid = this._rvPid, rv = R.revs[pid];
    if (!el) return;
    if (!rv || !rv.results.length) { // nothing checked yet: the progress card alone
      el.className = "rv rs tm";
      el.innerHTML = `${this._rvBar(`${this._rvWhose(pid)} moves${this._rvMid ? " so far" : ""}`)}
        <div class="rv-scroll">${this._rvProgHtml(pid) || `<section class="rv-card rv-prog" role="status"><b>Starting the check…</b></section>`}${this._rvTableHtml(pid)}</div>`;
      this._rvBindTable(el);
      this._rvBindTop(el);
      return;
    }
    const res = rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
    const ds = this._rvDecisions(res);
    if (selI != null) this._rvStep = selI;
    if (this._rvStep != null && !ds.some((d) => d.i === this._rvStep)) this._rvStep = null;
    if (!ds.length) { this._rvStep = null; }
    if (this._rvStep != null) return this._rvStepDraw(ds);
    this._rvCloseBoard();
    this._rvOverview(ds, res, rv);
  },
  // ── v1.49 the review in tabs: Overview (players side by side, key moments) · Win chance · Luck · Moves ──
  _rvTabsBar(on) {
    const T = [["overview", "Overview"], ["win", "Win chance"], ["luck", "Luck"], ["moves", "Moves"]];
    return `<div class="rv-tabs" role="tablist" aria-label="Game review">${T.map(([k, l]) => `<button type="button" role="tab" class="${k === on ? "on" : ""}" aria-selected="${k === on}" data-rvt="${k}">${l}</button>`).join("")}</div>`;
  },
  /** The review of one player as four tabs (a check during the game keeps the single column: _rvOverviewMid). */
  _rvOverview(ds, res, rv) {
    if (this._rvMid) return this._rvOverviewMid(ds, res, rv);
    const el = this._rvEl, pid = this._rvPid, prov = !this._rvReviewComplete(pid);
    const tab = (this._rvTab = ["overview", "win", "luck", "moves", "player"].includes(this._rvTab) ? this._rvTab : "overview");
    this._rvWinOff2?.(); this._rvWinOff2 = null;
    this._rvT = this._rvTotals(ds);
    const part = { overview: () => this._rvTabOverview(ds, rv, prov), win: () => this._rvTabWin(ds), luck: () => this._rvTabLuck(ds), moves: () => this._rvTabMoves(ds, res, rv), player: () => this._rvTabPlayer(ds, rv, prov) }[tab]();
    const scroll = this._rvTabDrawn === `${pid}|${tab}` ? el.querySelector(".rv-scroll")?.scrollTop || 0 : 0;
    this._rvTabDrawn = `${pid}|${tab}`;
    el.className = "rv rs tm";
    el.innerHTML = `${tab === "player" ? part.bar : this._rvBar(`${ds.length} decisions · ${prov ? "provisional" : ({ quick: "Quick model, rough", deep: "Deep model" })[modelOfId(rv.engId)] || "deep Monte Carlo"}`, { overview: "Overview", win: "Win chance", luck: "Luck", moves: "Moves" }[tab])}${tab === "player" ? "" : this._rvTabsBar(tab)}
      <div class="rv-scroll">${this._rvProgHtml(pid)}${part.html}${tab === "overview" ? this._raBox?.() || "" : ""}</div>`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    this._rvBindTop(el);
    this._raBind?.(el);
    this._rvBindTable(el);
    el.querySelectorAll("[data-rvt]").forEach((b) => b.addEventListener("click", () => { if (this._rvTab !== b.dataset.rvt || b.dataset.rvpp) { this._rvTab = b.dataset.rvt; this._rvDrawReview(); } }));
    el.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = b.dataset.rvq || "all"; this._rvEnterStep(+b.dataset.rvj); }));
    this._rvBindSbs(el);
    part.bind?.(el);
  },

  // ── v1.50 a player's page: why, points, accuracy with its band, key moments with a line each, the win chance line ──
  _rvTabPlayer(ds, rv, prov) {
    const pid = this._rvPid, p = this.players[pid], you = this._rvIsYou(pid), nm = esc(p.name), s = this._rvSeat(pid), lv = p.isHuman ? null : this._rvLevel(p);
    const w = this.winner, ranked = w ? [w, ...this.players.filter((q) => q !== w).sort((a, b) => b.victoryPoints - a.victoryPoints)] : [...this.players];
    const rank = ranked.indexOf(p) + 1, n = this.players.length, ordN = (k) => `${k}${["th", "st", "nd", "rd"][k % 100 > 10 && k % 100 < 14 ? 0 : Math.min(k % 10, 4) % 4] || "th"}`;
    const hist = !prov ? this._rvLogGame(pid) : this._rvHistory();
    const cmp = prov || lv ? { text: "" } : this._rvCompare(hist);
    const cmpText = lv ? (lv.band ? `${lv.label} bots usually score ${Math.round(lv.band[0])} ± ${Math.round(lv.band[1])} on their own moves${prov ? " (the deep check)" : ""}.` : "") : prov ? "" : cmp.text;
    const sum = summarize(rv.results), T = this._rvT || this._rvTotals(ds);
    const bar = `<div class="rv-bar pp-bar"><button type="button" class="rv-btn" data-rvt="overview" data-rvpp="1" aria-label="Back to the overview">${IC.back}</button>${this._av(p, "rt-av")}<div><h3>${you ? "You" : nm}</h3><small>${[lv?.label, w === p ? "winner" : `${ordN(rank)} of ${n}`, `${p.victoryPoints} points`].filter(Boolean).join(" · ")}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review">${IC.info}</button></div>`;
    // why
    const W = this._rvWhyBars(pid), wd = s.worst;
    const head = !W ? "Why" : W.end === 1 ? "Why won" : rank === n ? "Why last" : "Why lost";
    const why = `<section class="rv-card rvx pp-why"><div class="rv-gt"><b>${head}</b>${W ? `<small>win chance ${Math.round(W.even * 100)}% → ${Math.round(W.end * 100)}%</small>` : ""}</div>${W ? `<p class="rsc-v">${this._rvWhyVerdict(pid, W, wd)}</p><p class="rsc-n">The four bars are on the Overview.</p>` : `<p class="rsc-n">${this._lkState().na ? "Not available for this game." : "The luck check has not finished, so the reasons are not there yet."}</p>`}</section>`;
    // points
    const st = this._st, src = st?.sources?.[pid];
    const parts = [["settlements", "Settlements", 1], ["cities", "Cities", 2], ["road", this.sea ? "Longest trade route" : "Longest road", 0], ["army", "Largest army", 0], ["cards", "VP cards", 0], ["islands", "Islands", 0]];
    const usedAll = st?.sources ? parts.filter(([k]) => st.sources.some((x) => x?.[k] > 0)) : [];
    const rows = src ? usedAll.map(([k, l, per], i) => (src[k] > 0 ? `<div class="pp-pr"><i class="s${i}"></i><span>${l}${per ? ` × ${src[k] / per}` : ""}</span><b>${src[k]}</b></div>` : "")).join("") : "";
    const bar2 = src ? `<div class="rsc-src"><div class="trk" style="--w:100">${usedAll.map(([k], i) => (src[k] > 0 ? `<i class="s${i}" style="flex:${src[k]} 1 0">${src[k]}</i>` : "")).join("")}</div></div>` : "";
    const pts = src ? `<section class="rv-card rsc pp-pts"><div class="rv-gt"><b>Points</b><small>${p.victoryPoints} points · ${this.winPoints || 10} to win</small></div>${bar2}<div class="pp-prs">${rows}</div></section>` : "";
    // accuracy
    const acc = `<section class="rv-card rs-sum">${this._rvStrip(sum.acc, cmp, false, prov)}${cmpText ? `<p class="rv-cmpline rvt-cmp">${esc(cmpText)}</p>` : ""}${sum.lost != null ? `<p class="rs-lost">${sum.n} real choices · on average ${sum.lost}% win chance given away per choice${T.capped ? ` · ${you ? "your" : "their"} moves are capped at the ${T.cap}% ${you ? "you" : "they"} could have had` : ""}</p>` : ""}</section>`;
    // key moments: each move with a line of why
    const ico = IC.next.replace("<svg", '<svg class="chev"'), sg = (v) => sgn(v * 100);
    const imp = this._rvImp(ds).slice(0, 5);
    const km = imp.map((d) => `<button type="button" class="rs-key rs-imp pp-km" data-rvj="${d.i}" data-rvq="imp">${badge(d.cls)}<span class="t">${this._rvWhen(d)}</span><span class="x">${esc(this._rvTerse(d))}<small class="w">${esc(d.x.why?.head || this._rvLine(d).replace(/<[^>]+>/g, ""))}</small></span><b class="neg">${sg(-d.gap)}%</b>${ico}</button>`).join("");
    const kmc = `<section class="rv-card rs-keys rs-better"><div class="rv-gt"><b>Key moments</b><small>${imp.length ? "tap one to see it on the board" : ""}</small></div>${km || `<p class="rs-lost">No clear mistake in ${you ? "your" : "their"} moves.</p>`}</section>`;
    // the line
    let win = "";
    try { const O = gameOdds(this); if (!O.na && st) win = `<section class="rv-card rsw pp-win" data-rvwin data-rvwho="${pid}" role="button" tabindex="0" aria-label="Win chance, open the Win chance tab"><div class="rv-gt"><b>Win chance</b><small>${you ? "you" : nm} thick · tap for the details</small></div><div class="rsw-c"></div></section>`; } catch (_) { win = ""; }
    const first = imp.length ? imp[0].i : ds[0]?.i;
    const go = ds.length ? `<button type="button" class="rv-btn pri rs-go" data-rvj="${first}" data-rvq="${imp.length ? "imp" : "all"}" data-rvfirst>${IC.step}Step through ${you ? "your" : `${nm}’s`} moves</button>` : "";
    return { bar, html: `${why}${pts}${acc}${kmc}${win}${go}`, bind: (el) => {
      const c = el.querySelector("[data-rvwin]");
      if (!c) return;
      this._rvWinDraw(c, pid);
      let O; try { O = gameOdds(this); } catch (_) { return; }
      let t = 0;
      const off = O.on?.(() => { if (!c.isConnected) { off?.(); return; } if (!t) t = setTimeout(() => { t = 0; if (c.isConnected) this._rvWinDraw(c, pid); }, 150); });
      this._rvWinOff2 = () => { off?.(); clearTimeout(t); };
      const open = () => { this._rvTab = "win"; this._rvDrawReview(); };
      c.addEventListener("click", open); c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    } };
  },
  // Overview
  /** Everyone at the table in columns: points, accuracy, what the moves cost, luck, the class counts. */
  _rvSbsHtml() {
    const R = this._rv, n = this.players.length, LK = this._lkState(), L = this._rvLuck(this._rvPid);
    const cols = this.players.map((p) => {
      const s = this._rvSeat(p.id), rvp = this._rvOf(p.id);
      let moves = null;
      if (s.sum && rvp?.results?.length) { try { moves = totals(decide(rvp.results.filter((x) => !x.skip || x.skip === "trivial"), n, p.id)).moves; } catch (_) { moves = null; } }
      const d = !L || L.na ? null : L.all?.[p.id], t = d ? tileOf({ me: d }) : null;
      const wv = LK.na ? null : LK.done && LK.cover >= 0.9 ? LK.tot[p.id] : null;
      return { p, s, moves, t, wv };
    });
    const cell = (c, inner, cls = "") => `<span class="sbs-c pc-${c.p.id}${c.p.id === this._rvPid ? " cur" : ""} ${cls}">${inner}</span>`;
    const accOf = (c) => c.s.sum?.acc != null ? `<b class="big${c.s.done ? "" : " prov"}">${c.s.sum.acc}${c.s.done ? "" : "*"}</b>` : c.s.st === "run" ? `<span class="rt-st">${c.s.running.j}/${c.s.running.n}</span>` : `<span class="rt-st">–</span>`;
    const lkOf = (c) => c.wv != null ? `<b class="${Math.round(c.wv * 100) > 0 ? "pos" : Math.round(c.wv * 100) < 0 ? "neg" : ""}">${wpText(c.wv)}</b>${c.t ? `<small>${esc(c.t.n)}</small>` : ""}` : c.t ? `<b class="${c.t.cls || ""}">${esc(c.t.n.replace(/ cards?$/, ""))}</b><small>cards</small>` : `<span class="rt-st">…</span>`;
    const cls = CLASSES.filter((k) => cols.some((c) => c.s.sum?.cls?.[k]) || !["great", "blunder"].includes(k));
    const prov = cols.some((c) => c.s.sum?.acc != null && !c.s.done);
    const row = (label, f) => `<span class="sbs-l">${label}</span>${cols.map((c) => cell(c, f(c))).join("")}`;
    const head = `<span class="sbs-l"></span>${cols.map((c) => `<button type="button" class="sbs-c sbs-h pc-${c.p.id}${c.p.id === this._rvPid ? " cur" : ""}" data-rvcol="${c.p.id}" aria-label="${esc(this._rvNm(c.p.id))}: ${this._rvTodo(c.p.id).length ? "show" : "no"} review" aria-pressed="${c.p.id === this._rvPid}">${this._av(c.p, "rt-av")}<small>${this._rvIsYou(c.p.id) ? "You" : esc(c.p.name)}</small></button>`).join("")}`;
    const body = [row("Points", (c) => `<b class="big">${c.p.victoryPoints}</b>`), row("Accuracy", accOf),
      row("Moves cost", (c) => (c.moves != null ? `<b class="${c.moves < 0 ? "neg" : ""}">${sgn(c.moves)}%</b>` : `<span class="rt-st">–</span>`)), row("Luck", lkOf),
      ...cls.map((k) => row(`${badge(k, "sm")}${k === "missed" ? "Missed" : CLS[k][0]}`, (c) => { const v = c.s.sum?.cls?.[k]; return v == null ? `<span class="rt-st">–</span>` : `<b class="${v ? "" : "zero"}">${v}</b>`; }))].join("");
    return `<section class="rv-card sbs-card" data-rvsbs-card><div class="rv-gt"><b>Players side by side</b><small>${n > 4 ? "swipe, " : ""}tap a player for their page</small></div>${this._rvTableProg(R, LK)}<div class="sbs-w"><div class="sbs" data-rvsbs style="--n:${n}">${head}${body}</div></div>${prov ? `<p class="rt-foot">* first look: the deep check is still running.</p>` : ""}</section>`;
  },
  /** Overview: "Why won / lost" for a chosen player (chips), under the side-by-side table. */
  _rvWhyCard() {
    const LK = this._lkState();
    if (LK.na) return "";
    const pid = this._rvWhyP != null && this.players[this._rvWhyP] ? this._rvWhyP : this._rvPid;
    const chips = this.players.map((p) => `<button type="button" class="pc-${p.id}${p.id === pid ? " on" : ""}" data-rvwhy2="${p.id}" aria-pressed="${p.id === pid}">${this._av(p, "rt-av")}<span>${this._rvNm(p.id)}</span></button>`).join("");
    const info = `<button type="button" class="lk-ib" data-rvwhy-i aria-expanded="false" aria-label="What do these bars mean?">${IC.info}</button>`;
    const txt = `<p class="lk-it" data-rvwhy-t hidden><b>Start</b>: seat order and set-up. <b>Dice luck</b>: their rolls, steals and card draws against what was expected. <b>Own moves</b>: what their choices cost against the best move each time (the Moves cost row above). <b>The others</b>: what the other players' luck and moves did to them, plus what the estimates cannot tell apart.</p>`;
    return `<section class="rv-card rvx why-card" data-rvwhy><div class="rv-gt"><b>Why ${this._rvWhyBars(pid)?.end === 1 ? "won" : "lost"}</b><span>${info}</span></div>${txt}<div class="lkd-seg" role="group" aria-label="Whose">${chips}</div>${this._rvWhyHtml(pid)}</section>`;
  },
  _rvBindSbs(root) {
    root.querySelectorAll("[data-rvwhy2]").forEach((b) => b.addEventListener("click", () => { this._rvWhyP = +b.dataset.rvwhy2; this._rvDrawReview(); }));
    root.querySelector("[data-rvwhy-i]")?.addEventListener("click", (e) => { const t = root.querySelector("[data-rvwhy-t]"); t.hidden = !t.hidden; e.currentTarget.setAttribute("aria-expanded", String(!t.hidden)); });
    root.querySelectorAll("[data-rvcol]").forEach((b) => b.addEventListener("click", () => { const pid = +b.dataset.rvcol; this._rvOpenReview(pid, { tab: "player" }); }));
  },
  /** The others' background check moved: only the table follows. */
  _rvPatchSbs(el) {
    const c = el.querySelector("[data-rvsbs-card]");
    if (!c) return;
    const h = this._rvSbsHtml();
    if (c.__h === h) return;
    const tmp = document.createElement("div"); tmp.innerHTML = h; const n = tmp.firstElementChild; n.__h = h;
    const sc = c.querySelector(".sbs-w")?.scrollLeft || 0;
    c.replaceWith(n); n.querySelector(".sbs-w").scrollLeft = sc;
    this._rvBindTable(n); this._rvBindSbs(n);
  },
  _rvTabOverview(ds, rv, prov) {
    const pid = this._rvPid, you = this._rvIsYou(pid), nm = esc(this.players[pid]?.name || "");
    const hist = !prov ? this._rvLogGame(pid) : this._rvHistory();
    const lv = this.players[pid]?.isHuman ? null : this._rvLevel(this.players[pid]);
    const cmp = prov || lv ? { text: "" } : this._rvCompare(hist);
    const cmpText = lv ? (lv.band ? `${lv.label} bots usually score ${Math.round(lv.band[0])} ± ${Math.round(lv.band[1])} on their own moves${prov ? " (the deep check)" : ""}.` : "") : prov ? "" : rv.midCheck ? `Checked during the game · not in your average. ${cmp.text}` : cmp.text;
    const sg = (v) => sgn(v * 100), ico = IC.next.replace("<svg", '<svg class="chev"');
    const imp = this._rvImp(ds);
    const mine = imp.slice(0, 5).map((d) => ({ m: d.gap * 100, h: `<button type="button" class="rs-key rs-imp" data-rvj="${d.i}" data-rvq="imp">${badge(d.cls)}<span class="t">${this._rvWhen(d)}</span><span class="x">${esc(this._rvTerse(d))}${d.x.why?.head ? `<small class="w">${esc(d.x.why.head)}</small>` : ""}</span><b class="neg">${sg(-d.gap)}%</b>${ico}</button>` }));
    const swings = ds.filter((d, k) => Math.abs(d.cp) >= 3 && !(k && (ds[k - 1].x.s ?? 0) === (d.x.s ?? 0))).sort((a, b) => Math.abs(b.cp) - Math.abs(a.cp)).slice(0, 3);
    const oth = swings.map((lk) => ({ m: Math.abs(lk.chance) * 100, h: `<button type="button" class="rs-key" data-rvj="${lk.i}"><i class="rs-b c-luck sm" aria-hidden="true">⚄</i><span class="t">${this._rvWhen(lk)}</span><span class="x">${esc(this._rvCause(ds, ds.indexOf(lk)))}</span><b class="${lk.cp >= 0 ? "pos" : "neg"}">${sg(lk.chance)}%</b>${ico}</button>` }));
    const f = ["you", "oth"].includes(this._rvKm) ? this._rvKm : "all";
    const list = f === "you" ? mine : f === "oth" ? oth : [...mine, ...oth].sort((a, b) => b.m - a.m).slice(0, 5);
    const seg = [["all", "All"], ["you", you ? "You" : nm], ["oth", "Others"]].map(([k, l]) => `<button type="button" class="${k === f ? "on" : ""}" aria-pressed="${k === f}" data-rvkm="${k}">${l}</button>`).join("");
    const sum = summarize(rv.results);
    const html = `<section class="rv-card rs-sum">${this._rvStrip(sum.acc, cmp, false, prov)}${cmpText ? `<p class="rv-cmpline rvt-cmp">${esc(cmpText)}${cmp.m != null ? ` <span class="rv-keyme">▮ this game</span> <span class="rv-keyavg">● your average</span>` : ""}</p>` : ""}</section>${this._rvSbsHtml()}${this._rvWhyCard()}
      <section class="rv-card rs-keys rs-better"><div class="rv-gt"><b>Key moments</b><div class="km-seg" role="group" aria-label="Whose moments">${seg}</div></div><p class="km-cap">${f === "you" ? `${you ? "Your" : `${nm}’s`} own moves, biggest gap first` : f === "oth" ? `Dice and the others, biggest swing in ${you ? "your" : "their"} win chance` : "The biggest moments, moves and swings together"}</p>${list.length ? list.map((x) => x.h).join("") : `<p class="rs-lost">${f === "oth" ? "No big swing from the dice or the others." : `No clear mistake in ${you ? "your" : "their"} moves.`}</p>`}</section>`;
    return { html, bind: (el) => el.querySelectorAll("[data-rvkm]").forEach((b) => b.addEventListener("click", () => { this._rvKm = b.dataset.rvkm; this._rvDrawReview(); })) };
  },

  // Win chance
  _rvWinGeom(O, W = 304, H = 112) {
    const st = this._st, x0 = 24, x1 = W - 4, top = 6, bot = H - 14, N = Math.max(1, st.N), su = O.setup(), M = su.length - 1;
    const f = M >= 1 ? 0.14 : 0, gap = M >= 1 ? 6 : 0, w = x1 - x0 - gap;
    return { W, H, x0, x1, top, bot, N, su, M, f, gap, w, Xs: (i) => x0 + (i / Math.max(1, M)) * f * w, Xt: (s) => x0 + f * w + gap + (s / N) * (1 - f) * w, Y: (p) => top + (1 - p) * (bot - top),
      inv: (x) => (x < x0 + f * w + gap / 2 ? 0 : Math.max(0, Math.min(N, Math.round(((x - (x0 + f * w + gap)) / ((1 - f) * w)) * N)))) };
  },
  /** What happened in one roll or turn: { head, lines, top } (who rolled what, the cards, the robber, the builds; Seafarers: an island bonus is named). */
  _rvStepWhat(s, dl = null) {
    const st = this._st;
    if (!st || s <= 0) return { head: "Set-up", lines: ["Everyone's first two settlements and roads."], builds: [] };
    const stp = st.steps[s - 1], nmOf = (q) => this._rvNm(q);
    const roll = stp ? stp[2] + stp[3] : null, who = stp && stp[1] >= 0 ? nmOf(stp[1]) : null;
    const evs = st.stepEvents?.[s] || [], cards = {}, builds = [];
    let robber = null;
    evs.forEach((e) => {
      if (e[1] === "P") cards[e[2]] = (cards[e[2]] || 0) + (e[5] || 1);
      else if (e[1] === "b" && e[3] !== "r" && e[3] !== "h") {
        let bonus = false;
        try { if (this.sea && e[3] === "s") { const isl = this.sea.islandOfNode(e[4]); bonus = !!isl && this.sea.bonusNode?.[`${e[2]}:${isl}`] === e[4]; } } catch (_) { bonus = false; }
        builds.push({ pid: e[2], kind: e[3], bonus, vp: e[3] === "c" ? 1 : bonus ? 3 : 1 });
      } else if (e[1] === "R") robber = e[2];
    });
    const lines = [];
    const pay = Object.entries(cards).map(([q, c]) => `${nmOf(+q)} +${c}`);
    lines.push(pay.length ? `Cards from the roll: ${pay.join(", ")}.` : roll ? "Nobody collected a card." : "");
    if (roll === 7 || robber != null) lines.push(robber != null ? `${nmOf(robber)} moved the robber.` : "The robber moved.");
    builds.forEach((b) => lines.push(`${nmOf(b.pid)} built ${b.kind === "c" ? "a city (+1 VP)" : b.bonus ? "a settlement on a new island (+1 VP and +2 VP island bonus)" : "a settlement (+1 VP)"}.`));
    return { head: `${this._rvTW()} ${st.turnOf[s]}${roll ? ` · ${who ? `${who} rolled` : "rolled"} ${roll}` : ""}`, lines: lines.filter(Boolean), builds, roll, robber, cards };
  },
  _rvTabWin(ds) {
    let O = null; try { O = gameOdds(this); } catch (_) { O = null; }
    const pid = this._rvPid, you = this._rvIsYou(pid);
    const info = `<button type="button" class="lk-ib" data-rvwi-b aria-expanded="false" aria-label="About this chart">${IC.info}</button>`;
    const infoTxt = `<p class="lk-it" data-rvwi-t hidden>Each line is a player's chance to win, estimated after every roll and move (often about 9 points off; good for the trend). The first part is the set-up, one point per placement. The two bars show the table just before and just after the step you pick.</p>`;
    if (!O || O.na || !this._st) {
      return { html: `<section class="rv-card"><div class="rv-gt"><b>Win chance</b><small>${you ? "you" : esc(this.players[pid].name)} thick</small></div>${this._rvChart(ds)}<p class="rs-lost">No running win chance for this game${O?.na === "sea" ? " (not trained on this board)" : ""}: the line shows ${you ? "your" : "their"} decisions only.</p></section>` };
    }
    const html = `<section class="rv-card rvw"><div class="rv-gt"><b>Win chance</b><span>${info}</span></div>${infoTxt}<div class="rvw-c" data-rvwc></div><div class="rsw-leg">${this.players.map((p) => `<span class="pc-${p.id}"><i></i>${this._rvNm(p.id)}</span>`).join("")}</div></section>
      <section class="rv-card rvw-i" data-rvwi></section>
      <section class="rv-card rs-keys rvw-s"><div class="rv-gt"><b>Biggest swings</b><small>anyone at the table</small></div><div data-rvws></div></section>`;
    const bind = (el) => {
      const paint = () => this._rvWinTabPaint(el, O, ds);
      if (this._rvWc == null || this._rvWcP !== pid) {
        this._rvWcP = pid;
        this._rvWc = 1; this._rvWcAuto = true; // until you pick one: the step that moved this player's win chance most
      }
      paint();
      el.querySelector("[data-rvwi-b]")?.addEventListener("click", (e) => { const t = el.querySelector("[data-rvwi-t]"); t.hidden = !t.hidden; e.currentTarget.setAttribute("aria-expanded", String(!t.hidden)); });
      let t = 0;
      const off = O.on?.(() => { if (!el.isConnected || this._rvEl !== el) { off?.(); return; } if (!t) t = setTimeout(() => { t = 0; if (el.isConnected && this._rvTab === "win" && this._rvStep == null) paint(); }, 200); });
      this._rvWinOff2 = () => { off?.(); clearTimeout(t); };
    };
    return { html, bind };
  },
  _rvWinTabPaint(el, O, ds) {
    const c = el.querySelector("[data-rvwc]"), wi = el.querySelector("[data-rvwi]"), ws = el.querySelector("[data-rvws]");
    if (!c || !wi) return;
    const st = this._st, g = this._rvWinGeom(O, 304, 190), me = this._rvPid, look = this._rvLook();
    if (this._rvWcAuto) { let best = null; for (let s = 1; s <= g.N; s++) { const a = O.get(s - 1), b = O.get(s); if (a && b && (!best || Math.abs(b[me] - a[me]) > best.d)) best = { s, d: Math.abs(b[me] - a[me]) }; } if (best) this._rvWc = best.s; }
    const cur = Math.max(0, Math.min(g.N, this._rvWc ?? 1));
    const lines = this.players.map((p) => {
      const pts = [];
      if (g.M >= 1) g.su.forEach((q, i) => { const v = (q.x ? q.x.p : q.p)?.[p.id]; if (v != null) pts.push([g.Xs(i), g.Y(v)]); });
      this._rvLinePts(O, p.id, look).pts.forEach(([s, v]) => pts.push([g.Xt(s), g.Y(v)]));
      return { id: p.id, d: pts.length > 1 ? pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join("") : "" };
    });
    const grid = [0, 0.5, 1].map((p) => `<line x1="${g.x0}" x2="${g.x1}" y1="${g.Y(p).toFixed(1)}" y2="${g.Y(p).toFixed(1)}" class="g"/><text x="${g.x0 - 4}" y="${(g.Y(p) + 3).toFixed(1)}" text-anchor="end">${p * 100}</text>`).join("");
    const sx = g.M >= 1 ? (g.x0 + g.f * g.w + g.gap / 2).toFixed(1) : null;
    const cx = g.Xt(cur), ent = look?.steps.find((x) => x.S === cur), here = ent ? ent.e : O.get(cur);
    const dec = ds.map((d) => { const s = Math.min(g.N, d.x.s ?? 0), v = d.seats ? d.seats[me] / (d.seats.reduce((a, b) => a + b, 0) || 1) : null; return v == null ? "" : `<circle cx="${g.Xt(s).toFixed(1)}" cy="${g.Y(v).toFixed(1)}" r="${["best", "great", "good", "triv"].includes(d.cls) ? 0 : 3.6}" class="dec c-${d.cls}"/>`; }).join("");
    c.innerHTML = `<svg viewBox="0 0 304 190" role="img" aria-label="Win chance of every player, set-up and every ${this._stTurnWord?.() || "turn"}. Tap or drag to pick a moment">${grid}${lines.filter((l) => l.id !== me).map((l) => (l.d ? `<path class="pc-${l.id}" d="${l.d}"/>` : "")).join("")}${lines.filter((l) => l.id === me).map((l) => (l.d ? `<path class="pc-${l.id} me" d="${l.d}"/>` : "")).join("")}${dec}${sx ? `<line x1="${sx}" x2="${sx}" y1="${g.top}" y2="${g.bot}" class="sep"/>` : ""}<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${g.top - 2}" y2="${g.bot}" class="cur"/>${here ? this.players.map((p) => `<circle cx="${cx.toFixed(1)}" cy="${g.Y(here[p.id]).toFixed(1)}" r="${p.id === me ? 5 : 3.6}" class="pc-${p.id} pt"/>`).join("") : ""}<text x="${g.x0}" y="186">${g.M >= 1 ? "set-up" : "start"}</text><text x="${g.x1}" y="186" text-anchor="end">${this.isRush?.() ? "roll" : "turn"} ${this.isRush?.() ? g.N : this.turn}</text></svg>${lines.some((l) => l.d) ? "" : `<p class="rsw-wait" role="status">Working out the win chance…</p>`}`;
    const svg = c.querySelector("svg");
    const pick = (ev) => { const r = svg.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * 304; this._rvWc = g.inv(x); this._rvWcAuto = false; this._rvWinTabPaint(el, O, ds); };
    svg.addEventListener("pointerdown", (ev) => { try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* none */ } svg._drag = true; pick(ev); });
    svg.addEventListener("pointermove", (ev) => { if (svg._drag) pick(ev); });
    ["pointerup", "pointercancel"].forEach((n) => svg.addEventListener(n, () => { svg._drag = false; }));
    // before and after the picked step: with the luck check's numbers (looking ahead): before the roll, after the roll, end of the turn; else the model's estimate
    const su = g.su;
    const bar = (v) => { if (!v) return `<div class="rvw-bar na">…</div>`; const sum = v.reduce((a, b) => a + b, 0) || 1; return `<div class="rvw-bar" role="img" aria-label="${this.players.map((p) => `${this._rvNm(p.id)} ${Math.round((v[p.id] / sum) * 100)}%`).join(", ")}">${this.players.map((p) => `<i class="pc-${p.id}" style="flex:${(v[p.id] / sum).toFixed(4)} 1 0">${v[p.id] / sum >= 0.08 ? Math.round((v[p.id] / sum) * 100) : ""}</i>`).join("")}</div>`; };
    const what = this._rvStepWhat(cur);
    const near = ds.filter((q) => (q.x.s ?? 0) <= cur).pop() || ds[0];
    const chk = cur > 0 ? ds.filter((q) => (q.x.s ?? 0) === cur && q.seats).pop() : null, cs = chk ? chk.seats.reduce((a, b2) => a + b2, 0) || 1 : 1, exact = chk ? chk.seats.map((v) => v / cs) : null;
    const pc = (v) => `${Math.round(v * 100)}%`, sgp = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(Math.round(v * 100))}%`;
    let rows = "", topTxt = "";
    if (ent) {
      // the roll's effect (luck) and the turn's effect (the moves) per player; the largest one is named
      let top = null;
      this.players.forEach((p) => { [["roll", ent.a[p.id] - ent.b[p.id]], ["moves", ent.e[p.id] - ent.a[p.id]]].forEach(([k, x]) => { if (!top || Math.abs(x) > Math.abs(top.x)) top = { p: p.id, k, x }; }); });
      if (top && Math.abs(top.x) >= 0.01) {
        const b2 = what.builds.filter((q) => q.pid === top.p).sort((a1, a2) => a2.vp - a1.vp)[0], got = what.cards?.[top.p] || 0;
        const cause = top.k === "roll" ? (got ? `the roll paid ${got} ${got === 1 ? "card" : "cards"}` : what.robber != null && top.x < 0 ? "the roll moved the robber" : "the roll (luck)") : b2 ? (b2.bonus ? "built a settlement on a new island (+3 VP with the island bonus)" : b2.kind === "c" ? "built a city" : "built a settlement") : what.robber === top.p ? "moved the robber" : "the moves of this turn";
        topTxt = `<b>Biggest effect:</b> ${this._rvNm(top.p)} <span class="${top.x > 0 ? "pos" : "neg"}">${sgp(top.x)}</span>, ${esc(cause)}.`;
      }
      rows = `<div class="rvw-l">Before the roll</div>${bar(ent.b)}<div class="rvw-l">After the roll <em>luck: ${this._rvNm(me)} ${sgp(ent.a[me] - ent.b[me])}</em></div>${bar(ent.a)}<div class="rvw-l">End of the turn <em>moves: ${this._rvNm(me)} ${sgp(ent.e[me] - ent.a[me])}</em></div>${bar(ent.e)}${exact ? `<div class="rvw-l">Your checked move <em>deeper, step mode</em></div>${bar(exact)}` : ""}`;
    } else {
      const bef = cur === 0 ? (su.length ? su[0].p : null) : O.get(cur - 1), aft = cur === 0 && su.length ? (su[su.length - 1].x ? su[su.length - 1].x.p : su[su.length - 1].p) : O.get(cur);
      let top = null;
      if (bef && aft) this.players.forEach((p) => { const x = aft[p.id] - bef[p.id]; if (!top || Math.abs(x) > Math.abs(top.x)) top = { p: p.id, x }; });
      if (top && Math.abs(top.x) >= 0.01) topTxt = `<b>Biggest effect:</b> ${this._rvNm(top.p)} <span class="${top.x > 0 ? "pos" : "neg"}">${sgp(top.x)}</span> (≈ estimate).`;
      rows = `<div class="rvw-l">Before <em>≈ estimate</em></div>${bar(bef)}<div class="rvw-l">After <em>≈ estimate</em></div>${bar(aft)}${exact ? `<div class="rvw-l">Your checked move <em>exact</em></div>${bar(exact)}` : ""}`;
    }
    wi.innerHTML = `<div class="rv-gt"><b>Selected moment</b><span class="rvw-tip">tap the chart to pick another</span><button type="button" class="lk-ib" data-rvwm-b aria-expanded="false" aria-label="Where do these numbers come from?">${IC.info}</button></div>
      <p class="lk-it" data-rvwm-t hidden>${look ? "The line and these bars come from the luck check: the win chance looking ahead (Monte Carlo), before the roll, right after it and at the end of the turn, so a build you could see coming is already in. " : "The luck check has not finished: the line is the model's quick ≈ estimate for now, without looking ahead. "}<b>Your checked move</b> is the deeper review of your own decision in that turn (step mode); it can differ a little.</p>
      <p class="rvw-h"><b>${esc(what.head)}</b></p>
      ${what.lines.length ? `<ul class="rvw-ev">${what.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      ${topTxt ? `<p class="rvw-top">${topTxt}</p>` : ""}${rows}${near ? `<button type="button" class="rv-btn rvw-go" data-rvj="${near.i}" data-rvq="all">Step mode: ${esc(this._rvWhen(near))}${IC.chev}</button>` : ""}`;
    wi.querySelector("[data-rvwm-b]")?.addEventListener("click", (e) => { const t = wi.querySelector("[data-rvwm-t]"); t.hidden = !t.hidden; e.currentTarget.setAttribute("aria-expanded", String(!t.hidden)); });
    wi.querySelector("[data-rvj]")?.addEventListener("click", (e) => { this._rvQ = "all"; this._rvEnterStep(+e.currentTarget.dataset.rvj); });
    // the biggest swings of anyone, step by step
    if (ws) {
      const sw = [];
      if (look) look.steps.forEach((x) => { let best = null; this.players.forEach((p) => { [["roll", x.a[p.id] - x.b[p.id]], ["moves", x.e[p.id] - x.a[p.id]]].forEach(([k, v]) => { if (!best || Math.abs(v) > Math.abs(best.x)) best = { p: p.id, k, x: v }; }); }); if (best) sw.push({ s: x.S, ...best }); });
      else for (let s = 1; s <= g.N; s++) { const a = O.get(s - 1), b = O.get(s); if (!a || !b) continue; let best = null; this.players.forEach((p) => { const v = b[p.id] - a[p.id]; if (!best || Math.abs(v) > Math.abs(best.x)) best = { p: p.id, k: "est", x: v }; }); if (best) sw.push({ s, ...best }); }
      sw.sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
      const tag = { roll: "from the roll (luck)", moves: "from the turn’s moves", est: "≈ estimate" };
      ws.innerHTML = sw.slice(0, 4).map((x) => { const w = this._rvStepWhat(x.s), v = Math.round(x.x * 100); return `<button type="button" class="rs-key" data-rvws="${x.s}"><i class="pc-${x.p} rvw-dot" aria-hidden="true"></i><span class="t">${esc(w.head.split(" · ")[0])}</span><span class="x">${esc(w.head.split(" · ")[1] || "")}<small class="w">${esc(this._rvNm(x.p))}: ${tag[x.k]}</small></span><b class="${v >= 0 ? "pos" : "neg"}">${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}%</b></button>`; }).join("") || `<p class="rs-lost">The numbers are still coming in.</p>`;
      ws.querySelectorAll("[data-rvws]").forEach((b) => b.addEventListener("click", () => { this._rvWc = +b.dataset.rvws; this._rvWcAuto = false; this._rvWinTabPaint(el, O, ds); el.querySelector(".rv-scroll").scrollTop = 0; }));
    }
  },

  // Luck
  _rvTabLuck(ds) {
    const R = this._rv, LK = this._lkState(), pid = this._rvPid;
    if (LK.na) return { html: `<section class="rv-card"><div class="rv-gt"><b>Luck</b></div><p class="rs-lost">Luck in win chance is not available for this game: ${esc(LK.na)}.</p></section>` };
    if (!LK.done || LK.cover < 0.9) return { html: `<section class="rv-card rt"><div class="rv-gt"><b>Luck</b></div>${this._rvTableProg(R, LK) || `<p class="rs-lost">${LK.done ? "Luck could not be measured for enough of this game's rolls." : "The luck check has not run for this game yet."}</p>`}</section>` };
    const U = (this._lkUi ||= { open: false, pid: null, sort: "size", all: false });
    if (U.pid == null || !this.players[U.pid]) U.pid = pid;
    const L = this._rvLuck(pid);
    const bars = this.players.map((p) => { const wv = LK.tot[p.id], d = !L || L.na ? null : L.all?.[p.id], t = d ? tileOf({ me: d }) : null, wd = Math.min(50, (Math.abs(wv) / 0.5) * 50), c = Math.round(wv * 100) > 0 ? "pos" : Math.round(wv * 100) < 0 ? "neg" : ""; return `<span class="pc-${p.id} lkx-n">${this._av(p, "rt-av")}${this._rvIsYou(p.id) ? "You" : esc(p.name)}</span><i class="tr"><i class="z"></i><i class="${wv < 0 ? "neg" : "pos"}" style="${wv < 0 ? "right" : "left"}:50%;width:${wd.toFixed(1)}%"></i></i><b class="${c}">${wpText(wv)}${t ? `<small>${esc(t.n)}</small>` : ""}</b>`; }).join("");
    const html = `<section class="rv-card rvx lkx"><div class="rv-gt"><b>Luck, in win chance</b><small>dice, steals, card draws, seat order</small></div><div class="lkx-g">${bars}</div></section>
      <section class="rv-card rt rvx">${this._lkDetailsHtml(LK, true)}</section>`;
    return { html }; // (its buttons are bound with the rest: _rvBindTable)
  },

  // Moves
  _rvTabMoves(ds, res, rv) {
    const pid = this._rvPid, you = this._rvIsYou(pid), nm = esc(this.players[pid]?.name || ""), sum = summarize(rv.results), T = this._rvT || this._rvTotals(ds), imp = this._rvImp(ds), first = imp.length ? imp[0].i : ds[0]?.i;
    const sg = (v) => sgn(v * 100);
    const groups = [];
    ds.forEach((d) => { const key2 = d.k === "setup" ? "Setup" : `${this._rvTW()} ${d.t}`; let g = groups[groups.length - 1]; if (!g || g.key !== key2) groups.push((g = { key: key2, items: [] })); g.items.push(d); });
    const rows = groups.map((g) => `<div class="rs-trow"><span class="t">${g.key === "Setup" ? "Setup" : g.key.replace(/^(Turn|Roll) /, this.isRush() ? "R" : "T")}</span><div>${g.items.map((d) => `<button type="button" class="rs-mv c-${d.cls}" data-rvj="${d.i}" data-rvq="all"${d.cls === "triv" ? ' aria-label="No real choice"' : ""}>${badge(d.cls, "sm")}<span>${esc(this._rvShort(d))}</span>${d.gap >= 0.01 ? `<small>${sg(-d.gap)}</small>` : ""}</button>`).join("")}</div></div>`).join("");
    const html = `${ds.length ? `<button type="button" class="rv-btn pri rs-go" data-rvj="${first}" data-rvq="${imp.length ? "imp" : "all"}" data-rvfirst>${IC.step}Step through ${you ? "your" : `${nm}’s`} moves${imp.length ? ` · ${imp.length} to look at` : ""}</button>` : ""}
      <section class="rv-card"><div class="rv-gt"><b>All ${you ? "your" : `${nm}’s`} moves</b><small>tap to step</small></div>${sum.lost != null ? `<p class="rs-lost">${sum.n} real choices · on average ${sum.lost}% win chance given away per choice${T.capped ? ` · ${you ? "your" : "the"} moves are capped at the ${T.cap}% ${you ? "you" : "they"} could have had` : ""}</p>` : ""}${rows}</section>`;
    return { html };
  },
  _rvOverviewMid(ds, res, rv) {
    const el = this._rvEl, pid = this._rvPid, sum = summarize(rv.results);
    const mid = !!this._rvMid, prov = !this._rvReviewComplete(pid);
    const hist = !mid && !prov ? this._rvLogGame(pid) : this._rvHistory();
    const lv = this.players[pid]?.isHuman ? null : this._rvLevel(this.players[pid]), you = this._rvIsYou(pid), nm = esc(this.players[pid]?.name || "");
    const cmp = mid || prov || lv ? { text: "" } : this._rvCompare(hist);
    // v1.29 a bot is compared with its own level's band (bands.js), not with your games
    const cmpText = lv ? (lv.band ? `${lv.label} bots usually score ${Math.round(lv.band[0])} ± ${Math.round(lv.band[1])} on their own moves${prov ? " (the deep check)" : ""}.` : "") : mid ? "" : prov ? "" : rv.midCheck ? `Checked during the game · not in your average. ${cmp.text}` : cmp.text;
    const T = this._rvTotals(ds), luck = this._rvLuck(pid);
    const sg = (v) => sgn(v * 100); // v: a fraction of win chance (gp / 100): whole percent, real minus sign
    const chips = CLASSES.map((c) => `<span class="rs-cnt${sum.cls[c] ? "" : " zero"}">${badge(c, "sm")}<b>${sum.cls[c]}</b><small>${c === "missed" ? "Missed" : CLS[c][0]}</small></span>`).join("");
    const ico = IC.next.replace("<svg", '<svg class="chev"');
    const imp = this._rvImp(ds);
    const better = imp.slice(0, 5).map((d) => `<button type="button" class="rs-key rs-imp" data-rvj="${d.i}" data-rvq="imp">${badge(d.cls)}<span class="t">${this._rvWhen(d)}</span><span class="x">${esc(this._rvTerse(d))}${d.x.why?.head ? `<small class="w">${esc(d.x.why.head)}</small>` : ""}</span><b class="neg">${sg(-d.gap)}%</b>${ico}</button>`).join("");
    this._rvT = T; // the win chance bookkeeping for the (i)
    const swings = ds.filter((d, k) => Math.abs(d.cp) >= 3 && !(k && (ds[k - 1].x.s ?? 0) === (d.x.s ?? 0))).sort((a, b) => Math.abs(b.cp) - Math.abs(a.cp)).slice(0, 3);
    const key = swings.map((lk) => `<button type="button" class="rs-key" data-rvj="${lk.i}"><i class="rs-b c-luck sm" aria-hidden="true">⚄</i><span class="t">${this._rvWhen(lk)}</span><span class="x">${esc(this._rvCause(ds, ds.indexOf(lk)))}</span><b class="${lk.cp >= 0 ? "pos" : "neg"}">${sg(lk.chance)}%</b>${ico}</button>`).join("");
    const tile = tileOf(luck);
    const groups = [];
    ds.forEach((d) => { const key2 = d.k === "setup" ? "Setup" : `${this._rvTW()} ${d.t}`; let g = groups[groups.length - 1]; if (!g || g.key !== key2) groups.push((g = { key: key2, items: [] })); g.items.push(d); });
    const rows = groups.map((g) => `<div class="rs-trow"><span class="t">${g.key === "Setup" ? "Setup" : g.key.replace(/^(Turn|Roll) /, this.isRush() ? "R" : "T")}</span><div>${g.items.map((d) => `<button type="button" class="rs-mv c-${d.cls}" data-rvj="${d.i}" data-rvq="all"${d.cls === "triv" ? ' aria-label="No real choice"' : ""}>${badge(d.cls, "sm")}<span>${esc(this._rvShort(d))}</span>${d.gap >= 0.01 ? `<small>${sg(-d.gap)}</small>` : ""}</button>`).join("")}</div></div>`).join("");
    const first = imp.length ? imp[0].i : ds[0]?.i;
    const scroll = el.querySelector(".rv-scroll")?.scrollTop || 0;
    el.className = "rv rs tm";
    el.innerHTML = `${this._rvBar(mid ? "Your moves so far" : `${ds.length} decisions · ${prov ? "provisional" : ({ quick: "Quick model, rough", deep: "Deep model" })[modelOfId(rv.engId)] || "deep Monte Carlo"}`)}
      <div class="rv-scroll">
        ${this._rvProgHtml(pid)}
        ${mid ? `<section class="rv-card rv-midnote"><p><b>Up to turn ${rv.upto ?? this.turn}</b></p><button type="button" class="rv-btn pri" data-rvback-game>Back to the game</button></section>` : ""}
        <section class="rv-card rs-sum">
          ${this._rvStrip(sum.acc, cmp, mid, prov)}
          <div class="rs-sl"><div><small>${you ? "Your moves" : "Moves"}</small><b class="${T.moves < 0 ? "neg" : ""}">${sgn(T.moves)}%</b></div>${(() => { const LK = this._lkState(), w = !LK.na && LK.done && LK.cover >= 0.9 ? LK.tot[pid] : null; // v1.31 design B: luck in win chance first, the cards under it
            if (w == null) return `<button type="button" class="rs-lt" data-rvluckgo aria-label="Dice luck: ${tile.n}, ${esc(tile.sub)}. Show the table"><small>Dice luck</small><b class="${tile.cls}">${tile.n}</b><em>${esc(tile.sub)}</em></button>`;
            const c = Math.round(w * 100) > 0 ? "pos" : Math.round(w * 100) < 0 ? "neg" : "";
            return `<button type="button" class="rs-lt" data-rvluckgo aria-label="Luck: ${wpText(w)} win chance; dice ${tile.n}, ${esc(tile.side || tile.sub)}. Show the table"><small>Luck</small><b class="${c}">${wpText(w)}</b><em>${esc(tile.n)} from the dice · ${esc(tile.side || "")}</em></button>`; })()}</div>
          ${sum.lost != null ? `<p class="rs-lost">${sum.n} real choices · on average ${sum.lost}% win chance given away per choice${T.capped ? ` · ${you ? "your" : "the"} moves are capped at the ${T.cap}% you could have had` : ""}</p>` : ""}
          <div class="rs-cnts">${chips}</div>
          ${cmpText ? `<p class="rv-cmpline">${esc(cmpText)}${cmp.m != null ? ` <span class="rv-keyme">▮ this game</span> <span class="rv-keyavg">● your average</span>` : ""}</p>` : ""}
        </section>
        ${better ? `<section class="rv-card rs-keys rs-better"><div class="rv-gt"><b>Could be better</b><small>${imp.length} to look at</small></div>${better}</section>` : ""}
        ${ds.length ? `<button type="button" class="rv-btn pri rs-go" data-rvj="${first}" data-rvq="${imp.length ? "imp" : "all"}" data-rvfirst>${IC.step}Step through ${you ? "your" : `${nm}’s`} moves</button>` : ""}
        ${this._rvTableHtml(pid, pid) || this._rvLuckCard(luck, pid)}
        ${key ? `<section class="rv-card rs-keys rs-swings"><div class="rv-gt"><b>${swings.length} biggest swings</b><small>win chance, from dice and the others</small></div>${key}</section>` : ""}
        ${ds.length ? `<section class="rv-card rs-wcard"><div class="rv-gt"><b>Win chance</b><small>${you ? "you" : nm} thick · bars: dice and others <i class="kl"></i> ${you ? "your" : "their"} moves <i class="ks"></i></small></div>${this._rvChart(ds)}</section>` : ""}
        <section class="rv-card"><div class="rv-gt"><b>All ${you ? "your" : `${nm}’s`} moves</b><small>tap to step</small></div>${rows}</section>
        ${mid ? "" : this._raBox?.() || ""}

      </div>`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    el.querySelector("[data-rvluckgo]")?.addEventListener("click", () => el.querySelector(".rs-dice")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    this._rvBindTop(el);
    this._raBind?.(el);
    this._rvBindTable(el);
    el.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = b.dataset.rvq || "all"; this._rvDrawReview(+b.dataset.rvj); }));
  },
  /** The dice luck of everyone at the table, yours first with the numbers behind it, and the one honest sentence. */
  _rvLuckCard(L, pid) {
    if (!L || L.na) return `<section class="rv-card rs-dice"><div class="rv-gt"><b>Dice luck</b></div><p class="rs-lost">${esc(L?.na || "not available")}. It needs the game's event log.</p></section>`;
    const me = L.me, order = [pid, ...this.players.map((p) => p.id).filter((q) => q !== pid)];
    const rows = order.map((q) => { const d = L.all[q], t = tileOf({ me: d }), mine = q === pid; return `<div class="rs-lrow pc-${q}${mine ? " me" : ""}"><i></i><span class="n">${this._rvNm(q)}</span><span class="c">${d.got} of ${Math.round(d.exp)}</span><b class="${t.cls}">${t.n}</b><small>${esc(topText(d.top))}</small></div>`; }).join("");
    const you = this._rvIsYou(pid), nm = this.players[pid]?.name || "";
    return `<section class="rv-card rs-dice" id="rvdice"><div class="rv-gt"><b>Dice luck</b><small>cards collected · expected</small></div>${rows}
      <p class="rs-lost">${you ? "You" : esc(nm)}: ${me.got + (me.short || 0)} cards, ${Math.round(me.exp)} expected${me.blockedCards ? `; the robber took ${me.blockedCards}` : ""}.</p></section>`;
  },
  /** What could be better, largest gap first: could be better, mistakes, blunders and missed chances. */
  _rvImp(ds) { return ds.filter((d) => IMP.includes(d.cls)).sort((a, b) => b.gap - a.gap || a.i - b.i); },
  _rvStepDraw(ds) {
    const el = this._rvEl, d = ds.find((q) => q.i === this._rvStep), x = d.x, mid = !!this._rvMid;
    if (this._rvPbp && this._rvPbp.i !== d.i) this._rvPbp = null;
    if (this._rvPbp && this._rvLiveFlag) return; // the play-by-play stays as it is while a check runs
    const imp = this._rvImp(ds);
    if (this._rvQ === "imp" && !imp.some((q) => q.i === d.i)) this._rvQ = "all";
    const list = this._rvQ === "imp" ? imp : ds, k = list.findIndex((q) => q.i === d.i);
    const show = this._rvAB = this._rvAB || "both", me = this._rvPid;
    const noA = d.same;
    const shown = show === "A" && !noA ? d.bseats : d.seats, sg = (v) => `${sgn(v * 100)}%`;
    const who = this._rvNm(me);
    const groups = [];
    ds.forEach((q) => { const key = q.k === "setup" ? "Setup" : `${this._rvTW()} ${q.t}`; let g = groups[groups.length - 1]; if (!g || g.key !== key) groups.push((g = { key, items: [] })); g.items.push(q); });
    const strip = groups.map((g) => `<div class="rs-g"><small>${g.key}</small><div>${g.items.map((q) => `<button type="button" data-rvj="${q.i}" class="rs-chip${q.i === d.i ? " on" : ""}" aria-label="${g.key}: ${CLS[q.cls][0]}">${q.cls === "triv" ? '<i class="rs-dot" title="No real choice"></i>' : badge(q.cls, "sm")}</button>`).join("")}</div></div>`).join("");
    const sameBoard = el.classList.contains("step") && this._rvBoardKey === `${d.i}|${show}` && el.querySelector(".rs-board canvas");
    const scrub = el.querySelector(".rs-strip")?.scrollLeft || 0;
    const prov = !this._rvReviewComplete(this._rvPid);
    const A = noA ? "" : `<div class="a${show === "B" ? " dim" : ""}" data-rvab="A"><s>A</s><small>Better</small><b>${esc(tradeShow(x.best.label))}</b><i>${d.A}%</i></div>`;
    const B = `<div class="b${show === "A" && !noA ? " dim" : ""}" data-rvab="B"><s class="alt">B</s><small>${who} did</small><b>${esc(tradeShow(x.label))}</b><i>${d.B}%</i></div>`;
    const cardHtml = `<div class="rs-h">${badge(d.cls, "lg")}<b>${CLS[d.cls][0]}</b><span>${this._rvKind(d)}</span><em class="${d.gp ? "neg" : "pos"}">${d.gp ? sg(-d.gap) : "±0"}</em></div>
        <p class="rs-s">${this._rvLine(d)}</p>
        ${noA ? "" : whyHtml(x.why)}
        <div class="rs-ab${noA ? " one" : ""}">${A}${B}</div>
        ${this._lkSplitHtml(d, ds, sg)}
        <div class="rs-strip" role="tablist" aria-label="Your decisions">${strip}</div>
        <div class="rs-nav"><button type="button" class="rv-btn" data-rvnav="-1" ${k ? "" : "disabled"} aria-label="Previous decision">${IC.prev}Previous</button><button type="button" class="rv-btn rs-ov" data-rvallmoves>${mid ? "Overview" : "All moves"}</button><button type="button" class="rv-btn pri" data-rvnav="1" ${k < list.length - 1 ? "" : "disabled"} aria-label="Next decision">Next${IC.next}</button></div>`;
    const evalHtml = `<b>${pct(shown[me] / (shown.reduce((a, c) => a + c, 0) || 1))}</b>${this._rvStack(shown)}`;
    const wcHtml = this._rvLegend(shown);
    const bindCard = (root) => {
      root.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = "all"; this._rvDrawReview(+b.dataset.rvj); }));
      root.querySelectorAll("[data-rvwhy]").forEach((b) => b.addEventListener("click", () => { this._rvInfoOpen = true; this._rvShowInfo(); }));
      root.querySelectorAll("[data-rvnav]").forEach((b) => b.addEventListener("click", () => { const n = list[k + +b.dataset.rvnav]; if (n) this._rvDrawReview(n.i); }));
      root.querySelectorAll("[data-rvab]").forEach((b) => b.addEventListener("click", () => { const v = b.dataset.rvab; this._rvAB = v === this._rvAB && v !== "both" ? "both" : v; this._rvDrawReview(); }));
      root.querySelectorAll("[data-rvlx]").forEach((b) => b.addEventListener("click", () => { const v = b.dataset.rvlx; this._lkOpen = this._lkOpen === v ? null : v; const c = el.querySelector(".rs-card .rs-lkw"); if (c) { const n = document.createElement("div"); n.innerHTML = this._lkSplitHtml(d, ds, sg); c.replaceWith(n.firstElementChild); bindCard(el.querySelector(".rs-card .rs-lkw")); } }));
    };
    if (this._rvLiveFlag && sameBoard) { // a running check refreshed a number: the board stays as it is
      el.querySelector(".rs-card").innerHTML = cardHtml; el.querySelector(".rs-eval").innerHTML = evalHtml; const wcEl = el.querySelector(".rs-wc"); if (wcEl) wcEl.innerHTML = wcHtml;
      const pr = el.querySelector(".rv-prog"), nh = this._rvProgHtml(this._rvPid);
      if (pr || nh) { const tmp = document.createElement("div"); tmp.innerHTML = nh; if (pr && tmp.firstElementChild) pr.replaceWith(tmp.firstElementChild); else if (pr) pr.remove(); else if (tmp.firstElementChild) el.querySelector(".rs-stage").before(tmp.firstElementChild); this._rvBindProg(el); }
      bindCard(el.querySelector(".rs-card")); el.querySelector(".rs-strip .on")?.scrollIntoView?.({ inline: "center", block: "nearest" });
      return;
    }
    // v1.29 whose moves: everyone at the table with recorded choices (you, the bots, each person in pass & play)
    const many = !mid && this.players.filter((p) => this._rvTodo(p.id).length && (p.isHuman || this._rv.bots)).length > 1;
    const whoBtn = many ? `<button type="button" class="rv-btn rs-who" data-rvwho aria-haspopup="menu" aria-label="Whose moves: ${who}. Change">${this._av(this.players[me], "rt-av")}<i class="cv" aria-hidden="true"></i></button>` : "";
    el.className = `rv rs step tm${mid ? " noboard" : ""}${x.why && !noA ? " hw" : ""}`; el.dataset.show = show;
    el.innerHTML = `<div class="rv-bar rs-bar${whoBtn ? " w" : ""}"><button type="button" class="rv-btn" data-rvclose-step aria-label="${mid ? "Back to the overview" : this._rvStepFrom ? "Back to the review" : "Back to the results"}">${IC.back}</button><div><h3>${this._rvIsYou(me) ? "You" : esc(this.players[me].name)} · moves</h3><small>${this._rvWhen(d)} · ${k + 1} of ${list.length}${this._rvQ === "imp" ? " · could be better" : ""}${prov ? " · provisional" : ""}</small></div>${whoBtn}<button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review">${IC.info}</button></div>
      ${this._rvProgHtml(this._rvPid)}
      <div class="rs-stage"><div class="rs-eval">${evalHtml}</div>
        ${mid ? "" : `<div class="rs-board"><canvas></canvas><svg class="rs-marks" aria-hidden="true"></svg><div class="rs-wc" aria-hidden="true">${wcHtml}</div><button type="button" class="rs-pbp" data-rvpbp aria-label="Play by play: every move since your last decision">${IC.step}<span>Play</span></button>${noA ? "" : `<div class="rs-tog" role="group" aria-label="Show on the board"><button type="button" data-rvab="A" class="${show === "A" ? "on" : ""}" aria-label="Better move"><s>A</s></button><button type="button" data-rvab="both" class="${show === "both" ? "on" : ""}">A + B</button><button type="button" data-rvab="B" class="${show === "B" ? "on" : ""}" aria-label="What you did"><s class="alt">B</s></button></div>`}</div>`}</div>
      <div class="rs-card">${cardHtml}</div>`;
    const sc = el.querySelector(".rs-strip"); if (sc) { sc.scrollLeft = scrub; el.querySelector(".rs-chip.on")?.scrollIntoView?.({ inline: "center", block: "nearest" }); }
    this._rvBindTop(el);
    el.querySelectorAll("[data-rvclose-step]").forEach((b) => b.addEventListener("click", () => this._rvStepBack()));
    el.querySelector("[data-rvallmoves]")?.addEventListener("click", () => { this._rvStep = null; this._rvPbp = null; this._rvStepFrom = null; if (!this._rvMid) this._rvTab = "moves"; this._rvDrawReview(); }); // the list of this player's moves (a check during the game: its single overview) // v1.36 leaving the decision ends its play-by-play (else coming back resumed it: the ≈ estimates in the legend instead of the decision's numbers)
    el.querySelector("[data-rvwho]")?.addEventListener("click", (e) => { e.stopPropagation(); this._rvWhoPop(); });
    bindCard(el);
    el.querySelector("[data-rvpbp]")?.addEventListener("click", () => this._rvPbpOpen(d, ds));
    let x0 = null;
    [el.querySelector(".rs-stage"), el.querySelector(".rs-card")].forEach((n) => { if (!n) return; n.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true }); n.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; const nx = list[k + (dx < 0 ? 1 : -1)]; if (!this._rvPbp && Math.abs(dx) > 50 && nx) this._rvDrawReview(nx.i); }, { passive: true }); });
    if (!mid) { this._rvBoard(d, show); try { gameOdds(this); } catch (_) { /* the play-by-play's win chance warms up (worker, cached per game) */ } }
    if (this._rvPbp && !mid) this._rvPbpGo(d, ds, this._rvPbp.j); // back from A/B toggle etc. while playing by play
  },
  /** v1.31 design B: "Since your last move: Luck +2% · Others +1% · Your move ±0". Luck = the chance events in between (src/review-luck.js),
   *  Others = the rest of "Dice & others" (the others' moves, and the estimate moving between two moments). Each folds open: Luck to every
   *  roll / steal / card draw with its effect, Others to the others' checked moves in between. Without luck numbers: "Dice & others" as before. */
  _lkSplitHtml(d, ds, sg) {
    const me = this._rvPid, k = ds.indexOf(d), from = k > 0 ? ds[k - 1].x.e ?? 0 : 0, to = d.x.e ?? 0;
    const lead = `<span>${d === ds[0] ? "From an even share" : `Since ${this._rvIsYou(me) ? "your" : "their"} last move`}</span>`, lead2 = `<span>${d === ds[0] ? "From the start" : "Since last move"}</span>`;
    const mv = `<b class="${d.gp ? "neg" : "pos"}">${this._rvIsYou(me) ? "Your move" : "Move"} ${d.gp ? sg(-d.gap) : "±0"}</b>`;
    const LK = this._lkState(), lk = !LK.na && LK.cover >= 0.9 ? this._lkBetween(me, from, to) : null;
    if (!lk || lk.missing) return `<div class="rs-lkw"><div class="rs-lk">${lead}<b class="${d.cp >= 0 ? "pos" : "neg"}">Dice &amp; others ${sg(d.chance)}</b>${mv}</div></div>`;
    const oth = d.chance - lk.sum, c = (v) => (Math.round(v * 100) > 0 ? "pos" : Math.round(v * 100) < 0 ? "neg" : "");
    const open = this._lkOpen;
    const btn = (key, label, v) => `<button type="button" class="lk" data-rvlx="${key}" aria-expanded="${open === key}"><b class="${c(v)}">${label} ${wpText(v)}</b><i aria-hidden="true">${open === key ? "▲" : "▼"}</i></button>`;
    let panel = "";
    if (open === "luck") {
      const chip = (x) => { const w = x.w, t = Math.abs(w) < 0.01 ? wpText(w, 1) : wpText(w), lab = x.ev.kind === "dice" ? String(x.ev.roll) : x.ev.kind === "steal" ? "steal" : "card"; return `<i class="${c(w * 10)}" title="${esc(this._lkWhat(x.ev, me))}"><b>${lab}</b>${t}</i>`; };
      panel = `<div class="rs-lx" role="region" aria-label="Luck since the last move">${lk.list.length ? `<div class="chips">${lk.list.map(chip).join("")}</div>` : "<p>No roll in between.</p>"}</div>`;
    } else if (open === "oth") {
      const R = this._rv, moves = [];
      Object.values(R?.revs || {}).forEach((rv) => (rv?.results || []).forEach((x) => { if (rv.pid !== me && x.e != null && x.e >= from && x.e < to && (!x.skip || x.skip === "trivial") && x.win != null) moves.push({ x, pid: rv.pid }); }));
      moves.sort((a, b) => a.x.e - b.x.e);
      const li = moves.slice(0, 12).map(({ x, pid }) => { const gp = gpOf(x); return `<li><span>${this._rvNm(pid)}: ${esc(this._rvTerse({ x, cls: clsOf(x), k: x.k, same: !x.best }).replace(/ → .*/, ""))}</span><b class="${gp >= 1 ? "neg" : ""}">${gp >= 1 ? `their slip −${gp}%` : "fine"}</b></li>`; }).join("");
      const gam = lk.theirs.map((x) => `<li><span>${esc(this._lkWhat(x.ev, me))}</span><b class="${c(x.w * 10)}">${Math.abs(x.w) < 0.01 ? wpText(x.w, 1) : wpText(x.w)}</b></li>`).join("");
      panel = `<div class="rs-lx" role="region" aria-label="The others since the last move">${moves.length ? `<ol>${li}</ol>` : ""}${gam ? `<ol>${gam}</ol>` : ""}${moves.length || gam ? "" : "<p>Not checked yet.</p>"}</div>`;
    }
    return `<div class="rs-lkw"><div class="rs-lk lk2">${lead2}${btn("luck", "Luck", lk.sum)}${btn("oth", "Others", oth)}${mv}</div>${panel}</div>`;
  },
  /** Named win chances for the board corner: you first, then the others by chance, one short line each. */
  _rvLegend(seats, est = false) {
    const me = this._rvPid, sum = seats.reduce((a, b) => a + b, 0) || 1;
    const order = [me, ...this.players.map((p) => p.id).filter((q) => q !== me).sort((a, b) => seats[b] - seats[a])];
    return order.map((q) => `<span class="pc-${q}${q === me ? " me" : ""}"><i></i>${this._rvNm(q)}<b>${est ? "≈" : ""}${Math.round((seats[q] / sum) * 100)}%</b></span>`).join("");
  },
  _rvPName(pid) { const p = this.players[pid]; return !p ? "Someone" : p.isHuman && !this.hotseat ? "You" : esc(p.name); },
  /** Every move between your previous decision and this one, as beats: a roll (with who got what), a build, a trade, the robber, a steal, a card. */
  _rvBeats(d, ds) {
    const st = this._st, ev = this.stats.ev, k = ds.indexOf(d), from = k ? ds[k - 1].x.e : 0, to = d.x.e;
    const s0 = k ? ds[k - 1].x.s : 0, RN = ["Lumber", "Brick", "Wool", "Grain", "Ore"], me = this._rvPid;
    const beats = [], nm = (q) => this._rvPName(q);
    // v1.31 the luck of each roll / steal / card draw for this seat (src/review-luck.js), when computed
    const LKm = new Map(); try { if (!this._lkNa()) this._lkList(me).filter((x) => x.own).forEach((x) => LKm.set(x.ev.kind === "dice" ? `d${x.ev.s}` : `e${x.ev.e}`, x.w)); } catch (_) { /* no luck numbers */ }
    const lkTxt = (w) => (w == null ? "" : ` · luck ${this._rvIsYou(me) ? "you" : esc(this.players[me]?.name || "")} ${Math.abs(w) < 0.01 ? wpText(w, 1) : wpText(w)}`);
    const roll = (s, cursor) => {
      const step = st.steps[s - 1]; if (!step) return;
      const got = new Map();
      (st.stepEvents[s] || []).forEach((e) => { const g = st.evIx.get(e); if (e[1] === "P" && g >= from && g < to) { const o = got.get(e[2]) || { n: 0, r: {} }; o.n += e[5] || 1; o.r[e[4]] = (o.r[e[4]] || 0) + (e[5] || 1); got.set(e[2], o); } });
      const sum = step[2] + step[3];
      const parts = [...got].sort((a, b) => (a[0] === me ? -1 : b[0] === me ? 1 : 0)).map(([q, o]) => (q === me ? `${nm(q)} +${Object.entries(o.r).map(([r, n]) => `${n} ${RN[r]}`).join(" +")}` : `${nm(q)} +${o.n} ${o.n === 1 ? "card" : "cards"}`));
      beats.push({ s, upto: cursor, who: step[1], chip: String(sum), head: `${nm(step[1])} rolled ${sum}`, sub: (sum === 7 ? "The robber moves and big hands are halved." : parts.length ? parts.join(" · ") : "Nobody got cards.") + lkTxt(LKm.get(`d${s - 1}`)), sev: sum === 7 });
    };
    let last = s0;
    for (let g = from; g < to; g += 1) {
      const e = ev[g]; if (!e) continue;
      while (last < e[0]) { last += 1; roll(last, g); }
      const [, c, a, b, x, y] = e;
      if (c === "P") continue;
      const nmA = nm(a), obj = { s: e[0], upto: g + 1, who: a };
      if (c === "b" && b === "r") beats.push({ ...obj, chip: "road", head: `${nmA} built a road`, focus: { edge: x } });
      else if (c === "b" && b === "h") beats.push({ ...obj, chip: "ship", head: `${nmA} built a ship` });
      else if (c === "b" && b === "s") beats.push({ ...obj, chip: "settl.", head: `${nmA} built a settlement`, focus: { node: x } });
      else if (c === "b" && b === "c") beats.push({ ...obj, chip: "city", head: `${nmA} built a city`, focus: { city: x } });
      else if (c === "R") beats.push({ ...obj, chip: "robber", head: `${nmA} moved the robber`, sub: `To ${this._hexName?.(b) ?? "another tile"}.`, focus: { hex: b } });
      else if (c === "t") beats.push({ ...obj, chip: "steal", head: `${nmA} stole a card`, sub: `From ${nm(b)}.${lkTxt(LKm.get(`e${g}`))}` });
      else if (c === "x") beats.push({ ...obj, chip: "trade", head: `${nmA} traded with ${nm(b)}`, sub: `${x} for ${y} cards.` });
      else if (c === "k") beats.push({ ...obj, chip: "bank", head: `${nmA} traded with the bank`, sub: `Gave ${x} ${RN[b]} for 1 ${RN[y]}.` });
      else if (c === "d") beats.push({ ...obj, chip: "7", head: `${nmA} handed back ${b} cards` });
      else if (c === "v") beats.push({ ...obj, chip: "card", head: `${nmA} bought a development card`, ...(LKm.has(`e${g}`) ? { sub: lkTxt(LKm.get(`e${g}`)).replace(/^ · l/, "L") } : {}) });
      else if (c === "y") beats.push({ ...obj, chip: "card", head: `${nmA} played a development card` });
    }
    while (last < d.x.s && last < st.N) { last += 1; roll(last, to); }
    // eng-147 from the first decision of the game, the play-by-play starts at the empty board (the seat order)
    if (!from && this.players.length > 1) beats.unshift({ s: 0, upto: 0, who: -1, start: true, chip: "start", head: "Empty board", sub: "Before the first placement: the seat order on this board, equal players." });
    return beats;
  },
  /** Open the play-by-play of the moves leading to this decision: the board steps through them, the card says what happened. */
  _rvPbpOpen(d, ds) {
    if (!this._st) return;
    if (!this._st.evIx) this._st.evIx = new Map(this.stats.ev.map((e, i) => [e, i]));
    this._rvPbp = { i: d.i, j: 0, beats: this._rvBeats(d, ds) };
    this._rvPbpGo(d, ds, 0);
  },
  _rvPbpGo(d, ds, j) {
    const el = this._rvEl, P = this._rvPbp;
    if (!el || !P || P.i !== d.i) return;
    const B = P.beats, n = B.length;
    if (!n) { this._rvPbp = null; return; }
    j = Math.max(0, Math.min(n - 1, j)); P.j = j;
    const b = B[j], me = this._rvPid;
    const strip = B.map((q, i) => `<button type="button" data-rvbeat="${i}" class="rs-chip pb${i === j ? " on" : ""}${q.who === me ? " mine" : ""}" aria-label="${esc(q.head)}"><span class="pc-${q.who >= 0 ? q.who : me}"><i></i></span><small>${q.chip}</small></button>`).join("");
    const card = el.querySelector(".rs-card");
    card.innerHTML = `<div class="rs-h pb-h"><span class="pc-${b.who >= 0 ? b.who : me} pb-dot"><i></i></span><b>${b.head}</b><em>${j + 1} of ${n}</em></div>
      <p class="rs-s">${b.sub || "&nbsp;"}</p>
      <div class="rs-strip" role="tablist" aria-label="Moves">${strip}</div>
      <div class="rs-nav pb-nav"><button type="button" class="rv-btn" data-rvbeatnav="-1" ${j ? "" : "disabled"} aria-label="Previous move">${IC.prev}</button><button type="button" class="rv-btn pri" data-rvbeatnav="1" ${j < n - 1 ? "" : "disabled"} aria-label="Next move">Next${IC.next}</button><button type="button" class="rv-btn" data-rvpbpx>${this._rvIsYou(me) ? "Your" : "Their"} decision</button></div>`;
    card.querySelectorAll("[data-rvbeat]").forEach((x) => x.addEventListener("click", () => this._rvPbpGo(d, ds, +x.dataset.rvbeat)));
    card.querySelectorAll("[data-rvbeatnav]").forEach((x) => x.addEventListener("click", () => this._rvPbpGo(d, ds, j + +x.dataset.rvbeatnav)));
    card.querySelector("[data-rvpbpx]").addEventListener("click", () => { this._rvPbp = null; this._rvDrawReview(); });
    card.querySelector(".rs-strip .on")?.scrollIntoView?.({ inline: "center", block: "nearest" });
    el.classList.add("pbp");
    // the board at the moment after this move; a ring on what was just built or moved
    this._rpSeek(b.s, b.upto);
    // v1.28 the running win chance at this move: the Replay's estimate (≈, src/replay-odds.js); the decision itself keeps the review's numbers
    const wc = el.querySelector(".rs-wc");
    if (wc) {
      const O = gameOdds(this), key = (this._rvPbpSeq = (this._rvPbpSeq || 0) + 1);
      if (!wc.classList.contains("est")) wc.innerHTML = "<span>Win chance ≈ …</span>"; // (not the decision's numbers while it computes)
      wc.classList.add("est");
      if (!O.na && b.start && O.seat) { wc.classList.remove("est"); wc.innerHTML = this._rvLegend(O.seat); }
      else if (!O.na) O.at(b.s, b.upto).then((p) => { if (p && this._rvPbpSeq === key && this._rvPbp?.i === d.i && wc.isConnected) wc.innerHTML = this._rvLegend(p, true); });
      else wc.innerHTML = `<span>Win chance n/a</span>`;
    }
    this.boardRenderer?.requestDraw?.();
    const svg = el.querySelector(".rs-marks"), box = el.querySelector(".rs-board");
    if (svg && box) {
      const w = Math.round(box.getBoundingClientRect().width), h = Math.round(box.getBoundingClientRect().height);
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const g = this.geometry, V = this.view;
      let ring = "";
      if (b.focus) { const p = rvPos(g, b.focus), x = p.x * V.scale + V.offsetX, y = p.y * V.scale + V.offsetY, r = p.hex ? g.hexSize * V.scale * 0.6 : p.edge ? 15 : 18; ring = `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="7"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--accent, #F0B45C)" stroke-width="3.6"/>`; }
      svg.innerHTML = ring;
    }
    el.querySelector(".rs-tog")?.setAttribute("hidden", "");
  },
  _rvBindProg(el) {
    el.querySelector("[data-rvstop]")?.addEventListener("click", () => { this._rvStop(); this._rvLive(true); });
    el.querySelector("[data-rvj]")?.addEventListener("click", () => {});
  },
  _rvCloseBoard() { if (this._rpSaved && this._rvBoardKey) { try { this._rpClose(); } catch (_) { /* none open */ } } this._rvBoardKey = null; },
  /** The Replay's renderer into our canvas: the position just before the decision, zoomed to A and B. */
  _rvBoard(d, show) {
    const el = this._rvEl, box = el.querySelector(".rs-board"), cv = box?.querySelector("canvas");
    if (!cv || !this._st) return;
    const br = box.getBoundingClientRect(), w = Math.round(br.width), h = Math.round(br.height);
    if (w < 20 || h < 20) return;
    const st = this._st, rec = this._rv.recs[d.i];
    this._rpOpen(cv, w, h);
    if (!st.evIx) st.evIx = new Map(this.stats.ev.map((e, i) => [e, i]));
    this._rpSeek(rec.s, rec.e);
    const A = d.same ? null : d.x.best?.focus, B = d.x.focus;
    const g = this.geometry, W = !d.same && d.x.why?.mark, pts = [A, B, ...(W ? [...(W.nodes || []).map((node) => ({ node })), ...(W.edges || []).map((edge) => ({ edge }))] : [])].filter(Boolean).map((f) => rvPos(g, f));
    const fit = this._rpFitView(w, h, 8);
    if (pts.length) {
      const m = g.hexSize * 1.7, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs) - m, maxX = Math.max(...xs) + m, minY = Math.min(...ys) - m, maxY = Math.max(...ys) + m;
      const sc = Math.min(Math.max(Math.min(w / (maxX - minX), h / (maxY - minY)), fit.scale * 1.15), fit.scale * 2.8);
      this.view = { scale: sc, offsetX: w / 2 - ((minX + maxX) / 2) * sc, offsetY: h / 2 - ((minY + maxY) / 2) * sc };
    }
    this.boardRenderer?.resync?.(); this.boardRenderer?.invalidateStatic?.(); this.boardRenderer?.requestDraw?.();
    const svg = box.querySelector(".rs-marks");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = rvMarks(this, d, A, B);
    this._rvBoardKey = `${d.i}|${show}`;
  },
};

export function installReviewGame(Cls) {
  const P = Cls.prototype;
  // Back from a Show opened in the review: return to the review, not to the results
  const exit = P._rpExit;
  P._rpExit = function (silent = false) {
    if (this._rvBackToReview && this._rvEl && !silent) {
      this._rvBackToReview = false;
      const r = exit.call(this, true);
      this._rvEl.hidden = false;
      return r;
    }
    this._rvBackToReview = false;
    return exit.call(this, silent);
  };
  const remove = P.removeGameOverOverlay;
  P.removeGameOverOverlay = function (...a) { this._rvCloseReview?.(); return remove.apply(this, a); };
}
