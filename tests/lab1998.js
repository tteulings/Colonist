// v1.99.8 AI Lab: every game mode of the app, in the Analysis board and in the Tournament.   node tests/lab1998.js [PORT=8941] [SHOTS=dir]
//  Analysis board: Map (Island, Seafarers, Lake, Isthmus, Random shape) x Players (3-6; 5-6 only on the Island) loads without page errors, with the right map and players;
//    Rush is disabled there (and says why), 5 / 6 players are disabled on the 3-4 player maps.
//  Tournament: Type (Classic, Rush) x Map x Players x Dice: 4 games, fast bots, Instant: finishes with results, no board drawing in the lab view while it runs;
//    the same seed gives the same board and the same games across two runs (Random shape uses its seed too);
//    Watch (headed): a game of every kind can be watched on the board.
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), PORT = +process.argv[2] || 8941, SHOTS = process.env.SHOTS || process.argv[3];
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }).listen(PORT);
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
if (process.env.SHOTONLY) process.env.SHOTONLY = "1";
const SHAPES = { island: [3, 4, 5, 6], seafarers: [3, 4], lake: [3, 4], isthmus: [3, 4], shape: [3, 4] };
const DICE = ["random", "balanced", "deck"];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 923 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/lab.html`);
  await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 40000 });
  await page.waitForTimeout(800);

  // ── Analysis board ──
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  for (const [shape, ps] of Object.entries(SHAPES)) for (const n of ps) {
    const r = await page.evaluate(async ([shape, n]) => {
      const L = window.__lab; L.st.map = "random"; L.st.shape = shape; L.st.players = String(n); L.st.pieces = "start";
      await L.newBoard(); const v = L.view();
      return { n: v.players.length, board: v.settings.board, sea: !!v.sea, big: !!v.bigBoard, hexes: v.geometry.hexes.length, pieces: v.players.every((p) => p.settlements.size >= 1), mode: v.settings.mode, shapeOn: document.querySelector("#labShape .on")?.dataset.sh, plOn: document.querySelector("#labPlayers .on")?.dataset.pl };
    }, [shape, n]);
    ok(r.n === n && r.board === shape && r.sea === (shape === "seafarers") && r.big === (shape === "island" && n >= 5) && r.hexes > 0 && r.pieces && r.mode === "classic" && r.shapeOn === shape && r.plOn === String(n), `Analysis ${shape} ${n} players: board loads, right map and players`, r);
  }
  const dis = await page.evaluate(async () => {
    const L = window.__lab; L.st.shape = "lake"; L.st.players = "4"; await L.newBoard();
    const d = (id) => [...document.querySelectorAll(`${id} button:disabled`)].map((b) => b.dataset.ty || b.dataset.pl || b.dataset.sh);
    const out = { type: d("#labType"), players: d("#labPlayers"), rushTitle: document.querySelector('#labType [data-ty="rush"]').title, note: document.getElementById("labBoardNote").textContent };
    L.st.shape = "island"; await L.newBoard(); out.playersIsland = d("#labPlayers"); return out;
  });
  ok(dis.type.join() === "rush" && /no turns/i.test(dis.rushTitle) && dis.players.join() === "5,6" && /3–4 player map/.test(dis.note) && dis.playersIsland.length === 0, "Analysis: Rush disabled with a reason, 5-6 players disabled on a 3-4 player map, all on the Island", dis);
  await page.evaluate(() => { window.__lab.st.shape = "isthmus"; window.__lab.st.players = "3"; return window.__lab.newBoard(); });
  await page.evaluate(() => document.getElementById("labBoardBtn").click()); await page.waitForTimeout(400);
  await shot("lab-board-sheet.png");
  await page.evaluate(() => document.getElementById("labBoardClose").click());
  await page.evaluate(() => { window.__lab.st.shape = "island"; window.__lab.st.players = "4"; return window.__lab.newBoard(); });

  if (process.env.SHOTONLY) { await page.evaluate(() => { window.__lab.setPane("tournament"); }); } else {
  // ── Tournament, Instant ──
  await page.evaluate(() => { window.__lab.setPane("tournament"); window.__lab.st.speed = "instant"; });
  const fast = (n) => Array(n).fill("beginner");
  let k = 0;
  for (const mode of ["classic", "rush"]) for (const [shape, ps] of Object.entries(SHAPES)) for (const n of ps) {
    const dice = DICE[k++ % 3];
    const r = await page.evaluate(async ([mode, shape, n, dice, spec]) => {
      const L = window.__lab, v = L.view(); let draws = 0; const orig = v.render; v.render = function (...a) { if (L.sim.running) draws += 1; return orig.apply(this, a); };
      const out = await L.runGames(4, { mode, shape, dice, spec, nSeats: n });
      v.render = orig;
      const f = document.getElementById("labSim").contentWindow.__colonistGame;
      return { done: out.done, errors: out.errors, res: out.results.length, vp: out.results.every((x) => x.vp.length === n && x.keys.length === n && Math.max(...x.vp) >= 5), winners: out.results.filter((x) => x.winner != null).length, st: f.settings.mode + "/" + f.settings.board + "/" + f.settings.dice + "/" + f.players.length, draws, noRenderer: !f.boardRenderer, summary: !document.getElementById("labSummary").hidden, head: document.querySelector("#labSummary .lt-head small")?.textContent };
    }, [mode, shape, n, dice, fast(n)]);
    ok(r.res === 4 && r.errors === 0 && r.vp && r.winners >= 3 && r.st === `${mode}/${shape}/${dice}/${n}` && r.draws === 0 && r.noRenderer && r.summary, `Tournament Instant ${mode} ${shape} ${n}p ${dice}: 4 games, results, no board drawing`, r);
  }

  // ── same seed, same board and games ──
  for (const mode of ["classic", "rush"]) for (const shape of Object.keys(SHAPES)) {
    const r = await page.evaluate(async ([mode, shape]) => {
      const L = window.__lab, run = async () => {
        const out = await L.runGames(2, { mode, shape, dice: "deck", spec: Array(4).fill("beginner"), nSeats: 4 });
        const f = document.getElementById("labSim").contentWindow.__colonistGame; // the sim frame holds the last game: its board is game 2's
        return { res: out.results.map((x) => [x.winner, x.turns, x.vp.join()].join("/")), board: JSON.stringify(f.geometry.hexes.map((h) => [h.resource, h.number])), seed: f.mapSeed };
      };
      const a = await run(), b = await run(); return { same: JSON.stringify(a) === JSON.stringify(b), games: a.res, seed: a.seed };
    }, [mode, shape]);
    ok(r.same, `same seed, same board and games: ${mode} ${shape}${shape === "shape" ? ` (shape seed ${r.seed})` : ""}`, r.games);
  }
  const first = await page.evaluate(async () => { // the first board itself (game 1: seed 87087), twice, per mode
    const f = document.getElementById("labSim").contentWindow.__colonistGame, P = f.constructor.labHelpers.AI_PRESETS, out = {};
    for (const shape of ["island", "seafarers", "lake", "isthmus", "shape"]) {
      const b = () => { f._labSimStart(Array(4).fill({ ...P.beginner }), { players: 4, map: "random", board: shape, mode: "rush", seed: 87087 }); return JSON.stringify([f.geometry.hexes.map((h) => [h.q, h.r, h.resource, h.number]), f.mapSeed]); };
      const x = b(), y = b(); out[shape] = x === y; f._labSimStart(Array(4).fill({ ...P.beginner }), { players: 4, map: "random", board: shape, seed: 87087 + 7919 }); out[shape + "2"] = JSON.stringify(f.geometry.hexes.map((h) => [h.resource, h.number])) !== JSON.parse(x)[0].map((h) => 0) && true;
    }
    return out;
  });
  ok(["island", "seafarers", "lake", "isthmus", "shape"].every((s) => first[s]), "first board of a run is the same every time (all maps)", first);

  // ── Tournament, Watch (headed): the game is on the board while it runs ──
  const watchCombos = [["classic", "island", 3], ["classic", "island", 6], ["rush", "island", 4], ["rush", "seafarers", 3], ["classic", "seafarers", 4], ["classic", "lake", 3], ["rush", "isthmus", 4], ["rush", "shape", 3], ["classic", "shape", 4]];
  for (const [mode, shape, n] of watchCombos) {
    const r = await page.evaluate(async ([mode, shape, n]) => {
      const L = window.__lab; L.st.speed = "watch"; const seen = { watching: false, players: 0, board: null };
      const p = L.runGames(1, { mode, shape, dice: "balanced", spec: Array(n).fill("beginner"), nSeats: n });
      const t = setInterval(() => { const v = L.view(); if (L.sim.watching && v.players) { seen.watching = true; seen.players = v.players.length; seen.board = v.settings.board; } }, 100);
      const out = await p; clearInterval(t); L.st.speed = "instant";
      return { res: out.results.length, errors: out.errors, ...seen };
    }, [mode, shape, n]);
    ok(r.res === 1 && r.errors === 0 && r.watching && r.players === n && r.board === shape, `Tournament Watch ${mode} ${shape} ${n}p: the game is on the board`, r);
  }

  }
  // ── the Tournament settings ──
  const ui = await page.evaluate(async () => {
    const L = window.__lab; L.st.tmode = "classic"; L.st.tshape = "lake"; L.st.tseatN = 4; L.setPane("tournament");
    const d = (id) => [...document.querySelectorAll(`${id} button:disabled`)].map((b) => b.dataset.ns || b.dataset.rn);
    document.querySelector('#labTShape [data-ts="lake"]').click(); await new Promise((r) => setTimeout(r, 200));
    const out = { seats: d("#labNSeats"), note: document.getElementById("labTNote").textContent };
    document.querySelector('#labTType [data-tt="rush"]').click(); await new Promise((r) => setTimeout(r, 200));
    out.rushNote = document.getElementById("labTNote").textContent; out.rev = d("#labRevN");
    L.st.seats[0] = "master"; document.querySelector('#labTType [data-tt="rush"]').click(); await new Promise((r) => setTimeout(r, 100));
    L.st.tmode = "rush"; document.querySelector('#labTShape [data-ts="lake"]').click(); await new Promise((r) => setTimeout(r, 200));
    out.startDisabled = document.getElementById("labRun").disabled; out.slowNote = document.getElementById("labTNote").textContent;
    L.st.seats[0] = "expert"; L.st.tmode = "classic"; L.st.tshape = "island"; document.querySelector('#labTShape [data-ts="island"]').click(); await new Promise((r) => setTimeout(r, 200));
    return out;
  });
  ok(ui.seats.join() === "2,5,6" && /3–4 player map/.test(ui.note) && /Rush/.test(ui.rushNote) && ui.rev.length === 3 && ui.startDisabled && /cannot play Rush/.test(ui.slowNote), "Tournament: 2/5/6 players disabled on a 3-4 player map, Rush notes, Master blocked in Rush with a reason, Review off", ui);
  await page.evaluate(() => { const L = window.__lab; L.st.tmode = "rush"; L.st.tshape = "lake"; L.st.tdice = "deck"; L.st.tboard = "balanced"; L.st.tseatN = 4; L.st.speed = "instant"; L.st.seats = ["expert", "builder", "trader", "shark", "intermediate", "intermediate"]; L.setPane("tournament"); document.querySelector('#labTType [data-tt="rush"]').click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("labTType").scrollIntoView({ block: "start" }); scrollBy(0, -150); }); await page.waitForTimeout(300);
  await shot("lab-tournament-settings.png");

  ok(errs.length === 0, "no page errors", errs.slice(0, 3));
  await browser.close(); srv.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
})();
