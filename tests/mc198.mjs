// node tests/mc198.mjs [--full] : architecture step 6, the Monte Carlo toolkit (src/mc/) and its first consumer (the review's luck, src/review/luck-mc.js).
//   1 futures: the seed formulas are the review's, windows of futures are the same futures
//   2 determinize: the port equals src/master/sim.js determinize on many sampled states (classic, Seafarers, 5-6), draw for draw
//   3 simulate: seeded and repeatable, a split of the futures equals the whole run, branches under the same futures are paired
//   4 collectors: counts / points / events add up, merge(parts) = the whole
//   5 runners: InlineRunner = WorkerPool (futures split over 3 jobs, and one luck job)
//   7 step-mc identity (posValue / valueAt, tests/fixtures/mc198-step.json) and the why-mc feature trace as a collector
//   6 luck identity: luckEvent / luckSeats numbers are byte-identical to those of the code before the port (tests/fixtures/mc198-luck.json: the hash of
//     each result, made by the pristine v1.97 tree; --full runs every stored event, the default a representative subset)
import fs from "node:fs";
import crypto from "node:crypto";
import { bootHeadless } from "../src/api/headless.js";
import { newGame } from "../src/api/engine.js";
import * as SIM from "../src/master/sim.js";
import { luckEvent, luckEvents, luckSeats } from "../src/review/luck-mc.js";
import { posValue, valueAt } from "../src/review/step-mc.js";
import { traceStart, featuresOf } from "../src/review/why-mc.js";
import { unpackRecs } from "../src/review/pack.js";
import { loadRecord } from "../src/review/engine.js";
import * as MC from "../src/mc/index.js";

let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const full = process.argv.includes("--full");
const g = await bootHeadless();
const root = new URL("../", import.meta.url).pathname;
const E = JSON.parse(fs.readFileSync(root + "tests/fixtures/ui191-game.json", "utf8"));
const recs = unpackRecs(E.rv.recs), base = E.rv.base;
const sha = (x) => crypto.createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x)).digest("hex").slice(0, 16);
const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === "ms" ? undefined : v)));

// ── 1 futures ──
{
  const F = MC.futures({ seed: 131 }), j = 5;
  const s = F.at(j);
  ok(s.policy === ((131 + Math.imul(j + 1, 0x9e3779b1)) | 0) && s.dice === ((131 ^ Math.imul(j + 1, 0x85ebca6b)) | 0) && s.deck === ((131 ^ Math.imul(j + 7, 0x27d4eb2f)) | 0), "futures: the review's seed formulas");
  const W = F.slice(3, 10);
  ok(W.at(2).policy === F.at(5).policy && W.rngs(2).dice() === F.rngs(5).dice(), "futures: a window of futures is the same futures");
  ok(JSON.stringify(MC.futures({ seed: 1 }).at(0)) !== JSON.stringify(MC.futures({ seed: 2 }).at(0)), "futures: another seed, other futures");
  ok(MC.hash32("") === 2166136261 && MC.hash32("a") === 3826002220, "hash32 is FNV-1a (32 bit)");
}

// ── positions in the three modes: a recorded classic game, and played-out Seafarers / 5-6 / balanced-dice games ──
function played(spec, seed, turns) {
  const e = newGame(g, { ...spec, seed }); e.release();
  const rng = SIM.mulberry32(seed * 7 + 1); Math.random = rng;
  let k = 0; while (g.setupPhase && k++ < 80) { g.setupAction = null; g.processSetupQueue(); }
  const snaps = [];
  for (let t = 0; t < turns; t += 1) { SIM.rollout(g, 1, rng, {}); if (t % 5 === 4 && !g.winner) snaps.push(MC.capture(g)); }
  return { g, snaps, spec };
}

