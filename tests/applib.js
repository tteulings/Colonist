// shared by verdict182 / why182 / aitab173 (replaces the lost scratchpad redesign/lib.js): opens the real app in a phone-sized Chromium on a fresh profile.
// The reviewed game those tests load is a committed fixture (tests/fixtures/post199/r1.json), not an upload.
const { chromium } = require("playwright"); const path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIX = path.join(__dirname, "fixtures", "post199");
async function open(port, { w = 390, h = 844, lang = "en" } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript((l) => { try { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); } catch (e) {} }, lang);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  return { b, ctx, page, errors };
}
module.exports = { open, sleep, FIX };
