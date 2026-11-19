// v1.94 Lessons: the compact row a reviewed game leaves for the cross-game Lessons (pure: no DOM, runs in the page and in src/lessons-worker.js).
// rowOf(payload, meta) reads ONLY what the app saved for the game (the review's decisions, the board and the event log) and returns about 1 KB:
//   { v, k (the key it was made for), ek (review engine tag), bd (the board, standard island only), dec: the marked moves (<= 12, biggest first), cl: { cat: [moves, win chance lost] } (all of them), seen: { cat: n decisions }, sc: [mine scarce at the end of turn 5 (5 resources, 0/1)],
//     lk: your luck in win-chance pt over the game (dice, steals and card draws that were yours, plus the seat order; the review's own luck run), absent when the game has no luck run,
//     oc: [opponents with that resource scarce (5)], on: opponents, rob: [cards stolen from you or discarded on a 7, mean of the opponents], rb: [cards your hexes did not pay because the robber sat on them, mean of the opponents], wc: [[turn, your win chance % after your last decision of that turn]], b4: [4:1 bank trades, mean of the opponents] }
// It lives in the game's list entry (meta.lr), so the Lessons never unpack the heavy part of 50 games; old games get it in the background (src/lessons.js).
import { gameLessons } from "./lessons-data.js";
import { stdGeo, boardOf, boardPack } from "./lessons-geo.js";
import { stateAt, incomeAt, robberLosses, R5 } from "./review/ai-mech.js";

