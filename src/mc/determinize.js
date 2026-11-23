// Monte Carlo toolkit: determinization of what a seat cannot see. `determinize` is a bit-for-bit port of src/master/sim.js determinize (the Master's
// hidden-information sampler): same draws from rng in the same order, so a seed gives the same world as before. It works on the game object
// (the headless engine's private copy); `view`-based, rule-exact versions come later (design 5.1).
import { RESOURCES, DEV_CARD_TYPES } from "../core/constants.js";
const sumRes = (r) => RESOURCES.reduce((a, k) => a + r[k], 0);

/** Resample what `me` cannot see: opponents' hand compositions (from the public card tracker, hand sizes kept), opponents' unplayed dev cards +
 *  hidden VP cards, and the dev deck order. Mutates g. */
export function determinize(g, me, rng) {
  g.players.forEach((p) => {
    if (p.id === me) return;
    const n = sumRes(p.resources);
    if (!n) return;
    const est = g._aiEstimate(p);
    RESOURCES.forEach((r) => { g.bank[r] += p.resources[r]; p.resources[r] = 0; });
    for (let k = 0; k < n; k++) {
      let tot = 0; const w = RESOURCES.map((r) => { const x = g.bank[r] > 0 ? Math.max(0.05, est[r] - p.resources[r]) : 0; tot += x; return x; });
      let u = rng() * tot, j = 0; while (j < 4 && u >= w[j]) { u -= w[j]; j++; }
      const r = RESOURCES[j]; p.resources[r]++; g.bank[r]--;
    }
  });
  const pool = g.devDeck.slice();
  const counts = [];
  g.players.forEach((p) => {
    if (p.id === me) return;
    const c = { dev: {}, nd: {}, vp: p.devVictoryPoints };
    DEV_CARD_TYPES.forEach((t) => { c.dev[t] = p.devCards[t]; c.nd[t] = p.newDevCards[t]; for (let k = 0; k < p.devCards[t] + p.newDevCards[t]; k++) pool.push(t); p.devCards[t] = 0; p.newDevCards[t] = 0; });
    for (let k = 0; k < p.devVictoryPoints; k++) pool.push("victoryPoint");
    p.victoryPoints -= p.devVictoryPoints; p.devVictoryPoints = 0;
    counts.push([p, c]);
  });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  counts.forEach(([p, c]) => {
    const deal = (into, n) => { for (let k = 0; k < n; k++) { const t = pool.pop(); if (t === "victoryPoint") { p.devVictoryPoints++; p.victoryPoints++; } else into[t]++; } };
    deal(p.devCards, DEV_CARD_TYPES.reduce((a, t) => a + c.dev[t], 0));
    deal(p.newDevCards, DEV_CARD_TYPES.reduce((a, t) => a + c.nd[t], 0));
    deal(p.devCards, c.vp);
  });
  g.devDeck = pool;
}

/** Fisher-Yates in place (the review's deck reshuffle: the post-game view knows every hand, only the deck's order is hidden). */
export const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };

/** Determinizer for the omniscient (review) view: reshuffle the dev deck only. */
export const reshuffleDeck = (g, rng) => shuffle(g.devDeck, rng);
