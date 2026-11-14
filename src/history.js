// v1.04 Past games: every finished game is kept (this device) and can be opened again.
//
// What is kept per game (IndexedDB "colonist_history", two stores so the list never reads the heavy part):
//   games  – the entry: id, start/end time, mode, board, players + bot level, result, VP, turns, time played,
//            accuracy (+ `mid` when only checked mid-game), star, size.        ~0.6 KB, read all at once
//   blobs  – one gzip (CompressionStream; plain JSON when the browser has none) of
//            { state: serializeState() without the chat log (board, pieces, players, stats event log),
//              rv: the review recording + review result, if the game has one }.   ~3-20 KB gzipped
//   The id is the game's stats.id, so archiving twice (game over, then after the review) updates one entry.
//
// Limits: 50 games that are not starred, 10 MB in total; the oldest un-starred game goes first, starred games
// never go automatically. A full disk / quota error, a private window without IndexedDB: the list says so and
// the game itself is never affected (every call is try/catch, history is best effort).
//
// Opening a past game reuses the real screens: the game is loaded read-only (saveToStorage / clearStorage are
// off while `_histView` is set), the end screen (Stats) or the Replay or the Game review opens on it, and
// "Past games" in the top-left puts your running game back (it stays in localStorage untouched).
// Styles: themes/history.css.
import { icon, avatarSvg } from "./themes/manager.js";
import { BOT_PROFILES, profileMini } from "./bot-profiles.js";
import { profileOf } from "./bot-profile-ui.js";
import { summarize, clsOf, ACC, REVIEW as RVCFG, FMT, rescoreReview, reviewStatus } from "./review/evaluate.js";
import { reviewAvailable } from "./master.js";
import { packRecs, unpackRecs } from "./review/pack.js";
import { Names } from "./names.js";

const DB_NAME = "colonist_history";
export const LIMITS = { games: 50, bytes: 10 * 1024 * 1024, nearFull: 0.8 };
// lab-131 the AI Lab keeps the games of its last run in a store of its own (same format), so Past games and its limits are untouched
export const LAB_DB = "colonist_lab", LAB_LIMITS = { games: 50, bytes: 5 * 1024 * 1024, nearFull: 0.8 };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── storage ─────────────────────────────────────────────────────────────────────────────────────
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const done = (tx) => new Promise((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => no(tx.error); });

async function pack(obj) {
  const json = JSON.stringify(obj);
  try {
    if (typeof CompressionStream === "function") {
      const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
      return { enc: "gz", data: buf, bytes: buf.byteLength };
    }
  } catch (_) { /* fall through to plain JSON */ }
  return { enc: "json", data: json, bytes: json.length };
}
async function unpack(b) {
  if (b.enc === "gz") return JSON.parse(await new Response(new Blob([b.data]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  return JSON.parse(b.data);
}

export class HistoryStore {
  constructor(name = DB_NAME, limits = LIMITS) { this.name = name; this.lim = limits; this.db = null; this.mem = new Map(); this.mode = "idb"; this.metas = []; this.ready = null; this.full = false; this.pruned = 0; this.budget = limits.bytes; this.onChange = null; }

  open() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
        const r = indexedDB.open(this.name, 1);
        r.onupgradeneeded = () => { r.result.createObjectStore("games", { keyPath: "id" }); r.result.createObjectStore("blobs", { keyPath: "id" }); };
        this.db = await req(r);
        this.metas = await req(this.db.transaction("games").objectStore("games").getAll());
      } catch (_) { this.db = null; this.mode = "memory"; } // private window / blocked: this tab only
      this._sort();
      this.onChange?.();
      return this;
    })();
    return this.ready;
  }
  _sort() { this.metas.sort((a, b) => b.end - a.end); }
  get count() { return this.metas.length; }
  get bytes() { return this.metas.reduce((a, m) => a + (m.kb || 0), 0); }

  async put(meta, payload, { quiet = false } = {}) {
    await this.open();
    const p = await pack(payload);
    meta.kb = p.bytes;
    const blob = { id: meta.id, enc: p.enc, data: p.data };
    const write = async () => {
      if (!this.db) { this.mem.set(meta.id, blob); return; }
      const tx = this.db.transaction(["games", "blobs"], "readwrite");
      tx.objectStore("games").put(meta); tx.objectStore("blobs").put(blob);
      await done(tx);
    };
    try { await write(); } catch (e) {
      // quota: make room (oldest un-starred first) and try once more, then give up quietly
      await this._prune(meta.id, 3);
      try { await write(); } catch (_) { this.full = true; this.onChange?.(); return false; }
    }
    this.full = false;
    const i = this.metas.findIndex((m) => m.id === meta.id);
    if (i >= 0) this.metas[i] = meta; else this.metas.push(meta);
    this._sort();
    await this._prune(meta.id, 0);
    if (!quiet) this.onChange?.();
    return true;
  }
  /** Keep to the limits; `extra` more games are removed first (a failed write). The just-saved game stays. */
  async _prune(keep, extra) {
    let n = 0;
    const cand = () => this.metas.filter((m) => !m.star && m.id !== keep).sort((a, b) => a.end - b.end);
    while (cand().length && (extra > n || this.metas.filter((m) => !m.star).length > this.lim.games || this.bytes > this.budget)) { await this.remove(cand()[0].id, true); n += 1; }
    if (n) this.pruned += n;
  }
  async get(id) {
    await this.open();
    try {
      const b = this.db ? await req(this.db.transaction("blobs").objectStore("blobs").get(id)) : this.mem.get(id);
      return b ? await unpack(b) : null;
    } catch (_) { return null; }
  }
  async remove(id, quiet = false) {
    await this.open();
    try {
      if (this.db) { const tx = this.db.transaction(["games", "blobs"], "readwrite"); tx.objectStore("games").delete(id); tx.objectStore("blobs").delete(id); await done(tx); } else this.mem.delete(id);
    } catch (_) { /* gone or not: the list below is what counts */ }
    this.metas = this.metas.filter((m) => m.id !== id);
    if (!quiet) this.onChange?.();
  }
  async patch(id, fields) {
    const m = this.metas.find((x) => x.id === id);
    if (!m) return;
    Object.assign(m, fields);
    try { if (this.db) { const tx = this.db.transaction("games", "readwrite"); tx.objectStore("games").put(m); await done(tx); } } catch (_) { /* kept in memory */ }
    this.onChange?.();
  }
  /** How full: our share of the budget and what the device says (navigator.storage.estimate). */
  async usage() {
    let est = null;
    try { est = await navigator.storage?.estimate?.(); } catch (_) { est = null; }
    const share = Math.max(this.bytes / this.budget, this.metas.filter((m) => !m.star).length / this.lim.games);
    const free = est?.quota ? 1 - (est.usage || 0) / est.quota : null;
    return { share, free, count: this.count, bytes: this.bytes, near: this.full || share >= this.lim.nearFull || this.metas.filter((m) => !m.star).length >= this.lim.games - 4 || (free != null && free < 0.05), mode: this.mode };
  }
}

