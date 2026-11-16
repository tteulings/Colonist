// v1.84 the board primitive of the dynamic AI page (src/review/ai-board.js): 3 real cases rendered at 360px, screenshots at 2x.
// node board184.js [PORT]   (serves the repo itself; exports: the three uploads of dynpage183; screenshots: $SHOTS)
const { chromium } = require("playwright"); const { spawn } = require("child_process"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 9980; let fails = 0;
const ROOT = path.resolve(__dirname, "..");
const SERVE = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/step105/tests/serve.mjs";
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f);
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/board184";
fs.mkdirSync(SH, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const srv = spawn("node", [SERVE, ROOT, String(port)], { stdio: "ignore" }); await sleep(600);
  const b = await chromium.launch(); let cases = {};
  try {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist.palette", "light"); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); });
    await page.goto(`http://localhost:${port}/`);
    await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const G = (f, a) => page.evaluate(f, a);
    for (let gi = 0; gi < FILES.length && Object.keys(cases).length < 3; gi++) {
      const ex = JSON.parse(fs.readFileSync(FILES[gi], "utf8"));
      await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
      await G(() => window.__colonistGame.histOpen()); await sleep(1500);
      await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
      await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
      await page.locator("[data-rvt=ai]").tap(); await sleep(2000);
      // pick the three cases of this game from the real decisions
      const found = await G(async () => {
        const g = window.__colonistGame, { aiDecList } = await import("./src/review/ai-tools.js"), { decMoves } = await import("./src/review/ai-blocks.js"), me = g._rvPid;
        const L = aiDecList(g).filter((e) => e.seat === me).map((e) => ({ e, mv: decMoves(e) })).filter((o) => o.mv?.played && o.mv.best);
        const rob = L.filter((o) => /^Robber/.test(o.mv.played.label) && o.mv.played.focus?.hex != null && o.mv.best.focus?.hex != null && o.mv.played.focus.hex !== o.mv.best.focus.hex).sort((a, b) => b.e.gap - a.e.gap)[0];
        const set = L.filter((o) => o.e.turn === 0 && o.mv.played.focus?.node != null && o.mv.best.focus?.node != null).sort((a, b) => b.e.gap - a.e.gap)[0];
        const pick = (o) => o && { turn: o.e.turn, i: o.e.d.i, played: o.mv.played.focus, best: o.mv.best.focus, gap: o.e.gap };
        window.__bd = { rob: pick(rob), set: pick(set), me };
        return window.__bd;
      });
      console.log("game", gi + 1, JSON.stringify(found));
      const shoot = async (name, spec) => {
        const r = await G(async ({ spec, name }) => {
          const g = window.__colonistGame, { renderBoardPrimitive, stateOfSpec } = await import("./src/review/ai-board.js"), d = spec.dI != null ? { i: spec.dI } : null; delete spec.dI;
          if (d) spec.d = d;
          const t0 = performance.now(), svg = renderBoardPrimitive(spec, g, { width: 328 }), ms = performance.now() - t0;
          document.getElementById("bdtest")?.remove();
          const w = document.createElement("div"); w.id = "bdtest"; w.style.cssText = "position:fixed;left:0;top:0;width:360px;padding:16px;box-sizing:border-box;background:#fff;z-index:99999"; w.innerHTML = svg; document.body.appendChild(w);
          const el = w.querySelector("svg").getBoundingClientRect(), S = stateOfSpec(g, spec);
          return { len: svg.length, ms, w: el.width, h: el.height, texts: [...w.querySelectorAll("text")].map((t) => t.textContent), pieces: S.nodes.filter((n) => n[0] != null).length, roads: S.edges.filter((e) => e[0] != null).length, robber: S.robber, label: w.querySelector("svg").getAttribute("aria-label") };
        }, { spec, name });
        await sleep(200); await page.locator("#bdtest").screenshot({ path: `${SH}/${name}.png` }); return r;
      };
      if (found.rob && !cases.rob) {
        const f = found.rob; // the robber now (before the move) -> where it went; where the review would have put it
        cases.rob = await shoot("1-robber", { dI: f.i, marks: [{ hex: f.played.hex, role: "played" }, { hex: f.best.hex, role: "better" }], arrows: [{ from: "robber", to: { hex: f.played.hex } }] });
      }
      if (found.set && !cases.set) { const f = found.set; cases.set = await shoot("2-setup-spot", { dI: f.i, marks: [{ node: f.played.node, role: "played" }, { node: f.best.node, role: "better" }], arrows: [{ from: { node: f.played.node }, to: { node: f.best.node } }] }); }
      if (!cases.net) cases.net = await shoot("3-network", { turn: 12, seats: [found.me], marks: [] });
      await G(() => { document.getElementById("bdtest")?.remove(); window.__colonistGame._rvClose?.(); });
      await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    }
    console.log(JSON.stringify(cases));
    ok(Object.keys(cases).length === 3, "all 3 cases rendered", Object.keys(cases));
    for (const [k, c] of Object.entries(cases)) {
      ok(c.w <= 360 && c.h >= 150 && c.h <= 380, `${k}: fits 360px (no horizontal overflow, sensible height)`, [c.w, c.h]);
      ok(c.ms < 60, `${k}: renders fast`, c.ms);
    }
    ok(cases.net && cases.net.pieces + cases.net.roads > 0, "network case has the player's pieces", cases.net);
    ok(errors.length === 0, "no page errors", errors);
  } finally { await b.close(); srv.kill(); }
  console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
