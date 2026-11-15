// v1.82 "Why is A better than B", read from the engine's own futures. While the explain run plays A and B into the SAME paired
// futures (src/master/search.js, o.trace), a tracer watches the mover: when the 3rd / 4th settlement and the cities were built,
// Longest Road / Largest Army, dev cards, cards received in the ${win} 10 turns, cards lost to the robber and 7s, bank / port trades,
// points at turn 15 / 20. attribute() then compares the two moves per feature (paired mean difference, standard error) and keeps what
// is significant (about 2 SE) AND moves the win chance; reasonSentence() words each in the app's plain language.
// The tracer only observes (no random draw, no state change): the futures are exactly the ones played without it.
const RES = ["wood", "brick", "sheep", "wheat", "ore"];
export const RESN = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
const sum = (o) => RES.reduce((a, r) => a + (o[r] || 0), 0);

/** The two turns at which the points are read: 15 and 20 from an early position, else 6 and 12 turns on. */
export const checkpoints = (t0) => (t0 < 12 ? [15, 20] : [t0 + 6, t0 + 12]);
/** Install the observers on game g for seat `me`; returns { tr, hook, end }: hook is rollout's onEnd, end() removes the observers and gives the record. */
export function traceStart(g, me) {
  const p = g.players[me];
  const t0 = g.turn, cp = checkpoints(t0);
  const tr = { t0, cp, t: g.turn, H: g.turn, s: [], c: [], lr: null, la: null, dev: 0, res10: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }, lost: 0, bank: 0, port: 0, vp15: null, vp20: null };
  for (let i = 0; i < p.settlements.size + p.cities.size; i++) tr.s.push(0); // pieces already on the board (the same in both moves)
  for (let i = 0; i < p.cities.size; i++) tr.c.push(0);
  const KEYS = ["distributeResources", "performBankTrade", "buyDevelopmentCard", "_doSteal", "_autoDiscard", "endTurn", "placeSettlement", "placeCity"];
  const own = KEYS.map((k) => [k, Object.prototype.hasOwnProperty.call(g, k), g[k]]);
  const o = Object.fromEntries(own.map(([k, , fn]) => [k, fn]));
  g.distributeResources = function (roll) { const r = o.distributeResources.call(this, roll); try { if (r && r[me] && g.turn < t0 + 10) RES.forEach((k) => { tr.res10[k] += r[me][k] || 0; }); } catch (_) { /* observer only */ } return r; };
  g.performBankTrade = function (pl, give, get) { const rate = pl.id === me ? this.getPlayerTradeRate(pl, give) : 0; const ok = o.performBankTrade.call(this, pl, give, get); if (ok && pl.id === me) { tr.bank += 1; if (rate < 4) tr.port += 1; } return ok; };
  g.buyDevelopmentCard = function (pl) { const ok = o.buyDevelopmentCard.call(this, pl); if (ok && pl.id === me) tr.dev += 1; return ok; };
  g._doSteal = function (cur, vid) { const before = vid === me ? sum(p.resources) : 0; const r = o._doSteal.call(this, cur, vid); if (vid === me) tr.lost += Math.max(0, before - sum(p.resources)); return r; };
  g._autoDiscard = function (pl, count) { const r = o._autoDiscard.call(this, pl, count); if (pl.id === me && r) tr.lost += sum(r); return r; };
  g.placeSettlement = function (pl, n, setup) { const ok = o.placeSettlement.call(this, pl, n, setup); if (ok && pl.id === me) tr.s.push(this.turn); return ok; };
  g.placeCity = function (pl, n, free) { const ok = o.placeCity.call(this, pl, n, free); if (ok && pl.id === me) tr.c.push(this.turn); return ok; };
  g.endTurn = function () { tr.t = this.turn; return o.endTurn.call(this); };
  const hook = (pl) => {
    tr.H = Math.max(tr.H, tr.t);
    if (pl.id !== me) return;
    if (tr.lr == null && g.longestRoadHolder === me) tr.lr = tr.t;
    if (tr.la == null && g.largestArmyHolder === me) tr.la = tr.t;
    if (tr.vp15 == null && tr.t >= cp[0]) tr.vp15 = p.victoryPoints;
    if (tr.vp20 == null && tr.t >= cp[1]) tr.vp20 = p.victoryPoints;
  };
  return {
    tr, hook,
    end() {
      own.forEach(([k, had, fn]) => { if (had) g[k] = fn; else delete g[k]; });
      if (g.longestRoadHolder === me && tr.lr == null) tr.lr = tr.H;
      if (g.largestArmyHolder === me && tr.la == null) tr.la = tr.H;
      return tr;
    },
  };
}

