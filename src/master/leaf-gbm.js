// vm-120 leaf "gbm": a small gradient-boosted tree model that scores every seat; win chance = softmax over the seats.
// Features: the 'fit2' seat features (46) + game context + each seat relative to the other seats. Model: leaf-gbm-model.js.
// Trained offline (exp/vm-120/train.py); inference is one feature pass plus a few hundred tree walks per seat.
import { GBM_MODEL } from "./leaf-gbm-model.js";
let SEA_MODEL = null; // eng-130: set by setSeaModel (src/master/leaf-gbm-sea-model.js), null: the island model everywhere
export function setSeaModel(M) { SEA_MODEL = M && M.sea ? M : null; }
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const BUILD = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, dev: { sheep: 1, wheat: 1, ore: 1 } };
const HEX = [0, 0, 1, 2, 3, 4, 5, 0, 5, 4, 3, 2, 1]; // index = dice number, value /36
export const BASE_NAMES = ["vp", "vp2", "incTot", "incTot*tLeft", "wood", "brick", "sheep", "wheat", "ore", "hand", "over7", "devHand", "knightsHand", "roadYop", "monoHand",
  "devVP", "knightsPlayed", "hasArmy", "armyGap", "roadLen", "hasRoad", "roadGap", "ports2", "port2match", "port3", "spots0", "spots1", "spots2", "diversity", "zeroRes", "robberLoss", "cities", "settlements", "roads",
  "affRoad", "affSett", "affCity", "affDev", "affN", "missNext", "useful", "surplus", "convertible", "roadToFive", "affN*tLeft", "spots1*affRoad"];
const NB = BASE_NAMES.length; // 46
// context (same for every seat) and seat-relative features
export const CTX_NAMES = ["nPlayers", "round", "maxVP", "isMover", "moverDist", "knightsLeft", "roadCont"];
export const REL_BASE = ["vp", "incTot", "hand", "roadLen", "knightsPlayed", "spots0", "affN", "cities", "devHand", "useful"];
const REL_IDX = REL_BASE.map((n) => BASE_NAMES.indexOf(n));
export const REL_NAMES = [].concat(...REL_BASE.map((n) => [n + "-mean", n + "-max"]));
export const GBM_NAMES = [...BASE_NAMES, ...CTX_NAMES, ...REL_NAMES];
// eng-130 Seafarers features (appended for the Seafarers model only): gold income, ships on the board / left, small islands
// settled (+2 each), sea potential (the Expert's own measure: the best coastal spot's worth less 2 cards a ship) and the ships
// it still needs, the pirate next to an own ship; and the seat's sea potential relative to the others (mean, max).
export const SEA_NAMES = ["goldInc", "ships", "shipsLeft", "islands", "seaPot", "seaD", "pirateOn", "seaPot-mean", "seaPot-max"];
const PIPS36 = HEX;
function seaExtras(g) {
  const sea = g.sea, G = g.geometry, P = g.players, n = P.length;
  const rows = P.map((p) => {
    let gold = 0;
    const add = (nd, amt) => G.nodes[nd].adjacentHexes.forEach((hid) => { const h = G.hexes[hid]; if (h.resource === "gold" && h.number && hid !== g.robberHexId) gold += (PIPS36[h.number] / 36) * amt; });
    p.settlements.forEach((nd) => add(nd, 1)); p.cities.forEach((nd) => add(nd, 2));
    const ships = p.ships ? p.ships.size : 0, left = sea.shipsLeft(p);
    let pot = 0, d = 7;
    if (left > 0) { const r = sea._seaPotential(p, sea._seaSpotList(p)); pot = r.v; d = Number.isFinite(r.d) ? Math.min(7, r.d) : 7; }
    let pir = 0;
    if (sea.pirateHexId != null && p.ships) for (const e of p.ships) if (G.edges[e].hexIds.includes(sea.pirateHexId)) { pir = 1; break; }
    return [gold, ships, left, (sea.bonus[p.id] || []).length, pot / 10, d, pir];
  });
  return rows.map((r, i) => { let sum = 0, mx = -1e9; for (let j = 0; j < n; j++) if (j !== i) { sum += rows[j][4]; if (rows[j][4] > mx) mx = rows[j][4]; } return [...r, r[4] - sum / (n - 1), r[4] - mx]; });
}
/** gbmFeatures plus the Seafarers columns (SEA_NAMES) on a Seafarers board. */
export function gbmFeaturesSea(g) {
  const base = gbmFeatures(g);
  if (!g.sea) return base;
  const x = seaExtras(g);
  return base.map((r, i) => r.concat(x[i]));
}

