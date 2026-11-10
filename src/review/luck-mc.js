// v1.31 Luck in win chance, per chance event (engine side: the review's worker, or the Node harness).
//
// A chance event is a dice roll, a steal (a random card from the victim's hand) or a development card drawn. For every seat q:
//   luck_q = V_q(the outcome that happened) − Σ_o p(o) · V_q(o)
// over every possible outcome o with its probability p(o); V_q = seat q's win chance in the position right after o. Summed over the
// seats it is 0 for every event (every V sums to 1 over the seats). Summed over a game per seat: "luck in win-chance points".
//
// V: Monte Carlo with the review's leaf. From the position after o, `futures` futures of `depth` turn ends of normal bot play,
// scored by the boosted-tree model (src/master/leaf-gbm.js gbmProbs; 1 / 0 on a real win). Common random numbers: future j uses the
// same policy and dice streams after every outcome, so the differences between outcomes carry little noise. The post-game view:
// every hand is known (the recorded position); the dev deck order is reshuffled in each future. study-124 (301 positions, played-out
// truth): per roll the model alone r 0.41, MC 4 turns r 0.70, 8 turns r 0.79; steals MC r 0.8; card draws r 0.6.
// `fast`: the model straight on the position after each outcome (no futures): a first estimate, replaced by the MC.
//
// Outcomes: dice 2..12 (pips/36); sums whose positions are the same (nobody's hand changes the same way) are one outcome group and
// are played once. A 7 is its own group: discards, robber and steal by the bots' policy, a fresh flow in every future (its own
// steal is the separate steal event, so dice + steal = what happened). Steal: each card type the victim held (count / hand).
// Dev card: each card type still in the deck (count / deck). Rush positions are played turn by turn (src/review/engine.js).
import { snapshot, restore, mulberry32, withoutAgents } from "../master/sim.js";
import { gbmProbs } from "../master/leaf-gbm.js";
import { GBM_MODEL } from "../master/leaf-gbm-model.js";
import { fitProbs } from "../master/sim.js";
/** The leaf the review's search uses (opts.leaf: "gbm" picks the Seafarers model on a Seafarers board, src/master.js SEA_LEAF; "gbm0" the island model). */
const leafOf = (leaf) => (leaf === "gbm0" ? (g) => gbmProbs(g, GBM_MODEL) : leaf === "fit" || leaf === "fit2" ? (g) => fitProbs(g) : (g) => gbmProbs(g));
import { loadPosition } from "./engine.js";

// futures: the first batch; an event whose luck is still noisy (a seat's standard error above seMax) gets more, in batches, up to maxFutures
// (late in a game a single roll can decide it: those few events need more futures, the rest do not).
export const LUCK_MC = { futures: 25, maxFutures: 75, seMax: 0.015, depth: 5, flows7: 4, seed: 131 };
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const DEV = ["knight", "roadBuilding", "yearOfPlenty", "monopoly", "victoryPoint"];
const PIPS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The engine on the event's position. Every seat plays like the bots (a person's seat like the Expert). */
function load(g, base, ev) {
  const st = JSON.parse(ev.rec.st), humans = (st.players || []).map((p) => !!p?.isHuman);
  const seat = ev.kind === "dice" && ev.rush ? ev.roller : ev.rec.pid;
  loadPosition(g, { state: { ...st, ...base }, trk: ev.rec.trk, turnSerial: ev.rec.ts, seat });
  const H = g.constructor.labHelpers;
  g.players.forEach((p, i) => { if (humans[i] || !p.strategy) p.strategy = { ...H.AI_PRESETS.expert }; });
  return g;
}

// the position with what snapshot() leaves out that a roll touches
const snap = (g) => ({ s: snapshot(g), dr: g.diceResult ?? null, dd: Array.isArray(g.diceDeck) ? g.diceDeck.slice() : g.diceDeck, ld: g.lastDice });
const back = (g, x) => { restore(g, x.s); g.diceResult = x.dr; g.diceDeck = Array.isArray(x.dd) ? x.dd.slice() : x.dd; g.lastDice = x.ld; };

