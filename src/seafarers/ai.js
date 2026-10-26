// Seafarers bots (phase 1, basic and fast). Mixed into Seafarers.prototype, so `this` is game.sea and
// `this.g` the game. The Classic planner (game._aiPlan) stays in charge; these add:
//  * sea goals: the best few coastal spots reachable by ships, weighing the spot (production, +2 VP
//    for a new small island) against the ships it still needs — "per-island targets";
//  * a ship step toward the top sea goal (the planner then saves Lumber + Wool for it, since every
//    discard / trade decision protects the cost of its top goals);
//  * a free ship move (once per turn) when it brings a target closer or frees a dead-end ship for a better
//    route ("sea potential", see _seaPotential) or takes the Longest Trade Route; never one that shortens
//    a route it holds or races for;
//  * pirate or robber on a 7 / Knight: compared by expected damage in cards — the robber's land block and
//    the pirate's route block (how much later each rival reaches its best sea spot, gold coasts included),
//    each minus the block the piece left behind, plus the steal (v0.79);
//  * gold picks: what the plan is short of, bank permitting.
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const SHIP = { wood: 1, sheep: 1 };
const VP_CARDS = 5;       // a victory point is worth about this many cards (sea potential)
const ROUTE_BLOCK = 0.35; // the pirate only delays a route for a few turns: share of the potential lost that counts

