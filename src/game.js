import { THEMES, storedThemeId, saveThemeId, loadFonts, installSprite, applyMotionAttr, icon, avatarSvg, dieSvg, cardSvg, motionReduced, SEAT_PRESETS, awardStat } from "./themes/manager.js";
import { SvgBoardRenderer, drawSpec } from "./themes/board-renderer.js";
import { Fx } from "./themes/fx.js";
import { SettingsUI, renderQuickToggle } from "./themes/settings-ui.js";
import { TERRAIN_NAME, DEV_NAME, CARD_TEXT, harbourBadges, harbourScale, harbourScaleWanted, pierDot, drawPierDot } from "./themes/art-util.js";
import { Onboarding, introSeen } from "./themes/onboarding.js";
import { Home, GameMenu } from "./themes/home.js";
import { SoundEngine } from "./sound.js";
import { isBigTable, bigAxialHexes, BIG_CENTER_SHIFT, BIG_BANK_SIZE, BIG_RUSH_INTERVAL, assignBigTiles, assignBigPorts, createBigDevDeck, SbpMixin } from "./six.js";
import { SixUiMixin } from "./six-ui.js";
import { HotseatMixin } from "./hotseat.js";
import { StatsMixin, installStats } from "./stats.js"; // end-of-game statistics: the recorder
import { StatsUiMixin } from "./stats-ui.js"; // … the stats screen, heatmaps and the replay
import { LiveStatsMixin, installLiveStats } from "./live-stats.js"; // … and the same cards during the game
import { AnalysisMixin, LabMixin } from "./ai-analysis.js";
// ⚓ Seafarers ("Heading for New Shores"): engine, bots, board and UI live in src/seafarers/*;
// this file only calls in through hooks marked with ⚓.
import { Seafarers, SeaGame, drawClassicSea, WIN_POINTS as SEA_WIN_POINTS, SHIP_COST } from "./seafarers/index.js";

const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
/** Sunny Island colour palette from <html data-palette> (default light; v0.85: + night). */
const currentPalette = () => { const p = document.documentElement.dataset.palette; return p === "vivid" || p === "night" ? p : "light"; };
const RESOURCE_SHORT = { wood: "Wd", brick: "Br", sheep: "Sh", wheat: "Wh", ore: "Or" };
// Glossary names (shared/glossary.md): cards are Lumber / Brick / Wool / Grain / Ore
const RESOURCE_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const RESOURCE_ICON_PATH = {
  wood: "./assets/icons/resource-wood-v3.svg",
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
  gold: "#e5bc52", // ⚓ Seafarers gold field
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
  ship: SHIP_COST, // ⚓ Seafarers
};

const BANK_SIZE = 19; // cards of each resource in the game
const PIECE_LIMITS = { road: 15, settlement: 5, city: 4, ship: 15 }; // ⚓ ship: Seafarers only

const PLAYER_CONFIG = [
  // Names: a homage to the Dutch Cluedo cast (portraits: src/themes/portraits.js). Seat 0 is "You";
  // its persona is Rosa Roodhart (fullName; "Roodhart" wherever the seat is named as a bot).
  // short: the label in the phone player strip, where the full surname would not fit at 360px.
  // v0.75 seat colours (colonist.io order): red · blue · orange · green · ivory · purple; the theme overrides these
  { name: "You", hsName: "Roodhart", fullName: "Rosa Roodhart", color: "#E0312B", isHuman: true, avatar: "./assets/avatars/avatar-human.svg?v=57" },
  { name: "Blaauw", fullName: "Mevrouw Blaauw van Draet", color: "#2F6FE6", isHuman: false, avatar: "./assets/avatars/avatar-pioneer.svg?v=57" },
  { name: "Van Geelen", short: "Geelen", fullName: "Kolonel Van Geelen", color: "#F7931E", isHuman: false, avatar: "./assets/avatars/avatar-sage.svg?v=57" },
  { name: "Groenewoud", short: "Groen", fullName: "Dominee Groenewoud", color: "#2E9E5E", isHuman: false, avatar: "./assets/avatars/avatar-vector.svg?v=57" },
  // seats 5 and 6 (5–6 player games); colours come from the theme (see src/themes/seats.js)
  { name: "De Wit", fullName: "Mevrouw De Wit", color: "#EDE6D3", isHuman: false, avatar: "" },
  { name: "Pimpel", fullName: "Professor Pimpel", color: "#72309F", isHuman: false, avatar: "" },
];

const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const SQRT3 = Math.sqrt(3);
const BOARD_RADIUS = 2;
// Layout breakpoints (keep in sync with themes/base.css): phones = narrow OR short (landscape)
const MOBILE_MQ = "(max-width: 900px), (max-height: 500px)";
const LANDSCAPE_MQ = "(max-height: 500px) and (orientation: landscape)";
const HARBOUR_FREE = 18; // v0.86: css px of open pier between a coast corner and its harbour pill (see _fitTarget)
const TURN_LIMIT = 500;

// ── AI Strategy Configuration ──────────────────────────────────────────
const AI_STRATEGY_CATEGORIES = {
  placement: {
    label: "Placement",
    levels: ["simple", "medium", "complex"],
    descriptions: {
      simple:  "Picks spots with highest dice probability only",
      medium:  "Weighs scarcity, diversity, ports, and spots rivals are heading for",
      complex: "Also targets missing resources, specific ports, avoids robber magnets",
    },
  },
  expansion: {
    label: "Expansion",
    levels: ["simple", "medium", "complex"],
    descriptions: {
      simple:  "Builds whatever it can afford in a fixed order; roads to the nearest spot",
      medium:  "Plans its next build (settlement, city or card) by points and production per expected turn, and saves cards for it",
      complex: "Same plan, plus races for Longest Road and values reachable ports",
    },
  },
  trading: {
    label: "Trading",
    levels: ["none", "conservative", "balanced", "aggressive"],
    descriptions: {
      none:         "Never trades",
      conservative: "Bank and port trades only, when they bring its next build at least a turn closer",
      balanced:     "Bank/port trades plus fair player deals that bring its plan closer; refuses lopsided offers and never helps a leader",
      aggressive:   "Offers deals to everyone each turn, pays 2-for-1 to finish a build now, accepts small but real gains",
    },
  },
  devCards: {
    label: "Dev Cards",
    levels: ["none", "reactive", "strategic"],
    descriptions: {
      none:      "Never buys or plays dev cards",
      reactive:  "Buys with spare cards, plays when obviously useful; Monopoly on what it needs",
      strategic: "Chases Largest Army, holds Monopoly for the biggest estimated haul of what it needs",
    },
  },
  awareness: {
    label: "Awareness",
    levels: ["none", "basic", "advanced"],
    descriptions: {
      none:     "Ignores who is winning; robber blocks the busiest opponent tile, steals at random",
      basic:    "Robs the richest opponent, won't trade with a leader",
      advanced: "Targets the VP leader, reads public card counts, shifts to points near the endgame",
    },
  },
};

const AI_PRESETS = {
  beginner:     { placement: "simple",  expansion: "simple",  trading: "conservative", devCards: "reactive",  awareness: "none" },
  intermediate: { placement: "medium",  expansion: "medium",  trading: "balanced",     devCards: "reactive",  awareness: "basic" },
  expert:       { placement: "complex", expansion: "complex", trading: "balanced",     devCards: "strategic", awareness: "advanced" },
  trader:       { placement: "medium",  expansion: "medium",  trading: "aggressive",   devCards: "reactive",  awareness: "basic" },
  builder:      { placement: "complex", expansion: "complex", trading: "balanced",     devCards: "reactive",  awareness: "basic" },
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
    simple:  "builds whatever it can afford, roads toward the nearest open spot.",
    medium:  "picks its next build (settlement, city or card) by what pays off soonest, and saves cards for it.",
    complex: "plans the same way, and also races for Longest Road and ports it can reach.",
  },
  trading: {
    none:         "never trades.",
    conservative: "trades only with the bank or its ports, when that gets its next build a turn sooner.",
    balanced:     "also makes fair deals with players that help its plan; never helps the leader.",
    aggressive:   "offers deals every turn and pays 2-for-1 to finish a build, but never takes a bad deal.",
  },
  devCards: {
    none:      "never buys development cards.",
    reactive:  "buys with spare cards, plays a card when the use is obvious.",
    strategic: "chases Largest Army and saves Monopoly for a big haul of what it needs.",
  },
  awareness: {
    none:     "ignores who is winning; robber just blocks the busiest tile.",
    basic:    "robs the richest opponent, won't trade with someone about to win.",
    advanced: "targets the leader, counts cards in the open and shifts gear near the end.",
  },
};
const AI_LEVEL_LABEL = { conservative: "Careful", aggressive: "Eager" };
const AI_DIMENSION_HINT = {
  placement: "where it settles", expansion: "how it grows", trading: "how deal-happy",
  devCards: "knights, monopoly…", awareness: "watches others",
};

const DEFAULT_AI_STRATEGY = { ...AI_PRESETS.intermediate };

// Planner weights (see _aiPlan), tuned with the bot tournament harness:
//   devCard        value of a development card in VP (reactive); devStrategic: extra for strategic
//   prodVPPerCard  VP worth of one card of future production
//   turnsLeft      turns the planner assumes are left (advanced awareness reads the race instead)
//   etaOffset      goals are ranked by value / (ETA + etaOffset)
//   sideBuildDelay a build off the plan is fine if it delays the planned one by at most this many turns
//   roadPenalty    spot-ranking penalty per road needed (medium / complex expansion)
const AI_PLAN_WEIGHTS = {
  devCard: 0.85, devStrategic: 0.25, prodVPPerCard: 0.12, turnsLeft: 10, etaOffset: 1, sideBuildDelay: 0.5,
  roadPenalty: { medium: 0.45, complex: 0.4 },
};

// v0.87 AI Lab "Calculation" weights: strategy.w = { num, variety, scarcity, port, margin, road, prod,
// patience, card, leader }, each a multiplier on the term named in AI_WEIGHT_INFO (missing = 1). Only the
// lab sets them (your bot, and the same bot in its tournament games); with none set every score is
// computed exactly as before (multiplying by 1 is exact in floating point).
const NO_W = Object.freeze({});
const AI_WEIGHT_KEYS = ["num", "variety", "scarcity", "port", "margin", "road", "prod", "patience", "card", "leader"];
const aiW = (player) => player?.strategy?.w || NO_W;
// Planner weights with the lab multipliers applied (the shared table itself when none are set)
function aiPlanWeights(w) {
  if (!w || w === NO_W || !AI_WEIGHT_KEYS.some((k) => w[k] != null && w[k] !== 1)) return AI_PLAN_WEIGHTS;
  const B = AI_PLAN_WEIGHTS, k = (x) => w[x] ?? 1;
  return { ...B, devCard: B.devCard * k("card"), devStrategic: B.devStrategic * k("card"), prodVPPerCard: B.prodVPPerCard * k("prod"),
    etaOffset: B.etaOffset * k("patience"), roadPenalty: { medium: B.roadPenalty.medium * k("road"), complex: B.roadPenalty.complex * k("road") } };
}

// ── Game settings (new-game screen) ──
const DEFAULT_SETTINGS = {
  mode: "classic",          // "classic" | "rush"
  winPoints: 10,            // 5-15
  discardLimit: 7,          // 7-12: holding more than this on a 7 discards half
  friendlyRobber: false,    // robber can't hit players with <= 2 public VP
  dice: "random",           // "random" | "balanced" | "deck"
  map: "random",            // "random" | "balanced" | "beginner"
  board: "island",          // ⚓ "island" (basic) | "seafarers" (Heading for New Shores)
  numBots: 3,               // 1-5 (4-5 bots: the 5–6 player island + Special Building Phase; Seafarers: 1-3)
  rushInterval: 15,         // seconds between automatic rolls (Rush)
  botStyleMode: "all",      // "all" | "each"
  allPreset: "intermediate",// preset applied to every bot ("custom" when hand-tuned)
  allStrategy: { ...AI_PRESETS.intermediate },
  perBot: ["builder", "trader", "shark", "builder", "trader"],
  humans: [false, false, false, false, false], // pass & play: seats 1-5 played by a person (Classic only)
  names: ["", "", "", "", "", ""],               // pass & play names per seat ("" = the seat's persona name)
};
const RUSH_INTERVALS = [10, 15, 20, 30];
const RUSH_DISCARD_SECONDS = 20;
const RUSH_ROBBER_SECONDS = 30;
const RUSH_OFFER_MS = 10000;    // a bot's offer to you stays up this long (Rush game clock)
const UNDO_MS = 4000; // a placement can be taken back for this long (Confirm placements off)
const ROBBER_SETTLE_MS = 2800; // one victim (or none): the robber move resolves by itself after this
const SHORT_DEV = { knight: "Knight", roadBuilding: "Roads", yearOfPlenty: "Plenty", monopoly: "Monopoly" };
// v0.84: one line per card for the bubble over a selected card in the hand
const DEV_EFFECT = { knight: "move the robber, steal 1 card", roadBuilding: "2 free roads", yearOfPlenty: "take any 2 cards from the bank",
  monopoly: "everyone hands you 1 kind of resource", victoryPoint: "+1 point, kept secret" };
const CLASSIC_OFFER_MS = 8000; // Classic: a bot's offer is declined automatically after this (v0.86: 15 → 8 s, the bot's turn waits for it)
const OFFER_QUEUE_MAX = 3;     // Rush: the open offer card + at most 2 waiting behind it

const FRIENDLY_ROBBER_VP = 2;

function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  s.mode = s.mode === "rush" ? "rush" : "classic";
  s.winPoints = clamp(Math.round(Number(s.winPoints)) || 10, 5, 15);
  s.discardLimit = clamp(Math.round(Number(s.discardLimit)) || 7, 7, 12);
  s.friendlyRobber = !!s.friendlyRobber;
  if (!["random", "balanced", "deck"].includes(s.dice)) s.dice = "random";
  if (!["random", "balanced", "beginner"].includes(s.map)) s.map = "random";
  s.board = s.board === "seafarers" ? "seafarers" : "island"; // ⚓
  // Seafarers (Heading for New Shores) is a 3-4 player scenario: at most 3 bots there
  s.numBots = clamp(Math.round(Number(s.numBots)) || 3, 1, s.board === "seafarers" ? 3 : PLAYER_CONFIG.length - 1);
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
  s.perBot = DEFAULT_SETTINGS.perBot.map((d, i) => (AI_PRESETS[per[i]] ? per[i] : d));
  // Pass & play: which other seats a person plays (never in Rush), and their names
  const hum = Array.isArray(s.humans) ? s.humans : [];
  s.humans = DEFAULT_SETTINGS.humans.map((_, i) => s.mode !== "rush" && !!hum[i]);
  const nm = Array.isArray(s.names) ? s.names : [];
  s.names = DEFAULT_SETTINGS.names.map((_, i) => String(nm[i] ?? "").replace(/\s+/g, " ").trim().slice(0, 14));
  return s;
}

/** Pass & play: more than one person at the table with these settings. */
function hotseatOn(s) {
  return !!s && s.mode !== "rush" && (s.humans || []).slice(0, s.numBots).some(Boolean);
}

/** Who sits in a seat: a person or a bot, and the name shown (pass & play: the chosen name, else the persona). */
function seatSpec(s, id) {
  const cfg = PLAYER_CONFIG[id];
  const isHuman = id === 0 || (s?.mode !== "rush" && !!s?.humans?.[id - 1]);
  if (!isHuman || !hotseatOn(s)) return { isHuman, name: cfg.name, short: cfg.short };
  const name = (s.names?.[id] || "").trim() || cfg.hsName || cfg.name;
  return { isHuman, name, short: name === cfg.name ? cfg.short : name.length > 9 ? `${name.slice(0, 8)}…` : undefined };
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

function makeFullBank(size = BANK_SIZE) {
  return Object.fromEntries(RESOURCES.map((r) => [r, size]));
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

// ⚓ layout: Seafarers hex list; big: the 30-hex 5–6 player island (src/six.js) instead of the 19-hex one
function createBoardGeometry(canvasWidth, canvasHeight, layout = null, big = false) {
  const aspect = canvasWidth / canvasHeight;
  // On tall screens (mobile portrait), allow larger hexes by loosening the width constraint
  const wDiv = aspect < 1 ? 11 : 14.5;
  const hDiv = aspect < 1 ? 7.6 : 8.2;
  // the big island has 7 rows instead of 5: smaller hexes keep it about the same size in world units
  const hexSize = Math.min(canvasWidth / wDiv, canvasHeight / hDiv) * (big ? 5 / 7 : 1);
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

  const originX = big && !layout ? centerX + hexSize * SQRT3 * BIG_CENTER_SHIFT : centerX;
  for (const axial of layout || (big ? bigAxialHexes() : createAxialHexes(BOARD_RADIUS))) {
    const center = axialToPixel(axial.q, axial.r, hexSize, originX, centerY);
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
      ...(axial.kind ? { kind: axial.kind, key: axial.key, island: { L: 0, W: 1, S: 2, E: 3 }[axial.kind] ?? null } : {}), // ⚓
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

// ⚓ Seafarers: for planning, a gold field counts as the resource the player is shortest of
function prodRes(hex, inc) {
  if (hex.resource !== "gold") return hex.resource;
  let best = "wheat";
  RESOURCES.forEach((r) => { if ((inc[r] || 0) < (inc[best] || 0)) best = r; });
  return best;
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
    this._buildTradeSheet();
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
    // Analysis mode (Settings › Game): the bots' candidate scores on the board + Pause / Step (src/ai-analysis.js)
    this._initAnalysis();

    // Sound engine
    this.soundToggle = document.querySelector("#soundToggle");
    this.soundEnabled = true;
    try { this.soundEnabled = localStorage.getItem("colonist_sound") !== "off"; } catch (_) {}
    this.sound = new SoundEngine({ enabled: () => this.soundEnabled });
    this.volumeRange = document.querySelector("#volumeRange");
    this.volumeValue = document.querySelector("#volumeValue");
    const syncVolumeUi = () => {
      if (!this.volumeRange) return;
      this.volumeRange.disabled = !this.soundEnabled;
      this.volumeRange.closest(".st-volume")?.classList.toggle("off", !this.soundEnabled);
      if (this.volumeValue) this.volumeValue.textContent = `${Math.round(this.sound.volume * 100)}%`;
    };
    if (this.soundToggle) {
      this.soundToggle.checked = this.soundEnabled;
      this.soundToggle.addEventListener("change", () => {
        this.soundEnabled = this.soundToggle.checked;
        try { localStorage.setItem("colonist_sound", this.soundEnabled ? "on" : "off"); } catch (_) {}
        syncVolumeUi();
        if (this.soundEnabled) this.sfx.click();
      });
    }
    if (this.volumeRange) {
      this.volumeRange.value = String(Math.round(this.sound.volume * 100));
      this.volumeRange.addEventListener("input", () => { this.sound.setVolume(Number(this.volumeRange.value) / 100); syncVolumeUi(); });
      // a short preview when the thumb is released
      this.volumeRange.addEventListener("change", () => this.sfx.buildSettlement());
    }
    syncVolumeUi();
    this._rushTickSec = null;

    // Settings › Game: "Confirm placements". Off (default): a tap on a legal spot places at once
    // and a short Undo appears. On: a tap only selects, Place / ✓ confirms (the v0.68 flow).
    this.confirmPlacements = false;
    try { this.confirmPlacements = localStorage.getItem("colonist.confirmPlacements") === "on"; } catch (_) {}
    this.confirmToggle = document.querySelector("#confirmPlacementsToggle");
    if (this.confirmToggle) {
      this.confirmToggle.checked = this.confirmPlacements;
      this.confirmToggle.addEventListener("change", () => {
        this.confirmPlacements = this.confirmToggle.checked;
        try { localStorage.setItem("colonist.confirmPlacements", this.confirmPlacements ? "on" : "off"); } catch (_) {}
        this._dropUndo();
        this._cancelRobberTimer();
        this.render();
      });
    }
    this.undoState = null; // the last placement that can still be taken back (see undoLast)
    this.trayMode = null;  // phones: "build" | "cards" while that tray replaces the dock buttons
    this.devPick = null;   // Year of Plenty / Monopoly picks in the dock: { type, count, picks, limits }

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
    this.onboarding = new Onboarding(this, { costs: COSTS, labels: RESOURCE_LABEL });
    this.home = new Home(this, {
      saved: () => this._savedSummary(),
      last: () => normalizeSettings(ColonistFullGame.loadLastSettings()),
      introSeen,
      onContinue: () => this.continueSavedGame(),
      onStart: (pick) => this._quickStart(pick),
      onMore: () => this._showDifficultyModal(),
      onIntro: () => this.onboarding.showIntro(0, true),
      onSettings: () => this.settingsUI.open("game"),
    });
    this.menu = new GameMenu(this, {
      onHome: () => this.goHome(),
      onNewGame: () => this._showDifficultyModal(),
      onSettings: () => this.settingsUI.open("game"),
      onIntro: () => this.onboarding.showIntro(0, false),
      onAbout: () => this.settingsUI.open("about"),
      onStats: () => this.liveStatsOpen(),
    });
    // Every launch opens on the home screen. A saved game is restored behind it but held (no bots,
    // no Rush clock, nothing saved) until Continue; without one a fresh board waits behind it.
    this.onboardingHold = true;
    this._homeSave = this._hasResumableSave() && this.loadFromStorage();
    if (!this._homeSave) this.resetGame();
    this._buildStrategyUI();
    this.startAnimationLoop();
    this.home.show();
  }

  /** Leave the home hold (a game is started, or bots take over). */
  _releaseOnboarding(resume = true) {
    if (!this.onboardingHold) return;
    if (resume && this._homeSave) { this.continueSavedGame(); return; } // e.g. "Watch bots play" from home: the held save goes live
    this.onboardingHold = false;
    this._homeSave = false;
    this.uiPaused = false;
    this.home?.close();
    this.onboarding?.close();
    if (resume && this.setupPhase && !this.setupAction) this.processSetupQueue();
  }

  /** A stored, unfinished game that Continue can resume. */
  _hasResumableSave() {
    try {
      const raw = localStorage.getItem(ColonistFullGame.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && data.winnerId == null;
    } catch (_) { return false; }
  }

  /** What the home screen shows on its Continue button (null: nothing to continue). */
  _savedSummary() {
    if (!this._homeSave || this.winner || !this.players?.length) return null;
    return {
      mode: (this.isRush() || this.settings?.mode === "rush" ? "Rush" : "Classic") + (this.sea ? " · Seafarers" : ""), // ⚓
      turn: this.turn || 1,
      players: this.players.map((p) => ({ name: p.name, seat: p.id, vp: p.isHuman && !this.hotseat ? p.victoryPoints : (p.publicVictoryPoints ?? p.victoryPoints) })),
    };
  }

  /** Home › Continue: the held save is loaded again, now live (bots, Rush clock, saving resume). */
  continueSavedGame() {
    this.onboardingHold = false;
    this._homeSave = false;
    this.uiPaused = false;
    this.home.close();
    this.onboarding?.close();
    if (!this.loadFromStorage()) this.resetGame();
    this._buildStrategyUI();
  }

  /** Home › Classic / Rush tile: start at once with the chosen opponents and bot level. */
  _quickStart({ mode, numBots, preset, board }) {
    const last = normalizeSettings(ColonistFullGame.loadLastSettings());
    const sea = (board || last.board) === "seafarers"; // ⚓ Seafarers: at most 3 bots
    const s = { ...last, mode: mode === "rush" ? "rush" : "classic", numBots: clamp(Number(numBots) || 3, 1, sea ? 3 : PLAYER_CONFIG.length - 1) };
    if (board) s.board = board === "seafarers" ? "seafarers" : "island"; // ⚓ Home › Map
    s.humans = DEFAULT_SETTINGS.humans.slice(); // Home's quick start is you vs bots (pass & play: More settings › Players)
    // Rush with 5–6 players: a roll every 20 s unless a slower pace was picked
    if (s.mode === "rush" && isBigTable(s.numBots + 1) && s.rushInterval < BIG_RUSH_INTERVAL) s.rushInterval = BIG_RUSH_INTERVAL;
    if (preset && preset !== "custom" && AI_PRESETS[preset]) {
      s.botStyleMode = "all";
      s.allPreset = preset;
      s.allStrategy = { ...AI_PRESETS[preset] };
    }
    this.startNewGame(s);
  }

  /** Menu › Home: save and pause the game, then show the home screen (Continue picks it up again). */
  goHome() {
    this.menu?.close();
    this.settingsUI?.close();
    document.querySelector(".newgame-modal")?.remove();
    try { this.closeTradeModal?.(); this.hideDevCardPicker?.(); this.toggleLog?.(false); this._syncScrim?.(); } catch (_) { /* nothing open */ }
    if (!this.onboardingHold && !this.winner) this.saveToStorage();
    this._homeSave = !this.winner && this._hasResumableSave();
    this._cancelPendingWork();
    this.onboardingHold = true;
    this.uiPaused = true;
    this.home.show();
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
    const oldEdges = this.geometry.edges.map(e => ({ owner: e.owner, ship: e.ship }));
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight, this._seaLayout(), this.bigBoard); // ⚓
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
      if (oldEdges[i].ship) edge.ship = true; // ⚓
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
    // Remember zoom + the board point in the middle of the view (in hex units: geometry is rebuilt),
    // but only when the player zoomed in themselves: a fit computed while the chrome was still
    // laying out (hand fan, browser bars) must never turn into a "zoom" on the next resize.
    let keep = null;
    if (this.geometry && this._userZoomed && this._fitScale && this.view.scale > this._fitScale * 1.01) {
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
      this._userZoomed = true;
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
    // The dock's primary button (Roll dice / End turn / Ready) sits right under the trade sheet's
    // Offer / Bank buttons and near the offer card's ✓ / ✗. When a tap there closes the sheet, the
    // next tap (a double tap, an impatient second tap, a ghost click) must not roll / end the turn.
    this.rollDiceBtn.addEventListener("click", (e) => {
      if (this._primaryTapGuarded(e)) return;
      this.handleHumanRoll();
    });
    this.endTurnBtn.addEventListener("click", (e) => {
      if (this._primaryTapGuarded(e)) return;
      this.handleHumanEndTurn();
    });
    this.buildRoadBtn.addEventListener("click", () => this.setPendingAction("road"));
    this.buildSettlementBtn.addEventListener("click", () => this.setPendingAction("settlement"));
    this.buildCityBtn.addEventListener("click", () => this.setPendingAction("city"));
    this.buildShipBtn = document.querySelector("#buildShipBtn"); // ⚓ Seafarers (hidden on the basic island)
    this.buildShipBtn?.addEventListener("click", () => this.setPendingAction("ship"));
    this.buyDevBtn.addEventListener("click", () => { this._buyFrom = this.buyDevBtn; this.handleHumanBuyDevCard(); });
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
    this.tradeProposalBtn?.addEventListener("click", () => this._onTradeProposalBtn());
    this.acceptTradeBtn?.addEventListener("click", () => { this._guardPrimaryTap(650, this.incomingTradePanel); this.resolveIncomingTrade(true); });
    this.rejectTradeBtn?.addEventListener("click", () => { this._guardPrimaryTap(650, this.incomingTradePanel); this.resolveIncomingTrade(false); });
    this.discardConfirmBtn?.addEventListener("click", () => this._confirmDiscard());
    this.rushReadyBtn?.addEventListener("click", (e) => { if (!this._primaryTapGuarded(e)) this.toggleRushReady(); });
    document.addEventListener("click", (e) => {
      if (this.devCardPicker && this.devCardPicker.style.display !== "none" &&
          !this.devCardPicker.contains(e.target) && e.target !== this.playDevBtn) {
        this.hideDevCardPicker();
      }
    });
    // Bot speed: 0 (slow) … 100 (fast), right = faster; remembered between visits
    try {
      const saved = localStorage.getItem("colonist.botSpeed");
      if (saved != null && Number.isFinite(Number(saved))) this.speedRange.value = String(Number(saved));
    } catch (_) {}
    this._syncSpeedLabel();
    this.speedRange.addEventListener("change", () => {
      try { localStorage.setItem("colonist.botSpeed", this.speedRange.value); } catch (_) {}
    });
    this.speedRange.addEventListener("input", () => {
      this._syncSpeedLabel();
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

  /** Building is allowed: your main phase, or your Special Building Phase window (5–6 players). */
  _buildPhase() {
    return this.phase === "main" || this.phase === "sbp";
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
    if (this.analysis) { this.analysis.parked = null; this.analysis.last = null; this.analysis.budget = 0; }
    this.robberBusy = false;
    this.pendingRobberFlow = null;
    this.diceResult = null;
    this.pendingDiscard = null;
    if (this.discardPanel) this.discardPanel.style.display = "none";
    this.pendingIncomingTrade = null;
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    document.querySelectorAll(".dice-overlay, #resourcePickerOverlay").forEach((el) => el.remove());
    this._dropUndo?.();
    this._cancelRobberTimer?.();
    this.devPick = null;
    this.devPlayed = null;
    this.trayMode = null;
    this._botTicks = new Map();
    if (this.rush) this.rush.offers = [];
    this._lastOffersKey = null;
    this._lastVotersKey = null;
    this._lastNext7Key = null;
    if (this.rushOffersEl) this.rushOffersEl.innerHTML = "";
  }

  // ── Bank & piece supply ──
  payToBank(player, cost) {
    this._aiTrkNote(player, cost, -1); // public: builds, bank trades and discards are visible
    payCost(player.resources, cost);
    RESOURCES.forEach((r) => { this.bank[r] += cost[r] || 0; });
  }

  takeFromBank(player, resource, amount = 1) {
    const n = Math.min(amount, this.bank[resource]);
    this._aiTrkNote(player, { [resource]: n }, 1);
    this.bank[resource] -= n;
    player.resources[resource] += n;
    return n;
  }

  piecesLeft(player, type) {
    if (type === "ship") return this.sea ? this.sea.shipsLeft(player) : 0; // ⚓
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
    this._userZoomed = false;
    this._animateView(this._fitTarget(), 300);
  }

  resetGame() {
    this._cancelPendingWork();
    this.removeGameOverOverlay();
    this.clearStorage();
    this._seaNew(); // ⚓ game.sea (null unless the board is Seafarers)
    // 5–6 players: the 30-hex island, 24 cards of each resource, 34 development cards (src/six.js)
    this.bigBoard = !this.sea && isBigTable(this.settings.numBots + 1);
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight, this._seaLayout(), this.bigBoard);
    this.robberHexId = this.sea ? this._seaAssignBoard(this.settings.map, createBoardGeometry, assignTiles)
      : this.bigBoard ? assignBigTiles(this.geometry, this.settings.map) : assignTiles(this.geometry, this.settings.map);
    this.ports = this.sea ? this._seaPorts() : this.bigBoard ? assignBigPorts(this.geometry) : assignPorts(this.geometry);
    this.devDeck = this.bigBoard ? createBigDevDeck() : createDevelopmentDeck();
    this.bankSize = this.bigBoard ? BIG_BANK_SIZE : BANK_SIZE;
    this.bank = makeFullBank(this.bankSize);
    this.diceDeck = [];
    this.lastDiceTotal = null;
    this.rush = null;
    this.sbp = null;
    this.sbpRecent = null;

    const strategies = this._strategiesFromSettings();
    this.viewerId = 0; // pass & play: the human holding the phone
    this._hsLastAck = null; // v0.86: nobody has tapped "I'm …" in this game yet
    this.handHidden = false;
    this._hsNote = null;
    this._hsSecrets = null;
    this.players = PLAYER_CONFIG.slice(0, this.settings.numBots + 1).map((config, id) => {
      const seat = seatSpec(this.settings, id);
      return {
      id,
      name: seat.name,
      fullName: config.fullName,
      short: seat.short,
      color: config.color,
      isHuman: seat.isHuman,
      avatar: config.avatar,
      personality: seat.isHuman ? null : strategies[id].personality,
      resources: makeEmptyResources(),
      roads: new Set(),
      ships: new Set(), // ⚓ Seafarers
      settlements: new Set(),
      cities: new Set(),
      devCards: makeEmptyDevCards(),
      newDevCards: makeEmptyDevCards(),
      devVictoryPoints: 0,
      knightsPlayed: 0,
      longestRoadLength: 0,
      victoryPoints: 0,
      publicVictoryPoints: 0,
      strategy: seat.isHuman ? null : { ...strategies[id].strategy },
      rushDevPlayed: false,   // Rush: a dev card was played this roll interval
      rushTradeTried: false,  // Rush (bots): already tried a player trade this roll interval
    }; });
    this.handHidden = this.hotseat; // pass & play: the first placement starts behind the cover

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

    this._stReset(); // the end-of-game statistics log (src/stats.js)
    this.initialPlacement();
    this.recomputeScores();
    this.addLog(this.sea ? `New ${this.isRush() ? "Rush" : "Classic"} Seafarers game: Heading for New Shores, first to ${this.winPoints} points.`
      : `New ${this.isRush() ? "Rush" : "Classic"} game: first to ${this.settings.winPoints} points.`);
    this.render();
  }

  isRush() {
    return this.settings?.mode === "rush";
  }

  get winPoints() {
    return this.sea ? SEA_WIN_POINTS : this.settings.winPoints; // ⚓ Seafarers: 14
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
    this._releaseOnboarding(false);
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
      this.sea?.onNewTurn(); // ⚓ set-up ships may move from the first turn on
      this.addLog("Initial placement complete.");
      this.recomputeScores(); // v0.81: the chips show both set-up settlements at once
      this._tickerPromptKey = null; this._tickerPrompt = ""; this._lastLogKey = null; // and the ticker drops "Now place a road…"
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
    if (this.onboardingHold) { this.render(); return; } // first launch: wait for the welcome sheet
    if (this._aiHeld()) { this._aiPark(() => this.processSetupQueue()); this.render(); return; } // analysis mode: wait for Step

    // AI placement with delay
    const nodeId = this.getBestInitialSettlementNode(player);
    if (nodeId == null) { this.setupStep++; this.processSetupQueue(); return; }
    if (this._aiRec()) this._aiNoteSetup(player, nodeId);
    this.placeSettlement(player, nodeId, true);
    this.addLog(`${player.name} placed a settlement.`);
    this.sfx.buildSettlement();
    this.recomputeScores();
    this.render();

    this._later(() => this._aiGate(() => {
      let piece = "road";
      if (this.sea) { // ⚓ Seafarers: a road, or a ship from a coastal settlement
        const pc = this.sea.aiSetupPiece(player, nodeId);
        if (pc?.type === "ship") { this.sea.placeShip(player, pc.id, { free: true, setupNode: nodeId }); piece = "ship"; }
        else if (pc) this.placeRoad(player, pc.id, { free: true, setupNode: nodeId });
      } else {
        const cands = this._aiRec() ? [] : null;
        const roadId = this.getBestRoadFromNode(player, nodeId, cands);
        if (cands) this._aiNoteSetupRoad(player, nodeId, roadId, cands);
        if (roadId != null) this.placeRoad(player, roadId, { free: true, setupNode: nodeId });
      }
      if (this.setupStep >= this.players.length) {
        this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
          const hex = this.geometry.hexes[hexId];
          if (RESOURCES.includes(hex.resource)) this.takeFromBank(player, hex.resource, 1);
        });
      }
      this.addLog(`${player.name} placed a ${piece}.`);
      this.sfx.buildRoad();
      this.recomputeScores();
      this.render();
      this.setupStep++;
      this._later(() => this.processSetupQueue(), 350);
    }), 400);
  }

  handleSetupClick(x, y) {
    const player = this.players[this.setupQueue[this.setupStep]];
    if (!player.isHuman) return;

    // Confirm placements on: the ✓ / Place commits the selected spot
    if (this.confirmBuild && this.hitTestConfirmIcon(x, y)) {
      const cb = this.confirmBuild;
      if (cb.type === this.setupAction) { this._commitSetup(player, cb); return; }
    }

    let target = null;
    if (this.setupAction === "settlement") {
      const nodeId = this.findNodeAt(x, y, (id) => this.canBuildSettlement(player, id, true));
      if (nodeId != null) target = { type: "settlement", id: nodeId };
    } else if (this.setupAction === "road" && this.sea) {
      target = this._seaSetupEdgeAt(player, x, y); // ⚓ road or ship
    } else if (this.setupAction === "road") {
      const edgeId = this.findEdgeAt(x, y, (id) => { const e = this.geometry.edges[id]; return e.owner == null && e.nodes.includes(this.lastSetupNodeId); });
      if (edgeId != null) target = { type: "road", id: edgeId };
    }
    if (!target) { this.confirmBuild = null; this.drawCanvasScene(); return; }
    // Default: a tap on a legal spot places it (the settlement can be taken back until the road is down)
    if (!this.confirmPlacements) { this._commitSetup(player, target); return; }
    this.confirmBuild = target;
    this.drawCanvasScene();
  }

  /** Place a setup settlement or road. */
  _commitSetup(player, cb) {
    this.confirmBuild = null;
    if (cb.type === "settlement" && this.setupAction === "settlement") {
      if (!this.placeSettlement(player, cb.id, true)) return;
      this.sfx.buildSettlement();
      this.lastSetupNodeId = cb.id;
      this.setupAction = "road";
      if (this.sea) this.sea.setupPiece = "road"; // ⚓
      const logLen = this.logEntries.length;
      this.addLog("Now place a road from your settlement.");
      // Undo stays offered until the road is placed (no time limit)
      this._setUndo({ kind: "setup", id: cb.id, pid: player.id, icon: "settlement", label: "Settlement placed", noun: "", logLen }, 0);
      this.render();
      return;
    }
    if ((cb.type === "road" || cb.type === "ship") && this.setupAction === "road") {
      const placed = cb.type === "ship" ? this.sea?.placeShip(player, cb.id, { free: true, setupNode: this.lastSetupNodeId }) // ⚓
        : this.placeRoad(player, cb.id, { free: true, setupNode: this.lastSetupNodeId });
      if (!placed) return;
      this._dropUndo();
      this.sfx.buildRoad();
      if (this.setupStep >= this.players.length) {
        this.geometry.nodes[this.lastSetupNodeId].adjacentHexes.forEach((hexId) => {
          const hex = this.geometry.hexes[hexId];
          if (RESOURCES.includes(hex.resource)) this.takeFromBank(player, hex.resource, 1);
        });
      }
      this.setupStep++;
      this.setupAction = null;
      this.lastSetupNodeId = null;
      this.saveToStorage();
      this.processSetupQueue();
      this.render();
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
    if (this._sbpQuiet) return false; // bots building between turns: one summary line instead
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
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway())) return; // pass & play: not this holder's move
    if (this.isRush()) { this.toggleRushReady(); return; }
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "pre_roll" || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return;
    this._dropUndo();
    this.devPlayed = null;
    this.trayMode = null;
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
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway())) return; // pass & play: not this holder's move
    if (this.isRush()) return; // no turns in Rush
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "main" || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return;
    if (this.devPick) return; // finish Year of Plenty / Monopoly first
    this._dropUndo();
    this.trayMode = null;
    this.hideTradePanel();
    this.endTurn();
    this.saveToStorage();
    this.scheduleAiTurnsUntilHuman();
  }

  setPendingAction(action, { keepTray = false } = {}) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || !this._buildPhase()) return;
    if ((this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return; // Cannot override robber placement / discard
    if (["road", "settlement", "city", "ship"].includes(action) && this.piecesLeft(player, action) <= 0) return;
    if (action === "ship" && (!this.sea || (!this.freeRoadsRemaining && !hasResources(player.resources, COSTS.ship)))) return; // ⚓
    if (action === "road" && !this.freeRoadsRemaining && !hasResources(player.resources, COSTS.road)) return;
    if (action === "settlement" && !hasResources(player.resources, COSTS.settlement)) return;
    if (action === "city" && !hasResources(player.resources, COSTS.city)) return;
    if (this.freeRoadsRemaining > 0 && action !== "road" && action !== "ship") return; // Road Building: place the free roads (or ships) first
    this._dropUndo();
    if (this.sea) this.sea.moveSel = null; // ⚓
    this.pendingAction = this.pendingAction === action ? null : action;
    this.confirmBuild = null;
    this._autoPick = false;
    if (!keepTray && this.trayMode === "cards") this.trayMode = null;
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.hideTradePanel();
    this.sfx.click();
    this.render();
  }

  handleHumanBuyDevCard() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || !this._buildPhase() || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return;
    if (!hasResources(player.resources, COSTS.development) || !this.devDeck.length) {
      this._flashPrompt(this.devDeck.length ? `A card costs ${resourceString(COSTS.development)} · you need ${missingCostString(player.resources, COSTS.development)}` : "The development deck is empty");
      return;
    }
    this._dropUndo();
    // one tap: no confirm (with "Confirm placements" on this is still one tap — buying is explicit)
    this.buyDevelopmentCard(player);
    // leave a build mode the purchase made unaffordable
    if (this.pendingAction && this.pendingAction !== "robber" && !this.freeRoadsRemaining && !this._canPlaceAnything(player)) { this.pendingAction = null; this.confirmBuild = null; }
    if (this.trayMode === "build" && !["road", "settlement", "city", "development"].some((t) => hasResources(player.resources, COSTS[t]))) this.trayMode = null;
    if (this.sbp) this._sbpAfterHumanBuild();
    this.recomputeScores();
    if (this.rush) this._rushAfterAction(player);
    else { this.checkForWinner(player); this.saveToStorage(); this.render(); }
  }

  // Verb suffix for log grammar: "You discard" vs "Sage AI discards"
  _s(player) {
    return this._you(player) ? "" : "s";
  }

  _hexLabel(hex) {
    if (hex.resource === "sea") return "the sea"; // ⚓
    if (hex.resource === "desert" || !hex.number) return "the Desert";
    return `${TERRAIN_NAME[hex.resource]} ${hex.number}`;
  }

  _robberInProgress() {
    return this.robberBusy || this.pendingAction === "robber" || !!this.pendingDiscard || this.robberVictimOptions?.length > 0;
  }

  handleHumanPlayDevCard(type) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (!this.canPlayDevelopmentCard(player, type) || this._seaHumanBlocked()) return; // checks phase (Knight may be played before rolling)
    if (this.devPick) return;
    this.hideDevCardPicker();
    this._dropUndo();
    this.trayMode = null;
    this._trayFocus = null;
    if (this.pendingAction && this.pendingAction !== "robber") { this.pendingAction = null; this.confirmBuild = null; }
    // a card played by mistake can be taken back until it does something (see _cancelDevPlay)
    const logLen = this.logEntries.length;
    const d = { type, pid: player.id, la: this.largestArmyHolder };
    const played = this.playDevelopmentCard(player, type);
    if (played) {
      d.logs = this.logEntries.slice(logLen);
      d.free = this.freeRoadsRemaining;
      this.devPlayed = this.devPick || this.pendingAction === "robber" || this.freeRoadsRemaining ? d : null;
    }
    this.sfx.click();
    if (played) {
      this.recomputeScores();
      this.checkForWinner(player);
      this.render();
    }
  }

  toggleDevCardPicker() {
    // Cards live in the dock tray now (phones and desktop): one tap on a card plays it
    this.openCardsTray();
  }

  _legacyDevCardPicker() {
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
    const human = this._me();
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

  handleBoardClick(event) {
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway())) return; // pass & play: not this holder's move
    if (this.setupPhase) {
      const { x: sx, y: sy } = this.getCanvasPoint(event);
      const world = this.screenToWorld(sx, sy);
      this.handleSetupClick(world.x, world.y);
      return;
    }
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this._seaHumanBlocked()) return; // ⚓ pick your gold first
    // v0.81: the compact trade sheet leaves the board visible (pinch / pan to look) — a tap there builds nothing
    if (this.isMobileLayout && this.tradeModal && this.tradeModal.style.display !== "none") return;
    // Robber placement is allowed before rolling (Knight); everything else needs the main phase
    const robberMode = this.pendingAction === "robber";
    if (!this._buildPhase() && !(robberMode && (this.phase === "pre_roll" || this.phase === "seven"))) return;
    if (this.pendingDiscard || this.robberVictimOptions?.length > 0) return;

    const { x: sx, y: sy } = this.getCanvasPoint(event);
    const world = this.screenToWorld(sx, sy);
    const x = world.x;
    const y = world.y;

    // Robber: a tap picks the tile. One victim (or none): it resolves by itself after a short
    // moment with Undo / Now in the dock; several: tap a portrait in the dock. With "Confirm
    // placements" on, the dock's Place button (or a second tap on the tile) commits.
    if (robberMode) {
      const cb = this.confirmBuild?.type === "robber" ? this.confirmBuild : null;
      if (cb && !this.isMobileLayout && this.hitTestConfirmIcon(x, y)) {
        this._commitRobber(player, cb.id, cb.victim);
        return;
      }
      const hexId = this.findHexAt(x, y);
      if (hexId == null) return;
      if (this.sea && this.sea.thief !== this._seaHexKind(hexId) && this._robberHexAllowed(hexId, player)) this.sea.thief = this._seaHexKind(hexId); // ⚓ land = robber, sea = pirate
      if (!this._robberHexAllowed(hexId, player)) {
        this._flashPrompt(this._robberBlockedReason(hexId, player));
        this.sfx.error?.();
        return;
      }
      const victims = this._stealVictims(hexId, player);
      if (cb && cb.id === hexId && (this.confirmPlacements || victims.length <= 1)) {
        // second tap on the chosen tile = go
        this._commitRobber(player, cb.id, cb.victim ?? this._defaultRobberVictim(hexId, player));
        return;
      }
      this.confirmBuild = { type: "robber", id: hexId,
        victim: victims.length === 1 ? victims[0] : this.confirmPlacements ? this._defaultRobberVictim(hexId, player) : null };
      if (!this.confirmPlacements && victims.length <= 1) this._startRobberTimer();
      else this._cancelRobberTimer();
      this.sfx.click();
      this.render();
      return;
    }

    // ⚓ Seafarers: a lifted ship goes to the tapped dotted spot; a tap on an open-end ship lifts it
    if (this.pendingAction === "moveShip") { this._seaMoveTap(player, x, y); return; }
    if (this.sea && (!this.pendingAction || this.pendingAction === "build") && !this.freeRoadsRemaining && !this.confirmBuild) {
      const ship = this._seaShipAt(player, x, y);
      // v0.84: auto-glow is your normal main phase, so a tap on your own ship still lifts it (as before without a mode)
      const glow = this._isAutoGlow() && this.trayMode !== "build";
      if (ship != null && (glow || !(this.pendingAction === "build" && this._buildTargetAt(player, x, y)))) { this._seaStartMove(player, ship); return; }
    }

    if (!this.pendingAction) {
      // No build mode: a tap on a spot you could build selects it (Place / ✓ confirms) —
      // a stray tap while looking around never spends cards.
      const target = this._autoDetectTarget(player, x, y);
      if (!target) return;
      this.pendingAction = target.type;
      this.confirmBuild = target;
      this._autoPick = true; // picked by a mode-less tap: the next tap may still mean another kind of piece
      this.canvas.style.cursor = "crosshair";
      this.sfx.click();
      this.render();
      return;
    }

    // The ✓ above a selected spot (desktop) / Place (phones) commits it
    if (this.confirmBuild && this.hitTestConfirmIcon(x, y)) {
      this._commitBuild(player, this.confirmBuild);
      return;
    }

    // Build mode: the legal spot under the finger. After a mode-less pick, every kind of piece is
    // still in play (v0.73: a road picked by mistake used to lock the next tap to roads, so a tap on
    // the corner built that road), and only a tap on the same spot builds.
    const auto = this._autoPick && this.confirmBuild && this.pendingAction === this.confirmBuild.type && this.pendingAction !== "robber";
    // v0.84 calm auto-glow (only corners lit): the usual corner-vs-road rule; a lit corner then builds in one tap (the
    // quiet roads around it make nothing ambiguous), an unlit road is only picked (below)
    const calm = !auto && this._isAutoGlow() && this._legalPlacementSpots()?.calm;
    let target = auto ? this._autoDetectTarget(player, x, y) : this._buildTargetAt(player, x, y);
    if (calm && target && target.type !== "road" && target.type !== "ship") target = { ...target, ambiguous: false };
    if (!target) { this.confirmBuild = null; if (auto) { this.pendingAction = null; this._autoPick = false; } this.render(); return; }
    if (!auto && this._isAutoGlow() && !this._spotLit(target)) {
      // v0.84: auto-glow keeps roads quiet while a corner is lit; a tap on such an unlit road is a pick that waits for Place
      this.pendingAction = target.type;
      this.confirmBuild = { ...target, ambiguous: true };
      this._autoPick = true;
      this.sfx.click();
      this.render();
      return;
    }
    const same = this.confirmBuild && this.confirmBuild.type === target.type && this.confirmBuild.id === target.id;
    // Direct building (Confirm placements off) still builds at once, except when the finger was
    // between a corner and a road: then the chosen spot is shown first and a second tap builds it.
    const direct = !this.confirmPlacements && !auto && !target.ambiguous;
    if (direct || same) { this._commitBuild(player, target); return; }
    if (auto) this.pendingAction = target.type;
    this.confirmBuild = target;
    this.sfx.click();
    this.render();
  }

  /** Mode-less tap: a city upgrade, a settlement spot or a road you can afford right now. */
  _autoDetectTarget(player, x, y) {
    // same picking as build mode: a tap near a corner means the corner, mid-edge means the road
    return this._buildTargetAt(player, x, y, this.freeRoadsRemaining > 0 ? "road" : "build");
  }

  /**
   * In build mode ("build" = every piece you can afford): the legal spot the finger meant.
   * v0.73: when a corner (settlement/city) and a road are both in reach, the corner wins within
   * 36% of an edge length (at least 14 CSS px) of it. A fingertip aimed at a corner lands a few px
   * off it, and the old rule (the road's middle half vs. the corner, each scaled by its own hit
   * radius) gave every tap more than ~15% along the edge to the road, i.e. ~5 px at fit on a phone.
   * Outside that zone the nearer of the corner and the road's middle 40% wins. Such a tap is
   * marked `ambiguous`, so a direct build shows the target first instead of placing it.
   * v0.74: a tap clearly on the road's middle (at most half as far from the middle 40% as from
   * the corner) is not ambiguous, so it still builds in one tap with Undo. At fit on a phone an
   * edge is ~30 px, so the corner's hit radius reaches the edge's middle and v0.73 marked every
   * road tap ambiguous, turning one-tap road building into two taps.
   */
  _buildTargetAt(player, x, y, pa = this.pendingAction) {
    const free = this.freeRoadsRemaining > 0;
    const all = pa === "build";
    const wantRoad = pa === "road" || (all && !free);
    const wantSet = pa === "settlement" || (all && !free);
    const wantCity = pa === "city" || (all && !free);
    let node = null, edge = null, ambiguous = false;
    // ⚓ Seafarers: an edge may take a road or a ship ("ship" mode: ships only; Road Building: either)
    const sea = this.sea, wantShip = !!sea && (pa === "ship" || all || free);
    const edgeType = (id) => (sea ? this._seaEdgeType(player, id, pa === "build" ? null : pa, free) : "road");
    if (wantSet || wantCity) node = this.findNodeAt(x, y, (id) => (wantCity && this.canBuildCity(player, id, false)) || (wantSet && this.canBuildSettlement(player, id, false)));
    if (wantRoad || wantShip) edge = this.findEdgeAt(x, y, (id) => (sea ? edgeType(id) != null : this.canBuildRoad(player, id, { free })));
    if (node != null && edge != null) {
      ambiguous = true;
      const k = this.view.scale || 1; // world units -> CSS px
      const n = this.geometry.nodes[node];
      const [a, b] = this.geometry.edges[edge].nodes.map((id) => this.geometry.nodes[id]);
      const L = Math.hypot(b.x - a.x, b.y - a.y) || this.geometry.hexSize;
      const dn = Math.hypot(x - n.x, y - n.y);
      if (dn <= Math.max(0.36 * L, 14 / k)) edge = null;
      else {
        const t = 0.3, ax = a.x + (b.x - a.x) * t, ay = a.y + (b.y - a.y) * t, bx = b.x - (b.x - a.x) * t, by = b.y - (b.y - a.y) * t;
        const ds = distancePointToSegment(x, y, ax, ay, bx, by);
        if (ds <= dn) { node = null; if (ds <= 0.5 * dn) ambiguous = false; }
        else edge = null;
      }
    }
    if (node != null) return { type: this.canBuildCity(player, node, false) && wantCity ? "city" : "settlement", id: node, ambiguous };
    if (edge != null) return { type: edgeType(edge), id: edge, ambiguous };
    return null;
  }

  /** Build the piece (pay, place, score). Offers Undo for a few seconds unless the game just ended. */
  _commitBuild(player, cb) {
    const before = { pa: this.pendingAction, tray: this.trayMode, free: this.freeRoadsRemaining,
      lr: this.longestRoadHolder, la: this.largestArmyHolder, logLen: this.logEntries.length };
    this._dropUndo();
    this._autoPick = false;
    let built = false;
    let paid = null;
    let isle = null; // ⚓ island bonus earned by this settlement
    if (cb.type === "ship") { // ⚓ Seafarers
      const isFree = this.freeRoadsRemaining > 0;
      if (this.sea?.placeShip(player, cb.id, { free: isFree })) {
        if (!isFree) { this.payToBank(player, COSTS.ship); paid = COSTS.ship; this.addLog(`${player.name} built a ship.`); }
        else {
          this.freeRoadsRemaining -= 1;
          if (this.freeRoadsRemaining > 0 && !this._hasLegalRoad(player, true)) this.freeRoadsRemaining = 0;
          this.addLog(`${player.name} placed a free ship (${this.freeRoadsRemaining} remaining).`);
        }
        this.sfx.buildRoad();
        built = true;
      }
    } else if (cb.type === "road") {
      const isFreeRoad = this.freeRoadsRemaining > 0;
      if (this.placeRoad(player, cb.id, { free: isFreeRoad })) {
        if (!isFreeRoad) { this.payToBank(player, COSTS.road); paid = COSTS.road; }
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
        this.payToBank(player, COSTS.settlement); paid = COSTS.settlement;
        this.addLog(`${player.name} built a settlement.`);
        if (this.sea) isle = this._seaOnSettlement(player, cb.id); // ⚓ +2 for a new island
        this.sfx.buildSettlement();
        built = true;
      }
    } else if (cb.type === "city") {
      if (this.placeCity(player, cb.id, false)) {
        this.payToBank(player, COSTS.city); paid = COSTS.city;
        this.addLog(`${player.name} upgraded to a city.`);
        this.sfx.buildCity();
        built = true;
      }
    }
    this.confirmBuild = null;
    if (!built) {
      if (this.rush) { this.addLog("Too slow — that spot was just taken."); this.sfx.error(); }
      this.render();
      return false;
    }
    const animPos = this.getBuildPosition(cb);
    if (animPos) this.placementAnims.push({ ...animPos, type: cb.type, startTime: Date.now() });
    // Road Building: stay in road mode while free roads remain; otherwise leave build mode
    if (this.freeRoadsRemaining > 0) this.pendingAction = "road";
    else { this.pendingAction = null; this.canvas.style.cursor = "grab"; }
    this.trayMode = null;
    if (this.devPlayed?.type === "roadBuilding") this.devPlayed = null; // the card took effect
    const undo = { kind: "build", type: cb.type, id: cb.id, pid: player.id, paid, ...before, isle, dock: !!isle, // ⚓ a new island: Undo / OK in the dock
      icon: cb.type, noun: cb.type === "settlement" ? "" : cb.type, label: { road: before.free ? "Free road placed" : "Road built", ship: before.free ? "Free ship placed" : "Ship built", settlement: isle ? "+2 points · New island" : "Settlement built", city: "City built" }[cb.type] };
    if (this.rush) {
      this._rushAfterAction(player);
    } else {
      if (this.sbp) this._sbpAfterHumanBuild();
      this.recomputeScores();
      this.checkForWinner(player);
      this.saveToStorage();
      this.render();
    }
    undo.logs = this.logEntries.slice(before.logLen);
    if (!this.winner && !this.confirmPlacements) this._setUndo(undo);
    return true;
  }

  /** Move the robber to a chosen (legal) tile and steal — the confirm step of robber mode. */
  _commitRobber(player, hexId, chosenVictim = null) {
    if (this.pendingAction !== "robber" || !this._robberHexAllowed(hexId, player)) return;
    this._cancelRobberTimer();
    this.confirmBuild = null;
    this.devPlayed = null; // a Knight can no longer be taken back
    const hex = this.geometry.hexes[hexId];
    if (this.sea && hex.resource === "sea") { this.sea.pirateHexId = hexId; this.addLog(`${player.name} moved the pirate.`); } // ⚓
    else { this.robberHexId = hexId; this.addLog(`${player.name} moved robber to ${this._hexLabel(hex)}.`); }
    if (this.sea) this.sea.thief = null;
    this.sfx.robber();
    this.pendingAction = null;

    // Check for steal victims
    const victims = this._stealVictims(hexId, player);
    if (victims.length === 0) {
      this.addLog("No one to steal from.");
      this.robberContext = null;
    } else if (victims.length === 1 || victims.includes(chosenVictim)) {
      this.stealFromVictim(player, victims.includes(chosenVictim) ? chosenVictim : victims[0]);
      this.robberContext = null;
    } else {
      // Multiple victims — show selection panel
      this.robberVictimOptions = victims;
      this.showVictimPanel(player, victims);
    }
    this.saveToStorage();
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
        this._userZoomed = true;
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
      const placing = !!(this.setupPhase || (this.pendingAction && !this._isAutoGlow()) || this.confirmBuild || this.robberVictimOptions?.length > 0
        || this.pendingDiscard || this.devPick || this.pendingIncomingTrade || this.tradeModal?.style.display !== "none");
      // v0.81: taps that fall between the hand's cards (the fan lies over the board) never zoom the board
      const fanTop = this.isMobileLayout ? this.resourceCardStrip?.getBoundingClientRect().top : null;
      const inFan = fanTop != null && fanTop > 0 && touch.clientY >= fanTop - 8;
      if (!placing && !inFan && now - ts.lastTapTime < 320 && Math.hypot(p.x - ts.lastTapX, p.y - ts.lastTapY) < 36) {
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
  _maxScale() { return this._fitScale * (this.sea ? 3.4 : this.bigBoard ? 3 : 2.5); } // ⚓ the Seafarers map is bigger: zoom in further

  /** Island bounds (world) and the visible board area (screen), shared by fit and clamping. */
  _viewFrame() {
    const g = this.geometry, hs = g.hexSize;
    const xs = g.hexes.map((h) => h.center.x), ys = g.hexes.map((h) => h.center.y);
    // Phones: the island (tiles + beach) fills the width; only the harbours may touch the screen edge
    const mobile = this.isMobileLayout;
    this._hScale = 0; // v0.78: re-chosen below on phones (see harbourScale)
    // ⚓ Seafarers: the whole scenario frame (outer sea hexes included, ships may sail there), no harbour boats
    // v0.86: landscape phones keep the top / bottom coast corners' build rings on screen in Seafarers too (the land
    // can reach the frame's edge there; the hand and the ticker no longer cover that band)
    const mx = hs * (this.sea ? 0.9 : mobile ? 1.05 : 1.75), my = hs * (this.sea ? (this.isLandscapePhone ? 1.45 : 1.0) : mobile ? 1.12 : 1.7);
    const box = { minX: Math.min(...xs) - mx, maxX: Math.max(...xs) + mx, minY: Math.min(...ys) - my, maxY: Math.max(...ys) + my };
    let fan = 0, top = 4, side = 0;
    // v0.76: harbour pills that sit further out than the margin (bays of the 5–6 player board) widen the box
    if (!mobile) harbourBadges(this, 1).forEach((q) => {
      const u = hs / 100, bx = g.centerX + q.x * u, by = g.centerY + q.y * u, hw = (q.w / 2 + 6) * u, hh = (q.h / 2 + 6) * u;
      box.minX = Math.min(box.minX, bx - hw); box.maxX = Math.max(box.maxX, bx + hw); box.minY = Math.min(box.minY, by - hh); box.maxY = Math.max(box.maxY, by + hh);
    });
    if (mobile && this.app) {
      const cs = getComputedStyle(this.app);
      // + the room a docked trade offer takes above the hand (only while one is up)
      fan = (parseFloat(cs.getPropertyValue("--fan-h")) || 112) + (this._fitNoOffer ? 0 : parseFloat(cs.getPropertyValue("--offer-room")) || 0);
      top = parseFloat(cs.getPropertyValue("--board-top")) || 4;
      side = parseFloat(cs.getPropertyValue("--board-side")) || 0;
      if (this.labMode) { fan = 6; top = 4; side = side || 8; } // AI Lab board: no hand / top bar over it; whole world in the frame
      if (side) {
        // Side gutters: the beach keeps --board-side from the screen edge; the harbour boats may use
        // that gutter; only the very tip of a boat may run off screen. Only the ports this map really has count, so a map
        // without a harbour at the far left/right gets the full width.
        const cx = (box.minX + box.maxX) / 2, half = (box.maxX - box.minX) / 2;
        const avail = this.boardWidth / 2;
        // v0.76: every harbour pill (same layout as the art, world units = hexSize / 100) fully on screen
        const u = hs / 100, M = 4 * u;
        const measure = (s) => {
          let reach = 0, y0 = box.minY, y1 = box.maxY;
          harbourBadges(this, s).forEach((q) => {
            const bx = g.centerX + q.x * u, by = g.centerY + q.y * u;
            reach = Math.max(reach, Math.abs(bx - cx) + (q.w / 2) * u + M);
            // v0.73: the whole world on screen — harbours above / below the island count for the height too
            y0 = Math.min(y0, by - (q.h / 2) * u - M); y1 = Math.max(y1, by + (q.h / 2) * u + M);
          });
          return { reach, y0, y1 };
        };
        // v0.78: the harbour pills grow on phones (ratio >= 12 px) but never at the cost of the board: take the
        // largest pill scale that costs the board at most 4% of the size the v0.77-size pills (scale 1.38) allowed
        const k77 = (() => { const m = measure(1.38); return Math.min((avail - side) / half, m.reach ? (avail - 3) / m.reach : Infinity); })();
        let hS = 1.38;
        for (let s = harbourScaleWanted(hs); s > 1.38; s -= 0.08) {
          const m = measure(s);
          if (!m.reach || (avail - 3) / m.reach >= k77 * 0.96) { hS = s; break; }
        }
        this._hScale = hS;
        const { reach, y0, y1 } = measure(hS);
        box.minY = y0; box.maxY = y1;
        // v0.73: every harbour boat fully on screen (playtest: "I can't always see the whole world");
        // was: a boat tip could run 6 px off the edge
        const k = Math.min((avail - side) / half, reach ? (avail - 3) / reach : Infinity);
        box.minX = cx - avail / k; box.maxX = cx + avail / k;
        side = 0;
      }
    }
    const ins = mobile ? { t: top, r: side, b: fan - 6, l: side } : { t: 10, r: 10, b: 10, l: 10 };
    const vp = { l: ins.l, t: ins.t, W: Math.max(50, this.boardWidth - ins.l - ins.r), H: Math.max(50, this.boardHeight - ins.t - ins.b) };
    if (mobile) {
      // Width-bound portrait phones: balance the spare sea above and below the island — 60% above (where
      // the fit button floats), 40% above the hand. v0.72: was 90% on top (shift 0.8), which left a big empty
      // band of sea under the ticker on tall phones. (The island is centred in what is left after the shift.)
      const scale = Math.min(vp.W / (box.maxX - box.minX), vp.H / (box.maxY - box.minY));
      const slack = vp.H - (box.maxY - box.minY) * scale;
      if (slack > 8) { const shift = slack * 0.2; vp.t += shift; vp.H -= shift; }
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
    // zoomed in, the board runs under the hand: the fan gets a solid backdrop (nothing shows through the cards)
    const zoomed = !!(this._fitScale && this.view.scale > this._fitScale * 1.05);
    if (zoomed !== this._zoomedCls) { this._zoomedCls = zoomed; this.app?.classList.toggle("board-zoomed", zoomed); }
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
      // A frame's timestamp can precede the touchend's performance.now(): skip such frames instead
      // of reading "no movement" as having hit an edge (which used to kill the glide at random).
      const dt = Math.min(40, now - last);
      if (dt <= 0) { this._viewAnim = requestAnimationFrame(step); return; }
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
    this._userZoomed = true;
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
      this._userZoomed = true;
      this._animateView({ scale, offsetX: pt.x - w.x * scale, offsetY: pt.y - w.y * scale });
    } else {
      this._userZoomed = false;
      this._animateView(this._fitTarget());
    }
  }

  handleKeyboardShortcut(event) {
    if (document.querySelector(".newgame-modal")) return; // setup screen owns the keyboard
    if (this.home?.open || this.menu?.open) return; // home screen / menu: no game shortcuts
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && this.undoState) {
      this.undoLast();
      event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "enter" && this.confirmBuild && this.currentPlayer?.isHuman) {
      // Enter confirms the selected spot / robber tile (Confirm placements on)
      this._confirmViaIcon();
      event.preventDefault();
      return;
    }
    if (key === "u" && this.undoState) {
      this.undoLast();
      event.preventDefault();
      return;
    }

    if (key === "escape") {
      if (this.devSel || this._handInfoOpen) { this.devSel = null; this._closeHandInfo(); this.renderResourceCards(); return; }
      if (this.devPlayed && this._cancelDevPlay()) return;
      if (this.trayMode) this.closeTray();
      if (this.confirmBuild?.type === "robber") {
        this._cancelRobberTimer();
        this.confirmBuild = null;
        this.render();
      } else if (this.confirmBuild) {
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
    if (key === "e" || (key === "s" && this.sbp?.human)) {
      // E / S: End turn, or Skip / Done your build window (5–6 players)
      if (this.sbp?.human) this.sbpSkip(); else this.handleHumanEndTurn();
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
    if (key === "4" && this.sea) { // ⚓
      this.setPendingAction("ship");
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
    const humanMain = player?.isHuman && this._buildPhase();

    if (this.setupPhase && player?.isHuman) {
      if (this.setupAction === "settlement") {
        const nodeId = this.findNodeAt(worldX, worldY, (id) => this.canBuildSettlement(player, id, true));
        if (nodeId != null) {
          this.hoverNodeId = nodeId;
          this.hoverTooltip = "Place settlement";
          this.canvas.style.cursor = "pointer";
          return;
        }
      } else if (this.setupAction === "road") {
        const edgeId = this.sea ? this._seaSetupEdgeAt(player, worldX, worldY)?.id ?? null // ⚓
          : this.findEdgeAt(worldX, worldY, (id) => { const e = this.geometry.edges[id]; return e.owner == null && e.nodes.includes(this.lastSetupNodeId); });
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
      if (hexId != null && this._robberHexAllowed(hexId, player)) {
        this.hoverHexId = hexId;
        const hex = this.geometry.hexes[hexId];
        const label = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource] || TERRAIN_NAME[hex.resource]; // ⚓ "Gold field"
        // No tooltip — hex highlight is enough
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "crosshair";
      }
      return;
    }

    if (humanMain && this.pendingAction === "build") {
      const t = this._buildTargetAt(player, worldX, worldY);
      if (t?.type === "road" || t?.type === "ship") this.hoverEdgeId = t.id; // ⚓ ship
      else if (t) this.hoverNodeId = t.id;
      this.canvas.style.cursor = t ? "pointer" : "crosshair";
      return;
    }
    if (humanMain && ["road", "ship", "moveShip"].includes(this.pendingAction)) { // ⚓ ship / move ship
      const spots = this._legalPlacementSpots() || { edges: [], ships: [] };
      const edgeId = this.findEdgeAt(worldX, worldY, (id) => spots.edges.includes(id) || (spots.ships || []).includes(id));
      if (edgeId != null) {
        this.hoverEdgeId = edgeId;
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "crosshair";
      }
      return;
    }
    if (humanMain && (this.pendingAction === "settlement" || this.pendingAction === "city")) {
      const nodeId = this.findNodeAt(worldX, worldY, (id) => (this.pendingAction === "settlement"
        ? this.canBuildSettlement(player, id, false)
        : this.canBuildCity(player, id, false)));
      const buildable = nodeId != null;
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

  /** Nearest node within a finger-sized radius (≥ 22 CSS px, ≥ 38% of an edge — v0.73: was 28%, smaller
   *  than the corner zone of _buildTargetAt when zoomed in); `accept` limits it to legal spots. */
  findNodeAt(x, y, accept = null) {
    let bestId = null;
    const hitRadius = Math.max(22 / (this.view.scale || 1), this.geometry.hexSize * 0.38);
    let bestDist = hitRadius;
    this.geometry.nodes.forEach((node) => {
      if (accept && !accept(node.id)) return;
      const dist = Math.hypot(x - node.x, y - node.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = node.id;
      }
    });
    return bestId;
  }

  /** Nearest edge within ≥ 16 CSS px; `accept` limits it to legal spots. */
  findEdgeAt(x, y, accept = null) {
    let bestId = null;
    const hitRadius = Math.max(16 / (this.view.scale || 1), this.geometry.hexSize * 0.18);
    let bestDist = hitRadius;
    this.geometry.edges.forEach((edge) => {
      if (accept && !accept(edge.id)) return;
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
    this._stRoll(player, this.lastDice.d1, this.lastDice.d2);
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
    const goldOwed = this.players.map(() => 0); // ⚓ Seafarers gold fields: cards of free choice
    this.geometry.hexes.forEach((hex) => {
      if (hex.id === this.robberHexId || hex.number !== roll) return;
      hex.nodes.forEach((nodeId) => {
        const node = this.geometry.nodes[nodeId];
        if (node.owner == null || node.structure == null) return;
        if (hex.resource === "gold") { goldOwed[node.owner] += node.structure === "city" ? 2 : 1; return; }
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
    if (this.sea && goldOwed.some((n) => n > 0)) this.sea.payGold(goldOwed, gainByPlayer, this.isRush() ? null : this.currentPlayer); // ⚓ after the normal cards
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

  // Bot discard: drop the cards that hurt its build plan least (keeps the cards for the build
  // closest to completion / its current goal; surplus it could trade away goes first).
  _autoDiscard(player, count) {
    const selected = makeEmptyResources();
    const hand = copyResources(player.resources);
    let plan = null;
    try { plan = this._aiPlan(player); } catch (_) { plan = null; }
    for (let i = 0; i < count; i += 1) {
      let best = null;
      let bestVal = Number.NEGATIVE_INFINITY;
      RESOURCES.forEach((r) => {
        if (hand[r] <= 0) return;
        hand[r] -= 1;
        // tie-break: drop from the biggest pile (most replaceable)
        const v = (plan ? this._aiKeepValue(plan, hand) : 0) + hand[r] * 1e-4;
        hand[r] += 1;
        if (v > bestVal) { bestVal = v; best = r; }
      });
      if (!best) break;
      hand[best] -= 1;
      selected[best] += 1;
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
    // ⚓ Seafarers: the robber stays on land, the pirate at sea (sea.thief picks one, null = either)
    if (this.sea) return this.sea.legalThiefHexes(mover, this.sea.thief, this.settings.friendlyRobber
      ? (h) => (h.resource === "sea" ? this.sea.hexTouchesShipOf(h, (o) => this._isRobberProtected(o, mover)) : this._hexTouchesProtected(h, mover)) : null);
    const others = this.geometry.hexes.filter((h) => h.id !== this.robberHexId);
    if (!this.settings.friendlyRobber) return others;
    const strict = others.filter((h) => !this._hexTouchesProtected(h, mover));
    return strict.length ? strict : others;
  }

  _robberHexAllowed(hexId, mover) {
    if (this.sea) { // ⚓ judged for the piece that goes there (land: robber, sea: pirate)
      const prev = this.sea.thief;
      this.sea.thief = this._seaHexKind(hexId);
      try { return this._legalRobberHexes(mover).some((h) => h.id === hexId); } finally { this.sea.thief = prev; }
    }
    return this._legalRobberHexes(mover).some((h) => h.id === hexId);
  }

  // Players the mover may steal from on a hex
  _stealVictims(hexId, mover) {
    if (this.sea && this.geometry.hexes[hexId].resource === "sea") return this.sea.shipVictims(hexId, mover, (o) => this._isRobberProtected(o, mover)); // ⚓ pirate: ship owners
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
      if (this.sea) { this.sea.thief = null; this.sea.moveSel = null; } // ⚓ robber or pirate: chosen in the dock or by the tapped hex
      this.addLog(this.sea ? "Move the robber (land) or the pirate (sea)." : "Move the robber — tap a tile.");
      this.sfx.robberPrompt();
      this.render();
      return;
    }
    const targetHexId = this.chooseRobberHex(currentPlayer);
    if (this._aiRec()) this._aiNoteRobber(currentPlayer, targetHexId);
    this.moveRobberAndSteal(currentPlayer, targetHexId);
  }

  // Robber placement by awareness level. Scores are in "cards": production blocked over the
  // ~10 rolls the robber usually stays, plus the card stolen.
  //   none:     blocks the busiest opponent tile, ignoring who is winning
  //   basic:    also counts the steal, leans on players with more public VP
  //   advanced: hunts the public VP leader (hard when near the win)
  chooseRobberHex(currentPlayer) {
    if (this.sea && !this.sea._evalRobber) return this.sea.chooseThiefHex(currentPlayer); // ⚓ robber or pirate
    const legal = this._legalRobberHexes(currentPlayer);
    let bestHex = legal[0]?.id ?? this.robberHexId;
    let bestScore = Number.NEGATIVE_INFINITY;
    this._aiRobberCandidates(currentPlayer, legal).forEach(({ id, score }) => {
      if (score > bestScore) {
        bestScore = score;
        bestHex = id;
      }
    });
    return bestHex;
  }

  // Every legal robber tile with the bot's score; `parts` splits it (blocked cards, leader weighting,
  // own tiles, the steal) and `dmg` is the opponents' expected loss in cards (analysis only).
  _aiRobberCandidates(currentPlayer, legal = this._legalRobberHexes(currentPlayer)) {
    const awareness = this._aiStrat(currentPlayer).awareness;
    const others = this.players.filter((p) => p.id !== currentPlayer.id);
    const avgVP = others.reduce((a, p) => a + p.publicVictoryPoints, 0) / Math.max(1, others.length);
    const topVP = Math.max(...others.map((p) => p.publicVictoryPoints));
    const kLead = this._aiStrat(currentPlayer).w?.leader ?? 1;
    const weight = (owner) => { const v = weight0(owner); return kLead === 1 ? v : 1 + (v - 1) * kLead; };
    const weight0 = (owner) => {
      if (awareness === "none") return 1;
      const p = this.players[owner];
      if (awareness === "basic") return Math.max(0.5, 1 + 0.15 * (p.publicVictoryPoints - avgVP));
      if (p.publicVictoryPoints < topVP) return 0.8;
      return p.publicVictoryPoints >= this.winPoints - 3 ? 3 : 1.8;
    };
    return legal.map((hex) => {
      const pips = hex.number && hex.resource !== "desert" ? DICE_WEIGHT[hex.number] : 0;
      let score = 0;
      const parts = { block: 0, leader: 0, own: 0, steal: 0 };
      const victims = new Set();
      hex.nodes.forEach((nodeId) => {
        const node = this.geometry.nodes[nodeId];
        if (node.owner == null || node.structure == null) return;
        const cards = (pips / 36) * (node.structure === "city" ? 2 : 1) * 10;
        if (node.owner === currentPlayer.id) { score -= cards * (awareness === "none" ? 1 : 1.5); parts.own -= cards * (awareness === "none" ? 1 : 1.5); }
        else {
          score += cards * weight(node.owner);
          parts.block += cards;
          parts.leader += cards * (weight(node.owner) - 1);
          if (!this._isRobberProtected(node.owner, currentPlayer) && sumResources(this.players[node.owner].resources) > 0) victims.add(node.owner);
        }
      });
      if (awareness !== "none" && victims.size) {
        // a steal is worth about a card; more from a big (public) hand that may hold what we need
        const steal = Math.max(...[...victims].map((v) => Math.min(1.5, 0.6 + sumResources(this.players[v].resources) * 0.08) * weight(v)));
        score += steal;
        parts.steal = steal;
      }
      return { id: hex.id, score, parts, dmg: parts.block + (victims.size ? 1 : 0) };
    });
  }

  // Who to steal from: none = random; basic = biggest hand; advanced = leader / likeliest useful card
  // (public card-count estimates only — never the hidden hands).
  _aiChooseVictim(currentPlayer, victims) {
    const awareness = this._aiStrat(currentPlayer).awareness;
    if (victims.length <= 1 || awareness === "none") return victims[Math.floor(Math.random() * victims.length)];
    const handSize = (id) => sumResources(this.players[id].resources);
    if (awareness === "basic") return victims.slice().sort((a, b) => handSize(b) - handSize(a))[0];
    let need = null;
    try { need = this._aiPlan(currentPlayer).goals[0]?.cost || null; } catch (_) { need = null; }
    const topVP = Math.max(...this.players.filter((p) => p.id !== currentPlayer.id).map((p) => p.publicVictoryPoints));
    let best = victims[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    victims.forEach((id) => {
      const p = this.players[id];
      const est = this._aiEstimate(p);
      const n = Math.max(1e-6, sumResources(est));
      const useful = need ? RESOURCES.reduce((a, r) => a + ((need[r] || 0) > currentPlayer.resources[r] ? est[r] / n : 0), 0) : 0;
      let score = useful * 2 + Math.min(8, handSize(id)) * 0.1;
      if (p.publicVictoryPoints === topVP) score += 0.6;
      if (p.publicVictoryPoints >= this.winPoints - 2) score += 2;
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return best;
  }

  moveRobberAndSteal(currentPlayer, targetHexId) {
    if (this.sea && this.geometry.hexes[targetHexId].resource === "sea") { this.sea.pirateHexId = targetHexId; this.addLog(`${currentPlayer.name} moved the pirate.`); } // ⚓
    else { this.robberHexId = targetHexId; this.addLog(`${currentPlayer.name} moved robber to ${this._hexLabel(this.geometry.hexes[targetHexId])}.`); }
    this.sfx.robber();
    const victims = this._stealVictims(targetHexId, currentPlayer);
    if (!victims.length) return;
    this._doSteal(currentPlayer, this._aiChooseVictim(currentPlayer, victims));
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
    this._aiTrkSteal(victim, currentPlayer); // the card itself is hidden from the other players
    victim.resources[stolen] -= 1;
    currentPlayer.resources[stolen] += 1;
    if (this.hotseat) {
      // pass & play: the table only learns that a card moved; thief and victim see which one privately
      this.addLog(`${currentPlayer.name} stole a card from ${victim.name}.`);
      this._hsStealNotes(currentPlayer, victim, RESOURCE_LABEL[stolen]);
    } else this.addLog(`${currentPlayer.name} stole 1 ${RESOURCE_LABEL[stolen]} from ${victim.name}.`);
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

  /**
   * Trade result: the cards you receive fly from `src` (the result line, the offer card) into your
   * hand, or into the sheet's hand row while the trade sheet is open, ending in a "+n"; the slots you
   * paid from dip briefly. Without a source (or with reduced motion) only the "+n" pops.
   */
  _animateTradeCards(give, get, src = null) {
    window.setTimeout(() => {
      const sheetOpen = this.tradeModal && this.tradeModal.style.display !== "none";
      const target = (r) => (sheetOpen ? document.querySelector(`#tradeOfferGrid [data-hand="${r}"]`) : null)
        || document.querySelector(`#resourceCardStrip .card[data-card="${r}"]`);
      const sr = src?.getBoundingClientRect?.();
      const canFly = !!(this.fx && sr && sr.width && !motionReduced());
      let k = 0;
      RESOURCES.forEach((r) => {
        const t = target(r);
        if (!t) return;
        if (give[r]) this._pulseClass(t, "tr-down", 700);
        if (!get[r]) return;
        if (!canFly) { this.fx?.plus(t, get[r]); this._pulseClass(t, "tr-up", 700); return; }
        for (let i = 0; i < get[r]; i += 1) {
          const last = i === get[r] - 1;
          window.setTimeout(() => this._flyTradeCard(r, sr, t, last ? get[r] : 0), (k += 1) * 140);
        }
      });
    }, 60);
  }

  _pulseClass(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  _flyTradeCard(res, sr, target, plusN) {
    const fx = this.fx;
    const tr = target.getBoundingClientRect();
    if (!fx || !tr.width) return;
    const cw = 34;
    const sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2;
    const dx = tr.left + tr.width / 2 - sx, dy = tr.top + tr.height / 2 - sy;
    const el = fx.actor(cardSvg(res), sx - cw / 2, sy - cw * 0.7, cw, "fx-card");
    fx.A(el, [
      { transform: "translate(0,0) scale(.6)", opacity: 0 },
      { transform: `translate(${dx * 0.35}px,${dy * 0.35 - 28}px) scale(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px,${dy}px) scale(.75)`, opacity: 1, offset: 0.9 },
      { transform: `translate(${dx}px,${dy}px) scale(.75)`, opacity: 0 },
    ], { duration: 640, easing: "ease-in-out" });
    fx.later([el], 700);
    window.setTimeout(() => {
      if (plusN) fx.plus(target, plusN);
      this._pulseClass(target, "tr-up", 700);
    }, 620 * (fx.M?.k || 1));
  }

  _showStealAnimation(thief, victim, resource) {
    const youInvolved = this.hotseat ? this._seesPrivate(thief) || this._seesPrivate(victim) : thief.isHuman || victim.isHuman;
    this.fx?.steal(thief.id, victim.id, resource, youInvolved);
  }

  stealFromVictim(currentPlayer, victimId) {
    this._doSteal(currentPlayer, victimId);
  }

  showVictimPanel(currentPlayer, victimIds) {
    // The choice is made in the dock tray (portraits); robberVictimOptions drives it
    this.render();
  }

  _legacyVictimPanel(currentPlayer, victimIds) {
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

  // ── Trade sheet ──────────────────────────────────────────────────────

  /**
   * v0.76: one trade panel, no Bank | Players tabs. You pick what you give and what you get once;
   * the footer then offers both routes side by side: the bank (your best rate — 4:1, 3:1 or a 2:1
   * harbour — applied by itself) and "Offer" to the players, whose answers appear on their avatars
   * (✓ tap to trade · ✗ · ⇄ counter-offer).
   * The markup is built here, not taken from index.html: a phone that still has an older cached
   * index.html (with the new game.js) then shows the same sheet as everyone else.
   */
  _buildTradeSheet() {
    const el = document.querySelector("#tradeModal");
    if (!el) return;
    el.className = "sheet trade-sheet";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "tradeTitle");
    el.innerHTML = `<div class="grab"></div>
      <div class="sheet-head"><h3 id="tradeTitle">${icon("trade")}Trade</h3>
        <button type="button" id="tradeModalClose" class="btn ghost icon-only" aria-label="Close">${icon("close")}</button></div>
      <div class="trade-body" id="tradeBody">
        <div class="tlbl"><span>You give</span></div>
        <div id="tradeOfferGrid" class="tgrid give" role="group" aria-label="You give"></div>
        <div class="tlbl"><span>You get</span></div>
        <div id="tradeRequestGrid" class="tgrid get" role="group" aria-label="You get"></div>
        <div class="tplayers" id="tradePlayers">
          <div class="tp-head"><span>Players</span><small id="tradePlayersNote"></small></div>
          <div class="tp-row" id="tradePlayerRow"></div>
          <div id="tradeProposalResult" class="trade-result" aria-live="polite"></div>
        </div>
      </div>
      <div class="trade-foot">
        <p class="trade-hint" id="tradeHint" aria-live="polite"></p>
        <div class="btnrow two">
          <button type="button" id="tradeExecuteBtn" class="btn route bank"></button>
          <button type="button" id="tradeProposalBtn" class="btn route offer primary"></button>
        </div>
      </div>
      <select id="giveResourceSelect" hidden></select>
      <select id="getResourceSelect" hidden></select>`;
    el.style.display = "none";
  }

  /** Why the human can't trade right now (null = trading is open). Classic: your main phase; Rush: any time. */
  _tradeBlockedReason() {
    const human = this._me();
    if (!human || this.winner) return "The game is over.";
    if (this.setupPhase) return "Trading opens after setup.";
    if (this.pendingDiscard) return "Hand back your cards first.";
    if (this._robberInProgress()) return "Move the robber first.";
    if (this._seaHumanBlocked()) return "Pick your gold first."; // ⚓
    if (this.isRush()) return this.rush && !this.rush.paused && this.phase === "main" ? null : "Trading resumes after the robber.";
    if (this.currentPlayer !== human) return "Trading opens on your turn.";
    if (this.phase === "pre_roll") return "Roll the dice first, then you can trade.";
    if (this.phase === "sbp") return "No trading in the build window · build or buy with your own cards";
    return this.phase === "main" ? null : "Trading opens on your turn.";
  }

  openTradeModal() {
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway())) return; // pass & play: not this holder's move
    if (!this.tradeModal) return;
    // Toggle: if already open, close it
    if (this.tradeModal.style.display !== "none") {
      this.closeTradeModal();
      return;
    }
    const why = this._tradeBlockedReason();
    if (why) {
      this.pushToast(why, "important");
      return;
    }
    this.tradeModal.style.display = "";
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this.tradeLocked = false;
    this._tradeAsked = null;
    this._tradeAnswers = null;
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
    this._refreshTradeGrids();
    this._syncScrim?.();
  }

  closeTradeModal() {
    if (!this.tradeModal) return;
    if (this.tradeModal.style.display !== "none" && this.tradeProposalResult) {
      this.tradeProposalResult.innerHTML = ""; // drop any pending counter-offer buttons
    }
    this.tradeLocked = false;
    this._tradeAsked = null;
    this._tradeAnswers = null;
    this._markStripAnswers();
    if (this.tradeModal.style.display !== "none") this._guardPrimaryTap(650, this.tradeModal);
    this.tradeModal.style.display = "none";
    this._syncScrim?.();
  }

  hideTradePanel() {
    this.closeTradeModal();
  }

  /**
   * A sheet / offer button just closed what covered the dock: hold off the primary button briefly.
   * v0.86: only where that sheet / offer card was (its rect, a few px of slack): a second tap of a double
   * tap lands there; a deliberate tap on Roll / End turn / Ready elsewhere goes through. No element (or
   * one not on screen): the whole screen is guarded, as before.
   */
  _guardPrimaryTap(ms = 650, el = null) {
    this._primaryGuardUntil = performance.now() + ms;
    const r = el?.getBoundingClientRect?.();
    const M = 8;
    this._primaryGuardRect = r && r.width > 0 && r.height > 0 ? { l: r.left - M, t: r.top - M, r: r.right + M, b: r.bottom + M } : null;
  }

  /** True (and the tap is swallowed) while a tap could still be meant for the sheet that just closed. */
  _primaryTapGuarded(e) {
    if (!(performance.now() < (this._primaryGuardUntil || 0))) return false;
    const g = this._primaryGuardRect;
    // a pointer tap outside the closed sheet / card is meant for the button (keyboard clicks have detail 0)
    if (g && e && e.detail > 0 && Number.isFinite(e.clientX) && !(e.clientX >= g.l && e.clientX <= g.r && e.clientY >= g.t && e.clientY <= g.b)) return false;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    return true;
  }

  /** The players' answers belong to the offer they were given: any change to the picks clears them. */
  _clearTradeAnswers() {
    this._tradeAsked = null;
    this._tradeAnswers = null;
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
    this._markStripAnswers();
  }

  /** Add (+1) or take back (-1) one card on the give or get side. Never give and get the same kind. */
  _tradePick(side, r, d) {
    const player = this.currentPlayer;
    if (!player?.isHuman) return;
    const mine = side === "give" ? this.tradeOffer : this.tradeRequest;
    const other = side === "give" ? this.tradeRequest : this.tradeOffer;
    const max = side === "give" ? player.resources[r] : this.bankSize || BANK_SIZE;
    if (d > 0 && mine[r] >= max && mine[r] > 0 && this._tradeTapToggle) {
      // v0.81: a tap on a card that can take no more puts one back (the "−" on its chip does too)
      d = -1;
    } else if (d > 0 && mine[r] >= max) {
      this._tradeHint(side === "give" ? `You have ${player.resources[r]} ${RESOURCE_LABEL[r]}.` : "");
      this.sfx.error?.();
      return;
    }
    mine[r] = clamp(mine[r] + d, 0, max);
    if (d > 0) other[r] = 0;
    this._clearTradeAnswers();
    this.sfx.click();
    this._refreshTradeGrids();
  }

  buildTradeGrids() {
    const player = this.currentPlayer;
    if (!player) return;
    this._renderTradePicks(this.tradeOfferGrid, "give", player);
    this._renderTradePicks(this.tradeRequestGrid, "get", player);
    this._renderTradePlayers(player);
  }

  /**
   * One row of five resource tiles. Tap a tile: one more of that card; the "−" under a picked tile
   * takes one back. Give tiles show what you hold (and what is left after the trade).
   */
  _renderTradePicks(container, side, player) {
    if (!container) return;
    const picks = side === "give" ? this.tradeOffer : this.tradeRequest;
    // ratio tags only where a 2:1 harbour beats your usual rate (4:1, or 3:1 with a 3:1 harbour)
    const baseRate = Math.max(...RESOURCES.map((r) => this.getPlayerTradeRate(player, r)).filter((x) => x > 2), 3);
    // v0.81: mini versions of the hand's own cards (same art, same tone-on-tone numeral / stack edges):
    // give shows what you hold, get shows what the bank still has (an empty bank pile is struck through).
    container.innerHTML = RESOURCES.map((r) => {
      const n = picks[r] || 0;
      const have = player.resources[r];
      const name = RESOURCE_LABEL[r];
      const stock = this.bank[r];
      const usable = side === "give" ? have > 0 : true;
      const out = side === "get" && stock <= 0;
      const rate = this.getPlayerTradeRate(player, r);
      const num = side === "give" ? have - n : stock;
      const sub = side === "give" ? (n ? `<span class="aft">${have - n} left</span>` : `have ${have}`)
        : stock > 0 ? `bank ${stock}` : "bank empty";
      const label = side === "give" ? `Give one more ${name} (you have ${have}${n ? `, giving ${n}` : ""})` : `Get one more ${name}${n ? ` (asking ${n})` : ""} · bank has ${stock}`;
      return `<div class="tcell ${r}${n ? " pick" : ""}${usable ? "" : " none"}${out ? " out" : ""}" data-hand="${side === "give" ? r : ""}" data-res="${r}">
        <button type="button" class="tpick" data-${side}="${r}" aria-label="${label}" ${usable ? "" : "aria-disabled=\"true\""}>${side === "give" && rate < baseRate ? `<span class="rate-tag port">${rate}:1</span>` : ""}<span class="tcard card" data-card="${r}" data-n="${Math.max(1, Math.min(num, 4))}">${cardSvg(r)}<span class="tnum">${num}</span></span><small>${sub}</small></button>
        ${n ? `<b class="tbadge">${n}</b>` : ""}<button type="button" class="tminus" data-${side}-minus="${r}" aria-label="${side === "give" ? "Give" : "Get"} one ${name} less" ${n ? "" : "tabindex=\"-1\" aria-hidden=\"true\""}>${icon("minus")}</button>
      </div>`;
    }).join("");
    container.querySelectorAll("button").forEach((b) => {
      const [k, r] = Object.entries(b.dataset)[0] || [];
      if (!k || !r) return;
      b.addEventListener("click", () => {
        if (k.endsWith("Minus")) { if (picks[r] > 0) this._tradePick(side, r, -1); return; }
        if (side === "give" && player.resources[r] < 1) { this._tradeHint(`You have no ${RESOURCE_LABEL[r]}.`); return; }
        this._tradeTapToggle = true;
        try { this._tradePick(side, r, 1); } finally { this._tradeTapToggle = false; }
      });
    });
  }

  /** The players you can offer to: avatar + name; after an offer each carries its answer (✓ ✗ ⇄). */
  _renderTradePlayers(player) {
    const row = document.querySelector("#tradePlayerRow");
    const note = document.querySelector("#tradePlayersNote");
    if (!row) return;
    const ans = this._tradeAnswers;
    const others = this.players.filter((p) => p.id !== player.id);
    const picked = sumResources(this.tradeOffer) > 0 && sumResources(this.tradeRequest) > 0;
    row.innerHTML = others.map((p) => {
      // pass & play: another person is asked directly (the phone goes to them)
      if (this.hotseat && p.isHuman) return `<button type="button" class="tp ask pc-${p.id}" data-ask="${p.id}" ${picked ? "" : "aria-disabled=\"true\""} aria-label="Ask ${p.name}">
        <span class="tp-av">${this._av(p)}</span><span class="who pc-${p.id}">${p.name}</span><span class="tp-n" title="${sumResources(p.resources)} cards in hand">${icon("cards")}${sumResources(p.resources)}</span><em class="tp-go">Ask</em></button>`;
      const v = this._tradeVerdict(p.id);
      const badge = v === "yes" ? icon("check") : v === "no" ? icon("close") : v === "counter" ? icon("trade") : "";
      const word = v === "yes" ? "accepts · tap to trade" : v === "no" ? "declines" : v === "counter" ? "counter-offer" : "";
      return `<button type="button" class="tp pc-${p.id}${v ? ` ${v}` : ""}" data-partner="${p.id}" ${v === "yes" ? "" : "aria-disabled=\"true\""} aria-label="${p.name}${word ? `: ${word}` : ""}">
        <span class="tp-av">${this._av(p)}${badge ? `<i class="tp-st ${v}">${badge}</i>` : ""}</span>
        <span class="who pc-${p.id}">${p.name}</span><span class="tp-n" title="${sumResources(p.resources)} cards in hand">${icon("cards")}${sumResources(p.resources)}</span>${v === "yes" ? '<em class="tp-go">Trade</em>' : ""}
      </button>`;
    }).join("");
    row.querySelectorAll("button.tp.ask").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") { this._tradeHint(`Pick what you give and get, then ask ${this.players[Number(b.dataset.ask)].name}.`); return; }
      this._hsAsk(this.players[Number(b.dataset.ask)]);
    }));
    row.querySelectorAll("button.tp.yes").forEach((b) => b.addEventListener("click", () => {
      const partner = this.players[Number(b.dataset.partner)];
      this._executePlayerTrade(partner, ans.offer, ans.request);
    }));
    this._markStripAnswers();
    if (note) {
      const yes = ans ? ans.responses.filter((x) => x.accepts).length : 0;
      note.textContent = !ans ? (sumResources(this.tradeOffer) && sumResources(this.tradeRequest) ? (this.hotseat ? "Offer asks the bots · Ask a person" : "tap Offer to ask them") : "")
        : yes ? "tap a ✓ to trade" : ans.counter ? "no takers · one counter-offer" : "no takers this time";
    }
  }

  /**
   * The bank route for the current picks (null fields + `why` when there is none). The rate is
   * applied by itself: picking 1 Lumber still trades your 4 (or 3, or 2 at a harbour) — the button
   * says so. With nothing picked to give, the best card you can spare at your rate is used.
   */
  _bankPlan(player) {
    const req = this.tradeRequest, off = this.tradeOffer;
    const k = sumResources(req);
    const getT = RESOURCES.filter((r) => req[r] > 0);
    if (!k) return { why: "pick what you get" };
    const out = getT.find((r) => this.bank[r] < req[r]);
    if (out) return { why: `bank is out of ${RESOURCE_LABEL[out]}` };
    const offT = RESOURCES.filter((r) => off[r] > 0);
    if (offT.length > 1) return { why: "one kind only" };
    if (offT.length === 1) {
      const give = offT[0], rate = this.getPlayerTradeRate(player, give), n = rate * k;
      if (player.resources[give] < n) return { why: `needs ${n} ${RESOURCE_LABEL[give]}`, give, rate, n };
      return { give, rate, n, k };
    }
    const cands = RESOURCES.filter((r) => !getT.includes(r))
      .map((r) => ({ r, rate: this.getPlayerTradeRate(player, r) }))
      .filter((c) => player.resources[c.r] >= c.rate * k)
      .sort((a, b) => a.rate - b.rate || (player.resources[b.r] - b.rate * k) - (player.resources[a.r] - a.rate * k));
    if (!cands.length) return { why: "not enough of one kind" };
    const { r, rate } = cands[0];
    return { give: r, rate, n: rate * k, k, auto: true };
  }

  /** The footer line (always on screen): a short reason, or ("ok") what the last trade did. */
  _tradeHint(text, cls = "") {
    const hint = document.querySelector("#tradeHint");
    if (!hint) return;
    hint.textContent = text;
    hint.className = `trade-hint${cls ? ` ${cls}` : ""}`;
  }

  _refreshTradeGrids() {
    this.buildTradeGrids();
    this.updateTradeButtons();
  }

  /** Your hand changed while the sheet is open (Rush rolls, a steal): redraw it, keep picks you can still pay. */
  _syncTradeSheet() {
    if (!this.tradeModal || this.tradeModal.style.display === "none") return;
    const player = this.currentPlayer;
    if (!player?.isHuman) return;
    RESOURCES.forEach((r) => { this.tradeOffer[r] = Math.min(this.tradeOffer[r], player.resources[r]); });
    const hint = document.querySelector("#tradeHint");
    const keep = hint?.classList.contains("ok") ? hint.textContent : null;
    this._refreshTradeGrids();
    if (keep) this._tradeHint(keep, "ok");
  }

  /** A player's answer to your open offer ("yes" | "no" | "counter" | ""), also shown on the top strip. */
  _tradeVerdict(id) {
    const ans = this._tradeAnswers;
    const a = ans?.responses.find((x) => x.player.id === id);
    return !a ? "" : a.accepts ? "yes" : ans.counter?.player.id === id ? "counter" : "no";
  }

  /** Mirror the answers on the top player strip (the sheet leaves it visible). */
  _markStripAnswers() {
    document.querySelectorAll(".pstrip .pchip[data-seat]").forEach((c) => {
      const v = this._tradeVerdict(Number(c.dataset.seat));
      if (v) c.dataset.trade = v; else delete c.dataset.trade;
    });
  }

  /** "4 [Lumber] → 1 [Ore]" for the route buttons. */
  _tradeDealHtml(give, get) {
    const side = (res) => RESOURCES.filter((r) => res[r] > 0).map((r) => `<span class="rd">${res[r]}${icon(r)}</span>`).join("");
    return `${side(give)}<span class="ar">→</span>${side(get)}`;
  }

  updateTradeButtons() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman) return;
    const offerTotal = sumResources(this.tradeOffer);
    const requestTotal = sumResources(this.tradeRequest);
    // Route 1: the bank (or your harbour)
    const plan = this._bankPlan(player);
    this._bankPlanNow = plan.k ? plan : null;
    if (this.tradeExecuteBtn) {
      const ok = !!plan.k;
      this.tradeExecuteBtn.disabled = !ok;
      const where = plan.rate < 4 ? `Harbour ${plan.rate}:1` : "Trade with bank";
      this.tradeExecuteBtn.classList.toggle("ready", ok);
      const giveRes = makeEmptyResources();
      if (plan.give) giveRes[plan.give] = plan.n;
      const top = ok ? this._tradeDealHtml(giveRes, this.tradeRequest) : "Bank";
      const sub = ok ? where : plan.why;
      this.tradeExecuteBtn.innerHTML = `${icon("bank")}<span class="rt"><b>${top}</b><small>${sub}</small></span>`;
      this.tradeExecuteBtn.setAttribute("aria-label", ok
        ? `Trade ${plan.n} ${RESOURCE_LABEL[plan.give]} → ${RESOURCES.filter((r) => this.tradeRequest[r] > 0).map((r) => `${this.tradeRequest[r]} ${RESOURCE_LABEL[r]}`).join(" + ")} with the ${plan.rate < 4 ? "harbour" : "bank"}`
        : `Bank: ${plan.why}`);
    }
    // Route 2: offer to the players
    const askKey = JSON.stringify([this.tradeOffer, this.tradeRequest]);
    const askedSame = this._tradeAsked === askKey;
    const hs = this.hotseat; // pass & play: Offer asks the bots; people are asked one by one (Ask)
    const n = this.players.filter((p) => p.id !== player.id && !(hs && p.isHuman)).length;
    const who = (k) => (hs ? `${k} bot${k === 1 ? "" : "s"}` : `${k} player${k === 1 ? "" : "s"}`);
    if (this.tradeProposalBtn) {
      this.tradeProposalBtn.disabled = !(offerTotal > 0 && requestTotal > 0) || askedSame || n === 0;
      // sent: a calm outline button (green stays for ✓ accept only)
      this.tradeProposalBtn.classList.toggle("primary", !askedSame);
      this.tradeProposalBtn.classList.toggle("sent", askedSame);
      const sub = askedSame ? "edit to ask again" : !offerTotal ? "pick what you give" : !requestTotal ? "pick what you get" : n === 0 ? "no bots · tap Ask" : `to ${who(n)}`;
      this.tradeProposalBtn.innerHTML = `${icon("trade")}<span class="rt"><b>${askedSame ? "Offer sent" : "Offer"}</b><small>${sub}</small></span>`;
      this.tradeProposalBtn.setAttribute("aria-label", askedSame ? "Offered to the players · change your offer to ask again" : `Offer to the players${offerTotal && requestTotal ? "" : `: ${sub}`}`);
    }
    const hint = document.querySelector("#tradeHint");
    if (!hint?.classList.contains("ok")) this._tradeHint("");
  }

  /** Bank / harbour route: your rate × each card you get, in one tap. */
  handleHumanBankTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main" || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return;
    const plan = this._bankPlan(player);
    if (!plan.k) {
      if (plan.why) this._tradeHint(`Bank: ${plan.why}.`);
      this.sfx.error();
      return;
    }
    const gets = RESOURCES.filter((r) => this.tradeRequest[r] > 0);
    const giveRes = makeEmptyResources();
    const getRes = makeEmptyResources();
    let ok = true;
    for (const r of gets) {
      for (let i = 0; i < this.tradeRequest[r]; i += 1) {
        if (!this.performBankTrade(player, plan.give, r)) { ok = false; break; }
        giveRes[plan.give] += plan.rate;
        getRes[r] += 1;
      }
      if (!ok) break;
    }
    if (sumResources(getRes) > 0) {
      // the "You get" tile the player tapped is where the new card flies from
      const src = this.tradeRequestGrid?.querySelector(`[data-res="${gets[0]}"]`)?.getBoundingClientRect();
      this.tradeOffer = makeEmptyResources();
      this.tradeRequest = makeEmptyResources();
      this._clearTradeAnswers();
      const msg = `Traded ${giveRes[plan.give]} ${RESOURCE_LABEL[plan.give]} → ${resourceString(getRes)}`;
      this._tradeHint(`✓ ${msg}`, "ok");
      this._refreshTradeGrids();
      this._tradeHint(`✓ ${msg}`, "ok");
      this._animateTradeCards(giveRes, getRes, src ? { getBoundingClientRect: () => src } : null);
      this.sfx.trade();
      this._dropUndo();
      // Done unless another bank trade is possible ("trade again" stays open)
      if (!RESOURCES.some((r) => player.resources[r] >= this.getPlayerTradeRate(player, r))) this.closeTradeModal();
    } else {
      this._tradeHint("That trade is not possible right now.");
      this.sfx.error();
    }
    this.render();
  }

  // A player trade is only valid on the proposer's own main phase, in the same turn it was
  // proposed, with nothing blocking and both sides still holding the cards.
  _playerTradeStillValid(proposer, turnSerial, partner, proposerGives, partnerGives) {
    return !this.winner && this.phase === "main" && this.currentPlayer === proposer
      && this.turnSerial === turnSerial && !this._robberInProgress()
      && hasResources(proposer.resources, proposerGives) && hasResources(partner.resources, partnerGives);
  }

  /** Footer "Offer" button: ask every player at once. */
  _onTradeProposalBtn() {
    this.handleHumanPlayerTrade();
  }

  /** Swap cards between two players (a gives aGives, b gives bGives). */
  _swapCards(a, aGives, b, bGives) {
    RESOURCES.forEach((r) => {
      a.resources[r] += (bGives[r] || 0) - (aGives[r] || 0);
      b.resources[r] += (aGives[r] || 0) - (bGives[r] || 0);
    });
  }

  /** Swap with a player who said yes (or whose counter-offer you accepted). */
  _executePlayerTrade(partner, gave, got) {
    const player = this.currentPlayer;
    const ans = this._tradeAnswers;
    if (!player?.isHuman || !partner) return;
    if (!this._playerTradeStillValid(player, ans ? ans.turnSerial : this.turnSerial, partner, gave, got)) {
      this._clearTradeAnswers();
      this._refreshTradeGrids();
      this._tradeHint("Trade no longer valid.");
      return;
    }
    const src = document.querySelector(`#tradePlayerRow [data-partner="${partner.id}"]`)?.getBoundingClientRect();
    this._swapCards(player, gave, partner, got);
    this.addLog(`Traded with ${partner.name}: gave ${resourceString(gave)} for ${resourceString(got)}.`);
    this.sfx.trade();
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this._clearTradeAnswers();
    const msg = `✓ Traded with ${partner.name}: ${resourceString(gave)} → ${resourceString(got)}`;
    this._tradeHint(msg, "ok");
    this._refreshTradeGrids();
    this._tradeHint(msg, "ok");
    this.render();
    this._animateTradeCards(gave, got, src ? { getBoundingClientRect: () => src } : null);
  }

  handleHumanPlayerTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.phase !== "main" || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */) return;
    // Snapshot the offer — the picks may change before the player taps a ✓
    const offer = copyResources(this.tradeOffer);
    const request = copyResources(this.tradeRequest);
    // a refusal shows in the footer hint (and the result line, for screen readers)
    const refuse = (msg) => { this._tradeHint(msg); if (this.tradeProposalResult) this.tradeProposalResult.textContent = msg; };
    if (sumResources(offer) === 0 || sumResources(request) === 0) { refuse("Select resources to give and get."); return; }
    if (RESOURCES.some((r) => offer[r] > 0 && request[r] > 0)) { refuse("Can't give and get the same resource."); return; }
    const short = RESOURCES.find((r) => player.resources[r] < offer[r]);
    if (short) { refuse(`Not enough ${RESOURCE_LABEL[short]}.`); return; }
    // Propose to all players — collect responses
    const responses = [];
    for (const other of this.players) {
      if (other.id === player.id || other.isHuman) continue;
      responses.push({ player: other, accepts: this.aiEvaluateTrade(other, offer, request) });
    }
    const acceptors = responses.filter((r) => r.accepts).map((r) => r.player);
    // Nobody says yes: one bot may come back with a counter-offer
    const counter = acceptors.length ? null : this._generateCounterOffer(player, offer, request);
    if (!acceptors.length) this.addLog(counter ? `${counter.player.name} made a counter-offer.` : "All players rejected your trade offer.");
    // v0.82: never trade on the Offer tap, also when exactly one bot says yes — its ✓ / Trade on the portrait waits
    // for your one tap (the sheet stays open until then)
    this._tradeAnswers = { offer, request, responses, counter, turnSerial: this.turnSerial };
    this._tradeAsked = JSON.stringify([offer, request]);
    const res = this.tradeProposalResult;
    if (res) {
      // A counter-offer: what you'd give and get, with one-tap ✓ / ✗
      res.innerHTML = counter ? `<div class="tcounter pc-${counter.player.id}">${this._av(counter.player)}
          <div class="tc-body"><span class="who pc-${counter.player.id}">${counter.player.name}</span> counters:
            <span class="tc-deal"><span class="give">You give</span> ${this._offerSide(counter.want, player)} <span class="get">You get</span> ${this._offerSide(counter.give)}</span></div>
          <button type="button" class="tc-no" data-counter-no aria-label="Decline ${counter.player.name}'s counter-offer">${icon("close")}</button>
          <button type="button" class="tc-yes" data-partner="${counter.player.id}" data-counter="1" aria-label="Accept ${counter.player.name}'s counter-offer">${icon("check")}</button>
        </div>` : "";
      res.querySelector("[data-counter]")?.addEventListener("click", () => this._executePlayerTrade(counter.player, counter.want, counter.give));
      res.querySelector("[data-counter-no]")?.addEventListener("click", () => {
        this.addLog(`You declined ${counter.player.name}'s counter-offer.`);
        if (this._tradeAnswers) this._tradeAnswers.counter = null;
        res.innerHTML = "";
        this._renderTradePlayers(player);
      });
    }
    this._refreshTradeGrids();
    if (!acceptors.length && !counter) this._tradeHint("No one wants this trade. Change it and offer again.");
    // the answers sit above the footer: bring them into view
    window.requestAnimationFrame(() => document.querySelector("#tradePlayers")?.scrollIntoView?.({ block: "nearest", behavior: motionReduced() ? "auto" : "smooth" }));
  }

  /** "1 [Grain] Grain (have 1)" chips for an offer side. */
  _offerSide(cards, mine = null) {
    return RESOURCES.filter((r) => cards[r] > 0).map((r) =>
      `<span class="oc ${r}"><b>${cards[r]}</b><span class="ocard card" data-card="${r}">${cardSvg(r)}</span><span class="on">${RESOURCE_LABEL[r]}</span>${mine ? ` <small class="${mine.resources[r] >= cards[r] ? "" : "short"}">(have ${mine.resources[r]})</small>` : ""}</span>`).join('<span class="plus">+</span>');
  }

  // ── AI Trade Evaluation ─────────────────────────────────────────────

  // Would this bot accept: it receives `theyGive`, hands over `theyWant`, from `proposer`?
  // Rules (balanced/aggressive only): never help a public leader near the win; cards received must be
  // >= cards given, except a 2-for-1 that completes a build right now and beats the bank; and the
  // trade must clearly improve its own plan (best build value per expected turn).
  aiEvaluateTrade(aiPlayer, theyGive, theyWant, proposer = this.currentPlayer) {
    return this._aiTradeVerdict(aiPlayer, theyGive, theyWant, proposer).ok;
  }

  // The bot's verdict on a deal: { ok, why, before, after } (plan scores before / after the swap).
  _aiTradeVerdict(aiPlayer, theyGive, theyWant, proposer = this.currentPlayer) {
    const no = (why, extra = {}) => ({ ok: false, why, ...extra });
    const strat = this._aiStrat(aiPlayer);
    if (strat.trading === "none" || strat.trading === "conservative") return no("doesn't deal with players");
    if (RESOURCES.some((r) => aiPlayer.resources[r] < (theyWant[r] || 0))) return no("doesn't have the cards");
    if (RESOURCES.some((r) => (theyWant[r] || 0) > 0 && (theyGive[r] || 0) > 0)) return no("same card both ways");
    const given = sumResources(theyWant);
    const got = sumResources(theyGive);
    if (!given || !got) return no("empty deal");
    if (proposer && proposer.id !== aiPlayer.id && this._aiHelpsLeader(proposer)) return no("won't help the leader");
    // Advanced awareness: no deals with anyone clearly ahead of it
    if (strat.awareness === "advanced" && proposer && proposer.id !== aiPlayer.id
      && proposer.publicVictoryPoints >= aiPlayer.publicVictoryPoints + 2) return no("proposer is ahead");

    const plan = this._aiPlan(aiPlayer);
    if (!plan.goals.length) return no("nothing to build");
    const after = copyResources(aiPlayer.resources);
    RESOURCES.forEach((r) => { after[r] += (theyGive[r] || 0) - (theyWant[r] || 0); });
    if (got < given) {
      if (given - got > 1) return no("too lopsided");
      const completes = plan.goals.some((g) => !hasResources(aiPlayer.resources, this._aiStepCost(g))
        && hasResources(after, this._aiStepCost(g)));
      const cheapestRate = Math.min(...RESOURCES.filter((r) => theyWant[r] > 0).map((r) => (plan.rates ? plan.rates[r] : 4)));
      if (!completes || given >= cheapestRate) return no("not worth more cards");
    }
    const before = this._aiBestScore(plan, aiPlayer.resources);
    const afterScore = this._aiBestScore(plan, after);
    const margin = (strat.trading === "aggressive" ? 0.03 : 0.08) * (strat.w?.margin ?? 1);
    const ok = afterScore > before * (1 + margin) + 1e-6;
    return { ok, why: ok ? "brings its plan closer" : "gain too small", before, after: afterScore };
  }

  // A public leader close to winning (visible VP only): bots won't trade with them.
  _aiHelpsLeader(partner) {
    const pv = partner.publicVictoryPoints;
    if (pv >= this.winPoints - 2) return true;
    const top = Math.max(...this.players.map((p) => p.publicVictoryPoints));
    return pv >= Math.round(this.winPoints * 0.7) && pv >= top;
  }

  // Generate a counter-offer: "I'll give you what you want, but I need X from you instead"
  _generateCounterOffer(humanPlayer, humanOffer, humanRequest) {
    const requestedRes = RESOURCES.filter(r => humanRequest[r] > 0);
    if (!requestedRes.length || this._aiHelpsLeader(humanPlayer)) return null;
    const offeredRes = RESOURCES.filter(r => humanOffer[r] > 0);

    for (const ai of this.players) {
      if (ai.isHuman || ai.id === humanPlayer.id) continue;
      const strat = this._aiStrat(ai).trading;
      if (strat === "none" || strat === "conservative") continue;
      if (ai.resources[requestedRes[0]] < 1) continue;
      // What the bot's plan is short of (and not what the human already offered or asked for)
      const goal = this._aiPlan(ai).goals[0];
      if (!goal) continue;
      const newNeeds = RESOURCES.filter((r) => (goal.cost[r] || 0) > ai.resources[r]
        && !offeredRes.includes(r) && !requestedRes.includes(r) && humanPlayer.resources[r] > 0);
      for (const need of newNeeds) {
        const want = makeEmptyResources();
        want[need] = 1;
        const give = makeEmptyResources();
        give[requestedRes[0]] = 1;
        // Only counter with a deal the bot itself would accept
        if (this.aiEvaluateTrade(ai, want, give, humanPlayer)) return { player: ai, give, want };
      }
    }
    return null;
  }

  // AI proposes trades during its turn: 1-for-1 of a spare card for one its plan is short of
  // (aggressive bots also try 2-for-1 when that finishes a build now). Partners are picked from
  // public information only (estimated hands), never from looking at hidden cards.
  aiTryPlayerTrade(aiPlayer, opts = {}) {
    const log = this._aiRec() ? { offers: [] } : null;
    const res = this._aiTryPlayerTrade(aiPlayer, opts, log);
    if (log && log.offers.length) this._aiNoteTrade(aiPlayer, log, res);
    return res;
  }

  _aiTryPlayerTrade(aiPlayer, { botsOnly = false } = {}, log = null) {
    const strat = this._aiStrat(aiPlayer).trading;
    if (strat === "none" || strat === "conservative") return null;
    const plan = this._aiPlan(aiPlayer);
    const goal = plan.goals[0];
    if (!goal || goal.eta === 0) return null;
    const hand = aiPlayer.resources;
    if (log) { log.plan = plan; log.hand = copyResources(hand); }
    const cost = goal.cost;
    const second = plan.goals[1]?.cost || {};
    const short = (r) => (cost[r] || 0) - hand[r];
    const needs = RESOURCES.filter((r) => short(r) > 0)
      .sort((a, b) => short(b) / (plan.incTurn[b] + 0.05) - short(a) / (plan.incTurn[a] + 0.05));
    const spare = (r) => hand[r] - (cost[r] || 0);
    const surplus = RESOURCES.filter((r) => spare(r) > 0)
      .sort((a, b) => (spare(b) - (second[b] || 0) * 0.5) - (spare(a) - (second[a] || 0) * 0.5));
    if (!needs.length || !surplus.length) return null;
    const offers = [];
    for (const wanted of needs) {
      for (const giving of surplus) {
        if (giving === wanted) continue;
        const offer = makeEmptyResources();
        const request = makeEmptyResources();
        offer[giving] = 1;
        request[wanted] = 1;
        offers.push({ offer, request });
        if (strat === "aggressive" && spare(giving) >= 2) {
          const after = copyResources(hand);
          after[giving] -= 2;
          after[wanted] += 1;
          if (hasResources(after, this._aiStepCost(goal))) {
            const offer2 = makeEmptyResources();
            offer2[giving] = 2;
            offers.push({ offer: offer2, request });
          }
        }
      }
    }
    const maxOffers = strat === "aggressive" ? 6 : 2;
    const partners = this.players.filter((p) => p.id !== aiPlayer.id && !this._aiHelpsLeader(p))
      .sort((a, b) => a.publicVictoryPoints - b.publicVictoryPoints);
    for (const { offer, request } of offers.slice(0, maxOffers)) {
      const after = copyResources(hand);
      RESOURCES.forEach((r) => { after[r] += request[r] - offer[r]; });
      const eta = this._aiEta(cost, after, plan.incTurn, plan.rates);
      const entry = log ? { give: offer, get: request, goal: goal.label, eta0: goal.eta, eta, answers: [] } : null;
      if (entry) log.offers.push(entry);
      if (eta > goal.eta - (strat === "aggressive" ? 0.1 : 0.25)) { if (entry) entry.skip = true; continue; }
      const wanted = RESOURCES.find((r) => request[r] > 0);
      for (const other of partners) {
        if (this._isInteractive(other)) {
          // Never put an offer in front of the human that they can't pay: the game checks the real hand
          if (botsOnly || !hasResources(other.resources, request)) continue;
          // Show incoming trade popup to human — handled async (during autoplay the human seat is a bot)
          if (entry) entry.answers.push({ pid: other.id, ok: null, why: this.hotseat ? `asked ${other.name}` : "asked you" });
          return { type: "human", fromPlayer: aiPlayer, give: offer, want: request, toPlayer: other };
        }
        if (this._aiEstimate(other)[wanted] < 0.5) continue; // probably doesn't hold it (public estimate)
        const verdict = this._aiTradeVerdict(other, offer, request, aiPlayer);
        if (entry) entry.answers.push({ pid: other.id, ok: verdict.ok, why: verdict.why, before: verdict.before, after: verdict.after });
        if (verdict.ok) {
          this._aiTrkNote(aiPlayer, offer, -1);
          this._aiTrkNote(aiPlayer, request, 1);
          this._aiTrkNote(other, request, -1);
          this._aiTrkNote(other, offer, 1);
          this._stTrade(aiPlayer, other, offer, request);
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

  /**
   * A bot offers the human a trade (Classic, during the bot's turn). Shown as the same calm,
   * non-blocking card as in Rush — board and hand stay usable — and declined automatically
   * after 15 s (a thin bar shows the time left).
   */
  showIncomingTrade(fromPlayer, give, want, to = this._me()) {
    return new Promise((resolve) => {
      // pass & play, one person asks another: the cover hands over the phone even if they can't pay
      // (the ✓ is then disabled), so the answer never gives their hand away
      const ask = !!(fromPlayer?.isHuman && to?.isHuman);
      if (ask ? !hasResources(fromPlayer.resources, give) : !this._offerPossible(fromPlayer, give, want, to)) { resolve(false); return; }
      this._offerSeq = (this._offerSeq || 0) + 1;
      const id = this._offerSeq;
      this.pendingIncomingTrade = { fromPlayer, to, give, want, resolve, id, ask, ms: CLASSIC_OFFER_MS };
      // pass & play: no time limit (the phone first has to reach the right person)
      if (!this.hotseat) this._later(() => {
        if (this.pendingIncomingTrade?.id !== id) return;
        this.addLog(`${fromPlayer.name}'s offer expired.`);
        this.resolveIncomingTrade(false, true);
      }, CLASSIC_OFFER_MS);
      if (this.hotseat) this.render(); // pass & play: the cover hands the phone to the receiver first
      else this._renderRushOffers();
    });
  }

  resolveIncomingTrade(accepted, expired = false) {
    if (!this.pendingIncomingTrade) return;
    const { fromPlayer, give, want, resolve } = this.pendingIncomingTrade;
    const human = this.pendingIncomingTrade.to || this._me();
    if (accepted && human && !(hasResources(human.resources, want) && hasResources(fromPlayer.resources, give))) {
      accepted = false;
      this.addLog(`Trade with ${fromPlayer.name} is no longer possible.`);
    } else if (accepted && human) {
      this._animateTradeCards(want, give, this._offerCardEl());
      // AI gives 'give' to human, human gives 'want' to AI
      this._stTrade(fromPlayer, human, give, want);
      RESOURCES.forEach((r) => {
        human.resources[r] -= want[r];
        human.resources[r] += give[r];
        fromPlayer.resources[r] -= give[r];
        fromPlayer.resources[r] += want[r];
      });
      this.addLog(this._you(human) ? `You accepted ${fromPlayer.name}'s trade: got ${resourceString(give)} for ${resourceString(want)}.`
        : `${human.name} traded with ${fromPlayer.name}: got ${resourceString(give)} for ${resourceString(want)}.`);
      this.sfx.trade();
    } else if (!expired) {
      this.addLog(this._you(human) ? `You rejected ${fromPlayer.name}'s trade offer.` : `${human.name} declined ${fromPlayer.name}'s offer.`);
    }
    this.pendingIncomingTrade = null;
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    this._renderRushOffers();
    this.render();
    resolve(accepted);
  }

  canBuildRoad(player, edgeId, options = {}) {
    if (this.sea) return this.sea.canBuildRoad(player, edgeId, options, hasResources(player.resources, COSTS.road)); // ⚓
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
    if (this.sea && (!this.sea.nodeIsLand(nodeId) || (setup && this.sea.islandOfNode(nodeId) !== 0))) return false; // ⚓ land only; set-up on the main island
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
    return this.geometry.edges.some((edge) => this.canBuildRoad(player, edge.id, { free }) || this.canBuildShip(player, edge.id, { free })); // ⚓ or a ship
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
    if (this.phase === "sbp") return false; // Special Building Phase: no maritime trade either
    const rate = this.getPlayerTradeRate(player, give);
    if (give === get || player.resources[give] < rate || this.bank[get] < 1) return false;
    this._aiTrkNote(player, { [give]: rate }, -1);
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
      // Bots probe this every turn: keep it out of the player-visible ticker/journal
      if (player.isHuman) this.addLog(`${player.name} cannot afford a development card.`);
      else this._aiLog(player, "Cannot afford a development card.");
      return false;
    }
    this.payToBank(player, COSTS.development);
    const card = this.devDeck.pop();
    if (card === "victoryPoint") {
      player.devVictoryPoints += 1;
      if (player.isHuman) {
        this.addLog(this._you(player) ? `You drew a Victory Point card (kept secret).` : `${player.name} bought a development card.`);
        this._devDrawn("victoryPoint");
      } else {
        this.addLog(`${player.name} bought a development card.`);
      }
    } else {
      player.newDevCards[card] += 1;
      const cardLabels = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
      if (player.isHuman) {
        this.addLog(this._you(player) ? `You drew: ${cardLabels[card]}!` : `${player.name} bought a development card.`);
        this._devDrawn(card);
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

  /** A bought card flies from the Buy button into your hand; the ticker names it. Nothing else. */
  _devDrawn(type) {
    const from = this._buyFrom && this._buyFrom.isConnected ? this._buyFrom.getBoundingClientRect() : null;
    this._buyFrom = null;
    this._newDevPulse = type;
    const fresh = this.isRush() ? "playable after the next roll" : "play it next turn";
    this._flashPrompt(type === "victoryPoint" ? "You drew a Victory Point (secret, counts at once)" : `You drew ${DEV_NAME[type]} · ${fresh}`, 3200);
    window.clearTimeout(this._newDevTimer);
    this._newDevTimer = window.setTimeout(() => { this._newDevPulse = null; this.renderResourceCards(); }, 1800);
    window.requestAnimationFrame(() => this.fx?.devToHand?.(type, from));
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
    if (this._robberInProgress() || this.pendingIncomingTrade || this.freeRoadsRemaining > 0 || this.devPick) return false;
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
        this.freeRoadsRemaining = Math.min(2, this.piecesLeft(player, "road") + (this.sea ? this.sea.shipsLeft(player) : 0)); // ⚓ roads or ships
        this.pendingAction = "road";
        this.addLog(`${player.name} played Road Building — place 2 free ${this.sea ? "roads or ships" : "roads"}.`);
        this.render();
        return true; // Don't call recomputeScores yet, will be called after placement
      }
      let built = 0;
      for (let i = 0; i < 2; i += 1) {
        if (this.sea) { // ⚓ Seafarers: 2 roads, 2 ships or one of each (rulebook p. 5 §8)
          const pc = this.sea.aiFreePiece(player);
          if (!pc) break;
          if (pc.type === "ship" ? this.sea.placeShip(player, pc.id, { free: true }) : this.placeRoad(player, pc.id, { free: true })) built += 1;
          continue;
        }
        const edgeId = this.chooseStrategicRoadEdge(player, true);
        if (edgeId == null) break;
        if (this.placeRoad(player, edgeId, { free: true })) built += 1;
      }
      this.addLog(`${player.name} played Road Building and placed ${built} ${this.sea ? "piece" : "road"}(s).`);
    } else if (type === "yearOfPlenty") {
      if (this._isInteractive(player)) {
        // Can only take what the bank actually has: pick in the dock (no popup)
        const count = Math.min(2, sumResources(this.bank));
        this.devPick = { type: "yearOfPlenty", count, picks: [] };
        this.render();
        return true;
      }
      const picks = this.chooseYearOfPlentyResources(player);
      const gained = picks.filter((resource) => this.takeFromBank(player, resource, 1) > 0);
      this.addLog(`${player.name} played Year of Plenty: ${this._plusList(gained)}.`);
    } else if (type === "monopoly") {
      if (this._isInteractive(player)) {
        this.devPick = { type: "monopoly", count: 1, picks: [] };
        this.render();
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
      this._aiTrkMonopoly(player, target, collected);
      this.addLog(`${player.name} played Monopoly: +${collected} ${RESOURCE_LABEL[target]}.`);
    }

    this.recomputeScores();
    return true;
  }

  // Year of Plenty: the cards its planned build is short of (then the next build's), bank permitting
  chooseYearOfPlentyResources(player) {
    const bank = copyResources(this.bank);
    const picks = [];
    const take = (resource) => {
      if (picks.length < 2 && bank[resource] > 0) {
        bank[resource] -= 1;
        picks.push(resource);
      }
    };
    const hand = copyResources(player.resources);
    const goals = this._aiPlan(player).goals;
    for (const goal of goals.slice(0, 2)) {
      RESOURCES.forEach((r) => {
        for (let k = hand[r]; k < (goal.cost[r] || 0) && picks.length < 2; k += 1) { take(r); hand[r] += 1; }
      });
    }
    ["wheat", "ore", ...RESOURCES].forEach(take);
    return picks;
  }

  // Monopoly target from public card-count estimates, valued by need: cards its plan is short of
  // count fully, extra cards count as what they would fetch at its bank/port rate.
  _aiMonopolyPick(player) {
    const plan = this._aiPlan(player);
    const goal = plan.goals[0];
    let best = { resource: "wheat", count: 0, value: Number.NEGATIVE_INFINITY };
    RESOURCES.forEach((r) => {
      const count = this.players.reduce((acc, other) => (other.id === player.id ? acc : acc + this._aiEstimate(other)[r]), 0);
      const short = goal ? Math.max(0, (goal.cost[r] || 0) - player.resources[r]) : 0;
      const rate = plan.rates ? plan.rates[r] : 4;
      const value = Math.min(count, short) + Math.max(0, count - short) / rate * 1.5;
      if (value > best.value) best = { resource: r, count, value, short };
    });
    return best;
  }

  chooseBestMonopolyResource(player) {
    return this._aiMonopolyPick(player).resource;
  }

  autoPlayCurrentTurn() {
    // Never roll during setup, and never act while a roll/robber/trade flow is still in flight
    if (this.winner || this.setupPhase || this.isRush()) return; // Rush bots run on their own ticks
    if (this._aiDiceAnimating || this.robberBusy || this.pendingDiscard || this.pendingIncomingTrade) return;
    if (this._aiHeld() || this.analysis?.parked) return; // analysis mode: bots wait for Step / Resume
    if (this.phase === "sbp") { this._sbpRun(); return; } // build phase between turns (bots, or you while watching)
    const player = this.currentPlayer;
    if (this.phase === "pre_roll") {
      if (this._robberInProgress()) return; // human placing robber from a pre-roll Knight
      this.maybePlayKnightBeforeRoll(player);
      if (this._aiHeld()) { this.render(); return; } // analysis mode: the knight was this step; roll on the next one
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
          robberDone.then(this._guard(() => this._later(() => this._aiGate(() => {
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
          }), actionDelay)));
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
    // The turn runs as a chain of steps: a dev card, one player trade, then up to 10 build/trade actions
    // (aggressive traders deal with the other bots up to 2 more times). Each step is one decision, so
    // analysis mode can hold the bot between them (Pause / Step); otherwise the chain runs straight through.
    let stage = 0;
    let actions = 0;
    let deals = 0;
    let humanTrade = null;
    const actionFns = this._getActionPriority(player);
    const aggressive = this._aiStrat(player).trading === "aggressive";
    const tick = () => {
      if (stage === 0) {
        stage = 1;
        if (!this.winner && this.maybePlayBestDevCard(player)) return "more";
      }
      if (stage === 1) {
        stage = 2;
        // Try player-to-player trade once per turn
        if (!skipPlayerTrade) {
          const seq0 = this.analysis?.seq;
          const tradeResult = this.aiTryPlayerTrade(player);
          if (tradeResult && tradeResult.type === "human") { humanTrade = tradeResult; return "human"; }
          if (tradeResult) return "more";
          // v0.83 analysis mode: a trade that found no deal is a decision too: hold before the next one
          if (this._aiHeld() && this.analysis.seq !== seq0) return "more";
        }
      }
      if (this.winner) return "end";
      if (actions < 10) {
        for (const fn of actionFns) {
          if (fn()) { actions++; return "more"; }
        }
      }
      // Aggressive traders keep dealing with the other bots after building (up to 2 more deals)
      if (aggressive && deals < 2) {
        deals += 1;
        if (this.aiTryPlayerTrade(player, { botsOnly: true })?.type === "done") return "more";
      }
      return "end";
    };
    let sync = true;
    let result = null;
    const finish = () => {
      if (this._aiRec() && !this.winner) this._aiNoteEnd(player);
      this.recomputeScores();
      this.checkForWinner(player);
      if (sync) result = "done";
      else this._aiMainPhaseDone(player);
    };
    const drive = () => {
      for (;;) {
        // v0.83 analysis mode: every decision waits while held — also the first one after you answered a
        // bot's offer (the turn restarts here and used to take one decision past Pause / Step)
        if (this._aiHeld() && !this.winner) { this._aiPark(drive); return; }
        const r = tick();
        if (r === "human") {
          // Need async human response — pause AI turn, show popup
          this._pendingAiTradePlayer = player;
          this.showIncomingTrade(humanTrade.fromPlayer, humanTrade.give, humanTrade.want, humanTrade.toPlayer).then(this._guard(() => {
            // Resume AI turn after human responds
            if (this.winner || this.currentPlayer !== player) return;
            if (this.executeAiMainPhase(player, true) === "async") return;
            this._aiMainPhaseDone(player);
          }));
          return;
        }
        if (r === "end") {
          // v0.83 analysis mode: "Ends turn" is a decision of its own; while held it waits for the next Step
          if (this._aiHeld() && !this.winner) { this._aiPark(finish); return; }
          finish();
          return;
        }
        if (this._aiHeld()) { this._aiPark(drive); return; }
      }
    };
    drive();
    sync = false;
    return result || "async";
  }

  // A bot's main phase that finished later (after a human trade answer, or after analysis-mode steps)
  _aiMainPhaseDone(player) {
    if (this.winner || this.currentPlayer !== player) { this.render(); return; }
    this.endTurn();
    this.saveToStorage();
    this.render();
    if (!this.winner && !this.currentPlayer.isHuman) this.scheduleAiTurnsUntilHuman();
  }

  _aiLog(player, msg) {
    if (this.aiDebugLog) this.addLog(`[${player.name}] ${msg}`);
  }

  // Ordered action functions; each returns true when it did something. Rush calls them one per tick.
  // expansion "simple": fixed order (whatever it can afford first). Otherwise one planned step at a time.
  _getActionPriority(player) {
    const s = this._aiStrat(player);
    if (s.expansion !== "simple") return [() => this._aiPlannedStep(player)];
    const dev = () => s.devCards !== "none" && this.devDeck.length > 0
      && hasResources(player.resources, COSTS.development) && this.buyDevelopmentCard(player);
    // analysis mode: note what each fixed-order action looked at when it acts
    const rec = (kind, fn) => () => {
      if (!this._aiRec()) return fn();
      const snap = this._aiSimpleSnap(player, kind);
      const ok = fn();
      if (ok) this._aiNoteSimple(player, kind, snap);
      return ok;
    };
    return [
      rec("settlement", () => this.tryBuildSettlement(player)),
      rec("city", () => this.tryBuildCity(player)),
      rec("road", () => this.tryBuildRoad(player)),
      rec("ship", () => (this.sea ? this.sea.aiSimpleShip(player) : false)), // ⚓
      rec("dev", dev),
      rec("bank", () => this.tryTradeForGoal(player)),
    ];
  }

  maybePlayBestDevCard(player) {
    const strat = player.strategy?.devCards || "reactive";
    if (strat === "none") return false;
    if ((this.isRush() ? player.rushDevPlayed : this.currentTurnPlayedDevCard) || this.phase !== "main") return false;

    const play = (type, reason = null) => {
      const why = this._aiRec() ? (reason ?? this._aiDevReason(player, type)) : null; // analysis: read before the card changes things
      const ok = this.playDevelopmentCard(player, type);
      if (ok && why != null) this._aiNoteDev(player, type, why);
      return ok;
    };
    const knightWhy = player.devCards.knight > 0 ? this._aiKnightReason(player) : null;
    if (knightWhy != null) {
      return play("knight", knightWhy);
    }
    if (player.devCards.monopoly > 0 && this.shouldPlayMonopoly(player)) {
      return play("monopoly");
    }
    if (player.devCards.yearOfPlenty > 0 && this.shouldPlayYearOfPlenty(player)) {
      return play("yearOfPlenty");
    }
    if (player.devCards.roadBuilding > 0 && this.shouldPlayRoadBuilding(player)) {
      return play("roadBuilding");
    }
    return false;
  }

  shouldPlayKnight(player) {
    return this._aiKnightReason(player) != null;
  }

  // Why a knight is worth playing now (null: hold it). The text is shown by analysis mode.
  _aiKnightReason(player) {
    const strat = this._aiStrat(player).devCards;
    const badRobber = this.geometry.hexes[this.robberHexId].nodes.some((nodeId) => {
      const node = this.geometry.nodes[nodeId];
      return node.owner === player.id;
    });
    if (badRobber) return "The robber blocks its own tile";

    // Playing this knight would claim Largest Army
    const armyHolder = this.largestArmyHolder;
    const holderKnights = armyHolder != null ? this.players[armyHolder].knightsPlayed : 2;
    if (armyHolder !== player.id && player.knightsPlayed + 1 > holderKnights) return "Claims Largest Army (+2)";
    if (strat === "strategic") {
      // Strategic: keep a lead in the army race (or build toward it), else hold the knight in reserve
      const rival = Math.max(0, ...this.players.filter((p) => p.id !== player.id).map((p) => p.knightsPlayed));
      if (armyHolder === player.id) return rival >= player.knightsPlayed - 1 ? "Keeps its Largest Army lead" : null;
      if (player.knightsPlayed + 2 >= holderKnights) return "Builds toward Largest Army";
    }

    // Otherwise only worth it to block a high-yield hex of the (publicly) leading opponent
    const target = this.chooseRobberHex(player);
    if (target === this.robberHexId) return null;
    const hex = this.geometry.hexes[target];
    if (!hex.number || DICE_WEIGHT[hex.number] < 4) return null;
    const leader = this.players
      .filter((p) => p.id !== player.id)
      .sort((a, b) => b.publicVictoryPoints - a.publicVictoryPoints)[0];
    if (!leader || leader.publicVictoryPoints < player.publicVictoryPoints) return null;
    return hex.nodes.some((nodeId) => this.geometry.nodes[nodeId].owner === leader.id) ? `Blocks the leader's ${hex.number}` : null;
  }

  // AI: play a Knight before rolling when the robber is sitting on one of our hexes.
  // Strategic bots also play a knight they would play anyway this turn before rolling (the stolen card
  // can combine with this roll), unless they hold a progress card to play after the roll.
  maybePlayKnightBeforeRoll(player) {
    if (player.isHuman && !this.autoplayInterval) return false;
    const strat = this._aiStrat(player).devCards;
    if (strat === "none") return false;
    if (!this.canPlayDevelopmentCard(player, "knight")) return false;
    const robberOnUs = this.geometry.hexes[this.robberHexId].nodes.some(
      (nodeId) => this.geometry.nodes[nodeId].owner === player.id,
    );
    const progress = player.devCards.monopoly + player.devCards.yearOfPlenty + player.devCards.roadBuilding > 0;
    const kr = !robberOnUs && strat === "strategic" && !progress ? this._aiKnightReason(player) : null;
    if (!robberOnUs && kr == null) return false;
    const why = this._aiRec() ? `${robberOnUs ? "The robber blocks its own tile" : kr} (before rolling)` : null;
    const played = this.playDevelopmentCard(player, "knight");
    if (played && why) this._aiNoteDev(player, "knight", why);
    if (played) {
      this.recomputeScores();
      this.checkForWinner(player);
    }
    return played;
  }

  shouldPlayMonopoly(player) {
    const strat = this._aiStrat(player).devCards;
    const pick = this._aiMonopolyPick(player);
    if (pick.count < 2) return false;
    if (strat === "strategic") {
      // Strategic: fire when the estimated haul covers what it is short of, or is big
      if (pick.short > 0 && pick.count >= pick.short && pick.value >= 2) return true;
      return pick.value >= 3.5;
    }
    return pick.value >= 2.5;
  }

  shouldPlayYearOfPlenty(player) {
    const picks = this.chooseYearOfPlentyResources(player);
    if (picks.length < 2) return false;
    if (this._aiStrat(player).devCards !== "strategic") return true;
    // Strategic: play when the two cards let it build now or bring its plan clearly closer
    const plan = this._aiPlan(player);
    const goal = plan.goals[0];
    if (!goal) return true;
    const after = copyResources(player.resources);
    picks.forEach((r) => { after[r] += 1; });
    if (hasResources(after, this._aiStepCost(goal))) return true;
    return this._aiEta(goal.cost, player.resources, plan.incTurn, null) - this._aiEta(goal.cost, after, plan.incTurn, null) >= 1.5;
  }

  shouldPlayRoadBuilding(player) {
    if (this.sea) return !!this.sea.aiFreePiece(player); // ⚓
    if (this._aiStrat(player).devCards !== "strategic") return this.chooseStrategicRoadEdge(player, true) != null;
    // Strategic: save it for roads the plan actually needs (toward a spot, or Longest Road)
    const planned = this._aiPlan(player).goals.find((g) => g.edge != null);
    return !!planned && this.canBuildRoad(player, planned.edge, { free: true });
  }

  tryBuildSettlement(player, nodeId = null) {
    if (!hasResources(player.resources, COSTS.settlement)) return false;
    const candidates = nodeId != null
      ? (this.canBuildSettlement(player, nodeId, false) ? [{ nodeId, score: this.getNodeProductionScore(nodeId, player) }] : [])
      : this.getBuildableSettlementNodes(player);
    if (!candidates.length) return false;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!this.placeSettlement(player, best.nodeId, false)) return false;
    this.payToBank(player, COSTS.settlement);
    this.addLog(`${player.name} built a settlement.`);
    if (this.sea) this._seaOnSettlement(player, best.nodeId); // ⚓ +2 for a new island
    this.sfx.buildSettlement();
    this._aiLog(player, `Chose settlement at node ${best.nodeId} (score ${best.score.toFixed(2)}, ${candidates.length} options)`);
    this.recomputeScores();
    this.checkForWinner(player);
    return true;
  }

  tryBuildCity(player, target = null) {
    if (!hasResources(player.resources, COSTS.city)) return false;
    const nodeId = target ?? this.getBestCityTarget(player);
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

  // Bank/port trade toward the bot's current goal (see _aiBankTradeToward)
  tryTradeForGoal(player) {
    const plan = this._aiPlan(player);
    return plan.goals.length ? this._aiBankTradeToward(player, plan, plan.goals[0]) : false;
  }

  // ── AI planner ──────────────────────────────────────────────────────
  // Every bot keeps a ranked list of candidate builds ("goals"): a city, its best few settlement
  // spots (with the roads needed to reach them), a development card and, for complex expansion,
  // a Longest Road grab. Each goal has a value (VP + production it adds, converted to VP over the
  // turns that are likely left) and an ETA (expected turns until affordable from income, plus bank
  // and port trades). Goals are ranked by value per turn: value / (ETA + 1).

  _aiStrat(player) {
    return player?.strategy ? { ...DEFAULT_AI_STRATEGY, ...player.strategy } : DEFAULT_AI_STRATEGY;
  }

  // Expected cards per roll by resource (the robber's tile produces nothing)
  _aiIncome(player) {
    const inc = makeEmptyResources();
    const add = (nodeId, amount) => this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
      const hex = this.geometry.hexes[hexId];
      if (!hex.number || hex.resource === "desert" || hexId === this.robberHexId) return;
      inc[prodRes(hex, inc)] += (DICE_WEIGHT[hex.number] / 36) * amount;
    });
    player.settlements.forEach((n) => add(n, 1));
    player.cities.forEach((n) => add(n, 2));
    return inc;
  }

  // Cards per roll a building at this node adds; resources we barely produce count extra
  _aiNodeProd(nodeId, inc) {
    let v = 0;
    this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
      const hex = this.geometry.hexes[hexId];
      if (!hex.number || hex.resource === "desert") return;
      const res = prodRes(hex, inc);
      const w = inc[res] < 0.03 ? 1.35 : inc[res] < 0.1 ? 1.15 : 1;
      v += (DICE_WEIGHT[hex.number] / 36) * w * (hexId === this.robberHexId ? 0.6 : 1);
    });
    return v;
  }

  // Expected turns until `cost` is affordable from `hand` with income `inc` (cards per turn).
  // With `rates` the bot may also trade surplus at those bank/port rates; each card bought that way
  // adds a small penalty. Without `rates`: income only.
  _aiEta(cost, hand, inc, rates) {
    const MAX = 30;
    let def = 0;
    let tNo = 0;
    for (const r of RESOURCES) {
      const need = (cost[r] || 0) - hand[r];
      if (need > 0) {
        def += need;
        tNo = Math.max(tNo, inc[r] > 1e-6 ? need / inc[r] : MAX);
      }
    }
    if (def <= 0) return 0;
    tNo = Math.min(MAX, tNo);
    if (!rates) return tNo;
    let capNow = 0;
    for (const r of RESOURCES) {
      const spare = hand[r] - (cost[r] || 0);
      if (spare > 0) capNow += Math.floor(spare / rates[r]);
    }
    if (capNow >= def) return 0.3 * def;
    const gap = (t) => {
      let d = 0;
      let c = 0;
      for (const r of RESOURCES) {
        const x = (cost[r] || 0) - hand[r] - inc[r] * t;
        if (x > 0) d += x;
        else c -= x / rates[r];
      }
      return [d, c];
    };
    let [d, c] = gap(tNo);
    if (d > c) return tNo;
    let lo = 0;
    let hi = tNo;
    for (let i = 0; i < 10; i += 1) {
      const mid = (lo + hi) / 2;
      [d, c] = gap(mid);
      if (d <= c) hi = mid;
      else lo = mid;
    }
    [d] = gap(hi);
    return Math.min(tNo, hi + 0.3 * d);
  }

  // Cost of the next concrete action toward a goal (a road first when the spot is not reached yet)
  _aiStepCost(goal) {
    if (goal.via === "ship" && goal.dist > 0) return COSTS.ship; // ⚓ next ship toward a sea goal
    if (goal.type === "road" || (goal.type === "settlement" && goal.dist > 0)) return COSTS.road;
    return goal.type === "city" ? COSTS.city : goal.type === "dev" ? COSTS.development : COSTS.settlement;
  }

  // Road distances (0-1 BFS: own roads are free) from the bot's network to every node, plus the
  // first new road to build on that path.
  _aiRoadReach(player) {
    const nodes = this.geometry.nodes;
    const dist = new Array(nodes.length).fill(Infinity);
    const first = new Array(nodes.length).fill(null);
    const queue = [];
    this.getRoadNetworkNodes(player).forEach((n) => { dist[n] = 0; queue.push(n); });
    while (queue.length) {
      const u = queue.shift();
      const node = nodes[u];
      if (node.owner != null && node.owner !== player.id) continue; // can't build past an opponent's town
      for (const edgeId of node.edgeIds) {
        const edge = this.geometry.edges[edgeId];
        if (edge.owner != null && edge.owner !== player.id) continue;
        if (this.sea && (edge.ship || this.sea.edgeKind(edgeId) === "sea")) continue; // ⚓ roads: land and coast only
        const v = edge.nodes[0] === u ? edge.nodes[1] : edge.nodes[0];
        const w = edge.owner === player.id ? 0 : 1;
        if (dist[u] + w >= dist[v]) continue;
        dist[v] = dist[u] + w;
        first[v] = w ? (first[u] ?? edgeId) : first[u];
        if (w) queue.push(v);
        else queue.unshift(v);
      }
    }
    return { dist, first };
  }

  // A buildable road that makes our longest road longer (null if none)
  _aiRoadExtendEdge(player) {
    let best = null;
    let bestLen = player.longestRoadLength;
    this.geometry.edges.forEach((edge) => {
      if (!this.canBuildRoad(player, edge.id, { free: true })) return;
      edge.owner = player.id;
      player.roads.add(edge.id);
      const len = this.computeLongestRoadLength(player);
      edge.owner = null;
      player.roads.delete(edge.id);
      if (len > bestLen) { bestLen = len; best = edge.id; }
    });
    return best;
  }

  _aiDevValue(player, strat, W) {
    let v = W.devCard;
    if (strat.devCards === "strategic") {
      v += W.devStrategic;
      const holder = this.largestArmyHolder;
      const mine = player.knightsPlayed + player.devCards.knight + player.newDevCards.knight;
      if (holder !== player.id) {
        const need = (holder != null ? this.players[holder].knightsPlayed + 1 : 3) - mine;
        v += need <= 2 ? 0.6 : need <= 3 ? 0.25 : 0;
      } else {
        const rival = Math.max(...this.players.filter((p) => p.id !== player.id).map((p) => p.knightsPlayed));
        if (rival >= player.knightsPlayed - 1) v += 0.35;
      }
      if (this.winPoints - player.victoryPoints <= 2) v += 0.2; // a VP card could win it
    }
    return v;
  }

  _aiPlan(player) {
    const strat = this._aiStrat(player);
    const W = aiPlanWeights(strat.w);
    const kPort = strat.w?.port ?? 1;
    const R = this.players.length; // rolls per round
    const inc = this._aiIncome(player);
    const incTurn = makeEmptyResources();
    RESOURCES.forEach((r) => { incTurn[r] = inc[r] * R; });
    let rates = null;
    if (strat.trading !== "none") {
      rates = {};
      RESOURCES.forEach((r) => { rates[r] = this.getPlayerTradeRate(player, r); });
    }
    // Turns likely left: advanced awareness reads the race (production matters less near the end)
    let tLeft = W.turnsLeft;
    if (strat.awareness === "advanced") {
      const leader = Math.max(...this.players.filter((p) => p.id !== player.id).map((p) => p.publicVictoryPoints));
      const left = Math.min(this.winPoints - player.victoryPoints, this.winPoints - leader);
      tLeft = clamp(left * 2.2, 2, 16);
    }
    const prodVP = (prod) => prod * R * tLeft * W.prodVPPerCard;
    const goals = [];
    const add = (g) => {
      g.value = g.vp + prodVP(g.prod || 0) + (player.victoryPoints + g.vp >= this.winPoints ? 6 : 0);
      // value split for analysis mode: VP, production (at the default horizon), horizon shift, win bonus
      const base = (g.prod || 0) * R * W.turnsLeft * W.prodVPPerCard;
      g.parts = { vp: g.vp, prod: base, horizon: prodVP(g.prod || 0) - base, win: player.victoryPoints + g.vp >= this.winPoints ? 6 : 0 };
      goals.push(g);
    };
    // City on the best-producing settlement
    if (this.piecesLeft(player, "city") > 0 && player.settlements.size) {
      let best = null;
      player.settlements.forEach((nodeId) => {
        const prod = this._aiNodeProd(nodeId, inc);
        if (!best || prod > best.prod) best = { nodeId, prod };
      });
      add({ type: "city", label: "City", cost: COSTS.city, vp: 1, prod: best.prod, nodeId: best.nodeId });
    }
    // ⚓ Seafarers: coastal spots reached by ships (new islands score their +2)
    if (this.sea) this.sea.addSeaGoals(player, { add, inc, strat, profile: this.getResourceIncomeProfile(player), roadReach: this._aiRoadReach(player) });
    // Settlement spots in reach (a few best by the placement level's own judgement)
    const roadsLeft = this.piecesLeft(player, "road");
    let lastSpots = null; // every spot in reach with its ranking score (analysis mode shows them)
    if (this.piecesLeft(player, "settlement") > 0) {
      const reach = this._aiRoadReach(player);
      const maxD = Math.min(strat.expansion === "complex" ? 4 : 3, roadsLeft);
      const profile = this.getResourceIncomeProfile(player);
      const pen = W.roadPenalty[strat.expansion] ?? W.roadPenalty.medium;
      const spots = [];
      this.geometry.nodes.forEach((node) => {
        const d = reach.dist[node.id];
        if (!(d <= maxD) || node.structure != null) return;
        if (node.neighbors.some((n) => this.geometry.nodes[n].structure != null)) return;
        if (d > 0 && reach.first[node.id] == null) return;
        let h = this.getNodeProductionScore(node.id, player, profile) - d * pen;
        // complex expansion values reachable ports; v0.87: only when the placement level doesn't already
        // (medium / complex placement score ports inside getNodeProductionScore: counted once)
        if (strat.expansion === "complex" && strat.placement === "simple") {
          node.ports.forEach((type) => { h += (type === "any" ? 0.3 : profile[type] >= 0.12 ? 0.8 : 0) * kPort; });
        }
        spots.push({ nodeId: node.id, d, h });
      });
      spots.sort((a, b) => b.h - a.h);
      lastSpots = spots;
      spots.slice(0, strat.expansion === "simple" ? 1 : 3).forEach(({ nodeId, d }) => {
        const cost = { ...COSTS.settlement };
        cost.wood += d;
        cost.brick += d;
        let prod = this._aiNodeProd(nodeId, inc);
        this.geometry.nodes[nodeId].ports.forEach((type) => { prod += (type === "any" ? 0.03 : inc[type] > 0.1 ? 0.05 : 0) * kPort; });
        add({ type: "settlement", label: d ? `Settlement (+${d} road${d > 1 ? "s" : ""})` : "Settlement",
          cost, vp: 1, prod, nodeId, dist: d, edge: d ? reach.first[nodeId] : null });
      });
    }
    // Development card
    if (strat.devCards !== "none" && this.devDeck.length > 0) {
      add({ type: "dev", label: "Development card", cost: COSTS.development, vp: this._aiDevValue(player, strat, W), prod: 0 });
    }
    // Longest Road grab (complex expansion): 1-2 roads away from taking the 2 VP
    if (strat.expansion === "complex" && roadsLeft > 0 && this.longestRoadHolder !== player.id) {
      const holder = this.longestRoadHolder;
      const k = (holder != null ? this.players[holder].longestRoadLength + 1 : 5) - player.longestRoadLength;
      if (k >= 1 && k <= 2 && roadsLeft >= k) {
        const edge = this._aiRoadExtendEdge(player);
        const nearWin = holder != null && this.players[holder].publicVictoryPoints >= this.winPoints - 3;
        if (edge != null) add({ type: "road", label: "Longest Road", cost: { wood: k, brick: k }, vp: 2 + (nearWin && strat.awareness === "advanced" ? 1 : 0), prod: 0, edge });
      }
    }
    const plan = { strat, inc, incTurn, rates, goals, R, W, spots: lastSpots };
    goals.forEach((g) => {
      g.eta = this._aiEta(g.cost, player.resources, incTurn, rates);
      g.score = g.value / (g.eta + W.etaOffset);
    });
    if (strat.expansion === "simple") {
      // Simple: chase whatever is fewest cards away (settlement, city, card)
      const order = { settlement: 0, city: 1, road: 2, dev: 3 };
      const missing = (g) => RESOURCES.reduce((a, r) => a + Math.max(0, (g.cost[r] || 0) - player.resources[r]), 0);
      goals.sort((a, b) => missing(a) - missing(b) || order[a.type] - order[b.type]);
    } else {
      goals.sort((a, b) => b.score - a.score);
    }
    return plan;
  }

  _aiBestScore(plan, hand) {
    let best = 0;
    plan.goals.forEach((g) => {
      best = Math.max(best, g.value / (this._aiEta(g.cost, hand, plan.incTurn, plan.rates) + plan.W.etaOffset));
    });
    return best;
  }

  // How much a hand is worth to the plan (best goal counts most); used to pick discards
  _aiKeepValue(plan, hand) {
    const scores = plan.goals.map((g) => g.value / (this._aiEta(g.cost, hand, plan.incTurn, plan.rates) + plan.W.etaOffset)).sort((a, b) => b - a);
    return (scores[0] || 0) + 0.35 * (scores[1] || 0) + 0.15 * (scores[2] || 0);
  }

  // Bank/port trades that make `cost` affordable right now, spending only cards beyond it
  // (cheapest rate first, sparing the next build's cards). Null if impossible.
  _aiTradesToComplete(hand, cost, rates, spare = {}) {
    const h = copyResources(hand);
    const bank = copyResources(this.bank);
    const trades = [];
    for (let guard = 0; guard < 6; guard += 1) {
      const short = RESOURCES.filter((r) => (cost[r] || 0) > h[r]);
      if (!short.length) return trades;
      const want = short.filter((r) => bank[r] > 0).sort((a, b) => (cost[b] - h[b]) - (cost[a] - h[a]))[0];
      if (!want) return null;
      const donors = RESOURCES.filter((r) => r !== want && h[r] - (cost[r] || 0) >= rates[r])
        .sort((a, b) => rates[a] - rates[b] || (spare[a] || 0) - (spare[b] || 0) || h[b] - h[a]);
      if (!donors.length) return null;
      const d = donors[0];
      h[d] -= rates[d];
      bank[d] += rates[d];
      h[want] += 1;
      bank[want] -= 1;
      trades.push([d, want]);
    }
    return null;
  }

  // Trade with the bank (or ports) toward a goal, protecting the goal's own cards:
  //  1. a set of trades that lets it take the next step right now, if waiting would take >= 1 turn;
  //  2. (balanced/aggressive) one trade that brings the whole goal >= 1 turn closer.
  // Holding more cards than the discard limit lowers both bars (a 7 would cost half the hand).
  _aiBankTradeToward(player, plan, goal) {
    if (!plan.rates) return false;
    const hand = copyResources(player.resources);
    const over = this._aiOverLimit(player);
    const next = plan.goals.find((g) => g !== goal)?.cost || {};
    const step = this._aiStepCost(goal);
    const stepWait = this._aiEta(step, hand, plan.incTurn, null);
    if (stepWait >= 1 || (over && stepWait > 0)) {
      const trades = this._aiTradesToComplete(hand, step, plan.rates, next);
      if (trades && trades.length) {
        let done = 0;
        for (const [give, get] of trades) {
          this._aiLog(player, `Bank trade toward ${goal.label}: ${give} → ${get} (${plan.rates[give]}:1)`);
          if (this.performBankTrade(player, give, get)) done += 1;
          else break;
        }
        return done > 0;
      }
    }
    if (plan.strat.trading === "conservative") return false;
    const cost = goal.cost;
    const wait = this._aiEta(cost, hand, plan.incTurn, null);
    if (wait === 0) return false;
    let best = null;
    RESOURCES.forEach((give) => {
      const rate = plan.rates[give];
      if (hand[give] - (cost[give] || 0) < rate) return;
      RESOURCES.forEach((get) => {
        if (get === give || this.bank[get] < 1 || (cost[get] || 0) <= hand[get]) return;
        const h2 = copyResources(hand);
        h2[give] -= rate;
        h2[get] += 1;
        const gain = wait - this._aiEta(cost, h2, plan.incTurn, null);
        const v = gain - ((next[give] || 0) > h2[give] ? 0.3 : 0);
        if (!best || v > best.v) best = { give, get, gain, v };
      });
    });
    if (best && (best.gain >= 1 || (over && best.gain > 0))) {
      this._aiLog(player, `Bank trade toward ${goal.label}: ${best.give} → ${best.get} (saves ${best.gain.toFixed(1)} turns)`);
      return this.performBankTrade(player, best.give, best.get);
    }
    return false;
  }

  // Holding more cards than the discard limit: a 7 would cost half the hand
  _aiOverLimit(player) {
    return sumResources(player.resources) > this.settings.discardLimit;
  }

  _aiTryGoal(player, goal) {
    switch (goal.type) {
      case "city": return this.tryBuildCity(player, goal.nodeId);
      case "settlement": return goal.dist > 0 ? (goal.via === "ship" ? this.sea.aiBuildShip(player, goal.edge) : this._aiBuildRoad(player, goal.edge)) : this.tryBuildSettlement(player, goal.nodeId); // ⚓ via ship
      case "road": return this._aiBuildRoad(player, goal.edge);
      case "dev": return this.devDeck.length > 0 && hasResources(player.resources, COSTS.development) && this.buyDevelopmentCard(player);
      default: return false;
    }
  }

  // One planned action: build the top goal (or its next road), else trade toward it, else a side
  // build that doesn't delay it (any useful build when holding more cards than the discard limit).
  _aiPlannedStep(player) {
    const plan = this._aiPlan(player);
    // analysis mode: the plan as the bot sees it now, noted once the step is taken
    const snap = this._aiRec() ? this._aiPlanSnap(player, plan) : null;
    const done = (goal, act) => { if (snap) this._aiNotePlan(player, snap, goal, act); return true; };
    if (this.sea && this.sea.aiMoveStep(player, plan)) return done(null, "ship"); // ⚓ a free ship move toward a target
    const [goal, ...rest] = plan.goals;
    if (!goal) return false;
    if (hasResources(player.resources, this._aiStepCost(goal)) && this._aiTryGoal(player, goal)) return done(goal, "build");
    if (this._aiBankTradeToward(player, plan, goal)) return done(goal, "bank");
    const over = this._aiOverLimit(player);
    for (const side of rest) {
      const step = this._aiStepCost(side);
      if (!hasResources(player.resources, step)) continue;
      const after = copyResources(player.resources);
      payCost(after, step);
      const delay = this._aiEta(goal.cost, after, plan.incTurn, plan.rates) - goal.eta;
      if ((delay <= plan.W.sideBuildDelay || over) && this._aiTryGoal(player, side)) return done(side, "side");
    }
    return false;
  }

  // ── Public card tracking ──
  // What any player at the table could know about each hand: production, builds, bank trades,
  // discards, Monopoly and bot trades are public; a stolen card is not (spread by the victim's
  // estimate). Estimates are reconciled to the public hand sizes, so they never read hidden cards.
  _aiTrk() {
    if (this._aiCardTrack?.players === this.players) return this._aiCardTrack;
    const est = this.players.map((p) => this._aiSpread(p, sumResources(p.resources), makeEmptyResources()));
    this._aiCardTrack = { players: this.players, est };
    return this._aiCardTrack;
  }

  // Add n unknown cards to an estimate, split by the player's (public) production profile
  _aiSpread(player, n, into) {
    if (n <= 0) return into;
    const inc = this.geometry ? this._aiIncome(player) : makeEmptyResources();
    const total = sumResources(inc);
    RESOURCES.forEach((r) => { into[r] += n * (total > 0 ? inc[r] / total : 0.2); });
    return into;
  }

  _aiTrkNote(player, delta, sign) {
    if (!player || !this.players?.includes(player)) return;
    const e = this._aiTrk().est[player.id];
    RESOURCES.forEach((r) => { if (delta[r]) e[r] = Math.max(0, e[r] + sign * delta[r]); });
  }

  _aiTrkSteal(victim, thief) {
    const est = this._aiEstimate(victim);
    const n = sumResources(est);
    if (n <= 0) return;
    const t = this._aiTrk().est[thief.id];
    RESOURCES.forEach((r) => { const share = est[r] / n; est[r] = Math.max(0, est[r] - share); t[r] += share; });
  }

  _aiTrkMonopoly(player, resource, collected) {
    const trk = this._aiTrk();
    this.players.forEach((p) => { if (p.id !== player.id) trk.est[p.id][resource] = 0; });
    trk.est[player.id][resource] += collected;
  }

  // Estimated hand of a player, reconciled to their public card count
  _aiEstimate(player) {
    const e = this._aiTrk().est[player.id];
    const total = sumResources(player.resources);
    const sum = sumResources(e);
    if (sum > total + 1e-9) {
      const k = sum > 0 ? total / sum : 0;
      RESOURCES.forEach((r) => { e[r] *= k; });
    } else if (sum < total - 1e-9) {
      this._aiSpread(player, total - sum, e);
    }
    return e;
  }

  _aiBuildRoad(player, edgeId) {
    if (edgeId == null || !this.canBuildRoad(player, edgeId, { free: false })) return false;
    if (!this.placeRoad(player, edgeId, { free: false })) return false;
    this.payToBank(player, COSTS.road);
    this.addLog(`${player.name} built a road.`);
    this.sfx.buildRoad();
    this.recomputeScores();
    this.checkForWinner(player);
    return true;
  }

  getResourceIncomeProfile(player) {
    const income = makeEmptyResources();
    [...player.settlements, ...player.cities].forEach((nodeId) => {
      const node = this.geometry.nodes[nodeId];
      const amount = node.structure === "city" ? 2 : 1;
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (!hex.number || hex.resource === "desert") return;
        income[prodRes(hex, income)] += (DICE_WEIGHT[hex.number] / 36) * amount;
      });
    });
    return income;
  }

  // `parts` (optional, analysis only): receives the score split by AI dimension. It never changes the score.
  // `parts.terms` (optional, AI Lab decision tree): receives the same score split by term (num, scarcity,
  // variety, port, sets, magnet, contest) with the lab weight that scales each one.
  getNodeProductionScore(nodeId, player, incomeProfile = null, parts = null) {
    const node = this.geometry.nodes[nodeId];
    const P = parts || {};
    const put = (k, v) => { if (parts) P[k] = (P[k] || 0) + v; };
    const T = parts?.terms || null;
    const term = (k, v) => { if (T) T[k] = (T[k] || 0) + v; };
    const w = aiW(player);
    const kNum = w.num ?? 1, kVar = w.variety ?? 1, kScar = w.scarcity ?? 1, kPort = w.port ?? 1;
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
        score += (DICE_WEIGHT[hex.number] / 6) * kNum;
        put("placement", (DICE_WEIGHT[hex.number] / 6) * kNum);
        term("num", (DICE_WEIGHT[hex.number] / 6) * kNum);
      });
      return score;
    }

    // ── Medium (default): scarcity + diversity + ports + contested spots ──
    const income = incomeProfile || this.getResourceIncomeProfile(player);
    const resourceSeen = new Set();
    const here0 = makeEmptyResources();
    let score = 0;
    node.adjacentHexes.forEach((hexId) => {
      const hex = this.geometry.hexes[hexId];
      if (hex.resource === "desert" || !hex.number) return;
      const res = prodRes(hex, income);
      here0[res] += DICE_WEIGHT[hex.number] / 36;
      // v0.87: scarcity discriminates: full bonus (x1.6) for a resource it doesn't produce yet, none from
      // ~0.22 cards per roll up (it used to be x1.4-1.6 for almost everything: income never neared 0.85)
      const scarcityWeight = 1 + Math.max(0, 1 - income[res] / 0.22) * 0.6 * kScar;
      score += (DICE_WEIGHT[hex.number] / 6) * scarcityWeight * kNum;
      put("placement", (DICE_WEIGHT[hex.number] / 6) * scarcityWeight * kNum);
      term("num", (DICE_WEIGHT[hex.number] / 6) * kNum);
      term("scarcity", (DICE_WEIGHT[hex.number] / 6) * (scarcityWeight - 1) * kNum);
      resourceSeen.add(res);
    });
    score += resourceSeen.size * 0.42 * kVar;
    put("placement", resourceSeen.size * 0.42 * kVar);
    term("variety", resourceSeen.size * 0.42 * kVar);

    const ports = node.ports;
    if (ports.includes("any")) { score += 0.4 * kPort; put("trading", 0.4 * kPort); term("port", 0.4 * kPort); }
    // a matching 2:1 harbour: its resource is (or with this spot will be) produced at >= 0.12 cards per roll
    // (v0.87: was > 0.5, which no income ever reaches)
    const port2 = ports.some((type) => type !== "any" && income[type] + here0[type] >= 0.12);
    if (port2) { score += 0.4 * kPort; put("trading", 0.4 * kPort); term("port", 0.4 * kPort); }

    // v0.87 contest: an opponent's road already ends at this spot, so they are heading for it: taking it
    // first also denies them (replaces a "blocking" term that could never fire: a spot next to a
    // building is not buildable at all)
    let blockValue = 0;
    const rivals = new Set();
    node.edgeIds.forEach((edgeId) => { const o = this.geometry.edges[edgeId].owner; if (o != null && o !== player.id) rivals.add(o); });
    blockValue = rivals.size * 0.3;
    score += blockValue;
    put("awareness", blockValue);
    term("contest", blockValue);

    // ── Complex: board-wide scarcity, resource sets, matching 2:1 ports, robber magnets ──
    if (strat === "complex") {
      const boardW = this._aiBoardScarcity();
      const here = makeEmptyResources();
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        if (hex.resource === "desert" || !hex.number) return;
        const res = prodRes(hex, income);
        here[res] += DICE_WEIGHT[hex.number] / 36;
        score += (DICE_WEIGHT[hex.number] / 6) * ((boardW[res] ?? 1) - 1) * kScar;
        put("placement", (DICE_WEIGHT[hex.number] / 6) * ((boardW[res] ?? 1) - 1) * kScar);
        term("scarcity", (DICE_WEIGHT[hex.number] / 6) * ((boardW[res] ?? 1) - 1) * kScar);
        if (income[res] < 0.05) { score += 0.35 * kScar; put("placement", 0.35 * kScar); term("scarcity", 0.35 * kScar); } // a resource we don't produce yet
      });
      const has = (r) => income[r] + here[r] > 0.02;
      if (has("ore") && has("wheat") && (here.ore > 0 || here.wheat > 0)) { score += 0.35; put("expansion", 0.35); term("sets", 0.35); }  // city set
      if (has("wood") && has("brick") && (here.wood > 0 || here.brick > 0)) { score += 0.3; put("expansion", 0.3); term("sets", 0.3); } // road set
      // 2:1 port for a resource we (will) produce well
      ports.forEach((type) => {
        // (v0.87: 0.8 in all, the medium level's 0.4 included)
        const v = (port2 ? 0.4 : 0.8) * kPort;
        if (type !== "any" && income[type] + here[type] >= 0.12) { score += v; put("trading", v); term("port", v); }
      });
      // Slight penalty for 6/8 hexes (robber targets)
      node.adjacentHexes.forEach((hexId) => {
        const hex = this.geometry.hexes[hexId];
        // v0.87: a real (if modest) penalty: 0.1 per 6/8 tile (was 0.05, too small to change a pick)
        if (hex.number === 6 || hex.number === 8) { const m = 0.1 * DICE_WEIGHT[hex.number] / 5; score -= m; put("awareness", -m); term("magnet", -m); }
      });
    }

    return score;
  }

  // Per-resource weight from how much of it the board produces (rare resources are worth more)
  _aiBoardScarcity() {
    if (this._aiBoardW?.geometry === this.geometry) return this._aiBoardW.w;
    const pips = makeEmptyResources();
    this.geometry.hexes.forEach((hex) => { if (hex.number && RESOURCES.includes(hex.resource)) pips[hex.resource] += DICE_WEIGHT[hex.number]; });
    const avg = sumResources(pips) / RESOURCES.length;
    const w = makeEmptyResources();
    RESOURCES.forEach((r) => { w[r] = clamp(avg / Math.max(1, pips[r]), 0.8, 1.5); });
    this._aiBoardW = { geometry: this.geometry, w };
    return w;
  }

  // Every set-up spot the bot considers, with its score (node order). The pick is the first best one.
  _aiSetupCandidates(player) {
    const out = [];
    this.geometry.nodes.forEach((node) => {
      if (this.sea && !this.canBuildSettlement(player, node.id, true)) return; // ⚓ set-up: main island only
      const score = this.getNodeProductionScore(node.id, player);
      if (!Number.isFinite(score)) return;
      out.push({ id: node.id, score });
    });
    return out;
  }

  getBestInitialSettlementNode(player) {
    let bestNodeId = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    this._aiSetupCandidates(player).forEach(({ id, score }) => {
      if (score > bestScore) {
        bestScore = score;
        bestNodeId = id;
      }
    });
    return bestNodeId;
  }

  getBestRoadFromNode(player, nodeId, out = null) {
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
      if (out) out.push({ id: edgeId, score });
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

    // Medium + Complex: follow the build plan (road toward the planned spot / Longest Road)
    const planned = this._aiPlan(player).goals.find((g) => g.edge != null);
    if (planned && this.canBuildRoad(player, planned.edge, { free: freeBuild })) return planned.edge;

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
    const w = aiW(player);
    const pathPenalty = (strat === "complex" ? 0.3 : 0.45) * (w.road ?? 1);
    let bestNode = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.geometry.nodes.forEach((node) => {
      if (node.structure != null) return;
      if (node.neighbors.some((neighborId) => this.geometry.nodes[neighborId].structure != null)) return;
      const path = this.pathToNode(player, node.id);
      if (!path || !path.length) return;
      // Complex: also consider ports we don't have
      let portBonus = 0;
      if (strat === "complex" && node.ports.length > 0 && (player.strategy?.placement || "medium") === "simple") { // v0.87: once (see _aiPlan)
        const income = this.getResourceIncomeProfile(player);
        node.ports.forEach(type => {
          if (type !== "any" && income[type] >= 0.12) portBonus += 0.8 * (w.port ?? 1);
          else if (type === "any") portBonus += 0.3 * (w.port ?? 1);
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
        if (this.sea && (edge.ship || this.sea.edgeKind(edgeId) === "sea")) continue; // ⚓ roads: land and coast only
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
    if (this.sea) return this.sea.tradeRouteLength(player); // ⚓ Longest Trade Route: roads + ships
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
    const prevLR = this.longestRoadHolder, prevLA = this.largestArmyHolder;
    this.updateLongestRoadHolder();
    this.updateLargestArmyHolder();
    // v0.73: the journal says when an award moves (it only showed as a small badge before)
    if (this.players.length && !this._loadingState) {
      this._logAward(this.sea ? "Longest Trade Route" : "Longest Road", prevLR, this.longestRoadHolder, (p) => `${p.longestRoadLength} ${this.sea ? "roads and ships" : "roads"}`); // ⚓
      this._logAward("Largest Army", prevLA, this.largestArmyHolder, (p) => `${p.knightsPlayed} knights`);
    }

    this.players.forEach((player, idx) => {
      const base = player.settlements.size + player.cities.size * 2 + player.devVictoryPoints + (this.sea ? this.sea.bonusVP(player) : 0); // ⚓ +2 per new island
      const roadBonus = this.longestRoadHolder === idx ? 2 : 0;
      const armyBonus = this.largestArmyHolder === idx ? 2 : 0;
      player.victoryPoints = base + roadBonus + armyBonus;
      // What opponents can see: hidden Victory Point cards excluded
      player.publicVictoryPoints = player.victoryPoints - player.devVictoryPoints;
    });
  }

  _logAward(name, prev, now, why) {
    if (prev === now) return;
    const P = (id) => this.players[id];
    if (now != null) {
      const p = P(now);
      this.addLog(`${p.name} ${this._you(p) ? "take" : "takes"} ${name} (${why(p)}) · +2 points${prev != null ? ` from ${P(prev).name}` : ""}.`);
    } else if (prev != null) {
      const p = P(prev);
      this.addLog(`${p.name} ${this._you(p) ? "lose" : "loses"} ${name}${/^Longest (Road|Trade Route)$/.test(name) ? ` (now ${p.longestRoadLength})` : ""} · nobody holds it.`);
    }
  }

  // VP shown to the human: full total for their own seat, public total for everyone else.
  displayVictoryPoints(player) {
    return this._seesPrivate(player) ? player.victoryPoints : player.publicVictoryPoints;
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
    if (this.phase === "sbp") return false; // building between turns never wins: only on your own turn
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
    this._dropUndo();
    this.devPlayed = null;
    this.trayMode = null;
    this.currentTurnPlayedDevCard = false;
    this.freeRoadsRemaining = 0;
    this.lastRoll = null;
    this.sea?.onNewTurn(); // ⚓ ship move + "built this turn" reset
    // Invalidate any trade confirm/accept buttons left over from this turn
    this.turnSerial += 1;
    this.tradeLocked = false;
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";

    // 5–6 players: the others may build first (Special Building Phase, src/six.js); it ends in _advanceTurn()
    if (this._sbpBegin(player)) return;
    this._advanceTurn();
  }

  /** Pass the dice to the next player (after the Special Building Phase, if any). */
  _advanceTurn() {
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

  /**
   * Pause between bot moves in ms. The whole slider maps linearly, right = faster:
   * bot turns 2300 ms (Slow) … 280 ms (Fast); "Watch bots play" turns 3000 … 500 ms.
   * The default (72) keeps the old pace: ~850 ms per bot move, 1200 ms per watched turn.
   */
  botStepMs(kind = "bot") {
    const min = Number(this.speedRange?.min ?? 0), max = Number(this.speedRange?.max ?? 100);
    const v = Number(this.speedRange?.value);
    const t = Number.isFinite(v) && max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0.72;
    const [slow, fast] = kind === "autoplay" ? [3000, 500] : [2300, 280];
    return Math.round(slow - t * (slow - fast));
  }

  _syncSpeedLabel() {
    if (!this.speedRange) return;
    const ms = this.botStepMs();
    const word = ms >= 1900 ? "Slow" : ms >= 1300 ? "Relaxed" : ms >= 750 ? "Normal" : "Fast";
    this.speedRange.setAttribute("aria-valuetext", `${word} (${(ms / 1000).toFixed(1)} s per bot move)`);
  }

  startAutoplay() {
    if (this.winner) return;
    this._releaseOnboarding();
    this.stopAiTurnLoop();
    const delay = this.botStepMs("autoplay");
    this.autoplayInterval = window.setInterval(this._guard(() => {
      this.autoPlayCurrentTurn();
      this.render();
    }), delay);
    this.autoplayBtn.textContent = "Stop watching";
    // Rush: the human seat joins the bot ticks while autoplay runs
    if (this.rush && !this.setupPhase) {
      const human = this._me();
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

    const cadence = this.botStepMs();
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
      offers: [],  // bot trade offers to the human, a queue (front = the open card): { id, fromId, give, want, armed, expiresAt }
      offeredBy: [], // v0.86: bots that made you an offer this roll interval (one each)
      declined: [],  // v0.86: deals you declined this roll interval (never offered again before the next roll)
      ...(saved || {}),
    };
    this.rush.offers = (this.rush.offers || []).filter((o) => this.players[o.fromId]);
    this.rush.offeredBy = this.rush.offeredBy || [];
    this.rush.declined = this.rush.declined || [];
    this._offerSeq = this.rush.offers.reduce((m, o) => Math.max(m, o.id), 0);
    const human = this._me();
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
    if (document.hidden || this.uiPaused || this._aiHeld()) return; // analysis mode Pause freezes Rush too
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
    // only the open card's clock runs (offers waiting behind it start theirs when they come up)
    if (r.offers.some((o) => o.armed && o.expiresAt <= r.clockMs)) {
      r.offers = r.offers.filter((o) => !(o.armed && o.expiresAt <= r.clockMs));
      this._renderRushOffers();
    }
    this._renderRushHud();
    this._updateOfferTimers();
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
    this._stRoll(null, res.d1, res.d2);
    // New roll interval: last interval's purchases become playable, one dev card each again
    this.players.forEach((p) => {
      DEV_CARD_TYPES.forEach((t) => {
        p.devCards[t] += p.newDevCards[t];
        p.newDevCards[t] = 0;
      });
      p.rushDevPlayed = false;
      p.rushTradeTried = false;
    });
    r.offeredBy = []; // v0.86: a new roll interval: each bot may make you one offer again
    r.declined = [];
    if (this.sea) { // ⚓ a new roll interval: one ship move each again; an unpicked gold choice is made for you
      if (this.pendingAction === "moveShip") { this.pendingAction = null; this.sea.moveSel = null; }
      this.sea.onNewTurn();
      this.players.forEach((p) => { if (this.sea.goldFor(p.id)) this.sea.autoGold(p); });
    }
    this.addLog(`Roll #${r.rollNo}: rolled ${res.total}.`);
    this.fx?.diceRoll(res.d1, res.d2);
    this.sfx.diceRoll();
    this.lastDiceDisplay?.classList.remove("rush-flash");
    void this.lastDiceDisplay?.offsetWidth; // restart the flash animation
    this.lastDiceDisplay?.classList.add("rush-flash");
    if (res.total === 7) {
      // the 7-pause panel (with its discard buttons) opens right away: the tumbling dice go
      // underneath it instead of over the buttons
      document.body.classList.add("fx-under-sheets");
      window.clearTimeout(this._fxUnderTimer);
      this._fxUnderTimer = window.setTimeout(() => document.body.classList.remove("fx-under-sheets"), 2200);
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
    const human = this._me();
    // Drop half-finished human build selections; finish a robber move left from a Knight
    if (this.pendingAction && this.pendingAction !== "robber") this.pendingAction = null;
    if (this.confirmBuild?.type !== "robber") this.confirmBuild = null;
    this._dropUndo();
    this.trayMode = null;
    if (this.devPlayed?.type === "roadBuilding") this.devPlayed = null;
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
          const hexId = this.chooseRobberHex(mover);
          if (this._aiRec()) this._aiNoteRobber(mover, hexId);
          this.moveRobberAndSteal(mover, hexId);
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
      this._discardAuto(); // v0.81: the Suggest choice, with a toast
    } else if (seven.stage === "robber") {
      const human = this.players[seven.moverId];
      this.addLog("Time's up — the robber was placed for you.");
      this._rushAutoFinishHumanRobber(human);
    }
  }

  // Complete a human robber move (placement and/or victim choice) automatically.
  _rushAutoFinishHumanRobber(human) {
    // a tile is already chosen: finish that move
    const cb = this.confirmBuild?.type === "robber" ? this.confirmBuild : null;
    if (cb && this.pendingAction === "robber" && this._robberHexAllowed(cb.id, human)) {
      this._commitRobber(human, cb.id, cb.victim ?? this._defaultRobberVictim(cb.id, human));
    }
    if (this.confirmBuild?.type === "robber") this.confirmBuild = null;
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
    if (document.hidden || r.paused || this.uiPaused || this._aiHeld()) {
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
    const human = this._me();
    if (actor !== human) this._dropUndo(); // a roll or a bot move may build on what Undo would take back
    this.recomputeScores();
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
    if (cb.type === "ship") return this.canBuildShip(player, cb.id, { free: this.freeRoadsRemaining > 0 }); // ⚓
    if (cb.type === "settlement") return this.canBuildSettlement(player, cb.id, false);
    if (cb.type === "city") return this.canBuildCity(player, cb.id, false);
    return true;
  }

  _rushCanPlayDev(player, type) {
    if (this.winner || this.setupPhase || !this.rush || this.rush.paused || this.phase !== "main") return false;
    if (player.rushDevPlayed || !(player.devCards[type] > 0)) return false;
    if (this._isInteractive(player)
      && (this._robberInProgress() || this.freeRoadsRemaining > 0 || this.devPick)) return false;
    if (type === "yearOfPlenty" && sumResources(this.bank) === 0) return false;
    if (type === "roadBuilding" && !this._hasLegalRoad(player, true)) return false;
    return true;
  }

  toggleRushReady() {
    const r = this.rush;
    const human = this._me();
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
    if (!this._offerPossible(fromPlayer, give, want)) return;
    // v0.86: one card at a time; offers made while it is open wait behind it ("+2 more"). At most one offer
    // per bot per roll interval, a deal you declined is not offered again before the next roll, and a bot
    // whose earlier offer still waits does not stack a second one
    r.offeredBy = r.offeredBy || [];
    r.declined = r.declined || [];
    if (r.offeredBy.includes(fromPlayer.id) || r.declined.includes(this._offerKey(fromPlayer.id, give, want))) return;
    if (r.offers.some((o) => o.fromId === fromPlayer.id) || r.offers.length >= OFFER_QUEUE_MAX) return;
    r.offeredBy.push(fromPlayer.id);
    this._offerSeq = (this._offerSeq || 0) + 1;
    r.offers.push({ id: this._offerSeq, fromId: fromPlayer.id, give: { ...give }, want: { ...want }, armed: false, expiresAt: null });
    this.addLog(`${fromPlayer.name} offers you ${resourceString(give)} for ${resourceString(want)}.`);
    this._renderRushOffers();
  }

  /** "2|0,0,0,1,0>1,0,0,0,0": who offers what for what (the declined-deal memory). */
  _offerKey(fromId, give, want) {
    return `${fromId}|${RESOURCES.map((x) => give[x] || 0).join(",")}>${RESOURCES.map((x) => want[x] || 0).join(",")}`;
  }

  /** The open (front) card's time starts when it comes up. */
  _armRushOffer() {
    const r = this.rush, o = r?.offers?.[0];
    if (o && !o.armed) { o.armed = true; o.expiresAt = r.clockMs + RUSH_OFFER_MS; }
  }

  _resolveRushOffer(offerId, accept) {
    const r = this.rush;
    if (!r) return;
    const offer = r.offers.find((o) => o.id === offerId);
    if (!offer) return;
    r.offers = r.offers.filter((o) => o.id !== offerId);
    const from = this.players[offer.fromId];
    const human = this._me();
    if (!accept) r.declined = [...(r.declined || []), this._offerKey(offer.fromId, offer.give, offer.want)];
    if (accept) {
      if (r.paused || this.winner || !hasResources(human.resources, offer.want) || !hasResources(from.resources, offer.give)) {
        this.addLog(`Trade with ${from.name} is no longer possible.`);
      } else {
        this._stTrade(from, human, offer.give, offer.want);
        RESOURCES.forEach((res) => {
          human.resources[res] += offer.give[res] - offer.want[res];
          from.resources[res] += offer.want[res] - offer.give[res];
        });
        this._animateTradeCards(offer.want, offer.give, this._offerCardEl());
        this.sfx.trade();
        this.addLog(`You traded with ${from.name}: got ${resourceString(offer.give)} for ${resourceString(offer.want)}.`);
        this._rushAfterAction(human);
      }
    }
    this._renderRushOffers();
    this.render();
  }

  /** Can this offer still happen: you hold what the bot wants and the bot holds what it gives? */
  _offerPossible(fromPlayer, give, want, human = this._me()) {
    return !!(human && fromPlayer && hasResources(human.resources, want) && hasResources(fromPlayer.resources, give));
  }

  /** The visible offer card (source of the cards that fly into your hand when you accept). */
  _offerCardEl() {
    const el = this.rushOffersEl?.querySelector(".rush-offer:last-child");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { getBoundingClientRect: () => r };
  }

  /**
   * Bot trade offers to the human (Rush offers + a Classic incoming offer). Phones: one calm card
   * docked just above your hand; the board makes room for it (it never covers tiles), "+n" when
   * more wait. Offers you can no longer pay (or the bot can't) disappear on their own.
   */
  _renderRushOffers() {
    const el = this.rushOffersEl;
    if (!el) return;
    const pit = this.pendingIncomingTrade;
    if (this.rush?.offers?.length) {
      const keep = this.rush.offers.filter((o) => this._offerPossible(this.players[o.fromId], o.give, o.want));
      if (keep.length !== this.rush.offers.length) this.rush.offers = keep;
      this._armRushOffer();
    }
    let pitOk = !!pit && this._offerPossible(pit.fromPlayer, pit.give, pit.want, pit.to);
    if (pit?.ask && hasResources(pit.fromPlayer.resources, pit.give)) pitOk = true; // pass & play: the ✓ shows whether they can pay
    if (pit && !pitOk && !this.rush) {
      const id = pit.id;
      this._later(() => { if (this.pendingIncomingTrade?.id === id) this.resolveIncomingTrade(false, true); }, 0);
    }
    // pass & play: the offer waits behind the cover until its receiver holds the phone
    const queue = this.winner ? [] : this.rush ? this.rush.offers : pitOk && !(this.hotseat && (this.handHidden || this.viewerId !== pit.to?.id)) ? [{ id: pit.id, fromId: pit.fromPlayer.id, give: pit.give, want: pit.want, classic: true }] : [];
    const offers = queue.slice(0, 1); // v0.86: one card at a time, the rest wait behind it
    const waiting = queue.slice(1);
    const human = pit?.to || this._me();
    const key = queue.map((o) => o.id).join(",") + this.theme?.id + "|" + (human ? human.id + ":" + RESOURCES.map((r) => human.resources[r]).join(",") : "");
    if (key === this._lastOffersKey) return;
    this._lastOffersKey = key;
    const n = (res) => RESOURCES.filter((r) => res[r] > 0);
    // "1 [Lumber] Lumber": count, a 26 px icon and the name
    // v0.81: the hand's own card art in miniature (not the flat square icons)
    const side = (res) => n(res).map((r) => `<span class="oc ${r}"><b>${res[r]}</b><span class="ocard card" data-card="${r}">${cardSvg(r)}</span><span class="on">${RESOURCE_LABEL[r]}</span></span>`).join('<span class="plus">+</span>');
    const words = (res) => n(res).map((r) => `${res[r]} ${RESOURCE_LABEL[r]}`).join(" + ");
    el.dataset.more = "";
    // a new card that comes up right after you answered the previous one: its buttons wait a moment
    // (the second tap of a double tap must not answer the next offer)
    const front = offers[0];
    const arriving = !!front && this._offerAnsweredAt && performance.now() - this._offerAnsweredAt < 600 && front.id !== this._offerFrontId;
    this._offerFrontId = front?.id ?? null;
    if (arriving) this._offerTapBlockUntil = performance.now() + 450;
    const more = waiting.length ? `<span class="offer-peek p1" aria-hidden="true"></span>${waiting.length > 1 ? '<span class="offer-peek p2" aria-hidden="true"></span>' : ""}
      <span class="offer-more" role="note" aria-label="${waiting.length} more offer${waiting.length === 1 ? "" : "s"} waiting">${waiting.map((o) => this._av(this.players[o.fromId], "om-av")).join("")}<b>+${waiting.length} more</b></span>` : "";
    el.classList.toggle("has-more", waiting.length > 0);
    el.innerHTML = more + offers.map((o) => {
      const p = this.players[o.fromId];
      const ok = this._offerPossible(p, o.give, o.want, human);
      return `<div class="rush-offer${o.classic ? " classic" : ""}${this.hotseat ? " no-timer" : ""}${arriving ? " arriving" : ""}" data-offer="${o.id}" role="group" aria-label="${p.name} offers ${words(o.give)} for your ${words(o.want)}" style="--offer-ms:${CLASSIC_OFFER_MS}ms">
        ${this._av(p, "rush-offer-avatar")}
        <div class="rush-offer-body">
          <div class="rush-offer-deal"><span class="ol give">You give</span><span class="grp">${side(o.want)}${human && this._offerCostsBuild(human, o) ? `<span class="owarn" role="img" aria-label="You could not build ${this._offerCostsBuild(human, o)} after this" title="You could not build ${this._offerCostsBuild(human, o)} after this"><svg viewBox="0 0 20 18" aria-hidden="true"><path d="M10 1.5 19 16.5H1Z" fill="#F2B233" stroke="#8A5A00" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 6.5v5" stroke="#3A2600" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14" r="1.2" fill="#3A2600"/></svg></span>` : ""}</span><span class="ol get">You get</span><span class="grp">${side(o.give)}</span></div>
        </div>
        <button type="button" class="rush-offer-decline" data-decline="${o.id}" aria-label="Decline">${icon("close")}</button>
        <button type="button" class="rush-offer-accept" data-accept="${o.id}" aria-label="Accept: give ${words(o.want)}, get ${words(o.give)}" ${ok ? "" : "disabled"}>${icon("check")}</button>
        <span class="offer-time" aria-hidden="true"><i></i></span>
      </div>`;
    }).join("");
    const resolve = (id, yes) => {
      if (performance.now() < (this._offerTapBlockUntil || 0)) return; // the next card just came up
      this._guardPrimaryTap(650, el.querySelector(".rush-offer:last-child"));
      this._offerAnsweredAt = performance.now();
      return pit && !this.rush ? this.resolveIncomingTrade(yes) : this._resolveRushOffer(id, yes);
    };
    el.querySelectorAll("[data-accept]").forEach((b) => b.addEventListener("click", () => resolve(Number(b.dataset.accept), true)));
    el.querySelectorAll("[data-decline]").forEach((b) => b.addEventListener("click", () => resolve(Number(b.dataset.decline), false)));
    this._updateOfferTimers();
    this._setOfferRoom();
    // A new offer on top: briefly mark the cards it asks for in your hand
    const top = offers[offers.length - 1];
    if (top && top.id !== this._askedHighlightId) {
      this._askedHighlightId = top.id;
      n(top.want).forEach((r) => {
        const card = document.querySelector(`#resourceCardStrip .card[data-card="${r}"]`);
        if (card) this._pulseClass(card, "asked", 2600);
      });
    }
  }

  /** What you can build now but could not after accepting this offer ("a city"), or "" — the offer bar's only warning. */
  _offerCostsBuild(human, o) {
    const after = copyResources(human.resources);
    RESOURCES.forEach((r) => { after[r] += (o.give[r] || 0) - (o.want[r] || 0); });
    const names = { city: "a city", settlement: "a settlement", road: "a road", development: "a development card" };
    const k = Object.keys(names).find((t) => COSTS[t] && hasResources(human.resources, COSTS[t]) && !hasResources(after, COSTS[t]));
    return k ? names[k] : "";
  }

  /** Phones: while an offer is up the board's fit area ends above it, so the card never covers tiles. */
  _setOfferRoom() {
    if (!this.app) return;
    const card = this.rushOffersEl?.querySelector(".rush-offer:last-child");
    const mobile = this.isMobileLayout;
    const room = mobile && card ? Math.ceil(card.getBoundingClientRect().height) + 6 : 0;
    if (room === (this._offerRoom || 0)) return;
    const atFit = mobile && this._fitScale && Math.abs(this.view.scale - this._fitScale) < this._fitScale * 0.02;
    this._offerRoom = room;
    this.app.classList.toggle("offer-open", room > 0);
    this.app.style.setProperty("--offer-room", `${room}px`);
    this._renderAnalysis?.(); // the analysis panel moves above (or back down from) the offer card
    if (!mobile || !this.geometry) return;
    if (atFit) this._animateView(this._fitTarget(), 320);
    else { this._fitTarget(); this._clampView(); this._viewChanged(); }
  }

  /** Rush offers: the time-left bar follows the game clock (it stops while the game is paused). */
  _updateOfferTimers() {
    const r = this.rush;
    if (!r || !this.rushOffersEl) return;
    this.rushOffersEl.querySelectorAll("[data-offer]").forEach((card) => {
      const o = r.offers.find((x) => x.id === Number(card.dataset.offer));
      if (o) card.style.setProperty("--left", String(clamp((o.expiresAt - r.clockMs) / RUSH_OFFER_MS, 0, 1)));
    });
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
    // very soft ticks on the last three seconds (once per second)
    if (!r.paused && secs >= 1 && secs <= 3 && !this.uiPaused) {
      if (this._rushTickSec !== secs) { this._rushTickSec = secs; this.sfx.rushTick(secs === 1); }
    } else this._rushTickSec = null;
    const human = this._me();
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
    panel.classList.add("compact"); // a calm top banner: discards happen in the hand, the robber on the board
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
  // showGameOverOverlay() / removeGameOverOverlay(): the end-of-game flow lives in src/stats-ui.js

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
      sea: this.sea ? this.sea.toJSON() : null, // ⚓ Seafarers: pirate, bonuses, moves, gold picks
      shipEdges: this.sea ? this.geometry.edges.filter((e) => e.ship).map((e) => e.id) : undefined,
      players: this.players.map(p => ({
        isHuman: !!p.isHuman, // pass & play: who is a person
        name: p.name,
        resources: { ...p.resources },
        roads: [...p.roads],
        ...(this.sea ? { ships: [...p.ships] } : {}),
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
      pendingAction: this.pendingAction === "build" ? null : this.pendingAction, // v0.84: build mode / auto-glow comes back by itself
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
      sbp: this.sbp ? JSON.parse(JSON.stringify(this.sbp)) : null, // 5–6 players: mid build window
      stats: this._stSave(), // end-of-game statistics log (src/stats.js)
    };
  }

  saveToStorage() {
    if (this._saveTimer) { window.clearTimeout(this._saveTimer); this._saveTimer = null; }
    if (!this.geometry || !this.players?.length || this.onboardingHold) return;
    try {
      const json = JSON.stringify(this.serializeState());
      if (json === this._lastSavedJson) return;
      localStorage.setItem(ColonistFullGame.STORAGE_KEY, json);
      this._lastSavedJson = json;
    } catch (_) { /* quota exceeded or private mode — ignore */ }
  }

  // Every state change ends in render(), so render() queues a save: builds, bank and player
  // trades, accepted offers and dev-card buys/plays survive a reload (no "undo by reloading").
  // Coalesced (at most one write per 250 ms, never postponed by further renders); identical states
  // are not rewritten; pagehide / going to the background flush it immediately.
  _queueSave() {
    if (this._saveTimer) return;
    this._saveTimer = window.setTimeout(() => { this._saveTimer = null; this.saveToStorage(); }, 250);
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
    if (this._saveTimer) { window.clearTimeout(this._saveTimer); this._saveTimer = null; }
    this._lastSavedJson = null;
    try { localStorage.removeItem(ColonistFullGame.STORAGE_KEY); } catch (_) {}
  }

  /** Restore the saved game; `state` (a serializeState() object) restores that instead (AI Lab: watching quick games). */
  loadFromStorage(state = null) {
    let raw;
    if (!state) try { raw = localStorage.getItem(ColonistFullGame.STORAGE_KEY); } catch (_) { return false; }
    if (!state && !raw) return false;
    let data = state;
    if (!data) try { data = JSON.parse(raw); } catch (_) { this.clearStorage(); return false; }
    this._cancelPendingWork();
    // Older saves have no settings: Classic with the standard rules
    this.settings = normalizeSettings(data.settings || { ...DEFAULT_SETTINGS, numBots: (data.players?.length || 4) - 1 });
    this.diceDeck = Array.isArray(data.diceDeck) ? data.diceDeck : [];
    this.lastDiceTotal = data.lastDiceTotal ?? null;
    this.rush = null;

    // Rebuild geometry (deterministic layout); 30 tiles = the 5–6 player island, ⚓ or the Seafarers board
    this.bigBoard = data.hexes?.length === 30 && !this._seaLayout();
    this.bankSize = this.bigBoard ? BIG_BANK_SIZE : BANK_SIZE;
    this.sbp = null;
    this.sbpRecent = null;
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight, this._seaLayout(), this.bigBoard);

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
    this.viewerId = null; // pass & play: the cover asks who holds the phone
    this._hsLastAck = null; // v0.86: nobody has tapped "I'm …" in this game yet
    this.handHidden = true;
    this._hsNote = null;
    this._hsSecrets = null;
    this.players = data.players.map((saved, id) => {
      const config = PLAYER_CONFIG[id];
      const spec = seatSpec(this.settings, id);
      const seat = typeof saved.isHuman === "boolean" ? { ...spec, isHuman: id === 0 || saved.isHuman, name: saved.name || spec.name } : spec;
      if (seat.name !== spec.name) seat.short = seat.name === config.name ? config.short : seat.name.length > 9 ? `${seat.name.slice(0, 8)}…` : undefined;
      return {
        id,
        name: seat.name,
        fullName: config.fullName,
        short: seat.short,
        color: config.color,
        isHuman: seat.isHuman,
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
        strategy: seat.isHuman ? null : (saved.strategy ? { ...saved.strategy } : { ...DEFAULT_AI_STRATEGY }),
        personality: seat.isHuman ? null : (saved.personality || presetForStrategy(saved.strategy || DEFAULT_AI_STRATEGY)),
        rushDevPlayed: !!saved.rushDevPlayed,
        rushTradeTried: !!saved.rushTradeTried,
      };
    });
    this._seaRestore(data); // ⚓ game.sea + ships (null in a normal game)
    // Older saves have no bank: everything not in a hand is in the bank
    this.bank = makeFullBank(this.bankSize);
    RESOURCES.forEach((r) => {
      this.bank[r] = data.bank && Number.isFinite(data.bank[r])
        ? data.bank[r]
        : this.bankSize - this.players.reduce((sum, p) => sum + (p.resources[r] || 0), 0);
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
    this._stRestore(data.stats); // the statistics log travels with the save (src/stats.js)
    if (data.sbp && this.phase === "sbp" && Array.isArray(data.sbp.order)) this.sbp = data.sbp;
    else if (this.phase === "sbp") this.phase = "main"; // a damaged save: let the turn owner carry on

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
    // Resumed games always open fitted: refit once the layout (hand fan, browser bars) has settled,
    // unless the player has already zoomed in by then.
    window.setTimeout(() => { if (!this._userZoomed && this.geometry) { this.fitCanvasToContainer(); this.fitView(); this.render(); } }, 350);
    if (this.onboardingHold) return true; // behind the home screen: resumes on Continue
    if (this.winner) {
      this.showGameOverOverlay();
    } else if (this.setupPhase) {
      this.processSetupQueue();
    } else if (this.isRush()) {
      const saved = data.rush || {};
      if (saved.seven && saved.seven.leftMs == null) saved.seven.leftMs = Infinity;
      if (Array.isArray(data.robberVictimOptions) && data.robberVictimOptions.length) {
        this.robberVictimOptions = data.robberVictimOptions;
        this.showVictimPanel(this._me(), this.robberVictimOptions);
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
      if (this.sbp) this._sbpResume(); // inside the Special Building Phase (5–6 players)
      else if (!this.currentPlayer.isHuman) this.scheduleAiTurnsUntilHuman();
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
    // v0.76: pips scale with the token (smaller for 2/12) and hang a fixed gap under the digits' baseline
    const ps = 0.75 + 0.25 * (pips / 5);
    const radius = 2.2 * s * ps;
    const spacing = 5.2 * s * ps;
    const startX = hex.center.x - ((pips - 1) * spacing) / 2;
    const fs = Math.round(this.geometry.hexSize * 0.38 * ps);
    const y = hex.center.y + fs * 0.22 + 5.5 * s * ps;
    ctx.fillStyle = hex.number === 6 || hex.number === 8 ? "#be1a1a" : "#18212c";
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
      // v0.76: digits sit on their baseline so the pips (drawTokenPips) keep a steady gap below them
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(hex.number), hex.center.x, hex.center.y + Math.round(hxs * 0.38 * probScale) * 0.22);
      ctx.textBaseline = "middle";
      this.drawTokenPips(hex);
    }

    const label = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource] || TERRAIN_NAME[hex.resource]; // ⚓ "Gold field"
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

  /** Classic harbours (v0.78): the same pill as the themed boards (harbourBadges) — the resource glyph (the card
   *  icon without its coloured tile, so a brick harbour never reads as a red player) beside the ratio in bold, or
   *  just "3:1"; two piers to the coast corners, each with a small accent dot 12.5 px out (v0.86, see pierDot; none on
   *  a corner that holds a piece). */
  drawPorts() {
    const ctx = this.ctx, g = this.geometry, u = g.hexSize / 100, s = harbourScale(this);
    const portColor = { wood: "#4a7c3f", brick: "#b5532e", sheep: "#5f9a36", wheat: "#b8931f", ore: "#6a7588", any: "#3d5f72" };
    if (!this._portImgs) {
      this._portImgs = {};
      // the card icons sit on a coloured rounded tile: drop the tile (the first two <rect>s), keep the glyph
      Object.entries(RESOURCE_ICON_PATH).forEach(([r, src]) => {
        const im = new Image(); im.onload = () => this.render?.(); this._portImgs[r] = im;
        fetch(src).then((res) => res.text()).then((svg) => { im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/<rect x="4" y="4"[^>]*\/>/, "").replace(/<rect x="8" y="8"[^>]*\/>/, "")); }).catch(() => { im.src = src; });
      });
    }
    const badges = harbourBadges(this, s);
    this.ports.forEach((port, pi) => {
      const q = badges[pi]; if (!q) return;
      const W = q.w * u, H = q.h * u;
      let bx = g.centerX + q.x * u, by = g.centerY + q.y * u;
      // zoomed in: keep the whole pill on screen (its piers follow)
      const shift = this._keepOnScreen(bx - W / 2, by - H / 2, W, H);
      bx += shift.x; by += shift.y;
      const P = (x, y) => [bx + (x - q.x) * u, by + (y - q.y) * u];
      const color = portColor[port.type] || portColor.any;
      const W2 = (p) => ({ x: g.centerX + p.x * u, y: g.centerY + p.y * u });
      const pairs = q.piers.map(([n, e, kn]) => [W2(n), P(e[0], e[1]), kn && W2({ x: kn[0], y: kn[1] })]);
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      pairs.forEach(([n, e, kn]) => {
        ctx.beginPath(); ctx.moveTo(n.x, n.y); if (kn) ctx.lineTo(kn.x, kn.y); ctx.lineTo(e[0], e[1]);
        ctx.strokeStyle = "#6b5236"; ctx.lineWidth = 6 * s * u; ctx.stroke();
        ctx.strokeStyle = "#c9a874"; ctx.lineWidth = 3.4 * s * u; ctx.stroke();
      });
      q.piers.forEach((pr) => {
        if (g.nodes[pr[0].id]?.structure) return;
        const t = pierDot(pr, u * (this._fitScale || this.view.scale || 1), q), w = W2(t);
        if (t.hidden) return;
        drawPierDot(ctx, { x: w.x, y: w.y, r: t.r * u, ri: t.ri * u }, color, "rgba(245, 239, 228, .95)");
      });
      // pill: cream, the resource colour only as an outline accent
      ctx.shadowColor = "rgba(15, 23, 34, 0.35)"; ctx.shadowBlur = 5 * s * u; ctx.shadowOffsetY = 2 * s * u;
      this.drawRoundedRect(bx - W / 2, by - H / 2, W, H, (q.r) * u);
      ctx.fillStyle = q.icon ? "#f5efe4" : "#F7F1E3"; ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = q.icon ? color : "#b9a786"; ctx.lineWidth = (q.icon ? 2.4 : 1.6) * s * u; ctx.stroke();
      if (q.icon) {
        const [ix, iy] = P(q.icon.x, q.icon.y), is = q.icon.size * u * 1.2;
        const im = this._portImgs[port.type];
        if (im && im.complete && im.naturalWidth) {
          // the glyph as a solid silhouette in the resource colour (cached per type)
          this._portGlyphs = this._portGlyphs || {};
          let gc = this._portGlyphs[port.type];
          if (!gc) {
            gc = document.createElement("canvas"); gc.width = gc.height = 128;
            const x2 = gc.getContext("2d"); x2.drawImage(im, 0, 0, 128, 128);
            x2.globalCompositeOperation = "source-in"; x2.fillStyle = color; x2.fillRect(0, 0, 128, 128);
            this._portGlyphs[port.type] = gc;
          }
          ctx.drawImage(gc, ix - is / 2, iy - is / 2, is, is);
        }
      }
      const [tx, ty] = P(q.text.x, q.text.y);
      ctx.fillStyle = "#1a3a52"; ctx.font = `800 ${q.text.size * u}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(port.type === "any" ? "3:1" : "2:1", tx, ty);
      ctx.restore();
    });
  }

  /** World-space offset that moves a world-space box fully inside the visible part of the canvas (6px margin). */
  _keepOnScreen(x, y, w, h) {
    const k = this.view.scale || 1;
    const M = 6;
    // visible part of the canvas, in canvas units (the canvas can be wider than the screen)
    let minX = M, maxX = this.boardWidth - M, minY = M, maxY = this.boardHeight - M;
    const r = this.canvas.getBoundingClientRect();
    if (r.width) {
      const ux = this.boardWidth / r.width, uy = this.boardHeight / r.height;
      minX = Math.max(minX, (M - r.left) * ux); maxX = Math.min(maxX, (window.innerWidth - M - r.left) * ux);
      minY = Math.max(minY, (M - r.top) * uy); maxY = Math.min(maxY, (window.innerHeight - M - r.top) * uy);
    }
    const a = this.worldToScreen(x, y), bw = w * k, bh = h * k;
    let dx = 0, dy = 0;
    if (bw <= maxX - minX) { if (a.x < minX) dx = minX - a.x; else if (a.x + bw > maxX) dx = maxX - (a.x + bw); }
    if (bh <= maxY - minY) { if (a.y < minY) dy = minY - a.y; else if (a.y + bh > maxY) dy = maxY - (a.y + bh); }
    return { x: dx / k, y: dy / k };
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

  /** Legal spots while the human places something (setup or build mode), or null. Shared by both renderers. */
  /** Legal spots for the current placement: settlement nodes, city nodes (own settlements), roads. */
  _legalPlacementSpots() {
    const player = this.currentPlayer;
    if (!player?.isHuman || this.winner) return null;
    const nodes = [], cities = [], edges = [];
    const g = this.geometry;
    if (this.setupPhase) {
      if (!this.setupAction) return null;
      if (this.setupAction === "settlement") g.nodes.forEach((n) => { if (this.canBuildSettlement(player, n.id, true)) nodes.push(n.id); });
      else if (this.setupAction === "road" && this.lastSetupNodeId != null && this.sea) return { nodes, cities, ...this._seaSetupSpots(player), type: "road" }; // ⚓
      else if (this.setupAction === "road" && this.lastSetupNodeId != null) g.edges.forEach((e) => { if (e.owner == null && e.nodes.includes(this.lastSetupNodeId)) edges.push(e.id); });
      return { nodes, cities, edges, type: this.setupAction };
    }
    const type = this.pendingAction;
    if (!type || type === "robber") return null;
    if (type === "moveShip") return { nodes, cities, edges, ships: this.sea?.moveSel?.targets || [], type }; // ⚓
    const free = this.freeRoadsRemaining > 0;
    const all = type === "build" && !free;
    const ships = [];
    if (type === "settlement" || all) g.nodes.forEach((n) => { if (this.canBuildSettlement(player, n.id, false)) nodes.push(n.id); });
    if (type === "city" || all) g.nodes.forEach((n) => { if (this.canBuildCity(player, n.id, false)) cities.push(n.id); });
    if (type === "road" || all || (type === "build" && free)) g.edges.forEach((e) => { if (this.canBuildRoad(player, e.id, { free })) edges.push(e.id); });
    // ⚓ Seafarers: ship spots (a coast edge that also takes a road is shown as a road spot)
    if (this.sea && (type === "ship" || all || free)) g.edges.forEach((e) => { if (this.canBuildShip(player, e.id, { free }) && (type === "ship" || !edges.includes(e.id))) ships.push(e.id); });
    // v0.84 auto-glow (phones): calm — roads / ships only light up while no settlement or city can be built
    if (all && this.isMobileLayout && (nodes.length || cities.length)) return { nodes, cities, edges: [], ships: [], type, calm: true };
    return { nodes, cities, edges, ships, type };
  }

  /** v0.82: no land dim while placing any more (kept as a no-op for the draw order). */
  _dimForPlacement() { this._dimFrom = null; }

  /** Classic board: legal spots only, kept quiet (v0.82, as on the themed boards): a thin soft white ring with a
   *  small dot of your colour at each corner, thin faint dashes in your colour for roads; only a very slow faint
   *  opacity drift (none with reduced motion). Tap targets are unchanged. */
  drawBuildableHighlights() {
    const spots = this._legalPlacementSpots();
    if (!spots) return;
    const ctx = this.ctx;
    const px = 1 / (this.view.scale || 1); // world units per CSS pixel
    const cb = this.confirmBuild;
    const pc = this._classicPc(this.currentPlayer.id);
    const now = performance.now(), key = `${spots.type}:${spots.nodes.join(",")}:${(spots.cities || []).join(",")}:${spots.edges.join(",")}`;
    if (key !== this._spotKey) { this._spotKey = key; this._spotStart = now; }
    const reduced = motionReduced();
    const e = reduced ? 1 : Math.min(1, (now - this._spotStart) / 500);
    const br = reduced ? 0.5 : 0.5 - 0.5 * Math.cos(((now - this._spotStart) / 3600) * Math.PI * 2);
    const fade = e * (0.82 + 0.18 * br);
    const busy = spots.nodes.length + (spots.cities || []).length > 20 ? [0.5, 0.7] : [1, 1]; // set-up: quieter dots
    // v0.84: one piece chosen on the build card: its spots a little stronger (ring, dot, dashes)
    const k = !this.setupPhase && ["road", "settlement", "city", "ship"].includes(spots.type) ? 1.35 : 1;
    ctx.save();
    ctx.lineCap = "round";
    spots.edges.forEach((id) => {
      if (cb && cb.type === "road" && cb.id === id) return;
      const [a, b] = this.geometry.edges[id].nodes.map((n) => this.geometry.nodes[n]);
      const t = 0.22, ax = a.x + (b.x - a.x) * t, ay = a.y + (b.y - a.y) * t, bx = b.x - (b.x - a.x) * t, by = b.y - (b.y - a.y) * t;
      ctx.globalAlpha = Math.min(1, 0.75 * k) * fade; ctx.setLineDash([4 * px, 5 * px]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.strokeStyle = pc.base; ctx.lineWidth = 2.5 * k * px; ctx.stroke();
    });
    ctx.setLineDash([]);
    [...spots.nodes.map((id) => [id, false]), ...(spots.cities || []).map((id) => [id, true])].forEach(([id, isCity]) => {
      if (cb && cb.id === id && cb.type !== "road") return;
      const n = this.geometry.nodes[id];
      const r = isCity ? 15 * px : 7 * px;
      ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = k > 1 ? "rgba(255, 255, 255, 0.82)" : "rgba(255, 255, 255, 0.55)"; ctx.lineWidth = 1.5 * k * px; ctx.stroke();
      if (!isCity) {
        ctx.globalAlpha = fade * busy[0];
        ctx.beginPath(); ctx.arc(n.x, n.y, 3 * busy[1] * (k > 1 ? 1.2 : 1) * px, 0, Math.PI * 2); ctx.fillStyle = pc.base; ctx.fill();
        ctx.strokeStyle = pc.line; ctx.lineWidth = 0.8 * px; ctx.stroke();
      }
    });
    ctx.restore();
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

      // v0.79: the themed boards' road (src/themes/board-renderer.js strokeRoad) on the hand-drawn curve: a soft
      // shadow, a light rim, the piece's dark line, its base colour and a light top stroke, sized like the themed pieces
      const pc = this._classicPc(edge.owner), w = (this.isMobileLayout ? 1.25 : 1.05) * 0.74 * s; // 0.74·s = one art unit
      // v0.82: each road is its own piece — the curve stops short of both nodes (cap radius + a small joint, as on the
      // themed boards), so neighbouring roads never melt into one stroke
      const L = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, t0 = Math.min(0.3, (7 * w + 4 * 0.74 * s) / L), t1 = 1 - t0;
      const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const sub = (P, ta, tb) => { // de Casteljau: the part of the cubic between ta and tb
        const split = (Q, t) => { const a = lerp(Q[0], Q[1], t), b = lerp(Q[1], Q[2], t), c = lerp(Q[2], Q[3], t), d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t); return [[Q[0], a, d, f], [f, e, c, Q[3]]]; };
        const right = split(P, ta)[1]; return split(right, (tb - ta) / (1 - ta))[0]; };
      const C = sub([{ x: p1.x, y: p1.y }, { x: cp.cp1x, y: cp.cp1y }, { x: cp.cp2x, y: cp.cp2y }, { x: p2.x, y: p2.y }], t0, t1);
      const curve = () => { ctx.beginPath(); ctx.moveTo(C[0].x, C[0].y); ctx.bezierCurveTo(C[1].x, C[1].y, C[2].x, C[2].y, C[3].x, C[3].y); };
      ctx.save(); ctx.translate(1.5 * s, 2.6 * s); curve(); ctx.strokeStyle = "rgba(13, 17, 25, 0.35)"; ctx.lineWidth = 16 * w; ctx.stroke(); ctx.restore();
      curve(); ctx.strokeStyle = "rgba(255, 252, 242, 0.5)"; ctx.lineWidth = 16.5 * w; ctx.stroke();
      curve(); ctx.strokeStyle = pc.line; ctx.lineWidth = 14 * w; ctx.stroke();
      curve(); ctx.strokeStyle = pc.base; ctx.lineWidth = 10 * w; ctx.stroke();
      ctx.save(); ctx.translate(-0.6 * s, -1 * s); ctx.globalAlpha = 0.85; curve(); ctx.strokeStyle = pc.light; ctx.lineWidth = 2.2 * w; ctx.stroke(); ctx.restore();
    });

  }

  drawStructures() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;

    // v0.81: the legal spots (setup and build mode) are drawn once, by drawBuildableHighlights (no blue blink here)
    // v0.79: the themed boards' pieces (Sunny Island house / city specs, drawn with the same drawSpec) in the seat's
    // piece shades, at the themed size (one art unit = 0.74·s here; the themed renderer's piece scale 1.34 / 1.12)
    const BP = this.theme.boardPieces;
    this.geometry.nodes.forEach((node) => {
      if (node.owner == null || node.structure == null) return;
      const pc = this._classicPc(node.owner);
      const isCity = node.structure === "city";
      const k = 0.74 * s * (this.isMobileLayout ? 1.34 : 1.12);
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.scale(k, k);
      ctx.translate(0, isCity ? BP.cityDy : BP.settlementDy);
      drawSpec(ctx, isCity ? BP.city(pc) : BP.settlement(pc), { k: Math.abs(ctx.getTransform().a), rim: BP.rim, rimW: BP.rimW });
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
    const ic = this.getConfirmIconCenter();
    const cx = ic.x;

    // Position icon above the spot
    const iconY = ic.y;
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
    } else {
      // Robber: a check mark
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(-2, 6); ctx.lineTo(9, -7);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
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
    if (cb.type === "robber") return { ...this.geometry.hexes[cb.id].center };
    if (cb.type === "road" || cb.type === "ship") {
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
    const p = this.getBuildPosition(cb);
    // robber: the ✓ floats over the top of the chosen tile
    return { x: p.x, y: p.y - (cb.type === "robber" ? this.geometry.hexSize * 0.55 : 30 * s), r: 16 * s };
  }

  hitTestConfirmIcon(worldX, worldY) {
    // v0.73: phones draw no ✓ on the board (the Place pill confirms), so a finger must never hit an
    // invisible one: its zone sat right above the picked spot and swallowed taps on the corner above
    // a picked road, building the road. Only Place's own synthetic tap (_confirmViaIcon) gets through.
    if (this.isMobileLayout && !this._viaIcon) return false;
    const icon = this.getConfirmIconCenter();
    if (!icon) return false;
    // Use a generous hit radius for touch
    const hitR = icon.r * 1.8;
    const dx = worldX - icon.x;
    const dy = worldY - icon.y;
    return dx * dx + dy * dy <= hitR * hitR;
  }

  drawRobberModeOverlay() {
    if (this.pendingAction !== "robber" || !this.currentPlayer?.isHuman) return;
    const ctx = this.ctx;
    const px = 1 / (this.view.scale || 1);
    const mover = this.currentPlayer;
    const legal = new Set(this._legalRobberHexes(mover).map((h) => h.id));
    const sel = this.confirmBuild?.type === "robber" ? this.confirmBuild.id : null;
    this.geometry.hexes.forEach((hex) => {
      if (!legal.has(hex.id)) {
        // Current robber location / friendly-robber protected: dimmed, not a target
        this.drawHexPath(hex.corners, true);
        ctx.fillStyle = "rgba(10, 25, 35, 0.42)";
        ctx.fill();
        return;
      }
      if (hex.id === sel || hex.id === this.hoverHexId) {
        // v0.82: a thin soft outline on the tile under the finger / the picked one (no heavy white rim)
        this.drawHexPath(hex.corners, true);
        ctx.strokeStyle = "rgba(20, 32, 36, 0.3)";
        ctx.lineWidth = 2 * px;
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
    const human = this._me();
    if (!human || !this.resourceCardStrip) return;
    const devCounts = {};
    DEV_CARD_TYPES.forEach((t) => { devCounts[t] = human.devCards[t] + human.newDevCards[t]; });
    devCounts.victoryPoint = human.devVictoryPoints;
    const total = sumResources(human.resources);
    const devTotal = Object.values(devCounts).reduce((a, b) => a + b, 0);
    const lbl = this.handSummary?.parentElement;
    if (lbl?.firstChild?.nodeType === 3) lbl.firstChild.textContent = this.hotseat && !this.handHidden ? `${human.name}'s hand ` : "Your hand ";
    if (this.handSummary) this.handSummary.textContent = `${total} resource card${total === 1 ? "" : "s"} · ${devTotal} development card${devTotal === 1 ? "" : "s"}`;
    this.renderHandBar(human, total, devTotal);
    const pd = this.pendingDiscard?.player === human ? this.pendingDiscard : null;
    this.handArea?.classList.toggle("discarding", !!pd);
    // v0.84: dev cards carry their state in the hand: ready (playable now), new ("next turn"), VP; a tap selects one
    const devState = (t) => (t === "victoryPoint" ? "vp" : human.devCards[t] === 0 ? "next" : this._devReady(human, t) ? "ready" : "held");
    if (this.devSel && !(devCounts[this.devSel] > 0) || this.handHidden || pd) this.devSel = null;
    const devStates = [...DEV_CARD_TYPES, "victoryPoint"].map((t) => (devCounts[t] ? devState(t) : ""));
    this._renderHandTotal(human, total, devTotal, pd);
    const key = JSON.stringify([human.id, this.handHidden, human.resources, devCounts, human.newDevCards, this.theme.id, this.isMobileLayout, pd?.selected || null, this._newDevPulse || null, devStates, this.devSel, this.isRush()]);
    if (key === this._lastHandKey) { this._placeDevBubble(); return; }
    this._lastHandKey = key;
    this._syncTradeSheet();
    const devTypes = [...DEV_CARD_TYPES, "victoryPoint"].filter((t) => devCounts[t] > 0);
    const n = RESOURCES.length + devTypes.length;
    // Mobile: a gentle fan (±3°); desktop ignores the rotation
    const fan = (i) => `--rot:${((i - (n - 1) / 2) * 2.6).toFixed(1)}deg;--dy:${(Math.abs(i - (n - 1) / 2) * 1.6).toFixed(1)}px`;
    let html = RESOURCES.map((r, i) => {
      const c = human.resources[r];
      // 0 of a kind: an empty outlined slot (small icon, name, "0"), never a faded picture that reads as a card you hold
      if (!c) return `<button type="button" class="card empty slot" data-card="${r}" style="${fan(i)}" aria-label="${RESOURCE_LABEL[r]}: none" title="No ${RESOURCE_LABEL[r]}"><span class="slot-ic">${icon(r)}</span><span class="slot-n">0</span><span class="slot-name">${RESOURCE_LABEL[r]}</span></button>`;
      if (pd) {
        // discarding: the badge shows what you keep, the tag what goes back
        // v0.81: the card keeps its full count, big; a card you hand back from lifts, with a chip in
        // its own tone ("−2 of 4") and a "−" that puts one back. Tapping a fully picked card puts one back too.
        const sel = pd.selected[r];
        return `<button type="button" class="card dcard${sel ? " marked" : ""}" data-card="${r}" style="${fan(i)}" data-n="${Math.min(c, 4)}" aria-label="${RESOURCE_LABEL[r]}: ${c}${sel ? `, ${sel} to hand back` : ""}" title="Tap to hand back one ${RESOURCE_LABEL[r]}">${cardSvg(r)}<span class="count">${c}</span><span class="rib" aria-hidden="true"><b>${c}</b><span>${RESOURCE_LABEL[r]}</span></span>${sel ? `<span class="dsel"><b>−${sel}</b><small>of ${c}</small><span class="dminus" data-unmark="${r}" role="button" aria-label="Put one ${RESOURCE_LABEL[r]} back">−</span></span>` : ""}</button>`;
      }
      return `<button type="button" class="card" data-card="${r}" style="${fan(i)}" aria-label="${RESOURCE_LABEL[r]}: ${c}" title="${RESOURCE_LABEL[r]} — tap to trade" data-n="${Math.min(c, 4)}">${cardSvg(r)}<span class="count">${c}</span><span class="rib" aria-hidden="true"><b>${c}</b><span>${RESOURCE_LABEL[r]}</span></span></button>`;
    }).join("");
    if (devTypes.length) {
      const when = this.isRush() ? "after roll" : "next turn";
      html += '<span class="sep"></span>' + devTypes.map((t, j) => {
        const st = devState(t);
        const fresh = st === "next";
        const name = DEV_NAME[t];
        const sel = this.devSel === t;
        const tag = st === "vp" ? '<span class="dtag dt-vp" aria-hidden="true">+1 VP</span>' : fresh ? `<span class="dtag dt-nx" aria-hidden="true">${when}</span>` : "";
        const play = sel && st === "ready" ? `<span class="dplay" data-dev-go="${t}" role="button" aria-label="Play ${name}">Play</span>` : "";
        return `<button type="button" class="card dev ds-${st}${fresh ? " new" : ""}${sel ? " dsel-on" : ""}${this._newDevPulse === t ? " drawn" : ""}" data-dev="${t}" style="${fan(RESOURCES.length + j)}" aria-pressed="${sel}" aria-label="${name}: ${devCounts[t]}${fresh ? ` (playable ${when})` : st === "ready" ? " (tap to play)" : ""}" title="${name}: ${CARD_TEXT[t]}${fresh ? ` — playable ${when}` : ""}" data-n="${Math.min(devCounts[t], 4)}">${cardSvg(t)}<span class="count">${devCounts[t]}</span><span class="rib" aria-hidden="true"><b>${devCounts[t]}</b><span>${name}</span></span>${tag}${play}</button>`;
      }).join("");
    }
    this.resourceCardStrip.innerHTML = html;
    this.resourceCardStrip.querySelectorAll(".card[data-card]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (this.pendingDiscard?.player === human) {
          if (e.target.closest("[data-unmark]")) this._discardUnmark(el.dataset.card);
          else this._discardMark(el.dataset.card, true);
          return;
        }
        if (!this.currentPlayer?.isHuman || this.phase !== "main" || this.tradeLocked || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */ || this.devPick) return;
        const res = el.dataset.card;
        if (human.resources[res] <= 0) return;
        // Open trade with this card picked as "give" (the bank route applies your rate by itself)
        this.toggleBuildSheet(false);
        this.hideDevCardPicker();
        if (this.tradeModal.style.display === "none") this.openTradeModal();
        if (this.tradeModal.style.display === "none") return;
        this.tradeOffer[res] = Math.min(human.resources[res], (this.tradeOffer[res] || 0) + 1);
        if (this.tradeRequest[res]) this.tradeRequest[res] = 0;
        this._clearTradeAnswers();
        this._refreshTradeGrids();
        this.sfx.click();
      });
    });
    this.resourceCardStrip.querySelectorAll(".card[data-dev]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.pendingDiscard || this.devPick) return;
        const t = el.dataset.dev;
        if (e.target.closest("[data-dev-go]") && this.devSel === t) { this._playSelectedDev(t); return; }
        this._selectDev(this.devSel === t ? null : t);
      });
    });
    this._placeDevBubble();
    const strip = this.resourceCardStrip;
    window.requestAnimationFrame(() => this.handArea?.classList.toggle("fits", strip.scrollWidth <= strip.clientWidth + 2));
  }

  /** v0.84: a development card can be played from the hand right now (your turn, the holder's own move). */
  _devReady(human, t) {
    if (!human || t === "victoryPoint" || this.devPick || this.pendingDiscard) return false;
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway() || this.handHidden)) return false;
    if (this._seaHumanBlocked?.()) return false;
    return this.canPlayDevelopmentCard(human, t);
  }

  /** v0.84: tap a development card in the hand: it lifts with its effect in a bubble (and Play when it can be played). */
  _selectDev(t) {
    if (t && (this.pendingDiscard || this.devPick || this.handHidden)) return;
    if (t && this.hotseat && (this.hsCoverOn != null || this._hsAway())) return;
    this._closeHandInfo();
    this.devSel = t || null;
    this.sfx.click();
    this.renderResourceCards();
  }

  _playSelectedDev(t) {
    const human = this._me();
    this.devSel = null;
    if (!this._devReady(human, t)) { this._flashPrompt(this._devWhyNot(t)); this.render(); return; }
    this.handleHumanPlayDevCard(t);
  }

  /** The one-line effect bubble over the selected card (fixed, so it never scrolls with the fan). */
  _placeDevBubble() {
    let b = document.getElementById("devBubble");
    const t = this.devSel;
    const el = t ? this.resourceCardStrip?.querySelector(`.card[data-dev="${t}"]`) : null;
    if (!el) { if (b) b.hidden = true; return; }
    if (!b) {
      b = document.createElement("div");
      b.id = "devBubble"; b.className = "dev-bubble"; b.setAttribute("role", "status");
      (this.app || document.body).appendChild(b);
    }
    const human = this._me();
    const st = t === "victoryPoint" ? "vp" : human.devCards[t] === 0 ? "next" : this._devReady(human, t) ? "ready" : "held";
    const sub = st === "vp" ? "Counts at once" : st === "next" ? `New card · play it ${this.isRush() ? "after the next roll" : "next turn"}` : st === "held" ? this._devWhyNot(t) : "";
    const html = `<b>${DEV_NAME[t]}</b> · ${DEV_EFFECT[t]}${sub ? `<small>${sub}</small>` : ""}`;
    if (b.__html !== html) { b.__html = html; b.innerHTML = html; }
    b.hidden = false;
    b.dataset.state = st;
    const place = () => {
      if (this.devSel !== t || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      // v0.86 landscape phones: the hand is a grid in the side column, so the bubble sits to the card's left
      const side = !!this.isLandscapePhone;
      b.classList.toggle("side", side);
      if (side) {
        const bw = Math.min(b.offsetWidth, r.left - 16), bh = b.offsetHeight;
        const y = Math.max(8, Math.min(window.innerHeight - 8 - bh, r.top + r.height / 2 - bh / 2));
        b.style.left = `${Math.max(8, r.left - 10 - bw)}px`; b.style.top = `${y}px`; b.style.bottom = "auto";
        b.style.setProperty("--ay", `${Math.round(r.top + r.height / 2 - y)}px`);
        return;
      }
      b.style.top = "";
      const W = window.innerWidth, w = Math.min(b.offsetWidth, W - 16);
      const x = Math.max(8, Math.min(W - 8 - w, r.left + r.width / 2 - w / 2));
      b.style.left = `${x}px`;
      b.style.bottom = `${window.innerHeight - r.top + 8}px`;
      b.style.setProperty("--ax", `${Math.round(r.left + r.width / 2 - x)}px`);
    };
    place();
    window.requestAnimationFrame(place);
    window.setTimeout(place, 240); // after the lift transition
  }

  /** v0.84: your totals as a small pill over the hand (the bank + totals popover opens from it). */
  _renderHandTotal(human, total, devTotal, pd) {
    if (!this.handArea) return;
    let el = this.handTotalEl;
    if (!el) {
      el = this.handTotalEl = document.createElement("button");
      el.type = "button"; el.id = "handTotal"; el.className = "hand-total";
      el.addEventListener("click", (e) => { e.stopPropagation(); this._toggleHandInfo(); });
      this.handArea.appendChild(el);
    }
    const limit = this.settings?.discardLimit ?? 7;
    const over = total > limit;
    const who = this.hotseat && !this.handHidden ? human : null;
    const key = [total, devTotal, over, who?.id, who?.name, !!pd, this.handHidden, this.theme?.id].join("|");
    el.hidden = !!pd || !!this.handHidden;
    if (el.__key === key) { if (this._handInfoOpen) this._renderHandInfo(); return; }
    el.__key = key;
    el.classList.toggle("warn", over);
    el.className = `hand-total${over ? " warn" : ""}${who ? ` named pc-${who.id}` : ""}`;
    el.setAttribute("aria-label", `${who ? `${who.name}: ` : ""}${total} resource card${total === 1 ? "" : "s"}, ${devTotal} development card${devTotal === 1 ? "" : "s"}${over ? `, more than ${limit}` : ""}. Tap for the bank`);
    el.innerHTML = `${who ? `<i class="ht-dot" aria-hidden="true"></i><span class="ht-who">${who.name}</span>` : ""}${icon("cards")}<b>${total}</b>${devTotal ? `<span class="ht-dev">${icon("devcard")}<b>${devTotal}</b></span>` : ""}<span class="ht-bank" aria-hidden="true">${icon("bank")}</span>`;
    if (this._handInfoOpen) this._renderHandInfo();
  }

  _toggleHandInfo(open = !this._handInfoOpen) {
    if (open && (this.handHidden || this.pendingDiscard)) return;
    this._handInfoOpen = open;
    if (open) { this.devSel = null; this.renderResourceCards(); this.sfx.click(); }
    this._renderHandInfo();
  }

  _closeHandInfo() { if (this._handInfoOpen) this._toggleHandInfo(false); }

  /** The bank + totals popover: compact labels only (numbers first). */
  _renderHandInfo() {
    let pop = document.getElementById("handInfo");
    const human = this._me();
    if (!this._handInfoOpen || !human || !this.handTotalEl || this.handTotalEl.hidden) { if (pop) pop.hidden = true; this._handInfoOpen = false; return; }
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "handInfo"; pop.className = "hand-info"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Your cards and the bank");
      (this.app || document.body).appendChild(pop);
    }
    const total = sumResources(human.resources);
    const dev = [...DEV_CARD_TYPES.map((t) => [t, human.devCards[t] + human.newDevCards[t]]), ["victoryPoint", human.devVictoryPoints]].filter(([, n]) => n > 0);
    const devTotal = dev.reduce((a, [, n]) => a + n, 0);
    const limit = this.settings?.discardLimit ?? 7;
    const deck = this.devDeck ? this.devDeck.length : 0;
    const mini = (k, n, low) => `<span class="hi-c${low ? " low" : ""}"><svg class="hi-card" viewBox="0 0 250 350" aria-hidden="true"><use href="#cardm-${k}"/></svg><b>${n}</b></span>`;
    const who = this.hotseat ? `${human.name}` : "You";
    pop.innerHTML = `<div class="hi-h"><span>${who}</span><span class="hi-n${total > limit ? " warn" : ""}">${icon("cards")}<b>${total}</b>${total > limit ? `<small>max ${limit}</small>` : ""}</span><span class="hi-n">${icon("devcard")}<b>${devTotal}</b></span></div>`
      + (dev.length ? `<div class="hi-dev">${dev.map(([t, n]) => `<span>${n > 1 ? `${n}× ` : ""}${t === "victoryPoint" ? "VP" : SHORT_DEV[t]}</span>`).join("")}</div>` : "")
      + `<div class="hi-h hi-bank"><span>${icon("bank")}Bank</span></div>`
      + `<div class="hi-row">${RESOURCES.map((r) => mini(r, this.bank[r], this.bank[r] <= 3)).join("")}<i class="hi-sep" aria-hidden="true"></i>${mini("knight", deck, deck <= 3).replace("hi-c", "hi-c hi-deck")}</div>`;
    pop.hidden = false;
    const r = this.handTotalEl.getBoundingClientRect();
    // v0.86 landscape phones: the pill heads the side column, so the popover opens below it, to its left edge
    const below = !!this.isLandscapePhone;
    pop.classList.toggle("below", below);
    if (below) { pop.style.top = `${r.bottom + 8}px`; pop.style.bottom = "auto"; }
    else { pop.style.top = ""; pop.style.bottom = `${window.innerHeight - r.top + 8}px`; }
    const pr = pop.getBoundingClientRect();
    pop.style.setProperty("--ax", `${Math.round(r.left + r.width / 2 - pr.left)}px`);
  }

  renderScoreboard() {
    // Build a key from all visible data — skip re-render if unchanged (preserves tooltip)
    const readyIds = this.rush && !this.setupPhase ? this.rush.ready : null;
    const scoreKey = this.players.map((p, i) =>
      `${i}:${this.displayVictoryPoints(p)}:${sumResources(p.resources)}:${p.settlements.size}:${p.cities.size}:${p.roads.size}:${p.knightsPlayed}:${p.longestRoadLength}:${this.longestRoadHolder}:${this.largestArmyHolder}:${this.currentPlayerIndex}:${p.personality}:${readyIds ? readyIds.includes(p.id) : "-"}:${DEV_CARD_TYPES.reduce((s, t) => s + p.devCards[t] + p.newDevCards[t], 0)}`
    ).join("|") + `:${!!this.winner}:${this.isRush()}:${this.theme.id}:${this.setupPhase}:${this._sixKey()}:${this.viewerId}:${this.handHidden}`;
    if (scoreKey === this._lastScoreKey) return;
    this._lastScoreKey = scoreKey;
    const rows = [];
    const chips = [];
    this.players.forEach((player, idx) => {
      const active = idx === this._turnOwnerIndex() && !this.winner && !(this.isRush() && !this.setupPhase);
      const isReady = !!readyIds?.includes(player.id);
      const persona = player.personality ? AI_PRESET_INFO[player.personality] : null;
      const personaBadge = persona
        ? `<span class="persona-badge persona-${player.personality}" title="${persona.label}: ${persona.tagline}">${persona.glyph ? `${persona.glyph} ` : ""}${persona.label}</span>`
        : "";
      const totalCards = sumResources(player.resources);
      const totalDev = DEV_CARD_TYPES.reduce((sum, t) => sum + player.devCards[t] + player.newDevCards[t], 0) + (this._seesPrivate(player) ? player.devVictoryPoints : 0);
      const awards = (this.longestRoadHolder === player.id ? (this.sea ? `<span title="Longest Trade Route (+2 points)">${icon("tradeRoute")}</span>` : `<span title="Longest Road (+2 points)">${icon("longestRoad")}</span>`) : "") // ⚓
        + (this.largestArmyHolder === player.id ? `<span title="Largest Army (+2 points)">${icon("largestArmy")}</span>` : "");
      const vp = this.displayVictoryPoints(player);
      // knights played and road length only once they mean something (knights > 0, a road of 3+ or the award);
      // v0.75: the award holder's number sits on a gold pill with "+2" (gold: never a seat colour)
      const lr = this.longestRoadHolder === player.id, la = this.largestArmyHolder === player.id;
      const over = totalCards > (this.settings?.discardLimit ?? 7);
      const stats = [
        `<span data-stat="cards"${over ? ' class="warn"' : ""} title="${totalCards} resource card${totalCards === 1 ? "" : "s"}${over ? ` (more than ${this.settings?.discardLimit ?? 7}: hands back half on a 7)` : ""}">${icon("cards")}${totalCards}</span>`,
        totalDev > 0 ? `<span data-stat="dev" title="${totalDev} development card${totalDev === 1 ? "" : "s"}">${icon("devcard")}${totalDev}</span>` : "",
        awardStat("knights", player.knightsPlayed, la, `${player.knightsPlayed} knight${player.knightsPlayed === 1 ? "" : "s"} played${la ? " · Largest Army (+2 points)" : " (3+ to win Largest Army)"}`, "knight"),
        this.sea // ⚓ Seafarers: the trade route counts roads + ships
          ? awardStat("road", player.longestRoadLength, lr, `Trade route ${player.longestRoadLength}${lr ? " · Longest Trade Route (+2 points)" : " (5+ to win Longest Trade Route)"}`, "tradeRoute")
          : awardStat("road", player.longestRoadLength, lr, `Longest road ${player.longestRoadLength}${lr ? " · Longest Road (+2 points)" : " (5+ to win Longest Road)"}`, "road"),
        this.sea && this.sea.bonus[player.id]?.length ? `<span data-stat="isle" class="award" title="New islands: ${this.sea.bonus[player.id].length} (+${this.sea.bonusVP(player)} points)">${icon("island")}${this.sea.bonus[player.id].length}</span>` : "", // ⚓
      ].filter(Boolean);
      rows.push(`<div class="prow player-card-mini pc-${idx}${active ? " active" : ""}${isReady ? " rush-ready" : ""}" data-seat="${idx}">
        ${this._av(player, "player-avatar")}
        <div class="nm"><span class="pname">${player.name}${isReady ? '<span class="ready-pill" title="Voted to roll now">Ready</span>' : ""}</span>
          <span class="tag">${this._you(player) ? "Your colony" : player.isHuman ? "Pass &amp; play" : personaBadge}</span>
          <div class="stats">${stats.join("")}<span class="badges">${awards}</span></div></div>
        <div class="vp player-vp" title="Points — tap for details">${vp}<small>points</small></div></div>`);
      // ⚓ v0.86: at sea (first to 14) your own badge carries the goal: "3/14"; the others stay plain
      const goal = this.sea && player === this._me() && this._seesPrivate(player) ? `<span class="vgoal">/${this.winPoints}</span>` : "";
      chips.push(`<div class="pchip pc-${idx}${active ? " active" : ""}${isReady ? " ready" : ""}" data-seat="${idx}"${this._tradeVerdict?.(idx) ? ` data-trade="${this._tradeVerdict(idx)}"` : ""} role="button" tabindex="0" aria-label="${player.name}: ${vp} points${goal ? ` of ${this.winPoints}` : ""}"${player.fullName && !player.isHuman ? ` title="${player.fullName}"` : ""}>
        <div class="row">${this._av(player)}<div class="vpn${goal ? " goal" : ""}">${vp}${goal}<small>PTS</small></div></div>
        <div class="pn">${player.short || player.name}</div>${player.isHuman ? "" : personaBadge}
        <div class="pcards">${stats[0]}</div>
        <div class="mini${stats.length > 3 ? " dense" : ""}">${stats.slice(1).join("")}</div></div>`);
    });
    this.scoreboard.innerHTML = rows.join("");
    const goal = this.scoreboard.parentElement?.querySelector("h2 .sub");
    if (goal && /points wins/.test(goal.textContent)) goal.textContent = `First to ${this.winPoints} points wins${this.sea ? " · Seafarers" : ""}`; // ⚓ 14 at sea
    if (this.playerStrip) {
      // 5–6 players: six compact chips in one row (src/six-ui.js)
      this.playerStrip.innerHTML = this._sixUp() ? this._sixChips() : chips.join("");
      this.playerStrip.style.setProperty("--n", this.players.length);
      this._sixStripAttrs();
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
      const setupDone = !this.setupPhase && last?.text === "Initial placement complete."; // v0.81: say whose turn it is, not the last set-up step
      const real = setupDone ? null : [...this.logEntries].reverse().find((e) => !NOISE.test(e.text.replace(/^Turn \d+: /, "")));
      const own = this._ownRollSummary();
      if (own) {
        // Right after your roll the line is about YOU, not the last bot that collected
        this.tickerText.innerHTML = this._enrichLogText(own);
        if (this.tickerIcon) this.tickerIcon.innerHTML = icon("dice");
      } else if (real) {
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

  /** "You rolled 8 · +1 Lumber" while nothing but the payout has happened since your roll. */
  _ownRollSummary() {
    const L = this.logEntries;
    let i = L.length - 1;
    const quiet = /\bcollects?\b|^Bank is short/;
    while (i >= 0 && quiet.test(L[i].text)) i -= 1;
    const m = i >= 0 ? /^Turn \d+: You rolled (\d+)\.$/.exec(L[i].text) : null;
    if (!m || m[1] === "7") return "";
    const mine = L.slice(i + 1).map((e) => /^You collect (.+)\.$/.exec(e.text)).find(Boolean);
    const gain = mine ? mine[1].split(", ").map((p) => `+${p}`).join(" · ") : "nothing for you this time";
    return `You rolled ${m[1]} · ${gain}`;
  }

  renderStatusAndControls() {
    const rushOn = this.isRush() && !this.setupPhase;
    const humanTurn = this.currentPlayer.isHuman && !this.winner;
    const mainPhase = this.phase === "main";
    const preRoll = this.phase === "pre_roll";
    const noDevPlayed = rushOn ? !this.currentPlayer.rushDevPlayed : !this.currentTurnPlayedDevCard;
    const human = this._me() || this.currentPlayer;
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
    const robberBlocking = (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */;
    const placeName = { road: "a road", settlement: "a settlement", city: "a city" };

    const setButtonState = (button, enabled, disabledHint, enabledHint = "") => {
      if (!button) return;
      button.disabled = !enabled;
      button.title = enabled ? enabledHint : disabledHint;
    };

    // ── status pill (desktop turn banner; mobile uses the ticker) ──
    let title = humanTurn ? "Your turn" : `${active.name}'s turn`;
    let status;
    const mobile = this.isMobileLayout;
    // words follow the pointer: "tap" on touch screens, "click" with a mouse
    const touch = mobile || window.matchMedia?.("(pointer: coarse)").matches;
    const tapW = touch ? "Tap" : "Click", tapw = touch ? "tap" : "click";
    const confirmHint = mobile ? "Tap Place (or the spot again) to confirm" : "Click ✓ or the spot again · Enter confirms";
    const setupRound = this.setupStep < this.players.length ? 1 : 2;
    if (this.setupPhase && this.setupAction && humanTurn) {
      title = `Setup ${setupRound} of 2`;
      status = this.confirmBuild ? confirmHint
        : this.setupAction === "settlement" ? `${tapW} a spot for your ${setupRound === 1 ? "first" : "second"} settlement` : `${tapW} a road next to it`;
    } else if (this.setupPhase) {
      status = "Placing a starting settlement…";
    } else if (this.winner) {
      title = `${this.winner.name} win${this._s(this.winner)}!`;
      status = `${this.winner.victoryPoints} points`;
    } else if (rushOn && this.phase === "seven" && this.pendingAction !== "robber") {
      title = "Robber!";
      status = "Game paused — discards, then the robber";
    } else if (humanTurn && this.pendingAction === "robber") {
      status = this.confirmBuild ? "Robber: confirm below" : this.sea?.thief === "pirate" ? `Move the pirate · ${tapw} a sea tile` : `Move the robber · ${tapw} a tile`;
    } else if (rushOn && mainPhase && (!this.pendingAction || (this._isAutoGlow() && this.trayMode !== "build"))) {
      title = "Rush";
      status = this.autoplayInterval ? "Bots are playing for you" : "Build, trade or play a card any time";
    } else if (humanTurn && this.phase === "sbp") {
      // 5–6 players: your Special Building Phase window (src/six.js)
      title = "Your build window";
      status = this.pendingAction ? (this.confirmBuild ? confirmHint : `${tapW} a marked spot to build`) : this._sbpStatus();
    } else if (humanTurn && preRoll) {
      status = "Roll the dice to start your turn";
    } else if (humanTurn && mainPhase) {
      if (this.pendingAction) {
        if (this.confirmBuild) status = confirmHint;
        else status = this.freeRoadsRemaining > 0 ? `Free road · ${this.freeRoadsRemaining} left · ${tapw} a marked spot`
          : mobile && this.pendingAction === "build" ? (this.trayMode === "build" ? "Pick a piece or tap a lit spot" : "Your turn · tap a lit spot")
          : mobile ? ({ road: "Road · tap a lit edge", ship: "Ship · tap a lit edge", settlement: "Settlement · tap a lit corner", city: "City · tap a lit settlement" }[this.pendingAction] || `${tapW} a marked spot to build`)
          : this.pendingAction === "build" ? `${tapW} a marked spot to build` : `${placeName[this.pendingAction] || this.pendingAction} · ${tapw} a marked spot`;
      } else {
        status = "Build, trade or play a card";
      }
    } else {
      status = preRoll ? "Rolling the dice…" : "Thinking…";
    }
    // The dock tray (build, cards, picks, robber, discard) says what to do in the same line
    const tray = this._renderTray();
    this._renderBuildCard(tray);
    if (tray?.hint) status = tray.hint;
    const flash = (this._flash && this._flash.until > Date.now() ? this._flash.text : null) || this._seaStatus(); // ⚓ "New island! …"
    if (flash) status = flash;
    if (this.actionPromptText) this.actionPromptText.textContent = status;
    // Phones: the ticker line becomes the instruction while you have to act (place, robber, discard)
    const sbpLine = !flash && !tray && !this.pendingAction && this._sbpWindowOpen() ? this._sbpTickerHtml() : "";
    const mustAct = !this.winner && (!!flash || !!tray || !!sbpLine || (this.setupPhase && humanTurn && this.setupAction) || (humanTurn && this.pendingAction && !(this._isAutoGlow() && this.trayMode !== "build")) || !!this.pendingDiscard);
    const prompt = mustAct ? status : "";
    // Cancel sits right in the instruction line: leave build mode / a tray, or take back a card played by mistake
    const devCancel = !!this.devPlayed && ((this.devPlayed.type === "knight" && this.pendingAction === "robber" && !this.confirmBuild)
      || (this.devPlayed.type === "roadBuilding" && this.freeRoadsRemaining === this.devPlayed.free));
    const canCancel = humanTurn && !this.setupPhase && !this.pendingDiscard && (devCancel || (tray && ["build", "cards"].includes(tray.mode))
      || !!((this.confirmBuild && this.confirmBuild.type !== "robber") || (this.pendingAction && this.pendingAction !== "robber" && !this.freeRoadsRemaining && !(this._isAutoGlow() && this.trayMode !== "build"))));
    const tickerCancel = document.querySelector("#tickerCancel");
    // ⚓ v0.86: a gold pick with a card taken: the same slot takes the last pick back
    const goldUndo = tray?.mode === "gold" && !!this._seaGoldUndoable?.();
    if (tickerCancel) {
      tickerCancel.hidden = !(mustAct && (canCancel || goldUndo));
      const word = goldUndo ? "Undo" : "Cancel";
      if (tickerCancel.textContent !== word) tickerCancel.textContent = word;
    }
    // v0.81: the robber (and a discard) is an instruction, not a log line: the ticker turns into an action prompt
    const robberAct = !this.winner && !!prompt && ((humanTurn || rushOn) && this.pendingAction === "robber" && !this.confirmBuild && !this.robberVictimOptions?.length || (!!this.pendingDiscard && this.pendingDiscard.player === human));
    document.querySelector("#ticker")?.classList.toggle("act", robberAct);
    // the setup step chip only where the line has room (phones show it in the dock instead)
    const stepChip = this.setupPhase && humanTurn && this.setupAction && window.innerWidth > 430 ? `Setup ${setupRound} of 2` : "";
    const promptKey = prompt + "|" + stepChip + "|" + (tray?.mode || "");
    if (promptKey !== (this._tickerPromptKey || "|")) {
      this._tickerPromptKey = promptKey;
      this._tickerPrompt = prompt;
      this._lastLogKey = null;
      document.querySelector("#ticker")?.classList.toggle("prompt", !!prompt);
      if (prompt && this.tickerText) {
        this.tickerText.innerHTML = sbpLine || `<span class="tk-main">${prompt}</span>${stepChip ? `<span class="tk-step">${stepChip}</span>` : ""}`;
        const ic = { gold: "gold", thief: "robber", moveShip: "ship", moved: "ship", setupPiece: "ship", island: "island" }[tray?.mode] // ⚓
          || (this.sea && this.pendingAction === "robber" && this.confirmBuild && this._seaHexKind(this.confirmBuild.id) === "pirate" ? "pirate" : null)
          || (this.pendingDiscard || this.pendingAction === "robber" || tray?.mode === "victims" ? "robber"
          : tray?.mode === "cards" || tray?.mode === "pick" ? "devcard" : this.confirmBuild?.type || (this.pendingAction !== "build" && this.pendingAction) || this.setupAction || "build");
        if (this.tickerIcon) this.tickerIcon.innerHTML = icon(ic);
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
    if (this.cancelActionBtn) {
      this.cancelActionBtn.hidden = !(canCancel || goldUndo);
      this.cancelActionBtn.dataset.goldUndo = goldUndo ? "1" : "";
      const html = goldUndo ? "Undo" : 'Cancel <span class="kbd">Esc</span>';
      if (this.cancelActionBtn.innerHTML !== html) this.cancelActionBtn.innerHTML = html;
    }

    // ── primary action: Roll dice ↔ End turn (Classic), Ready (Rush), waiting bar (opponent) ──
    const rollBtn = this.rollDiceBtn;
    const endBtn = this.endTurnBtn;
    const buildPanel = this.actionPromptBuild;
    const oppTurn = !rushOn && !this.winner && !humanTurn && !tray; // v0.81: a tray (discard on a bot's 7, gold) needs the dock
    this.app?.classList.toggle("opp-turn", oppTurn);
    if (rollBtn) {
      rollBtn.style.display = !rushOn && !inSetup && humanTurn && preRoll && !robberBlocking ? "inline-flex" : "none";
      rollBtn.disabled = inSetup || !(humanTurn && preRoll) || robberBlocking;
    }
    if (endBtn) {
      endBtn.style.display = !rushOn && humanTurn && mainPhase && !inSetup && !robberBlocking ? "inline-flex" : "none";
      // also while Road Building's free roads are still to be placed
      // v0.84: a chosen piece (build card) never blocks End turn; Road Building's free roads still do
      endBtn.disabled = inSetup || !(humanTurn && mainPhase) || robberBlocking || (!!this.pendingAction && !["build", "road", "settlement", "city", "ship"].includes(this.pendingAction)) || this.freeRoadsRemaining > 0 || !!this.devPick;
    }
    // v0.81: while you must move the robber the primary slot is a disabled "Move robber" (End turn / Ready wait)
    const robberWait = !this.winner && this.pendingAction === "robber" && !!this.currentPlayer?.isHuman && (humanTurn || rushOn);
    if (this.rushReadyBtn) this.rushReadyBtn.hidden = !rushOn || !!this.winner || robberWait;
    if (this.waitingBar) {
      let wait = "";
      if (this.winner) {
        wait = ""; // after "See board": one clean New game button instead (below)
      } else if (robberWait) {
        wait = `${icon(this.sea?.thief === "pirate" ? "pirate" : "robber")}<div class="wt">Move ${this.sea?.thief === "pirate" ? "pirate" : "robber"}<small>${tapw} a tile</small></div>`;
      } else if (inSetup && humanTurn && !rushOn) {
        wait = `${icon(this.setupAction || "settlement")}<div class="wt">Setup ${setupRound} of 2<small>${this.setupAction === "road" ? "Last step: a road" : "Then add a road"}</small></div>`;
      } else if (oppTurn) {
        wait = `${this._av(active)}<div class="wt">${active.name} is playing</div><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>`; // v0.76: no sub-line (a Trade tap says when trading opens)
      }
      const wkey = `${wait.length}:${active.id}:${preRoll}:${inSetup}:${!!this.winner}:${this.pendingAction}:${this.setupAction}:${setupRound}:${this.confirmBuild?.type}`;

      if (this.waitingBar.dataset.key !== wkey) {
        this.waitingBar.dataset.key = wkey;
        this.waitingBar.innerHTML = wait;
        this.waitingBar.querySelector("[data-newgame]")?.addEventListener("click", () => this._showDifficultyModal());
      }
      this.waitingBar.hidden = !wait;
      this.waitingBar.classList.toggle("robber-wait", !!wait && robberWait);
      this.waitingBar.setAttribute("aria-disabled", String(!!wait && robberWait));
    }
    const newGameBtn = document.querySelector("#newGameMainBtn");
    if (newGameBtn) {
      const over = !!this.winner && !document.querySelector(".game-over-overlay");
      newGameBtn.hidden = !over;
      if (over) { rollBtn && (rollBtn.style.display = "none"); endBtn && (endBtn.style.display = "none"); }
    }

    if (buildPanel) buildPanel.style.display = this.pendingDiscard ? "none" : ""; // hidden while discarding; otherwise shown, disabled when not usable

    // Hide trade panel when not in main phase or during robber
    if (robberBlocking || !humanTurn || !mainPhase) this.hideTradePanel();

    this.nextTurnBtn.disabled = !!this.winner || humanTurn || this.autoplayInterval != null || this.isRush();
    const canBuildNow = humanTurn && this._buildPhase() && !robberBlocking;
    const piecesHint = (type) => (this.piecesLeft(human, type) <= 0 ? `No ${type}s left` : null);
    setButtonState(this.buildRoadBtn, canBuildNow && (hasRoadCost || this.freeRoadsRemaining > 0) && !piecesHint("road"),
      piecesHint("road") || (roadMissing ? `Need ${roadMissing}` : "Not available now"), "Build a road (1)");
    setButtonState(this.buildSettlementBtn, canBuildNow && hasSettlementCost && !piecesHint("settlement"),
      piecesHint("settlement") || (settlementMissing ? `Need ${settlementMissing}` : "Not available now"), "Build a settlement (2)");
    setButtonState(this.buildCityBtn, canBuildNow && hasCityCost && !piecesHint("city"),
      piecesHint("city") || (cityMissing ? `Need ${cityMissing}` : "Not available now"), "Upgrade to a city (3)");
    if (this.buildShipBtn) { // ⚓ Seafarers
      const shipMissing = missingCostString(human.resources, COSTS.ship);
      setButtonState(this.buildShipBtn, !!this.sea && canBuildNow && (hasResources(human.resources, COSTS.ship) || this.freeRoadsRemaining > 0) && this.piecesLeft(human, "ship") > 0,
        this.sea && this.piecesLeft(human, "ship") <= 0 ? "No ships left" : shipMissing ? `Need ${shipMissing}` : "Not available now", "Build a ship (4)");
      const left = this.buildShipBtn.querySelector(".left");
      if (left) left.textContent = this.sea ? `${this.piecesLeft(human, "ship")} left` : "";
      const need = this.buildShipBtn.querySelector(".need");
      if (need) { const have = { ...human.resources }; need.querySelectorAll("[data-r]").forEach((ic) => { const r = ic.dataset.r; const ok = have[r] > 0; if (ok) have[r] -= 1; ic.classList.toggle("miss", !ok); }); }
      this.buildShipBtn.classList.toggle("selected-action", this.pendingAction === "ship");
    }
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
      // Not disabled: a tap when trading is closed says why ("Roll the dice first…") instead of doing nothing
      const tradeWhy = this._tradeBlockedReason();
      this.tradeBankBtn.disabled = false;
      this.tradeBankBtn.setAttribute("aria-disabled", String(!!tradeWhy));
      this.tradeBankBtn.title = tradeWhy || "Trade (T)";
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
    // Cards: the badge counts every development card (same number as on your player chip);
    // the button only stands out when one of them can be played right now
    const mDot = document.querySelector("#mCardsDot");
    const playableNow = !inSetup && noDevPlayed && DEV_CARD_TYPES.some(canPlayDev);
    if (mDot) {
      const nDev = DEV_CARD_TYPES.reduce((s, t) => s + human.devCards[t] + human.newDevCards[t], 0) + human.devVictoryPoints;
      mDot.hidden = !nDev;
      mDot.textContent = String(nDev);
      mDot.classList.toggle("go", playableNow);
    }
    // …or when you can buy one now: Cards then opens on "Buy card" (it used to look locked, v0.74 bug)
    const canBuyDev = canBuildNow && hasDevCost && this.devDeck.length > 0 && !this.pendingDiscard && !this.devPick;
    const mCards = document.querySelector("#mCardsBtn");
    if (mCards) {
      mCards.classList.toggle("quiet", !playableNow && !canBuyDev);
      mCards.classList.toggle("canbuy", canBuyDev && !playableNow);
      const lbl = playableNow ? "Cards: play a development card" : canBuyDev ? `Cards: buy a development card (${resourceString(COSTS.development)})` : "Cards: your development cards";
      if (mCards.getAttribute("aria-label") !== lbl) { mCards.setAttribute("aria-label", lbl); mCards.title = lbl; }
    }
    const mBuild = document.querySelector("#mBuildBtn");
    if (mBuild) mBuild.disabled = !canBuildNow;
    this._renderBuyBtn(human, canBuildNow && humanTurn && (!this.hotseat || this.currentPlayer === human));

    [this.buildRoadBtn, this.buildSettlementBtn, this.buildCityBtn].forEach((btn) => btn?.classList.remove("selected-action"));
    if (this.pendingAction === "road") this.buildRoadBtn?.classList.add("selected-action");
    if (this.pendingAction === "settlement") this.buildSettlementBtn?.classList.add("selected-action");
    if (this.pendingAction === "city") this.buildCityBtn?.classList.add("selected-action");

    // ── mobile confirm pill: the Place button sits right above the thumb ──
    if (this.confirmPill) {
      // Robber: the pill grows into a compact sheet (desktop: a popover) with everyone on the tile
      // (the robber's choice lives in the dock tray)
      const info = null; // v0.69: Place lives in the dock tray (mode "confirm"); the floating pill is retired
      this.confirmPill.hidden = !info;
      this.confirmPill.classList.toggle("robber", !!info?.robber);
      const vEl = document.querySelector("#confirmPillVictims");
      if (info) {
        document.querySelector("#confirmPillIcon").innerHTML = icon(info.icon);
        document.querySelector("#confirmPillTitle").textContent = info.title;
        const subEl = document.querySelector("#confirmPillSub");
        if (info.subHtml) subEl.innerHTML = info.subHtml; else subEl.textContent = info.sub;
      }
      if (vEl) {
        const html = info?.robber ? this._robberVictimsHtml(info.robber, this.confirmBuild.victim) : "";
        if (vEl.__html !== html) { vEl.innerHTML = html; vEl.__html = html; }
        vEl.hidden = !html;
      }
      // Phones: keep the chosen tile in sight; the robber sheet moves to the top when the tile is low
      let atTop = false;
      if (info?.robber && this.isMobileLayout) {
        const hex = this.geometry.hexes[this.confirmBuild.id];
        atTop = this.worldToScreen(hex.center.x, hex.center.y).y > this.boardHeight * 0.5;
      }
      this.confirmPill.classList.toggle("at-top", atTop);
    }
    this._renderSbpControls(); // 5–6 players: Skip / Done while your build window is open
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

  // ── Sound effects (synthesised in src/sound.js: soft wood, paper and mallet sounds) ──
  // Muted by the Sounds toggle, silent until the first user gesture, throttled in the engine.
  sfx = {
    diceRoll: () => this.sound.play("diceRoll"),
    diceResult: () => this.sound.play("diceResult"),
    buildRoad: () => this.sound.play("buildRoad"),
    buildSettlement: () => this.sound.play("buildSettlement"),
    buildCity: () => this.sound.play("buildCity"),
    trade: () => this.sound.play("trade"),
    tradeReject: () => this.sound.play("tradeReject"),
    robber: () => this.sound.play("robber"),
    robberPrompt: () => this.sound.play("robberPrompt"),
    steal: () => this.sound.play("steal"),
    devCard: () => this.sound.play("devCard"),
    yourTurn: () => this.sound.play("yourTurn"),
    victory: () => this.sound.play("victory"),
    click: () => this.sound.play("click"),
    error: () => this.sound.play("error"),
    rushTick: (last = false) => this.sound.play("rushTick", last),
    /** kinds: resource kinds you gained (louder, pitched per resource); empty = bots only */
    resourceGain: (kinds = []) => this.sound.play("resourceGain", kinds),
  };

  // ── New-game setup screen ─────────────────────────────────────────────
  // Mode (Classic / Rush), rules, dice, map and opponents. The last choice is remembered.
  _showDifficultyModal() {
    document.querySelector(".newgame-modal")?.remove();
    this.onboarding?.close();
    this.settingsUI?.close();
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
    const seg = (name, options, value, extraClass = "", off = []) => `
      <div class="ng-seg ${extraClass}" role="radiogroup" data-seg="${name}">
        ${options.map(([v, label]) => `<button type="button" role="radio" aria-checked="${String(v) === String(value)}" class="ng-seg-btn${String(v) === String(value) ? " selected" : ""}" data-value="${v}"${off.includes(v) ? " disabled" : ""}>${label}</button>`).join("")}
      </div>`;
    const stepper = (name, value, min, max) => `
      <div class="ng-stepper" data-stepper="${name}" data-min="${min}" data-max="${max}">
        <button type="button" class="ng-step-btn" data-step="-1" aria-label="Decrease" ${value <= min ? "disabled" : ""}>&minus;</button>
        <span class="ng-step-value" aria-live="polite">${value}</span>
        <button type="button" class="ng-step-btn" data-step="1" aria-label="Increase" ${value >= max ? "disabled" : ""}>+</button>
      </div>`;
    const summaryText = () => {
      const bots = PLAYER_CONFIG.slice(1, d.numBots + 1).map((_, i) => (d.mode !== "rush" && d.humans[i] ? null : presetLabel(botPreset(i)))).filter(Boolean);
      const people = 1 + PLAYER_CONFIG.slice(1, d.numBots + 1).filter((_, i) => d.mode !== "rush" && d.humans[i]).length;
      const uniq = [...new Set(bots)];
      const mode = d.mode === "rush" ? `<strong>Rush · ${d.rushInterval}s rolls</strong>` : "<strong>Classic</strong>";
      const extras = [
        d.board === "seafarers" ? "Seafarers · 14 VP" : `${d.winPoints} VP`, // ⚓
        d.discardLimit !== 7 ? `discard over ${d.discardLimit}` : null,
        d.friendlyRobber ? "friendly robber" : null,
        `${d.dice === "deck" ? "event-deck" : d.dice} dice`,
        `${d.map} map`,
        [people > 1 ? `${people} players` : null,
          bots.length ? `${bots.length} bot${bots.length > 1 ? "s" : ""} (${uniq.length === 1 && bots.length > 1 ? `all ${uniq[0]}` : bots.join(", ")})` : null].filter(Boolean).join(" + "),
      ].filter(Boolean);
      return `${mode} · ${extras.join(" · ")}`;
    };

    // Players: who sits where (seat 0 is always a person; the others a bot or, pass & play, a person)
    const botCount = () => PLAYER_CONFIG.slice(1, d.numBots + 1).filter((_, i) => !(d.mode !== "rush" && d.humans[i])).length;
    const seatRows = () => PLAYER_CONFIG.slice(0, d.numBots + 1).map((cfg, id) => {
      const human = id === 0 || (d.mode !== "rush" && d.humans[id - 1]);
      const hot = hotseatOn(d);
      const def = cfg.hsName || cfg.name;
      const kind = id === 0 ? `<div class="hs-kind" aria-label="Person"><button type="button" class="on fixed" tabindex="-1">Human</button></div>`
        : `<div class="hs-kind" role="radiogroup" aria-label="${esc(cfg.name)}: bot or person">
            <button type="button" role="radio" data-kind="bot" data-seat="${id}" class="${human ? "" : "on"}" aria-checked="${!human}">Bot</button>
            <button type="button" role="radio" data-kind="human" data-seat="${id}" class="${human ? "on" : ""}" aria-checked="${human}"${d.mode === "rush" ? ` disabled title="Pass &amp; play is Classic only"` : ""}>Human</button></div>`;
      const main = human
        ? (hot ? `<input class="hs-name-in" data-name="${id}" value="${esc(d.names[id] || "")}" placeholder="${esc(def)}" maxlength="14" aria-label="Name for seat ${id + 1}" autocomplete="off" spellcheck="false">`
          : `<div class="hs-seat-name">You</div>`)
        : `<div class="hs-seat-name">${esc(cfg.name)}${badge(botPreset(id - 1))}</div>`;
      const sel = !human && d.botStyleMode === "each" ? `
        <select class="ng-bot-select" data-bot="${id - 1}" aria-label="${esc(cfg.name)} personality">
          ${Object.keys(AI_PRESETS).map((key) => `<option value="${key}"${d.perBot[id - 1] === key ? " selected" : ""}>${presetLabel(key)}</option>`).join("")}
        </select>` : "";
      return `<div class="hs-seat pc-${id}">${avatarSvg(id, "ng-bot-avatar")}<div class="hs-seat-main">${main}</div>${kind}${sel}</div>`;
    }).join("");

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
                  <button type="button" class="ng-mode-card rush${d.mode === "rush" ? " selected" : ""}" data-mode="rush" aria-pressed="${d.mode === "rush"}"${hotseatOn(d) ? " disabled" : ""}>
                    <span class="ng-mode-tag">Fast</span>
                    <span class="ng-mode-name"><span class="ng-mode-icon">&#9889;</span>Rush</span>
                    <span class="ng-mode-desc">No turns. Everyone builds &amp; trades at once; dice roll on a timer.</span>
                    ${hotseatOn(d) ? '<span class="hs-off">Pass &amp; play is Classic only</span>' : ""}
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
                  <div class="ng-row-label">Board</div>
                  <div class="ng-row-control">
                    ${seg("board", [["island", "Island"], ["seafarers", "&#9875; Seafarers"]], d.board, "ng-seg-pills")}
                    <p class="ng-help">${d.board === "seafarers" ? "Heading for New Shores: build ships, sail to three small islands (+2 points for your first settlement on each), gold fields and a pirate. First to 14 points." : "The classic island of 19 tiles."}</p>
                  </div>
                </div>
                <div class="ng-row">
                  <div class="ng-row-label">Points to win</div>
                  <div class="ng-row-control">${d.board === "seafarers" ? `<p class="ng-help ng-help-tight"><strong>14</strong> (Seafarers scenario)</p>` : stepper("winPoints", d.winPoints, 5, 15)}</div>
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
                    <p class="ng-help">${isBigTable(d.numBots + 1) && d.map === "beginner" ? "Beginner: there is no official 5–6 player starter layout, so you get a balanced (fair) island." : mapHelp[d.map]}</p>
                  </div>
                </div>
              </section>
            </div>
            <div class="ng-col">
              <section class="ng-section ng-players">
                <h3 class="ng-section-title">Players</h3>
                <div class="ng-row ng-row-inline">
                  <div class="ng-row-label">At the table</div>
                  ${seg("numBots", PLAYER_CONFIG.slice(1).map((_, i) => [i + 1, String(i + 2)]), d.numBots, "ng-seg-pills ng-seg-round", d.board === "seafarers" ? [4, 5] : [])}
                </div>
                ${d.board === "seafarers" ? `<p class="ng-help ng-six-help">Seafarers is a 3–4 player scenario.</p>` : ""}
                ${isBigTable(d.numBots + 1) ? `<p class="ng-help ng-six-help">${d.numBots + 1} players: the bigger island (30 tiles, 24 of each card) and a build window between turns${d.mode === "rush" ? " (Classic only)" : ""}.</p>` : ""}
                <div class="hs-seats">${seatRows()}</div>
                ${hotseatOn(d) ? `<p class="hs-help">${1 + d.humans.slice(0, d.numBots).filter(Boolean).length} people share this phone · pass it on when the turn changes.</p>` : `<p class="hs-help">Tap Human to play with friends on this phone.</p>`}
              </section>
              <section class="ng-section">
                <h3 class="ng-section-title">Bots</h3>
                ${botCount() ? "" : `<p class="ng-help">No bots at this table.</p>`}
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
        if (t.dataset.kind) {
          d.humans = d.humans.map((h, i) => (i === Number(t.dataset.seat) - 1 ? t.dataset.kind === "human" : h));
          if (hotseatOn(d)) d.mode = "classic";
        } else if (t.dataset.mode) d.mode = t.dataset.mode;
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
            const prevBots = d.numBots;
            d[key] = ["rushInterval", "numBots"].includes(key) ? Number(raw) : raw;
            // ⚓ Seafarers is 3–4 players: picking it caps the bots at 3 (back to the old count for the island)
            if (key === "board") {
              if (d.board === "seafarers" && d.numBots > 3) { this._ngBotsIsland = d.numBots; d.numBots = 3; }
              else if (d.board !== "seafarers" && this._ngBotsIsland) { d.numBots = this._ngBotsIsland; this._ngBotsIsland = 0; }
            }
            // 5–6 players: Rush rolls every 20 s by default (back to 15 s for a smaller table)
            if (["numBots", "board"].includes(key) && isBigTable(d.numBots + 1) !== isBigTable(prevBots + 1)) {
              if (isBigTable(d.numBots + 1) && d.rushInterval < BIG_RUSH_INTERVAL) d.rushInterval = BIG_RUSH_INTERVAL;
              else if (!isBigTable(d.numBots + 1) && d.rushInterval === BIG_RUSH_INTERVAL) d.rushInterval = DEFAULT_SETTINGS.rushInterval;
            }
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
      card.querySelectorAll("[data-name]").forEach((inp) => inp.addEventListener("input", () => {
        d.names = d.names.map((n, i) => (i === Number(inp.dataset.name) ? inp.value.slice(0, 14) : n));
      }));
      card.querySelectorAll(".ng-bot-select").forEach((sel) => sel.addEventListener("change", () => {
        d.perBot = d.perBot.map((p, i) => (i === Number(sel.dataset.bot) ? sel.value : p));
        const scroll = card.scrollTop;
        render();
        overlay.querySelector(".ng-card").scrollTop = scroll;
      }));
    };

    const onKey = (e) => { if (e.key === "Escape") close(); };
    const close = (started = false) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      this.uiPaused = false;
      this._rushLastTs = performance.now();
      if (!started && this.onboardingHold) this.home.show(); // opened from home: back to it
    };
    const start = () => {
      close(true);
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
    const botsToShow = this._applyAllStrategies ? aiPlayers.slice(0, 1) : aiPlayers; // pass & play: a table may have no bots

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

  /**
   * Phones: the slim line above the hand. v0.84: only the discard summary ("Hand back 4 of 8 · keep 4") lives here;
   * your totals are the pill over the hand (with the bank popover), the bank is also in Trade and live stats.
   */
  renderHandBar(human = this._me(), total = human ? sumResources(human.resources) : 0) {
    const el = this.handBar;
    if (!el || !human) return;
    const pd = this.pendingDiscard?.player === human ? this.pendingDiscard : null;
    const key = [total, pd ? `${pd.count}:${sumResources(pd.selected)}` : ""].join("|");
    if (key === this._lastHandBarKey) return;
    this._lastHandBarKey = key;
    el.hidden = !pd;
    if (!pd) { el.innerHTML = ""; return; }
    const sel = sumResources(pd.selected);
    el.innerHTML = `<span class="hb-total hb-discard${sel === pd.count ? " done" : ""}" data-total="${total}">${icon("robber")}<span>Hand back <b>${pd.count}</b> of <b>${total}</b> · keep <b>${total - pd.count}</b></span>${sel ? `<i class="hb-prog">${sel}/${pd.count}</i>` : ""}</span>`;
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
      { key: "ship", label: "Ship", icon: "ship", cost: COSTS.ship, cls: "sea-only" }, // ⚓ shown in Seafarers games only
    ];
    const icons = (cost) => RESOURCES.filter((r) => (cost[r] || 0) > 0)
      .flatMap((r) => Array(cost[r]).fill(`<svg class="ic" viewBox="-50 -50 100 100" data-r="${r}" aria-label="${RESOURCE_LABEL[r]}"><use href="#ic-${r}" x="-50" y="-50" width="100" height="100"/></svg>`)).join("");
    if (this.costRefItems) {
      this.costRefItems.innerHTML = items.map((it) => `<div class="cost${it.cls ? ` ${it.cls}` : ""}" title="${it.label}: ${resourceString(it.cost)}">${icon(it.icon)}<span>${it.label}</span><span class="res">${icons(it.cost)}</span></div>`).join("");
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
      // Inline: tap the cards in your hand to mark them; the dock tray counts and hands them back
      this.pendingDiscard = { player, count: discardCount, selected: makeEmptyResources(), resolve, order: [], lastActAt: Date.now() };
      this._discardWatch(this.pendingDiscard);
      this.toggleBuildSheet?.(false);
      this.hideDevCardPicker();
      this.hideTradePanel();
      this._dropUndo();
      this.trayMode = null;
      if (this.pendingAction && this.pendingAction !== "robber") { this.pendingAction = null; this.confirmBuild = null; }
      this.render();
    });
  }

  _renderDiscardCards() {
    if (!this.pendingDiscard) return;
    const { player, count, selected } = this.pendingDiscard;
    const totalSelected = sumResources(selected);
    this.discardCards.innerHTML = RESOURCES.map((r) => {
      const have = player.resources[r];
      const sel = selected[r];
      // the badge shows what you keep; the line under it what goes back
      return `<div class="rcell${sel ? " pick" : ""}${have ? "" : " dim"}" data-res="${r}">
        <button type="button" class="card discard-card" data-add="${r}" aria-label="Hand back 1 ${RESOURCE_LABEL[r]} (keeping ${have - sel})" ${have ? "" : "disabled"}>${cardSvg(r)}<span class="count">${have - sel}</span></button>
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
    this.discardSelected.textContent = `${totalSelected} of ${count} chosen · you keep ${sumResources(player.resources) - totalSelected}`;
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
    if (this.discardPanel) this.discardPanel.style.display = "none";
    this.sfx.click();
    this.render();
    resolve();
  }

  // ── Resource Gain Toasts for all players ─────────────────────────────
  showResourceGainToasts(gainByPlayer) {
    // Cards fly from the producing tiles to the hand (you) or to the player's portrait (bots)
    this.fx?.flyResources(gainByPlayer, this.lastRoll);
    const human = this._me();
    if (gainByPlayer.some((g) => sumResources(g) > 0)) {
      const mine = human && gainByPlayer[human.id] ? RESOURCES.filter((r) => gainByPlayer[human.id][r] > 0) : [];
      window.setTimeout(() => this.sfx.resourceGain(mine), 900);
    }
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
    const devVP = this._seesPrivate(player) ? player.devVictoryPoints : 0; // opponents' VP cards stay hidden
    const longestRoad = this.longestRoadHolder === player.id ? 2 : 0;
    const largestArmy = this.largestArmyHolder === player.id ? 2 : 0;
    const total = settlements + cities * 2 + devVP + longestRoad + largestArmy + (this.sea ? this.sea.bonusVP(player) : 0); // ⚓
    const totalDevCards = DEV_CARD_TYPES.reduce((sum, t) => sum + player.devCards[t] + player.newDevCards[t], 0);

    const tip = document.createElement("div");
    tip.className = "vp-tooltip";
    tip.id = "vpTooltip";

    // v0.84: what matters most first — cards and development cards in hand, knights, road — then the points, then pieces
    const row = (label, value, cls = "") => `<div class="vp-tooltip-row${cls}"><span class="vp-tooltip-label">${label}</span><span class="vp-tooltip-value">${value}</span></div>`;
    const cardsN = sumResources(player.resources);
    const limit = this.settings?.discardLimit ?? 7;
    let html = `<div class="vp-tooltip-section">${this._you(player) ? "Your hand" : "In hand"}</div>`;
    html += `<div class="vp-tooltip-grid">`
      + `<span${cardsN > limit ? ' class="warn"' : ""}>${icon("cards")}<b>${cardsN}</b><small>cards</small></span>`
      + `<span>${icon("devcard")}<b>${totalDevCards + devVP}</b><small>dev</small></span>`
      + `<span>${icon("knight")}<b>${player.knightsPlayed}</b><small>knights</small></span>`
      + `<span>${icon(this.sea ? "tradeRoute" : "road")}<b>${player.longestRoadLength}</b><small>${this.sea ? "route" : "road"}</small></span></div>`;
    html += '<div class="vp-tooltip-section" style="margin-top:0.35rem">Points</div>';
    const vpRows = [
      { label: `Settlements (${settlements}/5)`, value: settlements },
      { label: `Cities (${cities}/4)`, value: `${cities} x 2 = ${cities * 2}` },
    ];
    if (devVP > 0) vpRows.push({ label: "Dev VP", value: devVP });
    if (longestRoad) vpRows.push({ label: this.sea ? "Longest Trade Route" : "Longest Road", value: 2 }); // ⚓
    vpRows.push(...this._seaVpRows(player));
    if (largestArmy) vpRows.push({ label: "Largest Army", value: 2 });
    vpRows.push({ label: "Total", value: total, total: true });
    html += vpRows.map((r) => row(r.label, r.value, r.total ? " vp-tooltip-total" : "")).join("");
    html += '<div class="vp-tooltip-section" style="margin-top:0.35rem">Pieces</div>';
    html += row("Roads", `${roads}/15`);
    if (this.sea) html += row("Ships", `${player.ships.size}/15`); // ⚓
    tip.innerHTML = html;

    const rect = anchorEl.getBoundingClientRect();
    document.body.appendChild(tip);
    // Position below the anchor, clamped to viewport
    const tipRect = tip.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    // v0.84 phones: open under the ticker, so the next action stays readable
    const tk = this.isMobileLayout && !this.isLandscapePhone && anchorEl.closest(".pstrip") ? document.querySelector(".tkrow, #ticker") : null;
    if (tk) top = Math.max(top, tk.getBoundingClientRect().bottom + 4);
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
    try { document.documentElement.dataset.handCounts = localStorage.getItem("colonist.handCounts") || "stack"; } catch (_) { /* private mode */ }
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
    this.handBar = $("#handBar");
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
    $("#mMenuBtn")?.addEventListener("click", () => this.menu.show());
    $("#menuBtn")?.addEventListener("click", () => this.menu.show());
    renderQuickToggle($("#themeToggle"), this);
    $("#fitBoardBtn")?.addEventListener("click", () => this.resetViewTransform());
    $("#zoomInBtn")?.addEventListener("click", () => this.zoomBy(1.2));
    $("#zoomOutBtn")?.addEventListener("click", () => this.zoomBy(1 / 1.2));
    $("#tickerMore")?.addEventListener("click", () => this.toggleLog(true));
    $("#tickerText")?.addEventListener("click", () => this.toggleLog(true));
    $("#journalClose")?.addEventListener("click", () => this.toggleLog(false));
    $("#mBuildBtn")?.addEventListener("click", () => this.openBuildTray());
    $("#dockPicker")?.addEventListener("click", (e) => this._onTrayClick(e));
    $("#buildSheetClose")?.addEventListener("click", () => this.toggleBuildSheet(false));
    $("#mCardsBtn")?.addEventListener("click", (e) => { e.stopPropagation(); this.openCardsTray(); });
    $("#mBuyBtn")?.addEventListener("click", (e) => this._onBuyBtn(e));
    // v0.84: a tap anywhere else lets go of a selected card / closes the bank popover and the dock tip
    document.addEventListener("pointerdown", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (this.devSel && !t.closest("#resourceCardStrip .card[data-dev], #devBubble")) { this.devSel = null; this.renderResourceCards(); }
      if (this._handInfoOpen && !t.closest("#handTotal, #handInfo")) this._toggleHandInfo(false);
      if (!t.closest("#mBuyBtn, #dockTip")) this._hideTip();
      // a player's breakdown closes on any tap elsewhere too (a board tap never makes a click event)
      if (document.getElementById("vpTooltip") && !t.closest("#vpTooltip, [data-seat]")) this._hideVPTooltip();
    }, true);
    $("#devPickerClose")?.addEventListener("click", () => this.hideDevCardPicker());
    this.cancelActionBtn?.addEventListener("click", () => { if (this.cancelActionBtn.dataset.goldUndo && this._seaGoldUndoable?.()) this._seaGoldUndo(); else this.cancelPlacement(); });
    $("#tickerCancel")?.addEventListener("click", (e) => { e.stopPropagation(); if (this._seaGoldUndoable?.()) this._seaGoldUndo(); else this.cancelPlacement(); });
    $("#newGameMainBtn")?.addEventListener("click", () => this._showDifficultyModal());
    $("#confirmPillCancel")?.addEventListener("click", () => { this.confirmBuild = null; this.render(); });
    $("#confirmPillPlace")?.addEventListener("click", () => this._confirmViaIcon());
    $("#confirmPillVictims")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-victim]");
      const cb = this.confirmBuild;
      if (!b || cb?.type !== "robber") return;
      const id = Number(b.dataset.victim);
      if (!this._stealVictims(cb.id, this.currentPlayer).includes(id)) return;
      cb.victim = id;
      this.sfx.click();
      this.render();
    });
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
    this._bindSheetSwipe();
    const cards = this.resourceCardStrip;
    cards?.addEventListener("scroll", () => this.handArea?.classList.toggle("scrolled", cards.scrollLeft > 8), { passive: true });
    // Keep the scrim in sync with whichever sheet code opens or closes
    const mo = new MutationObserver(() => this._syncScrim());
    [this.tradeModal, this.devCardPicker, this.victimPanel, this.discardPanel, this.incomingTradePanel, this.railLog, this.app].forEach((el) => {
      if (el) mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
    });
    window.matchMedia(MOBILE_MQ).addEventListener?.("change", () => this.handleResize());
    window.matchMedia(LANDSCAPE_MQ).addEventListener?.("change", () => this.handleResize());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.boardRenderer?.requestDraw();
      else this.saveToStorage(); // backgrounded on a phone: may be killed without pagehide
    });
    window.addEventListener("pagehide", () => this.saveToStorage());
    window.addEventListener("resize", () => this._clampFloaters());
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

  /** Bottom sheets (trade, journal, settings): drag the top edge down to dismiss, like the grabber says. */
  _bindSheetSwipe() {
    let drag = null;
    const SHEETS = "#tradeModal, #railLog.open, .tm-settings .st-card, #devCardPicker";
    const dismiss = (el) => {
      if (el.id === "tradeModal") { if (!this.tradeLocked) this.closeTradeModal(); else return false; }
      else if (el.id === "railLog") this.toggleLog(false);
      else if (el.id === "devCardPicker") this.hideDevCardPicker();
      else if (el.classList.contains("st-card")) this.settingsUI?.close();
      this._syncScrim();
      return true;
    };
    document.addEventListener("touchstart", (e) => {
      if (!this.isMobileLayout || e.touches.length !== 1) return;
      const el = e.target.closest(SHEETS);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = e.touches[0];
      // only from the top strip (grabber + title) so lists inside still scroll
      if (t.clientY - r.top > 64 || e.target.closest("button, input, select, [role=tab]")) return;
      drag = { el, y0: t.clientY, dy: 0 };
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (!drag) return;
      drag.dy = Math.max(0, e.touches[0].clientY - drag.y0);
      drag.el.style.transition = "none";
      drag.el.style.translate = `0 ${drag.dy}px`;
    }, { passive: true });
    const end = () => {
      if (!drag) return;
      const { el, dy } = drag;
      drag = null;
      el.style.transition = "translate 180ms ease-out";
      el.style.translate = "";
      if (dy > 80) dismiss(el);
      window.setTimeout(() => { el.style.transition = ""; }, 200);
    };
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
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

  // Floating pills and popovers never poke out of the screen: after layout, any that crosses the
  // left/right edge (narrow phones, an odd container width, long names) is shifted back inside.
  _clampFloaters() {
    if (this._clampRaf) return;
    this._clampRaf = window.requestAnimationFrame(() => {
      this._clampRaf = 0;
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const M = 8;
      document.querySelectorAll(ColonistFullGame.FLOATERS).forEach((el) => {
        if (el.hidden || !el.offsetParent && getComputedStyle(el).position !== "fixed") return;
        const r = el.getBoundingClientRect();
        if (!r.width) return;
        const cur = parseFloat(el.style.translate) || 0; // shift applied last time
        const left = r.left - cur, right = r.right - cur;
        let dx = 0;
        if (right > vw - M) dx = vw - M - right;
        if (left + dx < M) dx = M - left;
        dx = Math.round(dx);
        if (dx !== cur) el.style.translate = dx ? `${dx}px 0` : "";
      });
    });
  }

  static FLOATERS = "#confirmPill, .confirm-pill, .ai-reasoning-popup, .rush-offers, .toasts, .update-chip, .vp-tooltip";

  _syncScrim() {
    if (!this.scrim) return;
    const shown = (el) => el && el.style.display !== "none" && !el.closest(".rush-seven");
    const mobile = this.isMobileLayout;
    const any = mobile
      ? this.app?.classList.contains("build-open") || this.railLog?.classList.contains("open") || [this.devCardPicker, this.victimPanel, this.discardPanel, this.incomingTradePanel].some(shown) // v0.81: the compact trade sheet leaves the board visible
      : [this.victimPanel, this.discardPanel, this.incomingTradePanel].some(shown);
    this.scrim.hidden = !any;
    this.app?.classList.toggle("trade-open", !!(mobile && shown(this.tradeModal)));
  }

  toggleBuildSheet(force) {
    const open = force ?? !this.app.classList.contains("build-open");
    this.app.classList.toggle("build-open", open && this.isMobileLayout);
    if (open) { this.hideDevCardPicker(); this.hideTradePanel(); }
    this._syncScrim();
  }

  cancelPlacement() {
    // a card played by mistake (Knight before a tile, Road Building before a road) goes back to the hand
    if (this.devPlayed && this._cancelDevPlay()) return;
    if (this.trayMode && !(this.confirmBuild && this.confirmBuild.type !== "robber")) { this.closeTray(); return; }
    if (this.confirmBuild && this.confirmBuild.type !== "robber") this.confirmBuild = null;
    if (this.pendingAction && this.pendingAction !== "robber") {
      this.pendingAction = null;
      this.canvas.style.cursor = "grab";
    }
    if (this.sea) this.sea.moveSel = null; // ⚓
    this.render();
  }

  /** The confirm pill / Place button: same path as tapping the ✓ on the board. */
  _confirmViaIcon() {
    const ic = this.getConfirmIconCenter();
    if (!ic) return;
    if (this.confirmBuild?.type === "robber") {
      this._commitRobber(this.currentPlayer, this.confirmBuild.id, this.confirmBuild.victim);
      return;
    }
    this._viaIcon = true;
    try {
      if (this.setupPhase) {
        this.handleSetupClick(ic.x, ic.y);
        this.render();
        return;
      }
      const s = this.worldToScreen(ic.x, ic.y);
      const rect = this.canvas.getBoundingClientRect();
      this.handleBoardClick({ clientX: rect.left + (s.x * rect.width) / this.boardWidth, clientY: rect.top + (s.y * rect.height) / this.boardHeight });
    } finally { this._viaIcon = false; }
  }

  // ══ Direct manipulation: Undo, dock trays, inline pickers ═══════════════
  // Phones: Build / Cards / Year of Plenty / Monopoly / robber / discard replace the four dock
  // buttons with a "tray" in the same 60 px row (no sheets, no scrim); the ticker line above the
  // board says what to do. Desktop uses the same tray in its action area.

  /** v0.86 "Steal from…" with 3+ victims: a two-column grid of rows (full names, "cards · VP"); an odd last one spans both. */
  _victimGrid(btns) {
    return btns.length >= 3 ? `<div class="vgrid" data-n="${btns.length}">${btns.join("")}</div>` : btns.join("");
  }

  /** Offer to take back the last placement (ms = 0: until something else happens). */
  _setUndo(u, ms = UNDO_MS) {
    if (this._undoTimer) { window.clearTimeout(this._undoTimer); this._timers.delete(this._undoTimer); this._undoTimer = null; }
    this.undoState = u;
    u.ms = ms;
    if (ms) {
      // v0.81: a dock tray tied to the undo ("Ship moved") goes with it, and End turn comes back
      this._undoTimer = this._later(() => { this._undoTimer = null; if (this.undoState === u) { this._dropUndo(); if (u.dock) this.render(); } }, ms);
    }
    this._renderUndo();
  }

  _dropUndo() {
    if (this._undoTimer) { window.clearTimeout(this._undoTimer); this._timers?.delete(this._undoTimer); this._undoTimer = null; }
    if (!this.undoState) return;
    this.undoState = null;
    this._renderUndo();
  }

  _renderUndo() {
    let el = document.querySelector("#undoToast");
    // docked in the ticker row on phones / under the turn banner on desktop: it never covers tiles
    const home = document.querySelector(this.isMobileLayout ? "#mtop .tkrow" : "#boardWrap .lefttop");
    if (!el) {
      if (!home) return;
      el = document.createElement("div");
      el.id = "undoToast";
      el.className = "undo-toast";
      el.setAttribute("role", "status");
      el.hidden = true;
      el.addEventListener("click", (e) => { if (e.target.closest("[data-undo]")) this.undoLast(); });
    }
    if (home && el.parentElement !== home) home.appendChild(el);
    const u = this.undoState;
    if (!u || u.dock) { el.hidden = true; el.innerHTML = ""; return; } // ⚓ a ship move offers Undo in the dock
    el.hidden = false;
    el.classList.toggle("timed", !!u.ms);
    el.style.setProperty("--undo-ms", `${u.ms || 0}ms`);
    el.innerHTML = `${icon(u.icon || "check")}<span class="ut">${u.label}</span><button type="button" class="btn ut-btn" data-undo aria-label="Undo: ${u.label}">${icon("undo")}Undo${u.noun ? ` ${u.noun}` : ""}</button><span class="ut-time" aria-hidden="true"><i></i></span>`;
  }

  /** Take back the last placement (or Year of Plenty picks): pieces, cards, bonuses and the log line. */
  undoLast() {
    const u = this.undoState;
    if (!u) return;
    this._dropUndo();
    const p = this.players[u.pid];
    const g = this.geometry;
    const dropLogs = (list) => { if (list?.length) this.logEntries = this.logEntries.filter((e) => !list.includes(e)); };
    if (u.kind === "setup") {
      const node = g.nodes[u.id];
      if (!this.setupPhase || this.setupAction !== "road" || node.owner !== p.id) return;
      node.owner = null; node.structure = null; p.settlements.delete(u.id);
      this.setupAction = "settlement";
      this.lastSetupNodeId = null;
      this.logEntries.length = Math.min(this.logEntries.length, u.logLen);
    } else if (u.kind === "build") {
      if (u.paid && !hasResources(this.bank, u.paid)) return;
      if (u.type === "ship") { // ⚓
        if (!this.sea?.removeShip(p, u.id)) return;
      } else if (u.type === "road") {
        const e = g.edges[u.id];
        if (e.owner !== p.id) return;
        e.owner = null; p.roads.delete(u.id);
      } else if (u.type === "settlement") {
        const n = g.nodes[u.id];
        if (n.owner !== p.id || n.structure !== "settlement") return;
        n.owner = null; n.structure = null; p.settlements.delete(u.id);
        if (u.isle) { this.sea?.dropBonus(p, u.isle.island); this._seaIslandNote = null; } // ⚓
      } else {
        const n = g.nodes[u.id];
        if (n.owner !== p.id || n.structure !== "city") return;
        n.structure = "settlement"; p.cities.delete(u.id); p.settlements.add(u.id);
      }
      if (u.paid) {
        RESOURCES.forEach((r) => { this.bank[r] -= u.paid[r] || 0; p.resources[r] += u.paid[r] || 0; });
        this._aiTrkNote(p, u.paid, 1);
      }
      const pos = this.getBuildPosition({ type: u.type, id: u.id });
      this.placementAnims = this.placementAnims.filter((a) => a.x !== pos.x || a.y !== pos.y);
      this.freeRoadsRemaining = u.free;
      this.pendingAction = u.pa;
      this.trayMode = u.tray;
      this.longestRoadHolder = u.lr;
      this.largestArmyHolder = u.la;
      dropLogs(u.logs);
      this.recomputeScores();
    } else if (u.kind === "moveShip") { // ⚓
      this._seaUndoMove(u);
    } else if (u.kind === "gold") { // ⚓ v0.86: the last gold pick, taken back as a whole
      if (!this._seaUndoGold(u)) return;
    } else if (u.kind === "yop") {
      if (!u.picks.every((r) => p.resources[r] > 0)) return;
      u.picks.forEach((r) => { p.resources[r] -= 1; this.bank[r] += 1; });
      this._aiTrkNote(p, u.picks.reduce((o, r) => { o[r] = (o[r] || 0) + 1; return o; }, {}), -1);
      dropLogs(u.logs);
      this.devPick = { type: "yearOfPlenty", count: u.picks.length, picks: [] };
      this.recomputeScores();
    }
    this.sfx.click();
    this.saveToStorage();
    this.render();
  }

  /** ["ore","ore"] -> "+2 Ore"; ["ore","wheat"] -> "+1 Ore +1 Grain" */
  _plusList(list) {
    return RESOURCES.filter((r) => list.includes(r)).map((r) => `+${list.filter((x) => x === r).length} ${RESOURCE_LABEL[r]}`).join(" ") || "nothing";
  }

  /** A short line in the ticker / turn banner (e.g. why a tile can't take the robber). */
  _flashPrompt(text, ms = 2600) {
    this._flash = { text, until: Date.now() + ms };
    this.renderStatusAndControls();
    window.clearTimeout(this._flashTimer);
    this._flashTimer = window.setTimeout(() => { this._flash = null; this._tickerPromptKey = null; this.renderStatusAndControls(); }, ms);
  }

  _robberBlockedReason(hexId, mover) {
    if (hexId === this.robberHexId) return "The robber is already on that tile — pick another one";
    if (this.sea && hexId === this.sea.pirateHexId) return "The pirate is already there — pick another sea hex"; // ⚓
    const prot = [...new Set(this.geometry.hexes[hexId].nodes.map((id) => this.geometry.nodes[id].owner)
      .filter((o) => o != null && this._isRobberProtected(o, mover)))].map((o) => this.players[o].name);
    return prot.length ? `${prot.join(" and ")} ${prot.length > 1 ? "are" : "is"} protected (${FRIENDLY_ROBBER_VP} points or fewer)` : "The robber can't go there";
  }

  _startRobberTimer() {
    this._cancelRobberTimer();
    const cb = this.confirmBuild;
    this._robberTimerAt = Date.now();
    this._robberTimer = this._later(() => {
      this._robberTimer = null;
      if (this.confirmBuild !== cb || this.pendingAction !== "robber" || !this.currentPlayer?.isHuman) return;
      this._commitRobber(this.currentPlayer, cb.id, cb.victim);
    }, ROBBER_SETTLE_MS);
  }

  _cancelRobberTimer() {
    if (!this._robberTimer) return;
    window.clearTimeout(this._robberTimer);
    this._timers?.delete(this._robberTimer);
    this._robberTimer = null;
  }

  /** Take back a development card that was played by mistake, before it did anything. */
  _cancelDevPlay() {
    const d = this.devPlayed;
    if (!d) return false;
    const p = this.players[d.pid];
    if (d.type === "knight" && (this.pendingAction !== "robber" || this.confirmBuild)) return false;
    if (d.type === "roadBuilding" && this.freeRoadsRemaining !== d.free) return false;
    this.devPlayed = null;
    p.devCards[d.type] += 1;
    if (this.isRush()) p.rushDevPlayed = false; else this.currentTurnPlayedDevCard = false;
    if (d.type === "knight") {
      p.knightsPlayed -= 1;
      this.largestArmyHolder = d.la;
      this.pendingAction = null;
      this.robberContext = null;
    } else if (d.type === "roadBuilding") {
      this.freeRoadsRemaining = 0;
      this.pendingAction = null;
    } else {
      this.devPick = null;
    }
    this.logEntries = this.logEntries.filter((e) => !d.logs.includes(e));
    this.canvas.style.cursor = "grab";
    this.recomputeScores();
    this.saveToStorage();
    this.render();
    return true;
  }

  /** Phones: Build opens the build tray and shows every spot you can build on right away. */
  openBuildTray(force) {
    const open = force ?? this.trayMode !== "build";
    if (!open) { this.closeTray(); return; }
    const player = this.currentPlayer;
    if (!player?.isHuman || this.winner || !this._buildPhase() || (this._robberInProgress() || this._seaHumanBlocked()) /* ⚓ gold pick */ || this.devPick) return;
    this._dropUndo();
    this.hideTradePanel();
    this.trayMode = "build";
    this.confirmBuild = null;
    this._autoPick = false;
    if (!this.freeRoadsRemaining) this.pendingAction = this._canPlaceAnything(player) ? "build" : null;
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.sfx.click();
    this.render();
  }

  /** v0.84: there is no Cards tray any more; "P" / the old entry points select a card in the hand instead
   *  (the first one you can play, else the first you hold). */
  openCardsTray(focus = null) {
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway() || this.handHidden)) return; // pass & play: not this holder's move
    if (this._robberInProgress() || this.devPick) return;
    const h = this._me();
    if (!h) return;
    const held = [...DEV_CARD_TYPES.filter((t) => h.devCards[t] + h.newDevCards[t] > 0), ...(h.devVictoryPoints ? ["victoryPoint"] : [])];
    const t = focus && held.includes(focus) ? focus : held.find((x) => this._devReady(h, x)) || held[0];
    if (!t) { this._flashPrompt(`No development cards · Buy card costs ${resourceString(COSTS.development)}`); this.render(); return; }
    this._selectDev(this.devSel === t && !focus ? null : t);
  }

  closeTray() {
    if (this.trayMode === "build" && this.pendingAction && this.pendingAction !== "robber" && !this.freeRoadsRemaining) {
      this.pendingAction = null;
      this.confirmBuild = null;
      this.canvas.style.cursor = "grab";
    }
    this.trayMode = null;
    this._trayFocus = null;
    this.render();
  }

  _canPlaceAnything(player) {
    const g = this.geometry;
    return g.edges.some((e) => this.canBuildRoad(player, e.id)) || g.nodes.some((n) => this.canBuildSettlement(player, n.id, false) || this.canBuildCity(player, n.id, false));
  }

  /** Discard on a 7: tap cards in your hand to mark them (no sheet). */
  _discardMark(res, toggle = false) {
    const pd = this.pendingDiscard;
    if (!pd) return;
    const sel = sumResources(pd.selected);
    if (sel >= pd.count || pd.selected[res] >= pd.player.resources[res]) {
      // a tap on a lifted card that can take no more puts one back (easy to change your mind)
      if (toggle && pd.selected[res] > 0) { this._discardUnmark(res); return; }
      this.sfx.error?.(); return;
    }
    pd.selected[res] += 1;
    pd.lastActAt = Date.now();
    (pd.order ||= []).push(res);
    this.sfx.click();
    this.render();
  }

  /** Put one card back: the last one picked (Undo = one step), or one of `res`. */
  _discardUnmark(res = null) {
    const pd = this.pendingDiscard;
    if (!pd) return;
    let r = res;
    if (r) {
      if (!(pd.selected[r] > 0)) return;
      const i = (pd.order || []).lastIndexOf(r);
      if (i >= 0) pd.order.splice(i, 1);
    } else r = pd.order?.pop() || RESOURCES.find((x) => pd.selected[x] > 0);
    if (!r || !(pd.selected[r] > 0)) return;
    pd.selected[r] -= 1;
    pd.lastActAt = Date.now();
    this.sfx.click();
    this.render();
  }

  /** "Suggest": hand back from your biggest piles first, keeping one of each kind where possible. */
  _discardSuggest() {
    const pd = this.pendingDiscard;
    if (!pd) return;
    this._discardSuggestPick(pd);
    pd.lastActAt = Date.now();
    this.sfx.click();
    this.render();
  }

  _discardSuggestPick(pd) {
    const left = copyResources(pd.player.resources);
    const sel = makeEmptyResources();
    for (let i = 0; i < pd.count; i += 1) {
      const r = RESOURCES.slice().sort((a, b) => left[b] - left[a])[0];
      if (!left[r]) break;
      left[r] -= 1; sel[r] += 1;
    }
    pd.selected = sel;
    pd.order = RESOURCES.flatMap((r) => Array(sel[r]).fill(r));
  }

  /** v0.81 safety net: nobody answered the discard (60 s idle / Rush clock out): hand back the Suggest choice. */
  _discardAuto() {
    const pd = this.pendingDiscard;
    if (!pd) return;
    this._discardSuggestPick(pd);
    const who = this._you(pd.player) ? "you" : pd.player.name;
    this.pushToast(`Time's up · ${pd.count} cards handed back for ${who}`);
    this.addLog(`Time's up — ${pd.count} cards handed back automatically.`);
    this._confirmDiscard();
  }

  _discardWatch(pd) {
    this._later(() => {
      if (this.pendingDiscard !== pd || this.winner) return;
      if (this.rush) return; // Rush: its own 7 clock (_rushSevenTimeout)
      const now = Date.now();
      if (this.hsCoverOn != null || document.hidden) pd.lastActAt = now; // the phone is being passed / app in background
      if (now - pd.lastActAt >= (this.discardIdleMs ?? 60000)) this._discardAuto();
      else this._discardWatch(pd);
    }, 1000);
  }

  /** Year of Plenty / Monopoly pick in the dock. */
  _pickTap(res) {
    const dp = this.devPick;
    const player = this.currentPlayer;
    if (!dp || !player?.isHuman) return;
    if (dp.type === "monopoly") {
      dp.picks = dp.picks[0] === res ? [] : [res];
      this.sfx.click();
      this.render();
      return;
    }
    const n = dp.picks.filter((r) => r === res).length;
    if (dp.picks.length >= dp.count || this.bank[res] - n <= 0) return;
    dp.picks.push(res);
    this.sfx.click();
    if (dp.picks.length === dp.count) this._finishPick();
    else this.render();
  }

  _finishPick() {
    const dp = this.devPick;
    const player = this.currentPlayer;
    if (!dp || !player?.isHuman || dp.picks.length !== dp.count) return;
    this.devPick = null;
    this.devPlayed = null;
    const logLen = this.logEntries.length;
    if (dp.type === "yearOfPlenty") {
      const gained = dp.picks.filter((resource) => this.takeFromBank(player, resource, 1) > 0);
      this.addLog(`${player.name} played Year of Plenty: ${this._plusList(gained)}.`);
      const gain = gained.reduce((o, r) => { o[r] = (o[r] || 0) + 1; return o; }, {});
      this.fx?.flyResources?.(this.players.map((p) => (p === player ? gain : {})), null);
      this.sfx.trade?.();
      if (!this.confirmPlacements) this._setUndo({ kind: "yop", pid: player.id, picks: gained, logs: this.logEntries.slice(logLen), icon: "devcard", label: `Took ${gained.map((r) => RESOURCE_LABEL[r]).join(" + ")}` });
    } else {
      const target = dp.picks[0];
      let collected = 0;
      this.players.forEach((other) => {
        if (other.id === player.id) return;
        collected += other.resources[target];
        other.resources[target] = 0;
      });
      player.resources[target] += collected;
      this._aiTrkMonopoly(player, target, collected);
      this.addLog(`${player.name} played Monopoly: +${collected} ${RESOURCE_LABEL[target]}.`);
      this.sfx.trade?.();
    }
    this.recomputeScores();
    if (this.rush) this._rushAfterAction(player);
    else { this.checkForWinner(player); this.saveToStorage(); this.render(); }
  }

  /** Small resource icons for a cost (tray buttons). */
  _costChips(type) {
    const cost = COSTS[type] || {};
    return `<span class="tcost">${RESOURCES.filter((r) => cost[r]).flatMap((r) => Array(cost[r]).fill(`<i class="cc ${r}">${icon(r)}</i>`)).join("")}</span>`;
  }

  /** What the tray shows now (null = the normal dock buttons). */
  _trayView() {
    const human = this._me();
    if (!human || this.winner) return null;
    const cur = this.currentPlayer;
    const tbtn = (attrs, inner, cls = "") => `<button type="button" class="tbtn ${cls}" ${attrs}>${inner}</button>`;
    const close = (attr = "data-tray-close", label = "Close") => tbtn(`${attr} aria-label="${label}"`, icon("close"), "tclose");
    const pd = this.pendingDiscard;
    if (pd) {
      const sel = sumResources(pd.selected);
      const total = sumResources(pd.player.resources);
      const keep = total - pd.count; // v0.82: what you end up with (matches the summary over the hand), not hand − picked so far
      return { mode: "discard",
        hint: sel === pd.count ? `Hand back ${pd.count} cards · keep ${keep}` : sel ? `Robber! Pick ${pd.count - sel} more card${pd.count - sel === 1 ? "" : "s"}` : `Robber! Hand back ${pd.count} cards`,
        html: `<div class="tinfo dsum"><b>${sel}<small>/${pd.count}</small></b><span>chosen<small>keep ${keep}</small></span></div>`
          + tbtn("data-discard-suggest", `${icon("hint")}<span>Suggest</span>`)
          + tbtn(`data-discard-undo ${sel ? "" : "disabled"}`, `${icon("undo")}<span>Undo</span>`)
          + tbtn(`data-discard-ok ${sel === pd.count ? "" : "disabled"}`, `${icon("check")}<span>Hand back</span>`, "primary wide") };
    }
    const goldTray = this.sea ? this._seaTrayGold(human, tbtn) : null; // ⚓ gold pick (also during a bot's turn)
    if (goldTray) return goldTray;
    if (!cur?.isHuman) return null;
    const cb = this.confirmBuild;
    const seaTray = this.sea && !this.robberVictimOptions?.length ? this._seaTray(human, cur, tbtn, close) : null; // ⚓ robber/pirate, move ship, set-up ship
    if (seaTray) return seaTray;
    if (this.robberVictimOptions?.length) {
      return { mode: "victims", hint: "Steal from… · tap a player",
        html: `<div class="steal-h">${icon("robber")}<span>Steal from…</span><small>1 random card</small></div>` + this._victimGrid(this.robberVictimOptions.map((id) => { const p = this.players[id]; const n = sumResources(p.resources);
          return tbtn(`data-steal="${id}"`, `${this._av(p)}<span class="vn"><b class="who pc-${id}">${p.name}</b><small>${n} card${n === 1 ? "" : "s"} · ${this.displayVictoryPoints(p)} VP</small></span>`, `victim pc-${id}`); })) };
    }
    if (this.pendingAction === "robber" && cb?.type === "robber") {
      const info = this._robberTileInfo(cb.id, cur);
      const hex = info.hex;
      const where = this._hexLabel(hex); // ⚓ "the sea" for the pirate
      const blocks = info.prod ? `blocks ${RESOURCE_LABEL[info.prod.res] || TERRAIN_NAME[info.prod.res]} on ${info.prod.num}` : hex.resource === "sea" ? "no ships here for now" : "produces nothing";
      const own = info.own ? " (yours too)" : "";
      const vic = info.victims;
      const pir = this.sea && hex.resource === "sea" ? this._seaPirateText(cb.id, cur) : null; // ⚓ the pirate's own words
      const lead = pir ? pir.hint : `Robber on ${where} · ${blocks}${own}`, sub = pir ? pir.sub : `${where} · ${blocks}`;
      if (vic.length > 1 && (!cb.victim || this.confirmPlacements)) {
        return { mode: "robber", hint: this.confirmPlacements ? "Steal from… pick a player, then Place" : "Steal from… · tap a player",
          html: `<div class="steal-h">${icon("robber")}<span>Steal from…</span><small>${pir ? lead : `${where} · ${blocks}${own}`}</small></div>` + this._victimGrid(vic.map((id) => { const p = this.players[id]; const n = sumResources(p.resources);
            return tbtn(`data-victim="${id}" aria-pressed="${cb.victim === id}"`, `${this._av(p)}<span class="vn"><b class="who pc-${id}">${p.name}</b><small>${n} card${n === 1 ? "" : "s"} · ${this.displayVictoryPoints(p)} VP</small></span>`, `victim pc-${id}${cb.victim === id ? " sel" : ""}`); }))
            + (this.confirmPlacements ? tbtn(`data-rob-now ${cb.victim != null ? "" : "disabled"}`, `${icon("check")}<span>Place</span>`, "primary") : "")
            + close("data-rob-undo", "Pick another tile") };
      }
      const v = vic.length ? this.players[cb.victim ?? vic[0]] : null;
      const timed = !this.confirmPlacements && !!this._robberTimer;
      return { mode: "robber", key: `${this._robberTimerAt}`,
        hint: lead,
        html: `<div class="tinfo rob${timed ? " timed" : ""}" style="--settle-ms:${ROBBER_SETTLE_MS}ms">${v ? this._av(v) : icon(pir ? "pirate" : "robber")}<span>${v ? `Rob <b class="who pc-${v.id}">${v.name}</b>` : "Nobody to rob"}<small>${sub}</small></span><i class="ttime" aria-hidden="true"></i></div>`
          + tbtn("data-rob-undo", `${icon("undo")}<span>${this.confirmPlacements ? "Back" : "Undo"}</span>`)
          + tbtn("data-rob-now", `${icon("check")}<span>${this.confirmPlacements ? "Place" : v ? "Rob now" : "Done"}</span>`, "primary") };
    }
    // a selected spot (Confirm placements on, or a tap outside build mode): Place sits in the dock,
    // nothing floats over the tiles
    if (cb && cb.type !== "robber" && this.isMobileLayout && (this.setupPhase ? !!this.setupAction : this._buildPhase())) {
      const info = this._confirmPillInfo();
      return { mode: "confirm", hint: `${info.title} ${info.sub}`,
        html: `<div class="tinfo">${icon(info.icon)}<span>${info.title}<small>${info.sub}</small></span></div>`
          + tbtn("data-place-cancel", `${icon("close")}<span>Cancel</span>`)
          + tbtn("data-place", `${icon("check")}<span>Place</span>`, "primary") };
    }
    const dp = this.devPick;
    if (dp) {
      const mono = dp.type === "monopoly";
      const res = RESOURCES.map((r) => {
        const n = dp.picks.filter((x) => x === r).length;
        const off = mono ? false : dp.picks.length >= dp.count || this.bank[r] - n <= 0;
        return tbtn(`data-pick="${r}" ${off ? "disabled" : ""} aria-pressed="${n > 0}"`, `<span class="card">${cardSvg(r)}</span><span>${RESOURCE_LABEL[r]}</span>${n ? `<i class="pk">${mono ? "✓" : `×${n}`}</i>${mono ? "" : `<i class="pk-minus" data-unpick="${r}" role="button" aria-label="Put one ${RESOURCE_LABEL[r]} back">−</i>`}` : ""}`, `res${n ? " sel" : ""}`);
      }).join("");
      const last = mono && dp.picks.length ? tbtn("data-pick-ok", `${icon("check")}<span>Take</span>`, "primary")
        : !mono && dp.picks.length ? tbtn("data-pick-undo aria-label=\"Undo pick\"", icon("undo"), "tclose")
        : close("data-pick-cancel", "Keep the card");
      return { mode: "pick", hint: mono
          ? (dp.picks.length ? `Take every ${RESOURCE_LABEL[dp.picks[0]]} from all players? Tap Take` : "Monopoly: pick a resource, everyone hands you theirs")
          : `Year of Plenty: tap ${dp.count - dp.picks.length} card${dp.count - dp.picks.length === 1 ? "" : "s"} to take from the bank`,
        html: res + last };
    }
    return null;
  }

  /** v0.84 phones: why a piece can't be built now (null = it can), for the build card and its taps. */
  _buildWhy(human, t) {
    if (!this._buildPhase()) return { short: "not now", text: "Build after rolling, on your turn" };
    if (this.piecesLeft(human, t) <= 0) return { short: "none left", text: `No ${t === "city" ? "cities" : `${t}s`} left` };
    const free = this.freeRoadsRemaining > 0 && (t === "road" || t === "ship");
    const miss = free ? [] : RESOURCES.filter((r) => (COSTS[t][r] || 0) > human.resources[r]).map((r) => [r, COSTS[t][r] - human.resources[r]]);
    if (miss.length) return { miss, short: "need", text: `${t === "settlement" ? "Settlement" : t[0].toUpperCase() + t.slice(1)} · you need ${missingCostString(human.resources, COSTS[t])} more` };
    const spot = { road: () => this.geometry.edges.some((e) => this.canBuildRoad(human, e.id, { free })), settlement: () => this.geometry.nodes.some((n) => this.canBuildSettlement(human, n.id, false)),
      city: () => this.geometry.nodes.some((n) => this.canBuildCity(human, n.id, false)), ship: () => this.geometry.edges.some((e) => this.canBuildShip?.(human, e.id, { free })) };
    if (!spot[t]()) return { short: "no spot", text: `No free spot for a ${t}` };
    if (this.freeRoadsRemaining > 0 && t !== "road" && t !== "ship") return { short: "roads first", text: "Place the free roads first" };
    return null;
  }

  /** Mini cost cards (the hand's card art, small). `have`: grey out the ones you still lack. */
  _miniCost(cost, have = null, only = null) {
    const left = have ? { ...have } : null;
    return RESOURCES.filter((r) => cost[r]).flatMap((r) => Array(cost[r]).fill(r)).map((r) => {
      const ok = !left || left[r] > 0;
      if (left && ok) left[r] -= 1;
      if (only === "missing" && ok) return "";
      return `<i class="mini-card${ok ? "" : " miss"}" data-r="${r}"><svg viewBox="0 0 250 350" aria-hidden="true"><use href="#cardm-${r}"/></svg></i>`;
    }).join("");
  }

  /** v0.84 phones: the small build card over the hand (Build button). Road / (Ship) / Settle / City with their
   *  costs as mini cards; a greyed row says why (the cards you lack, none left, no spot). Choosing a row lights
   *  only those spots; choosing it again goes back to all lit spots. End turn stays available. */
  _renderBuildCard(tray = null) {
    let el = document.getElementById("buildCard");
    const human = this._me();
    const open = this.isMobileLayout && this.trayMode === "build" && !!human && this.currentPlayer === human && !tray;
    this.app?.classList.toggle("build-card-open", open);
    document.querySelector("#mBuildBtn")?.classList.toggle("on", open);
    if (!open) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "buildCard"; el.className = "build-card"; el.setAttribute("role", "group"); el.setAttribute("aria-label", "Build");
      el.addEventListener("click", (e) => { e.stopPropagation(); this._onBuildCardClick(e); });
      (this.app || document.body).appendChild(el);
    }
    const pa = this.pendingAction;
    const row = (t, label) => {
      const w = this._buildWhy(human, t);
      const free = this.freeRoadsRemaining > 0 && (t === "road" || t === "ship");
      const foot = !w ? `<span class="bc-n">${free ? "free" : `${this.piecesLeft(human, t)} left`}</span>`
        : w.miss ? `<span class="bc-need">need ${w.miss.map(([r, n]) => `${n}<i class="mini-card"><svg viewBox="0 0 250 350" aria-hidden="true"><use href="#cardm-${r}"/></svg></i>`).join(" ")}</span>`
        : `<span class="bc-need">${w.short}</span>`;
      return `<button type="button" class="bc-row${pa === t ? " sel" : ""}${w ? " off" : ""}" data-bc="${t}" aria-pressed="${pa === t}" aria-disabled="${!!w}" aria-label="${label}${w ? `: ${w.text}` : ""}">`
        + `<span class="bc-top">${icon(t)}<span class="bc-name">${label}</span></span><span class="bc-cost">${free ? "" : this._miniCost(COSTS[t], human.resources)}</span>${foot}</button>`;
    };
    const html = row("road", "Road") + (this.sea ? row("ship", "Ship") : "") + row("settlement", "Settle") + row("city", "City");
    if (el.__html !== html) { el.__html = html; el.innerHTML = html; }
    el.hidden = false;
    // v0.86 landscape phones: the card takes the hand's place in the side column (CSS: column + width, here: its top)
    if (this.isLandscapePhone) { el.style.bottom = ""; el.style.top = `${Math.round(this.handArea?.getBoundingClientRect().top || 44)}px`; return; }
    const top = this.resourceCardStrip?.getBoundingClientRect().top || 0;
    const tot = this.handTotalEl && !this.handTotalEl.hidden ? this.handTotalEl.getBoundingClientRect().top : top;
    el.style.bottom = `${window.innerHeight - Math.min(top + 14, tot) + 6}px`;
  }

  _onBuildCardClick(e) {
    const b = e.target.closest("[data-bc]");
    if (!b) return;
    const t = b.dataset.bc;
    const human = this._me();
    const w = human && this._buildWhy(human, t);
    if (w) { this._flashPrompt(w.text); this.sfx.error?.(); this.render(); return; }
    if (this.pendingAction === t && !this.freeRoadsRemaining) { this.pendingAction = "build"; this.confirmBuild = null; this.sfx.click(); this.render(); return; }
    this.setPendingAction(t, { keepTray: true });
  }

  /** v0.84 phones: the build mode that is on by itself in your main phase ("auto-glow"): settlement corners and
   *  city rings glow quietly; roads only while no settlement or city can be built. */
  _autoGlowWanted() {
    if (!this.isMobileLayout || this.winner || this.setupPhase || this.phase !== "main" || this.autoplayInterval != null) return false;
    const cur = this.currentPlayer;
    if (!cur?.isHuman || this._me() !== cur) return false;
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway() || this.handHidden)) return false;
    if (this._robberInProgress() || this._seaHumanBlocked?.() || this.devPick || this.freeRoadsRemaining > 0 || this.pendingIncomingTrade) return false;
    return this._canPlaceAnything(cur);
  }

  _syncAutoGlow() {
    if (!this.players || !this.geometry) return;
    const want = this._autoGlowWanted();
    if (want && !this.pendingAction && !this.confirmBuild) { this.pendingAction = "build"; this._autoPick = false; }
    else if (!want && this.pendingAction === "build" && this.trayMode !== "build" && !this.confirmBuild && this.isMobileLayout) this.pendingAction = null;
  }

  /** Auto-glow (or the build card with nothing chosen): every lit spot builds; roads stay quiet while a corner is lit. */
  _isAutoGlow() {
    return this.isMobileLayout && this.pendingAction === "build" && !this.freeRoadsRemaining && !this.setupPhase;
  }

  /** The spot a tap found is one of the lit ones (auto-glow hides roads while a corner is lit). */
  _spotLit(t) {
    const s = this._legalPlacementSpots();
    if (!s || !t) return false;
    if (t.type === "road") return s.edges.includes(t.id);
    if (t.type === "ship") return (s.ships || []).includes(t.id);
    if (t.type === "city") return (s.cities || []).includes(t.id);
    return s.nodes.includes(t.id);
  }

  /** v0.84 dock: Buy card (one tap buys; greyed it shows only the cards you lack and a tap says what's missing). */
  _renderBuyBtn(human, canBuildNow) {
    const b = this.mBuyBtn || (this.mBuyBtn = document.querySelector("#mBuyBtn"));
    if (!b || !human) return;
    const deck = this.devDeck ? this.devDeck.length : 0;
    const afford = hasResources(human.resources, COSTS.development);
    const can = canBuildNow && afford && deck > 0 && !this.pendingDiscard && !this.devPick;
    const cost = !deck ? '<span class="mb-why">deck empty</span>' : this._miniCost(COSTS.development, human.resources, afford ? null : "missing");
    const key = `${can}|${cost}`;
    b.setAttribute("aria-disabled", String(!can));
    b.classList.toggle("off", !can);
    if (b.__key === key) return;
    b.__key = key;
    b.innerHTML = `${icon("devcard")}<span class="mlbl">Buy card</span><span class="mb-cost">${cost}</span>`;
    const lbl = can ? `Buy a development card (${resourceString(COSTS.development)})` : `Buy card: ${this._buyWhy(human)}`;
    b.setAttribute("aria-label", lbl); b.title = lbl;
  }

  _buyWhy(human) {
    if (!this.devDeck?.length) return "the development deck is empty";
    if (!hasResources(human.resources, COSTS.development)) return `you need ${missingCostString(human.resources, COSTS.development)} more`;
    if (this.phase === "pre_roll") return "roll the dice first";
    if (!this.currentPlayer?.isHuman || this.currentPlayer !== human) return "buy on your turn";
    return "not right now";
  }

  _onBuyBtn(e) {
    e.stopPropagation();
    const human = this._me();
    if (!human) return;
    if (this.hotseat && (this.hsCoverOn != null || this._hsAway() || this.handHidden)) return;
    if (this.mBuyBtn?.getAttribute("aria-disabled") !== "true") { this._hideTip(); this._buyFrom = this.mBuyBtn; this.devSel = null; this.handleHumanBuyDevCard(); return; }
    const why = this._buyWhy(human);
    this._showTip(this.mBuyBtn, `<b>Buy card</b> · ${this._miniCost(COSTS.development)}<small>${why[0].toUpperCase()}${why.slice(1)}</small>`);
    this.sfx.error?.();
  }

  /** A small bubble over a dock button (closes by itself or on the next tap). */
  _showTip(anchor, html) {
    let t = document.getElementById("dockTip");
    if (!t) { t = document.createElement("div"); t.id = "dockTip"; t.className = "dev-bubble dock-tip"; t.setAttribute("role", "status"); (this.app || document.body).appendChild(t); }
    t.innerHTML = html; t.hidden = false;
    const r = anchor.getBoundingClientRect(), W = window.innerWidth, w = Math.min(t.offsetWidth, W - 16);
    const x = Math.max(8, Math.min(W - 8 - w, r.left + r.width / 2 - w / 2));
    t.style.left = `${x}px`; t.style.bottom = `${window.innerHeight - r.top + 8}px`; t.style.setProperty("--ax", `${Math.round(r.left + r.width / 2 - x)}px`);
    window.clearTimeout(this._tipTimer);
    this._tipTimer = window.setTimeout(() => this._hideTip(), 3200);
  }

  _hideTip() { const t = document.getElementById("dockTip"); if (t) t.hidden = true; }

  _renderTray() {
    const el = document.querySelector("#dockPicker");
    if (!el) return null;
    const v = this._trayView();
    this.app?.classList.toggle("tray-open", !!v);
    el.hidden = !v;
    el.dataset.mode = v?.mode || "";
    const key = v ? v.mode + "|" + (v.key || "") + "|" + v.html : "";
    if (el.__key !== key) { el.__key = key; el.innerHTML = v ? v.html : ""; }
    return v;
  }

  _onTrayClick(e) {
    const un = e.target.closest("[data-unpick]");
    if (un && this.devPick) { // v0.81: the "−" on a picked card puts one back
      const i = this.devPick.picks.lastIndexOf(un.dataset.unpick);
      if (i >= 0) { this.devPick.picks.splice(i, 1); this.sfx.click(); this.render(); }
      return;
    }
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;
    const cur = this.currentPlayer;
    if (this._seaTrayClick(d)) return; // ⚓
    if ("discardOk" in d) { if (this.pendingDiscard && sumResources(this.pendingDiscard.selected) === this.pendingDiscard.count) this._confirmDiscard(); return; }
    if ("discardUndo" in d) { this._discardUnmark(); return; }
    if ("discardSuggest" in d) { this._discardSuggest(); return; }
    if (d.steal != null) {
      const vid = Number(d.steal);
      if (!this.robberVictimOptions?.includes(vid)) return;
      this.stealFromVictim(cur, vid);
      this.robberContext = null;
      this.robberVictimOptions = [];
      if (this.victimPanel) this.victimPanel.style.display = "none";
      this.saveToStorage();
      this.render();
      return;
    }
    const cb = this.confirmBuild?.type === "robber" ? this.confirmBuild : null;
    if (d.victim != null && cb) {
      const id = Number(d.victim);
      if (!this._stealVictims(cb.id, cur).includes(id)) return;
      if (this.confirmPlacements) { cb.victim = id; this.sfx.click(); this.render(); }
      else this._commitRobber(cur, cb.id, id);
      return;
    }
    if ("robNow" in d && cb) { this._commitRobber(cur, cb.id, cb.victim ?? this._defaultRobberVictim(cb.id, cur)); return; }
    if ("robUndo" in d) { this._cancelRobberTimer(); this.confirmBuild = null; this.sfx.click(); this.render(); return; }
    if ("place" in d) { this._confirmViaIcon(); return; }
    if ("placeCancel" in d) { this.confirmBuild = null; if (this._autoPick) { this.pendingAction = null; this._autoPick = false; } this.render(); return; }
    if (d.pick) { this._pickTap(d.pick); return; }
    if ("pickOk" in d) { this._finishPick(); return; }
    if ("pickUndo" in d) { this.devPick?.picks.pop(); this.render(); return; }
    if ("pickCancel" in d) { this._cancelDevPlay(); return; }
    if (d.devPlay) {
      if (b.getAttribute("aria-disabled") === "true") { this._trayFocus = d.devPlay; this._flashPrompt(this._devWhyNot(d.devPlay)); this.render(); return; }
      this.handleHumanPlayDevCard(d.devPlay);
      return;
    }
    if ("trayBuy" in d) { this._buyFrom = b; this.handleHumanBuyDevCard(); return; }
    if (d.trayBuild) {
      if (this.pendingAction === d.trayBuild) { this.pendingAction = "build"; this.confirmBuild = null; this.sfx.click(); this.render(); }
      else this.setPendingAction(d.trayBuild, { keepTray: true });
      return;
    }
    if ("trayClose" in d) this.closeTray();
  }

  _devWhyNot(t) {
    const h = this._me();
    if (!h) return "";
    if (h.devCards[t] === 0) return this.isRush() ? `${DEV_NAME[t]} is new: playable after the next roll` : `${DEV_NAME[t]} is new: play it next turn`;
    if (!this.currentPlayer?.isHuman) return "Cards are played on your turn";
    if (this.phase === "sbp") return "No cards in the build window · play it on your turn";
    if (this.isRush() ? h.rushDevPlayed : this.currentTurnPlayedDevCard) return "One development card per turn";
    if (this.phase === "pre_roll" && t !== "knight") return "Roll the dice first (only a Knight can be played before)";
    if (t === "roadBuilding") return "No free spot for a road";
    return `${DEV_NAME[t]} can't be played right now`;
  }

  zoomBy(f) {
    const cx = this.boardWidth / 2, cy = this.boardHeight / 2;
    const w = this.screenToWorld(cx, cy);
    const scale = clamp(this.view.scale * f, this._minScale(), this._maxScale());
    this._userZoomed = f > 1 || scale > this._fitScale * 1.01;
    this._animateView({ scale, offsetX: cx - w.x * scale, offsetY: cy - w.y * scale }, 220);
  }

  /** The fitted view (also records the fit scale = minimum zoom). */
  _fitTarget() {
    // v0.86: the harbour pills keep enough coast clearance that each pier has HARBOUR_FREE css px of open sea (room
    // for the harbour dot, 12.5 px out, past the 7 px build-spot ring). Chosen from the fit the default clearance
    // gives (one step, so it never oscillates); costs the board ~5% on a 360 px phone, nothing on a big screen.
    if (this.geometry) {
      // (a docked trade offer is left out, so the pills don't move while one comes and goes)
      this._hClear = 30; this._fitNoOffer = true;
      const f0 = this._viewFrame(); this._fitNoOffer = false;
      const s0 = Math.min(f0.vp.W / (f0.box.maxX - f0.box.minX), f0.vp.H / (f0.box.maxY - f0.box.minY));
      const pxArt = (this.geometry.hexSize / 100) * s0;
      this._hClear = pxArt > 0 ? Math.max(30, Math.ceil(HARBOUR_FREE / pxArt)) : 30;
    }
    const { box, vp } = this._viewFrame();
    const scale = Math.min(vp.W / (box.maxX - box.minX), vp.H / (box.maxY - box.minY));
    this._fitScale = scale;
    return { scale, offsetX: vp.l + vp.W / 2 - ((box.minX + box.maxX) / 2) * scale, offsetY: vp.t + vp.H / 2 - ((box.minY + box.maxY) / 2) * scale };
  }

  /** Fit the island (with harbours) into the visible board area. */
  fitView() {
    if (!this.geometry) return;
    this._stopViewMotion();
    this._userZoomed = false;
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

  /** v0.79 Classic canvas: a seat's piece shades (base / light / dark / line) — the same values the chips use. */
  _classicPc(seat) {
    const T = this.theme;
    const key = T.seatKeys?.[seat];
    return (T.pc && key && T.pc[key]) || T.seatPc?.[seat] || { base: this.players[seat]?.color || "#888", light: "#fff", dark: "#333", line: "#0f1722" };
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
    if (now.lr !== p.lr && now.lr != null) this.fx.badge(this.sea ? "tradeRoute" : "longestRoad", p.lr, now.lr); // ⚓
    if (now.la !== p.la && now.la != null) this.fx.badge("largestArmy", p.la, now.la);
  }

  _logIcon(text) {
    if (/^Build window/.test(text)) return "build";
    if (/\bwins?\b/.test(text)) return "vp";
    if (/rolled|^Roll #/.test(text)) return "dice";
    if (/robber|stole|discard/i.test(text)) return "robber";
    if (/Longest Trade Route/.test(text)) return "tradeRoute"; // ⚓
    if (/Longest Road/.test(text)) return "longestRoad";
    if (/new island/.test(text)) return "island"; // ⚓ Seafarers
    if (/pirate/.test(text)) return "pirate";
    if (/gold/.test(text)) return "gold";
    if (/\bship\b/.test(text)) return "ship";
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

  /** What a robber on this tile means: production blocked, who touches it, who can be robbed. */
  _robberTileInfo(hexId, mover) {
    const hex = this.geometry.hexes[hexId];
    const prod = hex.resource !== "desert" && hex.number ? { res: hex.resource, num: hex.number, pips: DICE_WEIGHT[hex.number] || 0 } : null;
    const touch = new Map();
    hex.nodes.forEach((nid) => {
      const n = this.geometry.nodes[nid];
      if (n.owner == null) return;
      const t = touch.get(n.owner) || { s: 0, c: 0 };
      if (n.structure === "city") t.c += 1; else t.s += 1;
      touch.set(n.owner, t);
    });
    const victims = this._stealVictims(hexId, mover);
    const opp = this.players.filter((p) => p.id !== mover.id);
    const vps = opp.map((p) => this.displayVictoryPoints(p));
    const top = Math.max(...vps);
    const leaderId = vps.filter((v) => v === top).length === 1 ? opp[vps.indexOf(top)].id : null;
    const rows = [...touch.keys()].filter((pid) => pid !== mover.id).sort((a, b) => a - b).map((pid) => {
      const p = this.players[pid];
      return { id: pid, name: p.name, vp: this.displayVictoryPoints(p), cards: sumResources(p.resources),
        dev: DEV_CARD_TYPES.reduce((n, t) => n + p.devCards[t] + p.newDevCards[t], 0),
        s: touch.get(pid).s, c: touch.get(pid).c, canRob: victims.includes(pid), leader: pid === leaderId };
    });
    return { hex, prod, rows, victims, own: touch.get(mover.id) || null };
  }

  /** Preselected victim for a robber tile: the one with most points, then most cards. */
  _defaultRobberVictim(hexId, mover) {
    const v = this._stealVictims(hexId, mover);
    if (!v.length) return null;
    const key = (id) => this.displayVictoryPoints(this.players[id]) * 100 + sumResources(this.players[id].resources);
    return v.slice().sort((a, b) => key(b) - key(a))[0];
  }

  /** Inner HTML for the robber sheet's victim list (inside the confirm pill / desktop popover). */
  _robberVictimsHtml(info, chosen) {
    const bld = (r) => [r.c ? `${r.c} cit${r.c === 1 ? "y" : "ies"}` : "", r.s ? `${r.s} settlement${r.s === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
    const pick = info.victims.length > 1;
    let h = "";
    if (!info.rows.length) h += `<div class="cp-none">Nobody to rob here</div>`;
    else if (!info.victims.length) h += `<div class="cp-none">Nobody to rob here: no cards in hand</div>`;
    else if (pick) h += `<div class="cp-ask">Rob whom? You take 1 random card.</div>`;
    info.rows.forEach((r) => {
      const sel = r.canRob && r.id === chosen;
      const tag = r.canRob ? "button" : "div";
      h += `<${tag}${r.canRob ? ` type="button" role="radio" aria-checked="${sel}" data-victim="${r.id}"` : ""} class="cp-victim pc-${r.id}${sel ? " sel" : ""}${r.canRob ? "" : " off"}">`
        + `${this._av(this.players[r.id])}<span class="cv-main"><span class="cv-name"><b class="who pc-${r.id}">${r.name}</b>${r.leader ? '<span class="cv-lead">Leader</span>' : ""}</span>`
        + `<span class="cv-meta"><span title="Resource cards">${icon("cards")}${r.cards}</span><span title="Development cards">${icon("devcard")}${r.dev}</span><span class="cv-bld">${bld(r)}</span></span></span>`
        + `<span class="cv-vp">${r.vp}<small>VP</small></span>${pick && r.canRob ? '<span class="cv-radio" aria-hidden="true"></span>' : ""}</${tag}>`;
    });
    if (info.own) h += `<div class="cp-note">Your ${info.own.c ? "city" : "settlement"}${info.own.s + info.own.c > 1 ? "s" : ""} here would be blocked too</div>`;
    return h;
  }

  _confirmPillInfo() {
    const cb = this.confirmBuild;
    if (!cb) return null;
    const terr = (nodeId) => this.geometry.nodes[nodeId].adjacentHexes.map((hid) => this.geometry.hexes[hid])
      .filter((h) => h.number && h.resource !== "desert").map((h) => `${RESOURCE_LABEL[h.resource] || TERRAIN_NAME[h.resource]} ${h.number}`).join(" · "); // ⚓ gold fields, no sea
    if (cb.type === "robber") {
      const hex = this.geometry.hexes[cb.id];
      const where = hex.resource === "desert" || !hex.number ? "the Desert" : `${TERRAIN_NAME[hex.resource]} ${hex.number}`;
      const info = this._robberTileInfo(cb.id, this.currentPlayer);
      const p = info.prod;
      const subHtml = p
        ? `Blocks ${icon(p.res)}${RESOURCE_LABEL[p.res]} on <b>${p.num}</b> <span class="cp-pips${p.pips >= 5 ? " hot" : ""}" title="${p.pips} of 36 rolls">${"•".repeat(p.pips)}</span>`
        : "Produces nothing";
      return { icon: "robber", title: `Robber on ${where}`, sub: p ? `Blocks ${RESOURCE_LABEL[p.res]} on ${p.num}` : "Produces nothing", subHtml, robber: info };
    }
    if (cb.type === "road") {
      const free = this.setupPhase || this.freeRoadsRemaining > 0;
      return { icon: "road", title: "Road here?", sub: free ? "Free road" : "Costs 1 Lumber + 1 Brick" };
    }
    if (cb.type === "ship") return { icon: "ship", title: "Ship here?", sub: this.setupPhase || this.freeRoadsRemaining > 0 ? "Free ship" : "Costs 1 Lumber + 1 Wool" }; // ⚓
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
    this.geometry.hexes.forEach((hex) => { if (hex.resource !== "sea") this.drawHex(hex); }); // ⚓ sea hexes: open water
    this.drawRobberModeOverlay();
    this.drawRollHighlight();
    this._dimForPlacement(); // v0.81
    this.drawNodeDots();
    this.drawPorts();
    this.drawRoads();
    if (this.sea) drawClassicSea(this, this.ctx); // ⚓ ships, pirate, +2 chips, ship spots
    this.drawStructures();
    this.drawBuildableHighlights();
    this.drawAnalysisOverlay(this.ctx); // analysis mode: the bot's candidate scores
    this.drawPlacementAnims();
    this.drawHoverEffects();
    this.ctx.restore();
    this.drawHoverTooltip();
  }

  render() {
    this._hsSync(); // pass & play: hide hands / ask for the phone before anything private is drawn
    this._syncAutoGlow(); // v0.84 phones: your main phase lights the spots you can build by itself
    this._queueSave();
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
    this._clampFloaters();
    this._renderAnalysis();
    if (!document.body.dataset.gameReady) {
      document.body.dataset.gameReady = "true";
    }
  }
}

// 5–6 players: Special Building Phase engine + bots (src/six.js) and its UI (src/six-ui.js)
Object.assign(ColonistFullGame.prototype, SbpMixin, SixUiMixin, AnalysisMixin, LabMixin);
// AI Lab (lab.html): settings + bot tables for its engine iframes
ColonistFullGame.labHelpers = { normalizeSettings, DEFAULT_SETTINGS, AI_PRESETS, AI_PRESET_INFO, AI_STRATEGY_CATEGORIES, AI_LEVEL_LABEL, AI_PLAN_WEIGHTS, AI_WEIGHT_KEYS };
Object.assign(ColonistFullGame.prototype, SeaGame); // ⚓ Seafarers game-side methods (src/seafarers/ui.js)
// Pass & play (src/hotseat.js): defineProperties keeps its `hotseat` getter a getter
Object.defineProperties(ColonistFullGame.prototype, Object.getOwnPropertyDescriptors(HotseatMixin));
// End-of-game statistics: recorder (src/stats.js) + stats screen and replay (src/stats-ui.js)
Object.assign(ColonistFullGame.prototype, StatsMixin, StatsUiMixin);
installStats(ColonistFullGame);
Object.assign(ColonistFullGame.prototype, LiveStatsMixin); // live stats during the game (src/live-stats.js)
installLiveStats(ColonistFullGame);

const game = new ColonistFullGame();
window.__colonistGame = game; // debug/testing handle
if (document.documentElement.dataset.lab) game._labBoot(document.documentElement.dataset.lab); // AI Lab engine (lab.html)