// ── 2 determinize ──
{
  const sig = (gg) => JSON.stringify([gg.players.map((p) => [p.resources, p.devCards, p.newDevCards, p.devVictoryPoints, p.victoryPoints]), gg.bank, gg.devDeck]);
  let n = 0, same = 0, moved = 0;
  const check = (world, seatCount) => {
    for (let me = 0; me < seatCount; me += 1) for (let s = 1; s <= 2; s += 1) {
      MC.reinstate(g, world); SIM.determinize(g, me, SIM.mulberry32(s * 977 + me)); const a = sig(g);
      MC.reinstate(g, world); const before = sig(g); MC.determinize(g, me, SIM.mulberry32(s * 977 + me)); const b = sig(g);
      n += 1; if (a === b) same += 1; if (b !== before) moved += 1;
    }
  };
  for (const i of [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]) { loadRecord(g, base, recs[Math.min(i, recs.length - 1)]); check(MC.capture(g), g.players.length); }
  const modes = [["classic", { seats: 4 }, 5], ["sea", { seats: 3, sea: true }, 6], ["six", { seats: 6 }, 7], ["deck-dice", { seats: 4, dice: "balanced" }, 8]];
  for (const [, spec, seed] of modes) { const P = played(spec, seed, 40); P.snaps.forEach((w) => check(w, spec.seats)); }
  ok(n >= 200 && same === n, `determinize: the port equals sim.determinize on ${n} sampled (state, seat, seed) draws`, [same, n]);
  ok(moved > n / 2, "determinize: the draws really re-deal hidden cards (not a no-op comparison)", moved);
  // the omniscient view: only the deck order
  loadRecord(g, base, recs[100]); const w0 = MC.capture(g), deck0 = g.devDeck.slice();
  MC.reshuffleDeck(g, SIM.mulberry32(3)); const d1 = g.devDeck.slice(); MC.reinstate(g, w0);
  const rf = deck0.slice(); const rr = SIM.mulberry32(3); for (let i = rf.length - 1; i > 0; i -= 1) { const j = Math.floor(rr() * (i + 1)); [rf[i], rf[j]] = [rf[j], rf[i]]; }
  ok(JSON.stringify(d1) === JSON.stringify(rf) && [...d1].sort().join() === [...deck0].sort().join(), "reshuffleDeck: the review's Fisher-Yates, a permutation of the same cards");
}

// ── 3 simulate, 4 collectors ──
loadRecord(g, base, recs[100]);
const n4 = g.players.length, world = MC.capture(g), leaf = (gg) => SIM.winProbs(gg);
const run = (o) => MC.simulate({ g, world, leaf, turns: 4, ...o });
{
  const F = MC.futures({ seed: 131 });
  const a = run({ F, n: 6 }), b = run({ F, n: 6 });
  ok(JSON.stringify(a.samples) === JSON.stringify(b.samples), "simulate: same seed, same futures, same numbers");
  const c = run({ F: MC.futures({ seed: 132 }), n: 6 });
  ok(JSON.stringify(a.samples) !== JSON.stringify(c.samples), "simulate: another seed, other numbers");
  const p1 = run({ F, j0: 0, j1: 2 }), p2 = run({ F, j0: 2, j1: 6 });
  ok(JSON.stringify([...p1.samples[0], ...p2.samples[0]]) === JSON.stringify(a.samples[0]), "simulate: futures 0-1 and 2-5 together are futures 0-5 (what lets workers split them)");
  const two = run({ F, n: 4, branches: [{}, {}] });
  ok(JSON.stringify(two.samples[0]) === JSON.stringify(two.samples[1]) && JSON.stringify(two.samples[0]) === JSON.stringify(a.samples[0].slice(0, 4)), "simulate: two branches under the same futures are paired (identical when they do the same)");
  const sum1 = a.samples[0].every((v) => Math.abs(v.reduce((x, y) => x + y, 0) - 1) < 1e-9);
  ok(sum1, "simulate: each future's leaf is a win chance per seat summing to 1");
  const wc = MC.winCounts(n4), pt = MC.points(n4), ls = MC.leafSamples(), et = MC.eventTally(["rolled", "built"]);
  const r = run({ F, n: 8, turns: 12, collect: [wc, pt, ls, et] });
  const W = wc.result(), P = pt.result(), L = ls.result(), T = et.result();
  ok(W.runs[0] === 8 && W.wins[0].reduce((x, y) => x + y, 0) + W.none[0] === 8, "collectors: wins + undecided = futures", W);
  ok(P.runs[0] === 8 && P.mean[0].every((x) => x >= 0 && x < 15), "collectors: mean points per seat", P.mean[0].map((x) => +x.toFixed(2)));
  ok(JSON.stringify(L.W[0]) === JSON.stringify(r.samples[0]), "collectors: leafSamples keeps every future's vector");
  ok(T.counts[0].rolled >= 8 * 8, "collectors: the event tally hears the game's events (rolls)", T.counts[0]);
  ok(!g.events.has("mc-tally"), "collectors: the tally listener is removed after the run");
  const half = (j0, j1) => { const a2 = MC.winCounts(n4), b2 = MC.points(n4); run({ F, j0, j1, turns: 12, collect: [a2, b2] }); return [a2.result(), b2.result()]; };
  const [w1, q1] = half(0, 3), [w2, q2] = half(3, 8);
  ok(JSON.stringify(wc.merge([w1, w2])) === JSON.stringify(W) && JSON.stringify(pt.merge([q1, q2]).mean) === JSON.stringify(P.mean), "collectors: merge(parts of a split run) = the whole run");
  { const m = MC.meanSe([0.2, 0.4, 0.6]); ok(Math.abs(m.mean - 0.4) < 1e-12 && Math.abs(m.se - Math.sqrt(0.04 / 3)) < 1e-12, "meanSe: mean and standard error of the mean"); }
}

