// node tests/evals/build-fixtures.js   (needs playwright; PLAYWRIGHT_PATH=/path/to/playwright if not resolvable)
// Opens every available real game in the app (review exports + the games in a browser storage state), builds the app's fact index
// (src/review/ai-index.js) and saves it as JSON in tests/evals/fixtures/. Re-run only when ai-index.js facts change.
//   env: EXPORTS=a.json,b.json  STATE=storage-state.json
const fs = require("fs"), path = require("path");
const { open, sleep } = require("./browser.js"), { rehydrate } = require("./fx.js"), { tagsOf } = require("./tags.js");
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/", SC = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/";
const EXPORTS = (process.env.EXPORTS ? process.env.EXPORTS.split(",") : ["23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f));
const STATE = process.env.STATE || SC + "redesign/state9984.json";
const OUT = path.join(__dirname, "fixtures");

// runs in the page: the serialisable fact index
async function extract() {
  const g = window.__colonistGame, fx = g._pgState().fx, keys = fx.keys, T = fx.T, refs = {}, add = (r) => { const v = fx.ref(r); if (v) refs[r] = v; };
  keys.forEach((k) => { add(`name.${k}`); add(`pts.${k}`); add(`luck.total.${k}`); for (let t = 0; t <= T; t++) { add(`wc.${k}@${t}`); add(`d.${k}@${t}`); }
    ["pivot", "pivot.t", "pivot.to", "steady", "wobbly", "headless", "plan", "waitRes", "waitN", "E", "SD", "idleN", "turns", "verdict", "feeds"].forEach((f) => add(`strat.${k}.${f}`));
    ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => add(`rate.${r}.${k}`)); });
  for (let t = 0; t <= T; t++) add(`turn.${t}`);
  ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { add(`rate.${r}.top`); add(`rate.${r}.low`); });
  ["game.winner", "game.T", "luck.dominant", "near.pts", "near.wpts", "near.goal", "near.margin", "near.res", "near.n", "near.label"].forEach(add);
  fx.decs.forEach((d) => ["gap", "neg", "played", "best"].forEach((f) => add(`dec.${d.turn}.${f}`)));
  if (fx.board) { fx.board.robber.forEach((m) => { add(`rob.${m.turn}.hex`); add(`rob.${m.turn}.by`); }); keys.forEach((k) => { add(`setup.${k}.1`); add(`setup.${k}.2`); }); }
  const strip = (s) => s && (({ hand, ptsBy, ...r }) => r)(s);
  const j = JSON.parse(JSON.stringify({
    n: fx.n, me: fx.me, T, keys, players: fx.players, winner: fx.winner, won: fx.won, hasWc: fx.hasWc, hasLog: !!fx.log,
    strat: fx.strat.map(strip), luck: fx.luck, rate: fx.rate, dice: fx.dice ? { N: fx.dice.N } : null, near: fx.near && (({ needed, ...r }) => ({ ...r, needed: needed && { label: needed.label, missing: needed.missing } }))(fx.near),
    decs: fx.decs.map(({ e, ...r }) => r), refs, board: fx.board && { hexes: fx.board.hexes, robber: fx.board.robber, setup: fx.board.setup },
    meta: { mode: g._histView?.mode || null, pts: g.players.map((p) => p.victoryPoints), names: g.players.map((p) => p.name) },
  }, (k, v) => (typeof v === "function" ? undefined : v)));
  j.behindRaw = (await import("/src/review/ai-behind.js")).behindRaw(g); // v1.89 the board and event log copy tests/behind189.js re-derives the why-behind numbers from
  return j;
}

async function openGame(page, id) {
  await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(2500);
  await page.locator("[data-rvt=ai]").tap(); await sleep(2500);
}
const save = (F) => { const fx = rehydrate(F); F.tags = tagsOf(fx); fs.writeFileSync(path.join(OUT, `${F.id}.json`), JSON.stringify(F)); console.log("fixture", F.id, F.source, `n=${F.n} T=${F.T} won=${F.won}`, F.tags.join(",")); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { b, page, errors } = await open({ storageState: fs.existsSync(STATE) ? STATE : undefined });
  const done = new Set();
  // 1. the games already in the browser storage state
  const own = await page.evaluate(() => window.__colonistGame.hist.metas.map((m) => m.id));
  for (const id of own) { try { await openGame(page, id); const F = await page.evaluate(extract); F.id = id; F.source = "state"; save(F); done.add(id); } catch (e) { console.log("skip", id, e.message.split("\n")[0]); } }
  // 2. review exports
  for (const f of EXPORTS) {
    if (!fs.existsSync(f)) { console.log("missing", f); continue; }
    const ex = JSON.parse(fs.readFileSync(f, "utf8")); if (done.has(ex.meta.id)) continue;
    try {
      await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
      await openGame(page, ex.meta.id); const F = await page.evaluate(extract); F.id = ex.meta.id; F.source = path.basename(f).replace(/^[0-9a-f]+-/, ""); save(F); done.add(ex.meta.id);
    } catch (e) { console.log("skip", f, e.message.split("\n")[0]); }
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 3));
  await b.close();
})();
