// v1.99 screenshots of every shell screen at 360x780 @2x: node tests/shell199-shots.js PORT OUTDIR [lang=en|nl] [pal=light|night] [only=a,b]
const { chromium } = require("playwright"); const fs = require("fs");
const [port, out, lang = "en", pal = "light", only] = [process.argv[2] || "8700", process.argv[3] || "/tmp/shots", process.argv[4], process.argv[5], process.argv[6]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([l, p]) => { try { if (!sessionStorage.__init) { sessionStorage.__init = 1; localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.autoDarkToast", "1"); } } catch (e) {} }, [lang, pal]);
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror " + e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 20000 });
  await sleep(800);
  const G = (f, a) => page.evaluate(f, a);
  const tag = `${lang}-${pal}`; const want = (k) => !only || only.split(",").includes(k);
  const shot = async (k) => { if (want(k)) { await sleep(450); await page.screenshot({ path: `${out}/${tag}-${k}.png` }); } };
  await shot("01-play");
  // a saved game for the Continue row
  await page.locator(".hm-start").tap(); await sleep(1500);
  await G(() => window.__colonistGame.goHome()); await sleep(600);
  await shot("02-play-continue");
  await page.locator('.sh-tab[data-tab=daily]').tap(); await shot("03-daily");
  await page.locator('.sh-tab[data-tab=review]').tap(); await sleep(600); await shot("04-review");
  await page.locator('.sh-tab[data-tab=bots]').tap(); await sleep(600); await shot("05-bots");
  await page.locator('.sh-tab[data-tab=play]').tap(); await sleep(300);
  await page.locator('[data-home=adjust]').tap(); await sleep(500); await shot("06-newgame");
  await page.locator('[data-action=more]').tap(); await sleep(400); await shot("07-more-rules");
  await page.locator('[data-kind=human][data-seat="1"]').tap(); await sleep(300); await shot("07b-more-rules-friend"); await page.locator('[data-kind=bot][data-seat="1"]').tap();
  await page.locator('.sh-layer [data-action=back]').first().tap(); await sleep(300);
  await page.locator('[data-set="board:seafarers"]').tap(); await sleep(300); await shot("06b-newgame-sea"); await page.locator('[data-set="board:island"]').tap(); await page.locator('[data-bot="5"]').tap(); await sleep(200); await shot("06c-newgame-5bots"); await page.locator('[data-bot="4"]').tap(); await page.locator('[data-bot="3"]').tap(); await page.locator('[data-set="mode:rush"]').tap(); await sleep(200); await shot("06d-newgame-rush");  await page.locator('[data-set="mode:classic"]').tap();
  await page.locator('[data-action=levels]').tap(); await sleep(400); await shot("08-levels");
  await page.locator('[data-set="styleMode:each"]').tap(); await sleep(300); await shot("09-levels-each");
  await page.locator('.sh-layer [data-action=back]').first().tap(); await sleep(300);
  await page.locator('[data-action=cancel]').tap(); await sleep(500);
  await page.locator(".hm-start").tap(); await sleep(1500);
  await G(() => window.__colonistGame.menu.show()); await shot("10-pause");
  await page.locator('[data-menu=settings]').tap(); await sleep(600); await shot("11-settings");
  await G(() => { document.querySelector(".sh-settings .st-body").scrollTop = 900; }); await shot("12-settings-mid");
  await G(() => { document.querySelector(".sh-settings .st-body").scrollTop = 99999; }); await shot("13-settings-end");
  await G(() => { document.querySelector(".sh-settings .st-body").scrollTop = 0; });
  await page.locator('[data-go=theme]').tap(); await sleep(400); await shot("14-theme");
  await page.locator('.sh-settings .st-close').tap(); await page.locator('.sh-settings .st-close').tap(); await sleep(500);
  await G(() => window.__colonistGame.goHome()); await sleep(500);
  await G(() => { localStorage.removeItem("colonist.palette"); localStorage.removeItem("colonist.autoDarkToast"); });
  if (process.env.MISSES) { const m = await G(async () => [...(await import("/src/i18n.js")).misses]); console.log("MISSES " + JSON.stringify(m)); }
  console.log(errs.join("\n") || `${tag}: no errors`);
  await b.close();
})();
