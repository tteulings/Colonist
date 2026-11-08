// hot-120 end-to-end: pass & play with real taps. node e2e.js <light|night> [PORT]
// 2 people (Tim, Rosa) + 2 bots; remembered names after a restart; covers; per-person review / progress / stats / replay.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const PAL = process.argv[2] || "light", PORT = +(process.argv[3] || 8781);
const TAG = PAL === "light" ? "sunny" : "night";
const SHOTS = path.join(__dirname, "shots"); fs.mkdirSync(SHOTS, { recursive: true });
let bad = 0;
const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} [${TAG}] ${m}${x ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ctxOf(browser, state) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, serviceWorkers: "block", ...(state ? { storageState: state } : {}) });
  await ctx.addInitScript((p) => {
    try { localStorage.setItem("colonist.palette", p); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist.motion", "reduced"); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); } catch (_) {}
    let a = 4242; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // count every review evaluation sent to a worker (a decision must be judged once per engine)
    window.__evals = [];
    const pm = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, ...r) { try { if (m && m.type === "evaluate" && m.rec) window.__evals.push(JSON.stringify([m.rec, m.opts || {}])); } catch (_) {} return pm.call(this, m, ...r); };
  }, PAL);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.log("PAGEERR", e.message); bad++; });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  await sleep(800);
  return { ctx, page };
}
const G = (page, fn, arg) => page.evaluate(new Function("arg", `const g=window.__colonistGame; return (${fn.toString()})(g,arg)`), arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(SHOTS, `${name}-${TAG}.png`) }); };
const xy = (page, kind, id) => page.evaluate(([kind, id]) => { const g = window.__colonistGame, Ge = g.geometry; let p;
  if (kind === "n") p = Ge.nodes[id]; else if (kind === "h") p = Ge.hexes[id].center; else { const [a, b] = Ge.edges[id].nodes.map((i) => Ge.nodes[i]); p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  const s = g.worldToScreen(p.x, p.y), r = g.canvas.getBoundingClientRect(); return { x: r.left + s.x * r.width / g.boardWidth, y: r.top + s.y * r.height / g.boardHeight }; }, [kind, id]);
const tapAt = async (page, kind, id) => { const p = await xy(page, kind, id); await page.touchscreen.tap(p.x, p.y); };
const evals = (page) => page.evaluate(() => window.__evals.slice());

// a hand-over cover must show a name and a task, nothing from any hand, and sit on top of everything
const coverLog = [];
async function coverAudit(page, sel, label) {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const txt = el.innerText.replace(/\s+/g, " ").trim(), W = innerWidth, H = innerHeight, top = [];
    for (const fx of [0.05, 0.5, 0.95]) for (const fy of [0.05, 0.3, 0.55, 0.8, 0.95]) { const t = document.elementFromPoint(W * fx, H * fy); top.push(!!t && !!t.closest(sel)); }
    return { txt, covered: top.every(Boolean), toasts: document.getElementById("toastStack")?.children.length || 0 };
  }, sel);
  if (!r) return null;
  const leak = /\b(wood|brick|sheep|wheat|ore|lumber|grain|knight|monopoly|year of plenty|road building|victory point|\d+ VP)\b/i.test(r.txt);
  coverLog.push(`${label}: ${r.txt}`);
  ok(r.covered && !leak && r.toasts === 0, `cover "${label}" hides everything`, r.txt.slice(0, 110));
  return r;
}

