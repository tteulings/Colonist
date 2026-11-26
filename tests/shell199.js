// v1.99 SHELL test: node tests/shell199.js PORT   (server: node tests/serve.mjs ROOT PORT)   env QUICK=1: one viewport, one palette (EN + NL)
//  per viewport (360x780, 412x923) x language (EN, NL) x palette (light, dark), on every shell screen (Play, Daily puzzle, Review, Bots, New game sheet
//  with More rules and Levels, Pause sheet, Settings and its Theme layer): no horizontal overflow, no text under 11.5 px, taps of at least 44 x 44
//  (the shell's own screens), the tab bar shown on the four tab roots only, every screen reachable, Back returns where it came from
//  all 11 registry levels reachable (all bots, and a level per bot), English with empty storage (also in a Dutch browser), Dutch from the stored choice
//  (and the legacy key), the colour mode Auto by default (dark phone = night), the one toast "Colours follow your phone." with Undo, shown once.
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = +process.argv[2] || 8700; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const URL = `http://localhost:${port}/index.html`;

// in-page: layout problems of the visible part of `root`
const SCAN = (rootSel) => {
  const root = document.querySelector(rootSel); if (!root) return { missing: true };
  const W = innerWidth, out = { overflow: [], small: [], taps: [] };
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden || +cs.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const scrollsX = (el) => { for (let e = el.parentElement; e && e !== root.parentElement; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === "auto" || o === "scroll") && e.scrollWidth > e.clientWidth + 1) return true; } return false; };
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.className || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  if (document.documentElement.scrollWidth > W + 1) out.overflow.push("page " + document.documentElement.scrollWidth);
  [root, ...root.querySelectorAll("*")].forEach((el) => {
    if (!vis(el) || el.closest("svg") && el.tagName !== "svg") return;
    const dt = el.closest("details:not([open])"); if (dt && !el.closest("summary")) return; // closed <details>: not on screen
    const r = el.getBoundingClientRect();
    if (!scrollsX(el) && (r.right > W + 1 || r.left < -1) && !el.closest(".sh-main[inert]")) out.overflow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 11.49) out.small.push(`${n.nodeValue.trim().slice(0, 24)} ${fs}px`); break; }
    if (el.matches("button, a[href], select, [role=button], [role=radio], [role=switch], summary, input:not([type=hidden])") && !el.closest("[inert]")) {
      let t = el; if (el.matches("input[type=checkbox]")) t = el.closest("label") || el;
      const q = t.getBoundingClientRect();
      if (q.width < 43.5 || q.height < 43.5) out.taps.push(`${label(el)} ${Math.round(q.width)}x${Math.round(q.height)}`);
    }
  });
  return out;
};

async function open(browser, { vw, vh, lang, pal, scheme = "light", locale, store = true }) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme, ...(locale ? { locale } : {}) });
  if (store) await ctx.addInitScript(([l, p]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; if (l) localStorage.setItem("colonist_lang", l); if (p) localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.autoDarkToast", "1"); } } catch (e) {} }, [lang, pal]);
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 25000 });
  await sleep(500);
  return { ctx, page, errs };
}