/** depth turn ends of normal play (every seat its own policy, weights jittered as the search does); the dice from their own stream. */
function play(g, turns, rng, dice, jitter = 0.15) {
  const orig = Math.random; Math.random = rng;
  const own = Object.prototype.hasOwnProperty.call(g, "rollDice"), keepDice = g.rollDice;
  g.rollDice = function () { const d1 = 1 + Math.floor(dice() * 6), d2 = 1 + Math.floor(dice() * 6); this.lastDiceTotal = d1 + d2; return { total: d1 + d2, d1, d2 }; };
  const keep = g.players.map((p) => p.strategy);
  g.players.forEach((p) => { if (jitter) { const w = { ...(p.strategy.w || {}) }; ["num", "variety", "scarcity", "port", "road", "prod", "patience", "card", "leader"].forEach((k) => { w[k] = (w[k] ?? 1) * Math.exp((rng() * 2 - 1) * jitter); }); p.strategy = { ...p.strategy, w }; } });
  try {
    let ended = 0;
    while (!g.winner && g.turn <= 250 && ended < turns) {
      if (g.phase === "sbp") { g._sbpRun(); continue; } // 5–6 players: the build window between turns (a card drawn there) runs on
      const p = g.currentPlayer;
      if (g.phase === "pre_roll") { g.maybePlayKnightBeforeRoll(p); g.executeRollPhase(p); }
      if (g.winner) break;
      if (g.phase === "main") g.executeAiMainPhase(p);
      if (g.winner) break;
      g.endTurn();
      ended += 1;
    }
  } finally {
    Math.random = orig;
    if (own) g.rollDice = keepDice; else delete g.rollDice;
    g.players.forEach((p, i) => { p.strategy = keep[i]; });
  }
}
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };

/** The chance of each sum for the next roll under the game's dice rule (settings.dice): "random" two dice; "deck" the 36-card deck
 *  without the cards drawn (a fresh deck when empty); "balanced" that deck (fresh at 12 left) with its repeat rule (a repeat of the
 *  last total is drawn again once, 30 %). */
export function diceOdds(g) {
  const mode = g.settings?.dice || "random", P = Array(13).fill(0);
  if (mode === "random") { for (let r = 2; r <= 12; r += 1) P[r] = PIPS[r] / 36; return P; }
  let deck = Array.isArray(g.diceDeck) ? g.diceDeck : [];
  if (deck.length <= (mode === "balanced" ? 12 : 0)) { deck = []; for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) deck.push([a, b]); }
  const N = deck.length, c = Array(13).fill(0);
  deck.forEach((d) => { c[d[0] + d[1]] += 1; });
  const last = g.lastDiceTotal;
  for (let r = 2; r <= 12; r += 1) {
    if (mode !== "balanced" || !(c[last] > 0) || N < 2) { P[r] = c[r] / N; continue; }
    // drawn first (kept unless it repeats and is drawn again), or a repeat drawn again and r the second card
    const first = r === last ? (c[r] / N) * 0.7 : c[r] / N;
    const second = (c[last] / N) * 0.3 * ((c[r] - (r === last ? 1 : 0)) / (N - 1));
    P[r] = first + second;
  }
  return P;
}

