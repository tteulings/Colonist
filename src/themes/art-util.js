// Shared helpers for SVG theme art. Art is authored for pointy-top hexes of radius 100
// ("art units"), corner i at angle 60*i - 30 degrees — the same convention as the game board.

export const S = 100;
export const R3 = Math.sqrt(3);

/** Round to one decimal — keeps generated SVG strings short. */
export const f = (n) => +(+n).toFixed(1);

/** Deterministic RNG so baked art is identical on every load. */
export function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function hexPath(cx, cy, size = S) {
  let d = "";
  for (let i = 0; i < 6; i += 1) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    d += (i ? "L" : "M") + f(cx + size * Math.cos(a)) + "," + f(cy + size * Math.sin(a));
  }
  return d + "Z";
}

export const HEX = hexPath(0, 0);

/** Number of probability pips under a number token (2/12 → 1 … 6/8 → 5). */
export const pipCount = (n) => 6 - Math.abs(7 - n);

/** Greedy word wrap for SVG <tspan> lines. */
export function wrap(text, n) {
  const out = [""];
  for (const w of text.split(" ")) {
    const cur = out[out.length - 1];
    if ((cur + " " + w).trim().length > n) out.push(w);
    else out[out.length - 1] = (cur + " " + w).trim();
  }
  return out;
}

export const RESOURCE_KEYS = ["wood", "brick", "sheep", "wheat", "ore"];
export const DEV_KEYS = ["knight", "roadBuilding", "yearOfPlenty", "monopoly", "victoryPoint"];

// Glossary (shared/glossary.md): friendly, consistent names.
export const RES_NAME = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
export const TERRAIN_NAME = { wood: "Forest", brick: "Hills", sheep: "Pasture", wheat: "Fields", ore: "Mountains", desert: "Desert", gold: "Gold field", sea: "Sea" };
export const DEV_NAME = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "Victory Point" };
export const CARD_TEXT = {
  wood: "From the forest", brick: "From the hills", sheep: "From the pasture", wheat: "From the fields", ore: "From the mountains",
  knight: "Move the robber and steal 1 card", roadBuilding: "Build 2 roads for free", yearOfPlenty: "Take any 2 cards from the bank",
  monopoly: "Name a resource — everyone hands theirs to you", victoryPoint: "Worth 1 victory point",
};

/** Escape text for use inside SVG/HTML. */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------------------------------------------------------- harbours (v0.76)
 * One badge per harbour, in the sea off its coast edge: a horizontal pill with the resource icon (or a "?"
 * for 3:1) left of the ratio in bold, plus two short piers to the coast corners that trade there.
 * harbourBadges(game, s) places every badge once and is shared by every theme, the legacy Classic renderer
 * and the board fit, so they all agree on where a pill sits and how far it reaches.
 * Placement: as close to its own coast edge as possible, but at least `clear` away from every land hex (beach
 * band, coast corners and the pieces on them included) and from the other pills — so a harbour in a bay of the
 * 5–6 player board or Seafarers slides out (or along the coast) until it is fully in the sea.
 * Units: art units (100 = hex size); s = piece/token scale (1.38 on phones, like the number tokens).
 */
const HX = Array.from({ length: 6 }, (_, i) => [Math.cos(((60 * i - 30) * Math.PI) / 180) * 100, Math.sin(((60 * i - 30) * Math.PI) / 180) * 100]);
const segD = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};
/** Distance between an axis-aligned box (centre x,y, half sizes hw,hh) and a land hex at c (0 = they touch/overlap). */
function boxHexDist(x, y, hw, hh, c) {
  const V = HX.map(([vx, vy]) => [c.x + vx, c.y + vy]);
  const R = [[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh]];
  // a box corner inside the hex (its three slab tests) or a hex corner inside the box
  const inHex = ([px, py]) => [0, 60, 120].every((deg) => { const a = (deg * Math.PI) / 180; return Math.abs((px - c.x) * Math.cos(a) + (py - c.y) * Math.sin(a)) <= 86.61; });
  if (R.some(inHex) || V.some(([px, py]) => Math.abs(px - x) <= hw && Math.abs(py - y) <= hh)) return 0;
  let d = Infinity;
  for (let i = 0; i < 6; i += 1) {
    const [ax, ay] = V[i], [bx, by] = V[(i + 1) % 6];
    R.forEach(([px, py]) => { d = Math.min(d, segD(px, py, ax, ay, bx, by)); });
    d = Math.min(d, Math.hypot(Math.max(Math.abs(ax - x) - hw, 0), Math.max(Math.abs(ay - y) - hh, 0)));
  }
  return d;
}
const layoutCache = new Map();
/** v0.78: harbour pill scale. Phones: sized so the ratio reads at ~12-14 css px whatever the board (the 5–6
 *  player board has smaller hexes, so its pills scale up more); desktop: 1. Shared by every renderer and the fit. */
