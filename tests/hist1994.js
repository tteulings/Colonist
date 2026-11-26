// v1.99.5 history safety: node tests/hist1994.js PORT [OLD_ROOT]   (OLD_ROOT: a checkout of an older build, e.g. 698877e, for the upgrade path; default: skipped)
//  1. upgrade: games saved by OLD_ROOT are still listed after the same origin serves this tree (service worker updated, reloaded twice)
//  2. a failed IndexedDB open is retried and, when it keeps failing, Past games and the Home card say so (not "No past games yet" / "Play your first game"); the next open shows the games
//  3. a game finished while the store is unavailable is kept in a queue and ends up in IndexedDB when it opens (the older games stay)
const { chromium } = require("playwright"); const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const NEW = path.resolve(__dirname, ".."), OLD = process.argv[3] || process.env.OLD_ROOT || "", PORT = +process.argv[2] || 9204;
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
let root = NEW;
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream", "Cache-Control": "max-age=600" }); r.end(d); }); });
const fx = ["r1", "r2"].map((f) => JSON.parse(fs.readFileSync(path.join(NEW, "tests/fixtures/post199", f + ".json"), "utf8")));
const entry = (i, id) => { const { meta, format, v, calib, ...rec } = fx[i]; return { meta: { ...meta, id: id || meta.id, end: Date.now() - i * 864e5 }, rec }; };
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "h94-"));
  const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const errs = []; const page = await ctx.newPage(); page.on("pageerror", (e) => errs.push(e.message.split("\n")[0]));
  await ctx.addInitScript(() => { try { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", "en"); } catch (_) {}
    window.__failN = 0; const o = indexedDB.open.bind(indexedDB); indexedDB.open = function (name, v) { if (name === "colonist_history" && window.__failN > 0) { window.__failN--; const r = {}; setTimeout(() => { r.error = new DOMException("Connection to Indexed Database server lost", "UnknownError"); r.onerror && r.onerror(); }, 2); return r; } return o(name, v); }; });
  const up = async () => { await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(1500); };
  const idbN = () => page.evaluate(() => new Promise((res) => { const q = indexedDB.open("colonist_history"); q.onsuccess = () => { const c = q.result.transaction("games").objectStore("games").count(); c.onsuccess = () => { res(c.result); q.result.close(); }; }; }));
  const seed = (list) => page.evaluate(async (list) => { const g = window.__colonistGame; await g.hist.open(); for (const e of list) await g.hist.put({ ...e.meta }, e.rec, { quiet: true }); }, list);
  const sheet = async () => { const r = await page.evaluate(async () => { const g = window.__colonistGame; g.histOpen(); await new Promise((r) => setTimeout(r, 1000)); const o = { rows: document.querySelectorAll(".hs-row").length, empty: !!document.querySelector(".hs-empty [data-hplay]"), reload: !!document.querySelector("[data-hreload]"), txt: (document.querySelector(".hs-scroll")?.innerText || "").slice(0, 80) }; document.querySelector("[data-hclose]")?.click(); await new Promise((r) => setTimeout(r, 300)); return o; }); return r; };
  const home = () => page.evaluate(() => (document.querySelector(".hm-stats")?.innerText || "").replace(/\n/g, " "));
  // 1. upgrade path
  if (OLD) {
    root = OLD; await page.goto(`http://localhost:${PORT}/index.html`); await up(); await seed([entry(0), entry(1)]); await page.evaluate(() => navigator.serviceWorker.ready); await sleep(800);
    root = NEW; for (let i = 0; i < 2; i++) { await page.reload({ waitUntil: "domcontentloaded" }); await up(); await sleep(i ? 500 : 3500); }
    const v = await page.evaluate(async () => (await import("./src/themes/settings-ui.js")).APP_VERSION); const s = await sheet();
    ok(v !== "1.99" && s.rows === 2 && await idbN() === 2, "upgrade " + v + ": both games still listed and in IndexedDB", { v, ...s, home: await home() });
  } else { root = NEW; await page.goto(`http://localhost:${PORT}/index.html`); await up(); await seed([entry(0), entry(1)]); console.log("skip  upgrade path (no OLD_ROOT)"); }
  // 2. failed open: notice, not the empty state; then the games
  const page2 = await ctx.newPage(); page2.on("pageerror", (e) => errs.push(e.message.split("\n")[0]));
  await page2.addInitScript(() => { window.__failN = 99; }); // runs after the context's wrapper is installed // every attempt of this page load fails (first open + 3 retries)
  await page2.goto(`http://localhost:${PORT}/index.html`);
  await page2.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(4500); // the retries take about 2.3 s
  const P = page2; const st = await P.evaluate(() => { const h = window.__colonistGame.hist; return { unavailable: h.unavailable, mode: h.mode, shown: h.metas.length }; });
  ok(st.unavailable && st.shown === 0, "failed open: store reports unavailable", st);
  const hh = await P.evaluate(() => (document.querySelector(".hm-stats")?.innerText || "").replace(/\n/g, " "));
  ok(/couldn.t be loaded/.test(hh) && !/Play your first game/.test(hh), "Home card says the games could not be loaded", hh);
  const s2 = await P.evaluate(async () => { const g = window.__colonistGame; g.histOpen(); await new Promise((r) => setTimeout(r, 900)); return { empty: !!document.querySelector(".hs-empty [data-hplay]"), reload: !!document.querySelector("[data-hreload]"), txt: document.querySelector(".hs-scroll")?.innerText.slice(0, 90) }; });
  ok(!s2.empty && s2.reload && /couldn.t be loaded/.test(s2.txt), "Past games shows the notice and a Reload button, not 'No past games yet'", s2);
  // 3. a game finished in this state is queued; the store recovers; both end up in IndexedDB
  const e3 = entry(0, "queued-game-1"); await P.evaluate(async (e) => { await window.__colonistGame.hist.put({ ...e.meta }, e.rec); }, e3);
  ok(await P.evaluate(() => window.__colonistGame.hist.queue.size) === 1 && await idbN() === 2, "game finished while unavailable is queued, IndexedDB untouched (still 2)");
  await P.evaluate(() => { window.__failN = 0; }); await P.evaluate(() => window.__colonistGame.hist.retry()); await sleep(1200);
  const st3 = await P.evaluate(() => { const h = window.__colonistGame.hist; return { unavailable: h.unavailable, mode: h.mode, shown: h.metas.length, q: h.queue.size, ids: h.metas.map((m) => m.id) }; });
  ok(!st3.unavailable && st3.mode === "idb" && st3.shown === 3 && st3.q === 0, "after the retry the store lists the 2 old games and the queued one", st3);
  ok(await idbN() === 3, "IndexedDB now holds 3 games");
  const h3 = await P.evaluate(() => (document.querySelector(".hm-stats")?.innerText || "").replace(/\n/g, " ")); ok(/Played/.test(h3) && !/couldn.t be loaded/.test(h3), "Home card is back to the stats", h3);
  ok(errs.length === 0, "no page errors", errs.slice(0, 3));
  await ctx.close(); srv.close(); console.log(fails ? "FAILED " + fails : "ALL OK"); process.exit(fails ? 1 : 0);
})();
