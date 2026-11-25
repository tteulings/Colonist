// v1.99 ONE localizer for the review engine's own wording on the post-game screens: move labels ("Trade Wool → 1 Grain, then Settlement on Brick 3, Lumber 6 +2 roads")
// and the "why" sentences and chips (src/review/why.js: "trade completes it (Wool)", "+3 dice dots (Ore, Wool)", "2:1 Lumber port").
// The engine writes English. Here its label grammar is PARSED into parts (action, resources with numbers, piece, spot) and written again in the UI language with the
// game vocabulary (NL: dorp, stad, weg, ontwikkelkaart, hout / baksteen / wol / graan / erts; EN: lumber / brick / wool / grain / ore).
//   - A port is never named as a cause (v1.99 scope: no port claims): a port, Longest road, Largest army, robber and steal item is DROPPED from a why line; a bank trade is
//     written with its numbers only ("gave 2 ore for 1 grain").
//   - A fragment this grammar does not know is never shown in Dutch: it is collected in `unknown` (tests/text199.js and the screen audits fail on it) and the line drops it.
// Pure functions (no DOM); the language is `lg` ("en" | "nl"), default the app's.
import { isNL } from "./i18n.js";

export const unknown = new Set();
const lang = (lg) => lg || (isNL() ? "nl" : "en");

// ── vocabulary ──
const RES = { Lumber: ["lumber", "hout"], Brick: ["brick", "baksteen"], Wool: ["wool", "wol"], Grain: ["grain", "graan"], Ore: ["ore", "erts"] };
const RX = "Lumber|Brick|Wool|Grain|Ore";
const SPOT = `(?:${RX}) \\d+(?:, (?:${RX}) \\d+)*`;
const LIST = `(?:${RX})(?:, (?:${RX}))*`;
const NAME = "[^,()·→]+?";
const DIRS = { "top right": ["top right", "rechtsboven"], "top left": ["top left", "linksboven"], "bottom right": ["bottom right", "rechtsonder"], "bottom left": ["bottom left", "linksonder"], right: ["right", "rechts"], left: ["left", "links"], top: ["top", "boven"], bottom: ["bottom", "onder"], centre: ["centre", "midden"] };
const CARDS = { Knight: ["knight", "ridder"], "Road Building": ["road building", "wegenbouw"], "Year of Plenty": ["year of plenty", "uitvinding"], Monopoly: ["monopoly", "monopolie"] };
const BUILD = { settlement: ["settlement", "dorp"], city: ["city", "stad"], road: ["road", "weg"], "development card": ["development card", "ontwikkelkaart"], Settlement: ["settlement", "dorp"], City: ["city", "stad"] };

