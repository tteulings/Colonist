// v1.99 Post-game UI, part 2: the Moves, Strategy and Luck tabs and the player page (see src/post-ui.js for the shared pieces and the Overview).
// Every number is a fact of the store (m.F, src/post-facts.js): this file asks for facts by id and never computes a displayed number.
import { esc, IC } from "./review-ui.js";
import { isNL } from "./i18n.js";
import { tr as atr } from "./review/analysis-text.js";
import { tradeShow } from "./review/evaluate.js";
import { resIcon } from "./lessons-view.js";
import { RES_COLOR } from "./resources.js";
import { pl, nErr, spotTiles, mvPiece, scoredNote, pm, startAdvice, DOT_KEY, f, CLS_NAME, PHASE_NAME, PLAN_NAME, RES_KEY, rname, infoBtn, fold, ready, progressCard, bindPost, who, whose, takeText, numbersSheet, chipText, waterSubs } from "./post-ui.js";
import { SRC_PARTS, FAMILY } from "./post-model.js";
import { luckRows, tableStore } from "./post-facts.js";
import { tableOf } from "./post-model.js";
import { inScope } from "./review/coach-rules.js";

const accWord = "Accuracy";
const reconTable = (m) => { const X = m.F, row = (l, ref) => `<span>${l}</span><b>${X.n(ref)}</b>`; return `<div class="px-rc">${row("Decisions", "decisions")}${X.v("oneOption") > 0 ? row("Only one sensible option", "oneOption") : ""}${row("Scored", "scored")}${row("Real errors", "errors")}${row("Start picks", "startN")}${row("Other decisions", "otherN")}</div>`; };
const stepText = (m) => (m.you ? "Step through your moves" : f("Step through {y}’s moves", { y: esc(m.me.name) }));
function lkLabel(g, X, lab, q) {
  const nm = (z) => (z === g._rvPid && g._rvIsYou?.(z) ? "You" : esc(g.players[z]?.name || "Someone"));
  if (!lab) return "";
  if (lab.k === "dice") return lab.rush ? X.ph("Rolled {n}", { n: [lab.n] }) : X.ph("{x} rolled {n}", { x: nm(lab.who), n: [lab.n] });
  if (lab.k === "seven") return X.ph("Cards lost ({x} rolled)", { x: [lab.n] });
  if (lab.k === "steal") return f("{x} stole a card from {y}", { x: nm(lab.thief), y: nm(lab.victim) });
  if (lab.k === "dev") return lab.vp ? f("{x} drew a point card", { x: nm(lab.who) }) : f("{x} drew a development card", { x: nm(lab.who) });
  void q; return "";
}
const when = (g, d) => (d.k === "setup" ? "Set-up" : f("Turn {n}", { n: d.t }));
export const mvText = (g, d) => { let t = ""; try { t = g._rvTerse(d); } catch (_) { t = tradeShow(d.x?.label || ""); } return t.split(" → ").map((x, i) => (isNL() ? mvPiece(x, i === 0) : `<span>${esc(x)}</span>`)).join(" → "); };
const mvRow = (g, m, d, q = "all") => `<button type="button" class="px-mv" data-rvj="${d.i}" data-rvq="${q}"><span class="t">${when(g, d)}</span><span class="x">${mvText(g, d)}<small><i class="px-cls c-${d.cls}">${CLS_NAME[d.cls]}</i></small></span><span class="px-dp">${m.F.d(`mv.${d.i}.cost`)}${pm(m.F, d.i)}</span>${IC.chev}</button>`;

