// v1.31 Luck in win chance (page side). After your own review, every chance event of the game (each roll, each steal, each
// development card drawn) is replayed in the review's worker with every other outcome (src/review/luck-mc.js), one event at a
// time in the background, before the others' check; Stop holds it. Per player the sum over the game is their "luck in win-chance
// points" (+6% = the dice, steals and draws gave them 6 points more than was to be expected). Every event's numbers sum to 0 over
// the players. Kept with the review (R.luck: localStorage and the history entry), so it runs once per game.
// Seafarers (v1.31 with eng-130's recording): gold is part of a roll's outcome (the bots pick, as in the search), the pirate's steal
// is a steal; the leaf is the search's Seafarers leaf (src/master.js SEA_LEAF). A game recorded before v1.31 has no position before a bot's roll: its rolls start from
// that bot's End turn the turn before (played again), which is close but not exact (a pre-roll Knight is missed).
import { reviewRequest, reviewAvailable, SEA_LEAF } from "./master.js";
import { REVIEW, decide, totals } from "./review/evaluate.js";
import { luckEvents, LUCK_MC } from "./review/luck-mc.js";

/** Version of the numbers: results of another version or budget are computed again. */
/** v1.31 time limit: when the run would take longer than LITE_AFTER_S (measured over its first events, late events cost ~1.5x the
 *  early ones), the rest of the game gets the light budget (10 futures, at most 30). Measured against played-out truth: r 0.78 per
 *  event instead of 0.82, at about a third of the time. */
export const LITE = { futures: 15, maxFutures: 45 }, LITE_AFTER_S = 300; // v1.34 own luck (C) against played-out truth: 10 futures r 0.64, 25 r 0.76, 50 r 0.80
export const LUCK_ID = `v2c-f${LUCK_MC.futures}-${LUCK_MC.maxFutures}e${LUCK_MC.seMax}d${LUCK_MC.depth}s${LUCK_MC.seed}`;
const keyOf = (ev) => `${ev.kind}:${ev.s}:${ev.e}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hiddenTab = () => typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden");
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
/** "+6%", "−3%", "±0%" from a fraction (one decimal: dec 1). */
/** v1.31 design B (user's choice): a player's OWN luck is every roll (its whole effect), a steal by or from them, and their own card
 *  draws (Seafarers later: gold and the pirate's steal the same way). Another player's card draw, or a steal between two others, is
 *  that player's gamble: it counts with "Others" (step mode) and apart in the bookkeeping, not as your luck. */
export const ownOf = (ev, q) => ev.kind === "dice" || (ev.kind === "steal" && (ev.thief === q || ev.victim === q)) || (ev.kind === "dev" && ev.pid === q);
export const wpText = (v, dec = 0) => { const f = 10 ** dec, r = Math.round(v * 100 * f) / f; return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r).toFixed(dec)}%`; };

