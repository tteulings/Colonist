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
  "cls.best": "Best", "cls.great": "Great", "cls.good": "Good", "cls.close": "Close call", "cls.lean": "Close call", "cls.could": "Could be better", "cls.mistake": "Mistake", "cls.blunder": "Blunder", "cls.missed": "Missed chance",
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
  
  
  
  
  "h.mv.you": "your own moves", "h.mv.3": "{x}’s moves", "h.start": "Your start pick cost {n}%.", "h.start.3": "{x}’s start pick cost {n}%.",
  "c.line": "{acc} and {errs}: {mv} cost {n} together{o}.", "c.err0": "no real errors", "c.err1": "{n} real error", "c.errn": "{n} real errors", "c.most": ", mostly {w} ({v}%)", "c.w.start": "the start", "c.w.errors": "errors", "c.w.other": "small moves",
  "band.hi": "Higher than the usual {a}–{b} of {x} bots.", "band.lo": "Lower than the usual {a}–{b} of {x} bots.", "band.in": "Usual for {x} bots ({a}–{b}).",
  "w.own.won": "Best own move", "w.own.lost": "Costliest own move", "w.start": "Start pick", "w.luck": "Luck", "w.own.lost.d": "Despite: costliest own move", "w.start.d": "Despite: start pick", "w.luck.d": "Despite: luck", "w.own.won.d": "Despite: best own move", "w.when": "{k} · turn {t}", "w.roll": "biggest roll: turn {t} ({d})", "w.nostart": "no start picks checked",
  
  "h.own.you": "your {k} in turn {t} ({d} win chance)", "h.own.3": "{x}’s {k} in turn {t} ({d} win chance)", "h.own.you.n": "your {k} in turn {t} ({d})", "h.own.3.x": "the {k} in turn {t} ({d})", "h.own.3.n": "{x}’s {k} in turn {t} ({d})",
  "h.lk.good1": "luck in turn {t} ({d})", "h.lk.good2": "luck in turns {t} and {t2} ({d})", "h.lk.bad1": "bad luck in turn {t} ({d})", "h.lk.bad2": "bad luck in turns {t} and {t2} ({d})", "h.lk.good0": "luck ({d})", "h.lk.bad0": "bad luck ({d})",
  "h.lk.of1": "{x}’s roll in turn {t} ({d})", "h.lk.of2": "{x}’s rolls in turns {t} and {t2} ({d})",
  "h.won": "{S} won with {a} and {b}.", "h.won.1": "{S} won with {a}.", "h.lost": "{S} lost because of {a} and {b}.", "h.lost.1": "{S} lost because of {a}.",
  "h.k3.city": "city", "h.k3.settlement": "settlement", "h.k3.road": "road", "h.k3.card": "development card", "h.k3.move": "move",
  // coach rules
  "rule.missing.chip": "No {res}", "rule.missing.text": "Early on, get every resource: without {res} you wait on trades.",
  "rule.pts.chip": "{pts} of {target} points",
  "rule.openspend.text": "Early on, don't end your turn while you can still build or trade.",
  "rule.openroad.text": "Build your road toward a resource you have no income from ({res}).",
  "rule.opentrade.text": "One card short of a settlement? Trade at the bank and build now.",
  "rule.midplay.text": "Play the development card you hold instead of keeping it.",
  "rule.midbuy.text": "With ore, grain and wool to spare, buy a development card.",
  "rule.midspend.text": "Don't end your turn with cards you can spend on a build.",
  "rule.midtrade.text": "One card short for a city? Trade at the bank and build.",
  "rule.last.text": "Near the end, take the move that scores the last points.",
  "rule.endplay.text": "In the endgame, play every development card you hold.",
  "rule.endspend.text": "In the endgame, never end your turn with cards you can spend.",
  "rule.endtrade.text": "In the endgame, trade at the bank for the missing card and build.",
  // numbers sheet
  "num.points": "Points", "num.pts.opening": "Points gained, opening", "num.pts.mid": "Points gained, midgame", "num.pts.end": "Points gained, end",
  "num.acc": "Accuracy", "num.cost": "Moves cost (win chance)", "num.luck": "Luck (win chance)",
  "num.settlements": "Settlements built", "num.cities": "Cities built", "num.roads": "Roads built", "num.cards": "Development cards bought", "num.bank": "Bank trades", "num.player": "Player trades", "num.firstCity": "First city (turn)",
  "num.cls.strong": "Strong moves", "num.cls.close": "Close calls", "num.cls.could": "Could be better", "num.cls.errors": "Real errors",
  // (i) sheet
  "info.error.t": "When is a move an error?", "info.error.b": "A real error is a gap of at least twice the move's own margin (the ± next to a move), about {pct}% when none is stored. A close call is never an error; \"Could be better\" is a smaller gap. Set-up picks use their own limits: could be better {c1}% to {c2}%, mistake {c2}% to {c3}%, blunder {c3}% or more. Real errors = mistakes, blunders and missed chances that pass this rule.",
  "info.acc.t": "Accuracy and moves cost", "info.acc.b": "Accuracy is how often you were near the best move. Moves cost is what every miss lost, added up, in win chance.",
  "info.phases.t": "Phases", "info.phases.b": "The game of {n} turns is split in three equal parts: opening {a}, midgame {b}, end {c}.",
  "info.model.t": "Model", "info.model.b": "Every move was checked by the review engine (version {fmt}) on many simulated futures; the numbers are win chances.",
  // v1.99 facts round: the headline (own-controlled part first, luck only when large and with whose rolls), the connecting line, the waterfall
  "hd.won.start": "{S} won despite {pos} start ({d})", "hd.won.start.3": "{S} won despite a weak start ({d})",
  "hd.lost.start": "{S} lost because of {pos} start ({a} instead of {b}, {d})", "hd.lost.start.t": "{S} lost because of {pos} start ({d})", "hd.lost.start.p": "{S} lost because of {pos} start (pick {n}: {a} instead of {b}; {d} in all)",
  "hd.won.best": "{S} won thanks to {pos} {k} in turn {t} (move {d})", "hd.won.miss": "{S} won despite {pos} move in turn {t} ({d})",
  "hd.lost.miss": "{S} lost because of {pos} move in turn {t} ({k1} instead of {k2}, {d})", "hd.lost.miss.t": "{S} lost because of {pos} move in turn {t} ({d})", "hd.lost.miss.w": "{S} lost because of {pos} move in turn {t} ({w}, {d})",
  "hd.won.clean": "{S} won without a big own mistake (moves in total {d})", "hd.lost.clean": "{S} lost without a big own mistake (moves in total {d})",
  "hd.lost.others": "{S} lost: the others pulled ahead ({d})", "hd.pos.you": "your", "hd.pos.3": "the",
  "hd.lk.own.good.you": "luck with your own rolls ({d})", "hd.lk.own.good.3": "luck with their own rolls ({d})", "hd.lk.own.bad.you": "bad luck with your own rolls ({d})", "hd.lk.own.bad.3": "bad luck with their own rolls ({d})", "hd.despite": "despite",
  "hd.lk.good.you": "{y}’s rolls in turns {t} and {t2} helped you ({d})", "hd.lk.good1.you": "{y}’s roll in turn {t} helped you ({d})", "hd.lk.good.3": "{y}’s rolls in turns {t} and {t2} helped {x} ({d})", "hd.lk.good1.3": "{y}’s roll in turn {t} helped {x} ({d})",
  "hd.lk.bad.you": "{y}’s rolls in turns {t} and {t2} ({d})", "hd.lk.bad1.you": "{y}’s roll in turn {t} ({d})", "hd.lk.bad.3": "{y}’s rolls in turns {t} and {t2} ({d})", "hd.lk.bad1.3": "{y}’s roll in turn {t} ({d})",
  "hd.lk.good.short": "{y}’s rolls helped ({d})", "hd.lk.bad.short": "{y}’s rolls ({d})",
  "c.a": "{acc}, {errs}.", "c.b": "Moves in total {tot}: start {st} + moves {mv}.", "c.b.3": "{x}’s moves in total {tot}: start {st} + moves {mv}.",
  "wf.fair": "Fair share", "wf.start": "Start picks", "wf.moves": "Moves", "wf.luck": "Luck", "wf.others": "Others", "wf.end": "End",
  "wf.start.sub": "{p} {a} instead of {b}", "wf.start.ok": "start picks fine", "wf.moves.sub": "biggest miss: turn {t}, {k1} instead of {k2} ({d})", "wf.moves.sub.w": "biggest miss: turn {t}, {w} ({d})", "wf.moves.none": "no miss of {n} or more", "wf.moves.rate": "{n} per move",
  "wf.luck.sub": "biggest roll: {x} rolled {n} in turn {t} ({d})", "wf.luck.none": "rolls, cards and seat order", "wf.others.l": "their moves and luck together", "wf.others.up": "helped you: their moves and luck together", "wf.others.up.3": "helped {x}: their moves and luck together", "wf.others.dn": "cost you: their moves and luck together", "wf.others.dn.3": "cost {x}: their moves and luck together", "wf.after.lost": "you had {w} chance after your last move; then the game was lost", "wf.after.lost.3": "{x} had {w} chance after the last move; then the game was lost", "wf.others.o": "among them {y}’s rolls in turns {t} and {t2} ({h})", "wf.others.o1": "among them {y}’s roll in turn {t} ({h})", "wf.after.sub": "you still had {w} chance; the rest of the game decided", "wf.after.sub.3": "there was still {w} chance; the rest of the game decided", "c.few": "Too few scored moves for a verdict ({n} scored).", "wf.others.sub": "their moves, their luck and the rest", "wf.others.rolls": "of which {y}’s rolls (turns {t} and {t2}): {d}", "wf.others.rolls1": "of which {y}’s roll (turn {t}): {d}",
  "wf.you": "you", "rv.gained": "gained", "rv.lost": "lost", "rv.here": "here", "pt.one": "point", "pt.many": "points", "wf.human": "the human player", "wf.pick": "pick {n}",
};

