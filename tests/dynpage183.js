// v1.83 the dynamic AI page (recipes, no model call): validator unit cases, three real games, 360px layout, card accordion, turn sheet.
// node dynpage183.js PORT   (exports: the three uploads of lessons171; screenshots: $SHOTS)
const { open: openApp, sleep } = require("/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/redesign/lib.js");
const fs = require("fs"); const port = +process.argv[2] || 9990; let fails = 0;
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const FILES = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f);
const SH = process.env.SHOTS || "/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/dynpage183";
fs.mkdirSync(SH, { recursive: true });
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
(async () => {
  const { b, page, errors } = await openApp(port);
  const G = (f, a) => page.evaluate(f, a);
  const calls = []; page.on("request", (r) => { if (/api\/recap/.test(r.url())) calls.push(r.url()); });
  const kinds = [];
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
      const cards = [...document.querySelectorAll(".pg-c")], vis = cards.filter((c) => !c.closest("[data-pgrest]"));
      const feeds = [...document.querySelectorAll(".pg-tile small")].filter((e) => /start feeds/i.test(e.textContent)).length;
      const sigs = []; st.page.widgets.forEach((w) => [...w.blocks, ...w.expand].forEach((bk) => sigs.push(JSON.stringify(bk))));
      const over = [...document.querySelectorAll(".pg-c")].filter((c) => !c.closest("[data-pgrest][hidden]")).flatMap((c) => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll("svg, .pg-tiles, .pg-cells, .pg-leg, .pg-br, .pg-ti")].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map((e) => e.className.baseVal ?? e.className); });
      const total = fx.log.pts.map((l) => l.reduce((a, e) => a + e.n, 0)), vp = g.players.map((p) => p.victoryPoints);
      return { n: cards.length, vis: vis.length, more: !!document.querySelector("[data-pgmore]"), ids: st.page.widgets.map((w) => w.id), titles: cards.map((c) => c.querySelector(".pg-ti").textContent), hl: document.querySelector(".pg-hl")?.textContent, feeds, dropped: st.page.dropped, over, sw: document.documentElement.scrollWidth, bw: body.scrollWidth, cw: body.clientWidth, won: fx.won, luck: !!fx.luck, verdicts: fx.strat.map((s) => s?.verdict?.label), total, vp, ask: !!document.querySelector(".ai-ask [data-aiin]:not([disabled])"), chips: document.querySelectorAll(".ai-q").length, legacyCards: document.querySelectorAll(".ai-c").length, svgs: document.querySelectorAll(".pg-svg").length };
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
    if (gi === 0 || gi === 2) { // two games as screenshots
      if (await page.locator("[data-pgmore]").count()) { await page.locator("[data-pgmore]").tap(); await sleep(400); }
      await page.setViewportSize({ width: 360, height: 2700 }); await sleep(1000);
      await page.screenshot({ path: `${SH}/${tag}-ai-tab.png` });
      await page.setViewportSize({ width: 360, height: 780 }); await sleep(600);
    }
    if (gi === 0) {
      // accordion: one card open at a time
      const exp = page.locator(".pg-c.exp .pg-chev");
      const nExp = await exp.count(); ok(nExp >= 2, "cards with details have a chevron", nExp);
      await exp.nth(0).tap(); await sleep(500);
      let st = await G(() => ({ open: document.querySelectorAll(".pg-c.open").length, ex: document.querySelector(".pg-c.open .pg-ex")?.hidden, filled: !!document.querySelector(".pg-c.open .pg-ex")?.children.length }));
      ok(st.open === 1 && st.ex === false && st.filled, "tap expands the card in place", st);
      await page.locator(".pg-c.exp:not(.open) .pg-chev").first().tap(); await sleep(500);
      st = await G(() => ({ open: document.querySelectorAll(".pg-c.open").length, hid: [...document.querySelectorAll(".pg-c:not(.open) .pg-ex")].every((e) => e.hidden) }));
      ok(st.open === 1 && st.hid, "opening another card collapses the first (accordion)", st);
      await page.screenshot({ path: `${SH}/${tag}-expanded.png` });
      // turn sheet
      await G(() => window.__colonistGame._pgToggle(document.querySelector(".pg-c.open"), document.querySelector("[data-aibody]"), window.__colonistGame._pgState().fx, false));
      const mk = page.locator(".pg-svg.win .mk"); ok(await mk.count() >= 2, "win chance line has tappable turn markers", await mk.count());
      const t0 = +(await mk.first().getAttribute("data-pgturn")); await mk.first().tap(); await sleep(700);
      const sh = await G(() => ({ title: document.querySelector(".pg-sheet .pg-sh-h b")?.textContent, rows: document.querySelectorAll(".pg-sh-r").length, btn: [...document.querySelectorAll(".pg-sh-a .pg-btn")].map((e) => e.textContent.trim()), match: document.querySelectorAll(".pg-c.match").length, glow: document.querySelectorAll(".pg-t.glow, .mk.glow").length, y: document.querySelector(".pg-sheet")?.getBoundingClientRect().bottom, h: innerHeight }));
      ok(sh.title === `Turn ${t0}` && sh.rows >= 1 && sh.btn.some((x) => /^Open /.test(x)) && sh.match >= 1, "marker tap opens the turn sheet with facts and Open buttons", sh);
      await page.screenshot({ path: `${SH}/${tag}-sheet.png` });
      await page.locator("[data-pgnext]").tap(); await sleep(400);
      let t1 = await G(() => document.querySelector(".pg-sheet .pg-sh-h b")?.textContent); ok(t1 === `Turn ${t0 + 1}`, "next turn arrow", t1);
      await page.locator("[data-pgprev]").tap(); await page.locator("[data-pgprev]").tap(); await sleep(400);
      t1 = await G(() => document.querySelector(".pg-sheet .pg-sh-h b")?.textContent); ok(t1 === `Turn ${Math.max(1, t0 - 1)}`, "previous turn arrow", t1);
      await page.locator("[data-pgopen]").first().tap(); await sleep(800);
      st = await G(() => ({ sheet: !!document.querySelector(".pg-sheetw.on"), pulse: document.querySelectorAll(".pg-c.pulse").length }));
      ok(!st.sheet && st.pulse === 1, "Open <card> closes the sheet and pulses the card", st);
    }
  }
  ok(kinds.includes("won") && kinds.includes("lost"), "a won and a lost game rendered", kinds);
  ok(calls.length === 0, "no model call for the whole page", calls);
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
  ok(U.recipeDrops.every((x) => /dup|cap|invalid|no valid|requires/.test(x)), "recipes: the only things dropped are duplicates or invalid bits", U.recipeDrops);
  ok(errors.length === 0, "no page errors", errors);
  await b.close();
  console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
})();
