// v1.83 The FACT INDEX of one game: typed, ref-addressable facts built from the review data that already exists (ai-facts.js win chance series and
// near miss, ai-tools.js decisions, luck.js / review-luck.js luck per player, ai-strat.js strategy). Values stay here; a page spec only holds refs
// and the app resolves them at render time, so a number can never disagree between two widgets. Pure: no DOM.
//   name.<p>  turn.<t>  wc.<p>@<t>  d.<p>@<t>  pts.<p>  strat.<p>.<field>  luck.total.<p>  luck.dominant  rate.<res>.<p|top>
//   near.<field>  dec.<t>.<field>  game.<field>
import { aiSeries, aiNearMiss, aiDecisive, wcAt, wcChange } from "./ai-facts.js";
import { aiDecList } from "./ai-tools.js";
import { decMoves } from "./ai-blocks.js";
import { stratOf, handLog, finalScore, R5 } from "./ai-strat.js";
import { luckKey, ownOf } from "../review-luck.js";
import { swingCause } from "./ai-cause.js";
import { gameShape, shapeChart } from "./ai-shape.js";
import { ledgerFacts } from "./ai-ledger.js";
import { aiSurprise, surpriseFact } from "./ai-surprise.js";
import { langOf, moveLabel } from "./ai-lang.js";
import { recapLang } from "../review-recap.js";

const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };
const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "") || "p";
export const LUCK_DOMINANT = 8; // win chance points: a player's luck from chance at least this big is worth a card