export function harbourScale(game) {
  if (!game.isMobileLayout) return 1;
  if (game._hScale) return game._hScale; // set by the board fit (largest scale that keeps the v0.77 board size)
  const hs = game.geometry?.hexSize || 32;
  return harbourScaleWanted(hs);
}
export const harbourScaleWanted = (hs) => Math.max(1.38, Math.min(2.4, 55 / hs));
const boxGap = (p, q) => Math.max(Math.abs(p.x - q.x) - (p.w + q.w) / 2, Math.abs(p.y - q.y) - (p.h + q.h) / 2);
/** Does segment a→b come within m of box q? (sampled; boxes and piers are small) */
const segNearBox = (ax, ay, bx, by, q, m) => {
  for (let k = 0; k <= 24; k += 1) { const x = ax + ((bx - ax) * k) / 24, y = ay + ((by - ay) * k) / 24; if (Math.abs(x - q.x) <= q.w / 2 + m && Math.abs(y - q.y) <= q.h / 2 + m) return true; }
  return false;
};
export function harbourBadges(game, s = 1) {
  const g = game.geometry, ports = game.ports || [];
  if (!g || !ports.length) return [];
  const u = g.hexSize / 100, A = (p) => ({ x: (p.x - g.centerX) / u, y: (p.y - g.centerY) / u });
  const land = g.hexes.filter((h) => h.resource !== "sea");
  // v0.86: the coast clearance is chosen by the board fit (game._hClear, see _fitTarget): enough that the harbour
  // dot on each pier sits in free sea between the build-spot ring and the pill
  const clear = Math.max(30, game._hClear || 30);
  const key = [s, clear, !!game.sea, g.hexSize.toFixed(3), g.centerX.toFixed(2), g.centerY.toFixed(2), ports.map((p) => p.edgeId + p.type).join(","), land.map((h) => h.id).join(".")].join("|");
  if (layoutCache.has(key)) return layoutCache.get(key);
  const centers = land.map((h) => A(h.center));
  const coastNodes = g.nodes.filter((n) => n.adjacentHexes.some((id) => g.hexes[id] && g.hexes[id].resource !== "sea")).map((n) => ({ ...A(n), id: n.id }));
  // v0.81: a pier never runs along/over a coast edge (where a road lies) or a number token: when the straight
  // line from the coast corner to the pill would, it first steps straight out to sea (a knee), then turns
  const landSegs = g.edges.filter((e) => e.hexIds.some((id) => g.hexes[id] && g.hexes[id].resource !== "sea")).map((e) => [A(g.nodes[e.nodes[0]]), A(g.nodes[e.nodes[1]])]);
  const tokR = game.isMobileLayout ? 42 : 32, numbered = land.filter((h) => h.number).map((h) => A(h.center));
  const pierClear = (pts) => {
    let walked = 0;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const p = pts[i], q = pts[i + 1], L = Math.hypot(q.x - p.x, q.y - p.y);
      for (let k = 1; k <= 24; k += 1) {
        const x = p.x + ((q.x - p.x) * k) / 24, y = p.y + ((q.y - p.y) * k) / 24, dn = walked + (L * k) / 24;
        if (numbered.some((c) => Math.hypot(x - c.x, y - c.y) < tokR)) return false;
        if (dn > 16 && landSegs.some(([u, v]) => segD(x, y, u.x, u.y, v.x, v.y) < 10)) return false;
      }
      walked += L;
    }
    return true;
  };
  const bendPier = (c, e) => {
    const E = { x: e[0], y: e[1] };
    if (pierClear([c, E])) return [c, e];
    // straight out to sea from the corner: away from the land hexes that meet there
    const own = centers.filter((h) => Math.hypot(h.x - c.x, h.y - c.y) < 110);
    if (!own.length) return [c, e];
    const mx = own.reduce((t, h) => t + h.x, 0) / own.length, my = own.reduce((t, h) => t + h.y, 0) / own.length;
    const L = Math.hypot(c.x - mx, c.y - my) || 1, ox = (c.x - mx) / L, oy = (c.y - my) / L;
    for (const d of [18, 26, 34]) {
      const kn = [c.x + ox * d, c.y + oy * d];
      if (pierClear([c, { x: kn[0], y: kn[1] }, E])) return [c, e, kn];
    }
    return [c, e];
  };
  // clear: past the beach band (~30) and a corner piece; v0.78: no longer grows with s, so bigger (phone) pills
  // sit as close to the coast as the small ones and don't push the board fit out. v0.86: at least 30 (see above)
  const gap = 5 * Math.min(s, 1.6);
  const placed = [];
  const out = ports.map((port) => {
    const any = port.type === "any";
    // 2:1: resource icon + ratio; 3:1: just the ratio (a narrower pill)
    const w = (any ? 48 : 70) * s, h = 31 * s, hw = w / 2, hh = h / 2; // v0.78: compact pill, the ratio is what grows
    const edge = g.edges[port.edgeId];
    const a = { ...A(g.nodes[edge.nodes[0]]), id: edge.nodes[0] }, b = { ...A(g.nodes[edge.nodes[1]]), id: edge.nodes[1] };
    const hc = A(g.hexes[edge.hexIds.find((id) => g.hexes[id].resource !== "sea") ?? edge.hexIds[0]].center);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(mx - hc.x, my - hc.y) || 1;
    const nx = (mx - hc.x) / len, ny = (my - hc.y) / len, tx = -ny, ty = nx;
    const near = centers.filter((c) => Math.hypot(c.x - mx, c.y - my) < 330 * Math.max(1, s));
    const dd = (c, e) => Math.hypot(c.x - e[0], c.y - e[1]);
    const place = (cl, slide = 6) => {
      const ok = (x, y) => near.every((c) => boxHexDist(x, y, hw, hh, c) >= cl) && placed.every((q) => boxGap(q, { x, y, w, h }) >= gap);
      let best = null;
      for (let d = 0; d <= 200 * s && !best; d += 3 * s) {
        for (let k = 0; k <= slide && !best; k += 1) { // slide along the coast up to 36·s before moving further out
          for (const sg of k ? [1, -1] : [1]) {
            const t = sg * k * 6 * s;
            const x = mx + nx * d + tx * t, y = my + ny * d + ty * t;
            if (ok(x, y)) { best = { x, y }; break; }
          }
        }
      }
      if (!best) best = { x: mx + nx * (200 * s), y: my + ny * (200 * s) };
      const { x, y } = best;
      // pier ends: tucked under the pill, spread along the coast, each paired with the nearer corner
      const lat = (Math.abs(tx) * hw + Math.abs(ty) * hh) * 0.45, e0 = [x - tx * lat, y - ty * lat], e1 = [x + tx * lat, y + ty * lat];
      const piers = (dd(a, e0) + dd(b, e1) <= dd(a, e1) + dd(b, e0) ? [[a, e0], [b, e1]] : [[a, e1], [b, e0]]).map(([c, e]) => bendPier(c, e));
      return { x, y, piers };
    };
    // v0.86: a bigger clearance can push the pill of a narrow strait (Seafarers) across to the next island, so its
    // piers would cross land or pass other corners. Then try sliding it further along the coast (up to 72·s) and
    // stepping the clearance back towards 30: the first spot whose piers are clear AND still leave the dot its room
    // (open pier >= ~clear) wins; failing that, the clear-piered spot with the most open pier; failing that, the plain spot.
    const P3 = ([c, e, kn]) => (kn ? [c, { x: kn[0], y: kn[1] }, { x: e[0], y: e[1] }] : [c, { x: e[0], y: e[1] }]);
    const nearNode = (pts, own) => {
      let walked = 0;
      for (let i = 0; i + 1 < pts.length; i += 1) {
        const p = pts[i], q = pts[i + 1], L = Math.hypot(q.x - p.x, q.y - p.y);
        for (let k = 1; k <= 24; k += 1) {
          const x = p.x + ((q.x - p.x) * k) / 24, y = p.y + ((q.y - p.y) * k) / 24;
          if (walked + (L * k) / 24 > 18 && coastNodes.some((n) => n.id !== own && Math.hypot(x - n.x, y - n.y) < 15)) return true;
        }
        walked += L;
      }
      return false;
    };
    const openPier = (pts, q) => { // pier length from the corner until it reaches the pill (+ a small margin)
      let walked = 0;
      for (let i = 0; i + 1 < pts.length; i += 1) {
        const p = pts[i], r = pts[i + 1], L = Math.hypot(r.x - p.x, r.y - p.y);
        for (let k = 1; k <= 48; k += 1) {
          const x = p.x + ((r.x - p.x) * k) / 48, y = p.y + ((r.y - p.y) * k) / 48;
          if (Math.abs(x - q.x) <= q.w / 2 + 4 && Math.abs(y - q.y) <= q.h / 2 + 4) return walked + (L * k) / 48;
        }
        walked += L;
      }
      return walked;
    };
    const fine = (pl) => pl.piers.every((pr) => pierClear(P3(pr)) && !nearNode(P3(pr), pr[0].id));
    const room = (pl) => Math.min(...pl.piers.map((pr) => openPier(P3(pr), { x: pl.x, y: pl.y, w, h })));
    let pl = place(clear);
    if (clear > 30 && !fine(pl)) {
      let best = null, bestRoom = -1;
      for (let cl = clear; ; cl = Math.max(30, cl - 6)) {
        for (const sl of [6, 12]) {
          const c2 = place(cl, sl);
          if (!fine(c2)) continue;
          const r2 = room(c2);
          if (r2 > bestRoom) { best = c2; bestRoom = r2; }
          if (r2 >= clear * 0.97) break;
        }
        if (cl <= 30 || bestRoom >= clear * 0.97) break;
      }
      pl = best || pl;
    }
    const { x, y, piers } = pl, ic = 24 * s, fs = 25 * s; // v0.78: a bigger ratio in a compact pill
    placed.push({ x, y, w, h });
    const nearC = coastNodes.filter((n) => Math.hypot(n.x - x, n.y - y) < 120 + w); // corners a dot on these piers could meet
    return { x, y, w, h, r: hh, a, b, mx, my, nx, ny, piers, any, near: nearC,
      icon: any ? null : { x: x - 17 * s, y, size: ic },
      text: any ? { x, y: y + fs * 0.36, size: fs } : { x: x + 15 * s, y: y + fs * 0.36, size: fs } };
  });
  // Optional decoration (themes that want it): a small ship beside each pill, only where it fits fully in the
  // sea, clear of every pill, pier and other ship, and inside the box the pills already span (so it never
  // shrinks the board). None in Seafarers, where a ship reads as a player's ship.
  if (!game.sea) {
    const all = [...centers.map((c) => ({ x: c.x, y: c.y, w: 2 * (87 + clear), h: 2 * (100 + clear) })), ...out];
    const bb = { x0: Math.min(...all.map((q) => q.x - q.w / 2)), x1: Math.max(...all.map((q) => q.x + q.w / 2)), y0: Math.min(...all.map((q) => q.y - q.h / 2)), y1: Math.max(...all.map((q) => q.y + q.h / 2)) };
    const ships = [];
    out.forEach((q) => {
      const ss = Math.min(s, 1.38), sw = 34 * ss, sh = 32 * ss; // ships stay small: they never grow with the pill
      const cands = [[q.x + q.w / 2 + 3 * ss + sw / 2, q.y - 2 * ss], [q.x - q.w / 2 - 3 * ss - sw / 2, q.y - 2 * ss]];
      for (const [x, y] of cands) {
        const box = { x, y, w: sw, h: sh };
        if (x - sw / 2 < bb.x0 || x + sw / 2 > bb.x1 || y - sh / 2 < bb.y0 || y + sh / 2 > bb.y1) continue;
        if (!centers.every((c) => boxHexDist(x, y, sw / 2, sh / 2, c) >= clear)) continue;
        if (!out.every((o) => o === q ? true : boxGap(o, box) >= gap) || !ships.every((o) => boxGap(o, box) >= gap)) continue;
        if (out.some((o) => o.piers.some(([c, e, kn]) => (kn ? segNearBox(c.x, c.y, kn[0], kn[1], box, 2 * s) || segNearBox(kn[0], kn[1], e[0], e[1], box, 2 * s) : segNearBox(c.x, c.y, e[0], e[1], box, 2 * s))))) continue;
        q.ship = { x, y, w: sw, h: sh, flip: x > q.x ? 1 : -1, scale: 0.6 * ss };
        ships.push(box);
        break;
      }
    });
  }
  if (layoutCache.size > 40) layoutCache.clear();
  layoutCache.set(key, out);
  return out;
}

