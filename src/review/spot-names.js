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
const nodesOf = (x) => { const s = new Set(); const add = (v) => { if (Number.isInteger(v)) s.add(v); };
  add(x?.best?.focus?.node); add(x?.played?.focus?.node); (x?.cands || []).forEach((c) => add(c?.focus?.node));
  (x?.why?.mark?.nodes || []).forEach(add); return s; };

/** Rewrite the old number labels of one stored review's results (in place). Returns how many strings changed. */
export function upgradeSpots(game, review) {
  const idx = index(game); if (!idx || !review?.results) return 0;
  let n = 0;
  const fix = (s, near) => s.replace(RX, (m) => {
    const parts = m.split("·").map(Number), k = key(parts), all = idx.get(k) || [];
    const mine = all.filter((id) => near.has(id)), pick = mine.length === 1 ? mine[0] : !mine.length && all.length === 1 ? all[0] : null;
    if (pick == null) return m;
    let lab; try { lab = game._spotLabel(pick); } catch (_) { return m; }
    n++; return lab;
  });
  const walk = (o, near) => {
    if (Array.isArray(o)) { o.forEach((v, i) => { if (typeof v === "string") o[i] = fix(v, near); else if (v && typeof v === "object") walk(v, near); }); return; }
    for (const k of Object.keys(o)) { if (SKIP.has(k)) continue; const v = o[k]; if (typeof v === "string") { if (v.includes("·")) o[k] = fix(v, near); } else if (v && typeof v === "object") walk(v, near); }
  };
  review.results.forEach((x) => walk(x, nodesOf(x)));
  return n;
}
