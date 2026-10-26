// Seafarers rules engine ("Heading for New Shores", phase 1). One instance lives on game.sea while a
// Seafarers game is running (null in normal games); game.js only calls in through small, marked hooks.
//
// Rules sources — Catan: Seafarers, 5th English edition (2015) rulebook,
// https://world-of-board-games.com.sg/docs/Catan-Seafarers-5ed.pdf:
//  p.3 §2 Ship Building: a ship costs 1 lumber + 1 wool; ships go on a hex side between two sea hexes or a
//       sea and a land hex, never between two land hexes; a new ship is placed next to your own coastal
//       settlement/city or next to one of your ships; branching allowed; one ship OR one road per coast edge.
//  p.4 §4 Shipping Routes: ships never connect directly to roads (and vice versa): only through a settlement
//       or city at the meeting point; unconnected networks do not count for the Longest Trade Route.
//  p.4 §5 Moving Ships: 1 ship per turn, during your building phase; not a ship built this turn; obey the
//       placement rules; only a ship with one end not adjacent to any of your other pieces; never a ship of
//       a closed route (an unbroken line of ships between two of your settlements/cities).
//  p.5 §7 Longest Trade Route: like Longest Road (2 VP, min. 5) but roads and ships count together, linked
//       only through a settlement/city; only the single longest branch counts.
//  p.5 §8 Road Building card: 2 roads, 2 ships, or 1 of each.
//  p.6 §9 Gold fields: each adjacent settlement takes 1, each city 2, of any resource(s) of its choice.
//  p.6 §10 Starting with a ship: a coastal set-up settlement may get a ship instead of a road.
//  p.6 §11 The Pirate: on a 7 (or a Knight) move the pirate INSTEAD of the robber, onto a sea hex; steal
//       1 random card from ONE player with a ship on that hex's edges; no new ship may be placed on the
//       edges of the pirate's hex, and no ship there may be moved away.
//  p.8 Scenario 1: set-up on the main island only; robber starts in the desert, the pirate on its sea hex;
//       first settlement on each small island = 2 special VP (each player, each island); 14 VP wins.
import { ISLAND_NAMES, WIN_POINTS, SHIP_LIMIT, SHIP_COST } from "./scenario.js";

const RES = ["wood", "brick", "sheep", "wheat", "ore"];

export class Seafarers {
  /** @param game the ColonistFullGame; @param saved serialized state (or null for a new game) */
  constructor(game, saved = null) {
    this.g = game;
    this.pirateHexId = saved?.pirateHexId ?? null;
    this.builtThisTurn = new Set(saved?.builtThisTurn || []); // ships built this turn (may not move)
    this.moved = new Set(saved?.moved || []);                  // players who moved a ship this turn / roll
    this.bonus = saved?.bonus || {};                           // { pid: [islandId, ...] } +2 VP each
    this.bonusNode = saved?.bonusNode || {};                   // { islandKey "pid:island": nodeId } (chip under that settlement)
    this.gold = saved?.gold || [];                             // pending human gold picks [{ pid, count, hexes }]
    this.thief = null;                                         // UI: "robber" | "pirate" | null while moving it
    this.setupPiece = "road";                                  // UI: set-up road step — "road" or "ship" on a coastal settlement
    this.moveSel = null;                                       // UI: { from: edgeId } while moving a ship
  }

  get winPoints() { return WIN_POINTS; }
  get shipLimit() { return SHIP_LIMIT; }
  get shipCost() { return SHIP_COST; }

  toJSON() {
    return { pirateHexId: this.pirateHexId, builtThisTurn: [...this.builtThisTurn], moved: [...this.moved], bonus: this.bonus, bonusNode: this.bonusNode, gold: this.gold };
  }

  // ── board classification ────────────────────────────────────────────
  get geo() { return this.g.geometry; }
  isSeaHex(hexId) { return this.geo.hexes[hexId]?.resource === "sea"; }
  isLandHex(hexId) { const h = this.geo.hexes[hexId]; return !!h && h.resource !== "sea"; }
  /** "land" (two land hexes), "coast" (land + sea or the sea frame), "sea" (no land at all). */
  edgeKind(edgeId) {
    const e = this.geo.edges[edgeId];
    const land = e.hexIds.filter((h) => this.isLandHex(h)).length;
    if (land === 0) return "sea";
    if (land === 2) return "land";
    return "coast"; // one land hex, the other side is sea or the board frame (open sea)
  }
  nodeIsLand(nodeId) { return this.geo.nodes[nodeId].adjacentHexes.some((h) => this.isLandHex(h)); }
  nodeIsCoast(nodeId) { const n = this.geo.nodes[nodeId]; return this.nodeIsLand(nodeId) && (n.adjacentHexes.length < 3 || n.adjacentHexes.some((h) => this.isSeaHex(h))); }
  /** Island id of a node (0 = main island, 1..3 small islands), null at sea. */
  islandOfNode(nodeId) {
    for (const h of this.geo.nodes[nodeId].adjacentHexes) { const i = this.geo.hexes[h].island; if (i != null) return i; }
    return null;
  }
  islandName(id) { return ISLAND_NAMES[id] || "an island"; }

