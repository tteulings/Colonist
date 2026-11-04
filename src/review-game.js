// v1.03 Game review (an option under the missed chances): every real decision of yours checked by the Master
// bot's Monte Carlo search in the Web Worker (src/review/evaluate.js), ~0.5 s each, with progress and Stop.
//   · v1.03 layout B: the counts and your win chance first; accuracy (0–100, chess.com-style on the win
//     chance each move gave away) as one line below, next to the luck you had
//     (cards from your numbers vs expected, the robber on your tiles vs the table), and where it sits among
//     the bots (bands measured on their own decisions, see BANDS)
//   · your win chance after each decision, marked strong / could be sharper / missed chance
//   · a tappable turn strip and a list of your turns; Show on board for a marked decision
//   · the missed-chance lines on the end screen then come from the Master's check (verified)
import { esc, IC, cmpHtml } from "./review-ui.js";
import { summarize, REVIEW, REVIEW_ENGINE, REVIEW_ENGINES } from "./review/evaluate.js";
import { reviewAvailable } from "./master.js";

// The bots' accuracy with the review engine in use (src/review/evaluate.js REVIEW_ENGINES), if measured.
export const BANDS = REVIEW.bands || [];
const MARK = { good: "Strong", inacc: "Could be sharper", miss: "Missed chance" };
const mk = (m, cls = "") => `<i class="rv-mk mk-${m} ${cls}" aria-hidden="true"></i>`;
const pct = (x) => `${Math.round(x * 100)}%`;

