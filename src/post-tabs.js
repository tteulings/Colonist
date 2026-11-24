// v1.99 Post-game UI, part 2: the Moves, Strategy and Luck tabs and the player page (see src/post-ui.js for the shared pieces and the Overview).
import { esc, IC } from "./review-ui.js";
import { isNL } from "./i18n.js";
import { tradeShow } from "./review/evaluate.js";
import { resIcon } from "./lessons-view.js";
import { RES_COLOR } from "./resources.js";
import { spotTiles, mvPiece, scoredNote, nErr, pm, startAdvice, startCap, DOT_KEY, verdictSpans, nfmt, dsg, f, D, sgn, ab, CLS_NAME, FAM_NAME, PHASE_NAME, PLAN_NAME, RES_KEY, rname, infoBtn, fold, ready, progressCard, bindPost, who, whose, takeText, numbersSheet } from "./post-ui.js";
import { FAMILIES, FAMILY, SRC_PARTS } from "./post-model.js";
import { inScope } from "./review/coach-rules.js";

const accWord = "Accuracy";
const reconTable = (m) => { const c = m.counts, row = (l, v, k) => `<span>${l}</span><b${k ? ` data-fact="${k}:${m.pid}" data-v="${v}"` : ""}>${v}</b>`; return `<div class="px-rc">${row("Decisions", c.total)}${c.total > c.scored ? row("Only one sensible option", c.total - c.scored) : ""}${row("Scored", c.scored, "scored")}${row("Real errors", c.errors)}${row("Start picks", c.startN)}${row("Other decisions", c.otherN)}</div>`; };
const stepText = (m) => (m.you ? "Step through your moves" : f("Step through {y}’s moves", { y: esc(m.me.name) }));
const RN = ["lumber", "brick", "wool", "grain", "ore"];
function lkLabel(g, ev, q) {
  const nm = (z) => (z === g._rvPid && g._rvIsYou?.(z) ? "You" : esc(g.players[z]?.name || "Someone"));
  if (ev.kind === "dice") return ev.rush ? f("Rolled {n}", { n: ev.roll }) : f("{x} rolled {n}", { x: nm(ev.roller), n: ev.roll });
  if (ev.kind === "steal") return f("{x} stole a card from {y}", { x: nm(ev.thief), y: nm(ev.victim) });
  if (ev.kind === "dev") return ev.card === "victoryPoint" ? f("{x} drew a point card", { x: nm(ev.pid) }) : f("{x} drew a development card", { x: nm(ev.pid) });
  return "";
}
const when = (g, d) => (d.k === "setup" ? "Set-up" : f("Turn {n}", { n: d.t }));
const mvText = (g, d) => { let t = ""; try { t = g._rvTerse(d); } catch (_) { t = tradeShow(d.x?.label || ""); } return t.split(" → ").map((x, i) => (isNL() ? mvPiece(x, i === 0) : `<span>${esc(x)}</span>`)).join(" → "); };
const mvRow = (g, d, q = "all") => `<button type="button" class="px-mv" data-rvj="${d.i}" data-rvq="${q}"><span class="t">${when(g, d)}</span><span class="x">${mvText(g, d)}<small><i class="px-cls c-${d.cls}">${CLS_NAME[d.cls]}</i></small></span><span class="px-dp">${D(-d.gp)}${pm(d)}</span>${IC.chev}</button>`;

