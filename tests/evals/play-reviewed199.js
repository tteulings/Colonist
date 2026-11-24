// v1.99 calibration data: plays a REAL 4-player game in the app (Chromium), runs the app's own post-game review for every seat and saves the export.
// Seat 0 is a scripted person (the review recorder only runs when a person is at the table); seats 1-3 are bots of the chosen levels (their decisions are
// recorded and reviewed too: "the others" round). The export is what the app's "Export file" writes (format colonist-game v1), gzipped.
//
//   one game : node tests/evals/play-reviewed199.js game --seed 7 --levels beginner,simple,intermediate --human learner [--points 10] [--out DIR] [--port 8750]
//   a batch  : node tests/evals/play-reviewed199.js batch --plan tests/evals/calib199-plan.json [--par 3] [--out tests/evals/calib199] [--port0 8750]
//              (plan: [{ "seed": 1, "levels": ["expert","builder","shark"], "human": "solid", "points": 10 }, ...]; games already in --out are skipped)
//   a game is deterministic up to the review (seeded Math.random, virtual clock for the play); the review workers run in real time.
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path"), zlib = require("zlib"), cp = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const argv = process.argv.slice(2), mode = argv[0], opt = (n, d) => { const i = argv.indexOf("--" + n); return i < 0 ? d : argv[i + 1]; };
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".gz": "application/gzip", ".wasm": "application/wasm" };
const serve = (root, port) => new Promise((res, rej) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; const f = path.join(root, u); if (!f.startsWith(root)) { r.writeHead(403); return r.end(); } fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); r.end(d); }); }); s.on("error", rej); s.listen(port, () => res(s)); });
const gid = (p) => `s${p.seed}-${p.levels.join("+")}-${p.human}-p${p.points || 10}`;

/** in the page: one step of the scripted person (handlers only, the way the buttons call them). "learner": random, often ends early, sometimes wasteful; "solid": spends on the best thing it can afford. */
function humanSetup(kind) {
  const R = ["wood", "brick", "sheep", "wheat", "ore"];
  window.__humanStep = () => {
    const g = window.__colonistGame, me = g.players.find((p) => p.isHuman);
    if (g.winner) return "over";
    if (g.hsCoverOn != null) { g._hsAck(); return "cover"; }
    const rnd = window.__hr;
    if (g.pendingIncomingTrade) { g.resolveIncomingTrade(kind === "learner" && rnd() < 0.5); return "incoming"; }
    if (g.pendingDiscard?.player?.isHuman) {
      const pd = g.pendingDiscard, h = { ...pd.player.resources };
      R.forEach((r) => { pd.selected[r] = 0; });
      for (let i = 0; i < pd.count; i++) { const r = kind === "learner" && rnd() < 0.4 ? R[Math.floor(rnd() * 5)] : R.slice().sort((a, b) => h[b] - h[a])[0]; if (h[r] <= 0) { i--; continue; } h[r]--; pd.selected[r]++; }
      g._confirmDiscard(); return "discard";
    }
    const cur = g.currentPlayer;
    if (!cur?.isHuman) return "wait";
    if (g.robberVictimOptions?.length) { const o = g.robberVictimOptions; g.stealFromVictim(cur, o[kind === "learner" ? Math.floor(rnd() * o.length) : 0]); g.robberContext = null; g.robberVictimOptions = []; g.render(); return "victim"; }
    if (g.pendingAction === "robber") { g._commitRobber(cur, g.chooseRobberHex(cur)); return "robber"; }
    if (g.setupPhase) {
      if (g.setupAction === "settlement") {
        let id = g.getBestInitialSettlementNode(cur);
        if (kind === "learner" && rnd() < 0.5) { const ok = g.api.legalOfType(cur.id, "setup")?.filter?.((a) => a.piece === "settlement" || a.type === "settlement"); if (ok && ok.length) id = (ok[Math.floor(rnd() * ok.length)].id ?? id); }
        g._commitSetup(cur, { type: "settlement", id }); return "setup-s";
      }
      if (g.setupAction === "road") { const e = g.geometry.edges.find((x) => x.owner == null && x.nodes.includes(g.lastSetupNodeId)); g._commitSetup(cur, { type: e.ship ? "ship" : "road", id: e.id }); return "setup-r"; }
      return "wait";
    }
    if (g.phase === "sbp") { g.api.act({ actor: cur.id, type: "passSbp" }); return "sbp"; }
    if (g.phase === "pre_roll") { if (g.rollDiceBtn?.disabled) return "wait"; g.handleHumanRoll(); return "roll"; }
    if (g.phase !== "main" || g._robberInProgress() || g.devPick) return "wait";
    const has = (c) => Object.entries(c).every(([r, n]) => cur.resources[r] >= n);
    const learner = kind === "learner";
    if (learner && rnd() < 0.18) { g.handleHumanEndTurn(); return "end"; } // ends early, with things left to do
    const builds = g.api.legalOfType(cur.id, "build");
    const pick = (piece) => builds.filter((a) => a.piece === piece);
    const act = (a) => { if (a) { g.api.act(a); return true; } return false; };
    const choose = (L) => L[learner ? Math.floor(rnd() * L.length) : 0];
    const order = learner ? ["road", "settlement", "city", "dev", "road"].sort(() => rnd() - 0.5) : ["city", "settlement", "dev", "road"];
    for (const o of order) {
      if (o === "dev") { if (has({ sheep: 1, wheat: 1, ore: 1 }) && g.devDeck.length && (!learner || rnd() < 0.6)) { g.handleHumanBuyDevCard(); return "buy"; } continue; }
      if (o === "road" && !learner && cur.roads.size >= 6 && cur.settlements.size + cur.cities.size < 4 && !pick("settlement").length) { if (rnd() < 0.5) continue; }
      if (o === "city" && !learner) { const L = pick("city"); if (L.length && act(choose(L))) return "city"; continue; }
      const L = pick(o); if (L.length && (!learner || rnd() < 0.7) && act(choose(L))) return o;
    }
    if (cur.devCards.knight > 0 && !g.currentTurnPlayedDevCard && (learner ? rnd() < 0.5 : true)) { g.handleHumanPlayDevCard("knight"); return "knight"; }
    // a bank trade when it buys something (4:1 with a big surplus; learners do it at random)
    const tot = R.reduce((a, r) => a + cur.resources[r], 0);
    if (tot >= (learner ? 6 : 5) && (learner ? rnd() < 0.5 : true) && !window.__tradedThisTurn?.[g.turnSerial]) {
      window.__tradedThisTurn = { [g.turnSerial]: 1 };
      const give = R.slice().sort((a, b) => cur.resources[b] - cur.resources[a])[0], get = R.slice().sort((a, b) => cur.resources[a] - cur.resources[b])[learner ? Math.floor(rnd() * 3) : 0];
      if (give !== get && cur.resources[give] >= 4) { try { g.tradeOffer = Object.fromEntries(R.map((r) => [r, 0])); g.tradeRequest = Object.fromEntries(R.map((r) => [r, r === get ? 1 : 0])); g.handleHumanBankTrade(); } catch (_) { /* no trade */ } return "bank"; }
    }
    g.handleHumanEndTurn(); return "end";
  };
}

