// v1.99.3 characters: node tests/char1993.js PORT [SHOTS=dir]   (server: node tests/serve.mjs ROOT PORT)
// Pick your character (Settings > You > Change), pick an opponent (New game sheet), start: the strip, the board pieces, the hand and the
// player data use the characters and their colours; a reload mid-game keeps them; an old save (no look) loads with the default characters;
// a past game saved with its own look shows the right faces (list row + end screen), whatever the current look is.
const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const port = +process.argv[2] || 9196, SHOTS = process.env.SHOTS || process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`, FIX = path.join(__dirname, "fixtures", "post199");
const shot = async (page, f) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, f) }); };

async function run(browser, vw, vh, lang, palette, shots) {
  const tag = `${vw}x${vh} ${lang} ${palette}`;
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: shots ? 2 : 1, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US", colorScheme: palette === "night" ? "dark" : "light" });
  await ctx.addInitScript(([l, p]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist_intro_seen", "1"); localStorage.setItem("colonist_review_auto", "off"); } } catch (_) {} }, [lang, palette === "night" ? "night" : "light"]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  const boot = async () => { await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(500); };
  const G = (f, a) => page.evaluate(f, a);
  await boot();
  const last = () => G(() => JSON.parse(localStorage.getItem("colonist_last_settings") || "null"));

  // 1. Settings > You > Change: the character sheet; Blaauw (blue) for you swaps with whoever has him (Rosa moves to seat 1)
  await G(() => { const g = window.__colonistGame; g.home?.close?.(); g.settingsUI.open("main"); }); await sleep(500);
  await page.locator('[data-go="character"]').tap(); await sleep(400);
  ok(await G(() => document.querySelectorAll(".ch-sheet .ch-opt").length === 6 && document.querySelector(".ch-sheet .ch-opt.on")?.dataset.ch === "0"), `[${tag}] the character sheet shows six characters, Rosa selected`);
  ok(await G(() => document.querySelector(".ch-sheet .ch-name input") !== null), `[${tag}] ... and a name field`);
  await page.locator('.ch-sheet .ch-opt[data-ch="1"]').tap(); await sleep(300);
  ok(await G(() => document.querySelector(".ch-sheet .ch-opt.on")?.dataset.ch === "1"), `[${tag}] Blaauw is selected (orange outline)`);
  await page.locator(".ch-sheet input[data-me]").fill("Tim"); await sleep(100);
  await page.locator(".ch-sheet input[data-me]").blur(); await sleep(100);
  await shot(page, `char-sheet-${vw}-${lang}-${palette}.png`);
  let st = await last(); ok(st && st.look.join() === "1,0,2,3,4,5", `[${tag}] saved look: you Blaauw, Rosa takes his seat`, st?.look);
  ok(await G(() => JSON.parse(localStorage.getItem("colonist_names_v1") || "{}").me === "Tim"), `[${tag}] the name is kept`);
  await page.locator(".ch-sheet [data-close].nm-done").tap(); await sleep(300);
  ok(await G(() => document.querySelector(".sh-profile .avatar")?.dataset.ch === "1" && /Tim/.test(document.querySelector(".sh-profile")?.innerText || "")), `[${tag}] Settings > You shows Blaauw and the name`);
  await G(() => window.__colonistGame.settingsUI.close?.()); await sleep(300);

  // 2. New game sheet: opponents show the table; tap Geelen's seat -> picker; De Wit (not at the table) can be picked, the others are greyed
  await G(() => { const g = window.__colonistGame; g.home?.close?.(); g._showDifficultyModal(); }); await sleep(500);
  const names = () => G(() => [...document.querySelectorAll(".sh-bot .sh-bot-n")].map((x) => x.textContent));
  const ns = await names(); ok(ns.slice(0, 3).join() === "Roodhart,Geelen,Groen" || lang === "nl", `[${tag}] Opponents: Rosa (Roodhart) now sits against you`, ns);
  ok(await G(() => /Blaauw/.test(document.querySelector(".sh-me")?.innerText || "")), `[${tag}] "You play as" shows Blaauw`);
  await page.locator(".sh-bot[data-bot='2']").tap(); await sleep(350);
  const pk = await G(() => ({ n: document.querySelectorAll(".sh-pick .ch-opt").length, used: [...document.querySelectorAll(".sh-pick .ch-opt.used")].map((x) => x.dataset.ch).join(), on: document.querySelector(".sh-pick .ch-opt.on")?.dataset.ch, dis: [...document.querySelectorAll(".sh-pick .ch-opt:disabled")].length }));
  ok(pk.n === 6 && pk.on === "2" && pk.used === "0,1,3" && pk.dis === 3, `[${tag}] the picker greys the characters already at the table`, pk);
  await shot(page, `char-picker-${vw}-${lang}-${palette}.png`);
  await page.locator('.sh-pick .ch-opt[data-ch="4"]').tap(); await sleep(250);
  st = await last(); ok(st.look.join() === "1,0,4,3,2,5", `[${tag}] De Wit takes Geelen's seat; Geelen goes to the bench`, st.look);
  await page.locator('.sh-pick [data-action="pickclose"].btn').tap(); await sleep(250);
  ok(st.numBots === 3 && (await names()).length === 5, `[${tag}] the count and level behaviour is untouched`);
  await page.locator("[data-action=start]").tap(); await sleep(1500);

  // 3. In the game: names, strip, board and hand follow the characters and their colours
  const probe = () => G(() => {
    const g = window.__colonistGame, root = getComputedStyle(document.documentElement), T = g.theme, look = [...window.__colonistLook()];
    const css = (n) => root.getPropertyValue(n).trim().toUpperCase();
    return { look, names: g.players.map((p) => p.name), seatTok: look.map((c, i) => css(`--p${i}`) === css(`--c${c}`)),
      chars: [...document.querySelectorAll(".pstrip .pchip")].map((c) => c.querySelector(".avatar")?.dataset.ch).join(),
      chip: [...document.querySelectorAll(".pstrip .pchip")].map((c) => getComputedStyle(c).getPropertyValue("--pc").trim().toUpperCase() === css(`--c${look[+/pc-(\d)/.exec(c.className)[1]]}`)),
      board: g.players.map((p, i) => g.boardRenderer?.pc(p)?.base?.toUpperCase() === (T.pc[T.__s0.keys[look[i]]]?.base || "").toUpperCase()),
      you: g.players[0].color === T.textColors?.[T.__s0.keys[look[0]]], youTok: css("--p0") };
  });
  let pr = await probe();
  ok(pr.look.join() === "1,0,4,3,2,5" && pr.names.join() === "You,Roodhart,De Wit,Groen", `[${tag}] the game's players are the picked characters`, pr.names);
  ok(pr.seatTok.every(Boolean), `[${tag}] seat colour tokens follow the characters`, pr.seatTok);
  ok(pr.chars === "1,0,4,3" && pr.chip.every(Boolean), `[${tag}] the strip shows the chosen faces in their colours`, pr);
  ok(pr.board.every(Boolean) && pr.you, `[${tag}] board pieces and the hand colour use the character colours`, pr.board);
  ok(pr.youTok.length > 0 && pr.youTok !== "#B81E2E" && pr.youTok !== "#FF4F5E", `[${tag}] you are no longer red (${pr.youTok})`);
  ok(await G(() => document.documentElement.dataset.ivory === "2"), `[${tag}] the ivory marker follows De Wit to seat 2`);
  await shot(page, `char-game-${vw}-${lang}-${palette}.png`);
  // 4. Reload mid-game: the same characters
  await G(() => { const g = window.__colonistGame; g.saveToStorage?.(); }); await sleep(300);
  const savedLook = await G(() => JSON.parse(localStorage.getItem("colonist_save_v3")).settings.look.join());
  ok(savedLook === "1,0,4,3,2,5", `[${tag}] the save carries the look`, savedLook);
  await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(800);
  
  // after a reload the game is simply on screen again (its characters, below); Home > Resume shows the same faces
  pr = await probe();
  ok(pr.look.join() === "1,0,4,3,2,5" && pr.chars === "1,0,4,3" && pr.seatTok.every(Boolean) && pr.board.every(Boolean), `[${tag}] after a reload the game keeps its characters`, pr.look);
  await G(() => window.__colonistGame.goHome()); await sleep(900);
  { const rs = await G(() => ({ open: !!window.__colonistGame.home?.open, ch: [...document.querySelectorAll(".sh-avs .avatar")].map((a) => a.dataset.ch).join() })); ok(rs.ch === "1,0,4,3", `[${tag}] Home > Resume shows the chosen characters`, rs); }
  await shot(page, `char-home-${vw}-${lang}-${palette}.png`);
  await G(() => window.__colonistGame.continueSavedGame()); await sleep(1200);

  // 5. An old save (from before this change: no look anywhere) loads with the default characters, although the next game is set to other ones
  await G(() => { const g = window.__colonistGame; g.startNewGame({ ...JSON.parse(localStorage.getItem("colonist_last_settings")), look: [0, 1, 2, 3, 4, 5], numBots: 3 }); }); await sleep(1500);
  await G(() => { const g = window.__colonistGame; g.saveToStorage?.(); const s = JSON.parse(localStorage.getItem("colonist_save_v3")); delete s.settings.look; localStorage.setItem("colonist_save_v3", JSON.stringify(s)); const l = JSON.parse(localStorage.getItem("colonist_last_settings")); l.look = [1, 0, 4, 3, 2, 5]; localStorage.setItem("colonist_last_settings", JSON.stringify(l)); });
  await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(800);
  await G(() => window.__colonistGame.continueSavedGame()); await sleep(1200);
  pr = await probe();
  ok(pr.look.join() === "0,1,2,3,4,5" && pr.chars === "0,1,2,3" && pr.seatTok.every(Boolean) && pr.board.every(Boolean), `[${tag}] an old save loads with the default characters (red you, Blaauw, Geelen, Groen)`, pr);
  ok(pr.names.join() === "You,Blaauw,Geelen,Groen" || lang === "nl", `[${tag}] ... and its bots are named by them`, pr.names);
  ok(await G(() => document.documentElement.dataset.ivory === undefined), `[${tag}] ... no ivory marker`);

  // 6. A past game saved with its own look: the list row and the end screen show that look (here you are Pimpel (5), Geelen sits in seat 5)
  if (lang === "en" && palette === "light" && vw === 412) {
    const f = JSON.parse(fs.readFileSync(path.join(FIX, fs.readdirSync(FIX).filter((x) => x.endsWith(".json")).sort()[0]), "utf8")), { meta, format, v, calib, ...rec } = f;
    const L = [5, 1, 3, 2, 0, 4]; rec.state.settings = { ...(rec.state.settings || {}), look: L }; meta.look = L; meta.id = "char-test-1";
    await G(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec });
    await G(() => { const g = window.__colonistGame; g.goHome(); }); await sleep(1200);
    const hm = await G(() => ({ ch: document.querySelector(".hm-stats .hm-sav")?.dataset.ch, me: window.__colonistGame.hist.metas.find((m) => m.id === "char-test-1")?.me }));
    ok(hm.ch === String(L[hm.me ?? 0]), `[${tag}] Home's "Last game" face is the character that game was played with (not the current look)`, hm);
    await G((id) => window.__colonistGame.histView(id, "stats"), meta.id); await sleep(1500);
    const end = await G(() => ({ look: window.__colonistLook().join(), faces: [...document.querySelectorAll(".game-over-overlay .avatar[data-ch]")].map((a) => a.dataset.ch) }));
    ok(end.look === "5,1,3,2,0,4" && end.faces.length > 0 && end.faces.every((c) => "5132".includes(c)), `[${tag}] the end screen of that game shows its own faces`, end);
  }
  ok(errs.length === 0, `[${tag}] no page errors`, errs.slice(0, 3));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 412, 923, "en", "light", false);
  await run(browser, 412, 923, "nl", "night", !!SHOTS);
  await run(browser, 360, 780, "en", "light", !!SHOTS);
  await browser.close();
  console.log(fails ? `${fails} FAIL` : "all ok"); process.exit(fails ? 1 : 0);
})();
