// v0.87 "Simple" bot: a rulebook instead of scores. Every turn it walks the rules top to bottom and
// the first rule that matches fires (then it starts again from rule 1, up to 10 actions a turn):
//   1. can build a city        → on the settlement with the most pips
//   2. can build a settlement  → on the legal spot with the most pips
//   3. holds a Knight and the robber is on its tile → play it
//   4. can build a road        → toward the nearest free settlement spot (most pips among the nearest)
//   5. can buy a dev card      → buy it
//   6. one bank / harbour trade completes a city or settlement → make it
//   7. otherwise               → end the turn
// Set-up: the spot with the most pips (tie: more different resources), the road toward the next best spot.
// On a 7: discards what it has most of; robber on the leader's tile with the most pips (never its own);
// steals from the leader. Player deals: never offers; accepts only a deal that lets it build right away.
// Nothing here uses the score formula or the weights: what the checklist says is all there is.

const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const RES_LABEL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, development: { sheep: 1, wheat: 1, ore: 1 } };
const has = (h, c) => Object.entries(c).every(([r, n]) => (h[r] || 0) >= n);
const short = (h, c) => R5.filter((r) => (c[r] || 0) > (h[r] || 0)).map((r) => `${(c[r] || 0) - (h[r] || 0)} ${RES_LABEL[r]}`).join(" + ");

export const isRulesBot = (p) => p?.strategy?.policy === "rules";

export const RULES = [
  [1, "City", "can build a city → on the settlement with the most pips"],
  [2, "Settlement", "can build a settlement → on the spot with the most pips"],
  [3, "Knight", "robber on its tile and a Knight in hand → play it"],
  [4, "Road", "can build a road → toward the nearest free spot"],
  [5, "Dev card", "can buy a dev card → buy it"],
  [6, "Bank trade", "one trade completes a city or settlement → trade"],
  [7, "End turn", "nothing else matched"],
];

