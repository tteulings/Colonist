// v1.99 Post-game UI, part 1: shared pieces, the end screen's scorecard, the Overview tab, the Numbers and (i) sheets, and the install that swaps
// the v1.98 review screens for the v1.99 ones. Moves / Strategy / Luck / player page: src/post-tabs.js. Terugblik door, Bots, Bekijk bord: src/post-hist.js.
// Every number comes from src/post-model.js (ONE model per review and player, cached); every text is English here and Dutch through the
// localizer (src/i18n-nl-199p.js). Blocks whose data is missing (old saved reviews, Rush, Seafarers, 5-6 players) are simply not drawn.
import { esc, IC } from "./review-ui.js";
import { oicon } from "./ui-icons.js";
import { tradeShow, CLASSES } from "./review/evaluate.js";
import { isNL } from "./i18n.js";
import { tr as atr } from "./review/analysis-text.js";
import { seOf } from "./review/score.js";
import { cropSvg } from "./lessons-view.js";
import { stdGeo } from "./lessons-geo.js";
import { RES_COLOR } from "./resources.js";
import { modelOf, tableOf, hideCache, soloPid, SRC_PARTS, FAMILIES, FAMILY, kindOf, PHASES } from "./post-model.js";

// ── tiny helpers ──
export const f = (tpl, v = {}) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
export const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
export const ab = (v) => Math.abs(Math.round(v));
/** a signed win-chance change as a pill with an arrow: green ▲ / tinted ▼ for everybody; ±0 stays neutral */
export const D = (v, { unit = "%", plus = true, fact = null } = {}) => {
  if (v == null || !Number.isFinite(v)) return `<b class="px-d z">–</b>`;
  const r = Math.round(v), fa = fact ? ` data-fact="${fact}" data-v="${r}"` : "";
  if (r > 0) return `<b class="px-d up"${fa}><i aria-hidden="true">▲</i>${plus ? "+" : ""}${r}${unit}</b>`;
  if (r < 0) return `<b class="px-d dn"${fa}><i aria-hidden="true">▼</i>−${Math.abs(r)}${unit}</b>`;
  return `<b class="px-d z"${fa}>±0${unit}</b>`;
};
export const CLS_NAME = { best: "Best", great: "Great", good: "Good", lean: "Better option", close: "Close call", could: "Could be better", mistake: "Mistake", blunder: "Blunder", missed: "Missed chance", triv: "No real choice" };
export const FAM_NAME = { strong: "Strong moves", close: "Close calls", costly: "Weaker moves" };
export const PHASE_NAME = { opening: "Opening", mid: "Midgame", end: "End game" };
export const RES_KEY = ["wood", "brick", "sheep", "wheat", "ore"];
export const RES_NAME = { wood: "lumber", brick: "brick", sheep: "wool", wheat: "grain", ore: "ore" };
export const rname = (r) => RES_NAME[r] || r;
export const infoBtn = (what) => `<button type="button" class="px-i" data-pxinfo="${what}" aria-label="About this">${IC.info}</button>`;
/** a block whose body unfolds in place: header button + body */
export const fold = (key, head, body, { open = false, cls = "" } = {}) => `<div class="px-fold ${cls}${open ? " open" : ""}" data-pxf="${key}"><button type="button" class="px-fh" data-pxtog="${key}" aria-expanded="${open}">${head}<svg class="px-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="px-fb" ${open ? "" : "hidden"}>${body}</div></div>`;
export const NLW = [[/\bLumber\b|\blumber\b/g, "hout"], [/\bBrick\b|\bbrick\b/g, "baksteen"], [/\bWool\b|\bwool\b/g, "wol"], [/\bGrain\b|\bgrain\b/g, "graan"], [/\bOre\b|\bore\b/g, "erts"], [/^(Road|road)(?: toward)? /, "weg "], [/^(Settlement|settlement) /, "dorp "], [/^(City|city) /, "stad "], [/^(Dev card)$/i, "ontwikkelkaart"], [/^Trade /i, "ruil "], [/^(trade)$/i, "ruil"], [/^(End turn|Ended turn)$/i, "beurt beëindigen"], [/^Traded$/i, "geruild"]];
export const mvPiece = (x, first) => { if (!isNL()) return esc(x); let t = x; NLW.forEach(([re, to]) => { t = t.replace(re, to); }); if (t === x) return `<span>${esc(x)}</span>`; t = first ? t.charAt(0).toUpperCase() + t.slice(1) : t; return `<span data-i18n-skip>${esc(t)}</span>`; };
const accWord = "Accuracy";

/** the page the screens render into must exist and its model be ready: { m } or { wait } (progress card) */
export function ready(g, pid) {
  try { hideCache(g._rv); const m = modelOf(g, pid); return m ? { m } : { wait: true }; } catch (e) { console.warn("post model", e); return { wait: true, err: e }; }
}

// ── the player's name in a sentence ──
export const who = (m) => (m.you ? "You" : esc(m.me.name));
export const whose = (m) => (m.you ? "Your" : `${esc(m.me.name)}’s`);

