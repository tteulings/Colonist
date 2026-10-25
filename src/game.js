import { THEMES, storedThemeId, saveThemeId, loadFonts, installSprite, applyMotionAttr, icon, avatarSvg, dieSvg, cardSvg, motionReduced } from "./themes/manager.js";
import { SvgBoardRenderer } from "./themes/board-renderer.js";
import { Fx } from "./themes/fx.js";
import { SettingsUI, renderQuickToggle } from "./themes/settings-ui.js";
import { TERRAIN_NAME, DEV_NAME, CARD_TEXT } from "./themes/art-util.js";

const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
/** Sunny Island colour palette from <html data-palette> (default light). */
const currentPalette = () => (document.documentElement.dataset.palette === "vivid" ? "vivid" : "light");
const RESOURCE_SHORT = { wood: "Wd", brick: "Br", sheep: "Sh", wheat: "Wh", ore: "Or" };
// Glossary names (shared/glossary.md): cards are Lumber / Brick / Wool / Grain / Ore
const RESOURCE_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const RESOURCE_ICON_PATH = {
  wood: "./assets/icons/resource-wood-v2.svg",
  brick: "./assets/icons/resource-brick-v2.svg",
  sheep: "./assets/icons/resource-sheep-v2.svg",
  wheat: "./assets/icons/resource-wheat-v2.svg",
  ore: "./assets/icons/resource-ore-v2.svg",
};
const RESOURCE_COLORS = {
  wood: "#4a7c3f",
  brick: "#c66536",
  sheep: "#7ec850",
  wheat: "#d9bc52",
  ore: "#8b96a8",
  desert: "#d6c28e",
};

const DICE_WEIGHT = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  development: { sheep: 1, wheat: 1, ore: 1 },
};

const BANK_SIZE = 19; // cards of each resource in the game
const PIECE_LIMITS = { road: 15, settlement: 5, city: 4 };

const PLAYER_CONFIG = [
  { name: "You", color: "#e63946", isHuman: true, avatar: "./assets/avatars/avatar-human.svg?v=57" },
  { name: "Marina", color: "#2a6fdb", isHuman: false, avatar: "./assets/avatars/avatar-pioneer.svg?v=57" },
  { name: "Bruno", color: "#e8a317", isHuman: false, avatar: "./assets/avatars/avatar-sage.svg?v=57" },
  { name: "Viktor", color: "#2db87e", isHuman: false, avatar: "./assets/avatars/avatar-vector.svg?v=57" },
];

const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const SQRT3 = Math.sqrt(3);
const BOARD_RADIUS = 2;
// Layout breakpoints (keep in sync with themes/base.css): phones = narrow OR short (landscape)
const MOBILE_MQ = "(max-width: 900px), (max-height: 500px)";
const LANDSCAPE_MQ = "(max-height: 500px) and (orientation: landscape)";
const TURN_LIMIT = 500;

// ── AI Strategy Configuration ──────────────────────────────────────────
const AI_STRATEGY_CATEGORIES = {
  placement: {
    label: "Placement",
    levels: ["simple", "medium", "complex"],
    descriptions: {
      simple:  "Picks spots with highest dice probability only",
      medium:  "Weighs scarcity, diversity, ports, and blocking",
      complex: "Also targets missing resources, specific ports, avoids robber magnets",
    },
  },
  expansion: {
    label: "Expansion",
    levels: ["simple", "medium", "complex"],
    descriptions: {
      simple:  "Builds roads to nearest good spot",
      medium:  "Pathfinds to best reachable settlement location",
      complex: "Also hunts Longest Road and targets valuable ports",
    },
  },
  trading: {
    label: "Trading",
    levels: ["none", "conservative", "balanced", "aggressive"],
    descriptions: {
      none:         "Never trades",
      conservative: "Bank trades only, keeps a resource buffer",
      balanced:     "Bank + player trades when clearly beneficial",
      aggressive:   "Trades often, accepts marginal deals, offers 2-for-1",
    },
  },
  devCards: {
    label: "Dev Cards",
    levels: ["none", "reactive", "strategic"],
    descriptions: {
      none:      "Never buys or plays dev cards",
      reactive:  "Buys when affordable, plays when obviously useful",
      strategic: "Chases Largest Army, times Monopoly for max steal, saves cards",
    },
  },
  awareness: {
    label: "Awareness",
    levels: ["none", "basic", "advanced"],
    descriptions: {
      none:     "Ignores other players entirely, random robber placement",
      basic:    "Targets opponents with robber, won't help near-winners",
      advanced: "Targets VP leader, steals from leader, shifts priorities near endgame",
    },
  },
};

const AI_PRESETS = {
  beginner:     { placement: "simple",  expansion: "simple",  trading: "none",         devCards: "none",     awareness: "none" },
  intermediate: { placement: "medium",  expansion: "medium",  trading: "balanced",     devCards: "reactive", awareness: "basic" },
  expert:       { placement: "complex", expansion: "complex", trading: "aggressive",   devCards: "strategic", awareness: "advanced" },
  trader:       { placement: "medium",  expansion: "medium",  trading: "aggressive",   devCards: "reactive", awareness: "basic" },
  builder:      { placement: "complex", expansion: "complex", trading: "balanced",     devCards: "reactive", awareness: "basic" },
  shark:        { placement: "medium",  expansion: "medium",  trading: "balanced",     devCards: "strategic", awareness: "advanced" },
};

// Player-facing names, short taglines and badge glyphs for the presets ("custom" = hand-tuned mix)
const AI_PRESET_INFO = {
  beginner:     { label: "Beginner",     tagline: "gentle, learns rules", glyph: "" },
  intermediate: { label: "Intermediate", tagline: "solid all-rounder",    glyph: "" },
  expert:       { label: "Expert",       tagline: "plays to win",         glyph: "" },
  trader:       { label: "Trader",       tagline: "deals all game",       glyph: "\u21c4", isNew: true },
  builder:      { label: "Builder",      tagline: "roads & cities",       glyph: "\u2692", isNew: true },
  shark:        { label: "Shark",        tagline: "hunts the leader",     glyph: "\u25b2", isNew: true },
  custom:       { label: "Custom",       tagline: "your mix",             glyph: "" },
};

// Plain-language one-liners for each AI level, shown in the new-game screen
const AI_LEVEL_PLAIN = {
  placement: {
    simple:  "settles on the biggest numbers and ignores the rest.",
    medium:  "picks good numbers but also mixes resources and grabs useful ports.",
    complex: "also plans for resources it lacks, eyes 2:1 ports and dodges robber magnets.",
  },
  expansion: {
    simple:  "builds roads toward the nearest open spot.",
    medium:  "plans roads toward the best free spot it can reach.",
    complex: "also races for Longest Road and valuable ports.",
  },
  trading: {
    none:         "never trades.",
    conservative: "trades with the bank only, and keeps a safety buffer.",
    balanced:     "trades with you or the bank only when it clearly helps.",
    aggressive:   "trades constantly and takes marginal deals.",
  },
  devCards: {
    none:      "never buys development cards.",
    reactive:  "buys when it can, plays a card when the use is obvious.",
    strategic: "chases Largest Army and times Monopoly for the biggest haul.",
  },
  awareness: {
    none:     "ignores other players; robber goes anywhere.",
    basic:    "robs opponents, won't trade with someone about to win.",
    advanced: "targets the leader and shifts gear near the end.",
  },
};
const AI_LEVEL_LABEL = { conservative: "Careful", aggressive: "Eager" };
const AI_DIMENSION_HINT = {
  placement: "where it settles", expansion: "how it grows", trading: "how deal-happy",
  devCards: "knights, monopoly…", awareness: "watches others",
};

const DEFAULT_AI_STRATEGY = { ...AI_PRESETS.intermediate };

// ── Game settings (new-game screen) ──
const DEFAULT_SETTINGS = {
  mode: "classic",          // "classic" | "rush"
  winPoints: 10,            // 5-15
  discardLimit: 7,          // 7-12: holding more than this on a 7 discards half
  friendlyRobber: false,    // robber can't hit players with <= 2 public VP
  dice: "random",           // "random" | "balanced" | "deck"
  map: "random",            // "random" | "balanced" | "beginner"
  numBots: 3,               // 1-3
  rushInterval: 15,         // seconds between automatic rolls (Rush)
  botStyleMode: "all",      // "all" | "each"
  allPreset: "intermediate",// preset applied to every bot ("custom" when hand-tuned)
  allStrategy: { ...AI_PRESETS.intermediate },
  perBot: ["builder", "trader", "shark"],
};
const RUSH_INTERVALS = [10, 15, 20, 30];
const RUSH_DISCARD_SECONDS = 20;
const RUSH_ROBBER_SECONDS = 30;
const FRIENDLY_ROBBER_VP = 2;

function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.mode = s.mode === "rush" ? "rush" : "classic";
  s.winPoints = clamp(Math.round(Number(s.winPoints)) || 10, 5, 15);
  s.discardLimit = clamp(Math.round(Number(s.discardLimit)) || 7, 7, 12);
  s.friendlyRobber = !!s.friendlyRobber;
  if (!["random", "balanced", "deck"].includes(s.dice)) s.dice = "random";
  if (!["random", "balanced", "beginner"].includes(s.map)) s.map = "random";
  s.numBots = clamp(Math.round(Number(s.numBots)) || 3, 1, 3);
  if (!RUSH_INTERVALS.includes(Number(s.rushInterval))) s.rushInterval = 15;
  s.rushInterval = Number(s.rushInterval);
  s.botStyleMode = s.botStyleMode === "each" ? "each" : "all";
  if (!AI_PRESET_INFO[s.allPreset]) s.allPreset = "intermediate";
  const strat = { ...DEFAULT_AI_STRATEGY, ...(s.allStrategy || {}) };
  Object.keys(AI_STRATEGY_CATEGORIES).forEach((k) => {
    if (!AI_STRATEGY_CATEGORIES[k].levels.includes(strat[k])) strat[k] = DEFAULT_AI_STRATEGY[k];
  });
  s.allStrategy = strat;
  const per = Array.isArray(s.perBot) ? s.perBot : [];
  s.perBot = [0, 1, 2].map((i) => (AI_PRESETS[per[i]] ? per[i] : DEFAULT_SETTINGS.perBot[i]));
  return s;
}

// Which preset (if any) a strategy object matches exactly
function presetForStrategy(strategy) {
  if (!strategy) return null;
  const keys = Object.keys(AI_STRATEGY_CATEGORIES);
  const match = Object.entries(AI_PRESETS).find(([, p]) => keys.every((k) => p[k] === strategy[k]));
  return match ? match[0] : "custom";
}

