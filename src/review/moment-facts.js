// v1.64 "Why?": the facts of ONE moment (a decision of the person, or a turning point of the recap) for the explain mode of the recap
// Function (azure/recap-fn, mode "explain"). Same rule as recap-facts.js: only what the review already knows, nothing guessed.
import { tradeShow } from "./evaluate.js";
import { recapFacts } from "./recap-facts.js";

export const MOMENT_MAX = 4000;
const AIM = { s: "settlements", c: "cities", lr: "Longest road", la: "Largest army", dv: "point cards", is: "new islands" };
const RN = { wood: "wood", brick: "brick", sheep: "sheep", wheat: "wheat", ore: "ore", lumber: "wood", grain: "wheat", wool: "sheep" };
const clip = (s, n) => { s = String(s ?? ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const clean = (o) => { Object.keys(o).forEach((k) => { const v = o[k]; if (v == null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) delete o[k]; }); return o; };
const aimTxt = (a) => (a?.src?.length ? a.src.map(([k, v]) => `${AIM[k] || k} ${v}%`).join(", ") : null);

/** Resources and dice numbers around a node, e.g. "wheat 6, ore 8, wood 5". */
const spot = (g, id) => tryv(() => (g.geometry.nodes[id].adjacentHexes || []).map((h) => g.geometry.hexes[h]).filter((h) => h && h.number && RN[h.resource]).map((h) => `${RN[h.resource]} ${h.number}`).join(", "), "");

/** Words for a move label (the same text the card shows). */
export const momentLabel = (l) => clip(tradeShow(String(l ?? "")), 90);

/** The position now on the board (the review has seeked to the moment): who has what. */
function position(g, pid) {
  const nm = (q) => (g._rvIsYou(q) ? "You" : String(g.players[q]?.name || `Player ${q + 1}`));
  return g.players.map((p) => clean({
    player: nm(p.id), points: p.victoryPoints,
    hand: p.id === pid ? clean(Object.fromEntries(Object.entries(p.resources || {}).filter(([, v]) => v > 0).map(([r, v]) => [RN[r] || r, v]))) : undefined,
    cards: p.id === pid ? undefined : Object.values(p.resources || {}).reduce((a, b) => a + (b || 0), 0),
    settlements: [...(p.settlements || [])].map((n) => spot(g, n)),
    cities: [...(p.cities || [])].map((n) => spot(g, n)),
    roads: (p.roads || []).length || (p.roads?.size ?? undefined),
  }));
}

/** d = a decision of the review; tpTurn = a recap turning point's turn (adds what happened, even if it was luck or the others). */
export function momentFacts(g, d, { tpTurn = null, max = MOMENT_MAX } = {}) {
  if (!d?.x) return null;
  const pid = g._rvPid, x = d.x, noA = d.same, TW = tryv(() => g._rvTW(), "Turn");
  const f = {
    moment: d.k === "setup" ? "Set-up" : `${TW} ${d.t}`, player: g._rvIsYou(pid) ? "You" : g.players[pid]?.name,
    position: tryv(() => position(g, pid)),
    B_played: { move: momentLabel(x.label), winChancePct: d.B, aimsAt: aimTxt(x.aim?.B) },
    A_better: noA ? "none: B was the best move" : { move: momentLabel(x.best?.label), winChancePct: d.A, aimsAt: aimTxt(x.aim?.A),
      usuallyNext: x.aim?.A?.nx ? `${x.aim.A.nx[0]} within 2 turns (${x.aim.A.nx[1]} of ${x.aim.A.nx[2]} futures)` : null },
    rating: d.cls, winChanceLostPoints: d.gap != null ? Math.round(d.gap * 1000) / 10 : null,
    likelyReason: x.why?.head || x.why?.plan ? clip(x.why.head || x.why.plan, 160) : null,
    simpleChoice: x.simple ? (x.simple.is === "A" ? "A, the better move" : x.simple.is === "B" ? "B, what was played" : clip(x.simple.label, 80)) : null,
  };
  if (tpTurn != null) {
    const rf = tryv(() => recapFacts(g, { max: 60000 })?.obj);
    const hit = (rf?.turningPointCandidates || []).filter((c) => c.turn === tpTurn);
    if (hit.length) f.whatHappened = hit.slice(0, 2).map((c) => clean({ player: c.player, did: c.did, winChancePct: c.winChancePct, luck: c.luckEvents }));
  }
  clean(f);
  let json = JSON.stringify(f);
  if (json.length > max && f.position) { f.position.forEach((p) => { delete p.roads; }); json = JSON.stringify(f); }
  if (json.length > max) { delete f.position; json = JSON.stringify(f); }
  return { obj: f, json };
}
