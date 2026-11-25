# Katan: UI/UX-ontwerp hele app

Nov 24, 2026 · @Tijs

## Samenvatting

De app krijgt een tabbalk met vier onderdelen (Spelen, Dagpuzzel, Terugblik, Bots), één scherm voor een nieuw spel, een coach tijdens de eerste opbouw, rustigere spel- en reviewschermen en een nieuwe modus: de Dagpuzzel.

Dit ontwerp komt van vier ontwerp-agents en één onafhankelijke beoordelaar. De eerste versie kreeg een 7, vooral door tegenstrijdigheden tussen de delen. Versie 2 lost die op in alle vier de delen en kreeg een 8 (startscherm 9, spel 8, na het spel 8, Dagpuzzel 8, ontwerpsysteem 8). De laatste kleine punten zijn verwerkt: één Dagpuzzel-kaart overal, de reeks in goud in plaats van roestrood, geen Slimme bot-regel bij verlies, filters op één rij, en de Review-link vanaf de Dagpuzzel.

Advies: bouw in drie releases. Eerst de basis en het na-het-spel (v1.99), dan de spelschermen en de coach (v2.0), dan de Dagpuzzel (v2.1), omdat die het grootste technische risico draagt.

Alle getallen in de mockups zijn voorbeelddata. Mockups staan in de scratchpad onder design199; screenshots zijn 360×780 en 412×923.

## Ontwerpregels

Deze regels gelden voor elk scherm; een mockup die er een breekt, wordt aangepast.

1. **Taal:** Nederlands. Zeg punten (nooit VP), dorp, stad, weg, haven, rover; grondstoffen hout, baksteen, wol, graan, erts. Geen em-dash.
2. **Groen en rood voor plus en min, bij alle spelers (besluit 24 nov).** Altijd met ▲▼ ernaast. Puntenbalken krijgen de stoelkleur van de speler (kleur = wie). Geluk staat als winkans ("Geluk −12%"), niet in kaarten. Precisie en Geluk staan bij alle spelers.
3. **Beeld eerst:** hooguit 2 korte regels tekst per onderdeel. Liever icoon, getal, avatar, stippen of dobbelsteen dan een zin.
4. **Getallen alleen uit app-data.** Mockups gebruiken voorbeelddata en zeggen dat.
5. **Formaat:** werkt op 360×780 (Galaxy S24) en 412×923 (Pixel 9) zonder horizontaal scrollen. Tikdoelen minstens 44×44 px, tekst minstens 11,5 px.
6. **Stijl houden:** huidige thema Zonnig eiland, avatars en grondstofkunst blijven.
7. **Eén woord per ding:** Precisie (nooit Nauwkeurigheid), Terugblik = onderdeel met potjes en lessen, Review = analyse van één potje, Bekijk bord = potje terugkijken.
8. **Eén hoofdknop per scherm,** onderin binnen duimbereik.

## Ontwerpsysteem

Het systeem neemt de bestaande kleuren over, maakt de tekst groter en legt elke kleur op contrast vast (gemeten, WCAG).

### Kleuren per speler

| Stoel | Kleur | Gebruik |
| --- | --- | --- |
| Jij | #B81E2E (tekst #A01D18) | stoel en de enige plek voor groen/rood als betekenis |
| Blaauw | #3C75C6 | alleen stoelkleur |
| Geelen | #F08A2E | alleen stoelkleur |
| Groen | #1E9E8E (blauwgroen) | alleen stoelkleur, nooit als "goed" |
| De Wit | #EFE7D4, rand #8A7F66 | alleen stoelkleur |
| Pimpel | #5A2C88 | alleen stoelkleur |

### Overige kleuren

| Rol | Licht | Donker |
| --- | --- | --- |
| Pagina | #F7F2E8 | #0E1B22 |
| Kaart, sheet | #FDFBF6 | #172630 |
| Tekst | #2E3A3D | #E4ECEC |
| Hoofdknop | #1F5F66 | #26706F |
| Accent (selectie, reeks, stip) | #D9714E | #F0B45C |
| Goud (alleen Dagpuzzel) | #FBE9C9 | #2A2418 |
| Goed (alleen Jij, tekst) | #3A7324 | #6CC68E |

Alle tekstkleuren halen minstens 4,5:1. De laagste: lichte tekst op pagina 4,54. Witte tekst op de zee-achtergrond haalt maar 3,28:1 en mag daarom alleen voor grote titels; kleine labels op zee krijgen een donker pilletje.

### Letters en maten