// ───────────────────────── Moves ─────────────────────────
export function movesTab(g, ds, res, rv) {
  const r = ready(g, g._rvPid); if (!r.m) return { html: progressCard(g, g._rvPid) };
  const m = r.m, X = m.F;
  // ONE vocabulary: Real errors (the count every page shows) and Could be better (every other weaker move) are separate; strong and close calls as before
  const tiles = [["strong", "fam.strong", "Strong moves"], ["close", "fam.close", "Close calls"], ["costly", "fam.could", "Could be better"], ["err", "errors", "Real errors"]].map(([k, ref, l]) => `<div class="px-fam f-${k}${k === "err" && !X.v("errors") ? " z" : ""}"><b>${X.n(ref)}</b><span>${l}</span></div>`).join("");
  const cap = X.cost?.capped ? `<p class="px-fn">${X.ph("Together your moves cannot cost more than your best win chance ({w}).", { w: ["capNote"] })}</p>` : "";
  const head = `<section class="rv-card px-card"><div class="rv-gt"><b>${whose(m)} moves</b>${infoBtn("error")}</div><p class="px-l"><b>Moves in total</b> ${X.d("movesTotal")} · <b>${accWord} ${X.has(`acc:${m.pid}`) ? X.n(`acc:${m.pid}`) : "–"}</b></p><p class="px-fn px-ms">${X.ph("Start picks {a} + moves {b}", { a: ["startCost"], b: ["moveCost"] })}</p>${cap}<div class="px-fams">${tiles}</div>${reconTable(m)}</section>`;
  const first = m.errs[0]?.i ?? m.ds[0]?.i;
  const go = m.ds.length ? `<button type="button" class="px-btn pri go" data-rvj="${first}" data-rvq="${m.errs.length ? "imp" : "all"}">${IC.step}${stepText(m)}${m.errs.length ? ` · ${X.ph("{n} to look at", { n: ["errors"] })}` : ""}</button>` : "";
  const { miss, rest, restLt1 } = X.data;
  const restHead = `<span class="px-fl">${restLt1 ? X.ph("{n} more moves costing under {l} each", { n: ["restN"], l: ["lim.small:-"] }) : X.ph("{n} more moves", { n: ["restN"] })}</span>`;
  const missCard = `<section class="rv-card px-card"><div class="rv-gt"><b>${m.errs.length ? "Real errors" : "Smallest losses"}</b><small>${m.errs.length ? "biggest first" : "no clear error"}</small></div><p class="px-fn">± = the move’s own margin: a gap under twice that is not an error.</p>${miss.length ? miss.map((d) => mvRow(g, m, d, "imp")).join("") : `<p class="px-l">No move cost win chance.</p>`}${rest.length ? fold("rest", restHead, rest.map((d) => mvRow(g, m, d)).join("")) : ""}</section>`;
  // "Best moves": the lead over the NEXT option (a lead, never a win chance); a move that wins the game is marked instead of given a lead
  const lead = (o) => (o.d.B >= 99 ? `<span class="px-lead win"><b>Winning move</b></span>` : X.lead(`lead.${o.d.i}`));
  const best = m.bestRows.length ? `<section class="rv-card px-card"><div class="rv-gt"><b>Best moves</b><small>lead = how far ahead of the next-best option (not a win chance)</small></div>${m.bestRows.map((o) => `<button type="button" class="px-mv" data-rvj="${o.d.i}" data-rvq="all"><span class="t">${when(g, o.d)}</span><span class="x">${mvText(g, o.d)}<small><i class="px-cls c-${o.d.cls}">${CLS_NAME[o.d.cls]}</i></small></span><span class="px-dp">${lead(o)}</span>${IC.chev}</button>`).join("")}</section>` : "";
  return { html: `${head}${go}${missCard}${best}`, bind: (el) => bindPost(g, el, m) };
}

