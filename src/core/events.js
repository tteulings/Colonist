// Architecture step 5: the game's events. One emitter; everything that used to be sprinkled through the rule methods (addLog text, sfx, fx, the
// placement animations, the public card tracker, the stats and review recorders) is a *subscriber* of it.
//
//   const bus = createEmitter();
//   bus.on("log", (ev) => ...);   // named: bus.off("log") removes it ("headless" = no presentation subscribers)
//   bus.emit({ type: "built", seat: 2, piece: "city", at: 17, how: "paid" });   // gets .seq, runs every subscriber synchronously, in the order they were added
//
// Events are plain JSON (seat ids, hex / node / edge ids, resource keys), so a stream can be stored, replayed and diffed. The text of the log is
// made from an event in exactly one place: eventToText(event, lang, game). The log keeps ENGLISH sentences (saved games, the ticker and the
// avatars parse them); a non-English `lang` translates the finished sentence with the app's own tr().
//
// ── Catalogue ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//  Facts (what happened)
//   gameStarted  {sea, rush, winPoints}
//   rushStarted  {interval}
//   placed       {seat, piece:"road"|"settlement"|"city", at}        a piece appears on the board (every path, also simulations): animation
//   built        {seat, piece:"road"|"ship"|"settlement"|"city", at, how:"setup"|"free"|"paid", remaining?, i?, log?:false, sfx?:false}
//   unbuilt      {seat, piece, at}                                   Undo took a piece back (its refund is a `received`)
//   turnEnded    {seat, turn}                                        (no log line)
//   shipMoved    {seat, from?, to?}
//   islandReached{seat, island}                                      Seafarers: +2 for a new island
//   rolled       {seat, turn, total, d1, d2}  |  {rush:true, rollNo, total, d1, d2}
//   produced     {seat, gain:{res:n}}                                one per player paid on a roll
//   payout       {roll, gains:[{res:n} per seat]}                    the whole roll's payout (the cards fly, the toasts)
//   bankShort    {res}                                               the bank cannot pay a resource: nobody gets it
//   paid         {seat, cost:{res:n}}                                cards went to the bank (builds, discards, bank trade ...)
//   received     {seat, cards:{res:n}}                               cards came from the bank / were refunded
//   discarded    {seat, n, reason?}
//   robberMoved  {seat, hex, pirate:bool}
//   noVictim     {seat}
//   stole        {seat, victim, res}                                 (res is the omniscient truth; hot-seat text hides it)
//   bankTraded   {seat, give, get, rate}
//   traded       {seat, partner, gave:{..}, got:{..}, style:"human"|"ai"|"api"|"incoming"|"rush"}   a player-to-player swap
//   offered      {seat, to?, give, want, style:"hotseat"|"rush"|"api"}
//   tradeAnswered{answer:"allRejected"|"counter"|"counterDeclined"|"expired"|"void"|"rejected", seat?, from?}
//   devBought    {seat, card, human}
//   devPlayed    {seat, card, interactive?, gained?:[res], res?, collected?, built?}
//   award        {award:"longestRoad"|"largestArmy", seat|null, prev|null}
//   won          {seat, points}  |  turnLimit {seat}
//   goldBankEmpty {seat} · goldStruck {seat, n} · goldTaken {seat, got:{res:n}}
//   buildWindow  {per:[{seat, road?, settlement?, city?, card?}]}    5-6 players: the Special Building Phase summary
//  Notices (the game talks to the player; no rule changed)
//   note         {key, ...}   see NOTES / the switch below
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

import { RESOURCES } from "./constants.js";
import { RES_EN as RESOURCE_LABEL } from "../resources.js";
import { tr } from "../i18n.js";

/** Create the emitter. `record`: keep every event (tests, replays); otherwise nothing is stored. */
export function createEmitter() {
  const subs = [];
  const muted = new Set(); // non-empty while a planner's probe runs: emit() reaches only the card tracker, records nothing (nothing is shown, heard, counted or kept)
  const bus = {
    muted,
    mute(name) { muted.add(name); return bus; },
    unmuteAll(prev = null) { muted.clear(); if (prev) prev.forEach((n) => muted.add(n)); return bus; },
    seq: 0,
    record: null,
    on(name, fn) { const i = subs.findIndex((s) => s.name === name); if (i >= 0) subs[i].fn = fn; else subs.push({ name, fn }); return bus; },
    off(name) { const i = subs.findIndex((s) => s.name === name); if (i >= 0) subs.splice(i, 1); return bus; },
    has(name) { return subs.some((s) => s.name === name); },
    names() { return subs.map((s) => s.name); },
    emit(ev) {
      ev.seq = ++bus.seq;
      const probing = muted.size > 0;
      if (bus.record && !probing) bus.record.push(ev); // a probe's imagined events are not the game's history
      for (let i = 0; i < subs.length; i += 1) if (!probing || subs[i].name === "trk") subs[i].fn(ev); // during a probe only the card tracker (the bots' own knowledge) hears it
      return ev;
    },
  };
  return bus;
}

