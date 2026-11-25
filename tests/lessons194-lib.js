// shared by tests/lessons194.js: the five real reviewed games (4 review exports + the game inside a saved browser state), opened in the real app.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// v1.99: the original five exports and the browser state they came from were lost with a container restart, so the games are the reviewed games committed in the repo:
// tests/fixtures/post199/r1.json, r2.json and tests/fixtures/ui191-game.json (the one game of the old five that survived: id mwbvik30avfn, still with its tests/evals/fixtures recount data).
const FX = path.join(__dirname, "fixtures"), FILES = [path.join(FX, "post199", "r1.json"), path.join(FX, "post199", "r2.json"), path.join(FX, "ui191-game.json")];
function games() {
  const out = FILES.map((f) => { const j = JSON.parse(fs.readFileSync(f, "utf8")); const { meta, format, v, ...rec } = j; return { meta, rec }; });
  // four more copies (new ids, later end times; two of each of the two post199 games) give the seven games the page needs for its lessons (the Lessons need a lesson to repeat in at least 2 games);
  // the examples of a copy are the same positions as the original's, which the recounts below allow for (they recount per saved game)
  [0, 1, 2, 3].forEach((k) => { const o = out[k % 2], id = o.meta.id.slice(0, -2) + "c" + k + "d"; out.push({ meta: { ...o.meta, id, start: o.meta.start + 5e6 * (1 + k), end: o.meta.end + 5e6 * (1 + k) }, rec: o.rec, copyOf: o.meta.id }); });
  return out.sort((a, b) => a.meta.end - b.meta.end);
}
const fixture = (id) => { const c = games().find((g) => g.meta.id === id); if (c && c.copyOf) id = c.copyOf;  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "evals", "fixtures", id + ".json"), "utf8")); } catch (_) { return null; } }; // null: no recount data for this game
async function open(port, { w = 360, h = 780, lang = "nl", locale } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: locale || (lang === "nl" ? "nl-NL" : "en-US") });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((l) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); }, lang);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  return { b, ctx, page, errors };
}
/** put the real games into the page's history WITHOUT their lessons row (as a device that saved them before v1.94 has them) */
async function importGames(page, gs, { rows = false } = {}) {
  for (const g of gs) await page.evaluate(async ({ g, rows }) => { const H = window.__colonistGame.hist; await H.open(); const m = { ...g.meta }; if (!rows) delete m.lr; await H.put(m, g.rec, { quiet: true }); }, { g, rows });
}
module.exports = { games, fixture, open, importGames, sleep };
