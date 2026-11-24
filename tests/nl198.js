// v1.98 the whole app in one language (Dutch / English): a systematic audit. node tests/nl198.js PORT [LANG]   (server: node step105/tests/serve.mjs ROOT PORT)
//  Drives a real game at 360x780 through set-up, the build tray (too poor / enough / Undo), bank and bot trades, an offer nobody takes, a 7 with the
//  discard dock, the robber dock and the steal dock, development cards, the end screen, the review tabs, Lessons, Bots, Settings, the live win
//  chance, Rush, Seafarers and Pass & play. A MutationObserver records EVERY text node, aria-label / title / placeholder / alt and toast that reaches
//  the page (also the ones that live for a second only), and the journal lines.
//  NL: no recorded text may hold an English word (dictionary: every English key word no Dutch value uses + the extra list below + a few shapes like
//      "4 of 9", "Ore on 4"), no truncated header (a text cut by an ellipsis) and no horizontal overflow.
//  EN: the mirror: no Dutch word may reach the English app.
//  OUT=file.json writes {lang, seen:[[text, step]], english:[...], truncated:[...]} (used to compare versions; asserts are then skipped when NOASSERT=1).
const path = require("path"); const fs = require("fs"); const { pathToFileURL } = require("url");
const { open, sleep, walk, EXPORTS } = require("./i18n-walk.js");
const port = +process.argv[2] || 9021; let LANG = "nl"; const LANGS = process.argv[3] ? [process.argv[3].toLowerCase()] : ["nl", "en"]; // no language given: Dutch, then the English mirror
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c && !process.env.NOASSERT) fails++; };
const SH = process.env.SHOTS || "";
const NAMES = /\b(Katan|Blaauw|Geelen|Groen|Roodhart|Rosa|Van Geelen|Groenewoud|Pimpel|Mevrouw|Kolonel|Dominee|Professor|De Wit|Draet|AI|Rush|Monte Carlo|Sunny Island|Bot|Elo|SE|pp|k|Claude|Colonist)\b/g;
const AI_SKIP = /^(Samenvatting uit de cijfers|Voor dit spel samengesteld|Vraag iets over dit spel|Summary from the numbers|Made for this game|Ask something about this game)/;
// words the heuristic dictionary may miss: they are English when they stand on their own in a Dutch text
const EXTRA_EN = "need undo rob now takers offer sent well played finished moves being worked out settlement settl decision easy games simulated lumber ore grain wool brick traded with you your yours robber discard keep hand back pick more chosen suggest offer sent ask bots place confirm cancel build buy card cards road roads city cities knight knights points point turn dice roll rolled steal stole victim blocks produces nothing yours too done back close open start finish next previous undo redo save load reset settings language game over winner wins won lost luck win chance quick model".split(" ");
const EN_SHAPES = [[/\b\d+ of \d+\b/, "N of M"], [/\b(?:erts|hout|baksteen|wol|graan|Lumber|Ore|Grain|Wool|Brick) on \d+\b/i, "X on N"], [/→\s*\d+/, ""], [/\b(you|You) \d+ →/, "you N →"], [/\d+\/\d+ (klaar|ready)/, ""]].filter(([, w]) => w);
// a Dutch word list for the mirror check: every word of a Dutch value that no English key and no common English word uses
const NAMES_LOWER = "katan blaauw geelen groen roodhart rosa mevrouw kolonel dominee van groenewoud pimpel professor draet wit ai lab rush sunny island seafarers monte carlo bot bots start elo claude colonist".split(" ");