| Rol | Grootte | Was |
| --- | --- | --- |
| Schermtitel | 26 Outfit | 24 |
| Kaarttitel | 20 tot 22 Outfit | 18 |
| Lijsttitel, knop | 16 Figtree | 15 |
| Tekst | 14 | 13 |
| Klein | 12,5 | 11,5 |
| Label, tab, chip | 11,5 | 10 |

Raster van 4 px, zijmarge 16, kaarten met hoek 20, sheets met hoek 22. Knoppen minstens 48 hoog.

### Onderdelen

- **Tabbalk:** 4 items, 56 hoog, alleen op het hoofdniveau; stip op Dagpuzzel tot je hem vandaag speelde.
- **Sheet van onderen:** grijpgreep, titel, sluitknop, vaste voet met de ene hoofdknop.
- **Coachkaart:** niet-blokkerende kaart boven het dock met stippen voor voortgang, één regel en één beeld.
- **Toast:** donker, 1 regel, 3 seconden, boven tabbalk of dock.
- **Getalfiche met stippen:** dezelfde in bord, onboarding en review.
- **Iconen:** één lijnset (24 px, lijn 2 px); nieuw zijn onder meer zon (reeks) en kalender.

### Donkere modus

Iedereen die nooit zelf een kleur koos, volgt het systeem. Bestaande spelers krijgen één melding: "Kleuren volgen je telefoon." met Wijzig.

## Structuur en navigatie

Advies: een tabbalk met vier onderdelen (variant A). Alles is met één tik te vinden en de Dagpuzzel blijft zichtbaar; het kost 64 px, alleen buiten een potje.

|  | A: tabbalk | B: tegels |
| --- | --- | --- |
| Indeling | Spelen, Dagpuzzel, Terugblik, Bots onderin; tandwiel rechtsboven | Eén startscherm met tegels; tandwiel rechtsboven |
| Dagpuzzel | Eigen tab met stip + kaart op Spelen | Alleen kaart op start |
| Wisselen | 1 tik vanaf elk hoofdscherm | Eerst terug naar start |
| Ruimte | 64 px balk | geen |
| Risico | Labels moeten kort (past: Dagpuzzel is de langste) | Start groeit weer dicht |

### Niveaus

1. **Hoofdniveau** (Spelen, Dagpuzzel, Terugblik, Bots): tabbalk en tandwiel, geen terugpijl.
2. **Doorklik** (review, les, botprofiel, Mijn dagen, Vergelijk, uitslag): terugpijl, geen tabbalk.
3. **In een potje:** geen tabbalk; het dock blijft; de Pauze-sheet is de enige ingang (Uitleg, Stand, Instellingen, Nieuw spel, Naar start).

### Spelen (startscherm)

- **Verder spelen:** één compacte rij, alleen als er een normaal potje bewaard is.
- **Dagpuzzel-kaart:** goud, datum (di 24 nov), reeks met zon, Jij tegen Blaauw en Geelen, een bordje als plaatje, nooit worpen vooraf. Staten: niet gespeeld, bezig (Verder, Beurt 7 van 40), klaar met winst, klaar met verlies.
- **Nieuw spel:** laatst gebruikte instellingen als chips, Start spel, en Aanpassen.

Alles past zonder scrollen op 360×780.

&#91;image: Startscherm Spelen met Dagpuzzel-kaart en tabbalk (voorbeelddata)\]

### Nieuw spel

Eén sheet vervangt de keuzes op het startscherm en het lange scherm Regels en opties. Volgorde: soort spel, tegenstanders (tik op avatars, 1 tot 5), niveau, kaart, uitleg aan/uit, en Meer regels voor punten om te winnen, dobbelstenen, kaartverdeling, rover en spelen met een vriend op deze telefoon.

### Instellingen

Eén scroll in 5 groepen: Uiterlijk, Spel, Leren, Gegevens, Over. Kleuren: Automatisch (standaard), Licht, Donker. AI Lab en ontwikkelaarsopties staan onderaan onder Over.

### Pauze in een potje

Van 9 rijen en 3 knoppen naar botsnelheid plus 5 rijen.

## Eerste keer spelen

Beginners leren de opbouw tijdens hun eerste potje via een coach van 5 stappen, in plaats van 3 losse uitlegkaarten vooraf.

Nieuwe spelers zien op Spelen één grote kaart "Je eerste spel" (makkelijke bots, 10 punten, uitleg aan). De Dagpuzzel staat er klein onder, met de zachte drempel "Speel eerst één oefenpotje" en een tweede knop "Toch spelen".

