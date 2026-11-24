// node shoot.cjs PORT   (server: node tests/serve.mjs ROOT PORT where ROOT contains html/). Screenshots + rule checks (overflow, text >= 11.5px, taps >= 40px, <= 2 lines).
const { chromium } = require("playwright"); const fs = require("fs");
const port = +process.argv[2] || 8920; fs.mkdirSync("shots", { recursive: true });
const jobs = []; const full = ["win", "loss"], calib = ["calib-s122-factsmine", "calib-s115-cost", "calib-s126-luck", "calib-s1-blowout"];
for (const g of full) for (const l of ["nl", "en"]) for (const th of ["light", "dark"]) jobs.push([g, l, th, 360]);
jobs.push(["loss", "nl", "light", 412], ["win", "en", "dark", 412]); for (const g of calib) jobs.push([g, "nl", "light", 360]);
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const [g, l, th, w] of jobs) {
    const ctx = await b.newContext({ viewport: { width: w, height: w === 360 ? 780 : 923 }, deviceScaleFactor: w === 360 ? 2 : 1, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/html/${g}-${l}.html#${th}`); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const iss = [], de = document.documentElement; if (de.scrollWidth > innerWidth + 1) iss.push("hscroll " + de.scrollWidth);
      document.querySelectorAll("body *").forEach((el) => { if (el.closest("script,style")) return; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) iss.push("out " + el.className);
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && parseFloat(cs.fontSize) < 11.5) iss.push("small " + el.className + " " + cs.fontSize);
        if (el.matches("button") && (r.height < 39.5 || r.width < 39.5) && r.width) iss.push("tap " + el.className + " " + Math.round(r.width) + "x" + Math.round(r.height)); });
      document.querySelectorAll(".sent,.m1,.m2").forEach((el) => { const rg = document.createRange(); rg.selectNodeContents(el); const t = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))); if (t.size > 2) iss.push("lines>2 " + el.className); });
      const c = document.querySelector(".card").getBoundingClientRect(); return { iss, h: Math.ceil(c.bottom + 10) }; });
    const name = `shots/${g}-${l}-${th}-${w}.png`; await p.screenshot({ path: name, clip: { x: 0, y: 0, width: w, height: Math.min(r.h + 70, w === 360 ? 780 : 923) } });
    console.log(r.iss.length ? "FAIL" : "ok  ", name, r.iss.slice(0, 4).join("; ")); bad += r.iss.length ? 1 : 0; await ctx.close(); }
  await b.close(); console.log(bad ? bad + " FAILED" : "ALL OK"); })();
