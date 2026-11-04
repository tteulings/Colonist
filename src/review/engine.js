// v1.02 review: putting a headless engine (the Master Web Worker's, or the Node harness's) on a saved
// position. loadPosition is the Master's own loader (moved here from src/master/worker.js unchanged);
// loadRecord loads one recorded decision of the person (src/review.js), their seat planning like the Expert.
/** v1.17 Rush as turn-based play. Rush has no turns (everyone acts at any time, the dice roll on a timer), so a Rush position is
 *  searched / reviewed as the same position under the Classic rules, with these assumptions: the seat in question acts next and
 *  the table then follows in seat order, one roll per turn; a 7 discards above the Rush limit (9); a dev card bought this roll
 *  interval is playable from the next turn on (Rush: from the next roll); one dev card per turn (Rush: per roll). Not modelled:
 *  the clock, several moves in one interval by different seats at once, spots lost to a faster bot. */
export function rushToTurns(d, seat) {
  if (!d || d.settings?.mode !== "rush") return d;
  const lim = Math.max(9, Number(d.settings.discardLimit) || 7);
  d.settings = { ...d.settings, mode: "classic", discardLimit: lim };
  d.rush = null;
  if (!d.setupPhase) {
    d.phase = "main";
    if (seat != null && seat >= 0) { d.currentPlayerIndex = seat; d.currentTurnPlayedDevCard = !!d.players?.[seat]?.rushDevPlayed; }
    d.pendingAction = null; d.robberContext = null; d.pendingRobberFlow = null; d.robberVictimOptions = [];
  }
  return d;
}

/** Load the page's position. Lab boards past set-up can still ask for a set-up spot ("as if" one more). */
export function loadPosition(g, m) {
  const H = g.constructor.labHelpers;
  g.onboardingHold = true; // loadFromStorage must not continue the game by itself
  const data = typeof m.state === "string" ? JSON.parse(m.state) : JSON.parse(JSON.stringify(m.state));
  g._rushPos = data.settings?.mode === "rush"; // the position came from a Rush game (read by the review to word "End turn" as "Wait")
  g.loadFromStorage(rushToTurns(data, m.seat));
  g.onboardingHold = false;
  g.players.forEach((p) => { p.isHuman = false; p.agent = null; if (!p.strategy) p.strategy = { ...H.AI_PRESETS.intermediate }; });
  g.turnSerial = m.turnSerial || 0;
  g._aiCardTrack = Array.isArray(m.trk) && m.trk.length === g.players.length ? { players: g.players, est: m.trk.map((e) => ({ ...e })) } : null;
  g.robberVictimOptions = [];
  g.pendingRobberFlow = null;
  const P = g.players[m.seat];
  if (m.lab) { // AI Lab: decide for this seat as if it were its turn
    g.winner = null;
    g.currentPlayerIndex = m.seat;
    g.pendingAction = null;
    if (m.kind === "setup") {
      const need = (p) => Math.max(0, 2 - p.settlements.size - p.cities.size);
      const ids = g.players.map((p, i) => g.players[(m.seat + i) % g.players.length].id);
      const left = new Map(ids.map((id) => [id, need(g.players[id])]));
      const q = [];
      [...ids, ...ids.slice().reverse()].forEach((id) => { if (left.get(id) > 0) { q.push(id); left.set(id, left.get(id) - 1); } });
      if (q[0] !== m.seat) q.unshift(m.seat);
      g.setupPhase = true; g.setupQueue = q; g.setupStep = 0; g.setupAction = null;
    } else { g.setupPhase = false; g.phase = "main"; }
  }
  return P;
}


export function loadRecord(g, base, rec) {
  const P = loadPosition(g, { state: { ...JSON.parse(rec.st), ...base }, trk: rec.trk, turnSerial: rec.ts, seat: rec.pid });
  P.strategy = { ...g.constructor.labHelpers.AI_PRESETS.expert };
  return P;
}
