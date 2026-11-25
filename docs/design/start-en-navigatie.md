# Katan PWA: schermspec shell (Spelen, Dagpuzzel, navigatie, setup, onboarding, instellingen, pauze)

Dit document beschrijft elk shell-scherm van de Katan PWA-herontwerp (optie A: tabbalk met Spelen, Dagpuzzel, Terugblik, Bots; tandwiel voor Instellingen) per scherm: onderdelen met maat, token en gedrag, staten, exacte Nederlandse teksten, interactie met animatiedurations, toegankelijkheid en de herkomst van elk getal. Componentdetails (maten, staten per component, aria) staan in `spec/system.md`; hier wordt ernaar verwezen met "zie systeem 8" enz. Alle namen, scores, reeksen (12 dagen), datums (di 24 nov), beurten en codes in de beelden zijn voorbeeldgegevens. Afbeeldingspaden zijn relatief aan `design199/` en tonen 360 x 780 licht (dark ernaast). Maten met "ca." zijn uit de shot gemeten (2x, gedeeld door 2). Terugblik en Bots zijn alleen als navigatiekader opgenomen; hun inhoud hoort bij de post-game ontwerper.

## Index

1. Spelen
   - 1.1 Normaal (Verder spelen + dagpuzzel open)
   - 1.2 Eerste keer (soft gate)
   - 1.3 Dagpuzzel bezig
   - 1.4 Dagpuzzel gewonnen
   - 1.5 Dagpuzzel verloren
   - 1.6 Offline
   - 1.7 Hersteld na onderbreking
   - 1.8 Auto-donker toast
2. Dagpuzzel tab
   - 2.1 Dagpuzzel tab
   - 2.2 Dagpuzzel tab klaar
3. Terugblik en Bots (kader)
   - 3.1 Terugblik root
   - 3.2 Bots root
4. Nieuw spel
   - 4.1 Nieuw spel sheet
   - 4.2 Meer regels
5. Onboarding coach
   - 5.1 Stap 1 Zo begint het spel
   - 5.2 Stap 2 Getallen en stippen
   - 5.3 Stap 3 Kies je eerste dorp
   - 5.4 Stap 4 Havens
   - 5.5 Stap 5 Nu een weg
6. Instellingen
7. Pauze (menu in het spel)
8. Navigatiemodel

---

### 1.1 Spelen, normaal

&#91;image: 1.1 Spelen, normaal (voorbeelddata)\]

Donker: zie mockup home-a-360-dark.png

Doel: Het startscherm van een terugkerende speler: verder spelen, de dagpuzzel van vandaag en een nieuw spel in drie blokken.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | zee | vol | `--sea-image` + `--home-shade` | Scrollt als inhoud langer is; op 360 x 780 geen scroll |
| Kop | logo 40, "Katan", tandwiel | padding 14 16 4, tandwiel 44 x 44 vierkant, radius 10 | wit 26/650, tandwiel wit (`--btn`) met beige rand | Tandwiel opent 6 |
| Verder spelen | play-knop, "Verder spelen", "Klassiek, beurt 14", 4 avatars | ca. 68 hoog, avatar 30 overlap | teal rij, wit op zee-pil | Alleen bij opgeslagen normaal spel. Hele rij tikbaar |
| Dagpuzzel-kaart (goud) | kop: "VANDAAG", chip "di 24 nov", reeks-chip "12 dagen"; titel "Dagpuzzel"; bordminiatuur; "Zelfde worpen voor iedereen"; chip "Nog niet gespeeld"; "Jij tegen Blaauw Geelen"; primair | ca. 296 hoog, padding 14, miniatuur 88 x 88 radius 16, avatars 36 | `card gold`, `--streak-line` | Primair "Speel de dagpuzzel" start de dag |
| Nieuw spel-kaart | titel "Nieuw spel", knop "Aanpassen", chips Klassiek / 3 bots / Gemiddeld, primair | ca. 198 hoog | `card` | Start spel gebruikt laatste instellingen |
| Tabbalk | Spelen (actief), Dagpuzzel + badge, Terugblik, Bots | ca. 68 + safe area | zie systeem 8 | Badge tot de dag gespeeld is |

Staten:

- Verder spelen verborgen als er geen opgeslagen normaal spel is.
- Dagpuzzel staat open; wisselt naar 1.3, 1.4, 1.5.
- Donker: nachtpaletten, avatars ongewijzigd, goud wordt #2A2418.

Teksten: "Katan", "Verder spelen", "Klassiek, beurt 14", "Vandaag", "di 24 nov", "12 dagen", "Dagpuzzel", "Zelfde worpen voor iedereen", "Nog niet gespeeld", "Jij", "tegen", "Blaauw", "Geelen", "Speel de dagpuzzel", "Nieuw spel", "Aanpassen", "Klassiek", "3 bots", "Gemiddeld", "Start spel", "Spelen", "Dagpuzzel", "Terugblik", "Bots"

Interactie:

1. Tik Verder spelen: spel hervat, scherm wisselt met fade 200 ms, tabbalk verdwijnt.
2. Tik "Speel de dagpuzzel": spelscherm met de dagpuzzel (ander ontwerp); eerste keer toont de introsheet (daily/02-intro-sheet-v2).
3. Tik "Aanpassen": sheet 4.1 opent (280 ms sheetUp).
4. Tik "Start spel": spel start met laatst gebruikte instellingen; coach 5.x alleen als Uitleg aan staat.
5. Tik tandwiel: Instellingen (6) schuift in van rechts 280 ms.
6. Tik tab: wisselt zonder animatie.

Toegankelijkheid: Volgorde: tandwiel, Verder spelen, dagpuzzel-primair, Aanpassen, Start spel, tabs. Reeks-chip `aria-label="12 dagen op rij"`; badge "Dagpuzzel, nog niet gespeeld"; miniatuur `alt` "Bord van vandaag"; zee-achtergrond decoratief. Reduced motion: schermwissels als fade.

