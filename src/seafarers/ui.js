// Seafarers, game side: board set-up, the human's ship / pirate / gold interactions and the dock trays.
// Mixed into ColonistFullGame.prototype (so `this` is the game); game.js calls these from marked hooks.
import { Seafarers } from "./rules.js";
import { layoutHexes, mainCenter, ISLAND_TILES, PIRATE_START, SHIP_COST } from "./scenario.js";
import { icon, cardSvg } from "../themes/manager.js";
import { drawSpec } from "../themes/board-renderer.js";
import { drawChoiceIcon } from "./render.js";

import { RESOURCES as RES, COSTS_SEA } from "../core/constants.js";
const LBL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const COST = { road: COSTS_SEA.road, ship: COSTS_SEA.ship, settlement: COSTS_SEA.settlement, city: COSTS_SEA.city, development: COSTS_SEA.development };

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
  _seaEdgeType(player, edgeId, pa, free, S = this.api.spots(player.id, { free })) { // S: the engine's legal spots (pass it when asking about many edges)
    const road = S.road.has(edgeId);
    const ship = S.ship.has(edgeId);
    if (pa === "ship") return ship ? "ship" : null;
    if (pa === "road" && !free) return road ? "road" : null;
    if (road && ship) return this._seaPrefer(player, edgeId);
    return road ? "road" : ship ? "ship" : null;
  },

  /** v0.98: a coast edge where a road and a ship both fit and the mode leaves the choice open (build / Road Building). */
  _seaBoth(player, edgeId, pa, free, S = this.api.spots(player.id, { free })) {
    if (pa === "ship" || (pa === "road" && !free)) return false;
    return S.road.has(edgeId) && S.ship.has(edgeId);
  },

  /** v0.98: the tiny "Road / Ship" chooser by the tapped coast edge (44 px buttons). A pick builds at once when building
   *  is direct, else it becomes the chosen spot (Place / a 2nd tap builds it); a mode-less pick only selects. */
  _seaChoosePiece(player, target, x, y, auto) {
    const modeless = !this.pendingAction;
    const NAME = { road: "Road", ship: "Ship" }, free = this.freeRoadsRemaining > 0;
    // the pieces the tap could mean are the engine's candidates for that edge (intentFor over the legal builds)
    const pieces = this.api.candidates(player.id, { edge: target.id }, null, { free }).map((a) => a.piece).filter((t) => NAME[t]);
    this._seaOpenChooser(x, y, "Build a road or a ship here", (pieces.length ? ["road", "ship"].filter((t) => pieces.includes(t)) : ["road", "ship"]).map((t) => [t, NAME[t]]).map(([type, label]) => ({
      piece: type, id: target.id, label, run: () => this._seaPickBuild(player, { type, id: target.id }, modeless, auto) })));
  },

  /** v1.31 Build the piece picked in a chooser: a mode-less pick only selects; otherwise it builds at once when building
   *  is direct, else it becomes the chosen spot (Confirm / a 2nd tap builds it). */
  _seaPickBuild(player, target, modeless, auto = false) {
    const free = this.freeRoadsRemaining > 0, t = { type: target.type, id: target.id, ambiguous: false };
    if (this.winner || this.currentPlayer !== player) return;
    const ok = this.api.spots(player.id, { free })[t.type]?.has(t.id);
    if (!ok) return;
    if (modeless) { this.pendingAction = t.type; this.confirmBuild = t; this._cbAt = performance.now(); this._autoPick = true; this.canvas.style.cursor = "crosshair"; this.render(); return; }
    if (this._confirmLevel() !== "always" && !auto) { this._applyPiece(player, t); return; }
    if (auto) this.pendingAction = t.type;
    this.confirmBuild = t;
    this._cbAt = performance.now();
    this.render();
  },

  /** v1.31 A tap that could mean building here or moving your ship: "Settlement · Move ship" (or Road / Ship · Move ship). */
  _seaChooseShipOrBuild(player, ship, targets, x, y) {
    const modeless = !this.pendingAction;
    const NAME = { settlement: "Settlement", city: "City", road: "Road", ship: "New ship" };
    const builds = targets.flatMap((t) => (t.both ? [{ type: "road", id: t.id }, { type: "ship", id: t.id }] : [{ type: t.type, id: t.id }]));
    const opts = builds.map((t) => ({ piece: t.type, id: t.id, label: NAME[t.type], run: () => this._seaPickBuild(player, t, modeless) }));
    opts.push({ piece: "move", id: ship, label: "Move ship", run: () => { if (!this.winner && this.currentPlayer === player && this._seaMovable(player).includes(ship)) this._seaStartMove(player, ship); } });
    this._seaOpenChooser(x, y, `${builds.map((b) => NAME[b.type]).join(" or ")}, or move your ship`, opts);
  },

  /**
   * The chooser by the tapped spot, shared by Road / Ship and Build / Move ship. v1.31 (ux-132): big tiles side by side,
   * each with its piece in your seat colour (as on the board) and a short word under it; the board previews what each
   * option means (`_seaPreview`): "numbered" shows every option at once with its tile's number, "focus" only the
   * option under the finger / keyboard focus (the first by default).
   */
  _seaOpenChooser(x, y, aria, opts) {
    this._seaCloseChooser();
    const cr = this.canvas.getBoundingClientRect(), v = this.view;
    const sx = cr.left + v.offsetX + v.scale * x, sy = cr.top + v.offsetY + v.scale * y;
    const numbered = (this._seaChooserStyle || "numbered") === "numbered" && opts.length > 1;
    const R = this.boardRenderer, pl = this.currentPlayer, c = R && pl ? R.pc(pl) : null;
    const el = document.createElement("div");
    el.className = "sea-chooser"; el.setAttribute("role", "group"); el.setAttribute("aria-label", aria);
    el.style.cssText = "position:fixed;z-index:60;display:flex;gap:6px;padding:6px;border-radius:16px;background:var(--float,#FBF6EA);border:var(--float-border,1px solid rgba(0,0,0,.12));box-shadow:var(--float-shadow,0 6px 18px rgba(0,0,0,.25));font:700 12px/1.1 var(--font-ui,system-ui);color:var(--ink,#1F1A17)";
    this._seaPreview = { items: opts.map((o, i) => ({ type: o.piece, id: o.id, n: i + 1 })), focus: 0, numbered };
    opts.forEach(({ piece, label, run }, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.piece = piece; b.setAttribute("aria-label", label);
      b.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:68px;min-height:68px;padding:6px 6px 7px;border-radius:12px;border:0;background:var(--chip,rgba(0,0,0,.06));color:inherit;font:inherit;cursor:pointer;white-space:nowrap";
      if (c) { const cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true"); try { drawChoiceIcon(R, cv, piece, c, drawSpec); } catch { /* icon only */ } b.appendChild(cv); }
      else b.insertAdjacentHTML("beforeend", icon(piece === "move" ? "ship" : piece).replace('class="ic ', 'style="font-size:32px" class="ic '));
      const t = document.createElement("span"); t.textContent = label; b.appendChild(t);
      if (numbered) b.insertAdjacentHTML("beforeend", `<i aria-hidden="true" style="position:absolute;top:3px;left:4px;width:16px;height:16px;border-radius:8px;background:#FBF6EA;border:1.5px solid #22313A;font:800 10px/14px system-ui,sans-serif;font-style:normal;color:#22313A;text-align:center;box-sizing:border-box">${i + 1}</i>`);
      const ring = (on) => { b.style.boxShadow = on ? "inset 0 0 0 2.5px var(--pick-ring,#22313A)" : "none"; };
      if (!numbered) ring(i === 0);
      const focusMe = () => {
        if (!this._seaPreview || numbered || this._seaPreview.focus === i) return;
        this._seaPreview.focus = i; el.querySelectorAll("button").forEach((x, j) => { x.style.boxShadow = j === i ? "inset 0 0 0 2.5px var(--pick-ring,#22313A)" : "none"; }); this.render();
      };
      b.addEventListener("pointerenter", focusMe); b.addEventListener("focus", focusMe);
      b.addEventListener("click", (ev) => { ev.stopPropagation(); this._seaCloseChooser(); run(); });
      el.appendChild(b);
    });
    document.body.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, sx - w / 2)))}px`;
    el.style.top = `${Math.round(sy - h - 28 < 8 ? sy + 28 : sy - h - 28)}px`;
    this._seaChooser = el;
    this._seaChooserOff = (ev) => { if (ev.type === "keydown" ? ev.key === "Escape" : !el.contains(ev.target)) this._seaCloseChooser(); };
    setTimeout(() => { if (this._seaChooser !== el) return; document.addEventListener("pointerdown", this._seaChooserOff, true); document.addEventListener("keydown", this._seaChooserOff, true); }, 0);
    this.sfx.click();
    this.render();
  },
  _seaCloseChooser() {
    if (!this._seaChooser) return;
    this._seaChooser.remove(); this._seaChooser = null;
    if (this._seaPreview) { this._seaPreview = null; this.render?.(); }
    document.removeEventListener("pointerdown", this._seaChooserOff, true); document.removeEventListener("keydown", this._seaChooserOff, true);
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
    const ids = this.geometry.nodes[n].edgeIds, S = this.api.spots(player.id);
    const road = ids.some((id) => S.road.has(id));
    const ship = ids.some((id) => S.ship.has(id));
    return road && ship ? this.sea.setupPiece : ship ? "ship" : "road";
  },
  _seaSetupSpots(player) {
    const n = this.lastSetupNodeId, type = this._seaSetupType(player);
    const ids = this.geometry.nodes[n].edgeIds, S = this.api.spots(player.id);
    if (type === "ship") return { edges: [], ships: ids.filter((id) => S.ship.has(id)) };
    return { edges: ids.filter((id) => S.road.has(id)), ships: [] };
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
    if (!sea || !player?.isHuman) return null;
    const movable = new Set(this.api.shipMoves(player.id).map((m) => m.from)); // the ships that have a legal moveShip
    return this.findEdgeAt(x, y, (id) => movable.has(id));
  },

  /** v1.18 The ships you may move now (cached: moveTargets is not free and the board draws every frame). */
  _seaMovable(player) {
    const sea = this.sea;
    if (!sea || !player?.isHuman) return [];
    const key = [this.turn, this.phase, player.id, player.ships.size, sea.builtThisTurn?.size ?? 0, sea.moved?.has(player.id) ? 1 : 0, sea.pirateHexId ?? "-", this.winner ? 1 : 0, this.setupPhase ? 1 : 0].join(":");
    if (this._seaMovKey !== key) { this._seaMovKey = key; this._seaMovList = [...new Set(this.api.shipMoves(player.id).map((m) => m.from))]; }
    return this._seaMovList;
  },
  /** The human whose ships can move right now (Rush: any time; otherwise on your own turn). */
  _seaMover() {
    const h = this.players.find((p) => p.isHuman);
    if (!h) return null;
    if (this.hotseat) return this.currentPlayer?.isHuman ? this.currentPlayer : null;
    return this.isRush() || this.currentPlayer === h ? h : null;
  },
  /** The "Move ship" entry of the build sheet: one movable ship starts the move, several: they light up. */
  _seaMoveButton() {
    const p = this._seaMover(), list = p ? this._seaMovable(p) : [];
    if (!list.length) { this._flashPrompt?.(this.sea?.moved?.has(p?.id) ? "You moved a ship this turn · next move next turn" : "No ship can move now: a ship moves from the open end of a route, not on the turn it was built", 3600); return; }
    if (list.length === 1) { this._seaStartMove(p, list[0]); return; }
    this.sea.movePulse = performance.now();
    this._flashPrompt?.(`Tap one of your ${list.length} ringed ships to move it`, 3600);
    this.render();
  },

  _seaStartMove(player, edgeId) {
    this._dropUndo();
    this.trayMode = null;
    this.confirmBuild = null;
    this.sea.moveSel = { from: edgeId, targets: this.api.shipMoves(player.id).filter((m) => m.from === edgeId).map((m) => m.to) };
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
    if (to != null) { this._applyMove(player, sel.from, to); return; }
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

  /** Move the lifted ship through the API; a move that is no longer legal puts the ship back down. */
  _applyMove(player, from, to) {
    const r = this.api.act({ actor: player.id, type: "moveShip", from, to });
    if (!r.ok) this._seaCancelMove();
    return r.ok;
  },
  _seaCommitMove(player, from, to) {
    const logLen = this.logEntries.length;
    const lr = this.longestRoadHolder;
    if (!this.sea.moveShip(player, from, to)) { this._seaCancelMove(); return; }
    this.sea.moveSel = null;
    this.pendingAction = null;
    this.canvas.style.cursor = "grab";
    this.emit({ type: "shipMoved", seat: player.id, from, to });
    const pos = this.getBuildPosition({ type: "road", id: to });
    this.placementAnims.push({ ...pos, type: "road", startTime: Date.now() });
    if (this.rush) this._rushAfterAction(player);
    else { this.recomputeScores(); this.checkForWinner(player); this.saveToStorage(); this.render(); }
    if (!this.winner) this._setUndo({ kind: "moveShip", from, to, pid: player.id, lr, logs: this.logEntries.slice(logLen), icon: "ship", label: "Ship moved", noun: "", dock: true }, 5000); // v0.81: expires after 5 s
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
    this.emit({ type: "islandReached", seat: player.id, island: name });
    this.sea.glow = { island: got.island, until: performance.now() + 2600 };
    if (player.isHuman) this._seaIslandNote = { text: `New island! First settlement on ${name}: +2 points`, until: Date.now() + 3200 };
    return got;
  },

  // ── gold (human) ─────────────────────────────────────────────────────
  _seaGoldPending(player = this._me()) { return !!(this.sea && player && this.sea.goldFor(player.id)); },

  /**
   * The picks the human has tapped so far (view state: the per-card UI with Undo). Nothing reaches the game until the selection is complete:
   * then one `pickGold` action carries every card (the engine's batch action). The stage belongs to one gold item: a new item (next roll, a
   * new game, an auto-pick) drops it.
   */
  _goldStaged(pid) {
    const item = this.sea?.goldFor(pid);
    if (!item) { this._goldStage = null; return []; }
    if (!this._goldStage || this._goldStage.item !== item) this._goldStage = { item, picks: [] };
    return this._goldStage.picks;
  },

  _seaGoldTap(res) {
    const human = this._me();
    const item = human && this.sea?.goldFor(human.id);
    const staged = item ? this._goldStaged(human.id) : [];
    const left = (r) => this.bank[r] - staged.filter((x) => x === r).length;
    if (!human || !RES.includes(res) || !item || !(left(res) > 0)) { this.sfx.error?.(); return; }
    const total = this.sea.goldTotal(item);
    staged.push(res);
    this.fx?.flyResources?.(this.players.map((p) => (p === human ? { [res]: 1 } : {})), null);
    this.sfx.click();
    if (staged.length >= item.count || RES.every((r) => left(r) <= 0)) { this._goldCommit(human, item, staged, total); return; }
    if (this.rush) this._rushAfterAction(human);
    else this.render();
  },

  /** The selection is complete: one `pickGold` through the API (a refusal, e.g. the bank ran short meanwhile, takes the cards one by one as before). */
  _goldCommit(human, item, staged, total) {
    const picks = staged.slice(), logLen = this.logEntries.length;
    this._goldStage = null;
    const r = this.api.act({ actor: human.id, type: "pickGold", resources: picks });
    if (!r.ok) picks.forEach((x) => this.sea.pickGold(human, x));
    this.sfx.trade?.();
    // v0.86: a short Undo after the last pick, like after a build
    const order = item.order || [];
    if (order.length) this._setUndo({ kind: "gold", pid: human.id, picks: order, total, logs: this.logEntries.slice(logLen), icon: "gold", label: `Took ${order.map((x) => LBL[x]).join(" + ")}` });
    this.recomputeScores();
    if (this.rush) this._rushAfterAction(human);
    else { this.saveToStorage(); this.render(); }
  },

  /** A gold pick left open when the Rush roll comes: made for the human, as the `pickGold` action flagged auto (UiEngine._do_pickGold). */
  _goldAuto(player) {
    if (!this.sea?.goldFor(player.id)) return;
    this._goldStage = null;
    const r = this.api.dispatch({ actor: player.id, type: "pickGold", resources: this.sea.aiGoldPicks(player, this.sea.goldFor(player.id).count) }, { auto: true });
    if (!r.ok) this.sea.autoGold(player);
  },

  /** v0.86: a gold pick in progress with at least one card taken: the ticker's Cancel slot says Undo. */
  _seaGoldUndoable() {
    const human = this._me();
    const item = human && this.sea?.goldFor(human.id);
    return !!item && (this._goldStaged(human.id).length > 0 || !!item.order?.length);
  },

  /** Undo one gold pick (the last card taken goes back to the bank). */
  _seaGoldUndo() {
    const human = this._me();
    const staged = human ? this._goldStaged(human.id) : [];
    if (staged.length) { staged.pop(); this.sfx.click(); if (this.rush) this._rushAfterAction(human); else this.render(); return; }
    if (!human || !this.sea?.unpickGold(human)) { this.sfx.error?.(); return; }
    this.sfx.click();
    this.recomputeScores();
    if (this.rush) this._rushAfterAction(human);
    else { this.saveToStorage(); this.render(); }
  },

  /** Undo after the last gold pick: the cards go back and the pick opens again. */
  _seaUndoGold(u) {
    const p = this.players[u.pid];
    if (!p || !this.sea?.reopenGold(p, u.picks, u.total)) return false;
    if (u.logs?.length) this.logEntries = this.logEntries.filter((e) => !u.logs.includes(e));
    this.recomputeScores();
    return true;
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
    const staged = this._goldStaged(human.id), got = { ...(item.got || {}) };
    staged.forEach((r) => { got[r] = (got[r] || 0) + 1; });
    const stagedN = (r) => staged.filter((x) => x === r).length;
    const btns = RES.map((r) => tbtn(`data-gold="${r}" ${this.bank[r] - stagedN(r) > 0 ? "" : "disabled"}`, `<span class="card">${cardSvg(r)}</span><span>${LBL[r]}</span>${got[r] ? `<i class="pk">+${got[r]}</i>` : ""}`, `res${got[r] ? " sel" : ""}`)).join("");
    const total = this.sea.goldTotal(item); // v0.86: "Pick 2 · 0/2" → "1/2" (Undo sits in the ticker's Cancel slot)
    return { mode: "gold", hint: `Pick ${total} · ${total - item.count + staged.length}/${total}`, html: btns };
  },

  /** Seafarers trays for the player whose turn it is (null: not ours). */
  _seaTray(human, cur, tbtn, close) {
    const sea = this.sea;
    if (!sea) return null;
    const cb = this.confirmBuild;
    if (this.setupPhase && this.setupAction === "road" && this.lastSetupNodeId != null && cur.isHuman && !cb) {
      const node = this.geometry.nodes[this.lastSetupNodeId];
      const S = this.api.spots(cur.id);
      const roads = node.edgeIds.some((id) => S.road.has(id));
      const ships = node.edgeIds.some((id) => S.ship.has(id));
      if (roads && ships) {
        const on = sea.setupPiece;
        return { mode: "setupPiece", hint: on === "ship" ? "Tap a dotted spot on the water for your ship" : "Tap a road next to it · or start with a ship",
          html: tbtn(`data-setup-piece="road" aria-pressed="${on === "road"}"`, `${icon("road")}<span>Road</span>`, on === "road" ? "sel" : "")
            + tbtn(`data-setup-piece="ship" aria-pressed="${on === "ship"}"`, `${icon("ship")}<span>Ship</span>`, on === "ship" ? "sel" : "") };
      }
      return null;
    }
    if (this.pendingAction === "robber" && !cb && sea.thief == null && !this.robberVictimOptions?.length) {
      return { mode: "thief", hint: "7: Robber or Pirate?", // v0.96: step 1 of 3 (choose, tap a hex, steal)
        html: tbtn("data-thief=\"robber\"", `${icon("robber")}<span>Robber<small>on land</small></span>`, "wide")
          + tbtn("data-thief=\"pirate\"", `${icon("pirate")}<span>Pirate<small>on the sea</small></span>`, "wide") };
    }
    if (this.pendingAction === "moveShip" && sea.moveSel) {
      return { mode: "moveShip", hint: "Move ship: tap a dotted spot",
        html: `<div class="tinfo">${icon("ship")}<span>Move this ship<small>Tap a dotted spot · once a turn</small></span></div>`
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