/** The outcomes of an event on the loaded engine: { branches: [{ o, p, make(rng), random }], act } or { skip }. */
function outcomes(g, ev) {
  if (ev.kind === "dice") {
    if (ev.via === "end") { // a game recorded before v1.31: the bot's roll from the turn before (its End turn, played here)
      withoutAgents(g, () => g.endTurn());
      if (g.phase !== "pre_roll" || g.currentPlayerIndex !== ev.roller) return { skip: "no position" };
    }
    if (ev.rush) { g.phase = "pre_roll"; g.currentPlayerIndex = ev.roller; g.pendingAction = null; }
    if (g.phase !== "pre_roll" || g.setupPhase) return { skip: "no position" };
    const roller = g.players[g.currentPlayerIndex];
    const make = (r) => (rng) => { const orig = Math.random; Math.random = rng; try { const d1 = Math.max(1, r - 6); g.diceResult = { total: r, d1, d2: r - d1 }; withoutAgents(g, () => g.executeRollPhase(roller)); } finally { Math.random = orig; } };
    const P = diceOdds(g), branches = [];
    for (let r = 2; r <= 12; r += 1) if (P[r] > 0 || r === ev.roll) branches.push({ o: r, p: P[r], make: make(r), random: r === 7 });
    return { branches, act: branches.findIndex((b) => b.o === ev.roll), group: true };
  }
  if (ev.kind === "steal") {
    g.pendingAction = null; g.robberContext = null; g.pendingRobberFlow = null;
    const T = g.players[ev.thief], V = g.players[ev.victim];
    if (!T || !V) return { skip: "no position" };
    const hex = g.geometry.hexes[ev.hex];
    if (hex) { if (g.sea && hex.resource === "sea") g.sea.pirateHexId = ev.hex; else g.robberHexId = ev.hex; }
    const tot = RES.reduce((a, r) => a + V.resources[r], 0);
    const types = RES.filter((r) => V.resources[r] > 0);
    if (!tot || !types.includes(RES[ev.res])) return { skip: "no position" };
    if (types.length < 2) return { skip: "one kind" };
    const branches = types.map((r) => ({ o: r, p: V.resources[r] / tot, make: () => { g._aiTrkSteal?.(V, T); V.resources[r] -= 1; T.resources[r] += 1; } }));
    return { branches, act: types.indexOf(RES[ev.res]) };
  }
  if (ev.kind === "dev") {
    const P = g.players[ev.pid], deck = g.devDeck;
    if (!P || !deck?.length || !deck.includes(ev.card)) return { skip: "no position" };
    const cnt = {}; deck.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
    const types = DEV.filter((t) => cnt[t]);
    if (types.length < 2) return { skip: "one kind" };
    const branches = types.map((t) => ({ o: t, p: cnt[t] / deck.length, make: () => {
      const d = g.devDeck, i = d.lastIndexOf(t); [d[i], d[d.length - 1]] = [d[d.length - 1], d[i]];
      if (!g.buyDevelopmentCard(P)) throw new Error("buy failed");
      g.recomputeScores(); g.checkForWinner(P);
    } }));
    return { branches, act: types.indexOf(ev.card) };
  }
  return { skip: "kind" };
}

/** A key for "the same position" after a non-random outcome: every hand, the bank and the pieces' counts. */
const posKey = (g) => JSON.stringify([g.players.map((p) => RES.map((r) => p.resources[r])), RES.map((r) => g.bank?.[r]), g.phase, g.pendingAction ?? null, g.winner ? g.winner.id : -1, g.sea ? [g.sea.gold, g.sea.pirateHexId] : null]);

/** v1.34 definition C (the user's): a roll is luck for a player only through what THAT player got. Seat q's luck is
 *    V_q(what happened) − Σ_o p(o) · V_q(what happened, but q's own cards from the roll as with sum o)
 *  the others' cards stay as they were. So a roll that pays someone else is their luck, not your bad luck. The position "as with o"
 *  is the real one after the roll with q's hand changed by (q's cards on o − q's cards on the real sum); a 7 pays nobody (its discards,
 *  robber and steal stay as they happened in every variant: the steal is its own event). Per future, the real outcome is played once
 *  and each seat's variants from it (common random numbers). The seats' values need not sum to 0. Returns the same shape as luckEvent
 *  with b: each seat's win chance before (the average over its variants). */
