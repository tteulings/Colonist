// v1.99 Post-game UI, part 1: shared pieces, the end screen's scorecard, the Overview tab, the Numbers and (i) sheets, and the install that swaps
// the v1.98 review screens for the v1.99 ones. Moves / Strategy / Luck / player page: src/post-tabs.js. Terugblik door, Bots, Bekijk bord: src/post-hist.js.
// Every number comes from src/post-model.js (ONE model per review and player, cached); every text is English here and Dutch through the
// localizer (src/i18n-nl-199p.js). Blocks whose data is missing (old saved reviews, Rush, Seafarers, 5-6 players) are simply not drawn.
import { esc, IC } from "./review-ui.js";
import { oicon } from "./ui-icons.js";
import { tradeShow, CLASSES } from "./review/evaluate.js";
import { cropSvg } from "./lessons-view.js";
import { modelOf, tableOf, hideCache, soloPid, SRC_PARTS, FAMILIES, FAMILY, kindOf, PHASES } from "./post-model.js";

// ── tiny helpers ──
export const f = (tpl, v = {}) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
export const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
export const ab = (v) => Math.abs(Math.round(v));
/** a signed win-chance change as a pill with an arrow: green ▲ / tinted ▼ for everybody; ±0 stays neutral */
export const D = (v, { unit = "%", plus = true } = {}) => {
  if (v == null || !Number.isFinite(v)) return `<b class="px-d z">–</b>`;
  const r = Math.round(v);
  if (r > 0) return `<b class="px-d up"><i aria-hidden="true">▲</i>${plus ? "+" : ""}${r}${unit}</b>`;
  if (r < 0) return `<b class="px-d dn"><i aria-hidden="true">▼</i>−${Math.abs(r)}${unit}</b>`;
  return `<b class="px-d z">±0${unit}</b>`;
};
export const CLS_NAME = { best: "Best", great: "Great", good: "Good", lean: "Better option", close: "Close call", could: "Could be better", mistake: "Mistake", blunder: "Blunder", missed: "Missed chance", triv: "No real choice" };
export const FAM_NAME = { strong: "Strong moves", close: "Close calls", costly: "Costly moves" };
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
    const acc = s.acc != null ? `<span class="px-chip"><small>${accWord}</small><b${s.accDone ? "" : ' class="prov"'}>${s.accDone ? "" : "~"}${s.acc}</b></span>`
      : s.accSt === "run" && s.running ? `<span class="px-chip wait"><small>${accWord}</small><b><i class="rv-ring" style="--p:${Math.round((100 * s.running.j) / Math.max(1, s.running.n))}%" aria-hidden="true"></i>${s.running.j}/${s.running.n}</b></span>`
      : `<span class="px-chip wait"><small>${accWord}</small><b>–</b></span>`;
    const luck = s.luck != null ? `<span class="px-chip"><small>Luck</small>${D(s.luck)}</span>` : s.cards != null && tab.LK.na ? `<span class="px-chip"><small>Luck</small>${D(s.cards, { unit: "" })}<em>cards</em></span>` : `<span class="px-chip wait"><small>Luck</small><b>–</b></span>`;
    const sc = s.src, bar = sc ? `<div class="px-src" role="img" aria-label="${esc(nm)}: ${used.filter(([q]) => sc[q] > 0).map(([q, l]) => `${l} ${sc[q]}`).join(", ")}"><div class="trk" style="--w:${Math.max(8, Math.min(100, Math.round((s.pts / maxV) * 100)))}">${used.map(([q]) => (sc[q] > 0 ? `<i class="s${si(q)}" style="flex:${sc[q]} 1 0">${sc[q]}</i>` : "")).join("")}</div></div>` : "";
    const isOpen = open === id;
    let det = "";
    if (isOpen) {
      const mm = id === tab.me ? m : (() => { try { return ready(g, id).m || null; } catch (_) { return null; } })();
      const vl = mm ? verdictLine(g, mm) : "";
      const band = s.level?.band && s.acc != null ? `<p class="px-l">${f("{x} bots usually score {n}–{n2}", { x: esc(s.level.label), n: Math.round(s.level.band[0] - s.level.band[1]), n2: Math.round(s.level.band[0] + s.level.band[1]) })}</p>` : "";
      det = `<div class="px-rd">${vl ? `<p class="px-l">${vl}</p>` : ""}${band}<button type="button" class="px-link" data-rvtab="${id}">${s.you ? "Your page" : f("{x}’s page", { x: esc(s.name) })}${IC.chev}</button></div>`;
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
export function verdictLine(g, m) { const l = m.verdict?.line; return l ? `<span data-i18n-skip>${esc(l)}</span>` : ""; }

// ───────────────────────── Overview ─────────────────────────
function resultLine(g, m) {
  const w = g.winner, me = m.me; if (!w) return `${who(m)} · ${me.victoryPoints}`;
  const oth = g.players.filter((q) => q !== w).map((q) => q.victoryPoints), top = Math.max(0, ...oth);
  if (w === me) return f(m.you ? "You won {n}–{n2}" : "{x} won {n}–{n2}", { x: esc(me.name), n: me.victoryPoints, n2: top });
  return f(m.you ? "{x} won {n}–{n2}" : "{x} won {n}–{n2}", { x: esc(w.name), n: w.victoryPoints, n2: me.victoryPoints });
}
const paceBar = (v, max, cls = "") => `<i class="px-bar ${cls}" style="--w:${Math.max(2, Math.min(100, Math.round((Math.abs(v) / Math.max(1, max)) * 100)))}%"></i>`;

function verdictCard(g, m) {
  const acc = m.sum.acc, P = m.pillars;
  const hl = m.verdict?.line ? `<p class="px-hl"><b>${resultLine(g, m)}</b><span data-i18n-skip>${esc(m.verdict.line)}</span></p>` : `<p class="px-hl"><b>${resultLine(g, m)}</b></p>`;
  const accLine = `<p class="px-l"><b>${accWord} ${acc ?? "–"}</b>: ${f("how often {x} near the best move", { x: m.you ? "you were" : "it was" })}. <b>${f("Moves cost {n}%", { n: ab(m.tot.moves) })}</b>: ${f("what every miss lost, added up", {})}.</p>`;
  const pil = (key, label, v, body) => fold(`pil-${key}`, `<span class="px-pl">${label}</span>${paceBar(v, Math.max(1, ab(P.total)), "dn")}${D(v)}`, body, { cls: "px-pil" });
  const errChips = m.errs.slice(0, 4).map((d) => `<button type="button" class="px-cc" data-rvj="${d.i}" data-rvq="imp">${f("Turn {n}", { n: d.t })} ${D(-d.gp)}</button>`).join("");
  const startChips = (m.start?.picks || []).map((p) => `<button type="button" class="px-cc" data-pxtab="strategy">${f("Pick {n}", { n: p.n })} ${D(-p.gp)}</button>`).join("");
  const pillars = `<div class="px-pils">
    ${pil("errors", "Real errors", P.errors, `<p class="px-l">${m.errs.length ? f("{n} clear mistakes or missed chances, the same ones as in Lesson 1.", { n: m.errs.length }) : "No clear mistake in this game."}</p><div class="px-ccs">${errChips}</div>`)}
    ${pil("start", "Start picks", P.start, `<p class="px-l">${startChips ? "What your two start spots cost against the best spots." : "No start picks were checked."}</p><div class="px-ccs">${startChips}</div>`)}
    ${pil("other", "Other moves", P.other, `<p class="px-l">${f("{n} small differences, each too small to call an error.", { n: m.other.filter((d) => d.gp >= 1).length })}</p><button type="button" class="px-link" data-pxtab="moves">Open the Moves tab${IC.chev}</button>`)}
    <div class="px-pt"><span>Moves cost</span>${D(P.total)}</div></div>`;
  return `<section class="rv-card px-card px-verdict" data-pxv>${hl}${accLine}${pillars}<div class="px-acts"><button type="button" class="px-btn" data-pxnum>Numbers</button>${infoBtn("error")}</div></section>`;
}

// the win chance timeline, phase bands and numbered pins
function timelineCard(g, m) {
  const tl = m.timeline; if (!tl) return "";
  const W = 336, H = 168, x0 = 30, x1 = W - 10, top = 22, bot = H - 22, T = Math.max(2, tl.T);
  const X = (t) => x0 + (t / T) * (x1 - x0), Y = (p) => top + (1 - p) * (bot - top);
  const bands = tl.phases.map((p, i) => `<rect x="${X(p.from - 1).toFixed(1)}" y="${top - 16}" width="${(X(p.to) - X(p.from - 1)).toFixed(1)}" height="${bot - top + 16}" class="b b${i}"/><text x="${((X(p.from - 1) + X(p.to)) / 2).toFixed(1)}" y="${top - 5}" text-anchor="middle" class="bl">${esc(PHASE_NAME[p.k])} · ${p.from}–${p.to}</text>`).join("");
  const grid = [0, 0.5, 1].map((p) => `<line x1="${x0}" x2="${x1}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" class="g"/><text x="${x0 - 4}" y="${(Y(p) + 3.5).toFixed(1)}" text-anchor="end">${p * 100}%</text>`).join("");
  const line = (q) => tl.lines[q].map((pt, i) => `${i ? "L" : "M"}${X(pt[0]).toFixed(1)},${Y(pt[1]).toFixed(1)}`).join("");
  const order = g.players.map((p) => p.id).filter((q) => q !== m.pid).concat(m.pid);
  const lines = order.map((q) => `<path class="pc-${q} ln${q === m.pid ? " me" : ""}" d="${line(q)}"/>`).join("");
  const mine = tl.lines[m.pid];
  const yAt = (t) => { let v = mine[0]?.[1] ?? 0.25; for (const pt of mine) if (pt[0] <= t) v = pt[1]; return v; };
  const pins = tl.pins.map((p) => `<g class="pin" data-pxstop="${p.T}"><circle cx="${X(p.T).toFixed(1)}" cy="${Y(yAt(p.T)).toFixed(1)}" r="9"/><text x="${X(p.T).toFixed(1)}" y="${(Y(yAt(p.T)) + 3.8).toFixed(1)}" text-anchor="middle">${p.n}</text></g>`).join("");
  const sPin = m.start?.picks?.length ? `<g class="pin s" data-pxstop="0"><circle cx="${x0}" cy="${Y(mine[0]?.[1] ?? 0.25).toFixed(1)}" r="9"/><text x="${x0}" y="${(Y(mine[0]?.[1] ?? 0.25) + 3.8).toFixed(1)}" text-anchor="middle">S</text></g>` : "";
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="px-tl" role="img" aria-label="${esc(f("Win chance of every player through the game, you from {n}% to {n2}%", { n: ab((mine[0]?.[1] ?? 0.25) * 100), n2: ab((mine[mine.length - 1]?.[1] ?? 0) * 100) }))}">${bands}${grid}${lines}${sPin}${pins}</svg>`;
  const tag = (p) => (p.move ? "Move" : Math.abs(p.e - p.b) && p.say && /rolled|drew/i.test(p.say) ? "Dice" : "Rest");
  const rows = tl.pins.map((p) => `<button type="button" class="px-km" data-pxstop="${p.T}"><span class="n">${p.n}</span><span class="t">${f("Turn {n}", { n: p.T })}</span><span class="x">${p.say}<small class="px-tag">${tag(p)}</small></span>${D(p.d)}</button>`).join("");
  const leg = `<div class="px-lgd">${g.players.map((p) => `<span class="pc-${p.id}"><i></i>${p.id === m.pid && m.you ? "You" : esc(p.short || p.name)}</span>`).join("")}</div>`;
  return `<section class="rv-card px-card px-time"><div class="rv-gt"><b>Win chance</b><small>${m.start?.picks?.length ? "S = your start picks, " : ""}numbers = key moments</small></div>${svg}${leg}<div class="px-kms">${rows}</div><button type="button" class="px-link" data-pxboard>Bekijk bord${IC.chev}</button></section>`;
}

// ── lesson 1: real errors ──
function errorCard(g, m, e) {
  const bd = m.board, N = (v) => esc(tradeShow(v || ""));
  const crops = bd && e.p && e.q && e.p[0] === e.q[0] ? `<div class="px-crops"><figure>${cropSvg(bd, e.p, { w: 120, color: "#B45A3C", label: "You did" })}<figcaption>You did</figcaption></figure><figure>${cropSvg(bd, e.q, { w: 120, color: "#2F7D6B", label: "Better" })}<figcaption>Better (A)</figcaption></figure></div>` : "";
  const bars = `<div class="px-wb"><small>Win chance after this move</small><div class="r"><span>You did</span><i class="px-bar me pc-${m.pid}" style="--w:${e.B}%"></i><b>${e.B}%</b></div><div class="r"><span>Better (A)</span><i class="px-bar a pc-${m.pid}" style="--w:${e.A}%"></i><b>${e.A}%</b></div></div>`;
  const why = e.why ? `<p class="px-l">${esc(e.why)}</p>` : "";
  const chips = e.chips?.length ? `<div class="px-ccs">${e.chips.map((c) => `<span class="px-cc">${esc(String(c))}</span>`).join("")}</div>` : "";
  return `<button type="button" class="px-err" data-rvj="${e.i}" data-rvq="imp"><span class="h"><i class="px-cls c-${e.cls}">${CLS_NAME[e.cls]}</i><b>${f("Turn {n}", { n: e.t })}</b>${D(-e.gp)}</span>${crops}<span class="mv"><s>You did</s> ${N(e.played)}</span><span class="mv"><s>Better (A)</s> ${N(e.better)}</span>${bars}${why}${chips}</button>`;
}
function lesson1(g, m) {
  const c = m.counts;
  const list = m.lesson1.map((e) => errorCard(g, m, e)).join("");
  const head = `<div class="rv-gt"><b>Lesson 1 · Real errors</b><small>${m.lesson1.length ? f("{n} to learn from", { n: m.lesson1.length }) : "none found"}</small>${infoBtn("error")}</div>`;
  const body = m.lesson1.length ? list : `<p class="px-l">${m.you ? "No clear mistake in your moves. Good play." : "No clear mistake in these moves."}</p>`;
  const scoredLine = `<p class="px-fn">${f("{n} of {n2} decisions are scored", { n: c.scored, n2: c.total })}${c.total > c.scored ? `; ${f("{n} had only one sensible option", { n: c.total - c.scored })}` : ""}.</p>`;
  const notErr = c.notErrors ? `<p class="px-ne"><b>Not errors</b>: ${f("{n} close calls and slight differences stay out of this list", { n: c.notErrors })}.</p>` : "";
  const more = c.errors > m.lesson1.length ? `<button type="button" class="px-link" data-pxtab="moves">${f("{n} more on the Moves tab", { n: c.errors - m.lesson1.length })}${IC.chev}</button>` : "";
  return `<section class="rv-card px-card px-l1">${head}${body}${notErr}${scoredLine}${more}</section>`;
}
// ── lessons 2 and 3, compact ──
export const PLAN_NAME = { city: "City plan (ore, grain)", expansion: "Expansion plan (lumber, brick)", mixed: "Mixed plan" };
function lessons23(g, m) {
  const s = m.start, picks = s?.picks || [];
  const l2 = s ? `<button type="button" class="px-lrow" data-pxtab="strategy"><b>Lesson 2 · This board</b><span>${s.plan ? esc(PLAN_NAME[s.plan]) : "Your start picks"}${picks.length ? `: ${picks.map((p) => `${f("pick {n}", { n: p.n })} ${p.followed ? "✓" : "▼" + p.gp + "%"}`).join(" · ")}` : ""}</span>${IC.chev}</button>` : "";
  const r = m.lesson3?.[0];
  const l3 = `<button type="button" class="px-lrow" data-pxtab="strategy"><b>Lesson 3 · At this point in the game</b><span>${r ? `${esc(PHASE_NAME[r.phase])}: <span data-i18n-skip>${esc(r.text)}</span>` : "No phase rule was broken."}</span>${IC.chev}</button>`;
  return `<section class="rv-card px-card px-l23">${l2}${l3}</section>`;
}
export const takeText = (t) => ({
  spend: "Spend your cards before you end the turn.", trade: "Trade only toward a build you can make.", build: "Pick the build that brings points soonest.",
  start: f("Take {x} with your first picks.", { x: rname(t.res) }), "start-any": "Check the numbers and resources of your start spots.",
}[t.key] || t.text || "");
function takeCard(g, m) {
  const tk = m.takeaway; if (!tk.length) return "";
  return `<section class="rv-card px-card px-take"><div class="rv-gt"><b>Take with you</b><small>for the next game</small></div><ol>${tk.map((t) => `<li><i>${t.lesson}</i><span${t.key && /^[a-z]+(-[a-z]+)+$/.test(t.key) && t.text ? " data-i18n-skip" : ""}>${esc(takeText(t))}</span></li>`).join("")}</ol><button type="button" class="px-btn pri" data-pxpractise>Practise these</button></section>`;
}
// ── ledger: what moved the win chance ──
function ledgerCard(g, m) {
  const L = m.led; if (!L) return "";
  const per = m.counts.scored ? Math.round((ab(m.tot.moves) / m.counts.scored) * 10) / 10 : null;
  const rows = [["Set-up", L.setup, "Your seat and your two start spots"], ["Luck", L.luck, "Rolls, steals, card draws and seat order"], ["Moves", L.moves, "What your moves gave up against best play"], ["Rest", L.rest, "What the opponents’ luck and moves did"]];
  const mx = Math.max(10, ...rows.map(([, v]) => ab(v)));
  const bar = (v, rest) => `<i class="px-zb"><i class="${rest ? "n" : v >= 0 ? "up" : "dn"}" style="${v < 0 ? "right" : "left"}:50%;width:${Math.min(50, (ab(v) / mx) * 50).toFixed(1)}%"></i></i>`;
  const body = rows.map(([k, v, s], i) => `<div class="px-lr${i === 3 ? " rest" : ""}"><span>${k}</span>${bar(v, i === 3)}${i === 3 ? `<b class="px-d z">${v > 0 ? "+" : v < 0 ? "−" : ""}${ab(v)}%</b>` : D(v)}</div>`).join("");
  const won = m.won, story = m.verdict?.text ? `<span data-i18n-skip>${esc(m.verdict.text)}</span>` : won ? (L.moves <= -10 ? f("{x} gave up {n}% against best play. {y} still won: the opponents fell away.", { x: m.you ? "Your moves" : "Its moves", n: ab(L.moves), y: m.you ? "You" : esc(m.me.name) }) : f("{x} won with clean play: moves cost only {n}%.", { x: m.you ? "You" : esc(m.me.name), n: ab(L.moves) })) : f("{x} started at {n}% and finished at {n2}%.", { x: m.you ? "You" : esc(m.me.name), n: L.even, n2: L.end });
  const how = `<ul class="px-how"><li>${f("The four rows add up to your change: from {n}% at the start to {n2}% at the end.", { n: L.even, n2: L.end })}</li><li>Set-up is the seat and your two start spots before the first roll.</li><li>Rest is neutral: it is what is left, the opponents’ doing.</li></ul>`;
  return `<section class="rv-card px-card px-led"><div class="rv-gt"><b>What moved your win chance</b><small>${per != null ? f("{n}% per move", { n: per }) : ""}</small></div><p class="px-l">${story}</p><div class="px-lrs">${body}</div>${fold("how", "<span>How to read this</span>", how)}</section>`;
}

export function overviewTab(g, ds, rv, prov) {
  const pid = g._rvPid, r = ready(g, pid);
  if (!r.m) return { html: progressCard(g, pid) };
  const m = r.m;
  return { html: `${verdictCard(g, m)}${timelineCard(g, m)}${lesson1(g, m)}${lessons23(g, m)}${takeCard(g, m)}${ledgerCard(g, m)}`, bind: (el) => bindPost(g, el, m) };
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
  const body = rows?.length ? `<div class="px-ib" data-i18n-skip>${rows.map((r) => `<h4>${esc(r.title)}</h4><p>${esc(r.body)}</p>`).join("")}</div>`
    : `<div class="px-ib"><h4>The error rule</h4><p>A move is an error when it gave up at least twice its own noise, about 6% when none is stored. A close call is never called a mistake.</p><h4>${accWord} vs moves cost</h4><p>${accWord} is how often you were near the best move. Moves cost is what every miss lost, added up.</p></div>`;
  return sheet(g, "How to read this", body, "info");
}
export function numbersSheet(g) {
  const pid = g._rvPid, r = ready(g, pid); if (!r.m) return null;
  const m = r.m, S = m.seats, N = m.numbers;
  if (!N?.rows?.length) return null;
  const head = `<div class="px-nr hd"><span></span>${S.map((s) => `<b class="pc-${s.id}">${s.you ? "You" : esc(s.p.short || s.name)}</b>`).join("")}</div>`;
  const fmt = (row, v) => (v == null || !Number.isFinite(v) ? "–" : row.unit === "pct" ? `${sgn(v)}${ab(v)}%` : row.unit === "pts" && /^pts\./.test(row.id) ? `+${v}` : String(Math.round(v * 10) / 10));
  const body = `<div class="px-num" style="--n:${S.length}" data-i18n-skip>${head}${N.rows.map((row) => `<div class="px-nr"><span>${esc(row.label)}</span>${S.map((s, i) => `<b class="pc-${s.id}${s.id === pid ? " cur" : ""}">${fmt(row, row.values[i])}</b>`).join("")}</div>`).join("")}</div>`;
  return sheet(g, "Numbers", body, "numbers");
}

// ───────────────────────── wiring ─────────────────────────
export function bindPost(g, el, m) {
  el.querySelectorAll("[data-pxtog]").forEach((b) => b.addEventListener("click", () => {
    const key = b.dataset.pxtog, box = b.closest(".px-fold"), body = box.querySelector(":scope > .px-fb"), open = body.hidden;
    body.hidden = !open; box.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open));
    (g._pxOpen ||= new Set())[open ? "add" : "delete"](key);
  }));
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
