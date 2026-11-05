// Audit tour of every post-game screen. node audit.js <root> <port> <shotDir> <light|night>
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const { serve, sleep } = require("./tlib");
const ROOT = path.resolve(process.argv[2]), PORT = Number(process.argv[3]), SHOTS = process.argv[4], PAL = process.argv[5] || "light";
fs.mkdirSync(SHOTS, { recursive: true });
const log = [];
const say = (...a) => { console.log(...a); log.push(a.join(" ")); };
(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => say("PAGEERR", e.message));
  await page.addInitScript((pal) => {
    if (sessionStorage.getItem("__init")) return;
    sessionStorage.setItem("__init", "1");
    localStorage.clear();
    localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_sound", "off");
    localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", pal); localStorage.setItem("colonist.botSpeed", "100");
  }, PAL);
  const G = (fn, arg) => page.evaluate(fn, arg);
  let n = 0;
  const shot = async (name, wait = 350) => { await sleep(wait); const f = path.join(SHOTS, `audit-${PAL}-${String(++n).padStart(2, "0")}-${name}.png`); await page.screenshot({ path: f }); say("shot", path.basename(f)); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { say("STEP FAIL", name, String(e.message).split("\n")[0]); } };
  const tap = async (sel) => { await page.locator(sel).first().tap(); await sleep(300); };
  const scrollTo = (sel, block = "start") => G(([s, b]) => { const el = document.querySelector(s); el?.scrollIntoView({ block: b }); return !!el; }, [sel, block]);
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  await G(() => { const g = window.__colonistGame; g.startNewGame({ ...g.settings, mode: "classic", numBots: 3, winPoints: 5 }); g.startAutoplay(); });
  await page.waitForFunction(() => window.__colonistGame.winner, null, { timeout: 420000, polling: 300 });
  say("winner", await G(() => window.__colonistGame.winner.name + " turn " + window.__colonistGame.turn));
  await step("count", async () => { await sleep(500); await shot("winning-count", 0); });
  await step("intro", async () => { await page.waitForSelector(".gs-intro", { timeout: 4000 }); await sleep(900); await shot("intro-winlose", 0); });
  await page.waitForSelector(".gs-recap", { timeout: 6000 });
  await sleep(700);
  await shot("end-top-checking", 0);
  say("recap buttons:", JSON.stringify(await G(() => [...document.querySelectorAll(".gs-over button")].map((b) => b.textContent.trim().replace(/\s+/g, " ")))));
  await step("scroll", async () => { await G(() => { const s = document.querySelector(".gs-scroll"); s.scrollTop = 380; }); await shot("end-mid"); });
  for (const t of ["race", "dice", "cards", "maps", "moments"]) await step("tab " + t, async () => {
    await scrollTo(".gs-more", "start"); await tap(`[data-tab="${t}"]`); await sleep(900); await shot("tab-" + t);
    await G(() => { const s = document.querySelector(".gs-scroll"); s.scrollTop += 420; }); await shot("tab-" + t + "-b", 500);
  });
  await G(() => { document.querySelector(".gs-scroll").scrollTop = 0; });
  // Timelapse
  await step("timelapse", async () => { await tap("[data-timelapse]"); await sleep(1200); await shot("timelapse", 0); await sleep(2800); say("after timelapse overlay:", await G(() => !!document.querySelector(".gs-over") && !document.querySelector(".gs-replay"))); });
  // Replay from footer
  await step("replay", async () => { await tap("[data-replay]"); await sleep(1200); await shot("replay-start", 0); await tap(".gs-rp-speed [data-speed='4']"); await sleep(2500); await shot("replay-mid", 0); await tap(".gs-rp-x"); await sleep(500); await shot("after-replay-close"); });
  // Wait for review to progress
  await step("review wait", async () => { for (let i = 0; i < 60; i++) { const s = await G(() => document.querySelector("[data-rvbox]")?.innerText || ""); if (/accuracy|no clear/i.test(s) || i === 59) break; if (i === 3) await shot("end-review-running"); await sleep(2000); } say("rvbox:", JSON.stringify(await G(() => document.querySelector("[data-rvbox]")?.innerText))); });
  await G(() => { document.querySelector(".gs-scroll").scrollTop = 0; });
  await shot("end-top-later", 200);
  await step("missed show", async () => { const c = await page.locator("[data-rvshow]").count(); say("missed rows", c); if (c) { await tap("[data-rvshow]"); await sleep(1200); await shot("missed-show"); await tap("[data-rvback]"); await sleep(600); await shot("after-show-back"); } });
  await step("game review", async () => { const c = await page.locator("[data-rvreview]").count(); say("review button", c); if (c) { await G(() => document.querySelector("[data-rvreview]").scrollIntoView({ block: "center" })); await shot("review-button"); await tap("[data-rvreview]"); await sleep(1500); await shot("review-screen"); await G(() => { document.querySelector(".rv")?.querySelectorAll("*").forEach(() => {}); const s = document.querySelector(".rv .rv-scroll, .rv"); s.scrollTop = 600; }); await shot("review-scrolled"); say("rv buttons", JSON.stringify(await G(() => [...document.querySelectorAll(".rv button")].slice(0, 14).map((b) => b.textContent.trim().replace(/\s+/g, " "))))); await tap("[data-rvclose]"); await sleep(500); } });
  await step("see board", async () => { await G(() => { document.querySelector(".gs-scroll").scrollTop = 0; }); await tap("[data-see]"); await sleep(900); await shot("see-board"); say("board after see:", JSON.stringify(await G(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 25)))); });
  // back to end screen from board: menu
  await step("menu from board", async () => { const m = page.locator("#menuBtn, [data-menu], .menu-btn, button[aria-label='Menu']").first(); say("menu btn", await m.count()); await m.tap(); await sleep(600); await shot("menu-after-game"); say("menu items", JSON.stringify(await G(() => [...document.querySelectorAll("[role=dialog] button, .menu button, #menu button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim().replace(/\s+/g, " ")).slice(0, 25)))); });
  await browser.close(); server.close();
  fs.writeFileSync(path.join(SHOTS, `log-${PAL}.txt`), log.join("\n"));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
