const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
const RESOURCE_SHORT = { wood: "Wd", brick: "Br", sheep: "Sh", wheat: "Wh", ore: "Or" };
const RESOURCE_LABEL = { wood: "Wood", brick: "Brick", sheep: "Sheep", wheat: "Wheat", ore: "Ore" };
const RESOURCE_ICON_PATH = {
  wood: "./assets/icons/resource-wood.svg",
  brick: "./assets/icons/resource-brick.svg",
  sheep: "./assets/icons/resource-sheep.svg",
  wheat: "./assets/icons/resource-wheat.svg",
  ore: "./assets/icons/resource-ore.svg",
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

const PLAYER_CONFIG = [
  { name: "You", color: "#e63946", isHuman: true, avatar: "./assets/avatars/avatar-human.svg" },
  { name: "Pioneer AI", color: "#2a6fdb", isHuman: false, avatar: "./assets/avatars/avatar-pioneer.svg" },
  { name: "Sage AI", color: "#e8a317", isHuman: false, avatar: "./assets/avatars/avatar-sage.svg" },
  { name: "Vector AI", color: "#2db87e", isHuman: false, avatar: "./assets/avatars/avatar-vector.svg" },
];

const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
const SQRT3 = Math.sqrt(3);
const BOARD_RADIUS = 2;
const WINNING_POINTS = 10;
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
};

const DEFAULT_AI_STRATEGY = { ...AI_PRESETS.intermediate };

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
  const wDiv = aspect < 1 ? 11 : 13;
  const hexSize = Math.min(canvasWidth / wDiv, canvasHeight / 7.6);
  const centerX = canvasWidth * 0.47;
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