// in-page recorder: everything that reaches the DOM, with the step it appeared in (hidden or not: the localizer touches all of it)
const RECORDER = () => {
  if (window.__nlrec) return; const seen = new Map(); window.__nlrec = seen; window.__step = "boot"; const pend = new Set();
  const add = (t, kind, el) => { t = (t || "").replace(/\s+/g, " ").trim(); if (!t || t.length < 2 || !/[A-Za-z]{2}/.test(t)) return; if (el && el.closest && el.closest("[data-i18n-skip],[data-nm],script,style,svg,canvas")) return; const k = (kind || "") + t; if (!seen.has(k)) seen.set(k, window.__step); };
  const scan = (n) => {
    if (n.nodeType === 3) { if (n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) add(n.nodeValue, "", n.parentElement); return; }
    if (n.nodeType !== 1) return; if (/^(SCRIPT|STYLE)$/.test(n.tagName)) return;
    for (const a of ["aria-label", "title", "placeholder", "alt"]) { const v = n.getAttribute(a); if (v) add(v, "@" + a + " ", n); }
    for (const c of n.childNodes) scan(c);
  };
  const flush = () => { const l = [...pend]; pend.clear(); l.forEach((n) => { try { scan(n); } catch (_) { /* gone */ } }); };
  const start = () => {
    new MutationObserver((ms) => { for (const m of ms) { if (m.type === "childList") m.addedNodes.forEach((n) => pend.add(n)); else pend.add(m.type === "characterData" ? m.target : m.target); } setTimeout(flush, 30); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title", "placeholder", "alt"] });
    setInterval(() => { scan(document.body); }, 700);
  };
  if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
};
// in-page: ticker / toast / prompt overflow and text cut by an ellipsis at 360px (a header is "truncated" when its text is wider than its box and the box clips)
const CUT = () => {
  const out = []; const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  document.querySelectorAll("body *").forEach((e) => {
    if (e.closest("[data-i18n-skip],[data-nm],svg,canvas,.ap,[data-aibody]") || !vis(e)) return; const t = (e.textContent || "").replace(/\s+/g, " ").trim(); if (t.length < 4 || e.children.length > 4) return;
    const cs = getComputedStyle(e); const clip = cs.textOverflow === "ellipsis" || cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    if (cs.display === "inline" || e.getBoundingClientRect().width < 3) return; // inline: no box of its own; under 3px: a screen-reader-only label
    if (clip && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) out.push(`cut: "${t.slice(0, 60)}" ${e.scrollWidth}>${e.clientWidth} <${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}>`);
    else if (clip && cs.webkitLineClamp && cs.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 2) out.push(`clamped: "${t.slice(0, 60)}" ${e.scrollHeight}>${e.clientHeight}`);
  });
  const de = document.documentElement; if (de.scrollWidth > 361) out.push(`page scrolls horizontally ${de.scrollWidth}`);
  return [...new Set(out)];
};

// a review that RUNS (auto review on): the chip "Moves 5/11", "Luck 3/9", the reasons "being worked out", the step pages and their chips
async function reviewRun(page, G, step) {
  const exs = EXPORTS.filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
  // the same games again without their stored review: the app works them out now (chips "Moves 5/11", "Luck 3/9", "Bots 2/3", the reasons "being worked out")
  const fresh = exs.slice(0, 2).map((ex, i) => { const { meta, format, v, state, rv } = ex; return { meta: { ...meta, id: meta.id + "-fresh" + i, rd: 0, acc: null, rn: null, cls: null, mist: null }, rec: { state, rv: { base: rv.base, recs: rv.recs } } }; });
  for (const f of fresh) await G(async (f) => { await window.__colonistGame.hist.put(f.meta, f.rec, { quiet: true }); }, f);
  const ids = fresh.map((f) => f.meta.id).concat(exs.map((ex) => ex.meta.id));
  await G(() => { try { localStorage.removeItem("colonist_review_auto"); } catch (_) {} });
  for (let k = 0; k < Math.min(3, ids.length); k++) {
    await step("review-run-" + k, async () => {
      await G(() => { const g = window.__colonistGame; g.goHome(); }); await sleep(400);
      await G(() => window.__colonistGame.histOpen()); await sleep(1200);
      await G((id) => document.querySelector(`[data-hrow="${id}"]`)?.click(), ids[k]); await sleep(900);
      await G(() => document.querySelector("[data-sact=review]")?.click()); await sleep(2500);
      const tabs = await G(() => [...document.querySelectorAll(".rv-tabs [data-rvt]")].map((b) => b.dataset.rvt));
      for (const t of [...tabs, "overview"]) { await G((t) => document.querySelector(`.rv-tabs [data-rvt=${t}]`)?.click(), t); await sleep(1500); await G(() => document.querySelector("[data-rvchip]")?.click()); await sleep(600); }
      await G(() => document.querySelector("[data-rvfirst], [data-rvj]")?.click()); await sleep(2500);
      for (let i = 0; i < 6; i++) { await G(() => (document.querySelector("[data-rvnav='1']") || document.querySelector("[data-rvnext]"))?.click()); await sleep(900); }
      if (k === 0) { await G(() => document.querySelector(".rv-tabs [data-rvt=overview]")?.click()); await sleep(25000); }
    }, { cut: true });
    await G(() => { const g = window.__colonistGame; try { g._rvCloseReview?.(true); } catch (_) {} try { g.histClose(); } catch (_) {} });
  }
  await G(() => { try { localStorage.setItem("colonist_review_auto", "off"); } catch (_) {} });
}
async function drive(page, errors) {
  const G = (f, a) => page.evaluate(f, a);
  const step = async (name, fn, { cut = true } = {}) => { await G((n) => { window.__step = n; }, name); try { await fn(); } catch (e) { console.log("  step failed:", name, String(e).slice(0, 140)); } await sleep(450); if (cut) { const c = await G(CUT); c.forEach((x) => cuts.set(x, name)); } if (SH) await page.screenshot({ path: `${SH}/${LANG}-${name}.png` }).catch(() => {}); };
  const cuts = new Map();
  const { humanStepFn } = require("./tlib-human.js");
  // 1 the static screens (Home, Menu, New game, Settings, Past games, review tabs, Lessons, Bots ...) from the v1.87 walker
  await G((n) => { window.__step = n; }, "walker");
  if (process.env.REVIEWONLY) { for (const f of EXPORTS) { if (!fs.existsSync(f)) continue; const ex = JSON.parse(fs.readFileSync(f, "utf8")); await G(async (ex) => { const g = window.__colonistGame; const { meta, format, v, ...rec } = ex; await g.hist.put({ ...meta, id: meta.id }, rec, { quiet: true }); }, ex); } await reviewRun(page, G, step); return { cuts }; }
  if (!process.env.SKIPWALK) { const res = await walk(page, { log: () => {} }); for (const s of res.out) for (const i of s.issues) if (!/walk step failed/.test(i)) cuts.set(i, "walk:" + s.name); await reviewRun(page, G, step); }
  await G(() => { window.__step = "after-walk"; });
  // 2 a fresh Classic game, played by hand through its states
  const fresh = async (settings) => { await G((st) => { const g = window.__colonistGame; try { g.removeGameOverOverlay?.(); } catch (_) {} g.goHome(); g.startNewGame(st); }, settings); await sleep(1500); await G(() => window.__colonistGame.home?.close?.()); await sleep(400); };
  await fresh({ mode: "classic", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate" });
  await page.evaluate(humanStepFn);
  await step("setup-start", async () => {});
  await step("setup-spot-picked", async () => { await G(() => { const g = window.__colonistGame; if (g.setupAction === "settlement") { const id = g.getBestInitialSettlementNode(g.players[0]); g._tapNode?.(id); g.confirmBuild = { type: "settlement", id }; g.render(); } }); });
  const until = async (cond, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await G((c) => { const g = window.__colonistGame; const me = g.players[0]; return eval(c); }, cond); if (r) return true; await G(() => { const g = window.__colonistGame; if (g.currentPlayer?.isHuman && (g.setupPhase || g.pendingAction)) window.__humanStep({ sloppy: 0 }); }); await sleep(120); } return false; };
  await G(() => { const g = window.__colonistGame; g.confirmBuild = null; g.render(); });
  await until("!g.setupPhase && g.phase === 'pre_roll' && g.currentPlayer.isHuman");
  await step("preroll", async () => {});
  await step("rolled", async () => { await G(() => { const g = window.__colonistGame; g.rollDice = () => ({ total: 8, d1: 4, d2: 4 }); g.handleHumanRoll(); }); await sleep(1600); });
  const setRes = (r) => G((r) => { const g = window.__colonistGame; const me = g.players[0]; const K = ["wood", "brick", "sheep", "wheat", "ore"]; K.forEach((k) => { g.bank[k] += me.resources[k]; me.resources[k] = 0; }); Object.assign(me.resources, r); K.forEach((k) => { g.bank[k] -= me.resources[k]; }); g.render(); }, r);
  const clickAll = async (sel) => { const n = await G((s) => document.querySelectorAll(s).length, sel); for (let i = 0; i < n; i++) { await G(([s, i]) => { const e = document.querySelectorAll(s)[i]; e && e.click(); }, [sel, i]); await sleep(250); } };
  // build tray, too poor: "need 1 Wool" on every card
  await setRes({ wood: 0, brick: 1, sheep: 0, wheat: 1, ore: 0 });
  await step("tray-poor", async () => { await page.locator("#mBuildBtn").tap(); await sleep(700); });
  await step("tray-poor-taps", async () => { await clickAll("#buildCard [data-bc]"); await sleep(300); });
  await step("build-sheet-poor", async () => { await G(() => window.__colonistGame.toggleBuildSheet(true)); await sleep(500); await clickAll("#buildRoadBtn, #buildSettlementBtn, #buildCityBtn, #buyDevBtn"); });
  await G(() => { const g = window.__colonistGame; g.toggleBuildSheet(false); g.closeTray?.(); try { g._hideTip?.(); } catch (_) {} });
  await step("dock-poor", async () => { await clickAll("#mBuyBtn"); });
  await G(() => { try { window.__colonistGame._hideTip?.(); } catch (_) {} });
  // enough: a road, Undo
  await setRes({ wood: 3, brick: 3, sheep: 2, wheat: 3, ore: 3 });
  await step("tray-rich", async () => { await page.locator("#mBuildBtn").tap(); await sleep(700); });
  await step("road-spot", async () => { await G(() => { const g = window.__colonistGame; document.querySelector("#buildCard [data-bc=road]")?.click(); }); await sleep(700); });
  await step("road-chosen", async () => { await G(() => { const g = window.__colonistGame; const S = g.api.spots(0, {}); const id = [...(S.road || [])][0]; if (id != null) { g.confirmBuild = { type: "road", id }; g.render(); } }); await sleep(600); });
  await step("road-built-undo", async () => { await G(() => { const g = window.__colonistGame; const cb = g.confirmBuild; if (cb) g._doBuild?.(cb) ?? g.confirmPlace?.(); const b = document.querySelector("[data-place]"); if (b) b.click(); }); await sleep(900); });
  await G(() => { const g = window.__colonistGame; g._dropUndo?.(); g.confirmBuild = null; g.pendingAction = null; g.cancelPlacement?.(); g.render(); });
  // bank trade, then a swap with a bot (summary lines, "you 0 → 1", "Lumber 4 → 0")
  await setRes({ wood: 4, brick: 1, sheep: 1, wheat: 2, ore: 1 });
  await step("trade-open", async () => { await G(() => window.__colonistGame.openTradeModal()); await sleep(600); });
  await step("trade-bank-picked", async () => { await G(() => { const g = window.__colonistGame; g.tradeOffer.wood = 4; g.tradeRequest.ore = 1; g._refreshTradeGrids?.(); g.renderTradeModal?.(); g.render(); }); await sleep(600); });
  await step("trade-players-tab", async () => { try { await page.locator("#tradeModal [data-tab], #tradeModal [role=tab]").nth(1).tap({ timeout: 2000 }); } catch (_) {} await sleep(500); });
  await step("trade-offer-sent", async () => { await G(() => { const g = window.__colonistGame; g.tradeOffer = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; g.tradeRequest = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; g.tradeOffer.wood = 1; g.tradeRequest.wheat = 1; g._refreshTradeGrids?.(); g.handleHumanPlayerTrade?.(); }); await sleep(1500); });
  await step("trade-no-takers", async () => { await G(() => { const g = window.__colonistGame; g.tradeOffer = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 }; g.tradeRequest = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 }; g.tradeRequest.brick = 5; g.tradeOffer.ore = 1; g._refreshTradeGrids?.(); g.handleHumanPlayerTrade?.(); }); await sleep(1500); });
  await step("trade-executed", async () => { await G(() => { const g = window.__colonistGame; const me = g.players[0]; const p = g.players[1]; p.resources.wheat = Math.max(p.resources.wheat, 2); me.resources.wood = Math.max(me.resources.wood, 1); g._playerTradeSwapNow(me, p, { wood: 1 }, { wheat: 1 }); }); await sleep(900); });
  await step("journal-trade", async () => { await G(() => window.__colonistGame.toggleLog(true)); await sleep(600); });
  await G(() => { const g = window.__colonistGame; g.toggleLog(false); g.closeTradeModal(); });
  // development cards
  await setRes({ wood: 1, brick: 1, sheep: 2, wheat: 3, ore: 3 });
  await G(() => { const g = window.__colonistGame; const me = g.players[0]; me.devCards = { knight: 1, monopoly: 1, yearOfPlenty: 1, roadBuilding: 1 }; me.newDevCards = { knight: 0, monopoly: 0, yearOfPlenty: 0, roadBuilding: 0 }; g.render(); });
  await step("cards-picker", async () => { await G(() => document.getElementById("playDevBtn")?.click()); await sleep(600); });
  for (const t of ["monopoly", "yearOfPlenty", "roadBuilding"]) {
    await step("dev-" + t, async () => { await G((t) => { const g = window.__colonistGame; g.hideDevCardPicker?.(); g.handleHumanPlayDevCard(t); }, t); await sleep(800); });
    await G(() => { const g = window.__colonistGame; try { g._cancelDevPlay?.(); } catch (_) {} g.devPick = null; g.pendingAction = null; g.freeRoadsRemaining = 0; g.confirmBuild = null; g.render(); });
  }
  await step("dev-buy", async () => { await G(() => { const g = window.__colonistGame; g.handleHumanBuyDevCard(); }); await sleep(900); });
  await step("dev-knight-played", async () => { await G(() => { const g = window.__colonistGame; g.handleHumanPlayDevCard("knight"); }); await sleep(900); });
  await G(() => { const g = window.__colonistGame; g.confirmBuild = null; g.pendingAction = null; g.robberVictimOptions = []; g.render(); });
  await step("livestats", async () => { await G(() => window.__colonistGame.liveStatsOpen()); await sleep(900); });
  await G(() => window.__colonistGame.liveStatsClose?.());
  await step("live-bar", async () => { await G(() => { const b = document.querySelector("[data-livebar], .live-bar, #liveBar, .lb"); b?.click?.(); }); await sleep(800); });
  await G(() => { const g = window.__colonistGame; document.querySelectorAll(".lb-pop, .live-pop").forEach((e) => e.remove()); });
  // a 7: the discard dock (Leg af 4 van 9), the robber dock (Rob now, "blocks Ore on 4"), the steal dock
  await G(() => { const g = window.__colonistGame; g.handleHumanEndTurn(); });
  await until("g.currentPlayer.isHuman && g.phase === 'pre_roll'", 90000);
  await setRes({ wood: 3, brick: 3, sheep: 2, wheat: 3, ore: 3 });
  await step("seven-discard", async () => { await G(() => { const g = window.__colonistGame; g.rollDice = () => ({ total: 7, d1: 3, d2: 4 }); g.handleHumanRoll(); }); await sleep(1600); });
  await step("seven-discard-picked", async () => { await G(() => { const g = window.__colonistGame; const pd = g.pendingDiscard; if (pd) { pd.selected.wood = 2; g.render(); } }); await sleep(500); });
  await step("seven-discard-full", async () => { await G(() => { const g = window.__colonistGame; const pd = g.pendingDiscard; if (pd) { ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => (pd.selected[r] = 0)); pd.selected.wood = 3; pd.selected.brick = 1; g.render(); } }); await sleep(500); });
  await step("seven-hand-back", async () => { await G(() => { try { window.__colonistGame._confirmDiscard(); } catch (_) {} }); await sleep(1100); });
  await step("robber-tile", async () => { await G(() => { const g = window.__colonistGame; if (g.pendingAction === "robber") { const id = g.chooseRobberHex(g.players[0]); g.confirmBuild = { type: "robber", id }; g.render(); } }); await sleep(700); });
  await step("robber-tile-victims", async () => { await G(() => { const g = window.__colonistGame; if (g.pendingAction === "robber") { for (const h of g._legalRobberHexes(g.players[0])) { const i = g._robberTileInfo?.(h.id, g.players[0]); if (i && i.victims && i.victims.length > 1) { g.confirmBuild = { type: "robber", id: h.id }; g.render(); break; } } } }); await sleep(700); });
  await step("robber-rob-now", async () => { await G(() => { const b = document.querySelector("[data-rob-now]"); b?.click(); }); await sleep(900); });
  for (let i = 0; i < 10; i++) { const busy = await G(() => { const g = window.__colonistGame; if (g.robberVictimOptions?.length || g.pendingAction === "robber" || g.pendingDiscard) { window.__humanStep({ sloppy: 0 }); return true; } return false; }); if (!busy) break; await sleep(500); }
  await step("journal-seven", async () => { await G(() => window.__colonistGame.toggleLog(true)); await sleep(600); });
  await G(() => window.__colonistGame.toggleLog(false));
  await step("legend", async () => { try { await page.locator("[data-seat]").nth(1).tap({ timeout: 2000 }); } catch (_) {} await sleep(500); });
  await G(() => { document.querySelectorAll(".chip-legend, .legend, .pc-pop").forEach((e) => e.remove()); });
  // the end screen and its tabs
  await step("game-over", async () => { await G(() => { const g = window.__colonistGame; const me = g.players[0]; g.currentPlayerIndex = 0; g.phase = "main"; g.winner = null; g.winner = g.players[1]; g.phase = "game_over"; g.showGameOverOverlay(); }); await sleep(3500); });
  const so = await G(() => [...document.querySelectorAll(".gs-tabs [data-tab]")].map((b) => b.dataset.tab));
  for (const t of so) await step("end-" + t, async () => { await G((t) => { document.querySelector(".gs-scroll")?.scrollTo(0, 0); document.querySelector(`.gs-tabs [data-tab=${t}]`)?.scrollIntoView({ block: "center" }); }, t); await sleep(300); await page.locator(`.gs-tabs [data-tab=${t}]`).tap({ timeout: 4000 }); await sleep(800); });
  await step("end-bottom", async () => { await G(() => { const e = document.querySelector(".gs-scroll"); if (e) e.scrollTop = 99999; }); });
  await step("game-over-human", async () => { await G(() => { const g = window.__colonistGame; g.removeGameOverOverlay?.(); g.winner = g.players[0]; g.phase = "game_over"; g.showGameOverOverlay(); }); await sleep(3500); });
  await step("game-over-human-bottom", async () => { await G(() => { const e = document.querySelector(".gs-scroll"); if (e) e.scrollTop = 99999; }); });
  // Rush
  await fresh({ mode: "rush", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate", rushInterval: 8 });
  await step("rush-setup", async () => { await sleep(500); });
  for (let i = 0; i < 40; i++) { await G(() => { window.__humanStep?.({ sloppy: 0 }); }); await sleep(250); if (await G(() => !window.__colonistGame.setupPhase)) break; }
  await step("rush-main", async () => { await sleep(2500); });
  await G(() => { const g = window.__colonistGame; g.__rushSeven?.(); });
  await step("rush-main2", async () => { await sleep(3000); });
  await step("rush-journal", async () => { await G(() => window.__colonistGame.toggleLog(true)); await sleep(600); });
  await G(() => window.__colonistGame.toggleLog(false));
  // Seafarers
  await fresh({ mode: "classic", board: "seafarers", map: "beginner", numBots: 3, botStyleMode: "all", allPreset: "intermediate" });
  await step("sea-setup", async () => { await sleep(500); });
  await until("!g.setupPhase", 60000);
  await step("sea-main", async () => { await sleep(800); });
  await step("sea-tray", async () => { await G(() => window.__colonistGame.toggleBuildSheet(true)); await sleep(600); });
  await G(() => window.__colonistGame.toggleBuildSheet(false));
  // Pass & play
  await fresh({ mode: "classic", board: "classic", map: "balanced", numBots: 2, botStyleMode: "all", allPreset: "intermediate", humans: [true, false] });
  await step("hotseat-cover", async () => { await sleep(800); });
  await step("hotseat-ack", async () => { await G(() => { window.__colonistGame._hsAck?.(); }); await sleep(600); });
  // play on: whole games played by the "sloppy human" with the clocks compressed, so every toast, bot offer, steal and log line of a real game reaches the recorder
  await G(() => { if (window.__sped) return; window.__sped = 1; const st = window.setTimeout, si = window.setInterval; window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) >= 4000 ? ms : (ms || 0) / 6, ...r); window.setInterval = (f, ms, ...r) => si(f, Math.max(1, (ms || 0) / 6), ...r); });
  const playOn = async (name, settings, secs) => {
    await fresh(settings); await G((n) => { window.__step = n; }, name);
    const t0 = Date.now(); let i = 0;
    while (Date.now() - t0 < secs * 1000) { const r = await G(() => { const g = window.__colonistGame; if (g.winner) return "over"; try { window.__humanStep({ sloppy: 0 }); } catch (_) {} return ""; }); if (r === "over") break; await sleep(90); if (++i % 40 === 0) { await G(() => document.querySelector(".toast, .lsn-toast")?.click?.()); (await G(CUT)).forEach((x) => cuts.set(x, name)); } }
    await G(() => window.__colonistGame.toggleLog(true)); await sleep(500); await G(() => window.__colonistGame.toggleLog(false));
  };
  await playOn("play-classic", { mode: "classic", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }, 70);
  await playOn("play-seafarers", { mode: "classic", board: "seafarers", map: "beginner", numBots: 3, botStyleMode: "all", allPreset: "intermediate" }, 50);
  await playOn("play-rush", { mode: "rush", board: "classic", map: "balanced", numBots: 3, botStyleMode: "all", allPreset: "intermediate", rushInterval: 5 }, 50);
  // Settings in the middle of a game: the Bots tab ("Bots: Easy") and the game tab
  for (const tab of ["game", "bots", "look", "about"]) await step("settings-" + tab, async () => { await G((t) => window.__colonistGame.settingsUI.open(t), tab); await sleep(500); });
  await G(() => window.__colonistGame.settingsUI.close?.());
  return { cuts };
}

