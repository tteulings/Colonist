// Seafarers drawing for the SVG-art board renderer (themes A/B/C) and the legacy Classic canvas.
// Called from small hooks in src/themes/board-renderer.js and game.drawCanvasScene(); `R` is the
// SvgBoardRenderer, coordinates are art units (hex radius 100) unless noted.
import { hexPath, harbourBadges, harbourScale } from "../themes/art-util.js";
import { defaultSea } from "./art.js";

const P2 = new Map();
const path = (d) => { let p = P2.get(d); if (!p) { p = new Path2D(d); P2.set(d, p); } return p; };
const HEXP = (r) => path(hexPath(0, 0, r));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** The active theme's sea art (its own `sea` block, or one derived from it). */
export function seaArt(T) {
  if (T.sea) return T.sea;
  if (!T.__seaDefault) Object.defineProperty(T, "__seaDefault", { value: defaultSea(T), enumerable: false });
  return T.__seaDefault;
}

/** Land hex of a harbour edge (the port sits on its coast). */
export function portLandHex(g, edge) {
  return edge.hexIds.find((h) => g.geometry.hexes[h].resource !== "sea") ?? edge.hexIds[0];
}

// ── static layer (baked) ────────────────────────────────────────────────
/** Faint outlines + a little swell on every sea hex, so ship lanes (hex sides) can be read on the water. */
export function bakeSeaMarks(R, ctx, b, k) {
  const g = R.game, S = seaArt(R.theme).seaMark;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, -b.minX * k, -b.minY * k);
  g.geometry.hexes.forEach((h) => {
    if (h.resource !== "sea") return;
    const c = R.hexArt(h);
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.lineJoin = "round";
    ctx.lineCap = "round"; ctx.lineWidth = 3; ctx.strokeStyle = S.wave;
    const w = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x - 7, y - 6, x, y); ctx.quadraticCurveTo(x + 7, y + 6, x + 14, y); ctx.stroke(); };
    const s = (h.id * 37) % 5;
    w(-22 + s * 4, -30 + s * 3); w(18 - s * 3, 26 - s * 2);
    ctx.restore();
  });
  ctx.restore();
}

/** v0.98: a faint grid on the sea, always on: every open-water edge as a thin light line (baked above the island's
 *  shallows, under the harbours), so the edges ships sail on can be seen. Coast edges are left to the beach. */
export const SEA_GRID = { day: "rgba(255,255,255,.4)", night: "rgba(196,228,236,.16)", flat: "rgba(255,249,238,.3)" };
export function seaGridColour(T, k = 1) {
  const c = isNight() ? SEA_GRID.night : T?.id === "C" ? SEA_GRID.flat : SEA_GRID.day;
  return k === 1 ? c : c.replace(/[\d.]+\)$/, (a) => `${Math.min(1, parseFloat(a) * k).toFixed(3)})`);
}
/** Edges with open water on every side (sea–sea, or sea at the board's rim). */
export function seaEdges(g) {
  const geo = g.geometry;
  if (geo._seaEdges) return geo._seaEdges;
  const sea = (h) => geo.hexes[h]?.resource === "sea";
  Object.defineProperty(geo, "_seaEdges", { value: geo.edges.filter((e) => e.hexIds.length && e.hexIds.every(sea)), enumerable: false, configurable: true });
  return geo._seaEdges;
}
export function bakeSeaGrid(R, ctx, b, k) {
  const g = R.game;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, -b.minX * k, -b.minY * k);
  ctx.beginPath();
  seaEdges(g).forEach((e) => { const a = R.nodeArt(e.nodes[0]), c = R.nodeArt(e.nodes[1]); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); });
  ctx.lineCap = "round"; ctx.lineWidth = 1.1 * designPx(R); ctx.strokeStyle = seaGridColour(R.theme); ctx.stroke();
  ctx.restore();
}

// ── live pieces ─────────────────────────────────────────────────────────
// v0.98 ship routes: ships sit on hex edges like roads, so each one is drawn ON its own edge: a small boat hull centred
// on the edge midpoint, along the edge, bow toward the route's open end; only the lead ship carries a sail. A player's
// connected ships are joined by a thin seat-colour line on a soft halo that follows the real edges through the corners
// (small fillets soften each turn), so it stays clear which edge each ship holds and where the next can go. A coast
// edge's line sits slightly out to sea (off the beach). Harbour pills stay on top: a hull slides along its own edge to
// stay in view. Sizes are in design px (`dp`): css px at the fitted zoom (desktop keeps the hex's proportion).
const HULL = { L: 13, W: 6 }; // design px
const SAIL_K = 0.74; // sail scale: the mast stands ~10 dp, below a settlement's height
const COAST = { A: 0.22, B: 0.16, C: 0.12, classic: 0.05 }; // beach / rim reach beyond the land hex, in hex radii
const SEAWARD = 0.6; // a coast edge's line sits a little out to sea (on the beach's outer rim, still on its edge)
const FILLET = 4; // corner fillet radius, dp
const isNight = () => typeof document !== "undefined" && ["night", "dusk"].includes(document.documentElement.dataset.palette);
const unit = (v) => { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; };

