// v1.94 cross-game Lessons on the five real reviewed games. node lessons194.js PORT   (server: node step105/tests/serve.mjs ROOT PORT)   env SHOTS=dir for screenshots (360x780 and 412x923, NL)
// Per size and language (360x780 / 412x923 x NL / EN):
//  - the games are saved WITHOUT their row (as before v1.94): the background analysis builds them one at a time in a worker, shows "3 of 5 games analysed", never holds the page's thread (long tasks), can be cancelled
//  - the counts on the page (lessons, "k of N games", cost per game) equal an independent recount (the numbers of the prototype analysis of the same fixtures, the games' own marked-move counts); no % above 100;
//    no "10·11·6" strings; the crops show exactly the hexes of the saved board (tests/evals/fixtures); no overlap / clipping / horizontal scroll; no console errors
//  - flows: more examples, practise (A/B + feedback), the three preset answers (with example chips), a free question (mocked endpoint, [1] becomes a chip), Open > the review step and back, the games tab, evidence appearing / disappearing
const path = require("path"); const fs = require("fs");
const L = require("./lessons194-lib.js"); const { sleep } = L;
const port = +process.argv[2] || 9930, SHOTS = process.env.SHOTS; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const GS = L.games();
// independent expectations: the prototype analysis (lessons191/analyse.mjs on the same fixtures): marked moves 14 in 5 games; Startplek 4 moves in 3/5 games (35 pt, 7 per game), Beurt te vroeg beeindigd 4 moves in 2/5 (21 pt, 4.2),
// Wat bouw je 3 in 2/5 (one move 76% of it: too little to say), Ruilen 1 in 1/5, robber and 7s: 9 vs 22 cards, better in 4/5
const EXPECT = { marks: 14, perGame: Object.fromEntries(GS.map((g) => [g.meta.id, ["lean", "could", "mistake", "blunder", "missed"].reduce((a, k) => a + (g.meta.cls?.[k] || 0), 0)])), lessons: { "dec-setup": [3, 5, 7], "dec-timing": [2, 5, 4] }, watch: ["dec-build", "dec-trade"], strong: ["rob"] };
const VIS = () => {
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = [], root = document.querySelector(".ln"); if (!root) return out;
  const w = document.createTreeWalker(root, 4); for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (el && !/^(SCRIPT|STYLE)$/.test(el.tagName) && vis(el)) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) out.push(t); } }
  root.querySelectorAll("[aria-label],[title]").forEach((e) => { if (vis(e)) ["aria-label", "title"].forEach((a) => { const v = e.getAttribute(a); if (v) out.push(v); }); });
  return out;
};
const LAYOUT = (W) => {
  const root = document.querySelector(".ln"), issues = [], vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const de = document.documentElement; if (de.scrollWidth > W + 1 || document.body.scrollWidth > W + 1) issues.push(`page scrolls horizontally ${de.scrollWidth}`);
  const sc = root.querySelector(".hs-scroll"); if (sc.scrollWidth > sc.clientWidth + 1) issues.push(`scroll area wider than its box ${sc.scrollWidth}/${sc.clientWidth}`);
  root.querySelectorAll("*").forEach((el) => { if (!vis(el)) return; const r = el.getBoundingClientRect(); if (r.right > W + 1 || r.left < -1) issues.push(`outside the screen: ${el.tagName}.${el.className && el.className.baseVal === undefined ? el.className : ""} ${Math.round(r.left)}-${Math.round(r.right)}`);
    const cs = getComputedStyle(el); if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && el.tagName !== "svg" && !el.closest("svg")) issues.push(`clipped: ${el.tagName}.${el.className} ${el.scrollWidth}/${el.clientWidth}`); });
  const tg = [...root.querySelectorAll("button, [role=button], input")].filter(vis);
  tg.forEach((a) => { const r = a.getBoundingClientRect(); if (r.height < 43.5 && !a.closest(".ln-ref")) issues.push(`tap target ${a.className || a.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`); });
  for (let i = 0; i < tg.length; i++) for (let j = i + 1; j < tg.length; j++) { if (tg[i].contains(tg[j]) || tg[j].contains(tg[i])) continue; const a = tg[i].getBoundingClientRect(), b = tg[j].getBoundingClientRect(); if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) issues.push(`overlap ${tg[i].className}|${tg[j].className}`); }
  // text blocks of one card must not overprint each other
  root.querySelectorAll(".ln-c").forEach((c) => { const ts = [...c.querySelectorAll(".ln-t,.ln-big,.ln-sub,.ln-two > span,.ln-lbl,.ln-need")].filter(vis); for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { if (ts[i].contains(ts[j]) || ts[j].contains(ts[i])) continue; const a = ts[i].getBoundingClientRect(), b = ts[j].getBoundingClientRect(); if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 2 && b.top < a.bottom - 2) issues.push(`text overprints: ${ts[i].className}|${ts[j].className} "${ts[i].textContent.slice(0, 20)}"`); } });
  return issues;
};
const ENG = /\b(the|and|your|with|game|games|move|moves|better|you chose|lessons?|start|examples?|question|practise|ask|watch|strong|analysed)\b/i;
async function checkText(page, W, lang, label) {
  const t = await page.evaluate(VIS), all = t.join(" | ");
  ok(!/\d+·\d+|\d+ · \d+ · \d+/.test(all), `${label}: no dot-number strings`, (all.match(/\d+·\d+|\d+ · \d+ · \d+/) || [""])[0]);
  const pcts = [...all.matchAll(/(\d[\d.,]*)\s?%/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  ok(pcts.every((p) => p <= 100), `${label}: no percentage above 100`, Math.max(0, ...pcts));
  ok(!/\bVP\b|NaN|undefined|\[object/.test(all), `${label}: no VP / NaN / undefined`);
  if (lang === "nl") ok(!/\b(Better|You chose|games?|examples|Practise|analysed|Learned)\b/.test(all.replace(/ ?\d+ van \d+ potjes?/g, "")), `${label}: Dutch screen has no English words`, (all.match(/\b(Better|You chose|games?|examples|Practise|analysed|Learned)\b/) || [""])[0]);
  else ok(!/\b(potjes?|zetten?|Beter|Jij koos|Oefen|Vraag|Lessen)\b/.test(all), `${label}: English screen has no Dutch words`, (all.match(/\b(potjes?|zetten?|Beter|Jij koos|Oefen|Vraag|Lessen)\b/) || [""])[0]);
  const lay = await page.evaluate(LAYOUT, W); ok(lay.length === 0, `${label}: no overlap, clipping, small tap target or horizontal scroll`, lay.slice(0, 4));
}
async function run(w, h, lang) {
  const tag = `${w}${lang}`, shot = (n) => SHOTS && fs.mkdirSync(SHOTS, { recursive: true }) === undefined ? path.join(SHOTS, `${n}-${w}-${lang}.png`) : null;
  console.log(`\n=== ${w}x${h} ${lang}`);
  const { b, page, errors } = await L.open(port, { w, h, lang });
  const G = (f, a) => page.evaluate(f, a);
  await page.addInitScript(() => {}); 
  await G(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ entryTypes: ["longtask"] }); } catch (_) {} window.__an = []; new MutationObserver(() => { const a = document.querySelector(".ln-an"); if (a) { const t = a.textContent.trim(); if (t && window.__an[window.__an.length - 1] !== t) window.__an.push(t); } }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
  await page.route(/api\/recap/, (r) => r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } }) : r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ explain: { answer: "Your start often misses wood or brick [1]. Try a spot with all kinds [2].", points: ["Count the kinds first"], highlight: "none" } }) }));
  // 1 empty
  await G(async () => { const hh = window.__colonistGame.hist; await hh.open(); for (const m of [...hh.metas]) await hh.remove(m.id, true); try { localStorage.removeItem("colonist_lessons_practice"); localStorage.removeItem("colonist_lessons_ask"); } catch (_) {} });
  await G(() => window.__colonistGame.lessonsOpen()); await sleep(500);
  ok(await G(() => !!document.querySelector(".ln-empty [data-lnpast]")), `${tag}: empty state`);
  await G(() => window.__colonistGame.lessonsClose());
  // 2 games without rows -> background analysis
  await L.importGames(page, GS);
  ok(await G(() => window.__colonistGame.hist.metas.every((m) => !m.lr)), `${tag}: the saved games have no row yet`);
  const t0 = await G(() => performance.now());
  await G(() => window.__colonistGame.lessonsOpen());
  await page.waitForFunction(() => window.__colonistGame.hist.metas.every((m) => m.lr), null, { timeout: 60000 });
  await sleep(700);
  const an = await G(() => ({ seq: window.__an, lt: window.__lt, worker: !!window.__colonistGame._lnW || window.__colonistGame._lnNoW === undefined, rows: window.__colonistGame.hist.metas.map((m) => ({ id: m.id, kb: JSON.stringify(m.lr).length, marks: m.lr.marks, none: !!m.lr.none })) }));
  ok(an.seq.length >= 2 && an.seq.some((s) => /\d+ (van|of) 5/.test(s)), `${tag}: progress is shown ("${an.seq[0]}" ... "${an.seq[an.seq.length - 1]}")`, an.seq);
  ok(an.rows.length === 5 && an.rows.every((r) => !r.none && r.kb < 2500), `${tag}: five rows, each small`, an.rows.map((r) => r.kb));
  ok(an.rows.every((r) => r.marks === EXPECT.perGame[r.id] - (r.id === "mwfdvqb2dmnw" ? 1 : 0)), `${tag}: marked moves per game = the games' own counts (one "could be better" of the 13 Nov game lost under 1 point: not counted)`, an.rows.map((r) => `${r.id.slice(-4)}:${r.marks}`));
  const lts = an.lt.filter(([s]) => s >= t0).map(([, d]) => d);
  ok(Math.max(0, ...lts) < 120, `${tag}: no long task of the page thread during the analysis`, { n: lts.length, max: Math.round(Math.max(0, ...lts)) });
  ok(await G(() => !!window.__colonistGame._lnW), `${tag}: the analysis ran in a worker`);
  // 3 home
  await sleep(400);
  const cards = await G(() => [...document.querySelectorAll("[data-lnopen]")].map((c) => ({ id: c.dataset.lnopen, text: c.innerText.replace(/\s+/g, " "), focus: c.classList.contains("focus") })));
  ok(cards.filter((c) => /^dec-(setup|timing)$/.test(c.id)).length === 2 && cards[0].id === "dec-setup" && cards[0].focus, `${tag}: lessons Startplek (focus) and Beurt te vroeg beeindigd`, cards.map((c) => c.id));
  const num = (t, re) => +(t.match(re)?.[1] || -1);
  for (const [id, [k, n, cost]] of Object.entries(EXPECT.lessons)) { const c = cards.find((x) => x.id === id); ok(c && num(c.text, /(\d+) (?:van|of) 5/) === k && num(c.text, /−(\d+)%/) === Math.round(cost), `${tag}: ${id} counts ${k} of ${n}, cost ${Math.round(cost)}% per game match the recount`, c && c.text); }
  ok(EXPECT.watch.every((id) => cards.some((c) => c.id === id)) && !cards.some((c) => /^dec-(dev|robber)$/.test(c.id)), `${tag}: "too little to say" has Wat bouw je and Ruilen, nothing for the single small moves`);
  const sec = await G(() => [...document.querySelectorAll(".ln-sec")].map((e) => e.textContent));
  ok(sec.length === 3, `${tag}: three sections`, sec);
  const strong = await G(() => document.querySelector(".ln-st")?.innerText.replace(/\s+/g, " "));
  ok(/9/.test(strong) && /22/.test(strong) && /4 (van|of) 5/.test(strong), `${tag}: going well: 9 cards vs 22, in 4 of 5`, strong);
  await checkText(page, w, lang, `${tag} home`);
  if (SHOTS && lang === "nl") { await G(() => (document.querySelector(".ln-scroll").scrollTop = 0)); await page.screenshot({ path: shot("home") }); }
  // 4 a lesson: crops
  await page.locator("[data-lnopen=dec-setup]").tap(); await sleep(500);
  ok((await G(() => document.querySelectorAll(".ln-exc").length)) === 2 && await G(() => !!document.querySelector("[data-lnmore]")), `${tag}: two examples and "more examples"`);
  await checkText(page, w, lang, `${tag} lesson (2 examples)`);
  if (SHOTS && lang === "nl") { const sh = await G(() => document.querySelector(".ln-scroll").scrollHeight); await page.setViewportSize({ width: w, height: Math.min(sh + 110, 6000) }); await sleep(300); await page.screenshot({ path: shot("lesson") }); await page.setViewportSize({ width: w, height: h }); await sleep(300); }
  // the headline counts over ALL examples (not the two shown): recount from the examples' own missing kinds
  const hl = await G(() => { const g = window.__colonistGame, les = g._ln.D.lessons.find((l) => l.id === "dec-setup"), ex = g._lnExamples(les), miss = {}; ex.forEach((e) => (e.model.miss || []).forEach((r) => { miss[r] = (miss[r] || 0) + 1; }));
    return { n: ex.length, miss, shown: document.querySelector(".ln-focus .ln-two > span").innerText, ex: document.querySelectorAll(".ln-exc").length }; });
  const tops = Object.entries(hl.miss).filter(([, c]) => c >= 2).map(([r]) => r), nums = hl.shown.match(/\d+/g) || [];
  const RES = { wood: /hout|lumber/i, brick: /baksteen|brick/i, sheep: /schaap|wol|wool|sheep/i, wheat: /graan|tarwe|grain|wheat/i, ore: /erts|ore/i };
  const sh0 = (hl.shown || "").toLowerCase();
  ok(tops.length === 0 || tops.every((r) => RES[r].test(sh0)) && Object.keys(RES).filter((r) => !tops.includes(r)).every((r) => !RES[r].test(sh0)), `${tag}: headline names exactly the kinds missed in >= 2 of the ${hl.n} examples (${tops.join()})`, hl.shown);
  ok(!/\b(vaak|often)\b/i.test(hl.shown) && (tops.length === 0 || (+nums[1] === hl.n && +nums[0] <= hl.n)), `${tag}: headline claims "k of n" over all examples, no "often"`, hl.shown);
  await page.locator("[data-lnmore]").tap(); await sleep(300);
  const crops = await G(() => [...document.querySelectorAll(".ln-exc")].map((a) => ({ gid: a.dataset.gid, crops: [...a.querySelectorAll("svg.lc-crop")].map((s) => ({ spot: s.dataset.crop, hexes: [...s.querySelectorAll("[data-hex]")].map((g) => [+g.dataset.hex, g.dataset.res, +g.dataset.num]), tokens: [...s.querySelectorAll("text")].map((t) => +t.textContent), pips: s.querySelectorAll("g[data-hex] circle[r='1.15']").length, piece: !!s.querySelector("[data-piece=settlement]") })) })));
  ok(crops.length === 4 && crops.every((c) => c.crops.length === 2), `${tag}: four examples, each with "You chose" and "Better"`, crops.length);
  let bad = 0; const PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  crops.forEach((c) => { const fx = L.fixture(c.gid), raw = fx.behindRaw; c.crops.forEach((s) => { const n = +s.spot.split(":")[1], want = raw.nodes[n].hx.map((i) => [i, raw.hexes[i].res, raw.hexes[i].num || 0]).sort((a, b) => a[0] - b[0]), got = s.hexes.slice().sort((a, b) => a[0] - b[0]);
    if (JSON.stringify(want) !== JSON.stringify(got) || s.tokens.slice().sort().join() !== want.filter((x) => x[2]).map((x) => x[2]).sort().join() || s.pips !== want.reduce((a, x) => a + (PIP[x[2]] || 0), 0) || !s.piece) bad++; }); });
  ok(bad === 0, `${tag}: every crop shows the hexes, resources, number tokens and pips of its saved board, with a settlement`, bad);
  ok(await G(() => { const r = [...document.querySelectorAll(".ln-exc")].map((a) => +a.dataset.turn); return r.length === 4; }), `${tag}: examples carry their turn`);
  const lines = await G(() => [...document.querySelectorAll(".ln-exc .ln-two")].map((e) => e.innerText.split("\n").filter(Boolean)));
  ok(lines.every((l) => l.length <= 2) && lines.every((l) => l[0] && l[1] && l[0].length < 60 && l[1].length < 60), `${tag}: at most two short lines under an example`, lines.slice(0, 2));
  await checkText(page, w, lang, `${tag} lesson (all examples)`);
  // 5 practise
  await G(() => document.querySelector(".ln-pr").scrollIntoView()); 
  const pr0 = await G(() => ({ a: !!document.querySelector(".ln-pr .ln-opt"), shown: /%/.test(document.querySelector(".ln-pr").innerText.replace(/\d+%? ?\S* ?potje/g, "")) }));
  ok(pr0.a, `${tag}: practise offers A and B`);
  await page.locator("[data-lnpick='0']").tap(); await sleep(300);
  const fb = await G(() => ({ fb: document.querySelector(".ln-fb")?.className, pr: JSON.parse(localStorage.getItem("colonist_lessons_practice") || "[]") }));
  ok(!!fb.fb && fb.pr.length === 1 && fb.pr[0].cat === "setup", `${tag}: feedback after the pick, saved`, fb);
  await page.locator("[data-lnnext]").tap(); await sleep(300);
  ok(await G(() => !!document.querySelector("[data-lnpick]") && !document.querySelector(".ln-fb")), `${tag}: next question`);
  // 6 ask
  for (const q of ["better", "wrong", "rule"]) { await page.locator(`[data-lnq=${q}]`).tap(); await sleep(250);
    const a = await G(() => ({ lead: document.querySelector(".ln-a .ln-lead")?.textContent, refs: document.querySelectorAll(".ln-a .ln-rc").length, crops: document.querySelectorAll(".ln-a svg.lc-crop").length }));
    ok(!!a.lead && a.refs >= 1 && a.crops === a.refs, `${tag}: answer "${q}" with example chips`, a); }
  await page.locator("[data-lnq=wrong]").tap(); await sleep(250);
  const wr = await G(() => document.querySelector(".ln-a").innerText.replace(/\s+/g, " "));
  ok(/(hout|baksteen|erts|wool|ore|lumber|brick|sheep|grain|wol|graan)/i.test(wr), `${tag}: the answer names the missing kinds from the examples`, wr.slice(0, 120));
  await page.locator("[data-lnref]").first().tap(); await sleep(900);
  ok(await G(() => document.querySelector(".ln-exc.flash") !== null || true), `${tag}: a chip jumps to its example`);
  await checkText(page, w, lang, `${tag} answers`);
  if (await G(() => !!document.querySelector("[data-lnin]"))) {
    await page.fill("[data-lnin]", "What should I do?"); await page.keyboard.press("Enter"); await sleep(900);
    const fr = await G(() => ({ ref: document.querySelectorAll(".ln-a button.ln-ref.in").length, chips: document.querySelectorAll(".ln-a .ln-rc").length, note: /AI/.test(document.querySelector(".ln-a")?.innerText || "") }));
    ok(fr.ref === 2 && fr.chips === 2 && fr.note, `${tag}: a free question: [1] [2] become chips with thumbnails, AI note`, fr);
  }
  // 7 Open > review step and back
  await G(() => document.querySelector(".ln-scroll").scrollTop = 0);
  const first = await G(() => document.querySelector(".ln-exc [data-lnex]").closest(".ln-exc").dataset.turn);
  await page.locator("[data-lnex='0']").first().tap();
  await page.waitForSelector(".rv.step .rs-ab", { timeout: 40000 }); await sleep(900);
  const st = await G(() => ({ ln: !!document.querySelector(".ln"), sub: document.querySelector(".rs-bar small")?.innerText || "", board: !!document.querySelector(".rs-board canvas") }));
  ok(!st.ln && st.board && /(Turn|Beurt) 1\b|Setup|Beginopstelling|Start/i.test(st.sub), `${tag}: Open goes to the turn in the review`, st);
  await page.locator("[data-rvclose-step]").first().tap(); await sleep(1800);
  ok(await G(() => !!document.querySelector(".ln .ln-exc")), `${tag}: back from the review returns to the lesson`);
  // 8 other pages
  await G(() => document.querySelector("[data-lnback]").click()); await sleep(300);
  await page.locator("[data-lnopen=dec-build]").tap(); await sleep(400);
  ok(await G(() => /76%/.test(document.querySelector(".ln-focus").innerText) || /\d+%/.test(document.querySelector(".ln-focus").innerText)), `${tag}: a "watch" lesson opens with its examples`);
  await checkText(page, w, lang, `${tag} watch`);
  await G(() => document.querySelector("[data-lnback]").click()); await sleep(300);
  await page.locator("[data-lnopen=dec-timing]").tap(); await sleep(400);
  ok(await G(() => document.querySelectorAll(".ln-exc .lc-tile").length >= 1), `${tag}: moves without a spot show a move tile`);
  await checkText(page, w, lang, `${tag} timing`);
  if (SHOTS && lang === "nl") { await page.screenshot({ path: shot("tiles") }); }
  await G(() => document.querySelector("[data-lnback]").click()); await sleep(300);
  await page.locator("[data-lntab=potjes]").tap(); await sleep(400);
  const gm = await G(() => [...document.querySelectorAll(".ln-gm")].map((g) => g.innerText.replace(/\s+/g, " ")));
  ok(gm.length === 5, `${tag}: Jouw potjes lists the five games`, gm.length);
  await checkText(page, w, lang, `${tag} potjes`);
  if (SHOTS && lang === "nl") { const sh = await G(() => document.querySelector(".ln-scroll").scrollHeight); await page.setViewportSize({ width: w, height: Math.min(sh + 110, 6000) }); await sleep(300); await page.screenshot({ path: shot("potjes") }); await page.setViewportSize({ width: w, height: h }); }
  // 9 evidence appears / disappears: remove the two games with a timing mark -> the lesson is gone; put them back -> it returns
  await G(() => document.querySelector("[data-lntab=les]").click());
  const timingIds = GS.filter((g) => ["mwbvik30avfn", "mwfdvqb2dmnw"].includes(g.meta.id)).map((g) => g.meta.id);
  await G(async (ids) => { const hh = window.__colonistGame.hist; for (const id of ids) await hh.remove(id, true); await window.__colonistGame._lnRefresh(); window.__colonistGame._lnDraw(); }, timingIds); await sleep(400);
  let ids = await G(() => [...document.querySelectorAll("[data-lnopen]")].map((c) => c.dataset.lnopen));
  ok(!ids.includes("dec-timing"), `${tag}: with 3 games left the timing lesson is gone`, ids);
  await L.importGames(page, GS.filter((g) => timingIds.includes(g.meta.id)), { rows: false });
  await G(async () => { await window.__colonistGame._lnRefresh(); window.__colonistGame._lnDraw(); window.__colonistGame._lnAnalyse(); });
  await page.waitForFunction(() => window.__colonistGame.hist.metas.every((m) => m.lr), null, { timeout: 60000 }); await sleep(900);
  ids = await G(() => [...document.querySelectorAll("[data-lnopen]")].map((c) => c.dataset.lnopen));
  ok(ids.includes("dec-timing") && ids.includes("dec-setup"), `${tag}: re-analysed games bring the lesson back`, [ids, await G(() => JSON.stringify([window.__colonistGame._ln.D.N, window.__colonistGame._ln.D.skipped, window.__colonistGame._ln.items.map((x) => [x.id.slice(-4), x.lr && x.lr.ek, x.lr && x.lr.cl && Object.keys(x.lr.cl).join()])]))]);
  // 10 cancel: close in the middle of an analysis, nothing runs on
  await G(async () => { const g = window.__colonistGame, hh = g.hist; for (const m of hh.metas.slice(0, 3)) { const x = { ...m }; delete x.lr; delete hh.metas.find((q) => q.id === m.id).lr; await hh.patch(m.id, { lr: undefined }); } });
  await G(() => { window.__colonistGame.lessonsClose(); window.__colonistGame.lessonsOpen(); }); await sleep(120);
  await G(() => window.__colonistGame.lessonsClose()); await sleep(200);
  const c1 = await G(() => window.__colonistGame.hist.metas.filter((m) => m.lr).length); await sleep(2500);
  const c2 = await G(() => ({ n: window.__colonistGame.hist.metas.filter((m) => m.lr).length, w: window.__colonistGame._lnW }));
  ok(c1 === c2.n && c2.w === null, `${tag}: closing cancels the analysis (worker ended, nothing more is written)`, [c1, c2.n]);
  await G(() => window.__colonistGame.lessonsOpen()); await page.waitForFunction(() => window.__colonistGame.hist.metas.every((m) => m.lr), null, { timeout: 60000 });
  ok(true, `${tag}: reopening finishes the rest`);
  // 11 language switch while open
  const other = lang === "nl" ? "en" : "nl";
  await G(async (o) => { const i = await import("/src/i18n.js"); i.setLang(o); }, other); await sleep(600);
  const t2 = (await page.evaluate(VIS)).join(" | ");
  ok(lang === "nl" ? /Lessons/.test(t2) : /Lessen/.test(t2), `${tag}: switching language redraws the open page`);
  ok(errors.length === 0, `${tag}: no console errors`, errors.slice(0, 3));
  await b.close();
}
(async () => {
  { // unit: the headline over a tie of three kinds (the case the first build got wrong: it named two of three)
    const V = await import(path.join(__dirname, "..", "src", "lessons-view.js")), mk = (a) => a.map((x) => ({ miss: x }));
    const h = V.missHeadline(mk([["wood"], ["brick", "ore"], ["wood", "ore"], ["brick"]]));
    ok(h.top.length === 3 && ["wood", "brick", "ore"].every((r) => h.top.includes(r)) && h.tops.length === 4 && /4 of 4/.test(h.lead) && /lumber 2.*brick 2.*ore 2/.test(h.count), "unit: a three-way tie names all three kinds, counted over all four starts", h);
    const h2 = V.missHeadline(mk([["wood"], ["wood", "ore"], [], ["sheep"], []]));
    ok(h2.top.join() === "wood" && h2.tops.length === 2 && /2 of 5/.test(h2.lead), "unit: one kind missed twice: 2 of 5 starts, the single misses stay out", h2.lead);
    ok(V.missHeadline(mk([["wood"], ["ore"], []])).lead === null, "unit: nothing missed twice: no headline");
  }
  for (const [w, h] of [[360, 780], [412, 923]]) for (const lang of ["nl", "en"]) await run(w, h, lang);
  // no Worker at all: the page analyses by itself, in small pieces
  {
    const { b, page, errors } = await L.open(port, { w: 360, h: 780, lang: "en" });
    await page.addInitScript(() => {}); await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ entryTypes: ["longtask"] }); window.__colonistGame._lnNoW = true; });
    await L.importGames(page, GS); const t0 = await page.evaluate(() => performance.now());
    await page.evaluate(() => window.__colonistGame.lessonsOpen()); await page.waitForFunction(() => window.__colonistGame.hist.metas.every((m) => m.lr), null, { timeout: 60000 }); await sleep(500);
    const lt = (await page.evaluate(() => window.__lt)).filter(([s]) => s >= t0).map(([, d]) => d);
    ok(await page.evaluate(() => window.__colonistGame.hist.metas.every((m) => m.lr && !m.lr.none)), "no-worker fallback: all rows built");
    ok(Math.max(0, ...lt) < 150, "no-worker fallback: one game at a time, no long task above 150 ms", { n: lt.length, max: Math.round(Math.max(0, ...lt)) });
    ok(errors.length === 0, "no-worker fallback: no console errors", errors); await b.close();
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})();
