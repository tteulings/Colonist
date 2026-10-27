// End-of-game statistics, part 1: the game recorder and the numbers.
//
// A compact event log kept on game.stats (saved with the game, so a reloaded game keeps its history):
//   steps: one entry per dice roll  [turn, rollerId (-1 in Rush), d1, d2]
//   vp:    VP of every player at the end of each step (vp[0] = after set-up)
//   ev:    small arrays [step, code, ...]; step 0 is the set-up, step s happens after roll s:
//     P pid hex res n   production (res = index in RES; gold fields pay the picked resource)
//     X hex n           cards the robber blocked on its tile
//     b pid kind id     built: kind r road · s settlement · c city · h ship        u = removed (undo / ship move)
//     R pid hex         robber moved              Q pid hex   pirate moved (Seafarers)
//     t thief victim res  steal                   d pid n     discard on a 7
//     k pid give rate get bank/harbour trade      x a b na nb player trade (a gave na cards, b gave nb)
//     v pid card        development card bought   y pid type  development card played
//     m pid res n [lost per player...] Monopoly   o pid n     Year of Plenty cards
//     a award holder prev  award moved (award L = Longest Road / Trade Route, A = Largest Army; -1 = nobody)
// Builds, the robber and the pirate are recorded by diffing the board on every render (so every code
// path — set-up, bots, Rush, Road Building, undo, ship moves — is covered); the rest by small wrappers.
// The arrays stay small: a long 6-player game is a few thousand numbers (~20 KB of JSON).
import { Seafarers } from "./seafarers/index.js";

export const RES = ["wood", "brick", "sheep", "wheat", "ore"];
const KINDS = { r: "road", s: "settlement", c: "city", h: "ship" };
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const sum = (o) => RES.reduce((a, r) => a + (o?.[r] || 0), 0);

export const StatsMixin = {
  /** New game: an empty log; the board diff starts from the empty board. */
  _stReset() {
    const n = this.players.length;
    this.stats = { v: 1, n, steps: [], vp: [this.players.map(() => 0)], ev: [], r0: this.robberHexId ?? null, p0: this.sea?.pirateHexId ?? null, ms: 0 };
    this._stGoldQ = {};
    this._stLast = Date.now();
    this._stBase = this._stSnap();
    this._stBase.nodes.fill(-1); this._stBase.edges.fill(-1);
  },

  /** Saved game: keep its log (older saves have none: the history starts here, from the current board). */
  _stRestore(saved) {
    this._stGoldQ = {};
    this._stLast = Date.now();
    if (saved && Array.isArray(saved.ev) && Array.isArray(saved.steps) && saved.n === this.players.length) {
      this.stats = saved;
      this._stBase = this._stSnap();
      return;
    }
    this._stReset();
    this.stats.partial = true;
    this.stats.r0 = this.robberHexId; this.stats.p0 = this.sea?.pirateHexId ?? null;
    this._stBase = this._stSnap();
    this._stInitial(); // the pieces already on the board count as step 0
  },

  _stInitial() {
    const g = this.geometry;
    g.nodes.forEach((n) => { if (n.owner != null && n.structure) { this._stEv("b", n.owner, "s", n.id); if (n.structure === "city") this._stEv("b", n.owner, "c", n.id); } });
    g.edges.forEach((e) => { if (e.owner != null) this._stEv("b", e.owner, e.ship ? "h" : "r", e.id); });
    this.stats.vp[0] = this.players.map((p) => p.victoryPoints);
  },

  _stSave() {
    if (!this.stats) return null;
    this._stSync();
    return this.stats;
  },

  _stEv(code, ...a) {
    if (!this.stats || this._replay) return;
    this.stats.ev.push([this.stats.steps.length, code, ...a]);
  },

  _stSnap() {
    const g = this.geometry;
    const nodes = new Int16Array(g.nodes.length), edges = new Int16Array(g.edges.length);
    g.nodes.forEach((n, i) => { nodes[i] = n.owner != null && n.structure ? n.owner * 2 + (n.structure === "city" ? 1 : 0) : -1; });
    g.edges.forEach((e, i) => { edges[i] = e.owner != null ? e.owner * 2 + (e.ship ? 1 : 0) : -1; });
    return { nodes, edges, robber: this.robberHexId, pirate: this.sea?.pirateHexId ?? null };
  },

  /** Diff the board against the last snapshot: builds, removals, robber and pirate moves; refresh the VP row. */
  _stSync() {
    const S = this.stats;
    if (!S || this._replay || !this.geometry || !this.players?.length || !this._stBase) return;
    const now = Date.now();
    if (!this.winner) S.ms += Math.min(60000, Math.max(0, now - (this._stLast || now)));
    this._stLast = now;
    const cur = this._stSnap(), old = this._stBase;
    if (cur.nodes.length !== old.nodes.length || cur.edges.length !== old.edges.length) { this._stBase = cur; return; }
    for (let i = 0; i < cur.nodes.length; i += 1) {
      const a = old.nodes[i], b = cur.nodes[i];
      if (a === b) continue;
      if (a >= 0 && (b < 0 || a >> 1 !== b >> 1)) { if (a & 1) this._stEv("u", a >> 1, "c", i); this._stEv("u", a >> 1, "s", i); }
      if (b >= 0) {
        const same = a >= 0 && a >> 1 === b >> 1;
        if (!same) this._stEv("b", b >> 1, "s", i);
        if ((b & 1) && !(same && (a & 1))) this._stEv("b", b >> 1, "c", i);
        if (same && (a & 1) && !(b & 1)) this._stEv("u", b >> 1, "c", i); // undo of a city
      }
    }
    for (let i = 0; i < cur.edges.length; i += 1) {
      const a = old.edges[i], b = cur.edges[i];
      if (a === b) continue;
      if (a >= 0) this._stEv("u", a >> 1, a & 1 ? "h" : "r", i);
      if (b >= 0) this._stEv("b", b >> 1, b & 1 ? "h" : "r", i);
    }
    const mover = this._stMover ?? this.currentPlayer?.id ?? -1;
    if (cur.robber !== old.robber && cur.robber != null) this._stEv("R", mover, cur.robber);
    if (cur.pirate !== old.pirate && cur.pirate != null) this._stEv("Q", mover, cur.pirate);
    this._stMover = null;
    this._stBase = cur;
    S.vp[S.steps.length] = this.players.map((p) => p.victoryPoints);
  },

  /** A dice roll opens a new step (called where rollHistory is counted). */
  _stRoll(player, d1, d2) {
    const S = this.stats;
    if (!S || this._replay) return;
    this._stSync();
    S.steps.push([this.turn, player ? player.id : -1, d1, d2]);
    S.vp[S.steps.length] = this.players.map((p) => p.victoryPoints);
  },

  /** Player trade (every path: human, bot↔bot, incoming offers, Rush offers). */
  _stTrade(a, b, aGives, bGives) {
    this._stEv("x", a.id, b.id, sum(aGives), sum(bGives));
  },
};

