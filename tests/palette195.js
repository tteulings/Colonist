// v1.95 node tests/palette195.js [ROOT] [PORT]: the index.html head script's first-paint palette == manager.js effectivePalette() at every half hour of the day, DST edges, launches 6 min .. 14 days after the last run (clock mocked, so it never depends on the time of day)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "..")), PORT = +process.argv[3] || 0;
const mime = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/_h.html") { r.writeHead(200, { "Content-Type": "text/html" }); return r.end("<!doctype html><title>h</title><meta name=theme-color content=#000>"); }
  fs.readFile(path.join(ROOT, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); });
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const head = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const cases = [["Europe/Amsterdam", ["2026-03-29", "2026-06-21", "2026-10-25", "2026-11-22"]], ["America/New_York", ["2026-03-08", "2026-11-01"]], ["Australia/Sydney", ["2026-04-05", "2026-10-04"]], ["Asia/Kolkata", ["2026-11-22"]], ["Pacific/Auckland", ["2026-09-27"]]];
(async () => { await new Promise((r) => srv.listen(PORT, r)); const P = srv.address().port; const b = await chromium.launch(); const bad = {}; let n = 0, fails = 0;
  for (const [tz, dates] of cases) { const ctx = await b.newContext({ timezoneId: tz }); const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("PAGEERR", e.message));
    await page.goto(`http://localhost:${P}/_h.html`);
    const res = await page.evaluate(async ({ dates, head }) => {
      const m = await import("/src/themes/manager.js"); const out = [];
      for (const ds of dates) for (let min = 0; min < 1440; min += 30) for (const gapH of [0.1, 6, 24, 55, 100, 200, 330]) {
        const [y, mo, d] = ds.split("-").map(Number); const base = new Date(y, mo - 1, d, 0, 0, 0).getTime();
        const T1 = base + min * 60000, T0 = T1 - gapH * 36e5;
        localStorage.clear(); localStorage.setItem("colonist.paletteAuto", "time"); localStorage.setItem("colonist.autoPalette", "light");
        window.__colonistClock = T0; m.paletteTick();
        const fr = document.createElement("iframe"); document.body.append(fr); const w = fr.contentWindow; w.Date.now = () => T1;
        const s = w.document.createElement("script"); s.textContent = head; w.document.body.append(s);
        const got = w.document.documentElement.dataset.palette; fr.remove();
        window.__colonistClock = T1; const want = m.effectivePalette();
        if (got !== want) out.push({ ds, hm: String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"), gapH, got, want });
      } return out; }, { dates, head });
    n += dates.length; bad[tz] = res; await ctx.close(); console.log(`${res.length ? "FAIL" : "ok  "} ${tz}: first paint == manager palette, ${dates.length} days x 48 half-hours x 7 gaps`, res.slice(0, 6)); if (res.length) fails++; }
  await b.close(); srv.close(); console.log(fails ? fails + " FAILED" : "all ok"); process.exit(fails ? 1 : 0); })();