function diceOwn(g, ev, B, S0, o, leaf, evSeed, n, t0) {
  const hand0 = g.players.map((p) => RES.map((r) => p.resources[r]));
  // each seat's cards on each sum (from the position before the roll; a 7: none)
  const prod = B.branches.map((b) => {
    if (b.random) return g.players.map(() => [0, 0, 0, 0, 0]);
    back(g, S0); b.make(mulberry32(evSeed));
    return g.players.map((p, q) => RES.map((r, k) => p.resources[r] - hand0[q][k]));
  });
  const dA = prod[B.act];
  // per seat: its variants (sums with the same cards for that seat are one), the real one first
  const seats = Array.from({ length: n }, (_, q) => {
    const vs = [];
    B.branches.forEach((b, k) => {
      const d = prod[k][q].map((x, r) => x - dA[q][r]), key = d.join(",");
      let v = vs.find((x) => x.key === key);
      if (!v) { v = { key, d, p: 0, o: [], real: d.every((x) => x === 0) }; vs.push(v); }
      v.p += b.p; v.o.push(b.o);
    });
    vs.sort((a, b2) => (b2.real ? 1 : 0) - (a.real ? 1 : 0));
    return vs;
  });
  const W = []; // W[j] = { A: seats' values after the real outcome, H: [q][variant] seat q's value }
  const one = (j) => {
    const ps = (evSeed + Math.imul(j + 1, 0x9e3779b1)) | 0, ds = (evSeed ^ Math.imul(j + 1, 0x85ebca6b)) | 0, qs = (evSeed ^ Math.imul(j + 7, 0x27d4eb2f)) | 0;
    back(g, S0);
    withoutAgents(g, () => B.branches[B.act].make(mulberry32(ps)));
    const SA = snap(g);
    const run = (adj) => {
      back(g, SA);
      if (adj) { const P = g.players[adj.q]; RES.forEach((r, k) => { if (!adj.d[k]) return; P.resources[r] = Math.max(0, P.resources[r] + adj.d[k]); if (g.bank) g.bank[r] = Math.max(0, (g.bank[r] || 0) - adj.d[k]); }); }
      const rng = mulberry32(qs), dice = mulberry32(ds);
      withoutAgents(g, () => {
        const orig = Math.random; Math.random = rng; try { shuffle(g.devDeck, rng); } finally { Math.random = orig; }
        if (!g.winner) play(g, o.depth, rng, dice);
      });
      return leaf(g);
    };
    const A = run(null);
    const full = seats.map((vs, q) => vs.map((v) => (v.real ? A : run({ q, d: v.d })))); // every seat's win chance in each variant
    W.push({ A, H: full.map((vs, q) => vs.map((w) => w[q])), full });
  };
  const stats = (F) => {
    const L = [], se = [], b = [];
    for (let q = 0; q < n; q += 1) {
      const lj = W.map((w) => w.A[q] - seats[q].reduce((a, v, i) => a + v.p * w.H[q][i], 0));
      const m = lj.reduce((a, x) => a + x, 0) / F;
      L.push(m); se.push(F > 1 ? Math.sqrt(lj.reduce((a, x) => a + (x - m) ** 2, 0) / (F - 1) / F) : 0);
      b.push(W.reduce((a, w) => a + seats[q].reduce((c, v, i) => c + v.p * w.H[q][i], 0), 0) / F);
    }
    return { L, se, b };
  };
  let F = 0, target = o.futures;
  if (target > 0) {
    for (;;) {
      for (let j = F; j < target; j += 1) one(j);
      F = target;
      if (F >= (o.maxFutures || F) || Math.max(...stats(F).se) <= (o.seMax ?? 1)) break;
      target = Math.min(o.maxFutures, F + o.futures);
    }
  }
  const out = { kind: ev.kind, s: ev.s, n, own: 1, act: 0, groups: seats.map((vs) => vs.map((v) => ({ o: v.o, p: r4(v.p) }))), F, depth: o.depth };
  if (F) {
    const st = stats(F);
    // v1.34 the split the user asked for: cards (how many) and the rest (which ones, when). Per seat: cs = cards from this roll minus
    // the expected number; bt = win chance per card at this moment: the p-weighted slope of the variants' win chance on their card
    // count (null when every variant pays the same number). Page side: cards part = cards above expected × the mean bt, rest = luck − that.
    const cs = [], bt = [];
    for (let q = 0; q < n; q += 1) {
      const vs = seats[q], cA = dA[q].reduce((a, x) => a + x, 0);
      const c = vs.map((v) => cA + v.d.reduce((a, x) => a + x, 0)), V = vs.map((_, i) => W.reduce((a, w) => a + w.H[q][i], 0) / F);
      const mc = vs.reduce((a, v, i) => a + v.p * c[i], 0), mv = vs.reduce((a, v, i) => a + v.p * V[i], 0);
      const sxx = vs.reduce((a, v, i) => a + v.p * (c[i] - mc) ** 2, 0), sxy = vs.reduce((a, v, i) => a + v.p * (c[i] - mc) * (V[i] - mv), 0);
      cs.push(r4(cA - mc)); bt.push(sxx > 1e-9 ? r4(sxy / sxx) : null);
    }
    // ox: what the OTHERS' cards from this roll did to seat q (each other seat's own outcome against its expectation, read off q's win
    // chance in that seat's variants; summed over the other seats, without their interactions)
    const ox = Array.from({ length: n }, (_, q) => r4(W.reduce((a, w) => a + seats.reduce((t, vs, r) => (r === q ? t : t + w.A[q] - vs.reduce((u, v, i) => u + v.p * w.full[r][i][q], 0)), 0), 0) / F));
    Object.assign(out, { luck: st.L.map(r4), se: st.se.map(r4), b: st.b.map(r4), cs, bt, ox, runs: 1 + seats.reduce((a, vs) => a + vs.length - 1, 0) });
  }
  out.ms = Math.round(now() - t0);
  return out;
}

