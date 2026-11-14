// v1.11 Review "Plan": the likely reason a better move (A) was stronger than the one played (B).
// The Monte Carlo only says THAT A won more futures; this says what A does on the board, from the position
// itself: spots and their pips, the road reach (g._aiRoadReach), Longest Road / Largest Army counts, ports,
// what the robber would hit, what a trade or a saved hand makes affordable. Everything below is read from the
// engine standing on the recorded position (src/review/engine.js) or from the move's own label; nothing is
// guessed. When no feature clearly separates A from B the answer is null and the screen shows nothing.
//   explain(g, p, rec, A, B) → { v, k, plan, vs, chips[≤3], head, mark } | null
//     A, B: { label, focus } as the evaluator names them (src/master/search.js labels, src/review/evaluate.js playedMove)
//     plan: one short line about A · vs: one short line about B · head: the one-line reason (the "Could be better" card)
//     mark: { nodes, edges, rivals } what to light up on the board besides A and B themselves
// Pure reads: the few temporary edits (a road laid to look at the reach) are undone in a finally.
const RN = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const BY_NAME = Object.fromEntries(Object.entries(RN).map(([k, v]) => [v, k]));
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, dev: { sheep: 1, wheat: 1, ore: 1 } };
const BUILD_NAME = { road: "Road", settlement: "Settlement", city: "City", dev: "Development card" };
const pipsOf = (n) => (n ? 6 - Math.abs(7 - n) : 0);
const sum = (o) => R5.reduce((a, r) => a + (o?.[r] || 0), 0);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const pp = (n) => `${n} pip${n === 1 ? "" : "s"}`;
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (a) => a.map((r) => RN[r]).join(", ");

// ── position features ──
/** What a node yields: pips per resource, total, kinds, harbours. */
export function nodeFacts(g, n) {
  const G = g.geometry, node = G.nodes[n], byRes = {};
  let pips = 0;
  node.adjacentHexes.forEach((h) => {
    const hex = G.hexes[h];
    if (!hex.number || hex.resource === "desert" || hex.resource === "sea") return;
    byRes[hex.resource] = (byRes[hex.resource] || 0) + pipsOf(hex.number);
    pips += pipsOf(hex.number);
  });
  return { id: n, label: g._spotLabel(n), pips, byRes, kinds: Object.keys(byRes), ports: node.ports || [] };
}
/** The player's production in pips per resource (cities count double). */
export function ownPips(g, p) {
  const byRes = {};
  const add = (n, m) => { const f = nodeFacts(g, n); Object.entries(f.byRes).forEach(([r, v]) => { byRes[r] = (byRes[r] || 0) + v * m; }); };
  p.settlements.forEach((n) => add(n, 1));
  p.cities.forEach((n) => add(n, 2));
  return { byRes, total: sum(byRes) };
}
const legalSpot = (g, n) => { const node = g.geometry.nodes[n]; return node.structure == null && node.neighbors.every((m) => g.geometry.nodes[m].structure == null); };
const portText = (ports) => {
  const two = ports.find((t) => t !== "any");
  return two ? `2:1 ${RN[two]} port` : ports.includes("any") ? "3:1 port" : null;
};
const newRes = (f, own) => f.kinds.filter((r) => !(own.byRes[r] > 0));
const rate = (g, p, r) => g.getPlayerTradeRate(p, r);
const missing = (hand, cost) => R5.reduce((a, r) => a + Math.max(0, (cost[r] || 0) - (hand[r] || 0)), 0);
const afford = (hand, cost) => missing(hand, cost) === 0;
const minus = (hand, cost) => Object.fromEntries(R5.map((r) => [r, Math.max(0, (hand[r] || 0) - (cost[r] || 0))]));
const nm = (g, pid) => g.players[pid].name;

/** Run fn with edge e laid for p (and undo it). */
function withRoad(g, p, e, fn) {
  const edge = g.geometry.edges[e], had = edge.owner, hadR = p.roads.has(e);
  edge.owner = p.id; p.roads.add(e);
  try { return fn(); } finally { edge.owner = had; if (!hadR) p.roads.delete(e); }
}

