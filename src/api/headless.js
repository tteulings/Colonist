// A headless game for Node: the real src/game.js on the Proxy DOM of src/master/dom.js, prepared the way the Master search and the golden
// harness (tests/golden/lib.mjs) prepare it. Booted once per process (a second call returns the same game).
//   const game = await bootHeadless();  const engine = newGame(game, { seats: 4, seed: 7 });
export async function bootHeadless() {
  if (globalThis.__apiHeadlessGame) return globalThis.__apiHeadlessGame;
  globalThis.self = globalThis.self || globalThis;
  await import("../master/dom.js");
  await import("../game.js");
  const { prepareEngine } = await import("../master/search.js");
  const g = prepareEngine(self.__colonistGame);
  g._rvOff = true; // no review recorder
  g.analysis = { on: false, paused: false, budget: 0, parked: null, last: null, seq: 0, min: false, lab: null, capture: false };
  globalThis.__apiHeadlessGame = g;
  return g;
}
