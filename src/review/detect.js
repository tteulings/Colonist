// v1.02 Post-game review, part 2: the "missed chances" detectors. They run after the game on a private
// headless engine (the Master Web Worker, or the Node harness), never on the game you played.
//
// Each detector reads the person's recorded positions (src/review.js) with the Expert's own instant
// planner (_aiPlan, _aiEta, _aiRobberCandidates) and keeps only clear cases (high thresholds):
//   build   ended the turn / bought a card / built a road while a clearly better city or settlement was
//           affordable (and was the planner's top goal): the planner's score gap, shown as the turns the
//           better build now comes later
//   seven   a 7 took ≥ 4 cards while, at the end of the turn before (holding ≥ the limit), a build or a bank / harbour trade that
//           doesn't delay the planner's top goal would have kept ≥ 3 of them (otherwise: saving for it)
//   robber  a robber tile far below the best one (Expert's robber score, in cards over ~10 rolls)
//   knight  a Knight held for ≥ 2 own turns while the robber sat on the person's best tile
// At most three, the biggest first; none when nothing passes.
export const DETECT = {
  buildGap: 0.9,     // planner score gap (value ÷ (turns + 1)) between the better build and what was done
  buildValue: 1.6,   // the better build is worth at least this (VP + production): a city or a good settlement
  sevenLoss: 4,      // cards lost to the 7
  sevenSaved: 3,     // cards a build / trade at the end of the turn before would have kept
  saveSlack: 0.5,    // a move that delays the top goal by more than this (turns) counts as "saving for it"
  robberGap: 4,      // Expert robber-score gap (leader-weighted cards over ~10 rolls)
  robberDmg: 2,      // and at least this many more cards blocked + stolen
  knightTurns: 2,    // own turns a playable Knight was held while blocked
  knightPips: 5,     // the blocked tile pays the person at least this (pips × 1 / 2 for a city)
  max: 3,
};
const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const RL = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const COST = { road: { wood: 1, brick: 1 }, settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 }, city: { wheat: 2, ore: 3 }, development: { sheep: 1, wheat: 1, ore: 1 } };
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const has = (h, c) => R5.every((r) => (h[r] || 0) >= (c[r] || 0));
const sub = (h, c) => { const o = { ...h }; R5.forEach((r) => { o[r] = (o[r] || 0) - (c[r] || 0); }); return o; };
const tot = (h) => R5.reduce((a, r) => a + (h?.[r] || 0), 0);
const r2 = (x) => Math.round(x * 100) / 100;

/** Run every detector over one game's records. `load(rec)` puts the engine on that position and returns the
 *  recorded seat (playing with the Expert's planner). Returns findings, biggest first, ≤ max per person. */
export function detectMissed(g, recs, load, o = {}) {
  const T = { ...DETECT, ...o };
  const out = [];
  const safe = (fn, ...a) => { try { return fn(g, recs, load, T, ...a); } catch (e) { if (T.debug) console.log("detector failed", fn.name, e); return []; } };
  out.push(...safe(detectBuild), ...safe(detectSeven), ...safe(detectRobber), ...safe(detectKnight));
  const byPid = new Map();
  out.sort((a, b) => b.size - a.size).forEach((f) => { const l = byPid.get(f.pid) || []; if (l.length < T.max) l.push(f); byPid.set(f.pid, l); });
  return [...byPid.values()].flat().sort((a, b) => b.size - a.size);
}

// ── helpers on a loaded position ──
const nameOf = (g, pid, me) => (pid === me ? "you" : g.players[pid].name);
const goalName = (g, x) => (x.type === "city" ? `City on ${g._spotLabel(x.nodeId)}` : x.type === "settlement" ? `Settlement on ${g._spotLabel(x.nodeId)}${x.dist ? ` (+${x.dist} road${x.dist > 1 ? "s" : ""})` : ""}` : x.type === "dev" ? "Development card" : x.type === "road" ? "Longest Road" : x.label);
const goalFocus = (x) => (x.type === "city" ? { city: x.nodeId } : x.type === "settlement" ? { node: x.nodeId, ...(x.dist && x.edge != null ? { edge: x.edge } : {}) } : x.type === "road" && x.edge != null ? { edge: x.edge } : null);
const vpGoalsNow = (g, p, plan, hand) => plan.goals.filter((x) => (x.type === "city" || (x.type === "settlement" && !x.dist)) && has(hand, x.cost)
  && (x.type === "city" ? p.settlements.has(x.nodeId) : g.canBuildSettlement(p, x.nodeId, false)));
