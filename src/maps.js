// v1.99.3 board shapes: Lake, Isthmus and Random shape. Pure data and generators (no DOM), used by src/game.js.
//
// Each map is a list of axial hexes (pointy-top, rows = r) on the same 19-tile terrain set as the classic island (4 forest, 3 hills, 4 pasture,
// 4 fields, 3 mountains, 1 desert) with the same 18 number tokens and 9 harbours (4 x 3:1 and one 2:1 of every kind). What differs is the shape:
//   lake     the classic hexagon, its centre hex is a lake. The lake is a "desert" for the engine (no number, pays nobody, the robber starts there
//            and may return to it) drawn as water, so every rule, bot and review that knows the desert works unchanged. 3-4 players (2-4 here).
//   isthmus  an hourglass 4-3-2-1-2-3-4: two land halves of 9 hexes joined by ONE neck hex, which is the desert (the robber starts in the neck).
//   shape    a random connected shape of 19 hexes, new every game (a seed makes it reproducible; the saved game keeps the hex list itself).
// The shape is a layout the board geometry is built from (createBoardGeometry), exactly like the Seafarers scenario and the 5-6 player island.
import { RESOURCES } from "./core/constants.js";

export const MAP_BOARDS = ["lake", "isthmus", "shape"];
export const isMapBoard = (b) => MAP_BOARDS.includes(b);
export const MAP_MAX_BOTS = 3; // 2-4 players, like Seafarers: the 5-6 player extension has its own, bigger island
export const MAP_HEX_COUNT = 19;
export const mapName = (b) => ({ lake: "Lake", isthmus: "Isthmus", shape: "Random shape" }[b] || "");

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => `${q},${r}`;

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Lake: the 19 hexes of the classic island, in the classic order; the centre is the lake. */
export function lakeHexes() {
  const out = [];
  for (let q = -2; q <= 2; q += 1) for (let r = -2; r <= 2; r += 1) if (Math.abs(-q - r) <= 2) out.push(q === 0 && r === 0 ? { q, r, lake: true } : { q, r });
  return out;
}

/** Isthmus: rows of 4-3-2-1-2-3-4, centred on x = 0; the neck is the middle hex. */
export function isthmusHexes() {
  const out = [];
  [4, 3, 2, 1, 2, 3, 4].forEach((n, i) => {
    const r = i - 3;
    for (let k = 0; k < n; k += 1) out.push({ q: k - (n - 1) / 2 - r / 2, r, ...(n === 1 ? { neck: true } : {}) });
  });
  return out;
}

const neighbours = (q, r) => DIRS.map(([dq, dr]) => [q + dq, r + dr]);
/** Edges of the land that face open water, as the cycle(s) they form: [[hexKey, dir], ...] per cycle; the coast of a shape without holes and pinch points is one cycle. */
function coastInfo(cells) {
  const set = new Set(cells.map((c) => key(c.q, c.r)));
  let edges = 0, bad = false;
  const nodeDeg = new Map(); // a corner shared by three coast edges is a pinch point (two lands touching at a corner)
  // corners are named by the three hexes around them; for the count it is enough to key by the sorted triple
  const cornerKey = (q, r, i) => { const a = DIRS[i], b = DIRS[(i + 1) % 6]; return [[q, r], [q + a[0], r + a[1]], [q + b[0], r + b[1]]].map((p) => key(p[0], p[1])).sort().join("|"); };
  cells.forEach((c) => neighbours(c.q, c.r).forEach(([nq, nr], i) => {
    if (set.has(key(nq, nr))) return;
    edges += 1;
    [cornerKey(c.q, c.r, i), cornerKey(c.q, c.r, (i + 5) % 6)].forEach((k) => nodeDeg.set(k, (nodeDeg.get(k) || 0) + 1));
  }));
  nodeDeg.forEach((d) => { if (d > 2) bad = true; });
  return { edges, pinch: bad };
}

/** Water that cannot reach the outside = a hole in the land. */
function hasHole(cells) {
  const set = new Set(cells.map((c) => key(c.q, c.r)));
  const qs = cells.map((c) => c.q), rs = cells.map((c) => c.r);
  const q0 = Math.min(...qs) - 1, q1 = Math.max(...qs) + 1, r0 = Math.min(...rs) - 1, r1 = Math.max(...rs) + 1;
  const seen = new Set([key(q0, r0)]), stack = [[q0, r0]];
  while (stack.length) {
    const [q, r] = stack.pop();
    for (const [nq, nr] of neighbours(q, r)) {
      if (nq < q0 || nq > q1 || nr < r0 || nr > r1 || set.has(key(nq, nr)) || seen.has(key(nq, nr))) continue;
      seen.add(key(nq, nr)); stack.push([nq, nr]);
    }
  }
  return (q1 - q0 + 1) * (r1 - r0 + 1) - seen.size !== cells.length;
}

/** Size of the shape in hex widths / rows (x = q + r / 2). */
export function extent(cells) {
  const xs = cells.map((c) => c.q + c.r / 2), rs = cells.map((c) => c.r);
  return { w: Math.max(...xs) - Math.min(...xs) + 1, rows: Math.max(...rs) - Math.min(...rs) + 1 };
}

