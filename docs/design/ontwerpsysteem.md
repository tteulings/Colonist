# Katan PWA: componentbibliotheek (bouwspec)

Dit document beschrijft de componenten, kleur, typografie, spacing, beweging en iconen van de Katan PWA-herontwerp (ontwerpsysteem 1.99, thema Zonnig eiland, licht en nacht). Het is bedoeld voor bouwers: elke maat is in px, elk token is de bestaande CSS-variabele of een nieuwe `--sp-*`, `--r-*`, `--fs-*` uit `home/src2/lib.cjs`. Waarden zijn uit `DESIGN-SYSTEM.md`, `home/design.md` (v2 en v2.1) en de mockups in `home/*-v2.html`; waar de bron zwijgt staat "voorstel". Alle namen, scores, reeksen en datums in de beelden zijn voorbeeldgegevens. Paden zijn relatief aan `design199/` (de map `$S`). Het schermspec staat in `spec/shell.md`.

## Index

1. Knoppen (primair, secundair, ghost, icoon)
2. Chips
3. Segmentbalk
4. Schakelaar
5. Kaartvarianten
6. Lijstrij
7. Sheet
8. Tabbalk
9. App bar
10. Toast
11. Coachkaart
12. Avatar
13. Getalmunt en stippen
14. Dobbelstenen
15. Handkaart-waaier
16. Reeks-chip
17. Codeveld
18. Offlinebanner
19. Skeleton en voortgang
20. Kleur
21. Typografie
22. Spacing, radius, hoogte
23. Beweging
24. Iconen (huidige set, nieuwe aanvullingen)
25. Algemene staatregels en toegankelijkheid

Staten die voor alle interactieve componenten gelden (tenzij een sectie iets anders zegt): **ingedrukt** = `transform: scale(.97)` in 120 ms ease (bestaand: `.app .btn:not(:disabled):active`); **focus** = 3 px outline `--accent`, offset 2 px, alleen bij `:focus-visible` (voorstel, niet in mockup); **uitgeschakeld** = gestippelde rand 1.5 px `--sep`, tekst `--ink-faint`, geen schaduw, `aria-disabled`; **donker** = zelfde markup, tokens uit de nachtkolom (sectie 20).

---

## 1. Knoppen

&#91;image: 1. Knoppen (voorbeelddata)\]

Donker: zie mockup design-system-dark.png