export const RulesMixin = {
  _rulesPips(nodeId) {
    let p = 0;
    this.geometry.nodes[nodeId].adjacentHexes.forEach((h) => { const hex = this.geometry.hexes[h]; if (hex.number && hex.resource !== "desert") p += PIPS[hex.number] || 0; });
    return p;
  },
  _rulesKinds(nodeId) {
    const s = new Set();
    this.geometry.nodes[nodeId].adjacentHexes.forEach((h) => { const hex = this.geometry.hexes[h]; if (hex.number && hex.resource !== "desert") s.add(hex.resource); });
    return s.size;
  },
  /** Best of `ids` by pips, then different resources, then the lower node id. */
  _rulesBestSpot(ids) {
    let best = null;
    ids.forEach((id) => {
      const c = { id, pips: this._rulesPips(id), kinds: this._rulesKinds(id) };
      if (!best || c.pips > best.pips || (c.pips === best.pips && c.kinds > best.kinds)) best = c;
    });
    return best;
  },
  /** A legal settlement spot for it right now, whatever its hand (canBuildSettlement also checks the cards). */
  _rulesSpotOk(player, id) {
    const n = this.geometry.nodes[id];
    if (!this._rulesFreeSpot(id) || (this.sea && !this.sea.nodeIsLand(id))) return false;
    return n.edgeIds.some((e) => this.geometry.edges[e].owner === player.id);
  },
  _rulesFreeSpot(id) {
    const n = this.geometry.nodes[id];
    return n.structure == null && !n.neighbors.some((x) => this.geometry.nodes[x].structure != null);
  },

  // ── set-up ──
  _rulesSetupSpots(player) {
    return this.geometry.nodes.filter((n) => this._rulesFreeSpot(n.id) && (!this.sea || this.canBuildSettlement(player, n.id, true))).map((n) => n.id);
  },
  _rulesSetupSpot(player) { return this._rulesBestSpot(this._rulesSetupSpots(player)); },
  /** Set-up road: toward the best spot one step further along it (`out` gets each road's target). */
  _rulesSetupRoad(player, nodeId, out = null) {
    const node = this.geometry.nodes[nodeId];
    let best = null, fallback = null;
    node.edgeIds.forEach((edgeId) => {
      const edge = this.geometry.edges[edgeId];
      if (edge.owner != null) return;
      if (fallback == null) fallback = edgeId;
      const other = edge.nodes[0] === nodeId ? edge.nodes[1] : edge.nodes[0];
      if (this.geometry.nodes[other].structure != null) return;
      const t = this._rulesBestSpot(this.geometry.nodes[other].neighbors.filter((x) => x !== nodeId && this._rulesFreeSpot(x)));
      if (out) out.push({ id: edgeId, score: t ? t.pips + t.kinds / 10 : Number.NEGATIVE_INFINITY, target: t?.id ?? null });
      if (t && (!best || t.pips > best.t.pips || (t.pips === best.t.pips && t.kinds > best.t.kinds))) best = { edgeId, t };
    });
    return best ? best.edgeId : fallback;
  },

  // ── the turn: the checklist (read-only) ──
  /** Rules in order up to the first that matches: [{ n, title, ok, why, focus, run }]; later rules are not checked. */
  _rulesCheck(player) {
    const h = player.resources;
    const out = [];
    const push = (n, ok, why, run = null, focus = null) => { out.push({ n, title: RULES[n - 1][1], ok, why, run, focus }); return ok; };
    // 1. city
    {
      let why;
      if (!has(h, COST.city)) why = `can't afford (needs ${short(h, COST.city)})`;
      else if (!player.settlements.size) why = "no settlement to upgrade";
      else if (this.piecesLeft(player, "city") <= 0) why = "no cities left";
      if (why) push(1, false, why);
      else {
        const b = this._rulesBestSpot([...player.settlements]);
        if (push(1, true, `city on ${b.pips} pips`, () => this.tryBuildCity(player, b.id), { city: b.id })) return out;
      }
    }
    // 2. settlement
    {
      let why;
      const spots = has(h, COST.settlement) && this.piecesLeft(player, "settlement") > 0 ? this.geometry.nodes.filter((n) => this._rulesSpotOk(player, n.id)).map((n) => n.id) : [];
      if (!has(h, COST.settlement)) why = `can't afford (needs ${short(h, COST.settlement)})`;
      else if (this.piecesLeft(player, "settlement") <= 0) why = "no settlements left";
      else if (!spots.length) why = "no free spot on its roads";
      if (why) push(2, false, why);
      else {
        const b = this._rulesBestSpot(spots);
        if (push(2, true, `settlement on ${b.pips} pips`, () => this.tryBuildSettlement(player, b.id), { node: b.id })) return out;
      }
    }
    // 3. knight on the robber
    {
      const onUs = this.geometry.hexes[this.robberHexId]?.nodes.some((id) => this.geometry.nodes[id].owner === player.id);
      const knight = (player.devCards?.knight || 0) > 0;
      if (!onUs) push(3, false, "the robber isn't on its tiles");
      else if (!knight) push(3, false, `robber on its tile, but no Knight${(player.newDevCards?.knight || 0) > 0 ? " it may play yet" : ""}`);
      else if (!this.canPlayDevelopmentCard(player, "knight")) push(3, false, "already played a card this turn");
      else if (push(3, true, `robber on its ${this._hexLabel?.(this.geometry.hexes[this.robberHexId]) || "tile"}: plays the Knight`, () => this.playDevelopmentCard(player, "knight"), { hex: this.robberHexId })) return out;
    }
    // 4. road toward the nearest free spot
    {
      let why = null, target = null;
      if (!has(h, COST.road)) why = `can't afford (needs ${short(h, COST.road)})`;
      else if (this.piecesLeft(player, "road") <= 0) why = "no roads left";
      else if (this.geometry.nodes.some((n) => this._rulesSpotOk(player, n.id))) why = "a free spot is already on its roads: no road needed";
      else {
        const reach = this._aiRoadReach(player);
        let near = Infinity, ids = [];
        this.geometry.nodes.forEach((n) => {
          const d = reach.dist[n.id];
          if (!(d >= 1) || !Number.isFinite(d) || reach.first[n.id] == null || !this._rulesFreeSpot(n.id)) return;
          if (!this.canBuildRoad(player, reach.first[n.id], { free: false })) return;
          if (d < near) { near = d; ids = [n.id]; } else if (d === near) ids.push(n.id);
        });
        const b = this._rulesBestSpot(ids);
        if (!b) why = "no free spot it can reach";
        else target = { ...b, d: near, edge: reach.first[b.id] };
      }
      if (why) push(4, false, why);
      else if (push(4, true, `road toward ${target.pips} pips (${target.d} road${target.d > 1 ? "s" : ""} away)`, () => this._aiBuildRoad(player, target.edge), { node: target.id, edge: target.edge })) return out;
    }
    // 5. dev card
    {
      if (!has(h, COST.development)) push(5, false, `can't afford (needs ${short(h, COST.development)})`);
      else if (!this.devDeck.length) push(5, false, "the deck is empty");
      else if (push(5, true, "buys a development card", () => this.buyDevelopmentCard(player))) return out;
    }
    // 6. one bank / harbour trade that completes a city or settlement
    {
      const t = this._rulesTrade(player);
      if (!t.trade) push(6, false, t.why);
      else if (push(6, true, `${t.rate} ${RES_LABEL[t.give]} → 1 ${RES_LABEL[t.get]} completes a ${t.goal}`, () => this.performBankTrade(player, t.give, t.get))) return out;
    }
    push(7, true, "nothing else matched: ends the turn");
    return out;
  },

  _rulesTrade(player) {
    const h = player.resources;
    const goals = [];
    if (player.settlements.size && this.piecesLeft(player, "city") > 0) goals.push(["city", COST.city]);
    if (this.piecesLeft(player, "settlement") > 0 && this.geometry.nodes.some((n) => this._rulesSpotOk(player, n.id))) goals.push(["settlement", COST.settlement]);
    if (!goals.length) return { trade: false, why: "nothing a trade could complete" };
    for (const [goal, cost] of goals) {
      const miss = R5.filter((r) => (cost[r] || 0) > h[r]);
      const missN = miss.reduce((a, r) => a + cost[r] - h[r], 0);
      if (missN !== 1) continue;
      const get = miss[0];
      if (this.bank[get] < 1) continue;
      for (const give of R5) {
        if (give === get) continue;
        const rate = this.getPlayerTradeRate(player, give);
        if (h[give] - (cost[give] || 0) >= rate) return { trade: true, give, get, rate, goal };
      }
    }
    return { trade: false, why: "no single trade completes a city or settlement" };
  },

  /** One rulebook action (true when a rule other than "end turn" acted). */
  _rulesStep(player) {
    const list = this._rulesCheck(player);
    const fired = list[list.length - 1];
    if (fired.n === 7 || !fired.run) return false;
    const rec = this._aiRec() ? this._rulesDecision(player, list) : null;
    if (rec) rec.steps = this._aiStepsNow("build", player);
    const ok = fired.run();
    if (ok && rec) this._aiNote(rec);
    return !!ok;
  },

  /** Analysis decision object for a checklist (the panel's checklist + board highlight). */
  _rulesDecision(player, list, kind = "rules") {
    const fired = list[list.length - 1];
    const f = fired.focus || {};
    return { kind, pid: player.id, title: `Rule ${fired.n} · ${fired.title}`, score: null, dims: { placement: 0, expansion: 0, trading: 0, devCards: 0, awareness: 0 }, alts: [],
      note: fired.why, rules: list.map(({ n, title, ok, why }) => ({ n, title, ok, why })),
      nodes: f.node != null ? [{ id: f.node, s: 1 }] : [], cities: f.city != null ? [{ id: f.city, s: 1 }] : [], edges: f.edge != null ? [{ id: f.edge, s: 1 }] : [], hexes: f.hex != null ? [{ id: f.hex, s: 1, dmg: null }] : [],
      pick: { node: f.node, city: f.city, edge: f.edge, hex: f.hex } };
  },

  /** Player deals: yes only when the swap lets it build something right away it couldn't before. */
  _rulesTradeVerdict(player, theyGive, theyWant) {
    const h = player.resources;
    if (R5.some((r) => h[r] < (theyWant[r] || 0))) return { ok: false, why: "doesn't have the cards" };
    if (!R5.some((r) => theyGive[r] > 0) || !R5.some((r) => theyWant[r] > 0)) return { ok: false, why: "empty deal" };
    const after = { ...h };
    R5.forEach((r) => { after[r] += (theyGive[r] || 0) - (theyWant[r] || 0); });
    const can = (hand) => [
      ["city", player.settlements.size > 0 && this.piecesLeft(player, "city") > 0 && has(hand, COST.city)],
      ["settlement", this.piecesLeft(player, "settlement") > 0 && has(hand, COST.settlement) && this.geometry.nodes.some((n) => this._rulesSpotOk(player, n.id))],
      ["road", this.piecesLeft(player, "road") > 0 && has(hand, COST.road) && this.geometry.edges.some((e) => this.canBuildRoad(player, e.id, { free: true }))],
    ].filter(([, ok]) => ok).map(([k]) => k);
    const before = can(h), now = can(after).filter((k) => !before.includes(k));
    return now.length ? { ok: true, why: `lets it build a ${now[0]} now` } : { ok: false, why: "doesn't let it build right away" };
  },

  // ── the 7 ──
  _rulesDiscard(player, count) {
    const sel = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    const hand = { ...player.resources };
    for (let i = 0; i < count; i += 1) {
      const r = R5.reduce((a, x) => (hand[x] > (a ? hand[a] : 0) ? x : a), null);
      if (!r) break;
      hand[r] -= 1; sel[r] += 1;
    }
    this.payToBank(player, sel);
    return sel;
  },
  _rulesLeader(player, ids = null) {
    const pool = (ids || this.players.filter((p) => p.id !== player.id).map((p) => p.id)).map((id) => this.players[id]);
    let best = null;
    pool.forEach((p) => { if (!best || p.publicVictoryPoints > best.publicVictoryPoints) best = p; });
    return best;
  },
  /** Robber tiles with the rule's numbers: [{ id, own, pips (the leader's), any (all opponents') }] and the pick. */
  _rulesRobber(player) {
    const leader = this._rulesLeader(player);
    const legal = this._legalRobberHexes(player);
    const cands = legal.map((hex) => {
      const pips = hex.number && hex.resource !== "desert" ? PIPS[hex.number] || 0 : 0;
      let own = false, lead = 0, any = 0;
      hex.nodes.forEach((id) => {
        const n = this.geometry.nodes[id];
        if (n.owner == null || n.structure == null) return;
        const k = n.structure === "city" ? 2 : 1;
        if (n.owner === player.id) own = true;
        else { any += pips * k; if (leader && n.owner === leader.id) lead += pips * k; }
      });
      return { id: hex.id, own, lead, any };
    });
    let pick = null;
    cands.forEach((c) => { if (!c.own && (!pick || c.lead > pick.lead || (c.lead === pick.lead && c.any > pick.any))) pick = c; });
    return { leader, cands, pick: pick || cands[0] || null };
  },
};
