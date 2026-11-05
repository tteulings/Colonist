// End-screen overlap check at 360x780 in Sunny / Dusk / Night over seeded games (4p, 6p, Rush, Seafarers, unreviewed, 3p).
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const { serve, sleep } = require("./tlib");
const ROOT = path.resolve(process.argv[2]), PORT = Number(process.argv[3]), SHOTS = process.argv[4] || null;
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json")));
const GAMES = { "4p-reviewed": "mw2ci2vhi0m0", "6p": "mw2ceatcdajr", rush: "mw2cit9id9us", seafarers: "mw2ceb712fnj", "4p-unreviewed": "mw2cebqthp43", "3p-won": "mw2cfwrrd9gv" };
let bad = 0; const chk = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m} ${x}`); if (!c) bad++; };
(async () => {
  const server = await serve(ROOT, PORT);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); pg.on("pageerror", (e) => { console.log("PAGEERR", e.message); bad++; });
  await pg.addInitScript(() => { if (sessionStorage.getItem("__init")) return; sessionStorage.setItem("__init", "1"); localStorage.clear(); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.theme", "A"); });
  await pg.goto(`http://localhost:${PORT}/`);
  await pg.waitForFunction(() => window.__colonistGame && document.querySelector(".home"));
  await pg.evaluate(async (seed) => { const g = window.__colonistGame; await g.hist.open(); for (const s of seed) await g.hist.put(s.meta, s.payload); }, seed);
  for (const [pal, tag] of [["light", "sunny"], ["dusk", "dusk"], ["night", "night"]]) {
    await pg.evaluate(async (p) => (await import("/src/themes/manager.js")).setPalette(p), pal); await sleep(400);
    for (const [name, id] of Object.entries(GAMES)) {
      await pg.evaluate(async () => { const g = window.__colonistGame; g.histClose?.(); g._rpExit?.(true); g.removeGameOverOverlay?.(); if (!g.home.open) g.goHome(); });
      await pg.evaluate((id) => window.__colonistGame.histView(id, "stats"), id);
      try { await pg.waitForSelector(".gs-recap", { timeout: 9000 }); } catch (e) { chk(false, `${tag} ${name}: end screen opens`); continue; }
      await sleep(2600);
      const r = await pg.evaluate(() => {
        const bad = [], sc = document.querySelector(".gs-scroll"), W = innerWidth;
        if (sc.scrollWidth > sc.clientWidth + 1) bad.push("scroll sideways");
        const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        document.querySelectorAll(".gs-recap, .gs-look, .gs-revcard, .gs-hlc, .gs-tiles, .gs-ov, .gs-rank").forEach((el) => { const r = el.getBoundingClientRect(); if (r.left < -0.5 || r.right > W + 0.5) bad.push(el.className + " outside"); });
        const tiles = [...document.querySelectorAll(".gs-tile")]; tiles.forEach((t, i) => { const a = t.getBoundingClientRect(); if (t.scrollWidth > t.clientWidth + 1) bad.push("tile text clipped " + t.textContent.trim().slice(0, 12)); tiles.slice(i + 1).forEach((u) => { if (hit(a, u.getBoundingClientRect())) bad.push("tiles overlap"); }); });
        const rvb = document.querySelector(".rvb"); if (rvb) { const r = rvb.getBoundingClientRect(); const p = rvb.parentElement.getBoundingClientRect(); if (r.right > p.right + 0.5 || rvb.scrollWidth > rvb.clientWidth + 1) bad.push("review button clipped"); }
        document.querySelectorAll(".rv1-row").forEach((row) => { if (row.scrollWidth > row.clientWidth + 1) bad.push("missed row clipped"); });
        const foot = document.querySelector(".gs-foot").getBoundingClientRect(); const fb = [...document.querySelectorAll(".gs-foot > *")].map((e) => e.getBoundingClientRect()); if (fb.length > 1 && hit(fb[0], fb[1])) bad.push("footer buttons overlap"); if (foot.bottom > innerHeight + 1) bad.push("footer off screen");
        const tabs = document.querySelector(".gs-tabs"); if (tabs) { tabs.querySelectorAll(".gs-tab").forEach((t) => { if (t.scrollWidth > t.clientWidth + 1) bad.push("tab clipped"); }); }
        const small = [...document.querySelectorAll(".gs-recap, .gs-look, .gs-revcard, .gs-hlc")].flatMap((c) => [...c.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 10.5)); if (small.length) bad.push("text < 10.5px: " + small[0].textContent.trim().slice(0, 20));
        const wait = document.querySelector(".rv-wait"); const txt = document.querySelector("[data-rvbox]")?.innerText || "";
        return { bad, wait: !!wait, box: txt.replace(/\s+/g, " ").slice(0, 90), tiles: tiles.length };
      });
      chk(!r.bad.length, `${tag} ${name}: no overlap/clip`, JSON.stringify(r.bad) + ` tiles=${r.tiles} box="${r.box}"`);
      if (SHOTS && (name === "6p" || name === "rush" || name === "seafarers")) { await pg.screenshot({ path: path.join(SHOTS, `after-${tag}-end-${name}.png`) }); }
      if (["4p-reviewed", "4p-unreviewed"].includes(name)) { await sleep(5000); const t = await pg.evaluate(() => !!document.querySelector(".rv-wait")); chk(!t, `${tag} ${name}: no endless "checking…" after 7 s`); }
    }
  }
  await b.close(); server.close();
  console.log(bad ? `FAILED ${bad}` : "ALL OK"); process.exit(bad ? 1 : 0);
})();
