// Headless bot tournament (no browser).  node scripts/tournament.mjs --bots expert,master,rules --games 2000 --mode classic --seats 4 --seed 1 --workers 4 --out results.jsonl
// See docs/tournament.md. Games run on the golden harness (tests/golden/lib.mjs): real src/game.js, one seeded Math.random, counted search budgets.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import fs from "node:fs";
import os from "node:os";

// ── bot selection: the ONLY place that maps a tournament bot name to a seat spec. Today: the lib.mjs preset names (AI_PRESETS keys and the
// search bots master/super/superplus/grandmaster). "rules" is an alias of the rulebook preset "simple". Switch to src/bots/registry.js here. ──
const ALIAS = { rules: "simple" };
export const botSpec = (name) => ALIAS[name] || name;

const MODES = { classic: {}, rush: { mode: "rush" }, seafarers: { sea: true }, "56": {} };
const DEFAULT_SEATS = { classic: 4, rush: 4, seafarers: 3, "56": 6 };
const mix = (a) => { let x = (a >>> 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x45d35d6b); x = Math.imul(x ^ (x >>> 16), 0x45d35d6b); return (x ^ (x >>> 16)) >>> 0; };

/** The deterministic plan of game i: board seed (shared by the nb rotations of one cycle: paired boards) and the seat line-up (rotating). */
export function planGame(o, i) {
  const nb = o.bots.length, cycle = Math.floor(i / nb), rot = i % nb;
  return { game: i, seed: mix(o.seed * 1000003 + cycle), bots: Array.from({ length: o.seats }, (_, s) => o.bots[(rot + s) % nb]) };
}


// ───────────────────────── worker ─────────────────────────
async function worker() {
  const L = await import("../tests/golden/lib.mjs");
  const F = workerData.o.dump ? await import("../src/master/leaf-gbm.js") : null;
  parentPort.on("message", (job) => {
    if (!job) process.exit(0);
    const o = workerData.o, rows = [];
    const spec = { id: "t" + job.game, seed: job.seed, seats: job.bots.map(botSpec), ...MODES[o.mode] };
    if (o.dump && o.mode !== "rush") {
      let last = -1;
      spec.onTurn = (g) => {
        if (g.winner || g.turn === last || g.turn % o.dumpEvery) return; last = g.turn;
        const X = g.sea ? F.gbmFeaturesSea(g) : F.gbmFeatures(g);
        X.forEach((x, seat) => rows.push({ game: job.game, turn: g.turn, seat, x: x.map((v) => Math.round(v * 1e5) / 1e5), vp: g.players[seat].victoryPoints }));
      };
    }
    const t0 = performance.now();
    const r = L.playGame(spec);
    const ms = Math.round(performance.now() - t0);
    const res = { game: job.game, seed: job.seed, mode: o.mode, bots: job.bots, winner: r.winner, points: r.vp, turns: r.turns, ms };
    for (const row of rows) { row.y = row.seat === r.winner ? 1 : 0; row.final = r.vp[row.seat]; row.sea = !!spec.sea; }
    parentPort.postMessage({ res, rows });
  });
  parentPort.postMessage("ready");
}

// ───────────────────────── stats ─────────────────────────
const wilson = (w, n) => { if (!n) return [0, 0, 0]; const z = 1.96, p = w / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [p, (c - m) / d, (c + m) / d]; };
const pct = (x) => (100 * x).toFixed(1) + "%";

/** Plackett-Luce / Bradley-Terry rating (the same model as the Bots page: P(seat wins) = softmax of the ratings, Elo scale, +400 = 10x the odds),
 *  fitted by Hunter's MM iteration. Games with no winner are skipped. Anchor: --anchor bot = 1000, else the mean rating = 1000. */