// All 36 ordered two-dice outcomes, shuffled (balanced dice / event deck)
function createDiceDeck() {
  const cards = [];
  for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) cards.push([a, b]);
  return shuffle(cards);
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeEmptyResources() {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

function makeFullBank() {
  return Object.fromEntries(RESOURCES.map((r) => [r, BANK_SIZE]));
}

function makeEmptyDevCards() {
  return { knight: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 };
}

function sumResources(resources) {
  return RESOURCES.reduce((acc, resource) => acc + resources[resource], 0);
}

function resourceString(resources) {
  const parts = RESOURCES.filter(r => resources[r] > 0).map(r => `${resources[r]} ${RESOURCE_LABEL[r]}`);
  return parts.length ? parts.join(", ") : "nothing";
}

function copyResources(resources) {
  const copy = makeEmptyResources();
  RESOURCES.forEach((r) => {
    copy[r] = resources[r];
  });
  return copy;
}

function hasResources(resources, cost) {
  return Object.entries(cost).every(([type, amount]) => resources[type] >= amount);
}

function missingCostString(resources, cost) {
  const missing = Object.entries(cost)
    .map(([type, amount]) => {
      const deficit = Math.max(0, amount - resources[type]);
      if (deficit <= 0) return null;
      return `${deficit} ${RESOURCE_LABEL[type]}`;
    })
    .filter(Boolean);
  return missing.length ? missing.join(", ") : "";
}

function payCost(resources, cost) {
  Object.entries(cost).forEach(([type, amount]) => {
    resources[type] -= amount;
  });
}

function pointKey(point) {
  return `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function axialToPixel(q, r, size, cx, cy) {
  return {
    x: cx + size * SQRT3 * (q + r / 2),
    y: cy + size * 1.5 * r,
  };
}

function getHexCorners(center, size) {
  const corners = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

function createAxialHexes(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      const s = -q - r;
      if (Math.abs(s) <= radius) {
        hexes.push({ q, r });
      }
    }
  }
  return hexes;
}

function createBoardGeometry(canvasWidth, canvasHeight) {
  const aspect = canvasWidth / canvasHeight;
  // On tall screens (mobile portrait), allow larger hexes by loosening the width constraint
  const wDiv = aspect < 1 ? 11 : 14.5;
  const hDiv = aspect < 1 ? 7.6 : 8.2;
  const hexSize = Math.min(canvasWidth / wDiv, canvasHeight / hDiv);
  const centerX = canvasWidth * 0.46;
  const centerY = canvasHeight * 0.5;

  const nodeByKey = new Map();
  const edgeByKey = new Map();
  const nodes = [];
  const edges = [];
  const hexes = [];

  const createNode = (point) => {
    const key = pointKey(point);
    if (nodeByKey.has(key)) return nodeByKey.get(key);
    const id = nodes.length;
    nodes.push({
      id,
      x: point.x,
      y: point.y,
      owner: null,
      structure: null,
      adjacentHexes: [],
      edgeIds: [],
      neighbors: [],
      ports: [],
    });
    nodeByKey.set(key, id);
    return id;
  };

  const createEdge = (a, b) => {
    const key = edgeKey(a, b);
    if (edgeByKey.has(key)) return edgeByKey.get(key);
    const id = edges.length;
    edges.push({ id, nodes: [a, b], owner: null, hexIds: [] });
    edgeByKey.set(key, id);
    nodes[a].edgeIds.push(id);
    nodes[b].edgeIds.push(id);
    return id;
  };

  for (const axial of createAxialHexes(BOARD_RADIUS)) {
    const center = axialToPixel(axial.q, axial.r, hexSize, centerX, centerY);
    const corners = getHexCorners(center, hexSize);
    const nodeIds = corners.map(createNode);
    const edgeIds = [];
    const hexId = hexes.length;
    for (let i = 0; i < 6; i += 1) {
      const edgeId = createEdge(nodeIds[i], nodeIds[(i + 1) % 6]);
      edgeIds.push(edgeId);
      if (!edges[edgeId].hexIds.includes(hexId)) {
        edges[edgeId].hexIds.push(hexId);
      }
    }
    nodeIds.forEach((nodeId) => nodes[nodeId].adjacentHexes.push(hexId));
    hexes.push({
      id: hexId,
      q: axial.q,
      r: axial.r,
      center,
      corners,
      nodes: nodeIds,
      edges: edgeIds,
      resource: null,
      number: null,
    });
  }

  edges.forEach((edge) => {
    const [a, b] = edge.nodes;
    if (!nodes[a].neighbors.includes(b)) nodes[a].neighbors.push(b);
    if (!nodes[b].neighbors.includes(a)) nodes[b].neighbors.push(a);
  });

  return { hexSize, centerX, centerY, hexes, nodes, edges };
}

// Official beginner layout, rows top to bottom (pointy-top hexes, rows = axial r)
const BEGINNER_LAYOUT = [
  ["ore", 10], ["sheep", 2], ["wood", 9],
  ["wheat", 12], ["brick", 6], ["sheep", 4], ["brick", 10],
  ["wheat", 9], ["wood", 11], ["desert", null], ["wood", 3], ["ore", 8],
  ["wood", 8], ["ore", 3], ["wheat", 4], ["sheep", 5],
  ["brick", 5], ["wheat", 6], ["sheep", 11],
];

function hexNeighborSets(geometry) {
  const hexNeighbors = geometry.hexes.map(() => new Set());
  geometry.edges.forEach((edge) => {
    if (edge.hexIds.length === 2) {
      hexNeighbors[edge.hexIds[0]].add(edge.hexIds[1]);
      hexNeighbors[edge.hexIds[1]].add(edge.hexIds[0]);
    }
  });
  return hexNeighbors;
}

// Map setting: "random" | "balanced" | "beginner". Returns the robber (desert) hex id.
function assignTiles(geometry, mapMode = "random") {
  if (mapMode === "beginner") {
    const ordered = [...geometry.hexes].sort((a, b) => a.r - b.r || a.q - b.q);
    let desertId = 0;
    ordered.forEach((hex, i) => {
      hex.resource = BEGINNER_LAYOUT[i][0];
      hex.number = BEGINNER_LAYOUT[i][1];
      if (hex.resource === "desert") desertId = hex.id;
    });
    return desertId;
  }
  if (mapMode === "balanced") return assignBalancedTiles(geometry);
  return assignRandomTiles(geometry);
}

// Pips (number of dice combos out of 36) per number token
function tokenPips(number) {
  return number ? 6 - Math.abs(7 - number) : 0;
}

// Fair map: no adjacent 6/8, no adjacent equal numbers or 2/12, no 3 same tiles in a cluster,
// and every resource's pips close to its fair share (no resource hogs the good numbers).
function assignBalancedTiles(geometry) {
  const hexNeighbors = hexNeighborSets(geometry);
  let best = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    assignRandomTiles(geometry);
    const hexes = geometry.hexes;
    // Hard constraints on number placement
    let ok = true;
    for (const hex of hexes) {
      if (!hex.number) continue;
      for (const nid of hexNeighbors[hex.id]) {
        const n = hexes[nid].number;
        if (!n) continue;
        if (n === hex.number || (tokenPips(n) === 1 && tokenPips(hex.number) === 1)) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) continue;
    // Pip spread: each resource's average pips per tile vs the board average (58 / 18)
    const pips = {};
    const counts = {};
    hexes.forEach((hex) => {
      if (hex.resource === "desert") return;
      pips[hex.resource] = (pips[hex.resource] || 0) + tokenPips(hex.number);
      counts[hex.resource] = (counts[hex.resource] || 0) + 1;
    });
    const avg = 58 / 18;
    let score = 0;
    let maxDev = 0;
    RESOURCES.forEach((r) => {
      const dev = Math.abs(pips[r] / counts[r] - avg);
      score += dev * dev;
      maxDev = Math.max(maxDev, dev);
    });
    if (score < bestScore) {
      bestScore = score;
      best = hexes.map((h) => ({ resource: h.resource, number: h.number }));
    }
    if (maxDev <= 0.6) break;
  }
  let desertId = 0;
  if (best) {
    geometry.hexes.forEach((hex, i) => {
      hex.resource = best[i].resource;
      hex.number = best[i].number;
    });
  }
  geometry.hexes.forEach((hex) => { if (hex.resource === "desert") desertId = hex.id; });
  return desertId;
}

function assignRandomTiles(geometry) {
  const resourcePool = [
    "wood", "wood", "wood", "wood",
    "brick", "brick", "brick",
    "sheep", "sheep", "sheep", "sheep",
    "wheat", "wheat", "wheat", "wheat",
    "ore", "ore", "ore",
    "desert",
  ];

  // Build hex adjacency map via shared edges
  const hexNeighbors = geometry.hexes.map(() => new Set());
  geometry.edges.forEach((edge) => {
    if (edge.hexIds.length === 2) {
      hexNeighbors[edge.hexIds[0]].add(edge.hexIds[1]);
      hexNeighbors[edge.hexIds[1]].add(edge.hexIds[0]);
    }
  });

  // Shuffle resources with constraint: no 3+ adjacent tiles of same resource
  let robberHexId = 0;
  for (let attempt = 0; attempt < 300; attempt++) {
    const resources = shuffle([...resourcePool]);
    let valid = true;
    // Assign temporarily
    geometry.hexes.forEach((hex, idx) => {
      hex.resource = resources[idx];
    });
    // Check: for each hex, count how many neighbors share the same resource
    for (let i = 0; i < geometry.hexes.length; i++) {
      const res = geometry.hexes[i].resource;
      if (res === "desert") continue;
      let sameCount = 0;
      for (const nid of hexNeighbors[i]) {
        if (geometry.hexes[nid].resource === res) sameCount++;
      }
      // If a hex has 2+ neighbors of the same type, it forms a cluster of 3
      if (sameCount >= 2) { valid = false; break; }
    }
    if (valid) break;
  }

  geometry.hexes.forEach((hex, idx) => {
    if (hex.resource === "desert") {
      hex.number = null;
      robberHexId = idx;
    }
  });

  // Assign numbers ensuring 6 and 8 are never adjacent
  const numbers = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const nonDesertHexIds = geometry.hexes.filter(h => h.resource !== "desert").map(h => h.id);

  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = shuffle([...numbers]);
    let valid = true;
    nonDesertHexIds.forEach((hexId, i) => {
      geometry.hexes[hexId].number = shuffled[i];
    });
    for (const hexId of nonDesertHexIds) {
      const num = geometry.hexes[hexId].number;
      if (num !== 6 && num !== 8) continue;
      for (const neighborId of hexNeighbors[hexId]) {
        const nNum = geometry.hexes[neighborId].number;
        if (nNum === 6 || nNum === 8) { valid = false; break; }
      }
      if (!valid) break;
    }
    if (valid) break;
  }

  return robberHexId;
}

function assignPorts(geometry) {
  const coastalEdges = geometry.edges.filter((edge) => edge.hexIds.length === 1);

  // Sort coastal edges by angle from center for even spacing
  const cx = geometry.centerX;
  const cy = geometry.centerY;
  coastalEdges.forEach(edge => {
    const p1 = geometry.nodes[edge.nodes[0]];
    const p2 = geometry.nodes[edge.nodes[1]];
    edge._angle = Math.atan2((p1.y + p2.y) / 2 - cy, (p1.x + p2.x) / 2 - cx);
  });
  coastalEdges.sort((a, b) => a._angle - b._angle);

  // Pick 9 evenly spaced edges around the coast
  const totalCoastal = coastalEdges.length;
  const step = totalCoastal / 9;
  const offset = Math.floor(Math.random() * Math.floor(step));
  const chosen = [];
  for (let i = 0; i < 9; i++) {
    const idx = Math.floor(offset + i * step) % totalCoastal;
    chosen.push(coastalEdges[idx]);
  }

  const portTypes = shuffle(["any", "any", "any", "any", "wood", "brick", "sheep", "wheat", "ore"]);
  const ports = [];
  chosen.forEach((edge, idx) => {
    const type = portTypes[idx];
    ports.push({ edgeId: edge.id, type, nodes: edge.nodes });
    edge.nodes.forEach((nodeId) => {
      geometry.nodes[nodeId].ports.push(type);
    });
  });
  return ports;
}

function createDevelopmentDeck() {
  return shuffle([
    ...Array(14).fill("knight"),
    ...Array(2).fill("roadBuilding"),
    ...Array(2).fill("yearOfPlenty"),
    ...Array(2).fill("monopoly"),
    ...Array(5).fill("victoryPoint"),
  ]);
}

function chooseRandomWeighted(candidates) {
  const total = candidates.reduce((acc, c) => acc + c.weight, 0);
  if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
  let value = Math.random() * total;
  for (const candidate of candidates) {
    value -= candidate.weight;
    if (value <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const x = x1 + clamped * dx;
  const y = y1 + clamped * dy;
  return Math.hypot(px - x, py - y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

class ColonistFullGame {
  constructor() {
    this.canvas = document.querySelector("#board");
    this.ctx = this.canvas.getContext("2d");
    this.logContainer = document.querySelector("#log");
    this.railLog = document.querySelector("#railLog");
    this.logToggle = document.querySelector("#logToggle");
    this.scoreboard = document.querySelector("#scoreboard");
    this.toastStack = document.querySelector("#toastStack");
    this.leftPlayerPanel = document.querySelector("#leftPlayerPanel");
    this.rightPlayerPanel = document.querySelector("#rightPlayerPanel");
    this.resourceCardStrip = document.querySelector("#resourceCardStrip");
    this.handStrip = document.querySelector("#handStrip");
    this.bankStrip = document.querySelector("#bankStrip");
    this.actionPrompt = document.querySelector("#actionPrompt");
    this.actionPromptAvatar = document.querySelector("#actionPromptAvatar");
    this.actionPromptText = document.querySelector("#actionPromptText");
    this.actionPromptBuild = document.querySelector("#actionPromptBuild");

    this.nextTurnBtn = document.querySelector("#nextTurnBtn");
    this.autoplayBtn = document.querySelector("#autoplayBtn");
    this.resetBtn = document.querySelector("#resetBtn");
    this.resetViewBtn = document.querySelector("#resetViewBtn");
    this.rollDiceBtn = document.querySelector("#rollDiceBtn");
    this.endTurnBtn = document.querySelector("#endTurnBtn");
    this.buildRoadBtn = document.querySelector("#buildRoadBtn");
    this.buildSettlementBtn = document.querySelector("#buildSettlementBtn");
    this.buildCityBtn = document.querySelector("#buildCityBtn");
    this.buyDevBtn = document.querySelector("#buyDevBtn");
    this.playDevBtn = document.querySelector("#playDevBtn");
    this.devCardPicker = document.querySelector("#devCardPicker");
    this.devPickerCards = document.querySelector("#devPickerCards");
    this.playKnightBtn = document.querySelector("#playKnightBtn");
    this.playRoadBuildingBtn = document.querySelector("#playRoadBuildingBtn");
    this.playYearOfPlentyBtn = document.querySelector("#playYearOfPlentyBtn");
    this.playMonopolyBtn = document.querySelector("#playMonopolyBtn");
    this.tradeBankBtn = document.querySelector("#tradeBankBtn");
    this.giveResourceSelect = document.querySelector("#giveResourceSelect");
    this.getResourceSelect = document.querySelector("#getResourceSelect");
    this.speedRange = document.querySelector("#speedRange");
    this.victimPanel = document.querySelector("#victimPanel");
    this.victimOptionsEl = document.querySelector("#victimOptions");
    // Trade modal elements
    this.tradeModal = document.querySelector("#tradeModal");
    this.tradeModalClose = document.querySelector("#tradeModalClose");
    this.tradeExecuteBtn = document.querySelector("#tradeExecuteBtn");
    this.tradeOfferGrid = document.querySelector("#tradeOfferGrid");
    this.tradeRequestGrid = document.querySelector("#tradeRequestGrid");
    this.tradeProposalBtn = document.querySelector("#tradeProposalBtn");
    this.tradeProposalResult = document.querySelector("#tradeProposalResult");
    // Incoming trade elements
    this.incomingTradePanel = document.querySelector("#incomingTradePanel");
    this.incomingTradeHeader = document.querySelector("#incomingTradeHeader");
    this.incomingTradeBody = document.querySelector("#incomingTradeBody");
    this.acceptTradeBtn = document.querySelector("#acceptTradeBtn");
    this.rejectTradeBtn = document.querySelector("#rejectTradeBtn");
    this.pendingIncomingTrade = null;
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this.tradeLocked = false; // set while a player-trade proposal awaits confirmation
    this.pendingRobberFlow = null; // { rollerId, discards: [{ playerId, count }] } during a 7
    // Supply overview
    this.supplyOverview = document.querySelector("#supplyOverview");
    // Persistent dice display
    this.lastDiceDisplay = document.querySelector("#lastDiceDisplay");
    this.lastDice = null; // { d1, d2 }
    this.lastRollPlayer = null;
    // Discard panel
    this.discardPanel = document.querySelector("#discardPanel");
    this.discardInfo = document.querySelector("#discardInfo");
    this.discardCards = document.querySelector("#discardCards");
    this.discardSelected = document.querySelector("#discardSelected");
    this.discardConfirmBtn = document.querySelector("#discardConfirmBtn");
    this.pendingDiscard = null; // { player, count, selected: {} }
    // Build cost reference
    this.costReference = document.querySelector("#costReference");
    this.costRefItems = document.querySelector("#costRefItems");
    this._initCostReference();
    // AI strategy panel
    this.aiStrategyPanel = document.querySelector("#aiStrategyPanel");
    this._applyAllStrategies = true;
    // AI reasoning toggle
    this.aiReasoningToggle = document.querySelector("#aiReasoningToggle");
    this.showAiReasoning = this.aiReasoningToggle?.checked || false;
    this.aiReasoningToggle?.addEventListener("change", () => {
      this.showAiReasoning = this.aiReasoningToggle.checked;
    });

    // Sound engine
    this.soundToggle = document.querySelector("#soundToggle");
    this.soundEnabled = localStorage.getItem("colonist_sound") !== "off";
    if (this.soundToggle) {
      this.soundToggle.checked = this.soundEnabled;
      this.soundToggle.addEventListener("change", () => {
        this.soundEnabled = this.soundToggle.checked;
        localStorage.setItem("colonist_sound", this.soundEnabled ? "on" : "off");
      });
    }
    this._audioCtx = null;

    this.maxLogEntries = 260;
    this.maxToasts = 4;
    this.autoplayInterval = null;
    this.aiTurnTimeout = null;
    this.gameGen = 0; // bumped on reset/load; delayed callbacks from older games are ignored
    this._timers = new Set();
    this.settings = normalizeSettings(ColonistFullGame.loadLastSettings());
    this.rush = null; // Rush-mode state (null in Classic)
    this.diceDeck = [];
    this.lastDiceTotal = null;
    this.rushHud = document.querySelector("#rushHud");
    this.rushReadyBtn = document.querySelector("#rushReadyBtn");
    this.rushOffersEl = document.querySelector("#rushOffers");
    this.rushSevenPanel = document.querySelector("#rushSevenPanel");
    this.modeBadge = document.querySelector("#modeBadge");
    this.bank = makeFullBank();
    this.robberBusy = false; // true while a 7/Knight robber flow waits on the human
    this.turnSerial = 0; // bumped each endTurn; used to invalidate stale trade buttons
    this.animTime = 0;
    this.lastAnimationTs = 0;
    this.animationFrame = null;
    this.highlightRoll = null; // { number, startTime } — highlights hexes with rolled number
    this.placementAnims = []; // [{ x, y, type, startTime }] — build placement pop animations
    this.boardWidth = Number(this.canvas.getAttribute("width")) || 1100;
    this.boardHeight = Number(this.canvas.getAttribute("height")) || 560;
    this.pixelRatio = 1;
    this.view = { offsetX: 0, offsetY: 0, scale: 1 };
    this.dragState = { pending: false, active: false, startX: 0, startY: 0, baseOffsetX: 0, baseOffsetY: 0 };
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverPointer = { x: 0, y: 0 };
    this.hoverTooltip = "";

    this._initTheme();
    this.configureCanvasResolution();
    this.fitCanvasToContainer();
    this.populateResourceSelects();
    this.bindControls();
    this._bindThemeUI();
    if (!this.loadFromStorage()) {
      this.resetGame();
    }
    this._buildStrategyUI();
    this.startAnimationLoop();
  }

  /** Canvas backing-store ratio: up to 3x for the SVG-art renderer (crisp tiles when zoomed on phones). */
  _targetPixelRatio() {
    return clamp(window.devicePixelRatio || 1, 1, this.theme?.canvasArt ? 3 : 2);
  }

  configureCanvasResolution() {
    this.pixelRatio = this._targetPixelRatio();
    this.canvas.width = Math.round(this.boardWidth * this.pixelRatio);
    this.canvas.height = Math.round(this.boardHeight * this.pixelRatio);
    this.canvas.style.width = this.boardWidth + "px";
    this.canvas.style.height = this.boardHeight + "px";
    this.ctx.imageSmoothingEnabled = true;
  }

  fitCanvasToContainer() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const dpr = this._targetPixelRatio();
    if (w !== this.boardWidth || h !== this.boardHeight || dpr !== this.pixelRatio) {
      this.boardWidth = w;
      this.boardHeight = h;
      this.configureCanvasResolution();
      this.rebuildGeometry();
      this.fitView();
      this.boardRenderer?.invalidateStatic();
    }
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.margin = "0";
  }

  rebuildGeometry() {
    if (!this.geometry) return;
    const oldHexes = this.geometry.hexes.map(h => ({ resource: h.resource, number: h.number }));
    const oldNodes = this.geometry.nodes.map(n => ({ owner: n.owner, structure: n.structure }));
    const oldEdges = this.geometry.edges.map(e => ({ owner: e.owner }));
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight);
    this.geometry.hexes.forEach((hex, i) => {
      hex.resource = oldHexes[i].resource;
      hex.number = oldHexes[i].number;
    });
    this.geometry.nodes.forEach((node, i) => {
      node.owner = oldNodes[i].owner;
      node.structure = oldNodes[i].structure;
    });
    this.geometry.edges.forEach((edge, i) => {
      edge.owner = oldEdges[i].owner;
    });
    // Restore port data on nodes
    this.geometry.nodes.forEach(n => { n.ports = []; });
    this.ports.forEach(p => {
      p.nodes.forEach(nodeId => {
        if (!this.geometry.nodes[nodeId].ports.includes(p.type)) {
          this.geometry.nodes[nodeId].ports.push(p.type);
        }
      });
    });
  }

  handleResize() {
    // Remember zoom + the board point in the middle of the view (in hex units: geometry is rebuilt)
    let keep = null;
    if (this.geometry && this._fitScale && this.view.scale > this._fitScale * 1.01) {
      const g = this.geometry, w = this.screenToWorld(this.boardWidth / 2, this.boardHeight / 2);
      keep = { z: this.view.scale / this._fitScale, ax: (w.x - g.centerX) / g.hexSize, ay: (w.y - g.centerY) / g.hexSize };
    }
    this._updateLayoutMode();
    this.fitCanvasToContainer();
    this.fitView();
    if (keep) {
      const g = this.geometry, scale = this._fitScale * keep.z;
      this.view.scale = scale;
      this.view.offsetX = this.boardWidth / 2 - (g.centerX + keep.ax * g.hexSize) * scale;
      this.view.offsetY = this.boardHeight / 2 - (g.centerY + keep.ay * g.hexSize) * scale;
      this._clampView();
    }
    this.boardRenderer?.invalidateStatic();
    this._invalidateUI();
    this.render();
  }

  startAnimationLoop() {
    const frameInterval = 1000 / 32;
    const step = (ts) => {
      this.animationFrame = window.requestAnimationFrame(step);
      if (document.hidden) {
        this.lastAnimationTs = ts;
        return;
      }
      // SVG-art themes: the renderer redraws only when something changed or moves
      if (this.boardRenderer) {
        this.lastAnimationTs = ts;
        this.boardRenderer.frame(ts);
        return;
      }
      // Classic: the original animated canvas at ~30 fps
      if (!this.lastAnimationTs) this.lastAnimationTs = ts;
      const deltaMs = ts - this.lastAnimationTs;
      if (deltaMs < frameInterval && !this._classicDirty) return;
      this._classicDirty = false;
      this.lastAnimationTs = ts;
      this.animTime += deltaMs * 0.001;
      this.drawCanvasScene();
    };
    this.animationFrame = window.requestAnimationFrame(step);
  }

  populateResourceSelects() {
    [this.giveResourceSelect, this.getResourceSelect].forEach((select) => {
      select.innerHTML = "";
      RESOURCES.forEach((resource) => {
        const option = document.createElement("option");
        option.value = resource;
        option.textContent = resource;
        select.appendChild(option);
      });
    });
    this.giveResourceSelect.value = "wood";
    this.getResourceSelect.value = "brick";
  }

  bindControls() {
    this.nextTurnBtn.addEventListener("click", () => {
      this.scheduleAiTurnsUntilHuman();
    });
    this.autoplayBtn.addEventListener("click", () => {
      if (this.autoplayInterval) this.stopAutoplay();
      else this.startAutoplay();
    });
    this.resetBtn.addEventListener("click", () => {
      this.stopAutoplay();
      const drawer = document.querySelector("#settingsDrawer");
      if (drawer) drawer.removeAttribute("open");
      this._showDifficultyModal();
    });
    this.resetViewBtn.addEventListener("click", () => this.resetViewTransform());
    this.rollDiceBtn.addEventListener("click", () => {
      this.handleHumanRoll();
    });
    this.endTurnBtn.addEventListener("click", () => {
      this.handleHumanEndTurn();
    });
    this.buildRoadBtn.addEventListener("click", () => this.setPendingAction("road"));
    this.buildSettlementBtn.addEventListener("click", () => this.setPendingAction("settlement"));
    this.buildCityBtn.addEventListener("click", () => this.setPendingAction("city"));
    this.buyDevBtn.addEventListener("click", () => this.handleHumanBuyDevCard());
    this.playDevBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDevCardPicker();
    });
    this.playKnightBtn.addEventListener("click", () => this.handleHumanPlayDevCard("knight"));
    this.playRoadBuildingBtn.addEventListener("click", () =>
      this.handleHumanPlayDevCard("roadBuilding"),
    );
    this.playYearOfPlentyBtn.addEventListener("click", () =>
      this.handleHumanPlayDevCard("yearOfPlenty"),
    );
    this.playMonopolyBtn.addEventListener("click", () => this.handleHumanPlayDevCard("monopoly"));
    this.tradeBankBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openTradeModal();
    });
    this.tradeModalClose?.addEventListener("click", () => this.closeTradeModal());
    this.tradeModal?.addEventListener("click", (e) => { if (e.target === this.tradeModal) this.closeTradeModal(); });
    this.tradeExecuteBtn?.addEventListener("click", () => this.handleHumanBankTrade());
    this.tradeProposalBtn?.addEventListener("click", () => this.handleHumanPlayerTrade());
    this.acceptTradeBtn?.addEventListener("click", () => this.resolveIncomingTrade(true));
    this.rejectTradeBtn?.addEventListener("click", () => this.resolveIncomingTrade(false));
    this.discardConfirmBtn?.addEventListener("click", () => this._confirmDiscard());
    this.rushReadyBtn?.addEventListener("click", () => this.toggleRushReady());
    document.addEventListener("click", (e) => {
      if (this.devCardPicker && this.devCardPicker.style.display !== "none" &&
          !this.devCardPicker.contains(e.target) && e.target !== this.playDevBtn) {
        this.hideDevCardPicker();
      }
    });
    this.speedRange.addEventListener("input", () => {
      if (this.autoplayInterval) {
        this.stopAutoplay();
        this.startAutoplay();
      }
    });
    // Selecting a spot only redraws the board; refresh the status pill / confirm pill too
    this.canvas.addEventListener("click", (event) => {
      if (this._suppressClick) { this._suppressClick = false; return; } // the click that ends a mouse drag
      this.handleBoardClick(event);
      this.renderStatusAndControls();
    });
    this.canvas.addEventListener("mousemove", (event) => this.handleCanvasMouseMove(event));
    this.canvas.addEventListener("mouseleave", () => this.handleCanvasMouseLeave());
    this.canvas.addEventListener("mousedown", (event) => this.handleCanvasMouseDown(event));
    window.addEventListener("mouseup", () => this.handleCanvasMouseUp());
    window.addEventListener("mousemove", (event) => {
      if (event.target !== this.canvas && (this.dragState.pending || this.dragState.active)) this.handleCanvasMouseMove(event);
    });
    this.canvas.addEventListener("wheel", (event) => this.handleCanvasWheel(event), { passive: false });
    this.canvas.style.touchAction = "none"; // the board owns every touch gesture (no page zoom / scroll)
    this._bindTouchGestures();
    window.addEventListener("keydown", (event) => this.handleKeyboardShortcut(event));
    this.logToggle.addEventListener("click", () => this.toggleLog());
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.handleResize(), 200);
    });
  }

  toggleLog(force) {
    const isOpen = this.railLog.classList.toggle("open", force ?? !this.railLog.classList.contains("open"));
    this.logToggle?.classList.toggle("active", isOpen);
    if (isOpen) this.logContainer.scrollTop = this.logContainer.scrollHeight;
    this._syncScrim?.();
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  // Wrap a callback so it only runs if the game hasn't been reset/reloaded since it was created.
  _guard(fn) {
    const gen = this.gameGen;
    return (...args) => (gen === this.gameGen ? fn(...args) : undefined);
  }

  // Tracked, generation-guarded setTimeout for game-flow callbacks.
  _later(fn, ms) {
    const guarded = this._guard(fn);
    const id = window.setTimeout(() => {
      this._timers.delete(id);
      guarded();
    }, ms);
    this._timers.add(id);
    return id;
  }

  // Cancel timers, loops and pending prompts belonging to the current game.
  _cancelPendingWork() {
    this.gameGen += 1;
    this._timers.forEach((id) => window.clearTimeout(id));
    this._timers.clear();
    this.stopAutoplay();
    this.stopAiTurnLoop();
    this._aiDiceAnimating = false;
    this.robberBusy = false;
    this.pendingRobberFlow = null;
    this.diceResult = null;
    this.pendingDiscard = null;
    if (this.discardPanel) this.discardPanel.style.display = "none";
    this.pendingIncomingTrade = null;
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    document.querySelectorAll(".dice-overlay, #resourcePickerOverlay").forEach((el) => el.remove());
    this._botTicks = new Map();
    if (this.rush) this.rush.offers = [];
    this._lastOffersKey = null;
    this._lastVotersKey = null;
    this._lastNext7Key = null;
    if (this.rushOffersEl) this.rushOffersEl.innerHTML = "";
  }

  // ── Bank & piece supply ──
  payToBank(player, cost) {
    payCost(player.resources, cost);
    RESOURCES.forEach((r) => { this.bank[r] += cost[r] || 0; });
  }

  takeFromBank(player, resource, amount = 1) {
    const n = Math.min(amount, this.bank[resource]);
    this.bank[resource] -= n;
    player.resources[resource] += n;
    return n;
  }

  piecesLeft(player, type) {
    const used = type === "road" ? player.roads.size : type === "settlement" ? player.settlements.size : player.cities.size;
    return PIECE_LIMITS[type] - used;
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * this.boardWidth) / rect.width,
      y: ((event.clientY - rect.top) * this.boardHeight) / rect.height,
    };
  }

  screenToWorld(x, y) {
    return {
      x: (x - this.view.offsetX) / this.view.scale,
      y: (y - this.view.offsetY) / this.view.scale,
    };
  }

  worldToScreen(x, y) {
    return {
      x: x * this.view.scale + this.view.offsetX,
      y: y * this.view.scale + this.view.offsetY,
    };
  }

  resetViewTransform() {
    if (!this.geometry) return;
    this._animateView(this._fitTarget(), 300);
  }

  resetGame() {
    this._cancelPendingWork();
    this.removeGameOverOverlay();
    this.clearStorage();
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight);
    this.robberHexId = assignTiles(this.geometry, this.settings.map);
    this.ports = assignPorts(this.geometry);
    this.devDeck = createDevelopmentDeck();
    this.bank = makeFullBank();
    this.diceDeck = [];
    this.lastDiceTotal = null;
    this.rush = null;

    const strategies = this._strategiesFromSettings();
    this.players = PLAYER_CONFIG.slice(0, this.settings.numBots + 1).map((config, id) => ({
      id,
      name: config.name,
      color: config.color,
      isHuman: config.isHuman,
      avatar: config.avatar,
      personality: config.isHuman ? null : strategies[id].personality,
      resources: makeEmptyResources(),
      roads: new Set(),
      settlements: new Set(),
      cities: new Set(),
      devCards: makeEmptyDevCards(),
      newDevCards: makeEmptyDevCards(),
      devVictoryPoints: 0,
      knightsPlayed: 0,
      longestRoadLength: 0,
      victoryPoints: 0,
      publicVictoryPoints: 0,
      strategy: config.isHuman ? null : { ...strategies[id].strategy },
      rushDevPlayed: false,   // Rush: a dev card was played this roll interval
      rushTradeTried: false,  // Rush (bots): already tried a player trade this roll interval
    }));

    this.logEntries = [];
    this.rollHistory = {}; // { 2: 0, 3: 0, ... 12: 0 }
    for (let i = 2; i <= 12; i++) this.rollHistory[i] = 0;
    this.turn = 1;
    this.currentPlayerIndex = 0;
    this.phase = "pre_roll";
    this.lastRoll = null;
    this.winner = null;
    this.pendingAction = null;
    this.robberContext = null;
    this.robberVictimOptions = [];
    this.confirmBuild = null; // { type: "road"|"settlement"|"city", id: edgeId|nodeId }
    this.freeRoadsRemaining = 0; // Road Building dev card
    this.turnSerial = 0;
    if (this.victimPanel) this.victimPanel.style.display = "none";
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    this.pendingIncomingTrade = null;
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this.hideTradePanel();
    this.currentTurnPlayedDevCard = false;
    this.longestRoadHolder = null;
    this.largestArmyHolder = null;
    this.fitView();
    this.boardRenderer?.resync();
    this._applyThemeToPlayers();
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";
    this.canvas.style.cursor = "grab";

    this.initialPlacement();
    this.recomputeScores();
    this.addLog(`New ${this.isRush() ? "Rush" : "Classic"} game: first to ${this.settings.winPoints} points.`);
    this.render();
  }

  isRush() {
    return this.settings?.mode === "rush";
  }

  get winPoints() {
    return this.settings.winPoints;
  }

  // Per-bot strategy + personality label derived from the new-game settings
  _strategiesFromSettings() {
    const s = this.settings;
    const out = {};
    for (let id = 1; id <= s.numBots; id += 1) {
      if (s.botStyleMode === "each") {
        const preset = s.perBot[id - 1];
        out[id] = { strategy: { ...AI_PRESETS[preset] }, personality: preset };
      } else {
        out[id] = { strategy: { ...s.allStrategy }, personality: presetForStrategy(s.allStrategy) };
      }
    }
    return out;
  }

  static LAST_SETTINGS_KEY = "colonist_last_settings";

  static loadLastSettings() {
    try {
      const raw = localStorage.getItem(ColonistFullGame.LAST_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  static saveLastSettings(settings) {
    try { localStorage.setItem(ColonistFullGame.LAST_SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  // Start a fresh game with the given settings
  startNewGame(settings) {
    this.settings = normalizeSettings(settings);
    ColonistFullGame.saveLastSettings(this.settings);
    this.resetGame();
    this._buildStrategyUI();
  }

  initialPlacement() {
    this.setupPhase = true;
    const order = shuffle(this.players.map((p) => p.id));
    this.setupQueue = [...order, ...order.slice().reverse()];
    this.currentPlayerIndex = order[0];
    this.setupStep = 0;
    this.setupAction = null;
    this.lastSetupNodeId = null;
    this.processSetupQueue();
  }

  processSetupQueue() {
    if (this.setupStep >= this.setupQueue.length) {
      this.setupPhase = false;
      this.setupAction = null;
      this.currentPlayerIndex = this.setupQueue[0]; // first player in setup order starts the game
      this.phase = "pre_roll";
      this.confirmBuild = null;
      this.hoverTooltip = ""; // drop a stale "Confirm" tooltip from the last setup placement
      this.addLog("Initial placement complete.");
      if (this.isRush()) {
        this._startRush();
        return;
      }
      this.saveToStorage();
      this.render();
      if (!this.currentPlayer.isHuman && !this.autoplayInterval) {
        this.scheduleAiTurnsUntilHuman();
      }
      return;
    }

    const playerId = this.setupQueue[this.setupStep];
    const player = this.players[playerId];
    this.currentPlayerIndex = playerId;

    if (this._isInteractive(player)) {
      this.setupAction = "settlement";
      this.addLog("Place your settlement on the board.");
      this.render();
      return;
    }

    // AI placement with delay
    const nodeId = this.getBestInitialSettlementNode(player);
    if (nodeId == null) { this.setupStep++; this.processSetupQueue(); return; }
    this.placeSettlement(player, nodeId, true);
    this.addLog(`${player.name} placed a settlement.`);
    this.sfx.buildSettlement();
    this.recomputeScores();
    this.render();

    this._later(() => {
      const roadId = this.getBestRoadFromNode(player, nodeId);
      if (roadId != null) this.placeRoad(player, roadId, { free: true, setupNode: nodeId });
      if (this.setupStep >= this.players.length) {
        this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
          const hex = this.geometry.hexes[hexId];
          if (hex.resource !== "desert") this.takeFromBank(player, hex.resource, 1);
        });
      }
      this.addLog(`${player.name} placed a road.`);
      this.sfx.buildRoad();
      this.recomputeScores();
      this.render();
      this.setupStep++;
      this._later(() => this.processSetupQueue(), 350);
    }, 400);
  }

  handleSetupClick(x, y) {
    const player = this.players[this.setupQueue[this.setupStep]];
    if (!player.isHuman) return;

    // Check confirm icon tap first
    if (this.confirmBuild && this.hitTestConfirmIcon(x, y)) {
      const cb = this.confirmBuild;
      if (cb.type === "settlement" && this.setupAction === "settlement") {
        this.placeSettlement(player, cb.id, true);
        this.sfx.buildSettlement();
        this.lastSetupNodeId = cb.id;
        this.setupAction = "road";
        this.confirmBuild = null;
        this.addLog("Now place a road from your settlement.");
        this.render();
        return;
      }
      if (cb.type === "road" && this.setupAction === "road") {
        this.placeRoad(player, cb.id, { free: true, setupNode: this.lastSetupNodeId });
        this.sfx.buildRoad();
        if (this.setupStep >= this.players.length) {
          this.geometry.nodes[this.lastSetupNodeId].adjacentHexes.forEach((hexId) => {
            const hex = this.geometry.hexes[hexId];
            if (hex.resource !== "desert") this.takeFromBank(player, hex.resource, 1);
          });
        }
        this.setupStep++;
        this.setupAction = null;
        this.lastSetupNodeId = null;
        this.confirmBuild = null;
        this.saveToStorage();
        this.processSetupQueue();
        return;
      }
    }

    if (this.setupAction === "settlement") {
      const nodeId = this.findNodeAt(x, y);
      if (nodeId == null) { this.confirmBuild = null; this.drawCanvasScene(); return; }
      if (!this.canBuildSettlement(player, nodeId, true)) {
        this.confirmBuild = null;
        this.addLog("Can't place there. Pick an empty intersection.");
        this.drawCanvasScene();
        return;
      }
      this.confirmBuild = { type: "settlement", id: nodeId };
      this.drawCanvasScene();
      return;
    }

    if (this.setupAction === "road") {
      const edgeId = this.findEdgeAt(x, y);
      if (edgeId == null) { this.confirmBuild = null; this.drawCanvasScene(); return; }
      const edge = this.geometry.edges[edgeId];
      const adjacent = edge.nodes.includes(this.lastSetupNodeId);
      if (!adjacent || edge.owner != null) {
        this.confirmBuild = null;
        this.addLog("Place a road adjacent to your settlement.");
        this.drawCanvasScene();
        return;
      }
      this.confirmBuild = { type: "road", id: edgeId };
      this.drawCanvasScene();
      return;
    }
  }

  addLog(text, meta = null) {
    const entry = { text, meta, time: Date.now() };
    if (this.rush) entry.clock = this.rush.clockMs; // Rush feed timestamp (mm:ss of game time)
    this.logEntries.push(entry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }
    if (this.shouldToast(text)) this.pushToast(text);
  }

  shouldToast(text) {
    // Rush is busy: the feed carries the play-by-play, toasts only for the big moments
    if (this.rush) return /(\bwins?\b|moved robber)/i.test(text);
    return /(rolled|built|upgraded|traded|played|stole|\bwins?\b|moved robber|\bcollects?\b)/i.test(text);
  }

  pushToast(text, cls = "") {
    if (!this.toastStack) return;
    const toast = document.createElement("div");
    toast.className = `toast ${cls}`.trim();
    toast.innerHTML = `${icon(this._logIcon(text))}<div>${this._enrichLogText(text)}</div>`;
    this.toastStack.appendChild(toast);
    while (this.toastStack.children.length > this.maxToasts) {
      this.toastStack.removeChild(this.toastStack.firstChild);
    }
    // Longer display for robber-related events so the player can follow what happened
    const duration = /(robber|stole|discard)/i.test(text) ? 4500 : 2600;
    window.setTimeout(() => {
      if (!toast.parentElement) return;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-4px)";
      window.setTimeout(() => toast.remove(), 180);
    }, duration);
  }

  // Dice setting: "random" (independent dice), "balanced" (colonist.io-style: a 36-card deck of
  // all two-dice outcomes reshuffled when 12 cards remain, and a repeat of the previous total is
  // redrawn once with 30% probability) or "deck" (36-card event deck, reshuffled when empty).
  rollDice() {
    const mode = this.settings?.dice || "random";
    let d1;
    let d2;
    if (mode === "random") {
      d1 = 1 + Math.floor(Math.random() * 6);
      d2 = 1 + Math.floor(Math.random() * 6);
    } else {
      const minLeft = mode === "balanced" ? 12 : 0;
      if (!Array.isArray(this.diceDeck) || this.diceDeck.length <= minLeft) this.diceDeck = createDiceDeck();
      const draw = () => this.diceDeck.splice(Math.floor(Math.random() * this.diceDeck.length), 1)[0];
      let card = draw();
      if (mode === "balanced" && card[0] + card[1] === this.lastDiceTotal && Math.random() < 0.3) {
        const redraw = draw();
        this.diceDeck.push(card); // the repeat goes back into the deck
        card = redraw;
      }
      [d1, d2] = card;
    }
    this.lastDiceTotal = d1 + d2;
    return { total: d1 + d2, d1, d2 };
  }

  handleHumanRoll() {
    if (this.isRush()) { this.toggleRushReady(); return; }
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "pre_roll" || this._robberInProgress()) return;
    if (this.rollDiceBtn) this.rollDiceBtn.disabled = true;
    this.animateDiceRoll(() => {
      this.executeRollPhase(player);
      this.saveToStorage();
      this.render();
    });
  }

  _renderDieFace(dieEl, value) {
    // Render dot-face dice using a 3x3 grid of pips
    // Layout: positions are [TL, TM, TR, ML, MM, MR, BL, BM, BR]
    const layouts = {
      1: [0,0,0, 0,1,0, 0,0,0],
      2: [0,0,1, 0,0,0, 1,0,0],
      3: [0,0,1, 0,1,0, 1,0,0],
      4: [1,0,1, 0,0,0, 1,0,1],
      5: [1,0,1, 0,1,0, 1,0,1],
      6: [1,0,1, 1,0,1, 1,0,1],
    };
    const layout = layouts[value] || layouts[1];
    dieEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement("div");
      pip.className = layout[i] ? "pip" : "pip hidden";
      dieEl.appendChild(pip);
    }
  }

  animateDiceRoll(callback, rollerPlayer = null) {
    callback = this._guard(callback);
    const result = this.rollDice();
    this.diceResult = result;
    this.sfx.diceRoll();
    const ms = this.fx ? this.fx.diceRoll(result.d1, result.d2) : 600;
    window.setTimeout(() => callback(), ms);
  }

  animateResourceGain(gains) {
    const strip = document.getElementById("resourceCardStrip");
    if (!strip) return;
    gains.forEach(({ resource, amount }) => {
      for (let i = 0; i < amount; i++) {
        const floater = document.createElement("div");
        floater.className = "resource-floater";
        floater.textContent = `+${RESOURCE_LABEL[resource]}`;
        floater.style.setProperty("--res-color", RESOURCE_COLORS[resource]);
        strip.appendChild(floater);
        setTimeout(() => floater.remove(), 900);
      }
    });
  }

  handleHumanEndTurn() {
    if (this.isRush()) return; // no turns in Rush
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "main" || this._robberInProgress()) return;
    if (document.getElementById("resourcePickerOverlay")) return; // finish Year of Plenty / Monopoly first
    this.hideTradePanel();
    this.endTurn();
    this.saveToStorage();
    this.scheduleAiTurnsUntilHuman();
  }

  setPendingAction(action) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main") return;
    if (this._robberInProgress()) return; // Cannot override robber placement / discard
    if (["road", "settlement", "city"].includes(action) && this.piecesLeft(player, action) <= 0) return;
    if (action === "road" && !this.freeRoadsRemaining && !hasResources(player.resources, COSTS.road)) return;
    if (action === "settlement" && !hasResources(player.resources, COSTS.settlement)) return;
    if (action === "city" && !hasResources(player.resources, COSTS.city)) return;
    this.pendingAction = this.pendingAction === action ? null : action;
    this.confirmBuild = null;
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.hideTradePanel();
    this.render();
  }

  handleHumanBuyDevCard() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main" || this._robberInProgress()) return;
    this.buyDevelopmentCard(player);
    this.recomputeScores();
    this.checkForWinner(player);
    this.render();
  }

  // Verb suffix for log grammar: "You discard" vs "Sage AI discards"
  _s(player) {
    return player.isHuman ? "" : "s";
  }

  _hexLabel(hex) {
    if (hex.resource === "desert" || !hex.number) return "the Desert";
    return `the ${TERRAIN_NAME[hex.resource]} hex (${hex.number})`;
  }

  _robberInProgress() {
    return this.robberBusy || this.pendingAction === "robber" || !!this.pendingDiscard || this.robberVictimOptions?.length > 0;
  }

  handleHumanPlayDevCard(type) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (!this.canPlayDevelopmentCard(player, type)) return; // checks phase (Knight may be played before rolling)
    this.hideDevCardPicker();
    const played = this.playDevelopmentCard(player, type);
    if (played) {
      this.recomputeScores();
      this.checkForWinner(player);
      this.render();
    }
  }

  toggleDevCardPicker() {
    if (!this.devCardPicker) return;
    if (this.devCardPicker.style.display === "none") {
      this.toggleBuildSheet?.(false);
      this.hideTradePanel();
      this.renderDevCardPicker();
      this.devCardPicker.style.display = "";
    } else {
      this.hideDevCardPicker();
    }
  }

  hideDevCardPicker() {
    if (this.devCardPicker) this.devCardPicker.style.display = "none";
  }

  renderDevCardPicker() {
    if (!this.devPickerCards) return;
    const human = this.players.find((p) => p.isHuman);
    if (!human) return;
    const canPlay = this.currentPlayer.isHuman;
    const rush = this.isRush();
    const lead = document.querySelector("#devPickerLead");
    if (lead) lead.textContent = rush ? "One card per roll. Cards bought now can be played after the next roll." : "One card per turn. Cards bought this turn can be played next turn.";
    const types = [...DEV_CARD_TYPES, "victoryPoint"];
    const owned = types.filter((t) => (t === "victoryPoint" ? human.devVictoryPoints : human.devCards[t] + human.newDevCards[t]) > 0);
    if (!owned.length) {
      this.devPickerCards.innerHTML = `<p class="lead" style="grid-column:1/-1">No development cards yet. Buy one for ${resourceString(COSTS.development)}.</p>`;
      return;
    }
    this.devPickerCards.innerHTML = owned.map((t) => {
      if (t === "victoryPoint") {
        return `<div class="dev-item">${`<span class="card">${cardSvg(t)}<span class="count">${human.devVictoryPoints}</span></span>`}<span class="dn">Victory Point</span><span class="dd">Counts automatically</span></div>`;
      }
      const count = human.devCards[t] + human.newDevCards[t];
      const enabled = canPlay && human.devCards[t] > 0 && this.canPlayDevelopmentCard(human, t);
      const why = human.devCards[t] === 0 ? (rush ? "New — after the next roll" : "New — play next turn") : CARD_TEXT[t];
      return `<div class="dev-item${enabled ? "" : " none"}"><span class="card">${cardSvg(t)}<span class="count">${count}</span></span><span class="dn">${DEV_NAME[t]}</span><span class="dd">${why}</span>
        <button type="button" class="btn primary dev-picker-btn" data-dev-type="${t}" ${enabled ? "" : "disabled"}>Play</button></div>`;
    }).join("");
    this.devPickerCards.querySelectorAll(".dev-picker-btn:not(:disabled)").forEach((btn) => {
      btn.addEventListener("click", () => this.handleHumanPlayDevCard(btn.dataset.devType));
    });
  }

  handleHumanBankTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main" || this._robberInProgress()) return;
    const offeredTypes = RESOURCES.filter(r => this.tradeOffer[r] > 0);
    const requestedTypes = RESOURCES.filter(r => this.tradeRequest[r] > 0);
    if (offeredTypes.length !== 1 || requestedTypes.length !== 1) return;
    const give = offeredTypes[0];
    const get = requestedTypes[0];
    if (give === get) return;
    const ok = this.performBankTrade(player, give, get);
    if (ok) {
      // Animate cards: give goes up, get comes down
      const giveRes = makeEmptyResources();
      giveRes[give] = this.getPlayerTradeRate(player, give);
      const getRes = makeEmptyResources();
      getRes[get] = 1;
      this._animateTradeCards(giveRes, getRes);
      this.tradeOffer = makeEmptyResources();
      this.tradeRequest = makeEmptyResources();
      this.buildTradeGrids();
      this.updateTradeButtons();
      if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = '<span class="ok">Harbor trade done!</span>';
      this.sfx.trade();
    } else {
      if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = '<span class="no">Harbor trade failed.</span>';
      this.sfx.error();
    }
    this.render();
  }

  handleBoardClick(event) {
    if (this.setupPhase) {
      const { x: sx, y: sy } = this.getCanvasPoint(event);
      const world = this.screenToWorld(sx, sy);
      this.handleSetupClick(world.x, world.y);
      return;
    }
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    // Robber placement is allowed before rolling (Knight); everything else needs the main phase
    const robberMode = this.pendingAction === "robber";
    if (this.phase !== "main" && !(robberMode && (this.phase === "pre_roll" || this.phase === "seven"))) return;
    if (this.pendingDiscard || this.robberVictimOptions?.length > 0) return;

    const { x: sx, y: sy } = this.getCanvasPoint(event);
    const world = this.screenToWorld(sx, sy);
    const x = world.x;
    const y = world.y;

    // Robber placement mode
    if (robberMode) {
      const hexId = this.findHexAt(x, y);
      if (hexId == null) return;
      if (!this._robberHexAllowed(hexId, player)) {
        this.addLog(hexId === this.robberHexId
          ? "Cannot place robber on the same hex."
          : "Friendly robber: that hex touches a player with 2 or fewer points.");
        this.render();
        return;
      }
      this.robberHexId = hexId;
      const hex = this.geometry.hexes[hexId];
      this.addLog(`${player.name} moved robber to ${this._hexLabel(hex)}.`);
      this.sfx.robber();
      this.pendingAction = null;

      // Check for steal victims
      const victims = this._stealVictims(hexId, player);
      if (victims.length === 0) {
        this.addLog("No one to steal from.");
        this.robberContext = null;
      } else if (victims.length === 1) {
        this.stealFromVictim(player, victims[0]);
        this.robberContext = null;
      } else {
        // Multiple victims — show selection panel
        this.robberVictimOptions = victims;
        this.showVictimPanel(player, victims);
      }
      this.saveToStorage();
      this.render();
      return;
    }

    if (!this.pendingAction) {
      // Auto-detect: click a buildable spot to start building
      const nodeId = this.findNodeAt(x, y);
      if (nodeId != null) {
        const node = this.geometry.nodes[nodeId];
        // City upgrade
        if (this.canBuildCity(player, nodeId, false)) {
          this.pendingAction = "city";
          this.confirmBuild = { type: "city", id: nodeId };
          this.canvas.style.cursor = "crosshair";
          this.sfx.click();
          this.render();
          return;
        }
        // Settlement
        if (this.canBuildSettlement(player, nodeId, false) && hasResources(player.resources, COSTS.settlement)) {
          this.pendingAction = "settlement";
          this.confirmBuild = { type: "settlement", id: nodeId };
          this.canvas.style.cursor = "crosshair";
          this.sfx.click();
          this.render();
          return;
        }
      }
      const edgeId = this.findEdgeAt(x, y);
      if (edgeId != null && (this.freeRoadsRemaining > 0 || hasResources(player.resources, COSTS.road))) {
        if (this.canBuildRoad(player, edgeId, { free: this.freeRoadsRemaining > 0 })) {
          this.pendingAction = "road";
          this.confirmBuild = { type: "road", id: edgeId };
          this.canvas.style.cursor = "crosshair";
          this.sfx.click();
          this.render();
          return;
        }
      }
      return;
    }

    // Check if tapping the confirm icon (green checkmark above selected spot)
    if (this.confirmBuild && this.hitTestConfirmIcon(x, y)) {
      const cb = this.confirmBuild;
      let built = false;
      if (cb.type === "road") {
        const isFreeRoad = this.freeRoadsRemaining > 0;
        if (this.placeRoad(player, cb.id, { free: isFreeRoad })) {
          if (!isFreeRoad) this.payToBank(player, COSTS.road);
          else {
            this.freeRoadsRemaining -= 1;
            // No pieces or legal spots left — forfeit the remaining free road
            if (this.freeRoadsRemaining > 0 && !this._hasLegalRoad(player, true)) this.freeRoadsRemaining = 0;
            this.addLog(`${player.name} placed a free road (${this.freeRoadsRemaining} remaining).`);
          }
          if (!isFreeRoad) this.addLog(`${player.name} built a road.`);
          this.sfx.buildRoad();
          built = true;
        }
      } else if (cb.type === "settlement") {
        if (this.placeSettlement(player, cb.id, false)) {
          this.payToBank(player, COSTS.settlement);
          this.addLog(`${player.name} built a settlement.`);
          this.sfx.buildSettlement();
          built = true;
        }
      } else if (cb.type === "city") {
        if (this.placeCity(player, cb.id, false)) {
          this.payToBank(player, COSTS.city);
          this.addLog(`${player.name} upgraded to a city.`);
          this.sfx.buildCity();
          built = true;
        }
      }
      if (!built && this.rush) {
        // Rush: someone else built there first
        this.addLog("Too slow — that spot was just taken.");
        this.sfx.error();
        this.confirmBuild = null;
        this.render();
        return;
      }
      if (built) {
        // Trigger placement animation
        const animPos = this.getBuildPosition(cb);
        if (animPos) this.placementAnims.push({ ...animPos, type: cb.type, startTime: Date.now() });
        // Stay in road mode if free roads remain from Road Building card
        if (this.freeRoadsRemaining > 0) {
          this.pendingAction = "road";
          this.confirmBuild = null;
          this.recomputeScores();
          this.render();
          return;
        }
        this.pendingAction = null;
        this.confirmBuild = null;
        if (this.rush) {
          this._rushAfterAction(player);
          return;
        }
        this.recomputeScores();
        this.checkForWinner(player);
        this.render();
        return;
      }
    }

    // First tap: select a build spot (show confirm icon)
    if (this.pendingAction === "road") {
      const edgeId = this.hoverEdgeId ?? this.findEdgeAt(x, y);
      if (edgeId == null) { this.confirmBuild = null; this.drawCanvasScene(); return; }
      const isFreeRoad = this.freeRoadsRemaining > 0;
      if (this.canBuildRoad(player, edgeId, { free: isFreeRoad })) {
        this.confirmBuild = { type: "road", id: edgeId };
      } else {
        this.confirmBuild = null;
      }
      this.drawCanvasScene();
      return;
    } else {
      const nodeId = this.hoverNodeId ?? this.findNodeAt(x, y);
      if (nodeId == null) { this.confirmBuild = null; this.drawCanvasScene(); return; }
      if (this.pendingAction === "settlement") {
        if (this.canBuildSettlement(player, nodeId, false)) {
          this.confirmBuild = { type: "settlement", id: nodeId };
        } else {
          this.confirmBuild = null;
        }
      } else if (this.pendingAction === "city") {
        if (this.canBuildCity(player, nodeId, false)) {
          this.confirmBuild = { type: "city", id: nodeId };
        } else {
          this.confirmBuild = null;
        }
      }
      this.drawCanvasScene();
      return;
    }

    this.recomputeScores();
    this.checkForWinner(player);
    this.render();
  }

  handleCanvasMouseMove(event) {
    const { x: sx, y: sy } = this.getCanvasPoint(event);
    this.hoverPointer.x = sx;
    this.hoverPointer.y = sy;
    const ds = this.dragState;
    if (ds.pending && !ds.active && Math.hypot(sx - ds.startX, sy - ds.startY) > 4) {
      ds.active = true; // a press only becomes a drag once it moves; a still press stays a click
      this._setViewMoving(true);
    }
    if (ds.active) {
      this.view.offsetX = ds.baseOffsetX + (sx - ds.startX);
      this.view.offsetY = ds.baseOffsetY + (sy - ds.startY);
      this._clampView();
      this.canvas.style.cursor = "grabbing";
      this._viewChanged();
      return;
    }
    const world = this.screenToWorld(sx, sy);
    this.updateHoverTargets(world.x, world.y);
    this.drawCanvasScene();
  }

  handleCanvasMouseLeave() {
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";
    if (!this.dragState.active) this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.drawCanvasScene();
  }

  handleCanvasMouseDown(event) {
    if (event.button !== 0) return;
    this._stopViewMotion();
    const ds = this.dragState;
    const { x: sx, y: sy } = this.getCanvasPoint(event);
    ds.pending = true;
    ds.active = false;
    ds.startX = sx;
    ds.startY = sy;
    ds.baseOffsetX = this.view.offsetX;
    ds.baseOffsetY = this.view.offsetY;
  }

  handleCanvasMouseUp() {
    const ds = this.dragState;
    const dragged = ds.active;
    ds.pending = false;
    ds.active = false;
    if (!dragged) return;
    this._suppressClick = true; // the click event that follows a drag is not a board click
    window.setTimeout(() => { this._suppressClick = false; }, 0);
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this._setViewMoving(false);
    this.drawCanvasScene();
  }

  /** Mouse wheel zooms at the pointer; trackpad pinch (ctrl+wheel) zooms smoothly; two-finger trackpad scroll pans. */
  handleCanvasWheel(event) {
    event.preventDefault();
    this._stopViewMotion();
    let dx = event.deltaX, dy = event.deltaY;
    if (event.deltaMode === 1) { dx *= 16; dy *= 16; } else if (event.deltaMode === 2) { dx *= 400; dy *= 400; }
    const pt = this.getCanvasPoint(event);
    if (event.ctrlKey) this.zoomAt(pt.x, pt.y, Math.exp(-clamp(dy, -60, 60) * 0.01));
    else if (Math.abs(dx) > 0.5) {
      this.view.offsetX -= dx;
      this.view.offsetY -= dy;
      this._clampView();
      this._viewChanged();
    } else this.zoomAt(pt.x, pt.y, Math.exp(-clamp(dy, -120, 120) * 0.0022));
    this._setViewMoving(true);
    clearTimeout(this._wheelTimer);
    this._wheelTimer = window.setTimeout(() => this._setViewMoving(false), 160);
  }

  // ── Touch: native-map style gestures ────────────────────────────────────
  // One finger: tap = select/confirm (unchanged rules), drag = pan (with momentum).
  // Two fingers: pinch-zoom anchored at the midpoint + pan with the midpoint.
  // Double tap (only when no placement is in progress) toggles fit <-> 2x at the tapped point.
  _bindTouchGestures() {
    const ts = (this.touchState = { mode: null, startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, samples: [], pair: null, lastTapTime: 0, lastTapX: 0, lastTapY: 0 });
    const pt = (t) => this.getCanvasPoint(t);
    const pairOf = (list) => {
      const a = pt(list[0]), b = pt(list[1]);
      return { midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y) };
    };
    const startPan = (touch) => {
      const p = pt(touch);
      ts.mode = "pan";
      ts.lastX = p.x;
      ts.lastY = p.y;
      ts.samples = [{ t: performance.now(), x: p.x, y: p.y }];
      this._setViewMoving(true);
    };
    this.canvas.addEventListener("touchstart", (event) => {
      event.preventDefault();
      this._stopViewMotion();
      this.dragState.pending = false;
      this.dragState.active = false;
      if (event.touches.length >= 2) {
        ts.mode = "pinch";
        ts.pair = pairOf(event.touches);
        ts.lastTapTime = 0;
        this._setViewMoving(true);
      } else if (event.touches.length === 1) {
        const p = pt(event.touches[0]);
        ts.mode = "tap";
        ts.startX = ts.lastX = p.x;
        ts.startY = ts.lastY = p.y;
        ts.startTime = event.timeStamp; // event time: a busy main thread must not turn a tap into a long press
        ts.samples = [{ t: ts.startTime, x: p.x, y: p.y }];
      }
    }, { passive: false });

    this.canvas.addEventListener("touchmove", (event) => {
      event.preventDefault();
      if (ts.mode === "pinch" && event.touches.length >= 2) {
        const pair = pairOf(event.touches);
        const prev = ts.pair;
        const world = this.screenToWorld(prev.midX, prev.midY);
        const f = prev.dist > 0 ? pair.dist / prev.dist : 1;
        this.view.scale = clamp(this.view.scale * f, this._minScale(), this._maxScale());
        this.view.offsetX = pair.midX - world.x * this.view.scale;
        this.view.offsetY = pair.midY - world.y * this.view.scale;
        this._clampView();
        ts.pair = pair;
        this._viewChanged();
        return;
      }
      if (event.touches.length !== 1) return;
      const p = pt(event.touches[0]);
      if (ts.mode === "tap" && Math.hypot(p.x - ts.startX, p.y - ts.startY) > 10) {
        ts.mode = "pan";
        this._setViewMoving(true);
      }
      if (ts.mode !== "pan") return;
      this.view.offsetX += p.x - ts.lastX;
      this.view.offsetY += p.y - ts.lastY;
      ts.lastX = p.x;
      ts.lastY = p.y;
      const now = event.timeStamp;
      ts.samples.push({ t: now, x: p.x, y: p.y });
      while (ts.samples.length > 2 && now - ts.samples[0].t > 100) ts.samples.shift();
      this._clampView();
      this._viewChanged();
    }, { passive: false });

    const end = (event, cancelled) => {
      if (event.cancelable) event.preventDefault();
      if (event.touches.length > 0) {
        // pinch → one finger left: keep panning with it (no jump)
        if (ts.mode === "pinch" && event.touches.length === 1) startPan(event.touches[0]);
        else if (event.touches.length >= 2) ts.pair = pairOf(event.touches);
        return;
      }
      const mode = ts.mode;
      ts.mode = null;
      if (mode === "pan" && !cancelled) {
        const s0 = ts.samples[0], s1 = ts.samples[ts.samples.length - 1];
        const dt = s1.t - s0.t;
        if (dt > 0 && event.timeStamp - s1.t < 60) this._startMomentum((s1.x - s0.x) / dt, (s1.y - s0.y) / dt);
        else this._setViewMoving(false);
        return;
      }
      if (mode === "pan" || mode === "pinch") { this._setViewMoving(false); return; }
      if (mode !== "tap" || cancelled || event.timeStamp - ts.startTime > 600) return;
      const touch = event.changedTouches[0];
      const p = pt(touch);
      const now = event.timeStamp;
      // While placing (setup, build/robber mode, or a ✓ is showing) a quick second tap is a
      // selection/confirmation, never a double-tap zoom
      const placing = !!(this.setupPhase || this.pendingAction || this.confirmBuild || this.robberVictimOptions?.length > 0);
      if (!placing && now - ts.lastTapTime < 320 && Math.hypot(p.x - ts.lastTapX, p.y - ts.lastTapY) < 36) {
        ts.lastTapTime = 0;
        this.handleDoubleTapZoom(touch.clientX, touch.clientY);
        return;
      }
      // Hover targets come from the tap point itself (never from an earlier drag)
      const world = this.screenToWorld(p.x, p.y);
      this.updateHoverTargets(world.x, world.y);
      this.handleBoardClick({ clientX: touch.clientX, clientY: touch.clientY });
      this.hoverNodeId = this.hoverEdgeId = this.hoverHexId = null;
      this.hoverTooltip = "";
      this.renderStatusAndControls();
      ts.lastTapTime = placing ? 0 : now;
      ts.lastTapX = p.x;
      ts.lastTapY = p.y;
    };
    this.canvas.addEventListener("touchend", (event) => end(event, false), { passive: false });
    this.canvas.addEventListener("touchcancel", (event) => end(event, true), { passive: false });
  }

  // ── View: limits, clamping, motion ──────────────────────────────────────
  _minScale() { return this._fitScale; }
  _maxScale() { return this._fitScale * 2.5; }

  /** Island bounds (world) and the visible board area (screen), shared by fit and clamping. */
  _viewFrame() {
    const g = this.geometry, hs = g.hexSize;
    const xs = g.hexes.map((h) => h.center.x), ys = g.hexes.map((h) => h.center.y);
    // Phones: the island (tiles + beach) fills the width; only the harbours may touch the screen edge
    const mobile = this.isMobileLayout;
    const mx = hs * (mobile ? 1.05 : 1.75), my = hs * (mobile ? 1.12 : 1.7);
    const box = { minX: Math.min(...xs) - mx, maxX: Math.max(...xs) + mx, minY: Math.min(...ys) - my, maxY: Math.max(...ys) + my };
    let fan = 0, top = 4;
    if (mobile && this.app) {
      const cs = getComputedStyle(this.app);
      fan = parseFloat(cs.getPropertyValue("--fan-h")) || 112;
      top = parseFloat(cs.getPropertyValue("--board-top")) || 4;
    }
    const ins = mobile ? { t: top, r: 0, b: fan - 6, l: 0 } : { t: 10, r: 10, b: 10, l: 10 };
    const vp = { l: ins.l, t: ins.t, W: Math.max(50, this.boardWidth - ins.l - ins.r), H: Math.max(50, this.boardHeight - ins.t - ins.b) };
    if (mobile) {
      // Width-bound portrait phones: sit the island just above the hand instead of leaving an empty
      // band of sea there (most of the spare height goes to the top, where the dice and fit button float)
      const scale = Math.min(vp.W / (box.maxX - box.minX), vp.H / (box.maxY - box.minY));
      const slack = vp.H - (box.maxY - box.minY) * scale;
      if (slack > 8) { const shift = slack * 0.8; vp.t += shift; vp.H -= shift; }
    }
    return { box, vp };
  }

  /** Keep the island in view. On an axis where it is larger than the view it must cover the view
   *  edge to edge; where it is smaller it must stay inside, and that slack shrinks smoothly to
   *  "centred" as the zoom approaches fit (so the fitted board never drifts, and pinches stay anchored). */
  _clampView(v = this.view) {
    if (!this.geometry) return v;
    const { box, vp } = this._viewFrame();
    v.scale = clamp(v.scale, this._minScale(), this._maxScale());
    const t = clamp((v.scale / this._minScale() - 1) / 0.06, 0, 1);
    const axis = (off, min, max, start, size) => {
      const span = (max - min) * v.scale;
      const give = size * 0.12 * t; // a little overscroll once zoomed, so pinches near an edge stay anchored
      if (span <= size) {
        const centred = start + size / 2 - ((min + max) / 2) * v.scale;
        const slack = ((size - span) / 2) * t + give;
        return clamp(off, centred - slack, centred + slack);
      }
      return clamp(off, start + size - max * v.scale - give, start - min * v.scale + give);
    };
    v.offsetX = axis(v.offsetX, box.minX, box.maxX, vp.l, vp.W);
    v.offsetY = axis(v.offsetY, box.minY, box.maxY, vp.t, vp.H);
    return v;
  }

  /** The view moved: redraw on the next animation frame (at most once per frame). */
  _viewChanged() {
    if (this.boardRenderer) this.boardRenderer.requestDraw();
    else this._classicDirty = true;
  }

  /** While the view moves, the SVG renderer reuses its cached layer (scaled) and re-bakes afterwards. */
  _setViewMoving(on) {
    this.viewMoving = on;
    if (!on) this.boardRenderer?.requestDraw();
  }

  _stopViewMotion() {
    if (this._viewAnim) { cancelAnimationFrame(this._viewAnim); this._viewAnim = null; }
    this._setViewMoving(false);
  }

  _startMomentum(vx, vy) {
    if (Math.hypot(vx, vy) < 0.25 || motionReduced()) { this._setViewMoving(false); return; }
    let last = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(40, now - last));
      last = now;
      const bx = this.view.offsetX, by = this.view.offsetY;
      this.view.offsetX += vx * dt;
      this.view.offsetY += vy * dt;
      this._clampView();
      if (Math.abs(this.view.offsetX - bx) < 0.01) vx = 0; // reached an edge on this axis
      if (Math.abs(this.view.offsetY - by) < 0.01) vy = 0;
      const decay = Math.exp(-dt / 325);
      vx *= decay;
      vy *= decay;
      this._viewChanged();
      if (Math.hypot(vx, vy) < 0.02) { this._viewAnim = null; this._setViewMoving(false); return; }
      this._viewAnim = requestAnimationFrame(step);
    };
    this._setViewMoving(true);
    this._viewAnim = requestAnimationFrame(step);
  }

  /** Animate the view to a target (ease-out, anchored at the zoom's fixed point; instant with reduced motion). */
  _animateView(target, dur = 280) {
    this._stopViewMotion();
    const from = { ...this.view };
    const to = this._clampView({ ...target });
    if (motionReduced() || dur <= 0) {
      Object.assign(this.view, to);
      this._viewChanged();
      return;
    }
    // Fixed point F of the transform from→to: F = off + w*scale for the same world point w in both views.
    const ds = to.scale - from.scale;
    let fixed = null;
    if (Math.abs(ds) > 1e-6) {
      const wx = (from.offsetX - to.offsetX) / ds, wy = (from.offsetY - to.offsetY) / ds;
      fixed = { wx, wy, sx: from.offsetX + wx * from.scale, sy: from.offsetY + wy * from.scale };
    }
    const t0 = performance.now();
    this._setViewMoving(true);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      if (fixed) {
        const sc = from.scale * Math.pow(to.scale / from.scale, e);
        this.view.scale = sc;
        this.view.offsetX = fixed.sx - fixed.wx * sc;
        this.view.offsetY = fixed.sy - fixed.wy * sc;
      } else {
        this.view.offsetX = from.offsetX + (to.offsetX - from.offsetX) * e;
        this.view.offsetY = from.offsetY + (to.offsetY - from.offsetY) * e;
      }
      if (t >= 1) Object.assign(this.view, to);
      this._viewChanged();
      if (t < 1) this._viewAnim = requestAnimationFrame(step);
      else { this._viewAnim = null; this._setViewMoving(false); }
    };
    this._viewAnim = requestAnimationFrame(step);
  }

  /** Zoom by factor f keeping the board point under (sx, sy) fixed. */
  zoomAt(sx, sy, f) {
    const before = this.screenToWorld(sx, sy);
    this.view.scale = clamp(this.view.scale * f, this._minScale(), this._maxScale());
    this.view.offsetX = sx - before.x * this.view.scale;
    this.view.offsetY = sy - before.y * this.view.scale;
    this._clampView();
    this._viewChanged();
  }

  handleDoubleTapZoom(clientX, clientY) {
    const pt = this.getCanvasPoint({ clientX, clientY });
    // Toggle between the fitted board and 2x at the tapped point
    if (this.view.scale < this._fitScale * 1.5) {
      const w = this.screenToWorld(pt.x, pt.y);
      const scale = this._fitScale * 2;
      this._animateView({ scale, offsetX: pt.x - w.x * scale, offsetY: pt.y - w.y * scale });
    } else {
      this._animateView(this._fitTarget());
    }
  }

  handleKeyboardShortcut(event) {
    if (document.querySelector(".newgame-modal")) return; // setup screen owns the keyboard
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (key === "escape") {
      if (this.confirmBuild) {
        this.confirmBuild = null;
        this.drawCanvasScene();
      } else if (this.pendingAction && this.pendingAction !== "robber") {
        this.pendingAction = null;
        this.confirmBuild = null;
        this.canvas.style.cursor = "grab";
        this.render();
      }
      // Close trade panel and sheets on Escape
      this.hideTradePanel();
      this.hideDevCardPicker();
      this.toggleBuildSheet?.(false);
      if (this.railLog?.classList.contains("open") && this.isMobileLayout) this.toggleLog(false);
      return;
    }

    if (this.winner) return;

    if (key === "r") {
      this.handleHumanRoll();
      event.preventDefault();
      return;
    }
    if (key === "e") {
      this.handleHumanEndTurn();
      event.preventDefault();
      return;
    }
    if (key === "1") {
      this.setPendingAction("road");
      event.preventDefault();
      return;
    }
    if (key === "2") {
      this.setPendingAction("settlement");
      event.preventDefault();
      return;
    }
    if (key === "3") {
      this.setPendingAction("city");
      event.preventDefault();
      return;
    }
    if (key === "b") {
      this.handleHumanBuyDevCard();
      event.preventDefault();
      return;
    }
    if (key === "p") {
      this.toggleDevCardPicker();
      event.preventDefault();
      return;
    }
    if (key === "t") {
      this.openTradeModal();
      event.preventDefault();
      return;
    }
    if (key === "a") {
      if (this.autoplayInterval) this.stopAutoplay();
      else this.startAutoplay();
      this.render();
      event.preventDefault();
      return;
    }
    if (key === "v") {
      this.resetViewTransform();
      event.preventDefault();
    }
    if (key === "n" && this.winner) {
      this.stopAutoplay();
      this.resetGame();
      event.preventDefault();
    }
  }

  updateHoverTargets(worldX, worldY) {
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";

    // Confirm icon hover detection
    if (this.confirmBuild && this.hitTestConfirmIcon(worldX, worldY)) {
      this.hoverTooltip = "Confirm";
      this.canvas.style.cursor = "pointer";
      return;
    }

    const player = this.currentPlayer;
    const humanMain = player?.isHuman && this.phase === "main";

    if (this.setupPhase && player?.isHuman) {
      if (this.setupAction === "settlement") {
        const nodeId = this.findNodeAt(worldX, worldY);
        if (nodeId != null && this.canBuildSettlement(player, nodeId, true)) {
          this.hoverNodeId = nodeId;
          this.hoverTooltip = "Place settlement";
          this.canvas.style.cursor = "pointer";
          return;
        }
      } else if (this.setupAction === "road") {
        const edgeId = this.findEdgeAt(worldX, worldY);
        if (edgeId != null) {
          this.hoverEdgeId = edgeId;
          this.hoverTooltip = "Place road";
          this.canvas.style.cursor = "pointer";
          return;
        }
      }
      this.canvas.style.cursor = "crosshair";
      return;
    }

    // Robber placement: highlight hovered hex
    if (player?.isHuman && this.pendingAction === "robber") { // also before rolling (Knight)
      const hexId = this.findHexAt(worldX, worldY);
      if (hexId != null && hexId !== this.robberHexId) {
        this.hoverHexId = hexId;
        const hex = this.geometry.hexes[hexId];
        const label = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource];
        // No tooltip — hex highlight is enough
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "crosshair";
      }
      return;
    }

    if (humanMain && this.pendingAction === "road") {
      const edgeId = this.findEdgeAt(worldX, worldY);
      if (edgeId != null && this.canBuildRoad(player, edgeId, { free: false })) {
        this.hoverEdgeId = edgeId;
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "crosshair";
      }
      return;
    }
    if (humanMain && (this.pendingAction === "settlement" || this.pendingAction === "city")) {
      const nodeId = this.findNodeAt(worldX, worldY);
      const buildable =
        nodeId != null &&
        (this.pendingAction === "settlement"
          ? this.canBuildSettlement(player, nodeId, false)
          : this.canBuildCity(player, nodeId, false));
      if (buildable) {
        this.hoverNodeId = nodeId;
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "crosshair";
      }
      return;
    }

    this.canvas.style.cursor = "grab";
  }

  findHexAt(x, y) {
    for (const hex of this.geometry.hexes) {
      if (pointInPolygon(x, y, hex.corners)) return hex.id;
    }
    return null;
  }

  findNodeAt(x, y) {
    let bestId = null;
    const hitRadius = Math.max(16, this.geometry.hexSize * 0.28);
    let bestDist = hitRadius;
    this.geometry.nodes.forEach((node) => {
      const dist = Math.hypot(x - node.x, y - node.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = node.id;
      }
    });
    return bestId;
  }

  findEdgeAt(x, y) {
    let bestId = null;
    const hitRadius = Math.max(10, this.geometry.hexSize * 0.18);
    let bestDist = hitRadius;
    this.geometry.edges.forEach((edge) => {
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      const dist = distancePointToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = edge.id;
      }
    });
    return bestId;
  }

  executeRollPhase(player) {
    if (this.phase !== "pre_roll" || this.setupPhase) return Promise.resolve();
    if (this.diceResult) {
      this.lastRoll = this.diceResult.total;
      this.lastDice = { d1: this.diceResult.d1, d2: this.diceResult.d2 };
      this.lastRollPlayer = player;
      this.diceResult = null;
    } else {
      const r = this.rollDice();
      this.lastRoll = r.total;
      this.lastDice = { d1: r.d1, d2: r.d2 };
      this.lastRollPlayer = player;
    }
    this.phase = "main";
    if (this.rollHistory[this.lastRoll] != null) this.rollHistory[this.lastRoll]++;
    this.addLog(`Turn ${this.turn}: ${player.name} rolled ${this.lastRoll}.`);
    this.sfx.diceResult();
    // Highlight matching hex tokens
    if (this.lastRoll !== 7) {
      this.highlightRoll = { number: this.lastRoll, startTime: Date.now() };
    }
    this.checkForWinner(player);
    // Returns a promise that settles once any robber flow (discards, robber move, steal) is done
    if (this.lastRoll === 7) return this.resolveRobber(player, "rolled a 7");
    const gains = this.distributeResources(this.lastRoll);
    // Show resource gain toasts for ALL players
    if (gains) this.showResourceGainToasts(gains);
    return Promise.resolve();
  }

  distributeResources(roll) {
    const owed = this.players.map(() => makeEmptyResources());
    this.geometry.hexes.forEach((hex) => {
      if (hex.id === this.robberHexId || hex.number !== roll) return;
      hex.nodes.forEach((nodeId) => {
        const node = this.geometry.nodes[nodeId];
        if (node.owner == null || node.structure == null) return;
        owed[node.owner][hex.resource] += node.structure === "city" ? 2 : 1;
      });
    });
    // Bank shortage rule: if the bank can't pay everyone owed a resource, nobody gets it —
    // unless only one player is owed it, in which case they get whatever is left.
    const gainByPlayer = this.players.map(() => makeEmptyResources());
    RESOURCES.forEach((resource) => {
      const claimants = owed.flatMap((o, id) => (o[resource] > 0 ? [id] : []));
      const totalOwed = claimants.reduce((sum, id) => sum + owed[id][resource], 0);
      if (!totalOwed) return;
      if (totalOwed > this.bank[resource] && claimants.length > 1) {
        this.addLog(`Bank is short of ${RESOURCE_LABEL[resource]} — no one receives it.`);
        return;
      }
      claimants.forEach((id) => {
        gainByPlayer[id][resource] = this.takeFromBank(this.players[id], resource, owed[id][resource]);
      });
    });
    gainByPlayer.forEach((gain, playerId) => {
      if (sumResources(gain) > 0) {
        this.addLog(`${this.players[playerId].name} collect${this._s(this.players[playerId])} ${resourceString(gain)}.`);
      }
    });
    return gainByPlayer;
  }

  // A human seat is driven interactively unless autoplay is running all seats.
  _isInteractive(player) {
    return player.isHuman && !this.autoplayInterval;
  }

  // Rolled 7: everyone with more than 7 cards discards half, then the robber moves.
  // Returns a promise that resolves once discards are done and the robber has been handled
  // (for an interactive human roller: once robber placement mode has been entered).
  resolveRobber(currentPlayer, reason) {
    // Collect players that need to discard
    const discardQueue = [];
    this.players.forEach((player) => {
      const total = sumResources(player.resources);
      if (total <= this.settings.discardLimit) return;
      const discardCount = Math.floor(total / 2);
      if (this._isInteractive(player)) {
        discardQueue.push({ player, count: discardCount });
      } else {
        this._autoDiscard(player, discardCount);
        this.addLog(`${player.name} discard${this._s(player)} ${discardCount} cards after ${reason}.`);
      }
    });

    if (!discardQueue.length) {
      this.moveRobber(currentPlayer);
      return Promise.resolve();
    }
    // Human discards first; the rest of the turn waits on this promise.
    // The flow is kept in serializable form so a reload can resume it.
    this.pendingRobberFlow = {
      rollerId: currentPlayer.id,
      discards: discardQueue.map(({ player, count }) => ({ playerId: player.id, count })),
    };
    this.saveToStorage();
    return this._runPendingRobberFlow();
  }

  // Discard `count` random cards (weighted by how many of each the player holds) to the bank.
  _autoDiscard(player, count) {
    const selected = makeEmptyResources();
    for (let i = 0; i < count; i += 1) {
      const candidates = RESOURCES.filter((r) => player.resources[r] - selected[r] > 0).map((r) => ({
        resource: r,
        weight: player.resources[r] - selected[r],
      }));
      if (!candidates.length) break;
      selected[chooseRandomWeighted(candidates).resource] += 1;
    }
    this.payToBank(player, selected);
    return selected;
  }

  // ── Friendly robber ──
  // Players (other than the mover) with <= 2 public VP are protected when the rule is on.
  _isRobberProtected(playerId, mover) {
    if (!this.settings.friendlyRobber || playerId === mover?.id) return false;
    return (this.players[playerId]?.publicVictoryPoints ?? 0) <= FRIENDLY_ROBBER_VP;
  }

  _hexTouchesProtected(hex, mover) {
    return hex.nodes.some((nodeId) => {
      const owner = this.geometry.nodes[nodeId].owner;
      return owner != null && this._isRobberProtected(owner, mover);
    });
  }

  // Hexes the robber may move to (falls back to any other hex if the rule blocks them all)
  _legalRobberHexes(mover) {
    const others = this.geometry.hexes.filter((h) => h.id !== this.robberHexId);
    if (!this.settings.friendlyRobber) return others;
    const strict = others.filter((h) => !this._hexTouchesProtected(h, mover));
    return strict.length ? strict : others;
  }

  _robberHexAllowed(hexId, mover) {
    return this._legalRobberHexes(mover).some((h) => h.id === hexId);
  }

  // Players the mover may steal from on a hex
  _stealVictims(hexId, mover) {
    const victims = new Set();
    this.geometry.hexes[hexId].nodes.forEach((nodeId) => {
      const owner = this.geometry.nodes[nodeId].owner;
      if (owner == null || owner === mover.id || this._isRobberProtected(owner, mover)) return;
      if (sumResources(this.players[owner].resources) > 0) victims.add(owner);
    });
    return [...victims];
  }

  // Run (or resume after reload) the pending discards, then move the robber.
  _runPendingRobberFlow() {
    const flow = this.pendingRobberFlow;
    this.robberBusy = true;
    const next = () => {
      const item = flow.discards[0];
      if (!item) return Promise.resolve();
      return this._showDiscardUI(this.players[item.playerId], item.count).then(this._guard(() => {
        flow.discards.shift();
        return next();
      }));
    };
    return next().then(this._guard(() => {
      this.robberBusy = false;
      this.pendingRobberFlow = null;
      this.moveRobber(this.players[flow.rollerId]);
      this.saveToStorage();
      this.render();
    }));
  }

  // Robber move + steal only (no discards) — used directly by the Knight card.
  moveRobber(currentPlayer) {
    if (this._isInteractive(currentPlayer)) {
      this.robberContext = { playerId: currentPlayer.id };
      this.pendingAction = "robber";
      this.addLog("Move the robber — tap a tile.");
      this.render();
      return;
    }
    const targetHexId = this.chooseRobberHex(currentPlayer);
    this.moveRobberAndSteal(currentPlayer, targetHexId);
  }

  chooseRobberHex(currentPlayer) {
    const awareness = currentPlayer.strategy?.awareness || "basic";

    const legal = this._legalRobberHexes(currentPlayer);
    const legalIds = new Set(legal.map((h) => h.id));
    // None: random non-desert hex
    if (awareness === "none") {
      const candidates = legal.filter(h => h.resource !== "desert" && h.number);
      if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)].id;
      return legal[0]?.id ?? this.robberHexId;
    }

    // Advanced: identify VP leader and target them specifically
    const vpLeader = awareness === "advanced"
      ? this.players.filter(p => p.id !== currentPlayer.id).sort((a, b) => b.publicVictoryPoints - a.publicVictoryPoints)[0]
      : null;

    let bestHex = legal[0]?.id ?? this.robberHexId;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.geometry.hexes.forEach((hex) => {
      if (!legalIds.has(hex.id)) return;
      let score = 0;
      hex.nodes.forEach((nodeId) => {
        const node = this.geometry.nodes[nodeId];
        if (node.owner == null || node.structure == null || !hex.number) return;
        const base = (node.structure === "city" ? 2 : 1) * (DICE_WEIGHT[hex.number] / 6);
        if (node.owner === currentPlayer.id) {
          score -= base;
        } else {
          score += base;
          // Advanced: heavily weight hexes that hurt the VP leader
          if (awareness === "advanced" && vpLeader && node.owner === vpLeader.id) {
            score += base * (vpLeader.publicVictoryPoints >= this.winPoints - 3 ? 2.0 : 0.8);
          }
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestHex = hex.id;
      }
    });
    return bestHex;
  }

  moveRobberAndSteal(currentPlayer, targetHexId) {
    this.robberHexId = targetHexId;
    this.addLog(`${currentPlayer.name} moved robber to ${this._hexLabel(this.geometry.hexes[targetHexId])}.`);
    this.sfx.robber();
    const victims = this._stealVictims(targetHexId, currentPlayer);
    if (!victims.length) return;
    // Advanced awareness: steal from VP leader
    let victimId;
    const awareness = currentPlayer.strategy?.awareness || "basic";
    if (awareness === "advanced" && victims.length > 1) {
      victimId = victims.sort((a, b) => this.players[b].publicVictoryPoints - this.players[a].publicVictoryPoints)[0];
    } else {
      victimId = victims[Math.floor(Math.random() * victims.length)];
    }
    this._doSteal(currentPlayer, victimId);
  }

  _doSteal(currentPlayer, victimId) {
    const victim = this.players[victimId];
    // Pick a random card from the victim's hand (weighted by count per resource)
    const available = RESOURCES.filter((r) => victim.resources[r] > 0).map((r) => ({
      resource: r,
      weight: victim.resources[r],
    }));
    if (!available.length) return;
    const stolen = chooseRandomWeighted(available).resource;
    victim.resources[stolen] -= 1;
    currentPlayer.resources[stolen] += 1;
    this.addLog(`${currentPlayer.name} stole 1 ${RESOURCE_LABEL[stolen]} from ${victim.name}.`);
    this.sfx.steal();
    this._showStealAnimation(currentPlayer, victim, stolen);
  }

  _animateStealCard(thief, victim, resource) {
    const boardPanel = document.querySelector(".board-panel");
    if (!boardPanel || !this.scoreboard) return;
    const boardRect = boardPanel.getBoundingClientRect();

    // Find victim avatar position (source)
    const victimEl = this.scoreboard.querySelector(`.player-card-mini:nth-child(${victim.id + 1}) .player-avatar`);
    const thiefEl = this.scoreboard.querySelector(`.player-card-mini:nth-child(${thief.id + 1}) .player-avatar`);
    let srcX, srcY, dstX, dstY;
    if (victimEl) {
      const r = victimEl.getBoundingClientRect();
      srcX = r.left + r.width / 2 - boardRect.left;
      srcY = r.top + r.height / 2 - boardRect.top;
    } else {
      srcX = boardRect.width - 30;
      srcY = 30 + victim.id * 40;
    }
    if (thiefEl) {
      const r = thiefEl.getBoundingClientRect();
      dstX = r.left + r.width / 2 - boardRect.left;
      dstY = r.top + r.height / 2 - boardRect.top;
    } else {
      dstX = boardRect.width - 30;
      dstY = 30 + thief.id * 40;
    }

    const card = document.createElement("div");
    card.className = `flying-card ${resource}`;
    card.innerHTML = `<img src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />`;
    card.style.left = `${srcX}px`;
    card.style.top = `${srcY}px`;
    card.style.setProperty("--fly-x", `${dstX - srcX}px`);
    card.style.setProperty("--fly-y", `${dstY - srcY}px`);
    card.style.borderColor = "rgba(200, 50, 50, 0.5)";
    boardPanel.appendChild(card);
    setTimeout(() => card.remove(), 600);
  }

  _animateTradeCards(give, get) {
    // Received cards pop on the hand with a "+n" once the hand has re-rendered
    window.setTimeout(() => {
      RESOURCES.forEach((r) => {
        if (!get[r]) return;
        const card = document.querySelector(`#resourceCardStrip .card[data-card="${r}"]`);
        if (card) this.fx?.plus(card, get[r]);
      });
    }, 60);
  }

  _showStealAnimation(thief, victim, resource) {
    const youInvolved = thief.isHuman || victim.isHuman;
    this.fx?.steal(thief.id, victim.id, resource, youInvolved);
  }

  stealFromVictim(currentPlayer, victimId) {
    this._doSteal(currentPlayer, victimId);
  }

  showVictimPanel(currentPlayer, victimIds) {
    if (!this.victimPanel || !this.victimOptionsEl) return;
    this.victimOptionsEl.innerHTML = "";
    victimIds.forEach((vid) => {
      const v = this.players[vid];
      const totalCards = sumResources(v.resources);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "victim-btn";
      btn.innerHTML = `${this._av(v)}<span class="who pc-${v.id}">${v.name}</span><span class="vc">${icon("cards")}${totalCards} card${totalCards === 1 ? "" : "s"}</span>`;
      btn.addEventListener("click", this._guard(() => {
        if (!this.robberVictimOptions?.includes(vid)) return;
        this.stealFromVictim(currentPlayer, vid);
        this.robberContext = null;
        this.robberVictimOptions = [];
        this.victimPanel.style.display = "none";
        this.saveToStorage();
        this.render();
      }));
      this.victimOptionsEl.appendChild(btn);
    });
    this.victimPanel.style.display = "";
  }

  // ── Trade Modal ──────────────────────────────────────────────────────

  openTradeModal() {
    if (!this.tradeModal) return;
    // Toggle: if already open, close it
    if (this.tradeModal.style.display !== "none") {
      this.closeTradeModal();
      return;
    }
    this.tradeModal.style.display = "";
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this.tradeLocked = false;
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
    this.buildTradeGrids();
    this.updateTradeButtons();
  }

  closeTradeModal() {
    if (!this.tradeModal) return;
    if (this.tradeModal.style.display !== "none" && this.tradeProposalResult) {
      this.tradeProposalResult.innerHTML = ""; // drop any pending Confirm/Accept buttons
    }
    this.tradeLocked = false;
    this.tradeModal.style.display = "none";
  }

  hideTradePanel() {
    this.closeTradeModal();
  }

  buildTradeGrids() {
    const player = this.currentPlayer;
    const maxOffer = player?.isHuman ? player.resources : null;
    this._renderResourceGrid(this.tradeOfferGrid, this.tradeOffer, maxOffer, true);
    this._renderResourceGrid(this.tradeRequestGrid, this.tradeRequest, null, false);
    this._renderTradeHand(player);
  }

  _renderTradeHand(player) {
    // Rates row: bank 4:1 plus the harbours this player owns
    const el = document.querySelector("#tradeRates");
    if (!el || !player) return;
    const ports = new Set();
    [...player.settlements, ...player.cities].forEach((n) => this.geometry.nodes[n].ports.forEach((t) => ports.add(t)));
    const chips = [`<span class="rate">${icon("bank")}Bank 4 : 1</span>`];
    if (ports.has("any")) chips.push(`<span class="rate">${icon("trade")}Any 3 : 1</span>`);
    RESOURCES.filter((r) => ports.has(r)).forEach((r) => chips.push(`<span class="rate">${icon(r)}Your harbor 2 : 1</span>`));
    el.innerHTML = chips.join("");
  }

  _renderResourceGrid(container, counts, maxCounts, isOffer) {
    if (!container) return;
    const player = this.currentPlayer;
    container.innerHTML = RESOURCES.map((resource) => {
      const max = maxCounts ? maxCounts[resource] : 19;
      const count = counts[resource];
      const rate = isOffer && player ? this.getPlayerTradeRate(player, resource) : null;
      return `<div class="rcell trade-res-item${count > 0 ? " pick" : ""}${isOffer && !max ? " dim" : ""}">
        ${rate && rate < 4 ? `<span class="rate-tag">${rate}:1</span>` : ""}
        <button type="button" class="card trade-res-card ${resource}${count > 0 ? " has-count" : ""}" data-res="${resource}" aria-label="${isOffer ? "Give" : "Want"} ${RESOURCE_LABEL[resource]}">${cardSvg(resource)}</button>
        <span class="n">${count}</span>
        ${isOffer ? `<span class="have">of ${max}</span>` : ""}
        <div class="step"><button type="button" class="trade-res-minus" data-minus="${resource}" aria-label="One less" ${count > 0 && !this.tradeLocked ? "" : "disabled"}>−</button><button type="button" data-plus="${resource}" aria-label="One more" ${count < max && !this.tradeLocked ? "" : "disabled"}>+</button></div>
      </div>`;
    }).join("");
    const inc = (resource) => {
      if (this.tradeLocked) return; // grid is locked while a proposal is pending
      const max = maxCounts ? maxCounts[resource] : 19;
      if (counts[resource] + 1 > max) return;
      counts[resource] += 1;
      this._refreshTradeGrids();
    };
    container.querySelectorAll(".trade-res-card").forEach((card) => {
      card.addEventListener("click", () => {
        // "You give": the first tap on a card offers a full bank/harbor set (fewer taps to trade)
        const res = card.dataset.res;
        if (isOffer && player && !this.tradeLocked && counts[res] === 0) {
          const rate = this.getPlayerTradeRate(player, res);
          const max = maxCounts ? maxCounts[res] : 19;
          if (max >= rate) { counts[res] = rate; this._refreshTradeGrids(); return; }
        }
        inc(res);
      });
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (this.tradeLocked || counts[card.dataset.res] <= 0) return;
        counts[card.dataset.res] -= 1;
        this._refreshTradeGrids();
      });
    });
    container.querySelectorAll("[data-plus]").forEach((b) => b.addEventListener("click", () => inc(b.dataset.plus)));
    container.querySelectorAll("[data-minus]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.tradeLocked) return;
      counts[b.dataset.minus] = Math.max(0, counts[b.dataset.minus] - 1);
      this._refreshTradeGrids();
    }));
  }

  _refreshTradeGrids() {
    this.buildTradeGrids();
    this.updateTradeButtons();
  }

  updateTradeButtons() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman) return;
    const offerTotal = sumResources(this.tradeOffer);
    const requestTotal = sumResources(this.tradeRequest);

    // Bank trade: exactly 1 resource type offered, exactly 1 requested, at correct rate
    const offeredTypes = RESOURCES.filter(r => this.tradeOffer[r] > 0);
    const requestedTypes = RESOURCES.filter(r => this.tradeRequest[r] > 0);
    let canBank = false;
    if (offeredTypes.length === 1 && requestedTypes.length === 1 && offeredTypes[0] !== requestedTypes[0]) {
      const giveRes = offeredTypes[0];
      const rate = this.getPlayerTradeRate(player, giveRes);
      canBank = this.tradeOffer[giveRes] === rate && this.tradeRequest[requestedTypes[0]] === 1
        && this.bank[requestedTypes[0]] >= 1;
    }
    if (this.tradeExecuteBtn) {
      this.tradeExecuteBtn.disabled = !canBank;
      const rate = offeredTypes.length === 1 ? this.getPlayerTradeRate(player, offeredTypes[0]) : 4;
      this.tradeExecuteBtn.innerHTML = `${icon("bank")}<span>${rate < 4 ? "Harbor" : "Bank"} ${rate}:1</span>`;
    }
    // Say why the bank/harbor trade is not available yet
    const hint = document.querySelector("#tradeHint");
    if (hint) {
      let why = "";
      if (!canBank) {
        if (!offerTotal && !requestTotal) why = "Bank: give 4 of one kind (less at your harbors) for 1 card. Ask players: any mix.";
        else if (offeredTypes.length !== 1) why = "Bank trades take one kind of card.";
        else if (requestedTypes.length !== 1 || this.tradeRequest[requestedTypes[0]] !== 1) why = "Bank: pick exactly 1 card you want.";
        else if (offeredTypes[0] === requestedTypes[0]) why = "Pick a different card to get.";
        else if (this.bank[requestedTypes[0]] < 1) why = `The bank is out of ${RESOURCE_LABEL[requestedTypes[0]]}.`;
        else {
          const rate = this.getPlayerTradeRate(player, offeredTypes[0]);
          why = `Bank: give exactly ${rate} ${RESOURCE_LABEL[offeredTypes[0]]} for 1.`;
        }
      }
      hint.textContent = why;
    }
    // Player trade: any non-zero offer and request, with no resource on both sides
    if (this.tradeProposalBtn) {
      const overlap = RESOURCES.some(r => this.tradeOffer[r] > 0 && this.tradeRequest[r] > 0);
      this.tradeProposalBtn.disabled = !(offerTotal > 0 && requestTotal > 0) || overlap;
    }
  }

  // A player trade is only valid on the proposer's own main phase, in the same turn it was
  // proposed, with nothing blocking and both sides still holding the cards.
  _playerTradeStillValid(proposer, turnSerial, partner, proposerGives, partnerGives) {
    return !this.winner && this.phase === "main" && this.currentPlayer === proposer
      && this.turnSerial === turnSerial && !this._robberInProgress()
      && hasResources(proposer.resources, proposerGives) && hasResources(partner.resources, partnerGives);
  }

  handleHumanPlayerTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.phase !== "main" || this._robberInProgress()) return;
    // Snapshot the offer — the trade grids may change before the player confirms
    const offer = copyResources(this.tradeOffer);
    const request = copyResources(this.tradeRequest);
    const turnSerial = this.turnSerial;
    if (sumResources(offer) === 0 || sumResources(request) === 0) {
      if (this.tradeProposalResult) this.tradeProposalResult.textContent = "Select resources to give and get.";
      return;
    }
    if (RESOURCES.some(r => offer[r] > 0 && request[r] > 0)) {
      if (this.tradeProposalResult) this.tradeProposalResult.textContent = "Can't give and get the same resource.";
      return;
    }
    // Check player can afford offer
    for (const r of RESOURCES) {
      if (player.resources[r] < offer[r]) {
        if (this.tradeProposalResult) this.tradeProposalResult.textContent = `Not enough ${r}.`;
        return;
      }
    }
    // Propose to all players — collect responses
    const responses = [];
    const acceptors = [];
    for (const other of this.players) {
      if (other.id === player.id) continue;
      if (other.isHuman) continue;
      const accepts = this.aiEvaluateTrade(other, offer, request);
      responses.push({ player: other, accepts });
      if (accepts) acceptors.push(other);
    }

    // Show visual response for each player
    if (this.tradeProposalResult) {
      this.tradeProposalResult.innerHTML = responses.map(r =>
        `<span class="who pc-${r.player.id}">${r.player.name}</span> ${r.accepts ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}`
      ).join("&nbsp;&nbsp;");
    }

    if (acceptors.length > 0) {
      if (this.tradeProposalResult) {
        // Lock the grids: only the snapshot the AI accepted can be executed
        this.tradeLocked = true;
        // Helper to execute trade with a chosen partner
        const executeTrade = this._guard((partner) => {
          if (!this._playerTradeStillValid(player, turnSerial, partner, offer, request)) {
            this.tradeProposalResult.innerHTML = '<span class="no">Trade no longer valid.</span>';
            this.tradeLocked = false;
            return;
          }
          RESOURCES.forEach((r) => {
            player.resources[r] -= offer[r];
            player.resources[r] += request[r];
            partner.resources[r] -= request[r];
            partner.resources[r] += offer[r];
          });
          this.addLog(`Traded with ${partner.name}: gave ${resourceString(offer)} for ${resourceString(request)}.`);
          this.sfx.trade();
          this.tradeOffer = makeEmptyResources();
          this.tradeRequest = makeEmptyResources();
          this.buildTradeGrids();
          this.updateTradeButtons();
          this.tradeProposalResult.innerHTML = `<span class="ok">Traded with ${partner.name}!</span>`;
          this.tradeLocked = false;
          this.render();
        });

        if (acceptors.length === 1) {
          // Single acceptor: confirm/cancel
          this.tradeProposalResult.innerHTML += `<br><span class="ok">${acceptors[0].name} accepts!</span>`;
          const btnRow = document.createElement("div");
          btnRow.className = "row";
          const confirmBtn = document.createElement("button");
          confirmBtn.className = "primary-sm";
          confirmBtn.textContent = "Confirm";
          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn-neutral";
          cancelBtn.textContent = "Cancel";
          confirmBtn.addEventListener("click", () => executeTrade(acceptors[0]));
          cancelBtn.addEventListener("click", () => {
            this.tradeProposalResult.innerHTML = '<span>Trade cancelled.</span>';
            this.tradeLocked = false;
          });
          btnRow.appendChild(confirmBtn);
          btnRow.appendChild(cancelBtn);
          this.tradeProposalResult.appendChild(btnRow);
        } else {
          // Multiple acceptors: let player choose
          this.tradeProposalResult.innerHTML += `<br><span style="font-size:0.65rem">Choose trading partner:</span>`;
          const btnRow = document.createElement("div");
          btnRow.className = "row";
          acceptors.forEach(acc => {
            const btn = document.createElement("button");
            btn.className = "primary-sm";
            btn.innerHTML = `${acc.name}`;
            btn.addEventListener("click", () => executeTrade(acc));
            btnRow.appendChild(btn);
          });
          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn-neutral";
          cancelBtn.textContent = "Cancel";
          cancelBtn.addEventListener("click", () => {
            this.tradeProposalResult.innerHTML = '<span>Trade cancelled.</span>';
            this.tradeLocked = false;
          });
          btnRow.appendChild(cancelBtn);
          this.tradeProposalResult.appendChild(btnRow);
        }
      }
    } else {
      this.addLog("All players rejected your trade offer.");
      // Try to generate a counter-offer from AI
      const counter = this._generateCounterOffer(player, offer, request);
      if (counter && this.tradeProposalResult) {
        const cGive = resourceString(counter.give);
        const cWant = resourceString(counter.want);
        this.tradeProposalResult.innerHTML += `<br><span class="who pc-${counter.player.id}">${counter.player.name}</span>: “I'll give ${cGive} for ${cWant}.”`;
        // Add accept button for counter-offer
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "primary-sm";
        acceptBtn.textContent = "Accept";
        acceptBtn.addEventListener("click", this._guard(() => {
          // Execute the counter-offer trade — revalidate turn, phase and both hands first
          const human = player;
          if (!this._playerTradeStillValid(human, turnSerial, counter.player, counter.want, counter.give)) {
            this.tradeProposalResult.innerHTML = '<span class="no">Trade no longer valid.</span>';
            this.tradeLocked = false;
            return;
          }
          RESOURCES.forEach(r => {
            human.resources[r] -= counter.want[r];
            human.resources[r] += counter.give[r];
            counter.player.resources[r] -= counter.give[r];
            counter.player.resources[r] += counter.want[r];
          });
          this.addLog(`You traded with ${counter.player.name}: gave ${cWant} for ${cGive}.`);
          this.sfx.trade();
          this.tradeOffer = makeEmptyResources();
          this.tradeRequest = makeEmptyResources();
          this.buildTradeGrids();
          this.updateTradeButtons();
          this.tradeProposalResult.innerHTML = `<span class="ok">Traded with ${counter.player.name}!</span>`;
          this.tradeLocked = false;
          this.render();
        }));
        this.tradeProposalResult.appendChild(acceptBtn);
      }
    }
  }

  // ── AI Trade Evaluation ─────────────────────────────────────────────

  aiEvaluateTrade(aiPlayer, theyGive, theyWant) {
    const strat = aiPlayer.strategy?.trading || "balanced";
    if (strat === "none" || strat === "conservative") return false;

    // Check AI can afford what's being asked
    for (const r of RESOURCES) {
      if (aiPlayer.resources[r] < theyWant[r]) return false;
    }

    // Opponent awareness affects trade willingness
    const awareness = aiPlayer.strategy?.awareness || "basic";
    const maxVP = Math.max(...this.players.filter(p => p.id !== aiPlayer.id).map(p => p.publicVictoryPoints));
    if (awareness === "basic" && maxVP >= this.winPoints - 2) return false;
    if (awareness === "advanced" && maxVP >= this.winPoints - 3) return false;

    // Quick accept: 1:1 trade where AI has surplus and needs what's offered
    const giveTotal = sumResources(theyWant);
    const getTotal = sumResources(theyGive);
    if (giveTotal === 1 && getTotal === 1) {
      const giveRes = RESOURCES.find(r => theyWant[r] > 0);
      const getRes = RESOURCES.find(r => theyGive[r] > 0);
      // Accept if AI has 2+ of what's asked and needs what's offered for any goal
      const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
      const needsGet = goals.some(g => (g[getRes] || 0) > aiPlayer.resources[getRes]);
      const hasSurplus = aiPlayer.resources[giveRes] >= 2;
      if (needsGet && hasSurplus) return true;
    }

    // Score: does the trade help AI reach a goal?
    const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
    const resBefore = { ...aiPlayer.resources };
    const resAfter = {};
    RESOURCES.forEach((r) => {
      resAfter[r] = resBefore[r] - theyWant[r] + theyGive[r];
    });

    let scoreBefore = 0;
    let scoreAfter = 0;
    for (const goal of goals) {
      const defBefore = RESOURCES.reduce((sum, r) => sum + Math.max(0, (goal[r] || 0) - resBefore[r]), 0);
      const defAfter = RESOURCES.reduce((sum, r) => sum + Math.max(0, (goal[r] || 0) - resAfter[r]), 0);
      scoreBefore += defBefore === 0 ? 10 : (1 / (1 + defBefore));
      scoreAfter += defAfter === 0 ? 10 : (1 / (1 + defAfter));
    }

    // Aggressive: accept marginal trades; Balanced: need clear improvement
    const threshold = strat === "aggressive" ? 0.0 : 0.05;
    return scoreAfter > scoreBefore + threshold;
  }

  // Generate a counter-offer: "I'll give you what you want, but I need X from you instead"
  _generateCounterOffer(humanPlayer, humanOffer, humanRequest) {
    const requestedRes = RESOURCES.filter(r => humanRequest[r] > 0);
    if (!requestedRes.length) return null;

    for (const ai of this.players) {
      if (ai.isHuman || ai.id === humanPlayer.id) continue;
      const strat = ai.strategy?.trading || "balanced";
      if (strat === "none" || strat === "conservative") continue;

      // Can this AI give what the human wants?
      let canGive = true;
      for (const r of requestedRes) {
        if (ai.resources[r] < humanRequest[r]) { canGive = false; break; }
      }
      if (!canGive) continue;

      // What does the AI actually need? (different from what human offered)
      const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
      const aiNeeds = RESOURCES.filter(r => {
        return goals.some(g => (g[r] || 0) > ai.resources[r]) && humanPlayer.resources[r] > 0;
      });
      // Filter out resources the human already offered (that's the original offer)
      const offeredRes = RESOURCES.filter(r => humanOffer[r] > 0);
      // ...and never ask for the same resource the AI would be giving
      const newNeeds = aiNeeds.filter(r => !offeredRes.includes(r) && !requestedRes.includes(r));
      if (!newNeeds.length) continue;

      // Counter: AI gives what human wants, but wants a different resource
      const want = makeEmptyResources();
      want[newNeeds[0]] = 1;
      const give = makeEmptyResources();
      give[requestedRes[0]] = 1;
      return { player: ai, give, want };
    }
    return null;
  }

  // AI proposes trades during its turn
  aiTryPlayerTrade(aiPlayer) {
    const strat = aiPlayer.strategy?.trading || "balanced";
    if (strat === "none" || strat === "conservative") return null;
    const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
    for (const goal of goals) {
      if (hasResources(aiPlayer.resources, goal)) continue;
      // Find what we need
      const needs = RESOURCES.filter(r => (goal[r] || 0) > aiPlayer.resources[r]);
      // Find what we have surplus of
      const surpluses = RESOURCES.filter(r => {
        const needed = goals.reduce((max, g) => Math.max(max, g[r] || 0), 0);
        return aiPlayer.resources[r] > needed;
      });
      if (!needs.length || !surpluses.length) continue;

      const wanted = needs[0];
      const giving = surpluses[0];
      if (wanted === giving) continue;

      const offer = makeEmptyResources();
      const request = makeEmptyResources();
      offer[giving] = 1;
      request[wanted] = 1;

      // Try trading with each other player
      for (const other of this.players) {
        if (other.id === aiPlayer.id) continue;
        if (other.resources[wanted] <= 0) continue;

        if (this._isInteractive(other)) {
          // Show incoming trade popup to human — handled async (during autoplay the human seat is a bot)
          return { type: "human", fromPlayer: aiPlayer, give: offer, want: request };
        }

        // AI-to-AI: check if other AI accepts
        if (this.aiEvaluateTrade(other, offer, request)) {
          RESOURCES.forEach((r) => {
            aiPlayer.resources[r] -= offer[r];
            aiPlayer.resources[r] += request[r];
            other.resources[r] -= request[r];
            other.resources[r] += offer[r];
          });
          this.addLog(`${aiPlayer.name} traded ${resourceString(offer)} with ${other.name} for ${resourceString(request)}.`);
          return { type: "done" };
        }
      }
    }
    return null;
  }

  _renderTradeCards(resources) {
    let html = '<div class="offer-cards incoming-trade-cards">';
    RESOURCES.forEach((r) => {
      for (let i = 0; i < (resources[r] || 0); i += 1) html += `<span class="card incoming-trade-card ${r}" title="${RESOURCE_LABEL[r]}">${cardSvg(r)}</span>`;
    });
    return html + "</div>";
  }

  showIncomingTrade(fromPlayer, give, want) {
    return new Promise((resolve) => {
      if (!this.incomingTradePanel) { resolve(false); return; }
      this.incomingTradeHeader.innerHTML = `${this._av(fromPlayer)}<span><span class="who pc-${fromPlayer.id}">${fromPlayer.name}</span> wants to trade</span>`;
      const human = this.players.find((p) => p.isHuman);
      const handHtml = human ? `<div class="your-hand">Your hand: ${RESOURCES.filter((r) => human.resources[r] > 0).map((r) => `<span>${icon(r)}${human.resources[r]}</span>`).join("") || "empty"}</div>` : "";
      this.incomingTradeBody.innerHTML = `<div class="offer-rows">
          <div class="offer-row"><span class="lbl2">You get</span>${this._renderTradeCards(give)}</div>
          <div class="offer-row"><span class="lbl2">You give</span>${this._renderTradeCards(want)}</div>
        </div>${handHtml}`;
      this.pendingIncomingTrade = { fromPlayer, give, want, resolve };
      this.toggleBuildSheet?.(false);
      this.incomingTradePanel.style.display = "";
    });
  }

  resolveIncomingTrade(accepted) {
    if (!this.pendingIncomingTrade) return;
    const { fromPlayer, give, want, resolve } = this.pendingIncomingTrade;
    const human = this.players.find(p => p.isHuman);
    if (accepted && human && !(hasResources(human.resources, want) && hasResources(fromPlayer.resources, give))) {
      accepted = false;
      this.addLog(`Trade with ${fromPlayer.name} is no longer possible.`);
    } else if (accepted && human) {
      this._animateTradeCards(want, give);
      // AI gives 'give' to human, human gives 'want' to AI
      RESOURCES.forEach((r) => {
        human.resources[r] -= want[r];
        human.resources[r] += give[r];
        fromPlayer.resources[r] -= give[r];
        fromPlayer.resources[r] += want[r];
      });
      this.addLog(`You accepted ${fromPlayer.name}'s trade: got ${resourceString(give)} for ${resourceString(want)}.`);
    } else {
      this.addLog(`You rejected ${fromPlayer.name}'s trade offer.`);
    }
    this.pendingIncomingTrade = null;
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    this.render();
    resolve(accepted);
  }

  canBuildRoad(player, edgeId, options = {}) {
    const edge = this.geometry.edges[edgeId];
    if (!edge || edge.owner != null) return false;
    if (this.piecesLeft(player, "road") <= 0) return false;
    const { free = false, setupNode = null } = options;
    if (!free && !hasResources(player.resources, COSTS.road)) return false;
    if (setupNode != null) return edge.nodes.includes(setupNode);

    const connected = edge.nodes.some((nodeId) => {
      const node = this.geometry.nodes[nodeId];
      const ownedOrEmpty = node.owner == null || node.owner === player.id;
      if (!ownedOrEmpty) return false;
      return node.owner === player.id || node.edgeIds.some((id) => this.geometry.edges[id].owner === player.id);
    });
    return connected;
  }

  canBuildSettlement(player, nodeId, setup = false) {
    const node = this.geometry.nodes[nodeId];
    if (!node || node.structure != null) return false;
    if (this.piecesLeft(player, "settlement") <= 0) return false;
    if (node.neighbors.some((neighborId) => this.geometry.nodes[neighborId].structure != null)) return false;
    if (setup) return true;
    if (!hasResources(player.resources, COSTS.settlement)) return false;
    return node.edgeIds.some((edgeId) => this.geometry.edges[edgeId].owner === player.id);
  }

  canBuildCity(player, nodeId, free = false) {
    const node = this.geometry.nodes[nodeId];
    if (!node || node.owner !== player.id || node.structure !== "settlement") return false;
    if (this.piecesLeft(player, "city") <= 0) return false; // upgrading returns the settlement piece
    if (!free && !hasResources(player.resources, COSTS.city)) return false;
    return true;
  }

  _hasLegalRoad(player, free) {
    return this.geometry.edges.some((edge) => this.canBuildRoad(player, edge.id, { free }));
  }

  placeRoad(player, edgeId, options = {}) {
    if (!this.canBuildRoad(player, edgeId, options)) return false;
    this.geometry.edges[edgeId].owner = player.id;
    player.roads.add(edgeId);
    // Placement animation
    const edge = this.geometry.edges[edgeId];
    const [a, b] = edge.nodes;
    const p1 = this.geometry.nodes[a];
    const p2 = this.geometry.nodes[b];
    this.placementAnims.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, type: "road", startTime: Date.now(), color: player.color });
    return true;
  }

  placeSettlement(player, nodeId, setup = false) {
    if (!this.canBuildSettlement(player, nodeId, setup)) return false;
    const node = this.geometry.nodes[nodeId];
    node.owner = player.id;
    node.structure = "settlement";
    player.settlements.add(nodeId);
    this.placementAnims.push({ x: node.x, y: node.y, type: "settlement", startTime: Date.now(), color: player.color });
    return true;
  }

  placeCity(player, nodeId, free = false) {
    if (!this.canBuildCity(player, nodeId, free)) return false;
    const node = this.geometry.nodes[nodeId];
    node.structure = "city";
    player.settlements.delete(nodeId);
    player.cities.add(nodeId);
    this.placementAnims.push({ x: node.x, y: node.y, type: "city", startTime: Date.now(), color: player.color });
    return true;
  }

  getPlayerTradeRate(player, resource) {
    let rate = 4;
    const nodeIds = [...player.settlements, ...player.cities];
    nodeIds.forEach((nodeId) => {
      const ports = this.geometry.nodes[nodeId].ports;
      ports.forEach((type) => {
        if (type === "any") rate = Math.min(rate, 3);
        if (type === resource) rate = Math.min(rate, 2);
      });
    });
    return rate;
  }

  performBankTrade(player, give, get) {
    const rate = this.getPlayerTradeRate(player, give);
    if (give === get || player.resources[give] < rate || this.bank[get] < 1) return false;
    player.resources[give] -= rate;
    this.bank[give] += rate;
    this.takeFromBank(player, get, 1);
    this.addLog(`${player.name} traded ${rate} ${RESOURCE_LABEL[give]} for 1 ${RESOURCE_LABEL[get]}.`);
    return true;
  }

  buyDevelopmentCard(player) {
    if (!this.devDeck.length) {
      this.addLog("Development deck is empty.");
      return false;
    }
    if (!hasResources(player.resources, COSTS.development)) {
      this.addLog(`${player.name} cannot afford a development card.`);
      return false;
    }
    this.payToBank(player, COSTS.development);
    const card = this.devDeck.pop();
    if (card === "victoryPoint") {
      player.devVictoryPoints += 1;
      if (player.isHuman) {
        this.addLog(`You drew a Victory Point card (kept secret).`);
        this._showDevCardPopup("Victory Point", "Counts as 1 VP at game end");
      } else {
        this.addLog(`${player.name} bought a development card.`);
      }
    } else {
      player.newDevCards[card] += 1;
      const cardLabels = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
      if (player.isHuman) {
        this.addLog(`You drew: ${cardLabels[card]}!`);
        this._showDevCardPopup(cardLabels[card], this._getDevCardDescription(card));
      } else {
        this.addLog(`${player.name} bought a development card.`);
      }
    }
    this.sfx.devCard();
    return true;
  }

  _getDevCardDescription(card) {
    const descriptions = {
      knight: "Move the robber and steal a resource",
      roadBuilding: "Build 2 roads for free",
      yearOfPlenty: "Take any 2 resources from the bank",
      monopoly: "Take all of 1 resource type from all players",
    };
    return descriptions[card] || "";
  }

  _showDevCardPopup(title, description) {
    const type = Object.keys(DEV_NAME).find((k) => DEV_NAME[k] === title) || "knight";
    this.fx?.devReveal(type);
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "toast dev-card-toast";
    toast.innerHTML = `<span class="card">${cardSvg(type)}</span><div>You drew <b>${title}</b><span class="sub">${description}</span></div>`;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-4px)";
      setTimeout(() => toast.remove(), 180);
    }, 4000);
  }

  canPlayDevelopmentCard(player, type) {
    if (this.isRush()) return this._rushCanPlayDev(player, type);
    if (this.winner || this.setupPhase || this.currentTurnPlayedDevCard) return false;
    if (player !== this.currentPlayer || !(player.devCards[type] > 0)) return false;
    // Knight may be played before rolling; the other cards only after
    if (this.phase !== "main" && !(type === "knight" && this.phase === "pre_roll")) return false;
    // Not while a robber move, discard, steal choice, trade prompt or free-road placement is pending
    if (this._robberInProgress() || this.pendingIncomingTrade || this.freeRoadsRemaining > 0) return false;
    if (type === "yearOfPlenty" && sumResources(this.bank) === 0) return false;
    if (type === "roadBuilding" && !this._hasLegalRoad(player, true)) return false;
    return true;
  }

  playDevelopmentCard(player, type) {
    if (!this.canPlayDevelopmentCard(player, type)) return false;
    player.devCards[type] -= 1;
    if (this.isRush()) player.rushDevPlayed = true;
    else this.currentTurnPlayedDevCard = true;

    if (type === "knight") {
      // Knight only moves the robber and steals — no discards (that's for rolling a 7)
      player.knightsPlayed += 1;
      this.addLog(`${player.name} played Knight.`);
      this.moveRobber(player);
    } else if (type === "roadBuilding") {
      if (this._isInteractive(player)) {
        // Human: enter interactive free-road-placement mode
        this.freeRoadsRemaining = Math.min(2, this.piecesLeft(player, "road"));
        this.pendingAction = "road";
        this.addLog(`${player.name} played Road Building — place 2 free roads.`);
        this.render();
        return true; // Don't call recomputeScores yet, will be called after placement
      }
      let built = 0;
      for (let i = 0; i < 2; i += 1) {
        const edgeId = this.chooseStrategicRoadEdge(player, true);
        if (edgeId == null) break;
        if (this.placeRoad(player, edgeId, { free: true })) built += 1;
      }
      this.addLog(`${player.name} played Road Building and placed ${built} road(s).`);
    } else if (type === "yearOfPlenty") {
      if (this._isInteractive(player)) {
        // Can only take what the bank actually has
        const count = Math.min(2, sumResources(this.bank));
        this._showResourcePicker(`Year of Plenty — pick ${count} resource${count > 1 ? "s" : ""}`, count, this._guard((picks) => {
          const gained = picks.filter((resource) => this.takeFromBank(player, resource, 1) > 0);
          this.addLog(`${player.name} played Year of Plenty and took ${gained.map((r) => `1 ${RESOURCE_LABEL[r]}`).join(" + ")}.`);
          this.recomputeScores();
          this.checkForWinner(player);
          this.render();
        }), this.bank);
        return true;
      }
      const picks = this.chooseYearOfPlentyResources(player);
      const gained = picks.filter((resource) => this.takeFromBank(player, resource, 1) > 0);
      this.addLog(`${player.name} played Year of Plenty and took ${gained.map((r) => `1 ${RESOURCE_LABEL[r]}`).join(" + ")}.`);
    } else if (type === "monopoly") {
      if (this._isInteractive(player)) {
        this._showResourcePicker("Monopoly — pick 1 resource to steal", 1, this._guard((picks) => {
          const target = picks[0];
          let collected = 0;
          this.players.forEach((other) => {
            if (other.id === player.id) return;
            collected += other.resources[target];
            other.resources[target] = 0;
          });
          player.resources[target] += collected;
          this.addLog(`${player.name} played Monopoly on ${RESOURCE_LABEL[target]} and collected ${collected}.`);
          this.recomputeScores();
          this.checkForWinner(player);
          this.render();
        }));
        return true;
      }
      const target = this.chooseBestMonopolyResource(player);
      let collected = 0;
      this.players.forEach((other) => {
        if (other.id === player.id) return;
        collected += other.resources[target];
        other.resources[target] = 0;
      });
      player.resources[target] += collected;
      this.addLog(`${player.name} played Monopoly on ${RESOURCE_LABEL[target]} and collected ${collected}.`);
    }

    this.recomputeScores();
    return true;
  }

  chooseYearOfPlentyResources(player) {
    // Picks are limited to what the bank holds
    const bank = copyResources(this.bank);
    const picks = [];
    const take = (resource) => {
      if (picks.length < 2 && bank[resource] > 0) {
        bank[resource] -= 1;
        picks.push(resource);
      }
    };
    const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
    for (const goal of goals) {
      const deficits = RESOURCES.flatMap((resource) => {
        const need = Math.max(0, (goal[resource] || 0) - player.resources[resource]);
        return Array(need).fill(resource);
      });
      if (deficits.length) {
        deficits.forEach(take);
        if (deficits.length === 1) take(deficits[0]);
        break;
      }
    }
    ["wheat", "ore", ...RESOURCES].forEach(take);
    return picks;
  }

  chooseBestMonopolyResource(player) {
    let bestResource = "wheat";
    let bestScore = Number.NEGATIVE_INFINITY;
    RESOURCES.forEach((resource) => {
      const fromOpponents = this.players.reduce((acc, other) => {
        if (other.id === player.id) return acc;
        return acc + other.resources[resource];
      }, 0);
      const ownNeed = Math.max(
        0,
        2 - player.resources[resource] + (resource === "ore" || resource === "wheat" ? 1 : 0),
      );
      const score = fromOpponents + ownNeed * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestResource = resource;
      }
    });
    return bestResource;
  }

  autoPlayCurrentTurn() {
    // Never roll during setup, and never act while a roll/robber/trade flow is still in flight
    if (this.winner || this.setupPhase || this.isRush()) return; // Rush bots run on their own ticks
    if (this._aiDiceAnimating || this.robberBusy || this.pendingDiscard || this.pendingIncomingTrade) return;
    const player = this.currentPlayer;
    if (this.phase === "pre_roll") {
      if (this._robberInProgress()) return; // human placing robber from a pre-roll Knight
      this.maybePlayKnightBeforeRoll(player);
      // Show dice animation for AI players too
      if (!player.isHuman) {
        this._aiDiceAnimating = true;
        this.animateDiceRoll(() => {
          // _aiDiceAnimating stays set until the delayed main phase starts, so no other
          // loop tick can act on this turn in between
          const robberDone = this.executeRollPhase(player);
          this.render();
          // Delay before AI actions so card-deal animation plays out
          // Longer delay on 7 so the robber move + steal are visible
          const actionDelay = this.lastRoll !== 7 ? 800 : 1800;
          // Wait for the robber flow (e.g. the human discarding) before continuing the turn
          robberDone.then(this._guard(() => this._later(() => {
            this._aiDiceAnimating = false;
            if (this.winner) return;
            if (this.phase === "main" && this.currentPlayer === player) {
              const result = this.executeAiMainPhase(player);
              if (result === "async") return;
              this.endTurn();
            }
            this.saveToStorage();
            this.render();
            if (!this.winner && !this.autoplayInterval && !this.currentPlayer.isHuman) {
              this.scheduleAiTurnsUntilHuman();
            }
          }, actionDelay)));
        }, player);
        return; // Wait for animation
      }
      this.executeRollPhase(player);
      if (this.robberBusy || this.winner) return; // resumes on a later tick once resolved
    }
    if (this.phase === "main") {
      if (this._robberInProgress()) return;
      const result = this.executeAiMainPhase(player);
      if (result === "async") return; // Will resume after human responds to trade
      this.endTurn();
    }
  }

  executeAiMainPhase(player, skipPlayerTrade = false) {
    const s = player.strategy || {};
    this._aiLog(player, `Main phase — strategy: placement=${s.placement}, expansion=${s.expansion}, trading=${s.trading}, devCards=${s.devCards}, awareness=${s.awareness}`);
    this._aiLog(player, `Resources: ${resourceString(player.resources)} (${sumResources(player.resources)} total)`);
    if (!this.winner) {
      this.maybePlayBestDevCard(player);
    }

    // Try player-to-player trade once per turn
    if (!skipPlayerTrade) {
      const tradeResult = this.aiTryPlayerTrade(player);
      if (tradeResult && tradeResult.type === "human") {
        // Need async human response — pause AI turn, show popup
        this._pendingAiTradePlayer = player;
        this.showIncomingTrade(tradeResult.fromPlayer, tradeResult.give, tradeResult.want).then(this._guard(() => {
          // Resume AI turn after human responds
          if (this.winner || this.currentPlayer !== player) return;
          this.executeAiMainPhase(player, true);
          this.endTurn();
          this.render();
          if (!this.winner && !this.currentPlayer.isHuman) {
            this.scheduleAiTurnsUntilHuman();
          }
        }));
        return "async";
      }
    }

    const actionFns = this._getActionPriority(player);
    const actionLabels = this._getActionLabels(player);
    // Show AI reasoning popup: evaluate which actions are possible
    if (this.showAiReasoning) {
      const considered = [];
      for (let i = 0; i < actionLabels.length; i++) {
        const label = actionLabels[i];
        const canDo = this._canDoAction(player, label);
        const score = actionLabels.length - i; // priority order = score
        considered.push({ label, score, possible: canDo });
      }
      const top3 = considered.slice(0, 5);
      const lines = top3.map((c, i) =>
        `${i + 1}. ${c.label} ${c.possible ? "✓" : "✗"} (priority ${c.score})`
      );
      this._showAiReasoningPopup(player, lines);
    }
    let actions = 0;
    while (actions < 10) {
      if (this.winner) break;
      let acted = false;
      for (const fn of actionFns) {
        if (fn()) { acted = true; actions++; break; }
      }
      if (!acted) break;
    }
    this.recomputeScores();
    this.checkForWinner(player);
    return "done";
  }

  _aiLog(player, msg) {
    if (this.showAiReasoning) this.addLog(`[${player.name}] ${msg}`);
  }

  _getActionLabels(player) {
    const s = player.strategy || {};
    const robberOnSelf = this.geometry.hexes[this.robberHexId].nodes.some(nid =>
      this.geometry.nodes[nid].owner === player.id
    );
    if (robberOnSelf && player.devCards.knight === 0 && s.devCards !== "none") {
      return ["Buy Dev", "Settlement", "City", "Bank Trade", "Road"];
    }
    if (s.awareness === "advanced" && player.victoryPoints >= this.winPoints - 2) {
      return ["City", "Buy Dev", "Settlement", "Bank Trade", "Road"];
    }
    if (s.devCards === "strategic") {
      const armyHolder = this.largestArmyHolder;
      const holderKnights = armyHolder != null ? this.players[armyHolder].knightsPlayed : 2;
      if (player.knightsPlayed >= holderKnights - 2 && armyHolder !== player.id) {
        return ["Settlement", "City", "Buy Dev", "Road", "Bank Trade"];
      }
    }
    return ["Settlement", "City", "Road", "Buy Dev", "Bank Trade"];
  }

  _canDoAction(player, label) {
    switch (label) {
      case "Settlement": return hasResources(player.resources, COSTS.settlement);
      case "City": return hasResources(player.resources, COSTS.city);
      case "Road": return hasResources(player.resources, COSTS.road);
      case "Buy Dev": return hasResources(player.resources, COSTS.development);
      case "Bank Trade": return sumResources(player.resources) >= 2;
      default: return false;
    }
  }

  _showAiReasoningPopup(player, lines) {
    let popup = document.getElementById("aiReasoningPopup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "aiReasoningPopup";
      popup.className = "ai-reasoning-popup";
      document.body.appendChild(popup);
    }
    popup.innerHTML = `
      <div class="ai-reasoning-header" style="color:${player.color}">
        ${this._av(player)}
        ${player.name}'s Turn
      </div>
      ${lines.map(l => `<div class="ai-reasoning-line">${l}</div>`).join("")}
    `;
    popup.style.display = "block";
    popup.style.opacity = "1";
    clearTimeout(this._aiReasoningTimeout);
    this._aiReasoningTimeout = setTimeout(() => {
      popup.style.opacity = "0";
      setTimeout(() => { popup.style.display = "none"; }, 300);
    }, 3000);
  }

  _getActionPriority(player) {
    const s = player.strategy || {};
    const settlement = () => this.tryBuildSettlement(player);
    const city = () => this.tryBuildCity(player);
    const road = () => this.tryBuildRoad(player);
    const dev = () => s.devCards !== "none" && this.devDeck.length > 0
      && hasResources(player.resources, COSTS.development) && this.buyDevelopmentCard(player);
    const trade = () => this.tryTradeForGoal(player);

    // Robber on own hex: prioritize dev cards to get a knight
    const robberOnSelf = this.geometry.hexes[this.robberHexId].nodes.some(nid =>
      this.geometry.nodes[nid].owner === player.id
    );
    if (robberOnSelf && player.devCards.knight === 0 && s.devCards !== "none") {
      return [dev, settlement, city, trade, road];
    }

    // Advanced awareness at 8+ VP: prioritize points
    if (s.awareness === "advanced" && player.victoryPoints >= this.winPoints - 2) {
      return [city, dev, settlement, trade, road];
    }
    // Strategic dev cards: buy dev cards earlier when chasing army
    if (s.devCards === "strategic") {
      const armyHolder = this.largestArmyHolder;
      const holderKnights = armyHolder != null ? this.players[armyHolder].knightsPlayed : 2;
      if (player.knightsPlayed >= holderKnights - 2 && armyHolder !== player.id) {
        return [settlement, city, dev, road, trade];
      }
    }
    // Default priority
    return [settlement, city, road, dev, trade];
  }

  maybePlayBestDevCard(player) {
    const strat = player.strategy?.devCards || "reactive";
    if (strat === "none") return false;
    if ((this.isRush() ? player.rushDevPlayed : this.currentTurnPlayedDevCard) || this.phase !== "main") return false;

    if (player.devCards.knight > 0 && this.shouldPlayKnight(player)) {
      return this.playDevelopmentCard(player, "knight");
    }
    if (player.devCards.monopoly > 0 && this.shouldPlayMonopoly(player)) {
      return this.playDevelopmentCard(player, "monopoly");
    }
    if (player.devCards.yearOfPlenty > 0 && this.shouldPlayYearOfPlenty(player)) {
      return this.playDevelopmentCard(player, "yearOfPlenty");
    }
    if (player.devCards.roadBuilding > 0 && this.shouldPlayRoadBuilding(player)) {
      return this.playDevelopmentCard(player, "roadBuilding");
    }
    return false;
  }

  shouldPlayKnight(player) {
    const strat = player.strategy?.devCards || "reactive";
    const badRobber = this.geometry.hexes[this.robberHexId].nodes.some((nodeId) => {
      const node = this.geometry.nodes[nodeId];
      return node.owner === player.id;
    });
    if (badRobber) return true;

    // Playing this knight would claim Largest Army
    const armyHolder = this.largestArmyHolder;
    const holderKnights = armyHolder != null ? this.players[armyHolder].knightsPlayed : 2;
    if (armyHolder !== player.id && player.knightsPlayed + 1 > holderKnights) return true;
    // Strategic: hold the knight while we already own the army (unless chasing is close)
    if (strat === "strategic" && armyHolder === player.id) return false;

    // Otherwise only worth it to block a high-yield hex of the (publicly) leading opponent
    const target = this.chooseRobberHex(player);
    if (target === this.robberHexId) return false;
    const hex = this.geometry.hexes[target];
    if (!hex.number || DICE_WEIGHT[hex.number] < 4) return false;
    const leader = this.players
      .filter((p) => p.id !== player.id)
      .sort((a, b) => b.publicVictoryPoints - a.publicVictoryPoints)[0];
    if (!leader || leader.publicVictoryPoints < player.publicVictoryPoints) return false;
    return hex.nodes.some((nodeId) => this.geometry.nodes[nodeId].owner === leader.id);
  }

  // AI: play a Knight before rolling when the robber is sitting on one of our hexes.
  maybePlayKnightBeforeRoll(player) {
    if (player.isHuman && !this.autoplayInterval) return false;
    if ((player.strategy?.devCards || "reactive") === "none") return false;
    if (!this.canPlayDevelopmentCard(player, "knight")) return false;
    const robberOnUs = this.geometry.hexes[this.robberHexId].nodes.some(
      (nodeId) => this.geometry.nodes[nodeId].owner === player.id,
    );
    if (!robberOnUs) return false;
    const played = this.playDevelopmentCard(player, "knight");
    if (played) {
      this.recomputeScores();
      this.checkForWinner(player);
    }
    return played;
  }

  shouldPlayMonopoly(player) {
    const strat = player.strategy?.devCards || "reactive";
    const target = this.chooseBestMonopolyResource(player);
    const total = this.players.reduce((acc, other) => {
      if (other.id === player.id) return acc;
      return acc + other.resources[target];
    }, 0);

    if (strat === "strategic") {
      // Strategic: play even at 2 if we urgently need that resource for a build
      const goals = [COSTS.city, COSTS.settlement];
      for (const goal of goals) {
        if ((goal[target] || 0) > player.resources[target] && total >= 2) return true;
      }
      // Otherwise wait for higher threshold
      return total >= 4;
    }
    return total >= 3;
  }

  shouldPlayYearOfPlenty(player) {
    const picks = this.chooseYearOfPlentyResources(player);
    return picks.length === 2;
  }

  shouldPlayRoadBuilding(player) {
    return this.chooseStrategicRoadEdge(player, true) != null;
  }

  tryBuildSettlement(player) {
    if (!hasResources(player.resources, COSTS.settlement)) return false;
    const candidates = this.getBuildableSettlementNodes(player);
    if (!candidates.length) return false;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!this.placeSettlement(player, best.nodeId, false)) return false;
    this.payToBank(player, COSTS.settlement);
    this.addLog(`${player.name} built a settlement.`);
    this.sfx.buildSettlement();
    this._aiLog(player, `Chose settlement at node ${best.nodeId} (score ${best.score.toFixed(2)}, ${candidates.length} options)`);
    this.recomputeScores();
    this.checkForWinner(player);
    return true;
  }

  tryBuildCity(player) {
    if (!hasResources(player.resources, COSTS.city)) return false;
    const nodeId = this.getBestCityTarget(player);
    if (nodeId == null) return false;
    if (!this.placeCity(player, nodeId, false)) return false;
    this.payToBank(player, COSTS.city);
    this.addLog(`${player.name} upgraded to a city.`);
    this.sfx.buildCity();
    this._aiLog(player, `Upgraded node ${nodeId} — highest dice probability settlement`);
    this.recomputeScores();
    this.checkForWinner(player);
    return true;
  }

  tryBuildRoad(player) {
    if (!hasResources(player.resources, COSTS.road)) return false;
    // Don't build roads if we should save resources for a settlement
    const canAffordSettlement = hasResources(player.resources, COSTS.settlement);
    const hasBuildableSpot = this.getBuildableSettlementNodes(player).length > 0;
    if (canAffordSettlement && hasBuildableSpot) return false; // Build settlement instead
    // Don't build more than 2 roads ahead without a settlement target
    const strat = player.strategy?.expansion || "medium";
    if (strat !== "complex") {
      const target = this.selectRoadExpansionTarget(player, strat);
      if (target == null && player.roads.size >= player.settlements.size * 3) return false;
    }
    const edgeId = this.chooseStrategicRoadEdge(player, false);
    if (edgeId == null) return false;
    if (!this.placeRoad(player, edgeId, { free: false })) return false;
    this.payToBank(player, COSTS.road);
    this.addLog(`${player.name} built a road.`);
    this.sfx.buildRoad();
    this._aiLog(player, `Expansion strategy: ${player.strategy?.expansion || "medium"}`);
    this.recomputeScores();
    this.checkForWinner(player);
    return true;
  }

  tryTradeForGoal(player) {
    const strat = player.strategy?.trading || "balanced";
    if (strat === "none") return false;

    const goals = [COSTS.settlement, COSTS.city, COSTS.development, COSTS.road];
    let traded = false;
    for (const goal of goals) {
      if (hasResources(player.resources, goal)) continue;
      const deficits = RESOURCES.map((resource) => ({
        resource,
        need: Math.max(0, (goal[resource] || 0) - player.resources[resource]),
      }))
        .filter((entry) => entry.need > 0)
        .sort((a, b) => b.need - a.need);
      if (!deficits.length) continue;

      const wanted = deficits[0].resource;
      if (this.bank[wanted] < 1) continue; // bank can't supply it
      const incomes = this.getResourceIncomeProfile(player);
      const donors = RESOURCES.map((resource) => ({
        resource,
        rate: this.getPlayerTradeRate(player, resource),
        surplus: player.resources[resource] - (goal[resource] || 0),
        income: incomes[resource],
      }))
        .filter((entry) => {
          if (entry.resource === wanted) return false;
          // Conservative: need extra buffer beyond rate
          if (strat === "conservative") return entry.surplus >= entry.rate + 1;
          // Aggressive: trade even at exactly the rate
          if (strat === "aggressive") return player.resources[entry.resource] >= entry.rate;
          // Balanced (default): surplus must cover rate
          return entry.surplus >= entry.rate;
        })
        .sort((a, b) => b.surplus - a.surplus || b.income - a.income);
      if (!donors.length) continue;
      this._aiLog(player, `Bank trade: ${donors[0].resource} → ${wanted} (rate ${donors[0].rate}:1, surplus ${donors[0].surplus})`);
      if (!this.performBankTrade(player, donors[0].resource, wanted)) continue;
      if (strat === "aggressive") { traded = true; continue; }
      return true;
    }
    return traded;
  }

  getResourceIncomeProfile(player) {
    const income = makeEmptyResources();
    [...player.settlements, ...player.cities].forEach((nodeId) => {
      const node = this.geometry.nodes[nodeId];
      const amount = node.structure === "city" ? 2 : 1;
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (!hex.number || hex.resource === "desert") return;
        income[hex.resource] += (DICE_WEIGHT[hex.number] / 36) * amount;
      });
    });
    return income;
  }

  getNodeProductionScore(nodeId, player) {
    const node = this.geometry.nodes[nodeId];
    if (node.structure != null) return Number.NEGATIVE_INFINITY;
    if (node.neighbors.some((neighborId) => this.geometry.nodes[neighborId].structure != null)) {
      return Number.NEGATIVE_INFINITY;
    }

    const strat = player.strategy?.placement || "medium";

    // ── Simple: pure dice probability ──
    if (strat === "simple") {
      let score = 0;
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (hex.resource === "desert" || !hex.number) return;
        score += DICE_WEIGHT[hex.number] / 6;
      });
      return score;
    }

    // ── Medium (default): scarcity + diversity + ports + blocking ──
    const income = this.getResourceIncomeProfile(player);
    const resourceSeen = new Set();
    let score = 0;
    node.adjacentHexes.forEach((hexId) => {
      const hex = this.geometry.hexes[hexId];
      if (hex.resource === "desert" || !hex.number) return;
      const scarcityWeight = 1 + Math.max(0, 0.85 - income[hex.resource]) * 0.7;
      score += (DICE_WEIGHT[hex.number] / 6) * scarcityWeight;
      resourceSeen.add(hex.resource);
    });
    score += resourceSeen.size * 0.42;

    const ports = node.ports;
    if (ports.includes("any")) score += 0.4;
    if (ports.some((type) => type !== "any" && income[type] > 0.5)) score += 0.4;

    let blockValue = 0;
    node.neighbors.forEach((neighborId) => {
      const owner = this.geometry.nodes[neighborId].owner;
      if (owner != null && owner !== player.id) blockValue += 0.45;
    });
    score += blockValue;

    // ── Complex: add goal-completion bonus, port targeting, robber avoidance ──
    if (strat === "complex") {
      // Bonus for completing resource sets needed for buildings
      const needed = {};
      [COSTS.settlement, COSTS.city].forEach(cost => {
        RESOURCES.forEach(r => { needed[r] = Math.max(needed[r] || 0, cost[r] || 0); });
      });
      const missingTypes = RESOURCES.filter(r => income[r] < 0.2 && (needed[r] || 0) > 0);
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (hex.resource === "desert" || !hex.number) return;
        if (missingTypes.includes(hex.resource)) score += 0.5;
      });
      // Port targeting: 2:1 port for a resource we produce a lot of
      ports.forEach(type => {
        if (type !== "any" && income[type] > 0.8) score += 0.6;
      });
      // Slight penalty for 6/8 hexes (robber targets)
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (hex.number === 6 || hex.number === 8) score -= 0.15;
      });
    }

    return score;
  }

  getBestInitialSettlementNode(player) {
    let bestNodeId = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.geometry.nodes.forEach((node) => {
      const score = this.getNodeProductionScore(node.id, player);
      if (!Number.isFinite(score)) return;
      if (score > bestScore) {
        bestScore = score;
        bestNodeId = node.id;
      }
    });
    return bestNodeId;
  }

  getBestRoadFromNode(player, nodeId) {
    const node = this.geometry.nodes[nodeId];
    let bestEdge = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let fallbackEdge = null;
    node.edgeIds.forEach((edgeId) => {
      const edge = this.geometry.edges[edgeId];
      if (edge.owner != null) return;
      if (fallbackEdge == null) fallbackEdge = edgeId;
      const other = edge.nodes[0] === nodeId ? edge.nodes[1] : edge.nodes[0];
      if (this.geometry.nodes[other].structure != null) return;
      // The adjacent node is never buildable (distance rule), so score the best
      // settlement spot one step further out along this road
      let score = Number.NEGATIVE_INFINITY;
      this.geometry.nodes[other].neighbors.forEach((nextId) => {
        if (nextId === nodeId) return;
        score = Math.max(score, this.getNodeProductionScore(nextId, player));
      });
      if (score > bestScore) {
        bestScore = score;
        bestEdge = edgeId;
      }
    });
    return bestEdge ?? fallbackEdge;
  }

  getBuildableSettlementNodes(player) {
    const result = [];
    this.geometry.nodes.forEach((node) => {
      if (!this.canBuildSettlement(player, node.id, false)) return;
      result.push({ nodeId: node.id, score: this.getNodeProductionScore(node.id, player) });
    });
    return result;
  }

  getBestCityTarget(player) {
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    player.settlements.forEach((nodeId) => {
      let score = 0;
      this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (!hex.number || hex.resource === "desert") return;
        score += DICE_WEIGHT[hex.number] / 6;
      });
      if (score > bestScore) {
        bestScore = score;
        best = nodeId;
      }
    });
    return best;
  }

  chooseStrategicRoadEdge(player, freeBuild) {
    const strat = player.strategy?.expansion || "medium";

    // Simple: just pick best adjacent edge
    if (strat === "simple") {
      return this.getFallbackRoad(player, freeBuild);
    }

    // Complex: check if we should chase longest road
    if (strat === "complex") {
      const lrEdge = this._longestRoadChaseEdge(player, freeBuild);
      if (lrEdge != null) return lrEdge;
    }

    // Medium + Complex: pathfind to best expansion target
    const targetNode = this.selectRoadExpansionTarget(player, strat);
    if (targetNode != null) {
      const path = this.pathToNode(player, targetNode);
      if (path && path.length) {
        const candidate = path[0];
        if (this.canBuildRoad(player, candidate, { free: freeBuild })) return candidate;
      }
    }
    return this.getFallbackRoad(player, freeBuild);
  }

  _longestRoadChaseEdge(player, freeBuild) {
    // If we're within 2 of longest road holder, or no holder yet, try to extend
    const holderLen = this.longestRoadHolder != null ? this.players[this.longestRoadHolder].longestRoadLength : 4;
    if (player.longestRoadLength >= holderLen - 2 || this.longestRoadHolder === player.id) {
      // Find edge that extends our longest road
      let bestEdge = null;
      let bestLen = player.longestRoadLength;
      this.geometry.edges.forEach((edge) => {
        if (!this.canBuildRoad(player, edge.id, { free: freeBuild })) return;
        // Simulate: would this road increase our longest road?
        const connected = edge.nodes.some(nid =>
          this.geometry.nodes[nid].edgeIds.some(eid => this.geometry.edges[eid].owner === player.id)
        );
        if (connected) {
          // Heuristic: edges extending from endpoints of current network are better
          const endpoints = edge.nodes.filter(nid => {
            const n = this.geometry.nodes[nid];
            return n.owner == null || n.owner === player.id;
          });
          if (endpoints.length > 0) {
            const extScore = bestLen + 1;
            if (extScore > bestLen) {
              bestLen = extScore;
              bestEdge = edge.id;
            }
          }
        }
      });
      if (bestEdge != null && player.longestRoadLength >= holderLen - 1) return bestEdge;
    }
    return null;
  }

  selectRoadExpansionTarget(player, strat) {
    const pathPenalty = strat === "complex" ? 0.3 : 0.45;
    let bestNode = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.geometry.nodes.forEach((node) => {
      if (node.structure != null) return;
      if (node.neighbors.some((neighborId) => this.geometry.nodes[neighborId].structure != null)) return;
      const path = this.pathToNode(player, node.id);
      if (!path || !path.length) return;
      // Complex: also consider ports we don't have
      let portBonus = 0;
      if (strat === "complex" && node.ports.length > 0) {
        const income = this.getResourceIncomeProfile(player);
        node.ports.forEach(type => {
          if (type !== "any" && income[type] > 0.6) portBonus += 0.8;
          else if (type === "any") portBonus += 0.3;
        });
      }
      const score = this.getNodeProductionScore(node.id, player) + portBonus - path.length * pathPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node.id;
      }
    });
    return bestNode;
  }

  pathToNode(player, targetNodeId) {
    const startNodes = this.getRoadNetworkNodes(player);
    if (!startNodes.length) return null;
    const visited = new Set(startNodes);
    const queue = startNodes.map((nodeId) => ({ nodeId, newEdges: [] }));

    while (queue.length) {
      const current = queue.shift();
      if (current.nodeId === targetNodeId) return current.newEdges;
      for (const edgeId of this.geometry.nodes[current.nodeId].edgeIds) {
        const edge = this.geometry.edges[edgeId];
        if (edge.owner != null && edge.owner !== player.id) continue;
        const next = edge.nodes[0] === current.nodeId ? edge.nodes[1] : edge.nodes[0];
        if (visited.has(next)) continue;
        const nextNode = this.geometry.nodes[next];
        if (nextNode.owner != null && nextNode.owner !== player.id && next !== targetNodeId) continue;
        visited.add(next);
        queue.push({
          nodeId: next,
          newEdges: edge.owner == null ? [...current.newEdges, edgeId] : current.newEdges,
        });
      }
    }
    return null;
  }

  getRoadNetworkNodes(player) {
    const nodes = new Set();
    player.roads.forEach((edgeId) => {
      const edge = this.geometry.edges[edgeId];
      nodes.add(edge.nodes[0]);
      nodes.add(edge.nodes[1]);
    });
    player.settlements.forEach((nodeId) => nodes.add(nodeId));
    player.cities.forEach((nodeId) => nodes.add(nodeId));
    return [...nodes];
  }

  getFallbackRoad(player, freeBuild) {
    const candidates = [];
    this.geometry.edges.forEach((edge) => {
      if (!this.canBuildRoad(player, edge.id, { free: freeBuild })) return;
      const [a, b] = edge.nodes;
      const score = Math.max(this.getNodeProductionScore(a, player), this.getNodeProductionScore(b, player));
      candidates.push({ edgeId: edge.id, score });
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].edgeId;
  }

  computeLongestRoadLength(player) {
    if (!player.roads.size) return 0;
    const playerEdgeIds = [...player.roads];
    const incident = new Map();
    playerEdgeIds.forEach((edgeId) => {
      const edge = this.geometry.edges[edgeId];
      edge.nodes.forEach((nodeId) => {
        if (!incident.has(nodeId)) incident.set(nodeId, []);
        incident.get(nodeId).push(edgeId);
      });
    });

    const blocked = (nodeId) => {
      const owner = this.geometry.nodes[nodeId].owner;
      return owner != null && owner !== player.id;
    };

    const dfs = (nodeId, usedEdges) => {
      if (usedEdges.size > 0 && blocked(nodeId)) return 0;
      let best = 0;
      const options = incident.get(nodeId) || [];
      options.forEach((edgeId) => {
        if (usedEdges.has(edgeId)) return;
        usedEdges.add(edgeId);
        const edge = this.geometry.edges[edgeId];
        const next = edge.nodes[0] === nodeId ? edge.nodes[1] : edge.nodes[0];
        best = Math.max(best, 1 + dfs(next, usedEdges));
        usedEdges.delete(edgeId);
      });
      return best;
    };

    let longest = 0;
    incident.forEach((_, nodeId) => {
      longest = Math.max(longest, dfs(nodeId, new Set()));
    });
    return longest;
  }

  recomputeScores() {
    this.players.forEach((player) => {
      player.longestRoadLength = this.computeLongestRoadLength(player);
    });
    this.updateLongestRoadHolder();
    this.updateLargestArmyHolder();

    this.players.forEach((player, idx) => {
      const base = player.settlements.size + player.cities.size * 2 + player.devVictoryPoints;
      const roadBonus = this.longestRoadHolder === idx ? 2 : 0;
      const armyBonus = this.largestArmyHolder === idx ? 2 : 0;
      player.victoryPoints = base + roadBonus + armyBonus;
      // What opponents can see: hidden Victory Point cards excluded
      player.publicVictoryPoints = player.victoryPoints - player.devVictoryPoints;
    });
  }

  // VP shown to the human: full total for their own seat, public total for everyone else.
  displayVictoryPoints(player) {
    return player.isHuman ? player.victoryPoints : player.publicVictoryPoints;
  }

  updateLongestRoadHolder() {
    const lengths = this.players.map((p) => p.longestRoadLength);
    const maxLength = Math.max(...lengths);
    if (maxLength < 5) {
      this.longestRoadHolder = null;
      return;
    }
    const leaders = lengths.flatMap((length, idx) => (length === maxLength ? [idx] : []));
    if (leaders.length === 1) {
      this.longestRoadHolder = leaders[0];
      return;
    }
    if (this.longestRoadHolder != null && leaders.includes(this.longestRoadHolder)) return;
    this.longestRoadHolder = null;
  }

  updateLargestArmyHolder() {
    const sizes = this.players.map((p) => p.knightsPlayed);
    const maxSize = Math.max(...sizes);
    if (maxSize < 3) {
      this.largestArmyHolder = null;
      return;
    }
    const leaders = sizes.flatMap((size, idx) => (size === maxSize ? [idx] : []));
    if (leaders.length === 1) {
      this.largestArmyHolder = leaders[0];
      return;
    }
    if (this.largestArmyHolder != null && leaders.includes(this.largestArmyHolder)) return;
    this.largestArmyHolder = null;
  }

  checkForWinner(player) {
    // You can only win on your own turn (uses the full total incl. hidden VP cards);
    // in Rush there are no turns, so anyone wins the moment they reach the target
    if (this.winner || this.setupPhase) return false;
    if (!this.isRush() && player !== this.currentPlayer) return false;
    if (player.victoryPoints >= this.winPoints) {
      this.winner = player;
      this.phase = "game_over";
      this.addLog(`${player.name} win${this._s(player)} with ${player.victoryPoints} points!`);
      this.stopAutoplay();
      if (this.rush) this._stopRushTimers();
      this.saveToStorage();
      this.showGameOverOverlay();
      return true;
    }
    return false;
  }

  endTurn() {
    if (this.winner) return;
    const player = this.currentPlayer;
    DEV_CARD_TYPES.forEach((type) => {
      player.devCards[type] += player.newDevCards[type];
      player.newDevCards[type] = 0;
    });

    this.pendingAction = null;
    this.confirmBuild = null;
    this.currentTurnPlayedDevCard = false;
    this.freeRoadsRemaining = 0;
    this.lastRoll = null;
    // Invalidate any trade confirm/accept buttons left over from this turn
    this.turnSerial += 1;
    this.tradeLocked = false;
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    // A new round starts when play returns to the first player in setup order
    if (this.currentPlayerIndex === (this.setupQueue?.[0] ?? 0)) this.turn += 1;
    this.phase = "pre_roll";
    // A player who already has 10 VP (e.g. after an opponent's road was cut) wins at turn start
    this.checkForWinner(this.currentPlayer);

    if (this.turn > TURN_LIMIT && !this.winner) {
      const leader = this.players.reduce((best, current) =>
        current.victoryPoints > best.victoryPoints ? current : best,
      );
      this.winner = leader;
      this.phase = "game_over";
      this.addLog(`Turn limit reached. ${leader.name} win${this._s(leader)} by points.`);
      this.stopAutoplay();
      this.showGameOverOverlay();
    }
    this.saveToStorage();
    this.render();
  }

  startAutoplay() {
    if (this.winner) return;
    this.stopAiTurnLoop();
    const delay = Number(this.speedRange.value);
    this.autoplayInterval = window.setInterval(this._guard(() => {
      this.autoPlayCurrentTurn();
      this.render();
    }), delay);
    this.autoplayBtn.textContent = "Stop watching";
    // Rush: the human seat joins the bot ticks while autoplay runs
    if (this.rush && !this.setupPhase) {
      const human = this.players.find((p) => p.isHuman);
      if (human) this._scheduleBotTick(human, 500);
    }
    // Setup waiting on the human's settlement: let autoplay place it (rolling waits for setup to finish)
    if (this.setupPhase && this.setupAction === "settlement") {
      this.setupAction = null;
      this.confirmBuild = null;
      this.processSetupQueue();
    }
  }

  stopAutoplay() {
    if (!this.autoplayInterval) return;
    window.clearInterval(this.autoplayInterval);
    this.autoplayInterval = null;
    this.autoplayBtn.textContent = "Watch bots play";
  }

  stopAiTurnLoop() {
    if (!this.aiTurnTimeout) return;
    window.clearTimeout(this.aiTurnTimeout);
    this.aiTurnTimeout = null;
  }

  scheduleAiTurnsUntilHuman() {
    if (this.winner || this.autoplayInterval || this.setupPhase || this.isRush()) return;
    if (this.currentPlayer.isHuman) return;
    if (this.aiTurnTimeout) return;

    const cadence = Math.max(700, Math.min(2000, Math.round(Number(this.speedRange.value) * 0.7)));
    const step = this._guard(() => {
      this.aiTurnTimeout = null;
      if (this.winner || this.autoplayInterval || this.setupPhase || this.currentPlayer.isHuman || this._aiDiceAnimating) {
        if (this.currentPlayer.isHuman && !this.winner) this.sfx.yourTurn();
        this.render();
        return;
      }
      this.autoPlayCurrentTurn();
      // If dice is animating, don't schedule next step — the animation callback handles it
      if (this._aiDiceAnimating) return;
      this.render();
      if (!this.winner && !this.autoplayInterval && !this.currentPlayer.isHuman) {
        this.aiTurnTimeout = window.setTimeout(step, cadence);
      }
    });
    this.aiTurnTimeout = window.setTimeout(step, 500);
  }

  // ══ Rush mode ═══════════════════════════════════════════════════════
  // No turns: after the snake setup everyone builds, trades and plays dev cards at any time.
  // The dice roll automatically every N seconds (or as soon as every player votes Ready).
  // The game only pauses on a 7: discards, then the robber is moved by players in a fixed
  // rotating order. All timers go through _later(), so reset/new game cancels them.

  // Whether a seat is driven by the bot loop (the human seat too while autoplay runs)
  _rushIsBot(player) {
    return !player.isHuman || !!this.autoplayInterval;
  }

  _startRush(saved = null) {
    const n = this.players.length;
    this.rush = {
      rollNo: 0,
      remainingMs: this.settings.rushInterval * 1000,
      clockMs: 0,
      ready: [],
      robberOrder: this.setupQueue.slice(0, n),
      robberIdx: 0,
      paused: false,
      seven: null, // { stage: "discard"|"robber", discards: [{ playerId, count }], moverId, leftMs }
      offers: [],  // bot trade offers to the human: { id, fromId, give, want, expiresAt }
      ...(saved || {}),
    };
    this.rush.offers = (this.rush.offers || []).filter((o) => this.players[o.fromId]);
    this._offerSeq = this.rush.offers.reduce((m, o) => Math.max(m, o.id), 0);
    const human = this.players.find((p) => p.isHuman);
    this.currentPlayerIndex = human ? human.id : 0; // the human may act at any time
    this.turn = this.rush.rollNo;
    this.phase = this.rush.seven ? "seven" : "main";
    this.rush.paused = !!this.rush.seven;
    this._botTicks = new Map();
    if (!saved) this.addLog(`Rush! Build any time — dice roll every ${this.settings.rushInterval}s.`);
    // The live feed is part of the Rush HUD on wide screens
    if (window.innerWidth > 1080 && this.railLog && !this.railLog.classList.contains("open")) this.toggleLog();
    this._rushLastTs = performance.now();
    this._later(() => this._rushLoop(), 200);
    this.players.forEach((p, i) => {
      if (this._rushIsBot(p)) this._scheduleBotTick(p, 900 + i * 700 + Math.random() * 600);
    });
    if (this.rush.seven) this._rushRunSevenStage();
    this.saveToStorage();
    this.render();
  }

  _stopRushTimers() {
    // Loop and bot ticks stop themselves once a winner exists; drop pending offers
    if (this.rush) this.rush.offers = [];
    this._renderRushOffers();
  }

  _scheduleBotTick(player, delay) {
    if (!this._botTicks) this._botTicks = new Map();
    if (this._botTicks.has(player.id)) return;
    const id = this._later(() => {
      this._botTicks.delete(player.id);
      this._rushBotTick(player);
    }, delay);
    this._botTicks.set(player.id, id);
  }

  // Master clock: counts down to the next roll, runs 7-pause deadlines, expires offers.
  _rushLoop() {
    const r = this.rush;
    if (!r || this.winner) return;
    this._later(() => this._rushLoop(), 200);
    const now = performance.now();
    const dt = Math.min(1000, now - (this._rushLastTs || now));
    this._rushLastTs = now;
    // Everything freezes while the tab is hidden or the new-game screen is open
    if (document.hidden || this.uiPaused) return;
    this._rushSaveMs = (this._rushSaveMs || 0) + dt;
    if (this._rushSaveMs >= 3000) {
      this._rushSaveMs = 0;
      this.saveToStorage();
    }
    if (!r.paused) {
      r.clockMs += dt;
      r.remainingMs -= dt;
      const allReady = this.players.every((p) => r.ready.includes(p.id));
      if (r.remainingMs <= 0 || allReady) {
        this._rushRoll();
        return;
      }
    } else if (r.seven && Number.isFinite(r.seven.leftMs)) {
      r.seven.leftMs -= dt;
      if (r.seven.leftMs <= 0) this._rushSevenTimeout();
    }
    if (r.offers.length && r.offers.some((o) => o.expiresAt <= r.clockMs)) {
      r.offers = r.offers.filter((o) => o.expiresAt > r.clockMs);
      this._renderRushOffers();
    }
    this._renderRushHud();
  }

  _rushRoll() {
    const r = this.rush;
    if (!r || this.winner || r.paused) return;
    r.rollNo += 1;
    this.turn = r.rollNo;
    r.remainingMs = this.settings.rushInterval * 1000;
    r.ready = [];
    const res = this.rollDice();
    this.lastRoll = res.total;
    this.lastDice = { d1: res.d1, d2: res.d2 };
    this.lastRollPlayer = null;
    if (this.rollHistory[res.total] != null) this.rollHistory[res.total] += 1;
    // New roll interval: last interval's purchases become playable, one dev card each again
    this.players.forEach((p) => {
      DEV_CARD_TYPES.forEach((t) => {
        p.devCards[t] += p.newDevCards[t];
        p.newDevCards[t] = 0;
      });
      p.rushDevPlayed = false;
      p.rushTradeTried = false;
    });
    this.addLog(`Roll #${r.rollNo}: rolled ${res.total}.`);
    this.fx?.diceRoll(res.d1, res.d2);
    this.sfx.diceResult();
    this.lastDiceDisplay?.classList.remove("rush-flash");
    void this.lastDiceDisplay?.offsetWidth; // restart the flash animation
    this.lastDiceDisplay?.classList.add("rush-flash");
    if (res.total === 7) {
      this._rushBeginSeven();
    } else {
      this.highlightRoll = { number: res.total, startTime: Date.now() };
      const gains = this.distributeResources(res.total);
      if (gains) this.showResourceGainToasts(gains);
    }
    this._rushAfterAction();
  }

  // ── The 7: discards, then the robber (game paused) ──
  _rushBeginSeven() {
    const r = this.rush;
    r.paused = true;
    this.phase = "seven";
    const human = this.players.find((p) => p.isHuman);
    // Drop half-finished human build selections; finish a robber move left from a Knight
    if (this.pendingAction && this.pendingAction !== "robber") this.pendingAction = null;
    this.confirmBuild = null;
    this.canvas.style.cursor = "grab";
    this.hideTradePanel();
    this.hideDevCardPicker();
    if (human) this._rushAutoFinishHumanRobber(human);
    const moverId = r.robberOrder[r.robberIdx % r.robberOrder.length];
    r.robberIdx += 1;
    const discards = [];
    this.players.forEach((p) => {
      const total = sumResources(p.resources);
      if (total <= this.settings.discardLimit) return;
      const count = Math.floor(total / 2);
      if (this._isInteractive(p)) {
        discards.push({ playerId: p.id, count });
      } else {
        this._autoDiscard(p, count);
        this.addLog(`${p.name} discard${this._s(p)} ${count} cards.`);
      }
    });
    r.seven = { stage: discards.length ? "discard" : "robber", discards, moverId, leftMs: Infinity };
    this._rushRunSevenStage();
  }

  _rushRunSevenStage() {
    const r = this.rush;
    const seven = r?.seven;
    if (!seven || this.winner) return;
    if (seven.stage === "discard") {
      const item = seven.discards[0];
      if (!item) {
        seven.stage = "robber";
        this._rushRunSevenStage();
        return;
      }
      seven.leftMs = RUSH_DISCARD_SECONDS * 1000;
      this._showDiscardUI(this.players[item.playerId], item.count).then(this._guard(() => {
        if (this.rush?.seven !== seven) return;
        seven.discards.shift();
        this._rushRunSevenStage();
      }));
    } else {
      const mover = this.players[seven.moverId];
      if (this._isInteractive(mover)) {
        seven.leftMs = RUSH_ROBBER_SECONDS * 1000;
        if (this.pendingAction !== "robber" && !this.robberVictimOptions?.length) this.moveRobber(mover);
        this._rushWaitHumanRobber(seven);
      } else {
        seven.leftMs = Infinity;
        this._later(() => {
          if (this.rush?.seven !== seven) return;
          this.moveRobberAndSteal(mover, this.chooseRobberHex(mover));
          this._rushEndSeven();
        }, 1400);
      }
    }
    this.saveToStorage();
    this.render();
  }

  _rushWaitHumanRobber(seven) {
    this._later(() => {
      if (this.rush?.seven !== seven) return;
      if (this.pendingAction === "robber" || this.robberVictimOptions?.length) {
        this._rushWaitHumanRobber(seven);
        return;
      }
      this._rushEndSeven();
    }, 250);
  }

  // A 7-pause deadline ran out: random discard for the human, or auto-place the robber.
  _rushSevenTimeout() {
    const seven = this.rush.seven;
    seven.leftMs = Infinity;
    if (seven.stage === "discard" && this.pendingDiscard) {
      const { player, count } = this.pendingDiscard;
      const picked = makeEmptyResources();
      for (let i = 0; i < count; i += 1) {
        const candidates = RESOURCES.filter((res) => player.resources[res] - picked[res] > 0)
          .map((res) => ({ resource: res, weight: player.resources[res] - picked[res] }));
        if (!candidates.length) break;
        picked[chooseRandomWeighted(candidates).resource] += 1;
      }
      this.pendingDiscard.selected = picked;
      this.addLog("Time's up — cards discarded at random.");
      this._confirmDiscard();
    } else if (seven.stage === "robber") {
      const human = this.players[seven.moverId];
      this.addLog("Time's up — the robber was placed for you.");
      this._rushAutoFinishHumanRobber(human);
    }
  }

  // Complete a human robber move (placement and/or victim choice) automatically.
  _rushAutoFinishHumanRobber(human) {
    if (this.robberVictimOptions?.length) {
      const victim = this.robberVictimOptions[0];
      this.robberVictimOptions = [];
      if (this.victimPanel) this.victimPanel.style.display = "none";
      this.stealFromVictim(human, victim);
      this.robberContext = null;
    }
    if (this.pendingAction === "robber") {
      this.pendingAction = null;
      this.robberContext = null;
      this.canvas.style.cursor = "grab";
      this.moveRobberAndSteal(human, this.chooseRobberHex(human));
    }
  }

  _rushEndSeven() {
    const r = this.rush;
    if (!r || !r.seven) return;
    r.seven = null;
    r.paused = false;
    this.phase = "main";
    r.remainingMs = this.settings.rushInterval * 1000;
    this._rushLastTs = performance.now();
    this._rushAfterAction();
  }

  // ── Bots ──
  _rushBotTick(player) {
    const r = this.rush;
    if (!r || this.winner || !this.players.includes(player)) return;
    if (!this._rushIsBot(player)) return; // human seat left autoplay
    if (document.hidden || r.paused || this.uiPaused) {
      this._scheduleBotTick(player, 600);
      return;
    }
    const acted = this._rushBotAct(player);
    if (acted) {
      r.ready = r.ready.filter((id) => id !== player.id);
      this._rushAfterAction(player);
    } else if (!r.ready.includes(player.id)) {
      r.ready.push(player.id); // nothing useful to do: vote to roll now
      this._renderRushHud();
      this._lastScoreKey = null;
      this.renderScoreboard();
    }
    if (!this.winner) this._scheduleBotTick(player, 1500 + Math.random() * 2000);
  }

  // One bot action per tick, using the Classic AI decision functions.
  _rushBotAct(player) {
    if (this.maybePlayBestDevCard(player)) return true;
    for (const fn of this._getActionPriority(player)) {
      if (fn()) return true;
    }
    if (!player.rushTradeTried) {
      player.rushTradeTried = true;
      const result = this.aiTryPlayerTrade(player);
      if (result?.type === "done") return true;
      if (result?.type === "human") {
        this._rushOfferToHuman(result.fromPlayer, result.give, result.want);
        return true;
      }
    }
    return false;
  }

  // After any Rush action: scores, contested spots, win check for everyone, save and redraw.
  _rushAfterAction(actor = null) {
    this.recomputeScores();
    const human = this.players.find((p) => p.isHuman);
    if (this.confirmBuild && human && !this._confirmBuildStillValid(human)) {
      this.confirmBuild = null;
      this.addLog("That spot was just taken.");
    }
    const order = actor ? [actor, ...this.players.filter((p) => p !== actor)] : this.players;
    for (const p of order) {
      if (this.checkForWinner(p)) break;
    }
    this.saveToStorage();
    this.render();
  }

  _confirmBuildStillValid(player) {
    const cb = this.confirmBuild;
    if (!cb) return true;
    if (cb.type === "road") return this.canBuildRoad(player, cb.id, { free: this.freeRoadsRemaining > 0 });
    if (cb.type === "settlement") return this.canBuildSettlement(player, cb.id, false);
    if (cb.type === "city") return this.canBuildCity(player, cb.id, false);
    return true;
  }

  _rushCanPlayDev(player, type) {
    if (this.winner || this.setupPhase || !this.rush || this.rush.paused || this.phase !== "main") return false;
    if (player.rushDevPlayed || !(player.devCards[type] > 0)) return false;
    if (this._isInteractive(player)
      && (this._robberInProgress() || this.freeRoadsRemaining > 0 || document.getElementById("resourcePickerOverlay"))) return false;
    if (type === "yearOfPlenty" && sumResources(this.bank) === 0) return false;
    if (type === "roadBuilding" && !this._hasLegalRoad(player, true)) return false;
    return true;
  }

  toggleRushReady() {
    const r = this.rush;
    const human = this.players.find((p) => p.isHuman);
    if (!r || !human || r.paused || this.winner || this.setupPhase) return;
    if (r.ready.includes(human.id)) r.ready = r.ready.filter((id) => id !== human.id);
    else r.ready.push(human.id);
    this.sfx.click();
    this._lastScoreKey = null;
    this.render();
  }

  // ── Bot trade offers to the human: non-blocking cards in the feed corner ──
  _rushOfferToHuman(fromPlayer, give, want) {
    const r = this.rush;
    this._offerSeq = (this._offerSeq || 0) + 1;
    r.offers = r.offers.filter((o) => o.fromId !== fromPlayer.id).slice(-2);
    r.offers.push({ id: this._offerSeq, fromId: fromPlayer.id, give: { ...give }, want: { ...want }, expiresAt: r.clockMs + 10000 });
    this.addLog(`${fromPlayer.name} offers you ${resourceString(give)} for ${resourceString(want)}.`);
    this._renderRushOffers();
  }

  _resolveRushOffer(offerId, accept) {
    const r = this.rush;
    if (!r) return;
    const offer = r.offers.find((o) => o.id === offerId);
    if (!offer) return;
    r.offers = r.offers.filter((o) => o.id !== offerId);
    const from = this.players[offer.fromId];
    const human = this.players.find((p) => p.isHuman);
    if (accept) {
      if (r.paused || this.winner || !hasResources(human.resources, offer.want) || !hasResources(from.resources, offer.give)) {
        this.addLog(`Trade with ${from.name} is no longer possible.`);
      } else {
        RESOURCES.forEach((res) => {
          human.resources[res] += offer.give[res] - offer.want[res];
          from.resources[res] += offer.want[res] - offer.give[res];
        });
        this._animateTradeCards(offer.want, offer.give);
        this.sfx.trade();
        this.addLog(`You traded with ${from.name}: got ${resourceString(offer.give)} for ${resourceString(offer.want)}.`);
        this._rushAfterAction(human);
      }
    }
    this._renderRushOffers();
    this.render();
  }

  _renderRushOffers() {
    const el = this.rushOffersEl;
    if (!el) return;
    const offers = this.rush && !this.winner ? this.rush.offers : [];
    const key = offers.map((o) => o.id).join(",") + this.theme?.id;
    if (key === this._lastOffersKey) return;
    this._lastOffersKey = key;
    const icons = (res) => RESOURCES.flatMap((r) => Array(res[r] || 0).fill(icon(r))).join("");
    el.dataset.more = offers.length > 1 ? `+${offers.length - 1} more` : "";
    el.innerHTML = offers.map((o) => {
      const p = this.players[o.fromId];
      return `<div class="rush-offer" data-offer="${o.id}">
        ${this._av(p, "rush-offer-avatar")}
        <div class="rush-offer-body">
          <div class="rush-offer-title"><span class="who pc-${p.id}">${p.name}</span> offers</div>
          <div class="rush-offer-cards">${icons(o.give)}<span class="rush-offer-for">for your</span>${icons(o.want)}</div>
        </div>
        <button type="button" class="rush-offer-accept" data-accept="${o.id}">Accept</button>
        <button type="button" class="rush-offer-decline" data-decline="${o.id}" aria-label="Decline">${icon("close")}</button>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-accept]").forEach((b) => b.addEventListener("click", () => this._resolveRushOffer(Number(b.dataset.accept), true)));
    el.querySelectorAll("[data-decline]").forEach((b) => b.addEventListener("click", () => this._resolveRushOffer(Number(b.dataset.decline), false)));
  }

  // ── Rush HUD: countdown ring, Ready votes, next-7 badge, header badge, 7-pause panel ──
  _renderRushHud() {
    const rushOn = this.isRush() && this.rush && !this.setupPhase;
    const live = !!rushOn && !this.winner;
    const wasLive = document.body.classList.contains("rush-live");
    document.body.classList.toggle("rush-mode", this.isRush());
    document.body.classList.toggle("rush-live", live);
    // The HUD takes room above the board on small screens: refit the canvas when it appears
    if (live !== wasLive) {
      window.requestAnimationFrame(() => {
        this._alignScoreboardToHeader();
        this.handleResize();
      });
    }
    if (this.modeBadge) {
      this.modeBadge.hidden = !this.isRush();
      if (this.isRush()) {
        this.modeBadge.textContent = rushOn
          ? `⚡ Rush · Roll #${this.rush.rollNo} · ${formatClock(this.rush.clockMs)}`
          : "⚡ Rush · setup";
      }
    }
    if (!this.rushHud) return;
    this.rushHud.hidden = !rushOn || !!this.winner;
    this._renderSevenPanel();
    if (!rushOn) return;
    const r = this.rush;
    const total = this.settings.rushInterval * 1000;
    const left = Math.max(0, r.remainingMs);
    const secs = Math.ceil(left / 1000);
    const titleEl = this.rushHud.querySelector("#rushTitle");
    if (titleEl) titleEl.innerHTML = r.paused ? "<b>Paused</b> · robber!" : `Next roll · <b>Roll #${r.rollNo + 1}</b>`;
    const secEl = this.rushHud.querySelector("#rushSeconds");
    if (secEl) secEl.textContent = r.paused ? "7" : String(secs);
    const label = this.rushHud.querySelector("#rushSecondsLabel");
    if (label) label.textContent = r.paused ? "paused" : "seconds";
    const ring = this.rushHud.querySelector("#rushRingFill");
    if (ring) {
      const c = 2 * Math.PI * 44;
      ring.style.strokeDasharray = `${c}`;
      ring.style.strokeDashoffset = `${c * (1 - left / total)}`;
    }
    this.rushHud.classList.toggle("paused", r.paused);
    this.rushHud.classList.toggle("urgent", !r.paused && secs <= 3);
    const human = this.players.find((p) => p.isHuman);
    const n = this.players.length;
    const humanReady = r.ready.includes(human?.id);
    if (this.rushReadyBtn) {
      this.rushReadyBtn.innerHTML = humanReady
        ? `${icon("check")}<span class="rr">Ready<small>waiting · ${r.ready.length}/${n}</small></span>`
        : `${icon("dice")}<span class="rr">Ready<small>roll now · ${r.ready.length}/${n}</small></span>`;
      this.rushReadyBtn.classList.toggle("is-ready", humanReady);
      this.rushReadyBtn.disabled = r.paused || !!this.autoplayInterval;
    }
    const votersKey = `${r.ready.join(",")}|${n}`;
    const voters = this.rushHud.querySelector("#rushVoters");
    if (voters && votersKey !== this._lastVotersKey) {
      this._lastVotersKey = votersKey;
      voters.innerHTML = this.players.map((p) => `<span class="rush-voter pc-${p.id}${r.ready.includes(p.id) ? " ready" : ""}" title="${p.name}${r.ready.includes(p.id) ? " is ready" : ""}">
        ${this._av(p)}<span class="rush-voter-dot"></span><span class="rush-voter-name">${p.isHuman ? "You" : p.name.replace(/ AI$/, "")}</span></span>`).join("");
    }
    const next7 = this.rushHud.querySelector("#rushNext7");
    if (next7) {
      const nextId = r.robberOrder[r.robberIdx % r.robberOrder.length];
      const np = this.players[nextId];
      const key = `${nextId}`;
      if (np && key !== this._lastNext7Key) {
        this._lastNext7Key = key;
        next7.innerHTML = `<span class="rush-next7-label">Next 7</span>
          <span class="rush-next7-player" title="Next 7: the robber is moved by ${np.isHuman ? "you" : np.name}">${this._av(np)}<span class="nm who pc-${np.id}">${np.isHuman ? "You" : np.name}</span></span>`;
      }
    }
  }

  _renderSevenPanel() {
    const panel = this.rushSevenPanel;
    if (!panel) return;
    const seven = this.isRush() && !this.winner ? this.rush?.seven : null;
    const slot = panel.querySelector(".rush-seven-discard-slot");
    // In Rush the discard picker lives inside the 7-pause panel; in Classic it floats on its own
    if (this.discardPanel) {
      const home = this.isRush() && slot ? slot : document.querySelector("#app");
      if (home && this.discardPanel.parentElement !== home) home.appendChild(this.discardPanel);
    }
    panel.hidden = !seven;
    if (!seven) return;
    const mover = this.players[seven.moverId];
    const humanPlacing = seven.stage === "robber" && this._isInteractive(mover);
    panel.classList.toggle("robber-placing", humanPlacing);
    const secs = Number.isFinite(seven.leftMs) ? Math.max(0, Math.ceil(seven.leftMs / 1000)) : null;
    const frozen = panel.querySelector(".rush-seven-frozen");
    if (frozen) frozen.textContent = `timer frozen at ${this.settings.rushInterval}s`;
    const discardStep = panel.querySelector(".rush-seven-discard");
    if (discardStep) {
      const pendingIds = seven.discards.map((d) => d.playerId);
      const timerHtml = seven.stage === "discard" && secs != null ? `<span class="rush-seven-timer">⏱ 0:${String(secs).padStart(2, "0")} left</span>` : "";
      const status = this.players.map((p) => {
        const cards = sumResources(p.resources);
        let state = "safe ✓";
        let cls = "safe";
        if (pendingIds.includes(p.id)) { state = pendingIds[0] === p.id ? "choosing…" : "waiting"; cls = "choosing"; }
        return `<span class="rush-seven-chip ${cls}">${this._av(p)}${p.isHuman ? "You" : p.name} · ${cards}<em>${state}</em></span>`;
      }).join("");
      discardStep.querySelector(".rush-seven-step-title").innerHTML =
        `<span class="rush-step-num">1</span>Discard half if you hold more than ${this.settings.discardLimit}${timerHtml}`;
      discardStep.querySelector(".rush-seven-chips").innerHTML = status;
      discardStep.classList.toggle("done", seven.stage !== "discard");
    }
    const robberStep = panel.querySelector(".rush-seven-robber");
    if (robberStep) {
      const order = this.rush.robberOrder;
      const nexts = [1, 2, 3].slice(0, order.length - 1)
        .map((k) => this.players[order[(this.rush.robberIdx - 1 + k) % order.length]])
        .map((p) => `<span class="who pc-${p.id}">${p.isHuman ? "You" : p.name}</span>`).join(", then ");
      let state = "waiting for discards";
      if (seven.stage === "robber") {
        state = humanPlacing
          ? `tap a hex on the board${secs != null ? ` · 0:${String(secs).padStart(2, "0")}` : ""}`
          : "choosing a hex…";
      }
      robberStep.innerHTML = `<div class="rush-seven-step-title"><span class="rush-step-num">2</span>Robber moved by
          ${this._av(mover, "rush-seven-avatar")}<span class="who pc-${mover.id}">${mover.isHuman ? "You" : mover.name}</span>
          <span class="rush-seven-state">${state}</span></div>
        ${nexts ? `<div class="rush-seven-next">Then the order continues: next 7 → ${nexts}.</div>` : ""}`;
    }
  }

  // ── Game-over overlay & restart ──────────────────────────────────────
  showGameOverOverlay() {
    if (document.querySelector(".game-over-overlay")) return;
    this.sfx.victory();
    this.hideTradePanel();
    this.toggleBuildSheet?.(false);
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay tm";
    const winner = this.winner;
    const ranked = [...this.players].sort((a, b) => b.victoryPoints - a.victoryPoints);
    const lead = this.rush ? `${winner.victoryPoints} points · Rush roll #${this.rush.rollNo} · ${formatClock(this.rush.clockMs)}`
      : `${winner.victoryPoints} points on turn ${this.turn}${winner.isHuman ? " — a fine colony." : "."}`;
    overlay.innerHTML = `<div class="confetti-box"></div>
      <div class="panel over-panel" role="dialog" aria-label="Game over">
        <svg class="trophy" viewBox="-50 -50 100 100" aria-hidden="true"><use href="#ic-victoryPoint" x="-50" y="-50" width="100" height="100"/></svg>
        <h3>${winner.isHuman ? "You win!" : `${winner.name} wins`}</h3>
        <p class="lead">${lead}</p>
        <div class="podium">${ranked.map((p, k) => {
          const persona = p.personality ? AI_PRESET_INFO[p.personality]?.label : "";
          return `<div class="r${p === winner ? " win" : ""}"><span class="pl">${k + 1}</span>${this._av(p)}<span class="nmc"><span class="pname">${p.name}</span>${persona ? `<small>${persona}</small>` : ""}</span><span class="s">${p.victoryPoints}</span></div>`;
        }).join("")}</div>
        <div class="btnrow"><button type="button" class="btn" data-see>${icon("fit")}See board</button><button type="button" class="btn primary game-over-btn" id="newGameBtn">${icon("dice")}Play again</button></div>
      </div>`;
    const host = this.isMobileLayout ? this.app : document.querySelector(".board-panel");
    (host || document.body).appendChild(overlay);
    this.fx?.pop(overlay.querySelector(".over-panel"));
    if (winner.isHuman) this.fx?.confetti(overlay.querySelector(".confetti-box"));
    overlay.querySelector("#newGameBtn").addEventListener("click", () => {
      overlay.remove();
      this.stopAutoplay();
      this._showDifficultyModal();
    });
    overlay.querySelector("[data-see]").addEventListener("click", () => {
      overlay.remove();
      this.render();
    });
  }

  removeGameOverOverlay() {
    const overlay = document.querySelector(".game-over-overlay");
    if (overlay) overlay.remove();
  }

  // ── Session persistence ──────────────────────────────────────────────
  static STORAGE_KEY = "colonist_save_v3";

  serializeState() {
    return {
      hexes: this.geometry.hexes.map(h => ({ resource: h.resource, number: h.number })),
      ports: this.ports.map(p => ({ edgeId: p.edgeId, type: p.type, nodes: p.nodes })),
      robberHexId: this.robberHexId,
      nodes: this.geometry.nodes
        .filter(n => n.owner != null)
        .map(n => ({ id: n.id, owner: n.owner, structure: n.structure })),
      edges: this.geometry.edges
        .filter(e => e.owner != null)
        .map(e => ({ id: e.id, owner: e.owner })),
      players: this.players.map(p => ({
        resources: { ...p.resources },
        roads: [...p.roads],
        settlements: [...p.settlements],
        cities: [...p.cities],
        devCards: { ...p.devCards },
        newDevCards: { ...p.newDevCards },
        devVictoryPoints: p.devVictoryPoints,
        knightsPlayed: p.knightsPlayed,
        longestRoadLength: p.longestRoadLength,
        victoryPoints: p.victoryPoints,
        strategy: p.strategy ? { ...p.strategy } : null,
        personality: p.personality || null,
        rushDevPlayed: !!p.rushDevPlayed,
        rushTradeTried: !!p.rushTradeTried,
      })),
      settings: { ...this.settings },
      rush: this.rush ? JSON.parse(JSON.stringify({ ...this.rush, seven: this.rush.seven && { ...this.rush.seven, leftMs: Number.isFinite(this.rush.seven.leftMs) ? this.rush.seven.leftMs : null } })) : null,
      diceDeck: this.diceDeck,
      lastDiceTotal: this.lastDiceTotal,
      devDeck: [...this.devDeck],
      turn: this.turn,
      currentPlayerIndex: this.currentPlayerIndex,
      phase: this.phase,
      lastRoll: this.lastRoll,
      rollHistory: { ...this.rollHistory },
      winnerId: this.winner ? this.winner.id : null,
      pendingAction: this.pendingAction,
      robberContext: this.robberContext,
      currentTurnPlayedDevCard: this.currentTurnPlayedDevCard,
      freeRoadsRemaining: this.freeRoadsRemaining,
      bank: { ...this.bank },
      pendingRobberFlow: this.pendingRobberFlow,
      robberVictimOptions: this.robberVictimOptions,
      longestRoadHolder: this.longestRoadHolder,
      largestArmyHolder: this.largestArmyHolder,
      logEntries: this.logEntries.slice(-60),
      setupPhase: this.setupPhase,
      setupQueue: this.setupQueue,
      setupStep: this.setupStep,
      setupAction: this.setupAction,
      lastSetupNodeId: this.lastSetupNodeId,
    };
  }

  saveToStorage() {
    try {
      const data = this.serializeState();
      localStorage.setItem(ColonistFullGame.STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* quota exceeded or private mode — ignore */ }
  }

  // Strategy persistence — survives game resets
  static STRATEGY_KEY = "colonist_ai_strategies";

  _saveStrategies() {
    // Mid-game strategy edits also update the personality badges
    this.players.forEach((p) => { if (p.strategy) p.personality = presetForStrategy(p.strategy); });
    this._lastScoreKey = null;
    if (this.scoreboard) this.renderScoreboard();
    this.saveToStorage();
    try {
      const data = {};
      this.players.forEach(p => { if (p.strategy) data[p.id] = { ...p.strategy }; });
      localStorage.setItem(ColonistFullGame.STRATEGY_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  _loadStrategies() {
    try {
      const raw = localStorage.getItem(ColonistFullGame.STRATEGY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  clearStorage() {
    try { localStorage.removeItem(ColonistFullGame.STORAGE_KEY); } catch (_) {}
  }

  loadFromStorage() {
    let raw;
    try { raw = localStorage.getItem(ColonistFullGame.STORAGE_KEY); } catch (_) { return false; }
    if (!raw) return false;
    let data;
    try { data = JSON.parse(raw); } catch (_) { this.clearStorage(); return false; }
    this._cancelPendingWork();
    // Older saves have no settings: Classic with the standard rules
    this.settings = normalizeSettings(data.settings || { ...DEFAULT_SETTINGS, numBots: (data.players?.length || 4) - 1 });
    this.diceDeck = Array.isArray(data.diceDeck) ? data.diceDeck : [];
    this.lastDiceTotal = data.lastDiceTotal ?? null;
    this.rush = null;

    // Rebuild geometry (deterministic layout)
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight);

    // Restore hex tiles
    if (!data.hexes || data.hexes.length !== this.geometry.hexes.length) { this.clearStorage(); return false; }
    data.hexes.forEach((saved, i) => {
      this.geometry.hexes[i].resource = saved.resource;
      this.geometry.hexes[i].number = saved.number;
    });
    this.robberHexId = data.robberHexId;

    // Restore ports
    this.ports = [];
    if (data.ports) {
      data.ports.forEach(p => {
        this.ports.push({ edgeId: p.edgeId, type: p.type, nodes: p.nodes });
        p.nodes.forEach(nodeId => {
          if (!this.geometry.nodes[nodeId].ports.includes(p.type)) {
            this.geometry.nodes[nodeId].ports.push(p.type);
          }
        });
      });
    }

    // Restore node ownership
    if (data.nodes) {
      data.nodes.forEach(n => {
        this.geometry.nodes[n.id].owner = n.owner;
        this.geometry.nodes[n.id].structure = n.structure;
      });
    }

    // Restore edge ownership
    if (data.edges) {
      data.edges.forEach(e => {
        this.geometry.edges[e.id].owner = e.owner;
      });
    }

    // Restore players
    if (!Array.isArray(data.players) || data.players.length < 2 || data.players.length > PLAYER_CONFIG.length) {
      this.clearStorage();
      return false;
    }
    this.players = data.players.map((saved, id) => {
      const config = PLAYER_CONFIG[id];
      return {
        id,
        name: config.name,
        color: config.color,
        isHuman: config.isHuman,
        avatar: config.avatar,
        resources: { ...saved.resources },
        roads: new Set(saved.roads),
        settlements: new Set(saved.settlements),
        cities: new Set(saved.cities),
        devCards: { ...saved.devCards },
        newDevCards: { ...saved.newDevCards },
        devVictoryPoints: saved.devVictoryPoints,
        knightsPlayed: saved.knightsPlayed,
        longestRoadLength: saved.longestRoadLength,
        victoryPoints: saved.victoryPoints,
        publicVictoryPoints: saved.victoryPoints - (saved.devVictoryPoints || 0),
        strategy: config.isHuman ? null : (saved.strategy ? { ...saved.strategy } : { ...DEFAULT_AI_STRATEGY }),
        personality: config.isHuman ? null : (saved.personality || presetForStrategy(saved.strategy || DEFAULT_AI_STRATEGY)),
        rushDevPlayed: !!saved.rushDevPlayed,
        rushTradeTried: !!saved.rushTradeTried,
      };
    });
    // Older saves have no bank: everything not in a hand is in the bank
    this.bank = makeFullBank();
    RESOURCES.forEach((r) => {
      this.bank[r] = data.bank && Number.isFinite(data.bank[r])
        ? data.bank[r]
        : BANK_SIZE - this.players.reduce((sum, p) => sum + (p.resources[r] || 0), 0);
    });

    this.devDeck = data.devDeck || [];
    this.turn = data.turn;
    this.currentPlayerIndex = data.currentPlayerIndex;
    this.phase = data.phase;
    this.lastRoll = data.lastRoll;
    this.rollHistory = data.rollHistory || {};
    for (let i = 2; i <= 12; i++) if (!this.rollHistory[i]) this.rollHistory[i] = 0;
    this.winner = data.winnerId != null ? this.players[data.winnerId] : null;
    this.pendingAction = data.pendingAction;
    this.robberContext = data.robberContext || null;
    this.robberVictimOptions = [];
    this.currentTurnPlayedDevCard = data.currentTurnPlayedDevCard;
    this.freeRoadsRemaining = data.freeRoadsRemaining || 0;
    this.confirmBuild = null;
    this.turnSerial = 0;
    this.longestRoadHolder = data.longestRoadHolder;
    this.largestArmyHolder = data.largestArmyHolder;
    this.logEntries = data.logEntries || [];
    this.setupPhase = data.setupPhase || false;
    const ids = this.players.map((p) => p.id);
    this.setupQueue = data.setupQueue || [...ids, ...ids.slice().reverse()];
    this.setupStep = data.setupStep || 0;
    this.setupAction = data.setupAction || null;
    this.lastSetupNodeId = data.lastSetupNodeId ?? null;

    this.fitView();
    this.boardRenderer?.resync();
    this._applyThemeToPlayers();
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";
    this.canvas.style.cursor = "grab";

    this.addLog("Session restored.");
    this.render();
    if (this.winner) {
      this.showGameOverOverlay();
    } else if (this.setupPhase) {
      this.processSetupQueue();
    } else if (this.isRush()) {
      const saved = data.rush || {};
      if (saved.seven && saved.seven.leftMs == null) saved.seven.leftMs = Infinity;
      if (Array.isArray(data.robberVictimOptions) && data.robberVictimOptions.length) {
        this.robberVictimOptions = data.robberVictimOptions;
        this.showVictimPanel(this.players.find((p) => p.isHuman), this.robberVictimOptions);
      }
      this._startRush(saved);
    } else {
      // Resume an interrupted 7: pending discards, then the robber move
      // (a pending human robber placement is restored via pendingAction)
      if (data.pendingRobberFlow?.discards) {
        this.pendingRobberFlow = data.pendingRobberFlow;
        this._runPendingRobberFlow();
      } else if (Array.isArray(data.robberVictimOptions) && data.robberVictimOptions.length && this.currentPlayer.isHuman) {
        this.robberVictimOptions = data.robberVictimOptions;
        this.showVictimPanel(this.currentPlayer, this.robberVictimOptions);
      }
      if (!this.currentPlayer.isHuman) this.scheduleAiTurnsUntilHuman();
    }
    return true;
  }

  drawBoardBackdrop() {
    const ctx = this.ctx;
    const w = this.boardWidth;
    const h = this.boardHeight;
    const t = this.animTime || 0;

    // Warm-tinted blue ocean — slightly muted/desaturated for Claude feel
    const ocean = ctx.createRadialGradient(w * 0.47, h * 0.48, 50, w * 0.47, h * 0.48, w * 0.62);
    ocean.addColorStop(0, "#5aadcc");
    ocean.addColorStop(0.4, "#4090b0");
    ocean.addColorStop(1, "#2a6a88");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);

    // Animated caustic light patches
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const cx = w * (0.1 + Math.sin(t * 0.3 + i * 2.1) * 0.08 + (i % 4) * 0.22);
      const cy = h * (0.1 + Math.cos(t * 0.25 + i * 1.7) * 0.06 + Math.floor(i / 4) * 0.3);
      const r = 30 + Math.sin(t * 0.6 + i * 3.2) * 15;
      const alpha = 0.025 + Math.sin(t * 0.8 + i * 1.5) * 0.015;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 250, 230, ${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Flowing wave lines
    ctx.strokeStyle = "rgba(255, 248, 230, 0.05)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const yBase = h * 0.05 + i * (h / 16);
      const phase = t * 0.4 + i * 0.7;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = yBase + Math.sin(x / 90 + phase) * 3.5 + Math.sin(x / 45 + phase * 1.3) * 2;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // Returns bezier control points for a wobbly edge between two points.
  // Uses midpoint-seeded hash so shared edges between hexes always match.
  _wobblyEdge(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const edgeSeed1 = Math.sin(mx * 0.173 + my * 0.291) * 43758.5453;
    const edgeSeed2 = Math.sin(mx * 0.317 + my * 0.119) * 23421.6312;
    const w1 = (edgeSeed1 - Math.floor(edgeSeed1) - 0.5) * 6;
    const w2 = (edgeSeed2 - Math.floor(edgeSeed2) - 0.5) * 6;
    const fwd = ax < bx || (ax === bx && ay < by);
    const s1 = fwd ? w1 : -w2;
    const s2 = fwd ? w2 : -w1;
    return {
      cp1x: ax + dx * 0.33 + nx * s1, cp1y: ay + dy * 0.33 + ny * s1,
      cp2x: ax + dx * 0.66 + nx * s2, cp2y: ay + dy * 0.66 + ny * s2,
    };
  }

  drawHexPath(corners, wobbly = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    if (!wobbly) {
      corners.forEach((corner, idx) => {
        if (idx === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
      });
    } else {
      const n = corners.length;
      corners.forEach((corner, idx) => {
        const next = corners[(idx + 1) % n];
        if (idx === 0) ctx.moveTo(corner.x, corner.y);
        const cp = this._wobblyEdge(corner.x, corner.y, next.x, next.y);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, next.x, next.y);
      });
    }
    ctx.closePath();
  }

  drawTokenPips(hex) {
    if (hex.number == null) return;
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const pips = DICE_WEIGHT[hex.number];
    const radius = 2.1 * s;
    const spacing = 5 * s;
    const startX = hex.center.x - ((pips - 1) * spacing) / 2;
    const y = hex.center.y + 10 * s;
    ctx.fillStyle = hex.number === 6 || hex.number === 8 ? "#af1b1b" : "#38485f";
    for (let i = 0; i < pips; i += 1) {
      ctx.beginPath();
      ctx.arc(startX + i * spacing, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRoundedRect(x, y, width, height, radius) {
    const ctx = this.ctx;
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  drawHex(hex) {
    const ctx = this.ctx;
    const tileStyle = {
      wood: "#3a7d3a",
      brick: "#c86a42",
      sheep: "#7cc844",
      wheat: "#dab84e",
      ore: "#8a96a8",
      desert: "#dcc58a",
    };
    this.drawHexPath(hex.corners, true);
    ctx.save();
    ctx.shadowColor = "rgba(38, 73, 106, 0.32)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = tileStyle[hex.resource] || RESOURCE_COLORS[hex.resource];
    ctx.fill();
    ctx.restore();

    const hxs = this.geometry.hexSize;
    const sc = hxs / 74;
    this.drawHexPath(hex.corners, true);
    const surface = ctx.createLinearGradient(hex.center.x - 38 * sc, hex.center.y - 38 * sc, hex.center.x + 38 * sc, hex.center.y + 38 * sc);
    surface.addColorStop(0, "rgba(255,250,230,0.22)");
    surface.addColorStop(0.5, "rgba(255,255,255,0)");
    surface.addColorStop(1, "rgba(44,24,16,0.12)");
    ctx.fillStyle = surface;
    ctx.fill();

    // Organic texture: soft splotches for watercolor/parchment feel
    ctx.save();
    this.drawHexPath(hex.corners, true);
    ctx.clip();
    for (let i = 0; i < 8; i += 1) {
      const sx = hex.center.x + Math.sin(hex.id * 7.3 + i * 1.9) * 28 * sc;
      const sy = hex.center.y + Math.cos(hex.id * 5.2 + i * 2.2) * 26 * sc;
      const radius = (6 + ((hex.id + i) % 5)) * sc;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,250,230,0.08)" : i % 3 === 1 ? "rgba(44,24,16,0.05)" : "rgba(255,255,255,0.04)";
      ctx.fill();
    }
    ctx.restore();

    this.drawHexPath(hex.corners, true);
    ctx.strokeStyle = "rgba(160, 130, 70, 0.6)";
    ctx.lineWidth = 2.5 * sc;
    ctx.stroke();

    // Tile artwork layer: show clear resource iconography on the board itself.
    this.drawTileArtwork(hex);

    if (hex.number != null) {
      // Scale token + font by dice probability: common numbers (6,8) are bigger, rare (2,12) smaller
      const pips = DICE_WEIGHT[hex.number] || 1;
      const probScale = 0.75 + 0.25 * (pips / 5); // range: 0.80 (2/12) → 1.0 (6/8)
      const tokenR = hxs * 0.36 * probScale;
      ctx.save();
      ctx.shadowColor = "rgba(44, 24, 16, 0.3)";
      ctx.shadowBlur = 8 * sc;
      ctx.shadowOffsetY = 3 * sc;
      ctx.beginPath();
      ctx.arc(hex.center.x, hex.center.y, tokenR, 0, Math.PI * 2);
      const token = ctx.createRadialGradient(hex.center.x - 6 * sc, hex.center.y - 7 * sc, 2 * sc, hex.center.x, hex.center.y, tokenR + 2 * sc);
      token.addColorStop(0, "rgba(255,250,238,0.98)");
      token.addColorStop(1, "rgba(232,220,200,0.95)");
      ctx.fillStyle = token;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(hex.center.x, hex.center.y, tokenR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(160, 130, 70, 0.4)";
      ctx.lineWidth = 1.5 * sc;
      ctx.stroke();

      ctx.fillStyle = hex.number === 6 || hex.number === 8 ? "#be1a1a" : "#18212c";
      ctx.font = `bold ${Math.round(hxs * 0.38 * probScale)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(hex.number), hex.center.x, hex.center.y - 2 * sc);
      this.drawTokenPips(hex);
    }

    const label = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource];
    ctx.fillStyle = "rgba(44, 24, 16, 0.5)";
    ctx.font = `600 ${Math.round(hxs * 0.12)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, hex.center.x, hex.center.y + hxs * 0.43);

    if (hex.id === this.robberHexId) {
      const s = (hxs / 74) * 0.75;
      ctx.save();
      ctx.translate(hex.center.x, hex.center.y);
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.fillStyle = "#1a2030";
      ctx.beginPath();
      ctx.arc(0, -17 * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14 * s, 14 * s);
      ctx.lineTo(-8 * s, -3 * s);
      ctx.lineTo(0, -10 * s);
      ctx.lineTo(8 * s, -3 * s);
      ctx.lineTo(14 * s, 14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#8a95a5";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -17 * s, 9 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTileArtwork(hex) {
    const ctx = this.ctx;
    const t = this.animTime || 0;
    const pulse = 0.5 + Math.sin(t * 1.2 + hex.id * 0.7) * 0.5;
    const artScale = this.geometry.hexSize / 74;
    ctx.save();
    this.drawHexPath(hex.corners, true);
    ctx.clip();
    ctx.translate(hex.center.x, hex.center.y);
    ctx.scale(artScale, artScale);
    ctx.translate(-hex.center.x, -hex.center.y);

    const cx = hex.center.x;
    const cy = hex.center.y;

    if (hex.resource === "wood") {
      ctx.fillStyle = "rgba(41, 112, 54, 0.26)";
      ctx.fillRect(cx - 40, cy - 5, 80, 34);
      const drawTree = (x, y, s, swaySeed) => {
        const sway = Math.sin(t * 1.8 + swaySeed) * 1.3;
        ctx.fillStyle = "rgba(35, 108, 49, 0.68)";
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.3, y - 14 * s);
        ctx.lineTo(x - 11 * s + sway, y + 4 * s);
        ctx.lineTo(x + 11 * s + sway, y + 4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(74, 149, 78, 0.72)";
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.24, y - 8 * s);
        ctx.lineTo(x - 9 * s + sway, y + 8 * s);
        ctx.lineTo(x + 9 * s + sway, y + 8 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(85, 58, 28, 0.62)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.2, y + 8 * s);
        ctx.lineTo(x + sway * 0.2, y + 15 * s);
        ctx.stroke();
      };
      drawTree(cx - 18, cy + 13, 0.9, hex.id * 0.8);
      drawTree(cx, cy + 6, 1.05, hex.id * 1.1 + 2);
      drawTree(cx + 18, cy + 12, 0.88, hex.id * 1.4 + 4);
    } else if (hex.resource === "brick") {
      ctx.fillStyle = "rgba(166, 83, 51, 0.34)";
      ctx.fillRect(cx - 34, cy + 5, 68, 26);
      ctx.fillStyle = "rgba(194, 102, 65, 0.72)";
      ctx.fillRect(cx - 27, cy + 2, 54, 8);
      ctx.fillRect(cx - 31, cy + 10, 24, 8);
      ctx.fillRect(cx - 3, cy + 10, 24, 8);
      ctx.fillRect(cx - 23, cy + 18, 24, 8);
      ctx.fillRect(cx + 5, cy + 18, 24, 8);
      ctx.strokeStyle = "rgba(136, 63, 37, 0.62)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx - 27, cy + 2, 54, 8);
      ctx.strokeRect(cx - 31, cy + 10, 24, 8);
      ctx.strokeRect(cx - 3, cy + 10, 24, 8);
      ctx.strokeRect(cx - 23, cy + 18, 24, 8);
      ctx.strokeRect(cx + 5, cy + 18, 24, 8);
      ctx.fillStyle = `rgba(245, 214, 194, ${0.18 + pulse * 0.12})`;
      ctx.fillRect(cx - 29, cy + 2, 6, 24);
    } else if (hex.resource === "sheep") {
      ctx.fillStyle = "rgba(125, 175, 86, 0.28)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(246, 252, 244, 0.95)";
      const bob = Math.sin(t * 2 + hex.id * 0.9) * 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12 + bob, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 11, cy + 10 + bob, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 11, cy + 10 + bob, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(58, 71, 88, 0.72)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 14 + bob, 5.5, 4.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(58, 71, 88, 0.7)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 18);
      ctx.lineTo(cx - 4, cy + 24);
      ctx.moveTo(cx + 4, cy + 18);
      ctx.lineTo(cx + 4, cy + 24);
      ctx.stroke();
    } else if (hex.resource === "wheat") {
      ctx.fillStyle = "rgba(170, 132, 44, 0.24)";
      ctx.fillRect(cx - 42, cy + 3, 84, 32);
      ctx.strokeStyle = "rgba(183, 145, 45, 0.55)";
      ctx.lineWidth = 1;
      const wave = Math.sin(t * 1.8 + hex.id * 0.5) * 2.4;
      for (let i = -35; i <= 35; i += 9) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy + 4);
        ctx.lineTo(cx + i + 10 + wave, cy + 33);
        ctx.stroke();
      }
      const stalk = (x, y, sway) => {
        ctx.strokeStyle = "rgba(129, 95, 25, 0.78)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + sway, y + 16);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x - 4 + sway, y + 7);
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 4 + sway, y + 11);
        ctx.stroke();
      };
      stalk(cx - 10, cy + 6, wave * 0.35);
      stalk(cx, cy + 4, wave * 0.42);
      stalk(cx + 10, cy + 6, wave * 0.3);
    } else if (hex.resource === "ore") {
      ctx.fillStyle = "rgba(108, 122, 145, 0.35)";
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy + 28);
      ctx.lineTo(cx - 16, cy + 8);
      ctx.lineTo(cx - 3, cy + 20);
      ctx.lineTo(cx + 12, cy + 2);
      ctx.lineTo(cx + 34, cy + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(125, 141, 165, 0.62)";
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy + 28);
      ctx.lineTo(cx - 12, cy + 10);
      ctx.lineTo(cx - 2, cy + 21);
      ctx.lineTo(cx + 10, cy + 8);
      ctx.lineTo(cx + 27, cy + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(220, 229, 240, 0.72)";
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy + 10);
      ctx.lineTo(cx + 10, cy + 8);
      ctx.lineTo(cx + 14, cy + 13);
      ctx.closePath();
      ctx.fill();
      const glint = 0.22 + pulse * 0.33;
      ctx.fillStyle = `rgba(255,255,255,${glint})`;
      ctx.beginPath();
      ctx.arc(cx - 6, cy + 12, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 9, cy + 16, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (hex.resource === "desert") {
      const dune = ctx.createLinearGradient(cx - 36, cy + 16, cx + 36, cy + 38);
      dune.addColorStop(0, "rgba(188, 147, 70, 0.58)");
      dune.addColorStop(1, "rgba(154, 118, 48, 0.34)");
      ctx.fillStyle = dune;
      ctx.beginPath();
      ctx.moveTo(cx - 42, cy + 26);
      ctx.bezierCurveTo(cx - 20, cy + 8, cx + 3, cy + 42, cx + 44, cy + 19);
      ctx.lineTo(cx + 44, cy + 42);
      ctx.lineTo(cx - 42, cy + 42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(129, 96, 36, 0.55)";
      ctx.fillRect(cx + 14, cy - 7, 4, 14);
      ctx.fillRect(cx + 10, cy - 1, 12, 4);
      ctx.fillRect(cx + 16, cy - 12, 2, 5);
      ctx.fillRect(cx + 13, cy - 9, 8, 2);
      ctx.strokeStyle = `rgba(184, 140, 72, ${0.18 + pulse * 0.2})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i += 1) {
        const y = cy + 4 + i * 7;
        ctx.beginPath();
        ctx.moveTo(cx - 34, y);
        ctx.bezierCurveTo(cx - 20, y - 4, cx + 8, y + 4, cx + 30, y - 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawPorts() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const portColor = {
      wood: "#6b5030", brick: "#a85538", sheep: "#5a7a40",
      wheat: "#a08530", ore: "#6a7588", any: "#5a7080",
    };
    this.ports.forEach((port) => {
      const edge = this.geometry.edges[port.edgeId];
      const p1 = this.geometry.nodes[edge.nodes[0]];
      const p2 = this.geometry.nodes[edge.nodes[1]];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = mx - this.geometry.centerX;
      const dy = my - this.geometry.centerY;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      const dockDist = 30 * s;
      const dockX = mx + nx * dockDist;
      const dockY = my + ny * dockDist;
      const color = portColor[port.type] || portColor.any;

      // Rope lines to port
      ctx.save();
      ctx.strokeStyle = "rgba(160, 130, 70, 0.4)";
      ctx.lineWidth = 2 * s;
      ctx.setLineDash([3 * s, 3 * s]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(dockX, dockY);
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(dockX, dockY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Parchment-style label
      ctx.save();
      ctx.shadowColor = "rgba(44, 24, 16, 0.25)";
      ctx.shadowBlur = 4 * s;
      ctx.shadowOffsetY = 2 * s;
      const label = port.type === "any" ? "3:1" : `2:1 ${RESOURCE_LABEL[port.type]}`;
      const portFontSize = Math.round(9.5 * s);
      ctx.font = `700 ${portFontSize}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const boxW = Math.max(36 * s, tw + 12 * s);
      const boxH = 20 * s;
      const bx = dockX - boxW / 2;
      const by = dockY - boxH / 2;

      this.drawRoundedRect(bx, by, boxW, boxH, 5 * s);
      ctx.fillStyle = "rgba(245, 239, 228, 0.92)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `700 ${portFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, dockX, dockY + 0.5);
      ctx.restore();
    });
  }

  drawNodeDots() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    this.geometry.nodes.forEach((node) => {
      if (node.owner != null) return;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 3.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240, 235, 220, 0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(196, 162, 101, 0.3)";
      ctx.lineWidth = 0.8 * s;
      ctx.stroke();
    });
  }

  drawBuildableHighlights() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const human = this.players.find(p => p.isHuman);
    const isHumanMain = human && this.phase === "main" && this.currentPlayer.isHuman;
    if (!isHumanMain) return;

    const canSettlement = hasResources(human.resources, COSTS.settlement);
    const canCity = hasResources(human.resources, COSTS.city);
    const canRoad = hasResources(human.resources, COSTS.road);
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.3;

    // Road highlights (draw first, under node highlights)
    if (canRoad) {
      ctx.lineCap = "round";
      this.geometry.edges.forEach((edge) => {
        if (edge.owner != null) return;
        if (!this.canBuildRoad(human, edge.id, { free: false })) return;
        const [a, b] = edge.nodes;
        const p1 = this.geometry.nodes[a];
        const p2 = this.geometry.nodes[b];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(25, 160, 184, ${0.3 + pulse * 0.2})`;
        ctx.lineWidth = 5 * s;
        ctx.setLineDash([5 * s, 3 * s]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Settlement highlights
    if (canSettlement) {
      this.geometry.nodes.forEach((node) => {
        if (node.owner != null) return;
        if (!this.canBuildSettlement(human, node.id, false)) return;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 9 * s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(25, 160, 184, ${0.15 + pulse * 0.1})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(25, 160, 184, ${0.5 + pulse * 0.2})`;
        ctx.lineWidth = 2 * s;
        ctx.stroke();
      });
    }

    // City upgrade highlights
    if (canCity) {
      this.geometry.nodes.forEach((node) => {
        if (node.owner !== human.id || node.structure !== "settlement") return;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 14 * s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 200, 60, ${0.1 + pulse * 0.1})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 200, 60, ${0.5 + pulse * 0.2})`;
        ctx.lineWidth = 2.5 * s;
        ctx.setLineDash([4 * s, 2 * s]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }

  drawRoads() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    ctx.lineCap = "round";
    this.geometry.edges.forEach((edge) => {
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      const cp = this._wobblyEdge(p1.x, p1.y, p2.x, p2.y);

      if (edge.owner == null) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
        ctx.strokeStyle = "rgba(255, 248, 230, 0.1)";
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([5 * s, 4 * s]);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
      ctx.strokeStyle = "rgba(13, 17, 25, 0.62)";
      ctx.lineWidth = 9.3 * s * (this.isMobileLayout ? 1.25 : 1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
      ctx.strokeStyle = this.players[edge.owner].color;
      ctx.lineWidth = 6.6 * s * (this.isMobileLayout ? 1.25 : 1);
      ctx.stroke();

      const highlight = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      highlight.addColorStop(0, "rgba(255,255,255,0.33)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    });

  }

  drawStructures() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const structScale = this.isMobileLayout ? 1.45 : 1.2; // bigger structures; larger still on phones

    // Draw blue blinking build spots FIRST (behind structures)
    if (this.setupPhase && this.setupAction) {
      const pulse = 0.4 + (Math.sin(Date.now() / 240) + 1) * 0.2;
      if (this.setupAction === "settlement") {
        this.geometry.nodes.forEach((node) => {
          if (!this.canBuildSettlement(this.players[this.setupQueue[this.setupStep]], node.id, true)) return;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 12 * s, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(112, 214, 255, ${pulse})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${pulse + 0.15})`;
          ctx.lineWidth = 2 * s;
          ctx.stroke();
        });
      } else if (this.setupAction === "road" && this.lastSetupNodeId != null) {
        ctx.strokeStyle = `rgba(112, 214, 255, ${pulse})`;
        ctx.lineWidth = 5 * s;
        ctx.setLineDash([6 * s, 4 * s]);
        this.geometry.edges.forEach((edge) => {
          if (edge.owner != null || !edge.nodes.includes(this.lastSetupNodeId)) return;
          const [a, b] = edge.nodes;
          const p1 = this.geometry.nodes[a];
          const p2 = this.geometry.nodes[b];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    } else if (this.currentPlayer?.isHuman && this.phase === "main") {
      const player = this.currentPlayer;
      const pulse = 0.4 + (Math.sin(Date.now() / 240) + 1) * 0.2;
      const showSettlements = this.pendingAction === "settlement";
      const showCities = this.pendingAction === "city";
      const showRoads = this.pendingAction === "road";

      if (showSettlements || showCities) {
        this.geometry.nodes.forEach((node) => {
          let buildable = false;
          if (showCities && this.canBuildCity(player, node.id, false)) {
            ctx.fillStyle = `rgba(255, 200, 60, ${pulse + 0.1})`;
            buildable = true;
          } else if (showSettlements && this.canBuildSettlement(player, node.id, false)) {
            ctx.fillStyle = `rgba(112, 214, 255, ${pulse})`;
            buildable = true;
          }
          if (!buildable) return;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 12 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${pulse + 0.15})`;
          ctx.lineWidth = 2 * s;
          ctx.stroke();
        });
      }

      if (showRoads) {
        ctx.strokeStyle = `rgba(112, 214, 255, ${pulse})`;
        ctx.lineWidth = 5 * s;
        ctx.setLineDash([6 * s, 4 * s]);
        this.geometry.edges.forEach((edge) => {
          if (!this.canBuildRoad(player, edge.id, { free: false })) return;
          const [a, b] = edge.nodes;
          const p1 = this.geometry.nodes[a];
          const p2 = this.geometry.nodes[b];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    }

    // Draw structures ON TOP of blue blinking spots
    this.geometry.nodes.forEach((node) => {
      if (node.owner == null || node.structure == null) return;
      const player = this.players[node.owner];
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.scale(s * structScale, s * structScale);
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = player.color;
      ctx.strokeStyle = "#0f1722";
      ctx.lineWidth = 2;

      if (node.structure === "settlement") {
        // House shape: peaked roof + rectangular body
        ctx.beginPath();
        ctx.moveTo(-9, 8);
        ctx.lineTo(-9, -1);
        ctx.lineTo(0, -10);
        ctx.lineTo(9, -1);
        ctx.lineTo(9, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Door
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillRect(-2, 2, 4, 6);
        // Window
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillRect(-7, -0, 3.5, 3.5);
        ctx.fillRect(3.5, -0, 3.5, 3.5);
      } else {
        // Church/cathedral: tall tower with cross + lower building
        ctx.beginPath();
        // Main building
        ctx.rect(-12, -4, 24, 12);
        // Roof
        ctx.moveTo(-13, -4);
        ctx.lineTo(0, -12);
        ctx.lineTo(13, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Tower
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.rect(-3, -18, 6, 14);
        ctx.fill();
        ctx.stroke();
        // Tower roof
        ctx.beginPath();
        ctx.moveTo(-4, -18);
        ctx.lineTo(0, -23);
        ctx.lineTo(4, -18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Cross on top
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -27); ctx.lineTo(0, -23);
        ctx.moveTo(-2, -25.5); ctx.lineTo(2, -25.5);
        ctx.stroke();
        // Windows
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(-9, 0, 3.5, 3.5);
        ctx.fillRect(5.5, 0, 3.5, 3.5);
        ctx.fillRect(-1.5, -15, 3, 4);
      }
      ctx.restore();
    });

    // Draw confirm-build icon above selected spot
    this.drawBuildConfirmIcon();
  }

  drawBuildConfirmIcon() {
    if (!this.confirmBuild) return;
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const cb = this.confirmBuild;
    let cx, cy;

    if (cb.type === "road") {
      const edge = this.geometry.edges[cb.id];
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      cx = (p1.x + p2.x) / 2;
      cy = (p1.y + p2.y) / 2;
    } else {
      const node = this.geometry.nodes[cb.id];
      cx = node.x;
      cy = node.y;
    }

    // Position icon above the spot
    const iconY = cy - 30 * s;
    const iconR = 16 * s;
    const bounce = Math.sin(Date.now() / 200) * 2 * s;
    const iy = iconY + bounce;

    ctx.save();

    // Shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 8 * s;
    ctx.shadowOffsetY = 2 * s;

    // Circle background
    ctx.beginPath();
    ctx.arc(cx, iy, iconR, 0, Math.PI * 2);
    ctx.fillStyle = "#22a854";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    ctx.shadowColor = "transparent";

    // Draw building type icon inside the circle
    ctx.save();
    ctx.translate(cx, iy);
    const iconScale = s * 0.75;
    ctx.scale(iconScale, iconScale);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;

    if (cb.type === "settlement") {
      // Small house shape
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.lineTo(-8, -1);
      ctx.lineTo(0, -9);
      ctx.lineTo(8, -1);
      ctx.lineTo(8, 7);
      ctx.closePath();
      ctx.fill();
    } else if (cb.type === "city") {
      // City shape
      ctx.beginPath();
      ctx.rect(-10, -4, 20, 12);
      ctx.moveTo(-10, -4);
      ctx.lineTo(0, -13);
      ctx.lineTo(10, -4);
      ctx.closePath();
      ctx.fill();
    } else if (cb.type === "road") {
      // Road: thick diagonal line
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(8, -4);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();

    // Small downward pointer triangle
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s, iy + iconR - 1 * s);
    ctx.lineTo(cx + 6 * s, iy + iconR - 1 * s);
    ctx.lineTo(cx, iy + iconR + 7 * s);
    ctx.closePath();
    ctx.fillStyle = "#22a854";
    ctx.fill();

    ctx.restore();
  }

  getBuildPosition(cb) {
    if (cb.type === "road") {
      const edge = this.geometry.edges[cb.id];
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
    const node = this.geometry.nodes[cb.id];
    return { x: node.x, y: node.y };
  }

  getConfirmIconCenter() {
    if (!this.confirmBuild) return null;
    const s = this.geometry.hexSize / 74;
    const cb = this.confirmBuild;
    let cx, cy;
    if (cb.type === "road") {
      const edge = this.geometry.edges[cb.id];
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      cx = (p1.x + p2.x) / 2;
      cy = (p1.y + p2.y) / 2;
    } else {
      const node = this.geometry.nodes[cb.id];
      cx = node.x;
      cy = node.y;
    }
    return { x: cx, y: cy - 30 * s, r: 16 * s };
  }

  hitTestConfirmIcon(worldX, worldY) {
    const icon = this.getConfirmIconCenter();
    if (!icon) return false;
    // Use a generous hit radius for touch
    const hitR = icon.r * 1.8;
    const dx = worldX - icon.x;
    const dy = worldY - icon.y;
    return dx * dx + dy * dy <= hitR * hitR;
  }

  drawRobberModeOverlay() {
    if (this.pendingAction !== "robber") return;
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const pulse = 0.3 + Math.sin(Date.now() / 300) * 0.15;

    // Dim all hexes slightly, highlight valid targets
    const human = this.players.find((p) => p.isHuman);
    const legal = new Set(this._legalRobberHexes(human).map((h) => h.id));
    this.geometry.hexes.forEach((hex) => {
      if (!legal.has(hex.id)) {
        // Current robber location / friendly-robber protected — blocked
        this.drawHexPath(hex.corners, true);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fill();
      } else {
        // Valid target — subtle red pulse border
        this.drawHexPath(hex.corners, true);
        ctx.strokeStyle = `rgba(220, 60, 60, ${pulse})`;
        ctx.lineWidth = 2.5 * s;
        ctx.stroke();
      }
    });
  }

  drawRollHighlight() {
    if (!this.highlightRoll) return;
    const elapsed = Date.now() - this.highlightRoll.startTime;
    if (elapsed > 2000) { this.highlightRoll = null; return; }
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const alpha = Math.max(0, 1 - elapsed / 2000);
    const pulse = 0.5 + Math.sin(elapsed / 150) * 0.5;
    const num = this.highlightRoll.number;

    this.geometry.hexes.forEach((hex) => {
      if (hex.number !== num || hex.id === this.robberHexId) return;
      // Glowing border around matching hexes
      this.drawHexPath(hex.corners, true);
      ctx.strokeStyle = `rgba(255, 220, 40, ${alpha * (0.6 + pulse * 0.4)})`;
      ctx.lineWidth = 4 * s;
      ctx.stroke();
      // Bright fill
      this.drawHexPath(hex.corners, true);
      ctx.fillStyle = `rgba(255, 240, 100, ${alpha * 0.12})`;
      ctx.fill();
      // Glow on the number token
      ctx.beginPath();
      ctx.arc(hex.center.x, hex.center.y, this.geometry.hexSize * 0.32, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 200, 0, ${alpha * (0.5 + pulse * 0.5)})`;
      ctx.lineWidth = 3 * s;
      ctx.stroke();
    });
  }

  drawPlacementAnims() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const now = Date.now();
    this.placementAnims = this.placementAnims.filter((anim) => {
      const elapsed = now - anim.startTime;
      if (elapsed > 800) return false;

      const t = elapsed / 800; // 0..1
      // Bounce ease: overshoot then settle
      const scale = t < 0.3 ? (t / 0.3) * 1.5 : 1.5 - (t - 0.3) / 0.7 * 0.5;
      const alpha = t < 0.2 ? 1 : 1 - (t - 0.2) / 0.8;
      const color = anim.color || (anim.type === "road" ? "#5ab8d8" : "#dab84e");

      ctx.save();
      ctx.translate(anim.x, anim.y);
      ctx.globalAlpha = alpha * 0.8;

      // Outer expanding ring
      const ringR = 18 * s * scale;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * s;
      ctx.stroke();

      // Second softer ring
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Inner flash
      if (t < 0.25) {
        ctx.globalAlpha = (1 - t / 0.25) * 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 250, 238, 0.8)";
        ctx.fill();
      }

      // Sparkle particles
      if (t < 0.6) {
        const particleAlpha = (1 - t / 0.6) * 0.7;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + t * 2;
          const dist = ringR * (0.8 + t * 0.5);
          const px = Math.cos(angle) * dist;
          const py = Math.sin(angle) * dist;
          ctx.globalAlpha = particleAlpha;
          ctx.beginPath();
          ctx.arc(px, py, 2 * s, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      ctx.restore();
      return true;
    });
  }

  drawHoverEffects() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    if (this.hoverHexId != null) {
      const hex = this.geometry.hexes[this.hoverHexId];
      const isRobberMode = this.pendingAction === "robber";
      this.drawHexPath(hex.corners, true);
      ctx.strokeStyle = isRobberMode ? "rgba(220, 50, 50, 0.85)" : "rgba(35, 132, 204, 0.75)";
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      this.drawHexPath(hex.corners, true);
      ctx.fillStyle = isRobberMode ? "rgba(220, 50, 50, 0.15)" : "rgba(76, 175, 255, 0.08)";
      ctx.fill();
    }
    if (this.hoverEdgeId != null) {
      const edge = this.geometry.edges[this.hoverEdgeId];
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = "rgba(39, 201, 255, 0.95)";
      ctx.lineWidth = 6 * s;
      ctx.stroke();
    }
    if (this.hoverNodeId != null) {
      const node = this.geometry.nodes[this.hoverNodeId];
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8 * s, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(39, 201, 255, 0.65)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8 * s, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(10, 45, 77, 0.8)";
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    }
  }

  drawHoverTooltip() {
    if (!this.hoverTooltip) return;
    // The ✓ tooltip is stale once the confirmation it pointed at is gone
    if (this.hoverTooltip === "Confirm" && !this.confirmBuild) { this.hoverTooltip = ""; return; }
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const x = this.hoverPointer.x + 14 * s;
    const y = this.hoverPointer.y - 28 * s;
    ctx.save();
    ctx.font = `700 ${Math.round(12 * s)}px Inter, sans-serif`;
    const width = Math.max(90 * s, ctx.measureText(this.hoverTooltip).width + 16 * s);
    const height = 24 * s;
    this.drawRoundedRect(x, y, width, height, 7 * s);
    ctx.fillStyle = "rgba(15, 42, 69, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(166, 218, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#e8f6ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.hoverTooltip, x + 8 * s, y + height / 2);
    ctx.restore();
  }

  renderResourceCards() {
    const human = this.players.find((p) => p.isHuman);
    if (!human || !this.resourceCardStrip) return;
    const devCounts = {};
    DEV_CARD_TYPES.forEach((t) => { devCounts[t] = human.devCards[t] + human.newDevCards[t]; });
    devCounts.victoryPoint = human.devVictoryPoints;
    const total = sumResources(human.resources);
    const devTotal = Object.values(devCounts).reduce((a, b) => a + b, 0);
    if (this.handSummary) this.handSummary.textContent = `${total} resource card${total === 1 ? "" : "s"} · ${devTotal} development card${devTotal === 1 ? "" : "s"}`;
    const key = JSON.stringify([human.resources, devCounts, human.newDevCards, this.theme.id, this.isMobileLayout]);
    if (key === this._lastHandKey) return;
    this._lastHandKey = key;
    const devTypes = [...DEV_CARD_TYPES, "victoryPoint"].filter((t) => devCounts[t] > 0);
    const n = RESOURCES.length + devTypes.length;
    // Mobile: a gentle fan (±3°); desktop ignores the rotation
    const fan = (i) => `--rot:${((i - (n - 1) / 2) * 2.6).toFixed(1)}deg;--dy:${(Math.abs(i - (n - 1) / 2) * 1.6).toFixed(1)}px`;
    let html = RESOURCES.map((r, i) => {
      const c = human.resources[r];
      return `<button type="button" class="card${c ? "" : " empty"}" data-card="${r}" style="${fan(i)}" aria-label="${RESOURCE_LABEL[r]}: ${c}" title="${RESOURCE_LABEL[r]} — tap to trade">${cardSvg(r)}<span class="count">${c}</span></button>`;
    }).join("");
    if (devTypes.length) {
      html += '<span class="sep"></span>' + devTypes.map((t, j) => {
        const fresh = t !== "victoryPoint" && human.newDevCards[t] > 0 && human.devCards[t] === 0;
        const name = DEV_NAME[t];
        return `<button type="button" class="card dev${fresh ? " new" : ""}" data-dev="${t}" style="${fan(RESOURCES.length + j)}" aria-label="${name}: ${devCounts[t]}" title="${name}${fresh ? " — playable next turn" : ""}">${cardSvg(t)}<span class="count">${devCounts[t]}</span></button>`;
      }).join("");
    }
    this.resourceCardStrip.innerHTML = html;
    this.resourceCardStrip.querySelectorAll(".card[data-card]").forEach((el) => {
      el.addEventListener("click", () => {
        if (!this.currentPlayer?.isHuman || this.phase !== "main" || this.tradeLocked || this._robberInProgress()) return;
        const res = el.dataset.card;
        if (human.resources[res] <= 0) return;
        // Open trade with this resource pre-selected as "give"
        if (this.tradeModal?.style.display === "none" || !this.tradeModal?.style.display) {
          this.tradeOffer = makeEmptyResources();
          this.tradeRequest = makeEmptyResources();
        }
        this.tradeOffer[res] = Math.min(human.resources[res], (this.tradeOffer[res] || 0) + 1);
        this.toggleBuildSheet(false);
        this.hideDevCardPicker();
        this.tradeModal.style.display = "";
        if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
        this.buildTradeGrids();
        this.updateTradeButtons();
        this.sfx.click();
      });
    });
    this.resourceCardStrip.querySelectorAll(".card[data-dev]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.devCardPicker?.style.display === "none") this.toggleDevCardPicker();
      });
    });
    const strip = this.resourceCardStrip;
    window.requestAnimationFrame(() => this.handArea?.classList.toggle("fits", strip.scrollWidth <= strip.clientWidth + 2));
  }

  renderScoreboard() {
    // Build a key from all visible data — skip re-render if unchanged (preserves tooltip)
    const readyIds = this.rush && !this.setupPhase ? this.rush.ready : null;
    const scoreKey = this.players.map((p, i) =>
      `${i}:${this.displayVictoryPoints(p)}:${sumResources(p.resources)}:${p.settlements.size}:${p.cities.size}:${p.roads.size}:${p.knightsPlayed}:${p.longestRoadLength}:${this.longestRoadHolder}:${this.largestArmyHolder}:${this.currentPlayerIndex}:${p.personality}:${readyIds ? readyIds.includes(p.id) : "-"}:${DEV_CARD_TYPES.reduce((s, t) => s + p.devCards[t] + p.newDevCards[t], 0)}`
    ).join("|") + `:${!!this.winner}:${this.isRush()}:${this.theme.id}:${this.setupPhase}`;
    if (scoreKey === this._lastScoreKey) return;
    this._lastScoreKey = scoreKey;
    const rows = [];
    const chips = [];
    this.players.forEach((player, idx) => {
      const active = idx === this.currentPlayerIndex && !this.winner && !(this.isRush() && !this.setupPhase);
      const isReady = !!readyIds?.includes(player.id);
      const persona = player.personality ? AI_PRESET_INFO[player.personality] : null;
      const personaBadge = persona
        ? `<span class="persona-badge persona-${player.personality}" title="${persona.label}: ${persona.tagline}">${persona.glyph ? `${persona.glyph} ` : ""}${persona.label}</span>`
        : "";
      const totalCards = sumResources(player.resources);
      const totalDev = DEV_CARD_TYPES.reduce((sum, t) => sum + player.devCards[t] + player.newDevCards[t], 0) + (player.isHuman ? player.devVictoryPoints : 0);
      const awards = (this.longestRoadHolder === player.id ? `<span title="Longest Road (+2 points)">${icon("longestRoad")}</span>` : "")
        + (this.largestArmyHolder === player.id ? `<span title="Largest Army (+2 points)">${icon("largestArmy")}</span>` : "");
      const vp = this.displayVictoryPoints(player);
      rows.push(`<div class="prow player-card-mini pc-${idx}${active ? " active" : ""}${isReady ? " rush-ready" : ""}" data-seat="${idx}">
        ${this._av(player, "player-avatar")}
        <div class="nm"><span class="pname">${player.name}${isReady ? '<span class="ready-pill" title="Voted to roll now">Ready</span>' : ""}</span>
          <span class="tag">${player.isHuman ? "Your colony" : personaBadge}</span>
          <div class="stats"><span title="${totalCards} resource cards">${icon("cards")}${totalCards}</span><span title="${totalDev} development cards">${icon("devcard")}${totalDev}</span><span class="badges">${awards}</span></div></div>
        <div class="vp player-vp" title="Points — tap for details">${vp}<small>points</small></div></div>`);
      chips.push(`<div class="pchip pc-${idx}${active ? " active" : ""}${isReady ? " ready" : ""}" data-seat="${idx}" role="button" tabindex="0" aria-label="${player.name}: ${vp} points">
        <div class="bdg">${awards}</div>
        <div class="row">${this._av(player)}<div class="vpn">${vp}<small>PTS</small></div></div>
        <div class="pn">${player.name}</div>${player.isHuman ? "" : personaBadge}
        <div class="mini"><span>${icon("cards")}${totalCards}</span><span>${icon("devcard")}${totalDev}</span></div></div>`);
    });
    this.scoreboard.innerHTML = rows.join("");
    if (this.playerStrip) {
      this.playerStrip.innerHTML = chips.join("");
      this.playerStrip.style.setProperty("--n", this.players.length);
    }
    const wire = (el) => {
      const player = this.players[Number(el.dataset.seat)];
      const vpEl = el.querySelector(".player-vp");
      if (vpEl) {
        vpEl.style.cursor = "help";
        vpEl.addEventListener("mouseenter", () => this._showVPTooltip(player, vpEl));
        vpEl.addEventListener("mouseleave", () => this._hideVPTooltip());
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (document.getElementById("vpTooltip")) { this._hideVPTooltip(); return; }
        this._showVPTooltip(player, el);
        const dismiss = () => { this._hideVPTooltip(); document.removeEventListener("click", dismiss); };
        setTimeout(() => document.addEventListener("click", dismiss, { once: true }), 50);
        setTimeout(() => this._hideVPTooltip(), 4000);
      });
    };
    this.scoreboard.querySelectorAll("[data-seat]").forEach(wire);
    this.playerStrip?.querySelectorAll("[data-seat]").forEach(wire);
  }

  renderTopPanels() {
    // Header now shows cost reference + bank supply — no player panels needed
  }

  _alignScoreboardToHeader() {
    const header = document.querySelector(".table-header");
    const rail = document.querySelector(".rail-players");
    if (!header || !rail || window.innerWidth > 1080) return;
    const headerH = header.getBoundingClientRect().height;
    rail.style.top = `${headerH}px`;
    // Set board-area padding so canvas starts right below the fixed scoreboard
    const boardArea = document.querySelector(".board-area");
    if (boardArea) {
      const railBottom = headerH + rail.getBoundingClientRect().height;
      const boardTop = boardArea.getBoundingClientRect().top;
      let pad = Math.max(0, railBottom - boardTop + 2);
      // Rush: the compact HUD row sits between the scoreboard and the board
      const hud = this.rushHud;
      if (hud && !hud.hidden) {
        hud.style.top = `${pad + 2}px`;
        pad += hud.getBoundingClientRect().height + 6;
      }
      boardArea.style.paddingTop = `${pad}px`;
    }
  }

  _enrichLogText(text) {
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // "2 Lumber" → "2 [icon] Lumber"
    RESOURCES.forEach((r) => {
      const regex = new RegExp(`\\b(\\d+)\\s+${RESOURCE_LABEL[r]}\\b`, "g");
      html = html.replace(regex, `$1 ${icon(r)} ${RESOURCE_LABEL[r]}`);
    });
    // Player names in their colour
    this.players.forEach((p) => {
      html = html.replace(new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), `<span class="who pc-${p.id}">${p.name}</span>`);
    });
    return html;
  }

  renderLog() {
    const rush = this.isRush();
    const last = this.logEntries[this.logEntries.length - 1];
    const key = `${this.logEntries.length}:${last?.time}:${last?.text}:${rush}:${this.theme.id}:${this.currentPlayerIndex}:${this.phase}`;
    if (key === this._lastLogKey) return;
    this._lastLogKey = key;
    const title = this.railLog?.querySelector("h2");
    if (title && title.dataset.mode !== String(rush)) {
      title.dataset.mode = String(rush);
      title.innerHTML = `${icon("log")}${rush ? "Live feed" : "Journal"} <span class="sub">Newest at the bottom</span>
        <button class="btn ghost icon-only sheet-close" id="journalClose" aria-label="Close journal">${icon("close")}</button>`;
      title.querySelector("#journalClose").addEventListener("click", () => this.toggleLog(false));
    }
    const rows = [];
    this.logEntries.slice(rush ? -40 : -30).forEach((entry) => {
      const text = typeof entry === "string" ? entry : entry.text;
      const stamp = rush && entry && Number.isFinite(entry.clock) ? `<span class="time feed-time">${formatClock(entry.clock)}</span>` : "";
      let m = /^Turn (\d+): (.+) rolled (\d+)\.$/.exec(text);
      if (m) {
        rows.push(`<div class="jturn">Turn ${m[1]} · ${m[2]}</div><div class="jrow">${icon("dice")}<div class="t">${this._enrichLogText(m[2])} rolled <b>${m[3]}</b></div></div>`);
        return;
      }
      m = /^Roll #(\d+): rolled (\d+)\.$/.exec(text);
      if (m) {
        rows.push(`<div class="jturn feed-roll">Roll ${m[1]}${stamp ? ` · ${formatClock(entry.clock)}` : ""}</div><div class="jrow">${icon("dice")}<div class="t">Dice rolled <b>${m[2]}</b></div></div>`);
        return;
      }
      const cls = /\bwins?\b/.test(text) ? " win winner" : /^(Session restored|Initial placement|Place your|Now place)/.test(text) ? " dim" : "";
      rows.push(`<div class="jrow${cls}">${icon(this._logIcon(text))}<div class="t">${stamp}${this._enrichLogText(text)}</div></div>`);
    });
    this.logContainer.innerHTML = rows.join("");
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    // Mobile: one-line ticker with the newest entry (or the next step, see renderStatusAndControls)
    // System noise ("Session restored.", …) and trade-offer lines never fill the ticker:
    // show the newest real event, or else what happens next.
    if (this.tickerText && !this._tickerPrompt) {
      // trade offers are already on screen as a card (Rush) or a sheet (Classic): don't repeat them here
      const NOISE = /^(Session restored|Initial placement complete|Game (saved|loaded))|\boffers you\b/;
      const real = [...this.logEntries].reverse().find((e) => !NOISE.test(e.text.replace(/^Turn \d+: /, "")));
      if (real) {
        const t = real.text.replace(/^Turn \d+: /, "").replace(/^Roll #\d+: rolled/, "Dice rolled");
        this.tickerText.innerHTML = this._enrichLogText(t);
        if (this.tickerIcon) this.tickerIcon.innerHTML = icon(this._logIcon(real.text));
      } else if (this.currentPlayer && !this.winner) {
        const cp = this.currentPlayer;
        const t = rush && !this.setupPhase ? "Rush · build and trade until the next roll"
          : cp.isHuman ? (this.phase === "pre_roll" ? "Your turn · roll the dice" : "Your turn · build, trade or play a card")
          : `${cp.name} is playing`;
        this.tickerText.innerHTML = this._enrichLogText(t);
        if (this.tickerIcon) this.tickerIcon.innerHTML = icon(cp.isHuman && this.phase === "pre_roll" ? "dice" : "log");
      }
    }
  }

  renderStatusAndControls() {
    const rushOn = this.isRush() && !this.setupPhase;
    const humanTurn = this.currentPlayer.isHuman && !this.winner;
    const mainPhase = this.phase === "main";
    const preRoll = this.phase === "pre_roll";
    const noDevPlayed = rushOn ? !this.currentPlayer.rushDevPlayed : !this.currentTurnPlayedDevCard;
    const human = this.players.find((p) => p.isHuman) || this.currentPlayer;
    const active = this.currentPlayer;
    const hasRoadCost = hasResources(human.resources, COSTS.road);
    const hasSettlementCost = hasResources(human.resources, COSTS.settlement);
    const hasCityCost = hasResources(human.resources, COSTS.city);
    const hasDevCost = hasResources(human.resources, COSTS.development);
    const roadMissing = missingCostString(human.resources, COSTS.road);
    const settlementMissing = missingCostString(human.resources, COSTS.settlement);
    const cityMissing = missingCostString(human.resources, COSTS.city);
    const devMissing = missingCostString(human.resources, COSTS.development);
    const inSetup = this.setupPhase;
    const robberBlocking = this._robberInProgress();
    const placeName = { road: "a road", settlement: "a settlement", city: "a city" };

    const setButtonState = (button, enabled, disabledHint, enabledHint = "") => {
      if (!button) return;
      button.disabled = !enabled;
      button.title = enabled ? enabledHint : disabledHint;
    };

    // ── status pill (desktop turn banner; mobile uses the ticker) ──
    let title = humanTurn ? "Your turn" : `${active.name}'s turn`;
    let status;
    if (this.setupPhase && this.setupAction && humanTurn) {
      title = "Your turn · setup";
      status = this.confirmBuild ? "Tap ✓ to confirm — or pick another spot" : `Place ${placeName[this.setupAction]} · ${this.isMobileLayout ? "tap" : "click"} a glowing spot`;
    } else if (this.setupPhase) {
      status = "Placing a starting settlement…";
    } else if (this.winner) {
      title = `${this.winner.name} win${this._s(this.winner)}!`;
      status = `${this.winner.victoryPoints} points`;
    } else if (rushOn && this.phase === "seven" && this.pendingAction !== "robber") {
      title = "Robber!";
      status = "Game paused — discards, then the robber";
    } else if (humanTurn && this.pendingAction === "robber") {
      status = "Move the robber · tap a tile";
    } else if (rushOn && mainPhase && !this.pendingAction) {
      title = "Rush";
      status = this.autoplayInterval ? "Bots are playing for you" : "Build, trade or play a card any time";
    } else if (humanTurn && preRoll) {
      status = "Roll the dice to start your turn";
    } else if (humanTurn && mainPhase) {
      if (this.pendingAction) {
        if (this.confirmBuild) status = "Tap ✓ to confirm — or pick another spot";
        else status = this.freeRoadsRemaining > 0 ? `Place a free road (${this.freeRoadsRemaining} left)` : `Placing ${placeName[this.pendingAction] || this.pendingAction} · tap a glowing spot`;
      } else {
        status = "Build, trade or play a card";
      }
    } else {
      status = preRoll ? "Rolling the dice…" : "Thinking…";
    }
    if (this.actionPromptText) this.actionPromptText.textContent = status;
    // Phones: the ticker line becomes the instruction while you have to act (place, robber, discard)
    const mustAct = !this.winner && ((this.setupPhase && humanTurn && this.setupAction) || (humanTurn && this.pendingAction) || !!this.pendingDiscard);
    const prompt = mustAct ? (this.pendingDiscard ? "The robber came! Hand back half of your cards" : status) : "";
    if (prompt !== (this._tickerPrompt || "")) {
      this._tickerPrompt = prompt;
      this._lastLogKey = null;
      document.querySelector("#ticker")?.classList.toggle("prompt", !!prompt);
      if (prompt && this.tickerText) {
        this.tickerText.textContent = prompt;
        if (this.tickerIcon) this.tickerIcon.innerHTML = icon(this.pendingDiscard || this.pendingAction === "robber" ? "robber" : this.confirmBuild?.type || this.pendingAction || this.setupAction || "build");
      }
      if (!prompt) this.renderLog();
    }
    if (this.turnBannerTitle) this.turnBannerTitle.textContent = title;
    if (this.actionPromptAvatar) {
      const seat = String(active.id);
      if (this.actionPromptAvatar.dataset.seat !== seat || this.actionPromptAvatar.dataset.theme !== this.theme.id) {
        this.actionPromptAvatar.dataset.seat = seat;
        this.actionPromptAvatar.dataset.theme = this.theme.id;
        this.actionPromptAvatar.innerHTML = this._av(active);
      }
    }
    if (this.turnBanner) this.turnBanner.className = `turn-banner pc-${(rushOn ? human : active).id}`;
    if (this.cancelActionBtn) this.cancelActionBtn.hidden = !(humanTurn && (this.confirmBuild || (this.pendingAction && this.pendingAction !== "robber" && !this.freeRoadsRemaining)));

    // ── primary action: Roll dice ↔ End turn (Classic), Ready (Rush), waiting bar (opponent) ──
    const rollBtn = this.rollDiceBtn;
    const endBtn = this.endTurnBtn;
    const buildPanel = this.actionPromptBuild;
    const oppTurn = !rushOn && !this.winner && !humanTurn;
    this.app?.classList.toggle("opp-turn", oppTurn);
    if (rollBtn) {
      rollBtn.style.display = !rushOn && !inSetup && humanTurn && preRoll && !robberBlocking ? "inline-flex" : "none";
      rollBtn.disabled = inSetup || !(humanTurn && preRoll) || robberBlocking;
    }
    if (endBtn) {
      endBtn.style.display = !rushOn && humanTurn && (mainPhase || inSetup) && !robberBlocking ? "inline-flex" : "none";
      endBtn.disabled = inSetup || !(humanTurn && mainPhase) || robberBlocking || (!!this.pendingAction && !this.freeRoadsRemaining);
    }
    if (this.rushReadyBtn) this.rushReadyBtn.hidden = !rushOn || !!this.winner;
    if (this.waitingBar) {
      let wait = "";
      if (this.winner && !document.querySelector(".game-over-overlay")) {
        wait = `${icon("vp")}<div class="wt">${this.winner.name} win${this._s(this.winner)}<small>Game over</small></div><button type="button" class="btn primary" data-newgame>New game</button>`;
      } else if (humanTurn && this.pendingAction === "robber") {
        wait = `${icon("robber")}<div class="wt">Move the robber<small>Tap a tile on the board</small></div>`;
      } else if (oppTurn) {
        wait = `${this._av(active)}<div class="wt">${active.name} is playing<small>${inSetup ? "Placing a settlement" : preRoll ? "Rolling the dice" : "Building and trading"}</small></div><div class="dots"><i></i><i></i><i></i></div>`;
      }
      const wkey = `${wait.length}:${active.id}:${preRoll}:${inSetup}:${!!this.winner}:${this.pendingAction}`;
      if (this.waitingBar.dataset.key !== wkey) {
        this.waitingBar.dataset.key = wkey;
        this.waitingBar.innerHTML = wait;
        this.waitingBar.querySelector("[data-newgame]")?.addEventListener("click", () => this._showDifficultyModal());
      }
      this.waitingBar.hidden = !wait;
      if (this.winner && wait) { rollBtn && (rollBtn.style.display = "none"); endBtn && (endBtn.style.display = "none"); }
    }
    if (buildPanel) buildPanel.style.display = this.pendingDiscard ? "none" : ""; // hidden while discarding; otherwise shown, disabled when not usable

    // Hide trade panel when not in main phase or during robber
    if (robberBlocking || !humanTurn || !mainPhase) this.hideTradePanel();

    this.nextTurnBtn.disabled = !!this.winner || humanTurn || this.autoplayInterval != null || this.isRush();
    const canBuildNow = humanTurn && mainPhase && !robberBlocking;
    const piecesHint = (type) => (this.piecesLeft(human, type) <= 0 ? `No ${type}s left` : null);
    setButtonState(this.buildRoadBtn, canBuildNow && (hasRoadCost || this.freeRoadsRemaining > 0) && !piecesHint("road"),
      piecesHint("road") || (roadMissing ? `Need ${roadMissing}` : "Not available now"), "Build a road (1)");
    setButtonState(this.buildSettlementBtn, canBuildNow && hasSettlementCost && !piecesHint("settlement"),
      piecesHint("settlement") || (settlementMissing ? `Need ${settlementMissing}` : "Not available now"), "Build a settlement (2)");
    setButtonState(this.buildCityBtn, canBuildNow && hasCityCost && !piecesHint("city"),
      piecesHint("city") || (cityMissing ? `Need ${cityMissing}` : "Not available now"), "Upgrade to a city (3)");
    setButtonState(this.buyDevBtn, canBuildNow && hasDevCost && this.devDeck.length > 0,
      this.devDeck.length <= 0 ? "Deck empty" : devMissing ? `Need ${devMissing}` : "Not available now", "Buy a development card (B)");
    // pieces left + which cost icons are still missing
    [["road", this.buildRoadBtn], ["settlement", this.buildSettlementBtn], ["city", this.buildCityBtn], ["development", this.buyDevBtn]].forEach(([type, btn]) => {
      if (!btn) return;
      const left = btn.querySelector(".left");
      if (left) left.textContent = type === "development" ? `${this.devDeck.length} in deck` : `${this.piecesLeft(human, type)} left`;
      const need = btn.querySelector(".need");
      if (need) {
        const have = { ...human.resources };
        need.querySelectorAll("[data-r]").forEach((ic) => {
          const r = ic.dataset.r;
          const ok = have[r] > 0;
          if (ok) have[r] -= 1;
          ic.classList.toggle("miss", !ok);
        });
      }
    });
    if (this.tradeBankBtn) {
      this.tradeBankBtn.style.display = this.pendingDiscard ? "none" : "inline-flex";
      this.tradeBankBtn.disabled = !(humanTurn && mainPhase) || inSetup || robberBlocking;
      this.tradeBankBtn.title = "Trade (T)";
    }

    const canPlayDev = (type) => humanTurn && this.canPlayDevelopmentCard(human, type);
    this.playKnightBtn.disabled = !canPlayDev("knight");
    this.playRoadBuildingBtn.disabled = !canPlayDev("roadBuilding");
    this.playYearOfPlentyBtn.disabled = !canPlayDev("yearOfPlenty");
    this.playMonopolyBtn.disabled = !canPlayDev("monopoly");
    if (this.playDevBtn) {
      const showPlayDev = !inSetup && noDevPlayed && DEV_CARD_TYPES.some(canPlayDev);
      this.playDevBtn.style.display = showPlayDev ? "inline-flex" : "none";
      if (!showPlayDev && !this.isMobileLayout) this.hideDevCardPicker();
    }
    const mDot = document.querySelector("#mCardsDot");
    if (mDot) {
      const nDev = DEV_CARD_TYPES.reduce((s, t) => s + human.devCards[t] + human.newDevCards[t], 0) + human.devVictoryPoints;
      mDot.hidden = !nDev;
      mDot.textContent = String(nDev);
    }
    const mBuild = document.querySelector("#mBuildBtn");
    if (mBuild) mBuild.disabled = !canBuildNow;

    [this.buildRoadBtn, this.buildSettlementBtn, this.buildCityBtn].forEach((btn) => btn?.classList.remove("selected-action"));
    if (this.pendingAction === "road") this.buildRoadBtn?.classList.add("selected-action");
    if (this.pendingAction === "settlement") this.buildSettlementBtn?.classList.add("selected-action");
    if (this.pendingAction === "city") this.buildCityBtn?.classList.add("selected-action");

    // ── mobile confirm pill: the Place button sits right above the thumb ──
    if (this.confirmPill) {
      const info = this.isMobileLayout && humanTurn && this.confirmBuild ? this._confirmPillInfo() : null;
      this.confirmPill.hidden = !info;
      if (info) {
        document.querySelector("#confirmPillIcon").innerHTML = icon(info.icon);
        document.querySelector("#confirmPillTitle").textContent = info.title;
        document.querySelector("#confirmPillSub").textContent = info.sub;
      }
    }
  }

  // ── Persistent Dice Display ──────────────────────────────────────────
  renderLastDice() {
    const el = this.lastDiceDisplay;
    if (!el) return;
    if (!this.lastDice || !this.lastRoll) {
      el.style.display = "none";
      this._lastDiceKey = null;
      return;
    }
    el.style.display = "flex";
    const key = `${this.lastDice.d1}:${this.lastDice.d2}:${this.lastRoll}:${this.turn}:${this.rush?.rollNo}:${this.theme.id}`;
    if (key === this._lastDiceKey) return;
    const fresh = this._lastDiceKey != null;
    this._lastDiceKey = key;
    let label = "Robber!";
    if (this.lastRoll !== 7) {
      const terr = [...new Set(this.geometry.hexes.filter((h) => h.number === this.lastRoll && h.id !== this.robberHexId).map((h) => TERRAIN_NAME[h.resource]))];
      label = terr.length ? `${terr.join(" & ")} paid out` : "Nothing paid out";
    }
    el.innerHTML = `${dieSvg(this.lastDice.d1, "die-svg")}${dieSvg(this.lastDice.d2, "die-svg")}<span class="sum">${this.lastRoll}</span><span class="dl">${label}</span>
      <button class="stats-btn" type="button" title="Roll statistics" aria-label="Roll statistics">${icon("dice")}</button>`;
    el.title = `Last roll ${this.lastRoll}`;
    el.querySelector(".stats-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("rollStatsPanel")?.classList.toggle("open");
    });
    if (fresh) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
    this.renderRollStats();
  }

  renderRollStats() {
    let panel = document.getElementById("rollStatsPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "rollStatsPanel";
      panel.className = "roll-stats-panel";
      this.lastDiceDisplay.parentElement.appendChild(panel);
    }
    const totalRolls = Object.values(this.rollHistory).reduce((a, b) => a + b, 0);
    if (totalRolls === 0) {
      panel.innerHTML = '<span class="roll-stats-empty">No rolls yet</span>';
      return;
    }
    const maxCount = Math.max(...Object.values(this.rollHistory), 1);
    let barsHTML = "";
    for (let n = 2; n <= 12; n++) {
      const count = this.rollHistory[n] || 0;
      const pct = Math.round((count / maxCount) * 100);
      const isHot = n === 6 || n === 8;
      const isLast = n === this.lastRoll;
      barsHTML += `
        <div class="roll-bar-col${isLast ? " last-roll" : ""}">
          <span class="roll-bar-count">${count || ""}</span>
          <div class="roll-bar" style="height:${Math.max(pct, 4)}%">
            <div class="roll-bar-fill${isHot ? " hot" : ""}"></div>
          </div>
          <span class="roll-bar-label">${n}</span>
        </div>`;
    }
    panel.innerHTML = `
      <div class="roll-stats-header">Rolls <span class="roll-stats-total">(${totalRolls})</span></div>
      <div class="roll-bars">${barsHTML}</div>
    `;
  }

  // ── Sound Engine (Web Audio API synthesis) ────────────────────────────
  _getAudioCtx() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._audioCtx.state === "suspended") this._audioCtx.resume();
    return this._audioCtx;
  }

  _playTone(freq, duration = 0.12, type = "sine", vol = 0.15) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this._getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  _playChord(freqs, duration = 0.2, type = "sine", vol = 0.08) {
    freqs.forEach(f => this._playTone(f, duration, type, vol));
  }

  _playNoise(duration = 0.08, vol = 0.1) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this._getAudioCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * vol;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (_) {}
  }

  // Named sound effects
  sfx = {
    diceRoll: () => {
      // Rattle-like: quick noise bursts
      for (let i = 0; i < 3; i++) {
        setTimeout(() => this._playNoise(0.04, 0.06), i * 50);
      }
    },
    diceResult: () => {
      this._playTone(440, 0.1, "triangle", 0.12);
      setTimeout(() => this._playTone(554, 0.15, "triangle", 0.1), 80);
    },
    buildSettlement: () => {
      this._playTone(523, 0.1, "square", 0.08);
      setTimeout(() => this._playTone(659, 0.12, "square", 0.08), 80);
      setTimeout(() => this._playTone(784, 0.18, "square", 0.06), 160);
    },
    buildCity: () => {
      this._playChord([523, 659, 784], 0.25, "triangle", 0.07);
      setTimeout(() => this._playChord([587, 740, 880], 0.3, "triangle", 0.06), 150);
    },
    buildRoad: () => {
      this._playTone(330, 0.08, "square", 0.07);
      setTimeout(() => this._playTone(392, 0.1, "square", 0.06), 60);
    },
    trade: () => {
      this._playTone(440, 0.08, "sine", 0.1);
      setTimeout(() => this._playTone(554, 0.08, "sine", 0.1), 70);
      setTimeout(() => this._playTone(659, 0.12, "sine", 0.08), 140);
    },
    tradeReject: () => {
      this._playTone(330, 0.12, "sawtooth", 0.06);
      setTimeout(() => this._playTone(277, 0.18, "sawtooth", 0.05), 100);
    },
    robber: () => {
      this._playTone(220, 0.2, "sawtooth", 0.08);
      setTimeout(() => this._playTone(185, 0.25, "sawtooth", 0.06), 150);
    },
    steal: () => {
      this._playTone(600, 0.06, "sine", 0.08);
      setTimeout(() => this._playTone(400, 0.1, "sine", 0.06), 50);
    },
    devCard: () => {
      this._playTone(392, 0.1, "triangle", 0.1);
      setTimeout(() => this._playTone(494, 0.12, "triangle", 0.08), 80);
    },
    yourTurn: () => {
      this._playTone(523, 0.08, "sine", 0.12);
      setTimeout(() => this._playTone(659, 0.08, "sine", 0.1), 100);
      setTimeout(() => this._playTone(784, 0.15, "sine", 0.08), 200);
    },
    victory: () => {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => this._playTone(f, 0.25, "triangle", 0.1), i * 150);
      });
    },
    click: () => {
      this._playTone(800, 0.04, "sine", 0.06);
    },
    error: () => {
      this._playTone(200, 0.15, "square", 0.08);
    },
    resourceGain: () => {
      this._playTone(880, 0.06, "sine", 0.06);
      setTimeout(() => this._playTone(1100, 0.08, "sine", 0.05), 50);
    },
  };

  // ── New-game setup screen ─────────────────────────────────────────────
  // Mode (Classic / Rush), rules, dice, map and opponents. The last choice is remembered.
  _showDifficultyModal() {
    document.querySelector(".newgame-modal")?.remove();
    const last = normalizeSettings(ColonistFullGame.loadLastSettings());
    let d = normalizeSettings(JSON.parse(JSON.stringify(last)));
    const overlay = document.createElement("div");
    overlay.className = "newgame-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "New game");
    // Hold the Rush clock while the screen is open
    this.uiPaused = true;
    let fineTuneOpen = window.innerWidth > 700;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const levelLabel = (level) => AI_LEVEL_LABEL[level] || cap(level);
    const presetLabel = (key) => AI_PRESET_INFO[key]?.label || "Custom";
    const strategySummary = (s) => {
      const trade = { none: "no trades", conservative: "careful trades", balanced: "fair trades", aggressive: "eager trades" }[s.trading];
      const dev = { none: "no dev cards", reactive: "reactive cards", strategic: "strategic cards" }[s.devCards];
      const aware = { none: "ignores rivals", basic: "watches rivals", advanced: "targets leader" }[s.awareness];
      return `${cap(s.placement)} placement · ${trade} · ${dev} · ${aware}`;
    };
    const badge = (key) => {
      const info = AI_PRESET_INFO[key] || AI_PRESET_INFO.custom;
      return `<span class="persona-badge persona-${key}">${info.glyph ? `${info.glyph} ` : ""}${info.label}</span>`;
    };
    const botPreset = (i) => (d.botStyleMode === "each" ? d.perBot[i] : d.allPreset);
    const botStrategy = (i) => (d.botStyleMode === "each" ? AI_PRESETS[d.perBot[i]] : d.allStrategy);
    const diceHelp = {
      random: "Random: two independent dice, every roll a fresh throw.",
      balanced: "Balanced: real dice odds, but long streaks and droughts are smoothed out.",
      deck: "Event deck: all 36 dice results drawn from a deck, reshuffled when empty.",
    };
    const mapHelp = {
      random: "Random: tiles and numbers shuffled freely.",
      balanced: "Balanced: no adjacent 6/8 or equal numbers, every resource on fair numbers.",
      beginner: "Beginner: the official fixed starter layout.",
    };
    const mapIcon = (kind) => {
      const colors = {
        random: ["#4e8a3a", "#c9a53a", "#c8643c", "#8d9aa8", "#7fbf4a"],
        balanced: ["#c8643c", "#4e8a3a", "#c9a53a", "#7fbf4a", "#8d9aa8"],
        beginner: ["#8d9aa8", "#7fbf4a", "#c9a53a", "#4e8a3a", "#c8643c"],
      }[kind];
      return `<span class="ng-map-icon" aria-hidden="true">${colors.map((c) => `<i style="--hex:${c}"></i>`).join("")}</span>`;
    };
    const seg = (name, options, value, extraClass = "") => `
      <div class="ng-seg ${extraClass}" role="radiogroup" data-seg="${name}">
        ${options.map(([v, label]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="ng-seg-btn${String(v) === String(value) ? " selected" : ""}" data-value="${v}">${label}</button>`).join("")}
      </div>`;
    const stepper = (name, value, min, max) => `
      <div class="ng-stepper" data-stepper="${name}" data-min="${min}" data-max="${max}">
        <button type="button" class="ng-step-btn" data-step="-1" aria-label="Decrease" ${value <= min ? "disabled" : ""}>&minus;</button>
        <span class="ng-step-value" aria-live="polite">${value}</span>
        <button type="button" class="ng-step-btn" data-step="1" aria-label="Increase" ${value >= max ? "disabled" : ""}>+</button>
      </div>`;
    const summaryText = () => {
      const bots = PLAYER_CONFIG.slice(1, d.numBots + 1).map((_, i) => presetLabel(botPreset(i)));
      const uniq = [...new Set(bots)];
      const mode = d.mode === "rush" ? `<strong>Rush · ${d.rushInterval}s rolls</strong>` : "<strong>Classic</strong>";
      const extras = [
        `${d.winPoints} VP`,
        d.discardLimit !== 7 ? `discard over ${d.discardLimit}` : null,
        d.friendlyRobber ? "friendly robber" : null,
        `${d.dice === "deck" ? "event-deck" : d.dice} dice`,
        `${d.map} map`,
        `${d.numBots} bot${d.numBots > 1 ? "s" : ""} (${uniq.length === 1 && bots.length > 1 ? `all ${uniq[0]}` : bots.join(", ")})`,
      ].filter(Boolean);
      return `${mode} · ${extras.join(" · ")}`;
    };

    const render = () => {
      const presetKeys = [...Object.keys(AI_PRESETS), "custom"];
      overlay.innerHTML = `
        <div class="ng-card">
          <header class="ng-header">
            <div>
              <h2 class="ng-title">New Game</h2>
              <p class="ng-subtitle">Pick a mode, tune the rules, and choose your opponents.</p>
            </div>
            <button type="button" class="ng-pill-btn" data-action="last" title="Restore the settings of your last game">&#8635; Use last settings</button>
          </header>
          <div class="ng-columns">
            <div class="ng-col">
              <section class="ng-section">
                <h3 class="ng-section-title">Mode</h3>
                <div class="ng-mode-row">
                  <button type="button" class="ng-mode-card${d.mode === "classic" ? " selected" : ""}" data-mode="classic" aria-pressed="${d.mode === "classic"}">
                    <span class="ng-mode-name"><span class="ng-mode-icon">&#10227;</span>Classic</span>
                    <span class="ng-mode-desc">Take turns: roll, trade, build, end turn. Calm and tactical.</span>
                  </button>
                  <button type="button" class="ng-mode-card rush${d.mode === "rush" ? " selected" : ""}" data-mode="rush" aria-pressed="${d.mode === "rush"}">
                    <span class="ng-mode-tag">Fast</span>
                    <span class="ng-mode-name"><span class="ng-mode-icon">&#9889;</span>Rush</span>
                    <span class="ng-mode-desc">No turns. Everyone builds &amp; trades at once; dice roll on a timer.</span>
                  </button>
                </div>
              </section>
              ${d.mode === "rush" ? `
              <section class="ng-section ng-rush-section">
                <h3 class="ng-section-title">Rush settings</h3>
                <div class="ng-row">
                  <div class="ng-row-label">Roll every</div>
                  <div class="ng-row-control">
                    ${seg("rushInterval", RUSH_INTERVALS.map((s) => [s, `${s}s`]), d.rushInterval, "ng-seg-pills")}
                    <p class="ng-help">Everyone can vote &ldquo;Ready&rdquo; to roll early once all players agree.</p>
                  </div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Robber on 7</div>
                  <div class="ng-row-control">
                    <p class="ng-help ng-help-tight">Players in order: the game pauses for discards and the robber; a badge shows who moves it next.</p>
                  </div>
                </div>
              </section>` : ""}
              <section class="ng-section">
                <h3 class="ng-section-title">Rules</h3>
                <div class="ng-row">
                  <div class="ng-row-label">Points to win</div>
                  <div class="ng-row-control">${stepper("winPoints", d.winPoints, 5, 15)}</div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Discard limit</div>
                  <div class="ng-row-control">
                    ${stepper("discardLimit", d.discardLimit, 7, 12)}
                    <p class="ng-help">On a 7, anyone holding more than ${d.discardLimit} cards discards half.</p>
                  </div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Friendly robber</div>
                  <div class="ng-row-control">
                    <button type="button" class="ng-switch${d.friendlyRobber ? " on" : ""}" role="switch" aria-checked="${d.friendlyRobber}" data-action="friendly" aria-label="Friendly robber"><span></span></button>
                    <p class="ng-help">Robber can&rsquo;t block or steal from players with 2 points or fewer.</p>
                  </div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Dice</div>
                  <div class="ng-row-control">
                    ${seg("dice", [["random", "&#127922; Random"], ["balanced", "&#9878; Balanced"], ["deck", "&#127183; Event deck"]], d.dice, "ng-seg-pills")}
                    <p class="ng-help">${diceHelp[d.dice]}</p>
                  </div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Map</div>
                  <div class="ng-row-control">
                    <div class="ng-map-row" role="radiogroup">
                      ${[["random", "Random"], ["balanced", "Balanced / fair"], ["beginner", "Beginner (fixed)"]].map(([v, label]) => `
                        <button type="button" role="radio" aria-checked="${d.map === v}" class="ng-map-card${d.map === v ? " selected" : ""}" data-map="${v}">${mapIcon(v)}<span>${label}</span></button>`).join("")}
                    </div>
                    <p class="ng-help">${mapHelp[d.map]}</p>
                  </div>
                </div>
              </section>
            </div>
            <div class="ng-col">
              <section class="ng-section">
                <h3 class="ng-section-title">Opponents</h3>
                <div class="ng-row ng-row-inline">
                  <div class="ng-row-label">Number of bots</div>
                  ${seg("numBots", [[1, "1"], [2, "2"], [3, "3"]], d.numBots, "ng-seg-pills ng-seg-round")}
                </div>
                <div class="ng-row ng-row-inline">
                  <div class="ng-row-label ng-row-label-sm">Style for</div>
                  ${seg("botStyleMode", [["all", "All bots"], ["each", "Each bot separately"]], d.botStyleMode, "ng-seg-pills")}
                </div>
                ${d.botStyleMode === "all" ? `
                <div class="ng-presets">
                  ${presetKeys.map((key) => {
                    const info = AI_PRESET_INFO[key];
                    return `<button type="button" class="ng-preset${d.allPreset === key ? " selected" : ""}" data-preset="${key}" aria-pressed="${d.allPreset === key}">
                      <span class="ng-preset-name">${info.label}</span>
                      <span class="ng-preset-tag">${info.tagline}</span>
                      ${info.isNew ? '<span class="ng-new">New</span>' : ""}
                    </button>`;
                  }).join("")}
                </div>
                <details class="ng-finetune"${fineTuneOpen ? " open" : ""}>
                  <summary>Fine-tune <span class="ng-finetune-hint">5 strategy dials</span></summary>
                  <div class="ng-dims">
                    ${Object.entries(AI_STRATEGY_CATEGORIES).map(([key, cat]) => `
                      <div class="ng-dim">
                        <div class="ng-dim-label">${cat.label}<span>${AI_DIMENSION_HINT[key]}</span></div>
                        <div class="ng-dim-control">
                          ${seg(`dim:${key}`, cat.levels.map((l) => [l, levelLabel(l)]), d.allStrategy[key], "ng-seg-bar")}
                          <p class="ng-help"><strong>${levelLabel(d.allStrategy[key])}:</strong> ${AI_LEVEL_PLAIN[key][d.allStrategy[key]]}</p>
                        </div>
                      </div>`).join("")}
                  </div>
                </details>` : `
                <p class="ng-help">Pick a personality per bot. You can fine-tune each bot later under Settings &rsaquo; Bot personalities.</p>`}
              </section>
              <section class="ng-section">
                <h3 class="ng-section-title">Your table</h3>
                <div class="ng-table">
                  ${PLAYER_CONFIG.slice(1, d.numBots + 1).map((cfg, i) => `
                    <div class="ng-bot pc-${i + 1}">
                      ${avatarSvg(i + 1, "ng-bot-avatar")}
                      <div class="ng-bot-info">
                        <div class="ng-bot-name"><span class="who pc-${i + 1}" style="color:${cfg.color}">${esc(cfg.name)}</span>${badge(botPreset(i))}</div>
                        <div class="ng-bot-desc">${strategySummary(botStrategy(i))}</div>
                      </div>
                      ${d.botStyleMode === "each" ? `
                      <select class="ng-bot-select" data-bot="${i}" aria-label="${esc(cfg.name)} personality">
                        ${Object.keys(AI_PRESETS).map((key) => `<option value="${key}"${d.perBot[i] === key ? " selected" : ""}>${presetLabel(key)}</option>`).join("")}
                      </select>` : ""}
                    </div>`).join("")}
                </div>
              </section>
            </div>
          </div>
          <footer class="ng-footer">
            <div class="ng-summary">${summaryText()}</div>
            <div class="ng-actions">
              <button type="button" class="ng-cancel btn-neutral" data-action="cancel">Cancel</button>
              <button type="button" class="ng-start btn-build" data-action="start">Start Game</button>
            </div>
          </footer>
        </div>`;
      wire();
    };

    const wire = () => {
      const card = overlay.querySelector(".ng-card");
      overlay.querySelector(".ng-finetune")?.addEventListener("toggle", (e) => { fineTuneOpen = e.target.open; });
      card.addEventListener("click", (e) => {
        const t = e.target.closest("button");
        if (!t || !card.contains(t)) return;
        let changed = true;
        if (t.dataset.mode) d.mode = t.dataset.mode;
        else if (t.dataset.map) d.map = t.dataset.map;
        else if (t.dataset.preset) {
          d.allPreset = t.dataset.preset;
          if (AI_PRESETS[d.allPreset]) d.allStrategy = { ...AI_PRESETS[d.allPreset] };
        } else if (t.dataset.step) {
          const box = t.closest("[data-stepper]");
          const key = box.dataset.stepper;
          d[key] = clamp(d[key] + Number(t.dataset.step), Number(box.dataset.min), Number(box.dataset.max));
        } else if (t.classList.contains("ng-seg-btn")) {
          const key = t.closest("[data-seg]").dataset.seg;
          const raw = t.dataset.value;
          if (key.startsWith("dim:")) {
            d.allStrategy = { ...d.allStrategy, [key.slice(4)]: raw };
            d.allPreset = presetForStrategy(d.allStrategy);
          } else {
            d[key] = ["rushInterval", "numBots"].includes(key) ? Number(raw) : raw;
          }
        } else if (t.dataset.action === "friendly") d.friendlyRobber = !d.friendlyRobber;
        else if (t.dataset.action === "last") d = normalizeSettings(JSON.parse(JSON.stringify(last)));
        else if (t.dataset.action === "cancel") { close(); return; }
        else if (t.dataset.action === "start") { start(); return; }
        else changed = false;
        if (changed) {
          this.sfx.click();
          const scroll = card.scrollTop;
          render();
          overlay.querySelector(".ng-card").scrollTop = scroll;
        }
      });
      card.querySelectorAll(".ng-bot-select").forEach((sel) => sel.addEventListener("change", () => {
        d.perBot = d.perBot.map((p, i) => (i === Number(sel.dataset.bot) ? sel.value : p));
        const scroll = card.scrollTop;
        render();
        overlay.querySelector(".ng-card").scrollTop = scroll;
      }));
    };

    const onKey = (e) => { if (e.key === "Escape") close(); };
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      this.uiPaused = false;
      this._rushLastTs = performance.now();
    };
    const start = () => {
      close();
      this.startNewGame(d);
    };
    document.addEventListener("keydown", onKey);
    render();
    document.body.appendChild(overlay);
    overlay.querySelector(".ng-start")?.focus({ preventScroll: true });
  }

  // ── AI Strategy Config UI ─────────────────────────────────────────────
  _buildStrategyUI() {
    const panel = this.aiStrategyPanel;
    if (!panel) return;

    panel.innerHTML = "";

    // Presets row
    const presetRow = document.createElement("div");
    presetRow.className = "ai-strat-presets";
    Object.entries(AI_PRESETS).forEach(([name, preset]) => {
      const btn = document.createElement("button");
      btn.className = "ai-strat-preset-btn btn-neutral";
      btn.textContent = AI_PRESET_INFO[name].label;
      btn.addEventListener("click", () => {
        this.players.forEach(p => {
          if (p.strategy) Object.assign(p.strategy, preset);
        });
        this._saveStrategies();
        this._buildStrategyUI();
      });
      presetRow.appendChild(btn);
    });
    panel.appendChild(presetRow);

    // Apply-all toggle
    const applyRow = document.createElement("label");
    applyRow.className = "ai-strat-apply-all";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = this._applyAllStrategies;
    cb.addEventListener("change", () => {
      this._applyAllStrategies = cb.checked;
      this._buildStrategyUI();
    });
    applyRow.appendChild(cb);
    applyRow.appendChild(document.createTextNode("Apply to all bots"));
    panel.appendChild(applyRow);

    // Per-bot config
    const aiPlayers = this.players.filter(p => p.strategy);
    const botsToShow = this._applyAllStrategies ? [aiPlayers[0]] : aiPlayers;

    botsToShow.forEach(bot => {
      const section = document.createElement("div");
      section.className = "ai-strat-player";

      if (!this._applyAllStrategies) {
        const header = document.createElement("div");
        header.className = "ai-strat-player-header";
        header.innerHTML = `${this._av(bot)}<span class="who pc-${bot.id}">${bot.name}</span>`;
        section.appendChild(header);
      }

      Object.entries(AI_STRATEGY_CATEGORIES).forEach(([key, cat]) => {
        const wrapper = document.createElement("div");
        wrapper.className = "ai-strat-row-wrapper";
        const row = document.createElement("div");
        row.className = "ai-strat-row";
        const label = document.createElement("label");
        label.textContent = cat.label;
        const sel = document.createElement("select");
        sel.className = "ai-strat-row-select";
        cat.levels.forEach(level => {
          const opt = document.createElement("option");
          opt.value = level;
          opt.textContent = level.charAt(0).toUpperCase() + level.slice(1);
          opt.title = cat.descriptions?.[level] || "";
          if (bot.strategy[key] === level) opt.selected = true;
          sel.appendChild(opt);
        });
        // Description hint
        const hint = document.createElement("div");
        hint.className = "ai-strat-hint";
        hint.textContent = cat.descriptions?.[bot.strategy[key]] || "";
        sel.addEventListener("change", () => {
          if (this._applyAllStrategies) {
            aiPlayers.forEach(p => { p.strategy[key] = sel.value; });
          } else {
            bot.strategy[key] = sel.value;
          }
          hint.textContent = cat.descriptions?.[sel.value] || "";
          this._saveStrategies();
        });
        row.appendChild(label);
        row.appendChild(sel);
        wrapper.appendChild(row);
        wrapper.appendChild(hint);
        section.appendChild(wrapper);
      });

      panel.appendChild(section);
    });
  }

  // ── Supply Overview ─────────────────────────────────────────────────
  renderSupplyOverview() {
    const el = this.supplyOverview;
    if (!el) return;
    const devRemaining = this.devDeck ? this.devDeck.length : 0;
    const key = `${RESOURCES.map((r) => this.bank[r]).join(",")}:${devRemaining}:${this.theme.id}`;
    if (key === this._lastSupplyKey) return;
    this._lastSupplyKey = key;
    el.innerHTML = `${icon("bank")}${RESOURCES.map((r) => `<span class="r" title="${RESOURCE_LABEL[r]} in the bank">${icon(r)}${this.bank[r]}</span>`).join("")}
      <span class="dv" title="Development cards left">${icon("devcard")}${devRemaining}</span>`;
  }

  // ── Build Cost Reference ──────────────────────────────────────────────
  _initCostReference() {
    const items = [
      { key: "road", label: "Road", icon: "road", cost: COSTS.road },
      { key: "settlement", label: "Settlement", icon: "settlement", cost: COSTS.settlement },
      { key: "city", label: "City", icon: "city", cost: COSTS.city },
      { key: "development", label: "Card", icon: "devcard", cost: COSTS.development },
    ];
    const icons = (cost) => RESOURCES.filter((r) => (cost[r] || 0) > 0)
      .flatMap((r) => Array(cost[r]).fill(`<svg class="ic" viewBox="-50 -50 100 100" data-r="${r}" aria-label="${RESOURCE_LABEL[r]}"><use href="#ic-${r}" x="-50" y="-50" width="100" height="100"/></svg>`)).join("");
    if (this.costRefItems) {
      this.costRefItems.innerHTML = items.map((it) => `<div class="cost" title="${it.label}: ${resourceString(it.cost)}">${icon(it.icon)}<span>${it.label}</span><span class="res">${icons(it.cost)}</span></div>`).join("");
    }
    items.forEach((it) => {
      const need = document.querySelector(`.bbtn .need[data-cost="${it.key}"]`);
      if (need) need.innerHTML = icons(it.cost);
    });
  }

  // ── Discard UI ──────────────────────────────────────────────────────
  _showDiscardUI(player, discardCount) {
    return new Promise((resolve) => {
      if (!this.discardPanel) { resolve(); return; }
      this.pendingDiscard = { player, count: discardCount, selected: makeEmptyResources(), resolve };
      this.toggleBuildSheet?.(false);
      this.hideDevCardPicker();
      this.discardInfo.textContent = `You hold ${sumResources(player.resources)} cards — choose ${discardCount} to hand back to the bank.`;
      this._renderDiscardCards();
      this.discardPanel.style.display = "";
    });
  }

  _renderDiscardCards() {
    if (!this.pendingDiscard) return;
    const { player, count, selected } = this.pendingDiscard;
    const totalSelected = sumResources(selected);
    this.discardCards.innerHTML = RESOURCES.map((r) => {
      const have = player.resources[r];
      const sel = selected[r];
      return `<div class="rcell${sel ? " pick" : ""}${have ? "" : " dim"}" data-res="${r}">
        <button type="button" class="card discard-card" data-add="${r}" aria-label="Hand back 1 ${RESOURCE_LABEL[r]}" ${have ? "" : "disabled"}>${cardSvg(r)}<span class="count">${have}</span></button>
        <span class="n">${sel ? `−${sel}` : "·"}</span>
        <div class="step"><button type="button" data-sub="${r}" aria-label="One less" ${sel ? "" : "disabled"}>−</button><button type="button" data-add="${r}" aria-label="One more" ${sel < have && totalSelected < count ? "" : "disabled"}>+</button></div></div>`;
    }).join("");
    const change = (r, d) => {
      const cur = sumResources(this.pendingDiscard.selected);
      if (d > 0 && (cur >= count || this.pendingDiscard.selected[r] >= player.resources[r])) return;
      this.pendingDiscard.selected[r] = clamp(this.pendingDiscard.selected[r] + d, 0, player.resources[r]);
      this.sfx.click();
      this._renderDiscardCards();
    };
    this.discardCards.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => change(b.dataset.add, 1)));
    this.discardCards.querySelectorAll("[data-sub]").forEach((b) => b.addEventListener("click", () => change(b.dataset.sub, -1)));
    this.discardSelected.textContent = `${totalSelected} of ${count} chosen`;
    const lbl = document.querySelector("#discardConfirmLabel");
    if (lbl) lbl.textContent = totalSelected === count ? `Hand back ${count} cards` : `Choose ${count - totalSelected} more`;
    this.discardConfirmBtn.disabled = totalSelected !== count;
  }

  _confirmDiscard() {
    if (!this.pendingDiscard) return;
    const { player, selected, resolve } = this.pendingDiscard;
    this.payToBank(player, selected);
    const total = sumResources(selected);
    this.addLog(`${player.name} discard${this._s(player)} ${total} cards.`);
    this.pendingDiscard = null;
    this.discardPanel.style.display = "none";
    this.render();
    resolve();
  }

  // ── Resource Gain Toasts for all players ─────────────────────────────
  showResourceGainToasts(gainByPlayer) {
    // Cards fly from the producing tiles to the hand (you) or to the player's portrait (bots)
    this.fx?.flyResources(gainByPlayer, this.lastRoll);
    if (gainByPlayer.some((g) => sumResources(g) > 0)) window.setTimeout(() => this.sfx.resourceGain(), 900);
    const human = this.players.find((p) => p.isHuman);
    const gain = human ? gainByPlayer[human.id] : null;
    if (!gain || !sumResources(gain) || !this.toastStack) return;
    const res = RESOURCES.filter((r) => gain[r] > 0);
    const terr = [...new Set(this.geometry.hexes.filter((h) => h.number === this.lastRoll && res.includes(h.resource)).map((h) => TERRAIN_NAME[h.resource]))];
    const toast = document.createElement("div");
    toast.className = "toast resource-gain-toast";
    toast.innerHTML = `<span class="card">${cardSvg(res[0])}</span><div>${res.map((r) => `<span class="plus">+${gain[r]}</span> ${RESOURCE_LABEL[r]}`).join(" · ")}<span class="sub">from the ${terr.join(" & ")} ${this.lastRoll}</span></div>`;
    this.toastStack.appendChild(toast);
    while (this.toastStack.children.length > this.maxToasts) this.toastStack.removeChild(this.toastStack.firstChild);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-4px)";
      setTimeout(() => toast.remove(), 180);
    }, 2800);
  }

  _animateCardDeal(player, gain, startDelay = 0) {
    const boardPanel = document.querySelector(".board-panel");
    if (!boardPanel) return;
    const boardRect = boardPanel.getBoundingClientRect();

    // Find player's avatar position in scoreboard as the target
    const avatarEl = this.scoreboard?.querySelector(`.player-card-mini:nth-child(${player.id + 1}) .player-avatar`);
    let targetX, targetY;
    if (avatarEl) {
      const avatarRect = avatarEl.getBoundingClientRect();
      targetX = avatarRect.left + avatarRect.width / 2 - boardRect.left;
      targetY = avatarRect.top + avatarRect.height / 2 - boardRect.top;
    } else {
      targetX = boardRect.width - 30;
      targetY = 30 + player.id * 40;
    }

    // Cards originate from the supply/bank area (bottom-right of board)
    const supplyEl = document.getElementById("supplyOverview");
    let bankX, bankY;
    if (supplyEl) {
      const sr = supplyEl.getBoundingClientRect();
      bankX = sr.left + sr.width / 2 - boardRect.left;
      bankY = sr.top + sr.height / 2 - boardRect.top;
    } else {
      bankX = boardRect.width - 60;
      bankY = boardRect.height - 20;
    }

    let cardIndex = 0;
    RESOURCES.forEach(r => {
      if (gain[r] <= 0) return;
      for (let i = 0; i < gain[r]; i++) {
        const screenX = bankX;
        const screenY = bankY;

        const flyDelay = startDelay + cardIndex * 80;
        cardIndex++;

        setTimeout(() => {
          const card = document.createElement("div");
          card.className = `flying-card ${r}`;
          card.innerHTML = `<img src="${RESOURCE_ICON_PATH[r]}" alt="${r}" />`;
          card.style.left = `${screenX}px`;
          card.style.top = `${screenY}px`;
          card.style.setProperty("--fly-x", `${targetX - screenX}px`);
          card.style.setProperty("--fly-y", `${targetY - screenY}px`);
          boardPanel.appendChild(card);
          setTimeout(() => card.remove(), 600);
        }, flyDelay);
      }
    });
  }

  // ── VP Breakdown Tooltip ────────────────────────────────────────────
  _showVPTooltip(player, anchorEl) {
    this._hideVPTooltip();
    const settlements = player.settlements.size;
    const cities = player.cities.size;
    const roads = player.roads.size;
    const devVP = player.isHuman ? player.devVictoryPoints : 0; // opponents' VP cards stay hidden
    const longestRoad = this.longestRoadHolder === player.id ? 2 : 0;
    const largestArmy = this.largestArmyHolder === player.id ? 2 : 0;
    const total = settlements + cities * 2 + devVP + longestRoad + largestArmy;
    const totalDevCards = DEV_CARD_TYPES.reduce((sum, t) => sum + player.devCards[t] + player.newDevCards[t], 0);

    const tip = document.createElement("div");
    tip.className = "vp-tooltip";
    tip.id = "vpTooltip";

    let html = '<div class="vp-tooltip-section">VP Breakdown</div>';
    const vpRows = [
      { label: `Settlements (${settlements}/5)`, value: settlements },
      { label: `Cities (${cities}/4)`, value: `${cities} x 2 = ${cities * 2}` },
    ];
    if (devVP > 0) vpRows.push({ label: "Dev VP", value: devVP });
    if (longestRoad) vpRows.push({ label: "Longest Road", value: 2 });
    if (largestArmy) vpRows.push({ label: "Largest Army", value: 2 });
    vpRows.push({ label: "Total", value: total, total: true });
    html += vpRows.map(r =>
      `<div class="vp-tooltip-row${r.total ? " vp-tooltip-total" : ""}"><span class="vp-tooltip-label">${r.label}</span><span class="vp-tooltip-value">${r.value}</span></div>`
    ).join("");

    // Building pieces remaining
    html += '<div class="vp-tooltip-section" style="margin-top:0.3rem">Pieces</div>';
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">Roads</span><span class="vp-tooltip-value">${roads}/15</span></div>`;
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">Settlements</span><span class="vp-tooltip-value">${settlements}/5</span></div>`;
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">Cities</span><span class="vp-tooltip-value">${cities}/4</span></div>`;

    // Dev card info
    html += '<div class="vp-tooltip-section" style="margin-top:0.3rem">Dev Cards</div>';
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">In hand</span><span class="vp-tooltip-value">${totalDevCards}</span></div>`;
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">Knights played</span><span class="vp-tooltip-value">${player.knightsPlayed}</span></div>`;
    html += `<div class="vp-tooltip-row"><span class="vp-tooltip-label">Road length</span><span class="vp-tooltip-value">${player.longestRoadLength}</span></div>`;

    tip.innerHTML = html;

    const rect = anchorEl.getBoundingClientRect();
    document.body.appendChild(tip);
    // Position below the anchor, clamped to viewport
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    // Keep within viewport
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
    if (left < 8) left = 8;
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 4;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  _hideVPTooltip() {
    const tip = document.getElementById("vpTooltip");
    if (tip) tip.remove();
  }

  // `limits` (optional): max picks per resource, e.g. the bank's stock for Year of Plenty
  _showResourcePicker(title, count, onConfirm, limits = null) {
    const existing = document.getElementById("resourcePickerOverlay");
    if (existing) existing.remove();
    const overlay = document.createElement("div");
    overlay.id = "resourcePickerOverlay";
    overlay.className = "resource-picker-overlay tm-modal";
    const picks = [];
    const renderPicker = () => {
      const n = (r) => picks.filter((p) => p === r).length;
      overlay.innerHTML = `
        <div class="resource-picker-panel" role="dialog" aria-label="${title}">
          <div class="resource-picker-title">${title}</div>
          <div class="resource-picker-selected">${picks.length} of ${count} chosen${picks.length ? `: ${picks.map((p) => RESOURCE_LABEL[p]).join(", ")}` : ""}</div>
          <div class="resource-picker-grid">
            ${RESOURCES.map((r) => `
              <button type="button" class="resource-picker-btn ${r}" data-res="${r}"${(limits && n(r) >= limits[r]) || picks.length >= count ? " disabled" : ""}>
                <span class="card">${cardSvg(r)}</span><span>${RESOURCE_LABEL[r]}</span><span class="pk">${n(r) ? `×${n(r)}` : ""}</span>
              </button>`).join("")}
          </div>
          <div class="resource-picker-actions">
            <button type="button" class="btn resource-picker-undo" ${picks.length ? "" : "disabled"}>Undo</button>
            <button type="button" class="btn primary resource-picker-confirm" ${picks.length === count ? "" : "disabled"}>${icon("check")}Confirm</button>
          </div>
        </div>`;
      overlay.querySelectorAll(".resource-picker-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (picks.length >= count || btn.disabled) return;
          picks.push(btn.dataset.res);
          this.sfx.click();
          renderPicker();
        });
      });
      overlay.querySelector(".resource-picker-undo").addEventListener("click", () => { picks.pop(); renderPicker(); });
      overlay.querySelector(".resource-picker-confirm").addEventListener("click", () => {
        if (picks.length !== count) return;
        overlay.remove();
        onConfirm(picks);
      });
    };
    renderPicker();
    document.body.appendChild(overlay);
  }

  // ══ Theme layer (src/themes/*, themes/*.css) ═════════════════════════
  // Themes change art, tokens and motion only; the DOM below is shared by every theme.

  _initTheme() {
    this.theme = THEMES[storedThemeId()];
    document.documentElement.dataset.theme = this.theme.id;
    applyMotionAttr();
    this.theme.setPalette?.(currentPalette());
    installSprite(this.theme);
    this.app = document.querySelector("#app");
    this.fx = new Fx(this);
    this.boardRenderer = this.theme.canvasArt ? new SvgBoardRenderer(this, this.theme) : null;
    this._fitScale = 1;
    const $ = (s) => document.querySelector(s);
    this.playerStrip = $("#playerStrip");
    this.tickerText = $("#tickerText");
    this.tickerIcon = $("#tickerIcon");
    this.turnBanner = $("#turnBanner");
    this.turnBannerTitle = $("#turnBannerTitle");
    this.cancelActionBtn = $("#cancelActionBtn");
    this.confirmPill = $("#confirmPill");
    this.waitingBar = $("#waitingBar");
    this.handSummary = $("#handSummary");
    this.handArea = $("#handArea");
    this.scrim = $("#scrim");
    this.mtop = $("#mtop");
    this.boardWrap = $("#boardWrap");
    this._updateLayoutMode();
    loadFonts(this.theme).then(() => {
      this.boardRenderer?.invalidateStatic();
      this._invalidateUI();
      if (this.players) this.render();
    });
  }

  _updateLayoutMode() {
    // Phones in any orientation (incl. landscape: short screens) use the touch layout
    this.isMobileLayout = window.matchMedia(MOBILE_MQ).matches;
    this.isLandscapePhone = window.matchMedia(LANDSCAPE_MQ).matches;
  }

  _bindThemeUI() {
    const $ = (s) => document.querySelector(s);
    this.settingsUI = new SettingsUI(this);
    $("#settingsBtn")?.addEventListener("click", () => this.settingsUI.open("look"));
    $("#mSettingsBtn")?.addEventListener("click", () => this.settingsUI.open("game"));
    renderQuickToggle($("#themeToggle"), this);
    $("#fitBoardBtn")?.addEventListener("click", () => this.resetViewTransform());
    $("#zoomInBtn")?.addEventListener("click", () => this.zoomBy(1.2));
    $("#zoomOutBtn")?.addEventListener("click", () => this.zoomBy(1 / 1.2));
    $("#tickerMore")?.addEventListener("click", () => this.toggleLog(true));
    $("#tickerText")?.addEventListener("click", () => this.toggleLog(true));
    $("#journalClose")?.addEventListener("click", () => this.toggleLog(false));
    $("#mBuildBtn")?.addEventListener("click", () => this.toggleBuildSheet());
    $("#buildSheetClose")?.addEventListener("click", () => this.toggleBuildSheet(false));
    $("#mCardsBtn")?.addEventListener("click", (e) => { e.stopPropagation(); this.toggleDevCardPicker(); });
    $("#devPickerClose")?.addEventListener("click", () => this.hideDevCardPicker());
    this.cancelActionBtn?.addEventListener("click", () => this.cancelPlacement());
    $("#confirmPillCancel")?.addEventListener("click", () => { this.confirmBuild = null; this.render(); });
    $("#confirmPillPlace")?.addEventListener("click", () => this._confirmViaIcon());
    // choosing something in the mobile build sheet closes it
    this.actionPromptBuild?.addEventListener("click", (e) => {
      if (e.target.closest(".bbtn") && this.isMobileLayout) window.setTimeout(() => this.toggleBuildSheet(false), 0);
    });
    this.scrim?.addEventListener("click", () => {
      this.toggleBuildSheet(false);
      this.hideDevCardPicker();
      if (this.railLog?.classList.contains("open")) this.toggleLog(false);
      if (this.tradeModal?.style.display !== "none" && !this.tradeLocked) this.closeTradeModal();
      this._syncScrim();
    });
    const cards = this.resourceCardStrip;
    cards?.addEventListener("scroll", () => this.handArea?.classList.toggle("scrolled", cards.scrollLeft > 8), { passive: true });
    // Keep the scrim in sync with whichever sheet code opens or closes
    const mo = new MutationObserver(() => this._syncScrim());
    [this.tradeModal, this.devCardPicker, this.victimPanel, this.discardPanel, this.incomingTradePanel, this.railLog, this.app].forEach((el) => {
      if (el) mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    });
    window.matchMedia(MOBILE_MQ).addEventListener?.("change", () => this.handleResize());
    window.matchMedia(LANDSCAPE_MQ).addEventListener?.("change", () => this.handleResize());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.boardRenderer?.requestDraw(); });
    // The board area changes size without a window resize (chrome bars laying out after load, the
    // hand fan, sheets): keep the canvas backing store in step with its box, or the board is drawn
    // squeezed and taps land in the wrong place.
    const box = this.canvas.parentElement;
    if (box && window.ResizeObserver) {
      let raf = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = box.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (Math.round(r.width) !== this.boardWidth || Math.round(r.height) !== this.boardHeight)) this.handleResize();
        });
      }).observe(box);
    }
    // Sunny Island colour palette (<html data-palette="light|vivid">): re-bake the board in place
    document.addEventListener("colonist:palette", () => this._applyPalette());
    new MutationObserver(() => this._applyPalette()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette"] });
  }

  _applyPalette() {
    const T = this.theme;
    if (!T?.setPalette || !T.setPalette(currentPalette())) return;
    installSprite(T);
    this._applyThemeToPlayers();
    this._invalidateUI();
    this.boardRenderer?.invalidateStatic();
    this.render();
  }

  _syncScrim() {
    if (!this.scrim) return;
    const shown = (el) => el && el.style.display !== "none" && !el.closest(".rush-seven");
    const mobile = this.isMobileLayout;
    const any = mobile
      ? this.app?.classList.contains("build-open") || this.railLog?.classList.contains("open") || [this.tradeModal, this.devCardPicker, this.victimPanel, this.discardPanel, this.incomingTradePanel].some(shown)
      : [this.victimPanel, this.discardPanel, this.incomingTradePanel].some(shown);
    this.scrim.hidden = !any;
  }

  toggleBuildSheet(force) {
    const open = force ?? !this.app.classList.contains("build-open");
    this.app.classList.toggle("build-open", open && this.isMobileLayout);
    if (open) { this.hideDevCardPicker(); this.hideTradePanel(); }
    this._syncScrim();
  }

  cancelPlacement() {
    if (this.confirmBuild) this.confirmBuild = null;
    if (this.pendingAction && this.pendingAction !== "robber") {
      this.pendingAction = null;
      this.canvas.style.cursor = "grab";
    }
    this.render();
  }

  /** The confirm pill / Place button: same path as tapping the ✓ on the board. */
  _confirmViaIcon() {
    const ic = this.getConfirmIconCenter();
    if (!ic) return;
    if (this.setupPhase) {
      this.handleSetupClick(ic.x, ic.y);
      this.render();
      return;
    }
    const s = this.worldToScreen(ic.x, ic.y);
    const rect = this.canvas.getBoundingClientRect();
    this.handleBoardClick({ clientX: rect.left + (s.x * rect.width) / this.boardWidth, clientY: rect.top + (s.y * rect.height) / this.boardHeight });
  }

  zoomBy(f) {
    const cx = this.boardWidth / 2, cy = this.boardHeight / 2;
    const w = this.screenToWorld(cx, cy);
    const scale = clamp(this.view.scale * f, this._minScale(), this._maxScale());
    this._animateView({ scale, offsetX: cx - w.x * scale, offsetY: cy - w.y * scale }, 220);
  }

  /** The fitted view (also records the fit scale = minimum zoom). */
  _fitTarget() {
    const { box, vp } = this._viewFrame();
    const scale = Math.min(vp.W / (box.maxX - box.minX), vp.H / (box.maxY - box.minY));
    this._fitScale = scale;
    return { scale, offsetX: vp.l + vp.W / 2 - ((box.minX + box.maxX) / 2) * scale, offsetY: vp.t + vp.H / 2 - ((box.minY + box.maxY) / 2) * scale };
  }

  /** Fit the island (with harbours) into the visible board area. */
  fitView() {
    if (!this.geometry) return;
    this._stopViewMotion();
    Object.assign(this.view, this._fitTarget());
    this._viewChanged();
  }

  requestBoardDraw() {
    if (this.boardRenderer) this.boardRenderer.requestDraw();
    else this.drawCanvasScene();
  }

  /** Switch theme instantly — no reload, game state untouched. */
  setTheme(id) {
    const T = THEMES[id];
    if (!T || T === this.theme) return;
    try {
      const snap = document.createElement("canvas");
      snap.width = this.canvas.width;
      snap.height = this.canvas.height;
      snap.getContext("2d").drawImage(this.canvas, 0, 0);
      snap.className = "theme-snapshot";
      snap.style.width = "100%";
      snap.style.height = "100%";
      this.canvas.parentElement.appendChild(snap);
      window.setTimeout(() => { snap.style.opacity = "0"; }, 60);
      window.setTimeout(() => snap.remove(), 520);
    } catch (_) { /* tainted or empty canvas: skip the cross-fade */ }
    const root = document.documentElement;
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 420);
    this.theme = T;
    saveThemeId(id);
    root.dataset.theme = id;
    T.setPalette?.(currentPalette());
    installSprite(T);
    if (T.canvasArt) {
      if (this.boardRenderer) this.boardRenderer.setTheme(T);
      else this.boardRenderer = new SvgBoardRenderer(this, T);
      this.boardRenderer.resync();
    } else {
      this.boardRenderer = null;
      this.lastAnimationTs = 0;
    }
    this._applyThemeToPlayers();
    this._initCostReference();
    renderQuickToggle(document.querySelector("#themeToggle"), this);
    this._invalidateUI();
    loadFonts(T).then(() => {
      this.boardRenderer?.invalidateStatic();
      this._invalidateUI();
      this.render();
    });
    this.fitCanvasToContainer();
    this.fitView();
    this.render();
  }

  _applyThemeToPlayers() {
    const T = this.theme;
    (this.players || []).forEach((p) => {
      p.color = T.textColors ? T.textColors[T.seatKeys[p.id]] : T.seatColors[p.id];
    });
    this._lastScoreKey = null;
  }

  _invalidateUI() {
    this._lastScoreKey = null;
    this._lastHandKey = null;
    this._lastOffersKey = null;
    this._lastVotersKey = null;
    this._lastNext7Key = null;
    this._lastLogKey = null;
    this._lastDiceKey = null;
    this._lastSupplyKey = null;
  }

  _av(player, cls = "") { return avatarSvg(player.id, cls); }

  /** Element to fly things to/from for a player (avatar in the strip or the rail). */
  playerAnchor(pid) {
    const sel = this.isMobileLayout ? `#playerStrip [data-seat="${pid}"] .avatar` : `#scoreboard [data-seat="${pid}"] .avatar`;
    return document.querySelector(sel);
  }

  /** Turn spotlight + badge transfers, detected from state changes between renders. */
  _themeEffects() {
    if (!this.players || !this.fx) return;
    const now = { gen: this.gameGen, cur: this.currentPlayerIndex, lr: this.longestRoadHolder, la: this.largestArmyHolder, setup: this.setupPhase };
    const p = this._fxPrev;
    this._fxPrev = now;
    if (!p || p.gen !== now.gen) return;
    if (!this.isRush() && !now.setup && !p.setup && p.cur !== now.cur && !this.winner) this.fx.spotlight(now.cur);
    if (now.lr !== p.lr && now.lr != null) this.fx.badge("longestRoad", p.lr, now.lr);
    if (now.la !== p.la && now.la != null) this.fx.badge("largestArmy", p.la, now.la);
  }

  _logIcon(text) {
    if (/\bwins?\b/.test(text)) return "vp";
    if (/rolled|^Roll #/.test(text)) return "dice";
    if (/robber|stole|discard/i.test(text)) return "robber";
    if (/Longest Road/.test(text)) return "longestRoad";
    if (/Largest Army/.test(text)) return "largestArmy";
    if (/Knight/.test(text)) return "knight";
    if (/Monopoly/.test(text)) return "monopoly";
    if (/Year of Plenty/.test(text)) return "yearOfPlenty";
    if (/Road Building/.test(text)) return "roadBuilding";
    if (/development|Victory Point card|You drew/.test(text)) return "devcard";
    if (/trade|traded|offers/i.test(text)) return "trade";
    if (/city/i.test(text)) return "city";
    if (/settlement/i.test(text)) return "settlement";
    if (/road/i.test(text)) return "road";
    const res = RESOURCES.find((r) => text.includes(RESOURCE_LABEL[r]));
    if (res) return res;
    return "log";
  }

  _confirmPillInfo() {
    const cb = this.confirmBuild;
    if (!cb) return null;
    const terr = (nodeId) => this.geometry.nodes[nodeId].adjacentHexes.map((hid) => this.geometry.hexes[hid])
      .filter((h) => h.resource !== "desert").map((h) => `${RESOURCE_LABEL[h.resource]} ${h.number}`).join(" · ");
    if (cb.type === "road") {
      const free = this.setupPhase || this.freeRoadsRemaining > 0;
      return { icon: "road", title: "Road here?", sub: free ? "Free road" : "Costs 1 Lumber + 1 Brick" };
    }
    if (cb.type === "city") return { icon: "city", title: "Upgrade to a city?", sub: `Produces double · ${terr(cb.id) || "no tiles"}` };
    return { icon: "settlement", title: "Settlement here?", sub: `Touches ${terr(cb.id) || "only the coast"}` };
  }

  drawCanvasScene() {
    if (!this.geometry) return;
    if (this.boardRenderer) {
      this.boardRenderer.requestDraw();
      return;
    }
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.clearRect(0, 0, this.boardWidth, this.boardHeight);
    this.drawBoardBackdrop();
    this.ctx.save();
    this.ctx.translate(this.view.offsetX, this.view.offsetY);
    this.ctx.scale(this.view.scale, this.view.scale);
    this.geometry.hexes.forEach((hex) => this.drawHex(hex));
    this.drawRobberModeOverlay();
    this.drawRollHighlight();
    this.drawNodeDots();
    this.drawPorts();
    this.drawRoads();
    this.drawStructures();
    this.drawBuildableHighlights();
    this.drawPlacementAnims();
    this.drawHoverEffects();
    this.ctx.restore();
    this.drawHoverTooltip();
  }

  render() {
    this.drawCanvasScene();
    this.renderTopPanels();
    this.renderResourceCards();
    this.renderScoreboard();
    this.renderLog();
    this.renderStatusAndControls();
    this.renderLastDice();
    this.renderSupplyOverview();
    this._renderRushHud();
    this._renderRushOffers();
    this._themeEffects();
    this._syncScrim();
    if (!document.body.dataset.gameReady) {
      document.body.dataset.gameReady = "true";
    }
  }
}

const game = new ColonistFullGame();
window.__colonistGame = game; // debug/testing handle
