// v1.99.9 live win chance inside the player strip (no separate bar row).   node tests/live1999.js PORT   (server: node tests/serve.mjs ROOT PORT)
//   env SHOTS=dir writes screenshots (dsf 2); env PROBE=1 only measures + shots (no asserts about the new design)
const { chromium } = require("playwright"); const path = require("path");
const port = +(require.main === module ? process.argv[2] : process.env.PORT) || 9301, SHOTS = process.env.SHOTS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
async function open(b, w, h, { lang = "en", pal = "day", live = "on" } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US", colorScheme: pal === "night" ? "dark" : "light" });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(([l, p, lv]) => { if (sessionStorage.__t) return; sessionStorage.__t = 1; localStorage.clear(); for (const [k, v] of Object.entries({ colonist_sound: "off", colonist_lang: l, "colonist.palette": p, "colonist.paletteAuto": "off", "colonist.intro": "done", "colonist.welcomed": "1", colonist_live_win: lv, colonist_live_refine: "off" })) localStorage.setItem(k, v); }, [lang, pal, live]);
  await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); await sleep(500);
  return { ctx, page, errs, G: (f, a) => page.evaluate(f, a) };
}
// a settled mid-game with n players (bots stand still: it is the human's turn, main phase)
async function start({ G, page }, n, mode = "classic", board = "island") {
  await G(([n, mode, board]) => { const g = window.__colonistGame; g.startNewGame({ mode, board, numBots: n - 1 }); }, [n, mode, board]);
  await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.players?.length; }, null, { timeout: 20000 }); await sleep(800);
  await G(() => { const g = window.__colonistGame; if (g.setupPhase) { g.setupStep = g.setupQueue.length; g.processSetupQueue(); } g.turn = 9; g.currentPlayerIndex = 0; g.phase = "main"; g.pendingAction = null; g.players.forEach((p, i) => { p.victoryPoints = 2 + i; }); g.render?.(); });
  await sleep(400);
}
const metrics = (G) => G(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), hid: e.hidden || getComputedStyle(e).display === "none" }; };
  const strip = document.querySelector("#playerStrip"), chips = [...strip.querySelectorAll(".pchip")];
  const over = chips.filter((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > innerWidth + 0.5 || c.getBoundingClientRect().left < -0.5).length;
  return { board: r("#boardWrap"), bar: r("#liveBar"), strip: r("#playerStrip"), pct: [...document.querySelectorAll(".pchip .lb-pct")].map((e) => e.textContent.trim()), over, docOver: document.documentElement.scrollWidth > innerWidth + 1,
    pctOver: [...document.querySelectorAll(".pchip .lb-pct")].filter((e) => { const a = e.getBoundingClientRect(), c = e.closest(".pchip").getBoundingClientRect(); return a.right > c.right + 0.5 || a.left < c.left - 0.5 || a.bottom > c.bottom + 0.5; }).length }; });