  // ── pieces ───────────────────────────────────────────────────────────
  shipsLeft(player) { return SHIP_LIMIT - (player.ships?.size || 0); }
  _ownBuilding(player, nodeId) { const n = this.geo.nodes[nodeId]; return n.owner === player.id && n.structure != null; }
  _rivalBuilding(player, nodeId) { const n = this.geo.nodes[nodeId]; return n.owner != null && n.owner !== player.id; }
  _hasOwn(player, nodeId, ship, ignore = null) {
    return this.geo.nodes[nodeId].edgeIds.some((id) => id !== ignore && this.geo.edges[id].owner === player.id && !!this.geo.edges[id].ship === ship);
  }
  pirateTouches(edgeId) { return this.pirateHexId != null && this.geo.edges[edgeId].hexIds.includes(this.pirateHexId); }

  /** Roads in Seafarers: never on open sea; connect through own roads or own buildings only (not ships). */
  canBuildRoad(player, edgeId, { free = false, setupNode = null } = {}, hasCost) {
    const e = this.geo.edges[edgeId];
    if (!e || e.owner != null || this.edgeKind(edgeId) === "sea") return false;
    if (player.roads.size >= 15) return false;
    if (!free && !hasCost) return false;
    if (setupNode != null) return e.nodes.includes(setupNode) && this.islandOfNode(setupNode) === 0;
    return e.nodes.some((n) => this._ownBuilding(player, n) || (!this._rivalBuilding(player, n) && this._hasOwn(player, n, false)));
  }

  /** A ship: sea or coast edge, free of the pirate, next to an own building or an own ship (not a road). */
  canBuildShip(player, edgeId, { free = false, setupNode = null, ignore = null } = {}) {
    const e = this.geo.edges[edgeId];
    if (!e || e.owner != null || this.edgeKind(edgeId) === "land") return false;
    if (this.shipsLeft(player) <= 0 && ignore == null) return false;
    if (!free && !RES.every((r) => player.resources[r] >= (SHIP_COST[r] || 0))) return false;
    if (this.pirateTouches(edgeId)) return false;
    if (setupNode != null) return e.nodes.includes(setupNode);
    return e.nodes.some((n) => this._ownBuilding(player, n) || (!this._rivalBuilding(player, n) && this._hasOwn(player, n, true, ignore)));
  }

  placeShip(player, edgeId, { free = false, setupNode = null } = {}) {
    if (!this.canBuildShip(player, edgeId, { free, setupNode })) return false;
    const e = this.geo.edges[edgeId];
    e.owner = player.id;
    e.ship = true;
    player.ships.add(edgeId);
    this.builtThisTurn.add(edgeId);
    return true;
  }

  removeShip(player, edgeId) {
    const e = this.geo.edges[edgeId];
    if (e.owner !== player.id || !e.ship) return false;
    e.owner = null;
    e.ship = false;
    player.ships.delete(edgeId);
    this.builtThisTurn.delete(edgeId);
    return true;
  }

  // ── moving ships ─────────────────────────────────────────────────────
  /** Has this player still got its ship move this turn (Classic) / this roll (Rush)? */
  canMoveNow(player) {
    const g = this.g;
    if (this.moved.has(player.id) || g.winner || g.setupPhase) return false;
    if (g.isRush()) return !!g.rush && !g.rush.paused && g.phase === "main";
    return g.currentPlayer === player && g.phase === "main";
  }

  /** An open end of an open route: not built this turn, not on the pirate's hex, one end free of own pieces. */
  isShipMovable(player, edgeId) {
    const e = this.geo.edges[edgeId];
    if (!e || e.owner !== player.id || !e.ship) return false;
    if (this.builtThisTurn.has(edgeId) || this.pirateTouches(edgeId)) return false;
    // A ship with a free end can't lie inside a line of ships between two of your buildings,
    // so this also rules out every ship of a closed route.
    return e.nodes.some((n) => !this._ownBuilding(player, n) && !this.geo.nodes[n].edgeIds.some((id) => id !== edgeId && this.geo.edges[id].owner === player.id));
  }

