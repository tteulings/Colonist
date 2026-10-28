// Analysis mode ("AI lens"): while a bot decides, its candidate moves and their scores are drawn on the
// real board (spots as soft glows with a score, roads as dashed lines, robber tiles with the expected
// damage), and a small panel splits the chosen move's score over the five bot dimensions with the top-3
// alternatives. Pause / Step / Resume hold the bots between decisions.
//
// The bots' decision code (src/game.js) only *reports* what it looked at: the candidate lists come from
// the same functions that pick the move (_aiSetupCandidates, _aiRobberCandidates, _aiPlan, ...), and
// everything here is read-only, so a game plays out the same with analysis on or off.
//
// The AI Lab (lab.html) uses the same explain functions + overlay on its own board (see _lab*).

import { stepStripHtml, stepCardHtml } from "./ai-tree.js";

export const AI_DIMS = [
  ["placement", "Placement"], ["expansion", "Expansion"], ["trading", "Trading"], ["devCards", "Dev Cards"], ["awareness", "Awareness"],
];
const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const RES_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const COST = {
  road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 },
  development: { sheep: 1, wheat: 1, ore: 1 },
};
const DEV_TITLE = { knight: "Knight", monopoly: "Monopoly", yearOfPlenty: "Year of Plenty", roadBuilding: "Road Building" };
const DICE = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const KEY = "colonist.aiAnalysis";
const MIN_KEY = "colonist.aiAnalysisMin";
const UNIT = "AI score — higher is better";

