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
  try { const was = execSync("git show HEAD:index.html", { cwd: ROOT, maxBuffer: 1 << 26 }).length, now = fs.statSync(path.join(ROOT, "index.html")).size; ok(now - was < 6144, "added bytes < 6 KB (detailed art in, dice/ships/boat/palette backdrops out)", `${now - was} B (index.html ${was} -> ${now})`); } catch (e) { console.log("  (bytes: no git)", e.message.slice(0, 60)); }
  for (const vp of [{ width: 360, height: 780 }, { width: 412, height: 923 }]) {
    console.log(`--- ${vp.width}x${vp.height}`);
    const mk = async (opts = {}) => { const ctx = await b.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push("PAGEERR " + e.message.split("\n")[0])); page.on("console", (m) => { if (m.type() === "error" && !/503|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 140)); }); return { ctx, page, errs }; };
    const probe = () => { window.__sp = { seen: 0, gone: 0 }; const t = () => { const s = document.getElementById("splash"); if (s && !window.__sp.seen) { const r = s.getBoundingClientRect(); if (r.width > 0) window.__sp.seen = performance.now(); } if (s && (s.classList.contains("gone") || s.classList.contains("fly") || s.classList.contains("rmfade")) && !window.__sp.handoff) window.__sp.handoff = performance.now(); if (!s && window.__sp.seen && !window.__sp.gone) window.__sp.gone = performance.now(); if (!window.__sp.gone) requestAnimationFrame(t); }; requestAnimationFrame(t); };
    // fast start
    gameDelay = 0; gameFail = false;
    { const { ctx, page, errs } = await mk(); await page.addInitScript(probe);
      await page.goto(URL, { waitUntil: "commit" });
      const first = await page.waitForSelector("#splash", { state: "visible", timeout: 3000 }).then(() => true).catch(() => false); ok(first, "splash visible at first paint");
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 8000 });
      const sp = await page.evaluate(() => window.__sp); ok(sp.handoff > 0 && sp.handoff <= 700, "hand-off starts <= 0.7 s", Math.round(sp.handoff) + " ms"); ok(sp.gone <= 1150, "splash fully gone <= ~1.1 s (no middle stage)", Math.round(sp.gone) + " ms");
      const cov = await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return { sp: !!(e && e.closest("#splash")), left: document.querySelectorAll("#splash,.sp-art").length }; });
      ok(!cov.sp && cov.left === 0, "no splash element left over the home screen", cov);
      await sleep(400); ok(errs.length === 0, "no console errors (fast)", errs.slice(0, 3)); await ctx.close(); }
    // v1.93.1 one continuous identity: never two logos at once; the splash logo lands on the Home header logo (+-2 px), as do "Katan" and the tagline
    gameDelay = 0; gameFail = false;
    for (const [lang, pal] of [["en", "light"], ["nl", "light"], ["en", "night"], ["nl", "night"]]) {
      const { ctx, page, errs } = await mk(); await page.addInitScript(([l, pl]) => { try { localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", pl); } catch (e) {}
        window.__fr = []; const vis = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); if (r.width < 2) return 0; let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o > 0.05 ? 1 : 0; };
        const rc = (r) => ({ l: r.left, t: r.top, w: r.width, h: r.height });
        const tick = () => { const sl = document.querySelector("#splash .sp-logo"), hl = document.querySelector(".home .hm-logo");
          if (sl) { const rg = (el) => { const r = document.createRange(); r.selectNodeContents(el); return rc(r.getBoundingClientRect()); }; const h1 = document.querySelector(".home .hm-brand h1");
            window.__last = { logo: rc(sl.getBoundingClientRect()), hl: hl ? rc(hl.getBoundingClientRect()) : null, w: rg(document.querySelector("#splash .sp-w")), hw: h1 ? rg(h1.firstChild) : null, s: rg(document.querySelector("#splash .sp-sub").lastChild), hs: h1 && h1.querySelector(".hm-sub") ? rg(h1.querySelector(".hm-sub").lastChild) : null, fly: document.getElementById("splash").classList.contains("fly") }; }
          if (sl && !sl.closest("#splash").classList.contains("fly")) { const r0 = sl.getBoundingClientRect(); (window.__pre = window.__pre || []).push({ l: r0.left, t: r0.top, w: r0.width, h: r0.height, tx: Math.max(vis(document.querySelector("#splash .sp-w")), vis(document.querySelector("#splash .sp-sub"))), href: (sl.querySelector("use") || {}).getAttribute ? sl.querySelector("use").getAttribute("href") : "" }); }
          window.__fr.push({ n: vis(sl) + vis(hl), sp: !!sl }); if (!window.__done) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, [lang, pal]);
      await page.goto(URL, { waitUntil: "commit" });
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 8000 }); await sleep(300);
      const r = await page.evaluate(() => { window.__done = 1; const pre = window.__pre || [], hu = document.querySelector(".home .hm-logo use"); const fr = window.__fr, home = document.querySelector(".home .hm-logo").getBoundingClientRect(), hv = getComputedStyle(document.querySelector(".home .hm-brand h1")).opacity; return { frames: fr.length, max: Math.max(...fr.map((f) => f.n)), last: window.__last, flew: !!(window.__last && window.__last.fly), pre: pre.length, still: pre.every((q) => Math.abs(q.l - pre[0].l) < 1 && Math.abs(q.t - pre[0].t) < 1 && Math.abs(q.w - pre[0].w) < 1), text0: Math.max(0, ...pre.map((q) => q.tx)), sym: [...new Set(pre.map((q) => q.href))].concat(hu ? [hu.getAttribute("href")] : []), old: document.querySelectorAll(".sp-dice,.sp-sea,.sp-boat").length, homeNow: { l: home.left, t: home.top, w: home.width, h: home.height }, hv }; });
      const tag = `${lang}/${pal}`; const d = (a, b) => (a && b ? Math.max(Math.abs(a.l - b.l), Math.abs(a.t - b.t), Math.abs(a.w - b.w), Math.abs(a.h - b.h)) : 99);
      ok(r.flew && r.frames > 20, `[${tag}] hand-off flew (shared-element path) over many frames`, { frames: r.frames, flew: r.flew });
      ok(r.max <= 1, `[${tag}] no frame with two logos visible`, r.max);
      ok(r.pre > 3 && r.still, `[${tag}] no middle stage: the logo stays at its launch-icon spot until the hand-off, then goes straight to the header`, { frames: r.pre, still: r.still });
      ok(r.text0 === 0, `[${tag}] wordmark + tagline are not visible before the hand-off`, r.text0);
      ok(r.sym.length === 2 && r.sym[0] === r.sym[1] && r.sym[0] === "#kt-logo", `[${tag}] same SVG symbol from frame 0 to Home's header`, r.sym);
      const L = r.last; const dl = d(L.logo, L.hl), dh = d(L.logo, r.homeNow);
      ok(dl <= 2 && dh <= 2, `[${tag}] splash logo ends on the Home header logo box +-2 px`, { toHeaderLastFrame: +dl.toFixed(2), toHeaderNow: +dh.toFixed(2) });
      const cd = (a, b) => Math.max(Math.abs(a.l + a.w / 2 - b.l - b.w / 2), Math.abs(a.t + a.h / 2 - b.t - b.h / 2));
      ok(cd(L.w, L.hw) <= 2 && Math.abs(L.w.w / L.hw.w - 1) <= .03, `[${tag}] "Katan" wordmark lands on the Home wordmark`, { dc: +cd(L.w, L.hw).toFixed(2), scale: +(L.w.w / L.hw.w).toFixed(3) });
      ok(cd(L.s, L.hs) <= 2, `[${tag}] tagline lands on the Home tagline`, +cd(L.s, L.hs).toFixed(2));
      ok(errs.length === 0, `[${tag}] no console errors`, errs.slice(0, 3)); await ctx.close(); }
    // v1.93.2 one palette from the first frame: frame 0 = Android launch splash (manifest colour + icon circle 58% wide, centred), no light -> dark switch after it
    gameDelay = 0; gameFail = false;
    for (const [name, ls, scheme, want] of [["light", { "colonist.palette": "light" }, "dark", "light"], ["night", { "colonist.palette": "night" }, "light", "night"], ["auto/light OS", { "colonist.paletteAuto": "on" }, "light", "light"], ["auto/dark OS", { "colonist.paletteAuto": "on" }, "dark", "night"], ["auto time, stale last palette", { "colonist.paletteAuto": "time", "colonist.autoPalette": "light", __sched: 1 }, "light", "night"]]) {
      const { ctx, page, errs } = await mk({ colorScheme: scheme });
      await page.addInitScript(([l]) => { try { const n = Date.now(); for (const k in l) { if (k === "__sched") localStorage.setItem("colonist.autoSched", JSON.stringify([[n - 3 * 36e5, "day"], [n - 36e5, "night"], [n + 9 * 36e5, "day"]])); else localStorage.setItem(k, l[k]); } } catch (e) {}
        window.__pal = new Set(); const t = () => { window.__pal.add(document.documentElement.dataset.palette); if (!window.__g0) { const sp = document.querySelector("#splash .sp-disc"), lg = document.querySelector("#splash .sp-logo"); if (sp && lg) { const d = sp.getBoundingClientRect(), l = lg.getBoundingClientRect(); if (d.width) window.__g0 = { disc: d.width / innerWidth, dcx: d.left + d.width / 2 - innerWidth / 2, dcy: d.top + d.height / 2 - innerHeight / 2, lcx: l.left + l.width / 2 - innerWidth / 2, lcy: l.top + l.height / 2 - innerHeight / 2, lw: l.width / innerWidth, bg: getComputedStyle(document.getElementById('splash')).backgroundColor, tc: document.querySelector('meta[name="theme-color"]').content }; } } if (!window.__pdone) requestAnimationFrame(t); }; requestAnimationFrame(t); }, [ls]);
      const px = async () => { const b64 = (await page.screenshot()).toString("base64"); return page.evaluate(async (d) => { const im = await createImageBitmap(await (await fetch("data:image/png;base64," + d)).blob()); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext("2d"); x.drawImage(im, 0, 0); const g = x.getImageData(0, 0, 1, 1).data, f = (devicePixelRatio || 1); return [g[0], g[1], g[2]]; }, b64); };
      const lum = (c) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
      await page.goto(URL, { waitUntil: "commit" }); await page.waitForSelector("#splash", { state: "visible", timeout: 3000 });
      let c0; await page.waitForFunction(() => window.__g0); const g0 = await page.evaluate(() => window.__g0);
      await sleep(550); const c1 = await px();
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 8000 }); await sleep(300); const c2 = await px();
      const r = await page.evaluate(() => { window.__pdone = 1; return { pals: [...window.__pal], tc: document.querySelector('meta[name="theme-color"]').content }; }); await sleep(950); const tcEnd = await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
      const near = (c, e, t) => c.every((v, i) => Math.abs(v - e[i]) <= t);
      ok(g0.bg === "rgb(41, 119, 133)", `[${name}] first frame background = manifest colour #297785 (Android launch splash)`, g0.bg);
      c0 = [41, 119, 133];
      ok(Math.abs(g0.disc - .58) < .01 && Math.abs(g0.dcx) < 1.5 && Math.abs(g0.dcy) < 1.5, `[${name}] first frame: icon circle 58% wide, centred`, g0);
      ok(Math.abs(g0.lcx) < 1.5 && Math.abs(g0.lcy) < 1.5 && Math.abs(g0.lw - .4793) < .004, `[${name}] first frame: the logo symbol (= the Android icon art) is centred, 47.9% of the width`, { lcx: g0.lcx, lcy: g0.lcy, hexSpan: g0.lw });
      ok(g0.tc === "#297785", `[${name}] theme-color starts at the launch colour`, g0.tc);
      ok(r.pals.length === 1 && r.pals[0] === want, `[${name}] palette on <html> is ${want} at every frame (no switch)`, r.pals);
      if (want === "night") ok(lum(c1) <= lum(c0) + 4 && lum(c2) <= lum(c1) + 4 && lum(c2) < 55, `[${name}] backdrop only ever darkens: launch -> intro -> home`, [c0, c1, c2].map(lum).map(Math.round));
      else ok(Math.abs(lum(c1) - lum(c0)) < 40 && lum(c2) > 60, `[${name}] backdrop stays light: launch -> intro -> home`, [c0, c1, c2].map(lum).map(Math.round));
      ok(tcEnd === (want === "night" ? "#0E1B22" : "#2d6888"), `[${name}] theme-color ends on the palette colour`, tcEnd);
      ok(errs.length === 0, `[${name}] no console errors`, errs.slice(0, 3)); await ctx.close(); }
    // slow loading: loop
    gameDelay = 4500;
    { const { ctx, page, errs } = await mk(); await page.goto(URL, { waitUntil: "commit" });
      await page.waitForSelector("#splash", { state: "visible" }); await sleep(2200);
      const st = await page.evaluate(() => { const an = document.getAnimations().filter((a) => a.playState === "running"); const d = document.querySelector("#splash .sp-disc"), r = document.querySelector("#splash .sp-logo").getBoundingClientRect(); return { running: an.length, pulse: !!d && d.getAnimations().some((a) => a.playState === "running" && a.effect.getComputedTiming().iterations === Infinity), logoMid: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1.5, text: Math.max(...[...document.querySelectorAll("#splash .sp-w,#splash .sp-sub")].map((e) => +getComputedStyle(e).opacity)), still: !!document.getElementById("splash") }; });
      ok(st.still && st.pulse, "loading loop (icon circle pulse) runs while the app is slow (>1.5 s)", st); ok(st.logoMid && st.text === 0, "while loading: still frame 0 (logo on the icon spot, no wordmark yet)", st);
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 15000 }); ok(true, "slow app still hands off to home"); ok(errs.length === 0, "no console errors (slow)", errs.slice(0, 3)); await ctx.close(); }
    // reduced motion
    gameDelay = 2500;
    { const { ctx, page, errs } = await mk({ reducedMotion: "reduce" }); await page.goto(URL, { waitUntil: "commit" }); await page.waitForSelector("#splash", { state: "visible" }); await sleep(700);
      const rm = await page.evaluate(() => ({ anim: document.getAnimations().filter((a) => a.playState === "running" && document.getElementById("splash").contains(a.effect.target)).map((a) => a.animationName || a.constructor.name + ":" + a.effect.target.className).join(), art: !!document.querySelector(".sp-logo use") }));
      ok(rm.anim === "" && rm.art, "reduced motion: static art, nothing running", rm);
      await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 10000 }); ok(errs.length === 0, "no console errors (reduced)", errs.slice(0, 3)); await ctx.close(); }
    // forced failure
    gameFail = true; gameDelay = 0;
    { const { ctx, page, errs } = await mk(); await page.goto(URL, { waitUntil: "commit" });
      const shown = await page.waitForSelector("#splash.failed #splashReload", { state: "visible", timeout: 20000 }).then(() => true).catch(() => false); ok(shown, "error state shows Reload after the boot retries");
      const g = await page.evaluate(() => ({ msg: document.getElementById("splashMsg").textContent, filter: getComputedStyle(document.querySelector(".sp-logo")).filter, paused: document.getAnimations().filter((a) => document.getElementById("splash").contains(a.effect.target)).every((a) => a.playState !== "running") }));
      ok(/could not start/.test(g.msg) && /grayscale/.test(g.filter) && g.paused, "greyed art, paused, message", g); await ctx.close(); }
  }
  await b.close(); srv.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
