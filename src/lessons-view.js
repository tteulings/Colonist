// v1.94 Lessons: everything a lesson shows that is drawn or worded from data (no DOM access, strings in / strings out): the mini board crops ("Jij koos" / "Beter"), the two
// short lines under an example (derived from the hexes of THAT example), the move tiles for moves that have no spot, and the answers to the three preset questions.
// Words: L(en, nl) picks by the app language (the page redraws on a language change); counts agree with their noun ("1 potje", "2 potjes").
import { stdGeo, hexCorners } from "./lessons-geo.js";
import { RES_COLOR, resName } from "./resources.js";
import { lang, dateLocale, num } from "./i18n.js";

export const L = (en, nl) => (lang() === "nl" ? nl : en);
export const pl = (n, en1, enN, nl1, nlN) => `${num(n)} ${n === 1 ? L(en1, nl1) : L(enN, nlN)}`;
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const day = (t) => new Date(t).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }).replace(/\.$/, "");
export const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
export const PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const rn = (r) => resName(r, lang()).toLowerCase();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const list = (a) => (a.length < 2 ? a[0] || "" : `${a.slice(0, -1).join(", ")} ${L("and", "en")} ${a[a.length - 1]}`);
export const dots = (n) => pl(n, "dot", "dots", "stip", "stippen");

// ── the crop ──
const ICON = { wood: `<polygon points="5,0.6 8.6,6 1.4,6"/><rect x="4.2" y="6" width="1.6" height="3"/>`, brick: `<rect x="0.6" y="1.5" width="4" height="2.6"/><rect x="5.4" y="1.5" width="4" height="2.6"/><rect x="2.9" y="5.4" width="4.2" height="2.6"/>`, sheep: `<circle cx="4.2" cy="5" r="3"/><circle cx="7.6" cy="5.8" r="1.6"/>`, wheat: `<path d="M5 9V1.5M5 3.2L2.8 1.6M5 3.2L7.2 1.6M5 5.6L2.8 4M5 5.6L7.2 4M5 8L2.8 6.4M5 8L7.2 6.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/>`, ore: `<polygon points="0.5,9 3.6,2.5 5.6,6 7,4 9.5,9"/>` };
const SC = 30;
/** hex ids of a spot: [kind, id] with kind n (settlement / city node), e (road edge), h (a hex: the robber and the six around it) */
export function spotHexes(spec) {
  const g = stdGeo(), [k, i] = spec;
  if (k === "n") return g.nodes[i].hx.slice();
  if (k === "e") return [...new Set([...g.nodes[g.edges[i].a].hx, ...g.nodes[g.edges[i].b].hx])];
  const c = g.hexes[i]; return [i, ...g.hexes.filter((h) => h.id !== i && h.nodes.filter((n) => c.nodes.includes(n)).length >= 2).map((h) => h.id)];
}
/** one spot as a crop of the real board. board: 19 { res, num }. */
export function cropSvg(board, spec, { w = 150, color = "#D1453A", label = "" } = {}) {
  const g = stdGeo(), ids = spotHexes(spec), hs = ids.map((id) => ({ ...g.hexes[id], ...board[id] })), [k, i] = spec;
  const at = k === "n" ? g.nodes[i] : k === "h" ? g.hexes[i] : { x: (g.nodes[g.edges[i].a].x + g.nodes[g.edges[i].b].x) / 2, y: (g.nodes[g.edges[i].a].y + g.nodes[g.edges[i].b].y) / 2 };
  const pts = hs.flatMap((h) => hexCorners(h)), xs = pts.map((q) => q.x * SC), ys = pts.map((q) => q.y * SC);
  const x0 = Math.min(...xs) - 4, y0 = Math.min(...ys) - 4, W = Math.max(...xs) - x0 + 4, H = Math.max(...ys) - y0 + 4;
  const hex = (h) => {
    const cs = hexCorners(h).map((q) => `${(q.x * SC).toFixed(1)},${(q.y * SC).toFixed(1)}`).join(" "), cx = h.x * SC, cy = h.y * SC, des = !h.num, red = h.num === 6 || h.num === 8;
    const dx = cx - at.x * SC, dy = cy - at.y * SC, dl = Math.hypot(dx, dy) || 1, ix = cx + (dx / dl) * 15, iy = cy + (dy / dl) * 15;
    return `<g data-hex="${h.id}" data-res="${h.res}" data-num="${h.num || 0}"><polygon points="${cs}" fill="${RES_COLOR[h.res] || "#D9C79A"}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`
      + (ICON[h.res] && k !== "h" ? `<g transform="translate(${(ix - 5.5).toFixed(1)},${(iy - 5.5).toFixed(1)}) scale(1.1)" fill="#fff" fill-opacity=".92">${ICON[h.res]}</g>` : "")
      + (des ? "" : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11.5" fill="#faf3e0" stroke="rgba(0,0,0,.25)" stroke-width=".8"/><text x="${cx.toFixed(1)}" y="${(cy + 1).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="800" fill="${red ? "#B8312A" : "#2c1810"}" font-family="Inter,sans-serif">${h.num}</text>`
        + Array.from({ length: PIP[h.num] }, (_, j) => `<circle cx="${(cx + (j - (PIP[h.num] - 1) / 2) * 3.1).toFixed(1)}" cy="${(cy + 7.2).toFixed(1)}" r="1.15" fill="${red ? "#B8312A" : "#2c1810"}"/>`).join("")) + `</g>`;
  };
  let mark = "";
  if (k === "n") mark = `<g transform="translate(${(at.x * SC).toFixed(1)},${(at.y * SC).toFixed(1)})" data-piece="settlement"><path d="M-9,7 V-1 L0,-9 L9,-1 V7 Z" fill="${color}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M-9,7 V-1 L0,-9 L9,-1 V7 Z" fill="${color}"/></g>`;
  else if (k === "e") { const a = g.nodes[g.edges[i].a], b = g.nodes[g.edges[i].b], ln = `x1="${(a.x * SC).toFixed(1)}" y1="${(a.y * SC).toFixed(1)}" x2="${(b.x * SC).toFixed(1)}" y2="${(b.y * SC).toFixed(1)}"`; mark = `<g data-piece="road"><line ${ln} stroke="#fff" stroke-width="9" stroke-linecap="round"/><line ${ln} stroke="${color}" stroke-width="5.5" stroke-linecap="round"/></g>`; }
  else mark = `<g transform="translate(${(at.x * SC).toFixed(1)},${(at.y * SC - 15).toFixed(1)})" data-piece="robber"><circle cx="0" cy="-5" r="4.2" fill="#2d2d33" stroke="#fff" stroke-width="1.6"/><path d="M-6.5,8 Q-6.5,-1 0,-1 Q6.5,-1 6.5,8 Z" fill="#2d2d33" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></g>`;
  return `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" width="${w}" role="img" aria-label="${esc(label)}" data-crop="${k}:${i}" class="lc-crop" style="display:block;max-width:100%;height:auto">${hs.map(hex).join("")}${mark}</svg>`;
}

