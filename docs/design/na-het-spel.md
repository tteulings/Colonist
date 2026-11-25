# Katan PWA: bouwspecs na het spel (eindscherm, review, lessen, Terugblik, Bots)

Dit document is de build-klare specificatie van 28 schermen uit het ontwerp "na het spel": eindscherm, reviewoverzicht met alle tabs, spelerpagina, stapmodus, Dagpuzzel-reviewbanner, Lessen, Terugblik en Bots. Bronnen zijn `DESIGN-SYSTEM.md` (tokens, regels), `post/design.md` (incl. v2 en v2.1), de mocks `post/mock/*-v2.html` en de screenshots `post/mockshots-v2/`. Maten (px) zijn gemeten in de mocks op 360 breed (Playwright, `measure.cjs`); wat niet in een mock staat is gemarkeerd "(voorstel)". Alle cijfers in de mocks zijn voorbeelddata; de kolom Data zegt waar het getal in de app vandaan komt. Iconen en knoppen: de huidige app (`src/ui-icons.js`, `.btn` uit `themes/base.css`) wint, zie "Knop" in Gedeelde onderdelen en hoofdstuk "Iconen". De mocks zijn opnieuw gegenereerd met die iconen en knoppen.

## Index

| Nr | Scherm | Mock |
| --- | --- | --- |
| P01 | Eindscherm A | end-a |
| P02 | Eindscherm, review bezig | end-a-busy |
| P03 | Eindscherm, eerste spel | end-a-first |
| P04 | Eindscherm, review mislukt | end-a-error |
| P05 | Review Overzicht A | rv-a |
| P06 | Review Overzicht, bezig | rv-a-busy |
| P07 | Review laden | rv-loading |
| P08 | Review Overzicht, fout | rv-a-error |
| P09 | Tab Winkans | rv-winkans |
| P10 | Tab Geluk | rv-geluk |
| P11 | Tab Zetten | rv-zetten |
| P12 | Tab AI | rv-ai |
| P13 | Tab AI offline | rv-ai-offline |
| P14 | Spelerpagina | rv-player |
| P15 | Stapmodus | rv-step |
| P16 | Dagpuzzel-review (banner) | rv-daily |
| P17 | Lessen thuis | lessons-home |
| P18 | Les en oefenen | lessons-practice |
| P19 | Lessen leeg | lessons-empty |
| P20 | Terugblik, lijst Spellen | history-list |
| P21 | Terugblik leeg | history-empty |
| P22 | Terugblik, spelsheet | history-sheet |
| P23 | Bots | bots |
| P24 | Eindscherm, bot wint | end-a-botwin |
| P25 | Stapmodus, goede zet | rv-step-good |
| P26 | Stapmodus, Waarom?-sheet | rv-step-why |
| P27 | Terugblik, spel verwijderen | history-delete |
| P28 | Terugblik, spelsheet niet beoordeeld | history-sheet-new |
|  | Hoofdstukken: Gedeelde onderdelen, Iconen, Gaten en tegenstrijdigheden |  |

## Gedeelde onderdelen (rijen verwijzen hiernaar)

Token-afkortingen: `panel` = `--panel` #FDFBF6 (nacht #172630), rand 1px `--panel-border`; `chip` = `--chip` #FFF (nacht #1E303A); `ink` #2E3A3D; `heading` #22302F; `soft` = `--ink-soft` #5A6366; `primary` #1F5F66 met tekst #FFF9F2; `teal-soft` #E6F4F1 met tekst #1F6E77; `good` #3A7324 (alleen Jij); `danger` #A8402C (alleen Jij); `sea` = zee-achtergrond. Alle schermen zijn `sea` met witte kop, kaarten `panel` radius 20, gutter 10 (kaart 340 breed op 360), kaartpadding 14-15, gap tussen kaarten 12.

