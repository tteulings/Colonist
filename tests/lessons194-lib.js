// shared by tests/lessons194.js: the five real reviewed games (4 review exports + the game inside a saved browser state), opened in the real app.
const { chromium } = require("playwright"); const fs = require("fs"); const zlib = require("zlib"); const path = require("path");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/", SC = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/";
const EXPORTS = ["c96a5156-colonist-2026-11-11-mwb26snvis5o.json", "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function games() {
  const out = EXPORTS.map((f) => { const j = JSON.parse(fs.readFileSync(UP + f, "utf8")); const { meta, format, v, ...rec } = j; return { meta, rec }; });
  const st = JSON.parse(fs.readFileSync(SC + "redesign/state9984.json", "utf8")).origins[0].indexedDB[0].stores;
  const meta = st.find((s) => s.name === "games").records[0].value, blob = st.find((s) => s.name === "blobs").records[0].valueEncoded.o.find((x) => x.k === "data").v.ab.b;
  out.push({ meta, rec: JSON.parse(zlib.gunzipSync(Buffer.from(blob, "base64")).toString()) });
  return out.sort((a, b) => a.meta.end - b.meta.end);
}
const fixture = (id) => JSON.parse(fs.readFileSync(path.join(__dirname, "evals", "fixtures", id + ".json"), "utf8"));
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
module.exports = { games, fixture, open, importGames, sleep, UP, SC };