// ── the entry ───────────────────────────────────────────────────────────────────────────────────
const startOf = (id) => { const t = parseInt(String(id).slice(0, 8), 36); return Number.isFinite(t) && t > 1.5e12 && t < 4e12 ? t : Date.now(); };
const PROBLEM = ["could", "mistake", "blunder", "missed"];
/** The kind of a marked decision, for "your most frequent mistake" (what the review says the better move was). */
const mistKey = (x) => (x.k === "end" && /^(City|Settlement|Road|Development|Ship)/.test(x.best?.label || "") ? "end>build" : x.k);
export const MIST_TEXT = { "end>build": "ended your turn while a build was possible", build: "built something weaker", bank: "a weaker bank trade", robber: "a weaker robber tile", setup: "a weaker set-up spot", end: "ended your turn with a better move left", buy: "a development card at the wrong time", play: "a development card played too early or late" };
/** The history fields of one person's review (accuracy, counts, kinds of mistake, provisional?), from the review and its records alone. */
export function revMeta(recs, rv, pid, prev = null) {
  if (!rv || rv.pid !== pid || !rv.results?.length) return { acc: prev?.acc ?? null, mid: prev?.mid || false };
  const sum = summarize(rv.results), cls = {}, mist = {};
  PROBLEM.forEach((c) => { cls[c] = 0; });
  rv.results.forEach((x) => { const c = clsOf(x); if (PROBLEM.includes(c)) { cls[c] += 1; const k = mistKey(x); mist[k] = (mist[k] || 0) + 1; } });
  const st = reviewStatus(recs, rv);
  return { acc: sum.acc, rn: sum.n, lost: sum.lost, cls, mist, prov: !st.complete, mid: !!rv.midCheck, rk: ACC.id, fmt: FMT, rp: [st.deep, rv.total || rv.results.length] };
}
const seatProf = (p, game) => { if (p.isHuman) return {}; const pr = game ? profileOf(game, game.players[p.id] || p) : null; const k = pr?.key || (BOT_PROFILES[p.personality] ? p.personality : "intermediate"); return { prof: k, custom: pr ? pr.custom : !BOT_PROFILES[p.personality] }; };