// ── 5 runners: inline vs worker pool ──
{
  const rec = { st: recs[100].st, trk: recs[100].trk, ts: recs[100].ts, pid: recs[100].pid };
  const args = { base, rec, seed: 131, turns: 4 };
  const inline = new MC.InlineRunner({ game: g });
  const a = await MC.runFutures(inline, args, { n: 9, chunks: 3 });
  const a1 = await MC.runFutures(inline, args, { n: 9, chunks: 1 });
  ok(JSON.stringify(a.samples) === JSON.stringify(a1.samples) && a.samples.length === 9, "runners: inline, 3 chunks = 1 chunk (9 futures)");
  const pool = new MC.WorkerPool({ size: 2, spawn: await MC.nodeSpawner() });
  try {
    const b = await MC.runFutures(pool, args, { n: 9, chunks: 3 });
    ok(JSON.stringify(b.samples) === JSON.stringify(a.samples), "runners: WorkerPool (2 threads) = InlineRunner, the same futures to the last digit");
    const wcA = MC.winCounts(n4).merge(a.parts.map((r) => r.parts.wins)), wcB = MC.winCounts(n4).merge(b.parts.map((r) => r.parts.wins));
    ok(JSON.stringify(wcA) === JSON.stringify(wcB), "runners: merged win counts equal", wcA.wins[0]);
    const ev = luckEvents(recs, E.state.stats, { rush: false }).find((e) => e.kind === "dice" && e.s > 10);
    const job = { task: "luck", args: { base, ev, opts: { futures: 5, maxFutures: 5 } } };
    const [x] = await inline.map([job]), [y] = await pool.map([job]);
    ok(JSON.stringify(strip(x)) === JSON.stringify(strip(y)) && !x.skip, "runners: a luck job gives the same numbers inline and on the pool");
    let err = null; try { await pool.map([{ task: "nope", args: {} }]); } catch (e) { err = e; }
    ok(!!err, "runners: a failing job rejects (the pool stays usable)", String(err?.message || "").split("\n")[0]);
    const [z] = await pool.map([job]); ok(JSON.stringify(strip(z)) === JSON.stringify(strip(x)), "runners: the pool still answers after an error");
  } finally { await pool.close(); }
}