/** Geometry of every ship route. env: { g, P(nodeId), C(hexId), R (hex radius), dp, coast, pills, avoid }. Cached. */
export function shipRoutes(env, cacheHost) {
  const { g, P, C, R, dp } = env, geo = g.geometry;
  const ships = geo.edges.filter((e) => e.ship && e.owner != null);
  const key = [ships.map((e) => e.id + ":" + e.owner).join(","), geo.nodes.map((n) => (n.structure ? n.owner : "")).join(""), dp.toFixed(3), R.toFixed(2), env.coast, (env.pills || []).map((q) => `${q.x | 0},${q.y | 0}`).join(";"), (env.avoid || []).map((q) => `${q.x | 0},${q.y | 0}`).join(";"), P(0).x.toFixed(1), P(0).y.toFixed(1)].join("|");
  if (cacheHost && cacheHost._shipRoutesKey === key) return cacheHost._shipRoutes;
  const land = (h) => h != null && geo.hexes[h] && geo.hexes[h].resource !== "sea";
  const offD = SEAWARD * env.coast * R; // a coast edge's line sits this far out to sea (off the sand, still on its edge)
  /** seaward offset of an edge's line: toward the sea hex on a coast edge, none on open water */
  const off = (e) => {
    const L = e.hexIds.filter(land);
    if (!L.length) return { x: 0, y: 0 };
    const a = P(e.nodes[0]), b = P(e.nodes[1]), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s = e.hexIds.find((h) => !land(h));
    const d = s != null ? unit({ x: C(s).x - m.x, y: C(s).y - m.y }) : unit({ x: m.x - C(L[0]).x, y: m.y - C(L[0]).y });
    return { x: d.x * offD, y: d.y * offD };
  };
  /** an edge's ship spot: its midpoint (on the seaward line of a coast edge) */
  const spot = (e) => { const a = P(e.nodes[0]), b = P(e.nodes[1]), o = off(e); return { x: (a.x + b.x) / 2 + o.x, y: (a.y + b.y) / 2 + o.y }; };
  /** where two consecutive edge lines meet at their shared node (both lines offset) */
  const meet = (e, f, n) => {
    const q = P(n), oe = off(e), of = off(f);
    const pe = { x: q.x + oe.x, y: q.y + oe.y }, pf = { x: q.x + of.x, y: q.y + of.y };
    const de = unit({ x: P(e.nodes[0] === n ? e.nodes[1] : e.nodes[0]).x - q.x, y: P(e.nodes[0] === n ? e.nodes[1] : e.nodes[0]).y - q.y });
    const df = unit({ x: P(f.nodes[0] === n ? f.nodes[1] : f.nodes[0]).x - q.x, y: P(f.nodes[0] === n ? f.nodes[1] : f.nodes[0]).y - q.y });
    const den = de.x * df.y - de.y * df.x;
    if (Math.abs(den) < 1e-3) return { x: (pe.x + pf.x) / 2, y: (pe.y + pf.y) / 2 };
    const t = ((pf.x - pe.x) * df.y - (pf.y - pe.y) * df.x) / den;
    return { x: pe.x + de.x * t, y: pe.y + de.y * t };
  };
  // components per owner, their tips (anchored on the owner's own land piece, or open = the direction of travel)
  const byOwner = new Map();
  ships.forEach((e) => { if (!byOwner.has(e.owner)) byOwner.set(e.owner, []); byOwner.get(e.owner).push(e); });
  const routes = [];
  byOwner.forEach((list, owner) => {
    const deg = new Map(), inc = new Map();
    list.forEach((e) => e.nodes.forEach((n) => { deg.set(n, (deg.get(n) || 0) + 1); if (!inc.has(n)) inc.set(n, []); inc.get(n).push(e); }));
    const landOwn = (n) => { const nd = geo.nodes[n]; return (nd.structure && nd.owner === owner) || nd.edgeIds.some((id) => !geo.edges[id].ship && geo.edges[id].owner === owner); };
    const used = new Set(), paths = [];
    const walk = (n0, e0) => {
      const nodes = [n0], edges = []; let n = n0, e = e0;
      while (e && !used.has(e.id)) { used.add(e.id); edges.push(e); n = e.nodes[0] === n ? e.nodes[1] : e.nodes[0]; nodes.push(n); if (deg.get(n) !== 2) break; e = inc.get(n).find((x) => !used.has(x.id)); }
      return { nodes, edges };
    };
    [...deg.keys()].filter((n) => deg.get(n) !== 2).forEach((n) => inc.get(n).forEach((e) => { if (!used.has(e.id)) paths.push(walk(n, e)); }));
    list.forEach((e) => { if (!used.has(e.id)) paths.push(walk(e.nodes[0], e)); }); // closed loops
    const comp = new Map(); let cid = 0;
    list.forEach((e0) => { if (comp.has(e0.id)) return; const st = [e0]; while (st.length) { const e = st.pop(); if (comp.has(e.id)) continue; comp.set(e.id, cid); e.nodes.forEach((n) => inc.get(n).forEach((f) => { if (!comp.has(f.id)) st.push(f); })); } cid += 1; });
    const open = (n) => deg.get(n) === 1 && !landOwn(n);
    paths.forEach((p) => {
      const n = p.nodes, E = p.edges, last = n.length - 1;
      if (open(n[0]) && !open(n[last])) { n.reverse(); E.reverse(); }
      const cyc = n[0] === n[last] && deg.get(n[0]) === 2 && E.length > 2;
      // the course: along each edge's (seaward) line, corner to corner; small fillets are added when it is stroked
      const end = (node, e) => { // at a branch: where this edge's line meets a sibling's, so the routes join in one point
        const sib = deg.get(node) >= 3 ? inc.get(node).filter((f) => f !== e).sort((x, y) => x.id - y.id)[0] : null;
        if (sib) { const first = [e, ...inc.get(node).filter((f) => f !== e)].sort((x, y) => x.id - y.id); return meet(first[0], first[1], node); }
        const q = P(node), o = off(e), p0 = { x: q.x + o.x, y: q.y + o.y };
        if (landOwn(node) || !(geo.nodes[node].adjacentHexes || []).some(land)) return p0;
        const s = spot(e), L = Math.hypot(s.x - p0.x, s.y - p0.y) || 1, t = Math.min(0.8, (env.coast * R * 1.4 + 3 * dp) / L); // an open end stops short of a coast corner
        return { x: p0.x + (s.x - p0.x) * t, y: p0.y + (s.y - p0.y) * t };
      };
      const pts = [];
      if (cyc) pts.push(meet(E[E.length - 1], E[0], n[0])); else pts.push(end(n[0], E[0]));
      for (let i = 0; i + 1 < E.length; i += 1) pts.push(meet(E[i], E[i + 1], n[i + 1]));
      if (cyc) pts.push(pts[0]); else pts.push(end(n[last], E[E.length - 1]));
      const lead = open(n[last]) && !cyc ? E.length - 1 : -1;
      routes.push({ owner, comp: comp.get(E[0].id), pts, cyc, edges: E, lead,
        hulls: E.map((e, i) => ({ edge: e, owner, lead: i === lead, a: pts[i], b: pts[i + 1] })) });
    });
  });
  // every component without an open end still shows one sail: on the middle ship of its longest route
  const sailed = new Set(routes.filter((r) => r.lead >= 0).map((r) => r.owner + ":" + r.comp));
  const longest = new Map();
  routes.forEach((r) => { const k = r.owner + ":" + r.comp; if (!sailed.has(k) && (!longest.has(k) || longest.get(k).edges.length < r.edges.length)) longest.set(k, r); });
  longest.forEach((r) => { r.hulls[Math.floor((r.hulls.length - 1) / 2)].lead = true; });
  // hulls: on their own edge, centred at its spot, along the edge (bow toward the open end). When a harbour pill (pills
  // stay on top), the pirate, a building or another hull is in the way, a hull slides along its own edge (never off
  // it): first to a spot fully in the clear, else to one where most of it shows
  const pills = env.pills || [], avoid = env.avoid || [];
  const hr = (HULL.L / 2) * dp, placed = [];
  const pillFree = (q, m) => pills.every((b) => Math.abs(q.x - b.x) > b.w / 2 + m || Math.abs(q.y - b.y) > b.h / 2 + m);
  const free = (q, strict, lead) => pillFree(q, strict ? hr * 0.6 + 1.5 * dp : 1.5 * dp)
    && (!lead || pillFree({ x: q.x, y: q.y - 6 * dp }, strict ? 5 * dp : 1.5 * dp)) // the sail stands ~10 dp tall
    && avoid.every((a) => Math.hypot(q.x - a.x, q.y - a.y) > a.r + hr * (strict ? 0.5 : 0.15))
    && placed.every((o) => Math.hypot(q.x - o.x, q.y - o.y) > hr * (strict ? 1.6 : 1.1));
  const all = routes.flatMap((r) => r.hulls);
  all.sort((a, b) => b.lead - a.lead); // lead ships (with their sails) pick first
  all.forEach((h) => {
    const e = h.edge, s = spot(e), A = P(e.nodes[0]), B = P(e.nodes[1]);
    const dir = unit({ x: h.b.x - h.a.x, y: h.b.y - h.a.y }), len = Math.hypot(B.x - A.x, B.y - A.y);
    const room = Math.max(0, Math.min(0.3 * len, len / 2 - hr - 1 * dp)); // slide at most 30% of the edge, never off it
    const at = (t) => ({ x: s.x + dir.x * t, y: s.y + dir.y * t });
    const steps = [0]; for (let k = 1; k <= 6; k += 1) steps.push((room * k) / 6, (-room * k) / 6);
    const t = steps.find((v) => free(at(v), true, h.lead)) ?? steps.find((v) => free(at(v), false, h.lead)) ?? 0;
    Object.assign(h, at(t), { dir, slid: t !== 0 });
    placed.push(h);
  });
  const out = { routes, hulls: all, spot, off, R, dp, rf: FILLET * dp };
  if (cacheHost) { cacheHost._shipRoutesKey = key; cacheHost._shipRoutes = out; }
  return out;
}

