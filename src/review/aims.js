// v1.61 Review "Aims at": which points the mover's futures go for. While the review plays a move's futures
// (src/master/search.js search0), each future is read once at its end: where the mover's victory points came
// from (settlements, cities, Longest road, Largest army, VP cards, new islands) and the first build within two
// of the mover's own turns. Pure bookkeeping on the futures that are played anyway: no win chance changes.
export const SRC = ["s", "c", "lr", "la", "dv", "is"];
export const SRC_NAME = { s: "Settlements", c: "Cities", lr: "Longest road", la: "Largest army", dv: "point cards", is: "New islands" };
const comps = (g, me) => {
  const p = g.players[me];
  return [p.settlements.size, p.cities.size, g.longestRoadHolder === me ? 1 : 0, g.largestArmyHolder === me ? 1 : 0, p.devVictoryPoints || 0, g.sea ? g.sea.bonusVP(p) : 0];
};
/** At the root position: the mover's pieces and awards. */
export const aimRoot = (g, me) => comps(g, me);
/** An accumulator for one move: futures read, VP gained per source (sum), first builds. */
export const aimNew = () => ({ n: 0, v: [0, 0, 0, 0, 0, 0], nx: {}, nn: 0 });
/** After the move was applied in a future: remembers the pieces so the first follow-up build can be found. */
export function aimStart(g, me) {
  const p = g.players[me];
  return { me, t: 0, done: false, key: null, s: new Set(p.settlements), c: new Set(p.cities), r: new Set(p.roads), sh: p.ships ? new Set(p.ships) : null };
}
function firstBuild(g, x) {
  const p = g.players[x.me];
  for (const n of p.settlements) if (!x.s.has(n) && !x.c.has(n)) return `s${n}`;
  for (const n of p.cities) if (!x.c.has(n)) return `c${n}`;
  for (const e of p.roads) if (!x.r.has(e)) return `r${e}`;
  if (p.ships && x.sh) for (const e of p.ships) if (!x.sh.has(e)) return `h${e}`;
  return null;
}
/** rollout's onEnd(player): the second turn the mover ends settles the follow-up. */
export const aimHook = (g, x) => (pl) => { if (!x.done && pl.id === x.me && ++x.t >= 2) { x.done = true; x.key = firstBuild(g, x); } };
/** The future is over: add its VP sources and its first build to the move's accumulator. */
export function aimAdd(g, root, acc, x) {
  const now = comps(g, x.me);
  const dS = now[0] - root[0], dC = now[1] - root[1];
  const gain = [dS + dC, dC, 2 * (now[2] - root[2]), 2 * (now[3] - root[3]), now[4] - root[4], now[5] - root[5]];
  acc.n += 1;
  gain.forEach((v, i) => { if (v > 0) acc.v[i] += v; });
  if (!x.done) x.key = firstBuild(g, x);
  if (x.key) { acc.nn += 1; acc.nx[x.key] = (acc.nx[x.key] || 0) + 1; } // nn: the futures that build something within two turns
}
const pc = (x) => Math.round(x * 100);
/** The compact record kept in the review: top sources (share of gained points) and the usual first build. g stands on the root position. */
export function aimPack(g, p, acc, label) {
  if (!acc || acc.n < 2) return null;
  const tot = acc.v.reduce((a, b) => a + b, 0);
  const src = tot > 0 ? acc.v.map((v, i) => [SRC[i], v / tot]).filter(([, s]) => s >= 0.08).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, s]) => [k, pc(s)]) : [];
  // the follow-up: the same kind and spot (roads: the same far end) counted together
  const grp = {};
  const mine = (n) => g.geometry.nodes[n].owner === p.id || g.geometry.nodes[n].edgeIds.some((e) => g.geometry.edges[e].owner === p.id);
  for (const [key, c] of Object.entries(acc.nx)) {
    const t = key[0], id = +key.slice(1);
    let k2 = key;
    if (t === "r" || t === "h") { const ed = g.geometry.edges[id]; const far = ed.nodes.find((n) => !mine(n)); k2 = far != null ? `${t}n${far}` : key; }
    grp[k2] = (grp[k2] || 0) + c;
  }
  const top = Object.entries(grp).sort((a, b) => b[1] - a[1])[0];
  let nx = null;
  if (top) {
    const t = top[0][0], id = +top[0].slice(top[0][1] === "n" ? 2 : 1);
    const place = t === "s" ? `settlement on ${g._spotLabel(id)}` : t === "c" ? `city on ${g._spotLabel(id)}` : t === "r" ? (top[0][1] === "n" ? `road toward ${g._spotLabel(id)}` : "road") : t === "h" ? (top[0][1] === "n" ? `ship toward ${g._spotLabel(id)}` : "ship") : null;
    if (place && top[1] >= 2) nx = [place, top[1], acc.nn];
  }
  return { l: label, n: acc.n, src, nx };
}
