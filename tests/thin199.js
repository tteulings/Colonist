// v1.99 fixA: games with too few scored moves (short lost games) and the start lesson.   node tests/thin199.js PORT   (server: node tests/serve.mjs ROOT PORT)
//   Variants are made in memory from the fixture tests/fixtures/post199/r2.json (a lost game):
//     thin-start: every move after the start is "one sensible option" (2 scored: the two start picks)   thin-none: nothing scored at all (the start picks are missing too, like Sanne's game)
//   Overview rules: never praise ("Good play" / "Goed gespeeld") when too few are scored; say "Too few scored moves for a verdict" (EN) / "Te weinig beoordeelde zetten voor een oordeel" (NL);
//   show the Strategy numbers (cities, roads, income vs the best other player; who gained points where) and, when scored, the start picks. A normal game keeps its tiles and Lesson 1.
//   env SHOTS=dir: crops of the Overview at 360x780 and 412x923, EN and NL, for the short lost game and a normal game.
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 9131, SHOTS = process.env.SHOTS, FIX = path.join(__dirname, "fixtures", "post199");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const base = JSON.parse(fs.readFileSync(path.join(FIX, "r2.json"), "utf8"));
const variant = (tag, f) => { const j = JSON.parse(JSON.stringify(base)); j.meta.id = `${base.meta.id}-${tag}`; if (j.state?.stats) j.state.stats.id = j.meta.id; f(j); return j; };
const forcedOf = (x) => ({ k: x.k, pid: x.pid, t: x.t, s: x.s, e: x.e, i: x.i, skip: "forced" });
const GAMES = {
  normal: variant("normal", () => {}),
  "thin-start": variant("thinstart", (j) => { const rv = j.rv.reviews[0]; rv.results = rv.results.map((x) => (x.k === "setup" ? x : forcedOf(x))); }),
  "thin-none": variant("thinnone", (j) => { const rv = j.rv.reviews[0]; rv.results = rv.results.map(forcedOf); }),
};
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[360, 780], [412, 923]]) for (const lang of ["en", "nl"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(({ l }) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); }, { l: lang });
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    for (const j of Object.values(GAMES)) { const { meta, format, v, ...rec } = j; await page.evaluate(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec }); }
    for (const [name, j] of Object.entries(GAMES)) {
      const tag = `${w}x${h} ${lang} ${name}`;
      await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(700);
      await page.evaluate((id) => window.__colonistGame._histSheet(id), j.meta.id); await sleep(400);
      await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(1500);
      const r = await page.evaluate(() => { const q = (s) => document.querySelector(s); const t = (s) => [...document.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, " ").trim());
        return { text: document.querySelector(".rv-scroll").innerText.replace(/\s+/g, " "), head: t(".px-hl2")[0] || "", tiles: t(".px-t3"), thin: !!q(".px-thin"), l1: !!q(".px-l1"), l3: !!q(".px-l3c"), meas: document.querySelectorAll(".px-mr:not(.hd)").length, tempo: document.querySelectorAll(".px-tg:not(.hd)").length, l2c: !!q(".px-l2c"), startTile: !!q("[data-pxpil=start]"), over: document.documentElement.scrollWidth > innerWidth + 1, hdr: t(".rv-bar small")[0] || "" }; });
      const FEW = lang === "nl" ? "Te weinig beoordeelde zetten voor een oordeel" : "Too few scored moves for a verdict", PRAISE = /Good play|Goed gespeeld|Well played/i;
      if (name === "normal") {
        ok(!r.thin && r.l1 && r.tiles.length === 3 && !r.text.includes(FEW), `${tag}: a normal game keeps its tiles and Lesson 1, no "too few" text`, r.tiles.length);
      } else {
        ok(r.thin && !r.l1 && !r.l3, `${tag}: Lesson 1 and Lesson 3 give way to the "too few" card`);
        ok(r.text.includes(FEW), `${tag}: says plainly "${FEW}"`);
        ok(!PRAISE.test(r.text), `${tag}: no praise when almost nothing was scored`);
        ok(r.meas >= 3 && r.tempo >= 4, `${tag}: Strategy numbers on the Overview (you vs the best other player; who gained points where)`, { meas: r.meas, tempo: r.tempo });
        if (name === "thin-start") ok(r.startTile && r.l2c && /2/.test(r.tiles.join(" ")), `${tag}: the start picks are there (tile and "This board")`, r.tiles);
        else ok(!r.startTile && !r.l2c, `${tag}: no start picks scored: no start tile and no start card`);
      }
      ok(!r.over, `${tag}: no horizontal overflow`);
      ok(!/\bNaN\b|undefined|\[object/.test(r.text), `${tag}: no NaN/undefined`);
      if (lang === "nl") { const ms = await page.evaluate(async () => { const I = await import("/src/i18n.js"); const a = [...I.misses]; I.misses.clear(); return a; }); const bad = ms.filter((x) => r.text.includes(x) && /[a-z]{4}/i.test(x) && !/^(Katan|You|Blaauw|Geelen|Groen)$/.test(x)); ok(!bad.length, `${tag}: no English left in Dutch`, bad.slice(0, 4)); }
      if (SHOTS && (name === "normal" || name === "thin-start" || name === "thin-none")) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.evaluate(() => { document.querySelector(".rv-scroll").scrollTop = 0; });
        await page.setViewportSize({ width: w, height: 1900 }); await sleep(500);
        await page.screenshot({ path: path.join(SHOTS, `overview-${name}-${lang}-${w}.png`) });
        await page.setViewportSize({ width: w, height: h }); await sleep(300);
      }
    }
    ok(!errors.length, `${w}x${h} ${lang}: no page errors`, errors.slice(0, 2));
    await ctx.close();
  }
  await b.close(); console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})();
