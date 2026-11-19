// v1.94 Lessons: which lessons the reviewed games add up to (pure: no DOM). Input: the games' rows (src/lessons-row.js), newest first. Rules of the house:
//  - only counts the saved data proves ("in 3 of 5 games"), the opponents as the baseline, no causes; the win chance lost of a game is never summed over games (a mean per game, +- spread)
//  - a LESSON needs >= 3 games, >= 3 marked moves of one kind in >= 2 games (each >= 3 points), in >= 40% of the games, no game holding > 75% and no move > 50% of the cost.
//    A pattern with less is "too little to say" (a watch with its progress), or nothing. Mechanisms (a scarce resource, robber losses, 4:1 trades) need N >= 4 and a rate above the opponents'.
//  - lessons appear and disappear with the evidence of the last 12 games; a lesson is learned after m clean games in a row, m such that a player who errs at the lesson's own rate
//    would stay clean m times by chance only <= 10%; it then moves to "going well".
export const MIN = { games: 3, moves: 3, gamesWithMove: 2, share: 0.4, big: 3 };
export const WINDOW = 12;
export const CAT_IDS = ["setup", "build", "timing", "trade", "dev", "robber"];
export const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const se = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)) / Math.sqrt(a.length); };
export const wilson = (k, n, z = 1.28) => { if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)]; };
export const streakNeeded = (p) => { let m = 3; while (Math.pow(1 - p, m) > 0.1 && m < 8) m++; return m; };

/** the games the lessons are made from: reviewed, with a row, the newest 12 that were reviewed like the newest one (same review engine tag; the scores are re-scored by the current formula whatever their stored format) */
export function usable(items) {
  const have = items.filter((g) => g.lr), first = have[0]; if (!first) return { used: [], skipped: 0 };
  const same = have.filter((g) => g.lr.ek === first.lr.ek);
  return { used: same.slice(0, WINDOW), skipped: have.length - same.length };
}
const gamesOf = (used) => used.map((g) => ({ id: g.id, end: g.end, result: g.result, vp: g.vp, lr: g.lr, gp: g.lr.gp, marks: g.lr.marks }));

