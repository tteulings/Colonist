// v1.86.2 THE SURPRISE of a decisive swing: why a win chance moved so suddenly. Classified by the app from the event log of that turn (never by a model):
//   card   a development card drawn from the deck was a point card (hidden from the table until it counts)
//   combo  several point sources in one turn (builds, an award, a card)
//   award  Longest road / Largest army changed hands
//   build  one settlement or city
//   robber a seven (robber, discards, a steal)      steal  a card taken from a player      dice  a roll that paid (or did not pay) the seat
//   trade  a trade between players                  devcard  another development card played or drawn
// Honest numbers only: points gained and from what, the points before (what the table could see and what was hidden), the exact odds of the
// card that was drawn (point cards left in the deck over cards left), and what the win chance model could and could not know.
// Pure: reads the hand log (ai-strat.js), the step events (g._st) and the cause finder (ai-cause.js); no DOM.
import { handLog, ptsByTurn } from "./ai-strat.js";
import { swingCause } from "./ai-cause.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
export const SX_KINDS = ["card", "combo", "award", "build", "robber", "steal", "dice", "trade", "devcard"];
const VP_CARDS = 5;

/** The surprise of the decisive swing D = { seat, t, from, to, d } (fx.decisive), or null when there is nothing honest to say.
 *  ser = the win chance series (ai-facts.js aiSeries, its .src says what the model could see). */
