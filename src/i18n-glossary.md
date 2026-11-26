# Dutch glossary (one term per concept)

Used by `src/i18n-nl-*.js` and the AI tab (`src/review/ai-lang.js`). `tests/i18n187.js` scans both for the forbidden variants.

| Concept | Dutch | Never |
|---|---|---|
| settlement | dorp (the AI tab's "dorpsplek" for a spot) | nederzetting |
| robber / pirate | rover / piraat | Struikrover |
| Longest road | Langste handelsroute | Langste weg |
| Largest army | Grootste riddermacht | Grootste leger |
| Victory Point card | Puntenkaart | Overwinningspunt(kaart) |
| Year of Plenty | Uitvinding | Jaar van overvloed |
| setup (start placement) | Beginopstelling (spots: startplek) | Opzet, opzetplek |
| Seafarers | Zeevaarders | Zeevaart |
| Map (the land shape): Island, Seafarers, Lake, Isthmus, Random shape | Kaart: Eiland, Zeevaarders, Meer, Landengte, Willekeurige vorm | "Willekeurig" alone for the shape (that is a Board layout value) |
| Board layout (how tiles and numbers are shuffled): Random, Balanced, Beginner (fixed) | Bordindeling: Willekeurig, Evenwichtig, Beginner (vast) | Kaart for it |
| Cancel | Annuleren | Annuleer |
| keep (a card / cards when discarding) | Bewaar | Houd |
| discard on a 7 | afleggen, "geeft de helft af", "Leg ... af" | afgooien, "geef terug" |
| development cards | ontwikkelingskaarten | ontw.kaarten |
| turn | Beurt, chart label B14 | T14 |
| steal | een kaart pakken / gepakt | steal(s), stelen |
| Rating (bots) | Waardering | Rating |
| Train this | Oefen dit | Train dit |
| upgrade a settlement | "Maak er een stad van" | Upgrade naar een stad |

Number rules: counts agree with their noun ("1 kaart", "2 kaarten", "1 beurt", "5 beurten"; `nlFix` in `src/i18n.js`);
version numbers keep the dot ("v1.87", never "v1,87"); decimals elsewhere use the comma; "jou" after a preposition or verb ("gaven jou").
Tap/click: "tik op ..." ("tik op een gemarkeerde plek"). Rush timing: "elke 8 sec gooien".
