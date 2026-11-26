// v1.99.5 DAILY PUZZLE: what the game class needs (installed on the prototype like history.js; inert while `game.daily` is null, so a normal game plays,
// saves and serializes exactly as before).
//   game.daily = { day, rules, practice, startedAt, rollIx, stealIx, dk: [n, n, n], timeUp, gaveUp }   the run on screen (null: a normal game)
//   - the board, the ports and the development deck come from the day seed (Math.random is the seeded stream while resetGame() runs)
//   - the dice: the day's list indexed by roll number; a steal: the day's list indexed by steal number; a development card: your n-th buy is the
//     n-th card of your own stack (so what you build never changes what a roll or a card is)
//   - you sit in seat 0 and start; the limit is 40 of your turns ("Tijd op"); the run saves under its own key, apart from the normal saved game
//   - the end of the run is the daily result screen (src/daily-ui.js), the stock end screen stays under it for Review
import { dayDef, dayLook, DAY_SETTINGS, DAILY_RULES, TURN_LIMIT, WIN_POINTS, KEYS, mulberry32, nowMs, clearRun, encode, dayLink, loadRunMeta } from "./daily.js";

const LIVE_DAILY = "colonist.live.daily"; // sessionStorage: this tab is in a daily run (a reload goes back into it)
const ss = { get() { try { return sessionStorage.getItem(LIVE_DAILY); } catch (_) { return null; } }, set(v) { try { if (v) sessionStorage.setItem(LIVE_DAILY, "1"); else sessionStorage.removeItem(LIVE_DAILY); } catch (_) { /* private mode */ } } };