/** One random shape from `rand`: grown from a seed hex, preferring hexes that touch the land twice or more, so it is irregular but never a thread. null when it fails the checks. */
function growShape(rand, n) {
  const cells = [{ q: 0, r: 0 }], set = new Set([key(0, 0)]);
  while (cells.length < n) {
    const cand = new Map();
    cells.forEach((c) => neighbours(c.q, c.r).forEach(([q, r]) => { const k = key(q, r); if (!set.has(k)) cand.set(k, [q, r, (cand.get(k)?.[2] || 0) + 1]); }));
    const list = [...cand.values()], w = list.map((c) => (c[2] === 1 ? 1 : c[2] === 2 ? 4 : 7));
    let x = rand() * w.reduce((a, b) => a + b, 0), pick = list[list.length - 1];
    for (let i = 0; i < list.length; i += 1) { x -= w[i]; if (x <= 0) { pick = list[i]; break; } }
    cells.push({ q: pick[0], r: pick[1] }); set.add(key(pick[0], pick[1]));
  }
  return cells;
}

/**
 * A random shape of 19 hexes, from a seed (the same seed gives the same shape). It is one piece, has no hole and no corner where two lands touch, fits a phone portrait
 * (at most 7 rows and 6.5 hexes wide), has a coast of 34-42 edges (the classic island has 30, the least a 19 hex land can have) so there are bays, and at least 6 hexes that are
 * not on the coast (a tile in the middle of the land). Returns [{ q, r }] sorted by row then column; `seed` of the result is stored by the caller.
 */
export function randomShapeHexes(seed, n = MAP_HEX_COUNT) {
  const rand = mulberry32(seed >>> 0);
  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const cells = growShape(rand, n), { w, rows } = extent(cells);
    if (rows > 7 || w > 6.5 || hasHole(cells)) continue;
    const { edges, pinch } = coastInfo(cells);
    if (pinch || edges < 34 || edges > 42) continue;
    const set = new Set(cells.map((c) => key(c.q, c.r)));
    const inner = cells.filter((c) => neighbours(c.q, c.r).every(([q, r]) => set.has(key(q, r)))).length;
    if (inner < 1) continue;
    return cells.sort((a, b) => a.r - b.r || a.q - b.q);
  }
  return isthmusHexes(); // practically never: a fixed fallback keeps the game starting
}

/** The hex list (axial, with `lake` / `neck` flags) of a map board, or null for any other board. `shape`: the saved hex list of a random shape. */
export function mapLayout(board, shape = null) {
  if (board === "lake") return lakeHexes();
  if (board === "isthmus") return isthmusHexes();
  if (board === "shape") return Array.isArray(shape) && shape.length ? shape.map((c) => ({ q: c.q, r: c.r })) : null;
  return null;
}
export const newShapeSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;

// ── tiles ──
const POOL = [...Array(4).fill("wood"), ...Array(3).fill("brick"), ...Array(4).fill("sheep"), ...Array(4).fill("wheat"), ...Array(3).fill("ore")]; // + the desert / lake
const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
const pips = (n) => (n ? 6 - Math.abs(7 - n) : 0);
const shuffled = (list, rand) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function neighbourSets(geometry) {
  const nb = geometry.hexes.map(() => new Set());
  geometry.edges.forEach((e) => { if (e.hexIds.length === 2) { nb[e.hexIds[0]].add(e.hexIds[1]); nb[e.hexIds[1]].add(e.hexIds[0]); } });
  return nb;
}

/** Terrain: no tile with two neighbours of its own kind (no clusters of three); the desert hex is given. */
function placeTerrain(geometry, nb, deser, rand) {
  const slots = geometry.hexes.map((h) => h.id).filter((id) => id !== deser);
  let best = null;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const pool = shuffled(POOL, rand), res = new Map([[deser, "desert"]]);
    slots.forEach((id, i) => res.set(id, pool[i]));
    best = res;
    let bad = false;
    for (const id of slots) { let same = 0; nb[id].forEach((j) => { if (res.get(j) === res.get(id)) same += 1; }); if (same >= 2) { bad = true; break; } }
    if (!bad) break;
  }
  geometry.hexes.forEach((h) => { h.resource = best.get(h.id); h.number = null; });
}