/** Luck of one event: { kind, s, n, groups: [{ o: [outcomes], p, fast, v }], act, luck, se, fast, F, depth, ms } or { skip }. */
export function luckEvent(g, base, ev, opts = {}) {
  const o = { ...LUCK_MC, ...opts };
  const t0 = now(), leaf = leafOf(o.leaf);
  const keepR = Math.random;
  try {
    load(g, base, ev);
    if (g.winner) return { kind: ev.kind, s: ev.s, skip: "over" };
    const B = outcomes(g, ev);
    if (B.skip) return { kind: ev.kind, s: ev.s, skip: B.skip };
    const n = g.players.length, S0 = snap(g);
    const evSeed = hash(`${o.seed}|${ev.kind}|${ev.s}|${ev.rec.e}|${ev.rec.pid}`);
    if (ev.kind === "dice" && o.own !== false) return diceOwn(g, ev, B, S0, o, leaf, evSeed, n, t0);
    // groups: outcomes that leave the same position (dice only; random ones stay apart)
    const groups = [];
    B.branches.forEach((b, k) => {
      let key = null;
      if (B.group && !b.random) { back(g, S0); b.make(mulberry32(evSeed)); key = posKey(g); }
      const gr = key != null ? groups.find((x) => x.key === key) : null;
      if (gr) { gr.o.push(b.o); gr.p += b.p; gr.k.push(k); } else groups.push({ key, o: [b.o], p: b.p, k: [k], b });
    });
    const act = groups.findIndex((x) => x.k.includes(B.act));
    if (act < 0) return { kind: ev.kind, s: ev.s, skip: "no outcome" };
    // the model straight on each outcome's position (a random outcome: the mean over a few flows)
    const fast = groups.map((gr) => {
      const m = gr.b.random ? o.flows7 : 1, acc = Array(n).fill(0);
      for (let f = 0; f < m; f += 1) { back(g, S0); gr.b.make(mulberry32(evSeed + 7919 * (f + 1))); const w = leaf(g); for (let q = 0; q < n; q += 1) acc[q] += w[q] / m; }
      return acc;
    });
    const luckOf = (V) => Array.from({ length: n }, (_, q) => V[act][q] - groups.reduce((a, gr, i) => a + gr.p * V[i][q], 0));
    const out = { kind: ev.kind, s: ev.s, n, act, groups: groups.map((gr, i) => ({ o: gr.o, p: r4(gr.p), fast: fast[i].map(r4) })), fast: luckOf(fast).map(r4), F: 0, depth: o.depth };
    if (o.futures > 0) {
      const W = groups.map(() => []);
      const seOf = (F) => Array.from({ length: n }, (_, q) => {
        const lj = W[act].map((_, j) => W[act][j][q] - groups.reduce((a, gr, i) => a + gr.p * W[i][j][q], 0));
        const m = lj.reduce((a, b) => a + b, 0) / F;
        return F > 1 ? Math.sqrt(lj.reduce((a, b) => a + (b - m) ** 2, 0) / (F - 1) / F) : 0;
      });
      let F = 0, target = o.futures;
      for (;;) {
      for (let j = F; j < target; j += 1) {
        const ps = (evSeed + Math.imul(j + 1, 0x9e3779b1)) | 0, ds = (evSeed ^ Math.imul(j + 1, 0x85ebca6b)) | 0;
        groups.forEach((gr, i) => {
          back(g, S0);
          const rng = mulberry32(ps), dice = mulberry32(ds);
          withoutAgents(g, () => {
            gr.b.make(rng);
            const orig = Math.random; Math.random = rng; try { shuffle(g.devDeck, rng); } finally { Math.random = orig; }
            if (!g.winner) play(g, o.depth, rng, dice);
          });
          W[i].push(leaf(g));
        });
      }
      F = target;
      if (F >= (o.maxFutures || F) || Math.max(...seOf(F)) <= (o.seMax ?? 1)) break;
      target = Math.min(o.maxFutures, F + o.futures);
      }
      const V = W.map((ws) => Array.from({ length: n }, (_, q) => ws.reduce((a, w) => a + w[q], 0) / F));
      const L = luckOf(V);
      const se = seOf(F);
      out.groups.forEach((gr, i) => { gr.v = V[i].map(r4); });
      Object.assign(out, { luck: L.map(r4), se: se.map(r4), F });
    }
    out.ms = Math.round(now() - t0);
    return out;
  } finally { Math.random = keepR; }
}

