// 5–6 players: the bigger island, the extension's card counts and the Special Building Phase.
//
// Rules: CATAN 5–6 Player Extension (Catan Studio, 5th ed. rulebook): 11 more terrain hexes (1 desert,
// 2 each of fields/forest/pasture/mountains/hills) on top of the base 19 = 30 hexes in rows
// 3-4-5-6-5-4-3; 28 number tokens that replace the base set (2 and 12 twice, 3–6 and 8–11 three times);
// 2 more harbours (one 3:1, one 2:1 wool) = 11; 25 more resource cards (5 each) = 24 per resource;
// 9 more development cards (6 Knights, 1 Monopoly, 1 Year of Plenty, 1 Road Building) = 34.
// Special Building Phase: after each turn every other player, in turn order, may build or buy
// development cards with the cards in hand; no trading (players or bank/ports), no development cards played.
//
// The engine parts are a mixin on ColonistFullGame (installed by game.js), kept apart from the 4-player
// code so the classic game is untouched.

export const BIG_MIN_PLAYERS = 5;
export const BIG_BANK_SIZE = 24;
export const BIG_HEX_COUNT = 30;
export const BIG_RUSH_INTERVAL = 20; // Rush with 5–6: a roll every 20 s by default
export const SBP_WINDOW_MS = 8000;   // the human's build window closes by itself after this (paused while busy)

const BIG_RESOURCE_POOL = [
  ...Array(6).fill("wood"), ...Array(5).fill("brick"), ...Array(6).fill("sheep"),
  ...Array(6).fill("wheat"), ...Array(5).fill("ore"), "desert", "desert",
];
const BIG_NUMBERS = [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12];
const BIG_PORTS = ["any", "any", "any", "any", "any", "wood", "brick", "sheep", "sheep", "wheat", "ore"];
const BIG_DEV_DECK = { knight: 20, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3, victoryPoint: 5 };
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const COST = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  development: { sheep: 1, wheat: 1, ore: 1 },
};
const has = (hand, cost) => Object.entries(cost).every(([r, n]) => hand[r] >= n);
const pips = (n) => (n ? 6 - Math.abs(7 - n) : 0);

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A big table (5–6 players) plays on the 30-hex island. */
export const isBigTable = (players) => players >= BIG_MIN_PLAYERS;

/** Axial coordinates (pointy-top, rows = r) of the 30-hex island: rows of 3-4-5-6-5-4-3. */
export function bigAxialHexes() {
  const hexes = [];
  for (let r = -3; r <= 3; r += 1) {
    for (let q = -3; q <= 2; q += 1) {
      const s = q + r;
      if (s >= -3 && s <= 2) hexes.push({ q, r });
    }
  }
  return hexes;
}
/** The rows above are centred half a hex left of the origin: shift x by this many hex widths. */
export const BIG_CENTER_SHIFT = 0.5;

function neighbourSets(geometry) {
  const nb = geometry.hexes.map(() => new Set());
  geometry.edges.forEach((e) => {
    if (e.hexIds.length === 2) { nb[e.hexIds[0]].add(e.hexIds[1]); nb[e.hexIds[1]].add(e.hexIds[0]); }
  });
  return nb;
}

/** Terrain: no tile with two neighbours of its own kind (no clusters of three). */
function placeTerrain(geometry, nb) {
  let best = null;
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const pool = shuffled(BIG_RESOURCE_POOL);
    let bad = 0;
    for (let i = 0; i < pool.length && bad === 0; i += 1) {
      if (pool[i] === "desert") continue;
      let same = 0;
      nb[i].forEach((j) => { if (pool[j] === pool[i]) same += 1; });
      if (same >= 2) bad += 1;
    }
    best = pool;
    if (!bad) break;
  }
  geometry.hexes.forEach((h, i) => { h.resource = best[i]; h.number = null; });
}

