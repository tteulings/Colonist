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
const PILL_FONT_PX = 12.3; // css px: the ratio floor the fit uses (game.js PILL_MIN_FONT)
/** v0.78: harbour pill scale. Phones: sized so the ratio reads at ~12-14 css px whatever the board (the 5–6
 *  player board has smaller hexes, so its pills scale up more); desktop: 1. Shared by every renderer and the fit. */
export function harbourScale(game) {
  // v0.94 ⚓ Seafarers: its 9-row frame is fitted at well under 1x (0.56 on a landscape phone, 0.6 on desktop), so a
  // pill sized from the world hex size read at 8-11 css px there; it is sized from the fitted on-screen hex instead
  const sea = game.sea && game._hPx ? game._hPx : 0;
  if (!game.isMobileLayout) return sea ? seaHarbourScale(sea, false) : 1;
  if (game._hScale) return game._hScale; // set by the board fit (largest scale that keeps the v0.77 board size)
  if (sea) return seaHarbourScale(sea, true);
  const hs = game.geometry?.hexSize || 32;
  return harbourScaleWanted(hs);
}
export const harbourScaleWanted = (hs) => Math.max(1.38, Math.min(2.4, 55 / hs));
/** ⚓ pill scale from the fitted css px per hex (radius): the ratio reads at ~13-14 px on phones (as on the basic
 *  island), ~14 px on desktop (never smaller than the basic desktop pill). */
