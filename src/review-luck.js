// v1.31 Luck in win chance (page side). After your own review, every chance event of the game (each roll, each steal, each
// development card drawn) is replayed in the review's worker with every other outcome (src/review/luck-mc.js), one event at a
// time in the background, before the others' check; Stop holds it. Per player the sum over the game is their "luck in win-chance
// points" (+6% = the dice, steals and draws gave them 6 points more than was to be expected). Every event's numbers sum to 0 over
// the players. Kept with the review (R.luck: localStorage and the history entry), so it runs once per game.
// Not for Seafarers yet (no recording there). A game recorded before v1.31 has no position before a bot's roll: its rolls start from
// that bot's End turn the turn before (played again), which is close but not exact (a pre-roll Knight is missed).
import { reviewRequest, reviewAvailable } from "./master.js";
import { luckEvents, LUCK_MC } from "./review/luck-mc.js";

/** Version of the numbers: results of another version or budget are computed again. */
export const LUCK_ID = `v1f${LUCK_MC.futures}-${LUCK_MC.maxFutures}e${LUCK_MC.seMax}d${LUCK_MC.depth}s${LUCK_MC.seed}`;
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
    if (this.sea || this._st?.sea) return "not for Seafarers yet";
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
    if (!R || R.lrun || !reviewAvailable() || this._lkNa()) return false;
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
    const run = { stop: false, paused: false, j: 0, times: [] };
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
        const m = await reviewRequest({ type: "luck", base: R.base, ev: plain }, 60000);
        if (!live() && this._rv !== R) break;
        const x = m?.result;
        // l: luck per seat; b: the win chance before the event (the average over its outcomes), for the accounting start → end = luck + the rest
        const r4 = (v) => Math.round(v * 1e4) / 1e4;
        L.res[keyOf(ev)] = x && !x.skip && x.luck ? { k: ev.kind, s: ev.s, e: ev.e, l: x.luck, se: x.se, b: x.luck.map((_, q) => r4(x.groups.reduce((a, gr) => a + gr.p * (gr.v?.[q] ?? 0), 0))), F: x.F, g: x.groups.length } : { k: ev.kind, s: ev.s, e: ev.e, skip: x?.skip || "error" };
        run.j += 1; run.times.push(now() - t0);
        if (run.j % 10 === 0) this._rvSave?.();
        this._rvTick?.();
        if (run.stop) break;
      }
      if (this._rv === R) { R.lrun = null; this._rvSave?.(); this._rvTick?.(); }
    })();
    return run.promise;
  },
  _lkStop() { const R = this._rv; if (!R?.lrun) return; R.lrun.stop = true; this._lkStore().stopped = true; R.lrun = null; this._rvSave?.(); this._rvTick?.(); },
  _lkGo() { const R = this._rv; if (!R) return; this._lkStore().stopped = false; if (!R.lrun && !R.run) this._rvQueueNext?.(); else if (!R.lrun) this._lkRun(); this._rvTick?.(); },

  /** One player's events with their effect (fraction) and the cards from that roll: [{ ev, x, w, cards, exp }], play order. */
  _lkList(pid) {
    const L = this._lkStore(), st = this._st, out = [];
    if (!L) return out;
    this._lkEvents().forEach((ev) => {
      const r = L.res[keyOf(ev)];
      if (!r?.l) return;
      let cards = null, exp = null, others = null;
      if (ev.kind === "dice" && st) {
        const s = ev.s + 1; cards = 0; others = 0;
        (st.stepEvents?.[s] || []).forEach((e) => { if (e[1] === "P") { if (e[2] === pid) cards += e[5] || 1; else others += e[5] || 1; } });
        exp = st.rollExp?.[s]?.[pid] ?? null;
      }
      out.push({ ev, w: r.l[pid] || 0, se: r.se?.[pid] ?? null, cards, exp, others, own: ownOf(ev, pid) });
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
    const all = this._lkList(pid), luck = all.reduce((a, x) => a + (x.own ? x.w : 0), 0), theirs = all.reduce((a, x) => a + (x.own ? 0 : x.w), 0);
    return { start, end, luck, theirs, rest: end - start - luck - theirs };
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
    const sub = (x) => (x.cards != null ? (x.ev.roll === 7 ? "the robber moves, big hands are halved" : `${x.cards} ${x.cards === 1 ? "card" : "cards"}${x.exp != null ? `, ${x.exp.toFixed(1)} expected` : ""} · others ${x.others}`) : { steal: "a random card from the hand", dev: "a random card from the deck" }[x.ev.kind] || "");
    const seg = this.players.map((p) => `<button type="button" class="pc-${p.id}${p.id === pid ? " on" : ""}" data-rvlkp="${p.id}" aria-pressed="${p.id === pid}">${this._av ? this._av(p, "rt-av") : ""}<span>${this._rvNm ? this._rvNm(p.id) : esc(p.name)}</span></button>`).join("");
    const kinds = { dice: 0, steal: 0, dev: 0 }; list.forEach((x) => { kinds[x.ev.kind] += 1; });
    return `<details class="rt-lkd" data-rvlkd${U.open ? " open" : ""}><summary><span>Luck details</span><small>every roll, steal and card draw</small></summary>
      <div class="lkd-seg" role="group" aria-label="Whose luck">${seg}</div>
      <div class="lkd-sort" role="group" aria-label="Order"><button type="button" data-rvlks="size" class="${U.sort === "size" ? "on" : ""}">Biggest first</button><button type="button" data-rvlks="time" class="${U.sort === "time" ? "on" : ""}">In order</button></div>
      <ol class="lkd-list">${shown.map((x) => `<li><span class="t">${esc(this._lkWhen(x.ev))}</span><span class="x">${esc(this._lkWhat(x.ev, pid))}<small>${sub(x)}</small></span><b class="${cls(x.w)}">${wpText(x.w, 1)}</b></li>`).join("")}</ol>
      ${rows.length > shown.length ? `<button type="button" class="rv-btn lkd-all" data-rvlka>Show all ${rows.length}</button>` : ""}
      <p class="lkd-tot"><span>Total · ${kinds.dice} rolls, ${kinds.steal} steals, ${kinds.dev} card draws</span><b class="${cls(tot)}">${wpText(tot, 1)}</b></p>
      ${(() => { const B = this._lkBook(pid); if (!B) return ""; const pc = (v) => `${Math.round(v * 100)}%`;
        return `<p class="lkd-book"><b>${you ? "Your" : `${esc(this.players[pid].name)}’s`} win chance</b>: ${pc(B.start)} at the first roll, ${B.end ? "won" : "lost"} at the end (${wpText(B.end - B.start)}) = own luck ${wpText(B.luck)} + the others’ gambles ${wpText(B.theirs)} + moves ${wpText(B.rest)}. Own luck: every roll, steals by or from ${you ? "you" : "them"}, ${you ? "your" : "their"} own card draws. The others’ gambles: what their card draws (and steals between two others) did to ${you ? "you" : "them"}: a card someone buys could be the winning Victory Point. Moves: everyone’s choices.</p>`; })()}
      <p class="lkd-note">Each line: ${you ? "your" : "their"} win chance right after what happened, against the average over everything that could have happened (each outcome as likely as it was). ±0 is as expected. Measured by replaying the game ${LUCK_MC.futures} times ${LUCK_MC.depth} turns ahead after every outcome: the total is good to about ±${Math.max(0.1, Math.round(se * 1000) / 10)} points.</p></details>`;
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
