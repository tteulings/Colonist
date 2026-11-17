// Upgrade-path test: an installed old build (OLD root) -> new build (NEW root), served under /Colonist/ like GitHub Pages.
//   node tests/upgrade1911.js OLD_ROOT NEW_ROOT [STATE_JSON]   (STATE_JSON: a Playwright storageState with the old localStorage)
// Scenarios: plain upgrade; a transient 503 on one random module (once); on several modules (once each); sw.js itself 503 once.
// Each: reload like a PWA several times and demand that the game starts (window.__colonistGame, splash gone) every time.
const { chromium } = require("playwright"); const http = require("http"); const fs = require("fs"); const path = require("path"); const os = require("os");
const [OLD, NEW, STATE] = [process.argv[2], process.argv[3], process.argv[4]];
if (!OLD || !NEW) { console.log("usage: node upgrade1911.js OLD_ROOT NEW_ROOT [STATE_JSON]"); process.exit(2); }
const NEWV = process.env.NEWV || "";
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
let root = OLD, fail = new Map(), served503 = [];
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (!u.startsWith("/Colonist/")) { r.writeHead(404); return r.end(); }
  u = u.slice("/Colonist".length); if (u === "/") u = "/index.html";
  if (root === NEW && fail.has(u) && fail.get(u) > 0) { fail.set(u, fail.get(u) - 1); served503.push(u); r.writeHead(503); return r.end("Service Unavailable"); }
  fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream", "Cache-Control": "max-age=600" }); r.end(d); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function jsModules() { const out = []; (function w(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) w(p); else if (/\.js$/.test(f.name)) out.push("/" + path.relative(NEW, p)); } })(path.join(NEW, "src")); return out; }
async function started(page, ms = 20000) {
  const t = Date.now();
  while (Date.now() - t < ms) { const s = await page.evaluate(() => ({ g: !!window.__colonistGame, sp: !!document.getElementById("splash"), failed: !!document.querySelector("#splash.failed") })).catch(() => null); if (s && s.g && !s.sp) return true; if (s && s.failed) { await sleep(300); const s2 = await page.evaluate(() => !!window.__colonistGame).catch(() => false); if (!s2) return false; } await sleep(300); }
  return false;
}
async function scenario(name, failList, n503) {
  console.log("--- " + name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upg-")); root = OLD; fail = new Map(); served503 = [];
  const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: 412, height: 923 }, serviceWorkers: "allow" });
  const errs = []; const hook = (p) => { p.on("pageerror", (e) => errs.push("PAGEERR " + e.message.split("\n")[0])); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); }); };
  const page = await ctx.newPage(); hook(page);
  await page.goto(`http://localhost:${PORT}/Colonist/`); ok(await started(page), "old build starts");
  if (STATE) { const st = JSON.parse(fs.readFileSync(STATE, "utf8")); const ls = st.origins[0].localStorage; await page.evaluate((ls) => { for (const { name, value } of ls) localStorage.setItem(name, value); localStorage.setItem("colonist.lang", "nl"); }, ls); }
  await page.evaluate(() => navigator.serviceWorker.ready); await sleep(1500); await page.reload(); await started(page);
  const ver0 = await page.evaluate(async () => (await import("./src/themes/settings-ui.js")).APP_VERSION).catch(() => "?");
  console.log("  installed:", ver0, "controlled:", await page.evaluate(() => !!navigator.serviceWorker.controller));
  // deploy
  root = NEW; for (const f of failList) fail.set(f, n503 || 1); errs.length = 0;
  let allOk = true;
  for (let i = 1; i <= 5; i++) {
    errs.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {}); const s = await started(page, 15000); allOk = allOk && s;
    const v = s ? await page.evaluate(async () => (await import("./src/themes/settings-ui.js")).APP_VERSION).catch(() => "?") : "-";
    ok(s, `reload ${i}: game starts (v${v})`, s ? "" : errs.slice(0, 4)); if (s && NEWV && i === 5) ok(v === NEWV, "runs the new version " + NEWV, v);
    if (!s) { const msg = await page.evaluate(() => (document.getElementById("splashMsg") || {}).textContent).catch(() => ""); console.log("    splash:", msg, errs.slice(0, 3)); const b = await page.$("#splashReload"); if (b) { await b.click().catch(() => {}); await sleep(2500); const s2 = await started(page, 15000); ok(s2, "  after tapping Reload the game starts"); } }
    await sleep(i === 2 ? 3000 : 800);
  }
  console.log("  503s served:", served503.join(" ") || "none");
  const saved = await page.evaluate(() => (localStorage.getItem("colonist_review_v1") || "").length).catch(() => 0); if (STATE) ok(saved > 1000, "saved reviews (no ledger) still there", saved);
  await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
}
let PORT;
srv.listen(0, async () => {
  PORT = srv.address().port; const mods = jsModules(); const pick = () => mods[Math.floor(Math.random() * mods.length)];
  const only = process.env.ONLY;
  const sc = [["plain upgrade", [], 0], ["one random module 503 (once)", [pick()], 1], ["ui-icons.js 503 (once)", ["/src/themes/sunny/ui-icons.js"], 1], ["six modules 503 (once each)", [pick(), pick(), pick(), pick(), pick(), pick()], 1], ["sw.js 503 (once)", ["/sw.js"], 1], ["game.js 503 twice", ["/src/game.js"], 2]];
  for (const [n, f, c] of sc) { if (only && !n.includes(only)) continue; await scenario(n, f, c); }
  console.log(fails ? `FAILED ${fails}` : "ALL OK"); srv.close(); process.exit(fails ? 1 : 0);
});
