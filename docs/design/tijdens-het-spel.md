# Katan 1.99 in het spel: bouwspecificatie (alle spelschermen en staten)

Dit document beschrijft elk scherm en elke staat tijdens een spel, zoals getoond in de mockups in `game/mock/*.html` (generators `game/mock/p01..p10.mjs`, screenshots `game/shots-v2/`). Alle teksten zijn Nederlands, zonder gedachtestreep, en alle getallen, namen en handen in de mockups zijn **voorbeeldgegevens** (gemarkeerd als "voorbeeld"). Tokens komen uit `DESIGN-SYSTEM.md`; kleine uitzonderingen staan in "Gedeeld". Beslissingen van de productowner zijn verwerkt: (1) de iconen en knoppen van de huidige app (`src/ui-icons.js`, sprite `ic-*`, CSS `.mbtn`) blijven, nieuwe outline-iconen alleen waar de app er geen heeft; (2) de spelerstrip is compact (56 px) zodat het bord minstens zo groot is als nu; (3) de hand is exact de huidige waaier (themes/base.css `.hand .card`, `--rot`/`--dy` uit `src/game.js` regel 8640): zelfde plek, maat, overlap en tilt. Maten zijn op 360 breed (412: zie "412-verschil" per scherm, in het algemeen zijn alleen de gaten breder).

## Index

| Nr | Scherm | Nr | Scherm |
| --- | --- | --- | --- |
| 1 | Hoofdscherm: jouw beurt | 23 | Bot aan de beurt |
| 2 | Voor de worp: Gooi | 24 | Beurtkaartje: bot is klaar |
| 3 | Worp en opbrengst | 25 | Dit gebeurde (ronde-samenvatting) |
| 4 | Einde beurt met beschermlaag | 26 | Logboek |
| 5 | Bouwtray | 27 | Opstelling: eerste dorp |
| 6 | Ruilen: bank en havens | 28 | Opstelling: plek gekozen |
| 7 | Ruilen: spelers bieden | 29 | Opstelling: tweede dorp |
| 8 | Inkomend bod van een bot | 30 | Stippen-blad |
| 9 | Bod verlopen na 8 s | 31 | Haven-blad |
| 10 | Rover: kies een tegel | 32 | Pauze-blad |
| 11 | Rover: kies een speler (bubbel) | 33 | Rush |
| 12 | Rover: een slachtoffer | 34 | Seafarers |
| 13 | Rover: uitkomst | 35 | 5-6 spelers en bouwvenster |
| 14 | Rover: vangnetblad | 36 | Hot-seat: overdrachtscherm |
| 15 | Afleggen bij een 7 | 37 | Hot-seat: spelen |
| 16 | Afleggen: vol | 38 | Dagpuzzel: de run |
| 17 | Anderen leggen af | 39 | Dagpuzzel: Pauze en regels |
| 18 | Ontwikkelingskaarten-blad | 40 | Dagpuzzel: Opgeven |
| 19 | Kaart kopen: onthulling | 41 | Dagpuzzel: ruilen alleen met de bank |
| 20 | Monopolie en Uitvinding kiezen | 42 | Dagpuzzel: hervatten |
| 21 | Winkans in de spelerchips | 43 | Dagpuzzel: beurt 38 van 40 |
| 22 | Winkans-blad |  |  |

## Gedeeld (geldt voor alle schermen, wordt hieronder niet herhaald)

Kolom "Maat" is breedte x hoogte in px op 360 x 780. Zones van boven naar onder:

