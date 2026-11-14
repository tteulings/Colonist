// v1.62 AI recap: the facts of a finished game, as compact JSON for the recap Function (azure/recap-fn). Everything comes from
// what the review screens already know (no new analysis); a part the review does not have (no luck run, a bot not checked, an
// old review without "aims") is left out, never guessed. The Function writes the story from these facts only.
import { totals, decide } from "./evaluate.js";

export const FACTS_MAX = 12000; // aim for a normal game; the Function accepts 40000
const AIM = { s: "settlements", c: "cities", lr: "Longest road", la: "Largest army", dv: "VP cards", is: "new islands" };
const unesc = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const pc = (v, d = 0) => (v == null || !isFinite(v) ? null : Math.round(v * 100 * 10 ** d) / 10 ** d);
const clip = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const clean = (o) => { Object.keys(o).forEach((k) => { const v = o[k]; if (v == null || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) delete o[k]; }); return o; };

const aimTxt = (a) => (a?.src?.length ? a.src.map(([k, v]) => `${AIM[k] || k} ${v}%`).join(", ") : null);

/** The facts for the person whose review is open (g._rvPid). Returns { obj, json } or null when there is nothing to tell. */
export function recapFacts(g, { max = FACTS_MAX } = {}) {
  const pid = g._rvPid, players = g.players;
  if (!g.winner || pid == null || !players?.[pid]) return null;
  const rv = g._rvOf?.(pid);
  if (!rv?.results?.length) return null;
  const nm = (q) => (g._rvIsYou(q) ? "You" : unesc(players[q]?.name || `Player ${q + 1}`));
  const n = players.length, st = g._st, TW = g._rvTW?.() || "Turn";
  const res = rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i);
  const ds = g._rvDecisions(res);
  const when = (d) => (d.k === "setup" ? "Setup" : `${TW} ${d.t}`);

  // who, what they scored, how well they played
  const accOf = {}, costOf = {};
  players.forEach((p) => {
    const r = g._rvOf(p.id);
    if (!r?.results?.length) return;
    const s = tryv(() => g._rvSeat(p.id));
    if (s?.done && s.sum?.acc != null) accOf[p.id] = s.sum.acc;
    if (s?.done) costOf[p.id] = tryv(() => totals(decide(r.results.filter((x) => !x.skip || x.skip === "trivial"), n, p.id)).moves);
  });
  const ranked = [g.winner, ...players.filter((q) => q !== g.winner).sort((a, b) => b.victoryPoints - a.victoryPoints)];
  const L = tryv(() => g._lkState());
  const luckOk = L && !L.na && L.done && L.cover >= 0.9;
  const lk = (q) => {
    if (!luckOk) return null;
    const list = tryv(() => g._lkList(q).filter((x) => x.own), []);
    const by = { dice: 0, steal: 0, dev: 0 };
    list.forEach((x) => { by[x.ev.kind] = (by[x.ev.kind] || 0) + x.w; });
    const seat = tryv(() => g._lkSeat(q), 0);
    return clean({ total: pc(L.tot[q], 1), dice: pc(by.dice, 1), steals: pc(by.steal, 1), devCards: pc(by.dev, 1), seatOrder: pc(seat, 1) });
  };
  const sources = st?.sources || [];
  const when_ = players.map(() => ({ settlements: [], cities: [] }));
  if (st?.stepEvents) for (let k = 1; k <= (st.N || 0); k++) (st.stepEvents[k] || []).forEach((e) => { if (e[1] === "b" && when_[e[2]]) { if (e[3] === "s") when_[e[2]].settlements.push(st.turnOf?.[k]); else if (e[3] === "c") when_[e[2]].cities.push(st.turnOf?.[k]); } });
  const awardsOf = (q) => (st?.awards || []).filter((a) => a.pid === q).map((a) => `${a.kind === "L" ? "Longest road" : "Largest army"} on turn ${st.turnOf?.[a.s] ?? "?"}`);
  const table = players.map((p) => {
    const dl = st?.dl?.[p.id];
    const lv = p.isHuman ? null : tryv(() => g._rvLevel(p)?.label);
    return clean({
      name: nm(p.id), level: lv, seat: p.id + 1, points: p.victoryPoints, place: ranked.indexOf(p) + 1, winner: p === g.winner || undefined,
      builtOnTurns: clean({ settlementsAfterSetup: when_[p.id].settlements, cities: when_[p.id].cities, awards: awardsOf(p.id) }),
      pointsFrom: sources[p.id] ? clean({ settlements: sources[p.id].settlements, cities: sources[p.id].cities, longestRoad: sources[p.id].road, largestArmy: sources[p.id].army, vpCards: sources[p.id].cards, islands: sources[p.id].islands }) : null,
      accuracyPct: accOf[p.id], winChanceLostByMovesPct: costOf[p.id] != null ? Math.abs(costOf[p.id]) : null,
      luckInWinChancePoints: lk(p.id),
      resourceCards: dl ? { got: dl.got, expected: Math.round(dl.exp) } : null,
      built: st?.built?.[p.id] ? clean({ roads: st.built[p.id].road, settlements: st.built[p.id].settlement, cities: st.built[p.id].city, ships: st.built[p.id].ship }) : null,
    });
  });

  // win chance of the reviewed player, one point per turn (the last decision of the turn), and the table at a few moments
  const perTurn = [];
  ds.forEach((d) => { if (d.win == null) return; const t = d.k === "setup" ? 0 : d.t; if (perTurn.length && perTurn[perTurn.length - 1][0] === t) perTurn[perTurn.length - 1][1] = pc(d.win); else perTurn.push([t, pc(d.win)]); });
  const all = ds.filter((d) => d.seats), mv = all.filter((d) => d.k !== "setup");
  const lastSetup = all.filter((d) => d.k === "setup").pop();
  const phases = [["after set-up", lastSetup], ["about 1/3 through", mv[Math.round((mv.length - 1) / 3)]], ["about 2/3 through", mv[Math.round(((mv.length - 1) * 2) / 3)]], ["end", mv[mv.length - 1]]].filter(([, d]) => d);
  const seatPct = (d) => { const sum = d.seats.reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(players.map((p) => [nm(p.id), Math.round((d.seats[p.id] / sum) * 100)])); };
  const tableAt = phases.map(([l, d]) => ({ phase: l, at: when(d), winChancePct: seatPct(d) }));

  // key moments: the person's own costly moves and the biggest swings from dice and the others (as the Overview lists them)
  const imp = g._rvImp(ds);
  const mine = imp.slice(0, 5).map((d) => ({ d, m: d.gap * 100, type: "own move" }));
  const swings = ds.filter((d, k) => d.k !== "setup" && Math.abs(d.cp) >= 3 && !(k && (ds[k - 1].x.s ?? 0) === (d.x.s ?? 0))).sort((a, b) => Math.abs(b.cp) - Math.abs(a.cp)).slice(0, 4).map((d) => ({ d, m: Math.abs(d.chance) * 100, type: "dice and others" }));
  const picked = [...mine, ...swings].sort((a, b) => b.m - a.m).slice(0, 6).sort((a, b) => a.d.i - b.d.i);
  const moveCard = (d, own = true) => { const x = d.x; return clean({
    played: clip(x.label, 90), better: x.best && !d.same ? clip(x.best.label, 90) : null,
    winIfPlayedPct: d.B, winIfBetterPct: d.A, movePointsLost: own ? Math.round(d.gap * 1000) / 10 : null, rating: d.cls,
    likelyReason: x.why?.head ? clip(x.why.head, 140) : null,
    betterAimsAt: aimTxt(x.aim?.A), playedAimsAt: aimTxt(x.aim?.B),
    usuallyNextAfterBetter: x.aim?.A?.nx ? clip(x.aim.A.nx[0], 60) : null,
    simpleChoice: x.simple ? (x.simple.is === "A" ? "the better move" : x.simple.is === "B" ? "what was played" : clip(x.simple.label, 80)) : null,
  }); };
  const moments = picked.map(({ d, type }) => {
    const x = d.x, k = ds.indexOf(d), prev = ds[k - 1];
    const what = d.x.s > 0 ? tryv(() => g._rvStepWhat(d.x.s)) : null;
    const cards = what?.cards ? Object.fromEntries(Object.entries(what.cards).map(([q, c]) => [nm(+q), c])) : null;
    const rolled = what?.roll ? { total: what.roll, by: what.actor != null ? nm(what.actor) : undefined } : null;
    const lines = what?.lines?.length ? what.lines.map((l) => clip(unesc(l).replace(/<[^>]+>/g, ""), 110)).slice(0, 4) : null;
    const own = type === "own move";
    return clean({
      when: when(d), type,
      winChanceBeforePct: prev ? pc(prev.win) : null, winChanceAfterPct: pc(d.win), winChangePoints: Math.round(d.cp),
      moveCard: own || (x.best && !d.same) ? moveCard(d, own) : null,
      winChangeByPlayerPoints: prev?.seats && d.seats ? Object.fromEntries(players.map((p) => [nm(p.id), Math.round((d.seats[p.id] / (d.seats.reduce((u, v) => u + v, 0) || 1) - prev.seats[p.id] / (prev.seats.reduce((u, v) => u + v, 0) || 1)) * 100)]).filter(([, v]) => v)) : null,
      dice: rolled, cardsFromRoll: cards, thatTurn: lines,
    });
  });

  // best and costliest decisions of the person
  const costliest = imp.slice(0, 3).map((d) => clean({ when: when(d), winChanceAfterPct: pc(d.win), ...moveCard(d, true) }));
  const bestMoves = ds.filter((d) => ["best", "great"].includes(d.cls) && d.x.spread != null).sort((a, b) => b.x.spread - a.x.spread).slice(0, 3)
    .map((d) => clean({ when: when(d), winChanceAfterPct: pc(d.win), ...moveCard(d, false), aheadOfNextBestPoints: d.x.lead != null ? Math.round(d.x.lead * 1000) / 10 : undefined, stakePoints: Math.round(d.x.spread * 1000) / 10 }));

  // dice
  const dice = st?.dice ? { rolls: st.rolls, histogram: st.dice, sevens: st.dice[7] || 0, sevensExpected: Math.round((st.rolls / 6) * 10) / 10 } : null;
  const tot = tryv(() => g._rvTotals(ds));
  const book = luckOk ? tryv(() => g._lkBook(pid)) : null;
  const w = g.winner;
  const facts = clean({
    game: { mode: g.isRush?.() ? "Rush" : "Classic", board: g.sea ? "Seafarers" : "Island", players: n, pointsToWin: g.winPoints || 10, [`${TW.toLowerCase()}s`]: g.turn, winner: nm(w.id), reviewedPlayer: nm(pid), reviewedPlace: ranked.indexOf(players[pid]) + 1 },
    players: table,
    reviewedPlayerSummary: clean({
      name: nm(pid), accuracyPct: accOf[pid], movesThatMattered: tryv(() => g._rvSeat(pid).sum.n), winChanceLostByMovesPoints: tot?.moves != null ? Math.abs(tot.moves) : null,
      startingWinChancePct: book ? pc(book.start) : null, finalWinChancePct: pc(ds.length ? ds[ds.length - 1].win : null),
      luckWinChancePoints: book ? pc(book.luck, 1) : null, moveCostWinChancePoints: book?.moves != null ? pc(book.moves, 1) : null,
    }),
    winChanceByTurn: perTurn.length > 1 ? perTurn : null, tableWinChanceAt: tableAt,
    keyMoments: moments, costliestDecisions: costliest, bestDecisions: bestMoves, dice,
    leadChanges: st?.leadChanges, awards: st?.awards?.length ? st.awards.map((a) => ({ when: `${TW} ${st.turnOf?.[a.s] ?? ""}`.trim(), award: a.kind === "L" ? "Longest road" : "Largest army", to: nm(a.pid) })) : null,
    notes: [luckOk ? null : "No luck analysis for this game.", rv && !tryv(() => g._rvReviewComplete(pid)) ? "The review was not finished; numbers are provisional." : null].filter(Boolean),
  });
  let json = JSON.stringify(facts);
  // too long: drop the lines of play, then the smaller parts, until it fits
  const trim = [(f) => f.keyMoments?.forEach((m) => delete m.thatTurn), (f) => { f.keyMoments = f.keyMoments?.slice(0, 5); }, (f) => delete f.tableWinChanceAt, (f) => delete f.winChanceByTurn, (f) => { f.keyMoments = f.keyMoments?.slice(0, 3); }];
  for (const t of trim) { if (json.length <= max) break; t(facts); json = JSON.stringify(facts); }
  return { obj: facts, json };
}
