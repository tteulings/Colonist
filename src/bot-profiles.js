// v1.04 proposal (mockup data, not wired into the game yet): a richer profile per bot preset, its
// illustration (original inline SVG, in the flat + soft-ink style of src/themes/portraits.js) and the
// level frame / medallion for the player chips.
//
// Every claim below is read from the code: AI_PRESETS / AI_LEVEL_PLAIN (src/game.js), the rulebook bot
// (src/ai-rules.js) and the Master search (src/master.js). Strength figures are measured, never estimated:
//   win%  one bot of this preset vs 3 Intermediate bots, 4-player base game, 10 VP, paired seeds with the
//         seat rotated (500 seeds x 4 seats = 2000 games;), ±95% CI.
//         With 4 equal bots every seat wins 25%.
//   Master +8.4 ±5.4 pp win chance vs the Expert in the same seat against 3 Experts (n=500, CRN harness,
//         v0.91); its own seat wins 33.4% ±4.1 there.
//   review accuracy: src/review/bands.js (one source with the review screen's bot band; the bots' own moves scored by the
//         deep Monte Carlo check, k 0.10, [accuracy, SE]). v1.21: the old 78-91 figures were from the first calibration.

import { botBand } from "./review/bands.js";

export const BOT_STRENGTH_SOURCE = "One bot vs 3 Intermediate bots, 4 players, 10 VP, 2000 games (500 seeds x 4 seats), v1.03 code. Equal bots win 25% each.";

/** level: 1–5 dots (from the measured win rate), win: { p, ci } vs 3 Intermediate, acc: [review accuracy, SE] from src/review/bands.js */
/** v1.39 Grandmaster is released: in the picker, the AI Lab and on the Bots page. Kill switch for support: ?gm=0 or localStorage
 *  colonist.gm = "0" hides it again. */
