// v1.93 start-screen animation test.  node tests/splash193.js [ROOT]   (served under /Colonist/ like GitHub Pages)
const { chromium } = require("playwright"); const http = require("http"); const fs = require("fs"); const path = require("path"); const { execSync } = require("child_process");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
let gameDelay = 0, gameFail = false;
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (!u.startsWith("/Colonist/")) { r.writeHead(404); return r.end(); }
  u = u.slice("/Colonist".length); if (u === "/") u = "/index.html";
  const send = () => fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream", "Cache-Control": "no-store" }); r.end(d); });
  if (u === "/src/game.js") { if (gameFail) { r.writeHead(503); return r.end("x"); } if (gameDelay) return setTimeout(send, gameDelay); }
  send();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => srv.listen(0, r)); const URL = `http://localhost:${srv.address().port}/Colonist/`;
  const b = await chromium.launch();
  // added bytes vs the previous commit
  try { const was = execSync("git show HEAD:index.html", { cwd: ROOT, maxBuffer: 1 << 26 }).length, now = fs.statSync(path.join(ROOT, "index.html")).size; ok(now - was < 6144, "added bytes < 6 KB", `${now - was} B (index.html ${was} -> ${now})`); } catch (e) { console.log("  (bytes: no git)", e.message.slice(0, 60)); }
  for (const vp of [{ width: 360, height: 780 }, { width: 412, height: 923 }]) {
    console.log(`--- ${vp.width}x${vp.height}`);
    const mk = async (opts = {}) => { const ctx = await b.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push("PAGEERR " + e.message.split("\n")[0])); page.on("console", (m) => { if (m.type() === "error" && !/503|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 140)); }); return { ctx, page, errs }; };
    const probe = () => { window.__sp = { seen: 0, gone: 0 }; const t = () => { const s = document.getElementById("splash"); if (s && !window.__sp.seen) { const r = s.getBoundingClientRect(); if (r.width > 0) window.__sp.seen = performance.now(); } if (s && s.classList.contains("gone") && !window.__sp.handoff) window.__sp.handoff = performance.now(); if (!s && window.__sp.seen && !window.__sp.gone) window.__sp.gone = performance.now(); if (!window.__sp.gone) requestAnimationFrame(t); }; requestAnimationFrame(t); };
    // fast start
    gameDelay = 0; gameFail = false;
    { const { ctx, page, errs } = await mk(); await page.addInitScript(probe);
      await page.goto(URL, { waitUntil: "commit" });
      const first = await page.waitForSelector("#splash", { state: "visible", timeout: 3000 }).then(() => true).catch(() => false); ok(first, "splash visible at first paint");
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 8000 });
      const sp = await page.evaluate(() => window.__sp); ok(sp.handoff > 0 && sp.handoff <= 1300, "intro finished, hand-off starts <= 1.3 s", Math.round(sp.handoff) + " ms"); ok(sp.gone <= 1800, "splash fully gone <= 1.8 s", Math.round(sp.gone) + " ms");
      const cov = await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return { sp: !!(e && e.closest("#splash")), left: document.querySelectorAll("#splash,.sp-art").length }; });
      ok(!cov.sp && cov.left === 0, "no splash element left over the home screen", cov);
      await sleep(400); ok(errs.length === 0, "no console errors (fast)", errs.slice(0, 3)); await ctx.close(); }
    // slow loading: loop
    gameDelay = 4500;
    { const { ctx, page, errs } = await mk(); await page.goto(URL, { waitUntil: "commit" });
      await page.waitForSelector("#splash", { state: "visible" }); await sleep(2200);
      const st = await page.evaluate(() => { const an = document.getAnimations().filter((a) => a.playState === "running"); const dice = document.querySelectorAll(".sp-dice g"); return { running: an.length, dice: [...dice].some((g) => g.getAnimations().some((a) => a.playState === "running" && a.effect.getComputedTiming().iterations === Infinity)), bob: [...document.querySelectorAll(".sb")].some((g) => g.getAnimations().some((a) => a.playState === "running")), ships: document.querySelectorAll(".sp-sea use").length, still: !!document.getElementById("splash") }; });
      ok(st.still && st.dice, "dice loop is running while loading (>1.5 s)", st); ok(st.bob && st.ships === 2, "two ships bobbing in the loop", st);
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 15000 }); ok(true, "slow app still hands off to home"); ok(errs.length === 0, "no console errors (slow)", errs.slice(0, 3)); await ctx.close(); }
    // reduced motion
    gameDelay = 2500;
    { const { ctx, page, errs } = await mk({ reducedMotion: "reduce" }); await page.goto(URL, { waitUntil: "commit" }); await page.waitForSelector("#splash", { state: "visible" }); await sleep(700);
      const rm = await page.evaluate(() => ({ anim: document.getAnimations().filter((a) => a.playState === "running" && document.getElementById("splash").contains(a.effect.target)).map((a) => a.animationName || a.constructor.name + ":" + a.effect.target.className).join(), shipX: getComputedStyle(document.querySelector(".s1")).transform, art: !!document.querySelector(".sp-logo .a6") }));
      ok(rm.anim === "" && rm.art, "reduced motion: static art, nothing running", rm);
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 10000 }); ok(errs.length === 0, "no console errors (reduced)", errs.slice(0, 3)); await ctx.close(); }
    // forced failure
    gameFail = true; gameDelay = 0;
    { const { ctx, page, errs } = await mk(); await page.goto(URL, { waitUntil: "commit" });
      const shown = await page.waitForSelector("#splash.failed #splashReload", { state: "visible", timeout: 20000 }).then(() => true).catch(() => false); ok(shown, "error state shows Reload after the boot retries");
      const g = await page.evaluate(() => ({ msg: document.getElementById("splashMsg").textContent, filter: getComputedStyle(document.querySelector(".sp-logo")).filter, paused: [...document.querySelectorAll(".sp-dice g")].every((g) => g.getAnimations().every((a) => a.playState !== "running")) }));
      ok(/could not start/.test(g.msg) && /grayscale/.test(g.filter) && g.paused, "greyed art, paused, message", g); await ctx.close(); }
  }
  await b.close(); srv.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