// ── 6 luck identity against the pre-port numbers ──
{
  const GOLD = JSON.parse(fs.readFileSync(root + "tests/fixtures/mc198-luck.json", "utf8"));
  const O1 = { futures: 6, maxFutures: 14, seMax: 0.001 }, out = {};
  const evs = luckEvents(recs, E.state.stats, { rush: false }), byKind = {};
  evs.forEach((e) => { (byKind[e.kind] ||= []).push(e); });
  const pick = [];
  for (const k of Object.keys(byKind)) { const l = byKind[k], step = Math.max(1, Math.floor(l.length / (k === "dice" ? 8 : 4))); for (let i = 0; i < l.length; i += step) pick.push(l[i]); }
  const subset = (key) => full || /seat|ui191:dice:(0|28):|ui191:dev:4:|ui191:steal:5:|sea3:|six:dice:8|dice-deck:dev|classic4:steal/.test(key);
  for (const ev of pick) {
    const key = `ui191:${ev.kind}:${ev.s}:${ev.e}`;
    if (subset(key + ":own")) out[key + ":own"] = strip(luckEvent(g, base, ev, O1));
    if (ev.kind === "dice" && subset(key + ":grp")) out[key + ":grp"] = strip(luckEvent(g, base, ev, { ...O1, own: false }));
  }
  const RES = ["wood", "brick", "sheep", "wheat", "ore"];
  for (const [name, spec, turns, seed] of [["classic4", { seats: 4 }, 40, 5], ["sea3", { seats: 3, sea: true }, 40, 6], ["six", { seats: 6 }, 40, 7], ["dice-deck", { seats: 4, dice: "balanced" }, 30, 8]]) {
    const e = newGame(g, { ...spec, seed }); e.release();
    const rng = SIM.mulberry32(seed * 7 + 1); Math.random = rng;
    let k = 0; while (g.setupPhase && k++ < 80) { g.setupAction = null; g.processSetupQueue(); }
    SIM.rollout(g, turns, rng, {}); k = 0; while (g.phase !== "pre_roll" && k++ < 6) SIM.rollout(g, 1, rng, {});
    const sst = g.serializeState(), pp = sst.players[g.currentPlayerIndex]; ["sheep", "wheat", "ore"].forEach((r) => { pp.resources[r] = Math.max(1, pp.resources[r]); });
    const rec = { st: JSON.stringify(sst), trk: g._aiCardTrack?.est || null, ts: g.turnSerial, pid: g.currentPlayerIndex, e: 0 };
    const pid = rec.pid, deck = g.devDeck.slice(), dv = deck.find(Boolean), players = g.players.map((p) => ({ res: { ...p.resources }, id: p.id })), vict = players.find((p) => p.id !== pid && RES.filter((r) => p.res[r] > 0).length >= 2);
    const hex = g.geometry.hexes.findIndex((h) => h.resource !== "sea" && h.resource !== "desert");
    const evl = [{ kind: "dice", s: 3, rec, roll: 8, roller: pid, rush: false, via: null, e: 10 }, { kind: "dice", s: 3, rec, roll: 7, roller: pid, rush: false, via: null, e: 11 }];
    if (dv) evl.push({ kind: "dev", s: 3, rec: { ...rec, e: 12 }, pid, card: dv, e: 12 });
    if (vict) evl.push({ kind: "steal", s: 3, rec: { ...rec, e: 13 }, thief: pid, victim: vict.id, res: RES.indexOf(RES.find((r) => vict.res[r] > 0)), hex, e: 13 });
    for (const ev of evl) {
      const key = `${name}:${ev.kind}:${ev.roll || ""}`;
      if (subset(key + ":own")) out[key + ":own"] = strip(luckEvent(g, {}, ev, O1));
      if (ev.kind === "dice" && subset(key + ":grp")) out[key + ":grp"] = strip(luckEvent(g, {}, ev, { ...O1, own: false }));
    }
  }
  const i0 = recs.findIndex((r) => r && r.k === "setup" && r.s === 0 && typeof r.st === "string");
  out["seat"] = strip(luckSeats(g, base, recs[i0], { futures: 12 }));
  if (process.argv.includes("--dump")) fs.writeFileSync(process.argv[process.argv.indexOf("--dump") + 1], JSON.stringify(out));
  if (process.argv.includes("--hashes")) fs.appendFileSync(process.argv[process.argv.indexOf("--hashes") + 1], JSON.stringify(Object.fromEntries(Object.keys(out).map((k) => [k, sha(out[k])]))) + "\n"); // regenerate the fixture after an engine rule change
  const bad = Object.keys(out).filter((k) => sha(out[k]) !== GOLD[k]);
  ok(Object.keys(out).length >= 15 && !bad.length, `luck identity: ${Object.keys(out).length} results (dice own + grouped, dev, steal, seat order; classic / Seafarers / 5-6 / balanced dice) hash-equal to the pre-port numbers${full ? " (full)" : ""}`, bad);
}