/** The chance events of a recorded game, in play order, from the review's records and the statistics log (page side: plain data).
 *  recs: the review records (whole, `st` as JSON); stats: { steps, ev } of game.stats. Each event carries the record it starts from. */
export function luckEvents(recs, stats, { rush = false } = {}) {
  const steps = stats?.steps || [], ev = stats?.ev || [], out = [];
  if (!Array.isArray(recs) || !recs.length || !steps.length) return out;
  // dice: the position just before roll s (0-based step index = steps recorded before it)
  const pre = new Map(), ends = new Map();
  recs.forEach((r, i) => {
    if (!r || r.s == null || typeof r.st !== "string") return;
    if (r.k === "roll" || r.k === "turn") pre.set(r.s, i);
    if (r.k === "end") ends.set(r.s, i); // (older games: the turn before a bot's roll)
  });
  for (let s = 0; s < steps.length; s += 1) {
    const st = steps[s], roll = st[2] + st[3], roller = st[1];
    let i = pre.get(s), via = null;
    if (i == null && !rush && ends.has(s) && roller >= 0) { i = ends.get(s); via = "end"; }
    if (i == null) continue;
    const r = recs[i];
    out.push({ kind: "dice", s, i, rec: r, roll, d: [st[2], st[3]], roller: rush || roller < 0 ? (r.a?.rush ? s % Math.max(1, (JSON.parse(r.st).players || []).length) : r.pid) : roller, rush: !!(rush || r.a?.rush), via, e: r.e });
  }
  // steals: the robber record of the thief, then the first steal by them in the same step before the next record
  recs.forEach((r, i) => {
    if (!r || typeof r.st !== "string") return;
    const nextE = recs.slice(i + 1).find((q) => q && q.e != null)?.e ?? ev.length;
    if (r.k === "robber" || r.k === "pirate") {
      for (let j = r.e; j < Math.min(ev.length, Math.max(nextE, r.e + 1) + 4); j += 1) {
        const e = ev[j]; if (!e || e[0] !== r.s) break;
        if (e[1] === "t" && e[2] === r.pid) { out.push({ kind: "steal", s: r.s, i, rec: r, thief: e[2], victim: e[3], res: e[4], hex: r.a?.hex, e: j }); break; }
      }
    } else if (r.k === "buy" || r.k === "sbpbuy") {
      for (let j = r.e; j < ev.length; j += 1) {
        const e = ev[j]; if (!e || e[0] !== r.s) break;
        if (e[1] === "v" && e[2] === r.pid) { out.push({ kind: "dev", s: r.s, i, rec: r, pid: r.pid, card: e[3], e: j }); break; }
      }
    }
  });
  return out.sort((a, b) => a.e - b.e || (a.kind === "dice" ? -1 : 1));
}