/** Trace a route: straight along its edges, a small fillet at every corner (radius `rf`, less on a short leg). */
function tracePath(ctx, r, rf) {
  const p = r.pts, N = p.length;
  const rad = (i) => { const a = p[i - 1], b = p[i], c = p[i + 1]; return Math.min(rf, 0.45 * Math.hypot(b.x - a.x, b.y - a.y), 0.45 * Math.hypot(c.x - b.x, c.y - b.y)); };
  ctx.beginPath();
  if (r.cyc) {
    const s = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    ctx.moveTo(s.x, s.y);
    for (let i = 1; i < N - 1; i += 1) ctx.arcTo(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, rad(i));
    const a = p[N - 2], b = p[0], c = p[1]; ctx.arcTo(b.x, b.y, s.x, s.y, Math.min(rf, 0.45 * Math.hypot(b.x - a.x, b.y - a.y), 0.45 * Math.hypot(c.x - b.x, c.y - b.y)));
    ctx.closePath();
    return;
  }
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < N - 1; i += 1) ctx.arcTo(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, rad(i));
  ctx.lineTo(p[N - 1].x, p[N - 1].y);
}

/** Hull seen from above, bow +x: pointed bow, squared stern, a small deck; halo, seat fill, dark outline. dp units. */
const HULL_D = ("M7.5,0 C6.1,-2.5 3.6,-3.5 0.6,-3.5 L-6.3,-3.3 Q-7.5,-3.2 -7.5,-2.1 L-7.5,2.1 Q-7.5,3.2 -6.3,3.3 L0.6,3.5 C3.6,3.5 6.1,2.5 7.5,0Z");
const DECK_D = ("M4.6,0 C3.8,-1.4 2.4,-1.9 0.6,-1.9 L-5.4,-1.8 L-5.4,1.8 L0.6,1.9 C2.4,1.9 3.8,1.4 4.6,0Z");
const MAIN_D = "M-0.9,-12.6 Q-6.4,-8.2 -6.6,-2.4 L-0.9,-2.4Z", JIB_D = "M0.9,-11 Q4.6,-6.6 4.9,-2.4 L0.9,-2.4Z";
function drawHull(ctx, h, c, dp, o = {}) {
  const HULL_P = path(HULL_D), DECK_P = path(DECK_D);
  const night = isNight(), halo = o.halo || (night ? "rgba(255,240,205,.92)" : "rgba(255,255,255,.95)");
  ctx.save(); ctx.translate(h.x, h.y + (o.dy || 0)); ctx.scale(dp * (o.s || 1), dp * (o.s || 1));
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const ang = Math.atan2(h.dir.y, h.dir.x);
  ctx.save(); ctx.rotate(ang); ctx.scale(HULL.L / 15, HULL.W / 7);
  ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(8,22,26,.28)"; ctx.translate(0.5, 0.9); ctx.fill(HULL_P); ctx.translate(-0.5, -0.9); // soft drop shadow
  ctx.lineWidth = 2; ctx.strokeStyle = halo; ctx.stroke(HULL_P);
  ctx.fillStyle = c.base; ctx.fill(HULL_P);
  ctx.globalAlpha *= 0.9; ctx.fillStyle = c.dark || c.line; ctx.fill(DECK_P); ctx.globalAlpha /= 0.9;
  ctx.lineWidth = 0.75; ctx.strokeStyle = c.light || "#FFFFFF"; ctx.beginPath(); ctx.moveTo(-5.4, 0); ctx.lineTo(3.4, 0); ctx.stroke(); // deck line
  ctx.lineWidth = 0.95; ctx.strokeStyle = c.line || c.dark; ctx.stroke(HULL_P);
  ctx.restore();
  if (o.sail) { // upright on screen: a mast with a white mainsail and jib (the bow side), a seat-colour pennant on top
    const fx = h.dir.x >= -0.15 ? 1 : -1, line = c.line || c.dark, white = night ? "#FFF0D0" : "#FFFFFF";
    const MAIN = path(MAIN_D), JIB = path(JIB_D);
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.scale(fx * SAIL_K, SAIL_K);
    ctx.strokeStyle = halo; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.lineTo(0, -13.8); ctx.stroke(); ctx.stroke(MAIN); ctx.stroke(JIB);
    ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0.4); ctx.lineTo(0, -13.8); ctx.stroke();
    ctx.fillStyle = white; ctx.lineWidth = 0.9; ctx.fill(MAIN); ctx.stroke(MAIN); ctx.fill(JIB); ctx.stroke(JIB);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-5, -12.8); ctx.lineTo(0, -11.7); ctx.closePath(); // pennant streams aft
    ctx.fillStyle = c.base; ctx.fill(); ctx.lineWidth = 0.7; ctx.stroke();
  }
  ctx.restore();
}

