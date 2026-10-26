// Seafarers, game side: board set-up, the human's ship / pirate / gold interactions and the dock trays.
// Mixed into ColonistFullGame.prototype (so `this` is the game); game.js calls these from marked hooks.
import { Seafarers } from "./rules.js";
import { layoutHexes, mainCenter, ISLAND_TILES, PIRATE_START, SHIP_COST } from "./scenario.js";
import { icon, cardSvg } from "../themes/manager.js";

const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const LBL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const COST = { road: { wood: 1, brick: 1 }, ship: SHIP_COST, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, development: { sheep: 1, wheat: 1, ore: 1 } };

export const SeaGame = {
  /** Board layout for createBoardGeometry (null in a normal game). */
  _seaLayout(settings = this.settings) { return settings?.board === "seafarers" ? layoutHexes() : null; },

  /**
   * New Seafarers board: the main island gets a basic 19-hex board in the chosen map mode (random /
   * balanced / beginner — rulebook p. 8 "Variable set-up"), the small islands their 9 tiles (fixed for
   * Beginner, shuffled otherwise with no 6/8 side by side and the two gold fields on different islands).
   * Returns the robber hex (the desert). `mk` / `assign` are game.js's createBoardGeometry / assignTiles.
   */
  _seaAssignBoard(mapMode, mk, assign) {
    const geo = this.geometry;
    const byQR = new Map(geo.hexes.map((h) => [`${h.q},${h.r}`, h]));
    const tmp = mk(1000, 1000);
    assign(tmp, mapMode);
    const c = mainCenter();
    let robber = 0;
    tmp.hexes.forEach((t) => {
      const h = byQR.get(`${t.q + c.q},${t.r + c.r}`);
      h.resource = t.resource; h.number = t.number;
      if (h.resource === "desert") robber = h.id;
    });
    geo.hexes.forEach((h) => { if (h.kind === "s") { h.resource = "sea"; h.number = null; } });
    const keys = Object.keys(ISLAND_TILES);
    let tiles = keys.map((k) => ISLAND_TILES[k]);
    if (mapMode !== "beginner") {
      const byKey = new Map(geo.hexes.map((h) => [h.key, h]));
      const nb = (k) => { const h = byKey.get(k); return geo.hexes.filter((o) => o.id !== h.id && o.island === h.island && o.island != null && Math.hypot(o.center.x - h.center.x, o.center.y - h.center.y) < geo.hexSize * 1.9); };
      for (let i = 0; i < 300; i += 1) {
        const terr = shuffle(tiles.map((t) => t[0])), nums = shuffle(tiles.map((t) => t[1]));
        const cand = keys.map((k, j) => [terr[j], nums[j]]);
        const at = new Map(keys.map((k, j) => [k, cand[j]]));
        const goldIsl = keys.filter((k) => at.get(k)[0] === "gold").map((k) => byKey.get(k).island);
        if (new Set(goldIsl).size < goldIsl.length) continue;
        const hot = keys.some((k) => [6, 8].includes(at.get(k)[1]) && nb(k).some((o) => [6, 8].includes(at.get(o.key)?.[1])));
        if (hot) continue;
        tiles = cand;
        break;
      }
    }
    keys.forEach((k, j) => { const h = geo.hexes.find((x) => x.key === k); h.resource = tiles[j][0]; h.number = tiles[j][1]; });
    this.sea.pirateHexId = geo.hexes.find((h) => h.key === PIRATE_START).id;
    return robber;
  },

  /** 9 harbours (5 × 2:1, 4 × 3:1) spread round the main island's coast (rulebook p. 8). */
  _seaPorts() {
    const geo = this.geometry, H = geo.hexes;
    const main = (id) => H[id].island === 0;
    const coast = geo.edges.filter((e) => e.hexIds.filter(main).length === 1 && e.hexIds.every((id) => main(id) || H[id].resource === "sea"));
    const mainH = H.filter((h) => h.island === 0);
    const cx = mainH.reduce((a, h) => a + h.center.x, 0) / mainH.length, cy = mainH.reduce((a, h) => a + h.center.y, 0) / mainH.length;
    coast.forEach((e) => { const a = geo.nodes[e.nodes[0]], b = geo.nodes[e.nodes[1]]; e._angle = Math.atan2((a.y + b.y) / 2 - cy, (a.x + b.x) / 2 - cx); });
    coast.sort((a, b) => a._angle - b._angle);
    const step = coast.length / 9, off = Math.floor(Math.random() * Math.floor(step));
    const types = shuffle(["any", "any", "any", "any", "wood", "brick", "sheep", "wheat", "ore"]);
    return Array.from({ length: 9 }, (_, i) => coast[Math.floor(off + i * step) % coast.length]).map((e, i) => {
      e.nodes.forEach((n) => geo.nodes[n].ports.push(types[i]));
      return { edgeId: e.id, type: types[i], nodes: e.nodes };
    });
  },

  _seaNew(saved = null) {
    this.sea = this.settings?.board === "seafarers" ? new Seafarers(this, saved) : null;
    document.documentElement.dataset.map = this.sea ? "seafarers" : "island";
  },

  // ── building ships ──────────────────────────────────────────────────
  canBuildShip(player, edgeId, opts = {}) { return !!this.sea && this.sea.canBuildShip(player, edgeId, opts); },

  /** Seafarers build target for an edge tap: "road" or "ship" (null when neither is legal). */
  _seaEdgeType(player, edgeId, pa, free) {
    const road = this.canBuildRoad(player, edgeId, { free });
    const ship = this.canBuildShip(player, edgeId, { free });
    if (pa === "ship") return ship ? "ship" : null;
    if (pa === "road" && !free) return road ? "road" : null;
    if (road && ship) return this._seaPrefer(player, edgeId);
    return road ? "road" : ship ? "ship" : null;
  },

  /** A coast edge where both fit: continue whatever network reaches it (ships win at sea-only ends). */
  _seaPrefer(player, edgeId) {
    const e = this.geometry.edges[edgeId];
    const shipEnd = e.nodes.some((n) => this.geometry.nodes[n].edgeIds.some((id) => id !== edgeId && this.geometry.edges[id].owner === player.id && this.geometry.edges[id].ship));
    const roadEnd = e.nodes.some((n) => this.geometry.nodes[n].edgeIds.some((id) => id !== edgeId && this.geometry.edges[id].owner === player.id && !this.geometry.edges[id].ship));
    return shipEnd && !roadEnd ? "ship" : "road";
  },

  // ── set-up: road or ship (rulebook p. 6 §10) ─────────────────────────
  /** The piece the set-up road step places now: the only one that fits, else the dock's Road / Ship choice. */
  _seaSetupType(player) {
    const n = this.lastSetupNodeId;
    if (n == null) return "road";
    const ids = this.geometry.nodes[n].edgeIds;
    const road = ids.some((id) => this.canBuildRoad(player, id, { free: true, setupNode: n }));
    const ship = ids.some((id) => this.canBuildShip(player, id, { free: true, setupNode: n }));
    return road && ship ? this.sea.setupPiece : ship ? "ship" : "road";
  },
  _seaSetupSpots(player) {
    const n = this.lastSetupNodeId, type = this._seaSetupType(player);
    const ids = this.geometry.nodes[n].edgeIds;
    if (type === "ship") return { edges: [], ships: ids.filter((id) => this.canBuildShip(player, id, { free: true, setupNode: n })) };
    return { edges: ids.filter((id) => this.canBuildRoad(player, id, { free: true, setupNode: n })), ships: [] };
  },
  _seaSetupEdgeAt(player, x, y) {
    const { edges, ships } = this._seaSetupSpots(player);
    const id = this.findEdgeAt(x, y, (e) => edges.includes(e) || ships.includes(e));
    return id == null ? null : { type: ships.includes(id) ? "ship" : "road", id };
  },

  // ── moving a ship (human) ────────────────────────────────────────────
  /** Own movable ship under the tap, or null. */
  _seaShipAt(player, x, y) {
    const sea = this.sea;
    if (!sea || !player?.isHuman || !sea.canMoveNow(player)) return null;
    return this.findEdgeAt(x, y, (id) => sea.isShipMovable(player, id) && sea.moveTargets(player, id).length > 0);
  },

  _seaStartMove(player, edgeId) {
    this._dropUndo();
    this.trayMode = null;
    this.confirmBuild = null;
    this.sea.moveSel = { from: edgeId, targets: this.sea.moveTargets(player, edgeId) };
    this.pendingAction = "moveShip";
    this.canvas.style.cursor = "crosshair";
    this.sfx.click();
    this.render();
  },

  /** A tap while a ship is lifted: a dotted spot moves it, the ship itself (or elsewhere) puts it back. */
  _seaMoveTap(player, x, y) {
    const sel = this.sea.moveSel;
    if (!sel) { this.pendingAction = null; this.render(); return; }
    const to = this.findEdgeAt(x, y, (id) => sel.targets.includes(id));
    if (to != null) { this._seaCommitMove(player, sel.from, to); return; }
    const other = this._seaShipAt(player, x, y);
    if (other != null && other !== sel.from) { this._seaStartMove(player, other); return; }
    this._seaCancelMove();
  },

  _seaCancelMove() {
    if (this.sea) this.sea.moveSel = null;
    if (this.pendingAction === "moveShip") this.pendingAction = null;
    this.canvas.style.cursor = "grab";
    this.render();
  },

  _seaCommitMove(player, from, to) {
    const logLen = this.logEntries.length;
    const lr = this.longestRoadHolder;
    if (!this.sea.moveShip(player, from, to)) { this._seaCancelMove(); return; }
    this.sea.moveSel = null;
    this.pendingAction = null;
    this.canvas.style.cursor = "grab";
    this.addLog(`${player.name} moved a ship.`);
    this.sfx.buildRoad();
    const pos = this.getBuildPosition({ type: "road", id: to });
    this.placementAnims.push({ ...pos, type: "road", startTime: Date.now() });
    if (this.rush) this._rushAfterAction(player);
    else { this.recomputeScores(); this.checkForWinner(player); this.saveToStorage(); this.render(); }
    if (!this.winner) this._setUndo({ kind: "moveShip", from, to, pid: player.id, lr, logs: this.logEntries.slice(logLen), icon: "ship", label: "Ship moved", noun: "", dock: true });
    this.render();
  },

  _seaUndoMove(u) {
    const p = this.players[u.pid];
    if (!this.sea.unmoveShip(p, u.from, u.to)) return;
    this.longestRoadHolder = u.lr;
    if (u.logs?.length) this.logEntries = this.logEntries.filter((e) => !u.logs.includes(e));
    this.recomputeScores();
  },

  // ── island bonus ─────────────────────────────────────────────────────
  _seaOnSettlement(player, nodeId) {
    const got = this.sea.onSettlementBuilt(player, nodeId);
    if (!got) return null;
    const name = this.sea.islandName(got.island);
    this.addLog(`${player.name} reached ${name}: +2 points for a new island.`);
    this.sea.glow = { island: got.island, until: performance.now() + 2600 };
    if (player.isHuman) this._seaIslandNote = { text: `New island! First settlement on ${name}: +2 points`, until: Date.now() + 3200 };
    return got;
  },

  // ── gold (human) ─────────────────────────────────────────────────────
  _seaGoldPending(player = this.players?.find((p) => p.isHuman)) { return !!(this.sea && player && this.sea.goldFor(player.id)); },

  _seaGoldTap(res) {
    const human = this.players.find((p) => p.isHuman);
    if (!human || !RES.includes(res) || !this.sea?.goldFor(human.id) || !(this.bank[res] > 0)) { this.sfx.error?.(); return; }
    const done = this.sea.pickGold(human, res);
    this.fx?.flyResources?.(this.players.map((p) => (p === human ? { [res]: 1 } : {})), null);
    this.sfx.click();
    if (done) this.sfx.trade?.();
    this.recomputeScores();
    if (this.rush) this._rushAfterAction(human);
    else { this.saveToStorage(); this.render(); }
  },

  // ── robber or pirate ─────────────────────────────────────────────────
  _seaHexKind(hexId) { return this.geometry.hexes[hexId]?.resource === "sea" ? "pirate" : "robber"; },

  /** Dock / ticker words for a chosen pirate hex: whose ships it touches, what it blocks. */
  _seaPirateText(hexId, mover) {
    const hex = this.geometry.hexes[hexId];
    const owners = [...new Set(hex.edges.map((e) => this.geometry.edges[e]).filter((e) => e.ship && e.owner != null).map((e) => e.owner))];
    const others = owners.filter((o) => o !== mover.id).map((o) => this.players[o].name);
    const mine = owners.includes(mover.id) ? " (yours too)" : "";
    const who = others.length ? `Pirate next to ${others.join(" and ")}'s ships` : "Pirate on open water";
    return { hint: `${who} · no new ships on its edges${mine}`, sub: others.length ? "steals 1 card · blocks ships here" : "blocks ships here" };
  },

  _seaSetThief(mode) {
    if (!this.sea || this.pendingAction !== "robber") return;
    this.sea.thief = mode;
    if (this.confirmBuild?.type === "robber" && this._seaHexKind(this.confirmBuild.id) !== mode) { this._cancelRobberTimer(); this.confirmBuild = null; }
    this.sfx.click();
    this.render();
  },

  // ── dock trays ───────────────────────────────────────────────────────
  /** Gold pick: shown whenever the human owes a pick (also during a bot's turn). */
  _seaTrayGold(human, tbtn) {
    const item = this.sea?.goldFor(human.id);
    if (!item) return null;
    const got = item.got || {};
    const btns = RES.map((r) => tbtn(`data-gold="${r}" ${this.bank[r] > 0 ? "" : "disabled"}`, `<span class="card">${cardSvg(r)}</span><span>${LBL[r]}</span>${got[r] ? `<i class="pk">+${got[r]}</i>` : ""}`, `res${got[r] ? " sel" : ""}`)).join("");
    return { mode: "gold", hint: `Gold field · pick any ${item.count} resource${item.count > 1 ? "s" : ""}`, html: btns };
  },

  /** Seafarers trays for the player whose turn it is (null: not ours). */
  _seaTray(human, cur, tbtn, close) {
    const sea = this.sea;
    if (!sea) return null;
    const cb = this.confirmBuild;
    if (this.setupPhase && this.setupAction === "road" && this.lastSetupNodeId != null && cur.isHuman && !cb) {
      const node = this.geometry.nodes[this.lastSetupNodeId];
      const roads = node.edgeIds.some((id) => this.canBuildRoad(cur, id, { free: true, setupNode: node.id }));
      const ships = node.edgeIds.some((id) => this.canBuildShip(cur, id, { free: true, setupNode: node.id }));
      if (roads && ships) {
        const on = sea.setupPiece;
        return { mode: "setupPiece", hint: on === "ship" ? "Tap a dotted spot on the water for your ship" : "Tap a road next to it · or start with a ship",
          html: tbtn(`data-setup-piece="road" aria-pressed="${on === "road"}"`, `${icon("road")}<span>Road</span>`, on === "road" ? "sel" : "")
            + tbtn(`data-setup-piece="ship" aria-pressed="${on === "ship"}"`, `${icon("ship")}<span>Ship</span>`, on === "ship" ? "sel" : "") };
      }
      return null;
    }
    if (this.pendingAction === "robber" && !cb && sea.thief == null && !this.robberVictimOptions?.length) {
      return { mode: "thief", hint: `${this.lastRoll === 7 ? "You rolled 7 · m" : "M"}ove the robber (land) or the pirate (sea)`,
        html: tbtn("data-thief=\"robber\"", `${icon("robber")}<span>Robber<small>on land</small></span>`, "wide")
          + tbtn("data-thief=\"pirate\"", `${icon("pirate")}<span>Pirate<small>on the sea</small></span>`, "wide") };
    }
    if (this.pendingAction === "moveShip" && sea.moveSel) {
      return { mode: "moveShip", hint: "Move ship: tap a dotted spot · one move per turn",
        html: `<div class="tinfo">${icon("ship")}<span>Move this ship<small>Open end of your route</small></span></div>`
          + tbtn("data-move-cancel", `${icon("close")}<span>Cancel</span>`) };
    }
    const u = this.undoState;
    if (u?.kind === "moveShip" && u.dock) {
      return { mode: "moved", key: String(u.from) + ":" + u.to,
        hint: "Ship moved · Undo for a few seconds",
        html: `<div class="tinfo">${icon("ship")}<span>Ship moved<small>Next move: next turn</small></span></div>`
          + tbtn("data-dock-undo", `${icon("undo")}<span>Undo</span>`) + tbtn("data-dock-done", `${icon("check")}<span>Done</span>`, "primary") };
    }
    if (u?.kind === "build" && u.isle && u.dock) {
      return { mode: "island", key: String(u.id),
        hint: `New island! First settlement on ${sea.islandName(u.isle.island)}: +2 points`,
        html: `<div class="tinfo">${icon("island")}<span>+2 points<small>New island · ${sea.islandName(u.isle.island)}</small></span></div>`
          + tbtn("data-dock-undo", `${icon("undo")}<span>Undo</span>`) + tbtn("data-dock-done", `${icon("check")}<span>OK</span>`, "primary") };
    }
    return null;
  },

  /** Build tray (phones): Ship sits next to Road. Each button shows its cost in small chips (Seafarers). */
  _seaCostChips(type) {
    const cost = COST[type] || {};
    return `<span class="tcost">${RES.filter((r) => cost[r]).flatMap((r) => Array(cost[r]).fill(`<i class="cc ${r}">${icon(r)}</i>`)).join("")}</span>`;
  },

  /** Tray clicks for the Seafarers modes; true when handled. */
  _seaTrayClick(d) {
    if (!this.sea) return false;
    const cur = this.currentPlayer;
    if (d.gold) { this._seaGoldTap(d.gold); return true; }
    if (d.thief) { this._seaSetThief(d.thief); return true; }
    if ("moveCancel" in d) { this._seaCancelMove(); return true; }
    if ("dockUndo" in d) { this.undoLast(); return true; }
    if ("dockDone" in d) { this._dropUndo(); this._seaIslandNote = null; this.render(); return true; }
    if (d.setupPiece) { this.sea.setupPiece = d.setupPiece; this.confirmBuild = null; this.sfx.click(); this.render(); return true; }
    if (cur && d.trayBuild === "ship") return false;
    return false;
  },

  /** The human may not act while a gold pick waits (it's quick, and it keeps the bank honest). */
  _seaHumanBlocked() { return this._seaGoldPending(); },

  /** Status / ticker line while a Seafarers prompt is up (null: none). */
  _seaStatus() {
    if (!this.sea) return null;
    const n = this._seaIslandNote;
    if (n && n.until > Date.now()) return n.text;
    return null;
  },

  /** VP breakdown rows (tooltip). */
  _seaVpRows(player) {
    if (!this.sea) return [];
    const b = this.sea.bonus[player.id] || [];
    return b.length ? [{ label: `New islands (${b.length})`, value: `${b.length} x 2 = ${b.length * 2}` }] : [];
  },

  _seaRestore(data) {
    this._seaNew(data?.sea || {});
    if (!this.sea) return;
    (data.shipEdges || []).forEach((id) => { const e = this.geometry.edges[id]; if (e) e.ship = true; });
    this.players.forEach((p, i) => { p.ships = new Set((data.players?.[i]?.ships) || []); });
  },
};