// ───────────────────────── Strategy ─────────────────────────
const spotMix = (X, pre, s) => (s ? RES_KEY.filter((r) => s.dots?.[r] > 0).map((r) => `<span class="px-rs">${resIcon(r, rname(r))}<b>${X.n(`${pre}.dots.${r}`)}</b></span>`).join("") : "");
function lesson2(g, m) {
  const X = m.F, S = m.start; if (!S?.picks?.length) return "";
  const plan = S.plan ? `<span class="px-plan">${esc(PLAN_NAME[S.plan] || "")}</span>` : "";
  const picks = S.picks.map((p) => {
    const nn = p.n, top = p.shortlist.map((c, k) => { const rf = X.slRef(nn, k, p); return `<div class="px-sl${c.played ? " me" : ""}"><b class="ltr">${"ABCDEF"[k]}</b><span class="mx">${spotTiles(m.board, c.node) || spotMix(X, `sl${nn}.${k}`, c.spot) || esc(c.label)}</span>${c.spot ? `<span class="dt">${X.ph("{n} dots", { n: [rf.dots] })}</span>` : ""}<em>${c.played ? f("you · pick {n}", { n: nn }) : ""}</em><b>${X.n(rf.win)}</b></div>`; }).join("");
    const adv = nn === 1 ? "" : startAdvice(m, p);
    const chip = p.followed ? `<span class="px-ok">Followed</span>` : p.advice ? `<span class="px-no">Not followed</span>` : `<span class="px-no"><span>${X.ph("Not followed: {a} instead of {b}", { a: [`pick${nn}.win`], b: [`pick${nn}.best`] })}</span> (${X.n(`pick${nn}.cost`)})</span>`;
    return `<div class="px-pick"><div class="ph"><i class="px-dash">${nn}</i><span class="mx">${spotTiles(m.board, p.node) || spotMix(X, `pick${nn}`, p.spot) || ""}</span>${p.spot ? `<span class="dt">${X.ph("{n} dots", { n: [`pick${nn}.dots`] })}</span>` : ""}<b>${X.n(`pick${nn}.win`)}</b>${chip}</div>${adv}${fold(`top${nn}`, `<span>${f("Pick {n}: top of the spots checked", { n: nn })}</span>`, `<div class="px-sls">${top}</div>`, { open: nn === 1 })}</div>`;
  }).join("");
  return `<section class="rv-card px-card px-l2"><div class="rv-gt"><b>Lesson 2 · This board</b>${plan}</div><p class="px-fn px-dk">${DOT_KEY}</p>${picks}${S.board ? "" : `<p class="px-fn">No board picture for this kind of game.</p>`}</section>`;
}
function lesson3(g, m) {
  const X = m.F, rules = m.lesson3 || [];
  const rows = rules.map((r) => `<div class="px-rule"><div class="rh"><b>${esc(PHASE_NAME[r.phase])}</b><small>${f("turns {n}–{n2}", { n: r.from, n2: r.to })}</small>${X.d(`rule.${r.phase}.cost`)}</div><p class="px-l" data-i18n-skip>${esc(r.text)}</p><div class="px-ccs">${r.chips.map((c, j) => `<button type="button" class="px-cc" data-rvj="${c.i}" data-rvq="imp">${chipText(m, r, c, j)} · ${f("Turn {n}", { n: c.turn })}${c.ck !== "rule.pts.chip" && X.has(`rule.${r.phase}.pts.${j}`) ? ` · ${X.ph("{n} of {n2} visible points", { n: [`rule.${r.phase}.pts.${j}`], n2: ["target:-"] })}` : ""}</button>`).join("")}</div></div>`).join("");
  const recon = `<p class="px-fn">${X.v("errCost") === 0 ? X.ph("No phase error. The moves in total ({c}) are the start picks and small moves.", { c: ["movesTotal"] }) : X.ph("Real errors {a} + start picks {b} + other moves {o} = moves in total {c}", { a: ["errCost"], b: ["startCost"], o: ["otherCost"], c: ["movesTotal"] })}</p>`;
  return `<section class="rv-card px-card px-l3"><div class="rv-gt"><b>Lesson 3 · Phase rules</b></div>${rows || `<p class="px-l">No phase rule was broken.</p>`}${recon}</section>`;
}
function teaser(g, m) { const X = m.F; return `<button type="button" class="rv-card px-card px-tz" data-pxtab="moves"><b>Lesson 1 · Real errors</b><span>${m.errs.length ? nErr(X) + ": " + "see them on the Moves tab" : "No clear error in this game"}</span>${IC.chev}</button>`; }