// ── the label → move ──
/** A move from the evaluator's label and focus ("Road toward 6·9·11", "Trade Wool → 1 Ore, then City on 4·5·6", …). */
export function parseMove(label, focus, kind) {
  let l = String(label || ""), trade = null;
  const t = l.match(/^Trade (.+?) → (.+?), then (.+)$/);
  if (t) { trade = { give: t[1].split(" + ").map((x) => BY_NAME[x]).filter(Boolean), get: parseGet(t[2]) }; l = t[3]; }
  let m = null;
  if (kind === "setup" || /^Spot /.test(l)) m = { type: "setup", node: focus?.node };
  else if (/^Road/.test(l) || /^Longest Road/.test(l)) m = { type: "road", edge: focus?.edge, target: focus?.node, lr: /Longest Road/.test(l) };
  else if (/^Settlement .* \+\d+ roads?$/.test(l)) m = { type: "road", edge: focus?.edge, target: focus?.node }; // a settlement goal still roads away: the move is the road
  else if (/^Settlement/.test(l)) m = { type: "settlement", node: focus?.node };
  else if (/^City/.test(l)) m = { type: "city", node: focus?.city ?? focus?.node };
  else if (/^Robber/.test(l)) m = { type: "robber", hex: focus?.hex };
  else if (/^End turn/.test(l)) m = { type: "end", saves: /saves/.test(l) };
  else if (/^Bank trade/.test(l)) { const b = l.match(/^Bank trade (.+?) → (.+)$/); m = { type: "bank", give: b ? b[1].split(" + ").map((x) => BY_NAME[x]).filter(Boolean) : [], get: b ? parseGet(b[2]) : {} }; }
  else if (/^Dev/.test(l)) m = { type: "buy" };
  else if (/^Play /.test(l)) m = { type: "play", dev: ({ Knight: "knight", "Road Building": "roadBuilding", "Year of Plenty": "yearOfPlenty", Monopoly: "monopoly" })[l.slice(5)] || null };
  if (m && trade) m.trade = trade;
  return m;
}
function parseGet(s) {
  const o = {};
  s.split(" + ").forEach((x) => { const q = x.match(/^(?:(\d+) )?(.+)$/); const r = BY_NAME[q?.[2]]; if (r) o[r] = (o[r] || 0) + (q[1] ? +q[1] : 1); });
  return o;
}
/** The played move (B) from the record itself. */
export function recMove(rec, focus, label) {
  const a = rec.a || {};
  switch (rec.k) {
    case "setup": return { type: "setup", node: a.n };
    case "build": return a.type === "road" ? { type: "road", edge: a.id } : { type: a.type, node: a.id };
    case "bank": { const give = {}, get = {}; (a.tr || []).forEach(([x, y]) => { give[x] = (give[x] || 0) + 1; get[y] = (get[y] || 0) + 1; }); return { type: "bank", give: Object.keys(give), get, giveN: give }; }
    case "buy": return { type: "buy" };
    case "play": return { type: "play", dev: a.t };
    case "end": return { type: "end" };
    case "robber": return { type: "robber", hex: a.hex };
    default: return parseMove(label, focus, rec.k);
  }
}

