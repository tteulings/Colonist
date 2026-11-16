// Opens the app in headless Chromium without a web server: requests to a fake origin are answered from the repo files.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open({ port = 9984, storageState } = {}) {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", ...(storageState ? { storageState } : {}) });
  await ctx.route(`http://localhost:${port}/**`, (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  return { b, ctx, page, errors };
}
module.exports = { open, sleep, ROOT };
