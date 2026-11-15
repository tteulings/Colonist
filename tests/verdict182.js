// v1.81 verdict class (clear / lean / close) + targeted refinement. node verdict182.js PORT EXPORT.json  (screenshots: $SHOTS)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9620, file = process.argv[3]; let fails = 0;
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/verdict";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  // ── pure: class computation ──
  const U = await G(async () => {
    const S = await import("./src/review/score.js"), mk = (loss, se, k = "build") => ({ k, loss, lossRaw: loss + (se || 0), best: { label: "Road on 1", se }, win: 0.5, cands: [{}, {}, {}], lead: 0 });
    const v = (loss, se) => S.vcOf(mk(loss, se));
    return { clear: v(0.07, 0.03), edge: v(0.06, 0.03), lean: v(0.05, 0.03), leanEdge: v(0.03, 0.03), close: v(0.02, 0.03), fbClear: v(0.06, null), fbLean: v(0.04, null), fbClose: v(0.02, null),
      cls: { mistake: S.clsOf(mk(0.09, 0.02)), mistakeNoisy: S.clsOf(mk(0.09, 0.06)), leanCould: S.clsOf(mk(0.04, 0.03)), closeCould: S.clsOf(mk(0.035, 0.05)), goodClose: S.clsOf(mk(0.02, 0.04)), goodClear: S.clsOf(mk(0.02, 0.01)), blunderNoisy: S.clsOf(mk(0.14, 0.09)) },
      mark: [S.markOfCls("lean"), S.markOfCls("close")], classes: S.CLASSES };
  });
  ok(U.clear === "clear" && U.edge === "clear" && U.lean === "lean" && U.leanEdge === "lean" && U.close === "close", "vcOf with se: >=2se clear, >=1se lean, else close", U);
  ok(U.fbClear === "clear" && U.fbLean === "lean" && U.fbClose === "close", "vcOf fallback without se: 6 / 3 points", U);
  ok(U.cls.mistake === "mistake" && U.cls.mistakeNoisy === "lean" && U.cls.blunderNoisy === "lean" && U.cls.leanCould === "lean" && U.cls.closeCould === "close" && U.cls.goodClose === "close" && U.cls.goodClear === "good", "clsOf: mistake/blunder words only when clear", U.cls);
  ok(U.mark[0] === "inacc" && U.mark[1] === "good" && U.classes.includes("lean") && U.classes.includes("close"), "marks and class list", U.mark);
  // ── a real export ──
  await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  const R = await G(async () => {
    const g = window.__colonistGame, S = await import("./src/review/score.js"), rv = g._rvOf(g._rvPid), out = { n: 0, bad: 0, fmt: rv.fmt, hasVc: rv.results.filter((x) => x.vc !== undefined).length, counts: {}, sevNotClear: 0, oldSame: 0 };
    rv.results.forEach((x) => { const c = S.clsOf(x); if (!c) return; out.n++; out.counts[c] = (out.counts[c] || 0) + 1; if (S.SEVERE.includes(c) && S.vcOf(x) !== "clear") out.sevNotClear++; });
    // old saved review: no vc, no fmt-5 stamp -> the class is computed from the stored values on load
    const copy = JSON.parse(JSON.stringify(rv.results)); copy.forEach((x) => { delete x.vc; });
    out.oldSame = copy.every((x, k) => S.clsOf(x) === S.clsOf(rv.results[k]));
    const old = { results: JSON.parse(JSON.stringify(rv.results)), fmt: 4 }; old.results.forEach((x) => { delete x.vc; delete x.lift0; delete x.lifted; });
    const E = await import("./src/review/evaluate.js"); E.rescoreReview(old); out.rescored = old.fmt === E.FMT && old.results.some((x) => x.vc != null);
    const ds = g._rvDecisions(rv.results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i));
    out.close = ds.find((d) => d.cls === "close" && d.k !== "setup")?.i ?? null; out.lean = ds.find((d) => d.cls === "lean" && d.k !== "setup")?.i ?? null; out.clear = ds.filter((d) => ["mistake", "blunder", "missed", "could"].includes(d.cls)).sort((a, b) => b.gap - a.gap)[0]?.i ?? null;
    out.closeAny = ds.find((d) => d.cls === "close")?.i ?? null;
    out.badCount = g._rvBadCount(g._rvPid); out.sum = E.summarize(rv.results).cls;
    return out;
  });
  console.log(JSON.stringify(R));
  ok(R.sevNotClear === 0, "no could/mistake/blunder/missed label without a clear verdict (real review)", R.counts);
  ok(R.oldSame && R.rescored, "old saved review (no vc): class computed on load; rescoreReview stores vc + fmt", [R.oldSame, R.rescored]);
  ok(R.badCount === (R.sum.lean || 0) + (R.sum.could || 0) + (R.sum.mistake || 0) + (R.sum.blunder || 0) + (R.sum.missed || 0), "mistake count = lean + clear classes (close does not count)", R.badCount);
  ok(R.close != null && R.clear != null, "export has a close and a clear decision (lean: " + R.lean + ")", [R.close, R.lean, R.clear]);
  // ── step view wording ──
  const step = async (i, shot) => {
    await G((i) => window.__colonistGame._rvEnterStep(i), i); await sleep(1200);
    if (shot) { await G(() => document.querySelector(".rs-card")?.scrollIntoView({ block: "start" })); await sleep(300); await page.screenshot({ path: `${SH}/${shot}.png` }); }
    return G(() => ({ head: document.querySelector(".rs-h")?.textContent || "", line: document.querySelector(".rs-s")?.textContent || "", a: document.querySelector(".rs-ab .a small")?.textContent || "", neu: !!document.querySelector(".rs-h em.neu"), neg: !!document.querySelector(".rs-h em.neg"), star: !!document.querySelector(".rs-h .rs-b.c-best"), rf: document.querySelector(".rs-rf")?.textContent || "", btn: !!document.querySelector("[data-rvrf]") }));
  };
  // deterministic: take the refinement off while we look at the unrefined cards
  await G(() => { window.__colonistGame._rv.rfFail = new Set(); const g = window.__colonistGame; g.__rfAuto = g._rfAutoOk; g._rfAutoOk = () => false; });
  const sc = await step(R.closeAny ?? R.close, "close-call-card");
  ok(/Close call/.test(sc.head) && !/mistake|blunder|Better/i.test(sc.head + sc.line) && /Other option/.test(sc.a) && sc.neu && !sc.neg, "close call card: wording, 'Other option', neutral cost", sc);
  ok(/about equal/.test(sc.line) && /close call/.test(sc.line) && !/mistake|blunder|better/i.test(sc.line), "close call line", sc.line);
  if (R.lean != null) { const sl = await step(R.lean, "lean-card");
    ok(/Slightly better/.test(sl.head) && /probably slightly better/.test(sl.line) && !/mistake|blunder/i.test(sl.head + sl.line), "lean card: slightly better / probably", sl); } else console.log("skip lean card (none in this export)");
  const sk = await step(R.clear, "clear-mistake-card");
  ok(/Could be better|Mistake|Blunder|Missed/.test(sk.head) && sk.neg && !sk.neu, "clear card keeps mistake wording + red cost", sk.head);
  // moves list + overview
  const L = await G(() => { const g = window.__colonistGame; g._rvStep = null; g._rvTab = "moves"; g._rvDrawReview(); const t = document.body.textContent; return { rows: [...document.querySelectorAll(".mv-r")].length }; });
  await G(() => { localStorage.setItem("colonist_review_moves", "all"); window.__colonistGame._rvDrawReview(); }); await sleep(500);
  const L2 = await G(() => ({ close: [...document.querySelectorAll(".mv-r.c-close")].map((e) => e.textContent), neu: document.querySelectorAll(".mv-r.c-close .mv-c.neu").length, lean: document.querySelectorAll(".mv-r.c-lean").length }));
  ok(L2.close.length && L2.close.every((t) => /Close call/.test(t) && !/mistake|blunder|better/i.test(t)) && L2.neu === L2.close.length, "Moves list: close call rows neutral, no negative words", L2.close.length);
  await G(() => localStorage.removeItem("colonist_review_moves"));
  // ── AI tab: tool, whiskers, gate ──
  const A = await G(async () => {
    const g = window.__colonistGame, T = await import("./src/review/ai-tools.js"), { aiBlocks } = await import("./src/review/ai-blocks.js");
    const es = T.aiDecList(g).filter((e) => e.seat === g._rvPid && e.x.best);
    const pick = (vc) => es.find((e) => e.d.vc === vc && (vc === "clear" || e.x.k !== "setup")), out = {};
    for (const vc of ["close", "lean", "clear"]) { const e = pick(vc); if (!e) continue; const r = T.aiToolRun(g, "get_decision", { turn: e.turn, player: "You", n: e.n }); out[vc] = { verdict: r.verdict, pm: r.plusMinusPct, better: r.better ?? null, other: r.otherOption ?? null, wording: r.wording, rating: r.rating, turn: e.turn, n: e.n }; }
    const idx = T.aiIndex(g).obj.reviewedDecisions; out.idx = idx.every((d) => d.verdict && (d.verdict === "close" ? d.otherOption && !d.better : d.better)); out.idxN = idx.length;
    // compare bars with whiskers and the class wording
    const C = { lang: "en", t: { better: "A better", mine: "your move", move: "move" } };
    const bar = (vc) => { const b = { seat: g._rvPid, bestIdx: 1, cost: 4, vc, options: [{ label: "Road on 3", v: 40, kind: "played", pm: 0, se: 0 }, { label: "City on 5", v: 44, kind: "best", pm: 0, se: 4 }] }; const d = document.createElement("div"); d.innerHTML = g._aiVCompare(b, C); return { wh: d.querySelectorAll("u.wh").length, star: d.textContent.includes("★"), tag: d.querySelector(".tg.best")?.textContent, pm: d.querySelector(".k-best b small")?.textContent, nz: !!d.querySelector(".ai-chg.nz") }; };
    out.bars = { clear: bar("clear"), lean: bar("lean"), close: bar("close") };
    // the wording gate on a free-text decision card
    const e = pick("close") || pick("lean"), vc = e?.d.vc; if (e) {
      const Cx = { lang: "en", decs: [{ seat: e.seat, turn: e.turn, d: e.d, gap: e.gap, own: true }], nmRaw: (s) => g.players[s].name }; g._aiDecAt = (T0, C, seats) => Cx.decs.find((x) => x.turn === T0) || null;
      const card = { focus: e.turn, level: "decision", dseats: null, fix: [], text: "That was a clear mistake and a costly blunder; the better move won." }; g._aiVcGate(card, Cx); out.gate = { vc, text: card.text, fix: card.fix };
      const card2 = { focus: e.turn, level: "decision", dseats: null, fix: [], text: "The other option was probably slightly better here." }; g._aiVcGate(card2, Cx); out.gate2 = vc === "lean" ? card2.text : null;
    }
    return out;
  });
  console.log(JSON.stringify(A));
  ok(A.close?.verdict === "close" && A.close.other && A.close.better === null && /NEVER mistake/.test(A.close.wording), "get_decision: close -> verdict, plusMinusPct, otherOption (no 'better')", A.close);
  ok((!A.lean || (A.lean.verdict === "lean" && A.lean.better && A.lean.pm >= 1 && /slightly better/.test(A.lean.wording))) && A.clear?.verdict === "clear" && A.clear.better && /may be called/.test(A.clear.wording), "get_decision: lean and clear", [A.lean, A.clear]);
  ok(A.idx && A.idxN > 0, "index: every reviewed decision carries its verdict");
  ok(A.bars.clear.wh === 1 && A.bars.clear.star && A.bars.clear.tag === "better" && A.bars.clear.pm === "±4", "compare bars: whisker + star + 'better' when clear", A.bars.clear);
  ok(A.bars.lean.wh === 1 && !A.bars.lean.star && A.bars.lean.tag === "slightly better", "compare bars: lean = 'slightly better', no star", A.bars.lean);
  ok(A.bars.close.wh === 1 && !A.bars.close.star && A.bars.close.tag === "other option" && A.bars.close.nz, "compare bars: close = 'other option', no star, neutral chip", A.bars.close);
  ok(A.gate && !/mistake|blunder|costly/i.test(A.gate.text) && (A.gate.vc !== "close" || !/better/i.test(A.gate.text)) && A.gate.fix.includes("vc"), "AI card gate: a close/lean decision never keeps mistake/blunder/better wording", A.gate);
  ok(A.gate2 == null || /slightly/.test(A.gate2), "AI card gate: 'slightly better' stays for lean", A.gate2);
  // ── refinement ──
  const F = await G(async () => {
    const g = window.__colonistGame, E = await import("./src/review/evaluate.js"), S = await import("./src/review/score.js"), rv = g._rvOf(g._rvPid);
    const x = rv.results.find((y) => { const v = S.vcOf(y); return (v === "lean" || v === "close") && g._rfCan(y); });
    if (!x) return { none: true };
    // pure: a fake refined run with a small se turns a lean into clear (and a big gap into close)
    const b = x.best.label, mkOut = (m, se) => ({ cands: x.cands.map((c, k) => (c.label === b && k ? { ...c, m, se, n: 400 } : c)) });
    const up = E.refineResult(x, mkOut(x.best.gain + 0.03, 0.01)), down = E.refineResult(x, mkOut(0.012, 0.02));
    return { i: x.i, before: { vc: S.vcOf(x), cls: S.clsOf(x), se: x.best.se, gap: S.gpOf(x) }, up: { vc: S.vcOf(up), cls: S.clsOf(up), refined: up.refined?.n, se: up.best.se }, down: { vc: S.vcOf(down), cls: S.clsOf(down) }, opts: E.refineOpts(x) };
  });
  console.log(JSON.stringify(F));
  ok(!F.none && F.up.vc === "clear" && F.up.refined === 400 && F.up.se === 0.01 && ["could", "mistake", "blunder"].includes(F.up.cls), "refineResult: lean -> clear with the smaller se, marked refined", F);
  ok((F.down.vc === "close" || F.down.vc === null) && ["close", "best", "good", null].includes(F.down.cls), "refineResult: a shrinking gap becomes close (or no real choice)", F.down);
  ok(F.opts?.budget?.nPer === 400 && F.opts.budget.only, "refine request: played move vs ONE alternative, 400 futures", F.opts);
  // the real engine: Standard lazily on open, with the state, the cap and the cache in the saved review
  await G(() => { const g = window.__colonistGame; g._rfAutoOk = g.__rfAuto; });
  const t0 = Date.now();
  const RR = await G(async (i) => {
    const g = window.__colonistGame, rv = g._rvOf(g._rvPid), x0 = rv.results.find((y) => y.i === i), before = JSON.stringify({ se: x0.best.se, n: x0.cands.find((c) => c.label === x0.best.label)?.n });
    g._rvEnterStep(i); await new Promise((r) => setTimeout(r, 400));
    const state1 = document.querySelector(".rs-rf")?.textContent || "";
    const t = performance.now(); const done = await g._rfRun(i); const ms = Math.round(performance.now() - t);
    const x1 = rv.results.find((y) => y.i === i), S = await import("./src/review/score.js");
    return { before, state1, done, ms, refined: x1.refined?.n, se: x1.best?.se, n: x1.cands.find((c) => c.label === x1.best?.label)?.n, vc: S.vcOf(x1), cls: S.clsOf(x1), wasVc: x1.refined?.was?.vc, rfMs: Math.round(rv.rfMs), saved: JSON.stringify(g._rvOf(g._rvPid).results.find((y) => y.i === i).refined || null).length > 4, again: await g._rfRun(i) };
  }, F.i);
  console.log(JSON.stringify(RR), "wall", Date.now() - t0);
  ok(/Refining/.test(RR.state1) || RR.done, "Standard: 'refining…' state while it runs", RR.state1);
  ok(RR.done && RR.refined === 400 && RR.n === 400 && RR.se > 0 && RR.again === false, "refined once with 400 futures, cached (not run twice)", RR);
  ok(RR.rfMs > 0 && RR.rfMs < 20000, "extra time counted against the cap (<20 s desktop)", RR.rfMs);
  const aft = await step(F.i, "refined-card"); ok(/Refined/.test(aft.rf) || !!aft.head, "step view after refinement", aft.rf);
  // Deep review: automatic, one after the other, until the cap
  const D = await G(async () => { const g = window.__colonistGame, S = await import("./src/review/score.js"), E = await import("./src/review/evaluate.js"), rv = g._rvOf(g._rvPid);
    rv.engId = E.engineId(1, "deep"); const left0 = rv.results.filter((x) => g._rfCan(x)).length, t = performance.now(), p = g._rfAuto(g._rvPid); if (p) await p;
    const left = rv.results.filter((x) => g._rfCan(x)).length; return { model: g._rfModel(), left0, left, ms: Math.round(performance.now() - t), cap: left === 0 || rv.rfMs > 18500, rfMs: Math.round(rv.rfMs), nRef: rv.results.filter((x) => x.refined).length }; });
  console.log(JSON.stringify(D)); ok(D.model === "deep" && (D.left0 === 0 || D.left < D.left0) && D.cap, "Deep review: close / lean decisions refined automatically, within the cap", D);
  console.log("errors", errors);
  ok(errors.length === 0, "no page errors", errors);
  await b.close();
  console.log(fails ? `FAILED ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
