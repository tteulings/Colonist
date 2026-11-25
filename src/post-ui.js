// v1.99 Post-game UI, part 1: shared pieces, the end screen's scorecard, the Overview tab, the Numbers and (i) sheets, and the install that swaps
// the v1.98 review screens for the v1.99 ones. Moves / Strategy / Luck / player page: src/post-tabs.js. Terugblik door, Bots, Bekijk bord: src/post-hist.js.
// Every number comes from src/post-model.js (ONE model per review and player, cached); every text is English here and Dutch through the
// localizer (src/i18n-nl-199p.js). Blocks whose data is missing (old saved reviews, Rush, Seafarers, 5-6 players) are simply not drawn.
import { esc, IC } from "./review-ui.js";
import { oicon } from "./ui-icons.js";
import { CLASSES } from "./review/evaluate.js";
import { moveFull, whyLine, whyChips } from "./post-text.js";
import { isNL } from "./i18n.js";
import { tr as atr } from "./review/analysis-text.js";
import { seOf } from "./review/score.js";
import { cropSvg } from "./lessons-view.js";
import { stdGeo } from "./lessons-geo.js";
import { RES_COLOR } from "./resources.js";
import { modelOf, tableOf, hideCache, soloPid, SRC_PARTS, FAMILIES, FAMILY, kindOf, bestKindOf, buildKindAt, PHASES } from "./post-model.js";
import { tableStore, numRef } from "./post-facts.js";

// ── tiny helpers ──
export const f = (tpl, v = {}) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
export const CLS_NAME = { best: "Best", great: "Great", good: "Good", lean: "Better option", close: "Close call", could: "Could be better", mistake: "Mistake", blunder: "Blunder", missed: "Missed chance", triv: "No real choice" };
export const FAM_NAME = { strong: "Strong moves", close: "Close calls", costly: "Weaker moves" };
export const PHASE_NAME = { opening: "Opening", mid: "Midgame", end: "End game" };
export const RES_KEY = ["wood", "brick", "sheep", "wheat", "ore"];
export const RES_NAME = { wood: "lumber", brick: "brick", sheep: "wool", wheat: "grain", ore: "ore" };
export const rname = (r) => RES_NAME[r] || r;
export const infoBtn = (what) => `<button type="button" class="px-i" data-pxinfo="${what}" aria-label="About this">${IC.info}</button>`;
/** a block whose body unfolds in place: header button + body */
export const fold = (key, head, body, { open = false, cls = "" } = {}) => `<div class="px-fold ${cls}${open ? " open" : ""}" data-pxf="${key}"><button type="button" class="px-fh" data-pxtog="${key}" aria-expanded="${open}">${head}<svg class="px-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="px-fb" ${open ? "" : "hidden"}>${body}</div></div>`;
const accWord = "Accuracy";

/** the page the screens render into must exist and its model be ready: { m } or { wait } (progress card) */
export function ready(g, pid) {
  try { hideCache(g._rv); const m = modelOf(g, pid); return m ? { m } : { wait: true }; } catch (e) { console.warn("post model", e); return { wait: true, err: e }; }
}

// ── the player's name in a sentence ──
export const who = (m) => (m.you ? "You" : esc(m.me.name));
/** a seat named in a sentence: "you" on your own page; on any other page the human is "the human player" (never "you": that page is somebody else's); bots by name. lgText: already in the app language (atr texts) */
export const seatNm = (m, q, lgText = true) => { const s = m.tab?.seats?.[q]; if (q === m.pid && m.you) return lgText ? atr(isNL() ? "nl" : "en", "wf.you") : "you"; if (s?.you) return lgText ? atr(isNL() ? "nl" : "en", "wf.human") : "the human player"; return esc(s?.name || "?"); };
export const whose = (m) => (m.you ? "Your" : `${esc(m.me.name)}’s`);