function assignTiles(geometry) {
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
    this.showAiReasoning = false;
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
    this.animTime = 0;
    this.lastAnimationTs = 0;
    this.animationFrame = null;
    this.highlightRoll = null; // { number, startTime } — highlights hexes with rolled number
    this.placementAnims = []; // [{ x, y, type, startTime }] — build placement pop animations
    this.boardWidth = Number(this.canvas.getAttribute("width")) || 1100;
    this.boardHeight = Number(this.canvas.getAttribute("height")) || 560;
    this.pixelRatio = 1;
    this.view = { offsetX: 0, offsetY: 0, scale: 1 };
    this.dragState = { active: false, startX: 0, startY: 0, baseOffsetX: 0, baseOffsetY: 0 };
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverPointer = { x: 0, y: 0 };
    this.hoverTooltip = "";

    this.configureCanvasResolution();
    this.fitCanvasToContainer();
    this.populateResourceSelects();
    this.bindControls();
    if (!this.loadFromStorage()) {
      this.resetGame();
    }
    this._buildStrategyUI();
    this.startAnimationLoop();
  }

  configureCanvasResolution() {
    this.pixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
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
    if (window.innerWidth <= 1080) {
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w !== this.boardWidth || h !== this.boardHeight) {
        this.boardWidth = w;
        this.boardHeight = h;
        this.configureCanvasResolution();
        this.rebuildGeometry();
      }
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.margin = "0";
      return;
    }
    const aspect = this.boardWidth / this.boardHeight;
    const containerAspect = rect.width / rect.height;
    if (containerAspect > aspect) {
      this.canvas.style.height = "100%";
      this.canvas.style.width = Math.round(rect.height * aspect) + "px";
      this.canvas.style.margin = "0 auto";
    } else {
      this.canvas.style.width = "100%";
      this.canvas.style.height = Math.round(rect.width / aspect) + "px";
      this.canvas.style.margin = "auto 0";
    }
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
    this.fitCanvasToContainer();
    this.render();
  }

  startAnimationLoop() {
    const frameInterval = 1000 / 32;
    const step = (ts) => {
      if (!this.lastAnimationTs) this.lastAnimationTs = ts;
      const deltaMs = ts - this.lastAnimationTs;
      if (document.hidden) {
        this.lastAnimationTs = ts;
        this.animationFrame = window.requestAnimationFrame(step);
        return;
      }
      if (deltaMs < frameInterval) {
        this.animationFrame = window.requestAnimationFrame(step);
        return;
      }
      this.lastAnimationTs = ts;
      this.animTime += deltaMs * 0.001;
      this.drawCanvasScene();
      this.animationFrame = window.requestAnimationFrame(step);
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
      this.resetGame();
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
    this.speedRange.addEventListener("input", () => {
      if (this.autoplayInterval) {
        this.stopAutoplay();
        this.startAutoplay();
      }
    });
    this.canvas.addEventListener("click", (event) => this.handleBoardClick(event));
    this.canvas.addEventListener("mousemove", (event) => this.handleCanvasMouseMove(event));
    this.canvas.addEventListener("mouseleave", () => this.handleCanvasMouseLeave());
    this.canvas.addEventListener("mousedown", (event) => this.handleCanvasMouseDown(event));
    window.addEventListener("mouseup", () => this.handleCanvasMouseUp());
    this.canvas.addEventListener(
      "wheel",
      (event) => this.handleCanvasWheel(event),
      { passive: false },
    );
    // ── Touch state ──
    this.touchState = {
      startTouches: null,
      lastTouches: null,
      isPinching: false,
      isDragging: false,
      startTime: 0,
      startX: 0,
      startY: 0,
      totalMoved: 0,
      lastTapTime: 0,
      lastTapX: 0,
      lastTapY: 0,
    };

    this.canvas.addEventListener("touchstart", (event) => {
      event.preventDefault();
      const ts = this.touchState;
      ts.startTime = Date.now();

      if (event.touches.length === 2) {
        // Start pinch zoom
        ts.isPinching = true;
        ts.isDragging = false;
        ts.startTouches = this.getTouchPair(event.touches);
        ts.lastTouches = ts.startTouches;
        this.dragState.active = false;
      } else if (event.touches.length === 1) {
        const touch = event.touches[0];
        ts.startX = touch.clientX;
        ts.startY = touch.clientY;
        ts.totalMoved = 0;
        ts.isPinching = false;
        ts.isDragging = false;
        // Start drag if not in placement mode
        if (!this.pendingAction && !this.setupPhase) {
          this.handleCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0 });
        }
      }
    }, { passive: false });

    this.canvas.addEventListener("touchmove", (event) => {
      event.preventDefault();
      const ts = this.touchState;

      if (event.touches.length === 2 && ts.isPinching) {
        const pair = this.getTouchPair(event.touches);
        this.handlePinchMove(ts.lastTouches, pair);
        ts.lastTouches = pair;
      } else if (event.touches.length === 1 && !ts.isPinching) {
        const touch = event.touches[0];
        const dx = touch.clientX - ts.startX;
        const dy = touch.clientY - ts.startY;
        ts.totalMoved += Math.abs(dx - (ts.lastDx || 0)) + Math.abs(dy - (ts.lastDy || 0));
        ts.lastDx = dx;
        ts.lastDy = dy;
        ts.isDragging = true;
        this.handleCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
      }
    }, { passive: false });

    this.canvas.addEventListener("touchend", (event) => {
      event.preventDefault();
      const ts = this.touchState;

      if (ts.isPinching) {
        // End pinch — if still one finger left, ignore until all up
        if (event.touches.length === 0) {
          ts.isPinching = false;
        }
        this.dragState.active = false;
        return;
      }

      this.handleCanvasMouseUp();

      // Only fire click if it was a quick tap without much movement
      const now = Date.now();
      const elapsed = now - ts.startTime;
      const wasTap = elapsed < 300 && ts.totalMoved < 20;
      if (wasTap && event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        // Double-tap detection
        const dtSince = now - ts.lastTapTime;
        const dtDist = Math.hypot(touch.clientX - ts.lastTapX, touch.clientY - ts.lastTapY);
        if (dtSince < 350 && dtDist < 40) {
          // Double tap — zoom in/out
          this.handleDoubleTapZoom(touch.clientX, touch.clientY);
          ts.lastTapTime = 0;
        } else {
          this.handleBoardClick({ clientX: touch.clientX, clientY: touch.clientY });
          ts.lastTapTime = now;
          ts.lastTapX = touch.clientX;
          ts.lastTapY = touch.clientY;
        }
      }

      ts.isDragging = false;
      ts.totalMoved = 0;
      ts.lastDx = 0;
      ts.lastDy = 0;
    }, { passive: false });

    this.canvas.addEventListener("touchcancel", () => {
      this.touchState.isPinching = false;
      this.touchState.isDragging = false;
      this.dragState.active = false;
    });
    window.addEventListener("keydown", (event) => this.handleKeyboardShortcut(event));
    this.logToggle.addEventListener("click", () => this.toggleLog());
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.handleResize(), 200);
    });
  }

  toggleLog() {
    const isOpen = this.railLog.classList.toggle("open");
    this.logToggle.classList.toggle("active", isOpen);
    this.logToggle.innerHTML = isOpen ? "&#10005;" : "&#9776;";
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
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
    this.view.offsetX = 0;
    this.view.offsetY = 0;
    this.view.scale = 1;
    this.render();
  }

  resetGame() {
    this.stopAiTurnLoop();
    this.removeGameOverOverlay();
    this.clearStorage();
    this.geometry = createBoardGeometry(this.boardWidth, this.boardHeight);
    this.robberHexId = assignTiles(this.geometry);
    this.ports = assignPorts(this.geometry);
    this.devDeck = createDevelopmentDeck();

    // Load persisted strategies or use defaults
    const savedStrategies = this._loadStrategies();
    this.players = PLAYER_CONFIG.map((config, id) => ({
      id,
      name: config.name,
      color: config.color,
      isHuman: config.isHuman,
      avatar: config.avatar,
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
      strategy: config.isHuman ? null : { ...(savedStrategies[id] || DEFAULT_AI_STRATEGY) },
    }));

    this.logEntries = [];
    this.turn = 1;
    this.currentPlayerIndex = 0;
    this.phase = "pre_roll";
    this.lastRoll = null;
    this.winner = null;
    this.pendingAction = null;
    this.robberContext = null;
    this.robberVictimOptions = [];
    this.confirmBuild = null; // { type: "road"|"settlement"|"city", id: edgeId|nodeId }
    if (this.victimPanel) this.victimPanel.style.display = "none";
    if (this.incomingTradePanel) this.incomingTradePanel.style.display = "none";
    this.pendingIncomingTrade = null;
    this.tradeOffer = makeEmptyResources();
    this.tradeRequest = makeEmptyResources();
    this.hideTradePanel();
    this.currentTurnPlayedDevCard = false;
    this.longestRoadHolder = null;
    this.largestArmyHolder = null;
    this.view.offsetX = 0;
    this.view.offsetY = 0;
    this.view.scale = 1;
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";
    this.canvas.style.cursor = "grab";

    this.initialPlacement();
    this.recomputeScores();
    this.addLog("Game initialized with full rule set and strategic AI.");
    this.render();
  }

  initialPlacement() {
    this.setupPhase = true;
    const order = shuffle([0, 1, 2, 3]);
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
      this.currentPlayerIndex = 0;
      this.phase = "pre_roll";
      this.addLog("Initial placement complete.");
      this.saveToStorage();
      this.render();
      if (!this.currentPlayer.isHuman) {
        this.scheduleAiTurnsUntilHuman();
      }
      return;
    }

    const playerId = this.setupQueue[this.setupStep];
    const player = this.players[playerId];

    if (player.isHuman) {
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

    setTimeout(() => {
      const roadId = this.getBestRoadFromNode(player, nodeId);
      if (roadId != null) this.placeRoad(player, roadId, { free: true, setupNode: nodeId });
      if (this.setupStep >= this.players.length) {
        this.geometry.nodes[nodeId].adjacentHexes.forEach((hexId) => {
          const hex = this.geometry.hexes[hexId];
          if (hex.resource !== "desert") player.resources[hex.resource] += 1;
        });
      }
      this.addLog(`${player.name} placed a road.`);
      this.sfx.buildRoad();
      this.recomputeScores();
      this.render();
      this.setupStep++;
      setTimeout(() => this.processSetupQueue(), 350);
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
            if (hex.resource !== "desert") player.resources[hex.resource] += 1;
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
    this.logEntries.push({ text, meta, time: Date.now() });
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }
    if (this.shouldToast(text)) this.pushToast(text);
  }

  shouldToast(text) {
    return /(rolled|built|upgraded|traded|played|stole|wins|moved robber|gains)/i.test(text);
  }

  pushToast(text) {
    if (!this.toastStack) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    this.toastStack.appendChild(toast);
    while (this.toastStack.children.length > this.maxToasts) {
      this.toastStack.removeChild(this.toastStack.firstChild);
    }
    window.setTimeout(() => {
      if (!toast.parentElement) return;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-4px)";
      window.setTimeout(() => toast.remove(), 180);
    }, 2600);
  }

  rollDice() {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    return { total: d1 + d2, d1, d2 };
  }

  handleHumanRoll() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "pre_roll") return;
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
    const player = rollerPlayer || this.currentPlayer;
    const overlay = document.createElement("div");
    overlay.className = "dice-overlay";

    // Show who is rolling
    const label = document.createElement("div");
    label.className = "dice-roller-label";
    label.innerHTML = `<img src="${player.avatar}" alt="" /><span style="color:${player.color}">${player.name}</span>`;
    overlay.appendChild(label);

    const row = document.createElement("div");
    row.className = "dice-row";
    const die1 = document.createElement("div");
    die1.className = "die rolling";
    const die2 = document.createElement("div");
    die2.className = "die rolling";
    row.appendChild(die1);
    row.appendChild(die2);
    overlay.appendChild(row);

    const totalEl = document.createElement("div");
    totalEl.className = "dice-total";
    totalEl.textContent = "";
    overlay.appendChild(totalEl);

    document.querySelector(".board-panel").appendChild(overlay);
    this.sfx.diceRoll();

    let ticks = 0;
    const maxTicks = 12;
    const tickInterval = setInterval(() => {
      this._renderDieFace(die1, 1 + Math.floor(Math.random() * 6));
      this._renderDieFace(die2, 1 + Math.floor(Math.random() * 6));
      // Tick sounds during roll
      if (ticks % 3 === 0) this._playNoise(0.02, 0.04);
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(tickInterval);
        const result = this.rollDice();
        this.diceResult = result;
        this._renderDieFace(die1, result.d1);
        this._renderDieFace(die2, result.d2);
        die1.classList.remove("rolling");
        die2.classList.remove("rolling");
        die1.classList.add("landed");
        die2.classList.add("landed");
        totalEl.textContent = result.total;
        setTimeout(() => {
          overlay.classList.add("fade-out");
          setTimeout(() => { overlay.remove(); callback(); }, 300);
        }, 600);
      }
    }, 70);
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
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner) return;
    if (this.phase !== "main" || this.pendingAction === "robber") return;
    this.hideTradePanel();
    this.endTurn();
    this.saveToStorage();
    this.scheduleAiTurnsUntilHuman();
  }

  setPendingAction(action) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main") return;
    if (this.pendingAction === "robber") return; // Cannot override robber placement
    if (action === "road" && !hasResources(player.resources, COSTS.road)) return;
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
    if (!player || !player.isHuman || this.winner || this.phase !== "main") return;
    this.buyDevelopmentCard(player);
    this.recomputeScores();
    this.checkForWinner(player);
    this.render();
  }

  handleHumanPlayDevCard(type) {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main") return;
    const played = this.playDevelopmentCard(player, type);
    if (played) {
      this.recomputeScores();
      this.checkForWinner(player);
      this.render();
    }
  }

  handleHumanBankTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.winner || this.phase !== "main") return;
    const offeredTypes = RESOURCES.filter(r => this.tradeOffer[r] > 0);
    const requestedTypes = RESOURCES.filter(r => this.tradeRequest[r] > 0);
    if (offeredTypes.length !== 1 || requestedTypes.length !== 1) return;
    const give = offeredTypes[0];
    const get = requestedTypes[0];
    if (give === get) return;
    const ok = this.performBankTrade(player, give, get);
    if (ok) {
      this.tradeOffer = makeEmptyResources();
      this.tradeRequest = makeEmptyResources();
      this.buildTradeGrids();
      this.updateTradeButtons();
      if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = '<span style="color:#22a854">Bank trade complete!</span>';
      this.sfx.trade();
    } else {
      if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = '<span style="color:#c44">Bank trade failed.</span>';
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
    if (!player || !player.isHuman || this.phase !== "main" || this.winner) return;

    const { x: sx, y: sy } = this.getCanvasPoint(event);
    const world = this.screenToWorld(sx, sy);
    const x = world.x;
    const y = world.y;

    // Robber placement mode
    if (this.pendingAction === "robber") {
      const hexId = this.findHexAt(x, y);
      if (hexId == null) return;
      if (hexId === this.robberHexId) {
        this.addLog("Cannot place robber on the same hex.");
        this.render();
        return;
      }
      this.robberHexId = hexId;
      const hex = this.geometry.hexes[hexId];
      const tileName = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource];
      this.addLog(`${player.name} moved robber to ${tileName}.`);
      this.pendingAction = null;

      // Check for steal victims
      const victimSet = new Set();
      hex.nodes.forEach((nodeId) => {
        const owner = this.geometry.nodes[nodeId].owner;
        if (owner != null && owner !== player.id && sumResources(this.players[owner].resources) > 0) {
          victimSet.add(owner);
        }
      });
      const victims = [...victimSet];
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
      this.render();
      return;
    }

    if (!this.pendingAction) {
      return;
    }

    // Check if tapping the confirm icon (green checkmark above selected spot)
    if (this.confirmBuild && this.hitTestConfirmIcon(x, y)) {
      const cb = this.confirmBuild;
      let built = false;
      if (cb.type === "road") {
        if (this.placeRoad(player, cb.id, { free: false })) {
          payCost(player.resources, COSTS.road);
          this.addLog(`${player.name} built a road.`);
          this.sfx.buildRoad();
          built = true;
        }
      } else if (cb.type === "settlement") {
        if (this.placeSettlement(player, cb.id, false)) {
          payCost(player.resources, COSTS.settlement);
          this.addLog(`${player.name} built a settlement.`);
          this.sfx.buildSettlement();
          built = true;
        }
      } else if (cb.type === "city") {
        if (this.placeCity(player, cb.id, false)) {
          payCost(player.resources, COSTS.city);
          this.addLog(`${player.name} upgraded to a city.`);
          this.sfx.buildCity();
          built = true;
        }
      }
      if (built) {
        // Trigger placement animation
        const animPos = this.getBuildPosition(cb);
        if (animPos) this.placementAnims.push({ ...animPos, type: cb.type, startTime: Date.now() });
        this.pendingAction = null;
        this.confirmBuild = null;
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
      if (this.canBuildRoad(player, edgeId, { free: false })) {
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

    if (this.dragState.active) {
      this.view.offsetX = this.dragState.baseOffsetX + (sx - this.dragState.startX);
      this.view.offsetY = this.dragState.baseOffsetY + (sy - this.dragState.startY);
      this.canvas.style.cursor = "grabbing";
      this.drawCanvasScene();
      return;
    }

    const world = this.screenToWorld(sx, sy);
    this.updateHoverTargets(world.x, world.y);
    this.drawCanvasScene();
  }

  handleCanvasMouseLeave() {
    this.dragState.active = false;
    this.hoverHexId = null;
    this.hoverNodeId = null;
    this.hoverEdgeId = null;
    this.hoverTooltip = "";
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.drawCanvasScene();
  }

  handleCanvasMouseDown(event) {
    if (event.button !== 0) return;
    if (this.pendingAction || this.setupPhase) return;
    this.dragState.active = true;
    const { x: sx, y: sy } = this.getCanvasPoint(event);
    this.dragState.startX = sx;
    this.dragState.startY = sy;
    this.dragState.baseOffsetX = this.view.offsetX;
    this.dragState.baseOffsetY = this.view.offsetY;
    this.canvas.style.cursor = "grabbing";
  }

  handleCanvasMouseUp() {
    if (!this.dragState.active) return;
    this.dragState.active = false;
    this.canvas.style.cursor = this.pendingAction ? "crosshair" : "grab";
    this.drawCanvasScene();
  }

  handleCanvasWheel(event) {
    event.preventDefault();
    const { x: sx, y: sy } = this.getCanvasPoint(event);
    const before = this.screenToWorld(sx, sy);
    const factor = event.deltaY < 0 ? 1.12 : 0.88;
    this.view.scale = clamp(this.view.scale * factor, 0.45, 1.95);
    this.view.offsetX = sx - before.x * this.view.scale;
    this.view.offsetY = sy - before.y * this.view.scale;
    this.drawCanvasScene();
  }

  getTouchPair(touches) {
    return {
      x1: touches[0].clientX, y1: touches[0].clientY,
      x2: touches[1].clientX, y2: touches[1].clientY,
      dist: Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY),
      midX: (touches[0].clientX + touches[1].clientX) / 2,
      midY: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  handlePinchMove(prev, curr) {
    if (prev.dist === 0) return;
    const factor = curr.dist / prev.dist;
    const mid = this.getCanvasPoint({ clientX: curr.midX, clientY: curr.midY });
    const before = this.screenToWorld(mid.x, mid.y);
    this.view.scale = clamp(this.view.scale * factor, 0.35, 2.5);
    this.view.offsetX = mid.x - before.x * this.view.scale;
    this.view.offsetY = mid.y - before.y * this.view.scale;

    // Also pan with the midpoint movement
    const prevMid = this.getCanvasPoint({ clientX: prev.midX, clientY: prev.midY });
    this.view.offsetX += (mid.x - prevMid.x);
    this.view.offsetY += (mid.y - prevMid.y);

    this.drawCanvasScene();
  }

  handleDoubleTapZoom(clientX, clientY) {
    const pt = this.getCanvasPoint({ clientX, clientY });
    const before = this.screenToWorld(pt.x, pt.y);
    // Toggle between zoomed-in and default
    const targetScale = this.view.scale < 1.4 ? 1.8 : 1.0;
    this.view.scale = targetScale;
    if (targetScale === 1.0) {
      this.view.offsetX = 0;
      this.view.offsetY = 0;
    } else {
      this.view.offsetX = pt.x - before.x * this.view.scale;
      this.view.offsetY = pt.y - before.y * this.view.scale;
    }
    this.drawCanvasScene();
  }

  handleKeyboardShortcut(event) {
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
      // Close trade panel on Escape
      this.hideTradePanel();
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
    if (humanMain && this.pendingAction === "robber") {
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
    if (this.phase !== "pre_roll") return;
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
    this.addLog(`Turn ${this.turn}: ${player.name} rolled ${this.lastRoll}.`);
    this.sfx.diceResult();
    // Highlight matching hex tokens
    if (this.lastRoll !== 7) {
      this.highlightRoll = { number: this.lastRoll, startTime: Date.now() };
    }
    if (this.lastRoll === 7) this.resolveRobber(player, "rolled a 7");
    else {
      const gains = this.distributeResources(this.lastRoll);
      // Show resource gain toasts for ALL players
      if (gains) this.showResourceGainToasts(gains);
    }
  }

  distributeResources(roll) {
    const gainByPlayer = this.players.map(() => makeEmptyResources());
    this.geometry.hexes.forEach((hex) => {
      if (hex.id === this.robberHexId || hex.number !== roll) return;
      hex.nodes.forEach((nodeId) => {
        const node = this.geometry.nodes[nodeId];
        if (node.owner == null || node.structure == null) return;
        const amount = node.structure === "city" ? 2 : 1;
        const owner = this.players[node.owner];
        owner.resources[hex.resource] += amount;
        gainByPlayer[node.owner][hex.resource] += amount;
      });
    });
    gainByPlayer.forEach((gain, playerId) => {
      if (sumResources(gain) > 0) {
        this.addLog(`${this.players[playerId].name} gains ${resourceString(gain)}.`);
      }
    });
    return gainByPlayer;
  }

  resolveRobber(currentPlayer, reason) {
    // Collect players that need to discard
    const discardQueue = [];
    this.players.forEach((player) => {
      const total = sumResources(player.resources);
      if (total <= 7) return;
      const discardCount = Math.floor(total / 2);
      if (player.isHuman) {
        discardQueue.push({ player, count: discardCount });
      } else {
        // AI auto-discards
        for (let i = 0; i < discardCount; i += 1) {
          const candidates = RESOURCES.filter((r) => player.resources[r] > 0).map((r) => ({
            resource: r,
            weight: player.resources[r],
          }));
          if (!candidates.length) break;
          const chosen = chooseRandomWeighted(candidates).resource;
          player.resources[chosen] -= 1;
        }
        this.addLog(`${player.name} discards ${discardCount} cards after ${reason}.`);
      }
    });

    // If human needs to discard, show UI and wait
    const continueAfterDiscard = () => {
      if (currentPlayer.isHuman) {
        this.robberContext = { playerId: currentPlayer.id };
        this.pendingAction = "robber";
        this.addLog("Move the robber — tap a hex.");
        this.render();
        return;
      }
      const targetHexId = this.chooseRobberHex(currentPlayer);
      this.moveRobberAndSteal(currentPlayer, targetHexId);
    };

    if (discardQueue.length > 0) {
      const { player, count } = discardQueue[0];
      this._showDiscardUI(player, count).then(() => {
        continueAfterDiscard();
      });
    } else {
      continueAfterDiscard();
    }
  }

  chooseRobberHex(currentPlayer) {
    const awareness = currentPlayer.strategy?.awareness || "basic";

    // None: random non-desert hex
    if (awareness === "none") {
      const candidates = this.geometry.hexes.filter(h =>
        h.id !== this.robberHexId && h.resource !== "desert" && h.number
      );
      if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)].id;
      return this.robberHexId;
    }

    // Advanced: identify VP leader and target them specifically
    const vpLeader = awareness === "advanced"
      ? this.players.filter(p => p.id !== currentPlayer.id).sort((a, b) => b.victoryPoints - a.victoryPoints)[0]
      : null;

    let bestHex = this.robberHexId;
    let bestScore = Number.NEGATIVE_INFINITY;
    this.geometry.hexes.forEach((hex) => {
      if (hex.id === this.robberHexId) return;
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
            score += base * (vpLeader.victoryPoints >= 7 ? 2.0 : 0.8);
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
    this.addLog(`${currentPlayer.name} moved robber to hex #${targetHexId}.`);
    this.sfx.robber();
    const victimOptions = new Set();
    this.geometry.hexes[targetHexId].nodes.forEach((nodeId) => {
      const owner = this.geometry.nodes[nodeId].owner;
      if (owner != null && owner !== currentPlayer.id && sumResources(this.players[owner].resources) > 0) {
        victimOptions.add(owner);
      }
    });
    const victims = [...victimOptions];
    if (!victims.length) return;
    // Advanced awareness: steal from VP leader
    let victimId;
    const awareness = currentPlayer.strategy?.awareness || "basic";
    if (awareness === "advanced" && victims.length > 1) {
      victimId = victims.sort((a, b) => this.players[b].victoryPoints - this.players[a].victoryPoints)[0];
    } else {
      victimId = victims[Math.floor(Math.random() * victims.length)];
    }
    this._doSteal(currentPlayer, victimId);
  }

  _doSteal(currentPlayer, victimId) {
    const victim = this.players[victimId];
    const available = RESOURCES.filter((r) => victim.resources[r] > 0);
    if (!available.length) return;
    const stolen = available[Math.floor(Math.random() * available.length)];
    victim.resources[stolen] -= 1;
    currentPlayer.resources[stolen] += 1;
    this.addLog(`${currentPlayer.name} stole 1 ${stolen} from ${victim.name}.`);
    this.sfx.steal();
    this._showStealAnimation(currentPlayer, victim, stolen);
  }

  _showStealAnimation(thief, victim, resource) {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const toast = document.createElement("div");
    toast.className = "toast steal-toast";
    toast.innerHTML = `
      <img class="rgt-avatar" src="${thief.avatar}" alt="" />
      <span style="color:${thief.color};font-weight:700;font-size:0.68rem">${thief.name}</span>
      <span style="font-size:0.65rem;color:#c44">stole</span>
      <img style="width:16px;height:16px" src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />
      <span style="font-size:0.65rem">from</span>
      <img class="rgt-avatar" src="${victim.avatar}" alt="" />
      <span style="color:${victim.color};font-weight:700;font-size:0.68rem">${victim.name}</span>
    `;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-4px)";
      setTimeout(() => toast.remove(), 180);
    }, 3000);
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
      btn.className = "victim-btn";
      btn.innerHTML = `
        <img class="victim-avatar" src="${v.avatar}" alt="${v.name}" />
        <span style="color:${v.color}">${v.name}</span>
        <span class="victim-cards">${totalCards} cards</span>
      `;
      btn.addEventListener("click", () => {
        this.stealFromVictim(currentPlayer, vid);
        this.robberContext = null;
        this.robberVictimOptions = [];
        this.victimPanel.style.display = "none";
        this.render();
      });
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
    if (this.tradeProposalResult) this.tradeProposalResult.innerHTML = "";
    this.buildTradeGrids();
    this.updateTradeButtons();
  }

  closeTradeModal() {
    if (this.tradeModal) this.tradeModal.style.display = "none";
  }

  hideTradePanel() {
    this.closeTradeModal();
  }

  buildTradeGrids() {
    const player = this.currentPlayer;
    const maxOffer = player?.isHuman ? player.resources : null;
    this._renderResourceGrid(this.tradeOfferGrid, this.tradeOffer, maxOffer, true);
    this._renderResourceGrid(this.tradeRequestGrid, this.tradeRequest, null, false);
  }

  _renderResourceGrid(container, counts, maxCounts, isOffer) {
    if (!container) return;
    container.innerHTML = "";
    const player = this.currentPlayer;
    RESOURCES.forEach((resource) => {
      const item = document.createElement("div");
      item.className = "trade-res-item";
      const max = maxCounts ? maxCounts[resource] : 19;
      const count = counts[resource];
      const rate = isOffer && player ? this.getPlayerTradeRate(player, resource) : null;

      const card = document.createElement("div");
      card.className = `trade-res-card ${resource}${count > 0 ? " has-count" : ""}`;
      card.innerHTML = `
        <img src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />
        ${count > 0 ? `<span class="trade-card-badge">${count}</span>` : ""}
        ${isOffer && rate ? `<span class="trade-card-rate">${rate}:1</span>` : ""}
      `;
      // Left click = increment
      card.addEventListener("click", () => {
        const newVal = counts[resource] + 1;
        if (newVal > max) return;
        counts[resource] = newVal;
        this._refreshTradeGrids();
      });
      // Right click = decrement
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (counts[resource] <= 0) return;
        counts[resource] -= 1;
        this._refreshTradeGrids();
      });
      item.appendChild(card);
      // Small minus button when count > 0
      if (count > 0) {
        const minus = document.createElement("button");
        minus.className = "trade-res-minus";
        minus.textContent = "−";
        minus.addEventListener("click", (e) => {
          e.stopPropagation();
          counts[resource] = Math.max(0, counts[resource] - 1);
          this._refreshTradeGrids();
        });
        item.appendChild(minus);
      }
      container.appendChild(item);
    });
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
      canBank = this.tradeOffer[giveRes] === rate && this.tradeRequest[requestedTypes[0]] === 1;
    }
    if (this.tradeExecuteBtn) {
      this.tradeExecuteBtn.disabled = !canBank;
      const rateText = offeredTypes.length === 1 ? `(${this.getPlayerTradeRate(player, offeredTypes[0])}:1)` : "";
      this.tradeExecuteBtn.textContent = `Bank ${rateText}`;
    }
    // Player trade: any non-zero offer and request
    if (this.tradeProposalBtn) {
      this.tradeProposalBtn.disabled = !(offerTotal > 0 && requestTotal > 0);
    }
  }

  handleHumanPlayerTrade() {
    const player = this.currentPlayer;
    if (!player || !player.isHuman || this.phase !== "main") return;
    const offer = this.tradeOffer;
    const request = this.tradeRequest;
    if (sumResources(offer) === 0 || sumResources(request) === 0) {
      if (this.tradeProposalResult) this.tradeProposalResult.textContent = "Select resources to give and get.";
      return;
    }
    // Check player can afford offer
    for (const r of RESOURCES) {
      if (player.resources[r] < offer[r]) {
        if (this.tradeProposalResult) this.tradeProposalResult.textContent = `Not enough ${r}.`;
        return;
      }
    }
    // Propose to all players — collect responses, show each one
    const responses = [];
    let acceptor = null;
    for (const other of this.players) {
      if (other.id === player.id) continue;
      if (other.isHuman) continue; // TODO: multi-human support
      const accepts = this.aiEvaluateTrade(other, request, offer);
      responses.push({ player: other, accepts });
      if (accepts && !acceptor) acceptor = other;
    }

    // Show visual response for each player
    if (this.tradeProposalResult) {
      this.tradeProposalResult.innerHTML = responses.map(r =>
        `<span style="color:${r.player.color};font-weight:800">${r.player.name}</span> ${r.accepts ? '<span style="color:#22a854">✓ Accept</span>' : '<span style="color:#c44">✗ Reject</span>'}`
      ).join("&nbsp;&nbsp;");
    }

    if (acceptor) {
      RESOURCES.forEach((r) => {
        player.resources[r] -= offer[r];
        player.resources[r] += request[r];
        acceptor.resources[r] -= request[r];
        acceptor.resources[r] += offer[r];
      });
      this.addLog(`${acceptor.name} accepted trade: gave ${resourceString(request)} for ${resourceString(offer)}.`);
      if (this.tradeProposalResult) {
        this.tradeProposalResult.innerHTML += `<br><strong style="color:#22a854">Traded with ${acceptor.name}!</strong>`;
        this.sfx.trade();
      }
      this.tradeOffer = makeEmptyResources();
      this.tradeRequest = makeEmptyResources();
      this.buildTradeGrids();
      this.updateTradeButtons();
      this.render();
    } else {
      this.addLog("All players rejected your trade offer.");
      // Try to generate a counter-offer from AI
      const counter = this._generateCounterOffer(player, offer, request);
      if (counter && this.tradeProposalResult) {
        const cGive = resourceString(counter.give);
        const cWant = resourceString(counter.want);
        this.tradeProposalResult.innerHTML += `<br><span style="color:${counter.player.color};font-weight:700">${counter.player.name}</span>: I'll give ${cGive} for ${cWant}`;
        // Add accept button for counter-offer
        const acceptBtn = document.createElement("button");
        acceptBtn.className = "btn-build";
        acceptBtn.style.cssText = "font-size:0.65rem;padding:0.2rem 0.5rem;margin-left:0.3rem";
        acceptBtn.textContent = "Accept";
        acceptBtn.addEventListener("click", () => {
          // Execute the counter-offer trade
          const human = this.players.find(p => p.isHuman);
          // Check human can afford
          for (const r of RESOURCES) {
            if (human.resources[r] < counter.want[r]) {
              this.tradeProposalResult.innerHTML = '<span style="color:#c44">Not enough resources!</span>';
              return;
            }
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
          this.tradeProposalResult.innerHTML = `<strong style="color:#22a854">Traded with ${counter.player.name}!</strong>`;
          this.render();
        });
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
    const maxVP = Math.max(...this.players.filter(p => p.id !== aiPlayer.id).map(p => p.victoryPoints));
    if (awareness === "basic" && maxVP >= 8) return false;
    if (awareness === "advanced" && maxVP >= 7) return false;

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
      const newNeeds = aiNeeds.filter(r => !offeredRes.includes(r));
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

        if (other.isHuman) {
          // Show incoming trade popup to human — handled async
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
    let html = '<div class="incoming-trade-cards">';
    RESOURCES.forEach(r => {
      if (resources[r] > 0) {
        for (let i = 0; i < resources[r]; i++) {
          html += `<div class="incoming-trade-card ${r}"><img src="${RESOURCE_ICON_PATH[r]}" alt="${r}" /></div>`;
        }
      }
    });
    html += '</div>';
    return html;
  }

  showIncomingTrade(fromPlayer, give, want) {
    return new Promise((resolve) => {
      if (!this.incomingTradePanel) { resolve(false); return; }
      // Render header with avatar
      this.incomingTradeHeader.innerHTML = `<img src="${fromPlayer.avatar}" alt="" /><span style="color:${fromPlayer.color}">${fromPlayer.name}</span> wants to trade`;
      // Render body with visual cards
      this.incomingTradeBody.innerHTML = `
        <div class="incoming-trade-row">
          <span class="incoming-trade-row-label">You get:</span>
          ${this._renderTradeCards(give)}
        </div>
        <div class="incoming-trade-arrow"><div class="incoming-trade-arrow-icon">&#8645;</div></div>
        <div class="incoming-trade-row">
          <span class="incoming-trade-row-label">You give:</span>
          ${this._renderTradeCards(want)}
        </div>
      `;
      this.pendingIncomingTrade = { fromPlayer, give, want, resolve };
      this.incomingTradePanel.style.display = "";
    });
  }

  resolveIncomingTrade(accepted) {
    if (!this.pendingIncomingTrade) return;
    const { fromPlayer, give, want, resolve } = this.pendingIncomingTrade;
    const human = this.players.find(p => p.isHuman);
    if (accepted && human) {
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
    if (node.neighbors.some((neighborId) => this.geometry.nodes[neighborId].structure != null)) return false;
    if (setup) return true;
    if (!hasResources(player.resources, COSTS.settlement)) return false;
    return node.edgeIds.some((edgeId) => this.geometry.edges[edgeId].owner === player.id);
  }

  canBuildCity(player, nodeId, free = false) {
    const node = this.geometry.nodes[nodeId];
    if (!node || node.owner !== player.id || node.structure !== "settlement") return false;
    if (!free && !hasResources(player.resources, COSTS.city)) return false;
    return true;
  }

  placeRoad(player, edgeId, options = {}) {
    if (!this.canBuildRoad(player, edgeId, options)) return false;
    this.geometry.edges[edgeId].owner = player.id;
    player.roads.add(edgeId);
    return true;
  }

  placeSettlement(player, nodeId, setup = false) {
    if (!this.canBuildSettlement(player, nodeId, setup)) return false;
    const node = this.geometry.nodes[nodeId];
    node.owner = player.id;
    node.structure = "settlement";
    player.settlements.add(nodeId);
    return true;
  }

  placeCity(player, nodeId, free = false) {
    if (!this.canBuildCity(player, nodeId, free)) return false;
    const node = this.geometry.nodes[nodeId];
    node.structure = "city";
    player.settlements.delete(nodeId);
    player.cities.add(nodeId);
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
    if (player.resources[give] < rate) return false;
    player.resources[give] -= rate;
    player.resources[get] += 1;
    this.addLog(`${player.name} traded ${rate} ${give} for 1 ${get}.`);
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
    payCost(player.resources, COSTS.development);
    const card = this.devDeck.pop();
    if (card === "victoryPoint") {
      player.devVictoryPoints += 1;
      this.addLog(`${player.name} bought a hidden Victory Point.`);
    } else {
      player.newDevCards[card] += 1;
      this.addLog(`${player.name} bought a ${card} card.`);
    }
    return true;
  }

  canPlayDevelopmentCard(player, type) {
    if (this.phase !== "main" || this.currentTurnPlayedDevCard || this.winner) return false;
    return player.devCards[type] > 0;
  }

  playDevelopmentCard(player, type) {
    if (!this.canPlayDevelopmentCard(player, type)) return false;
    player.devCards[type] -= 1;
    this.currentTurnPlayedDevCard = true;

    if (type === "knight") {
      player.knightsPlayed += 1;
      this.resolveRobber(player, "playing Knight");
      this.addLog(`${player.name} played Knight.`);
    } else if (type === "roadBuilding") {
      let built = 0;
      for (let i = 0; i < 2; i += 1) {
        const edgeId = this.chooseStrategicRoadEdge(player, true);
        if (edgeId == null) break;
        if (this.placeRoad(player, edgeId, { free: true })) built += 1;
      }
      this.addLog(`${player.name} played Road Building and placed ${built} road(s).`);
    } else if (type === "yearOfPlenty") {
      const picks = this.chooseYearOfPlentyResources(player);
      picks.forEach((resource) => {
        player.resources[resource] += 1;
      });
      this.addLog(`${player.name} played Year of Plenty and gained ${picks.join(" + ")}.`);
    } else if (type === "monopoly") {
      const target = this.chooseBestMonopolyResource(player);
      let collected = 0;
      this.players.forEach((other) => {
        if (other.id === player.id) return;
        collected += other.resources[target];
        other.resources[target] = 0;
      });
      player.resources[target] += collected;
      this.addLog(`${player.name} played Monopoly on ${target} and collected ${collected}.`);
    }

    this.recomputeScores();
    return true;
  }

  chooseYearOfPlentyResources(player) {
    const goals = [COSTS.city, COSTS.settlement, COSTS.development, COSTS.road];
    for (const goal of goals) {
      const deficits = RESOURCES.flatMap((resource) => {
        const need = Math.max(0, (goal[resource] || 0) - player.resources[resource]);
        return Array(need).fill(resource);
      });
      if (deficits.length) {
        if (deficits.length === 1) return [deficits[0], deficits[0]];
        return [deficits[0], deficits[1]];
      }
    }
    return ["wheat", "ore"];
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
    if (this.winner) return;
    const player = this.currentPlayer;
    if (this.phase === "pre_roll") {
      // Show dice animation for AI players too
      if (!player.isHuman && !this._aiDiceAnimating) {
        this._aiDiceAnimating = true;
        this.animateDiceRoll(() => {
          this._aiDiceAnimating = false;
          this.executeRollPhase(player);
          this.render();
          // Delay before AI actions so card-deal animation plays out
          const actionDelay = this.lastRoll !== 7 ? 800 : 200;
          setTimeout(() => {
            if (this.phase === "main") {
              const result = this.executeAiMainPhase(player);
              if (result === "async") return;
              this.endTurn();
            }
            this.saveToStorage();
            this.render();
            if (!this.winner && !this.autoplayInterval && !this.currentPlayer.isHuman) {
              this.scheduleAiTurnsUntilHuman();
            }
          }, actionDelay);
        }, player);
        return; // Wait for animation
      }
      this.executeRollPhase(player);
    }
    if (this.phase === "main") {
      const result = this.executeAiMainPhase(player);
      if (result === "async") return; // Will resume after human responds to trade
      this.endTurn();
    }
  }

  executeAiMainPhase(player, skipPlayerTrade = false) {
    if (!this.winner) {
      this.maybePlayBestDevCard(player);
    }

    // Try player-to-player trade once per turn
    if (!skipPlayerTrade) {
      const tradeResult = this.aiTryPlayerTrade(player);
      if (tradeResult && tradeResult.type === "human") {
        // Need async human response — pause AI turn, show popup
        this._pendingAiTradePlayer = player;
        this.showIncomingTrade(tradeResult.fromPlayer, tradeResult.give, tradeResult.want).then(() => {
          // Resume AI turn after human responds
          this.executeAiMainPhase(player, true);
          this.endTurn();
          this.render();
          if (!this.winner && !this.currentPlayer.isHuman) {
            this.scheduleAiTurnsUntilHuman();
          }
        });
        return "async";
      }
    }

    const actionFns = this._getActionPriority(player);
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

  _getActionPriority(player) {
    const s = player.strategy || {};
    const settlement = () => this.tryBuildSettlement(player);
    const city = () => this.tryBuildCity(player);
    const road = () => this.tryBuildRoad(player);
    const dev = () => s.devCards !== "none" && this.buyDevelopmentCard(player);
    const trade = () => this.tryTradeForGoal(player);

    // Robber on own hex: prioritize dev cards to get a knight
    const robberOnSelf = this.geometry.hexes[this.robberHexId].nodes.some(nid =>
      this.geometry.nodes[nid].owner === player.id
    );
    if (robberOnSelf && player.devCards.knight === 0 && s.devCards !== "none") {
      return [dev, settlement, city, trade, road];
    }

    // Advanced awareness at 8+ VP: prioritize points
    if (s.awareness === "advanced" && player.victoryPoints >= 8) {
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
    if (this.currentTurnPlayedDevCard || this.phase !== "main") return false;

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

    // Strategic: chase largest army proactively
    if (strat === "strategic") {
      const armyHolder = this.largestArmyHolder;
      const holderKnights = armyHolder != null ? this.players[armyHolder].knightsPlayed : 2;
      // If we're within 1 knight of claiming/keeping army, play it
      if (player.knightsPlayed >= holderKnights - 1 && armyHolder !== player.id) return true;
      // Already hold army and robber isn't hurting us — save the knight
      if (armyHolder === player.id && !badRobber) return false;
    }

    const target = this.chooseRobberHex(player);
    return target !== this.robberHexId;
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
    payCost(player.resources, COSTS.settlement);
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
    payCost(player.resources, COSTS.city);
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
    payCost(player.resources, COSTS.road);
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
      const incomes = this.getResourceIncomeProfile(player);
      const donors = RESOURCES.map((resource) => ({
        resource,
        rate: this.getPlayerTradeRate(player, resource),
        surplus: player.resources[resource] - (goal[resource] || 0),
        income: incomes[resource],
      }))
        .filter((entry) => {
          // Conservative: need extra buffer beyond rate
          if (strat === "conservative") return entry.surplus >= entry.rate + 1;
          // Aggressive: trade even at exactly the rate
          if (strat === "aggressive") return player.resources[entry.resource] >= entry.rate;
          // Balanced (default): surplus must cover rate
          return entry.surplus >= entry.rate;
        })
        .sort((a, b) => b.surplus - a.surplus || b.income - a.income);
      if (!donors.length) continue;
      this.performBankTrade(player, donors[0].resource, wanted);
      // Aggressive: try multiple trades per goal
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
      const score = this.getNodeProductionScore(other, player);
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
    });
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
    if (player.victoryPoints >= WINNING_POINTS) {
      this.winner = player;
      this.phase = "game_over";
      this.addLog(`${player.name} wins with ${player.victoryPoints} VP!`);
      this.stopAutoplay();
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
    this.currentTurnPlayedDevCard = false;
    this.lastRoll = null;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    if (this.currentPlayerIndex === 0) this.turn += 1;
    this.phase = "pre_roll";

    if (this.turn > TURN_LIMIT && !this.winner) {
      const leader = this.players.reduce((best, current) =>
        current.victoryPoints > best.victoryPoints ? current : best,
      );
      this.winner = leader;
      this.phase = "game_over";
      this.addLog(`Turn limit reached. ${leader.name} wins by points.`);
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
    this.autoplayInterval = window.setInterval(() => {
      this.autoPlayCurrentTurn();
      this.render();
    }, delay);
    this.autoplayBtn.textContent = "Stop Autoplay";
  }

  stopAutoplay() {
    if (!this.autoplayInterval) return;
    window.clearInterval(this.autoplayInterval);
    this.autoplayInterval = null;
    this.autoplayBtn.textContent = "Start Autoplay";
  }

  stopAiTurnLoop() {
    if (!this.aiTurnTimeout) return;
    window.clearTimeout(this.aiTurnTimeout);
    this.aiTurnTimeout = null;
  }

  scheduleAiTurnsUntilHuman() {
    if (this.winner || this.autoplayInterval) return;
    if (this.currentPlayer.isHuman) return;
    if (this.aiTurnTimeout) return;

    const cadence = Math.max(400, Math.min(1200, Math.round(Number(this.speedRange.value) * 0.6)));
    const step = () => {
      this.aiTurnTimeout = null;
      if (this.winner || this.autoplayInterval || this.currentPlayer.isHuman || this._aiDiceAnimating) {
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
    };
    this.aiTurnTimeout = window.setTimeout(step, 500);
  }

  // ── Game-over overlay & restart ──────────────────────────────────────
  showGameOverOverlay() {
    if (document.querySelector(".game-over-overlay")) return;
    this.sfx.victory();
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay";
    const winner = this.winner;
    overlay.innerHTML = `
      <div class="game-over-card">
        <img class="game-over-avatar" src="${winner.avatar}" alt="${winner.name}" />
        <h2 style="color:${winner.color}">${winner.name} wins!</h2>
        <p>${winner.victoryPoints} Victory Points &middot; Turn ${this.turn}</p>
        <div class="game-over-stats">
          ${this.players.map(p => `<span style="color:${p.color}">${p.name}: ${p.victoryPoints} VP</span>`).join("")}
        </div>
        <button class="game-over-btn" id="newGameBtn">New Game</button>
      </div>
    `;
    document.querySelector(".board-panel").appendChild(overlay);
    overlay.querySelector("#newGameBtn").addEventListener("click", () => {
      overlay.remove();
      this.stopAutoplay();
      this.resetGame();
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
      })),
      devDeck: [...this.devDeck],
      turn: this.turn,
      currentPlayerIndex: this.currentPlayerIndex,
      phase: this.phase,
      lastRoll: this.lastRoll,
      winnerId: this.winner ? this.winner.id : null,
      pendingAction: this.pendingAction,
      robberContext: this.robberContext,
      currentTurnPlayedDevCard: this.currentTurnPlayedDevCard,
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
    this.players = PLAYER_CONFIG.map((config, id) => {
      const saved = data.players[id];
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
        strategy: config.isHuman ? null : (saved.strategy ? { ...saved.strategy } : { ...DEFAULT_AI_STRATEGY }),
      };
    });

    this.devDeck = data.devDeck || [];
    this.turn = data.turn;
    this.currentPlayerIndex = data.currentPlayerIndex;
    this.phase = data.phase;
    this.lastRoll = data.lastRoll;
    this.winner = data.winnerId != null ? this.players[data.winnerId] : null;
    this.pendingAction = data.pendingAction;
    this.robberContext = data.robberContext || null;
    this.robberVictimOptions = [];
    this.currentTurnPlayedDevCard = data.currentTurnPlayedDevCard;
    this.longestRoadHolder = data.longestRoadHolder;
    this.largestArmyHolder = data.largestArmyHolder;
    this.logEntries = data.logEntries || [];
    this.setupPhase = data.setupPhase || false;
    this.setupQueue = data.setupQueue || [0, 1, 2, 3, 3, 2, 1, 0];
    this.setupStep = data.setupStep || 0;
    this.setupAction = data.setupAction || null;
    this.lastSetupNodeId = data.lastSetupNodeId ?? null;

    this.view = { offsetX: 0, offsetY: 0, scale: 1 };
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
    } else if (!this.currentPlayer.isHuman) {
      this.scheduleAiTurnsUntilHuman();
    }
    return true;
  }

  drawBoardBackdrop() {
    const ctx = this.ctx;
    const w = this.boardWidth;
    const h = this.boardHeight;
    const t = this.animTime || 0;

    const ocean = ctx.createRadialGradient(w * 0.47, h * 0.48, 50, w * 0.47, h * 0.48, w * 0.62);
    ocean.addColorStop(0, "#4db8e8");
    ocean.addColorStop(0.5, "#2d95c9");
    ocean.addColorStop(1, "#1a6fa0");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const yBase = h * 0.05 + i * (h / 16);
      const phase = t * 0.5 + i * 0.7;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = yBase + Math.sin(x / 80 + phase) * 3 + Math.sin(x / 40 + phase * 1.3) * 1.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawHexPath(corners) {
    const ctx = this.ctx;
    ctx.beginPath();
    corners.forEach((corner, idx) => {
      if (idx === 0) ctx.moveTo(corner.x, corner.y);
      else ctx.lineTo(corner.x, corner.y);
    });
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
      wood: "#3d8a3d",
      brick: "#cf7448",
      sheep: "#8dd44a",
      wheat: "#e8c457",
      ore: "#9ea9b8",
      desert: "#e2cb8d",
    };
    this.drawHexPath(hex.corners);
    ctx.save();
    ctx.shadowColor = "rgba(38, 73, 106, 0.32)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = tileStyle[hex.resource] || RESOURCE_COLORS[hex.resource];
    ctx.fill();
    ctx.restore();

    const hxs = this.geometry.hexSize;
    const sc = hxs / 74;
    this.drawHexPath(hex.corners);
    const surface = ctx.createLinearGradient(hex.center.x - 38 * sc, hex.center.y - 38 * sc, hex.center.x + 38 * sc, hex.center.y + 38 * sc);
    surface.addColorStop(0, "rgba(255,255,255,0.27)");
    surface.addColorStop(0.45, "rgba(255,255,255,0)");
    surface.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = surface;
    ctx.fill();

    ctx.save();
    this.drawHexPath(hex.corners);
    ctx.clip();
    for (let i = 0; i < 6; i += 1) {
      const sx = hex.center.x + Math.sin(hex.id * 7.3 + i * 1.9) * 30 * sc;
      const sy = hex.center.y + Math.cos(hex.id * 5.2 + i * 2.2) * 28 * sc;
      const radius = (8 + ((hex.id + i) % 5)) * sc;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
      ctx.fill();
    }
    ctx.restore();

    this.drawHexPath(hex.corners);
    ctx.strokeStyle = "rgba(195, 165, 100, 0.75)";
    ctx.lineWidth = 3 * sc;
    ctx.stroke();

    // Tile artwork layer: show clear resource iconography on the board itself.
    this.drawTileArtwork(hex);

    if (hex.number != null) {
      const tokenR = hxs * 0.27;
      ctx.save();
      ctx.shadowColor = "rgba(58, 78, 101, 0.35)";
      ctx.shadowBlur = 6 * sc;
      ctx.shadowOffsetY = 2 * sc;
      ctx.beginPath();
      ctx.arc(hex.center.x, hex.center.y, tokenR, 0, Math.PI * 2);
      const token = ctx.createRadialGradient(hex.center.x - 6 * sc, hex.center.y - 7 * sc, 2 * sc, hex.center.x, hex.center.y, tokenR + 2 * sc);
      token.addColorStop(0, "rgba(255,252,245,0.98)");
      token.addColorStop(1, "rgba(214,210,199,0.95)");
      ctx.fillStyle = token;
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(hex.center.x, hex.center.y, tokenR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(27, 35, 48, 0.36)";
      ctx.lineWidth = 1.5 * sc;
      ctx.stroke();

      ctx.fillStyle = hex.number === 6 || hex.number === 8 ? "#be1a1a" : "#18212c";
      ctx.font = `bold ${Math.round(hxs * 0.23)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(hex.number), hex.center.x, hex.center.y - 2 * sc);
      this.drawTokenPips(hex);
    }

    ctx.fillStyle = "rgba(239, 248, 255, 0.72)";
    ctx.font = `700 ${Math.round(hxs * 0.135)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = hex.resource === "desert" ? "Desert" : RESOURCE_LABEL[hex.resource];
    ctx.fillStyle = "rgba(20, 52, 86, 0.65)";
    ctx.font = `600 ${Math.round(hxs * 0.12)}px Inter, system-ui, sans-serif`;
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
    this.drawHexPath(hex.corners);
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
      wood: "#3d9e50", brick: "#c66536", sheep: "#6db84e",
      wheat: "#d4a825", ore: "#7a8da9", any: "#4a7eb5",
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

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3 * s;
      ctx.setLineDash([4 * s, 3 * s]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(dockX, dockY);
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(dockX, dockY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 5 * s;
      ctx.shadowOffsetY = 2 * s;
      const label = port.type === "any" ? "3:1" : `2:1 ${RESOURCE_LABEL[port.type]}`;
      const portFontSize = Math.round(10 * s);
      ctx.font = `700 ${portFontSize}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const boxW = Math.max(38 * s, tw + 14 * s);
      const boxH = 22 * s;
      const bx = dockX - boxW / 2;
      const by = dockY - boxH / 2;

      this.drawRoundedRect(bx, by, boxW, boxH, 6 * s);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${portFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, dockX, dockY + 0.5);
      ctx.restore();

      ctx.save();
      const shipY = dockY - boxH / 2 - 8 * s;
      ctx.font = `${Math.round(12 * s)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚓", dockX, shipY);
      ctx.restore();
    });
  }

  drawNodeDots() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const human = this.players.find(p => p.isHuman);
    const showBuildable = human && this.phase === "main" && this.currentPlayer.isHuman && !this.pendingAction;
    const canSettlement = showBuildable && hasResources(human.resources, COSTS.settlement);
    const canCity = showBuildable && hasResources(human.resources, COSTS.city);

    this.geometry.nodes.forEach((node) => {
      if (node.owner != null) {
        // Highlight cities you can upgrade
        if (canCity && node.owner === human.id && node.structure === "settlement") {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 10 * s, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(25, 160, 184, 0.15)";
          ctx.fill();
          ctx.strokeStyle = "rgba(25, 160, 184, 0.5)";
          ctx.lineWidth = 1.5 * s;
          ctx.setLineDash([3 * s, 2 * s]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        return;
      }
      // Highlight buildable settlement spots
      if (canSettlement && this.canBuildSettlement(human, node.id, false)) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 7 * s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(25, 160, 184, 0.2)";
        ctx.fill();
        ctx.strokeStyle = "rgba(25, 160, 184, 0.6)";
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4.5 * s, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(205, 175, 110, 0.6)";
        ctx.fill();
        ctx.strokeStyle = "rgba(160, 120, 50, 0.4)";
        ctx.lineWidth = 1 * s;
        ctx.stroke();
      }
    });
  }

  drawRoads() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    ctx.lineCap = "round";
    this.geometry.edges.forEach((edge) => {
      const [a, b] = edge.nodes;
      const p1 = this.geometry.nodes[a];
      const p2 = this.geometry.nodes[b];

      if (edge.owner == null) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = "rgba(228, 240, 255, 0.16)";
        ctx.lineWidth = 2 * s;
        ctx.setLineDash([5 * s, 4 * s]);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = "rgba(13, 17, 25, 0.62)";
      ctx.lineWidth = 9.3 * s;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = this.players[edge.owner].color;
      ctx.lineWidth = 6.6 * s;
      ctx.stroke();

      const highlight = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      highlight.addColorStop(0, "rgba(255,255,255,0.33)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = highlight;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    });

  }

  drawStructures() {
    const ctx = this.ctx;
    const s = this.geometry.hexSize / 74;
    const structScale = 1.2; // 20% bigger structures

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
    this.geometry.hexes.forEach((hex) => {
      if (hex.id === this.robberHexId) {
        // Current robber location — blocked
        this.drawHexPath(hex.corners);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fill();
      } else {
        // Valid target — subtle red pulse border
        this.drawHexPath(hex.corners);
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
      this.drawHexPath(hex.corners);
      ctx.strokeStyle = `rgba(255, 220, 40, ${alpha * (0.6 + pulse * 0.4)})`;
      ctx.lineWidth = 4 * s;
      ctx.stroke();
      // Bright fill
      this.drawHexPath(hex.corners);
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
      if (elapsed > 600) return false;

      const t = elapsed / 600; // 0..1
      // Bounce ease: overshoot then settle
      const scale = t < 0.4 ? (t / 0.4) * 1.4 : 1.4 - (t - 0.4) / 0.6 * 0.4;
      const alpha = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;

      ctx.save();
      ctx.translate(anim.x, anim.y);
      ctx.globalAlpha = alpha * 0.7;

      // Expanding ring
      const ringR = 15 * s * scale;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = anim.type === "road" ? "rgba(39, 201, 255, 0.8)" : "rgba(255, 220, 40, 0.8)";
      ctx.lineWidth = 3 * s;
      ctx.stroke();

      // Inner flash
      if (t < 0.3) {
        ctx.beginPath();
        ctx.arc(0, 0, ringR * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fill();
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
      this.drawHexPath(hex.corners);
      ctx.strokeStyle = isRobberMode ? "rgba(220, 50, 50, 0.85)" : "rgba(35, 132, 204, 0.75)";
      ctx.lineWidth = 3 * s;
      ctx.stroke();
      this.drawHexPath(hex.corners);
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
    if (!human) return;

    // Bottom bar summary cards (desktop)
    if (this.resourceCardStrip) {
      const total = sumResources(human.resources);
      this.resourceCardStrip.innerHTML = RESOURCES.map(
        (resource) =>
          `<div class="resource-card ${resource}" aria-label="${resource} ${human.resources[resource]}">
            <img src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />
            <span class="resource-count">${human.resources[resource]}</span>
          </div>`,
      ).join("") + `<div class="resource-total" title="Total cards">${total}</div>`;
    }

    // Hand strip — individual overlapping cards (bottom, above action bar on mobile)
    if (this.handStrip) {
      const cards = [];
      RESOURCES.forEach((resource) => {
        for (let i = 0; i < human.resources[resource]; i++) {
          cards.push(resource);
        }
      });
      if (cards.length === 0) {
        this.handStrip.innerHTML = '<span class="hand-empty">No cards</span>';
      } else {
        this.handStrip.innerHTML = cards.map((resource, i) =>
          `<div class="hand-card ${resource}">
            <img src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />
          </div>`
        ).join("");
      }
    }

    // Bank strip — stock counts at top of screen on mobile
    if (this.bankStrip) {
      const totalInPlay = {};
      RESOURCES.forEach(r => {
        totalInPlay[r] = this.players.reduce((sum, p) => sum + p.resources[r], 0);
      });
      // Standard Catan: 19 of each resource in the bank
      this.bankStrip.innerHTML = RESOURCES.map(resource => {
        const bankCount = 19 - totalInPlay[resource];
        return `<div class="bank-item">
          <img src="${RESOURCE_ICON_PATH[resource]}" alt="${resource}" />
          <span>${bankCount}</span>
        </div>`;
      }).join("");
    }
  }

  renderScoreboard() {
    this.scoreboard.innerHTML = "";
    this.players.forEach((player, idx) => {
      const card = document.createElement("div");
      card.className = "player-card player-card-mini";
      if (idx === this.currentPlayerIndex && !this.winner) card.classList.add("active");

      const totalCards = sumResources(player.resources);
      const totalDev = DEV_CARD_TYPES.reduce((sum, t) => sum + player.devCards[t] + player.newDevCards[t], 0) + player.devVictoryPoints;
      const hasLR = this.longestRoadHolder === player.id;
      const hasLA = this.largestArmyHolder === player.id;
      const awards = (hasLR ? '<span class="award-badge longest-road" title="Longest Road (+2 VP)">LR</span>' : '')
        + (hasLA ? '<span class="award-badge largest-army" title="Largest Army (+2 VP)">LA</span>' : '');
      card.innerHTML = `
        <img class="player-avatar" src="${player.avatar}" alt="${player.name} avatar" />
        <span class="player-name" style="color:${player.color}">${player.name}</span>
        <span class="player-header-right">
          <span class="player-vp" title="Hover for VP breakdown">${player.victoryPoints} VP</span>
          ${awards}
          <span class="player-hand-counts">
            <span class="hand-count" title="${totalCards} resource cards"><span class="stat-icon card-icon"></span>${totalCards}</span>
            <span class="hand-count" title="${totalDev} dev cards"><span class="stat-icon dev-icon"></span>${totalDev}</span>
          </span>
        </span>
      `;
      // VP tooltip on hover
      const vpEl = card.querySelector(".player-vp");
      if (vpEl) {
        vpEl.style.cursor = "help";
        vpEl.addEventListener("mouseenter", () => this._showVPTooltip(player, vpEl));
        vpEl.addEventListener("mouseleave", () => this._hideVPTooltip());
      }
      this.scoreboard.appendChild(card);
    });
  }

  renderTopPanels() {
    const left = this.players[0];
    let right = this.currentPlayer;
    if (right.id === left.id) {
      right = this.players.find((player) => player.id !== left.id) || right;
    }

    const renderMini = (player, container) => {
      if (!container || !player) return;
      container.innerHTML = `
        <img class="mini-player-avatar" src="${player.avatar}" alt="${player.name} avatar" />
        <span class="mini-player-name" style="color:${player.color}">${player.name}</span>
        <span>${player.victoryPoints} VP</span>
      `;
    };

    renderMini(left, this.leftPlayerPanel);
    renderMini(right, this.rightPlayerPanel);
  }

  _enrichLogText(text) {
    // Replace resource names with inline icons
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    RESOURCES.forEach(r => {
      const regex = new RegExp(`\\b(\\d+)\\s+${RESOURCE_LABEL[r]}\\b`, "gi");
      html = html.replace(regex, `$1 <img class="log-res-icon" src="${RESOURCE_ICON_PATH[r]}" alt="${r}" />`);
    });
    // Color player names
    this.players.forEach(p => {
      html = html.replace(new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g"),
        `<span style="color:${p.color};font-weight:700">${p.name}</span>`);
    });
    return html;
  }

  renderLog() {
    this.logContainer.innerHTML = "";
    this.logEntries.slice(-20).forEach((entry) => {
      const text = typeof entry === "string" ? entry : entry.text;
      const line = document.createElement("div");
      line.className = "log-entry";
      if (text.includes("wins")) line.classList.add("winner");
      line.innerHTML = this._enrichLogText(text);
      this.logContainer.appendChild(line);
    });
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  renderStatusAndControls() {
    const humanTurn = this.currentPlayer.isHuman && !this.winner;
    const mainPhase = this.phase === "main";
    const preRoll = this.phase === "pre_roll";
    const noDevPlayed = !this.currentTurnPlayedDevCard;
    const human = this.currentPlayer;
    const active = this.currentPlayer;
    const hasRoadCost = hasResources(human.resources, COSTS.road);
    const hasSettlementCost = hasResources(human.resources, COSTS.settlement);
    const hasCityCost = hasResources(human.resources, COSTS.city);
    const hasDevCost = hasResources(human.resources, COSTS.development);
    const canTradeBank = RESOURCES.some((resource) => human.resources[resource] >= this.getPlayerTradeRate(human, resource));
    const roadMissing = missingCostString(human.resources, COSTS.road);
    const settlementMissing = missingCostString(human.resources, COSTS.settlement);
    const cityMissing = missingCostString(human.resources, COSTS.city);
    const devMissing = missingCostString(human.resources, COSTS.development);

    const setButtonState = (button, enabled, disabledHint, enabledHint = "") => {
      if (!button) return;
      button.disabled = !enabled;
      button.title = enabled ? enabledHint : disabledHint;
    };

    if (this.actionPromptAvatar) this.actionPromptAvatar.src = active.avatar;
    if (this.actionPromptText) {
      if (this.setupPhase && this.setupAction) {
        if (this.confirmBuild) {
          this.actionPromptText.textContent = `Setup · Tap ✓ to confirm`;
        } else {
          const action = this.setupAction === "settlement" ? "Place settlement" : "Place road";
          this.actionPromptText.textContent = `Setup · ${action}`;
        }
      } else if (this.winner) {
        this.actionPromptText.textContent = `${this.winner.name} wins!`;
      } else if (humanTurn && preRoll) {
        this.actionPromptText.textContent = "Roll dice";
      } else if (humanTurn && mainPhase) {
        if (this.pendingAction === "robber") {
          this.actionPromptText.textContent = "Move the robber — tap a hex";
        } else if (this.pendingAction) {
          if (this.confirmBuild) {
            this.actionPromptText.textContent = `Tap ✓ to confirm ${this.pendingAction}`;
          } else {
            this.actionPromptText.textContent = `Place ${this.pendingAction}`;
          }
        } else {
          this.actionPromptText.textContent = `Turn ${this.turn} · ${active.name}`;
        }
      } else {
        this.actionPromptText.textContent = `${active.name} · Turn ${this.turn}`;
      }
    }

    const rollBtn = this.rollDiceBtn;
    const endBtn = this.endTurnBtn;
    const buildPanel = this.actionPromptBuild;
    const inSetup = this.setupPhase;
    if (rollBtn) {
      rollBtn.style.display = !inSetup && humanTurn && preRoll ? "inline-flex" : "none";
      rollBtn.disabled = inSetup || !(humanTurn && preRoll);
    }
    const inRobberMode = this.pendingAction === "robber";
    if (endBtn) {
      endBtn.style.display = !inSetup && humanTurn && mainPhase && !this.pendingAction ? "inline-flex" : "none";
      endBtn.disabled = inSetup || !(humanTurn && mainPhase);
    }
    if (buildPanel) {
      buildPanel.style.display = !inSetup && humanTurn && mainPhase && !inRobberMode ? "flex" : "none";
    }

    // Hide trade panel when not in main phase or during robber
    if (inRobberMode || !humanTurn || !mainPhase) {
      this.hideTradePanel();
    }

    this.nextTurnBtn.disabled = !!this.winner || humanTurn || this.autoplayInterval != null;
    setButtonState(
      this.buildRoadBtn,
      humanTurn && mainPhase && hasRoadCost,
      roadMissing ? `Need ${roadMissing}` : "Not available",
      "Build road (1)",
    );
    setButtonState(
      this.buildSettlementBtn,
      humanTurn && mainPhase && hasSettlementCost,
      settlementMissing ? `Need ${settlementMissing}` : "Not available",
      "Build settlement (2)",
    );
    setButtonState(
      this.buildCityBtn,
      humanTurn && mainPhase && hasCityCost,
      cityMissing ? `Need ${cityMissing}` : "Not available",
      "Build city (3)",
    );
    setButtonState(
      this.buyDevBtn,
      humanTurn && mainPhase && hasDevCost && this.devDeck.length > 0,
      this.devDeck.length <= 0 ? "Deck empty" : devMissing ? `Need ${devMissing}` : "Not available",
      "Buy dev card (B)",
    );
    // Trade button: only visible during human main phase, not during setup
    if (this.tradeBankBtn) {
      const showTrade = !inSetup && humanTurn && mainPhase && !inRobberMode;
      this.tradeBankBtn.style.display = showTrade ? "inline-flex" : "none";
      this.tradeBankBtn.disabled = !showTrade;
      this.tradeBankBtn.title = "Trade (T)";
    }

    this.playKnightBtn.disabled = !(humanTurn && mainPhase && noDevPlayed && human.devCards.knight > 0);
    this.playRoadBuildingBtn.disabled = !(humanTurn && mainPhase && noDevPlayed && human.devCards.roadBuilding > 0);
    this.playYearOfPlentyBtn.disabled = !(humanTurn && mainPhase && noDevPlayed && human.devCards.yearOfPlenty > 0);
    this.playMonopolyBtn.disabled = !(humanTurn && mainPhase && noDevPlayed && human.devCards.monopoly > 0);

    [this.buildRoadBtn, this.buildSettlementBtn, this.buildCityBtn].forEach((btn) =>
      btn?.classList.remove("selected-action"),
    );
    if (this.pendingAction === "road") this.buildRoadBtn?.classList.add("selected-action");
    if (this.pendingAction === "settlement") this.buildSettlementBtn?.classList.add("selected-action");
    if (this.pendingAction === "city") this.buildCityBtn?.classList.add("selected-action");

    [rollBtn, endBtn, this.buildRoadBtn, this.buildSettlementBtn, this.buildCityBtn].forEach(
      (btn) => btn?.classList.remove("attention"),
    );
    if (humanTurn && preRoll && rollBtn) rollBtn.classList.add("attention");
    else if (humanTurn && mainPhase) {
      if (this.pendingAction === "road") this.buildRoadBtn?.classList.add("attention");
      else if (this.pendingAction === "settlement") this.buildSettlementBtn?.classList.add("attention");
      else if (this.pendingAction === "city") this.buildCityBtn?.classList.add("attention");
      else if (endBtn) endBtn.classList.add("attention");
    }
  }

  // ── Persistent Dice Display ──────────────────────────────────────────
  renderLastDice() {
    const el = this.lastDiceDisplay;
    if (!el) return;
    if (!this.lastDice || !this.lastRoll) {
      el.style.display = "none";
      return;
    }
    el.style.display = "flex";
    const pipHTML = (value) => {
      const layouts = {
        1: [0,0,0, 0,1,0, 0,0,0],
        2: [0,0,1, 0,0,0, 1,0,0],
        3: [0,0,1, 0,1,0, 1,0,0],
        4: [1,0,1, 0,0,0, 1,0,1],
        5: [1,0,1, 0,1,0, 1,0,1],
        6: [1,0,1, 1,0,1, 1,0,1],
      };
      const l = layouts[value] || layouts[1];
      return l.map(v => `<div class="pip${v ? "" : " hidden"}"></div>`).join("");
    };
    const playerHTML = this.lastRollPlayer
      ? `<div class="last-dice-player"><img src="${this.lastRollPlayer.avatar}" alt="" /><span style="color:${this.lastRollPlayer.color}">${this.lastRollPlayer.name}</span></div>`
      : "";
    el.innerHTML = `
      ${playerHTML}
      <div class="last-dice-mini">${pipHTML(this.lastDice.d1)}</div>
      <div class="last-dice-mini">${pipHTML(this.lastDice.d2)}</div>
      <span class="last-dice-total">${this.lastRoll}</span>
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
      btn.textContent = name.charAt(0).toUpperCase() + name.slice(1);
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
        header.innerHTML = `<img src="${bot.avatar}" alt="" /><span style="color:${bot.color}">${bot.name}</span>`;
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
    // Resource bank: 19 of each minus what players hold
    const totalInPlay = {};
    RESOURCES.forEach(r => {
      totalInPlay[r] = this.players.reduce((sum, p) => sum + p.resources[r], 0);
    });
    const resHTML = RESOURCES.map(r => {
      const bankCount = 19 - totalInPlay[r];
      return `<span class="supply-item"><img src="${RESOURCE_ICON_PATH[r]}" alt="${r}" /><span>${bankCount}</span></span>`;
    }).join("");

    // Dev cards remaining
    const devRemaining = this.devDeck ? this.devDeck.length : 0;

    el.innerHTML = `
      <span class="supply-section-label">Bank</span>
      <span class="supply-section">${resHTML}</span>
      <span class="supply-divider"></span>
      <span class="supply-section-label">Dev</span>
      <span class="supply-item"><span>${devRemaining}</span></span>
    `;
  }

  // ── Build Cost Reference ──────────────────────────────────────────────
  _initCostReference() {
    if (!this.costRefItems) return;
    const items = [
      { label: "Road", cost: COSTS.road },
      { label: "Settle", cost: COSTS.settlement },
      { label: "City", cost: COSTS.city },
      { label: "Dev", cost: COSTS.development },
    ];
    this.costRefItems.innerHTML = items.map(item => {
      const resHTML = RESOURCES.filter(r => (item.cost[r] || 0) > 0)
        .flatMap(r => Array((item.cost[r] || 0)).fill(`<img src="${RESOURCE_ICON_PATH[r]}" alt="${r}" />`))
        .join("");
      return `<div class="cost-ref-row"><span class="cost-ref-label">${item.label}</span><div class="cost-ref-res">${resHTML}</div></div>`;
    }).join("");
  }

  // ── Discard UI ──────────────────────────────────────────────────────
  _showDiscardUI(player, discardCount) {
    return new Promise((resolve) => {
      if (!this.discardPanel) { resolve(); return; }
      this.pendingDiscard = { player, count: discardCount, selected: makeEmptyResources(), resolve };
      this.discardInfo.textContent = `You have ${sumResources(player.resources)} cards. Discard ${discardCount}.`;
      this._renderDiscardCards();
      this.discardPanel.style.display = "";
    });
  }

  _renderDiscardCards() {
    if (!this.pendingDiscard) return;
    const { player, count, selected } = this.pendingDiscard;
    const totalSelected = sumResources(selected);

    // Render each card
    const cards = [];
    RESOURCES.forEach(r => {
      for (let i = 0; i < player.resources[r]; i++) {
        const isSelected = i < selected[r];
        cards.push({ resource: r, index: i, selected: isSelected });
      }
    });

    this.discardCards.innerHTML = cards.map((c, idx) =>
      `<div class="discard-card ${c.resource}${c.selected ? " selected" : ""}" data-res="${c.resource}" data-idx="${idx}">
        <img src="${RESOURCE_ICON_PATH[c.resource]}" alt="${c.resource}" />
      </div>`
    ).join("");

    this.discardCards.querySelectorAll(".discard-card").forEach(el => {
      el.addEventListener("click", () => {
        const res = el.dataset.res;
        if (el.classList.contains("selected")) {
          this.pendingDiscard.selected[res] = Math.max(0, this.pendingDiscard.selected[res] - 1);
        } else {
          const curTotal = sumResources(this.pendingDiscard.selected);
          if (curTotal >= count) return;
          this.pendingDiscard.selected[res] = Math.min(player.resources[res], this.pendingDiscard.selected[res] + 1);
        }
        this._renderDiscardCards();
      });
    });

    this.discardSelected.textContent = `Selected: ${totalSelected} / ${count}`;
    this.discardConfirmBtn.disabled = totalSelected !== count;
  }

  _confirmDiscard() {
    if (!this.pendingDiscard) return;
    const { player, selected, resolve } = this.pendingDiscard;
    RESOURCES.forEach(r => {
      player.resources[r] -= selected[r];
    });
    const total = sumResources(selected);
    this.addLog(`${player.name} discards ${total} cards.`);
    this.pendingDiscard = null;
    this.discardPanel.style.display = "none";
    this.render();
    resolve();
  }

  // ── Resource Gain Toasts for all players ─────────────────────────────
  showResourceGainToasts(gainByPlayer) {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    let delay = 0;
    gainByPlayer.forEach((gain, playerId) => {
      if (sumResources(gain) === 0) return;
      const player = this.players[playerId];

      // Animate flying cards from board to player
      this._animateCardDeal(player, gain, delay);

      // Show toast with a stagger
      setTimeout(() => {
        const toast = document.createElement("div");
        toast.className = "toast resource-gain-toast";
        const resHTML = RESOURCES.filter(r => gain[r] > 0)
          .map(r => `<span class="rgt-res"><span>+${gain[r]}</span><img src="${RESOURCE_ICON_PATH[r]}" alt="${r}" /></span>`)
          .join("");
        toast.innerHTML = `
          <img class="rgt-avatar" src="${player.avatar}" alt="" />
          <span style="color:${player.color};font-weight:700;font-size:0.65rem">${player.name}</span>
          <span class="rgt-resources">${resHTML}</span>
        `;
        stack.appendChild(toast);
        this.sfx.resourceGain();
        setTimeout(() => {
          toast.style.opacity = "0";
          toast.style.transform = "translateY(-4px)";
          setTimeout(() => toast.remove(), 180);
        }, 2800);
      }, delay);
      delay += 300;
    });
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
    const devVP = player.devVictoryPoints;
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
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.bottom + 4}px`;
    document.body.appendChild(tip);
  }

  _hideVPTooltip() {
    const tip = document.getElementById("vpTooltip");
    if (tip) tip.remove();
  }

  drawCanvasScene() {
    if (!this.geometry) return;
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
    if (!document.body.dataset.gameReady) {
      document.body.dataset.gameReady = "true";
    }
  }
}

const game = new ColonistFullGame();