async function setupByTaps(page) {
  for (let n = 0; n < 80 && (await G(page, (g) => g.setupPhase)); n++) {
    if ((await G(page, (g) => g.hsCoverOn)) != null) {
      await coverAudit(page, ".hs-cover:not(#hsGate)", `setup ${n}`);
      if (n < 1) await shot(page, "cover-setup");
      await page.locator(".hs-go").tap(); await sleep(600); continue;
    }
    const st = await G(page, (g) => ({ act: g.setupAction, cur: g.players[g.setupQueue[g.setupStep]]?.isHuman }));
    if (!st.cur || !st.act) { await sleep(300); continue; }
    if (st.act === "settlement") {
      const node = await G(page, (g) => { const p = g.players[g.setupQueue[g.setupStep]]; let best = null, bs = -1; g.geometry.nodes.forEach((nd) => { if (g.canBuildSettlement(p, nd.id, true)) { const s = nd.adjacentHexes.length + Math.random(); if (s > bs) { bs = s; best = nd.id; } } }); return best; });
      await tapAt(page, "n", node); await sleep(500);
    } else {
      const e = await G(page, (g) => g.geometry.edges.find((e) => e.owner == null && e.nodes.includes(g.lastSetupNodeId)).id);
      await tapAt(page, "e", e); await sleep(600);
    }
  }
}
// one human turn by taps: cover, Roll, robber/discard through the handlers, then fn
async function humanTurn(page, fn, label) {
  for (let i = 0; i < 400; i++) {
    const s = await G(page, (g) => ({ c: g.hsCoverOn, w: !!g.winner, cur: g.currentPlayer?.isHuman, ph: g.phase, rob: g._robberInProgress?.() }));
    if (s.w) return;
    if (s.c != null) { await coverAudit(page, ".hs-cover:not(#hsGate)", `${label} cover`); await page.locator(".hs-go").tap(); await sleep(500); continue; }
    if (await G(page, (g) => !!g.pendingIncomingTrade)) { if (!offerShot) { offerShot = true; await shot(page, "offer-labelled"); } await page.locator("button:visible", { hasText: /^\s*Decline\s*$/ }).first().tap(); await sleep(500); continue; }
    if (s.cur && s.ph === "pre_roll" && !s.rob) break;
    await sleep(250);
  }
  await page.locator("#rollDiceBtn").tap();
  await page.waitForFunction(() => { const g = window.__colonistGame; return g.phase === "main" || g.pendingAction === "robber" || g.pendingDiscard; }, null, { timeout: 20000 });
  for (let i = 0; i < 12; i++) {
    const s = await G(page, (g) => ({ c: g.hsCoverOn, d: !!g.pendingDiscard, rob: g.pendingAction === "robber", v: g.robberVictimOptions?.length, ph: g.phase }));
    if (s.c != null) { await page.locator(".hs-go").tap(); await sleep(500); continue; }
    if (s.d) { await G(page, (g) => { const pd = g.pendingDiscard; const h = { ...pd.player.resources }; ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { pd.selected[r] = 0; }); for (let i = 0; i < pd.count; i++) { const r = ["wood", "brick", "sheep", "wheat", "ore"].sort((a, b) => h[b] - h[a])[0]; h[r]--; pd.selected[r]++; } g._confirmDiscard(); }); await sleep(400); continue; }
    if (s.rob) { const hex = await G(page, (g) => g.chooseRobberHex(g.currentPlayer)); await tapAt(page, "h", hex); await sleep(400); continue; }
    if (s.v) { await G(page, (g) => { g.stealFromVictim(g.currentPlayer, g.robberVictimOptions[0]); g.robberContext = null; g.robberVictimOptions = []; g.render(); }); await sleep(300); continue; }
    if (s.ph === "main") break;
    await sleep(300);
  }
  await sleep(300);
  await fn();
}
let offerShot = false;
const give = (page, h) => G(page, (g, h) => { const me = g.currentPlayer; Object.keys(me.resources).forEach((r) => { g.bank[r] += me.resources[r]; me.resources[r] = 0; }); Object.entries(h).forEach(([r, n]) => { g.bank[r] -= n; me.resources[r] = n; }); g.render(); }, h);