/** Numbers by randomised backtracking: 6 and 8 never touch; strict (balanced): also no equal numbers side by side and no 2 next to a 12. */
function placeNumbers(geometry, nb, strict, rand) {
  const cells = geometry.hexes.filter((h) => h.resource !== "desert").map((h) => h.id);
  const counts = {}; NUMBERS.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
  const assign = new Map();
  const ok = (id, n) => { for (const j of nb[id]) { const m = assign.get(j); if (m == null) continue; if (pips(n) === 5 && pips(m) === 5) return false; if (strict && (m === n || (pips(n) === 1 && pips(m) === 1))) return false; } return true; };
  const order = shuffled(cells, rand); let steps = 0;
  const solve = (k) => {
    if (k === order.length) return true;
    if ((steps += 1) > 30000) return false;
    const id = order[k];
    const nums = shuffled(Object.keys(counts).map(Number).filter((n) => counts[n] > 0), rand).sort((a, b) => (pips(b) === 5) - (pips(a) === 5));
    for (const n of nums) { if (!ok(id, n)) continue; counts[n] -= 1; assign.set(id, n); if (solve(k + 1)) return true; counts[n] += 1; assign.delete(id); }
    return false;
  };
  if (!solve(0)) { // practically never: a plain shuffle, then the 6/8 rule by swaps
    assign.clear(); shuffled(NUMBERS, rand).forEach((n, i) => assign.set(cells[i], n));
    for (let pass = 0; pass < 200; pass += 1) {
      const bad = cells.find((id) => pips(assign.get(id)) === 5 && [...nb[id]].some((j) => pips(assign.get(j)) === 5));
      if (bad == null) break;
      const other = cells[Math.floor(rand() * cells.length)], a = assign.get(bad); assign.set(bad, assign.get(other)); assign.set(other, a);
    }
  }
  cells.forEach((id) => { geometry.hexes[id].number = assign.get(id); });
}

/** The hex that is the desert: the lake, the neck, or (random shape) one at random. */
export function desertHex(geometry, rand = Math.random) {
  const f = geometry.hexes.find((h) => h.lake || h.neck);
  return f ? f.id : Math.floor(rand() * geometry.hexes.length);
}

/**
 * Tiles for a map board. mapMode "random": no clusters of three of one terrain, 6/8 apart. "balanced" (and "beginner", which has no official layout on these shapes):
 * also no equal or 2/12 neighbours and every resource's average pips close to the board's. Returns the robber's start hex id (the desert / lake).
 */
export function assignMapTiles(geometry, mapMode = "random", rand = Math.random) {
  const nb = neighbourSets(geometry), deser = desertHex(geometry, rand);
  if (mapMode === "random") { placeTerrain(geometry, nb, deser, rand); placeNumbers(geometry, nb, false, rand); return deser; }
  const avg = NUMBERS.reduce((a, n) => a + pips(n), 0) / NUMBERS.length;
  let best = null, bestScore = Infinity;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    placeTerrain(geometry, nb, deser, rand); placeNumbers(geometry, nb, true, rand);
    const p = {}, c = {};
    geometry.hexes.forEach((h) => { if (h.resource === "desert") return; p[h.resource] = (p[h.resource] || 0) + pips(h.number); c[h.resource] = (c[h.resource] || 0) + 1; });
    let score = 0, maxDev = 0;
    RESOURCES.forEach((r) => { const d = Math.abs(p[r] / c[r] - avg); score += d * d; maxDev = Math.max(maxDev, d); });
    if (score < bestScore) { bestScore = score; best = geometry.hexes.map((h) => ({ resource: h.resource, number: h.number })); }
    if (maxDev <= 0.55) break;
  }
  geometry.hexes.forEach((h, i) => { h.resource = best[i].resource; h.number = best[i].number; });
  return deser;
}

// ── harbours ──
/** The coast edges in walking order around the land (one cycle when the land has no hole and no pinch point). */
export function coastWalk(geometry) {
  const coast = geometry.edges.filter((e) => e.hexIds.length === 1);
  const at = new Map(); // corner -> its coast edges
  coast.forEach((e) => e.nodes.forEach((n) => { if (!at.has(n)) at.set(n, []); at.get(n).push(e); }));
  if (!coast.length) return [];
  const start = coast.reduce((a, b) => (geometry.nodes[a.nodes[0]].y < geometry.nodes[b.nodes[0]].y || (geometry.nodes[a.nodes[0]].y === geometry.nodes[b.nodes[0]].y && geometry.nodes[a.nodes[0]].x < geometry.nodes[b.nodes[0]].x) ? a : b));
  const walk = [start], seen = new Set([start.id]);
  let node = start.nodes[1];
  for (;;) {
    const next = (at.get(node) || []).find((e) => !seen.has(e.id));
    if (!next) break;
    walk.push(next); seen.add(next.id);
    node = next.nodes[0] === node ? next.nodes[1] : next.nodes[0];
  }
  return walk;
}

/** 9 harbours spaced evenly along the coast walk: four 3:1 and one 2:1 of each kind, in random order. */
export function assignMapPorts(geometry, rand = Math.random) {
  const walk = coastWalk(geometry), n = 9, step = walk.length / n;
  const offset = Math.floor(rand() * Math.floor(step));
  const types = shuffled(["any", "any", "any", "any", "wood", "brick", "sheep", "wheat", "ore"], rand), ports = [];
  for (let i = 0; i < n; i += 1) {
    const edge = walk[Math.floor(offset + i * step) % walk.length];
    ports.push({ edgeId: edge.id, type: types[i], nodes: edge.nodes });
    edge.nodes.forEach((id) => geometry.nodes[id].ports.push(types[i]));
  }
  return ports;
}
