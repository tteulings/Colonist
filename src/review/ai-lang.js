// v1.84 Words of the dynamic AI page (EN / NL). The page follows the Recap language setting (recapLang in src/review-recap.js).
// Everything the page says itself lives here: titles, notes, labels, chart words, the turn sheet, verdict words. Numbers never do (they are refs).
export const DEV = { en: { knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "a point card" }, nl: { knight: "een ridder", roadBuilding: "Wegenbouw", yearOfPlenty: "Uitvinding", monopoly: "Monopolie", victoryPoint: "een puntenkaart" } };
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
    winChance: "Win chance", winChanceBy: "Win chance by turn", tapDot: "Tap a dot to open that turn", zoneOut: "out of it", zoneLead: "in front", zonePull: "pulling away", zoneLow: "low point", others: "others", tL: "T", points: "Points", pointsBy: "Points by turn", plan_: "plan", pivot: "pivot",
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
      lgCause: { dice: ", mostly on dice luck", card: ", mostly on a drawn card" },
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
    // v1.90 the ledger card and the round view (src/review/ai-ledger.js): segments are strings, { pl: seat } a name, { pos: seat } a possessive, { d: points, q, se, est } a signed number, { x } bold
    lg: {
      decided: "What decided it", chance: "Luck", choice: "Choice", chanceSub: "dice, drawn cards", choiceSub: "building, trading, robber", other: "other steps", total: "Total", steps: "Step by step", why: "Why", progress: "What the moves earned", cause: { dice: "Dice", card: "Drawn card", choice: "Choice" }, ctx: "Context",
      key: ["luck", "choice", "estimate"], noteA: (n) => `Luck and steps: margin up to ±${n} ${n === 1 ? "point" : "points"} per step.`, noteB: "≈ is an estimate (±), not counted in the total.", calc: "Calculating…", back: "Back", open: "Open turn", pointsWord: "points",
      sub: (from, to, d, pw) => `${from}% → ${to}% · ${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)} ${pw}`, income: "Your dots per resource", vs: "vs. doing nothing",
      dots: (n) => (n === 1 ? "dot" : "dots"), rw: (r) => LANG.en.res[r],
      scarceShort: (c) => [{ pl: c.q }, c.dots === 0 ? ` had no ${LANG.en.res[c.res]} dot` : " had only ", ...(c.dots === 0 ? [] : [{ x: c.dots }, ` ${LANG.en.res[c.res]} ${c.dots === 1 ? "dot" : "dots"}`])],
      spotShort: (c) => [{ pl: c.by }, " took ", { pos: c.q }, " best spot (", { x: c.pips }, ` ${c.pips === 1 ? "dot" : "dots"})`],
      gapShort: (c) => [`${LANG.en.res[c.res].replace(/^./, (x) => x.toUpperCase())} dots: `, { pl: c.winner }, " ", { x: c.dots }, ", you ", { x: c.mine }],
      pointsShort: (c) => ["Before it ", { pl: c.q }, " had ", { x: c.before }, ` ${c.before === 1 ? "point" : "points"}; the point card was point `, { x: c.after }],
      oddsShort: (c) => [`A ${c.sum} comes up `, { x: c.ways }, " times in 36; twice in a row about 1 in ", { x: c.oneIn }],
      bankShort: (c) => [{ pl: c.q }, " had ", { x: c.dots }, ` ${LANG.en.res[c.get]} ${c.dots === 1 ? "dot" : "dots"}: `, { x: c.ratio }, ` ${LANG.en.res[c.give]} → 1 ${LANG.en.res[c.get]} at the bank`],
      cap1: (c) => [...LANG.en.lg.scarceShort(c), `: ${LANG.en.res[c.res]} was scarce`],
      cap2: (c) => [{ pl: c.by }, " built on your best spot (", { x: c.pips }, ` ${c.pips === 1 ? "dot" : "dots"}): `, { x: c.after }, ` ${c.after === 1 ? "spot" : "spots"} within 1 road left, was `, { x: c.before }],
      noteTab: "This card and the Win chance tab use the same numbers once the card has finished calculating.", quiet: "Nothing moved much this turn.", askBehind: ["Why did your win chance drop in ", "?"], askTurn: ["What happened in ", "?"], askBehindOf: ["Why did the win chance of ", " drop in ", "?"], askTurnOf: ["What happened to ", " in ", "?"],
      ansBehind: (t, a, b, d, who) => `${who} dropped in turn ${t}, from ${a}% to ${b}% (${d < 0 ? "−" : "+"}${Math.abs(d)} ${Math.abs(d) === 1 ? "point" : "points"}). `, ansTurn: (t, a, b, d, who) => `In turn ${t} ${who} went from ${a}% to ${b}% (${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)} ${Math.abs(d) === 1 ? "point" : "points"}). `, ansWho: (name, you) => (you ? "your win chance" : `${name}’s win chance`),
      spotAlt: (n) => `Spot ${n}`, boardNote: (c) => [{ pl: c.by }, " takes it on turn ", { x: c.turn }],
      step: (it, me, win) => {
        const nm = (q) => ({ pl: q }), KIND = { settlement: "a settlement", city: "a city", road: "a road" }, RES = (l) => [...new Set(l)].map((r) => LANG.en.res[r]).join(" + ");
        if (it.type === "roll") { const oth = Object.entries(it.prod || {}).filter(([q]) => +q !== me), o = oth.filter(([q]) => +q === it.pid || +q === win || oth.length <= 2).slice(0, 3).map(([q, l]) => [nm(+q), " ", RES(l)]), mine = (it.prod || {})[me]; const b = []; if (it.sum === 7) b.push("robber"); else { o.forEach((s, i) => { if (i) b.push(" · "); b.push(...s); }); b.push(`${o.length ? " · " : ""}you ${mine?.length ? RES(mine) : "nothing"}`); } return { a: [nm(it.pid), it.pid === me ? " roll " : " rolls ", { x: it.sum }], b }; }
        if (it.type === "robber") return { a: [nm(it.pid), it.pid === me ? " move " : " moves", " the robber"], b: it.taken ? ["takes a card from ", nm(it.taken.from)] : [] };
        if (it.type === "build") return { a: [nm(it.pid), it.pid === me ? " build " : " builds ", KIND[it.what] || "something"], b: [] };
        if (it.type === "dev") return { a: [nm(it.pid), it.pid === me ? " buy " : " buys ", "a development card"], b: it.card ? [DEV.en[it.card] || ""] : [] };
        if (it.type === "play") return { a: [nm(it.pid), it.pid === me ? " play " : " plays ", DEV.en[it.card] || "a card"], b: [] };
        if (it.type === "bank") return { a: [nm(it.pid), it.pid === me ? " trade " : " trades ", "with the bank"], b: (it.tr || []).map((t, i) => (i ? ", " : "") + `${t[2]} ${LANG.en.res[t[0]]} → 1 ${LANG.en.res[t[1]]}`) };
        if (it.type === "ptrade") return { a: [nm(it.pid), it.pid === me ? " trade " : " trades ", "with a player"], b: [] };
        if (it.type === "end") return { a: [nm(it.pid), it.pid === me ? " end the turn" : " ends the turn"], b: [] };
        if (it.type === "discard") return { a: [nm(it.pid), it.pid === me ? " discard cards" : " discards cards"], b: [] };
        return { a: [nm(it.pid), " ", it.type], b: [] };
      },
      credit: (pid, acts, me) => { // what the player really did in that turn: built / traded / played / bought (from the records)
        const you = pid === me, v = (a, b) => (you ? a : b), KIND = { settlement: "a settlement", city: "a city", road: "a road" }, has = (t) => acts.filter((x) => x.type === t), parts = [];
        const bl = [...new Set(has("build").map((a) => KIND[a.what] || "a building"))]; if (bl.length) parts.push(`${v("build", "builds")} ${bl.join(" and ")}`);
        const bk = has("bank").length, pt = has("ptrade").length; if (bk && pt) parts.push(`${v("trade", "trades")} with the bank and a player`); else if (bk) parts.push(`${v("trade", "trades")} with the bank`); else if (pt) parts.push(`${v("trade", "trades")} with a player`);
        const pl = [...new Set(has("play").map((a) => DEV.en[a.card] || "a card"))]; if (pl.length) parts.push(`${v("play", "plays")} ${pl.join(" and ")}`);
        if (has("dev").length) parts.push(`${v("buy", "buys")} a development card`);
        return { a: [{ pl: pid }, " ", parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0] || v("act", "acts")], b: [] };
      },
      rowText: (f, o) => {
        const { me, win, subj, top } = f, rolls = top.filter((x) => x.type === "roll").slice(0, 2), sum = (l) => l.reduce((a, x) => a + Math.abs(x.d[subj]), 0), allSum = top.reduce((a, x) => a + Math.abs(x.d[subj]), 0), RES = (l) => [...new Set(l)].map((r) => LANG.en.res[r]).join(" and ");
        const dv = top.find((x) => x.type === "dev" && x.chance);
        if (dv && (!rolls.length || Math.abs(dv.d[subj]) >= sum(rolls))) { const od = o.sx && o.sx.turn === f.t && o.sx.odds ? o.sx.odds.pct : null; return [{ pl: dv.pid }, dv.card ? ` drew ${DEV.en[dv.card]}` : " bought a development card", ...(od != null ? [" (", { x: `${od}%` }, " chance)"] : []), ". ", { pl: me }, " ", { d: Math.round(dv.d[me] * 100), q: me }, "."]; }
        if (rolls.length && sum(rolls) >= 0.5 * allSum) {
          const got = {}; rolls.forEach((r) => Object.entries(r.prod || {}).forEach(([q, l]) => { got[q] = (got[q] || []).concat(l); }));
          const ben = Object.entries(got).filter(([q]) => +q !== me).sort((a, b) => b[1].length - a[1].length)[0], B = ben ? +ben[0] : me, cards = got[B] || [], d = (r) => ({ d: Math.round(r.d[subj] * 100), q: subj }), blt = (o.built || []).find((b) => b.pid === B);
          const bw = blt ? { settlement: "a settlement", city: "a city", road: "a road" }[blt.what] : null;
          if (rolls.length === 2 && rolls[0].sum === rolls[1].sum && rolls.every((r) => (r.prod?.[B] || []).length)) return [`Two ${rolls[0].sum}s: `, { x: cards.length }, ` ${cards.length === 1 ? "card" : "cards"} for `, { pl: B }, " (", d(rolls[0]), " and ", d(rolls[1]), ")."];
          const parts = []; rolls.forEach((r, i) => { if (i) parts.push(" and "); parts.push({ pos: r.pid }, " ", { x: r.sum }, " (", d(r), ")"); });
          return [...parts, " gave ", { pl: B }, cards.length ? ` ${RES(cards)}` : " nothing", ...(bw ? [`, with which `, { pl: B }, ` built ${bw}`] : []), "."];
        }
        if (o.credit && top[0] && !top[0].chance) return [...o.credit.title, " together ", { d: o.credit.pts, q: subj, est: true, se: o.credit.se }, "."]; // the progress credit (B) of that turn, when it is valued
        const t0 = top[0]; if (!t0) return [{ pl: subj }, " moved ", { d: 0, q: subj }, "."];
        const s = LANG.en.lg.step(t0, me, win); return [...s.a, " (", { d: Math.round(t0.d[subj] * 100), q: subj }, ")."];
      },
    },
  },
  nl: {
    you: "Jij", lv: { Game: "Spel", "Near miss": "Net niet", Decision: "Beslissing", Strategy: "Strategie", Luck: "Geluk" },
    res: { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" }, abbr: { wood: "Ho", brick: "Ba", sheep: "Wo", wheat: "Gr", ore: "Er" },
    plan: { X: "uitbreiden", C: "steden en kaarten", M: "een mix" },
    verdict: { weak: "Zwak plan", "probably-weak": "Waarschijnlijk zwak plan", solid: "Sterk plan", "probably-solid": "Waarschijnlijk sterk plan", unclear: "Moeilijk te zeggen" },
    conf: { clear: "Duidelijk beter", lean: "Waarschijnlijk beter", close: "Nipt verschil" },
    headless: "Kip zonder kop", yes: "Ja", partly: "Deels", no: "Nee",
    turn: "beurt", Turn: "Beurt", setup: "beginopstelling", more: "Meer", details: "Details", foot: "Samenvatting uit de cijfers van dit spel. Beta.", footAi: "Voor dit spel samengesteld uit de cijfers. Beta.", composing: "Een pagina voor dit spel samenstellen", of: "van",
    fuWork: "Een plaatje samenstellen", fuNone: "Hier past geen plaatje bij, dus hier is het geschreven antwoord.", fuFail: "Dit keer geen antwoord.", fuAsked: "Jouw vraag", bd: { played: "Gespeeld", better: "Beter", alt: "Optie", paid: "Uitbetaald", robber: "Rover", pirate: "Piraat", marked: "Gemarkeerd", res: { wood: "Hout", brick: "Baksteen", sheep: "Wol", wheat: "Graan", ore: "Erts", desert: "Woestijn", gold: "Goud" }, aria: "Bord" },
    winChance: "Winkans", winChanceBy: "Winkans per beurt", tapDot: "Tik op een stip om die beurt te openen", zoneOut: "kansarm", zoneLead: "voorop", zonePull: "loopt uit", zoneLow: "dieptepunt", others: "anderen", tL: "B", points: "Punten", pointsBy: "Punten per beurt", plan_: "plan", pivot: "omslag",
    src: { s: "Dorp", c: "Stad", L: "Langste handelsroute", A: "Grootste riddermacht", v: "Puntenkaart" }, srcPl: { s: "Dorpen", c: "Steden", L: "Langste handelsroute", A: "Grootste riddermacht", v: "Puntenkaarten", I: "Nieuwe eilanden" },
    road: "Weg", stalled: "Vastgelopen", planL: "Plan", hand: "Kaarten in de hand", handBy: "Kaarten in de hand per beurt", otherTurns: "Andere beurten", built: "Iets gebouwd",
    rolled: "Keer gegooid", diceNr: "Worp", rolledL: "Gegooid", expected: "Verwacht", diceAria: "Dobbelstenen",
    pointsBySrc: "Punten per bron", haveOf: (a, b) => `${a} van ${b}`, dashed: " (stippellijn: nog nodig)",
    tStalled: "Vastgelopen beurten", startFeeds: "Start voedt het plan", short: "Tekort aan het eind", tbl: { dice: "Worp", steal: "Pakken", draw: "Kaarten", seat: "Plek" },
    why: "Waarom?", prev: "Vorige beurt", next: "Volgende beurt", nothing: "Er veranderde weinig in deze beurt.", wcIn: "Winkans in deze beurt", open: (s) => `Open ${s}`, board: "Toon het bord", close: "Sluit",
    built1: (c) => `bouwde een ${c === "c" ? "stad" : "dorp"}.`,
    cause: (c, nm) => (c.kind === "dice" ? `gooide ${c.data.roll}` : c.kind === "steal" ? `pakte een kaart van ${nm(c.data.victim)}` : c.kind === "dev" ? `trok ${DEV.nl[c.data.card] || "een kaart"}` : c.kind === "build" ? `bouwde een ${{ road: "weg", city: "stad", settlement: "dorp" }[c.data.what] || c.data.what}` : c.kind === "play" ? `speelde ${DEV.nl[c.data.what] || c.data.what}` : ""),
    short_: { wc: "winkans", near: "net niet", gs: "het plan", dec: "de beslissing", luck: "geluk", wait: (r) => `${r} en kaarten` },
    r: {
      won: (T, pts) => [" won op ", T, " met ", pts, " punten."], lostA: " won op ", lostB: " stond op ", lostC: " punten.",
      wcLead: (you, P) => (you ? ["Jouw winkans "] : ["De winkans van ", P, " "]), wcFrom: " van ", wcTo: " naar ", wcOn: " op ", up: "steeg", down: "daalde",
      lgCause: { dice: ", vooral door dobbelstenen", card: ", vooral door een getrokken kaart" },
      wcN1: "De stippen tonen de beurten waarin de winkans het meest veranderde. Tik op een stip om die beurt te openen.", wcN2: "Elke winkans komt uit doorgespeelde toekomsten vanaf die stand, dus een nieuwe run verschuift hem iets.",
      nearOne: { a: " van de ", b: " punten. ", c: " tekort op " }, nearEnd: " punten aan het eind.",
      headless: { a: " zat ", b: " van de ", c: " beurten vast, zonder vast plan." },
      pivot: { a: " koos eerst voor ", b: " en stapte over op ", c: " bij " }, steady: { a: " koos voor ", b: " en bleef daarbij. ", n: (k) => plural(k, " vastgelopen beurt.", " vastgelopen beurten.") },
      plain: { a: " had ", n: (k) => plural(k, " vastgelopen beurt van ", " vastgelopen beurten van "), z: "." },
      gsN1: "Plan: de eerste twee bouwacties na de beginopstelling. Vastgelopen beurt: geen punten terwijl je vier kaarten of meer vasthoudt.", gsN2: { a: "De winkans daalde ", b: " over de vastgelopen beurten." },
      waiting: " keer wachten op ", wait: { a: "Kaarten in de hand, geen punten. ", b: " uit dobbelstenen: ", c: " per beurt, beste tegenstander ", d: "." }, waitUnit: (r) => `${r} uit dobbelstenen, kaarten per beurt`,
      luck: { a: " had ", b: " winkans door toeval." }, luckUnit: "winkans gewonnen of verloren door toeval",
      dec: { a: "Op ", b: " was een andere zet ", c: " beter." }, decN: "Winkans na elke zet, uit toekomsten die de review doorspeelde.",
      follow: { won: "Waarom won ik?", lost: "Waarom verloor ik?", best: "Beste zet van het spel?", lucky: "Wie had het meeste geluk?", plan: "Wat was het plan van de winnaar?" },
    },
    // v1.90 de ledger-kaart en de beurtweergave (src/review/ai-ledger.js): segmenten zijn tekst, { pl: stoel } een naam, { pos: stoel } een bezitsvorm, { d: punten, q, se, est } een getal met teken, { x } vet
    lg: {
      decided: "Waar het om draaide", chance: "Geluk", choice: "Keuze", chanceSub: "dobbelstenen, getrokken kaarten", choiceSub: "bouwen, ruilen, rover", other: "overige stappen", total: "Totaal", steps: "Stap voor stap", why: "Waarom", progress: "Wat de zetten opleverden", cause: { dice: "Dobbelstenen", card: "Getrokken kaart", choice: "Keuze" }, ctx: "Context",
      key: ["geluk", "keuze", "schatting"], noteA: (n) => `Geluk en stappen: marge tot ±${n} ${n === 1 ? "punt" : "punten"} per stap.`, noteB: "≈ is een schatting (±), niet meegeteld in het totaal.", calc: "Rekent…", back: "Terug", open: "Open beurt", pointsWord: "punten",
      sub: (from, to, d, pw) => `${from}% → ${to}% · ${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)} ${pw}`, income: "Jouw stippen per grondstof", vs: "vergeleken met niets doen",
      dots: (n) => (n === 1 ? "stip" : "stippen"), rw: (r) => LANG.nl.res[r],
      scarceShort: (c) => (c.dots === 0 ? [{ pl: c.q }, ` had geen ${LANG.nl.res[c.res]}stip`] : [{ pl: c.q }, " had maar ", { x: c.dots }, ` ${LANG.nl.res[c.res]}stip`]),
      spotShort: (c) => [{ pl: c.by }, " nam ", { pos: c.q }, " beste plek (", { x: c.pips }, ` ${c.pips === 1 ? "stip" : "stippen"})`],
      gapShort: (c) => [`${LANG.nl.res[c.res].replace(/^./, (x) => x.toUpperCase())}stippen: `, { pl: c.winner }, " ", { x: c.dots }, ", jij ", { x: c.mine }],
      pointsShort: (c) => ["Ervoor had ", { pl: c.q }, " ", { x: c.before }, ` ${c.before === 1 ? "punt" : "punten"}; de puntenkaart was punt `, { x: c.after }],
      oddsShort: (c) => [`Een ${c.sum} valt `, { x: c.ways }, " van de 36 keer; twee keer achter elkaar ongeveer 1 op ", { x: c.oneIn }],
      bankShort: (c) => [{ pl: c.q }, " had ", { x: c.dots }, ` ${LANG.nl.res[c.get]}${c.dots === 1 ? "stip" : "stippen"}: `, { x: c.ratio }, ` ${LANG.nl.res[c.give]} → 1 ${LANG.nl.res[c.get]} bij de bank`],
      cap1: (c) => [...LANG.nl.lg.scarceShort(c), `: ${LANG.nl.res[c.res]} was schaars`],
      cap2: (c) => [{ pl: c.by }, " bouwde op je beste plek (", { x: c.pips }, ` ${c.pips === 1 ? "stip" : "stippen"}): nog `, { x: c.after }, ` ${c.after === 1 ? "dorpsplek" : "dorpsplekken"} binnen 1 weg, was `, { x: c.before }],
      noteTab: "Deze kaart en de Winkans-tab gebruiken dezelfde cijfers zodra de kaart klaar is met rekenen.", quiet: "Er veranderde weinig in deze beurt.", askBehind: ["Waarom zakte je winkans in ", "?"], askTurn: ["Wat gebeurde er in ", "?"], askBehindOf: ["Waarom zakte de winkans van ", " in ", "?"], askTurnOf: ["Wat gebeurde er met ", " in ", "?"],
      ansBehind: (t, a, b, d, who) => `${who} zakte in beurt ${t} van ${a}% naar ${b}% (${d < 0 ? "−" : "+"}${Math.abs(d)} ${Math.abs(d) === 1 ? "punt" : "punten"}). `, ansTurn: (t, a, b, d, who) => `In beurt ${t} ging ${who} van ${a}% naar ${b}% (${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)} ${Math.abs(d) === 1 ? "punt" : "punten"}). `, ansWho: (name, you) => (you ? "je winkans" : `${name}${/[sxz]$/i.test(name) ? "’" : "s"} winkans`),
      spotAlt: (n) => `Plek ${n}`, boardNote: (c) => [{ pl: c.by }, " neemt hem in beurt ", { x: c.turn }],
      step: (it, me, win) => {
        const nm = (q) => ({ pl: q }), KIND = { settlement: "een dorp", city: "een stad", road: "een weg" }, RES = (l) => [...new Set(l)].map((r) => LANG.nl.res[r]).join(" + ");
        if (it.type === "roll") { const oth = Object.entries(it.prod || {}).filter(([q]) => +q !== me), o = oth.filter(([q]) => +q === it.pid || +q === win || oth.length <= 2).slice(0, 3).map(([q, l]) => [nm(+q), " ", RES(l)]), mine = (it.prod || {})[me]; const b = []; if (it.sum === 7) b.push("rover"); else { o.forEach((s, i) => { if (i) b.push(" · "); b.push(...s); }); b.push(`${o.length ? " · " : ""}jij ${mine?.length ? RES(mine) : "niets"}`); } return { a: [nm(it.pid), " gooit ", { x: it.sum }], b }; }
        if (it.type === "robber") return { a: [nm(it.pid), " verplaatst de rover"], b: it.taken ? ["pakt een kaart van ", nm(it.taken.from)] : [] };
        if (it.type === "build") return { a: [nm(it.pid), " bouwt ", KIND[it.what] || "iets"], b: [] };
        if (it.type === "dev") return { a: [nm(it.pid), " koopt een ontwikkelingskaart"], b: it.card ? [DEV.nl[it.card] || ""] : [] };
        if (it.type === "play") return { a: [nm(it.pid), " speelt ", (DEV.nl[it.card] || "een kaart").replace(/^een /, "")], b: [] };
        if (it.type === "bank") return { a: [nm(it.pid), " ruilt met de bank"], b: (it.tr || []).map((t, i) => (i ? ", " : "") + `${t[2]} ${LANG.nl.res[t[0]]} → 1 ${LANG.nl.res[t[1]]}`) };
        if (it.type === "ptrade") return { a: [nm(it.pid), " ruilt met een speler"], b: [] };
        if (it.type === "end") return { a: [nm(it.pid), " beëindigt de beurt"], b: [] };
        if (it.type === "discard") return { a: [nm(it.pid), " legt kaarten af"], b: [] };
        return { a: [nm(it.pid), " ", it.type], b: [] };
      },
      credit: (pid, acts, me) => { // wat de speler echt deed in die beurt: bouwen / ruilen / spelen / kopen (uit de records)
        const KIND = { settlement: "een dorp", city: "een stad", road: "een weg" }, has = (t) => acts.filter((x) => x.type === t), parts = [];
        const bl = [...new Set(has("build").map((a) => KIND[a.what] || "een gebouw"))]; if (bl.length) parts.push(`bouwt ${bl.join(" en ")}`);
        const bk = has("bank").length, pt = has("ptrade").length; if (bk && pt) parts.push("ruilt met de bank en een speler"); else if (bk) parts.push("ruilt met de bank"); else if (pt) parts.push("ruilt met een speler");
        const pl = [...new Set(has("play").map((a) => (DEV.nl[a.card] || "een kaart").replace(/^een /, "")))]; if (pl.length) parts.push(`speelt ${pl.join(" en ")}`);
        if (has("dev").length) parts.push("koopt een ontwikkelingskaart");
        return { a: [{ pl: pid }, " ", parts.length > 1 ? parts.slice(0, -1).join(", ") + " en " + parts[parts.length - 1] : parts[0] || "doet iets"], b: [] };
      },
      rowText: (f, o) => {
        const { me, win, subj, top } = f, rolls = top.filter((x) => x.type === "roll").slice(0, 2), sum = (l) => l.reduce((a, x) => a + Math.abs(x.d[subj]), 0), allSum = top.reduce((a, x) => a + Math.abs(x.d[subj]), 0), RES = (l) => [...new Set(l)].map((r) => LANG.nl.res[r]).join(" en ");
        const dv = top.find((x) => x.type === "dev" && x.chance);
        if (dv && (!rolls.length || Math.abs(dv.d[subj]) >= sum(rolls))) { const od = o.sx && o.sx.turn === f.t && o.sx.odds ? o.sx.odds.pct : null; return [{ pl: dv.pid }, dv.card ? ` trok ${DEV.nl[dv.card]}` : " kocht een ontwikkelingskaart", ...(od != null ? [" (kans ", { x: `${od}%` }, ")"] : []), ". ", { pl: me }, " ", { d: Math.round(dv.d[me] * 100), q: me }, "."]; }
        if (rolls.length && sum(rolls) >= 0.5 * allSum) {
          const got = {}; rolls.forEach((r) => Object.entries(r.prod || {}).forEach(([q, l]) => { got[q] = (got[q] || []).concat(l); }));
          const ben = Object.entries(got).filter(([q]) => +q !== me).sort((a, b) => b[1].length - a[1].length)[0], B = ben ? +ben[0] : me, cards = got[B] || [], d = (r) => ({ d: Math.round(r.d[subj] * 100), q: subj }), blt = (o.built || []).find((b) => b.pid === B);
          const bw = blt ? { settlement: "een dorp", city: "een stad", road: "een weg" }[blt.what] : null;
          if (rolls.length === 2 && rolls[0].sum === rolls[1].sum && rolls.every((r) => (r.prod?.[B] || []).length)) return [`Twee keer een ${rolls[0].sum}: `, { x: cards.length }, ` ${cards.length === 1 ? "kaart" : "kaarten"} voor `, { pl: B }, " (", d(rolls[0]), " en ", d(rolls[1]), ")."];
          const parts = []; rolls.forEach((r, i) => { if (i) parts.push(" en "); parts.push({ pos: r.pid }, " ", { x: r.sum }, " (", d(r), ")"); });
          return [...parts, rolls.length === 1 ? " gaf " : " gaven ", B === me ? "jou" : { pl: B }, cards.length ? ` ${RES(cards)}` : " niets", ...(bw ? [", waarmee ", { pl: B }, ` ${bw} bouwde`] : []), "."];
        }
        if (o.credit && top[0] && !top[0].chance) return [...o.credit.title, " samen ", { d: o.credit.pts, q: subj, est: true, se: o.credit.se }, "."]; // de voortgangswaarde (B) van die beurt, als die berekend is
        const t0 = top[0]; if (!t0) return [{ pl: subj }, " bewoog ", { d: 0, q: subj }, "."];
        const s = LANG.nl.lg.step(t0, me, win); return [...s.a, " (", { d: Math.round(t0.d[subj] * 100), q: subj }, ")."];
      },
    },
  },
};
export const langOf = (l) => LANG[l] || LANG.en;

