// Paired, seat-rotated: for seed s, rotation r: the test bot sits in seat r, 3 opponents elsewhere; the same
// seed with plain Expert in seat r is the paired baseline (run separately as test spec "E").
// node --import ./register.mjs tourney.mjs out.jsonl TEST OPP from to [workers]
//   spec: E | I | M|{"n":100,"timeMs":0}
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import fs from "node:fs";
if (isMainThread) {
  const [OUT, TEST, OPP, FROM, TO, WORKERS = "4"] = process.argv.slice(2);
  const done = new Set();
  if (fs.existsSync(OUT)) fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).forEach((l) => { const r = JSON.parse(l); done.add(`${r.seed}:${r.rot}`); });
  const jobs = [];
  for (let s = +FROM; s <= +TO; s++) for (let r = 0; r < 4; r++) if (!done.has(`${s}:${r}`)) jobs.push({ seed: s, rot: r });
  const total = jobs.length; let fin = 0, wins = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(+WORKERS, jobs.length) }, () => new Promise((resolve) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { TEST, OPP }, execArgv: ["--import", new URL("./register.mjs", import.meta.url).pathname], env: process.env });
    const next = () => { const j = jobs.shift(); w.postMessage(j || null); };
    w.on("message", (r) => { fs.appendFileSync(OUT, JSON.stringify(r) + "\n"); fin++; if (r.win) wins++; if (fin % 20 === 0) console.log(`${fin}/${total} win ${(100 * wins / fin).toFixed(1)}% ${((Date.now() - t0) / 1000).toFixed(0)}s`); next(); });
    w.on("error", (e) => { console.error("worker error", e); resolve(); });
    w.on("exit", resolve);
    next();
  })));
  console.log("done", fin, ((Date.now() - t0) / 1000).toFixed(0), "s");
} else {
  const { playGame, AI_PRESETS, makeMaster } = await import("./engine.mjs");
  const mk = (spec) => { const [b, js] = spec.split("|"); const opt = js ? JSON.parse(js) : {};
    const strategy = { ...(b === "I" ? AI_PRESETS.intermediate : AI_PRESETS.expert) };
    return b === "M" ? { strategy: { ...strategy, policy: "master" }, agent: makeMaster(opt) } : { strategy, agent: null }; };
  parentPort.on("message", (j) => {
    if (!j) process.exit(0);
    const seats = [0, 1, 2, 3].map((i) => mk(i === j.rot ? workerData.TEST : workerData.OPP));
    const t = performance.now();
    const r = playGame({ seed: j.seed, seats });
    const ag = seats[j.rot].agent;
    parentPort.postMessage({ seed: j.seed, rot: j.rot, winner: r.winner, win: r.winner === j.rot, turns: r.turns, vp: r.vp[j.rot], gameMs: Math.round(performance.now() - t),
      st: ag ? { d: ag.stats.decisions, dev: ag.stats.deviations, main: ag.stats.mainMs, setup: ag.stats.setupMs, rob: ag.stats.robMs, chose: ag.stats.chose, roll: ag.stats.rollouts } : undefined });
  });
}