async function walk(browser, vw, vh, lang, pal) {
  const tag = `${vw}x${vh} ${lang} ${pal}`;
  const { ctx, page, errs } = await open(browser, { vw, vh, lang, pal });
  const G = (f, a) => page.evaluate(f, a);
  const T = (sel) => page.locator(sel).first().tap();
  const check = async (name, root, { taps = true, text = true } = {}) => {
    const r = await G(SCAN, root);
    ok(!r.missing, `[${tag}] ${name}: on screen`);
    if (r.missing) return;
    ok(r.overflow.length === 0, `[${tag}] ${name}: no horizontal overflow`, r.overflow.slice(0, 3));
    if (text) ok(r.small.length === 0, `[${tag}] ${name}: text >= 11.5px`, r.small.slice(0, 3));
    if (taps) ok(r.taps.length === 0, `[${tag}] ${name}: taps >= 44px`, r.taps.slice(0, 4));
  };
  const tabs = () => G(() => { const n = document.querySelector(".sh-tabs"); return !!n && !n.hidden && n.getBoundingClientRect().height > 0; });
  const chrome = async (name) => { // the tab bar and the gear themselves
    const r = await G(SCAN, ".sh-tabs"); const g = await G(SCAN, ".sh-gear");
    ok(!r.missing && !g.missing && r.taps.length === 0 && r.small.length === 0 && g.taps.length === 0 && r.overflow.length === 0, `[${tag}] ${name}: tab bar and gear fit (44px taps, 11.5px labels)`, [r.taps, r.small, g.taps]);
  };
  const dutch = lang === "nl";
  // Play
  await check("Play", ".sh-home");
  ok(await tabs(), `[${tag}] Play: tab bar shown`); await chrome("Play");
  ok(await G(() => document.querySelectorAll(".sh-tab").length === 4 && !document.querySelector(".sh-tab[aria-current]").dataset.tab.includes("daily")), `[${tag}] four tabs, Play current`);
  ok(await G(() => !!document.querySelector(".sh-home .hm-start") && !!document.querySelector(".sh-soon[aria-disabled=true]") && !document.querySelector(".sh-soon button, .sh-soon a")), `[${tag}] Daily puzzle card is disabled (Coming soon)`);
  ok(await G(() => !document.querySelector("[data-home=continue]")), `[${tag}] no Resume row without a saved game`);
  const txt = await G(() => document.querySelector(".sh-home").innerText);
  ok(dutch ? /Dagpuzzel/.test(txt) && /Binnenkort/.test(txt) && /Nieuw spel/.test(txt) && !/Coming soon|New game/.test(txt) : /Daily puzzle/.test(txt) && /Coming soon/.test(txt) && /New game/.test(txt), `[${tag}] Play speaks ${lang}`);
  ok(await G(() => document.querySelector(".sh-gear").getBoundingClientRect().right <= innerWidth && !document.querySelector(".hs-x, [data-hclose]:not([hidden])") ), `[${tag}] gear on the tab root, no back arrow`);
  // Daily puzzle
  await T(".sh-tab[data-tab=daily]"); await sleep(250);
  await check("Daily puzzle tab", ".sh-home"); ok(await tabs(), `[${tag}] Daily: tab bar shown`);
  ok(await G(() => document.querySelector(".sh-tab[aria-current]").dataset.tab === "daily" && !!document.querySelector(".sh-daily button[disabled]")), `[${tag}] Daily tab: current, card disabled`);
  // Review
  await T(".sh-tab[data-tab=review]"); await sleep(700);
  ok(await G(() => !!window.__colonistGame._histEl && document.querySelector(".sh-tab[aria-current]")?.dataset.tab === "review"), `[${tag}] Review tab opens the past games`);
  await check("Review tab", ".hs", { taps: false, text: false }); ok(await tabs(), `[${tag}] Review: tab bar shown`); await chrome("Review");
  ok(await G(() => { const x = document.querySelector(".hs [data-hclose]"); return !x || getComputedStyle(x).display === "none"; }), `[${tag}] Review root: no back arrow`);
  // Bots
  await T(".sh-tab[data-tab=bots]"); await sleep(700);
  ok(await G(() => !!window.__colonistGame._bpgEl && !window.__colonistGame._histEl && document.querySelector(".sh-tab[aria-current]")?.dataset.tab === "bots"), `[${tag}] Bots tab opens the bots page, the other root closes`);
  await check("Bots tab", ".hs", { taps: false, text: false }); ok(await tabs(), `[${tag}] Bots: tab bar shown`);
  await T(".sh-tab[data-tab=play]"); await sleep(300);
  ok(await G(() => !window.__colonistGame._bpgEl && document.querySelector(".sh-tab[aria-current]")?.dataset.tab === "play"), `[${tag}] back on Play`);
  // gear -> Settings, Theme layer, Back
  await T(".sh-gear"); await sleep(500);
  await check("Settings", ".sh-settings", { taps: true });
  ok(!(await tabs()), `[${tag}] Settings: tab bar hidden`);
  ok(await G(() => document.querySelectorAll(".sh-settings .sh-group").length === 5), `[${tag}] Settings has five groups`);
  ok(await G((p) => document.querySelectorAll("[data-pal]").length === 3 && document.querySelector("[data-pal].on")?.dataset.pal === p, pal === "night" ? "night" : "light"), `[${tag}] colours: Auto, Light, Dark (the chosen one is on)`);
  await T("[data-go=theme]"); await sleep(400);
  await check("Settings > Theme", ".sh-settings", { taps: true });
  await T(".sh-settings .st-close"); await sleep(300);
  ok(await G(() => !!document.querySelector(".sh-settings") && document.querySelector(".sh-appbar h1").textContent.trim().length > 0 && !!document.querySelector("[data-go=theme]")), `[${tag}] Back from the Theme layer returns to Settings`);
  await T(".sh-settings .st-close"); await sleep(300);
  ok(await G(() => !document.querySelector(".sh-settings")) && await tabs(), `[${tag}] Back from Settings returns to the tab`);
  // New game sheet
  await T("[data-home=adjust]"); await sleep(450);
  await check("New game sheet", ".newgame-modal .sh-main"); ok(!(await tabs()), `[${tag}] New game sheet: tab bar hidden`);
  ok(await G(() => document.querySelectorAll(".sh-bot").length === 5 && document.querySelectorAll(".sh-tile").length === 2 && document.querySelectorAll("[data-set^='level:']").length === 3 && document.querySelectorAll("[data-set^='board:']").length === 5 && !!document.querySelector("[data-action=explain]")), `[${tag}] New game: type, 5 opponents, level, map, explain`);
  await T("[data-action=more]"); await sleep(700);
  await check("More rules layer", ".newgame-modal .sh-layer");
  ok(await G(() => ["winPoints", "dice", "map", "friendly", "discardLimit"].every((k) => !!document.querySelector(`.sh-layer [data-k^='${k === "friendly" ? "friendly" : k}']`)) && !!document.querySelector(".sh-layer .hs-kind")), `[${tag}] More rules: points, dice, map layout, robber, discard limit, friend on this phone`);
  await T(".sh-layer [data-action=back]"); await sleep(300);
  ok(await G(() => !document.querySelector(".sh-layer") && !!document.querySelector(".newgame-modal")), `[${tag}] Back closes the layer only`);
  await T("[data-action=levels]"); await sleep(700);
  await check("Levels layer", ".newgame-modal .sh-layer");
  await T("[data-set='styleMode:each']"); await sleep(300);
  await check("Levels layer, each bot", ".newgame-modal .sh-layer");
  await T(".sh-layer [data-action=back]"); await sleep(300);
  await T("[data-action=cancel]"); await sleep(500);
  ok(await G(() => !document.querySelector(".newgame-modal")) && await tabs(), `[${tag}] Close the sheet: back on Play with the tab bar`);
  // a game: no tab bar; Pause sheet
  await T(".hm-start"); await sleep(1500);
  ok(await G(() => !window.__colonistGame.home.open) && !(await tabs()), `[${tag}] in a game: no tab bar, no gear`);
  await G(() => window.__colonistGame.menu.show()); await sleep(450);
  await check("Pause sheet", ".sh-pause .sh-sheet");
  ok(await G(() => document.querySelectorAll(".sh-pause [data-menu]").length === 5 && !!document.querySelector(".sh-pause [data-speed]")), `[${tag}] Pause: 5 rows and the bot speed`);
  await T(".sh-pause [data-menu=settings]"); await sleep(500);
  ok(await G(() => !!document.querySelector(".sh-settings") && !document.querySelector(".sh-pause")), `[${tag}] Pause > Settings`);
  await T(".sh-settings .st-close"); await sleep(400);
  ok(await G(() => !document.querySelector(".sh-settings") && !!document.querySelector(".sh-pause")), `[${tag}] Back from Settings returns to Pause`);
  await T(".sh-pause [data-menu=newgame]"); await sleep(450);
  ok(await G(() => !!document.querySelector(".newgame-modal") && !document.querySelector(".sh-pause")), `[${tag}] Pause > New game sheet`);
  await T("[data-action=cancel]"); await sleep(500);
  ok(await G(() => !window.__colonistGame.home.open), `[${tag}] closing New game from a game stays in the game`);
  await G(() => window.__colonistGame.menu.show()); await sleep(300);
  await T(".sh-pause [data-menu=intro]"); await sleep(500);
  ok(await G(() => !!document.querySelector(".welcome")) && !(await tabs()), `[${tag}] Pause > Explain (intro cards)`);
  await G(() => window.__colonistGame.onboarding.endIntro()); await sleep(200);
  await G(() => window.__colonistGame.menu.show()); await sleep(300);
  await T(".sh-pause [data-menu=home]"); await sleep(700);
  ok(await G(() => window.__colonistGame.home.open && !!document.querySelector("[data-home=continue]")) && await tabs(), `[${tag}] Pause > To start: Play with the Resume row`);
  await check("Play with Resume row", ".sh-home");
  await G(() => document.querySelector("[data-home=continue]").click()); await sleep(1200);
  ok(await G(() => !window.__colonistGame.home.open), `[${tag}] Resume continues the game`);
  ok(errs.length === 0, `[${tag}] no page errors`, errs.slice(0, 2));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const quick = !!process.env.QUICK;
  const views = quick ? [[360, 780]] : [[360, 780], [412, 923]];
  if (!process.env.SKIP_WALK) for (const [vw, vh] of views) for (const lang of ["en", "nl"]) for (const pal of quick && lang === "nl" ? ["night"] : ["light", "night"]) await walk(browser, vw, vh, lang, pal);

  // all 11 registry levels reachable: every level can be picked for all bots (and starts that game), and for a single bot
  {
    const { ctx, page } = await open(browser, { vw: 360, vh: 780, lang: "en", pal: "light" });
    page.setDefaultTimeout(15000);
    const G = (f, a) => page.evaluate(f, a);
    const keys = await G(async () => { const m = await import("/src/bots/registry.js"); return Object.keys(m.presetInfo()).filter((k) => k !== "custom"); });
    ok(keys.length === 11, "the registry holds 11 levels", keys.length);
    await G(() => { const g = window.__colonistGame; g.startNewGame = (s) => { window.__cap = g.constructor.normalizeSettingsForTest ? s : s; }; }); // capture what Start would start (no 11 real games)
    const fromMain = [];
    for (const k of keys) { if (process.env.DBG) console.log("level", k);
      await page.locator("[data-home=adjust]").tap(); await sleep(350);
      const inMain = await G((kk) => !!document.querySelector(`[data-set='level:${kk}']`), k);
      if (!inMain) { await page.locator("[data-action=levels]").tap(); await sleep(300); await page.locator(`[data-level="${k}"]`).tap(); await sleep(150); await page.locator(".sh-layer [data-action=back]").first().tap(); await sleep(250); }
      else await page.locator(`[data-set='level:${k}']`).tap();
      await sleep(150);
      await G(() => { window.__cap = null; }); await page.locator(".ng-start").tap(); await sleep(400);
      const got = await G(() => ({ mode: window.__cap?.botStyleMode, p: window.__cap?.allPreset }));
      if (got.mode === "all" && got.p === k) fromMain.push(k); else console.log("level not reached", k, got);
    }
    ok(fromMain.length === 11, "all 11 registry levels reachable from New game (main segment or Levels layer) and started", fromMain.length);
    await page.locator("[data-home=adjust]").tap(); await sleep(350); await page.locator("[data-action=levels]").tap(); await sleep(300); await page.locator("[data-set='styleMode:each']").tap(); await sleep(300);
    const opts = await G(() => [...document.querySelectorAll(".sh-layer select")].map((s) => [...s.options].map((o) => o.value)));
    ok(opts.length >= 1 && opts.every((o) => keys.every((k) => o.includes(k))), "a level per bot: every bot offers all 11 levels", opts.map((o) => o.length));
    const sel = page.locator(".sh-layer select").first(); await sel.selectOption("grandmaster"); await sleep(200);
    await page.locator(".sh-layer [data-action=back]").first().tap(); await sleep(250); await G(() => { window.__cap = null; }); await page.locator(".ng-start").tap(); await sleep(400);
    ok(await G(() => window.__cap?.botStyleMode === "each" && window.__cap.perBot[0] === "grandmaster"), "a level per bot starts the game with it");
    await ctx.close();
  }

  // English with empty storage (also in a Dutch browser), Dutch from the stored choice and the legacy key
  for (const locale of ["en-US", "nl-NL"]) {
    const { ctx, page } = await open(browser, { vw: 360, vh: 780, store: false, locale });
    const r = await page.evaluate(async () => ({ lang: (await import("/src/i18n.js")).lang(), txt: document.querySelector(".sh-home").innerText, ls: Object.keys(localStorage) }));
    ok(r.lang === "en" && /Start game/.test(r.txt) && /Daily puzzle/.test(r.txt) && !/Spelen|Start spel/.test(r.txt), `English default with empty storage (browser ${locale})`, r.lang);
    await ctx.close();
  }
  for (const [key, label] of [["colonist_lang", "stored choice"], ["colonist_recap_lang", "legacy key"]]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(([k]) => { try { if (!sessionStorage.__t) { sessionStorage.__t = 1; localStorage.setItem(k, "nl"); localStorage.setItem("colonist.autoDarkToast", "1"); } } catch (e) {} }, [key]);
    const page = await ctx.newPage(); await page.goto(URL); await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash"), null, { timeout: 25000 }); await sleep(400);
    ok(/Start spel/.test(await page.evaluate(() => document.querySelector(".sh-home").innerText)), `Dutch from the ${label}`);
    await ctx.close();
  }

  // colours: Auto by default (dark phone = night), the toast once with Undo, an explicit choice is kept
  {
    let { ctx, page } = await open(browser, { vw: 360, vh: 780, store: false, scheme: "dark" });
    await sleep(1500);
    const a = await page.evaluate(async () => ({ pal: document.documentElement.dataset.palette, toast: document.querySelector(".sh-toast")?.innerText || "", mode: (await import("/src/themes/manager.js")).paletteAutoMode() }));
    ok(a.pal === "night" && a.mode === "system", "never chose a palette + dark phone: night, Auto (follows the phone)", a);
    ok(/Colours follow your phone\./.test(a.toast) && /Undo/.test(a.toast), "the toast says \"Colours follow your phone.\" with Undo", a.toast);
    const tb = await page.evaluate(() => { const b = document.querySelector(".sh-toast-act").getBoundingClientRect(); const t = document.querySelector(".sh-toast").getBoundingClientRect(); return [b.width, b.height, t.height]; });
    ok(tb[0] >= 44 && tb[1] >= 44 && tb[2] >= 48, "toast: action 44x44, toast at least 48 high", tb);
    await sleep(5600);
    ok(await page.evaluate(() => !document.querySelector(".sh-toast")), "the toast leaves by itself");
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && !document.getElementById("splash")); await sleep(1800);
    ok(await page.evaluate(() => !document.querySelector(".sh-toast") && document.documentElement.dataset.palette === "night"), "shown once: not again after a reload (still Auto)");
    await ctx.close();
    ({ ctx, page } = await open(browser, { vw: 360, vh: 780, store: false, scheme: "dark" })); await sleep(1500);
    await page.locator(".sh-toast-act").tap(); await sleep(400);
    const u = await page.evaluate(() => ({ pal: document.documentElement.dataset.palette, stored: localStorage.getItem("colonist.palette"), toast: !!document.querySelector(".sh-toast") }));
    ok(u.pal === "light" && u.stored === "light" && !u.toast, "Undo: Light, chosen (kept even on a dark phone), toast gone", u);
    await page.locator(".sh-gear").tap(); await sleep(500);
    ok(await page.evaluate(() => document.querySelector("[data-pal].on")?.dataset.pal === "light"), "Settings shows Light after Undo");
    await page.locator("[data-pal=auto]").tap(); await sleep(500);
    ok(await page.evaluate(() => document.documentElement.dataset.palette === "night" && document.querySelector("[data-pal].on")?.dataset.pal === "auto"), "Settings: Auto follows the dark phone again");
    await page.locator("[data-pal=light]").tap(); await sleep(300);
    ok(await page.evaluate(() => document.documentElement.dataset.palette === "light"), "Settings: Light");
    await page.locator("[data-pal=night]").tap(); await sleep(300);
    ok(await page.evaluate(() => document.documentElement.dataset.palette === "night" && document.querySelector('meta[name=theme-color]')), "Settings: Dark");
    await ctx.close();
    // a stored choice never gets the toast and is kept
    ({ ctx, page } = await open(browser, { vw: 360, vh: 780, store: false, scheme: "dark" })); await ctx.close();
    const c2 = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true, colorScheme: "dark" });
    await c2.addInitScript(() => { try { localStorage.setItem("colonist.palette", "light"); localStorage.setItem("colonist.paletteAuto", "off"); } catch (e) {} });
    const p2 = await c2.newPage(); await p2.goto(URL); await p2.waitForFunction(() => window.__colonistGame && !document.getElementById("splash")); await sleep(1800);
    ok(await p2.evaluate(() => !document.querySelector(".sh-toast") && document.documentElement.dataset.palette === "light"), "an explicit palette is kept on a dark phone and gets no toast");
    await c2.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
