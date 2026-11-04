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
import { summarize, REVIEW, REVIEW_ENGINE } from "./review/evaluate.js";

// The bots' accuracy with the review engine in use (src/review/evaluate.js REVIEW_ENGINES), if measured.
export const BANDS = REVIEW.bands || [];
const MARK = { good: "Strong", inacc: "Could be sharper", miss: "Missed chance" };
const mk = (m, cls = "") => `<i class="rv-mk mk-${m} ${cls}" aria-hidden="true"></i>`;
const pct = (x) => `${Math.round(x * 100)}%`;

export const ReviewGameMixin = {
  /** The review is offered for a Classic game of up to 4 players (what the Master's search covers). */
  _rvReviewable() { return !!this._rv?.recs?.length && this._rvCovered() && this.players.length <= 4; },

  _rvReviewRowHtml(p) {
    if (!this._rvReviewable()) return "";
    const rv = this._rv.review;
    const sum = rv?.pid === p.id && rv.done ? summarize(rv.results) : null;
    const n = this._rv.recs.filter((r) => r.pid === p.id && ["setup", "build", "bank", "buy", "play", "robber", "end"].includes(r.k)).length;
    return `<button type="button" class="rvb" data-rvreview="${p.id}"><span class="t">${IC.review}</span><span class="x">${sum ? `Game review · accuracy ${sum.acc ?? "–"}` : "Full game review"}</span><span class="g">${sum ? "" : `≈${Math.max(1, Math.round((n * REVIEW.sec) / 60))} min`}</span>${IC.chev}</button>`;
  },
  _rvBindReview(box) {
    box.querySelectorAll("[data-rvreview]").forEach((b) => b.addEventListener("click", () => this._rvOpenReview(+b.dataset.rvreview)));
  },

  /** Missed chances once the Master has checked the game: its own misses, biggest first (a detector line
   *  stays when the Master agrees with it; the gain is then in win chance). */
  _rvVerified(pid) {
    const rv = this._rv?.review;
    if (!rv || rv.pid !== pid || !rv.done) return null;
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
  /** The comparison with the bots: only over 5+ games (one game spreads about ±8, the bands only 4). */
  _rvCompare(hist) {
    const last = hist.filter((x) => (x.eng || "m100") === REVIEW_ENGINE).slice(-10).map((x) => x.acc); // accuracies of one engine only
    if (!BANDS.length) return { n: last.length, text: "" };
    if (last.length < 5) return { n: last.length, text: `Play a few more games to compare with the bots (${last.length} of 5 reviewed).` };
    const m = last.reduce((a, b) => a + b, 0) / last.length;
    const sd = Math.sqrt(last.reduce((a, b) => a + (b - m) ** 2, 0) / (last.length - 1));
    const se = sd / Math.sqrt(last.length);
    const near = BANDS.slice().sort((x, y) => Math.abs(x[1] - m) - Math.abs(y[1] - m))[0];
    const where = m < BANDS[0][1] - se ? `below the bots’ range` : m > BANDS[BANDS.length - 1][1] + se ? `above the ${BANDS[BANDS.length - 1][0]} bot` : `around ${near[0]}`;
    return { n: last.length, m, se, text: `Your last ${last.length} games: ${Math.round(m)} ± ${Math.max(1, Math.round(se))}, ${where}.` };
  },
  /** A small scale 70–100 with the bots' narrow band, this game (dot) and your average (bar), if any. */
  _rvScale(acc, cmp) {
    if (!BANDS.length) return "";
    // the axis runs 70–100 between its end labels; a score outside is pinned to the end and says so (<70)
    const W = 300, lo = 70, hi = 100, x0 = 30, x1 = W - 34, X = (v) => x0 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (x1 - x0);
    const b0 = X(BANDS[0][1]), b1 = X(BANDS[BANDS.length - 1][1]);
    const band = `<rect x="${b0}" y="15" width="${Math.max(2, b1 - b0)}" height="10" rx="3" class="s-band"/>`
      + `<text x="${(b0 + b1) / 2}" y="9" text-anchor="middle" class="s-lab">bots: ${BANDS[0][0]} ${Math.round(BANDS[0][1])} … ${BANDS[BANDS.length - 1][0]} ${Math.round(BANDS[BANDS.length - 1][1])}</text>`;
    const avg = cmp?.m != null ? `<line x1="${X(cmp.m - cmp.se)}" x2="${X(cmp.m + cmp.se)}" y1="20" y2="20" class="s-avg"/><circle cx="${X(cmp.m)}" cy="20" r="4" class="s-avgd"/>` : "";
    const out = acc != null && (acc < lo || acc > hi);
    const me = acc != null ? `<path d="M${X(acc)},31 l-5,8 h10z" class="s-me"/>${out ? `<text x="${X(acc) + (acc < lo ? 8 : -8)}" y="40" text-anchor="${acc < lo ? "start" : "end"}" class="s-lab s-out">${acc < lo ? `<${lo}` : `>${hi}`}: ${acc}</text>` : ""}` : "";
    return `<svg class="rv-scale" viewBox="0 0 ${W} 46" role="img" aria-label="Accuracy scale 70 to 100: the bots ${Math.round(BANDS[0][1])}–${Math.round(BANDS[BANDS.length - 1][1])}${acc != null ? `, this game ${acc}` : ""}">
      <text x="${x0 - 6}" y="24" text-anchor="end" class="s-lab">${lo}</text><line x1="${x0}" x2="${x1}" y1="20" y2="20" class="s-axis"/><text x="${x1 + 6}" y="24" class="s-lab">${hi}</text>
      ${band}${avg}${me}</svg>`;
  },

  // ── the screen ──
  _rvOpenReview(pid) {
    if (!this._rvReviewable()) return;
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
    const rv0 = this._rv.review;
    if (rv0?.pid === pid && rv0.done) { this._rvDrawReview(); return; }
    const draw = (rv, j, n) => { if (this._rvEl === el) this._rvDrawProgress(j, n); };
    draw(null, rv0?.pid === pid ? rv0.results.length : 0, this._rv.recs.filter((r) => r.pid === pid).length);
    this._rvReviewRun(pid, draw).then((rv) => { if (this._rvEl !== el) return; if (rv?.done) { this._rvDrawReview(); this._rvRender(); } });
  },
  _rvCloseReview(back = false) {
    if (this._rv?.review && !this._rv.review.done) this._rv.review.cancelled = true;
    this._rvEl?.remove();
    this._rvEl = null;
    if (back && this._stOverlay) { this._stOverlay.hidden = false; this._rvRender(); }
  },
  _rvBar(sub) {
    return `<div class="rv-bar"><button type="button" class="rv-btn" data-rvclose aria-label="Back to results">‹</button><div><h3>Game review</h3><small>${sub}</small></div></div>`;
  },
  _rvDrawProgress(j, n) {
    const el = this._rvEl, rv = this._rv.review;
    const total = rv?.total || n || 1;
    el.innerHTML = `${this._rvBar(`${this.hotseat ? esc(this.players[this._rvPid].name) + "’s" : "Your"} moves · checked by the Master bot`)}
      <div class="rv-scroll"><section class="rv-card rv-prog" role="status"><b>Checking your moves…</b>
        <p>The Master bot plays each of your moves, and the moves it would consider, into the same random futures: about ${REVIEW.sec} s a move. You can leave this screen: what is done is kept.</p>
        <div class="rv-pbar"><i style="width:${Math.round((100 * Math.min(j, total)) / total)}%"></i></div>
        <small>${Math.min(j, total)} of ${total}${(() => { const ms = (rv?.results || []).map((x) => x.ms || 0).filter((x) => x > 0); if (ms.length < 2) return ""; const left = Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * (total - j) / 1000); return left > 0 ? ` · about ${left >= 90 ? `${Math.round(left / 60)} min` : `${left} s`} left` : ""; })()}</small>
        <button type="button" class="rv-btn" data-rvstop>Stop</button></section></div>`;
    el.querySelector("[data-rvclose]").addEventListener("click", () => this._rvCloseReview(true));
    el.querySelector("[data-rvstop]").addEventListener("click", () => this._rvCloseReview(true));
  },

  _rvDrawReview(selI = null) {
    const el = this._rvEl, R = this._rv, rv = R.review, pid = this._rvPid;
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
    const luckLine = luck ? `<p class="rv-luck"><b>Luck:</b> ${luck.got} cards from your numbers, ${luck.exp} expected${Math.abs(luck.dice) >= 0.05 ? ` (${luck.dice > 0 ? "+" : "−"}${Math.round(Math.abs(luck.dice) * 100)}%)` : ""}. The robber blocked ${luck.blocked} of your cards (table average ${Math.round(luck.blockedAvg)})${luck.stolen ? `, ${luck.stolen} stolen (average ${Math.round(luck.stolenAvg)})` : ""}.</p>` : "";
    const hist = this._rvHistory(sum.acc != null ? { id: R.id, acc: sum.acc, n: sum.n, at: Date.now(), eng: REVIEW_ENGINE } : null);
    const cmp = this._rvCompare(hist);
    const selHtml = sel ? (() => {
      const m = sel.mark, gain = sel.best ? Math.round(sel.best.gain * 100) : 0;
      const txt = m === "good" ? `${esc(sel.label)}: ${sel.trivial ? "every option here was about as good" : "as strong as anything the Master bot found"}.`
        : `${esc(sel.label)}. ${esc(sel.best.label)} was stronger.`;
      return `<section class="rv-card rv-sel"><div class="rv-meta">${mk(m)}Turn ${sel.t} · ${MARK[m]}${m !== "good" ? `<span>+${gain}% was possible</span>` : ""}</div><p class="rv-txt">${txt}</p>
        ${m !== "good" ? `<div class="rvs-vs"><div class="better"><span class="sx-win">A</span><small>Better</small><b>${esc(sel.best.label)}</b></div><div><span class="sx-win alt">B</span><small>${this.hotseat ? `${esc(this.players[pid].name)} did` : "You did"}</small><b>${esc(sel.label)}</b></div></div>` : ""}
        <div class="rv-row"><span class="rv-gain">Win chance after it: ${pct(sel.win)}</span><button type="button" class="rv-btn pri" data-rvshoweval="${sel.i}">${IC.eye}Show on board</button></div></section>`;
    })() : "";
    const list = res.map((x) => `<button type="button" data-rvsel="${x.i}" class="${sel && x.i === sel.i ? "on" : ""}"><span class="t">Turn ${x.t}</span>${mk(x.mark)}<span class="x">${esc(x.label)}${x.mark !== "good" && x.best ? ` · ${esc(x.best.label)} was stronger` : ""}</span>${IC.chev}</button>`).join("");
    const scroll = el.querySelector(".rv-scroll")?.scrollTop || 0;
    el.innerHTML = `${this._rvBar(`${res.length} moves · checked by the Master bot`)}
      <div class="rv-scroll">
        <section class="rv-card">
          <div class="rv-sum"><span><b>${mk("good")}${sum.count.good}</b>strong</span><span><b>${mk("inacc")}${sum.count.inacc}</b>could be sharper</span><span><b>${mk("miss")}${sum.count.miss}</b>missed chances</span></div>
          <div class="rv-gt"><b>Your win chance</b><small>after each move</small></div>${graph}
          <div class="rv-strip" role="tablist" aria-label="Your turns">${strip}</div>
        </section>
        <section class="rv-card rv-head"><p class="rv-accline"><b>Accuracy ${sum.acc ?? "–"}</b> this game · ${sum.n} real choices · one game is a rough measure (about ± 8)</p>${luckLine}
          ${this._rvScale(sum.acc, cmp)}${cmp.text ? `<p class="rv-cmpline">${esc(cmp.text)} <span class="rv-keyme">▲ this game</span>${cmp.m != null ? ` <span class="rv-keyavg">● your average</span>` : ""}</p>` : ""}
          <p class="rv-note">Accuracy: how much win chance your moves kept against the best move the Master bot found (100 = always the best). It doesn't decide a single game: luck and the table do.</p></section>
        ${selHtml}
        <section class="rv-card"><div class="rv-gt"><b>All your moves</b><small>tap one to see it</small></div><div class="rv-list">${list}</div></section>
      </div>`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    el.querySelector(".rv-strip button.on")?.scrollIntoView?.({ block: "nearest", inline: "center" });
    el.querySelector("[data-rvclose]").addEventListener("click", () => this._rvCloseReview(true));
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
