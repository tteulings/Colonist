// v1.99.1 user-test fixes (shell + small UI): node tests/shell1991.js PORT [SHOTS=dir]   (server: node tests/serve.mjs ROOT PORT)
//  per viewport (360x780, 412x923) x language (EN, NL):
//   1  Adjust choices are saved the moment they are picked: Master + 8 points, leave without Start, reload -> storage and the Home chips ("Master · 8 pt")
//   2  a rejected set-up tap says why (too close / not connected / taken), EN and NL, never the bare "not available" line
//   3  "Board layout" (NL "Bordindeling"), "Beginner (fixed)"; the old "Map layout" / "Kaartverdeling" are gone
//   4  the AI tab's chip row is not cut off at the right (wraps on a phone)
//   5  dead ends: the Luck tab names its reason; the AI tab waiting card says "offline" at once and "taking longer" after 25 s
//   6  the Bots page Precision view says why only some bots are listed
//   7  a reload does not bring back a stale payout line after your own roll (the ticker keeps "Roll: ...")
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const port = +process.argv[2] || 9133, SHOTS = process.env.SHOTS || process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`, FIX = path.join(__dirname, "fixtures", "post199");

async function open(browser, { vw, vh, lang, keep }) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  await ctx.addInitScript(([l]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist_review_auto", "off"); localStorage.setItem("colonist_lang", l); localStorage.setItem("colonist.palette", "light"); } } catch (_) {} }, [lang]);
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const boot = async () => { await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady && !document.getElementById("splash"), null, { timeout: 30000 }); await sleep(400); };
  await boot();
  return { ctx, page, errs, boot };
}
const crop = async (page, sel, file, pad = 8) => { // a PNG of one element (plus a margin)
  if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
  const box = await page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
  if (!box) { console.log("no crop target", sel); return; }
  await sleep(200); const W = page.viewportSize().width, H = page.viewportSize().height, x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  await page.screenshot({ path: path.join(SHOTS, file), clip: { x, y, width: Math.min(W - x, box.w + 2 * pad), height: Math.min(H - y, box.h + 2 * pad) } });
};

async function run(browser, vw, vh, lang) {
  const tag = `${vw}x${vh} ${lang}`, nl = lang === "nl", sfx = `${vw}-${lang}`;
  const { ctx, page, errs, boot } = await open(browser, { vw, vh, lang });
  const G = (f, a) => page.evaluate(f, a);

  // ── 1 + 3: Adjust, saved at once ──
  await page.locator("[data-home=adjust]").tap(); await sleep(500);
  await crop(page, ".sh-sheet", `adjust-${sfx}.png`, 0);
  ok(await G(() => !!document.querySelector("[data-action=levels]")), `[${tag}] Adjust sheet open`);
  await page.locator("[data-action=levels]").tap(); await sleep(350);
  const key = await G(() => { const b = [...document.querySelectorAll(".sh-level")].find((x) => /^(Master|Meester)$/.test(x.querySelector("b")?.textContent.trim())); return b?.dataset.level || null; });
  ok(!!key, `[${tag}] the Master level is on the Levels layer`, key);
  await page.locator(`.sh-level[data-level="${key}"]`).tap(); await sleep(250);
  const stored1 = await G(() => { try { return JSON.parse(localStorage.getItem("colonist_last_settings") || "null"); } catch (_) { return null; } });
  ok(stored1?.allPreset === key, `[${tag}] the level is stored the moment it is picked (before Start)`, stored1?.allPreset);
  await page.locator(".sh-layer [data-action=back]").first().tap(); await sleep(300);
  await page.locator("[data-action=more]").tap(); await sleep(350);
  const lab = await G(() => document.querySelector(".sh-layer")?.textContent || "");
  ok(nl ? /Bordindeling/.test(lab) && !/Kaartverdeling/.test(lab) && /Beginner \(vast\)/.test(lab) : /Board layout/.test(lab) && !/Map layout/.test(lab) && /Beginner \(fixed\)/.test(lab), `[${tag}] "${nl ? "Bordindeling" : "Board layout"}" and the Beginner (fixed) option`);
  const small = await G(() => { const r = document.querySelector(".sh-layer [aria-label='Board layout'], .sh-layer [aria-label='Bordindeling']"); if (!r) return "none"; const b = r.getBoundingClientRect(); return { right: Math.round(b.right), w: innerWidth, over: [...r.querySelectorAll("button")].some((x) => x.scrollWidth > x.clientWidth + 1) }; });
  ok(small !== "none" && small.right <= small.w && !small.over, `[${tag}] the board layout choice fits the screen`, small);
  await crop(page, ".sh-layer .sh-sec:nth-of-type(3)", `board-layout-${sfx}.png`, 6);
  const dec = page.locator("[data-stepper=winPoints] [data-step='-1']");
  await dec.tap(); await sleep(150); await dec.tap(); await sleep(250);
  const stored2 = await G(() => { try { return JSON.parse(localStorage.getItem("colonist_last_settings") || "null"); } catch (_) { return null; } });
  ok(stored2?.winPoints === 8, `[${tag}] the points are stored the moment they are picked`, stored2?.winPoints);
  await page.locator(".sh-layer [data-action=back]").first().tap(); await sleep(300);
  await page.keyboard.press("Escape"); await sleep(500); // leave without Start
  ok(await G(() => !document.querySelector(".newgame-modal")), `[${tag}] sheet closed without Start`);
  const chip0 = await G(() => [...document.querySelectorAll(".sh-chips .sh-chip")].map((c) => c.textContent.replace(/\s+/g, " ").trim()));
  ok(chip0.some((c) => /^(Master|Meester) · 8 pt$/.test(c)), `[${tag}] Home chips show level and points right after leaving the sheet`, chip0);
  await boot(); await sleep(300);
  const stored3 = await G(() => { try { return JSON.parse(localStorage.getItem("colonist_last_settings") || "null"); } catch (_) { return null; } });
  ok(stored3?.allPreset === key && stored3?.winPoints === 8, `[${tag}] after a reload the choices persisted`, { lvl: stored3?.allPreset, pts: stored3?.winPoints });
  const chip1 = await G(() => [...document.querySelectorAll(".sh-chips .sh-chip")].map((c) => c.textContent.replace(/\s+/g, " ").trim()));
  ok(chip1.some((c) => /^(Master|Meester) · 8 pt$/.test(c)), `[${tag}] after a reload the Home chip reads "${nl ? "Meester" : "Master"} · 8 pt"`, chip1);
  const chipFit = await G(() => { const r = document.querySelector(".sh-chips").getBoundingClientRect(); return r.right <= innerWidth + 1 && [...document.querySelectorAll(".sh-chips .sh-chip")].every((c) => c.getBoundingClientRect().right <= innerWidth); });
  ok(chipFit, `[${tag}] the chips fit the screen`);
  await crop(page, ".sh-card .sh-chips", `home-chips-${sfx}.png`, 10);
  await page.locator("[data-home=adjust]").tap(); await sleep(400);
  await page.locator("[data-action=more]").tap(); await sleep(350);
  ok(await G(() => document.querySelector("[data-stepper=winPoints] output")?.textContent.trim() === "8"), `[${tag}] the reopened sheet shows 8 points`);
  await page.keyboard.press("Escape"); await sleep(300); await page.keyboard.press("Escape"); await sleep(500);

  // ── 2 + 7: a game: set-up reasons, then the ticker after a reload ──
  await G(() => { const g = window.__colonistGame; g.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 }); window.__flash = []; const f = g._flashPrompt.bind(g); g._flashPrompt = (t, ms) => { window.__flash.push(t); return f(t, ms); }; });
  const place = (round) => G(([round]) => { const g = window.__colonistGame; if (!g.setupPhase || !g.currentPlayer.isHuman || !g.setupAction) return "wait"; const me = g.currentPlayer; const sp = g.api.spots(me.id);
    if (round === 2 && g.setupAction === "settlement" && !window.__probe) { window.__probe = 1; return "probe"; }
    if (g.setupAction === "settlement") g._applyPiece(me, { type: "settlement", id: [...sp.settlement][0] }, true); else g._applyPiece(me, { type: "road", id: [...(sp.road.size ? sp.road : sp.ship)][0] }, true); return "placed"; }, [round]);
  let probed = false;
  for (let i = 0; i < 900 && !probed; i++) {
    const done = await G(() => !window.__colonistGame.setupPhase); if (done) break;
    const r = await place(await G(() => (window.__colonistGame.setupStep >= window.__colonistGame.players.length ? 2 : 1)));
    if (r === "probe") probed = true; else await sleep(25);
  }
  ok(probed, `[${tag}] reached the 2nd set-up settlement`);
  if (probed) {
    const tap = async (what) => { // tap a spot; the English reason handed to the prompt, and what the player reads (the localized ticker)
      await G((what) => { const g = window.__colonistGame, me = g.currentPlayer, geo = g.geometry, bot = geo.nodes.find((n) => n.structure != null && n.owner !== me.id);
        let p; if (what === "close") p = g.getBuildPosition({ type: "settlement", id: bot.neighbors[0] }); else if (what === "taken") p = g.getBuildPosition({ type: "settlement", id: bot.id });
        else { const node = [...me.settlements].pop(), far = geo.edges.find((e) => e.owner == null && !e.nodes.includes(node) && !e.nodes.some((n) => geo.nodes[n].neighbors.includes(node))); p = g.getBuildPosition({ type: "road", id: far.id }); }
        window.__flash.length = 0; g.handleSetupClick(p.x, p.y); }, what);
      await sleep(250);
      return G(() => ({ flash: window.__flash.slice(), shown: window.__colonistGame.tickerText?.textContent || "" }));
    };
    const C = await tap("close");
    ok(C.flash.length === 1 && /^Too close to another settlement/.test(C.flash[0]) && (nl ? /Te dicht bij een ander dorp/ : /Too close to another settlement/).test(C.shown), `[${tag}] too close: a one-line reason`, C);
    await crop(page, ".status-bar, .ticker, #ticker, .game-ticker, .hud-top", `setup-rejection-${sfx}.png`, 6);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `setup-rejection-full-${sfx}.png`) }); }
    const T = await tap("taken");
    ok(T.flash.length === 1 && /^That spot is taken/.test(T.flash[0]) && (nl ? /Die plek is al bezet/ : /That spot is taken/).test(T.shown), `[${tag}] taken: a one-line reason`, T);
    await G(() => { const g = window.__colonistGame, me = g.currentPlayer; const sp = g.api.spots(me.id); g._applyPiece(me, { type: "settlement", id: [...sp.settlement][0] }, true); });
    const N = await tap("far");
    ok(N.flash.length === 1 && /^Not connected/.test(N.flash[0]) && (nl ? /Niet verbonden/ : /Not connected/).test(N.shown), `[${tag}] not connected: a one-line reason`, N);
    ok(await G(() => !window.__flash.some((t) => t === "That spot isn't available.")), `[${tag}] never the bare "That spot isn't available."`);
  }
  // finish set-up, roll, reload, compare the ticker
  for (let attempt = 0; attempt < 8; attempt++) { // (a fresh game each time: a roll of 7 has no payout line to compare, so it is rolled again)
  await G(() => { window.__colonistGame.startNewGame({ mode: "classic", board: "island", numBots: 3, winPoints: 10 }); });
  for (let i = 0; i < 900; i++) {
    const st = await G(() => { const g = window.__colonistGame; if (!g.setupPhase) return g.currentPlayer.isHuman && g.phase === "pre_roll" ? "go" : "bots"; if (g.currentPlayer.isHuman && g.setupAction) { const sp = g.api.spots(g.currentPlayer.id); g._applyPiece(g.currentPlayer, g.setupAction === "settlement" ? { type: "settlement", id: [...sp.settlement][0] } : { type: "road", id: [...(sp.road.size ? sp.road : sp.ship)][0] }, true); } return "setup"; });
    if (st === "go") break; await sleep(40);
  }
  await G(() => { const g = window.__colonistGame; g.api.act({ actor: g.currentPlayer.id, type: "roll" }); });
  await sleep(2500);
  if (!(await G(() => /rolled 7\.$/.test(window.__colonistGame.logEntries.filter((e) => /rolled/.test(e.text)).slice(-1)[0]?.text || "")))) break;
  }
  const tk = () => G(() => { const g = window.__colonistGame; return { t: g.tickerText?.textContent || "", mine: /^Turn \d+: You rolled \d+\.$/.test(g.logEntries.filter((e) => !/collect|Bank is short/.test(e.text)).slice(-1)[0]?.text || "") }; });
  const before = await tk();
  ok(/^(Roll|Worp)/.test(before.t), `[${tag}] after your roll the ticker says "${nl ? "Worp" : "Roll"}: ..."`, before.t);
  await G(() => window.__colonistGame.saveToStorage());
  await boot();
  if (await page.locator("[data-home='continue']").count()) await page.locator("[data-home='continue']").first().tap();
  await sleep(1500);
  const after = await tk();
  ok(after.t === before.t, `[${tag}] a reload keeps the same roll line (no stale bot payout)`, { before: before.t, after: after.t });
  await ctx.close();
  ok(errs.length === 0, `[${tag}] no page errors`, errs.slice(0, 2));
}

// ── 4 + 5 + 6: review tabs on a real reviewed game ──
async function reviewPart(browser, vw, vh, lang) {
  const tag = `${vw}x${vh} ${lang}`, nl = lang === "nl", sfx = `${vw}-${lang}`;
  const { ctx, page, errs } = await open(browser, { vw, vh, lang });
  const G = (f, a) => page.evaluate(f, a);
  const metas = [];
  for (const f of fs.readdirSync(FIX).filter((x) => x.endsWith(".json")).sort().slice(0, 1)) { const j = JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8")); const { meta, format, v, ...rec } = j; await G(async ({ meta, rec }) => { const H = window.__colonistGame.hist; await H.open(); await H.put({ ...meta }, rec, { quiet: true }); }, { meta, rec }); metas.push(meta); }
  const me = metas[0].me, openTab = async (tab) => { await G((t) => { const g = window.__colonistGame; g._rvTab = t; g._rvDrawReview(); }, tab); await sleep(700); };
  await G(() => window.__colonistGame.histOpen()); await sleep(900);
  await G((id) => window.__colonistGame._histSheet(id), metas[0].id); await sleep(500);
  await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 30000 }); await sleep(1500);
  // 6 Precision note
  await G(() => window.__colonistGame.botsOpen?.()); await sleep(600);
  await page.locator("[data-pxseg=precision]").tap(); await sleep(400);
  const pn = await G(() => { const c = [...document.querySelectorAll(".px-card")].find((x) => /Precision|Precisie/.test(x.querySelector(".rv-gt b")?.textContent || "")); return { note: c?.querySelector(".px-fn")?.innerText || "", rows: c ? c.querySelectorAll("button.px-bl").length : 0, over: document.documentElement.scrollWidth > innerWidth + 1 }; });
  ok(pn.rows > 0 && pn.rows < 11 && (nl ? /precisiecijfer/ : /precision figure/).test(pn.note) && !pn.over, `[${tag}] Precision lists ${pn.rows} bots and says why`, pn.note);
  await crop(page, ".px-card:has(.px-fn):not(:has(.px-sc))", `precision-note-${sfx}.png`, 6);
  await G(() => window.__colonistGame.botsClose?.()); await sleep(300);
  // 4 AI chips
  await openTab("ai"); await sleep(1200);
  const ch = await G(() => { const c = document.querySelector(".ai-chips"); if (!c) return null; const bs = [...c.querySelectorAll(".ai-q")]; return { n: bs.length, over: c.scrollWidth > c.clientWidth + 1, cut: bs.some((b) => b.getBoundingClientRect().right > innerWidth - 4 || b.getBoundingClientRect().left < 0), rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size, txt: bs.map((b) => b.textContent) }; });
  ok(!!ch && ch.n === 3 && !ch.over && !ch.cut && ch.rows <= 2, `[${tag}] the AI chip row is not cut off`, ch);
  await crop(page, ".ai-ask", `ai-chips-${sfx}.png`, 4);
  // 5 Luck: the reason
  await G(() => { const g = window.__colonistGame; g._lkState = () => ({ na: "not recorded" }); });
  await openTab("luck");
  const lk = await G(() => document.querySelector(".rv-scroll")?.innerText || "");
  ok(nl ? /voor dit spel niet beschikbaar: er zijn te weinig worpen/.test(lk) : /not available for this game: not enough of its rolls were recorded/.test(lk), `[${tag}] the Luck tab gives its reason`, lk.replace(/\s+/g, " ").slice(0, 160));
  await ctx.setOffline(true); await sleep(300);
  await openTab("luck");
  await crop(page, ".rv-scroll", `luck-offline-${sfx}.png`, 0);
  // 5 AI tab, waiting card: offline note at once, slow note after 25 s
  await G(() => { const g = window.__colonistGame; g._ldSettling = () => true; g._ldW0 = { id: g._rv?.id, t: performance.now(), tab: performance.now() }; });
  await openTab("ai");
  const w1 = await G(() => ({ sk: !!document.querySelector(".ap-settle"), notes: [...document.querySelectorAll("[data-pgnote]")].map((x) => x.innerText) }));
  ok(w1.sk && w1.notes.length === 1 && (nl ? /offline/ : /offline/).test(w1.notes[0]), `[${tag}] the waiting card says "offline" at once, and not "taking longer" yet`, w1.notes);
  await crop(page, ".rv-scroll", `ai-offline-${sfx}.png`, 0);
  await G(() => { const g = window.__colonistGame; g._ldW0 = { id: g._rv?.id, t: performance.now() - 40000, tab: performance.now() - 40000 }; g._pgSwap(); }); await sleep(500);
  const w2 = await G(() => [...document.querySelectorAll("[data-pgnote]")].map((x) => x.innerText));
  ok(w2.length === 2 && (nl ? /duurt langer dan normaal/ : /taking longer than usual/).test(w2[1]), `[${tag}] after 25 s the waiting card says it is taking longer`, w2);
  await crop(page, ".rv-scroll", `ai-slow-${sfx}.png`, 0);
  await ctx.close();
  ok(errs.length === 0, `[${tag}] review part: no page errors`, errs.slice(0, 2));
}

(async () => {
  const b = await chromium.launch();
  // the Dutch sentences (the localizer turns the English text into them: check the table directly)
  const nlTable = await (async () => { const m = await import(path.join(__dirname, "..", "src", "i18n-nl-199.js")); return new Map(m.NL_199); })();
  for (const k of ["Too close to another settlement: keep two roads apart.", "That spot is taken.", "Not connected: put it next to your new settlement.", "Not connected: build next to your own roads or settlements.", "Not connected: build next to your own roads."]) ok(!!nlTable.get(k), `NL table has "${k.slice(0, 40)}..."`);
  ok(nlTable.get("Board layout") === "Bordindeling", `NL "Board layout" = Bordindeling`);
  for (const [vw, vh] of [[360, 780], [412, 923]]) for (const lang of ["en", "nl"]) { await run(b, vw, vh, lang); await reviewPart(b, vw, vh, lang); }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL OK"); process.exit(fails ? 1 : 0);
})();