function tempoCard(g, m) {
  const tp = m.tempo; if (!tp) return "";
  const X = m.F, rng = (p) => (p.empty ? "–" : `${X.n(`ph.${p.k}.from:-`)}–${X.n(`ph.${p.k}.to:-`)}`);
  const head = `<div class="px-tg hd"><span></span><b>Start</b>${tp.phases.map((p) => `<b>${esc(PHASE_NAME[p.k])}<small>${rng(p)}</small></b>`).join("")}</div>`;
  const rows = tp.rows.map((r) => { const s = m.seats[r.id]; return `<div class="px-tg pc-${r.id}"><span class="nm">${g._av(s.p, "rt-av")}</span><span class="c st"><b>${X.n(`tempo.start:${r.id}`)}</b></span>${tp.phases.map((p, k) => `<span class="c"><i style="--w:${Math.round((r.gains[k] / tp.max) * 100)}%"></i><b>${X.n(`tempo.${p.k}:${r.id}`, { plus: true })}</b></span>`).join("")}</div>`; }).join("");
  return `<section class="rv-card px-card"><div class="rv-gt"><b>Tempo</b><small>points per phase · start + phases = final</small></div>${head}${rows}</section>`;
}
function glyphs(rowsB, T, id) {
  const W = 300, X = (t) => 6 + (t / Math.max(1, T)) * (W - 14);
  const g = (rowsB[id] || []).map(([t, k], i) => {
    const x = X(t).toFixed(1);
    if (k === "r") return `<rect x="${(+x - 3).toFixed(1)}" y="9" width="6" height="2.4" class="r"/>`;
    if (k === "s") return `<path d="M${(+x - 4).toFixed(1)} 13V7L${x} 3L${(+x + 4).toFixed(1)} 7V13Z" class="s"/>`;
    if (k === "c") return `<path d="M${(+x - 5).toFixed(1)} 16V6L${(+x - 1).toFixed(1)} 2L${(+x + 2).toFixed(1)} 6H${(+x + 6).toFixed(1)}V16Z" class="c"/>`;
    return `<rect x="${(+x - 2.5).toFixed(1)}" y="14" width="5" height="6" rx="1" class="d"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} 22" class="px-bt" role="img" aria-label="${esc(f("{n} builds", { n: (rowsB[id] || []).length }))}"><line x1="4" x2="${W - 4}" y1="11" y2="11" class="ax"/>${g}</svg>`;
}
function buildCard(g, m) {
  const B = m.builds; if (!B) return "";
  const rows = g.players.map((p) => `<div class="px-brow pc-${p.id}">${g._av(p, "rt-av")}${glyphs(B.rows, B.T, p.id)}</div>`).join("");
  const leg = `<div class="px-leg"><span><svg viewBox="0 0 10 10"><path d="M1 9V4L5 1L9 4V9Z" class="s"/></svg>Settlement</span><span><svg viewBox="0 0 10 10"><path d="M1 9V3L4 1L6 3H9V9Z" class="c"/></svg>City</span><span><svg viewBox="0 0 10 10"><rect x="1" y="4" width="8" height="2.4" class="r"/></svg>Road</span><span><svg viewBox="0 0 10 10"><rect x="2.5" y="1.5" width="5" height="7" rx="1" class="d"/></svg>Card</span></div>`;
  return `<section class="rv-card px-card px-bld"><div class="rv-gt"><b>Build timeline</b><small>${f("turns {n}–{n2}", { n: 1, n2: B.T })}</small></div>${rows}${leg}</section>`;
}
function incomeCard(g, m) {
  const X = m.F, I = m.income; if (!I || !I.some((r) => r.tot)) return "";
  const mx = Math.max(1, ...I.map((r) => r.tot));
  const rows = I.map((r) => `<div class="px-irow pc-${r.id}">${g._av(m.seats[r.id].p, "rt-av")}<span class="stk" style="--w:${Math.round((r.tot / mx) * 100)}%">${r.res.map((v, k) => (v ? `<i style="flex:${v} 1 0;background:${RES_COLOR[RES_KEY[k]] || "#999"}" title="${esc(rname(RES_KEY[k]))} ${v}"></i>` : "")).join("")}</span><b>${X.n(`inc.tot:${r.id}`)}</b></div>`).join("");
  const leg = `<div class="px-leg">${RES_KEY.map((k) => `<span>${resIcon(k, rname(k))}${esc(rname(k))}</span>`).join("")}</div>`;
  return `<section class="rv-card px-card"><div class="rv-gt"><b>Income per resource</b><small>cards the board paid</small></div>${rows}${leg}</section>`;
}
function measuresCard(g, m) {
  const X = m.F, M = m.measures; if (!M?.length) return "";
  const rows = M.map((r) => `<div class="px-mr"><span>${esc(r.label)}</span><b class="${r.mine >= r.best ? "top" : ""}">${X.n(`meas.${r.k}:${m.pid}`)}</b><b>${X.n(`measBest.${r.k}`)}</b>${X.d(`measDiff.${r.k}`, { signed: true })}</div>`).join("");
  return `<section class="rv-card px-card"><div class="rv-gt"><b>${f("{x} vs the best other player", { x: m.you ? "You" : esc(m.me.name) })}</b></div><p class="px-fn">Each row is compared with the other player who had the most, never with an average.</p><div class="px-mr hd"><span></span><b>${m.you ? "You" : esc(m.me.name)}</b><b>Best other</b><b></b></div>${rows}</section>`;
}
function rivalCard(g, m) {
  const X = m.F, R = m.rival; if (!R) return "";
  return `<section class="rv-card px-card px-rival"><div class="rv-gt"><b>Rival</b><small>${esc(PHASE_NAME[R.k])} · ${f("turns {n}–{n2}", { n: R.from, n2: R.to })}</small></div><p class="px-l">${X.ph("{x} gained {n} points here, {y} gained {n2}.", { x: esc(R.rname), n: ["rival.theirs"], y: m.you ? "you" : esc(m.me.name), n2: ["rival.mine"] })}</p>
    <div class="px-rv"><span class="pc-${R.rid}">${g._av(m.seats[R.rid].p, "rt-av")}<b>${X.n("rival.theirs", { plus: true })}</b><small>${X.ph("{n} builds", { n: ["rival.theirBuilds"] })}</small></span><span class="pc-${m.pid}">${g._av(m.me, "rt-av")}<b>${X.n("rival.mine", { plus: true })}</b><small>${X.ph("{n} builds", { n: ["rival.myBuilds"] })}</small></span></div></section>`;
}
function planCard(g, m) {
  const X = m.F, M = m.measures || [];
  const chips = [];
  M.forEach((r) => { if (r.mark) chips.push({ up: r.mark === "up", label: r.label, k: r.k }); });
  if (!chips.length) return "";
  const ch = (c) => `<span class="px-wh ${c.up ? "up" : "dn"}"><i aria-hidden="true">${c.up ? "▲" : "▼"}</i><span>${esc(c.label)}</span> <b>${X.ph("{a}, best other {b}", { a: [`meas.${c.k}:${m.pid}`], b: [`measBest.${c.k}`] })}</b></span>`;
  const up = chips.filter((c) => c.up), dn = chips.filter((c) => !c.up);
  const name = { city: "Cities first", expansion: "Expansion first", mixed: "Mixed" }[m.start?.plan] || "Your plan";
  return `<section class="rv-card px-card px-plan2"><div class="rv-gt"><b>${f("Plan: {x}", { x: name })}</b><small>${X.ph("{n} best · {k} lowest", { n: ["planUp"], k: ["planDn"] })}</small></div>${up.length ? `<div class="px-whr"><small>WORKED</small>${up.map(ch).join("")}</div>` : ""}${dn.length ? `<div class="px-whr"><small>HURT</small>${dn.map(ch).join("")}</div>` : ""}</section>`;
}
function scoreCard(g, m) {
  const X = m.F, M = m.measures; if (!M?.length) return "";
  const heads = m.seats.map((s) => `<span class="pc-${s.id}${s.id === m.pid ? " me" : ""}">${g._av(s.p, "rt-av")}</span>`).join("");
  // ▲ on every best value of the row (ties too), ▼ on every lowest, written IN the cell; a row where everybody is equal has neither
  const rows = M.map((r) => `<div class="px-sr"><span>${esc(r.label)}</span>${r.vals.map((v, i) => { const hi = r.best !== r.low && v === r.best, lo = r.best !== r.low && v === r.low; return `<b class="pc-${i}${hi ? " top" : ""}${lo ? " low" : ""}"${hi ? ' data-mk="up"' : lo ? ' data-mk="dn"' : ""}>${hi ? `<i class="u" aria-hidden="true">▲</i>` : lo ? `<i class="d" aria-hidden="true">▼</i>` : ""}${X.n(`meas.${r.k}:${i}`)}<em class="rk">${X.n(`rank.${r.k}:${i}`, { ord: true })}</em></b>`; }).join("")}</div>`).join("");
  return `<section class="rv-card px-card px-sc2" style="--n:${m.seats.length}"><div class="rv-gt"><b>Scorecard</b><small>▲ highest, ▼ lowest · place in grey</small></div><div class="px-sr hd"><span></span>${heads}</div>${rows}<p class="px-fn">Only within this game.</p></section>`;
}
export function strategyTab(g, ds, rv) {
  const r = ready(g, g._rvPid); if (!r.m) return { html: progressCard(g, g._rvPid) };
  const m = r.m;
  return { html: `${planCard(g, m)}${teaser(g, m)}${lesson2(g, m)}${lesson3(g, m)}${tempoCard(g, m)}${rivalCard(g, m)}${buildCard(g, m)}${incomeCard(g, m)}${scoreCard(g, m)}`, bind: (el) => bindPost(g, el, m) };
}

// ───────────────────────── Luck ─────────────────────────
export function luckTab(g, ds) {
  const R = g._rv, LK = g._lkState(), pid = g._rvPid;
  if (LK.na) return { html: `<section class="rv-card px-card"><div class="rv-gt"><b>Luck</b></div><p class="px-l">Luck in win chance is not available for this game.</p></section>` };
  if (!LK.done || LK.cover < 0.9) return { html: `<section class="rv-card px-card"><div class="rv-gt"><b>Luck</b></div>${(() => { try { return g._rvTableProg(R, LK) || ""; } catch (_) { return ""; } })() || `<p class="px-l">The luck check has not finished yet.</p>`}</section>` };
  const r = ready(g, pid), m = r.m;
  const U = (g._pxLuck ||= { unit: "win", pid: null });
  if (U.pid == null || !g.players[U.pid]) U.pid = pid;
  const seats = m ? m.seats : null; if (!seats) return { html: progressCard(g, pid) };
  const X = m.F, cardsOk = seats.every((s) => s.cards != null), unit = U.unit === "cards" && cardsOk ? "cards" : "win";
  const ref = (s) => (unit === "cards" ? `cards:${s.id}` : `luck:${s.id}`), val = (s) => X.v(ref(s)), sorted = [...seats].sort((a, b) => (val(b) ?? -1e9) - (val(a) ?? -1e9));
  const mx = Math.max(5, ...seats.map((s) => Math.abs(val(s) ?? 0)));
  const bar = (v) => `<i class="px-zb"><i class="${v >= 0 ? "up" : "dn"}" style="${v < 0 ? "right" : "left"}:50%;width:${Math.min(50, (Math.abs(v) / mx) * 50).toFixed(1)}%"></i></i>`;
  const rows = sorted.map((s) => `<button type="button" class="px-lk pc-${s.id}${s.id === U.pid ? " on" : ""}" data-pxlk="${s.id}" aria-pressed="${s.id === U.pid}">${g._av(s.p, "rt-av")}<span class="nm">${s.you ? "You" : esc(s.name)}</span>${bar(val(s) ?? 0)}${X.d(ref(s))}</button>`).join("");
  const seg = `<div class="px-seg" role="group" aria-label="Unit"><button type="button" class="${unit === "win" ? "on" : ""}" aria-pressed="${unit === "win"}" data-pxunit="win">Win chance</button>${cardsOk ? `<button type="button" class="${unit === "cards" ? "on" : ""}" aria-pressed="${unit === "cards"}" data-pxunit="cards">Cards</button>` : ""}</div>`;
  const head = `<section class="rv-card px-card"><div class="rv-gt"><b>Luck per player</b>${seg}</div>${rows}<p class="px-fn">Each player has an own estimate (rolls, steals, card draws).</p></section>`;
  // events of the chosen player
  const q = U.pid, cards = unit === "cards", showOthers = !!U.others, L = luckRows(X, g, m, q, unit, showOthers), SHOW = 8;
  const whenT = (t) => { const mm = /^[TB](\d+)$/.exec(String(t || "")); return mm ? f("Turn {n}", { n: mm[1] }) : esc(t || ""); };
  const evRow = (G, sub = false) => `<div class="px-ev${sub ? " sub" : ""}"><span class="t">${whenT(G.t)}</span><span class="x"><span class="ln">${lkLabel(g, X, G.lab, q)}${G.more ? ` <em>(+${X.n(G.more)})</em>` : ""}</span></span>${X.d(G.id, { word: G.inCards })}</div>`;
  const seatRow = L.seatId ? `<div class="px-ev"><span class="t">start</span><span class="x">Seat order</span>${X.d(L.seatId)}</div>` : "";
  const othBtn = L.othN ? `<button type="button" class="px-ev px-eg" data-pxothers aria-expanded="${showOthers}"><span class="t"></span><span class="x"><b>${X.ph(showOthers ? "Hide {n} rolls" : "Show {n} rolls", { n: [L.nOthRef] })}</b>${L.bigO ? `<small><span>biggest</span> ${X.n(L.bigO.id, { word: cards })} · ${whenT(L.bigO.t)}</small>` : ""}</span>${X.d(L.othSum, { word: cards })}</button>` : "";
  const own = q === pid && m.you, sub = own ? "Your seat, rolls and cards" : f("{x}’s seat, rolls and cards", { x: esc(g.players[q].name) });
  const totalPill = L.total ? X.d(L.total, { word: cards }) : "";
  const evs = `<section class="rv-card px-card"><div class="rv-gt"><b>${own ? "Your luck" : f("{x}’s luck", { x: esc(g.players[q].name) })}</b><small>${cards ? "cards above or below expected" : "win chance, biggest first"}</small></div><p class="px-fn">Every roll, steal and card changes your win chance. (+n) = more events that turn.</p><div class="px-sh">${sub}</div>${seatRow}${L.big.slice(0, SHOW).map((G) => evRow(G)).join("")}${L.big.length > SHOW ? fold("lkmore", `<span>${X.ph("{n} more turns", { n: [L.moreRef] })}</span>`, L.big.slice(SHOW).map((G) => evRow(G)).join("")) : ""}${L.small.length ? fold("lksmall", `<span>${X.ph("{n} turns with almost no effect", { n: [L.smallRef] })}</span>`, L.small.map((G) => evRow(G)).join("")) : ""}<div class="px-sh">Other players’ rolls</div>${othBtn}${L.oth.map((G) => evRow(G, true)).join("")}<div class="px-ev tot"><span class="t"></span><span class="x"><b>Total</b>${cards ? "<small>dice only; steals, discards and sevens stay in win chance</small>" : ""}</span>${totalPill}</div></section>`;
  return { html: `${head}${evs}`, bind: (el) => {
    bindPost(g, el, m);
    el.querySelectorAll("[data-pxlk]").forEach((b) => b.addEventListener("click", () => { U.pid = +b.dataset.pxlk; g._rvDrawReview(); }));
    el.querySelector("[data-pxothers]")?.addEventListener("click", () => { U.others = !U.others; g._rvDrawReview(); });
    el.querySelectorAll("[data-pxunit]").forEach((b) => b.addEventListener("click", () => { U.unit = b.dataset.pxunit; g._rvDrawReview(); }));
  } };
}

/** "Why won / lost" on the player page: the parts the headline carries (best or costliest own move, the start picks, the luck), one row each, from the same facts as the waterfall */
function whyCard(g, m, p) {
  const X = m.F, P = X.data.head, lg = isNL() ? "nl" : "en", at = (k, v) => atr(lg, k, v), sk = (x) => `<span data-i18n-skip>${x}</span>`, subs = waterSubs(m);
  const row = (l, d, c) => `<div class="px-wr"><b>${sk(l)}</b><span>${d || ""}</span>${c}</div>`;
  const rows = [];
  if (P?.own?.k === "best") rows.push(`<div class="px-wr"><b>${sk(at("w.own.won"))}</b><span>${f("Turn {n}", { n: P.own.T })}</span>${X.d(`mom.${P.own.S}.move`)}</div>`);
  else if (X.data.wf?.miss) { const d = X.data.wf.miss; rows.push(`<div class="px-wr"><b>${sk(at("w.own.lost"))}</b><span>${mvText(g, d)}<em class="px-tn">${f("Turn {n}", { n: d.t })}</em></span>${X.d(`mv.${d.i}.cost`)}</div>`); }
  const picks = m.start?.picks?.length; rows.push(row(at("w.start"), picks ? subs.start : sk(at("w.nostart")), picks ? X.d("startCost") : ""));
  if (X.has("luck")) rows.push(row(at("w.luck"), subs.luck, X.d("luck")));
  return `<section class="rv-card px-card"><div class="rv-gt"><b>${g.winner === p ? "Why won" : "Why lost"}</b>${infoBtn("error")}</div>${rows.join("")}</section>`;
}
// ───────────────────────── player page ─────────────────────────
export function playerTab(g, ds, rv, prov) {
  const pid = g._rvPid, p = g.players[pid], r = ready(g, pid), X0 = r.m ? r.m.F : tableStore(g, tableOf(g));
  const bar = `<div class="rv-bar pp-bar"><button type="button" class="rv-btn" data-rvt="overview" data-rvpp="1" aria-label="Back to the overview">${IC.back}</button>${g._av(p, "rt-av")}<div><h3>${g._rvIsYou(pid) ? "You" : esc(p.name)}</h3><small>${pl(X0, `pts:${pid}`, "{n} point", "{n} points")}${g.winner === p ? " · winner" : ""}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review">${IC.info}</button></div>`;
  if (!r.m) return { bar, html: progressCard(g, pid) };
  const m = r.m, s = m.seat, X = m.F, src = s.src;
  const you = m.you;
  const pips = (() => { if (!src) return ""; const seq = []; SRC_PARTS.forEach(([k], q) => { for (let i = 0; i < (src[k] || 0); i += 1) seq.push(q); }); const total = Math.max(g.winPoints || 10, seq.length); return `<div class="px-pips" role="img" aria-label="${esc(f("{n} points", { n: s.pts }))}">${Array.from({ length: total }, (_, i) => `<i class="${i < seq.length ? `on s${seq[i]}` : ""}"></i>`).join("")}</div>`; })();
  const rows = src ? SRC_PARTS.filter(([k]) => src[k] > 0).map(([k, l]) => `<div class="px-pr"><i class="s${SRC_PARTS.findIndex(([z]) => z === k)}"></i><span>${l}</span><b>${pl(X, `src.${k}:${pid}`, "{n} point", "{n} points")}</b></div>`).join("") : "";
  const why = whyCard(g, m, p);
  const pts = src ? `<section class="rv-card px-card rsc pp-pts pc-${pid}"><div class="rv-gt"><b>Points</b><small>${pl(X, `pts:${pid}`, "{n} point", "{n} points")}</small></div>${pips}<div class="px-prs">${rows}</div></section>` : "";
  const acc = `<section class="rv-card px-card"><div class="rv-gt"><b>${accWord}</b></div><div class="px-big"><b>${X.has(`acc:${pid}`) ? X.n(`acc:${pid}`) : "–"}</b><small>Moves in total</small>${X.d("movesTotal")}</div><i class="px-meter"><i class="dot" style="left:${Math.max(0, Math.min(100, m.sum.acc ?? 0))}%"></i></i><div class="px-scale"><span>0</span><span>50</span><span>100</span></div></section>`;
  const luck = `<section class="rv-card px-card"><div class="rv-gt"><b>Luck</b></div><div class="px-big">${X.has("luck") ? X.d("luck") : `<b>–</b>`}<small>rolls, cards, seat</small></div>${X.has(`cards:${pid}`) ? `<p class="px-fn">${X.ph("Dice cards: {x} against expected", { x: [`cards:${pid}`, { signed: true }] })}</p>` : ""}</section>`;
  const errs = `<section class="rv-card px-card"><div class="rv-gt"><b>${you ? "Where it could be better" : "Their real errors"}</b><small>${nErr(X)}</small></div>${m.errs.length ? m.errs.slice(0, 5).map((d) => mvRow(g, m, d, "imp")).join("") : `<p class="px-l">No clear mistake.</p>`}</section>`;
  const go = m.ds.length ? `<button type="button" class="px-btn pri go" data-rvj="${m.errs[0]?.i ?? m.ds[0].i}" data-rvq="${m.errs.length ? "imp" : "all"}">${IC.step}${stepText(m)}</button>` : "";
  const num = `<button type="button" class="px-btn" data-pxnum>Numbers</button>`;
  return { bar, html: `${why}${pts}${acc}${luck}${errs}${go}${num}`, bind: (el) => bindPost(g, el, m) };
}
export { numbersSheet, who, takeText };
