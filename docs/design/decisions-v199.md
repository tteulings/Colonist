# v1.99 product-owner decisions and build notes (rebuild record)

## PO decisions
- Hand cards: current app fan and layout (light curve). Current app icons; button look as current app (no icons on Build etc. buttons as in mockups).
- Player cards: new style but compact; board at least as large as now.
- Tab bar variant A (Spelen, Dagpuzzel, Terugblik, Bots); Dagpuzzel tab/card shows disabled "Binnenkort" in v1.99.
- Default language ENGLISH for anyone without a stored choice (stored choice wins; no navigator sniffing).
- Auto dark mode for anyone who never chose a palette; one toast "Colours follow your phone." with Undo.
- All 11 bot levels stay reachable: Nieuw spel sheet shows main levels, "More levels and a level per bot" second layer.
- Nieuw spel sheet with "More rules" second layer; Pauze with 5 rows (Uitleg, Stand, Instellingen, Nieuw spel, Naar start); Instellingen in 5 groups (Uiterlijk, Spel, Leren, Gegevens, Over).
- Post-game: Geluk as win chance; Precisie and Geluk for all players; point bars in seat colour; warmer; green/red with ▲▼ for ALL players (old "only Jij" rule retired).
- Analysis: see analysis-v199.md (three lessons, v1.99 scope, luck unbalanced).
- Board layouts (Meer, Landengte, Willekeurig): NOT in v1.99; next version.
- Host-in-app default ON: not approved, not in v1.99.

## Integration notes from the lost first build (avoid re-learning)
- NL strings: shell table NL_199 loaded first (older tables win), post table NL_199P loaded last (post wins). No shared keys.
- Remove the v1.98 type-scale override in themes/shell.css for post screens; then let `.rs-key .x` and `.rv-list .x` wrap.
- Terugblik: only post-ui's Games | Lessons door ([data-pxdoor=lessons]); keep tab-root frame (gear, no back arrow, tab bar).
- lessons194 long task: during analysis update only the progress line in place, redraw the Lessons page once at the end (max long task went 127 -> 74 ms).
- tests/verdict182.js regex for "Miss": `Miss(?![a-z])`. i18n-walk must click end-screen tabs inside the closed "More" card.
- aitab173/why182/verdict182 need redesign/state9383.json (copy of state9101.json) in the test root.
- Version bump: APP_VERSION 1.99, all ?v=198 -> ?v=199 (avatar ?v=57 stays), cache colonist-v199, new files in sw.js SHELL.

## Review of the built analysis screens (PO, 24 nov)
The approved screenshots (docs/design/shots/analysis-approved/) are the reference, not a cage. Critics judge broadly: does it teach (the three lessons), is it clear for a casual player, is it pleasant and consistent, does it beat the mockups where it can. Deviations from the mockups are fine when they are improvements; flag them with the reason.
