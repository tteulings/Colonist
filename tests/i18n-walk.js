// v1.87 shared by tests/i18n187.js: walks the main screens of the app in one language and reports, per screen, the visible texts,
// layout problems at 360px (horizontal overflow, clipped buttons) and the sentences the localizer could not translate.
const { chromium } = require("playwright");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
const EXPORTS = ["72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", "23eda3e1-colonist-2026-11-13-mwfdvqb2dmnw.json", "c96a5156-colonist-2026-11-11-mwb26snvis5o.json"].map((f) => UP + f);

// in-page: all visible texts (text nodes + aria-label/title/placeholder/alt of visible elements) and layout problems
const SCAN = () => {
  const vis = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || e.hidden || +cs.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const texts = new Set(); const w = document.createTreeWalker(document.body, 5);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const el = n.parentElement; if (!el || /^(SCRIPT|STYLE)$/.test(el.tagName) || el.closest("[data-i18n-skip],[data-nm],canvas,svg") || !vis(el)) continue; const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t) texts.add(t); }
    else if (n.getAttribute && vis(n) && !n.closest("[data-i18n-skip],[data-nm]")) for (const a of ["aria-label", "title", "placeholder", "alt"]) { const v = n.getAttribute(a); if (v && v.trim()) texts.add("@ " + v.replace(/\s+/g, " ").trim()); }
  }
  const issues = [];
  const de = document.documentElement; if (de.scrollWidth > 361 || document.body.scrollWidth > 361) issues.push(`page scrolls horizontally ${de.scrollWidth}/${document.body.scrollWidth}`);
  document.querySelectorAll("button, [role=button], .btn, a.hm-lab, [data-home], [role=tab]").forEach((b) => {
    if (!vis(b) || b.closest(".ap, [data-aibody]")) return; /* the AI page brings its own words and layout */ const r = b.getBoundingClientRect(); const t = (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30);
    const sc = (() => { for (let e = b.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === "auto" || o === "scroll") && e.scrollWidth > e.clientWidth) return true; } return false; })(); if ((r.right > 361 || r.left < -1) && !sc) issues.push(`button off-screen: "${t}" ${Math.round(r.left)}..${Math.round(r.right)}`);
    // a label wider than its box: clipped (overflow hidden / ellipsis) or spilling out
    const cs = getComputedStyle(b); if (b.scrollWidth > b.clientWidth + 2 && b.clientWidth > 0 && !b.classList.contains("dplay") /* its tap target is a ::before beyond the pill */) issues.push(`button text clipped: "${t}" ${b.scrollWidth}>${b.clientWidth}`);
    b.querySelectorAll("span, b, small, i").forEach((c) => { if (!vis(c) || c.children.length > 2) return; const cc = getComputedStyle(c); if ((cc.textOverflow === "ellipsis" || cc.overflow === "hidden") && c.scrollWidth > c.clientWidth + 2 && c.clientWidth > 0 && c.textContent.trim()) issues.push(`truncated: "${c.textContent.trim().slice(0, 32)}" ${c.scrollWidth}>${c.clientWidth}`); });
  });
  document.querySelectorAll("h1,h2,h3,p,small,.sub,.nm,[class*=title],[class*=lbl],[class*=label]").forEach((c) => { if (!vis(c) || c.children.length > 3 || !c.textContent.trim()) return; const cc = getComputedStyle(c); if ((cc.textOverflow === "ellipsis") && c.scrollWidth > c.clientWidth + 2 && c.clientWidth > 0) issues.push(`truncated: "${c.textContent.trim().slice(0, 32)}" ${c.scrollWidth}>${c.clientWidth}`); });
  return { texts: [...texts], issues: [...new Set(issues)] };
};

async function open(port, lang, opt = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: opt.locale || "en-US" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((lang) => {
    if (!sessionStorage.getItem("i")) { sessionStorage.setItem("i", "1"); localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", "light"); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist_review_auto", "off"); if (lang) localStorage.setItem("colonist_lang", lang); }
    let a = 12345; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, lang);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  await sleep(600);
  return { b, ctx, page, errors };
}