// ── what a spot is made of ──
const hexesOf = (board, spec) => spotHexes(spec).map((id) => ({ id, ...board[id] }));
/** features of a settlement spot (plus the player's other start settlement when given): dots, kinds, missing, duplicates */
export function spotInfo(board, spec, other = null) {
  const own = spec[0] === "n" ? hexesOf(board, spec).filter((h) => h.num && R5.includes(h.res)) : [];
  const both = [...own, ...(other != null ? hexesOf(board, ["n", other]).filter((h) => h.num && R5.includes(h.res)) : [])];
  const cnt = {}; both.forEach((h) => { cnt[h.res] = (cnt[h.res] || 0) + 1; });
  const ownCnt = {}; own.forEach((h) => { ownCnt[h.res] = (ownCnt[h.res] || 0) + 1; });
  return { own, dots: own.reduce((a, h) => a + PIP[h.num], 0), cnt, ownCnt, kinds: Object.keys(cnt).length, missing: R5.filter((r) => !cnt[r]) };
}
const hexLabel = (h) => `${rn(h.res)} ${h.num || ""}`.trim();

// ── move words ──
export function moveWord(kind, d) {
  switch (kind) {
    case "road": return L("build a road", "een weg bouwen");
    case "settlement": return L("build a settlement", "een dorp bouwen");
    case "city": return L("build a city", "een stad bouwen");
    case "bank": return Array.isArray(d) ? L(`trade ${rn(d[0])} for ${rn(d[1])} with the bank`, `${rn(d[0])} voor ${rn(d[1])} ruilen bij de bank`) : L("trade with the bank", "ruilen bij de bank");
    case "end": return L("end the turn", "de beurt beëindigen");
    case "card": return L("a development card", "een ontwikkelkaart");
    case "robber": return L("move the robber", "de rover verzetten");
    default: return L("another move", "een andere zet");
  }
}
const playedWord = (kind, d) => (kind === "end" ? L("Ended the turn", "Beurt beëindigd") : cap(({ road: L("Built a road", "Weg gebouwd"), settlement: L("Built a settlement", "Dorp gebouwd"), city: L("Built a city", "Stad gebouwd"), card: L("Development card", "Ontwikkelkaart"), robber: L("Moved the robber", "Rover verzet") }[kind]) || (kind === "bank" ? (Array.isArray(d) ? L(`Traded ${rn(d[0])} for ${rn(d[1])}`, `${cap(rn(d[0]))} voor ${rn(d[1])} geruild`) : L("Traded with the bank", "Geruild bij de bank")) : L("Another move", "Andere zet"))));
/** the tile of a move that has no spot on the board: an icon, the move in words, a resource arrow for a trade */
export function tileHtml(kind, d, icon, better = false) {
  const dot = (r) => `<i class="lc-rd" style="background:${RES_COLOR[r]}" title="${esc(rn(r))}"></i>`;
  const word = better ? cap(moveWord(kind, d)) : playedWord(kind, d);
  return `<div class="lc-tile" data-tile="${kind}"><i class="lc-ti" aria-hidden="true">${icon || ""}</i><b>${esc(word)}</b>${kind === "bank" && Array.isArray(d) ? `<span class="lc-tr" aria-hidden="true">${dot(d[0])}<s>→</s>${dot(d[1])}</span>` : ""}</div>`;
}