/** The tracer's record as the flat feature vector of one future. Turn features that never happened are censored at the horizon + 1. */
export function featuresOf(tr, end) {
  const cen = (v) => (v == null ? tr.H + 1 : v);
  const f = { s3: cen(tr.s[2]), s4: cen(tr.s[3]), c1: cen(tr.c[0]), c2: cen(tr.c[1]), lr: tr.lr != null ? 1 : 0, la: tr.la != null ? 1 : 0, lrT: cen(tr.lr), laT: cen(tr.la), won: end.won ? 1 : 0,
    dev: tr.dev, lost: tr.lost, bank: tr.bank, port: tr.port, vp15: tr.vp15 ?? end.vp, vp20: tr.vp20 ?? end.vp, got10: sum(tr.res10) };
  RES.forEach((r) => { f["r_" + r] = tr.res10[r]; });
  return f;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let c = 0, va = 0, vb = 0; for (let i = 0; i < a.length; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return va > 0 && vb > 0 ? c / Math.sqrt(va * vb) : 0; };

const UNIT = { s3: "turn", s4: "turn", c1: "turn", c2: "turn", lrT: "turn", laT: "turn", lr: "%", la: "%", dev: "cards", lost: "cards", bank: "trades", port: "trades", vp15: "points", vp20: "points", got10: "cards" };
RES.forEach((r) => { UNIT["r_" + r] = "cards"; });
export const FEATURE_ICON = { s3: "settlement", s4: "settlement", c1: "city", c2: "city", lr: "road", la: "knight", lrT: "road", laT: "knight", dev: "dev", lost: "robber", bank: "trade", port: "port", vp15: "star", vp20: "star", got10: "cards" };

/**
 * Paired attribution. fa / fb: per-future feature records of A and B (same index = same future), va / vb: the mover's value (win chance) in each.
 * Returns { gap, se, n, reasons: up to 3 typed reasons, all: every feature's numbers }.
 * A feature counts when its paired difference A-B is at least 2 SE from 0 AND it relates to the win-chance difference in the right direction
 * (paired regression slope b of (vA-vB) on the feature difference; share = b * mean difference / gap). Near-duplicates (|corr| > 0.8) of a kept one are skipped.
 */
export function attribute(fa, fb, va, vb, { zMin = 2, max = 3, meta = {} } = {}) {
  const idx = []; for (let j = 0; j < fa.length; j++) if (fa[j] && fb[j] && va[j] != null && vb[j] != null) idx.push(j);
  const n = idx.length;
  if (n < 20) return { n, gap: null, se: null, reasons: [], all: [] };
  const dv = idx.map((j) => va[j] - vb[j]);
  const gap = mean(dv), gse = sdOf(dv) / Math.sqrt(n);
  const keys = Object.keys(fa[idx[0]]);
  const all = [];
  const dOf = {};
  for (const k of keys) {
    if (k === "won") continue;
    const d = idx.map((j) => fa[j][k] - fb[j][k]);
    dOf[k] = d;
    const m = mean(d), sd = sdOf(d), se = sd / Math.sqrt(n);
    if (!(sd > 1e-9)) continue;
    const b = corr(d, dv) * sdOf(dv) / sd;
    const share = Math.abs(gap) > 1e-9 ? (b * m) / gap : 0;
    all.push({ feature: k, a: mean(idx.map((j) => fa[j][k])), b: mean(idx.map((j) => fb[j][k])), diff: m, se, z: m / se, r: corr(d, dv), slope: b, share, unit: UNIT[k] || "" });
  }
  // the resource cards: one reason about the resource that differs most, not five
  // vp15 / vp20 are the outcome of the other features, not a reason: only when nothing else is found
  // a trade-off is not a reason: only the direction that is good in itself (earlier, more, fewer losses)
  const good = (x) => (UNIT[x.feature] === "turn" ? x.diff < 0 : x.feature === "lost" ? x.diff < 0 : x.feature === "bank" || x.feature === "port" ? true : x.diff > 0);
  const sig0 = all.filter((x) => Math.abs(x.z) >= zMin && good(x) && x.share > 0.04 && x.r * Math.sign(gap || 1) > 0.05);
  // in turn features a smaller number is earlier: the sign of the difference is the finding, the slope already says whether it helps
  const cause = sig0.filter((x) => x.feature !== "vp15" && x.feature !== "vp20");
  const sig = cause.length ? cause : sig0;
  sig.sort((x, y) => y.share * Math.abs(y.r) - x.share * Math.abs(x.r));
  const kept = [];
  for (const x of sig) {
    if (kept.some((y) => Math.abs(corr(dOf[x.feature], dOf[y.feature])) > 0.8 || (x.feature.startsWith("r_") && y.feature === "got10") || (y.feature.startsWith("r_") && x.feature === "got10"))) continue;
    kept.push(x);
    if (kept.length >= max) break;
  }
  const reasons = kept.map((x) => reasonOf(x, meta));
  return { n, gap, se: gse, reasons, all };
}

const rnd = (x, d = 1) => { const f = 10 ** d; return Math.round(x * f) / f; };
function reasonOf(x, meta) {
  const pct = x.unit === "%";
  const k = pct ? 100 : 1, d = pct || x.unit === "turn" || x.unit === "points" ? 1 : 1;
  return { feature: x.feature, a: rnd(x.a * k, d), b: rnd(x.b * k, d), diff: rnd(x.diff * k, 2), se: rnd(x.se * k, 2), unit: x.unit, text: reasonSentence(x, meta) };
}
const plural = (n, w) => `${n} ${w}${Math.abs(n - 1) < 1e-9 ? "" : "s"}`;
const amt = (v) => { const r = rnd(Math.abs(v), 1); return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const ORD = { s3: "3rd settlement", s4: "4th settlement", c1: "first city", c2: "second city" };
/** One plain sentence for a feature (A = the better move, B = the played one). */
export function reasonSentence(x, meta = {}) {
  const win = meta.t0 > 1 ? "next" : "first", cp = meta.cp || [15, 20];
  const f = x.feature, dif = x.diff, a = x.a, b = x.b;
  const tv = (v) => Math.round(v);
  if (ORD[f]) {
    const n = Math.max(1, Math.round(Math.abs(dif)));
    return `With A you built your ${ORD[f]} about ${plural(n, "turn")} ${dif < 0 ? "earlier" : "later"} (turn ${tv(a)} vs ${tv(b)}).`;
  }
  if (f === "lr" || f === "la") return `With A you ${dif > 0 ? "more often held" : "less often held"} ${f === "lr" ? "Longest Road" : "Largest Army"} (${Math.round(a * 100)}% of the futures vs ${Math.round(b * 100)}%).`;
  if (f === "lrT" || f === "laT") return `With A you got ${f === "lrT" ? "Longest Road" : "Largest Army"} about ${plural(Math.max(1, Math.round(Math.abs(dif))), "turn")} ${dif < 0 ? "earlier" : "later"} (turn ${tv(a)} vs ${tv(b)}).`;
  if (f === "dev") return `With A you bought ${dif > 0 ? "more" : "fewer"} development cards (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
  if (f === "lost") return `With A you lost ${dif < 0 ? "fewer" : "more"} cards to the robber and 7s (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
  if (f === "bank") return `With A you traded with the bank ${dif > 0 ? "more" : "less"} (${rnd(a, 1)} vs ${rnd(b, 1)} trades).`;
  if (f === "port") return `With A you used your port ${dif > 0 ? "more" : "less"} (${rnd(a, 1)} vs ${rnd(b, 1)} trades).`;
  if (f === "vp15" || f === "vp20") return `With A you had ${amt(dif)} ${Math.abs(dif) < 1.05 && Math.abs(dif) > 0.95 ? "point" : "points"} ${dif > 0 ? "more" : "fewer"} at turn ${f === "vp15" ? cp[0] : cp[1]} (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
  if (f === "got10") return `With A you collected ${amt(dif)} ${dif > 0 ? "more" : "fewer"} cards in the ${win} 10 turns (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
  if (f.startsWith("r_")) return `With A you collected ${amt(dif)} ${dif > 0 ? "more" : "fewer"} ${RESN[f.slice(2)]} in the ${win} 10 turns (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
  return `With A, ${f} differs (${rnd(a, 1)} vs ${rnd(b, 1)}).`;
}
export const NO_REASON = "No single clear reason; the advantage is spread out.";
