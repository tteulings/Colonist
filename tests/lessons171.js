// v1.71 Lessons on three real exports. node lessons171.js PORT [--real]   (--real: the Ask goes to the real endpoint, needs PORT 9978)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9800, real = process.argv.includes("--real"); let fails = 0;
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f);
const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lessons/shots";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  let calls = 0, body = null;
  page.on("request", (r) => { if (/api\/recap/.test(r.url()) && r.method() === "POST") { calls++; body = JSON.parse(r.postData()); } });
  if (!real) await page.route(/api\/recap/, (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } })
    : r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ explain: { answer: "Your robber moves often hit a weak spot. Aim at the leader's best number.", points: ["Block the 6 or 8 of the leader", "Check who holds many cards"], highlight: "none" } }) }));
  const tapHome = async () => { await G(() => window.__colonistGame.goHome()); await sleep(600); await page.locator("[data-home=lessons]").tap(); await sleep(900); };
  // 1 empty state (a clean profile has no reviewed game)
  await G(async () => { const h = window.__colonistGame.hist; await h.open(); for (const m of [...h.metas]) await h.remove(m.id, true); try { localStorage.removeItem("colonist_lessons_practice"); localStorage.removeItem("colonist_lessons_ask"); } catch (_) {} });
  const had = 0;
  if (!had) {
    await tapHome();
    ok(await G(() => /Lessons appear after you review games/.test(document.querySelector(".ln")?.innerText || "")), "empty state explains");
    await page.screenshot({ path: `${SH}/empty.png` });
    await page.locator("[data-lnpast]").tap(); await sleep(800);
    ok(await G(() => !!document.querySelector(".hs:not(.ln) .hs-bar h3") && !document.querySelector(".ln")), "empty state button opens Past games");
    await G(() => window.__colonistGame.histClose());
  } else console.log("skip empty state: profile has reviewed games", had);
  // 2 import (the first game gets a saved AI lesson, to see the titles)
  const exs = FILES.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  exs[0].rv.recap = { ...(exs[0].rv.recap || {}), text: "x", lang: "en", pid: 0, at: Date.now(), n: 1, recap: { lessonTitle: "Block the leader, not the neighbour", lessonKind: "robber", tip: "Put the robber on the best number of the player in front." } };
  for (const ex of exs) await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  // the expected counts, computed apart from the Lessons code: marked decisions of your review per move kind
  const exp = await G(async (exs) => {
    const { decide, rescoreReview } = await import("./src/review/evaluate.js");
    const kind = { setup: "setup", robber: "robber", build: "build", shipmove: "build", buy: "dev", play: "dev", bank: "trade", end: "timing" };
    const out = { n: {}, lost: {}, total: 0, meta: 0 };
    exs.forEach((ex) => { const r = ex.rv.reviews[ex.meta.me]; rescoreReview(r); out.meta += ["could", "mistake", "blunder", "missed"].reduce((a, k) => a + (ex.meta.cls?.[k] || 0), 0);
      decide(r.results.filter((x) => !x.skip || x.skip === "trivial"), ex.meta.n, ex.meta.me).forEach((d) => { if (["could", "mistake", "blunder", "missed"].includes(d.cls) && d.gp >= 1 && d.x.best) { const c = kind[d.k]; out.n[c] = (out.n[c] || 0) + 1; out.lost[c] = (out.lost[c] || 0) + d.gp; out.total++; } }); });
    return out;
  }, exs);
  console.log("expected", JSON.stringify(exp));
  await tapHome();
  await page.waitForSelector(".ln-cat", { timeout: 20000 }); await sleep(500);
  const cards = await G(() => [...document.querySelectorAll(".ln-cat")].map((e) => ({ id: e.dataset.lncat, name: e.querySelector("b").childNodes[0].textContent, text: e.innerText.replace(/\s+/g, " "), focus: e.classList.contains("focus") })));
  ok(cards.length === 6, "6 categories", cards.map((c) => c.id).join());
  const NAMES = ["Set-up placement", "Robber", "Building choice", "Development cards", "Trading", "Timing"];
  ok(NAMES.every((n) => cards.some((c) => c.name === n)), "category names");
  const shown = Object.fromEntries(cards.map((c) => [c.id, +(c.text.match(/(\d+) mistakes?/)?.[1] || 0)]));
  const lostShown = Object.fromEntries(cards.map((c) => [c.id, +(c.text.match(/−(\d+)% win chance/)?.[1] || 0)]));
  ok(Object.keys(shown).every((k) => shown[k] === (exp.n[k] || 0)), "mistake counts match the reviews", shown);
  ok(Object.keys(lostShown).every((k) => lostShown[k] === (exp.lost[k] || 0)), "win chance lost matches", lostShown);
  ok(exp.total === exp.meta, "total equals the games' own marked-move counts", [exp.total, exp.meta]);
  const lostOrder = cards.map((c) => lostShown[c.id]);
  ok(lostOrder.every((v, i) => !i || lostOrder[i - 1] >= v), "sorted by win chance lost", lostOrder);
  ok(cards[0].focus && cards.filter((c) => c.focus).length === 1 && /your focus/i.test(cards[0].text), "Your focus on the top one");
  ok(cards.some((c) => /Block the leader/.test(c.text)), "AI lesson title shown on its category");
  await page.screenshot({ path: `${SH}/lessons.png` });
  // 3 detail
  const cat = cards.find((c) => shown[c.id] > 0 && c.id !== "setup") || cards[0];
  await page.locator(`[data-lncat=${cat.id}]`).tap(); await sleep(500);
  const det = await G(() => ({ h: document.querySelector(".ln .hs-bar h3").innerText, rule: document.querySelector(".ln-rule p")?.innerText, ex: document.querySelectorAll(".ln-ex").length, ask: !!document.querySelector(".ln-ask"), chips: document.querySelectorAll(".ln-chip").length, train: !!document.querySelector("[data-lntrain]:not([disabled])") }));
  ok(det.h === cat.name && det.rule?.length > 40 && det.ex === Math.min(12, shown[cat.id]) && det.ask && det.chips >= 2 && det.train, "category detail: rule, examples, ask, train", det);
  await page.screenshot({ path: `${SH}/category.png` });
  // 4 an example opens the step view at that decision
  const first = await G(() => document.querySelector(".ln-ex .ln-exh small").innerText);
  await page.locator(".ln-ex").first().tap();
  await page.waitForSelector(".rv.step .rs-ab", { timeout: 40000 }); await sleep(900);
  const st = await G(() => ({ sub: document.querySelector(".rs-bar small")?.innerText || "", board: !!document.querySelector(".rs-board canvas"), why: !!document.querySelector("[data-exopen]"), ab: document.querySelectorAll(".rs-ab > div").length }));
  const turn = first.match(/Turn (\d+)/)?.[1];
  ok(st.board && st.ab >= 1 && (turn ? new RegExp(`Turn ${turn}\\b`).test(st.sub) : /Setup/.test(st.sub)), "example opens the step view at that turn", { first, ...st });
  await page.screenshot({ path: `${SH}/example.png` });
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(1500);
  ok(await G((n) => document.querySelector(".ln .hs-bar h3")?.innerText === n, cat.name), "back from the step view returns to the category");
  // 5 practice
  await page.locator("[data-lntrain]").tap();
  await page.waitForSelector(".rv.step.ln-q .ln-opt", { timeout: 40000 }); await sleep(1200);
  const q = await G(() => ({ opts: [...document.querySelectorAll(".ln-opt")].map((e) => e.innerText), hidden: getComputedStyle(document.querySelector(".rs-marks")).visibility, title: document.querySelector(".ln-pq h4").innerText, ctx: document.querySelector(".ln-ctx").innerText }));
  ok(q.opts.length >= 2 && q.opts.length <= 4 && new Set(q.opts).size === q.opts.length && q.title === "What would you do?" && q.hidden === "hidden", "practice question: 2-4 options, answer hidden", q);
  await page.screenshot({ path: `${SH}/practice-q.png` });
  const info = await G(() => { const g = window.__colonistGame; return { e: g._lnPr.e.x.best.label, b: g._lnPr.e.x.label }; });
  const wrongIdx = await G(() => window.__colonistGame._lnPr.opts.findIndex((o) => o.kind === "B"));
  await page.locator(`[data-lnpick="${wrongIdx}"]`).tap(); await sleep(1200);
  const a = await G(() => ({ res: document.querySelector(".ln-pa")?.className, txt: document.querySelector(".ln-pa")?.innerText.replace(/\s+/g, " "), rows: document.querySelectorAll(".ln-ol li").length, marks: getComputedStyle(document.querySelector(".rs-marks")).visibility, why: !!document.querySelector("[data-exopen]"), pr: JSON.parse(localStorage.getItem("colonist_lessons_practice") || "[]") }));
  ok(/ln-pa no/.test(a.res) && /Not quite/.test(a.txt) && a.rows >= 2 && a.marks === "visible" && a.why, "answer: marked incorrect, win chances, rings, Why?", a.txt);
  ok(a.pr.length === 1 && a.pr[0].ok === false && a.pr[0].cat === cat.id, "practice result stored", a.pr);
  await page.screenshot({ path: `${SH}/practice-a.png` });
  await page.locator("[data-lnnext]").tap(); await sleep(2500);
  ok(await G(() => !!document.querySelector(".rv.step.ln-q .ln-opt") || !!document.querySelector(".rv.step .ln-opt")), "next question shows a new question");
  const rightIdx = await G(() => window.__colonistGame._lnPr.opts.findIndex((o) => o.kind === "A"));
  await page.locator(`[data-lnpick="${rightIdx}"]`).tap(); await sleep(900);
  ok(await G(() => /Correct/.test(document.querySelector(".ln-pa")?.innerText || "")), "picking the better move is marked correct");
  await page.locator("[data-lndone]").tap(); await sleep(2500);
  const back = await G(() => ({ h: document.querySelector(".ln .hs-bar h3")?.innerText, t: document.querySelector(".ln-train")?.innerText.replace(/\s+/g, " ") }));
  ok(back.h === cat.name && /practised 2 · correct 1/.test(back.t), "Done returns to the category with practised 2 · correct 1", back);
  await G(() => document.querySelector("[data-lnback]").click()); await sleep(400);
  ok(await G((id) => /practised 2 · correct 1/.test(document.querySelector(`[data-lncat=${id}]`).innerText), cat.id), "category card shows practised / correct");
  // 6 ask
  await page.locator(`[data-lncat=${cat.id}]`).tap(); await sleep(400);
  const c0 = calls;
  await page.locator(".ln-chip").first().tap(); await page.waitForSelector(".ln-ans .ex-a", { timeout: 60000 }); await sleep(300);
  ok(calls === c0 + 1 && body.mode === "explain" && typeof body.facts === "string" && body.facts.length < 4000 && body.question === "How do I get better at this?" && /worstExamples/.test(body.facts), "ask posts explain with facts < 4k", { len: body.facts.length, lang: body.lang });
  const f = JSON.parse(body.facts); ok(f.category === cat.name && f.worstExamples.length === Math.min(3, shown[cat.id]) && f.worstExamples[0].better_A && f.rule, "facts: category, rule, worst examples with A/B", f.worstExamples[0]);
  await page.locator(".ln-ask").scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SH}/ask.png` });
  await page.locator(".ln-chip").first().tap(); await sleep(500);
  ok(calls === c0 + 1, "same question is answered from the cache");
  await G(() => Object.defineProperty(navigator, "onLine", { value: false, configurable: true })); await G(() => window.__colonistGame._lnDraw());
  ok(await G(() => !document.querySelector(".ln-ask")), "Ask hidden offline");
  ok(errors.length === 0, "no page errors", errors.join("|"));
  await b.close(); console.log(fails ? "FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