// ── road ──
/** Everything about one road: where it leads, whom it blocks, the Longest Road count. */
export function roadCard(g, p, edge, hint = null, pre = null) {
  const G = g.geometry, own = pre?.own || ownPips(g, p);
  const R0 = pre?.R0 || g._aiRoadReach(p);
  const rivals = pre?.rivals || g.players.filter((q) => q.id !== p.id).map((q) => ({ q, r0: g._aiRoadReach(q) }));
  const len0 = g.computeLongestRoadLength(p);
  const spots = G.nodes.filter((n) => legalSpot(g, n.id)).map((n) => n.id);
  return withRoad(g, p, edge, () => {
    const R1 = g._aiRoadReach(p), len1 = g.computeLongestRoadLength(p);
    const hasSett = g.piecesLeft(p, "settlement") > 0;
    const open = hasSett ? spots.filter((s) => R1.dist[s] <= 3 && R1.dist[s] < R0.dist[s]) : [];
    const score = (s) => { const f = nodeFacts(g, s); return f.pips + 2.5 * newRes(f, own).length + (f.ports.length ? 1.5 : 0) + (R1.dist[s] === 0 ? 0.5 : 0); };
    let tn = hint != null && open.includes(hint) ? hint : open.slice().sort((a, b) => score(b) - score(a) || R1.dist[a] - R1.dist[b])[0];
    const f = tn != null ? nodeFacts(g, tn) : null;
    const target = f && { ...f, d0: R0.dist[tn], d1: R1.dist[tn], newRes: newRes(f, own), port: portText(f.ports),
      race: rivals.map(({ q, r0 }) => ({ pid: q.id, d: r0.dist[tn] })).filter((x) => x.d <= R0.dist[tn]).sort((a, b) => a.d - b.d)[0] || null };
    // spots a rival could reach within 2 roads that this road takes out of reach
    const blocks = [];
    rivals.forEach(({ q, r0 }) => {
      const r1 = g._aiRoadReach(q);
      spots.forEach((s) => { if (r0.dist[s] <= 2 && r1.dist[s] > r0.dist[s]) blocks.push({ pid: q.id, id: s, label: g._spotLabel(s), d: r0.dist[s], pips: nodeFacts(g, s).pips }); });
    });
    blocks.sort((a, b) => b.pips - a.pips || a.d - b.d);
    const holder = g.longestRoadHolder, holderLen = holder != null && holder !== p.id ? g.players[holder].longestRoadLength : Math.max(0, ...g.players.filter((q) => q.id !== p.id).map((q) => q.longestRoadLength));
    const lr = { len0, len1, holder, holderLen, mine: holder === p.id };
    const path = tn != null ? withoutRoad(g, p, edge, () => g._aiReachPath(p, tn)) : null;
    return { edge, open: open.length, target, blocks, lr, path, best: open.length ? score(tn) : 0 };
  });
}
function withoutRoad(g, p, e, fn) { // the route is read on the position before the road
  const edge = g.geometry.edges[e], own = edge.owner, had = p.roads.has(e);
  edge.owner = null; p.roads.delete(e);
  try { return fn(); } finally { edge.owner = own; if (had) p.roads.add(e); }
}
const lrRelevant = (c) => {
  const { len0, len1, holder, holderLen, mine } = c.lr;
  if (len1 <= len0 || len1 < 3) return false;
  if (mine) return len1 > holderLen;
  if (holder == null) return len1 >= 4;
  return len1 > holderLen || (holderLen - len1 === 1 && len1 >= 4);
};
const lrText = (g, c) => {
  const { len1, holderLen, mine, holder } = c.lr;
  if (mine) return `Longest Road ${len1} (lead ${len1 - holderLen})`;
  if (holder == null) return len1 >= 5 ? `takes Longest Road (${len1})` : `Longest Road ${len1} of 5 needed`;
  if (len1 > holderLen) return `takes Longest Road (${len1} vs ${holderLen})`;
  return `Longest Road ${len1} vs ${holderLen} (${nm(g, holder)})`;
};
function roadPlan(g, p, mv, c) {
  const items = [], chips = [], t = c.target;
  if (t) {
    items.push(`reaches ${t.label} (${t.d0 <= 1 ? "this road" : plural(t.d0, "road")}, ${t.pips} dice dots)`);
    if (t.newRes.length) { items.push(`adds ${list(t.newRes)}`); chips.push(`+${list(t.newRes)}`); }
    if (t.port) { items.push(t.port); chips.push(t.port); }
    if (t.d1 === 0) items.push("then settle there");
    else if (t.d1 === 1) items.push("1 more road, then settle");
  }
  if (c.blocks.length) { const b = c.blocks[0]; items.push(`blocks ${nm(g, b.pid)} from ${b.label}`); chips.push(`blocks ${nm(g, b.pid)}`); }
  if (lrRelevant(c)) { items.push(lrText(g, c)); chips.push(lrText(g, c)); }
  if (t && !chips.length) chips.push(`${t.pips} dice dots`);
  return { items, chips };
}
const roadVs = (g, c) => {
  const t = c.target;
  if (!t) return "dead end: no free spot within 3 roads";
  const bits = [`reaches ${t.label} (${t.pips} dice dots`, t.newRes.length ? `adds ${list(t.newRes)})` : "nothing new)"];
  return bits.join(", ");
};

