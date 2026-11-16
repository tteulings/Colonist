// v1.88 Dutch, round 2 (native-reviewer fixes): sentences with a counted/lettered number, dice words, Rush timing. Terms: src/i18n-glossary.md.
const W = { 2: "twos", 3: "threes", 4: "fours", 5: "fives", 6: "sixes", 7: "sevens", 8: "eights", 9: "nines", 10: "tens", 11: "elevens", 12: "twelves" };
const O = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const dice = [];
for (const k of Object.keys(W)) {
  dice.push([`${cap(W[k])} came {n}×, expected {m}`, `Een ${k} kwam {n}×, verwacht {m}`], [`${cap(W[k])} came {n}× in turn {m}`, `Een ${k} kwam {n}× in beurt {m}`], [`${cap(W[k])} came {n}× in a row of rolls`, `Een ${k} kwam {n}× in een reeks worpen`],
    [`No ${O[k]} at all, expected {n}`, `Geen enkele ${k}, verwacht {n}`], [`Only {n} ${O[k]}, expected {m}`, `Slechts {n}× een ${k}, verwacht {m}`], [`Only {n} ${W[k]}, expected {m}`, `Slechts {n}× een ${k}, verwacht {m}`]);
}
export const NL_R2 = [
  ...dice,
  ["Total · {n} rolls, {m} steals, {k} card draws", "Totaal · {n} worpen, {m} keer een kaart gepakt, {k} getrokken kaarten"],
  ["{n} of {m}", "{n} van {m}"],
  ["{n} knight played ({m}+ to take Largest army)", "{n} ridder gespeeld ({m}+ voor de grootste riddermacht)"], ["{n} knights played ({m}+ to take Largest army)", "{n} ridders gespeeld ({m}+ voor de grootste riddermacht)"],
  ["{x} Code {y}.", "{x} Code {y}."], ["v{x} engine ({y})", "v{x} motor ({y})"],
  ["tap", "tik"], ["click", "klik"],
];