// ───────────────────────── end screen: the scorecard ─────────────────────────
export function scoreHtml(g) {
  const R = g._rv;
  if (!R?.recs?.length || g._rvMid || !g.players.some((p) => !p.isHuman)) return "";
  const tab = tableOf(g), st = g._st, open = g._rsOpen != null && g.players[g._rsOpen] ? g._rsOpen : null;
  const maxV = Math.max(g.winPoints || 10, ...g.players.map((p) => p.victoryPoints));
  const used = st?.sources ? SRC_PARTS.filter(([k]) => st.sources.some((s) => s?.[k] > 0)) : [];
  const si = (q) => SRC_PARTS.findIndex(([k]) => k === q);
  const solo = tab.seats[tab.me];
  const m = (() => { try { return ready(g, tab.me).m || null; } catch (_) { return null; } })();
  const rows = tab.order.map((id, k) => {
    const s = tab.seats[id], p = s.p, nm = s.you ? "You" : esc(s.name);
    const acc = s.acc != null ? `<span class="px-chip" data-fact="acc:${id}" data-v="${s.acc}"><small>${accWord}</small><b${s.accDone ? "" : ' class="prov"'}>${s.accDone ? "" : "~"}${s.acc}</b></span>`
      : s.accSt === "run" && s.running ? `<span class="px-chip wait"><small>${accWord}</small><b><i class="rv-ring" style="--p:${Math.round((100 * s.running.j) / Math.max(1, s.running.n))}%" aria-hidden="true"></i>${s.running.j}/${s.running.n}</b></span>`
      : `<span class="px-chip wait"><small>${accWord}</small><b>–</b></span>`;
    const luck = s.luck != null ? `<span class="px-chip"><small>Luck</small>${D(s.luck, { fact: `luck:${id}` })}</span>` : s.cards != null && tab.LK.na ? `<span class="px-chip"><small>Luck</small>${D(s.cards, { unit: "" })}<em>cards</em></span>` : `<span class="px-chip wait"><small>Luck</small><b>–</b></span>`;
    const sc = s.src, bar = sc ? `<div class="px-src" role="img" aria-label="${esc(nm)}: ${used.filter(([q]) => sc[q] > 0).map(([q, l]) => `${l} ${sc[q]}`).join(", ")}"><div class="trk" style="--w:${Math.max(8, Math.min(100, Math.round((s.pts / maxV) * 100)))}">${used.map(([q]) => (sc[q] > 0 ? `<i class="s${si(q)}" style="flex:${sc[q]} 1 0">${sc[q]}</i>` : "")).join("")}</div></div>` : "";
    const isOpen = open === id;
    let det = "";
    if (isOpen) {
      const mm = id === tab.me ? m : (() => { try { return ready(g, id).m || null; } catch (_) { return null; } })();
      const vl = mm ? verdictLine(g, mm) : "";
      const band = s.level?.band && s.acc != null ? `<p class="px-l">${f("{x} bots usually score {n}–{n2}", { x: esc(s.level.label), n: Math.round(s.level.band[0] - s.level.band[1]), n2: Math.round(s.level.band[0] + s.level.band[1]) })}</p>` : "";
      det = `<div class="px-rd">${!s.you && vl ? `<p class="px-l">${vl}</p>` : ""}${band}<button type="button" class="px-link" data-rvtab="${id}">${s.you ? "Your page" : f("{x}’s page", { x: esc(s.name) })}${IC.chev}</button></div>`;
    }
    return `<div class="px-row pc-${id}${s.won ? " win" : ""}${s.you ? " me" : ""}${isOpen ? " open" : ""}" data-pid="${id}"><button type="button" class="px-rh" data-rsx="${id}" aria-expanded="${isOpen}" aria-label="${esc(nm)}, ${s.pts} points${s.acc != null ? `, accuracy ${s.acc}` : ""}">
      <span class="rk">${k + 1}</span>${g._av(p, "rt-av")}<span class="nm"><b>${nm}</b>${s.level ? `<small>${esc(s.level.label)}</small>` : ""}</span><span class="pts">${s.pts}</span>${IC.chev}
      ${bar}<span class="px-chips">${acc}${luck}</span></button>${det}</div>`;
  }).join("");
  const leg = used.length ? `<div class="px-leg">${used.map(([q, l]) => `<span><i class="s${si(q)}"></i>${l}</span>`).join("")}</div>` : "";
  const prog = (() => { try { return g._rvTableProg(R, tab.LK) || ""; } catch (_) { return ""; } })();
  const vl = m ? verdictLine(g, m) : "";
  return `<section class="rv-card rt rsc px-end" data-rvtable aria-label="Result"><div class="rv-gt"><b>Result</b><small>tap a player for the details</small></div>${vl ? `<p class="px-vl">${vl}</p>` : ""}${prog}<div class="px-rows">${rows}</div>${leg}</section>`;
}

