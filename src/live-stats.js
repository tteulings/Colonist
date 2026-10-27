// Live stats: the end-of-game stats cards, during the game. A mixin on ColonistFullGame (installed by game.js).
//
// Opened from Menu › Stats or by tapping the dice tray (it carries a small chart glyph). A half-height sheet
// (≈ 43 % of the screen) docked above the dock, so the board's top half, the Rush timer, the dice tray and
// the Roll / End turn / Ready buttons stay visible and tappable; a Rush offer bar moves up above it.
// One card at a time in a horizontal carousel (swipe between cards, or tap a chip):
//   Dice (hot / cold numbers vs expected) · Income (expected cards per roll from the board) · Race (VP so far)
//   · Cards (resources from the dice) · Losses (stolen / discarded / Monopoly) · Heat map · Robber (and pirate)
// It never pauses anything: bots keep playing, the cards refresh (throttled) while it is open.
// Closes with ✕, a swipe down on its head, Esc, a hot-seat hand-off, the game's end, a new game, or when
// the person holding the phone has to use the board (placing, robber, discard).
// Public information only: other players' points without their hidden VP cards, no hand contents, no
// development card identities, stolen cards only as counts. In pass & play "you" = the phone holder.
// Styles: themes/stats.css (the .ls-* block).
import { RES, computeStats } from "./stats.js";

const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const W = 300;
const nf = (x) => (Math.round(x * 10) / 10).toString();
const CHART_IC = `<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M3 11h3v6H3zM8.5 4h3v13h-3zM14 8h3v9h-3z"/></svg>`;
const CARDS = [["dice", "Dice"], ["income", "Income"], ["race", "Race"], ["res", "Cards"], ["robbed", "Losses"], ["map-prod", "Heat map"], ["map-robber", "Robber"]];