export function ratings(games, names, anchor) {
  const idx = new Map(names.map((n, i) => [n, i])), K = names.length;
  const G = games.filter((g) => g.winner != null && g.bots[g.winner] != null).map((g) => ({ w: idx.get(g.bots[g.winner]), c: g.bots.reduce((a, b) => (a[idx.get(b)]++, a), new Array(K).fill(0)) }));
  const fit = (S) => {
    const W = new Array(K).fill(0.5); S.forEach((g) => { W[g.w] += 1; }); // half a win against an average bot keeps a 0-win bot finite
    let gam = new Array(K).fill(1);
    for (let it = 0; it < 300; it++) {
      const den = new Array(K).fill(1);
      for (const g of S) { let z = 0; for (let k = 0; k < K; k++) z += g.c[k] * gam[k]; for (let k = 0; k < K; k++) if (g.c[k]) den[k] += g.c[k] / z; }
      const ng = gam.map((_, k) => W[k] / den[k]), m = Math.exp(ng.reduce((a, x) => a + Math.log(x), 0) / K); ng.forEach((x, k) => { ng[k] = x / m; });
      const dl = Math.max(...ng.map((x, k) => Math.abs(Math.log(x / gam[k])))); gam = ng; if (dl < 1e-7) break;
    }
    const e = gam.map((x) => 400 * Math.log10(x)), off = anchor != null && idx.has(anchor) ? 1000 - e[idx.get(anchor)] : 1000;
    return e.map((x) => x + off);
  };
  if (!G.length) return names.map(() => ({ v: 1000, ci: NaN }));
  const base = fit(G), B = 200, boots = names.map(() => []);
  let s = 12345; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; // fixed bootstrap seed: the summary is reproducible
  for (let b = 0; b < B; b++) { const S = Array.from({ length: G.length }, () => G[Math.floor(rnd() * G.length)]); fit(S).forEach((x, k) => boots[k].push(x)); }
  return base.map((v, k) => { const a = boots[k].sort((x, y) => x - y); return { v, ci: (a[Math.floor(0.975 * B)] - a[Math.floor(0.025 * B)]) / 2 }; });
}

export function summarize(games, o, wallS) {
  const names = [...new Set(games.flatMap((g) => g.bots))].sort();
  const S = o.seats, st = Object.fromEntries(names.map((n) => [n, { n: 0, w: 0, turns: 0, pts: 0, bySeat: Array.from({ length: S }, () => ({ n: 0, w: 0 })) }]));
  const seatW = new Array(S).fill(0); let none = 0, turns = 0, simMs = 0;
  for (const g of games) {
    turns += g.turns; simMs += g.ms; if (g.winner == null) none++; else seatW[g.winner]++;
    g.bots.forEach((b, s) => { const x = st[b]; x.n++; x.pts += g.points[s]; x.turns += g.turns; x.bySeat[s].n++; if (g.winner === s) { x.w++; x.bySeat[s].w++; } });
  }
  const R = ratings(games, names, o.anchor), N = games.length;
  const rows = names.map((n, k) => { const x = st[n], [p, lo, hi] = wilson(x.w, x.n); return { bot: n, seatsPlayed: x.n, wins: x.w, win: p, lo, hi, avgPts: x.pts / x.n, rating: R[k].v, ratingCi: R[k].ci, bySeat: x.bySeat.map((b) => (b.n ? b.w / b.n : null)) }; });
  return { games: N, noWinner: none, seatWin: seatW.map((w) => w / Math.max(1, N - none)), avgTurns: turns / Math.max(1, N), simGamesPerSecPerCore: N / Math.max(1e-9, simMs / 1000), wallGamesPerSec: wallS ? N / wallS : null, rows };
}

export function printSummary(sm, o) {
  const out = [`\n${sm.games} games, mode ${o.mode}, ${o.seats} seats, chance level ${pct(1 / o.seats)}${sm.noWinner ? `, ${sm.noWinner} without a winner` : ""}`];
  const w = Math.max(5, ...sm.rows.map((r) => r.bot.length));
  out.push(`${"bot".padEnd(w)}  seats   wins   win rate (95% CI)        avg pts  rating (95%)    win % by seat`);
  for (const r of [...sm.rows].sort((a, b) => b.rating - a.rating)) out.push(`${r.bot.padEnd(w)}  ${String(r.seatsPlayed).padStart(5)}  ${String(r.wins).padStart(5)}   ${pct(r.win).padStart(6)} [${pct(r.lo)}, ${pct(r.hi)}]  ${r.avgPts.toFixed(2).padStart(7)}  ${String(Math.round(r.rating)).padStart(5)} ±${String(Math.round(r.ratingCi)).padEnd(4)}   ${r.bySeat.map((x) => (x == null ? "-" : (100 * x).toFixed(0))).join(" / ")}`);
  out.push(`win rate per seat (play order): ${sm.seatWin.map((x, i) => `s${i + 1} ${pct(x)}`).join("  ")}`);
  out.push(`avg turns ${sm.avgTurns.toFixed(1)}  |  ${sm.simGamesPerSecPerCore.toFixed(2)} games/s per core${sm.wallGamesPerSec ? `  |  ${sm.wallGamesPerSec.toFixed(2)} games/s wall (this run)` : ""}`);
  console.log(out.join("\n"));
}

