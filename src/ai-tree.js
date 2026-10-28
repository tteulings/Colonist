// AI Lab decision tree (v0.87): how a bot decides in the current position, as a tree of what it
// considered. Root → the options it weighs (play a card, trade with players, each kind of build, bank
// trade, end turn) → the candidates (spots, towns, tiles) → each candidate's score split into its terms,
// with the lab weight ("Calculation" slider) that scales each term.
//
// Everything is read from the same functions that make the move (_aiPlan, _aiSetupCandidates,
// _aiRobberCandidates, _aiBankTradePick, _aiTryPlayerTrade in dry mode, getNodeProductionScore's term
// split) and nothing is changed, so the tree always shows the move the bot would really make.
//
// Node: { id, label, sub, v, vt: "score"|"signed"|"div"|"none", text, bar, w, chosen, tag, focus, children }

const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const RES_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, development: { sheep: 1, wheat: 1, ore: 1 } };
const DEV = { knight: "Knight", monopoly: "Monopoly", yearOfPlenty: "Year of Plenty", roadBuilding: "Road Building" };
// getNodeProductionScore terms: [key, label, lab weight]
const SPOT_TERMS = [["num", "Numbers", "num"], ["scarcity", "Scarcity", "scarcity"], ["variety", "Variety", "variety"], ["port", "Port", "port"],
  ["sets", "Resource sets", null], ["contest", "Contested spot", null], ["magnet", "Robber magnet", null]];