/** the verdict line: one sentence from the data layer (already in the app language, so it is not run through the localizer) */
export const dsg = (v) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(Math.round(v))}`;
/** what led the game, from the ONE ledger (set-up = start picks, luck incl. seat order, moves, rest): "the others fell away (+44%), despite a weak start (−13%)" as separate text nodes, third person for other players */
export const plural = (n, one, many) => (n === 1 ? one : f(many, { n }));
export const nErr = (n) => plural(n, "1 real error", "{n} real errors");
export const nMiss = (n) => plural(n, "1 miss", "{n} misses");
/** one moment's cause in plain words (already in the app language): "built a city", "good roll", "ended too early", "Groen’s roll" */
export function causeText(m, x) {
  const nl = isNL(), lg = nl ? "nl" : "en", nm = (q) => (m.tab?.seats?.[q]?.you ? atr(lg, "mom.you") : esc(m.tab?.seats?.[q]?.name || "?")), kw = (k) => atr(lg, `kind.${k}`);
  if (x.k === "roll") return x.own ? atr(lg, x.good ? "mom.roll.good" : "mom.roll.bad") : atr(lg, "mom.roll.of", { x: nm(x.actor), n: x.roll });
  if (x.k === "by") return atr(lg, x.what === "turn" ? "mom.by.turn" : `mom.by.${x.what}`, { x: nm(x.actor) });
  if (x.k === "build") return atr(lg, `mom.${x.what}`);
  if (x.what === "end") return atr(lg, "mom.end");
  if (x.what === "instead") return atr(lg, "mom.instead", { a: kw(x.a), b: kw(x.b) });
  return atr(lg, `mom.${x.what}`);
}
export function verdictSpans(m) {
  const W = m.why; if (!W) return "";
  const nl = isNL(), lg = nl ? "nl" : "en", S = m.you ? (nl ? "Je" : "You") : esc(m.me.name), sp = (x) => `<span data-i18n-skip>${x}</span>`;
  if (!W.moments.length) return `<span class="px-vsent">${sp(atr(lg, W.won ? "mom.none.won" : "mom.none.lost", { S }))}.</span>`;
  const mom = (x, k) => atr(lg, k ? "mom.turn2" : "mom.turn", { t: x.T, c: causeText(m, x), d: `${dsg(x.d)}%` });
  const [a, b] = W.moments, lead = atr(lg, W.won ? "mom.won" : "mom.lost", { S });
  return `<span class="px-vsent">${sp(lead)} ${sp(mom(a, 0))}${b ? ` ${sp(atr(lg, "and"))} ${sp(mom(b, 1))}` : ""}.</span>`;
}
export function verdictLine(g, m) { return verdictSpans(m); }

// ───────────────────────── Overview ─────────────────────────
function resultLine(g, m) {
  const w = g.winner, me = m.me; if (!w) return `${who(m)} · ${me.victoryPoints}`;
  const oth = g.players.filter((q) => q !== w).map((q) => q.victoryPoints), top = Math.max(0, ...oth);
  if (w === me) return f(m.you ? "You won {n}–{n2}" : "{x} won {n}–{n2}", { x: esc(me.name), n: me.victoryPoints, n2: top });
  return f(m.you ? "{x} won {n}–{n2}" : "{x} won {n}–{n2}", { x: esc(w.name), n: w.victoryPoints, n2: me.victoryPoints });
}
const paceBar = (v, max, cls = "") => `<i class="px-bar ${cls}" style="--w:${Math.max(2, Math.min(100, Math.round((Math.abs(v) / Math.max(1, max)) * 100)))}%"></i>`;

const lh = (n, title, right = "") => `<div class="px-lh"><i class="px-nb">${n}</i><b>${title}</b>${right ? `<span class="px-rt">${right}</span>` : ""}</div>`;
export const spotTiles = (board, node) => { try { if (!board || node == null) return ""; const geo = stdGeo(); return geo.nodes[node].hx.map((h) => board[h]).filter((b) => b && b.num).map((b) => `<i class="px-tile" style="background:${RES_COLOR[b.res] || "#999"}" title="${esc(rname(b.res))}">${b.num}</i>`).join(""); } catch (_) { return ""; } };