async function run() {
  const { looksEnglish } = await import(pathToFileURL(path.join(__dirname, "i18n-words.mjs")).href);
  const { NL, NLP } = await import(pathToFileURL(path.join(__dirname, "..", "src", "i18n-nl.js")).href);
  // the Dutch-only words (mirror check): words of Dutch values that appear in no English key
  const wordsOf = (s) => (s.toLowerCase().match(/[a-zà-ÿ’']{3,}/g) || []);
  const enWords = new Set(); [...Object.keys(NL), ...NLP.map((x) => x[0])].forEach((k) => wordsOf(k.replace(/\{\w+\}/g, " ")).forEach((w) => enWords.add(w)));
  "the and for with from your you are was were has have not than this that when then they them their there what which will would could should about into over under after before between while only just also more most less other another each every some any all one two three four five six seven eight nine ten first last next previous new old open close tap pick take give get build trade roll turn game games card cards win lose won lost points point road city dice luck moves move best good better great worst bad worse bank hand back".split(" ").forEach((w) => enWords.add(w));
  const nlOnly = new Set(); [...Object.values(NL), ...NLP.map((x) => x[1])].forEach((v) => wordsOf(v.replace(/\{\w+\}/g, " ")).forEach((w) => { if (!enWords.has(w) && !NAMES_LOWER.includes(w)) nlOnly.add(w); }));
  const nlUsed = new Set(); [...Object.values(NL), ...NLP.map((x) => x[1])].forEach((v) => wordsOf(v.replace(/\{\w+\}/g, " ")).forEach((w) => nlUsed.add(w)));
  const extra = new Set(EXTRA_EN.filter((w) => !nlUsed.has(w))); // a word some Dutch text uses ("of", "over", "open", "bots") is only caught by its shapes
  const looksEn = (t) => { const s = t.replace(NAMES, " "); const w = new Set(looksEnglish(s)); wordsOf(s).forEach((x) => { if (extra.has(x)) w.add(x); }); EN_SHAPES.forEach(([re, why]) => { if (re.test(s)) w.add(why || re.source); }); return [...w]; };
  const nlOnlyHas = (x) => nlOnly.has(x);
  const looksNl = (t) => wordsOf(t.replace(NAMES, " ")).filter((w) => nlOnly.has(w));

  let seen, misses, cuts = new Map(), errors = [];
  if (process.env.ANALYZE) { const j = JSON.parse(fs.readFileSync(process.env.ANALYZE, "utf8")); seen = j.seen; misses = j.misses; j.trunc.forEach(([x, s]) => cuts.set(x, s)); j.lay.forEach(([x, s]) => cuts.set(x, s)); }
  else {
    const o = await open(port, LANG, { locale: "en-US" }); const page = o.page; errors = o.errors;
    await page.addInitScript(RECORDER); await page.evaluate(RECORDER);
    try { ({ cuts } = await drive(page, errors)); } catch (e) { console.log("drive failed", e); }
    seen = await page.evaluate(() => [...window.__nlrec.entries()]);
    misses = await page.evaluate(async () => { const i = await import("/src/i18n.js"); return [...i.misses]; });
    await o.b.close();
  }
  const texts = seen.map(([k, s]) => [k, s]).filter(([k]) => !AI_SKIP.test(k.replace(/^@\w+ /, "")));
  const bare = (k) => k.replace(/^@[\w-]+ /, "");
  let flagged = [];
  if (LANG === "nl") flagged = texts.map(([k, s]) => [bare(k), s, looksEn(bare(k))]).filter(([, , w]) => w.length);
  else flagged = texts.map(([k, s]) => [bare(k), s, looksNl(bare(k))]).filter(([, , w]) => w.length);
  const trunc = [...cuts.entries()].filter(([x]) => /^(cut|clamped)/.test(x));
  const lay = [...cuts.entries()].filter(([x]) => !/^(cut|clamped)/.test(x));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT.replace(/(\.json)?$/, LANGS.length > 1 ? "-" + LANG + "$1" : "$1"), JSON.stringify({ lang: LANG, seen: texts, flagged, trunc, lay, misses }, null, 1));
  console.log(`recorded ${texts.length} texts (${LANG}), ${flagged.length} flagged, ${trunc.length} truncated`);
  flagged.forEach(([t, s, w]) => console.log(`  [${s}] ${t.slice(0, 110)}   <${w.slice(0, 4).join(",")}>`));
  trunc.forEach(([t, s]) => console.log(`  TRUNC [${s}] ${t}`));
  lay.forEach(([t, s]) => console.log(`  LAYOUT [${s}] ${t}`));
  ok(flagged.length === 0, LANG === "nl" ? "NL: no English word in any text, aria-label, toast or log line the app showed" : "EN: no Dutch word reached the English app", flagged.length);
  if (LANG === "nl") ok(trunc.length === 0 && lay.length === 0, "NL: no truncated header and no horizontal overflow at 360px", trunc.length + lay.length);
  ok(errors.length === 0, "no page errors", errors.slice(0, 2));
}
(async () => { for (const l of LANGS) { LANG = l; console.log(`── ${l.toUpperCase()} ──`); await run(); } console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0); })().catch((e) => { console.error(e); process.exit(2); });