/** The planner's split of a goal's score, for the A/B table (same terms as the AI Lab's Choice step). */
const terms = (x, div) => [
  { k: "vp", label: x.type === "dev" ? "Card value" : "Points", v: r2(x.parts?.vp ?? x.vp) },
  { k: "prod", label: "Production", v: r2((x.parts?.prod || 0) + (x.parts?.horizon || 0)) },
  ...(x.parts?.win ? [{ k: "win", label: "Wins the game", v: r2(x.parts.win) }] : []),
  { k: "eta", label: "÷ (turns + 1)", v: r2(div), div: true },
];
const sameTurnBuild = (recs, i, pred) => { const r = recs[i]; for (let j = i + 1; j < recs.length; j++) { const q = recs[j]; if (q.pid !== r.pid || q.ts !== r.ts) break; if (pred(q)) return true; } return false; };

// ── 1. a clearly better build was affordable ──
function detectBuild(g, recs, load, T) {
  const out = [];
  recs.forEach((r, i) => {
    const road = r.k === "build" && r.a.type === "road" && !r.a.free;
    if (!(r.k === "end" || r.k === "buy" || road)) return;
    const p = load(r);
    const plan = g._aiPlan(p);
    const hand = { ...p.resources };
    const top = plan.goals[0];
    const A = vpGoalsNow(g, p, plan, hand).sort((a, b) => b.score - a.score)[0];
    if (!A || !top || A.score < top.score - 1e-9 || A.value < T.buildValue) return; // the planner would rather save for something else
    const off = plan.W.etaOffset;
    let after = hand, B, did, bTerms, sb;
    if (r.k === "end") {
      did = "Ended your turn";
      B = { label: "Wait a turn" };
      sb = A.value / (1 + off);
      bTerms = terms(A, 1 + off);
    } else if (r.k === "buy") {
      after = sub(hand, COST.development);
      const dev = plan.goals.find((x) => x.type === "dev");
      did = "Bought a development card";
      B = dev || { label: "Development card" };
      sb = dev ? dev.score : 0;
      bTerms = dev ? terms(dev, dev.eta + off) : [];
    } else {
      after = sub(hand, COST.road);
      const via = plan.goals.find((x) => x.edge === r.a.id);
      did = via ? `Built a road toward ${via.type === "road" ? "Longest Road" : g._spotLabel(via.nodeId)}` : "Built a road";
      B = via || { label: "Road" };
      sb = via ? via.score : 0;
      bTerms = via ? terms(via, via.eta + off) : [{ k: "vp", label: "Points", v: 0 }];
    }
    if (r.k !== "end" && has(after, A.cost)) return; // the better build was still possible afterwards
    if (sameTurnBuild(recs, i, (q) => q.k === "build" && (q.a.type === "city" || q.a.type === "settlement"))) return;
    const gap = A.score - sb;
    if (gap < T.buildGap) return;
    const eta = r.k === "end" ? 1 : Math.max(1, g._aiEta(A.cost, after, plan.incTurn, plan.rates));
    const turns = Math.max(1, Math.round(eta));
    const nm = goalName(g, A);
    const cards = r2(A.prod * plan.R);
    const why = A.type === "city"
      ? `A city on ${g._spotLabel(A.nodeId)} was affordable: a point now and about ${cards.toFixed(1)} more cards every round. ${r.k === "end" ? "Waiting gives a turn of that away." : `Now it comes about ${turns} turn${turns > 1 ? "s" : ""} later.`}`
      : `A settlement on ${g._spotLabel(A.nodeId)} was affordable: a point now and about ${cards.toFixed(1)} more cards every round. ${r.k === "end" ? "Waiting a turn also lets someone else take the spot." : `Now it comes about ${turns} turn${turns > 1 ? "s" : ""} later.`}`;
    // the same build still waiting on a later turn: one line (the first time), "again" noted
    const prev = out.find((x) => x.pid === r.pid && x.better === nm && x.lastT >= r.t - 1);
    if (prev) { prev.lastT = r.t; prev.again = [...(prev.again || []), r.t]; prev.why = prev.why.replace(/( Still in reach in turn.*)?$/, ` Still in reach in turn${prev.again.length > 1 ? "s" : ""} ${prev.again.join(", ")}.`); return; }
    out.push({ kind: "build", pid: r.pid, i, t: r.t, lastT: r.t, s: r.s, e: r.e, size: gap * 3,
      line: `${nm} was in reach`, gain: `≈${turns} turn${turns > 1 ? "s" : ""}`, gainLong: `about ${turns} turn${turns > 1 ? "s" : ""} sooner`,
      did, better: nm, why, hand,
      cmp: { a: nm, b: r.k === "end" ? `${nm}, next turn` : goalName(g, B), rows: mergeRows(terms(A, A.eta + off), bTerms), sa: r2(A.score), sb: r2(sb), total: "Score" },
      focus: { a: goalFocus(A), b: r.k === "build" ? { edge: r.a.id } : null } });
  });
  return out;
}
function mergeRows(a, b) {
  const keys = [...new Set([...a, ...b].map((x) => x.k))];
  return keys.map((k) => { const x = a.find((y) => y.k === k), y = b.find((z) => z.k === k); const s = x || y; return { k, label: s.label, a: x ? x.v : 0, b: y ? y.v : 0, div: !!s.div }; });
}