/** v0.81: SVG path of a pier [corner, end, knee?] (corner → optional knee → under the pill). */
export const pierD = ([c, e, kn]) => `M${f(c.x)},${f(c.y)}${kn ? ` L${f(kn[0])},${f(kn[1])}` : ""} L${f(e[0])},${f(e[1])}`;

/** v0.86: the harbour-node mark is a small dot again (v0.81-0.85: a bar across the pier), in the harbour's accent with
 *  a thin rim, placed DOT_OUT css px from the coast corner along the pier (round its knee if it has one) — outside the
 *  build-spot ring (7 px + stroke), the trimmed road ends and every piece. Never inside (or within 2 px of) the pill:
 *  if the pier is that short the dot steps back towards the corner (and is hidden if it would then touch the ring).
 *  Not drawn on a corner holding a settlement / city. pxArt = css px per art unit at the fitted zoom (sizes are art
 *  units, so the dot zooms with the board). Returns art units: { id, x, y, r (outer radius incl. rim), ri, hidden }. */
export const DOT_OUT = 12.5, DOT_D = 5.6, DOT_FILL = 3.4, DOT_MIN_ART = 22, DOT_RING = 8.05; // css px (DOT_RING: build-spot ring incl. its stroke)
export function pierDot([c, e, kn], pxArt, badge = null) {
  const px = 1 / (pxArt || 1), pts = [[c.x, c.y], ...(kn ? [kn] : []), e];
  const at = (d) => {
    for (let k = 0; k + 1 < pts.length; k += 1) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], l = Math.hypot(bx - ax, by - ay) || 1;
      if (d <= l || k + 2 === pts.length) { const t = Math.min(1, d / l); return [ax + (bx - ax) * t, ay + (by - ay) * t]; }
      d -= l;
    }
    return pts[0];
  };
  const r = (DOT_D / 2) * px;
  const inBadge = ([x, y]) => (badge && Math.abs(x - badge.x) <= badge.w / 2 + r + 2 * px && Math.abs(y - badge.y) <= badge.h / 2 + r + 2 * px)
    || (badge?.near || []).some((n) => n.id !== c.id && Math.hypot(x - n.x, y - n.y) < (DOT_RING + 1) * px + r); // or another corner's ring
  // big boards (desktop): at least DOT_MIN_ART out, so the dot also clears a road on a corner whose pier leaves the
  // coast at a shallow angle (12.5 px is only ~18 art units there)
  let d = Math.max(DOT_OUT * px, DOT_MIN_ART);
  // a pier that bends sharply at its knee: walk on until the dot is DOT_OUT px from the corner in a straight line too
  const total = pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  while (d < total && Math.hypot(at(d)[0] - c.x, at(d)[1] - c.y) < (DOT_OUT - 0.05) * px && !inBadge(at(d + 0.5 * px))) d += 0.5 * px;
  while (d > 0 && inBadge(at(d))) d -= 0.5 * px;
  const [x, y] = at(d);
  // a pier too short to hold the dot clear of both the build-spot ring and the pill (a narrow strait on a small
  // Seafarers board): no dot there (the pier still marks the harbour)
  const hidden = Math.hypot(x - c.x, y - c.y) < (DOT_RING + 1 + DOT_D / 2) * px;
  return { id: c.id, x, y, r, ri: (DOT_FILL / 2) * px, hidden };
}
/** Draw a pierDot (in the canvas's current units) on a 2D canvas: rim colour disc, accent fill on top. */
export function drawPierDot(ctx, t, fill, line) {
  ctx.save();
  ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
  ctx.beginPath(); ctx.arc(t.x, t.y, t.ri, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}
