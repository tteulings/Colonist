// v1.84 the "board" primitive of the dynamic AI page: the real board of one moment of the game as ONE self-contained SVG, cropped and zoomed to
// what the spec talks about (hexes, spots, a player's network), with rings for the played / better / paid / robber hexes and spots, arrows,
// number tokens and the app's player colours. Pure: it reads the game geometry (g.geometry hexes / nodes / edges, g.players) and the stored
// replay (g._st) and never touches the live game, the canvas renderer or the theme (opaque background and fixed sea / land colours, so it reads
// the same in every theme). Seafarers boards (sea hexes, gold, ships, pirate) draw too.
//
//   renderBoardPrimitive(spec, g, opts) -> "<svg ...>" string   (opts.as === "node": the element)
//   spec  = {
//     hexes:  "all" | [hexId...]                  hexes that must be in the picture (default: whatever the marks / network need)
//     marks:  [{ hex | node | edge | at:"h7"|"n12"|"e5", role:"played"|"better"|"paid"|"robber"|"focus"|"alt", label? }]
//     arrows: [{ from:<spot>, to:<spot>, kind?:"move"|"alt" }]   <spot> = { hex | node | edge } or "h7" / "n12" / "e5" or "robber" (its hex at that moment)
//     seats:  [seat...]                           show these players' buildings and roads and crop to them (the others are dimmed)
//     robber: true|false                          draw the robber / pirate (default true)
//     turn | step + upto | d                      the moment: end of turn `turn`; or the board just before the move of aiDecList entry `d.d` (rec.s / rec.e)
//     zoom:   "auto" | "full"
//   }
//   opts  = { nameOf(seat) -> the legend's name (v1.90: "Jij" / "You"), width: 330, state?: { nodes:[[owner,structure]], edges:[[owner,ship]], robber, pirate }, accent: css colour of "better", legend: true|false, label: aria }
//   boardStateAt(g, { step, upto }) / stateOfSpec(g, spec) are exported for the caller and the tests.

