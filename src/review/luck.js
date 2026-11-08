// v1.24 Dice luck: how good were a player's rolls against what their tiles could be expected to pay? Pure maths, no DOM.
//
// Every roll is one independent draw of two dice (rule "random"). On a roll of n a player collects c(n) cards: the sum of 1 per
// settlement and 2 per city next to a tile numbered n that the robber does not sit on. With p(n) = pips(n) / 36:
//   expected cards per roll  e = Σ p(n) c(n)          variance per roll  v = Σ p(n) c(n)² − e²
// Over a game the rolls are independent, so the expected cards and the variances ADD UP (with the board as it stood at each roll).
// The cards collected are then close to normal: P(cards ≥ got) ≈ 1 − Φ((got − ½ − E) / √V), the "top x %". Measured against a
// simulation of dice in score121/../luck124 (tests/luck-unit.mjs): the simulated shares agree with this within about 1 point.
// "balanced" and "deck" dice are not independent (the deck evens the rolls out), so they get the cards over or under but no percentile.
export const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Moments of one roll for a player: cards = { number: cards paid on that number }. */
export function rollMoments(cards) {
  let e = 0, q = 0;
  for (const n of Object.keys(cards)) { const p = PIPS[n] / 36, c = cards[n]; e += p * c; q += p * c * c; }
  return { e, v: Math.max(0, q - e * e) };
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 erf, error < 1.5e-7). */
export function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z < 0 ? -y : y));
}

/** Chance that independent rolls pay at least `got` cards when E are expected with variance V (continuity corrected); null without variance. */
export function topShare(got, E, V) {
  if (!(V > 1e-9)) return null;
  return 1 - phi((got - 0.5 - E) / Math.sqrt(V));
}

/** Summary of one player. E1: expected with the robber where it stood, E0: without any robber, V: variance (robber as it stood). */
export function summary({ got, E1, E0, V, blockedN = 0, blockedCards = 0 }, independent = true) {
  const luck = got - E1, top = independent ? topShare(got, E1, V) : null;
  return { got, exp: E1, expFree: E0, luck, top, blockedN, blockedCards, sd: V > 0 ? Math.sqrt(V) : 0 };
}
/** "+7 cards" / "−3 cards" / "0 cards". */
export const cardsText = (x) => { const r = Math.round(x), n = Math.abs(r); return `${r > 0 ? "+" : r < 0 ? "−" : ""}${n} ${n === 1 ? "card" : "cards"}`; };
/** "top 12%" (lucky side) or "bottom 9%" (unlucky side); nothing when it is within the middle 30% or has no percentile. */
export function topText(top) {
  if (top == null) return "";
  const t = Math.round(top * 100);
  if (t >= 35 && t <= 65) return "about average";
  return top < 0.5 ? `top ${Math.max(1, t)}%` : `bottom ${Math.max(1, 100 - t)}%`;
}
