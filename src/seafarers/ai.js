// Seafarers bots (phase 1, basic and fast). Mixed into Seafarers.prototype, so `this` is game.sea and
// `this.g` the game. The Classic planner (game._aiPlan) stays in charge; these add:
//  * sea goals: the best few coastal spots reachable by ships, weighing the spot (production, +2 VP
//    for a new small island) against the ships it still needs — "per-island targets";
//  * a ship step toward the top sea goal (the planner then saves Lumber + Wool for it, since every
//    discard / trade decision protects the cost of its top goals);
//  * a free ship move when it brings a target closer; never a ship next to the pirate (illegal anyway);
//  * pirate or robber on a 7 / Knight: whichever hurts the leader more (block + steal);
//  * gold picks: what the plan is short of, bank permitting.
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const SHIP = { wood: 1, sheep: 1 };

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

  /** Free action: move an open-end ship when that brings the top sea goal closer. */
  aiMoveStep(player, plan) {
    if (!this.canMoveNow(player)) return false;
    const goal = plan.goals.find((x) => x.via === "ship" && x.dist > 0);
    if (!goal) return false;
    const movable = [...player.ships].filter((id) => this.isShipMovable(player, id));
    if (!movable.length) return false;
    const before = this.shipReach(player).dist[goal.nodeId];
    let best = null;
    for (const from of movable) {
      for (const to of this.moveTargets(player, from)) {
        // try it
        this._swap(player, from, to);
        const d = this.shipReach(player).dist[goal.nodeId];
        this._swap(player, to, from);
        if (d < before && (!best || d < best.d)) best = { from, to, d };
      }
    }
    if (!best) return false;
    if (!this.moveShip(player, best.from, best.to)) return false;
    this.g.addLog(`${player.name} moved a ship.`);
    this.g.sfx.buildRoad();
    this.g.recomputeScores();
    this.g.checkForWinner(player);
    return true;
  },

  _swap(player, from, to) {
    const E = this.g.geometry.edges;
    E[from].owner = null; E[from].ship = false; player.ships.delete(from);
    E[to].owner = player.id; E[to].ship = true; player.ships.add(to);
  },

  /** "Simple" expansion bots: a ship toward the nearest new island when affordable and nothing else fits. */
  aiSimpleShip(player) {
    const g = this.g;
    if (!RES.every((r) => player.resources[r] >= (SHIP[r] || 0))) return false;
    const plan = g._aiPlan(player);
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

  /** 7 / Knight: robber (land) or pirate (sea), whichever scores higher against the leader. */
  chooseThiefHex(mover) {
    const g = this.g;
    const others = g.players.filter((p) => p.id !== mover.id);
    const top = Math.max(...others.map((p) => p.publicVictoryPoints));
    const weight = (pid) => { const p = g.players[pid]; return p.publicVictoryPoints >= top ? (p.publicVictoryPoints >= this.winPoints - 3 ? 2.6 : 1.6) : 0.8; };
    const prot = (pid) => g._isRobberProtected(pid, mover);
    // robber: the Classic choice restricted to land, scored the same simple way here
    const prev = this.thief;
    this.thief = "robber";
    let land = null;
    try { this._evalRobber = true; land = g.chooseRobberHex(mover); } finally { this._evalRobber = false; this.thief = prev; }
    const landScore = (hexId) => {
      if (hexId == null) return -Infinity;
      const hex = g.geometry.hexes[hexId];
      const pips = hex.number ? PIPS[hex.number] || 0 : 0;
      let s = 0;
      const vic = new Set();
      hex.nodes.forEach((nid) => {
        const n = g.geometry.nodes[nid];
        if (n.owner == null) return;
        const cards = (pips / 36) * (n.structure === "city" ? 2 : 1) * 10;
        if (n.owner === mover.id) s -= cards * 1.5; else { s += cards * weight(n.owner); if (!prot(n.owner)) vic.add(n.owner); }
      });
      if (vic.size) s += Math.max(...[...vic].map((v) => weight(v) * 0.9));
      return s;
    };
    let best = { hex: land, s: landScore(land) };
    // pirate: steal from the leader's ships and block their open sea routes
    this.legalThiefHexes(mover, "pirate").forEach((hex) => {
      let s = 0;
      const vic = new Set();
      hex.edges.forEach((eid) => {
        const e = g.geometry.edges[eid];
        if (e.owner == null || !e.ship) return;
        if (e.owner === mover.id) { s -= 0.8; return; }
        // blocks building / moving there: an open end of a route (where they sail on next) hurts most
        const open = e.nodes.some((n) => g.geometry.nodes[n].owner !== e.owner && !g.geometry.nodes[n].edgeIds.some((x) => x !== eid && g.geometry.edges[x].owner === e.owner));
        s += (open ? 1.1 : 0.3) * weight(e.owner);
        if (!prot(e.owner) && RES.some((r) => g.players[e.owner].resources[r] > 0)) vic.add(e.owner);
      });
      if (vic.size) s += Math.max(...[...vic].map((v) => weight(v) * 0.9));
      if (s > best.s + 0.2) best = { hex: hex.id, s };
    });
    return best.hex ?? land;
  },
};