/**
 * Number tokens by randomised backtracking. Always: 6 and 8 never touch. Strict (balanced map):
 * no equal numbers side by side and no 2 next to a 12.
 */
function placeNumbers(geometry, nb, strict) {
  const cells = geometry.hexes.filter((h) => h.resource !== "desert").map((h) => h.id);
  const counts = {};
  BIG_NUMBERS.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
  // most constrained first: the red numbers, then by neighbour count
  const assign = new Map();
  const ok = (id, n) => {
    for (const j of nb[id]) {
      const m = assign.get(j);
      if (m == null) continue;
      if (pips(n) === 5 && pips(m) === 5) return false;
      if (strict && (m === n || (pips(n) === 1 && pips(m) === 1))) return false;
    }
    return true;
  };
  const order = shuffled(cells);
  let steps = 0;
  const solve = (k) => {
    if (k === order.length) return true;
    if ((steps += 1) > 20000) return false;
    const id = order[k];
    // red numbers first while they last, so they get spread before the board fills up
    const nums = shuffled(Object.keys(counts).map(Number).filter((n) => counts[n] > 0))
      .sort((a, b) => (pips(b) === 5) - (pips(a) === 5));
    for (const n of nums) {
      if (!ok(id, n)) continue;
      counts[n] -= 1; assign.set(id, n);
      if (solve(k + 1)) return true;
      counts[n] += 1; assign.delete(id);
    }
    return false;
  };
  if (!solve(0)) {
    // practically never: fall back to a plain shuffle (6/8 rule only best-effort)
    assign.clear();
    shuffled(BIG_NUMBERS).forEach((n, i) => assign.set(cells[i], n));
  }
  cells.forEach((id) => { geometry.hexes[id].number = assign.get(id); });
}

/**
 * Tiles for the 30-hex island. "random": terrain without clusters of three, 6/8 apart. "balanced"
 * (and "beginner", which has no official 5–6 layout): also no equal or 2/12 neighbours and every
 * resource's average pips close to the board average. Returns the robber's starting (desert) hex id.
 */
export function assignBigTiles(geometry, mapMode = "random") {
  const nb = neighbourSets(geometry);
  if (mapMode === "random") {
    placeTerrain(geometry, nb);
    placeNumbers(geometry, nb, false);
  } else {
    const total = BIG_NUMBERS.reduce((a, n) => a + pips(n), 0);
    const avg = total / BIG_NUMBERS.length;
    let best = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      placeTerrain(geometry, nb);
      placeNumbers(geometry, nb, true);
      const p = {};
      const c = {};
      geometry.hexes.forEach((h) => {
        if (h.resource === "desert") return;
        p[h.resource] = (p[h.resource] || 0) + pips(h.number);
        c[h.resource] = (c[h.resource] || 0) + 1;
      });
      let score = 0;
      let maxDev = 0;
      RES.forEach((r) => { const d = Math.abs(p[r] / c[r] - avg); score += d * d; maxDev = Math.max(maxDev, d); });
      if (score < bestScore) { bestScore = score; best = geometry.hexes.map((h) => ({ resource: h.resource, number: h.number })); }
      if (maxDev <= 0.5) break;
    }
    geometry.hexes.forEach((h, i) => { h.resource = best[i].resource; h.number = best[i].number; });
  }
  const deserts = geometry.hexes.filter((h) => h.resource === "desert");
  return deserts[Math.floor(Math.random() * deserts.length)].id;
}

