// Home quick picks: node tests/home1993.js PORT [SHOTS=dir]  (server: node tests/serve.mjs ROOT PORT)
// each segment (Type, Map, Players) saves at once, the New game sheet shows the same value, Start uses it; Seafarers disables 5/6; Rush + 5 -> 15 s timer; fit at 360 and 412, EN and NL.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 9190, SHOTS = process.env.SHOTS || process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`;
const shot = async (page, f) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, f) }); };

async function run(browser, vw, vh, lang, theme, withResume) {
  const tag = `${vw}x${vh} ${lang} ${theme}`, nl = lang === "nl";
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  await ctx.addInitScript(([l, th]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", th); } } catch (_) {} }, [lang, theme]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(400);
  const G = (f, a) => page.evaluate(f, a);
  const saved = () => G(() => JSON.parse(localStorage.getItem("colonist_last_settings") || "null"));
  const pressed = (k) => G((k) => document.querySelector(`[data-q="${k}"]`)?.getAttribute("aria-checked") === "true", k);
  const tapq = async (k) => { await page.locator(`[data-q="${k}"]`).tap(); await sleep(150); };
  if (withResume) { await G(() => { const g = window.__colonistGame; g.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 }); }); await sleep(600); await G(() => window.__colonistGame.goHome()); await sleep(600); ok(await G(() => !!document.querySelector("[data-home=continue]")), `[${tag}] Resume row present`); }
  ok(await G(() => !!document.querySelector(".hm-quick")), `[${tag}] quick picks shown`);
  // sizes
  const m = await G(() => { const bs = [...document.querySelectorAll(".hm-quick .sh-seg button")]; return { minH: Math.min(...bs.map((b) => b.getBoundingClientRect().height)), over: bs.some((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > innerWidth), page: document.querySelector(".sh-home").scrollHeight > document.querySelector(".sh-home").clientHeight + 1, startBottom: document.querySelector(".hm-start").getBoundingClientRect().bottom, tabTop: document.querySelector(".sh-tabs").getBoundingClientRect().top }; });
  ok(m.minH >= 44 && !m.over, `[${tag}] 44px segments, nothing clipped`, m);
  ok((vh < 900 || !m.page) && m.startBottom <= m.tabTop + 1, `[${tag}] Start visible above the tab bar (no page scroll on the tall phone)`, m);
  await shot(page, `home-${withResume ? "resume-" : ""}${vw}-${lang}-${theme}.png`);
  // each segment: saved, sheet agrees
  const cases = [["mode:rush", "mode", "rush"], ["mode:classic", "mode", "classic"], ["board:seafarers", "board", "seafarers"], ["board:island", "board", "island"], ["players:3", "numBots", 2], ["players:5", "numBots", 4], ["players:6", "numBots", 5], ["players:4", "numBots", 3]];
  for (const [k, f, v] of cases) {
    await tapq(k); const st = await saved();
    ok(st?.[f] === v && await pressed(k), `[${tag}] ${k} saved and shown pressed`, st?.[f]);
  }
  await tapq("players:5"); await tapq("mode:rush");
  const big = await saved(); ok(big.numBots === 4 && big.mode === "rush" && big.rushInterval === 15, `[${tag}] Rush + 5 players: 15 s timer (bigAdjust)`, big.rushInterval);
  await shot(page, `home-rush5-${vw}-${lang}-${theme}.png`);
  await tapq("players:4"); const back = await saved(); ok(back.rushInterval === 8, `[${tag}] back to 4 players: 8 s again`, back.rushInterval);
  await tapq("mode:classic");
  await tapq("players:6");
  ok(await G(() => document.querySelector('[data-q="board:seafarers"]').disabled && /Needs 3–4 players|Voor 3–4 spelers/.test(document.querySelector('[data-q="board:seafarers"]').textContent)), `[${tag}] Seafarers disabled at 6 players, with the reason on the card`);
  await tapq("players:4"); await tapq("board:seafarers");
  const sea = await saved(); ok(sea.board === "seafarers" && sea.numBots === 3, `[${tag}] Seafarers with 4 players`, sea.numBots);
  ok(await G(() => ["players:5", "players:6"].every((k) => document.querySelector(`[data-q="${k}"]`).disabled)) && await pressed("players:4") && await pressed("board:seafarers"), `[${tag}] 5 and 6 disabled while Seafarers is on`);
  await shot(page, `home-sea-${vw}-${lang}-${theme}.png`);
  await tapq("board:island"); ok((await saved()).board === "island", `[${tag}] back to Island`);
  // stats card: empty state, then seeded games
  const statTxt = () => G(() => document.querySelector(".hm-stats")?.innerText.replace(/\s+/g, " ") || "");
  const empty = await statTxt();
  ok(await G(() => !!document.querySelector(".hm-stats.empty")) && (nl ? /Speel je eerste spel/ : /Play your first game/).test(empty) && !/\b0\b/.test(empty), `[${tag}] 0 games: friendly empty state, no zeros`, empty);
  await shot(page, `home-empty-${vw}-${lang}-${theme}.png`);
  await G(async () => { const g = window.__colonistGame, H = g.hist; await H.open(); const now = Date.now(), D = 864e5;
    const mk = (i, res, ago, vp, bvp, acc) => ({ id: "seed" + i, v: 1, start: now - ago * D - 3e6, end: now - ago * D, mode: "classic", board: "island", n: 4, pts: 10, hot: false, me: 0, winner: res === "won" ? 0 : 1, result: res, turns: 40, ms: 3e6, star: false, rec: false, acc: acc ?? null,
      seats: [{ name: "You", vp, you: true }, { name: "A", vp: bvp, prof: "intermediate" }, { name: "B", vp: 4, prof: "intermediate" }, { name: "C", vp: 3, prof: "intermediate" }] });
    const rows = [mk(1, "lost", 9, 6, 10), mk(2, "won", 6, 10, 7, 71), mk(3, "won", 4, 10, 8, 84), mk(4, "won", 2, 10, 7)]; // newest last pushed first below
    for (const m of rows) { try { await H.put(m, {}); } catch (_) { H.metas.push(m); } }
    H._sort(); g.home.render(); });
  await sleep(300);
  const st = await G(() => { const m = window.__colonistGame.hist.metas.filter((x) => x.id.startsWith("seed")); const wins = m.filter((x) => x.result === "won").length; return { n: m.length, wins, txt: document.querySelector(".hm-stats")?.innerText.replace(/\s+/g, " ") || "", ring: document.querySelector(".hm-ring text")?.textContent }; });
  ok(st.n === 4 && st.ring === "75%", `[${tag}] stats card: 3 of 4 won = 75%`, st);
  ok(nl ? /4\s*Gespeeld/.test(st.txt) && /3\s*Gewonnen/.test(st.txt) && /3\s*Winreeks/.test(st.txt) && /Laatste spel Gewonnen 10–7 tegen Gemiddeld · 2 dagen geleden/.test(st.txt) && /Beste precisie 84/.test(st.txt) : /4\s*Played/.test(st.txt) && /3\s*Won/.test(st.txt) && /3\s*Win streak/.test(st.txt) && /Last game Won 10–7 vs Medium · 2 days ago/.test(st.txt) && /Best accuracy 84/.test(st.txt), `[${tag}] stats from stored games: played, won, streak, last game, best accuracy`, st.txt);
  ok(await G(() => document.querySelectorAll(".hm-dots i").length === 4 && document.querySelectorAll(".hm-dots i.w").length === 3), `[${tag}] result dots`);
  await shot(page, `home-stats-${vw}-${lang}-${theme}.png`);
  await page.locator(".hm-stats").tap(); await sleep(700);
  ok(await G(() => document.querySelector(".sh-tab.on")?.dataset.tab === "review" || !!document.querySelector(".hs, .hist, [data-hist]")), `[${tag}] tapping the card opens the Review tab`);
  await G(() => { const g = window.__colonistGame; g.chrome?.go?.("play"); g.home.chrome?.go("play"); }); await sleep(500);
  // sheet agrees, and a change in the sheet shows on Home
  await tapq("mode:rush"); await tapq("players:5"); await tapq("board:island");
  await page.locator("[data-home=adjust]").tap(); await sleep(450);
  const sh = await G(() => ({ rush: document.querySelector(".sh-tile[data-mode=rush]")?.getAttribute("aria-pressed"), bots: document.querySelectorAll(".sh-bot.on").length, island: document.querySelector("[data-board=island]")?.getAttribute("aria-checked") }));
  ok(sh.rush === "true" && sh.bots === 4 && sh.island === "true", `[${tag}] the sheet shows Rush, 4 bots (5 players), Island`, sh);
  await shot(page, `sheet-${vw}-${lang}-${theme}.png`);
  const sm = await G(() => { const c = [...document.querySelectorAll(".sh-sheet .hm-map")]; return { n: c.length, on: c.filter((x) => x.getAttribute("aria-checked") === "true").map((x) => x.dataset.board), th: c.every((x) => x.querySelector("svg")) }; });
  ok(sm.n === 5 && sm.on.join() === "island" && sm.th, `[${tag}] the sheet's Map section uses the same thumbnail cards`, sm);
  ok(await G(() => document.querySelector(".sh-sheet [data-board=seafarers]").disabled), `[${tag}] the sheet disables Seafarers at 5 players too`);
  await page.locator(".sh-bot[data-bot='4']").tap(); await sleep(200);
  await page.locator(".sh-sheet [data-board=seafarers]").tap(); await sleep(250);
  ok((await saved()).board === "seafarers" && await G(() => document.querySelector(".sh-sheet [data-board=seafarers]").getAttribute("aria-checked") === "true"), `[${tag}] a map card in the sheet saves and shows pressed`);
  await page.locator(".sh-sheet [data-board=island]").tap(); await sleep(250); await page.keyboard.press("Escape"); await sleep(500);
  ok(await pressed("players:4"), `[${tag}] a change in the sheet shows on Home (4 players)`);
  // Start uses it
  await tapq("mode:classic"); await tapq("players:3");
  await page.locator(".hm-start").tap(); await sleep(1500);
  const g = await G(() => ({ n: window.__colonistGame.players.length, mode: window.__colonistGame.settings.mode }));
  ok(g.n === 3 && g.mode === "classic", `[${tag}] Start used 3 players, Classic`, g);
  ok(errs.length === 0, `[${tag}] no page errors`, errs.join(" | "));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await run(browser, 412, 923, "en", "light", true);
  await run(browser, 412, 923, "nl", "night", true);
  await run(browser, 360, 780, "nl", "light", true);
  await run(browser, 412, 923, "en", "night", true);
  await browser.close();
  console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
