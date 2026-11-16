// v1.82 WHY from the engine's paired futures. node why182.js PORT EXPORT.json
// Pure parts (attribution, sentences, block, tool) run in node; the lazy / cached path runs in the app on the real export (the real worker).
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9611, file = process.argv[3]; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const W = await import("/home/user/Colonist/src/review/why-mc.js");
  const B = await import("/home/user/Colonist/src/review/ai-blocks.js");
  const RS = await import("/home/user/Colonist/src/review-reasons.js");
  // ── attribution on synthetic paired futures: A builds its 3rd settlement 2 turns earlier and wins more; "lost" is pure noise
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const fa = [], fb = [], va = [], vb = [];
  const base = (s3) => ({ s3, s4: s3 + 3, c1: 12, c2: 18, lr: 0, la: 0, lrT: 30, laT: 30, won: 0, dev: 2, lost: Math.round(rnd() * 6), bank: 3, port: 1, vp15: 6, vp20: 8, got10: 25 });
  for (let j = 0; j < 200; j++) { const t = 9 + Math.round((rnd() - 0.5) * 4), early = rnd() < 0.5 ? 0 : 1; fa.push(base(t - 2 + early)); fb.push(base(t)); const noise = (rnd() - 0.5) * 0.1; va.push(0.3 + 0.04 * (t - fa[j].s3) + noise); vb.push(0.3 + noise * 0.5); }
  const at = W.attribute(fa, fb, va, vb, { meta: { t0: 1, cp: [15, 20] } });
  ok(at.n === 200 && at.gap > 0.03, "attribution: n and the gap", [at.n, at.gap]);
  const r0 = at.reasons[0];
  ok(r0 && r0.feature === "s3" && r0.diff < -1 && Math.abs(r0.diff) > 2 * r0.se && r0.unit === "turn" && /3rd settlement about 2 turns earlier \(turn \d+ vs \d+\)\.$/.test(r0.text), "the real cause is found, typed, with se and the app sentence", r0);
  ok(!at.reasons.some((r) => r.feature === "lost" || r.feature === "bank"), "pure noise features are not reasons", at.reasons.map((r) => r.feature));
  const flat = W.attribute(fa.map((f) => ({ ...f, s3: 9 })), fb.map((f) => ({ ...f, s3: 9 })), va.map(() => 0.3), vb.map(() => 0.3));
  ok(flat.reasons.length === 0 && W.NO_REASON === "No single clear reason; the advantage is spread out.", "nothing significant: no reasons (the app says the advantage is spread out)");
  ok(/collected 1\.3 more Ore in the first 10 turns/.test(W.reasonSentence({ feature: "r_ore", a: 5.3, b: 4, diff: 1.3 }, { t0: 1 })) && /next 10 turns/.test(W.reasonSentence({ feature: "got10", a: 3, b: 2, diff: 1 }, { t0: 20 })), "sentences: resources and the window");
  // ── the explain request and the fold
  const x = { best: { label: "Settlement on Brick 6, Lumber 5" }, cands: [{}, {}] };
  const o = RS.rsnOpts(x, 15000);
  ok(o.explain && o.budget.only === x.best.label && o.budget.nPer === 200 && o.budget.timeMs === 15000, "explain request: 200 paired futures, A only, time cap", o);
  ok(RS.rsnOpts({ cands: [{}] }) === null && RS.rsnFold({ explain: { n: 5, reasons: [] } }) === null && RS.rsnFold({ explain: { n: 200, gap: 0.09, se: 0.03, ms: 1, reasons: [1, 2, 3, 4] } }).reasons.length === 3, "no run for a single move; a thin run is not kept; at most 3 reasons");
  // ── the block above the (collapsed) spots table
  const rsn = { n: 200, reasons: [{ feature: "dev", text: "With A you bought more development cards (4.4 vs 3.1).", a: 4.4, b: 3.1, diff: 1.3, se: 0.2, unit: "cards" }] };
  const xx = { label: "L", rsn, cands: [{ label: "L", win: 0.4 }, { label: "A", win: 0.5 }], best: { label: "A", gain: 0.1 } };
  const dm = { d: { x: xx }, seat: 0, turn: 3, gap: 0.1 };
  const env = { C: {}, game: null, g: null, ev: [], maxT: 30, seats: () => [0], decAt: () => dm, pos: () => null };
  const raw = [{ type: "board", turn: 3, player: "You" }, { type: "compare", turn: 3, player: "You", options: [] }, { type: "spots", turn: 3, player: "You" }];
  B.autoReasons(raw, env);
  ok(raw.map((b) => b.type).join() === "board,compare,reasons,spots", "reasons sit above the spots table", raw.map((b) => b.type));
  const one = B.aiBlocks([{ type: "reasons", turn: 3, player: "You" }], env);
  ok(one.length === 1 && one[0].type === "reasons" && one[0].rows.length === 1 && one[0].rows[0].a === 4.4 && !one[0].none, "block: rows from the stored run", one[0]);
  const none = B.aiBlocks([{ type: "reasons", turn: 3, player: "You" }], { ...env, decAt: () => ({ ...dm, d: { x: { ...xx, rsn: { n: 200, reasons: [] } } } }) });
  ok(none[0]?.none === true, "no reasons: the 'spread out' line");
  ok(B.aiBlocks([{ type: "reasons", turn: 3, player: "You" }], { ...env, decAt: () => ({ ...dm, d: { x: { ...xx, rsn: undefined } } }) }).length === 0, "not computed yet: no block");

  // ── in the app: lazy on first request, cached after, saved with the review, never recomputed
  const { b, ctx, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  const R = await G(async () => {
    const g = window.__colonistGame, { aiToolRun, aiDecList, aiSeatOf } = await import("./src/review/ai-tools.js");
    // data-driven: the first decision of "You" the engine can explain. The app offers a reason run for any real choice with a better move, but the
    // engine may call a setup spot "forced" (no usable run); then the next candidate is tried. Counts worker evaluate requests per attempt.
    const me = aiSeatOf(g, "You"), cand = aiDecList(g).filter((e) => e.seat === me && g._rsnCan(e.x, e.seat)); if (!cand.length) return { none: true };
    let calls = 0; const pp = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m) { if (m && m.type === "evaluate") calls++; return pp.apply(this, arguments); };
    let E0, A, before, r1, t1, c1, tried = 0;
    for (const e of cand.slice(0, 6)) {
      tried++; E0 = e; A = { turn: e.turn, player: "You", n: e.n }; before = aiToolRun(g, "get_decision", A); calls = 0;
      const t0 = performance.now(); r1 = await g._rsnTool(A); t1 = performance.now() - t0; c1 = calls; if (r1) break;
    }
    const r2 = await g._rsnTool(A); const c2 = calls;
    const after = aiToolRun(g, "get_decision", A);
    const x = g._rvOf(g._rvPid).results.find((y) => y.i === E0.x.i);
    Worker.prototype.postMessage = pp;
    const bk = g._aiVReasons({ rows: x.rsn.reasons, none: !x.rsn.reasons.length }, { lang: "en" });
    return { tried, before: before.reasons ?? null, r1, t1, c1, c2, same: r1 === r2, after: after.reasons, note: after.reasonsNote, saved: !!x.rsn, ver: x.rsn?.v, bk, bot: !!g._rv?.run };
  });
  ok(!R.none, "the game has an explainable decision of You");
  if (R.none) { await b.close(); console.log("1 FAILED"); process.exit(1); }
  ok(R.before == null, "before the first request there are no reasons (nothing computed during the review)");
  ok(R.r1 && R.r1.n >= 100 && Array.isArray(R.r1.reasons) && R.c1 === 1, "lazy: the first request ran ONE explain run on paired futures", [R.r1?.n, R.c1, Math.round(R.t1 / 100) / 10 + "s"]);
  ok(R.c2 === 1 && R.same, "cached: the second request reuses it (no new worker run)");
  ok(R.saved && R.ver === 1 && Array.isArray(R.after) && R.after.length === R.r1.reasons.length && R.after.every((r) => r.feature && r.text && r.unit != null && "se" in r), "get_decision returns the typed reasons", R.after);
  ok(/Base the WHY on reasons|no single clear reason/.test(R.note), "tool note: the why is based on reasons");
  ok(/class="ai-rsn"/.test(R.bk) && (R.r1.reasons.length ? /rs-v/.test(R.bk) : /spread out/.test(R.bk)), "the reasons block renders (rows with A vs B values, or the spread-out line)");
  console.log("reasons:", JSON.stringify(R.after));
  ok(errors.length === 0, "no page errors", errors.slice(0, 3));
  await b.close();
  console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