/** All facts of the game the reviewed player is looking at. */
export function buildFacts(g, lang = recapLang()) {
  const t_ = langOf(lang), n = g.players.length, me = g._rvPid, led = tryv(() => g._ldReady?.()), ser = (led && tryv(() => led.series())) || tryv(() => aiSeries(g), { by: new Map(), maxT: 0 }), log = tryv(() => handLog(g)); // v1.90 the game card reads the STEP LEDGER's series when it is complete (one source for the chart, the headline and the ledger numbers); the Win chance tab keeps its own
  const T = Math.max(ser.maxT || 0, g.turn || 0, log?.T || 0);
  const nameOf = (q) => (g._rvIsYou(q) ? t_.you : String(g.players[q]?.name || `Player ${q + 1}`).replace(/<[^>]+>/g, ""));
  const keys = [], used = new Set();
  g.players.forEach((p, q) => { let k = g._rvIsYou(q) ? "you" : slug(p.name); if (used.has(k)) k = `${k}${q}`; used.add(k); keys[q] = k; });
  const seatOf = (k) => keys.indexOf(String(k));
  const players = g.players.map((p, q) => ({ seat: q, key: keys[q], name: nameOf(q), you: g._rvIsYou(q) }));
  const fx = { lang: t_ === langOf("nl") ? "nl" : "en", t: t_, g, n, me, T, ser, log, players, keys, seatOf, nameOf, hasWc: ser.by.size >= 2 };
  fx.wc = (q, t) => wcAt(ser, q, t);
  fx.change = (q, t) => wcChange(ser, q, t, t);
  fx.winner = g.winner ? g.winner.id : null;
  fx.won = fx.winner === me;
  fx.you = me;
  // strategy facts of every player (cheap; memoised by the hand log)
  fx.strat = g.players.map((_, q) => tryv(() => stratOf(g, q, ser)));
  // luck: one number per player in win chance points, plus where it came from (dice, steals, card draws, seat order)
  const L = tryv(() => g._lkState());
  fx.luck = null;
  if (L && !L.na && L.done && L.cover >= 0.9) {
    const tot = L.tot.map((v) => Math.round(v * 100)), rows = g.players.map(() => ({ dice: 0, steal: 0, draw: 0, seat: 0 }));
    tryv(() => { const store = g._lkStore(); g._lkEvents().forEach((ev) => { const r = store.res[luckKey(ev)]; if (!r?.l) return; r.l.forEach((x, q) => { if (!ownOf(ev, q)) return; rows[q][ev.kind === "dice" ? "dice" : ev.kind === "steal" ? "steal" : "draw"] += x * 100; }); }); g.players.forEach((_, q) => { rows[q].seat = (g._lkSeat(q) || 0) * 100; }); });
    fx.luck = { tot, rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)]))), dominant: Math.max(...tot.map(Math.abs)) >= LUCK_DOMINANT };
  }
  // income per turn by resource
  const st = g._st, turns = Math.max(1, g.turn || T || 1);
  fx.rate = st?.prod ? Object.fromEntries(R5.map((r, i) => [r, g.players.map((_, q) => Math.round(((st.prod[q]?.[i] || 0) / turns) * 10) / 10)])) : null;
  fx.dice = st?.dice ? { counts: st.dice, N: st.steps?.length || 0 } : null;
  fx.near = tryv(() => aiNearMiss(g, ser));
  // the two authoritative facts every consumer uses: what decided the game, and the final score breakdown (refs game.decisive.* / score.<p>.<src>)
  fx.decisive = tryv(() => { const d = aiDecisive(g, ser, me); return d && { ...d, key: keys[d.seat], other: d.other && { ...d.other, key: keys[d.other.seat] } }; });
  fx.shape = tryv(() => gameShape(fx)); // v1.87 the shape of the game (ai-shape.js)
  fx.score = g.players.map((_, q) => tryv(() => finalScore(g, q, log)));
  // why the decisive swing was so sudden (ai-surprise.js): one fact for the game card, the chat and the composer (refs sx.<field>)
  fx.surprise = tryv(() => (fx.decisive ? aiSurprise(g, ser, fx.decisive, log) : null));
  fx.surpriseFact = () => (fx.surprise ? surpriseFact(fx.surprise, nameOf, fx.lang) : null);
  // v1.90 the step ledger as facts (src/review/ai-ledger.js): the rows of the card, the biggest rounds with their steps, why the reviewed player fell behind; null while the positions are not all valued
  fx.lg = tryv(() => { if (!led || ser.src !== "ledger") return null; const mk = fx.shape && fx.shape.id !== "seesaw" ? shapeChart(fx, fx.shape, keys[me], fx.winner != null ? keys[fx.winner] : keys[me]).marks || [] : fx.decisive ? [fx.decisive.t] : []; return g._ldModel(fx, mk, fx.surprise); });
  fx.ledger = tryv(() => (fx.lg ? ledgerFacts(fx.lg, fx) : null));
  fx.behind = tryv(() => (fx.lg ? fx.lg.behind() : null));
  /** What a round's win chance moved on (for the headline): "dice" | "card" | null when no single cause is proven. */
  fx.lgCause = (t) => tryv(() => { const v = fx.lg?.view(t); if (!v || !v.tot) return null; const sh = (x) => (Math.sign(x) === Math.sign(v.tot) ? Math.abs(x) / Math.abs(v.tot) : 0); if (sh(v.chance) < 0.6) return null; const dev = v.steps.some((s) => s.type === "dev" && s.chance && Math.abs(s.d[me]) >= 0.5 * Math.abs(v.d[me])); return dev ? "card" : v.steps.some((s) => s.type === "roll") ? "dice" : null; });
  // the reviewed player's decisions that cost win chance, biggest first
  fx.decs = tryv(() => aiDecList(g).filter((e) => e.seat === me && e.x?.best && e.gap >= 0.005 && e.turn >= 1).map((e) => {
    const mv = tryv(() => decMoves(e, lang)); if (!mv?.best || mv.played?.win == null || mv.best.win == null) return null;
    return { turn: e.turn, seat: e.seat, gap: Math.round(e.gap * 100), vc: mv.vc || null, played: mv.played.label, best: mv.best.label, playedWin: mv.played.win, bestWin: mv.best.win, pos: !!(mv.played.focus || mv.best.focus), e };
  }).filter(Boolean).sort((a, b) => b.gap - a.gap), []);
  fx.decAt = (t) => fx.decs.find((d) => d.turn === t) || null;
  // the turns where a seat's win chance moved most (whole points), biggest first
  fx.swings = (q, k = 4) => { const out = []; for (const t of ser.by.keys()) { if (t < 1) continue; const c = wcChange(ser, q, t, t); if (c && c.d) out.push({ t, ...c }); } return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, k); };
  // the board: hex ids, the robber's moves per turn and the start spots, for the board primitive (src/review/ai-board.js) and the refs rob.<t>.* / setup.<p>.<n>
  fx.board = tryv(() => {
    const geo = g.geometry, st = g._st; if (!geo?.hexes?.length || !st?.stepEvents) return null;
    const hexName = (id) => moveLabel(String(g._hexName(id)), fx.lang), spotName = (id) => moveLabel(String(g._spotLabel(id)), fx.lang);
    const robber = [], setup = g.players.map(() => []); let cur = st.r0 ?? null;
    for (let k = 0; k <= st.N; k++) (st.stepEvents[k] || []).forEach((e) => {
      const [, c, a, b, x] = e;
      if (c === "R") { const t = st.turnOf[k] ?? 0; const last = robber[robber.length - 1]; const m = { turn: t, seat: a, hex: b, from: cur }; if (last && last.turn === t) robber[robber.length - 1] = m; else robber.push(m); cur = b; }
      else if (c === "b" && b === "s" && k === 0 && setup[a] && setup[a].length < 2) setup[a].push(x);
    });
    return { hexes: geo.hexes.map((h) => ({ id: h.id, res: h.resource, num: h.number || null })), robber: robber.filter((m) => m.turn >= 1 && m.hex != null && geo.hexes[m.hex]), setup, hexName, spotName };
  });
  /** What happened in turn t (from the app): the cause of the biggest change of a seat, in words. */
  fx.cause = (t, q) => { const c = tryv(() => swingCause(g, t, q)); return c ? { actor: c.actor, text: t_.cause(c, nameOf), kind: c.kind, delta: c.delta, from: c.from, to: c.to } : null; };

  /** Resolve a ref to { v, k } (k: player turn pct n x b) or null. */
  fx.ref = (ref) => {
    const [path, at] = String(ref).split("@"), p = path.split(".");
    const num = (v) => (v == null || !Number.isFinite(v) ? null : { v, k: "n" });
    const seat = (k) => { const q = seatOf(k); return q >= 0 ? q : null; };
    switch (p[0]) {
      case "name": { const q = p.length === 2 ? seat(p[1]) : null; return q == null ? null : { v: q, k: "player" }; }
      case "turn": { const t = p.length === 2 && /^\d+$/.test(p[1]) ? +p[1] : -1; return t >= 0 && t <= T ? { v: t, k: "turn" } : null; }
      case "wc": { const q = seat(p[1]), t = /^\d+$/.test(at ?? "") ? +at : -1; if (q == null || t < 0 || t > T || !fx.hasWc) return null; const v = wcAt(ser, q, t); return v == null ? null : { v, k: "pct" }; }
      case "d": { const q = seat(p[1]), t = /^\d+$/.test(at ?? "") ? +at : -1; if (q == null || t < 1 || t > T) return null; const c = wcChange(ser, q, t, t); return c ? { v: c.d, k: "pct" } : null; }
      case "pts": { const q = seat(p[1]); return q == null ? null : num(g.players[q].victoryPoints); }
      case "game": {
        if (p[1] === "winner") return fx.winner == null ? null : { v: fx.winner, k: "player" };
        if (p[1] === "T") return { v: T, k: "turn" };
        if (p[1] === "decisive") { const d = fx.decisive; if (!d) return null; if (p[2] === "t") return { v: d.t, k: "turn" }; if (p[2] === "player") return { v: d.seat, k: "player" }; return null; }
        if (p[1] === "futures") return null;
        return null;
      }
      case "sx": { // sx.<field> : the surprise of the decisive swing (ai-surprise.js)
        const x = fx.surprise; if (!x) return null; const f = p[1];
        const seatV = (q) => (q == null || !g.players[q] ? null : { v: q, k: "player" });
        if (f === "mover") return seatV(x.mover); if (f === "actor") return seatV(x.actor); if (f === "victim") return seatV(x.victim); if (f === "prev") return seatV(x.prev);
        if (f === "t") return { v: x.turn, k: "turn" };
        if (f === "odds") return x.odds ? { v: x.odds.pct, k: "pct" } : null;
        if (f === "hidden") return x.hidden > 0 ? num(x.hidden) : null;
        if (f === "by") return x.by?.[p[2]] > 0 ? num(x.by[p[2]]) : null; // by.s .c .v .I .L .A
        if (["gain", "need", "before", "after", "public", "roll"].includes(f)) return x[f] == null || (f !== "need" && f !== "public" && x[f] <= 0) ? null : num(x[f]);
        return null;
      }
      case "score": { const q = seat(p[1]), x = q == null ? null : fx.score[q]; if (!x) return null; return p[2] === "total" ? num(x.total) : x.by[p[2]] != null ? num(x.by[p[2]]) : null; }
      case "luck": {
        if (!fx.luck) return null;
        if (p[1] === "total" && p.length === 3) { const q = seat(p[2]); return q == null ? null : { v: fx.luck.tot[q], k: "pct" }; }
        if (p[1] === "dominant") return fx.luck.dominant ? { v: 1, k: "b" } : null;
        return null;
      }
      case "rate": {
        if (!fx.rate || !fx.rate[p[1]] || p.length !== 3) return null;
        if (p[2] === "top") { const o = fx.rate[p[1]].filter((_, q) => q !== me); return o.length ? num(Math.max(...o)) : null; }
        if (p[2] === "low") { const o = fx.rate[p[1]].filter((_, q) => q !== me); return o.length ? num(Math.min(...o)) : null; }
        const q = seat(p[2]); return q == null ? null : num(fx.rate[p[1]][q]);
      }
      case "near": {
        const m = fx.near; if (!m) return null;
        if (p[1] === "pts") return num(m.youPoints);
        if (p[1] === "wpts") return num(m.winnerPoints);
        if (p[1] === "goal") return num(m.pointsToWin);
        if (p[1] === "margin") return m.margin ? num(m.margin) : null;
        const ms = m.needed?.missing ? Object.entries(m.needed.missing) : [];
        if (p[1] === "res") return ms.length === 1 ? { v: t_.res[ms[0][0]] || ms[0][0], k: "x" } : null;
        if (p[1] === "n") return ms.length === 1 ? num(ms[0][1]) : null;
        if (p[1] === "label") return m.needed?.label ? { v: m.needed.label, k: "x" } : null;
        return null;
      }
      case "dec": {
        const d = /^\d+$/.test(p[1] ?? "") ? fx.decAt(+p[1]) : null; if (!d) return null;
        if (p[2] === "gap") return d.gap ? { v: d.gap, k: "pct" } : null;
        if (p[2] === "neg") return d.gap ? { v: -d.gap, k: "pct" } : null;
        if (p[2] === "played") return { v: d.played, k: "x" };
        if (p[2] === "best") return { v: d.best, k: "x" };
        return null;
      }
      case "rob": { // rob.<turn>.hex | rob.<turn>.by : where the robber went in that turn, and who moved it
        const m = fx.board && /^\d+$/.test(p[1] ?? "") ? fx.board.robber.find((r) => r.turn === +p[1]) : null; if (!m) return null;
        if (p[2] === "hex") return { v: fx.board.hexName(m.hex), k: "x" };
        if (p[2] === "by") return g.players[m.seat] ? { v: m.seat, k: "player" } : null;
        return null;
      }
      case "setup": { // setup.<player>.<1|2> : the start spots of a player, as their hexes ("Graan 9, Erts 6")
        const q = seat(p[1]), n = +p[2], id = q == null || !fx.board ? null : fx.board.setup[q]?.[n - 1]; return id == null ? null : { v: fx.board.spotName(id), k: "x" };
      }
      case "strat": {
        const q = seat(p[1]), s = q == null ? null : fx.strat[q]; if (!s) return null;
        const f = p[2];
        if (f === "pivot") { if (!s.pivot) return null; if (p[3] === "t") return { v: s.pivot.t, k: "turn" }; if (p[3] === "to") return { v: t_.plan[s.pivot.toFam] || s.pivot.to, k: "x" }; return { v: 1, k: "b" }; }
        if (["steady", "wobbly", "headless"].includes(f)) return s[f] ? { v: 1, k: "b" } : null;
        if (f === "plan") return s.plan ? { v: t_.plan[s.planFam] || s.plan, k: "x" } : null;
        if (f === "waitRes") return s.waitRes ? { v: t_.res[s.waitRes] || s.waitRes, k: "x" } : null;
        if (f === "waitN") return s.waitRes ? num(s.waitN) : null;
        if (f === "E") return s.E == null ? null : { v: s.E, k: "pct" };
        if (f === "SD") return { v: s.SD, k: "pct" };
        if (f === "idleN" || f === "turns") return num(s[f]);
        if (f === "verdict") return s.verdict ? { v: t_.verdict[s.verdict.code] || s.verdict.label, k: "x" } : null;
        if (f === "feeds") return s.feeds ? { v: s.feeds, k: "x" } : null;
        return null;
      }
      default: return null;
    }
  };
  return fx;
}