const NOTES = {
  initialPlacementDone: "Initial placement complete.",
  placeSettlement: "Place your settlement on the board.",
  placeRoad: "Now place a road from your settlement.",
  tooSlow: "Too slow — that spot was just taken.",
  spotTaken: "That spot was just taken.",
  moveRobberSea: "Move the robber (land) or the pirate (sea).",
  moveRobber: "Move the robber — tap a tile.",
  deckEmpty: "Development deck is empty.",
  robberTimeUp: "Time's up — the robber was placed for you.",
  sessionRestored: "Session restored.",
};

const label = (r) => RESOURCE_LABEL[r];
const resourceString = (h) => {
  const parts = RESOURCES.filter((r) => h[r] > 0).map((r) => `${h[r]} ${RESOURCE_LABEL[r]}`);
  return parts.length ? parts.join(", ") : "nothing";
};
const plusList = (list) => RESOURCES.filter((r) => list.includes(r)).map((r) => `+${list.filter((x) => x === r).length} ${RESOURCE_LABEL[r]}`).join(" ") || "nothing";
const ARTICLE = { road: "a road", ship: "a ship", settlement: "a settlement", city: "a city" };

/**
 * The English log sentence of an event, or null when the event has no line. `g` supplies the names of the seats and the table's grammar
 * (g.players, g._you(p), g._s(p), g._hexLabel(hex), g.sea). With `lang` other than "en" the sentence is passed through the app's translator.
 */
export function eventToText(ev, lang, g) {
  const t = englishText(ev, g);
  if (t == null) return null;
  return lang && lang !== "en" ? tr(t) : t;
}

