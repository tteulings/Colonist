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
  [5, "Dev card", "can buy a dev card"], [6, "Bank trade", "one trade completes a build"], [7, "End turn", "if nothing matched"]];
const term = (id, label, v, w = null, sub = "") => { const k = id.split(":").pop(); return node({ id, label, sub, v, vt: "signed", bar: v, w, term: true, tk: k === "strat" ? "card" : k }); };
const stackOf = (kids) => kids.filter((c) => c.term && c.vt === "signed" && c.v > 0).map((c) => ({ k: c.tk, v: c.v }));

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
      return node({ id: `rule:${n}`, label: `${n} · ${title}`, sub: r ? (n === 7 ? "if nothing matched ✓" : r.why) : `not reached · ${text}`, vt: "none", rule: true, ok: r ? r.ok : null,
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
    const kids = sorted.slice(0, 8).map((c) => node({ id: `spot:${c.id}`, label: `Spot ${this._spotLabel(c.id)}`, sub: `${c.kinds} resource${c.kinds === 1 ? "" : "s"}`, v: c.pips, bar: c.pips, vt: "pips",
      chosen: c.id === b.id, tag: c.id === b.id ? "chosen" : null, focus: { node: c.id } }));
    const root = node({ id: "root", label: "Start settlement", sub: "rule: most pips, tie → more resources", vt: "none", chosen: true, children: kids });
    return { root, action: `Settlement on ${b.pips} pips (${this._spotLabel(b.id)})`, score: b.pips, rules: true, pick: { node: b.id },
      eq: "Pips = how many of the 36 dice rolls pay this spot. No other terms.", data: { sorted, best: b } };
  },
  _treeRulesRobber(P) {
    const r = this._rulesRobber(P);
    if (!r.pick) return null;
    const sorted = r.cands.slice().sort((a, b) => (a.own - b.own) || b.lead - a.lead || b.any - a.any);
    const kids = sorted.slice(0, 8).map((c) => node({ id: `hex:${c.id}`, label: this._hexName(c.id), sub: c.own ? "its own tile: never" : `${r.leader?.name || "leader"}'s pips`, v: c.lead, bar: c.lead, vt: "pips",
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
    return node({ id: `${idp}:${nodeId}`, label: `Spot ${this._spotLabel(nodeId)}`, v: score, bar: score, chosen, tag: chosen ? "chosen" : null, focus: { node: nodeId }, children: terms, stack: stackOf(terms) });
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
      return node({ id: `hex:${c.id}`, label: this._hexName(c.id), sub: owners.length ? owners.join(", ") : "nobody", v: c.score, bar: c.score, chosen: c.id === best.id, tag: c.id === best.id ? "chosen" : null, focus: { hex: c.id }, children: ch, leafish: !full, stack: full ? stackOf(ch) : null });
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
      : act === "bank" ? `Bank trade toward ${goal0.label}` : act === "end" && goal0 ? `Ends turn · saving for ${goal0.label} (${goal0.score.toFixed(2)})` : act === "side" ? `${doing.type === "settlement" && doing.dist > 0 ? `Road toward ${this._spotLabel(doing.nodeId)}` : doing.label} (side build)` : act === "simple" ? doing : "Ends turn";
    const root = node({ id: "root", label: `${P.name}'s turn`, sub: `${kids.length} options`, vt: "none", chosen: true, children: kids });
    const txt = [...first, what].join(", then ");
    return { root, noScore: act === "end" && !!goal0, action: txt.charAt(0).toUpperCase() + txt.slice(1), target: goal0 ? goal0.label : null, score: goal0 ? goal0.score : null,
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
    return { does: res?.dry ? `trades with ${res.partner.name}` : null, partner: res?.dry ? res.partner.id : null,
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
      if (Math.abs(p.prod + p.horizon) > 0.005) ch.push(term(`${id}:prod`, "Production", p.prod + p.horizon, "prod", `${(g.prod || 0).toFixed(2)} cards/roll × ${((p.prod + p.horizon) / (g.prod || 1)).toFixed(1)}`));
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
        ch.push(node({ id: `${id}:why`, label: "Spot rank", sub: "picks which spots get planned; not part of the score above", v: h, bar: h, children: kidsW, stack: stackOf(kidsW), rank: true }));
      }
      const label = g.type === "settlement" ? `Spot ${this._spotLabel(g.nodeId)}` : g.type === "city" ? `City on ${this._spotLabel(g.nodeId)}` : g.type === "road" ? "Extend the road" : "Development card";
      const sub = g.type === "settlement" ? (g.dist ? `+${g.dist} road${g.dist > 1 ? "s" : ""}${g.via === "ship" ? " (ships)" : ""}` : "reachable now") : g.eta === 0 ? "affordable now" : `~${f1(g.eta)} turns`;
      const focus = g.type === "settlement" ? { node: g.nodeId, edge: g.dist ? g.edge : null } : g.type === "city" ? { city: g.nodeId } : g.type === "road" ? { edge: g.edge } : null;
      const isPlan = g === goal0, isSide = g === side;
      const div = g.eta + plan.W.etaOffset;
      return node({ id, label, sub, v: g.score, bar: g.score, chosen: isPlan, tag: isPlan ? (act === "build" ? "chosen" : "plan") : isSide ? "now" : null, focus, children: ch,
        stack: stackOf(ch.filter((c) => c.term && c.tk !== "eta")).map((x) => ({ ...x, v: x.v / div })) });
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

  // ── step through: the same decision as an ordered sequence. Each step: { key, title, sub, rows, hand,
  // compare, text, overlay }. Rows carry the letter (A, B, …) that the board shows as a badge at the same
  // candidate; the last step marks the winner "1" and the runner-up "2" and compares them term by term. ──
  _stepTerms(P, nodeId, profile = null) {
    const parts = { terms: {} };
    this.getNodeProductionScore(nodeId, P, profile, parts);
    return SPOT_TERMS.filter(([k]) => Math.abs(parts.terms[k] || 0) > 0.005).map(([k, label, w]) => ({ k, label, v: parts.terms[k], w }));
  },
  _treeSteps(t, P) {
    const d = t.data || {};
    const S = [];
    const add = (o) => S.push({ rows: [], overlay: {}, ...o });
    const at = (f) => f || {};
    const lettered = (items, place) => items.map((x, i) => ({ text: LETTERS[i], ...place(x) }));
    const compare = (a, b, unit = "") => {
      if (!a) return null;
      const keys = [...new Set([...(a.terms || []), ...(b?.terms || [])].map((x) => x.k))];
      const val = (o, k) => o?.terms?.find((x) => x.k === k)?.v ?? 0;
      const rows = keys.map((k) => { const src = (a.terms || []).find((x) => x.k === k) || (b?.terms || []).find((x) => x.k === k); return { k, label: src.label, a: val(a, k), b: b ? val(b, k) : null, div: !!src.div }; });
      return { a: a.label, b: b?.label || null, rows, sa: a.score, sb: b?.score ?? null, unit };
    };
    const winBadges = (pa, pb) => [{ text: "1", ...pa }, ...(pb ? [{ text: "2", tone: "alt", ...pb }] : [])];

    if (t.mode === "setup") {
      const rules = !!t.rules;
      const all = d.sorted.map((c) => rules ? { id: c.id, score: c.pips, kinds: c.kinds } : { id: c.id, score: c.score });
      const best = rules ? d.best.id : d.best.id;
      const top = all.slice(0, 6);
      const termsOf = (c) => rules ? [{ k: "num", label: "Pips", v: c.score }, { k: "variety", label: "Resources (tie-break)", v: c.kinds }] : this._stepTerms(P, c.id);
      add({ key: "free", title: "Free spots", sub: `${all.length} corners it may settle`, text: "No building on it or next to it.", overlay: { nodes: all.map((c) => ({ id: c.id, s: c.score })), noLabels: true } });
      add({ key: "cands", title: rules ? "Count the pips" : "Score the best spots", sub: rules ? "dice rolls that pay each spot" : "numbers + scarcity + variety + port",
        rows: top.map((c, i) => ({ letter: LETTERS[i], label: `Spot ${this._spotLabel(c.id)}`, sub: rules ? `${c.kinds} resources` : "", v: c.score, vt: rules ? "int" : "score", stack: rules ? null : termsOf(c).filter((x) => x.v > 0), chosen: c.id === best, focus: { node: c.id } })),
        overlay: { nodes: top.map((c) => ({ id: c.id, s: c.score })), badges: lettered(top, (c) => ({ node: c.id })), noLabels: true } });
      const a = all.find((c) => c.id === best), b = all.find((c) => c.id !== best);
      add({ key: "choice", title: "Choice", sub: t.action, text: rules ? "Most pips wins; a tie goes to more different resources." : "",
        compare: compare({ label: `${LETTERS[top.indexOf(a)] || ""} · Spot ${this._spotLabel(a.id)}`, terms: termsOf(a), score: a.score }, b && { label: `${LETTERS[top.indexOf(b)] || ""} · Spot ${this._spotLabel(b.id)}`, terms: termsOf(b), score: b.score }, rules ? "pips" : ""),
        overlay: { nodes: [{ id: a.id, s: 1 }, ...(b ? [{ id: b.id, s: 0.4 }] : [])], badges: winBadges({ node: a.id }, b && { node: b.id }), noLabels: true, pick: { node: a.id } } });
      return S;
    }
    if (t.mode === "robber") {
      if (t.rules) {
        const { r, sorted } = d;
        const lead = r.leader;
        const leadNodes = lead ? [...lead.settlements, ...lead.cities] : [];
        add({ key: "leader", title: "Find the leader", sub: lead ? `${lead.name} · ${lead.publicVictoryPoints} points` : "no leader", text: "The opponent with the most public points.",
          overlay: { nodes: leadNodes.map((id) => ({ id, s: 1 })), noLabels: true } });
        const top = sorted.filter((c) => !c.own).slice(0, 6);
        add({ key: "cands", title: "Leader's pips per tile", sub: "never a tile with its own building",
          rows: top.map((c, i) => ({ letter: LETTERS[i], label: this._hexName(c.id), v: c.lead, vt: "int", chosen: c.id === r.pick.id, focus: { hex: c.id } })),
          overlay: { hexes: top.map((c) => ({ id: c.id, s: c.lead, dmg: null })), badges: lettered(top, (c) => ({ hex: c.id })), noLabels: true } });
        const a = r.pick, b = top.find((c) => c.id !== a.id);
        const tm = (c) => [{ k: "block", label: "Leader's pips", v: c.lead }, { k: "steal", label: "All opponents' pips (tie-break)", v: c.any }];
        add({ key: "choice", title: "Choice", sub: t.action, compare: compare({ label: `${LETTERS[top.findIndex((c) => c.id === a.id)] || ""} · ${this._hexName(a.id)}`, terms: tm(a), score: a.lead }, b && { label: `${LETTERS[top.indexOf(b)] || ""} · ${this._hexName(b.id)}`, terms: tm(b), score: b.lead }, "pips"),
          overlay: { hexes: [{ id: a.id, s: 1, dmg: null }], badges: winBadges({ hex: a.id }, b && { hex: b.id }), noLabels: true, pick: { hex: a.id } } });
        add({ key: "steal", title: "Steal", sub: `from ${lead?.name || "the leader"}`, text: "Rule: always the leader when the leader is on the tile.", overlay: { hexes: [{ id: a.id, s: 1, dmg: null }], noLabels: true, focus: { hex: a.id } } });
        return S;
      }
      if (!d.sorted) { add({ key: "sea", title: "Robber or pirate", sub: "by expected damage" }); return S; }
      const { sorted, best, awareness } = d;
      const tm = (c) => [["block", "Blocked cards"], ["leader", "Leader weighting", "leader"], ["own", "Own tiles"], ["steal", "Steal", "leader"]].map(([k, label, w]) => ({ k, label, v: c.parts[k] || 0, w })).filter((x) => Math.abs(x.v) > 0.005);
      add({ key: "free", title: "Legal tiles", sub: `${sorted.length} tiles`, text: "Where the robber may go.", overlay: { hexes: sorted.map((c) => ({ id: c.id, s: c.score, dmg: null })), noLabels: true } });
      const top = sorted.slice(0, 6);
      add({ key: "cands", title: "Damage per tile", sub: awareness === "none" ? "everyone counts the same" : awareness === "basic" ? "more points → more weight" : "the leader counts most",
        rows: top.map((c, i) => ({ letter: LETTERS[i], label: this._hexName(c.id), v: c.score, vt: "score", stack: tm(c).filter((x) => x.v > 0), chosen: c.id === best.id, focus: { hex: c.id } })),
        overlay: { hexes: top.map((c) => ({ id: c.id, s: c.score, dmg: null })), badges: lettered(top, (c) => ({ hex: c.id })), noLabels: true } });
      const b = top.find((c) => c.id !== best.id);
      add({ key: "choice", title: "Choice", sub: t.action, compare: compare({ label: `${LETTERS[top.indexOf(best)] || ""} · ${this._hexName(best.id)}`, terms: tm(best), score: best.score }, b && { label: `${LETTERS[top.indexOf(b)] || ""} · ${this._hexName(b.id)}`, terms: tm(b), score: b.score }),
        overlay: { hexes: [{ id: best.id, s: 1, dmg: null }], badges: winBadges({ hex: best.id }, b && { hex: b.id }), noLabels: true, pick: { hex: best.id } } });
      add({ key: "steal", title: "Steal", sub: awareness === "none" ? "a random player on the tile" : awareness === "basic" ? "the biggest hand on the tile" : "the leader, or who likely holds what it needs",
        text: "From public card counts only, never hidden hands.", overlay: { hexes: [{ id: best.id, s: 1, dmg: null }], noLabels: true, focus: { hex: best.id } } });
      return S;
    }
    if (t.rules) {
      d.list.forEach((r) => {
        const f = r.focus;
        add({ key: `rule${r.n}`, title: `Rule ${r.n} · ${r.title}`, sub: `${r.ok ? "✓" : "✗"} ${r.why}`, ok: r.ok,
          overlay: f ? { nodes: f.node != null ? [{ id: f.node, s: 1 }] : [], cities: f.city != null ? [{ id: f.city, s: 1 }] : [], edges: f.edge != null && f.node != null ? (() => { try { return (this.pathToNode(P, f.node) || [f.edge]).map((id) => ({ id, s: id === f.edge ? 1 : 0.4 })); } catch (_) { return [{ id: f.edge, s: 1 }]; } })() : f.edge != null ? [{ id: f.edge, s: 1 }] : [], hexes: f.hex != null ? [{ id: f.hex, s: 1, dmg: null }] : [],
            badges: [{ text: String(r.n), ...(f.edge != null && f.node == null ? { edge: f.edge } : f.node != null ? { node: f.node } : f.city != null ? { city: f.city } : { hex: f.hex }) }], noLabels: true, pick: f } : { noLabels: true } });
      });
      return S;
    }
    // ── a scoring bot's turn ──
    const { P: Pl, strat, plan, goal0, act, doing, bankPick } = d;
    const h = Pl.resources;
    const legalSpots = this.geometry.nodes.filter((n) => this.canBuildSettlement(Pl, n.id, false)).map((n) => n.id);
    const legalRoads = has(h, COST.road) ? this.geometry.edges.filter((e) => this.canBuildRoad(Pl, e.id, { free: false })).map((e) => e.id) : [];
    const builds = [["Road", COST.road, legalRoads.length > 0], ["Settlement", COST.settlement, legalSpots.length > 0], ["City", COST.city, Pl.settlements.size > 0], ["Dev card", COST.development, this.devDeck.length > 0]].map(([label, c, place]) => {
      const miss = R5.filter((r) => (c[r] || 0) > h[r]).map((r) => `${c[r] - h[r]} ${RES_LABEL[r]}`).join(" + ");
      return { label, ok: !miss && place, sub: miss ? `needs ${miss}` : place ? "can afford now" : "no place for it" };
    });
    add({ key: "hand", title: "Hand", sub: R5.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RES_LABEL[r]}`).join(" + ") || "no cards", hand: { cards: { ...h }, builds },
      overlay: { nodes: has(h, COST.settlement) ? legalSpots.map((id) => ({ id, s: 1 })) : [], cities: has(h, COST.city) ? [...Pl.settlements].map((id) => ({ id, s: 1 })) : [], edges: legalRoads.map((id) => ({ id, s: 1 })), noLabels: true } });
    // goals ranked: letters A, B, C … in this order on every later step
    const ranked = plan.goals.slice().sort((a, b) => b.score - a.score);
    // ONE stable letter per candidate for the whole decision: the planned builds in ranking order, then the
    // other settlement spots in reach (a settlement plan and its spot share the spot's letter)
    const keyOf = (g) => (g.type === "settlement" ? `n${g.nodeId}` : g.type === "city" ? `c${g.nodeId}` : g.type === "road" ? `r${g.edge}` : "dev");
    const LM = new Map();
    const letterOf = (k) => { if (!LM.has(k)) LM.set(k, LETTERS[LM.size] || "?"); return LM.get(k); };
    ranked.forEach((g) => letterOf(keyOf(g)));
    (plan.spots || []).slice(0, 6).forEach((x) => letterOf(`n${x.nodeId}`));
    const L = { get: (g) => letterOf(keyOf(g)) };
    // the dashed route of the roads a far spot still needs
    // (v0.89: the route behind the bot's own road distance, not a fewest-hops path)
    const route = (nodeId) => { try { return (this._aiReachPath(Pl, nodeId) || []).map((id) => ({ id, s: 0.4 })); } catch (_) { return []; } };
    const place = (g) => (g.type === "settlement" ? (g.dist > 0 && g.edge != null ? { node: g.nodeId } : { node: g.nodeId }) : g.type === "city" ? { city: g.nodeId } : g.type === "road" ? { edge: g.edge } : null);
    const goalBadges = (gs, text) => gs.filter((g) => place(g)).map((g) => ({ text: text(g), ...place(g) }));
    const goalOverlay = (gs) => ({ nodes: gs.filter((g) => g.type === "settlement").map((g) => ({ id: g.nodeId, s: g.score })), cities: gs.filter((g) => g.type === "city").map((g) => ({ id: g.nodeId, s: g.score })),
      edges: [...gs.filter((g) => g.type === "road" && g.edge != null).map((g) => ({ id: g.edge, s: g.score })), ...gs.filter((g) => g.type === "settlement" && g.dist > 0).flatMap((g) => route(g.nodeId))], noLabels: true });
    const name = (g) => (g.type === "settlement" ? `Settlement ${this._spotLabel(g.nodeId)}${g.dist ? ` +${g.dist} road${g.dist > 1 ? "s" : ""}` : ""}` : g.type === "city" ? `City on ${this._spotLabel(g.nodeId)}` : g.type === "road" ? "Longest Road" : "Dev card");
    // 2. options in the order the bot really takes them
    const stepOk = goal0 ? has(h, this._aiStepCost(goal0)) : false;
    const opts = [
      ...(d.cardStep?.node ? [{ label: "Play a card", sub: d.cardStep.node.sub, ok: !!d.cardStep.does }] : []),
      ...(d.tradeStep?.node ? [{ label: "Trade with players", sub: d.tradeStep.node.sub, ok: !!d.tradeStep.does }] : []),
      ...(strat.expansion === "simple" ? d.kids.filter((k) => /^simple:/.test(k.id)).map((k) => ({ label: k.label, sub: k.sub, ok: !k.off && k.chosen ? true : !k.off ? null : false }))
        : [
          { label: goal0 ? `Build the plan: ${name(goal0)}` : "Build the plan", sub: !goal0 ? "nothing to build" : stepOk ? "can pay the next step now" : "can't pay it yet", ok: act === "build" },
          { label: "Bank / harbour trade toward it", sub: act === "bank" ? "a trade brings it closer" : act === "build" ? "not needed" : (bankPick?.why || "no useful trade"), ok: act === "bank" },
          { label: "Side build that doesn't delay it", sub: act === "side" ? name(doing) : "none fits", ok: act === "side" },
          { label: "End turn", sub: act === "end" ? "saving cards" : "only if nothing above fits", ok: act === "end" },
        ]),
    ];
    add({ key: "options", title: "Options, in order", sub: "the first that fits is what it does", rows: opts.map((o) => ({ label: o.label, sub: o.sub, vt: "none", ok: o.ok === true ? true : o.ok === false ? false : null })),
      overlay: { ...goalOverlay(plan.goals), badges: goalBadges(plan.goals, (g) => `${L.get(g)} ${g.type === "settlement" ? "Town" : g.type === "city" ? "City" : "Road"}`) } });
    if (strat.expansion !== "simple" && plan.goals.length) {
      const spots = (plan.spots || []).slice(0, 6);
      if (spots.length) {
        // v0.89: each spot's cost in roads and turns (rings on the board), and where a rival is as close (flags)
        let ri = null;
        try { ri = this._aiReachInfo(Pl, plan); } catch (_) { ri = null; }
        const info = new Map((ri?.spots || []).map((x) => [x.id, x]));
        add({ key: "spots", title: "Settlement spots in reach", sub: "what each costs in roads and turns; the top 3 by rank become plans",
          legend: "reach",
          rows: spots.map((x) => { const r = info.get(x.nodeId);
            return { letter: letterOf(`n${x.nodeId}`), label: `Spot ${this._spotLabel(x.nodeId)}`, sub: r ? this._reachText(r) : x.d ? `+${x.d} road${x.d > 1 ? "s" : ""}` : "on its roads", v: x.h, vt: "score",
              warn: r?.rival ? { text: this._rivalText(r), color: this.players[r.rival.pid].color } : null,
              stack: this._stepTerms(Pl, x.nodeId, this.getResourceIncomeProfile(Pl)).filter((y) => y.v > 0), chosen: goal0?.nodeId === x.nodeId && goal0?.type === "settlement", focus: { node: x.nodeId } }; }),
          overlay: { nodes: spots.map((x) => ({ id: x.nodeId, s: x.h })), badges: spots.map((x) => ({ text: letterOf(`n${x.nodeId}`), node: x.nodeId })), noLabels: true,
            reach: ri ? { spots: ri.spots.filter((x) => spots.some((y) => y.nodeId === x.id)), out: ri.out } : null } });
      }
      const k = plan.R * (plan.strat.awareness === "advanced" ? 1 : 1) * 1;
      const conv = (g) => (g.prod ? (((g.parts?.prod || 0) + (g.parts?.horizon || 0)) / g.prod) : 0);
      add({ key: "value", title: "Value and turns to afford", sub: "production turned into points, and how soon",
        rows: ranked.map((g) => ({ letter: L.get(g), label: name(g), sub: `${g.prod ? `${g.prod.toFixed(2)} cards/roll × ${conv(g).toFixed(1)} = +${((g.parts?.prod || 0) + (g.parts?.horizon || 0)).toFixed(2)} · ` : ""}${g.vp ? `${f1(g.vp)} pt · ` : ""}${f1(g.eta)} turns`,
          v: g.value, vt: "score", stack: [{ k: "vp", v: g.parts?.vp ?? g.vp }, { k: "prod", v: (g.parts?.prod || 0) + (g.parts?.horizon || 0) }, { k: "win", v: g.parts?.win || 0 }].filter((x) => x.v > 0), focus: place(g) })),
        overlay: { ...goalOverlay(ranked), badges: goalBadges(ranked, (g) => L.get(g)) } });
      void k;
      add({ key: "rank", title: "Ranking", sub: `score = value ÷ (turns + ${f1(plan.W.etaOffset)})`,
        rows: ranked.map((g) => ({ letter: L.get(g), label: name(g), sub: `${f2(g.value)} ÷ ${f2(g.eta + plan.W.etaOffset)}`, v: g.score, vt: "score", stack: [{ k: "vp", v: (g.parts?.vp ?? g.vp) / (g.eta + plan.W.etaOffset) }, { k: "prod", v: ((g.parts?.prod || 0) + (g.parts?.horizon || 0)) / (g.eta + plan.W.etaOffset) }, { k: "win", v: (g.parts?.win || 0) / (g.eta + plan.W.etaOffset) }].filter((x) => x.v > 0), chosen: g === goal0, focus: place(g) })),
        overlay: { ...goalOverlay(ranked), badges: goalBadges(ranked, (g) => L.get(g)) } });
      // trade check: the harbour it would use is ringed on the board
      const bp = bankPick || (goal0 && plan.rates ? this._aiBankTradePick(Pl, plan, goal0) : null);
      const harbours = [];
      (bp?.trades || []).forEach(([give]) => {
        const rate = plan.rates[give];
        if (rate >= 4) return;
        [...Pl.settlements, ...Pl.cities].forEach((id) => { const n = this.geometry.nodes[id]; if (n.ports.includes(rate === 2 ? give : "any") && !harbours.some((x) => x.id === id)) harbours.push({ id, rate }); });
      });
      const deal = d.tradeStep?.does ? d.tradeStep.does.replace(/^trades/, "deals") : null;
      add({ key: "trade", title: "Trade check", sub: act === "bank" ? "a trade brings the plan closer" : deal ? `no bank trade, but it ${deal} first` : act === "build" ? "not needed: it can pay now" : (bp?.why || "no trade"),
        rows: [...(bp?.trades || []).map(([give, get]) => ({ label: `${plan.rates[give]} ${RES_LABEL[give]} → 1 ${RES_LABEL[get]}`, sub: plan.rates[give] === 4 ? "bank 4:1" : `harbour ${plan.rates[give]}:1`, vt: "none", ok: act === "bank" ? true : null })),
          ...(d.tradeStep?.node ? [{ label: "Players", sub: d.tradeStep.node.sub, vt: "none", ok: d.tradeStep.does ? true : null }] : [])],
        overlay: (() => {
          const pid = d.tradeStep?.partner;
          const theirs = pid != null ? [...this.players[pid].settlements, ...this.players[pid].cities] : [];
          return { nodes: [...harbours.map((x) => ({ id: x.id, s: 1 })), ...theirs.map((id) => ({ id, s: 0.6 }))],
            badges: [...harbours.map((x) => ({ text: `${x.rate}:1`, node: x.id })), ...theirs.slice(0, 1).map((id) => ({ text: "deal", tone: "alt", node: id }))], noLabels: true };
        })() });
      const a = goal0, b = ranked.find((g) => g !== goal0);
      const gt = (g) => [{ k: "vp", label: g.type === "dev" ? "Card value" : "Points", v: g.parts?.vp ?? g.vp }, { k: "prod", label: "Production", v: (g.parts?.prod || 0) + (g.parts?.horizon || 0) },
        ...(g.parts?.win ? [{ k: "win", label: "Wins the game", v: g.parts.win }] : []), { k: "eta", label: "÷ (turns + 1)", v: g.eta + plan.W.etaOffset, div: true }];
      const wb = [];
      if (a && place(a)) wb.push({ text: "1", ...place(a) });
      if (b && place(b)) wb.push({ text: "2", tone: "alt", ...place(b) });
      // what it does right now when that isn't the plan itself (a side build): a "now" mark on its first road / spot
      const nowEdges = [];
      if (act === "side" && doing) {
        const r0 = doing.type === "settlement" && doing.dist > 0 ? doing.edge : doing.type === "road" ? doing.edge : null;
        if (r0 != null) { wb.push({ text: "now", tone: "dim", edge: r0 }); nowEdges.push({ id: r0, s: 1 }); }
        else if (place(doing)) wb.push({ text: "now", tone: "dim", ...place(doing) });
      }
      // v0.89: the whole road route of a far planned spot, numbered in build order (road 1 is built first)
      const rt = a?.type === "settlement" && a.dist > 0 && a.via !== "ship" ? (() => { try { return this._aiReachPath(Pl, a.nodeId); } catch (_) { return null; } })() : null;
      if (!rt?.length && act === "build" && a?.type === "settlement" && a.dist > 0 && a.edge != null) { wb.push({ text: "now", tone: "dim", edge: a.edge }); nowEdges.push({ id: a.edge, s: 1 }); }
      const nm = (g) => (g ? `${name(g)} (${L.get(g)})` : "");
      const why = !a ? "" : act === "build" && a.type === "settlement" && a.dist > 0 ? `It can pay for the first road toward ${nm(a)} now, so it builds it.` : act === "build" ? `It can pay for ${nm(a)} now, so it builds it.` : act === "bank" ? `It can't pay for ${nm(a)} yet; a bank / harbour trade brings it closer.`
        : act === "side" ? `It can't pay for ${nm(a)} yet; ${nm(doing)} fits in without delaying it, so that comes first.` : `It can't pay for ${nm(a)} yet and no trade helps: it keeps its cards.`;
      const rtxt = rt?.length ? ` Its way there: ${rt.length} road${rt.length > 1 ? "s" : ""}, numbered on the board${act === "build" ? "; road 1 is the one it builds now" : ""}.` : "";
      add({ key: "choice", title: "Choice", sub: t.action, text: why + rtxt, compare: a ? compare({ label: `${L.get(a)} · ${name(a)}`, terms: gt(a), score: a.score }, b && { label: `${L.get(b)} · ${name(b)}`, terms: gt(b), score: b.score }) : null,
        overlay: (() => { const o = goalOverlay([a, b, act === "side" ? doing : null].filter(Boolean)); const mine = new Set(rt || []); o.edges = [...o.edges.filter((e) => !mine.has(e.id)), ...nowEdges];
          return { ...o, badges: wb, pick: t.pick || {}, route: rt?.length ? { node: a.nodeId, edges: rt } : null }; })(), legend: rt?.length ? "route" : null });
    } else {
      add({ key: "choice", title: "Choice", sub: t.action, overlay: { pick: t.pick || {}, focus: t.pick && Object.keys(t.pick).length ? t.pick : null, noLabels: true } });
    }
    return S;
  },
};

// ── shared renderer (AI Lab and the in-game analysis panel): a numbered strip + ONE step card ──
export const TERM_COLOR = { num: "#3C75C6", scarcity: "#8E5BB5", variety: "#3E9E58", port: "#1F8FA0", sets: "#C99A2E", contest: "#D9714E", magnet: "#8A8F94", dist: "#8A8F94",
  vp: "#C0548A", prod: "#6E9A2A", win: "#E0A82E", eta: "#8A8F94", block: "#5B6B8C", leader: "#D9714E", own: "#8A8F94", steal: "#C99A2E", card: "#C0548A", xport: "#1F8FA0" };
const LETTERS = "ABCDEFGHIJKL";
const escH = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function f2(v) { return v == null || !Number.isFinite(v) ? "–" : v.toFixed(2); }
const valTxt = (r) => (r.vt === "score" ? f2(r.v) : r.vt === "int" ? String(Math.round(r.v)) : r.vt === "signed" ? (Math.abs(r.v) < 0.005 ? "0" : `${r.v > 0 ? "+" : "−"}${f2(Math.abs(r.v))}`) : "");
/** A stacked bar: one coloured segment per score term (same colours everywhere). */
export function stackHtml(stack, max) {
  if (!stack?.length || !(max > 0)) return `<span class="sx-bar"></span>`;
  return `<span class="sx-bar stk">${stack.map((x) => `<i style="width:${Math.max(1.5, (x.v / max) * 100)}%;background:${TERM_COLOR[x.k] || "var(--accent)"}" title="${escH(x.k)}"></i>`).join("")}</span>`;
}
function rowsHtml(rows) {
  if (!rows?.length) return "";
  const mx = Math.max(0, ...rows.map((r) => (r.stack ? r.stack.reduce((a, x) => a + x.v, 0) : Number.isFinite(r.v) ? Math.abs(r.v) : 0)));
  return `<div class="sx-rows">${rows.map((r, i) => {
    const mark = r.letter ? `<span class="sx-let">${r.letter}</span>` : r.ok != null ? `<i class="sx-ok" aria-hidden="true">${r.ok ? "✓" : "✗"}</i>` : `<i class="sx-ok" aria-hidden="true">·</i>`;
    const bar = r.stack ? stackHtml(r.stack, mx) : Number.isFinite(r.v) && mx > 0 && r.vt !== "none" ? `<span class="sx-bar"><i style="width:${Math.max(3, Math.round(Math.abs(r.v) / mx * 100))}%"></i></span>` : `<span></span>`;
    const tag = r.focus ? "button" : "div";
    const warn = r.warn ? `<small class="sx-riv" style="--rc:${escH(r.warn.color)}"><svg viewBox="0 0 11 14" aria-hidden="true"><path d="M2 13V2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.6 2 10.5 5 2.6 8Z" fill="${escH(r.warn.color)}"/></svg>${escH(r.warn.text)}</small>` : "";
    return `<${tag}${tag === "button" ? ` type="button" data-row="${i}"` : ""} class="sx-row${r.chosen ? " pick" : ""}${r.ok === false ? " no" : r.ok ? " yes" : ""}">${mark}<span class="sx-l"><b>${escH(r.label)}</b>${r.sub ? `<small>${escH(r.sub)}</small>` : ""}${warn}</span>${bar}<span class="sx-v">${escH(valTxt(r))}</span></${tag}>`;
  }).join("")}</div>`;
}
function handHtml(hand) {
  const R = [["wood", "Lumber"], ["brick", "Brick"], ["sheep", "Wool"], ["wheat", "Grain"], ["ore", "Ore"]];
  return `<div class="sx-hand">${R.map(([r, l]) => `<span class="sx-card r-${r}${hand.cards[r] ? "" : " zero"}"><b>${hand.cards[r]}</b>${l}</span>`).join("")}</div>
    <div class="sx-builds">${hand.builds.map((b) => `<span class="${b.ok ? "ok" : ""}" title="${escH(b.sub)}">${b.ok ? "✓" : "✗"} ${escH(b.label)}<small>${escH(b.ok ? "now" : b.sub.replace(/^needs /, "needs "))}</small></span>`).join("")}</div>`;
}
function compareHtml(c) {
  if (!c) return "";
  const fv = (v, div) => (v == null ? "–" : div ? `÷${f2(v)}` : f2(v));
  const diff = (r) => (r.b == null ? "" : r.div ? (r.a < r.b ? "sooner" : r.a > r.b ? "slower" : "=") : `${r.a - r.b >= 0 ? "+" : "−"}${f2(Math.abs(r.a - r.b))}`);
  return `<div class="sx-cmp"><div class="sx-leg"><span><span class="sx-win">1</span>${escH(c.a)}</span>${c.b ? `<span><span class="sx-win alt">2</span>${escH(c.b)}</span>` : ""}</div>
    <div class="sx-cmph"><span></span><b><span class="sx-win">1</span></b>${c.b ? `<b><span class="sx-win alt">2</span></b><span>1 − 2</span>` : ""}</div>
    ${c.rows.map((r) => `<div class="sx-cmpr"><span><i style="background:${TERM_COLOR[r.k] || "var(--accent)"}"></i>${escH(r.label)}</span><span>${fv(r.a, r.div)}</span>${c.b ? `<span>${fv(r.b, r.div)}</span><span class="d">${diff(r)}</span>` : ""}</div>`).join("")}
    <div class="sx-cmpr tot"><span>${c.unit === "pips" ? "Pips" : "Score"}</span><span>${c.unit === "pips" ? Math.round(c.sa) : f2(c.sa)}</span>${c.b ? `<span>${c.unit === "pips" ? Math.round(c.sb) : f2(c.sb)}</span><span class="d">${c.unit === "pips" ? `+${Math.round(c.sa - c.sb)}` : `+${f2(c.sa - c.sb)}`}</span>` : ""}</div></div>`;
}
/** The step strip: 1 … n, the current one filled; done ones tinted; a rule that didn't match greyed. */
export function stepStripHtml(steps, cur, attr = "data-step") {
  return `<div class="sx-strip" role="tablist" aria-label="Steps">${steps.map((s, i) => `<button type="button" role="tab" ${attr}="${i}" aria-selected="${i === cur}" class="${i === cur ? "cur" : i < cur ? "done" : ""}${s.ok === false ? " no" : s.ok === true ? " yes" : ""}" title="${escH(s.title)}">${i + 1}</button>`).join("")}</div>`;
}
/** v0.89: what the board's marks mean on this step (one line; shown in the lab and in game). */
function legendHtml(k) {
  if (!k) return "";
  const ring = (dash, w = 1.6) => `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}" stroke-linecap="round"` : ""}/></svg>`;
  if (k === "reach") return `<p class="sx-legend"><span>Ring = roads:</span><span>${ring("")}0</span><span>${ring("3 2")}1</span><span>${ring("0.01 3.2", 2)}2+</span><span><svg viewBox="0 0 11 14" aria-hidden="true"><path d="M2 13V2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.6 2 10.5 5 2.6 8Z" fill="#E8873A"/></svg>rival as close</span></p>`;
  if (k === "route") return `<p class="sx-legend"><span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3" fill="#fff" stroke="currentColor" stroke-width="1.6"/><text x="8" y="11.5" font-size="9" font-weight="800" text-anchor="middle" fill="#22302F">1</text></svg>roads to the spot, in build order</span></p>`;
  return "";
}
/** One step as a card: number + title, what it found, its rows / hand / winner-vs-runner-up comparison. */
export function stepCardHtml(steps, cur, sel = null) {
  const s = steps[cur];
  if (!s) return "";
  return `<div class="sx-card1${s.ok === false ? " no" : ""}"><div class="sx-h"><span class="sx-n">${cur + 1}</span><b>${escH(s.title)}</b><small>${cur + 1} / ${steps.length}</small></div>
    ${s.sub ? `<p class="sx-sub">${escH(s.sub)}</p>` : ""}${s.text ? `<p class="sx-text">${escH(s.text)}</p>` : ""}${legendHtml(s.legend)}
    ${s.hand ? handHtml(s.hand) : ""}${rowsHtml(s.rows).replace(new RegExp(`data-row="${sel}" class="sx-row`), `data-row="${sel}" class="sx-row sel`)}${compareHtml(s.compare)}</div>`;
}
/** Legacy list (kept for the in-game panel's compact mode). */
export function stepsHtml(steps, cur) { return stepStripHtml(steps, cur) + stepCardHtml(steps, cur); }