// ── 2. cards lost to a 7 that a move the turn before would have kept ──
function detectSeven(g, recs, load, T) {
  const out = [];
  recs.forEach((d, i) => {
    if (d.k !== "discard") return;
    const n = d.a.n;
    if (!(n >= T.sevenLoss)) return;
    let j = i - 1;
    while (j >= 0 && !(recs[j].pid === d.pid && recs[j].k === "end")) j--;
    if (j < 0 || recs.slice(j + 1, i).some((q) => q.pid === d.pid && q.k === "discard")) return; // one 7 per held hand
    const e = recs[j];
    const pd = load(d);
    const T7 = tot(pd.resources);
    const limit = g._discardLimit();
    const lossAt = (k) => (k > limit ? Math.floor(k / 2) : 0);
    const p = load(e);
    const plan = g._aiPlan(p);
    const hand = { ...p.resources };
    if (tot(hand) < limit) return; // well under the limit then: production pushed it over, not a held hand
    const G = plan.goals[0];
    const ms = [];
    // builds
    vpGoalsNow(g, p, plan, hand).forEach((x) => ms.push({ label: goalName(g, x), cost: x.cost, spent: tot(x.cost), focus: goalFocus(x), goal: x }));
    if (has(hand, COST.road) && g.piecesLeft(p, "road") > 0) {
      // a road toward the planned spot is a step of the plan itself (else any legal road)
      const toward = G?.type === "settlement" && G.dist > 0 && G.edge != null && g.canBuildRoad(p, G.edge, { free: false }) ? G.edge : null;
      const edge = toward ?? g.geometry.edges.find((ed) => g.canBuildRoad(p, ed.id, { free: false }))?.id;
      if (edge != null) ms.push({ label: toward != null ? `A road toward ${g._spotLabel(G.nodeId)}` : "A road", cost: COST.road, spent: 2, focus: { edge }, step: toward != null });
    }
    if (has(hand, COST.development) && g.devDeck.length) ms.push({ label: "A development card", cost: COST.development, spent: 3, focus: null });
    // bank / harbour trades of surplus (the new card is what the top goal needs most)
    if (plan.rates) {
      const need = G ? R5.filter((r) => (G.cost[r] || 0) > hand[r]).sort((a, b) => (G.cost[b] - hand[b]) - (G.cost[a] - hand[a])) : [];
      R5.forEach((give) => {
        const rate = plan.rates[give];
        for (let k = 1; k <= 2; k++) {
          if (hand[give] - (G?.cost[give] || 0) < rate * k) break;
          const get = need.find((x) => x !== give && g.bank[x] >= k) || R5.find((x) => x !== give && g.bank[x] >= k);
          if (!get) break;
          const cost = { [give]: rate * k, [get]: -k };
          ms.push({ label: `${k > 1 ? `Two ${rate}:1 trades` : `A ${rate}:1 trade`} (${rate * k} ${RL[give]} → ${k} ${RL[get]})`, cost, spent: (rate - 1) * k, focus: null, trade: true });
        }
      });
    }
    let best = null;
    ms.forEach((m) => {
      const h2 = sub(hand, m.cost);
      if (G && m.goal !== G) {
        const eta2 = g._aiEta(m.step ? sub(G.cost, COST.road) : G.cost, h2, plan.incTurn, plan.rates);
        if (eta2 - G.eta > T.saveSlack) return; // would delay what the planner is saving for
      }
      const left = T7 - m.spent;
      const saved = n - lossAt(left);
      if (!best || saved > best.saved || (saved === best.saved && m.spent < best.m.spent)) best = { m, saved, left, loss: lossAt(left) };
    });
    if (!best || best.saved < T.sevenSaved) return;
    const m = best.m;
    out.push({ kind: "seven", pid: d.pid, i: j, t: e.t, s: e.s, e: e.e, size: best.saved, seven: { t: d.t, s: d.s }, n, T7,
      line: `Held ${T7} cards into a 7`, gain: `${n} cards`, gainLong: best.saved >= n ? `all ${n} cards kept` : `${best.saved} of ${n} cards kept`,
      did: `Ended the turn with ${tot(hand)} cards`, better: m.label.replace(/^A /, "").replace(/^(.)/, (c) => c.toUpperCase()),
      why: `A 7 in turn ${d.t} took ${n} of your ${T7} cards (over ${limit}, half go). ${m.label} at the end of this turn would have left ${best.left}${best.loss ? `, so only ${best.loss} lost` : `: safe`}.`,
      hand,
      cmp: { a: m.label.replace(/^A /, "").replace(/^(.)/, (c) => c.toUpperCase()), b: `Ended with ${tot(hand)} cards`, total: "Cards lost", lowerBetter: true,
        rows: [{ k: "sets", label: "Cards at the 7", a: best.left, b: T7, int: true }, { k: "build", label: m.trade ? "Traded away" : "Spent on it", a: m.spent, b: 0, int: true }],
        sa: best.loss, sb: n, int: true },
      focus: { a: m.focus, b: null } });
  });
  return out;
}