export function gmFlag() {
  try { return !((typeof location !== "undefined" && /[?&]gm=0\b/.test(location.search || "")) || (typeof localStorage !== "undefined" && localStorage.getItem("colonist.gm") === "0")); } catch (_) { return true; }
}
export const BOT_PROFILES = {
  beginner: {
    label: "Beginner", tagline: "gentle, learns rules", level: 2, win: { p: 11.2, ci: 1.4 }, acc: botBand("Beginner"),
    style: "Settles on the biggest numbers and builds whatever it can afford, in a fixed order: settlement, city, road, card.",
    good: "Never sits on a full hand: it builds as soon as it can.",
    weak: "No plan: it doesn't save up for cities and spends on roads. It ignores the score, so it never slows down a leader.",
    beat: "Take the second-best numbers next to it and plan two builds ahead; it won't come after you.",
    trades: "Only with the bank or its harbours, when that brings its next build a turn closer. It never deals with players.",
    robber: "Blocks the busiest opponent tile, whoever is winning, and steals from a random player there.",
    cards: "Buys cards with spare cards; plays a Knight when the robber is on its own tile or it takes Largest Army.",
  },
  simple: {
    label: "Simple", tagline: "plays by 7 rules", level: 1, win: { p: 4.7, ci: 0.9 }, acc: botBand("Simple"),
    style: "A checklist bot: each turn it walks 7 rules top to bottom (city, settlement, Knight, road, card, one bank trade, end turn) and does the first that fits.",
    good: "Completely predictable: perfect to learn the game against, and the AI panel shows which rule fired.",
    weak: "Weakest bot. It buys development cards but only ever plays a Knight (when the robber sits on its tile); Monopoly, Year of Plenty and Road Building stay in its hand.",
    beat: "Stay off the top of the score: its robber always goes to the leader's best tile.",
    trades: "Never offers. Says yes only to a deal that lets it build something right away; at most one bank or harbour trade, to finish a city or settlement.",
    robber: "Always the leader's tile with the most pips, and it steals from the leader. On a 7 it discards what it has most of.",
    cards: "Buys a card whenever it can; plays only Knights.",
  },
  intermediate: {
    label: "Intermediate", tagline: "solid all-rounder", level: 3, win: { p: 25.0, ci: 1.9 }, acc: botBand("Intermediate"),
    style: "Plans its next build (settlement, city or card) by what pays off soonest and saves its cards for it.",
    good: "Mixes resources and ports when it settles, and makes fair deals that help its plan.",
    weak: "No race for Longest Road or Largest Army, and it plays cards only when the use is obvious.",
    beat: "Win a bonus card (Longest Road or Largest Army): it won't race you for either.",
    trades: "Bank and harbour trades, plus fair 1-for-1 deals (up to 2 offers a turn). It refuses lopsided offers and won't deal with someone about to win.",
    robber: "Leans toward players above the average score and steals from the biggest hand.",
    cards: "Buys with spare cards; plays one when the use is obvious (robber on its tile, Largest Army in reach, Monopoly for a big haul).",
  },
  expert: {
    label: "Expert", tagline: "plays to win", level: 4, win: { p: 41.1, ci: 2.2 }, acc: botBand("Expert"),
    style: "The Intermediate's planner, plus it races for Longest Road, aims for 2:1 harbours and avoids tiles the robber likes.",
    good: "Chases Largest Army, saves Monopoly for the biggest haul, and plays a Knight before rolling when that pays.",
    weak: "Won't deal with anyone 2 points ahead of it, so it can get stuck on one resource. It guesses your hand only from what everyone can see.",
    beat: "Keep your public score low and spread your numbers so one robber can't hurt you much.",
    trades: "Bank, harbours and fair deals that bring its plan closer; never with the leader or anyone 2+ points ahead of it.",
    robber: "Hits the leader hard (harder still when the leader is 3 points from winning) and steals the card it most likely needs, judged from public card counts.",
    cards: "Strategic: builds toward Largest Army, holds Road Building for roads its plan needs.",
  },
  trader: {
    label: "Trader", tagline: "deals all game", level: 3, win: { p: 29.1, ci: 2.0 }, acc: botBand("Trader"),
    style: "An Intermediate that lives at the market: it makes offers every turn, to everyone, and keeps dealing after it has built.",
    good: "Finishes builds early: it pays 2-for-1 when that completes a build right now.",
    weak: "Spends cards on deals, and every deal it makes also helps someone else.",
    beat: "Take its offers only when they help you more than it, and expect a lot of them.",
    trades: "Up to 6 offers a turn plus 2 more deals with bots after building; accepts any small but real gain. Like every bot it won't help a leader who is about to win.",
    robber: "Like the Intermediate: leans toward players above the average score, steals from the biggest hand.",
    cards: "Reactive: buys with spare cards, plays them when the use is obvious.",
  },
  builder: {
    label: "Builder", tagline: "roads & cities", level: 4, win: { p: 36.7, ci: 2.1 }, acc: botBand("Builder"),
    style: "The Expert's eye for the board (placement, harbours, Longest Road race) with only reactive cards and basic awareness.",
    good: "Expands fast and well: roads up to 4 steps toward its next spot, and it goes for Longest Road.",
    weak: "Doesn't chase Largest Army and only watches the score roughly, so it is late to stop a runaway leader.",
    beat: "Cut its road to the next good spot early, and take Largest Army; it won't fight you for it.",
    trades: "Bank, harbours and fair deals that bring its plan closer; never with someone about to win.",
    robber: "Leans toward players above the average score and steals from the biggest hand.",
    cards: "Reactive: buys with spare cards, plays them when the use is obvious.",
  },
  shark: {
    label: "Shark", tagline: "hunts the leader", level: 3, win: { p: 28.8, ci: 2.0 }, acc: botBand("Shark"),
    style: "An Intermediate builder with the Expert's sharp eyes: it tracks the score and the public card counts and goes after whoever leads.",
    good: "Robber and Knights hit the leader, it chases Largest Army, and it won't deal with anyone 2+ points ahead of it.",
    weak: "Plainer settling and planning than the Expert, and no race for Longest Road.",
    beat: "Don't lead in public: keep points hidden (development cards) and stay level until you can finish.",
    trades: "Bank, harbours and fair deals; never with the leader or anyone 2+ points ahead of it.",
    robber: "Hits the leader hard, harder when the leader is close to winning, and steals the card it most likely needs.",
    cards: "Strategic: builds toward Largest Army, saves Monopoly for a big haul.",
  },
  master: {
    label: "Master", tagline: "Expert + looks ahead", level: 5, win: { p: 55.6, ci: 3.4 }, acc: botBand("Master"),
    style: "Plays like the Expert, but before each set-up spot, build step and robber move it plays out about 100 possible futures (up to half a second) and picks what wins most.",
    good: "Wins 55.6% against 3 Intermediate bots (±3.4, 800 games), 14.8 percentage points more than the Expert on the same boards.",
    weak: "Player trades are the Expert's own. In Seafarers it searches too (ships, the free ship move and the pirate included) and scores its futures with a model learned from Seafarers games: 52.5% against 3 Intermediates there (±6.9, 200 games; the Expert 30.5%). In Rush its search is capped at a quarter of a second a move, and with 5–6 players it gets fewer playouts in its half second, so its edge there is smaller and not measured.",
    beat: "Same as the Expert: stay out of the lead in public, keep your numbers spread, and finish in one turn.",
    trades: "Like the Expert: fair deals that bring its plan closer, never with someone 2+ points ahead of it.",
    robber: "Searched: it tries the tiles and keeps the one that pays off best in its playouts.",
    cards: "Strategic, like the Expert; whether to play a card is part of the search.",
    note: "Measured: on the same 800 boards as the Expert +14.8 pp (±4.3). Earlier, against 3 Experts: +8.4 ±5.4 pp over an Expert in the same seat (n=500).",
  },
  // v1.10: the Master's search with ten times the thinking. bot-125: measured (vs 3 Intermediates, no time limit).
  super: {
    label: "Super Expert", tagline: "Master with 10x more thinking", level: 5, beyond: true, win: { p: 71.0, ci: 4.4 }, acc: null,
    style: "The Master's search with ten times the thinking: before each set-up spot, build step and robber move it plays out 545 possible futures, looking 14 turns ahead (18 in set-up), and picks what wins most. It stops early when one move is clearly ahead.",
    good: "Much stronger than the Master: 71.0% against 3 Intermediate bots (±4.4, 400 games), 32.5 points above the Expert. It sees further and spots slow plans (a city race, Longest Road) that a short look misses.",
    weak: "Slow: 545 futures a move, about 3 seconds on a phone, so your phone waits for it (a fixed amount of thinking: as strong on every phone, just faster or slower). In Rush it gets 20 futures a move (about a Master there). In Seafarers it searches too (ships, the free ship move and the pirate included) and scores its futures with a model learned from Seafarers games; its strength there is not measured yet. With 5–6 players the same 3 seconds buy fewer playouts. Player trades are the Expert's own.",
    beat: "Same as the Expert: stay out of the lead in public, keep your numbers spread, and finish in one turn.",
    trades: "Like the Expert: fair deals that bring its plan closer, never with someone 2+ points ahead of it.",
    robber: "Searched: it tries the tiles and keeps the one that pays off best in many playouts.",
    cards: "Strategic, like the Expert; whether to play a card is part of the search.",
    note: "Its win figure was measured with 1000 futures a move; in the app it plays 545 a move (about 3 s on a phone): a re-measurement at 545 is running.",
  },
  // eng-130: the Super Expert+ search spread over several cores. Numbers: src/bot-stats.js (filled in from the eng-130 runs).
  grandmaster: {
    label: "Grandmaster", tagline: "Super Expert+ on every core", level: 5, beyond: true, win: null, acc: null,
    style: "The Super Expert+ search (the learned position score at the end of every future, 14 turns ahead, 18 in set-up, 1090 futures a move, twice the Super Expert+), run on several cores of your phone at once, each playing its own share of the futures. In the same 3 seconds it plays about three times as many futures as the Super Expert+.",
    good: "The strongest bot: head to head with the Super Expert+ (and 2 Experts) at the app's 3 s a move, it won 48.0% of the games against 25.0% for the Super Expert+ (+23 points, ±15, 100 games with every seat order). It plays about twice as many futures per move in the same time, so its choices rest on more evidence, mostly in close calls.",
    weak: "About 3 seconds a move on a phone with several cores (1090 futures), and it keeps up to 3 cores busy meanwhile: more battery, and a long game can warm the phone. On a phone with few cores it does the same work on one, so it thinks longer there (up to 6 s; then it stops). In Rush it has a quarter of a second a move. With 5–6 players the same time buys fewer futures. Player trades are the Expert's own.",
    beat: "Same as the Expert: stay out of the lead in public, keep your numbers spread, and finish in one turn.",
    trades: "Like the Expert: fair deals that bring its plan closer, never with someone 2+ points ahead of it.",
    robber: "Searched: it tries the tiles (and in Seafarers the pirate's sea hexes) and keeps the one that pays off best in many playouts.",
    cards: "Strategic, like the Expert; whether to play a card is part of the search.",
    note: "Measured head to head with the Super Expert+ at the app setting: the 3 s on a phone counted in futures (Super Expert+ 545, Grandmaster 1090, the futures each got in 1 s on an idle 4-core desktop, a phone taken as 3x slower: an estimate). Against 3 Intermediates it is not measured. Battery and heat: while it thinks it uses up to 3 cores for 3 s a move; set a weaker bot for long sessions on battery.",
  },
  // bot-125 (working name): the Super Expert's search with the boosted value model as its position score. Measured like the Super Expert.
  superplus: {
    label: "Super Expert+", tagline: "Super Expert with a learned eye", level: 5, beyond: true, win: { p: 71.5, ci: 4.4 }, acc: null,
    style: "The Super Expert's search (545 futures a move, 14 turns ahead, 18 in set-up, about 3 s on a phone), but where each future stops it judges the position with a model learned from thousands of bot games (the same scorer as the game review), not the hand-made score.",
    good: "As strong as the Super Expert against 3 Intermediate bots (71.5% ±4.4, 400 games; +0.5 pp on the same boards, ±5.4). Head to head at one table it finished above the Super Expert in 58.0% of 112 games (±9.0): a slight lean, not significant.",
    weak: "Slow, like the Super Expert: 545 futures a move, about 3 seconds on a phone, so your phone waits for it. In Rush it gets 20 futures a move. In Seafarers it searches too (ships, the free ship move and the pirate included) and scores its futures with a model learned from Seafarers games: 70.0% against 3 Intermediates there (±9.0, 100 games, no time limit; the Expert 30.5%). With 5–6 players the same 3 seconds buy fewer playouts. Player trades are the Expert's own.",
    beat: "Same as the Expert: stay out of the lead in public, keep your numbers spread, and finish in one turn.",
    trades: "Like the Expert: fair deals that bring its plan closer, never with someone 2+ points ahead of it.",
    robber: "Searched: it tries the tiles and keeps the one that pays off best in many playouts.",
    cards: "Strategic, like the Expert; whether to play a card is part of the search.",
    note: "Its win figure was measured with 1000 futures a move; in the app it plays 545 a move (about 3 s on a phone), the setting of its head to head with the Grandmaster: a re-measurement at 545 is running.",
  },
};