In gebruik: home/shots-v2/home-a-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Primair | h min 48, padding 0 18, radius 10, tekst Outfit 19/650 | bg `--primary` (verloop `--primary-image`), tekst `--primary-ink`, rand `--primary-border`, schaduw `--primary-shadow` | Eén per scherm of sheet, onderaan de kaart of in de sticky footer. Werkwoord als label |
| Secundair | h min 48, radius 10, Figtree 16/650 | wit (`--btn`) met beige rand, zoals de huidige app: bg `--btn`, tekst `--btn-ink`, rand `--btn-border` (1px #D9CEB6 / #344B56), `--btn-shadow` | Naast of onder primair (Bekijk, Aanpassen, Alle dagen) |
| Ghost | h 48, tekst 16/650, padding 0 8 | transparant, tekst `--ink` of `--teal-ink` | Sla over, Terug, Zelf kiezen, Toch spelen. Geen rand |
| Klein (`sm`) | h 44, Figtree 14, padding 0 14 | als secundair | Wijzig, Controleer |
| Icoonknop | 44 x 44 vierkant, radius 10, icoon 24 (22 in sheet) | overal gelijk, ook op zee: bg `--btn` (wit), rand `--btn-border`, `--btn-shadow`, icoon `--heading` | Altijd `aria-label`. Geen cirkels en geen doorzichtige knoppen meer (besluit productowner) |
| Icoon in knop | 20-24, gap 8 | `currentColor` | Deel-icoon voor "Deel je uitslag", dobbelstenen-kleurart voor "Speel de dagpuzzel" |
| Volle breedte (`block`) | 100% van kaartbinnenkant |  | Primair in kaarten en sheets |

Staten: normaal; ingedrukt (scale .97, 120 ms); uitgeschakeld (gestippelde rand, `--ink-faint`, niet tikbaar); focus (outline); donker (`--primary` #26706F, `--btn` #20323C).

Gedrag: tik activeert bij loslaten; dubbel tikken wordt genegeerd 300 ms; een primaire actie die iets verstuurt toont binnen 100 ms een toast of schermwissel. Knoppen met alleen icoon hebben nooit tekst erbij.

Aria: `<button>`; icoonknoppen `aria-label` ("Instellingen", "Sluiten", "Terug"); uitgeschakeld via `aria-disabled="true"` en `disabled`; label is een werkwoord.

## 2. Chips

&#91;image: 2. Chips (voorbeelddata)\]

Donker: zie mockup home-a-360-dark.png

Lijst in home/shots-v2/design-system.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Neutraal | h 28, padding 0 10, pil, Figtree 12.5/700 | bg `--chip`, rand `--chip-border`, tekst `--chip-ink` | "3 bots", "Gemiddeld", datum "di 24 nov" |
| Teal | h 28 | bg `--teal-soft`, tekst `--teal-ink`, geen rand | Soort/niveau, "Gewonnen" |
| Accent | h 28 | bg `--accent-soft`, tekst `--accent-ink`, rand accent 45% | Gekozen, tag |
| Goed (alleen Jij) | h 28 | bg `--good-bg`, tekst `--good` | "2 sneller" |
| Inkt (verlies) | h 28, rand 1.5 | bg `--chip`, tekst `--heading`, rand `--ink-faint` | "Verloren": neutraal, nooit rood |
| Tag (klein) | h 24, 11.5/800 | `--accent-soft` / `--accent-ink` | "3:1" |
| Tikbare chip (`btnlike`) | h 44, 14 | zelfde als type | Alleen als de chip iets doet |
| Icoon in chip | 16-18 | `currentColor` |  |

Staten: normaal; ingedrukt (alleen tikbaar, scale .97); uitgeschakeld (opacity .5, niet tikbaar); focus (outline, alleen tikbaar); donker (tokens nacht).

Gedrag: niet-tikbare chips zijn `<span>` zonder focus. Maximaal één regel, nooit afbreken (`white-space: nowrap`).

Aria: niet-tikbaar = gewone tekst (geen role); tikbaar = `<button>`. Betekenis nooit alleen via kleur: altijd tekst of icoon.

## 3. Segmentbalk

&#91;image: 3. Segmentbalk (voorbeelddata)\]

Donker: zie mockup settings-360-dark.png

Ook home/shots-v2/newgame-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Bak | padding 3, radius 13, gap 3, kolommen gelijk | `--seg-bg`, `--seg-border` | Max 3 opties per rij; 4+ wordt avatar-/tegelkiezer |
| Segment | h min 44, radius 10, Figtree 14/700, padding 0 4 | tekst `--ink` | Label max ca. 11 tekens bij 360 |
| Geselecteerd | idem, 800 | bg `--sheet`, tekst `--heading`, schaduw 0 1px 3px rgba(0,0,0,.15) + inset 2px `--accent` |  |
| Label boven | 12.5/800 | `--ink-soft` |  |

Staten: normaal; ingedrukt (scale .97 op segment); uitgeschakeld (opacity .45); focus (outline om segment); donker.

Gedrag: tik kiest direct (geen bevestiging, 120 ms ring-overgang); pijltjestoetsen verplaatsen selectie.

Aria: container `role="radiogroup"` met `aria-label` = het label; segment `role="radio"` `aria-checked`; roving tabindex.

## 4. Schakelaar

&#91;image: 4. Schakelaar (voorbeelddata)\]

Donker: zie mockup settings-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Tikvlak | 52 x 44 |  | Rij blijft min 56 hoog |
| Baan | 46 x 28, radius 14 | uit `#D9CFBB` (nacht #3A4C55), aan `--accent` |  |
| Knop | 22 cirkel, wit, schaduw 0 1px 2px rgba(0,0,0,.2) |  | Uit x=3, aan x=21 |

Staten: uit; aan; ingedrukt (knop 26 breed, voorstel); uitgeschakeld (opacity .45); focus (outline om tikvlak); donker.

Gedrag: tik wisselt direct, 150 ms ease; de hele rij (titel + hulptekst) is tikbaar. Reduced motion: geen glijbeweging.

Aria: `role="switch"` `aria-checked`, naam = de rijtitel via `aria-labelledby`.

## 5. Kaartvarianten

&#91;image: 5. Kaartvarianten (voorbeelddata)\]

Donker: zie mockup home-a-360-dark.png

Varianten in home/shots-v2/design-system.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| `card` (standaard) | padding 14, radius 20 (`--r-card`), tussenruimte 12 | bg `--sheet`, rand `--sheet-border`, schaduw `--card-shadow` (0 8px 28px rgba(0,30,60,.22)) | Nieuw spel, Mijn dagen, Instellingen-groep (zonder schaduw, radius 16) |
| `card gold` | idem | verloop `--bank-bg` naar `--group`, rand `--group-border` | Alleen Dagpuzzel |
| `card primary` / Verder spelen | h ca. 68, radius 20 | teal, tekst wit op zee-pil | Rij met play-knop 44, titel 20, lijn 14, avatars 30 |
| Eerste-spel hero | padding 16, logo 86 | `card` | Alleen eerste keer |
| Inner tegel | radius 12-14 | `--chip` + `--chip-border`, schaduw 0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,30,60,.12) | Nooit een kaart in een kaart |

Staten: normaal; ingedrukt (tikbare kaart: scale .98); uitgeschakeld (niet van toepassing, inhoud wordt gedimd); focus (outline om kaart); donker (`--panel` #172630, goud #2A2418).

Gedrag: kaarten zijn containers; alleen knoppen erin zijn tikbaar, behalve de Verder spelen-rij (hele rij tikbaar).

Aria: `<section aria-labelledby>` met de titel; Verder spelen is één `<button>`.

## 6. Lijstrij

&#91;image: 6. Lijstrij (voorbeelddata)\]

Donker: zie mockup settings-360-dark.png

Met Review-knop: home/shots-v2/dagtab-done-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Rij | h min 56 (60 in Pauze), gap 12, padding 6 2 | scheidslijn `--divider` |  |
| Icoonvlak | 36 (40 in Pauze), radius 10, icoon 20-22 | bg `--teal-soft`, icoon `--teal-ink` | Verloren dag: bg `--seg-bg`, icoon `--ink-soft` |
| Titel | 16/700, + 1 regel 12.5/550 `--ink-soft` | `--ink` | Max 2 regels totaal |
| Rechts | chevron 20 `--ink-faint`, of schakelaar, of chip, of knop `sm` |  | Chevron = rij opent iets |
| Review-knop (dagrij) | h 44, min b 44, padding 0 12, radius 10 | bg `--teal-soft`, tekst `--teal-ink` 14/700 | Eigen tikvlak naast de rij |

Staten: normaal; ingedrukt (rij krijgt bg `--seg-bg`); uitgeschakeld (tekst `--ink-faint`); focus (outline om rij); donker.

Gedrag: rij en Review-knop zijn aparte doelen (rij = uitslag, knop = review); minimaal 8 px ruimte tussen doelen.

Aria: rij = `<button>` met titel + regel als naam; Review-knop `aria-label="Review van ma 23 nov"`.

## 7. Sheet

&#91;image: 7. Sheet (voorbeelddata)\]

Donker: zie mockup newgame-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Scrim | vol scherm | `--scrim` rgba(24,40,42,.42) / rgba(2,8,12,.62) | Tik sluit |
| Paneel | radius 22 boven (`--r-sheet`), max-hoogte 94%, binnen-padding 20 | `--sheet`, rand `--sheet-border`, schaduw 0 -10px 40px rgba(0,0,0,.25) | Content max 460 breed, gecentreerd |
| Greep | 40 x 5, radius 3, marge-top 8 | `--sep` |  |
| Kop | titel Outfit 20/650, sluitknop 44 `solid` rechts | `--heading` | Padding 6 8 4 20 |
| Body | scrollt, gap 14 |  |  |
| Sticky footer | padding 10 16 (12 + safe area), bovenrand `--divider` | `--sheet` | Eén primaire knop; secundaire acties erboven in de body |

Staten: dicht; open; slepend (volgt de vinger, loslaten na > 30% hoogte of snelheid sluit); donker. Uitgeschakeld niet van toepassing.

Gedrag: opent met `sheetUp` 280 ms (translateY 40px + opacity 0 naar 0, `--ease-out`), scrim fade 200 ms; sluit via X, scrim-tik, veeg omlaag, Terug-gebaar (laag op de `nav.js` stack). Focus gaat bij openen naar de titel, bij sluiten terug naar de trigger.

Aria: `role="dialog"` `aria-modal="true"` `aria-labelledby` = titel; focus-trap; Escape sluit. Achtergrond `inert`.

## 8. Tabbalk

&#91;image: 8. Tabbalk (voorbeelddata)\]

Donker: zie mockup home-a-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Balk | 4 gelijke kolommen, padding 6 4 + safe area; hoogte ca. 68 + safe area | bg `--tab`, rand-boven `--tab-border`, schaduw 0 -4px 18px rgba(20,40,40,.08) | Alleen niveau 1. Verborgen in spel, onboarding en sheets |
| Item | h min 56, icoon 24, label 11.5/700, gap 2 | tekst `--ink-soft` | Spelen, Dagpuzzel, Terugblik, Bots |
| Actieve pil | 56 x 30, radius 15 | bg `--teal-soft`, icoon + label `--teal-ink`, label 800 |  |
| Badge | 10 cirkel, ring 2 `--tab`, positie boven rechts van icoon (top 4, links 50% + 10) | `--accent` | Dagpuzzel niet uitgespeeld vandaag |
| Iconen | dobbelsteen, puzzel, geschiedenis, balken | zie sectie 24 |  |

Staten: inactief; actief (`aria-current="page"`); ingedrukt (pil `--seg-bg`); uitgeschakeld (n.v.t.); focus (outline om item); donker (`--tab` #13232B); badge aan/uit.

Gedrag: tik wisselt tab zonder animatie en zonder historie-ingang (tabs zijn niveau 1); tik op de actieve tab scrolt naar boven. Badge verdwijnt zodra de dagpuzzel vandaag uit is, en is verborgen bij de eerste-keer-staat.

Aria: `<nav aria-label="Hoofdmenu">`; items `<button>`; badge heeft `aria-label="Nog niet gespeeld"` en wordt aan de tabnaam gekoppeld ("Dagpuzzel, nog niet gespeeld").

## 9. App bar

&#91;image: 9. App bar (voorbeelddata)\]

Donker: zie mockup settings-360-dark.png

Transparante variant op zee: home/shots-v2/dagtab-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Sub-scherm bar | padding 12 12 8, rand-onder 1px `--sep` | bg `--chrome` | Terugknop 44 `solid` links, titel Outfit 20, acties rechts |
| Tab-root kop op zee | padding 14 16 4, titel Outfit 26/650 wit met tekstschaduw, tandwiel 44 rechts | transparant | Geen terugpijl. Spelen: logo 40 + "Katan" |
| Tandwiel | 44 x 44 vierkant, radius 10, icoon 24 | wit `--btn` met beige rand | Op elk tab-root |

Staten: normaal; ingedrukt (knoppen); focus; donker (`--chrome` #13232B). Scroll: de kop op zee scrolt mee (voorstel).

Gedrag: Terug = `history.back()` binnen de laag-stack. Tab-roots tonen nooit een terugpijl.

Aria: `<header>`; titel `<h1>`; terugknop `aria-label="Terug"`; tandwiel `aria-label="Instellingen"`.

## 10. Toast

&#91;image: 10. Toast (voorbeelddata)\]

Donker: zie mockup home-autodark-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Toast | h min 48, padding 8 14, radius 14 | bg #22302F, tekst #F3F4EE 14/650, schaduw `--float-shadow` | Eén stijl voor alles; max 1 regel tekst |
| Icoon | 20-22 | `currentColor` | Maan, geschiedenis, vinkje |
| Actie | min 44 x 44, tekst 14/800, rechts, marge-rechts -8 | #F6C089 | "Wijzig" |
| Plek | 12 boven de tabbalk of dock, marge-zijkant 16 |  |  |

Staten: verborgen; zichtbaar 3 s; met actie (blijft 5 s, voorstel); donker (zelfde, schaduw .35).

Gedrag: `toastIn` 260 ms (translateY -6px + scale .98 naar 1, `--ease-pop`), uit 180 ms fade; één tegelijk, een nieuwe vervangt de oude; swipe weg. Tik op actie sluit de toast.

Aria: `role="status"` `aria-live="polite"`; verdwijnt de tekst te snel dan blijft de inhoud ook bereikbaar via de plek waar het effect zichtbaar is.

## 11. Coachkaart

&#91;image: 11. Coachkaart (voorbeelddata)\]

Donker: zie mockup onb-3-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Kaart | radius 22 boven, padding 12 16 + safe area, gap 10, ca. 265 hoog | bg `--sheet`, rand-boven `--sheet-border`, schaduw 0 -10px 30px rgba(0,0,0,.18) | Niet-modaal, onder het bord; bord blijft zichtbaar en tikbaar waar de stap dat vraagt |
| Voortgangsstippen | 8 cirkel; actief pil 22 x 8 | `--sep`; actief `--accent` | Rechts "3 van 5" 12.5/700 `--ink-faint` |
| Titel | Outfit 20/650 | `--heading` | Zelfstandig naamwoord |
| Regel | 14/550, max 2 regels | `--ink-soft` |  |
| Visual (`vis`) | padding 10, radius 14, gap 8 | `--chip` + `--chip-border` | Eén per stap |
| Knoppenrij | ghost (Sla over / Terug) + primair (Volgende / Begrepen), h 48 |  | Primair flex 1 |
| Ticker boven bord | h 44, radius 14, marge 0 12 | bg `--bank-bg`, rand accent 55% | Tekst 14/750 + infoknop 44 |

Staten: normaal; wacht-op-tik (stap 3 en 5: Volgende verborgen tot de tik); uitgeschakeld (n.v.t.); focus; donker; reduced motion (pulsen uit, kaart wisselt met fade).

Gedrag: Volgende gaat naar de volgende stap (kaartinhoud wisselt 200 ms cross-fade); Sla over sluit de coach voor altijd (bevestigt niet) en zet Uitleg uit voor dit spel; Terug (stap 5) gaat naar stap 4.

Aria: `role="dialog"` `aria-label="Uitleg 3 van 5"`, niet modaal (`aria-modal` weglaten); focus naar de titel bij stapwissel, `aria-live="polite"` op de ticker.

## 12. Avatar

&#91;image: 12. Avatar (voorbeelddata)\]

Donker: zie mockup newgame-360-dark.png

Alle zes: home/shots-v2/design-system.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Maten | 22 inline, 30 strook en Verder spelen, 36-44 kiezers (44 standaard), 52 profiel |  | Kunst ongewijzigd (`av-0..av-5`) |
| Ring | 3 px zitplaatskleur, schaduw 0 1px 3px rgba(0,0,0,.12) | `--p0..--p5` | Jij #B81E2E, Blaauw #3C75C6, Geelen #F08A2E, Groen #1E9E8E, De Wit #EFE7D4 (rand wit 3 + #8A7F66 1.5), Pimpel #5A2C88 |
| `off` | grijs 100%, opacity .45, ring `--sep` |  | Niet-spelende botplek |
| Naamlabel | 11.5/750 | `--ink` (off: `--ink-faint`) | Exacte botnamen: Blaauw, Geelen, Groen, De Wit, Pimpel |
| Overlap (Verder spelen) | 30 breed, overlap ca. -8 |  |  |

Staten: aan; uit (`off`); ingedrukt (kiezer: scale .97); focus (outline om 56 x 72 tikvlak); donker (zelfde ring). Kiezer-tikvlak min 56 x 72.

Gedrag: tik in de kiezer wisselt aan/uit, minimaal 1 bot blijft aan. Zitplaatskleur is alleen identiteit, nooit betekenis; rood is alleen Jij.

Aria: kiezerknop `aria-pressed` + `aria-label` = botnaam; decoratieve avatars `aria-hidden`.

## 13. Getalmunt en stippen

&#91;image: 13. Getalmunt en stippen (voorbeelddata)\]

Donker: zie mockup onb-3-360-dark.png

Munt los: home/shots-v2/design-system.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Schijf | 30 (op bord 36 bij `bigNums`) | vulling #FBF6EA, ring #D9CFB8 1.5 |  |
| Getal | Outfit 700, 15-22 | `--heading`; 6 en 8 #B3321F (nacht tekst #F2907A) |  |
| Stippen | 1-5 stippen onder het getal, 6 breed (kolom 25 breed) | `--ink-faint`; 6 en 8 #B3321F | 2/12 = 1, 3/11 = 2, 4/10 = 3, 5/9 = 4, 6/8 = 5 |
| 7 | rover-icoon 22 + "7" 11.5/800 | `--ink-soft` |  |
| Totaallabel op plek | "13 stippen", donkere pil, wit 12.5/700 |  | Alleen in coach stap 3 |

Staten: normaal; gemarkeerd (accent ring 2 px, offset 3, pulse); donker (schijf blijft ivoor); uitgeschakeld n.v.t.

Gedrag: alleen uitleg, niet tikbaar. Pulse 1.6 s ease-in-out oneindig (scale 1 naar 1.35, opacity 1 naar .55); reduced motion: statische ring.

Aria: decoratief; de uitleg staat in tekst ("Dit getal gooien = die tegel betaalt"). Stippen niet voorlezen, getal wel.

## 14. Dobbelstenen

&#91;image: 14. Dobbelstenen (voorbeelddata)\]

Donker: zie mockup design-system-dark.png

In knop: home/shots-v2/home-a-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Dobbelsteen | 30 inline, 44 groot, 28 in knop | bestaande art `die-1..6` | Kunst ongewijzigd |
| Paar + som | twee stenen gap 2, som Outfit 14/700 eronder | `--heading` | Alleen in-game en review |
| Op de dagpuzzel-kaart | niet getoond |  | Toekomstige worpen worden nooit getoond; kaart zegt "Zelfde worpen voor iedereen" met klein dobbelsteen-icoon 24 |

Staten: statisch; rollend (in-game, valt buiten dit document); donker (zelfde). Niet tikbaar in de shell.

Gedrag: geen. Beweging van het gooien hoort bij het spelscherm; bij reduced motion direct eindwaarde.

Aria: `aria-label="Dobbelstenen: 2 en 4, samen 6"` op de groep; losse stenen `aria-hidden`.

## 15. Handkaart-waaier

&#91;image: 15. Handkaart-waaier (voorbeelddata)\]

Donker: zie mockup design-system-dark.png

Sectie "Handkaarten (waaier)" onderaan. Let op: geen enkele shell-mockup (onb-1 tot onb-5, ingame-menu) toont handkaarten; de waaier is toegevoegd aan `home/src2/build2.cjs` en de shot is opnieuw gemaakt.

Exact zoals de huidige app (`themes/base.css` `.hand`, `src/game.js` regel ca. 8640):

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Strook `.hand` | absolute, left 0, right 0, `bottom: var(--dock-h)` (72 + safe area), hoogte `--fan-h` 112 | `--fan-bg`: verloop rgba(247,242,232,0) naar .92 bij 58% | Boven de dock, onder het bord; `pointer-events: none` behalve op de kaarten |
| Rij `.cards` | flex, align-items flex-end, gap 0, scroll-x, padding 11 `--gut` (14) 6 `--gut`+12 (26) |  | Scroll-snap x proximity, geen scrollbalk |
| Kaart | breedte `--cw` 50 (46 op smal), verhouding 250 : 350, radius `--card-radius` 8 | schaduw `--card-shadow` | Echte kaartkunst `card-wood/brick/sheep/wheat/ore` |
| Overlap | `margin-right: -8`; laatste kaart `margin-right: 14` |  |  |
| Waaier | `--rot` = (index - (n-1)/2) x 2.6 graden; `--dy` = abs(index - (n-1)/2) x 1.6 px; `transform-origin: 50% 120%` |  | Dit is de speelse lichte draai; n = 5 grondstoffen + aanwezige ontwikkelingskaarten |
| Aantalbadge | min 22 x 22, rechts -4, boven -7, 12.5/750 | `--badge` |  |
| Scheiding | 14 breed (`.sep`) tussen grondstoffen en ontwikkelingskaarten |  |  |
| Lege plek | `empty slot`: opacity .38, grijs, gestippelde rand, "0" |  |  |
| Gekozen | ring 3 px `--accent`, inset -5 |  |  |

Staten: normaal; leeg (0); gekozen (`sel`); ingedrukt (scale .97 binnen de waaier-transform); afleggen (`marked`, ring `--danger`); donker (kaartkunst blijft). Op breed scherm (desktop) geen rotatie: `transform: none`.

Gedrag: transform-overgang 200 ms `--ease-pop`; veeg horizontaal scrolt de strook; tik op een kaart opent ruilen of kiest de kaart.

Aria: knop per kaart `aria-label="Hout: 3"`, lege plek "Hout: geen"; waaier `role="group"` `aria-label="Je kaarten"`. Reduced motion: overgang 1 ms, rotatie blijft (statisch).

## 16. Reeks-chip

&#91;image: 16. Reeks-chip (voorbeelddata)\]

Donker: zie mockup home-a-360-dark.png

Weekstrook: home/shots-v2/dagtab-done-360.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Chip | h 28, padding 0 10, pil | bg `--chip`, tekst `--heading` 12.5/700, rand 1px `--streak-line` (#E3C27E / #5A4A28) | Nooit een kaal getal: zon + "12 dagen" |
| Zon-icoon | 16 | `--streak-sun` (#B7791F / #F0B45C) | Alleen icoon, 3:1 regel |
| Weekstrook cel | 32 cirkel, label 11.5/800 eronder | gespeeld: bg `--group`, rand `--streak-line`, zon 18; vandaag: ring 2.5 `--streak-sun`; toekomst: lege rand `--sep`; gemist: gestippeld | Niet-interactief, groter dan 24 |

Staten: normaal; +1 na een gespeelde dag (teller telt 250 ms op, voorstel); geen reeks = chip verborgen; donker (rand #5A4A28).

Gedrag: telt dagen gespeeld (winst of verlies), Amsterdamse dag, geen bevriezing. Niet tikbaar.

Aria: `aria-label="12 dagen op rij"` op de chip; weekstrook `role="img"` met `aria-label` "Deze week: ma gespeeld, di gespeeld".

## 17. Codeveld

&#91;image: 17. Codeveld (voorbeelddata)\]

Donker: zie mockup 04a-result-win-360-dark.png

Stijl: `.code` in home/src2/lib.cjs

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Veld | h min 48, padding 0 6 0 14, radius 12 | bg `--chip`, rand 1px gestippeld accent 60% | Code `KD1-XXXX-XXXX-XXXX`, hoofdletters, voorbeeld `KD1-3QM7-2R9X-HT6B` |
| Tekst | Outfit 700 18, tracking +.04em (let op: de mock `.code` gebruikt .06em; bouw .04em volgens ontwerpsysteem) | `--heading` |  |
| Kopieerknop | 44 x 44, radius 10, icoon 22 | `--accent-ink` |  |

Staten: normaal; gekopieerd (icoon wordt vinkje 1.5 s, toast "Code gekopieerd"); uitgeschakeld (n.v.t.); focus (outline om knop); donker.

Gedrag: tik op kopieer zet code op het klembord; lang indrukken selecteert tekst. Plakveld (Vergelijk) gebruikt dezelfde stijl met invoer; fouten in neutrale inkt met icoon, niet rood.

Aria: `<output>`/tekst met `aria-label="Code KD1 3QM7 2R9X HT6B"`; knop `aria-label="Kopieer code"`; resultaat via `aria-live`.

## 18. Offlinebanner

&#91;image: 18. Offlinebanner (voorbeelddata)\]

Donker: zie mockup home-offline-360-dark.png

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| Banner | h min 48, padding 6 8 6 14, radius 14 | bg `--sheet`, rand `--sheet-border`, schaduw `--card-shadow` | Bovenaan de kolom, boven Verder spelen |
| Icoon | 22 wifi-uit | `--ink` | Neutraal, niet rood |
| Tekst | titel 14/650, regel 12.5/550 `--ink-soft` |  | "Je bent offline" + "Spelen kan gewoon. Delen wacht tot je online bent." |

Staten: zichtbaar offline; verborgen online (verdwijnt met fade 180 ms; kort "Weer online" toast, voorstel); donker.

Gedrag: niet wegveegbaar; Deel-knoppen blijven tikbaar en zetten het delen in de wachtrij, melding in een toast.

Aria: `role="status"` `aria-live="polite"`.

## 19. Skeleton en voortgang

&#91;image: 19. Skeleton en voortgang (voorbeelddata)\]

Donker: zie mockup home-a-daily-busy-360-dark.png

Voor de 40-stappenbalk. Een skeleton-mockup bestaat niet: voorstel.

| Onderdeel | Maat (px) | Token | Opmerking |
| --- | --- | --- | --- |
| 40-stappenbalk | h 8, radius 4, 40 segmenten gap 1.5 | leeg `--ink` 14%, gevuld `--accent` | Dagpuzzel "Beurt 7 van 40" |
| Skeleton (voorstel) | blokken met de maat van de echte inhoud, radius gelijk aan het element | bg `--seg-bg` met glans `--chip` 40% | Alleen voor kaarten die uit opslag laden en langer dan 200 ms duren |
| Opstart-splash | logo 86 op `--bg` |  | Volgt de effectieve palette |

Staten: leeg; deels; vol; skeleton zichtbaar; donker.

Gedrag: glans 1.4 s lineair oneindig, bij reduced motion statisch. Voortgangsbalk springt per beurt (200 ms).

Aria: balk `role="progressbar"` `aria-valuemin="0"` `aria-valuemax="40"` `aria-valuenow="7"` `aria-label="Beurt 7 van 40"`; skeleton `aria-busy="true"` op de container.

---

## 20. Kleur

Tokens zijn de bestaande CSS-variabelen (`themes/theme-sunny.css`, `sunny-night.css`). Licht = Zonnig eiland, Nacht = `[data-palette="night"]` of `prefers-color-scheme: dark` zonder gekozen palette.

| Token | Licht | Nacht | Gebruik |
| --- | --- | --- | --- |
| `--bg` | #F7F2E8 | #0E1B22 | pagina |
| `--chrome` / `--m-top` | #EEF7F4 | #13232B | app bar, tabbalk-basis |
| `--panel`, `--sheet` | #FDFBF6 | #172630 | kaarten, sheets |
| `--panel-border` | 1px #E6DDCB | 1px #2A3D47 | kaartrand |
| `--chip` / `--chip-border` | #FFFFFF / 1px #D7EBE6 | #1E303A / 1px #2E434D | chips, tegels |
| `--ink` | #2E3A3D | #E4ECEC | tekst |
| `--ink-soft` | #5A6366 | #A9BABE | secundair |
| `--ink-faint` | #687072 | #93A6AB | tertiair, iconen |
| `--heading` | #22302F | #F3F4EE | titels |
| `--primary` | #1F5F66 (verloop #22666D naar #1C585F), tekst #FFF9F2 | #26706F, tekst #F3FAF8 | hoofdactie |
| `--accent` | #D9714E | #F0B45C | selectiering, badge, pulse (alleen vulling/icoon) |
| accent tekst / bg | #A84E2F op #FCEBE3 | #F6C089 op #33281F | gekozen chip, tag |
| reeks | rand #E3C27E, zon #B7791F | rand #5A4A28, zon #F0B45C | reeks overal |
| teal zacht | #E6F4F1, tekst #1F6E77 | #1D3A3E, tekst #8ED8D3 | actieve tab, icoonvlak |
| `--group` / `--bank-bg` | #FBE9C9 / #FFF6E6, rand #F2D9A8 | #2A2418, rand #4A3E24 | alleen Dagpuzzel |
| `--sep`, `--divider` | #E6DDCB, #EFE7D7 | #2E414B, #26363F | lijnen |
| `--btn` | #FFFFFF, rand #D9CEB6 | #20323C, rand #344B56 | secundaire knop |
| `--scrim` | rgba(24,40,42,.42) | rgba(2,8,12,.62) | achter sheets |
| Zee-achtergrond | radial #6ACBC3 / #3CA9B0 / #2B8C98 + schaduw rgba(5,38,66,.52 tot .30) | radial #1E5A64 / #123E4A / #0A2630 | Spelen en tab-roots |
| `--good` (tekst) / `--good-fill` | #3A7324 / #4F8A33 | #6CC68E / #6CC68E | alleen Jij; fill alleen stip/balk/icoon |
| `--danger` | #A8402C | #F2907A | alleen Jij |
| Toast | #22302F, tekst #F3F4EE | idem |  |
| Zitplaatsen `--p0..p5` | Jij #B81E2E, Blaauw #3C75C6, Geelen #F08A2E, Groen #1E9E8E, De Wit #EFE7D4 (rand #8A7F66), Pimpel #5A2C88 | zelfde | ring en 7% tint |
| Zitplaatstekst `--pN-text` | #A01D18, #1F4FAE, #8F4710, #0F6A5B, #6B5F45, #5A2C88 | #F2828A, #9DBBF0, #F6A55A, #4FC2B2, #EFE7D4, #C3A0EA | enige zitplaatskleuren voor tekst |
| Getalmunt | schijf #FBF6EA, ring #D9CFB8, 6/8 #B3321F | tekst 6/8 #F2907A | bord, onboarding |

Regels: groen en rood alleen als betekenis voor Jij; bots nooit rood of groen als betekenis. Tekstcontrast minimaal 4.5:1 (gemeten, zie `DESIGN-SYSTEM.md`); strakste paren: `--ink-faint` op `--bg` 4.54 en accent-tekst op goud 4.64, niet lichter maken. Witte tekst op de zee alleen vanaf 19px+ vet; kleine witte labels op zee staan op een donkere pil rgba(8,40,52,.62). Bordkunst: de vastgelegde bordafbeeldingen tonen Groen nog als #0A6B63; opnieuw vastleggen met #1E9E8E vóór de bouw.

## 21. Typografie

Fonts (zelf gehost): Outfit 500-800 voor titels, getallen, primaire knop; Figtree 400-800 voor UI. `font-variant-numeric: tabular-nums` op body.

| Rol | Maat / gewicht | Token | Opmerking |
| --- | --- | --- | --- |
| Hero ("Katan", eerste keer) | 34 / 650 Outfit | `--fs-hero` |  |
| Schermtitel | 26 / 650 Outfit | `--fs-xxl` |  |
| Kaart-/sheettitel | 20-22 / 650 Outfit | `--fs-xl` |  |
| Lijsttitel, knop, body-strong | 16 / 700 Figtree | `--fs-l` |  |
| Body, ondertitel | 14 / 550 | `--fs-m` |  |
| Klein, hulptekst | 12.5 / 550 | `--fs-s` |  |
| Label, tab, chip | 11.5 / 700-800 (eyebrow hoofdletters +.1em) | `--fs-xs` | Minimum 11.5 |
| Primaire knop | 19 / 650 Outfit |  |  |
| Getallen in tokens | Outfit 700, 15-22 |  |  |
| Resultaatgetal (Dagpuzzel) | Outfit 700, 88, regelhoogte .95, tracking -.02em |  | Eenheid "beurten"/"punten" Outfit 650 22 |

Tekstgrootte-instelling (Klein/Normaal/Groot) schaalt de root; layouts mogen daardoor niet horizontaal scrollen.

## 22. Spacing, radius, hoogte

| Token | Waarde (px) | Gebruik |
| --- | --- | --- |
| `--sp-1..6` | 4, 8, 12, 16, 20, 24 | raster 4 |
| Zijrand scherm | 16 | sheet binnen 20 |
| Kaart-padding | 14 | tussenruimte kaarten 12 |
| Rijhoogte min | 56 |  |
| Tikdoel min | 44 x 44, tussenruimte min 8 | niet-interactieve chips 24-28 |
| `--r-s` | 8 | kleine onderdelen, handkaart |
| `--r-m` | 12 | knoppen, tegels (segment 13 bak / 10 knop) |
| `--r-card` | 20 | kaarten |
| `--r-sheet` | 22 | sheet boven |
| `--r-pill` | 999 | chips |
| Kaartschaduw | 0 8px 28px rgba(0,30,60,.22) | op zee |
| Tegelschaduw | 0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,30,60,.12) |  |
| Sheetschaduw | 0 -10px 40px rgba(0,0,0,.25) |  |
| Primair schaduw | 0 1px 2px rgba(16,60,66,.22), 0 6px 16px rgba(20,84,92,.24) |  |
| Inhoudsbreedte | max 460, gecentreerd | telefoon vol breed |
| Safe areas | `env(safe-area-inset-top/bottom)` | tabbalk, sticky footer, coach |
| Schermmaten getest | 360 x 780 en 412 x 923 | geen horizontale overflow |

## 23. Beweging

Easings (Zonnig eiland): `--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-pop: cubic-bezier(.3,1.3,.6,1)`.

| Wat | Duur | Easing | Bron |
| --- | --- | --- | --- |
| Ingedrukt (knop, kaart) | 120 ms | ease | bestaand (`.btn:active` scale .97) |
| Schakelaar | 150 ms | ease | mock |
| Handkaart transform | 200 ms | `--ease-pop` | bestaand |
| Sheet in (translateY 40 + opacity) | 280 ms | `--ease-out` | bestaand `sheetUp` |
| Sheet uit | 200 ms | ease-in | voorstel |
| Scrim | 200 ms fade | linear | voorstel |
| Toast in | 260 ms (translateY -6, scale .98) | `--ease-pop` | bestaand `toastIn` |
| Toast uit | 180 ms | ease | bestaand |
| Toast zichtbaar | 3 s (5 s met actie) |  | DS / voorstel |
| Coachstap wissel | 200 ms cross-fade | ease | voorstel |
| Pulse (gemarkeerde plek) | 1.6 s, oneindig, scale 1 naar 1.35, opacity 1 naar .55 | ease-in-out | mock |
| Voortgang Dagpuzzel | 200 ms per beurt | ease | voorstel |
| Tabwissel | geen |  | niveau 1, geen animatie |
| Banner uit | 180 ms | ease | voorstel |

Reduced motion (`data-motion="reduced"` of `prefers-reduced-motion`): alle animaties 1 ms, pulse en slide worden fades (max 120 ms), geen oneindige animaties, geen glans op skeleton.

## 24. Iconen

Besluit productowner: de huidige app-iconen blijven. Bron: `src/ui-icons.js` (24-raster, 2 px lijn, ronde uiteinden, `currentColor`, klasse `.oi`). Spelkunst (grondstoffen `ic-wood/brick/sheep/wheat/ore`, dorp/weg/stad, rover, dobbelstenen `die-1..6`, kaartkunst `card-*`, avatars `av-0..5`, logo `kt-logo`) blijft ongewijzigd. Nieuwe lijniconen alleen waar de huidige app er geen heeft. Knoppen volgen ook de huidige app: radius 10, wit met beige rand, primair teal verloop, icoonknop 44 x 44 vierkant met radius 10 (in Home, Instellingen, Nieuw spel, Pauze, game en review).

**Huidige iconen die de shell gebruikt** (uit `src/ui-icons.js`, ongewijzigd):

| Icoon | Waar |
| --- | --- |
| `dice` | Tab Spelen, modus Klassiek, verloren dag-rij |
| `history` | Tab Terugblik, meldingen "Spel hersteld", rij "Oefen een eerdere dag" |
| `bars` | Tab Bots, rij Stand en statistieken |
| `settings` | Tandwiel op elk tab-root, rij Instellingen |
| `sliders` | Aanpassen, Meer regels |
| `clock` | Modus Rush |
| `close` | Sluitknop sheet |
| `check` | Chip "Gewonnen", toast "Code gekopieerd" |
| `trophy` | Gewonnen dag-rij |
| `lessons` | Review-knop |
| `book` | Instellingen, Hoe werkt Katan? |
| `info` | Uitleg-knop in ticker, rij Uitleg, Uitleg bij de opstelling (vervangt het eerdere "?" `help`) |
| `lab` | AI Lab |
| `trade` | Havenvisual in coach stap 4 |
| `home` | Pauze, Naar start |

Ook beschikbaar in de huidige set maar niet in de shell: `build`, `devcard`, `robber`, `target`, `star`, `road`, `settlement`, `city`, `ship`, `harbor`, `scale`, `explore`.

**Nieuw toegevoegd** (zelfde stijl, alleen omdat de huidige set ze mist; ze moeten in `src/ui-icons.js` komen):

| Icoon | Waar | Reden |
| --- | --- | --- |
| `sun` | Reeks-chip, weekstrook | Reeks is nieuw; vervangt vlam |
| `puzzle` | Tab Dagpuzzel | nieuwe functie |
| `cal` | Alle dagen | geen kalender in huidige set |
| `people` | Vergelijk met een vriend | idem |
| `share`, `copy` | Deel je uitslag, kopieer code | idem |
| `wifioff` | Offlinebanner | idem |
| `palette`, `sound`, `download` | Instellingen: Thema, Geluid, Bewaar mijn gegevens | idem |
| `moon` | Toast "Kleuren volgen je telefoon." | idem |
| `chev`, `back` | Rij-chevron, terugpijl | de huidige app gebruikt het tekstteken ›; lijnicoon voor scherpte en `aria-hidden`, optioneel houden als teken |
| `alert`, `lock`, `globe`, `plus` | gereserveerd (foutstatus, gesloten, taal, toevoegen) | niet in de shell-mockups |

In de mockups zijn `trophy` (eerst een afwijkend pad), `help` (nu `info`) en `retry` (nu `history`) teruggezet naar de huidige set (`home/src2/lib.cjs`) en alle shots opnieuw gemaakt. Maten: 24 standaard, 22 in lijstvlakken, 20 trailing, 16-18 in chips. Iconen zonder tekst hebben altijd een `aria-label`.

## 25. Algemene staatregels en toegankelijkheid

1. Eén primaire knop per scherm of sheet, in de duimzone onderaan.
2. Doelen min 44 x 44 met min 8 ertussen; tekst min 11.5.
3. Meer dan 2 korte tekstregels per element is niet toegestaan; liever icoon, getal, avatar, dobbelsteen.
4. Betekenis nooit alleen met kleur; foutmeldingen die niet over Jij gaan gebruiken neutrale inkt met icoon.
5. Focusvolgorde = leesvolgorde (links boven naar rechts onder); sheets vangen focus; bij sluiten terug naar de trigger.
6. Taal `lang="nl"`; getallen via `num()`; datum "di 24 nov".
7. Licht en donker volgen het systeem (`colonist.paletteAuto = "system"`); `meta theme-color` en splash volgen de effectieve palette.
