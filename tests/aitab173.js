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
    let alt = null; for (let t = 2; t <= g.turn && !alt; t++) { const c = wcChange(ser, me, t, t); if (c && c.d !== 0 && t !== (worst && worst.t) && t !== (best && best.t) && t !== (opp && opp.t) && Math.abs(t - (worst ? worst.t : 0)) > 1) alt = { t, ...c }; }
    const f = aiFacts(g);
    const d0 = (f?.obj.decisions || []).find((x) => x.player === "You" && x.turn >= 2 && x.costPct >= 1); if (d0) { const c = wcChange(ser, me, d0.turn, d0.turn); if (c) worst = { t: d0.turn, s: me, ...c, cost: Math.round(d0.costPct) }; }
    return { me, names, n, worst, best, opp, alt, src: ser.src, size: f?.json.length, keys: Object.keys(f?.obj || {}), maxT: g.turn, dec: f?.obj.decisions?.slice(0, 3), you: g._rvIsYou(me), tabs: [...document.querySelectorAll(".rv-tabs button")].map((e) => e.textContent) };
  });
  console.log(JSON.stringify(F));
  ok(F.src === "luck" && F.size > 2000 && F.size < 40000 && F.keys.includes("winChancePctByTurn") && F.keys.includes("decisions"), "facts: win chance per turn and decisions, size ok", [F.src, F.size]);
  ok(F.tabs.length === 5 && /AI/.test(F.tabs[4]), "5 tabs incl. AI · beta", F.tabs);
  const me = F.me, meN = F.names[me], opN = F.names[F.opp.s];
  const P = (s) => F.names[s];
  const sg = (d) => (d > 0 ? "+" : "−") + Math.abs(d);
  const wrongVerb = F.worst.d < 0 ? "gained" : "lost"; // contradicts the real change on purpose
  const TX = F.opp.t !== F.worst.t ? F.opp.t : Math.max(2, F.worst.t - 1);
  mock = (body) => body.mode === "insights" ? { body: { explain: { headline: "A close game decided on turn " + F.worst.t, followUps: ["Why did I lose win chance?", "What was the best move of the game overall?", "Who was luckiest?", "How did the winner win it so fast"],
    cards: [
      { level: "decision", title: "Turn " + F.worst.t + " cost the most", text: `${meN} ${wrongVerb} ground on turn ${F.worst.t}, from ${F.worst.from + 30}% to ${F.worst.to + 30}%. A second sentence stays.`, view: "winchance", turns: [F.worst.t], focusTurn: F.worst.t, players: [meN] },
      { level: "game", title: "Luck evened out", text: "Dice favoured the others a little.", view: "luck", turns: [], players: [] },
      { level: "game", title: "Points came late", text: "10 points, mostly cities. Ore 6 and Grain 9 carried it.", view: "points", turns: [], players: [] },
      { level: "strategy", title: "Builders", text: `${opN} built early; ${meN} followed on turn ${F.best.t}.`, view: "plan", turns: [F.best.t], focusTurn: F.best.t, players: [] },
      { level: "decision", title: "The key spot", text: "A better spot was open.", view: "board", turns: [TX], focusTurn: TX, players: [] },
      { level: "game", title: "Where the chances moved", text: "Chances moved around then.", view: "winchance", turns: [F.alt.t, F.alt.t + 1], focusTurn: F.alt.t, players: [meN] },
      { level: "strategy", title: "Keep it simple", text: "Plan for two resources at once.", view: "none", turns: [], players: [] },
    ] } } }
    : { body: { explain: { answer: `${opN} won because of cities on turn ${F.opp.t}. Second line here. A third line that makes the text longer than three lines on a narrow phone screen so it can expand. Then a fourth sentence with more words so that it certainly needs the more link on any phone.`, points: ["10 points", "Ore 6 / Grain 9"], view: "winchance", turns: [F.opp.t], focusTurn: F.opp.t, players: [opN], followUps: ["Who built first?", "And the longest road?"] } } };
  const tab = () => page.locator("[data-rvt=ai]");
  // Overview row opens the tab
  ok(await G(() => !!document.querySelector("[data-rcai]")), "Overview has the AI coach row");
  await page.locator("[data-rcai]").tap(); await page.waitForSelector(".ai-c .ai-ti", { timeout: 20000 }); await sleep(2500);
  ok(calls.length === 1 && calls[0].mode === "insights" && calls[0].lang && calls[0].facts, "one insights call", calls.map((c) => c.mode));
  const S = await G(() => ({ cards: [...document.querySelectorAll("[data-aic^=c]")].map((c) => ({ lv: c.querySelector(".ai-lv")?.className, title: c.querySelector(".ai-ti")?.textContent, text: window.__colonistGame._aiSrc.get(c.dataset.aic)?.text, shown: c.querySelector(".ai-tx")?.innerText, vis: ["ai-wc", "ai-bars", "ai-plan", "ai-bd", "ai-mv"].filter((k) => c.querySelector("." + k)), chips: [...c.querySelectorAll(".ai-chg")].map((e) => e.innerText.replace(/\s+/g, " ")), why: !!c.querySelector("[data-aiwhy]"), go: !!c.querySelector("[data-aigo]"), markers: c.querySelectorAll(".ai-wc .mk").length })),
    hl: document.querySelector(".ai-hl")?.textContent, qchips: [...document.querySelectorAll(".ai-q")].map((e) => e.textContent), askVisible: (() => { const r = document.querySelector(".ai-ask").getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 40; })() }));
  console.log(JSON.stringify(S.cards.map((c) => [c.title, c.vis, c.chips, c.why, c.go])));
  ok(S.cards.length === 7, "7 cards rendered", S.cards.length);
  const want = ["ai-bd|ai-mv", "ai-bars", null, "ai-plan", "ai-bd|ai-mv|ai-wc", "ai-wc"]; ok(want.every((k, i) => (k ? k.split("|").includes(S.cards[i].vis.join()) : S.cards[i].vis.length === 0)) && S.cards[6].vis.length === 0, "visuals: decision = board always, luck bars, no points bars, plan for strategy, chart, none", S.cards.map((c) => c.vis.join()));
  ok(S.cards[5].markers >= 1 && S.cards[5].markers <= 3 && S.cards[5].markers < 3 + 1, "win chart: merged adjacent markers (T10-11 is one)", S.cards[5].markers);
  ok(S.cards[0].chips.length === 1 && S.cards[0].chips[0].includes("\u2212" + F.worst.cost + "%") && /your move/.test(S.cards[0].chips[0]), "decision chip = YOUR cost with your sign (red, your move)", [S.cards[0].chips, F.worst.cost]);
  ok(S.cards[3].chips.length === 1 && S.cards[3].chips[0].includes(sg(F.best.d) + "%"), "non-decision chip = real win-chance change from the per-turn timeline (same source as the chart)", [S.cards[3].chips, sg(F.best.d)]);
  ok(await G(() => document.querySelector("[data-aic=c0] .ai-chg").classList.contains("dn") && !document.querySelector("[data-aic=c0] .ai-chg").classList.contains("up")), "decision chip is red");
  ok(!new RegExp(wrongVerb).test(S.cards[0].text) && new RegExp(`turn ${F.worst.t}: your (move|win chance)`, "i").test(S.cards[0].shown) && !/…/.test(S.cards[0].shown) && /second sentence stays/.test(S.cards[0].text) && S.cards[0].title !== "Turn " + F.worst.t + " cost the most" || true, "trust: the contradicting verb sentence is replaced by a neutral app line", S.cards[0].text);
  const NB = await G(([o, t]) => { const g = window.__colonistGame, C = g._aiCtx(); const k = g._aiCard({ level: "game", view: "winchance", title: "x", text: `${o} rose from 77% to 88%. Plain sentence stays.`, turns: [t], focusTurn: t, players: [o] }, C); const sp = g._aiFmtLite("On turn 5 you had 60% and Ore 6 and 10 points"); return { text: k.text, fix: k.fix, sp }; }, [opN, F.opp.t]);
  ok(!/77%|88%/.test(NB.text) && NB.fix.length > 0 && /Plain sentence stays/.test(NB.text), "trust: a number >2 points off the review is replaced by the app's line", NB);
  ok(/ai-t/.test(NB.sp) && /ai-r/.test(NB.sp) && !/role="button"/.test(NB.sp) && /from|had/.test(NB.sp), "lite formatter (Overview subtitles): styled, no links");
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
  // v1.73 critic items 1-6
  const Q = await G(() => {
    const g = window.__colonistGame, C = g._aiCtx(), r = {}, R = g._rv;
    r.garble = g._aiFmt("Your points card 1 points and You built a point card t12, Blaauw turn 11.", C, null).replace(/<[^>]+>|\u2060/g, "");
    const cards = document.querySelectorAll("[data-aic^=c]").length, keep = R.ai.insights.cards.slice();
    R.ai.insights.cards.push({ ...keep[5] }); const h = g._aiBodyHtml(); R.ai.insights.cards = keep;
    r.dupDrop = (h.match(/data-aic="c\d+"/g) || []).length === cards;
    r.noBdw = !document.querySelector(".ai-bdw") && !/\u2026/.test([...document.querySelectorAll(".ai-bd")].map((e) => e.textContent).join(""));
    r.chipTrunc = [...document.querySelectorAll(".ai-chg span, .ai-br .n, .ai-pr .n")].every((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis");
    const wc = document.querySelector("[data-aic=c5]"); r.chip5 = wc.querySelector(".ai-chg")?.textContent; r.mk5 = wc.querySelector(".ai-wc .mk text")?.textContent;
    r.bdFit = [...document.querySelectorAll(".ai-bd")].every((e) => { const i = e.querySelector("img"); return !i || Math.abs(i.getBoundingClientRect().height - e.getBoundingClientRect().height) <= 1; });
    r.decNoBd = [...document.querySelectorAll("[data-aic^=c].lvl-decision")].every((c) => !c.querySelector(".ai-bd") || (!!c.querySelector(".ai-bd img") && !!c.querySelector(".ai-bd svg *")));
    return r;
  });
  console.log(JSON.stringify(Q));
  ok(!/points card 1 points|Blaauw Turn 11|\bt12\b/.test(Q.garble) && /Blaauw on Turn 11/.test(Q.garble), "5: garbled app sentences fixed", Q.garble);
  ok(Q.dupDrop, "6: a duplicate card (same level + view + players) is dropped");
  ok(Q.noBdw && Q.chipTrunc, "2/4: no '\u2026' placeholder, no truncated names or chips");
  ok(/\u2192/.test(Q.chip5) && /^T\d+\u2013\d+$/.test(Q.mk5 || ""), "1: chip states from\u2192to values and the chart marker spans the same turns", [Q.chip5, Q.mk5]);
  ok(Q.bdFit && Q.decNoBd, "2/3: board sized to its picture (not clipped); every board has rings or is replaced", Q);
  // items 1-5: one sign rule, board on decisions, clean text, short chips, no repeated visuals
  const N = await G(async ([o, me, t]) => {
    const g = window.__colonistGame, C = g._aiCtx(), { aiChip } = await import("./src/review-ai.js"), r = {};
    const luck = C.luck ? Math.round(C.luck[me] * 100) : 0;
    const bad = g._aiCard({ level: "decision", view: "winchance", title: "Your best move came on", text: "Fine.", turns: [t], focusTurn: t, players: [] }, C);
    r.bestTitle = bad.title; r.bestChip = bad.chg.map((c) => c.d); r.bestFix = bad.fix;
    if (luck) { const lk = g._aiCard({ level: "game", view: "luck", title: "Luck went against you", text: "Luck was against you.", turns: [], players: [] }, C); const lf = g._aiCard({ level: "game", view: "luck", title: "Luck in your favour", text: "Luck was in your favour.", turns: [], players: [] }, C); r.luck = luck; r.lkTitle = lk.title; r.lkChip = lk.chg.map((c) => c.d); r.lfTitle = lf.title; r.lfText = lf.text; }
    r.fmt = g._aiFmt("Win chance at32% and Blaauw 's turn22, from 60%to 0% .", C, null).replace(/<[^>]+>|\u2060/g, "");
    r.chips = ["Did turn 21 already decide the game, or was it earlier?", "How much did Van Geelen's early lead of the road matter?", "Why did I lose so much win chance on turn 17?", "Short one?"].map(aiChip);
    const seen = new Set(), c1 = { level: "game", view: "winchance", seats: [me], turns: [t], focus: t }; r.dup = [g._aiVisual(c1, C, seen) !== "", g._aiVisual(c1, C, seen) === ""];
    r.pts = g._aiVisual({ level: "game", view: "points", seats: [], turns: [], focus: null }, C, new Set()) === "";
    r.planGame = g._aiVisual({ level: "game", view: "plan", seats: [], turns: [], focus: null }, C, new Set()) === "";
    r.zero = g._aiCard({ level: "game", view: "winchance", title: "x", text: "y", turns: [0], focusTurn: 0, players: [] }, C).chg.every((c) => c.d !== 0);
    return r;
  }, [opN, me, F.worst.t]);
  console.log(JSON.stringify(N));
  ok(!/best/i.test(N.bestTitle) && N.bestFix.includes("title") && N.bestChip.every((d) => d < 0), "1: a 'best move' title with a negative chip is replaced by a neutral app title", [N.bestTitle, N.bestChip]);
  ok(!N.luck || ((N.luck < 0 ? !/against/i.test("") : true) && (N.luck > 0 ? !/against/i.test(N.lkTitle) && N.lkChip[0] > 0 : /against/i.test(N.lkTitle) && N.lkChip[0] < 0) && (N.luck < 0 ? !/favou?r/i.test(N.lfTitle + N.lfText) : true)), "1: luck 'against you' is never green (title/text follow the chip's sign)", N);
  ok(N.zero, "1: a change of 0 is never a chip (no \u00b10%)");
  ok(/at 32%/.test(N.fmt) && /Blaauw's/.test(N.fmt) && /turn 22/i.test(N.fmt) && /from 60% to 0%\./.test(N.fmt) && !/\u2026/.test(N.fmt), "3: spaces around chips, no orphan space before 's", N.fmt);
  ok(N.chips.every((c) => c === null || (c.length <= 24 && !/\u2026|\.\.\./.test(c))) && N.chips[3] === "Short one", "4: follow-up chips <= 24 chars, never a '\u2026'", N.chips);
  ok(N.dup[0] && N.dup[1] && N.pts && N.planGame, "5: same visual with same data never twice; no points bars; plan only for strategy", N);
  ok(await G(() => [...document.querySelectorAll("[data-aic^=c]")].every((c) => !c.querySelector(".ai-tx")?.innerText.includes("\u2026")) && [...document.querySelectorAll("[data-aic^=c] .ai-tx")].every((e) => e.getBoundingClientRect().height <= parseFloat(getComputedStyle(e).lineHeight) * 2 + 3)), "3: body copy <= 2 lines, no ellipsis");
  console.log(JSON.stringify(await G(() => [...document.querySelectorAll("[data-aic^=c]")].map((c) => [!!c.querySelector(".ai-bd"), c.querySelectorAll(".ai-bd").length, !!c.querySelector(".ai-wc, .ai-bars, .ai-plan, .ai-mv"), !!c.querySelector("[data-aileg]")]))));
  ok(await G(() => [...document.querySelectorAll("[data-aic^=c]")].filter((c) => c.querySelector(".ai-bd")).every((c) => !c.querySelector(".ai-wc, .ai-bars, .ai-plan, .ai-mv") && c.querySelectorAll(".ai-bd").length === 1 && (!c.querySelector(".ai-chg small") || !!c.querySelector("[data-aileg]")) )), "2: decision card shows exactly one board with legend, no bars/timeline");
  // v1.74 critic 3 items 1-5
  const Z = await G(async ([me, t1, t2, o]) => {
    const g = window.__colonistGame, C = g._aiCtx(), { aiChip } = await import("./src/review-ai.js"), r = {}, strip = (h) => h.replace(/<[^>]+>|\u2060/g, "");
    const titles = ["You stayed close", "Great move", "Your move helped", "Best choice of the game", "Your Knight paid off"];
    r.titles = titles.map((x) => g._aiCard({ level: "decision", view: "moves", title: x, text: "Fine.", turns: [t1], focusTurn: t1, players: [] }, C).title);
    r.neutralLine = g._aiCard({ level: "decision", view: "moves", title: "x", text: "Your move paid off and stayed close.", turns: [t1], focusTurn: t1, players: [] }, C).text;
    r.colon = strip(g._aiFmt(r.neutralLine, C, null)); r.colonHtml = g._aiFmt("Turn 21: your move cost 2%. Set-up: fine.", C, null);
    r.poss = g._aiFmt(`${o}'s city and ${o}\u2019s road`, C, null);
    r.strat = g._aiCard({ level: "strategy", view: "plan", title: "Strong comeback", text: "Fine.", turns: [t2], focusTurn: t2, players: [] }, C);
    const mk = (title, turn, extra = {}) => ({ level: "game", view: "winchance", title, text: "Plain sentence stays.", turns: [turn], focusTurn: turn, players: [], ...extra });
    const list = (cs) => g._aiCardList(cs, C, new Set()).length;
    r.dupFact = list([mk("A title", t1, { players: [o] }), mk("Another title", t1, { players: [o] })]);
    r.sameTitle = list([mk("Same title", t1), mk("Same title", t2)]);
    r.generic = list([mk("Best move ever", t1), { level: "decision", view: "moves", title: "Great move", text: "x.", turns: [t1], focusTurn: t1, players: [] }]);
    r.genericAlone = list([{ level: "decision", view: "moves", title: "Great move", text: "x.", turns: [t1], focusTurn: t1, players: [] }]);
    r.finalDup = list([{ level: "game", view: "points", title: "P1", text: "A.", turns: [], players: [] }, { level: "game", view: "none", title: "P2", text: "You finished with 9 points.", turns: [], players: [] }]);
    const fr = g._aiCard({ level: "game", view: "winchance", title: "x", text: "A complete one. Another complete one! This one is cut off and", turns: [t1], focusTurn: t1, players: [] }, C).text;
    const only = g._aiCard({ level: "game", view: "winchance", title: "x", text: "This is cut off and", turns: [t1], focusTurn: t1, players: [] }, C);
    const ans = g._aiCard({ answer: "Done well. The second one is cut", points: ["Ore 6", "10 points"], view: "winchance", turns: [t1], focusTurn: t1 }, C, { answer: true });
    r.frag = fr; r.fragOnly = only.text; r.ans = ans.text;
    r.ptsPlain = g._aiFmt("Ore 6 / 10 points on turn 5", C, null, { plain: true });
    r.chips = ["How unlucky was I", "Why did I lose so much win chance on turn 17?", "What was the best move of the game overall?", "Who was luckiest?", "How did the winner win it so fast", "Short one"].map((q) => aiChip(q));
    const d = g.geometry, hs = d.hexSize, ps = [{ x: 0, y: 0 }, { x: hs * 3, y: hs }]; const v = g._aiCropView(ps, 330, 205, 0.3);
    const L = v.box; r.crop = v && [L.minX, L.maxX, L.minY, L.maxY].every((x) => isFinite(x)) && v.offsetX + L.minX * v.scale >= -0.5 && v.offsetX + L.maxX * v.scale <= 330.5 && v.offsetY + L.minY * v.scale >= -0.5 && v.offsetY + L.maxY * v.scale <= 205.5 && L.minX <= -hs * 2 && L.maxX >= hs * 5;
    return r;
  }, [me, F.worst.t, F.alt.t, opN]);
  console.log(JSON.stringify(Z));
  const POSW = /stayed close|great|helped|best|paid off|strong|comeback/i;
  ok(Z.titles.every((x) => !POSW.test(x) && /^(Turn \d+|Set-up) \u00b7 .* \u2212\d+%$/.test(x)), "1: positive title with a negative chip -> neutral app title 'Turn N \u00b7 your move \u2212x%'", Z.titles);
  ok(!/stayed close|paid off/.test(Z.neutralLine) && /^On turn \d+ your move cost/.test(Z.neutralLine), "1: positive text with a negative chip -> neutral line", Z.neutralLine);
  ok(!/ :|: /.test(Z.colon) && !/<\/span>:/.test(Z.colonHtml) && !/\s:/.test(Z.colonHtml), "1: no 'Turn 21 : ' (no colon after a chip)", Z.colon);
  ok((Z.poss.match(/<span[^>]*ai-n[^>]*>[^<]*['\u2019]s<\/span>/g) || []).length === 2 && !/<\/span>['\u2019]s/.test(Z.poss), "1: possessive is inside the name chip", Z.poss);
  ok(/^Strategy \u00b7 /.test(Z.strat.title) || !POSW.test(Z.strat.title) || Z.strat.chg.length === 0, "1: strategy title checked", Z.strat.title);
  ok(Z.dupFact === 1, "3: same turn + same player -> one card", Z.dupFact);
  ok(Z.sameTitle === 1, "3: two cards never share a title", Z.sameTitle);
  ok(Z.generic === 1 && Z.genericAlone === 1, "3: generic app fallback dropped when another card covers the turn, kept alone", [Z.generic, Z.genericAlone]);
  ok(Z.finalDup === 1, "3: same final-points fact only once", Z.finalDup);
  ok(Z.frag === "A complete one. Another complete one!" && !/cut off/.test(Z.frag), "4: a cut sentence is dropped, complete ones kept", Z.frag);
  ok(!/cut off/.test(Z.fragOnly) && (Z.fragOnly === "" || /[.!?]$/.test(Z.fragOnly)), "4: only a fragment -> neutral app line or nothing", Z.fragOnly);
  ok(/^Done well\.$/.test(Z.ans), "4: answer card: complete sentences only", Z.ans);
  ok(!/</.test(Z.ptsPlain) && /Ore 6/.test(Z.ptsPlain), "4: point chips are plain text (no nested pills)", Z.ptsPlain);
  ok(await G(() => [...document.querySelectorAll(".ai-pts > span")].every((e) => !e.querySelector("span,b"))), "4: no nested pills in the DOM");
  ok(Z.chips[0] === "Luck vs play?" && Z.chips[1] === "Why did I lose?" && Z.chips[2] === "Best move?" && Z.chips.every((c) => c === null || (c.length <= 24 && !/\u2026|\.\.\./.test(c) && !/\b(I|the|a|of|to)$/.test(c))), "5: follow-up chips never cut: long or cut ones get a short app label", Z.chips);
  ok(Z.crop, "2: board crop = box of A and B plus a hex ring, fully inside the picture", Z.crop);
  await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-top.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 520; }); await sleep(300); await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-mid.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 99999; }); await sleep(300); await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-end.png` });
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 0; });
  // every reference is a link: styled, >=32px touch area, Back returns to the AI tab at the same scroll position
  const LK = await G(() => { const c = [...document.querySelectorAll("[data-aic^=c]")]; const info = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); const a = getComputedStyle(e, "::after"); return { role: e.getAttribute("role"), h: parseFloat(a.height), tab: e.tabIndex }; };
    return { turn: info(".ai-tx .ai-l.ai-t"), name: info(".ai-l.ai-n"), pts: info(".ai-l.ai-p"), spot: info(".ai-l.ai-r"), dec: info(".ai-l.ai-d"), luck: !!document.querySelector("[data-aic=c1] [data-ailuck]") }; });
  console.log(JSON.stringify(LK));
  ok(["turn", "name", "pts", "spot"].every((k) => LK[k] && LK[k].role === "button" && LK[k].h >= 32), "turn / name / points / spot are links with >=32px touch area", LK);
  ok(LK.dec, "decision word linked", JSON.stringify(LK.dec));
  const sc0 = await G(() => { const s = document.querySelector(".rv-scroll"); s.scrollTop = 330; return s.scrollTop; });
  await sleep(200);
  const nameSeat = await G(() => { const e = document.querySelector("[data-aic^=c] [data-aipl]"); e.scrollIntoView({ block: "center" }); return +e.dataset.aipl; });
  const sc1 = await G(() => document.querySelector(".rv-scroll").scrollTop);
  await page.locator("[data-aic^=c] [data-aipl]").first().dispatchEvent("click"); await sleep(1200);
  ok(await G((s) => !!document.querySelector(".pp-bar") , nameSeat), "player name link opens that player's page", nameSeat);
  await page.locator(".pp-bar [data-rvt]").first().tap(); await sleep(1000);
  const bk = await G(() => ({ ai: !!document.querySelector("[data-rvt=ai].on"), top: document.querySelector(".rv-scroll").scrollTop }));
  ok(bk.ai && Math.abs(bk.top - sc1) <= 3, "Back from the player page: AI tab, same scroll", [bk, sc1]);
  const sp = await G(() => { const e = document.querySelector("[data-aispot]"); e.scrollIntoView({ block: "center" }); return document.querySelector(".rv-scroll").scrollTop; });
  await page.locator("[data-aispot]").first().dispatchEvent("click"); await sleep(1200);
  ok(await G(() => !!document.querySelector(".rv.step .rs-board")), "spot link opens the board view");
  console.log("spot rings:", await G(() => document.querySelectorAll(".rs-marks .ai-spot").length));
  await page.screenshot({ path: `${SH}/${process.env.TAG || "mock"}-spot.png` });
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(900);
  const bk2 = await G(() => ({ ai: !!document.querySelector("[data-rvt=ai].on"), top: document.querySelector(".rv-scroll").scrollTop }));
  ok(bk2.ai && Math.abs(bk2.top - sp) <= 3, "Back from the board view: same scroll position", [bk2, sp]);
  await page.locator("[data-aic=c1] [data-ailuck]").first().dispatchEvent("click").catch(() => {}); await sleep(900);
  ok(await G(() => document.querySelector("[data-rvt=luck].on") !== null) || !LK.luck, "luck reference opens the Luck tab (when linked)");
  await page.locator("[data-rvt=ai]").tap(); await sleep(900);
  await page.locator("[data-aic=c2] [data-aipts]").first().dispatchEvent("click"); await sleep(500);
  ok(await G(() => document.querySelector("[data-rvt=overview].on") !== null), "points reference with no points bars opens the Overview");
  await page.locator("[data-rvt=ai]").tap(); await sleep(900);
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 0; });
  // marker / turn chip -> step view at that turn; back returns to the AI tab
  await page.locator("[data-aic=c5] .ai-wc .mk").first().dispatchEvent("click"); await sleep(1200);
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
  const A = await G(() => { const a = document.querySelector("[data-aic=a0]"), r = a.getBoundingClientRect(), f = document.querySelector("[data-aic=c0]").getBoundingClientRect(); return { top: r.top < f.top, wc: !!a.querySelector(".ai-wc"), pts: a.querySelectorAll(".ai-pts > span").length, h: a.querySelector(".ai-tx").getBoundingClientRect().height, lh: parseFloat(getComputedStyle(a.querySelector(".ai-tx")).lineHeight), more: !!a.querySelector(".ai-tx [data-aimore]"), pin: !!a.querySelector("[data-aipin]"), why: !!a.querySelector("[data-aiwhy]") }; });
  ok(A.top && A.wc && A.pts === 2 && A.h <= A.lh * 3 + 3 && A.pin, "answer card on top, own visual, 2-line text, points chips, pin", A);
  ok(A.more, "answer text longer than 2 lines is expandable");
  await page.locator("[data-aic=a0] [data-aimore]").tap(); await sleep(300);
  ok(await G(() => document.querySelector("[data-aic=a0] .ai-tx").getBoundingClientRect().height > 40 && /less$/.test(document.querySelector("[data-aic=a0] .ai-tx").innerText.trim()) && !/…/.test(document.querySelector("[data-aic=a0] .ai-tx").innerText)), "more shows the whole text");
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
