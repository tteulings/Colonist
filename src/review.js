// v1.02 Post-game review, part 1: the decision recorder (page side).
//
// While a person plays a Classic game (not Rush, not Seafarers), every decision they take is noted with a
// compact copy of the position just before it: the start of each turn (before the roll), each build, set-up
// settlement, bank / player trade, development card bought or played, robber tile, discard, and End turn.
// A record: { k, pid, t (turn), s (stats step = replay step), e (stats event count), ts (turnSerial),
//   st (serializeState() as JSON, without stats / log / the board layout), trk (the public card tracker or
//   null), a (what was done) }. The board layout (tiles, harbours, settings) is kept once per game.
//
// The recorder only reads the game: it never calls Math.random, never creates the card tracker and changes
// nothing a bot reads, so bot moves stay identical (move-log hash). It runs only when a person is at the
// table. Only the last game is kept (localStorage, written at each End turn and at game over).
//
// After the game the records go to the Master Web Worker (src/master/worker.js), which runs the detectors
// in src/review/detect.js on its private headless engine; the end screen never waits for them.
import { masterRequest, masterAvailable, reviewRequest } from "./master.js";
import { REVIEW_ENGINE, REVIEW, FMT, needsFull, rescoreReview, liftReview } from "./review/evaluate.js";
import { packRecs, unpackRecs } from "./review/pack.js";