// ───────────────────────── end screen: the scorecard ─────────────────────────
export function scoreHtml(g) {
  const R = g._rv;
  if (!R?.recs?.length || g._rvMid || !g.players.some((p) => !p.isHuman)) return "";
  const tab = tableOf(g), st = g._st, open = g._rsOpen != null && g.players[g._rsOpen] ? g._rsOpen : null;
  const maxV = Math.max(g.winPoints || 10, ...g.players.map((p) => p.victoryPoints));
  const used = st?.sources ? SRC_PARTS.filter(([k]) => st.sources.some((s) => s?.[k] > 0)) : [];
  const si = (q) => SRC_PARTS.findIndex(([k]) => k === q);
  const m = (() => { try { return ready(g, tab.me).m || null; } catch (_) { return null; } })();
  const X = m ? m.F : tableStore(g, tab);
  const rows = tab.order.map((id, k) => {
    const s = tab.seats[id], p = s.p, nm = s.you ? "You" : esc(s.name);
    const acc = s.acc != null ? `<span class="px-chip"><small>${accWord}</small><b${s.accDone ? "" : ' class="prov"'}>${s.accDone ? "" : "~"}${X.n(`acc:${id}`)}</b></span>`
      : s.accSt === "run" && s.running ? `<span class="px-chip wait"><small>${accWord}</small><b><i class="rv-ring" style="--p:${Math.round((100 * s.running.j) / Math.max(1, s.running.n))}%" aria-hidden="true"></i>${X.ph("{j}/{n}", { j: [`runJ:${id}`], n: [`runN:${id}`] })}</b></span>`
      : `<span class="px-chip wait"><small>${accWord}</small><b>–</b></span>`;
    const luck = s.luck != null ? `<span class="px-chip"><small>Luck</small>${X.d(`luck:${id}`)}</span>` : s.cards != null && tab.LK.na ? `<span class="px-chip"><small>Luck</small>${X.d(`cards:${id}`)}<em>cards</em></span>` : `<span class="px-chip wait"><small>Luck</small><b>–</b></span>`;
    const sc = s.src, bar = sc ? `<div class="px-src" role="img" aria-label="${esc(nm)}: ${used.filter(([q]) => sc[q] > 0).map(([q, l]) => `${l} ${sc[q]}`).join(", ")}"><div class="trk" style="--w:${Math.max(8, Math.min(100, Math.round((s.pts / maxV) * 100)))}">${used.map(([q]) => (sc[q] > 0 ? `<i class="s${si(q)}" style="flex:${sc[q]} 1 0">${X.n(`src.${q}:${id}`)}</i>` : "")).join("")}</div></div>` : "";
    const isOpen = open === id;
    let det = "";
    if (isOpen) {
      const mm = id === tab.me ? m : (() => { try { return ready(g, id).m || null; } catch (_) { return null; } })();
      const vl = mm ? verdictLine(g, mm, 62) : "";
      det = `<div class="px-rd">${!s.you && vl ? `<p class="px-l">${vl}</p>` : ""}<button type="button" class="px-link" data-rvtab="${id}">${s.you ? "Your page" : f("{x}’s page", { x: esc(s.name) })}${IC.chev}</button></div>`;
    }
    return `<div class="px-row pc-${id}${s.won ? " win" : ""}${s.you ? " me" : ""}${isOpen ? " open" : ""}" data-pid="${id}"><button type="button" class="px-rh" data-rsx="${id}" aria-expanded="${isOpen}" aria-label="${esc(nm)}, ${s.pts} points${s.acc != null ? `, accuracy ${s.acc}` : ""}">
      <span class="rk">${k + 1}</span>${g._av(p, "rt-av")}<span class="nm"><b>${nm}</b>${s.level ? `<small>${esc(s.level.label)}</small>` : ""}</span><span class="pts">${X.n(`pts:${id}`)}</span>${IC.chev}
      ${bar}<span class="px-chips">${acc}${luck}</span></button>${det}</div>`;
  }).join("");
  const leg = used.length ? `<div class="px-leg">${used.map(([q, l]) => `<span><i class="s${si(q)}"></i>${l}</span>`).join("")}</div>` : "";
  const prog = (() => { try { return g._rvTableProg(R, tab.LK) || ""; } catch (_) { return ""; } })();
  const vl = m ? verdictLine(g, m) : "";
  return `<section class="rv-card rt rsc px-end" data-rvtable aria-label="Result"><div class="rv-gt"><b>Result</b><small>tap a player for the details</small></div>${vl ? `<p class="px-vl">${vl}</p>` : ""}${prog}<div class="px-rows">${rows}</div>${leg}</section>`;
}

/** "1 real error" / "3 real errors": the count is a fact; the word follows its value */
export const pl = (X, ref, one, many, o = {}) => X.ph(X.v(ref) === 1 ? one : many, { n: [ref] }, o);
export const nErr = (X, ref = "errors") => pl(X, ref, "{n} real error", "{n} real errors");
/** one moment's cause in plain words (already in the app language): "built a city", "good roll", "ended too early", "Groen’s roll" */
export function causeText(m, x) {
  const nl = isNL(), lg = nl ? "nl" : "en", nm = (q) => seatNm(m, q), kw = (k) => atr(lg, `kind.${k}`);
  if (x.k === "roll") return x.own ? atr(lg, x.good ? "mom.roll.good" : "mom.roll.bad") : atr(lg, "mom.roll.of", { x: nm(x.actor), n: m.F.n(`mom.${x.S}.roll`) });
  if (x.k === "by") return atr(lg, x.what === "turn" ? "mom.by.turn" : `mom.by.${x.what}`, { x: nm(x.actor) });
  if (x.k === "build") return atr(lg, `mom.${x.what}`);
  if (x.what === "end") return atr(lg, "mom.end");
  if (x.what === "instead") return atr(lg, "mom.instead", { a: kw(x.a), b: kw(x.b) });
  return atr(lg, `mom.${x.what}`);
}
/** what a missed move was, in words: "bank trade instead of development card" | "ended too early" | "weak settlement" (the decision d) */
export function missWhat(m, d) {
  const lg = isNL() ? "nl" : "en", pk = d.kind || kindOf(d.x?.label), bk = d.bestKind || bestKindOf(d.x?.best?.label), K = ["settlement", "city", "road", "bank", "card"], kw = (k) => atr(lg, `kind.${k}`);
  if (pk === "end") return { w: atr(lg, "mom.end") };
  if (pk === bk && K.includes(pk)) return { w: atr(lg, `mom.weak.${pk}`) };
  if (K.includes(pk) && K.includes(bk)) return { k1: kw(pk), k2: kw(bk) };
  return { w: atr(lg, "mom.weak") };
}
/** The headline, longest first: what the player controlled most (the start picks, the biggest miss, or the best move), then luck only when it is large and then whose rolls they were.
 *  Every number is a fact of the store; the same facts are in the waterfall and the key moments below. Shortened step by step until it fits two lines (HEAD_BUDGET characters at 360px). */