function decLesson(cat, G) { // G: oldest first
  const N = G.length, per = G.map((g) => g.lr.cl?.[cat] || [0, 0]), gpg = per.map((p) => p[1]), moves = sum(per.map((p) => p[0])), total = sum(gpg);
  // an example that shows the same move twice (no board spot to compare, same kind and detail) teaches nothing: it counts in the numbers but is not shown
  const same = (d) => !(d.p && d.q && d.p[0] === d.q[0]) && d.pk === d.bk && JSON.stringify(d.pd ?? null) === JSON.stringify(d.bd ?? null);
  const ds = G.flatMap((g) => g.lr.dec.filter((d) => d.c === cat).map((d) => ({ ...d, gid: g.id, end: g.end, result: g.result })));
  const top = ds.slice().sort((a, b) => b.g - a.g)[0] || null, games = per.filter((p) => p[0]).length;
  const bigGames = G.filter((g) => g.lr.dec.some((d) => d.c === cat && d.g >= MIN.big)).length;
  const topGame = Math.max(0, ...gpg), concentrated = total > 0 && (topGame / total > 0.75 || (top ? top.g / total > 0.5 : false));
  const enough = N >= MIN.games && moves >= MIN.moves && bigGames >= MIN.gamesWithMove && games / N >= MIN.share && !concentrated;
  const status = enough ? "les" : moves >= 2 || (top && top.g >= 10) ? "watch" : "quiet";
  const clean = (() => { let c = 0; for (let i = N - 1; i >= 0 && !per[i][0]; i--) c++; return c; })();
  const rec = gpg.slice(-3), old = gpg.slice(0, -3), trend = old.length >= 3 && rec.length >= 3 ? { recent: mean(rec), earlier: mean(old) } : null;
  const topShare = total > 0 ? Math.max(top ? top.g / total : 0, topGame / total) : 0;
  // what is still missing, and how far it is (the bar is the share of the three conditions met, never full while it is a watch)
  const need = status === "watch" ? (N < MIN.games ? { games: MIN.games - N } : bigGames < MIN.gamesWithMove ? { games: MIN.gamesWithMove - bigGames } : moves < MIN.moves ? { moves: MIN.moves - moves } : games / N < MIN.share ? { share: [Math.round(100 * games / N), Math.round(100 * MIN.share)] } : concentrated ? { spread: Math.round(100 * topShare), limit: 50 } : {}) : null;
  const ratio = need?.games ? (N < MIN.games ? N / MIN.games : bigGames / MIN.gamesWithMove) : need?.moves ? moves / MIN.moves : need?.share ? (games / N) / MIN.share : need?.spread ? Math.min(1, (need.limit / 100) / Math.max(0.01, topShare)) : 0.9;
  const prog = Math.min(0.95, Math.max(0.05, ratio));
  return { id: "dec-" + cat, kind: "dec", cat, status, cost: total / N, se: se(gpg), k: games, N, moves, total, top, bigGames, concentrated, need, prog, clean, trend, series: G.map((g, i) => ({ id: g.id, end: g.end, result: g.result, v: gpg[i] })), examples: ds.filter((d) => !same(d)).sort((a, b) => b.g - a.g || b.end - a.end), p: games / N };
}
const g_blk = (rb) => { const b = rb.filter((g) => g.lr.rb); return b.length ? { mine: mean(b.map((g) => g.lr.rb[0])), opp: mean(b.map((g) => g.lr.rb[1])), N: b.length } : null; };
function mechLessons(G) {
  const out = { lessons: [], watch: [], strong: [] };
  const sc = G.filter((g) => g.lr.sc), N = sc.length;
  R5.forEach((r, ri) => {
    const mine = sum(sc.map((g) => g.lr.sc[ri])), opp = sum(sc.map((g) => g.lr.oc[ri])), oppN = sum(sc.map((g) => g.lr.on)), [lo] = wilson(mine, N), rate = oppN ? opp / oppN : 0;
    const base = { id: "res-" + r, kind: "res", res: r, k: mine, N, opp, oppN, series: sc.map((g) => ({ id: g.id, end: g.end, result: g.result, v: g.lr.sc[ri] })), cost: null };
    if (N >= 4 && mine / N >= 0.6 && lo > rate) out.lessons.push({ ...base, status: "les" });
    else if (N >= 4 && mine >= 3 && mine / N >= 0.5) out.watch.push({ ...base, status: "watch", prog: Math.min(0.95, mine / N / 0.6), need: { share: [Math.round(100 * mine / N), 60] } });
  });
  const rb = G.filter((g) => g.lr.rob), RN = rb.length;
  if (RN) {
    const worse = rb.filter((g) => g.lr.rob[0] >= g.lr.rob[1] + 5), low = rb.filter((g) => g.lr.rob[0] < g.lr.rob[1] - 3);
    const base = { id: "rob", kind: "rob", N: RN, mine: mean(rb.map((g) => g.lr.rob[0])), opp: mean(rb.map((g) => g.lr.rob[1])), blk: g_blk(rb), series: rb.map((g) => ({ id: g.id, end: g.end, result: g.result, v: g.lr.rob[0], o: g.lr.rob[1] })), cost: null };
    if (RN >= 4 && worse.length / RN >= 0.6) out.lessons.push({ ...base, status: "les", k: worse.length });
    else if (worse.length >= 3 && worse.length / RN >= 0.4) out.watch.push({ ...base, status: "watch", k: worse.length, prog: Math.min(0.95, worse.length / RN / 0.6), need: { share: [Math.round(100 * worse.length / RN), 60] } });
    if (RN >= 3 && low.length >= 3 && low.length / RN >= 0.5) out.strong.push({ ...base, status: "strong", k: low.length });
  }
  const bk = G.filter((g) => g.lr.b4), BN = bk.length;
  if (BN) {
    const many = bk.filter((g) => g.lr.b4[0] >= 3 && g.lr.b4[0] >= g.lr.b4[1] + 2);
    const base = { id: "b4", kind: "b4", N: BN, k: many.length, mine: mean(bk.map((g) => g.lr.b4[0])), opp: mean(bk.map((g) => g.lr.b4[1])), series: bk.map((g) => ({ id: g.id, end: g.end, result: g.result, v: g.lr.b4[0], o: g.lr.b4[1] })), cost: null };
    if (BN >= 4 && many.length / BN >= 0.5) out.lessons.push({ ...base, status: "les" });
    else if (many.length >= 3 && many.length / BN >= 0.4) out.watch.push({ ...base, status: "watch", prog: Math.min(0.95, many.length / BN / 0.5), need: { share: [Math.round(100 * many.length / BN), 50] } });
  }
  return out;
}
/** items: [{ id, end, result, vp, lr }] newest first. */
export function buildLessons(items) {
  const { used, skipped } = usable(items), G = gamesOf(used).reverse(); // oldest first inside
  const out = { N: G.length, skipped, moves: sum(G.map((g) => g.marks)), games: G.slice().reverse(), lessons: [], watch: [], strong: [] };
  if (!G.length) return out;
  const decs = CAT_IDS.map((c) => decLesson(c, G));
  decs.forEach((d) => { if (d.status === "les") out.lessons.push(d); else if (d.status === "watch") out.watch.push(d); });
  // learned: it was a lesson before the last m games, and those m games are clean
  CAT_IDS.forEach((c) => {
    const d = decs.find((x) => x.cat === c); if (!d || d.status === "les") return;
    for (let m = 3; m <= 8; m++) {
      if (G.length - m < MIN.games) break;
      const old = decLesson(c, G.slice(0, G.length - m));
      if (old.status === "les" && streakNeeded(old.p) <= m && d.clean >= m) { out.strong.push({ id: "learned-" + c, kind: "learned", cat: c, status: "strong", m, N: G.length, k: old.k, series: d.series }); break; }
    }
  });
  const mech = mechLessons(G);
  out.lessons.push(...mech.lessons); out.watch.push(...mech.watch); out.strong.push(...mech.strong);
  const cmp = (a, b) => (b.cost ?? -1) - (a.cost ?? -1) || b.k - a.k;
  out.lessons.sort(cmp); out.watch.sort(cmp);
  const clean = G.filter((g) => !g.marks).length; if (clean >= 2) out.strong.push({ id: "clean", kind: "clean", status: "strong", k: clean, N: G.length });
  return out;
}
