// Monte Carlo win chance from any position, on clones (src/api/engine.js clone() = master/sim.js snapshot/restore). Node:  node examples/mc-winchance.js [seed] [n]
// Hidden cards are the true ones here (an omniscient estimate); the honest, belief-resampled version is migration step 6.
const { pickAction } = require("./random-bot.js");
async function winChance(engine, seat, { n = 40, maxActions = 600 } = {}) {
  let wins = 0, s = 99; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) {
    const sim = engine.clone();                                                  // an independent future
    for (let k = 0; k < maxActions && sim.winner() == null; k++) {
      const prompt = sim.prompts()[0], legal = sim.enumerate(prompt.actor, { prompt, max: 40 });
      if (!sim.apply(pickAction(sim.view(prompt.actor), prompt, legal, rnd)).ok) break;
    }
    const vp = sim.view("spectator").seats.map((x) => x.vp);                      // unfinished: share of the points
    wins += sim.winner() != null ? +(sim.winner() === seat) : vp[seat] / vp.reduce((a, b) => a + b, 0);
    sim.dispose();
  }
  return wins / n;
}
module.exports = { winChance };
if (require.main === module) (async () => {
  const { bootHeadless } = await import("../src/api/headless.js");
  const { newGame } = await import("../src/api/engine.js");
  const seed = +process.argv[2] || 7, n = +process.argv[3] || 40;
  const engine = newGame(await bootHeadless(), { seats: 4, seed });
  let s = seed; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 200 && engine.winner() == null; k++) {                      // play 200 actions, then ask
    const prompt = engine.prompts()[0];
    engine.apply(pickAction(engine.view(prompt.actor), prompt, engine.enumerate(prompt.actor, { prompt, max: 40 }), rnd));
  }
  const t0 = Date.now(), p = [0, 1, 2, 3].map(() => 0);
  for (let seat = 0; seat < 4; seat++) p[seat] = await winChance(engine, seat, { n });
  console.log(`after 200 actions (turn ${engine.view("spectator").turn}): win chance by seat ${p.map((x) => (100 * x).toFixed(0) + "%").join(" / ")}  (${n} rollouts each, ${Date.now() - t0} ms)`);
  process.exit(0);
})();
