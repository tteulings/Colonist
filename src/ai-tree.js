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
const RULES = [[1, "City", "can build a city"], [2, "Settlement", "can build a settlement"], [3, "Knight", "robber on its tile + a Knight"], [4, "Road", "can build a road"],
  [5, "Dev card", "can buy a dev card"], [6, "Bank trade", "one trade completes a build"], [7, "End turn", "nothing matched"]];
const term = (id, label, v, w = null, sub = "") => node({ id, label, sub, v, vt: "signed", bar: v, w, term: true });

export const TreeMixin = {
  /** The decision tree for `mode` ("setup" | "build" | "robber") of `player` with its current strategy. */
  /** `opts.planOnly`: in-game analysis, the build plan only (the card and trade steps of that turn are
   *  decisions of their own, already noted), so nothing reads public card estimates out of turn. */
  _aiTree(mode, player, opts = {}) {
    try {
      const rules = player?.strategy?.policy === "rules";
      let t;
      if (mode === "setup") t = rules ? this._treeRulesSetup(player) : this._treeSetup(player);
      else if (mode === "robber") t = rules && !this.sea ? this._treeRulesRobber(player) : this._treeRobber(player);
      else t = rules ? this._treeRules(player) : this._treeTurn(player, opts);
      if (t) { t.mode = mode; t.steps = this._treeSteps(t, player); delete t.data; }
      return t;
    } catch (e) { console.warn("decision tree failed", e); return null; }
  },

  // ── Simple (rulebook) bot: the checklist instead of a score tree ──
  _treeRules(P) {
    const list = this._rulesCheck(P);
    const fired = list[list.length - 1];
    const kids = RULES.map(([n, title, text]) => {
      const r = list.find((x) => x.n === n);
      return node({ id: `rule:${n}`, label: `${n} · ${title}`, sub: r ? r.why : `not reached (${text})`, vt: "none", rule: true, ok: r ? r.ok : null,
        chosen: r === fired, tag: r === fired ? (n === 7 ? "now" : "chosen") : null, off: !r, focus: r?.focus || null });
    });
    const root = node({ id: "root", label: "Rulebook", sub: "first matching rule fires", vt: "none", chosen: true, children: kids });
    return { root, action: `Rule ${fired.n} · ${fired.why}`, score: null, rules: true, pick: fired.focus || {},
      eq: "No scores: the rules are checked top to bottom and the first that matches is what it does.", data: { list } };
  },
  _treeRulesSetup(P) {
    const ids = this._rulesSetupSpots(P);
    const b = this._rulesSetupSpot(P);
    if (!b) return null;
    const sorted = ids.map((id) => ({ id, pips: this._rulesPips(id), kinds: this._rulesKinds(id) })).sort((x, y) => y.pips - x.pips || y.kinds - x.kinds || x.id - y.id);
    const kids = sorted.slice(0, 8).map((c) => node({ id: `spot:${c.id}`, label: `Spot ${this._spotLabel(c.id)}`, sub: `${c.kinds} resource${c.kinds === 1 ? "" : "s"}`, v: c.pips, bar: c.pips, vt: "score",
      chosen: c.id === b.id, tag: c.id === b.id ? "chosen" : null, focus: { node: c.id } }));
    const root = node({ id: "root", label: "Start settlement", sub: "rule: most pips, tie → more resources", vt: "none", chosen: true, children: kids });
    return { root, action: `Settlement on ${b.pips} pips (${this._spotLabel(b.id)})`, score: b.pips, rules: true, pick: { node: b.id },
      eq: "Pips = how many of the 36 dice rolls pay this spot. No other terms.", data: { sorted, best: b } };
  },
  _treeRulesRobber(P) {
    const r = this._rulesRobber(P);
    if (!r.pick) return null;
    const sorted = r.cands.slice().sort((a, b) => (a.own - b.own) || b.lead - a.lead || b.any - a.any);
    const kids = sorted.slice(0, 8).map((c) => node({ id: `hex:${c.id}`, label: this._hexName(c.id), sub: c.own ? "its own tile: never" : `${r.leader?.name || "leader"}: ${c.lead} pips`, v: c.lead, bar: c.lead,
      chosen: c.id === r.pick.id, tag: c.id === r.pick.id ? "chosen" : null, off: c.own, focus: { hex: c.id } }));
    const root = node({ id: "root", label: "Move robber", sub: `rule: the leader's tile with the most pips`, vt: "none", chosen: true, children: kids });
    return { root, action: `Robber on ${this._hexName(r.pick.id)}, steals from ${r.leader?.name || "the leader"}`, score: r.pick.lead, rules: true, pick: { hex: r.pick.id },
      eq: `Leader = most public points (${r.leader ? `${r.leader.name}, ${r.leader.publicVictoryPoints}` : "–"}). Pips count double on a city.`, data: { r, sorted } };
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
    return { root, action: `Settlement on ${this._spotLabel(best.id)}`, score: best.score, pick: { node: best.id }, data: { sorted, best, P },
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
    return { root, action: `Robber on ${this._hexName(best.id)}`, score: best.score, pick: { hex: best.id }, data: { sorted, best, awareness: this._aiStrat(P).awareness },
      eq: "Tile score = cards blocked (× leader weighting) − own cards blocked + the steal." };
  },

  // ── a turn: the steps in the order the bot takes them ──
  _treeTurn(P, opts = {}) {
    const strat = this._aiStrat(P);
    const plan = this._aiPlan(P);
    const kids = [];
    const cardStep = opts.planOnly ? { node: null } : this._treeCards(P, strat);
    const tradeStep = opts.planOnly ? { node: null } : this._treePlayerTrade(P, strat);
    if (!opts.planOnly) kids.push(cardStep.node, tradeStep.node);
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
        : `Steps run top to bottom. Build score = (points + production) ÷ (turns to afford + ${f1(plan.W.etaOffset)}).`,
      data: { P, strat, plan, goal0, act, doing, bankPick, kids, cardStep, tradeStep, what } };
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

  // ── step through: the same decision as an ordered sequence (each step says what it looks at and what
  // the board shows: { title, sub, text, rows: [{ label, sub, v, vt, bar, chosen, ok }], overlay, cycle }) ──
  _treeSteps(t, P) {
    const d = t.data || {};
    const S = [];
    const add = (o) => S.push({ rows: [], overlay: {}, ...o });
    const choice = (text, overlay) => add({ title: "Choice", sub: text, text: `${text}${t.score != null && !t.rules ? ` · score ${f1(t.score)}` : ""}`, overlay: { ...overlay, pick: t.pick || {}, focus: t.pick && Object.keys(t.pick).length ? t.pick : null } });
    if (t.mode === "setup" && t.rules) {
      const all = d.sorted;
      add({ title: "Free spots", sub: `${all.length} spots it may settle`, text: "Every corner with no building on it or next to it.", overlay: { nodes: all.map((c) => ({ id: c.id, s: c.pips })) } });
      add({ title: "Count the pips", sub: "dice rolls that pay each spot", rows: all.slice(0, 6).map((c) => ({ label: `Spot ${this._spotLabel(c.id)}`, sub: `${c.kinds} resources`, v: c.pips, vt: "score", bar: c.pips, chosen: c.id === d.best.id })),
        overlay: { nodes: all.slice(0, 6).map((c) => ({ id: c.id, s: c.pips })) }, cycle: all.slice(0, 6).map((c) => ({ node: c.id })) });
      choice(`${d.best.pips} pips: the most${all.filter((c) => c.pips === d.best.pips).length > 1 ? `, tie → ${d.best.kinds} resources` : ""}`, { nodes: [{ id: d.best.id, s: 1 }] });
      return S;
    }
    if (t.mode === "setup") {
      const all = d.sorted, top = all.slice(0, 6);
      add({ title: "Free spots", sub: `${all.length} spots it may settle`, text: "Every corner with no building on it or next to it, glowing by score.", overlay: { nodes: all.map((c) => ({ id: c.id, s: c.score })) } });
      add({ title: "Score each spot", sub: "numbers + scarcity + variety + port", rows: top.map((c) => ({ label: `Spot ${this._spotLabel(c.id)}`, v: c.score, vt: "score", bar: c.score, chosen: c.id === d.best.id })),
        overlay: { nodes: top.map((c) => ({ id: c.id, s: c.score })) }, cycle: top.map((c) => ({ node: c.id })) });
      const bestNode = t.root.children.find((n) => n.chosen);
      add({ title: "The best spot, term by term", sub: `Spot ${this._spotLabel(d.best.id)}`, rows: (bestNode?.children || []).map((x) => ({ label: x.label, v: x.v, vt: "signed", bar: x.v, w: x.w })), overlay: { nodes: [{ id: d.best.id, s: 1 }], focus: { node: d.best.id } } });
      choice(`Settlement on ${this._spotLabel(d.best.id)}`, { nodes: [{ id: d.best.id, s: 1 }] });
      return S;
    }
    if (t.mode === "robber" && t.rules) {
      const { r, sorted } = d;
      add({ title: "Find the leader", sub: r.leader ? `${r.leader.name}: ${r.leader.publicVictoryPoints} points` : "no leader", text: "The leader is the opponent with the most public points." });
      add({ title: "Leader's pips per tile", sub: "never a tile with its own building", rows: sorted.slice(0, 6).map((c) => ({ label: this._hexName(c.id), sub: c.own ? "own tile" : "", v: c.lead, vt: "score", bar: c.lead, chosen: c.id === r.pick.id, ok: c.own ? false : null })),
        overlay: { hexes: r.cands.filter((c) => !c.own).map((c) => ({ id: c.id, s: c.lead, dmg: null })) }, cycle: sorted.slice(0, 6).filter((c) => !c.own).map((c) => ({ hex: c.id })) });
      choice(`Robber on ${this._hexName(r.pick.id)}`, { hexes: [{ id: r.pick.id, s: 1, dmg: null }] });
      add({ title: "Steal", sub: `from ${r.leader?.name || "the leader"}`, text: "Rule: it always steals from the leader (most public points) when the leader is on the tile." });
      return S;
    }
    if (t.mode === "robber") {
      if (!d.sorted) { add({ title: "Robber or pirate", sub: "by expected damage" }); return S; }
      const { sorted, best, awareness } = d;
      add({ title: "Legal tiles", sub: `${sorted.length} tiles`, text: "Every tile the robber may move to, shaded by score.", overlay: { hexes: sorted.map((c) => ({ id: c.id, s: c.score, dmg: c.dmg })) } });
      add({ title: "Cards blocked per tile", sub: "over the ~10 rolls the robber stays", rows: sorted.slice().sort((a, b) => b.parts.block - a.parts.block).slice(0, 6).map((c) => ({ label: this._hexName(c.id), v: c.parts.block, vt: "score", bar: c.parts.block, chosen: c.id === best.id })),
        overlay: { hexes: sorted.slice(0, 6).map((c) => ({ id: c.id, s: c.parts.block, dmg: c.dmg })) }, cycle: sorted.slice(0, 6).map((c) => ({ hex: c.id })) });
      const p = best.parts;
      add({ title: "Weigh who it hurts", sub: awareness === "none" ? "everyone counts the same" : awareness === "basic" ? "more points → more weight" : "the leader counts most",
        rows: [["Blocked cards", p.block], ["Leader weighting", p.leader, "leader"], ["Own tiles", p.own], ["Steal", p.steal, "leader"]].filter((x) => Math.abs(x[1]) > 0.005).map(([label, v, w]) => ({ label, v, vt: "signed", bar: v, w })),
        rows2: sorted.slice(0, 5).map((c) => ({ label: this._hexName(c.id), v: c.score, vt: "score", bar: c.score, chosen: c.id === best.id })), overlay: { hexes: [{ id: best.id, s: 1, dmg: best.dmg }], focus: { hex: best.id } } });
      choice(`Robber on ${this._hexName(best.id)}`, { hexes: [{ id: best.id, s: 1, dmg: best.dmg }] });
      add({ title: "Steal", sub: awareness === "none" ? "a random player on the tile" : awareness === "basic" ? "the biggest hand on the tile" : "the leader, or who likely holds what it needs",
        text: "It steals from one player with a building on the tile (public card counts only, never hidden hands)." });
      return S;
    }
    if (t.rules) {
      d.list.forEach((r) => add({ title: `Rule ${r.n} · ${r.title}`, sub: `${r.ok ? "✓" : "✗"} ${r.why}`, ok: r.ok, overlay: r.focus ? { nodes: r.focus.node != null ? [{ id: r.focus.node, s: 1 }] : [], cities: r.focus.city != null ? [{ id: r.focus.city, s: 1 }] : [], edges: r.focus.edge != null ? [{ id: r.focus.edge, s: 1 }] : [], hexes: r.focus.hex != null ? [{ id: r.focus.hex, s: 1, dmg: null }] : [], focus: r.focus, pick: r.focus } : {} }));
      const f = d.list[d.list.length - 1];
      add({ title: "Action", sub: f.n === 7 ? "ends the turn" : `rule ${f.n} fires`, text: f.why, overlay: S[S.length - 1].overlay });
      return S;
    }
    // a scoring bot's turn
    const { P: Pl, plan, goal0, act, bankPick } = d;
    const h = Pl.resources;
    const handTxt = R5.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RES_LABEL[r]}`).join(" + ") || "no cards";
    add({ title: "Hand", sub: handTxt, rows: [["Road", COST.road], ["Settlement", COST.settlement], ["City", COST.city], ["Dev card", COST.development]].map(([l, c]) => {
      const miss = R5.filter((r) => (c[r] || 0) > h[r]).map((r) => `${c[r] - h[r]} ${RES_LABEL[r]}`).join(" + ");
      return { label: l, sub: miss ? `needs ${miss}` : "can afford now", vt: "none", ok: !miss };
    }) });
    add({ title: "Options", sub: "what it weighs, in the order it acts", rows: d.kids.map((k) => ({ label: k.label, sub: k.sub || "", v: k.v, vt: k.vt === "score" ? "score" : "none", bar: k.bar, chosen: k.chosen })) });
    if (act !== "simple" && plan.goals.length) {
      const spots = plan.spots || [];
      if (spots.length) {
        const top = spots.slice(0, 8);
        add({ title: "Option · settlement spots", sub: `${spots.length} in reach, ranked by spot score − roads`, rows: top.map((x) => ({ label: `Spot ${this._spotLabel(x.nodeId)}`, sub: x.d ? `+${x.d} road${x.d > 1 ? "s" : ""}` : "", v: x.h, vt: "score", bar: x.h, chosen: goal0 && goal0.nodeId === x.nodeId && goal0.type === "settlement" })),
          overlay: { nodes: spots.map((x) => ({ id: x.nodeId, s: x.h })) }, cycle: top.map((x) => ({ node: x.nodeId })) });
      }
      const towns = [...Pl.settlements];
      if (towns.length && plan.goals.some((g) => g.type === "city")) {
        const rows = towns.map((id) => ({ id, prod: this._aiNodeProd(id, plan.inc) })).sort((a, b) => b.prod - a.prod);
        add({ title: "Option · city", sub: "the town that produces most", rows: rows.map((x) => ({ label: `Town ${this._spotLabel(x.id)}`, sub: "cards per roll", v: x.prod, vt: "score", bar: x.prod, chosen: rows[0].id === x.id })),
          overlay: { cities: rows.map((x) => ({ id: x.id, s: x.prod })) }, cycle: rows.map((x) => ({ city: x.id })) });
      }
      const dev = plan.goals.find((g) => g.type === "dev");
      if (dev) add({ title: "Option · dev card", sub: `worth ${f1(dev.vp)} points to it`, rows: [{ label: "Card value", v: plan.W.devCard, vt: "signed", bar: plan.W.devCard, w: "card" }, ...(Math.abs(dev.vp - plan.W.devCard) > 0.005 ? [{ label: "Army race / last points", v: dev.vp - plan.W.devCard, vt: "signed", bar: dev.vp - plan.W.devCard }] : [])] });
      add({ title: "Turns to afford + production", sub: "value now and later, and how soon", rows: plan.goals.map((g) => ({ label: g.label.replace("Development card", "Dev card"), sub: `${f1(g.eta)} turns · +${f1((g.parts?.prod || 0) + (g.parts?.horizon || 0))} production`, v: g.value, vt: "score", bar: g.value })) });
      const ov = { nodes: plan.goals.filter((g) => g.type === "settlement").map((g) => ({ id: g.nodeId, s: g.score })), cities: plan.goals.filter((g) => g.type === "city").map((g) => ({ id: g.nodeId, s: g.score })), edges: plan.goals.filter((g) => g.edge != null).map((g) => ({ id: g.edge, s: g.score })) };
      add({ title: "Ranking", sub: `value ÷ (turns + ${f1(plan.W.etaOffset)})`, rows: plan.goals.slice().sort((a, b) => b.score - a.score).map((g) => ({ label: g.label.replace("Development card", "Dev card"), v: g.score, vt: "score", bar: g.score, chosen: g === goal0 })),
        overlay: { ...ov, pick: t.pick || {} } });
      const bp = bankPick || (goal0 && plan.rates ? this._aiBankTradePick(Pl, plan, goal0) : null);
      add({ title: "Trade check", sub: act === "bank" ? "a bank / harbour trade brings it closer" : act === "build" ? "not needed: it can pay now" : bp?.why || "no trade", rows: [
        ...(bp?.trades || []).map(([give, get]) => ({ label: `${plan.rates[give]} ${RES_LABEL[give]} → 1 ${RES_LABEL[get]}`, sub: `${plan.rates[give]}:1`, vt: "none", chosen: act === "bank" })),
        ...(d.tradeStep?.node ? [{ label: "Players", sub: d.tradeStep.node.sub, vt: "none", chosen: !!d.tradeStep.does }] : []),
      ] });
    } else {
      add({ title: "Fixed order", sub: "the first thing it can afford", rows: d.kids.filter((k) => /^simple:/.test(k.id)).map((k) => ({ label: k.label, sub: k.sub, vt: "none", ok: !k.off, chosen: k.chosen })) });
    }
    const ov = {};
    if (t.pick?.node != null) ov.nodes = [{ id: t.pick.node, s: 1 }];
    if (t.pick?.city != null) ov.cities = [{ id: t.pick.city, s: 1 }];
    if (t.pick?.edge != null) ov.edges = [{ id: t.pick.edge, s: 1 }];
    choice(t.action, ov);
    return S;
  },
};

// ── shared renderer (AI Lab and the in-game analysis panel): a numbered list, the current step open ──
const escH = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const valTxt = (r) => (r.vt === "score" ? f2(r.v) : r.vt === "signed" ? (Math.abs(r.v) < 0.005 ? "0" : `${r.v > 0 ? "+" : "−"}${f2(Math.abs(r.v))}`) : "");
function f2(v) { return v == null || !Number.isFinite(v) ? "–" : v.toFixed(2); }
function rowsHtml(rows) {
  if (!rows?.length) return "";
  const mx = Math.max(0, ...rows.map((r) => (Number.isFinite(r.bar) ? Math.abs(r.bar) : 0)));
  return `<div class="sx-rows">${rows.map((r) => `<div class="sx-row${r.chosen ? " pick" : ""}${r.ok === false ? " no" : r.ok ? " yes" : ""}"><span class="sx-l">${r.ok != null ? `<i aria-hidden="true">${r.ok ? "✓" : "✗"}</i>` : ""}<b>${escH(r.label)}</b>${r.sub ? `<small>${escH(r.sub)}</small>` : ""}</span>${Number.isFinite(r.bar) && mx > 0 ? `<span class="sx-bar${r.bar < 0 ? " neg" : ""}"><i style="width:${Math.max(3, Math.round(Math.abs(r.bar) / mx * 100))}%"></i></span>` : "<span></span>"}<span class="sx-v">${escH(valTxt(r))}</span></div>`).join("")}</div>`;
}
/** Steps as HTML: every step one line (number, title, what it found); the current one opened with its rows. */
export function stepsHtml(steps, cur) {
  return `<ol class="sx-list">${steps.map((s, i) => `<li class="sx-step${i === cur ? " cur" : i < cur ? " done" : ""}${s.ok === true ? " yes" : s.ok === false ? " no" : ""}" data-step="${i}"><button type="button" class="sx-head" data-step="${i}" aria-current="${i === cur ? "step" : "false"}"><span class="sx-n">${i + 1}</span><span class="sx-t"><b>${escH(s.title)}</b>${s.sub ? `<small>${escH(s.sub)}</small>` : ""}</span></button>${i === cur ? `<div class="sx-body">${s.text ? `<p>${escH(s.text)}</p>` : ""}${rowsHtml(s.rows)}${s.rows2 ? rowsHtml(s.rows2) : ""}</div>` : ""}</li>`).join("")}</ol>`;
}