/** The course line: soft halo, then the seat colour (ivory and other pale seats get a dark core edge). */
function strokeRoutes(ctx, list, dp, T, rf) {
  const night = isNight();
  const poly = (r) => tracePath(ctx, r, rf);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = night ? "rgba(255,236,200,.42)" : T?.id === "C" ? "rgba(255,249,238,.7)" : "rgba(255,255,255,.58)";
  ctx.lineWidth = 4.4 * dp; // halo + line stay under a land road's weight (road ~4.5 css px + its rim on a phone)
  list.forEach(({ r }) => { ctx.globalAlpha = 1; poly(r); ctx.stroke(); });
  list.forEach(({ r, c, alpha = 1 }) => {
    ctx.globalAlpha = alpha;
    if (pale(c.base)) { ctx.strokeStyle = c.line || "#4A4234"; ctx.lineWidth = 2.9 * dp; poly(r); ctx.stroke(); }
    ctx.strokeStyle = c.base; ctx.lineWidth = 2 * dp; poly(r); ctx.stroke();
  });
  ctx.restore();
}
const pale = (hex) => { const n = parseInt(String(hex).replace("#", "").slice(0, 6), 16); if (Number.isNaN(n)) return false; return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) > 200; };

/** Art units per design px for the SVG renderer: css px at the fitted zoom (grows with zoom like every piece). */
function designPx(R) {
  const g = R.game, fit = g._fitScale || g.view.scale || 1;
  return Math.max(1 / (R.u * fit), 100 / 26);
}
function svgEnv(R) {
  const g = R.game, dp = designPx(R);
  const pills = (R.layer?.pills || harbourBadges(g, harbourScale(g))).map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h }));
  const avoid = g.sea?.pirateHexId != null ? [(() => { const c = R.hexArt(g.geometry.hexes[g.sea.pirateHexId]); return { x: c.x, y: c.y - 6, r: 30 * R.pieceScale * 1.25 }; })()] : [];
  g.geometry.nodes.forEach((n) => { if (n.structure) { const p = R.nodeArt(n.id); avoid.push({ x: p.x, y: p.y - 8, r: (n.structure === "city" ? 26 : 20) * R.pieceScale * 1.15 }); } }); // pieces are 15% larger since v0.96
  return { g, P: (n) => R.nodeArt(n), C: (h) => R.hexArt(g.geometry.hexes[h]), R: 100, dp, coast: COAST[R.theme.id] ?? 0.18, pills, avoid };
}