/** the start cost as counted in "moves cost" (capped together with the other moves) next to the raw measured gap, in plain words; the default text when they agree */
export const startCap = (m, dflt) => { const P = m.pillars; return P && P.startRaw != null && Math.round(P.startRaw) !== Math.round(P.start) ? f("measured {a}%, counted {b}%", { a: dsg(P.startRaw), b: dsg(P.start) }) : dflt; };
/** the ± margin of a move (its own uncertainty, whole or half percent) as a small muted tag, "" when the review has none */
export const pm = (d) => { const se = seOf(d?.x); return se == null ? "" : `<small class="px-pm" title="margin">±${nfmt(Math.max(0.5, Math.round(se * 1000) / 10))}</small>`; };
function verdictCard(g, m) {
  const acc = m.sum.acc, P = m.pillars, c = m.counts, pid = m.pid;
  const hl = `<p class="px-hl2">${verdictSpans(m)}</p>`;
  const accLine = `<p class="px-l"><b data-fact="acc:${pid}" data-v="${acc ?? ""}">${accWord} ${acc ?? "–"}</b>: ${f("how often {x} near the best move", { x: m.you ? "you were" : "it was" })}. <b>Moves cost</b> ${D(m.tot.moves, { fact: `cost:${pid}` })}</p>`;
  const tile = (k, n, label, v, cap) => `<button type="button" class="px-t3" data-pxpil="${k}" aria-expanded="false"><small${k === "errors" ? ` data-fact="errors:${pid}" data-v="${n}"` : ""}>${n} ${label}</small>${D(v, { fact: `pillar-${k}:${pid}` })}<span>${cap}</span></button>`;
  const picks = m.start?.picks || [];
  const t3 = `<div class="px-t3s">${tile("errors", m.errs.length, m.errs.length === 1 ? "Real error" : "Real errors", P.errors, "not close calls")}${tile("start", picks.length, picks.length === 1 ? "Start pick" : "Start picks", P.start, startCap(m, "start spots checked"))}${tile("other", c.otherN, "Other moves", P.other, "close calls and small ones")}</div>`;
  const errChips = m.errs.slice(0, 4).map((d) => `<button type="button" class="px-cc" data-rvj="${d.i}" data-rvq="imp">${f("Turn {n}", { n: d.t })} ${D(-d.gp)}</button>`).join("");
  const startChips = picks.map((p) => `<button type="button" class="px-cc" data-pxtab="strategy">${f("Pick {n}", { n: p.n })} ${D(-p.gp)}</button>`).join("");
  const bodies = `<div class="px-pb" data-pxpb="errors" hidden><p class="px-l">${m.errs.length ? f("{n} clear mistakes or missed chances, the same ones as in Lesson 1.", { n: m.errs.length }) : "No clear mistake in this game."}</p><div class="px-ccs">${errChips}</div></div>
    <div class="px-pb" data-pxpb="start" hidden><p class="px-l">${startChips ? "What your two start spots cost against the best spots." : "No start picks were checked."}</p><div class="px-ccs">${startChips}</div></div>
    <div class="px-pb" data-pxpb="other" hidden><p class="px-l">${f("{n} small differences, each too small to call an error.", { n: m.other.filter((d) => d.gp >= 1).length })}</p><button type="button" class="px-link" data-pxtab="moves">Open the Moves tab${IC.chev}</button></div>`;
  return `<section class="rv-card px-card px-verdict" data-pxv><div class="px-vh"><b>${resultLine(g, m)}</b>${infoBtn("error")}</div>${hl}${accLine}${t3}${bodies}</section>`;
}
function swingLabel(g, m, x) {
  const st = g._st, step = st?.steps?.[x.S - 1], actor = x.actor, nm = (q) => (q === m.pid && m.you ? "You" : esc(g.players[q]?.name || "Someone"));
  try {
    (st.stepEvents?.[x.S] || []).forEach((e) => { if (e[1] === "b" && e[2] === actor && ["s", "c"].includes(e[3])) x._b = e[3]; });
  } catch (_) { /* label only */ }
  if (x._b === "c") return f("{x} built a city", { x: nm(actor) });
  if (x._b === "s") return f("{x} built a settlement", { x: nm(actor) });
  if (step && Math.abs(x.a - x.b) >= Math.abs(x.e - x.a)) return f("{x} rolled {n}", { x: nm(step[1] >= 0 ? step[1] : m.pid), n: step[2] + step[3] });
  return actor === m.pid ? f("{x} played the turn", { x: nm(actor) }) : f("{x} played the turn", { x: nm(actor ?? m.pid) });
}
function timelineCard(g, m) {
  const tl = m.timeline; if (!tl) return "";
  const W = 336, H = 150, x0 = 40, x1 = W - 12, top = 10, bot = H - 8, T = Math.max(2, tl.T);
  const X = (t) => x0 + (t / T) * (x1 - x0), Y = (p) => top + (1 - p) * (bot - top);
  const bands = tl.phases.map((p, i) => `<rect x="${X(p.from - 1).toFixed(1)}" y="${top - 8}" width="${(X(p.to) - X(p.from - 1)).toFixed(1)}" height="${bot - top + 8}" class="b b${i}"/>`).join("");
  const grid = [0, 0.5, 1].map((p) => `<line x1="${x0}" x2="${x1}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" class="g"/><text x="${x0 - 6}" y="${(Y(p) + 4.5).toFixed(1)}" text-anchor="end">${p * 100}%</text>`).join("");
  const line = (q) => tl.lines[q].map((pt, i) => `${i ? "L" : "M"}${X(pt[0]).toFixed(1)},${Y(pt[1]).toFixed(1)}`).join("");
  const order = g.players.map((p) => p.id).filter((q) => q !== m.pid).concat(m.pid);
  const lines = order.map((q) => `<path class="pc-${q} ln${q === m.pid ? " me" : ""}" d="${line(q)}"/>`).join("");
  const mine = tl.lines[m.pid], yAt = (t) => { let v = mine[0]?.[1] ?? 0.25; for (const pt of mine) if (pt[0] <= t) v = pt[1]; return v; };
  // pins: at most 3, at least 2 turns apart; a pin that would sit on the line's end is lifted above it
  const pinY = (p) => { let y = Y(yAt(p.T)); if (y > bot - 12) y = bot - 14; if (y < top + 12) y = top + 14; return y; };
  const pins = tl.pins.map((p) => { const cy = pinY(p); return `<g class="pin ${p.d >= 0 ? "up" : "dn"}" data-pxstop="${p.T}"><circle cx="${X(p.T).toFixed(1)}" cy="${cy.toFixed(1)}" r="10"/><text x="${X(p.T).toFixed(1)}" y="${(cy + 4.5).toFixed(1)}" text-anchor="middle">${p.n}</text></g>`; }).join("");
  const sPin = m.start?.picks?.length ? `<g class="pin s" data-pxstop="0"><circle cx="${x0 + 12}" cy="${Y(mine[0]?.[1] ?? 0.25).toFixed(1)}" r="10"/><text x="${x0 + 12}" y="${(Y(mine[0]?.[1] ?? 0.25) + 4.5).toFixed(1)}" text-anchor="middle">S</text></g>` : "";
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="px-tl" role="img" aria-label="${esc(f("Win chance of every player through the game, you from {n}% to {n2}%", { n: ab((mine[0]?.[1] ?? 0.25) * 100), n2: ab((mine[mine.length - 1]?.[1] ?? 0) * 100) }))}">${bands}${grid}${lines}${sPin}${pins}</svg>`;
  const caps = `<div class="px-bcap" style="margin-left:${((x0 / W) * 100).toFixed(1)}%;margin-right:${(((W - x1) / W) * 100).toFixed(1)}%">${tl.phases.map((p) => `<span style="flex:${p.to - p.from + 1} 1 0"><b>${esc(PHASE_NAME[p.k])}</b><small>${f("turns {n}–{n2}", { n: p.from, n2: p.to })}</small></span>`).join("")}</div>`;
  const leg = `<div class="px-lgd">${g.players.map((p) => `<span class="pc-${p.id}"><i></i>${p.id === m.pid && m.you ? "You" : esc(p.short || p.name)}</span>`).join("")}</div>`;
  const sp = (p) => { const dice = p.a - p.b, after = p.e - p.a, mv = p.move ? after : 0, rest = after - mv; return `<small class="px-sp"><span>${f("move {x}", { x: dsg(mv) })}</span> · <span>${f("dice {x}", { x: dsg(dice) })}</span> · <span>${f("rest {x}", { x: dsg(rest) })}</span></small>`; };
  const row = (p) => `<button type="button" class="px-km" data-pxstop="${p.T}"><span class="t">${p.n ? `<i class="pn">${p.n}</i> ` : ""}${f("Turn {n}", { n: p.T })}</span><span class="x"><span>${swingLabel(g, m, p)}</span>${sp(p)}</span>${D(p.d)}</button>`;
  const shownT = new Set(tl.pins.map((p) => p.T)), restAll = (tl.all || []).filter((p) => !shownT.has(p.T));
  const more = restAll.length ? fold("allk", `<span>${f("All {n} moments", { n: tl.pins.length + restAll.length })}</span>`, restAll.map(row).join(""), { cls: "px-allk" }) : "";
  return `<section class="rv-card px-card px-time"><div class="rv-gt"><b>Your win chance</b><small>pins = biggest swings</small></div>${svg}${caps}${leg}<div class="px-kms">${tl.pins.map(row).join("")}</div>${more}<button type="button" class="px-link" data-pxboard>Bekijk bord${IC.chev}</button></section>`;
}
// ── lesson 1: real errors ──
const noiseLine = (e) => (e.se != null ? `<p class="px-fn"><span>${f("Gap {n}%, margin ±{s}%", { n: e.gp, s: nfmt(Math.max(0.5, Math.round(e.se * 1000) / 10)) })}</span></p>` : "");
function errorCard(g, m, e) {
  const bd = m.board, N = (v) => mvPiece(tradeShow(v || "").replace(/ toward /, " ").replace(/^(Road|Settlement|City) on /, "$1 "), true);
  const crops = bd && e.p && e.q && e.p[0] === e.q[0] ? `<div class="px-crops"><figure>${cropSvg(bd, e.p, { w: 120, color: "#B45A3C", label: "You did" })}<figcaption>You did</figcaption></figure><figure>${cropSvg(bd, e.q, { w: 120, color: "#2F7D6B", label: "Better" })}<figcaption>Better (A)</figcaption></figure></div>` : "";
  const bars = `<div class="px-wb"><small>Win chance after this move</small><div class="r"><span>You did</span><i class="px-bar me pc-${m.pid}" style="--w:${e.B}%"></i><b>${e.B}%</b></div><div class="r"><span>Better (A)</span><i class="px-bar a pc-${m.pid}" style="--w:${e.A}%"></i><b>${e.A}%</b></div></div>`;
  const why = e.why ? `<p class="px-l"><b>Why</b> <span data-i18n-skip>${esc(e.why)}</span></p>` : "";
  const chips = e.chips?.length ? `<div class="px-ccs">${e.chips.map((c) => `<span class="px-cc" data-i18n-skip>${esc(String(c))}</span>`).join("")}</div>` : "";
  const vis = e.vis != null && e.target ? `<span class="px-cc">${f("{n} of {n2} visible points", { n: e.vis, n2: e.target })}</span>` : "";
  return `<button type="button" class="px-err" data-rvj="${e.i}" data-rvq="imp"><span class="h"><b>${f("Turn {n}", { n: e.t })}</b><i class="px-cls c-${e.cls}">${CLS_NAME[e.cls]}</i>${D(-e.gp)}</span>${crops}<span class="mv"><s>You did</s> ${N(e.played)}</span><span class="mv"><s>Better (A)</s> ${N(e.better)}</span>${bars}${noiseLine(e)}${why}${chips || vis ? `<div class="px-ccs">${chips ? e.chips.map((c) => `<span class="px-cc" data-i18n-skip>${esc(String(c))}</span>`).join("") : ""}${vis}</div>` : ""}</button>`;
}
export function scoredNote(m) { const c = m.counts; return `<p class="px-fn"><span data-fact="scored:${m.pid}" data-v="${c.scored}">${f("{n} of {n2} decisions are scored", { n: c.scored, n2: c.total })}</span>${c.total > c.scored ? ` · <span>${f("{n} had only one sensible option", { n: c.total - c.scored })}</span>` : ""}</p>`; }
function lesson1(g, m) {
  const c = m.counts, list = m.lesson1.map((e) => errorCard(g, m, e)).join("");
  const head = lh(1, "Real errors", D(m.pillars.errors));
  const body = m.lesson1.length ? list : `<p class="px-l">${m.you ? "No clear mistake in your moves. Good play." : "No clear mistake in these moves."}</p>`;
  const ne = (m.notErrs || []).slice(0, 3).map((d) => `<span class="px-ne2"><i class="px-cls c-${d.cls}">${CLS_NAME[d.cls]}</i> ${f("Turn {n}", { n: d.t })} ${D(-d.gp)}${pm(d)}</span>`).join("");
  const notErr = c.notErrors ? `<div class="px-nerow"><small>NOT REAL ERRORS</small>${ne}</div>${ne ? `<p class="px-fn">± = the move’s own margin: a gap under twice that is not an error.</p>` : ""}` : "";
  const scoredLine = scoredNote(m);
  return `<section class="rv-card px-card px-l1">${head}${body}${notErr}${scoredLine}<button type="button" class="px-btn wide" data-pxtab="moves">All errors and moves</button></section>`;
}
// ── lesson 2 compact: "This board" ──
export const PLAN_NAME = { city: "City plan (ore, grain)", expansion: "Expansion plan (lumber, brick)", mixed: "Mixed plan" };
/** the start advice in plain words: what to take, from-to with the measured gap, and WHY when the better spot has fewer dots */
export function startAdvice(m, p) {
  const top = p.shortlist?.[0]; if (!p.advice || !top) return "";
  const x = p.advice.adds.map(rname).join(", "), a = p.win, b = top.win ?? p.best, fewer = p.spot && top.spot && top.spot.total < p.spot.total;
  return `<p class="px-adv">${f("Take {x} with pick {n}: {a}% → {b}% ({g}).", { x, n: p.n, a, b, g: `+${b - a}%` })}</p>${fewer ? `<p class="px-fn px-why">${f("Fewer dots ({a} against {b}), but {x} added.", { a: top.spot.total, b: p.spot.total, x })}</p>` : ""}`;
}
export const DOT_KEY = "Numbers on the tiles are dice numbers; dots = how often they roll.";
function lesson2c(g, m) {
  const s = m.start, p = s?.picks?.[0]; if (!p) return "";
  const top = p.shortlist?.[0], bd = m.board;
  const row = (lab, sp, node, win, key) => `<div class="px-br"><small>${lab}</small><span class="tl">${spotTiles(bd, node) || ""}</span><span class="dt"${sp ? ` data-fact="${key}dots:${m.pid}" data-v="${sp.total}"` : ""}>${sp ? f("{n} dots", { n: sp.total }) : ""}</span><b data-fact="${key}win:${m.pid}" data-v="${win ?? ""}">${win ?? "–"}%</b></div>`;
  return `<section class="rv-card px-card px-l2c">${lh(2, "This board", s.plan ? esc(PLAN_NAME[s.plan]) : "")}${row("PICK 1", p.spot, p.node, p.win, "pick1")}${top ? row("BEST SPOT", top.spot, top.node, top.win, "top1") : ""}<p class="px-fn px-dk">${DOT_KEY}</p>${startAdvice(m, p)}<button type="button" class="px-btn wide" data-pxtab="strategy">Start review in Strategy</button></section>`;
}
export function ruleRows(m) {
  const rules = m.lesson3 || [];
  return rules.map((r) => `<div class="px-rule"><div class="rl"><b>${esc(PHASE_NAME[r.phase])}</b><small>${f("turns {n}–{n2}", { n: r.from, n2: r.to })}</small></div><div class="rr"><p class="px-l" data-i18n-skip>${esc(r.text)}</p><div class="px-ccs">${r.chips.map((c) => `<button type="button" class="px-cc" data-rvj="${c.i}" data-rvq="imp"><span data-i18n-skip>${esc(c.chip || "")}</span> · ${f("Turn {n}", { n: c.turn })} ${D(-c.gp)}</button>`).join("")}${D(r.cost)}</div></div></div>`).join("");
}
function lesson3c(g, m) {
  const rows = ruleRows(m);
  return `<section class="rv-card px-card px-l3c">${lh(3, "Phase rules", "coach rules")}${rows || `<p class="px-l">No phase rule was broken.</p>`}<p class="px-fn">A rule shows only when you broke it.</p></section>`;
}
export const takeText = (t) => ({
  spend: "Spend your cards before you end the turn.", trade: "Trade only toward a build you can make.", build: "Pick the build that brings points soonest.",
  start: f("Take {x} with your first picks.", { x: rname(t.res) }), "start-any": "Check the numbers and resources of your start spots.",
}[t.key] || t.text || "");
function takeCard(g, m) {
  const tk = m.takeaway; if (!tk.length) return "";
  const sub = (t) => (t.lesson === 1 ? f("Turn {n} cost {d}%", { n: t.t, d: t.cost }) : t.lesson === 2 ? f("Start pick {n}: {a}% instead of {b}%", { n: t.k ?? 1, a: t.a ?? 0, b: t.b ?? 0 }) : f("{x} cost {d}%", { x: PHASE_NAME[t.phase], d: t.cost ?? 0 }));
  const rawText = (t) => (t.key && /^[a-z]+(-[a-z]+)+$/.test(t.key) && t.text ? " data-i18n-skip" : "");
  return `<section class="rv-card px-card px-take">${lh("", "Take with you", (tk.length === 1 ? "1 rule for the next game" : f("{n} rules for the next game", { n: tk.length }))).replace('<i class="px-nb"></i>', "")}<ol>${tk.map((t, i) => `<li><button type="button" class="px-tk" ${t.lesson === 1 ? `data-rvj="${t.i}" data-rvq="imp"` : 'data-pxtab="strategy"'}><i>${i + 1}</i><span><span${rawText(t)}>${esc(takeText(t))}</span><small>${sub(t)}</small></span>${IC.chev}</button></li>`).join("")}</ol><button type="button" class="px-btn wide" data-pxpractise>Practise these</button></section>`;
}
// ── ledger: what moved the win chance, four columns ──
const GL = { setup: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', luck: '<rect x="5" y="5" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9.5" cy="9.5" r="1.4"/><circle cx="14.5" cy="14.5" r="1.4"/>', moves: '<path d="M6 19V11M12 19V5M18 19v-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', rest: '<path d="M12 4v15M6 20h12M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' };
function ledgerCard(g, m) {
  const L = m.led; if (!L) return "";
  const per = m.counts.scored ? Math.round((ab(m.tot.moves) / m.counts.scored) * 10) / 10 : null;
  const cols = [["setup", "Start picks", L.setup, startCap(m, "your two start spots")], ["luck", "Luck", L.luck, "rolls and cards"], ["moves", "Moves", L.moves, per != null ? f("{n}% per move", { n: nfmt(per) }) : "after the start picks"]];
  const mx = Math.max(10, ...cols.filter(([k]) => k !== "rest").map(([, , v]) => ab(v)));
  const col = ([k, label, v, sub]) => `<div class="px-lc ${k}"><i class="ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GL[k]}</svg></i><span class="bz"><i class="${k === "rest" ? "n" : v >= 0 ? "up" : "dn"}" style="${v < 0 ? "top" : "bottom"}:50%;height:${Math.min(50, (ab(v) / mx) * 50).toFixed(1)}%"></i>${k === "rest" && ab(v) > mx ? `<em class="brk" aria-hidden="true">≈</em>` : ""}</span>${D(v, { fact: k === "luck" ? `luck:${m.pid}` : null })}<strong>${label}</strong><small>${sub}</small></div>`;
  const track = `<div class="px-gl"><small>Even <b>${L.even}%</b></small><i class="px-gt"><i class="a" style="width:${Math.max(2, L.even)}%"></i><i class="b" style="left:${Math.max(2, L.even)}%;width:${Math.max(0, L.end - L.even)}%"></i></i><small>End <b>${L.end}%</b></small></div>`;
  const how = `<ul class="px-how"><li>${f("The four rows add up to your change: from {n}% at the start to {n2}% at the end.", { n: L.even, n2: L.end })}</li><li>Start picks is what your two start spots cost against the best spots.</li><li>Luck is rolls, steals, card draws and seat order together.</li><li>Moves cost = start picks + moves.</li><li>Rest is neutral: it is what is left, the opponents’ doing.</li></ul>`;
  const story = `<p class="px-l">${m.you ? f("Your moves: {d}%", { d: dsg(L.moves) }) : f("{x}’s moves: {d}%", { x: esc(m.me.name), d: dsg(L.moves) })}</p>`;
  return `<div class="px-eb">${(() => { const pts = g.players.map((q) => q.victoryPoints).sort((a, b) => b - a); return f("Why it ended {n}–{n2}", { n: pts[0], n2: pts[1] ?? 0 }); })()}</div><section class="rv-card px-card px-led"><div class="rv-gt"><b>What moved your win chance</b><button type="button" class="px-link nm" data-pxnum>Numbers</button></div>${story}${track}<div class="px-lcs">${cols.map(col).join("")}</div><div class="px-rest"><span>What the others did</span>${D(L.rest, { plus: true })}<small>Their moves and luck combined, not a mark for you.</small></div>${fold("how", "<span>How to read this</span>", how)}</section>`;
}

