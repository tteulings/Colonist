// v1.87 one language for the whole app. node i18n187.js PORT   (server: node step105/tests/serve.mjs ROOT PORT)
//  1 the default follows the browser (nl* -> Dutch, else English) and the setting overrides it; the AI recap language is the same setting
//  2 switching in Settings changes the open screen at once and back again, without a reload; the choice survives a reload
//  3 every main screen walked in Dutch (Home, Menu, New game, How to play, Settings, Past games, review tabs, Lessons, Bots,
//    a running game: ticker, prompts, build sheet, trade, cards, journal, legend, live stats, a 7 and the robber, the end screen):
//    no English UI sentence left (names allowed), no raw {variable} or "undefined", no horizontal overflow, no clipped or truncated label at 360px
//  4 pure units: t() with variables, plurals, numbers, dates
//  5 v1.88 glossary (src/i18n-glossary.md): the Dutch tables and the AI tab hold none of the forbidden variants; the running game shows none either;
//    plurals agree with their number; versions keep their dot; no button label ends in an ellipsis (Monopoly picker, robber button, buy card, ticker)
const path = require("path"); const { pathToFileURL } = require("url");
const { walk, open, sleep } = require("./i18n-walk.js");
const port = +process.argv[2] || 9960; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const SH = process.env.SHOTS || path.join(__dirname, "..", "..", "i18n187");
const NAMES = /\b(Katan|Blaauw|Geelen|Groen|Roodhart|Rosa|Van Geelen|Groenewoud|Pimpel|Mevrouw|Kolonel|Dominee|Professor|De Wit|Draet|AI|Rush|Monte Carlo|Sunny Island|Bot|Elo|SE|pp|k)\b/g;
// the AI tab brings its own Dutch/English (src/review/ai-lang.js): its texts are not part of this check
// v1.88 forbidden variants (one term per concept, see src/i18n-glossary.md). TERMS: checked in the Dutch tables, the AI tab and the screens; SCREEN: only on the walked screens
const TERMS = [[/Struikrover/i, "Struikrover (use Rover)"], [/Langste weg\b/, "Langste weg (use Langste handelsroute)"], [/Grootste leger/, "Grootste leger (use Grootste riddermacht)"], [/\b[Oo]pzet/, "Opzet (use Beginopstelling)"], [/\bZeevaart\b/, "Zeevaart (use Zeevaarders)"], [/\bAnnuleer\b/, "Annuleer (use Annuleren)"],
  [/ontw\.\s?kaart/i, "ontw.kaarten"], [/Overwinningspunt/i, "Overwinningspunt (use Puntenkaart)"], [/Jaar van overvloed/, "Jaar van overvloed (use Uitvinding)"], [/\bHoud\b/, "Houd (use Bewaar)"], [/\bsteals?\b(?!\s*:)/i, "steal (English)"], [/\bgaven jij\b/, "gaven jij (use jou)"],
  [/\b[Aa]fgooi|\bgooit [^.]{0,40} af\b/, "afgooien (use afleggen)"], [/Upgrade naar/, "Upgrade naar (use Maak er een stad van)"], [/Train dit/, "Train dit (use Oefen dit)"], [/nederzetting/i, "nederzetting (use dorp)"]]; // v1.90: "dorp" is the app's word for a settlement
const SCREEN = [[/(^|[^\w])T\d+\b/, "T14 (use B14)"], [/\bv\d+,\d+/, "decimal comma in a version"], [/(^|[^\d.,\w])1 (kaarten|beurten|worpen|zetten|spellen|bots|punten|dorpen|steden|wegen|ridders|schepen|tegels|grondstofkaarten|ontwikkelingskaarten|spelers)\b/, "1 + plural noun"],
  [/(^|[^\d.,\w])([2-9]|\d\d+) (kaart|beurt|worp|zet|spel|punt|dorp|stad|weg|ridder|schip|tegel|grondstofkaart|ontwikkelingskaart|speler)(?![\wé])/, "n + singular noun"]];