async function playGame(p, port, outDir) {
  const t0 = Date.now(), tag = gid(p), file = path.join(outDir, tag + ".json.gz");
  const srv = await serve(ROOT, port);
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "en-US" });
    const page = await ctx.newPage(); const errors = [];
    page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
    const T0 = 1_700_000_000_000 + p.seed * 86_400_000; // a different virtual day per seed: game ids are made from Date.now()
    await page.clock.install({ time: T0 });
    await page.addInitScript(({ seed }) => {
      localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_lang", "en");
      let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      window.__hr = (() => { let x = (seed * 7919 + 13) % 2147483647 || 7; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
    }, { seed: p.seed });
    await page.goto(`http://localhost:${port}/`);
    await page.clock.pauseAt(T0 + 5000);
    for (let i = 0; i < 200 && !(await page.evaluate(() => !!window.__colonistGame && !!document.body.dataset.gameReady)); i++) await page.clock.runFor(100);
    await page.evaluate(humanSetup, p.human);
    const settings = { mode: "classic", board: "island", map: p.map || "random", numBots: 3, winPoints: p.points || 10, botStyleMode: "each", perBot: [...p.levels, "builder", "trader"] };
    await page.evaluate((s) => { window.__colonistGame.startNewGame(s); }, settings);
    let polls = 0, last = "";
    for (; polls < 40000; polls++) {
      await page.clock.runFor(250);
      const st = await page.evaluate(() => { const r = window.__humanStep(); const g = window.__colonistGame; return [r, g.winner ? g.winner.id : null, g.turn]; });
      if (st[1] != null) break;
      if (st[2] > 400) throw new Error("game does not end (turn " + st[2] + ")");
    }
    const tPlay = Date.now() - t0;
    await page.clock.resume(); // the review runs in workers, in real time
    // wait for the review of every seat (quick + deep round) and the luck run to finish and settle
    let stable = 0, rev = null; const tEnd = Date.now() + +opt("review-min", 14) * 60_000;
    while (Date.now() < tEnd) {
      await new Promise((r) => setTimeout(r, 1500));
      rev = await page.evaluate(() => {
        const g = window.__colonistGame, R = g._rv; if (!R) return { err: "no _rv" };
        const seats = g.players.map((pl) => ({ pid: pl.id, todo: g._rvTodo(pl.id).length, done: g._rvReviewComplete(pl.id), res: R.revs[pl.id]?.results?.length || 0 }));
        return { run: !!R.run, lrun: !!R.lrun, q: (R.queue || []).length, again: !!R.again, seats, luck: !!R.luck, lw: g._lkWant ? !!g._lkWant() : null, id: R.id };
      });
      const done = rev && !rev.err && !rev.run && !rev.lrun && !rev.q && !rev.again && rev.seats.every((s) => !s.todo || s.done);
      stable = done ? stable + 1 : 0; if (stable >= 3) break;
    }
    const tRev = Date.now() - t0 - tPlay;
    const out = await page.evaluate(async () => {
      const g = window.__colonistGame; await g.histArchive(); await new Promise((r) => setTimeout(r, 400));
      const H = g.hist; await H.open(); const m = H.metas.find((x) => x.id === g.stats.id); const rec = await H.get(g.stats.id);
      return { meta: m, rec, seats: g.players.map((pl) => ({ id: pl.id, name: pl.name, human: !!pl.isHuman, personality: pl.personality || null, vp: pl.victoryPoints })), winner: g.winner?.id, turns: g.turn };
    });
    if (!out.meta || !out.rec) throw new Error("no saved game");
    if (!(rev && rev.seats && rev.seats.every((s) => !s.todo || s.done))) throw new Error("review not complete in time (CPU starved? lower --par): " + JSON.stringify(rev));
    const doc = { format: "colonist-game", v: 1, meta: out.meta, ...out.rec, calib: { tag, seed: p.seed, levels: { 0: "human:" + p.human, 1: p.levels[0], 2: p.levels[1], 3: p.levels[2] }, points: p.points || 10, map: settings.map, winner: out.winner, turns: out.turns, seats: out.seats, reviewComplete: !!(rev && rev.seats.every((s) => !s.todo || s.done)), seatsReview: rev && rev.seats, playMs: tPlay, reviewMs: tRev, errors: errors.slice(0, 5) } };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file + ".tmp", zlib.gzipSync(JSON.stringify(doc), { level: 9 })); fs.renameSync(file + ".tmp", file);
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`done ${tag}: turns ${out.turns}, winner seat ${out.winner}, play ${(tPlay / 1000).toFixed(0)}s + review ${(tRev / 1000).toFixed(0)}s, ${kb} KB, complete=${doc.calib.reviewComplete}, errors ${errors.length}`);
    return { tag, ok: true, playMs: tPlay, reviewMs: tRev, kb, complete: doc.calib.reviewComplete };
  } finally { await b.close().catch(() => {}); srv.close(); }
}