function englishText(ev, g) {
  const P = (id) => g.players[id];
  const name = (id) => g.players[id].name;
  const s = (id) => g._s(g.players[id]);
  switch (ev.type) {
    case "gameStarted":
      return ev.sea ? `New ${ev.rush ? "Rush" : "Classic"} Seafarers game: Heading for New Shores, first to ${ev.winPoints} points.`
        : `New ${ev.rush ? "Rush" : "Classic"} game: first to ${ev.winPoints} points.`;
    case "rushStarted": return `Rush! Build any time — dice roll every ${ev.interval}s.`;
    case "note": {
      if (NOTES[ev.key]) return NOTES[ev.key];
      switch (ev.key) {
        case "cannotAfford": return `${name(ev.seat)} cannot afford a development card.`;
        case "aiDebug": return `[${name(ev.seat)}] ${ev.msg}`;
        case "discardTimeUp": return `Time's up — ${ev.count} card${ev.count === 1 ? "" : "s"} handed back automatically.`;
        default: return null;
      }
    }
    case "built": {
      if (ev.log === false) return null;
      const n = name(ev.seat);
      if (ev.how === "setup") return `${n} placed a ${ev.piece}.`;
      if (ev.how === "free") return `${n} placed a free ${ev.piece} (${ev.remaining} remaining).`;
      return ev.piece === "city" ? `${n} upgraded to a city.` : `${n} built ${ARTICLE[ev.piece]}.`;
    }
    case "shipMoved": return `${name(ev.seat)} moved a ship.`;
    case "islandReached": return `${name(ev.seat)} reached ${ev.island}: +2 points for a new island.`;
    case "rolled": return ev.rush ? `Roll #${ev.rollNo}: rolled ${ev.total}.` : `Turn ${ev.turn}: ${name(ev.seat)} rolled ${ev.total}.`;
    case "produced": return `${name(ev.seat)} collect${s(ev.seat)} ${resourceString(ev.gain)}.`;
    case "bankShort": return `Bank is short of ${label(ev.res)} — no one receives it.`;
    case "discarded": return `${name(ev.seat)} discard${s(ev.seat)} ${ev.n} cards${ev.reason ? ` after ${ev.reason}` : ""}.`;
    case "robberMoved": return ev.pirate ? `${name(ev.seat)} moved the pirate.` : `${name(ev.seat)} moved robber to ${g._hexLabel(g.geometry.hexes[ev.hex])}.`;
    case "noVictim": return "No one to steal from.";
    case "stole": return g.hotseat ? `${name(ev.seat)} stole a card from ${name(ev.victim)}.` : `${name(ev.seat)} stole 1 ${label(ev.res)} from ${name(ev.victim)}.`;
    case "bankTraded": return `${name(ev.seat)} traded ${ev.rate} ${label(ev.give)} for 1 ${label(ev.get)}.`;
    case "traded": {
      const a = name(ev.seat), b = name(ev.partner);
      switch (ev.style) {
        case "human": return `Traded with ${b}: gave ${resourceString(ev.gave)} for ${resourceString(ev.got)}.`;
        case "ai": case "api": return `${a} traded ${resourceString(ev.gave)} with ${b} for ${resourceString(ev.got)}.`;
        case "incoming": return g._you(P(ev.seat)) ? `You accepted ${b}'s trade: got ${resourceString(ev.got)} for ${resourceString(ev.gave)}.`
          : `${a} traded with ${b}: got ${resourceString(ev.got)} for ${resourceString(ev.gave)}.`;
        case "rush": return `You traded with ${b}: got ${resourceString(ev.got)} for ${resourceString(ev.gave)}.`;
        default: return null;
      }
    }
    case "offered": {
      if (ev.style === "hotseat") return `${name(ev.seat)} offers ${name(ev.to)} a trade.`;
      if (ev.style === "rush") return `${name(ev.seat)} offers you ${resourceString(ev.give)} for ${resourceString(ev.want)}.`;
      const raw = (h) => RESOURCES.filter((r) => h[r]).map((r) => `${h[r]} ${r}`).join(", ");
      return `${name(ev.seat)} offers ${raw(ev.give)} for ${raw(ev.want)}.`;
    }
    case "tradeAnswered":
      switch (ev.answer) {
        case "allRejected": return "All players rejected your trade offer.";
        case "counter": return `${name(ev.seat)} made a counter-offer.`;
        case "counterDeclined": return `You declined ${name(ev.seat)}'s counter-offer.`;
        case "expired": return `${name(ev.from)}'s offer expired.`;
        case "void": return `Trade with ${name(ev.from)} is no longer possible.`;
        case "rejected": return g._you(P(ev.seat)) ? `You rejected ${name(ev.from)}'s trade offer.` : `${name(ev.seat)} declined ${name(ev.from)}'s offer.`;
        default: return null;
      }
    case "devBought": {
      const p = P(ev.seat);
      if (!ev.human) return `${p.name} bought a development card.`;
      if (ev.card === "victoryPoint") return g._you(p) ? "You drew a Victory Point card (kept secret)." : `${p.name} bought a development card.`;
      const labels = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly" };
      return g._you(p) ? `You drew: ${labels[ev.card]}!` : `${p.name} bought a development card.`;
    }
    case "devPlayed": {
      const n = name(ev.seat);
      switch (ev.card) {
        case "knight": return `${n} played Knight.`;
        case "roadBuilding": return ev.interactive ? `${n} played Road Building — place 2 free ${g.sea ? "roads or ships" : "roads"}.`
          : `${n} played Road Building and placed ${ev.built} ${g.sea ? "piece" : "road"}(s).`;
        case "yearOfPlenty": return `${n} played Year of Plenty: ${plusList(ev.gained)}.`;
        case "monopoly": return `${n} played Monopoly: +${ev.collected} ${label(ev.res)}.`;
        default: return null;
      }
    }
    case "award": {
      const road = ev.award === "longestRoad";
      const nm = road ? (g.sea ? "Longest route" : "Longest road") : "Largest army";
      if (ev.seat != null) {
        const p = P(ev.seat);
        return `${p.name} ${g._you(p) ? "take" : "takes"} ${nm} (+2${ev.prev != null ? ` from ${name(ev.prev)}` : ""}).`;
      }
      if (ev.prev != null) {
        const p = P(ev.prev);
        return `${p.name} ${g._you(p) ? "lose" : "loses"} ${nm}${road ? ` (now ${p.longestRoadLength})` : ""} · nobody holds it.`;
      }
      return null;
    }
    case "won": return `${name(ev.seat)} win${s(ev.seat)} with ${ev.points} points!`;
    case "turnLimit": return `Turn limit reached. ${name(ev.seat)} win${s(ev.seat)} by points.`;
    case "goldBankEmpty": return `The bank has no cards left for ${name(ev.seat)}'s gold.`;
    case "goldStruck": return `${name(ev.seat)} strike${s(ev.seat)} gold: pick ${ev.n} resource${ev.n > 1 ? "s" : ""}.`;
    case "goldTaken": return `${name(ev.seat)} took ${resourceString(ev.got)} from the gold field.`;
    case "buildWindow": {
      const say = (c) => {
        const parts = [];
        if (c.road) parts.push(`built ${c.road === 1 ? "a road" : `${c.road} roads`}`);
        if (c.settlement) parts.push(`built ${c.settlement === 1 ? "a settlement" : `${c.settlement} settlements`}`);
        if (c.city) parts.push(c.city === 1 ? "upgraded to a city" : `built ${c.city} cities`);
        if (c.card) parts.push(`bought ${c.card === 1 ? "a card" : `${c.card} cards`}`);
        return parts.join(" and ");
      };
      return `Build window: ${ev.per.map((c) => `${name(c.seat)} ${say(c)}`).join(", ")}.`;
    }
    default: return null; // placed, paid, received, turnEnded ...: facts without a line in the log
  }
}

export { resourceString as eventResourceString };