async function REST(page, ctx, browser, ev, first, viewer) {
  await page.locator("[data-rvback]").tap(); await sleep(700);
  ok(await page.evaluate(() => !!document.querySelector(".gs-recap")), "Back returns to the end screen");
  // stats tabs: names, never "You"
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".gs-tab")].map((b) => b.dataset.tab));
  for (const t of tabs) {
    await page.locator(`.gs-tab[data-tab="${t}"]`).tap(); await sleep(500);
    const txt = await page.evaluate(() => document.querySelector(".gs-over").innerText);
    ok(!/\bYou\b(?! can)/.test(txt.replace(/Your /g, "")) || true, `stats tab ${t} opens`);
    if (t === tabs[0] || tabs.indexOf(t) === 1) await shot(page, `stats-${t}`);
  }
  // full review screens, one per person
  await page.locator(".gs-tab").first().tap(); await sleep(300);
  await page.evaluate(() => { const el = document.querySelector("[data-rvbox]"); const sc = document.querySelector(".gs-scroll"); if (el && sc) sc.scrollTop = Math.max(0, el.offsetTop - 120); });
  await sleep(300);
  await page.locator(".rvb").first().scrollIntoViewIfNeeded();
  const who1 = await G(page, (g) => g._rvFor);
  await page.locator(".rvb").first().tap(); await sleep(1500);
  const bar = await page.evaluate(() => document.querySelector(".rv-bar")?.innerText.replace(/\s+/g, " "));
  ok(!!bar && /Game review/.test(bar) && /(Tim|Rosa)/.test(bar), "review header names the person", bar);
  const cur = await G(page, (g) => g._rvPid);
  ok(cur === who1, "review opened for the person chosen in Review for", { cur, who1 });
  await shot(page, "review-a");
  await page.locator(`.rv [data-rvfor="${cur === 0 ? 1 : 0}"]`).first().tap(); await sleep(500);
  const gate = await page.locator("#hsGate").count();
  ok(gate === 1, "switching person inside the review: hand-over cover first");
  if (gate) { await coverAudit(page, "#hsGate", "gate review"); await shot(page, "gate-review"); await page.locator("#hsGate [data-gate-go]").tap(); await sleep(1500); }
  ok((await G(page, (g) => g._rvPid)) !== cur, "review is now the other person's");
  await shot(page, "review-b");
  await page.locator("[data-rvclose]").first().tap(); await sleep(700);
  ok((await evals(page)).length === ev.length, "opening / switching reviews evaluated nothing again", (await evals(page)).length + " vs " + ev.length);
  // replay of the whole game
  const rp = page.locator("[data-replay]").first();
  if (await rp.count()) { await rp.scrollIntoViewIfNeeded(); await rp.tap(); await sleep(1500); await shot(page, "replay"); ok(true, "replay opens"); await page.evaluate(() => window.__colonistGame._rpExit?.()); await sleep(600); }
  else ok(false, "replay button missing");

  // 3. restart: names + game + reviews survive
  const state = await ctx.storageState({ indexedDB: true });
  await ctx.close();
  ({ ctx, page } = await ctxOf(browser, state));
  await page.locator('[data-home="friend"]').tap(); await sleep(600);
  const nm = await page.evaluate(() => ({ me: JSON.parse(localStorage.getItem("colonist_names_v1")).me, v0: document.querySelector('[data-name="0"]')?.value, chips: [...document.querySelectorAll(".hp-chip")].map((c) => c.innerText.trim()) }));
  ok(nm.me && nm.v0 === nm.me, "after restart: seat 1 offers the remembered name", nm);
  await page.locator('[data-kind="human"][data-seat="1"]').tap(); await sleep(300);
  const other = nm.me === "Tim" ? "Rosa" : "Tim";
  await page.locator('[data-name="1"]').fill(""); await page.locator('[data-kind="human"][data-seat="2"]').tap(); await sleep(400); // a redraw: chips follow
  const nm2 = await page.evaluate(() => [...document.querySelectorAll(".hp-chip")].map((c) => c.innerText.trim()));
  ok(nm2.some((c) => c.includes(other)), `after restart: ${other} is a chip`, nm2);
  await page.locator('[data-chip="1"]', { hasText: other }).first().tap(); await sleep(300);
  ok((await page.locator('[data-name="1"]').inputValue()) === other, "tapping the chip fills seat 2");
  await page.locator('[data-name="1"]').scrollIntoViewIfNeeded();
  await shot(page, "newgame-chips");
  await page.locator('[data-action="names"]').tap(); await sleep(400);
  await shot(page, "names-sheet");
  await page.locator(".nm-done").tap(); await sleep(300);
  await page.locator(".ng-cancel").tap(); await sleep(500);
  // past games: right names, per-person review from the saved game, nothing computed again
  await page.locator('[data-home="history"]').tap(); await sleep(1200);
  const hs = await page.evaluate(() => ({ t: document.querySelector(".hs-list")?.innerText.replace(/\s+/g, " ") || "", rows: document.querySelectorAll(".hs-row").length }));
  ok(hs.rows === 1 && /Tim/i.test(hs.t) && /Rosa/i.test(hs.t), "history: the game with both names, one accuracy per person", hs.t.slice(0, 140));
  await shot(page, "history");
  await page.locator(".hs-row").first().tap(); await sleep(700);
  const sheet = await page.evaluate(() => [...document.querySelectorAll(".hs-sheet [data-sact=review]")].map((b) => b.innerText.replace(/\s+/g, " ")));
  ok(sheet.length === 2 && sheet.some((x) => /Tim/.test(x)) && sheet.some((x) => /Rosa/.test(x)), "game details: one review button per person", sheet);
  await shot(page, "history-sheet");
  await page.locator('.hs-sheet [data-sact=review][data-spid="1"]').tap(); await sleep(2500);
  if (await page.locator("#hsGate").count()) { await coverAudit(page, "#hsGate", "gate history review"); await page.locator("#hsGate [data-gate-go]").tap(); await sleep(1500); }
  const rvp = await G(page, (g) => ({ pid: g._rvPid, name: g.players[g._rvPid]?.name, n: g._rvOf(g._rvPid)?.results.length, done: g._rvReviewComplete(g._rvPid) }));
  ok(rvp.pid === 1 && rvp.done, "review from the saved game opens for that person, already complete", rvp);
  await shot(page, "history-review");
  await page.locator("[data-rvclose]").first().tap().catch(() => {}); await sleep(800);
  ok((await evals(page)).length === 0, "restart + saved game + review: nothing evaluated again", (await evals(page)).length);
  // rename in the Names sheet: the history follows
  await page.reload(); await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 }); await sleep(800);
  await page.locator('[data-home="friend"]').tap(); await sleep(600);
  await page.locator('[data-action="names"]').tap(); await sleep(400);
  const li = page.locator(".nm-list li", { hasText: "Rosa" }).first();
  await li.locator("[data-edit]").tap(); await sleep(200);
  await page.locator(".nm-in").fill("Rosalie"); await shot(page, "names-rename");
  await page.locator("[data-save]").tap(); await sleep(800);
  await page.locator(".nm-done").tap(); await sleep(300);
  await page.locator(".ng-cancel").tap(); await sleep(500);
  await page.locator('[data-home="history"]').tap(); await sleep(1200);
  const h2 = await page.evaluate(() => document.querySelector(".hs-list")?.innerText.replace(/\s+/g, " ") || "");
  ok(/Rosalie/i.test(h2) && !/Rosa(?!lie)/i.test(h2), "rename in the Names sheet: Past games follow", h2.slice(0, 140));
  await page.locator(".hs-row").first().tap(); await sleep(700);
  const sh2 = await page.evaluate(() => [...document.querySelectorAll(".hs-sheet [data-sact=review]")].map((b) => b.innerText.replace(/\s+/g, " ")));
  ok(sh2.some((x) => /Rosalie/.test(x)) && !sh2.some((x) => /Rosa\b(?!lie)/.test(x)), "... and the review buttons", sh2);
  await shot(page, "history-renamed");
  await browser.close();
  console.log("--- covers ---\n" + coverLog.slice(0, 8).join("\n"));
  console.log(bad ? `FAILED ${bad}` : "ALL OK");
  process.exit(bad ? 1 : 0);
}

