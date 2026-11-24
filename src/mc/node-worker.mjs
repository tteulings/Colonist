// Monte Carlo toolkit: a Node worker thread for WorkerPool (nodeSpawner). Boots one headless game, then answers { type:"mc", id, task, args }.
import { parentPort } from "node:worker_threads";
const { bootHeadless } = await import("../api/headless.js");
const { TASKS } = await import("./tasks.js");
const g = await bootHeadless();
parentPort.on("message", (m) => {
  if (m.type !== "mc") return;
  try { parentPort.postMessage({ type: "mc", id: m.id, result: TASKS[m.task](g, m.args) }); } catch (e) { parentPort.postMessage({ type: "error", id: m.id, message: String(e && e.stack || e) }); }
});
parentPort.postMessage({ type: "ready" });
