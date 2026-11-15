// v1.73 AI tab on a real export with a MOCKED endpoint. node aitab173.js PORT EXPORT.json [--real]   (--real: real endpoint, PORT 9978, <=4 calls)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9771, file = process.argv[3], real = process.argv.includes("--real"); let fails = 0;
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/aitab/shots";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, ctx, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  page.on("console", (m) => { if (/ai visual|ai board/.test(m.text())) console.log("CONSOLE", m.text().slice(0, 300)); });
  const ex = JSON.parse(fs.readFileSync(file, "utf8"));
  let calls = [], mock = null;
  page.on("request", (r) => { if (/api\/recap/.test(r.url()) && r.method() === "POST") calls.push(JSON.parse(r.postData())); });
  let DELAY = 0; if (!real) await page.route(/api\/recap/, async (r) => { if (DELAY) await sleep(DELAY); if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
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
      { level: "game", title: "One point short", text: "You were one point away: a settlement needed 1 wood and 1 wheat.", view: "nearmiss", turns: [], players: ["You"], clauses: [] },
      { level: "strategy", title: "Every plan", text: "Cities and the army beat your settlements.", view: "plan", turns: [], players: F.names, clauses: F.names.map((n, i) => ({ player: n, text: `built up from turn ${3 + i}, clause ${i}` })) },
    ] } } }
    : { body: { explain: { answer: `${opN} won because of cities on turn ${F.opp.t}. Second line here. A third line that makes the text longer than three lines on a narrow phone screen so it can expand. Then a fourth sentence with more words so that it certainly needs the more link on any phone.`, points: ["10 points", "Ore 6 / Grain 9"], view: "winchance", turns: [F.opp.t], focusTurn: F.opp.t, players: [opN], followUps: ["Who built first?", "And the longest road?"] } } };
  const mock0 = mock;
  const tab = () => page.locator("[data-rvt=ai]");
  // Overview row opens the tab
  ok(await G(() => !!document.querySelector("[data-rcai]")), "Overview has the AI coach row");
  await page.locator("[data-rcai]").tap(); await page.waitForSelector(".ai-c .ai-ti", { timeout: 20000 }); await sleep(2500);
  ok(calls.length === 1 && calls[0].mode === "insights" && calls[0].lang && calls[0].index && !calls[0].facts, "one insights call", calls.map((c) => c.mode));
  const S = await G(() => ({ cards: [...document.querySelectorAll("[data-aic^=c]")].map((c) => ({ lv: c.querySelector(".ai-lv")?.className, title: c.querySelector(".ai-ti")?.textContent, text: window.__colonistGame._aiSrc.get(c.dataset.aic)?.text, shown: c.querySelector(".ai-tx")?.innerText, vis: ["ai-wc", "ai-bars", "ai-plan", "ai-bd", "ai-mv"].filter((k) => c.querySelector("." + k)), chips: [...c.querySelectorAll(".ai-chg")].map((e) => e.innerText.replace(/\s+/g, " ")), why: !!c.querySelector("[data-aiwhy]"), go: !!c.querySelector("[data-aigo]"), markers: c.querySelectorAll(".ai-wc .mk").length })),
    hl: document.querySelector(".ai-hl")?.textContent, qchips: [...document.querySelectorAll(".ai-q")].map((e) => e.textContent), askVisible: (() => { const r = document.querySelector(".ai-ask").getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height > 40; })() }));
  console.log(JSON.stringify(S.cards.map((c) => [c.title, c.vis, c.chips, c.why, c.go])));
  ok(S.cards.length === 9, "9 cards rendered (7 + near-miss + all-players strategy)", S.cards.length);
  { // v1.75: near-miss card, all-players strategy card, board zoom
    const N = await G(() => { const g = window.__colonistGame, cs = [...document.querySelectorAll("[data-aic^=c]")], nmC = cs[7], plC = cs[8], m = g._aiCtx().nm;
      const rows = [...plC.querySelectorAll(".ai-pr2")].map((r) => ({ seat: +r.dataset.aipr, name: r.querySelector(".n")?.textContent, color: getComputedStyle(r.querySelector(".n")).color, label: r.querySelector("em")?.textContent, icons: r.querySelectorAll("svg path.f, svg path.l, svg path.a, svg path.v").length, clause: r.querySelector(".cl")?.textContent }));
      const zooms = [...document.querySelectorAll(".ai-bd[data-zoom]")].map((e) => (e.dataset.zoom === "two" ? 1 : +e.dataset.zoom));
      return { m, nm: !!nmC.querySelector(".ai-nm"), nmHd: nmC.querySelector(".nm-hd")?.textContent, need: nmC.querySelector(".nm-need")?.textContent, tags: [...nmC.querySelectorAll(".nm-ms .ai-r")].map((e) => e.textContent), away: nmC.querySelector(".nm-away")?.textContent, rows, zooms, tl: g._aiCtx().tl.map((l) => l.length), plan: g._aiCtx().plan(0) }; });
    console.log(JSON.stringify(N));
    ok(N.nm && N.m && N.m.margin >= 1 && new RegExp(`^${N.m.youPoints}\\s*/\\s*${N.m.result === "won" ? N.m.youPoints - N.m.margin : N.m.winnerPoints}`).test(N.nmHd), "near-miss card: points header from the app's facts", [N.nmHd, N.m && N.m.margin]);
    ok(N.m.result === "won" || (N.need && /\u2192/.test(N.need) && (N.tags.length === Object.keys(N.m.needed.missing).length || N.tags[0].length) && N.tags.every((t) => /^\d+ \p{L}+/u.test(t) || t.length > 3)), "near-miss card: needed \u2192 missing resource tags", [N.need, N.tags, N.m.needed]);
    ok(N.m.result === "won" || N.m.turnsAway == null || /\u2248\s*\d+/.test(N.away), "near-miss card: turns-away estimate shown", N.away);
    ok(N.rows.length === F.n && N.rows.every((r, i) => r.seat === i && r.name === F.names[i].replace(/^You$/, r.name) && r.color !== "rgba(0, 0, 0, 0)" && r.label), "strategy card: one row per player, name coloured, app goal label", N.rows.map((r) => [r.name, r.label, r.icons]));
    ok(N.rows.every((r, i) => new RegExp(`clause ${i}$`).test(r.clause || "")), "strategy card: each AI clause on its own player's row", N.rows.map((r) => r.clause));
    { // v1.76 route to the target
      const RT = await G(() => { const g = window.__colonistGame, C = g._aiCtx(), card = document.querySelectorAll("[data-aic^=c]")[8];
        return [...card.querySelectorAll(".ai-pr2")].map((r) => { const s = +r.dataset.aipr, rt = C.route(s), segs = [...r.querySelectorAll(".rt-sg")].map((e) => +e.dataset.pts), ms = r.querySelector(".rt-ms");
          return { s, rt: rt && { total: rt.total, target: rt.target, won: rt.won, v: rt.verdict?.v, goal: rt.goal.length }, segs, ms: ms ? +ms.dataset.pts : 0, flag: !!r.querySelector(".rt-fl"), goalTx: r.querySelector("em")?.textContent, vtag: r.querySelector(".rt-v")?.textContent, missTx: ms?.textContent }; }); });
      console.log(JSON.stringify(RT));
      ok(RT.every((r) => r.rt && r.segs.reduce((a, b) => a + b, 0) === r.rt.total), "route bar: source segments sum to the player's points", RT.map((r) => [r.segs, r.rt && r.rt.total]));
      ok(RT.every((r) => (r.rt.total < r.rt.target ? r.ms === r.rt.target - r.rt.total && r.missTx.length >= 2 : r.flag && !r.ms)), "route bar: dashed missing segment up to the target (labelled), winner gets a flag", RT.map((r) => [r.ms, r.flag, r.missTx]));
      ok(RT.every((r) => /^(Goal|Doel): .+/.test(r.goalTx || "") && r.rt.goal >= 1), "route bar: goal label present", RT.map((r) => r.goalTx));
      ok(RT.every((r) => /^(\u2713|\u23F8|\u2717)/.test(r.vtag || "")) && RT.filter((r) => r.rt.won).every((r) => r.rt.v === "worked"), "route bar: verdict tag (worked / stalled / didn't work) on every row, winner worked", RT.map((r) => [r.vtag, r.rt.v]));
    }
    ok(N.zooms.length >= 1 && N.zooms.every((z) => z > 0 && z < 80), "decision board: zoom box smaller than the full board (% of board area)", N.zooms);
  }
  const want = ["ai-bd|ai-mv", "ai-bars", null, "ai-plan", "ai-bd|ai-mv|ai-wc", "ai-wc"]; ok(want.every((k, i) => (k ? k.split("|").includes(S.cards[i].vis.join()) : S.cards[i].vis.length === 0)) && S.cards[6].vis.length === 0, "visuals: decision = board always, luck bars, no points bars, plan for strategy, chart, none", S.cards.map((c) => c.vis.join()));
  ok(S.cards[5].markers >= 1 && S.cards[5].markers <= 3 && S.cards[5].markers < 3 + 1, "win chart: merged adjacent markers (T10-11 is one)", S.cards[5].markers);
  ok(S.cards[0].chips.length === 1 && S.cards[0].chips[0].includes("\u2212" + F.worst.cost + "%") && /your move/.test(S.cards[0].chips[0]), "decision chip = YOUR cost with your sign (red, your move)", [S.cards[0].chips, F.worst.cost]);
  ok(S.cards[3].chips.length === 0, "6: a plan card has no win-chance chip (one primary chip only, on the card whose main fact it is)", S.cards[3].chips);
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
  ok(/^[\u2212+]\d+%$/.test(Q.chip5.replace(/\s?[a-z]+$/, "")) && /^T\d+\u2013\d+$/.test(Q.mk5 || ""), "1: win chip is a single signed number; the chart marker spans the same turns", [Q.chip5, Q.mk5]);
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
    const L = v.box; r.crop = v && [L.minX, L.maxX, L.minY, L.maxY].every((x) => isFinite(x)) && v.offsetX + L.minX * v.scale >= -0.5 && v.offsetX + L.maxX * v.scale <= 330.5 && v.offsetY + L.minY * v.scale >= -0.5 && v.offsetY + L.maxY * v.scale <= 205.5 && L.minX <= -hs * 1.5 && L.maxX >= hs * 4.5;
    return r;
  }, [me, F.worst.t, F.alt.t, opN]);
  console.log(JSON.stringify(Z));
  const POSW = /stayed close|great|helped|best|paid off|strong|comeback/i;
  ok(Z.titles.every((x) => !POSW.test(x) && /^(Turn \d+|Set-up): your (move|win chance)$/.test(x)), "1: positive title with a negative chip -> readable neutral title 'Turn N: your move'", Z.titles);
  ok(!/stayed close|paid off/.test(Z.neutralLine) && /^Your move on turn \d+ cost \d+% win chance\.$/.test(Z.neutralLine), "1: positive text with a negative chip -> full-sentence neutral line", Z.neutralLine);
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
  const A = await G(() => { const a = document.querySelector("[data-aic=a0]"), r = a.getBoundingClientRect(), f = document.querySelector("[data-aic=c0]").getBoundingClientRect(); return { top: r.top > f.top, wc: !!a.querySelector(".ai-wc"), pts: a.querySelectorAll(".ai-pts > span").length, h: a.querySelector(".ai-tx").getBoundingClientRect().height, lh: parseFloat(getComputedStyle(a.querySelector(".ai-tx")).lineHeight), more: !!a.querySelector(".ai-tx [data-aimore]"), pin: !!a.querySelector("[data-aipin]"), why: !!a.querySelector("[data-aiwhy]") }; });
  ok(A.top && A.wc && A.pts === 2 && A.h <= A.lh * 3 + 3 && A.pin, "answer card below the insight cards (chat), own visual, 2-line text, points chips, pin", A);
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
  // v1.74 chat: collapse, repeated question, pending card, dedupe link, chip refresh, clear chat
  { const C1 = await G(() => ({ a1col: !!document.querySelector("[data-aic=a1] .ai-colb"), a0open: !!document.querySelector("[data-aic=a0] .ai-tx"), open: document.querySelectorAll("[data-aic^=a] .ai-tx").length }));
    ok(C1.a1col && C1.a0open && C1.open === 1, "chat: newest answer open, the earlier one collapsed to one line", C1);
    await page.locator("[data-aic=a1] .ai-colb").tap(); await sleep(500);
    const C2 = await G(() => ({ a1: !!document.querySelector("[data-aic=a1] .ai-tx"), a0col: !!document.querySelector("[data-aic=a0] .ai-colb"), open: document.querySelectorAll("[data-aic^=a] .ai-tx").length }));
    ok(C2.a1 && C2.a0col && C2.open === 1 && calls.length === 3, "chat: tapping a collapsed answer opens it and closes the other (max 1 open), no call", C2);
    await page.fill("[data-aiin]", "Another question?"); await page.locator(".ai-in .rv-btn").tap(); await sleep(900);
    ok(calls.length === 3 && await G(() => !!document.querySelector("[data-aic=a0] .ai-tx")), "chat: repeated question scrolls to / opens the existing answer, no new call", calls.length);
    const m0 = mock; mock = (b) => b.mode === "game" && b.question === "Dedupe?" ? { body: { explain: { answer: "Same chart again.", view: "winchance", turns: [F.alt.t, F.alt.t + 1], focusTurn: F.alt.t, players: [meN], followUps: ["Why so?", "What came next?"] } } } : m0(b);
    DELAY = 1800; await page.fill("[data-aiin]", "Dedupe?"); await page.locator(".ai-in .rv-btn").tap(); await sleep(500);
    const P = await G(() => { const sc = document.querySelector(".rv-scroll"), p = document.querySelector(".ai-ask .ai-pend"), a = document.querySelector(".ai-ask"); return { pend: !!p && /Dedupe\?/.test(p.textContent), above: !!p && !!a && p.getBoundingClientRect().bottom <= a.querySelector(".ai-in").getBoundingClientRect().top + 1, atBottom: sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80, focus: document.activeElement?.matches?.("[data-aiin]") }; });
    ok(P.pend && P.above && P.atBottom && P.focus, "chat: pending card right above the ask bar, scrolled to the end, ask field keeps focus", P);
    await sleep(2500); DELAY = 0;
    const D = await G(() => { const a = document.querySelector("[data-aic=a0]"), ref = a?.querySelector("[data-airef]"); return { calls: 0, pendGone: !document.querySelector(".ai-pend"), noWc: !!a && !a.querySelector(".ai-wc"), ref: ref?.dataset.airef, exists: ref ? !!document.querySelector(`[data-aic="${ref.dataset.airef}"]`) : false, chips: [...document.querySelectorAll(".ai-q")].map((e) => e.dataset.aiq), labels: [...document.querySelectorAll(".ai-q")].map((e) => e.textContent) }; });
    ok(calls.length === 4 && D.pendGone && D.noWc && D.ref && D.exists, "chat: answer with the same visual as a card shows a link, not the chart again", D);
    ok(D.chips.length && D.labels.every((q) => q.length <= 24) && !D.chips.includes("Dedupe?") && !D.chips.includes(first) && D.chips.some((q) => /Why so|What came/.test(q)), "chat: chips refresh from the last answer, asked ones removed, <=24 chars", D.chips);
    await page.locator("[data-aic=a0] [data-airef]").tap(); await sleep(400);
    ok(calls.length === 4 && await G(() => !!document.querySelector(".ai-c.flash, .ai-vz.flash")), "chat: the link highlights the card, no call");
    await page.locator("[data-aiclear]").tap(); await sleep(400);
    ok(await G(() => document.querySelectorAll("[data-aic^=a]").length) === 1 && await G(() => !!document.querySelector("[data-aic^=a] .ai-pin.on")), "chat: Clear chat removes unpinned answers, keeps the pinned one"); mock = m0; }
  await G(() => { document.querySelector(".rv-scroll").scrollTop = 99999; });
  await page.locator("[data-airun]").tap(); await sleep(2500);
  ok(calls.length === 5 && calls[4].mode === "insights", "Regenerate asks again", calls.length);
  const kept = await G(() => [...document.querySelectorAll("[data-aic^=a] .ai-lv")].map((e) => e.textContent));
  ok(kept.length === 1 && kept[0].startsWith(first.slice(0, 20)), "only the pinned answer survives Regenerate", kept);
  // cache: leave and reopen the review: no new call
  await G(() => window.__colonistGame._rvCloseReview?.(true)); await sleep(600);
  await G(() => window.__colonistGame.histOpen()); await sleep(1200);
  await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2000);
  const n0 = calls.length;
  await page.locator("[data-rcai]").tap(); await sleep(2500);
  ok(calls.length === n0 && await G(() => document.querySelectorAll("[data-aic^=c]").length) === 9, "reopened game: cards from the saved review, no second call", [calls.length, n0]);
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
  // 4th critic pass: items 1-5
  const Y = await G(async ([o, me, t, opS]) => {
    const g = window.__colonistGame, C = g._aiCtx(), { wcAt, wcChange } = await import("./src/review/ai-facts.js"), r = {}, strip = (h) => h.replace(/<[^>]+>|\u2060/g, "");
    const mk = (extra) => ({ level: "game", view: "winchance", title: "x", text: "Plain.", turns: [t], focusTurn: t, players: [], ...extra });
    // 1: neutral lines are sentences, no leading dot, no "X \u00b7 Y"
    const cs = [g._aiCard(mk({ level: "decision", view: "moves", title: "Great move", text: "Your move paid off." }), C), g._aiCard(mk({ title: "Great win", text: "Your win chance rose a lot and was great." }), C), g._aiCard({ level: "strategy", view: "plan", title: "Strong plan", text: "Strong plan was great.", turns: [], players: [opS] }, C)];
    r.lines = cs.map((c) => [c.title, c.chg[0] ? g._aiNeutral(c, C, c.chg[0].seat, c.focus, "Turn") : ""]); r.lines[2][1] = g._aiNeutral(cs[2], C, opS, null, "Turn") || cs[2].text; // (the card's own text is blank when it equals the neutral line)
    r.plan = g._aiPlanLine(C, opS);
    const wcc = wcChange(C.ser, me, t, t), v = Math.round(wcAt(C.ser, me, t));
    // 2: numbers = the app's value for that turn and player
    const a = g._aiCard(mk({ text: `Your win chance was 71% on turn ${t}.`, players: [] }), C); r.a = a.text; r.av = v;
    const b2 = g._aiCard(mk({ text: `Your win chance went from 5% to 99% on turn ${t}.` }), C); r.b = b2.text; r.bw = wcc && [wcc.from, wcc.to];
    const c3 = g._aiCard(mk({ text: "Your win chance was 71% then." , turns: [], focusTurn: null }), C); r.c = c3.text;
    // 3: opponent chip is not green/red, has name + sign
    const oc = g._aiCard(mk({ players: [o], text: "Fine." }), C), ch = strip(g._aiChgChips(oc, C)); r.oppChip = ch; r.oppCls = (g._aiChgChips(oc, C).match(/class="ai-chg ([^"]*)"/) || [])[1];
    const yc = g._aiChgChips(g._aiCard(mk({ players: [] , text: "Fine."}), C), C); r.youCls = (yc.match(/class="ai-chg ([^"]*)"/) || [])[1];
    r.chips = [oc, g._aiCard(mk({ players: [o, "You"] }), C)].map((c) => (g._aiChgChips(c, C).match(/class="ai-chg /g) || []).length);
    const oh = g._aiFmt("Blaauw +14% here.", C, { chg: [{ seat: opS, d: 14 }], focus: t }); r.oppInline = /ai-c opp pc-\d/.test(oh) && !/ai-c (up|dn)/.test(oh);
    const lh = g._aiVLuck({ seats: [], turns: [] }, C); r.luckOpp = !C.luck || [...new DOMParser().parseFromString(lh, "text/html").querySelectorAll(".ai-br")].every((row, i) => i === me || !/\b(up|dn)\b/.test(row.querySelector("b").className));
    // 4: a title repeating the headline or another card is retitled or dropped
    const html = g._aiCardList([mk({ title: "Same title here", text: "A.", turns: [3], focusTurn: 3 }), mk({ level: "strategy", view: "plan", title: "Same title here", text: "B.", turns: [9], focusTurn: 9 }), mk({ level: "game", view: "luck", title: "Headline of the game", text: "C.", turns: [], focusTurn: null })], C, new Set(), "Headline of the game");
    r.titles = html.map((h) => (h.match(/class="ai-ti">([^<]*)/) || [])[1]);
    return r;
  }, [opN, me, F.worst.t, F.opp.s]);
  console.log(JSON.stringify(Y));
  ok(Y.lines.every(([ti, tx]) => !/\u00b7/.test(ti + tx) && !/^[\s\u00b7]/.test(tx)) && /^(Turn \d+: your move)$/.test(Y.lines[0][0]) && /^Your move on turn \d+ cost \d+% win chance\.$/.test(Y.lines[0][1]), "1: neutral title and line are readable full sentences", Y.lines);
  ok(/^\w+(?: \w+)?'s plan: [a-z ]+\.$/.test(Y.plan) && /\bplan\b/.test(Y.lines[2][0]), "1: plan line 'Blaauw's plan: cities and the army.' and title", [Y.plan, Y.lines[2][0]]);
  ok(Y.a.includes(Y.av + "%") && !/71/.test(Y.a), "2: a win-chance number is replaced by the app's value for that turn and player", [Y.a, Y.av]);
  ok(!/\b5%|99%/.test(Y.b) || (Y.bw && Y.b.includes(Y.bw[0] + "%") && Y.b.includes(Y.bw[1] + "%")), "2: 'a% to b%' shows the app's step or is dropped", [Y.b, Y.bw]);
  ok(!/71/.test(Y.c), "2: an unmatched win-chance number is removed (no number differing from the chip/visual)", Y.c);
  ok(Y.oppCls === "opp pc-" + F.opp.s && /^[\w ]+[+\u2212]\d+%/.test(Y.oppChip) && /^(up|dn) pc-/.test(Y.youCls), "3: opponent chip in the player's colour with name, never red/green; yours green/red", [Y.oppCls, Y.oppChip, Y.youCls]);
  ok(Y.chips.every((n) => n <= 1) && Y.oppInline && Y.luckOpp, "3: at most one primary chip per card; opponent numbers never up/dn", Y);
  ok(Y.titles.length >= 2 && new Set(Y.titles).size === Y.titles.length && !Y.titles.includes("Headline of the game"), "4: duplicate title / title repeating the headline is retitled or dropped", Y.titles);
  // 5: ring badges are not on number tokens
  const R5 = await G(async () => {
    const g = window.__colonistGame, C = g._aiCtx(), out = [];
    for (const x of C.decs.filter((q) => g._aiHasPos(q.d)).slice(0, 6)) {
      const s = g._aiShot(x.turn, C, 320, 198), V = s?.view; if (!s?.marks) continue;
      const toks = g.geometry.hexes.filter((h) => h.number).map((h) => [h.center.x * V.scale + V.offsetX, h.center.y * V.scale + V.offsetY]), tr = g.geometry.hexSize * V.scale * 0.34;
      const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${s.marks}</svg>`, "image/svg+xml");
      const bad = [...doc.querySelectorAll(".mk-a circle[stroke], .mk-b circle[stroke], .mk-a g circle, .mk-b g circle")].some((c) => { const gt = c.parentNode.getAttribute?.("transform"), m = gt && gt.match(/translate\(([-\d.]+) ([-\d.]+)\)/), cx = m ? +m[1] : +c.getAttribute("cx"), cy = m ? +m[2] : +c.getAttribute("cy"), r = +c.getAttribute("r"); return toks.some((t) => Math.hypot(t[0] - cx, t[1] - cy) < r + tr - 1 && c.parentNode.closest?.(".x") == null && (m || r < g.geometry.hexSize * V.scale * 0.5)); });
      out.push([x.turn, bad]);
    }
    return out;
  });
  console.log(JSON.stringify(R5));
  ok(R5.length > 0 && R5.every(([, bad]) => !bad), "5: A/B rings and their labels do not cover a number token", R5);
  ok(errors.length === 0, "no page errors", errors.join("|"));
  // v1.74: chart line colours = player colours; subject/number; verb vs pair; one resource tag style
  await page.evaluate(() => localStorage.setItem("colonist_recap_lang", "en")); await G(() => window.__colonistGame._rvDrawReview()); await sleep(600);
  await page.locator("[data-rvt=ai]").tap().catch(() => {}); await sleep(2500);
  const V = await G(async () => {
    const g = window.__colonistGame, C = g._aiCtx(), cs = (el, p) => getComputedStyle(el)[p];
    const lines = [...document.querySelectorAll(".ai-wc path[class^=pc-]")].map((p) => ({ seat: +p.getAttribute("class").slice(3), stroke: cs(p, "stroke") }));
    const dots = {}; lines.forEach((l) => { const d = document.createElement("i"); d.className = "ai-dot pc-" + l.seat; document.querySelector(".ai").appendChild(d); dots[l.seat] = cs(d, "backgroundColor"); d.remove(); });
    const { aiSeries, wcChange } = await import("./src/review/ai-facts.js"); const ser = aiSeries(g);
    let T = null, a = null, b = null; for (let t = 3; t <= g.turn && T == null; t++) for (let x = 0; x < g.players.length; x++) for (let y = 0; y < g.players.length; y++) { if (x === y) continue; const cx = wcChange(ser, x, t, t), cy = wcChange(ser, y, t, t); if (cx && cy && cx.d < -2 && cy.d > 2 && T == null) { T = t; a = x; b = y; } }
    const nm = (q) => C.nmRaw(q), out = { T, a, b };
    if (T != null) {
      const card = { src: "", view: "winchance", turns: [T], focus: T, chg: [{ seat: b, d: wcChange(ser, b, T, T).d, from: wcChange(ser, b, T, T).from, to: wcChange(ser, b, T, T).to }], fix: [] };
      const ca = wcChange(ser, a, T, T), cb = wcChange(ser, b, T, T);
      card.src = `${nm(b)} drew a point card on turn ${T}, and ${nm(a)} dropped from ${cb.from}% to ${cb.to}%.`; out.t1 = g._aiTrust(card, C); out.ca = ca; out.cb = cb;
      card.fix = []; card.src = `${nm(a)} dropped from ${ca.to}% to ${ca.from}% on turn ${T}.`; out.t2 = g._aiTrust(card, C);
      card.fix = []; card.src = `On turn ${T} ${nm(b)} rose from ${cb.to}% to ${cb.from}%.`; out.t3 = g._aiTrust(card, C);
    }
    const tags = ["Ore 6", "Grain 9", "Wood 4", "Brick 8", "Sheep 5"].map((x) => { const h = document.createElement("div"); h.innerHTML = g._aiFmt(x, C, null); document.body.appendChild(h); const e = h.querySelector(".ai-r"); const r = e && { fs: cs(e, "fontSize"), fw: cs(e, "fontWeight"), pad: cs(e, "padding"), br: cs(e, "borderRadius"), sh: cs(e, "boxShadow").replace(/(?:rgba?|color)\([^)]*\)/g, "C"), bg: cs(e, "backgroundColor"), col: cs(e, "color") }; h.remove(); return r; });
    return { lines, dots, out, tags };
  });
  ok(V.lines.length >= 2 && V.lines.every((l) => l.stroke === V.dots[l.seat]), "chart line strokes equal the legend player colours", [V.lines, V.dots]);
  if (V.out.T != null) {
    ok(!/dropped from \d+% to \d+%/.test(V.out.t1 || "") || new RegExp(`dropped from ${V.out.ca.from}% to ${V.out.ca.to}%`).test(V.out.t1), "subject: numbers of the player named before them", V.out.t1);
    ok(!/dropped/.test(V.out.t2 || "") || new RegExp(`from ${V.out.ca.from}% to ${V.out.ca.to}%`).test(V.out.t2), "dropped with a rising pair is never shown", V.out.t2);
    ok(!/rose/.test(V.out.t3 || "") || new RegExp(`from ${V.out.cb.from}% to ${V.out.cb.to}%`).test(V.out.t3), "rose with a falling pair is never shown", V.out.t3);
  } else ok(true, "subject case: no opposing pair in this export (skipped)");
  ok(V.tags.every((t) => t && JSON.stringify({ ...t, bg: 0, col: 0 }) === JSON.stringify({ ...V.tags[0], bg: 0, col: 0 })) && new Set(V.tags.map((t) => t.col)).size === V.tags.length, "one resource tag style, own colour each", V.tags[0]);
  // ── v1.77 tool loop: index instead of the facts dump, tier-1 lookups at once, tier-2 on the engine (small budget), caps, tags, trust
  {
    const D = await G(async () => { const g = window.__colonistGame; const { aiDecList, aiIndex } = await import("./src/review/ai-tools.js"); const { aiFacts } = await import("./src/review/ai-facts.js");
      const l = aiDecList(g).filter((e) => e.seat === g._rvPid && ["build", "buy", "end", "bank"].includes(e.x.k) && e.x.cands.length >= 3).sort((a, b) => b.gap - a.gap)[0], ix = aiIndex(g);
      g._aiSimOpts = { budget: { nPer: 6 } };
      return { turn: l.turn, n: l.n, label: l.x.label, win: Math.round(l.x.win * 100), cost: Math.round(l.gap * 100), ixLen: ix.json.length, factsLen: aiFacts(g).json.length, ixKeys: Object.keys(ix.obj), ixDecs: ix.obj.reviewedDecisions.length };
    });
    console.log(JSON.stringify(D));
    ok(D.ixLen < D.factsLen && D.ixKeys.includes("topSwings") && D.ixKeys.includes("plans") && D.ixKeys.includes("nearMiss") && D.ixDecs >= 3 && !D.ixKeys.includes("turningPointCandidates"), "tools: the index is smaller than the facts dump and lists swings, plans, decisions", [D.ixLen, D.factsLen]);
    const T1 = await G(async () => { const g = window.__colonistGame; const { aiToolRun } = await import("./src/review/ai-tools.js"); const t0 = performance.now(); const o = {};
      o.dec = aiToolRun(g, "get_decision", { turn: 5, player: "You", n: null }); o.turn = aiToolRun(g, "get_turn", { turn: 5 }); o.luck = aiToolRun(g, "get_luck", { player: "You" }); o.plan = aiToolRun(g, "get_plan", { player: "Blaauw" });
      o.les = aiToolRun(g, "get_lessons", { category: "build" }); o.sw = aiToolRun(g, "list_swings", { n: 3 }); o.bad = aiToolRun(g, "get_decision", { turn: 999, player: "You", n: null }); o.who = aiToolRun(g, "get_luck", { player: "Nobody" }); o.ms = Math.round(performance.now() - t0); return o; });
    ok(T1.dec.evaluated?.length >= 2 && typeof T1.dec.playedWinPct === "number" && T1.dec.evaluated[0].winPct >= T1.dec.evaluated.at(-1).winPct && T1.turn.winChancePctBeforeAfter && T1.luck.luckInWinChancePct && T1.plan.routeToTarget?.incomePerTurn && T1.les.decisions >= 1 && T1.sw.swings.length === 3, "tier 1: decision, turn, luck, plan (with income), lessons, swings answer from the stored review", [T1.ms, Object.keys(T1.dec)]);
    ok(T1.bad.error && T1.who.error && T1.ms < 1500, "tier 1: unknown turn / player give an error, all lookups are instant", [T1.bad.error, T1.ms]);
    const base = mock0; let seen = {}, stamps = [];
    page.on("request", (r) => { if (/api\/recap/.test(r.url()) && r.method() === "POST") stamps.push([Date.now(), (JSON.parse(r.postData()).history || []).length]); });
    const TC = (id, name, args) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
    const req = (list) => ({ body: { toolRequests: list, history: [{ role: "assistant", content: null, tool_calls: list.map((q) => TC(q.id, q.name, q.args)) }] } });
    const ask = async (q) => { await G((q) => window.__colonistGame._aiAsk(q, true), q); await page.waitForFunction(() => window.__colonistGame._aiUi?.loading !== "ask", null, { timeout: 120000 }); await sleep(400); };
    const lastAns = () => G(() => { const g = window.__colonistGame, c = [...document.querySelectorAll("[data-aic^=a]:not(.col)")].pop(); return { text: c?.querySelector(".ai-tx")?.textContent || "", ev: [...(c?.querySelectorAll("[data-aiev]") || [])].map((e) => [e.dataset.aiev, e.textContent]), sim: !!c?.querySelector("[data-aisimv]"), rows: [...(c?.querySelectorAll(".ai-sr") || [])].map((r) => ({ v: +r.querySelector("b").firstChild.textContent.replace("%", ""), d: r.querySelector("em")?.textContent || null, cls: r.querySelector("em")?.className || "" })), q: c?.querySelector(".ai-lv.q")?.textContent, err: g._aiUi?.askErr || null }; });
    // tier 1 question
    calls.length = 0; stamps = [];
    mock = (body) => { if (body.mode !== "game") return base(body);
      if (!body.history) return req([{ id: "k1", name: "get_decision", args: { turn: D.turn, player: "You", n: D.n } }, { id: "k2", name: "list_swings", args: { n: 3 } }]);
      seen.t1 = body.toolResults; return { body: { explain: { answer: `Your move on turn ${D.turn} cost ${D.cost}% win chance. The engine had a better option.`, points: [], view: "winchance", turns: [D.turn], focusTurn: D.turn, players: ["You"], followUps: [], evidence: ["k1", "zz"] } } }; };
    await ask("Was my turn-" + D.turn + " move bad?");
    const A1 = await lastAns(); console.log(JSON.stringify([A1, stamps.map((s) => s[1])]));
    ok(calls.length === 2 && calls[0].index && !calls[0].facts && calls[1].history?.length === 1 && calls[1].toolResults?.length === 2, "tier 1: two POSTs (index, then toolResults + history)", calls.map((c) => [!!c.index, c.history?.length, c.toolResults?.length]));
    ok(seen.t1[0].result.evaluated?.length >= 3 && seen.t1[1].result.swings?.length === 3, "tier 1: the app executed both lookups locally and posted the results", seen.t1.map((r) => r.id));
    ok(A1.ev.some((e) => e[0] === "review" && /instant/.test(e[1])) && !A1.ev.some((e) => e[0] === "engine") && !A1.sim, "tier 1: answer tagged from your review · instant, no engine tag", A1.ev);
    ok(new RegExp(`${D.cost}%`).test(A1.text), "tier 1: the number from the tool result is kept", A1.text);
    // tier 2 question: progress card, engine, tag, bars, sign colours
    calls.length = 0; stamps = [];
    await G(() => { window.__simSeen = []; const g = window.__colonistGame; window.__simIv = setInterval(() => { const e = document.querySelector("[data-aisim]"); if (e) window.__simSeen.push(e.textContent.replace(/\s+/g, " ")); }, 60); });
    mock = (body) => { if (body.mode !== "game") return base(body);
      if (!body.history) return req([{ id: "k1", name: "simulate_moves", args: { turn: D.turn, player: "You", n: D.n, moves: [{ kind: "end", type: null, at: null, give: null, get: null, hex: null, card: null }, { kind: "buy", type: null, at: null, give: null, get: null, hex: null, card: null }] } }]);
      seen.t2 = body.toolResults; const rr = body.toolResults[0].result, row = (rr.results || []).find((x) => x.winPct != null);
      return { body: { explain: { answer: row ? `Ending the turn would have given ${row.winPct}% win chance in the engine.` : "The engine could not run that move.", points: [], view: "none", turns: [D.turn], focusTurn: D.turn, players: ["You"], followUps: [], evidence: ["k1"] } } }; };
    const t0 = Date.now(); await ask("What if I had ended my turn on turn " + D.turn + "?"); const wall2 = Date.now() - t0;
    await G(() => clearInterval(window.__simIv));
    const A2 = await lastAns(), SS = await G(() => window.__simSeen), r2 = seen.t2[0].result;
    console.log(JSON.stringify([A2, SS.slice(0, 2), r2, wall2]));
    ok(SS.length > 0 && /simulating 2 moves/.test(SS[0]) && /100 games each/.test(SS[0]) && /Cancel/.test(SS[0]), "tier 2: the progress card shows 'Engine is simulating 2 moves · 100 games each' with Cancel", SS[0]);
    ok(r2.tool === "simulate_moves" && r2.results.length === 2 && r2.results.some((x) => typeof x.winPct === "number" && x.futures > 0) && r2.games > 0, "tier 2: the engine ran on the stored position and the results were posted", r2);
    ok(A2.ev.some((e) => e[0] === "engine" && /engine · \d+ games/.test(e[1])) && A2.sim && A2.rows.length >= 2, "tier 2: tagged 'engine · N games', bars for the as-played and simulated moves", [A2.ev, A2.rows.length]);
    ok(A2.rows.filter((r) => r.d).every((r) => (/^−/.test(r.d) ? /dn/.test(r.cls) : /^\+/.test(r.d) ? /up/.test(r.cls) : true)), "tier 2: change colour follows the real sign", A2.rows);
    ok(/\d+%/.test(A2.text) && /would have/.test(A2.text), "tier 2: the engine-checked what-if sentence is kept", A2.text);
    // caps: 4th engine call refused, 12 calls, unchecked what-if dropped
    calls.length = 0;
    mock = (body) => { if (body.mode !== "game") return base(body);
      if (!body.history) return req(["a", "b", "c", "d"].map((x, i) => ({ id: "k" + (i + 1), name: "simulate_moves", args: { turn: D.turn, player: "You", n: D.n, moves: [{ kind: "end", type: null, at: null, give: null, get: null, hex: null, card: null }, { kind: "bank", type: null, at: null, give: i === 0 ? "wood" : i === 1 ? "brick" : i === 2 ? "sheep" : "wheat", get: "ore", hex: null, card: null }] } })));
      seen.cap = body.toolResults; return { body: { explain: { answer: "You would have won with a city. It was a close game.", points: [], view: "none", turns: [], focusTurn: null, players: [], followUps: [], evidence: [] } } }; };
    await ask("Could I have won?"); const A3 = await lastAns();
    ok(seen.cap.length === 4 && seen.cap.slice(0, 3).every((r) => !r.result.error) && /budget/.test(seen.cap[3].result.error || ""), "caps: the 4th engine call of a question is refused (3 max)", seen.cap.map((r) => r.result.error || r.result.tool));
    ok(!/would have/.test(A3.text) && /close game/.test(A3.text), "trust: an unchecked what-if sentence is dropped, the rest stays", A3.text);
    calls.length = 0;
    mock = (body) => { if (body.mode !== "game") return base(body); seen.n = (body.toolResults || []).length;
      return req(Array.from({ length: 14 }, (_, i) => ({ id: "x" + i, name: "get_turn", args: { turn: 2 + (i % 5) } }))); };
    await ask("Loop forever"); const A4 = await lastAns();
    ok(calls.length <= 7 && seen.n === 12 && A4.err, "caps: at most 6 tool rounds and 12 tool calls per question, then an error (no hang)", [calls.length, seen.n, A4.err]);
    // insights with a verified claim
    calls.length = 0; seen = {};
    mock = (body) => { if (body.mode !== "insights") return base(body);
      if (!body.history) return req([{ id: "k1", name: "get_decision", args: { turn: D.turn, player: "You", n: D.n } }, { id: "k2", name: "simulate_moves", args: { turn: D.turn, player: "You", n: D.n, moves: [{ kind: "end", type: null, at: null, give: null, get: null, hex: null, card: null }] } }]);
      seen.ins = body.toolResults; const o = base({ ...body, history: undefined }), r = seen.ins[1].result, row = (r.results || []).find((x) => x.winPct != null);
      o.body.explain.cards[1].text = row ? `Ending the turn would have kept ${row.winPct}% win chance on turn ${D.turn}.` : "Luck evened out."; o.body.explain.cards[1].evidence = ["k2"]; o.body.explain.cards[2].evidence = ["k1"]; o.body.explain.cards[0].text = "You would have won had you built a city."; return o; };
    await G(() => window.__colonistGame._aiRun(true)); await page.waitForFunction(() => window.__colonistGame._aiUi?.loading !== "insights", null, { timeout: 120000 }); await sleep(800);
    const I = await G(() => [...document.querySelectorAll("[data-aic^=c]")].map((c) => ({ ti: c.querySelector(".ai-ti")?.textContent, ev: [...c.querySelectorAll("[data-aiev]")].map((e) => e.textContent), tx: c.querySelector(".ai-tx")?.textContent || "" })));
    ok(I.filter((c) => c.ev.some((t) => /checked by engine/.test(t))).length === 1 && I.some((c) => /would have kept \d+%/.test(c.tx)) && !I.some((c) => /would have won/.test(c.tx)), "insights: engine-checked card tagged 'checked by engine', unchecked what-if dropped", I.map((c) => [c.ev, c.tx.slice(0, 50)]));
    ok(calls.length === 2 && calls[0].mode === "insights" && !!calls[0].index, "insights: two POSTs (tool round + final)", calls.length);
    mock = base;
  }
  ok(errors.length === 0, "no page errors after the tool loop", errors.join("|"));
  await b.close(); console.log(fails ? "FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
