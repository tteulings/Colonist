// v1.64 Why? on a real export. node explain164.js PORT EXPORT.json  (max 3 real calls)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9978, file = process.argv[3]; let fails = 0;
const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/explain/shots";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  let calls = 0; page.on("request", (r) => { if (/api\/recap/.test(r.url()) && r.method() === "POST") calls++; });
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  const info = await G(() => { const g = window.__colonistGame; const ds = g._rvDecisions(g._rvOf(g._rvPid).results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i)); return ds.filter((d) => d.k !== "setup" && !d.same && d.cls !== "triv").map((d) => ({ i: d.i, t: d.t, cls: d.cls, gap: d.gap, lab: d.x.label })); });
  console.log(info.filter((d) => d.t === 19).concat(info.sort((a, b) => b.gap - a.gap).slice(0, 2)));
  const pick = info.find((d) => d.cls === "mistake" || d.cls === "blunder") || info[0], t19 = info.find((d) => d.t === 19);
  const ask = async (i, chip, wait = 40000) => {
    await G((i) => window.__colonistGame._rvEnterStep(i), i); await page.waitForSelector(".rv.step [data-exopen], .rv.step [data-exform]", { timeout: 20000 }); await sleep(600);
    if (await page.locator("[data-exopen]").count()) await page.locator("[data-exopen]").tap(); await sleep(300);
    await page.locator(`[data-exq="${chip}"]`).tap();
    await page.waitForSelector(".ex-a, .ex-p .rc-err", { timeout: wait }); await sleep(900);
    return G(() => ({ a: document.querySelector(".ex-a")?.innerText, err: document.querySelector(".ex .rc-err")?.innerText, show: document.querySelector(".rv").dataset.show, pulse: document.querySelector(".rs-marks")?.getAttribute("class") }));
  };
  let r = await ask(pick.i, "Why is A better?"); console.log(r);
  ok(!!r.a, "answer shown (A better)", calls); await page.screenshot({ path: `${SH}/en-better.png` });
  const facts = await G((i) => { const g = window.__colonistGame; const ds = g._rvDecisions(g._rvOf(g._rvPid).results.filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i)); return import("/src/review/moment-facts.js").then((m) => m.momentFacts(g, ds.find((d) => d.i === i)).json); }, pick.i); console.log("FACTS", facts.length, facts);
  ok(facts.length < 4000, "facts < 4k");
  const c1 = calls; await G(() => window.__colonistGame._rvDrawReview()); await sleep(500);
  await page.locator("[data-exq='Why is A better?']").tap(); await sleep(1200);
  ok(calls === c1 && !!(await G(() => document.querySelector(".ex-a"))), "cached: no new call", calls);
  if (t19) { r = await ask(t19.i, "Why is this bad?"); console.log(r); ok(!!r.a, "answer turn-19", calls); await page.screenshot({ path: `${SH}/en-bad-t19.png` }); }
  // NL
  await G(() => { localStorage.setItem("colonist_recap_lang", "nl"); });
  const c2 = calls; await G((i) => window.__colonistGame._rvEnterStep(i), pick.i); await sleep(800);
  await page.screenshot({ path: `${SH}/nl-chips.png` });
  console.log("calls", calls); ok(calls <= 3, "max 3 calls");
  ok(errors.length === 0, "no page errors", errors.join("|"));
  await b.close(); console.log(fails ? "FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