export function overviewTab(g, ds, rv, prov) {
  const pid = g._rvPid, r = ready(g, pid);
  if (!r.m) return { html: progressCard(g, pid) };
  const m = r.m;
  return { html: `${verdictCard(g, m)}${timelineCard(g, m)}${lesson1(g, m)}${lesson2c(g, m)}${lesson3c(g, m)}${takeCard(g, m)}${ledgerCard(g, m)}`, bind: (el) => bindPost(g, el, m) };
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
  const m = ready(g, g._rvPid).m, rows = m?.infoRows;
  const own = `<h4>Why won or lost</h4><p>The one or two biggest swings of the player’s win chance on their side of the result, taken from the win-chance chart (pins). Each is named by its cause: the player’s own move, a roll, or what another player did. Income, cities and pace are in Strategy, compared with the best other player.</p><h4>Start picks</h4><p>The gap between your spot and the best spot is shown as it was measured. All moves together cannot cost more than the best win chance you had; when they add up to more, every part is shrunk to fit. Then the counted start cost is smaller than the measured gap, and the card shows both.</p><h4>The ± next to a move</h4><p>Every move has its own margin. A gap is only a real error when it is more than twice that margin; the same 4% can be an error in one move and not in another.</p><h4>Real errors and Could be better</h4><p>Real errors are mistakes, blunders and missed chances that pass that rule. Could be better is every other weaker move.</p><h4>Luck</h4><p>Luck is rolls, steals, card draws and seat order together, as win chance. Every player has an independent estimate of their own.</p>`;
  const body = rows?.length ? `<div class="px-ib"><div data-i18n-skip>${rows.map((r) => `<h4>${esc(r.title)}</h4><p>${esc(r.body)}</p>`).join("")}</div>${own}</div>`
    : `<div class="px-ib"><h4>The error rule</h4><p>A move is an error when it gave up at least twice its own margin (the ±), about 6% when none is stored. A close call is never called a mistake.</p><h4>${accWord} vs moves cost</h4><p>${accWord} is how often you were near the best move. Moves cost is what every miss lost, added up.</p>${own}</div>`;
  return sheet(g, "How to read this", body, "info");
}
export function numbersSheet(g) {
  const pid = g._rvPid, r = ready(g, pid); if (!r.m) return null;
  const m = r.m, S = m.seats, N = m.numbers;
  if (!N?.rows?.length) return null;
  const head = `<div class="px-nr hd"><span></span>${S.map((s) => `<b class="pc-${s.id}">${s.you ? "You" : esc(s.p.short || s.name)}</b>`).join("")}</div>`;
  const num1 = (v) => { const r1 = Math.round(v * 10) / 10; return nfmt(r1); };
  const cell = (row, v, s) => {
    if (v == null || !Number.isFinite(v)) return "–";
    if (row.id === "acc") return `<span data-fact="acc:${s.id}" data-v="${Math.round(v)}">${Math.round(v)}</span>`;
    if (row.id === "cost") return `<span data-fact="cost:${s.id}" data-v="${-Math.abs(Math.round(v))}">${D(-Math.abs(v)).replace(/^<b class="px-d (\w+)">/, "<b class=\"px-d $1\">")}</span>`;
    if (row.id === "cls.errors") return `<span data-fact="errors:${s.id}" data-v="${Math.round(v)}">${Math.round(v)}</span>`;
    if (row.id === "luck") return `<span data-fact="luck:${s.id}" data-v="${Math.round(s.luck ?? v)}">${dsg(s.luck ?? v)}%</span>`;
    if (row.unit === "pts" && /^pts\./.test(row.id)) return dsg(v);
    return num1(v);
  };
  const body = `<div class="px-num" style="--n:${S.length}">${head}${N.rows.map((row) => `<div class="px-nr"><span data-i18n-skip>${esc(row.label)}</span>${S.map((s, i) => `<b class="pc-${s.id}${s.id === pid ? " cur" : ""}">${cell(row, row.values[i], s)}</b>`).join("")}</div>`).join("")}</div>`;
  return sheet(g, "Numbers", body, "numbers");
}
export const nfmt = (v) => { try { return Number(v).toLocaleString(document.documentElement.lang === "nl" || /nl/.test(localStorage.getItem("colonist_lang") || "") ? "nl-NL" : "en-US", { maximumFractionDigits: 1 }); } catch (_) { return String(v); } };

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
