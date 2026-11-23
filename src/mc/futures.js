// Monte Carlo toolkit (architecture step 6): futures. A future j of a run with seed `seed` owns three independent random streams, keyed by (seed, j):
//   policy  the bots' own choices (and the first random choices of a branch's start: a steal, a roll's payout)
//   dice    the rolls of the dice
//   deck    the order of the hidden development deck (a second, independent stream; the luck review's "one outcome, then every seat's variants")
// Two branches simulated under the SAME futures see the same dice and the same deck order (common random numbers): their difference carries
// little noise. The seed formulas are the review's (src/review/luck-mc.js, step-mc.js since v1.31): changing one changes every stored number.
import { mulberry32 } from "../master/sim.js";
export { mulberry32 };

/** The review's string hash (FNV-1a, 32 bits): a per-event seed from a text key. */
export const hash32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The seeds of future j (integers; mulberry32(seed) makes the stream). */
export const futureSeeds = (seed, j) => ({ j, policy: (seed + Math.imul(j + 1, 0x9e3779b1)) | 0, dice: (seed ^ Math.imul(j + 1, 0x85ebca6b)) | 0, deck: (seed ^ Math.imul(j + 7, 0x27d4eb2f)) | 0 });

/** futures({ seed, n?, offset? }): independent futures j = offset .. offset+n-1 (n omitted: as many as asked for by at(j)).
 *  F.at(j) → { j, policy, dice, deck } seeds; F.rngs(j) → fresh { policy, dice, deck } generators; F.slice(a, b) → the same futures, a window of them. */
export function futures({ seed, n = Infinity, offset = 0 }) {
  const F = {
    seed, n, offset,
    at: (j) => futureSeeds(seed, j + offset),
    rngs: (j) => { const s = futureSeeds(seed, j + offset); return { policy: mulberry32(s.policy), dice: mulberry32(s.dice), deck: mulberry32(s.deck) }; },
    slice: (a, b) => futures({ seed, n: b - a, offset: offset + a }),
  };
  return F;
}
