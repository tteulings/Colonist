// v1.99 The words of the analysis data layer: one EN and one NL key table (same keys, checked by tests/analysis199.js) and tr(lang, key, params).
// Wording rules (docs/design/analysis-v199.md): "points" means game points only (a win-chance gap is written "6% or more"); EN says "Accuracy", NL "Precisie";
// dorp / stad / weg / ontwikkelkaart, hout / baksteen / wol / graan / erts. v1.99 scope: this file has no string about ports, the longest road / largest army race,
// who was fed in a trade or where the robber went.
// {name} in a string is replaced by params.name.

export const EN = {
  and: "and",
  // phases and names
  "phase.start": "Start", "phase.opening": "Opening", "phase.mid": "Midgame", "phase.end": "End",
  "res.wood": "Lumber", "res.brick": "Brick", "res.sheep": "Wool", "res.wheat": "Grain", "res.ore": "Ore",
  "kind.settlement": "settlement", "kind.city": "city", "kind.road": "road", "kind.bank": "bank trade", "kind.end": "end turn", "kind.card": "development card", "kind.other": "other move",
  "plan.city": "City plan (ore and grain)", "plan.expansion": "Expansion plan (lumber and brick)", "plan.mixed": "Mixed plan",
  "word.acc": "Accuracy", "word.cost": "Moves cost", "word.moves": "Moves",
  // the nine classes
  "cls.best": "Best", "cls.great": "Great", "cls.good": "Good", "cls.close": "Close call", "cls.lean": "Slightly better", "cls.could": "Could be better", "cls.mistake": "Mistake", "cls.blunder": "Blunder", "cls.missed": "Missed chance",
  // headline: what led the game (v = whole percent)
  "head.won.rest": "the others fell away (+{v}%)", "head.won.luck": "luck helped (+{v}%)", "head.won.setup": "your start helped (+{v}%)", "head.won.moves": "your moves helped (+{v}%)", "head.won.none": "you won",
  "head.lost.rest": "the others pulled ahead (−{v}%)", "head.lost.luck": "luck went against you (−{v}%)", "head.lost.setup": "your start cost you ({v}%)", "head.lost.moves": "{v}% was lost to your moves", "head.lost.none": "you did not win",
  "head.despite.rest": "despite the others pulling ahead ({v}%)", "head.despite.luck": "despite bad luck ({v}%)", "head.despite.setup": "despite a weak start ({v}%)", "head.despite.moves": "despite {v}% lost to your moves",
  "head.though.rest": "though the others fell away (+{v}%)", "head.though.luck": "though luck helped (+{v}%)", "head.though.setup": "though your start helped (+{v}%)", "head.though.moves": "though your moves were close to best",
  "head.even": "A close game without one clear cause",
  // verdict text
  "vt.cost": "Your moves gave up {v}% against best play.", "vt.close": "Your moves stayed close to best play ({v}% given up).",
  "vt.stillwon.rest": "You still won: the opponents fell away.", "vt.stillwon.luck": "You still won: luck helped.", "vt.stillwon.setup": "You still won: your start carried you.", "vt.stillwon.moves": "You still won.", "vt.stillwon.none": "You still won.",
  "vt.won.solid": "You won on solid moves.",
  "vt.lost.moves": "That is where the game slipped away.", "vt.lost.rest": "The others were simply stronger this game.", "vt.lost.luck": "Luck went against you.", "vt.lost.setup": "Your start made it hard.", "vt.lost.none": "A close game that could have gone either way.",
  // key moments of the headline ("why I won / lost")
  "mom.won": "{S} won mostly in", "mom.lost": "{S} lost mostly in", "mom.turn": "turn {t} ({c}, {d})", "mom.turn2": "{t} ({c}, {d})", "mom.none.won": "{S} won without one big moment", "mom.none.lost": "{S} lost without one big moment",
  "mom.city": "built a city", "mom.settlement": "built a settlement", "mom.road": "built a road", "mom.card": "bought a card", "mom.good": "good move", "mom.move": "move",
  "mom.roll.good": "lucky roll", "mom.roll.bad": "unlucky roll", "mom.roll.of": "{x}’s roll", "mom.end": "ended too early", "mom.weak.settlement": "weak settlement", "mom.weak.city": "weak city", "mom.weak.road": "weak road", "mom.weak.bank": "weak bank trade", "mom.weak.card": "weak card buy", "mom.weak": "weak move",
  "mom.instead": "{a}, {b} was better", "mom.by.city": "{x} built a city", "mom.by.settlement": "{x} built a settlement", "mom.by.road": "{x} built a road", "mom.by.card": "{x} drew a card", "mom.by.turn": "{x} played on", "mom.you": "you",
  // headline, round 7: the player's own biggest move swing + the biggest luck swing (+ the start)
  "h.k.city": "city", "h.k.settlement": "settlement", "h.k.road": "road", "h.k.card": "development card", "h.k.move": "move",
  "h.own.you": "your {k} in turn {t} ({d})", "h.own.3": "{x}’s {k} in turn {t} ({d})", "h.own.you.s": "your {k} ({d})", "h.own.3.s": "{x}’s {k} ({d})",
  "h.luck.good1": "a lucky roll in turn {t} ({d})", "h.luck.good2": "two lucky rolls (turns {t} and {t2}, {d})", "h.luck.bad1": "an unlucky roll in turn {t} ({d})", "h.luck.bad2": "two unlucky rolls (turns {t} and {t2}, {d})",
  "h.luck.good1.s": "a lucky roll ({d})", "h.luck.good2.s": "two lucky rolls ({d})", "h.luck.bad1.s": "an unlucky roll ({d})", "h.luck.bad2.s": "two unlucky rolls ({d})",
  "h.won.both": "{S} won thanks to {a} and {b}.", "h.won.one": "{S} won thanks to {a}.", "h.lost.both": "{S} lost because of {a}; {m} cost {n}%{o}.", "h.lost.luck": "{S} lost because of {a}.", "h.lost.mv": "{S} lost because of {m}: they cost {n}%{o}.",
  "h.most": ", mostly turn {t} ({d})", "h.mv.you": "your own moves", "h.mv.3": "{x}’s moves", "h.start": "Your start pick cost {n}%.", "h.start.3": "{x}’s start pick cost {n}%.",
  "c.line": "{acc} and {errs}: {mv} cost {n} together{o}.", "c.err0": "no real errors", "c.err1": "1 real error", "c.errn": "{n} real errors", "c.most": ", mostly {w} ({v}%)", "c.w.start": "the start", "c.w.errors": "errors", "c.w.other": "small moves",
  "band.hi": "Higher than the usual {a}–{b} of {x} bots.", "band.lo": "Lower than the usual {a}–{b} of {x} bots.", "band.in": "Usual for {x} bots ({a}–{b}).",
  "w.own.won": "Best own move", "w.own.lost": "Costliest own move", "w.start": "Start pick", "w.luck": "Luck", "w.when": "{k} · turn {t}", "w.roll": "biggest roll: turn {t} ({d})", "w.nostart": "no start picks checked",
  "h.ka.city": "the city", "h.ka.settlement": "the settlement", "h.ka.road": "the road", "h.ka.card": "the development card", "h.ka.move": "the move", "h.mv.3s": "the moves",
  // coach rules
  "rule.missing.chip": "No {res}", "rule.missing.text": "Early on, get every resource into your income: without {res} you wait on trades.",
  "rule.city.chip": "{pts} of {target} points", "rule.city.text": "From about half the points, turn your best spot into a city.",
  "rule.last.chip": "{pts} of {target} points", "rule.last.text": "Close to the end, take the move that scores the last points.",
  // numbers sheet
  "num.points": "Points", "num.pts.opening": "Points gained, opening", "num.pts.mid": "Points gained, midgame", "num.pts.end": "Points gained, end",
  "num.acc": "Accuracy", "num.cost": "Moves cost (win chance)", "num.luck": "Luck (win chance)",
  "num.settlements": "Settlements built", "num.cities": "Cities built", "num.roads": "Roads built", "num.cards": "Development cards bought", "num.bank": "Bank trades", "num.player": "Player trades", "num.firstCity": "First city (turn)",
  "num.cls.best": "Best moves", "num.cls.great": "Great moves", "num.cls.good": "Good moves", "num.cls.close": "Close calls", "num.cls.lean": "Slightly better options", "num.cls.could": "Could be better", "num.cls.errors": "Real errors",
  // (i) sheet
  "info.error.t": "When is a move an error?", "info.error.b": "A real error is a gap of at least twice the move's own margin (the ± next to a move), about {pct}% when none is stored. A close call is never an error; \"Could be better\" is a smaller gap. Set-up picks use their own limits: could be better {c1}% to {c2}%, mistake {c2}% to {c3}%, blunder {c3}% or more. Real errors = mistakes, blunders and missed chances that pass this rule.",
  "info.acc.t": "Accuracy and moves cost", "info.acc.b": "Accuracy is how often you were near the best move. Moves cost is what every miss lost, added up, in win chance.",
  "info.phases.t": "Phases", "info.phases.b": "The game of {n} turns is split in three equal parts: opening {a}, midgame {b}, end {c}.",
  "info.model.t": "Model", "info.model.b": "Every move was checked by the review engine (version {fmt}) on many simulated futures; the numbers are win chances.",
};