export function aiSurprise(g, ser, D, log = tryv(() => handLog(g))) {
  const st = g._st; if (!D || !log || !st?.stepEvents || !ser?.by?.size) return null;
  const n = g.players.length, t = D.t, T = log.T, W = g.winner ? g.winner.id : null, target = g.winPoints || 10;
  const final = W != null && t >= T;
  // what every seat gained in this turn: the points are the game's own record (ptsByTurn), WHAT they came from is read from the event log (s c v from builds and
  // cards, L A from the awards); a point card counts from the turn after it was bought, a Seafarers island bonus is not an event: the difference is named, never dropped
  const pbs = g.players.map((_, q) => ptsByTurn(log, q)), gain = pbs.map((pb) => (pb[t] ?? 0) - (pb[Math.max(0, t - 1)] ?? 0));
  const evBy = (q) => { const o = { s: 0, c: 0, v: 0, L: 0, A: 0, I: 0 }; (log.pts[q] || []).filter((e) => e.t === t).forEach((e) => { o[e.k] = (o[e.k] || 0) + e.n; }); return o; };
  let mover = null;
  if (final) mover = W;
  else if (D.d > 0 && gain[D.seat] > 0) mover = D.seat;
  else { let b = 0; gain.forEach((v, q) => { if (v > gain[b]) b = q; }); if (gain[b] > 0 && (D.d <= 0 || b !== D.seat)) mover = b; }
  const out = { turn: t, seat: D.seat, from: D.from, to: D.to, d: D.d, final, target, mover: null, kind: null, gain: 0, by: null, items: 0, before: null, after: null, public: null, hidden: 0, need: null, odds: null, roll: null, actor: null, victim: null, part: null, prev: null, award: null, sees: ser.src === "luck" || ser.src === "ledger" ? "held" : "none", wcMover: null };
  let b = null, kinds = [];
  if (mover != null && gain[mover] > 0) {
    b = evBy(mover); kinds = ["s", "c", "v", "L", "A", "I"].filter((k) => b[k] > 0);
    let rest = gain[mover] - (b.s + b.c + b.v + b.L + b.A + b.I), lag = 0;
    if (rest > 0) { const lagCards = (log.pts[mover] || []).filter((e) => e.k === "v" && e.t === t - 1).reduce((a, e) => a + e.n, 0), l = Math.min(rest, Math.max(0, lagCards)); b.v += l; lag = l; rest -= l; if (rest > 0 && g.sea) { b.I += rest; rest = 0; } }
    else if (rest < 0 && b.v > 0) b.v -= Math.min(-rest, b.v);
    kinds = ["s", "c", "v", "L", "A", "I"].filter((k) => b[k] > 0);
    if (kinds.length) {
      const pb = pbs[mover], before = pb[Math.max(0, t - 1)], after = pb[t];
      const hidden = Math.max(0, Math.min(before, (log.pts[mover] || []).filter((e) => e.k === "v" && e.t < t).reduce((a, e) => a + e.n, 0) - lag));
      const items = b.s + b.c + b.v + b.I + (b.L > 0 ? 1 : 0) + (b.A > 0 ? 1 : 0);
      out.mover = mover; out.gain = gain[mover]; out.by = b; out.items = items; out.before = before; out.after = after; out.hidden = hidden; out.public = before - hidden; out.need = Math.max(0, target - before);
      out.kind = items >= 2 || kinds[0] === "I" ? "combo" : kinds[0] === "v" ? "card" : kinds[0] === "L" || kinds[0] === "A" ? "award" : "build";
      out.sole = kinds.length === 1 ? kinds[0] : null;
      if (b.L > 0 || b.A > 0) { const a = (st.awards || []).filter((x) => x.pid === mover && st.turnOf?.[x.s] === t && x.kind === (b.L > 0 ? "L" : "A")).pop(); if (a) { out.award = a.kind; out.prev = a.prev >= 0 ? a.prev : null; } }
      // the odds of the point card drawn: point cards left in the deck over cards left, at the moment of that draw
      if (b.v > 0) {
        let bought = 0, vpOut = 0, odds = null;
        for (let k = 0; k <= (st.N || 0) && odds == null; k++) for (const e of st.stepEvents[k] || []) {
          if (e[1] !== "v") continue;
          const tk = st.turnOf?.[k] ?? 0;
          if (e[2] === mover && e[3] === "victoryPoint" && tk === t) { const total = g.bigBoard ? 34 : 25, left = total - bought; if (left > 0) odds = { pct: Math.round(((VP_CARDS - vpOut) / left) * 100), vp: VP_CARDS - vpOut, left, step: k }; break; }
          bought++; if (e[3] === "victoryPoint") vpOut++;
        }
        out.odds = odds;
      }
      out.wcMover = ser.by.size ? { from: Math.round(((ser.by.get(t - 1) || ser.by.get(0) || [])[mover] ?? NaN) * 100), to: Math.round(((ser.by.get(t) || [])[mover] ?? NaN) * 100) } : null;
      if (out.wcMover && !(Number.isFinite(out.wcMover.from) && Number.isFinite(out.wcMover.to))) out.wcMover = null;
    }
  }
  if (out.mover == null) {
    // no points moved: the roll, a steal, a card or an action of that turn, as the cause finder names it (the same numbers as the turn view)
    const c = tryv(() => swingCause(g, t, D.seat));
    if (!c) {
      let trade = false; for (let k = 0; k <= (st.N || 0); k++) if ((st.turnOf?.[k] ?? 0) === t) (st.stepEvents[k] || []).forEach((e) => { if (e[1] === "x" && (e[2] === D.seat || e[3] === D.seat)) trade = true; });
      if (!trade) return null;
      out.kind = "trade"; out.actor = D.seat;
    } else {
      out.actor = c.actor; out.part = c.delta;
      out.kind = c.kind === "dice" ? (c.data.roll === 7 ? "robber" : "dice") : c.kind === "steal" ? "steal" : c.kind === "dev" || c.kind === "play" ? "devcard" : "build";
      if (c.kind === "dice") out.roll = c.data.roll; if (c.kind === "steal") out.victim = c.data.victim;
      if (out.kind === "build") out.kind = "devcard"; // a build with no point gained (a road, say) moved the odds as an action of that turn
    }
  }
  // what the win chance could know: the luck run and the step ledger (v1.90) both value the REAL recorded position (every hand as it was, only the deck is reshuffled) (the dev deck reshuffled), so a point card already HELD counts, the next draw does not; only the moves-only estimate ("moves") cannot see it
  out.seen = out.hidden > 0 || out.kind === "card" ? out.sees : null; // "held" (the series replays every hand) | "none" (estimated from the moves alone)
  return out;
}

