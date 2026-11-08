// Mockups with injected UI over the real screens.  usage: node mock.js light|night newgame|end|review|progress
const L = require("./lib.js");
const pal = process.argv[2] || "light", part = process.argv[3];
const sfx = pal === "night" ? "night" : "sunny";
const CSS = `
.mk-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.mk-chip{font:600 13px/1 var(--font-body,system-ui);padding:7px 11px;border-radius:999px;border:1.5px solid color-mix(in srgb,currentColor 30%,transparent);background:var(--sheet,#fff);color:var(--ink,#222);display:inline-flex;gap:6px;align-items:center;min-height:30px}
.mk-chip.on{background:var(--ink,#222);} .mk-chip.on span{color:var(--sheet,#fff)!important}
.mk-chip.on span{color:var(--sheet,#fff)}
.mk-chip.new{border-style:dashed;opacity:.85}
.mk-chip .x{opacity:.55;font-weight:700}
.mk-note{font:500 12px/1.35 var(--font-body,system-ui);opacity:.85;margin:8px 2px 0;color:var(--ink,#222)}
.mk-manage{font:650 12.5px/1 var(--font-body,system-ui);text-decoration:underline;opacity:.85;margin-left:auto;background:none;border:0;color:var(--ink,#222);padding:6px 2px}
.mk-seg{display:flex;gap:4px;padding:3px;border-radius:999px;background:color-mix(in srgb,currentColor 10%,transparent)}
.mk-seg button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:999px;padding:8px 6px;font:700 14px/1.1 var(--font-body,system-ui);background:transparent;color:var(--ink,#222);min-height:40px}
.mk-seg button small{display:block;font-weight:500;font-size:11px;opacity:.75}
.mk-seg button.on{background:var(--sheet,#fff);box-shadow:0 1px 4px rgba(0,0,0,.2)}
.mk-seg .avatar{--av:24px}
.mk-rf{margin:10px 0 4px}
.mk-rf-h{color:var(--ink,#222);font:700 12px/1 var(--font-body,system-ui);letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin:0 2px 6px}
.mk-tag{position:fixed;top:2px;right:4px;z-index:999;font:700 10px/1 system-ui;background:#000a;color:#fff;padding:3px 6px;border-radius:6px}
`;
const av = (page, pid) => page.evaluate((pid) => { const s = document.querySelector(`.avatar.pc-${pid} svg`); return s ? `<span class="avatar pc-${pid}" style="--av:26px;width:26px;height:26px;flex:none;display:inline-block"><svg viewBox="-50 -50 100 100" width="26" height="26">${s.innerHTML}</svg></span>` : ""; }, pid);
(async () => {
  const { browser, page } = await L.open(pal);
  const addCss = () => page.addStyleTag({ content: CSS });
  const shot = (n) => L.shot(page, `mock-${n}`.replace("audit-", ""));
  if (part === "newgame") {
    await page.getByText("More settings").click(); await page.waitForTimeout(500);
    await page.locator('[data-seg="numBots"] [data-value="2"]').click();
    await page.locator('[data-kind="human"][data-seat="1"]').click();
    await addCss();
    const inject = async (state) => page.evaluate((state) => {
      const rows = [...document.querySelectorAll(".hs-seat")];
      rows.forEach((r) => r.querySelector(".mk-chips")?.remove());
      const humans = rows.filter((r) => r.querySelector(".hs-name-in"));
      humans.forEach((r, i) => {
        const inp = r.querySelector(".hs-name-in");
        inp.placeholder = i === 0 ? "Your name" : "Name";
        inp.value = state === "filled" && i === 1 ? "Rosa" : "";
        const c = document.createElement("div"); c.className = "mk-chips";
        const mine = state === "filled" && i === 1;
        if (i === 0 || !mine) c.innerHTML = `<button class="mk-chip" type="button"><span>Rosa</span></button>`;
        else c.innerHTML = `<button class="mk-chip on" type="button"><span>Rosa</span><span class="x">✓</span></button>`;
        if (!(i === 0 && state === "filled")) r.querySelector(".hs-seat-main").appendChild(c);
        if (i === 0 && state === "filled") { /* seat 1: taken name not offered again */ }
      });
      const help = document.querySelector(".hs-help");
      document.querySelectorAll(".mk-foot").forEach((e) => e.remove());
      const n = document.createElement("div"); n.className = "mk-chips mk-foot"; n.style.justifyContent = "space-between";
      n.innerHTML = `<span class="mk-note" style="margin:0">Names are remembered on this phone.</span><button class="mk-manage" type="button">Manage names</button>`;
      help.after(n);
    }, state);
    await inject("empty");
    await page.locator(".hs-seats").scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector(".ng-players").scrollIntoView({ block: "start" })); await page.waitForTimeout(300);
    await shot(`newgame-1-empty-${sfx}`);
    await inject("filled"); await page.waitForTimeout(200);
    await shot(`newgame-2-filled-${sfx}`);
  }
  if (part === "end" || part === "review") {
    await L.reachEnd(page, "You", "Rosa");
    await addCss();
    const rosaAv = await av(page, 1), youAv = await av(page, 0);
    const seg = (who, st0, st1) => `<div class="mk-rf"><div class="mk-rf-h">Review for</div><div class="mk-seg" role="radiogroup">
      <button type="button" role="radio" class="${who === 1 ? "on" : ""}">${rosaAv}<span>Rosa<small>${st0}</small></span></button>
      <button type="button" role="radio" class="${who === 0 ? "on" : ""}">${youAv}<span>You<small>${st1}</small></span></button></div></div>`;
    if (part === "end") {
      await page.evaluate((html) => {
        const h3 = document.querySelector(".gs-rhead h3"); h3.textContent = h3.textContent.replace("You wins", "You win");
        const box = document.querySelector("[data-rvbox]");
        const rosa = box.querySelector('[data-rvp="1"]'), you = box.querySelector('[data-rvp="0"]');
        you.remove();
        rosa.insertAdjacentHTML("beforebegin", html);
        rosa.querySelector(".rv1-tt").innerHTML = `<span class="pc-1 rv-who">Rosa</span> · missed chances`;
        rosa.insertAdjacentHTML("afterend", `<p class="mk-note">One review at a time, in the background after the game. You can stop and carry on later. Each person sees only their own hand.</p>`);
      }, seg(1, "tap to start", "after Rosa"));
      await page.evaluate(() => document.querySelector(".gs-scroll").scrollTo(0, 0)); await page.waitForTimeout(300);
      await shot(`end-review-for-${sfx}`);
    } else {
      await page.evaluate(() => { document.querySelector('[data-rvreview="1"]').click(); });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__colonistGame._rvStop?.()); await page.waitForTimeout(900);
      await page.evaluate((html) => {
        const bar = document.querySelector(".rv-bar");
        bar.querySelector("h3").textContent = "Game review · Rosa";
        bar.insertAdjacentHTML("afterend", `<div style="padding:0 14px">${html}</div>`);
      }, seg(1, "checking 4 of 22", "queued"));
      await shot(`review-header-${sfx}`);
    }
  }
  if (part === "progress") {
    await page.evaluate(async () => {
      const g = window.__colonistGame; const H = g.hist; await H.open();
      const day = 86400000, now = Date.now();
      const accs = [71, 74, 73, 78, 77, 82, 80, 84];
      for (let i = 0; i < 8; i++) {
        const won = i % 3 === 1; // Rosa (seat 1) won
        const meta = { id: "mock" + i, v: 1, start: now - (9 - i) * day, end: now - (9 - i) * day + 2400000, mode: "classic", board: "island", n: 3, pts: 10, hot: true,
          seats: [{ name: "You", vp: won ? 6 : 10 }, { name: "Rosa", vp: won ? 10 : 7 }, { name: "Van Geelen", vp: 5, key: "intermediate" }], me: 1, winner: won ? 1 : 0, result: won ? "won" : "lost",
          turns: 28 + i, ms: 2400000, star: false, rec: true, rd: 22, acc: accs[i], rn: 22, cls: { could: 3 - (i > 4 ? 1 : 0), missed: 1, mistake: 2 - (i > 5 ? 1 : 0), blunder: i < 3 ? 1 : 0 }, mist: { "end>build": 2, bank: 1 + (i % 2), robber: 1 }, prov: false, mid: false, rk: "k0.08v1", rp: [22, 22], kb: 6 };
        await H.put(meta, { state: {}, rv: null });
      }
    });
    await addCss();
    await page.evaluate(() => window.__colonistGame.histOpen());
    await page.waitForTimeout(1200);
    await addCss();
    const rosaAv = await av(page, 1).catch(() => "");
    await page.evaluate(() => {
      const prog = document.querySelector(".hs-prog");
      prog.querySelector(".pg-h h4").textContent = "Progress";
      prog.querySelector(".pg-h").insertAdjacentHTML("afterend", `<div class="mk-seg" style="margin:6px 0 8px" role="radiogroup" aria-label="Progress of"><button type="button" role="radio" class="on">Rosa<small>8 games</small></button><button type="button" role="radio">You<small>8 games</small></button><button type="button" role="radio">Together<small>duels</small></button></div>`);
      prog.insertAdjacentHTML("beforeend", `<p class="mk-note">Rosa's reviewed games only. Pass &amp; play games count for the names who played.</p>`);
      // rows: both names, who won, one accuracy per name
      document.querySelectorAll(".hs-row").forEach((r) => {
        const id = r.dataset.hrow, i = +id.replace("mock", ""), won = i % 3 === 1;
        const main = r.querySelector(".hs-main");
        main.querySelector("b").innerHTML = `${won ? "Rosa" : "You"} won · ${won ? "You" : "Rosa"} 2nd`;
        main.querySelector("small").insertAdjacentHTML("beforeend", ` · pass &amp; play`);
        const acc = r.querySelector(".hs-acc"); if (acc) acc.outerHTML = `<span class="hs-acc"><small>Rosa</small>${[71, 74, 73, 78, 77, 82, 80, 84][i]}</span><span class="hs-acc"><small>You</small>${[68, 72, 75, 70, 79, 74, 81, 80][i]}</span>`;
        const b = r.querySelector(".hs-badge"); b.textContent = "•";
      });
    });
    await page.waitForTimeout(300);
    await shot(`progress-${sfx}-top`);
    await page.evaluate(() => document.querySelector(".hs-scroll").scrollTo(0, 480)); await page.waitForTimeout(300);
    await shot(`progress-${sfx}-list`);
  }
  await browser.close();
})().catch((e) => { console.log("ERR", e); process.exit(1); });
