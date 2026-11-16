// v1.83 / v1.84 the dynamic AI page (recipes, no model call): validator unit cases, three real games, 360px layout, card accordion, turn sheet,
// labels that never contradict the result, Dutch rendering, contrast in several themes, tap targets, honest wording.
// node dynpage183.js PORT   (exports: the three uploads of lessons171; screenshots: $SHOTS)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9990; let fails = 0;
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f);
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/dynpage183";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const calls = []; page.on("request", (r) => { if (/api\/recap/.test(r.url())) calls.push(r.url()); });
  const kinds = [];
  const WEAK = /Weak plan|Probably weak plan|Headless chicken|Zwak plan|Kip zonder kop/;
  const gather = () => page.evaluate(() => { const g = window.__colonistGame, st = g._pgState(), fx = st.fx, txt = document.querySelector("[data-aibody]")?.innerText || "", badges = [...document.querySelectorAll(".ap-badge")].map((e) => e.textContent.trim()); return { txt, badges, strat_txt: [...document.querySelectorAll(".ap-c.lv-strategy")].map((e) => e.innerText).join(" "), won: fx.won, me: fx.me, strat: fx.strat[fx.me] && { tone: fx.strat[fx.me].verdict?.tone, head: fx.strat[fx.me].headless, code: fx.strat[fx.me].verdict?.code }, allWon: fx.strat.map((x, q) => ({ q, won: x.won, head: x.headless, tone: x.verdict?.tone })) }; });
  const CONTRAST = () => page.evaluate(() => {
    const parse = (c) => { const k = /color\(srgb ([^)]+)\)/.exec(c); if (k) { const p = k[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; } const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a ? [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
    const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
    const bgOf = (el) => { const chain = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { chain.push(c); if (c[3] >= 0.99) break; } } let b = [255, 255, 255, 1]; chain.reverse().forEach((c) => { b = over(c, b); }); return b; };
    const sel = [".ap-hl", ".ap-ft", ".ap-ti", ".ap-lv", ".ap-chip", ".ap-badge", ".ap-who", ".ap-leg > span", ".ap-leg em", ".ap-tile small", ".ap-tile .sb", ".ap-tile .big", ".ap-sub", ".ap-cap", ".ap-more", ".ap-br .n", ".ap-tx", ".ap-svg text.ax", ".ap-svg text.axl", ".ap-feed .fd"];
    const bad = [], seen = {};
    sel.forEach((q) => document.querySelectorAll(`.ap ${q}, ${q}`).forEach((el) => {
      if (!el.closest(".ap") || el.closest("[hidden]")) return; const r = el.getBoundingClientRect(); if (!r.width || !el.textContent.trim()) return;
      const cs = getComputedStyle(el), fg = el instanceof SVGElement ? parse(cs.fill) : parse(cs.color), bg = bgOf(el), f = over(fg, bg), a = lum(f), b = lum(bg), cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      seen[q] = Math.min(seen[q] ?? 99, +cr.toFixed(2)); if (cr < 4.5) bad.push(`${q} "${el.textContent.trim().slice(0, 14)}" ${cr.toFixed(2)}`);
    }));
    return { bad: bad.slice(0, 12), min: seen, n: Object.keys(seen).length };
  });
  const TAPS = () => page.evaluate(() => { const out = []; document.querySelectorAll(".ap-btn, .ap-chev, .ap-nav, .ap-more, .ap-svg .mk .hit, .ap-svg .pv .hit").forEach((e) => { if (e.closest("[hidden]")) return; const r = e.getBoundingClientRect(); if (r.width && (r.width < 39.5 || r.height < 39.5)) out.push(`${e.className.baseVal ?? e.className} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`); }); const mk = [...document.querySelectorAll(".ap-svg .mk .dot")].map((e) => e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2).sort((a, b) => a - b); let gap = 999; for (let i = 1; i < mk.length; i++) gap = Math.min(gap, mk[i] - mk[i - 1]); return { small: out, gap, n: mk.length }; });
  const NAMES = () => page.evaluate(() => [...document.querySelectorAll(".ap-br .n, .ap-sh-r .n > span, .ap-tb tbody th .ap-pl, .ap-who")].filter((e) => e.getBoundingClientRect().width).filter((e) => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; return e.getBoundingClientRect().height > lh * 1.6; }).map((e) => e.textContent));
  for (let gi = 0; gi < FILES.length; gi++) {
    const ex = JSON.parse(fs.readFileSync(FILES[gi], "utf8"));
    await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await G(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${ex.meta.id}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
    await page.locator("[data-rvt=ai]").tap(); await sleep(2200);
    const tag = `game${gi + 1}`;
    const S = await G(() => {
      const g = window.__colonistGame, st = g._pgState(), fx = st.fx, body = document.querySelector("[data-aibody]");
      const cards = [...document.querySelectorAll(".ap-c")], vis = cards.filter((c) => !c.closest("[data-pgrest]"));
      const feeds = [...document.querySelectorAll(".ap-tile small")].filter((e) => /start feeds/i.test(e.textContent)).length;
      const sigs = []; st.page.widgets.forEach((w) => [...w.blocks, ...w.expand].forEach((bk) => sigs.push(JSON.stringify(bk))));
      const over = [...document.querySelectorAll(".ap-c")].filter((c) => !c.closest("[data-pgrest][hidden]")).flatMap((c) => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll("svg, .ap-tiles, .ap-cells, .ap-leg, .ap-br, .ap-ti")].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map((e) => e.className.baseVal ?? e.className); });
      const total = fx.log.pts.map((l) => l.reduce((a, e) => a + e.n, 0)), vp = g.players.map((p) => p.victoryPoints);
      return { n: cards.length, vis: vis.length, more: !!document.querySelector("[data-pgmore]"), ids: st.page.widgets.map((w) => w.id), titles: cards.map((c) => c.querySelector(".ap-ti").textContent), hl: document.querySelector(".ap-hl")?.textContent, feeds, dropped: st.page.dropped, over, sw: document.documentElement.scrollWidth, bw: body.scrollWidth, cw: body.clientWidth, won: fx.won, luck: !!fx.luck, verdicts: fx.strat.map((s) => s?.verdict?.label), total, vp, ask: !!document.querySelector(".ai-ask [data-aiin]:not([disabled])"), chips: document.querySelectorAll(".ai-q").length, legacyCards: document.querySelectorAll(".ai-c").length, svgs: document.querySelectorAll(".ap-svg").length };
    });
    console.log(tag, JSON.stringify({ ids: S.ids, hl: S.hl, titles: S.titles, verdicts: S.verdicts, dropped: S.dropped }));
    kinds.push(S.won ? "won" : "lost");
    ok(S.n >= 2 && S.vis <= 4 && S.vis >= 2, `${tag}: a full page of cards, at most 4 visible`, [S.n, S.vis]);
    ok(S.n <= 4 ? !S.more : S.more, `${tag}: a More row exactly when more than 4 cards`, [S.n, S.more]);
    ok(S.hl && /points/.test(S.hl) && !/\bVP\b/.test(S.hl), `${tag}: headline from facts, "points"`, S.hl);
    ok(S.titles.every((t) => t.length > 8 && !/undefined|NaN|\[object/.test(t)), `${tag}: every title filled from facts`, S.titles);
    ok(S.feeds <= 1, `${tag}: the "start feeds the plan" tile is on the page at most once`, S.feeds);
    ok(S.over.length === 0 && S.sw <= 360 && S.bw <= S.cw + 1, `${tag}: no clipping or horizontal overflow at 360px`, [S.over, S.sw, S.bw, S.cw]);
    ok(S.total.every((t, i) => t === S.vp[i]), `${tag}: points by source add up to every player's final points`, [S.total, S.vp]);
    ok(S.svgs >= 2 && S.legacyCards === 0 && S.ask && S.chips >= 2, `${tag}: charts drawn, no model cards, ask bar and chips there`, [S.svgs, S.legacyCards, S.ask, S.chips]);
    ok(S.ids.includes("wc") && S.ids.includes("gs"), `${tag}: win chance and grand strategy cards`, S.ids);
    // the strategy verdict is the app's, with honest wording
    ok(S.verdicts.every((v) => !v || ["Solid plan", "Probably solid plan", "Hard to say", "Probably weak plan", "Weak plan"].includes(v)), `${tag}: verdict wording is one of the five app phrases`, S.verdicts);
    {
      const L = await gather(), cap = (x) => x;
      console.log(tag, "badges", JSON.stringify(L.badges), JSON.stringify(L.strat));
      if (L.won) ok(!WEAK.test(L.txt), `${tag}: a game You won never shows "Weak plan" / "Headless chicken"`, L.badges);
      ok(L.allWon.every((x) => !x.head || (x.tone === "bad" && !x.won)), `${tag}: headless only with a bad verdict and never for a winner`, L.allWon);
      ok(!(L.badges.some((b) => /Hard to say/.test(b)) && L.badges.some((b) => /Headless/.test(b))) && !(L.badges.some((b) => /Solid/.test(b)) && L.badges.some((b) => /Weak|Headless/.test(b))), `${tag}: labels do not contradict each other`, L.badges);
      ok(!/give or take|\bcost about\b|Stalled turns cost/i.test(L.txt) && !/±/.test(L.strat_txt) && !/stood at \d+% until/.test(L.txt), `${tag}: no invented ± and no "stood at X until" claim`, "");
      const win = S.titles.find((t) => /win chance/i.test(t)); if (win) ok(/\d+% to \d+% on turn \d+/.test(win), `${tag}: win chance title uses point wording`, win);
      const wt = S.titles.find((t) => /^Cards in hand, no points/.test(t)); if (wt) ok(/from dice/.test(wt), `${tag}: the resource rate says "from dice"`, wt);
      ok((await NAMES()).length === 0, `${tag}: no name wraps onto two lines`, await NAMES());
    }
    if (gi === 0 || gi === 2) { // two games as screenshots
      if (await page.locator("[data-pgmore]").count()) { await page.locator("[data-pgmore]").tap(); await sleep(400); }
      await page.setViewportSize({ width: 360, height: 2700 }); await sleep(1000);
      await page.screenshot({ path: `${SH}/${tag}-ai-tab.png` });
      await page.setViewportSize({ width: 360, height: 780 }); await sleep(600);
    }
    if (gi === 0) {
      // accordion: one card open at a time
      const exp = page.locator(".ap-c.exp .ap-chev");
      const nExp = await exp.count(); ok(nExp >= 2, "cards with details have a chevron", nExp);
      await exp.nth(0).tap(); await sleep(500);
      let st = await G(() => ({ open: document.querySelectorAll(".ap-c.open").length, ex: document.querySelector(".ap-c.open .ap-ex")?.hidden, filled: !!document.querySelector(".ap-c.open .ap-ex")?.children.length }));
      ok(st.open === 1 && st.ex === false && st.filled, "tap expands the card in place", st);
      await page.locator(".ap-c.exp:not(.open) .ap-chev").first().tap(); await sleep(500);
      st = await G(() => ({ open: document.querySelectorAll(".ap-c.open").length, hid: [...document.querySelectorAll(".ap-c:not(.open) .ap-ex")].every((e) => e.hidden) }));
      ok(st.open === 1 && st.hid, "opening another card collapses the first (accordion)", st);
      await page.screenshot({ path: `${SH}/${tag}-expanded.png` });
      // turn sheet
      await G(() => window.__colonistGame._pgToggle(document.querySelector(".ap-c.open"), document.querySelector("[data-aibody]"), window.__colonistGame._pgState().fx, false));
      const mk = page.locator(".ap-svg.win .mk"); ok(await mk.count() >= 2, "win chance line has tappable turn markers", await mk.count());
      const t0 = +(await mk.first().getAttribute("data-pgturn")); await mk.first().tap(); await sleep(700);
      const sh = await G(() => ({ title: document.querySelector(".ap-sheet .ap-sh-h b")?.textContent, rows: document.querySelectorAll(".ap-sh-r").length, btn: [...document.querySelectorAll(".ap-sh-a .ap-btn")].map((e) => e.textContent.trim()), match: document.querySelectorAll(".ap-c.match").length, glow: document.querySelectorAll(".ap-t.glow, .mk.glow").length, y: document.querySelector(".ap-sheet")?.getBoundingClientRect().bottom, h: innerHeight }));
      ok(sh.title === `Turn ${t0}` && sh.rows >= 1 && sh.btn.some((x) => /^Open /.test(x)) && sh.match >= 1, "marker tap opens the turn sheet with facts and Open buttons", sh);
      await page.screenshot({ path: `${SH}/${tag}-sheet.png` });
      { const T = await TAPS(); ok(T.small.length === 0, "tap targets (sheet buttons, chevrons, markers, arrows) are at least 40px", T.small); ok(T.n < 2 || T.gap >= 30, "win chance markers are spaced (no overlap of T1/T2/T3)", [T.n, T.gap]); }
      await page.locator("[data-pgnext]").tap(); await sleep(400);
      let t1 = await G(() => document.querySelector(".ap-sheet .ap-sh-h b")?.textContent); ok(t1 === `Turn ${t0 + 1}`, "next turn arrow", t1);
      await page.locator("[data-pgprev]").tap(); await page.locator("[data-pgprev]").tap(); await sleep(400);
      t1 = await G(() => document.querySelector(".ap-sheet .ap-sh-h b")?.textContent); ok(t1 === `Turn ${Math.max(1, t0 - 1)}`, "previous turn arrow", t1);
      await page.locator("[data-pgopen]").first().tap(); await sleep(800);
      st = await G(() => ({ sheet: !!document.querySelector(".ap-sheetw.on"), pulse: document.querySelectorAll(".ap-c.pulse").length }));
      ok(!st.sheet && st.pulse === 1, "Open <card> closes the sheet and pulses the card", st);
    }
  }
  ok(kinds.includes("won") && kinds.includes("lost"), "a won and a lost game rendered", kinds);
  ok(calls.length === 0, "no model call for the whole page", calls);
  // ── Dutch, then contrast in several themes (the same game, re-opened after each change) ──
  const EX0 = JSON.parse(fs.readFileSync(FILES[0], "utf8")), SHEET_NL = [];
  const reopen = async (set) => {
    await G((set) => { Object.entries(set).forEach(([k, v]) => (v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v))); }, set);
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); await sleep(800);
    await G(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${EX0.meta.id}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500);
    await page.locator("[data-rvt=ai]").tap(); await sleep(2200);
    if (await page.locator("[data-pgmore]").count()) { await page.locator("[data-pgmore]").tap(); await sleep(400); }
  };
  await reopen({ colonist_recap_lang: "nl" });
  {
    await page.locator(".ap-c.exp .ap-chev").first().tap(); await sleep(500);
    const N = await G(() => { const t = document.querySelector("[data-aibody]").innerText, g = window.__colonistGame; return { t, hl: document.querySelector(".ap-hl")?.innerText, titles: [...document.querySelectorAll(".ap-ti")].map((e) => e.innerText), lv: [...document.querySelectorAll(".ap-lv")].map((e) => e.innerText), badges: [...document.querySelectorAll(".ap-badge")].map((e) => e.innerText), more: document.querySelector(".ap-more")?.innerText, foot: document.querySelector(".ap-ft")?.innerText, ex: document.querySelector(".ap-c.open .ap-ex")?.innerText }; });
    console.log("NL", JSON.stringify({ hl: N.hl, titles: N.titles, lv: N.lv, badges: N.badges, foot: N.foot }));
    const EN = /\b(You|Your|Win chance|Turn|turn|Points|points|Stalled|stalled|Settlement|Settlements|Cities|City|Road|Close|Cards in hand|Tap a dot|Summary|Yes|Partly|waiting|Strategy|Decision|Luck|Game|Near miss|Show|Details|Start feeds|Weak|Solid|Hard to say|Headless|won|stood|came|from dice)\b/;
    ok(/punten/.test(N.hl) && !/\bVP\b/.test(N.t), "NL: headline says \"punten\", never VP", N.hl);
    ok(N.lv.every((x) => /^(SPEL|BESLISSING|STRATEGIE|GELUK|NET NIET)$/i.test(x)), "NL: card levels are Dutch", N.lv);
    ok(N.badges.every((b) => /plan|Moeilijk|Kip|beter|Nipt/i.test(b) && !/\b(Weak|Solid|Hard|Headless)\b/.test(b)), "NL: verdict words are Dutch", N.badges);
    const eng = N.t.split("\n").filter((l) => EN.test(l) && !/^(Blaauw|Van Geelen|Groenewoud)/.test(l)); // names of players may be anything; every other line must be Dutch
    ok(eng.length === 0, "NL: no English words left on the page (titles, labels, captions, legends, buttons)", eng.slice(0, 8));
    ok(/Meer|Samenvatting/.test(N.t) && !/Beta\.$/.test("") && /Samenvatting uit de cijfers/.test(N.foot || ""), "NL: footer and More are Dutch", [N.more, N.foot]);
    await page.locator(".ap-svg.win .mk").first().tap(); await sleep(700);
    const Sh = await G(() => ({ t: document.querySelector(".ap-sheet")?.innerText,  labels: [...document.querySelectorAll(".ap-sheet [aria-label], .ap-sheet button")].map((e) => (e.getAttribute("aria-label") || e.innerText).trim()) }));
    ok(/^Beurt \d+/.test(Sh.t || "") && /Winkans in deze beurt|Er veranderde weinig/i.test(Sh.t) && Sh.labels.some((x) => /^Sluit$/.test(x)) && Sh.labels.some((x) => /Toon het bord/.test(x)) && !/\b(Close|Show the board|Previous|Next|Win chance)\b/.test(Sh.t + Sh.labels.join(" ")), "NL: the turn sheet is Dutch", [Sh.t.slice(0, 200), Sh.labels]);
    await page.screenshot({ path: `${SH}/nl-sheet.png` });
    await page.locator("[data-pgclose]").tap(); await sleep(400);
  }
  for (const [name, set] of [["A light", { "colonist.theme": "A", colonist_recap_lang: "en", "colonist.palette": "light" }], ["A night", { "colonist.theme": "A", colonist_recap_lang: "en", "colonist.palette": "night" }], ["B wood", { "colonist.theme": "B" }], ["C silhouette", { "colonist.theme": "C" }], ["classic", { "colonist.theme": "classic" }]]) {
    await reopen({ colonist_recap_lang: "en", "colonist.palette": null, ...set });
    await page.locator(".ap-c.exp .ap-chev").first().tap(); await sleep(500);
    const th = await G(() => document.documentElement.dataset.theme);
    const C = await CONTRAST(), T = await TAPS();
    ok(C.bad.length === 0 && C.n >= 10, `contrast (theme ${name}): text on cards, pills, chips, legend and chart labels is at least 4.5:1`, [C.bad, C.n]);
    ok(T.small.length === 0, `tap targets >= 40px (theme ${name})`, T.small);
    const solid = await G(() => [...document.querySelectorAll(".ap-c")].filter((c) => !c.closest("[hidden]")).every((c) => { const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(c).backgroundColor); const p = m[1].split(/[ ,/]+/).map(Number); return p.length < 4 || p[3] >= 0.99; }));
    ok(solid, `cards have an opaque surface (theme ${name})`, th);
    if (name === "B wood") { await page.setViewportSize({ width: 360, height: 2900 }); await sleep(800); await page.screenshot({ path: `${SH}/B-wood-ai-tab.png` }); await page.setViewportSize({ width: 360, height: 780 }); }
  }
  await reopen({ "colonist.theme": null, "colonist.palette": null, colonist_recap_lang: "en" });
  // ── validator unit cases on the real facts of the last game ──
  const U = await G(async () => {
    const g = window.__colonistGame, { validatePage, recipePage, partsOk, textOk } = await import("./src/review/ai-page.js"), fx = g._pgState().fx, Y = fx.keys[fx.me];
    const W = (o) => ({ id: "t", level: "Game", short: "test", title: [{ ref: `name.${Y}`, fmt: "player" }, " played."], blocks: [{ p: "bars", rows: [{ player: Y, ref: `rate.wood.${Y}` }, { player: Y, ref: `pts.${Y}` }] }], ...o });
    const v = (w, extra = {}) => validatePage({ widgets: [w], ...extra }, fx);
    const out = {};
    out.good = v(W({}));
    out.badRef = v(W({ title: [{ ref: "wc.nobody@3" }, " x."] }));
    out.digits = v(W({ title: ["You stood at 55 percent in turn 12."] }));
    out.digitRef = v(W({ title: [{ ref: `name.${Y}`, fmt: "player" }, " scored 9."] }));
    out.causal = v(W({ title: ["You lost because the dice were bad."] }));
    out.causal2 = v(W({ title: ["That led to a loss."] }));
    out.invented = v(W({ blocks: [{ p: "tiles", items: [{ kind: "num", label: "Invented", ref: "luck.invented.you" }] }] }));
    out.turnBad = v(W({ title: [{ ref: "turn.9999", fmt: "turn" }] }));
    out.badBlockOnly = v(W({ blocks: [{ p: "line", metric: "winchance", players: ["zzz"] }, { p: "compare", dec: 9999 }, { p: "nope" }] }));
    out.requires = v(W({ requires: ["strat.zzz.pivot"] }));
    out.unitDigit = v(W({ blocks: [{ p: "bars", rows: [{ player: Y, ref: `pts.${Y}` }], unit: "cards in 100 turns" }] }));
    out.caps = validatePage({ widgets: Array.from({ length: 9 }, (_, i) => W({ id: `w${i}`, blocks: [{ p: "text", parts: ["Note " + "abcdefghi"[i] + " only."] }] })), follow: ["a?", "b?", "c?", "d?", "e?", "f?", "Has 3 digits?"].map((q) => ({ q })) }, fx);
    // dedupe: the same tile (and the same stack) twice on the page
    const tile = { p: "tiles", items: [{ kind: "startfeed", player: Y }, { kind: "num", label: "Stalled turns", ref: `strat.${Y}.idleN`, of: `strat.${Y}.turns` }] };
    out.dupTile = validatePage({ widgets: [W({ id: "a", blocks: [{ p: "badge", player: Y }, tile, { p: "stack", player: Y }] }), W({ id: "b", blocks: [{ p: "tiles", items: [{ kind: "startfeed", player: Y }, { kind: "num", label: "Waiting", ref: `strat.${Y}.waitN`, of: `strat.${Y}.idleN` }] }, { p: "stack", player: Y }, { p: "badge", player: Y }] })] }, fx);
    out.dupOnlyTile = validatePage({ widgets: [W({ id: "a", blocks: [tile] }), W({ id: "b", blocks: [{ p: "tiles", items: [{ kind: "startfeed", player: Y }] }, { p: "bars", rows: [{ player: Y, ref: `pts.${Y}` }] }] })] }, fx);
    out.dupBars = validatePage({ widgets: [W({ id: "a" }), W({ id: "b" })] }, fx);
    out.empty = validatePage({ widgets: [{ id: "x", level: "Nope", title: ["x."], blocks: [] }] }, fx);
    out.dirOk = partsOk([{ dir: [`wc.${Y}@1`, `wc.${Y}@2`], up: "rose", down: "slid" }], fx);
    out.dirDigit = partsOk([{ dir: [`wc.${Y}@1`, `wc.${Y}@2`], up: "rose 5", down: "slid" }], fx);
    out.recipe = recipePage(fx).widgets.map((w) => w.id);
    out.recipeDrops = g._pgState().page.dropped.map((d) => d.why);
    const strat = JSON.stringify(fx.strat.map((s) => [s.plan, s.stalled, s.verdict, s.pivot])), fx2 = (await import("./src/review/ai-index.js")).buildFacts(g);
    out.det = strat === JSON.stringify(fx2.strat.map((s) => [s.plan, s.stalled, s.verdict, s.pivot]));
    const shape = (r) => ({ w: r.widgets.length, ids: r.widgets.map((w) => w.id), titleFb: r.widgets.map((w) => w.titleFallback), blocks: r.widgets.map((w) => w.blocks.map((b) => b.p + (b.items ? ":" + b.items.map((i) => i.kind).join("+") : ""))), dropped: r.dropped.map((d) => d.why), follow: r.follow.length });
    return Object.fromEntries(Object.entries(out).map(([k, r]) => [k, r && r.widgets ? shape(r) : r]));
  });
  console.log(JSON.stringify(U));
  ok(U.good.w === 1 && !U.good.titleFb[0] && U.good.dropped.length === 0, "validator: a valid widget passes untouched", U.good);
  ok(U.badRef.titleFb[0] === true && U.badRef.w === 1, "validator: an unresolvable ref in the title -> fallback title, widget kept", U.badRef);
  ok(U.digits.titleFb[0] && U.digitRef.titleFb[0], "validator: a number typed in free text is rejected (numbers only through refs)", [U.digits.titleFb, U.digitRef.titleFb]);
  ok(U.causal.titleFb[0] && U.causal2.titleFb[0], "validator: causal words are rejected", [U.causal.titleFb, U.causal2.titleFb]);
  ok(U.invented.w === 0 && U.invented.dropped.some((x) => /no valid block/.test(x)), "validator: an invented fact ref drops the block, then the widget", U.invented);
  ok(U.turnBad.titleFb[0], "validator: a turn beyond the game is rejected", U.turnBad.titleFb);
  ok(U.badBlockOnly.w === 0, "validator: every invalid block dropped, widget with none dropped", U.badBlockOnly);
  ok(U.requires.titleFb[0], "validator: failed `requires` -> fallback title (the app decides the claim)", U.requires.titleFb);
  ok(U.unitDigit.blocks[0][0] === "bars" && U.unitDigit.w === 1, "validator: a unit label with digits does not poison the block (unit dropped)", U.unitDigit);
  ok(U.caps.w === 6 && U.caps.follow === 4, "validator: complexity caps (6 widgets, 4 follow chips, a chip with digits rejected)", [U.caps.w, U.caps.follow]);
  ok(U.dupTile.blocks[0].join() === "badge,tiles:startfeed+num,stack" && U.dupTile.blocks[1].join() === "tiles:num", "dedupe: the second 'start feeds' tile, the second stack and the second badge are dropped; the new number tile stays", U.dupTile.blocks);
  ok(U.dupOnlyTile.w === 2 && !U.dupOnlyTile.blocks[1].some((x) => x.startsWith("tiles")) && U.dupOnlyTile.dropped.some((x) => /dup tile/.test(x)), "dedupe: a tiles block that only repeats a tile disappears", U.dupOnlyTile.blocks);
  ok(U.dupBars.w === 1 && U.dupBars.dropped.some((x) => /dup bars|no valid block/.test(x)), "dedupe: identical bars on another card -> that card has nothing new and is dropped", U.dupBars);
  ok(U.empty.w === 0 && U.recipe.length >= 2, "validator: nothing valid -> empty (callers use recipes); recipes give a page", [U.empty.w, U.recipe]);
  ok(U.dirOk && U.dirOk.length === 1 && U.dirDigit === null, "validator: direction words only through {dir}, and without digits", [!!U.dirOk, U.dirDigit]);
  ok(U.det === true, "strategy facts are deterministic", U.det);
  ok(U.recipeDrops.length === 0, "recipes: nothing of the recipe page is dropped by the validator (no invalid tiles block, no duplicate stack)", U.recipeDrops);
  ok(U.recipeDrops.every((x) => /dup|cap|invalid|no valid|requires/.test(x)), "recipes: the only things dropped are duplicates or invalid bits", U.recipeDrops);
  ok(errors.length === 0, "no page errors", errors);
  await b.close();
  console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})();