/** Ships: every route's course, then the hulls y-sorted (lead ships with their sail); the lifted ship while moving one. */
export function drawShips(R, ctx, now, reduced) {
  const g = R.game;
  const sel = g.pendingAction === "moveShip" ? g.sea.moveSel?.from : null;
  const geo = shipRoutes(svgEnv(R), R), dp = geo.dp;
  ctx.save();
  // the harbour pills (re-drawn on top, with a dark rim) keep every pixel: the ships are clipped out of each pill and
  // its rim, so not even the anti-aliased rim edge shows a course or a halo through it
  const pills = R.layer?.pills;
  if (pills?.length) {
    const px = 1 / (R.u * g.view.scale), m = 3.4 * px;
    const clip = new Path2D();
    clip.rect(-1e5, -1e5, 2e5, 2e5);
    pills.forEach((q) => { const x0 = q.x - q.w / 2 - m, y0 = q.y - q.h / 2 - m, w = q.w + 2 * m, h = q.h + 2 * m; if (clip.roundRect) clip.roundRect(x0, y0, w, h, (q.r || 0) + m); else clip.rect(x0, y0, w, h); });
    ctx.clip(clip, "evenodd");
  }
  // building / moving a ship: the sea grid near your network grows stronger (under the ships, inside the pill clip)
  const legal = R.placementActive() ? R.legalSpots().ships || [] : [];
  if (legal.length) seaGridNear(ctx, g, legal, geo, (n) => R.nodeArt(n), g.currentPlayer?.id ?? 0, R.theme);
  strokeRoutes(ctx, geo.routes.map((r) => ({ r, c: R.pc(g.players[r.owner]) })), dp, R.theme, geo.rf);
  let hulls = 0, sails = 0;
  // v1.18 the ships you may move now carry a ring (stronger for a moment after "Move ship" in the build sheet)
  const mover = g._seaMover?.(), mov = mover && (!g.pendingAction || g.pendingAction === "build") && !g.winner ? new Set(g._seaMovable(mover)) : null;
  const pulse = g.sea?.movePulse ? Math.max(0, 1 - (now - g.sea.movePulse) / 3600) : 0;
  geo.hulls.slice().sort((a, b) => a.y - b.y).forEach((h) => {
    const c = R.pc(g.players[h.owner]);
    hulls += 1; if (h.lead) sails += 1;
    if (h.edge.id === sel) { // lifted: a dashed ring, the ship raised and see-through
      const px = 1 / (R.u * g.view.scale);
      ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y - 2 * dp, 11 * dp, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fill();
      ctx.setLineDash([6 * px, 4 * px]); ctx.lineWidth = 2.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.restore();
      drawHull(ctx, h, c, dp, { sail: h.lead, alpha: 0.6, dy: -3 * dp });
      return;
    }
    const an = R.animFor("road", h.edge.id);
    let s = 1, a = 1, dy = 0;
    if (an) { // built: the hull drops onto the water with a small bounce (as houses do), a ring of foam spreads
      const t = clamp01((now - an.start) / an.dur);
      if (reduced) a = clamp01(t / 0.3);
      else {
        s = 0.55 + 0.45 * Math.min(1, t * 1.6) + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.18; dy = -10 * dp * (1 - Math.min(1, t * 1.5)); a = clamp01(t * 3);
        const f = clamp01((t - 0.35) / 0.65);
        if (f > 0 && f < 1) { ctx.save(); ctx.globalAlpha = 0.85 * (1 - f); ctx.lineWidth = 1.6 * dp; ctx.strokeStyle = "#FFFFFF"; ctx.beginPath(); ctx.ellipse(h.x, h.y, (6 + 9 * f) * dp, (3.5 + 5 * f) * dp, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
    }
    drawHull(ctx, h, c, dp, { sail: h.lead, alpha: a, s, dy });
    if (mov?.has(h.edge.id) && !an) { // a thin white ring with a dark outline reads on any sea; it breathes while the hint is on
      const px = 1 / (R.u * g.view.scale), br = pulse ? 0.5 + 0.5 * Math.sin(now / 160) : 0, rr = (12 + 2.5 * pulse * br) * dp;
      ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y - 2 * dp, rr, 0, Math.PI * 2);
      ctx.lineWidth = 3.6 * px; ctx.strokeStyle = "rgba(20,40,50,.55)"; ctx.stroke();
      ctx.lineWidth = 1.9 * px; ctx.strokeStyle = "#FFFFFF"; ctx.globalAlpha = 0.75 + 0.25 * pulse; ctx.stroke(); ctx.restore();
      if (pulse) R.requestDraw();
    }
  });
  ctx.restore();
  R.shipStats = { ships: geo.hulls.length, hulls, sails, routes: geo.routes.length };
}

/** The pirate mid-hex (glides when moved), plus +2 island chips and the brief new-island outline. */
export function drawPirateAndChips(R, ctx, now, reduced, devK, drawSpec) {
  const g = R.game, sea = g.sea, S = seaArt(R.theme);
  if (sea.pirateHexId != null) {
    const to = R.hexArt(g.geometry.hexes[sea.pirateHexId]);
    let pos = to;
    const an = R._pirate;
    if (!an || an.to !== sea.pirateHexId) R._pirate = { from: an ? an.to : sea.pirateHexId, to: sea.pirateHexId, start: now, gen: g.gameGen };
    const A = R._pirate;
    if (A.from !== A.to && !reduced && A.gen === g.gameGen) {
      const t = clamp01((now - A.start) / 1100);
      if (t < 1) {
        const fr = R.hexArt(g.geometry.hexes[A.from]);
        const e = 1 - Math.pow(1 - t, 3);
        pos = { x: fr.x + (to.x - fr.x) * e, y: fr.y + (to.y - fr.y) * e - Math.sin(t * Math.PI) * 18 };
        R.requestDraw();
      }
    }
    ctx.save(); ctx.translate(pos.x, pos.y + 6); ctx.scale(R.pieceScale * 1.25, R.pieceScale * 1.25);
    drawSpec(ctx, S.pirate, { k: devK, rim: R.theme.rim, rimW: R.theme.rimW ?? 5 });
    ctx.restore();
  }
  // new island: a calm warm outline round the island for a moment
  const glow = sea.glow;
  if (glow && now < glow.until) {
    const a = clamp01((glow.until - now) / 600) * clamp01((now - (glow.until - 2600)) / 300);
    g.geometry.hexes.filter((h) => h.island === glow.island).forEach((h) => {
      const c = R.hexArt(h);
      ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = a; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "rgba(255,247,222,.95)"; ctx.stroke(HEXP(91)); ctx.restore();
    });
    R.requestDraw();
  }
  // +2 chips under island-bonus settlements (the rulebook's catan chits)
  const font = R.theme.tokenStyle.labelFont;
  sea.bonusChips().forEach(({ nodeId }) => {
    const p = R.nodeArt(nodeId), k = R.pieceScale;
    ctx.save(); ctx.translate(p.x + 22 * k, p.y + 12 * k); ctx.scale(k, k);
    ctx.shadowColor = "rgba(27,42,42,.3)"; ctx.shadowBlur = 3 * devK; ctx.shadowOffsetY = 1.5 * devK;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = S.chip.fill; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.lineWidth = 1.6; ctx.strokeStyle = S.chip.ring; ctx.stroke();
    ctx.fillStyle = S.chip.ink; ctx.font = `800 12px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("+2", 0, 1);
    ctx.restore();
  });
}

/** Legal ship spots: a ghost hull in your colour on each legal edge (~55% by day, 35% at Night, a gentle pulse), the same boat as a
 *  built ship, so the hint shows exactly the edge the ship will take. `c` = the seat's piece colours. */
export function drawShipSpots(R, ctx, ids, cb, pulse, c) {
  const g = R.game, env = svgEnv(R), geo = shipRoutes(env, R);
  ghostHulls(ctx, g, ids.filter((id) => !(cb && cb.type === "ship" && cb.id === id)), geo, env.P, typeof c === "string" ? { base: c, line: "#1F1A17", dark: c, light: "#FFFFFF" } : c, pulse);
}
/** While you build or move a ship, the sea grid grows stronger within ~2.5 hexes of the legal spots and your own ships
 *  (fading out with distance), so the edges you can use stand out together with the ghost hulls. */
function seaGridNear(ctx, g, ids, geo, P, pid, T, pulse) {
  const focus = ids.map((id) => geo.spot(g.geometry.edges[id]));
  geo.hulls.forEach((h) => { if (h.owner === pid) focus.push(h); });
  if (!focus.length) return;
  const reach = 2.5 * geo.R, fade = Math.max(0.5, Math.min(1, (pulse?.a ?? 0.4) / 0.4));
  const bands = [[], [], []];
  seaEdges(g).forEach((e) => {
    const a = P(e.nodes[0]), b = P(e.nodes[1]), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let d = Infinity; for (const f of focus) { const v = Math.hypot(m.x - f.x, m.y - f.y); if (v < d) d = v; }
    if (d < reach) bands[Math.min(2, Math.floor((d / reach) * 3))].push([a, b]);
  });
  ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = 1.3 * geo.dp;
  bands.forEach((list, i) => {
    if (!list.length) return;
    ctx.globalAlpha = fade; ctx.strokeStyle = isNight() ? ["rgba(228,244,248,.6)", "rgba(228,244,248,.42)", "rgba(228,244,248,.28)"][i] : seaGridColour(T, [1.9, 1.45, 1.15][i]);
    ctx.beginPath(); list.forEach(([a, b]) => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }); ctx.stroke();
  });
  ctx.restore();
}
function ghostHulls(ctx, g, ids, geo, P, c, pulse) {
  // ~55% by day (with the hull's own white halo and dark outline: every legal edge reads on the light sea), 35% at Night;
  // times the placement fade and its slow drift (the gentle pulse)
  const a = (isNight() ? 0.35 : 0.55) * Math.max(0.5, Math.min(1.15, (pulse?.a ?? 0.4) / 0.4));
  ids.forEach((id) => {
    const e = g.geometry.edges[id], p = geo.spot(e);
    drawHull(ctx, { x: p.x, y: p.y, dir: ghostDir(g, e, P) }, c, geo.dp, { alpha: a });
  });
}

export function ghostShip(R, ctx, id, c, alpha) {
  const g = R.game, env = svgEnv(R), geo = shipRoutes(env, R), dp = geo.dp, e = g.geometry.edges[id];
  const p = geo.spot(e), h = { x: p.x, y: p.y, dir: ghostDir(g, e, env.P) };
  const px = 1 / (R.u * g.view.scale);
  ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(h.x, h.y - 3 * dp, 11 * dp, 0, Math.PI * 2); ctx.fillStyle = "rgba(251,246,234,.3)"; ctx.fill();
  ctx.setLineDash([5 * px, 4 * px]); ctx.lineWidth = 2 * px; ctx.strokeStyle = "#FBF6EA"; ctx.stroke(); ctx.restore();
  drawHull(ctx, h, c, dp, { sail: true, alpha: 0.85 * alpha });
}
/** A new ship points away from the player's own pieces (the way it sails). */
function ghostDir(g, e, P) {
  const pid = g.currentPlayer?.id ?? 0, a = P(e.nodes[0]), b = P(e.nodes[1]);
  const mine = (n) => { const nd = g.geometry.nodes[n]; return (nd.structure && nd.owner === pid) || nd.edgeIds.some((x) => x !== e.id && g.geometry.edges[x].owner === pid); };
  const fwd = mine(e.nodes[0]) || !mine(e.nodes[1]);
  return unit(fwd ? { x: b.x - a.x, y: b.y - a.y } : { x: a.x - b.x, y: a.y - b.y });
}

export function ghostPirate(R, ctx, hexId, alpha, drawSpec) {
  const c = R.hexArt(R.game.geometry.hexes[hexId]);
  ctx.save(); ctx.translate(c.x, c.y + 6); ctx.scale(R.pieceScale * 1.25, R.pieceScale * 1.25);
  drawSpec(ctx, seaArt(R.theme).pirate, { alpha });
  ctx.restore();
}

// ── legacy Classic canvas (theme "Classic"): functional, plain ─────────────
export function drawClassicSea(g, ctx) {
  const sea = g.sea, s = g.geometry.hexSize / 74;
  // ships: the same routes as the art themes (v0.98), in geometry units
  const geo = g.geometry, fit = g._fitScale || g.view.scale || 1, T = g.theme;
  const env = { g, P: (n) => geo.nodes[n], C: (h) => geo.hexes[h].center, R: geo.hexSize, dp: Math.max(1 / fit, geo.hexSize / 26), coast: COAST.classic, pills: [],
    avoid: sea.pirateHexId != null ? [{ x: geo.hexes[sea.pirateHexId].center.x, y: geo.hexes[sea.pirateHexId].center.y - 7 * s, r: 24 * s }] : [] };
  const routes = shipRoutes(env, g);
  ctx.save(); ctx.beginPath(); // the faint sea grid (v0.98): every open-water edge
  seaEdges(g).forEach((e) => { const a = geo.nodes[e.nodes[0]], b = geo.nodes[e.nodes[1]]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); });
  ctx.lineCap = "round"; ctx.lineWidth = 1.1 * env.dp; ctx.strokeStyle = seaGridColour(T, 0.9); ctx.stroke(); ctx.restore();
  const colOf = (o) => { const c = T?.pc?.[T.seatKeys?.[o]]; return c ? { ...c, line: "#111" } : { base: g.players[o].color, dark: "rgba(0,0,0,.35)", light: "rgba(255,255,255,.75)", line: "#111" }; };
  const spots = g._legalPlacementSpots?.();
  if (spots?.ships?.length) seaGridNear(ctx, g, spots.ships, routes, env.P, g.currentPlayer?.id ?? 0, T);
  strokeRoutes(ctx, routes.routes.map((r) => ({ r, c: colOf(r.owner) })), env.dp, T, routes.rf);
  routes.hulls.slice().sort((a, b) => a.y - b.y).forEach((h) => drawHull(ctx, h, colOf(h.owner), env.dp, { sail: h.lead }));
  g._classicShipStats = { ships: routes.hulls.length, hulls: routes.hulls.length, sails: routes.hulls.filter((h) => h.lead).length };
  if (sea.pirateHexId != null) {
    const h = g.geometry.hexes[sea.pirateHexId];
    ctx.save(); ctx.translate(h.center.x, h.center.y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fillStyle = "#2a2f33"; ctx.fill();
    ctx.fillRect(-12, -24, 24, 20); ctx.fillStyle = "#f2e8d0"; ctx.beginPath(); ctx.arc(0, -15, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  sea.bonusChips().forEach(({ nodeId }) => {
    const n = g.geometry.nodes[nodeId];
    ctx.save(); ctx.translate(n.x + 14 * s, n.y + 9 * s);
    ctx.beginPath(); ctx.arc(0, 0, 8 * s, 0, Math.PI * 2); ctx.fillStyle = "#f3d27a"; ctx.fill(); ctx.strokeStyle = "#8a6a2c"; ctx.stroke();
    ctx.fillStyle = "#4a3a12"; ctx.font = `800 ${9 * s}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+2", 0, 0.5);
    ctx.restore();
  });
  // legal ship spots / move targets: ghost hulls in the current player's colour (the grid near them is drawn above)
  if (spots?.ships?.length) ghostHulls(ctx, g, spots.ships, routes, env.P, colOf(g.currentPlayer?.id ?? 0), { a: 0.4 });
}

// ── v1.31 (ux-132) the Build / Move ship chooser: piece icons for its tiles and the preview on the board ──
/** Draw one chooser tile's piece (seat colour, as on the board) into a small canvas (CSS size w × h). */
export function drawChoiceIcon(R, canvas, type, c, drawSpec, w = 44, h = 36) {
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr); ctx.translate(w / 2, h / 2);
  if (type === "settlement" || type === "city") {
    const k = h / (type === "city" ? 58 : 50);
    ctx.translate(0, type === "city" ? 2 : 3); ctx.scale(k, k);
    drawSpec(ctx, type === "city" ? R.theme.pieces.city(c) : R.theme.pieces.settlement(c), { k: k * dpr });
    return;
  }
  if (type === "road") {
    const a = { x: -w * 0.36, y: h * 0.22 }, b = { x: w * 0.36, y: -h * 0.22 };
    ctx.lineCap = "round";
    const seg = (col, lw) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
    seg("rgba(255,255,255,.95)", 10); seg(c.line || c.dark, 8); seg(c.base, 5.2);
    ctx.save(); ctx.translate(-0.5, -0.9); seg(c.light || "#fff", 1.4); ctx.restore();
    return;
  }
  // ship / move: a hull with its sail; "move" adds a curved arrow
  const move = type === "move", dp = h / (move ? 22 : 19);
  drawHull(ctx, { x: move ? -w * 0.12 : 0, y: h * 0.18, dir: { x: 1, y: 0 } }, c, dp, { sail: true });
  if (move) {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    const arrow = (col, lw) => {
      ctx.beginPath(); ctx.moveTo(w * 0.08, -h * 0.28); ctx.quadraticCurveTo(w * 0.42, -h * 0.3, w * 0.4, h * 0.12); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.29, h * 0.02); ctx.lineTo(w * 0.4, h * 0.16); ctx.lineTo(w * 0.49, h * 0.0); ctx.stroke();
    };
    arrow("rgba(255,255,255,.95)", 5.5); arrow(c.line || c.dark || "#22313A", 2.6);
    ctx.restore();
  }
}

