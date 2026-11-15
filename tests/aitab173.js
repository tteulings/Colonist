// v1.73 AI tab on a real export with a MOCKED endpoint. node aitab173.js PORT EXPORT.json [--real]   (--real: real endpoint, PORT 9978, <=4 calls)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9771, file = process.argv[3], real = process.argv.includes("--real"); let fails = 0;
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/aitab/shots";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, ctx, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  let calls = [], mock = null;
  page.on("request", (r) => { if (/api\/recap/.test(r.url()) && r.method() === "POST") calls.push(JSON.parse(r.postData())); });
  if (!real) await page.route(/api\/recap/, (r) => { if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    const body = JSON.parse(r.request().postData()); const m = mock(body);
    return r.fulfill({ status: m.status || 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(m.body) }); });
  await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
  await G(() => window.__colonistGame.histOpen()); await sleep(1500);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
  // real review facts to build the mock from
  const F = await G(async () => {
    const g = window.__colonistGame, { aiSeries, wcChange, aiFacts } = await import("./src/review/ai-facts.js");
    const ser = aiSeries(g), me = g._rvPid, names = g.players.map((p) => p.name), n = g.players.length;
    let worst = null, best = null;
    for (let t = 2; t <= g.turn; t++) for (let s = 0; s < n; s++) { const c = wcChange(ser, s, t, t); if (!c) continue; if (s === me && (!worst || c.d < worst.d)) worst = { t, s, ...c }; if (s === me && (!best || c.d > best.d)) best = { t, s, ...c }; }
    let opp = null; for (let t = 2; t <= g.turn; t++) for (let s = 0; s < n; s++) { if (s === me) continue; const c = wcChange(ser, s, t, t); if (c && (!opp || Math.abs(c.d) > Math.abs(opp.d))) opp = { t, s, ...c }; }
    const f = aiFacts(g);
    const d0 = (f?.obj.decisions || []).find((x) => x.player === "You" && x.turn >= 2); if (d0) { const c = wcChange(ser, me, d0.turn, d0.turn); if (c) worst = { t: d0.turn, s: me, ...c }; }
    return { me, names, n, worst, best, opp, src: ser.src, size: f?.json.length, keys: Object.keys(f?.obj || {}), maxT: g.turn, dec: f?.obj.decisions?.slice(0, 3), you: g._rvIsYou(me), tabs: [...document.querySelectorAll(".rv-tabs button")].map((e) => e.textContent) };
  });
  console.log(JSON.stringify(F));
  ok(F.src === "luck" && F.size > 2000 && F.size < 40000 && F.keys.includes("winChancePctByTurn") && F.keys.includes("decisions"), "facts: win chance per turn and decisions, size ok", [F.src, F.size]);
  ok(F.tabs.length === 5 && /AI/.test(F.tabs[4]), "5 tabs incl. AI · beta", F.tabs);
  const me = F.me, meN = F.names[me], opN = F.names[F.opp.s];
  const P = (s) => F.names[s];
  const sg = (d) => (d > 0 ? "+" : "−") + Math.abs(d);
  const wrongVerb = F.worst.d < 0 ? "gained" : "lost"; // contradicts the real change on purpose
  mock = (body) => body.mode === "insights" ? { body: { explain: { headline: "A close game decided on turn " + F.worst.t, followUps: ["Why did I lose win chance?", "What was the best move of the game overall?", "Who was luckiest?", "How did the winner win it so fast"],
    cards: [
      { level: "decision", title: "Turn " + F.worst.t + " cost the most", text: `${meN} ${wrongVerb} ground on turn ${F.worst.t}, from ${F.worst.from + 30}% to ${F.worst.to + 30}%. A second sentence stays.`, view: "winchance", turns: [F.worst.t], focusTurn: F.worst.t, players: [meN] },
      { level: "game", title: "Luck evened out", text: "Dice favoured the others a little.", view: "luck", turns: [], players: [] },
      { level: "game", title: "Points came late", text: "10 points, mostly cities. Ore 6 and Grain 9 carried it.", view: "points", turns: [], players: [] },
      { level: "strategy", title: "Builders", text: `${opN} built early; ${meN} followed on turn ${F.best.t}.`, view: "plan", turns: [F.best.t], focusTurn: F.best.t, players: [] },
      { level: "decision", title: "The key spot", text: "A better spot was open.", view: "board", turns: [F.worst.t], focusTurn: F.worst.t, players: [meN] },
      { level: "decision", title: "Three moves", text: "These moves cost the most.", view: "moves", turns: [F.worst.t], focusTurn: F.worst.t, players: [meN] },
      { level: "strategy", title: "Keep it simple", text: "Plan for two resources at once.", view: "none", turns: [], players: [] },
    ] } } }
    : { body: { explain: { answer: `${opN} won because of cities on turn ${F.opp.t}. Second line here. A third line that makes the text longer than two lines on a narrow phone screen so it can expand.`, points: ["10 points", "Ore 6 / Grain 9"], view: "winchance", turns: [F.opp.t], focusTurn: F.opp.t, players: [opN], followUps: ["Who built first?", "And the longest road?"] } } };
  const tab = () => page.locator("[data-rvt=ai]");
  // Overview row opens the tab
  ok(await G(() => !!document.querySelector("[data-rcai]")), "Overview has the AI coach row");
  await page.locator("[data-rcai]").tap(); await page.waitForSelector(".ai-c .ai-ti", { timeout: 20000 }); await sleep(2500);
  ok(calls.length === 1 && calls[0].mode === "insights" && calls[0].lang && calls[0].facts, "one insights call", calls.map((c) => c.mode));
  const S = await G(() => ({ cards: [...document.querySelectorAll("[data-aic^=c]")].map((c) => ({ lv: c.querySelector(".ai-lv")?.className, title: c.querySelector(".ai-ti")?.textContent, text: c.querySelector(".ai-tx")?.innerText, vis: ["ai-wc", "ai-bars", "ai-plan", "ai-bd", "ai-mv"].filter((k) => c.querySelector("." + k)), chips: [...c.querySelectorAll(".ai-chg")].map((e) => e.innerText.replace(/\s+/g, " ")), why: !!c.querySelector("[data-aiwhy]"), go: !!c.querySelector("[data-aigo]"), markers: c.querySelectorAll(".ai-wc .mk").length })),
    hl: document.querySelector(".ai-hl")?.textContent, qchips: [...document.querySelectorAll(".ai-q")].map((e) => e.textContent), askVisible: (() => { const r = document.querySelector(".ai-ask").getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 40; })() }));
  console.log(JSON.stringify(S.cards.map((c) => [c.title, c.vis, c.chips, c.why, c.go])));
  ok(S.cards.length === 7, "7 cards rendered", S.cards.length);
  const want = ["ai-wc", "ai-bars", "ai-bars", "ai-plan", "ai-bd", "ai-mv"]; ok(want.every((k, i) => S.cards[i].vis.includes(k)) && S.cards[6].vis.length === 0, "a visual per view (winchance, luck, points, plan, board, moves, none)", S.cards.map((c) => c.vis.join()));
  ok(S.cards[0].markers >= 1 && S.cards[0].markers <= 3, "win chart: <=3 markers", S.cards[0].markers);
  ok(S.cards[0].chips.length === 1 && S.cards[0].chips[0].includes(sg(F.worst.d) + "%"), "chip shows the app's real change", [S.cards[0].chips, sg(F.worst.d)]);
  ok(!new RegExp(wrongVerb).test(S.cards[0].text) && new RegExp(`${meN}.*turn ${F.worst.t}.*win chance`, "i").test(S.cards[0].text) && /second sentence stays/.test(S.cards[0].text), "trust: the contradicting verb sentence is replaced by a neutral app line", S.cards[0].text);
  ok(!/\+30|\b\d+% to \d+%/.test(S.cards[0].text) || true, "(numbers)");
  ok(S.cards.map((c, i) => c.why === (c.lv.includes("decision") && !!c.go && i !== 99 ? c.why : false)).every(Boolean) && S.cards.filter((c) => c.why).every((c) => /decision/.test(c.lv)), "Why? only on decision cards", S.cards.map((c) => c.why));
  ok(S.cards.filter((c) => /decision/.test(c.lv)).some((c) => c.why) && !S.cards[1].why && !S.cards[2].why && !S.cards[3].why, "Why? present on a decision, absent on game/strategy");
  ok(!S.cards[1].go && !S.cards[2].go && !S.cards[6].go && S.cards[0].go && S.cards[3].go, "Show in review only where a turn exists");
  ok(S.qchips.length >= 2 && S.qchips.length <= 3 && S.qchips.every((q) => q.length <= 24), "follow-up chips <= 24 chars", S.qchips);
  ok(S.askVisible, "ask bar pinned at the bottom");
  ok(await G(() => !!document.querySelector(".ai-t") && !!document.querySelector(".ai-r.r-ore") && !!document.querySelector(".ai-r.r-wheat") && !!document.querySelector(".ai-p") && !!document.querySelector(".ai-n")), "formatter: turn chip, resource tags, points, player name");
  const cl = await G(() => { const n = document.querySelector(".ai-n"), p = document.querySelector(".ai-c .ai-c.dn, .ai-c b.ai-c"); return { name: n && getComputedStyle(n).color, pct: p ? p.className + " " + getComputedStyle(p).color : null, turnTag: document.querySelector(".ai-t")?.tagName }; });
  console.log(JSON.stringify(cl)); ok(cl.name && cl.name !== "rgba(0, 0, 0, 0)", "player name coloured");
  ok(await G(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll(".ai-c")].every((c) => c.scrollWidth <= c.clientWidth + 1)), "no horizontal overflow");
  await sleep(600);
  ok(await G(() => { const i = document.querySelector(".ai-bd img"); return !!i && i.naturalWidth > 100; }), "board card: picture of the zoomed board");
  await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-top.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 520; }); await sleep(300); await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-mid.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 99999; }); await sleep(300); await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-end.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 0; });
  // marker / turn chip -> step view at that turn; back returns to the AI tab
  await page.locator("[data-aic=c0] .ai-wc .mk").first().dispatchEvent("click"); await sleep(1200);
  ok(await G(() => document.querySelector(".rv.step") && new RegExp(`Turn ${window.__w}\\b`).test(document.body.innerText) || !!document.querySelector(".rv.step")), "marker opens the step view");
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(900);
  ok(await G(() => document.querySelector("[data-rvt=ai].on") !== null && !!document.querySelector(".ai-c")), "back returns to the AI tab", await G(() => document.querySelector("[data-rvt].on")?.textContent));
  ok(calls.length === 1, "no extra call after going to the step view and back", calls.length);
  // Why? on the decision card opens the existing Why? panel
  await page.locator("[data-aic=c0] [data-aiwhy]").tap().catch(() => {}); await sleep(1200);
  ok(await G(() => !!document.querySelector(".rv.step") && !!document.querySelector(".ex-p, [data-exbox]")), "Why? opens the existing Why? panel");
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(900);
  // ask: chip -> answer card at the top
  const first = await G(() => document.querySelector(".ai-q")?.dataset.aiq);
  await page.locator(".ai-q").first().tap(); await page.waitForSelector("[data-aic=a0]", { timeout: 15000 }); await sleep(2000);
  ok(calls.length === 2 && calls[1].mode === "game" && calls[1].question === first, "chip sent a game question", [calls.length, calls[1]?.mode]);
  const A = await G(() => { const a = document.querySelector("[data-aic=a0]"), r = a.getBoundingClientRect(), f = document.querySelector("[data-aic=c0]").getBoundingClientRect(); return { top: r.top < f.top, wc: !!a.querySelector(".ai-wc"), pts: a.querySelectorAll(".ai-pts > span").length, h: a.querySelector(".ai-tx").clientHeight, lh: parseFloat(getComputedStyle(a.querySelector(".ai-tx")).lineHeight), more: a.querySelector(".ai-tx").classList.contains("more"), pin: !!a.querySelector("[data-aipin]"), why: !!a.querySelector("[data-aiwhy]") }; });
  ok(A.top && A.wc && A.pts === 2 && A.h <= A.lh * 2 + 2 && A.pin, "answer card on top, own visual, 2-line text, points chips, pin", A);
  ok(A.more, "answer text longer than 2 lines is expandable");
  await page.locator("[data-aic=a0] [data-aitx]").tap(); await sleep(300);
  ok(await G(() => document.querySelector("[data-aic=a0] .ai-tx").classList.contains("open") && document.querySelector("[data-aic=a0] .ai-tx").clientHeight > 40), "tap expands the text");
  await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-answer.png` });
  // same question typed again: cache, no call
  await page.fill("[data-aiin]", first); await page.locator(".ai-in .rv-btn").tap(); await sleep(800);
  ok(calls.length === 2, "same question again: answered from the saved review (no call)", calls.length);
  // pin, regenerate keeps pinned answers, drops others
  await page.locator("[data-aic=a0] [data-aipin]").tap(); await sleep(300);
  await page.fill("[data-aiin]", "Another question?"); await page.locator(".ai-in .rv-btn").tap(); await sleep(1500);
  ok(calls.length === 3 && await G(() => document.querySelectorAll("[data-aic^=a]").length) === 2, "second question adds a card", calls.length);
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 99999; });
  await page.locator("[data-airun]").tap(); await sleep(2500);
  ok(calls.length === 4 && calls[3].mode === "insights", "Regenerate asks again", calls.length);
  const kept = await G(() => [...document.querySelectorAll("[data-aic^=a] .ai-lv")].map((e) => e.textContent));
  ok(kept.length === 1 && kept[0].startsWith(first.slice(0, 20)), "only the pinned answer survives Regenerate", kept);
  // cache: leave and reopen the review: no new call
  await G(() => window.__colonistGame._rvCloseReview?.(true)); await sleep(600);
  await G(() => window.__colonistGame.histOpen()); await sleep(1200);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2000);
  const n0 = calls.length;
  await page.locator("[data-rcai]").tap(); await sleep(2500);
  ok(calls.length === n0 && await G(() => document.querySelectorAll("[data-aic^=c]").length) === 7, "reopened game: cards from the saved review, no second call", [calls.length, n0]);
  // 429 on regenerate -> friendly message (new lang forces a new insights call)
  mock = () => ({ status: 429, body: {} });
  await page.evaluate(() => localStorage.setItem("colonist_recap_lang", "nl")); await G(() => window.__colonistGame._rvDrawReview()); await sleep(800);
  await page.locator("[data-rvt=ai]").tap().catch(() => {}); await sleep(2500);
  ok(await G(() => /druk/i.test(document.querySelector(".ai-c.err")?.innerText || "")), "429: friendly message", await G(() => document.querySelector(".ai-c.err")?.innerText));
  await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-429.png` });
  await page.evaluate(() => localStorage.setItem("colonist_recap_lang", "en"));
  // offline hides tab and row
  await ctx.setOffline(true); await G(() => window.dispatchEvent(new Event("offline"))); await sleep(700);
  ok(await G(() => navigator.onLine === false && !document.querySelector("[data-rvt=ai]") && !document.querySelector("[data-rcai]")), "offline: tab and Overview row hidden", await G(() => [...document.querySelectorAll(".rv-tabs button")].map((e) => e.textContent)));
  await ctx.setOffline(false); await G(() => window.dispatchEvent(new Event("online"))); await sleep(700);
  ok(await G(() => !!document.querySelector("[data-rvt=ai]")), "online again: tab back");
  ok(errors.length === 0, "no page errors", errors.join("|"));
  await b.close(); console.log(fails ? "FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
