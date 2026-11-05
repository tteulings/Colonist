// v1.02 Post-game review, part 3: what the person sees.
//   · Missed chances in the end-of-game recap: one line each (turn · what was in reach · how much), at most
//     three per person, biggest first, nothing when nothing clear was found; a small "checking…" line while
//     the worker reads the game (a second or so, during the end-of-game transition).
//   · Show: the Replay jumps to that moment (the board just before the move), with a coaching card in the
//     replay's control panel: the hand, "Better: A · You did: B", one line of why, and the A/B score split in
//     the AI Lab's own table (same terms, colours and letters as its Choice step).
// Pass & play: each person gets their own lines under their name. Styles: themes/review.css.
const R5 = [["wood", "Lumber"], ["brick", "Brick"], ["sheep", "Wool"], ["wheat", "Grain"], ["ore", "Ore"]];
const TERM_COLOR = { vp: "#C0548A", prod: "#6E9A2A", win: "#E0A82E", eta: "#8A8F94", block: "#5B6B8C", leader: "#D9714E", own: "#8A8F94", steal: "#C99A2E", sets: "#C99A2E", build: "#3C75C6" };
export const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const f2 = (v) => (v == null || !Number.isFinite(v) ? "–" : (Math.abs(v) < 0.005 ? 0 : v).toFixed(2));
export const IC = {
  info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  step: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l10 7-10 7z" fill="currentColor"/></svg>`,
  chev: `<svg class="rv-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  review: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="12" r="1.8" fill="currentColor"/><circle cx="13" cy="15" r="1.8" fill="currentColor"/></svg>`,
  eye: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>`,
};

/** The A/B table: the AI Lab's compare block (sx-cmp), with the letters A (better) and B (what you did). */
export function cmpHtml(c) {
  if (!c) return "";
  const fv = (r, v) => (v == null ? "–" : r.div ? `÷${f2(v)}` : r.int || c.int ? String(Math.round(v)) : f2(v));
  const diff = (r) => (r.div ? (r.a < r.b ? "sooner" : r.a > r.b ? "later" : "=") : `${r.a - r.b >= 0 ? "+" : "−"}${r.int || c.int ? Math.round(Math.abs(r.a - r.b)) : f2(Math.abs(r.a - r.b))}`);
  const d = c.sa - c.sb;
  const dTot = `${d >= 0 ? "+" : "−"}${c.int ? Math.round(Math.abs(d)) : f2(Math.abs(d))}`;
  return `<div class="sx-cmp rv-cmp"><div class="sx-cmph"><span></span><b><span class="sx-win">A</span></b><b><span class="sx-win alt">B</span></b><span>A − B</span></div>
    ${c.rows.map((r) => `<div class="sx-cmpr"><span><i style="background:${TERM_COLOR[r.k] || "var(--accent)"}"></i>${esc(r.label)}</span><span>${fv(r, r.a)}</span><span>${fv(r, r.b)}</span><span class="d">${diff(r)}</span></div>`).join("")}
    <div class="sx-cmpr tot"><span>${esc(c.total || "Score")}</span><span>${c.int ? Math.round(c.sa) : f2(c.sa)}</span><span>${c.int ? Math.round(c.sb) : f2(c.sb)}</span><span class="d">${dTot}</span></div></div>`;
}
/** v1.11 the Plan under the step card: why A was stronger, from the position (src/review/why.js). Nothing when there is none. */
export function whyHtml(w) {
  if (!w?.plan) return "";
  return `<div class="rs-why"><div class="w-h"><b>Plan</b><small>likely reason, based on the position</small><button type="button" class="w-i" data-rvwhy aria-label="About the plan">${IC.info}</button></div>
    <p class="w1"><s>A</s><span>${esc(w.plan)}</span></p>${w.vs ? `<p class="w2"><s class="alt">B</s><span>${esc(w.vs)}</span></p>` : ""}
    ${w.chips?.length ? `<div class="w-chips">${w.chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}</div>`;
}
const handHtml = (h) => `<div class="sx-hand rv-hand">${R5.map(([r, l]) => `<span class="sx-card r-${r}${h?.[r] ? "" : " zero"}"><b>${h?.[r] || 0}</b>${l}</span>`).join("")}</div>`;

export const ReviewUiMixin = {
  /** Missed chances per person (pass & play: everyone who played; solo: you). */
  _rvGroups() {
    const res = this._rv?.res;
    if (!res?.findings) return [];
    const humans = this.players.filter((p) => p.isHuman);
    // v1.03: once the Master bot has checked a person's game, their lines are its verified misses
    return humans.map((p) => ({ p, list: this._rvVerified?.(p.id) || res.findings.filter((f) => f.pid === p.id).sort((a, b) => b.size - a.size).slice(0, 3) })).filter((x) => x.list.length || this._rvReviewable?.());
  },

  /** The recap block (empty when there is nothing to say). v1.11: solo = ONE card, "Your game review": the button
   *  that opens the review first (with its progress ring), then the biggest chances missed; pass & play keeps the
   *  per-person "missed chances" lines. */
  _rvBlockHtml() {
    const R = this._rv;
    if (!R || !R.recs?.length || !this._rvCovered()) return "";
    const solo = !this.hotseat, me = solo ? this.players.find((p) => p.isHuman) : null;
    const head = (sm) => `<div class="rv1-h"><i class="rv-dot"></i><span class="rv1-tt">${solo ? "Your game review" : "Missed chances"}</span>${sm ? `<small>${sm}</small>` : ""}</div>`;
    if (R.busy || (!R.res && R.recs.length)) {
      return `<div class="rv1 gs-revcard rv-wait" role="status">${head(`<span class="rv-spin" aria-hidden="true"></span>checking…`)}<p class="rv1-lead">Looking for moves where another choice was clearly better. This takes a few seconds.</p>${me ? this._rvReviewRowHtml?.(me) || "" : ""}</div>`;
    }
    const groups = this._rvGroups();
    if (!groups.length) return "";
    return groups.map(({ p, list }) => {
      const full = this._rv.review?.pid === p.id && this._rvReviewComplete?.(p.id) && !this._rvStale?.(p.id);
      const lead = list.length ? (solo ? (full ? "Biggest chances missed, where another move kept clearly more win chance. Tap one to see it on the board." : "Quick check while the full review runs: where another move looked clearly better. Tap one to see it on the board.") : "")
        : full && this._rvBadCount?.(p.id) ? `${this._rvBadCount(p.id)} of your moves could be better. Open the review to step through ${this._rvBadCount(p.id) > 1 ? "them" : "it"}.`
        : full || this.hotseat ? "No clear mistake found in this game." : "The full review checks every move of yours with the Master bot.";
      return `<div class="rv1${solo ? " gs-revcard" : ""}" data-rvp="${p.id}"><div class="rv1-h"><i class="rv-dot"></i><span class="rv1-tt">${solo ? "Your game review" : `<span class="pc-${p.id} rv-who">${esc(p.name)}</span> · missed chances`}</span><small>${list.length ? (list[0].verified ? "checked by the Master bot" : "") : ""}</small></div>
      ${lead ? `<p class="rv1-lead">${lead}</p>` : ""}
      ${solo ? this._rvReviewRowHtml?.(p) || "" : ""}
      ${list.map((f, k) => `<button type="button" class="rv1-row" data-rvshow="${p.id}:${k}" aria-label="Turn ${f.t}: ${esc(f.line)}, ${esc(f.gain)}. Show"><span class="t">Turn ${f.t}</span><span class="x">${esc(f.line)}</span><span class="g">${esc(f.gain)}</span>${IC.chev}</button>`).join("")}
      ${solo ? "" : this._rvReviewRowHtml?.(p) || ""}</div>`;
    }).join("");
  },

  /** Fill (or refresh) the block in the open recap. */
  _rvRender() {
    const ov = this._stOverlay;
    if (!ov || !ov.isConnected) return;
    let box = ov.querySelector("[data-rvbox]");
    if (!box) return;
    box.innerHTML = this._rvBlockHtml();
    box.querySelectorAll("[data-rvshow]").forEach((b) => b.addEventListener("click", () => { const [pid, k] = b.dataset.rvshow.split(":").map(Number); this._rvShow(pid, k); }));
    this._rvBindReview?.(box);
  },

  // ── Show: the replay at that moment, with the coaching card ──
  _rvShow(pid, k) { this._rvShowList(this._rvGroups().find((x) => x.p.id === pid)?.list || [], k, pid); },
  _rvShowList(list, k, pid) {
    const f = list[k];
    if (!f || !this._st) return;
    if (!this._rpUi) this._rpStart("replay");
    const ui = this._rpUi;
    if (!ui) return;
    if (this._rp) { window.clearTimeout(this._rp.timer); this._rp.playing = false; }
    ui.classList.add("rv-show");
    ui.querySelector(".gs-rp-dice")?.replaceChildren();
    const ctl = ui.querySelector(".gs-rp-ctl");
    const who = this.players[pid];
    const solo = !this.hotseat;
    const when = { seven: "end of your turn", robber: "your robber", knight: "start of your turn" }[f.kind] || "your turn";
    ctl.innerHTML = `<div class="rvs">
      <div class="rvs-top"><i class="rv-dot"></i><div><b>Turn ${f.t} · ${solo ? when : esc(who.name)}</b><small>${f.verified ? "Checked by the Master bot · " : ""}${f.markLabel || "Missed chance"} ${k + 1} of ${list.length}${f.gainLong ? ` · ${esc(f.gainLong)}` : ""}</small></div></div>
      ${handHtml(f.hand)}
      <div class="rvs-vs"><div class="better"><span class="sx-win">A</span><small>Better</small><b>${esc(f.better)}</b></div><div><span class="sx-win alt">B</span><small>${solo ? "You did" : `${esc(who.name)} did`}</small><b>${esc(f.did)}</b></div></div>
      <p class="rvs-why">${esc(f.why)}</p>
      ${cmpHtml(f.cmp)}
      <div class="rvs-nav"><button type="button" class="rv-btn" data-rvnav="-1"${k ? "" : " disabled"}>‹ Prev</button><button type="button" class="rv-btn pri" data-rvback>${this._rvBackToReview ? "Back to review" : "Back to results"}</button><button type="button" class="rv-btn" data-rvnav="1"${k < list.length - 1 ? "" : " disabled"}>Next ›</button></div>
    </div>`;
    ctl.querySelector("[data-rvback]").addEventListener("click", () => this._rpExit());
    ctl.querySelectorAll("[data-rvnav]").forEach((b) => b.addEventListener("click", () => this._rvShowList(list, k + Number(b.dataset.rvnav), pid)));
    // the board fits the room the card leaves, at the moment just before the move
    const cv = ui.querySelector(".gs-rp-board canvas"), br = cv.parentElement.getBoundingClientRect();
    this._rpOpen(cv, Math.round(br.width), Math.round(br.height));
    this._rpSeek(f.s, f.e);
    const st = this._st, maxV = Math.max(this.winPoints, ...st.vp[st.N]);
    ui.querySelectorAll(".gs-vpr").forEach((row) => { const v = st.vp[Math.min(f.s, st.N)][+row.dataset.pid]; row.querySelector("b").style.width = `${(v / maxV) * 100}%`; row.querySelector(".gs-vpv").textContent = v; });
    const glow = ui.querySelector(".gs-rp-glow");
    glow.setAttribute("viewBox", `0 0 ${Math.round(br.width)} ${Math.round(br.height)}`);
    glow.innerHTML = this._rvMarks(f.focus);
    this.boardRenderer?.requestDraw?.();
  },

  /** A (better: teal ring + letter) and B (what was done: white dashed ring) on the board. */
  _rvMarks(focus) {
    if (!focus) return "";
    const V = this.view, g = this.geometry;
    const xy = (p) => [p.x * V.scale + V.offsetX, p.y * V.scale + V.offsetY];
    const at = (f) => {
      if (!f) return null;
      if (f.hex != null) { const h = g.hexes[f.hex]; return { c: xy(h.center), r: g.hexSize * V.scale * 0.62 }; }
      if (f.city != null || f.node != null) return { c: xy(g.nodes[f.city ?? f.node]), r: 16 };
      if (f.edge != null) { const [a, b] = g.edges[f.edge].nodes.map((n) => xy(g.nodes[n])); return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r: 13 }; }
      return null;
    };
    const mark = (f, letter, alt) => {
      const m = at(f);
      if (!m) return "";
      const [x, y] = m.c, r = m.r;
      const ring = alt ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="3.5" stroke-dasharray="5 4"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="6"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="3.2"/>`;
      const bx = x - r * 0.75 - 4, by = y - r * 0.75 - 6;
      return `${ring}<g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)})"><circle r="11" fill="${alt ? "#fff" : "var(--primary)"}" stroke="${alt ? "var(--primary)" : "#fff"}" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="${alt ? "#22302F" : "#fff"}">${letter}</text></g>`;
    };
    return `<g class="rv-marks">${mark(focus.b, "B", true)}${mark(focus.a, "A", false)}</g>`;
  },
};

/** Put the block into the recap, right under the three highlights. */
export function installReviewUi(Cls) {
  const P = Cls.prototype;
  const orig = P._stShowOverlay;
  P._stShowOverlay = function (...a) {
    const r = orig.apply(this, a);
    try {
      const ov = this._stOverlay;
      const anchor = ov?.querySelector(".gs-recap") || ov?.querySelector(".gs-ov"); // v1.11: its own card under the result
      if (anchor && this._rv?.recs?.length && this._rvCovered()) {
        const box = document.createElement("div");
        box.dataset.rvbox = "";
        anchor.after(box);
        this._rvRender();
      }
    } catch (e) { console.warn("review", e); }
    return r;
  };
}