export const NL = {
  and: "en",
  "phase.start": "Start", "phase.opening": "Opening", "phase.mid": "Middenspel", "phase.end": "Eindspel",
  "res.wood": "Hout", "res.brick": "Baksteen", "res.sheep": "Wol", "res.wheat": "Graan", "res.ore": "Erts",
  "kind.settlement": "dorp", "kind.city": "stad", "kind.road": "weg", "kind.bank": "bankruil", "kind.end": "beurt beëindigen", "kind.card": "ontwikkelkaart", "kind.other": "andere zet",
  "plan.city": "Stadsplan (erts en graan)", "plan.expansion": "Uitbreidingsplan (hout en baksteen)", "plan.mixed": "Gemengd plan",
  "word.acc": "Precisie", "word.cost": "Kosten van zetten", "word.moves": "Zetten",
  "cls.best": "Beste", "cls.great": "Geweldig", "cls.good": "Goed", "cls.close": "Nipte keuze", "cls.lean": "Nipte keuze", "cls.could": "Kan beter", "cls.mistake": "Fout", "cls.blunder": "Blunder", "cls.missed": "Gemiste kans",
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
  
  
  
  
  "h.mv.you": "je eigen zetten", "h.mv.3": "de zetten van {x}", "h.start": "Je startkeuze kostte {n}%.", "h.start.3": "De startkeuze van {x} kostte {n}%.",
  "c.line": "{acc} en {errs}: {mv} kostten samen {n}{o}.", "c.err0": "geen echte fouten", "c.err1": "{n} echte fout", "c.errn": "{n} echte fouten", "c.most": ", vooral {w} ({v}%)", "c.w.start": "de start", "c.w.errors": "fouten", "c.w.other": "kleine zetten",
  "band.hi": "Hoger dan de gebruikelijke {a}–{b} van {x}-bots.", "band.lo": "Lager dan de gebruikelijke {a}–{b} van {x}-bots.", "band.in": "Gebruikelijk voor {x}-bots ({a}–{b}).",
  "w.own.won": "Beste eigen zet", "w.own.lost": "Duurste eigen zet", "w.start": "Startkeuze", "w.luck": "Geluk", "w.own.lost.d": "Ondanks: duurste eigen zet", "w.start.d": "Ondanks: startkeuze", "w.luck.d": "Ondanks: geluk", "w.own.won.d": "Ondanks: beste eigen zet", "w.when": "{k} · beurt {t}", "w.roll": "grootste worp: beurt {t} ({d})", "w.nostart": "geen startkeuzes gecheckt",
  
  "h.own.you": "je {k} in beurt {t} ({d} winkans)", "h.own.3": "{k} van {x} in beurt {t} ({d} winkans)", "h.own.you.n": "je {k} in beurt {t} ({d})", "h.own.3.x": "{k} in beurt {t} ({d})", "h.own.3.n": "{k} van {x} in beurt {t} ({d})",
  "h.lk.good1": "geluk in beurt {t} ({d})", "h.lk.good2": "geluk in beurt {t} en {t2} ({d})", "h.lk.bad1": "pech in beurt {t} ({d})", "h.lk.bad2": "pech in beurt {t} en {t2} ({d})", "h.lk.good0": "geluk ({d})", "h.lk.bad0": "pech ({d})",
  "h.lk.of1": "de worp van {x} in beurt {t} ({d})", "h.lk.of2": "de worpen van {x} in beurt {t} en {t2} ({d})",
  "h.won": "{S} won met {a} en {b}.", "h.won.1": "{S} won met {a}.", "h.lost": "{S} verloor door {a} en {b}.", "h.lost.1": "{S} verloor door {a}.",
  "h.k3.city": "de stad", "h.k3.settlement": "het dorp", "h.k3.road": "de weg", "h.k3.card": "de ontwikkelkaart", "h.k3.move": "de zet",
  "rule.missing.chip": "Geen {res}", "rule.missing.text": "Haal vroeg elke grondstof binnen: zonder {res} wacht je op ruilen.",
  "rule.pts.chip": "{pts} van {target} punten",
  "rule.openspend.text": "Beëindig je beurt vroeg niet als je nog kunt bouwen of ruilen.",
  "rule.openroad.text": "Bouw je weg naar een grondstof die je nog mist ({res}).",
  "rule.opentrade.text": "Eén kaart tekort voor een dorp? Ruil bij de bank en bouw nu.",
  "rule.midplay.text": "Speel de ontwikkelkaart die je vasthoudt, bewaar hem niet.",
  "rule.midbuy.text": "Heb je erts, graan en wol over? Koop een ontwikkelkaart.",
  "rule.midspend.text": "Beëindig je beurt niet met kaarten die je kunt uitgeven aan bouwen.",
  "rule.midtrade.text": "Eén kaart tekort voor een stad? Ruil bij de bank en bouw.",
  "rule.last.text": "Pak vlak voor het einde de zet die de laatste punten scoort.",
  "rule.endplay.text": "Speel in het eindspel elke ontwikkelkaart die je vasthoudt.",
  "rule.endspend.text": "Houd in het eindspel geen kaarten over die je kunt uitgeven.",
  "rule.endtrade.text": "Ruil in het eindspel bij de bank voor de ontbrekende kaart en bouw.",
  "num.points": "Punten", "num.pts.opening": "Punten erbij, opening", "num.pts.mid": "Punten erbij, middenspel", "num.pts.end": "Punten erbij, eindspel",
  "num.acc": "Precisie", "num.cost": "Kosten van zetten (winkans)", "num.luck": "Geluk (winkans)",
  "num.settlements": "Dorpen gebouwd", "num.cities": "Steden gebouwd", "num.roads": "Wegen gebouwd", "num.cards": "Ontwikkelkaarten gekocht", "num.bank": "Bankruilen", "num.player": "Ruilen met spelers", "num.firstCity": "Eerste stad (beurt)",
  "num.cls.strong": "Sterke zetten", "num.cls.close": "Nipte keuzes", "num.cls.could": "Kan beter", "num.cls.errors": "Echte fouten",
  "info.error.t": "Wanneer is een zet een fout?", "info.error.b": "Een echte fout is een verschil van minstens twee keer de eigen marge van de zet (de ± naast een zet), ongeveer {pct}% als die niet bekend is. Een nipte keuze is nooit een fout; \"Kan beter\" is een kleiner verschil. Startplekken hebben eigen grenzen: kan beter {c1}% tot {c2}%, fout {c2}% tot {c3}%, blunder {c3}% of meer. Echte fouten = fouten, blunders en gemiste kansen die aan deze regel voldoen.",
  "info.acc.t": "Precisie en kosten van zetten", "info.acc.b": "Precisie is hoe vaak je dicht bij de beste zet zat. De kosten van zetten zijn wat elke misser kostte, opgeteld, in winkans.",
  "info.phases.t": "Fasen", "info.phases.b": "Het spel van {n} beurten is in drie gelijke delen verdeeld: opening {a}, middenspel {b}, eindspel {c}.",
  "info.model.t": "Model", "info.model.b": "Elke zet is door de reviewmotor (versie {fmt}) op veel gesimuleerde toekomsten gecheckt; de getallen zijn winkansen.",
  "hd.won.start": "{S} won ondanks {pos} start ({d})", "hd.won.start.3": "{S} won ondanks een zwakke start ({d})",
  "hd.lost.start": "{S} verloor door {pos} start ({a} i.p.v. {b}, {d})", "hd.lost.start.t": "{S} verloor door {pos} start ({d})", "hd.lost.start.p": "{S} verloor door {pos} start (keuze {n}: {a} i.p.v. {b}; {d} samen)",
  "hd.won.best": "{S} won dankzij {pos} {k} in beurt {t} (zet {d})", "hd.won.miss": "{S} won ondanks {pos} zet in beurt {t} ({d})",
  "hd.lost.miss": "{S} verloor door {pos} zet in beurt {t} ({k1} i.p.v. {k2}, {d})", "hd.lost.miss.t": "{S} verloor door {pos} zet in beurt {t} ({d})", "hd.lost.miss.w": "{S} verloor door {pos} zet in beurt {t} ({w}, {d})",
  "hd.won.clean": "{S} won zonder grote eigen fout (zetten totaal {d})", "hd.lost.clean": "{S} verloor zonder grote eigen fout (zetten totaal {d})",
  "hd.lost.others": "{S} verloor: de anderen liepen uit ({d})", "hd.pos.you": "je", "hd.pos.3": "de",
  "hd.lk.own.good.you": "geluk met je eigen worpen ({d})", "hd.lk.own.good.3": "geluk met de eigen worpen ({d})", "hd.lk.own.bad.you": "pech met je eigen worpen ({d})", "hd.lk.own.bad.3": "pech met de eigen worpen ({d})", "hd.despite": "ondanks",
  "hd.lk.good.you": "de worpen van {y} in beurt {t} en {t2} hielpen je ({d})", "hd.lk.good1.you": "de worp van {y} in beurt {t} hielp je ({d})", "hd.lk.good.3": "de worpen van {y} in beurt {t} en {t2} hielpen {x} ({d})", "hd.lk.good1.3": "de worp van {y} in beurt {t} hielp {x} ({d})",
  "hd.lk.bad.you": "de worpen van {y} in beurt {t} en {t2} ({d})", "hd.lk.bad1.you": "de worp van {y} in beurt {t} ({d})", "hd.lk.bad.3": "de worpen van {y} in beurt {t} en {t2} ({d})", "hd.lk.bad1.3": "de worp van {y} in beurt {t} ({d})",
  "hd.lk.good.short": "de worpen van {y} hielpen ({d})", "hd.lk.bad.short": "de worpen van {y} ({d})",
  "c.a": "{acc}, {errs}.", "c.b": "Zetten totaal {tot}: start {st} + zetten {mv}.", "c.b.3": "Zetten totaal van {x} {tot}: start {st} + zetten {mv}.",
  "wf.fair": "Eerlijk deel", "wf.start": "Startkeuzes", "wf.moves": "Zetten", "wf.luck": "Geluk", "wf.others": "Anderen", "wf.end": "Eind",
  "wf.start.sub": "{p} {a} i.p.v. {b}", "wf.start.ok": "startkeuzes in orde", "wf.moves.sub": "grootste misser: beurt {t}, {k1} i.p.v. {k2} ({d})", "wf.moves.sub.w": "grootste misser: beurt {t}, {w} ({d})", "wf.moves.none": "geen misser van {n} of meer", "wf.moves.rate": "{n} per zet",
  "wf.luck.sub": "grootste worp: {x} gooide {n} in beurt {t} ({d})", "wf.luck.none": "worpen, kaarten en plek", "wf.others.l": "hun zetten en geluk samen", "wf.others.up": "hielp jou: hun zetten en geluk samen", "wf.others.up.3": "hielp {x}: hun zetten en geluk samen", "wf.others.dn": "kostte jou: hun zetten en geluk samen", "wf.others.dn.3": "kostte {x}: hun zetten en geluk samen", "wf.after.lost": "je had na je laatste zet nog {w} kans; daarna ging het verloren", "wf.after.lost.3": "{x} had na de laatste zet nog {w} kans; daarna ging het verloren", "wf.others.o": "o.a. de worpen van {y} in beurt {t} en {t2} ({h})", "wf.others.o1": "o.a. de worp van {y} in beurt {t} ({h})", "wf.after.sub": "je had nog {w} kans; de rest van het spel besliste", "wf.after.sub.3": "er was nog {w} kans; de rest van het spel besliste", "c.few": "Te weinig beoordeelde zetten voor een oordeel ({n} beoordeeld).", "wf.others.sub": "hun zetten, hun geluk en de rest", "wf.others.rolls": "waarvan de worpen van {y} (beurt {t} en {t2}): {d}", "wf.others.rolls1": "waarvan de worp van {y} (beurt {t}): {d}",
  "wf.you": "jij", "rv.gained": "won", "rv.lost": "verloor", "rv.here": "hier", "pt.one": "punt", "pt.many": "punten", "wf.human": "de menselijke speler", "wf.pick": "keuze {n}",
};

export const TABLES = { en: EN, nl: NL };
/** The text of a key in a language (English unless "nl"); {name} is replaced by params.name. An unknown key comes back as the key itself (the test fails on it). */
export function tr(lang, key, params = {}) {
  const t = lang === "nl" ? NL : EN, s = t[key] ?? EN[key];
  return s == null ? key : s.replace(/\{(\w+)\}/g, (m, k) => (params[k] == null ? "" : String(params[k])));
}