/** the model of one example: what to draw for "You chose" and "Better" and the (at most two) lines under it. board: the 19 hexes or null. */
export function exModel(e, board) {
  const spots = board && e.p && e.q && e.p[0] === e.q[0] && e.p[0] !== undefined; // both moves have a spot of the same kind
  const m = { spot: !!spots, lines: [] };
  if (!spots) return m;
  if (e.c === "setup" && e.p[0] === "n") {
    const a = spotInfo(board, e.p, e.o ?? null), b = spotInfo(board, e.q, e.o ?? null);
    const dup = Object.entries(a.ownCnt).filter(([, n]) => n >= 2).map(([r, n]) => `${n}× ${rn(r)}`);
    const miss = a.missing.length ? L(`no ${list(a.missing.map(rn))}`, `geen ${list(a.missing.map(rn))}`) : L("all kinds", "alle soorten");
    const add = Object.keys(b.cnt).filter((r) => !a.cnt[r]), drop = Object.keys(a.cnt).filter((r) => !b.cnt[r]);
    const l1 = cap([...dup, miss].join(", "));
    const l2 = add.length ? L(`Better: ${list(add.map(rn))} added${drop.length ? `, ${list(drop.map(rn))} dropped` : ""}`, `Beter: ${list(add.map(rn))} erbij${drop.length ? `, ${list(drop.map(rn))} eraf` : ""}`) : L(`Better: ${dots(b.dots)}`, `Beter: ${dots(b.dots)}`);
    Object.assign(m, { lines: [l1, l2], a, b, miss: a.missing, add, dup });
  } else if (e.p[0] === "n") {
    const a = spotInfo(board, e.p), b = spotInfo(board, e.q);
    m.lines = [L(`${dots(a.dots)}, ${pl(a.kinds, "kind", "kinds", "soort", "soorten")}`, `${dots(a.dots)}, ${pl(a.kinds, "kind", "kinds", "soort", "soorten")}`), L(`Better: ${dots(b.dots)}, ${pl(b.kinds, "kind", "kinds", "soort", "soorten")}`, `Beter: ${dots(b.dots)}, ${pl(b.kinds, "kind", "kinds", "soort", "soorten")}`)]; Object.assign(m, { a, b });
  } else if (e.p[0] === "h") {
    const a = board[e.p[1]], b = board[e.q[1]], da = PIP[a.num] || 0, db = PIP[b.num] || 0;
    m.lines = [`${cap(hexLabel(a))} · ${dots(da)}`, L(`Better: ${hexLabel(b)} · ${dots(db)}`, `Beter: ${hexLabel(b)} · ${dots(db)}`)]; Object.assign(m, { da, db });
  } else m.spot = true;
  return m;
}

