// Headless A/B of the old route and the host route in ONE process, batches alternating (v1.99).
//   node tests/perf199-headless.mjs [--batches 8] [--games 15] [--seats expert,simple,intermediate,expert] [--mode classic|sea|six] [--profile]
// Prints games/s of CPU time per route (best and median batch), the ratio, and checks that both routes played identical games (winner, vp, turns, random calls).
import { playGame, hostMode } from "./golden/lib.mjs";
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const B = +arg("--batches", 8), N = +arg("--games", 15), seats = arg("--seats", "expert,simple,intermediate,expert").split(","), mode = arg("--mode", "classic");
const base = { classic: {}, sea: { sea: true }, six: {} }[mode];
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1e3; };
const run = (host, seed0) => {
  hostMode.on = host; const t = cpu(), res = [];
  for (let i = 0; i < N; i++) { const r = playGame({ id: "p", seed: seed0 + i, seats, ...base }); res.push(`${r.winner}/${r.turns}/${r.randomCalls}/${r.stateHash}`); }
  return { ms: cpu() - t, res: res.join() };
};
run(false, 9000); run(true, 9000); // warm-up
const O = [], H = [], RT = []; let same = true;
for (let b = 0; b < B; b++) {
  const s = 100 + b * N, flip = b % 2 === 1;
  const x = flip ? run(true, s) : run(false, s), y = flip ? run(false, s) : run(true, s);
  const o = flip ? y : x, h = flip ? x : y;
  if (o.res !== h.res) same = false;
  O.push(N / (o.ms / 1e3)); H.push(N / (h.ms / 1e3)); RT.push(o.ms / h.ms); // same seeds, back to back: the per-batch ratio is the fair number
}
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1], f = (x) => x.toFixed(1);
console.log(`old  games/s: best ${f(Math.max(...O))} median ${f(med(O))}`);
console.log(`host games/s: best ${f(Math.max(...H))} median ${f(med(H))}`);
console.log(`ratio host/old (per batch, same seeds): median ${med(RT).toFixed(3)}  best ${Math.max(...RT).toFixed(3)}  worst ${Math.min(...RT).toFixed(3)}   same games: ${same}`);
process.exit(0);