// ── illustrations: 100x100, a soft disc (--pa-bg) and flat pieces with a soft ink outline (--pa-ink) ──
const INK = "var(--pa-ink,#2B211C)";
const o = (w = 2.6) => ` stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const disc = `<circle cx="50" cy="50" r="48" fill="var(--pa-bg,#FDF1D8)"/><ellipse cx="50" cy="80" rx="34" ry="8" fill="var(--pa-ground,#E9DCC0)"/>`;

const ART = {
  // folded map + compass
  beginner: `<path d="M18,30 L36,24 L54,30 L74,24 L74,72 L54,78 L36,72 L18,78Z" fill="#F7E7B9"${o()}/>
    <path d="M36,24 V72 M54,30 V78" fill="none"${o(2)} stroke-opacity=".45"/>
    <path d="M23,62 Q30,52 40,57 T52,45" fill="none" stroke="#D1453A" stroke-width="2.4" stroke-dasharray="3 3" stroke-linecap="round"/>
    <path d="M49,40 l6,6 M55,40 l-6,6" stroke="#D1453A" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="68" cy="62" r="15" fill="#FFFDF8"${o()}/><circle cx="68" cy="62" r="11" fill="none" stroke="#7FB069" stroke-width="2"/>
    <path d="M68,52 L71,62 L68,72 L65,62Z" fill="#D1453A"/><path d="M68,62 L71,62 L68,72 L65,62Z" fill="#8D9AA8"/><circle cx="68" cy="62" r="1.8" fill="${INK}"/>`,
  // clipboard with 7 rules, three ticked
  simple: `<rect x="26" y="18" width="48" height="62" rx="6" fill="#C98F55"${o()}/>
    <rect x="31" y="25" width="38" height="50" rx="2" fill="#FFFDF8"${o(1.6)}/>
    <rect x="40" y="13" width="20" height="9" rx="3" fill="#8D9AA8"${o(2)}/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="36" y="${29.5 + i * 6.3}" width="3.4" height="3.4" rx=".8" fill="${i < 3 ? "#5FA35A" : "#fff"}" stroke="${INK}" stroke-width="1"/><path d="M42,${31.2 + i * 6.3} H${i % 2 ? 58 : 63}" stroke="${INK}" stroke-opacity="${i === 2 ? 0.9 : 0.4}" stroke-width="1.8" stroke-linecap="round"/>`).join("")}
    <path d="M67,41 l-6,3" stroke="#D1453A" stroke-width="2.6" stroke-linecap="round"/>`,
  // a balanced seesaw: a house on one side, wheat + ore on the other
  intermediate: `<path d="M50,58 L42,74 H58Z" fill="#8D9AA8"${o()}/>
    <rect x="14" y="54" width="72" height="5" rx="2.5" fill="#C98F55"${o(2.2)}/>
    <path d="M19,54 V40 L29,31 L39,40 V54Z" fill="#E57A3C"${o()}/><path d="M17,41 L29,30 L41,41" fill="none"${o(3)}/>
    <rect x="26" y="45" width="6" height="9" rx="1" fill="#FFFDF8"${o(1.6)}/>
    <path d="M70,54 Q66,40 70,28 M70,54 Q74,40 70,28" fill="#E9B949"${o(2)}/>
    ${[32, 38, 44].map((y) => `<ellipse cx="66.6" cy="${y}" rx="2.6" ry="4" fill="#F2C94C"${o(1.4)}/><ellipse cx="73.4" cy="${y}" rx="2.6" ry="4" fill="#F2C94C"${o(1.4)}/>`).join("")}
    <path d="M56,54 L59,46 L66,48 L64,54Z" fill="#9AA6B4"${o(1.8)}/><path d="M76,54 L78,47 L84,49 L83,54Z" fill="#9AA6B4"${o(1.8)}/>`,
  // a strategy board: three hexes, a town, the planned road as an arrow
  expert: `<g${o(2.2)}>
    <path d="M30,30 l10,-6 l10,6 v12 l-10,6 l-10,-6Z" fill="#7FB069"/>
    <path d="M50,30 l10,-6 l10,6 v12 l-10,6 l-10,-6Z" fill="#E9B949"/>
    <path d="M40,48 l10,-6 l10,6 v12 l-10,6 l-10,-6Z" fill="#C9653F"/></g>
    <circle cx="40" cy="36" r="4.2" fill="#FFFDF8"${o(1.4)}/><text x="40" y="38.4" font-size="6.4" font-weight="800" text-anchor="middle" fill="${INK}" font-family="sans-serif">6</text>
    <circle cx="60" cy="36" r="4.2" fill="#FFFDF8"${o(1.4)}/><text x="60" y="38.4" font-size="6.4" font-weight="800" text-anchor="middle" fill="#B3261E" font-family="sans-serif">8</text>
    <path d="M47,47 V42 L50,39.5 L53,42 V47Z" fill="#3C75C6"${o(1.6)}/>
    <path d="M58,62 Q72,70 78,56" fill="none" stroke="#3C75C6" stroke-width="2.6" stroke-dasharray="3.4 3" stroke-linecap="round"/>
    <path d="M73,55 L79,54 L79,60" fill="none" stroke="#3C75C6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22,62 a5,5 0 1 1 10,0 l2,10 h-14Z" fill="#5A2C88"${o(2)}/>`,
  // scales: a brick against two wheat
  trader: `<path d="M50,24 V72" fill="none"${o(3)}/><path d="M40,74 H60" fill="none"${o(3.4)}/>
    <path d="M24,34 H76" fill="none"${o(3)}/><circle cx="50" cy="22" r="4" fill="#E9B949"${o(2)}/>
    <path d="M24,34 L15,54 M24,34 L33,54 M76,34 L67,52 M76,34 L85,52" fill="none"${o(1.4)} stroke-opacity=".6"/>
    <path d="M13,54 Q24,64 35,54Z" fill="#E9DCC0"${o(2)}/><path d="M65,52 Q76,62 87,52Z" fill="#E9DCC0"${o(2)}/>
    <rect x="17" y="45" width="14" height="8" rx="1.5" fill="#C9653F"${o(1.8)}/><path d="M17,49 H31 M24,45 V49" stroke="${INK}" stroke-opacity=".4" stroke-width="1.2"/>
    <ellipse cx="72" cy="46" rx="3" ry="5" fill="#F2C94C"${o(1.5)}/><ellipse cx="80" cy="46" rx="3" ry="5" fill="#F2C94C"${o(1.5)}/>
    <path d="M38,14 l6,3 -6,3 M62,20 l-6,-3 6,-3" fill="none" stroke="#2A8556" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  // a half-built house and a hammer
  builder: `<path d="M20,74 V44 L42,26 L64,44 V74" fill="none"${o(3)}/>
    <path d="M20,74 V56 H42 V74Z" fill="#E57A3C"${o(2.4)}/><path d="M20,62 H42 M31,56 V62 M26,62 V68 M36,62 V68 M20,68 H42" stroke="${INK}" stroke-opacity=".45" stroke-width="1.3"/>
    <path d="M31,35 V56 M53,35 V74 M20,44 H64" fill="none"${o(2)} stroke-opacity=".7"/>
    <g transform="rotate(38 70 50)"><rect x="66.5" y="40" width="7" height="38" rx="2.5" fill="#C98F55"${o(2.2)}/>
    <path d="M58,32 H82 V44 H58 Q55,38 58,32Z" fill="#8D9AA8"${o(2.4)}/></g>`,
  // a fin circling a little crown on a buoy
  shark: `<path d="M12,66 Q22,60 32,66 T52,66 T72,66 T92,66" fill="none" stroke="#3C8DB5" stroke-width="3" stroke-linecap="round"/>
    <path d="M28,64 Q34,36 54,26 Q48,44 52,64Z" fill="#6E8796"${o(2.6)}/><path d="M36,62 Q40,46 50,36" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
    <circle cx="74" cy="56" r="9" fill="#D1453A"${o(2.2)}/><path d="M65,56 H83" stroke="#fff" stroke-width="3"/>
    <path d="M67,42 L69,34 L74,39 L79,34 L81,42Z" fill="#E9B949"${o(2)}/>
    <path d="M74,47 V43" stroke="${INK}" stroke-width="2"/>
    <path d="M12,74 Q22,68 32,74 T52,74 T72,74 T92,74" fill="none" stroke="#3C8DB5" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>`,
  // a star above fanned-out dotted paths ("futures") from a die
  master: `<g fill="none" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2.6 3.4">
    <path d="M50,62 Q30,50 20,30" stroke="#8D9AA8"/><path d="M50,62 Q40,44 38,22" stroke="#8D9AA8"/>
    <path d="M50,62 Q62,44 66,22" stroke="#E9B949"/><path d="M50,62 Q70,52 82,32" stroke="#8D9AA8"/></g>
    <circle cx="20" cy="30" r="3" fill="#8D9AA8"/><circle cx="38" cy="22" r="3" fill="#8D9AA8"/><circle cx="82" cy="32" r="3" fill="#8D9AA8"/>
    <path d="M66,8 L69.5,16.5 L78.5,17 L71.5,22.6 L74,31.4 L66,26.4 L58,31.4 L60.5,22.6 L53.5,17 L62.5,16.5Z" fill="#F2C94C"${o(2)}/>
    <rect x="38" y="58" width="24" height="24" rx="5" fill="#FFFDF8"${o(2.6)}/>
    <circle cx="44.5" cy="64.5" r="2.4" fill="${INK}"/><circle cx="50" cy="70" r="2.4" fill="#D1453A"/><circle cx="55.5" cy="75.5" r="2.4" fill="${INK}"/>`,
};