module.exports = { open, start, metrics, ok, sleep };
// before (v1.99.8, main b86d734): the bar row (#liveBar, 15 px) sat under the ticker: board height with the setting on
const BEFORE = { 360: 574, 412: 717 };
const waitPct = (page, n) => page.waitForFunction((n) => document.querySelectorAll(".pstrip .pchip .lb-pct").length === n, n, { timeout: 15000 });
if (require.main === module) (async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[360, 780], [412, 923]]) for (const n of [4, 6]) {
    const tag = `${w}x${h} ${n}p`;
    const A = await open(b, w, h, { lang: w === 360 ? "nl" : "en", pal: w === 360 ? "day" : "night" }); const { G, page } = A;
    await start(A, n); await waitPct(page, n); await sleep(300);
    await G(() => document.querySelector(".chip-hint-x")?.click()); await sleep(200);
    const on = await metrics(G);
    ok(on.pct.length === n && on.pct.every((x) => /^\d{1,3}%$/.test(x)), `${tag}: a win chance number on every player chip`, on.pct);
    ok(!(await G(() => !!document.querySelector("#liveBar, .livebar"))), `${tag}: no separate bar row any more`);
    ok(on.over === 0 && on.pctOver === 0 && !on.docOver, `${tag}: nothing overflows the strip or the page`, { over: on.over, pctOver: on.pctOver });
    ok(on.board.h >= BEFORE[w] + 12, `${tag}: the board is taller than with the old bar (${BEFORE[w]} -> ${on.board.h})`);
    // the numbers are the model's own: a sum of 80% is shown as is (20% each), with the sum said in the tooltip; no 100% claim
    await G(() => { const g = window.__colonistGame; g._lbDraw(g.players.map(() => 0.8 / g.players.length), 0); });
    const odd = await G(() => ({ txt: [...document.querySelectorAll(".pchip .lb-pct")].map((e) => e.textContent), title: document.querySelector(".pchip .lb-pct").title }));
    const each = Math.round(80 / n) + "%";
    ok(odd.txt.every((x) => x === each) && !odd.txt.includes("100%"), `${tag}: a model that sums to 80% is not rescaled`, odd.txt);
    ok(/80%/.test(odd.title), `${tag}: the tooltip says what they add up to`, odd.title);
    await G(() => { const g = window.__colonistGame; g._lbDraw(g.players.map(() => 1 / g.players.length), 0); });
    ok(!/add up|samen/i.test(await G(() => document.querySelector(".pchip .lb-pct").title)), `${tag}: a model that sums to 100% adds no note`);
    // tap a player: the info names the model
    await page.locator(".pstrip .pchip").nth(1).tap(); await sleep(400);
    const tip = await G(() => document.querySelector("#vpTooltip")?.innerText.replace(/\s+/g, " ") || "");
    ok(/\d+%/.test(tip) && (w === 360 ? /snel|gesimuleerd/ : /quick|simulated/).test(tip), `${tag}: the tap-a-player info shows the win chance and the model`, tip.slice(0, 120));
    if (SHOTS && n === 4) await page.screenshot({ path: path.join(SHOTS, `live-${w}x${h}-${w === 360 ? "nl-light" : "en-night"}-4p.png`) });
    await G(() => document.querySelector("#vpTooltip")?.remove());
    // off: no numbers, and the board is exactly as tall (the bar never comes back)
    await G(() => window.dispatchEvent(new Event("noop"))); await G(() => localStorage.setItem("colonist_live_win", "off")); await G(() => window.dispatchEvent(new CustomEvent("livewin-change", { detail: false }))); await G(() => window.__colonistGame.render()); await sleep(400);
    const off = await metrics(G);
    ok(off.pct.length === 0, `${tag}: setting off: no numbers`);
    ok(off.board.h === on.board.h && off.strip.h === on.strip.h, `${tag}: the numbers add no height (board ${on.board.h} on / ${off.board.h} off)`);
    await G(() => localStorage.setItem("colonist_live_win", "on")); await G(() => window.dispatchEvent(new CustomEvent("livewin-change", { detail: true })));
    await waitPct(page, n); ok(true, `${tag}: setting back on: the numbers return`);
    if (SHOTS && n === 6) { await G(() => { const g = window.__colonistGame; g.players.forEach((p) => { p.knightsPlayed = 3; p.longestRoadLength = 5; }); g.render(); }); await sleep(300); await page.screenshot({ path: path.join(SHOTS, `live-${w}x${h}-${w === 360 ? "nl-light" : "en-night"}-6p.png`) }); }
    ok(!A.errs.length, `${tag}: no page errors`, A.errs.slice(0, 2));
    await A.ctx.close();
  }
  // Rush and Seafarers
  for (const [mode, board, n, tag] of [["rush", "island", 4, "rush"], ["rush", "island", 6, "rush 6p"], ["classic", "seafarers", 4, "seafarers"]]) {
    const A = await open(b, 360, 780); await start(A, n, mode, board); await waitPct(A.page, n).catch(() => {}); await sleep(300);
    const m = await metrics(A.G);
    ok(m.pct.length === n && m.over === 0 && m.pctOver === 0 && !m.docOver, `360 ${tag}: numbers on every chip, nothing overflows`, m.pct);
    if (SHOTS) await A.page.screenshot({ path: path.join(SHOTS, `live-360-${tag.replace(" ", "-")}.png`) });
    await A.ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})();
