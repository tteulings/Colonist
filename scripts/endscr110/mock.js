// Mockups: injects the proposed end screen into the REAL end screen (real tokens, real charts). node mock.js <root> <port> <shotDir>
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const { serve, sleep } = require("./tlib");
const ROOT = path.resolve(process.argv[2]), PORT = Number(process.argv[3]), SHOTS = process.argv[4];
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json")));
const REV = "mw2ci2vhi0m0", UNREV = "mw2cebqthp43";
const CSS = `
.mq-sec{background:var(--sheet);background-image:var(--sheet-image);border:var(--sheet-border);border-radius:18px;box-shadow:var(--float-shadow);padding:12px;margin:0 0 10px}
.mq-h{font:var(--display-weight,700) 17px/1.2 var(--font-display);color:var(--heading);margin:0 0 2px;display:flex;align-items:center;gap:8px}
.mq-h small{margin-left:auto;font:650 12px var(--font-body);color:var(--ink-soft)}
.mq-sub{font-size:12.5px;color:var(--ink-soft);font-weight:650;margin:0 0 8px}
.mq-rev{background:var(--sheet);border:2px solid var(--primary);}
.mq-acc{display:flex;align-items:center;gap:12px;margin:6px 0 10px}
.mq-acc b{font:800 40px/1 var(--font-display);color:var(--heading)}.mq-acc b small{font-size:18px}
.mq-acc span{font-size:13.5px;font-weight:700;color:var(--ink);line-height:1.3}
.mq-bar{height:10px;border-radius:99px;background:var(--chip);border:var(--chip-border);overflow:hidden;margin:8px 0 6px}.mq-bar i{display:block;height:100%;background:var(--primary);border-radius:99px}
.mq-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:46px;border-radius:14px;border:var(--primary-border);background:var(--primary);background-image:var(--primary-image);color:var(--primary-ink);font:800 15px var(--font-body);box-shadow:var(--primary-shadow)}
.mq-btn.sec{background:var(--btn);background-image:none;color:var(--btn-ink);border:var(--btn-border);box-shadow:var(--btn-shadow)}
.mq-miss{display:flex;flex-direction:column;margin:0 -12px -4px}
.mq-miss div{display:grid;grid-template-columns:54px 1fr auto 12px;gap:8px;align-items:center;min-height:42px;padding:0 12px;border-top:1px solid color-mix(in srgb,var(--ink) 10%,transparent);font-size:13px;font-weight:650;color:var(--ink)}
.mq-miss .t{font-size:11.5px;color:var(--ink-soft);font-weight:800}.mq-miss .g{font-size:11.5px;color:var(--ink-soft);font-weight:750}
.mq-three{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 10px}
.mq-three button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 9px;border-radius:14px;border:var(--btn-border);background:var(--btn);color:var(--btn-ink);box-shadow:var(--btn-shadow);font:800 14px var(--font-body)}
.mq-three button small{font:650 11px var(--font-body);color:var(--ink-soft)}.mq-three svg{width:22px;height:22px;color:var(--primary)}
.mq-chips{display:flex;gap:6px;overflow-x:auto;margin:6px 0 8px;padding-bottom:2px}
.mq-chip{flex:none;height:34px;padding:0 12px;border-radius:99px;border:var(--float-border);background:var(--float);color:var(--ink-soft);font:750 13px var(--font-body);display:inline-flex;align-items:center}
.mq-chip.on{background:var(--primary);background-image:var(--primary-image);color:var(--primary-ink);border:var(--primary-border)}
.mq-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:99px;background:var(--float);border:var(--float-border);margin:0 0 10px;position:relative}
.mq-tabs span{height:36px;border-radius:99px;display:flex;align-items:center;justify-content:center;gap:6px;font:800 14px var(--font-body);color:var(--ink-soft)}
.mq-tabs span.on{background:var(--primary);background-image:var(--primary-image);color:var(--primary-ink)}
.mq-dot{width:9px;height:9px;border-radius:50%;background:#E9A23B;display:inline-block}
.mq-ring{width:16px;height:16px;border-radius:50%;background:conic-gradient(var(--primary) var(--p),color-mix(in srgb,var(--ink) 18%,transparent) 0);-webkit-mask:radial-gradient(circle,transparent 4px,#000 5px);mask:radial-gradient(circle,transparent 4px,#000 5px);display:inline-block}
.mq-link{display:block;text-align:center;font:750 13px var(--font-body);color:var(--ink-soft);margin:6px 0 2px}
.mq-foot{display:flex;flex-direction:column;gap:2px;padding:10px 12px max(12px,env(safe-area-inset-bottom))}
.mq-foot .mq-btn{height:52px;font-size:18px}
.mq-foot .mq-link{margin:4px 0 0;font-size:12.5px}
.mq-ins{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.mq-lab{font:800 11px var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin:12px 4px 6px}
.mq-res{display:flex;align-items:center;gap:12px}.mq-res h3{font-size:26px;margin:0;color:var(--heading);line-height:1.05}.mq-res p{margin:3px 0 0;font-size:14px;font-weight:700;color:var(--ink-soft)}
`;
(async () => {
  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch();
  for (const PAL of ["light", "night"]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => console.log("PAGEERR", e.message));
    await page.addInitScript((pal) => { if (sessionStorage.getItem("__init")) return; sessionStorage.setItem("__init", "1"); localStorage.clear(); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", pal); }, PAL);
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForFunction(() => window.__colonistGame && document.querySelector(".home"));
    await page.evaluate(async (seed) => { const g = window.__colonistGame; await g.hist.open(); for (const s of seed) await g.hist.put(s.meta, s.payload); g.home.render(); }, seed);
    await page.addStyleTag({ content: CSS });
    async function openEnd(id) {
      await page.evaluate(async () => { const g = window.__colonistGame; g.histClose?.(); if (!g.home.open) g.goHome(); });
      await page.evaluate((id) => window.__colonistGame.histView(id, "stats"), id);
      await page.waitForSelector(".gs-recap", { timeout: 8000 }); await sleep(2600);
    }
    // build + shoot one design; state: done | checking | none
    async function mock(variant, state, name, opt = {}) {
      await openEnd(state === "done" ? REV : UNREV);
      await page.evaluate(({ variant, state, opt }) => {
        const g = window.__colonistGame, ov = document.querySelector(".gs-over"), st = g._st;
        const ranked = [...ov.querySelectorAll(".gs-rank .r")];
        const me = g._me(); const winner = g.winner;
        const rank = ranked.findIndex((r) => +r.dataset.pid === me.id) + 1;
        const iWon = rank === 1;
        const ic = { play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', board: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>', clock: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5V8h3.5M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>', rev: '<svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' };
        const m = g.hist.metas.find((x) => x.id === g.stats.id) || {};
        const acc = m.acc ?? 92, could = (m.cls?.could || 0) + (m.cls?.missed || 0) || 3, mist = (m.cls?.mistake || 0) + (m.cls?.blunder || 0);
        const total = (g._rvTodo?.(me.id) || []).length || 24;
        const rows = [["Turn 6", "Build a city on ore 10", "+9%"], ["Turn 11", "Keep the Knight for the robber", "+6%"], ["Turn 14", "Trade with the bank, not buy", "+4%"]];
        const result = `<div class="mq-sec"><div class="mq-res">${g._stPortrait(winner.id, "", 52)}<div><h3>${g._stWinsText(winner)}</h3><p>${iWon ? "Well played" : `You finished ${rank} of ${ranked.length}`} · ${me.victoryPoints} points</p></div></div>
          <div class="podium gs-rank" style="margin-top:10px">${ov.querySelector(".gs-rank").innerHTML}</div></div>`;
        const reviewCard = state === "done" ? `<div class="mq-sec mq-rev"><div class="mq-h">${ic.rev.replace("<svg", '<svg style="width:20px;height:20px;color:var(--primary)"')}Your game review<small>${total} moves checked</small></div>
            <div class="mq-acc"><b>${acc}<small>%</small></b><span>accuracy<br>${could} move${could > 1 ? "s" : ""} could have been better${mist ? `, ${mist} mistakes` : ""}</span></div>
            <button class="mq-btn">Review my game</button>
            <div class="mq-lab" style="margin:12px 0 0">Biggest chances missed</div><div class="mq-miss">${rows.map((r) => `<div><span class="t">${r[0]}</span><span>${r[1]}</span><span class="g">${r[2]}</span><span>›</span></div>`).join("")}</div></div>`
          : state === "checking" ? `<div class="mq-sec mq-rev"><div class="mq-h">${ic.rev.replace("<svg", '<svg style="width:20px;height:20px;color:var(--primary)"')}Your game review<small>checking…</small></div>
            <div class="mq-sub">The Master bot is playing out each of your moves. You can leave: it keeps going.</div><div class="mq-bar"><i style="width:50%"></i></div><div class="mq-sub" style="margin:0 0 10px">12 of ${total} moves checked · about 2 min left</div>
            <button class="mq-btn sec">Review my game so far</button></div>`
          : `<div class="mq-sec mq-rev"><div class="mq-h">${ic.rev.replace("<svg", '<svg style="width:20px;height:20px;color:var(--primary)"')}Your game review</div><div class="mq-sub">See which of your moves could have been better. The Master bot checks every choice (about 3 min).</div><button class="mq-btn">Check my moves</button></div>`;
        const three = `<div class="mq-three"><button>${ic.play}Replay<small>watch it again</small></button><button>${ic.board}Final board<small>see the map</small></button><button>${ic.clock}Past games<small>all saved</small></button></div>`;
        const ins = [...ov.querySelectorAll(".gs-hl li")].slice(0, 3).map((li) => `<li>${li.innerHTML}</li>`).join("");
        const stats = (key) => { const cards = { race: () => [g._stCardRace(st)], dice: () => [g._stCardDice(st)], cards: () => [g._stCardRes(st)] }[key](); return cards.join(""); };
        const labels = [["race", "Points race"], ["dice", "Dice"], ["cards", "Cards"], ["maps", "Where you earned"], ["moments", "Key moments"]];
        const chips = (on) => `<div class="mq-chips">${labels.map(([k, l]) => `<span class="mq-chip${k === on ? " on" : ""}">${l}</span>`).join("")}</div>`;
        const facts = `<div class="gs-ov" style="margin:0 0 10px">${ov.querySelector(".gs-ov").innerHTML}</div>`;
        const scroll = ov.querySelector(".gs-scroll"), foot = ov.querySelector(".gs-foot");
        const footHtml = `<div class="mq-foot"><button class="mq-btn">Rematch</button><span class="mq-link">Same settings · <u>Change settings</u></span></div>`;
        foot.style.display = "block"; foot.innerHTML = footHtml; foot.style.gridTemplateColumns = "none";
        scroll.scrollTop = 0;
        if (variant === "A") {
          scroll.innerHTML = `${result}${reviewCard}${three}
            <div class="mq-lab">Highlights</div><div class="mq-sec"><ul class="mq-ins gs-hl">${ins}</ul></div>
            <div class="mq-lab">Game stats</div><div class="mq-sec" style="padding-bottom:6px"><div class="mq-sub" style="margin:0">Pick one</div>${chips("race")}<div class="mq-card2">${stats("race")}</div></div>
            <p class="mq-link" style="margin-bottom:12px">Saved to Past games · <u>Keep</u></p>`;
          scroll.querySelectorAll(".mq-card2 .gs-card").forEach((c) => { c.style.cssText = "box-shadow:none;border:0;background:none;padding:0;margin:0"; });
        } else {
          const tab = opt.tab || "result";
          const badge = state === "checking" ? '<span class="mq-ring" style="--p:50%"></span>' : state === "done" ? '<span class="mq-dot"></span>' : "";
          const tabs = `<div class="mq-tabs"><span class="${tab === "result" ? "on" : ""}">Result</span><span class="${tab === "review" ? "on" : ""}">Review ${badge}</span><span class="${tab === "stats" ? "on" : ""}">Stats</span></div>`;
          if (tab === "result") scroll.innerHTML = `${tabs}${result}${facts}<div class="mq-sec"><ul class="mq-ins gs-hl">${ins}</ul></div>${three}<p class="mq-link">Saved to Past games · <u>Keep</u></p>`;
          if (tab === "review") scroll.innerHTML = `${tabs}${reviewCard}<p class="mq-sub" style="padding:0 4px">Accuracy compares each of your moves with the best one the Master bot found, played out over many random futures.</p>`;
          if (tab === "stats") { scroll.innerHTML = `${tabs}${chips("race")}<div class="mq-card2">${stats("race")}${stats("dice")}</div>`; }
        }
      }, { variant, state, opt });
      await sleep(500);
      const f = path.join(SHOTS, `mock-${name}-${PAL === "light" ? "sunny" : "night"}.png`);
      await page.screenshot({ path: f }); console.log("shot", path.basename(f));
      if (opt.full) { await page.evaluate(() => { const s = document.querySelector(".gs-scroll"); s.scrollTop = s.scrollHeight; }); await sleep(300); const f2 = f.replace(".png", "-scrolled.png"); await page.screenshot({ path: f2 }); console.log("shot", path.basename(f2)); }
    }
    try {
      await mock("A", "checking", "A1-checking");
      await mock("A", "done", "A2-done", { full: true });
      await mock("B", "done", "B1-result", { tab: "result" });
      await mock("B", "checking", "B2-review-checking", { tab: "review" });
      await mock("B", "done", "B3-review-done", { tab: "review" });
      await mock("B", "done", "B4-stats", { tab: "stats" });
    } catch (e) { console.log("MOCK FAIL", PAL, String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