ART.super = (() => {
  // the Master's fan with many more branches (11, three of them bright) and two stars
  const ends = [[8, 40], [14, 26], [24, 15], [36, 9], [46, 6], [54, 6], [64, 9], [76, 15], [86, 26], [92, 40], [50, 22]];
  const hot = [4, 6, 10];
  const paths = ends.map(([x, y], i) => `<path d="M50,64 Q${((50 + x) / 2 + (x < 50 ? -4 : 4)).toFixed(0)},${((64 + y) / 2).toFixed(0)} ${x},${y}" stroke="${hot.includes(i) ? "#E9B949" : "#8D9AA8"}"/>`).join("");
  const dotsEnd = ends.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${hot.includes(i) ? 2.8 : 2.1}" fill="${hot.includes(i) ? "#E9B949" : "#8D9AA8"}"/>`).join("");
  return `<g fill="none" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="2.2 3">${paths}</g>${dotsEnd}
    <path d="M36,31 L38.6,37.4 L45.4,37.8 L40.2,42.2 L42,48.8 L36,45.2 L30,48.8 L31.8,42.2 L26.6,37.8 L33.4,37.4Z" fill="#F2C94C"${o(1.8)}/>
    <path d="M64,22 L67.4,30.4 L76.4,30.9 L69.5,36.6 L71.8,45.4 L64,40.5 L56.2,45.4 L58.5,36.6 L51.6,30.9 L60.6,30.4Z" fill="#F2C94C"${o(2)}/>
    <rect x="38" y="58" width="24" height="24" rx="5" fill="#FFFDF8"${o(2.6)}/>
    <circle cx="44.5" cy="64.5" r="2.4" fill="${INK}"/><circle cx="50" cy="70" r="2.4" fill="#D1453A"/><circle cx="55.5" cy="75.5" r="2.4" fill="${INK}"/>`;
})();

