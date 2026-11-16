// v1.56 step mode by turn on a real export; the decision and its turn are picked from the export itself (v1.84: nothing about one game is hardcoded). node turnview156.js PORT EXPORT.json
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9931, file = process.argv[3]; let fails = 0;
const SH = "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/turnview/shots2";
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  const snap = () => G(() => { const e = document.querySelector(".rv"); return { step: !!e?.classList.contains("step"), rows: [...document.querySelectorAll(".tv-row")].map((r) => r.innerText.replace(/\s+/g, " ")), open: [...document.querySelectorAll(".tv-row.open")].length, ab: !!document.querySelector(".rs-ab"), cards: document.querySelectorAll(".tv-card").length, sel: document.querySelector(".tv-card.on")?.innerText.replace(/\s+/g, " ") || "", eff: document.querySelector(".tv-eff")?.innerText || "", sub: document.querySelector(".rs-bar small")?.innerText || "" }; });
  // the reviewed player's decision with the biggest gap (a "Biggest slip"), and the turn it belongs to
  const pick = await G(() => { const g = window.__colonistGame, rv = g._rvOf(g._rvPid), res = (rv?.results || []).filter((x) => !x.skip || x.skip === "trivial").sort((a, b) => a.i - b.i), ds = g._rvDecisions(res).filter((d) => d.x?.best && d.k !== "setup" && (g._rcTurnOf?.(d) ?? d.t) >= 2).sort((a, b) => b.gap - a.gap); const d = ds[0]; return d ? { i: d.i, turn: g._rcTurnOf?.(d) ?? d.t } : null; });
  ok(!!pick, "the export has a decision to open", pick); if (!pick) { await b.close(); process.exit(1); }
  await G((i) => window.__colonistGame._rvEnterStep(i), pick.i); await page.waitForSelector(".rv.step .tv-row", { timeout: 30000 }).catch(async () => { console.log("ERRS", errors.join(" | "), await G(() => ({ rv: document.querySelector(".rv")?.className, st: window.__colonistGame._rvStep, pid: window.__colonistGame._rvPid, ds: window.__colonistGame._rvOf?.(window.__colonistGame._rvPid)?.results?.length }))); }); await sleep(800);
  let s = await snap(); ok(s.step && s.cards > 0, "step mode shows turn cards", s.cards);
  ok(s.open === 1 && s.ab, "from a move: your row is open and the A/B card is there", s);
  ok(new RegExp(`Turn ${pick.turn}\\b`).test(s.sub), `turn ${pick.turn} (the decision's own turn)`, s.sub); console.log(s.rows.join("\n"), "\n", s.eff);
  await page.screenshot({ path: `${SH}/from-move.png` });
  await page.locator(".tv-row.me .tv-h").tap(); await sleep(600);
  s = await snap(); ok(s.open === 0 && !s.ab, "tap your row again: closed, turn overview, same turn", s); await page.screenshot({ path: `${SH}/overview.png` });
  await page.locator(".tv-row.me .tv-h").tap(); await sleep(500);
  const sub0 = (await snap()).sub; await page.locator("[data-tvgo='-1']").tap(); await sleep(900);
  s = await snap(); { const idx = (x) => { const m = /Turn (\d+) · (\d+) of (\d+)/.exec(x || ""); return m ? { t: +m[1], k: +m[2] } : null; }, was = idx(sub0), now = idx(s.sub); ok(was && now && now.k === was.k - 1 && now.t < was.t, `previous turn is one step back (step ${was?.k} -> ${now?.k}, turn ${was?.t} -> ${now?.t})`, s.sub); }
  await page.locator("[data-tvkey]").tap().catch(() => {}); await sleep(900);
  s = await snap(); console.log("after key:", s.sub, s.sel);
  await page.locator(".tv-row.me .tv-h").tap(); await sleep(600);
  const d = await G(() => document.querySelector(".tv-dec")?.dataset.tvd); if (d) { await page.locator(".tv-dec").first().tap(); await sleep(800); s = await snap(); ok(s.ab && s.open === 1, "tap a decision in the row: its A/B card", s.sub); }
  await page.screenshot({ path: `${SH}/t-key.png` });
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(800);
  ok(await G(() => !document.querySelector(".rv.step")), "back leaves step mode in one level");
  await G((i) => window.__colonistGame._rvEnterStep(i), pick.i); await sleep(800); await page.locator("[data-rvallmoves]").first().tap(); await sleep(700);
  ok(await G(() => !document.querySelector(".rv.step")), "All moves still there");
  ok(errors.length === 0, "no page errors", errors.join("|"));
  await b.close(); console.log(fails ? "FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
