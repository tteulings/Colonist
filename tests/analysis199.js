// v1.99 post-game analysis DATA LAYER: invariants on REAL games (no server, no browser).   node tests/analysis199.js   (VERBOSE=1 lists every check)
// Real data (tests/fixtures/analysis199-games.json.gz, built by tests/evals/build-analysis199.mjs):
//   reviewed: the saved, fully reviewed 4-player game of tests/fixtures/ui191-game.json (all four seats reviewed = 4 seat views, with the review's luck run and the recorder's vp series)
//   log: three real games of tests/evals/ledger (full event log) with their final points from tests/evals/fixtures
// Synthetic only where a real game cannot show the case (a 6-player special build phase, thresholds, a rule table row); marked "synthetic".
const fs = require("fs"), zlib = require("zlib"), path = require("path");
let total = 0, fails = 0;
const ok = (c, m, x = "") => { total++; if (!c) { fails++; console.log(`FAIL ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); } else if (process.env.VERBOSE) console.log(`ok   ${m}`); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, { got: a, want: b });
const R = (p) => import(path.join(__dirname, "..", p));
const clone = (o) => JSON.parse(JSON.stringify(o));
const sum = (a) => a.reduce((x, y) => x + y, 0);

(async () => {
  const [F, C, T, S, ROW, EV, LE, LAB] = await Promise.all([R("src/review/analysis-facts.js"), R("src/review/coach-rules.js"), R("src/review/analysis-text.js"), R("src/review/score.js"), R("src/lessons-row.js"), R("src/review/evaluate.js"), R("src/lessons-eval.js"), R("src/lab-stats.js")]);
  const DATA = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, "fixtures", "analysis199-games.json.gz"))).toString());
  const GAMES = DATA.games, REV = GAMES.filter((g) => g.kind === "reviewed"), LOG = GAMES.filter((g) => g.kind === "log");
  const input = (g, me = g.me, extra = {}) => ({ state: g.state, rv: g.rv || null, meta: g.meta || null, me, names: g.names, finalPts: g.finalPts, winner: g.winner, ...extra });
  const walk = (v, f, p = "$") => { f(v, p); if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, f, `${p}.${k}`); };
  const SNAP = JSON.stringify(DATA);

  // ═══ 0 the data ═══
  ok(GAMES.length >= 4 && REV.length >= 1 && LOG.length >= 3, "fixture: 1 reviewed game and 3 log games", GAMES.map((g) => g.id + ":" + g.kind));
  REV.forEach((g) => ok(Object.keys(g.rv.reviews).length === g.n, `${g.id}: every seat of the reviewed game has a review (${g.n} seat views)`));
  eq(typeof ROW.kindOf, "function", "kindOf is exported from lessons-row.js");
  [["City on 4·6·5", "city"], ["Settlement 11·10 +1 road", "settlement"], ["Road toward 11·10", "road"], ["Bank trade 4 Ore → 1 Wool", "bank"], ["End turn (saves its cards)", "end"], ["Dev card", "card"], ["Play Knight", "card"], ["Robber on Ore 6", "robber"]]
    .forEach(([l, k]) => eq(ROW.kindOf(l), k, `kindOf("${l}")`));
  [["Trade Lumber → 1 Ore, then City on 10·4·6", "city"], ["Trade Grain → 1 Lumber, then Settlement 8·11 +1 road", "settlement"], ["Trade Ore → 1 Grain, then Dev card", "card"], ["City on 9·6·4", "city"], ["End turn", "end"], ["Trade Wool + Brick → 2 Grain, then City on 4·6·11", "city"], [undefined, "other"]]
    .forEach(([l, k]) => eq(C.bestKindOf(l), k, `bestKindOf(${JSON.stringify(l)}) takes the kind after "then"`));

  // ═══ 1 phases: dynamic thirds ═══
  for (let n = 0; n <= 60; n++) {
    const L = C.phaseLimits(n), seen = [];
    for (let t = 1; t <= n; t++) seen.push(C.phaseOf(t, L));
    const cnt = (p) => seen.filter((x) => x === p).length;
    ok(cnt("opening") + cnt("mid") + cnt("end") === n, `thirds of ${n} turns cover every turn once`);
    if (n >= 3) { ok(L.opening[0] === 1 && L.mid[0] === L.opening[1] + 1 && L.end[0] === L.mid[1] + 1 && L.end[1] === n, `${n} turns: ranges are contiguous and end on the last turn`, L); ok(cnt("opening") >= 1 && cnt("mid") >= 1 && cnt("end") >= 1 && Math.max(cnt("opening"), cnt("mid"), cnt("end")) - Math.min(cnt("opening"), cnt("mid"), cnt("end")) <= 1 + (n % 3 ? 1 : 0), `${n} turns: the three parts are about equal`, [cnt("opening"), cnt("mid"), cnt("end")]); }
    ok(C.phaseOf(n + 5, L) === "end", `a turn after turn ${n} counts as end`);
    eq(C.turnsOf(L, "mid"), L.mid, `turnsOf mid for ${n} turns`);
  }

  // ═══ 2 visible points by replaying the log ═══
  for (const g of GAMES) {
    const st = g.state.stats, n = g.n, vis = C.visibleSeries(st, n), pl = C.pointsLog(st, n);
    ok(vis.length === st.steps.length + 1, `${g.id}: one visible-points row per step (+ set-up)`, [vis.length, st.steps.length]);
    ok(vis[0].every((v) => v === 2), `${g.id}: every seat has 2 visible points after set-up`, vis[0]);
    ok(vis.every((r) => r.length === n && r.every((v) => Number.isInteger(v) && v >= 0)), `${g.id}: visible points are whole and never negative`);
    const fin = vis[vis.length - 1], hid = pl.hidden[pl.N], want = g.state.players.map((p) => p.victoryPoints);
    eq(fin.map((v, q) => v + hid[q]), want, `${g.id}: final visible points + hidden victory-point cards = the final points of the game`);
    ok(fin.every((v, q) => v <= want[q] && want[q] - v === hid[q]), `${g.id}: the difference to the final points is exactly the hidden cards`);
    ok(C.pointsBefore(pl, 1, 0) === 2, `${g.id}: points before turn 1 = 2`);
    ok(C.pointsAfter(pl, pl.turnOf[pl.N], 0) === fin[0], `${g.id}: points after the last turn = final visible`);
    const bf = F.buildFacts(st, n);
    bf.forEach((b, q) => {
      const awards = fin[q] - (b.startSettlement + b.settlement + b.city);
      ok([0, 2, 4].includes(awards), `${g.id} seat ${q}: points = start settlements + settlements + cities + 2 per award held`, { fin: fin[q], b, awards });
      ok(b.startSettlement === 2 && b.startRoad === 2, `${g.id} seat ${q}: two start settlements and roads`, b);
    });
    eq(sum(bf.map((b) => b.bank)), st.ev.filter((e) => e[1] === "k").length, `${g.id}: bank trades counted once per trade`);
    eq(sum(bf.map((b) => b.player)), 2 * st.ev.filter((e) => e[1] === "x").length, `${g.id}: a player trade counts for both seats`);
    eq(sum(bf.map((b) => b.cards)), st.ev.filter((e) => e[1] === "v").length, `${g.id}: cards bought`);
    bf.forEach((b, q) => ok(b.firstCity == null ? b.city === 0 : b.city >= 1 && b.firstCity >= 1 && b.firstCity <= st.steps[st.steps.length - 1][0], `${g.id} seat ${q}: first city turn is inside the game`, b.firstCity));
  }
  REV.forEach((g) => { // the recorder's own series, minus the hidden cards, equals the replay (4-player game: no transient steps)
    const st = g.state.stats, a = C.visibleSeries(st, g.n), b = C.vpSeries(st, g.n);
    ok(st.vp && b, `${g.id}: the game has the recorder's vp series`);
    a.forEach((row, s) => eq(row, b[s], `${g.id} step ${s}: visible points from the log = stats.vp minus hidden victory-point cards`));
  });
  { // synthetic 6-player game: the recorder's series is off by one in the special build phase; the replay of the log is exact
    const n = 6, steps = [], ev = [], vp = [Array(n).fill(0)];
    for (let q = 0; q < n; q++) { ev.push([0, "b", q, "s", q * 2], [0, "b", q, "s", q * 2 + 1], [0, "b", q, "r", q], [0, "b", q, "r", q + 10]); }
    vp[0] = Array(n).fill(2);
    for (let s = 1; s <= 12; s++) { steps.push([Math.ceil(s / 6), (s - 1) % 6, 3, 4]); vp[s] = vp[s - 1].slice(); }
    ev.push([2, "b", 1, "c", 2]); vp[2] = vp[2].map((v, q) => (q === 1 ? 3 : v)); for (let s = 3; s <= 12; s++) vp[s][1] = 3;
    ev.push([5, "v", 2, "victoryPoint"]); for (let s = 5; s <= 12; s++) vp[s][2] += 1; // a hidden card
    vp[7] = vp[7].map((v, q) => (q === 3 ? v + 1 : v)); // transient off-by-one at step 7 only
    const st = { v: 1, n, steps, vp, ev, r0: 0 }, vis = C.visibleSeries(st, n), vps = C.vpSeries(st, n);
    eq(vis[2][1], 3, "synthetic 6p: a city is worth 2 (1 -> 2 points)"); eq(vis[12][2], 2, "synthetic 6p: the hidden victory-point card is not visible");
    eq(vis.map((r) => r[3]), Array(13).fill(2), "synthetic 6p: the replay has no transient off-by-one");
    ok(vps[7][3] === 3 && vps[8][3] === 2, "synthetic 6p: vpSeries shows the recorder's transient off-by-one (step 7)", vps[7]);
    ok(vis.every((r, s) => r.every((v, q) => s === 7 && q === 3 ? true : v === vps[s][q])), "synthetic 6p: replay and recorder agree everywhere else");
    const a = F.analyseGame({ stats: st, n, me: 0, target: 10 }); ok(a && a.flags.big && a.you === null && a.tempo.phases.length === 3, "synthetic 6p: analyseGame works without a review and flags 5-6 players", a?.flags);
  }

  // ═══ 3 decisions of every reviewed seat ═══
  const SEATS = [];
  for (const g of REV) for (let q = 0; q < g.n; q++) { const rev = g.rv.reviews[q], dd = F.decisionsOf(rev, g.n, q); SEATS.push({ g, q, rev, ...dd }); }
  ok(SEATS.length >= 4, "4 seat views to check", SEATS.length);
  for (const { g, q, rev, ds, all, forced } of SEATS) {
    const tag = `${g.id} seat ${q}`, er = F.realErrors(ds, { all }), sp = F.splitMoves(ds), limits = C.phaseLimits(C.turnsOfGame(g.state.stats)), pc = F.phaseCosts(ds, limits, sp);
    ok(ds.length > 0 && ds.every((d) => Number.isInteger(d.gp) && d.gp >= 0 && Number.isFinite(d.B) && Number.isFinite(d.A) && d.A === d.B + d.gp), `${tag}: decisions are whole percent, A = B + gap`);
    ok(ds.every((d, i) => !i || ds[i - 1].i < d.i), `${tag}: decisions are in play order`);
    // lists equal their headers; every decision is in exactly one list
    const lists = [er.errors, er.setupErrors, er.notErrors, er.small, er.trivial], ids = lists.flatMap((l) => l.map((d) => d.i));
    ok(new Set(ids).size === ids.length && ids.length === ds.length, `${tag}: errors, set-up errors, not-errors, small and trivial moves partition the decisions`, [ids.length, ds.length]);
    eq([er.errors.length, er.setupErrors.length, er.notErrors.length, er.small.length, er.trivial.length], [er.counts.errors, er.counts.setupErrors, er.counts.notErrors, er.counts.small, er.counts.trivial], `${tag}: counts equal list lengths (the header count equals the list)`);
    ok(er.counts.scored === ds.length - er.trivial.length && er.counts.scored === er.counts.errors + er.counts.setupErrors + er.counts.notErrors + er.counts.small, `${tag}: scored = every list but trivial`);
    ok(er.counts.all >= er.counts.scored && er.counts.oneOption === er.counts.all - er.counts.scored && all === rev.results.length, `${tag}: "x of y decisions scored" (the rest had one sensible option)`, er.counts);
    ok(forced <= er.counts.oneOption, `${tag}: forced results are inside the not-scored ones`, [forced, er.counts.oneOption]);
    // the error rule
    ok(er.errors.every((d) => d.k !== "setup" && ["could", "mistake", "blunder", "missed"].includes(d.cls) && d.gp >= 1 && (d.cls !== "missed" || d.vc === "clear")), `${tag}: every real error is a could / mistake / blunder / missed, a missed one with a clear verdict`);
    ok(er.errors.every((d) => d.k !== "robber" && !/longest road|largest army|port|harbo/i.test(d.x.label + d.x.best.label)), `${tag}: no robber, port or road-race decision is listed as an error (v1.99 scope)`);
    ok(er.setupErrors.every((d) => d.k === "setup" && F.isError(d)), `${tag}: set-up errors are set-up picks`);
    ok(ds.every((d) => F.isError(d) === (er.errors.includes(d) || er.setupErrors.includes(d))), `${tag}: isError agrees with the lists`);
    ok(ds.filter((d) => d.vc !== "clear" && d.cls !== "triv").every((d) => !F.isError(d)), `${tag}: a decision whose verdict is not clear is never an error (close call / slight difference)`);
    ok(ds.filter((d) => d.cls === "close" || d.cls === "lean").every((d) => !F.isError(d)), `${tag}: close and lean are never errors`);
    ok(ds.filter((d) => d.cls === "triv" || d.cls === "best" || d.cls === "great" || d.cls === "good").every((d) => !F.isError(d)), `${tag}: best / great / good / trivial are never errors`);
    ok(er.errors.every((d, i) => !i || er.errors[i - 1].gp >= d.gp), `${tag}: errors are sorted biggest first`);
    ok(er.notErrors.every((d) => d.gp >= 1) && er.small.every((d) => d.gp === 0), `${tag}: not-errors cost 1% or more, small moves under 1%`);
    for (const d of ds) {
      const r = F.errorRule(d);
      ok(Number.isFinite(r.need) && r.need >= 1 && r.gap === d.gp && r.error === F.isError(d), `${tag} #${d.i}: errorRule is finite and agrees`, r);
      if (!r.setup) ok(r.fallback ? r.need === 6 : r.need === 2 * r.noise, `${tag} #${d.i}: need = 2 x noise (6 without a stored se)`, r);
      else ok(r.need === S.SETUP_LIMITS[1][0], `${tag} #${d.i}: set-up picks follow SETUP_LIMITS`, r);
      if (F.isError(d) && !r.setup && !r.fallback) ok(d.gp + 1 >= r.need, `${tag} #${d.i}: an error's gap reaches its own 2 x noise`, r);
      if (d.why) ok(d.why.chips.length <= 3 && typeof d.why.line === "string" && d.why.line.length > 0, `${tag} #${d.i}: why line and at most 3 chips`);
    }
    // pillars and phase costs reconcile
    ok(sp.errors + sp.start + sp.other === sp.total && sp.total === Math.min(sp.sum, sp.cap) && sp.headline === -sp.total, `${tag}: pillars (errors ${sp.errors}, start ${sp.start}, other ${sp.other}) add up to the total ${sp.total}`, sp);
    ok([sp.errors, sp.start, sp.other, sp.total].every((v) => Number.isInteger(v) && v >= 0), `${tag}: pillars are whole and not negative`);
    eq(sp.counts.nErrors, er.errors.length, `${tag}: pillars.nErrors excludes set-up errors and equals the Lesson 1 list`);
    ok(ds.filter((d) => d.k === "setup").every((d) => !er.errors.includes(d)), `${tag}: set-up picks are in start, not in errors`);
    if (!sp.capped) { eq(sp.start, sum(ds.filter((d) => d.k === "setup").map((d) => d.gp)), `${tag}: start pillar = set-up gaps`); eq(sp.errors, sum(er.errors.map((d) => d.gp)), `${tag}: errors pillar = sum of the listed errors`); }
    ok(pc.opening + pc.mid + pc.end === sp.errors && pc.opening + pc.mid + pc.end + pc.start + pc.small === sp.total && pc.total === sp.total, `${tag}: phase costs ${pc.opening}+${pc.mid}+${pc.end} + start ${pc.start} + small ${pc.small} = total ${sp.total}`, pc);
    ok([pc.opening, pc.mid, pc.end, pc.start, pc.small].every((v) => Number.isInteger(v) && v >= 0), `${tag}: phase costs are whole and not negative`);
    const T0 = EV.summarize ? EV.summarize(rev.results).count : null; ok(T0 !== null, `${tag}: summarize exists`);
    if (sp.capped) ok(sp.sum > sp.cap && sp.total === sp.cap, `${tag}: capped total`, sp);
    // best moves
    const bm = F.bestMoves(ds, 5);
    ok(bm.every((o, i) => o.gain >= 1 && Number.isFinite(o.gain) && ["best", "great"].includes(o.d.cls) && (!i || bm[i - 1].gain >= o.gain)), `${tag}: best moves carry a finite next-best gain, biggest first`);
    ok(ds.every((d) => Number.isFinite(F.nextBestGain(d)) && F.nextBestGain(d) >= 0), `${tag}: nextBestGain is finite`);
    // close calls: mutate each decision of the real review so that its noise swallows the gap: it can no longer be an error
    for (const d of ds.filter((x) => x.gp >= 1 && x.x.best)) {
      const x2 = clone(d.x); x2.best.se = Math.max(0.2, (x2.loss * 100 * 1.2) / 100); x2.best.se = Math.min(x2.best.se, 0.9); if (x2.loss * 100 >= 2 * x2.best.se * 100) x2.best.se = (x2.loss * 100) / 100; // gap < 2 x se
      const d2 = (S.decide([x2], g.n, q) || [])[0]; if (!d2) continue;
      if (S.vcOf(x2) !== "clear") ok(!F.isError(d2), `${tag} #${d.i}: noisier than its gap (${S.vcOf(x2)}): not an error`, { cls: d2.cls, gp: d2.gp, vc: d2.vc });
    }
    // missed with a slight verdict is not an error
    for (const d of ds.filter((x) => x.cls === "missed")) { const m = { ...d, vc: "lean" }; ok(!F.isError(m), `${tag} #${d.i}: a missed chance with only a slight verdict is not an error`); }
  }
  // the mutated-close-call test must have run on something
  ok(SEATS.some(({ ds }) => ds.some((d) => d.gp >= 1)), "there are decisions with a gap in the real data");
  ok(SEATS.reduce((a, s) => a + F.realErrors(s.ds).errors.length, 0) >= 2, "the real data has real errors to check");

  // ═══ 4 coach rules ═══
  eq(C.THRESHOLDS, { half: 0.5, lastGap: 1 }, "THRESHOLDS: half 0.5 and lastGap 1, relative to the target");
  eq(C.RULES.map((r) => r.id), ["missing-resource", "city-at-half", "last-point"], "the three initial rules");
  ok(C.RULES.every((r) => typeof r.when === "function" && ["opening", "mid", "end"].includes(r.phase) && T.EN[r.chip] && T.NL[r.chip] && T.EN[r.text] && T.NL[r.text]), "every rule has id, phase, when, chip and text keys in EN and NL");
  for (const { g, q, ds } of SEATS) {
    const raw = ROW.rawOf(g.state), fr = C.firedRules(ds, { stats: g.state.stats, n: g.n, me: q, target: g.target, raw }), lim = C.phaseLimits(C.turnsOfGame(g.state.stats)), tag = `${g.id} seat ${q}`;
    for (const r of fr) for (const m of r.moments) {
      const d = ds.find((x) => x.i === m.i);
      ok(d && F.isError(d) && d.k !== "setup", `${tag}: rule ${r.id} fired on a clear error that is not a set-up pick`);
      ok(C.phaseOf(m.turn, lim) === r.phase && C.RULE[r.id].phase === r.phase, `${tag}: rule ${r.id} fired in its own phase`);
      ok(T.EN[m.chip] && T.NL[m.chip] && T.EN[m.text] && T.NL[m.text], `${tag}: rule ${r.id} text keys exist`);
      ok(m.pts == null || (m.pts >= 2 && m.pts <= g.target), `${tag}: visible points at the moment are plausible`, m.pts);
    }
    ok(fr.every((r) => r.cost === sum(r.moments.map((m) => m.gp)) && r.n === r.moments.length), `${tag}: rule cost = sum of its moments`);
    ok(fr.length === new Set(fr.map((r) => r.id)).size, `${tag}: one entry per rule`);
  }
  { // synthetic thresholds on a real log: seat 1 of the real game, a clear error at a given turn with a better city
    const g = REV[0], st = g.state.stats, n = g.n, raw = ROW.rawOf(g.state), plog = C.pointsLog(st, n);
    const fake = (o) => ({ i: 900 + (o.i || 0), t: o.t, k: o.k || "build", cls: o.cls || "mistake", vc: o.vc || "clear", gp: o.gp ?? 8, B: 30, A: 38, x: { label: o.label || "Road toward 11·10", best: { label: o.best || "City on 4·6·5" } } });
    const ptsAt = (q, t) => C.pointsBefore(plog, t, q);
    // seat 1 reaches its half way points late: find the first turn where its points >= 5 (target 10) and the last turn where it has < 5
    const T = C.turnsOfGame(st), lim = C.phaseLimits(T);
    const tMid = [...Array(T)].map((_, i) => i + 1).filter((t) => C.phaseOf(t, lim) === "mid");
    const hi = tMid.find((t) => ptsAt(1, t) >= 5), lo = tMid.find((t) => ptsAt(1, t) < 5);
    const run = (dd, q = 1, target = g.target) => C.firedRules(dd, { stats: st, n, me: q, target, raw });
    // build a synthetic points situation instead when the real game never has both: use a synthetic log with seat 0 at 4 / 5 / 9 / 8 points
    const syn = (pts, T = 18) => { const steps = [], ev = []; for (let t = 1; t <= T; t++) for (let q = 0; q < 4; q++) steps.push([t, q, 3, 4]); for (let q = 0; q < 4; q++) ev.push([0, "b", q, "s", q * 10], [0, "b", q, "s", q * 10 + 1], [0, "b", q, "r", q * 10], [0, "b", q, "r", q * 10 + 1]);
      for (let k = 0; k < pts - 2; k++) ev.push([4, "b", 0, "s", 100 + k]); return { v: 1, n: 4, steps, vp: null, ev, r0: 0 }; };
    const fire = (stx, dd, target = 10, me = 0) => C.firedRules(dd, { stats: stx, n: 4, me, target, raw: null });
    // city-at-half: needs a clear error in mid whose better move is a city, at >= half the target
    const mid = 9; // T = 18: mid = 7..12
    eq(fire(syn(5), [fake({ t: mid })]).map((r) => r.id), ["city-at-half"], "city-at-half fires at exactly half the target (5 of 10)");
    eq(fire(syn(4), [fake({ t: mid })]).map((r) => r.id), [], "city-at-half does not fire below half (4 of 10)");
    eq(fire(syn(4), [fake({ t: mid })], 8).map((r) => r.id), ["city-at-half"], "the half threshold is relative to the target (4 of 8)");
    eq(fire(syn(5), [fake({ t: mid, best: "Settlement 8·11" })]).map((r) => r.id), [], "city-at-half needs a city as the better move");
    eq(fire(syn(5), [fake({ t: mid, label: "City on 4·6·5" })]).map((r) => r.id), [], "city-at-half does not fire when you built the city");
    eq(fire(syn(5), [fake({ t: mid, best: "Trade Ore → 1 Grain, then City on 4·6·11" })]).map((r) => r.id), ["city-at-half"], "a trade then a city counts as a city (kind after 'then')");
    eq(fire(syn(5), [fake({ t: 3 })]).map((r) => r.id), [], "city-at-half does not fire in the opening");
    eq(fire(syn(5), [fake({ t: 16 })]).map((r) => r.id), [], "city-at-half does not fire in the end phase");
    for (const [cls, vc, gp, what] of [["lean", "lean", 3, "a slight difference"], ["close", "close", 2, "a close call"], ["good", "clear", 2, "a good move"], ["best", "clear", 0, "the best move"], ["missed", "lean", 5, "a missed chance with a slight verdict"], ["mistake", "lean", 8, "a lean verdict"]])
      eq(fire(syn(5), [fake({ t: mid, cls, vc, gp })]).map((r) => r.id), [], `no rule fires on ${what}`);
    for (const cls of ["could", "mistake", "blunder", "missed"]) eq(fire(syn(5), [fake({ t: mid, cls })]).map((r) => r.id), ["city-at-half"], `a clear ${cls} fires`);
    eq(fire(syn(5), [fake({ t: mid, k: "setup" })]).map((r) => r.id), [], "set-up picks never fire a rule");
    eq(fire(syn(5), [fake({ t: mid, k: "robber", label: "Robber on Ore 6" })]).map((r) => r.id), [], "robber moves never fire a rule (v1.99 scope)");
    // last-point: end phase, within lastGap of the target
    const endT = 16;
    eq(fire(syn(9), [fake({ t: endT, best: "Settlement 8·11" })]).map((r) => r.id), ["last-point"], "last-point fires one point short (9 of 10)");
    eq(fire(syn(8), [fake({ t: endT, best: "Settlement 8·11" })]).map((r) => r.id), [], "last-point does not fire two points short (8 of 10)");
    eq(fire(syn(7), [fake({ t: endT, best: "Settlement 8·11" })], 8).map((r) => r.id), ["last-point"], "last-point is relative to the target (7 of 8)");
    eq(fire(syn(9), [fake({ t: endT, best: "City on 4·6·5" })]).map((r) => r.id), ["last-point"], "last-point with a city");
    eq(fire(syn(9), [fake({ t: endT, best: "Road toward 11·10" })]).map((r) => r.id), [], "last-point needs a move that scores points");
    eq(fire(syn(9), [fake({ t: mid, best: "Settlement 8·11" })]).map((r) => r.id), [], "last-point does not fire outside the end phase");
  }
  { // missing-resource on the real board, checked against an independent recount of the start dots
    const g = REV[0], st = g.state.stats, n = g.n, raw = ROW.rawOf(g.state), M = await R("src/review/ai-mech.js"), geo = (await R("src/lessons-geo.js")).stdGeo();
    const PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
    for (let q = 0; q < n; q++) {
      const mine = st.ev.filter((e) => e[0] === 0 && e[1] === "b" && e[2] === q && e[3] === "s").map((e) => e[4]), have = new Set();
      mine.forEach((nd) => geo.nodes[nd].hx.forEach((h) => { const x = g.state.hexes[h]; if (x.number && x.resource !== "desert") have.add(x.resource); }));
      const miss = M.R5.filter((r) => !have.has(r)), sf = F.startFacts(raw, n)[q];
      eq(sf.missing, miss, `seat ${q}: missing resources at the start = independent recount from the board`);
      eq(sf.kinds, M.R5.filter((r) => have.has(r)), `seat ${q}: start kinds`);
      ok(sf.total === sum(M.R5.map((r) => sf.dots[r])) && M.R5.every((r) => Number.isInteger(sf.dots[r])), `seat ${q}: start dots are whole and add up`);
      const d = { i: 950 + q, t: 2, k: "build", cls: "mistake", vc: "clear", gp: 9, B: 20, A: 29, x: { label: "Road toward 11·10", best: { label: "Settlement 8·11" } } };
      const fr = C.firedRules([d], { stats: st, n, me: q, target: g.target, raw });
      eq(fr.map((r) => r.id), miss.length ? ["missing-resource"] : [], `seat ${q}: missing-resource fires in the opening exactly when a resource has no income`);
      if (miss.length) { eq(fr[0].moments[0].params.res, miss[0], `seat ${q}: the rule names the first missing resource`); ok(T.EN["res." + miss[0]] && T.NL["res." + miss[0]], "resource names exist"); }
      eq(C.firedRules([d], { stats: st, n, me: q, target: g.target, raw: null }).map((r) => r.id), [], `seat ${q}: without a board the missing-resource rule stays quiet`);
      eq(C.firedRules([{ ...d, t: 9 }], { stats: st, n, me: q, target: g.target, raw }).map((r) => r.id).filter((x) => x === "missing-resource"), [], `seat ${q}: missing-resource is an opening rule`);
    }
  }
  { // the rule table is data: a new row works without touching the callers
    const g = REV[0], st = g.state.stats, extra = { id: "test-rule", phase: "mid", chip: "rule.city.chip", text: "rule.city.text", when: (m) => m.pk === "road" && { pts: m.pts, target: 10 } };
    const d = { i: 1, t: 8, k: "build", cls: "blunder", vc: "clear", gp: 12, B: 20, A: 32, x: { label: "Road toward 11·10", best: { label: "Dev card" } } };
    eq(C.firedRules([d], { stats: st, n: 4, me: 0, target: 10 }).map((r) => r.id), [], "a decision no built-in rule matches fires nothing");
    eq(C.firedRules([d], { stats: st, n: 4, me: 0, target: 10, rules: [...C.RULES, extra] }).map((r) => r.id), ["test-rule"], "a new rule row fires through the same caller");
    eq(C.firedRules([], { stats: st, n: 4, me: 0, target: 10 }), [], "no decisions, no rules");
  }

  // ═══ 5 tempo, rival, start review ═══
  for (const g of GAMES) {
    const st = g.state.stats, tp = F.tempo(st, g.n), pl = C.pointsLog(st, g.n);
    eq(tp.phases.map((p) => p.id), ["opening", "mid", "end"], `${g.id}: three phases`);
    tp.phases.forEach((p) => ok(p.gain.every((v, q) => v === p.end[q] - p.start[q]) && p.gain.every(Number.isInteger), `${g.id} ${p.id}: gains are end - start`));
    eq(tp.phases[0].start, pl.pts[0], `${g.id}: the opening starts from the set-up points`);
    tp.phases.forEach((p, k) => k && eq(p.start, tp.phases[k - 1].end, `${g.id}: ${p.id} starts where the phase before ended`));
    eq(tp.phases[2].end, tp.final, `${g.id}: the end phase ends on the final visible points`);
    eq(tp.setup.map((v, q) => v + sum(tp.phases.map((p) => p.gain[q]))), tp.final, `${g.id}: set-up + three phase gains = final visible points`);
    eq(tp.total.map((v, q) => v - tp.hidden[q]), tp.final, `${g.id}: total = visible + hidden cards`);
    for (let me = 0; me < g.n; me++) {
      const rv = F.rivalPhase(tp, me);
      if (rv) {
        const ph = tp.phases.find((p) => p.id === rv.phase), others = ph.gain.filter((_, q) => q !== me);
        ok(rv.rival !== me && ph.gain[rv.rival] === Math.max(...others) && rv.deficit === Math.max(...others) - ph.gain[me] && rv.deficit > 0, `${g.id} seat ${me}: the rival gained most in the phase you trailed most`, rv);
        ok(tp.phases.every((p) => p.empty || Math.max(...p.gain.filter((_, q) => q !== me)) - p.gain[me] <= rv.deficit), `${g.id} seat ${me}: no other phase trailed more`);
      } else ok(tp.phases.every((p) => Math.max(...p.gain.filter((_, q) => q !== me)) <= p.gain[me]), `${g.id} seat ${me}: no rival when nobody out-scored you in a phase`);
    }
  }
  for (const { g, q, ds } of SEATS) {
    const board = require_board(g), sr = F.startReview(ds, board), tag = `${g.id} seat ${q}`, su = ds.filter((d) => d.k === "setup");
    if (su.length < 1) { ok(sr === null, `${tag}: no start review without set-up decisions`); continue; }
    ok(sr && sr.picks.length === Math.min(2, su.length) && ["city", "expansion", "mixed"].includes(sr.plan), `${tag}: start review has your picks and a plan`, sr?.plan);
    sr.picks.forEach((p, k) => {
      ok(p.shortlist.length >= 1 && p.shortlist.length <= 6, `${tag} pick ${p.n}: shortlist of at most 6`, p.shortlist.length);
      ok(p.shortlist.filter((s) => s.played).length === 1 && p.shortlist.every((s, i) => !i || (p.shortlist[i - 1].win ?? -1) >= (s.win ?? -1)), `${tag} pick ${p.n}: the played spot is in the list, best win chance first`);
      ok(p.shortlist.find((s) => s.played).win === p.win && (!p.shortlist.some((s) => s.best) || p.shortlist.find((s) => s.best).win === p.best), `${tag} pick ${p.n}: the played and best spot carry B and A, so the gap shown between them is the gap counted`);
      ok(p.shortlist.every((s) => s.win == null || (s.win >= 0 && s.win <= 100)), `${tag} pick ${p.n}: win chances 0..100`);
      ok(p.win === su[k].B && p.best === su[k].A && p.gp === p.best - p.win, `${tag} pick ${p.n}: win chance after the pick, the better spot's and the gap`);
      p.shortlist.forEach((s) => { if (s.spot) { ok(s.spot.total === sum(Object.values(s.spot.dots)) && s.spot.kinds.every((r) => s.spot.dots[r] > 0), `${tag}: spot dots add up`); const nums = (/(\d+(?:·\d+)+)/.exec(s.label) || [])[1]; if (nums) eq(s.spot.nums.slice().sort((a, b) => a - b), nums.split("·").map(Number).sort((a, b) => a - b), `${tag}: spot numbers equal the numbers in its label "${s.label}"`); } });
      if (p.advice) { ok(p.gp >= 5 && p.advice.adds.length > 0 && p.advice.gap === p.gp && p.advice.adds.every((r) => p.bestSpot.kinds.includes(r) && !p.spot.kinds.includes(r)), `${tag} pick ${p.n}: advice only for a gap of 5% or more that adds a resource`, p.advice); }
      else ok(p.gp < 5 || !p.adds.length || !p.bestSpot, `${tag} pick ${p.n}: no advice when the gap is under 5% or no resource is added`, { gp: p.gp, adds: p.adds });
      ok(p.followed === ["best", "good", "great"].includes(p.cls), `${tag} pick ${p.n}: followed = best / good class`);
    });
    eq(F.startReview(ds, null) && F.startReview(ds, null).picks.every((p) => p.advice === null && p.spot === null), true, `${tag}: without a board there is no spot or advice`);
  }
  { const geo = (await R("src/lessons-geo.js")).stdGeo(), b = (g) => ROW && require_board(g), g = REV[0]; const board = b(g);
    const mk = (w, c) => ({ dots: { wood: w, brick: w, sheep: 0, wheat: c, ore: c } });
    eq([F.planFromSpot(mk(6, 1)), F.planFromSpot(mk(1, 6)), F.planFromSpot(mk(3, 3)), F.planFromSpot([])], ["expansion", "city", "mixed", "mixed"], "planFromSpot: expansion / city / mixed");
    ok(geo.nodes.length === 54 && board.length === 19, "standard board"); }

  // ═══ 6 luck: each seat's own estimate, unbalanced ═══
  REV.forEach((g) => {
    const a = F.analyseGame(input(g, g.me)), st = g.state.stats;
    a.luck.forEach((l, q) => {
      ok(l && Number.isFinite(l.total) && [l.dice, l.steal, l.draw, l.seat].every(Number.isFinite), `${g.id} seat ${q}: luck parts are finite`);
      ok(Math.abs(l.total - (l.dice + l.steal + l.draw + l.seat)) <= 2, `${g.id} seat ${q}: luck total = its parts (rounding)`, l);
      const mine = ROW.luckOf({ rv: g.rv, state: g.state }, q); ok(mine != null && Math.abs(mine - l.total) <= 1, `${g.id} seat ${q}: luck equals the lessons-row luckOf sum`, [mine, l.total]);
    });
    const tot = a.luck.map((l) => l.total);
    ok(Math.abs(sum(tot)) > 0 || tot.every((v) => v === 0), `${g.id}: seat luck is NOT balanced to zero (independent estimates)`, tot);
    const bal = F.balanceLuck(tot); ok(Math.abs(sum(bal)) < 1e-9, "balanceLuck sums to zero (exists, not used for display)"); eq(F.luckBalance(tot).sum, sum(tot), "luckBalance");
    eq(F.balanceLuck([null, 3, 5]), [null, -1, 1], "balanceLuck skips missing values"); ok(a.luck.every((l, q) => JSON.stringify(l) === JSON.stringify(F.luckSplit(g.rv.luck, st, q, g.n))), `${g.id}: the screen object shows the raw luck values`);
    eq(F.luckSplit(null, st, 0, 4), null, "no luck run: null"); eq(F.luckSplit({ res: {} }, st, 0, 4), null, "an incomplete luck run: null");
  });

  // ═══ 7 verdict, ledger and text ═══
  for (const { g, q, ds } of SEATS) {
    const a = F.analyseGame(input(g, q)), L = a.you.ledger, tag = `${g.id} seat ${q}`;
    ok(L.setup + L.luck + L.moves + L.rest === L.total && L.total === L.to - L.from, `${tag}: setup ${L.setup} + luck ${L.luck} + moves ${L.moves} + rest ${L.rest} = ${L.total}`);
    ok(L.moves === -(a.you.split.errors + a.you.split.other) && Object.values(L).every((v) => typeof v !== "number" || Number.isFinite(v)), `${tag}: ledger moves = -(errors + other); finite`);
    ["en", "nl"].forEach((lang) => {
      const line = F.verdictLine(L, { won: a.points.won }, lang), text = F.verdictText(L, { won: a.points.won }, lang);
      ok(typeof line === "string" && line.length > 5 && typeof text === "string" && text.length > 5, `${tag} ${lang}: verdict line and text`);
      ok(!/NaN|undefined|null|\[object|\{|\}/.test(line + text), `${tag} ${lang}: verdict has no NaN / undefined / braces`, line + " | " + text);
      ok(!/^(head|vt)\./.test(line) && !/(head|vt)\.\w+/.test(line + text), `${tag} ${lang}: no key leaks into the verdict`);
      if (a.points.won) ok(!/did not win|je won niet/.test(line + text), `${tag} ${lang}: a win is never called a loss`); else ok(!/You still won|Je won toch|you won\b/i.test(text) && !/you won\b/i.test(line), `${tag} ${lang}: a loss is never called a win`, line + " | " + text);
    });
  }
  { // headline logic on synthetic parts
    const P = (o) => ({ setup: 0, luck: 0, moves: 0, rest: 0, hasLuck: true, ...o });
    const h = F.headline(P({ rest: 111, luck: 51, moves: -68 }), { won: true });
    eq([h.lead.map((o) => o.id), h.despite.id], [["rest", "luck"], "moves"], "won: the biggest drivers lead, the moves cost is 'despite'");
    eq(F.verdictLine(P({ rest: 111, luck: 51, moves: -68 }), { won: true }), "The others fell away (+111%) and luck helped (+51%), despite 68% lost to your moves", "the spec's example headline");
    eq(F.verdictText(P({ rest: 111, luck: 51, moves: -68 }), { won: true }), "Your moves gave up 68% against best play. You still won: the opponents fell away.", "the spec's example verdict text");
    eq(F.headline(P({ rest: -30, luck: -20, moves: -4 }), { won: false }).lead.map((o) => o.id), ["rest", "luck"], "lost: the negative drivers lead");
    eq(F.verdictText(P({ rest: 1, luck: 0, moves: -2 }), { won: true }), "Your moves stayed close to best play (2% given up). You won on solid moves.", "won on solid moves");
    ok(!/slipped away/.test(F.verdictText(P({ rest: -40, luck: -5, moves: -12 }), { won: false })), "a loss caused by the others is not blamed on the moves");
    ok(/slipped away/.test(F.verdictText(P({ rest: -3, luck: 0, moves: -30 }), { won: false })), "a loss caused by the moves says so");
    eq(F.verdictLine(P({}), { won: true }), "A close game without one clear cause", "no clear driver");
    eq(F.headline(P({ luck: 60 }), { won: true }).lead.length, 1, "luck can lead a win"); ok(F.headline(P({ luck: 60, hasLuck: false }), { won: true }).lead.every((o) => o.id !== "luck"), "without a luck run luck is never a driver");
    eq(F.headline(null, {}), null, "no parts: no headline");
    eq(F.ledgerOf([], null, null), null, "no decisions: no ledger");
  }
  { // text tables
    const en = Object.keys(T.EN).sort(), nl = Object.keys(T.NL).sort();
    eq(en, nl, "EN and NL have the same keys");
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    ok(en.every((k) => ph(T.EN[k]) === ph(T.NL[k])), "EN and NL use the same {params}", en.filter((k) => ph(T.EN[k]) !== ph(T.NL[k])));
    ok(en.every((k) => T.EN[k].trim() && T.NL[k].trim()), "no empty text");
    ok(en.filter((k) => !/^(and|head\.|mom\.|h\.|c\.|w\.|band\.|vt\.|rule\.|num\.|info\.|phase\.|cls\.|kind\.|plan\.|res\.|word\.)/.test(k)).length === 0, "keys are namespaced");
    const BAN_EN = /robber|\bports?\b|harbou?r|longest road|largest army|road.?race|\bfed\b|\bfeed|\bsteal|\bthief/i, BAN_NL = /rover|struikrover|haven|langste weg|grootste ridder|wegenrace|gevoed|\bvoed|\bsteel|\bdief/i;
    ok(en.every((k) => !BAN_EN.test(T.EN[k])), "EN: no robber / port / road-race / fed string", en.filter((k) => BAN_EN.test(T.EN[k])));
    ok(en.every((k) => !BAN_NL.test(T.NL[k])), "NL: no robber / port / road-race / fed string", en.filter((k) => BAN_NL.test(T.NL[k])));
    ok(en.filter((k) => /%/.test(T.EN[k])).every((k) => !/\bpoints?\b/i.test(T.EN[k])) && en.filter((k) => /%/.test(T.NL[k])).every((k) => !/\bpunt(en)?\b/i.test(T.NL[k])), "a win-chance % is never called points / punten");
    ok(!/Precisie/.test(Object.values(T.EN).join(" ")) && !/Accuracy|Nauwkeurigheid|Juistheid|Accuraatheid/i.test(Object.values(T.NL).join(" ")), "EN says Accuracy, NL says Precisie, no other accuracy word");
    ok(T.EN["word.acc"] === "Accuracy" && T.NL["word.acc"] === "Precisie", "word.acc");
    ok(!/Jouw zetten|hefboom|\bMaten\b/.test(Object.values(T.NL).join(" ")), "NL has no 'Jouw zetten', 'hefboom' or 'Maten'");
    ok(/dorp/.test(T.NL["kind.settlement"]) && /stad/.test(T.NL["kind.city"]) && /weg/.test(T.NL["kind.road"]) && /ontwikkelkaart/.test(T.NL["kind.card"]), "NL piece names: dorp, stad, weg, ontwikkelkaart");
    eq(["wood", "brick", "sheep", "wheat", "ore"].map((r) => T.NL["res." + r].toLowerCase()), ["hout", "baksteen", "wol", "graan", "erts"], "NL resources: hout, baksteen, wol, graan, erts");
    eq(T.tr(undefined, "word.acc"), "Accuracy", "English is the default language"); eq(T.tr("nl", "word.acc"), "Precisie", "tr nl"); eq(T.tr("en", "rule.city.chip", { pts: 5, target: 10 }), "5 of 10 points", "tr params");
    eq(T.tr("nl", "no.such.key"), "no.such.key", "an unknown key returns itself"); eq(T.tr("en", "rule.missing.chip", {}), "No ", "a missing param is empty, never 'undefined'");
    const rules = T.EN["rule.missing.text"] + T.EN["rule.city.text"] + T.EN["rule.last.text"]; ok(!/robber|port|longest|fed/i.test(rules), "rule texts stay in scope");
  }

  // ═══ 8 the screen object ═══
  const outs = [];
  for (const g of GAMES) for (const lang of ["en", "nl"]) for (let me = 0; me < (g.kind === "reviewed" ? g.n : 1); me++) outs.push({ g, lang, me, a: F.analyseGame(input(g, me === 0 ? g.me : me, { lang })) });
  for (const { g, lang, me, a } of outs) {
    const tag = `${g.id} ${lang} seat ${a.me}`;
    ok(a && a.n === g.n && a.target === g.target, `${tag}: analyseGame returns the game`);
    const bad = []; walk(a, (v, p) => { if (typeof v === "number" && !Number.isFinite(v)) bad.push(p + " non-finite"); if (v === undefined) bad.push(p + " undefined"); if (typeof v === "function") bad.push(p + " function"); if (typeof v === "string" && /NaN|undefined|\[object|Infinity/.test(v)) bad.push(p + " " + v); if (typeof v === "string" && /^(head|vt|rule|num|info|phase|cls|kind|plan|res|word)\.[\w.]+$/.test(v) && !/\.(key|chip|text|id)$/.test(p)) bad.push(p + " key leak " + v); });
    ok(bad.length === 0, `${tag}: no NaN / undefined / [object / functions anywhere`, bad.slice(0, 4));
    ok(JSON.stringify(a).indexOf("undefined") < 0, `${tag}: JSON-safe`);
    if (a.numbers) { ok(a.numbers.rows.every((r) => r.values.length === a.n && r.values.every((v) => v === null || Number.isFinite(v)) && r.label && !/^num\./.test(r.label)), `${tag}: Numbers sheet values are finite or null, every row labelled`); ok(new Set(a.numbers.rows.map((r) => r.id)).size === a.numbers.rows.length, `${tag}: Numbers rows are unique`); eq(a.numbers.rows.find((r) => r.id === "points").values, a.points.total, `${tag}: Numbers points = the game's points`);
      ["opening", "mid", "end"].forEach((id) => ok(a.numbers.rows.some((r) => r.id === "pts." + id), `${tag}: points per phase row ${id}`));
      ok(a.numbers.rows.some((r) => r.id === "bank") && a.numbers.rows.some((r) => r.id === "player"), `${tag}: bank trades and player trades are separate rows`);
      if (a.bySeat?.some((s) => s?.cls)) ok(a.numbers.rows.some((r) => r.id === "cls.errors") && a.numbers.rows.some((r) => r.id === "cls.could") && !a.numbers.rows.some((r) => /^cls\.(mistake|blunder|missed)$/.test(r.id)), `${tag}: Numbers sheet has Real errors and Could be better, not three overlapping classes`);
      const er = a.numbers.rows.find((r) => r.id === "cls.errors"); if (er && a.you) ok(er.values[a.me] === a.you.counts.errors, `${tag}: Numbers "Real errors" = the count on the pages`, { num: er.values[a.me], pages: a.you.counts.errors }); }
    ok(Array.isArray(a.info) && a.info.length === 4 && a.info.every((x) => x.title && x.body && !/\{/.test(x.body)), `${tag}: (i) sheet has its 4 entries`);
    ok(/6%/.test(a.info[0].body) && /5.*10.*18/.test(a.info[0].body.replace(/%/g, "")), `${tag}: (i) states the 6% error rule and the set-up limits`);
    ok(a.info[2].body.includes(`${a.limits.opening[0]}–${a.limits.opening[1]}`) && a.info[2].body.includes(`${a.limits.end[0]}–${a.limits.end[1]}`), `${tag}: (i) prints the turn ranges`);
    if (g.kind === "log") ok(a.you === null && a.flags.reviewed === false && a.bySeat.every((s) => s === null), `${tag}: a game without a review hides the decision blocks`);
    else if (me === 0 || true) { ok(a.you && a.you.ds.length > 0 && a.you.verdict && a.you.startReview, `${tag}: reviewed seat has decisions, verdict and start review`);
      ok(a.bySeat.every((s) => s && s.acc >= 0 && s.acc <= 100), `${tag}: Accuracy for ALL players`); ok(a.luck.every((l) => l && Number.isFinite(l.total)), `${tag}: luck for ALL players`);
      eq(a.you.split.counts.nErrors, a.you.errors.length, `${tag}: header count = list length`); ok(a.you.cls && Object.values(a.you.cls).reduce((x, y) => x + y, 0) + a.you.trivial.length === a.you.ds.length, `${tag}: class counts add up`); }
    ok(a.start === null || a.start.every((s) => s.total >= 0), `${tag}: start facts`);
    ok(a.points.place >= 1 && a.points.place <= a.n && a.points.total.length === a.n, `${tag}: place and points`);
    ok(a.points.won === (a.points.winner === a.me) && Math.max(...a.points.total) === a.points.total[a.points.winner] , `${tag}: winner has the most points`, a.points);
  }
  { const a = outs[0].a, b = F.analyseGame(input(outs[0].g, outs[0].a.me, { lang: "en" })); eq(a, b, "analyseGame is deterministic (same input, same object)"); }
  ok(JSON.stringify(DATA) === SNAP, "analyseGame never mutates its input (saved reviews stay as they were)");
  { // old / missing data hides blocks, never throws
    const g = REV[0], tryA = (m, o) => { let a, thrown = null; try { a = F.analyseGame(o); } catch (e) { thrown = e; } ok(!thrown, `${m}: does not throw`, thrown && String(thrown)); return a; };
    eq(tryA("empty input", {}), null, "empty input -> null"); eq(tryA("no stats", { n: 4, me: 0 }), null, "no stats -> null");
    const nr = tryA("no review", input(g, 0, { rv: null })); ok(nr && nr.you === null && nr.tempo && nr.numbers, "no review: tempo and Numbers stay, decisions hide");
    const old = clone(g); Object.values(old.rv.reviews).forEach((r) => { r.fmt = 2; }); const oa = tryA("old format review", input(old, 0)); ok(oa && oa.you && oa.you.ds.length > 0, "an older review is re-scored and still opens");
    const nb = tryA("no board", { ...input(g, 0), state: { ...g.state, hexes: null } }); ok(nb && nb.start === null && nb.flags.board === false && nb.you && nb.you.startReview.picks.every((p) => p.advice === null), "no board: start facts and advice hide, the rest stays");
    const nl = tryA("no luck run", input(g, 0, { rv: { reviews: g.rv.reviews } })); ok(nl && nl.luck.every((l) => l === null) && nl.you.ledger.hasLuck === false && nl.you.ledger.luck === 0, "no luck run: luck is null for every seat, the ledger still adds up");
    ok(nl.you.ledger.setup + nl.you.ledger.luck + nl.you.ledger.moves + nl.you.ledger.rest === nl.you.ledger.total, "no luck run: ledger reconciles");
    const hurt = clone(g); hurt.rv.reviews[0].results.forEach((x) => { delete x.cands; delete x.best; }); tryA("results without candidates", input(hurt, 0));
    const junk = clone(g); junk.rv.reviews[0].results = [{}, null, { k: "build" }].filter(Boolean); tryA("malformed results", input(junk, 0));
    const part = clone(g); part.state.stats.partial = true; ok(tryA("partial log", input(part, 0)).flags.partial === true, "a partial log is flagged");
    const rush = clone(g); rush.state.settings.mode = "rush"; ok(tryA("rush", input(rush, 0)).flags.rush === true, "rush is flagged");
    const sea = clone(g); sea.state.sea = {}; const sa = tryA("seafarers", input(sea, 0)); ok(sa.flags.sea === true && sa.flags.board === false && sa.start === null, "seafarers is flagged and has no start spots");
  }

  // ═══ 9 bots ═══
  for (let n = 0; n <= 40; n++) for (let k = 0; k <= n; k += (n > 12 ? 3 : 1)) {
    const [lo, hi] = F.wilsonPct(k, n), p = n ? (100 * k) / n : 50;
    ok(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 0 && hi <= 100 && lo <= hi && lo <= Math.round(p) + 1 && hi >= Math.round(p) - 1, `Wilson ${k}/${n} stays within 0..100 and around the share`, [lo, hi]);
    if (n) { const [a, b] = LAB.wilson(k, n); ok(Math.abs(lo - 100 * a) <= 0.51 && Math.abs(hi - 100 * b) <= 0.51, `Wilson ${k}/${n} equals lab-stats wilson`, [lo, hi, 100 * a, 100 * b]); }
  }
  eq(F.wilsonPct(0, 0), [0, 100], "Wilson with no games"); eq(F.wilsonPct(9, 5)[1] <= 100, true, "Wilson clamps k to n");
  { const metas = [{ me: 0, result: "won", acc: 80, seats: [{ you: true }, { prof: "expert" }, { prof: "expert" }, { prof: "expert" }] }, { me: 0, result: "lost", acc: 60, seats: [{ you: true }, { prof: "expert" }, { prof: "expert" }, { prof: "expert" }] }, { me: 0, result: "won", acc: null, seats: [{ you: true }, { prof: "simple" }, { prof: "simple" }, { prof: "simple" }] }, { me: 0, result: "lost", seats: [{ you: true }, { prof: "simple" }, { prof: "expert" }, { prof: "simple" }] }, ...REV.map((g) => g.meta)];
    eq(F.levelOf(metas[3]), "mixed", "mixed bots"); eq(F.levelOf(REV[0].meta), "intermediate", "real game: intermediate bots");
    const e = F.youVsLevel(metas, "expert"); eq([e.n, e.won, e.pct, e.acc], [2, 1, 50, 70], "you vs expert: 1 of 2, mean accuracy 70"); ok(e.lo >= 0 && e.hi <= 100 && e.lo <= 50 && e.hi >= 50, "you vs expert: Wilson range");
    eq(F.youVsLevels(metas).map((r) => r.level), ["simple", "intermediate", "expert", "mixed"], "levels in ladder order, unknown last"); eq(F.youVsLevel([], "expert").pct, null, "no games: no share");
    ok(F.youVsLevels(metas).every((r) => r.pct === null || (r.pct >= 0 && r.pct <= 100)), "no percentage above 100"); }

  console.log(`\n${fails ? fails + " FAILED of " : "ALL "}${total} checks${fails ? "" : " passed"}`);
  process.exit(fails ? 1 : 0);

  function require_board(g) { return g.state.hexes.map((h) => ({ res: h.resource, num: h.number || null })); }
})().catch((e) => { console.error(e); process.exit(2); });
