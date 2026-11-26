// v1.99.5 DAILY PUZZLE: the "Slimme bot" benchmark. The reference player (REFERENCE_BOT, the Hard bot) plays your seat on the day's own board, rolls and
// card stacks against the day's Blaauw and Geelen, headless, on this device. Used by the worker (src/master/worker.js "daily") and by the tests.
import { dayDef, dayLook, DAY_SETTINGS, DAILY_RULES, TURN_LIMIT, WIN_POINTS } from "./daily.js";
import { REFERENCE_BOT } from "./bots/registry.js";

/** { turns, ms }: turns = the reference bot's own turns when it reached 10 points; null when it lost or ran out of the 40 turns. `g` is a prepared headless game. */
export function playDay(g, day) {
  const H = g.constructor.labHelpers, dd = dayDef(day), t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const settings = H.normalizeSettings({ ...DAY_SETTINGS, look: dayLook(0) }), keepSettings = Object.getOwnPropertyDescriptor(g, "_labSettings"), keepRandom = Math.random;
  g._labSettings = () => settings;
  g.daily = { day, rules: DAILY_RULES, practice: true, bench: true, rollIx: 0, stealIx: 0, dk: [0, 0, 0] };
  try {
    const P = H.AI_PRESETS;
    g._labSimStart([{ ...P[REFERENCE_BOT] }, { ...P[settings.perBot[0]] }, { ...P[settings.perBot[1]] }], { players: 3, seed: dd.seed });
    let r = { done: false }, guard = 0;
    while (!r.done && guard++ < 600) r = g._labSimStep(1);
    const won = !!g.winner && g.winner.id === 0 && !g.daily?.timeUp && g.players[0].victoryPoints >= WIN_POINTS;
    return { turns: won ? Math.min(TURN_LIMIT, g.turn) : null, vp: g.players.map((p) => p.victoryPoints), end: g.turn, ms: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0) };
  } finally {
    g.daily = null; Math.random = keepRandom;
    if (keepSettings) Object.defineProperty(g, "_labSettings", keepSettings); else delete g._labSettings;
  }
}