export const LiveStatsMixin = {
  /** Can the sheet open now? (a game on the table, not over, not behind the home screen) */
  liveStatsAvailable() {
    return !!(this.stats && this.players?.length && this.geometry && !this.winner && !this.home?.open && !this._replay);
  },

  /** The phone holder must use the board / hand right now: the sheet gets out of the way. */
  _lsNeedsBoard() {
    const cur = this.currentPlayer;
    const inter = (p) => !!p && (this._isInteractive ? this._isInteractive(p) : p.isHuman);
    if (this.pendingDiscard?.player && inter(this.pendingDiscard.player)) return true;
    if (this.pendingAction && (this.isRush?.() || inter(cur))) return true;
    if (inter(cur) && ((this.setupPhase && this.setupAction) || this.robberVictimOptions?.length)) return true;
    return false;
  },

  /** "You" for the cards: the solo human, or in pass & play the phone holder. */
  _lsMe() {
    if (this.hotseat) return this.players[this.viewerId] || null;
    return this._me() || null;
  },

  liveStatsToggle() { if (this._lsEl) this.liveStatsClose(); else this.liveStatsOpen(); },

  liveStatsOpen(card = null) {
    if (!this.liveStatsAvailable() || this._lsNeedsBoard()) return false;
    if (this.hotseat && this.hsCoverOn != null) return false;
    this.menu?.close?.();
    if (this._lsEl) { if (card) this._lsGo(card); return true; }
    const host = document.getElementById("boardWrap") || this.app || document.body;
    const el = document.createElement("section");
    el.className = "ls-sheet gs-live";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Live stats");
    el.innerHTML = `<div class="ls-head"><span class="ls-grab" aria-hidden="true"></span>
        <h3>${CHART_IC}Live stats <small class="ls-when"></small></h3>
        <button type="button" class="btn ghost icon-only ls-x" aria-label="Close stats">✕</button></div>
      <div class="ls-chips" role="tablist">${CARDS.map(([k, l], i) => `<button type="button" role="tab" class="ls-chip${i ? "" : " on"}" data-go="${k}" aria-selected="${i ? "false" : "true"}">${k === "map-robber" && this.sea ? "Robber &amp; pirate" : l}</button>`).join("")}</div>
      <div class="ls-track gs-pane">${CARDS.map(([k]) => `<div class="ls-slot" data-slot="${k}"></div>`).join("")}</div>`;
    host.appendChild(el);
    this._lsEl = el;
    this._lsSig = {};
    this.app?.classList.add("ls-open");
    el.querySelector(".ls-x").addEventListener("click", () => this.liveStatsClose());
    el.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => this._lsGo(b.dataset.go)));
    const track = el.querySelector(".ls-track");
    let raf = 0;
    track.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this._lsSyncChip()); }, { passive: true });
    this._lsSwipe(el);
    this._lsKey = (e) => { if (e.key === "Escape" && this._lsEl && !this.menu?.open) this.liveStatsClose(); };
    document.addEventListener("keydown", this._lsKey);
    this._lsUpdate(true);
    if (card) this._lsGo(card, false);
    el.classList.add("in");
    return true;
  },

  liveStatsClose() {
    const el = this._lsEl;
    if (!el) return;
    this._lsEl = null;
    window.clearTimeout(this._lsTimer); this._lsTimer = 0;
    this._stMapStop?.();
    document.removeEventListener("keydown", this._lsKey);
    this.app?.classList.remove("ls-open");
    el.remove();
  },

  /** Swipe the head down to close. */
  _lsSwipe(el) {
    const head = el.querySelector(".ls-head");
    let y0 = null, dy = 0, id = null;
    head.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; y0 = e.clientY; dy = 0; id = e.pointerId; head.setPointerCapture?.(id); el.style.transition = "none"; });
    head.addEventListener("pointermove", (e) => { if (y0 == null || e.pointerId !== id) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (y0 == null) return;
      y0 = null; el.style.transition = "";
      if (dy > 60) this.liveStatsClose(); else el.style.transform = "";
    };
    head.addEventListener("pointerup", end);
    head.addEventListener("pointercancel", end);
  },

  _lsGo(key, smooth = true) {
    const slot = this._lsEl?.querySelector(`[data-slot="${key}"]`);
    if (!slot) return;
    const track = slot.parentElement;
    track.scrollTo({ left: slot.offsetLeft - track.offsetLeft - (track.clientWidth - slot.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
    this._lsMarkChip(key);
  },

  _lsSyncChip() {
    const el = this._lsEl;
    if (!el) return;
    const track = el.querySelector(".ls-track");
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = null, bd = Infinity;
    track.querySelectorAll(".ls-slot").forEach((s) => { const c = s.offsetLeft - track.offsetLeft + s.offsetWidth / 2; const d = Math.abs(c - mid); if (d < bd) { bd = d; best = s.dataset.slot; } });
    if (best) this._lsMarkChip(best);
  },

  _lsMarkChip(key) {
    const el = this._lsEl;
    if (!el || el.dataset.on === key) return;
    el.dataset.on = key;
    el.querySelectorAll("[data-go]").forEach((b) => { const on = b.dataset.go === key; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); if (on) b.scrollIntoView?.({ block: "nearest", inline: "nearest" }); });
  },

  /** Called after every render: refresh (throttled), or step aside when the board is needed. */
  _lsTick() {
    if (!this._lsEl) return;
    if (!this.liveStatsAvailable() || this._lsNeedsBoard() || (this.hotseat && this.hsCoverOn != null)) { this.liveStatsClose(); return; }
    if (this._lsTimer) return;
    this._lsTimer = window.setTimeout(() => { this._lsTimer = 0; if (this._lsEl) this._lsUpdate(false); }, 700);
  },

  /** Public VP per step: hidden VP cards are subtracted, except for the one whose cards this screen may show. */
  _lsPublicVp(st) {
    const bought = this.players.map(() => 0);
    const out = [];
    const byStep = st.stepEvents;
    for (let s = 0; s <= st.N; s += 1) {
      byStep[s].forEach((e) => { if (e[1] === "v" && e[3] === "victoryPoint") bought[e[2]] += 1; });
      out.push(st.vp[s].map((v, i) => (this._seesPrivate(this.players[i]) ? v : v - bought[i])));
    }
    // the last row: what the scoreboard shows right now
    out[st.N] = this.players.map((p) => (this._seesPrivate(p) ? p.victoryPoints : p.victoryPoints - (p.devVictoryPoints || 0)));
    return out;
  },

  /** Expected cards per roll for every player from the current board (robber's tile pays nothing). */
  _lsIncome() {
    const g = this.geometry;
    const per = this.players.map(() => ({ res: [0, 0, 0, 0, 0], gold: 0, total: 0, byNum: {} }));
    g.hexes.forEach((h) => {
      if (!h.number || h.id === this.robberHexId || h.resource === "sea" || h.resource === "desert") return;
      const ri = RES.indexOf(h.resource);
      h.nodes.forEach((nid) => {
        const n = g.nodes[nid];
        if (n.owner == null || !n.structure || !per[n.owner]) return;
        const k = n.structure === "city" ? 2 : 1, v = (PIPS[h.number] / 36) * k, o = per[n.owner];
        if (ri >= 0) o.res[ri] += v; else o.gold += v;
        o.total += v;
        o.byNum[h.number] = (o.byNum[h.number] || 0) + k;
      });
    });
    return per;
  },

  _lsCompute() {
    try { this._stSync(); return computeStats(this); } catch (e) { console.warn("live stats failed", e); return null; }
  },

  /** Rebuild the cards whose content changed; keep the carousel where it is. */
  _lsUpdate(first) {
    const el = this._lsEl;
    if (!el) return;
    const st = this._lsCompute();
    if (!st) return;
    this._lsSt = st;
    const N = st.N;
    el.querySelector(".ls-when").textContent = this.isRush() ? `· ${N} roll${N === 1 ? "" : "s"}` : `· turn ${this.turn} · ${N} roll${N === 1 ? "" : "s"}`;
    const pub = this._lsPublicVp(st);
    const html = {
      dice: () => this._lsCardDice(st),
      income: () => this._lsCardIncome(st),
      race: () => this._lsCardRace(st, pub),
      res: () => this._stCardRes(st),
      robbed: () => this._stCardRobbed(st),
    };
    Object.entries(html).forEach(([k, fn]) => {
      const h = fn();
      if (this._lsSig[k] === h) return;
      this._lsSig[k] = h;
      el.querySelector(`[data-slot="${k}"]`).innerHTML = h;
    });
    // heat maps: redrawn only when the log moved on (and not while their ▶ build-up plays)
    const mapSig = `${N}|${st.robberMoves}|${this.robberHexId}|${this.sea?.pirateHexId ?? ""}|${this.theme?.id}|${this.players.map((p) => st.prodTot[p.id]).join(",")}`;
    if (this._lsSig.maps !== mapSig && !el.querySelector(".gs-map.playing")) {
      this._lsSig.maps = mapSig;
      ["prod", "robber"].forEach((k) => { el.querySelector(`[data-slot="map-${k}"]`).innerHTML = this._stCardMap(st, k); });
      const track = el.querySelector(".ls-track");
      const slot = el.querySelector('[data-slot="map-prod"]');
      const cardH = slot.clientHeight || 220;
      const ratio = this.sea ? 0.8 : 0.96;
      track.querySelectorAll(".gs-map").forEach((m) => { m.style.width = `${Math.max(120, Math.min(slot.clientWidth - 24, (cardH - 64) / ratio))}px`; });
      this._stMapsInit(track, st);
    }
    if (first) this._lsSyncChip();
    this._lsMore();
  },

  /** v0.82: a card taller than the sheet (big type in Wood, 6 players) fades out at the bottom and shows a thin
   *  scrollbar, until it is scrolled to the end — so a cut-off last row reads as "scroll for more". */
  _lsMore() {
    const el = this._lsEl;
    if (!el) return;
    const track = el.querySelector(".ls-track");
    if (!track._lsMoreOn) {
      track._lsMoreOn = true;
      track.addEventListener("scroll", (e) => { if (e.target !== track && e.target.classList?.contains("gs-card")) this._lsMoreMark(e.target); }, { capture: true, passive: true });
    }
    track.querySelectorAll(".ls-slot .gs-card").forEach((c) => this._lsMoreMark(c));
  },

  _lsMoreMark(c) {
    const more = c.scrollHeight - c.clientHeight > 2 && c.scrollTop + c.clientHeight < c.scrollHeight - 4;
    c.classList.toggle("ls-scroll", c.scrollHeight - c.clientHeight > 2);
    c.classList.toggle("ls-more", more);
  },

  /** Dice so far vs expected: the hot number carries the accent, the cold one an accent outline. */
  _lsCardDice(st) {
    const H = 122, n = st.N, bw = (W - 8) / 11;
    const exp = (k) => (n * PIPS[k]) / 36;
    let hot = null, cold = null;
    for (let k = 2; k <= 12; k += 1) {
      const c = st.dice[k] || 0, d = c - exp(k);
      if (c >= 2 && d >= 1.5 && (!hot || d > hot.d)) hot = { k, c, d, e: exp(k) };
      if ([4, 5, 6, 8, 9, 10].includes(k) && d <= -1.5 && (!cold || d < cold.d)) cold = { k, c, d, e: exp(k) };
    }
    const maxC = Math.max(1, ...Object.values(st.dice), exp(7));
    const ys = (v) => (v * (H - 34)) / maxC;
    let bars = "";
    for (let k = 2; k <= 12; k += 1) {
      const xx = 4 + (k - 2) * bw, c = st.dice[k] || 0;
      const cls = hot?.k === k ? " hi" : cold?.k === k ? " cold" : "";
      bars += `<g class="gs-dbar${cls}" data-k="${k}" data-c="${c}"><rect x="${(xx + 3).toFixed(1)}" y="${(H - 18 - ys(c)).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(0.5, ys(c)).toFixed(1)}" rx="4"/><text class="gs-ax n" x="${(xx + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${k}</text>${c ? `<text class="gs-ax c" x="${(xx + bw / 2).toFixed(1)}" y="${(H - 22 - ys(c)).toFixed(1)}" text-anchor="middle">${c}</text>` : ""}</g>`;
    }
    const pts = [];
    for (let k = 2; k <= 12; k += 1) pts.push(`${(4 + (k - 2) * bw + bw / 2).toFixed(1)},${(H - 18 - ys(exp(k))).toFixed(1)}`);
    const xe = (o) => `${o.c}×, expected ${nf(o.e)}`;
    let title;
    if (!n) title = "No rolls yet";
    else if (hot && cold) title = `${hot.k} is hot (${hot.c}×), ${cold.k} is cold (${cold.c}×)`;
    else if (hot) title = `${hot.k} is hot: ${xe(hot)}`;
    else if (cold) title = `${cold.k} is cold: ${xe(cold)}`;
    else title = "The dice follow the odds so far";
    const sub = `<span>${n} roll${n === 1 ? "" : "s"} so far</span><span><span class="ls-dash"></span> expected${hot && cold ? `: ${hot.k} ${nf(hot.e)} · ${cold.k} ${nf(cold.e)}` : ""}</span>`;
    const body = `<svg class="gs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dice rolls so far">${bars}<polyline class="gs-exp" points="${pts.join(" ")}"/></svg>`;
    return this._stCard("dice", title, sub, body, ` data-rolls="${n}" data-hot="${hot?.k ?? ""}" data-cold="${cold?.k ?? ""}"`);
  },

  /** Expected cards per roll from everyone's settlements and cities (the board is public). */
  _lsCardIncome(st) {
    const inc = this._lsIncome(), me = this._lsMe();
    const col = this._stResCol();
    const maxV = Math.max(0.5, ...inc.map((o) => o.total));
    const ranked = [...this.players].sort((a, b) => inc[b.id].total - inc[a.id].total);
    const rows = ranked.map((p) => {
      const o = inc[p.id];
      let acc = 0;
      const seg = (v, style, cls = "") => { if (v <= 0) return ""; const s = `<rect class="gs-seg${cls}" x="${(acc / maxV) * 100}%" width="calc(${(v / maxV) * 100}% - 1.5px)" height="16" rx="3"${style ? ` style="${style}"` : ""}/>`; acc += v; return s; };
      const segs = RES.map((r, ri) => seg(o.res[ri], `fill:${col[r]}`)).join("") + seg(o.gold, "", " gold");
      return `<div class="gs-row${me && p.id === me.id ? " me" : ""}" data-pid="${p.id}" data-income="${o.total.toFixed(3)}">${this._stPortrait(p.id, "", 26)}<svg class="gs-bar" height="16">${segs}</svg><b>${nf(o.total)}</b></div>`;
    }).join("");
    let title, tags = "";
    if (me) {
      const o = inc[me.id], who = this._you(me) ? "You get" : `${me.name} gets`;
      const cards = `~${nf(o.total)} card${nf(o.total) === "1" ? "" : "s"} per roll`;
      title = `${who} ${cards}`;
      const nums = Object.entries(o.byNum).sort((a, b) => b[1] * PIPS[b[0]] - a[1] * PIPS[a[0]]);
      if (nums.length) tags += ` <span class="gs-tag">best number ${nums[0][0]}</span>`;
      if (st.expected[me.id] > 0.5) { const l = Math.round(st.luck[me.id] * 100); tags += ` <span class="gs-tag">dice luck ${l >= 0 ? "+" : "−"}${Math.abs(l)}%</span>`; }
      const rank = ranked.indexOf(me) + 1;
      if (rank === 1 && ranked.length > 1 && inc[ranked[1].id].total < o.total) title = `${who} the most: ${cards}`;
    } else title = `${ranked[0].name} has the best income: ~${nf(inc[ranked[0].id].total)} per roll`;
    const legend = `<div class="gs-legend res">${RES.map((r) => `<span>${this._lsIcon(r)}</span>`).join("")}</div>`;
    return this._stCard("income", title, `Expected cards per roll from settlements &amp; cities${tags}`, `<div class="gs-rows">${rows}</div>${legend}`);
  },

  _lsIcon(n) { return `<svg class="ic" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-${n}" x="-50" y="-50" width="100" height="100"/></svg>`; },

  /** VP race so far (public points), titled by the current leader. */
  _lsCardRace(st, pub) {
    const now = pub[st.N];
    const top = Math.max(...now);
    const leaders = this.players.filter((p) => now[p.id] === top);
    const leader = leaders[0];
    const card = this._stCardRace({ ...st, vp: pub, winner: leader.id });
    let title;
    const nm = (p) => this._stName(p);
    if (leaders.length > 1) title = leaders.length === this.players.length ? `All level on ${top} point${top === 1 ? "" : "s"}` : leaders.length === 2 ? `${nm(leaders[0])} and ${nm(leaders[1])} share the lead: ${top}` : `${leaders.length} players share the lead on ${top}`;
    else {
      const second = Math.max(...now.filter((_, i) => i !== leader.id));
      const verb = this._you(leader) ? "lead" : "leads";
      title = `${nm(leader)} ${verb} with ${top} point${top === 1 ? "" : "s"}${top - second >= 2 ? `, ${top - second} ahead` : ""}`;
    }
    return card.replace(/<h2>[\s\S]*?<\/h2>/, `<h2>${title}</h2>`).replace('data-card="race"', `data-card="race" data-vp="${now.join(",")}"`)
      .replace(`<div class="gs-sub">Points over time</div>`, `<div class="gs-sub">Points so far · hidden VP cards not counted</div>`);
  },
};

/** Wire the sheet into the game: refresh after renders, close on hand-off / game end / new game, the dice tray opens it. */
export function installLiveStats(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  wrap("render", function (orig, ...a) {
    const r = orig.apply(this, a);
    if (!this._lsWired) {
      this._lsWired = true;
      // the dice tray (and its chart glyph) opens the live stats; on the tray itself (its contents are redrawn on
      // every roll, so a tap may end on a removed die) and in the capture phase, so the old roll panel stays shut
      const tray = this.lastDiceDisplay || document.getElementById("lastDiceDisplay");
      tray?.addEventListener("click", (e) => {
        if (this._replay) return;
        e.stopPropagation();
        e.preventDefault();
        this.liveStatsToggle();
      }, true);
    }
    if (this._lsEl) this._lsTick();
    return r;
  });
  const closeFirst = (name) => wrap(name, function (orig, ...a) { this.liveStatsClose(); return orig.apply(this, a); });
  ["_hsShowCover", "showGameOverOverlay", "startNewGame", "goHome", "resetGame"].forEach(closeFirst);
}