export const ReviewGameMixin = {
  /** The review is offered for a Classic game of up to 4 players (what the Master's search covers). */
  _rvReviewable() { return !!this._rv?.recs?.length && this._rvCovered() && this.players.length <= 4; },

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
  _rvMidPid() { return this.winner || this.home?.open ? null : this._rvSoloPid(); },
  _rvMidSub() {
    const pid = this._rvMidPid();
    if (pid == null) return "";
    const rv = this._rv.review, left = this._rvTodo(pid).filter(([, i]) => !(rv?.pid === pid && rv.results.some((x) => x.i === i))).length;
    const when = left ? `about ${Math.max(1, Math.round((left * REVIEW.sec) / 60))} min` : "already checked";
    return `Up to turn ${this.turn} · ${when}`;
  },
  _rvOpenMid() { const pid = this._rvMidPid(); if (pid != null) this._rvOpenReview(pid, { mid: true }); },

  /** The inside of the end screen's review button: the accuracy, a ring while it runs, "provisional" in between. */
  _rvRowInner(p) {
    const rv = this._rv.review, mine = rv?.pid === p.id, run = this._rv.run;
    const sum = mine && rv.results.length && this._rvCovered1(p.id) ? summarize(rv.results) : null;
    const done = mine && this._rvReviewComplete(p.id);
    const n = this._rv.recs.filter((r) => r.pid === p.id && ["setup", "build", "bank", "buy", "play", "robber", "end"].includes(r.k)).length;
    let x, g = "";
    if (done) x = `Game review · accuracy ${sum?.acc ?? "–"}${rv.midCheck ? " · checked during the game" : ""}`;
    else if (run?.pid === p.id && run.round) {
      const r = run.round, f = r.n ? r.j / r.n : 0;
      x = sum ? `Game review · ${run.paused ? "paused" : r.eng === "m100" ? "quick look" : "deepening"}${sum.acc != null ? ` · ${sum.acc} so far` : ""}` : `Game review · checking`;
      g = `<i class="rv-ring" style="--p:${Math.round(f * 100)}%" role="img" aria-label="${r.j} of ${r.n}"></i>`;
    } else if (sum) { x = `Game review · provisional${sum.acc != null ? ` ${sum.acc}` : ""}`; g = "Continue"; }
    else { x = "Full game review"; g = `≈${Math.max(1, Math.round((n * REVIEW.sec) / 60))} min`; }
    return `<span class="t">${IC.review}</span><span class="x">${x}</span><span class="g">${g}</span>${IC.chev}`;
  },
  _rvReviewRowHtml(p) {
    if (!this._rvReviewable()) return "";
    return `<button type="button" class="rvb" data-rvreview="${p.id}">${this._rvRowInner(p)}</button>`;
  },
  _rvPatchRows() {
    document.querySelectorAll("[data-rvreview]").forEach((b) => { const p = this.players[+b.dataset.rvreview]; if (p) b.innerHTML = this._rvRowInner(p); });
  },
  _rvBindReview(box) {
    box.querySelectorAll("[data-rvreview]").forEach((b) => b.addEventListener("click", () => this._rvOpenReview(+b.dataset.rvreview)));
  },

  /** Missed chances once the Master has checked the game: its own misses, biggest first (a detector line
   *  stays when the Master agrees with it; the gain is then in win chance). */
  _rvVerified(pid) {
    const rv = this._rv?.review;
    if (!rv || rv.pid !== pid || !this._rvReviewComplete(pid)) return null;
    const recs = this._rv.recs;
    return rv.results.filter((x) => x.mark === "miss" && x.best).sort((a, b) => b.loss - a.loss).slice(0, 3).map((x) => {
      const det = this._rv.res?.findings?.find((f) => f.pid === pid && f.i === x.i);
      return this._rvEvalFinding(x, recs[x.i], det);
    });
  },
  _rvEvalFinding(x, rec, det = null) {
    let hand = null;
    try { hand = JSON.parse(rec.st).players[rec.pid].resources; } catch (_) { hand = null; }
    const gain = `+${Math.round(x.best.gain * 100)}%`;
    return { kind: det?.kind || "eval", pid: rec.pid, i: x.i, t: x.t, s: x.s, e: x.e, size: x.loss, verified: true, markLabel: MARK[x.mark],
      line: det?.line || `${x.best.label} was stronger`, gain, gainLong: `${gain} win chance was possible`,
      did: x.label, better: x.best.label, hand: det?.hand || hand,
      why: `${det?.kind === "seven" ? `A 7 then took ${det.n} of your ${det.T7} cards. ` : ""}Checked by the Master bot: played into the same ${x.futures || ""} random futures, ${x.best.label} won ${pct(x.win + x.best.gain)} of the time, ${x.label.charAt(0).toLowerCase() + x.label.slice(1)} ${pct(x.win)}.`.replace(/  +/g, " "),
      cmp: { a: x.best.label, b: x.label, total: "Win chance %", int: true, sa: 100 * (x.win + x.best.gain), sb: 100 * x.win,
        rows: [{ k: "win", label: "Won in the futures", a: 100 * (x.win + x.best.gain), b: 100 * x.win }, { k: "eta", label: "Futures played", a: x.futures || 0, b: x.futures || 0 }] },
      focus: { a: x.best.focus || det?.focus?.a || null, b: x.focus || det?.focus?.b || null } };
  },

  /** Luck: cards from your numbers vs expected, the robber on your tiles vs the table's average. */
  _rvLuck(pid) {
    const st = this._st;
    if (!st) return null;
    const got = st.prodTot[pid], exp = st.expected[pid];
    // cards the robber blocked from each player (the log knows where it stood and who had built there)
    const g = this.geometry, blocked = this.players.map(() => 0), owner = new Map();
    for (let s = 0; s <= st.N; s += 1) {
      if (s > 0) {
        const step = st.steps[s - 1], roll = step[2] + step[3], h = g.hexes[st.robberAt[s]];
        if (roll !== 7 && h && h.number === roll) h.nodes.forEach((nid) => { const o = owner.get(nid); if (o) blocked[o[0]] += o[1]; });
      }
      st.stepEvents[s].forEach((e) => { const [, c, a, b, x] = e; if (c === "b" && b === "s") owner.set(x, [a, 1]); else if (c === "b" && b === "c") owner.set(x, [a, 2]); else if (c === "u" && b === "s") owner.delete(x); });
    }
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return { got, exp: Math.round(exp), dice: exp > 0.5 ? got / exp - 1 : 0, blocked: blocked[pid], blockedAvg: avg(blocked), stolen: st.stolenFrom[pid], stolenAvg: avg(st.stolenFrom) };
  },
  /** v1.03 rolling record of your game accuracies (this device): one entry per reviewed game. */
  _rvHistory(add = null) {
    const KEY = "colonist_review_hist_v1";
    let h = [];
    try { h = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(h)) h = []; } catch (_) { h = []; }
    if (add && add.acc != null && !h.some((x) => x.id === add.id)) {
      h.push(add);
      h = h.slice(-30);
      try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (_) { /* private mode: this game only */ }
    }
    return h;
  },
  /** The finished review goes into the history once (also when it ran in the background). */
  _rvLogGame(pid) {
    const rv = this._rv?.review;
    if (!rv || rv.pid !== pid || !this.winner || !this._rvReviewComplete(pid)) return this._rvHistory();
    const sum = summarize(rv.results);
    return this._rvHistory(sum.acc != null ? { id: this._rv.id, acc: sum.acc, n: sum.n, at: Date.now(), eng: REVIEW_ENGINE, midCheck: !!rv.midCheck } : null);
  },
  /** The comparison with the bots: only over 5+ games (one game spreads about ±8, the bands only 4). */
  _rvCompare(hist) {
    // accuracies of one engine only, and only games nobody checked during play (v1.04: a check mid-game helps)
    const last = hist.filter((x) => (x.eng || "m100") === REVIEW_ENGINE && !x.midCheck).slice(-10).map((x) => x.acc);
    if (!BANDS.length) return { n: last.length, text: "" };
    if (last.length < 5) return { n: last.length, text: `Average vs the bots after 5 games (${last.length} of 5).` };
    const m = last.reduce((a, b) => a + b, 0) / last.length;
    const sd = Math.sqrt(last.reduce((a, b) => a + (b - m) ** 2, 0) / (last.length - 1));
    const se = sd / Math.sqrt(last.length);
    const near = BANDS.slice().sort((x, y) => Math.abs(x[1] - m) - Math.abs(y[1] - m))[0];
    const where = m < BANDS[0][1] - se ? `below the bots’ range` : m > BANDS[BANDS.length - 1][1] + se ? `above the ${BANDS[BANDS.length - 1][0]} bot` : `around ${near[0]}`;
    return { n: last.length, m, se, text: `Your last ${last.length} games: ${Math.round(m)} ± ${Math.max(1, Math.round(se))}, ${where}.` };
  },
  /** v1.04 the accuracy strip at the top: the number, a 70–100 bar with the bots' narrow band (a score
   *  outside is pinned to the end and says so), your 5+ game average on it, and "one game is a rough
   *  measure" once, small. */
  _rvStrip(acc, cmp, mid, prov = false) {
    const lo = 70, hi = 100, pc = (v) => Math.max(0, Math.min(100, (100 * (v - lo)) / (hi - lo)));
    // the bands are measured with the full engine: a provisional (quick) accuracy has none
    const B = BANDS.length && !(prov && !mid) ? [BANDS[0], BANDS[BANDS.length - 1]] : null;
    const out = acc != null && (acc < lo || acc > hi);
    const when = mid ? "so far" : prov ? "" : "this game";
    const bar = `<div class="rv-abar" aria-hidden="true">${B ? `<i class="b" style="left:${pc(B[0][1])}%;width:${pc(B[1][1]) - pc(B[0][1])}%"></i>` : ""}${cmp?.m != null ? `<i class="avg" style="left:${pc(cmp.m - cmp.se)}%;width:${Math.max(1, pc(cmp.m + cmp.se) - pc(cmp.m - cmp.se))}%"></i><i class="avgd" style="left:${pc(cmp.m)}%"></i>` : ""}${acc != null ? `<i class="me" style="left:${pc(acc)}%"></i>` : ""}</div>`;
    return `<div class="rv-astrip${prov ? " prov" : ""}" role="group" aria-label="Accuracy ${acc ?? "not available"} ${when || "provisional"}${B ? `, the bots ${Math.round(B[0][1])} to ${Math.round(B[1][1])}` : ""}">
      <b class="n">${acc ?? "–"}</b><div class="l"><span><b>accuracy</b> ${when}${prov && !mid ? `<em class="pv">provisional</em>` : ""}</span>${B ? `<span>bots ${Math.round(B[0][1])}–${Math.round(B[1][1])}</span>` : ""}</div>
      <div class="rv-arow"><small>${lo}</small>${bar}<small>${hi}</small>${out ? `<span class="o ${acc < lo ? "lo" : "hi"}">${acc < lo ? `&lt;${lo}` : `&gt;${hi}`}: ${acc}</span>` : ""}</div></div>`;
  },

  /** The running (or stopped) check as a card above the review: what is done, the time left from the pace so far, Stop. */
  _rvProgHtml(pid) {
    const R = this._rv, run = R.run, rv = R.review, mid = !!this._rvMid;
    if (run && run.pid === pid && run.round) {
      const r = run.round, n = Math.max(1, r.n), j = Math.min(r.j, n);
      const per = run.times.length >= 2 ? run.times.reduce((a, b) => a + b, 0) / run.times.length : (REVIEW_ENGINES[r.eng]?.sec || REVIEW.sec) * 1000;
      const left = Math.round((per * (r.n - j)) / 1000);
      const t = left >= 90 ? `${Math.round(left / 60)} min` : `${Math.max(1, left)} s`;
      const title = mid ? "Checking your moves" : r.eng === "m100" ? "Quick look" : "Deepening";
      return `<section class="rv-card rv-prog" role="status"><div class="pr"><b>${title}</b><small>${run.paused ? "paused" : `${j} of ${r.n}${j < r.n && (run.times.length >= 2 || j === 0) ? ` · ~${t}` : ""}`}</small><button type="button" class="rv-btn" data-rvstop>Stop</button></div>
        <div class="rv-pbar"><i style="width:${Math.round((100 * j) / n)}%"></i></div></section>`;
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
    const t = Date.now();
    if (!force && this._rvLastDraw && t - this._rvLastDraw < 1000) { if (!this._rvDrawT) this._rvDrawT = setTimeout(() => { this._rvDrawT = 0; this._rvLive(true); }, 1000); return; }
    clearTimeout(this._rvDrawT); this._rvDrawT = 0;
    this._rvLastDraw = t;
    this._rvDrawReview();
  },

  // ── the screen ──
  _rvOpenReview(pid, { mid = false } = {}) {
    if (!this._rvReviewable()) return;
    this._rvMid = mid;
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
    this._rvSelI = null;
    const live = () => { if (this._rvEl === el) this._rvLive(); };
    this._rvListener = live;
    if (this._rvReviewComplete(pid)) { this._rvDrawReview(); return; }
    this._rvDrawReview();
    this._rvReviewRun(pid, live, { mid }).then((rv) => { if (this._rvEl !== el) return; this._rvLive(true); if (rv?.done) this._rvRender(); });
  },
  _rvCloseReview(back = false) {
    // a check during the game stops here (what is checked is kept); after the game it goes on in the background
    if (this._rvMid && this._rv?.run) this._rvStop();
    clearTimeout(this._rvDrawT); this._rvDrawT = 0;
    this._rvListener = null;
    this._rvEl?.remove();
    this._rvEl = null;
    if (back && this._stOverlay) { this._stOverlay.hidden = false; this._rvRender(); }
  },
  _rvBindTop(el) {
    el.querySelector("[data-rvclose]")?.addEventListener("click", () => this._rvCloseReview(true));
    el.querySelector("[data-rvback-game]")?.addEventListener("click", () => this._rvCloseReview(true));
    el.querySelector("[data-rvinfo]")?.addEventListener("click", () => { this._rvInfoOpen = true; this._rvShowInfo(); });
    if (this._rvInfoOpen) this._rvShowInfo();
    el.querySelector("[data-rvstop]")?.addEventListener("click", () => { this._rvStop(); this._rvLive(true); });
    el.querySelector("[data-rvgo]")?.addEventListener("click", () => { const pid = this._rvPid, live = this._rvListener; this._rvReviewRun(pid, live, { mid: this._rvMid }).then((rv) => { if (this._rvEl !== el) return; this._rvLive(true); if (rv?.done) this._rvRender(); }); this._rvLive(true); });
  },
  /** All the caveats live here, behind the (i) in the header. */
  _rvShowInfo() {
    const el = this._rvEl;
    if (!el) return;
    el.querySelector(".rv-info")?.remove();
    const bands = BANDS.length ? ` (${BANDS.map(([n, v]) => `${n} ${Math.round(v)}`).join(", ")})` : "";
    const d = document.createElement("div");
    d.className = "rv-info";
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "About this review");
    d.innerHTML = `<div class="rv-card"><div class="rv-ih"><b>About this review</b><button type="button" class="rv-btn" data-rvinfo-x aria-label="Close">✕</button></div>
      <p><b>Accuracy</b> is how much win chance your moves kept against the best move the Master bot found (100 = always the best). The bar starts at 70; a lower score is pinned to the left edge and labelled.</p>
      <p><b>One game is a rough measure</b> (about ± 8). It doesn't decide a single game: luck and the table do.</p>
      <p><b>Luck</b> compares the cards your numbers gave with what was expected, and the robber on your tiles and its steals with the table average.</p>
      <p><b>The bots</b>: the band is how accurate the bots are on their own decisions with this same check${bands}. Your average over 5+ games is compared with it.</p>
      <p><b>A check during the game</b> keeps its moves for the review at the end, but that game stays out of your average.</p>
      <p><b>Provisional</b> is the quick look (about half a second a move). The deep check (about ${REVIEW.sec} s a move) follows, biggest differences first, and the numbers shift as it goes. The bot comparison appears once it is done.</p>
      <p><b>How it is checked</b>: the Master bot plays each of your moves, and the moves it would consider, into the same random futures.</p></div>`;
    const close = () => { this._rvInfoOpen = false; d.remove(); };
    d.addEventListener("click", (e) => { if (e.target === d) close(); });
    d.querySelector("[data-rvinfo-x]").addEventListener("click", close);
    el.appendChild(d);
  },
  _rvBar(sub) {
    return `<div class="rv-bar"><button type="button" class="rv-btn" data-rvclose aria-label="${this._rvMid ? "Back to the game" : "Back to results"}">‹</button><div><h3>Game review</h3><small>${sub}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>`;
  },
  _rvDrawReview(selI = null) {
    const el = this._rvEl, R = this._rv, rv = R.review, pid = this._rvPid;
    if (selI != null) this._rvSelI = selI; else selI = this._rvSelI;
    if (!el) return;
    if (!rv || !rv.results.length) { // nothing checked yet: the progress card alone
      el.innerHTML = `${this._rvBar(`${this.hotseat ? esc(this.players[pid].name) + "’s" : "Your"} moves${this._rvMid ? " so far" : ""}`)}
        <div class="rv-scroll">${this._rvProgHtml(pid) || `<section class="rv-card rv-prog" role="status"><b>Starting the check…</b></section>`}</div>`;
      this._rvBindTop(el);
      return;
    }
    const res = rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
    const sum = summarize(rv.results);
    const luck = this._rvLuck(pid);
    const marked = res.filter((x) => x.mark !== "good");
    const sel = res.find((x) => x.i === selI) || marked.slice().sort((a, b) => b.loss - a.loss)[0] || res[0];
    const turns = [...new Set(res.map((x) => x.t))];
    const worst = (t) => { const ms = res.filter((x) => x.t === t).map((x) => x.mark); return ms.includes("miss") ? "miss" : ms.includes("inacc") ? "inacc" : "good"; };
    // win-chance graph: after each decision (the played move's estimate)
    const pts = res.filter((x) => x.win != null);
    const W = 316, H = 128, T = Math.max(1, ...turns, this.turn);
    const X = (k) => 38 + (k / Math.max(1, pts.length - 1)) * (W - 46), Y = (p) => 8 + (1 - p) * (H - 30);
    const path = pts.map((x, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(x.win).toFixed(1)}`).join("");
    const area = pts.length ? `${path}L${X(pts.length - 1).toFixed(1)},${Y(0)}L${X(0)},${Y(0)}Z` : "";
    const marks = pts.map((x, k) => { const cx = X(k), cy = Y(x.win), m = x.mark;
      const shape = m === "good" ? `<circle cx="${cx}" cy="${cy}" r="3.2" class="g-good"/>` : m === "inacc" ? `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" transform="rotate(45 ${cx} ${cy})" class="g-inacc"/>` : `<path d="M${cx},${cy - 6} L${cx + 6},${cy + 4.5} L${cx - 6},${cy + 4.5}Z" class="g-miss"/>`;
      return (sel && x.i === sel.i ? `<line x1="${cx}" x2="${cx}" y1="6" y2="${Y(0)}" class="g-sel"/>` : "") + shape; }).join("");
    const grid = [0, 0.5, 1].map((p) => `<line x1="38" x2="${W - 8}" y1="${Y(p)}" y2="${Y(p)}" class="g-grid"/><text x="33" y="${Y(p) + 4}" text-anchor="end" class="g-ax">${p * 100}%</text>`).join("");
    const graph = `<svg class="rv-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your win chance after each move">${grid}<path d="${area}" class="g-area"/><path d="${path}" class="g-line"/>${marks}
      <text x="38" y="${H - 4}" class="g-ax">turn ${turns[0] ?? 1}</text><text x="${W - 8}" y="${H - 4}" text-anchor="end" class="g-ax">turn ${turns[turns.length - 1] ?? T}</text></svg>`;
    const strip = turns.map((t) => `<button type="button" data-rvturn="${t}" class="${sel && sel.t === t ? "on" : ""}" aria-label="Turn ${t}: ${MARK[worst(t)]}"><span>${t}</span>${mk(worst(t))}</button>`).join("");
    const sg = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`;
    const luckLine = luck ? `<p class="rv-luck"><b>Luck:</b> ${sg(Math.round(luck.dice * 100))} cards · robber ${luck.blocked} (avg ${Math.round(luck.blockedAvg)})${luck.stolen ? ` · stolen ${luck.stolen} (avg ${Math.round(luck.stolenAvg)})` : ""}</p>` : "";
    const mid = !!this._rvMid, prov = !this._rvReviewComplete(pid);
    const hist = !mid && !prov ? this._rvLogGame(pid) : this._rvHistory();
    const cmp = mid || prov ? { text: "" } : this._rvCompare(hist);
    const cmpText = mid ? "" : prov ? "" : rv.midCheck ? `Checked during the game · not in your average. ${cmp.text}` : cmp.text;
    const selHtml = sel ? (() => {
      const m = sel.mark, gain = sel.best ? Math.round(sel.best.gain * 100) : 0;
      const txt = m === "good" ? `${esc(sel.label)}: ${sel.trivial ? "every option here was about as good" : "as strong as anything the Master bot found"}.`
        : `${esc(sel.label)}. ${esc(sel.best.label)} was stronger.`;
      return `<section class="rv-card rv-sel"><div class="rv-meta">${mk(m)}Turn ${sel.t} · ${MARK[m]}${m !== "good" ? `<span>+${gain}% was possible</span>` : ""}</div><p class="rv-txt">${txt}</p>
        ${m !== "good" ? `<div class="rvs-vs"><div class="better"><span class="sx-win">A</span><small>Better</small><b>${esc(sel.best.label)}</b></div><div><span class="sx-win alt">B</span><small>${this.hotseat ? `${esc(this.players[pid].name)} did` : "You did"}</small><b>${esc(sel.label)}</b></div></div>` : ""}
        <div class="rv-row"><span class="rv-gain">Win chance after it: ${pct(sel.win)}</span>${mid ? "" : `<button type="button" class="rv-btn pri" data-rvshoweval="${sel.i}">${IC.eye}Show on board</button>`}</div></section>`;
    })() : "";
    const list = res.map((x) => `<button type="button" data-rvsel="${x.i}" class="${sel && x.i === sel.i ? "on" : ""}"><span class="t">Turn ${x.t}</span>${mk(x.mark)}<span class="x">${esc(x.label)}${x.mark !== "good" && x.best ? ` · ${esc(x.best.label)} was stronger` : ""}</span>${IC.chev}</button>`).join("");
    const scroll = el.querySelector(".rv-scroll")?.scrollTop || 0;
    el.innerHTML = `${this._rvBar(mid ? "Your moves so far" : `${res.length} moves · ${prov ? "provisional" : "checked by the Master bot"}`)}
      <div class="rv-scroll">
        ${this._rvProgHtml(pid)}
        ${mid ? `<section class="rv-card rv-midnote"><p><b>Up to turn ${rv.upto ?? this.turn}</b></p><button type="button" class="rv-btn pri" data-rvback-game>Back to the game</button></section>` : ""}
        <section class="rv-card">
          ${this._rvStrip(sum.acc, cmp, mid, prov)}
          <div class="rv-sum"><span><b>${mk("good")}${sum.count.good}</b>strong</span><span><b>${mk("inacc")}${sum.count.inacc}</b>could be sharper</span><span><b>${mk("miss")}${sum.count.miss}</b>missed chances</span></div>
          <div class="rv-gt"><b>Your win chance</b><small>after each move</small></div>${graph}
          <div class="rv-strip" role="tablist" aria-label="Your turns">${strip}</div>
        </section>
        <section class="rv-card rv-head"><p class="rv-accline"><b>${mid ? "So far" : "About this game"}</b> · ${sum.n} real choices</p>${luckLine}
          ${cmpText ? `<p class="rv-cmpline">${esc(cmpText)}${cmp.m != null ? ` <span class="rv-keyme">▮ this game</span> <span class="rv-keyavg">● your average</span>` : ""}</p>` : ""}</section>
        ${selHtml}
        <section class="rv-card"><div class="rv-gt"><b>All your moves</b><small>tap one to see it</small></div><div class="rv-list">${list}</div></section>
      </div>`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    el.querySelector(".rv-strip button.on")?.scrollIntoView?.({ block: "nearest", inline: "center" });
    this._rvBindTop(el);
    el.querySelectorAll("[data-rvturn]").forEach((b) => b.addEventListener("click", () => { const t = +b.dataset.rvturn; const xs = res.filter((x) => x.t === t); const pick = xs.slice().sort((a, b2) => (b2.loss || 0) - (a.loss || 0))[0]; this._rvDrawReview(pick?.i); }));
    el.querySelectorAll("[data-rvsel]").forEach((b) => b.addEventListener("click", () => this._rvDrawReview(+b.dataset.rvsel)));
    el.querySelector("[data-rvshoweval]")?.addEventListener("click", () => {
      const list2 = (marked.length ? marked : res).map((x) => (x.best ? this._rvEvalFinding(x, R.recs[x.i], R.res?.findings?.find((f) => f.pid === pid && f.i === x.i)) : null)).filter(Boolean);
      const k = Math.max(0, list2.findIndex((f) => f.i === sel.i));
      if (!list2.length) return;
      el.hidden = true;
      this._rvBackToReview = true;
      this._rvShowList(list2, k, pid);
    });
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