### De coach tijdens de opbouw

1. **Zo begint het:** de volgorde 1 tot 4 en terug 4 tot 1, met avatars; ieder legt 2 dorpen en 2 wegen.
2. **Getallen en stippen:** de getallen op het bord lichten op; een strook 2 tot 12 toont de stippen (6 en 8 rood, de 7 toont de rover). Regel in één zin: valt dat getal, dan levert die tegel.
3. **Kies je eerste dorp:** elke plek toont zijn stippen-totaal (bijvoorbeeld 13 tegen 7). Jij tikt; pas daarna verschijnt Volgende.
4. **Havens:** een haven licht op met een plek ernaast; 2 baksteen = 1 kaart, 3:1 elke kaart.
5. **Nu een weg:** de 3 mogelijke wegen pulseren; jij tikt er een. Klaar met Begrepen.

&#91;image: Coach stap 3: kies je eerste dorp (voorbeelddata)\]

Sla over kan altijd. De coach zet zichzelf uit na de eerste afgemaakte opbouw; Instellingen › Leren zet hem weer aan.

### Uitleg op het moment zelf

- Bouwkosten verschijnen bij je eerste bouwsheet.
- De rover wordt uitgelegd bij de eerste 7.
- Het doel (10 punten) staat in de spelersstrook.
- Tik op een getal: je ziet in hoeveel van de 36 worpen het valt en wie er kaarten krijgt.
- Tik op een haven: je ziet 4:1, 3:1 of 2:1 en of jij hem hebt.
- Bij je eerste opbouw krijgen goede plekken een ring.

## Tijdens het spel

Het bord en de stijl blijven; de bediening wordt vaste knoppen onderin, keuzes gebeuren op het bord zelf, en wachten op bots wordt korter en leesbaarder.

### Opbouw van het scherm

Van boven naar onder: spelerskaarten (avatar, punten, kaarten, winkans), een beurtbalk (wie, wat nu, stappen gooien/bouwen/einde), het bord met Pauze en zoom, je kaarten, en het dock.

### Actiebalk

|  | A: vier vaste knoppen | B: twee lagen |
| --- | --- | --- |
| Vorm | Bouwen, Kaart, Ruilen + grote hoofdknop | Volle-breedte hoofdknop met een laag erboven |
| Hoofdknop | Gooi, dan Einde beurt met de avatar van wie na jou komt | idem |
| Voordeel | Altijd op dezelfde plek, duimbereik | Grotere hoofdknop |

Advies: A. Tik je Einde beurt terwijl je nog iets kunt bouwen, dan vraagt een klein venster "Je kunt nog bouwen". "Klaar" verdwijnt overal.

&#91;image: Spelscherm met actiebalk A (voorbeelddata)\]

### Rover en stelen

Advies: kies het slachtoffer met een ballon op het bord, bij de tegel (2 tikken, de rest gedimd, het geblokkeerde getal zichtbaar). Bij een ver of ingezoomd bord valt hij terug op een sheet met een stippellijn naar de tegel.

&#91;image: Rover zetten op het bord (voorbeelddata)\]

### Afleggen bij een 7

Je ziet hoeveel je moet afleggen, de kaarten die je teruggeeft staan apart, en de strook toont wie er nog moet afleggen.

### Winkans

Advies: het percentage staat in de kaart van elke speler, dus namen komen vanzelf mee en niets overlapt. Het getal verandert hooguit één keer per beurt of bij een sprong van 3 punten. Tik erop voor een sheet met namen, het verloop en de kleine lettertjes (400 simulaties, geen belofte).

### Wachten op bots

- De beurtbalk toont welke bot speelt, met iconen van wat hij doet.
- Het dock toont de volgorde en een knop Sla over.
- Na elke bot een samenvatting van 1,5 s; na een snelle ronde één kaart "Dit gebeurde".
- Het logboek is per beurt gegroepeerd, met iconen.
- Sla over beantwoordt nooit een ruilaanbod; een aanbod van een bot verloopt zichtbaar na 8 s.

Doel: een botronde op Snel duurt 6 tot 8 s in plaats van de gemeten 16 tot 32 s.

### Bouwen, ruilen en kaarten

- Bouwsheet met kosten in grondstofkunst.
- Ruilen: bank en havens met de beste koers vooraan; antwoorden van bots in neutrale kleuren, nooit groen of rood.
- Ontwikkelkaarten met volledige namen, niet afgekapt.

### Varianten

