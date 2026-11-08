// Pass & play screens at 360x780 in Sunny / Dusk / Night: nothing sideways, nothing clipped, nothing outside the screen.
const L = require("./lib.js");
let bad = 0; const chk = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m} ${x}`); if (!c) bad++; };
const probe = (page, sels) => page.evaluate((sels) => {
  const out = [], W = innerWidth;
  if (document.documentElement.scrollWidth > W + 1) out.push("page scrolls sideways");
  sels.forEach((s) => document.querySelectorAll(s).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    if (r.left < -0.5 || r.right > W + 0.5) out.push(`${s} outside (${Math.round(r.left)}..${Math.round(r.right)})`);
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible" && el.children.length === 0) out.push(`${s} text wider than box`);
  }));
  return out;
}, sels);
(async () => {
  for (const [pal, tag] of [["light", "sunny"], ["dusk", "dusk"], ["night", "night"]]) {
    const { browser, page } = await L.open(pal);
    page.on("pageerror", (e) => { console.log("PAGEERR", e.message); bad++; });
    await page.evaluate(() => localStorage.setItem("colonist_names_v1", JSON.stringify({ v: 1, me: "Tim", list: [{ n: "Tim", at: 3, g: 4 }, { n: "Rosa", at: 2, g: 3 }, { n: "Annabelle-Lou", at: 1, g: 1 }] })));
    await page.reload(); await page.waitForTimeout(1200);
    await page.locator('[data-home="friend"]').click(); await page.waitForTimeout(500);
    chk(!(await probe(page, [".hs-seat", ".hs-name-in", ".hp-chip", ".hp-chips", ".hs-help"])).length, `${tag} new game: names + chips`, JSON.stringify(await probe(page, [".hs-seat", ".hs-name-in", ".hp-chip", ".hp-chips", ".hs-help"])));
    await page.locator('[data-action="names"]').click(); await page.waitForTimeout(300);
    const pn = await probe(page, [".nm-card", ".nm-list li", ".nm-b"]); chk(!pn.length, `${tag} Names sheet`, JSON.stringify(pn));
    await page.locator(".nm-done").click();
    // end screen with seg, review header, gate
    await page.locator(".ng-cancel").click(); await page.waitForTimeout(300);
    await page.evaluate(async () => { localStorage.setItem("colonist_review_auto", "off"); });
    await L.reachEnd(page, "Tim", "Annabelle-Lou");
    await page.waitForTimeout(500);
    const pe = await probe(page, [".gs-recap", ".rv-for", ".rv-seg button", ".rv1", ".rvb"]); chk(!pe.length, `${tag} end screen: Review for`, JSON.stringify(pe));
    const other = await L.G(page, (g) => (g.viewerId === 0 ? 1 : 0));
    await page.locator(`[data-rvfor="${other}"]`).first().click(); await page.waitForTimeout(400);
    const pg = await probe(page, ["#hsGate .hs-name", "#hsGate .hs-go", "#hsGate .hs-why"]); chk(!pg.length && await L.vis(page, "#hsGate"), `${tag} hand-over cover`, JSON.stringify(pg));
    await page.locator("#hsGate .hs-go").click(); await page.waitForTimeout(400);
    await page.locator(".rvb").first().click(); await page.waitForTimeout(1500);
    await page.evaluate(() => window.__colonistGame._rvStop?.()); await page.waitForTimeout(600);
    const pr = await probe(page, [".rv-bar", ".rv-for", ".rv-seg button", ".rv-prog"]); chk(!pr.length, `${tag} review header + seg`, JSON.stringify(pr));
    await L.shot(page, `ov-review-${tag}`);
    // progress card per name (seeded)
    await page.evaluate(async () => {
      const g = window.__colonistGame; await g.hist.open(); const now = Date.now();
      for (let i = 0; i < 6; i++) { const w = i % 2; await g.hist.put({ id: "ov" + i, v: 1, start: now - i * 1e6, end: now - i * 1e6 + 5e5, mode: "classic", board: "island", n: 3, pts: 10, hot: true,
        seats: [{ name: "Tim", vp: 10 }, { name: "Annabelle-Lou", vp: 7 }, { name: "Van Geelen", vp: 5, key: "intermediate" }], me: null, winner: w, result: "table", turns: 20, ms: 1e6, star: false, rec: true,
        hn: [{ pid: 0, name: "Tim", rd: 20, acc: 70 + i, rn: 20, cls: { could: 2, missed: 1, mistake: 1, blunder: 0 }, mist: { build: 2 }, prov: false, mid: false, rk: "k" }, { pid: 1, name: "Annabelle-Lou", rd: 20, acc: 80 - i, rn: 20, cls: { could: 1, missed: 0, mistake: 2, blunder: 1 }, mist: { bank: 2 }, prov: false, mid: false, rk: "k" }] }, { state: {}, rv: null }); }
      g.histOpen();
    });
    await page.waitForTimeout(1200);
    const ph = await probe(page, [".hs-prog", ".pg-who button", ".pg-tiles", ".hs-row", ".hs-acc"]); chk(!ph.length, `${tag} progress per name + rows`, JSON.stringify(ph));
    await page.locator('[data-hwho]').nth(1).click(); await page.waitForTimeout(400);
    await L.shot(page, `ov-progress-${tag}`);
    await browser.close();
  }
  console.log(bad ? `FAILED ${bad}` : "ALL OK");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