// ── what a move is worth in production ──
function buildCard(g, p, mv) {
  const own = ownPips(g, p), f = nodeFacts(g, mv.node);
  if (mv.type === "city") return { ...f, own, gain: f.pips, after: own.total + f.pips, newRes: [], doubled: Object.entries(f.byRes).sort((a, b) => b[1] - a[1]).map(([r]) => r) };
  return { ...f, own, gain: f.pips, after: own.total + f.pips, newRes: newRes(f, own), port: portText(f.ports) };
}
const sets = (own, f) => {
  const has = (o, r) => (o.byRes[r] || 0) > 0 || (f.byRes[r] || 0) > 0, had = (r) => (own.byRes[r] || 0) > 0;
  const out = [];
  if (has(own, "ore") && has(own, "wheat") && !(had("ore") && had("wheat"))) out.push("Ore + Grain for cities");
  if (has(own, "ore") && has(own, "wheat") && has(own, "sheep") && !(had("ore") && had("wheat") && had("sheep"))) out.push("cards: Ore + Grain + Wool");
  if (has(own, "wood") && has(own, "brick") && !(had("wood") && had("brick"))) out.push("Lumber + Brick for roads");
  return out;
};
/** Rival spots (within 2 roads of them) that a settlement on n takes away. */
function settleBlocks(g, p, n) {
  const G = g.geometry, gone = [n, ...G.nodes[n].neighbors], out = [];
  g.players.filter((q) => q.id !== p.id).forEach((q) => {
    const r = g._aiRoadReach(q);
    gone.forEach((s) => { if (legalSpot(g, s) && r.dist[s] <= 2) out.push({ pid: q.id, id: s, label: g._spotLabel(s), d: r.dist[s] }); });
  });
  return out.sort((a, b) => a.d - b.d);
}
function settlePlan(g, p, mv) {
  const c = buildCard(g, p, mv), items = [], chips = [];
  items.push(`+${c.pips} dice dots (${list(c.kinds)})`);
  if (c.newRes.length) { items.push(`new: ${list(c.newRes)}`); chips.push(`+${list(c.newRes)}`); }
  if (c.port) { items.push(c.port); chips.push(c.port); }
  const bl = settleBlocks(g, p, mv.node).find((b) => b.pid !== p.id);
  if (bl) { items.push(`takes ${nm(g, bl.pid)}'s spot ${bl.label}`); chips.push(`blocks ${nm(g, bl.pid)}`); }
  const s = sets(c.own, c);
  if (s.length) { items.push(s[0]); if (chips.length < 3) chips.push(s[0]); }
  return { c, items, chips, bl };
}
function cityPlan(g, p, mv) {
  const c = buildCard(g, p, mv), items = [], chips = [];
  items.push(`doubles ${c.pips} dice dots (${list(c.doubled)})`);
  items.push(`income ${c.own.total} → ${c.own.total + c.pips} dice dots`);
  chips.push(`+${c.pips} dice dots`);
  return { c, items, chips };
}

