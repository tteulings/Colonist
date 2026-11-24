// Screenshots + checks of the mockups:  node shoot.cjs   (360 wide dsf2 for every mockup, one 412; checks: overflow, text >= 11.5px, taps >= 40px, <= 2 text lines per text block)
const { chromium } = require("/opt/node-tools/node_modules/playwright"); const fs = require("fs"), path = require("path"); const here = __dirname;
const shots = path.join(here, "shots"); fs.mkdirSync(shots, { recursive: true });
const jobs = []; for (const g of ["win", "loss"]) for (const l of ["nl", "en"]) for (const th of ["light", "dark"]) jobs.push([`${g}-${l}`, th, 360, `${g}-${l}-${th}`]);
for (const n of ["calib-s103-nl", "calib-s107-nl", "calib-s114-nl", "calib-s128-nl", "bot-nl"]) jobs.push([n, "light", 360, `${n}-light`]);
jobs.push(["loss-nl", "light", 412, "loss-nl-light-412"], ["win-en", "dark", 412, "win-en-dark-412"]);
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const [f, th, w, out] of jobs) {
    const ctx = await b.newContext({ viewport: { width: w, height: w === 360 ? 780 : 923 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto(`file://${here}/html/${f}.html#${th}`); await p.evaluate(() => document.fonts.ready);
    const r = await p.evaluate(() => { const iss = [], de = document.documentElement; if (de.scrollWidth > innerWidth + 1) iss.push("page scrolls horizontally");
      document.querySelectorAll("[data-card] *").forEach((e) => { const q = e.getBoundingClientRect(); if (q.right > innerWidth - 8 || q.left < 8) if (!e.closest("svg")) iss.push("edge " + e.className); });
      const tw = document.createTreeWalker(document.querySelector("[data-card]"), 4), small = [], long = []; for (let n = tw.nextNode(); n; n = tw.nextNode()) { const e = n.parentElement; if (!n.nodeValue.trim()) continue; const s = parseFloat(getComputedStyle(e).fontSize); if (s < 11.49) small.push(s + " " + n.nodeValue.trim().slice(0, 20)); }
      document.querySelectorAll("[data-card] .v, [data-card] .l1, [data-card] .l2").forEach((e) => { const lh = parseFloat(getComputedStyle(e).lineHeight), n = Math.round(e.getBoundingClientRect().height / lh); if (n > 2) long.push(n + " lines: " + e.innerText.slice(0, 30)); });
      const taps = [...document.querySelectorAll("[data-card] button")].filter((e) => { const q = e.getBoundingClientRect(); return q.height < 39.5 || q.width < 39.5; }).map((e) => e.innerText.slice(0, 20));
      const rows = [...document.querySelectorAll(".row")].map((e) => Math.round(e.getBoundingClientRect().height)); const c = document.querySelector("[data-card]").getBoundingClientRect(); const txt = document.querySelector("[data-card]").innerText;
      return { iss, small, long, taps, rows, h: Math.round(c.height), bad: /NaN|undefined|null|punten|robber|haven|\bport/i.test(txt) }; });
    const ok = !r.iss.length && !r.small.length && !r.long.length && !r.taps.length && !r.bad; if (!ok) bad++;
    console.log(ok ? "ok  " : "FAIL", out, "card h", r.h, "rows", r.rows.join("/"), ok ? "" : JSON.stringify(r));
    const h = await p.evaluate(() => Math.ceil(document.querySelector(".ghost").getBoundingClientRect().top + 40)); await p.setViewportSize({ width: w, height: h });
    await p.screenshot({ path: path.join(shots, out + ".png") }); await ctx.close(); }
  await b.close(); process.exit(bad ? 1 : 0); })();
