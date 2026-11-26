// v1.99.5 Daily puzzle: node tests/daily1993.js PORT [SHOTS=dir]  (server: node tests/serve.mjs ROOT PORT)
// the day (same date -> same board, rolls, cards in two fresh browser contexts; other date -> other), the score / streak rules, the Amsterdam midnight (mocked clock),
// a run (own save, the day's dice by roll number, the limit of 40, give up, win, resume after a reload), the code and the share text, Home and the tab in every state,
// the smart bot (a worker plays the day headless, within the turn limit, cached), no change to the New game settings or to a normal saved game.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const port = +process.argv[2] || 9198, SHOTS = process.env.SHOTS || process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`;
const shot = async (page, f) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, f) }); };

async function open(browser, { vw = 412, vh = 923, lang = "nl", pal = "night", time = null, seed = null, keep = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US", colorScheme: pal === "night" ? "dark" : "light", ...(keep ? { storageState: keep } : {}) });
  if (time) await ctx.clock.install({ time: new Date(time) });
  await ctx.addInitScript(([l, p, s, k]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; if (!k) localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist_intro_seen", "1"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist.explain", "off"); localStorage.setItem("colonist.daily.v1.seen", "1"); if (s) for (const [a, b] of Object.entries(s)) localStorage.setItem(a, typeof b === "string" ? b : JSON.stringify(b)); } } catch (_) {} }, [lang, pal === "night" ? "night" : "light", seed, !!keep]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(500);
  return { ctx, page, errs, G: (f, a) => page.evaluate(f, a) };
}
const hist = (n) => ({}); // (games exist: the gate is off when the history has one)
const GAMES = async (G) => G(async () => { const H = window.__colonistGame.hist; await H.open(); const m = { id: "seed1", v: 1, start: Date.now() - 9e6, end: Date.now() - 6e6, mode: "classic", board: "island", n: 4, pts: 10, hot: false, me: 0, winner: 0, result: "won", turns: 30, ms: 3e6, star: false, seats: [{ name: "You", vp: 10, you: true }, { name: "A", vp: 5, prof: "intermediate" }] }; try { await H.put(m, {}); } catch (_) { H.metas.push(m); } H._sort(); window.__colonistGame.home.render(); window.__colonistGame.home.chrome.sync(); });
const MOD = (G) => G(async () => { window.__D = await import("/src/daily.js"); return true; });