// ── robber ──
export function hexCard(g, p, hexId) {
  const G = g.geometry, hex = G.hexes[hexId], pips = pipsOf(hex.number), top = Math.max(0, ...g.players.filter((q) => q.id !== p.id).map((q) => q.publicVictoryPoints));
  const hit = {}, own = { pips: 0 };
  hex.nodes.forEach((n) => {
    const node = G.nodes[n];
    if (node.owner == null || node.structure == null) return;
    const v = pips * (node.structure === "city" ? 2 : 1);
    if (node.owner === p.id) own.pips += v; else hit[node.owner] = (hit[node.owner] || 0) + v;
  });
  const victims = Object.entries(hit).map(([pid, v]) => ({ pid: +pid, pips: v, vp: g.players[+pid].publicVictoryPoints, leader: g.players[+pid].publicVictoryPoints >= top && top > 0 })).sort((a, b) => b.pips - a.pips);
  return { id: hexId, name: g._hexName(hexId), pips: Object.values(hit).reduce((a, b) => a + b, 0), victims, own: own.pips, leaderHit: victims.some((v) => v.leader), here: g.robberHexId === hexId };
}
const hexText = (g, c) => {
  if (!c.victims.length) return c.own ? `${c.name}: hits only you (−${c.own} dice dots)` : `${c.name}: nobody on it`;
  const v = c.victims.slice(0, 2).map((x) => `${nm(g, x.pid)} (${x.vp} VP${x.leader ? ", leader" : ""}) −${x.pips}`).join(", ");
  return `${c.name}: ${v} pips${c.own ? `, you −${c.own}` : ""}`;
};

// ── setup ──
export function setupCard(g, p, n) {
  const G = g.geometry, f = nodeFacts(g, n), own = ownPips(g, p);
  // expansion room: spots still free to settle within 4 steps of this one (once it is placed)
  const gone = new Set([n, ...G.nodes[n].neighbors]);
  const seen = new Map([[n, 0]]), q = [n];
  while (q.length) {
    const u = q.shift(); if (seen.get(u) >= 4) continue;
    G.nodes[u].neighbors.forEach((m) => { if (seen.has(m)) return; const nd = G.nodes[m]; if (nd.structure != null && nd.owner !== p.id) return; seen.set(m, seen.get(u) + 1); q.push(m); });
  }
  const room = [...seen.keys()].filter((m) => !gone.has(m) && legalSpot(g, m) && G.nodes[m].adjacentHexes.some((h) => G.hexes[h].number)).length;
  const kindsAll = new Set([...Object.keys(own.byRes), ...f.kinds]);
  return { ...f, newRes: newRes(f, own), port: portText(f.ports), room, kindsAll: kindsAll.size, first: own.total === 0 };
}

// ── the explanation ──
const trim = (s) => s.replace(/\s+/g, " ").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** A hand's worth: what the hand at the decision could afford. */
const handOf = (p) => ({ ...p.resources });
const buildOf = (mv) => (mv?.type === "settlement" || mv?.type === "city" || mv?.type === "road" ? mv.type : mv?.type === "buy" ? "dev" : null);

export function explain(g, p, rec, A, B) {
  const orig = Math.random;
  Math.random = () => 0.5;
  try { return explain1(g, p, rec, A, B); } catch (_) { return null; } finally { Math.random = orig; }
}
function done(k, items, vs, chips, mark = {}, extra = {}) {
  if (!items.length) return null;
  const plan = trim(cap(items.slice(0, 4).join(" · ")));
  return { v: 1, k, plan, vs: vs ? trim(vs) : null, chips: chips.slice(0, 3), head: trim(cap(items.slice(0, 2).join(" · "))), mark: { nodes: mark.nodes || [], edges: mark.edges || [], rivals: mark.rivals || [] }, ...extra };
}

