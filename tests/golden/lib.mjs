// Golden safety net (architecture step 0): a headless, fully seeded Node harness around the real src/game.js.
// Same boot as scripts/ledger/node-engine.mjs (master/dom.js Proxy DOM + prepareEngine). Nothing here may read the clock for a decision:
// Math.random is one seeded stream (counted), timers (Rush) are virtual, search budgets are counted rollouts (rollClock) never milliseconds.
import crypto from "node:crypto";

export const hash = (s) => crypto.createHash("sha256").update(typeof s === "string" ? s : JSON.stringify(s)).digest("hex").slice(0, 16);

// ── one Math.random: seeded, counted (the call count pins the consumption order) ──
let rngImpl = Math.random, calls = 0;
const wrappers = new Map(), implOf = new WeakMap(); // a saved Math.random (a wrapper) put back later restores its impl, not the wrapper
const wrapperFor = (impl) => { let w = wrappers.get(impl); if (!w) { w = () => { calls += 1; return impl(); }; wrappers.set(impl, w); implOf.set(w, impl); } return w; };
Object.defineProperty(Math, "random", { configurable: true, get: () => wrapperFor(rngImpl), set: (f) => { rngImpl = implOf.get(f) || f; } });
export const randomCalls = () => calls;
export const resetRandomCalls = () => { calls = 0; };
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ── virtual time (Rush): setTimeout / setInterval / performance.now / Date.now run on a clock the harness advances ──
const V = { now: 0, seq: 0, q: [] };
const realPerfNow = performance.now.bind(performance), realDateNow = Date.now;
export const vclock = {
  install() {
    V.now = 0; V.seq = 0; V.q = [];
    globalThis.setTimeout = (fn, ms = 0, ...a) => { const id = ++V.seq; V.q.push({ id, at: V.now + Math.max(0, +ms || 0), fn: () => fn(...a), n: id }); return id; };
    globalThis.setInterval = (fn, ms = 0, ...a) => { const id = ++V.seq; const iv = Math.max(1, +ms || 1); const t = { id, at: V.now + iv, n: id, fn: () => { t.at = V.now + iv; t.n = ++V.seq; V.q.push(t); fn(...a); } }; V.q.push(t); return id; };
    globalThis.clearTimeout = globalThis.clearInterval = (id) => { V.q = V.q.filter((t) => t.id !== id); };
    performance.now = () => V.now; Date.now = () => 1.7e12 + V.now;
  },
  uninstall() { performance.now = realPerfNow; Date.now = realDateNow; },
  /** run the earliest due timer (ties: creation order); false when nothing is queued */
  step() {
    if (!V.q.length) return false;
    let k = 0; for (let i = 1; i < V.q.length; i++) if (V.q[i].at < V.q[k].at || (V.q[i].at === V.q[k].at && V.q[i].n < V.q[k].n)) k = i;
    const t = V.q.splice(k, 1)[0]; V.now = Math.max(V.now, t.at); t.fn(); return true;
  },
  get now() { return V.now; },
};

// ── the engine, booted once ──
globalThis.self = globalThis.self || globalThis;
await import("../../src/master/dom.js");
await import("../../src/game.js");
const SR = await import("../../src/master/search.js");
const MA = await import("../../src/master.js");
const SIM = await import("../../src/master/sim.js");
export const g = SR.prepareEngine(self.__colonistGame);
g._rvOff = true;
g.analysis = { on: false, paused: false, budget: 0, parked: null, last: null, seq: 0, min: false, lab: null, capture: false };
export const H = g.constructor.labHelpers;
export const { makeMaster } = SR;
export const { budgetFor } = MA;
export { SIM };
const noopAddLog = g.addLog;
const simLater = g._later; // the lab sim stub (calls at once); Rush needs the real, timer-based one