export const HEAD_BUDGET = 84;
export function headVariants(m) {
  const X = m.F, P = X.data.head, W = X.data.wf; if (!P || !W) return [];
  const nl = isNL(), lg = nl ? "nl" : "en", you = m.you, name = esc(m.me.name), S = you ? (nl ? "Je" : "You") : name, pos = atr(lg, you ? "hd.pos.you" : "hd.pos.3"), tg = (r) => X.n(r), yk = you ? "you" : "3";
  const seatName = (q) => seatNm(m, q);
  const o = P.own, won = P.won, T = (i) => m.ds.find((d) => d.i === i)?.t;
  const ownClause = (full) => {
    if (o.k === "start") return won ? atr(lg, you ? "hd.won.start" : "hd.won.start.3", { S, pos, d: tg("startCost") }) : full && o.pick ? atr(lg, o.single ? "hd.lost.start" : "hd.lost.start.p", { S, pos, n: o.pick, a: tg(`pick${o.pick}.win`), b: tg(`pick${o.pick}.best`), d: tg("startCost") }) : atr(lg, "hd.lost.start.t", { S, pos, d: tg("startCost") });
    if (o.k === "best") { const kind = o.kind || "move"; return atr(lg, "hd.won.best", { S, pos, k: atr(lg, `h.k.${kind}`), t: o.T, d: tg(`mom.${o.S}.move`) }); }
    if (o.k === "miss") { const d = m.ds.find((q) => q.i === o.i), w = missWhat(m, d), p = { S, pos, t: T(o.i), d: tg(`mv.${o.i}.cost`) };
      if (won) return atr(lg, "hd.won.miss", p);
      return full ? (w.w ? atr(lg, "hd.lost.miss.w", { ...p, w: w.w }) : atr(lg, "hd.lost.miss", { ...p, k1: w.k1, k2: w.k2 })) : atr(lg, "hd.lost.miss.t", p); }
    return atr(lg, won ? "hd.won.clean" : "hd.lost.clean", { S, d: tg("movesTotal") });
  };
  const L = P.luck;
  const luckClause = (mode) => {
    if (!L || mode === 2) return "";
    if (L.k === "own") return atr(lg, `hd.lk.own.${L.good ? "good" : "bad"}.${yk}`, { d: tg("luck"), x: name });
    const y = seatName(L.actor), two = L.Ts.length > 1, g = won ? "good" : "bad";
    if (mode === 1) return atr(lg, `hd.lk.${g}.short`, { y, d: tg("hl.rolls") });
    return atr(lg, `hd.lk.${g}${two ? "" : "1"}.${yk}`, { y, t: L.Ts[0], t2: L.Ts[1], d: tg("hl.rolls"), x: name });
  };
  const join = (own, lk) => {
    if (!lk) return `${own}.`;
    if (won) return `${own}: ${lk}.`;
    if (L?.k === "own" && L.good) return `${own}, ${atr(lg, "despite")} ${lk}.`;
    return o.k === "clean" ? `${own}: ${lk}.` : `${own} ${atr(lg, "and")} ${lk}.`;
  };
  const out = [join(ownClause(true), luckClause(0)), join(ownClause(true), luckClause(1)), join(ownClause(false), luckClause(0)), join(ownClause(false), luckClause(1)), join(ownClause(false), "")];
  if (!won && o.k === "clean" && !L) { const ot = X.v("others"); if (ot != null && ot <= -5) return [`${atr(lg, "hd.lost.others", { S, d: tg("others") })}.`, ...out.slice(0, 0)]; }
  return out.filter((t, i) => out.indexOf(t) === i);
}
export function verdictSpans(m, budget = HEAD_BUDGET) {
  const nl = isNL(), vs = headVariants(m), sp = (x) => `<span data-i18n-skip>${x}</span>`;
  if (!vs.length) return "";
  const len = (t) => t.replace(/<[^>]*>/g, "").length, pick = vs.find((t) => len(t) <= budget - (m.you ? 0 : Math.max(0, String(m.me.name).length - 8))) || vs[vs.length - 1];
  void nl; return `<span class="px-vsent">${sp(pick)}</span>`;
}
export function verdictLine(g, m, budget) { return verdictSpans(m, budget); }

// ───────────────────────── Overview ─────────────────────────
function resultLine(g, m) {
  const X = m.F, r = X.data.res; if (!r) return `${who(m)}`;
  const A = X.ph("{n}–{n2}", { n: [r.left], n2: [r.right] });
  return `<span data-i18n-skip>${r.won && m.you ? (isNL() ? "Jij" : "You") : esc(r.winner)} won</span> ${A}`;
}
const lh = (n, title, right = "") => `<div class="px-lh"><i class="px-nb">${n}</i><b>${title}</b>${right ? `<span class="px-rt">${right}</span>` : ""}</div>`;
export const spotTiles = (board, node) => { try { if (!board || node == null) return ""; const geo = stdGeo(); return geo.nodes[node].hx.map((h) => board[h]).filter((b) => b && b.num).map((b) => `<i class="px-tile" style="background:${RES_COLOR[b.res] || "#999"}" title="${esc(rname(b.res))}">${b.num}</i>`).join(""); } catch (_) { return ""; } };