/** Wrap the game methods whose effects the board diff cannot see. */
export function installStats(Cls) {
  const P = Cls.prototype;
  const wrap = (name, fn) => { const orig = P[name]; P[name] = function (...a) { return fn.call(this, orig, ...a); }; };
  const hand = (p) => ({ ...p.resources });

  wrap("render", function (orig, ...a) { this._stSync(); return orig.apply(this, a); });
  wrap("handleResize", function (orig, ...a) { if (this._rpSaved) return undefined; return orig.apply(this, a); }); // replay owns the canvas
  wrap("saveToStorage", function (orig, ...a) { if (this._replay) return undefined; return orig.apply(this, a); });

  // Production per tile (and what the robber blocked); gold fields pay what the bot picked
  wrap("distributeResources", function (orig, roll) {
    if (!this.stats || this._replay) return orig.call(this, roll);
    const g = this.geometry;
    const owedHex = []; // [pid, hex, res, n] (res -1 = gold)
    const owedTot = this.players.map(() => [0, 0, 0, 0, 0]);
    g.hexes.forEach((hex) => {
      if (hex.number !== roll) return;
      let blocked = 0;
      hex.nodes.forEach((nodeId) => {
        const node = g.nodes[nodeId];
        if (node.owner == null || node.structure == null) return;
        const k = node.structure === "city" ? 2 : 1;
        if (hex.id === this.robberHexId) { blocked += k; return; }
        const ri = RES.indexOf(hex.resource);
        owedHex.push([node.owner, hex.id, ri, k]);
        if (ri >= 0) owedTot[node.owner][ri] += k;
      });
      if (blocked) this._stEv("X", hex.id, blocked);
    });
    const before = this.players.map(hand);
    const out = orig.call(this, roll);
    this.players.forEach((p, pid) => {
      const got = RES.map((r) => Math.max(0, p.resources[r] - before[pid][r]));
      // regular tiles first (bank shortages scale them down), the rest came from gold fields
      const reg = got.map((n, ri) => Math.min(n, owedTot[pid][ri]));
      const left = reg.slice();
      owedHex.filter((o) => o[0] === pid && o[2] >= 0).forEach(([, hex, ri, k]) => {
        const n = Math.min(k, left[ri]);
        if (n > 0) { left[ri] -= n; this._stEv("P", pid, hex, ri, n); }
      });
      const goldHexes = owedHex.filter((o) => o[0] === pid && o[2] < 0).flatMap(([, hex, , k]) => Array(k).fill(hex));
      let gi = 0;
      got.forEach((n, ri) => { for (let k = reg[ri]; k < n; k += 1) this._stEv("P", pid, goldHexes[Math.min(gi++, goldHexes.length - 1)] ?? -1, ri, 1); });
      // an interactive gold pick comes later (Seafarers pickGold)
      if (goldHexes.length > gi) (this._stGoldQ[pid] = this._stGoldQ[pid] || []).push(...goldHexes.slice(gi));
    });
    return out;
  });

  wrap("_doSteal", function (orig, thief, victimId) {
    const before = hand(thief);
    const r = orig.call(this, thief, victimId);
    const res = RES.findIndex((x) => thief.resources[x] > before[x]);
    if (res >= 0) this._stEv("t", thief.id, victimId, res);
    return r;
  });
  wrap("_autoDiscard", function (orig, player, count) {
    const sel = orig.call(this, player, count);
    const n = sum(sel);
    if (n) this._stEv("d", player.id, n);
    return sel;
  });
  wrap("_confirmDiscard", function (orig, ...a) {
    const pd = this.pendingDiscard;
    const n = pd ? sum(pd.selected) : 0;
    const pid = pd?.player?.id;
    const r = orig.apply(this, a);
    if (pd && !this.pendingDiscard && n) this._stEv("d", pid, n);
    return r;
  });
  wrap("performBankTrade", function (orig, player, give, get) {
    const rate = this.getPlayerTradeRate(player, give);
    const ok = orig.call(this, player, give, get);
    if (ok) this._stEv("k", player.id, RES.indexOf(give), rate, RES.indexOf(get));
    return ok;
  });
  wrap("_swapCards", function (orig, a, aGives, b, bGives) {
    this._stTrade(a, b, aGives, bGives);
    return orig.call(this, a, aGives, b, bGives);
  });
  wrap("buyDevelopmentCard", function (orig, player) {
    const card = this.devDeck?.[this.devDeck.length - 1];
    const ok = orig.call(this, player);
    if (ok) this._stEv("v", player.id, card);
    return ok;
  });
  const monoEv = function (player, before) {
    let got = -1;
    RES.forEach((r, ri) => { if (player.resources[r] > before[player.id][r]) got = ri; });
    if (got < 0) return;
    const r = RES[got];
    const lost = this.players.map((p, i) => (i === player.id ? 0 : Math.max(0, before[i][r] - p.resources[r])));
    this._stEv("m", player.id, got, lost.reduce((a, b) => a + b, 0), ...lost);
  };
  wrap("playDevelopmentCard", function (orig, player, type) {
    const before = this.players.map(hand);
    const mover = this._stMover;
    this._stMover = player.id;
    const ok = orig.call(this, player, type);
    if (!ok) { this._stMover = mover; return ok; }
    this._stEv("y", player.id, type);
    if (!this.devPick) {
      if (type === "monopoly") monoEv.call(this, player, before);
      if (type === "yearOfPlenty") this._stEv("o", player.id, sum(player.resources) - sum(before[player.id]));
    }
    this._stSync();
    return ok;
  });
  wrap("_finishPick", function (orig, ...a) {
    const dp = this.devPick, player = this.currentPlayer;
    const before = this.players.map(hand);
    const r = orig.apply(this, a);
    if (dp && !this.devPick && player) {
      if (dp.type === "monopoly") monoEv.call(this, player, before);
      else this._stEv("o", player.id, sum(player.resources) - sum(before[player.id]));
    }
    return r;
  });
  wrap("moveRobberAndSteal", function (orig, player, hexId) {
    this._stSync();
    this._stMover = player.id;
    const r = orig.call(this, player, hexId);
    this._stSync();
    return r;
  });
  wrap("_commitRobber", function (orig, player, hexId, victim) {
    this._stSync();
    this._stMover = player.id;
    const r = orig.call(this, player, hexId, victim);
    this._stSync();
    return r;
  });
  wrap("_logAward", function (orig, name, prev, now, why) {
    if (prev !== now) this._stEv("a", /Army/.test(name) ? "A" : "L", now ?? -1, prev ?? -1);
    return orig.call(this, name, prev, now, why);
  });

  // ⚓ Seafarers: a human gold pick (and the Rush auto-pick) pays out later
  const SP = Seafarers.prototype;
  ["pickGold", "autoGold"].forEach((name) => {
    const orig = SP[name];
    if (!orig) return;
    SP[name] = function (player, ...a) {
      const g = this.g, before = { ...player.resources };
      const r = orig.call(this, player, ...a);
      RES.forEach((res, ri) => {
        for (let k = before[res]; k < player.resources[res]; k += 1) g._stEv?.("P", player.id, g._stGoldQ?.[player.id]?.shift() ?? -1, ri, 1);
      });
      return r;
    };
  });
}

