// v1.87 The SHAPE of a game: what the normalised win chance series says about how the game went, as one id plus the numbers that prove it.
// Pure: needs only fx.wc(seat, turn) (whole %, one normalised series), fx.n, fx.me, fx.winner, fx.T, fx.hasWc, so the app and the eval fixtures share it.
//   comeback  you won, and were down to <= max(8, half a fair share) after turn 1
//   knockout  you lost: your chance fell to <= min(15, 0.6 fair share) by 40% of the game and never got back above that +5 (early out)
//   sudden    the winner's biggest one-turn rise is >= 30 points and started below 50% (decided in one move, last turn included)
//   seesaw    the favourite changed 3 times or more before the last turn and nobody held a lasting lead
//   wire      the winner led from <= 40% of the game to the end (you won)  |  pullaway: the same when someone else won (lead from <= 60%)
//   takeover  you won, leading continuously only from the later part of the game
//   seesaw is also the fallback.   Thresholds are the constants below, tested in tests/shape187.js.
export const SHAPE = { COMEBACK_LOW: 12.5, OUT: 15, OUT_BAND: 5, OUT_BY: 0.4, SUDDEN: 30, SUDDEN_FROM: 50, SEESAW_CHANGES: 3, WIRE_BY: 0.4, PULL_BY: 0.6, MOSTLY: 0.5 };

export function gameShape(fx) {
  if (!fx?.hasWc || fx.winner == null || !(fx.T >= 4) || !(fx.n >= 2)) return null;
  const { n, T, me } = fx, W = fx.winner, won = W === me, base = 100 / n;
  const S = Array.from({ length: n }, (_, q) => { let p = null; return Array.from({ length: T + 1 }, (_, t) => { const v = fx.wc(q, t); if (v != null) p = v; return p; }); });
  if (S.some((a) => a.some((v) => v == null))) return null;
  const pre = T - 1, topOf = (t) => S.reduce((b, a, q) => (a[t] > S[b][t] ? q : b), 0);
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  // the winner's lead: the first turn from which they are never behind (until the last turn before the result)
  let tLead = null; for (let t = pre; t >= 1; t--) { if (S.every((a, q) => q === W || S[W][t] >= a[t])) tLead = t; else break; }
  // the winner's biggest one-turn rise
  let step = { t: 1, d: -1, from: 0 }; for (let t = 1; t <= T; t++) { const d = S[W][t] - S[W][t - 1]; if (d > step.d) step = { t, d, from: S[W][t - 1] }; }
  const from0 = tLead != null ? S[W][tLead - 1] : step.from, rise = Math.max(1, 100 - from0), mostly = step.d >= 25 && step.d / rise >= SHAPE.MOSTLY && (tLead == null || step.t >= tLead);
  let changes = 0; for (let t = 2; t <= pre; t++) if (topOf(t) !== topOf(t - 1)) changes++;
  const out = { winner: W, me, won, T, tLead, step: { t: step.t, d: step.d, from: step.from, final: step.t >= T }, mostly, changes, base };
  const peakBefore = Math.max(...S.map((a) => Math.max(...a.slice(0, pre + 1)))); out.closeUntilEnd = peakBefore <= 60;
  const my = S[me];
  if (won) {
    let low = 101, tLow = 2; for (let t = 2; t <= pre; t++) if (my[t] < low) { low = my[t]; tLow = t; }
    if (low <= Math.max(8, SHAPE.COMEBACK_LOW * base / 25)) return { ...out, id: "comeback", low, tLow };
  } else {
    const OUT = Math.min(SHAPE.OUT, 0.6 * base);
    for (let t = 1; t <= pre && t <= SHAPE.OUT_BY * T; t++) {
      if (my[t] > OUT) continue;
      const after = range(t, pre).map((u) => my[u]), ceil = Math.max(...after);
      if (ceil <= OUT + SHAPE.OUT_BAND) { const tCeil = t + after.indexOf(ceil); return { ...out, id: "knockout", tOut: t, ceil, tCeil, outAt: my[t] }; }
      break;
    }
  }
  if (step.d >= SHAPE.SUDDEN && step.from < SHAPE.SUDDEN_FROM) return { ...out, id: "sudden" };
  const held = tLead != null && tLead <= (won ? 1 : SHAPE.PULL_BY) * T; // a lead that lasted: early lead changes among the others do not make a see-saw
  if (changes >= SHAPE.SEESAW_CHANGES && !held) return { ...out, id: "seesaw" };
  if (tLead != null) {
    if (won) return { ...out, id: tLead <= SHAPE.WIRE_BY * T ? "wire" : "takeover" };
    if (tLead <= SHAPE.PULL_BY * T) {
      let best = 0, tBest = 0; for (let t = 0; t <= pre; t++) if (my[t] > best) { best = my[t]; tBest = t; }
      return { ...out, id: "pullaway", best, tBest };
    }
  }
  return { ...out, id: "seesaw" };
}