| Zone | Maat | Inhoud en tokens |
| --- | --- | --- |
| Spelerstrip | 360 x 56 (met live winkans 70, 6 spelers 76) | 4 chips van 79 x 48, gap 6, padding 12/4. Chip: `--chip` 8% seat-tint, 1px randtint, radius 12, binnenpadding 2/3. Eerste regel (28 hoog): avatar 28 links (ring 2px in seat-kleur, `--p0..p5`, binnen de 28), rechts de naam (Figtree 11.5/700, `--ink`, ellipsis). Tweede regel (14 hoog, gaps 4): puntenpil (seat-kleur, tekst `--pi`, Outfit 12/700, min 18 breed), kaarten en ontwikkelingskaarten (sprite `ic-cards`, `ic-devcard` 11 px, 11.5/700). Niets ligt over de avatar. Langste weg, grootste leger, kroon (leider) en zandloper (wacht) staan als klein rond vlaggetje (15) in de rechterbovenhoek van de chip, naast elkaar. Actief: wit, 2px `--accent` ring, wijzer (14 px ruit) naar de beurtbalk. Chip is knop (opent Winkans-blad, scherm 22), min 44 hoog is gehaald door de strip-rij (56). |
| Beurtbalk | 336 x 52, marge 6/12 | Wit (`--chip`), 1px `--chip-border`, radius 16, schaduw kaart. Avatar 36 van wie speelt, titel (Outfit 17/650, `--heading`), regel (Figtree 12.5/600, `--ink-soft`), stappenspoor (3 cirkels 25: dobbel, hamer, vlag; op = `--primary`, klaar = `--teal-soft`, nog niet = #EFE9DB) of ring met seconden, chevron (sprite `ic-chevron`, 20). Hele balk is een knop (min 44 hoog) die het Logboek opent (26). Stip (`--accent`, 9) als er nieuws in het log staat. |
| Bord | 360 x 591 (y 117 tot 708, zelfde als nu 589) | Canvas, bordkunst en pionnen ongewijzigd. Eiland vult de breedte: middelpunten van de tegels 240 x 208 px (nu 234 x 203 in de live app v1.98, gemeten met `worldToScreen` op 360 x 780; 412 x 923: nu 248 x 215, nieuw 288 x 249). Midden van het eiland ligt boven de hand. Pinch zoomt, een tik op de zoomknop wisselt passen / 1.4x. |
| Bovenrij op het bord | y 125, hoogte 44 | Pauze-knop links (44 x 44, radius 14, wit 94%, sprite `ic-menu`), dobbelchip midden (hoogte 44: twee dobbelstenen 28 + som Outfit 24/700, 7 in `--accent-ink`), zoomknop rechts (44 x 44, outline-zoom omdat de app hier geen kleuren-icoon voor heeft). |
| Hand (overlay) | 360 x 112, onderkant op de dockrand (y 596 tot 708), ligt over het bord | Zoals de huidige app: 5 kaarten van 54 x 75.6 (kaartkunst `cardm-*`), `margin-right -2`, `padding 13 12 22 26` (de rij begint links, niet gecentreerd), `transform-origin 50% 120%`, `rotate((i-2) x 2.6deg) translateY(\|i-2\| x 1.6px)` (dus -5.2, -2.6, 0, 2.6, 5.2 graden), z-index oplopend. Op de kaart onderaan een lint (#FBF6EA, radius 0 0 5 5) met aantal (Figtree 15/900) en naam (11.5/800) in grondstofkleur (hout #1C5226, baksteen #8A2E17, wol #2F5A1E, graan #7A5A0E, erts #3A4A5A). Stapelrand bij 2 kaarten (1 laag, #EADFC6) en bij 3+ (2 lagen, #DCCFB2). Onder elke kaart het banksaldo-lipje (sprite `ic-bank` 11 + getal 11.5/750, 13 hoog, `rgba(253,251,246,.94)`). Leeg (0): 38% dekking, grijs. Geselecteerd/gemarkeerd: rechtgezet, 12 px omhoog, schaal 1.04, 3px `--accent` rand. Transitie 200 ms `cubic-bezier(.3,1.4,.5,1)`. Kaarten zijn knoppen (54 x 76) en breken de 44 px-regel niet. |
| Handpil | 24 hoog, links 12, 12 boven de hand | Kaartenteller: sprite `ic-cards` 14 + totaal + streepje + `ic-bank` 14. Achtergrond `rgba(222,246,245,.92)`, tekst #17434A; bij meer dan 7 kaarten waarschuwing (#FBE2B8, tekst #8A3A0E). Niet interactief. |
| Kaartenknop | 44+ x 44, rechts 12, 34 boven de hand | Wit, radius 14: sprite `ic-devcard` 24 + aantal ontwikkelingskaarten + chevron; `--accent` stip (9) als er iets speelbaar is. Opent scherm 18. |
| Dock | 360 x 72, padding 8/12 | Achtergrond `--dock`, rand boven. 3 tegels 60 x 56, gap 6, radius 10 (`--btn-radius`), fill `--btn` (huidige app: rgba(240,250,249,.95)), 1px rgba(255,255,255,.4), schaduw `--btn-shadow`; sprite-icoon 28 (`ic-build`, `ic-devcard` 24 + 3 minikaartjes 10 x 14, `ic-trade`), label Figtree 11.5/700 `--ink`. Primair 138 x 56, radius 10 (huidige `.mainbtn`), `--primary` verloop (#22666D naar #1C585F), rand #164C52, tekst `--primary-ink` Outfit 17/650, tweede regel 11.5/600. **Uitgeschakeld = huidige app: 45% dekking, verzadiging 30%, geen streeprand.** Beschikbaar: `--accent` stip (9) rechtsboven op de tegel. |
| Sheet | zie DS 5 | Scrim `--scrim`, radius 22 boven, grab 36 x 4, titel Outfit 20/650 + X (44), sticky voet met een primaire knop. |

**Open punt (productbeslissing, nog niet genomen):** bankchips onder handkaarten: altijd of alleen als de bank bijna leeg is.

Iconen: sprite-iconen van de app (`ic-build`, `ic-devcard`, `ic-trade`, `ic-dice`, `ic-menu`, `ic-check`, `ic-close`, `ic-chevron`, `ic-undo`, `ic-bank`, `ic-road`, `ic-settlement`, `ic-city`, `ic-ship`, `ic-end`, `ic-log`, `ic-hint`). Nieuwe outline-iconen alleen voor: zoom, vlag (stap 3), oog-uit, slot, puzzel, kroon, trend. Bots krijgen nooit rood of groen als betekenis; antwoorden van bots zijn inkt (vinkje, kruis, puntjes).

---

### 1 Hoofdscherm: jouw beurt

&#91;image: 1 Hoofdscherm: jouw beurt (voorbeelddata)\]

Donker: zie mockup m-p01-dark-2-360.png

Doel: het scherm waar de speler het grootste deel van het spel op zit: bord, hand en vier vaste vakken.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Spelerstrip | Jij 4, Blaauw 3, Geelen 5, Pimpel 3 (voorbeeld) | 360 x 56 | `--chip`, `--p0..p5` | Tik op een chip opent Winkans-blad (22) |
| Beurtbalk | Avatar Jij, "Jouw beurt", "Je krijgt" + 2 winstchips (+1 hout, +1 graan), stappenspoor stap 2 | 336 x 52 | `--chip`, `--heading`, `--teal-soft` | Tik opent Logboek (26) |
| Pauze | sprite `ic-menu` | 44 x 44 | wit 94% | Opent Pauze-blad (32) |
| Dobbelchip | twee dobbelstenen + "8" | ca. 112 x 44 | wit 96%, Outfit 24/700 | Niet interactief, 5 s na de worp blijft staan tot Einde beurt |
| Zoom | outline-zoom | 44 x 44 | wit 94% | Tik wisselt passen / 1.4x |
| Bord | eiland, pionnen, rover | 360 x 591 | bordkunst ongewijzigd | Pinch, slepen, tik op getal opent 30, tik op haven opent 31 |
| Handpil | kaarten 9, bank | 24 hoog | #FBE2B8 (meer dan 7) | Alleen info |
| Kaartenknop | ontwikkelingskaart 2 met stip | 52 x 44 | wit, `--accent` stip | Opent 18 |
| Hand | 5 kaarten in waaier: 3 hout, 2 baksteen, 1 wol, 2 graan, 1 erts (voorbeeld) + banksaldo 16, 17, 17, 16, 15 (voorbeeld) | 5 x 54 x 76 | zie Gedeeld | Tik op kaart opent Ruilen (6) met die kaart gekozen |
| Dock tegel Bouwen | sprite `ic-build`, "Bouwen", stip | 60 x 56 | `--btn` | Opent Bouwtray (5) |
| Dock tegel Koop kaart | `ic-devcard`, "Koop kaart", 3 minikaartjes (wol, graan, erts), stip | 60 x 56 | `--btn` | Koopt direct een kaart (19) als je hem kunt betalen |
| Dock tegel Ruilen | `ic-trade`, "Ruilen" | 60 x 56 | `--btn` | Opent Ruilen (6) |
| Primair | "Einde beurt" + avatar 18 van volgende + "Blaauw is hierna" | 138 x 56 | `--primary` | Tik: beschermlaag (4) als je nog iets kunt betalen, anders einde beurt |

Staten:

- normaal: zoals boven.
- leeg: hand zonder kaarten toont 5 lege sloten (38%), handpil "0".
- uitgeschakeld: tegels 45% dekking, verzadiging 30% (Bouwen als niets betaalbaar is; Koop kaart bij lege stapel).
- fout: geen rode fouten voor anderen; een onmogelijke tik geeft een toast van 1 regel ("Nog geen kaart te kopen").
- donker: tokens uit DS sectie 2, bordkunst blijft licht; kaartkunst blijft ongewijzigd.
- 412-verschil: bord 412 x 734, eiland 288 x 249, hand begint op dezelfde 26 px marge, primair 190 breed, tegels blijven 60.

Teksten: "Jouw beurt", "Je krijgt", "Bouwen", "Koop kaart", "Ruilen", "Einde beurt", "Blaauw is hierna", "Jouw kaarten", "Pauze".

Interactie:

1. Tik op beurtbalk of chevron: Logboek schuift omhoog (260 ms).
2. Tik op Bouwen: dock wordt Bouwtray (5), 200 ms schuif.
3. Tik op een kaart in de hand: Ruilen-blad (6), kaart schuift 12 px omhoog (200 ms).
4. Tik op Einde beurt: zie 4; zonder beschermlaag: beurtbalk wisselt naar de volgende speler (150 ms fade).
5. Lang drukken op een kaart: tooltip met naam en banksaldo (400 ms).

Toegankelijkheid:

- aria-labels: "Pauze", "Zoom", "Logboek openen", "Hout: 3" (per kaart), "Ontwikkelingskaarten, 2, 1 speelbaar", "Bouwen", "Koop een ontwikkelingskaart (1 wol, 1 graan, 1 erts)", "Ruilen", "Einde beurt, Blaauw is hierna".
- focusvolgorde: strip, beurtbalk, Pauze, zoom, kaartenknop, hand van links naar rechts, Bouwen, Koop kaart, Ruilen, primair.
- beurtbalk is `aria-live=polite`; reduced motion: waaier-transitie, schuiven en pulsen worden fades van 120 ms.

Data: `g.players[i].victoryPoints`, `resources` (som), `devCards.length`, `g.longestRoadOwner`, `g.largestArmyOwner`; hand uit `human.resources`; banksaldo uit `g.bank[resource]`; stip Bouwen/Koop kaart uit de bestaande betaalbaarheidscheck; dobbelchip uit `g.lastRoll`. Alle getallen in de afbeelding zijn voorbeeld.

### 2 Voor de worp: Gooi

&#91;image: 2 Voor de worp: Gooi (voorbeelddata)\]

Donker: zie mockup m-p01-dark-1-360.png

Doel: aan het begin van je beurt is Gooi de enige actie.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Spelerstrip | als 1, Jij actief | 360 x 56 | `--chip` | Als 1 |
| Beurtbalk | "Jouw beurt", "Gooi de dobbelstenen", stap 1 (dobbel aan) | 336 x 52 | `--primary` stap | Tik opent log |
| Bovenrij | Pauze en zoom, geen dobbelchip | 44 x 44 | wit 94% | Als 1 |
| Bord | eiland | 360 x 591 |  |  |
| Hand | 5 kaarten (voorbeeld) | 112 hoog |  | Kaarten tikbaar, Ruilen nog niet |
| Dock tegels | Bouwen, Koop kaart, Ruilen uitgeschakeld | 3 x 60 x 56 | 45% dekking | Niet tikbaar |
| Primair | sprite `ic-dice` + "Gooi" | 138 x 56 | `--primary` | Tik gooit |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: tegels 45% (huidige app-stijl, geen streeprand).
- fout: n.v.t.
- donker: m-p01-dark-1.
- 412-verschil: alleen breder.
- Rush: geen Gooi, zie 33.

Teksten: "Gooi", "Gooi de dobbelstenen".

Interactie:

1. Tik op Gooi: dobbelstenen rollen op het bord 500 ms, dobbelchip verschijnt, scherm 3.
2. Sneltoets R (desktop) doet hetzelfde.

Toegankelijkheid:

- aria-label primair "Gooi de dobbelstenen"; na de worp leest `aria-live` "Je gooide 8".
- reduced motion: dobbelstenen verschijnen zonder rol (fade 120 ms).

Data: `g.phase === "roll"`, `g.currentPlayer.isHuman`.

### 3 Worp en opbrengst

&#91;image: 3 Worp en opbrengst (voorbeelddata)\]

Donker: zie mockup m-p01-dark-2-360.png

Doel: na de worp zie je wat je kreeg en kun je bouwen, ruilen of kopen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Jouw beurt", "Je krijgt" + winstchips (+1 hout, +1 graan), stap 2 | 336 x 52 | `--teal-soft` chip, 22 hoog | Chips niet tikbaar |
| Dobbelchip | 5 + 3 = 8 | 112 x 44 | Outfit 24/700 | Blijft |
| Bord | tegels met jouw opbrengst pulseren | 360 x 591 | ring `--accent` 2px | 600 ms pulse |
| Hand | kaarten die je kreeg tillen 6 px (200 ms) en de teller telt op | 54 x 76 | zie Gedeeld |  |
| Dock | Bouwen en Koop kaart met stip als betaalbaar | 60 x 56 | `--accent` stip |  |
| Primair | "Einde beurt" + volgende speler | 138 x 56 | `--primary` | Zie 4 |

Staten:

- normaal: zoals boven.
- leeg: geen opbrengst: beurtbalk regel "Niemand krijgt kaarten", geen chips.
- uitgeschakeld: tegels 45%.
- fout: geen.
- donker: m-p01-dark-2.
- 412-verschil: alleen breder.
- Een 7: ga naar 15 (afleggen) of 10 (rover).

Teksten: "Jouw beurt", "Je krijgt", "Niemand krijgt kaarten".

Interactie:

1. Worp valt: dobbelstenen 500 ms, opbrengstkaarten vliegen 350 ms van het bord naar de hand.
2. Tik op de dobbelchip: opent het getalblad (30) voor die worp.

Toegankelijkheid:

- `aria-live=polite`: "Je gooide 8. Je krijgt 1 hout en 1 graan."
- reduced motion: geen vlucht, hand telt direct op.

Data: `g.lastRoll`, `g.lastGains[human.id]` (per grondstof), dobbelsymbolen uit sprite `die-1..6`.

### 4 Einde beurt met beschermlaag

&#91;image: 4 Einde beurt met beschermlaag (voorbeelddata)\]

Donker: zie mockup m-p01-dark-3-360.png

Doel: voorkom dat je per ongeluk je beurt beeindigt terwijl je nog iets kunt betalen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Scrim | bord, hand en dock gedimd | 360 x 780 | `--scrim` | Tik sluit de laag |
| Kaart "Je kunt nog bouwen" | titel Outfit 20/650, regel "Weet je zeker dat je klaar bent?" | 336 x ca. 200, radius 22, bij de dock | `--sheet` |  |
| Drie keuzetegels | Weg (sprite `ic-road`, kosten hout baksteen), Dorp (`ic-settlement`, 4 kosten), Kaart (`ic-devcard`, wol graan erts) | 3 x 99 x 96 | `--btn` tegel | Tik opent Bouwtray (5) of koopt de kaart |
| Secundair "Bouwen" | sprite `ic-build` + "Bouwen" | 168 x 52 | `--btn` | Sluit laag, opent 5 |
| Primair "Toch einde beurt" |  | 168 x 52 | `--primary` | Beeindigt de beurt |

Staten:

- normaal: zoals boven; alleen de tegels die je kunt betalen worden getoond (1 tot 3).
- leeg: als je niets kunt betalen verschijnt de laag niet.
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-p01-dark-3.
- 412-verschil: tegels 119 breed.
- variant B (twee lagen, niet gekozen, `m-p01-6-360.png`): hulptegels boven, primair splitst in "Eerst bouwen" en "Toch einde beurt".

Teksten: "Je kunt nog bouwen", "Weet je zeker dat je klaar bent?", "Weg", "Dorp", "Kaart", "Bouwen", "Toch einde beurt", "Eerst bouwen", "Nog bouwen?".

Interactie:

1. Eerste tik op Einde beurt terwijl iets betaalbaar is: laag schuift 220 ms omhoog.
2. Tik op "Toch einde beurt": laag sluit 150 ms, beurt gaat naar de volgende speler.
3. Tik op scrim, Terug of Esc: laag sluit, beurt gaat niet door.
4. Er is geen automatische tweede tik; elke keer dat je in dezelfde beurt weer iets kunt betalen verschijnt de laag opnieuw.

Toegankelijkheid:

- rol `dialog`, label "Je kunt nog bouwen", focus op "Bouwen"; terugkeer naar Einde beurt.
- reduced motion: fade 120 ms.

Data: betaalbaarheid per bouwtype uit `g.canAfford(human, type)` en `g.hasLegalSpot(human, type)`; alleen wat beide haalt telt.

### 5 Bouwtray

&#91;image: 5 Bouwtray (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: kies wat je bouwt en zie waar het mag.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Bouw een weg", "Tik op een omrande plek" | 336 x 52 | `--chip` | Annuleren via X in de tray |
| Bord | legale plekken met `--accent` rand, rest gedimd | 360 x 591 |  | Tik op een plek zet het stuk |
| Hand | blijft zichtbaar | 112 hoog |  |  |
| Tray | vervangt het dock | 360 x 116, padding 10/12 | `--dock` |  |
| Tegel Weg | sprite `ic-road`, "Weg", 2 kostenicoontjes (hout, baksteen) vol, vinkje | ca. 99 x 96 | `--btn`, geselecteerd 2px `--accent` | Tik kiest, bord toont plekken |
| Tegel Dorp | `ic-settlement`, "Dorp", 4 kosten, "geen plek" met slotje | ca. 99 x 96 | 45% dekking op icoon en kosten | Niet tikbaar |
| Tegel Stad | `ic-city`, "Stad", kosten met ontbrekende op 28%, "mist 2 erts" | ca. 99 x 96 | idem | Niet tikbaar |
| Sluitknop | `ic-close` | 44 x 44 | `--btn` | Sluit tray, dock terug |

Staten:

- normaal: Weg gekozen (accent), Dorp "geen plek", Stad "mist 2 erts".
- leeg: alles niet betaalbaar: drie tegels uitgeschakeld, regel "Niets te bouwen".
- uitgeschakeld: huidige app-stijl (45%, saturatie 30%), geen streeprand.
- fout: een tik op een uitgeschakelde tegel toont de reden in de tegel (1 regel), geen toast.
- donker: tokens; bordkunst licht.
- 412-verschil: tegels 124 breed.
- Seafarers: 4 tegels (Weg, Schip, Dorp, Stad), zie 34.

Teksten: "Bouw een weg", "Tik op een omrande plek", "Weg", "Dorp", "Stad", "geen plek", "mist 2 erts", "Niets te bouwen".

Interactie:

1. Tik op Bouwen: dock schuift 200 ms uit, tray schuift in; tegel van het eerste betaalbare type is al gekozen.
2. Tik op een andere tegel: keuze wisselt, bord toont nieuwe plekken (150 ms).
3. Tik op een plek: stuk valt neer (300 ms), tray sluit, hand telt af.
4. Tik op X, Terug of de bord-achtergrond: tray sluit.

Toegankelijkheid:

- tegels `role=radio`, labels "Weg, kost 1 hout en 1 baksteen, beschikbaar", "Dorp, geen plek".
- focus op gekozen tegel; reduced motion: geen schuif, fade.

Data: kosten uit `COSTS`, plekken uit `g.legalSpots(type)`, betaalbaar uit `canAfford`. Kostenicoontjes: vol = je hebt het, 28% = ontbreekt.

### 6 Ruilen: bank en havens

&#91;image: 6 Ruilen: bank en havens (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: ruil kaarten met de bank, met je haven-tarief zichtbaar als kaartaantallen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Bord | gedimd, bovenste 40% zichtbaar |  | `--scrim` |  |
| Sheet | titel "Ruilen", X | 360 x ca. 470 | `--sheet` |  |
| Kop "Jij geeft" | label (11.5/800, hoofdletters) + "tik op een kaart" | 12.5 hoog | `--ink-soft` |  |
| Rij Jij geeft | 5 kaarten 54 x 76 met aantal en ratio-chip eronder (4:1, 4:1, haven 2:1 met anker, 4:1, 4:1) | 5 x 54 | `--chip` | Tik kiest een kaart; gekozen krijgt "-4" |
| Kop "Jij krijgt" | label |  |  |  |
| Rij Jij krijgt | 5 kaarten met banksaldo-chip (sprite `ic-bank` + 15 18 14 11 15) | 5 x 54 |  | Tik kiest, gekozen "+1" |
| Samenvatting | "Bank", 4 hout wordt 1 erts als icoontjes en pijl | 336 x 44 | `--chip` | Alleen info |
| Voet | primair "Ruil met de bank" (sprite `ic-bank`) + secundair "Bied" (spelers) | 1 x 232 + 1 x 96, 52 hoog | `--primary`, `--btn` |  |

Staten:

- normaal: gekozen kaart en 4:1 getoond.
- leeg: geen kaart met genoeg voor het tarief: kaarten 38%, primair uitgeschakeld "Kies een kaart".
- uitgeschakeld: 45%, saturatie 30%.
- fout: bank heeft geen erts: banksaldo-chip "0" en kaart 38%, geen rood.
- donker: tokens.
- 412-verschil: kaarten 62 breed.
- havens: ratio-chip toont het beste tarief (4:1, 3:1 gewone haven, 2:1 haven van die soort, anker-icoon); tik op de chip opent het havenblad (31).

Teksten: "Ruilen", "Jij geeft", "tik op een kaart", "Jij krijgt", "Bank", "Ruil met de bank", "Bied", "4:1", "3:1", "2:1", "Kies een kaart".

Interactie:

1. Tik op Ruilen of een handkaart: sheet schuift 260 ms omhoog.
2. Tik op een kaart bij Jij geeft: -tarief verschijnt op de kaart, bij Jij krijgt springt de eerste mogelijke kaart niet automatisch (jij kiest).
3. Tik op Ruil met de bank: kaarten vliegen 350 ms, sheet sluit, toast "Geruild".
4. Tik op Bied: wisselt naar 7.
5. X, scrim, swipe omlaag of Terug sluit.

Toegankelijkheid:

- aria-labels "Hout, 5, ruil 4 voor 1", "Erts, bank heeft 15"; focus in sheet, terug naar Ruilen-tegel.
- reduced motion: geen vlucht, fade.

Data: tarieven uit `g.bankRatio(human, resource)` (4, 3 of 2), banksaldo `g.bank`; aantallen `human.resources` (voorbeeld).

### 7 Ruilen: spelers bieden

&#91;image: 7 Ruilen: spelers bieden (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: bied een ruil aan bots en zie hun antwoord zonder rood of groen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet kop | "Ruilen", X |  |  |  |
| Jij geeft | 5 kaarten, gekozen "-4" | 5 x 54 |  |  |
| Jij krijgt | 5 kaarten, gekozen "+1" | 5 x 54 |  |  |
| Spelerrij "Bank" | segment | 336 x 44 | `--chip` | Wisselt naar 6 |
| Spelerchips | Blaauw, Geelen, Pimpel: avatar 34, naam, kaarten, antwoord als vorm (vinkje, kruis, puntjes) op een inktschijf | 3 x ca. 104 x 56 | `--chip`, inkt | Tik kiest ontvangers |
| Voet | primair "Ruil met Blaauw" | 336 x 52 | `--primary` | Verstuurt bod |

Staten:

- normaal: ontvanger gekozen (accent rand).
- leeg: niemand gekozen, primair uitgeschakeld "Kies een speler".
- uitgeschakeld: 45%.
- fout: bot weigert: kruis in inkt op de chip, tekst "Blaauw wil niet".
- donker: tokens.
- 412-verschil: chips 124.
- wacht: puntjes in de chip, voet "Wachten op antwoord", 8 s tijdbalk.

Teksten: "Ruil met Blaauw", "Bied", "Kies een speler", "Blaauw wil niet", "Wachten op antwoord".

Interactie:

1. Tik op een spelerchip: kiest hem (150 ms accentrand).
2. Tik op "Ruil met Blaauw": bod gaat weg, chips tonen puntjes tot het antwoord, maximaal 8 s.
3. Antwoord vinkje: kaarten vliegen 350 ms, sheet sluit; kruis: chip toont kruis, sheet blijft.
4. Geen antwoord na 8 s: neutrale toast "Geen antwoord", bod vervalt.

Toegankelijkheid:

- chips `role=checkbox`, label "Blaauw, 5 kaarten, 3 punten, niet gekozen"; antwoord als tekst in `aria-live`: "Blaauw: ja", "Blaauw: nee".
- reduced motion: geen vlucht.

Data: `g.players` voor chips; antwoord van `bot.respondToOffer()`; 8 s uit `TRADE_OFFER_TTL`.

### 8 Inkomend bod van een bot

&#91;image: 8 Inkomend bod van een bot (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: een bot doet jou een bod; je beslist in een tik en ziet hoe lang het nog duurt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Blaauw is aan de beurt", "Ruilvoorstel voor jou" | 336 x 52 | `--chip` |  |
| Bodkaart | vastgemaakt onder de beurtbalk: avatar 34, "Blaauw biedt een ruil", seconden-pil ("4 s") | 336 x 56 | `--chip`, pil `--accent-soft` |  |
| Jij geeft / Jij krijgt | kaartjes met aantallen | 2 x 52 |  |  |
| Knop weigeren | `ic-close` | 52 x 52 | `--btn` | Weigert |
| Knop accepteren | `ic-check` | 52 x 52 | `--primary` | Accepteert |
| Tijdbalk | 3 px onder de kaart, loopt leeg in 8 s | 336 x 3 | `--accent` |  |
| Hand | blijft vrij, niet bedekt | 112 hoog |  |  |
| Dock | Blaauw speelt, "antwoord op het bod" | 360 x 72 | primair uitgeschakeld |  |

Staten:

- normaal: beide knoppen actief.
- leeg: n.v.t.
- uitgeschakeld: accepteren uitgeschakeld (45%) als je het niet kunt betalen, ontbrekend icoon getoond.
- fout: geen.
- donker: tokens.
- 412-verschil: knoppen 52 blijven.
- verlopen: zie 9.

Teksten: "Blaauw biedt een ruil", "Jij geeft", "Jij krijgt", "Weiger het bod", "Accepteer het bod", "antwoord op het bod".

Interactie:

1. Bod verschijnt: kaart schuift 200 ms omlaag uit de beurtbalk, seconden tellen af van 8.
2. Tik op vinkje: kaarten vliegen 350 ms, kaart sluit.
3. Tik op kruis: kaart sluit 150 ms, bot krijgt "nee".
4. "Sla over" beantwoordt een bod nooit.

Toegankelijkheid:

- `role=alertdialog` niet-modaal, `aria-live=assertive` "Blaauw biedt een ruil: je geeft 1 wol, je krijgt 1 hout. 8 seconden."
- focus op accepteren pas na de eerste tik in de kaart; reduced motion: tijdbalk blijft, geen schuif.

Data: `g.pendingOffer` (van, geeft, krijgt, `expiresAt = now + 8000`).

### 9 Bod verlopen na 8 s

&#91;image: 9 Bod verlopen na 8 s (voorbeelddata)\]

Donker: zie mockup m-05-bot-turns-dark-5-360.png

Doel: een onbeantwoord bod verdwijnt zichtbaar en geldt als geweigerd.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip, beurtbalk | Geelen speelt, "bouwen" |  |  |  |
| Bord, hand | zoals 23 |  |  |  |
| Toast | "Bod van Geelen verlopen" + "geweigerd" | 336 x 48, radius 14, boven de hand | #22302F, tekst wit | 3 s, `aria-live=polite` |
| Dock | beurtvolgorde + Sla over | 72 hoog |  |  |

Staten:

- normaal: toast zichtbaar 3 s.
- leeg: n.v.t.
- uitgeschakeld: n.v.t.
- fout: neutrale inkt, nooit rood.
- donker: m-05-bot-turns-dark-5.
- 412-verschil: toast 388 breed.

Teksten: "Bod van Geelen verlopen", "geweigerd".

Interactie:

1. Op 0 s: bodkaart krimpt 150 ms weg, toast schuift 200 ms in.
2. Na 3 s: toast fade 150 ms.

Toegankelijkheid:

- toast `aria-live=polite`; reduced motion: fade.

Data: `pendingOffer.expiresAt`.

### 10 Rover: kies een tegel

&#91;image: 10 Rover: kies een tegel (voorbeelddata)\]

Donker: zie mockup m-02-robber-steal-dark-1-360.png

Doel: na een 7 (of Ridder) kies je de tegel voor de rover.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | als 1 | 56 |  |  |
| Beurtbalk | rover-avatar (sprite `ic-robber`), "Rover!", "Tik op een tegel" | 336 x 52 | `--chip` |  |
| Dobbelchip | 3 + 4 = 7 in `--accent-ink` | 112 x 44 |  |  |
| Bord | toegestane tegels licht, huidige rovertegel en niet-toegestane gedimd | 360 x 591 |  | Tik op tegel |
| Hand | blijft | 112 hoog |  |  |
| Dock | tegels uitgeschakeld, primair "Zet rover" + "kies een tegel" uitgeschakeld | 72 hoog | 45% |  |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: primair 45%.
- fout: tik op niet-toegestane tegel (vriendelijke rover): toast 1 regel met reden, zoals nu in `_robberBlockedReason`.
- donker: m-02-robber-steal-dark-1.
- 412-verschil: alleen breder.
- Ridder voor de worp: dock-primair blijft "Zet rover".

Teksten: "Rover!", "Tik op een tegel", "Zet rover", "kies een tegel".

Interactie:

1. Tik op een tegel: rover-spook op de tegel, getal geblokkeerd (token + icoon), rest gedimd (150 ms); bij slachtoffers volgt 11 of 12, zonder slachtoffers wordt de rover direct gezet.
2. Tik op een andere tegel: spook verplaatst.

Toegankelijkheid:

- bordtegels zijn voor schermlezers bereikbaar via de knoppen in het blad (14); `aria-live` "Rover! Kies een tegel".
- reduced motion: geen spookbeweging, direct.

Data: `g._robberHexAllowed`, `g._robberTileInfo(hexId).victims`.

### 11 Rover: kies een speler (bubbel)

&#91;image: 11 Rover: kies een speler (bubbel) (voorbeelddata)\]

Donker: zie mockup m-02-robber-steal-dark-2-360.png

Doel: twee of meer slachtoffers: kies bij de tegel wie je een kaart afpakt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Pak een kaart", "Tik op een speler" | 336 x 52 |  |  |
| Rovertegel | spook, getal geblokkeerd |  |  |  |
| Bubbel | bij de tegel (0 tot 60 px ervandaan), klapt onder de tegel als die in de bovenste 190 px ligt; 2 knoppen met avatar 34, naam, kaarten (sprite `ic-cards`), punten (sprite `ic-vp`) | knop 140 x 56 | `--chip`, avatar-ring seat | Tik pakt van die speler |
| Hand, dock | zoals 10 |  |  |  |

Staten:

- normaal: 2 of 3 knoppen.
- leeg: een slachtoffer zonder kaarten ontbreekt (alleen spelers met kaarten).
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-02-robber-steal-dark-2.
- 412-verschil: knoppen 160.
- Seafarers: piraat op verre zeetegels gebruikt 14 als vangnet.

Teksten: "Pak van Pimpel", "Pak van Geelen", "Pak een kaart", "Tik op een speler". Aria: "Pak van Geelen, 6 kaarten, 5 punten".

Interactie:

1. Tik op een knop: rover gezet en kaart gepakt in een tik (2 taps totaal), kaart vliegt 350 ms naar de hand (13).
2. Lang drukken op een knop: uitleg "Je pakt 1 willekeurige kaart".
3. Tik naast de bubbel: terug naar 10.

Toegankelijkheid:

- bubbel `role=group` "Kies een speler", knoppen met de aria-labels hierboven; focus op eerste knop.
- reduced motion: geen vlucht.

Data: `victims` uit `_robberTileInfo`, kaartentelling `resources` som, punten `victoryPoints` (voorbeeld 6 kaarten, 5 punten).

### 12 Rover: een slachtoffer

&#91;image: 12 Rover: een slachtoffer (voorbeelddata)\]

Donker: zie mockup m-02-robber-steal-dark-3-360.png

Doel: bij een slachtoffer is er een brede knop in plaats van keuzes.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Rover hier?", "Een tik zet hem neer" | 336 x 52 |  |  |
| Bubbel | een brede knop "Pak van Blaauw" met avatar en pijl, X ernaast | 270 x 56 + 44 | `--primary` knop | Tik zet rover en pakt |
| Overig | als 11 |  |  |  |

Staten:

- normaal: zoals boven.
- leeg: geen slachtoffer: geen bubbel, rover direct gezet, toast "Niemand om van te pakken".
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-02-robber-steal-dark-3.
- 412-verschil: knop 320.

Teksten: "Rover hier?", "Een tik zet hem neer", "Pak van Blaauw", "Niemand om van te pakken".

Interactie:

1. Tik op de knop: rover valt 300 ms, kaart vliegt 350 ms (13).
2. Tik op X: terug naar 10.

Toegankelijkheid:

- aria "Pak van Blaauw, 5 kaarten, 3 punten"; focus op de knop.
- reduced motion: geen val.

Data: zoals 11.

### 13 Rover: uitkomst

&#91;image: 13 Rover: uitkomst (voorbeelddata)\]

Donker: zie mockup m-02-robber-steal-dark-4-360.png

Doel: je ziet wat je pakte en gaat verder met je beurt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Pakte van Blaauw" + winstchip (+1 graan) in `--teal-soft` | 336 x 52 | Jij-winst mag teal |  |
| Hand | gepakte kaart tilt 6 px, teller 9 naar 10 |  |  |  |
| Dock | Bouwen, Koop kaart, Ruilen actief; primair "Einde beurt" + "Blaauw is hierna" | 72 hoog | `--primary` |  |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: tegels 45% als niets betaalbaar.
- fout: geen.
- donker: m-02-robber-steal-dark-4.
- 412-verschil: alleen breder.

Teksten: "Pakte van Blaauw".

Interactie:

1. Kaart vliegt 350 ms van de bubbel naar de hand; balk wisselt (150 ms).
2. Na 3 s of eerste tik wordt de regel "Bouw of ruil".

Toegankelijkheid:

- `aria-live` "Je pakte 1 graan van Blaauw"; reduced motion: geen vlucht.

Data: `g.lastSteal` (van, grondstof alleen voor Jij zichtbaar).

### 14 Rover: vangnetblad

&#91;image: 14 Rover: vangnetblad (voorbeelddata)\]

Donker: zie mockup m-02-robber-steal-dark-5-360.png

Doel: bij een ingezoomd bord (tegel buiten beeld) of de piraat kies je in een blad onderin.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Pak een kaart", "Kies in het blad onderaan" | 336 x 52 |  |  |
| Bord | schuift zodat de tegel boven het blad staat, stippellijn naar het blad |  |  |  |
| Blad | titel "Pak een kaart van", 2 knoppen (avatar 34, naam, kaarten, punten), onderregel "Je pakt 1 willekeurige kaart" | 360 x ca. 178 | `--sheet` |  |

Staten:

- normaal: 1 of 2 slachtoffers.
- leeg, uitgeschakeld, fout: n.v.t.
- donker: m-02-robber-steal-dark-5.
- 412-verschil: knoppen breder.

Teksten: "Pak een kaart van", "Je pakt 1 willekeurige kaart", "Kies in het blad onderaan".

Interactie:

1. Tik op tegel buiten beeld (of piraat): bord schuift 300 ms, blad schuift 260 ms omhoog.
2. Tik op een knop: pakt, blad sluit.

Toegankelijkheid:

- zelfde aria-labels als 11; reduced motion: geen schuif, fade.

Data: zoals 11.

### 15 Afleggen bij een 7

&#91;image: 15 Afleggen bij een 7 (voorbeelddata)\]

Donker: zie mockup m-03-discard-dark-1-360.png

Doel: bij meer dan 7 kaarten leg je de helft af met vier vakjes en de kaarten in een waaier.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | rover-avatar, "Rover! Leg 4 kaarten af", "Tik op de kaarten die je weggeeft" | 336 x 52 | `--chip` |  |
| Bord | gedimd |  | rgba(20,40,42,.18) |  |
| Sheet kop | "Leg 4 kaarten af", "Je hebt 9 kaarten. Je houdt er 5.", teller "0/4" | 360 x 56 | Outfit 20/650 |  |
| Vakjes | 4 stippelvakken (alleen plaatsvervangers, geen knoppen) | 4 x 56 x 56 | stippelrand #CFC6B0, radius 14 | Leeg |
| Kaartenwaaier | 5 kaarten 54 x 76 in dezelfde waaier als de hand (+-5.2 graden, 12 px marge), aantal in het lint, eronder "houd 3" (12/700) | 5 x 54 |  | Tik legt een kaart af |
| Voet | "Suggestie" (sprite `ic-hint`, 112 x 52), undo (`ic-undo`, 52 x 52), primair "Kies nog 4" (uitgeschakeld) | 52 hoog | `--btn`, `--primary` 45% |  |

Staten:

- normaal: 0 van 4 gekozen.
- leeg: bij precies 8 kaarten (4 af) idem; minder dan 8: scherm verschijnt niet.
- uitgeschakeld: primair 45% tot 4 gekozen.
- fout: meer dan nodig: tik op een kaart zonder vrij vakje doet niets en toont een beweging van 100 ms.
- donker: m-03-discard-dark-1.
- 412-verschil: kaarten 62.

Teksten: "Leg 4 kaarten af", "Je hebt 9 kaarten. Je houdt er 5.", "Tik op de kaarten die je weggeeft", "houd 3", "Suggestie", "Kies nog 4".

Interactie:

1. Tik op een kaart: kaart rechtzet en tilt 12 px, een vakje vult met het grondstof-icoon (200 ms), label "-1" op de kaart, "houd n" telt af.
2. Tik op een gevuld vakje (X): kaart terug (200 ms).
3. Suggestie vult de beste keuze in; undo zet alles terug; auto-invullen gebeurt nooit stil.
4. Rush: dezelfde sheet met een ring van 20 s op de beurtbalk.

Toegankelijkheid:

- kaarten `button` "Hout: 3, tik om 1 af te leggen"; vakjes "Vakje 1 van 4, leeg".
- focusvolgorde: kaarten links naar rechts, Suggestie, undo, primair; teller `aria-live`: "2 van 4".
- reduced motion: geen vlucht, direct vullen.

Data: `pd` (pending discard) met `pd.selected[resource]`, limiet `Math.floor(total/2)`, `human.resources` (voorbeeld 3, 2, 2, 1, 1).

### 16 Afleggen: vol

&#91;image: 16 Afleggen: vol (voorbeelddata)\]

Donker: zie mockup m-03-discard-dark-2-360.png

Doel: vier kaarten gekozen, je bevestigt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Rover! Leg 4 kaarten af", "Klaar? Tik op Leg af" | 336 x 52 |  |  |
| Kop | teller "4/4" |  |  |  |
| Vakjes | 4 gevuld: 2 hout, 2 baksteen (resource-icoon 30, `--accent-soft`, 2px `--accent`, X-badge 20) | 4 x 56 |  | Tik op X: terug |
| Waaier | hout en baksteen gemarkeerd: rechtgezet, 12 px omhoog, ring `--accent`, label "-2" (rond, `--accent`), "houd 1", "houd 0" | 54 x 76 |  |  |
| Voet | primair "Leg 4 kaarten af" actief | 52 hoog | `--primary` | Bevestigt |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-03-discard-dark-2.
- 412-verschil: alleen breder.

Teksten: "Klaar? Tik op Leg af", "Leg 4 kaarten af", "houd 0".

Interactie:

1. Tik op primair: gemarkeerde kaarten vliegen 350 ms naar de bank, sheet sluit 220 ms, beurtbalk wisselt naar rover (10) of wachten (17).
2. Tik op een gemarkeerde kaart haalt er een terug.

Toegankelijkheid:

- primair aria "Leg 4 kaarten af: 2 hout en 2 baksteen"; reduced motion: geen vlucht.

Data: `pd.selected` (voorbeeld hout 2, baksteen 2).

### 17 Anderen leggen af

&#91;image: 17 Anderen leggen af (voorbeelddata)\]

Donker: zie mockup m-03-discard-dark-3-360.png

Doel: jij hoeft niet, anderen wel, je wacht zonder verwarring.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | zandloper (sprite `ic-end`, 16) op de chips van Blaauw en Pimpel | 79 x 48 | inkt |  |
| Beurtbalk | rover-avatar, "Rover! Anderen leggen af", regel met 2 avatars 18 "Blaauw en Pimpel (elk 4)" | 336 x 52 |  |  |
| Hand | 6 kaarten (voorbeeld) |  |  |  |
| Dock | tegels uitgeschakeld, primair "Even wachten" + "tot ze klaar zijn" | 72 hoog | 45% |  |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: dock 45%.
- fout: geen.
- donker: m-03-discard-dark-3.
- 412-verschil: alleen breder.

Teksten: "Rover! Anderen leggen af", "Blaauw en Pimpel (elk 4)", "Even wachten", "tot ze klaar zijn".

Interactie:

1. Chip verliest zandloper zodra de bot klaar is (150 ms); als iedereen klaar is gaat het naar 10.

Toegankelijkheid:

- `aria-live` "Blaauw heeft afgelegd"; reduced motion: geen animatie.

Data: `g.discardPending` (spelers en aantallen).

### 18 Ontwikkelingskaarten-blad

&#91;image: 18 Ontwikkelingskaarten-blad (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: bekijk en speel je ontwikkelingskaarten in een blad in plaats van een afkappende rij.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Jouw kaarten", "Kies een kaart" | 336 x 52 |  |  |
| Bord | gedimd, bovenste 45% |  | `--scrim` |  |
| Sheet kop | "Ontwikkelingskaarten", regel "1 kaart per beurt, niet op de dag dat je hem koopt", X | 360 x 64 |  |  |
| Kaarttegels | tot 4 soorten: Ridder, Wegenbouw, Monopolie, Punt; kaartkunst, aantal-badge, staat (speelbaar, "morgen" met zandloper, "geheim" met slotje) | 4 x 80 x 128 | `--chip`, gekozen 2px `--accent` | Tik kiest |
| Effectregel | icoon + titel "Ridder" + "Verplaats de rover en pak 1 kaart" | 336 x 56 | `--chip` |  |
| Voet | primair "Speel Ridder" | 336 x 52 | `--primary` |  |

Staten:

- normaal: Ridder gekozen, speelbaar.
- leeg: geen kaarten: kaartenknop 0, blad toont "Nog geen kaarten" en "Koop kaart".
- uitgeschakeld: nieuw gekochte kaart (zandloper, "morgen") en Punt: primair 45% "Speel hem volgende beurt".
- fout: tweede kaart in dezelfde beurt: primair uitgeschakeld "1 kaart per beurt".
- donker: tokens.
- 412-verschil: tegels 94 breed.

Teksten: "Ontwikkelingskaarten", "Kies een kaart", "Ridder", "Wegenbouw", "Uitvinding", "Monopolie", "Punt", "geheim", "morgen", "Speel Ridder", "Nog geen kaarten".

Interactie:

1. Tik op kaartenknop: blad schuift 260 ms.
2. Tik op een kaarttegel: kiest, effectregel wisselt (150 ms).
3. Speel Ridder: blad sluit, rover-flow (10); Wegenbouw: twee gratis wegen met Bouwtray-gedrag; Uitvinding en Monopolie: zie 20.
4. In Rush speelbaar na de worp ("na worp" in plaats van "morgen").

Toegankelijkheid:

- tegels `role=radio` "Ridder, 1, speelbaar", "Monopolie, nieuw, speelbaar morgen".
- reduced motion: fade.

Data: `devCounts`, `human.newDevCards`, `devState(type)` (speelbaar, next, secret); `DEV_CARD_TYPES`.

### 19 Kaart kopen: onthulling

&#91;image: 19 Kaart kopen: onthulling (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: je ziet de gekochte kaart en weet wanneer je hem kunt spelen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Scrim |  | 360 x 780 | `--scrim` | Tik sluit |
| Kaart | gekochte kaart (Ridder), 128 breed, 3 graden gedraaid, lint "Nieuw" (`--accent`) | 128 x 180 | schaduw 0 12 24 |  |
| Titel | "Je kocht een Ridder" | pil #22302F, Outfit 22/700 wit |  |  |
| Regel | "Speel hem volgende beurt" + kostenchips (wol, graan, erts) + "nog 19 in de stapel" | pil #22302F, 14/600 |  |  |
| Hand | kaartenknop toont nieuw aantal |  |  |  |

Staten:

- normaal: zoals boven.
- leeg: stapel leeg: tegel Koop kaart uitgeschakeld.
- uitgeschakeld: n.v.t.
- fout: Puntenkaart: lint "Geheim", regel "Telt mee voor je punten".
- donker: tokens.
- 412-verschil: kaart 150 breed.

Teksten: "Je kocht een Ridder", "Speel hem volgende beurt", "Nieuw", "Geheim".

Interactie:

1. Tik op Koop kaart: kaart draait om (350 ms), blijft 1.5 s of tot tik, vliegt naar de kaartenknop (350 ms).

Toegankelijkheid:

- `aria-live` "Je kocht een Ridder. Speel hem volgende beurt."; reduced motion: fade.

Data: `g.lastBought`, stapel `g.devDeck.length` (voorbeeld 19).

### 20 Monopolie en Uitvinding kiezen

&#91;image: 20 Monopolie en Uitvinding kiezen (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: kies de grondstof met dezelfde kaarten als in je hand.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Monopolie", "Kies een grondstof" | 336 x 52 |  |  |
| Sheet kop | "Monopolie", regel "Alle spelers geven je hun kaarten van 1 soort", X |  |  |  |
| Kaartenrij | 5 grondstofkaarten 54 x 76 (Hout, Baksteen, Wol, Graan, Erts), gekozen: 3px `--accent` |  |  | Tik kiest |
| Voet | primair "Neem alle erts" | 336 x 52 | `--primary` |  |

Staten:

- normaal: erts gekozen.
- leeg: nog niets gekozen: primair 45% "Kies een grondstof".
- uitgeschakeld: zie leeg.
- fout: geen.
- donker: tokens.
- 412-verschil: kaarten 62.
- Uitvinding: zelfde blad, titel "Uitvinding", 2 kaarten kiezen uit de bank (teller "0/2"), primair "Neem 2 kaarten".

Teksten: "Monopolie", "Kies een grondstof", "Alle spelers geven je hun kaarten van 1 soort", "Neem alle erts", "Uitvinding", "Neem 2 kaarten".

Interactie:

1. Tik op een kaart: kaart tilt 12 px, primair wisselt label (150 ms).
2. Tik op primair: kaarten vliegen 350 ms naar je hand, toast "Je kreeg 3 erts".

Toegankelijkheid:

- kaarten `role=radio` "Erts"; reduced motion: geen vlucht.

Data: grondstoftellingen van de andere spelers (alleen de uitkomst wordt getoond).

### 21 Winkans in de spelerchips

&#91;image: 21 Winkans in de spelerchips (voorbeelddata)\]

Donker: zie mockup m-04-win-bar-dark-1-360.png

Doel: een rustige schatting wie er wint, in de chips zelf.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | 4 chips met extra rij: balk 5 hoog in seat-kleur + percentage (11.5/700); kroon op de leider (Geelen 41%) | 360 x 70 | `--chip`, seat | Tik opent 22 |
| Overig | zoals 1 |  |  |  |

Staten:

- normaal: Jij 21%, Blaauw 17%, Geelen 41%, Pimpel 21% (voorbeeld).
- leeg: eerste beurt zonder schatting: balk 0 en "rekenen" als zachte puls, geen cijfers.
- uitgeschakeld: schatting uit (Instellingen): strip 56 hoog zonder rij.
- fout: geen.
- donker: m-04-win-bar-dark-1.
- 412-verschil: balken breder.
- 6 spelers: balk 5 hoog + 11.5-getal past in chips van 52.

Teksten: "Winkans" (aria), percentages.

Interactie:

1. Cijfers veranderen alleen bij beurtwissel of bij een verschil van 3 punten of meer, afgerond; "rekenen" is een puls op de balk, geen springende cijfers.
2. Tik op een chip of percentage: blad (22).

Toegankelijkheid:

- chip aria "Geelen, 5 punten, 41 procent winkans"; trendpijl voor Jij in inkt, nooit groen of rood.
- reduced motion: geen puls.

Data: winkans uit de Monte-Carlo-schatting (400 toekomsten), voorbeeldwaarden.

### 22 Winkans-blad

&#91;image: 22 Winkans-blad (voorbeelddata)\]

Donker: zie mockup m-04-win-bar-dark-3-360.png

Doel: namen, grote balken en het verloop per beurt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip, beurtbalk | gedimd |  | `--scrim` |  |
| Sheet kop | "Winkans", regel "Wie wint er het vaakst als de bots zo doorspelen", X | 360 x 64 |  |  |
| Rijen | avatar 44, naam, balk (12 hoog, seat-kleur), percentage Outfit 22/700 | 4 x 56 | `--chip` | Alleen info |
| Verloopgrafiek | "Verloop per beurt", 4 lijnen in seat-kleur, eindpunt met avatar | 336 x 150 | `--chip` |  |
| Kleine letters | "Schatting uit 400 gespeelde toekomsten. Geen belofte." | 12.5/600 | `--ink-soft` |  |

Staten:

- normaal: zoals boven.
- leeg: voor beurt 2 geen grafiek, regel "Nog te weinig beurten".
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-04-win-bar-dark-3.
- 412-verschil: grafiek 388 breed.
- variant B (balk met gezichten, niet gekozen): `m-04-win-bar-2-360.png`.

Teksten: "Winkans", "Wie wint er het vaakst als de bots zo doorspelen", "Verloop per beurt", "Schatting uit 400 gespeelde toekomsten. Geen belofte.", "Nog te weinig beurten".

Interactie:

1. Chip of % tik: blad schuift 260 ms omhoog.
2. X, scrim, swipe omlaag, Terug sluit.

Toegankelijkheid:

- grafiek heeft tekstalternatief "Jij 21 procent, Blaauw 17 procent, Geelen 41 procent, Pimpel 21 procent, stijgend voor Geelen".
- reduced motion: fade.

Data: `g.winProb.history[turn][seat]` (voorbeeld).

### 23 Bot aan de beurt

&#91;image: 23 Bot aan de beurt (voorbeelddata)\]

Donker: zie mockup m-05-bot-turns-dark-1-360.png

Doel: je ziet wat de bot doet, in volgorde, zonder te lezen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | Blaauw actief | 56 |  |  |
| Beurtbalk | avatar Blaauw, "Blaauw speelt", acties als icoon-chips (dobbel 6+2, "8", hamer + weg) die verschijnen terwijl ze gebeuren | 336 x 52 | `--chip` | Tik opent log |
| Dobbelchip | 6 + 2 = 8 |  |  |  |
| Bord | nieuw stuk met ring (`--accent`, 2 s) |  |  |  |
| Hand | blijft zichtbaar en leeg-van-actie (gedimd 90%) |  |  |  |
| Dock | beurtvolgorde: 4 avatars (huidige groter met ring, klaar met inkt-vinkje) + Sla over (68 x 56, sprite `ic-end`) | 72 hoog | `--btn` |  |

Staten:

- normaal: zoals boven.
- leeg: bot passeert: balk "Blaauw speelt", "geen zet".
- uitgeschakeld: hand en tegels niet tikbaar, tegels in het dock zijn vervangen door de beurtvolgorde.
- fout: geen.
- donker: m-05-bot-turns-dark-1.
- 412-verschil: avatars 48.

Teksten: "Blaauw speelt", "Sla over".

Interactie:

1. Elke actie 300 ms, kaartvlucht 350 ms, dobbelstenen 500 ms (Snel); Normaal 1.5x.
2. Sla over springt de lopende animatie naar het eindbeeld, nooit informatie; beantwoordt nooit een bod.
3. Als een bot jou een bod doet: zie 8.

Toegankelijkheid:

- beurtbalk `aria-live=polite` "Blaauw gooit 8. Blaauw bouwt een weg."
- Sla over aria "Sla animaties van deze beurt over"; reduced motion: acties verschijnen zonder beweging.

Data: `g.botTurn.events` (dobbel, bouw, ruil, koop), beurtvolgorde uit `g.turnOrder`.

### 24 Beurtkaartje: bot is klaar

&#91;image: 24 Beurtkaartje: bot is klaar (voorbeelddata)\]

Donker: zie mockup m-05-bot-turns-dark-2-360.png

Doel: kort overzicht van wat de bot deed, verdwijnt vanzelf.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kaartje | boven de hand (bottom 194): avatar 34, "Blaauw is klaar", dobbelpil 6 + 2 = 8, regel icoonchips (hamer + weg, 2 hout wordt 1 erts, kaart) | 336 x ca. 100 | `--chip` | Tik sluit |
| Voortgangsbalk | 3 px onderaan, loopt in 1.5 s leeg | 336 x 3 | `--accent` |  |

Staten:

- normaal: zoals boven.
- leeg: bot deed niets: "Blaauw is klaar" met "geen zet".
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-05-bot-turns-dark-2.
- 412-verschil: alleen breder.

Teksten: "Blaauw is klaar", "geen zet".

Interactie:

1. Verschijnt 200 ms schuiven, 1.5 s zichtbaar, de volgende bot begint meteen.

Toegankelijkheid:

- `aria-live=polite`; reduced motion: fade.

Data: samenvatting van `botTurn.events`.

### 25 Dit gebeurde (ronde-samenvatting)

&#91;image: 25 Dit gebeurde (ronde-samenvatting) (voorbeelddata)\]

Donker: zie mockup m-05-bot-turns-dark-3-360.png

Doel: na alle bots in Snel-modus een kaart met 3 rijen, daarna jouw beurt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Jouw beurt", "Gooi de dobbelstenen" | 336 x 52 |  |  |
| Kaart | "Dit gebeurde" + pil "3 beurten", 3 rijen (avatar, dobbel, icoonchips), "geen zet" waar nodig | 336 x ca. 150 | `--chip` | Eerste tik sluit |
| Dock | Bouwen, Koop kaart, Ruilen uitgeschakeld, primair "Gooi" | 72 hoog |  |  |

Staten:

- normaal: zoals boven.
- leeg: alle bots passen: kaart verschijnt niet.
- uitgeschakeld: dock zoals 2.
- fout: geen.
- donker: m-05-bot-turns-dark-3.
- 412-verschil: alleen breder.

Teksten: "Dit gebeurde", "3 beurten", "geen zet".

Interactie:

1. Verschijnt na de laatste bot; eerste tik of Gooi sluit (150 ms).

Toegankelijkheid:

- focus op de kaart, sluiten met Esc; `aria-live` leest de 3 rijen voor.
- reduced motion: fade.

Data: `g.roundSummary` (per bot: dobbel, acties).

### 26 Logboek

&#91;image: 26 Logboek (voorbeelddata)\]

Donker: zie mockup m-05-bot-turns-dark-6-360.png

Doel: terugkijken per beurt, met filters.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet kop | "Logboek", X | 360 x 56 |  |  |
| Filters | Alles, Jij, Bouwen, Ruilen (segmenten, max 3 plus Jij) | 4 x 44 hoog | `--chip`, gekozen 2px `--accent` | Filtert |
| Groepen | per beurt: "Beurt 8 · Geelen" + dobbel, rijen met icoon + 1 regel ("Pimpel +1", "Geelen bouwde een dorp"); botwinsten samengevouwen; Jij-regels in `--p0-text` met avatar | rij 44 | `--ink` | Alleen info |

Staten:

- normaal: Alles.
- leeg: "Nog niets gebeurd".
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-05-bot-turns-dark-6; seat-tekstkleuren uit DS (`--pN-text`).
- 412-verschil: alleen breder.

Teksten: "Logboek", "Alles", "Jij", "Bouwen", "Ruilen", "Beurt 8 · Geelen", "Geelen bouwde een dorp", "Nog niets gebeurd".

Interactie:

1. Tik op de beurtbalk: blad schuift 260 ms omhoog, laatste beurt bovenaan in beeld.
2. Tik op een filter: lijst wisselt (150 ms).

Toegankelijkheid:

- lijst `role=log`, rijen volledige zinnen; X, Terug sluit; reduced motion: fade.

Data: `g.log` gegroepeerd per `turn`.

### 27 Opstelling: eerste dorp

&#91;image: 27 Opstelling: eerste dorp (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: kies je eerste dorpsplek; de goede plekken springen eruit.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | 0 punten, geen kaarten, geen winkans | 56 |  |  |
| Beurtbalk | "Eerste dorp", "Kies een plek", stappenspoor dorp, weg, dorp, weg | 336 x 52 |  |  |
| Bord | plekken als stippen; sterke plekken (veel stippen) ring en ster (beginners, standaard aan in het eerste spel) |  | `--accent` ring | Tik kiest plek |
| Handpil | "Jouw kaarten" | 24 |  |  |
| Hand | 5 lege sloten (38%) |  |  |  |
| Dock | tegels uitgeschakeld, primair "Kies een plek" + "Opstelling 1/2" uitgeschakeld | 72 hoog | 45% |  |

Staten:

- normaal: zoals boven.
- leeg: geen plek gekozen (dit scherm).
- uitgeschakeld: dock 45%.
- fout: tik op een niet toegestane plek (te dicht bij een dorp): toast 1 regel "Te dicht bij een ander dorp".
- donker: tokens.
- 412-verschil: alleen breder.
- kwaliteitsringen: setting Instellingen > Hulp, standaard aan in het eerste spel, uit voor ervaren spelers.

Teksten: "Eerste dorp", "Kies een plek", "Opstelling 1/2", "Te dicht bij een ander dorp".

Interactie:

1. Tik op een plek: gaat naar 28.
2. Bots plaatsen na jou en nemen de beurt over (balk "\[naam\] speelt").

Toegankelijkheid:

- plekken zijn bereikbaar via "Volgende plek" toets (pijl links rechts), `aria-live` "Plek met 13 stippen".
- reduced motion: geen puls op ringen.

Data: `g.getInitialSettlementNodes()`, plekwaarde = som van stippen; ringen uit `settlementQuality(node)`.

### 28 Opstelling: plek gekozen

&#91;image: 28 Opstelling: plek gekozen (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: zie wat een plek oplevert voordat je bevestigt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Dorp hier?", "13 stippen" | 336 x 52 |  |  |
| Bord | gekozen plek met ring |  |  |  |
| Tray | 3 tegels met token + stippen (bijv. 9, 5, 8) in 40 px getalschijven; balk "Stippen" tot max 13; primair "Zet dorp" | 360 x 116 | `--chip`, `--primary` |  |

Staten:

- normaal: zoals boven.
- leeg: n.v.t.
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: tokens.
- 412-verschil: alleen breder.

Teksten: "Dorp hier?", "13 stippen", "Stippen", "Zet dorp".

Interactie:

1. Tik op Zet dorp: dorp valt 300 ms, weg-keuze volgt.
2. Tik op een getal in de tray: stippen-blad (30).
3. Tik op een andere plek: tray wisselt.

Toegankelijkheid:

- tegels aria "Hout, getal 9, 4 stippen"; focus op Zet dorp.
- reduced motion: geen val.

Data: `hex.number`, stippen uit `PIPS[number]`.

### 29 Opstelling: tweede dorp

&#91;image: 29 Opstelling: tweede dorp (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: bij het tweede dorp zie je de kaarten die je nu krijgt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | Jij 1 punt, Blaauw 2 |  |  |  |
| Beurtbalk | "Tweede dorp", "Kaarten erbij" | 336 x 52 |  |  |
| Tray | label "Je krijgt direct", 3 getalschijven, 3 minikaartjes (hout, graan, wol), primair "Zet dorp" | 360 x 116 |  |  |

Staten:

- normaal: zoals boven.
- leeg: plek zonder opbrengst (water): "Je krijgt niets" in de tray.
- uitgeschakeld, fout: n.v.t.
- donker: tokens.
- 412-verschil: alleen breder.

Teksten: "Tweede dorp", "Kaarten erbij", "Je krijgt direct", "Zet dorp".

Interactie:

1. Tik op Zet dorp: kaarten vliegen 350 ms van de tegels naar je hand; daarna je weg.

Toegankelijkheid:

- `aria-live` "Je krijgt direct 1 hout, 1 graan, 1 wol"; reduced motion: geen vlucht.

Data: tegels naast `lastSetupNodeId`.

### 30 Stippen-blad

&#91;image: 30 Stippen-blad (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: leg uit wat de stippen betekenen, bij elk getal dat je aantikt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Wat betekenen de stippen?", "Tik op een getal op het bord" | 336 x 52 |  |  |
| Sheet kop | getalschijf 44 met stippen, "5 van 36 worpen", "Meer stippen is vaker aan de beurt" |  |  |  |
| Paren | "Zo gooi je een 8": 5 dobbelparen (2+6, 3+5, 4+4, 5+3, 6+2) | 5 x 56 | `--chip` |  |
| Verdeling | "Kans per getal": staafjes 2 tot 12, dit getal gemarkeerd (6 en 8 in `--accent-ink`) | 336 x 80 |  |  |
| Wie krijgt kaarten | "Wie krijgt kaarten bij een 8": avatar + dorp/stad-icoon + resource-icoon | rij 44 |  |  |

Staten:

- normaal: een 8.
- leeg: getal zonder bouwers: "Niemand krijgt kaarten".
- uitgeschakeld, fout: n.v.t.
- donker: tokens.
- 412-verschil: alleen breder.
- eerste spel: verschijnt eenmalig als coach-card (niet-modaal, bord blijft tikbaar); Instellingen > Hulp.

Teksten: "Wat betekenen de stippen?", "Tik op een getal op het bord", "5 van 36 worpen", "Meer stippen is vaker aan de beurt", "Zo gooi je een 8", "Kans per getal", "Wie krijgt kaarten bij een 8", "Niemand krijgt kaarten".

Interactie:

1. Tik op een getalschijf op het bord: blad schuift 260 ms omhoog (vervangt de oude toast).
2. Tik op een ander getal terwijl het blad open is: inhoud wisselt (150 ms).

Toegankelijkheid:

- blad aria "Getal 8, 5 van 36 worpen"; dobbelparen als tekst; reduced motion: fade.

Data: `PIPS`, verdeling `36` uit twee dobbelstenen, bouwers uit `g.holdersOf(number)` (voorbeeld).

### 31 Haven-blad

&#91;image: 31 Haven-blad (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: leg een haven uit en vergelijk het tarief.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Wat doet een haven?", "Tik op een haven op het bord" | 336 x 52 |  |  |
| Sheet kop | havenicoon "2:1", "Ruil 2 wol voor 1 kaart naar keuze" |  |  |  |
| Vergelijking | 3 rijen: "Zonder haven" 4 gelijke kaarten, "Gewone haven" 3, "Deze haven" 2 wol, elk met kaartjes naar 1 kaart | 3 x 56 | `--chip`, deze rij `--teal-soft` |  |
| Status | "Jij hebt deze haven nog niet." of "Je hebt deze haven." | 14/600 |  |  |

Staten:

- normaal: wolhaven, niet bezeten.
- leeg: n.v.t.
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: tokens.
- 412-verschil: alleen breder.
- gewone haven: rij "Deze haven" 3 kaarten, titel "Ruil 3 gelijke kaarten voor 1".

Teksten: "Wat doet een haven?", "Tik op een haven op het bord", "Ruil 2 wol voor 1 kaart naar keuze", "Zo ruil je met de bank", "Zonder haven", "Gewone haven", "Deze haven", "Jij hebt deze haven nog niet.", "Je hebt deze haven."

Interactie:

1. Tik op een haven op het bord of op een ratio-chip in Ruilen: blad schuift 260 ms omhoog.

Toegankelijkheid:

- aria "Wolhaven, 2 voor 1"; reduced motion: fade.

Data: haventype uit `g.geometry.ports`, bezit uit `human.ports`.

### 32 Pauze-blad

&#91;image: 32 Pauze-blad (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-2-360.png

Doel: de ene startplek voor Uitleg, Stand, Instellingen, Nieuw spel en Naar start. (Het normale spel heeft geen eigen mockup; de Dagpuzzel-versie in de afbeelding toont het blad met de dagregels erbij. Zie gaten.)

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet kop | "Pauze", X | 360 x 56 |  |  |
| Rijen | Uitleg, Stand, Instellingen, Nieuw spel, Naar start (icoon 36 in teal vierkant, titel 16/700, chevron), hoogte 56 | 5 x 56 | `--chip` | Elke rij opent haar blad |
| Voet | primair "Verder spelen" | 336 x 52 | `--primary` | Sluit |

Staten:

- normaal: bovenstaande rijen.
- leeg, uitgeschakeld: n.v.t.
- fout: Nieuw spel en Naar start vragen eerst bevestiging in een sheet (destructief is secundair).
- donker: tokens.
- 412-verschil: alleen breder.
- Dagpuzzel: zie 39.
- hot-seat: extra rij "Wissel speler".

Teksten: "Pauze", "Uitleg", "Stand", "Instellingen", "Nieuw spel", "Naar start", "Verder spelen".

Interactie:

1. Tik op Pauze (links boven het bord, vervangt Menu in het dock): sheet schuift 260 ms omhoog; Terug sluit.
2. Het spel loopt niet door in Rush: de timer pauzeert.

Toegankelijkheid:

- focus op "Verder spelen"; aria Pauze-knop "Pauze, menu"; reduced motion: fade.

Data: geen spelgegevens; Stand uit `g.players`.

### 33 Rush

&#91;image: 33 Rush (voorbeelddata)\]

Donker: zie mockup m-09-variants-dark-1-360.png

Doel: realtime variant waarin iedereen tegelijk speelt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | 4 chips, geen actieve | 56 |  |  |
| Beurtbalk | titel "Worp 12", regel "Klaar:" + 4 avatars 24 (klaar = inkt-vinkje), ring met seconden rechts (6) | 336 x 52 | ring `--accent` |  |
| Bod | "Geelen biedt" vastgezet met eigen seconden, tijdbalk, X en vinkje | 336 x 56 |  | Zie 8 |
| Hand, dock | zoals 1 |  |  |  |
| Primair | "Gooi nu" + "3 van 4 klaar" + sprite `ic-dice` | 138 x 56 | `--primary` | Tik: jij bent klaar |

Staten:

- normaal: 3 van 4 klaar.
- leeg: n.v.t.
- uitgeschakeld: na jouw tik primair 45% "Wachten".
- fout: geen.
- donker: m-09-variants-dark-1.
- 412-verschil: alleen breder.
- Rush heeft geen Einde beurt.

Teksten: "Worp 12", "Klaar:", "Gooi nu", "3 van 4 klaar", "Geelen biedt".

Interactie:

1. Ring telt af (20 s afleggen, 10 s bouw); bij 0 gaat de worp door.
2. Tik op Gooi nu: jij bent klaar (vinkje in inkt), anderen niet.

Toegankelijkheid:

- ring aria "Nog 6 seconden"; klaar-lijst als tekst; reduced motion: ring zonder animatie, wel getal.

Data: `g.isRush()`, `g.rush.ready[seat]`, `g.rush.deadline`.

### 34 Seafarers

&#91;image: 34 Seafarers (voorbeelddata)\]

Donker: geen mock, tokens uit DS 2

Doel: zeekaart met schepen en een doel van 14 punten.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | Jij 5 punten | 56 |  |  |
| Beurtbalk | "Bouw een schip", regel "Doel: 14 punten" | 336 x 52 |  |  |
| Bord | zeekaart, start gepast op jouw land; zoom blijft | 360 x 591 |  |  |
| Tray | 4 tegels: Weg, Schip, Dorp, Stad (sprite `ic-road`, `ic-ship`, `ic-settlement`, `ic-city`) | 360 x 116, tegels 78 breed | `--btn` | Schip verplaatsen: "Verplaats schip" |

Staten:

- normaal: Schip gekozen.
- leeg, uitgeschakeld, fout: als 5.
- donker: tokens.
- 412-verschil: tegels 94.
- piraat: rover-flow gebruikt 14 voor verre zeetegels.

Teksten: "Bouw een schip", "Doel: 14 punten", "Weg", "Schip", "Dorp", "Stad", "Verplaats schip".

Interactie:

1. Zoals 5; schip verplaatsen markeert de verplaatsbare schepen.

Toegankelijkheid:

- zoals 5.

Data: `g.mode === "seafarers"`, doel `g.targetPoints` (14, voorbeeld).

### 35 5-6 spelers en bouwvenster

&#91;image: 35 5-6 spelers en bouwvenster (voorbeelddata)\]

Donker: zie mockup m-09-variants-dark-3-360.png

Doel: zes spelers passen zonder afgekapte tekst; het bouwvenster is 1 regel.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | 6 chips van 52 (eerste regel avatar 26 met puntenpil ernaast, daaronder naam 11.5, dan kaarten en ontwikkelingskaarten), tags rechtsboven | 360 x 76 | `--chip` | Tik opent 22 |
| Beurtbalk | "Bouwvenster", "Daarna is Pimpel aan de beurt", ring met 5 seconden | 336 x 52 |  |  |
| Bord | groter bord, schaal 0.84 |  |  |  |
| Dock | tegels, primair "Overslaan" + "geen bouwen" (secundair, 52 hoog) | 72 hoog | `--btn` | Sluit bouwvenster |

Staten:

- normaal: bouwvenster open.
- leeg: n.v.t.
- uitgeschakeld: tegels 45% als niets betaalbaar.
- fout: geen.
- donker: m-09-variants-dark-3.
- 412-verschil: chips 60.
- bord 360 x 574 door de hogere strip (de live app heeft hier ook een hogere strip).

Teksten: "Bouwvenster", "Daarna is Pimpel aan de beurt", "Overslaan", "geen bouwen".

Interactie:

1. Na elke worp opent een bouwvenster voor spelers die niet aan de beurt zijn; ring telt 5 s af.
2. Tik Overslaan: je sluit je venster.

Toegankelijkheid:

- chips aria zoals 1; ring "Nog 5 seconden"; reduced motion: geen animatie.

Data: `g.players.length === 6`, `g.buildWindow` (speler, deadline).

### 36 Hot-seat: overdrachtscherm

&#91;image: 36 Hot-seat: overdrachtscherm (voorbeelddata)\]

Donker: zie mockup m-09-variants-dark-4-360.png

Doel: privacy tussen spelers op een telefoon.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | diepe zee-verloop (niet de seat-kleur) | 360 x 780 | `#2B8C98` naar `#123E4A` |  |
| Avatar | speler met 6px ring in seat-kleur | 120 |  |  |
| Regel | "Geef de telefoon aan" | 16/600 wit 90% |  |  |
| Naam | "Bram" Outfit 44/700 |  | wit |  |
| Slotregel | slot-icoon + "Anderen kijken niet mee" | 14/600 |  |  |
| Knop | "Ik ben Bram" | 240 x 60, radius 20 | #FFF9F2, tekst #1F5F66 Outfit 22/700 | Tik toont het spel |
| Voetregel | "Je kaarten blijven verborgen tot je tikt" | 13/600 |  |  |

Staten:

- normaal: zoals boven.
- leeg, uitgeschakeld, fout: n.v.t.
- donker: m-09-variants-dark-4 (zelfde, al donker).
- 412-verschil: knop 280.

Teksten: "Geef de telefoon aan", "Bram", "Ik ben Bram", "Anderen kijken niet mee", "Je kaarten blijven verborgen tot je tikt".

Interactie:

1. Tik op "Ik ben Bram": scherm fade 200 ms, spel zichtbaar met de hand van Bram.
2. Na Einde beurt of Geef door verschijnt dit scherm direct voor de volgende speler; de hand wordt verborgen voor de overdracht.

Toegankelijkheid:

- knop krijgt focus; aria "Ik ben Bram, toon mijn kaarten"; reduced motion: geen fade.

Data: `g.hotSeat.players`, naam en seat uit `g.currentPlayer`.

### 37 Hot-seat: spelen

&#91;image: 37 Hot-seat: spelen (voorbeelddata)\]

Donker: zie mockup m-09-variants-dark-5-360.png

Doel: spelen met een knop om je hand snel te verbergen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | Anna, Bram (actief), Blaauw, Pimpel | 56 |  |  |
| Beurtbalk | "Bram speelt", "Anna kijkt weg" | 336 x 52 |  |  |
| Bovenrij | Pauze, dobbelchip, oog-uit (outline, 44 x 44) rechts van de zoom |  |  | Tik verbergt hand direct |
| Hand, dock | zoals 1 |  |  |  |
| Primair | "Geef door" + avatar 18 + "aan Anna" | 138 x 56 | `--primary` | Toont overdrachtscherm (36) |

Staten:

- normaal: hand zichtbaar.
- leeg: n.v.t.
- uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-09-variants-dark-5.
- 412-verschil: alleen breder.
- verborgen hand: kaartruggen, handpil "9", tik op oog-uit of schermvergrendeling toont de hand weer na tik.

Teksten: "Bram speelt", "Anna kijkt weg", "Geef door", "aan Anna".

Interactie:

1. Tik op oog-uit: hand wordt kaartruggen in 150 ms; opnieuw tikken toont hem.
2. Tik op Geef door: overdrachtscherm (36).

Toegankelijkheid:

- oog-uit aria "Verberg mijn kaarten"; schermlezer leest handaantallen niet voor als verborgen; reduced motion: direct.

Data: `g.handHidden`, `g.hotSeat.next`.

### 38 Dagpuzzel: de run

&#91;image: 38 Dagpuzzel: de run (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-1-360.png

Doel: de Dagpuzzel is het gewone spelscherm met een gouden strip met dag en beurtteller.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | 3 spelers: Jij, Blaauw, Geelen (chips 112 breed) | 360 x 56 | `--chip` |  |
| Beurtbalk | "Jouw beurt", "Bouw of ruil", stap 2 | 336 x 52 |  |  |
| Dagrij | puzzel-icoon, "Dagpuzzel" + "di 24 nov", rechts "Beurt 7 van 40" en balk van 40 stappen (4 px hoog) | 336 x 40 | `--group` #FBE9C9, rand #F2D9A8; balk `--accent`, vanaf beurt 36 bruin | Alleen info (tik opent 39) |
| Overig | bord, hand, dock zoals 1 |  |  |  |

Staten:

- normaal: beurt 7 van 40.
- leeg: n.v.t.
- uitgeschakeld: zoals 2.
- fout: geen.
- donker: m-10-dagpuzzel-run-dark-1 (`--bank-bg` #2A2418, rand #4A3E24).
- 412-verschil: alleen breder.
- Gedrag: geen toekomstige dobbelstenen, geen undo, ontwikkelingskaarten toegestaan.

Teksten: "Dagpuzzel", "di 24 nov", "Beurt 7 van 40".

Interactie:

1. Elke Einde beurt telt de teller op; bij beurt 40 eindigt de run met de Dagpuzzel-uitslag.
2. Tik op de dagrij: Pauze met regels (39).

Toegankelijkheid:

- dagrij aria "Dagpuzzel di 24 nov, beurt 7 van 40"; balk is decoratief; reduced motion: balk springt zonder animatie.

Data: `daily.date`, `daily.turn` (voorbeeld 7), cap 40.

### 39 Dagpuzzel: Pauze en regels

&#91;image: 39 Dagpuzzel: Pauze en regels (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-2-360.png

Doel: de drie regels van de dag en de uitgang Opgeven.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet kop | "Dagpuzzel, di 24 nov", X | 360 x 56 |  |  |
| Regel 1 | icoon + "Ruilen alleen met de bank" + "en met je havens" | rij 56 | `--chip` |  |
| Regel 2 | "Geen zet terug" + "elke keuze telt" | rij 56 |  |  |
| Regel 3 | "Maximaal 40 beurten" + "daarna tel je je punten" | rij 56 |  |  |
| Opgeven | secundair | 336 x 52 | `--btn` | Opent 40 |
| Voet | primair "Verder spelen" | 336 x 52 | `--primary` | Sluit |

Staten:

- normaal: zoals boven.
- leeg, uitgeschakeld: n.v.t.
- fout: geen.
- donker: m-10-dagpuzzel-run-dark-2.
- 412-verschil: alleen breder.

Teksten: "Dagpuzzel, di 24 nov", "Ruilen alleen met de bank", "en met je havens", "Geen zet terug", "elke keuze telt", "Maximaal 40 beurten", "daarna tel je je punten", "Opgeven", "Verder spelen".

Interactie:

1. Tik op Pauze: sheet 260 ms; de dag loopt niet door (geen klok), tellen is op beurten.
2. Tik op Opgeven: 40.

Toegankelijkheid:

- aria "Sluiten"; focus op "Verder spelen"; reduced motion: fade.

Data: regels zijn vast; datum `daily.date`.

### 40 Dagpuzzel: Opgeven

&#91;image: 40 Dagpuzzel: Opgeven (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-3-360.png

Doel: opgeven bevestigen, met het gevolg zichtbaar.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | "Opgeven?", regel "Je telt als verloren met 6 punten. Vandaag kun je niet opnieuw." | 360 x ca. 230 | `--sheet` |  |
| Knop 1 | primair "Toch verder spelen" | 336 x 52 | `--primary` | Sluit |
| Knop 2 | secundair "Ja, geef op" | 336 x 52 | `--btn` | Bevestigt |

Staten:

- normaal: zoals boven.
- leeg, uitgeschakeld, fout: n.v.t.
- donker: m-10-dagpuzzel-run-dark-3.
- 412-verschil: alleen breder.

Teksten: "Opgeven?", "Je telt als verloren met 6 punten. Vandaag kun je niet opnieuw.", "Toch verder spelen", "Ja, geef op".

Interactie:

1. Ja, geef op: sheet sluit, Dagpuzzel-uitslag (`spec/daily.md`) met "Verloren met 6 punten".

Toegankelijkheid:

- `role=alertdialog`, focus op "Toch verder spelen"; reduced motion: fade.

Data: huidige punten `human.victoryPoints` (voorbeeld 6).

### 41 Dagpuzzel: ruilen alleen met de bank

&#91;image: 41 Dagpuzzel: ruilen alleen met de bank (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-4-360.png

Doel: ruilen in de run kent alleen bank en havens, dus geen "Bied".

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Ruilen", "Alleen bank en havens" | 336 x 52 |  |  |
| Dagrij | als 38 | 336 x 40 | `--group` |  |
| Sheet | titel "Ruilen met de bank", "Jij geeft" 5 kaarten (3 gekozen "-3", ratio-chips 4:1 en haven 2:1), "Jij krijgt" met "+1" |  |  |  |
| Voet | een primaire knop "Ruil met de bank" (geen Bied) | 336 x 52 | `--primary` |  |

Staten:

- normaal: zoals boven.
- leeg: geen kaart met genoeg: primair 45%.
- uitgeschakeld: zoals 6.
- fout: geen.
- donker: m-10-dagpuzzel-run-dark-4.
- 412-verschil: kaarten 62.

Teksten: "Ruilen met de bank", "Alleen bank en havens", "Ruil met de bank".

Interactie:

1. Zoals 6 maar zonder spelerssegment.

Toegankelijkheid:

- zoals 6.

Data: zoals 6; geen spelerslijst.

### 42 Dagpuzzel: hervatten

&#91;image: 42 Dagpuzzel: hervatten (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-5-360.png

Doel: na sluiten of herstarten sta je weer precies waar je was.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Beurtbalk | "Dag hervatten", "Je staat op beurt 7" | 336 x 52 |  |  |
| Dagrij | als 38 |  |  |  |
| Dock | primair "Even wachten" + "Alles staat nog zoals je het liet" uitgeschakeld, tegels 45% | 72 hoog |  |  |

Staten:

- normaal: laadt 300 tot 800 ms.
- leeg: n.v.t.
- uitgeschakeld: dock 45% tijdens laden.
- fout: opgeslagen run onleesbaar: toast "Dag niet te hervatten" en terug naar het Dagpuzzel-tabblad.
- donker: m-10-dagpuzzel-run-dark-5.
- 412-verschil: alleen breder.

Teksten: "Dag hervatten", "Je staat op beurt 7", "Even wachten", "Alles staat nog zoals je het liet", "Dag niet te hervatten".

Interactie:

1. Laden klaar: scherm wordt 38 (fade 150 ms), zelfde stand als bij sluiten.

Toegankelijkheid:

- `aria-live` "Dag hervat op beurt 7"; reduced motion: fade.

Data: opgeslagen run in `localStorage` (`daily.run`, zie `spec/daily.md`).

### 43 Dagpuzzel: beurt 38 van 40

&#91;image: 43 Dagpuzzel: beurt 38 van 40 (voorbeelddata)\]

Donker: zie mockup m-10-dagpuzzel-run-dark-6-360.png

Doel: de laatste beurten zijn zichtbaar dichtbij.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Strip | Jij 8, Blaauw 6, Geelen 5 (voorbeeld) | 56 |  |  |
| Beurtbalk | "Jouw beurt", "Nog 3 beurten" | 336 x 52 |  |  |
| Dagrij | "Beurt 38 van 40", balk bruin (`--accent-ink`) vanaf beurt 36 | 336 x 40 | `--group` |  |
| Overig | zoals 38 |  |  |  |

Staten:

- normaal: zoals boven.
- leeg, uitgeschakeld, fout: n.v.t.
- donker: m-10-dagpuzzel-run-dark-6.
- 412-verschil: alleen breder.
- beurt 40 gespeeld: run eindigt, uitslag (`spec/daily.md`).

Teksten: "Beurt 38 van 40", "Nog 3 beurten".

Interactie:

1. Bij beurt 36 wordt de balk bruin, bij 38 verschijnt "Nog 3 beurten"; na beurt 40 gaat het naar de uitslag.

Toegankelijkheid:

- `aria-live` bij elke beurt vanaf 36: "Nog 3 beurten".

Data: `daily.turn` (voorbeeld 38), cap 40.

---

## Gaten en open punten

1. **Pauze-blad voor het gewone spel** (32) heeft geen eigen mockup; de Dagpuzzel-versie in `m-10-dagpuzzel-run-2` is de enige afbeelding. De rijen zijn uit `design.md` (Uitleg, Stand, Instellingen, Nieuw spel, Naar start).
2. **Donker** bestaat alleen voor p01, 02, 03, 04, 05, 09 en 10. Bouwtray en ruilen (06), ontwikkelingskaarten (07) en opstelling/uitleg (08) hebben geen donkere mockup; ze gebruiken dezelfde tokens.
3. **Kwaliteitsringen** bij de opstelling (27) zijn een voorstel voor beginners (open vraag 4 in `design.md`).
4. De bordkunst in de mockups tekent Groen nog in #0A6B63; runtime is #1E9E8E (alleen kunst, opnieuw vastleggen vóór de bouw).
5. Het banksaldo-lipje onder elke handkaart is overgenomen van de huidige app (zoals gevraagd); eerder stond in het ontwerp "alleen bij weinig". Besluit nodig als de hand drukker lijkt.
6. Kaartnamen in het lint zijn 11.5 px (huidige app 10 px); op 360 past "Baksteen" nog.
7. De iconen "zoom", vlag, oog-uit, slot, puzzel zijn de enige nieuwe outline-iconen; de app heeft daar geen kleuren-icoon voor.
8. Hand heeft in `H=780` de handkaarten over het bord heen (zoals de live app); op lage schermen (minder dan 640 hoog) valt de hand over het eiland, het bord schuift dan 40 px omhoog.