import { langOf } from "./ai-lang.js";
const SEA = "#bfdbe6", SEA_HEX = "#a9cddb", EDGE = "rgba(40,35,28,.55)";
const LAND = { wood: "#4a7c3f", brick: "#c66536", sheep: "#8fd05f", wheat: "#e0c35a", ore: "#8b96a8", desert: "#dccb97", gold: "#e5bc52" };
const RES_NAME = { wood: "Wood", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore", desert: "Desert", gold: "Gold" };
import { PIPS } from "../core/constants.js";
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fade = (hex) => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "#aaa"; const n = parseInt(m[1], 16), mx = (c, t) => Math.round(c * 0.4 + t * 0.6); return `rgb(${mx(n >> 16, 190)},${mx((n >> 8) & 255, 184)},${mx(n & 255, 168)})`; }; // other players: washed out, still opaque
const dark = (hex) => { const m = /^#([0-9a-f]{6})$/i.exec(hex || ""); if (!m) { const r = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(hex || ""); return r ? `rgb(${r[1] * 0.45 | 0},${r[2] * 0.45 | 0},${r[3] * 0.45 | 0})` : "#222"; } const n = parseInt(m[1], 16); return `rgb(${(n >> 16) * 0.45 | 0},${((n >> 8) & 255) * 0.45 | 0},${(n & 255) * 0.45 | 0})`; };

/** The board after step s (only the events before `upto` of that step), as plain arrays: the replay of stats-ui `_rpSeek` without touching the game. */
export function boardStateAt(g, { step = null, upto = null } = {}) {
  const st = g?._st, geo = g?.geometry; if (!st || !geo) return null;
  const s = Math.max(0, Math.min(st.N, step ?? st.N)), nodes = geo.nodes.map(() => [null, null]), edges = geo.edges.map(() => [null, false]);
  let robber = st.r0 ?? null, pirate = st.p0 ?? null;
  if (upto != null && !st.evIx) st.evIx = new Map(g.stats.ev.map((e, i) => [e, i]));
  for (let k = 0; k <= s; k++) {
    (st.stepEvents[k] || []).forEach((e) => {
      if (upto != null && k === s && !((st.evIx.get(e) ?? Infinity) < upto)) return;
      const [, c, a, b, x] = e;
      if (c === "b" || c === "u") {
        const add = c === "b";
        if (b === "r" || b === "h") { if (edges[x]) edges[x] = [add ? a : null, b === "h" && add]; }
        else if (nodes[x]) { if (b === "s") nodes[x] = add ? [a, "settlement"] : [null, null]; else nodes[x] = [a, add ? "city" : "settlement"]; }
      } else if (c === "R") robber = b; else if (c === "Q") pirate = b;
    });
  }
  return { nodes, edges, robber, pirate };
}
/** The moment a spec talks about: its `d` (just before that move), `step` / `upto`, or the end of its `turn`; else the end of the game. */
export function stateOfSpec(g, spec = {}) {
  const st = g?._st; if (!st) return null;
  const rec = spec.d?.i != null ? g._rv?.recs?.[spec.d.i] : null;
  if (rec) return boardStateAt(g, { step: rec.s, upto: rec.e });
  if (spec.step != null) return boardStateAt(g, { step: spec.step, upto: spec.upto ?? null });
  if (spec.turn != null) { let k = 0; for (let q = 0; q <= st.N; q++) if ((st.turnOf[q] ?? 0) <= spec.turn) k = q; return boardStateAt(g, { step: k }); }
  return boardStateAt(g, {});
}

/** { kind:"hex"|"node"|"edge", id, x, y } of a spot ({hex}|{node}|{city}|{edge}|"h7"|"n12"|"e5"), or null. */
function spot(geo, s) {
  if (s == null) return null;
  if (typeof s === "string") { const m = /^([neh])\s*(\d{1,3})$/i.exec(s.trim()); if (!m) return null; s = { [{ n: "node", e: "edge", h: "hex" }[m[1].toLowerCase()]]: +m[2] }; }
  if (s.focus) s = s.focus;
  if (s.hex != null) { const h = geo.hexes[s.hex]; return h ? { kind: "hex", id: s.hex, x: h.center.x, y: h.center.y } : null; }
  const ni = s.node ?? s.city; if (ni != null) { const n = geo.nodes[ni]; return n ? { kind: "node", id: ni, x: n.x, y: n.y } : null; }
  if (s.edge != null) { const e = geo.edges[s.edge]; if (!e) return null; const [a, b] = e.nodes.map((i) => geo.nodes[i]); return { kind: "edge", id: s.edge, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a, b }; }
  return null;
}

const ROLE = { played: { txt: "Played" }, better: { txt: "Better" }, alt: { txt: "Option" }, paid: { txt: "Paid out" }, robber: { txt: "Robber" }, focus: { txt: "" } };

export function renderBoardPrimitive(spec = {}, g, opts = {}) {
  const geo = g?.geometry; if (!geo?.hexes?.length) return "";
  const BD = langOf(opts.lang).bd, TX = (r) => (r === "focus" ? "" : BD[r] || ""), RN = (r) => BD.res[r] || RES_NAME[r];
  const W = Math.max(200, Math.round(opts.width || 330)), hs = geo.hexSize, acc = opts.accent || "var(--primary,#2a6fdb)";
  const S = opts.state || stateOfSpec(g, spec) || { nodes: geo.nodes.map((n) => [n.owner ?? null, n.structure ?? null]), edges: geo.edges.map((e) => [e.owner ?? null, !!e.ship]), robber: g.robberHexId ?? null, pirate: g.sea?.pirateHexId ?? null };
  const players = g.players || [], col = (q) => players[q]?.color || "#777", pname = (q) => (typeof opts.nameOf === "function" ? opts.nameOf(q) : null) || players[q]?.name || players[q]?.short || `P${q + 1}`; // v1.90 opts.nameOf: the page's own name ("Jij" / "You") in the legend
  const marks = (spec.marks || []).map((m) => ({ ...m, role: ROLE[m.role] ? m.role : "focus", p: spot(geo, m.at ?? m) })).filter((m) => m.p).slice(0, 8);
  const sp = (s) => spot(geo, s === "robber" ? (S.robber != null ? { hex: S.robber } : null) : s === "pirate" ? (S.pirate != null ? { hex: S.pirate } : null) : s); // "robber" / "pirate": where it stands at that moment
  const arrows = (spec.arrows || []).map((a) => ({ ...a, A: sp(a.from), B: sp(a.to) })).filter((a) => a.A && a.B && (a.A.kind !== a.B.kind || a.A.id !== a.B.id)).slice(0, 4);
  const seats = Array.isArray(spec.seats) ? spec.seats.filter((q) => players[q]) : [];

  // ── what must be in the picture ──
  const pts = [];
  const addHexAll = (h) => h.corners.forEach((c) => pts.push(c));
  if (spec.hexes === "all" || spec.zoom === "full") geo.hexes.forEach(addHexAll);
  else if (Array.isArray(spec.hexes)) spec.hexes.forEach((i) => geo.hexes[i] && addHexAll(geo.hexes[i]));
  let pad = 1.25 * hs;
  marks.forEach((m) => { pts.push(m.p); if (m.p.kind === "hex") addHexAll(geo.hexes[m.p.id]); });
  arrows.forEach((a) => { pts.push(a.A, a.B); });
  const mine = (q) => !seats.length || seats.includes(q);
  if (seats.length) {
    S.nodes.forEach((n, i) => { if (n[0] != null && seats.includes(n[0])) pts.push(geo.nodes[i]); });
    S.edges.forEach((e, i) => { if (e[0] != null && seats.includes(e[0])) geo.edges[i].nodes.forEach((ni) => pts.push(geo.nodes[ni])); });
  }
  if (!pts.length) geo.hexes.forEach(addHexAll);
  let minX = Math.min(...pts.map((p) => p.x)) - pad, maxX = Math.max(...pts.map((p) => p.x)) + pad, minY = Math.min(...pts.map((p) => p.y)) - pad, maxY = Math.max(...pts.map((p) => p.y)) + pad;
  const grow = (wMin, hMin) => { let w = maxX - minX, h = maxY - minY; if (w < wMin) { minX -= (wMin - w) / 2; maxX += (wMin - w) / 2; } if (h < hMin) { minY -= (hMin - h) / 2; maxY += (hMin - h) / 2; } };
  grow(4.6 * hs, 3.4 * hs);
  { // the picture is between 0.6 and 1.05 as tall as wide: widen a tall box, heighten a flat one
    let w = maxX - minX, h = maxY - minY;
    if (h < 0.62 * w) { const d = 0.62 * w - h; minY -= d / 2; maxY += d / 2; }
    else if (h > 1.05 * w) { const d = h / 1.05 - w; minX -= d / 2; maxX += d / 2; }
    w = maxX - minX; h = maxY - minY;
  }
  const bw = maxX - minX, k = bw / W; // world units per css px
  // ── legend: the players whose pieces are in the picture ──
  const inBox = (x, y, m = 0) => x >= minX - m && x <= maxX + m && y >= minY - m && y <= maxY + m;
  const seen = new Set();
  S.nodes.forEach((n, i) => { if (n[0] != null && inBox(geo.nodes[i].x, geo.nodes[i].y) && mine(n[0])) seen.add(n[0]); });
  S.edges.forEach((e, i) => { if (e[0] != null && inBox(geo.nodes[geo.edges[i].nodes[0]].x, geo.nodes[geo.edges[i].nodes[0]].y) && mine(e[0])) seen.add(e[0]); });
  const legend = opts.legend === false ? [] : [...seen].sort((a, b) => a - b).slice(0, 6);
  const LEG = legend.length ? 24 : 0;
  const bh = maxY - minY, H = bh + LEG * k;
  const px = (v) => f1(v * k);

  const out = [];
  out.push(`<rect x="${f1(minX)}" y="${f1(minY)}" width="${f1(bw)}" height="${f1(H)}" fill="${SEA}"/>`);
  // ── hexes ──
  const inView = (h) => h.corners.some((c) => inBox(c.x, c.y, 0)) || inBox(h.center.x, h.center.y, hs);
  const tokR = Math.min(0.34 * hs, 17 * k * 1.15), robHex = S.robber, pirHex = S.pirate;
  const hexSvg = [], tokSvg = [];
  geo.hexes.forEach((h) => {
    if (!inView(h)) return;
    const sea = h.resource === "sea", fill = sea ? SEA_HEX : LAND[h.resource] || "#cdbf94";
    hexSvg.push(`<polygon points="${h.corners.map((c) => `${f1(c.x)},${f1(c.y)}`).join(" ")}" fill="${fill}" stroke="${sea ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.85)"}" stroke-width="${px(1.6)}" stroke-linejoin="round"/>`);
    if (!sea && h.resource && !h.number) { /* desert: no token */ }
    if (!sea && h.number) {
      const hot = h.number === 6 || h.number === 8, rob = h.id === robHex && spec.robber !== false, tr = rob ? tokR * 0.78 : tokR, cy = h.center.y + (rob ? 0.4 * hs : 0), fs = tr * 1.2;
      const pips = PIPS[h.number] || 0, dots = Array.from({ length: pips }, (_, i) => `<circle cx="${f1(h.center.x + (i - (pips - 1) / 2) * tr * 0.26)}" cy="${f1(cy + tr * 0.62)}" r="${f1(tr * 0.085)}" fill="${hot ? "#c0281d" : "#4a4337"}"/>`).join("");
      tokSvg.push(`<g><circle cx="${f1(h.center.x)}" cy="${f1(cy)}" r="${f1(tr)}" fill="#fbf4e1" stroke="rgba(40,30,15,.5)" stroke-width="${px(1)}"/><text x="${f1(h.center.x)}" y="${f1(cy + fs * 0.12)}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${f1(fs)}" fill="${hot ? "#c0281d" : "#2b2519"}">${h.number}</text>${dots}</g>`);
    } else if (!sea && h.resource === "gold") tokSvg.push(`<text x="${f1(h.center.x)}" y="${f1(h.center.y + hs * 0.12)}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${f1(hs * 0.34)}" fill="#6b4f08">${RN("gold")}</text>`);
  });
  out.push(hexSvg.join(""));
  // a "paid" hex gets a soft glow under the pieces
  marks.filter((m) => m.role === "paid" && m.p.kind === "hex").forEach((m) => { const h = geo.hexes[m.p.id]; out.push(`<polygon points="${h.corners.map((c) => `${f1(c.x)},${f1(c.y)}`).join(" ")}" fill="#ffd54a" opacity=".38"/>`); });
  out.push(tokSvg.join(""));

  // ── roads / ships ──
  const road = [];
  S.edges.forEach((e, i) => {
    if (e[0] == null) return; const [a, b] = geo.edges[i].nodes.map((n) => geo.nodes[n]);
    if (!inBox(a.x, a.y, hs) && !inBox(b.x, b.y, hs)) return;
    const dim = !mine(e[0]), cc = dim ? fade(col(e[0])) : col(e[0]), shrink = 0.2, dx = b.x - a.x, dy = b.y - a.y, x1 = a.x + dx * shrink, y1 = a.y + dy * shrink, x2 = b.x - dx * shrink, y2 = b.y - dy * shrink, w = e[1] ? 4.5 : 6;
    road.push(`<g><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="#fff" stroke-width="${px(w + 3.4)}" stroke-linecap="round"/><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${dark(cc)}" stroke-width="${px(w + 1.6)}" stroke-linecap="round"/><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${cc}" stroke-width="${px(w - 0.6)}" stroke-linecap="round"${e[1] ? ` stroke-dasharray="${px(7)} ${px(3)}"` : ""}/></g>`);
  });
  out.push(road.join(""));
  // ── settlements / cities ──
  const bld = [];
  S.nodes.forEach((n, i) => {
    if (n[0] == null) return; const p = geo.nodes[i]; if (!inBox(p.x, p.y, hs * 0.5)) return;
    const dim = !mine(n[0]), c = dim ? fade(col(n[0])) : col(n[0]), u = k * (dim ? 0.85 : 1), city = n[1] === "city";
    const pt = (x, y) => `${f1(p.x + x * u)},${f1(p.y + y * u)}`;
    const shape = city ? [[-11, 8], [11, 8], [11, -1], [3, -1], [3, -6], [-3.5, -12], [-11, -6]] : [[-8, 7], [8, 7], [8, -2], [0, -10], [-8, -2]];
    const poly = shape.map(([x, y]) => pt(x, y)).join(" ");
    bld.push(`<g><polygon points="${poly}" fill="${c}" stroke="#fff" stroke-width="${px(5)}" stroke-linejoin="round"/><polygon points="${poly}" fill="${c}" stroke="${dark(c)}" stroke-width="${px(1.8)}" stroke-linejoin="round"/></g>`);
  });
  out.push(bld.join(""));
  // ── robber / pirate ──
  const pawn = (h, fill) => {
    if (h == null || !geo.hexes[h] || !inBox(geo.hexes[h].center.x, geo.hexes[h].center.y, hs * 0.2)) return "";
    const c = geo.hexes[h].center, u = k, X = c.x, Y = c.y - 0.3 * hs, pt = (x, y) => `${f1(X + x * u)},${f1(Y + y * u)}`, body = [[-8, 11], [8, 11], [5, -1], [-5, -1]].map(([x, y]) => pt(x, y)).join(" ");
    return `<g><polygon points="${body}" fill="${fill}" stroke="#fff" stroke-width="${px(4.4)}" stroke-linejoin="round"/><circle cx="${f1(X)}" cy="${f1(Y - 7 * u)}" r="${px(6)}" fill="${fill}" stroke="#fff" stroke-width="${px(4.4)}"/><polygon points="${body}" fill="${fill}"/><circle cx="${f1(X)}" cy="${f1(Y - 7 * u)}" r="${px(6)}" fill="${fill}"/></g>`;
  };
  if (spec.robber !== false) out.push(pawn(robHex, "#2c2824"), pawn(pirHex, "#25476b"));

  // ── marks ──
  const lab = [], boxes = [];
  const ringOf = (m) => {
    const { p, role } = m, x = f1(p.x), y = f1(p.y);
    const stroke = role === "better" ? acc : role === "paid" ? "#d98a00" : role === "robber" ? "#23201c" : role === "alt" ? "#E0A526" : role === "played" ? "#fff" : acc;
    const dash = role === "played" ? ` stroke-dasharray="${px(7)} ${px(5)}"` : role === "alt" || role === "focus" ? ` stroke-dasharray="${px(5)} ${px(4)}"` : "";
    if (p.kind === "hex") {
      const h = geo.hexes[p.id], pp = h.corners.map((c) => `${f1(p.x + (c.x - p.x) * 0.93)},${f1(p.y + (c.y - p.y) * 0.93)}`).join(" ");
      const halo = role === "played" ? "#23201c" : "#fff", fillA = role === "better" ? ` fill="${acc}" fill-opacity=".2"` : role === "robber" ? ` fill="#23201c" fill-opacity=".28"` : ' fill="none"';
      return `<polygon points="${pp}"${fillA} stroke="${halo}" stroke-width="${px(role === "played" ? 7 : 8)}" stroke-linejoin="round" opacity=".9"/><polygon points="${pp}" fill="none" stroke="${stroke}" stroke-width="${px(4)}" stroke-linejoin="round"${dash}/>`;
    }
    if (p.kind === "edge") {
      const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, x1 = f1(p.a.x + dx * 0.14), y1 = f1(p.a.y + dy * 0.14), x2 = f1(p.b.x - dx * 0.14), y2 = f1(p.b.y - dy * 0.14), s = role === "played" ? "#fff" : stroke;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${role === "played" ? "#23201c" : "#fff"}" stroke-width="${px(12)}" stroke-linecap="round" opacity=".85"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${px(7)}" stroke-linecap="round"${role === "played" ? ` stroke-dasharray="${px(7)} ${px(5)}"` : ""}/>`;
    }
    const r = px(15);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${role === "played" ? "#23201c" : "#fff"}" stroke-width="${px(7.5)}"/><circle cx="${x}" cy="${y}" r="${r}"${role === "better" ? ` fill="${acc}" fill-opacity=".22"` : ' fill="none"'} stroke="${stroke}" stroke-width="${px(4)}"${dash}/>`;
  };
  marks.forEach((m) => out.push(ringOf(m)));
  // arrows
  arrows.forEach((a) => {
    const { A, B } = a, L = Math.hypot(B.x - A.x, B.y - A.y) || 1, ux = (B.x - A.x) / L, uy = (B.y - A.y) / L, r0 = (A.kind === "hex" ? 0.38 * hs : 11 * k), r1 = (B.kind === "hex" ? 0.4 * hs : 13 * k);
    if (L < r0 + r1 + 14 * k) return;
    const x1 = A.x + ux * r0, y1 = A.y + uy * r0, x2 = B.x - ux * r1, y2 = B.y - uy * r1, c = a.kind === "alt" ? "#E0A526" : acc, hl = 14 * k, hw = 8.5 * k, bx = x2 - ux * hl, by = y2 - uy * hl;
    const head = `${f1(x2)},${f1(y2)} ${f1(bx - uy * hw)},${f1(by + ux * hw)} ${f1(bx + uy * hw)},${f1(by - ux * hw)}`;
    out.push(`<g><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="#fff" stroke-width="${px(8.5)}" stroke-linecap="round"/><polygon points="${head}" fill="#fff" stroke="#fff" stroke-width="${px(5)}" stroke-linejoin="round"/><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="${c}" stroke-width="${px(4.2)}" stroke-linecap="round"/><polygon points="${head}" fill="${c}" stroke="${c}" stroke-width="${px(1)}" stroke-linejoin="round"/></g>`);
  });
  // labels: a pill beside each mark, nudged off the other pills, kept inside the picture
  const pill = (txt, x, y, fill, ink) => { const w = (txt.length * 6.4 + 14) * k, h = 18 * k; return { x, y, w, h, svg: `<g><rect x="${f1(x - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(h / 2)}" fill="${fill}" stroke="#fff" stroke-width="${px(1.6)}"/><text x="${f1(x)}" y="${f1(y + 4.3 * k)}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${px(11.5)}" fill="${ink}">${esc(txt)}</text></g>` }; };
  marks.forEach((m) => {
    const txt = m.label ?? TX(m.role); if (!txt) return;
    const fill = m.role === "better" ? acc : m.role === "played" ? "#23201c" : m.role === "paid" ? "#d98a00" : m.role === "robber" ? "#23201c" : m.role === "alt" ? "#E0A526" : acc, ink = m.role === "alt" ? "#2b2210" : "#fff";
    const off = (m.p.kind === "hex" ? 0.78 * hs : 24 * k), tries = [[0, -off], [0, off], [off * 1.1, 0], [-off * 1.1, 0]]; let best = null;
    for (const [dx, dy] of tries) {
      const q = pill(txt, m.p.x + dx, m.p.y + dy, fill, ink), cl = { ...q, x: Math.min(maxX - q.w / 2 - 3 * k, Math.max(minX + q.w / 2 + 3 * k, q.x)), y: Math.min(maxY - q.h / 2 - 3 * k, Math.max(minY + q.h / 2 + 3 * k, q.y)) };
      const hit = boxes.some((b) => Math.abs(b.x - cl.x) < (b.w + cl.w) / 2 && Math.abs(b.y - cl.y) < (b.h + cl.h) / 2);
      if (!hit) { best = cl; break; } best ||= cl;
    }
    const q = pill(txt, best.x, best.y, fill, ink); boxes.push({ x: q.x, y: q.y, w: q.w, h: q.h }); lab.push(q.svg);
  });
  out.push(lab.join(""));
  // ── legend ──
  if (legend.length) {
    const y0 = maxY + (LEG / 2) * k; let x = minX + 10 * k; const L = [`<rect x="${f1(minX)}" y="${f1(maxY)}" width="${f1(bw)}" height="${f1(LEG * k)}" fill="#f4efe3"/>`];
    legend.forEach((q) => { const t = pname(q), w = (t.length * 6.6 + 24) * k; if (x + w > maxX) return; L.push(`<circle cx="${f1(x + 5 * k)}" cy="${f1(y0)}" r="${px(5.5)}" fill="${col(q)}" stroke="${dark(col(q))}" stroke-width="${px(1.2)}"/><text x="${f1(x + 14 * k)}" y="${f1(y0 + 4 * k)}" font-family="system-ui,sans-serif" font-weight="700" font-size="${px(11.5)}" fill="#2b2519">${esc(t)}</text>`); x += w; });
    out.push(L.join(""));
  }
  const desc = [marks.map((m) => `${TX(m.role) || BD.marked} ${m.p.kind === "hex" ? `hex${geo.hexes[m.p.id].resource && RN(geo.hexes[m.p.id].resource) ? ` (${RN(geo.hexes[m.p.id].resource)} ${geo.hexes[m.p.id].number ?? ""})` : ""}` : m.p.kind}`).join(", ")].filter(Boolean).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f1(minX)} ${f1(minY)} ${f1(bw)} ${f1(H)}" width="${W}" height="${Math.round(H / k)}" class="ap-board" role="img" aria-label="${esc(opts.label || `${BD.aria}${desc ? ": " + desc : ""}`)}" style="display:block;width:100%;height:auto;max-width:100%;background:${SEA};border-radius:10px">${out.join("")}</svg>`;
  if (opts.as === "node" && typeof document !== "undefined") { const t = document.createElement("template"); t.innerHTML = svg; return t.content.firstElementChild; }
  return svg;
}