// Super Expert+: the Super Expert's fan and stars, plus a small learned "tree" badge (the boosted trees that score each future)
ART.superplus = ART.super + `<circle cx="80" cy="74" r="12" fill="#2FA39A"${o(2.4)}/>
    <path d="M80,67 V81 M73,74 H87" stroke="#FFFDF8" stroke-width="3.4" stroke-linecap="round"/>`;
// eng-130 Grandmaster: the Super Expert+ art with a third star on top and a crown band (several minds at once)
ART.grandmaster = ART.superplus + `<path d="M50,2 L53.2,10 L61.8,10.4 L55.1,15.8 L57.4,24.2 L50,19.4 L42.6,24.2 L44.9,15.8 L38.2,10.4 L46.8,10Z" fill="#F2C94C"${o(1.8)}/>
    <path d="M14,86 L20,74 L28,82 L36,72 L42,84 Z" fill="#E9B949"${o(2)}/>`;

/** The full illustration (profile card / sheet), `size` in px. */
export function profileArt(key, size = 72) {
  const body = ART[key] || ART.intermediate;
  return `<svg class="pa-art pa-${key}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${BOT_PROFILES[key]?.label || "Bot"}">${disc}${body}</svg>`;
}

// ── mini emblems (16–20 px medallions): the one key object, thick strokes ──
const MINI = {
  beginner: `<circle cx="50" cy="50" r="26" fill="#FFFDF8"${o(8)}/><path d="M50,26 L58,50 L50,74 L42,50Z" fill="#D1453A"/><path d="M50,50 L58,50 L50,74 L42,50Z" fill="#8D9AA8"/>`,
  simple: `<rect x="26" y="20" width="48" height="62" rx="6" fill="#FFFDF8"${o(7)}/><path d="M36,38 l6,6 l12,-12 M36,62 H64" fill="none" stroke="#2A8556" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  intermediate: `<path d="M50,60 L40,78 H60Z" fill="#8D9AA8"${o(6)}/><rect x="12" y="52" width="76" height="9" rx="4" fill="#C98F55"${o(6)}/><path d="M18,52 V38 L28,28 L38,38 V52Z" fill="#E57A3C"${o(6)}/><circle cx="72" cy="40" r="11" fill="#F2C94C"${o(6)}/>`,
  expert: `<path d="M18,34 l16,-10 l16,10 v20 l-16,10 l-16,-10Z" fill="#7FB069"${o(6)}/><path d="M50,34 l16,-10 l16,10 v20 l-16,10 l-16,-10Z" fill="#E9B949"${o(6)}/><path d="M40,82 V66 L50,57 L60,66 V82Z" fill="#3C75C6"${o(6)}/>`,
  trader: `<path d="M50,20 V78 M20,34 H80 M36,80 H64" fill="none"${o(8)}/><path d="M10,54 Q22,68 34,54Z M66,54 Q78,68 90,54Z" fill="#E9B949"${o(6)}/>`,
  builder: `<g transform="rotate(38 50 50)"><rect x="44" y="34" width="12" height="54" rx="4" fill="#C98F55"${o(6)}/><path d="M26,18 H74 V38 H26 Q20,28 26,18Z" fill="#8D9AA8"${o(6)}/></g>`,
  shark: `<path d="M14,70 Q32,60 50,70 T86,70" fill="none" stroke="#3C8DB5" stroke-width="8" stroke-linecap="round"/><path d="M24,66 Q32,30 66,16 Q54,42 60,66Z" fill="#6E8796"${o(7)}/>`,
  master: `<path d="M50,10 L61,36 L89,37 L67,55 L75,83 L50,67 L25,83 L33,55 L11,37 L39,36Z" fill="#F2C94C"${o(7)}/>`,
  // two stars, one behind the other
  super: `<path d="M38,6 L47,28 L70,29 L52,43 L58,66 L38,53 L18,66 L24,43 L6,29 L29,28Z" fill="#F2C94C"${o(6)}/><path d="M66,34 L75,56 L98,57 L80,71 L86,94 L66,81 L46,94 L52,71 L34,57 L57,56Z" fill="#F2C94C"${o(6)}/>`,
  // Super Expert+: the two stars and a plus disc
  // Grandmaster: three stars in a crown row
  grandmaster: `<path d="M50,4 L57,22 L76,23 L61,34 L66,53 L50,42 L34,53 L39,34 L24,23 L43,22Z" fill="#F2C94C"${o(6)}/><path d="M22,40 L28,55 L44,56 L32,65 L36,81 L22,72 L8,81 L12,65 L0,56 L16,55Z" fill="#F2C94C"${o(5)}/><path d="M78,40 L84,55 L100,56 L88,65 L92,81 L78,72 L64,81 L68,65 L56,56 L72,55Z" fill="#F2C94C"${o(5)}/><rect x="22" y="84" width="56" height="12" rx="4" fill="#2FA39A"${o(5)}/>`,
  superplus: `<path d="M38,6 L47,28 L70,29 L52,43 L58,66 L38,53 L18,66 L24,43 L6,29 L29,28Z" fill="#F2C94C"${o(6)}/><path d="M66,34 L75,56 L98,57 L80,71 L86,94 L66,81 L46,94 L52,71 L34,57 L57,56Z" fill="#F2C94C"${o(6)}/><circle cx="20" cy="80" r="17" fill="#2FA39A"${o(6)}/><path d="M20,70 V90 M10,80 H30" stroke="#FFFDF8" stroke-width="7" stroke-linecap="round"/>`,
};
export function profileMini(key, size = 18) {
  return `<svg class="pa-mini" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${MINI[key] || MINI.intermediate}</svg>`;
}

// ── level frames (variant a): strength as material, style bots by pattern; every kind differs in SHAPE too ──
// tier: plain (Beginner, Simple) · silver (Intermediate) · gold (Expert) · gold + star (Master);
// style bots: Trader dashed ring (deals) · Builder brick segments · Shark a fin on top.
export const FRAME_KIND = {
  beginner: "plain", simple: "plain", intermediate: "silver", expert: "gold", master: "star", super: "star2", superplus: "star2p", grandmaster: "star3",
  trader: "dash", builder: "brick", shark: "fin",
};
/** Frame SVG drawn around an avatar; `d` = SVG size in px (the ring sits at 44/60 of it: d ≈ 1.5 × avatar). */
export function levelFrame(key, d = 40) {
  const k = FRAME_KIND[key] || "plain";
  const R = 44, c = 50, ring = (col, w, extra = "") => `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${col}" stroke-width="${w}"${extra}/>`;
  const silver = "var(--lf-silver,#A3AFBC)", gold = "var(--lf-gold,#D9A21B)", edge = "var(--lf-edge,rgba(43,33,28,.6))";
  // the mark sits at the upper right (45°), clear of the hair, the points badge and the Rush ready dot (upper left)
  const at = (body) => `<g transform="translate(81 19) rotate(45)">${body}</g>`;
  let g = "";
  if (k === "plain") g = ring("var(--lf-plain,rgba(43,33,28,.32))", 4);
  // silver: a wide bright band split by a dark groove (two lanes) + a white shine: clearly more than the thin plain ring
  if (k === "silver") g = ring(edge, 14) + ring(silver, 11) + ring(edge, 2.6) + `<path d="M24,22 A40,40 0 0 1 50,10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-opacity=".9"/>`;
  if (k === "gold" || k === "star" || k === "star2" || k === "star2p" || k === "star3") {
    g = ring(edge, 12) + ring(gold, 9);
    g += [135, 225, 315].map((a) => `<circle cx="${(c + R * Math.cos(a * Math.PI / 180)).toFixed(1)}" cy="${(c + R * Math.sin(a * Math.PI / 180)).toFixed(1)}" r="5.4" fill="#FFF3C4" stroke="${edge}" stroke-width="1.8"/>`).join("");
  }
  if (k === "gold") g += `<circle cx="81" cy="19" r="5.4" fill="#FFF3C4" stroke="${edge}" stroke-width="1.8"/>`;
  if (k === "star") g += `<path d="M81,1 L86,13 L99,13.6 L89,22 L92.4,35 L81,27.8 L69.6,35 L73,22 L63,13.6 L76,13Z" fill="${gold}" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/>`;
  // Super Expert: the Master's ring with a second star
  if (k === "star2" || k === "star2p" || k === "star3") g += `<path d="M81,1 L86,13 L99,13.6 L89,22 L92.4,35 L81,27.8 L69.6,35 L73,22 L63,13.6 L76,13Z" fill="${gold}" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path d="M58,-6 L61,2 L69.5,2.5 L63,7.8 L65.2,16 L58,11.4 L50.8,16 L53,7.8 L46.5,2.5 L55,2Z" fill="${gold}" stroke="${edge}" stroke-width="2.2" stroke-linejoin="round"/>`;
  // Super Expert+: the Super Expert's ring and stars, plus a small teal plus disc at the lower right (45°, a free spot on the ring)
  // Grandmaster: a third star at the upper left (the Rush ready dot sits further out) and the teal disc
  if (k === "star3") g += `<path d="M19,1 L24,13 L37,13.6 L27,22 L30.4,35 L19,27.8 L7.6,35 L11,22 L1,13.6 L14,13Z" fill="${gold}" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/>`;
  if (k === "star2p" || k === "star3") g += `<circle cx="81.1" cy="81.1" r="9.5" fill="var(--lf-trader,#2FA39A)" stroke="${edge}" stroke-width="2.4"/><path d="M81.1,75.6 V86.6 M75.6,81.1 H86.6" stroke="#FFFDF8" stroke-width="3" stroke-linecap="round"/>`;
  if (k === "dash") g = ring(edge, 11, ` stroke-dasharray="15 9"`) + ring("var(--lf-trader,#2FA39A)", 8, ` stroke-dasharray="15 9"`);
  if (k === "brick") g = ring(edge, 12) + ring("var(--lf-builder,#C9653F)", 9, ` stroke-dasharray="13 3.5"`);
  // shark: a tall, sharp dorsal fin that breaks out of the ring (plus a small second fin and a wave line)
  if (k === "fin") g = ring(edge, 11) + ring("var(--lf-shark,#5D7C8E)", 8)
    + `<path d="M56,12 Q60,-12 82,-28 Q80,8 96,36 Q92,34 56,12Z" fill="var(--lf-shark,#5D7C8E)" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M66,2 Q71,-9 79,-17" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round"/>`;
  return `<svg class="lf lf-${k}" width="${d}" height="${d}" viewBox="-10 -10 120 120" aria-hidden="true">${g}</svg>`;
}

