// headless engine in Node, same setup as src/master/worker.js
globalThis.self = globalThis.self || globalThis;
await import("../../src/master/dom.js");
await import("../../src/game.js");
const { prepareEngine } = await import("../../src/master/search.js");
export const g = prepareEngine(self.__colonistGame); g._rvOff = true;
g.analysis = { on: false, paused: false, budget: 0, parked: null, last: null, seq: 0, min: false, lab: null, capture: false };