const fmt = (v) => (v == null || !Number.isFinite(v) ? "–" : (Math.round(v * 10) / 10).toFixed(1).replace("-0.0", "0.0"));
const sfmt = (v) => (!Number.isFinite(v) || Math.abs(v) < 0.05 ? "0" : `${v > 0 ? "+" : "−"}${fmt(Math.abs(v))}`);
const has = (h, c) => Object.entries(c).every(([r, n]) => (h[r] || 0) >= n);
const cardsText = (h) => R5.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RES_LABEL[r]}`).join(" + ") || "nothing";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dims0 = () => ({ placement: 0, expansion: 0, trading: 0, devCards: 0, awareness: 0 });

const IC = {
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`,
  step: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5v13l9-6.5z" fill="currentColor"/><rect x="16" y="5.5" width="3" height="13" rx="1.2" fill="currentColor"/></svg>`,
  chev: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export const AnalysisMixin = {
  // ── state + switches ────────────────────────────────────────────────────
  _initAnalysis() {
    let on = false, min = false;
    try { on = localStorage.getItem(KEY) === "on"; min = localStorage.getItem(MIN_KEY) === "1"; } catch (_) { /* private mode */ }
    this.analysis = { on, paused: false, budget: 0, parked: null, last: null, seq: 0, min, lab: null, capture: false };
    const t = document.querySelector("#aiAnalysisToggle");
    if (t) {
      t.checked = on;
      t.addEventListener("change", () => this.setAnalysis(t.checked));
    }
  },

  /** Settings › Game › Analysis mode (remembered). Off: bots never wait and nothing is drawn. */
  setAnalysis(on) {
    const a = this.analysis;
    a.on = !!on;
    try { localStorage.setItem(KEY, a.on ? "on" : "off"); } catch (_) { /* ignore */ }
    const t = document.querySelector("#aiAnalysisToggle");
    if (t) t.checked = a.on;
    if (!a.on) { a.paused = false; a.last = null; this._aiKick(); }
    this._renderAnalysis();
    this.requestBoardDraw?.();
  },

  /** Recording candidate lists (analysis on, or the lab capturing a decision). */
  _aiRec() { const a = this.analysis; return !!(a && (a.on || a.capture)); },
  /** Bots must wait: paused with no Step left. */
  _aiHeld() { const a = this.analysis; return !!(a && a.on && a.paused && a.budget <= 0); },
  /** Park the bot's next step until Step / Resume. */
  _aiPark(fn) { this.analysis.parked = this._guard(fn); this._renderAnalysis(); },
  _aiGate(fn) { if (this._aiHeld()) this._aiPark(fn); else fn(); },

  aiPause() { const a = this.analysis; a.paused = true; a.budget = 0; this._renderAnalysis(); },
  aiResume() { const a = this.analysis; if (a.stepView) this._aiStepUnframe(); a.stepView = null; a.paused = false; a.budget = 0; this._aiKick(); this._renderAnalysis(); },
  /** One more decision, then hold again. */
  aiStep() { const a = this.analysis; if (a.stepView) this._aiStepUnframe(); a.stepView = null; a.paused = true; a.budget = 1; this._aiKick(); this._renderAnalysis(); },

  _aiKick() {
    const a = this.analysis;
    if (a.parked) { const f = a.parked; a.parked = null; f(); return; }
    // Classic: wake the bot loop now instead of at its next poll
    if (!this.winner && !this.setupPhase && !this.isRush() && !this.autoplayInterval && this.currentPlayer && !this.currentPlayer.isHuman && !this._aiDiceAnimating) {
      this.stopAiTurnLoop();
      this.scheduleAiTurnsUntilHuman();
    }
  },

  /** A bot decision was made: show it (and use up a Step). */
  _aiNote(dec) {
    const a = this.analysis;
    if (!dec) return;
    // pass & play: a person's seat played by the bot code (autoplay) would show that person's hand: bots only
    if (this.hotseat && this.players?.[dec.pid]?.isHuman) return;
    a.seq += 1;
    dec.seq = a.seq;
    if (a.capture) { a.captured = dec; return; }
    a.last = dec;
    if (a.stepView) this._aiStepUnframe();
    a.stepView = null;
    if (a.on && a.paused) a.budget = Math.max(0, a.budget - 1);
    this._renderAnalysis();
    this.requestBoardDraw?.();
  },

  // ── explain: decision objects ────────────────────────────────────────────
  // { kind, pid, title, score, dims, parts, alts:[{label, score}], note, nodes:[{id, s}], cities, edges, hexes:[{id, s, dmg}],
  //   pick:{ node, edge, hex, city }, offers }
  _spotLabel(nodeId) {
    const nums = this.geometry.nodes[nodeId].adjacentHexes.map((h) => this.geometry.hexes[h]).filter((h) => h.number).map((h) => h.number);
    return nums.length ? nums.join("·") : "coast";
  },

  _nodeDims(player, nodeId) {
    const parts = dims0();
    const score = this.getNodeProductionScore(nodeId, player, null, parts);
    return { score, dims: parts };
  },

  _aiExplainSetup(player) {
    if (player.strategy?.policy === "rules") { // v0.87 Simple: the spot with the most pips
      const ids = this._rulesSetupSpots(player);
      const b = this._rulesSetupSpot(player);
      if (!b) return null;
      const alts = ids.filter((id) => id !== b.id).map((id) => ({ id, s: this._rulesPips(id) })).sort((x, y) => y.s - x.s).slice(0, 3).map((c) => ({ label: `Spot ${this._spotLabel(c.id)}`, score: c.s }));
      return { kind: "setup", pid: player.id, title: "Settlement · most pips", score: b.pips, dims: dims0(), alts, rules: null, fmt: "int",
        note: `Rule: most pips (${b.pips}), tie → more resources (${b.kinds})`, nodes: ids.map((id) => ({ id, s: this._rulesPips(id) })), pick: { node: b.id } };
    }
    const cands = this._aiSetupCandidates(player);
    let best = null;
    cands.forEach((c) => { if (!best || c.score > best.score) best = c; });
    if (!best) return null;
    const { dims } = this._nodeDims(player, best.id);
    const alts = cands.filter((c) => c.id !== best.id).sort((x, y) => y.score - x.score).slice(0, 3)
      .map((c) => ({ label: `Spot ${this._spotLabel(c.id)}`, score: c.score }));
    return { kind: "setup", pid: player.id, title: "Settlement", score: best.score, dims, alts,
      note: `Best: Spot ${this._spotLabel(best.id)} of ${cands.length} spots`, nodes: cands.map((c) => ({ id: c.id, s: c.score })), pick: { node: best.id } };
  },

  _aiNoteSetup(player, nodeId) {
    const d = this._aiExplainSetup(player);
    if (d) { d.pick.node = nodeId; d.steps = this._aiStepsNow("setup", player); this._aiNote(d); }
  },

  /** v0.87 "Step through this decision": the ordered steps, read before the move is made (analysis on only). */
  _aiStepsNow(mode, player) {
    if (!this.analysis?.on || this.analysis.capture) return null;
    return this._aiTree(mode, player, { planOnly: true })?.steps || null;
  },

  _aiNoteSetupRoad(player, nodeId, roadId, cands) {
    const best = cands.find((c) => c.id === roadId);
    const dims = dims0();
    if (best && Number.isFinite(best.score)) dims.placement = best.score;
    this._aiNote({ kind: "setupRoad", pid: player.id, title: "Road", score: best && Number.isFinite(best.score) ? best.score : null, dims,
      alts: cands.filter((c) => c.id !== roadId && Number.isFinite(c.score)).sort((a, b) => b.score - a.score).slice(0, 3).map((c) => ({ label: "Road", score: c.score })),
      note: "Points at the best spot one step further", edges: cands.filter((c) => Number.isFinite(c.score)).map((c) => ({ id: c.id, s: c.score })),
      nodes: [{ id: nodeId, s: 0 }], pick: { edge: roadId } });
  },

  _aiExplainRobber(player, chosen = null) {
    if (player.strategy?.policy === "rules" && !this.sea) { // v0.87 Simple: the leader's tile with the most pips
      const r = this._rulesRobber(player);
      if (!r.pick) return null;
      const pick = chosen != null ? r.cands.find((c) => c.id === chosen) || r.pick : r.pick;
      return { kind: "robber", pid: player.id, title: "Robber · leader's best tile", score: pick.lead, dims: dims0(), alts: [], fmt: "int",
        note: `Rule: the leader (${r.leader?.name || "–"})'s tile with the most pips, never its own · steals from the leader`,
        hexes: r.cands.filter((c) => !c.own).map((c) => ({ id: c.id, s: c.lead, dmg: c.lead ? c.lead / 36 * 10 : null })), pick: { hex: pick.id } };
    }
    if (this.sea) {
      return { kind: "robber", pid: player.id, title: "Robber", score: null, dims: dims0(), alts: [], note: "Robber or pirate: by expected damage", hexes: chosen != null ? [{ id: chosen, s: 1, dmg: null }] : [], pick: { hex: chosen } };
    }
    const cands = this._aiRobberCandidates(player);
    if (!cands.length) return null;
    let best = null;
    cands.forEach((c) => { if (!best || c.score > best.score) best = c; });
    const pick = chosen != null ? cands.find((c) => c.id === chosen) || best : best;
    const dims = dims0();
    dims.awareness = pick.score;
    const p = pick.parts;
    const bits = [`blocks ${fmt(p.block)} cards`];
    if (Math.abs(p.leader) > 0.05) bits.push(`leader ${p.leader > 0 ? "+" : ""}${fmt(p.leader)}`);
    if (p.steal) bits.push(`steal ${fmt(p.steal)}`);
    if (p.own) bits.push(`own ${fmt(p.own)}`);
    return { kind: "robber", pid: player.id, title: "Robber", score: pick.score, dims, parts: p,
      alts: cands.filter((c) => c.id !== pick.id).sort((a, b) => b.score - a.score).slice(0, 3).map((c) => ({ label: this._hexName(c.id), score: c.score })),
      note: bits.join(" · "), hexes: cands.map((c) => ({ id: c.id, s: c.score, dmg: c.dmg })), pick: { hex: pick.id } };
  },

  _hexName(hexId) {
    const h = this.geometry.hexes[hexId];
    if (!h.number) return h.resource === "desert" ? "Desert" : "Tile";
    return `${RES_LABEL[h.resource] || h.resource} ${h.number}`;
  },

  _aiNoteRobber(player, hexId) {
    const d = this._aiExplainRobber(player, hexId);
    if (d) d.steps = this._aiStepsNow("robber", player);
    this._aiNote(d);
  },

  _aiDevReason(player, type) {
    if (type === "knight") return this._aiKnightReason(player) || "Knight";
    if (type === "monopoly") {
      const pick = this._aiMonopolyPick(player);
      return `${RES_LABEL[pick.resource]}: ~${fmt(pick.count)} cards expected (worth ${fmt(pick.value)})`;
    }
    if (type === "yearOfPlenty") {
      const picks = this.chooseYearOfPlentyResources(player);
      return `Takes ${picks.map((r) => RES_LABEL[r]).join(" + ")} for its next build`;
    }
    return "Two free roads toward its plan";
  },

  _aiNoteDev(player, type, why) {
    // v0.83: a Knight moves the robber first (noted by moveRobber): one decision, so it is folded into that
    // robber note instead of being a second one (Step used to let the Knight through after the robber)
    const a = this.analysis, prev = a?.capture ? a.captured : a?.last;
    if (type === "knight" && prev && prev.kind === "robber" && prev.pid === player.id && prev.seq === a.seq && !prev.knight) {
      prev.knight = true;
      prev.title = `${DEV_TITLE.knight || "Knight"} · Robber`;
      prev.note = [why, prev.note].filter(Boolean).join(" · ");
      prev.dims = { ...prev.dims, devCards: (prev.dims?.devCards || 0) + 1 };
      this._renderAnalysis();
      return;
    }
    const dims = dims0();
    dims.devCards = 1;
    this._aiNote({ kind: "dev", pid: player.id, title: DEV_TITLE[type] || "Card", score: null, dims, alts: [], note: why });
  },

  _aiNoteTrade(player, log, res) {
    const plan = log.plan, hand = log.hand;
    const score = (h) => (plan ? this._aiBestScore(plan, h) : 0);
    const base = score(hand);
    const offers = log.offers.map((o) => {
      const less = { ...hand };
      R5.forEach((r) => { less[r] -= o.give[r] || 0; });
      const plus = { ...less };
      R5.forEach((r) => { plus[r] += o.get[r] || 0; });
      const sLess = score(less), sPlus = score(plus);
      return { ...o, given: base - sLess, received: sPlus - sLess };
    });
    const acc = res?.type === "done" ? offers.find((o) => o.answers.some((x) => x.ok)) : null;
    const dims = dims0();
    if (acc) dims.trading = acc.received - acc.given;
    const title = acc ? "Trade" : res?.type === "human" ? (this.hotseat && res.toPlayer ? `Offer to ${res.toPlayer.name}` : "Offer to you") : "Trade (no deal)";
    this._aiNote({ kind: "trade", pid: player.id, title, score: acc ? acc.received - acc.given : null, dims, alts: [], offers,
      note: offers.length ? `Toward ${offers[0].goal}` : "" });
  },

  /** Score split of one plan goal over the five dimensions (adds up to the goal's score). */
  _aiGoalDims(player, plan, g, hand) {
    const dims = dims0();
    const off = plan.W.etaOffset;
    const etaNo = this._aiEta(g.cost, hand, plan.incTurn, null);
    const s0 = g.value / (etaNo + off);
    dims.trading = g.score - s0; // bank / port trades make it sooner
    const k = 1 / (etaNo + off);
    const p = g.parts || { vp: g.vp, prod: 0, horizon: 0, win: 0 };
    if (g.type === "dev") dims.devCards += p.vp * k;
    else if (g.type === "road") { dims.expansion += Math.min(2, p.vp) * k; dims.awareness += Math.max(0, p.vp - 2) * k; }
    else dims.expansion += p.vp * k;
    dims.placement += p.prod * k;
    dims.awareness += (p.horizon + p.win) * k;
    return dims;
  },

  _aiPlanSnap(player, plan) {
    const hand = { ...player.resources };
    return {
      hand, plan, spots: plan.spots,
      dims: new Map(plan.goals.map((g) => [g, this._aiGoalDims(player, plan, g, hand)])),
      pieces: { s: new Set(player.settlements), c: new Set(player.cities), r: new Set(player.roads) },
    };
  },

  /** A plan as analysis data: chosen goal highlighted, its spot/road on the board, the other goals as alternatives. */
  _aiPlanDecision(player, snap, goal, act) {
    const plan = snap.plan;
    const nodes = (snap.spots || []).map((s) => ({ id: s.nodeId, s: s.h }));
    const edges = [];
    const cities = [];
    plan.goals.forEach((g) => {
      if (g.edge != null && !edges.some((e) => e.id === g.edge)) edges.push({ id: g.edge, s: g.score });
      if (g.type === "city") cities.push({ id: g.nodeId, s: g.score });
    });
    const pick = {};
    if (goal) {
      if (goal.type === "settlement" && goal.dist > 0) { pick.edge = goal.edge; pick.node = goal.nodeId; }
      else if (goal.type === "settlement") pick.node = goal.nodeId;
      else if (goal.type === "city") pick.city = goal.nodeId;
      else if (goal.type === "road") pick.edge = goal.edge;
    }
    let title = goal ? goal.label : "Ship move";
    let note = goal ? (goal.eta === 0 ? "Affordable now" : `~${fmt(goal.eta)} turns away`) : "";
    if (act === "bank") {
      const d = {};
      R5.forEach((r) => { d[r] = player.resources[r] - snap.hand[r]; });
      const gave = R5.filter((r) => d[r] < 0).map((r) => `${-d[r]} ${RES_LABEL[r]}`).join(" + ");
      const got = R5.filter((r) => d[r] > 0).map((r) => `${d[r]} ${RES_LABEL[r]}`).join(" + ");
      title = "Bank trade";
      note = gave ? `${gave} → ${got} · for ${goal.label}` : `Toward ${goal.label}`;
    } else if (act === "side") note = "Side build: doesn't delay the plan";
    else if (act === "end") { title = "Ends turn"; note = goal ? `Saving for ${goal.label}${goal.eta ? ` (~${fmt(goal.eta)} turns)` : ""}` : "Nothing to build"; }
    else if (goal && goal.type === "settlement" && goal.dist > 0) title = `Road → ${goal.label.replace(/ \(.*\)/, "")}`;
    return {
      kind: "plan", pid: player.id, title, score: goal ? goal.score : null, dims: goal ? snap.dims.get(goal) : dims0(), steps: snap.steps || null,
      alts: plan.goals.filter((g) => g !== goal).slice(0, 3).map((g) => ({ label: g.label.replace(/ \(\+(\d) roads?\)/, " +$1r").replace("Development card", "Dev card"), score: g.score })),
      note, nodes, edges, cities, pick,
    };
  },

  _aiNotePlan(player, snap, goal, act) { this._aiNote(this._aiPlanDecision(player, snap, goal, act)); },

  _aiExplainPlan(player) {
    if (player.strategy?.policy === "rules") return this._rulesDecision(player, this._rulesCheck(player)); // v0.87 Simple
    const plan = this._aiPlan(player);
    const snap = this._aiPlanSnap(player, plan);
    return this._aiPlanDecision(player, snap, plan.goals[0] || null, "build");
  },

  _aiNoteEnd(player) {
    if (player.strategy?.policy === "rules") { const d = this._rulesDecision(player, this._rulesCheck(player)); d.steps = this._aiStepsNow("build", player); this._aiNote(d); return; } // v0.87 Simple
    const plan = this._aiPlan(player);
    const snap = this._aiPlanSnap(player, plan);
    snap.steps = this._aiStepsNow("build", player);
    this._aiNote(this._aiPlanDecision(player, snap, plan.goals[0] || null, "end"));
  },

  // Beginner-style fixed order (expansion "simple"): what each action compared
  _aiSimpleSnap(player, kind) {
    const snap = { hand: { ...player.resources }, s: new Set(player.settlements), c: new Set(player.cities), r: new Set(player.roads), cands: [] };
    if (kind === "settlement" && has(player.resources, COST.settlement)) {
      snap.cands = this.getBuildableSettlementNodes(player).map((c) => ({ id: c.nodeId, s: c.score }));
      let best = null;
      snap.cands.forEach((c) => { if (!best || c.s > best.s) best = c; });
      if (best) snap.best = { id: best.id, dims: this._nodeDims(player, best.id).dims };
    }
    if (kind === "city" && has(player.resources, COST.city)) {
      snap.cands = [...player.settlements].map((id) => ({ id, s: this.geometry.nodes[id].adjacentHexes.reduce((a, h) => a + (DICE[this.geometry.hexes[h].number] || 0) / 6, 0) }));
    }
    if (kind === "road" && has(player.resources, COST.road)) {
      this.geometry.edges.forEach((e) => {
        if (!this.canBuildRoad(player, e.id, { free: false })) return;
        snap.cands.push({ id: e.id, s: Math.max(...e.nodes.map((n) => this.getNodeProductionScore(n, player))) });
      });
    }
    return snap;
  },

  _aiNoteSimple(player, kind, snap) {
    const dims = dims0();
    const newNode = [...player.settlements].find((n) => !snap.s.has(n));
    const newCity = [...player.cities].find((n) => !snap.c.has(n));
    const newEdge = [...player.roads].find((e) => !snap.r.has(e));
    const others = (id) => snap.cands.filter((c) => c.id !== id && Number.isFinite(c.s)).sort((a, b) => b.s - a.s).slice(0, 3);
    let d = { kind: "simple", pid: player.id, title: kind, score: null, dims, alts: [], note: "Fixed order: builds what it can afford" };
    if (kind === "settlement" && newNode != null) {
      const c = snap.cands.find((x) => x.id === newNode);
      if (snap.best?.id === newNode) Object.assign(dims, snap.best.dims); // split read before building
      d = { ...d, title: "Settlement", score: c ? c.s : null, nodes: snap.cands.map((x) => ({ id: x.id, s: x.s })), pick: { node: newNode },
        alts: others(newNode).map((x) => ({ label: `Spot ${this._spotLabel(x.id)}`, score: x.s })) };
    } else if (kind === "city" && newCity != null) {
      const c = snap.cands.find((x) => x.id === newCity);
      dims.placement = c ? c.s : 0;
      d = { ...d, title: "City", score: c ? c.s : null, cities: snap.cands.map((x) => ({ id: x.id, s: x.s })), pick: { city: newCity },
        alts: others(newCity).map((x) => ({ label: `City ${this._spotLabel(x.id)}`, score: x.s })) };
    } else if (kind === "road" && newEdge != null) {
      const c = snap.cands.find((x) => x.id === newEdge);
      dims.expansion = c && Number.isFinite(c.s) ? c.s : 0;
      d = { ...d, title: "Road", score: c && Number.isFinite(c.s) ? c.s : null, edges: snap.cands.filter((x) => Number.isFinite(x.s)).map((x) => ({ id: x.id, s: x.s })), pick: { edge: newEdge },
        alts: others(newEdge).map((x) => ({ label: "Road", score: x.s })) };
    } else if (kind === "dev") {
      dims.devCards = 1;
      d = { ...d, title: "Development card", note: "Buys a card with spare cards" };
    } else if (kind === "bank") {
      const delta = {};
      R5.forEach((r) => { delta[r] = player.resources[r] - snap.hand[r]; });
      d = { ...d, title: "Bank trade", note: `${cardsText(Object.fromEntries(R5.map((r) => [r, Math.max(0, -delta[r])])))} → ${cardsText(Object.fromEntries(R5.map((r) => [r, Math.max(0, delta[r])])))}` };
    } else if (kind === "ship") d = { ...d, title: "Ship" };
    this._aiNote(d);
  },

  /** v0.87 Step through (in game): move the board so what the step marks sits in the visible part above the
   *  step card (zooming in a little if needed); Close puts the view back. */
  _aiStepFrame() {
    const a = this.analysis, sv = a?.stepView;
    const panel = document.getElementById("aiPanel");
    if (!sv || !this.geometry || !panel || !this.canvas) return;
    const d = this._analysisShown() || {};
    const g = this.geometry, pts = [];
    const nodeP = (id) => g.nodes[id] && pts.push({ x: g.nodes[id].x, y: g.nodes[id].y });
    const hexP = (id) => g.hexes[id] && pts.push({ x: g.hexes[id].center.x, y: g.hexes[id].center.y });
    const edgeP = (id) => { if (!g.edges[id]) return; const [p, q] = g.edges[id].nodes.map((i) => g.nodes[i]); pts.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }); };
    (d.badges || []).forEach((b) => { if (b.hex != null) hexP(b.hex); else if ((b.node ?? b.city) != null) nodeP(b.node ?? b.city); else if (b.edge != null) edgeP(b.edge); });
    if (!pts.length) { const f = d.focus || d.pick || {}; if (f.hex != null) hexP(f.hex); if ((f.node ?? f.city) != null) nodeP(f.node ?? f.city); if (f.edge != null) edgeP(f.edge); }
    if (!pts.length) [...(d.nodes || []), ...(d.cities || [])].slice(0, 8).forEach((n) => nodeP(n.id));
    if (!pts.length) (d.hexes || []).slice(0, 6).forEach((h) => hexP(h.id));
    if (!pts.length) return;
    const cr = this.canvas.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const { vp } = this._viewFrame();
    const top = vp.t + 8, bottom = Math.min(vp.t + vp.H, pr.top - cr.top) - 10, left = vp.l + 6, right = vp.l + vp.W - 6;
    if (bottom - top < 60) return;
    const M = 26;
    const scr = pts.map((p) => this.worldToScreen(p.x, p.y));
    if (scr.every((p) => p.x >= left + M && p.x <= right - M && p.y >= top + M && p.y <= bottom - M)) return;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const bw = Math.max(1, Math.max(...xs) - Math.min(...xs)), bh = Math.max(1, Math.max(...ys) - Math.min(...ys));
    const scale = clampN(Math.min(this.view.scale, (right - left - 2 * M) / bw, (bottom - top - 2 * M) / bh), this._minScale() * 0.7, this._maxScale());
    if (!a.stepPrevView) a.stepPrevView = { ...this.view };
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    Object.assign(this.view, { scale, offsetX: (left + right) / 2 - cx * scale, offsetY: (top + bottom) / 2 - cy * scale });
    this._viewChanged?.();
  },
  _aiStepUnframe() {
    const a = this.analysis;
    if (a?.stepPrevView) { Object.assign(this.view, a.stepPrevView); a.stepPrevView = null; this._viewChanged?.(); }
  },

  /** Steps for a decision noted without them (dev cards, trades, fixed-order builds): what it looked at → choice. */
  _aiGenericSteps(d) {
    const S = [];
    const n = (d.nodes?.length || 0) + (d.cities?.length || 0) + (d.edges?.length || 0) + (d.hexes?.length || 0);
    if (n) S.push({ title: "What it looked at", sub: `${n} candidate${n > 1 ? "s" : ""} on the board`, rows: [], overlay: { nodes: d.nodes, cities: d.cities, edges: d.edges, hexes: d.hexes } });
    if (d.offers?.length) S.push({ title: "Offers", sub: `${d.offers.length} considered`, rows: d.offers.slice(0, 4).map((o) => ({ label: `${cardsText(o.give)} → ${cardsText(o.get)}`, sub: o.skip ? "not closer" : o.answers.map((x) => `${this.players[x.pid].name} ${x.ok ? "✓" : x.ok === false ? "✗" : "?"}`).join(" · ") || "no taker", vt: "none" })), overlay: {} });
    if (d.alts?.length) S.push({ title: "Next best", sub: "what it passed on", rows: d.alts.map((x) => ({ label: x.label, v: x.score, vt: Number.isFinite(x.score) ? "score" : "none", bar: x.score })), overlay: { nodes: d.nodes, cities: d.cities, edges: d.edges, hexes: d.hexes } });
    S.push({ title: "Choice", sub: d.title, text: d.note || "", rows: [], overlay: { nodes: d.nodes, cities: d.cities, edges: d.edges, hexes: d.hexes, pick: d.pick || {}, focus: d.pick && Object.values(d.pick).some((v) => v != null) ? d.pick : null } });
    return S;
  },

  // ── board overlay (both renderers call this in world coordinates) ─────────
  _analysisShown() {
    const a = this.analysis;
    if (!a || !this.geometry) return null;
    if (a.lab) return a.lab;
    if (a.stepView && a.on) { const sv = a.stepView, st = sv.steps[sv.cur], row = sv.sel != null ? st?.rows?.[sv.sel] : null; return { kind: "step", pid: sv.pid, ...(st?.overlay || {}), ...(row?.focus ? { focus: row.focus } : {}) }; } // v0.87 Step through
    if (!a.on || !a.last || this.winner) return null;
    const cp = this.currentPlayer;
    // Your own turn (not watching bots play): your board stays clean
    if (!this.isRush() && cp?.isHuman && !this.autoplayInterval) return null;
    return a.last;
  },

  /** Art-space renderers (themes A/B/C) call this with their transform; it switches to world units. */
  drawAnalysisOverlayArt(ctx) {
    const d = this._analysisShown();
    if (!d) return;
    const g = this.geometry, u = g.hexSize / 100;
    ctx.save();
    ctx.scale(1 / u, 1 / u);
    ctx.translate(-g.centerX, -g.centerY);
    this.drawAnalysisOverlay(ctx, d);
    ctx.restore();
  },

  drawAnalysisOverlay(ctx, d = this._analysisShown()) {
    if (!d) return;
    const g = this.geometry;
    const px = 1 / (this.view.scale || 1); // world units per CSS pixel
    const hs = g.hexSize;
    const color = this.players?.[d.pid]?.color || "#3C75C6";
    const norm = (list) => {
      const v = list.map((x) => x.s).filter(Number.isFinite);
      const lo = Math.min(...v), hi = Math.max(...v);
      return (s) => (!Number.isFinite(s) ? 0 : hi - lo < 1e-9 ? 1 : (s - lo) / (hi - lo));
    };
    const label = (x, y, text, strong = false) => {
      ctx.font = `${strong ? 800 : 700} ${(strong ? 12 : 10.5) * px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3.2 * px; ctx.strokeStyle = "rgba(20,32,44,.82)"; ctx.strokeText(text, x, y);
      ctx.fillStyle = "#fff"; ctx.fillText(text, x, y);
    };
    const pick = d.pick || {};
    // v0.87: two decimals (0.68 and 0.65 must not both read 0.7); whole numbers for pips
    // v0.87: 1 decimal on the board, 2 only when two of the numbered spots would read the same
    let dec = 1;
    {
      const shown = [...(d.nodes || []), ...(d.cities || [])].map((x) => x.s).filter(Number.isFinite).sort((a, b) => b - a).slice(0, 6).map((v) => v.toFixed(1));
      if (new Set(shown).size < shown.length) dec = 2;
    }
    const sval = (v) => (d.fmt === "int" ? String(Math.round(v)) : Math.abs(v) >= 10 ? fmt(v) : v.toFixed(dec));
    ctx.save();
    // robber tiles: a soft shade by score, the expected damage under the number token
    if (d.hexes?.length) {
      const t = norm(d.hexes);
      const top = new Set(d.hexes.filter((h) => Number.isFinite(h.s)).sort((a, b) => b.s - a.s).slice(0, 5).map((h) => h.id));
      d.hexes.forEach((h) => {
        const hex = g.hexes[h.id];
        const k = t(h.s);
        ctx.beginPath();
        hex.corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
        ctx.closePath();
        ctx.fillStyle = `rgba(28,24,40,${0.06 + 0.26 * k})`;
        ctx.fill();
        if (h.id === pick.hex) { ctx.lineWidth = 3 * px; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke(); }
        if (!d.noLabels && h.dmg != null && ((top.has(h.id) && h.dmg > 0.05) || h.id === pick.hex)) label(hex.center.x, hex.center.y + hs * 0.5, `−${fmt(h.dmg)}`, h.id === pick.hex);
      });
    }
    // road candidates: faint dashed lines, the chosen one brighter
    if (d.edges?.length) {
      const t = norm(d.edges);
      ctx.lineCap = "round";
      d.edges.forEach((e) => {
        const [a, b] = g.edges[e.id].nodes.map((n) => g.nodes[n]);
        const chosen = e.id === pick.edge;
        const k = chosen ? 1 : 0.25 + 0.5 * t(e.s);
        const sx = a.x + (b.x - a.x) * 0.2, sy = a.y + (b.y - a.y) * 0.2, ex = b.x - (b.x - a.x) * 0.2, ey = b.y - (b.y - a.y) * 0.2;
        ctx.setLineDash(chosen ? [] : [5 * px, 5 * px]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
        ctx.strokeStyle = `rgba(20,32,44,${0.35 * k})`; ctx.lineWidth = (chosen ? 7 : 5) * px; ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`; ctx.lineWidth = (chosen ? 4 : 2.5) * px; ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    // spots: soft glows in the bot's colour, sized by score; numbers on the best few
    const spots = [...(d.nodes || []).map((n) => ({ ...n, city: false })), ...(d.cities || []).map((n) => ({ ...n, city: true }))];
    if (spots.length) {
      const t = norm(spots);
      const ranked = spots.filter((s) => Number.isFinite(s.s)).sort((a, b) => b.s - a.s);
      const numbered = new Set(ranked.slice(0, 6).map((s) => s.id));
      spots.forEach((s) => {
        const n = g.nodes[s.id];
        const k = t(s.s);
        const r = hs * (0.12 + 0.12 * k);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        grad.addColorStop(0, hexA(color, 0.2 + 0.45 * k));
        grad.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
      });
      spots.forEach((s) => {
        const n = g.nodes[s.id];
        const chosen = s.city ? s.id === pick.city : s.id === pick.node;
        if (chosen) {
          ctx.beginPath(); ctx.arc(n.x, n.y, hs * 0.2, 0, Math.PI * 2);
          ctx.lineWidth = 4.5 * px; ctx.strokeStyle = "rgba(20,32,44,.35)"; ctx.stroke();
          ctx.lineWidth = 2.5 * px; ctx.strokeStyle = "#fff"; ctx.stroke();
        }
        if ((chosen || numbered.has(s.id)) && Number.isFinite(s.s) && d.kind !== "setupRoad" && !d.noLabels) label(n.x, n.y - (s.city ? hs * 0.3 : 0), sval(s.s), chosen);
      });
    }
    // v0.87 step through: lettered / numbered badges (A, B… candidates; 1, 2 winner and runner-up; pills
    // like "Town" or "2:1") at a node, city, edge or tile
    if (d.badges?.length) {
      const at = (b) => {
        if (b.hex != null && g.hexes[b.hex]) return { x: g.hexes[b.hex].center.x, y: g.hexes[b.hex].center.y - hs * 0.42 };
        const nid = b.node ?? b.city;
        if (nid != null && g.nodes[nid]) return { x: g.nodes[nid].x, y: g.nodes[nid].y - hs * (b.pill ? 0.36 : 0.32) };
        if (b.edge != null && g.edges[b.edge]) { const [a, c] = g.edges[b.edge].nodes.map((n) => g.nodes[n]); return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; }
        return null;
      };
      d.badges.forEach((b) => {
        const p = at(b);
        if (!p) return;
        ctx.font = `800 ${11.5 * px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = Math.max(18 * px, ctx.measureText(b.text).width + 10 * px), h = 18 * px;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2); else ctx.arc(p.x, p.y, h / 2, 0, Math.PI * 2);
        ctx.fillStyle = b.tone === "alt" ? "rgba(255,255,255,.96)" : b.tone === "dim" ? "rgba(40,48,56,.82)" : color;
        ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 4 * px; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6 * px; ctx.strokeStyle = b.tone === "alt" ? color : "rgba(255,255,255,.95)"; ctx.stroke();
        ctx.fillStyle = b.tone === "alt" ? "#22302F" : "#fff";
        ctx.fillText(b.text, p.x, p.y + 0.5 * px);
      });
    }
    // v0.87 lab: the candidate tapped in the decision tree, a dashed ring in the bot's colour
    const f = d.focus;
    if (f) {
      ctx.save();
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.lineCap = "round";
      const ring = (x, y, r) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = 6 * px; ctx.strokeStyle = "rgba(20,32,44,.45)"; ctx.stroke();
        ctx.lineWidth = 3.2 * px; ctx.strokeStyle = color; ctx.stroke();
      };
      if (f.hex != null && g.hexes[f.hex]) ring(g.hexes[f.hex].center.x, g.hexes[f.hex].center.y, hs * 0.62);
      const nid = f.node ?? f.city;
      if (nid != null && g.nodes[nid]) ring(g.nodes[nid].x, g.nodes[nid].y, hs * 0.3);
      if (f.edge != null && g.edges[f.edge]) {
        const [a, b] = g.edges[f.edge].nodes.map((n) => g.nodes[n]);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * 0.2, a.y + (b.y - a.y) * 0.2); ctx.lineTo(b.x - (b.x - a.x) * 0.2, b.y - (b.y - a.y) * 0.2);
        ctx.lineWidth = 8 * px; ctx.strokeStyle = "rgba(20,32,44,.45)"; ctx.stroke();
        ctx.lineWidth = 4.5 * px; ctx.strokeStyle = color; ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  // ── panel ─────────────────────────────────────────────────────────────────
  _renderAnalysis() {
    const a = this.analysis;
    if (!a) return;
    let el = document.getElementById("aiPanel");
    const show = a.on && !a.lab && !this.onboardingHold && !!this.players?.length;
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) {
      el = document.createElement("section");
      el.id = "aiPanel";
      el.className = "ai-panel";
      el.setAttribute("aria-label", "Bot analysis");
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ai]");
        if (!b) return;
        const k = b.dataset.ai;
        if (k === "pause") this.aiPause();
        else if (k === "resume") this.aiResume();
        else if (k === "step") this.aiStep();
        else if (k === "steps" && a.last) { // v0.87: step through the shown decision (the bots wait meanwhile)
          const d = a.last;
          if (!a.paused) this.aiPause();
          a.stepView = { steps: d.steps?.length ? d.steps : this._aiGenericSteps(d), cur: 0, pid: d.pid, title: d.title };
          this._renderAnalysis(); this.requestBoardDraw?.(); requestAnimationFrame(() => this._aiStepFrame());
        } else if (k === "sprev" || k === "snext") {
          const sv = a.stepView; if (!sv) return;
          sv.cur = Math.max(0, Math.min(sv.steps.length - 1, sv.cur + (k === "snext" ? 1 : -1))); sv.sel = null;
          this._renderAnalysis(); this.requestBoardDraw?.(); requestAnimationFrame(() => this._aiStepFrame());
        } else if (k === "sclose") { a.stepView = null; this._aiStepUnframe(); this._renderAnalysis(); this.requestBoardDraw?.(); }
        else if (k === "sgo") { const sv = a.stepView; if (sv) { sv.cur = Number(b.dataset.step) || 0; sv.sel = null; this._renderAnalysis(); this.requestBoardDraw?.(); requestAnimationFrame(() => this._aiStepFrame()); } }
        else if (k === "srow") { const sv = a.stepView; if (sv) { const i = Number(b.dataset.row); sv.sel = sv.sel === i ? null : i; this._renderAnalysis(); this.requestBoardDraw?.(); } }
        else if (k === "min") {
          a.min = !a.min;
          try { localStorage.setItem(MIN_KEY, a.min ? "1" : "0"); } catch (_) { /* ignore */ }
          this._renderAnalysis();
        }
      });
      (document.getElementById("boardWrap") || document.body).appendChild(el);
    }
    el.hidden = false;
    el.classList.toggle("min", a.min);
    el.classList.toggle("stepping", !!a.stepView && !a.min); // v0.87: a short step card, the board stays visible
    el.classList.toggle("held", this._aiHeld());
    const d = a.last;
    const p = d ? this.players[d.pid] : null;
    const held = this._aiHeld() || !!a.parked;
    const ctl = `<span class="aip-ctl">${a.paused
      ? `<button type="button" data-ai="resume" class="on" aria-label="Resume bots" title="Resume">${IC.play}</button>`
      : `<button type="button" data-ai="pause" aria-label="Pause bots" title="Pause">${IC.pause}</button>`}
      <button type="button" data-ai="step" aria-label="Step: next decision" title="Step (next decision)">${IC.step}</button></span>`;
    const who = p ? `<i class="aip-dot" style="background:${p.color}"></i><b class="aip-t"><span class="aip-n">${esc(p.name)}</span> · ${esc(d.title)}</b>` : `<b class="aip-t">${a.paused ? "Paused" : "Waiting for a bot move…"}</b>`;
    const score = d && d.score != null ? `<span class="aip-sc" title="${UNIT}">${fmt(d.score)}</span>` : "";
    const head = `<div class="aip-head">${who}${score}${ctl}<button type="button" class="aip-min" data-ai="min" aria-expanded="${!a.min}" aria-label="${a.min ? "Show details" : "Hide details"}">${IC.chev}</button></div>`;
    let body = "";
    if (a.stepView && !a.min) {
      const sv = a.stepView;
      body += `<div class="aip-steps"><div class="aip-shead"><button type="button" class="aip-sarrow" data-ai="sprev" aria-label="Previous step"${sv.cur ? "" : " disabled"}>‹</button>${stepStripHtml(sv.steps, sv.cur).replace(/data-step="/g, 'data-ai="sgo" data-step="')}<button type="button" class="aip-sarrow" data-ai="snext" aria-label="Next step"${sv.cur < sv.steps.length - 1 ? "" : " disabled"}>›</button><button type="button" data-ai="sclose" class="aip-slink">Close</button></div>${stepCardHtml(sv.steps, sv.cur, sv.sel ?? null).replace(/data-row="/g, 'data-ai="srow" data-row="')}</div>`;
    } else if (d && !a.min && d.rules) {
      // v0.87 Simple bot: its rulebook as a checklist, the rule that fired lit
      body += `<ol class="aip-rules">${d.rules.map((r) => `<li class="${r.ok ? "fired" : "no"}"><b>${r.n}</b> ${esc(r.title)} <span>${r.ok ? "✓" : "✗"} ${esc(r.why)}</span></li>`).join("")}</ol>`;
    } else if (d && !a.min) {
      const vals = AI_DIMS.map(([k]) => d.dims?.[k] || 0);
      const max = Math.max(0.5, ...vals.map(Math.abs));
      body += `<div class="aip-bars" title="${UNIT}">${AI_DIMS.map(([k, l], i) => {
        const v = vals[i];
        const w = Math.round((Math.abs(v) / max) * 100);
        return `<span class="aip-d${Math.abs(v) < 0.05 ? " zero" : ""}"><span class="aip-l">${l}</span><span class="aip-bar${v < 0 ? " neg" : ""}"><i style="width:${w}%;background:${v < 0 ? "" : p.color}"></i></span><span class="aip-v">${Math.abs(v) < 0.05 ? "–" : fmt(v)}</span></span>`;
      }).join("")}</div>`;
      if (d.offers?.length) {
        body += `<div class="aip-offers">${d.offers.slice(0, 3).map((o) => {
          const ans = o.skip ? `<em class="mute">not closer</em>` : o.answers.length ? o.answers.map((x) => `<em class="${x.ok ? "ok" : x.ok === false ? "no" : "mute"}" title="${esc(x.why || "")}">${esc(this.players[x.pid].name)} ${x.ok ? "✓" : x.ok === false ? "✗" : "?"}</em>`).join("") : `<em class="mute">no taker</em>`;
          return `<div class="aip-offer"><span>${esc(cardsText(o.give))} → ${esc(cardsText(o.get))}</span><span class="aip-gv" title="Value to its plan (${UNIT}): cards given / cards received">${sfmt(-o.given)} / ${sfmt(o.received)}</span>${ans}</div>`;
        }).join("")}</div>`;
      }
      if (d.note) body += `<p class="aip-note">${esc(d.note)}</p>`;
      if (d.alts?.length) body += `<div class="aip-alts" title="Next best options (${UNIT})">${d.alts.map((x) => `<span><b>${fmt(x.score)}</b> ${esc(x.label)}</span>`).join("")}</div>`;
    }
    if (d && !a.min && !a.stepView) body += `<button type="button" class="aip-slink aip-sgo" data-ai="steps">Step through this decision ›</button>`;
    const html = head + body;
    if (el._html !== html) {
      el.innerHTML = html; el._html = html;
      // the step strip scrolls sideways on narrow phones: keep the current step in view
      const strip = el.querySelector(".aip-shead .sx-strip"), cur = strip?.querySelector(".cur");
      if (strip && cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2);
    }
    // Phones: the hand fan overlaps the bottom of the board, so the panel sits just above it
    // (v0.83: and above a docked trade offer: on phones the offer card used to cover the bars and Pause / Step)
    const wrap = el.parentElement?.getBoundingClientRect(), hand = document.getElementById("handArea")?.getBoundingClientRect();
    // (v0.86: only when the hand lies over the board: on landscape phones it has its own column)
    let lift = wrap && hand && hand.height > 0 && hand.top < wrap.bottom && hand.bottom > wrap.top + 40 && hand.left < wrap.right - 1 && hand.right > wrap.left + 1 ? Math.max(0, wrap.bottom - hand.top) : 0;
    if (wrap) document.querySelectorAll(".rush-offers .rush-offer").forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.height > 0 && r.top < wrap.bottom && r.bottom > wrap.top + 40) lift = Math.max(lift, wrap.bottom - r.top + 4);
    });
    el.style.bottom = `${Math.round(lift + 6)}px`;
    el.dataset.held = held ? "1" : "0";
  },
};

/** "#rrggbb" + alpha → rgba() */
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function hexA(c, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(c || "");
  if (!m) return `rgba(60,117,198,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── AI Lab engine (lab.html hosts the game in iframes: index.html?lab=view shows the board, ?lab=sim
// plays headless games). In lab mode nothing is saved (index.html makes storage writes no-ops there). ──
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const LabMixin = {
  _labBoot(mode) {
    this.labMode = mode;
    this.home?.close();
    this.onboarding?.close();
    this._cancelPendingWork();
    this.onboardingHold = true; // no bot moves, no saving
    this.uiPaused = true;
    this.analysis.on = false;
    if (mode === "sim") this._labSimStubs();
  },

  _labSettings(o) {
    const H = this.constructor.labHelpers;
    return H.normalizeSettings({ ...H.DEFAULT_SETTINGS, mode: "classic", map: o.map || "random", numBots: (o.players || 4) - 1,
      board: o.sea ? "seafarers" : "island", botStyleMode: "all", allPreset: "intermediate", allStrategy: { ...H.AI_PRESETS.intermediate } });
  },

  /** A fresh board (random / balanced, optional seed), no pieces. */
  _labNewBoard(o = {}) {
    const orig = Math.random;
    if (o.seed != null && o.seed !== "") Math.random = mulberry32(Number(o.seed) || 0);
    try {
      this.settings = this._labSettings(o);
      this.onboardingHold = true;
      this.resetGame();
    } finally { Math.random = orig; }
    this._labAfterLoad();
    return true;
  },

  /** Every seat places its two start settlements + roads the way an Intermediate bot would (snake order). */
  _labAutoSetup() {
    const order = this.players.map((p) => p.id);
    const H = this.constructor.labHelpers;
    [...order, ...order.slice().reverse()].forEach((pid, i) => {
      const p = this.players[pid];
      const keep = p.strategy;
      p.strategy = keep || { ...H.AI_PRESETS.intermediate };
      const nodeId = this.getBestInitialSettlementNode(p);
      if (nodeId != null && this.placeSettlement(p, nodeId, true)) {
        if (this.sea) {
          const pc = this.sea.aiSetupPiece(p, nodeId);
          if (pc?.type === "ship") this.sea.placeShip(p, pc.id, { free: true, setupNode: nodeId });
          else if (pc) this.placeRoad(p, pc.id, { free: true, setupNode: nodeId });
        } else {
          const roadId = this.getBestRoadFromNode(p, nodeId);
          if (roadId != null) this.placeRoad(p, roadId, { free: true, setupNode: nodeId });
        }
        if (i >= order.length) this.geometry.nodes[nodeId].adjacentHexes.forEach((h) => { const r = this.geometry.hexes[h].resource; if (R5.includes(r)) this.takeFromBank(p, r, 1); });
      }
      p.strategy = keep;
    });
    this.placementAnims = [];
    this.recomputeScores();
    this.render();
  },

  /** The game in progress (the saved game of this browser), read-only. */
  _labLoadGame() {
    const ok = this.loadFromStorage();
    this._cancelPendingWork();
    this.onboardingHold = true;
    this.uiPaused = true;
    if (!ok) return false;
    this._labAfterLoad(true);
    return true;
  },

  _labAfterLoad(keepPhase = false) {
    if (!keepPhase || this.setupPhase) { this.setupPhase = false; this.setupAction = null; this.phase = "main"; }
    this.pendingAction = null;
    this.confirmBuild = null;
    this.analysis.lab = null;
    this.placementAnims = [];
    this.recomputeScores();
    this.fitView?.();
    this.render();
  },

  _labInfo() {
    return {
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, vp: p.victoryPoints, strategy: p.strategy })),
      sea: !!this.sea, big: !!this.bigBoard, turn: this.turn,
    };
  },

  /** Lab tool tap at client coordinates: place / remove a piece or move the robber. */
  _labTap(clientX, clientY, tool, pid) {
    const pt = this.getCanvasPoint({ clientX, clientY });
    const w = this.screenToWorld(pt.x, pt.y);
    const g = this.geometry, P = this.players[pid];
    if (!P) return false;
    const freeSpot = (id) => g.nodes[id].structure == null && !g.nodes[id].neighbors.some((n) => g.nodes[n].structure != null);
    if (tool === "settlement") {
      const id = this.findNodeAt(w.x, w.y, freeSpot);
      if (id == null) return false;
      Object.assign(g.nodes[id], { owner: pid, structure: "settlement" });
      P.settlements.add(id);
    } else if (tool === "city") {
      const id = this.findNodeAt(w.x, w.y, (n) => g.nodes[n].structure === "settlement");
      if (id == null) return false;
      const node = g.nodes[id];
      this.players[node.owner].settlements.delete(id);
      Object.assign(node, { owner: pid, structure: "city" });
      P.cities.add(id);
    } else if (tool === "road") {
      const id = this.findEdgeAt(w.x, w.y, (e) => g.edges[e].owner == null && !(this.sea && this.sea.edgeKind?.(e) === "sea"));
      if (id == null) return false;
      g.edges[id].owner = pid;
      P.roads.add(id);
    } else if (tool === "robber") {
      const hex = this.findHexAt(w.x, w.y);
      if (hex == null || g.hexes[hex.id ?? hex]?.resource === "sea") return false;
      this.robberHexId = hex.id ?? hex;
    } else if (tool === "erase") {
      const nid = this.findNodeAt(w.x, w.y, (n) => g.nodes[n].structure != null);
      if (nid != null) {
        const node = g.nodes[nid];
        const owner = this.players[node.owner];
        if (node.structure === "city") { owner.cities.delete(nid); owner.settlements.add(nid); node.structure = "settlement"; }
        else { owner.settlements.delete(nid); node.structure = null; node.owner = null; }
      } else {
        const eid = this.findEdgeAt(w.x, w.y, (e) => g.edges[e].owner != null);
        if (eid == null) return false;
        this.players[g.edges[eid].owner].roads.delete(eid);
        g.edges[eid].owner = null;
      }
    } else return false;
    this.placementAnims = [];
    this.recomputeScores();
    this.render();
    return true;
  },

  /** Give a seat a hand (Next build heatmap depends on it). */
  _labSetHand(pid, hand) {
    const P = this.players[pid];
    R5.forEach((r) => { const want = Math.max(0, Math.min(hand[r] || 0, this.bank[r] + P.resources[r])); this.bank[r] += P.resources[r] - want; P.resources[r] = want; });
    this.render();
  },

  /** The bot in seat `pid` with `strategy` explains `mode` ("setup" | "build" | "robber"); drawn as a heatmap. */
  _labExplain(mode, pid, strategy) {
    const P = this.players[pid];
    if (!P) return null;
    P.strategy = { ...strategy };
    let d = null;
    try {
      if (mode === "setup") d = this._aiExplainSetup(P);
      else if (mode === "robber") d = this._aiExplainRobber(P);
      else d = this._aiExplainPlan(P);
    } catch (e) { console.warn("lab explain failed", e); d = null; }
    this.analysis.lab = d || { kind: "none", pid, nodes: [] };
    this.analysis.labBase = null;
    this.requestBoardDraw();
    const tree = this._aiTree(mode, P); // v0.87: the same decision as a tree (src/ai-tree.js)
    return d && { title: d.title, score: d.score, fmt: d.fmt || null, dims: d.dims, alts: d.alts, note: d.note, rules: d.rules || null, count: (d.nodes?.length || 0) + (d.hexes?.length || 0) + (d.edges?.length || 0), tree };
  },

  /** v0.87: the board for one step of "Step through" (null: back to the heatmap of the last explain). */
  _labOverlay(o, pid) {
    if (!o) { this.analysis.lab = this.analysis.labBase || this.analysis.lab; this.requestBoardDraw(); return; }
    if (!this.analysis.labBase || this.analysis.lab?.kind !== "step") this.analysis.labBase = this.analysis.lab;
    this.analysis.lab = { kind: "step", pid, ...o };
    this.requestBoardDraw();
  },

  /** v0.87: ring one candidate the decision tree points at ({ node | city | edge | hex }, null clears). */
  _labFocus(focus) {
    if (!this.analysis.lab) return;
    this.analysis.lab.focus = focus || null;
    this.requestBoardDraw();
  },

  // ── watching quick games: the view board mirrors the sim iframe's game ──
  /** Show `src` (the sim game) on this board. `fresh`: a new game (full restore); otherwise only the
   *  pieces, robber and scores are copied, so the renderer animates what was built this turn. */
  _labWatch(src, fresh = false) {
    if (!src?.geometry) return false;
    this.onboardingHold = true;
    this.uiPaused = true;
    const same = !fresh && !src.sea && !this.sea && this.geometry && this._labWatchGen === src.gameGen && this.geometry.hexes.length === src.geometry.hexes.length;
    if (!same) {
      this.loadFromStorage(src.serializeState());
      this._labWatchGen = src.gameGen;
      this._labAfterLoad(true);
      this.analysis.lab = null;
      return true;
    }
    const g = this.geometry, sg = src.geometry;
    g.nodes.forEach((n, i) => { n.owner = sg.nodes[i].owner; n.structure = sg.nodes[i].structure; });
    g.edges.forEach((e, i) => { e.owner = sg.edges[i].owner; });
    this.robberHexId = src.robberHexId;
    src.players.forEach((sp, i) => {
      const p = this.players[i];
      if (!p) return;
      p.settlements = new Set(sp.settlements); p.cities = new Set(sp.cities); p.roads = new Set(sp.roads);
      p.resources = { ...sp.resources }; p.devCards = { ...sp.devCards };
      ["victoryPoints", "publicVictoryPoints", "devVictoryPoints", "knightsPlayed", "longestRoadLength"].forEach((k) => { p[k] = sp[k]; });
    });
    this.bank = { ...src.bank };
    this.longestRoadHolder = src.longestRoadHolder;
    this.largestArmyHolder = src.largestArmyHolder;
    this.turn = src.turn;
    this.lastRoll = src.lastRoll;
    this.analysis.lab = null;
    this.render();
    return true;
  },

  /** Seat summary of the sim game for the lab's caption. */
  _labSimInfo() {
    return { turn: this.turn, winner: this.winner ? this.winner.id : null,
      players: this.players.map((p) => ({ id: p.id, vp: p.victoryPoints, color: p.color })) };
  },

  // ── headless quick games (sim iframe) ──
  _labSimStubs() {
    const noop = () => {};
    ["render", "drawCanvasScene", "showResourceGainToasts", "_showStealAnimation", "_animateTradeCards", "_showDevCardPopup",
      "showGameOverOverlay", "pushToast", "saveToStorage", "_queueSave", "scheduleAiTurnsUntilHuman", "_renderAnalysis", "requestBoardDraw",
      "_animateCardDeal", "animateResourceGain", "_flashPrompt"].forEach((k) => { this[k] = noop; });
    this.sfx = new Proxy({}, { get: () => noop });
    this._later = (fn) => { fn(); return 0; };
    // v0.87: no board art in the headless frame (it re-baked the island for every game: ~150 ms of
    // main-thread work per tournament game, which froze the lab page)
    this.boardRenderer = null;
    const addLog = this.addLog.bind(this);
    this.addLog = (t, m) => { if (this.logEntries.length > 300) this.logEntries.splice(0, 200); return addLog(t, m); };
  },

  /** Start one headless game. `strategy`: one per seat (v0.87 tournaments), or one for seat 0 with the
   *  others Intermediate. `o.seed`: the game's own random stream (board, dice, deck: v0.87 common random
   *  numbers, so two tournament runs play the same boards); this iframe only plays lab games. */
  _labSimStart(strategy, o = {}) {
    if (o.seed != null) Math.random = mulberry32(Number(o.seed) >>> 0);
    this.settings = this._labSettings(o);
    this.onboardingHold = false;
    this.resetGame(); // set-up runs synchronously here (timers are immediate in sim mode)
    const I = this.constructor.labHelpers.AI_PRESETS.intermediate;
    this.players.forEach((p, i) => { p.isHuman = false; p.strategy = Array.isArray(strategy) ? { ...(strategy[i] || I) } : i === 0 ? { ...strategy } : { ...I }; });
    if (this.setupPhase && this.setupAction) { this.setupAction = null; this.processSetupQueue(); }
    this._labSim = { guard: 0 };
    return true;
  },

  /** Run up to `n` turns; { done, winner (seat or null), turns }. */
  _labSimStep(n = 40) {
    const s = this._labSim;
    for (let k = 0; k < n && !this.winner; k += 1) {
      if (s.guard++ > 2500 || this.turn > 250) return { done: true, winner: null, turns: this.turn };
      if (this.phase === "sbp") { this._sbpRun(); continue; }
      const p = this.currentPlayer;
      if (this.phase === "pre_roll") {
        this.maybePlayKnightBeforeRoll(p);
        this.executeRollPhase(p);
      }
      if (this.winner) break;
      if (this.phase === "main") this.executeAiMainPhase(p);
      if (this.winner) break;
      this.endTurn();
    }
    return { done: !!this.winner, winner: this.winner ? this.winner.id : null, turns: this.turn };
  },
};
