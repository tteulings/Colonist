// v1.90.2 round 2, the card and the round view as the reader sees them (real app, real exports, 360 px):
//  * the ask bar: chips are one row (v1.91, scrolls sideways) and no chip is cut; the chart hint says "point" (EN "Tap a point"), "stippen" stay for resource dots
//  * a round view: the headline's number is the round's Total; a large rest is explained by listing the next steps; the "what the moves earned" block names whose moves and says why it is not in the total
//  * the card rows: a concrete "why" line on a lost-by-dice round (dots of the one who was paid against yours) and the self-explaining "Graan op Van Geelens getallen: 22 stippen, jij 5"
//  * the chat: the turn the user names, several players, a bare name (through the app's own ask path)
//  * the opponents' green: apart from the green of a gain (dE) and from the other seats under colour blindness, text on the sheet readable
//   node tests/ux1902.js PORT      (server: node step105/tests/serve.mjs ROOT PORT)
const { chromium } = require("playwright"); const fs = require("fs");
const port = +process.argv[2] || 9990, UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const G = { mwg5v7k7j2cc: UP + "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", mwg74y2d49gz: UP + "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json" };
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ── the palette (Node side) ──
  const S = await import("../src/themes/seats.js"), hex = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lab = (c) => { const [r, g, b] = c.map(lin); const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883, f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]; };
  const dE = (a, b) => { const p = lab(hex(a)), q = lab(hex(b)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }; // CIE76 (stricter than 2000 for greens: it sees all of the lightness and chroma)
  const M = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]], deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]] };
  const enc = (v) => Math.round(255 * (Math.max(0, Math.min(1, v)) <= 0.0031308 ? 12.92 * Math.max(0, Math.min(1, v)) : 1.055 * Math.max(0, Math.min(1, v)) ** (1 / 2.4) - 0.055));
  const sim = (h, m) => { const c = hex(h).map(lin), o = M[m].map((r) => r[0] * c[0] + r[1] * c[1] + r[2] * c[2]); return "#" + o.map((v) => enc(v).toString(16).padStart(2, "0")).join(""); };
  const cr = (a, b) => { const L = (h) => { const [r, g, b2] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b2; }, x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const POS_NIGHT = "#7DBA5C", POS_DAY = "#2E7D4F", gN = S.SEAT_PC_NIGHT.green, gD = S.SEAT_PC_DAY.green;
  ok(dE(gN.base, POS_NIGHT) >= 30 && dE(S.SEAT_TEXT_NIGHT.green, POS_NIGHT) >= 22, "night: the opponents' green (piece and text) is clearly apart from the green of a gain", [dE(gN.base, POS_NIGHT).toFixed(1), dE(S.SEAT_TEXT_NIGHT.green, POS_NIGHT).toFixed(1)]);
  ok(dE(gD.base, POS_DAY) >= 20 && dE(gD.base, POS_DAY) > dE("#0B5E44", POS_DAY) + 3, "day: the opponents' green is apart from the green of a gain, and further than the old #0B5E44", [dE(gD.base, POS_DAY).toFixed(1), dE("#0B5E44", POS_DAY).toFixed(1)]);
  ok(cr(S.SEAT_TEXT_NIGHT.green, "#10202A") >= 7 && cr(S.SEAT_TEXT_DAY.green, "#FBF6EA") >= 7, "the green seat's text reads on the night sheet and on paper (AAA)", [cr(S.SEAT_TEXT_NIGHT.green, "#10202A").toFixed(1), cr(S.SEAT_TEXT_DAY.green, "#FBF6EA").toFixed(1)]);
  const names = ["red", "blue", "orange", "green", "ivory", "purple"]; let worst = 1e9, wp = "";
  for (const [set, key] of [[S.SEAT_PC_NIGHT, "night"], [S.SEAT_PC_DAY, "day"]]) for (const m of ["none", "protan", "deutan"]) for (let i = 0; i < 6; i++) if (names[i] === "green") for (let j = 0; j < 6; j++) if (j !== i) { const a = set.green.base, b = set[names[j]].base, d = dE(m === "none" ? a : sim(a, m), m === "none" ? b : sim(b, m)); if (d < worst) { worst = d; wp = `${key} ${m} green/${names[j]}`; } }
  ok(worst >= 14, "the green seat stays apart from every other seat, also for red-green colour blindness (CIE76 >= 14)", [worst.toFixed(1), wp]);

  // ── the app ──
  const b = await chromium.launch(), errs = [];
  const open = async (id, lang) => {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" }), page = await ctx.newPage(); page.on("pageerror", (e) => errs.push(e.message));
    await page.addInitScript((lang) => { localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_recap_lang", lang); localStorage.setItem("colonist.palette", "night"); localStorage.setItem("katan_ai_compose", "0"); }, lang);
    await page.goto(`http://localhost:${port}/`); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
    const ex = JSON.parse(fs.readFileSync(G[id], "utf8")), gid = ex.meta.id;
    await page.evaluate(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex);
    await page.evaluate(() => window.__colonistGame.histOpen()); await sleep(1500);
    await page.locator(`[data-hrow="${gid}"]`).tap(); await sleep(900);
    await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 });
    await page.evaluate(() => { window.__colonistGame._rvTab = "ai"; }); await page.locator(".rv .rv-tabs button", { hasText: /AI/ }).first().tap();
    let ready = false, done = false; for (let i = 0; i < 400 && !done; i++) { const s = await page.evaluate(() => { const g = window.__colonistGame; return { r: !!g._ldReady?.(), d: !!g._ldJob && !g._ldJob.busy }; }); ready = s.r; done = s.d; if (!done) await sleep(400); }
    await sleep(800); return { page, ctx, ready, done };
  };
  for (const lang of ["nl", "en"]) {
    const { page, ctx, ready } = await open("mwg5v7k7j2cc", lang); ok(ready, `${lang}: the ledger is complete`);
    await page.evaluate(() => document.querySelector(".rv-scroll")?.scrollTo(0, 0)); await sleep(500);
    // the ask bar
    const C = await page.evaluate(() => { const c = document.querySelector(".ai-chips"); if (!c) return null; const r = c.getBoundingClientRect(), qs = [...c.querySelectorAll(".ai-q")].map((q) => q.getBoundingClientRect()); const tops = new Set(qs.map((q) => Math.round(q.top))); return { n: qs.length, rows: tops.size, sw: c.scrollWidth, cw: c.clientWidth, over: qs.filter((q) => q.right > r.right + 0.5 || q.left < r.left - 0.5).length, texts: [...c.querySelectorAll(".ai-q")].map((q) => q.textContent), clipped: [...c.querySelectorAll(".ai-q")].filter((q) => q.scrollWidth > q.clientWidth + 1).length }; });
    ok(C && C.n >= 2 && C.rows <= 1 && !C.clipped, `${lang}: the ask chips are one row (v1.91: it scrolls sideways, the bar stays under 15% of the screen) and no chip is cut`, C);
    // the chart hint
    const H = await page.evaluate(() => document.querySelector(".ai")?.innerText || "");
    ok(lang === "nl" ? /Tik op een punt in de grafiek/.test(H) && !/Tik op een stip/.test(H) : /Tap a point on the chart/.test(H) && !/Tap a dot/.test(H), `${lang}: the chart hint says point, not dot`);
    // the rows: B11's why line says what the dots are; B3 has a concrete why (dots of the one who was paid against yours)
    const rows = await page.evaluate(() => [...document.querySelectorAll(".lg-rr")].map((r) => ({ t: r.dataset.lground, r2: r.querySelector(".lg-r2")?.innerText || "", r3: r.querySelector(".lg-r3")?.innerText || "" })));
    const r11 = rows.find((r) => r.t === "11"), r3 = rows.find((r) => r.t === "3");
    ok(r11 && (lang === "nl" ? /^Graan op .+ getallen: \d+ stippen, jij\s\d+\.?$/.test(r11.r3) : /^Wheat on .+ numbers: \d+ dots, you\s\d+\.?$/.test(r11.r3)), `${lang}: B11's line explains the dots: "${r11 && r11.r3}"`);
    ok(r3 && (lang === "nl" ? /^(Baksteen|Hout|Wol|Graan|Erts) op .+ getallen: \d+ stippen, jij\s\d+\.?$/.test(r3.r3) : /^(Brick|Wood|Sheep|Wheat|Ore) on .+ numbers: \d+ dots, you\s\d+\.?$/.test(r3.r3)) && /\b5/.test(r3.r2), `${lang}: B3 has a concrete why line next to the rolls that paid: "${r3 && r3.r3}"`);
    // v1.90.3 no "with which X built" clause (it over-claimed: wrong order, wrong resources) and no capital "Jij"/"You" inside a sentence; B3's why row is at most 3 lines
    const allTxt = rows.map((r) => r.r2 + "\n" + r.r3).join("\n") + "\n" + H;
    ok(!/waarmee|used to build|with which|which .{0,30} built/i.test(allTxt), `${lang}: no "waarmee"/"which ... built" clause in the why lines`);
    ok(!(lang === "nl" ? /[a-zà-ÿ,)][ \t]Jij\b/ : /[a-z,)][ \t]You\b/).test(allTxt), `${lang}: no capital "${lang === "nl" ? "Jij" : "You"}" inside a sentence`, (allTxt.match(lang === "nl" ? /[^\n]{0,14}[a-zà-ÿ,)][ \t]Jij\b[^\n]{0,8}/ : /[^\n]{0,14}[a-z,)][ \t]You\b[^\n]{0,8}/) || [])[0]);
    const lines3 = await page.evaluate(() => { const r = document.querySelector('.lg-rr[data-lground="3"]'); if (!r) return null; const n = (e) => { if (!e) return 0; const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter((x) => x.width > 2 && x.height > 4 && x.height < 30).map((x) => Math.round(x.top / 4))).size; }; return [n(r.querySelector(".lg-r2 > span:last-child")), n(r.querySelector(".lg-r3 > span:last-child"))]; });
    ok(lines3 != null && lines3[0] + lines3[1] <= 3, `${lang}: the B3 why row is at most 3 lines at 360 px`, [lines3, (rows.find((r) => r.t === "3") || {}).r2]);
    // the chat: through the app's own path
    const ASK = lang === "nl" ? [["Waarom zakte Geelen in beurt 7?", /beurt 7/], ["Waarom zakten ik en Blaauw?", /Blaauw/], ["Geelen?", /Geelen/]] : [["Why did Geelen fall in turn 7?", /turn 7/], ["Why did I and Blaauw fall?", /Blaauw/], ["Geelen?", /Geelen/]];
    for (const [q, re] of ASK) { const a = await page.evaluate((q) => { const x = window.__colonistGame._ldAnswer(q); return x ? { text: x.answer, blocks: x.spec.blocks.length, t: x.t } : null; }, q); ok(a && re.test(a.text), `${lang}: "${q}" is answered by the ledger: ${a && a.text.slice(0, 90)}`); if (q.includes("Blaauw")) ok(a && a.blocks === 2, `${lang}: two players, two cards`, a && a.blocks); if (/7/.test(q)) ok(a && a.t === 7, `${lang}: the named turn is the answer's turn`, a && a.t); }
    await ctx.close();
  }
  // the round view of the sudden-collapse game: the headline's number is the Total, the rest is explained, the credit block says whose moves
  for (const lang of ["nl", "en"]) {
    const { page, ctx, ready } = await open("mwg74y2d49gz", lang); ok(ready, `${lang}: 72eb: the ledger is complete`);
    const HD = await page.evaluate(() => document.querySelector(".ap-c .ap-ti")?.innerText || "");
    ok(lang === "nl" ? /^Jij (daalde|steeg) van \d+% naar \d+% op beurt \d+; .+ (daalde|steeg) van/.test(HD) : /^You (slid|rose) from \d+% to \d+% on turn \d+; .+ (slid|rose) from/.test(HD), `${lang}: the sudden-collapse headline starts with You: "${HD}"`);
    const hasName = await page.evaluate(() => [...document.querySelectorAll(".ap-c .ap-ti .ap-pl")].map((e) => e.className));
    ok(hasName.length >= 2 && hasName.some((c) => /pc-0/.test(c)) && hasName.some((c) => /pc-[1-5]/.test(c)), `${lang}: the players in the headline are in their colours`, hasName);
    await page.locator('.lg-rr[data-lground="22"]').tap(); await sleep(3500);
    const V = await page.evaluate(() => {
      const num = (el) => { const m = /([−+-]?)(\d+)/.exec(el?.textContent.replace("−", "-") || ""); return m ? (m[1] === "-" || m[1] === "−" ? -1 : 1) * +m[2] : null; };
      const head = document.querySelector(".lg-ti")?.innerText || "", tot = num(document.querySelector(".lg-wf.tot .lg-d")), oth = num(document.querySelector(".lg-wf.oth .lg-d"));
      const rowsV = [...document.querySelectorAll(".lg-wf:not(.est):not(.tot):not(.oth) .lg-wv > .lg-d")].map(num), sub = document.querySelector(".lg-ts")?.innerText || "", hn = [...head.replace(/−/g, "-").matchAll(/(?:^|\s)([−+-]\d+)(?!\d|%)/g)].map((m) => +m[1].replace("−", "-"));
      const sec = [...document.querySelectorAll(".lg-sec")].map((e) => e.innerText), notes = [...document.querySelectorAll(".lg-note")].map((e) => e.innerText);
      return { head, tot, oth, sum: rowsV.reduce((a, c) => a + c, 0), n: rowsV.length, sub, hn, sec, notes, lvl: /(\d+)% → (\d+)%/.exec(sub) };
    });
    ok(V.tot != null && V.hn.length >= 1 && V.hn.every((x) => x === V.tot) && /[−-]\d+/.test(V.sub) && V.sum + V.oth === V.tot, `${lang}: round 22: the headline's number ${JSON.stringify(V.hn)} = the Total ${V.tot} = the steps (${V.sum}) + the rest (${V.oth})`, V.head);
    ok(Math.abs(V.oth) < 5, `${lang}: round 22: a large rest is explained by more steps (rest ${V.oth}, ${V.n} steps listed)`);
    const who = lang === "nl" ? /^Wat de zetten van .+ opleverden|^Wat jouw zetten opleverden/i : /^What .+ moves earned|^What the moves of .+ earned|^What your moves earned/i;
    ok(V.sec.some((s) => who.test(s.replace(/\s*≈\s*$/, ""))), `${lang}: the moves block says whose moves`, V.sec);
    ok(V.notes.some((n) => (lang === "nl" ? /niet in het totaal/ : /not in the total/).test(n)), `${lang}: ...and why it is not in the total`, V.notes);
    await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/ux1902-${lang}-r22.png` : "/dev/null" }).catch(() => {});
    await ctx.close();
  }
  ok(!errs.length, "no page errors", errs.slice(0, 2));
  await b.close(); console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