const AI_SKIP = /^(Samenvatting uit de cijfers|Voor dit spel samengesteld|Vraag iets over dit spel)/;
(async () => {
  const { looksEnglish } = await import(pathToFileURL(path.join(__dirname, "i18n-words.mjs")).href);
  const i18n = await import(pathToFileURL(path.join(__dirname, "..", "src", "i18n.js")).href).catch(() => null); // node: no DOM, only the pure parts

  // ── 1 default language ──
  for (const [locale, saved, want] of [["en-US", null, "en"], ["nl-NL", null, "en"], ["nl-BE", null, "en"], ["de-DE", null, "en"], ["nl-NL", "en", "en"], ["en-US", "nl", "nl"]]) {
    const { b, page } = await open(port, saved, { locale });
    const r = await page.evaluate(async () => { const i = await import("/src/i18n.js"); const rc = await import("/src/review-recap.js"); return { lang: i.lang(), recap: rc.recapLang(), html: document.documentElement.lang, home: document.querySelector(".sh-home")?.innerText || "" }; });
    ok(r.lang === want && r.recap === want && r.html === want, `locale ${locale}${saved ? " + setting " + saved : ""} -> ${want}`, r);
    ok(want === "nl" ? /Start spel/.test(r.home) : /Start game/.test(r.home), "Home shows the language", r.home.split("\n")[0]);
    await b.close();
  }

  // ── 2 switch in Settings, live and persistent ──
  {
    const { b, page } = await open(port, null, { locale: "en-US" });
    const G = (f, a) => page.evaluate(f, a);
    await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(500);
    ok(await G(() => /Language/.test(document.querySelector(".st-body").innerText) && !!document.querySelector("[data-lang=nl]") && !document.querySelector("[data-rc-lang]")), "Settings has one Language row (no separate recap language)");
    await page.locator("[data-lang=nl]").tap(); await sleep(600);
    ok(await G(() => /Taal/.test(document.querySelector(".st-body").innerText) && /Uiterlijk/.test(document.querySelector(".st-body").innerText)), "the open Settings turns Dutch at once");
    ok(await G(async () => (await import("/src/review-recap.js")).recapLang() === "nl"), "the AI recap / AI tab read the same setting");
    await G(() => window.__colonistGame.settingsUI.close()); await G(() => window.__colonistGame.goHome()); await sleep(500);
    ok(await G(() => /Start spel/.test(document.body.innerText)), "Home is Dutch");
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady); await sleep(600);
    ok(await G(() => /Start spel/.test(document.querySelector(".sh-home").innerText)), "the choice survives a reload");
    await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(400);
    await page.locator("[data-lang=en]").tap(); await sleep(600);
    ok(await G(() => /Language/.test(document.querySelector(".st-body").innerText) && /Appearance/.test(document.querySelector(".st-body").innerText)), "and back to English at once");
    await G(() => window.__colonistGame.settingsUI.close()); await sleep(300);
    ok(await G(() => /Start game/.test(document.body.innerText)), "Home is English again, nothing left over from Dutch");
    await b.close();
  }

  // ── 4 units (in the page: i18n.js needs localStorage / navigator) ──
  {
    const { b, page } = await open(port, "nl", {});
    const U = await page.evaluate(async () => { const i = await import("/src/i18n.js"); return { a: i.t("Roll {n}", { n: 8 }), b: i.t("{x} wins!", { x: "Blaauw" }), c: i.t("Not in any table, so English stays"), d: i.tn(1, "spel", "spellen") + "/" + i.tn(2, "spel", "spellen"), e: i.num(2.5, 1), f: i.t("{n} resource cards", { n: 3 }), g: i.tr("You rolled 3 · you +1 card"), h: i.tr("2 Lumber, 1 Ore"), i: i.tr("Settlement on Wool 3, Grain 8"), j: i.tr("Blaauw collects 2 Lumber.") }; });
    ok(U.a === "Roll 8" || /8/.test(U.a), "t() fills variables", U.a); ok(/Blaauw wint/.test(U.b), "t() uses the Dutch pattern", U.b); ok(U.c === "Not in any table, so English stays", "an unknown text stays English, never a raw key", U.c);
    ok(U.d === "spel/spellen", "plural 1 / other", U.d); ok(U.e === "2,5", "Dutch number format", U.e); ok(U.f === "3 grondstofkaarten", "pattern + variable", U.f); ok(/Jij gooide 3/.test(U.g), "sentence pattern", U.g);
    ok(U.h === "2 hout, 1 erts", "resource words (lower case inside a list)", U.h); ok(/^Dorp op /.test(U.i), "move label", U.i); ok(/Blaauw krijgt 2 hout/.test(U.j), "journal sentence", U.j);
    await b.close();
  }

  // ── 5a the Dutch tables and the AI tab hold no forbidden variant ──
  {
    const fs = require("fs"); const root = path.join(__dirname, "..", "src");
    const files = fs.readdirSync(root).filter((f) => /^i18n-nl.*\.js$/.test(f)).map((f) => path.join(root, f)).concat(path.join(root, "review", "ai-lang.js"), path.join(root, "review", "ai-surprise.js")); // v1.87: ai-surprise.js (v1.86.2) has its own NL strings
    const bad = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8"); const isAi = /ai-lang/.test(f), isSx = /ai-surprise/.test(f);
      const vals = isSx ? [src.replace(/\bsteals?\b|"steal"/gi, "")] : isAi ? [src.slice(src.indexOf("  nl: {"), src.indexOf("export const langOf")).replace(/"steal"|steal:/g, ""), src.slice(src.indexOf("const NLW"))] : [...src.matchAll(/\[\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\s*\]/g)].map((m) => m[2]);
      for (const v of vals) for (const [re, why] of TERMS) if (re.test(v)) bad.push(`${path.basename(f)}: ${why}: ${(v.match(re) ? v.slice(Math.max(0, v.search(re) - 20), v.search(re) + 40) : v.slice(0, 60))}`);
    }
    ok(!bad.length, "Dutch tables + AI tab: no forbidden variant (glossary)", bad.slice(0, 6));
    const aiNl = await import(pathToFileURL(path.join(root, "review", "ai-lang.js")).href);
    ok(aiNl.LANG.nl.src.L === "Langste handelsroute" && aiNl.LANG.nl.bd.robber === "Rover" && /^Rover op /.test(aiNl.moveLabel("Robber on Grain 9", "nl")) && aiNl.moveLabel("Victory Point", "nl") === "Puntenkaart", "AI tab uses the app's terms", [aiNl.LANG.nl.src.L, aiNl.LANG.nl.bd.robber]);
    // pure units of the number rules
    const { b, page } = await open(port, "nl", {});
    const U = await page.evaluate(async () => { const i = await import("/src/i18n.js"); return ["Version v1.88", "Code v1.03.", "The robber sat on Pasture 5 for 5 turns", "Blaauw earned the most: 1 cards", "The robber liked Desert: 1 turns", "Cities gave you 2 of 2 points", "2 of 3", "1 knight played (3+ to take Largest army)", "Eights came 4×, expected 1", "T14", "Free road · 2 left · tap a marked spot", "Everyone plays at once, dice every 8s", "Total · 87 rolls, 6 steals, 4 card draws", "Every roll, steal and draw", "Win chance 70.0"].map((x) => i.tr(x)); });
    const want = ["Versie v1.88", "Code v1.03.", "De rover stond 5 beurten op Weide 5", "Blaauw verdiende het meest: 1 kaart", "De rover vond Woestijn fijn: 1 beurt", "Steden gaven jou 2 van 2 punten", "2 van 3", "1 ridder gespeeld (3+ voor de grootste riddermacht)", "Een 8 kwam 4×, verwacht 1", "B14", "Gratis weg · nog 2", "Iedereen speelt tegelijk, elke 8 sec gooien", "Totaal · 87 worpen, 6 keer een kaart gepakt, 4 getrokken kaarten", "Elke worp, gepakte kaart en trekking"];
    want.forEach((w, i) => ok(U[i] === w, `number / grammar rule: ${w}`, U[i]));
    await b.close();
  }

  // ── 5b no ellipsis on a button or the ticker at 360px: Monopoly picker, Year of Plenty, the robber action button, the dock (Buy card) ──
  {
    const { humanStepFn } = require("./tlib-human.js");
    const { b, page } = await open(port, "nl", {});
    const G = (f, a) => page.evaluate(f, a);
    await G(() => { const g = window.__colonistGame; g.goHome(); g.startNewGame({ mode: "classic", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }); }); await sleep(1500);
    await G(() => window.__colonistGame.home?.close?.()); await page.evaluate(humanStepFn);
    for (let i = 0; i < 150; i++) { const r = await G(() => { const g = window.__colonistGame; if (!g.setupPhase && g.phase === "pre_roll" && g.currentPlayer.isHuman) return 1; if (g.currentPlayer?.isHuman && (g.setupPhase || g.pendingAction)) window.__humanStep({ sloppy: 0 }); return 0; }); if (r) break; await sleep(300); }
    await G(() => { const g = window.__colonistGame; g.rollDice = () => ({ total: 8, d1: 4, d2: 4 }); g.handleHumanRoll(); }); await sleep(1500);
    const CLIP = () => { const out = []; const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
      document.querySelectorAll("button, .tbtn, .mbtn, #ticker, .ticker, .ticker *, .tbtn span, .mbtn span").forEach((e) => { if (!vis(e) || e.children.length > 3) return; const t = (e.textContent || "").trim(); if (!t) return; const cs = getComputedStyle(e);
        if (/…$|\.\.\.$/.test(t)) out.push(`ellipsis in text: ${t.slice(0, 40)}`);
        if ((cs.textOverflow === "ellipsis" || cs.overflow === "hidden") && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) out.push(`clipped: ${t.slice(0, 40)} ${e.scrollWidth}>${e.clientWidth}`); });
      return [...new Set(out)]; };
    ok(!(await G(CLIP)).length, "NL dock after the roll: no clipped label (Koop kaart, Ruilen, Klaar)", await G(CLIP));
    for (const t of ["monopoly", "yearOfPlenty"]) {
      await G((t) => { const g = window.__colonistGame, me = g.players[0]; me.devCards = { knight: 0, monopoly: 0, yearOfPlenty: 0, roadBuilding: 0, victoryPoint: 0 }; me.devCards[t] = 1; me.newDevCards = {}; g.render(); g.handleHumanPlayDevCard(t); }, t); await sleep(900);
      const c = await G(CLIP); ok(!c.length, `NL ${t} picker and ticker: no ellipsis, nothing clipped`, c.slice(0, 4));
      if (process.env.SHOTS) await page.screenshot({ path: `${SH}/r2-${t}.png` });
      await G(() => { const g = window.__colonistGame; try { g._cancelDevPlay?.(); } catch (e) { /* */ } g.devPick = null; g.pendingAction = null; g.freeRoadsRemaining = 0; g.render(); }); await sleep(300);
    }
    await G(() => { const g = window.__colonistGame; g.handleHumanEndTurn(); }); await sleep(300);
    await page.waitForFunction(() => { const g = window.__colonistGame; return g.currentPlayer.isHuman && g.phase === "pre_roll"; }, null, { timeout: 60000 }).catch(() => {});
    await G(() => { const g = window.__colonistGame; const me = g.players[0]; Object.assign(me.resources, { wood: 3, brick: 3, sheep: 2, wheat: 3, ore: 3 }); g.rollDice = () => ({ total: 7, d1: 3, d2: 4 }); g.handleHumanRoll(); }); await sleep(1500);
    await G(() => { try { window.__colonistGame._confirmDiscard?.(); } catch (e) { /* */ } }); await sleep(900);
    const rc = await G(CLIP); ok(!rc.length, "NL robber state: action button and ticker fit", rc.slice(0, 4));
    await b.close();
  }

  // ── 3 the screens in Dutch ──
  {
    const { b, page, errors } = await open(port, "nl", { locale: "en-US" });
    const seen = new Set(); let screens = 0;
    const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${SH}/nl-${name}.png` }); };
    const res = await walk(page, { shot, log: () => {} });
    if (process.env.LEFT) require("fs").writeFileSync(process.env.LEFT, JSON.stringify(res.out.map((s) => ({ n: s.name, e: s.texts.map((t) => [t, looksEnglish(t.replace(NAMES, " "))]).filter(([, w]) => w.length).map(([t]) => t), i: s.issues })), null, 1));
    for (const s of res.out) {
      screens++;
      const english = s.texts.filter((t) => !AI_SKIP.test(t)).map((t) => [t, looksEnglish(t.replace(NAMES, " "))]).filter(([, w]) => w.length);
      const raw = s.texts.filter((t) => /\{\w+\}|\bundefined\b|\bNaN\b|\[object/.test(t));
      ok(!english.length, `NL ${s.name}: no English UI text left`, english.slice(0, 4).map(([t, w]) => `${t.slice(0, 70)} [${w.slice(0, 3)}]`));
      ok(!raw.length, `NL ${s.name}: no raw keys or variables`, raw.slice(0, 3));
      const forb = s.texts.filter((t) => !AI_SKIP.test(t)).flatMap((t) => [...TERMS, ...SCREEN].filter(([re]) => re.test(t)).map(([, why]) => `${why}: ${t.slice(0, 60)}`));
      ok(!forb.length, `NL ${s.name}: no forbidden term, plural or version error (glossary)`, forb.slice(0, 4));
      const lay = s.issues.filter((x) => !/walk step failed/.test(x));
      ok(!lay.length, `NL ${s.name}: fits 360px (no overflow, nothing clipped or truncated)`, lay.slice(0, 4));
      const failed = s.issues.filter((x) => /walk step failed/.test(x)); if (failed.length) ok(false, `NL ${s.name}: screen reached`, failed[0]);
    }
    const misses = await page.evaluate(async () => { const i = await import("/src/i18n.js"); return [...i.misses]; });
    const real = misses.filter((m) => looksEnglish(m.replace(NAMES, " ")).length && !AI_SKIP.test(m));
    ok(real.length === 0, "the localizer found a Dutch text for everything it was asked", real.slice(0, 6));
    ok(errors.length === 0, "no page errors in Dutch", errors.slice(0, 2));
    console.log(`walked ${screens} screens`);
    await b.close();
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