// ── 4. a robber tile much worse than the best ──
function detectRobber(g, recs, load, T) {
  const out = [];
  recs.forEach((r, i) => {
    if (r.k !== "robber") return;
    const p = load(r);
    const legal = g._legalRobberHexes(p);
    const cs = g._aiRobberCandidates(p, legal);
    const mine = cs.find((c) => c.id === r.a.hex);
    const best = cs.slice().sort((a, b) => b.score - a.score)[0];
    if (!mine || !best || best.id === mine.id) return;
    const gap = best.score - mine.score, dmg = best.dmg - mine.dmg;
    if (gap < T.robberGap || dmg < T.robberDmg) return;
    const victimOf = (hexId) => { const w = new Map(); g.geometry.hexes[hexId].nodes.forEach((nid) => { const nd = g.geometry.nodes[nid]; if (nd.owner != null && nd.owner !== p.id) w.set(nd.owner, (w.get(nd.owner) || 0) + (nd.structure === "city" ? 2 : 1)); }); return [...w.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
    const hexTxt = (hexId) => { const h = g.geometry.hexes[hexId]; const v = victimOf(hexId); return v != null && h.number ? `${g.players[v].name}’s ${h.number}` : g._hexName(hexId); };
    const nb = hexTxt(best.id), nm = hexTxt(mine.id);
    const rows = [["block", "Cards blocked"], ["leader", "Hits the leader"], ["own", "Your own tiles"], ["steal", "The steal"]]
      .map(([k, label]) => ({ k, label, a: r2(best.parts[k] || 0), b: r2(mine.parts[k] || 0) })).filter((x) => x.a || x.b);
    out.push({ kind: "robber", pid: r.pid, i, t: r.t, s: r.s, e: r.e, size: gap / 2,
      line: `Robber on ${nb}`, gain: `≈${Math.round(dmg)} cards`, gainLong: `about ${Math.round(dmg)} more cards blocked`,
      did: `Robber on ${nm}`, better: `Robber on ${nb}`,
      why: `On ${g._hexName(best.id)} the robber blocks about ${best.dmg.toFixed(1)} cards over the next ~10 rolls (with the steal); on ${g._hexName(mine.id)} ${mine.dmg < 0.5 ? "almost none" : `about ${mine.dmg.toFixed(1)}`}.`,
      hand: { ...p.resources },
      cmp: { a: `Robber on ${nb}`, b: `Robber on ${nm}`, rows, sa: r2(best.score), sb: r2(mine.score), total: "Score" },
      focus: { a: { hex: best.id }, b: { hex: mine.id } } });
  });
  return out;
}

// ── 7. a Knight held while the robber blocked your best tile ──
function detectKnight(g, recs, load, T) {
  const out = [];
  const runs = new Map(); // pid -> { start rec index, hex, turns, w }
  const close = (pid) => {
    const run = runs.get(pid);
    runs.delete(pid);
    if (!run || run.turns < T.knightTurns) return;
    const r = recs[run.i];
    const cards = (run.w / 36) * run.R * run.turns;
    out.push({ kind: "knight", pid, i: run.i, t: r.t, s: r.s, e: r.e, size: cards,
      line: `Knight held, robber on your ${run.num}`, gain: `≈${Math.round(cards)} cards`, gainLong: `about ${Math.round(cards)} cards back`,
      did: "Kept the Knight", better: "Play the Knight",
      why: `The robber sat on your best tile (${run.name}) for ${run.turns} of your turns while you held a Knight. Playing it moves the robber away (and steals a card).`,
      hand: run.hand, cmp: { a: "Play the Knight", b: "Kept the Knight", total: "Cards blocked", lowerBetter: true, int: true,
        rows: [{ k: "block", label: "Blocked per round", a: 0, b: r2((run.w / 36) * run.R) }], sa: 0, sb: Math.round(cards) },
      focus: { a: { hex: run.hex }, b: null } });
  };
  recs.forEach((r, i) => {
    if (r.k !== "turn") return;
    const st = JSON.parse(r.st);
    const me = st.players[r.pid];
    const knight = (me.devCards?.knight || 0) > 0;
    const playedNow = sameTurnBuild(recs, i, (q) => q.k === "play" && q.a.t === "knight");
    const p = load(r);
    // the person's best tile, by what it pays them
    const w = new Map();
    [...p.settlements, ...p.cities].forEach((nid) => g.geometry.nodes[nid].adjacentHexes.forEach((hid) => { const h = g.geometry.hexes[hid]; if (!PIPS[h.number]) return; w.set(hid, (w.get(hid) || 0) + PIPS[h.number] * (p.cities.has(nid) ? 2 : 1)); }));
    const bestHex = [...w.entries()].sort((a, b) => b[1] - a[1])[0];
    const blocked = bestHex && g.robberHexId === bestHex[0] && bestHex[1] >= T.knightPips;
    const run = runs.get(r.pid);
    if (blocked && knight && !playedNow && (!run || run.hex === g.robberHexId)) {
      if (run) run.turns++;
      else runs.set(r.pid, { i, hex: g.robberHexId, turns: 1, w: bestHex[1], R: g.players.length, num: g.geometry.hexes[g.robberHexId].number, name: g._hexName(g.robberHexId), hand: { ...p.resources } });
    } else close(r.pid);
  });
  [...runs.keys()].forEach(close);
  return out;
}