- **Snelspel:** klaar-stippen in neutrale kleuren, het eigen woord "Klaar voor de worp".
- **Zeevaarders:** bouwen of schip met dezelfde vaste knoppen.
- **5-6 spelers:** compactere spelerskaarten.
- **Op één telefoon:** wisselscherm tussen spelers.
- **Dagpuzzel:** hetzelfde scherm met een strookje "Beurt 7 van 40".

## Na het spel

Eerst de uitslag, dan pas analyse; geen opgetelde procenten meer, één woord per begrip, en de lessen zijn vanaf vier plekken te vinden.

### Eindscherm (advies: variant A)

- Bovenaan: winnaar, punten, beurten en speelduur.
- Per speler: plaats, avatar, grote punten en een balk waar die punten vandaan komen (dorpen, steden, weg, kaarten) in neutrale tinten met iconen, geen stoelkleuren.
- Precisie en Geluk staan alleen op jouw rij; die van bots zie je op hun spelerspagina.
- Geluk telt in kaarten met ▲ of ▼, neutraal.
- Onderin: Review (met "klaar" of een voortgangsring) en Revanche. Na je allereerste potje is Review de hoofdknop.

&#91;image: Eindscherm A (voorbeelddata)\]

### Review (advies: variant A, eerst het oordeel)

1. Precisie als groot getal, met de band waarin bots meestal scoren.
2. Drie tegels: Start, Geluk, Keuzes.
3. Drie sleutelmomenten; tik om ze op het bord te zien.
4. Jouw les.
5. Compacte spelerstabel.

De 5 tabbladen blijven (Overzicht, Winkans, Geluk, Zetten, AI). De opgetelde rijen ("De anderen +112%") verdwijnen. Fouten heten alleen nog Kon beter of Misser.

&#91;image: Review-overzicht A (voorbeelddata)\]

### Analyseren

Echte voortgang ("Zet 9 van 25") in drie stappen, geen afteltijd, en een streepje in plaats van een getal dat nog verandert. Bij een fout: een melding met Opnieuw.

### Lessen

- Kop: "Uit je 5 beoordeelde potjes".
- Per les één balk per potje met een gemiddelde, nooit een optelsom.
- De uitleg zit achter de (i), niet als voetnoot van 4 regels.
- Een lege stand legt uit hoe je lessen krijgt.
- Ingangen: eindscherm, review, Terugblik en Spelen.

### Terugblik

Een tab met twee delen: Spellen en Lessen. Elk potje heeft twee knoppen: Review en Bekijk bord. Een chip "Dagpuzzel" verwijst naar de Dagpuzzel-tab.

### Bots

Een ladder met een rij "Jij"; de andere weergaven worden segmenten. Onderschrift: "Winst in 100 spellen".

## Dagpuzzel

