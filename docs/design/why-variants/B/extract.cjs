// Extracts, per real reviewed game, the data of "Verhaal in drie fasen" (variant B), by running the app's own analysis in headless Chromium.
//   node extract.cjs OUT.json LANG GAMEFILE[,GAMEFILE...]   env: APP (post199 checkout root), PORT (served with: node tests/serve.mjs $APP $PORT)
// GAMEFILE = tests/fixtures/post199/*.json or calib199 *.json.gz (export format { meta, state, rv }).  pid = meta.me (seat 0 in the fixtures).
const { chromium } = require("/opt/node-tools/node_modules/playwright"); const fs = require("fs"), zlib = require("zlib"), path = require("path");
const [out, lang, files] = [process.argv[2], process.argv[3] || "nl", (process.argv[4] || "").split(",")]; const PORT = +process.env.PORT || 8900;
const read = (f) => JSON.parse(f.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(f)) : fs.readFileSync(f, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), res = [];
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  const page = await ctx.newPage(); page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.addInitScript((l) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); }, lang);
  await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  for (const f of files) {
    const j = read(f); const { meta, format, v, calib, ...rec } = j;
    await page.evaluate(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec });
    await page.evaluate(async () => window.__colonistGame.histOpen()); await sleep(800);
    await page.evaluate((id) => window.__colonistGame._histSheet(id), meta.id); await sleep(500);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 });
    await page.evaluate(() => { const g = window.__colonistGame; g._rvTab = "overview"; g._rvDrawReview(); });
    try { await page.waitForSelector(".px-verdict", { timeout: 30000 }); } catch (_) { console.error("no verdict for", f); }
    const data = await page.evaluate(async (PID) => {
      const g = window.__colonistGame, PM = await import("/src/post-model.js"), UI = await import("/src/post-ui.js");
      const pid = PID != null ? PID : PM.soloPid(g), m = PM.modelOf(g, pid); if (!m) return null; const tl = m.timeline; if (!tl) return null;
      const line = tl.lines[pid], T = tl.T, nm = (q) => g.players[q]?.name;
      const cand = [...tl.pins, ...(tl.all || [])].filter((x, i, a) => a.findIndex((q) => q.S === x.S) === i);
      const phases = tl.phases.map((p) => {
        let i0 = 0; line.forEach((q, i) => { if (q[0] <= p.from - 1) i0 = i; }); const pts = line.filter((q, i) => i >= i0 && q[0] <= p.to), v0 = pts[0][1], v1 = pts[pts.length - 1][1];
        const mk = (x) => { const mo = PM.momentFor(g, m, x), dice = x.a - x.b, after = x.e - x.a, mv = x.move ? after : 0;
          return { T: x.T, S: x.S, d: x.d, actor: x.actor, mine: x.actor === pid, move: mv, dice, rest: after - mv, k: mo.k, what: mo.what, text: UI.causeText(m, mo).replace(/<[^>]*>/g, "") }; };
        const inP = cand.filter((x) => x.T >= p.from && x.T <= p.to).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)), cands = inP.map(mk), mom = cands[0] || null;
        return { k: p.k, from: p.from, to: p.to, v0: Math.round(v0 * 100), v1: Math.round(v1 * 100), pts: pts.map((q) => [q[0], Math.round(q[1] * 1000) / 10]), mom, cands, n: inP.length };
      });
      return { id: g._rvGameId || null, pid, name: nm(pid), you: !!m.you, won: !!m.won, T, pts: g.players.map((p) => p.victoryPoints), names: g.players.map((p) => p.name), bots: g.players.map((p) => !p.isHuman), start: Math.round(line[0][1] * 100), end: Math.round(line[line.length - 1][1] * 100), phases, pins: tl.pins.map((p) => ({ n: p.n, T: p.T, d: p.d })), nAll: (tl.all || []).length, headline: (document.querySelector(".px-hl2")?.innerText || "") };
    }, process.env.PID != null && process.env.PID !== "" ? +process.env.PID : null);
    res.push({ file: path.basename(f), meta: { id: meta.id, me: meta.me, result: meta.result, turns: meta.turns, n: meta.n }, lang, data });
    await page.evaluate(() => { try { window.__colonistGame.histOpen(); } catch (_) {} }); await sleep(300);
  }
  await b.close(); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log("wrote", out, res.length);
})().catch((e) => { console.error(e); process.exit(1); });
