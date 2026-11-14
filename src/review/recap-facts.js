// v1.62 AI recap: the facts of a finished game, as compact JSON for the recap Function (azure/recap-fn). Everything comes from
// what the review screens already know (no new analysis); a part the review does not have (no luck run, a bot not checked, an
// old review without "aims") is left out, never guessed. The Function writes the story from these facts only.
import { totals, decide } from "./evaluate.js";
import { luckKey } from "../review-luck.js";

export const FACTS_MAX = 12000; // aim for a normal game; the Function accepts 40000
const AIM = { s: "settlements", c: "cities", lr: "Longest road", la: "Largest army", dv: "VP cards", is: "new islands" };
const unesc = (s) => String(s ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const pc = (v, d = 0) => (v == null || !isFinite(v) ? null : Math.round(v * 100 * 10 ** d) / 10 ** d);
const clip = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const clean = (o) => { Object.keys(o).forEach((k) => { const v = o[k]; if (v == null || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) delete o[k]; }); return o; };

/** |luck| >= 3x|moves| -> luck, the reverse -> play, else both (decided by the numbers; the Function checks it again). */
export const verdict = (luck, moves) => { const L = Math.abs(luck ?? NaN), M = Math.abs(moves ?? NaN); if (!isFinite(L) || !isFinite(M)) return null; return L >= 3 * M ? "luck" : M >= 3 * L ? "play" : "both"; };
const DEVN = { knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "a Victory Point card" };

/** Every step (one player's roll-and-play) with its win chances before/after for all seats, from the luck run. Returns the best
 *  candidates (one per turn, biggest swing first, at most 8) and the ending (the winner's last turn). */
function turningSteps(g, nm, { luckOk, pid, n }) {
  const st = g._st, none = { cands: [], ending: null };
  if (!luckOk || !st?.steps?.length) return none;
  const L = g._lkStore(), evs = g._lkEvents(), b = new Map();
  evs.forEach((ev) => { const r = L.res[luckKey(ev)]; if (ev.kind === "dice" && r?.b) b.set(ev.s, r.b); });
  const N = Math.min(st.N, st.steps.length), w = g.winner.id;
  const fin = Array.from({ length: n }, (_, q) => (q === w ? 1 : 0));
  const win = (k) => (k <= 0 ? (L.res["seat:0:-1"]?.v || b.get(0)) : k >= N ? fin : b.get(k));
  const by = {}; // luck events per step: dice of step k are ev.s = k-1; steals and card draws carry the step they follow
  evs.forEach((ev) => { const r = L.res[luckKey(ev)]; if (!r?.l || ev.kind === "seat") return; const k = ev.kind === "dice" ? ev.s + 1 : ev.s; (by[k] ||= []).push({ ev, l: r.l }); });
  const luckTxt = (ev) => {
    if (ev.kind === "dice") return `rolled ${ev.roll}`;
    if (ev.kind === "steal") return `${nm(ev.thief)} stole a card from ${nm(ev.victim)}`;
    if (ev.kind === "dev") return `${nm(ev.pid)} bought a development card and drew ${DEVN[ev.card] || "a card"}`;
    return "";
  };
  const one = (k) => {
    const pre = win(k - 1), post = win(k), stp = st.steps[k - 1];
    if (!pre || !post || !stp) return null;
    const actor = stp[1] >= 0 ? stp[1] : pid, what = tryv(() => g._rvStepWhat(k), null);
    const youPre = pre[pid], youPost = post[pid], plPre = pre[actor], plPost = post[actor];
    const luck = (by[k] || []).filter((x) => Math.abs(x.l[pid]) >= 0.01 || Math.abs(x.l[actor]) >= 0.01).sort((a, c) => Math.max(Math.abs(c.l[pid]), Math.abs(c.l[actor])) - Math.max(Math.abs(a.l[pid]), Math.abs(a.l[actor]))).slice(0, 3)
      .map((x) => clean({ event: luckTxt(x.ev), youPoints: Math.round(x.l[pid] * 100), playerPoints: actor === pid ? undefined : Math.round(x.l[actor] * 100) }));
    const drew = (by[k] || []).filter((x) => x.ev.kind === "dev").map((x) => `${nm(x.ev.pid)} bought a development card: ${x.ev.card === "victoryPoint" ? "it was a Victory Point card" : `it was ${DEVN[x.ev.card] || "a card"}`}`);
    const lines = what?.lines?.length ? what.lines.map((l) => clip(unesc(l).replace(/<[^>]+>/g, ""), 100)).slice(0, 4) : [];
    const cards = what?.cards ? Object.fromEntries(Object.entries(what.cards).map(([q, c]) => [nm(+q), c])) : null;
    const score = Math.max(...pre.map((v, q) => Math.abs(post[q] - v)));
    const fact = clean({
      turn: st.turnOf[k], player: nm(actor), did: clean({ roll: what?.roll, cardsFromRoll: cards, play: lines, development: drew }),
      winChancePct: clean({ [nm(pid)]: [pc(youPre), pc(youPost)], ...(actor !== pid ? { [nm(actor)]: [pc(plPre), pc(plPost)] } : {}) }),
      luckEvents: luck,
    });
    return { k, score, fact, actor, youSwing: Math.abs(youPost - youPre) };
  };
  const all = [];
  for (let k = 1; k <= N; k++) { const c = one(k); if (c) all.push(c); }
  const bestPerTurn = new Map();
  all.forEach((c) => { const T = c.fact.turn, o = bestPerTurn.get(T); if (!o || c.score > o.score) bestPerTurn.set(T, c); });
  const cands = [...bestPerTurn.values()].filter((c) => c.score >= 0.04).sort((a, c) => c.score - a.score).slice(0, 8).sort((a, c) => a.k - c.k);
  // the ending: the winner's last turn (their steps in the final turn) and the swing it made
  const lastT = st.turnOf[N], mine = all.filter((c) => c.fact.turn === lastT && c.actor === w);
  const e = mine.length ? mine[mine.length - 1] : null;
  const ending = e ? clean({ ...e.fact, note: "the winner's last turn; the game ended here", swingPoints: Object.fromEntries(Object.entries(e.fact.winChancePct || {}).map(([q, v]) => [q, Math.round(v[1] - v[0])])) }) : null;
  return { cands, ending };
}

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

  // turning points: the biggest win-chance swings of ANY player's turn (dice, steals, card draws, builds), not only the person's own
  // decisions. A step is one player's roll-and-play; its win chances come from the luck run (the chance before each roll).
  const steps = turningSteps(g, nm, { luckOk, pid, n });
  const turning = steps.cands.map((c) => c.fact);
  const ending = steps.ending;
  const imp = g._rvImp(ds);
  const moveCard = (d, own = true) => { const x = d.x; return clean({
    played: clip(x.label, 90), better: x.best && !d.same ? clip(x.best.label, 90) : null,
    winIfPlayedPct: d.B, winIfBetterPct: d.A, movePointsLost: own ? Math.round(d.gap * 1000) / 10 : null, rating: d.cls,
    likelyReason: x.why?.head ? clip(x.why.head, 140) : null,
    betterAimsAt: aimTxt(x.aim?.A), playedAimsAt: aimTxt(x.aim?.B),
    simpleChoice: x.simple ? (x.simple.is === "A" ? "the better move" : x.simple.is === "B" ? "what was played" : clip(x.simple.label, 80)) : null,
  }); };

  // best and costliest decisions of the person
  const costliest = imp.slice(0, 2).map((d) => clean({ when: when(d), winChanceAfterPct: pc(d.win), ...moveCard(d, true) }));
  const bestMoves = ds.filter((d) => ["best", "great"].includes(d.cls) && d.x.spread != null).sort((a, b) => b.x.spread - a.x.spread).slice(0, 1)
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
      luckOrPlayVerdict: book && book.moves != null ? verdict(pc(book.luck, 1), pc(book.moves, 1)) : null,
    }),
    winChanceByTurn: perTurn.length > 1 ? perTurn : null, tableWinChanceAt: tableAt,
    turningPointCandidates: turning, ending, costliestDecisions: costliest, bestDecisions: bestMoves, dice,
    leadChanges: st?.leadChanges, awards: st?.awards?.length ? st.awards.map((a) => ({ when: `${TW} ${st.turnOf?.[a.s] ?? ""}`.trim(), award: a.kind === "L" ? "Longest road" : "Largest army", to: nm(a.pid) })) : null,
    notes: [luckOk ? null : "No luck analysis for this game.", rv && !tryv(() => g._rvReviewComplete(pid)) ? "The review was not finished; numbers are provisional." : null].filter(Boolean),
  });
  let json = JSON.stringify(facts);
  // too long: drop the lines of play, then the smaller parts, until it fits
  const trim = [(f) => delete f.bestDecisions, (f) => delete f.tableWinChanceAt, (f) => delete f.winChanceByTurn, (f) => { f.turningPointCandidates = f.turningPointCandidates?.slice(0, 6); }, (f) => f.players?.forEach((p) => { delete p.builtOnTurns; delete p.built; })];
  for (const t of trim) { if (json.length <= max) break; t(facts); json = JSON.stringify(facts); }
  return { obj: facts, json };
}