/** Per-seat feature vectors (length GBM_NAMES.length). */
export function gbmFeatures(g) {
  const G = g.geometry, wp = g.winPoints, P = g.players, n = P.length;
  let lead = 0; for (let i = 0; i < n; i++) if (P[i].victoryPoints > lead) lead = P[i].victoryPoints;
  const tLeft = Math.max(2, Math.min(16, (wp - lead) * 2.2));
  const lim = (g.settings && g.settings.discardLimit) || 7;
  const base = P.map((p) => {
    const inc = [0, 0, 0, 0, 0], full = [0, 0, 0, 0, 0];
    const add = (nd, amt) => G.nodes[nd].adjacentHexes.forEach((hid) => {
      const h = G.hexes[hid]; if (!h.number || h.resource === "desert") return;
      const ri = RES.indexOf(h.resource), v = (HEX[h.number] / 36) * amt; full[ri] += v; if (hid !== g.robberHexId) inc[ri] += v;
    });
    p.settlements.forEach((nd) => add(nd, 1)); p.cities.forEach((nd) => add(nd, 2));
    let incTot = 0, fullTot = 0; for (let i = 0; i < 5; i++) { incTot += inc[i]; fullTot += full[i]; }
    const h = p.resources; let hand = 0; for (let i = 0; i < 5; i++) hand += h[RES[i]];
    const dv = (t) => p.devCards[t] + p.newDevCards[t];
    let ports2 = 0, p2m = 0, p3 = 0;
    RES.forEach((r, i) => { const rt = g.getPlayerTradeRate(p, r); if (rt === 2) { ports2++; p2m += inc[i]; } else if (rt === 3) p3 = 1; });
    const net = new Set([...p.settlements, ...p.cities]);
    p.roads.forEach((e) => G.edges[e].nodes.forEach((nd) => net.add(nd)));
    const spot = (nd) => G.nodes[nd].owner == null && G.nodes[nd].neighbors.every((m) => G.nodes[m].owner == null);
    const seen = new Map(); net.forEach((nd) => seen.set(nd, 0));
    let fr = [...net];
    for (let d = 1; d <= 2; d++) {
      const nx = [];
      fr.forEach((nd) => G.nodes[nd].edgeIds.forEach((e) => {
        const ed = G.edges[e]; if (ed.owner != null && ed.owner !== p.id) return;
        const m = ed.nodes[0] === nd ? ed.nodes[1] : ed.nodes[0];
        if (seen.has(m) || (G.nodes[m].owner != null && G.nodes[m].owner !== p.id)) return;
        seen.set(m, d); nx.push(m);
      }));
      fr = nx;
    }
    const cnt = [0, 0, 0]; seen.forEach((d, nd) => { if (spot(nd)) cnt[d] += 1; });
    const kn = p.knightsPlayed;
    let maxKn = 0, maxRd = 4; for (let i = 0; i < n; i++) if (i !== p.id) { if (P[i].knightsPlayed > maxKn) maxKn = P[i].knightsPlayed; if (P[i].longestRoadLength > maxRd) maxRd = P[i].longestRoadLength; }
    const has = (c) => { for (const r in c) if (h[r] < c[r]) return false; return true; };
    const affRoad = has(BUILD.road) ? 1 : 0, affSett = has(BUILD.settlement) && cnt[0] > 0 ? 1 : 0, affCity = has(BUILD.city) && p.settlements.size > 0 ? 1 : 0, affDev = has(BUILD.dev) && g.devDeck.length > 0 ? 1 : 0;
    const targets = [BUILD.road, BUILD.dev]; if (p.settlements.size > 0) targets.push(BUILD.city); if (cnt[0] + cnt[1] > 0) targets.push(BUILD.settlement);
    const miss = (c) => { let a = 0; for (const r in c) a += Math.max(0, c[r] - h[r]); return a; };
    let useful = 0, convertible = 0;
    RES.forEach((r) => { let need = 0; targets.forEach((c) => { if ((c[r] || 0) > need) need = c[r]; }); useful += Math.min(h[r], need); convertible += Math.floor(Math.max(0, h[r] - need) / g.getPlayerTradeRate(p, r)); });
    convertible = Math.min(4, convertible);
    const affN = affRoad + affSett + affCity + affDev;
    return [p.victoryPoints, (p.victoryPoints * p.victoryPoints) / 10, incTot, (incTot * tLeft) / 4, inc[0], inc[1], inc[2], inc[3], inc[4], Math.min(hand, 9) / 4, hand > lim ? 1 : 0,
      dv("knight") + dv("roadBuilding") + dv("yearOfPlenty") + dv("monopoly"), dv("knight"), dv("roadBuilding") + dv("yearOfPlenty"), dv("monopoly"), p.devVictoryPoints,
      kn, g.largestArmyHolder === p.id ? 1 : 0, Math.max(-3, Math.min(3, kn - maxKn)), p.longestRoadLength / 2, g.longestRoadHolder === p.id ? 1 : 0, Math.max(-4, Math.min(4, p.longestRoadLength - maxRd)),
      ports2, p2m, p3, Math.min(cnt[0], 4), Math.min(cnt[1], 4), Math.min(cnt[2], 4), inc.filter((x) => x > 0.02).length, inc.filter((x) => x <= 0.02).length,
      fullTot - incTot, p.cities.size, p.settlements.size, p.roads.size,
      affRoad, affSett, affCity, affDev, affN, Math.min(6, Math.min(...targets.map(miss))), useful / 4, Math.min(8, hand - useful) / 4, convertible, Math.max(0, 5 - p.longestRoadLength), (affN * tLeft) / 8, Math.min(cnt[1], 4) * affRoad];
  });
  const cur = g.currentPlayerIndex | 0;
  let kLeft = 0; // knights still in the deck is not tracked exactly: use dev deck size
  kLeft = g.devDeck.length;
  return base.map((b, i) => {
    const row = b.slice();
    row.push(n, Math.min(40, g.turn || 0), lead, i === cur ? 1 : 0, (i - cur + n) % n, kLeft, Math.max(0, b[19] * 2 - 4));
    for (const k of REL_IDX) {
      let sum = 0, mx = -1e9; for (let j = 0; j < n; j++) if (j !== i) { const x = base[j][k]; sum += x; if (x > mx) mx = x; }
      row.push(b[k] - sum / (n - 1), b[k] - mx);
    }
    return row;
  });
}

