// v1.87 one language for the whole app. node i18n187.js PORT   (server: node step105/tests/serve.mjs ROOT PORT)
//  1 the default follows the browser (nl* -> Dutch, else English) and the setting overrides it; the AI recap language is the same setting
//  2 switching in Settings changes the open screen at once and back again, without a reload; the choice survives a reload
//  3 every main screen walked in Dutch (Home, Menu, New game, How to play, Settings, Past games, review tabs, Lessons, Bots,
//    a running game: ticker, prompts, build sheet, trade, cards, journal, legend, live stats, a 7 and the robber, the end screen):
//    no English UI sentence left (names allowed), no raw {variable} or "undefined", no horizontal overflow, no clipped or truncated label at 360px
//  4 pure units: t() with variables, plurals, numbers, dates
const path = require("path"); const { pathToFileURL } = require("url");
const { walk, open, sleep } = require("./i18n-walk.js");
const port = +process.argv[2] || 9960; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const SH = process.env.SHOTS || path.join(__dirname, "..", "..", "i18n187");
const NAMES = /\b(Katan|Blaauw|Geelen|Groen|Roodhart|Rosa|Van Geelen|Groenewoud|Pimpel|Mevrouw|Kolonel|Dominee|Professor|De Wit|Draet|AI|Rush|Monte Carlo|Sunny Island|Bot|Elo|SE|pp|k)\b/g;
// the AI tab brings its own Dutch/English (src/review/ai-lang.js): its texts are not part of this check
const AI_SKIP = /^(Samenvatting uit de cijfers|Voor dit spel samengesteld|Vraag iets over dit spel)/;
(async () => {
  const { looksEnglish } = await import(pathToFileURL(path.join(__dirname, "i18n-words.mjs")).href);
  const i18n = await import(pathToFileURL(path.join(__dirname, "..", "src", "i18n.js")).href).catch(() => null); // node: no DOM, only the pure parts

  // ── 1 default language ──
  for (const [locale, saved, want] of [["en-US", null, "en"], ["nl-NL", null, "nl"], ["nl-BE", null, "nl"], ["de-DE", null, "en"], ["nl-NL", "en", "en"], ["en-US", "nl", "nl"]]) {
    const { b, page } = await open(port, saved, { locale });
    const r = await page.evaluate(async () => { const i = await import("/src/i18n.js"); const rc = await import("/src/review-recap.js"); return { lang: i.lang(), recap: rc.recapLang(), html: document.documentElement.lang, home: document.querySelector("[data-home=history]")?.innerText || "" }; });
    ok(r.lang === want && r.recap === want && r.html === want, `locale ${locale}${saved ? " + setting " + saved : ""} -> ${want}`, r);
    ok(want === "nl" ? /Eerdere spellen/.test(r.home) : /Past games/.test(r.home), "Home shows the language", r.home.split("\n")[0]);
    await b.close();
  }

  // ── 2 switch in Settings, live and persistent ──
  {
    const { b, page } = await open(port, null, { locale: "en-US" });
    const G = (f, a) => page.evaluate(f, a);
    await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(500);
    ok(await G(() => /Language/.test(document.querySelector(".st-body").innerText) && !!document.querySelector("[data-lang=nl]") && !document.querySelector("[data-rc-lang]")), "Settings has one Language row (no separate recap language)");
    await page.locator("[data-lang=nl]").tap(); await sleep(600);
    ok(await G(() => /Taal/.test(document.querySelector(".st-body").innerText) && /Uiterlijk/.test(document.querySelector(".st-nav").innerText)), "the open Settings turns Dutch at once");
    ok(await G(async () => (await import("/src/review-recap.js")).recapLang() === "nl"), "the AI recap / AI tab read the same setting");
    await G(() => window.__colonistGame.settingsUI.close()); await G(() => window.__colonistGame.goHome()); await sleep(500);
    ok(await G(() => /Eerdere spellen/.test(document.body.innerText)), "Home is Dutch");
    await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady); await sleep(600);
    ok(await G(() => /Eerdere spellen/.test(document.querySelector("[data-home=history]").innerText)), "the choice survives a reload");
    await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(400);
    await page.locator("[data-lang=en]").tap(); await sleep(600);
    ok(await G(() => /Language/.test(document.querySelector(".st-body").innerText) && /Look & feel/.test(document.querySelector(".st-nav").innerText)), "and back to English at once");
    await G(() => window.__colonistGame.settingsUI.close()); await sleep(300);
    ok(await G(() => /Past games/.test(document.querySelector("[data-home=history]")?.innerText || "") || /Past games/.test(document.body.innerText)), "Home is English again, nothing left over from Dutch");
    await page.locator("[data-lang=nl]").count(); // Auto: forget the choice
    await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(300); await page.locator("[data-lang='']").tap(); await sleep(400);
    ok(await G(() => localStorage.getItem("colonist_lang") == null), "Auto forgets the choice (follows the browser again)");
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
