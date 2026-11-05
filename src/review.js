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
import { REVIEW_ENGINE, REVIEW } from "./review/evaluate.js";

const KEY = "colonist_review_v1";
const RES5 = ["wood", "brick", "sheep", "wheat", "ore"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hiddenTab = () => typeof document !== "undefined" && (document.hidden || document.visibilityState === "hidden");
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export const ReviewMixin = {
  /** Is anything recorded in this game? (a person plays, Classic island, not the lab / a replay) */
  _rvOn() {
    return !this._rvOff && !this.labMode && !this._replay && !!this.stats && !this.sea && !this.isRush?.()
      && !!this.players?.some((p) => p.isHuman) && !this.winner;
  },
  /** The review covers this kind of game at all (the end screen shows nothing otherwise). */
  _rvCovered() { return !this.sea && !this.isRush?.(); },

  _rvReset(id = this.stats?.id) { if (this._rv?.run) this._rv.run.stop = true; this._rvListener = null; this._rv = { id: id || null, base: null, recs: [], res: null, busy: false, ms: 0 }; },

  /** The position before a decision. */
  _rvPre(player) {
    if (!this._rvOn() || !player?.isHuman) return null;
    if (!this._rv || this._rv.id !== this.stats.id) this._rvReset();
    const t0 = now();
    try {
      this._stSync?.();
      const s = this.serializeState();
      if (!this._rv.base) this._rv.base = { hexes: s.hexes, ports: s.ports, settings: s.settings };
      s.hexes = s.ports = s.settings = s.stats = s.logEntries = undefined;
      const trk = this._aiCardTrack?.players === this.players ? this._aiCardTrack.est.map((e) => ({ ...e })) : null;
      const pre = { pid: player.id, t: this.turn, s: this.stats.steps.length, e: this.stats.ev.length, ts: this.turnSerial, st: JSON.stringify(s), trk };
      this._rv.ms += now() - t0;
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
      return d && d.v === 1 && Array.isArray(d.recs) ? d : null;
    } catch (_) { return null; }
  },
  _rvSave() {
    const R = this._rv;
    if (!R || !R.id || !R.recs.length) return 0;
    try {
      const json = JSON.stringify({ v: 1, id: R.id, base: R.base, recs: R.recs, review: R.review?.results?.length ? R.review : null }); // v1.04: a check made during the game is kept too
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
  _rvNeedsFull(x) { return !["forced", "n/a"].includes(x.skip) && ((x.eng || "full") === "m100" || (x.leaf || "v1") !== (REVIEW.budget.leaf || "v1")); }, // v1.10: a result from the old score function counts as provisional
  /** Every decision of this person so far has a quick or deep result. */
  _rvCovered1(pid) {
    const rv = this._rv?.review;
    return !!rv && rv.pid === pid && this._rvTodo(pid).every(([, i]) => rv.results.some((x) => x.i === i));
  },
  /** Every decision has its deep (full) result: nothing provisional is left. */
  _rvReviewComplete(pid) {
    const rv = this._rv?.review;
    return !!rv && rv.pid === pid && this._rvTodo(pid).every(([, i]) => { const x = rv.results.find((y) => y.i === i); return !!x && !this._rvNeedsFull(x); });
  },
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
    if (R.review) R.review.stopped = true;
    this._rvSave(); this._rvTick();
  },

  /** v1.04 Game review in rounds. After a game (auto, or the button): round 1 is quick (m100 engine, ~0.5 s a
   *  decision) so a provisional review is on screen at once; round 2 deepens every real choice with the full
   *  engine, the biggest losses / closest calls first. `mid` (Check my moves so far): one full round over the
   *  moves so far. Runs in the review's own worker (src/master.js reviewRequest). Already-full results (from a
   *  check during the game) are kept; quick results are replaced one by one. A hidden tab pauses it; on a
   *  machine with ≤ 4 cores a mid-game check also waits while a Master bot is searching. Results are saved. */
  _rvReviewRun(pid, onStep, { mid = false } = {}) {
    const R = this._rv;
    if (!R) return Promise.resolve(null);
    if (onStep) this._rvListener = onStep;
    if (R.run && R.run.pid === pid) return R.run.promise;
    const todo = this._rvTodo(pid);
    const rv = R.review?.pid === pid ? R.review : { pid, results: [] };
    R.review = rv;
    rv.total = todo.length;
    rv.stopped = false;
    if (mid) { rv.midCheck = true; rv.upto = this.turn; }
    if (this._rvReviewComplete(pid)) { rv.done = true; return Promise.resolve(rv); }
    rv.done = false;
    const id = R.id, run = { pid, mid, stop: false, round: null, times: [], paused: false };
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
        run.times.push(now() - t0);
        run.round.j += 1;
        if (run.round.j % 6 === 0) this._rvSave(); // a reload keeps what is checked
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
          if (!run.stop && live()) await round(REVIEW_ENGINE, this._rvDeepOrder(rv, todo.filter(([, i]) => { const x = rv.results.find((y) => y.i === i); return x && this._rvNeedsFull(x); })));
        }
      } catch (e) { console.warn("review run", e); }
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
      if (live()) { rv.done = !run.stop && this._rvReviewComplete(pid); if (R.run === run) R.run = null; this._rvSave(); if (rv.done) this._rvLogGame?.(pid); this._rvTick(); }
      return rv;
    })();
    return run.promise;
  },
  /** Something changed in the running review: the open screen and the end screen's button follow. */
  _rvTick() {
    try { this._rvListener?.(this._rv?.review); this._rvPatchRows?.(); } catch (e) { console.warn("review tick", e); }
  },

  /** Game over: save, then run the detectors in the worker (once per game). */
  _rvFinish(auto = true) {
    const R = this._rv;
    if (!R || !R.recs.length || R.res || R.busy) return;
    if (auto) this._rvSave();
    if (this._rvEl && this._rvMid) this._rvCloseReview(); // the game ended under a check: the end screen takes over
    // v1.04: the review starts by itself (a tick later: the winning move is recorded right after this hook)
    if (auto) setTimeout(() => { if (this._rv !== R) return; const apid = this._rvAutoPid?.(); if (apid != null) this._rvReviewRun(apid, null).then((rv) => { if (rv?.done && this._rv === R) this._rvRender?.(); }); }, 0);
    if (!masterAvailable()) { R.res = { findings: [], none: true }; return; }
    R.busy = true;
    const id = R.id;
    const t0 = now();
    masterRequest({ type: "detect", ...this._rvPayload() }, 20000).then((m) => {
      if (this._rv !== R || R.id !== id) return;
      R.busy = false;
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
    if (id) { const d = this._rvLoad(); if (d && d.id === id) { this._rv.base = d.base; this._rv.recs = d.recs; this._rv.review = d.review || null; } }
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
    const ok = orig.call(this, player, give, get);
    if (ok && this._rvTr) this._rvTr.push([give, get]);
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
  wrap("showGameOverOverlay", function (orig, ...a) {
    try { if (this._rv?.recs?.length) this._rvFinish(); } catch (_) { /* the end screen comes first */ }
    return orig.apply(this, a);
  });
}
