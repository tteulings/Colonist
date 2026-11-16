// v1.90 builds tests/evals/ledger/<id>.json: the step ledger of a real game computed the way the app does (src/review/ledger.js + step-mc.js posValue), headless in Node:
// A for every position (25 futures), the adaptive refinement of the focus rounds, B for the biggest rounds. Usage: node tests/evals/build-ledger190.mjs <export.json> <id> [<export.json> <id> ...]
// (the three games are the owner's exports of 2026-11-11 / 2026-11-14). Prints the timings.
import fs from "fs";
import { unpackRecs } from "../../src/review/pack.js";
import { g } from "../../scripts/ledger/node-engine.mjs";
import { posValue } from "../../src/review/step-mc.js";
import { posEvents, makeLedger, refineRound, creditRound, LG } from "../../src/review/ledger.js";
import { ledgerModel } from "../../src/review/ai-ledger.js";
import { gameShape, shapeChart } from "../../src/review/ai-shape.js";
import { createRequire } from "module";
import { langOf } from "../../src/review/ai-lang.js";
const require = createRequire(import.meta.url), { rehydrate, withLedger } = require("./fx.js");
const args = process.argv.slice(2), OUT = new URL("./ledger/", import.meta.url).pathname, FX = new URL("./fixtures/", import.meta.url).pathname;
const hash = (s) => { let a = 0xdeadbeef; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 2654435761); return (a >>> 0).toString(36); };
for (let k = 0; k < args.length; k += 2) {
  const E = JSON.parse(fs.readFileSync(args[k])), id = args[k + 1], recs = unpackRecs(E.rv.recs), base = E.rv.base, n = E.state.players.length, winner = E.state.winnerId;
  const me = Math.max(0, E.state.players.findIndex((p) => !p.isAI && p.isHuman)), res = {}, T = {};
  const t0 = performance.now(), led0 = () => makeLedger({ recs, n, winner, res });
  for (const ev of posEvents(recs)) { const x = posValue(g, base, ev); res[`pos:${ev.i}`] = { F: x.F, v: x.v, w: x.w }; }
  T.A = performance.now() - t0; T.positions = Object.keys(res).length;
  const fx = withLedger(rehydrate(JSON.parse(fs.readFileSync(FX + id + ".json"))), makeLedger({ recs, n, winner, res }).series()), shape = gameShape(fx); // the app's card reads the ledger's series
  const marks = shape && shape.id !== "seesaw" ? (shapeChart(fx, shape, fx.keys[fx.me], fx.keys[winner]).marks || []) : [];
  const raw = JSON.parse(fs.readFileSync(FX + id + ".json")).behindRaw;
  const ctx = { recs, steps: E.state.stats.steps, ev: E.state.stats.ev, hexes: E.state.hexes };
  const led = led0(), model = ledgerModel({ led, ctx, raw, me, win: winner, marks, sx: null, lg: langOf("nl").lg });
  const t1 = performance.now(), cap = [], value = async (c, F, o = {}) => posValue(g, base, { rec: { st: recs[c].st, trk: recs[c].trk, ts: recs[c].ts, pid: recs[c].pid }, F, ...(o.pass ? { pass: true } : {}) });
  const store = (key, e) => { res[key] = e; };
  const done = new Set(); // (refining moves the numbers: take the focus again until every round that is shown is refined, like the app)
  for (let pass = 0; pass < 3; pass++) { const todo = model.focus().filter((t) => !done.has(t)); if (!todo.length) break; for (const t of todo) { const r = await refineRound(led, t, model.seats, value, store); done.add(t); cap.push([t, r.positions, +(r.maxSe * 100).toFixed(2), r.capped]); } }
  T.refine = performance.now() - t1; const t2 = performance.now();
  for (const t of model.creditTurns()) await creditRound(led, t, model.seats, ctx, value, store);
  const focusEnd = model.focus(), unrefined = focusEnd.filter((t) => !done.has(t)); if (unrefined.length) console.log("UNREFINED", unrefined);
  T.B = performance.now() - t2;
  const trim = recs.map((r, i) => ({ k: r.k, pid: r.pid, t: r.t, s: r.s, e: r.e, ts: r.ts, st: typeof r.st === "string" ? hash(`${r.st}|${JSON.stringify(r.trk)}|${r.pid}|${r.ts}`) : null, a: { type: r.a?.type, id: r.a?.id, hex: r.a?.hex, t: r.a?.t, tr: r.a?.tr } }));
  fs.writeFileSync(OUT + id + ".json", JSON.stringify({ id, n, me, winner, names: E.state.players.map((p) => p.name), recs: trim, steps: E.state.stats.steps, ev: E.state.stats.ev, hexes: E.state.hexes.map((h) => ({ resource: h.resource, number: h.number })), res, T: { A: Math.round(T.A), refine: Math.round(T.refine), B: Math.round(T.B), positions: T.positions }, refined: cap }));
  console.log(id, "positions", T.positions, "A s", (T.A / 1000).toFixed(1), "refine s", (T.refine / 1000).toFixed(1), "B s", (T.B / 1000).toFixed(1), "refined", JSON.stringify(cap));
}
process.exit(0);
