// node tests/golden/regen.mjs --force [--only substr]    Rewrites the goldens from the CURRENT code. It refuses without --force: a golden changes only when
// the behaviour is meant to change (a deliberate re-baseline release), never during a refactor. Review the diff of tests/golden/*.json before committing.
import fs from "node:fs";
import { checks, FILES } from "./checks.mjs";
const here = new URL("./", import.meta.url).pathname;
if (!process.argv.includes("--force")) { console.error("regen refuses to overwrite the goldens without --force (they are the safety net of the refactor; run.mjs checks them)."); process.exit(2); }
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const out = {}; for (const k of Object.keys(FILES)) out[k] = fs.existsSync(here + FILES[k]) ? JSON.parse(fs.readFileSync(here + FILES[k], "utf8")) : {};
for (const c of checks) { if (only && !c.id.includes(only)) continue; out[c.file][c.id] = await c.run(); console.log("wrote", c.id); }
for (const k of Object.keys(FILES)) fs.writeFileSync(here + FILES[k], JSON.stringify(out[k], null, 1) + "\n");
process.exit(0);
