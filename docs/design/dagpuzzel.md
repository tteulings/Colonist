# Katan PWA: bouwspecs Dagpuzzel

Dit document beschrijft de Dagpuzzel (elke dag hetzelfde bord en dezelfde worpen voor iedereen, jij tegen Blaauw en Geelen) als build-klare specificatie: eerst een korte "Werking" (regels, score, dobbelsteenschema, code, deeltekst, opslag), daarna 26 schermen. Bronnen: `daily/spec.md` (v2), `daily/design.md`, de mocks `daily/*-v2.html` en screenshots `daily/shots-v2/`, aangevuld met de Dagpuzzel-tab van `home/dagtab-v2.html` (ontwerp van de home-ontwerper) en de run uit `game/mock/10-dagpuzzel-run.html`. Maten (px) zijn gemeten in de mocks op 360 breed; "(voorstel)" betekent niet in een mock. Alle getallen in de mocks zijn voorbeelddata. Er bestaat nog geen Dagpuzzel in de app: "Data" noemt waar een getal vandaan moet komen (nieuw `src/daily.js`, zie Werking) en welke bestaande code het hergebruikt. Iconen: huidige app (`src/ui-icons.js`) wint, zie "Iconen".

## Index

| Nr | Scherm | Mock |
| --- | --- | --- |
| D01 | Dagpuzzel-kaart (4 staten) | 01-home-cards |
| D02 | Dagpuzzel-tab, nog niet gespeeld | home/dagtab |
| D03 | Dagpuzzel-tab, klaar | home/dagtab-done |
| D04 | Intro-sheet | 02-intro-sheet |
| D05 | Intro-sheet met poort (eerste keer) | 02b-intro-gate |
| D06 | Run met Dagpuzzel-strip | 03-run (game) |
| D07 | Uitslag gewonnen | 04a-result-win |
| D08 | Uitslag verloren | 04a-result-loss |
| D09 | Uitslag tijd op | 04a-result-tijdop |
| D10 | Uitslag, slimme bot rekent | 04a-result-rekent |
| D11 | Delen na winst | 05-share |
| D12 | Delen na verlies | 05b-share-loss |
| D13 | Delen, gekopieerd | 05c-share-gekopieerd |
| D14 | Delen, offline | 05d-share-offline |
| D15 | Mijn dagen | 06-mijn-dagen |
| D16 | Mijn dagen leeg | 06b-mijn-dagen-leeg |
| D17 | Vergelijk, uitslag | 07a-vergelijk-uitslag |
| D18 | Vergelijk, plakken | 07b-vergelijk-plakken |
| D19 | Vergelijk, code fout | 07c-vergelijk-fout |
| D20 | Vergelijk, andere dag | 07d-vergelijk-andere-dag |
| D21 | Vergelijk, eerst spelen | 07e-vergelijk-eerst-spelen |
| D22 | Dagpuzzel offline | 08a-offline |
| D23 | Al gespeeld vandaag | 08b-al-gespeeld |
| D24 | Afmaken (run van gisteren) | 08c-hervatten-gisteren |
| D25 | Update tijdens run | 08d-update-tijdens-run |
| D26 | Link `#dag=` voor nieuwe speler | 09-dag-landing |
| D27 | Delen zonder deelmenu (kopieer) | 05e-share-kopieer |
| D28 | Mijn dagen, andere maand | 06c-mijn-dagen-maand |
| D29 | Vergelijk, gelijkspel | 07f-vergelijk-gelijk |
| D30 | Wegdoen bevestigen | 08e-wegdoen-bevestig |
|  | Hoofdstukken: Werking, Gedeelde onderdelen, Iconen, Gaten en tegenstrijdigheden |  |

## Werking (condensed uit spec.md)

**Regels.** Eén puzzel per dag; dag-id = dagen sinds 2026-01-01 + 1 (24 nov 2026 = 328), alleen intern, de UI toont altijd de datum ("di 24 nov"). Zelfde bord, worpen en ontwikkelkaartvolgorde voor iedereen; geen worpwaarde zichtbaar voor of tijdens de run buiten de worpen die je zelf gooit. Klassieke regels, 3 zetels: Jij (zetel 0, begint), Blaauw (gemiddeld), Geelen (simpel); gebalanceerd bord, 10 punten wint, geen Zeevaarders, geen Rush. Ruilen alleen met bank en havens. Eén poging per dag; geen ongedaan maken; stoppen = pauze; "Opgeven" = verlies. Limiet 40 eigen beurten, daarna "Tijd op". Eerdere dagen en vandaag na afloop kun je oefenen (geen score, geen reeks).

**Score.** Gewonnen: resultaat = eigen beurten bij 10 punten (minder is beter), "Gewonnen in 17 beurten". Verloren: resultaat = eigen punten wanneer een bot wint (meer is beter), "Verloren met 8 punten". Rangorde: elke winst verslaat elk verlies; winst: minste beurten; verlies: meeste punten, daarna latere beurt van de botwinst. Geen geluk-correctie. "Slimme bot" = zelfde dag door `REFERENCE_BOT = "expert"` op zetel 0 op het toestel (headless, worker, gecachet per dag); zichtbaar pas na afloop en alleen bij winst ("Slimme bot: 19 beurten"; chip "2 sneller" als je sneller won, `good`, alleen Jij). Bot verliest zelf: "Slimme bot: verloren".

**Dobbelsteenschema en seed.** Dagkey = datum in `Europe/Amsterdam`. Seeds vooraf gecontroleerd in `src/daily-seeds.js` (400 dagen, `scripts/daily-seeds.mjs`; filter: gebalanceerd bord, beste openingsplek >= 10 pips en zetel 0 binnen 20% van de bots, <= 1 zeven in de eerste 6 worpen en 2 tot 4 in de eerste 18, slimme-bot-run 14 tot 32 beurten). Worpen: lijst D\[k\] uit de dagseed (aaneengeschakelde geschudde 36-kaartstapels), k = k-de `rollDice`; geen `Math.random`. Zeven en diefstal: zelfde moment voor iedereen, uitkomst volgens eigen hand (stroom U\[n\]). Ontwikkelkaarten: één stapel per zetel (P\_s), jouw n-de koop is voor iedereen dezelfde kaart. Bots beslissen deterministisch (`mulberry32(hash(dag, stap))`, `host.rng(seat)`). Hooks: `game.js rollDice`/`_doSteal`, per-zetel `devDeck`, `bots/inapp.js`, `api/headless.js bootHeadless`, `engine.js replay`/`stateHash`.

**Code.** `KD1-XXXX-XXXX-XXXX` (3 groepen van 4, hoofdletters, 12 Crockford-base32-tekens = 60 bit), voorbeeld `KD1-3QM7-2R9X-HT6B`. Velden (33 bit): versie 2, dag 12, win 1, beurten 6 (1..40), punten Jij/Blaauw/Geelen 4+4+4; checksum 27 bit (xmur3/FNV met zout "katan-dag-v1"). Alles (deeltekst, Vergelijk, balken) volgt uit de code. Fout cijfer: "Deze code klopt niet". Badge alleen "Code klopt" (het bewijs "KDP1." komt pas na een cross-device-determinismetest, niet in v1 van de UI). Link: `https://<app-adres>/#dag=KD1-3QM7-2R9X-HT6B` (hash komt niet op de server).

**Deeltekst** (zeven regels, ca. 230 tekens, geen blokglyphs):

```
Katan Dagpuzzel, di 24 nov
🏆 Gewonnen in 17 beurten (slimme bot: 19)
🏠🏠🏠🏠 🏙🏙 🛣️
Oogst 🌲6 🧱4 🐑3 🌾5 ⛰️2
Jij 10 · Blaauw 7 · Geelen 4 punten
Code KD1-3QM7-2R9X-HT6B
Sneller dan ik? https://<app-adres>/#dag=KD1-3QM7-2R9X-HT6B
```

Verlies: `🎲 Verloren met 8 punten`. Tijd op: `⏳ Tijd op: 9 punten na 40 beurten`. "(slimme bot: N)" alleen bij winst en pas na de botberekening. Regel 3 (🏠 per dorp, 🏙 per stad, 🛣️ bij Langste weg) en regel 4 (Oogst = kaarten uit worpen, `harvest[5]`) komen uit het eigen lokale record en vervallen bij hergedeelde vriendcode. `navigator.share` met klembord-fallback.