/** The headline of the game card for a shape, as page parts (strings + refs), or null to keep the decisive-swing headline (sudden / seesaw). */
export function shapeTitle(fx, sh, P, R) {
  if (!sh || sh.id === "sudden" || sh.id === "seesaw") return null;
  const nl = fx.lang === "nl", Y = fx.keys[fx.me], W = fx.keys[sh.winner], you = !!fx.players?.[fx.me]?.you, t = (k) => R(`turn.${k}`);
  const how = sh.mostly ? (nl ? [", vooral op ", t(sh.step.t)] : [", mostly on ", t(sh.step.t)]) : (nl ? [" stap voor stap"] : [" step by step"]);
  const howNl = sh.mostly ? ["liep uit, vooral op ", t(sh.step.t)] : ["liep stap voor stap uit"];
  switch (sh.id) {
    case "knockout": { // v1.90.1 "You dropped in turn 3 from 31% to 13%, mostly on dice luck, and never got above 15%. Geelen took the lead in turn 5 and pulled away in turn 11.": the fall itself, its cause when the ledger proves one, the ceiling, then the winner
      const cz = fx.lgCause?.(sh.tOut), why = cz ? [fx.t.r.lgCause[cz]] : [], a = Math.max(0, sh.tOut - 1);
      return nl
        ? [P(Y), " zakte in ", t(sh.tOut), " van ", R(`wc.${Y}@${a}`), " naar ", R(`wc.${Y}@${sh.tOut}`), ...why, " en kwam niet meer boven ", R(`wc.${Y}@${sh.tCeil}`), ". ", P(W), " nam de leiding in ", t(sh.tLead ?? sh.tOut), ...(sh.mostly ? [" en liep uit in ", t(sh.step.t)] : [" en liep stap voor stap uit"]), "."]
        : [P(Y), " dropped in ", t(sh.tOut), " from ", R(`wc.${Y}@${a}`), " to ", R(`wc.${Y}@${sh.tOut}`), ...why, " and never got above ", R(`wc.${Y}@${sh.tCeil}`), ". ", P(W), " took the lead in ", t(sh.tLead ?? sh.tOut), ...(sh.mostly ? [" and pulled away in ", t(sh.step.t)] : [" and pulled away step by step"]), "."];
    }
    case "pullaway": return nl
      ? [P(W), " stond voor vanaf ", t(sh.tLead), " en ", ...howNl, "; ", you ? "jouw" : "zijn", " beste winkans was ", R(`wc.${Y}@${sh.tBest}`), " op ", t(sh.tBest), "."]
      : [P(W), " led from ", t(sh.tLead), " and pulled away", ...how, "; ", you ? "your" : "their", " best win chance was ", R(`wc.${Y}@${sh.tBest}`), " on ", t(sh.tBest), "."];
    case "wire": return nl ? [P(Y), " stond voor vanaf ", t(sh.tLead), " en gaf dat niet meer weg."] : [P(Y), " led from ", t(sh.tLead), " and never gave it up."];
    case "takeover": return nl ? [P(Y), " nam de leiding over op ", t(sh.tLead), " en bleef voorop tot het einde."] : [P(Y), " took the lead on ", t(sh.tLead), " and stayed in front to the end."];
    case "comeback": return nl ? [P(Y), " zat op ", t(sh.tLow), " op ", R(`wc.${Y}@${sh.tLow}`), " en kwam terug om te winnen."] : [P(Y), you ? " were down to " : " was down to ", R(`wc.${Y}@${sh.tLow}`), " on ", t(sh.tLow), " and came back to win."];
  }
  return null;
}

/** v1.88 The chart of the game card for a shape: the turns the headline names (each on its player's line), a shaded zone and the other players faded.
 *  { players, marks, mseat, zone, field } to merge into the win chance line block, or {} to keep the decisive-swing chart. */
export function shapeChart(fx, sh, Y, W) {
  if (!sh || sh.id === "seesaw") return {};
  const T = fx.T, wk = W ?? Y, duo = wk === Y ? [Y] : [Y, wk], mk = [], add = (t, k) => { if (Number.isFinite(t) && t >= 0 && t <= T && !mk.some((m) => m[0] === t)) mk.push([t, k]); };
  let zone = null;
  const my = (t) => fx.wc(fx.me, t) ?? 100;
  switch (sh.id) {
    case "knockout": add(sh.tOut, Y); if (sh.mostly) add(sh.step.t, wk); zone = { k: "out", a: sh.tOut, b: T, hi: sh.ceil }; break;
    case "pullaway": add(sh.tBest, Y); add(sh.mostly ? sh.step.t : sh.tLead, wk); zone = { k: "pull", a: sh.tLead, b: T, who: wk }; break;
    case "wire": case "takeover": add(sh.tLead, Y); zone = { k: "pull", a: sh.tLead, b: T, who: Y }; break;
    case "comeback": {
      let a = sh.tLow, b = sh.tLow; const lim = sh.low + 6; while (a > 0 && my(a - 1) <= lim) a--; while (b < T && my(b + 1) <= lim) b++;
      add(sh.tLow, Y); add(sh.step.t, Y); zone = b > a ? { k: "low", a, b, hi: lim } : null; break;
    }
    case "sudden": add(sh.step.t, wk); break;
  }
  return { players: duo, marks: mk.map((m) => m[0]), mseat: mk.map((m) => m[1]), ...(zone ? { zone } : {}), field: true };
}