// ── The numbers ──────────────────────────────────────────────────────────────────────────────────

/** Walk the log once and derive everything the stats screen and the replay need. */
export function computeStats(game) {
  const S = game.stats;
  const g = game.geometry;
  const n = game.players.length;
  const steps = S.steps;
  const N = steps.length;
  const z = () => game.players.map(() => 0);
  const zr = () => game.players.map(() => [0, 0, 0, 0, 0]);
  const out = {
    n, N, partial: !!S.partial, rush: game.isRush(), sea: !!game.sea, ms: S.ms,
    turnOf: [0, ...steps.map((s) => s[0])],
    dice: {}, rolls: N,
    prod: zr(), prodTot: z(), hexProd: g.hexes.map(() => 0), hexBlocked: g.hexes.map(() => 0),
    pHex: game.players.map(() => g.hexes.map(() => 0)), robberTurns: g.hexes.map(() => 0),
    stole: z(), stolenFrom: z(), discarded: z(), monoGot: z(), monoLost: z(), yop: z(),
    bankTrades: z(), playerTrades: z(), devBought: z(), devVP: z(), devPlayed: z(), knights: z(),
    built: game.players.map(() => ({ road: 0, settlement: 0, city: 0, ship: 0 })),
    awards: [], vp: [], expected: z(), luck: z(), robberMoves: 0, stepEvents: [],
    steps, r0: S.r0, p0: S.p0, robberAt: [S.r0], pirateAt: [S.p0],
  };
  for (let k = 2; k <= 12; k += 1) out.dice[k] = 0;
  steps.forEach((s) => { const t = s[2] + s[3]; out.dice[t] = (out.dice[t] || 0) + 1; });
  // VP rows (fill gaps from the previous step)
  let last = S.vp[0] || z();
  for (let s = 0; s <= N; s += 1) { last = S.vp[s] || last; out.vp.push(last.slice()); }
  out.vp[N] = game.players.map((p) => p.victoryPoints);

  // per step: events, and the board state for the expected production
  const byStep = Array.from({ length: N + 1 }, () => []);
  S.ev.forEach((e) => { if (e[0] >= 0 && e[0] <= N) byStep[e[0]].push(e); });
  out.stepEvents = byStep;
  const owner = new Map(); // nodeId -> [pid, mult]
  let robber = S.r0, pirate = S.p0;
  for (let s = 0; s <= N; s += 1) {
    if (s > 0) {
      // expected over the whole game = for each roll the probability-weighted yield (independent of the roll)
      g.hexes.forEach((h) => {
        if (!h.number || h.id === robber || h.resource === "sea" || h.resource === "desert") return;
        h.nodes.forEach((nid) => { const o = owner.get(nid); if (o) out.expected[o[0]] += (PIPS[h.number] / 36) * o[1]; });
      });
      out.robberAt[s] = robber; out.pirateAt[s] = pirate;
      if (robber != null) out.robberTurns[robber] += 1;
      if (pirate != null) out.robberTurns[pirate] += 1;
    }
    byStep[s].forEach((e) => {
      const [, c, a, b, x, y] = e;
      switch (c) {
        case "P": if (b >= 0) { out.hexProd[b] += y; out.pHex[a][b] += y; } out.prod[a][x] += y; out.prodTot[a] += y; break;
        case "X": out.hexBlocked[a] += b; break;
        case "b": out.built[a][KINDS[b]] += 1;
          if (b === "s") owner.set(x, [a, 1]); else if (b === "c") owner.set(x, [a, 2]);
          break;
        case "u": out.built[a][KINDS[b]] -= 1;
          if (b === "s") owner.delete(x); else if (b === "c" && owner.get(x)) owner.set(x, [a, 1]);
          break;
        case "R": robber = b; out.robberMoves += 1; break;
        case "Q": pirate = b; break;
        case "t": out.stole[a] += 1; out.stolenFrom[b] += 1; break;
        case "d": out.discarded[a] += b; break;
        case "k": out.bankTrades[a] += 1; break;
        case "x": out.playerTrades[a] += 1; out.playerTrades[b] += 1; break;
        case "v": out.devBought[a] += 1; if (b === "victoryPoint") out.devVP[a] += 1; break;
        case "y": out.devPlayed[a] += 1; if (b === "knight") out.knights[a] += 1; break;
        case "m": out.monoGot[a] += x; e.slice(5).forEach((l, i) => { out.monoLost[i] += l; }); break;
        case "o": out.yop[a] += b; break;
        case "a": out.awards.push({ s, kind: a, pid: b, prev: x }); break;
        default: break;
      }
    });
  }
  out.luck = out.expected.map((e, i) => (e > 0.5 ? out.prodTot[i] / e - 1 : 0));

  // VP sources (final state)
  out.sources = game.players.map((p, i) => {
    const src = {
      settlements: p.settlements.size, cities: p.cities.size * 2,
      road: game.longestRoadHolder === i ? 2 : 0, army: game.largestArmyHolder === i ? 2 : 0,
      cards: p.devVictoryPoints, islands: game.sea ? game.sea.bonusVP(p) : 0,
    };
    src.total = src.settlements + src.cities + src.road + src.army + src.cards + src.islands;
    return src;
  });

  // takeaways
  const winner = game.winner ? game.winner.id : out.vp[N].indexOf(Math.max(...out.vp[N]));
  out.winner = winner;
  let leadFrom = 0;
  for (let s = 0; s <= N; s += 1) {
    const row = out.vp[s], w = row[winner];
    if (row.some((v, i) => i !== winner && v > w)) leadFrom = s + 1; // behind someone: the lead starts later
  }
  out.leadFrom = Math.min(leadFrom, N);
  let swing = { pid: winner, s: N, d: 0 };
  for (let s = 1; s <= N; s += 1) out.vp[s].forEach((v, i) => { const d = v - out.vp[s - 1][i]; if (d > swing.d) swing = { pid: i, s, d }; });
  out.swing = swing;
  let leadChanges = 0, prevLeader = -1;
  out.vp.forEach((row) => { const m = Math.max(...row); const ls = row.flatMap((v, i) => (v === m ? [i] : [])); if (ls.length === 1 && ls[0] !== prevLeader) { if (prevLeader >= 0) leadChanges += 1; prevLeader = ls[0]; } });
  out.leadChanges = leadChanges;
  // dice: the number furthest from its expectation (in rolls)
  let dev = { k: 7, d: 0 };
  for (let k = 2; k <= 12; k += 1) { const e = (N * PIPS[k]) / 36; const d = out.dice[k] - e; if (Math.abs(d) > Math.abs(dev.d)) dev = { k, d, e }; }
  if (dev.e == null) dev.e = (N * PIPS[dev.k]) / 36;
  out.diceDev = dev;
  // dice strip: rounds (Classic) or groups of rolls (Rush) × numbers
  const per = out.rush ? Math.max(1, Math.ceil(N / 32)) : 1;
  const cols = [];
  steps.forEach((s, i) => { const c = out.rush ? Math.floor(i / per) : s[0]; let col = cols.find((x) => x.c === c); if (!col) { col = { c, n: {} }; cols.push(col); } const t = s[2] + s[3]; col.n[t] = (col.n[t] || 0) + 1; });
  // too many rounds for the card: merge neighbours
  let colsOut = cols;
  if (cols.length > 36) { const m = Math.ceil(cols.length / 36); colsOut = []; cols.forEach((c, i) => { const j = Math.floor(i / m); if (!colsOut[j]) colsOut[j] = { c: c.c, n: {} }; Object.entries(c.n).forEach(([k, v]) => { colsOut[j].n[k] = (colsOut[j].n[k] || 0) + v; }); }); }
  out.strip = colsOut;
  // longest drought of a likely number (5, 6, 8, 9), in rounds
  let drought = null;
  [6, 8, 5, 9].forEach((k) => {
    let run = 0, start = 0;
    colsOut.forEach((c, i) => { if (!c.n[k]) { if (!run) start = i; run += 1; if (!drought || run > drought.len) drought = { k, len: run, start, end: i }; } else run = 0; });
  });
  out.drought = drought;
  out.stripUnit = out.rush ? per : Math.max(1, colsOut.length ? Math.round((cols.length / colsOut.length)) : 1);
  return out;
}