// ───────────────────────── Moves ─────────────────────────
export function movesTab(g, ds, res, rv) {
  const r = ready(g, g._rvPid); if (!r.m) return { html: progressCard(g, g._rvPid) };
  const m = r.m, c = m.counts, fam = m.fam;
  // ONE vocabulary: Real errors (the count every page shows) and Could be better (every other weaker move) are separate; strong and close calls as before
  const nz = m.ds.filter((d) => d.cls !== "triv"), cnt = (k) => nz.filter((d) => FAMILY[d.cls] === k).length, nE = m.errs.length, nC = Math.max(0, cnt("costly") - nE);
  const tiles = [["strong", cnt("strong"), "Strong moves"], ["close", cnt("close"), "Close calls"], ["costly", nC, "Could be better"], ["err", nE, "Real errors"]].map(([k, v, l]) => `<div class="px-fam f-${k}${k === "err" && !v ? " z" : ""}"><b${k === "err" ? ` data-fact="errors:${m.pid}" data-v="${v}"` : ""}>${v}</b><span>${l}</span></div>`).join("");
  const head = `<section class="rv-card px-card"><div class="rv-gt"><b>${whose(m)} moves</b>${infoBtn("error")}</div><p class="px-l"><b>Moves cost</b> ${D(m.tot.moves, { fact: `cost:${m.pid}` })} · <b data-fact="acc:${m.pid}" data-v="${m.sum.acc ?? ""}">${accWord} ${m.sum.acc ?? "–"}</b></p><div class="px-fams">${tiles}</div>${reconTable(m)}</section>`;
  const first = m.errs[0]?.i ?? m.ds[0]?.i;
  const go = m.ds.length ? `<button type="button" class="px-btn pri go" data-rvj="${first}" data-rvq="${m.errs.length ? "imp" : "all"}">${IC.step}${stepText(m)}${m.errs.length ? ` · ${f("{n} to look at", { n: m.errs.length })}` : ""}</button>` : "";
  const miss = [...m.errs.slice(0, 4), ...m.other.filter((d) => d.cls !== "triv" && inScope(d) && d.gp >= 1).sort((a, b) => b.gp - a.gp || a.i - b.i).slice(0, 3)];
  const shown = new Set(miss.map((d) => d.i));
  const rest = m.ds.filter((d) => !shown.has(d.i) && d.cls !== "triv" && d.k !== "setup" && inScope(d)).sort((a, b) => b.gp - a.gp || a.i - b.i);
  const mx = rest.length ? Math.max(...rest.map((d) => d.gp)) : 0;
  const restN = Math.max(0, c.otherN - miss.filter((d) => !m.errs.includes(d)).length), restHead = `<span class="px-fl">${mx < 1 ? f("{n} more moves costing under 1% each", { n: restN }) : f("{n} more moves", { n: restN })}</span>`;
  const missCard = `<section class="rv-card px-card"><div class="rv-gt"><b>${m.errs.length ? "Real errors" : "Smallest losses"}</b><small>${m.errs.length ? "biggest first" : "no clear error"}</small></div><p class="px-fn">± = the move’s own margin: a gap under twice that is not an error.</p>${miss.length ? miss.map((d) => mvRow(g, d, "imp")).join("") : `<p class="px-l">No move cost win chance.</p>`}${rest.length ? fold("rest", restHead, rest.map((d) => mvRow(g, d)).join("")) : ""}</section>`;
  const best = m.bestRows.length ? `<section class="rv-card px-card"><div class="rv-gt"><b>Best moves</b><small>ahead of the second-best option</small></div>${m.bestRows.map((o) => `<button type="button" class="px-mv" data-rvj="${o.d.i}" data-rvq="all"><span class="t">${when(g, o.d)}</span><span class="x">${mvText(g, o.d)}<small><i class="px-cls c-${o.d.cls}">${CLS_NAME[o.d.cls]}</i></small></span>${D(o.gain)}${IC.chev}</button>`).join("")}</section>` : "";
  return { html: `${head}${go}${missCard}${best}`, bind: (el) => bindPost(g, el, m) };
}