export function installDaily(Cls, H) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; if (!orig) return; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  /** Run `fn` with the saved-game key swapped to the daily run's (everything is synchronous, so nothing else can see the swap). */
  const withKey = (key, fn) => { const k0 = Cls.STORAGE_KEY; Cls.STORAGE_KEY = key; try { return fn(); } finally { Cls.STORAGE_KEY = k0; } };
  const def = (g) => dayDef(g.daily.day, g.daily.rules);

  // ── the chance ──
  wrap("rollDice", function (orig, ...a) {
    const d = this.daily;
    if (!d) return orig.apply(this, a);
    const rolls = def(this).rolls, r = rolls[d.rollIx % rolls.length]; d.rollIx += 1;
    this.lastDiceTotal = r[0] + r[1];
    return { total: r[0] + r[1], d1: r[0], d2: r[1] };
  });
  wrap("_doSteal", function (orig, ...a) {
    const d = this.daily;
    if (!d) return orig.apply(this, a);
    const u = def(this).steal[d.stealIx % def(this).steal.length]; d.stealIx += 1;
    const saved = Math.random; Math.random = () => u;
    try { return orig.apply(this, a); } finally { Math.random = saved; }
  });
  wrap("buyDevelopmentCard", function (orig, player, ...a) {
    const d = this.daily;
    if (!d || !this.devDeck?.length) return orig.call(this, player, ...a);
    const stack = def(this).dev[player.id % 3], card = stack[d.dk[player.id % 3] % stack.length], top = this.devDeck[this.devDeck.length - 1];
    this.devDeck[this.devDeck.length - 1] = card; // the card this purchase will draw
    const ok = orig.call(this, player, ...a);
    if (ok) d.dk[player.id % 3] += 1; else if (this.devDeck.length && this.devDeck[this.devDeck.length - 1] === card) this.devDeck[this.devDeck.length - 1] = top;
    return ok;
  });

  // ── the limit ──
  wrap("_advanceTurn", function (orig, ...a) {
    const r = orig.apply(this, a);
    const d = this.daily;
    if (d && !this.winner && this.turn > TURN_LIMIT) {
      const leader = this.players.reduce((best, cur) => (cur.victoryPoints > best.victoryPoints ? cur : best));
      d.timeUp = true; this.winner = leader; this.phase = "game_over";
      this.emit({ type: "turnLimit", seat: leader.id });
      this.stopAutoplay?.();
      this.saveToStorage();
      this.showGameOverOverlay();
    }
    return r;
  });

  // ── saving: the run has its own key ──
  wrap("saveToStorage", function (orig, ...a) { const d = this.daily; if (!d) return orig.apply(this, a); if (d.practice) return undefined; return withKey(KEYS.run, () => orig.apply(this, a)); });
  wrap("clearStorage", function (orig, ...a) { const d = this.daily; if (!d) return orig.apply(this, a); if (d.practice) return undefined; return withKey(KEYS.run, () => orig.apply(this, a)); });
  wrap("serializeState", function (orig, ...a) { const s = orig.apply(this, a); if (this.daily) s.daily = JSON.parse(JSON.stringify(this.daily)); return s; });
  wrap("loadFromStorage", function (orig, state = null, ...a) {
    let d = null;
    try {
      const raw = state ? null : localStorage.getItem(this._dailyLoad ? KEYS.run : Cls.STORAGE_KEY);
      const data = state || (raw ? JSON.parse(raw) : null);
      if (data?.daily && data.winnerId == null && (state || this._dailyLoad)) d = data.daily;
    } catch (_) { /* unreadable: the original reports it */ }
    this.daily = d;
    return this._dailyLoad ? withKey(KEYS.run, () => orig.call(this, state, ...a)) : orig.call(this, state, ...a);
  });
  wrap("_hasResumableSave", function (orig, ...a) { return this.daily ? false : orig.apply(this, a); });
  wrap("startNewGame", function (orig, ...a) { this.daily = null; ss.set(false); this.dailyUi?.sync?.(); return orig.apply(this, a); });
  wrap("goHome", function (orig, ...a) {
    const d = this.daily, r = orig.apply(this, a); // (a run saves itself here, to its own key)
    if (d) { ss.set(false); if (d.practice || this.winner) this.daily = null; }
    this.dailyUi?.sync?.();
    return r;
  });

  // ── the end ──
  wrap("showGameOverOverlay", function (orig, opts = {}, ...a) {
    const d = this.daily;
    if (!d || d.done) return orig.call(this, opts, ...a);
    d.done = true;
    const res = this._dailyResult();
    const r = orig.call(this, { ...(opts || {}), quiet: true }, ...a); // the stock end screen (and the history entry for Review) is made quietly under the daily screen
    ss.set(false);
    if (!d.practice) clearRun();
    this.daily = null; // from here the finished game is a normal one on screen (nothing of it saves to the run key any more)
    window.setTimeout(() => this.dailyUi?.finish(res), 0);
    return r;
  });
  /** The finished run as a record. */
  P._dailyResult = function () {
    const d = this.daily, me = this.players[0], bots = this.players.slice(1), w = !d.timeUp && !d.gaveUp && this.winner === me && me.victoryPoints >= WIN_POINTS;
    const p = [me.victoryPoints, bots[0]?.victoryPoints ?? 0, bots[1]?.victoryPoints ?? 0].map((x) => Math.max(0, Math.min(15, x)));
    const t = d.timeUp ? TURN_LIMIT : Math.max(1, Math.min(TURN_LIMIT, this.turn));
    const lr = this.longestRoadHolder === 0 ? 1 : 0;
    const rec = { day: d.day, rules: d.rules, w: w ? 1 : 0, t, p, pc: [me.settlements.size, me.cities.size, lr], n: bots.map((b) => b.name), h: this.stats?.id || null, ts: nowMs(), practice: !!d.practice, by: !w && this.winner && this.winner !== me ? this.winner.name : null };
    rec.code = encode({ day: rec.day, w: rec.w, t: rec.t, p: rec.p });
    return rec;
  };
  /** "Opgeven": the run ends as a loss with the points as they are. */
  P.dailyGiveUp = function () {
    const d = this.daily; if (!d || this.winner) return;
    const leader = this.players.slice(1).reduce((best, cur) => (cur.victoryPoints > best.victoryPoints ? cur : best));
    d.gaveUp = true; this.winner = leader; this.phase = "game_over";
    this.stopAutoplay?.(); this._cancelPendingWork?.();
    this.saveToStorage();
    this.showGameOverOverlay();
  };

  // ── start, resume ──
  /** Start the day (practice: nothing is saved or counted). The player's own New game settings are neither used nor changed. */
  P.startDaily = function (day, { practice = false } = {}) {
    const dd = dayDef(day);
    this._releaseOnboarding(false);
    this._markLive(false); ss.set(!practice);
    const mine = H.normalizeSettings(H.loadLast()).look?.[0] ?? 0;
    this.settings = H.normalizeSettings({ ...DAY_SETTINGS, look: dayLook(mine) });
    this._hostBroken = false;
    this.daily = { day, rules: DAILY_RULES, practice: !!practice, startedAt: nowMs(), rollIx: 0, stealIx: 0, dk: [0, 0, 0] };
    const keep = Math.random; Math.random = mulberry32(dd.seed);
    try { this.resetGame(); } finally { Math.random = keep; }
    this._buildStrategyUI();
    if (!practice) this.saveToStorage();
    this.dailyUi?.sync?.();
  };
  /** Home › Maak af: the saved run comes back (it was saved after every move). */
  P.resumeDaily = function () {
    this._markLive(false); ss.set(true);
    this.onboardingHold = false; this._homeSave = false; this.uiPaused = false;
    this.home?.close(); this.onboarding?.close();
    this._chipEnterPending = true;
    this._dailyLoad = true;
    let ok = false;
    try { ok = this.loadFromStorage(); } finally { this._dailyLoad = false; }
    if (!ok) { this.daily = null; ss.set(false); this.goHome?.(); return false; }
    window.setTimeout(() => { if (this._chipEnterPending) this._playStripEntrance(); }, 120);
    this._buildStrategyUI();
    this.dailyUi?.sync?.();
    return true;
  };
  /** A reload in the middle of a run goes straight back into it (game.js constructor). */
  P._dailyBoot = function () { return ss.get() === "1" && !!loadRunMeta() && this.resumeDaily(); };

  // ── what the cards show before a run ──
  /** The day's board as { hexes: [{ resource, number }], ports } from its seed (the same call order as resetGame: the first thing that draws is the tiles). */
  Cls.dailyBoard = function (day) {
    const dd = dayDef(day), keep = Math.random;
    Math.random = mulberry32(dd.seed);
    try {
      const geo = H.createBoardGeometry(600, 600, null, false, false);
      H.assignTiles(geo, DAY_SETTINGS.map);
      return geo.hexes.map((h) => ({ q: h.q, r: h.r, resource: h.resource, number: h.number }));
    } finally { Math.random = keep; }
  };
  Cls.dailyLink = dayLink;
}
