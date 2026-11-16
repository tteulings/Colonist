// v1.83 The AI tab's dynamic page: the renderer of the composition spec (src/review/ai-page.js) over the fact index (src/review/ai-index.js).
// Primitives: line (win chance with tappable turn markers / points with plan, stalls, pivot), bars, strip (cards in hand / dice), stack (points by
// source), tiles, compare, board, badge, table, text. Every number is resolved from the facts at render time. No model call: the page is the recipes
// (or, later, a validated spec a model composed). Interactions: card tap = accordion, turn marker / pill = bottom sheet with previous / next turn.
import { buildFacts } from "./review/ai-index.js";
import { recipeValidated, validatePage, turnsOf, LEVELS } from "./review/ai-page.js";
import { aiBlocks } from "./review/ai-blocks.js";
import { PIPS } from "./review/luck.js";
import { R5 } from "./review/ai-strat.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const sg = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const VISIBLE = 4;
const RES_ABBR = { wood: "Wo", brick: "Br", sheep: "Sh", wheat: "Wh", ore: "Or" };
const LV_CLASS = { Game: "game", "Near miss": "near", Decision: "decision", Strategy: "strategy", Luck: "luck" };
const SRC_NAME = { s: "Settlements", c: "Cities", L: "Longest road", A: "Largest army", v: "Point cards" };
const SRC_CLASS = { s: "s", c: "c", L: "l", A: "a", v: "v" };
const CHEV = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const dots = (n) => `<span class="pg-dots" role="img" aria-label="${n} of 3">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const tick = (span) => (span > 30 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1);

export const ReviewAiPageMixin = {
  /** The legacy (model cards) render path stays reachable for the v1.73-1.82 tests: g._aiLegacy = true or localStorage colonist_ai_legacy = 1. */
  _pgLegacy() { return !!this._aiLegacy || tryv(() => localStorage.getItem("colonist_ai_legacy") === "1", false); },
  /** { fx, page } for the reviewed game, rebuilt when the review moved on (luck run, new results). */
  _pgState() {
    const R = this._rv, L = tryv(() => this._lkState()), k = `${L?.j ?? -1}|${L?.done ? 1 : 0}|${this.players.map((p) => tryv(() => this._rvOf(p.id)?.results?.length, 0)).join()}|${this._rvPid}`;
    const c = this._pgMemo; if (c && c.R === R && c.k === k) return c;
    const fx = buildFacts(this), page = recipeValidated(fx);
    this._pgMemo = { R, k, fx, page };
    if (page.dropped.length) console.debug("ai page dropped", page.dropped);
    return this._pgMemo;
  },
  /** Use a given (model composed) spec instead of the recipes: validated, never trusted. */
  _pgSetSpec(spec) { const s = this._pgState(); const v = validatePage(spec, s.fx); if (v.widgets.length) s.page = v; return v; },

  // ── parts: text with refs, filled from the facts ──
  _pgParts(parts, fx) {
    let out = "", start = true;
    (parts || []).forEach((p) => {
      if (typeof p === "string") { out += esc(start ? p.replace(/^(\s*)(\p{L})/u, (m, a, b) => a + b.toUpperCase()) : p); if (p.trim()) start = /[.!?]\s*$/.test(p); return; }
      if (p.dir) { const a = fx.ref(p.dir[0])?.v, b = fx.ref(p.dir[1])?.v; out += `<b class="pg-dir">${esc(b > a ? p.up : b < a ? p.down : p.same)}</b>`; start = false; return; }
      const r = fx.ref(p.ref); if (!r) return;
      switch (p.fmt) {
        case "player": { const you = r.v === fx.me; out += `<${you ? "span" : "button type=\"button\""} class="pg-pl pc-${r.v}"${you ? "" : ` data-aipl="${r.v}"`}>${esc(fx.nameOf(r.v))}</${you ? "span" : "button"}>`; break; }
        case "turn": out += `<button type="button" class="pg-t" data-pgturn="${r.v}">${start ? "Turn" : "turn"} ${r.v}</button>`; break;
        case "pct": out += `<b class="pg-n">${r.v}%</b>`; break;
        case "sgpct": out += `<b class="pg-n ${r.v > 0 ? "up" : r.v < 0 ? "dn" : ""}">${sg(r.v)}%</b>`; break;
        case "x": { const s = String(r.v); out += esc(start ? s.charAt(0).toUpperCase() + s.slice(1) : s); break; }
        default: out += `<b class="pg-n">${r.v}</b>`;
      }
      start = false;
    });
    return out;
  },

  // ── the page ──
  _pgHtml() {
    const { fx, page } = this._pgState();
    this._pgOpenSet = this._pgOpenSet || new Set();
    const hl = page.headline ? `<p class="pg-hl">${this._pgParts(page.headline, fx)}</p>` : "";
    const cards = page.widgets.map((w, i) => this._pgCardHtml(w, i, fx));
    const vis = cards.slice(0, VISIBLE), more = cards.slice(VISIBLE);
    this._pgX = new Map(); page.widgets.forEach((w) => this._pgX.set(w.id, w));
    return `<div class="pg" data-pg>${hl}${vis.join("")}${more.length ? `<div class="pg-more-w" data-pgmorebox><button type="button" class="pg-more" data-pgmore aria-expanded="false">More<span>${more.length}</span></button></div><div data-pgrest hidden>${more.join("")}</div>` : ""}<p class="pg-ft"><span>Summary from this game's numbers. Beta.</span></p></div>`;
  },
  _pgCardHtml(w, i, fx) {
    const exp = !!(w.expand.length || w.notes.length), lv = LV_CLASS[w.level] || "game", q = w.who != null ? fx.seatOf(w.who) : -1;
    const chip = w.chip ? (() => { const r = fx.ref(w.chip.ref); if (!r) return ""; const v = r.v, tone = w.chip.tone || (v > 0 ? "up" : v < 0 ? "dn" : ""); return `<span class="pg-chip ${tone}">${w.chip.fmt === "n" ? v : w.chip.fmt === "pct" ? `${v}%` : `${sg(v)}%`}</span>`; })() : "";
    return `<section class="pg-c lv-${lv}${exp ? " exp" : ""}" data-pgc="${esc(w.id)}" data-pgi="${i}"><div class="pg-hd"><span class="pg-lv">${esc(w.level)}</span>${q >= 0 && !fx.players[q].you ? `<span class="pg-who pc-${q}"><i></i>${esc(fx.nameOf(q))}</span>` : q >= 0 ? `<span class="pg-who pc-${q}"><i></i>${esc(fx.nameOf(q))}</span>` : ""}${chip}${exp ? `<button type="button" class="pg-chev" data-pgtoggle aria-expanded="false" aria-label="Details">${CHEV}</button>` : ""}</div>
      <h3 class="pg-ti">${this._pgParts(w.title, fx)}</h3><div class="pg-bl">${w.blocks.map((b, j) => this._pgBlock(b, w, fx, `${w.id}:${j}`)).join("")}</div>${exp ? `<div class="pg-ex" data-pgex hidden></div>` : ""}</section>`;
  },
  _pgExpandHtml(w, fx) {
    return `${w.expand.map((b, j) => this._pgBlock(b, w, fx, `${w.id}:x${j}`)).join("")}${w.notes.map((n) => `<p class="pg-note">${this._pgParts(n, fx)}</p>`).join("")}`;
  },

  // ── primitives ──
  _pgBlock(b, w, fx, bkey) {
    try {
      switch (b.p) {
        case "line": return b.metric === "points" ? this._pgPointsLine(b, fx) : this._pgWinLine(b, fx);
        case "bars": return this._pgBars(b, fx);
        case "strip": return b.metric === "hand" ? this._pgHand(b, fx) : this._pgRolls(fx);
        case "stack": return this._pgStack(b, fx);
        case "tiles": return this._pgTiles(b, fx);
        case "badge": return this._pgBadge(b, fx);
        case "table": return this._pgTable(fx);
        case "text": return `<p class="pg-tx${b.link ? " link" : ""}">${this._pgParts(b.parts, fx)}</p>`;
        case "compare": return this._pgCompare(b, fx, bkey);
        case "board": return this._pgBoard(b, fx, bkey);
        default: return "";
      }
    } catch (e) { console.warn("ai page block", b.p, e); return ""; }
  },
  _pgAxis(l, r, t0, t1, H, bm, x, step) {
    let o = ""; for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) o += `<text x="${x(t).toFixed(1)}" y="${H - bm + 13}" text-anchor="middle" class="ax">${t}</text>`;
    return o + `<text x="${r}" y="${H - 1}" text-anchor="end" class="axl">Turn</text>`;
  },
  _pgWinLine(b, fx) {
    const seats = b.players.map((k) => fx.seatOf(k)), [t0, t1] = b.range || [0, fx.T], W = 320, H = 168, l = 32, r = 12, tp = 20, bm = 34;
    const ts = [...fx.ser.by.keys()].filter((t) => t >= t0 && t <= t1).sort((a, c) => a - c); if (ts.length < 2) return "";
    const vals = (q) => ts.map((t) => [t, fx.wc(q, t)]).filter((p) => p[1] != null), lines = seats.map((q) => ({ q, p: vals(q) }));
    const all = lines.flatMap((x) => x.p.map((p) => p[1])); let lo = 0, hi = 100;
    if (t1 - t0 < fx.T * 0.6) { lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10); hi = Math.min(100, Math.ceil((Math.max(...all) + 6) / 10) * 10); if (hi - lo < 30) { hi = Math.min(100, lo + 30); lo = Math.max(0, hi - 30); } }
    const x = (t) => l + ((t - t0) / Math.max(1, t1 - t0)) * (W - l - r), y = (v) => H - bm - ((v - lo) / (hi - lo)) * (H - tp - bm);
    const grid = [lo, Math.round((lo + hi) / 2), hi].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${l - 5}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" class="ax">${v}%</text>`).join("");
    const paths = lines.map((ln) => `<path class="pc-${ln.q}${ln.q === fx.me ? " me" : ""}" d="${ln.p.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("")}"/>`).join("");
    const placed = []; // label rects already used: a label takes the first free spot above or below its dot
    const marks = b.marks.slice().sort((a, c) => a - c).map((t) => {
      const q = seats[0], v = fx.wc(q, t); if (v == null) return ""; const cx = x(t), cy = y(v), lab = `T${t}`, w = lab.length * 6.6 + 12;
      const lx = Math.max(l - 6, Math.min(W - r - w + 6, cx - w / 2));
      const free = (ly) => ly >= 1 && ly <= H - bm - 17 && !placed.some((p) => lx < p.x + p.w + 3 && lx + w + 3 > p.x && ly < p.y + 19 && ly + 19 > p.y);
      const ly = [cy - 25, cy + 9, cy - 44, cy + 28].find(free) ?? Math.max(1, Math.min(H - bm - 17, cy - 25)); placed.push({ x: lx, y: ly, w });
      return `<g class="mk pc-${q}" data-pgturn="${t}" role="button" tabindex="0" aria-label="Turn ${t}, ${v}%"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="17" class="hit"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.8" class="dot"/><rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${w}" height="16" rx="8" class="tag"/><text x="${(lx + w / 2).toFixed(1)}" y="${(ly + 11.2).toFixed(1)}" text-anchor="middle" class="tg">${lab}</text></g>`;
    }).join("");
    const leg = seats.length > 1 ? seats.map((q) => `<span class="pc-${q}"><i></i>${esc(fx.nameOf(q))}</span>`).join("") : "";
    return `<div class="pg-vz"><svg viewBox="0 0 ${W} ${H}" class="pg-svg win" role="img" aria-label="Win chance by turn"><text x="${l - 5}" y="10" class="axl" text-anchor="start">Win chance</text>${grid}${paths}${this._pgAxis(l, W - r, t0, t1, H, bm, x, tick(t1 - t0))}${marks}</svg>${leg || b.marks.length ? `<div class="pg-leg">${leg}${b.marks.length ? `<em>Tap a dot to open that turn</em>` : ""}</div>` : ""}</div>`;
  },
  _pgShape(k, cx, cy) {
    cx = +cx; cy = +cy;
    switch (k) {
      case "s": return `<circle cx="${cx}" cy="${cy}" r="4.2" class="sh s"/>`;
      case "c": return `<rect x="${cx - 4.4}" y="${cy - 4.4}" width="8.8" height="8.8" rx="1.6" class="sh c"/>`;
      case "v": return `<path d="M${cx} ${cy - 5.4}L${cx + 5.4} ${cy}L${cx} ${cy + 5.4}L${cx - 5.4} ${cy}Z" class="sh v"/>`;
      case "L": return `<rect x="${cx - 5}" y="${cy - 2}" width="10" height="4" rx="2" class="sh l"/>`;
      case "A": return `<path d="M${cx} ${cy - 5.4}L${cx + 5} ${cy + 4}L${cx - 5} ${cy + 4}Z" class="sh a"/>`;
      default: return "";
    }
  },
  _pgPointsLine(b, fx) {
    const q = fx.seatOf(b.player), S = fx.strat[q], log = fx.log; if (!S || !log) return "";
    const T = fx.T, goal = this.winPoints || 10, W = 320, H = 168, l = 30, r = 12, tp = 18, bm = 34, x = (t) => l + (t / Math.max(1, T)) * (W - l - r), y = (v) => H - bm - (Math.min(v, goal + 1) / (goal + 1)) * (H - tp - bm);
    const pb = S.ptsBy; let bands = "";
    if (b.show.includes("stalls")) S.stretches.forEach(([a, c]) => { bands += `<rect x="${x(a - 1).toFixed(1)}" y="${tp}" width="${(x(c) - x(a - 1)).toFixed(1)}" height="${H - bm - tp}" class="stall"/>`; });
    if (b.show.includes("plan") && S.first2.length === 2) { const a = Math.max(0, S.first2[0].t - 1), c = S.first2[1].t; bands += `<rect x="${x(a).toFixed(1)}" y="${tp}" width="${Math.max(6, x(c) - x(a)).toFixed(1)}" height="${H - bm - tp}" class="plan"/><text x="${(x(a) + 3).toFixed(1)}" y="${tp + 10}" class="pl">plan</text>`; }
    let d = ""; for (let t = 0; t <= T; t++) d += `${t ? `L${x(t).toFixed(1)} ${y(pb[t - 1]).toFixed(1)}` : `M${x(0).toFixed(1)} ${y(pb[0]).toFixed(1)}`}L${x(t).toFixed(1)} ${y(pb[t]).toFixed(1)}`;
    const grid = [0, Math.round(goal / 2), goal].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g${v === goal ? " goal" : ""}"/><text x="${l - 5}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" class="ax">${v}</text>`).join("");
    const icons = [], seen = new Set();
    (log.pts[q] || []).filter((e) => e.n > 0 && e.t > 0).forEach((e) => { const k = `${e.t}${e.k}`; if (seen.has(k) && e.k === "s") return; seen.add(k); icons.push(this._pgShape(e.k, x(e.t).toFixed(1), y(pb[e.t]).toFixed(1))); });
    log.builds[q].filter((e) => e.k === "r" && e.t > 0).forEach((e) => { icons.push(`<rect x="${(x(e.t) - 3.5).toFixed(1)}" y="${(y(0) - 4).toFixed(1)}" width="7" height="2.6" rx="1.3" class="sh r"/>`); });
    const pivot = b.show.includes("pivot") && S.pivot ? `<g class="pv" data-pgturn="${S.pivot.t}" role="button" tabindex="0" aria-label="Pivot, turn ${S.pivot.t}"><line x1="${x(S.pivot.t - 0.5).toFixed(1)}" x2="${x(S.pivot.t - 0.5).toFixed(1)}" y1="${tp}" y2="${H - bm}" class="pvl"/><rect x="${(x(S.pivot.t - 0.5) - 19).toFixed(1)}" y="${tp - 1}" width="38" height="16" rx="8" class="tag"/><text x="${x(S.pivot.t - 0.5).toFixed(1)}" y="${tp + 10.6}" text-anchor="middle" class="tg">pivot</text><rect x="${(x(S.pivot.t - 0.5) - 20).toFixed(1)}" y="${tp - 4}" width="40" height="${H - bm - tp + 4}" class="hit"/></g>` : "";
    const used = [...new Set(icons.length ? (log.pts[q] || []).filter((e) => e.n > 0 && e.t > 0).map((e) => e.k) : [])];
    const leg = `${used.map((k) => `<span><svg viewBox="0 0 14 14" aria-hidden="true">${this._pgShape(k, 7, 7)}</svg>${SRC_NAME[k] === "Settlements" ? "Settlement" : SRC_NAME[k] === "Cities" ? "City" : SRC_NAME[k] === "Point cards" ? "Point card" : SRC_NAME[k]}</span>`).join("")}${log.builds[q].some((e) => e.k === "r") ? `<span><svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="5.7" width="10" height="2.6" rx="1.3" class="sh r"/></svg>Road</span>` : ""}${b.show.includes("stalls") && S.stretches.length ? `<span><i class="sw stall"></i>Stalled</span>` : ""}${b.show.includes("plan") && S.first2.length === 2 ? `<span><i class="sw plan"></i>Plan</span>` : ""}`;
    return `<div class="pg-vz"><svg viewBox="0 0 ${W} ${H}" class="pg-svg pts pc-${q}" role="img" aria-label="Points by turn"><text x="${l - 5}" y="10" class="axl" text-anchor="start">Points</text>${bands}${grid}<path d="${d}" class="ln"/>${icons.join("")}${this._pgAxis(l, W - r, 0, T, H, bm, x, tick(T))}${pivot}</svg><div class="pg-leg sh">${leg}</div></div>`;
  },
  _pgBars(b, fx) {
    const rows = b.rows.map((r) => ({ q: fx.seatOf(r.player), v: fx.ref(r.ref)?.v })).filter((r) => r.v != null);
    const pct = b.rows.some((r) => /^luck\./.test(r.ref)), mx = Math.max(1e-9, ...rows.map((r) => Math.abs(r.v))), dv = b.diverging;
    const out = rows.map((r) => { const w = Math.max(1.5, (Math.abs(r.v) / mx) * (dv ? 50 : 100)), tx = pct ? `${sg(r.v)}%` : String(r.v);
      return `<div class="pg-br pc-${r.q}${r.q === fx.me ? " me" : ""}"><span class="n">${esc(fx.nameOf(r.q))}</span><span class="tr${dv ? " dv" : ""}"><i class="${r.v < 0 ? "neg" : "pos"}" style="${dv ? (r.v < 0 ? `right:50%;` : `left:50%;`) : "left:0;"}width:${w.toFixed(1)}%"></i></span><b class="${pct ? (r.v > 0 ? "up" : r.v < 0 ? "dn" : "") : ""}">${tx}</b></div>`; }).join("");
    return `<div class="pg-vz pg-bars">${out}${b.unit ? `<div class="pg-unit">${esc(b.unit)}</div>` : ""}</div>`;
  },
  _pgHand(b, fx) {
    const q = fx.seatOf(b.player), S = fx.strat[q], log = fx.log; if (!S || !log) return "";
    const T = fx.T, W = 320, H = 150, l = 30, r = 10, tp = 20, bm = 40, hand = S.hand, mx = Math.max(6, ...hand.slice(1, T)), top = Math.ceil(mx / 2) * 2;
    const bw = (W - l - r) / T, x = (t) => l + (t - 0.5) * bw, y = (v) => H - bm - (v / top) * (H - tp - bm), st = new Set(S.stalled);
    const bars = []; for (let t = 1; t <= T; t++) bars.push(`<rect x="${(x(t) - bw * 0.36).toFixed(1)}" y="${y(hand[t]).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${Math.max(0.5, H - bm - y(hand[t])).toFixed(1)}" rx="1.5" class="hb${st.has(t) ? " st" : ""}"/>`);
    const bt = new Set(log.builds[q].filter((e) => e.t > 0).map((e) => e.t)), dotsv = [...bt].map((t) => `<circle cx="${x(t).toFixed(1)}" cy="${H - bm + 22}" r="2.6" class="bd"/>`).join("");
    const grid = [0, top / 2, top].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${l - 5}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" class="ax">${v}</text>`).join("");
    let ax = ""; const step = tick(T); for (let t = step; t <= T; t += step) ax += `<text x="${x(t).toFixed(1)}" y="${H - bm + 12}" text-anchor="middle" class="ax">${t}</text>`;
    return `<div class="pg-vz"><svg viewBox="0 0 ${W} ${H}" class="pg-svg pgh" role="img" aria-label="Cards in hand by turn"><text x="${l - 5}" y="10" class="axl" text-anchor="start">Cards in hand</text>${grid}${bars.join("")}${ax}<text x="${W - r}" y="${H - bm + 12}" text-anchor="end" class="axl" dy="0"></text><text x="${W - r}" y="${H - 1}" text-anchor="end" class="axl">Turn</text>${dotsv}</svg><div class="pg-leg"><span><i class="sw st"></i>Stalled</span><span><i class="sw ot"></i>Other turns</span><span><i class="sw bd"></i>Built something</span></div></div>`;
  },
  _pgRolls(fx) {
    const d = fx.dice; if (!d?.N) return "";
    const W = 320, H = 132, l = 30, r = 10, tp = 20, bm = 24, ks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], exp = ks.map((k) => (d.N * PIPS[k]) / 36), act = ks.map((k) => d.counts[k] || 0), top = Math.ceil(Math.max(...exp, ...act) / 2) * 2 || 2;
    const bw = (W - l - r) / ks.length, y = (v) => H - bm - (v / top) * (H - tp - bm);
    const bars = ks.map((k, i) => { const cx = l + (i + 0.5) * bw; return `<rect x="${(cx - bw * 0.34).toFixed(1)}" y="${y(act[i]).toFixed(1)}" width="${(bw * 0.68).toFixed(1)}" height="${Math.max(0.5, H - bm - y(act[i])).toFixed(1)}" rx="2" class="rb"/><line x1="${(cx - bw * 0.42).toFixed(1)}" x2="${(cx + bw * 0.42).toFixed(1)}" y1="${y(exp[i]).toFixed(1)}" y2="${y(exp[i]).toFixed(1)}" class="eb"/><text x="${cx.toFixed(1)}" y="${H - bm + 13}" text-anchor="middle" class="ax">${k}</text>`; }).join("");
    const grid = [0, top / 2, top].map((v) => `<line x1="${l}" x2="${W - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${l - 5}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" class="ax">${v}</text>`).join("");
    return `<div class="pg-vz"><svg viewBox="0 0 ${W} ${H}" class="pg-svg rolls" role="img" aria-label="Dice rolls"><text x="${l - 5}" y="10" class="axl" text-anchor="start">Times rolled</text>${grid}${bars}<text x="${W - r}" y="${H - 1}" text-anchor="end" class="axl">Dice number</text></svg><div class="pg-leg"><span><i class="sw rb"></i>Rolled</span><span><i class="sw eb"></i>Expected</span></div></div>`;
  },
  _pgStack(b, fx) {
    const q = fx.seatOf(b.player), log = fx.log; if (!log) return "";
    const goal = this.winPoints || 10, cells = [];
    (log.pts[q] || []).slice().sort((a, c) => a.t - c.t).forEach((e) => { if (e.n > 0) for (let i = 0; i < e.n; i++) cells.push(e.k); else for (let i = 0; i < -e.n; i++) { const j = cells.lastIndexOf(e.k); if (j >= 0) cells.splice(j, 1); } });
    const have = cells.length, n = Math.max(goal, have), cnt = {}; cells.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; });
    const grid = Array.from({ length: n }, (_, i) => (i < have ? `<span class="pg-cell ${SRC_CLASS[cells[i]]}">${i + 1}</span>` : `<span class="pg-cell need">${i + 1}</span>`)).join("");
    const leg = Object.entries(cnt).map(([k, v]) => `<span><i class="sw ${SRC_CLASS[k]}"></i>${SRC_NAME[k]} <b>${v}</b></span>`).join("");
    return `<div class="pg-vz pg-stack"><div class="pg-cap">Points by source</div><div class="pg-cells">${grid}</div><div class="pg-sub">${have} of ${goal}${have < goal ? " (dashed: still needed)" : ""}</div><div class="pg-leg">${leg}</div></div>`;
  },
  _pgTiles(b, fx) {
    return `<div class="pg-tiles n${b.items.length}">${b.items.map((it) => {
      if (it.kind === "num") {
        const v = fx.ref(it.ref)?.v, of = it.of ? fx.ref(it.of)?.v : null, sub = it.sub && it.subIf && fx.ref(it.subIf) ? this._pgParts(it.sub, fx) : "";
        return `<div class="pg-tile"><small>${esc(it.label)}</small><div><b class="big">${v}</b>${of != null ? `<span class="of">of ${of}</span>` : ""}</div>${sub ? `<div class="sb">${sub}</div>` : ""}</div>`;
      }
      if (it.kind === "startfeed") {
        const q = fx.seatOf(it.player), S = fx.strat[q], dt = S?.startDots; if (!dt) return "";
        const mx = Math.max(6, ...R5.map((r) => dt[r])), need = new Set(S.need), word = S.feeds === "yes" ? "Yes" : S.feeds === "partly" ? "Partly" : "No";
        return `<div class="pg-tile"><small>Start feeds the plan</small><div class="pg-feed"><span class="bars">${R5.map((r) => `<span class="rb ${need.has(r) ? "need" : ""}"><i class="r-${r}" style="height:${Math.max(3, (dt[r] / mx) * 26).toFixed(0)}px"></i><em>${RES_ABBR[r]}</em></span>`).join("")}</span><b class="fd ${S.feeds}">${word}</b></div></div>`;
      }
      if (it.kind === "miss") { const n = fx.ref("near.n")?.v, res = fx.ref("near.res")?.v; return `<div class="pg-tile"><small>Short at the end</small><div><b class="big">${n}</b><span class="of">${esc(res)}</span></div></div>`; }
      return "";
    }).join("")}</div>`;
  },
  _pgBadge(b, fx) {
    const q = fx.seatOf(b.player), S = fx.strat[q]; if (!S?.verdict) return "";
    return `<div class="pg-badges"><span class="pg-badge ${S.verdict.tone}">${dots(S.verdict.dots)}${esc(S.verdict.label)}</span>${S.headless ? `<span class="pg-badge bad solo">Headless chicken</span>` : ""}</div>`;
  },
  _pgTable(fx) {
    const L = fx.luck; if (!L) return "";
    const c = (v) => `<td class="${v > 0 ? "up" : v < 0 ? "dn" : ""}">${v ? sg(v) : "0"}</td>`;
    return `<div class="pg-vz"><table class="pg-tb"><thead><tr><th></th><th>Dice</th><th>Steals</th><th>Cards</th><th>Seat</th></tr></thead><tbody>${fx.players.map((p) => `<tr class="pc-${p.seat}"><th><span class="pg-pl pc-${p.seat}">${esc(p.name)}</span></th>${c(L.rows[p.seat].dice)}${c(L.rows[p.seat].steal)}${c(L.rows[p.seat].draw)}${c(L.rows[p.seat].seat)}</tr>`).join("")}</tbody></table><div class="pg-unit">win chance gained or lost to chance</div></div>`;
  },
  /** compare and board reuse the tab's existing blocks (src/review/ai-blocks.js) for the decision of that turn. */
  _pgBlockOf(raw, fx) {
    const C = this._aiCtx(), env = this._aiBkEnv({ evRaw: [] }, C), bl = tryv(() => aiBlocks([raw], env), []); return { C, b: bl[0] || null };
  },
  _pgCompare(b, fx, bkey) {
    const d = fx.decAt(b.dec), { C, b: blk } = this._pgBlockOf({ type: "compare", turn: b.dec, options: [{ ref: "played" }, { ref: "best" }] }, fx); if (!blk) return "";
    const html = this._aiBlockHtml(blk, { chg: [{ move: true }] }, C, bkey), why = d && this._rvIsYou(C.pid) && tryv(() => this._exCan?.(d.e.d)) ? `<div class="pg-acts"><button type="button" class="pg-btn" data-pgwhy="${b.dec}">Why?</button></div>` : "";
    return `${html}${why}`;
  },
  _pgBoard(b, fx, bkey) {
    const { C, b: blk } = this._pgBlockOf({ type: "board", turn: b.turn, marks: [{ kind: "played", at: "played" }, { kind: "best", at: "best" }] }, fx); if (!blk) return "";
    return this._aiBlockHtml(blk, { chg: [] }, C, bkey);
  },

  // ── interaction ──
  _pgBind(body) {
    if (!body.querySelector("[data-pg]")) return;
    const { fx } = this._pgState();
    if (body._pgH) body.removeEventListener("click", body._pgH);
    if (body._pgK) body.removeEventListener("keydown", body._pgK);
    const h = (e) => {
      const el = e.target.closest?.("[data-pgturn]"); if (el) { e.stopPropagation(); this._pgSheet(+el.dataset.pgturn); return; }
      const why = e.target.closest?.("[data-pgwhy]"); if (why) { e.stopPropagation(); this._aiNav(() => this._rcGoTurn(+why.dataset.pgwhy, null, true)); return; }
      const more = e.target.closest?.("[data-pgmore]"); if (more) { e.stopPropagation(); const rest = body.querySelector("[data-pgrest]"); rest.hidden = false; more.closest("[data-pgmorebox]").remove(); this._pgWire(rest); return; }
      const card = e.target.closest?.(".pg-c.exp");
      if (card && !e.target.closest("button:not([data-pgtoggle]), a, svg .mk, [data-aipl], .ai-bd")) { e.stopPropagation(); this._pgToggle(card, body, fx); }
    };
    const k = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest?.("[data-pgturn]") && e.target.getAttribute("role") === "button") { e.preventDefault(); this._pgSheet(+e.target.closest("[data-pgturn]").dataset.pgturn); } };
    body._pgH = h; body._pgK = k; body.addEventListener("click", h); body.addEventListener("keydown", k);
    this._pgWire(body);
    if (this._pgSheetT != null && this._rvEl) this._pgSheet(this._pgSheetT, true);
  },
  /** Wire what the shared handlers do not: the player links of the page (the existing data-aipl). */
  _pgWire(root) {
    root.querySelectorAll("[data-aipl]:not([data-pgw])").forEach((b) => { b.dataset.pgw = "1"; b.addEventListener("click", (e) => { e.stopPropagation(); this._aiNav(() => this._aiPlayer(+b.dataset.aipl)); }); });
    this._aiBoards(root);
  },
  _pgToggle(card, body, fx, force = null) {
    const open = force ?? !card.classList.contains("open"), ex = card.querySelector("[data-pgex]"); if (!ex) return;
    if (open) {
      body.querySelectorAll(".pg-c.open").forEach((c) => { if (c !== card) this._pgToggle(c, body, fx, false); }); // accordion: one open
      const w = this._pgX.get(card.dataset.pgc); if (!ex.dataset.f) { ex.innerHTML = this._pgExpandHtml(w, fx); ex.dataset.f = "1"; }
      ex.hidden = false; card.classList.add("open"); this._pgWire(ex);
    } else { ex.hidden = true; card.classList.remove("open"); }
    const bt = card.querySelector("[data-pgtoggle]"); if (bt) bt.setAttribute("aria-expanded", String(open));
  },
  /** The bottom sheet of a turn, from the facts: what happened, win chance before and after, previous / next, and a button for every card that mentions it. */
  _pgSheet(t, keep = false) {
    const el = this._rvEl, { fx, page } = this._pgState(); if (!el) return;
    t = Math.max(1, Math.min(fx.T, t)); this._pgSheetT = t;
    let sh = el.querySelector("[data-pgsheet]");
    if (!sh) { sh = document.createElement("div"); sh.className = "pg-sheetw"; sh.dataset.pgsheet = "1"; el.appendChild(sh); sh.addEventListener("click", (e) => { if (e.target === sh) this._pgClose(); }); }
    const seats = fx.players.map((p) => p.seat), moved = seats.map((q) => ({ q, c: fx.change(q, t) })).filter((x) => x.c), me = fx.me;
    const rows = [moved.find((x) => x.q === me), moved.filter((x) => x.q !== me).sort((a, b) => Math.abs(b.c.d) - Math.abs(a.c.d))[0]].filter(Boolean);
    const lines = []; const seenQ = new Set();
    [me, ...moved.filter((x) => x.q !== me).sort((a, b) => Math.abs(b.c.d) - Math.abs(a.c.d)).map((x) => x.q)].slice(0, 2).forEach((q) => { const c = fx.cause(t, q); if (c && !seenQ.has(`${c.actor}${c.text}`)) { seenQ.add(`${c.actor}${c.text}`); lines.push(`<span class="pg-pl pc-${c.actor}">${esc(fx.nameOf(c.actor))}</span> ${esc(c.text)}.`); } });
    const ev = fx.log ? fx.players.flatMap((p) => fx.log.builds[p.seat].filter((b) => b.t === t && (b.k === "s" || b.k === "c")).map((b) => `<span class="pg-pl pc-${p.seat}">${esc(p.name)}</span> built a ${b.k === "c" ? "city" : "settlement"}.`)) : [];
    const plain = (h) => h.replace(/<[^>]+>/g, ""), have = new Set(lines.map(plain));
    ev.filter((l) => !have.has(plain(l))).slice(0, Math.max(0, 3 - lines.length)).forEach((l) => lines.push(l));
    const widgets = page.widgets.filter((w) => turnsOf(w, fx).includes(t));
    sh.innerHTML = `<div class="pg-sheet" role="dialog" aria-modal="true" aria-label="Turn ${t}"><i class="grab" aria-hidden="true"></i>
      <div class="pg-sh-h"><button type="button" class="pg-nav" data-pgprev aria-label="Previous turn"${t <= 1 ? " disabled" : ""}><svg viewBox="0 0 14 14"><path d="M9 2L4 7l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><b>Turn ${t}</b><button type="button" class="pg-nav" data-pgnext aria-label="Next turn"${t >= fx.T ? " disabled" : ""}><svg viewBox="0 0 14 14"><path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="pg-sh-l">${lines.length ? lines.map((l) => `<p>${l}</p>`).join("") : `<p class="mut">Nothing moved much this turn.</p>`}</div>
      ${rows.length ? `<div class="pg-sh-k">Win chance in this turn</div>${rows.map(({ q, c }) => `<div class="pg-sh-r pc-${q}"><span class="n"><i></i>${esc(fx.nameOf(q))}</span><span class="tr"><i style="width:${Math.max(1, c.to)}%"></i></span><span class="ft">${c.from}% → <b>${c.to}%</b> <em class="${c.d > 0 ? "up" : c.d < 0 ? "dn" : ""}">${sg(c.d)}%</em></span></div>`).join("")}` : ""}
      <div class="pg-sh-a">${widgets.map((w) => `<button type="button" class="pg-btn" data-pgopen="${esc(w.id)}">Open ${esc(w.short)}<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}<button type="button" class="pg-btn" data-pgturnview>Show the board</button><button type="button" class="pg-btn pg-close" data-pgclose>Close</button></div></div>`;
    const go = (d) => this._pgSheet(t + d, true);
    sh.querySelector("[data-pgprev]").onclick = () => go(-1); sh.querySelector("[data-pgnext]").onclick = () => go(1);
    sh.querySelector("[data-pgclose]").onclick = () => this._pgClose();
    sh.querySelector("[data-pgturnview]").onclick = () => { this._pgClose(); this._aiNav(() => this._rcGoTurn(t, null, false)); };
    sh.querySelectorAll("[data-pgopen]").forEach((b) => { b.onclick = () => { const id = b.dataset.pgopen, body = this._rvEl.querySelector("[data-aibody]"); this._pgClose(); this._pgRevealCard(body, id); }; });
    sh.querySelector(".pg-sheet").onkeydown = (e) => { if (e.key === "Escape") this._pgClose(); };
    // matching cards get a dashed outline, matching pills glow, while the sheet is open
    const body = el.querySelector("[data-aibody]");
    body?.querySelectorAll(".pg-c").forEach((c) => c.classList.toggle("match", widgets.some((w) => w.id === c.dataset.pgc)));
    body?.querySelectorAll("[data-pgturn]").forEach((p) => p.classList.toggle("glow", +p.dataset.pgturn === t));
    if (!keep) { requestAnimationFrame(() => sh.classList.add("on")); sh.querySelector("[data-pgclose]").focus?.({ preventScroll: true }); } else sh.classList.add("on");
  },
  _pgClose() {
    const el = this._rvEl, sh = el?.querySelector("[data-pgsheet]"); this._pgSheetT = null;
    if (sh) { sh.classList.remove("on"); setTimeout(() => sh.remove(), 200); }
    el?.querySelectorAll(".pg-c.match, .pg-t.glow, .mk.glow").forEach((c) => c.classList.remove("match", "glow"));
  },
  /** Scroll to a card (showing it first when it sits behind More), expand it, one pulse. */
  _pgRevealCard(body, id) {
    if (!body) return; const rest = body.querySelector("[data-pgrest]");
    if (rest?.hidden && rest.querySelector(`[data-pgc="${CSS.escape(id)}"]`)) { rest.hidden = false; body.querySelector("[data-pgmorebox]")?.remove(); this._pgWire(rest); }
    const c = body.querySelector(`[data-pgc="${CSS.escape(id)}"]`); if (!c) return;
    const { fx } = this._pgState(); if (c.classList.contains("exp") && !c.classList.contains("open")) this._pgToggle(c, body, fx, true);
    c.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); c.classList.remove("pulse"); void c.offsetWidth; c.classList.add("pulse");
  },
};
export { LEVELS };
