// Think time + rollouts of the anytime search in the real Web Worker (src/master/worker.js), headless Chromium, desktop CPU.
// CDP Emulation.setCPUThrottlingRate does NOT reach a Web Worker ("only supported for page targets"; rev104/supertime.js's x4 was a
// no-op), so the phone ESTIMATE is made by rollout throughput: a phone 4x slower does in X seconds what this does in X/4
// (rows "x4 est": budget X/4 here = the rollouts a 4x slower CPU gets in X s). Its wall time per decision is X (+ last rollout).
// node phone.js REC.json   (env K, CONFIGS, PORT)
const { chromium } = require("playwright");
const fs = require("fs");
const REC = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const PORT = process.env.PORT || 9861;
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: "block" })).newPage();
  await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  await page.evaluate(async () => { const M = await import("/src/master.js"); await M.masterWorker(); });
  const states = REC.recs.filter((r) => ["build", "end"].includes(r.k)).slice(0, +(process.env.K || 8)).map((r) => ({ state: { ...JSON.parse(r.st), ...REC.base }, trk: r.trk, turnSerial: r.ts, seat: r.pid }));
  const any = (ms) => ({ n: 1000, timeMs: ms, timeSlice: true, depth: 14, setupDepth: 18 });
  const ALL = { warm: { n: 100, timeMs: 0 }, m100: { n: 100, timeMs: 500 }, any2: any(2000), any3: any(3000), any5: any(5000), "x4est2": any(500), "x4est3": any(750), "x4est5": any(1250), full: { n: 1000, timeMs: 0, depth: 14, setupDepth: 18 } };
  for (const name of (process.env.CONFIGS || "warm,m100,any2,any3,any5,x4est2,x4est3,x4est5").split(",")) {
    const r = await page.evaluate(async ({ states, opts }) => {
      const M = await import("/src/master.js");
      const out = [];
      for (const s of states) { const t0 = performance.now(); const m = await M.masterRequest({ type: "decide", kind: "main", ...s, opts }, 300000); out.push({ ms: performance.now() - t0, roll: m?.record?.rollouts || 0, stop: m?.record?.stop, k: m?.record?.K || 0 }); }
      return out;
    }, { states, opts: ALL[name] });
    const real = r.filter((x) => x.k > 1);
    const avg = (f) => real.length ? Math.round(real.reduce((a, x) => a + f(x), 0) / real.length) : 0;
    console.log(`${name.padEnd(7)} searched ${real.length}/${r.length}  ${avg((x) => x.ms)} ms/move  max ${Math.round(Math.max(0, ...real.map((x) => x.ms)))}  rollouts ${avg((x) => x.roll)}  by time ${real.filter((x) => x.stop === "time").length}`);
  }
  await b.close();
})();