(async () => {
  if (mode === "game") {
    const p = { seed: +opt("seed", 1), levels: opt("levels", "intermediate,intermediate,intermediate").split(","), human: opt("human", "solid"), points: +opt("points", 10), map: opt("map") };
    const out = path.resolve(opt("out", path.join(ROOT, "tests/evals/calib199")));
    await playGame(p, +opt("port", 8750), out);
  } else if (mode === "batch") {
    const plan = JSON.parse(fs.readFileSync(path.resolve(opt("plan")), "utf8")), out = path.resolve(opt("out", path.join(ROOT, "tests/evals/calib199"))), par = +opt("par", 3), port0 = +opt("port0", 8750);
    const todo = plan.filter((p) => !fs.existsSync(path.join(out, gid(p) + ".json.gz")));
    console.log(`plan ${plan.length}, to play ${todo.length}, parallel ${par}`);
    let next = 0; const t0 = Date.now();
    const worker = async (w) => {
      while (next < todo.length) {
        const p = todo[next++], port = port0 + w;
        for (let attempt = 0; attempt < 2; attempt++) {
          const r = await new Promise((res) => { const c = cp.spawn(process.execPath, [__filename, "game", "--seed", p.seed, "--levels", p.levels.join(","), "--human", p.human, "--points", p.points || 10, "--out", out, "--port", port, ...(p.map ? ["--map", p.map] : [])], { stdio: ["ignore", "pipe", "pipe"] }); let o = ""; c.stdout.on("data", (d) => (o += d)); c.stderr.on("data", (d) => (o += d)); c.on("close", (code) => res({ code, o })); });
          console.log(r.code === 0 ? r.o.trim().split("\n").pop() : `FAILED ${gid(p)} (attempt ${attempt + 1}): ${r.o.trim().slice(-300)}`);
          if (r.code === 0) break;
        }
      }
    };
    await Promise.all(Array.from({ length: par }, (_, w) => worker(w)));
    console.log(`batch finished in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  } else { console.log("usage: game|batch (see the header)"); process.exit(1); }
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
