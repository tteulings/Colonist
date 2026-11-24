// v1.91 UI fixes outside the review screens. node tests/ui191b.js PORT   (server: node step105/tests/serve.mjs ROOT PORT)  SHOTS=dir for screenshots
//  at 360x780, 412x923 and 320x700 (stress), NL and EN:
//  1 past games: 14 games (won and lost, long names): no element overlap on a card (bounding boxes), the result is said once, no clipped title,
//    score numbers not crammed against the next avatar, the filter chips fit or show a scroll cue
//  2 progress card: NL decimals use a comma everywhere (4,4 and the trend), no raw ".d" number in Dutch text
//  3 home: "Tegenstanders" label does not touch its segment; settings close button; in-game setup button, "Koop kaart" and hand labels not truncated
const { chromium } = require("playwright"); const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = +process.argv[2] || 9994; let fails = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const SH = process.env.SHOTS || "";
const TAG = process.env.TAG || "";
const SIZES = [[360, 780], [412, 923], [320, 700]];
const NAMES = ["Blaauw", "Geelen", "Groenewoud", "Van der Meulen-Rosendaal", "Roodhart", "Mevrouw De Wit", "Kolonel Pimpel", "Professor Draetsma"];
const seedMetas = () => {
  const out = []; const now = Date.now();
  for (let i = 0; i < 14; i++) {
    const won = i % 3 === 2 || i === 0, w = won ? 0 : 1 + (i % 3);
    const vp = [won ? 10 : 6 + (i % 4), 5 + (i % 5), 10 - (won ? 0 : 0), 7].map((v, k) => (k === w ? 10 : Math.min(v, 9)));
    out.push({ id: "z" + String(1000 + i), v: 1, start: now - i * 7e6 - 1e6, end: now - i * 7e6, mode: i % 5 === 3 ? "rush" : "classic", board: i % 7 === 4 ? "seafarers" : "island", n: 4, pts: 10, hot: false,
      seats: [0, 1, 2, 3].map((k) => ({ name: k === 0 ? "Jij" : NAMES[(i + k * 3) % NAMES.length], vp: vp[k], you: k === 0, prof: k ? ["intermediate", "trader", "shark", "builder"][(i + k) % 4] : undefined })),
      me: 0, winner: w, result: won ? "won" : "lost", turns: 30 + i, ms: (9 + i * 4) * 60000, star: i === 1 || i === 5, rec: true, rd: 0, acc: 55 + ((i * 17) % 40), prov: false, mid: false,
      rn: 1, cls: { lean: i % 4, could: 2, missed: i % 3 + 1, mistake: i % 2, blunder: i % 5 === 0 ? 1 : 0 }, rk: "k1", mist: { start: i % 3 + 1 } });
  }
  return out;
};
async function open(w, h, lang) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((lang) => {
    if (!sessionStorage.getItem("i")) { sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_lang", lang); localStorage.setItem("colonist_recap_lang", lang); localStorage.setItem("colonist.palette", "light"); }
  }, lang);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  await sleep(700);
  return { b, page, errors };
}
// in-page checks of the past games screen
const HIST = () => {
  const r = (e) => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const out = { overlap: [], clipped: [], tight: [], badge: 0, resultDup: 0, rows: 0, chips: null, text: "" };
  document.querySelectorAll(".hs-row").forEach((row) => {
    out.rows++; const rr = r(row);
    const parts = [...row.querySelectorAll(".hs-badge, .hs-main b, .hs-main small, .hs-star, .hs-sc, .hs-dur, .hs-bots, .hs-acc")].filter((e) => e.offsetParent);
    out.badge += row.querySelectorAll(".hs-badge").length;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (hit(r(parts[i]), r(parts[j]))) out.overlap.push(`${parts[i].className}|${parts[j].className}`);
    parts.forEach((p) => { const q = r(p); if (q.right > rr.right + 0.5 || q.left < rr.left - 0.5) out.overlap.push("outside " + p.className); });
    const t = row.querySelector(".hs-main b"); if (t.scrollWidth > t.clientWidth + 1 || r(t).height > 44) out.clipped.push(t.textContent);
    row.querySelectorAll(".hs-sc > span").forEach((s, i, all) => { const n = all[i + 1]; if (n) { const gap = r(n).left - r(s).right; if (gap < 6) out.tight.push(gap.toFixed(1)); } });
    const txt = row.querySelector(".hs-main b").textContent.toLowerCase(); const bd = row.querySelector(".hs-badge")?.textContent.toLowerCase();
    if (bd && (txt.startsWith(bd.slice(0, 5)) || /^(won|lost|gewonnen|verloren)/.test(txt))) out.resultDup++;
  });
  const c = document.querySelector(".hs-chips"); if (c) { const last = c.lastElementChild; out.chips = { fits: c.scrollWidth <= c.clientWidth + 1, cue: c.parentElement.classList.contains("cue") || !!c.closest(".hs-chipwrap"), sw: c.scrollWidth, cw: c.clientWidth }; }
  const prog = document.querySelector(".hs-prog"); out.text = prog ? prog.innerText : "";
  out.hscroll = document.documentElement.scrollWidth > innerWidth + 1;
  return out;
};
const BTN = () => {
  const r = (e) => e.getBoundingClientRect(); const issues = [];
  document.querySelectorAll("button, .mbtn, .waiting .wt, .waiting .wt small, .slot-name, .rib span, .mlbl, .hs-seg label, .seg label, .seg span").forEach((b) => {
    const cs = getComputedStyle(b); if (!b.offsetParent && cs.position !== "fixed") return; const q = r(b); if (!q.width || !q.height) return;
    if (b.scrollWidth > b.clientWidth + 1 && b.clientWidth > 0 && cs.overflow !== "visible" ) issues.push(`clipped ${b.className || b.tagName}: "${(b.innerText || "").trim().slice(0, 24)}" ${b.scrollWidth}>${b.clientWidth}`);
    if (cs.textOverflow === "ellipsis" && b.scrollWidth > b.clientWidth + 1) issues.push(`ellipsis ${b.className}: "${(b.innerText || "").trim().slice(0, 24)}"`);
    if (b.matches(".slot-name, .rib span, .mlbl")) { const rg = document.createRange(); rg.selectNodeContents(b); const t = rg.getBoundingClientRect(), p = r(b.closest(".card, .mbtn")); if (t.left < p.left + 2 || t.right > p.right - 2) issues.push(`tight ${b.className}: "${b.textContent.trim()}" ${Math.round(t.left - p.left)},${Math.round(p.right - t.right)}`); }
  });
  return issues;
};
(async () => {
  for (const lang of ["nl", "en"]) for (const [w, h] of SIZES) {
    const tag = `${lang}-${w}`; const { b, page, errors } = await open(w, h, lang); const G = (f, a) => page.evaluate(f, a);
    const shot = async (n) => { if (SH) await page.screenshot({ path: `${SH}/${TAG}${n}-${tag}.png` }); };
    // ── 1/2 past games
    await G(async (metas) => { const g = window.__colonistGame; for (const m of metas) await g.hist.put(m, { state: null, rv: null }, { quiet: true }); g.hist.onChange?.(); }, seedMetas());
    await G(() => window.__colonistGame.histOpen()); await sleep(1200);
    const H = await G(HIST); await shot("hist-top");
    ok(H.rows >= 12, `${tag} past games: ${H.rows} rows`);
    ok(!H.overlap.length, `${tag} past games: no overlapping parts in a card`, [...new Set(H.overlap)].join(", "));
    ok(!H.clipped.length, `${tag} past games: no clipped title`, H.clipped.slice(0, 2));
    ok(H.resultDup === 0, `${tag} past games: the result is said once (badge and title do not repeat it)`);
    ok(!H.tight.length, `${tag} past games: score numbers keep >= 6px from the next avatar`, H.tight.slice(0, 3));
    ok(!H.hscroll, `${tag} past games: no horizontal page scroll`);
    ok(H.chips && (H.chips.fits || H.chips.cue), `${tag} past games: filter chips fit or show a scroll cue`, H.chips);
    if (lang === "nl") ok(!(await G(() => /\b(Today|Yesterday)\b/.test(document.querySelector(".hs-list").innerText))), `${tag} past games: dates are Dutch`);
    if (lang === "nl") ok(!/\d\.\d/.test(H.text), `${tag} progress card: no decimal dot in Dutch`, H.text.replace(/\n/g, " ").slice(0, 200));
    else ok(!/\d,\d/.test(H.text), `${tag} progress card: English keeps the dot`);
    await G(() => { const s = document.querySelector(".hs-scroll"); const l = document.querySelector(".hs-list"); s.scrollTo(0, l.offsetTop - 20); }); await sleep(300); await shot("hist-list");
    await G(() => window.__colonistGame.histClose()); await sleep(300);
    // ── 3 home
    await G(() => window.__colonistGame.goHome()); await sleep(800); await shot("home");
    await G(() => window.__colonistGame._showDifficultyModal()); await sleep(600); // v1.99: the New game sheet holds the opponents
    const home = await G(() => { const r = (e) => e.getBoundingClientRect(); const out = [];
      document.querySelectorAll(".home *, .hm *").forEach((e) => { if (e.children.length) return; const t = e.textContent.replace(/\u00AD/g, "").trim(); if (/^(tegenstanders|opponents)$/i.test(t)) { const row = e.closest("[class*=row], [class*=seg], div"); const seg = e.parentElement.parentElement?.querySelector("[role=radiogroup], .seg, [class*=seg]"); const rg = document.createRange(); rg.selectNodeContents(e); out.push({ cls: e.className, p: e.parentElement.className, lbl: rg.getBoundingClientRect().toJSON(), seg: seg ? r(seg).toJSON() : null, lw: e.scrollWidth, cw: e.clientWidth }); } }); return out; });
    ok(home.length > 0, `${tag} home: opponents label found`);
    for (const x of home) ok(!x.seg || x.lbl.right <= x.seg.left - 6, `${tag} home: label clear of its segment`, { l: Math.round(x.lbl.right), s: Math.round(x.seg?.left) });
    const hb = await G(BTN); ok(!hb.length, `${tag} home: no clipped button (Gemiddeld, Zeevaarders, ...)`, hb.slice(0, 3));
    // ── settings
    await G(() => document.querySelector(".newgame-modal")?.remove()); await G(() => window.__colonistGame.settingsUI.open("game")); await sleep(500); await shot("settings");
    const st = await G(() => { const r = (e) => e.getBoundingClientRect(); const x = document.querySelector(".st-close"); const tabs = [...document.querySelectorAll(".st-nav button")].map((t) => ({ t: t.textContent.trim(), b: r(t).toJSON() })); const ti = document.querySelector(".st-body h2, .st-body .st-row b, .st-body b"); return { x: x ? { c: x.className, b: r(x).toJSON() } : null, tabs, cls: [...document.querySelectorAll("[class*=st-]")].slice(0, 12).map((e) => e.className) }; });
    const xb = st.x?.b; ok(!!xb && xb.width >= 43.5 && xb.height >= 43.5 && xb.left < 80, `${tag} settings: the back button is a 44px target at the top left`, { x: xb }); // v1.99: one page, no tab row
    ok(!(await G(() => /^[a-z]/.test((document.querySelector("#aiAnalysisToggle")?.closest("label")?.querySelector(".st-note")?.textContent || "A").trim()))), `${tag} settings: the Analysis mode note starts with a capital`);
    await G(() => window.__colonistGame.settingsUI.close());
    // ── in game: setup, then after placing
    await G(() => { const g = window.__colonistGame; g.goHome(); g.startNewGame({ mode: "classic", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }); }); await sleep(1800);
    await G(() => { const g = window.__colonistGame; g.home?.close?.(); g.onboarding?.endIntro?.(); }); await sleep(600);
    await shot("game-setup");
    const bi = await G(BTN); ok(!bi.length, `${tag} in game (setup): no truncated or spilling button / card label`, bi.slice(0, 4));
    await G(() => { const g = window.__colonistGame; const h = g.players.find((p) => p.isHuman) || g.players[0]; h.resources = { wood: 0, brick: 1, sheep: 1, wheat: 1, ore: 1 }; g.render(); }); await sleep(500); await shot("game-hand");
    const bh = await G(BTN); ok(!bh.length, `${tag} in game (hand): "Koop kaart" and resource names fit their button / card`, bh.slice(0, 4));
    ok(!errors.length, `${tag} no page errors`, errors.slice(0, 2));
    await b.close();
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
