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
import { summarize, REVIEW, REVIEW_ENGINE, REVIEW_ENGINES, ACC, clsOf, LIMITS, SETUP_LIMITS, CLASSES, GREAT, gpOf, decide, totals, tradeShow, needsFull } from "./review/evaluate.js";
import { reviewAvailable } from "./master.js";

// The bots' accuracy with the review engine in use (src/review/evaluate.js REVIEW_ENGINES), if measured.
export const BANDS = REVIEW.bands || [];
const mk = (m, cls = "") => `<i class="rv-mk mk-${m} ${cls}" aria-hidden="true"></i>`;
const pct = (x) => `${Math.round(x * 100)}%`;
const sgn = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`; // whole percent with a real minus sign
export const MC = "deep Monte Carlo (1000 futures)"; // what runs the check, named once
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
    const n = this._rv.recs.filter((r) => r.pid === p.id && ["setup", "build", "bank", "buy", "play", "robber", "end"].includes(r.k)).length;
    let x = "Game review", g = "";
    if (run?.pid === p.id && run.round) {
      const r = run.round, f = r.n ? r.j / r.n : 0;
      g = `<i class="rv-ring" style="--p:${Math.round(f * 100)}%" role="img" aria-label="${r.j} of ${r.n}"></i>${run.paused ? "paused" : `checking ${r.j}/${r.n}`}`;
    } else if (done) g = this._rvStale(p.id) ? "Re-check" : `accuracy ${sum?.acc ?? "–"}`;
    else if (sum) g = this._rvStale(p.id) ? "Re-check" : "provisional";
    else { x = "Review this game"; g = `≈${Math.max(1, Math.round((n * REVIEW.sec) / 60))} min`; }
    const mc = done && rv.midCheck ? `<small class="mc">checked during the game</small>` : ""; // v1.04: such a game stays out of the bot average
    return `<span class="t">${IC.review}</span><span class="x">${x}${mc}</span><span class="g">${g}</span>${IC.chev}`;
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
    const rv = this._rvOf(pid);
    if (!rv || !this.winner || !this._rvReviewComplete(pid)) return this._rvHistory();
    const sum = summarize(rv.results);
    const w = this.hotseat ? this.players[pid]?.name : undefined; // pass & play: one entry per person
    return this._rvHistory(sum.acc != null ? { id: w ? `${this._rv.id}:${pid}` : this._rv.id, ...(w ? { w } : {}), acc: sum.acc, n: sum.n, at: Date.now(), eng: REVIEW_ENGINE, midCheck: !!rv.midCheck, k: ACC.id } : null);
  },
  /** The comparison with the bots: only over 5+ games (one game spreads about ±8, the bands only 4). */
  _rvCompare(hist) {
    // accuracies of one engine only, and only games nobody checked during play (v1.04: a check mid-game helps)
    const last = hist.filter((x) => (!this.hotseat ? !x.w : x.w === this.players[this._rvPid]?.name) && (x.eng || "m100") === REVIEW_ENGINE && !x.midCheck && (x.k ?? "k0.08v1") === ACC.id).slice(-10).map((x) => x.acc);
    if (!BANDS.length) return { n: last.length, text: "" };
    if (last.length < 5) return { n: last.length, text: `Average vs the bots after 5 games (${last.length} of 5).` };
    const m = last.reduce((a, b) => a + b, 0) / last.length;
    const sd = Math.sqrt(last.reduce((a, b) => a + (b - m) ** 2, 0) / (last.length - 1));
    const se = sd / Math.sqrt(last.length);
    // "around X" only when the average overlaps one level's band alone; two or more: "between A and B" (bands are ± one SE)
    const sorted = BANDS.slice().sort((x, y) => x[1] - y[1]);
    const hit = sorted.filter(([, v, bs = 3]) => m + se >= v - bs && m - se <= v + bs);
    const where = hit.length === 1 ? `around ${hit[0][0]}` : hit.length > 1 ? `between ${hit[0][0]} and ${hit[hit.length - 1][0]}`
      : m < sorted[0][1] ? `below the bots’ range` : m > sorted[sorted.length - 1][1] ? `above the ${sorted[sorted.length - 1][0]} bot` : `between ${sorted.filter((b) => b[1] < m).pop()[0]} and ${sorted.find((b) => b[1] > m)[0]}`;
    return { n: last.length, m, se, text: `Your last ${last.length} games: ${Math.round(m)} ± ${Math.max(1, Math.round(se))}, ${where}.` };
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
    if (run && run.pid !== pid && !this._rvReviewComplete(pid) && this.hotseat) {
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
    const t = Date.now();
    if (!force && this._rvLastDraw && t - this._rvLastDraw < 1000) { if (!this._rvDrawT) this._rvDrawT = setTimeout(() => { this._rvDrawT = 0; this._rvLive(true); }, 1000); return; }
    clearTimeout(this._rvDrawT); this._rvDrawT = 0;
    this._rvLastDraw = t;
    this._rvLiveFlag = true;
    try { this._rvDrawReview(); } finally { this._rvLiveFlag = false; }
  },

  // ── the screen ──
  _rvOpenReview(pid, { mid = false } = {}) {
    if (!this._rvReviewable()) return;
    if (!this._rvGateOk(pid)) { this._hsGate?.(pid, "Your game review", () => this._rvOpenReview(pid, { mid })); return; } // pass & play: hand the phone over first
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
    this._rvStep = null;
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
    this._rvCloseBoard?.();
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
      <p><b>Win chance</b>: your chance to win, in %. It comes from ${MC}: the position is played on for 14 turns, 1000 times.</p>
      <p><b>A and B</b>: A is the best move, B is what you played. A − B is what that move cost. Classes: ${lim(LIMITS)}. Set-up spots use wider limits (${lim(SETUP_LIMITS)}).</p>
      <p><b>Play</b>: shows every move since your last decision: rolls, builds, trades, the robber. Win chances exist at your decisions only.</p>
      <p><b>Plan</b>: the likely reason A is better, read from the position. No clear reason, no Plan.</p>
      <p><b>Missed chance</b>: you ended the turn or traded while a build was worth 3+ %. <b>Great</b>: the best move, the next one ${GREAT}+ % behind. <b>No real choice</b>: every option within 2 %.</p>
      <p><b>Your moves</b> adds up what your moves cost. <b>Luck</b> is the rest: dice, robber and what the others did. Together they are your change in win chance since an even share (${ds0}%). Your moves never count more than your best win chance.</p>
      <p><b>Accuracy</b> runs 0–100; 100 is always the best move. It averages your real choices, so a few slips in a long game still score high. Big mistakes weigh more. One game spreads about ± 8. The line under it gives the plain number: % given away per choice.</p>
      <p><b>The bots</b>: scored on their own moves with this same check${bands}. Compare over 5+ games.</p>
      <p><b>A check during the game</b> keeps its moves for the review at the end, but that game stays out of your average. The board is shown after the game.</p>
      <p><b>Provisional</b> is the quick look (about half a second a move). The deep check (about ${REVIEW.sec} s a move) follows, biggest differences first, and the numbers shift as it goes.</p>${this.isRush?.() ? `
      <p><b>Approximate in Rush</b>: Rush has no turns, so each move you made is checked as if it were your turn in a Classic game: the same position, then the table plays on turn by turn with one dice roll per turn. A roll in the list is the roll interval you moved in. “Wait” means building nothing right then. Not modelled: the clock, several players moving within one interval, and a spot lost to a faster bot. In a test of 17 positions the Rush-shaped and the turn-by-turn futures ranked the moves no differently than two runs of the same method do, but treat the numbers as a guide, not a verdict. Turn starts and End turn do not exist here, so they are not checked.</p>` : ""}${this.players.length >= 5 ? `
      <p><b>5–6 players</b>: moves in the build window between turns are not checked (it is nobody's turn there). The check looks 14 turns ahead, which is ${(14 / this.players.length).toFixed(1)} rounds at this table (3.5 with four players), and with more players fewer futures fit in the time.</p>` : ""}</div>`;
    const close = () => { this._rvInfoOpen = false; d.remove(); };
    d.addEventListener("click", (e) => { if (e.target === d) close(); });
    d.querySelector("[data-rvinfo-x]").addEventListener("click", close);
    el.appendChild(d);
  },
  _rvBar(sub) {
    return `<div class="rv-bar"><button type="button" class="rv-btn" data-rvclose aria-label="${this._rvMid ? "Back to the game" : "Back to results"}">‹</button><div><h3>Game review${this.hotseat && this._rvPid != null ? ` · <span class="pc-${this._rvPid} rv-who">${esc(this.players[this._rvPid].name)}</span>` : ""}</h3><small>${sub}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div>${this._rvForSeg()}`;
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
  _rvGateOk(pid) { return !this.hotseat || pid === this.viewerId; },

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
    const x = d.x, who = this.hotseat ? esc(this.players[this._rvPid].name) : "You", lc = (t) => t.charAt(0).toLowerCase() + t.slice(1), gain = `+${d.gp}%`;
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
    if (d.chance >= 0) return best ? `${best.roll} rolled · +${cards} ${cards === 1 ? "card" : "cards"}` : "The others' moves";
    if (robbed) return `Robbed · ${robbed} stolen`;
    return cards ? `Others pulled ahead · +${cards} for you` : shift ? "A 7 and no cards" : "No cards from your numbers";
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
    return `<svg class="rs-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Win chance of every player after each of your decisions; bars: luck and your moves">${grid}${others}<path d="${line((d) => d.win)} L${X(n - 1)},${Y(0)} L${X(0)},${Y(0)}Z" class="g-area"/><path d="${line((d) => d.win)}" class="g-line"/>${barSvg}${dots}${curL}${hit}${axis ? `<text x="${X0}" y="${h - 1}" class="g-ax">${lab(ds[0])}</text><text x="${X1}" y="${h - 1}" text-anchor="end" class="g-ax">${lab(ds[n - 1])}</text>` : ""}</svg>`;
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
      el.innerHTML = `${this._rvBar(`${this.hotseat ? esc(this.players[pid].name) + "’s" : "Your"} moves${this._rvMid ? " so far" : ""}`)}
        <div class="rv-scroll">${this._rvProgHtml(pid) || `<section class="rv-card rv-prog" role="status"><b>Starting the check…</b></section>`}</div>`;
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
  _rvOverview(ds, res, rv) {
    const el = this._rvEl, pid = this._rvPid, sum = summarize(rv.results);
    const mid = !!this._rvMid, prov = !this._rvReviewComplete(pid);
    const hist = !mid && !prov ? this._rvLogGame(pid) : this._rvHistory();
    const cmp = mid || prov ? { text: "" } : this._rvCompare(hist);
    const cmpText = mid ? "" : prov ? "" : rv.midCheck ? `Checked during the game · not in your average. ${cmp.text}` : cmp.text;
    const T = this._rvTotals(ds), luck = this._rvLuck(pid);
    const sg = (v) => sgn(v * 100); // v: a fraction of win chance (gp / 100): whole percent, real minus sign
    const chips = CLASSES.map((c) => `<span class="rs-cnt${sum.cls[c] ? "" : " zero"}">${badge(c, "sm")}<b>${sum.cls[c]}</b><small>${c === "missed" ? "Missed" : CLS[c][0]}</small></span>`).join("");
    const ico = IC.next.replace("<svg", '<svg class="chev"');
    const imp = this._rvImp(ds);
    const better = imp.slice(0, 5).map((d) => `<button type="button" class="rs-key rs-imp" data-rvj="${d.i}" data-rvq="imp">${badge(d.cls)}<span class="t">${this._rvWhen(d)}</span><span class="x">${esc(this._rvTerse(d))}${d.x.why?.head ? `<small class="w">${esc(d.x.why.head)}</small>` : ""}</span><b class="neg">${sg(-d.gap)}%</b>${ico}</button>`).join("");
    const lk = ds.slice().sort((a, b) => Math.abs(b.cp) - Math.abs(a.cp))[0];
    const key = (lk && Math.abs(lk.cp) >= 3 ? `<button type="button" class="rs-key" data-rvj="${lk.i}"><i class="rs-b c-luck sm" aria-hidden="true">⚄</i><span class="t">${this._rvWhen(lk)}</span><span class="x">${esc(this._rvCause(ds, ds.indexOf(lk)))}</span><b class="${lk.cp >= 0 ? "pos" : "neg"}">${sg(lk.chance)}%</b>${ico}</button>` : "");
    const groups = [];
    ds.forEach((d) => { const key2 = d.k === "setup" ? "Setup" : `${this._rvTW()} ${d.t}`; let g = groups[groups.length - 1]; if (!g || g.key !== key2) groups.push((g = { key: key2, items: [] })); g.items.push(d); });
    const rows = groups.map((g) => `<div class="rs-trow"><span class="t">${g.key === "Setup" ? "Setup" : g.key.replace(/^(Turn|Roll) /, this.isRush() ? "R" : "T")}</span><div>${g.items.map((d) => `<button type="button" class="rs-mv c-${d.cls}" data-rvj="${d.i}" data-rvq="all"${d.cls === "triv" ? ' aria-label="No real choice"' : ""}>${badge(d.cls, "sm")}<span>${esc(this._rvShort(d))}</span>${d.gap >= 0.01 ? `<small>${sg(-d.gap)}</small>` : ""}</button>`).join("")}</div></div>`).join("");
    const first = imp.length ? imp[0].i : ds[0]?.i;
    const scroll = el.querySelector(".rv-scroll")?.scrollTop || 0;
    el.className = "rv rs tm";
    el.innerHTML = `${this._rvBar(mid ? "Your moves so far" : `${ds.length} decisions · ${prov ? "provisional" : "deep Monte Carlo"}`)}
      <div class="rv-scroll">
        ${this._rvProgHtml(pid)}
        ${mid ? `<section class="rv-card rv-midnote"><p><b>Up to turn ${rv.upto ?? this.turn}</b></p><button type="button" class="rv-btn pri" data-rvback-game>Back to the game</button></section>` : ""}
        <section class="rv-card rs-sum">
          ${this._rvStrip(sum.acc, cmp, mid, prov)}
          <div class="rs-sl"><div><small>Your moves</small><b class="${T.moves < 0 ? "neg" : ""}">${sgn(T.moves)}%</b></div><div><small>Luck</small><b class="${T.luck >= 0 ? "pos" : "neg"}">${sgn(T.luck)}%</b></div></div>
          ${sum.lost != null ? `<p class="rs-lost">${sum.n} real choices · on average ${sum.lost}% win chance given away per choice${T.capped ? ` · your moves are capped at the ${T.cap}% you could have had` : ""}</p>` : ""}
          <div class="rs-cnts">${chips}</div>
          ${cmpText ? `<p class="rv-cmpline">${esc(cmpText)}${cmp.m != null ? ` <span class="rv-keyme">▮ this game</span> <span class="rv-keyavg">● your average</span>` : ""}</p>` : ""}
        </section>
        ${better ? `<section class="rv-card rs-keys rs-better"><div class="rv-gt"><b>Could be better</b><small>${imp.length} to look at</small></div>${better}</section>` : ""}
        ${ds.length ? `<button type="button" class="rv-btn pri rs-go" data-rvj="${first}" data-rvq="${imp.length ? "imp" : "all"}" data-rvfirst>${IC.step}Step through your moves</button>` : ""}
        ${ds.length ? `<section class="rv-card"><div class="rv-gt"><b>Win chance</b><small>you thick · bars: luck <i class="kl"></i> your moves <i class="ks"></i></small></div>${this._rvChart(ds)}</section>` : ""}
        ${key ? `<section class="rv-card rs-keys"><div class="rv-gt"><b>Biggest swing in your luck</b></div>${key}</section>` : ""}
        <section class="rv-card"><div class="rv-gt"><b>All your moves</b><small>tap to step</small></div>${rows}</section>
        ${luck ? `<section class="rv-card rs-luckd"><div class="rv-gt"><b>Dice and robber</b></div><p>${luck.got} cards from your numbers, ${luck.exp} expected (${sg(luck.dice)}%) · robber blocked ${luck.blocked} (table ${Math.round(luck.blockedAvg)})${luck.stolen ? ` · stolen ${luck.stolen} (table ${Math.round(luck.stolenAvg)})` : ""}</p></section>` : ""}
      </div>`;
    el.querySelector(".rv-scroll").scrollTop = scroll;
    this._rvBindTop(el);
    el.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = b.dataset.rvq || "all"; this._rvDrawReview(+b.dataset.rvj); }));
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
    const who = this.hotseat ? esc(this.players[me].name) : "You";
    const groups = [];
    ds.forEach((q) => { const key = q.k === "setup" ? "Setup" : `${this._rvTW()} ${q.t}`; let g = groups[groups.length - 1]; if (!g || g.key !== key) groups.push((g = { key, items: [] })); g.items.push(q); });
    const strip = groups.map((g) => `<div class="rs-g"><small>${g.key}</small><div>${g.items.map((q) => `<button type="button" data-rvj="${q.i}" class="rs-chip${q.i === d.i ? " on" : ""}" aria-label="${g.key}: ${CLS[q.cls][0]}">${q.cls === "triv" ? '<i class="rs-dot" title="No real choice"></i>' : badge(q.cls, "sm")}</button>`).join("")}</div></div>`).join("");
    const sameBoard = el.classList.contains("step") && this._rvBoardKey === `${d.i}|${show}` && el.querySelector(".rs-board canvas");
    const scrub = el.querySelector(".rs-strip")?.scrollLeft || 0;
    const prov = !this._rvReviewComplete(this._rvPid);
    const A = noA ? "" : `<div class="a${show === "B" ? " dim" : ""}" data-rvab="A"><s>A</s><small>Better</small><b>${esc(tradeShow(x.best.label))}</b><i>${d.A}%</i></div>`;
    const B = `<div class="b${show === "A" && !noA ? " dim" : ""}" data-rvab="B"><s class="alt">B</s><small>${this.hotseat ? `${esc(this.players[me].name)} did` : "You did"}</small><b>${esc(tradeShow(x.label))}</b><i>${d.B}%</i></div>`;
    const cardHtml = `<div class="rs-h">${badge(d.cls, "lg")}<b>${CLS[d.cls][0]}</b><span>${this._rvKind(d)}</span><em class="${d.gp ? "neg" : "pos"}">${d.gp ? sg(-d.gap) : "±0"}</em></div>
        <p class="rs-s">${this._rvLine(d)}</p>
        ${noA ? "" : whyHtml(x.why)}
        <div class="rs-ab${noA ? " one" : ""}">${A}${B}</div>
        <div class="rs-lk"><span>${d === ds[0] ? "From an even share" : "Since your last move"}</span><b class="${d.cp >= 0 ? "pos" : "neg"}">Luck ${sg(d.chance)}</b><b class="${d.gp ? "neg" : "pos"}">Your move ${d.gp ? sg(-d.gap) : "±0"}</b></div>
        <div class="rs-strip" role="tablist" aria-label="Your decisions">${strip}</div>
        <div class="rs-nav"><button type="button" class="rv-btn" data-rvnav="-1" ${k ? "" : "disabled"} aria-label="Previous decision">${IC.prev}Previous</button><button type="button" class="rv-btn pri" data-rvnav="1" ${k < list.length - 1 ? "" : "disabled"} aria-label="Next decision">Next${IC.next}</button></div>`;
    const evalHtml = `<b>${pct(shown[me] / (shown.reduce((a, c) => a + c, 0) || 1))}</b>${this._rvStack(shown)}`;
    const wcHtml = this._rvLegend(shown);
    const bindCard = (root) => {
      root.querySelectorAll("[data-rvj]").forEach((b) => b.addEventListener("click", () => { this._rvQ = "all"; this._rvDrawReview(+b.dataset.rvj); }));
      root.querySelectorAll("[data-rvwhy]").forEach((b) => b.addEventListener("click", () => { this._rvInfoOpen = true; this._rvShowInfo(); }));
      root.querySelectorAll("[data-rvnav]").forEach((b) => b.addEventListener("click", () => { const n = list[k + +b.dataset.rvnav]; if (n) this._rvDrawReview(n.i); }));
      root.querySelectorAll("[data-rvab]").forEach((b) => b.addEventListener("click", () => { const v = b.dataset.rvab; this._rvAB = v === this._rvAB && v !== "both" ? "both" : v; this._rvDrawReview(); }));
    };
    if (this._rvLiveFlag && sameBoard) { // a running check refreshed a number: the board stays as it is
      el.querySelector(".rs-card").innerHTML = cardHtml; el.querySelector(".rs-eval").innerHTML = evalHtml; const wcEl = el.querySelector(".rs-wc"); if (wcEl) wcEl.innerHTML = wcHtml;
      const pr = el.querySelector(".rv-prog"), nh = this._rvProgHtml(this._rvPid);
      if (pr || nh) { const tmp = document.createElement("div"); tmp.innerHTML = nh; if (pr && tmp.firstElementChild) pr.replaceWith(tmp.firstElementChild); else if (pr) pr.remove(); else if (tmp.firstElementChild) el.querySelector(".rs-stage").before(tmp.firstElementChild); this._rvBindProg(el); }
      bindCard(el.querySelector(".rs-card")); el.querySelector(".rs-strip .on")?.scrollIntoView?.({ inline: "center", block: "nearest" });
      return;
    }
    el.className = `rv rs step tm${mid ? " noboard" : ""}${x.why && !noA ? " hw" : ""}`; el.dataset.show = show;
    el.innerHTML = `<div class="rv-bar rs-bar"><button type="button" class="rv-btn" data-rvclose-step aria-label="Back to the overview">${IC.back}</button><div><h3>${this._rvWhen(d)}</h3><small>${k + 1} of ${list.length}${this._rvQ === "imp" ? " · could be better" : ""}${prov ? " · provisional" : ""}</small></div><button type="button" class="rv-btn pri rs-ov" data-rvclose-step>Overview</button><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review">${IC.info}</button></div>
      ${this._rvProgHtml(this._rvPid)}
      <div class="rs-stage"><div class="rs-eval">${evalHtml}</div>
        ${mid ? "" : `<div class="rs-board"><canvas></canvas><svg class="rs-marks" aria-hidden="true"></svg><div class="rs-wc" aria-hidden="true">${wcHtml}</div><button type="button" class="rs-pbp" data-rvpbp aria-label="Play by play: every move since your last decision">${IC.step}<span>Play</span></button>${noA ? "" : `<div class="rs-tog" role="group" aria-label="Show on the board"><button type="button" data-rvab="A" class="${show === "A" ? "on" : ""}" aria-label="Better move"><s>A</s></button><button type="button" data-rvab="both" class="${show === "both" ? "on" : ""}">A + B</button><button type="button" data-rvab="B" class="${show === "B" ? "on" : ""}" aria-label="What you did"><s class="alt">B</s></button></div>`}</div>`}</div>
      <div class="rs-card">${cardHtml}</div>`;
    const sc = el.querySelector(".rs-strip"); if (sc) { sc.scrollLeft = scrub; el.querySelector(".rs-chip.on")?.scrollIntoView?.({ inline: "center", block: "nearest" }); }
    this._rvBindTop(el);
    el.querySelectorAll("[data-rvclose-step]").forEach((b) => b.addEventListener("click", () => { this._rvStep = null; this._rvDrawReview(); }));
    bindCard(el);
    el.querySelector("[data-rvpbp]")?.addEventListener("click", () => this._rvPbpOpen(d, ds));
    let x0 = null;
    [el.querySelector(".rs-stage"), el.querySelector(".rs-card")].forEach((n) => { if (!n) return; n.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true }); n.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; const nx = list[k + (dx < 0 ? 1 : -1)]; if (!this._rvPbp && Math.abs(dx) > 50 && nx) this._rvDrawReview(nx.i); }, { passive: true }); });
    if (!mid) this._rvBoard(d, show);
    if (this._rvPbp && !mid) this._rvPbpGo(d, ds, this._rvPbp.j); // back from A/B toggle etc. while playing by play
  },
  /** Named win chances for the board corner: you first, then the others by chance, one short line each. */
  _rvLegend(seats) {
    const me = this._rvPid, sum = seats.reduce((a, b) => a + b, 0) || 1;
    const order = [me, ...this.players.map((p) => p.id).filter((q) => q !== me).sort((a, b) => seats[b] - seats[a])];
    return order.map((q) => `<span class="pc-${q}${q === me ? " me" : ""}"><i></i>${q === me && !this.hotseat ? "You" : esc(this.players[q].name)}<b>${Math.round((seats[q] / sum) * 100)}%</b></span>`).join("");
  },
  _rvPName(pid) { const p = this.players[pid]; return !p ? "Someone" : p.isHuman && !this.hotseat ? "You" : esc(p.name); },
  /** Every move between your previous decision and this one, as beats: a roll (with who got what), a build, a trade, the robber, a steal, a card. */
  _rvBeats(d, ds) {
    const st = this._st, ev = this.stats.ev, k = ds.indexOf(d), from = k ? ds[k - 1].x.e : 0, to = d.x.e;
    const s0 = k ? ds[k - 1].x.s : 0, RN = ["Lumber", "Brick", "Wool", "Grain", "Ore"], me = this._rvPid;
    const beats = [], nm = (q) => this._rvPName(q);
    const roll = (s, cursor) => {
      const step = st.steps[s - 1]; if (!step) return;
      const got = new Map();
      (st.stepEvents[s] || []).forEach((e) => { const g = st.evIx.get(e); if (e[1] === "P" && g >= from && g < to) { const o = got.get(e[2]) || { n: 0, r: {} }; o.n += e[5] || 1; o.r[e[4]] = (o.r[e[4]] || 0) + (e[5] || 1); got.set(e[2], o); } });
      const sum = step[2] + step[3];
      const parts = [...got].sort((a, b) => (a[0] === me ? -1 : b[0] === me ? 1 : 0)).map(([q, o]) => (q === me ? `${nm(q)} +${Object.entries(o.r).map(([r, n]) => `${n} ${RN[r]}`).join(" +")}` : `${nm(q)} +${o.n} ${o.n === 1 ? "card" : "cards"}`));
      beats.push({ s, upto: cursor, who: step[1], chip: String(sum), head: `${nm(step[1])} rolled ${sum}`, sub: sum === 7 ? "The robber moves and big hands are halved." : parts.length ? parts.join(" · ") : "Nobody got cards.", sev: sum === 7 });
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
      else if (c === "t") beats.push({ ...obj, chip: "steal", head: `${nmA} stole a card`, sub: `From ${nm(b)}.` });
      else if (c === "x") beats.push({ ...obj, chip: "trade", head: `${nmA} traded with ${nm(b)}`, sub: `${x} for ${y} cards.` });
      else if (c === "k") beats.push({ ...obj, chip: "bank", head: `${nmA} traded with the bank`, sub: `Gave ${x} ${RN[b]} for 1 ${RN[y]}.` });
      else if (c === "d") beats.push({ ...obj, chip: "7", head: `${nmA} handed back ${b} cards` });
      else if (c === "v") beats.push({ ...obj, chip: "card", head: `${nmA} bought a development card` });
      else if (c === "y") beats.push({ ...obj, chip: "card", head: `${nmA} played a development card` });
    }
    while (last < d.x.s && last < st.N) { last += 1; roll(last, to); }
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
      <div class="rs-nav pb-nav"><button type="button" class="rv-btn" data-rvbeatnav="-1" ${j ? "" : "disabled"} aria-label="Previous move">${IC.prev}</button><button type="button" class="rv-btn pri" data-rvbeatnav="1" ${j < n - 1 ? "" : "disabled"} aria-label="Next move">Next${IC.next}</button><button type="button" class="rv-btn" data-rvpbpx>Your decision</button></div>`;
    card.querySelectorAll("[data-rvbeat]").forEach((x) => x.addEventListener("click", () => this._rvPbpGo(d, ds, +x.dataset.rvbeat)));
    card.querySelectorAll("[data-rvbeatnav]").forEach((x) => x.addEventListener("click", () => this._rvPbpGo(d, ds, j + +x.dataset.rvbeatnav)));
    card.querySelector("[data-rvpbpx]").addEventListener("click", () => { this._rvPbp = null; this._rvDrawReview(); });
    card.querySelector(".rs-strip .on")?.scrollIntoView?.({ inline: "center", block: "nearest" });
    el.classList.add("pbp");
    // the board at the moment after this move; a ring on what was just built or moved
    this._rpSeek(b.s, b.upto);
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