export const NL = {
  and: "en",
  "phase.start": "Start", "phase.opening": "Opening", "phase.mid": "Middenspel", "phase.end": "Eindspel",
  "res.wood": "Hout", "res.brick": "Baksteen", "res.sheep": "Wol", "res.wheat": "Graan", "res.ore": "Erts",
  "kind.settlement": "dorp", "kind.city": "stad", "kind.road": "weg", "kind.bank": "bankruil", "kind.end": "beurt beëindigen", "kind.card": "ontwikkelkaart", "kind.other": "andere zet",
  "plan.city": "Stadsplan (erts en graan)", "plan.expansion": "Uitbreidingsplan (hout en baksteen)", "plan.mixed": "Gemengd plan",
  "word.acc": "Precisie", "word.cost": "Kosten van zetten", "word.moves": "Zetten",
  "cls.best": "Beste", "cls.great": "Geweldig", "cls.good": "Goed", "cls.close": "Kleine keuze", "cls.lean": "Iets beter", "cls.could": "Kan beter", "cls.mistake": "Fout", "cls.blunder": "Blunder", "cls.missed": "Gemiste kans",
  "head.won.rest": "de anderen vielen weg (+{v}%)", "head.won.luck": "geluk hielp (+{v}%)", "head.won.setup": "je start hielp (+{v}%)", "head.won.moves": "je zetten hielpen (+{v}%)", "head.won.none": "je won",
  "head.lost.rest": "de anderen liepen uit (−{v}%)", "head.lost.luck": "het geluk zat tegen (−{v}%)", "head.lost.setup": "je start kostte je ({v}%)", "head.lost.moves": "{v}% ging verloren aan je zetten", "head.lost.none": "je won niet",
  "head.despite.rest": "ondanks dat de anderen uitliepen ({v}%)", "head.despite.luck": "ondanks pech ({v}%)", "head.despite.setup": "ondanks een zwakke start ({v}%)", "head.despite.moves": "ondanks {v}% verloren aan je zetten",
  "head.though.rest": "al vielen de anderen weg (+{v}%)", "head.though.luck": "al hielp het geluk (+{v}%)", "head.though.setup": "al hielp je start (+{v}%)", "head.though.moves": "al lagen je zetten dicht bij de beste",
  "head.even": "Een spannend spel zonder één duidelijke oorzaak",
  "vt.cost": "Je zetten gaven {v}% weg ten opzichte van de beste zetten.", "vt.close": "Je zetten bleven dicht bij de beste ({v}% weggegeven).",
  "vt.stillwon.rest": "Je won toch: de tegenstanders vielen weg.", "vt.stillwon.luck": "Je won toch: het geluk hielp.", "vt.stillwon.setup": "Je won toch: je start droeg je.", "vt.stillwon.moves": "Je won toch.", "vt.stillwon.none": "Je won toch.",
  "vt.won.solid": "Je won met sterke zetten.",
  "vt.lost.moves": "Daar ging het spel mis.", "vt.lost.rest": "De anderen waren dit spel gewoon sterker.", "vt.lost.luck": "Het geluk zat tegen.", "vt.lost.setup": "Je start maakte het moeilijk.", "vt.lost.none": "Een spannend spel dat beide kanten op kon.",
  "mom.won": "{S} won vooral in", "mom.lost": "{S} verloor vooral in", "mom.turn": "beurt {t} ({c}, {d})", "mom.turn2": "{t} ({c}, {d})", "mom.none.won": "{S} won zonder één groot moment", "mom.none.lost": "{S} verloor zonder één groot moment",
  "mom.city": "stad gebouwd", "mom.settlement": "dorp gebouwd", "mom.road": "weg gebouwd", "mom.card": "kaart gekocht", "mom.good": "goede zet", "mom.move": "zet",
  "mom.roll.good": "geluk met worp", "mom.roll.bad": "pech met worp", "mom.roll.of": "worp van {x}", "mom.end": "te vroeg gestopt", "mom.weak.settlement": "zwak dorp", "mom.weak.city": "zwakke stad", "mom.weak.road": "zwakke weg", "mom.weak.bank": "zwakke bankruil", "mom.weak.card": "zwakke kaartkoop", "mom.weak": "zwakke zet",
  "mom.instead": "{a}, {b} was beter", "mom.by.city": "{x} bouwde een stad", "mom.by.settlement": "{x} bouwde een dorp", "mom.by.road": "{x} bouwde een weg", "mom.by.card": "{x} trok een kaart", "mom.by.turn": "{x} speelde door", "mom.you": "jij",
  "h.k.city": "stad", "h.k.settlement": "dorp", "h.k.road": "weg", "h.k.card": "ontwikkelkaart", "h.k.move": "zet",
  "h.own.you": "je {k} in beurt {t} ({d})", "h.own.3": "de {k} van {x} in beurt {t} ({d})", "h.own.you.s": "je {k} ({d})", "h.own.3.s": "de {k} van {x} ({d})",
  "h.luck.good1": "een gunstige worp in beurt {t} ({d})", "h.luck.good2": "twee gunstige worpen (beurt {t} en {t2}, {d})", "h.luck.bad1": "een ongunstige worp in beurt {t} ({d})", "h.luck.bad2": "twee ongunstige worpen (beurt {t} en {t2}, {d})",
  "h.luck.good1.s": "een gunstige worp ({d})", "h.luck.good2.s": "twee gunstige worpen ({d})", "h.luck.bad1.s": "een ongunstige worp ({d})", "h.luck.bad2.s": "twee ongunstige worpen ({d})",
  "h.won.both": "{S} won dankzij {a} en {b}.", "h.won.one": "{S} won dankzij {a}.", "h.lost.both": "{S} verloor door {a}; {m} kostten {n}%{o}.", "h.lost.luck": "{S} verloor door {a}.", "h.lost.mv": "{S} verloor door {m}: ze kostten {n}%{o}.",
  "h.most": ", vooral beurt {t} ({d})", "h.mv.you": "je eigen zetten", "h.mv.3": "de zetten van {x}", "h.start": "Je startkeuze kostte {n}%.", "h.start.3": "De startkeuze van {x} kostte {n}%.",
  "c.line": "{acc} en {errs}: {mv} kostten samen {n}{o}.", "c.err0": "geen echte fouten", "c.err1": "1 echte fout", "c.errn": "{n} echte fouten", "c.most": ", vooral {w} ({v}%)", "c.w.start": "de start", "c.w.errors": "fouten", "c.w.other": "kleine zetten",
  "band.hi": "Hoger dan de gebruikelijke {a}–{b} van {x}-bots.", "band.lo": "Lager dan de gebruikelijke {a}–{b} van {x}-bots.", "band.in": "Gebruikelijk voor {x}-bots ({a}–{b}).",
  "w.own.won": "Beste eigen zet", "w.own.lost": "Duurste eigen zet", "w.start": "Startkeuze", "w.luck": "Geluk", "w.when": "{k} · beurt {t}", "w.roll": "grootste worp: beurt {t} ({d})", "w.nostart": "geen startkeuzes gecheckt",
  "h.ka.city": "de stad", "h.ka.settlement": "het dorp", "h.ka.road": "de weg", "h.ka.card": "de ontwikkelkaart", "h.ka.move": "de zet", "h.mv.3s": "de zetten",
  "rule.missing.chip": "Geen {res}", "rule.missing.text": "Haal vroeg elke grondstof in je inkomen: zonder {res} wacht je op ruilen.",
  "rule.city.chip": "{pts} van {target} punten", "rule.city.text": "Maak vanaf ongeveer de helft van de punten van je beste plek een stad.",
  "rule.last.chip": "{pts} van {target} punten", "rule.last.text": "Pak vlak voor het einde de zet die de laatste punten scoort.",
  "num.points": "Punten", "num.pts.opening": "Punten erbij, opening", "num.pts.mid": "Punten erbij, middenspel", "num.pts.end": "Punten erbij, eindspel",
  "num.acc": "Precisie", "num.cost": "Kosten van zetten (winkans)", "num.luck": "Geluk (winkans)",
  "num.settlements": "Dorpen gebouwd", "num.cities": "Steden gebouwd", "num.roads": "Wegen gebouwd", "num.cards": "Ontwikkelkaarten gekocht", "num.bank": "Bankruilen", "num.player": "Ruilen met spelers", "num.firstCity": "Eerste stad (beurt)",
  "num.cls.best": "Beste zetten", "num.cls.great": "Geweldige zetten", "num.cls.good": "Goede zetten", "num.cls.close": "Kleine keuzes", "num.cls.lean": "Iets betere opties", "num.cls.could": "Kan beter", "num.cls.errors": "Echte fouten",
  "info.error.t": "Wanneer is een zet een fout?", "info.error.b": "Een echte fout is een verschil van minstens twee keer de eigen marge van de zet (de ± naast een zet), ongeveer {pct}% als die niet bekend is. Een kleine keuze is nooit een fout; \"Kan beter\" is een kleiner verschil. Startplekken hebben eigen grenzen: kan beter {c1}% tot {c2}%, fout {c2}% tot {c3}%, blunder {c3}% of meer. Echte fouten = fouten, blunders en gemiste kansen die aan deze regel voldoen.",
  "info.acc.t": "Precisie en kosten van zetten", "info.acc.b": "Precisie is hoe vaak je dicht bij de beste zet zat. De kosten van zetten zijn wat elke misser kostte, opgeteld, in winkans.",
  "info.phases.t": "Fasen", "info.phases.b": "Het spel van {n} beurten is in drie gelijke delen verdeeld: opening {a}, middenspel {b}, eindspel {c}.",
  "info.model.t": "Model", "info.model.b": "Elke zet is door de reviewmotor (versie {fmt}) op veel gesimuleerde toekomsten gecheckt; de getallen zijn winkansen.",
};

export const TABLES = { en: EN, nl: NL };
/** The text of a key in a language (English unless "nl"); {name} is replaced by params.name. An unknown key comes back as the key itself (the test fails on it). */
export function tr(lang, key, params = {}) {
  const t = lang === "nl" ? NL : EN, s = t[key] ?? EN[key];
  return s == null ? key : s.replace(/\{(\w+)\}/g, (m, k) => (params[k] == null ? "" : String(params[k])));
}