  /** Where a movable ship may go: every legal ship spot once it has left its own place. */
  moveTargets(player, fromEdge) {
    if (!this.isShipMovable(player, fromEdge)) return [];
    const e = this.geo.edges[fromEdge];
    e.owner = null; e.ship = false; player.ships.delete(fromEdge);
    const out = [];
    try {
      this.geo.edges.forEach((x) => { if (x.id !== fromEdge && this.canBuildShip(player, x.id, { free: true })) out.push(x.id); });
    } finally {
      e.owner = player.id; e.ship = true; player.ships.add(fromEdge);
    }
    return out;
  }

  movableShips(player) {
    if (!this.canMoveNow(player)) return [];
    return [...player.ships].filter((id) => this.isShipMovable(player, id) && this.moveTargets(player, id).length > 0);
  }

  moveShip(player, from, to) {
    if (!this.canMoveNow(player) || !this.moveTargets(player, from).includes(to)) return false;
    const e = this.geo.edges[from];
    e.owner = null; e.ship = false; player.ships.delete(from);
    const t = this.geo.edges[to];
    t.owner = player.id; t.ship = true; player.ships.add(to);
    this.moved.add(player.id);
    return true;
  }

  /** Undo a move: the ship goes back and the move is available again. */
  unmoveShip(player, from, to) {
    const t = this.geo.edges[to];
    if (t.owner !== player.id || !t.ship || this.geo.edges[from].owner != null) return false;
    t.owner = null; t.ship = false; player.ships.delete(to);
    const e = this.geo.edges[from];
    e.owner = player.id; e.ship = true; player.ships.add(from);
    this.moved.delete(player.id);
    return true;
  }

  /** A new turn (Classic) or roll interval (Rush): ships built earlier may move, one move each again. */
  onNewTurn() {
    this.builtThisTurn.clear();
    this.moved.clear();
    this.moveSel = null;
  }

  // ── robber / pirate ──────────────────────────────────────────────────
  /** Hexes a mover may send the thief to. mode "robber" = land, "pirate" = sea, null = either. */
  legalThiefHexes(mover, mode = this.thief, protectedFn = null) {
    const hexes = this.geo.hexes;
    const land = hexes.filter((h) => h.resource !== "sea" && h.id !== this.g.robberHexId);
    const sea = hexes.filter((h) => h.resource === "sea" && h.id !== this.pirateHexId);
    let out = mode === "robber" ? land : mode === "pirate" ? sea : [...land, ...sea];
    if (protectedFn) {
      const strict = out.filter((h) => !protectedFn(h));
      if (strict.length) out = strict;
    }
    return out;
  }

  /** Players with a ship on the edges of a sea hex (who the pirate may rob), with cards, not the mover. */
  shipVictims(hexId, mover, isProtected = () => false) {
    const v = new Set();
    this.geo.hexes[hexId].edges.forEach((eid) => {
      const e = this.geo.edges[eid];
      if (!e.ship || e.owner == null || e.owner === mover.id || isProtected(e.owner)) return;
      if (RES.some((r) => this.g.players[e.owner].resources[r] > 0)) v.add(e.owner);
    });
    return [...v];
  }

  /** Pirate's hex touches a protected player's ship (friendly robber). */
  hexTouchesShipOf(hex, pred) {
    return hex.edges.some((eid) => { const e = this.geo.edges[eid]; return e.ship && e.owner != null && pred(e.owner); });
  }

  // ── gold fields ──────────────────────────────────────────────────────
  /**
   * Pay gold after a roll: owed[pid] cards of free choice. Bots (and an autoplayed human) choose at once;
   * an interactive human gets a pending pick in the dock. Every pick is limited by what the bank holds.
   * Order: the roller first, then clockwise (fair when the bank runs low).
   */
  payGold(owed, gains, roller) {
    const g = this.g;
    const n = g.players.length;
    const start = roller ? roller.id : 0;
    const order = Array.from({ length: n }, (_, k) => g.players[(start + k) % n]);
    order.forEach((p) => {
      const want = owed[p.id] || 0;
      if (!want) return;
      const can = Math.min(want, RES.reduce((a, r) => a + g.bank[r], 0));
      if (!can) { g.addLog(`The bank has no cards left for ${p.name}'s gold.`); return; }
      if (g._isInteractive(p)) {
        const cur = this.gold.find((x) => x.pid === p.id);
        if (cur) cur.count += can; else this.gold.push({ pid: p.id, count: can });
        g.addLog(`${p.name} strike${g._s(p)} gold: pick ${can} resource${can > 1 ? "s" : ""}.`);
        return;
      }
      const picks = this.aiGoldPicks(p, can);
      const got = {};
      picks.forEach((r) => { const k = g.takeFromBank(p, r, 1); if (k) { got[r] = (got[r] || 0) + k; if (gains) gains[p.id][r] += k; } });
      g.addLog(`${p.name} took ${this._list(got)} from the gold field.`);
    });
  }