export const seaHarbourScale = (hexPx, mobile) => (mobile ? Math.max(1.38, Math.min(2.7, 55 / hexPx)) : Math.max(1, Math.min(1.6, 56 / hexPx)));
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
  const key = [s, clear, (game._hMinFontArt || 0).toFixed(2), !!game.sea, g.hexSize.toFixed(3), g.centerX.toFixed(2), g.centerY.toFixed(2), ports.map((p) => p.edgeId + p.type).join(","), land.map((h) => h.id).join(".")].join("|");
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
  // v1.00 (Option C): a harbour sits centred in front of its own coast edge, as in the boxed game. Its pill lies on
  // the perpendicular through the edge's midpoint at ONE coast gap (`clear`, the same for every harbour of the board)
  // and its two piers run symmetrically, equally long, from the pill to the edge's two corners. Where that spot
  // collides (another pill, land of a bay, a pier that would cross a road / token / corner / land), the pill first
  // shrinks a little (its ratio never under the fit's 12 px floor, game._hMinFontArt) and only then slides OUTWARD
  // along the same perpendicular, never sideways. A narrow strait where nothing on the perpendicular fits gets the
  // compact pill (the floor-size ratio in a tighter pill) closer to the coast, still on the perpendicular; a pier
  // never crosses land.
  const gap = 5 * Math.min(s, 1.6);
  const minFont = game._hMinFontArt > 0 ? game._hMinFontArt : 25 * s; // art units of ratio text that read 12.3 css px at Fit
  const fMin = Math.min(1, Math.max(0.84, minFont / (25 * s))), fC = Math.min(1, minFont / (25 * s));
  const FS = [1]; for (let f2 = 0.96; f2 > fMin + 0.005; f2 -= 0.04) FS.push(f2); if (fMin < 1) FS.push(fMin);
  const nearAny = (pts) => { // does a pier (corner → [knee →] end) cross a land hex (past its own beach) or pass another corner?
    let walked = 0;
    for (let i = 0; i + 1 < pts.length; i += 1) {
      const p = pts[i], q = pts[i + 1], L = Math.hypot(q.x - p.x, q.y - p.y);
      for (let k = 1; k <= 24; k += 1) {
        const x = p.x + ((q.x - p.x) * k) / 24, y = p.y + ((q.y - p.y) * k) / 24, dn = walked + (L * k) / 24;
        if (dn > 12 && centers.some((c) => [0, 60, 120].every((deg) => { const a2 = (deg * Math.PI) / 180; return Math.abs((x - c.x) * Math.cos(a2) + (y - c.y) * Math.sin(a2)) <= 82; }))) return "land";
        if (dn > 18 && coastNodes.some((n) => n.id !== pts[0].id && Math.hypot(x - n.x, y - n.y) < 15)) return "node";
      }
      walked += L;
    }
    return "";
  };
  const layoutAt = (clear) => {
    const hs = ports.map((port) => {
      const any = port.type === "any";
      const edge = g.edges[port.edgeId];
      const a = { ...A(g.nodes[edge.nodes[0]]), id: edge.nodes[0] }, b = { ...A(g.nodes[edge.nodes[1]]), id: edge.nodes[1] };
      const hc = A(g.hexes[edge.hexIds.find((id) => g.hexes[id].resource !== "sea") ?? edge.hexIds[0]].center);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(mx - hc.x, my - hc.y) || 1;
      const nx = (mx - hc.x) / len, ny = (my - hc.y) / len, tx = -ny, ty = nx;
      const near = centers.filter((c) => Math.hypot(c.x - mx, c.y - my) < 330 * Math.max(1, s));
      // corner a sits on the -t side of the midpoint or the +t side: its pier ends on that side of the pill
      const sa = (a.x - mx) * tx + (a.y - my) * ty < 0 ? -1 : 1;
      // a pill of size factor fz (compact: the floor-size ratio in a tighter pill), its centre `d` out along the normal
      const dims = (fz, compact) => { const k = s * fz, cw = compact ? 0.92 : 1; return { k, cw, w: (any ? 48 : 70) * k * cw, h: 31 * k }; };
      const pillAt = (D, d) => {
        const x = mx + nx * d, y = my + ny * d, hw = D.w / 2, hh = D.h / 2;
        // pier ends: under the pill, mirrored about the normal, so both piers are equally long
        const lat = (Math.abs(tx) * hw + Math.abs(ty) * hh) * 0.45;
        const end = (sg) => [x + sg * tx * lat, y + sg * ty * lat];
        const straight = [[a, end(sa)], [b, end(-sa)]];
        const P3 = ([c, e, kn]) => (kn ? [c, { x: kn[0], y: kn[1] }, { x: e[0], y: e[1] }] : [c, { x: e[0], y: e[1] }]);
        const pierOk = (prs) => prs.every((pr) => pierClear(P3(pr)) && !nearAny(P3(pr)));
        let piers = straight, pOk = pierOk(straight);
        // a straight pier that would run along a road or over a token: both piers first step straight out (the same
        // distance along the edge normal, so they stay mirrored), then turn to the pill
        for (const dk of [18, 26, 34]) {
          if (pOk) break;
          const kn = straight.map(([c, e]) => [c, e, [c.x + nx * dk, c.y + ny * dk]]);
          if (pierOk(kn)) { piers = kn; pOk = true; }
        }
        const landX = piers.some((pr) => nearAny(P3(pr)) === "land");
        return { x, y, hw, hh, piers, pOk, landX };
      };
      // the centre distance that leaves exactly `cl` between the pill and its own land hex (the coast gap)
      const d0 = (D, cl) => { let d = 0; while (d < 400 && boxHexDist(mx + nx * d, my + ny * d, D.w / 2, D.h / 2, hc) < cl) d += 1; return d; };
      // the coast gap `cl` is kept to the harbour's OWN land hex (the room its piers need for the dot); the neighbouring land
      // (the next hex of a convex coast, the far side of a bay) only needs the beach band and a corner piece clear (30, as
      // up to v0.85), so a harbour on an ordinary coast is never pushed out by the hex next door
      const other = (cl) => Math.min(cl, Math.max(30, clear * 0.5));
      const landOk = (p, cl) => near.every((c) => boxHexDist(p.x, p.y, p.hw, p.hh, c) >= (c.x === hc.x && c.y === hc.y ? cl : other(cl)) - 0.01);
      // (an outward slide is kept short: at most ~16 css px at the fit, past that the compact pill closer in reads better)
      const SLIDE = Math.min(72 * s, game._hMinFontArt > 0 ? (16 * game._hMinFontArt) / (PILL_FONT_PX * 1.01) : 72 * s), step = Math.min(3 * s, SLIDE / 8);
      // every spot this harbour may take, best first, each clear of the land and with clean piers (other pills are
      // resolved below): 1. the default gap at full size, then a little smaller; 2. only then outward along the normal
      // (largest size that fits at each step); 3. a narrow strait: the compact pill closer to the coast, still on the normal;
      // 4. nothing fits cleanly: the compact pill along the normal by most room, piers never over land
      function* spots() {
        for (let dd = 0; dd <= SLIDE; dd += step) {
          for (const fz of FS) { const D = dims(fz, false), p = pillAt(D, d0(D, clear) + dd); if (p.pOk && landOk(p, clear)) yield { D, p, st: dd ? "slide" : fz < 1 ? "shrink" : "default" }; }
        }
        const D = dims(fC, true);
        for (const cl of [...new Set([clear * 0.75, clear * 0.55, 30].map((c) => Math.round(Math.min(clear, Math.max(30, c)))))].sort((p2, q2) => q2 - p2)) {
          for (let dd = 0; dd <= SLIDE; dd += step) { const p = pillAt(D, d0(D, cl) + dd); if (p.pOk && landOk(p, cl)) yield { D, p, st: "compact" }; }
        }
        const rest = [];
        for (let d = d0(D, 8); d <= d0(D, 8) + SLIDE; d += step) { const p = pillAt(D, d); if (!p.landX) rest.push({ p, room: Math.min(...near.map((c) => boxHexDist(p.x, p.y, p.hw, p.hh, c))) }); }
        rest.sort((u2, v2) => v2.room - u2.room);
        for (const r2 of rest) yield { D, p: r2.p, st: "squeeze" };
        if (!rest.length) yield { D, p: pillAt(D, d0(D, clear)), st: "squeeze" };
      }
      const gen = spots(), first = gen.next().value;
      return { gen, cur: first, rank: 0, any, a, b, mx, my, nx, ny };
    });
    // pills that collide: the one that has moved less so far takes its next spot (so two neighbours share the way out
    // rather than one being pushed far), until no two pills touch
    const pbox = (H) => ({ x: H.cur.p.x, y: H.cur.p.y, w: H.cur.D.w, h: H.cur.D.h });
    const stuck = new Set();
    for (let it = 0; it < 3000; it += 1) {
      let pair = null;
      for (let i = 0; i < hs.length && !pair; i += 1) for (let j = i + 1; j < hs.length; j += 1) if (!stuck.has(`${i},${j}`) && boxGap(pbox(hs[i]), pbox(hs[j])) < gap) { pair = [i, j]; break; }
      if (!pair) break;
      const [i, j] = pair, order = hs[i].rank < hs[j].rank ? [i, j] : [j, i];
      let moved = false;
      for (const m of order) { const n = hs[m].gen.next(); if (!n.done) { hs[m].cur = n.value; hs[m].rank += 1; moved = true; break; } }
      if (!moved) stuck.add(`${i},${j}`);
    }
    const out = hs.map((H) => {
      const { any, a, b, mx, my, nx, ny } = H, { D, p, st } = H.cur, { x, y, piers } = p, { k, cw, w, h } = D, hh = h / 2, ic = 24 * k * (cw < 1 ? 0.88 : 1), fs = 25 * k;
      const nearC = coastNodes.filter((n) => Math.hypot(n.x - x, n.y - y) < 120 + w); // corners a dot on these piers could meet
      return { x, y, w, h, r: hh, a, b, mx, my, nx, ny, piers, any, near: nearC, k, compact: cw < 1, fit: st,
        icon: any ? null : { x: x - 17 * k * cw, y, size: ic },
        text: any ? { x, y: y + fs * 0.36, size: fs } : { x: x + 15 * k * cw, y: y + fs * 0.36, size: fs } };
    });
    return out;
  };
  // v1.00: ONE coast gap for the whole board. On a cramped board (Seafarers at the landscape Fit, ~17 px hexes) the full
  // dot-room gap pushes many pills out or into their compact form; there the board's gap steps down (never under 30,
  // the beach band and a corner piece) until at most two harbours leave the common default, so they all still match.
  const offDefault = (o) => o.filter((q) => q.fit !== "default" && q.fit !== "shrink").length;
  let out = layoutAt(clear);
  for (let G = clear - 6; offDefault(out) > 2 && G >= Math.max(30, clear * 0.6) - 0.01; G -= 6) {
    const o2 = layoutAt(G);
    if (offDefault(o2) < offDefault(out)) out = o2;
  }
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
