// node docs/lab110/lab-stats.test.mjs   (pure parts of the Tournament)
import assert from "node:assert/strict";
import { drawSeats, seatKeys, aggregate, verdict, diffSig, compareRuns, wilson } from "../../src/lab-stats.js";
const pool = ["master", "expert", "builder", "trader", "shark", "intermediate", "beginner", "simple"];
// reproducible + paired: game i is the same line-up every time, whatever happened before
const run = () => Array.from({ length: 50 }, (_, i) => drawSeats(["random", "random", "expert", "random"], i, pool));
assert.deepEqual(run(), run());
assert.deepEqual(drawSeats(["random", "random"], 7, pool), drawSeats(["random", "random"], 7, pool));
assert.notDeepEqual(run().slice(0, 10), run().slice(10, 20)); // games differ from each other
// fixed seats never change; random seats vary and cover the pool
const all = run(); assert.ok(all.every((d) => d[2] === "expert"));
assert.ok(new Set(all.flatMap((d) => [d[0], d[1], d[3]])).size >= 6);
// distinct: no bot twice
for (let i = 0; i < 200; i++) { const d = drawSeats(["random", "random", "random", "random"], i, pool, true); assert.equal(new Set(d).size, 4); }
for (let i = 0; i < 200; i++) { const d = drawSeats(["expert", "random", "random", "random"], i, pool, true); assert.equal(new Set(d).size, 4); }
// rotation: each bot plays every seat equally often
const seen = {}; for (let i = 0; i < 8; i++) seatKeys(["a", "b", "c", "d"], i, true).forEach((k, s) => { (seen[k] ||= []).push(s); });
for (const k of "abcd") assert.deepEqual([...new Set(seen[k])].sort(), [0, 1, 2, 3]);
assert.deepEqual(seatKeys(["a", "b"], 5, false), ["a", "b"]);
// aggregation sums: wins over all bots = games with a winner; n sums to seats x games
const rs = Array.from({ length: 40 }, (_, i) => { const keys = seatKeys(drawSeats(["random", "random", "random", "random"], i, pool), i, true); return { keys, winner: i % 9 === 0 ? null : i % 4, turns: 60 + i, vp: [10, 5, 6, 7] }; });
const rows = aggregate(rs);
assert.equal(rows.reduce((a, r) => a + r.n, 0), 160);
assert.equal(rows.reduce((a, r) => a + r.wins, 0), rs.filter((r) => r.winner !== null).length);
const e = rows.find((r) => r.key === "expert"); const seatsE = rs.reduce((a, r) => a + r.keys.filter((k) => k === "expert").length, 0);
assert.equal(e.n, seatsE);
assert.ok(Math.abs(rows.reduce((a, r) => a + r.vp, 0) - 28 * 40) < 1e-9);
assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].p >= r.p)); // ranked
assert.equal(rows[0].fair, 0.25);
// verdict rule
const mk = (key, n, wins) => aggregate([...Array(n)].map((_, i) => ({ keys: [key, "x"], winner: i < wins ? 0 : 1, turns: 1, vp: [1, 1] }))).find((r) => r.key === key);
const row = (key, label, n, wins) => { const [lo, hi] = wilson(wins, n); return { key, label, n, wins, p: wins / n, lo, hi }; };
let v = verdict([row("e", "Expert", 100, 41), row("i", "Intermediate", 300, 60)]);
assert.equal(v.line, "Expert beats Intermediate: 41% vs 20%, 95% sure."); assert.equal(v.kind, "clear");
v = verdict([row("e", "Expert", 100, 38), row("b", "Builder", 100, 33)]); assert.equal(v.kind, "unclear"); assert.match(v.line, /No clear difference yet/);
v = verdict([row("e", "Expert", 100, 41), row("s", "Shark", 100, 30), row("i", "Intermediate", 100, 20)]); assert.match(v.line, /Expert wins most: 41%\. Intermediate is last: 20%/);
assert.equal(verdict([row("e", "Expert", 10, 8), row("i", "Intermediate", 10, 1)]).kind, "wait");
assert.equal(verdict([row("e", "Expert", 100, 25)]).kind, "none");
assert.equal(diffSig(row("a", "A", 100, 50), row("b", "B", 100, 50)).sig, false);
// saved-run compare
const c = compareRuns({ rows: [row("e", "Expert", 100, 41), row("i", "Intermediate", 300, 60)] }, { rows: [row("e", "Expert", 100, 29), row("x", "X", 100, 1)] });
assert.equal(c.length, 1); assert.equal(c[0].key, "e"); assert.equal(Math.round(c[0].diff * 100), 12);
console.log("lab-stats: all ok");