  goldFor(pid) { return this.gold.find((x) => x.pid === pid) || null; }

  /** The human taps a resource in the gold tray: take it now (bank permitting). Returns true when done. */
  pickGold(player, res) {
    const g = this.g;
    const item = this.goldFor(player.id);
    if (!item || !RES.includes(res) || !(g.bank[res] > 0)) return false;
    g.takeFromBank(player, res, 1);
    item.count -= 1;
    item.got = item.got || {};
    item.got[res] = (item.got[res] || 0) + 1;
    if (item.count <= 0 || RES.every((r) => g.bank[r] <= 0)) {
      this.gold = this.gold.filter((x) => x !== item);
      g.addLog(`${player.name} took ${this._list(item.got)} from the gold field.`);
      return true;
    }
    return false;
  }

  /** Finish a pending pick on the player's behalf (Rush roll timeout, autoplay takes over). */
  autoGold(player) {
    const item = this.goldFor(player.id);
    if (!item) return;
    const picks = this.aiGoldPicks(player, item.count);
    picks.forEach((r) => { if (this.goldFor(player.id)) this.pickGold(player, r); });
    this.gold = this.gold.filter((x) => x.pid !== player.id);
  }

  _list(got) {
    const LBL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
    const parts = RES.filter((r) => got[r] > 0).map((r) => `${got[r]} ${LBL[r]}`);
    return parts.length ? parts.join(", ") : "nothing";
  }

  // ── longest trade route ──────────────────────────────────────────────
  /** Longest single line of own roads and ships; a road and a ship only join at an own settlement/city;
   *  a rival's building breaks the line. */
  tradeRouteLength(player) {
    const ids = [...player.roads, ...(player.ships || [])];
    if (!ids.length) return 0;
    const E = this.geo.edges, N = this.geo.nodes;
    const inc = new Map();
    ids.forEach((id) => E[id].nodes.forEach((n) => { if (!inc.has(n)) inc.set(n, []); inc.get(n).push(id); }));
    const blocked = (n) => N[n].owner != null && N[n].owner !== player.id;
    const own = (n) => N[n].owner === player.id && N[n].structure != null;
    const used = new Set();
    const dfs = (node, prevShip) => {
      if (used.size > 0 && blocked(node)) return 0;
      let best = 0;
      for (const id of inc.get(node) || []) {
        if (used.has(id)) continue;
        const ship = !!E[id].ship;
        if (prevShip != null && ship !== prevShip && !own(node)) continue;
        used.add(id);
        const e = E[id];
        best = Math.max(best, 1 + dfs(e.nodes[0] === node ? e.nodes[1] : e.nodes[0], ship));
        used.delete(id);
      }
      return best;
    };
    let longest = 0;
    inc.forEach((_, n) => { longest = Math.max(longest, dfs(n, null)); });
    return longest;
  }

  // ── island bonus ─────────────────────────────────────────────────────
  /** A settlement was built (not in set-up): first one of this player on a small island → +2 VP. */
  onSettlementBuilt(player, nodeId) {
    const isl = this.islandOfNode(nodeId);
    if (!isl) return null; // main island (0) or nothing
    const list = this.bonus[player.id] || (this.bonus[player.id] = []);
    if (list.includes(isl)) return null;
    list.push(isl);
    this.bonusNode[`${player.id}:${isl}`] = nodeId;
    return { island: isl, nodeId };
  }

  /** Undo of that settlement: the bonus goes with it. */
  dropBonus(player, island) {
    const list = this.bonus[player.id] || [];
    this.bonus[player.id] = list.filter((i) => i !== island);
    delete this.bonusNode[`${player.id}:${island}`];
  }

  bonusVP(player) { return 2 * ((this.bonus[player.id] || []).length); }

  /** Settlements carrying a +2 chip: [{ nodeId, pid }]. */
  bonusChips() {
    return Object.entries(this.bonusNode).map(([k, nodeId]) => ({ pid: Number(k.split(":")[0]), nodeId }))
      .filter(({ pid, nodeId }) => this.geo.nodes[nodeId]?.owner === pid);
  }
}