/**
 * The chooser's preview on the board (`g._seaPreview = { items: [{ type, id, n }], focus, numbered }`): a ghost of each
 * piece where it would go and a ring round the ship that would move. `numbered`: every option at once, each with the
 * number of its tile; otherwise only the focused option (the first by default).
 */
export function drawSeaPreview(R, ctx, devK) {
  const g = R.game, pv = g._seaPreview;
  if (!pv?.items?.length || !g.currentPlayer) return;
  const c = R.pc(g.currentPlayer), px = 1 / (R.u * g.view.scale);
  const items = pv.numbered ? pv.items : [pv.items[pv.focus ?? 0]];
  const env = svgEnv(R), geo = shipRoutes(env, R), dp = geo.dp;
  const at = (it) => {
    if (it.type === "settlement" || it.type === "city") { const p = R.nodeArt(it.id); return { x: p.x, y: p.y - 4 }; }
    if (it.type === "move") { const h = geo.hulls.find((x) => x.edge.id === it.id); if (h) return { x: h.x, y: h.y - 2 * dp }; }
    const e = g.geometry.edges[it.id], a = R.nodeArt(e.nodes[0]), b = R.nodeArt(e.nodes[1]);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  items.forEach((it) => {
    if (it.type === "move") {
      const p = at(it);
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 14 * dp, 0, Math.PI * 2);
      ctx.lineWidth = 5 * px; ctx.strokeStyle = "rgba(20,40,50,.6)"; ctx.stroke();
      ctx.setLineDash([6 * px, 4 * px]); ctx.lineWidth = 2.6 * px; ctx.strokeStyle = "#FFFFFF"; ctx.stroke(); ctx.restore();
    } else R.ghost(ctx, it.type, it.id, c, 0.9, devK);
  });
  if (!pv.numbered) return;
  items.forEach((it) => { // the tile's number by its spot: a cream disc, dark rim and number (readable on land and sea)
    // a ship's number sits up-left of its ring, a piece's down-right of it: side by side they never cover each other
    const p = at(it), r = 9 * px, mv = it.type === "move" || it.type === "ship", x = p.x + (mv ? -20 : 18) * px, y = p.y + (mv ? -18 : 14) * px;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = "#FBF6EA"; ctx.fill();
    ctx.lineWidth = 2 * px; ctx.strokeStyle = "#22313A"; ctx.stroke();
    ctx.fillStyle = "#22313A"; ctx.font = `800 ${12 * px}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(it.n), x, y + 0.5 * px); ctx.restore();
  });
}
