// v1.89 MECHANISM FEATURES of a game, per player and turn, derived only from the board and the event log (pure, no UI, nothing wired into the card or the chat).
// They are the inputs of a later attribution layer ("why did the win chance move") and carry no wording and no blame:
//   (a) reachSpots   legal settlement spots reachable within 1 and 2 roads of a player's network at the end of a turn (distance rule, walls, free edges)
//   (b) incomeAt     expected cards a turn per resource from dice odds, net of the robber where it stands at that moment
//   (c) needsVsIncome what the next build needs, the income per turn of each needed resource, and the turns actually waited per resource
//   (d) robberLosses cards the robber / 7s cost a player in one turn: blocked rolls and cards, steals from them, discards
// mechRaw(g) copies what is needed out of the app (once); every function below takes that copy, so tests re-derive the numbers from the eval fixtures.
import { RESOURCES, COSTS, PIPS as PIP } from "../core/constants.js";
export const R5 = RESOURCES;
export const COST = { settlement: COSTS.settlement, city: COSTS.city, road: COSTS.road };
const KIND = { s: "settlement", c: "city", r: "road" };
const KEEP = "bRPXtdu";

/** The serialisable copy: board (hexes, nodes with hexes / neighbours / ports, edges) and the events [turn, code, ...] in order (b build, u undo, R robber, P paid, X blocked, t steal, d discard). */
export function mechRaw(g) {
  const geo = g.geometry, st = g._st, ev = [];
  (st.stepEvents || []).forEach((es, k) => (es || []).forEach((e) => { if (KEEP.includes(e[1])) ev.push([st.turnOf[k] ?? 0, ...e.slice(1)]); }));
  return {
    n: g.players.length, r0: st.r0 ?? null,
    hexes: geo.hexes.map((h) => ({ id: h.id, res: h.resource, num: h.number || null })),
    nodes: geo.nodes.map((n) => ({ nb: n.neighbors, hx: n.adjacentHexes, ports: n.ports || [] })),
    edges: geo.edges.map((e) => ({ a: e.nodes[0], b: e.nodes[1] })),
    ev,
  };
}

/** The position at the end of turn t: { own: Map node -> [seat, 1 settlement | 2 city], road: Map edge -> seat, robber: hex | null }. */
export function stateAt(raw, t) {
  const own = new Map(), road = new Map(); let robber = raw.r0;
  for (const e of raw.ev) {
    if (e[0] > t) break;
    const [, c, a, k, id] = e;
    if (c === "b") { if (k === "s") own.set(id, [a, 1]); else if (k === "c") own.set(id, [a, 2]); else road.set(id, a); }
    else if (c === "u") { if (k === "s") own.delete(id); else if (k === "c") { if (own.has(id)) own.set(id, [a, 1]); } else road.delete(id); }
    else if (c === "R") robber = k;
  }
  return { own, road, robber };
}
const pipsOf = (raw, n) => raw.nodes[n].hx.reduce((a, h) => a + (raw.hexes[h].num && R5.includes(raw.hexes[h].res) ? PIP[raw.hexes[h].num] : 0), 0);
export const isLegal = (raw, st, n) => !st.own.has(n) && raw.nodes[n].nb.every((m) => !st.own.has(m));
const netOf = (raw, st, q) => { const s = new Set(); st.own.forEach((v, n) => { if (v[0] === q) s.add(n); }); st.road.forEach((o, e) => { if (o === q) { s.add(raw.edges[e].a); s.add(raw.edges[e].b); } }); return s; };

/** Roads from the network of seat q to each node (<= max): over free edges, never through a node somebody else built on. Map node -> roads. */
export function reachOf(raw, st, q, max = 2) {
  const d = new Map(), queue = []; netOf(raw, st, q).forEach((n) => { d.set(n, 0); queue.push(n); });
  const adj = new Map(); raw.edges.forEach((e, i) => { if (st.road.has(i)) return; (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b); (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a); });
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i], o = st.own.get(u); if (d.get(u) >= max || (o && o[0] !== q)) continue;
    (adj.get(u) || []).forEach((m) => { if (!d.has(m)) { d.set(m, d.get(u) + 1); queue.push(m); } });
  }
  return d;
}
/** (a) The settlement spots seat q could take at the end of turn t within 1 and 2 roads: legal by the distance rule, on at least one numbered hex.
 *  { within0, within1, within2 (cumulative counts), spots: [{ n, d, pips }] best first }. */