/** ONE sentence tying Accuracy, real errors and the moves cost together: "Accuracy 90, 0 real errors. Moves in total −14%: start −9% + moves −5%." (all numbers are facts of the waterfall below) */
export function connectLine(m) {
  const X = m.F, lg = isNL() ? "nl" : "en", pid = m.pid, c = X.v("errors"), x = esc(m.me.name);
  const acc = `<b>${atr(lg, "word.acc")} ${X.has(`acc:${pid}`) ? X.n(`acc:${pid}`) : "–"}</b>`;
  const errs = atr(lg, c === 0 ? "c.err0" : c === 1 ? "c.err1" : "c.errn", { n: X.n("errors") });
  const P = { acc, errs, tot: X.n("movesTotal"), cap: X.has("capNote") ? X.n("capNote") : X.n("fair"), st: X.n("startCost"), mv: X.n("moveCost"), x };
  return `<p class="px-l" data-i18n-skip>${atr(lg, "c.a", P)}</p><p class="px-l" data-i18n-skip>${atr(lg, m.you ? "c.b" : "c.b.3", P)}</p>`;
}
/** the ± margin of a move (its own uncertainty) as a small muted tag, "" when the review has none */
export const pm = (X, i) => (X.has(`mv.${i}.margin`) ? `<small class="px-pm" title="margin">${X.n(`mv.${i}.margin`)}</small>` : "");
function verdictCard(g, m) {
  const X = m.F, pid = m.pid, picks = m.start?.picks || [];
  const hl = `<p class="px-hl2">${verdictSpans(m)}</p>`;
  const accLine = `<div class="px-cn">${connectLine(m)}</div>`;
  const tile = (k, nref, one, many, vref, cap) => `<button type="button" class="px-t3" data-pxpil="${k}" aria-expanded="false"><small>${pl(X, nref, `{n} ${one}`, `{n} ${many}`)}</small>${X.d(vref)}<span>${cap}</span></button>`;
  const t3 = `<div class="px-t3s">${tile("errors", "errors", "Real error", "Real errors", "errCost", "not close calls")}${tile("start", "startN", "Start pick", "Start picks", "startCost", "start spots checked")}${tile("other", "otherN", "Other move", "Other moves", "otherCost", "close calls and small ones")}</div>`;
  const errChips = m.errs.slice(0, 4).map((d) => `<button type="button" class="px-cc" data-rvj="${d.i}" data-rvq="imp">${f("Turn {n}", { n: d.t })} ${X.d(`mv.${d.i}.cost`)}</button>`).join("");
  const startChips = picks.map((p) => `<button type="button" class="px-cc" data-pxtab="strategy">${f("Pick {n}", { n: p.n })} ${X.d(`pick${p.n}.cost`)}</button>`).join("");
  const bodies = `<div class="px-pb" data-pxpb="errors" hidden><p class="px-l">${X.v("errors") ? X.ph("{n} clear mistakes or missed chances, the same ones as in Lesson 1.", { n: ["errors"] }) : "No clear mistake in this game."}</p><div class="px-ccs">${errChips}</div></div>
    <div class="px-pb" data-pxpb="start" hidden><p class="px-l">${startChips ? "What your two start spots cost against the best spots." : "No start picks were checked."}</p><div class="px-ccs">${startChips}</div></div>
    <div class="px-pb" data-pxpb="other" hidden><p class="px-l">${X.ph("{n} small differences, each too small to call an error.", { n: ["smallDiff"] })}</p><button type="button" class="px-link" data-pxtab="moves">Open the Moves tab${IC.chev}</button></div>`;
  void pid; return `<section class="rv-card px-card px-verdict" data-pxv><div class="px-vh"><b>${resultLine(g, m)}</b>${infoBtn("error")}</div>${hl}${accLine}${t3}${bodies}</section>`;
}
function swingLabel(g, m, x) {
  const X = m.F, st = g._st, step = st?.steps?.[x.S - 1], actor = x.actor, nm = (q) => (q === m.pid && m.you ? "You" : g.players[q]?.isHuman ? "the human player" : esc(g.players[q]?.name || "Someone")), bk = buildKindAt(st, x.S, actor);
  if (bk === "city") return f("{x} built a city", { x: nm(actor) });
  if (bk === "settlement") return f("{x} built a settlement", { x: nm(actor) });
  if (step && Math.abs(x.a - x.b) >= Math.abs(x.e - x.a)) return X.ph("{x} rolled {n}", { x: nm(step[1] >= 0 ? step[1] : m.pid), n: [`mom.${x.S}.roll`] });
  return f("{x} played the turn", { x: nm(actor ?? m.pid) });
}
function timelineCard(g, m) {
  const tl = m.timeline; if (!tl) return "";
  const X = m.F, W = 336, H = 150, x0 = 40, x1 = W - 12, top = 10, bot = H - 8, T = Math.max(2, tl.T);
  const X0 = (t) => x0 + (t / T) * (x1 - x0), Y = (p) => top + (1 - p) * (bot - top);
  const bands = tl.phases.map((p, i) => `<rect x="${X0(p.from - 1).toFixed(1)}" y="${top - 8}" width="${(X0(p.to) - X0(p.from - 1)).toFixed(1)}" height="${bot - top + 8}" class="b b${i}"/>`).join("");
  const grid = [0, 0.5, 1].map((p) => `<line x1="${x0}" x2="${x1}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" class="g"/><text x="${x0 - 6}" y="${(Y(p) + 4.5).toFixed(1)}" text-anchor="end">${p * 100}%</text>`).join("");
  const line = (q) => tl.lines[q].map((pt, i) => `${i ? "L" : "M"}${X0(pt[0]).toFixed(1)},${Y(pt[1]).toFixed(1)}`).join("");
  const order = g.players.map((p) => p.id).filter((q) => q !== m.pid).concat(m.pid);
  const lines = order.map((q) => `<path class="pc-${q} ln${q === m.pid ? " me" : ""}" d="${line(q)}"/>`).join("");
  const mine = tl.lines[m.pid], yAt = (t) => { let v = mine[0]?.[1] ?? 0.25; for (const pt of mine) if (pt[0] <= t) v = pt[1]; return v; };
  const pinY = (p) => { let y = Y(yAt(p.T)); if (y > bot - 12) y = bot - 14; if (y < top + 12) y = top + 14; return y; };
  const pins = tl.pins.map((p) => { const cy = pinY(p); return `<g class="pin ${X.v(`mom.${p.S}.d`) >= 0 ? "up" : "dn"}" data-pxstop="${p.T}"><circle cx="${X0(p.T).toFixed(1)}" cy="${cy.toFixed(1)}" r="10"/><text x="${X0(p.T).toFixed(1)}" y="${(cy + 4.5).toFixed(1)}" text-anchor="middle">${p.n}</text></g>`; }).join("");
  const sPin = m.start?.picks?.length ? `<g class="pin s" data-pxstop="0"><circle cx="${x0 + 12}" cy="${Y(mine[0]?.[1] ?? 0.25).toFixed(1)}" r="10"/><text x="${x0 + 12}" y="${(Y(mine[0]?.[1] ?? 0.25) + 4.5).toFixed(1)}" text-anchor="middle">S</text></g>` : "";
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="px-tl" role="img" aria-label="${esc(f("Win chance of every player through the game, you from {n} to {n2}", { n: X.t("tl.from"), n2: X.t("tl.to") }))}">${bands}${grid}${lines}${sPin}${pins}</svg>`;
  const caps = `<div class="px-bcap" style="margin-left:${((x0 / W) * 100).toFixed(1)}%;margin-right:${(((W - x1) / W) * 100).toFixed(1)}%">${tl.phases.map((p) => `<span style="flex:${p.to - p.from + 1} 1 0"><b>${esc(PHASE_NAME[p.k])}</b><small>${f("turns {n}–{n2}", { n: p.from, n2: p.to })}</small></span>`).join("")}</div>`;
  const leg = `<div class="px-lgd">${g.players.map((p) => `<span class="pc-${p.id}"><i></i>${p.id === m.pid && m.you ? "You" : p.isHuman && !m.you ? "Human" : esc(p.short || p.name)}</span>`).join("")}</div>`;
  const sp = (p) => `<small class="px-sp"><span>${X.ph("move {x}", { x: [`mom.${p.S}.move`] })}</span> · <span>${X.ph("dice {x}", { x: [`mom.${p.S}.dice`] })}</span> · <span>${X.ph("rest {x}", { x: [`mom.${p.S}.rest`] })}</span></small>`;
  const row = (p) => `<button type="button" class="px-km" data-pxstop="${p.T}"><span class="t">${p.n ? `<i class="pn">${p.n}</i> ` : ""}${f("Turn {n}", { n: p.T })}</span><span class="x"><span>${swingLabel(g, m, p)}</span>${sp(p)}</span>${X.d(`mom.${p.S}.d`)}</button>`;
  const shownT = new Set(tl.pins.map((p) => p.T)), restAll = (tl.all || []).filter((p) => !shownT.has(p.T));
  const more = restAll.length ? fold("allk", `<span>${X.ph("All {n} moments", { n: ["momN"] })}</span>`, restAll.map(row).join(""), { cls: "px-allk" }) : "";
  return `<section class="rv-card px-card px-time"><div class="rv-gt"><b>${m.you ? "Your win chance" : f("{x}’s win chance", { x: esc(m.me.name) })}</b><small>pins = biggest swings</small></div>${svg}${caps}${leg}<div class="px-kms">${tl.pins.map(row).join("")}</div>${more}<button type="button" class="px-link" data-pxboard>View board${IC.chev}</button></section>`;
}
// ── lesson 1: real errors ──
const noiseLine = (X, e) => (X.has(`mv.${e.i}.margin`) ? `<p class="px-fn"><span>${X.ph("Gap {g}, margin {s}", { g: [`mv.${e.i}.cost`, { abs: true }], s: [`mv.${e.i}.margin`] })}</span></p>` : "");
function errorCard(g, m, e) {
  const X = m.F, DID = m.you ? "You did" : "Played", bd = m.board, N = (v) => `<span data-i18n-skip>${esc(moveFull(v || "", isNL() ? "nl" : "en") || (isNL() ? "Zet" : "Move"))}</span>`;
  const crops = bd && e.p && e.q && e.p[0] === e.q[0] ? `<div class="px-crops"><figure>${cropSvg(bd, e.p, { w: 120, color: "#B45A3C", label: DID })}<figcaption>${DID}</figcaption></figure><figure>${cropSvg(bd, e.q, { w: 120, color: "#2F7D6B", label: "Better" })}<figcaption>Better (A)</figcaption></figure></div>` : "";
  const bars = `<div class="px-wb"><small>Win chance after this move</small><div class="r"><span>${DID}</span><i class="px-bar me pc-${m.pid}" style="--w:${X.v(`mv.${e.i}.B`)}%"></i><b>${X.n(`mv.${e.i}.B`)}</b></div><div class="r"><span>Better (A)</span><i class="px-bar a pc-${m.pid}" style="--w:${X.v(`mv.${e.i}.A`)}%"></i><b>${X.n(`mv.${e.i}.A`)}</b></div></div>`;
  const lg = isNL() ? "nl" : "en", whyT = e.why ? whyLine(e.why, lg) : null, chipT = whyChips(e.chips, lg);
  const why = whyT ? `<p class="px-l"><b>Why</b> <span data-i18n-skip data-explain>${esc(whyT)}</span></p>` : "";
    const vis = X.has(`mv.${e.i}.vis`) ? `<span class="px-cc">${X.ph("{n} of {n2} visible points", { n: [`mv.${e.i}.vis`], n2: ["target:-"] })}</span>` : "";
  return `<button type="button" class="px-err" data-rvj="${e.i}" data-rvq="imp"><span class="h"><b>${f("Turn {n}", { n: e.t })}</b><i class="px-cls c-${e.cls}">${CLS_NAME[e.cls]}</i>${X.d(`mv.${e.i}.cost`)}</span>${crops}<span class="mv"><s>${DID}</s> ${N(e.played)}</span><span class="mv"><s>Better (A)</s> ${N(e.better)}</span>${bars}${noiseLine(X, e)}${why}${chipT.length || vis ? `<div class="px-ccs">${chipT.map((c) => `<span class="px-cc" data-i18n-skip data-explain>${esc(c)}</span>`).join("")}${vis}</div>` : ""}</button>`;
}
export function scoredNote(m) { const X = m.F; return `<p class="px-fn"><span>${X.ph("{n} of {n2} decisions are scored", { n: ["scored"], n2: ["decisions"] })}</span>${X.v("oneOption") > 0 ? ` · <span>${X.ph("{n} had only one sensible option", { n: ["oneOption"] })}</span>` : ""}</p>`; }
function lesson1(g, m) {
  const X = m.F, list = m.lesson1.map((e) => errorCard(g, m, e)).join("");
  const head = lh(1, "Real errors", X.d("errCost"));
  const body = m.lesson1.length ? list : `<p class="px-l">${m.you ? "No clear mistake in your moves. Good play." : "No clear mistake in these moves."}</p>`;
  const ne = (m.notErrs || []).slice(0, 3).map((d) => `<span class="px-ne2"><i class="px-cls c-close">${CLS_NAME[d.cls]}</i> ${f("Turn {n}", { n: d.t })} ${X.d(`mv.${d.i}.cost`)}${pm(X, d.i)}</span>`).join("");
  const notErr = X.v("notErrors") && ne ? `<div class="px-nerow"><small>SMALL DIFFERENCES</small>${ne}</div>${ne ? `<p class="px-fn">± = the move’s own margin: a gap under twice that is not an error.</p>` : ""}` : "";
  return `<section class="rv-card px-card px-l1">${head}${body}${notErr}${scoredNote(m)}<button type="button" class="px-btn wide" data-pxtab="moves">All errors and moves</button></section>`;
}
// ── lesson 2 compact: "This board" ──
export const PLAN_NAME = { city: "City plan (ore, grain)", expansion: "Expansion plan (lumber, brick)", mixed: "Cities and expansion mixed" };
/** the start advice in plain words: what to take, from-to with the measured gap, and WHY when the better spot has fewer dots */
export function startAdvice(m, p) {
  const X = m.F, top = p.shortlist?.[0]; if (!p.advice || !top) return "";
  const x = p.advice.adds.map(rname).join(", "), nn = p.n, fewer = p.spot && top.spot && top.spot.total < p.spot.total;
  return `<p class="px-adv"><span>${X.ph(m.you ? "Take {x}: {a} → {b} ({g})." : "Better pick: {x}, {a} → {b} ({g}).", { x, a: [`pick${nn}.win`], b: [`pick${nn}.best`], g: [`pick${nn}.gain`] })}</span>${fewer && m.you ? ` <span>${X.ph("Fewer dots ({a} against {b}), but {x} added.", { a: [`pick${nn}.bestDots`], b: [`pick${nn}.dots`], x })}</span>` : ""}</p>`;
}
export const DOT_KEY = "Tile numbers are dice numbers. Dots = how often that number rolls (more dots, more income).";
function lesson2c(g, m) {
  const X = m.F, s = m.start, p = s?.picks?.[0]; if (!p) return "";
  const top = p.shortlist?.[0], bd = m.board, tref = top ? X.slRef(1, 0, p) : null;
  const row = (lab, node, dots, win) => `<div class="px-br"><small>${lab}</small><span class="tl">${spotTiles(bd, node) || ""}</span><span class="dt">${dots && X.has(dots) ? X.ph("{n} dots", { n: [dots] }) : ""}</span><b>${X.n(win)}</b></div>`;
  return `<section class="rv-card px-card px-l2c">${lh(2, "This board", s.plan ? esc(PLAN_NAME[s.plan]) : "")}${row("PICK 1", p.node, "pick1.dots", "pick1.win")}${top ? row("BEST SPOT", top.node, tref.dots, tref.win) : ""}<p class="px-fn px-dk">${DOT_KEY}</p>${startAdvice(m, p)}<button type="button" class="px-btn wide" data-pxtab="strategy">Start review in Strategy</button></section>`;
}
/** a rule chip: "No ore" | "8 of 10 points" (the numbers are facts) */
export function chipText(m, r, c, j) {
  const X = m.F, lg = isNL() ? "nl" : "en";
  return `<span data-i18n-skip>${atr(lg, c.ck, { ...(c.cp || {}), pts: X.has(`rule.${r.phase}.pts.${j}`) ? X.n(`rule.${r.phase}.pts.${j}`) : "", target: X.n("target:-") })}</span>`;
}
export function ruleRows(m) {
  const X = m.F, rules = m.lesson3 || [];
  return rules.map((r) => `<div class="px-rule"><div class="rl"><b>${esc(PHASE_NAME[r.phase])}</b><small>${f("turns {n}–{n2}", { n: r.from, n2: r.to })}</small></div><div class="rr">${m.you ? `<p class="px-l" data-i18n-skip>${esc(r.text)}</p>` : ""}<div class="px-ccs">${r.chips.map((c, j) => `<button type="button" class="px-cc" data-rvj="${c.i}" data-rvq="imp">${chipText(m, r, c, j)} · ${f("Turn {n}", { n: c.turn })} ${X.d(`mv.${c.i}.cost`)}</button>`).join("")}${X.d(`rule.${r.phase}.cost`)}</div></div></div>`).join("");
}
function lesson3c(g, m) {
  const rows = ruleRows(m);
  return `<section class="rv-card px-card px-l3c">${lh(3, "Phase rules", "only if broken")}${rows || `<p class="px-l">No phase rule was broken.</p>`}</section>`;
}
export const takeText = (t) => ({
  spend: "Spend your cards before you end the turn.", trade: "Trade only toward a build you can make.", build: "Pick the build that brings points soonest.",
  start: f("Take {x} with your first picks.", { x: rname(t.res) }), "start-any": "Check the numbers and resources of your start spots.",
}[t.key] || t.text || "");
function takeCard(g, m) {
  const X = m.F, tk = m.takeaway; if (!tk.length) return "";
  const sub = (t) => (t.lesson === 1 ? X.ph("Turn {n} cost {c}", { n: t.t, c: [`mv.${t.i}.cost`, { abs: true }] }) : t.lesson === 2 ? X.ph("Start pick {n}: {a} instead of {b}", { n: t.k ?? 1, a: [`pick${t.k ?? 1}.win`], b: [`pick${t.k ?? 1}.best`] }) : X.ph("{x} cost {c}", { x: PHASE_NAME[t.phase], c: [`rule.${t.phase}.cost`, { abs: true }] }));
  const rawText = (t) => (t.key && /^[a-z]+(-[a-z]+)+$/.test(t.key) && t.text ? " data-i18n-skip" : "");
  return `<section class="rv-card px-card px-take">${lh("", "Take with you", pl(X, "takeN", "{n} rule for the next game", "{n} rules for the next game")).replace('<i class="px-nb"></i>', "")}<ol>${tk.map((t, i) => `<li><button type="button" class="px-tk" ${t.lesson === 1 ? `data-rvj="${t.i}" data-rvq="imp"` : 'data-pxtab="strategy"'}><i>${i + 1}</i><span><span${rawText(t)}>${esc(takeText(t))}</span><small>${sub(t)}</small></span>${IC.chev}</button></li>`).join("")}</ol><button type="button" class="px-btn wide" data-pxpractise>Practise these</button></section>`;
}
// ── the waterfall: what moved the win chance (fair share + start picks + moves + luck + others = end) ──
const GL = { setup: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', luck: '<rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9.5" cy="9.5" r="1.4"/><circle cx="14.5" cy="14.5" r="1.4"/>', moves: '<path d="M6 19V11M12 19V5M18 19v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', rest: '<path d="M12 4v15M6 20h12M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' };
/** the one-line facts under each waterfall row (also used by "Why won / lost" on the player page): { start, moves, luck, oth } as html in the app language */
export function waterSubs(m) {
  const X = m.F, W = X.data.wf; if (!W) return {};
  const lg = isNL() ? "nl" : "en", at = (k, v) => atr(lg, k, v), sk = (x) => `<span data-i18n-skip>${x}</span>`, nmOf = (q) => seatNm(m, q);
  const start = W.picks.length ? sk(W.picks.map((n) => at("wf.start.sub", { p: at("wf.pick", { n }), a: X.n(`pick${n}.win`), b: X.n(`pick${n}.best`) })).join(" · ")) : sk(at("wf.start.ok"));
  const moves = W.miss ? (() => { const w = missWhat(m, W.miss), p = { t: W.miss.t, d: X.n(`mv.${W.miss.i}.cost`) }; return sk(w.w ? at("wf.moves.sub.w", { ...p, w: w.w }) : at("wf.moves.sub", { ...p, k1: w.k1, k2: w.k2 })); })() : sk(at("wf.moves.none", { n: X.n("lim.small:-") }));
  const luck = W.roll ? sk(at("wf.luck.sub", { x: nmOf(W.roll.actor), n: X.n("roll1.n"), t: W.roll.T, d: X.n("roll1.d") })) : sk(at("wf.luck.none"));
  const oth = W.rolls ? sk(at(W.rolls.Ts.length > 1 ? "wf.others.rolls" : "wf.others.rolls1", { y: seatNm(m, W.rolls.actor), t: W.rolls.Ts[0], t2: W.rolls.Ts[1], d: X.n("hl.rolls") })) : sk(at("wf.others.sub"));
  return { start, moves, luck, oth };
}
function waterfallCard(g, m) {
  const X = m.F, W = X.data.wf; if (!W) return "";
  const subs = waterSubs(m), subStart = subs.start, subMoves = subs.moves, subLuck = subs.luck, subOth = subs.oth;
  const bar = (k, cls) => `<i class="bar ${cls}" aria-hidden="true"><i style="left:${W.geo[k].left}%;width:${W.geo[k].width}%"></i></i>`;
  const row = (k, key, label, id, sub, ic, cls) => `<div class="px-wfr ${key}"><i class="ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GL[ic]}</svg></i><b class="lb">${label}</b>${bar(k, cls)}${X.d(id)}<small class="sb">${sub}</small></div>`;
  const wc = (k, key, label, id) => `<div class="px-wfr ${key}"><b class="lb">${label}</b>${bar(k, "wc")}<b class="wcv">${X.n(id)}</b></div>`;
  const how = `<ul class="px-how"><li>${X.ph("The rows add up: from {a} at the start to {b} at the end.", { a: ["fair"], b: ["end"] })}</li><li>Start picks is what the two start spots cost against the best spots checked.</li><li>Moves is what all other scored moves cost against best play.</li><li>Moves in total = start picks + moves.</li><li>Luck is rolls, steals, card draws and seat order together.</li><li>What the others did is what is left: their moves and luck, plus what the estimates cannot tell apart.</li></ul>`;
  const res = X.data.res, eb = res ? `<div class="px-eb">${X.ph("Why it ended {n}–{n2}", { n: [res.left], n2: [res.right] })}</div>` : "";
  const cap = X.v("moveRaw") != null && X.cost?.capped ? `<p class="px-fn">${X.ph("Together the moves cannot cost more than the best win chance held ({w}).", { w: ["capNote"] })}</p>` : "";
  return `${eb}<section class="rv-card px-card px-led px-wf"><div class="rv-gt"><b>${m.you ? "What moved your win chance" : f("What moved {x}’s win chance", { x: esc(m.me.name) })}</b><button type="button" class="px-link nm" data-pxnum>Numbers</button></div>${wc("fair", "fair", "Fair share", "fair")}${row("start", "start", "Start picks", "startCost", subStart, "setup", "own")}${row("moves", "moves", "Moves", "moveCost", subMoves, "moves", "own")}${W.hasLuck ? row("luck", "luck", "Luck", "luck", subLuck, "luck", "own") : ""}${row("others", "oth", "What the others did", "others", subOth, "rest", "oth")}${wc("end", "end", "End", "end")}<p class="px-fn px-eq">${X.ph("Moves in total {t}: start picks {a} + moves {b}. Per move {c}.", { t: ["movesTotal"], a: ["startCost"], b: ["moveCost"], c: ["perMove"] })}</p>${cap}${fold("how", "<span>How to read this</span>", how)}</section>`;
}


