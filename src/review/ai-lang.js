// v1.84 Words of the dynamic AI page (EN / NL). The page follows the Recap language setting (recapLang in src/review-recap.js).
// Everything the page says itself lives here: titles, notes, labels, chart words, the turn sheet, verdict words. Numbers never do (they are refs).
const DEV = { en: { knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "a point card" }, nl: { knight: "een ridder", roadBuilding: "Wegenbouw", yearOfPlenty: "Jaar van overvloed", monopoly: "Monopolie", victoryPoint: "een puntenkaart" } };
const plural = (n, a, b) => (n === 1 ? a : b);
export const LANG = {
  en: {
    you: "You", lv: { Game: "Game", "Near miss": "Near miss", Decision: "Decision", Strategy: "Strategy", Luck: "Luck" },
    res: { wood: "wood", brick: "brick", sheep: "sheep", wheat: "wheat", ore: "ore" }, abbr: { wood: "Wo", brick: "Br", sheep: "Sh", wheat: "Wh", ore: "Or" },
    plan: { X: "expanding", C: "cities and cards", M: "a mix" },
    verdict: { weak: "Weak plan", "probably-weak": "Probably weak plan", solid: "Solid plan", "probably-solid": "Probably solid plan", unclear: "Hard to say" },
    conf: { clear: "Clearly better", lean: "Probably better", close: "Close call" },
    headless: "Headless chicken", yes: "Yes", partly: "Partly", no: "No",
    turn: "turn", Turn: "Turn", setup: "set-up", more: "More", details: "Details", foot: "Summary from this game's numbers. Beta.", footAi: "Composed for this game from its numbers. Beta.", composing: "Composing a page for this game", of: "of",
    fuWork: "Putting a picture together", fuNone: "No picture for this one, so here is the written answer.", fuFail: "No answer this time.", fuAsked: "Your question", bd: { played: "Played", better: "Better", alt: "Option", paid: "Paid out", robber: "Robber", pirate: "Pirate", marked: "Marked", res: { wood: "Wood", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore", desert: "Desert", gold: "Gold" }, aria: "Board" },
    winChance: "Win chance", winChanceBy: "Win chance by turn", tapDot: "Tap a dot to open that turn", points: "Points", pointsBy: "Points by turn", plan_: "plan", pivot: "pivot",
    src: { s: "Settlement", c: "City", L: "Longest road", A: "Largest army", v: "Point card" }, srcPl: { s: "Settlements", c: "Cities", L: "Longest road", A: "Largest army", v: "Point cards", I: "New islands" },
    road: "Road", stalled: "Stalled", planL: "Plan", hand: "Cards in hand", handBy: "Cards in hand by turn", otherTurns: "Other turns", built: "Built something",
    rolled: "Times rolled", diceNr: "Dice number", rolledL: "Rolled", expected: "Expected", diceAria: "Dice rolls",
    pointsBySrc: "Points by source", haveOf: (a, b) => `${a} of ${b}`, dashed: " (dashed: still needed)",
    tStalled: "Stalled turns", startFeeds: "Start feeds the plan", short: "Short at the end", tbl: { dice: "Dice", steal: "Steals", draw: "Cards", seat: "Seat" },
    why: "Why?", prev: "Previous turn", next: "Next turn", nothing: "Nothing moved much this turn.", wcIn: "Win chance in this turn", open: (s) => `Open ${s}`, board: "Show the board", close: "Close",
    built1: (c) => `built a ${c === "c" ? "city" : "settlement"}.`,
    cause: (c, nm) => (c.kind === "dice" ? `rolled ${c.data.roll}` : c.kind === "steal" ? `stole a card from ${nm(c.data.victim)}` : c.kind === "dev" ? `drew ${DEV.en[c.data.card] || "a card"}` : c.kind === "build" ? `built a ${c.data.what}` : c.kind === "play" ? `played ${DEV.en[c.data.what] || c.data.what}` : ""),
    short_: { wc: "win chance", near: "near miss", gs: "the plan", dec: "the decision", luck: "luck", wait: (r) => `${r} and cards` },
    r: {
      won: (T, pts) => [" won on ", T, " with ", pts, " points."], lostA: " won on ", lostB: " stood on ", lostC: " points.",
      wcLead: (you, P) => (you ? ["Your win chance "] : [P, "'s win chance "]), wcFrom: " from ", wcTo: " to ", wcOn: " on ", up: "rose", down: "slid",
      wcN1: "Dots mark the turns where the win chance moved most. Tap one to open that turn.", wcN2: "Each win chance is a set of futures played out from that position, so a rerun moves it a little.",
      nearOne: { a: " of ", b: " points. ", c: " short on " }, nearEnd: " points at the end.",
      headless: { a: " spent ", b: " of ", c: " turns stuck, with no steady plan." },
      pivot: { a: " planned ", b: ", then pivoted to ", c: " at " }, steady: { a: " planned ", b: " and stayed on it. ", n: (k) => plural(k, " stalled turn.", " stalled turns.") },
      plain: { a: " had ", n: (k) => plural(k, " stalled turn of ", " stalled turns of "), z: "." },
      gsN1: "Plan: the first two builds after set-up. A stalled turn: no points while holding four cards or more.", gsN2: { a: "Win chance fell ", b: " over the stalled turns." },
      waiting: " waiting on ", wait: { a: "Cards in hand, no points. ", b: " from dice: ", c: " a turn, top rival ", d: "." }, waitUnit: (r) => `${r} from dice, cards per turn`,
      luck: { a: " got ", b: " of win chance from chance." }, luckUnit: "win chance gained or lost to chance",
      dec: { a: "On ", b: " another move was ", c: " better." }, decN: "Win chance after each move, from futures played out by the review.",
      follow: { won: "Why did I win?", lost: "Why did I lose?", best: "Best move of the game?", lucky: "Who was luckiest?", plan: "What was the winner's plan?" },
    },
  },
  nl: {
    you: "Jij", lv: { Game: "Spel", "Near miss": "Net niet", Decision: "Beslissing", Strategy: "Strategie", Luck: "Geluk" },
    res: { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" }, abbr: { wood: "Ho", brick: "Ba", sheep: "Wo", wheat: "Gr", ore: "Er" },
    plan: { X: "uitbreiden", C: "steden en kaarten", M: "een mix" },
    verdict: { weak: "Zwak plan", "probably-weak": "Waarschijnlijk zwak plan", solid: "Sterk plan", "probably-solid": "Waarschijnlijk sterk plan", unclear: "Moeilijk te zeggen" },
    conf: { clear: "Duidelijk beter", lean: "Waarschijnlijk beter", close: "Nipt verschil" },
    headless: "Kip zonder kop", yes: "Ja", partly: "Deels", no: "Nee",
    turn: "beurt", Turn: "Beurt", setup: "opzet", more: "Meer", details: "Details", foot: "Samenvatting uit de cijfers van dit spel. Beta.", footAi: "Voor dit spel samengesteld uit de cijfers. Beta.", composing: "Een pagina voor dit spel samenstellen", of: "van",
    fuWork: "Een plaatje samenstellen", fuNone: "Hier past geen plaatje bij, dus hier is het geschreven antwoord.", fuFail: "Dit keer geen antwoord.", fuAsked: "Jouw vraag", bd: { played: "Gespeeld", better: "Beter", alt: "Optie", paid: "Uitbetaald", robber: "Struikrover", pirate: "Piraat", marked: "Gemarkeerd", res: { wood: "Hout", brick: "Baksteen", sheep: "Wol", wheat: "Graan", ore: "Erts", desert: "Woestijn", gold: "Goud" }, aria: "Bord" },
    winChance: "Winkans", winChanceBy: "Winkans per beurt", tapDot: "Tik op een stip om die beurt te openen", points: "Punten", pointsBy: "Punten per beurt", plan_: "plan", pivot: "omslag",
    src: { s: "Dorp", c: "Stad", L: "Langste weg", A: "Grootste leger", v: "Puntenkaart" }, srcPl: { s: "Dorpen", c: "Steden", L: "Langste weg", A: "Grootste leger", v: "Puntenkaarten", I: "Nieuwe eilanden" },
    road: "Weg", stalled: "Vastgelopen", planL: "Plan", hand: "Kaarten in de hand", handBy: "Kaarten in de hand per beurt", otherTurns: "Andere beurten", built: "Iets gebouwd",
    rolled: "Keer gegooid", diceNr: "Worp", rolledL: "Gegooid", expected: "Verwacht", diceAria: "Dobbelstenen",
    pointsBySrc: "Punten per bron", haveOf: (a, b) => `${a} van ${b}`, dashed: " (stippellijn: nog nodig)",
    tStalled: "Vastgelopen beurten", startFeeds: "Start voedt het plan", short: "Tekort aan het eind", tbl: { dice: "Worp", steal: "Stelen", draw: "Kaarten", seat: "Plek" },
    why: "Waarom?", prev: "Vorige beurt", next: "Volgende beurt", nothing: "Er veranderde weinig in deze beurt.", wcIn: "Winkans in deze beurt", open: (s) => `Open ${s}`, board: "Toon het bord", close: "Sluit",
    built1: (c) => `bouwde een ${c === "c" ? "stad" : "dorp"}.`,
    cause: (c, nm) => (c.kind === "dice" ? `gooide ${c.data.roll}` : c.kind === "steal" ? `pakte een kaart van ${nm(c.data.victim)}` : c.kind === "dev" ? `trok ${DEV.nl[c.data.card] || "een kaart"}` : c.kind === "build" ? `bouwde een ${{ road: "weg", city: "stad", settlement: "dorp" }[c.data.what] || c.data.what}` : c.kind === "play" ? `speelde ${DEV.nl[c.data.what] || c.data.what}` : ""),
    short_: { wc: "winkans", near: "net niet", gs: "het plan", dec: "de beslissing", luck: "geluk", wait: (r) => `${r} en kaarten` },
    r: {
      won: (T, pts) => [" won op ", T, " met ", pts, " punten."], lostA: " won op ", lostB: " stond op ", lostC: " punten.",
      wcLead: (you, P) => (you ? ["Jouw winkans "] : ["De winkans van ", P, " "]), wcFrom: " van ", wcTo: " naar ", wcOn: " op ", up: "steeg", down: "daalde",
      wcN1: "De stippen tonen de beurten waarin de winkans het meest veranderde. Tik op een stip om die beurt te openen.", wcN2: "Elke winkans komt uit doorgespeelde toekomsten vanaf die stand, dus een nieuwe run verschuift hem iets.",
      nearOne: { a: " van de ", b: " punten. ", c: " tekort op " }, nearEnd: " punten aan het eind.",
      headless: { a: " zat ", b: " van de ", c: " beurten vast, zonder vast plan." },
      pivot: { a: " koos eerst voor ", b: " en stapte over op ", c: " bij " }, steady: { a: " koos voor ", b: " en bleef daarbij. ", n: (k) => plural(k, " vastgelopen beurt.", " vastgelopen beurten.") },
      plain: { a: " had ", n: (k) => plural(k, " vastgelopen beurt van ", " vastgelopen beurten van "), z: "." },
      gsN1: "Plan: de eerste twee bouwacties na de opzet. Vastgelopen beurt: geen punten terwijl je vier kaarten of meer vasthoudt.", gsN2: { a: "De winkans daalde ", b: " over de vastgelopen beurten." },
      waiting: " keer wachten op ", wait: { a: "Kaarten in de hand, geen punten. ", b: " uit dobbelstenen: ", c: " per beurt, beste tegenstander ", d: "." }, waitUnit: (r) => `${r} uit dobbelstenen, kaarten per beurt`,
      luck: { a: " had ", b: " winkans door toeval." }, luckUnit: "winkans gewonnen of verloren door toeval",
      dec: { a: "Op ", b: " was een andere zet ", c: " beter." }, decN: "Winkans na elke zet, uit toekomsten die de review doorspeelde.",
      follow: { won: "Waarom won ik?", lost: "Waarom verloor ik?", best: "Beste zet van het spel?", lucky: "Wie had het meeste geluk?", plan: "Wat was het plan van de winnaar?" },
    },
  },
};
export const langOf = (l) => LANG[l] || LANG.en;

// ── move labels: the review stores them in English ("Robber on Grain 9", "Settlement on Lumber 4, Ore 3"); the page shows them in its language ──
const NLW = { Lumber: "Hout", Brick: "Baksteen", Wool: "Wol", Grain: "Graan", Ore: "Erts", Desert: "Woestijn", Tile: "Tegel", coast: "kust", Knight: "Ridder", "Road Building": "Wegenbouw", "Year of Plenty": "Uitvinding", Monopoly: "Monopolie", "Victory Point": "Overwinningspunt" };
const NLD = { "top left": "linksboven", "top right": "rechtsboven", "bottom left": "linksonder", "bottom right": "rechtsonder", top: "boven", bottom: "onder", left: "links", right: "rechts", centre: "midden" };
const NLR = [[/^Settlement on /, "Dorp op "], [/^City on /, "Stad op "], [/^Spot on /, "Plek op "], [/^Road toward /, "Weg richting "], [/^Road(?= )/, "Weg"], [/^Robber on /, "Struikrover op "], [/^Pirate on /, "Piraat op "], [/^Bank trade /, "Bankruil "], [/^Development card$/, "Ontwikkelingskaart"], [/^Play /, "Speel "], [/^End turn$/, "Beurt beëindigen"], [/^Ship toward /, "Schip richting "], [/^Ship(?= )/, "Schip"], [/^Move ship /, "Verplaats schip "], [/^Road$/, "Weg"], [/^Ship$/, "Schip"], [/^the sea, /, "de zee, "]];
/** An English move label of the review in `lang` (EN: as is). Resource words, board positions and card names are translated; unknown text stays. */
export function moveLabel(label, lang = "en") {
  const s = String(label ?? ""); if (lang !== "nl" || !s) return s;
  let o = s; for (const [re, to] of NLR) if (re.test(o)) { o = o.replace(re, to); break; }
  o = o.replace(/\b(Road Building|Year of Plenty|Victory Point|Lumber|Brick|Wool|Grain|Ore|Desert|Tile|coast|Knight|Monopoly)\b/g, (m) => NLW[m] || m);
  o = o.replace(/\bthe sea\b/g, "de zee");
  o = o.replace(/\b(top left|top right|bottom left|bottom right|centre|top|bottom|left|right)\b/g, (m) => NLD[m] || m);
  o = o.replace(/^Weg(?= [^ ]*[A-Za-z]) /, "Weg ").replace(/^Speel Ridder$/, "Speel ridder");
  return o;
}