| Naam | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- |
| Subkop (niveau 2) | balk 56; terug `rnd` 44x44 knop radius 10 (huidige `.btn.icon-only`: wit `--btn`, rand 1px #D9CEB6, schaduw 0 1px 2px); h1 21/650 wit; subregel 11.5/700 wit op donkere pil `rgba(8,40,52,.62)`; rechts `rnd` 44 (Uitleg) | wit op sea | Terug = nav-stack pop. Uitleg opent (i)-sheet |
| Knop (huidige app-look) | secundair `.btn`: min 48 hoog (44 `sm`), radius 10, `--btn` wit (nacht #20323C), rand 1px #D9CEB6 (nacht #344B56), schaduw 0 1px 2px rgba(60,50,30,.08), 16/650 Figtree, icoon 24 links van de tekst (gap 8). Primair `.btn.pri`: radius 10, verloop #22666D naar #1C585F (nacht #2B7978 naar #226766), rand 1px #164C52 (nacht #3A8E8C), schaduw 0 1px 2px rgba(16,60,66,.22), 0 6px 16px rgba(20,84,92,.24), 19/650 Outfit. Icoon-alleen: 44x44, radius 10, zelfde look als secundair. Chips en tabs blijven pillen | wit / teal | Geen cirkelknoppen en geen doorschijnende knoppen op zee meer (vervalt uit DESIGN-SYSTEM 5 "Icon button") |
| Roottabkop (niveau 1) | h1 26/650 wit; subregel pil; tandwiel 44x44 `gear` rechts (knoplook als hierboven); geen terugpijl | wit op sea | Tandwiel opent Instellingen |
| Review-tabs | tray 340x52, 5 knoppen 63x44, 12.5/700; actief wit + `heading`, inactief `soft` | `panel` tray | role=tablist; tik wisselt tab zonder scrollreset van de kop |
| Segment Spellen/Lessen | tray 340x52, 2 knoppen 164x44, 14/700 | actief `chip` + heading | Wisselt Terugblik-subscherm |
| Eyebrow op sea | 12.5/800 wit op donkere pil |  | Alleen label |
| Drie-tegels (Start/Geluk/Keuzes) | kaart 340x157, tegels 98x127 (`chip`, radius 12): icoon, titel 16/800, regel 12.5/650 `soft`, max 2 regels | neutraal, geen kleurbetekenis | Tik opent het bijbehorende tabblad (Start: Winkans, Geluk: Geluk, Keuzes: Zetten) |
| Momentrij | 310x56 knop; beurt 12.5/800 `soft`, tekst 14/650, % 15/800 rechts | % `good`/`danger` alleen voor Jij | Tik: opent stapmodus op die zet |
| Klasse-chip | 21 hoog, 12.5/800: "Misser" #8D3A22 op #F9DFD3, "Kon beter" #7A5A12 op #F3E9D0 |  | Niet interactief |
| Tabbar (niveau 1) | 4 items 88x56, label 11.5/700, pil 56x30; actief teal-soft + 800 |  | Spelen, Dagpuzzel (stip bij niet gespeeld), Terugblik, Bots |
| Dock (eindscherm) | hoogte 72 (`--dock-h`), ondiep opaak met bovenrand; Review 141x49 secundair, Revanche 185x49 primair | `primary` | Scrollpadding onderaan = dock + 16 |
| Sheet | radius 22 boven, grab-handle, titel 20/650, sluit 44x44, sticky voet met 1 primaire knop | `--sheet` | Sluit: X, scrim, omlaag vegen, Terug (nav.js laagstapel). Animatie 260 ms ease-out (voorstel); reduced motion: 120 ms fade |

Standaard toegankelijkheid voor alle schermen: elk icoon-alleen-element heeft `aria-label`; tapdoelen >= 44x44, 8 ertussen; tekst >= 11.5; `prefers-reduced-motion` (`data-motion`) maakt schuif- en pulsanimaties tot fades; focusvolgorde = leesvolgorde boven naar onder; Terug-knop eerst. Alleen Jij krijgt groen/rood als betekenis; bots altijd neutrale inkt met zetelkleur alleen als ring.

---

### P01 Eindscherm A

&#91;image: P01 Eindscherm A (voorbeelddata)\]

Donker: zie mockup end-a-360-dark.png

Doel: In een oogopslag tonen wie won en hoe, en twee volgende stappen (Review, Revanche) aanbieden.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Home-knop | icoon `home` (huidige set) | 44x44 knop radius 10, x12 y10 | `--btn` wit, icoon heading | Naar Spelen (vervangt "Beginscherm"-pil) |
| Titel | "Spel afgelopen" | h1 21/650 | wit op sea |  |
| Winnaarkaart | avatar winnaar, "Jij wint!", "10 punten · 22 beurten · 11 min" | kaart 340x94; h2 28/700; sub 14/650 | `panel`, heading, `soft` | Niet interactief |
| Uitslagkaart | kop "Uitslag" 16/800 + "tik voor de details" 12.5/650 | kaart 340x475 | `panel` |  |
| Spelerrij (x4) | rang 16/800, avatar 36 met ring 3px zetelkleur, naam 16/800, punten 28/700 rechts, bronbalk, bij Jij twee chips | rij 338x122 (Jij) / ca. 98 (bots) radius 10; rij Jij getint 7% `--p0` | tint 7% zetelkleur | Tik rij: spelerpagina (P14) van die speler |
| Bronbalk | segmenten dorpen, steden, weg, kaart met icoon `settlement`, `city`, `road`, `devcard` en aantal | hoogte 22, radius 5; breedte evenredig | neutraal teal 100/55/32/16% (#1F5F66 solide eerste) , geen zetelkleur | Alleen visueel; `role=img` met aria "3 dorpen, 2 steden, 2 weg, 1 kaart" |
| Chip Precisie | "Precisie 57" | 28 hoog, 12.5/700, radius 99 | neutraal grijs 8% | Alleen bij Jij; niet interactief |
| Chip Geluk | "Geluk 10 kaarten" met driehoek omhoog/omlaag | 28 hoog | neutraal | Alleen bij Jij |
| Winkanskaart | "Winkans door het spel", "open", minigrafiek, "start" / "beurt 22" | kaart 340x173; labels 12.5/650 | `panel`; lijn Jij in `--p0`, bots dun neutraal | Tik: Review tab Winkans (P09) |
| Lessenkaart | `lessons` icoon, "Jouw les: Startplek", "Zwakke start in 3 van je 5 potjes.", knop "Bekijk" | kaart 340x88; knop 74x44 | `panel` | Tik "Bekijk": les (P18) |
| Dock | Review (badge "klaar"), Revanche + "dezelfde instellingen" | zie Dock; badge 40x18 11.5/800 op `--accent` #D9714E tekst #2A1408 | Revanche `primary` 19/650 | Review: P05. Revanche: nieuw spel met zelfde instellingen |

Staten:

- Normaal (dit scherm), review klaar: badge "klaar", Precisie getal.
- Bezig (P02), eerste spel (P03), fout (P04), bot wint (P24).
- Bots-rijen hebben nooit Precisie/Geluk-chips; wel tap-door.

Teksten: "Spel afgelopen", "Jij wint!", "10 punten · 22 beurten · 11 min", "Uitslag", "tik voor de details", "Precisie", "Geluk", "10 kaarten", "Winkans door het spel", "open", "start", "beurt 22", "Jouw les: Startplek", "Zwakke start in 3 van je 5 potjes.", "Bekijk", "Review", "klaar", "Revanche", "dezelfde instellingen". Bij verlies: P24 (winnaarkaart noemt de winnaar met naam, "Blaauw wint").

Interactie:

1. Tik Home-knop: naar Spelen, 200 ms crossfade.
2. Tik spelerrij: P14 van die speler, push 260 ms schuif.
3. Tik Winkanskaart: P09.
4. Tik Review: P05 (bij eerste spel is Review primair, P03).
5. Tik Revanche: start spel met dezelfde instellingen.
6. Scroll: bovenste kaarten blijven zichtbaar boven de dock; padding onder = 72 + 16.

Toegankelijkheid: Home `aria-label="Naar start"`; rij is knop met aria "Jij, 1e, 10 punten"; chips tekst voldoende; focusvolgorde Home, rijen 1-4, Winkanskaart, Bekijk, Review, Revanche; reduced motion: geen schuif, fade.

Data: Punten/beurten/tijd uit het afgelopen spel (`game.js` eindstand, speelduur); rang en bronnen (dorpen/steden/weg/kaart) uit `_rvScoreHtml()` in `review-game.js`; Precisie uit review-samenvatting `s` (`review-game.js`, `_rvWhyBars`), pas zichtbaar als de review klaar is; Geluk in kaarten uit `review-luck.js`; Winkanslijn uit de review-analyse (`review.js`); les uit `buildLessons()` (`lessons-eval.js`). Voorbeeld: alle waarden.

### P02 Eindscherm, review bezig

&#91;image: P02 Eindscherm, review bezig (voorbeelddata)\]

Donker: zie mockup end-a-busy-360-dark.png

Doel: Het scorebord direct tonen terwijl de review nog rekent, zonder dat getallen later verspringen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Alles uit P01 | identiek, zelfde posities | zie P01 |  |  |
| Chip Precisie | "Precisie –" (pijl-streep) | 76x28 (kleiner dan klaar: 84x28; chip Geluk schuift 8 px) | neutraal, klasse `wait` | Verandert bij klaar naar getal; breedte mag 8 px springen, rij is links uitgelijnd |
| Reviewknop | "Review 9/25" met voortgangsring | 141x49 | secundair | Tik: P06 |

Staten:

- Bezig: ring + "9/25" (beslissing 9 van 25, bepaald, geen seconden).
- Klaar: wordt P01 (badge "klaar").

Teksten: "Precisie", "–", "Review 9/25". Alle overige als P01.

Interactie:

1. Tik Review: P06, push 260 ms.
2. Klaar-event: ring wordt badge "klaar" (150 ms fade), Precisie-getal verschijnt (150 ms fade, geen layoutshift van andere elementen).

Toegankelijkheid: Reviewknop `aria-label="Review, bezig, zet 9 van 25"`; voortgang `aria-live=polite` alleen bij start en klaar (niet per zet); reduced motion: geen ring-animatie, statische ring.

Data: Voortgang "9/25" uit review-voortgang (`review.js` aantal geanalyseerde van totaal beslissingen); alle andere als P01. Voorbeeld: 9/25.

### P03 Eindscherm, eerste spel

&#91;image: P03 Eindscherm, eerste spel (voorbeelddata)\]

Donker: zie mockup end-a-first-360-dark.png

Doel: Een nieuwe speler naar zijn eerste review sturen in plaats van naar Revanche.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Alles uit P01 behalve |  |  |  |  |
| Lessenkaart | "Je eerste les" / "Komt klaar na je review." (geen knop) | kaart 340x88 | `panel` | Niet interactief |
| Dock | Revanche secundair (links), Review primair (rechts) met sub "zie wat beter kon" | 2x ca. 49 hoog | Review `primary` | Review: P05; Revanche: nieuw spel |

Staten: alleen bij 0 eerder beoordeelde potjes. Daarna vervalt dit scherm voor P01.

Teksten: "Je eerste les", "Komt klaar na je review.", "Revanche", "Review", "zie wat beter kon".

Interactie:

1. Tik Review: P05 (met laadstatus P07 indien nog niet berekend).
2. Tik Revanche: nieuw spel.

Toegankelijkheid: primaire knop krijgt eerste focus in de dock; rest als P01.

Data: "eerste spel" = aantal afgeronde spellen in `history.js` gelijk aan 1 (voorstel: `stats.js` telling). Voorbeeld.

### P04 Eindscherm, review mislukt

&#91;image: P04 Eindscherm, review mislukt (voorbeelddata)\]

Donker: zie mockup end-a-error-360-dark.png

Doel: Een gestopte analyse eerlijk melden zonder dat het scorebord waarde verliest.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Foutkaart | icoon `info` neutraal, "Review gestopt bij zet 9 van 25", "Je spel is bewaard.", knop "Opnieuw" | kaart 340x88; h3 16/800; knop 120x44 | `panel`, neutrale inkt, geen rood | "Opnieuw" herstart analyse vanaf zet 9 |
| Uitslag e.d. | als P01, Precisie "–" |  |  |  |
| Reviewknop | "Review" met waarschuwingsicoon (alert) | 141x49 | secundair | Opent P08 |

Staten: fout; na "Opnieuw" gaat het scherm naar P02.

Teksten: "Review gestopt bij zet 9 van 25", "Je spel is bewaard.", "Opnieuw".

Interactie:

1. Tik Opnieuw: kaart verdwijnt (150 ms), Review-knop toont ring (P02).
2. Tik Review: P08.

Toegankelijkheid: foutkaart `role=status`, `aria-live=polite`; fout is niet alleen kleur (icoon + tekst).

Data: foutstatus en laatste geanalyseerde zet uit `review.js`/`review-again.js` (opnieuw); "9 van 25" uit voortgang. Voorbeeld.

### P05 Review Overzicht A

&#91;image: P05 Review Overzicht A (voorbeelddata)\]

&#91;image: P05 Review Overzicht A, vervolg (voorbeelddata)\]

Donker: zie mockup rv-a-360-dark.png

Doel: Het oordeel over je potje in 3 seconden: Precisie, de drie tegels, sleutelmomenten.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Review", "25 beslissingen", Uitleg | zie Subkop |  | Uitleg: (i) sheet met methode ("Beoordeeld met v1.55 · Standaard" staat daar, niet in de kaart) |
| Review-tabs | Overzicht (actief), Winkans, Geluk, Zetten, AI | zie tabs |  | Wisselt tab |
| Verdictkaart | "Jij won met 10-7"; Precisie-wijzer: getal 57 (44/700), "Precisie" 15/800, "bots scoren meestal 49 tot 64" 12.5/650; 5 puntjes "Je gemiddelde komt na 5 potjes (nu 1)" | kaart 340x166; h2 20/650; dial 310x78 achtergrond #EAF3F2 | `panel`, dial teal-soft tint | Niet interactief |
| Drie-tegels | Start "iets zwakker", Geluk "10 kaarten extra", Keuzes "3 missers, grootste in beurt 5" | zie Drie-tegels | neutraal | Tik opent tab |
| Sleutelmomenten | kop 16/800, "tik: zie het op het bord"; 3 rijen: "Beurt 12 Jij bouwde een stad 25%", "Beurt 10 Jij ruilde en bouwde 22%", "Beurt 7 Jij gooide 4, +2 kaarten 18%"; knop "Alle 15 momenten" | kaart 340x281; rij 310x56; knop 310x44 | % in `good` (stijging) of `danger` (daling), alleen Jij; driehoek omhoog/omlaag naast het % | Tik rij: stapmodus P15; knop: lijst alle momenten |
| Lessenkaart | "Jouw les: Startplek" + Bekijk | 340x88 |  | P18 |
| Spelers naast elkaar | rijen Punten (10, 6, 7, 6), Precisie (57, 61, 58, 70), Geluk ("10 kaarten", "2", "3", "9") met 4 avatars | kaart 340x219; waarden 20/700; chips 69x32 | Jij-kolom getint; bots neutraal, driehoek i.p.v. kleur | Tik avatar: spelerpagina P14 |
| AI-banner | "Vraag de coach", "Waarom won ik? Wat was mijn beste zet?" | kaart |  | Tik: tab AI (P12) |
| Voetregel | "Opnieuw" (link) | 44 hoog tapdoel | `soft` | Start review opnieuw (P06) |

Staten: klaar (dit scherm); bezig (P06); laden (P07); fout (P08); Dagpuzzel-variant (P16).

Teksten: "Jij won met 10-7", "Precisie", "bots scoren meestal 49 tot 64", "Je gemiddelde komt na 5 potjes (nu 1)", "Jouw potje in drie", "Start", "iets zwakker", "Geluk", "10 kaarten extra", "Keuzes", "3 missers, grootste in beurt 5", "Sleutelmomenten", "tik: zie het op het bord", "Alle 15 momenten", "Spelers naast elkaar", "Punten", "Precisie", "Geluk", "kaarten", "Vraag de coach", "Waarom won ik? Wat was mijn beste zet?", "Opnieuw". Bij verlies: "Jij verloor met 8-10" (voorstel, patroon "Jij won/verloor met X-Y").

Interactie:

1. Tik tab: wisselt inhoud, 150 ms fade (voorstel).
2. Tik tegel: bijbehorende tab, kop blijft staan.
3. Tik momentrij: P15 op die zet, push 260 ms.
4. Tik "Alle 15 momenten": lijst klapt uit (200 ms) of Winkans-tab met lijst (voorstel).
5. Tik "Opnieuw": herberekening, P06.

Toegankelijkheid: tabs `role=tablist/tab`, `aria-selected`; pijlen links/rechts wisselen tab; Precisie-dial `role=img` aria "Precisie 57, bots scoren meestal 49 tot 64"; focus: Terug, Uitleg, tabs, tegels, momenten; reduced motion: geen dial-animatie.

Data: Precisie `s` uit `_rvWhyBars` en review-samenvatting (`review-game.js`); botbereik "49 tot 64" uit `bot-stats.js` (Precisie per botniveau); "nu 1" = aantal beoordeelde potjes (`lessons-eval.js` items); tegels uit `_rvWhyBars(pid)` (start, luck, moves count/worst); Geluk kaarten uit `review-luck.js`; momenten uit `review-turn.js`/`review.js` grootste winkanssprongen (alleen eigen %); lessen `buildLessons()`. Voorbeeld: alle waarden.

### P06 Review Overzicht, bezig

&#91;image: P06 Review Overzicht, bezig (voorbeelddata)\]

&#91;image: P06 Review Overzicht, bezig, vervolg (voorbeelddata)\]

Donker: zie mockup rv-a-busy-360-dark.png

Doel: Rondkijken toestaan terwijl de analyse loopt, met eerlijke voortgang en zonder tijdelijke cijfers.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Voortgangskaart | "We bekijken je zetten", "Zet 9 van 25", 3 stappen Zetten (klaar), Winkans (nu), Geluk; noot "Je kunt al rondkijken. Cijfers verschijnen pas als ze vast staan." | kaart 340x180; stap 99x27 pil | klaar teal-soft #1F6E77; nu primary #1F5F66 + #FFF9F2; wacht neutraal | `aria-live=polite` bij stapwissel |
| Verdictkaart | "Jij won met 10-7", Precisie "–", "komt zodra de review klaar is" | kaart 340x141; "–" 44/700 | `panel` |  |
| Tegels | skeletons 98x96 | kaart 340x126 | skeleton `chip` | Niet interactief |
| Sleutelmomenten | skeleton kaart | 340x211 |  |  |
| Spelers naast elkaar | Punten gevuld; Precisie en Geluk tonen "–" in alle vier kolommen tot de review klaar is (zelfde regel als de hero: geen waarden die nog veranderen) | 340x219 | `soft` |  |

Staten: Zetten klaar, Winkans lopend, Geluk wacht; eindigt in P05.

Teksten: "We bekijken je zetten", "Zet 9 van 25", "Zetten", "Winkans", "Geluk", "Je kunt al rondkijken. Cijfers verschijnen pas als ze vast staan.", "komt zodra de review klaar is", "–".

Interactie:

1. Tabs blijven tapbaar; Zetten toont reeds klare zetten, rest skeleton.
2. Klaar: skeletons wisselen naar inhoud, 150 ms fade, hoogte vast (geen sprong).

Toegankelijkheid: voortgangsbalk `role=progressbar` `aria-valuenow=9` `aria-valuemax=25`; geen ETA in seconden; reduced motion: skeleton-shimmer uit.

Data: voortgang uit `review.js`; stappen = analysepassen (Zetten, Winkans, Geluk).Voorbeeld: 9/25.

### P07 Review laden

&#91;image: P07 Review laden (voorbeelddata)\]

Donker: zie mockup rv-loading-360-dark.png

Doel: Het openen van de review (inlezen van het spel) kort overbruggen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop + tabs | zie P05 (tabs inactief) |  |  | Tabs `aria-disabled` |
| Laadkaart | spinner/skeleton, "Review wordt geopend", "Je spel wordt ingelezen" | kaart 340 breed | `panel` | Verdwijnt zodra spel is ingelezen (< 1 s verwacht) |

Staten: laden; daarna P05 of P06.

Teksten: "Review wordt geopend", "Je spel wordt ingelezen".

Interactie: 1. Terug blijft actief en annuleert. 2. Klaar: fade 150 ms naar P05/P06.

Toegankelijkheid: `aria-busy=true` op de inhoud; reduced motion: statische skeleton.

Data: spel uit `history.js` (opgeslagen log) naar `review.js` laden. Geen getallen.

### P08 Review Overzicht, fout

&#91;image: P08 Review Overzicht, fout (voorbeelddata)\]

Donker: zie mockup rv-a-error-360-dark.png

Doel: Gestopte analyse tonen met herstelactie; afgerond blijft zichtbaar, rest "–".

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Foutkaart | icoon `info` (neutraal), "Analyse gestopt bij zet 9 van 25", "Wat al klaar is, staat hieronder.", knop "Opnieuw proberen" met icoon opnieuw | kaart 340 breed; knop 44 hoog | `panel`, neutrale inkt (geen rood) | Herstart vanaf zet 9 (P06) |
| Verdict | "Jij won met 10-7", Precisie "–", "komt zodra de review klaar is" |  |  |  |
| Tegels | Start "–", Geluk "–", Keuzes "–" | 98x96 |  | Tik: tab opent, toont wat klaar is |
| Spelers naast elkaar | zoals P05 |  |  |  |

Staten: fout; na herstart P06.

Teksten: "Analyse gestopt bij zet 9 van 25", "Wat al klaar is, staat hieronder.", "Opnieuw proberen".

Interactie: 1. Tik Opnieuw proberen: kaart wordt P06-voortgangskaart, 200 ms.

Toegankelijkheid: `role=status`; foutindicatie ook als icoon+tekst; focus naar foutkaart bij binnenkomst.

Data: foutstatus/stopzet uit `review.js` (worker `lessons-worker.js`/`replay-odds-worker.js`); voorbeeld 9/25.

### P09 Tab Winkans

&#91;image: P09 Tab Winkans (voorbeelddata)\]

&#91;image: P09 Tab Winkans, vervolg (voorbeelddata)\]

Donker: zie mockup rv-winkans-360-dark.png

Doel: Het winkansverloop per speler tonen en per moment uitleggen, in neutrale taal.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop + tabs | "Review", "25 beslissingen", Uitleg; tabs met Winkans actief | zie gedeeld |  |  |
| Grafiekkaart | kop "Winkans" 16/800 + (i) "Hoe lees ik dit?" 44x44; y-as 0/50/100% (12/700, `soft`); x "start" tot "beurt 22"; stippellijn = einde beginopstelling (regel "Stippellijn: einde beginopstelling" 12.5/650); gekozen moment = effen verticale lijn + witte stip met Jij-rand | kaart 340x364; grafiek 300x170 (viewBox) | `panel`; Jij `--p0` 3,2 dik; bots 1,6 dik in zetelkleur (identiteit), geen groen/rood-betekenis | Tik/sleep op de grafiek: marker verplaatst, momentkaart ververst |
| Legenda | 4 avatar-knoppen 44x44 (avatar 32) + "Tik: lijn aan of uit" | rij 310x44 | gekozen: 2px accent-ring; uit: 40% dekking | `aria-pressed`; schakelt lijn aan/uit |
| Momentkaart | kop "Beurt 7" + "sleep op de grafiek"; zin "Jij gooide 4 en kreeg 2 kaarten."; 3 balken Voor de worp / Na de worp / Einde beurt: gestapelde winkansbalk (Jij, Blaauw, Geelen, Groen in zetelvolgorde) + Jij-% rechts | kaart 340x299; rij 44; balk 136x16 radius 4 | Jij `--p0`, bots zetelkleur (identiteit); alleen het Jij-% krijgt driehoek en `good` (stijging) of `danger` (daling) | Alleen weergave |
| Knop | "Bekijk dit moment op het bord" + chevron | 310x48 | secundair | Opent stapmodus (P15) op dit moment |

Staten: klaar (dit); laden (skeleton grafiek en kaart); geen data ("Nog geen winkans, review loopt"); Jij-lijn uit.

Teksten: "Winkans", "Hoe lees ik dit?", "start", "beurt 22", "Stippellijn: einde beginopstelling", "Tik: lijn aan of uit", "Beurt 7", "sleep op de grafiek", "Jij gooide 4 en kreeg 2 kaarten.", "Voor de worp", "Na de worp", "Einde beurt", "Bekijk dit moment op het bord". Verboden: "settlement", "trade", "pt", "procentpunt".

Interactie:

1. Tik of sleep op de grafiek: marker springt naar de dichtstbijzijnde beurt, momentkaart ververst 150 ms.
2. Tik legenda-avatar: lijn van die speler uit of aan.
3. Tik "Bekijk dit moment op het bord": P15 (push 260 ms).
4. Tik (i): sheet met uitleg van de lijnen.

Toegankelijkheid: grafiek `role=img` met samenvatting ("Winkans per speler. Jij begon op 25 procent en eindigde op 100 procent."); marker verplaatsbaar met pijltoetsen (`role=slider`, `aria-valuetext` "Beurt 7"); balken `role=img` aria "Jij 45 procent, Blaauw 10, Geelen 28, Groen 17"; lijn onderscheidt zich ook door dikte en avatar, niet alleen kleur.

Data: reeks per speler uit review-analyse (`review.js`, `review-turn.js`); zin uit `review-explain.js` / `review-reasons.js` (vertalen volgens i18n-lijst); voor/na de worp en einde beurt uit de winkans per tussenstand. Voorbeeld: alle waarden (beurt 7 = +18% voor Jij, zoals in P05).

### P10 Tab Geluk

&#91;image: P10 Tab Geluk (voorbeelddata)\]

&#91;image: P10 Tab Geluk, vervolg (voorbeelddata)\]

Donker: zie mockup rv-geluk-360-dark.png

Doel: Laten zien wie meer of minder geluk had, in kaarten en niet als som van procenten.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop + tabs | "Review", "25 beslissingen", Uitleg; Geluk actief | zie gedeeld |  |  |
| Kaart "Geluk per speler" | kop 16/800 + "tik een rij"; 4 rijen: avatar 36, naam 14/800, "10 kaarten meer" / "2 kaarten minder" met driehoek rechts, balk rond nul (middenstreep, 14 hoog) | kaart 340x283; rij 310x56 (is de spelerkeuze; geen aparte avatar-segmenten) | balken neutraal (Jij teal, bots `--ink-faint`); ALLEEN Jij krijgt `good` of `danger` op de tekst; gekozen rij 2px accent-ring | Tik rij: kiest de speler voor het detail eronder |
| Samenvatting speler | "Jouw geluk" + (i) 44x44; "+10" 30/700 + "kaarten extra"; 3 tegels Zitplaats ("+2 kaarten", icoon `settlement`), Aantal ("+5 kaarten", `dice`), Soort ("+3 kaarten", `devcard`) | kaart 340x218; tegel 98x94 | `chip` tegels, neutraal | Alleen weergave |
| Lijst "Elke worp" | kop 16/800; segment "Grootste eerst" / "Op volgorde" 149x44; rijen "Beurt 7 · Jij gooide 4: 3 kaarten, 0,7 verwacht · +2,3" | kaart 340x289; rij 310x56 | getal alleen voor Jij gekleurd (`good`); bots neutraal | Tik rij: stapmodus bij die beurt (P15) |

Staten: klaar (dit); laden (skeleton); speler gekozen = bot (kopje "Geluk van Blaauw", neutrale driehoeken); geen data.

Teksten: "Geluk per speler", "tik een rij", "10 kaarten meer", "2 kaarten minder", "Jouw geluk", "kaarten extra", "Zitplaats", "Aantal", "Soort", "Elke worp", "Grootste eerst", "Op volgorde", "Jij gooide 4: 3 kaarten, 0,7 verwacht". Geen "winkans uit geluk, in totaal +51%" (som verboden, principe 2).

Interactie: 1. Tik speler: detail 150 ms fade. 2. Segment wisselt sortering. 3. Tik rij: P15. 4. Tik (i): sheet "Hoe lees ik dit?" (kaarten t.o.v. wat je gemiddeld verwacht).

Toegankelijkheid: balken `role=img` aria "Jij 10 kaarten meer dan verwacht"; rijen spelerkeuze met `aria-pressed`; segment `role=radiogroup`; driehoek altijd naast tekst "meer"/"minder".

Data: `review-luck.js` en `src/review/luck-mc.js`; verwachting per worp ("0,7 verwacht"); de drie tegels splitsen de som (2+5+3 = 10) in zitplaats, aantal en soort kaarten (afgeleid, niet geverifieerd in code). Voorbeeld.

### P11 Tab Zetten

&#91;image: P11 Tab Zetten (voorbeelddata)\]

Donker: zie mockup rv-zetten-360-dark.png

Doel: Jouw missers per beurt tonen en doorlopen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop + tabs | "Review", "25 beslissingen", Uitleg; Zetten actief | zie gedeeld |  |  |
| Doorloopknop | icoon `play` + "Loop door jouw zetten", regel "5 om te bekijken" (12/600) | 340x56 | `primary` (knop-look) | Opent stapmodus P15 op de eerste misser |
| Samenvatting | "3 missers" 16/800, rechts "en 2 keer kon beter" (geen "3,1% verloren per zet" som) | in lijstkaart 340x417 | `soft` |  |
| Segment | "Missers" / "Alle" | 149x44 | tray `--soft-bg` | Filtert lijst |
| Lijst | rij: beurt, klasse-chip ("Kon beter" / "Misser"), Nederlandse zetzin met grondstofchips, eigen % met driehoek en chevron | rij 310x74 | % `danger` (Jij); chips #8D3A22 op #F9DFD3 / #7A5A12 op #F3E9D0 | Tik: P15 |

Staten: met missers (dit); geen missers (kaart "Geen missers. Goed gespeeld." en knop "Loop door je beste zetten" op P25); laden (skeleton).

Teksten: "Loop door jouw zetten", "5 om te bekijken", "3 missers", "en 2 keer kon beter", "Missers", "Alle", "Kon beter", "Misser" (labels "Fout"/"Blunder" vervallen).

Interactie: 1. Tik rij of knop: P15. 2. Segment: lijst filtert 150 ms.

Toegankelijkheid: rij is knop met aria "Beurt 5, misser, weg bouwen, 19 procent winkans verloren"; klasse niet alleen kleur (tekst); knop `aria-label` "Loop door jouw zetten, 5 om te bekijken".

Data: zetlijst `s.worst`, per zet klasse en delta uit `review.js`; labels uit `review-reasons.js`. Voorbeeld.

### P12 Tab AI

&#91;image: P12 Tab AI (voorbeelddata)\]

Donker: zie mockup rv-ai-360-dark.png

Doel: Vragen stellen over dit potje, ook al loopt de review nog.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "AI-coach" + label "bèta" | zie Subkop |  |  |
| Intro | "Vraag over dit potje", "De coach kent je zetten, de dobbelstenen en je Precisie. Antwoorden kunnen fout zijn." | kaart | `panel` |  |
| Vraagchips | "Waarom won ik?", "Beste zet van het spel", "Wat doe ik steeds fout?" | chip 44 hoog, 14/700 | `chip` | Tik: stelt vraag, vult antwoordgebied |
| Voortgangsregel | "Review loopt (9 van 25). Je kunt al vragen stellen." | 12.5/650 | `soft` | Alleen bezig |
| Invoer vast onder | veld "Vraag" + knop "Vraag" | veld 44+ hoog, knop 44 | `chip`/primary | Verstuurt; toont antwoordbubbel |

Staten: leeg, bezig-met-antwoord (skeleton), antwoord, offline (P13), review bezig (regel).

Teksten: zoals boven.

Interactie: 1. Tik chip: vraag in veld en verzend. 2. Verzend: antwoord streamt, 200 ms fade-in.

Toegankelijkheid: veld `aria-label="Vraag"`; antwoord `aria-live=polite`; toetsenbord mag dock niet bedekken (`visualViewport`).

Data: `review-ai.js` en `review-ai-page.js`; `ai-analysis.js` voor context; online-status `navigator.onLine`. Voorbeeld.

### P13 Tab AI offline

&#91;image: P13 Tab AI offline (voorbeelddata)\]

Donker: zie mockup rv-ai-offline-360-dark.png

Doel: Duidelijk maken dat alleen de coach internet nodig heeft.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Offlinekaart | icoon wifi-uit, "Je bent offline", "De coach heeft internet nodig. De rest van de review werkt gewoon." | kaart | neutrale inkt (geen rood) | Verdwijnt bij online-event |
| Vraagchips | "Waarom won ik?", "Beste zet van het spel" (disabled) | 44 hoog | disabled: streeprand, faint | Niet tapbaar |
| Invoer | disabled |  |  |  |

Staten: offline; online herstelt P12.

Teksten: "Je bent offline", "De coach heeft internet nodig. De rest van de review werkt gewoon.".

Interactie: 1. Terug online: kaart fade 150 ms, chips actief.

Toegankelijkheid: `role=status`; disabled-controls `aria-disabled`.

Data: `navigator.onLine` + `online`/`offline` events. Geen getallen.

### P14 Spelerpagina

&#91;image: P14 Spelerpagina (voorbeelddata)\]

&#91;image: P14 Spelerpagina, vervolg (voorbeelddata)\]

Donker: zie mockup rv-player-360-dark.png

Doel: Eén speler uitleggen: waarom gewonnen/verloren en waar het beter kon.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | naam ("Jij"), "10 punten · winnaar" | zie Subkop |  | Uitleg |
| Waarom-kaart | "Waarom gewonnen" 20/650, zin "Je won met wat geluk: 10 kaarten meer dan verwacht." + Drie-tegels | kaart 340x239 |  | Tegels openen tab |
| Missers | "Waar het beter kon", "3 missers", rijen: "Beurt 5 Misser Weg bouwen: \[1 hout\]\[1 baksteen\]. Beter: dorp op 6-9-erts. 19%" | kaart 340x281; rij 310x74; chip 21 hoog; grondstofvierkantje 21x15 | % `danger` (Jij) | Tik rij: P15 |
| Winkanskaart | "Winkans", "jij dik", minigrafiek | kaart 340x210 |  | Tik: P09 |
| Knop | "Loop door jouw zetten" | 310x48 | secundair | P15 |

Staten: Jij (winnaar/verliezer); bot (neutraal, titel "Blaauw", "6 punten", geen groen/rood, driehoek bij Geluk).

Teksten: "Waarom gewonnen", "Waar het beter kon", "3 missers", "Misser", "Kon beter", "Winkans", "jij dik", "Loop door jouw zetten". Bij verlies "Waarom verloren".

Interactie: 1. Tik rij: P15. 2. Tik tegel: tab. 3. Terug: P05.

Toegankelijkheid: rijen knop met volledige aria; grondstoffen met tekst "1 hout" (niet alleen kleur).

Data: `_rvWhyBars(pid)` (`review-game.js`), `s.worst`; zetzinnen `review-explain.js`; i18n-controle met `tests/i18n-walk.js`. Voorbeeld.

### P15 Stapmodus

&#91;image: P15 Stapmodus (voorbeelddata)\]

Donker: zie mockup rv-step-360-dark.png

Doel: Het bord als held; per zet de winkans en wat beter was.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Jij · beurt 5", "zet 3 van 14", sluit 44 | zie Subkop |  | Sluit terug naar herkomst |
| Bordkaart | bord met winkanspillen erboven: "Jij 77%", "Geelen 12%", "Blaauw 8%", "Groen 3%" | kaart 340x341; pil 21 hoog 12.5/800 | Jij `--p0` fill met wit; bots neutrale pil | Bord pan/zoom (bestaand) |
| Zetkaart | chip "Misser", titel "Weg gebouwd" 16/800, "19%" 15/800, regel "Beter was een dorp op erts 6 en graan 9." | kaart 336x131 | % `danger` | Niet interactief |
| Knoppen rij 1 | "Waarom?" , "Beter: dorp" | 151x48 | secundair | Waarom: sheet met lange uitleg. Beter: toont alternatief op bord |
| Knoppen rij 2 | "Vorige", "Sleutelbeurt", "Volgende" | 96/104/120 x 48 | Volgende `primary` | Navigeert zet |

Staten: misser (dit), kon beter, goede zet (P25: chip "Goed", % `good`, alleen "Waarom?"), Waarom?-sheet open (P26), tijdens animatie.

Teksten: "Jij · beurt 5", "zet 3 van 14", "Misser", "Weg gebouwd", "Beter was een dorp op erts 6 en graan 9.", "Waarom?", "Beter: dorp", "Vorige", "Sleutelbeurt", "Volgende".

Interactie: 1. Volgende/Vorige: bord animeert zet 300 ms (reduced: direct), pillen tellen 200 ms. 2. Sleutelbeurt: springt naar grootste verlies. 3. Waarom?: sheet.

Toegankelijkheid: bord heeft tekstalternatief (kaartzin); knoppen 48 hoog; `aria-live=polite` bij zetwissel; swipe links/rechts als extra (niet enige).

Data: zetten en winkans per zet uit `review-turn.js` / `review.js`; alternatief uit `review-refine.js`; pillen = winkans na de zet. Voorbeeld.

### P16 Dagpuzzel-review (banner)

&#91;image: P16 Dagpuzzel-review (banner) (voorbeelddata)\]

Donker: zie mockup rv-daily-360-dark.png

Doel: Dezelfde review voor een Dagpuzzel, met uitleg dat hij niet meetelt voor Lessen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Review", "Dagpuzzel di 24 nov" | zie Subkop |  |  |
| Banner | icoon `puzzle` (nieuw, geen equivalent), "Dagpuzzel di 24 nov. Telt niet mee voor Lessen." | 1 regel, 36 hoog (voorstel) | accent-tekst #A84E2F op #FCEBE3 | Niet interactief |
| Rest | als P05 maar zonder lessenkaart |  |  |  |

Staten: klaar/bezig/fout als P05-P08.

Teksten: "Dagpuzzel di 24 nov. Telt niet mee voor Lessen." (datum, nooit nummer).

Interactie: 1. Terug: naar Dagpuzzel-uitslag (daily 04a) of Mijn dagen, afhankelijk van herkomst.

Toegankelijkheid: banner `role=note`.

Data: dag uit `daily.js` (dagkey `days[day]`, zie daily.md); rest als P05. Dagpuzzel-reviews voeden `buildLessons()` niet.

### P17 Lessen thuis

&#91;image: P17 Lessen thuis (voorbeelddata)\]

&#91;image: P17 Lessen thuis, vervolg (voorbeelddata)\]

Donker: zie mockup lessons-home-360-dark.png

Doel: Eigen terugkerende fouten tonen als korte, visuele lessen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Roottabkop | "Terugblik", "Uit je 5 beoordeelde potjes", tandwiel | zie Roottabkop |  |  |
| Segment | Spellen / Lessen (actief) | 164x44 |  |  |
| Eyebrow | "Jouw lessen" + (i) "Hoe lees ik dit?" | rnd 44 |  | (i): "Winkans in %. Elk balkje is één potje." |
| Lescard | titel 20/800 "Startplek", tag "Jouw focus" (21 hoog, `primary`), groot "7%" 30/700, "winkans per potje", balkstrip met per balk datum + getal + gewonnen/verloren-stip, uitleg "Elk balkje is één potje. Je start mist vaak erts en baksteen." | kaart 340x248 | `panel`; balken neutraal teal; stip win/verlies alleen Jij | Tik: P18 |
| 2e les | "Beurt te vroeg beëindigd", "4%", "Je liet kaarten liggen die je kon uitgeven." | kaart 340x229 |  |  |
| Sterke kaart | "Dit gaat goed", "Rover en 7", "8 kaarten kwijt tegen 14 bij de bots.", chip "Sterk" |  | chip `good` | Tik: les |
| Te weinig | "Nog te weinig om te zeggen": "Wat bouw je", "Nog 1 potje nodig.", "Ruilen", "Nog 1 potje nodig." met voortgangsbalk | rij 56 | neutraal, geen %-claim | Niet interactief |
| Tabbar | Terugblik actief | 56 hoog |  |  |

Staten: met lessen (dit); leeg (P19); minder dan genoeg data (alleen "Nog te weinig").

Teksten: "Terugblik", "Uit je 5 beoordeelde potjes", "Jouw lessen", "Startplek", "Jouw focus", "winkans per potje", "Beurt te vroeg beëindigd", "Dit gaat goed", "Rover en 7", "Sterk", "Nog te weinig om te zeggen", "Wat bouw je", "Ruilen", "Nog 1 potje nodig.", "Hoe lees ik dit?".

Interactie: 1. Tik lescard: P18, push 260 ms. 2. Tik (i): sheet. 3. Segment: P20.

Toegankelijkheid: lescard knop met aria "Les Startplek, 7 procent winkans per potje"; balkstrip `role=img` met alt per balk; stippen: tekst "gewonnen/verloren" in aria.

Data: `buildLessons(items)` in `lessons-eval.js` (`MIN`, `WINDOW`, `CAT_IDS`), weergave `lessons.js`/`lessons-view.js`, rijen `lessons-row.js`; items uit opgeslagen reviews (`history.js`). Voorbeeld: alle waarden.

### P18 Les en oefenen

&#91;image: P18 Les en oefenen (voorbeelddata)\]

&#91;image: P18 Les en oefenen, vervolg (voorbeelddata)\]

Donker: zie mockup lessons-practice-360-dark.png

Doel: Eén les met bordvoorbeeld en een A/B-oefening.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Startplek", "Zwakke start in 3 van 5 potjes", Uitleg | zie Subkop |  |  |
| Voorbeeldkaart | kop "13 nov · gewonnen" + "beginopstelling"; twee opties "Jij koos" 23% winkans / "Beter" 32% winkans, elk een bordstukje met 4 hexen (bordcrop) | kaart 340x373; optie 151x210 | `f8f4ea` tegel; % 22/700 |  |
| Uitleg | "Jij koos: 2 keer hout, geen erts. Beter: erts én baksteen." | 14/400 |  |  |
| Knop | "Open in de review" | 310x44 | secundair | Opent review op die zet |
| Oefenkaart | "Oefen dit", "11 nov · beginopstelling", "Welke start is beter?", opties A en B (151x172) met letterbadge 26x26, knoppen "Kies A" "Kies B" | kaart 340x323; knoppen 151x52 | primary 19/650 | Kies: toont uitkomst (goed/fout, alleen over Jij) + volgende |
| Vraagkaart | "Vraag", chips "Hoe word ik hier beter in?", "Geef me één regel" | chip 196x44 / 148x44 |  | Stelt coachvraag (online) |

Staten: voor keuze; na keuze (goed `good`, anders `danger` + uitleg); geen oefenvoorbeeld meer; offline (vraagchips disabled).

Teksten: "13 nov · gewonnen", "Jij koos", "Beter", "winkans", "Open in de review", "Oefen dit", "Welke start is beter?", "Kies A", "Kies B", "Vraag", "Hoe word ik hier beter in?", "Geef me één regel".

Interactie: 1. Kies A/B: optie licht op 150 ms (accent-ring), resultaatkaart schuift in 200 ms. 2. Open in de review: P15.

Toegankelijkheid: A/B `role=radiogroup`; elk bord met tekst "dorp op hout 3, graan 9, erts 6"; uitkomst `aria-live`.

Data: `cropSvg`, `spotInfo`, `exModel` in `lessons-view.js`; winkans uit lessendata (`lessons-data.js`, `lessons-geo.js`); oefenvoorbeeld uit eigen potjes. Let op: `cropSvg` gebruikt nu standaardkleur #D1453A die vervalt (naar #B81E2E). Voorbeeld.

### P19 Lessen leeg

&#91;image: P19 Lessen leeg (voorbeelddata)\]

Donker: zie mockup lessons-empty-360-dark.png

Doel: Het leerlus-idee uitleggen (Speel, Review, Les) en naar de eerste review leiden.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Roottabkop + segment | "Terugblik", "Leer van je eigen potjes" |  |  |  |
| Kaart | icoon 52x52 (`lessons`), "Lessen komen uit je eigen fouten", 3 tegels "1 Speel een potje" (`dice`), "2 Start de review", "3 Zie je les" | kaart 340x318; tegel 97x72 | teal-soft | Niet interactief |
| Voortgang | "1 van 3 potjes beoordeeld" + balk |  |  |  |
| Knop | "Beoordeel je laatste potje" | 306x48 | `primary` | Opent review van laatste spel |

Staten: 0 beoordeeld (knop "Speel een potje" naar Spelen, voorstel); 1-2 beoordeeld (dit).

Teksten: "Leer van je eigen potjes", "Lessen komen uit je eigen fouten", "Speel een potje", "Start de review", "Zie je les", "1 van 3 potjes beoordeeld", "Beoordeel je laatste potje".

Interactie: 1. Tik knop: P05/P07.

Toegankelijkheid: stappen als geordende lijst; knop eerste focus.

Data: aantal beoordeelde potjes uit `lessons-eval.js` (`MIN.games` = 3); laatste spel uit `history.js`. Voorbeeld: 1 van 3.

### P20 Terugblik, lijst Spellen

&#91;image: P20 Terugblik, lijst Spellen (voorbeelddata)\]

&#91;image: P20 Terugblik, lijst Spellen, vervolg (voorbeelddata)\]

Donker: zie mockup history-list-360-dark.png

Doel: Voortgang en eerdere spellen, met snelle toegang tot review en lessen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Roottabkop + segment | "Terugblik", "5 spellen op dit apparaat" |  |  |  |
| Voortgang | "Jouw voortgang" + (i); tegels "78 Precisie, laatste 5", "2/5 gewonnen", "2,8 missers per spel"; lijntje "Precisie, oudste links" | kaart 340x277; tegel 98x86; getal 26/800 | neutraal | (i): meer cijfers |
| Lessenkaart | "Jouw les: Startplek" | 340x69 |  | P18 |
| Filter 1 | segment "Alle 5", "Gewonnen 2", "Verloren 3" | 108x44 |  | Filtert |
| Filter 2 | chips "Klassiek", "Rush", "Zeevaarders", "Dagpuzzel" (met pijl), "Beoordeeld", "Met ster" | 46 hoog, 1 horizontale rij, randchip piekt | donkere pil op sea | Dagpuzzel: opent Dagpuzzel-tab (Mijn dagen), geen filter |
| Spelrij | "Verloren van Blaauw", "14 nov 09:39 · Klassiek", chip "Precisie 83", vier puntentallen met avatar-ringen, "18 min" | rij 340x76 | `panel`; Precisie neutraal | Tik: sheet (P22) |

Staten: gevuld; leeg (P21); filter zonder resultaat ("Geen spellen met dit filter" + "Wis filter").

Teksten: "Jouw voortgang", "Precisie, laatste 5", "gewonnen", "missers per spel", "Precisie, oudste links", "Alle 5", "Gewonnen 2", "Verloren 3", "Klassiek", "Rush", "Zeevaarders", "Dagpuzzel", "Beoordeeld", "Met ster", "Verloren van Blaauw", "Gewonnen met 10 punten", "18 min", "5 spellen op dit apparaat".

Interactie: 1. Tik rij: sheet P22 (260 ms). 2. Chip: filtert, 150 ms. 3. Dagpuzzel-chip: tab Dagpuzzel.

Toegankelijkheid: filterrij `role=group`, horizontale scroll met toetsenbord; rij aria "Verloren van Blaauw, 14 november, Precisie 83"; geen rood/groen op botuitslagen.

Data: spellen uit `history.js`; Precisie/missers uit review per spel (`stats-ui.js`, `stats.js`); filters bestaand in `stats-ui.js`. Voorbeeld.

### P21 Terugblik leeg

&#91;image: P21 Terugblik leeg (voorbeelddata)\]

Donker: zie mockup history-empty-360-dark.png

Doel: Nieuwe speler laten zien wat Terugblik wordt en naar een eerste spel sturen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Kop + segment | "Terugblik" |  |  |  |
| Kaart | "Nog geen spellen", "Speel een potje, dan vind je het hier terug met je review.", 3 stappen Speel (`dice`), Review, Les | kaart 340 breed | teal-soft |  |
| Knop | "Start een spel" | 48 | `primary` | Naar Spelen |

Staten: 0 spellen.

Teksten: "Nog geen spellen", "Speel een potje, dan vind je het hier terug met je review.", "Speel", "Review", "Les", "Start een spel".

Interactie: 1. Tik knop: Spelen.

Toegankelijkheid: knop primair focus.

Data: aantal spellen = lengte lijst in `history.js` is 0.

### P22 Terugblik, spelsheet

&#91;image: P22 Terugblik, spelsheet (voorbeelddata)\]

Donker: zie mockup history-sheet-360-dark.png

Doel: Twee deuren per spel: Review en Bekijk bord.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | titel "Verloren", "Blaauw won", "za 14 nov · 09:39", sluit `close` 44x44 (huidig icoon, knoplook) | sheet radius 22 | `--sheet` |  |
| Uitslag | 4 avatars met punten 10, 9, 7, 6 |  | zetelringen |  |
| Meta | "Klassiek", "22 beurten", "18 min", "Precisie 83", "5 missers" | chips 28 | neutraal |  |
| Knoppen | "Review" (primair), "Bekijk bord", "Exporteer", "Verwijder" | 48 hoog; Verwijder secundair |  | Review: P05. Bekijk bord: replay. Verwijder: bevestig in sheet |

Staten: beoordeeld (dit); niet beoordeeld (P28: Review wordt "Start review"); Verwijder bevestigen (P27).

Teksten: "Verloren", "Blaauw won", "Klassiek", "22 beurten", "18 min", "Precisie 83", "5 missers", "Review", "Bekijk bord", "Exporteer", "Verwijder".

Interactie: 1. Review: P05. 2. Bekijk bord: replay. 3. Verwijder: bevestigsheet P27, daarna toast "Spel verwijderd.".

Toegankelijkheid: sheet `role=dialog` `aria-modal`; focus op titel; Escape/Terug sluit.

Data: spelrecord uit `history.js`; Precisie/missers uit review. Voorbeeld.

### P23 Bots

&#91;image: P23 Bots (voorbeelddata)\]

&#91;image: P23 Bots, vervolg (voorbeelddata)\]

Donker: zie mockup bots-360-dark.png

Doel: Hoe sterk welke bot is, als lijst; Jij op je plaats ingevoegd.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Roottabkop | "Bots", "Hoe sterk is welke bot?", tandwiel |  |  |  |
| Modefilters | "Klassiek", "Rush", "5 spelers", "6 spelers", "Zeevaarders" | chips 46 hoog, 1 rij |  | Wisselt ladder |
| Segment | "Sterkte", "Precisie", "Jij tegen hen" | 108x44 |  | Wisselt weergave |
| Ladderkaart | "Sterkteladder" + (i), "Winst in 100 spellen"; rijen: rang 14/800, embleem 36x36 (gouden neutraal, initiaal), naam 15/800, 5 stippen (sterkte), balk met 25=eerlijk tik, getal 16/800 | kaart 340x948; rij 56 | emblemen neutraal goud #F3E9D0/#7A5A12; sterktestippen goud `--warn` #B7791F (nacht #F0B45C), lege stippen ink 22%; nooit roest of rood | Tik rij: botprofiel (`bot-profile-ui.js`) |
| Jij-rij | "Jij", "nog weinig spellen", 40, gestippeld/zacht | 56 |  | Wordt vast bij genoeg spellen |
| Knop | "Bot kiezen en tegen spelen" | 48 | secundair | Opent botkeuze |

Staten: Sterkte (dit), Precisie, Jij tegen hen; Jij-rij zacht of vast; mode zonder data ("Nog geen spellen in deze stand").

Teksten: "Bots", "Hoe sterk is welke bot?", "Sterkte", "Precisie", "Jij tegen hen", "Sterkteladder", "Winst in 100 spellen", botnamen (Grootmeester, Superexpert+, Superexpert, Meester, Moeilijk, Bouwer, Handelaar, Haai, Gemiddeld, Makkelijk, Simpel), "Jij", "nog weinig spellen", "Bot kiezen en tegen spelen".

Interactie: 1. Filter/segment: lijst crossfade 150 ms. 2. Tik rij: botprofiel. 3. (i): sheet "Winst in 100 spellen, 25 is eerlijk".

Toegankelijkheid: ladder is geordende lijst; stippen `role=img` aria "sterkte 4 van 5"; tikdoel rij 56.

Data: botwaarden uit `bot-stats.js`/`bot-profiles.js`; Jij-plek via `youIndex(metas)` in `bots-page.js` met `YOU_MIN = 5` (ontwerp zegt zacht tot 10 spellen: zie Gaten). Voorbeeld: alle waarden.

### P24 Eindscherm, bot wint

&#91;image: P24 Eindscherm, bot wint (voorbeelddata)\]

&#91;image: P24 Eindscherm, bot wint, vervolg (voorbeelddata)\]

Donker: zie mockup end-a-botwin-360-dark.png

Doel: Verlies zonder te hard te zijn: wie won, waar Jij eindigde, en dezelfde twee volgende stappen.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Home-knop, titel | als P01 |  |  |  |
| Winnaarkaart | avatar van de winnaar (64, zetelring), "Blaauw wint" 28/700, "10 punten · 22 beurten · 18 min", tweede regel "Jij werd 2e met 9 punten" | kaart 340x99 | `panel`, heading, `soft`; geen rood of verdriet | Niet interactief |
| Uitslagkaart | rangorde met winnaar eerst; rij Jij getint 7% `--p0` op plek 2, met chips "Precisie 83" en "Geluk ▼ 2 kaarten" (neutraal) | kaart 340x475 | zoals P01 | Tik rij: P14 |
| Winkanskaart, Lessenkaart | als P01 |  |  |  |
| Dock | Review ("klaar") secundair, Revanche primair | als P01 |  |  |

Staten: winnaar is Blaauw, Geelen, Groen, De Wit of Pimpel (naam uit `dispName`); Jij 2e, 3e of 4e; bij review bezig/eerste spel/fout gelden de varianten P02-P04 met dezelfde winnaarkaart.

Teksten: "Spel afgelopen", "Blaauw wint", "10 punten · 22 beurten · 18 min", "Jij werd 2e met 9 punten", rest als P01. Titel blijft "Spel afgelopen" (geen "Verloren").

Interactie: als P01.

Toegankelijkheid: winnaarkaart aria "Blaauw wint met 10 punten, jij werd tweede met 9"; rij Jij aria "Jij, 2e, 9 punten".

Data: winnaar en rang uit `game.js` eindstand; verder als P01.

### P25 Stapmodus, goede zet

&#91;image: P25 Stapmodus, goede zet (voorbeelddata)\]

Donker: zie mockup rv-step-good-360-dark.png

Doel: Ook een goede zet laten zien en bevestigen, met dezelfde opbouw als een misser.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Subkop | "Jij · beurt 12", "zet 9 van 14", sluit `close` 44x44 | zie Subkop |  |  |
| Bordkaart | bord met pillen: "Jij 62%", "Geelen 17%", "Blaauw 12%", "Groen 9%" | kaart 340x341 | Jij `--p0` vol, bots neutraal | Pan/zoom (bestaand) |
| Zetkaart | chip "Goed" (`good-bg` #E5F1DB, tekst #3A7324), titel "Stad gebouwd" 16/800, "▲ 25%" 15/800 `good`, regel "Beter kon niet: een stad op erts 6 geeft 2 punten en meer oogst." | kaart 336x150 | % `good` (Jij) | Niet interactief |
| Knop rij 1 | alleen "Waarom?" (volle breedte; geen "Beter:"-knop, er is geen alternatief) | 310x48 | secundair | Opent P26-achtige sheet met waarom deze zet goed is |
| Knoppen rij 2 | "Vorige", "Sleutelbeurt", "Volgende" | 96/104/120 x 48 | Volgende `primary` | Als P15 |

Staten: goed (dit); bij "Kon beter" geldt chip #7A5A12 op #F3E9D0 met % `danger`.

Teksten: "Jij · beurt 12", "zet 9 van 14", "Goed", "Stad gebouwd", "Beter kon niet: een stad op erts 6 geeft 2 punten en meer oogst.", "Waarom?", "Vorige", "Sleutelbeurt", "Volgende".

Interactie: als P15; Sleutelbeurt springt naar de grootste winst of verlies (afwisselend voorstel: eerst grootste verlies).

Toegankelijkheid: chip "Goed" is tekst, niet alleen kleur; `aria-live=polite` zegt "Goede zet, stad gebouwd, plus 25 procent".

Data: als P15; klasse "Goed" als delta >= 0 en geen beter alternatief (`review-refine.js`). Voorbeeld.

### P26 Stapmodus, Waarom?-sheet

&#91;image: P26 Stapmodus, Waarom?-sheet (voorbeelddata)\]

Donker: zie mockup rv-step-why-360-dark.png

Doel: De uitleg bij een misser, getoond met twee balken en drie icoonregels in plaats van een lange tekst.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | P15 (misser) gedimd |  | scrim rgba(10,30,32,.5) | Tik scrim sluit |
| Sheet | titel "Waarom is een dorp beter?" 22/650, regel "Beurt 5 · jouw weg of een dorp" 12.5/650, sluit 44x44 | sheet 360x504, radius 22 | `--sheet` | Sluit: X, scrim, omlaag vegen, Terug |
| Vergelijking | 2 kaarten: "Jij: weg gebouwd 77%" en "Beter: dorp op erts 6 en graan 9 96%" met winkansbalk 12 hoog; de betere kaart heeft 2px primary-ring | kaart 328x65 | balk `--p0` (Jij); getal Outfit 20/700 | Alleen weergave |
| Redenen | 3 regels met icoon 36: `settlement` "Een dorp is 1 punt en geeft elke worp oogst.", `dice` + getalmunten 6 en 9 "9 van 36 worpen geven iets.", `road` "Een weg levert zelf niets op." | rij 44; tekst 14/650, max 2 regels | teal-soft icoon |  |
| Knop | "Toon het dorp op het bord" | 328x48 | `primary` | Sluit de sheet en toont het alternatief op het bord (zoals "Beter: dorp") |

Staten: misser (dit); kon beter (zelfde opbouw, titel "Waarom is {alternatief} beter?"); goede zet (P25): titel "Waarom is dit goed?", één balk, 2 redenen, primaire knop "Sluit".

Teksten: "Waarom is een dorp beter?", "Beurt 5 · jouw weg of een dorp", "Jij: weg gebouwd", "Beter: dorp op erts 6 en graan 9", "Een dorp is 1 punt en geeft elke worp oogst.", "9 van 36 worpen geven iets.", "Een weg levert zelf niets op.", "Toon het dorp op het bord". Geen zin langer dan 2 regels.

Interactie: 1. Tik "Waarom?": sheet schuift 260 ms omhoog (reduced: fade 120 ms). 2. Primair: sluit en animeert het alternatief op het bord. 3. Sheet scrolt als de redenen niet passen (max hoogte 88%).

Toegankelijkheid: `role=dialog` `aria-modal`; focus op titel; balken `role=img` aria "Winkans 77 procent"; Escape/Terug sluit.

Data: alternatief en winkans uit `review-refine.js`; redenen uit `review-explain.js` / `review-reasons.js` (te vertalen volgens i18n-lijst, korte zinnen); "9 van 36" uit de kansen van de gekozen getallen. Voorbeeld.

### P27 Terugblik, spel verwijderen

&#91;image: P27 Terugblik, spel verwijderen (voorbeelddata)\]

Donker: zie mockup history-delete-360-dark.png

Doel: Verwijderen bevestigen; de veilige keuze is primair, verwijderen secundair.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Achtergrond | P20 gedimd (de spelsheet P22 is gesloten) |  | scrim | Tik scrim = annuleer |
| Sheet | titel "Spel verwijderen?" 22/650, sluit 44x44 | sheet 360x321, radius 22 | `--sheet`, `role=alertdialog` |  |
| Spelregel | avatar winnaar 36, "Verloren van Blaauw" 16/800, "za 14 nov · 09:39 · Klassiek" 12.5/650 | rij 44 |  |  |
| Waarschuwing | "Het spel en de review verdwijnen van dit apparaat. Dit kan niet ongedaan worden." | 14/400, 2 regels | `soft` |  |
| Primair | "Annuleer" | 328x48 | `primary` | Sluit, terug naar P22 |
| Secundair | "Verwijder" | 328x48 | knoplook, tekst `--danger` #A8402C (nacht #F2907A) | Verwijdert; toast "Spel verwijderd." met actie "Herstel" 5 s (voorstel); lijst werkt bij |

Staten: een spel (dit); bij een Dagpuzzel-spel: "Het spel verdwijnt hier; je Dagpuzzel-uitslag blijft staan in Mijn dagen."

Teksten: "Spel verwijderen?", "Verloren van Blaauw", "Het spel en de review verdwijnen van dit apparaat. Dit kan niet ongedaan worden.", "Annuleer", "Verwijder", "Spel verwijderd.".

Interactie: 1. Tik "Verwijder" in P22: deze sheet vervangt P22 (260 ms). 2. Annuleer of scrim: terug naar P22. 3. Verwijder: sheet sluit, rij verdwijnt 200 ms, toast.

Toegankelijkheid: `role=alertdialog` `aria-modal`; focus op "Annuleer"; Escape/Terug = annuleer.

Data: spelrecord uit `history.js` (verwijdert record en gekoppelde review/lessen-invoer; Lessen worden opnieuw berekend door `buildLessons()`). Voorbeeld.

### P28 Terugblik, spelsheet niet beoordeeld

&#91;image: P28 Terugblik, spelsheet niet beoordeeld (voorbeelddata)\]

&#91;image: P28 Terugblik, spelsheet niet beoordeeld, vervolg (voorbeelddata)\]

Donker: zie mockup history-sheet-new-360-dark.png

Doel: Een spel zonder review: dezelfde twee deuren, maar Review start de analyse.

| Onderdeel | Inhoud | Maat (px) | Token/kleur | Gedrag |
| --- | --- | --- | --- | --- |
| Sheet | als P22 | sheet 360x402 |  |  |
| Meta | "Klassiek", "22 beurten", "18 min", "Nog niet beoordeeld" (geen Precisie en missers) | chips 26 | neutraal |  |
| Knoppen | "Start review" (primair), "Bekijk bord" met `play`, Exporteer, Verwijder | 52 hoog | knoplook | Start review: P06, daarna P05. Rest als P22 |

Staten: niet beoordeeld (dit); review bezig: "Review loopt (9/25)" met voortgangsring i.p.v. Start; mislukt: "Opnieuw" met `retry`.

Teksten: "Nog niet beoordeeld", "Start review".

Interactie: 1. "Start review": sheet sluit, P06 opent, na afloop P05. 2. Rest als P22.

Toegankelijkheid: als P22.

Data: ontbrekende review-samenvatting in `history.js` record (`rv` leeg). Voorbeeld.

---

## Iconen (productbeslissing: huidige app wint)

Huidige set `src/ui-icons.js` (24-raster, 2px): `home dice clock history lessons book info settings sliders bars lab trade build devcard robber target trophy star road settlement city ship harbor scale close check explore`. Specs gebruiken deze namen. De mocks (`post/tests2/lib2.mjs` leest de paden rechtstreeks uit `src/ui-icons.js`) en de knoppen zijn omgezet; er blijft geen hand getekend equivalent over.

Omzettingen die in de mocks zijn gedaan (eerder: eigen tekening):

- Home-knop (P01-P04, P24): `home`. Uitleg-knop (P05, P06, P08, P12-P16 en tabs P09-P11): `info`. Sluitknoppen (P15, P22, P25-P28): `close` (geen tekstteken).
- Lessenkaart (P01-P05, P14, P16, P19, P20): `lessons`; Start-tegel: `target`; Winkanstegel/Winkanskaart: `bars`; Geluktegel en stappen "Speel": `dice`; stap Review: `lessons`; Les: `star` (omlijnd).
- Bronbalk-iconen: `settlement`, `city`, `road`, `devcard`. Tegel Zitplaats (P10): `settlement`; Soort: `devcard`; Redenen (P26): `settlement`, `dice`, `road`.
- Tabbar (P17, P19-P23): `dice`, `history`, `bars`; Dagpuzzel-tab blijft de nieuwe `puzzle`/kalender.
- Tandwiel: `settings`.

Nieuwe lijniconen (de huidige app heeft er geen; zelfde stijl): terug, chevron, afspelen (P11, P22, P28), zon (reeks, P16, P20), driehoek omhoog/omlaag (Geluk), alert (P04, P08), opnieuw (P04, P08, P28), wifi-uit (P13), kalender/puzzel (Dagpuzzel-tab), plus gereserveerd: gebruiker, mensen, slot, download.

Knoppen: alle knoppen volgen de huidige app (`.btn`: radius 10, wit met rand 1px #D9CEB6, icoon 24; primair met verloop). De cirkelvormige en doorschijnende icoonknoppen uit eerdere v2-mocks vervallen; zie "Knop" in Gedeelde onderdelen.

## Gaten en tegenstrijdigheden

Opgelost in deze ronde: mocks voor P09-P11 (met dark), eindscherm bij botwinst (P24), goede zet en Waarom?-sheet (P25, P26), Verwijder-bevestiging en niet-beoordeeld spel (P27, P28), "–" in P06 voor Precisie en Geluk, sterktestippen in goud in P23, iconen en knoppen conform de huidige app.

1. P23: `YOU_MIN = 5` in `bots-page.js`, ontwerp zegt "zacht tot 10 spellen". Kies er een.
2. P18: `cropSvg` standaardkleur #D1453A in `lessons-view.js` is in het ontwerp verwijderd, moet #B81E2E worden.
3. Ms-waarden voor animaties zijn voorstellen (design-systeem geeft geen waarden behalve toast 3 s).
4. Data-bronnen zijn op functieniveau benoemd waar bekend (`_rvScoreHtml`, `_rvWhyBars`, `buildLessons`, `youIndex`); precieze velden voor voortgang "9/25", Precisie per botniveau en de splitsing zitplaats/aantal/soort in P10 zijn afgeleid, niet geverifieerd in code.
5. P09: marker en sleepgedrag, en de (i)-sheets bij P09/P10, hebben geen eigen mock (tekst staat in de spec). Lege en ladende staat van P09-P11 hebben geen mock.
6. P26: alleen de misser-variant is gemockt; kon-beter en goed-variant volgen dezelfde opbouw (tekst in spec).
7. P27: toast "Spel verwijderd." met "Herstel" en het Dagpuzzel-spel-variant zijn voorstellen zonder mock.
8. P24: alleen de variant "Jij werd 2e" is gemockt; 3e en 4e plaats gebruiken dezelfde kaart.
9. Home-, shell- en game-mocks (`home/`, `game/`) zijn niet omgezet naar de huidige knop- en icoonlook; alleen post en Dagpuzzel zijn dat.
10. De getoonde data van de stapmodus-borden zijn illustratief (zelfde bord voor beurt 5 en 12).
