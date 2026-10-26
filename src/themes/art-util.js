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
export function harbourBadges(game, s = 1) {
  const g = game.geometry, ports = game.ports || [];
  if (!g || !ports.length) return [];
  const u = g.hexSize / 100, A = (p) => ({ x: (p.x - g.centerX) / u, y: (p.y - g.centerY) / u });
  const land = g.hexes.filter((h) => h.resource !== "sea");
  const key = [s, g.hexSize.toFixed(3), g.centerX.toFixed(2), g.centerY.toFixed(2), ports.map((p) => p.edgeId + p.type).join(","), land.map((h) => h.id).join(".")].join("|");
  if (layoutCache.has(key)) return layoutCache.get(key);
  const centers = land.map((h) => A(h.center));
  const w = 66 * s, h = 36 * s, hw = w / 2, hh = h / 2, clear = Math.max(22 * s, 30), gap = 6 * s; // clear: past the beach band (~30) and a corner piece
  const placed = [];
  const out = ports.map((port) => {
    const edge = g.edges[port.edgeId];
    const a = A(g.nodes[edge.nodes[0]]), b = A(g.nodes[edge.nodes[1]]);
    const hc = A(g.hexes[edge.hexIds.find((id) => g.hexes[id].resource !== "sea") ?? edge.hexIds[0]].center);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(mx - hc.x, my - hc.y) || 1;
    const nx = (mx - hc.x) / len, ny = (my - hc.y) / len, tx = -ny, ty = nx;
    const near = centers.filter((c) => Math.hypot(c.x - mx, c.y - my) < 330 * Math.max(1, s));
    const ok = (x, y) => near.every((c) => boxHexDist(x, y, hw, hh, c) >= clear)
      && placed.every((q) => Math.abs(q.x - x) - hw * 2 >= gap || Math.abs(q.y - y) - hh * 2 >= gap);
    let best = null;
    for (let d = 0; d <= 200 * s && !best; d += 3 * s) {
      for (let k = 0; k <= 6 && !best; k += 1) { // slide along the coast up to 36·s before moving further out
        for (const sg of k ? [1, -1] : [1]) {
          const t = sg * k * 6 * s;
          const x = mx + nx * d + tx * t, y = my + ny * d + ty * t;
          if (ok(x, y)) { best = { x, y }; break; }
        }
      }
    }
    if (!best) best = { x: mx + nx * (200 * s), y: my + ny * (200 * s) };
    placed.push(best);
    const { x, y } = best, ic = 25 * s, fs = 20 * s;
    // pier ends: tucked under the pill, spread along the coast, each paired with the nearer corner
    const lat = (Math.abs(tx) * hw + Math.abs(ty) * hh) * 0.45, e0 = [x - tx * lat, y - ty * lat], e1 = [x + tx * lat, y + ty * lat];
    const dd = (c, e) => Math.hypot(c.x - e[0], c.y - e[1]);
    const piers = dd(a, e0) + dd(b, e1) <= dd(a, e1) + dd(b, e0) ? [[a, e0], [b, e1]] : [[a, e1], [b, e0]];
    return { x, y, w, h, r: hh, a, b, mx, my, nx, ny, piers,
      icon: { x: x - 16.5 * s, y, size: ic }, text: { x: x + 13.5 * s, y: y + fs * 0.36, size: fs } };
  });
  if (layoutCache.size > 40) layoutCache.clear();
  layoutCache.set(key, out);
  return out;
}