export const ReviewLuckMixin = {
  /** Why there is no luck in win chance for this game (null: there is). */
  _lkNa() {
    const R = this._rv;
    if (!R?.recs?.length || !this.stats?.steps?.length) return "not recorded";
    // a game recorded before the bots' moves (v1.29) has positions before your own rolls only: not enough to add up
    if (this._lkEvents().filter((e) => e.kind === "dice").length < 0.9 * this.stats.steps.length) return "not recorded";
    return null;
  },
  /** The game's chance events (cached per record count). */
  _lkEvents() {
    const R = this._rv;
    if (!R?.recs) return [];
    if (R._lkEv && R._lkEv.n === R.recs.length && R._lkEv.m === (this.stats?.ev?.length || 0)) return R._lkEv.list;
    let list = [];
    try { list = luckEvents(R.recs, this.stats, { rush: !!this.isRush?.() }); } catch (e) { console.warn("luck events", e); list = []; }
    Object.defineProperty(R, "_lkEv", { value: { n: R.recs.length, m: this.stats?.ev?.length || 0, list }, configurable: true, writable: true, enumerable: false });
    return list;
  },
  /** The stored results (reset when they come from another version). */
  _lkStore() {
    const R = this._rv;
    if (!R) return null;
    if (!R.luck || R.luck.id !== LUCK_ID) R.luck = { id: LUCK_ID, res: {} };
    return R.luck;
  },
  /** Where it stands: { na } or { n, j, done, run, stopped, tot: [per seat, fraction], cards: per seat, cover }. */
  _lkState() {
    const na = this._lkNa();
    if (na) return { na };
    const L = this._lkStore(), evs = this._lkEvents(), n = this.players.length;
    const tot = Array(n).fill(0);
    let j = 0, dice = 0, diceOk = 0;
    evs.forEach((ev) => {
      const r = L.res[keyOf(ev)];
      if (ev.kind === "dice") dice += 1;
      if (!r) return;
      j += 1;
      if (r.l) { r.l.forEach((x, q) => { if (ownOf(ev, q)) tot[q] += x; }); if (ev.kind === "dice") diceOk += 1; }
    });
    const rolls = this.stats.steps.length;
    return { n: evs.length, j, done: j >= evs.length, run: !!this._rv.lrun, stopped: !!L.stopped, tot, cover: rolls ? diceOk / rolls : 0, paused: !!this._rv.lrun?.paused };
  },
  /** Should the luck run now (after the people's own reviews, before the others' check)? */
  _lkWant() {
    const R = this._rv;
    if (!R || R.lrun || R.noLuck || !reviewAvailable() || this._lkNa()) return false; // (noLuck: the AI Lab's review of its own games)
    const L = this._lkStore();
    if (L.stopped) return false;
    return this._lkEvents().some((ev) => !L.res[keyOf(ev)]);
  },
  /** Run the events without a result, one at a time in the review's worker. */
  _lkRun() {
    const R = this._rv;
    if (!R || R.lrun) return R?.lrun?.promise || Promise.resolve();
    const L = this._lkStore(), id = R.id;
    L.stopped = false;
    const run = { stop: false, paused: false, j: 0, times: [], t0: now() };
    R.lrun = run;
    const live = () => this._rv === R && R.id === id && !run.stop;
    run.promise = (async () => {
      const todo = this._lkEvents().filter((ev) => !L.res[keyOf(ev)]);
      this._rvTick?.();
      for (const ev of todo) {
        while (live() && hiddenTab()) { if (!run.paused) { run.paused = true; this._rvTick?.(); } await sleep(400); }
        if (run.paused) { run.paused = false; this._rvTick?.(); }
        if (!live()) break;
        const t0 = now();
        const { i, ...plain } = ev; // the record goes along whole (its position)
        const m = await reviewRequest({ type: "luck", base: R.base, ev: plain, opts: { leaf: this.sea ? SEA_LEAF : REVIEW.budget.leaf || "gbm", ...this._lkBudget() } }, 120000);
        if (!live() && this._rv !== R) break;
        const x = m?.result;
        // l: luck per seat; b: the win chance before the event (the average over its outcomes), for the accounting start → end = luck + the rest
        const r4 = (v) => Math.round(v * 1e4) / 1e4;
        L.res[keyOf(ev)] = x && !x.skip && x.luck ? { k: ev.kind, s: ev.s, e: ev.e, l: x.luck, se: x.se, ...(x.cs ? { cs: x.cs, bt: x.bt, ox: x.ox } : {}), b: x.b || x.luck.map((_, q) => r4(x.groups.reduce((a, gr) => a + gr.p * (gr.v?.[q] ?? 0), 0))), F: x.F, g: x.groups.length } : { k: ev.kind, s: ev.s, e: ev.e, skip: x?.skip || "error" };
        run.j += 1; run.times.push(now() - t0);
        if (!L.lite && run.times.length >= 6) {
          const left = todo.length - run.j, per = run.times.reduce((a, b) => a + b, 0) / run.times.length;
          if ((per * left * 1.5) / 1000 + (now() - run.t0) / 1000 > LITE_AFTER_S) L.lite = true;
        }
        if (run.j % 10 === 0) this._rvSave?.();
        this._rvTick?.();
        if (run.stop) break;
      }
      if (this._rv === R) { R.lrun = null; this._rvSave?.(); this._rvTick?.(); }
    })();
    return run.promise;
  },
  /** The budget of the next event: the light one once the run chose it (L.lite, kept with the results). */
  _lkBudget() { return this._rv?.luck?.lite ? { ...LITE } : {}; },
  _lkStop() { const R = this._rv; if (!R?.lrun) return; R.lrun.stop = true; this._lkStore().stopped = true; R.lrun = null; this._rvSave?.(); this._rvTick?.(); },
  _lkGo() { const R = this._rv; if (!R) return; this._lkStore().stopped = false; if (!R.lrun && !R.run) this._rvQueueNext?.(); else if (!R.lrun) this._lkRun(); this._rvTick?.(); },

  /** One player's events with their effect (fraction) and the cards from that roll: [{ ev, x, w, cards, exp }], play order. */
  _lkList(pid) {
    const L = this._lkStore(), st = this._st, out = [];
    if (!L) return out;
    this._lkEvents().forEach((ev) => {
      const r = L.res[keyOf(ev)];
      if (!r?.l) return;
      let cards = null, exp = null, others = null, gold = 0;
      if (ev.kind === "dice" && st) {
        const s = ev.s + 1; cards = 0; others = 0;
        (st.stepEvents?.[s] || []).forEach((e) => { if (e[1] === "P") { if (e[2] === pid) { cards += e[5] || 1; if (this.geometry?.hexes?.[e[3]]?.resource === "gold") gold += e[5] || 1; } else others += e[5] || 1; } });
        exp = st.rollExp?.[s]?.[pid] ?? null;
      }
      out.push({ ev, w: r.l[pid] || 0, se: r.se?.[pid] ?? null, cards, exp, others, gold, own: ownOf(ev, pid), cs: r.cs?.[pid] ?? null, bt: r.bt?.[pid] ?? null, ox: r.ox?.[pid] ?? 0 });
    });
    return out;
  },
  /** What an event was, for one player's list: "Bert rolled 8", "You stole from Rosa", "Rosa drew a card". */
  _lkWhat(ev, pid) {
    const nm = (q) => (this._rvNm ? this._rvNm(q) : this.players[q]?.name || "Someone");
    const RN = ["Lumber", "Brick", "Wool", "Grain", "Ore"], DN = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "Victory Point" };
    if (ev.kind === "dice") return ev.rush ? `Rolled ${ev.roll}` : `${nm(ev.roller)} rolled ${ev.roll}`;
    if (ev.kind === "steal") { const pir = this.sea && this.geometry?.hexes?.[ev.hex]?.resource === "sea"; return `${nm(ev.thief)} ${pir ? "(pirate) " : ""}stole ${RN[ev.res] || "a card"} from ${nm(ev.victim).replace(/^You$/, "you")}`; }
    if (ev.kind === "dev") return `${nm(ev.pid)} drew ${/^[AEIOU]/.test(DN[ev.card] || "") ? "an" : "a"} ${DN[ev.card] || "card"}`;
    return "";
  },
  /** When: "T7" (Rush: "R7"; the roll number or the turn of the record). */
  _lkWhen(ev) {
    const st = this.stats?.steps?.[ev.s];
    if (this.isRush?.()) return `R${ev.kind === "dice" ? ev.s + 1 : ev.s}`;
    return `T${ev.kind === "dice" && st ? st[0] : ev.rec?.t ?? "?"}`;
  },
  /** The bookkeeping of one seat: its win chance before the first chance event, the end (1 won, 0 lost), the luck, and the rest
   *  (everybody's moves: a card bought by someone else is a risk taken by them, its draw is luck). start + luck + rest = end. */
  _lkBook(pid) {
    const L = this._lkStore(), ev = this._lkEvents().find((e) => L.res[keyOf(e)]?.b);
    if (!ev) return null;
    const start = L.res[keyOf(ev)].b[pid], end = this.winner ? (this.winner.id === pid ? 1 : 0) : null;
    if (end == null) return null;
    const all = this._lkList(pid), luck = all.reduce((a, x) => a + (x.own ? x.w : 0), 0);
    // v1.34 the user's split of own luck: the number of cards (above / below expected, at the mean win chance a card was worth to this
    // player this game) and the rest (which cards, and when: the same cards are worth more at one moment than at another)
    const dice = all.filter((x) => x.ev.kind === "dice" && x.cs != null), bts = dice.filter((x) => x.bt != null).map((x) => x.bt);
    const extra = dice.reduce((a, x) => a + x.cs, 0), perCard = bts.length ? bts.reduce((a, b) => a + b, 0) / bts.length : 0;
    const cards = extra * perCard, kind = luck - cards;
    // the others' luck on this player: their own cards from each roll (ox), their card draws and steals between two others
    const theirs = all.reduce((a, x) => a + (x.own ? 0 : x.w) + (x.ev.kind === "dice" ? x.ox : 0), 0);
    // this player's own moves, from their finished review (Your moves: what the choices gave away against the best ones)
    let moves = null;
    try { if (this._rvReviewComplete?.(pid)) { const rv = this._rvOf(pid); moves = totals(decide(rv.results.filter((x) => !x.skip || x.skip === "trivial"), this.players.length, pid)).moves / 100; } } catch (_) { moves = null; }
    const rest = end - start - luck - theirs - (moves || 0);
    const se = Math.sqrt(all.reduce((a, x) => a + (x.own ? (x.se || 0) ** 2 : 0), 0));
    return { start, end, luck, cards, kind, extra, perCard, theirs, moves, rest, se };
  },
  /** "Luck details" under the table: every chance event of one player, biggest first (or in play order), the total = the table's number. Folded by default. */
  _lkDetailsHtml(LK = this._lkState()) {
    if (LK.na || !LK.done || LK.cover < 0.9) return "";
    const U = (this._lkUi ||= { open: false, pid: null, sort: "size", all: false });
    const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    if (U.pid == null || !this.players[U.pid]) U.pid = this._rvPid ?? this.players.find((p) => p.isHuman)?.id ?? 0;
    const pid = U.pid, list = this._lkList(pid).filter((x) => x.own);
    const rows = U.sort === "size" ? list.slice().sort((a, b) => Math.abs(b.w) - Math.abs(a.w) || a.ev.e - b.ev.e) : list;
    const shown = U.all ? rows : rows.slice(0, 12);
    const tot = list.reduce((a, x) => a + x.w, 0), se = Math.sqrt(list.reduce((a, x) => a + (x.se || 0) ** 2, 0));
    const cls = (v) => (Math.round(v * 1000) > 0 ? "pos" : Math.round(v * 1000) < 0 ? "neg" : "");
    const you = this._rvIsYou ? this._rvIsYou(pid) : false;
    const sub = (x) => (x.cards != null ? (x.ev.roll === 7 ? "the robber moves, big hands are halved" : `${x.cards} ${x.cards === 1 ? "card" : "cards"}${x.gold ? ` (${x.gold} gold)` : ""}${x.exp != null ? `, ${x.exp.toFixed(1)} expected` : ""} · others ${x.others}`) : { steal: "a random card from the hand", dev: "a random card from the deck" }[x.ev.kind] || "");
    const seg = this.players.map((p) => `<button type="button" class="pc-${p.id}${p.id === pid ? " on" : ""}" data-rvlkp="${p.id}" aria-pressed="${p.id === pid}">${this._av ? this._av(p, "rt-av") : ""}<span>${this._rvNm ? this._rvNm(p.id) : esc(p.name)}</span></button>`).join("");
    const kinds = { dice: 0, steal: 0, dev: 0 }; list.forEach((x) => { kinds[x.ev.kind] += 1; });
    return `<details class="rt-lkd" data-rvlkd${U.open ? " open" : ""}><summary><span>Luck details</span><small>every roll, steal and card draw</small></summary>
      <div class="lkd-seg" role="group" aria-label="Whose luck">${seg}</div>
      <div class="lkd-sort" role="group" aria-label="Order"><button type="button" data-rvlks="size" class="${U.sort === "size" ? "on" : ""}">Biggest first</button><button type="button" data-rvlks="time" class="${U.sort === "time" ? "on" : ""}">In order</button></div>
      <ol class="lkd-list">${shown.map((x) => `<li><span class="t">${esc(this._lkWhen(x.ev))}</span><span class="x">${esc(this._lkWhat(x.ev, pid))}<small>${sub(x)}</small></span><b class="${cls(x.w)}">${wpText(x.w, 1)}</b></li>`).join("")}</ol>
      ${rows.length > shown.length ? `<button type="button" class="rv-btn lkd-all" data-rvlka>Show all ${rows.length}</button>` : ""}
      <p class="lkd-tot"><span>Total · ${kinds.dice} rolls, ${kinds.steal} steals, ${kinds.dev} card draws</span><b class="${cls(tot)}">${wpText(tot, 1)}</b></p>
      ${this._lkWaterHtml(pid, you)}</details>`;
  },
  /** The two sides of own luck in a sentence, then the whole story of the win chance as a small waterfall: start → own luck (cards,
   *  which/when) → the others' luck → own moves → the rest (the others' moves, and what the estimates cannot tell apart) → end. */
  _lkWaterHtml(pid, you) {
    const B = this._lkBook(pid);
    if (!B) return "";
    const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const nm = you ? "You" : esc(this.players[pid].name), n = Math.round(B.extra), m = Math.abs(n);
    const cardsTxt = n ? `${nm} got ${m} ${m === 1 ? "card" : "cards"} ${n > 0 ? "more" : "fewer"} than expected (${wpText(B.cards)})` : `${nm} got about the cards expected (${wpText(B.cards)})`;
    const k = Math.round(B.kind * 100), kindTxt = k > 0 ? "the right ones at the right moment" : k < 0 ? "the wrong ones or at the wrong moment" : "neither the right nor the wrong ones";
    const join = (Math.round(B.cards * 100) >= 0) === (k >= 0) || !k ? "and" : "but";
    const say = `<p class="lkd-say">${cardsTxt}, ${join} ${kindTxt} (${wpText(B.kind)}).</p>`;
    const steps = [
      ["Number of cards", B.cards], ["Which cards, when", B.kind], ["Others' luck", B.theirs],
      [you ? "Your moves" : "Own moves", B.moves], ["Others' moves, rest", B.rest],
    ];
    const X = (v) => Math.max(0, Math.min(100, v * 100));
    let at = B.start;
    const row = (label, v) => {
      if (v == null) return `<div class="lkw-r na"><span>${label}</span><i class="tr"></i><b>not checked</b></div>`;
      const a = at, b = at + v; at = b;
      const lo = X(Math.min(a, b)), hi = X(Math.max(a, b)), c = Math.round(v * 100) > 0 ? "pos" : Math.round(v * 100) < 0 ? "neg" : "";
      return `<div class="lkw-r"><span>${label}</span><i class="tr"><i class="${c}" style="left:${lo.toFixed(1)}%;width:${Math.max(0.8, hi - lo).toFixed(1)}%"></i></i><b class="${c}">${wpText(v)}</b></div>`;
    };
    const ends = (label, v, cls) => `<div class="lkw-r end ${cls}"><span>${label}</span><i class="tr"><i style="left:0;width:${X(v).toFixed(1)}%"></i></i><b>${Math.round(v * 100)}%</b></div>`;
    return `${say}<div class="lkw" role="img" aria-label="${esc(`${nm} win chance: ${Math.round(B.start * 100)}% at the first roll, ${B.end ? "won" : "lost"} at the end`)}">${ends("First roll", B.start, "st")}${steps.map(([l, v]) => row(l, v)).join("")}${ends(B.end ? "Won" : "Lost", B.end, "en")}</div>`;
  },
  _lkBindDetails(root) {
    const d = root.querySelector("[data-rvlkd]");
    if (!d) return;
    const U = (this._lkUi ||= { open: false, pid: null, sort: "size", all: false });
    const redraw = () => { const n = document.createElement("div"); n.innerHTML = this._lkDetailsHtml(); const x = n.firstElementChild; if (x) { d.replaceWith(x); this._lkBindDetails(root); } };
    d.addEventListener("toggle", () => { U.open = d.open; });
    d.querySelector("summary")?.addEventListener("click", () => { U.open = !d.open; }); // (a table refresh between the tap and the toggle keeps it open)
    d.querySelectorAll("[data-rvlkp]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); U.pid = +b.dataset.rvlkp; U.all = false; redraw(); }));
    d.querySelectorAll("[data-rvlks]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); U.sort = b.dataset.rvlks; redraw(); }));
    d.querySelector("[data-rvlka]")?.addEventListener("click", (e) => { e.preventDefault(); U.all = true; redraw(); });
  },
  /** The luck terms between two decisions of a seat (event index from ≤ e < to): { sum, list } for seat pid. */
  _lkBetween(pid, from, to) {
    const L = this._lkStore(), list = [], theirs = [];
    let sum = 0, missing = 0;
    if (!L || this._lkNa()) return null;
    this._lkEvents().forEach((ev) => {
      if (ev.e < from || ev.e >= to) return;
      const r = L.res[keyOf(ev)];
      if (!r) { missing += 1; return; }
      if (!r.l) return;
      if (ownOf(ev, pid)) { sum += r.l[pid] || 0; list.push({ ev, w: r.l[pid] || 0 }); } else theirs.push({ ev, w: r.l[pid] || 0 });
    });
    return { sum, list, theirs, missing };
  },
};
