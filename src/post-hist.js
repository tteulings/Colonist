// v1.99 Post-game UI, part 3: Terugblik (History: one Games | Lessons door, progress with a scrub chart, "Most missed", unfoldable game rows),
// the Bots page (Strength ladder, Precision, You vs them) and Bekijk bord (the board at the start and at every key moment).
import { esc, IC } from "./review-ui.js";
import { f, D, RES_NAME, spotTiles } from "./post-ui.js";
import { modelOf, tableOf, ptsAtStep, boardFor } from "./post-model.js";
import { stdGeo, hexCorners } from "./lessons-geo.js";
import { RES_COLOR } from "./resources.js";
import { youVsLevels, wilsonPct } from "./review/analysis-facts.js";
import { BOT_PROFILES as P, profileMini } from "./bot-profiles.js";
import { BOT_STATS, accOf, winOf, MEASURED_TABS, FAIR } from "./bot-stats.js";
import { listBots } from "./bots/registry.js";
import { scatterSvg, YOU_MIN } from "./bots-page.js";

const KEYS = listBots({ order: "page" }).map((e) => e.id);
const accWord = "Accuracy";

// ── the door ──
const door = (on) => `<div class="px-door" role="group" aria-label="Terugblik"><button type="button" class="${on === "games" ? "on" : ""}" aria-pressed="${on === "games"}" data-pxdoor="games">Games</button><button type="button" class="${on === "lessons" ? "on" : ""}" aria-pressed="${on === "lessons"}" data-pxdoor="lessons">Lessons</button></div>`;
function bindDoor(g, el, on) {
  el.querySelectorAll("[data-pxdoor]").forEach((b) => b.addEventListener("click", () => {
    const to = b.dataset.pxdoor; if (to === on) return;
    if (to === "lessons") { g.histClose(); g.lessonsOpen(); } else { g.lessonsClose(); g.histOpen(); }
  }));
}
function injectDoor(g, el, on) {
  if (!el || el.querySelector(".px-door")) return;
  const bar = el.querySelector(".hs-bar"); if (!bar) return;
  bar.insertAdjacentHTML("afterend", door(on)); bindDoor(g, el, on);
}

