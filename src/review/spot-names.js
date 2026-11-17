// v1.91 Saved reviews from before v1.8x name a spot by the dice numbers around it ("Settlement on 6·11·10", "reaches 11·10"). Today the
// engine says "Grain 3, Wool 12, Lumber 4" (game._spotLabel). On opening a saved review the old labels are turned into the new ones, in
// memory only: the numbers pick the spot among the spots the decision itself names (its moves' nodes, its marks), else the one spot of
// the board that has exactly those numbers. When that is ambiguous the text stays as it was.
const RX = /(?<![\d·])\d{1,2}(?:·\d{1,2}){1,2}(?![\d·])/g;
const SKIP = new Set(["mark", "st", "focus", "trk", "a"]);
const key = (nums) => nums.slice().sort((a, b) => a - b).join("·");

/** { key -> [nodeId] } of the board: the sorted dice numbers of the land tiles around each node. */
function index(game) {
  const G = game?.geometry; if (!G?.nodes) return null;
  const m = new Map();
  G.nodes.forEach((n) => {
    const nums = (n.adjacentHexes || []).map((h) => G.hexes[h]).filter((h) => h?.number).map((h) => h.number); if (!nums.length) return;
    const k = key(nums); if (!m.has(k)) m.set(k, []); m.get(k).push(n.id);
  });
  return m;
}
/** the spots a decision names: [spots it points at, the ends of the roads it points at] */
const nodesOf = (x, game) => { const sp = new Set(), ed = new Set(); const add = (v) => { if (Number.isInteger(v)) sp.add(v); }, edge = (e) => { (game?.geometry?.edges?.[e]?.nodes || []).forEach((n) => { if (Number.isInteger(n)) ed.add(n); }); };
  const foc = (f) => { add(f?.node); if (Number.isInteger(f?.edge)) edge(f.edge); };
  foc(x?.best?.focus); foc(x?.played?.focus); foc(x?.focus); (x?.cands || []).forEach((c) => foc(c?.focus));
  (x?.why?.mark?.nodes || []).forEach(add); (x?.why?.mark?.rivals || []).forEach(add); (x?.why?.mark?.edges || []).forEach(edge); return [sp, ed]; };

/** hops from the nearest of the `from` nodes, over the board's node graph (up to 6) */
function dist(game, from) {
  const G = game.geometry, d = new Map(); let q = [...from]; q.forEach((n) => d.set(n, 0));
  for (let k = 1; k <= 6 && q.length; k++) { const nx = []; q.forEach((u) => (G.nodes[u]?.neighbors || []).forEach((m) => { if (!d.has(m)) { d.set(m, k); nx.push(m); } })); q = nx; }
  return d;
}
/** Rewrite the old number labels of one stored review's results (in place). Returns how many strings changed. */
export function upgradeSpots(game, review) {
  const idx = index(game); if (!idx || !review?.results) return 0;
  let n = 0;
  const fix = (s, near) => s.replace(RX, (m) => {
    const parts = m.split("·").map(Number), k = key(parts), all = idx.get(k) || [];
    let pick = null;
    for (const tier of near) { const mine = all.filter((id) => tier.has(id)); if (mine.length === 1) { pick = mine[0]; break; } }
    if (pick == null && all.length === 1) pick = all[0];
    if (pick == null && all.length > 1) { // several spots with these numbers: the one nearest to what the decision names
      const from = new Set([...near[0], ...near[1]]); if (from.size) { const d = dist(game, from); let bd = 1e9, bi = null, tie = false; all.forEach((id) => { const v = d.get(id) ?? 99; if (v < bd) { bd = v; bi = id; tie = false; } else if (v === bd) tie = true; }); if (!tie) pick = bi; }
    }
    if (pick == null) return m;
    let lab; try { lab = game._spotLabel(pick); } catch (_) { return m; }
    n++; return lab;
  });
  const walk = (o, near) => {
    if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === "string") o[i] = fix(v, near); else if (v && typeof v === "object") walk(v, near); }); return; }
    for (const k of Object.keys(o)) { if (SKIP.has(k)) continue; const v = o[k]; if (typeof v === "string") { if (v.includes("·")) o[k] = fix(v, near); } else if (v && typeof v === "object") walk(v, near); }
  };
  review.results.forEach((x) => walk(x, nodesOf(x, game)));
  return n;
}