Elke dag speelt iedereen hetzelfde bord met dezelfde worpen tegen twee vaste bots; je score deel je als korte code, zonder server. Haalbaar, maar het risico zit in de techniek (zie Risico's).

### Spelregels v1

- Jij tegen Blaauw (gemiddeld) en Geelen (simpel); keuze wordt bevestigd met een meting van 300 potjes.
- Ruilen alleen met de bank en havens; ontwikkelkaarten mogen; geen ongedaan maken.
- Maximaal 40 beurten; één telde poging per dag; een potje hoort bij de dag waarop het begon.
- Snelspel en Zeevaarders doen niet mee.

### Zelfde worpen voor iedereen

- Het bord komt uit een vooraf gekeurde lijst per dag (eerlijke startplekken, normale worpen, normale lengte).
- De worpen staan vast per worp-nummer: iedereen krijgt bij worp 12 hetzelfde paar, wat je ook bouwt.
- Een 7 valt voor iedereen op dezelfde worp. Wat je steelt kan verschillen, maar is even eerlijk verdeeld.
- Ontwikkelkaarten: elke stoel heeft een eigen stapel, dus jouw derde kaart is voor iedereen dezelfde.
- De dag volgt Nederlandse tijd. Alles werkt offline; een onderbroken potje gaat verder waar het was.

### Score

- Win je: het aantal beurten tot 10 punten (minder is beter).
- Verlies je: je punten op het moment dat een bot wint.
- Elke winst gaat boven elk verlies.
- Na een winst: "Slimme bot: 19 beurten" (de Expert-bot op jouw plek, op dit bord). Pas zichtbaar als je klaar bent.
- Reeks: een zon in goud met het aantal dagen dat je speelde, winst of verlies; geen bevriezing.

Voorbeeld (voorbeelddata): gewonnen in 17 beurten, Slimme bot 19 beurten, dus 2 sneller.

### Delen

- Code: KD1-3QM7-2R9X-HT6B (versie, dag, uitslag, controlesom). Wie een cijfer verandert, maakt de code ongeldig.
- Deeltekst: datum in plaats van een nummer, een paar spel-emoji, één regel met punten, de code en een link. Geen rijen blokjes, zodat het niet op een bekend woordspel lijkt.
- Een vriend plakt je code of tikt de link en ziet beide uitslagen naast elkaar.
- Een langer bewijs (je zetten, nagespeeld op het toestel) komt pas na een test of iPhone en Android precies gelijk rekenen.

Deeltekst bij winst (voorbeelddata); bij verlies wordt regel 2 "Verloren met 8 punten (slimme bot: 19)":

```
Katan Dagpuzzel, di 24 nov
🏆 Gewonnen in 17 beurten (slimme bot: 19)
🏠🏠🏠🏠 🏙🏙 🛣️
Oogst 🌲6 🧱4 🐑3 🌾5 ⛰️2
Jij 10 · Blaauw 7 · Geelen 4 punten
Code KD1-3QM7-2R9X-HT6B
Sneller dan ik? https://tteulings.github.io/Colonist/#dag=KD1-3QM7-2R9X-HT6B
```

De regel Oogst telt de kaarten die jij uit worpen kreeg; daarvoor komt een kleine teller in de opgeslagen gegevens. Op Android ouder dan versie 9 toont 🧱 een leeg vakje (niet getest op een echt toestel).

### Schermen

1. Dagpuzzel-tab: kaart van vandaag, Mijn dagen (week en lijst), Vergelijk.
2. Intro-sheet: één beeld, hooguit 2 regels, geen worpen.
3. Spelen: het gewone spelscherm met een strookje "Beurt 7 van 40".
4. Uitslag: groot getal beurten in inktkleur (niet rood), Gewonnen of Verloren, Slimme bot, reeks, en de knoppen Deel, Vergelijk en Review.
5. Vergelijken met een vriend, ook bij een ongeldige code of een andere dag.
6. Al gespeeld vandaag, offline, verder na onderbreking.

&#91;image: Dagpuzzel tijdens het spel: strook Beurt 7 van 40 (voorbeelddata)\]

&#91;image: Dagpuzzel-uitslag bij winst (voorbeelddata)\]

### Risico's

1. **Andere telefoons:** iPhone en Android moeten exact gelijk rekenen; testen op een echte iPhone. Terugval: alleen de code met controlesom.
2. **Botroute:** de Dagpuzzel heeft de nieuwe botroute nodig in de app; die mag nu aan (zie Snelheid).
3. **Updates:** een nieuwe botversie mag oude codes niet breken, dus de Dagpuzzel draait op vaste spelregels.
4. **Voordeel van de eerste plek** en verschil per dag: opgevangen door de vooraf gekeurde borden.

## Toestanden

Elk scherm heeft naast de normale stand ook een lege, ladende, offline en fout-stand, plus een donkere versie.

| Toestand | Waar | Wat je ziet |
| --- | --- | --- |
| Leeg | Terugblik | Uitleg hoe je potjes en lessen krijgt, knop naar Spelen |
| Laden | Review | Voortgang in stappen, streepjes in plaats van getallen |
| Offline | Spelen, AI-tab, Dagpuzzel | Banner bovenin; spelen kan, de AI-tab wacht |
| Fout | Review, eindscherm | Melding met Opnieuw |
| Verder na crash | Spelen | Rij "Verder spelen" met beurt en spelers |
| Al gespeeld | Dagpuzzel | Uitslag van vandaag en aftellen naar morgen |
| Ongeldige code | Vergelijk | Uitleg en de vraag om opnieuw te plakken |
| Donker | Alle schermen | Nachtkleuren; volgt de telefoon |

Nog open: het bord zelf in donkere modus, en hoe het spelscherm eruitziet direct na een crash.

## Snelheid

De bots zijn niet de oorzaak van trage botrondes: hun denkwerk is 0,3 tot 0,7% van de speeltijd. De tijd zit in animaties en tekenwerk, en daar richt het spelontwerp zich op.

### Gemeten in de app (360 px, Snel, hele potjes, n=3)

| Meting | Oude botroute | Nieuwe botroute | Verschil |
| --- | --- | --- | --- |
| Denktijd bots per potje, 4× trager toestel | 1,3 s | 1,5 s | +14% |
| Hele botbeurt, 4× trager | 486 ms | 501 ms | +3% |
| Duur heel potje, 4× trager | 177 s | 177 s | 0% |
| Botronde, gewone telefoon | 8,5 s | 8,1 s | binnen de ruis |

### Waar de tijd zit (profiel op 4× trager toestel)

- Effecten tekenen (fx.js): 18%.
- Logboek verversen: 10%.
- Dobbelanimatie met wachten: 5 keer het denkwerk van de bots.
- Denkwerk bots: 0,6%.

Op Snel duurde een botronde in de ontwerptest 16 tot 32 s, deels door de 8 s die een ruilaanbod op je wacht.

### Gevolgen voor het ontwerp

1. De nieuwe botroute mag in de app standaard aan; de Dagpuzzel heeft hem nodig.
2. Doel 6 tot 8 s per botronde: minder en kortere animaties, logboek per beurt in plaats van per regel verversen, samenvatting na de ronde.
3. Zonder scherm is de nieuwe route 30 tot 47% trager (dubbel rekenwerk); dat raakt alleen toernooien en blijft liggen.

## Beslissingen en open vragen

Tien vragen zijn voorlopig beslist met het advies van de beoordelaar, zodat het werk doorloopt; jij kunt elk ervan omgooien.

| # | Vraag | Voorlopige keuze |
| --- | --- | --- |
| 1 | Groene stoel (Groen) naast de regel "groen alleen voor Jij" | Stoel blijft, blauwgroen #1E9E8E, nooit als betekenis |
| 2 | Dagpuzzel als eigen tab of alleen kaart | Eigen tab plus kaart op Spelen |
| 3 | Dagpuzzel voor beginners | Zachte drempel: eerst een oefenpotje, "Toch spelen" kan |
| 4 | Welke twee bots | Blaauw (gemiddeld) + Geelen (simpel), na meting van 300 potjes: goede speler wint 40 tot 60% |
| 5 | Regels Dagpuzzel | Bank en havens, ontwikkelkaarten, geen ongedaan maken, 40 beurten, 1 poging per dag |
| 6 | Reeks | Elke gespeelde dag telt, ook bij verlies; geen bevriezing |
| 7 | Deelcode | Eerst alleen code met controlesom; bewijs na de iPhone-test |
| 8 | Woorden | Score = beurten; maatstaf "Slimme bot"; Precisie; Dagpuzzel-review voedt Lessen niet |
| 9 | Automatisch donker voor bestaande spelers | Ja, voor wie nooit koos, met één melding |
| 10 | Spelen op één telefoon, Sla over, zoom | Onder Meer regels; Sla over beantwoordt nooit een aanbod; zoomknop plus knijpen |

### Nog niet beslist

- Tabbalk (A) of tegels (B) op het startscherm. Advies: A.
- Coach-ringen rond goede plekken: alleen in het eerste potje, of altijd voor beginners. Advies: alleen het eerste potje, daarna via Instellingen.
- De naam "Katan" is het grootste risico vóór een publieke release (geen juridisch advies).

## Bouwvolgorde en releases

Advies: drie releases, met de Dagpuzzel als laatste omdat die het grootste technische risico draagt. Fase 0 (alle tegenstrijdigheden op papier oplossen) loopt nu.

&#91;embedded content: bouwvolgorde · 3 releases, 8 fasen\]

Elke release gaat pas live na de volledige testronde en een beoordeling van minstens een 8.

## Schermkaart

Vier tabs vormen de wortels van de app; het tandwiel opent Instellingen vanaf elke tab.

&#91;embedded content: schermkaart · 4 tabs, navigatie tot Review en Lessen\]

Elk potje, elke dagpuzzel en elk spel in Terugblik komt uit bij hetzelfde Review-scherm; Mijn dagen hangt rechtstreeks onder de tab Dagpuzzel.

## Galerij

De vier contactbladen tonen alle schermen per gebied in licht, met voorbeelddata.

&#91;image: Contactblad Start en navigatie (voorbeelddata)\]

Start en navigatie: de spec staat in de tab Start en navigatie.

&#91;image: Contactblad Tijdens het spel (voorbeelddata)\]

Tijdens het spel: de spec staat in de tab Tijdens het spel.

&#91;image: Contactblad Na het spel (voorbeelddata)\]

Na het spel: de spec staat in de tab Na het spel.

&#91;image: Contactblad Dagpuzzel (voorbeelddata)\]

Dagpuzzel: de spec staat in de tab Dagpuzzel.