export function overviewTab(g, ds, rv, prov) {
  const pid = g._rvPid, r = ready(g, pid);
  if (!r.m) return { html: progressCard(g, pid) };
  const m = r.m;
  return { html: `${verdictCard(g, m)}${timelineCard(g, m)}${lesson1(g, m)}${lesson2c(g, m)}${lesson3c(g, m)}${m.you ? takeCard(g, m) : ""}${waterfallCard(g, m)}`, bind: (el) => bindPost(g, el, m) };
}


export function progressCard(g, pid) {
  let p = ""; try { p = g._rvProgHtml(pid) || ""; } catch (_) { p = ""; }
  return p || `<section class="rv-card rv-prog" role="status"><b>Starting the check…</b></section>`;
}

// ───────────────────────── sheets ─────────────────────────
export function sheet(g, title, body, key = "x") {
  const el = g._rvEl || document.body;
  el.querySelectorAll(".rv-info.px-sheet").forEach((n) => n.remove());
  const d = document.createElement("div");
  d.className = "rv-info px-sheet"; d.dataset.pxsheet = key; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", title);
  d.innerHTML = `<div class="rv-card"><span class="px-grab" aria-hidden="true"></span><div class="rv-ih"><b>${esc(title)}</b><button type="button" class="rv-btn" data-pxx aria-label="Close">${oicon("close")}</button></div>${body}</div>`;
  const close = () => { d.remove(); g._pxSheet = null; };
  d.addEventListener("click", (e) => { if (e.target === d) close(); });
  d.querySelector("[data-pxx]").addEventListener("click", close);
  el.appendChild(d); g._pxSheet = key;
  d.querySelector("[data-pxx]").focus({ preventScroll: true });
  return d;
}
export function infoSheet(g, what = "error") {
  const m = ready(g, g._rvPid).m, X = m?.F; void what;
  const li = (t, body) => `<li><b>${t}</b><span>${body}</span></li>`;
  const ph = (tpl, vars) => (X ? X.ph(tpl, vars) : tpl.replace(/\{\w+\}/g, "–"));
  const lim = (k) => [`${k}:-`];
  const rows = [
    li("Real error", ph("A move that gave up at least twice its own margin (the ±), about {a} when none is stored. A close call never counts.", { a: lim("lim.err") })),
    li("Could be better", "Any other weaker move, too small to call an error."),
    li("Kinds of real error", "A mistake gave up a clear amount, a blunder a very large amount, a missed chance was a better move left unplayed."),
    li("Start picks", ph("Judged on their own: could be better from {a}, a mistake from {b}, a blunder from {c}.", { a: lim("lim.set1"), b: lim("lim.set2"), c: lim("lim.set3") })),
    li("Accuracy", "How often the moves were near the best move."),
    li("Moves in total", "Start picks plus all other scored moves: what they gave up against best play. The moves after the start cannot give up more than the best win chance held."),
    li("Luck", "Rolls, steals, drawn cards and seat order, as win chance. Every player has an own estimate."),
    li("Lead", "How far a best move was ahead of the next-best option, in win chance."),
    X?.has("ph.opening.from:-") ? li("Phases", ph("The game’s {n} turns in three equal parts: opening {a}–{b}, midgame {c}–{d}, end {e}–{f}.", { n: lim("lim.turns"), a: lim("ph.opening.from"), b: lim("ph.opening.to"), c: lim("ph.mid.from"), d: lim("ph.mid.to"), e: lim("ph.end.from"), f: lim("ph.end.to") })) : "",
    li("The headline", "Names what the player controlled most. Luck only when it is large, and then whose rolls."),
    li("How it was checked", "Every move was replayed on many simulated futures and compared with the best alternative."),
  ].join("");
  return sheet(g, "How to read this", `<div class="px-ib"><ul class="px-il">${rows}</ul></div>`, "info");
}
export function numbersSheet(g) {
  const pid = g._rvPid, r = ready(g, pid); if (!r.m) return null;
  const m = r.m, S = m.seats, N = m.numbers, X = m.F;
  if (!N?.rows?.length) return null;
  const head = `<div class="px-nr hd"><span></span>${S.map((s) => `<b class="pc-${s.id}">${s.you ? "You" : esc(s.p.short || s.name)}</b>`).join("")}</div>`;
  const cell = (row, s) => { const ref = `${numRef(row.id)}:${s.id}`; if (!X.has(ref)) return "–"; return X.get(ref).unit === "wcDelta" ? X.d(ref) : X.n(ref); };
  const body = `<div class="px-num" style="--n:${S.length}">${head}${N.rows.filter((row) => S.some((s) => X.has(`${numRef(row.id)}:${s.id}`))).map((row) => `<div class="px-nr"><span data-i18n-skip>${esc(row.label)}</span>${S.map((s) => `<b class="pc-${s.id}${s.id === pid ? " cur" : ""}">${cell(row, s)}</b>`).join("")}</div>`).join("")}</div>`;
  return sheet(g, "Numbers", body, "numbers");
}

