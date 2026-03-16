/**
 * Takes a screenshot of the Colonist game after it has fully loaded.
 * Requires the app to be served over HTTP (ES modules don't load via file://).
 * Run: npm run serve (in one terminal), then npm run screenshot
 * Or: npm run screenshot -- --serve (starts server automatically)
 */

const path = require("path");
const fs = require("fs");
const http = require("http");
const url = require("url");

const PORT = 8765;
const URL = `http://localhost:${PORT}`;
const ROOT = path.join(__dirname, "..");
const SCREENSHOT_PATH = path.join(ROOT, "screenshots", "ux-overhaul-verify.png");

function createStaticServer() {
  const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
  return http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname || "/";
    let p = path.join(ROOT, pathname === "/" ? "index.html" : pathname.replace(/^\//, ""));
    p = path.normalize(p);
    if (!p.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const ext = path.extname(p);
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(URL, (r) => resolve()).on("error", reject);
      });
      return true;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function main() {
  let server;
  const startServer = process.argv.includes("--serve");
  if (startServer) {
    server = createStaticServer();
    server.listen(PORT, () => {});
    await new Promise((r) => setTimeout(r, 500));
    const ready = await waitForServer();
    if (!ready) {
      console.error("Server failed to start.");
      process.exit(1);
    }
  } else {
    const ready = await waitForServer();
    if (!ready) {
      console.error("Server not running. Start with: npm run serve");
      console.error("Or run: npm run screenshot -- --serve");
      process.exit(1);
    }
  }

  try {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-game-ready]", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500));
    fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    await browser.close();
    console.log("Screenshot saved to", SCREENSHOT_PATH);
  } finally {
    if (server && server.close) server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
