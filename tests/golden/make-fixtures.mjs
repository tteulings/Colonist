// One-off: writes the generated saved positions (Seafarers and 5-6 players, a few turns in) into tests/golden/fixtures/. They are committed;
// re-running this only makes sense when the board generators change on purpose. Refuses to overwrite without --force.
import fs from "node:fs";
import { playGame } from "./lib.mjs";
const force = process.argv.includes("--force"), dir = new URL("./fixtures/", import.meta.url).pathname;
for (const [name, spec] of [["sea-save", { id: "f", seed: 61, sea: true, seats: ["expert", "intermediate", "expert"], stopTurn: 9, keepState: true }],
  ["six-save", { id: "f", seed: 62, seats: ["expert", "intermediate", "expert", "beginner", "intermediate", "expert"], stopTurn: 6, keepState: true }]]) {
  const f = dir + name + ".json";
  if (fs.existsSync(f) && !force) { console.log("exists, not overwritten (use --force):", f); continue; }
  const r = playGame(spec); fs.writeFileSync(f, JSON.stringify(r.state)); console.log("wrote", f, "turn", r.turns);
}
process.exit(0);