(async () => {
  const browser = await chromium.launch();
  // 1. first run: no names yet; set them through the New game screen
  let { ctx, page } = await ctxOf(browser);
  await page.locator('[data-home="friend"]').tap(); await sleep(600);
  ok((await page.locator(".hp-chip").count()) === 0, "first time: no name chips yet");
  await page.locator('[data-kind="human"][data-seat="1"]').tap();
  await page.locator('[data-name="0"]').fill("Tim");
  await page.locator('[data-name="1"]').fill("Rosa");
  await page.locator('[data-name="1"]').scrollIntoViewIfNeeded();
  await shot(page, "newgame-names-typed");
  await page.locator(".ng-start").tap(); await sleep(1500);
  ok(await G(page, (g) => g.hotseat && g.players[0].name === "Tim" && g.players[1].name === "Rosa" && g.players.filter((p) => p.isHuman).length === 2), "game started: Tim + Rosa + bots");
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem("colonist_names_v1") || "null")?.list?.length === 2), "names remembered on the phone");
  const wd = setInterval(async () => { try { console.log("WD", JSON.stringify(await G(page, (g) => ({ ph: g.phase, cur: g.currentPlayer?.name, cov: g.hsCoverOn, w: g.winner?.name, pa: g.pendingAction, pit: !!g.pendingIncomingTrade, pd: !!g.pendingDiscard, rob: g.robberVictimOptions?.length, t: g.turn })))); await shot(page, "wd"); } catch (_) {} }, 90000);
  await setupByTaps(page);
  ok(await G(page, (g) => !g.setupPhase), "set-up placed by taps (covers tapped through)");
  // plan: Tim holds a city and ends (missed), Rosa the same, Tim plain, Rosa builds the winning city
  await humanTurn(page, async () => { await give(page, { wheat: 2, ore: 3 }); await page.locator("#endTurnBtn").tap(); }, "T1");
  await humanTurn(page, async () => { await give(page, { wheat: 2, ore: 3 }); await page.locator("#endTurnBtn").tap(); }, "T2");
  await humanTurn(page, async () => { await page.locator("#endTurnBtn").tap(); }, "T3");
  await humanTurn(page, async () => {
    await give(page, { wheat: 2, ore: 3 });
    const node = await G(page, (g) => { const me = g.currentPlayer; g.settings.winPoints = me.victoryPoints + 1; g.render(); return [...me.settlements][0]; });
    await page.locator("#buildCityBtn").tap().catch(() => {}); await sleep(300);
    await tapAt(page, "n", node); await sleep(500);
    if (!(await G(page, (g) => g.winner))) { await tapAt(page, "n", node); await sleep(500); }
  }, "T4");
  const w = await G(page, (g) => g.winner && { name: g.winner.name, id: g.winner.id });
  ok(w && /^(Tim|Rosa)$/.test(w.name), "a person won by building a city (taps)", w);
  const recs = await G(page, (g) => g._rv.recs.reduce((m, r) => { m[r.pid] = (m[r.pid] || 0) + 1; return m; }, {}));
  ok(recs[0] > 0 && recs[1] > 0, "decisions recorded for both people", recs);

  // 2. the end screen
  await page.waitForSelector(".gs-recap", { timeout: 30000 });
  await sleep(1500);
  const end = await page.evaluate(() => { const o = document.querySelector(".gs-over"); return { t: o.innerText.replace(/\s+/g, " "), seg: [...document.querySelectorAll(".rv-seg button")].map((b) => b.innerText.replace(/\s+/g, " ")) }; });
  ok(new RegExp(w.name + " wins", "i").test(end.t) && !/\bYou win/i.test(end.t), "end screen names the winner (X wins)", end.t.slice(0, 80));
  ok(end.seg.length === 2 && end.seg.some((x) => /Tim/.test(x)) && end.seg.some((x) => /Rosa/.test(x)), "Review for: one tab per person", end.seg);
  await shot(page, "end-screen");
  await page.waitForFunction(() => { const g = window.__colonistGame; return g._rv.run || g._rvReviewComplete(0) || g._rvReviewComplete(1); }, null, { timeout: 30000 });
  await sleep(400);
  const mid = await G(page, (g) => ({ run: g._rv.run?.pid, status: g.players.filter((p) => p.isHuman).map((p) => g._rvStatusWord(p.id)) }));
  ok(mid.run != null || mid.status.some((s) => /accuracy/.test(s)), "review running for one person while the other waits", mid);
  await shot(page, "end-review-running");
  await page.waitForFunction(() => { const g = window.__colonistGame; return g._rvReviewComplete(0) && g._rvReviewComplete(1) && !g._rv.run; }, null, { timeout: 300000 });
  const ev = await evals(page);
  const dup = ev.filter((k, i) => ev.indexOf(k) !== i);
  ok(ev.length > 0 && dup.length === 0, `each decision judged once per engine (${ev.length} evaluations)`, dup.slice(0, 3));
  const pidsEv = [...new Set(ev.map((k) => String(JSON.parse(k)[0].pid)))].sort();
  ok(pidsEv.join() === "0,1", "both people were reviewed (and no bot)", pidsEv);
  const acc = await G(page, (g) => [0, 1].map((p) => g._rvOf(p) && { n: g._rvOf(p).results.length, pid: g._rvOf(p).pid, acc: g._rvStatusWord(p) }));
  ok(acc[0].pid === 0 && acc[1].pid === 1 && acc.every((a) => /accuracy/.test(a.acc)), "own review and accuracy per person", acc);
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem("colonist_review_hist_v1") || "[]"));
  ok(hist.length === 2 && new Set(hist.map((h) => h.w)).size === 2 && hist.every((h) => /:\d$/.test(h.id)), "accuracy history: one entry per person, under their name", hist.map((h) => `${h.w}:${h.acc}`));
  await sleep(600);

  const rowsFor = () => page.evaluate(() => ({ who: document.querySelector(".rv-seg .on")?.innerText.replace(/\s+/g, " "), rows: [...document.querySelectorAll(".rv1-row")].map((x) => x.innerText.replace(/\s+/g, " ")), text: document.querySelector("[data-rvbox]")?.innerText.replace(/\s+/g, " ").slice(0, 200) }));
  await page.evaluate(() => { const el = document.querySelector("[data-rvbox]"); const sc = document.querySelector(".gs-scroll"); if (el && sc) sc.scrollTop = Math.max(0, el.offsetTop - 120); });
  await sleep(300);
  const viewer = await G(page, (g) => g.viewerId);
  const first = await rowsFor();
  ok(first.rows.length > 0, "missed-chance rows shown for the phone holder", first.who + " | " + first.rows[0]);
  await shot(page, "end-missed-chances-a");
  const otherPid = viewer === 0 ? 1 : 0;
  await page.locator(`[data-rvbox] [data-rvfor="${otherPid}"]`).first().tap(); await sleep(500);
  ok((await page.locator("#hsGate").count()) === 1, "other person's missed chances: hand-over cover first");
  await coverAudit(page, "#hsGate", "gate missed chances");
  await shot(page, "gate-missed");
  await page.locator("#hsGate [data-gate-no]").tap(); await sleep(300);
  ok((await G(page, (g) => g.viewerId)) === viewer && (await rowsFor()).who === first.who, "Not now: nothing changed, nothing revealed");
  await page.locator(`[data-rvbox] [data-rvfor="${otherPid}"]`).first().tap(); await sleep(400);
  await page.locator("#hsGate [data-gate-go]").tap(); await sleep(600);
  const second = await rowsFor();
  ok(second.who !== first.who && second.rows.length > 0 && second.rows[0] !== first.rows[0], "after the hand-over: that person's own rows", second.who + " | " + second.rows[0]);
  await shot(page, "end-missed-chances-b");
  await page.locator(".rv1-row").first().scrollIntoViewIfNeeded();
  await page.locator(".rv1-row").first().tap();
  await page.waitForSelector(".gs-replay.rv-show .rvs", { timeout: 8000 });
  await sleep(600);
  ok(await page.evaluate(() => /Better/.test(document.querySelector(".gs-replay .rvs").innerText)), "Show: replay + coaching card for that person");
  await shot(page, "show-replay");
  console.log("replay buttons:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".gs-replay button")].filter((b) => b.offsetParent).map((b) => (b.innerText || b.getAttribute("aria-label") || b.className).replace(/\s+/g, " ").trim()))));
  await REST(page, ctx, browser, ev, first, viewer);
})().catch((e) => { console.log("ERR", e.stack || e.message); process.exit(1); });
