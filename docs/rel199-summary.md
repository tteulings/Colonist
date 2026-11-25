# v1.99 release integration summary (branch `claude/wip-rel199`)

## Merges (in order)
1. `origin/claude/wip-perf199` into rel199 (shell + post-game analysis + facts layer): **no conflicts** (game.js, base.css, sw.js, golden/lib.mjs all merged automatically). No new runtime file, so sw.js SHELL needed nothing. APP_VERSION 1.99, all `?v=199` (avatar `?v=57` stays), cache `colonist-v199` checked.
2. `claude/wip-fixA` (short games, start picks): no conflicts.
3. `claude/wip-fixB` (counters, resume, tempo, ties): one conflict, `src/post-ui.js` (`lesson1`): fixB's `lh("", "Real errors", ...)` (no lesson number) kept together with fixA's "Good play" only when won / no praise on thin games body.
4. `claude/wip-fixC` (Adjust save, set-up reasons, chips, notes): no conflicts.
No new src file came with fixA/B/C (only tests `start199`, `thin199`, `resume199`, `shell1991` and screenshots under `shots/`), so SHELL is complete. Commit 348ccdd (ui191 tab order) survives.

Own changes on top: ui191 follows the v1.99 tab order and the px-mv Moves list; Dutch for the empty Review tab ("Nog geen eerdere spellen", it was English in v1.98 as well); the Overview note "N had only one sensible option (not counted)" / NL "bij N maar een verstandige keuze (niet geteld)" (the old wording read as a contradiction with "0 of 28 decisions are scored"; in the synthetic thin-none variant all 28 are unscored by construction, in a real game `oneOption` = decisions minus scored); Precision note shortened to fit two lines in NL; resume199 sample tolerance (fixA scores the start picks first, so the run may already hold one result more when the page is sampled: `n >= cut && n <= cut + 3`).

## Results (HEAD d1510c5, one suite at a time)
| Suite | Result |
| --- | --- |
| golden plain / `--host` | ALL 37 MATCH both (never --force) |
| golden-events | ALL 62 MATCH |
| adopt199 / quick199 | 6159 adopted steps equal / 11583 judgements equal |
| api201, tourn196, bots196, ledger190 | ALL PASS / OK |
| analysis199 (2331 checks), text199 | ALL OK |
| analysis199-ui (EN+NL, light+dark, 360+412) | ALL OK |
| facts199-ui (39 games, EN+NL) | ALL OK (2.6M checks, 78 game runs, 0 fails) |
| thin199, start199, resume199, shell1991 | ALL PASS |
| shell199 (full), tap132, palette195, splash193, wintab1901, lessons194, verdict182, why182, ui191b | ALL OK |
| nl198 nl and en, i18n187 | ALL OK |
| upgrade1911 (OLD = v1.98 worktree main198, NEW rel199) | ALL OK, 42 checks |
| hostfallback197, resume196, determinism-pw, intent196, intent197 (BASE base196align), rushmono195 | ALL PASS / OK |
| ui191 | **FAIL, open decision**: 6 checks, all in the AI tab. fixC made the ask chips wrap to two lines at 360 px (they were cut off: user test finding 10), so "ask chips are one row" and "ask bar at most 15% of the screen" (129 px = 16.5%) fail at 360 (both languages), the chips-row check also at 412. The Moves/Luck/Overview parts pass (the test was adapted to the new tab order and px-mv list earlier). I did not loosen the assertions (rule: never weaken thresholds); the PO should decide: accept wrapping and change the test to "at most two rows, none cut off, bar at most 17%", or make the row one line again. |
| aitab173 | 5 FAILs, all fixture-limited and **identical on v1.98** (`main198`): the test needs an export with a point-card/dice story that the lost v1.97 uploads held; with the committed r1.json: ledger size, decision board zoom, zoomed board picture, 429 message, language of messages |
| avatar192 | 1 FAIL (still-frame hashes `blaauw-*` of the detail layer), **identical on v1.98**: environment/renderer difference, no avatar source file changed since main |
| lessons194-lib, i18n-walk | libraries (no run of their own); lessons194 and i18n187 use them and pass |
| rushmono195 | passed first run (no flake this time) |

