// v1.99.7 AI Lab entry: node tests/lab1997.js PORT [SHOTS=dir]   (server: node tests/serve.mjs ROOT PORT)   env QUICK=1: one viewport, EN + NL
// Bots tab: the "AI Lab" card is on screen (360x780, 412x923; EN, NL), not clipped (inside the page, above the tab bar, text not cut), opens lab.html,
// Back from the lab returns to the Bots page (index.html#bots); Settings keeps its entry; the review's AI tab links to the lab home.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 8731, SHOTS = process.env.SHOTS || process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`;

async function run(browser, vw, vh, lang, pal) {
  const tag = `${vw}x${vh} ${lang} ${pal}`, nl = lang === "nl";
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: nl ? "nl-NL" : "en-US" });
  await ctx.addInitScript(([l, p]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist.autoDarkToast", "1"); } } catch (e) {} }, [lang, pal]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 25000 }); await sleep(500);
  await page.locator(".sh-tab[data-tab=bots]").tap(); await sleep(700);
  const r = await page.evaluate(() => {
    const c = document.querySelector(".px-bots .bpg-lab"); if (!c) return { missing: true };
    const b = c.getBoundingClientRect(), tb = document.querySelector(".sh-tabs")?.getBoundingClientRect(), t = c.querySelector(".bpg-lab-t"), cut = [...c.querySelectorAll("b, small")].some((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
    const ch = c.querySelector(".rv-chev").getBoundingClientRect();
    return { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height, tabTop: tb ? tb.top : innerHeight, W: innerWidth, cut, chevIn: ch.right <= b.right && ch.left >= b.left, text: c.innerText.replace(/\s+/g, " "), icon: !!c.querySelector(".bpg-lab-ic svg"), href: c.getAttribute("href"), over: document.documentElement.scrollWidth > innerWidth + 1, tapH: b.height };
  });
  ok(!r.missing, `[${tag}] Bots tab: AI Lab card present`); if (r.missing) { await ctx.close(); return; }
  ok(r.l >= 0 && r.r <= r.W && r.t >= 0 && r.b <= r.tabTop && !r.over, `[${tag}] card on screen, above the tab bar, no horizontal overflow`, r);
  ok(!r.cut && r.chevIn && r.icon && r.h >= 44, `[${tag}] card not clipped (text whole, chevron inside, icon, >= 44px)`, { cut: r.cut, h: r.h });
  ok(nl ? /AI Lab/.test(r.text) && /Kijk hoe bots spelen en zie waarom ze een zet kiezen/.test(r.text) && !/Watch bots/.test(r.text) : /AI Lab/.test(r.text) && /Watch bots play and see why they choose a move/.test(r.text), `[${tag}] card text (${nl ? "NL" : "EN"})`, r.text);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `bots-lab-${vw}x${vh}-${lang}-${pal}.png`) }); }
  await page.locator(".px-bots .bpg-lab").tap();
  await page.waitForURL(/lab\.html/, { timeout: 15000 }).catch(() => {}); await sleep(600);
  ok(/\/lab\.html\?from=bots$/.test(page.url()), `[${tag}] card opens lab.html`, page.url());
  const back = await page.evaluate(() => { const a = document.getElementById("labBack"); return a ? { h: a.getAttribute("href"), r: a.getBoundingClientRect().height } : null; });
  ok(back && back.h === "./index.html#bots" && back.r >= 40, `[${tag}] lab Back points at the Bots page`, back);
  await page.locator("#labBack").tap();
  await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 25000 }).catch(() => {}); await sleep(900);
  ok(/index\.html#bots$/.test(page.url()) && await page.evaluate(() => !!window.__colonistGame?._bpgEl && document.querySelector(".sh-tab[aria-current]")?.dataset.tab === "bots"), `[${tag}] Back from the lab: Bots tab open again`, page.url());
  // plain lab (Settings entry, no ?from): Back goes to the game
  await page.goto(`http://localhost:${port}/lab.html`); await sleep(500);
  ok(await page.evaluate(() => document.getElementById("labBack").getAttribute("href") === "./index.html"), `[${tag}] lab without ?from: Back to the game`);
  ok(errs.length === 0, `[${tag}] no page errors`, errs.slice(0, 2));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const sizes = process.env.QUICK ? [[360, 780]] : [[360, 780], [412, 923]];
  for (const [w, h] of sizes) for (const l of ["en", "nl"]) await run(browser, w, h, l, "light");
  await run(browser, 412, 923, "nl", "night");
  // Settings keeps its entry
  const ctx = await browser.newContext({ viewport: { width: 412, height: 923 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const p = await ctx.newPage(); await p.goto(URL); await p.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 25000 }); await sleep(400);
  await p.locator(".sh-gear").tap(); await sleep(500);
  ok(await p.evaluate(() => !!document.querySelector('.sh-settings a[href="./lab.html"]')), "Settings keeps the AI Lab entry");
  await ctx.close(); await browser.close();
  // the review's AI tab: a secondary link to the lab home (the lab cannot open a finished game)
  const src = fs.readFileSync(path.join(__dirname, "../src/review-ai.js"), "utf8");
  ok(/class="ai-lablink"><a href="\.\/lab\.html\?from=review"/.test(src) && /"Open the AI Lab", "Open het AI Lab"/.test(fs.readFileSync(path.join(__dirname, "../src/i18n-nl-ui.js"), "utf8")), "review AI tab links to the lab home (EN + NL strings present)");
  console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
})();