// ── answers to the three preset questions, worded only from the examples' own numbers ──
export const QS = [
  { id: "better", en: "How do I get better at this?", nl: "Hoe word ik hier beter in?" },
  { id: "wrong", en: "What do I keep doing wrong?", nl: "Wat doe ik steeds fout?" },
  { id: "rule", en: "Give me one rule", nl: "Geef me één regel" },
];
const most = (a) => { const c = {}; a.forEach((x) => { if (x != null) c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((x, y) => y[1] - x[1])[0] || null; };
/** { lead, chips: [{ ex: index, side: "p"|"q" }], extra: { text, chips } | null } for a decision lesson; models[i] = exModel of example i */
export function answerDec(les, q, models) {
  const ex = les.examples, n = ex.length; if (!n) return null;
  const idx = (f) => ex.map((e, i) => (f(e, models[i], i) ? i : -1)).filter((i) => i >= 0);
  if (les.cat === "setup" && models.some((m) => m?.a)) {
    const wb = idx((e, m) => m?.miss?.some((r) => r === "wood" || r === "brick")), miss = {}; models.forEach((m) => (m?.miss || []).forEach((r) => { miss[r] = (miss[r] || 0) + 1; }));
    const top = Object.entries(miss).sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 2).slice(0, 2).map(([r]) => r), tops = idx((e, m) => m?.miss?.some((r) => top.includes(r)));
    const five = idx((e, m) => m?.b && m.b.kinds === 5), more = idx((e, m) => m?.b && m.a && m.b.kinds > m.a.kinds);
    const found = top.length ? L(`Your start often misses ${list(top.map(rn).sort())}.`.replace(" and ", " or "), `Je start mist vaak ${list(top.map(rn)).replace(` ${"en"} `, " of ")}.`) : null;
    const cnt = top.length ? L(`In ${tops.length} of ${n} starts one of those was missing.`, `In ${tops.length} van ${n} starts ontbrak er een van.`) : L(`In ${more.length} of ${n} starts the better spot gave a kind more.`, `In ${more.length} van ${n} starts gaf de betere plek een soort erbij.`);
    if (q === "wrong") return { lead: found || L("Your starts gave fewer kinds than the better ones.", "Je starts gaven minder soorten dan de betere."), text: cnt, chips: (top.length ? tops : more).map((i) => ({ ex: i, side: "p" })), extra: five.length ? { text: L(`In ${five.map((i) => i + 1).join(", ")} all 5 kinds were possible.`, `In ${five.map((i) => i + 1).join(", ")} kon je alle 5 soorten hebben.`), chips: five.slice(0, 3).map((i) => ({ ex: i, side: "q" })) } : null };
    if (q === "rule") return { lead: top.length ? L(`Check first whether ${list(top.map(rn).sort()).replace(" and ", " or ")} is in your start.`, `Kijk eerst of ${list(top.map(rn)).replace(` en `, " of ")} in je start zit.`) : L("Check first which kinds your start still misses.", "Kijk eerst welke soorten je start nog mist."), text: cnt, chips: more.slice(0, 3).map((i) => ({ ex: i, side: "q" })), extra: null };
    return { lead: L("Look at which kinds you miss before you look at the numbers.", "Kijk eerst welke soorten je mist, dan pas naar de getallen."), text: cnt, chips: more.slice(0, 3).map((i) => ({ ex: i, side: "q" })), extra: null };
  }
  const NOUN = { road: L("a road", "een weg"), settlement: L("a settlement", "een dorp"), city: L("a city", "een stad"), bank: L("a trade", "een ruil"), end: L("ending the turn", "de beurt beëindigen"), card: L("a card", "een kaart"), robber: L("another tile", "een andere tegel"), other: L("another move", "een andere zet") };
  const cnt = (f) => { const c = {}; ex.forEach((e) => { c[f(e)] = (c[f(e)] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const bks = cnt((e) => e.bk).slice(0, 3), pks = cnt((e) => e.pk), pk = pks[0], bk = bks[0];
  const bw = moveWord(bk?.[0] || "other", ex.find((e) => e.bk === bk?.[0])?.bd), pw = playedWord(pk?.[0] || "other").toLowerCase();
  const fact = L(`Better: ${bks.map(([k, c]) => `${NOUN[k]} (${c}×)`).join(", ")}.`, `Beter: ${bks.map(([k, c]) => `${NOUN[k]} (${c}×)`).join(", ")}.`);
  const chipsB = idx((e) => e.bk === bk?.[0]).slice(0, 3).map((i) => ({ ex: i, side: "q" })), chipsP = idx((e) => e.pk === pk?.[0]).slice(0, 3).map((i) => ({ ex: i, side: "p" }));
  if (q === "wrong") return { lead: L(`You often chose: ${pw} (${pk?.[1]} of ${n}).`, `Je koos vaak: ${pw} (${pk?.[1]} van ${n}).`), text: fact, chips: chipsP, extra: null };
  if (q === "rule") return { lead: L(`Before you decide, check: ${bw}.`, `Check voor je kiest: ${bw}.`), text: fact, chips: chipsB, extra: null };
  return { lead: L(`Look at ${bw} first.`, `Kijk eerst naar ${bw}.`), text: fact, chips: chipsB, extra: null };
}