// ── move labels: the review stores them in English ("Robber on Grain 9", "Settlement on Lumber 4, Ore 3"); the page shows them in its language ──
const NLW = { Lumber: "Hout", Brick: "Baksteen", Wool: "Wol", Grain: "Graan", Ore: "Erts", Desert: "Woestijn", Tile: "Tegel", coast: "kust", Knight: "Ridder", "Road Building": "Wegenbouw", "Year of Plenty": "Uitvinding", Monopoly: "Monopolie", "Victory Point": "Puntenkaart" };
const NLD = { "top left": "linksboven", "top right": "rechtsboven", "bottom left": "linksonder", "bottom right": "rechtsonder", top: "boven", bottom: "onder", left: "links", right: "rechts", centre: "midden" };
const NLR = [[/^Settlement on /, "Dorp op "], [/^City on /, "Stad op "], [/^Spot on /, "Plek op "], [/^Road toward /, "Weg richting "], [/^Road(?= )/, "Weg"], [/^Robber on /, "Rover op "], [/^Pirate on /, "Piraat op "], [/^Bank trade /, "Bankruil "], [/^Development card$/, "Ontwikkelingskaart"], [/^Play /, "Speel "], [/^End turn$/, "Beurt beëindigen"], [/^Ship toward /, "Schip richting "], [/^Ship(?= )/, "Schip"], [/^Move ship /, "Verplaats schip "], [/^Road$/, "Weg"], [/^Ship$/, "Schip"], [/^the sea, /, "de zee, "]];
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