// ── the move log ──
const SEA = await import("../../src/seafarers/rules.js");
let LOG = null, quiet = 0;
const MOVES = [
  ["placeRoad", (p, e) => `${p.id} road ${e}`], ["placeSettlement", (p, n) => `${p.id} set ${n}`], ["placeCity", (p, n) => `${p.id} city ${n}`],
  ["performBankTrade", (p, a, b) => `${p.id} bank ${a}>${b}`], ["buyDevelopmentCard", (p) => `${p.id} buy`], ["playDevelopmentCard", (p, t) => `${p.id} play ${t}`],
  ["moveRobberAndSteal", (p, h) => `${p.id} robber ${h}`],
];
const wrap = (obj, k, f) => { const o = obj[k].bind(obj); obj[k] = (...a) => { const r = o(...a); if (r !== false && LOG && !quiet) LOG.push(f(...a)); return r; }; };
const wrapped = new WeakSet();
function wrapGame() {
  if (wrapped.has(g)) return; wrapped.add(g);
  MOVES.forEach(([k, f]) => wrap(g, k, f));
  g.addLog = (t) => { if (LOG && !quiet && /traded|discard|stole|rolled|Roll #/i.test(t)) LOG.push(t.replace(/\s+/g, " ")); return 0; };
  const end = g.endTurn.bind(g);
  g.endTurn = (...a) => { const r = end(...a); if (LOG && !quiet) LOG.push(`T${g.turn} ${digest()}`); return r; };
}
function wrapSea() { // the Seafarers rules object is rebuilt with every game: wrap its prototype once
  const P = SEA.Seafarers?.prototype || Object.getPrototypeOf(g.sea || {});
  if (!P || P.__golden) return; P.__golden = true;
  for (const [k, f] of [["placeShip", (p, e) => `${p.id} ship ${e}`], ["moveShip", (p, a, b) => `${p.id} mship ${a}>${b}`]]) {
    const o = P[k]; P[k] = function (...a) { const r = o.apply(this, a); if (r !== false && LOG && !quiet) LOG.push(f(...a)); return r; };
  }
}
/** a compact digest of the live state: hands, bank, points, pieces, robber */
export function digest() {
  const G = g.geometry;
  return hash([g.players.map((p) => [p.resources, p.victoryPoints, p.devCards, p.newDevCards, p.knightsPlayed]), g.bank, g.robberHexId, g.longestRoadHolder, g.largestArmyHolder,
    G.nodes.map((n) => (n.owner == null ? "" : n.owner + (n.structure === "city" ? "C" : "s"))).join(""), G.edges.map((e) => (e.owner == null ? "" : e.owner + (e.ship ? "S" : ""))).join("|"), g.sea?.pirateHexId ?? null]).slice(0, 8);
}

// ── Master agents with counted budgets (never milliseconds) ──
const BUDGETS = { // small and fixed: the point is determinism and coverage, not strength
  master: { n: 6, timeMs: 0, depth: 3, setupDepth: 4, wallCapMs: 1e9, capMs: 1e9 },
  super: { n: 8, timeMs: 8, rollClock: true, timeSlice: true, depth: 4, setupDepth: 5, earlyZ: 3, earlyMin: 4, wallCapMs: 1e9, capMs: 1e9 },
  superplus: { n: 8, timeMs: 8, rollClock: true, timeSlice: true, depth: 4, setupDepth: 5, earlyZ: 3, earlyMin: 4, wallCapMs: 1e9, capMs: 1e9, leaf: "gbm" },
  grandmaster: { n: 10, timeMs: 10, rollClock: true, timeSlice: true, depth: 4, setupDepth: 5, earlyZ: 3, earlyMin: 4, wallCapMs: 1e9, capMs: 1e9, leaf: "gbm" },
};
const SEA_LEAF = "gbm";

function seatStrategy(name) { const s = H.AI_PRESETS[name] || (name === "grandmaster" ? { ...H.AI_PRESETS.superplus, policy: "grandmaster" } : null); if (!s) throw new Error("unknown preset " + name); return { ...s }; }

function settingsFor(spec) {
  const n = spec.seats.length;
  return H.normalizeSettings({ ...H.DEFAULT_SETTINGS, mode: spec.mode || "classic", map: spec.map || "random", dice: spec.dice || "random", board: spec.sea ? "seafarers" : "island", numBots: n - 1,
    rushInterval: spec.rushInterval || 8, winPoints: spec.winPoints || 10, botStyleMode: "all", allPreset: "intermediate", allStrategy: { ...H.AI_PRESETS.intermediate } });
}

function agentsFor(spec, record) {
  return spec.seats.map((name, si) => {
    if (!BUDGETS[name]) return null;
    const a = makeMaster({ ...(spec.seatBudgets?.[si] || BUDGETS[name]), ...(spec.sea ? { leaf: SEA_LEAF } : {}) });
    ["decideSetup", "decideMain", "decideRobber"].forEach((f, fi) => { const o = a[f]; a[f] = (...x) => { quiet += 1; let d; try { d = o(...x); } finally { quiet -= 1; } if (record) record.push(`D${fi} ${x[1]?.id} ${JSON.stringify(d ? d.choice : null)}`); return d; }; });
    return a;
  });
}

/** Play one seeded all-bot game. Returns the move log, its hash, the final-state hash, the random-call count and the outcome. */
export function playGame(spec) {
  wrapGame(); wrapSea();
  const decisions = [];
  LOG = []; quiet = 0; resetRandomCalls();
  g._labSettings = () => settingsFor(spec);
  const agents = agentsFor(spec, decisions);
  const strategies = spec.seats.map(seatStrategy);
  try {
    if (spec.mode === "rush") return playRush(spec, strategies, agents, decisions);
    g._labSimStart(strategies, { players: spec.seats.length, map: spec.map || "random", seed: spec.seed, agents });
    let r = { done: false };
    while (!r.done && !(spec.stopTurn && g.turn >= spec.stopTurn)) { r = g._labSimStep(1); if (spec.onTurn) spec.onTurn(g, r); } // onTurn: read-only observer (tournament --dump-states)
    return finish(spec, r, decisions);
  } finally { g.players.forEach((p) => { p.agent = null; }); }
}

function finish(spec, r, decisions) {
  const log = LOG; LOG = null;
  return { id: spec.id, moves: log.length, movesHash: hash(log), decisionsHash: hash(decisions), stateHash: digest(), randomCalls: randomCalls(), winner: r.winner, turns: r.turns, vp: g.players.map((p) => p.victoryPoints), log, ...(spec.keepState ? { state: JSON.parse(JSON.stringify(g.serializeState())) } : {}) };
}

// Rush: no turns. The 200 ms loop, the bots' 1-2 s ticks, offers and the 7 stages all run on the virtual clock; the harness only pumps it.
function playRush(spec, strategies, agents, decisions) {
  delete g._later; // _labSimStubs made _later immediate: back to the real one (window.setTimeout = the virtual timers)
  vclock.install();
  try {
    Math.random = mulberry32(spec.seed >>> 0);
    g.settings = settingsFor(spec);
    g.onboardingHold = true; g.uiPaused = false;
    g.resetGame();
    g.players.forEach((p, i) => { p.isHuman = false; p.strategy = { ...strategies[i] }; p.agent = agents[i] || null; });
    g.onboardingHold = false;
    document.hidden = false; // the Proxy DOM would answer a truthy stub
    if (g.setupPhase) { g.setupAction = null; g.processSetupQueue(); }
    let guard = 0;
    while (!g.winner && guard++ < 400000 && vclock.now < (spec.maxVirtualMs || 3.6e6)) if (!vclock.step()) break;
    return finish(spec, { winner: g.winner ? g.winner.id : null, turns: g.turn }, decisions);
  } finally { vclock.uninstall(); g._later = simLater; g.uiPaused = true; }
}

/** JSON of a state with its wall-clock fields dropped (log entries carry Date.now()) */
export const stateHash = (st) => hash(JSON.stringify(st, (k, v) => (k === "time" ? undefined : v)));

/** Continue a loaded saved position as a seeded all-bot game for `turns` turns (review/engine.js loadPosition: Rush becomes turn play). */
export async function playOn(state, { seat, turns = 30, seed = 1 }) {
  const { loadPosition } = await import("../../src/review/engine.js");
  wrapGame(); wrapSea(); LOG = []; quiet = 0; resetRandomCalls();
  try {
    loadPosition(g, { state, seat, trk: null, turnSerial: 0 });
    const loaded = stateHash(g.serializeState());
    Math.random = mulberry32(seed >>> 0); resetRandomCalls();
    const t0 = g.turn; g._labSim = { guard: 0 };
    let r = { done: !!g.winner };
    while (!r.done && g.turn < t0 + turns) r = g._labSimStep(1);
    return { loaded, ...finish({ id: "playOn" }, r, []) };
  } finally { g.players.forEach((p) => { p.agent = null; }); }
}