**Opslag** (localStorage, alles in try/catch): `colonist.daily.v1.run` (lopende run `{day, seedIx, acts, rollIx, stealIx, startedAt}`, na elke eigen actie geschreven, hervatten = headless replay 0,1 tot 0,5 s), `colonist.daily.v1.days` (`{ "328": {w,t,p:[..],code,bot,o:[5],pc:[3],ts} }`, ca. 80 byte per dag), `colonist.daily.v1.streak` (`{cur,best,lastDay}`, af te leiden), `colonist.daily.v1.seen` (intro gezien). Quota-prune: history/lessons eerst, nooit `daily.days`. Geen sync tussen toestellen; "Importeer mijn code" voegt een dag toe.

**Reeks en randgevallen.** Reeks = opeenvolgende Amsterdamse dagen met een afgeronde run (winst of verlies), geen uitstel; levend tot 24:00 van de dag na de laatste speeldag (kaart zegt dan "Speel de dagpuzzel"). Een run hoort bij de dag waarop hij begon (pauze 23:50, klaar 00:10 telt voor de oude dag). Run ouder dan 1 dag: "Afmaken (telt voor dag N)" of "Wegdoen". Offline werkt alles lokaal; alleen delen heeft het OS-deelblad (offline: "Geen internet. Tekst gekopieerd, plak later."). Klok teruggezet of dag al bekend: alleen oefenen. Update tijdens run: de regels zijn bevroren per versie; kan de run niet verder: "Begin opnieuw als oefening". Win door een bot terwijl je wacht: run eindigt direct met uitslag.

## Gedeelde onderdelen

Tokens: `gold` card = `--group` #FBE9C9 (nacht #2A2418) met rand #F2D9A8 (nacht #4A3E24), alleen Dagpuzzel; `panel` #FDFBF6; `chip` #FFF; `streak` chip = `--chip` met rand #E3C27E, zon-icoon #B7791F en tekst heading (nacht: rand #5A4A28, zon #F0B45C); `teal-soft` #E6F4F1/#1F6E77; `good` #3A7324 op #E5F1DB (alleen Jij); primary #1F5F66 met tekst #FFF9F2. Op sea: wit op donkere pil. Gutter 16 op panel-schermen (kaart 328), sheet-inhoud 20 (320 breed).

**Voorbeelddata (één dataset voor alle Dagpuzzel-mocks).** Vandaag is di 24 nov. Reeks: 12 dagen tot en met gisteren (kaarten en tab vóór de run), **13 dagen** zodra vandaag is gespeeld (uitslag, delen, Mijn dagen, tab klaar); de reeks loopt van wo 12 nov tot di 24 nov. Dagen: di 24 nov gewonnen in 17 beurten (verliesvariant van vandaag: "Verloren met 8 punten"); ma 23 nov **Verloren met 9 punten**; zo 22 nov gewonnen in 21 beurten; za 21 nov gewonnen in 18 beurten. Nov: 20 gespeeld, 14 gewonnen, beste reeks 15 (19 okt tot 2 nov). Oktober: 27 gespeeld, 19 gewonnen. Gemist: onder meer wo 11 nov (D20) en zo 18 okt (D28). Eén verliesformulering: "Verloren met N punten" (kaart-chip en statuschip alleen "Verloren"). De mocks D07/D08 zijn alternatieven voor vandaag, niet opeenvolgende dagen.

