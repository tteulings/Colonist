// A bot written against the Action API only (src/api/*): it never touches a game field. Node:  node examples/random-bot.js [seed] [seats]
// pickAction(view, prompt, legal, rnd) is the whole bot: it builds the best thing it can, otherwise answers each prompt at random.
const WEIGHT = { city: 3, settlement: 2.5, ship: 0.5, road: 0.4 };
function pickAction(view, prompt, legal, rnd) {
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  if (prompt.kind === "main" || prompt.kind === "sbp") {
    const builds = legal.filter((a) => a.type === "build");
    if (builds.length) return builds.reduce((b, a) => (WEIGHT[a.piece] > WEIGHT[b.piece] ? a : b));
    const buy = legal.find((a) => a.type === "buyDev"); if (buy) return buy;
    const play = legal.filter((a) => a.type === "playDev"); if (play.length) return pick(play);
    return legal.find((a) => a.type === "endTurn" || a.type === "passSbp");
  }
  if (prompt.kind === "respondTrade") return legal.find((a) => a.answer === "reject");
  return pick(legal); // set-up, roll, discard, robber, steal, free roads, picks: any legal action
}
module.exports = { pickAction };

if (require.main === module) (async () => {
  const { bootHeadless } = await import("../src/api/headless.js");
  const { newGame } = await import("../src/api/engine.js");
  const seed = +process.argv[2] || 7, seats = +process.argv[3] || 4;
  const engine = newGame(await bootHeadless(), { seats, seed });
  let s = seed, n = 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  while (engine.winner() == null && n < 20000) {
    const prompt = engine.prompts()[0];                                   // who must decide what now
    const legal = engine.enumerate(prompt.actor, { prompt, max: 40 });    // concrete legal actions
    const r = engine.apply(pickAction(engine.view(prompt.actor), prompt, legal, rnd));
    if (!r.ok) throw new Error(r.reason);
    n++;
  }
  const v = engine.view("omniscient");
  console.log(`seed ${seed}: ${n} actions, turn ${v.turn}, winner seat ${engine.winner()}, points ${v.seats.map((x) => x.vp).join("/")}, state ${engine.stateHash()}`);
  process.exit(0);
})();