const KEY = "colonist_review_v1";
// v1.29 The others at the table (the bots; in pass & play after every person): checked after your own review, one at a time,
// in the background. `stage` of a run: "quick" = the quick round only; "top" = the deep round for their TOP biggest moments
// (by the quick round's gap); null = everything deep (yours, or a bot whose review you open). See OTHERS_DEEP.
// v1.29 default "all": after everyone's quick round, each bot's deep round in turn (biggest moments first). A bot's accuracy is shown
// only from the deep round: the quick round's numbers are on another scale (8-turn look-ahead, older score function) and the bots'
// bands (bands.js) were measured with the deep check. "top" (quick + the deep check of each bot's `top` biggest moments) is the lighter option.
// v1.29 policy "real" (the default): a bot's deep round covers only the moves its quick round found to be a real choice (not every option
// within 2 points); the rest keep their quick result, which has no accuracy anyway. Measured on 16 bots (409 decisions, scratchpad
// others129/tests budget-an.mjs) against every move deep: accuracy 1.1 points apart on average, 5 at most, in 57% of the time.
// Fewer futures a move were tried too (40 a move on the real choices: 3.2 apart, at most 11.7; 40 on all: 4.5, at most 18.6).
export const OTHERS = { deep: "all", top: 6, minLoss: 0.02, policy: "real", engine: REVIEW_ENGINE };
const RES5 = ["wood", "brick", "sheep", "wheat", "ore"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hiddenTab = () => typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden");
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export const ReviewMixin = {
  /** Is anything recorded in this game? (a person plays, Classic island, not the lab / a replay) */
  _rvOn() {
    return !this._rvOff && !this.labMode && !this._replay && !!this.stats && !this.sea
      && !!this.players?.some((p) => p.isHuman) && !this.winner;
  },
  /** The review covers this kind of game at all (the end screen shows nothing otherwise). v1.17: Classic and Rush, 2–6 players. */
  _rvCovered() { return !this.sea; },
  /** "Turn", or "Roll" in Rush (a Rush record's t is the roll number). */
  _rvTW() { return this.isRush?.() ? "Roll" : "Turn"; },

  _rvReset(id = this.stats?.id) { if (this._rv?.run) this._rv.run.stop = true; if (this._rv?.lrun) this._rv.lrun.stop = true; this._rvListener = null; this._rvFor = null; this._rv = { id: id || null, base: null, recs: [], res: null, busy: false, ms: 0, revs: {}, queue: [], bots: !this._rvNoBots }; },
  /** v1.12: one review per person (pass & play: each human has their own; solo: just the one). */
  _rvOf(pid) { return this._rv?.revs?.[pid] || null; },
  /** The review a one-person view reads first: a person's (the bots' reviews come after). */
  _rvMine(revs) { const v = Object.values(revs || {}); return v.find((r) => this.players?.[r.pid]?.isHuman) || v[0] || null; },
  /** Every person's review with results (what gets saved). */
  _rvAll(R = this._rv) { const r = R?.revs || {}; return Object.fromEntries(Object.entries(r).filter(([, v]) => v?.results?.length)); },

  /** v1.29 The bots' decisions are recorded too (the review then checks everyone at the table, after your own moves).
   *  Only real choices: set-up settlement, a paid build, bank / harbour trades, a development card bought or played,
   *  the robber tile and End turn (not the free roads, rolls, discards or player trades). Read-only like the rest. */
  _rvBotOn(player) {
    if (!player || player.isHuman || this._rvNoBots || !this._rvOn()) return false;
    if (this._rv && this._rv.id === this.stats.id && !this._rv.bots) return false; // a game recorded before v1.29 stays as it was
    if (!this.isRush?.() && this.currentPlayer !== player) return false; // its own turn only (Rush: anyone, any time)
    return true;
  },
  /** The position before a decision. */
  _rvPre(player, bot = false) {
    if (!this._rvOn() || !player || (player.isHuman ? bot : !bot || !this._rvBotOn(player))) return null;
    if (this.phase === "sbp") return null; // 5–6 players: moves in the build window between turns are not checked (it is nobody's turn there)
    if (!this._rv || this._rv.id !== this.stats.id) this._rvReset();
    const t0 = now();
    try {
      this._stSync?.();
      const s = this.serializeState();
      if (!this._rv.base) this._rv.base = { hexes: s.hexes, ports: s.ports, settings: s.settings };
      s.hexes = s.ports = s.settings = s.stats = s.logEntries = undefined;
      if (s.rush) s.rush = null; // Rush: the clock, offers and Ready votes are not part of a position (the search plays it turn by turn)
      const trk = this._aiCardTrack?.players === this.players ? this._aiCardTrack.est.map((e) => ({ ...e })) : null;
      const pre = { pid: player.id, t: this.turn, s: this.stats.steps.length, e: this.stats.ev.length, ts: this.rush ? this.rush.rollNo : this.turnSerial, st: JSON.stringify(s), trk };
      const dt = now() - t0;
      this._rv.ms += dt;
      if (!player.isHuman) { this._rv.botMs = (this._rv.botMs || 0) + dt; (this._rv.botT ||= []).push(Math.round(dt * 1000) / 1000); } // (measured, never saved)
      return pre;
    } catch (_) { return null; }
  },

  _rvPush(pre, k, a = {}) {
    if (!pre || !this._rv) return;
    this._rv.recs.push({ k, ...pre, a });
    this._rv.res = null;
  },

  /** The last game's records (this game: in memory; after a reload: from storage if it is the same game). */
  _rvLoad() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.recs)) return null;
      let out = null;
      if (d.v === 1) out = { ...d, reviews: d.review?.results?.length ? { [d.review.pid]: d.review } : {} }; // v1.02-1.11 saves: one review
      else if (d.v === 2) out = { ...d, reviews: d.reviews || {} };
      else if (d.v === 3) out = { ...d, recs: unpackRecs(d.recs), reviews: d.reviews || {} }; // v1.29: packed records, the bots' decisions too (bots: 1)
      if (out) Object.values(out.reviews).forEach((rv) => rescoreReview(rv)); // v1.21 a saved review gets today's numbers, classes and labels (from its own candidates, no engine)
      return out;
    } catch (_) { return null; }
  },
  _rvSave() {
    const R = this._rv;
    if (!R || !R.id || !R.recs.length) return 0;
    try {
      const json = JSON.stringify({ v: 3, id: R.id, base: R.base, recs: packRecs(R.recs), reviews: this._rvAll(), bots: R.bots ? 1 : 0, ...(R.luck ? { luck: R.luck } : {}) }); // v1.31 luck in win chance: an extra field (older versions ignore it) // v1.04: a check made during the game is kept too; v1.12: one review per person; v1.29 packed, with the bots
      localStorage.setItem(KEY, json);
      R.bytes = json.length;
      return json.length;
    } catch (_) { return 0; }
  },

  /** Records grouped for the worker (the layout merged back in there). */
  _rvPayload(recs = this._rv?.recs || []) { return { base: this._rv?.base, recs }; },

  /** The decisions of one person the review checks (record index i). */
  _rvTodo(pid) {
    const KINDS = ["setup", "build", "bank", "buy", "play", "robber", "end"];
    return (this._rv?.recs || []).map((r, i) => [r, i]).filter(([r]) => r.pid === pid && KINDS.includes(r.k) && !(r.k === "build" && r.a?.free));
  },
  /** A result that still needs the deep (full) engine: it comes from the quick round (m100) and is a real choice. */
  _rvNeedsFull(x) { return needsFull(x); }, // v1.10: a result from the old score function counts as provisional
  /** Every decision of this person so far has a quick or deep result. */
  _rvCovered1(pid) {
    const rv = this._rvOf(pid);
    return !!rv && this._rvTodo(pid).every(([, i]) => rv.results.some((x) => x.i === i));
  },
  /** Every decision has its deep (full) result: nothing provisional is left. */
  _rvReviewComplete(pid) {
    const rv = this._rvOf(pid), bot = this._rvBotSeat(pid);
    return !!rv && this._rvTodo(pid).every(([, i]) => { const x = rv.results.find((y) => y.i === i); return !!x && (!this._rvNeedsFull(x) || (bot && this._rvQuickDone(x))); });
  },
  /** v1.29 A bot's seat is checked by OTHERS' policy: what the quick round found to be no real choice stays a quick result. */
  _rvBotSeat(pid) { return OTHERS.policy === "real" && !!this.players?.[pid] && !this.players[pid].isHuman; },
  _rvQuickDone(x) { return x.eng === "m100" && !x.err && (x.trivial || x.skip === "trivial"); },
  /** Order of the deep round: where the quick round found the largest loss, then the smallest gap between the two best moves. */
  _rvDeepOrder(rv, items) {
    const key = (i) => {
      const x = rv.results.find((y) => y.i === i);
      if (!x || x.skip === "error") return [0, 0];
      const w = (x.cands || []).map((c) => c.win).filter((v) => v != null).sort((p, q) => q - p);
      const gap = w.length > 1 ? w[0] - w[1] : 1;
      return (x.loss || 0) >= 0.025 ? [1, -(x.loss || 0)] : [2, x.trivial ? 1 + gap : gap];
    };
    return items.map((it) => ({ it, k: key(it[1]) })).sort((p, q) => p.k[0] - q.k[0] || p.k[1] - q.k[1] || p.it[1] - q.it[1]).map((o) => o.it);
  },
  _rvStop() {
    const R = this._rv, run = R?.run;
    if (!run) return;
    run.stop = true; R.run = null;
    if (R.revs[run.pid]) R.revs[run.pid].stopped = true;
    if (!this.players[run.pid]?.isHuman) { R.othersOff = true; R.queue = (R.queue || []).filter((q) => q?.pid == null && this.players[q]?.isHuman); } // Stop on a bot: the others wait for Continue
    this._rvSave(); this._rvTick();
  },
  /** v1.29 The bots with recorded decisions (a game recorded before v1.29 has none: "not recorded"). */
  _rvOthers() { return this._rv?.bots ? this.players.filter((p) => !p.isHuman && this._rvTodo(p.id).length) : []; },
  /** The plan for the others: everyone's quick round first (a ranking at once), then the deep round per OTHERS.deep. */
  _rvOthersPlan() {
    const bots = this._rvOthers(), out = [];
    bots.forEach((p) => { if (this._rv.revs[p.id]) this._rv.revs[p.id].stopped = false; }); // a Stop holds for this sitting; opened again, they go on where they were
    bots.forEach((p) => { if (!this._rvCovered1(p.id)) out.push({ pid: p.id, stage: "quick" }); });
    bots.forEach((p) => { if (!this._rvReviewComplete(p.id) && !(OTHERS.deep === "top" && this._rv.revs[p.id]?.top)) out.push({ pid: p.id, stage: OTHERS.deep === "top" ? "top" : "deep" }); });
    return out;
  },
  /** Continue the others after a Stop. */
  _rvOthersGo() {
    const R = this._rv;
    if (!R) return;
    R.othersOff = false; R.othersPlanned = false;
    this._rvOthers().forEach((p) => { if (R.revs[p.id]) R.revs[p.id].stopped = false; });
    R.queue = (R.queue || []).filter((q) => q?.pid == null);
    if (R.run) { R.othersPlanned = true; R.queue.push(...this._rvOthersPlan()); this._rvTick(); return; }
    this._rvQueueNext();
  },
  /** Is this seat waiting in the queue? */
  _rvQueued(pid) { return (this._rv?.queue || []).some((q) => (q?.pid ?? q) === pid); },

  /** v1.04 Game review in rounds. After a game (auto, or the button): round 1 is quick (m100 engine, ~0.5 s a
   *  decision) so a provisional review is on screen at once; round 2 deepens every real choice with the full
   *  engine, the biggest losses / closest calls first. `mid` (Check my moves so far): one full round over the
   *  moves so far. Runs in the review's own worker (src/master.js reviewRequest). Already-full results (from a
   *  check during the game) are kept; quick results are replaced one by one. A hidden tab pauses it; on a
   *  machine with ≤ 4 cores a mid-game check also waits while a Master bot is searching. Results are saved. */
  _rvReviewRun(pid, onStep, { mid = false, stage = null } = {}) {
    const R = this._rv;
    if (!R) return Promise.resolve(null);
    if (onStep) this._rvListener = onStep;
    if (R.run && R.run.pid === pid) { if (!stage && R.run.stage) R.run.full = true; return R.run.promise; } // a bot's quick look you open: it goes on to the deep round
    // one check at a time (it is heavy): another person's check waits its turn
    if (R.run) { R.queue = [pid, ...(R.queue || []).filter((x) => (x?.pid ?? x) !== pid)]; return R.run.promise.then(() => this._rvReviewRun(pid, onStep, { mid })); }
    const todo = this._rvTodo(pid);
    const rv = R.revs[pid] || { pid, results: [] };
    if (!rv.results.length) rv.fmt = FMT; // v1.21 numbers of this format (a saved older review was re-scored when it was loaded)
    R.revs[pid] = rv;
    if (this.players[pid]?.isHuman) R.review = rv; // the one last touched (history of a one-person game reads it; a person's, never a bot's)
    rv.total = todo.length;
    rv.stopped = false;
    if (mid) { rv.midCheck = true; rv.upto = this.turn; }
    if (this._rvReviewComplete(pid)) { rv.done = true; if (!mid) setTimeout(() => { if (this._rv === R) this._rvQueueNext(); }, 0); return Promise.resolve(rv); }
    rv.done = false;
    const id = R.id, run = { pid, mid, stage, stop: false, round: null, times: [], paused: false };
    R.run = run;
    const few = (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4) <= 4;
    const live = () => this._rv === R && R.id === id;
    const gate = async () => {
      for (;;) {
        const hid = hiddenTab(), wait = hid || (mid && few && this._masterBusy && !this.winner);
        if (run.paused !== hid) { run.paused = hid; this._rvTick(); }
        if (!wait || run.stop || !live()) return;
        await sleep(hid ? 400 : 150);
      }
    };
    const onVis = () => { const hid = hiddenTab(); if (run.paused !== hid) { run.paused = hid; this._rvTick(); } };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    const round = async (eng, items) => {
      run.round = { eng, j: 0, n: items.length };
      run.times = [];
      this._rvTick();
      for (const [rec, i] of items) {
        if (run.stop || !live()) return;
        await gate();
        if (run.stop || !live()) return;
        const t0 = now();
        const m = await reviewRequest({ type: "evaluate", base: R.base, rec, opts: eng === REVIEW_ENGINE ? {} : { engine: eng } }, 40000);
        if (!live()) return;
        const k = rv.results.findIndex((x) => x.i === i);
        let r = m?.result ? { ...m.result, i } : null;
        if (!r) r = k >= 0 ? { ...rv.results[k], eng: REVIEW_ENGINE, err: true } : { k: rec.k, pid, t: rec.t, s: rec.s, e: rec.e, i, skip: "error", eng };
        if (k >= 0) rv.results[k] = r; else rv.results.push(r);
        liftReview(rv); // v1.29 the same-step lift: one class per decision on every screen (score.js liftSameStep)
        run.times.push(now() - t0);
        run.round.j += 1;
        if (run.round.j % (this.players[pid]?.isHuman ? 6 : 12) === 0) this._rvSave(); // a reload keeps what is checked (a bot's: every 12)
        this._rvTick();
      }
    };
    run.promise = (async () => {
      try {
        const has = (i) => rv.results.some((x) => x.i === i);
        if (mid) {
          await round(REVIEW_ENGINE, todo.filter(([, i]) => { const x = rv.results.find((y) => y.i === i); return !x || this._rvNeedsFull(x); }));
        } else {
          const quick = todo.filter(([, i]) => !has(i));
          if (quick.length) await round("m100", quick);
          // the deep round; a bot's (stage "top"): only its biggest moments of the quick round, unless you opened its review meanwhile (run.full)
          for (let pass = 0; pass < 2 && !run.stop && live(); pass += 1) {
            if (run.stage === "quick" && !run.full) break; // ("deep": everything, like yours)
            const bot = this._rvBotSeat(pid);
            let deep = this._rvDeepOrder(rv, todo.filter(([, i]) => { const x = rv.results.find((y) => y.i === i); return x && this._rvNeedsFull(x) && !(bot && this._rvQuickDone(x)); }));
            const top = run.stage === "top" && !run.full;
            if (top) deep = deep.filter(([, i]) => (rv.results.find((y) => y.i === i)?.loss || 0) >= OTHERS.minLoss).slice(0, Math.max(0, OTHERS.top - (rv.topN || 0)));
            if (deep.length) await round(bot ? OTHERS.engine : REVIEW_ENGINE, deep); // a bot: the lighter deep engine (OTHERS)
            if (top && !run.stop && live()) { rv.top = true; rv.topN = (rv.topN || 0) + deep.length; }
            if (!run.full || this._rvReviewComplete(pid)) break;
          }
        }
      } catch (e) { console.warn("review run", e); }
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
      if (live()) { rv.done = !run.stop && this._rvReviewComplete(pid); if (R.run === run) R.run = null; this._rvSave(); if (rv.done && this.players[pid]?.isHuman) this._rvLogGame?.(pid); this._rvTick(); if (live() && !run.stop && !mid) this._rvQueueNext(); }
      return rv;
    })();
    return run.promise;
  },
  /** Pass & play: when one person's check is done the next person's starts by itself (seat order). */
  _rvQueueNext() {
    const R = this._rv;
    if (!R || R.run || R.lrun || !this.winner) return;
    // v1.31 luck in win chance: after every person's own review, before the others' check (src/review-luck.js)
    if (!(R.queue || []).some((q) => q?.pid == null && this.players[q]?.isHuman) && this._lkWant?.()) { this._lkRun().then(() => { if (this._rv === R) this._rvQueueNext(); }); return; }
    // v1.29 when every person is done (or waits): the others, one at a time
    if (!R.queue?.length && !R.othersPlanned && !R.othersOff) { R.othersPlanned = true; R.queue = this._rvOthersPlan(); }
    while (R.queue?.length) {
      const q = R.queue.shift(), pid = q?.pid ?? q, stage = q?.stage ?? null;
      if (this._rvReviewComplete(pid) || !this._rvTodo(pid).length || R.revs[pid]?.stopped) continue;
      if (q?.pid != null && (R.othersOff || (stage === "quick" && this._rvCovered1(pid)) || (stage === "top" && R.revs[pid]?.top))) continue;
      this._rvReviewRun(pid, this._rvListener, { stage }).then((rv) => { if (this._rv === R && rv?.done && this.players[pid]?.isHuman) this._rvRender?.(); }); // (a bot's progress patches the table only: the end screen is not redrawn under your finger)
      return;
    }
    this._rvTick();
  },
  /** Something changed in the running review: the open screen and the end screen's button follow. */
  _rvTick() {
    try { this._rvListener?.(this._rv?.revs?.[this._rvPid] ?? this._rv?.review); this._rvPatchRows?.(); } catch (e) { console.warn("review tick", e); }
  },

  /** Game over: save, then run the detectors in the worker (once per game). */
  _rvFinish(auto = true) {
    const R = this._rv;
    if (!R || !R.recs.length || R.res || R.busy) return;
    if (auto) this._rvSave();
    if (this._rvEl && this._rvMid) this._rvCloseReview(); // the game ended under a check: the end screen takes over
    // v1.04: the review starts by itself (a tick later: the winning move is recorded right after this hook)
    if (auto) setTimeout(() => {
      if (this._rv !== R) return;
      const q = this._rvAutoQueue?.() || [];
      if (!q.length) return;
      R.queue = q.slice(1); // pass & play: the first person now, the others one after another
      this._rvReviewRun(q[0], null).then((rv) => { if (rv?.done && this._rv === R) this._rvRender?.(); });
    }, 0);
    // v1.29 a past game opened again: the others' check goes on where it stopped (once every person's own review is done)
    let autoOn = true;
    try { autoOn = localStorage.getItem("colonist_review_auto") !== "off"; } catch (_) { autoOn = true; }
    if (!auto && autoOn) setTimeout(() => { if (this._rv === R && !R.run && R.bots && this.players.filter((p) => p.isHuman && this._rvTodo(p.id).length).every((p) => this._rvReviewComplete(p.id))) this._rvQueueNext(); }, 0);
    if (!masterAvailable()) { R.res = { findings: [], none: true }; return; }
    R.busy = true;
    const id = R.id;
    const t0 = now();
    // the missed-chance detectors read the people's decisions only (v1.29: the bots' records stay out, so they work as before); i maps back
    const hum = R.recs.map((r, i) => [r, i]).filter(([r]) => this.players[r.pid]?.isHuman);
    masterRequest({ type: "detect", ...this._rvPayload(hum.map(([r]) => r)) }, 20000).then((m) => {
      if (this._rv !== R || R.id !== id) return;
      R.busy = false;
      if (m?.findings) m.findings.forEach((f) => { if (hum[f.i]) f.i = hum[f.i][1]; });
      R.res = m && m.findings ? { findings: m.findings, ms: Math.round(now() - t0), workMs: m.ms } : { findings: [], failed: true };
      this._rvRender?.();
    });
  },
};