Earlier in the round (before fixA/B/C, tree 2cb7b05) the same suites also passed, and `intent197` also passed with the Fast switches forced off.

## events197 / inapp197 (verdict)
Settings: events197 full (EN+NL, 4 games), inapp197 `ONLY=classic,sea GAMES=1` (the matrix is far too slow for a full run on this machine: about 4 min per play).

* rel199 (Fast pacing) vs `base196align`: events197 8 FAILs, all "sfx stream identical" (a `resourceGain` sound against devCard / buildRoad / robber / buildSettlement at the same moment; classic #40, classic-balanced #21, seafarers #14, five-six #68 (nl) / #36 (en)). All other events197 checks PASS (anim stream, journal, event stream rebuilds the final position, seeded game reproducible, ...). inapp197: "host ON = old driver" PASS everywhere (the host route plays the same games); "old driver = previous release" FAILs by one poll (26 vs 27, human: poll 20 vs 21): the Fast pacing shortens waits on purpose.
* rel199 vs **`main198` (v1.98)**: events197 FAILs with the **same pattern**, the same first differences (classic #40, classic-balanced #21, seafarers #14, five-six #68 / #36), so the baseline is not what changed. inapp197: inapp197 `ONLY=classic,sea GAMES=1`: host ON = old driver PASS in all 4 cases; "old driver = previous release" FAILs in all 4 with the same differences as against base196align (bots only: snapshot #18, poll 26 vs 27; one human: first difference at #15, poll 20 vs 21).
* With the two Fast switches forced off (`_botsFast` and `Fx.fast` return false): inapp197 against base196align PASSES everywhere it ran (classic 2 games bots + human, seafarers, six, rush: all `old driver = previous release` PASS), i.e. the games themselves are unchanged. events197 then still fails 2 to 3 EN cases (classic-balanced, seafarers, sometimes classic), NL passes.
* The tree before the perf merge (17d08e6) passes events197 completely (two runs). Bisecting the merge: taking the old `fx.js` + `base.css` back does not help; taking the old `game.js` back passes; putting back only the unconditional scroll-to-newest-line read of `renderLog` (the perf change that now reads layout only where the journal is visible) passes the quick run. So the remaining difference is a timing one: the app now does less layout work between two timers, and two sounds due within the same few ms (the 900 ms `resourceGain` timer against an event sound) swap order. No game state, event stream, journal or animation differs (those checks pass). A further full run with the scroll read restored failed one other check once (an anim position in one NL game, 311 vs 348), another sign that these stream checks are sensitive to timing under load.
* Verdict: same failure pattern against v1.98 and against base196align, no state or event difference: this is a timing-sensitive, stale comparison (the sfx order and poll count of the older releases), not an engine regression. Nothing was forced. A suite that compares timer order exactly cannot pass once rendering gets faster; the fix belongs in the test (compare the sfx multiset per second, or order within a window), not in the app. Per the PO: these long suites run only when engine/host code changes (see decisions-v199.md).

## Other findings
* Overview of a short game with 0 decisions scored: the headline card now reads "Too few scored moves for a verdict" (fixA, `thinCard`, test thin199 passes); the bare "Jij" title is followed by that sentence.
* `shots/` at the repo root (fixA/B/C crops, about 40 MB) came in with the fix branches; consider removing them before release.
* The first run after the perf merge also found: ui191 still looked for the old Moves list (fixed in the test), the empty Review tab was English in Dutch (fixed).

## Screenshots
`docs/design/shots/rel199-final-shell-{nl-light,nl-night,en-light}.png` (18 shell screens each) and `rel199-final-post-{nl-light,nl-dark,en-light}.png` (all post-game screens, two games). Full-size files (360x780 @2x, taken on the merged tree d1510c5): scratchpad `rel199-final-shots-2/{shell,post}/`.
