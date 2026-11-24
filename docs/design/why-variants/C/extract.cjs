// Extracts the "Waterval" data for every reviewed game from the REAL app model (src/post-model.js modelOf), headless Chromium.
//   S=<scratchpad> node extract.cjs   (server: node tests/serve.mjs $S/post199 8910)  ->  data/<id>.json
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const S = process.env.S, PORT = process.env.PORT || 8910, OUT = path.join(__dirname, "data");
fs.mkdirSync(OUT, { recursive: true });
const games = [];
for (const f of ["r1.json", "r2.json"]) { const j = JSON.parse(fs.readFileSync(`${S}/post199/tests/fixtures/post199/${f}`, "utf8")); games.push({ tag: f.replace(".json", ""), j }); }
const cdir = `${S}/calib199/tests/evals/calib199`;
for (const f of fs.readdirSync(cdir).filter((x) => x.endsWith(".json.gz")).sort()) games.push({ tag: f.replace(".json.gz", ""), j: JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, f)))) });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: "block" });
  const page = await ctx.newPage(); page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.addInitScript(() => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", "en"); });
  await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  const summary = [];
  for (const { tag, j } of games) {
    try {
      const { meta, format, v, calib, ...rec } = j;
      await page.evaluate(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec });
      await page.evaluate(() => window.__colonistGame.histOpen()); await page.waitForTimeout(700);
      await page.evaluate((id) => window.__colonistGame._histSheet(id), meta.id); await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector("[data-sact=review]").click());
      await page.waitForSelector(".rv .rv-tabs", { timeout: 40000 }); await page.waitForTimeout(1200);
      const out = await page.evaluate(async (me) => {
        const g = window.__colonistGame, M = await import("/src/post-model.js"), pid = me;
        const m = M.modelOf(g, pid); if (!m || !m.led) return { err: "no model/ledger" };
        const st = g._st, look = g._rvLook(), r0 = Math.round, awards = new Set((st.awards || []).map((q) => q.s));
        // per-step win chance swings of this seat (same as post-model swingsFor)
        const sw = look.steps.map((x) => { const s = st.steps[x.S - 1], b = r0(x.b[pid] * 100), a = r0(x.a[pid] * 100), e = r0(x.e[pid] * 100); const actor = s && s[1] >= 0 ? s[1] : null, roll = s ? s[2] + s[3] : null; return { S: x.S, T: st.turnOf[x.S], actor, roll, dice: a - b, move: actor === pid ? e - a : 0 }; }).filter((x) => x.actor != null && !awards.has(x.S));
        const L = m.led, luckSign = L.luck >= 0 ? 1 : -1;
        const rolls = sw.filter((x) => x.roll !== 7 && x.roll != null && Math.sign(x.dice) === luckSign).sort((p, q) => Math.abs(q.dice) - Math.abs(p.dice));
        const roll = rolls[0] ? { T: rolls[0].T, roll: rolls[0].roll, d: rolls[0].dice, mine: rolls[0].actor === pid } : null;
        // costliest real move (not a start pick): same numbers as Moves "Biggest misses"
        const mv = m.ds.filter((d) => d.k !== "setup" && d.cls !== "triv").sort((a, b) => b.gp - a.gp || a.i - b.i)[0];
        const move = mv && mv.gp >= 1 ? { T: mv.t, gp: mv.gp, cls: mv.cls, kind: mv.kind || M.kindOf(mv.x?.label), best: mv.bestKind || M.bestKindOf(mv.x?.best?.label), label: mv.x?.label, bestLabel: mv.x?.best?.label } : null;
        const picks = (m.start?.picks || []).map((p) => ({ n: p.n, win: p.win, best: p.best, gp: p.gp }));
        // the biggest own win-chance gain (a good move): the key-moment "move" component, for the README only
        const good = sw.filter((x) => x.move > 0).sort((a, b) => b.move - a.move)[0] || null;
        return { won: m.won, T: m.T, n: m.n, led: { from: L.from, setup: L.setup, moves: L.moves, luck: L.luck, rest: L.rest, to: L.to, total: L.total, perMove: L.perMove }, roll, move, picks, seatLuck: m.A.luck?.[pid]?.seat ?? null, goodMove: good && { T: good.T, d: good.move }, names: g.players.map((p) => p.name), seat: pid, score: m.seats.map((s) => s.p.victoryPoints) };
      }, meta.me ?? 0);
      out.tag = tag; out.id = meta.id; out.result = meta.result; out.pts = meta.pts;
      fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(out, null, 1));
      const l = out.led; const ok = out.led && l.from + l.setup + l.moves + l.luck + l.rest === l.to;
      summary.push(`${tag.padEnd(50)} ${out.won ? "W" : "L"} ${l?.from}${l.setup >= 0 ? "+" : ""}${l.setup}${l.moves >= 0 ? "+" : ""}${l.moves}${l.luck >= 0 ? "+" : ""}${l.luck}${l.rest >= 0 ? "+" : ""}${l.rest}=${l.to} sum ${ok ? "ok" : "BAD"} ${out.roll ? "roll" + out.roll.roll : "noroll"} ${out.move ? "move" + out.move.gp : "nomove"}`);
      await page.evaluate(() => window.__colonistGame._rvCloseReview?.(true));
    } catch (e) { summary.push(`${tag} ERR ${e.message.slice(0, 120)}`); await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); }
  }
  console.log(summary.join("\n")); await b.close();
})();