export const HistoryMixin = {
  _hist: null,
  get hist() { return this._hist || (this._hist = Object.assign(new HistoryStore(), { onChange: () => { this._histChanged?.(); } })); },

  /** The entry of the game on screen (a finished game). */
  _histMeta(acc = undefined, prev = null) {
    const S = this.stats, sea = !!this.sea, rush = this.isRush?.() || this.settings?.mode === "rush";
    const me = this.hotseat ? null : this._me?.();
    const win = this.winner;
    const end = Date.now();
    return {
      id: S.id, v: 1, start: startOf(S.id), end: prev?.end || end,
      mode: rush ? "rush" : "classic", board: sea ? "seafarers" : "island", n: this.players.length, pts: this.winPoints, hot: !!this.hotseat,
      seats: this.players.map((p) => ({ name: p.name, vp: p.victoryPoints, you: !!me && p.id === me.id, ...seatProf(p, this) })),
      me: me ? me.id : null, winner: win ? win.id : null,
      result: !me ? "table" : win === me ? "won" : "lost",
      turns: rush ? (this.rush?.rollNo ?? S.steps.length) : this.turn, ms: S.ms || 0,
      star: prev?.star || false,
      rec: !!this._rv && this._rv.id === S.id && this._rv.recs.length > 0,
      ...(me && this._rv?.id === S.id ? { rd: this._rvTodo?.(me.id).length || 0, ...this._histRev(this._rvOf(me.id), me.id, prev) } : { acc: prev?.acc ?? null }),
      // pass & play (v1.12): each person has their own accuracy / marked moves, under their name
      ...(this.hotseat ? { hn: this._histHn(this._rv?.id === S.id ? this._rv : null, prev?.hn) } : {}),
    };
  },
  /** A name was renamed (or merged into another) in the Names sheet: the entries follow. */
  async histRenameName(from, to) {
    try {
      const H = this.hist; await H.open();
      for (const m of H.metas.filter((x) => x.hn?.some((h) => h.name.toLowerCase() === from.toLowerCase()))) {
        const hn = m.hn.map((h) => (h.name.toLowerCase() === from.toLowerCase() ? { ...h, name: to } : h));
        const seats = m.seats.map((s, i) => (hn.some((h) => h.pid === i && h.name === to) ? { ...s, name: to } : s));
        await H.patch(m.id, { hn, seats });
      }
      this._histChanged?.();
    } catch (_) { /* best effort */ }
  },
  /** Pass & play: one entry per person: { pid, name, rd, acc, rn, cls, mist, prov, mid, rk }. */
  _histHn(R, prevHn = null) {
    return this.players.filter((p) => p.isHuman).map((p) => {
      const prev = (prevHn || []).find((h) => h.pid === p.id) || null;
      const rv = R?.revs?.[p.id] || null;
      const rd = R && this._rv === R ? this._rvTodo?.(p.id).length || 0 : prev?.rd || 0;
      return { pid: p.id, name: p.name, rd, ...this._histRev(rv, p.id, prev, R?.recs) };
    });
  },
  /** What the review has so far (quick round: provisional; deep round done: final): accuracy, class counts, kinds of mistake. */
  _histRev(rv, pid, prev = null, recs = this._rv?.recs) { return revMeta(recs, rv, pid, prev); },
  /** The review moved on (a round step, stop, done): keep the entry up to date, at most once a second. */
  _histSoon() {
    if (!this.winner || this._replay || this.labMode) return;
    clearTimeout(this._histT);
    this._histT = setTimeout(() => { this._histT = 0; (this._histView ? this.histUpdateView() : this.histArchive()); }, 900);
  },
  async histUpdateView() {
    const v = this._histView, R = this._rv;
    if (!v || !R || R.id !== v.id) return;
    const m = this.hist.metas.find((x) => x.id === v.id);
    if (!m || (m.me == null && !m.hn)) return;
    await this.hist.put({ ...m, ...(m.hn ? { hn: this._histHn(R, m.hn) } : this._histRev(R.revs?.[m.me], m.me, m)), rec: true },
      { state: v.state, rv: { base: R.base, recs: packRecs(R.recs), reviews: this._rvAll(R), bots: R.bots ? 1 : 0, ...(R.luck ? { luck: R.luck } : {}), ...(R.recap ? { recap: R.recap } : {}) } });
  },

  /** Game over (and again when the review finishes): keep this game. Never throws, never waits. */
  histArchive() {
    if (!this.winner || !this.stats?.id || this._replay || this._histView || this.labMode) return Promise.resolve(false);
    const H = this.hist, id = this.stats.id;
    return H.open().then(async () => {
      const prev = H.metas.find((m) => m.id === id) || null;
      const rv = this._rv && this._rv.id === id && this._rv.recs.length ? this._rv : null;
      const state = this.serializeState();
      state.logEntries = [];
      const payload = { state, rv: rv ? { base: rv.base, recs: packRecs(rv.recs), reviews: this._rvAll(rv), bots: rv.bots ? 1 : 0, ...(rv.luck ? { luck: rv.luck } : {}), ...(rv.recap ? { recap: rv.recap } : {}) } : null }; // v1.29 packed records (src/review/pack.js), the bots' decisions too
      return H.put(this._histMeta(undefined, prev), payload);
    }).catch(() => false);
  },
  /** What the old single-slot storage holds (strings, read before a new game can clear it). */
  histOldSlot() {
    try {
      if (localStorage.getItem("colonist_hist_migrated") === "1") return null;
      return { save: localStorage.getItem(this.constructor.STORAGE_KEY), rv: localStorage.getItem("colonist_review_v1"), hist: localStorage.getItem("colonist_review_hist_v1") };
    } catch (_) { return null; }
  },

  /** First run: the last game of the old storage becomes the first entry (with its recording and accuracy). */
  async histMigrate(old) {
    if (!old) return;
    try {
      const st = old.save ? JSON.parse(old.save) : null;
      if (st?.winnerId != null && st.stats?.id && !this.hist.metas.some((m) => m.id === st.stats.id)) {
        const rv = old.rv ? JSON.parse(old.rv) : null;
        const same = rv && rv.id === st.stats.id;
        const a = (JSON.parse(old.hist || "[]") || []).find((x) => x.id === st.stats.id);
        const winner = st.winnerId, me = (st.players || []).findIndex((p) => p.isHuman);
        const rush = st.settings?.mode === "rush";
        const seats = st.players.map((p, i) => ({ name: p.name, vp: p.victoryPoints, you: i === me, ...seatProf({ ...p, id: i }, null) }));
        const meta = { id: st.stats.id, v: 1, start: startOf(st.stats.id), end: a?.at || Date.now(), mode: rush ? "rush" : "classic", board: st.sea ? "seafarers" : "island", n: seats.length,
          pts: st.settings?.winPoints || 10, hot: false, seats, me: me >= 0 ? me : null, winner,
          result: me < 0 ? "table" : winner === me ? "won" : "lost", turns: st.turn, ms: st.stats.ms || 0, acc: a?.acc ?? null, mid: !!a?.midCheck, star: false, rec: !!same, rd: same ? rv.recs.filter((r) => r.pid === me).length : 0 };
        st.logEntries = [];
        if (!(await this.hist.put(meta, { state: st, rv: same ? { base: rv.base, recs: rv.recs, reviews: rv.review?.results?.length ? { [rv.review.pid]: (rescoreReview(rv.review), rv.review) } : {} } : null }))) return; // no room: try again next start
      }
      localStorage.setItem("colonist_hist_migrated", "1");
    } catch (_) { /* nothing to migrate / private mode */ }
  },

  // ── opening a past game on the real screens ──
  async histView(id, what = "stats", pid = null) {
    const meta = this.hist.metas.find((m) => m.id === id);
    const same = !!meta && this.winner && this.stats?.id === id && !this._histView; // the game on the end screen: use it as it is
    const rec = same ? null : await this.hist.get(id);
    if (!meta || (!same && !rec)) { this._histToast("This game can’t be opened any more."); return; }
    this.histClose();
    this.menu?.close(); this.home?.close();
    if (!same) {
      const fromEnd = !!this.winner && !this.home?.open;
      if (!this._histView && !this.onboardingHold && !this.winner) this.saveToStorage(); // the running game is safe in localStorage
      this._cancelPendingWork?.();
      this.removeGameOverOverlay?.();
      this._histView = { id, state: rec.state, fromEnd };
      this.onboardingHold = false; this.uiPaused = false;
      this.loadFromStorage(rec.state); // (this resets the recorder: the saved recording goes back in after it)
      // lab-131 a lab game has no person: seat 0 (a person after every load) is the bot it was
      if (this._labBack) this.players.forEach((p, i) => { const sp = rec.state.players?.[i]; if (p.isHuman && sp?.strategy) Object.assign(p, { isHuman: false, strategy: { ...sp.strategy }, personality: sp.personality || p.personality }); });
      const revs = rec.rv ? (rec.rv.reviews || (rec.rv.review?.results?.length ? { [rec.rv.review.pid]: rec.rv.review } : {})) : {}; // (older entries: one review)
      Object.values(revs).forEach((r) => rescoreReview(r)); // v1.21 today's numbers, classes and labels from the saved candidates
      this._rv = rec.rv ? { id, base: rec.rv.base, recs: unpackRecs(rec.rv.recs), res: null, busy: false, ms: 0, revs, queue: [], bots: !!rec.rv.bots, review: this._rvMine?.(revs) || undefined, ...(rec.rv.luck ? { luck: rec.rv.luck } : {}), ...(rec.rv.recap ? { recap: rec.rv.recap } : {}) } : null;
      this._rv?.recs?.length && this._rvFinish?.(false); // v1.11: the missed-chance detectors run for a past game too (no auto review): without this the end screen said "checking…" for ever
    } else if (!document.querySelector(".game-over-overlay")) this.showGameOverOverlay({ quiet: true });
    const ready = () => {
      const ov = document.querySelector(".game-over-overlay");
      if (!ov) return false;
      if (what === "replay") ov.querySelector("[data-replay]")?.click();
      else if (what === "review" && (pid != null || meta.me != null || meta.hn?.length)) this._rvOpenReview?.(pid != null ? pid : meta.me ?? meta.hn[0].pid); // lab-131: a bot's review (pid) in a game without people
      return true;
    };
    let tries = 0;
    const poll = () => { if (!same && (!this._histView || this._histView.id !== id)) return; if (!ready() && tries++ < 60) window.setTimeout(poll, 100); };
    poll();
  },
  /** Back to the list: the game you came from (a running game, or the end screen of the one just played) returns as it was. */
  async histExit() {
    if (this._labBack) { location.href = "./lab.html"; return; } // lab-131: a lab game opened from the AI Lab goes back there
    const from = this._histView?.fromEnd;
    this._rpExit?.(true);
    this._rvCloseReview?.();
    this.removeGameOverOverlay?.();
    this._histView = null;
    this._rv = null;
    if (from && this._savedFinished()) { this.onboardingHold = false; this.uiPaused = false; this.loadFromStorage(); this.histOpen(); return; } // the end screen comes back under the list
    this._homeSave = this._hasResumableSave?.() && this.loadFromStorage();
    if (!this._homeSave) this.resetGame();
    this.goHome();
    this.histOpen();
  },
  /** lab-131 index.html?labgame=ID[&what=replay|review][&pid=N]: open a game of the AI Lab's last run (its own store) on the
   *  real screens (end screen, Replay with the running win chance, a bot's review); leaving goes back to the lab. */
  async histOpenLab(id, what = "stats", pid = null) {
    this._hist = Object.assign(new HistoryStore(LAB_DB, LAB_LIMITS), { onChange: () => { this._histChanged?.(); } });
    this._labBack = true;
    await this.hist.open();
    if (!this.hist.metas.some((m) => m.id === id)) { location.href = "./lab.html"; return; }
    return this.histView(id, what, pid);
  },
  _savedFinished() { try { return JSON.parse(localStorage.getItem(this.constructor.STORAGE_KEY) || "null")?.winnerId != null; } catch (_) { return false; } },
  _histToast(t) { const el = this._histEl?.querySelector(".hs-note"); if (el) { el.textContent = t; el.hidden = false; } },

  // ── the screens ──
  async histOpen() {
    this.histClose();
    const el = document.createElement("div");
    el.className = "hs tm";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Past games");
    document.body.appendChild(el);
    this._histEl = el;
    this._histF = this._histF || { res: "all", mode: new Set(), rev: false, star: false };
    this._histChanged = () => { if (this._histEl === el) this._histDraw(); };
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") this.histClose(); });
    await this.hist.open();
    this._histDraw();
    this.histRescoreAll();
  },
  /** v1.21 Saved reviews get today's numbers: each reviewed game that is not in the current format is re-scored from its own
   *  candidates (no engine), its list entry (accuracy, counts, kinds of mistake) is rebuilt from the result, one game at a time, quietly. */
  async histRescoreAll() {
    if (this._histRescoring) return;
    this._histRescoring = true;
    try {
      const H = this.hist; await H.open();
      const live = !this._histView && this._rv?.run ? this.stats?.id : null; // a running check writes its own entry
      const todo = H.metas.filter((m) => m.rec && m.id !== live && (m.hn?.length ? m.hn.some((h) => h.acc != null && h.fmt !== FMT) : m.acc != null && m.fmt !== FMT));
      let n = 0;
      for (const m of todo) {
        const rec = await H.get(m.id);
        if (!rec?.rv) continue;
        const reviews = rec.rv.reviews || (rec.rv.review?.results?.length ? { [rec.rv.review.pid]: rec.rv.review } : {});
        Object.values(reviews).forEach((r) => rescoreReview(r));
        const meta = m.hn?.length ? { ...m, hn: m.hn.map((h) => ({ ...h, ...revMeta(rec.rv.recs, reviews[h.pid], h.pid, h) })), fmt: FMT } : { ...m, ...revMeta(rec.rv.recs, reviews[m.me], m.me, m), fmt: FMT };
        if (await H.put(meta, { state: rec.state, rv: { base: rec.rv.base, recs: rec.rv.recs, reviews, ...(rec.rv.bots ? { bots: 1 } : {}), ...(rec.rv.luck ? { luck: rec.rv.luck } : {}), ...(rec.rv.recap ? { recap: rec.rv.recap } : {}) } }, { quiet: true })) n += 1;
      }
      if (n) H.onChange?.();
    } catch (_) { /* best effort: the next open tries again */ }
    this._histRescoring = false;
  },
  histClose() {
    this._histEl?.remove(); this._histEl = null; this._histSel = null; this._histChanged = null;
    document.querySelector(".hs-sheet")?.remove();
  },

  async _histDraw() {
    const el = this._histEl;
    if (!el) return;
    const H = this.hist, F = this._histF;
    const all = H.metas;
    const use = await H.usage();
    if (this._histEl !== el) return;
    const fil = all.filter((m) => (F.res === "all" || m.result === F.res) && (!F.mode.size || F.mode.has(m.board === "seafarers" ? "seafarers" : m.mode)) && (!F.rev || m.acc != null) && (!F.star || m.star));
    const n = (f) => all.filter(f).length;
    const seg = [["all", "All", all.length], ["won", "Won", n((m) => m.result === "won")], ["lost", "Lost", n((m) => m.result === "lost")]];
    const chips = [["classic", "Classic"], ["rush", "Rush"], ["seafarers", "Seafarers"]];
    const scroll = el.querySelector(".hs-scroll")?.scrollTop || 0;
    el.innerHTML = `<div class="hs-bar"><button type="button" class="hs-x" data-hclose aria-label="Back">${CHEV_L}</button><div><h3>Past games</h3><small>${all.length ? `${all.length} on this device${H.mode === "memory" ? " · until you close this tab" : ""}` : "Finished games are kept here"}</small></div></div>
      <div class="hs-scroll">
        ${this._histBanner(use)}
        <p class="hs-note" role="status" hidden></p>
        ${this._histProgress(all)}
        ${all.length ? `<div class="hs-filters"><div class="hs-seg" role="radiogroup" aria-label="Result">${seg.map(([k, l, c]) => `<button type="button" role="radio" aria-checked="${F.res === k}" data-hres="${k}" class="${F.res === k ? "on" : ""}">${l}<i>${c}</i></button>`).join("")}</div>
          <div class="hs-chips">${chips.map(([k, l]) => `<button type="button" aria-pressed="${F.mode.has(k)}" data-hmode="${k}" class="${F.mode.has(k) ? "on" : ""}">${l}</button>`).join("")}<button type="button" aria-pressed="${F.rev}" data-hrev class="${F.rev ? "on" : ""}">Reviewed</button><button type="button" aria-pressed="${F.star}" data-hstar class="${F.star ? "on" : ""}">${STAR(true)}Starred</button></div></div>` : ""}
        ${all.length ? (fil.length ? `<ul class="hs-list">${fil.map((m) => this._histRow(m)).join("")}</ul>` : `<div class="hs-none"><b>No game matches</b><p>Try another filter.</p><button type="button" class="hs-btn" data-hreset>Show all games</button></div>`) : this._histEmpty()}
      </div>`;
    el.querySelector(".hs-scroll").scrollTop = scroll;
    el.querySelector("[data-hclose]").addEventListener("click", () => this.histClose());
    el.querySelector("[data-hinfo]")?.addEventListener("click", () => { this._histInfo = !this._histInfo; this._histDraw(); });
    el.querySelectorAll("[data-hwho]").forEach((b) => b.addEventListener("click", () => { this._histWho = b.dataset.hwho; this._histDraw(); }));
    el.querySelectorAll("[data-hres]").forEach((b) => b.addEventListener("click", () => { F.res = b.dataset.hres; this._histDraw(); }));
    el.querySelectorAll("[data-hmode]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.hmode; F.mode.has(k) ? F.mode.delete(k) : F.mode.add(k); this._histDraw(); }));
    el.querySelector("[data-hrev]")?.addEventListener("click", () => { F.rev = !F.rev; this._histDraw(); });
    el.querySelector("[data-hstar]")?.addEventListener("click", () => { F.star = !F.star; this._histDraw(); });
    el.querySelector("[data-hreset]")?.addEventListener("click", () => { F.res = "all"; F.mode.clear(); F.rev = F.star = false; this._histDraw(); });
    el.querySelector("[data-hplay]")?.addEventListener("click", () => { this.histClose(); this.goHome(); });
    el.querySelector("[data-hfree]")?.addEventListener("click", async () => { const old = H.metas.filter((m) => !m.star).sort((a, b) => a.end - b.end).slice(0, 10); for (const m of old) await H.remove(m.id, true); H.full = false; H.onChange?.(); });
    el.querySelectorAll("[data-hrow]").forEach((b) => b.addEventListener("click", () => this._histSheet(b.dataset.hrow)));
    el.querySelectorAll("[data-hrstar]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); this._histStar(b.dataset.hrstar); }));
    if (this._histSel) this._histSheet(this._histSel, true);
  },
  async _histStar(id) {
    const m = this.hist.metas.find((x) => x.id === id);
    if (!m) return;
    await this.hist.patch(id, { star: !m.star });
    if (!m.star) return;
    try { navigator.storage?.persist?.(); } catch (_) { /* optional: asks the browser not to evict this */ }
  },

  /** "Your progress": accuracy over time, win rate, marked moves per game, the most frequent kind of mistake. */
  /** One row per person per game: pass & play games count under each name; one-person games under "You". */
  _histEntries(all) {
    const out = [];
    all.forEach((m) => {
      if (m.hot && m.hn?.length) m.hn.forEach((h) => out.push({ ...h, end: m.end, result: m.winner === h.pid ? "won" : "lost", who: h.name }));
      else if (m.me != null) out.push({ ...m, who: "You" });
    });
    return out;
  },
  _histProgress(all) {
    const ents = this._histEntries(all);
    const cnt = {};
    ents.forEach((e) => { cnt[e.who] = (cnt[e.who] || 0) + 1; });
    const names = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    const me = Names.me();
    let who = names.includes(this._histWho) ? this._histWho : names.find((n) => me && n.toLowerCase() === me.toLowerCase()) || names[0];
    this._histWho = who;
    const old = ents.filter((e) => e.who === who).sort((a, b) => a.end - b.end);
    const fin = old.filter((m) => m.result === "won" || m.result === "lost");
    const rev = old.filter((m) => m.acc != null && !m.prov && m.rn && m.cls);
    if (fin.length < 2 && rev.length < 2 && names.length < 2) return "";
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const trend = (v, dec = 0, good = 1) => { const f = 10 ** dec, d = Math.round(v * f) / f; return !d ? "" : `<i class="pg-d ${d * good > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</i>`; };
    // accuracy: only games checked after play, with the review settings of the latest one
    const kNow = rev.length ? rev[rev.length - 1].rk : null;
    const pts = rev.filter((m) => !m.mid && m.rk === kNow);
    let accHtml = `<div class="pg-t"><b>–</b><small>Accuracy</small></div>`, spark = "";
    if (pts.length) {
      const last = pts.slice(-5), prev = pts.slice(-10, -5);
      accHtml = `<div class="pg-t"><b>${Math.round(avg(last.map((m) => m.acc)))}${prev.length ? trend(avg(last.map((m) => m.acc)) - avg(prev.map((m) => m.acc))) : ""}</b><small>Accuracy · last ${last.length}</small></div>`;
    }
    if (pts.length >= 2) {
      const v = pts.slice(-12).map((m) => m.acc), lo = Math.min(...v, 70), hi = Math.max(...v, 90), W = 300, H = 54, X = (i) => 6 + (i / (v.length - 1)) * (W - 12), Y = (a) => 6 + (1 - (a - lo) / (hi - lo)) * (H - 14);
      spark = `<svg class="pg-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Accuracy of your last ${v.length} reviewed games: ${v.join(", ")}"><path d="${v.map((a, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(a).toFixed(1)}`).join("")}" class="pg-line"/>${v.map((a, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(a).toFixed(1)}" r="${i === v.length - 1 ? 4 : 2.6}" class="pg-dot"/>`).join("")}<text x="${W - 6}" y="${H - 1}" text-anchor="end" class="pg-ax">${v[v.length - 1]}</text></svg>`;
    }
    // wins
    const won = fin.filter((m) => m.result === "won").length, l10 = fin.slice(-10);
    const winHtml = fin.length ? `<div class="pg-t"><b>${Math.round((100 * won) / fin.length)}%</b><small>Won ${won} of ${fin.length}</small><span class="pg-wl" aria-hidden="true">${l10.map((m) => `<i class="${m.result}"></i>`).join("")}</span></div>` : "";
    // marked moves per game
    const per = rev.map((m) => ({ c: (m.cls.could || 0) + (m.cls.missed || 0), m: m.cls.mistake || 0, b: m.cls.blunder || 0 }));
    let markHtml = `<div class="pg-t"><b>–</b><small>Marked moves</small></div>`, bars = "";
    if (per.length) {
      const tot = (p) => p.c + p.m + p.b, last = per.slice(-5), prev = per.slice(-10, -5);
      markHtml = `<div class="pg-t"><b>${(avg(last.map(tot))).toFixed(1)}${prev.length ? trend(avg(last.map(tot)) - avg(prev.map(tot)), 1, -1) : ""}</b><small>Marked per game</small></div>`;
    }
    if (per.length >= 2) {
      const v = per.slice(-12), mx = Math.max(4, ...v.map((p) => p.c + p.m + p.b)), bw = 300 / v.length;
      bars = `<svg class="pg-bars" viewBox="0 0 300 50" role="img" aria-label="Marked moves per game, oldest first: ${v.map((p) => p.c + p.m + p.b).join(", ")}">${v.map((p, i) => { let y = 48; return [["b", p.b], ["m", p.m], ["c", p.c]].map(([k, n]) => { const h = (n / mx) * 44; y -= h; return h ? `<rect x="${(i * bw + 2).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" class="pg-${k}"/>` : ""; }).join(""); }).join("")}</svg><p class="pg-key"><i class="pg-c"></i>could be better <i class="pg-m"></i>mistake <i class="pg-b"></i>blunder</p>`;
    }
    // the most frequent kind of mistake
    const mist = {}; let all2 = 0;
    rev.forEach((m) => Object.entries(m.mist || {}).forEach(([k, n]) => { mist[k] = (mist[k] || 0) + n; all2 += n; }));
    const top = Object.entries(mist).sort((a, b) => b[1] - a[1])[0];
    const topHtml = top && all2 >= 3 ? `<p class="pg-top"><b>Most missed:</b> ${MIST_TEXT[top[0]] || top[0]} <small>${top[1]} of ${all2} marked moves</small></p>` : "";
    const need = rev.length < 2 ? `<p class="pg-top dim">Review ${2 - rev.length} more game${rev.length === 1 ? "" : "s"} to see your accuracy trend.</p>` : "";
    return `<section class="hs-prog" aria-label="${names.length > 1 ? esc(who) + "’s progress" : "Your progress"}"><div class="pg-h"><h4>${names.length > 1 ? "Progress" : "Your progress"}</h4><button type="button" class="pg-i" data-hinfo aria-expanded="${!!this._histInfo}" aria-label="What do these numbers mean?"></button></div>
      ${names.length > 1 ? `<div class="pg-who" role="radiogroup" aria-label="Progress of">${names.slice(0, 6).map((n) => `<button type="button" role="radio" aria-checked="${n === who}" class="${n === who ? "on" : ""}" data-hwho="${esc(n)}">${esc(n)}<small>${cnt[n]} game${cnt[n] === 1 ? "" : "s"}</small></button>`).join("")}</div>` : ""}
      <div class="pg-tiles">${accHtml}${winHtml}${markHtml}</div>${spark}${bars}${topHtml}${need}
      ${this._histInfo ? `<div class="pg-info" role="note"><p><b>Accuracy</b> averages the games reviewed after play (deep Monte Carlo, 1000 futures), with the same review settings; games you had checked during play are left out, and so is a review that is still provisional.</p><p><b>Marked moves</b> are the could be better, mistake and blunder moves of each reviewed game (missed chances count as could be better).</p><p><b>Most missed</b> is the kind of move behind most of them.</p><p>Trends compare your last 5 reviewed games with the 5 before.</p></div>` : ""}</section>`;
  },

  _histBanner(u) {
    const H = this.hist;
    if (H.mode === "memory") return `<aside class="hs-ban warn" role="status">${WARN}<div><b>Private window</b><p>This browser doesn’t let Colonist save games here. Your past games last until you close this tab.</p></div></aside>`;
    if (H.full) return `<aside class="hs-ban warn" role="status">${WARN}<div><b>Storage is full</b><p>The last game couldn’t be kept. Free some room: starred games stay, the oldest others go.</p><button type="button" class="hs-btn" data-hfree>Delete the 10 oldest</button></div></aside>`;
    if (u.near) return `<aside class="hs-ban" role="status">${WARN}<div><b>Storage almost full</b><p>${H.metas.filter((m) => !m.star).length} of ${LIMITS.games} games kept · ${kb(u.bytes)} used. ${u.free != null && u.free < 0.05 ? "This device is nearly out of space. " : ""}When it is full the oldest games are removed first; star the ones to keep.</p>
      <div class="hs-meter" role="img" aria-label="${Math.round(u.share * 100)} percent used"><i style="width:${Math.min(100, Math.round(u.share * 100))}%"></i></div><button type="button" class="hs-btn" data-hfree>Delete the 10 oldest</button></div></aside>`;
    if (H.pruned) return `<aside class="hs-ban" role="status"><div><b>${H.pruned} old game${H.pruned > 1 ? "s were" : " was"} removed</b><p>Only ${LIMITS.games} games are kept; starred games stay.</p></div></aside>`;
    return "";
  },

  _histEmpty() {
    return `<section class="hs-empty"><svg viewBox="0 0 120 96" aria-hidden="true"><rect x="22" y="16" width="76" height="64" rx="10" class="e-card"/><path d="M36 36h48M36 50h34M36 64h40" class="e-line"/><circle cx="90" cy="70" r="16" class="e-badge"/><path d="M90 61v10l7 4" class="e-hand"/></svg>
      <h4>No past games yet</h4><p>Every game you finish is kept here on this device: replay it, see the stats, or have it reviewed.</p>
      <button type="button" class="hs-btn pri" data-hplay>Start a game</button></section>`;
  },

  /** "3x Medium" / "Trader · Shark · Builder": the bots' profiles with their mini emblems. */
  _histBots(m, long = false) {
    const g = new Map();
    m.seats.forEach((s) => { if (s.prof) { const k = `${s.prof}${s.custom ? "~" : ""}`; g.set(k, (g.get(k) || 0) + 1); } });
    return [...g].map(([k, n]) => { const c = k.endsWith("~"), key = c ? k.slice(0, -1) : k; return `<span class="hs-bot">${profileMini(key, 16)}${n > 1 ? `${n}×` : ""} ${c ? "Custom" : esc(BOT_PROFILES[key]?.label || key)}</span>`; }).join("");
  },
  _histAcc(m, name = "") {
    if (m.acc == null) return "";
    return `<span class="hs-acc${m.prov ? " prov" : ""}" title="Game review accuracy${m.prov ? ", provisional" : ""}${m.mid ? " (checked during the game)" : ""}">${m.mid ? `<i class="mid" title="Checked during the game" aria-hidden="true"></i>` : ""}<small>${name ? esc(name) : "Accuracy"}</small>${m.prov ? "~" : ""}${m.acc}</span>`;
  },
  _histRow(m) {
    const w = m.seats[m.winner];
    const t = m.result === "won" ? `Won with ${m.seats[m.me].vp} points` : m.result === "lost" ? `Lost to ${esc(w?.name || "a bot")}` : `${esc(w?.name || "?")} won`;
    const badge = m.result === "won" ? ["won", "W"] : m.result === "lost" ? ["lost", "L"] : ["table", "•"];
    const kind = m.board === "seafarers" ? "Seafarers" : m.mode === "rush" ? "Rush" : "Classic";
    return `<li><div class="hs-row" data-hrow="${m.id}" role="button" tabindex="0" aria-label="${t}, ${when(m.end)}">
      <span class="hs-badge ${badge[0]}">${badge[1]}</span>
      <div class="hs-main"><b>${t}</b><small>${when(m.end)} · ${kind}</small></div>
      <button type="button" class="hs-star${m.star ? " on" : ""}" data-hrstar="${m.id}" aria-pressed="${!!m.star}" aria-label="${m.star ? "Unstar" : "Keep with a star"}">${STAR(m.star)}</button>
      <div class="hs-foot"><span class="hs-sc">${m.seats.map((s, i) => `<span class="${i === m.winner ? "win" : ""}" title="${esc(s.name)}">${avatarSvg(i, "hs-av")}<b>${s.vp}</b></span>`).join("")}</span><span class="hs-dur">${dur(m.ms)}</span></div>
      <div class="hs-foot2"><span class="hs-bots">${this._histBots(m)}</span>${m.hot && m.hn?.length ? m.hn.map((h) => this._histAcc(h, h.name)).join("") : this._histAcc(m)}</div></div></li>`;
  },

  _histSheet(id, again = false) {
    const m = this.hist.metas.find((x) => x.id === id);
    if (!m) { this._histSel = null; document.querySelector(".hs-sheet")?.remove(); return; }
    this._histSel = id;
    document.querySelector(".hs-sheet")?.remove();
    const sh = document.createElement("div");
    sh.className = "hs-sheet tm-modal";
    sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true"); sh.setAttribute("aria-label", "Game details");
    const w = m.seats[m.winner];
    const t = m.result === "won" ? "You won" : m.result === "lost" ? `${esc(w?.name)} won` : `${esc(w?.name)} won`;
    const kind = m.board === "seafarers" ? "Seafarers" : m.mode === "rush" ? "Rush" : "Classic";
    const unit = m.mode === "rush" ? "rolls" : "turns";
    const why = m.me == null && !(m.hot && m.hn?.length) ? "Pass & play games can’t be reviewed" : !m.rec ? "This game has no recording to review" : !reviewAvailable() ? "This browser can’t run the review in the background" : "";
    const reviewable = !why;
    const revLabel = m.acc != null && !m.prov ? ["Game review", `accuracy ${m.acc}${m.mid ? " · checked during the game" : ""} · tap to open`]
      : m.acc != null ? ["Game review · provisional", `${m.rp ? `${m.rp[0]} of ${m.rp[1]} moves checked deeply · ` : ""}tap to continue`]
      : ["Review this game", `deep Monte Carlo checks your moves · about ${Math.max(1, Math.round(((m.rd || 20) * RVCFG.sec) / 60))} min`];
    const order = [...m.seats.keys()].sort((a, b) => (b === m.winner) - (a === m.winner) || m.seats[b].vp - m.seats[a].vp);
    sh.innerHTML = `<div class="hs-card${again ? " again" : ""}"><div class="hs-grab"></div>
      <div class="hs-head"><span class="hs-badge big ${m.result === "won" ? "won" : m.result === "lost" ? "lost" : "table"}">${m.result === "won" ? "W" : m.result === "lost" ? "L" : "•"}</span><div><h4>${t}</h4><small>${when(m.end, true)}</small></div>
        <button type="button" class="hs-star${m.star ? " on" : ""}" data-sstar aria-pressed="${!!m.star}" aria-label="${m.star ? "Unstar" : "Keep with a star"}">${STAR(m.star)}</button>
        <button type="button" class="hs-x sm" data-sclose aria-label="Close">${icon("close")}</button></div>
      <ol class="hs-pod">${order.map((i, k) => { const s = m.seats[i]; return `<li class="${i === m.winner ? "win" : ""}"><span class="pl">${k + 1}</span>${avatarSvg(i, "hs-av2")}<span class="nm">${esc(s.name)}${s.you ? " <em>you</em>" : ""}${s.prof ? `<span class="hs-bot">${profileMini(s.prof, 16)}${s.custom ? "Custom" : esc(BOT_PROFILES[s.prof]?.label || "")}</span>` : ""}</span><b>${s.vp}</b></li>`; }).join("")}</ol>
      <dl class="hs-facts"><div><dt>Mode</dt><dd>${kind}</dd></div><div><dt>Players</dt><dd>${m.n}</dd></div><div><dt>${m.mode === "rush" ? "Rolls" : "Turns"}</dt><dd>${m.turns}</dd></div><div><dt>Played</dt><dd>${dur(m.ms)}</dd></div>
        <div><dt>Accuracy</dt><dd>${m.acc != null ? `${m.prov ? "~" : ""}${m.acc}${m.prov ? ` <small>provisional</small>` : m.mid ? ` <small>checked during the game</small>` : ""}` : "–"}</dd></div>
        <div><dt>Marked moves</dt><dd>${m.cls ? `${(m.cls.could || 0) + (m.cls.missed || 0)} · ${m.cls.mistake || 0} · ${m.cls.blunder || 0}<small>could be better · mistake · blunder</small>` : "–"}</dd></div></dl>
      <div class="hs-acts">
        <button type="button" class="hs-btn pri" data-sact="replay">${PLAY}Replay</button>
        <button type="button" class="hs-btn" data-sact="stats">${BARS}Stats</button>
        ${reviewable && m.hot && m.hn?.length ? m.hn.map((h) => `<button type="button" class="hs-btn wide" data-sact="review" data-spid="${h.pid}">${REVIEW}<span>Game review · ${esc(h.name)}<small>${h.acc != null ? `accuracy ${h.acc}${h.prov ? " · provisional" : ""} · tap to open` : "not checked yet · tap to start"}</small></span></button>`).join("")
          : reviewable ? `<button type="button" class="hs-btn wide" data-sact="review">${REVIEW}<span>${revLabel[0]}<small>${revLabel[1]}</small></span></button>` : `<button type="button" class="hs-btn wide" disabled>${REVIEW}<span>Game review<small>${why}</small></span></button>`}
      </div>
      <div class="hs-more"><button type="button" class="hs-link" data-sexport>${DOWN}Export file</button><span class="hs-size">${kb(m.kb)}</span><button type="button" class="hs-link del" data-sdel>${TRASH}Delete</button></div>
    </div>`;
    document.body.appendChild(sh);
    const close = () => { this._histSel = null; sh.remove(); };
    sh.addEventListener("click", (e) => { if (e.target === sh) close(); });
    sh.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    sh.querySelector("[data-sclose]").addEventListener("click", close);
    sh.querySelector("[data-sstar]").addEventListener("click", () => this._histStar(m.id));
    sh.querySelectorAll("[data-sact]").forEach((b) => b.addEventListener("click", () => { close(); this.histView(m.id, b.dataset.sact, b.dataset.spid != null ? +b.dataset.spid : null); }));
    sh.querySelector("[data-sexport]").addEventListener("click", () => this.histExport(m.id));
    const del = sh.querySelector("[data-sdel]");
    del.addEventListener("click", () => {
      if (!del.classList.contains("sure")) { del.classList.add("sure"); del.innerHTML = `${TRASH}Delete for good?`; window.setTimeout(() => { if (del.isConnected) { del.classList.remove("sure"); del.innerHTML = `${TRASH}Delete`; } }, 3000); return; }
      close(); this.hist.remove(m.id);
    });
    sh.querySelector(".hs-btn.pri")?.focus({ preventScroll: true });
  },

  /** Export one game as a file (JSON; the same shape the store keeps, readable by a later import). */
  async histExport(id) {
    const m = this.hist.metas.find((x) => x.id === id), rec = await this.hist.get(id);
    if (!m || !rec) return;
    const blob = new Blob([JSON.stringify({ format: "colonist-game", v: 1, meta: m, ...rec })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `colonist-${new Date(m.end).toISOString().slice(0, 10)}-${m.id}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },

  /** End screen line: "Saved to Past games" + the star + a link. */
  _histEndLine(ov) {
    if (!ov || ov.querySelector(".hs-saved") || this._histView) return;
    const row = document.createElement("div");
    row.className = "hs-saved";
    ov.querySelector(".gs-rbtns")?.before(row);
    const draw = () => {
      const m = this.hist.metas.find((x) => x.id === this.stats?.id);
      const h = m ? `<span>${CHECK}Saved to Past games</span><button type="button" class="hs-star${m.star ? " on" : ""}" data-estar aria-pressed="${!!m.star}">${STAR(m.star)}<em>${m.star ? "Kept" : "Keep"}</em></button><button type="button" class="hs-link" data-elist>All games ›</button>`
        : this.hist.mode === "memory" || this.hist.full ? `<span>${WARN}Not saved: no room on this device</span><button type="button" class="hs-link" data-elist>Past games ›</button>` : `<span class="dim">Saving…</span>`;
      if (row.__h === h) return; // v1.29 the review saves often while the others are checked: redraw only when it says something new
      row.__h = h; row.innerHTML = h;
      row.querySelector("[data-estar]")?.addEventListener("click", () => this._histStar(m.id));
      row.querySelector("[data-elist]")?.addEventListener("click", () => { this._histEndOpen = true; this.histOpen(); });
    };
    draw();
    const prev = this.hist.onChange;
    this.hist.onChange = () => { prev?.(); if (row.isConnected) draw(); };
    row._draw = draw;
  },
};

// ── helpers & icons ─────────────────────────────────────────────────────────────────────────────
const CHEV_L = `<svg viewBox="0 0 20 20" class="ic" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const STAR = (on) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
const PLAY = `<svg viewBox="0 0 14 16" class="ic" aria-hidden="true"><path d="M1 1.2v13.6c0 .8.9 1.3 1.6.8l10.2-6.8c.6-.4.6-1.2 0-1.6L2.6.4C1.9-.1 1 .4 1 1.2z" fill="currentColor"/></svg>`;
const BARS = `<svg viewBox="0 0 20 20" class="ic" aria-hidden="true"><path fill="currentColor" d="M3 11h3v6H3zM8.5 4h3v13h-3zM14 8h3v9h-3z"/></svg>`;
const REVIEW = `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 16l4.5 4.5M8.5 11.2l1.8 1.8 3.3-3.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const DOWN = `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TRASH = `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const WARN = `<svg viewBox="0 0 24 24" class="ic hs-wi" aria-hidden="true"><path d="M12 3.5 22 20H2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.2v.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const HISTORY_ICON = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5V8h3.5M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function dur(ms) { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; }
function kb(b) { return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`; }
function when(t, long = false) {
  const d = new Date(t), n = new Date(), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 864e5), hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const nice = diff === 0 ? "Today" : diff === 1 ? "Yesterday" : diff < 7 ? d.toLocaleDateString([], { weekday: "short" }) : d.toLocaleDateString([], { day: "numeric", month: "short", ...(d.getFullYear() !== n.getFullYear() ? { year: "numeric" } : {}) });
  return long ? `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${hm}` : `${nice} ${hm}`;
}

/** Wire it into the game class: no writes while a past game is open, archive at game over / review done. */
export function installHistory(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  wrap("saveToStorage", function (orig, ...a) { if (this._histView) return undefined; return orig.apply(this, a); });
  wrap("clearStorage", function (orig, ...a) { if (this._histView) return undefined; return orig.apply(this, a); });
  wrap("startNewGame", function (orig, ...a) { if (this._histView) { this._histView = null; this._rv = null; } return orig.apply(this, a); });
  wrap("showGameOverOverlay", function (orig, ...a) { const r = orig.apply(this, a); this.histArchive(); return r; });
  wrap("_stShowOverlay", function (orig, ...a) {
    const r = orig.apply(this, a);
    const ov = this._stOverlay;
    if (this._histView && ov) { // a past game: the "Past games" tile is the way back to the list; a label says whose game this is
      const t = ov.querySelector("[data-pastgames]");
      if (t) { t.classList.add("hs-backchip"); const sm = t.querySelector("small"); if (sm) sm.textContent = "back to the list"; }
      const m = this.hist.metas.find((x) => x.id === this._histView.id);
      const b = ov.querySelector("[data-gsback]"); // v1.26 the top-left button goes back to the list (Back does the same)
      if (b) {
        b.className = "hs-x gs-backbtn"; b.setAttribute("aria-label", "Back to Past games"); b.innerHTML = CHEV_L;
        const lab = document.createElement("div");
        lab.className = "gs-toplab";
        lab.innerHTML = `<h3>Past game</h3>${m ? `<small>${esc(when(m.end, true))}</small>` : ""}`;
        b.after(lab);
      }
      const rs = ov.querySelector("[data-rematch] small");
      if (rs) rs.textContent = "same settings as this game";
    } else this._histEndLine(ov?.querySelector(".gs-look"));
    return r;
  });
  // the review saves itself every few results, at Stop and when done: the entry follows (provisional -> deep).
  // In a past game it goes to that entry only (the "last game" slot in localStorage is left alone).
  wrap("_rvSave", function (orig, ...a) {
    if (this._histView) { this._histSoon(); return 0; }
    const r = orig.apply(this, a);
    this._histSoon();
    return r;
  });
}