export function reachSpots(raw, t, q, st = stateAt(raw, t)) {
  const spots = []; reachOf(raw, st, q, 2).forEach((d, n) => { if (isLegal(raw, st, n)) { const p = pipsOf(raw, n); if (p > 0) spots.push({ n, d, pips: p }); } });
  spots.sort((a, b) => a.d - b.d || b.pips - a.pips || a.n - b.n);
  const c = (m) => spots.filter((s) => s.d <= m).length;
  return { within0: c(0), within1: c(1), within2: c(2), spots };
}

/** (b) Expected cards a turn per resource for seat q at the end of turn t: dice odds (dots / 36) x 1 per settlement, x 2 per city; a hex under the robber pays nothing.
 *  { per, dots, gross (without the robber), blockedHex }. */
export function incomeAt(raw, t, q, st = stateAt(raw, t)) {
  const dots = Object.fromEntries(R5.map((r) => [r, 0])), gross = Object.fromEntries(R5.map((r) => [r, 0]));
  st.own.forEach(([o, m], n) => { if (o !== q) return; raw.nodes[n].hx.forEach((h) => { const x = raw.hexes[h]; if (!x.num || !R5.includes(x.res)) return; gross[x.res] += PIP[x.num] * m; if (h !== st.robber) dots[x.res] += PIP[x.num] * m; }); });
  const r2 = (v) => Math.round((v / 36) * 1000) / 1000;
  return { per: Object.fromEntries(R5.map((r) => [r, r2(dots[r])])), dots, gross, blockedHex: st.robber };
}

/** Cards received by seat q in turn u per resource (from the paid events). */
export const receivedIn = (raw, u, q) => { const c = Object.fromEntries(R5.map((r) => [r, 0])); raw.ev.forEach((e) => { if (e[0] === u && e[1] === "P" && e[2] === q && R5[e[4]]) c[R5[e[4]]] += e[5] || 1; }); return c; };

/** (c) The next build of seat q after turn t (a settlement, city or road) against the income: what it needs, the expected cards a turn of each needed resource,
 *  the cards really received while waiting and the turns waited without one. null when q builds nothing more.
 *  { kind, turn (when built), turnsToBuild, need: [{ res, n, perTurn, expectedTurns, received, turnsWithout }] }. */
export function needsVsIncome(raw, t, q, T = Math.max(...raw.ev.map((e) => e[0]))) {
  const nb = raw.ev.find((e) => e[0] > t && e[1] === "b" && e[2] === q && KIND[e[3]]);
  const kind = nb ? KIND[nb[3]] : "settlement", until = nb ? nb[0] : T, inc = incomeAt(raw, t, q);
  const need = Object.entries(COST[kind]).map(([res, n]) => {
    let received = 0, without = 0; for (let u = t + 1; u <= until; u++) { const g = receivedIn(raw, u, q)[res]; received += g; if (!g) without++; }
    const per = inc.per[res];
    return { res, n, perTurn: per, expectedTurns: per > 0 ? Math.round((n / per) * 10) / 10 : null, received, turnsWithout: without };
  });
  return { kind, built: !!nb, turn: until, turnsToBuild: until - t, need };
}

/** (d) What the robber and the 7s cost seat q in turn t: rolls blocked on their hexes and the cards that were (their buildings on the blocked hex), steals from them, cards they discarded. */
export function robberLosses(raw, t, q) {
  const own = new Map(); let blocked = 0, cards = 0, stolen = 0, discarded = 0, robber = raw.r0;
  for (const e of raw.ev) {
    if (e[0] > t) break; const [, c, a, k, id] = e;
    if (e[0] === t) {
      if (c === "X") { const sh = [...own.entries()].reduce((s, [n, [o, m]]) => s + (o === q && raw.nodes[n].hx.includes(a) ? m : 0), 0); if (sh) { blocked++; cards += sh; } }
      else if (c === "t" && k === q) stolen++;
      else if (c === "d" && a === q) discarded += k;
    }
    if (c === "b") { if (k === "s") own.set(id, [a, 1]); else if (k === "c") own.set(id, [a, 2]); }
    else if (c === "u") { if (k === "s") own.delete(id); else if (k === "c" && own.has(id)) own.set(id, [a, 1]); }
    else if (c === "R") robber = k;
  }
  return { blocked, cards, stolen, discarded, total: cards + stolen + discarded, robber };
}