/**
 * Which preset chip to light in Settings › Bots for the bots being edited.
 * Returns { active: key | "custom" | null, closest: key | null, mixed: bool }:
 *   active  the preset every bot matches exactly (axes + policy), "custom" when they share a hand-tuned mix,
 *           null when the bots differ from each other (mixed)
 *   closest for "custom": the preset with the most matching axes (ties: the first in AI_PRESETS order)
 */
export function presetHighlight(strategies, presets, axes) {
  const list = (strategies || []).filter(Boolean);
  if (!list.length) return { active: null, closest: null, mixed: false };
  const pol = (s) => s.policy || "score";
  const exact = (s) => Object.keys(presets).find((k) => axes.every((a) => presets[k][a] === s[a]) && pol(presets[k]) === pol(s)) || "custom";
  const keys = list.map(exact);
  const same = list.every((s) => axes.every((a) => s[a] === list[0][a]) && pol(s) === pol(list[0]));
  if (!same) return { active: null, closest: null, mixed: true };
  if (keys[0] !== "custom") return { active: keys[0], closest: null, mixed: false };
  let closest = null, best = -1;
  Object.keys(presets).forEach((k) => {
    const n = axes.filter((a) => presets[k][a] === list[0][a]).length + (pol(presets[k]) === pol(list[0]) ? 0.5 : 0);
    if (n > best) { best = n; closest = k; }
  });
  return { active: "custom", closest, mixed: false };
}