/** Walk the screens; returns [{ name, texts, issues }]. `shot(name)` is called after each screen when given. */
async function walk(page, { shot, log = () => {} } = {}) {
  const G = (f, a) => page.evaluate(f, a); const out = [];
  const grab = async (name) => { await sleep(500); const r = await G(SCAN); r.html = await G(async () => { const i = await import("/src/i18n.js"); return i.mixedHtml(); }); out.push({ name, ...r }); log(name, r.texts.length, r.issues.length); if (shot) await shot(name); };
  const step = async (name, fn) => { try { await fn(); await grab(name); } catch (e) { out.push({ name, texts: [], issues: [`walk step failed: ${String(e).slice(0, 160)}`] }); log(name, "FAILED", String(e).slice(0, 160)); } };
  const tap = async (sel, i = 0) => { await page.locator(sel).nth(i).tap({ timeout: 4000 }); await sleep(450); };
  const closeAll = async () => { await G(() => { const g = window.__colonistGame; try { g.menu?.close?.(); } catch (_) {} try { g.settingsUI?.close?.(); } catch (_) {} document.querySelectorAll(".newgame-modal").forEach((e) => e.remove()); try { g.onboarding?.endIntro?.(); } catch (_) {} try { g.histClose?.(); } catch (_) {} try { g.botsClose?.(); } catch (_) {} try { g.lessonsClose?.(); } catch (_) {} }); await sleep(300); };

  // ── Home, Menu, New game, How to play, Settings ──
  await step("home", async () => { await G(() => window.__colonistGame.goHome()); await sleep(500); });
  await step("menu", async () => { await G(() => window.__colonistGame.menu.show()); });
  await G(() => window.__colonistGame.menu.close());
  await step("newgame", async () => { await G(() => window.__colonistGame._showDifficultyModal()); });
  await step("newgame-seafarers-rush", async () => { for (const s of ["[data-board=seafarers]", "[data-mode=rush]"]) { try { await page.locator(".newgame-modal " + s).first().tap({ timeout: 1500 }); await sleep(300); } catch (_) {} } });
  await step("newgame-bots", async () => { for (const s of ["[data-mode=classic]", "[data-board=classic]"]) { try { await page.locator(".newgame-modal " + s).first().tap({ timeout: 1500 }); await sleep(300); } catch (_) {} } try { await page.locator(".newgame-modal [data-bsmode=each], .newgame-modal .bs-mode button").nth(1).tap({ timeout: 1500 }); } catch (_) {} await sleep(300); });
  await closeAll();
  await step("friend", async () => { await G(() => window.__colonistGame._showDifficultyModal({ friend: true })); });
  await closeAll();
  for (const i of [0, 1, 2]) await step("intro" + i, async () => { if (i === 0) await G(() => window.__colonistGame.onboarding.showIntro(0, true)); else await G((i) => window.__colonistGame.onboarding.showIntro(i, true), i); });
  await closeAll();
  for (const tab of ["game", "look", "bots", "about"]) { await step("settings-" + tab, async () => { await G((t) => window.__colonistGame.settingsUI.open(t), tab); await sleep(300); }); }
  await closeAll();

  // ── Past games, game sheet, Lessons, Bots (with three real exports) ──
  for (const f of EXPORTS) { const ex = JSON.parse(fs.readFileSync(f, "utf8")); await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex); }
  const ids = EXPORTS.map((f) => JSON.parse(fs.readFileSync(f, "utf8")).meta.id);
  await step("past-games", async () => { await G(() => window.__colonistGame.histOpen()); await sleep(1500); });
  await step("game-sheet", async () => { await page.locator(`[data-hrow="${ids[0]}"]`).tap(); await sleep(900); });
  await step("review-overview", async () => { await page.locator("[data-sact=review]").tap(); await page.waitForSelector(".rv .rv-tabs", { timeout: 20000 }); await sleep(2500); });
  const tabs = await G(() => [...document.querySelectorAll(".rv-tabs [data-rvt]")].map((b) => b.dataset.rvt));
  for (const t of tabs) {
    if (t === "overview" || t === "ai") continue;
    await step("review-" + t, async () => { await page.locator(`.rv-tabs [data-rvt=${t}]`).tap(); await sleep(1200); });

    if (t === "moves") {
      await step("review-step", async () => { await page.locator("[data-rvfirst], [data-rvj]").first().tap({ timeout: 3000 }); await sleep(2500); });
      await step("review-step-why", async () => { await page.locator("[data-rvwhy], [data-rvq]").first().tap({ timeout: 3000 }); await sleep(2500); });
      for (let k = 0; k < 4; k++) { const open = await G(() => { const x = document.querySelector("[data-rvinfo-x], [data-rvwhy-x]") || document.querySelector("[data-rvclose-step]"); if (x) { x.click(); return true; } return false; }); if (!open) break; await sleep(500); if (await G(() => !!document.querySelector(".rv-tabs [data-rvt]"))) break; }
    }
  }
  await step("review-ai", async () => { await page.locator(`.rv-tabs [data-rvt=ai]`).tap(); await sleep(2500); });
  await step("review-player", async () => { await page.locator(`.rv-tabs [data-rvt=overview]`).tap(); await sleep(800); try { await page.locator("[data-rvp], .rsc-h").first().tap({ timeout: 2000 }); } catch (_) {} await sleep(800); });
  await closeAll(); await G(() => { const g = window.__colonistGame; try { g._rvCloseReview?.(true); } catch (_) {} try { g.histClose(); } catch (_) {} }); await sleep(400);
  await step("lessons", async () => { await G(() => window.__colonistGame.goHome()); await sleep(500); await page.locator("[data-home=lessons]").tap(); await sleep(1500); });
  await step("lessons-cat", async () => { await page.locator(".ln-cat").first().tap(); await sleep(700); });
  await closeAll(); await G(() => { try { window.__colonistGame.lessonsClose(); } catch (_) {} });
  await step("bots", async () => { await G(() => window.__colonistGame.goHome()); await sleep(500); await page.locator("[data-home=bots]").tap(); await sleep(1500); });
  await step("bot-profile", async () => { await page.locator(".bpg-row, [data-open]").first().tap({ timeout: 3000 }); await sleep(700); });
  await closeAll();

  // ── a game: set-up, main phase, build, trade, cards, journal, stats, end ──
  const { humanStepFn } = require("./tlib-human.js");
  await G(() => { const g = window.__colonistGame; g.goHome(); g.startNewGame({ mode: "classic", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }); });
  await sleep(1200);
  await step("game-setup", async () => { await G(() => { const g = window.__colonistGame; g.home?.close?.(); }); });
  await step("game-setup-pill", async () => { await G(() => { const g = window.__colonistGame; if (g.setupAction === "settlement") { const id = g.getBestInitialSettlementNode(g.players[0]); g._tapNode?.(id); } }); });
  await page.evaluate(humanStepFn);
  const until = async (cond, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await G((c) => { const g = window.__colonistGame; const me = g.players[0]; return eval(c); }, cond); if (r) return true; await G(() => { const g = window.__colonistGame; if (g.currentPlayer?.isHuman && (g.setupPhase || g.pendingAction)) window.__humanStep({ sloppy: 0 }); }); await sleep(120); } return false; };
  await until("!g.setupPhase && g.phase === 'pre_roll' && g.currentPlayer.isHuman");
  await step("game-preroll", async () => { await sleep(300); });
  await step("game-after-roll", async () => { await G(() => { const g = window.__colonistGame; g.rollDice = () => ({ total: 8, d1: 4, d2: 4 }); g.handleHumanRoll(); }); await sleep(1500); });
  await G(() => { const g = window.__colonistGame; const me = g.players[0]; ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { g.bank[r] += me.resources[r]; me.resources[r] = 0; }); Object.assign(me.resources, { wood: 3, brick: 3, sheep: 2, wheat: 3, ore: 3 }); ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { g.bank[r] -= me.resources[r]; }); me.devCards.knight = 1; me.newDevCards = me.newDevCards || {}; g.render(); });
  await sleep(500);
  await step("game-main", async () => {});
  await step("game-build", async () => { await G(() => window.__colonistGame.toggleBuildSheet(true)); });
  await step("game-build-confirm", async () => { await G(() => { const g = window.__colonistGame; g.toggleBuildSheet(false); document.getElementById("buildRoadBtn").click(); }); await sleep(600); });
  await G(() => { const g = window.__colonistGame; try { g._cancelAction?.(); g.cancelAction?.(); } catch (_) {} g.pendingAction = null; g.confirmBuild = null; g.render(); }); await sleep(400);
  await step("game-trade-bank", async () => { await G(() => window.__colonistGame.openTradeModal()); await sleep(500); });
  await step("game-trade-players", async () => { try { await page.locator("#tradeModal [data-tab=players], #tradeModal [data-ttab=offer], #tradeModal .tab-offer, #tradeModal [role=tab]").nth(1).tap({ timeout: 2000 }); } catch (_) {} await sleep(500); });
  await G(() => window.__colonistGame.closeTradeModal()); await sleep(300);
  await step("game-cards", async () => { await G(() => { const g = window.__colonistGame; document.getElementById("playDevBtn").click(); }); await sleep(600); });
  await G(() => { const g = window.__colonistGame; g.hideDevCardPicker?.(); g._syncScrim?.(); }); await sleep(300);
  await step("game-journal", async () => { await G(() => window.__colonistGame.toggleLog(true)); await sleep(500); });
  await G(() => window.__colonistGame.toggleLog(false)); await sleep(300);
  await step("game-legend", async () => { try { await page.locator("[data-seat]").nth(1).tap({ timeout: 2000 }); } catch (_) {} await sleep(500); });
  await G(() => { document.querySelectorAll(".chip-legend, .legend, .pc-pop").forEach((e) => e.remove()); }); 
  await step("game-livestats", async () => { await G(() => window.__colonistGame.liveStatsOpen()); await sleep(800); });
  await G(() => window.__colonistGame.liveStatsClose?.()); await sleep(300);
  // a 7: discard sheet, then the robber, then whom to rob
  await step("game-seven-discard", async () => { await G(() => { const g = window.__colonistGame; g.handleHumanEndTurn(); }); await sleep(300); });
  await until("g.currentPlayer.isHuman && g.phase === 'pre_roll'", 60000);
  await step("game-seven", async () => { await G(() => { const g = window.__colonistGame; const me = g.players[0]; Object.assign(me.resources, { wood: 3, brick: 3, sheep: 2, wheat: 3, ore: 3 }); g.rollDice = () => ({ total: 7, d1: 3, d2: 4 }); g.handleHumanRoll(); }); await sleep(1500); });
  await step("game-robber", async () => { await G(() => { const g = window.__colonistGame; try { g._confirmDiscard?.(); } catch (_) {} }); await sleep(900); });
  await step("game-victim", async () => { await G(() => { const g = window.__colonistGame; if (!g.robberVictimOptions?.length) window.__humanStep({ sloppy: 0 }); }); await sleep(900); });
  for (let i = 0; i < 12; i++) { const busy = await G(() => { const g = window.__colonistGame; if (g.robberVictimOptions?.length || g.pendingAction === "robber" || g.pendingDiscard) { window.__humanStep({ sloppy: 0 }); return true; } return false; }); if (!busy) break; await sleep(500); }
  await G(() => { const g = window.__colonistGame; g.pendingAction = null; g.robberVictimOptions = []; g.robberContext = null; g.render(); });
  await sleep(800);
  // the end of the game: the end screen and its tabs
  await step("game-over", async () => { await G(() => { const g = window.__colonistGame; const me = g.players[0]; g.currentPlayerIndex = 0; g.phase = "main"; g.winner = null; g.winner = me; g.phase = "game_over"; g.showGameOverOverlay(); }); await sleep(3500); });
  const so = await G(() => [...document.querySelectorAll(".gs-tabs [data-tab]")].map((b) => b.dataset.tab));
  await step("end-top", async () => { await G(() => { const e = document.querySelector(".gs-scroll"); if (e) e.scrollTop = 0; }); });
  for (const t of so) await step("end-" + t, async () => { await G((t) => { document.querySelector(".gs-scroll")?.scrollTo(0, 0); document.querySelector(`.gs-tabs [data-tab=${t}]`)?.scrollIntoView({ block: "center" }); }, t); await sleep(300); await page.locator(`.gs-tabs [data-tab=${t}]`).tap({ timeout: 4000 }); await sleep(700); });
  await step("end-bottom", async () => { await G(() => { const e = document.querySelector(".gs-scroll"); if (e) e.scrollTop = 99999; }); });
  // ── Rush, Seafarers and Pass & play, each a short look ──
  const fresh = async (settings) => { await G((st) => { const g = window.__colonistGame; try { g.removeGameOverOverlay?.(); } catch (_) {} g.goHome(); g.startNewGame(st); }, settings); await sleep(1500); await G(() => window.__colonistGame.home?.close?.()); await sleep(500); };
  await fresh({ mode: "rush", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate", rushInterval: 8 });
  await step("rush-start", async () => { await sleep(500); });
  await G(() => { window.__humanStep?.({ sloppy: 0 }); }); await sleep(2500);
  await step("rush-main", async () => { await sleep(500); });
  await fresh({ mode: "classic", board: "seafarers", map: "beginner", numBots: 3, botStyleMode: "all", allPreset: "intermediate" });
  await step("sea-start", async () => { await sleep(500); });
  await until("!g.setupPhase", 40000).catch(() => {});
  await step("sea-main", async () => { await sleep(500); });
  await fresh({ mode: "classic", board: "classic", map: "balanced", numBots: 2, botStyleMode: "all", allPreset: "intermediate", humans: [true, false] });
  await step("hotseat-start", async () => { await sleep(800); });
  await step("hotseat-cover", async () => { await G(() => { const g = window.__colonistGame; g._hsAck?.(); }); await sleep(500); });
  return { out, G, grab, step, tap, closeAll };
}
module.exports = { walk, open, SCAN, sleep, EXPORTS };
