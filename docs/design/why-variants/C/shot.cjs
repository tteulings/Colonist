// screenshots + rule checks: node shot.cjs  (needs html/)  ->  shots/*.png  and a console report
const { chromium } = require("/opt/node-tools/node_modules/playwright"); const fs = require("fs"), path = require("path");
const H = path.join(__dirname, "html"), O = path.join(__dirname, "shots"); fs.mkdirSync(O, { recursive: true });
const jobs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(H);
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const f of jobs) { for (const [w, h, dsf] of [[360, 780, 2], [412, 923, 1]]) { if (w === 412 && !/^r[12]-nl-light/.test(f)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.goto("file://" + path.join(H, f)); const r = await p.evaluate(() => { const iss = [], de = document.documentElement; if (de.scrollWidth > innerWidth + 1) iss.push("hscroll " + de.scrollWidth);
      document.querySelectorAll("#why *").forEach((e) => { if (!e.childNodes.length) return; const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()); if (!own) return; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11.49) iss.push(fs + "px " + e.textContent.slice(0, 20));
        if (e.matches(".sub,.sent")) { const rg = document.createRange(); rg.selectNodeContents(e); const t = []; for (const q of rg.getClientRects()) { const y = Math.round(q.top); if (q.width > 1 && !t.some((x) => Math.abs(x - y) < 5)) t.push(y); } if (t.length > 2) iss.push(t.length + " lines " + e.textContent.slice(0, 30)); } });
      const c = document.querySelector("#why").getBoundingClientRect(); return { iss, h: Math.round(c.height), txt: document.querySelector("#why").innerText.replace(/\s+/g, " ") }; });
    if (r.iss.length) { bad++; console.log("FAIL", f, w, r.iss); }
    const name = f.replace(".html", "") + (w === 412 ? "-412" : "-360") + ".png"; await p.locator("#why").screenshot({ path: path.join(O, name) }); if (dsf === 2 && /^r[12]-en-light/.test(f)) console.log(f, r.h + "px", r.txt.slice(0, 400)); await ctx.close(); } }
  console.log(bad ? bad + " issues" : "all checks ok"); await b.close(); })();