export const ROW_V = 3; // 3: + lk (your luck in win chance points, from the review's luck run)
/** what a row was made for: another review score (acc), engine tag or format means a new row */
export const rowKey = (m) => `${ROW_V}|${m.acc ?? ""}|${m.rk || ""}|${m.fmt || ""}`;
const KEEP = "bRPXtdu";
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const r1 = (x) => Math.round(x * 10) / 10;
/** the mechanism copy (board + event log) of a saved game, or null when its board is not the standard island */
export function rawOf(state) {
  const b = boardOf(state), st = state?.stats; if (!b || !st?.ev || !st.steps) return null;
  const g = stdGeo(), N = st.steps.length, turnOf = [0, ...st.steps.map((s) => s[0])];
  const ev = st.ev.filter((e) => e[0] >= 0 && e[0] <= N && KEEP.includes(e[1])).map((e, i) => ({ e, i })).sort((a, c) => a.e[0] - c.e[0] || a.i - c.i).map(({ e }) => [turnOf[e[0]] ?? 0, ...e.slice(1)]);
  return { n: state.players.length, r0: st.r0 ?? null, hexes: b.map((h, id) => ({ id, res: h.res, num: h.num })), nodes: g.nodes.map((n) => ({ nb: n.nb, hx: n.hx, ports: [] })), edges: g.edges, ev };
}
const kindOf = (l) => { l = String(l || ""); return /^city/i.test(l) ? "city" : /^settlement/i.test(l) ? "settlement" : /^road/i.test(l) ? "road" : /^bank/i.test(l) ? "bank" : /^end/i.test(l) ? "end" : /^play|^buy|^dev/i.test(l) ? "card" : /^robber/i.test(l) ? "robber" : "other"; };
const NAME2RES = { Lumber: "wood", Brick: "brick", Wool: "sheep", Grain: "wheat", Ore: "ore" };
const spec = (f) => (f?.node != null ? ["n", f.node] : f?.edge != null ? ["e", f.edge] : f?.hex != null ? ["h", f.hex] : null);
/** the detail a plain sentence needs: a bank trade's two resources, the development card played */
const detail = (x) => { const l = String(x.label || ""), m = /^Bank trade (?:\d+ )?(\w+) → (\w+)/.exec(l); if (m && NAME2RES[m[1]] && NAME2RES[m[2]]) return [NAME2RES[m[1]], NAME2RES[m[2]]]; const p = /^Play (.+)$/.exec(l); return p ? p[1].replace(/\s*\(.*$/, "") : null; };

/** your luck of one game in win-chance points: the review's luck run (rv.luck.res) summed the way the review does (src/review-luck.js ownOf): every roll, a steal by or from you, your own card draws, the seat order. null: no (complete) luck run. */
export function luckOf(payload, me) {
  try {
    const res = payload?.rv?.luck?.res, st = payload?.state?.stats, n = payload?.state?.players?.length || 0; if (!res || !st?.steps?.length || me == null || !n) return null;
    let tot = 0, dice = 0;
    for (const [key, r] of Object.entries(res)) {
      if (!r) continue;
      if (r.k === "seat") { if (r.v && r.v[me] != null) tot += r.v[me] - 1 / n; continue; }
      if (!r.l) continue;
      if (r.k === "dice") { tot += r.l[me]; dice += 1; }
      else if (r.k === "steal") { const e = st.ev?.[+key.split(":")[2]]; if (e && (e[2] === me || e[3] === me)) tot += r.l[me]; }
      else if (r.k === "dev") { const e = st.ev?.[+key.split(":")[2]]; if (e && e[2] === me) tot += r.l[me]; }
    }
    return dice >= 0.9 * st.steps.length ? r1(tot * 100) : null;
  } catch (_) { return null; }
}
export function rowOf(payload, m) {
  const gl = gameLessons(m, payload); if (!gl) return null;
  const state = payload.state;
  const own = (state?.stats?.ev || []).filter((e) => e[0] === 0 && e[1] === "b" && e[2] === m.me && e[3] === "s").map((e) => e[4]); // my start settlements, in order
  const dec = gl.ex.slice().sort((a, b) => b.gp - a.gp || a.i - b.i).slice(0, 12).map((e) => ({ t: e.t, i: e.i, c: e.cat, l: e.cls, g: e.gp, a: e.A, b: e.B, pk: kindOf(e.x.label), bk: kindOf(e.x.best.label), p: spec(e.x.focus), q: spec(e.x.best.focus), pd: detail(e.x), bd: detail(e.x.best), ...(e.cat === "setup" && e.x.focus?.node != null && own.length > 1 && own[1] === e.x.focus.node ? { o: own[0] } : {}) }));
  const cl = {}; gl.ex.forEach((e) => { const c = (cl[e.cat] ||= [0, 0]); c[0] += 1; c[1] += e.gp; });
  const row = { v: ROW_V, k: rowKey(m), n: m.n || 4, ek: m.rk || "", dec, cl, seen: gl.seen, marks: gl.ex.length, gp: gl.ex.reduce((s, e) => s + e.gp, 0) };
  const lk = luckOf(payload, m.me); if (lk != null) row.lk = lk;
  try { // the win chance curve: your win chance after your last decision of each turn (the review's own numbers)
    const rvw = payload.rv, rr = (rvw?.reviews || (rvw?.review ? { [rvw.review.pid]: rvw.review } : {}))[m.me], byT = new Map();
    (rr?.results || []).forEach((x) => { if (Number.isFinite(x.win) && Number.isFinite(x.t) && !x.skip) { const o = byT.get(x.t); if (!o || x.s >= o.s) byT.set(x.t, { s: x.s ?? 0, v: x.win }); } });
    const wc = [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, o]) => [t, Math.round(o.v * 100)]);
    if (wc.length >= 3) row.wc = wc.slice(0, 60);
  } catch (_) { /* no curve for this game */ }
  const me = m.me, n = m.n || 4, T = m.turns || 0;
  const bd = boardOf(state); if (bd) row.bd = boardPack(bd);
  try {
    const raw = rawOf(state);
    if (raw && T > 1) {
      const t5 = Math.min(5, T - 1), inc = Array.from({ length: n }, (_, q) => incomeAt(raw, t5, q).dots);
      row.sc = R5.map((r) => (inc[me][r] <= 1 ? 1 : 0)); row.oc = R5.map((r) => inc.filter((d, q) => q !== me && d[r] <= 1).length); row.on = n - 1;
      const rl = Array.from({ length: n }, (_, q) => { let lost = 0, blk = 0; for (let t = 1; t <= T; t++) { const r = robberLosses(raw, t, q); lost += r.stolen + r.discarded; blk += r.cards; } return [lost, blk]; });
      const oth = (k) => r1(mean(rl.filter((_, q) => q !== me).map((x) => x[k])));
      row.rob = [rl[me][0], oth(0)]; row.rb = [rl[me][1], oth(1)];
    }
  } catch (_) { /* no mechanism numbers for this game: its marked moves still count */ }
  try {
    const ev = state?.stats?.ev || [], n4 = (q) => ev.filter((e) => e[1] === "k" && e[2] === q && e[4] >= 4).length;
    if (state?.stats?.ev) row.b4 = [n4(me), r1(mean(Array.from({ length: n }, (_, q) => q).filter((q) => q !== me).map(n4)))];
  } catch (_) { /* optional */ }
  return row;
}