export const SeaAI = {
  /** Ship distances (0-1 BFS: own ships free) from the bot's coastal buildings / ship network to every
   *  node, and the first new ship on the way. Ships may not run past a rival's building or the pirate. */
  shipReach(player) {
    const g = this.g, nodes = g.geometry.nodes, edges = g.geometry.edges;
    const dist = new Array(nodes.length).fill(Infinity);
    const first = new Array(nodes.length).fill(null);
    const dq = [];
    const seed = (n) => { if (dist[n] !== 0) { dist[n] = 0; dq.push(n); } };
    [...player.settlements, ...player.cities].forEach((n) => { if (this.nodeIsCoast(n)) seed(n); });
    (player.ships || new Set()).forEach((id) => edges[id].nodes.forEach((n) => { if (!this._rivalBuilding(player, n)) seed(n); }));
    while (dq.length) {
      const u = dq.shift();
      if (this._rivalBuilding(player, u)) continue;
      for (const id of nodes[u].edgeIds) {
        const e = edges[id];
        const own = e.owner === player.id && e.ship;
        if (!own && (e.owner != null || this.edgeKind(id) === "land" || this.pirateTouches(id))) continue;
        const v = e.nodes[0] === u ? e.nodes[1] : e.nodes[0];
        const w = own ? 0 : 1;
        if (dist[u] + w >= dist[v]) continue;
        dist[v] = dist[u] + w;
        first[v] = w ? (first[u] ?? id) : first[u];
        if (w) dq.push(v); else dq.unshift(v);
      }
    }
    return { dist, first };
  },

  /** Settlement spots worth sailing to, added to the bot's plan (called from game._aiPlan). */
  addSeaGoals(player, ctx) {
    const g = this.g;
    const { add, inc, strat, profile } = ctx;
    if (g.piecesLeft(player, "settlement") <= 0 || this.shipsLeft(player) <= 0) return;
    const reach = this.shipReach(player);
    const roadReach = ctx.roadReach;
    const maxD = Math.min(strat.expansion === "simple" ? 4 : 6, this.shipsLeft(player));
    const owned = new Set(this.bonus[player.id] || []);
    const spots = [];
    g.geometry.nodes.forEach((node) => {
      const d = reach.dist[node.id];
      if (!(d <= maxD) || node.structure != null || (d > 0 && reach.first[node.id] == null)) return;
      if (!this.nodeIsLand(node.id)) return;
      if (node.neighbors.some((n) => g.geometry.nodes[n].structure != null)) return;
      if (roadReach && roadReach.dist[node.id] <= d && !(d === 0 && roadReach.dist[node.id] > 0)) return; // the road planner already covers it as cheaply
      const isl = this.islandOfNode(node.id);
      const fresh = isl > 0 && !owned.has(isl);
      const goldPips = node.adjacentHexes.reduce((a, hid) => { const hx = g.geometry.hexes[hid]; return a + (hx.resource === "gold" && hx.number ? PIPS[hx.number] || 0 : 0); }, 0);
      const h = g.getNodeProductionScore(node.id, player, profile) + (fresh ? 2.2 : 0) + goldPips * 0.12 - d * 0.5; // gold: any card you need
      spots.push({ nodeId: node.id, d, h, fresh, isl });
    });
    spots.sort((a, b) => b.h - a.h);
    spots.slice(0, 3).forEach(({ nodeId, d, fresh, isl }) => {
      const cost = { wood: 1 + d, brick: 1, sheep: 1 + d, wheat: 1, ore: 0 };
      const prod = g._aiNodeProd(nodeId, inc);
      add({ type: "settlement", via: "ship", label: `${fresh ? `New island (${this.islandName(isl)})` : "Coast"} by ship${d ? ` (+${d} ship${d > 1 ? "s" : ""})` : ""}`,
        cost, vp: 1 + (fresh ? 2 : 0), prod, nodeId, dist: d, edge: d ? reach.first[nodeId] : null });
    });
  },

  /** Build the next ship of a sea goal (paid). */
  aiBuildShip(player, edgeId) {
    const g = this.g;
    if (edgeId == null || !this.canBuildShip(player, edgeId)) return false;
    if (!this.placeShip(player, edgeId)) return false;
    g.payToBank(player, SHIP);
    g.addLog(`${player.name} built a ship.`);
    g.sfx.buildRoad();
    g.recomputeScores();
    g.checkForWinner(player);
    return true;
  },

  /** Open settlement spots on land (distance rule) a player could still sail to, with their worth in cards
   *  before the ships: +1 VP (+2 more for a new small island), production pips, gold pips extra. */
  _seaSpotList(player) {
    const g = this.g;
    if (g.piecesLeft(player, "settlement") <= 0) return [];
    const owned = new Set(this.bonus[player.id] || []);
    const out = [];
    g.geometry.nodes.forEach((node) => {
      if (node.structure != null || !this.nodeIsCoast(node.id)) return;
      if (node.neighbors.some((n) => g.geometry.nodes[n].structure != null)) return;
      const isl = this.islandOfNode(node.id);
      const fresh = isl > 0 && !owned.has(isl);
      let pips = 0, gold = 0;
      node.adjacentHexes.forEach((hid) => { const hx = g.geometry.hexes[hid]; const p = hx.number ? PIPS[hx.number] || 0 : 0; if (hx.resource === "gold") gold += p; else if (hx.resource !== "sea" && hx.resource !== "desert") pips += p; });
      out.push({ nodeId: node.id, worth: VP_CARDS * (1 + (fresh ? 2 : 0)) + 0.3 * pips + 0.45 * gold, fresh });
    });
    return out;
  },

  /** Sea potential (cards): the best spot's worth minus 2 cards per ship still needed, plus a little for
   *  the second best. Spots beyond the ships left (or 6 ships) don't count. Also returns the best d. */
  _seaPotential(player, spots, reach = this.shipReach(player)) {
    const maxD = Math.min(6, this.shipsLeft(player));
    let b1 = 0, b2 = 0, d1 = Infinity;
    for (const s of spots) {
      const d = reach.dist[s.nodeId];
      if (!(d <= maxD) || (d > 0 && reach.first[s.nodeId] == null)) continue;
      const v = s.worth - 2 * d;
      if (v > b1) { b2 = b1; b1 = v; d1 = d; } else if (v > b2) b2 = v;
    }
    return { v: b1 + 0.3 * b2, d: d1 };
  },

  /** Free action (once per turn, rulebook p.4 §5): move an open-end ship when that brings the plan's sea
   *  goal closer, frees a dead-end ship for a better route, or takes / secures the Longest Trade Route;
   *  never one that shortens a route it holds or is racing for. Each position is judged once per turn. */
  aiMoveStep(player, plan) {
    if (!this.canMoveNow(player) || !player.ships?.size) return false;
    const g = this.g;
    const key = `${g.turn}:${player.id}:${[...player.ships].join(",")}:${g.geometry.nodes.reduce((a, n) => a + (n.structure ? 1 : 0), 0)}:${this.pirateHexId}`;
    if (this._moveKey === key) return false;
    this._moveKey = key;
    const movable = [...player.ships].filter((id) => this.isShipMovable(player, id));
    if (!movable.length) return false;
    const goal = plan.goals.find((x) => x.via === "ship" && x.dist > 0);
    const spots = this._seaSpotList(player);
    if (!goal && !spots.length) return false;
    const reach0 = this.shipReach(player);
    const before = goal ? reach0.dist[goal.nodeId] : Infinity;
    const pot0 = this._seaPotential(player, spots, reach0).v;
    const lrLen = this.tradeRouteLength(player);
    const holder = g.longestRoadHolder;
    const rivalLen = Math.max(0, ...g.players.filter((p) => p.id !== player.id).map((p) => p.longestRoadLength || 0));
    const lrMatters = holder === player.id || rivalLen - lrLen <= 1 || lrLen >= 3;
    // the Longest Trade Route (2 VP) in cards: taking it, or getting out of reach of the next rival
    const lrValue = (len) => {
      if (len < 5) return 0;
      if (holder === player.id) return len > rivalLen + 1 ? 2 : len > rivalLen ? 1 : 0;
      return len > rivalLen ? 2 * VP_CARDS : 0;
    };
    const lr0 = lrValue(lrLen);
    let best = null;
    for (const from of movable) {
      for (const to of this.moveTargets(player, from)) {
        this._swap(player, from, to);
        let ok = true, d = Infinity, pot = 0, lrGain = 0;
        try {
          const len = lrMatters ? this.tradeRouteLength(player) : lrLen;
          if (lrMatters && len < lrLen && (holder === player.id || rivalLen - lrLen <= 1)) ok = false;
          else {
            lrGain = lrValue(len) - lr0;
            const reach = this.shipReach(player);
            d = goal ? reach.dist[goal.nodeId] : Infinity;
            pot = this._seaPotential(player, spots, reach).v;
          }
        } finally { this._swap(player, to, from); }
        if (!ok) continue;
        // closer to the planned goal (and not a worse sea overall), a better sea potential, or the
        // Longest Trade Route taken / made safer without losing sea potential
        const gain = (d < before ? 2 * Math.min(3, before - d) : 0) + (pot - pot0) + lrGain;
        if ((d < before && pot >= pot0 - 0.5) || pot - pot0 >= 1 || (lrGain > 0 && pot >= pot0 - 1)) {
          if (!best || gain > best.gain) best = { from, to, gain };
        }
      }
    }
    if (!best) return false;
    if (!this.moveShip(player, best.from, best.to)) return false;
    g.addLog(`${player.name} moved a ship.`);
    g._aiLog?.(player, `Moved a ship (sea potential +${best.gain.toFixed(1)})`);
    g.sfx.buildRoad();
    g.recomputeScores();
    g.checkForWinner(player);
    return true;
  },

  _swap(player, from, to) {
    const E = this.g.geometry.edges;
    E[from].owner = null; E[from].ship = false; player.ships.delete(from);
    E[to].owner = player.id; E[to].ship = true; player.ships.add(to);
  },

  /** "Simple" expansion bots: a ship move or a ship toward the nearest new island when nothing else fits. */
  aiSimpleShip(player) {
    const g = this.g;
    const canShip = RES.every((r) => player.resources[r] >= (SHIP[r] || 0));
    const canMove = this.canMoveNow(player) && [...(player.ships || [])].some((id) => this.isShipMovable(player, id));
    if (!canShip && !canMove) return false;
    const plan = g._aiPlan(player);
    if (canMove && this.aiMoveStep(player, plan)) return true; // v0.79: simple bots move ships too
    if (!canShip) return false;
    const goal = plan.goals.find((x) => x.via === "ship" && x.dist > 0);
    return goal ? this.aiBuildShip(player, goal.edge) : false;
  },

  /** Set-up: a road from the new settlement, or a ship when it heads for the islands (or no road fits). */
  aiSetupPiece(player, nodeId) {
    const g = this.g;
    const roadId = g.getBestRoadFromNode(player, nodeId);
    const road = roadId != null && g.canBuildRoad(player, roadId, { free: true, setupNode: nodeId }) ? roadId : null;
    const ships = g.geometry.nodes[nodeId].edgeIds.filter((id) => this.canBuildShip(player, id, { free: true, setupNode: nodeId }));
    // Second settlement on the south coast (facing the islands): a ship sometimes, for variety
    const south = g.geometry.nodes[nodeId].y > g.geometry.hexes.filter((h) => h.island === 0).reduce((a, h) => Math.max(a, h.center.y), -Infinity) - g.geometry.hexSize * 0.3;
    if (ships.length && (road == null || (south && Math.random() < 0.5))) {
      const pick = ships.sort((a, b) => this._edgeY(b) - this._edgeY(a))[0];
      return { type: "ship", id: pick };
    }
    if (road != null) return { type: "road", id: road };
    const any = g.geometry.nodes[nodeId].edgeIds.find((id) => g.canBuildRoad(player, id, { free: true, setupNode: nodeId }));
    return any != null ? { type: "road", id: any } : ships.length ? { type: "ship", id: ships[0] } : null;
  },
  _edgeY(id) { const e = this.g.geometry.edges[id]; return (this.g.geometry.nodes[e.nodes[0]].y + this.g.geometry.nodes[e.nodes[1]].y) / 2; },

  /** Road Building in Seafarers: a free ship toward the top sea goal, else the usual road. */
  aiFreePiece(player) {
    const g = this.g;
    const plan = g._aiPlan(player);
    const goal = plan.goals.find((x) => x.via === "ship" && x.dist > 0);
    if (goal && plan.goals.indexOf(goal) <= 1 && this.canBuildShip(player, goal.edge, { free: true })) return { type: "ship", id: goal.edge };
    const road = g.chooseStrategicRoadEdge(player, true);
    if (road != null && g.canBuildRoad(player, road, { free: true })) return { type: "road", id: road };
    if (goal && this.canBuildShip(player, goal.edge, { free: true })) return { type: "ship", id: goal.edge };
    return null;
  },

  /** Gold: the cards the plan is short of (top goal first), then the scarcest income; bank permitting. */
  aiGoldPicks(player, n) {
    const g = this.g;
    const bank = { ...g.bank };
    const hand = { ...player.resources };
    const picks = [];
    const take = (r) => { if (picks.length < n && bank[r] > 0) { bank[r] -= 1; hand[r] += 1; picks.push(r); return true; } return false; };
    let goals = [];
    try { goals = g._aiPlan(player).goals; } catch (_) { goals = []; }
    for (const goal of goals.slice(0, 3)) {
      for (const r of RES) while ((goal.cost[r] || 0) > hand[r] && picks.length < n && take(r));
      if (picks.length >= n) break;
    }
    let inc = null;
    try { inc = g._aiIncome(player); } catch (_) { inc = null; }
    while (picks.length < n) {
      const order = RES.filter((r) => bank[r] > 0).sort((a, b) => (inc ? inc[a] - inc[b] : 0) || bank[b] - bank[a]);
      if (!order.length || !take(order[0])) break;
    }
    return picks;
  },

  /** 7 / Knight: robber (land) or pirate (sea), by expected damage in cards (v0.79).
   *  Robber to L:  land block at L + steal at L − the land block it lifts from its current hex.
   *  Pirate to H:  route block at H + steal at H − the route block it lifts from its current hex.
   *  Land block = rivals' production on the hex over ~10 rolls (cities double), own production negative.
   *  Route block = how much the pirate cuts each rival's sea potential (ships it can no longer place:
   *  the way to a new island or a gold coast), scaled down because the pirate moves on in a few turns;
   *  own route blocked counts against. Every term is weighted toward the leader (awareness permitting). */
  chooseThiefHex(mover) {
    const g = this.g;
    const aware = g._aiStrat ? g._aiStrat(mover).awareness : "basic";
    const others = g.players.filter((p) => p.id !== mover.id);
    const top = Math.max(...others.map((p) => p.publicVictoryPoints));
    const weight = (pid) => {
      if (aware === "none") return 1;
      const p = g.players[pid];
      return p.publicVictoryPoints >= top ? (p.publicVictoryPoints >= this.winPoints - 3 ? 2.6 : 1.6) : 0.8;
    };
    const prot = (pid) => g._isRobberProtected(pid, mover);
    const handOf = (pid) => RES.reduce((a, r) => a + g.players[pid].resources[r], 0);
    const steal = (vic) => (vic.size ? Math.max(...[...vic].map((v) => weight(v) * Math.min(1.3, 0.6 + handOf(v) * 0.08))) : 0);
    // land
    const landBlock = (hexId) => {
      if (hexId == null) return 0;
      const hex = g.geometry.hexes[hexId];
      if (!hex || hex.resource === "sea" || hex.resource === "desert") return 0;
      const pips = hex.number ? PIPS[hex.number] || 0 : 0;
      let s = 0;
      hex.nodes.forEach((nid) => {
        const n = g.geometry.nodes[nid];
        if (n.owner == null || n.structure == null) return;
        const cards = (pips / 36) * (n.structure === "city" ? 2 : 1) * 10 * (hex.resource === "gold" ? 1.3 : 1);
        s += n.owner === mover.id ? -cards * 1.5 : cards * weight(n.owner);
      });
      return s;
    };
    const landVictims = (hexId) => {
      const vic = new Set();
      g.geometry.hexes[hexId].nodes.forEach((nid) => { const o = g.geometry.nodes[nid].owner; if (o != null && o !== mover.id && !prot(o) && handOf(o) > 0) vic.add(o); });
      return vic;
    };
    const legalOf = (mode) => {
      const prev = this.thief;
      this.thief = mode;
      try { return g._legalRobberHexes(mover); } finally { this.thief = prev; }
    };
    const prev = this.thief;
    this.thief = "robber";
    let land = null;
    try { this._evalRobber = true; land = g.chooseRobberHex(mover); } finally { this._evalRobber = false; this.thief = prev; }
    const lifted = landBlock(g.robberHexId);
    let best = { hex: land, s: land == null ? -Infinity : landBlock(land) + steal(landVictims(land)) - lifted };
    // sea: each player's open spots once, then their sea potential with the pirate on each candidate hex
    const P0 = this.pirateHexId;
    const players = g.players.filter((p) => p.ships && (p.ships.size > 0 || [...p.settlements, ...p.cities].some((n) => this.nodeIsCoast(n))) && this.shipsLeft(p) > 0);
    const spotsOf = new Map(players.map((p) => [p.id, this._seaSpotList(p)]));
    const potWith = (hexId) => {
      this.pirateHexId = hexId;
      try { return new Map(players.map((p) => [p.id, this._seaPotential(p, spotsOf.get(p.id)).v])); } finally { this.pirateHexId = P0; }
    };
    const free = potWith(null);
    const routeBlock = (hexId) => {
      if (hexId == null) return 0;
      const pot = potWith(hexId);
      let s = 0;
      players.forEach((p) => {
        const loss = Math.max(0, free.get(p.id) - pot.get(p.id)) * ROUTE_BLOCK;
        s += p.id === mover.id ? -loss * 1.5 : loss * weight(p.id);
      });
      return s;
    };
    const liftedSea = routeBlock(P0);
    legalOf("pirate").forEach((hex) => {
      if (hex.resource !== "sea") return;
      let ownShips = 0;
      hex.edges.forEach((eid) => { const e = g.geometry.edges[eid]; if (e.ship && e.owner === mover.id) ownShips += 1; });
      const vic = new Set(this.shipVictims(hex.id, mover, prot));
      const s = routeBlock(hex.id) + steal(vic) - liftedSea - ownShips * 0.3; // own ships there: frozen
      if (s > best.s + 0.2) best = { hex: hex.id, s };
    });
    return best.hex ?? land;
  },
};