// ───────────────────────── Strategy ─────────────────────────
const spotMix = (s) => (s ? RES_KEY.filter((r) => s.dots?.[r] > 0).map((r) => `<span class="px-rs">${resIcon(r, rname(r))}<b>${s.dots[r]}</b></span>`).join("") : "");
function lesson2(g, m) {
  const S = m.start; if (!S?.picks?.length) return "";
  const plan = S.plan ? `<span class="px-plan">${esc(PLAN_NAME[S.plan] || "")}</span>` : "";
  const picks = S.picks.map((p) => {
    const top = p.shortlist.map((c, k) => `<div class="px-sl${c.played ? " me" : ""}"><b class="ltr">${"ABCDEF"[k]}</b><span class="mx">${spotTiles(m.board, c.node) || spotMix(c.spot) || esc(c.label)}</span>${c.spot ? `<span class="dt"${p.n === 1 && k === 0 ? ` data-fact="top1dots:${m.pid}" data-v="${c.spot.total}"` : ""}>${f("{n} dots", { n: c.spot.total })}</span>` : ""}<em>${c.played ? f("you · pick {n}", { n: p.n }) : ""}</em><b ${p.n === 1 && k === 0 ? `data-fact="top1win:${m.pid}" data-v="${c.win ?? ""}"` : ""}>${c.win ?? "–"}%</b></div>`).join("");
    const adv = startAdvice(m, p);
    const chip = p.followed ? `<span class="px-ok">Followed</span>` : `<span class="px-no"><span>${f("Not followed: {a}% instead of {b}%", { a: p.win, b: p.shortlist?.[0]?.win ?? p.best })}</span> (${dsg(p.win - (p.shortlist?.[0]?.win ?? p.best))}%)</span>`;
    return `<div class="px-pick"><div class="ph"><i class="px-dash">${p.n}</i><span class="mx">${spotTiles(m.board, p.node) || spotMix(p.spot) || ""}</span>${p.spot ? `<span class="dt" ${p.n === 1 ? `data-fact="pick1dots:${m.pid}" data-v="${p.spot.total}"` : ""}>${f("{n} dots", { n: p.spot.total })}</span>` : ""}<b ${p.n === 1 ? `data-fact="pick1win:${m.pid}" data-v="${p.win}"` : ""}>${p.win}%</b>${chip}</div>${adv}${fold(`top${p.n}`, "<span>Top of the spots checked: A to F, best first</span>", `<div class="px-sls">${top}</div>`, { open: p.n === 1 })}</div>`;
  }).join("");
  const startNote = startCap(m, "") ? `<p class="px-fn">${f("In Moves cost the start counts {x}: all moves together cannot cost more than your best win chance.", { x: `${dsg(m.pillars.start)}%` })}</p>` : "";
  return `<section class="rv-card px-card px-l2"><div class="rv-gt"><b>Lesson 2 · This board</b>${plan}</div><p class="px-fn px-dk">${DOT_KEY}</p>${picks}${startNote}${S.board ? "" : `<p class="px-fn">No board picture for this kind of game.</p>`}</section>`;
}
function lesson3(g, m) {
  const rules = m.lesson3 || [];
  const costs = m.phaseCost.reduce((a, p) => a + p.cost, 0), rest = m.pillars.total - costs;
  const rows = rules.map((r) => `<div class="px-rule"><div class="rh"><b>${esc(PHASE_NAME[r.phase])}</b><small>${f("turns {n}–{n2}", { n: r.from, n2: r.to })}</small>${D(r.cost)}</div><p class="px-l" data-i18n-skip>${esc(r.text)}</p><div class="px-ccs">${r.chips.map((c) => `<button type="button" class="px-cc" data-rvj="${c.i}" data-rvq="imp"><span data-i18n-skip>${esc(c.chip || "")}</span> · ${f("Turn {n}", { n: c.turn })}${c.pts != null ? ` · ${f("{n} of {n2} visible points", { n: c.pts, n2: c.target })}` : ""}</button>`).join("")}</div></div>`).join("");
  const recon = m.counts && m.pillars ? `<p class="px-fn">${f("Together {c}%: errors {a}%, start and small moves {b}%", { a: dsg(costs), b: dsg(rest), c: dsg(m.pillars.total) })}</p>` : "";
  return `<section class="rv-card px-card px-l3"><div class="rv-gt"><b>Lesson 3 · Phase rules</b></div>${rows || `<p class="px-l">No phase rule was broken.</p>`}${recon}</section>`;
}
function teaser(g, m) { return `<button type="button" class="rv-card px-card px-tz" data-pxtab="moves"><b>Lesson 1 · Real errors</b><span>${m.errs.length ? nErr(m.errs.length) + ": " + "see them on the Moves tab" : "No clear error in this game"}</span>${IC.chev}</button>`; }