function kit(lg, youWord) {
  const nl = lg === "nl", p = (en, n) => (nl ? n : en);
  const res = (r) => RES[r][nl ? 1 : 0];
  const res1 = (s) => s.split(", ").map(res).join(", ");
  const spot = (s) => s.split(", ").map((x) => { const [r, n] = x.split(" "); return `${nl ? res(r) : r} ${n}`; }).join(", "); // EN: "Wool 8" as the screens show a tile; NL: "wol 8"
  const you = youWord || (nl ? "jij" : "you");
  const nm = (x) => (x === "You" ? you : x);
  const cnt = (n, en1, enN, nl1, nlN) => `${n} ${+n === 1 ? p(en1, nl1) : p(enN, nlN)}`;
  const dots = (n) => cnt(n, "dot", "dots", "stip", "stippen");
  const cards = (n) => cnt(n, "card", "cards", "kaart", "kaarten");
  const roads = (n) => cnt(n, "road", "roads", "weg", "wegen");
  const turns = (x) => (x === "now" ? p("now", "nu") : x.replace(/^~(\d+) turns?$/, (m, n) => `~${cnt(n, "turn", "turns", "beurt", "beurten")}`));
  return { nl, p, res, res1, spot, you, nm, cnt, dots, cards, roads, turns };
}
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// ── move labels ──
const MONEY = `(?:\\d+ )?(?:${RX})`;
const parseSide = (s) => s.split(" + ").map((x) => { const m = new RegExp(`^(?:(\\d+) )?(${RX})$`).exec(x); return m ? [m[1] ? +m[1] : null, m[2]] : null; });
const ok = (a) => a.length && a.every(Boolean);
/** "Trade Wool → 1 Grain, then Dev card": the engine's label as parts, or null when the grammar does not know it */
export function parseLabel(label) {
  let l = String(label || "").replace(/\s+/g, " ").trim(), trade = null, m;
  if ((m = new RegExp(`^Trade (.+?) → (.+?), then (.+)$`).exec(l))) { const give = parseSide(m[1]), get = parseSide(m[2]); if (!ok(give) || !ok(get)) return null; trade = { give, get }; l = m[3]; }
  let act = null;
  if (l === "End turn") act = { k: "end" };
  else if (l === "End turn (saves its cards)") act = { k: "end", saves: true };
  else if (l === "Dev card" || l === "Development card") act = { k: "dev" };
  else if ((m = /^Play (Knight|Road Building|Year of Plenty|Monopoly)$/.exec(l))) act = { k: "play", card: m[1] };
  else if (l === "Longest road") act = { k: "road", lr: true };
  else if (l === "Road (Longest road)") act = { k: "road", lr: true };
  else if (l === "Road") act = { k: "road" };
  else if (l === "Road toward coast") act = { k: "road", coast: true };
  else if ((m = new RegExp(`^Road toward (${SPOT})$`).exec(l))) act = { k: "road", spot: m[1] };
  else if ((m = new RegExp(`^Road (${SPOT}) – (${SPOT})$`).exec(l))) act = { k: "road", from: m[1], spot: m[2] };
  else if ((m = new RegExp(`^Settlement on (${SPOT})(?: \\+(\\d+) roads?)?$`).exec(l))) act = { k: "settle", spot: m[1], more: m[2] ? +m[2] : 0 };
  else if ((m = new RegExp(`^City on (${SPOT})$`).exec(l))) act = { k: "city", spot: m[1] };
  else if ((m = new RegExp(`^Robber on (${SPOT})(?:, (top right|top left|bottom right|bottom left|right|left|top|bottom|centre))?$`).exec(l))) act = { k: "robber", spot: m[1], dir: m[2] || null };
  else if ((m = /^Bank trade (.+?) → (.+)$/.exec(l))) { const give = parseSide(m[1]), get = parseSide(m[2]); if (!ok(give) || !ok(get)) return null; act = { k: "bank", give, get }; }
  if (!act) return null;
  return { trade, ...act };
}
const side = (K, a) => a.map(([n, r]) => `${n ? n + " " : ""}${K.res(r)}`).join(" + ");
/** the move in words. full: "Trade wool for 1 grain, then settlement Brick 3, Lumber 6 (+2 roads)"; terse (rows): "trade → settlement Brick 3, Lumber 6". */
function render(P, lg, terse) {
  const K = kit(lg), { p, nl } = K;
  const bank = () => (P.give.every(([n]) => n) ? p(`Gave ${side(K, P.give)} for ${side(K, P.get)}`, `${side(K, P.give)} geruild voor ${side(K, P.get)}`) : p(`Traded ${side(K, P.give)} for ${side(K, P.get)}`, `${side(K, P.give)} geruild voor ${side(K, P.get)}`));
  let main;
  switch (P.k) {
    case "end": main = P.saves && !terse ? p("End turn, keeping the cards", "Beurt beëindigen, kaarten bewaren") : p("End turn", "Beurt beëindigen"); break;
    case "dev": main = p("Dev card", "Ontwikkelkaart"); break;
    case "play": main = terse ? cap1(CARDS[P.card][nl ? 1 : 0]) : `${p("Play", "Speel")} ${CARDS[P.card][nl ? 1 : 0]}`; break;
    case "road": main = P.lr ? p("Road", "Weg") : P.coast ? p("Road toward the coast", "Weg naar de kust") : P.from ? `${p("Road", "Weg")} ${K.spot(P.from)} – ${K.spot(P.spot)}` : P.spot ? `${p("Road", "Weg")} ${K.spot(P.spot)}` : p("Road", "Weg"); break;
    case "settle": main = `${p("Settlement", "Dorp")} ${K.spot(P.spot)}${P.more && !terse ? ` (+${K.roads(P.more)})` : ""}`; break;
    case "city": main = `${p("City", "Stad")} ${K.spot(P.spot)}`; break;
    case "robber": main = `${p("Robber", "Rover")} ${K.spot(P.spot)}${P.dir ? `, ${DIRS[P.dir][nl ? 1 : 0]}` : ""}`; break;
    case "bank": main = terse ? p(`Trade ${side(K, P.give)} for ${side(K, P.get)}`, `Ruil ${side(K, P.give)} voor ${side(K, P.get)}`) : bank(); break;
    default: main = "";
  }
  if (!P.trade) return terse && P.k !== "end" && P.k !== "dev" && P.k !== "play" ? main : main;
  if (terse) return `${p("Trade", "Ruil")} → ${low1(main)}`;
  return `${p(`Trade ${side(K, P.trade.give)} for ${side(K, P.trade.get)}, then ${low1(main)}`, `Ruil ${side(K, P.trade.give)} voor ${side(K, P.trade.get)}, daarna ${low1(main)}`)}`;
}
/** the move as a sentence part ("Settlement Brick 3, Lumber 6 (+2 roads)"); null (and recorded) when the label is not in the grammar */
export function moveFull(label, lg) {
  lg = lang(lg); const P = parseLabel(label); if (!P) { if (label) unknown.add(`label: ${label}`); return null; }
  return cap1(render(P, lg, false));
}
/** the move in a row ("Trade → settlement Brick 3, Lumber 6"); a bank trade keeps its numbers */
export function moveTerse(label, lg) {
  lg = lang(lg); const P = parseLabel(label); if (!P) { if (label) unknown.add(`label: ${label}`); return null; }
  return cap1(render(P, lg, true));
}
/** a start spot / tile list ("Lumber 3, Wool 5, Grain 6") in the language */
export function spotText(s, lg) {
  lg = lang(lg); const t = String(s || "");
  if (!new RegExp(`^${SPOT}$`).test(t)) { if (t) unknown.add(`spot: ${t}`); return null; }
  return kit(lg).spot(t);
}

