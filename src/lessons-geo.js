// v1.94 Lessons: the geometry of the standard 19-hex island (pure, no DOM), rebuilt exactly like src/game.js createBoardGeometry so a saved game's node / edge / hex
// numbers can be read without loading the game: hexes in axial order, nodes and edges numbered in order of first appearance. Unit size (hex radius 1).
// A board that is not the standard island (Seafarers, 5-6 players) has no geometry here (stdGeo is only used when the saved board has 19 hexes and no sea).
const S3 = Math.sqrt(3);
let G = null;
export function stdGeo() {
  if (G) return G;
  const hexes = [], nodes = [], edges = [], nk = new Map(), ek = new Map();
  const node = (x, y) => { const k = `${Math.round(x * 1000)},${Math.round(y * 1000)}`; if (nk.has(k)) return nk.get(k); nodes.push({ x, y, hx: [], nb: [], ed: [] }); nk.set(k, nodes.length - 1); return nodes.length - 1; };
  const edge = (a, b) => { const k = a < b ? `${a}:${b}` : `${b}:${a}`; if (ek.has(k)) return ek.get(k); edges.push({ a, b }); const id = edges.length - 1; ek.set(k, id); nodes[a].ed.push(id); nodes[b].ed.push(id); return id; };
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    if (Math.abs(-q - r) > 2) continue;
    const cx = S3 * (q + r / 2), cy = 1.5 * r, id = hexes.length;
    const ids = Array.from({ length: 6 }, (_, i) => { const a = ((60 * i - 30) * Math.PI) / 180; return node(cx + Math.cos(a), cy + Math.sin(a)); });
    for (let i = 0; i < 6; i++) edge(ids[i], ids[(i + 1) % 6]);
    ids.forEach((n) => nodes[n].hx.push(id));
    hexes.push({ id, q, r, x: cx, y: cy, nodes: ids });
  }
  edges.forEach((e) => { if (!nodes[e.a].nb.includes(e.b)) nodes[e.a].nb.push(e.b); if (!nodes[e.b].nb.includes(e.a)) nodes[e.b].nb.push(e.a); });
  return (G = { hexes, nodes, edges });
}
export const hexCorners = (h) => Array.from({ length: 6 }, (_, i) => { const a = ((60 * i - 30) * Math.PI) / 180; return { x: h.x + Math.cos(a), y: h.y + Math.sin(a) }; });
/** the board of a saved game's state as { hexes: [{ res, num }] } (null: not the standard island) */
export function boardOf(state) {
  const hx = state?.hexes;
  if (!Array.isArray(hx) || hx.length !== 19 || state.sea || (state.settings?.board && state.settings.board !== "island")) return null; // Lake, Isthmus and Random shape have their own hexes
  return hx.map((h) => ({ res: h.resource, num: h.number || null }));
}
const L2R = { w: "wood", b: "brick", s: "sheep", h: "wheat", o: "ore", d: "desert" }, R2L = Object.fromEntries(Object.entries(L2R).map(([k, v]) => [v, k]));
/** the 19 hexes as one short string ("w3 b4 d0 ...": resource letter + number) kept in a game's row, so a crop of the board needs no saved game */
export const boardPack = (b) => b.map((h) => `${R2L[h.res] || "d"}${h.num || 0}`).join(" ");
export const boardUnpack = (s) => (typeof s === "string" ? s.split(" ").map((x) => ({ res: L2R[x[0]] || "desert", num: +x.slice(1) || null })) : null);