// ── progress ──
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function progress(g, all) {
  const ents = g._histEntries(all).filter((e) => e.who === (g._histWho || "You") || true);
  const mine = ents.filter((e) => e.who === (ents[0]?.who));
  const rev = mine.filter((m) => m.acc != null && !m.prov).sort((a, b) => a.end - b.end);
  const fin = mine.filter((m) => m.result === "won" || m.result === "lost");
  if (!fin.length && !rev.length) return "";
  const won = fin.filter((m) => m.result === "won").length;
  const per = rev.map((m) => (m.cls ? (m.cls.lean || 0) + (m.cls.could || 0) + (m.cls.missed || 0) + (m.cls.mistake || 0) + (m.cls.blunder || 0) : null)).filter((v) => v != null);
  const tiles = `<div class="px-tiles"><div><b>${rev.length ? Math.round(avg(rev.map((m) => m.acc))) : "–"}</b><small>${rev.length ? (rev.length === 1 ? f("{x} over 1 game", { x: accWord }) : f("{x} over {n} games", { x: accWord, n: rev.length })) : accWord}</small></div><div><b>${won}/${fin.length}</b><small>won</small></div><div><b>${per.length ? (Math.round(avg(per) * 10) / 10) : "–"}</b><small>marked moves per game</small></div></div>`;
  let chart = "";
  if (rev.length >= 2) {
    const v = rev.slice(-12), W = 320, H = 110, x0 = 28, x1 = W - 8, top = 10, bot = H - 14, lo = Math.floor(Math.min(...v.map((m) => m.acc), 60) / 10) * 10, hi = Math.min(100, Math.ceil(Math.max(...v.map((m) => m.acc), 80) / 10) * 10);
    const X = (i) => x0 + 6 + (i / (v.length - 1)) * (x1 - x0 - 12), Y = (a) => top + (1 - (a - lo) / (hi - lo)) * (bot - top);
    const sel = Math.min(g._pxHsel ?? v.length - 1, v.length - 1), s = v[sel];
    const grid = [lo, Math.round((lo + hi) / 2), hi].map((t) => `<line x1="${x0}" x2="${x1}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" class="g"/><text x="${x0 - 4}" y="${(Y(t) + 3.5).toFixed(1)}" text-anchor="end">${t}</text>`).join("");
    const line = v.map((m, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(m.acc).toFixed(1)}`).join("");
    const marks = v.map((m, i) => `<g data-pxmk="${i}" class="mk${i === sel ? " on" : ""}"><circle cx="${X(i).toFixed(1)}" cy="${Y(m.acc).toFixed(1)}" r="${i === sel ? 7 : 5}" class="${m.result}"/><rect x="${(X(i) - 14).toFixed(1)}" y="0" width="28" height="${H}" fill="transparent"/></g>`).join("");
    chart = `<svg viewBox="0 0 ${W} ${H}" class="px-sc" role="img" aria-label="${esc(f("{x} of your last {n} reviewed games, oldest first", { x: accWord, n: v.length }))}">${grid}<path d="${line}" class="ln"/>${marks}</svg><p class="px-fn">${f("Game {n}: {x} {y}", { n: sel + 1, x: accWord, y: s.acc })} · ${s.result === "won" ? "won" : "lost"}</p>`;
  }
  const mist = {}; let m2 = 0; rev.forEach((m) => Object.entries(m.mist || {}).forEach(([k, n]) => { mist[k] = (mist[k] || 0) + n; m2 += n; }));
  const top = Object.entries(mist).sort((a, b) => b[1] - a[1])[0];
  const dots = top && m2 >= 3 ? `<div class="px-mm"><b>Most missed</b><span class="px-mdots" aria-hidden="true">${rev.slice(-10).map((m) => `<i class="${(m.mist?.[top[0]] || 0) ? "on" : ""}"></i>`).join("")}</span><small>${esc(({ "end>build": "ended your turn while a build was possible", build: "built something weaker", bank: "a weaker bank trade", robber: "a weaker robber tile", setup: "a weaker set-up spot" })[top[0]] || top[0])}</small></div>` : "";
  return `<section class="px-card px-prog rv-card"><div class="rv-gt"><b>Your progress</b></div>${tiles}${chart}${dots}</section>`;
}

// ── a game row that unfolds ──
function gameRow(g, m) {
  const w = m.seats?.[m.winner], t = m.result === "won" ? f("Won with {n} points", { n: m.seats[m.me].vp }) : m.result === "lost" ? f("Lost to {x}", { x: esc(w?.name || "a bot") }) : f("{x} won the game", { x: esc(w?.name || "?") });
  const kind = m.board === "seafarers" ? "Seafarers" : m.mode === "rush" ? "Rush" : "Classic";
  const open = g._pxHopen === m.id;
  const pts = (m.seats || []).map((s, i) => `<span class="px-hp pc-${i}"><i></i>${s.vp}</span>`).join("");
  return `<li class="px-hg${open ? " open" : ""}"><div class="hs-row ${m.result}"><button type="button" class="px-hh" data-pxhg="${m.id}" aria-expanded="${open}"><span class="mn"><b>${t}</b><small>${new Date(m.end).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${kind}</small></span>${m.acc != null ? `<span class="px-chip"><small>${accWord}</small><b>${m.acc}</b></span>` : ""}<svg class="px-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
    ${open ? `<div class="px-hb"><div class="px-hps">${pts}</div><div class="px-hbtn"><button type="button" class="px-btn pri" data-pxhopen="${m.id}">Open</button></div></div>` : ""}</div></li>`;
}

export function installPostHist(Cls) {
  const P0 = Cls.prototype;
  const wrap = (name, fn) => { const orig = P0[name]; P0[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  P0._histProgress = function (all) { return progress(this, all); };
  P0._histRow = function (m) { return gameRow(this, m); };
  wrap("_histDraw", async function (orig, ...a) {
    const r = await orig.apply(this, a); const el = this._histEl; if (!el) return r;
    injectDoor(this, el, "games");
    el.querySelectorAll("[data-pxhg]").forEach((b) => b.addEventListener("click", () => { this._pxHopen = this._pxHopen === b.dataset.pxhg ? null : b.dataset.pxhg; this._histDraw(); }));
    el.querySelectorAll("[data-pxhopen]").forEach((b) => b.addEventListener("click", () => this._histSheet(b.dataset.pxhopen)));
    el.querySelectorAll("[data-pxmk]").forEach((b) => b.addEventListener("click", () => { this._pxHsel = +b.dataset.pxmk; this._histDraw(); }));
    return r;
  });
  wrap("_lnDraw", function (orig, ...a) {
    const r = orig.apply(this, a); const el = this._lnEl;
    if (el && this._ln?.view === "home") injectDoor(this, el, "lessons");
    return r;
  });
  // the Bots page: Strength | Precision | You vs them
  P0._botsDraw = function (keep = true) { return botsDraw(this, keep); };
  const click = P0._botsClick;
  P0._botsClick = function (e) { const b = e.target.closest?.("[data-pxseg]"); if (b) { this._bpg.seg = b.dataset.pxseg; return this._botsDraw(); } return click.call(this, e); };
  P0._pxBoard = function (T) { return board(this, T); };
  P0._pxPractise = function () { this._rvCloseReview?.(true); this.lessonsOpen?.(); };
}

// ── Bots ──
const TABS = [["classic", "Classic"], ["rush", "Rush"], ["five", "5 players"], ["six", "6 players"], ["sea", "Seafarers"]];
function botsDraw(g, keep) {
  const el = g._bpgEl; if (!el) return;
  const S = g._bpg, seg = S.seg || "strength", tab = S.tab || "classic", measured = MEASURED_TABS.has(tab), top = el.querySelector(".hs-scroll")?.scrollTop || 0;
  const W = Math.max(280, Math.min(460, el.clientWidth - 24) - 30);
  const metas = (g.hist?.metas || []).filter((m) => m.me != null && m.result);
  const mine = metas.filter((m) => m.n === 4 && m.mode !== "rush" && m.board !== "seafarers");
  const rows = KEYS.map((key) => ({ key, p: P[key], win: tab === "classic" ? BOT_STATS[key]?.win : winOf(key, tab), acc: accOf(key, P[key].label) })).filter((r) => r.win?.v != null);
  const sorted = [...rows].sort((a, b) => b.win.v - a.win.v);
  const fair = FAIR[tab] ?? 25;
  const youN = mine.length, youWon = mine.filter((m) => m.result === "won").length, youPct = youN >= YOU_MIN ? Math.round((100 * youWon) / youN) : null;
  const sc = (v) => Math.max(0, Math.min(100, v * 2)); // 0..50% on the bar
  const ladder = !measured ? `<section class="px-card rv-card"><b>Not measured yet</b><p class="px-l">There is no ranking for this game type yet.</p></section>` : (() => {
    const you = youPct != null ? sorted.findIndex((r) => r.win.v < youPct) : -1, list = sorted.map((r) => r);
    if (youPct != null) list.splice(you < 0 ? list.length : you, 0, { you: true });
    const body = list.map((r, i) => r.you ? `<div class="px-bl you"><span class="rk">–</span><i class="dia" aria-hidden="true"></i><span class="nm"><b>You</b><small>${youN} games</small></span><span class="wh"><i class="fair" style="left:${sc(fair)}%"></i><i class="me" style="left:${sc(youPct)}%"></i></span><b class="v">${youPct}%</b></div>`
      : `<button type="button" class="px-bl" data-open="${r.key}"><span class="rk">${i + 1}</span><span class="bpg-em">${profileMini(r.key, 28)}</span><span class="nm"><b>${esc(r.p.label)}</b><small class="dots" aria-label="${esc(f("strength {n} of 5", { n: r.p.level || 0 }))}">${"●".repeat(r.p.level || 0)}</small></span><span class="wh"><i class="fair" style="left:${sc(fair)}%"></i>${r.win.ci ? `<i class="ci" style="left:${sc(Math.max(0, r.win.v - r.win.ci))}%;width:${sc(Math.min(50, r.win.v + r.win.ci) - Math.max(0, r.win.v - r.win.ci))}%"></i>` : ""}<i class="pt" style="left:${sc(r.win.v)}%"></i></span><b class="v">${Math.round(r.win.v * 10) / 10}%</b></button>`).join("");
    return `<section class="px-card rv-card"><div class="rv-gt"><b>Strength ladder</b><small>wins in 100 games; 25 is an even share</small></div>${body}</section>`;
  })();
  const prec = !measured ? "" : `<section class="px-card rv-card"><div class="rv-gt"><b>Precision</b><small>how often a bot plays near the best move</small></div>${rows.filter((r) => r.acc.v != null).sort((a, b) => b.acc.v - a.acc.v).map((r) => `<button type="button" class="px-bl" data-open="${r.key}"><span class="bpg-em">${profileMini(r.key, 28)}</span><span class="nm"><b>${esc(r.p.label)}</b><small>${f("usual {n}–{n2}", { n: Math.round(r.acc.v - r.acc.se), n2: Math.round(r.acc.v + r.acc.se) })}</small></span><span class="wh"><i class="ci" style="left:${r.acc.v - r.acc.se}%;width:${2 * r.acc.se}%"></i><i class="pt" style="left:${r.acc.v}%"></i></span><b class="v">${Math.round(r.acc.v)}</b></button>`).join("")}</section><section class="px-card rv-card px-scat"><div class="rv-gt"><b>Strength against precision</b></div><p class="px-l">Do the strong bots also play clean? Tap a bot.</p>${scatterSvg(W, S.sel)}</section>`;
  const vs = (() => {
    const L = youVsLevels(mine);
    if (!L.length) return `<section class="px-card rv-card"><div class="rv-gt"><b>You vs them</b></div><p class="px-l">No games against the bots yet.</p><p class="px-fn">Play and review a few games. For each bot level you see how many you won, and a range once you have played 5 games against it.</p></section>`;
    const row = (r) => { const label = P[r.level]?.label || r.level, few = r.n < YOU_MIN; return `<div class="px-vs${few ? " few" : ""}"><span class="nm"><b>${esc(label)}</b><small><span>${f("won {n} of {n2}", { n: r.won, n2: r.n })}</span>${r.acc != null ? ` · <span>${accWord} ${r.acc}</span>` : ""}</small></span>${few ? `<span class="wh dim"><i class="fair" style="left:${sc(fair)}%"></i></span><b class="v dim">–</b><em class="few">too few games</em>` : `<span class="wh"><i class="fair" style="left:${sc(fair)}%"></i><i class="ci" style="left:${Math.min(98, r.lo)}%;width:${Math.max(2, r.hi - r.lo)}%"></i><i class="pt" style="left:${Math.min(100, r.pct)}%"></i></span><b class="v">${r.pct}%</b>`}</div>`; };
    return `<section class="px-card rv-card"><div class="rv-gt"><b>You vs them</b><small>per level</small></div>${L.map(row).join("")}<p class="px-fn">A range appears from 5 games per level: the likely range of your true win rate. The tick marks an even share.</p></section>`;
  })();
  const segs = [["strength", "Strength"], ["precision", "Precision"], ["you", "You vs them"]];
  el.innerHTML = `<div class="hs-bar"><button type="button" class="hs-x" data-bclose aria-label="Back">${IC.back}</button><div><h3>Bots</h3><small>How strong is which bot?</small></div></div>
    <div class="hs-scroll"><div class="px-bots"><div class="bpg-tabs" role="tablist" aria-label="Game type">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-btab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="px-seg wide" role="group" aria-label="View">${segs.map(([k, l]) => `<button type="button" class="${k === seg ? "on" : ""}" aria-pressed="${k === seg}" data-pxseg="${k}">${l}</button>`).join("")}</div>
    ${seg === "strength" ? ladder : seg === "precision" ? prec : vs}</div></div>`;
  if (keep) el.querySelector(".hs-scroll").scrollTop = top;
}

// ── Bekijk bord ──
const SEAT = ["#D1453A", "#3F7FD6", "#E89B2D", "#2F8F6B", "#8C5AC8", "#8A8F94"];
function board(g, T0) {
  const R = g._rv, pid = g._rvPid ?? 0; let m = null; try { m = modelOf(g, pid); } catch (_) { m = null; }
  const bd = boardFor(g), st = g._st; if (!bd || !st || !m) { g._toast?.("The board view needs the standard island and a finished review."); return; }
  g._pxBoardEl?.remove();
  const geo = stdGeo(), stops = [{ T: 0, label: "Start" }, ...(m.timeline?.pins || []).map((p) => ({ T: p.T, label: f("Turn {n}", { n: p.T }), say: p.say, n: p.n }))];
  let cur = Math.max(0, stops.findIndex((s) => s.T === (T0 ?? 0)));
  const el = document.createElement("div"); el.className = "px-board tm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Bekijk bord");
  (g._rvEl || document.body).appendChild(el); g._pxBoardEl = el;
  const col = (q) => (getComputedStyle(document.documentElement).getPropertyValue(`--p${q}`).trim() || SEAT[q]);
  const draw = () => {
    const s = stops[cur], S = 30; const xs = geo.hexes.flatMap((h) => hexCorners(h)).map((q) => q.x * S), ys = geo.hexes.flatMap((h) => hexCorners(h)).map((q) => q.y * S);
    const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6, W = Math.max(...xs) - x0 + 6, H = Math.max(...ys) - y0 + 6;
    const hexes = geo.hexes.map((h) => { const b = bd[h.id], c = hexCorners(h).map((q) => `${(q.x * S).toFixed(1)},${(q.y * S).toFixed(1)}`).join(" "); return `<polygon points="${c}" fill="${RES_COLOR[b.res] || "#D9C79A"}" stroke="#fff" stroke-width="2"/>${b.num ? `<circle cx="${(h.x * S).toFixed(1)}" cy="${(h.y * S).toFixed(1)}" r="10" fill="#faf3e0"/><text x="${(h.x * S).toFixed(1)}" y="${(h.y * S + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="${b.num === 6 || b.num === 8 ? "#B8312A" : "#2c1810"}">${b.num}</text>` : ""}`; }).join("");
    const own = new Map(), roads = [];
    (st.stepEvents || []).forEach((evs, k) => (evs || []).forEach((e) => { const t = k === 0 ? 0 : st.turnOf[k]; if (t > s.T && !(s.T === 0 && k === 0)) return; if (e[1] === "b") { if (e[3] === "s") own.set(e[4], [e[2], 1]); else if (e[3] === "c") own.set(e[4], [e[2], 2]); else if (e[3] === "r") roads.push([e[2], e[4]]); } }));
    const rd = roads.map(([q, id]) => { const ed = geo.edges[id]; if (!ed) return ""; const a = geo.nodes[ed.a], b2 = geo.nodes[ed.b]; return `<line x1="${(a.x * S).toFixed(1)}" y1="${(a.y * S).toFixed(1)}" x2="${(b2.x * S).toFixed(1)}" y2="${(b2.y * S).toFixed(1)}" stroke="${col(q)}" stroke-width="5" stroke-linecap="round"/>`; }).join("");
    const pcs = [...own.entries()].map(([nid, [q, k]]) => { const n = geo.nodes[nid]; return k === 2 ? `<rect x="${(n.x * S - 7).toFixed(1)}" y="${(n.y * S - 7).toFixed(1)}" width="14" height="14" fill="${col(q)}" stroke="#fff" stroke-width="2"/>` : `<circle cx="${(n.x * S).toFixed(1)}" cy="${(n.y * S).toFixed(1)}" r="6" fill="${col(q)}" stroke="#fff" stroke-width="2"/>`; }).join("");
    let rings = "";
    if (s.T === 0 && m.start?.picks) {
      rings = m.start.picks.map((p) => (p.node != null ? `<g><circle cx="${(geo.nodes[p.node].x * S).toFixed(1)}" cy="${(geo.nodes[p.node].y * S).toFixed(1)}" r="12" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="4 3"/><text x="${(geo.nodes[p.node].x * S).toFixed(1)}" y="${(geo.nodes[p.node].y * S - 15).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" stroke="#000" stroke-width=".4">${p.n}</text></g>` : "")).join("");
      const tn = m.start.picks[0]?.shortlist?.find((c) => c.best)?.node ?? m.start.picks[0]?.shortlist?.[0]?.node;
      if (tn != null) rings += `<g><circle cx="${(geo.nodes[tn].x * S).toFixed(1)}" cy="${(geo.nodes[tn].y * S).toFixed(1)}" r="13" fill="none" stroke="#F0B45C" stroke-width="3"/><text x="${(geo.nodes[tn].x * S).toFixed(1)}" y="${(geo.nodes[tn].y * S - 16).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#F0B45C" stroke="#000" stroke-width=".4">A</text></g>`;
    }
    const pk = m.start?.picks || [], top = pk[0]?.shortlist?.[0];
    const prow = (lab, node, spot, win) => `<div class="px-br"><small>${lab}</small><span class="tl">${spotTiles(bd, node)}</span><span class="dt">${spot ? f("{n} dots", { n: spot.total }) : ""}</span><b>${win ?? "–"}%</b></div>`;
    const info = s.T === 0 ? `<h4 class="px-bh">Start: your picks and the top spot</h4><p class="px-fn">1 and 2 are your picks (dashed). A is the top spot for pick 1: the best of at most 6 spots checked.</p>${pk[0] ? prow("PICK 1", pk[0].node, pk[0].spot, pk[0].win) : ""}${top ? prow("A · TOP", top.node, top.spot, top.win) : ""}${pk[1] ? prow("PICK 2", pk[1].node, pk[1].spot, pk[1].win) : ""}` : `<h4 class="px-bh">${esc(s.label)}</h4><p class="px-l"><span data-i18n-skip>${s.say || ""}</span></p>`;
    const stopLab = (q) => (q.T === 0 ? "Start" : `T${q.T}`);
    el.innerHTML = `<div class="rv-bar"><button type="button" class="rv-btn" data-pxbx aria-label="Close">${IC.back}</button><div><h3>Bekijk bord</h3><small>${s.T === 0 ? "Start: your picks" : esc(s.label)}</small></div></div><div class="rv-scroll"><section class="rv-card px-card"><svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" class="px-bd" role="img" aria-label="${esc(s.label)}">${hexes}${rd}${pcs}${rings}</svg></section>
      <section class="rv-card px-card"><div class="px-stops">${stops.map((q, i) => `<button type="button" class="${i === cur ? "on" : ""}" data-pxs="${i}">${stopLab(q)}</button>`).join("")}</div>${info}<input type="range" class="px-rng" min="0" max="${stops.length - 1}" value="${cur}" aria-label="Moment" data-pxr>
      <div class="px-pn"><button type="button" class="px-btn" data-pxpv${cur === 0 ? " disabled" : ""}>${IC.back}Previous</button><button type="button" class="px-btn" data-pxnx${cur === stops.length - 1 ? " disabled" : ""}>Next${IC.chev}</button></div></section>
      <button type="button" class="px-btn wide pxb" data-pxrev>Open the start in Review</button></div>`;
    el.querySelector("[data-pxpv]")?.addEventListener("click", () => { cur = Math.max(0, cur - 1); draw(); });
    el.querySelector("[data-pxnx]")?.addEventListener("click", () => { cur = Math.min(stops.length - 1, cur + 1); draw(); });
    el.querySelector("[data-pxrev]")?.addEventListener("click", () => { el.remove(); g._pxBoardEl = null; g._rvTab = "strategy"; g._rvDrawReview?.(); });
    el.querySelector("[data-pxbx]").addEventListener("click", () => { el.remove(); g._pxBoardEl = null; });
    el.querySelector("[data-pxr]").addEventListener("input", (ev) => { cur = +ev.target.value; draw(); });
    el.querySelectorAll("[data-pxs]").forEach((b) => b.addEventListener("click", () => { cur = +b.dataset.pxs; draw(); }));
  };
  draw();
}
export { D, RES_NAME, ptsAtStep, tableOf, wilsonPct };