/** Words (EN / NL). Parts for the page (no digits in a string, numbers only through refs sx.*) are built by the recipe; the plain sentence is for chat and the composer. */
export const SX_LANG = {
  en: {
    award: { L: "Longest road", A: "Largest army" }, item: { s: "a settlement", c: "a city", v: "a point card", I: "a new island" },
    cap: "Points before and after", legendSeen: "Shown at the table", legendHid: "Hidden point card", legendNew: "Gained", legendNeed: "Still needed", final: "The last turn ends the game: 100% and 0% are outcomes.",
    seen: "The win chance counts point cards already held, not the next draw.", unseen: "This win chance came from the moves alone and could not see held point cards.",
    hid: (m, pub, h) => `${m} showed ${pub} points at the table; ${h === 1 ? "one was a hidden point card" : `${h} were hidden point cards`}.`,
    sentence: (x, nm) => {
      const m = x.mover != null ? nm(x.mover) : "", w = (k) => ({ s: x.by?.s > 1 ? `${x.by.s} settlements` : "a settlement", c: x.by?.c > 1 ? `${x.by.c} cities` : "a city", v: x.by?.v > 1 ? `${x.by.v} point cards` : "a point card", I: "a new island", L: "Longest road", A: "Largest army" }[k]);
      const list = () => ["s", "c", "v", "I", "L", "A"].filter((k) => x.by?.[k] > 0).map(w).join(", ").replace(/, ([^,]*)$/, " and $1");
      switch (x.kind) {
        case "card": return x.final ? `${m} needed ${x.need} ${x.need === 1 ? "point" : "points"} and bought a point card from the deck${x.odds ? `, a ${x.odds.pct}% draw` : ""}.` : `${m} bought a point card from the deck${x.odds ? `, a ${x.odds.pct}% draw` : ""}, and went from ${x.before} to ${x.after} points.`;
        case "combo": return `${m} made ${x.gain} points in one turn: ${list()}.`;
        case "award": return `${m} took ${SX_LANG.en.award[x.award] || list()}, worth 2 points${x.prev != null ? ` from ${nm(x.prev)}` : ""}.`;
        case "build": return `${m} built ${x.sole === "c" ? "a city" : "a settlement"} and went from ${x.before} to ${x.after} points.`;
        case "robber": return `${nm(x.actor)} rolled a seven: the robber, the discards and a steal moved the odds.`;
        case "steal": return `${nm(x.actor)} stole a card from ${nm(x.victim)}, and that card moved the odds.`;
        case "dice": return `${nm(x.actor)} rolled ${x.roll}, and the roll alone moved the odds.`;
        case "trade": return "A trade between players moved the odds.";
        case "devcard": return `${nm(x.actor)} played or drew a development card, and it moved the odds.`;
        default: return "";
      }
    },
  },
  nl: {
    award: { L: "Langste handelsroute", A: "Grootste riddermacht" }, item: { s: "een dorp", c: "een stad", v: "een puntenkaart", I: "een nieuw eiland" },
    cap: "Punten voor en na", legendSeen: "Zichtbaar aan tafel", legendHid: "Verborgen puntenkaart", legendNew: "Erbij", legendNeed: "Nog nodig", final: "De laatste beurt beëindigt het spel: 100% en 0% zijn uitkomsten.",
    seen: "De winkans telt puntenkaarten die al vastgehouden worden, niet de volgende trekking.", unseen: "Deze winkans kwam alleen uit de zetten en zag vastgehouden puntenkaarten niet.",
    hid: (m, pub, h) => `${m} liet ${pub} punten zien aan tafel; ${h === 1 ? "één was een verborgen puntenkaart" : `${h} waren verborgen puntenkaarten`}.`,
    sentence: (x, nm) => {
      const m = x.mover != null ? nm(x.mover) : "", w = (k) => ({ s: x.by?.s > 1 ? `${x.by.s} dorpen` : "een dorp", c: x.by?.c > 1 ? `${x.by.c} steden` : "een stad", v: x.by?.v > 1 ? `${x.by.v} puntenkaarten` : "een puntenkaart", I: "een nieuw eiland", L: "Langste handelsroute", A: "Grootste riddermacht" }[k]);
      const list = () => ["s", "c", "v", "I", "L", "A"].filter((k) => x.by?.[k] > 0).map(w).join(", ").replace(/, ([^,]*)$/, " en $1");
      switch (x.kind) {
        case "card": return x.final ? `${m} had ${x.need} ${x.need === 1 ? "punt" : "punten"} nodig en kocht een puntenkaart van de stapel${x.odds ? `, een kans van ${x.odds.pct}%` : ""}.` : `${m} kocht een puntenkaart van de stapel${x.odds ? `, een kans van ${x.odds.pct}%` : ""}, en ging van ${x.before} naar ${x.after} punten.`;
        case "combo": return `${m} haalde ${x.gain} punten in één beurt: ${list()}.`;
        case "award": return `${m} pakte ${SX_LANG.nl.award[x.award] || list()}, goed voor 2 punten${x.prev != null ? ` van ${nm(x.prev)}` : ""}.`;
        case "build": return `${m} bouwde ${x.sole === "c" ? "een stad" : "een dorp"} en ging van ${x.before} naar ${x.after} punten.`;
        case "robber": return `${nm(x.actor)} gooide een zeven: de rover, het afleggen en een gepakte kaart verschoven de kansen.`;
        case "steal": return `${nm(x.actor)} pakte een kaart van ${nm(x.victim)}, en die kaart verschoof de kansen.`;
        case "dice": return `${nm(x.actor)} gooide ${x.roll}, en alleen die worp verschoof de kansen.`;
        case "trade": return "Een ruil tussen spelers verschoof de kansen.";
        case "devcard": return `${nm(x.actor)} speelde of trok een ontwikkelingskaart, en die verschoof de kansen.`;
        default: return "";
      }
    },
  },
};