function explain1(g, p, rec, A, B) {
  if (!A?.label) return null;
  const a = parseMove(A.label, A.focus, rec.k === "setup" ? "setup" : null), b = recMove(rec, B?.focus, B?.label);
  if (!a || !b) return null;
  const hand = handOf(p);
  const trade = a.trade;
  // the trade in front of a build: what it completes this turn
  const tradeItem = (what) => {
    if (!trade) return null;
    const need = R5.filter((r) => (what[r] || 0) > hand[r]);
    return need.length && afford(hand, what) === false ? `trade for ${list(need)}` : null;
  };

  // ── set-up ──
  if (a.type === "setup" && b.type === "setup" && a.node != null && b.node != null) {
    const ca = setupCard(g, p, a.node), cb = setupCard(g, p, b.node);
    const items = [`${ca.label}: ${ca.pips} pips${ca.pips < cb.pips ? ` (${cb.pips - ca.pips} fewer)` : ""}, ${plural(ca.kinds.length, "resource")}`], chips = []; // v1.19 says so when the better spot has fewer pips (29 of 80 audited set-up picks did)
    const adv = [];
    if (ca.pips >= cb.pips + 2) adv.push(`${ca.pips} pips`);
    if (ca.kinds.length > cb.kinds.length || (!ca.first && ca.newRes.length > cb.newRes.length)) { adv.push("variety"); }
    if (ca.newRes.some((r) => !cb.newRes.includes(r)) && !ca.first) { items.push(`adds ${list(ca.newRes)} you lack`); chips.push(`+${list(ca.newRes)}`); adv.push("new"); }
    if (ca.port && !cb.port) { items.push(ca.port); chips.push(ca.port); adv.push("port"); }
    if (ca.room >= cb.room + 5 && adv.length) { items.push(`room for ${ca.room} more spots`); chips.push(`${ca.room} spots to grow`); } // room alone is too vague to be a reason
    if (ca.kinds.length > cb.kinds.length) chips.unshift(`${ca.kinds.length} resources vs ${cb.kinds.length}`);
    if (ca.pips >= cb.pips + 2) chips.unshift(`${ca.pips} pips vs ${cb.pips}`);
    if (!adv.length) return null;
    const vs = `${cb.label}: ${pp(cb.pips)}, ${plural(cb.kinds.length, "resource")}${cb.port ? `, ${cb.port}` : ""}, room ${cb.room}`;
    return done("setup", items, vs, chips, { nodes: [] });
  }

  // ── robber ──
  if (a.type === "robber" && b.type === "robber" && a.hex != null && b.hex != null) {
    const ca = hexCard(g, p, a.hex), cb = hexCard(g, p, b.hex), items = [], chips = [];
    const advOpp = ca.pips >= cb.pips + 2, advLead = ca.leaderHit && !cb.leaderHit, advOwn = cb.own > 0 && ca.own < cb.own, advNone = ca.pips > 0 && cb.pips === 0;
    if (!(advOpp || advLead || advOwn || advNone)) return null;
    items.push(hexText(g, ca));
    if (ca.leaderHit) chips.push("hits the leader");
    if (ca.pips) chips.push(`−${ca.pips} pips`);
    if (ca.victims.length) chips.push(`steal ${nm(g, ca.victims[0].pid)}`);
    return done("robber", items, hexText(g, cb), chips);
  }

  // ── builds and what they replace ──
  const planOf = (m) => {
    if (m.type === "road") { const c = roadCard(g, p, m.edge, m.target); return { c, ...roadPlan(g, p, m, c) }; }
    if (m.type === "settlement") return settlePlan(g, p, m);
    if (m.type === "city") return cityPlan(g, p, m);
    return null;
  };
  if (["road", "settlement", "city"].includes(a.type) && (a.edge != null || a.node != null)) {
    const pa = planOf(a);
    if (!pa || !pa.items.length) return null;
    let items = pa.items.slice(), chips = pa.chips.slice(), vs = null, ok = false;
    const mark = a.type === "road" && pa.c.target ? { nodes: [pa.c.target.id], edges: pa.c.path || [a.edge], rivals: pa.c.blocks.slice(0, 2).map((x) => x.id) } : a.type === "settlement" && pa.bl ? { rivals: [pa.bl.id] } : {};
    if (a.trade) { const need = R5.filter((r) => (COST[a.type][r] || 0) > hand[r]); if (need.length) { items.unshift(`trade completes it (${list(need)})`); chips.unshift("trade completes it"); ok = true; } }
    const bt = ["road", "settlement", "city"].includes(b.type) && (b.edge != null || b.node != null) ? b.type : null;
    if (bt) { // build against build
      const pb = planOf(b);
      if (!pb) return null;
      if (a.type === "road" && bt === "road") {
        const ca = pa.c, cb = pb.c, ta = ca.target, tb = cb.target;
        const adv = (!tb && ta) || (ta && tb && (ta.pips >= tb.pips + 2 || ta.newRes.some((r) => !tb.newRes.includes(r)) || (ta.port && !tb.port) || tb.d0 - ta.d0 >= 1))
          || (ca.blocks.length && !cb.blocks.length) || (lrRelevant(ca) && !lrRelevant(cb));
        if (!adv) return null;
        vs = cap(roadVs(g, cb));
        return done("road", items, vs, chips.length ? chips : (ta ? [`${ta.pips} pips`] : []), mark);
      }
      vs = bt === "road" ? `road ${roadVs(g, pb.c)}` : bt === "settlement" ? `settlement ${pb.c.label}: +${pb.c.pips} pips${pb.c.newRes.length ? `, new ${list(pb.c.newRes)}` : ", nothing new"}` : `city ${pb.c.label}: doubles ${pb.c.pips} pips`;
      const ga = pa.c.gain ?? 0, gb = pb.c.gain ?? 0;
      const better = a.type === "road" ? (pa.c.target && (pa.c.target.pips >= 8 || pa.c.target.newRes.length || pa.c.target.port || pa.c.blocks.length || lrRelevant(pa.c))) : (ga >= gb + 2 || (pa.c.newRes?.length || 0) > (pb.c.newRes?.length || 0) || (pa.c.port && !pb.c.port));
      if (!better && !ok) return null;
      return done(a.type, items, vs, chips.length ? chips : [`+${pa.c.pips ?? pa.c.target?.pips} pips`], mark);
    }
    if (b.type === "end") {
      const n = sum(hand);
      vs = `Ended turn with ${plural(n, "card")} unused${n > 7 ? ` · a 7 takes ${Math.floor(n / 2)}` : ""}`;
      return done(a.type, items, vs, chips.length ? chips : [], mark);
    }
    if (b.type === "bank") {
      const after = { ...hand }; Object.entries(b.giveN || {}).forEach(([r, k]) => { after[r] -= k * 1; });
      vs = `bank trade ${list(b.give)} → ${list(Object.keys(b.get))}, builds nothing`;
      return done(a.type, items, vs, chips, mark);
    }
    if (b.type === "buy") { vs = "a development card instead"; return done(a.type, items, vs, chips, mark); }
    return done(a.type, items, null, chips, mark);
  }

  // ── a development card (bought, or after a trade) against ending the turn ──
  if (a.type === "buy" && b.type === "end") {
    const n = sum(hand), items = [], chips = [];
    const need = R5.filter((r) => COST.dev[r] > hand[r]);
    if (a.trade && need.length) { items.push(`trade completes a development card (${list(need)} was missing)`); chips.push("trade completes it"); }
    if (n > 7) { items.push(`puts ${list(R5.filter((r) => COST.dev[r] > 0))} to use before a 7`); chips.push(`a 7 takes ${Math.floor(n / 2)}`); }
    if (!items.length) return null;
    return done("buy", items, `ended turn with ${plural(n, "card")} unused${n > 7 ? ` · a 7 takes ${Math.floor(n / 2)}` : ""}`, chips);
  }

  // ── end turn / saving ──
  if (a.type === "end" && a.saves !== false) {
    const bc = buildOf(b);
    if (!bc || b.type === "buy" && false) return null;
    const costB = COST[bc];
    const after = minus(hand, costB);
    const inc = g._aiIncome(p);
    const goals = [];
    const hasSett = [...p.settlements].length > 0 && g.piecesLeft(p, "city") > 0;
    if (hasSett) goals.push({ k: "city", name: "a City", cost: COST.city });
    if (g.piecesLeft(p, "settlement") > 0 && g.geometry.nodes.some((n) => legalSpot(g, n.id) && n.edgeIds.some((e) => g.geometry.edges[e].owner === p.id))) goals.push({ k: "settlement", name: "a Settlement", cost: COST.settlement });
    if (g.devDeck?.length) goals.push({ k: "dev", name: "a development card", cost: COST.dev });
    const cand = goals.filter((x) => x.k !== bc).map((x) => ({ ...x, m0: missing(hand, x.cost), m1: missing(after, x.cost) })).filter((x) => x.m1 > x.m0 && x.m0 <= 2)
      .sort((x, y) => x.m0 - y.m0 || (y.m1 - y.m0) - (x.m1 - x.m0));
    if (!cand.length) return null;
    const c = cand[0], eta0 = g._aiEta(c.cost, hand, inc, null), eta1 = g._aiEta(c.cost, after, inc, null);
    const turns = (x) => (x < 0.05 ? "now" : `~${Math.max(1, Math.round(x))} turn${Math.round(x) > 1 ? "s" : ""}`);
    const items = [c.m0 === 0 ? `keeps ${c.name} affordable` : `keeps ${c.name} in reach (${plural(c.m0, "card")} short, ${turns(eta0)})`];
    const vs = `${bc === "dev" ? "the card" : lc(BUILD_NAME[bc])} uses ${list(R5.filter((r) => (costB[r] || 0) > 0 && (c.cost[r] || 0) > 0))} that ${lc(c.name.replace(/^a /, "the "))} needs → ${turns(eta1)}`;
    return done("save", items, vs, [c.m0 === 0 ? "affordable now" : `${plural(c.m0, "card")} short`, `${turns(eta0)} vs ${turns(eta1)}`]);
  }

  // ── bank trade ──
  if (a.type === "bank") {
    const gets = a.get || {};
    const builds = ["city", "settlement", "road", "dev"].filter((k) => !afford(hand, COST[k]) && R5.every((r) => Math.max(0, (COST[k][r] || 0) - hand[r]) <= (gets[r] || 0)));
    if (!builds.length) return null;
    const k = builds[0];
    const items = [`the trade completes ${k === "dev" ? "a development card" : `a ${lc(BUILD_NAME[k])}`} (${list(R5.filter((r) => (COST[k][r] || 0) > hand[r]))} was missing)`];
    const n = sum(hand);
    const vs = b.type === "end" ? `Ended turn with ${plural(n, "card")} unused${n > 7 ? ` · a 7 takes ${Math.floor(n / 2)}` : ""}` : null;
    return done("bank", items, vs, [`→ ${list(Object.keys(gets))}`, `makes a ${k === "dev" ? "card" : lc(BUILD_NAME[k])}`]);
  }
  if (b.type === "bank" && ["road", "settlement", "city", "buy"].includes(a.type)) return null;

  // ── development cards ──
  if (a.type === "play" && a.dev === "knight") {
    const mine = p.knightsPlayed, holder = g.largestArmyHolder, hk = holder != null ? g.players[holder].knightsPlayed : 0;
    const rival = Math.max(0, ...g.players.filter((q) => q.id !== p.id).map((q) => q.knightsPlayed));
    const items = [], chips = [];
    if (holder !== p.id && mine + 1 >= 3 && mine + 1 > Math.max(hk, 2)) { items.push(`takes Largest Army (${mine + 1} vs ${hk})`); chips.push("Largest Army"); }
    else if (holder !== p.id && mine + 1 >= 2 && rival - (mine + 1) <= 1) { items.push(`Largest Army race: ${mine + 1} knights vs ${rival}`); chips.push("Army race"); }
    const rh = g.geometry.hexes[g.robberHexId], blocked = rh ? pipsOfOwn(g, p, rh.id) : 0;
    if (blocked >= 3) { items.push(`frees your ${g._hexName(g.robberHexId)} (−${blocked} pips)`); chips.push(`+${blocked} pips`); }
    return items.length ? done("dev", items, b.type === "end" ? "kept the Knight" : null, chips) : null;
  }
  return null;
}
const pipsOfOwn = (g, p, hexId) => hexCard(g, p, hexId).own;
