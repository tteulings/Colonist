// node tests/events197-headless.mjs ROOT [id,id,...]   Plays golden games of the tree at ROOT headless and prints, per game, every journal line the game wrote
// (JSON on stdout). tests/events197.js runs it on the new tree and on a copy of the old one and compares: the log text of Rush-as-turns and every other mode.
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]);
const only = process.argv[3] ? process.argv[3].split(",") : null;
const lib = await import(pathToFileURL(path.join(root, "tests/golden/lib.mjs")).href);
const { GAMES } = await import(pathToFileURL(path.join(root, "tests/golden/games.mjs")).href);
const { g } = lib;
let sink = null;
Object.defineProperty(g, "addLog", { configurable: true, get: () => (t) => { if (sink) sink.push(String(t).replace(/\s+/g, " ")); return 0; }, set() {} }); // whatever the harness puts here, every line lands in the sink
if (typeof g.attachLog === "function") g.attachLog(); // (the new tree: the journal is a subscriber a headless engine does not carry)
const out = {};
for (const spec of GAMES) {
  if (only ? !only.includes(spec.id) : /master|super|grand/.test(spec.id)) continue; // the search bots play the same moves (the golden net); their games are slow
  sink = [];
  const r = lib.playGame(spec);
  out[spec.id] = { lines: sink, winner: r.winner ?? null, turns: r.turns ?? null };
}
process.stdout.write(JSON.stringify(out) + "\n", () => process.exit(0)); // (a game leaves a timer behind: exit when the line is out)