/** The surprise as plain facts for chat, the composer and the tools (words in `lang`; every number is the app's). nm: seat -> name. */
export function surpriseFact(x, nm, lang = "en") {
  if (!x) return null;
  const L = SX_LANG[lang] || SX_LANG.en;
  return {
    note: "why the decisive swing was so sudden, classified by the app from the event log of that turn; quote it, do not re-explain it",
    turn: x.turn, kind: x.kind, final: x.final, sentence: L.sentence(x, nm),
    ...(x.mover != null ? { player: nm(x.mover), pointsGained: x.gain, pointsBefore: x.before, pointsAfter: x.after, shownAtTheTable: x.public, hiddenPointCards: x.hidden, pointsStillNeeded: x.need,
      gainedFrom: Object.fromEntries(Object.entries(x.by).filter(([, v]) => v > 0).map(([k, v]) => [{ s: "settlements", c: "cities", v: "pointCards", I: "newIslands", L: "longestRoad", A: "largestArmy" }[k], v])) } : {}),
    ...(x.odds ? { drawOddsPct: x.odds.pct, pointCardsLeftInDeck: x.odds.vp, cardsLeftInDeck: x.odds.left } : {}),
    ...(x.hidden > 0 ? { hiddenAtTheTable: L.hid(nm(x.mover), x.public, x.hidden) } : {}),
    ...(x.seen ? { winChanceCouldSee: x.seen === "held" ? L.seen : L.unseen } : {}),
    ...(x.final ? { lastTurnNote: L.final } : {}),
    winChancePct: { player: nm(x.seat), from: x.from, to: x.to },
  };
}

