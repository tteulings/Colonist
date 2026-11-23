// Monte Carlo toolkit: simulate. Plays futures of a position on a headless game object (the Web Worker's / Node harness's private copy),
// every seat with its own bot policy, to a horizon (turn ends) or the end of the game, and scores the end with a leaf.
// Until step 7 (engine-core) a "world" is the game object plus snapshot / restore (src/master/sim.js, the same speed as before).
//
//   const world = capture(g);                                     // the position (snapshot + what a roll touches)
//   const r = simulate({ g, world, F: futures({ seed }), n: 25, branches: [{ start: (g, rng) => ... }], turns: 7, leaf, collect: [leafMean(n)] });
//   r.samples[b][j]   leaf vector of branch b in future j
import { snapshot, restore, withoutAgents } from "../master/sim.js";
import { mulberry32 } from "./futures.js";
import { shuffle } from "./determinize.js";

const JITTER_KEYS = ["num", "variety", "scarcity", "port", "road", "prod", "patience", "card", "leader"];

/** The position as a value: snapshot() plus what a roll touches that snapshot leaves out (the dice result, the dice deck, the last dice). */
export const capture = (g) => ({ s: snapshot(g), dr: g.diceResult ?? null, dd: Array.isArray(g.diceDeck) ? g.diceDeck.slice() : g.diceDeck, ld: g.lastDice });
/** Put a captured position back on g (any number of times). */
export const reinstate = (g, x) => { restore(g, x.s); g.diceResult = x.dr; g.diceDeck = Array.isArray(x.dd) ? x.dd.slice() : x.dd; g.lastDice = x.ld; };

/** `turns` turn ends of normal play: every seat plays its own strategy (weights jittered by ±jitter, as the search does), the dice from their own
 *  stream `dice`, every other random choice of the bots from `rng`. Stops early on a win or after 250 rounds. */
export function playTurns(g, turns, rng, dice, jitter = 0.15, onEnd = null) {
  const orig = Math.random; Math.random = rng;
  const own = Object.prototype.hasOwnProperty.call(g, "rollDice"), keepDice = g.rollDice;
  g.rollDice = function () { const d1 = 1 + Math.floor(dice() * 6), d2 = 1 + Math.floor(dice() * 6); this.lastDiceTotal = d1 + d2; return { total: d1 + d2, d1, d2 }; };
  const keep = g.players.map((p) => p.strategy);
  g.players.forEach((p) => { if (jitter) { const w = { ...(p.strategy.w || {}) }; JITTER_KEYS.forEach((k) => { w[k] = (w[k] ?? 1) * Math.exp((rng() * 2 - 1) * jitter); }); p.strategy = { ...p.strategy, w }; } });
  try {
    let ended = 0;
    while (!g.winner && g.turn <= 250 && ended < turns) {
      if (g.phase === "sbp") { g._sbpRun(); continue; } // 5-6 players: the build window between turns (a card drawn there) runs on
      const p = g.currentPlayer;
      if (g.phase === "pre_roll") { g.maybePlayKnightBeforeRoll(p); g.executeRollPhase(p); }
      if (g.winner) break;
      if (g.phase === "main") g.executeAiMainPhase(p);
      if (g.winner) break;
      g.endTurn();
      if (onEnd) onEnd(p); // a collector's hook (the feature trace of src/review/why-mc.js)
      ended += 1;
    }
  } finally {
    Math.random = orig;
    if (own) g.rollDice = keepDice; else delete g.rollDice;
    g.players.forEach((p, i) => { p.strategy = keep[i]; });
  }
}

/** One future from the current position of g, with the agents off (a search never nests a search; timers muted): `start(g)` first (a branch's
 *  first move or forced chance outcome), then the hidden deck is re-dealt (`determinize(g, rng)`; false: not), then `turns` turn ends of play when
 *  `when(g)` holds (default: nobody has won). */
export function rollFuture(g, { rng, dice, turns = 7, jitter = 0.15, start = null, determinize = (gg, r) => shuffle(gg.devDeck, r), when = null, onEnd = null }) {
  withoutAgents(g, () => {
    if (start) start(g, rng);
    if (determinize) determinize(g, rng);
    if (when ? when(g) : !g.winner) playTurns(g, turns, rng, dice, jitter, onEnd);
  });
}

/** futures j0 .. j1-1 of every branch from the position `world`. The Math.random of the caller is kept. Returns { samples, j0, j1, ms }.
 *  opts: g, world (capture(g)), F (futures()), j0 = 0, j1 (or n: j0 + n), branches = [{ start?(g, rng) }] (default: one branch, no start),
 *  turns = 7, jitter = 0.15, determinize (see rollFuture), when, leaf(g) → number[] (default: the winner's one-hot), collect = [collectors],
 *  headless = true (detach the presentation: nothing is shown, heard or animated). */
export function simulate(o) {
  const { g, world, F, branches = [{}], turns = 7, jitter = 0.15, determinize, when, collect = [], headless = true } = o;
  const j0 = o.j0 ?? 0, j1 = o.j1 ?? (j0 + (o.n ?? 1));
  const leaf = o.leaf || ((gg) => gg.players.map((p) => (gg.winner && gg.winner.id === p.id ? 1 : 0)));
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (headless && typeof g.detachPresentation === "function") g.detachPresentation(); // idempotent; a prepared engine (prepareEngine) is already headless
  const samples = branches.map(() => []), keepR = Math.random;
  collect.forEach((c) => c.attach?.(g));
  try {
    for (let j = j0; j < j1; j += 1) {
      const fut = F.at(j);
      branches.forEach((br, b) => {
        collect.forEach((c) => c.before?.(b, j));
        reinstate(g, world);
        collect.forEach((c) => c.begin?.(g, b, j)); // (after the position is back, before the branch's first move: a tracer installs its observers here)
        const hooks = collect.map((c) => c.hook).filter(Boolean), onEnd = hooks.length ? (pl) => hooks.forEach((h) => h(pl)) : null;
        try { rollFuture(g, { rng: mulberry32(fut.policy), dice: mulberry32(fut.dice), turns, jitter, determinize, when, start: br.start, onEnd }); } catch (e) { collect.forEach((c) => c.abort?.(g)); throw e; }
        const v = leaf(g);
        samples[b].push(v);
        collect.forEach((c) => c.add(b, j, g, v));
      });
    }
  } finally { Math.random = keepR; collect.forEach((c) => c.detach?.(g)); }
  return { samples, j0, j1, ms: (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0 };
}