/** 11 harbours, evenly spaced around the coast: five 3:1, two wool 2:1, one 2:1 of every other kind. */
export function assignBigPorts(geometry) {
  const coastal = geometry.edges.filter((e) => e.hexIds.length === 1);
  const cx = geometry.centerX;
  const cy = geometry.centerY;
  coastal.forEach((e) => {
    const a = geometry.nodes[e.nodes[0]];
    const b = geometry.nodes[e.nodes[1]];
    e._angle = Math.atan2((a.y + b.y) / 2 - cy, (a.x + b.x) / 2 - cx);
  });
  coastal.sort((a, b) => a._angle - b._angle);
  const n = BIG_PORTS.length;
  const step = coastal.length / n;
  const offset = Math.floor(Math.random() * Math.floor(step));
  const types = shuffled(BIG_PORTS);
  const ports = [];
  for (let i = 0; i < n; i += 1) {
    const edge = coastal[Math.floor(offset + i * step) % coastal.length];
    ports.push({ edgeId: edge.id, type: types[i], nodes: edge.nodes });
    edge.nodes.forEach((id) => geometry.nodes[id].ports.push(types[i]));
  }
  return ports;
}

/** 34 development cards: 20 Knights, 3 Road Building, 3 Year of Plenty, 3 Monopoly, 5 Victory Points. */
export function createBigDevDeck() {
  return shuffled(Object.entries(BIG_DEV_DECK).flatMap(([k, n]) => Array(n).fill(k)));
}

// ══ Special Building Phase (engine + bots) ════════════════════════════════════════════════════
// State while it runs (phase "sbp"): this.sbp = { after: id whose turn just ended, order: [ids of the
// others, clockwise from the next player], pos: index of the builder now, log: [{ id, what }] }.
// currentPlayerIndex is the builder (so the normal build code applies to the human's window);
// the player strip keeps the turn ring on `after`. Nobody can win during it (only on their own turn).

const AI_SBP_MAX_ACTIONS = 6;