Data: Verder spelen uit het opgeslagen spel (modus, beurt 14, seats; voorbeeld). Datum = Amsterdamse dag van het toestel. Reeks = opgeslagen dagpuzzel-geschiedenis (12 = voorbeeld). Bots Blaauw en Geelen = vaste dagbots. Nieuw-spel chips = laatst gebruikte instellingen (voorbeeld: Klassiek, 3 bots, Gemiddeld). Miniatuur = bord van de dag (`daily/assets/board-day*.webp`, art nog met Groen #0A6B63, opnieuw vastleggen).

### 1.2 Spelen, eerste keer

&#91;image: 1.2 Spelen, eerste keer (voorbeelddata)\]

Donker: zie mockup home-a-first-360-dark.png

Doel: Een nieuwe speler start in één tik zijn eerste spel met uitleg; de dagpuzzel is zacht gesloten.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | logo, "Katan", tandwiel | als 1.1 |  |  |
| Hero-kaart | logo 86, "Je eerste spel" 24, regel, 3 avatars 42, chips, primair, ghost | padding 16 | `card` | Eén primaire |
| Chips | "Makkelijke bots" (teal), "10 punten" | h 28 |  | Niet tikbaar |
| Dagpuzzel-kaart compact | titel, "Speel eerst één oefenpotje", secundair "Toch spelen" |  | `card gold` | Zonder reeks: reeks-chip verborgen |
| Tabbalk | Spelen actief, geen badge |  |  | Badge verborgen bij 0 gespeelde spellen |

Staten:

- Geldt bij 0 afgemaakte spellen; verdwijnt na het eerste afgemaakte spel (dan 1.1).
- "Toch spelen" opent de dagpuzzel ondanks de gate.

Teksten: "Je eerste spel", "We leggen onderweg uit wat je ziet.", "Makkelijke bots", "10 punten", "Start je eerste spel", "Zelf kiezen", "Dagpuzzel", "Speel eerst één oefenpotje", "Toch spelen"

Interactie:

1. Tik "Start je eerste spel": spel start (Makkelijke bots, 10 punten, Uitleg aan), setup-coach 5.1 verschijnt na 300 ms.
2. Tik "Zelf kiezen": sheet 4.1 opent met Uitleg aan (280 ms).
3. Tik "Toch spelen": de dagpuzzel opent (introsheet eerst).

Toegankelijkheid: Volgorde: tandwiel, primair, Zelf kiezen, Toch spelen, tabs. Hero-logo decoratief. Reduced motion: fades.

Data: aantal afgemaakte spellen uit de spelgeschiedenis (0). Standaarden (Makkelijk, 10 punten) vaste waarden voor de eerste keer. Geen reeks omdat er nog geen dag gespeeld is.

### 1.3 Spelen, dagpuzzel bezig

&#91;image: 1.3 Spelen, dagpuzzel bezig (voorbeelddata)\]

Donker: zie mockup home-a-daily-busy-360-dark.png

Doel: Een lopende dagpuzzel is het ene hervat-punt; de kaart zegt "Maak af".

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Verder spelen-rij | niet getoond |  |  | Eén hervat-ingang |
| Dagpuzzel-kaart | kop als 1.1; miniatuur met geplaatste stukken; chip "Bezig"; "Beurt 7 van 40" 22/650; 40-stappenbalk; "Jij tegen Blaauw Geelen"; primair "Maak af" | ca. 295 hoog; balk h 8 | `card gold`, balk `--accent` | Primair hervat |
| Nieuw spel-kaart | als 1.1 |  |  |  |
| Tabbalk | badge blijft zichtbaar |  |  | Dag nog niet uitgespeeld |

Staten:

- Bezig; wordt 1.4 of 1.5 bij afronden.
- Bij ook een lopend normaal spel: het normale spel is er dan niet (spelen laat één opgeslagen spel toe), anders blijft de Verder spelen-rij weg.

Teksten: "Vandaag", "di 24 nov", "12 dagen", "Dagpuzzel", "Bezig", "Beurt 7 van 40", "Jij", "tegen", "Blaauw", "Geelen", "Maak af", "Nieuw spel", "Aanpassen", "Start spel"

Interactie:

1. Tik "Maak af": spel hervat op beurt 7 (fade 200 ms).
2. Tik "Start spel": vraagt niet om bevestiging; het lopende dagspel blijft opgeslagen.

Toegankelijkheid: Balk `role="progressbar"` waarde 7 van 40; chip "Bezig" is tekst. Reduced motion: geen balkanimatie.

Data: beurt en bordstand uit de dag-opslag (7 = voorbeeld, 40 = beurtlimiet dagpuzzel, beheerd door de Dagpuzzel-ontwerper). Streep gevuld = beurt / 40.

### 1.4 Spelen, dagpuzzel gewonnen

&#91;image: 1.4 Spelen, dagpuzzel gewonnen (voorbeelddata)\]

Donker: zie mockup home-a-done-360-dark.png

Doel: Na een winst toont de kaart het resultaat in inkt, deelt de uitslag en telt af naar de volgende puzzel.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | "VANDAAG", "di 24 nov", "13 dagen" | als 1.1 |  | Reeks al +1 |
| Statuschip | vinkje + "Gewonnen" | h 28 | teal | Niet tikbaar |
| Resultaat | "17" + "beurten" | getal 88 Outfit 700, eenheid 22 | `--heading` |  |
| Vergelijking | chip "2 sneller" | h 28 | `--good-bg` / `--good` | Alleen Jij-waarde |
| Slimme bot | "Slimme bot: 19 beurten" | 14, getal vet | `--ink-soft` | Alleen na winst |
| Acties | primair met deel-icoon "Deel je uitslag", secundair "Bekijk" | h 48, 2 kolommen |  | Deel opent deelblad; Bekijk opent uitslag |
| Aftelregel | "Nieuwe puzzel over 6 u 12 min" | 14, midden | `--ink-soft` |  |
| Verder spelen | rij zoals 1.1 (voorbeeld met opgeslagen spel) |  |  |  |

Staten:

- Geen badge op Dagpuzzel; "Speel de dagpuzzel" bestaat niet meer vandaag.
- Offline: Deel wacht (zie 1.6).

Teksten: "Gewonnen", "17", "beurten", "2 sneller", "Slimme bot: ", "19 beurten", "Deel je uitslag", "Bekijk", "Nieuwe puzzel over 6 u 12 min"

Interactie:

1. Tik "Deel je uitslag": systeem-deelblad met de uitslagtekst en code (`KD1-3QM7-2R9X-HT6B`); zonder deelblad kopieert hij en toont toast "Code gekopieerd" 3 s.
2. Tik "Bekijk": uitslagscherm (daily/04a-result-win-v2), terug naar Spelen.
3. Telt af elke minuut; om middernacht Amsterdam wisselt de kaart naar 1.1 met reeks en nieuwe datum (fade 200 ms).

Toegankelijkheid: Resultaat als één zin voor schermlezers: "Gewonnen in 17 beurten, 2 beurten sneller dan de slimme bot". Aftelregel `aria-live="off"` (geen minuutmeldingen). Volgorde: Deel, Bekijk.

Data: 17 = beurten van de gespeelde dag. "Slimme bot: 19" = vaste benchmark van de dag (voorbeeld). "2 sneller" = 19 min 17 (afgeleid). Reeks 13 = vorige reeks + 1. Afteltijd = tijd tot 00:00 Amsterdam. Code = versie, dag, resultaat, checksum.

### 1.5 Spelen, dagpuzzel verloren

&#91;image: 1.5 Spelen, dagpuzzel verloren (voorbeelddata)\]

Donker: zie mockup home-a-done-loss-360-dark.png

Doel: Een verlies wordt neutraal getoond (geen rood) met de punten en wie won, en telt toch voor de reeks.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | zoals 1.4, reeks "13 dagen" |  |  | Verlies telt mee |
| Statuschip | "Verloren" | h 28, rand 1.5 | inkt-chip (`--ink-faint` rand) | Neutraal |
| Resultaat | "8" + "punten" | 88 / 22 | `--heading` |  |
| Regel | "Blaauw won op beurt 24" | 14 | `--ink-soft` | Geen "Slimme bot" |
| Acties, aftelregel | als 1.4 |  |  |  |

Staten:

- Ook "tijd op" (beurtlimiet bereikt) gebruikt dit patroon met eigen tekst (daily/04a-result-tijdop-v2); die tekst hoort bij de Dagpuzzel-ontwerper.

Teksten: "Verloren", "8", "punten", "Blaauw won op beurt 24", "Deel je uitslag", "Bekijk", "Nieuwe puzzel over 6 u 12 min"

Interactie:

1. Als 1.4 (Deel, Bekijk, aftellen).

Toegankelijkheid: Zin: "Verloren met 8 punten. Blaauw won op beurt 24". Geen kleur als betekenis.

Data: 8 = punten van Jij aan het einde; "Blaauw won op beurt 24" uit het speellog (voorbeeld). Reeks +1 ook bij verlies.

### 1.6 Spelen, offline

&#91;image: 1.6 Spelen, offline (voorbeelddata)\]

Donker: zie mockup home-offline-360-dark.png

Doel: Offline zeggen dat spelen blijft werken en alleen delen wacht.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Offlinebanner | wifi-uit-icoon, "Je bent offline", regel | h min 48 | `--sheet`, neutraal (zie systeem 18) | Boven Verder spelen; niet wegveegbaar |
| Rest | als 1.1 |  |  | Alle spelen werkt |

Staten:

- Online terug: banner verdwijnt (180 ms fade).
- In 1.4 en 1.5 blijft Deel tikbaar; de actie wacht in een wachtrij en gaat bij verbinding.

Teksten: "Je bent offline", "Spelen kan gewoon. Delen wacht tot je online bent."

Interactie:

1. Verbinding valt weg: banner verschijnt (fade 180 ms), de rest van het scherm schuift 60 px omlaag zonder sprong.
2. Verbinding terug: banner uit, toast "Weer online" (voorstel).

Toegankelijkheid: `role="status"` `aria-live="polite"`; banner komt vóór de kaarten in de leesvolgorde.

Data: `navigator.onLine` plus mislukte fetch; de tekst is vast.

### 1.7 Spelen, hersteld na onderbreking

&#91;image: 1.7 Spelen, hersteld na onderbreking (voorbeelddata)\]

Donker: zie mockup home-resume-360-dark.png

Doel: Na een crash vertelt de app dat het spel is hersteld en wat er hooguit verloren ging.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Verder spelen-rij | regel "Hersteld na onderbreking, beurt 14" (2 regels op 360, rij ca. 88 hoog) |  |  | Hervat |
| Toast | geschiedenis-icoon, "Spel hersteld. Alleen je laatste tik ging verloren." | h min 48 | #22302F | 3 s |

Staten:

- Toast verdwijnt na 3 s; de rij blijft "Hersteld na onderbreking" tot het spel is hervat.

Teksten: "Hersteld na onderbreking, beurt 14", "Spel hersteld. Alleen je laatste tik ging verloren."

Interactie:

1. Start van de app na een crash: toast verschijnt (260 ms) boven de tabbalk.
2. Tik de rij: hervat.

Toegankelijkheid: toast `role="status"`; focus verplaatst niet.

Data: herstelvlag uit de autosave. Beurt 14 uit de herstelde save (voorbeeld). Het in-game beeld na herstel hoort bij de game-ontwerper.

Opmerking: de toasttekst is 2 regels op 360 en dekt de onderrand van de Nieuw spel-kaart; kort de tekst in of laat de toast boven het scherm vallen (open punt, zie rapport).

### 1.8 Spelen, auto-donker toast

&#91;image: 1.8 Spelen, auto-donker toast (voorbeelddata)\]

Donker: zie mockup home-autodark-360-dark.png

Doel: Eenmalig melden dat de kleuren nu de telefoon volgen, met een snelle weg naar de keuze.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Scherm | als 1.1 |  |  | Gebruikt de effectieve palette |
| Toast | maan-icoon, "Kleuren volgen je telefoon.", actie "Wijzig" | h min 48, actie 44 x 44 | #22302F, actie #F6C089 | 3 s, eenmalig |

Staten:

- Alleen voor iedereen die nooit een palette koos, één keer; nooit opnieuw.
- Telefoon donker = het scherm toont de nachtkolom (dark-shot); telefoon licht = dagkolom.

Teksten: "Kleuren volgen je telefoon.", "Wijzig"

Interactie:

1. Eerste start na de update: toast in (260 ms), uit na 3 s (180 ms).
2. Tik "Wijzig": Instellingen 6 opent op Uiterlijk, Kleuren (Auto, Licht, Donker) met toast weg.

Toegankelijkheid: `role="status"`; actie is bereikbaar op toets; als de toast verdwijnt blijft de keuze in Instellingen.

Data: vlag "toast gezien" in de instellingen; `prefers-color-scheme`. Niet gemockt: het exacte sluitmoment (3 s aangenomen).

### 2.1 Dagpuzzel tab

&#91;image: 2.1 Dagpuzzel tab (voorbeelddata)\]

Donker: zie mockup dagtab-360-dark.png

Doel: Het enige huis van de dagpuzzel en zijn geschiedenis: vandaag spelen, Mijn dagen, vergelijken, oefenen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | "Dagpuzzel" 26, tandwiel | geen terugpijl | wit op zee |  |
| Dagpuzzel-kaart | gelijk aan 1.1 (zelfde markup) | ca. 296 | `card gold` |  |
| Mijn dagen | titel, "Beste reeks 15 dagen", weekstrook ma tot zo (32 cirkels), 3 dagrijen met Review-knop, "Alle dagen" | rij 56, Review 44 hoog | `card`, zon `--streak-sun` | Rij = uitslag, knop = review |
| Rij Vergelijk | icoon, "Vergelijk met een vriend", "Plak de code van je vriend" | 56 |  | Opent plakscherm |
| Rij Oefen | icoon, "Oefen een eerdere dag", "Telt niet voor je reeks" | 56 |  | Opent dagkiezer |
| Tabbalk | Dagpuzzel actief + badge |  |  |  |

Staten:

- Weekstrook: gespeeld (goud), vandaag (ring), toekomst (leeg), gemist (gestippeld).
- Zonder geschiedenis: Mijn dagen leeg (daily/06b-mijn-dagen-leeg-v2).
- Kaartstaten volgen 1.1, 1.3, 1.4, 1.5.

Teksten: "Dagpuzzel", "Mijn dagen", "Beste reeks 15 dagen", "ma", "di", "wo", "do", "vr", "za", "zo", "ma 23 nov", "Gewonnen in 17 beurten", "zo 22 nov", "Verloren met 9 punten", "za 21 nov", "Gewonnen in 21 beurten", "Review", "Alle dagen", "Vergelijk met een vriend", "Plak de code van je vriend", "Oefen een eerdere dag", "Telt niet voor je reeks"

Interactie:

1. Tik een dagrij: uitslag van die dag (daily/04a-result-\*-v2), terug naar deze tab.
2. Tik "Review": review van die dag (post/mock/rv-daily-v2), terug naar de lijst (slide 280 ms).
3. Tik "Alle dagen": volledige lijst Mijn dagen (niveau 2).
4. Tik Vergelijk: daily/07b-vergelijk-plakken-v2; tik Oefen: dagkiezer, telt niet voor de reeks.

Toegankelijkheid: Volgorde: tandwiel, kaart-primair, dagrijen (rij, Review), Alle dagen, Vergelijk, Oefen, tabs. Weekstrook `role="img"` met samenvatting; Review `aria-label="Review van ma 23 nov"`.

Data: weekstrook en lijst uit de dag-geschiedenis (voorbeelddagen). "Beste reeks 15" = max uit geschiedenis. Oefendagen tellen niet mee.

### 2.2 Dagpuzzel tab, klaar

&#91;image: 2.2 Dagpuzzel tab, klaar (voorbeelddata)\]

Donker: zie mockup dagtab-done-360-dark.png

Doel: Dezelfde tab nadat vandaag gespeeld is: resultaat bovenaan, reeks bijgewerkt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Dagpuzzel-kaart | als 1.4 (of 1.5 bij verlies) | ca. 268 | `card gold` |  |
| Mijn dagen | vandaag (di) krijgt een gevulde zon met ring; reeks 13 |  |  |  |
| Rest | als 2.1 |  |  |  |
| Tabbalk | geen badge |  |  |  |

Staten:

- Win en verlies als 1.4 en 1.5.

Teksten: "Gewonnen", "17", "beurten", "2 sneller", "Slimme bot: ", "19 beurten", "Deel je uitslag", "Bekijk", "Nieuwe puzzel over 6 u 12 min", "Mijn dagen"

Interactie:

1. Als 1.4 voor Deel en Bekijk.
2. Terug van een uitslag of review: valt terug op deze tab (niveau 1).

Toegankelijkheid: als 2.1; badge ontbreekt, de tabnaam is gewoon "Dagpuzzel".

Data: als 1.4; vandaag verschijnt pas in de lijst nadat de dag is afgerond (de bovenste dagrij blijft ma 23 nov in het voorbeeld; opnemen van vandaag in de lijst is een open punt).

### 3.1 Terugblik root (kader)

&#91;image: 3.1 Terugblik root (kader) (voorbeelddata)\]

Donker: zie mockup navigation-360-dark.png

Alleen de tabbalk en stroom; geen eigen mockup in de shell

Doel: Tab Terugblik als navigatiekader: het ontwerp van de inhoud ligt bij de post-game ontwerper.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | "Terugblik", tandwiel | als 2.1 |  | Geen terugpijl |
| Segmentbalk | "Spellen" / "Lessen" | h 44 | zie systeem 3 | Lessen leeg tot er een review is |
| Inhoud | lijst met spellen of lessen |  |  | Hoort bij post/ |
| Filterchip | "Dagpuzzel" in Spellen | tikbaar 44 | `chip btnlike` | Linkt naar tab Dagpuzzel, Mijn dagen |
| Tabbalk | Terugblik actief |  |  |  |

Staten:

- Spellen, Lessen; leeg (wijst naar Spelen).

Teksten: "Terugblik", "Spellen", "Lessen", "Dagpuzzel"

Interactie:

1. Tik een spel: Review (niveau 2, terug naar deze lijst).
2. Tik filterchip "Dagpuzzel": wisselt naar tab Dagpuzzel (geen nieuwe geschiedenis).

Toegankelijkheid: segmentbalk als radiogroup; tab `aria-current`.

Data: spelgeschiedenis en lessen uit de lokale opslag (post-game ontwerper).

### 3.2 Bots root (kader)

&#91;image: 3.2 Bots root (kader) (voorbeelddata)\]

Donker: zie mockup navigation-360-dark.png

Alleen de tabbalk en stroom; geen eigen mockup in de shell

Doel: Tab Bots als kader: ranglijst en botprofielen zijn het werk van de post-game ontwerper.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | "Bots", tandwiel | als 2.1 |  | Geen terugpijl |
| Inhoud | ranglijst, botprofiel (niveau 2) |  |  | Hoort bij post/ |
| Tabbalk | Bots actief |  |  |  |

Staten:

- Lijst; leeg (nog geen spellen).

Teksten: "Bots"

Interactie:

1. Tik een bot: botprofiel, niveau 2 met terugpijl, tabbalk verborgen.

Toegankelijkheid: botnamen exact als de app ze toont (Blaauw, Geelen, Groen, De Wit, Pimpel).

Data: botstatistieken uit de spelgeschiedenis (post-game ontwerper).

### 4.1 Nieuw spel sheet

&#91;image: 4.1 Nieuw spel sheet (voorbeelddata)\]

Donker: zie mockup newgame-360-dark.png

Doel: Eén plek om een spel in te stellen met de laatste keuzes als standaard.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | titel "Nieuw spel", sluitknop 44 | radius 22, top ca. 110 vanaf boven | zie systeem 7 | Max hoogte 94% |
| Soort | 2 tegels: "Klassiek" "Om de beurt", "Rush" "Iedereen tegelijk" | h min 76, radius 14, titel 19 | gekozen: bg `--accent-soft`, rand 1.5 `--accent` | Eén keuze |
| Tegenstanders | label + chip "3 bots"; 5 avatars (Blaauw, Geelen, De Wit aan; Pimpel, Groen uit) | tikvlak 56 x 72, avatar 44 | `off` = grijs 45% | Tik wisselt, min 1 bot |
| Niveau | segment "Makkelijk" / "Gemiddeld" / "Moeilijk" | h 44 | zie systeem 3 |  |
| Kaart | segment "Eiland" / "Zeevaarders" | h 44 |  |  |
| Uitleg | titel "Uitleg bij de opstelling", regel, schakelaar | rij 48 | accent aan |  |
| Meer regels | rij: sliders-icoon, titel, regel "10 punten, bord, vriend", chevron | h 52, radius 14 | `--chip` | Opent 4.2 |
| Footer | primair "Start spel" | h 48 | sticky |  |

Staten:

- Standaard = laatste keuze; Zeevaarders beperkt bots tot 3 (de chip springt mee, voorstel).
- Rush toont een eigen subregel; het scherm bleef gelijk.
- Gekozen soort heeft ring, geen andere kleur.

Teksten: "Nieuw spel", "Soort", "Klassiek", "Om de beurt", "Rush", "Iedereen tegelijk", "Tegenstanders", "3 bots", "Blaauw", "Geelen", "De Wit", "Pimpel", "Groen", "Niveau", "Makkelijk", "Gemiddeld", "Moeilijk", "Kaart", "Eiland", "Zeevaarders", "Uitleg bij de opstelling", "Aan tot je het eerste spel hebt gedaan", "Meer regels", "10 punten, bord, vriend", "Start spel", "Sluiten"

Interactie:

1. Tik "Aanpassen" op Spelen: sheet schuift omhoog 280 ms; focus op de titel.
2. Tik een avatar: aan/uit, chip telt direct bij ("2 bots"), 150 ms ring.
3. Tik een segment of soort: direct gekozen, geen bevestiging.
4. Tik "Meer regels": 4.2 schuift in als tweede laag (280 ms), Terug sluit alleen 4.2.
5. Tik "Start spel": sheet sluit (200 ms), spel start; instellingen worden bewaard als nieuwe standaard.
6. X, scrim-tik, veeg omlaag, Terug-gebaar: sheet sluit zonder te starten (200 ms).

Toegankelijkheid: `role="dialog"` met focus-trap, Escape sluit. Bot-avatars `aria-pressed` met botnaam; chip "3 bots" `aria-live="polite"`. Volgorde: Sluiten, Soort, Tegenstanders, Niveau, Kaart, Uitleg, Meer regels, Start. Reduced motion: sheet fade 120 ms.

Data: standaarden uit laatste gebruikte instellingen. "3 bots" = aantal aangezette avatars. De regel onder Meer regels vat de gekozen punten, kaart en vriend samen (voorbeeld "10 punten, bord, vriend"). Uitleg-schakelaar: aan tot het eerste spel is afgemaakt.

### 4.2 Meer regels

&#91;image: 4.2 Meer regels (voorbeelddata)\]

Donker: zie mockup newgame-360-dark.png

Alleen de rij onderin; er is geen eigen mockup (open punt)

Doel: Alle geavanceerde opties in één tweede laag, zonder apart scherm "Regels en opties".

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheetlaag | titel "Meer regels", terugknop 44 links | als 4.1 |  | Stapelt op 4.1 |
| Punten om te winnen | segment 8 / 10 / 12 (voorstel) | h 44 |  | Standaard 10 |
| Dobbelstenen | segment "Eerlijk" / "Echt willekeurig" (voorstel) | h 44 |  |  |
| Kaartverdeling | segment (voorstel) | h 44 |  |  |
| Rover | schakelaar | 52 x 44 | accent |  |
| Vriend op deze telefoon | rij "Mens per stoel" met stoelkiezer | rij 56 |  | Vervangt "Speel met een vriend" op Home |
| Footer | primair "Klaar" | h 48 | sticky | Sluit de laag |

Staten:

- Terug zonder "Klaar" bewaart de wijzigingen ook (geen annuleren; voorstel).

Teksten: "Meer regels", "Punten om te winnen", "Dobbelstenen", "Kaartverdeling", "Rover", "Vriend op deze telefoon", "Klaar"

Interactie:

1. Tik een optie: direct bewaard (150 ms).
2. Tik "Klaar" of Terug: laag sluit (200 ms), 4.1 toont de bijgewerkte regel.

Toegankelijkheid: dialoog in dialoog; focus terug naar "Meer regels"; segmenten als radiogroup.

Data: bron zijn de bestaande opties van de huidige "Regels en opties"; precieze waarden en labels (de lijsten hierboven zijn voorstel) moeten uit `game.js` komen. Open: geen mockup.

### 5.1 Onboarding, stap 1 Zo begint het spel

&#91;image: 5.1 Onboarding, stap 1 Zo begint het spel (voorbeelddata)\]

Donker: zie mockup onb-1-360-dark.png

Doel: Laten zien in welke volgorde de opstelling gaat (2 dorpen en 2 wegen per speler, ronde 2 terug).

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Spelersstrook | Jij, Blaauw, Geelen, De Wit | 4 kolommen, avatar 30 | Jij: ring `--accent` inset |  |
| Ticker | "Opstelling 1 van 4", infoknop | h 44 | `--bank-bg` | Infoknop heropent de stap |
| Bord | voorbeeldbord 7 tegels | vult resterend | zee | Niet tikbaar in stap 1 |
| Coachkaart | punten 1 van 5, "Zo begint het spel", regel, volgorde-visual (Ronde 1: 1 tot 4; Ronde 2: 4 tot 1), "Sla over", "Volgende" | ca. 265 | zie systeem 11 |  |
| Visual | 2 rijen met avatars 32, nummerbadge 18, chevrons |  | `--ink` badge |  |

Staten:

- Alleen als Uitleg aan staat tijdens de eerste opstelling.
- Hand ontbreekt tijdens de opstelling (geen grondstoffen, geen handkaarten).

Teksten: "Opstelling 1 van 4", "1 van 5", "Zo begint het spel", "2 dorpen en 2 wegen per speler. Ronde 2 gaat terug.", "Ronde 1", "Ronde 2", "Sla over", "Volgende"

Interactie:

1. Coach verschijnt 300 ms na start (slide omhoog 240 ms, fade bij reduced motion).
2. Tik "Volgende": stap 2 (cross-fade 200 ms).
3. Tik "Sla over": coach sluit, Uitleg uit voor dit spel; ticker blijft.
4. Tik infoknop (i): stap 1 opnieuw.

Toegankelijkheid: dialoog niet modaal, `aria-label="Uitleg 1 van 5"`; focus op de titel; zin voor lezers: "Ronde 1: Jij, Blaauw, Geelen, De Wit. Ronde 2 in omgekeerde volgorde". Reduced motion: fade.

Data: volgorde en bot-namen uit de spelinstelling (voorbeeldzitplaatsen). Bord = voorbeeldbord, getallen en stippen zijn voorbeeld; echte bord uit het spel. Opmerking: het bord toont Groen nog in #0A6B63 art.

### 5.2 Onboarding, stap 2 Getallen en stippen

&#91;image: 5.2 Onboarding, stap 2 Getallen en stippen (voorbeelddata)\]

Donker: zie mockup onb-2-360-dark.png

Doel: Uitleggen dat het gegooide getal bepaalt welke tegel betaalt en dat meer stippen vaker komt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Ticker | "Kijk naar de getallen" | h 44 |  |  |
| Bord | getalmunten vergroot (`bigNums`) | munt 36 | zie systeem 13 | Pulse op de munten |
| Coachkaart | 2 van 5, "Getallen en stippen", regel, rij 2 tot 12 met stippen (7 = rover), "Sla over", "Volgende" |  |  |  |
| Visual | 11 kolommen b 25 (rover 27); 6 en 8 rood |  | #B3321F |  |

Staten:

- Pulse op munten; bij reduced motion statische ring.

Teksten: "Kijk naar de getallen", "2 van 5", "Getallen en stippen", "Dit getal gooien = die tegel betaalt. Meer stippen = vaker.", "7", "Sla over", "Volgende"

Interactie:

1. Tik "Volgende": stap 3 (200 ms cross-fade).
2. Tik "Sla over": coach sluit.

Toegankelijkheid: stippen niet voorlezen; tekstregel draagt de regel. Munten 6 en 8 zijn ook rood gemarkeerd door het getal zelf (geen kleur als enige hint: meer stippen).

Data: stippenaantal per getal is regelconstante (2/12 = 1 tot 6/8 = 5); getallen op het bord zijn voorbeeld.

### 5.3 Onboarding, stap 3 Kies je eerste dorp

&#91;image: 5.3 Onboarding, stap 3 Kies je eerste dorp (voorbeelddata)\]

Donker: zie mockup onb-3-360-dark.png

Doel: De speler kiest zelf een eerste dorp en leert: verschillende tegels en veel stippen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Ticker | "Tik op een plek voor je eerste dorp" | h 44 |  |  |
| Bord | legale plekken (rode stip in witte ring) met totaal: "13 stippen" (donkere pil), 12 (teal), 7 (grijs) | plek tikdoel min 44 | Jij `--p0` | Tik plaatst een dorp |
| Coachkaart | 3 van 5, "Kies je eerste dorp", regel, vergelijking "13 stippen" tegenover "7 stippen" met 3 grondstoffen-icons elk, "Sla over" |  |  | "Volgende" verschijnt pas na de tik |

Staten:

- Wacht op tik: geen Volgende.
- Na de tik: dorp staat, Volgende verschijnt (200 ms fade).
- Een plek met weinig stippen is toegestaan; coach dwingt niets af.

Teksten: "Tik op een plek voor je eerste dorp", "3 van 5", "Kies je eerste dorp", "Tik op een plek. Kies verschillende tegels en veel stippen.", "13 stippen", "of", "7 stippen", "Sla over", "Volgende"

Interactie:

1. Tik een plek: dorp valt neer (scale .8 naar 1, 200 ms `--ease-pop`), coach toont Volgende.
2. Tik "Volgende": stap 4.
3. Tik "Sla over": coach sluit, de speler plaatst zelf verder.

Toegankelijkheid: plekken `<button aria-label="Plek bij hout 10, baksteen 6, wol 8: 13 stippen">`; focusvolgorde van boven naar onder; de pill met totaal is onderdeel van de naam, niet los. Reduced motion: dorp verschijnt zonder schaal.

Data: stippentotaal = som van de stippen van aangrenzende getallen (13 = 3 + 5 + 5 in voorbeeld). Legale plekken uit de plaatsingscode (afstandsregel). Een eerdere zichtbare 7 stippen is voorbeeld.

### 5.4 Onboarding, stap 4 Havens

&#91;image: 5.4 Onboarding, stap 4 Havens (voorbeelddata)\]

Donker: zie mockup onb-4-360-dark.png

Doel: Een haven laten zien en dat een dorp ernaast goedkoper ruilt met de bank.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Ticker | "Dit is een haven" | h 44 |  |  |
| Bord | haven-badge "2:1" met baksteen gemarkeerd (accent ring), één plek ernaast |  | `--accent` ring | Niet tikbaar |
| Coachkaart | 4 van 5, "Havens", regel, visual "2 baksteen" ruil-icoon "1 hout" + tag "3:1" "elke kaart", "Sla over", "Volgende" |  |  |  |

Staten:

- Haven gemarkeerd; geen wacht-op-tik.

Teksten: "Dit is een haven", "4 van 5", "Havens", "Een dorp aan een haven ruilt goedkoper met de bank.", "2", "1", "3:1", "elke kaart", "Sla over", "Volgende"

Interactie:

1. Tik "Volgende": stap 5.
2. Tik "Sla over": coach sluit.

Toegankelijkheid: visual als zin: "2 baksteen voor 1 hout; zonder specifieke haven 3 voor 1". Reduced motion: statische ring.

Data: haventype en positie uit het bord (voorbeeld baksteen 2:1, 3:1 algemeen). Ruilkoersen zijn regelconstanten.

### 5.5 Onboarding, stap 5 Nu een weg

&#91;image: 5.5 Onboarding, stap 5 Nu een weg (voorbeelddata)\]

Donker: zie mockup onb-5-360-dark.png

Doel: De speler legt een weg bij zijn dorp en rondt de coach af met "Begrepen".

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Ticker | "Tik op een plek voor je weg", infoknop | h 44 |  |  |
| Bord | geplaatst rood dorp; drie stippellijnen als wegopties (pulserend) | tikdoel min 44 | `--p0` / accent | Tik legt de weg |
| Coachkaart | 5 van 5, "Nu een weg", regel, visual dorp > weg > dorp "dorp, weg, dorp, weg", "Terug", "Begrepen" |  |  | "Begrepen" actief na de tik |

Staten:

- Wacht op tik; na de tik dorp-weg zichtbaar en "Begrepen" actief.
- Na "Begrepen": bots plaatsen; coach is voorgoed uit na de eerste afgemaakte opstelling (Instellingen > Leren zet hem weer aan).
- Bekend probleem in de mockup: de stippellijnen liggen over de getalmunten 10 en 8 heen.

Teksten: "Tik op een plek voor je weg", "5 van 5", "Nu een weg", "Een weg begint bij je dorp. Tik een stippellijn.", "dorp, weg, dorp, weg", "Terug", "Begrepen"

Interactie:

1. Tik een stippellijn: weg verschijnt (scale-in langs de lijn, 200 ms).
2. Tik "Begrepen": coach sluit (slide omlaag 200 ms), bots zetten met de normale ticker.
3. Tik "Terug": naar stap 4.

Toegankelijkheid: wegopties `aria-label="Weg bij het dorp richting 10"`; focus na "Begrepen" naar de ticker. Reduced motion: fades.

Data: legale wegen uit de plaatsingscode (drie bij een hoekdorp). Kosten, de 7 en winnen worden niet hier maar in het spel geleerd (eerste bouwsheet, eerste 7, doel "10 punten" in de spelerskop).

### 6 Instellingen

&#91;image: 6 Instellingen (voorbeelddata)\]

Donker: zie mockup settings-360-dark.png

Doel: Alle voorkeuren in één gegroepeerde scroll met alledaagse dingen bovenaan en ontwikkelaarsitems onderaan.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| App bar | terugknop 44, "Instellingen" 20 | padding 12 12 8 | `--chrome` | Terug naar herkomst |
| Profiel | avatar 52, "Jij", "Je naam in spellen en reviews", knop "Wijzig" |  | `card` radius 16 | Wijzig opent naamkiezer |
| Uiterlijk | Kleuren (Auto, Licht, Donker) + regel; Thema (icoon, "Zonnig eiland", 4 kleurstippen 12, chevron); Tekstgrootte (Klein, Normaal, Groot) | rij 56 |  | Kleuren instant |
| Spel | Geluid (schakelaar); Snelheid van de bots (chip "Snel", chevron); Bouwen bevestigen (Altijd, Bij twijfel, Nooit); Taal (Auto, Nederlands, English) |  |  |  |
| Leren | Uitleg bij de opstelling (schakelaar, "Voor nieuwe spellen"); Hoe werkt Katan? ("Kaarten, rover, winnen", chevron); Tips in het spel (schakelaar) |  |  |  |
| Gegevens | Bewaar mijn gegevens ("Spellen, uitslagen en reeks als bestand") |  |  |  |
| Over | Versie 1.99 ("Alles is bijgewerkt", knop "Controleer"); AI Lab ("Voor nieuwsgierige spelers", chevron) |  |  | Ontwikkelaarsitems laatst |
| Groepskop | "UITERLIJK" enz. | 11.5/800 hoofdletters | `--ink-soft` |  |

Staten:

- Kleuren: Auto standaard voor iedereen zonder gekozen palette; Vivid, Dusk, "Tijd van de dag" onder "Meer kleurstanden" (Thema, buiten het scherm).
- Update beschikbaar: Controleer vervangt tekst door "Nu bijwerken" (voorstel).
- Donker: 360-dark-shot.

Teksten: "Instellingen", "Jij", "Je naam in spellen en reviews", "Wijzig", "Uiterlijk", "Kleuren", "Auto", "Licht", "Donker", "Auto volgt de donkere stand van je telefoon. Standaard voor iedereen die nog geen kleur koos.", "Thema", "Zonnig eiland", "Tekstgrootte", "Klein", "Normaal", "Groot", "Spel", "Geluid", "Snelheid van de bots", "Snel", "Bouwen bevestigen", "Altijd", "Bij twijfel", "Nooit", "Taal", "Nederlands", "English", "Leren", "Uitleg bij de opstelling", "Voor nieuwe spellen", "Hoe werkt Katan?", "Kaarten, rover, winnen", "Tips in het spel", "Gegevens", "Bewaar mijn gegevens", "Spellen, uitslagen en reeks als bestand", "Over", "Versie 1.99", "Alles is bijgewerkt", "Controleer", "AI Lab", "Voor nieuwsgierige spelers"

Interactie:

1. Tik een segment bij Kleuren: palette wisselt direct, crossfade 180 ms; `meta theme-color` volgt.
2. Tik de Geluid- of Leren-schakelaar: wisselt direct (150 ms).
3. Tik Thema: themakiezer (4 kaarten) schuift in (280 ms).
4. Tik "Controleer": zoekt een update, knop toont voortgang, toast "Alles is bijgewerkt".
5. Tik "Bewaar mijn gegevens": bestand wordt gedownload, toast "Bestand bewaard" (voorstel).
6. Tik Terug: terug naar de herkomst (Spelen of Pauze) met slide 280 ms.

Toegankelijkheid: Groepen als `<section>` met kopjes (`h2`); alle segmenten radiogroups, schakelaars `role="switch"`; Volgorde bovenaan naar onderaan; focus ring op rij. Taalwissel zet `lang` op de pagina. Reduced motion: geen crossfade.

Data: alle waarden uit de opgeslagen instellingen (`colonist.*`); "Zonnig eiland" uit de gekozen theme-id; versie uit de build ("1.99" = voorbeeld).

### 7 Pauze (menu in het spel)

&#91;image: 7 Pauze (menu in het spel) (voorbeelddata)\]

Donker: zie mockup ingame-menu-360-dark.png

Doel: Het enige menu in een spel: botsnelheid en vijf uitgangen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | titel "Pauze", sluitknop 44 | radius 22 | zie systeem 7 | Bord blijft zichtbaar achter de scrim |
| Botsnelheid | label "Bots" + chip "Gemiddeld"; rij "Snelheid van de bots" + segment "Traag" / "Snel" (150 breed) | rij 52 |  | Direct |
| Rijen | Uitleg ("Getallen, havens, rover"), Stand en statistieken ("Dobbelstenen, punten, inkomen"), Instellingen ("Geluid, kleuren, taal"), Nieuw spel ("Huidig spel wordt bewaard"), Naar start ("Je spel is bewaard") | rij 60, icoonvlak 40 | `--teal-soft` | Chevron rechts |

Staten:

- Alleen vanuit een spel; Naar start sluit het spel en bewaart het.
- Achter de sheet staat het spelscherm met de ticker "Jouw beurt: gooi de dobbelstenen"; de handkaarten (waaier, zie systeem 15) staan onder de scrim en zijn in de mock niet getekend.

Teksten: "Pauze", "Sluiten", "Bots", "Gemiddeld", "Snelheid van de bots", "Traag", "Snel", "Uitleg", "Getallen, havens, rover", "Stand en statistieken", "Dobbelstenen, punten, inkomen", "Instellingen", "Geluid, kleuren, taal", "Nieuw spel", "Huidig spel wordt bewaard", "Naar start", "Je spel is bewaard"

Interactie:

1. Tik het menu in het spel (dock): sheet opent 280 ms; het spel pauzeert voor bots.
2. Tik "Traag" of "Snel": bewaard voor alle spellen, 150 ms ring.
3. Tik "Uitleg": coach/uitleg opent, sheet sluit.
4. Tik "Stand en statistieken": stand-sheet; "Instellingen": 6 (Terug komt hier terug).
5. Tik "Nieuw spel": 4.1 opent, huidig spel blijft bewaard.
6. Tik "Naar start": naar Spelen (fade 200 ms), rij Verder spelen zichtbaar.
7. X, scrim, veeg omlaag of Terug-gebaar: sluit (200 ms), spel hervat.

Toegankelijkheid: `role="dialog"`, focus op de titel; segment radiogroup; rijen `<button>` met titel + regel. Reduced motion: fade.

Data: niveau-chip uit de spelinstelling (Gemiddeld = voorbeeld). Snelheid uit de instellingen. Zinnen "Huidig spel wordt bewaard" zijn vast.

### 8 Navigatiemodel

&#91;image: 8 Navigatiemodel (voorbeelddata)\]

Donker: zie mockup navigation-360-dark.png

Volledig: home/shots-v2/navigation.png

Niveaus en regels:

| Niveau | Schermen | Tabbalk | Terugpijl | Tandwiel |
| --- | --- | --- | --- | --- |
| 1 (tab-roots) | Spelen, Dagpuzzel, Terugblik, Bots | zichtbaar | nee | ja |
| 2 (geduwd) | Review, les, botprofiel, Mijn dagen/Alle dagen, Vergelijk, uitslag, Instellingen | verborgen | ja | nee |
| Laag | sheets (Nieuw spel, Meer regels, Pauze, kaart-sheet), toasts, coach | blijft (sheet bedekt hem) | X of Terug |  |
| Spel | spelscherm met dock | verborgen | Pauze-sheet | via Pauze |

Terug-stapel:

| Van | Terug gaat naar |
| --- | --- |
| Review | Eindscherm, dan tab Spelen |
| Review van een dag | Dagpuzzel-uitslag, dan tab Dagpuzzel |
| Dagpuzzel-uitslag | Tab Dagpuzzel |
| Review via de Review-knop in Mijn dagen | De lijst Mijn dagen |
| Tab-roots | geen pijl |
| Eindscherm na spel 1 | Primair = Review, daarna Revanche |
| Instellingen | herkomst (tab of Pauze) |

Stroom (optie A, aanbevolen): Spelen > Nieuw spel (sheet) > Spel; Dagpuzzel (tab) > spelen > Uitslag > terug Dagpuzzel; Terugblik > Spellen of Lessen > Review > Bekijk bord; Bots > Ranglijst > Botprofiel. Optie B (hub zonder tabbalk, `home/home-b-v2.html`, shots `home/shots-v2/home-b-360.png`) blijft vangnet.

Interactie:

1. Tab-tik: wisselt zonder animatie, geen history-ingang; scrolt naar boven bij tik op actieve tab.
2. Push naar niveau 2: slide van rechts 280 ms, tabbalk verdwijnt; Terug: slide terug 280 ms.
3. Sheet: schuift omhoog 280 ms; stapelt op de `nav.js` laag-stack; Terug-gebaar sluit de bovenste laag.
4. Spel: geen tabbalk; Pauze is de enige launcher; Terug-gebaar in een spel opent Pauze (voorstel).

Toegankelijkheid: tabbalk `<nav aria-label="Hoofdmenu">` met `aria-current`; focus na pushen op de kop `h1`; na terug op de trigger. Reduced motion: slides worden fades 120 ms.

Data: stack in `nav.js` (laag-stack); woorden zijn vast: Terugblik = sectie, Review = analyse van een spel, Bekijk bord = replay, Dagpuzzel = tab en modus, Precisie, reeks, uitslag, punten.