const TYPED = new WeakMap(); // plain JSON arrays -> typed arrays once per model object (faster walks)
const typed = (M) => { let T = TYPED.get(M); if (!T) { T = { f: Int16Array.from(M.f), t: Float64Array.from(M.t), r: Int32Array.from(M.r), root: Int32Array.from(M.root) }; TYPED.set(M, T); } return T; };

/** Score of one feature row: optional linear part + sum of tree outputs (DFS layout: the left child of node i is i + 1). */
export function gbmScore(row, M = GBM_MODEL) {
  let s = M.b || 0;
  if (M.lin) for (let i = 0; i < M.lin.length; i++) s += M.lin[i] * row[i];
  const { f, t, r, root } = typed(M);
  for (let k = 0; k < root.length; k++) {
    let nd = root[k], fi;
    while ((fi = f[nd]) >= 0) nd = row[fi] <= t[nd] ? nd + 1 : r[nd];
    s += t[nd];
  }
  return s;
}

/** Win chances: softmax of the seat scores. */
export function gbmProbs(g, M = null) {
  if (g.winner) return g.players.map((p) => (p.id === g.winner.id ? 1 : 0));
  if (!M) M = g.sea && SEA_MODEL ? SEA_MODEL : GBM_MODEL; // eng-130: the Seafarers model on a Seafarers board (when installed)
  const rows = M.sea ? gbmFeaturesSea(g) : gbmFeatures(g), sc = rows.map((r) => gbmScore(r, M));
  let mx = -1e9; for (const x of sc) if (x > mx) mx = x;
  const e = sc.map((x) => Math.exp(x - mx)); let z = 0; for (const x of e) z += x;
  return e.map((x) => x / z);
}