/** The short line of the game card as page parts (strings without digits, numbers only through refs sx.*). P(k) = a player part, R(ref, fmt) = a ref part. null when the kind says nothing. */
export function sxParts(x, lang, P, R, key) {
  if (!x) return null;
  const en = lang !== "nl", m = x.mover != null ? key(x.mover) : null, a = x.actor != null ? key(x.actor) : null, L = SX_LANG[en ? "en" : "nl"];
  const one = (k) => (x.by?.[k] > 1 ? [R(`sx.by.${k}`), en ? (k === "s" ? " settlements" : k === "c" ? " cities" : " point cards") : (k === "s" ? " dorpen" : k === "c" ? " steden" : " puntenkaarten")] : [L.item[k]]);
  const list = () => { const ks = ["s", "c", "v", "I", "L", "A"].filter((k) => x.by?.[k] > 0), out = []; ks.forEach((k, i) => { out.push(i === 0 ? "" : i === ks.length - 1 ? (en ? " and " : " en ") : ", "); out.push(...(k === "L" || k === "A" ? [L.award[k]] : k === "I" ? [L.item.I] : one(k))); }); return out.filter((p) => p !== ""); };
  switch (x.kind) {
    case "card": return x.final ? (en ? [P(m), " needed ", R("sx.need"), x.need === 1 ? " point and bought a point card from the deck" : " points and bought a point card from the deck", ...(x.odds ? [", a ", R("sx.odds", "pct"), " draw."] : ["."])]
      : [P(m), " had ", R("sx.need"), x.need === 1 ? " punt nodig en kocht een puntenkaart van de stapel" : " punten nodig en kocht een puntenkaart van de stapel", ...(x.odds ? [", een kans van ", R("sx.odds", "pct"), "."] : ["."])])
      : (en ? [P(m), " bought a point card from the deck", ...(x.odds ? [", a ", R("sx.odds", "pct"), " draw,"] : [","]), " and went from ", R("sx.before"), " to ", R("sx.after"), " points."]
        : [P(m), " kocht een puntenkaart van de stapel", ...(x.odds ? [", een kans van ", R("sx.odds", "pct"), ","] : [","]), " en ging van ", R("sx.before"), " naar ", R("sx.after"), " punten."]);
    case "combo": return en ? [P(m), " made ", R("sx.gain"), " points in one turn: ", ...list(), "."] : [P(m), " haalde ", R("sx.gain"), " punten in één beurt: ", ...list(), "."];
    case "award": return en ? [P(m), " took ", L.award[x.award], ", worth ", R("sx.gain"), " points", ...(x.prev != null ? [" from ", P(key(x.prev))] : []), "."] : [P(m), " pakte ", L.award[x.award], ", goed voor ", R("sx.gain"), " punten", ...(x.prev != null ? [" van ", P(key(x.prev))] : []), "."];
    case "build": return en ? [P(m), x.sole === "c" ? " built a city and went from " : " built a settlement and went from ", R("sx.before"), " to ", R("sx.after"), " points."] : [P(m), x.sole === "c" ? " bouwde een stad en ging van " : " bouwde een dorp en ging van ", R("sx.before"), " naar ", R("sx.after"), " punten."];
    case "robber": return en ? [P(a), " rolled a seven: the robber, the discards and a steal moved the odds."] : [P(a), " gooide een zeven: de rover, het afleggen en een gepakte kaart verschoven de kansen."];
    case "steal": return en ? [P(a), " stole a card from ", P(key(x.victim)), ", and that card moved the odds."] : [P(a), " pakte een kaart van ", P(key(x.victim)), ", en die kaart verschoof de kansen."];
    case "dice": return en ? [P(a), " rolled ", R("sx.roll"), ", and the roll alone moved the odds."] : [P(a), " gooide ", R("sx.roll"), ", en alleen die worp verschoof de kansen."];
    case "trade": return en ? ["A trade between players moved the odds."] : ["Een ruil tussen spelers verschoof de kansen."];
    case "devcard": return en ? [P(a), " played or drew a development card, and it moved the odds."] : [P(a), " speelde of trok een ontwikkelingskaart, en die verschoof de kansen."];
    default: return null;
  }
}
