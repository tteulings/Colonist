// Monte Carlo toolkit: runners. A runner maps a list of jobs (task name + JSON args, see tasks.js) to their results, in order.
//   InlineRunner   in this thread, on the one headless game  { game }  (or boots one: bootHeadless in Node)
//   WorkerPool     one worker per core: jobs are dealt to the free workers as they finish (a work queue, no barrier)
// Spawners make the workers: nodeSpawner() (worker_threads, src/mc/node-worker.mjs) and webSpawner(url) (a module Web Worker answering {type:"mc"}).
import { TASKS } from "./tasks.js";

export class InlineRunner {
  constructor({ game = null, tasks = TASKS } = {}) { this.game = game; this.tasks = tasks; }
  async _game() { if (!this.game) { const { bootHeadless } = await import("../api/headless.js"); this.game = await bootHeadless(); } return this.game; }
  async map(jobs) { const g = await this._game(), out = []; for (const j of jobs) out.push(this.tasks[j.task](g, j.args)); return out; }
  async close() {}
}

export class WorkerPool {
  /** size: workers (default: the cores); spawn: () => { post(msg), onmessage(cb), onerror(cb), terminate() } */
  constructor({ size = 0, spawn } = {}) { this.size = Math.max(1, size || (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0) || 2); this.spawn = spawn; this.workers = []; this.seq = 0; }
  _start() {
    while (this.workers.length < this.size) {
      const w = { h: this.spawn(), busy: null, ready: null }; this.workers.push(w);
      w.ready = new Promise((res) => { w.h.onmessage((m) => { if (m.type === "ready") res(); else if (w.busy && m.id === w.busy.id) { const b = w.busy; w.busy = null; m.type === "error" ? b.rej(new Error(m.message)) : b.res(m.result); } }); });
      w.h.onerror?.((e) => { if (w.busy) { const b = w.busy; w.busy = null; b.rej(e instanceof Error ? e : new Error(String(e?.message || e))); } });
    }
  }
  async map(jobs) {
    this._start();
    const out = new Array(jobs.length); let next = 0;
    const run = async (w) => {
      await w.ready;
      while (next < jobs.length) {
        const i = next++, id = ++this.seq;
        out[i] = await new Promise((res, rej) => { w.busy = { id, res, rej }; w.h.post({ type: "mc", id, task: jobs[i].task, args: jobs[i].args }); });
      }
    };
    await Promise.all(this.workers.slice(0, Math.min(this.size, jobs.length)).map(run));
    return out;
  }
  async close() { await Promise.all(this.workers.map((w) => w.h.terminate())); this.workers = []; }
}

/** Node: worker_threads running src/mc/node-worker.mjs (a headless game per thread). */
export async function nodeSpawner() {
  const { Worker } = await import("node:worker_threads");
  const url = new URL("./node-worker.mjs", import.meta.url);
  return () => { const w = new Worker(url, { execArgv: ["--no-warnings"] }); return { post: (m) => w.postMessage(m), onmessage: (cb) => w.on("message", cb), onerror: (cb) => w.on("error", cb), terminate: () => w.terminate() }; };
}
/** Browser: a module Web Worker that handles {type:"mc"} (src/master/worker.js answers it from v1.98 on). */
export const webSpawner = (url) => () => { const w = new Worker(url, { type: "module" }); return { post: (m) => w.postMessage(m), onmessage: (cb) => { w.onmessage = (e) => cb(e.data); }, onerror: (cb) => { w.onerror = cb; }, terminate: () => w.terminate() }; };

/** Futures 0..n-1 of `args` (a TASKS.futures job) split over `chunks` jobs, merged: the same collector results whatever the split. */
export async function runFutures(runner, args, { n, chunks = 4 }) {
  const per = Math.ceil(n / chunks), jobs = [];
  for (let j0 = 0; j0 < n; j0 += per) jobs.push({ task: "futures", args: { ...args, j0, j1: Math.min(n, j0 + per) } });
  const res = await runner.map(jobs);
  return { parts: res, samples: res.flatMap((r) => r.samples) };
}
