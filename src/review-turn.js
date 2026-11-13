// v1.56 the review's step mode with the TURN as its unit (src/review-game.js _rvStepDraw): turn cards (win chance after the turn, the
// swing, a star on key turns) to move between turns, "Biggest effect", one row per player (what they got, what they did, win chance
// before → after as a bar, split into luck and moves) that opens in place to that player's decisions in the turn. Every number comes
// from the luck run (src/review-luck.js: the win chance of every seat before each roll), the same source as the moment card, so the
// figures agree everywhere. A decision opened from anywhere (key moment, Moves list, Biggest slip, a player's page) lands on its turn
// with that player's row already open and the move on the board; the turn overview is the closed state.
import { esc, IC } from "./review-ui.js";
import { decide, tradeShow, clsOf } from "./review/evaluate.js";
import { luckKey, wpText } from "./review-luck.js";
import { gameOdds } from "./replay-odds.js";

const KEY_SWING = 0.15; // a "key turn": somebody's win chance moved by this much or more
const pc = (v) => `${Math.round(v * 100)}`;
const sg = (v) => { const r = Math.round(v * 100); return r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "±0"; };
const cl = (v) => (Math.round(v * 100) > 0 ? "pos" : Math.round(v * 100) < 0 ? "neg" : "");

export const ReviewTurnMixin = {
  /** The steps of a turn: { lo, hi } (1-based steps), null when unknown. */
  _tvRange(T) {
    const st = this._st; if (!st || !st.turnOf) return null;
    const N = Math.min(st.N, st.turnOf.length - 1); let lo = 0, hi = 0;
    for (let q = 1; q <= N; q++) if (st.turnOf[q] === T) { if (!lo) lo = q; hi = q; }
    return lo ? { lo, hi } : null;
  },
  /** Win chance of every seat before the turn and after it, and the luck in between (the luck run); null without luck numbers. */
  _tvWin(T) {
    const rg = this._tvRange(T), LK = this._lkState();
    if (!rg || LK.na || LK.cover < 0.9) return null;
    const C = (this._tvCache ||= { n: -1, b: new Map(), ev: [] }), L = this._lkStore(), evs = this._lkEvents(), j = LK.j;
    if (C.n !== j || C.id !== this._rv?.id) { C.n = j; C.id = this._rv?.id; C.b = new Map(); C.ev = evs; evs.forEach((ev) => { const r = L.res[luckKey(ev)]; if (ev.kind === "dice" && r?.b) C.b.set(ev.s, r.b); }); C.sw = new Map(); }
    const n = this.players.length;
    const pre = C.b.get(rg.lo - 1) || (rg.lo <= 1 ? L.res["seat:0:-1"]?.v : null);
    let post = C.b.get(rg.hi);
    if (!post && this.winner) post = Array.from({ length: n }, (_, q) => (q === this.winner.id ? 1 : 0));
    if (!pre || !post) return null;
    const luck = Array(n).fill(0);
    evs.forEach((ev) => { if (ev.s < rg.lo - 1 || ev.s > rg.hi - 1) return; const r = L.res[luckKey(ev)]; if (r?.l) r.l.forEach((x, q) => { luck[q] += x; }); });
    return { pre, post, luck, mv: post.map((v, q) => v - pre[q] - luck[q]), swing: Math.max(...post.map((v, q) => Math.abs(v - pre[q]))) };
  },
  /** Turns the viewed player has a real decision in, in play order: [{ T, d }] (d: their first decision of the turn, the biggest slip if any). */
  _tvTurns(ds) {
    const m = new Map();
    ds.forEach((d) => { if (d.k === "setup") return; const T = this._st?.turnOf?.[d.x?.s ?? 0]; if (T == null) return; const o = m.get(T); if (!o || (d.gap || 0) > (o.gap || 0)) m.set(T, d); });
    return [...m].map(([T, d]) => ({ T, d })).sort((a, b) => a.T - b.T);
  },
  _tvKeyOf(T) { const w = this._tvWin(T); return !!w && w.swing >= KEY_SWING; },
  /** What each player got and did in the turn: { id, got, bits, cards } from the step records. */
  _tvRows(T) {
    const st = this._st, rg = this._tvRange(T); if (!st || !rg) return [];
    const rows = this.players.map((p) => ({ id: p.id, cards: 0, rolls: [], blocked: 0, built: [], roads: 0, did: [] }));
    for (let q = rg.lo; q <= rg.hi; q++) {
      const w = this._rvStepWhat(q), stp = st.steps[q - 1];
      if (w.roll) rows.forEach((r) => { if (stp && stp[1] === r.id) r.rolls.push(w.roll); });
      rows.forEach((r) => {
        r.cards += w.cards?.[r.id] || 0;
        (w.builds || []).filter((b) => b.pid === r.id).forEach((b) => r.built.push(b.kind === "c" ? "city" : "settlement"));
        r.roads += w.roads?.[r.id] || 0;
        (w.acts || []).forEach((x) => {
          if (x.k === "mono") { if (x.p === r.id) r.did.push(`Monopoly +${x.n} ${x.res}`); else if ((x.lost?.[r.id] || 0) > 0) r.did.push(`Monopoly −${x.lost[r.id]} ${x.res}`); }
          else if (x.p === r.id) r.did.push(x.k === "dev" ? (x.type === "knight" ? "Knight" : x.type === "roadBuilding" ? "Road Building" : x.type === "monopoly" ? "" : "dev card") : x.k === "plenty" ? `Plenty +${x.n}` : x.k === "bank" ? "bank trade" : x.k === "trade" ? "trade" : x.k === "steal" ? "steal" : "");
          else if (x.k === "steal" && x.q === r.id) r.did.push("robbed");
        });
      });
    }
    return rows.map((r) => {
      const cnt = [...r.did.filter(Boolean).reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map())].map(([x, n]) => (n > 1 ? `${n}× ${x}` : x));
      return { id: r.id, got: `${r.rolls.length ? `Rolled ${r.rolls.join(", ")}` : ""}${r.cards ? `${r.rolls.length ? " · " : ""}+${r.cards} cards` : ""}`, bits: [...r.built, r.roads ? `${r.roads} ${r.roads === 1 ? "road" : "roads"}` : "", ...cnt].filter(Boolean), cards: r.cards };
    });
  },
  /** The decisions of one player in the turn (their own review; [] when it is not checked). */
  _tvDecs(q, T, ds) {
    const list = q === this._rvPid ? ds : (() => { const rv = this._rvOf?.(q); return rv?.results?.length ? decide(rv.results.filter((x) => !x.skip || x.skip === "trivial"), this.players.length, q) : []; })();
    return list.filter((d) => d.k !== "setup" && this._st?.turnOf?.[d.x?.s ?? 0] === T);
  },
  _tvEnsure(d, ds, keep) {
    const me = this._rvPid, T = this._st?.turnOf?.[d.x?.s ?? 0];
    if (!this._tv || this._tv.pid !== me || (!keep && this._tv.i !== d.i)) this._tv = { pid: me, ov: false, open: new Set([me]) };
    this._tv.i = d.i; this._tv.T = T; return this._tv;
  },
  _tvSentence(T, W) {
    if (!W) return "";
    const o = this.players.map((p) => ({ id: p.id, dl: W.post[p.id] - W.pre[p.id] })).sort((a, b) => Math.abs(b.dl) - Math.abs(a.dl)).filter((x) => Math.round(Math.abs(x.dl) * 100) >= 2).slice(0, 2);
    if (!o.length) return `<b>Biggest effect:</b> nothing moved much this ${this._rvTW().toLowerCase()}.`;
    return `<b>Biggest effect:</b> ${o.map((x) => `${esc(this._rvNm(x.id))} ${pc(W.pre[x.id])}% → ${pc(W.post[x.id])}%`).join("; ")}.`;
  },
  _tvCardsHtml(d, ds) {
    const turns = this._tvTurns(ds), k = turns.findIndex((x) => x.d === d || x.T === this._tv.T), me = this._rvPid;
    const from = Math.max(0, Math.min(k - 3, turns.length - 7)), cards = turns.slice(Math.max(0, from), Math.max(0, from) + 7);
    const key = turns.slice(k + 1).find((x) => this._tvKeyOf(x.T));
    const one = (x) => { const W = this._tvWin(x.T), dl = W ? W.post[me] - W.pre[me] : null, sel = x.T === this._tv.T; return `<button type="button" class="tv-card${sel ? " on" : ""}${W && W.swing >= KEY_SWING ? " key" : ""}" data-tvt="${x.d.i}" aria-label="${this._rvTW()} ${x.T}${dl != null ? `, ${sg(dl)}%` : ""}${W && W.swing >= KEY_SWING ? ", key turn" : ""}"${sel ? ' aria-current="true"' : ""}><b>${x.T}</b><small>${W ? `${pc(W.post[me])}%` : ""}</small><i class="${dl == null ? "" : cl(dl)}">${dl == null ? "" : sg(dl)}</i></button>`; };
    return `<div class="tv-nav"><div class="tv-cards" role="group" aria-label="${this._rvTW()}s">${cards.map(one).join("")}</div>
      <div class="rs-nav tv-btns"><button type="button" class="rv-btn" data-tvgo="-1" ${k > 0 ? "" : "disabled"} aria-label="Previous ${this._rvTW().toLowerCase()}">${IC.prev}Previous</button><button type="button" class="rv-btn rs-ov" data-tvkey="${key ? key.d.i : ""}" ${key ? "" : "disabled"}>Next key ${this._rvTW().toLowerCase()}</button><button type="button" class="rv-btn pri" data-tvgo="1" ${k >= 0 && k < turns.length - 1 ? "" : "disabled"} aria-label="Next ${this._rvTW().toLowerCase()}">Next${IC.next}</button></div></div>`;
  },
  /** The turn block: biggest effect, then one row per player; the viewed player's row (or any you tap) open to the decisions. */
  _tvHtml(d, ds, keep) {
    const st = this._st; if (!st || d.k === "setup") return "";
    const tv = this._tvEnsure(d, ds, keep), T = tv.T, W = this._tvWin(T), rows = this._tvRows(T), many = this.players.length >= 5;
    let O = null; if (!W) { try { const rg = this._tvRange(T); O = gameOdds(this); if (O) O = { b: O.get(rg.lo - 1), a: O.get(rg.hi) }; } catch (_) { O = null; } }
    const body = rows.map((r) => {
      const q = r.id, pre = W ? W.pre[q] : O?.b?.[q], post = W ? W.post[q] : O?.a?.[q], dl = pre != null && post != null ? post - pre : null;
      const decs = this._tvDecs(q, T, ds), checked = q === this._rvPid || this._rvReviewComplete(q), open = tv.open.has(q);
      const small = many && !open && dl != null && Math.abs(dl) < 0.03 && !decs.some((x) => x.gp);
      const sp = W && checked ? ` · <span class="${cl(W.luck[q])}">luck ${sg(W.luck[q])}</span> <span class="${cl(W.mv[q])}">moves ${sg(W.mv[q])}</span>` : W ? ` · <span class="${cl(W.luck[q])}">luck ${sg(W.luck[q])}</span> <span class="tv-nc">moves ~</span>` : "";
      const lo = dl == null ? 0 : Math.min(pre, post) * 100, hi = dl == null ? 0 : Math.abs(dl) * 100;
      const bar = dl == null ? "" : `<span class="tv-bar pc-${q}" aria-hidden="true"><i style="width:${lo}%"></i><u class="${dl >= 0 ? "up" : "dn"}" style="left:${lo}%;width:${hi}%"></u></span>`;
      const wtxt = dl == null ? "" : `<em>${checked ? "" : "~"}${pc(pre)} → ${pc(post)}%</em>`;
      const decHtml = open ? `<div class="tv-decs">${decs.length ? decs.map((x) => `<button type="button" class="tv-dec${q === this._rvPid && x.i === d.i ? " on" : ""}" data-tvd="${q}:${x.i}">${esc(tradeShow(x.x.label))}<i class="${x.gp ? "neg" : "pos"}">${x.same || !x.gp ? "best" : sg(-x.gap)}</i></button>`).join("") : `<p>${checked ? "No real choice this turn." : "Not checked yet: the win chance shown is the estimate (~)."}</p>`}</div>` : "";
      if (small) return `<li class="tv-row sm${checked ? "" : " nc"}"><button type="button" class="tv-h" data-tvr="${q}" aria-expanded="false"><b class="pc-${q}">${esc(this._rvNm(q))}</b><span>${esc(r.bits.join(" · ") || r.got || "nothing")}</span>${wtxt}</button></li>`;
      return `<li class="tv-row${open ? " open" : ""}${checked ? "" : " nc"}${q === this._rvPid ? " me" : ""}"><button type="button" class="tv-h" data-tvr="${q}" aria-expanded="${open}"><b class="pc-${q}">${esc(this._rvNm(q))}</b><span>${esc([r.got, ...r.bits].filter(Boolean).join(" · ") || "nothing")}</span>${wtxt}</button><div class="tv-s">${bar}<small>${sp.replace(/^ · /, "")}</small></div>${decHtml}</li>`;
    }).join("");
    return `<section class="tv" aria-label="This ${this._rvTW().toLowerCase()} for everyone"><p class="tv-eff">${this._tvSentence(T, W) || ""}</p><ul class="tv-rows">${body}</ul></section>`;
  },
  _tvBind(root, d, ds) {
    const turns = this._tvTurns(ds), me = this._rvPid, go = (i) => { this._tvKeep = false; this._rvDrawReview(i); };
    const toTurn = (i) => { this._tv = { pid: me, ov: true, open: new Set() }; this._tvKeep = true; try { this._rvDrawReview(i); } finally { this._tvKeep = false; } };
    root.querySelectorAll("[data-tvt]").forEach((b) => b.addEventListener("click", () => toTurn(+b.dataset.tvt)));
    root.querySelectorAll("[data-tvgo]").forEach((b) => b.addEventListener("click", () => this._tvStep(+b.dataset.tvgo, d, ds)));
    root.querySelectorAll("[data-tvkey]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.tvkey !== "") toTurn(+b.dataset.tvkey); }));
    root.querySelectorAll("[data-tvr]").forEach((b) => b.addEventListener("click", () => { const q = +b.dataset.tvr, o = this._tv.open; if (o.has(q)) o.delete(q); else o.add(q); this._tv.ov = !o.has(me); this._tvKeep = true; try { this._rvDrawReview(); } finally { this._tvKeep = false; } }));
    root.querySelectorAll("[data-tvd]").forEach((b) => b.addEventListener("click", () => { const [q, i] = b.dataset.tvd.split(":").map(Number); if (q === me) { this._tv.ov = false; this._tv.open.add(me); this._tv.i = i; this._tvKeep = true; try { this._rvDrawReview(i); } finally { this._tvKeep = false; } } else this._rvOpenReview(q, { near: i }); }));
  },
  /** A step of ±1 along the turns of the viewed player (buttons and swipe): lands on the turn overview (rows closed). */
  _tvStep(dir, d, ds) {
    const turns = this._tvTurns(ds), k = turns.findIndex((x) => x.T === this._tv?.T), n = turns[k + dir];
    if (!n) return;
    this._tv = { pid: this._rvPid, ov: true, open: new Set() }; this._tvKeep = true;
    try { this._rvDrawReview(n.d.i); } finally { this._tvKeep = false; }
  },
};
