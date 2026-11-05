// Shared helpers for the trade touch tests / investigation.
const path = require("path"), fs = require("fs"), http = require("http");
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
function serve(root, port) {
  const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html";
    fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); });
  return new Promise((res) => server.listen(port, () => res(server)));
}
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, "state.json"), "utf8"));
const RUSH = JSON.parse(fs.readFileSync(path.join(__dirname, "rush-state.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(browser, port, W, H, { state = STATE, palette = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(([saved, palette]) => {
    if (sessionStorage.getItem("__init")) return;
    sessionStorage.setItem("__init", "1");
    localStorage.clear();
    if (saved) for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
    if (palette) localStorage.setItem("colonist.palette", palette);
    localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist_sound", "off");
  }, [state, palette]);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  // v0.70: every launch opens on the home screen; Continue resumes the saved game
  if (await page.locator("[data-home='continue']").count()) { await page.locator("[data-home='continue']").click(); }
  await sleep(700);
  return { ctx, page, errors };
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
// Classic: human's main phase with the given hand
async function toMain(page, res) {
  await G(page, (res) => { const g = window.__colonistGame; const h = g.players.find((p) => p.isHuman);
    const R = ["wood", "brick", "sheep", "wheat", "ore"];
    // keep the 19-card totals: hand changes come from / go to the bank
    R.forEach((r) => { const want = res[r] ?? 0; g.bank[r] += h.resources[r] - want; h.resources[r] = want; });
    g.phase = "main"; g.render(); }, res);
  await sleep(300);
}
// Give the human a settlement on a port of the given type ("any" or a resource); returns the node id
async function givePort(page, type) {
  return G(page, (type) => { const g = window.__colonistGame; const h = g.players.find((p) => p.isHuman);
    const n = g.geometry.nodes.find((n) => n.ports && n.ports.includes(type) && n.structure == null && n.neighbors.every((x) => g.geometry.nodes[x].structure == null));
    if (!n) return null;
    n.owner = h.id; n.structure = "settlement"; h.settlements.add(n.id); g.render(); return n.id; }, type);
}
module.exports = { serve, open, G, toMain, givePort, sleep, STATE, RUSH };