| Naam | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- |
| Knop (huidige app-look) | secundair: min 48 (44 `sm`), radius 10, wit `--btn` (nacht #20323C), rand 1px #D9CEB6 (nacht #344B56), schaduw 0 1px 2px; primair: radius 10, verloop #22666D naar #1C585F, rand #164C52, Outfit 19/650; icoon 24 links van het label; icoon-alleen (terug, sluiten, maandpijl, tandwiel) 44x44 radius 10 in dezelfde look, ook op zee | wit / teal | De cirkelknoppen en doorschijnende knoppen uit eerdere mocks vervallen |
| Dagpuzzel-kaart | 328 breed, padding 14; kop: eyebrow "Vandaag" 11.5/800, datumchip 76x24 12.5/700, reekschip 98x28 met zon; titel h2 26/650; bordminiatuur 88x88 (img 84x84, 19 hexen, echt bord); rechts "Zelfde worpen voor iedereen" 12.5/700 en statuschip 28 hoog; regel "Jij tegen Blaauw Geelen" met avatars 22; primaire knop 298x48 | gold | Hele kaart is niet tapbaar behalve knoppen (voorstel: tik op bord opent intro-sheet D04) |
| Resultaatknoppen | "Deel je uitslag" 186x48 primair + "Bekijk" 102x48 secundair |  |  |
| Sheet (ivoor) | hoogte 296 tot 563; titel 20/650, sluit 44x44; voet knoppen 328x48 | `--sheet` | Sluit: X, scrim, omlaag, Terug. 260 ms (voorstel); reduced: 120 ms fade |
| Tabbar | 4 items 88x56, pil 56x30; Dagpuzzel actief teal-soft; stip 10 px op Dagpuzzel als vandaag niet gespeeld |  | Stip verdwijnt na eerste actie vandaag |
| Meldingsblok | `msg` 320x85 (sheet) of 328x105; icoon 20 + titel 16/700 + 1 regel 12.5/550 | `chip` op ivoor |  |
| Heroteller (uitslag) | getal 88/700 (kaart: 64/700) + eenheid 22/650 | heading |  |
| Streak-regel | `sun` 20 + "13 dagen op rij" (getal 14/900) | zon #B7791F | Nooit kaal getal, altijd zon + label |

Standaard toegankelijkheid: elk icoon-alleen-element `aria-label`; tapdoelen >= 44x44, 8 ertussen; tekst >= 11.5; focusvolgorde = leesvolgorde (Terug eerst); reduced motion (`data-motion`) maakt schuiven/pulseren tot fades. Groen/rood alleen voor Jij; de Dagpuzzel-uitslag zelf is neutraal (inkt). Reeks heeft `aria-label="13 dagen op rij"`.

---

### D01 Dagpuzzel-kaart (4 staten)

&#91;image: D01 Dagpuzzel-kaart (4 staten) (voorbeelddata)\]

&#91;image: D01 Dagpuzzel-kaart (4 staten), vervolg (voorbeelddata)\]

Donker: zie mockup 01-home-cards-360-dark.png

Doel: Eén kaart die op Spelen, in de Dagpuzzel-tab en in de kaart-sheet de stand van vandaag toont en de volgende actie biedt.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Staatlabel (alleen mock) | "Nog niet gespeeld", "Bezig, dezelfde dag", "Klaar, gewonnen", "Klaar, verloren" | 11.5/800 | wit op sea | Niet in app |
| Kop | "Vandaag", chip "di 24 nov", chip zon "12 dagen" | 11.5 / 24 / 28 hoog | streak chip |  |
| Titel | "Dagpuzzel" | 26/650 | heading |  |
| Bord + status | miniatuur 88x88, "Zelfde worpen voor iedereen", statuschip |  | chip neutraal |  |
| Bots-regel | "Jij tegen \[avatar\] Blaauw \[avatar\] Geelen" | 12.5/700 | soft; "tegen" #687072 |  |
| Primair | per staat | 298x48, 19/650 | `primary` |  |

Staten:

- Nog niet gespeeld: chip "Nog niet gespeeld"; knop "Speel de dagpuzzel" (met `dice`).
- Bezig: chip "Bezig"; "Beurt 7 van 40" 20/650 en balk 198x8 (`role=img`); knop "Maak af". Er is geen apart "Verder spelen" (enige hervat-ingang).
- Klaar gewonnen: chip teal-soft met `check` "Gewonnen"; hero "17" (64/700) + "beurten"; chip `good` "2 sneller"; "Slimme bot: 19 beurten"; knoppen "Deel je uitslag" + "Bekijk"; "Nieuwe puzzel over 6 u 12 min".
- Klaar verloren: chip "Verloren" (neutraal, geen rood); hero "8" + "punten"; "Blaauw won op beurt 24"; geen "Slimme bot"-regel; zelfde knoppen en countdown.
- Poort (0 gespeelde spellen): zie D05.

Teksten: "Nog niet gespeeld", "Vandaag", "di 24 nov", "12 dagen", "Dagpuzzel", "Zelfde worpen voor iedereen", "Jij", "tegen", "Blaauw", "Geelen", "Speel de dagpuzzel", "Bezig", "Beurt 7 van 40", "Maak af", "Gewonnen", "17", "beurten", "2 sneller", "Slimme bot: 19 beurten", "Deel je uitslag", "Bekijk", "Nieuwe puzzel over 6 u 12 min", "Verloren", "8", "punten", "Blaauw won op beurt 24".

Interactie:

1. Tik "Speel de dagpuzzel": D04 (eerste keer, `seen` leeg) of direct start run (D06); 0 spellen: D05.
2. Tik "Maak af": hervat run (replay 0,1 tot 0,5 s, laadstaat), naar D06.
3. Tik "Deel je uitslag": deelsheet D11/D12.
4. Tik "Bekijk": uitslag D07/D08/D09.
5. Countdown loopt per minuut; om 00:00 Amsterdam wisselt de kaart naar "Nog niet gespeeld" (fade 200 ms).

Toegankelijkheid: reekschip `aria-label="12 dagen op rij"`; bordafbeelding `alt="Bord van vandaag"`; voortgangsbalk `role=img` "Beurt 7 van 40"; statuschip tekst, niet alleen kleur; reduced motion: geen pulse op de stip.

Data: dagkey `daily.js` (Amsterdam-datum); status uit `colonist.daily.v1.run` (bezig: `acts` lengte/beurt) en `colonist.daily.v1.days[day]` (klaar: `w`, `t`, `p`, `bot`); reeks `colonist.daily.v1.streak.cur`; bordminiatuur uit `assets/board-day*.webp` (opnieuw te maken met Groen #1E9E8E, zie Gaten; Groen speelt in de Dagpuzzel niet mee); countdown tot volgende Amsterdamse middernacht. Voorbeeld: alle getallen en datum.

### D02 Dagpuzzel-tab, nog niet gespeeld

&#91;image: D02 Dagpuzzel-tab, nog niet gespeeld (voorbeelddata)\]

&#91;image: D02 Dagpuzzel-tab, nog niet gespeeld, vervolg (voorbeelddata)\]

Donker: zie mockup dagtab-360-dark.png

Doel: De tab is het enige thuis van Dagpuzzel-geschiedenis: vandaag, Mijn dagen, vergelijken en oefenen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Roottabkop | "Dagpuzzel" 26/650, tandwiel 44x44, geen terugpijl |  | wit op sea | Tandwiel: Instellingen |
| Kaart | D01 "Nog niet gespeeld" |  | gold |  |
| Kaart Mijn dagen | "Mijn dagen", "Beste reeks 15 dagen", weekstrip ma tot zo (kolommen 39x50), 3 recente rijen (naam links 193x44, knop "Review" 95x44 rechts), knop "Alle dagen" | kaart 328x349 | `panel`; Review teal-soft; rijen 56 | Rij: uitslag (D07/D08). Review: review (P16). "Alle dagen": D15 |
| Vergelijken | "Vergelijk met een vriend", "Plak de code van je vriend" | rij 56 | `panel` | D18 |
| Oefenen | "Oefen een eerdere dag", "Telt niet voor je reeks" | rij 56 |  | Opent dagkeuze (Mijn dagen) |
| Tabbar | Dagpuzzel actief |  |  |  |

Staten: niet gespeeld (dit), bezig, klaar (D03), offline-banner (D22), mislukte vorige-dag-run (D24).

Teksten: "Dagpuzzel", "Mijn dagen", "Beste reeks 15 dagen", "ma", "di", "wo", "do", "vr", "za", "zo", "ma 23 nov", "Verloren met 9 punten", "zo 22 nov", "Gewonnen in 21 beurten", "za 21 nov", "Gewonnen in 18 beurten", "Review", "Alle dagen", "Vergelijk met een vriend", "Plak de code van je vriend", "Oefen een eerdere dag", "Telt niet voor je reeks". In D03 staat bovenaan de rij "di 24 nov", "Gewonnen in 17 beurten".

Interactie:

1. Tik knop in kaart: zie D01.
2. Tik dagrij: D07/D08 (push 260 ms); tik "Review" apart: P16.
3. Tik "Alle dagen": D15.
4. Tik Vergelijk-rij: D18.

Toegankelijkheid: weekstrip alleen weergave (`role=img` met samenvatting); rijen zijn knoppen 56 hoog; Review-knop aria "Review van ma 23 nov"; tabbar `aria-current=page`.

Data: `colonist.daily.v1.days` (laatste 3 dagen), `streak.best`; weekdagen uit dagkey. Voorbeeld: alle waarden.

### D03 Dagpuzzel-tab, klaar

&#91;image: D03 Dagpuzzel-tab, klaar (voorbeelddata)\]

&#91;image: D03 Dagpuzzel-tab, klaar, vervolg (voorbeelddata)\]

Donker: zie mockup dagtab-done-360-dark.png

Doel: Dezelfde tab nadat vandaag is gespeeld: uitslag bovenaan, countdown naar morgen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kaart | D01 "Klaar, gewonnen" (reeks "13 dagen") |  | gold |  |
| Rest | als D02 |  |  |  |

Staten: gewonnen, verloren, tijd op (zelfde kaartvarianten als D01).

Teksten: als D01 "Klaar" plus D02.

Interactie: 1. "Deel je uitslag": D11. 2. "Bekijk": D07. Verder als D02.

Toegankelijkheid: als D02; countdown `aria-live=off` (alleen bij focus voorlezen).

Data: als D01/D02.

### D04 Intro-sheet

&#91;image: D04 Intro-sheet (voorbeelddata)\]

Donker: zie mockup 02-intro-sheet-360-dark.png

Doel: In twee regels en drie symbolen de regels geven vlak voor de start.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | D01 "Nog niet gespeeld" gedimd door scrim |  | `--scrim` |  |
| Sheet | titel "Dagpuzzel", sluit 44x44 | 360x563 | `--sheet` |  |
| Bord | miniatuur 88x88, "Zelfde worpen voor iedereen", "Jij en 2 bots · 10 punten wint" |  |  |  |
| Regel | "Elke dag: zelfde bord, zelfde worpen. Wie wint in de minste beurten?" | 16/650, 320x43 | ink |  |
| Drie tegels | `harbor` "Ruilen met de bank", slot "Geen zet terug", `clock` "Maximaal 40 beurten" | 101x94, 12.5/700 | `chip` | Niet interactief |
| Primair | "Start de dagpuzzel" | 328x48 | `primary` | Start run |

Staten: eerste keer (dit); daarna alleen op tap van het bord of nooit (`seen`); poort: D05.

Teksten: "Dagpuzzel", "Zelfde worpen voor iedereen", "Jij en 2 bots · 10 punten wint", "Elke dag: zelfde bord, zelfde worpen.", "Wie wint in de minste beurten?", "Ruilen met de bank", "Geen zet terug", "Maximaal 40 beurten", "Start de dagpuzzel".

Interactie: 1. Start: sheet sluit 200 ms, `seen` = 1, run begint (D06). 2. X/scrim/Terug: sluit, geen start.

Toegankelijkheid: `role=dialog`, titel gelabeld, focus op titel; primaire knop laatste in tabvolgorde na tegels; tegels hebben tekst naast icoon.

Data: `colonist.daily.v1.seen`; regels vast (spec Werking); miniatuur van vandaag.

### D05 Intro-sheet met poort (eerste keer)

&#91;image: D05 Intro-sheet met poort (eerste keer) (voorbeelddata)\]

Donker: zie mockup 02b-intro-gate-360-dark.png

Doel: Spelers zonder afgerond spel eerst een oefenpotje laten doen, zonder harde blokkade.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | als D04 behalve voet |  |  |  |
| Poortblok | icoon `info`, "Speel eerst je eerste spel", "Zo ken je de regels. De dagpuzzel kun je niet terugdraaien." | `msg` 320x85; titel 16/700, regel 12.5/550 | `chip` op ivoor |  |
| Primair | "Speel een spel" met `dice` | 328x48 | `primary` | Naar Spelen/Nieuw spel |
| Ghost | "Toch starten" | 328x48 secundair |  | Start run toch |

Staten: poort actief bij 0 afgeronde spellen; anders D04.

Teksten: "Speel eerst je eerste spel", "Zo ken je de regels. De dagpuzzel kun je niet terugdraaien.", "Speel een spel", "Toch starten".

Interactie: 1. "Speel een spel": sheet sluit, nieuw-spelscherm. 2. "Toch starten": run begint.

Toegankelijkheid: dezelfde als D04; "Toch starten" is bereikbaar (geen verborgen route).

Data: aantal afgeronde spellen uit `history.js`/`stats.js` (0 = poort). Voorbeeld.

### D06 Run met Dagpuzzel-strip

&#91;image: D06 Run met Dagpuzzel-strip (voorbeelddata)\]

Donker: zie mockup 03-run-360-dark.png

Doel: Het gewone spelscherm met één gouden strip die beurt n van 40 toont.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Spelerbalk | Jij, Blaauw, Geelen met punten/kaarten | bestaand | zetelkleuren als identiteit | Bestaand |
| Beurtkaart | "Jouw beurt", "Bouw of ruil" | bestaand |  |  |
| Dagstrip | icoon `cal` (nieuw), "Dagpuzzel", "di 24 nov", rechts "Beurt 7 van 40" 14/800 + stappenbalk 40 streepjes | 328x36 (voorstel; uit screenshot) | `gold` #FBE9C9, balk accent | Niet interactief |
| Pauze | pauzesheet toont de 3 regels + "Opgeven"; Ruilen opent bank-sheet | bestaand |  | "Opgeven" vraagt bevestiging, eindigt als verlies |
| Ongedaan-balk | ontbreekt |  |  |  |

Staten: normaal; beurt 40 voltooid = tijd op; 10 punten = winst (D07); bot wint (D08).

Teksten: "Dagpuzzel", "di 24 nov", "Beurt 7 van 40", "Opgeven".

Interactie: 1. Elke eigen actie schrijft `run`. 2. Einde: overgang naar uitslag D07/D08/D09 met 300 ms fade (voorstel). 3. Terug/app sluiten: pauze, `run` blijft.

Toegankelijkheid: strip `aria-label="Dagpuzzel di 24 nov, beurt 7 van 40"`; geen toekomstige worpen in de DOM.

Data: beurtteller uit run-state `daily.js`; verder bestaande spelcomponenten. Ontwerp: `game/mock/10-dagpuzzel-run.html`.

### D07 Uitslag gewonnen

&#91;image: D07 Uitslag gewonnen (voorbeelddata)\]

Donker: zie mockup 04a-result-win-360-dark.png

Doel: Het deelbare resultaat: één getal (beurten), vergelijking met de slimme bot, reeks, code en acties.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | terug 44x44, "Dagpuzzel" 20/650, eyebrow "di 24 nov", reekschip "13 dagen" |  | wit op sea; chip streak | Terug: Dagpuzzel-tab |
| Statuschip | `check` "Gewonnen" | 102x28 | teal-soft |  |
| Hero | "17" 88/700, "beurten" 22/650 | 100x84 | heading |  |
| Botregel | "Slimme bot: 19 beurten", chip "2 sneller" | 12.5/700; chip 69x28 | `good` #3A7324 op #E5F1DB | Chip alleen als je sneller was |
| Punten | 3 tegels 95x98: avatar 36 met zetelring, getal 22/700, naam 11.5/700: Jij 10, Blaauw 7, Geelen 4 |  | Jij-tegel heeft rode ring |  |
| Reeks | zon + "13 dagen op rij" | 14/550 | zon |  |
| Codekaart | code `KD1-3QM7-2R9X-HT6B` (Outfit 17/700, +.04em), kopieerknop 44x44 | rij 302x48 radius 12 | chip; knop accent-tekst | Kopieer: toast "Tekst gekopieerd" (voorstel: "Code gekopieerd") |
| Primair | "Deel je uitslag" met `share` | 302x48 | `primary` | D11 |
| Secundair | "Vergelijk", "Review" (halve breedte) | 147x48 elk |  | D18 / P16 |

Staten: win (dit), bot rekent (D10), verlies (D08), tijd op (D09).

Teksten: "Gewonnen", "17", "beurten", "Slimme bot: 19 beurten", "2 sneller", "Jij", "Blaauw", "Geelen", "13 dagen op rij", "Kopieer code", "Deel je uitslag", "Vergelijk", "Review".

Interactie:

1. Binnenkomst: hero telt niet op; alles direct (geen confetti).
2. Kopieer: toast 3 s, `aria-live=polite`.
3. Deel: sheet D11 (260 ms).
4. Vergelijk: D18 met jouw uitslag.
5. Review: P16 (terug komt hier).

Toegankelijkheid: hero `aria-label="Gewonnen in 17 beurten"`; chips tekst; focusvolgorde Terug, Kopieer, Deel, Vergelijk, Review; geen Precisie of Geluk hier (komt uit de async review).

Data: `colonist.daily.v1.days[day]`: `w`, `t` (17), `p` (\[10,7,4\]), `code`, `bot` (19, na botberekening); reeks `streak.cur`. Code via `daily.js` encode. Voorbeeld: alle waarden.

### D08 Uitslag verloren

&#91;image: D08 Uitslag verloren (voorbeelddata)\]

Donker: zie mockup 04a-result-loss-360-dark.png

Doel: Een verlies eerlijk en neutraal tonen, met punten als resultaat.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Alles als D07 behalve |  |  |  |  |
| Statuschip | "Verloren" (zonder icoon) | 71x28 | neutraal `chip`, inkt (geen rood) |  |
| Hero | "8" + "punten" | 88/700 |  |  |
| Regel | "Blaauw won op beurt 24" (met `trophy` bij Blaauw-tegel) | 12.5/550 | soft |  |
| Punten | Jij 8, Blaauw 10 (trofee), Geelen 6 |  |  |  |
| Slimme bot | niet getoond |  |  |  |

Staten: verlies; na "Opgeven" identiek met de punten op dat moment.

Teksten: "Verloren", "8", "punten", "Blaauw won op beurt 24".

Interactie: als D07.

Toegankelijkheid: hero aria "Verloren met 8 punten".

Data: `days[day]`: `w=0`, `p`, winnaar en beurt uit run-eindstand. Voorbeeld.

### D09 Uitslag tijd op

&#91;image: D09 Uitslag tijd op (voorbeelddata)\]

Donker: zie mockup 04a-result-tijdop-360-dark.png

Doel: Duidelijk maken dat de limiet van 40 beurten bereikt is zonder winnaar.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Alles als D08 behalve |  |  |  |  |
| Statuschip | `clock` "Tijd op" |  | neutraal |  |
| Hero | "9" "punten" |  |  |  |
| Regel | "40 beurten gespeeld, geen 10 punten" |  |  |  |
| Punten | Jij 9, Blaauw 8, Geelen 7 |  |  |  |

Staten: tijd op.

Teksten: "Tijd op", "9", "punten", "40 beurten gespeeld, geen 10 punten".

Interactie: als D07. Deeltekst: "⏳ Tijd op: 9 punten na 40 beurten".

Toegankelijkheid: hero aria "Tijd op, 9 punten na 40 beurten".

Data: `days[day]` met `t=40`, `w=0`. Voorbeeld.

### D10 Uitslag, slimme bot rekent

&#91;image: D10 Uitslag, slimme bot rekent (voorbeelddata)\]

Donker: zie mockup 04a-result-rekent-360-dark.png

Doel: Direct de uitslag tonen terwijl de slimme bot nog rekent (0,3 tot 1,6 s).

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Alles als D07 behalve |  |  |  |  |
| Botregel | "Slimme bot rekent" (+ spinner 16) | 12.5/700 | soft | Wordt "Slimme bot: 19 beurten" + chip |
| Deel-knop | actief; deeltekst zonder "(slimme bot: N)" |  |  |  |

Staten: rekent; klaar (D07); bot verliest ("Slimme bot: verloren", geen chip).

Teksten: "Slimme bot rekent".

Interactie: 1. Resultaat: regel wisselt 150 ms fade; kaartgrootte verandert niet (reserveer 28 px voor chip).

Toegankelijkheid: `aria-live=polite` bij resultaat; reduced motion: geen spinner-animatie, tekst "rekent".

Data: `days[day].bot` na headless run in worker (`api/headless.js`, `mc/runners.js`), gecachet per dag. Voorbeeld 19.

### D11 Delen na winst

&#91;image: D11 Delen na winst (voorbeelddata)\]

Donker: zie mockup 05-share-360-dark.png

Doel: De deeltekst tonen en delen of kopiëren.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | D07 gedimd |  | scrim |  |
| Sheet | "Deel je uitslag", sluit 44x44 | 360x486 | `--sheet` |  |
| Voorbeeld | tekstkaart `aria-label="Voorbeeld van de tekst"` met 7 regels (zie Werking), link in teal #1F6E77 | 15/400, radius 14 | `chip` | Niet bewerkbaar |
| Hint | "Je vriend ziet de uitslag in de tekst. Met de link opent de app de vergelijking." | 320x33, 12.5/550 | soft |  |
| Primair | "Deel" met `share` | 328x48 | `primary` | Opent OS-deelblad (`navigator.share`) |
| Secundair | "Kopieer tekst" met kopieer-icoon | 328x48 |  | Klembord + toast |

Staten: win (dit), verlies (D12), toast gekopieerd (D13), offline (D14), `navigator.share` ontbreekt: D27.

Teksten: "Deel je uitslag", "Voorbeeld van de tekst", de zeven regels, "Je vriend ziet de uitslag in de tekst. Met de link opent de app de vergelijking.", "Deel", "Kopieer tekst".

Interactie: 1. Deel: OS-blad; annuleren doet niets. 2. Kopieer: toast D13. 3. Sluit: terug naar D07.

Toegankelijkheid: voorbeeld `role=group` met platte tekst (leesbaar voor screenreader), emoji hebben tekst ernaast; focus op titel.

Data: deeltekst uit `days[day]` (`code`, `w`, `t`, `p`, `bot`, `o`, `pc`) door `daily.js` `shareText()`; regels 3 en 4 uit het lokale record. Voorbeeld.

### D12 Delen na verlies

&#91;image: D12 Delen na verlies (voorbeelddata)\]

Donker: zie mockup 05b-share-loss-360-dark.png

Doel: Verliesvariant van de deeltekst.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Als D11 | tekst: "Katan Dagpuzzel, di 24 nov / 🎲 Verloren met 8 punten / 🏠🏠🏠🏠 🏙 🛣️ / Oogst 🌲5 🧱3 🐑4 🌾3 ⛰️1 / Jij 8 · Blaauw 10 · Geelen 6 punten / Code KD1-8H2F-6N4K-0WQ3 / Sneller dan ik? https://\<app-adres>/#dag=KD1-8H2F-6N4K-0WQ3" |  |  |  |

Staten: verlies; geen "(slimme bot)".

Teksten: zie hierboven.

Interactie: als D11.

Toegankelijkheid: als D11.

Data: als D11.

### D13 Delen, gekopieerd

&#91;image: D13 Delen, gekopieerd (voorbeelddata)\]

Donker: zie mockup 05c-share-gekopieerd-360-dark.png

Doel: Bevestiging dat de tekst op het klembord staat.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Als D11 + toast | "Tekst gekopieerd. Plak hem in je app." | 48 hoog, radius 14, boven de sheetvoet | #22302F, tekst wit | 3 s, verdwijnt zelf |

Staten: toast zichtbaar.

Teksten: "Tekst gekopieerd. Plak hem in je app."

Interactie: 1. Tik Kopieer: toast schuift in 200 ms, weg na 3 s.

Toegankelijkheid: toast `aria-live=polite`, `role=status`.

Data: `navigator.clipboard.writeText` met `shareText()`.

### D14 Delen, offline

&#91;image: D14 Delen, offline (voorbeelddata)\]

Donker: zie mockup 05d-share-offline-360-dark.png

Doel: Eerlijk melden dat delen zonder internet niet lukt maar de tekst wel gekopieerd is.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Als D11 + toast | "Geen internet. Tekst gekopieerd, plak later." | 48 hoog | #22302F | 3 s |

Staten: share-aanroep mislukt of offline.

Teksten: "Geen internet. Tekst gekopieerd, plak later."

Interactie: 1. Tik Deel offline: tekst naar klembord, toast.

Toegankelijkheid: als D13.

Data: `navigator.onLine` of fout van `navigator.share`.

### D15 Mijn dagen

&#91;image: D15 Mijn dagen (voorbeelddata)\]

Donker: zie mockup 06-mijn-dagen-360-dark.png

Maandwissel: D28

Doel: De hele geschiedenis: kalender, tellingen, dagrijen met uitslag en review.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | terug 44x44 (knoplook), "Mijn dagen" 20/650, reekschip "13 dagen" 98x28 rechts | balk 360x64 | streak chip | Terug: Dagpuzzel-tab |
| Kalenderkaart | maandkop: pijl vorige maand 44x44, "November" 20/650 gecentreerd, pijl volgende maand 44x44 (uit in de huidige maand, 40% dekking); maandkalender (celkoppen ma tot zo 11.5/800, cellen 30x30 rond) | kaart 328x341; cal 298x230 | gespeeld: gold #FBE9C9; gemist: neutraal grijs; vandaag: ring; toekomst: vaag | Alleen weergave |
| Tellers | "Gespeeld 20", "Gewonnen 14", "Beste reeks 15" (van de getoonde maand; beste reeks over alle dagen) | 12.5/700 + 12.5/900 |  |  |
| Lijstkaart | 4 rijen di 24 tot za 21 nov: naam 16/700 + 1 regel 12.5/550 ("Gewonnen in 17 beurten", "Verloren met 9 punten", "Gewonnen in 21 beurten", "Gewonnen in 18 beurten"), knop "Review" 95x44; gemiste dag (zie D28): "Niet gespeeld. Oefen deze dag" met opnieuw-icoon | kaart 328x241; rij 56 (hoofd 193x44) | teal-soft Review | Rij: uitslag. Review apart |
| Importeren | "Importeer mijn code" met download-icoon | 48 | secundair | Opent plakveld |

Staten: gevuld (dit); leeg (D16); andere maand met oefenrij (D28).

Teksten: "Mijn dagen", "November", "13 dagen", "Vorige maand", "Volgende maand", "ma", "di", "wo", "do", "vr", "za", "zo", "Gespeeld", "Gewonnen", "Beste reeks", "Gewonnen in 17 beurten", "Verloren met 9 punten", "Gewonnen in 21 beurten", "Gewonnen in 18 beurten", "Review", "Review van di 24 nov", "Niet gespeeld. Oefen deze dag", "Importeer mijn code".

Interactie:

1. Tik rij: D07/D08/D09 voor die dag (push 260 ms).
2. Tik "Review": P16 voor die dag; terug komt hier.
3. Tik gemiste dag: start oefenrun (D04-regel, "telt niet").
4. Tik "Importeer mijn code": plakveld (zoals D18) en toevoegen aan `days`.

Toegankelijkheid: kalender `role=img` met aria "November 2026" en per cel `aria-label` ("12 nov", gespeeld of niet); rij 56 hoog; Review-knop eigen aria.

Data: `colonist.daily.v1.days` (alle dagen), `streak` (cur/best); tellers afgeleid (aantal sleutels, `w`=1). Voorbeeld: alle waarden.

### D16 Mijn dagen leeg

&#91;image: D16 Mijn dagen leeg (voorbeelddata)\]

Donker: zie mockup 06b-mijn-dagen-leeg-360-dark.png

Doel: Lege geschiedenis uitleggen en naar de eerste run sturen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | als D15 |  |  |  |
| Leeg-blok | "Nog geen dagen", "Speel de dagpuzzel en je eerste dag staat hier. Je reeks begint bij 1." |  | `panel` |  |
| Primair | "Speel de dagpuzzel" | 48 | `primary` | Start (D04/D05) |

Staten: 0 dagen.

Teksten: "Nog geen dagen", "Speel de dagpuzzel en je eerste dag staat hier. Je reeks begint bij 1.", "Speel de dagpuzzel".

Interactie: 1. Primair: naar D04/D05.

Toegankelijkheid: primaire knop eerste focus na Terug.

Data: `days` leeg.

### D17 Vergelijk, uitslag

&#91;image: D17 Vergelijk, uitslag (voorbeelddata)\]

Donker: zie mockup 07a-vergelijk-uitslag-360-dark.png

Doel: Jouw uitslag naast die van een vriend op dezelfde dag, afgeleid uit de code.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Vergelijk" 20/650, eyebrow "di 24 nov", badge `check` "Code klopt" 103x28 |  | teal-soft |  |
| Oordeel | "Jij was 3 beurten sneller" (26/650, "sneller" 26/800 `good`) | 328x60 | `good` alleen Jij | Bij langzamer: "Je vriend was 3 beurten sneller" in inkt |
| Twee kolommen | Jij (avatar 44, "Jij", "17" 52/700, "beurten"), Vriend (neutraal grijs avatar met gebruiker-icoon, "Vriend", "20", "beurten") | 159x174 | `chip` |  |
| Puntenkaart | "Punten", "10 wint"; per speler balkjes: Jij 10, Blaauw 7, Geelen 4; Vriend 10, Blaauw 8, Geelen 5 | kaart 328x305 | neutraal teal; Jij met zetelring |  |
| Primair | "Deel je uitslag" | 328x48 | `primary` | D11 |
| Ghost | "Andere code vergelijken" | 48 |  | D18 |

Staten: zelfde dag en beide gewonnen (dit); een van beide verloren (rangorde uit Werking: winst > verlies; dan beurten resp. punten); gelijke uitslag (D29).

Teksten: "Vergelijk", "Code klopt", "Jij was 3 beurten sneller", "Jij", "17", "beurten", "Vriend", "20", "Punten", "10 wint", "Blaauw", "Geelen", "Deel je uitslag", "Andere code vergelijken".

Interactie: 1. Deel: D11. 2. Andere code: D18. 3. Kolommen zijn niet tapbaar.

Toegankelijkheid: oordeel is `h2`; balken met tekstgetal; vriendavatar `aria-hidden`, naam "Vriend".

Data: eigen dag uit `days[day]`; vriend volledig uit de gedecodeerde code (`daily.js decode`): `w`, `t`, `p`. Voorbeeld: alle waarden.

### D18 Vergelijk, plakken

&#91;image: D18 Vergelijk, plakken (voorbeelddata)\]

Donker: zie mockup 07b-vergelijk-plakken-360-dark.png

Doel: Een vriendcode invoeren, ook als plakken niet mag.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Uitleg | "Plak de code van je vriend. Heb je een link gekregen? Dan opent de app hier vanzelf." | 14/550 | ink |  |
| Invoer | placeholder `KD1-XXXX-XXXX-XXXX`, plakknop 44x44 | veld 48 | `chip` | Valideert per teken; auto-hoofdletters en streepjes |
| Knop | "Plakken van klembord" | 48 | secundair/primair | Leest klembord |
| Melding (geweigerd) | `alert` "Plakken lukt niet", "Houd het veld ingedrukt en kies Plak. Of typ de code over." | `msg` | neutraal |  |

Staten: leeg; geweigerd (melding); ingevuld en geldig gaat naar D17/D20/D21; ongeldig D19.

Teksten: "Plak de code van je vriend. Heb je een link gekregen? Dan opent de app hier vanzelf.", "KD1-XXXX-XXXX-XXXX", "Plakken van klembord", "Plakken lukt niet", "Houd het veld ingedrukt en kies Plak. Of typ de code over.".

Interactie: 1. Plak/typ: bij 12 tekens direct valideren (150 ms). 2. Klembord geweigerd: melding verschijnt, veld krijgt focus.

Toegankelijkheid: veld `aria-label="Code van je vriend"`, `inputmode=text`, `autocapitalize=characters`; melding `role=alert`.

Data: `daily.js decode/checksum`; klembord via `navigator.clipboard.readText`.

### D19 Vergelijk, code fout

&#91;image: D19 Vergelijk, code fout (voorbeelddata)\]

Donker: zie mockup 07c-vergelijk-fout-360-dark.png

Doel: Een tikfout in de code herkenbaar melden.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Invoer | `KD1-3QM7-2R9X-HT6D`, wisknop 44x44 | veld 48 | `chip`, rand neutraal | Wis leegt |
| Melding | `alert` "Deze code klopt niet", "Er zit een tikfout in. Kijk de laatste groep na." | `msg` | neutraal (geen rood; niet over Jij) |  |
| Knop | "Plakken van klembord" | 48 |  |  |

Staten: checksum klopt niet; afkapping (te kort): "Nog niet compleet" (voorstel).

Teksten: "Plak de code van je vriend.", "Deze code klopt niet", "Er zit een tikfout in. Kijk de laatste groep na.", "Plakken van klembord".

Interactie: 1. Bewerken: melding verdwijnt zodra checksum klopt.

Toegankelijkheid: `role=alert`; foutstatus ook als tekst; veld `aria-invalid=true`.

Data: checksum 27 bit (`daily.js`).

### D20 Vergelijk, andere dag

&#91;image: D20 Vergelijk, andere dag (voorbeelddata)\]

Donker: zie mockup 07d-vergelijk-andere-dag-360-dark.png

Doel: Uitleggen dat een code van een andere dag niet vergeleken kan worden als je die dag niet speelde.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | eyebrow "wo 11 nov", badge "Code klopt" |  |  |  |
| Blok | `cal` "Dit is een andere dag"; "Je vriend won op wo 11 nov in 21 beurten"; "Jij hebt die dag niet gespeeld, dus je kunt niet vergelijken." | `msg` | neutraal |  |
| Primair | "Oefen wo 11 nov" | 48 | `primary` | Start oefenrun |
| Noot | "Oefenen telt niet mee voor je reeks en uitslag." | 12.5/550 | soft |  |
| Ghost | "Naar Mijn dagen" | 48 |  | D15 |

Staten: andere dag, niet gespeeld (dit); andere dag wel gespeeld: gewoon D17 (voorstel).

Teksten: "Dit is een andere dag", "Je vriend won op wo 11 nov in 21 beurten", "Jij hebt die dag niet gespeeld, dus je kunt niet vergelijken.", "Oefen wo 11 nov", "Oefenen telt niet mee voor je reeks en uitslag.", "Naar Mijn dagen".

Interactie: 1. Oefen: run met seed van wo 11 nov, gemarkeerd oefening (D06 zonder tellen). 2. Naar Mijn dagen: D15.

Toegankelijkheid: kop `h2`; knoppen volgorde primair, ghost.

Data: dag en resultaat uit gedecodeerde code; "niet gespeeld" = geen `days[dag]`.

### D21 Vergelijk, eerst spelen

&#91;image: D21 Vergelijk, eerst spelen (voorbeelddata)\]

Donker: zie mockup 07e-vergelijk-eerst-spelen-360-dark.png

Doel: Spoilers voorkomen: vriendresultaat van vandaag blijft verborgen tot jouw run klaar is.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | eyebrow "di 24 nov", badge "Code klopt", h2 "Speel eerst vandaag" 24/650 |  |  |  |
| Blok | slot "De uitslag van je vriend is nog verborgen", "Zo weet je niet hoe het bord uitpakt voor je begint. Na afloop zie je het meteen." | 328x105 | `chip` |  |
| Primair | "Speel de dagpuzzel" | 328x48 | `primary` | D04/D05, na run opent D17 met deze code |
| Ghost | "Toch de uitslag zien" | 328x48 |  | Toont D17 meteen |

Staten: vandaag nog niet gespeeld (dit); na afloop direct D17.

Teksten: "Speel eerst vandaag", "De uitslag van je vriend is nog verborgen", "Zo weet je niet hoe het bord uitpakt voor je begint. Na afloop zie je het meteen.", "Speel de dagpuzzel", "Toch de uitslag zien".

Interactie: 1. Primair: run starten, code blijft bewaard. 2. Ghost: D17 (eigen kolom "Nog niet gespeeld", voorstel).

Toegankelijkheid: slot-icoon decoratief; knoppen duidelijke volgorde.

Data: dag = vandaag en `days[vandaag]` leeg.

### D22 Dagpuzzel offline

&#91;image: D22 Dagpuzzel offline (voorbeelddata)\]

Donker: zie mockup 08a-offline-360-dark.png

Doel: Zeggen dat alles werkt offline behalve delen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Banner | `alert`/wifi-uit "Je bent offline", "De dagpuzzel werkt gewoon. Alleen delen heeft internet nodig." | 328x63; titel 14/650, regel 12.5/550 | `panel`, neutrale inkt | Verdwijnt online |
| Kaart | D01 niet gespeeld |  | gold |  |
| Tabbar |  |  |  |  |

Staten: offline; online verbergt de banner.

Teksten: "Je bent offline", "De dagpuzzel werkt gewoon. Alleen delen heeft internet nodig.".

Interactie: 1. Alles werkt. 2. Deel offline: D14.

Toegankelijkheid: banner `role=status`.

Data: `navigator.onLine`; seedtabel en engine in SW-cache.

### D23 Al gespeeld vandaag

&#91;image: D23 Al gespeeld vandaag (voorbeelddata)\]

Donker: zie mockup 08b-al-gespeeld-360-dark.png

Doel: Na afloop geen tweede geteld poging, wel oefenen aanbieden.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | Dagpuzzel-tab klaar (D03) |  |  |  |
| Sheet | "Vandaag al gespeeld", sluit 44x44; blok "Je kunt oefenen", "Zelfde bord, zelfde worpen. Oefenen telt niet mee voor je uitslag of reeks." | 360x296 | `--sheet` | Opent als je op het bord tikt of een nieuwe poging probeert (voorstel) |
| Primair | "Oefen vandaag" | 328x48 | `primary` | Start oefenrun |
| Secundair | "Sluiten" | 328x48 |  |  |

Staten: al gespeeld; clock back: zelfde sheet.

Teksten: "Vandaag al gespeeld", "Je kunt oefenen", "Zelfde bord, zelfde worpen. Oefenen telt niet mee voor je uitslag of reeks.", "Oefen vandaag", "Sluiten".

Interactie: 1. Oefen: run met label "oefenen", niets wordt opgeslagen in `days`. 2. Sluiten: sheet weg.

Toegankelijkheid: `role=dialog`; focus op titel.

Data: `days[vandaag]` bestaat.

### D24 Afmaken (run van gisteren)

&#91;image: D24 Afmaken (run van gisteren) (voorbeelddata)\]

Donker: zie mockup 08c-hervatten-gisteren-360-dark.png

Doel: Een niet afgemaakte run van een vorige dag afmaken (telt voor die dag) of weggooien.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | Dagpuzzel-tab met kaart "Bezig", "Beurt 7 van 40" |  |  |  |
| Sheet | "Je run van gisteren", blok "Beurt 7 van 40 op ma 23 nov", "Maak hem af en hij telt voor die dag. Je puzzel van vandaag blijft apart." | 360x296 |  |  |
| Primair | "Maak af voor ma 23 nov" | 328x48 | `primary` | Hervat run |
| Secundair | "Wegdoen" | 328x48 |  | Opent D30 (bevestigen) |

Staten: run ouder dan 1 dag.

Teksten: "Je run van gisteren", "Beurt 7 van 40 op ma 23 nov", "Maak hem af en hij telt voor die dag. Je puzzel van vandaag blijft apart.", "Maak af voor ma 23 nov", "Wegdoen".

Interactie: 1. Maak af: D06 voor die dag. 2. Wegdoen: D30; na bevestigen wist `run`, kaart toont vandaag.

Toegankelijkheid: dialoog; "Wegdoen" is destructief en secundair (inkt, geen rood).

Data: `colonist.daily.v1.run.day` ouder dan vandaag.

### D25 Update tijdens run

&#91;image: D25 Update tijdens run (voorbeelddata)\]

Donker: zie mockup 08d-update-tijdens-run-360-dark.png

Doel: Melden dat een app-update de lopende run onspeelbaar maakte.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | "De app is bijgewerkt", blok "Je run kan niet verder", "De regels zijn aangepast, dus beurt 7 kan niet meer worden afgespeeld. Begin opnieuw als oefening." | 360x296 |  |  |
| Primair | "Begin opnieuw als oefening" | 328x48 | `primary` | Oefenrun van die dag |
| Secundair | "Later" | 328x48 |  | Sluit, run blijft bewaard |

Staten: regelversie `v1` van de run komt niet overeen met de app.

Teksten: "De app is bijgewerkt", "Je run kan niet verder", "De regels zijn aangepast, dus beurt 7 kan niet meer worden afgespeeld. Begin opnieuw als oefening.", "Begin opnieuw als oefening", "Later".

Interactie: 1. Primair: oude run weg, oefenrun. 2. Later: sheet weg.

Toegankelijkheid: dialoog; geen alarmkleur.

Data: run-versie versus daily-regelversie (`daily.js`, risico R2 in spec).

### D26 Link `#dag=` voor nieuwe speler

&#91;image: D26 Link #dag= voor nieuwe speler (voorbeelddata)\]

Donker: zie mockup 09-dag-landing-360-dark.png

Doel: Een nieuwe speler met een vriendenlink na de onboarding naar de Dagpuzzel leiden zonder het vriendresultaat te spoilen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop | "Katan" 26/650, tandwiel 44x44 |  |  |  |
| Uitnodigingskaart | vriend-avatar 44 (neutraal), eyebrow "Uitnodiging", h2 "Je vriend speelde de Dagpuzzel van di 24 nov"; bord 88x88; "Zelfde bord en worpen voor iedereen"; "Zijn uitslag zie je na jouw run" | kaart 328; h2 20/650 | gold |  |
| Primair | "Speel hem ook" | 298x48 | `primary` | Soft gate: 0 spellen opent D05 |
| Noot | "Nieuw hier? Eerst één oefenpotje, daarna deze puzzel. Je kunt ook meteen starten." | 12.5/550 | soft |  |
| Eerste spel | kaart "Je eerste spel", "We leggen onderweg uit wat je ziet.", knop "Start je eerste spel" | kaart 328x152; knop 298x48 secundair | `panel` | Start eerste spel; de code blijft bewaard |
| Tabbar | Spelen actief |  |  |  |

Staten: nieuwe speler (dit); bestaande speler met link: direct D21 of D17; ongeldige code: D19.

Teksten: "Uitnodiging", "Je vriend speelde de Dagpuzzel van di 24 nov", "Zelfde bord en worpen voor iedereen", "Zijn uitslag zie je na jouw run", "Speel hem ook", "Nieuw hier? Eerst één oefenpotje, daarna deze puzzel. Je kunt ook meteen starten.", "Je eerste spel", "We leggen onderweg uit wat je ziet.", "Start je eerste spel".

Interactie: 1. Bij openen van `#dag=` blijft de hash bewaard door de onboarding heen. 2. "Speel hem ook": D05 (poort) of run. 3. Na de run opent Vergelijk met de code (D17).

Toegankelijkheid: kaart `role=region` "Uitnodiging"; primair eerste focus.

Data: `location.hash` `#dag=KD1-...`, `daily.js decode` (dag, resultaat verborgen); opslag van de hash voor onboarding (voorstel: `sessionStorage`).

### D27 Delen zonder deelmenu (kopieer)

&#91;image: D27 Delen zonder deelmenu (kopieer) (voorbeelddata)\]

Donker: zie mockup 05e-share-kopieer-360-dark.png

Doel: Op een toestel zonder `navigator.share` (veel desktopbrowsers) de tekst kopiëren in plaats van delen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | D07 gedimd |  | scrim |  |
| Sheet | "Deel je uitslag", sluit 44x44, tekstkaart als D11 | 360x485 | `--sheet` |  |
| Melding | `msg` met `info`: "Delen kan hier niet", "Kopieer de tekst en plak hem in je app." (vervangt de hint van D11) | 320x65 | `chip`, teal-soft icoon |  |
| Primair | "Kopieer tekst" met `copy` (er is geen "Deel"-knop) | 328x48 | `primary` | Klembord, toast als D13 |

Staten: `navigator.share` ontbreekt (dit); met deelmenu: D11; klembord geweigerd: toast "Kopiëren lukt niet. Selecteer de tekst zelf." en de tekstkaart wordt selecteerbaar (voorstel).

Teksten: "Deel je uitslag", de zeven regels, "Delen kan hier niet", "Kopieer de tekst en plak hem in je app.", "Kopieer tekst".

Interactie: 1. Kopieer: toast D13. 2. Sluit: terug naar D07. Detectie: `typeof navigator.share !== "function"`.

Toegankelijkheid: als D11; melding `role=status`.

Data: als D11.

### D28 Mijn dagen, andere maand

&#91;image: D28 Mijn dagen, andere maand (voorbeelddata)\]

Donker: zie mockup 06c-mijn-dagen-maand-360-dark.png

Doel: Terugbladeren naar een eerdere maand; gemiste dagen zijn hier te oefenen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | als D15 (reekschip blijft "13 dagen": de huidige reeks) |  |  |  |
| Kalenderkaart | pijl vorige maand en volgende maand 44x44 (beide actief), "Oktober" 20/650, kalender oktober 2026 (begint op donderdag), tellers "Gespeeld 27", "Gewonnen 19", "Beste reeks 15" | kaart 328x305; cal 298x194 | gespeeld gold; gemist gestippeld (5, 9, 10, 18 okt) | Pijl wisselt maand, kalender crossfade 150 ms |
| Lijstkaart | rijen van die maand, nieuwste eerst: "za 31 okt Gewonnen in 19 beurten", "zo 18 okt Niet gespeeld. Oefen deze dag" (`retry`, chevron), "za 17 okt Verloren met 7 punten" | kaart 328x183; rij 56 | gemist: grijs icoonvlak | Rij: uitslag; gemist: oefenrun (D04-regel, "telt niet"); Review apart |

Staten: andere maand (dit); eerste maand met data (pijl vorige uit); huidige maand (D15, pijl volgende uit); maand zonder gespeelde dagen: kalender met alleen gestippelde dagen en "Niet gespeeld" zonder lijst (voorstel).

Teksten: "Mijn dagen", "13 dagen", "Vorige maand", "Oktober", "Volgende maand", "Gespeeld", "Gewonnen", "Beste reeks", "za 31 okt", "Gewonnen in 19 beurten", "zo 18 okt", "Niet gespeeld. Oefen deze dag", "za 17 okt", "Verloren met 7 punten", "Review".

Interactie: 1. Pijl: maand wisselt, kop krijgt `aria-live=polite`. 2. Horizontaal vegen op de kalender wisselt ook (extra, niet de enige weg). 3. Tik gemiste dag: oefenrun.

Toegankelijkheid: pijlen `aria-label` "Vorige maand" en "Volgende maand", uitgeschakeld met `disabled`; kalender `role=img` aria "Oktober 2026"; per cel `aria-label` "18 okt, niet gespeeld".

Data: `colonist.daily.v1.days` gegroepeerd per maand; eerste maand = oudste dagkey.

### D29 Vergelijk, gelijkspel

&#91;image: D29 Vergelijk, gelijkspel (voorbeelddata)\]

&#91;image: D29 Vergelijk, gelijkspel, vervolg (voorbeelddata)\]

Donker: zie mockup 07f-vergelijk-gelijk-360-dark.png

Doel: Beide spelers hebben exact dezelfde uitslag; geen winnaar, geen groen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | als D17: "Vergelijk", eyebrow "di 24 nov", badge "Code klopt" |  |  |  |
| Oordeel | "Gelijkspel, jullie waren even snel" (26/650, geen groen) | 328x60 | `heading` |  |
| Twee kolommen | Jij (zetelring `--p0`, "17" 52/700, "beurten") en Vriend (neutraal, "17", "beurten"), beide even zwaar | 159x174 | `chip` |  |
| Puntenkaart | als D17 (Jij 10, Blaauw 7, Geelen 4; Vriend 10, Blaauw 6, Geelen 5) | kaart 328x305 | neutraal teal; vriend grijs |  |
| Primair, ghost | "Deel je uitslag"; "Andere code vergelijken" | 328x48 |  | D11; D18 |

Staten: gelijk aantal beurten bij beide gewonnen (dit); beide verloren met evenveel punten: "Gelijkspel, jullie hadden evenveel punten"; beide tijd op met gelijke punten: idem. Gelijkspel = zelfde klasse (winst of verlies) en zelfde getal (beurten resp. punten).

Teksten: "Vergelijk", "Code klopt", "Gelijkspel, jullie waren even snel", "Jij", "17", "beurten", "Vriend", "Punten", "10 wint", "Deel je uitslag", "Andere code vergelijken".

Interactie: als D17.

Toegankelijkheid: oordeel is `h2`; kolommen krijgen dezelfde aria-structuur; geen kleur als enige drager.

Data: als D17; vergelijking in `daily.js` (resultaten gelijk).

### D30 Wegdoen bevestigen

&#91;image: D30 Wegdoen bevestigen (voorbeelddata)\]

Donker: zie mockup 08e-wegdoen-bevestig-360-dark.png

Doel: Een niet afgemaakte run weggooien bevestigen; de veilige keuze is primair.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | Dagpuzzel-tab met kaart "Bezig" gedimd (D24 is vervangen) |  | scrim | Tik scrim = annuleer |
| Sheet | "Run wegdoen?" 20/650, sluit 44x44 | 360x296 | `--sheet`, `role=alertdialog` |  |
| Melding | `msg` met `clock`: "Beurt 7 van 40 op ma 23 nov", "Die dag telt dan als niet gespeeld. Oefenen kan daarna nog." | 320x85 | `chip` |  |
| Primair | "Annuleer" | 328x48 | `primary` | Terug naar D24 |
| Secundair | "Wegdoen" | 328x48 | knoplook, tekst `--danger` #A8402C (nacht #F2907A) | Wist `run`; toast "Run weggedaan." |

Staten: run van gisteren (dit, D24); run van vandaag (titel "Run wegdoen?", regel "Beurt 7 van 40 van vandaag. Je kunt opnieuw beginnen."); als de dag de reeks onderhoudt: extra regel "Je reeks kan hierdoor stoppen." (voorstel).

Teksten: "Run wegdoen?", "Beurt 7 van 40 op ma 23 nov", "Die dag telt dan als niet gespeeld. Oefenen kan daarna nog.", "Annuleer", "Wegdoen", "Run weggedaan.".

Interactie: 1. Tik "Wegdoen" in D24: deze sheet vervangt D24 (260 ms). 2. Annuleer, scrim of Terug: terug naar D24. 3. Wegdoen: sheet sluit, kaart toont vandaag, toast.

Toegankelijkheid: `role=alertdialog` `aria-modal`; focus op "Annuleer"; Escape/Terug = annuleer; destructieve knop secundair.

Data: `colonist.daily.v1.run` (verwijdert) en `days[dag]` blijft leeg.

---

## Iconen (productbeslissing: huidige app wint)

Huidige set `src/ui-icons.js`: `home dice clock history lessons book info settings sliders bars lab trade build devcard robber target trophy star road settlement city ship harbor scale close check explore`. Gebruik deze namen. De mocks (`daily/src2/lib.cjs`) gebruiken die paden; het eerdere afwijkende `trophy`-pad is verwijderd.

Omzettingen in de mocks: regeltegel "Ruilen met de bank" (D04, D05) `bank` is nu `harbor`; poortblok (D05) `help` is nu `info`; sluitknoppen `close` 24 (was 22); statusicoon "Tijd op" `clock`; tabbar Spelen `dice`, Terugblik `history`, Bots `bars`; trophy (D15, D07-D10) uit de huidige set.

Nieuw, geen huidig equivalent (blijft): terug, chevron, delen, kopieer, zon (reeks, D15 en reeksregel), gebruiker (vriend), mensen (Vergelijk), kalender (`cal`, strip D06 en D20), slot (D05 regels, D21), alert, opnieuw, wifi-uit, download, puzzel (tab Dagpuzzel).

Knoppen: alle knoppen volgen de huidige app (radius 10, wit met rand, icoon 24, primair met verloop), zie "Knop" in Gedeelde onderdelen.

## Gaten en tegenstrijdigheden

Opgelost in deze ronde: voorbeelddata (één reeks, dezelfde uitslagen voor 21 tot 24 nov in tab en Mijn dagen, deelsheet-achtergrond en -tekst di 24 nov), één verliesformulering "Verloren met N punten" (ook DESIGN-SYSTEM en `shell.md`), mocks voor gelijkspel in Vergelijk (D29), Wegdoen-bevestiging (D30), maandwissel in Mijn dagen (D28) en delen zonder `navigator.share` (D27), iconen en knoppen conform de huidige app.

1. Het bordminiatuur is nog met oude Groen #0A6B63 getekend; her-capturen met #1E9E8E (DESIGN-SYSTEM v2.1). Groen speelt in de Dagpuzzel niet mee.
2. Nog geen mock: importeer-code-scherm (D15 "Importeer mijn code"), oefenrun-markering in de run, bot verliest ("Slimme bot: verloren"), deelsheet zonder lokaal record (herdeelde vriendcode), maand zonder gespeelde dagen.
3. Het bewijs ("Met bewijs", `KDP1.`) zit niet in de UI tot de cross-device determinismetest is geslaagd (risico R1); de segmentkeuze "Alleen code / Met bewijs" uit design.md v1 is verwijderd.
4. Open uit spec: Q1 definitief botpaar (300-spellenrun), Q3 per-zetel kaartstapels, of de slimme bot vóór de run berekend mag worden (nee), limiet 40 beurten (langste testspel 34).
5. De Dagpuzzel-tab (D02/D03) is gemaakt met `home/src2/build.cjs` (alleen de dagrijen zijn nu gelijkgetrokken met Mijn dagen); die generator en de home-mocks gebruiken nog de oude cirkelknoppen en eigen iconenlook, en moeten bij een volgende ronde dezelfde knoppen krijgen. Review (P16) is van de post-ontwerper. Toegankelijkheidsrijen en ms-waarden zijn voorstellen; het ontwerpsysteem geeft alleen toast 3 s.
6. De reeks telt "12 dagen" vóór de run en "13 dagen" erna (reeks +1 na afloop, bedoeld); de tab moet na afloop live bijwerken. D07/D08 zijn alternatieven voor vandaag, geen opeenvolgende dagen.
7. D01 toont 4 staten in één mock met alleen een mock-label; in de app is het één component met vier staten.
8. Data-bronnen: `src/daily.js` bestaat nog niet; veldnamen komen uit spec.md sectie 7 en zijn niet in code geverifieerd.
