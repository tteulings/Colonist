// Home / tab scroll areas: node tests/scroll1998.js PORT [SHOTS=dir]  (server: node tests/serve.mjs ROOT PORT)
// at 412x923 and 360x780 (touch and classic-scrollbar desktop-ish): the scroller ends above the tab bar, the last card scrolls fully into view,
// no scrollbar on touch layouts, and nothing scrolls under the gear (header is sticky and opaque).
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 9190, SHOTS = process.env.SHOTS || process.argv[3], PREFIX = process.env.PREFIX || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`;

async function run(browser, vw, vh, touch, lang) {
  const tag = `${vw}x${vh} ${touch ? "touch" : "mouse"} ${lang}`;
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  await ctx.addInitScript(([l]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", "night"); } } catch (_) {} }, [lang]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(400);
  const G = (f, a) => page.evaluate(f, a);
  await G(() => window.__colonistGame.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 })); await sleep(600);
  await G(() => window.__colonistGame.goHome()); await sleep(700);
  const shot = async (n) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${PREFIX}${n}-${vw}x${vh}-${touch ? "touch" : "mouse"}.png`) }); };
  const HIT = `(gb) => { const gear = document.querySelector(".sh-gear"); const v = gear.style.visibility; gear.style.visibility = "hidden";
      const out = [[.15, .15], [.85, .15], [.5, .5], [.15, .85], [.85, .85]].map(([x, y]) => document.elementFromPoint(gb.left + gb.width * x, gb.top + gb.height * y)).filter((e) => e && !e.closest(".hm-brand, .sh-title, .hs-bar") && !e.matches(".home, .hs, .hs-scroll, body, html")).map((e) => String(e.className?.baseVal ?? e.className) || e.tagName); gear.style.visibility = v; return out; }`;
  const geo = () => G((HIT) => { const hitTest = eval(HIT);
    const sc = document.querySelector(".home.sh-home"), tabs = document.querySelector(".sh-tabs"), gear = document.querySelector(".sh-gear");
    const cards = [...sc.querySelectorAll(".hm-col > *")].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).position !== "fixed" && !e.matches(".hm-brand"));
    const last = cards[cards.length - 1], gb = gear.getBoundingClientRect(), scr = sc.getBoundingClientRect();
    const cs = getComputedStyle(sc);
    // anything (not the header itself) painted inside the gear's box?
    const hit = hitTest(gb);
    return { scrollable: sc.scrollHeight > sc.clientHeight + 1, top: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight, scBottom: scr.bottom, tabTop: tabs.getBoundingClientRect().top, lastBottom: last?.getBoundingClientRect().bottom, lastCls: last?.className, sbw: sc.offsetWidth - sc.clientWidth, sbCss: cs.scrollbarWidth, pseudo: getComputedStyle(sc, "::-webkit-scrollbar").display, hit: hit.map((e) => e.className || e.tagName), brandOpaque: getComputedStyle(document.querySelector(".hm-brand")).backgroundColor, brandTop: document.querySelector(".hm-brand").getBoundingClientRect().top, gearTop: gb.top };
  }, HIT);
  let g = await geo(); ok(!!g.lastCls, `[${tag}] Home has cards`, g.lastCls);
  if (vh < 900) ok(g.scrollable, `[${tag}] Home scrolls (resume + daily gate + new game + games)`, g);
  await shot("home-top");
  await G(() => { const s = document.querySelector(".home.sh-home"); s.scrollTop = 120; }); await sleep(250); await shot("home-scrolled");
  g = await geo(); ok(g.hit.length === 0, `[${tag}] mid-scroll: nothing but the header under the gear`, g.hit);
  ok(g.brandTop <= 1, `[${tag}] mid-scroll: header stays at the top (sticky)`, g.brandTop);
  await G(() => { const s = document.querySelector(".home.sh-home"); s.scrollTop = s.scrollHeight; }); await sleep(300);
  g = await geo(); await shot("home-bottom");
  ok(g.top >= g.max - 1, `[${tag}] reached the bottom`, g);
  ok(g.scBottom <= g.tabTop + 1, `[${tag}] scroller ends above the tab bar`, [g.scBottom, g.tabTop]);
  ok(g.lastBottom <= g.tabTop - 4, `[${tag}] last card fully above the tab bar`, [g.lastBottom, g.tabTop]);
  ok(g.hit.length === 0, `[${tag}] bottom: nothing but the header under the gear`, g.hit);
  if (touch) ok(g.sbw === 0 && g.sbCss === "none" && g.pseudo === "none", `[${tag}] no scrollbar on the home scroller`, [g.sbw, g.sbCss, g.pseudo]);
  // other tab roots
  for (const tab of ["daily", "review", "bots"]) {
    await page.locator(`.sh-tab[data-tab="${tab}"]`).click(); await sleep(700);
    const r = await G((HIT) => {
      const sc = document.querySelector("body[data-sh-tab] .hs-scroll, .home.sh-home"), cur = document.body.dataset.shTab;
      const list = cur === "daily" ? document.querySelector(".home.sh-home") : (document.querySelector(".hs .hs-scroll") || document.querySelector(".hs"));
      const tabs = document.querySelector(".sh-tabs").getBoundingClientRect(); const lr = list.getBoundingClientRect();
      const gb = document.querySelector(".sh-gear").getBoundingClientRect();
      const scrollers = [...document.querySelectorAll(".home.sh-home, .hs .hs-scroll, .hs")].filter((e) => e.getBoundingClientRect().height > 0);
      return { cur, bottom: lr.bottom, tabTop: tabs.top, sb: scrollers.map((e) => e.offsetWidth - e.clientWidth), hit: eval(HIT)(gb) };
    }, HIT);
    ok(r.cur === tab, `[${tag}] tab ${tab} open`, r.cur);
    ok(r.bottom <= r.tabTop + 1, `[${tag}] ${tab}: scroller ends above the tab bar`, [r.bottom, r.tabTop]);
    if (touch) ok(r.sb.every((w) => w === 0), `[${tag}] ${tab}: no scrollbar`, r.sb);
    ok(r.hit.length === 0, `[${tag}] ${tab}: nothing under the gear but the header`, r.hit);
    await shot(`tab-${tab}`);
  }
  ok(errs.length === 0, `[${tag}] no page errors`, errs.slice(0, 2));
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[412, 923], [360, 780], [412, 700]]) for (const touch of [true, false]) await run(browser, w, h, touch, "en");
  await browser.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
