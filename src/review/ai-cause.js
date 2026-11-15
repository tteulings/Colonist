// v1.78 AI tab: WHICH event of a turn caused a player's win-chance swing. The app decides this (never the model): inside the turn, the step
// (one player's roll-and-play) that moved the seat's win chance the most, and in that step the biggest part: the dice, a steal, a development
// card draw (luck run, l[seat]) or the action itself (the rest: building, playing a card). Same per-step numbers as the turn view.
import { luckKey } from "../review-luck.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const DEVN = { knight: "a Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "a point card" };

/** The cause of the change of `seat`'s win chance in turn T: { turn, actor (seat), kind (dice|steal|dev|build|play|win), data, delta (whole points, signed for the seat), step, from, to } or null. */
export function swingCause(g, T, seat) {
  const st = g._st, L = tryv(() => g._lkState());
  if (!st?.steps?.length || !g.winner || !L || L.na || !L.done || L.cover < 0.9) return null;
  const store = g._lkStore(), evs = g._lkEvents(), n = g.players.length, N = Math.min(st.N, st.steps.length);
  const b = new Map(), by = {};
  evs.forEach((ev) => { const r = store.res[luckKey(ev)]; if (ev.kind === "dice" && r?.b) b.set(ev.s, r.b); if (!r?.l || ev.kind === "seat") return; (by[ev.kind === "dice" ? ev.s + 1 : ev.s] ||= []).push({ ev, l: r.l }); });
  const fin = Array.from({ length: n }, (_, q) => (q === g.winner.id ? 1 : 0));
  const win = (k) => (k <= 0 ? (store.res["seat:0:-1"]?.v || b.get(0)) : k >= N ? fin : b.get(k));
  let best = null;
  for (let k = 1; k <= N; k++) {
    if (st.turnOf[k] !== T) continue;
    const pre = win(k - 1), post = win(k), stp = st.steps[k - 1]; if (!pre || !post || !stp) continue;
    const d = post[seat] - pre[seat]; if (!best || Math.abs(d) > Math.abs(best.d)) best = { k, d, pre: pre[seat], post: post[seat], stp };
  }
  if (!best || Math.round(Math.abs(best.d) * 100) < 1) return null;
  const { k, d, stp } = best, actor = stp[1] >= 0 ? stp[1] : seat, what = tryv(() => g._rvStepWhat(k), null);
  const cand = [];
  let sum = 0;
  (by[k] || []).forEach(({ ev, l }) => {
    const v = l[seat] || 0; sum += v;
    if (ev.kind === "dice") cand.push({ v, actor, kind: "dice", data: { roll: ev.roll } });
    else if (ev.kind === "steal") cand.push({ v, actor: ev.thief, kind: "steal", data: { victim: ev.victim } });
    else if (ev.kind === "dev") cand.push({ v, actor: ev.pid, kind: "dev", data: { card: ev.card } });
  });
  // the rest of the step is the action itself (what the player built or played)
  const rest = d - sum;
  if (what) {
    const mine = (what.builds || []).filter((x) => x.pid === actor).map((x) => (x.kind === "c" ? "city" : "settlement")), road = what.roads?.[actor] > 0;
    const pl = (what.acts || []).find((x) => x.p === actor && (x.k === "dev" || x.k === "mono" || x.k === "plenty"));
    const act = mine[0] ? { kind: "build", data: { what: mine[0] } } : road ? { kind: "build", data: { what: "road" } } : pl ? { kind: "play", data: { what: pl.k === "dev" ? pl.type : pl.k === "mono" ? "monopoly" : "yearOfPlenty" } } : null;
    if (act) cand.push({ v: rest, actor, ...act });
  }
  // the winning step: the point card (or the build) that ended the game carries the jump to 0% / 100% as well
  if (k === N && what?.winBy) { const vp = cand.find((c) => c.kind === "dev" && c.data.card === "victoryPoint"); if (vp && /point card/.test(what.winBy)) { vp.v = d; const i = cand.findIndex((c) => c.kind === "build" || c.kind === "play"); if (i >= 0) cand.splice(i, 1); } }
  const top = cand.filter((c) => c.v != null).sort((a, c) => Math.abs(c.v) - Math.abs(a.v))[0];
  if (!top) return null;
  return { turn: T, step: k, actor: top.actor, kind: top.kind, data: top.data, delta: Math.round(top.v * 100), from: Math.round(best.pre * 100), to: Math.round(best.post * 100) };
}

/** English wording of a cause (the tool results): "drew a point card", "rolled 3", "built a road". nm: seat -> name. */
export function causeEvent(c, nm) {
  if (!c) return "";
  if (c.kind === "dice") return `rolled ${c.data.roll}`;
  if (c.kind === "steal") return `stole a card from ${nm(c.data.victim)}`;
  if (c.kind === "dev") return `drew ${DEVN[c.data.card] || "a card"}`;
  if (c.kind === "build") return `built a ${c.data.what}`;
  if (c.kind === "play") return `played ${DEVN[c.data.what] || c.data.what}`;
  return "";
}