// ── 7 step-mc identity (the step ledger's position values, ported onto simulate) ──
{
  const GOLD = JSON.parse(fs.readFileSync(root + "tests/fixtures/mc198-step.json", "utf8")), out = {};
  for (const i of [0, 12, 30, 60, 90, 150, 200]) { const r = recs[Math.min(i, recs.length - 1)]; out["ui191:" + i] = strip(posValue(g, base, { rec: r, F: 6 })); if (i % 2 === 0) out["ui191:" + i + ":pass"] = strip(posValue(g, base, { rec: r, F: 5, pass: true })); out["ui191:" + i + ":fit"] = strip(valueAt(g, base, r, { futures: 4, leaf: "fit2", jOff: 3, seed: 7 })); }
  for (const [name, spec, turns, seed] of [["classic4", { seats: 4 }, 40, 5], ["sea3", { seats: 3, sea: true }, 40, 6], ["six", { seats: 6 }, 40, 7], ["deck", { seats: 4, dice: "balanced" }, 30, 8]]) {
    for (const extra of [0, 3]) {
      const e = newGame(g, { ...spec, seed }); e.release();
      const rng = SIM.mulberry32(seed * 7 + 1); Math.random = rng;
      let k = 0; while (g.setupPhase && k++ < 80) { g.setupAction = null; g.processSetupQueue(); }
      SIM.rollout(g, turns + extra, rng, {});
      const rec = { st: JSON.stringify(g.serializeState()), trk: g._aiCardTrack?.est || null, ts: g.turnSerial, pid: g.currentPlayerIndex };
      out[name + ":" + extra] = strip(posValue(g, {}, { rec, F: 6 }));
      out[name + ":" + extra + ":pass"] = strip(posValue(g, {}, { rec, F: 4, pass: true }));
    }
  }
  if (process.argv.includes("--hashes")) fs.appendFileSync(process.argv[process.argv.indexOf("--hashes") + 1], JSON.stringify(Object.fromEntries(Object.keys(out).map((k) => [k, sha(out[k])]))) + "\n"); // regenerate the fixture after an engine rule change
  const bad = Object.keys(GOLD).filter((k) => sha(out[k]) !== GOLD[k]);
  ok(Object.keys(out).length === Object.keys(GOLD).length && !bad.length, `step-mc identity: ${Object.keys(out).length} position values (futures, pass valuation, fit2 leaf, jOff; classic / Seafarers / 5-6 / balanced dice) hash-equal to the pre-port numbers`, bad);
}
// ── why-mc as a collector: the feature trace equals tracing by hand around the same rollout; the observers leave the game as they found it ──
{
  const own0 = ["placeSettlement", "placeCity", "endTurn", "distributeResources"].map((k) => Object.prototype.hasOwnProperty.call(g, k));
  const cases = [["classic", () => loadRecord(g, base, recs[100])]];
  for (const [name, spec, seed] of [["sea", { seats: 3, sea: true }, 6], ["six", { seats: 6 }, 7]]) cases.push([name, () => { played(spec, seed, 30); }]);
  for (const [name, setup] of cases) {
    setup(); if (g.phase !== "main" && g.phase !== "pre_roll") continue;
    const w = MC.capture(g), me = g.currentPlayerIndex, F = MC.futures({ seed: 131 }), by = [];
    for (let j = 0; j < 4; j += 1) { MC.reinstate(g, w); const ts = traceStart(g, me); const f = F.rngs(j); MC.rollFuture(g, { rng: f.policy, dice: f.dice, turns: 6, onEnd: ts.hook }); by.push(featuresOf(ts.end(), { vp: g.players[me].victoryPoints, won: !!g.winner && g.winner.id === me })); }
    const col = MC.featureTrace(me); MC.simulate({ g, world: w, F, n: 4, turns: 6, collect: [col], headless: false });
    const feats = col.result().feats[0];
    ok(JSON.stringify(feats) === JSON.stringify(by) && by.some((f) => f.got10 > 0), `featureTrace (${name}): the collector's features equal tracing by hand`, by[0]);
  }
  ok(own0.every((had, i) => had === Object.prototype.hasOwnProperty.call(g, ["placeSettlement", "placeCity", "endTurn", "distributeResources"][i])), "featureTrace: the observers are removed after the run");
}
console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