// ── why sentences and chips ──
// each rule: [regex on the engine's item (case-insensitive), (match, kit) => string | null]; null = dropped on purpose (out of v1.99 scope), nothing = not matched
const DROP = null;
const nres = (n) => n;
const reach = (inner, K) => {
  const parts = inner.split(", ").map((x) => x.trim()); const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    let x = parts[i]; let m;
    if (x === "this road") out.push(K.p("this road", "deze weg"));
    else if ((m = /^(\d+) roads?$/.exec(x))) out.push(K.roads(m[1]));
    else if ((m = /^(\d+) dice dots?$/.exec(x))) out.push(K.dots(m[1]));
    else if (x === "nothing new") out.push(K.p("nothing new", "niets nieuws"));
    else if (/^adds /.test(x)) { const l = [x.slice(5)]; while (i + 1 < parts.length) { l.push(parts[i + 1]); i += 1; } const lst = l.join(", "); if (!new RegExp(`^${LIST}$`).test(lst)) return undefined; out.push(K.p(`adds ${K.res1(lst)}`, `voegt ${K.res1(lst)} toe`)); }
    else return undefined;
  }
  return out.join(", ");
};
const RULES = [
  // ports (v1.99: no port claims) and everything out of scope
  [new RegExp(`^\\d:1 (?:(?:${RX}) )?port$`), () => DROP],
  [/^(?:takes )?Longest road\b/i, () => DROP], [/^Largest army\b/i, () => DROP], [/^takes Largest army\b/i, () => DROP], [/^Army race$/i, () => DROP],
  [/^hits the leader$/i, () => DROP], [/^steal /i, () => DROP], [/^Frees your /i, () => DROP], [/^kept the Knight$/i, () => DROP],
  [new RegExp(`^(?:${SPOT})(?:, (?:top right|top left|bottom right|bottom left|right|left|top|bottom|centre))?: (?:hits only you|nobody on it)`), () => DROP],
  [new RegExp(`^(?:${SPOT})(?:, [a-z ]+)?: ${NAME} \\(\\d+ points?(?:, leader)?\\)`), () => DROP],
  // trades and builds
  [new RegExp(`^(?:The )?trade completes it \\((${LIST})\\)$`, "i"), (m, K) => K.p(`trade completes it (${K.res1(m[1])})`, `ruil maakt het af (${K.res1(m[1])})`)],
  [/^trade completes it$/i, (m, K) => K.p("trade completes it", "ruil maakt het af")],
  [new RegExp(`^(?:The )?trade completes (?:a|an) (development card|settlement|road|city) \\((${LIST}) (?:was|were) missing\\)$`, "i"), (m, K) => K.nl ? `ruil maakt een ${BUILD[m[1].toLowerCase()][1]} af (mist: ${K.res1(m[2])})` : `trade completes a ${m[1].toLowerCase()} (missing: ${K.res1(m[2])})`],
  [/^makes a (card|settlement|road|city)$/i, (m, K) => K.nl ? `levert een ${m[1].toLowerCase() === "card" ? "ontwikkelkaart" : BUILD[m[1].toLowerCase()][1]} op` : `makes a ${m[1] === "card" ? "development card" : m[1].toLowerCase()}`],
  [new RegExp(`^→ (${LIST})$`), (m, K) => `→ ${K.res1(m[1])}`],
  [new RegExp(`^\\+(${LIST})$`), (m, K) => `+${K.res1(m[1])}`],
  [/^(\d+) more roads?, then settle$/i, (m, K) => K.nl ? `nog ${K.roads(m[1])}, dan een dorp` : `${K.roads(m[1])} more, then settle`],
  [/^then settle there$/i, (m, K) => K.p("then settle there", "daarna hier een dorp")],
  [new RegExp(`^(?:road )?reaches (${SPOT}|coast) \\((.+)\\)$`, "i"), (m, K, s) => { const r = reach(m[2], K); if (r === undefined) return undefined; const road = /^road /i.test(s); const where = m[1] === "coast" ? K.p("the coast", "de kust") : K.spot(m[1]); return K.nl ? `${road ? "weg " : ""}bereikt ${where} (${r})` : `${road ? "road " : ""}reaches ${where} (${r})`; }],
  [new RegExp(`^adds (${LIST}) you lack$`, "i"), (m, K) => K.p(`adds ${K.res1(m[1])} you lack`, `voegt toe wat je mist: ${K.res1(m[1])}`)],
  [new RegExp(`^adds (${LIST})$`, "i"), (m, K) => K.p(`adds ${K.res1(m[1])}`, `voegt ${K.res1(m[1])} toe`)],
  [new RegExp(`^new:? (${LIST})$`, "i"), (m, K) => K.p(`new: ${K.res1(m[1])}`, `nieuw: ${K.res1(m[1])}`)],
  [new RegExp(`^blocks (${NAME}) from (${SPOT})$`, "i"), (m, K) => K.p(`blocks ${K.nm(m[1])} from ${K.spot(m[2])}`, `blokkeert ${K.nm(m[1])} bij ${K.spot(m[2])}`)],
  [new RegExp(`^blocks (${NAME})$`, "i"), (m, K) => K.p(`blocks ${K.nm(m[1])}`, `blokkeert ${K.nm(m[1])}`)],
  [new RegExp(`^takes (${NAME})'s spot (${SPOT})$`, "i"), (m, K) => K.p(`takes ${K.nm(m[1])}'s spot ${K.spot(m[2])}`, `pakt de plek van ${K.nm(m[1])} af: ${K.spot(m[2])}`)],
  [/^income (\d+) → (\d+) dice dots$/i, (m, K) => K.p(`income ${m[1]} → ${m[2]} dots`, `inkomen ${m[1]} → ${m[2]} stippen`)],
  [new RegExp(`^doubles (\\d+) dice dots(?: \\((${LIST})\\))?$`, "i"), (m, K) => K.nl ? `verdubbelt ${K.dots(m[1])}${m[2] ? ` (${K.res1(m[2])})` : ""}` : `doubles ${K.dots(m[1])}${m[2] ? ` (${K.res1(m[2])})` : ""}`],
  [new RegExp(`^([+−-]?)(\\d+) dice dots?(?: \\((${LIST})\\))?$`, "i"), (m, K) => `${m[1]}${K.dots(m[2])}${m[3] ? ` (${K.res1(m[3])})` : ""}`],
  [/^(\d+) dice dots vs (\d+)$/i, (m, K) => K.p(`${K.dots(m[1])} vs ${m[2]}`, `${K.dots(m[1])} tegen ${m[2]}`)],
  [/^(\d+) resources? vs (\d+)$/i, (m, K) => K.p(`${m[1]} resources vs ${m[2]}`, `${m[1]} grondstoffen tegen ${m[2]}`)],
  [/^(\d+) spots to grow$/i, (m, K) => K.p(`${m[1]} spots to grow`, `${m[1]} plekken om te groeien`)],
  [/^room for (\d+) more spots$/i, (m, K) => K.p(`room for ${m[1]} more spots`, `ruimte voor nog ${m[1]} plekken`)],
  [new RegExp(`^(${SPOT}): (\\d+) dice dots?(?: \\((\\d+) (fewer|more)\\))?, (\\d+) resources?(?:, \\d:1(?: (?:${RX}))? port)?(?:, room (\\d+))?$`, "i"), (m, K) => { const a = [K.spot(m[1]) + ":", K.dots(m[2]) + (m[3] ? ` (${m[3]} ${K.p(m[4], m[4] === "fewer" ? "minder" : "meer")})` : ""), K.nl ? `${m[5]} ${+m[5] === 1 ? "grondstof" : "grondstoffen"}` : `${m[5]} resource${+m[5] === 1 ? "" : "s"}`]; if (m[6] != null) a.push(K.p(`room ${m[6]}`, `ruimte ${m[6]}`)); return a.slice(0, 1).concat(a.slice(1).join(", ")).join(" "); }],
  [new RegExp(`^settlement (${SPOT}): \\+(\\d+) dice dots, (nothing new|new (${LIST}))$`, "i"), (m, K) => K.nl ? `dorp ${K.spot(m[1])}: +${K.dots(m[2])}, ${m[4] ? `nieuw: ${K.res1(m[4])}` : "niets nieuws"}` : `settlement ${K.spot(m[1])}: +${K.dots(m[2])}, ${m[4] ? `new ${K.res1(m[4])}` : "nothing new"}`],
  [new RegExp(`^city (${SPOT}): doubles (\\d+) dice dots$`, "i"), (m, K) => K.nl ? `stad ${K.spot(m[1])}: verdubbelt ${K.dots(m[2])}` : `city ${K.spot(m[1])}: doubles ${K.dots(m[2])}`],
  [/^(?:road )?dead end: no free spot within (\d+) roads$/i, (m, K, s) => K.nl ? `${/^road/i.test(s) ? "weg " : ""}doodlopend: geen vrije plek binnen ${m[1]} wegen` : `${/^road/i.test(s) ? "road " : ""}dead end: no free spot within ${m[1]} roads`],
  // ending the turn, saving, trading with the bank
  [/^ended turn with (\d+) cards? unused$/i, (m, K) => K.nl ? `beurt beëindigd met ${K.cards(m[1])} ongebruikt` : `ended turn with ${K.cards(m[1])} unused`],
  [/^a 7 takes (\d+)$/i, (m, K) => K.nl ? `een 7 kost je ${K.cards(m[1])}` : `a 7 would cost you ${K.cards(m[1])}`],
  [new RegExp(`^puts (${LIST}) to use before a 7$`, "i"), (m, K) => K.p(`puts ${K.res1(m[1])} to use before a 7`, `gebruikt ${K.res1(m[1])} voor er een 7 komt`)],
  [new RegExp(`^(${LIST}) \\+ (${LIST}) for (roads|cities)$`, "i"), (m, K) => K.nl ? `${K.res1(m[1])} + ${K.res1(m[2])} voor ${m[3] === "roads" ? "wegen" : "steden"}` : `${K.res1(m[1])} + ${K.res1(m[2])} for ${m[3]}`],
  [new RegExp(`^cards: (${RX}) \\+ (${RX}) \\+ (${RX})$`, "i"), (m, K) => K.p(`cards: ${K.res(m[1])} + ${K.res(m[2])} + ${K.res(m[3])}`, `kaarten: ${K.res(m[1])} + ${K.res(m[2])} + ${K.res(m[3])}`)],
  [/^a development card instead$/i, (m, K) => K.p("a development card instead", "in plaats daarvan een ontwikkelkaart")],
  [new RegExp(`^bank trade (${LIST}) → (${LIST}), builds nothing$`, "i"), (m, K) => K.p(`bank trade ${K.res1(m[1])} → ${K.res1(m[2])}, builds nothing`, `bankruil ${K.res1(m[1])} → ${K.res1(m[2])}, bouwt niets`)],
  [new RegExp(`^(?:road|the card) uses (${LIST}) that (?:the )?(Settlement|City|development card) needs → (now|~\\d+ turns?)$`, "i"), (m, K, s) => K.nl ? `${/^road/i.test(s) ? "weg" : "de kaart"} gebruikt ${K.res1(m[1])} die ${/^s/i.test(m[2]) ? "het dorp" : /^c/i.test(m[2]) ? "de stad" : "de ontwikkelkaart"} nodig heeft → ${K.turns(m[3])}` : `${/^road/i.test(s) ? "road" : "the card"} uses ${K.res1(m[1])} that the ${m[2].toLowerCase()} needs → ${K.turns(m[3])}`],
  [/^keeps (?:a )?(Settlement|City|development card) affordable$/i, (m, K) => K.nl ? `houdt ${m[1].toLowerCase() === "settlement" ? "een dorp" : m[1].toLowerCase() === "city" ? "een stad" : "een ontwikkelkaart"} betaalbaar` : `keeps a ${m[1].toLowerCase()} affordable`],
  [/^keeps (?:a )?(Settlement|City|development card) in reach \((\d+) cards? short, (now|~\d+ turns?)\)$/i, (m, K) => K.nl ? `houdt ${m[1].toLowerCase() === "settlement" ? "een dorp" : m[1].toLowerCase() === "city" ? "een stad" : "een ontwikkelkaart"} binnen bereik (${K.p("", `${m[2]} ${+m[2] === 1 ? "kaart" : "kaarten"} tekort`)}, ${K.turns(m[3])})` : `keeps a ${m[1].toLowerCase()} in reach (${m[2]} card${+m[2] === 1 ? "" : "s"} short, ${K.turns(m[3])})`],
  [/^affordable now$/i, (m, K) => K.p("affordable now", "nu betaalbaar")],
  [/^(\d+) cards? short$/i, (m, K) => K.nl ? `${m[1]} ${+m[1] === 1 ? "kaart" : "kaarten"} tekort` : `${m[1]} card${+m[1] === 1 ? "" : "s"} short`],
  [/^(now|~\d+ turns?) vs (now|~\d+ turns?)$/i, (m, K) => K.p(`${K.turns(m[1])} vs ${K.turns(m[2])}`, `${K.turns(m[1])} tegen ${K.turns(m[2])}`)],
];
void nres;
/** one item of a why line / one chip: { t } the text, { drop: true } on purpose, { unknown: true } not in the grammar */
export function whyItem(item, lg, youWord) {
  lg = lang(lg); const K = kit(lg, youWord), s = String(item || "").replace(/\s+/g, " ").trim(); if (!s) return { drop: true };
  for (const [re, fn] of RULES) {
    const m = re.exec(s); if (!m) continue;
    const out = fn(m, K, s); if (out === DROP) return { drop: true }; if (out === undefined) continue;
    return { t: out };
  }
  unknown.add(`why: ${s}`); return { unknown: true };
}
/** the engine's why line ("a · b · c") in the language: kept items joined " · ", first letter capital; null when nothing is left */
export function whyLine(text, lg, youWord, lower = false) {
  const items = String(text || "").split(" · ").map((x) => whyItem(x, lg, youWord)).filter((x) => x.t);
  if (!items.length) return null;
  const t = items.map((x) => x.t).join(" · ");
  return lower ? (/^\p{Lu}\p{Ll}+ \d/u.test(t) ? t : low1(t)) : cap1(t); // a spot ("Lumber 6, …") keeps its capital
}
/** the chips (at most `max`): the dropped and unknown ones leave a gap that the next chip fills */
export function whyChips(chips, lg, max = 3, youWord) {
  return (Array.isArray(chips) ? chips : []).map((c) => whyItem(c, lg, youWord)).filter((x) => x.t).slice(0, max).map((x) => x.t);
}