// ───────────────────────── main ─────────────────────────
function parseArgs(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith("--")) continue; const key = k.slice(2); const nx = argv[i + 1]; if (nx == null || nx.startsWith("--")) a[key] = true; else { a[key] = nx; i++; } }
  const mode = a.mode || "classic"; if (!MODES[mode]) throw new Error("--mode must be classic|rush|seafarers|56");
  const o = { bots: String(a.bots || "expert,intermediate").split(",").map((s) => s.trim()).filter(Boolean), games: +(a.games ?? 100), mode, seats: +(a.seats ?? DEFAULT_SEATS[mode]), seed: +(a.seed ?? 1),
    workers: Math.max(1, +(a.workers ?? os.availableParallelism?.() ?? os.cpus().length)), out: a.out || null, dump: !!a["dump-states"], dumpEvery: +(a["dump-every"] ?? 4), anchor: a.anchor || null, quiet: !!a.quiet };
  if (mode === "56" && (o.seats < 5 || o.seats > 6)) throw new Error("--mode 56 needs --seats 5 or 6");
  if (mode !== "56" && o.seats > 4) throw new Error("more than 4 seats: use --mode 56");
  if (o.seats < 2) throw new Error("--seats >= 2");
  if (o.dump && !o.out) throw new Error("--dump-states needs --out");
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const done = new Map();
  if (o.out && fs.existsSync(o.out)) for (const l of fs.readFileSync(o.out, "utf8").split("\n")) {
    if (!l.trim()) continue; let r; try { r = JSON.parse(l); } catch { continue; } // a torn last line of an interrupted run is simply replayed
    const p = planGame(o, r.game);
    if (r.seed !== p.seed || r.mode !== o.mode || r.bots.join() !== p.bots.join()) throw new Error(`${o.out}: game ${r.game} was played with other arguments (bots/seed/mode/seats); use a new --out`);
    done.set(r.game, r);
  }
  if (o.out && fs.existsSync(o.out) && !fs.readFileSync(o.out, "utf8").endsWith("\n") && fs.statSync(o.out).size) fs.appendFileSync(o.out, "\n"); // end a torn last line
  const jobs = []; for (let i = 0; i < o.games; i++) if (!done.has(i)) jobs.push(planGame(o, i));
  const total = jobs.length, t0 = Date.now(); let fin = 0;
  if (done.size && !o.quiet) console.error(`resuming: ${done.size} games already in ${o.out}, ${total} to go`);
  const statesPath = o.dump ? o.out.replace(/\.jsonl$/, "") + ".states.jsonl" : null;
  if (o.dump) {
    const F = await import("../src/master/leaf-gbm.js");
    fs.writeFileSync(statesPath.replace(/\.jsonl$/, ".names.json"), JSON.stringify({ names: F.GBM_NAMES, seaNames: [...F.GBM_NAMES, ...F.SEA_NAMES], note: "x = gbmFeatures (island) or gbmFeaturesSea (rows with sea:true, seaNames); one row per seat per sampled turn; y = 1 if that seat won" }));
    if (!done.size) fs.writeFileSync(statesPath, "");
  }
  const all = [...done.values()];
  const tick = () => { if (!o.quiet) process.stderr.write(`\r${fin}/${total} games  ${(fin / Math.max(0.001, (Date.now() - t0) / 1000)).toFixed(2)} games/s  `); };
  const iv = setInterval(tick, 1000);
  const nw = Math.min(o.workers, jobs.length);
  await Promise.all(Array.from({ length: nw }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { execArgv: ["--no-warnings"], workerData: { o: { mode: o.mode, dump: o.dump, dumpEvery: o.dumpEvery } } });
    w.on("message", (m) => {
      if (m !== "ready") {
        all.push(m.res); fin++;
        if (o.out) fs.appendFileSync(o.out, JSON.stringify(m.res) + "\n");
        if (statesPath && m.rows.length) fs.appendFileSync(statesPath, m.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
      }
      w.postMessage(jobs.shift() || null);
    });
    w.on("error", reject); w.on("exit", resolve);
  })));
  clearInterval(iv); if (!o.quiet) { tick(); process.stderr.write("\n"); }
  all.sort((a, b) => a.game - b.game);
  if (all.length) printSummary(summarize(all, o, (Date.now() - t0) / 1000 || null), o);
}

if (isMainThread) await main(); else worker();