function tempoCard(g, m) {
  const tp = m.tempo; if (!tp) return "";
  const head = `<div class="px-tg hd"><span></span>${tp.phases.map((p) => `<b>${esc(PHASE_NAME[p.k])}<small>${p.empty ? "–" : `${p.from}–${p.to}`}</small></b>`).join("")}</div>`;
  const rows = tp.rows.map((r) => { const s = m.seats[r.id]; return `<div class="px-tg pc-${r.id}"><span class="nm">${g._av(s.p, "rt-av")}</span>${r.gains.map((v) => `<span class="c"><i style="--w:${Math.round((v / tp.max) * 100)}%"></i><b>+${v}</b></span>`).join("")}</div>`; }).join("");
  return `<section class="rv-card px-card"><div class="rv-gt"><b>Tempo</b><small>game points gained per phase</small></div>${head}${rows}</section>`;
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
  return `<section class="rv-card px-card px-bld"><div class="rv-gt"><b>Build timeline</b><small>turn 1 to ${B.T}</small></div>${rows}${leg}</section>`;
}
function incomeCard(g, m) {
  const I = m.income; if (!I || !I.some((r) => r.tot)) return "";
  const mx = Math.max(1, ...I.map((r) => r.tot));
  const rows = I.map((r) => `<div class="px-irow pc-${r.id}">${g._av(m.seats[r.id].p, "rt-av")}<span class="stk" style="--w:${Math.round((r.tot / mx) * 100)}%">${r.res.map((v, k) => (v ? `<i style="flex:${v} 1 0;background:${RES_COLOR[RES_KEY[k]] || "#999"}" title="${esc(rname(RES_KEY[k]))} ${v}"></i>` : "")).join("")}</span><b>${r.tot}</b></div>`).join("");
  const leg = `<div class="px-leg">${RES_KEY.map((k) => `<span>${resIcon(k, rname(k))}${esc(rname(k))}</span>`).join("")}</div>`;
  return `<section class="rv-card px-card"><div class="rv-gt"><b>Income per resource</b><small>cards the board paid</small></div>${rows}${leg}</section>`;
}
function measuresCard(g, m) {
  const M = m.measures; if (!M?.length) return "";
  const rows = M.map((r) => `<div class="px-mr"><span>${esc(r.label)}</span><b class="${r.mine >= r.best ? "top" : ""}">${nfmt(r.mine)}</b><b>${nfmt(r.bestOther)}</b>${D(r.diff, { unit: "" })}</div>`).join("");
  return `<section class="rv-card px-card"><div class="rv-gt"><b>${f("{x} vs the best other player", { x: m.you ? "You" : esc(m.me.name) })}</b></div><p class="px-fn">Each row is compared with the other player who had the most, never with an average.</p><div class="px-mr hd"><span></span><b>${m.you ? "You" : esc(m.me.name)}</b><b>Best other</b><b></b></div>${rows}</section>`;
}
function rivalCard(g, m) {
  const R = m.rival; if (!R) return "";
  return `<section class="rv-card px-card px-rival"><div class="rv-gt"><b>Rival</b><small>${esc(PHASE_NAME[R.k])} · ${f("turns {n}–{n2}", { n: R.from, n2: R.to })}</small></div><p class="px-l">${f("{x} gained {n} points here, {y} gained {n2}.", { x: esc(R.rname), n: R.theirs, y: m.you ? "you" : esc(m.me.name), n2: R.mine })}</p>
    <div class="px-rv"><span class="pc-${R.rid}">${g._av(m.seats[R.rid].p, "rt-av")}<b>+${R.theirs}</b><small>${f("{n} builds", { n: R.theirBuilds })}</small></span><span class="pc-${m.pid}">${g._av(m.me, "rt-av")}<b>+${R.mine}</b><small>${f("{n} builds", { n: R.myBuilds })}</small></span></div></section>`;
}
function planCard(g, m) {
  const M = m.measures || [], picks = m.start?.picks || [];
  const chips = [];
  M.forEach((r) => { if (r.mark) chips.push({ up: r.mark === "up", label: r.label, a: r.mine, b: r.bestOther }); });
  if (!chips.length) return "";
  const ch = (c) => `<span class="px-wh ${c.up ? "up" : "dn"}"><i aria-hidden="true">${c.up ? "▲" : "▼"}</i><span>${esc(c.label)}</span> <b>${f("{a}, best other {b}", { a: nfmt(c.a), b: nfmt(c.b) })}</b></span>`;
  const up = chips.filter((c) => c.up), dn = chips.filter((c) => !c.up);
  const name = { city: "Cities first", expansion: "Expansion first", mixed: "Mixed" }[m.start?.plan] || "Your plan";
  return `<section class="rv-card px-card px-plan2"><div class="rv-gt"><b>${f("Plan: {x}", { x: name })}</b><small>${f("{n} best · {k} lowest", { n: up.length, k: dn.length })}</small></div>${up.length ? `<div class="px-whr"><small>WORKED</small>${up.map(ch).join("")}</div>` : ""}${dn.length ? `<div class="px-whr"><small>HURT</small>${dn.map(ch).join("")}</div>` : ""}</section>`;
}
function scoreCard(g, m) {
  const M = m.measures; if (!M?.length) return "";
  const heads = m.seats.map((s) => `<span class="pc-${s.id}${s.id === m.pid ? " me" : ""}">${g._av(s.p, "rt-av")}</span>`).join("");
  // ▲ on every best value of the row (ties too), ▼ on every lowest, written IN the cell; a row where everybody is equal has neither
  const rows = M.map((r) => `<div class="px-sr"><span>${esc(r.label)}</span>${r.vals.map((v, i) => { const hi = r.best !== r.low && v === r.best, lo = r.best !== r.low && v === r.low; return `<b class="pc-${i}${i === m.pid ? " me" : ""}${hi ? " top" : ""}${lo ? " low" : ""}"${hi ? ' data-mk="up"' : lo ? ' data-mk="dn"' : ""}>${hi ? `<i class="u" aria-hidden="true">▲</i>` : lo ? `<i class="d" aria-hidden="true">▼</i>` : ""}${v}</b>`; }).join("")}</div>`).join("");
  return `<section class="rv-card px-card px-sc2" style="--n:${m.seats.length}"><div class="rv-gt"><b>Scorecard</b><small>▲ highest, ▼ lowest in the row</small></div><div class="px-sr hd"><span></span>${heads}</div>${rows}<p class="px-fn">Only within this game.</p></section>`;
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
  const cardsOk = seats.every((s) => s.cards != null), unit = U.unit === "cards" && cardsOk ? "cards" : "win";
  const val = (s) => (unit === "cards" ? s.cards : s.luck), sorted = [...seats].sort((a, b) => (val(b) ?? -1e9) - (val(a) ?? -1e9));
  const mx = Math.max(5, ...seats.map((s) => Math.abs(val(s) ?? 0)));
  const bar = (v) => `<i class="px-zb"><i class="${v >= 0 ? "up" : "dn"}" style="${v < 0 ? "right" : "left"}:50%;width:${Math.min(50, (Math.abs(v) / mx) * 50).toFixed(1)}%"></i></i>`;
  const rows = sorted.map((s) => `<button type="button" class="px-lk pc-${s.id}${s.id === U.pid ? " on" : ""}" data-pxlk="${s.id}" aria-pressed="${s.id === U.pid}">${g._av(s.p, "rt-av")}<span class="nm">${s.you ? "You" : esc(s.name)}</span>${bar(val(s) ?? 0)}${D(val(s), { unit: unit === "cards" ? "" : "%" })}</button>`).join("");
  const seg = `<div class="px-seg" role="group" aria-label="Unit"><button type="button" class="${unit === "win" ? "on" : ""}" aria-pressed="${unit === "win"}" data-pxunit="win">Win chance</button>${cardsOk ? `<button type="button" class="${unit === "cards" ? "on" : ""}" aria-pressed="${unit === "cards"}" data-pxunit="cards">Cards</button>` : ""}</div>`;
  const head = `<section class="rv-card px-card"><div class="rv-gt"><b>Luck per player</b>${seg}</div>${rows}<p class="px-fn">Each player has an own estimate (rolls, steals, card draws).</p></section>`;
  // events of the chosen player
  const q = U.pid, list = (() => { try { return g._lkList(q).filter((x) => x.own); } catch (_) { return []; } })(), seatW = (() => { try { return g._lkSeat(q); } catch (_) { return 0; } })();
  const ev = list.map((x) => {
    const diceCards = x.ev.kind === "dice" && x.cards != null && x.exp != null && x.ev.roll !== 7 ? Math.round((x.cards - x.exp) * 10) / 10 : null;
    return { x, win: Math.round(x.w * 1000) / 10, cards: diceCards, label: lkLabel(g, x.ev, q), t: (() => { try { return g._lkWhen(x.ev); } catch (_) { return ""; } })() };
  });
  const cards = unit === "cards";
  const rowU = (e) => (cards ? (e.cards != null ? e.cards : e.win) : e.win);
  const isFold = (e) => Math.abs(rowU(e)) < 0.5;
  // own events: this player's rolls, steals and draws. Everything rolled by the OTHER players is one group, so the group sum is exactly the sum of its rows
  const isOwn = (e) => e.x.ev.kind !== "dice" || e.x.ev.roller === q;
  const showOthers = !!U.others, ownEv = ev.filter(isOwn), othEv = ev.filter((e) => !isOwn(e));
  const sumU = (l) => l.reduce((a, e) => a + (cards ? (e.cards ?? 0) : e.win), 0), uSuf = cards ? " cards" : "%";
  const whenT = (t) => { const mm = /^[TB](\d+)$/.exec(String(t || "")); return mm ? f("Turn {n}", { n: mm[1] }) : esc(t || ""); };
  const big = ownEv.filter((e) => !isFold(e)).sort((a, b) => Math.abs(rowU(b)) - Math.abs(rowU(a)));
  const small = ownEv.filter(isFold);
  const evRow = (e, sub = false) => { const winOnly = cards && e.cards == null, u = rowU(e); const lab = e.x.ev.kind === "dice" && e.x.ev.roll === 7 ? f("Cards lost ({x} rolled)", { x: 7 }) : e.label; return `<div class="px-ev${sub ? " sub" : ""}"><span class="t">${whenT(e.t)}</span><span class="x">${lab}</span>${D(u, { unit: cards && !winOnly ? " cards" : "%" })}</div>`; };
  const seatRow = seatW ? `<div class="px-ev"><span class="t">start</span><span class="x">Seat order</span>${D(Math.round(seatW * 1000) / 10)}</div>` : "";
  const othBtn = othEv.length ? `<button type="button" class="px-ev px-eg" data-pxothers aria-expanded="${showOthers}"><span class="t"></span><span class="x"><b>${f(showOthers ? "Hide the other players’ rolls ({n})" : "Show the other players’ rolls ({n})", { n: othEv.length })}</b></span>${D(Math.round(sumU(othEv)), { unit: uSuf })}</button>` : "";
  const othRows = showOthers ? othEv.slice().sort((a, b) => Math.abs(rowU(b)) - Math.abs(rowU(a))).map((e) => evRow(e, true)).join("") : "";
  const total = (() => { const w = Math.round((seatW + list.reduce((a, x) => a + x.w, 0)) * 100); const c = Math.round(ev.reduce((a, e) => a + (e.cards ?? 0), 0)); return cards ? `${D(c, { unit: "" })}` : D(seats[q].luck ?? w, { fact: q === pid ? `luck:${q}` : null }); })();
  const evs = `<section class="rv-card px-card"><div class="rv-gt"><b>${q === pid && m.you ? "Your luck" : f("{x}’s luck", { x: esc(g.players[q].name) })}</b><small>${cards ? "cards above or below expected" : "win chance, biggest first"}</small></div><p class="px-fn">Every roll, steal and card changes your win chance, other players’ rolls too.</p>${seatRow}${big.slice(0, 14).map((e) => evRow(e)).join("")}${big.length > 14 ? fold("lkmore", `<span>${f("{n} more events", { n: big.length - 14 })}</span>`, big.slice(14).map((e) => evRow(e)).join("")) : ""}${small.length ? fold("lksmall", `<span>${f("{n} events near ±0", { n: small.length })}</span>`, small.map((e) => evRow(e)).join("")) : ""}${othBtn}${othRows}<div class="px-ev tot"><span class="t"></span><span class="x"><b>Total</b>${cards ? "<small>dice only; steals, discards and the 7 stay in win chance</small>" : ""}</span>${total}</div></section>`;
  return { html: `${head}${evs}`, bind: (el) => {
    bindPost(g, el, m);
    el.querySelectorAll("[data-pxlk]").forEach((b) => b.addEventListener("click", () => { U.pid = +b.dataset.pxlk; g._rvDrawReview(); }));
    el.querySelector("[data-pxothers]")?.addEventListener("click", () => { U.others = !U.others; g._rvDrawReview(); });
    el.querySelectorAll("[data-pxunit]").forEach((b) => b.addEventListener("click", () => { U.unit = b.dataset.pxunit; g._rvDrawReview(); }));
  } };
}

// ───────────────────────── player page ─────────────────────────
export function playerTab(g, ds, rv, prov) {
  const pid = g._rvPid, p = g.players[pid], r = ready(g, pid), seats = (() => { try { return r.m?.seats || null; } catch (_) { return null; } })();
  const bar = `<div class="rv-bar pp-bar"><button type="button" class="rv-btn" data-rvt="overview" data-rvpp="1" aria-label="Back to the overview">${IC.back}</button>${g._av(p, "rt-av")}<div><h3>${g._rvIsYou(pid) ? "You" : esc(p.name)}</h3><small>${f("{n} points", { n: p.victoryPoints })}${g.winner === p ? " · winner" : ""}</small></div><button type="button" class="rv-btn rv-i" data-rvinfo aria-label="About this review">${IC.info}</button></div>`;
  if (!r.m) return { bar, html: progressCard(g, pid) };
  const m = r.m, s = m.seat, st = g._st, src = s.src;
  const you = m.you;
  const pips = (() => { if (!src) return ""; const seq = []; SRC_PARTS.forEach(([k], q) => { for (let i = 0; i < (src[k] || 0); i += 1) seq.push(q); }); const total = Math.max(g.winPoints || 10, seq.length); return `<div class="px-pips" role="img" aria-label="${esc(f("{n} points", { n: s.pts }))}">${Array.from({ length: total }, (_, i) => `<i class="${i < seq.length ? `on s${seq[i]}` : ""}"></i>`).join("")}</div>`; })();
  const rows = src ? SRC_PARTS.filter(([k]) => src[k] > 0).map(([k, l], q) => `<div class="px-pr"><i class="s${SRC_PARTS.findIndex(([z]) => z === k)}"></i><span>${l}</span><b>${f("{n} points", { n: src[k] })}</b></div>`).join("") : "";
  const why = `<section class="rv-card px-card"><div class="rv-gt"><b>${g.winner === p ? "Why won" : "Why lost"}</b>${infoBtn("error")}</div><p class="px-hl2">${verdictSpans(m)}</p></section>`;
  const pts = src ? `<section class="rv-card px-card rsc pp-pts pc-${pid}"><div class="rv-gt"><b>Points</b><small>${f("{n} points", { n: s.pts })}</small></div>${pips}<div class="px-prs">${rows}</div></section>` : "";
  const band = s.level?.band && s.acc != null ? `<p class="px-l">${f("{x} bots usually score {n}–{n2}", { x: esc(s.level.label), n: Math.round(s.level.band[0] - s.level.band[1]), n2: Math.round(s.level.band[0] + s.level.band[1]) })}</p>` : "";
  const acc = `<section class="rv-card px-card"><div class="rv-gt"><b>${accWord}</b></div><div class="px-big"><b data-fact="acc:${pid}" data-v="${m.sum.acc ?? ""}">${m.sum.acc ?? "–"}</b><small>Moves cost</small>${D(m.tot.moves, { fact: `cost:${pid}` })}</div><i class="px-meter"><i class="dot" style="left:${Math.max(0, Math.min(100, m.sum.acc ?? 0))}%"></i></i><div class="px-scale"><span>0</span><span>50</span><span>100</span></div>${band}</section>`;
  const luck = `<section class="rv-card px-card"><div class="rv-gt"><b>Luck</b></div><div class="px-big">${s.luck != null ? D(s.luck, { fact: `luck:${pid}` }) : `<b>–</b>`}<small>rolls, steals, card draws and seat order</small></div>${s.cards != null ? `<p class="px-fn">${f("Cards from the dice: {x} against expected", { x: `${sgn(s.cards)}${ab(s.cards)}` })}</p>` : ""}</section>`;
  const errs = `<section class="rv-card px-card"><div class="rv-gt"><b>${you ? "Where it could be better" : "Their real errors"}</b><small data-fact="errors:${m.pid}" data-v="${m.errs.length}">${nErr(m.errs.length)}</small></div>${m.errs.length ? m.errs.slice(0, 5).map((d) => mvRow(g, d, "imp")).join("") : `<p class="px-l">No clear mistake.</p>`}</section>`;
  const go = m.ds.length ? `<button type="button" class="px-btn pri go" data-rvj="${m.errs[0]?.i ?? m.ds[0].i}" data-rvq="${m.errs.length ? "imp" : "all"}">${IC.step}${stepText(m)}</button>` : "";
  const num = `<button type="button" class="px-btn" data-pxnum>Numbers</button>`;
  return { bar, html: `${why}${pts}${acc}${luck}${errs}${go}${num}`, bind: (el) => bindPost(g, el, m) };
}
export { numbersSheet, who, takeText };