/** Wrap the human decision points (outermost calls only; nothing changes what they do). */
export function installReview(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  const total = (o) => RES5.reduce((s, r) => s + (o?.[r] || 0), 0);

  // a new game / a restored game: the records follow the statistics log (its id)
  wrap("_stReset", function (orig, ...a) {
    const r = orig.apply(this, a);
    if (this.stats) this.stats.id = `${Date.now().toString(36)}${Math.floor(now() * 1000 % 1e6).toString(36)}`;
    this._rvReset(this.stats?.id);
    return r;
  });
  wrap("_stRestore", function (orig, ...a) {
    const r = orig.apply(this, a);
    const id = this.stats?.id || null;
    this._rvReset(id);
    if (id) { const d = this._rvLoad(); if (d && d.id === id) { this._rv.base = d.base; this._rv.recs = d.recs; this._rv.revs = d.reviews || {}; this._rv.bots = !!d.bots; this._rv.review = this._rvMine(this._rv.revs); if (d.luck) this._rv.luck = d.luck; } }
    return r;
  });

  // turn start (before the roll: a Knight may come first)
  wrap("handleHumanRoll", function (orig, ...a) {
    const p = this.currentPlayer, before = this.diceResult;
    const pre = !this.isRush?.() && p?.isHuman && this.phase === "pre_roll" ? this._rvPre(p) : null;
    const r = orig.apply(this, a);
    if (pre && this.diceResult !== before) this._rvPush(pre, "turn");
    return r;
  });
  wrap("_commitSetup", function (orig, player, cb) {
    const pre = cb?.type === "settlement" && this.setupAction === "settlement" ? this._rvPre(player) : null;
    const r = orig.call(this, player, cb);
    if (pre && this.geometry.nodes[cb.id]?.owner === player.id) this._rvPush(pre, "setup", { n: cb.id });
    return r;
  });
  wrap("_commitBuild", function (orig, player, cb) {
    const pre = this._rvPre(player);
    const free = this.freeRoadsRemaining > 0;
    const r = orig.call(this, player, cb);
    if (pre && r) this._rvPush(pre, "build", { type: cb.type, id: cb.id, free });
    return r;
  });
  wrap("handleHumanBankTrade", function (orig, ...a) {
    const p = this.currentPlayer;
    const pre = this._rvPre(p);
    this._rvTr = [];
    try { orig.apply(this, a); } finally {
      const tr = this._rvTr; this._rvTr = null;
      if (pre && tr?.length) this._rvPush(pre, "bank", { tr });
    }
  });
  wrap("performBankTrade", function (orig, player, give, get) {
    const rate = this._rvTr ? this.getPlayerTradeRate(player, give) : 0; // v1.21 the rate of this trade (4:1, 3:1, 2:1) is kept: the review names the real cards
    const ok = orig.call(this, player, give, get);
    if (ok && this._rvTr) this._rvTr.push([give, get, rate]);
    return ok;
  });
  wrap("_executePlayerTrade", function (orig, partner, gave, got) {
    const p = this.currentPlayer;
    const pre = this._rvPre(p);
    const h0 = p ? total(p.resources) + JSON.stringify(p.resources) : "";
    const r = orig.call(this, partner, gave, got);
    if (pre && p && total(p.resources) + JSON.stringify(p.resources) !== h0) this._rvPush(pre, "ptrade", { with: partner.id, gave: { ...gave }, got: { ...got } });
    return r;
  });
  wrap("resolveIncomingTrade", function (orig, accepted, ...a) {
    const pit = this.pendingIncomingTrade;
    const me = pit?.to || this._me?.();
    const pre = accepted && me?.isHuman ? this._rvPre(me) : null;
    const h0 = me ? JSON.stringify(me.resources) : "";
    const r = orig.call(this, accepted, ...a);
    if (pre && me && JSON.stringify(me.resources) !== h0) this._rvPush(pre, "ptrade", { with: pit?.fromPlayer?.id ?? null, incoming: true });
    return r;
  });
  wrap("handleHumanBuyDevCard", function (orig, ...a) {
    const p = this.currentPlayer;
    const pre = this._rvPre(p);
    const n0 = this.devDeck.length;
    const r = orig.apply(this, a);
    if (pre && this.devDeck.length < n0) this._rvPush(pre, "buy");
    return r;
  });
  wrap("handleHumanPlayDevCard", function (orig, type, ...a) {
    const p = this.currentPlayer;
    const pre = this._rvPre(p);
    const was = this.currentTurnPlayedDevCard;
    const r = orig.call(this, type, ...a);
    if (pre && !was && this.currentTurnPlayedDevCard) this._rvPush(pre, "play", { t: type });
    return r;
  });
  wrap("_commitRobber", function (orig, player, hexId, victim) {
    const pre = this.pendingAction === "robber" ? this._rvPre(player) : null;
    const r = orig.call(this, player, hexId, victim);
    if (pre && this.pendingAction !== "robber") this._rvPush(pre, "robber", { hex: hexId });
    return r;
  });
  wrap("_confirmDiscard", function (orig, ...a) {
    const pd = this.pendingDiscard;
    const pre = pd?.player?.isHuman ? this._rvPre(pd.player) : null;
    const sel = pd ? { ...pd.selected } : null;
    const r = orig.apply(this, a);
    if (pre && !this.pendingDiscard) this._rvPush(pre, "discard", { sel, n: total(sel) });
    return r;
  });
  wrap("handleHumanEndTurn", function (orig, ...a) {
    const p = this.currentPlayer;
    const pre = !this.isRush?.() && p?.isHuman && this.phase === "main" ? this._rvPre(p) : null;
    const ts = this.turnSerial;
    const r = orig.apply(this, a);
    if (pre && this.turnSerial !== ts) { this._rvPush(pre, "end"); this._rvSave(); }
    return r;
  });
  // Undo takes a build (or a set-up settlement) back: so does the record
  wrap("undoLast", function (orig, ...a) {
    const u = this.undoState, R = this._rv;
    const r = orig.apply(this, a);
    try {
      if (u && R?.recs.length && (u.kind === "build" || u.kind === "setup")) {
        const last = R.recs[R.recs.length - 1];
        const g = this.geometry;
        const gone = u.kind === "setup" || u.type === "settlement" ? g.nodes[u.id]?.owner == null
          : u.type === "city" ? g.nodes[u.id]?.structure !== "city" : g.edges[u.id]?.owner == null;
        const match = u.kind === "setup" ? last.k === "setup" && last.a.n === u.id : last.k === "build" && last.a.id === u.id && last.a.type === u.type;
        if (gone && match) { R.recs.pop(); R.res = null; }
      }
    } catch (_) { /* never in the way */ }
    return r;
  });
  // ── v1.29 the bots' own decisions (the outermost call of each; a bot's nested moves, e.g. the robber of its Knight, are their own record) ──
  const botPush = (g, pre, k, a, at) => {
    if (!pre || !g._rv) return;
    const rec = { k, ...pre, a };
    if (at != null && at < g._rv.recs.length) g._rv.recs.splice(at, 0, rec); else g._rv.recs.push(rec); // a Knight before the robber it moved
    g._rv.res = null;
  };
  const botWrap = (name, kind, args = () => ({}), ok = (r) => !!r) => wrap(name, function (orig, player, ...a) {
    if (this._rvBusy || !this._rvBotOn(player)) return orig.call(this, player, ...a);
    const pre = this._rvPre(player, true);
    const at = this._rv?.recs.length;
    this._rvBusy = kind; // the free roads of Road Building, the steal of a Knight's robber: not separate decisions…
    let r;
    try { r = orig.call(this, player, ...a); } finally { this._rvBusy = null; }
    if (pre && ok(r, this, player, ...a)) botPush(this, pre, kind, args(this, player, ...a), at);
    return r;
  });
  botWrap("placeSettlement", "build", (g, p, n) => ({ type: "settlement", id: n }), (r, g, p, n, setup) => r && !setup && !g.setupPhase);
  botWrap("placeCity", "build", (g, p, n) => ({ type: "city", id: n }), (r, g, p, n, free) => r && !free);
  botWrap("placeRoad", "build", (g, p, e) => ({ type: "road", id: e }), (r, g, p, e, o) => r && !o?.free && !g.setupPhase);
  botWrap("buyDevelopmentCard", "buy");
  // …except the robber that a Knight moves: that one is recorded inside the play, right after it
  wrap("playDevelopmentCard", function (orig, player, type, ...a) {
    if (this._rvBusy || !this._rvBotOn(player)) return orig.call(this, player, type, ...a);
    const pre = this._rvPre(player, true), at = this._rv?.recs.length;
    let r;
    try { this._rvBusy = type === "knight" ? null : "play"; r = orig.call(this, player, type, ...a); } finally { this._rvBusy = null; }
    if (pre && r !== false) botPush(this, pre, "play", { t: type }, at);
    return r;
  });
  wrap("moveRobberAndSteal", function (orig, player, hex, ...a) {
    if (this._rvBusy || !this._rvBotOn(player)) return orig.call(this, player, hex, ...a);
    const pre = this._rvPre(player, true);
    const h0 = this.robberHexId;
    let r;
    try { this._rvBusy = "robber"; r = orig.call(this, player, hex, ...a); } finally { this._rvBusy = null; }
    if (pre && this.robberHexId !== h0) botPush(this, pre, "robber", { hex });
    return r;
  });
  // set-up settlement (Master seats too: they place through the same call)
  wrap("_aiSetupPlace", function (orig, player, nodeId, ...a) {
    const pre = nodeId != null && !this._rvBusy && this._rvBotOn(player) ? this._rvPre(player, true) : null;
    const at = this._rv?.recs.length;
    const r = orig.call(this, player, nodeId, ...a); // (its settlement is not a build record: placeSettlement is told it is set-up)
    if (pre && this.geometry.nodes[nodeId]?.owner === player.id) botPush(this, pre, "setup", { n: nodeId }, at); // before the next seats' (a headless game places them all in one go)
    return r;
  });
  // bank and harbour trades in a row are one decision (as yours are): the next one joins while the hand is as the last one left it
  wrap("performBankTrade", function (orig, player, give, get) {
    if (this._rvBusy || this._rvTr || !this._rvBotOn(player)) return orig.call(this, player, give, get);
    const R = this._rv, last = R?.recs[R.recs.length - 1], key = (q) => `${this.turnSerial}|${JSON.stringify(q.resources)}|${JSON.stringify(this.bank)}`;
    const join = last && last.k === "bank" && last.pid === player.id && R.bankKey === key(player);
    const pre = join ? null : this._rvPre(player, true);
    const rate = this.getPlayerTradeRate(player, give);
    const ok = orig.call(this, player, give, get);
    if (ok && join) last.a.tr.push([give, get, rate]);
    else if (ok && pre) botPush(this, pre, "bank", { tr: [[give, get, rate]] });
    if (R && ok && (join || pre)) R.bankKey = key(player);
    return ok;
  });
  wrap("endTurn", function (orig, ...a) {
    const p = this.currentPlayer;
    const pre = !this._rvBusy && !this.winner && this.phase === "main" && !this.isRush?.() && this._rvBotOn(p) ? this._rvPre(p, true) : null;
    const ts = this.turnSerial;
    const r = orig.apply(this, a);
    if (pre && this.turnSerial !== ts) botPush(this, pre, "end", {});
    return r;
  });

  // v1.31 luck in win chance (src/review/luck-mc.js): the position just before every roll, so each roll can be replayed with
  // every other sum. A person's roll already has its "turn" record; a bot's gets a "roll" record here (no decision: never checked
  // as a move). Rush: the timer's roll, recorded under the person at the table (pid of no meaning there: a.rush).
  wrap("executeRollPhase", function (orig, player, ...a) {
    const pre = !this._rvBusy && this.phase === "pre_roll" && !this.setupPhase && player && !player.isHuman && this._rvBotOn(player) ? this._rvPre(player, true) : null;
    const n0 = this.stats?.steps?.length;
    const r = orig.call(this, player, ...a);
    if (pre && this.stats?.steps?.length > n0) botPush(this, pre, "roll", {});
    return r;
  });
  wrap("_rushRoll", function (orig, ...a) {
    const who = this.rush && !this.winner && !this.rush.paused ? this.players?.find((p) => p.isHuman) : null;
    const pre = who && this._rvOn() ? this._rvPre(who) : null;
    const n0 = this.stats?.steps?.length;
    const r = orig.apply(this, a);
    if (pre && this.stats?.steps?.length > n0) botPush(this, pre, "roll", { rush: 1 });
    return r;
  });

  wrap("showGameOverOverlay", function (orig, ...a) {
    try { if (this._rv?.recs?.length) this._rvFinish(); } catch (_) { /* the end screen comes first */ }
    return orig.apply(this, a);
  });
}