export const SbpMixin = {
  /** 5–6 players, Classic: the Special Building Phase runs between turns. */
  _sbpEnabled() {
    return !this.isRush() && isBigTable(this.players?.length || 0);
  },

  /** The seat whose turn it is (during the build window: whoever just ended theirs). */
  _turnOwnerIndex() {
    return this.sbp ? this.sbp.after : this.currentPlayerIndex;
  },

  /** endTurn() hook: start the build phase after `owner`'s turn. False when it does not apply. */
  _sbpBegin(owner) {
    if (!this._sbpEnabled() || this.winner) return false;
    const n = this.players.length;
    const order = [];
    for (let k = 1; k < n; k += 1) order.push((owner.id + k) % n);
    this.sbp = { after: owner.id, order, pos: 0, log: [] };
    this.sbpRecent = null;
    this.phase = "sbp";
    this._sbpRun();
    return true;
  },

  /** Can the human take part: some build or a card is affordable and placeable right now? */
  _sbpCanAct(player) {
    if (this.devDeck.length > 0 && has(player.resources, COST.development)) return true;
    return this._sbpCanPlace(player);
  },
  _sbpCanPlace(player) {
    const g = this.geometry;
    if (has(player.resources, COST.city) && [...player.settlements].some((id) => this.canBuildCity(player, id, false))) return true;
    if (has(player.resources, COST.settlement) && g.nodes.some((nd) => this.canBuildSettlement(player, nd.id, false))) return true;
    return has(player.resources, COST.road) && g.edges.some((e) => this.canBuildRoad(player, e.id));
  },

  /** Run builders in order until the human's window opens (waits) or everyone has had a go. */
  _sbpRun() {
    const s = this.sbp;
    if (!s || this.winner) return;
    this.phase = "sbp";
    this._sbpQuiet = true; // bots' builds become one summary line (no toast per piece)
    const logLen = this.logEntries.length;
    try {
      while (s.pos < s.order.length) {
        const p = this.players[s.order[s.pos]];
        this.currentPlayerIndex = p.id;
        if (this._isInteractive(p)) {
          if (s.human) return; // your window is already open
          if (this._sbpCanAct(p)) {
            this._sbpQuiet = false;
            this._sbpFlushLog(logLen);
            this._sbpOpenWindow(p);
            return;
          }
        } else {
          if (s.human) { delete s.human; this._sbpStopTimer(); } // "Watch bots play" took over your window
          this._aiSpecialBuild(p);
          this._sbpMature(p);
        }
        s.pos += 1;
      }
    } finally {
      this._sbpQuiet = false;
    }
    this._sbpFlushLog(logLen);
    this._sbpFinish();
  },

  /** Cards bought in the build window are playable from the buyer's next turn. */
  _sbpMature(player) {
    ["knight", "roadBuilding", "yearOfPlenty", "monopoly"].forEach((t) => {
      player.devCards[t] += player.newDevCards[t];
      player.newDevCards[t] = 0;
    });
  },

  /** Replace the bots' per-piece log lines with one line: "Build window: Nora built a road, Hugo bought a card." */
  _sbpFlushLog(logLen) {
    const s = this.sbp;
    const fresh = this.logEntries.splice(logLen);
    if (!fresh.length) return;
    const per = new Map();
    const other = [];
    fresh.forEach((e) => {
      const m = /^(.+?) (built a road|built a settlement|upgraded to a city|bought a development card)\.$/.exec(e.text);
      const p = m && this.players.find((q) => q.name === m[1]);
      if (!p || p.isHuman) { other.push(e); return; }
      const k = { "built a road": "road", "built a settlement": "settlement", "upgraded to a city": "city", "bought a development card": "card" }[m[2]];
      if (!per.has(p.id)) per.set(p.id, { road: 0, settlement: 0, city: 0, card: 0 });
      per.get(p.id)[k] += 1;
    });
    this.logEntries.push(...other);
    if (!per.size) return;
    const say = (c) => {
      const parts = [];
      if (c.road) parts.push(`built ${c.road === 1 ? "a road" : `${c.road} roads`}`);
      if (c.settlement) parts.push(`built ${c.settlement === 1 ? "a settlement" : `${c.settlement} settlements`}`);
      if (c.city) parts.push(c.city === 1 ? "upgraded to a city" : `built ${c.city} cities`);
      if (c.card) parts.push(`bought ${c.card === 1 ? "a card" : `${c.card} cards`}`);
      return parts.join(" and ");
    };
    const line = [...per.entries()].map(([id, c]) => `${this.players[id].name} ${say(c)}`).join(", ");
    per.forEach((c, id) => s?.log.push({ id, ...c }));
    this.addLog(`Build window: ${line}.`, { sbp: true });
  },

  /** Everyone has had their go: the next player's turn starts. */
  _sbpFinish() {
    const s = this.sbp;
    if (!s) return;
    this.sbpRecent = { after: s.after, seats: [...new Set(s.log.map((x) => x.id))] };
    this.sbp = null;
    this._sbpStopTimer();
    this.pendingAction = null;
    this.confirmBuild = null;
    this.trayMode = null;
    this._dropUndo();
    this.currentPlayerIndex = s.after;
    this.phase = "main";
    this._advanceTurn();
  },

  // ── the human's window ──
  _sbpOpenWindow(player) {
    const s = this.sbp;
    this.currentPlayerIndex = player.id;
    this.phase = "sbp";
    this.pendingAction = null;
    this.confirmBuild = null;
    this.trayMode = null;
    s.human = { leftMs: SBP_WINDOW_MS, built: false };
    this._sbpStartTimer();
    this.sfx.yourTurn?.();
    this.saveToStorage();
    this.render();
  },

  /** The window is "busy" while you pick or place something: the countdown waits. */
  _sbpBusy() {
    return !!(this.pendingAction || this.confirmBuild || this.trayMode || this.undoState || this.uiPaused
      || this.onboardingHold || document.hidden || document.querySelector(".newgame-modal"));
  },

  _sbpStartTimer() {
    this._sbpStopTimer();
    this._sbpLastTs = performance.now();
    const tick = () => {
      const s = this.sbp;
      if (!s?.human || this.winner) return;
      const now = performance.now();
      const dt = Math.min(1000, now - this._sbpLastTs);
      this._sbpLastTs = now;
      if (!this._sbpBusy()) s.human.leftMs -= dt;
      this._sbpPaintTimer();
      if (s.human.leftMs <= 0) { this._sbpTimerId = null; this.sbpSkip(true); return; }
      this._sbpTimerId = this._later(tick, 200);
    };
    this._sbpTimerId = this._later(tick, 200);
  },
  _sbpStopTimer() {
    if (this._sbpTimerId) { window.clearTimeout(this._sbpTimerId); this._timers?.delete(this._sbpTimerId); }
    this._sbpTimerId = null;
  },

  /** Skip / Done (or the timer ran out): the next builder, then the next turn. */
  sbpSkip(timedOut = false) {
    const s = this.sbp;
    if (!s?.human || this.winner) return;
    const p = this.currentPlayer;
    this._sbpStopTimer();
    this._dropUndo();
    if (this.pendingAction && this.pendingAction !== "robber") this.pendingAction = null;
    this.confirmBuild = null;
    this.trayMode = null;
    this.canvas.style.cursor = "grab";
    this._sbpMature(p);
    if (!s.human.built && !timedOut) this.sfx.click?.();
    delete s.human;
    s.pos += 1;
    this._sbpRun();
    this.saveToStorage();
    this.render();
    if (!this.winner && !this.currentPlayer.isHuman) this.scheduleAiTurnsUntilHuman();
  },

  /** After you build in the window: the clock starts over (time to undo or build again). */
  _sbpAfterHumanBuild() {
    const s = this.sbp;
    if (!s?.human) return;
    s.human.built = true;
    s.human.leftMs = SBP_WINDOW_MS;
  },

  /** A saved game resumes inside the build window. */
  _sbpResume() {
    const s = this.sbp;
    if (!s) return;
    const p = this.currentPlayer;
    if (this._isInteractive(p)) {
      if (s.human || this._sbpCanAct(p)) { this._sbpOpenWindow(p); return; }
      s.pos += 1;
      delete s.human;
      this._sbpRun();
      this.render();
    }
    if (!this.winner && !this.currentPlayer.isHuman) this.scheduleAiTurnsUntilHuman();
  },

  // ── bots ──
  /**
   * A bot's go in the build window: build whatever its plan wants that it can pay for now; a build
   * off the plan only when it doesn't delay the plan (or when holding more than the discard limit).
   * Development cards only as its devCards level allows. Never trades, never plays a card.
   */
  _aiSpecialBuild(player) {
    const s = this._aiStrat(player);
    for (let k = 0; k < AI_SBP_MAX_ACTIONS && !this.winner; k += 1) {
      const acted = s.expansion === "simple" ? this._aiSbpSimpleStep(player, s) : this._aiSbpPlannedStep(player);
      if (!acted) break;
    }
  },

  _aiSbpSimpleStep(player, s) {
    if (this.tryBuildSettlement(player)) return true;
    if (this.tryBuildCity(player)) return true;
    if (this.tryBuildRoad(player)) return true;
    return s.devCards !== "none" && this.devDeck.length > 0 && has(player.resources, COST.development) && this.buyDevelopmentCard(player);
  },

  _aiSbpPlannedStep(player) {
    const plan = this._aiPlan(player);
    const [goal, ...rest] = plan.goals;
    if (!goal) return false;
    if (has(player.resources, this._aiStepCost(goal)) && this._aiTryGoal(player, goal)) return true;
    const over = this._aiOverLimit(player);
    for (const side of rest) {
      const step = this._aiStepCost(side);
      if (!has(player.resources, step)) continue;
      const after = { ...player.resources };
      Object.entries(step).forEach(([r, n]) => { after[r] -= n; });
      const delay = this._aiEta(goal.cost, after, plan.incTurn, plan.rates) - goal.eta;
      if ((delay <= plan.W.sideBuildDelay || over) && this._aiTryGoal(player, side)) return true;
    }
    return false;
  },
};