// ───────────────────────── wiring ─────────────────────────
export function bindPost(g, el, m) {
  el.querySelectorAll("[data-pxtog]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.pxtog, box = b.closest(".px-fold"), body = box.querySelector(":scope > .px-fb"), open = body.hidden;
    body.hidden = !open; box.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open));
    (g._pxOpen ||= new Set())[open ? "add" : "delete"](key);
  }));
  el.querySelectorAll("[data-pxpil]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.pxpil, on = b.getAttribute("aria-expanded") !== "true"; el.querySelectorAll("[data-pxpil]").forEach((x) => x.setAttribute("aria-expanded", "false")); el.querySelectorAll("[data-pxpb]").forEach((x) => { x.hidden = true; }); b.setAttribute("aria-expanded", String(on)); if (on) el.querySelector(`[data-pxpb="${k}"]`).hidden = false; }));
  el.querySelectorAll("[data-pxinfo]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); infoSheet(g, b.dataset.pxinfo); }));
  el.querySelectorAll("[data-pxnum]").forEach((b) => b.addEventListener("click", () => numbersSheet(g)));
  el.querySelectorAll("[data-pxtab]").forEach((b) => b.addEventListener("click", () => { g._rvTab = b.dataset.pxtab; g._rvDrawReview(); }));
  el.querySelectorAll("[data-pxstop]").forEach((b) => b.addEventListener("click", () => { g._pxBoard?.(+b.dataset.pxstop); }));
  el.querySelectorAll("[data-pxboard]").forEach((b) => b.addEventListener("click", () => g._pxBoard?.(null)));
  el.querySelectorAll("[data-pxpractise]").forEach((b) => b.addEventListener("click", () => g._pxPractise?.()));
  el.querySelectorAll("[data-rvpl]").forEach((b) => b.addEventListener("click", () => g._rvOpenReview(+b.dataset.rvpl, { tab: "player" })));
  (g._pxOpen || new Set()).forEach((k) => { const box = el.querySelector(`[data-pxf="${k}"]`); if (box) { box.classList.add("open"); box.querySelector(":scope > .px-fb").hidden = false; box.querySelector(":scope > .px-fh").setAttribute("aria-expanded", "true"); } });
}
export { FAMILIES, FAMILY, PHASES, kindOf };