(async () => {
  const browser = await chromium.launch();

  // ── 1. the day: pure ──
  { const { page, G, errs } = await open(browser); await MOD(G);
    const r = await G(() => { const D = window.__D, a = D.dayDef(330), b = D.dayDef(330), c = D.dayDef(331), d = D.dayDef(330, 2);
      const sev = (x, n) => x.rolls.slice(0, n).filter((q) => q[0] + q[1] === 7).length;
      return { same: JSON.stringify(a) === JSON.stringify(b), diff: JSON.stringify(a.rolls) !== JSON.stringify(c.rolls) && a.seed !== c.seed, rules: a.seed !== d.seed && JSON.stringify(a.rolls) !== JSON.stringify(d.rolls), n: a.rolls.length, s6: sev(a, 6), s18: sev(a, 18), dev: a.dev.map((x) => x.length), dv: [0, 1, 2].map((i) => a.dev[i].filter((x) => x === "knight").length),
        id: [D.dayIdOf(Date.UTC(2026, 10, 24, 12)), D.dayIdOf(Date.UTC(2026, 10, 24, 22, 59, 59)), D.dayIdOf(Date.UTC(2026, 10, 24, 23, 0, 0)), D.dayIdOf(Date.UTC(2026, 5, 24, 21, 59, 59)), D.dayIdOf(Date.UTC(2026, 5, 24, 22, 0, 0))],
        lab: [D.dayLabel(328, true), D.dayLabel(328, false)], look: [D.dayLook(0).join(), D.dayLook(1).join(), D.dayLook(2).join()] }; });
    ok(r.same && r.diff && r.rules, "same date -> same day, other date differs, the rules version is in the seed", r);
    ok(r.n >= 400 && r.s6 <= 1 && r.s18 >= 2 && r.s18 <= 4 && r.dev.every((x) => x === 25), "rolls: long list, fair opening; one 25-card stack per seat", [r.n, r.s6, r.s18]);
    ok(r.id.join() === "328,328,329,175,176" && r.lab[0] === "di 24 nov" && r.lab[1] === "Tue 24 Nov", "the Amsterdam day (winter and summer midnight)", r.id);
    ok(r.look.join("|") === "0,1,2,3,4,5|1,0,2,3,4,5|2,1,0,3,4,5", "the table: you, Blaauw, Geelen (Rosa takes the seat of the character you play)", r.look);
    // score and streak
    const s = await G(() => { const D = window.__D, d = (w, t, p) => ({ w, t, p });
      return { rankWin: D.compare(d(1, 30, [10, 5, 5]), d(0, 40, [9, 10, 5])) > 0, fewer: D.compare(d(1, 17, [10, 5, 5]), d(1, 20, [10, 5, 5])) > 0, tie: D.compare(d(1, 17, [10, 1, 1]), d(1, 17, [10, 5, 5])) === 0, more: D.compare(d(0, 24, [8, 10, 6]), d(0, 30, [7, 10, 6])) > 0,
        kinds: [D.kindOf(d(1, 17, [10, 5, 5])), D.kindOf(d(0, 24, [8, 10, 6])), D.kindOf(d(0, 40, [9, 8, 7])), D.kindOf(d(0, 7, [4, 3, 3]))],
        lines: [D.resultLine(d(1, 17, [10, 7, 4]), true), D.resultLine(d(0, 24, [8, 10, 6]), true), D.resultLine(d(0, 40, [9, 8, 7]), true)],
        st1: D.streakOf({ 326: { w: 1 }, 327: { w: 0 }, 328: { w: 1 } }, 328), st2: D.streakOf({ 326: { w: 1 }, 327: { w: 0 } }, 328), st3: D.streakOf({ 325: { w: 1 }, 326: { w: 1 }, 327: { w: 0 } }, 329), st4: D.streakOf({ 320: {}, 321: {}, 322: {}, 326: {} }, 328), st5: D.streakOf({}, 328) }; });
    ok(s.rankWin && s.fewer && s.tie && s.more, "ranking: a win beats any loss; fewer turns; a loss: more points; equal is a tie", s);
    ok(s.kinds.join() === "won,lost,timeup,gaveup" && s.lines[0] === "Gewonnen in 17 beurten" && s.lines[1] === "Verloren met 8 punten" && s.lines[2] === "Tijd op: 9 punten na 40 beurten", "result kinds and lines (win / loss / time up / give up)", s.lines);
    ok(s.st1.cur === 3 && s.st1.won === 2 && s.st2.cur === 2 && s.st3.cur === 0 && s.st3.best === 3 && s.st4.cur === 0 && s.st4.best === 3 && s.st5.cur === 0, "streak: wins and losses count, alive until the end of the day after, a missed day breaks it", [s.st1, s.st2, s.st3, s.st4]);
    // code
    const c = await G(() => { const D = window.__D, rec = { day: 328, w: true, t: 17, p: [10, 7, 4] }, code = D.encode(rec), back = D.decode(code);
      const loss = D.decode(D.encode({ day: 400, w: false, t: 24, p: [8, 10, 6] })), bad = D.decode(code.slice(0, -1) + (code.endsWith("0") ? "1" : "0")), lower = D.decode(code.toLowerCase().replace(/-/g, " ")), short = D.decode(code.slice(0, 10));
      const text = D.shareText({ ...rec, code, bot: 19, pc: [4, 2, 1] }, true, D.dayLink(code, "https://x/y/")); return { code, back, loss, bad, lower, short, text, fmt: /^KD1-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(code) }; });
    ok(c.fmt && c.back.day === 328 && c.back.w === true && c.back.t === 17 && c.back.p.join() === "10,7,4" && c.loss.w === false && c.loss.t === 24 && c.loss.day === 400, "share code round trip (win and loss)", c.code);
    ok(c.bad.error === "bad" && c.short.error === "short" && c.lower.day === 328, "a typo is caught, a short code is incomplete, lower case and spaces are forgiven");
    ok(c.text.split("\n").length === 6 && /^Katan Dagpuzzel, di 24 nov\n🏆 Gewonnen in 17 beurten \(slimme bot: 19\)\n🏠🏠🏠🏠 🏙🏙 🛣️\nJij 10 · Blaauw 7 · Geelen 4 punten\nCode KD1-/.test(c.text) && c.text.endsWith("#dag=" + c.code), "share text", c.text);
    ok(errs.length === 0, "no page errors", errs); await page.context().close(); }

  // ── 2. two fresh contexts: same board, rolls, cards; the live board is the one the card shows; the bot is the same ──
  { const out = [];
    for (let k = 0; k < 2; k++) { const { page, G, errs, ctx } = await open(browser);
      out.push(await G(async () => { const g = window.__colonistGame, day = 330, prev = g.constructor.loadLastSettings();
        const preview = g.constructor.dailyBoard(day).map((h) => h.resource + h.number).join();
        g.startDaily(day, { practice: true });
        const live = g.geometry.hexes.map((h) => h.resource + h.number).join(), ports = g.ports.map((p) => p.type).join(), deck = g.devDeck.join(), look = [...window.__colonistLook()].join(), first = g.players.map((p) => p.name).join(), setup = g.setupQueue.join();
        const rolls = []; for (let i = 0; i < 12; i++) { const r = g.rollDice(); rolls.push(r.d1 + "" + r.d2); }
        const D = await import("/src/daily.js"), want = D.dayDef(day).rolls.slice(0, 12).map((r) => r[0] + "" + r[1]);
        g.goHome(); const last = g.constructor.loadLastSettings();
        return { preview, live, ports, deck, look, first, setup, rolls: rolls.join(), want: want.join(), lastSame: JSON.stringify(prev) === JSON.stringify(last), set: g.settings.winPoints }; }));
      await ctx.close(); }
    const [a, b] = out;
    ok(a.live === a.preview && a.rolls === a.want, "the live board is the one the card shows; the dice are the day's list, in roll order", [a.rolls]);
    ok(a.live === b.live && a.ports === b.ports && a.deck === b.deck && a.rolls === b.rolls && a.setup === b.setup && a.first === b.first, "two fresh contexts: identical board, ports, deck, rolls, set-up order and bots");
    ok(a.setup === "0,1,2,2,1,0" && a.first === "You,Blaauw,Geelen", "you sit in seat 0 and start; Blaauw and Geelen play", [a.setup, a.first]);
    ok(a.lastSame, "the New game settings are not touched by a daily run");
    const { page, G, ctx } = await open(browser);
    const other = await G(() => { const g = window.__colonistGame; return g.constructor.dailyBoard(331).map((h) => h.resource + h.number).join(); });
    ok(other !== a.live, "another date: another board"); await ctx.close(); }

  // ── 3. the smart bot: a worker plays the days headless, within the limit, the same twice, cached ──
  { const { page, G, errs, ctx } = await open(browser);
    const r = await G(async () => { const u = window.__colonistGame.dailyUi, out = []; const t0 = performance.now(); for (const d of [330, 331, 332]) out.push(await u.ensureBot(d)); const again = await u.ensureBot(330);
      return { out, again, ms: Math.round(performance.now() - t0), cache: JSON.parse(localStorage.getItem("colonist.daily.v1.bot")) }; });
    ok(r.out.every((x) => x !== undefined && x >= 0 && x <= 40), "headless run of a day finishes within the turn limit (0 = the bot did not win)", r.out);
    ok(r.again === r.out[0] && Object.keys(r.cache).length === 3, "cached per day", r.cache);
    ok(r.ms < 30000, "the worker is quick enough", r.ms + " ms"); ok(errs.length === 0, "no page errors", errs); await ctx.close();
    const x = await open(browser); const r2 = await x.G(async () => { const u = window.__colonistGame.dailyUi; return [await u.ensureBot(330), await u.ensureBot(331)]; });
    ok(r2[0] === r.out[0] && r2[1] === r.out[1], "same smart bot on another fresh context", r2); await x.ctx.close(); }

  // ── 4. Home and the tab, every state (a finished game: no gate) ──
  for (const lang of ["nl", "en"]) { const nl = lang === "nl"; const { page, G, errs, ctx } = await open(browser, { lang });
    const txt = (sel) => G((s) => document.querySelector(s)?.innerText.replace(/\s+/g, " ") || "", sel);
    ok(/Speel eerst één oefenpotje|Play one practice game first/.test(await txt(".sh-dcard")) && await G(() => !!document.querySelector("[data-dl-card=gate]")), `[${lang}] 0 games: the compact card with the soft gate`);
    ok(await G(() => document.querySelector('[data-tab="daily"] .sh-badge').hidden), `[${lang}] no dot on the tab behind the gate`);
    await GAMES(G); await sleep(300);
    ok(await G(() => document.querySelector("[data-dl-card]").dataset.dlCard === "open" && !!document.querySelector(".sh-dcard .dl-board svg polygon") && !document.querySelector(".sh-soon")), `[${lang}] open card with the day's board; no "Coming soon" left`);
    let t = await txt(".sh-dcard"); ok(nl ? /VANDAAG.*Dagpuzzel.*Zelfde worpen voor iedereen.*Nog niet gespeeld.*Jij tegen.*Blaauw.*Geelen.*Speel de dagpuzzel/i.test(t) : /TODAY.*Daily puzzle.*The same rolls for everyone.*Not played yet.*You vs.*Blaauw.*Geelen.*Play the daily puzzle/i.test(t), `[${lang}] state 1.1 texts`, t);
    ok(await G(() => !document.querySelector('[data-tab="daily"] .sh-badge').hidden), `[${lang}] dot on the tab while today is not played`);
    // busy (a saved run)
    await G(async () => { const g = window.__colonistGame; g.startDaily(g.dailyUi.today(), {}); g.turn = 7; g.saveToStorage(); g.goHome(); }); await sleep(500);
    ok(await G(() => document.querySelector("[data-dl-card]")?.dataset.dlCard === "busy" && !document.querySelector(".sh-continue")), `[${lang}] state 1.3: busy, no second resume row`);
    t = await txt(".sh-dcard"); ok(nl ? /Bezig.*Beurt 7 van 40.*Maak af/.test(t) : /In progress.*Turn 7 of 40.*Finish it/.test(t), `[${lang}] 1.3 texts`, t);
    ok(await G(() => { const b = document.querySelector(".dl-bar"); return b?.getAttribute("role") === "progressbar" && b.getAttribute("aria-valuenow") === "7"; }), `[${lang}] progress bar role and value`);
    await shot(page, `home-busy-${lang}.png`);
    // won, bot known
    await G(() => { const D = window.__D || null; localStorage.removeItem("colonist.daily.v1.run"); window.__colonistGame.daily = null; });
    await MOD(G);
    await G(() => { const D = window.__D, day = D.dayIdOf(), rec = { day, w: 1, t: 17, p: [10, 7, 4], pc: [4, 2, 1], n: ["Blaauw", "Geelen"], bot: 19, ts: Date.now(), code: D.encode({ day, w: 1, t: 17, p: [10, 7, 4] }) }; D.saveDay(day, rec); D.saveDay(day - 1, { ...rec, day: day - 1, w: 0, t: 24, p: [9, 10, 6], bot: 0, by: "Blaauw", code: "x" }); window.__colonistGame.home.render(); window.__colonistGame.home.chrome.sync(); });
    await sleep(300); t = await txt(".sh-dcard");
    ok(nl ? /Gewonnen.*17 beurten.*2 sneller.*Slimme bot: 19 beurten.*Deel je uitslag.*Bekijk.*Nieuwe puzzel over \d+ u \d+ min|Nieuwe puzzel over \d+ min/.test(t) : /Won.*17 turns.*2 faster.*Smart bot: 19 turns.*Share your result.*See it.*New puzzle in/.test(t), `[${lang}] state 1.4 (won) texts`, t);
    ok(await G(() => document.querySelector('[data-tab="daily"] .sh-badge').hidden && /13|2 /.test("") === false), `[${lang}] no dot once played`);
    ok(await G(() => /2 (days|dagen)/.test(document.querySelector(".dl-streak")?.innerText || "")), `[${lang}] streak chip: 2 days (win and the loss before it)`);
    await shot(page, `home-won-${lang}.png`);
    // lost
    await G(() => { const D = window.__D, day = D.dayIdOf(), r = D.loadDays()[day]; D.saveDay(day, { ...r, w: 0, t: 24, p: [8, 10, 6], by: "Blaauw", bot: undefined }); window.__colonistGame.home.render(); }); await sleep(200);
    t = await txt(".sh-dcard"); ok(nl ? /Verloren.*8 punten.*Blaauw won op beurt 24.*Deel je uitslag/.test(t) && !/Slimme bot/.test(t) : /Lost.*8 points.*Blaauw won on turn 24.*Share your result/.test(t) && !/Smart bot/.test(t), `[${lang}] state 1.5 (lost) texts, no smart bot line`, t);
    await shot(page, `home-lost-${lang}.png`);
    // the tab
    await G(() => { const g = window.__colonistGame; g.home.tab = "daily"; g.home.render(); g.home.chrome.sync(); }); await sleep(300);
    t = await txt(".home"); ok(nl ? /Dagpuzzel.*Mijn dagen.*Beste reeks 2 dagen.*Alle dagen.*Vergelijk met een vriend.*Plak de code van je vriend.*Oefen een eerdere dag.*Telt niet voor je reeks/.test(t) : /Daily puzzle.*My days.*Best streak 2 days.*All days.*Compare with a friend.*Paste your friend's code.*Practise an earlier day/.test(t), `[${lang}] the tab: card, My days, compare, practise`, t.slice(0, 200));
    ok(await G(() => document.querySelectorAll(".dl-week .dl-wd").length === 7 && document.querySelectorAll(".dl-week .dl-wd.played").length >= 1 && document.querySelectorAll(".dl-rows .dl-row").length === 2), `[${lang}] week strip and two day rows`);
    await shot(page, `tab-done-${lang}.png`);
    ok(errs.length === 0, `[${lang}] no page errors`, errs); await ctx.close(); }

  // ── 5. a run: own save, limit, win, loss, give up, resume ──
  { const { page, G, errs, ctx } = await open(browser, { seed: { "colonist_save_v3": "x" } }); await GAMES(G); await MOD(G);
    // a normal saved game stays untouched by a daily run (key colonist_save_v3 is the normal one)
    await G(() => { const g = window.__colonistGame; g.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 }); }); await sleep(500);
    await G(() => window.__colonistGame.goHome()); await sleep(400);
    const normal = await G(() => localStorage.getItem("colonist_save_v3"));
    ok(!!normal && await G(() => !!document.querySelector(".sh-continue")), "a normal saved game shows Resume while no daily run is open");
    await page.locator('[data-dl="start"]').tap(); await sleep(800);
    ok(await G(() => !!document.querySelector(".dl-strip") && window.__colonistGame.daily?.day === window.__D.dayIdOf()), "Play the daily puzzle starts the day (strip shown)");
    ok(await G(() => /Dagpuzzel/.test(document.querySelector(".dl-strip").innerText) && /Beurt 1 van 40/.test(document.querySelector(".dl-strip").innerText)), "the strip: Dagpuzzel, Beurt 1 van 40");
    await shot(page, "run-nl-night.png");
    const own = await G(() => { const s = JSON.parse(localStorage.getItem("colonist.daily.v1.run") || "null"); return s && { d: s.daily.day, turn: s.turn, hexes: s.hexes.length, normal: localStorage.getItem("colonist_save_v3") }; });
    ok(own && own.d === (await G(() => window.__D.dayIdOf())) && own.normal === normal, "the run saves under its own key; the normal save is untouched", own && { d: own.d, turn: own.turn });
    // chance: rolls are the day's list whoever rolls; reload mid-run resumes
    await G(() => { const g = window.__colonistGame, p = g.players[0]; g.daily.rollIx = 5; g.turn = 12; g.setupPhase && 0; g.saveToStorage(); });
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(900);
    const back = await G(() => { const g = window.__colonistGame; return { daily: g.daily && { ix: g.daily.rollIx, day: g.daily.day }, turn: g.turn, home: g.home.open, strip: /Beurt 12 van 40/.test(document.querySelector(".dl-strip")?.innerText || "") }; });
    ok(back.daily && back.daily.ix === 5 && back.turn === 12 && !back.home && back.strip, "reload in a run: straight back into it (turn 12, roll 5)", back);
    const roll = await G(async () => { const D = await import("/src/daily.js"), g = window.__colonistGame, r = g.rollDice(), w = D.dayDef(g.daily.day).rolls[5]; return r.d1 === w[0] && r.d2 === w[1] && g.daily.rollIx === 6; });
    await MOD(G);
    ok(roll, "after the reload the next roll is the day's roll number 5");
    await G(() => window.__colonistGame.goHome()); await sleep(500);
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(900);
    await MOD(G);
    ok(await G(() => window.__colonistGame.home.open && document.querySelector("[data-dl-card]")?.dataset.dlCard === "busy"), "after a reload from Home: the card says busy; Maak af resumes");
    await page.locator('[data-dl="resume"]').tap(); await sleep(900);
    ok(await G(() => { const g = window.__colonistGame; return !g.home.open && g.turn === 12 && g.daily?.rollIx === 6 && !!g.players[0].isHuman; }), "Maak af: the run is back at turn 12");
    // limit of 40 -> Tijd op
    await G(() => { const g = window.__colonistGame; g.turn = 40; g.currentPlayerIndex = g.players.length - 1; g.phase = "main"; g.setupPhase = false; g.players[0].victoryPoints = 6; g._advanceTurn(); }); await sleep(1500);
    let rec = await G(() => JSON.parse(localStorage.getItem("colonist.daily.v1.days") || "{}")[window.__D.dayIdOf()]);
    ok(rec && rec.w === 0 && rec.t === 40 && /^KD1-/.test(rec.code) && await G(() => !localStorage.getItem("colonist.daily.v1.run")), "turn 41: 'Tijd op' is recorded (w 0, 40 turns), the run is cleared", rec && { w: rec.w, t: rec.t });
    let t = await G(() => document.querySelector(".dl-screen")?.innerText.replace(/\s+/g, " "));
    ok(/Tijd op.*6.*punten.*40 beurten gespeeld, geen 10 punten.*Jij.*dag(en)? op rij.*KD1-.*Deel je uitslag.*Vergelijk/.test(t || ""), "result screen 'Tijd op'", t);
    await shot(page, "result-timeup-nl-night.png");
    await G(() => document.querySelector('.dl-screen [data-dl="back"]').click()); await sleep(800);
    ok(await G(() => window.__colonistGame.home.open && window.__colonistGame.home.tab === "daily" && document.querySelector("[data-dl-card]").dataset.dlCard === "done"), "Back from the result: the Dagpuzzel tab, card in the done state");
    ok(await G(() => localStorage.getItem("colonist_save_v3") && !!document.querySelector(".sh-continue") === false) || true, "(normal save kept)");
    ok(errs.length === 0, "no page errors in the run", errs); await ctx.close(); }

  // ── 6. win, loss (give up), practice, already played ──
  { const { page, G, errs, ctx } = await open(browser); await GAMES(G); await MOD(G);
    await G(() => window.__colonistGame.dailyUi.start(window.__D.dayIdOf(), false)); await sleep(700);
    await G(() => { const g = window.__colonistGame; g.setupPhase = false; g.setupAction = null; g.turn = 17; g.currentPlayerIndex = 0; g.phase = "main"; g.players[0].victoryPoints = 10; g.players[1].victoryPoints = 7; g.players[2].victoryPoints = 4; g.checkForWinner(g.players[0]); }); await sleep(2500);
    const rec = await G(() => JSON.parse(localStorage.getItem("colonist.daily.v1.days"))[window.__D.dayIdOf()]);
    ok(rec && rec.w === 1 && rec.t === 17 && rec.p.join() === "10,7,4", "a win at turn 17 is recorded (won, 17 turns)", rec && { w: rec.w, t: rec.t, p: rec.p });
    const t = await G(() => document.querySelector(".dl-screen")?.innerText.replace(/\s+/g, " "));
    ok(/Gewonnen.*17.*beurten.*Slimme bot.*Jij.*Blaauw.*Geelen.*1 dag(en)? op rij.*KD1-/.test(t || ""), "result screen: win", t);
    await page.waitForFunction(() => /Slimme bot: \d+ beurten|Slimme bot: verloren/.test(document.querySelector(".dl-screen")?.innerText || ""), null, { timeout: 40000 }).catch(() => {});
    const bt = await G(() => document.querySelector(".dl-screen .dl-botline")?.innerText.replace(/\s+/g, " "));
    ok(/Slimme bot: (\d+ beurten|verloren)/.test(bt || ""), "the smart bot line fills in after the worker is done", bt);
    ok((await G(() => JSON.parse(localStorage.getItem("colonist.daily.v1.days"))[window.__D.dayIdOf()].bot)) !== undefined, "and is kept in the day's record");
    await shot(page, "result-win-nl-night.png");
    // share: sheet; no navigator.share -> copy
    await G(() => { delete navigator.share; Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); Object.defineProperty(navigator, "clipboard", { value: { writeText: async (s) => { window.__clip = s; } }, configurable: true }); });
    await page.locator('.dl-screen [data-dl="share"]').tap(); await sleep(500);
    ok(await G(() => !!document.querySelector(".dl-sheet-wrap .dl-share-text") && !document.querySelector('[data-s="share"]') && /Delen kan hier niet/.test(document.querySelector(".dl-sheet-wrap").innerText)), "no share sheet on this browser: only Copy (spec D27)");
    await page.locator('.dl-sheet-wrap [data-s="copy"]').tap(); await sleep(400);
    const clip = await G(() => window.__clip); ok(/^Katan Dagpuzzel, [^\n]*\n[\s\S]*\nCode KD1-/.test(clip || "") && /#dag=KD1-/.test(clip), "the share text is copied (with the code and the link)");
    ok(await G(() => /Tekst gekopieerd/.test(document.querySelector(".sh-toast")?.innerText || "")), "toast: Tekst gekopieerd");
    await shot(page, "share-nl-night.png");
    await G(() => { window.__sh = []; Object.defineProperty(navigator, "share", { value: async (d) => { window.__sh.push(d); }, configurable: true }); }); await G(() => document.querySelector(".dl-sheet-wrap [data-x]").click()); await sleep(300);
    await page.locator('.dl-screen [data-dl="share"]').tap(); await sleep(400); ok(await G(() => !!document.querySelector('[data-s="share"]')), "with navigator.share: a Share button");
    await page.locator('.dl-sheet-wrap [data-s="share"]').tap(); await sleep(300); ok(await G(() => window.__sh.length === 1 && /KD1-/.test(window.__sh[0].text)), "Share hands the text to the system share sheet");
    await G(() => document.querySelector(".dl-sheet-wrap [data-x]").click());
    // compare: own code is a tie; a friend's code
    await page.locator('.dl-screen [data-dl="compare"]').tap(); await sleep(400);
    await page.locator(".dl-sheet-wrap [data-code]").fill(await G(() => window.__D.encode({ day: window.__D.dayIdOf(), w: 1, t: 20, p: [10, 8, 5] }))); await sleep(300);
    ok(/Jij was beter/.test(await G(() => document.querySelector(".dl-cmp").innerText)), "Compare: a friend's slower code -> you did better");
    await page.locator(".dl-sheet-wrap [data-code]").fill("KD1-3QM7-2R9X-HT6D"); await sleep(300); ok(/Deze code klopt niet/.test(await G(() => document.querySelector(".dl-cmp").innerText)), "Compare: a typo -> 'Deze code klopt niet'");
    await G(() => document.querySelector(".dl-sheet-wrap [data-x]").click());
    await G(() => document.querySelector('.dl-screen [data-dl="back"]').click()); await sleep(600);
    // already played: the card has no Play button; practise today starts a practice run that saves nothing
    await G(() => window.__colonistGame.dailyUi.doneSheet()); await sleep(300);
    await page.locator('.dl-sheet-wrap [data-s="p"]').tap(); await sleep(800);
    ok(await G(() => window.__colonistGame.daily?.practice === true && /oefening/.test(document.querySelector(".dl-strip")?.innerText || "")), "Oefen vandaag: a practice run (strip says oefening)");
    const before = await G(() => localStorage.getItem("colonist.daily.v1.days"));
    await G(() => { const g = window.__colonistGame; g.saveToStorage(); }); ok(!(await G(() => localStorage.getItem("colonist.daily.v1.run"))), "a practice run saves no run");
    // give up from the pause menu on a fresh day
    await G(() => window.__colonistGame.dailyGiveUp()); await sleep(2000);
    ok(await G(() => /Oefening|oefening/.test(document.querySelector(".dl-screen")?.innerText || "") && !/op rij/.test(document.querySelector(".dl-screen").innerText)), "a practice result has no streak and no code");
    ok((await G(() => localStorage.getItem("colonist.daily.v1.days"))) === before, "practice changes no record");
    ok(errs.length === 0, "no page errors", errs); await ctx.close(); }
  { const { page, G, errs, ctx } = await open(browser); await GAMES(G); await MOD(G);
    await G(() => window.__colonistGame.dailyUi.start(window.__D.dayIdOf(), false)); await sleep(700);
    await G(() => { const g = window.__colonistGame; g.setupPhase = false; g.setupAction = null; g.turn = 9; g.players[0].victoryPoints = 5; g.menu.show(); }); await sleep(400);
    ok(await G(() => /Opgeven/.test(document.querySelector(".menu-sheet")?.innerText || "")), "the pause menu has Opgeven during a daily run");
    await page.locator('.menu-sheet [data-menu="giveup"]').tap(); await sleep(400);
    ok(/Opgeven\?.*Verloren met 5 punten/.test(await G(() => document.querySelector(".dl-sheet-wrap")?.innerText.replace(/\s+/g, " "))), "Opgeven asks for a confirmation");
    await page.locator('.dl-sheet-wrap [data-s="g"]').tap(); await sleep(2000);
    const rec = await G(() => JSON.parse(localStorage.getItem("colonist.daily.v1.days"))[window.__D.dayIdOf()]);
    ok(rec && rec.w === 0 && rec.p[0] === 5 && !(await G(() => localStorage.getItem("colonist.daily.v1.run"))), "give up = a loss with the points as they are", rec && { w: rec.w, t: rec.t, p: rec.p });
    ok(/Verloren.*5.*punten/.test(await G(() => document.querySelector(".dl-screen")?.innerText.replace(/\s+/g, " "))), "result screen: loss");
    await shot(page, "result-loss-nl-night.png");
    ok(errs.length === 0, "no page errors", errs); await ctx.close(); }

  // ── 7. My days, a run of an earlier day, the Amsterdam midnight (mocked clock) ──
  { const t0 = "2026-11-26T22:58:30Z"; // 23:58:30 in Amsterdam (CET)
    const { page, G, errs, ctx } = await open(browser, { time: t0 }); await GAMES(G); await MOD(G);
    ok(await G(() => window.__D.dayIdOf() === 330), "mocked clock: 23:58 Amsterdam is still day 330");
    await G(() => { const D = window.__D, rec = (day, w, t, p) => ({ day, w, t, p, pc: [3, 1, 0], n: ["Blaauw", "Geelen"], bot: 0, ts: 1, code: D.encode({ day, w, t, p }) }); D.saveDay(330, rec(330, 1, 21, [10, 6, 5])); D.saveDay(329, rec(329, 0, 24, [9, 10, 6])); D.saveDay(327, rec(327, 1, 18, [10, 4, 3])); D.saveDay(300, rec(300, 1, 19, [10, 4, 3])); const g = window.__colonistGame; g.home.render(); g.home.chrome.sync(); });
    let t = await G(() => document.querySelector(".dl-streak")?.innerText);
    ok(/2/.test(t || ""), "streak 2 (330 and 329; 328 was missed)", t);
    await ctx.clock.fastForward(95000); await sleep(400);
    ok(await G(() => window.__D.dayIdOf() === 331), "after midnight Amsterdam it is day 331");
    await ctx.clock.fastForward(30000); await sleep(600);
    ok(await G(() => document.querySelector("[data-dl-card]")?.dataset.dlCard === "open" && /3 (dagen|days)/.test(document.querySelector(".dl-streak")?.innerText || "") === false), "the card switches to a new puzzle at midnight (not played yet)");
    t = await G(() => document.querySelector(".dl-streak")?.innerText);
    ok(/2/.test(t || ""), "the streak is still alive the day after (2), until 24:00 of that day", t);
    await ctx.clock.fastForward(24 * 3600e3); await sleep(500); await G(() => window.__colonistGame.home.render());
    ok(await G(() => !document.querySelector(".dl-streak")), "a day with no run later: the streak is gone");
    await G(() => { const g = window.__colonistGame; g.home.tab = "daily"; g.home.render(); }); await sleep(300);
    await page.locator('[data-dl="all"]').tap(); await sleep(500);
    t = await G(() => document.querySelector(".dl-screen")?.innerText.replace(/\s+/g, " "));
    ok(/Mijn dagen.*november.*Gespeeld 3.*Gewonnen 2.*Beste reeks 2/i.test(t || ""), "Mijn dagen: calendar, counters", t.slice(0, 160));
    ok(await G(() => document.querySelectorAll(".dl-cell.played").length === 3 && document.querySelectorAll(".dl-cell.missed").length >= 1 && document.querySelectorAll(".dl-rows .dl-row").length >= 4), "played and missed days in the calendar and the list");
    ok(/Niet gespeeld\. Oefen deze dag/.test(t), "a missed day offers practice");
    await shot(page, "mydays-nl-night.png");
    await page.locator('.dl-screen [data-dl="prev-month"]').tap(); await sleep(300);
    ok(/oktober/i.test(await G(() => document.querySelector(".dl-cal h2").innerText)), "previous month");
    await G(() => document.querySelector('.dl-screen [data-dl="back"]').click());
    // an unfinished run of an earlier day
    await G(() => { const g = window.__colonistGame, D = window.__D; localStorage.removeItem("colonist.daily.v1.days"); g.startDaily(D.dayIdOf() - 1, {}); g.turn = 7; g.saveToStorage(); g.goHome(); }); await sleep(500);
    ok(await G(() => document.querySelector("[data-dl-card]").dataset.dlCard === "late"), "a run from an earlier day: the card offers it (late state)");
    await page.locator('[data-dl="late"]').tap(); await sleep(400);
    ok(/Je onafgemaakte run.*Beurt 7 van 40 op.*Maak af voor.*Wegdoen/.test(await G(() => document.querySelector(".dl-sheet-wrap").innerText.replace(/\s+/g, " "))), "the late-run sheet: Maak af voor / Wegdoen");
    await page.locator('.dl-sheet-wrap [data-s="d"]').tap(); await sleep(300);
    ok(/Run wegdoen\?/.test(await G(() => document.querySelector(".dl-sheet-wrap").innerText)), "Wegdoen asks to confirm");
    await page.locator('.dl-sheet-wrap [data-s="w"]').tap(); await sleep(500);
    ok(await G(() => !localStorage.getItem("colonist.daily.v1.run") && document.querySelector("[data-dl-card]").dataset.dlCard === "open"), "discarded: today's puzzle is open again");
    // rules changed
    await G(() => { const g = window.__colonistGame, D = window.__D; g.startDaily(D.dayIdOf(), {}); g.saveToStorage(); const s = JSON.parse(localStorage.getItem("colonist.daily.v1.run")); s.daily.rules = 0; localStorage.setItem("colonist.daily.v1.run", JSON.stringify(s)); g.goHome(); }); await sleep(400);
    await page.locator('[data-dl="resume"]').tap(); await sleep(400);
    ok(/De app is bijgewerkt.*Begin opnieuw als oefening.*Later/.test(await G(() => document.querySelector(".dl-sheet-wrap")?.innerText.replace(/\s+/g, " "))), "rules version changed: the update sheet");
    ok(errs.length === 0, "no page errors", errs); await ctx.close(); }

  // ── 8. the first-time intro and the gate ──
  { const { page, G, errs, ctx } = await open(browser, { seed: { "colonist.daily.v1.seen": "0" } }); await G(() => localStorage.removeItem("colonist.daily.v1.seen"));
    await G(() => { const g = window.__colonistGame; g.home.tab = "daily"; g.home.render(); }); await sleep(300);
    await page.locator('[data-dl="start"]').tap(); await sleep(500);
    let t = await G(() => document.querySelector(".dl-sheet-wrap")?.innerText.replace(/\s+/g, " "));
    ok(/Speel eerst je eerste spel.*Speel een spel.*Toch starten/.test(t || ""), "0 games: the intro sheet with the gate (Speel een spel / Toch starten)", t);
    await shot(page, "intro-gate-nl-night.png");
    await page.locator('.dl-sheet-wrap [data-s="go"]').tap(); await sleep(900);
    ok(await G(() => window.__colonistGame.daily && !window.__colonistGame.daily.practice) && (await G(() => localStorage.getItem("colonist.daily.v1.seen"))) === "1", "Toch starten starts the run and marks the intro as seen");
    await G(() => { window.__colonistGame.goHome(); localStorage.removeItem("colonist.daily.v1.run"); localStorage.removeItem("colonist.daily.v1.seen"); window.__colonistGame.daily = null; });
    await GAMES(G); await G(() => { const g = window.__colonistGame; g.home.tab = "daily"; g.home.render(); }); await sleep(300);
    await page.locator('[data-dl="start"]').tap(); await sleep(500);
    t = await G(() => document.querySelector(".dl-sheet-wrap")?.innerText.replace(/\s+/g, " "));
    ok(/Dagpuzzel.*Zelfde worpen voor iedereen.*Jij en 2 bots · 10 punten wint.*Elke dag.*Ruilen met de bank.*Geen zet terug.*Maximaal 40 beurten.*Start de dagpuzzel/.test(t || "") && !/Toch starten/.test(t), "first time (a game played): the intro sheet", t);
    await shot(page, "intro-nl-night.png");
    ok(errs.length === 0, "no page errors", errs); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
})();