const has = (h, c) => Object.entries(c).every(([r, n]) => (h[r] || 0) >= n);
const cards = (h) => R5.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RES_LABEL[r]}`).join(" + ") || "nothing";
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const node = (o) => ({ children: [], vt: "score", ...o });
const term = (id, label, v, w = null, sub = "") => node({ id, label, sub, v, vt: "signed", bar: v, w, term: true });

export const TreeMixin = {
  /** The decision tree for `mode` ("setup" | "build" | "robber") of `player` with its current strategy. */
  _aiTree(mode, player) {
    try {
      if (mode === "setup") return this._treeSetup(player);
      if (mode === "robber") return this._treeRobber(player);
      return this._treeTurn(player);
    } catch (e) { console.warn("decision tree failed", e); return null; }
  },

  _treeSpotTerms(player, nodeId, profile, idp) {
    const parts = { terms: {} };
    const s = this.getNodeProductionScore(nodeId, player, profile, parts);
    const out = SPOT_TERMS.filter(([k]) => Math.abs(parts.terms[k] || 0) > 0.005).map(([k, l, w]) => term(`${idp}:${k}`, l, parts.terms[k], w));
    return { score: s, terms: out };
  },

  _treeSpot(player, nodeId, score, chosen, idp = "spot") {
    const { terms } = this._treeSpotTerms(player, nodeId, null, `${idp}:${nodeId}`);
    return node({ id: `${idp}:${nodeId}`, label: `Spot ${this._spotLabel(nodeId)}`, v: score, bar: score, chosen, tag: chosen ? "chosen" : null, focus: { node: nodeId }, children: terms });
  },

  // ── set-up: every free spot, scored by getNodeProductionScore ──
  _treeSetup(P) {
    const cands = this._aiSetupCandidates(P);
    let best = null;
    cands.forEach((c) => { if (!best || c.score > best.score) best = c; }); // same pick as getBestInitialSettlementNode
    if (!best) return null;
    const sorted = cands.slice().sort((a, b) => b.score - a.score || (a.id === best.id ? -1 : b.id === best.id ? 1 : 0));
    const kids = sorted.slice(0, 6).map((c) => this._treeSpot(P, c.id, c.score, c.id === best.id));
    const rest = sorted.slice(6);
    if (rest.length) kids.push(node({ id: "spot:more", label: `${rest.length} more spots`, sub: "ranked lower", vt: "none",
      children: rest.map((c) => node({ id: `spot:${c.id}`, label: `Spot ${this._spotLabel(c.id)}`, v: c.score, bar: c.score, focus: { node: c.id }, leafish: true })) }));
    const root = node({ id: "root", label: "Start settlement", sub: `${cands.length} spots`, vt: "none", chosen: true, children: kids });
    return { root, action: `Settlement on ${this._spotLabel(best.id)}`, score: best.score, pick: { node: best.id },
      eq: "Spot score = numbers + scarcity + variety + port (+ the Complex terms). The highest spot wins." };
  },

  // ── robber: every legal tile ──
  _treeRobber(P) {
    if (this.sea) return { root: node({ id: "root", label: "Robber or pirate", sub: "by expected damage", vt: "none", chosen: true }), action: "Robber or pirate", score: null, eq: "Seafarers: the thief is not split into terms here." };
    const cands = this._aiRobberCandidates(P);
    if (!cands.length) return null;
    let best = null;
    cands.forEach((c) => { if (!best || c.score > best.score) best = c; }); // same pick as chooseRobberHex
    const sorted = cands.slice().sort((a, b) => b.score - a.score || (a.id === best.id ? -1 : b.id === best.id ? 1 : 0));
    const hexKid = (c, full) => {
      const p = c.parts;
      const owners = [...new Set(this.geometry.hexes[c.id].nodes.map((n) => this.geometry.nodes[n].owner).filter((o) => o != null))].map((o) => this.players[o]?.name).filter(Boolean);
      const ch = !full ? [] : [
        term(`hex:${c.id}:block`, "Blocked cards", p.block, null, "over ~10 rolls"),
        term(`hex:${c.id}:leader`, "Leader weighting", p.leader, "leader"),
        term(`hex:${c.id}:own`, "Own tiles", p.own),
        term(`hex:${c.id}:steal`, "Steal", p.steal, "leader"),
      ].filter((t) => Math.abs(t.v) > 0.005);
      return node({ id: `hex:${c.id}`, label: this._hexName(c.id), sub: owners.length ? owners.join(", ") : "nobody", v: c.score, bar: c.score, chosen: c.id === best.id, tag: c.id === best.id ? "chosen" : null, focus: { hex: c.id }, children: ch, leafish: !full });
    };
    const kids = sorted.slice(0, 6).map((c) => hexKid(c, true));
    if (sorted.length > 6) kids.push(node({ id: "hex:more", label: `${sorted.length - 6} more tiles`, sub: "ranked lower", vt: "none", children: sorted.slice(6).map((c) => hexKid(c, false)) }));
    const root = node({ id: "root", label: "Move robber", sub: `${cands.length} tiles`, vt: "none", chosen: true, children: kids });
    return { root, action: `Robber on ${this._hexName(best.id)}`, score: best.score, pick: { hex: best.id },
      eq: "Tile score = cards blocked (× leader weighting) − own cards blocked + the steal." };
  },

  // ── a turn: the steps in the order the bot takes them ──
  _treeTurn(P) {
    const strat = this._aiStrat(P);
    const plan = this._aiPlan(P);
    const kids = [];
    const cardStep = this._treeCards(P, strat);
    const tradeStep = this._treePlayerTrade(P, strat);
    kids.push(cardStep.node, tradeStep.node);
    let act, goal0 = plan.goals[0] || null, doing = null, bankPick = null;
    if (strat.expansion === "simple") {
      const s = this._treeSimple(P, strat);
      kids.push(...s.nodes);
      act = s.act;
      doing = s.doing;
    } else {
      const over = this._aiOverLimit(P);
      if (!goal0) act = "end";
      else if (has(P.resources, this._aiStepCost(goal0))) act = "build";
      else {
        bankPick = this._aiBankTradePick(P, plan, goal0);
        if (bankPick.trades) act = "bank";
        else {
          for (const side of plan.goals.slice(1)) {
            const step = this._aiStepCost(side);
            if (!has(P.resources, step)) continue;
            const after = { ...P.resources };
            R5.forEach((r) => { after[r] -= step[r] || 0; });
            const delay = this._aiEta(goal0.cost, after, plan.incTurn, plan.rates) - goal0.eta;
            if (delay <= plan.W.sideBuildDelay || over) { act = "side"; doing = side; break; }
          }
          act = act || "end";
        }
      }
      kids.push(...this._treeGoals(P, plan, goal0, act, doing));
      if (strat.trading !== "none") {
        const bp = bankPick || (goal0 ? this._aiBankTradePick(P, plan, goal0) : { trades: null, why: "nothing to trade for" });
        const doesBank = act === "bank";
        kids.push(node({ id: "bank", label: "Bank trade", vt: "none", chosen: doesBank, tag: doesBank ? "now" : null,
          sub: doesBank ? `toward ${goal0.label}` : act === "build" ? "not needed: it can pay now" : bp.why || "no useful trade",
          children: (bp.trades || []).map(([give, get], i) => node({ id: `bank:${i}`, label: `${plan.rates[give]} ${RES_LABEL[give]} → 1 ${RES_LABEL[get]}`, sub: `${plan.rates[give]}:1`, vt: "none" })) }));
      }
    }
    const ends = act === "end";
    kids.push(node({ id: "end", label: "End turn", vt: "none", chosen: ends, tag: ends ? "now" : null,
      sub: ends ? (goal0 ? `saving for ${goal0.label}${goal0.eta ? ` (~${f1(goal0.eta)} turns)` : ""}` : "nothing to build") : "only when nothing else fits" }));
    const first = [cardStep.does, tradeStep.does].filter(Boolean);
    const what = act === "build" ? (goal0.type === "settlement" && goal0.dist > 0 ? `Road toward ${this._spotLabel(goal0.nodeId)}` : goal0.label)
      : act === "bank" ? `Bank trade toward ${goal0.label}` : act === "side" ? `${doing.type === "settlement" && doing.dist > 0 ? `Road toward ${this._spotLabel(doing.nodeId)}` : doing.label} (side build)` : act === "simple" ? doing : "Ends turn";
    const root = node({ id: "root", label: `${P.name}'s turn`, sub: `${kids.length} options`, vt: "none", chosen: true, children: kids });
    const txt = [...first, what].join(", then ");
    return { root, action: txt.charAt(0).toUpperCase() + txt.slice(1), target: goal0 ? goal0.label : null, score: goal0 ? goal0.score : null,
      eq: strat.expansion === "simple" ? "Simple expansion builds in a fixed order: the first thing it can afford."
        : `Steps run top to bottom. Build score = (points + production) ÷ (turns to afford + ${f1(plan.W.etaOffset)}).` };
  },

  _treeCards(P, strat) {
    const held = Object.keys(DEV).filter((t) => (P.devCards?.[t] || 0) > 0);
    const fresh = Object.keys(DEV).filter((t) => (P.newDevCards?.[t] || 0) > 0);
    if (strat.devCards === "none") return { node: node({ id: "cards", label: "Play a card", sub: "never plays cards", vt: "none" }) };
    if (!held.length) return { node: node({ id: "cards", label: "Play a card", sub: fresh.length ? "only cards bought this turn" : "none in hand", vt: "none" }) };
    let does = null;
    const kids = [];
    // same order and tests as maybePlayBestDevCard
    if (held.includes("knight")) {
      const why = this._aiKnightReason(P);
      if (why && !does) does = "knight";
      kids.push(node({ id: "card:knight", label: "Knight", sub: why || "holds it", vt: "none", chosen: does === "knight" }));
    }
    if (held.includes("monopoly")) {
      const pick = this._aiMonopolyPick(P);
      const ok = this.shouldPlayMonopoly(P);
      if (ok && !does) does = "monopoly";
      kids.push(node({ id: "card:monopoly", label: "Monopoly", sub: `${RES_LABEL[pick.resource]}: ~${f1(pick.count)} cards, worth ${f1(pick.value)}${ok ? "" : " (not enough)"}`, v: pick.value, bar: pick.value, chosen: does === "monopoly" }));
    }
    if (held.includes("yearOfPlenty")) {
      const ok = this.shouldPlayYearOfPlenty(P);
      if (ok && !does) does = "yearOfPlenty";
      kids.push(node({ id: "card:yop", label: "Year of Plenty", sub: `${this.chooseYearOfPlentyResources(P).map((r) => RES_LABEL[r]).join(" + ")}${ok ? "" : " · holds it"}`, vt: "none", chosen: does === "yearOfPlenty" }));
    }
    if (held.includes("roadBuilding")) {
      const ok = this.shouldPlayRoadBuilding(P);
      if (ok && !does) does = "roadBuilding";
      kids.push(node({ id: "card:rb", label: "Road Building", sub: ok ? "two free roads toward its plan" : "holds it", vt: "none", chosen: does === "roadBuilding" }));
    }
    return { does: does ? `plays ${DEV[does]}` : null,
      node: node({ id: "cards", label: "Play a card", sub: does ? `plays ${DEV[does]} first` : "holds its cards", vt: "none", chosen: !!does, tag: does ? "first" : null, children: kids }) };
  },

  _treePlayerTrade(P, strat) {
    if (strat.trading === "none" || strat.trading === "conservative") return { node: node({ id: "deal", label: "Trade with players", sub: strat.trading === "none" ? "never trades" : "bank and ports only", vt: "none" }) };
    const log = { offers: [] };
    const res = this._aiTryPlayerTrade(P, { dry: true }, log);
    const kids = log.offers.map((o, i) => node({ id: `deal:${i}`, label: `${cards(o.give)} → ${cards(o.get)}`, vt: "none",
      sub: o.skip ? `not closer (${f1(o.eta0)} → ${f1(o.eta)} turns)` : o.answers.length ? o.answers.map((a) => `${this.players[a.pid].name} ${a.ok ? "✓" : `✗ ${a.why}`}`).join(" · ") : "nobody likely holds it",
      chosen: !!(res?.dry && res.give === o.give) }));
    const sub = res?.dry ? `deals with ${res.partner.name} first` : log.offers.length ? "no deal" : "nothing to ask for";
    return { does: res?.dry ? `trades with ${res.partner.name}` : null,
      node: node({ id: "deal", label: "Trade with players", sub, vt: "none", chosen: !!res?.dry, tag: res?.dry ? "first" : null, children: kids }) };
  },

  // Plan goals grouped by kind; each goal split into points / production / turns, settlement spots into their terms
  _treeGoals(P, plan, goal0, act, side) {
    const kinds = [["settlement", "Build settlement"], ["city", "Build city"], ["road", "Longest Road"], ["dev", "Buy dev card"]];
    const profile = this.getResourceIncomeProfile(P);
    const pen = plan.W.roadPenalty[plan.strat.expansion] ?? plan.W.roadPenalty.medium;
    const out = [];
    const goalNode = (g, i) => {
      const id = `goal:${g.type}:${g.nodeId ?? g.edge ?? i}`;
      const p = g.parts || { vp: g.vp, prod: 0, horizon: 0, win: 0 };
      const ch = [];
      if (g.type === "dev") {
        ch.push(term(`${id}:card`, "Card value", plan.W.devCard, "card"));
        if (Math.abs(p.vp - plan.W.devCard) > 0.005) ch.push(term(`${id}:strat`, "Army race / last points", p.vp - plan.W.devCard, "card"));
      } else ch.push(term(`${id}:vp`, "Points", p.vp));
      if (Math.abs(p.prod + p.horizon) > 0.005) ch.push(term(`${id}:prod`, "Production", p.prod + p.horizon, "prod", `${(g.prod || 0).toFixed(2)} cards/roll`));
      if (p.win) ch.push(term(`${id}:win`, "Wins the game", p.win));
      ch.push(node({ id: `${id}:eta`, label: "Turns to afford", sub: `${f1(g.eta)} + ${f1(plan.W.etaOffset)}`, v: g.eta + plan.W.etaOffset, vt: "div", w: "patience", term: true }));
      if (g.type === "settlement" && g.via !== "ship") {
        const t = this._treeSpotTerms(P, g.nodeId, profile, `${id}:why`);
        const kidsW = t.terms;
        if (g.dist) kidsW.push(term(`${id}:why:dist`, "Road distance", -g.dist * pen, "road", `${g.dist} road${g.dist > 1 ? "s" : ""}`));
        if (plan.strat.expansion === "complex" && plan.strat.placement === "simple") {
          const kP = plan.strat.w?.port ?? 1;
          const x = this.geometry.nodes[g.nodeId].ports.reduce((a, type) => a + (type === "any" ? 0.3 : profile[type] >= 0.12 ? 0.8 : 0) * kP, 0);
          if (x) kidsW.push(term(`${id}:why:xport`, "Port (expansion)", x, "port"));
        }
        const h = kidsW.reduce((a, k) => a + k.v, 0);
        ch.push(node({ id: `${id}:why`, label: "Why this spot", sub: "spot rank", v: h, bar: h, children: kidsW }));
      }
      const label = g.type === "settlement" ? `Spot ${this._spotLabel(g.nodeId)}` : g.type === "city" ? `City on ${this._spotLabel(g.nodeId)}` : g.type === "road" ? "Extend the road" : "Development card";
      const sub = g.type === "settlement" ? (g.dist ? `+${g.dist} road${g.dist > 1 ? "s" : ""}${g.via === "ship" ? " (ships)" : ""}` : "reachable now") : g.eta === 0 ? "affordable now" : `~${f1(g.eta)} turns`;
      const focus = g.type === "settlement" ? { node: g.nodeId, edge: g.dist ? g.edge : null } : g.type === "city" ? { city: g.nodeId } : g.type === "road" ? { edge: g.edge } : null;
      const isPlan = g === goal0, isSide = g === side;
      return node({ id, label, sub, v: g.score, bar: g.score, chosen: isPlan, tag: isPlan ? (act === "build" ? "chosen" : "plan") : isSide ? "now" : null, focus, children: ch });
    };
    kinds.forEach(([type, label]) => {
      const gs = plan.goals.map((g, i) => [g, i]).filter(([g]) => g.type === type);
      if (!gs.length) return;
      const kids = gs.map(([g, i]) => goalNode(g, i));
      if (type === "settlement" && plan.spots?.length > gs.length) {
        const inGoals = new Set(gs.map(([g]) => g.nodeId));
        const more = plan.spots.filter((s) => !inGoals.has(s.nodeId));
        if (more.length) kids.push(node({ id: "goal:settlement:more", label: `${more.length} more spots in reach`, sub: "spot rank, not planned", vt: "none",
          children: more.map((s) => node({ id: `rank:${s.nodeId}`, label: `Spot ${this._spotLabel(s.nodeId)}`, sub: s.d ? `+${s.d} road${s.d > 1 ? "s" : ""}` : "", v: s.h, bar: s.h, focus: { node: s.nodeId }, leafish: true })) }));
      }
      const top = Math.max(...gs.map(([g]) => g.score));
      const has0 = gs.some(([g]) => g === goal0), hasSide = gs.some(([g]) => g === side);
      out.push(node({ id: `kind:${type}`, label, v: top, bar: top, chosen: has0, tag: has0 ? (act === "build" ? "chosen" : "plan") : hasSide ? "now" : null,
        sub: gs.length > 1 ? `best of ${gs.length}` : "", children: kids }));
    });
    // kinds it can't plan right now
    if (!plan.goals.some((g) => g.type === "city") && this.piecesLeft(P, "city") > 0) out.push(node({ id: "kind:city", label: "Build city", sub: P.settlements.size ? "no city left to place" : "no town to upgrade", vt: "none" }));
    if (!plan.goals.some((g) => g.type === "dev") && plan.strat.devCards !== "none") out.push(node({ id: "kind:dev", label: "Buy dev card", sub: this.devDeck.length ? "not considered" : "deck is empty", vt: "none" }));
    return out;
  },

  // Simple expansion: the fixed order of _getActionPriority (what it can afford first)
  _treeSimple(P, strat) {
    const h = P.resources;
    const spots = has(h, COST.settlement) ? this.getBuildableSettlementNodes(P).sort((a, b) => b.score - a.score) : [];
    const city = has(h, COST.city) ? this.getBestCityTarget(P) : null;
    const roadOk = has(h, COST.road) && !(has(h, COST.settlement) && this.getBuildableSettlementNodes(P).length) && this.chooseStrategicRoadEdge(P, false) != null;
    const devOk = strat.devCards !== "none" && this.devDeck.length > 0 && has(h, COST.development);
    let bankOk = false;
    try { const plan = this._aiPlan(P); bankOk = !!(plan.goals[0] && this._aiBankTradePick(P, plan, plan.goals[0]).trades); } catch (_) { bankOk = false; }
    const steps = [
      ["settlement", "Build settlement", spots.length > 0, spots.length ? `best of ${spots.length}` : "can't afford / no spot"],
      ["city", "Build city", city != null, city != null ? `on ${this._spotLabel(city)} (biggest numbers)` : "can't afford"],
      ["road", "Build road", roadOk, roadOk ? "toward the nearest good spot" : "not now"],
      ["dev", "Buy dev card", devOk, devOk ? "spare cards" : "can't afford"],
      ["bank", "Bank trade", bankOk, bankOk ? "toward its next build" : "no useful trade"],
    ];
    const firstOk = steps.find((s) => s[2]);
    const nodes = steps.map(([k, label, ok, sub]) => {
      const chosen = firstOk && firstOk[0] === k;
      const kids = k === "settlement" ? spots.slice(0, 5).map((c, i) => this._treeSpot(P, c.nodeId, c.score, chosen && i === 0, "sspot")) : [];
      return node({ id: `simple:${k}`, label, sub, vt: "none", chosen, tag: chosen ? "now" : null, off: !ok, children: kids, focus: k === "city" && city != null ? { city } : null });
    });
    return { nodes, act: firstOk ? "simple" : "end", doing: firstOk ? firstOk[1] : null };
  },
};
