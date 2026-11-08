// Pass & play audit: real taps. usage: node audit.js light|night
const L = require("./lib.js");
const pal = process.argv[2] || "light";
const sfx = pal === "night" ? "night" : "sunny";
const done = new Set();
(async () => {
  const { browser, page } = await L.open(pal);
  const snap = async (name, force) => { if (done.has(name) && !force) return; done.add(name); await L.shot(page, `${name}-${sfx}`); };
  const wait = (ms) => page.waitForTimeout(ms);
  const G = (fn, a) => L.G(page, fn, a);
  const click = async (sel) => { await page.locator(sel).first().click(); await wait(250); };
  const clickWhen = async (sel) => { for (let i = 0; i < 40; i++) { if (await G((g, q) => { const e = document.querySelector(q); return !!e && !e.disabled && e.offsetParent !== null; }, sel)) break; await wait(250); } await page.locator(sel).first().click({ timeout: 5000 }); await wait(250); };
  const robAt = async (o) => { const hs = await G((g, a) => { const nodes = g.geometry.nodes; const set = new Set(); [...g.players[a.o].settlements].forEach((id) => nodes[id].adjacentHexes.forEach((h) => set.add(h))); return [...set].filter((h) => h !== g.robberHexId && g.geometry.hexes[h].resource !== "sea").map((h) => ({ x: g.geometry.hexes[h].center.x, y: g.geometry.hexes[h].center.y })); }, { o }); for (const h of hs) { await L.tapWorld(page, h.x, h.y); await wait(800); if (await L.vis(page, ".tbtn.primary")) return true; } return false; };
  const coverOn = () => G((g) => g.hsCoverOn);
  // wait until the game wants a human (cover, or the roll/end button) or setup needs us
  const settleUntil = async (cond, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await G(cond)) return true; await wait(200); } console.log("TIMEOUT", cond.toString().slice(0, 80)); return false; };
  const tapCover = async (name) => { await settleUntil((g) => g.hsCoverOn != null, 8000); await wait(300); await snap(name); await click(".hs-go"); await wait(700); };

  // 1 new game
  await snap("home");
  await page.getByText("More settings").click(); await wait(500);
  await click('[data-seg="numBots"] [data-value="2"]');
  await snap("newgame-top");
  await click('[data-kind="human"][data-seat="1"]');
  await page.locator('[data-name="1"]').fill("Rosa");
  await page.locator(".hs-seats").scrollIntoViewIfNeeded(); await wait(300);
  await snap("newgame-players");
  await click(".ng-start"); await wait(1500);

  // 2 setup
  let n = 0;
  while (await G((g) => g.setupPhase) && n++ < 40) {
    if (await coverOn() != null) { const a = await G((g) => g.setupAction); await tapCover(`cover-setup-${a}`); continue; }
    const st = await G((g) => ({ act: g.setupAction, cur: g.players[g.setupQueue[g.setupStep]]?.isHuman, id: g.setupQueue[g.setupStep] }));
    if (!st.cur || !st.act) { await wait(300); continue; }
    if (st.act === "settlement") {
      const node = await G((g) => { const p = g.players[g.setupQueue[g.setupStep]]; let best = null, bs = -1; g.geometry.nodes.forEach((nd) => { if (g.canBuildSettlement(p, nd.id, true)) { const s = nd.adjacentHexes.length + Math.random(); if (s > bs) { bs = s; best = { x: nd.x, y: nd.y }; } } }); return best; });
      await snap("setup-settlement-board");
      await L.tapWorld(page, node.x, node.y); await wait(600);
      await snap("setup-road-board");
    } else {
      const e = await G((g) => { const ed = g.geometry.edges.find((e) => e.owner == null && e.nodes.includes(g.lastSetupNodeId)); const a = g.geometry.nodes[ed.nodes[0]], b = g.geometry.nodes[ed.nodes[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; });
      await L.tapWorld(page, e.x, e.y); await wait(700);
    }
  }
  console.log("setup done", await G((g) => ({ cur: g.currentPlayer.name, phase: g.phase, cover: g.hsCoverOn })));
  const ready = async (phase = "pre_roll", nm = "cover-turn") => { for (let i = 0; i < 80; i++) { const st = await G((g) => ({ c: g.hsCoverOn, h: g.currentPlayer?.isHuman, ph: g.phase, sp: g.setupPhase })); if (st.c != null) { await tapCover(nm); continue; } if (!st.sp && st.h && st.ph === phase) { await wait(500); return; } await wait(400); } console.log("ready TIMEOUT"); };
  const who = () => G((g) => g.currentPlayer.id);
  await ready();
  await snap("turn-preroll");
  const A = await who();
  const B = A === 0 ? 1 : 0;
  // give A cards (cheat state only), rig dice to 6
  await G((g, a) => { g.rollDice = () => ({ total: 6, d1: 3, d2: 3 }); }, 0);
  await clickWhen("#rollDiceBtn"); await wait(2500);
  await snap("turn-after-roll");
  // trade: A gives, asks B
  await G((g, a) => { const p = g.players[a.A]; p.resources = { wood: 3, brick: 2, sheep: 1, wheat: 1, ore: 2 }; g.players[a.B].resources = { wood: 0, brick: 0, sheep: 2, wheat: 1, ore: 1 }; g.render(); }, { A, B });
  await click("#tradeBankBtn"); await wait(600);
  await snap("trade-sheet-empty");
  await click('[data-give="wood"]'); await click('[data-get="sheep"]');
  await snap("trade-sheet-picked");
  await click(`[data-ask="${B}"]`); await wait(800);
  await tapCover("cover-trade-offer");
  await snap("trade-incoming");
  await click(".rush-offer-accept"); await wait(900);
  await tapCover("cover-trade-answer");
  await snap("turn-after-trade");
  // trade declined path
  await click("#tradeBankBtn"); await wait(500);
  await click('[data-give="brick"]'); await click('[data-get="wheat"]');
  await click(`[data-ask="${B}"]`); await wait(800);
  await tapCover("cover-trade-offer2");
  await click(".rush-offer-decline"); await wait(900);
  await tapCover("cover-trade-answer-no");
  // dev cards: buy then play
  await G((g, a) => { const p = g.players[a.A]; p.resources = { wood: 2, brick: 1, sheep: 3, wheat: 3, ore: 3 }; g.render(); }, { A, B });
  await click("#mBuyBtn"); await wait(800);
  await snap("buy-dev");
  // knight -> robber -> steal
  await G((g, a) => { g.players[a.A].devCards.knight = 1; g.render(); }, { A, B });
  await click(".card.dev");
  await wait(600); await snap("knight-tray");
  await page.locator(".card.dev").getByText("Play", { exact: true }).click(); await wait(900);
  await snap("robber-prompt");
  // tap a hex next to the other human's building
  await robAt(B);
  await snap("robber-confirm");
  await click(".tbtn.primary"); await wait(1200);
  await snap("steal-result");
  console.log("after steal", await G((g) => ({ pa: g.pendingAction, vic: g.robberVictimOptions?.length })));
  if (await L.vis(page, "#victimPanel")) { await snap("victim-panel"); }
  // make A hold 9 cards, end turn
  await G((g, a) => { g.players[a.A].resources = { wood: 2, brick: 1, sheep: 3, wheat: 1, ore: 2 }; g.render(); }, { A, B });
  await clickWhen("#endTurnBtn"); await wait(800);
  await G((g) => { g.rollDice = () => ({ total: 7, d1: 3, d2: 4 }); });
  await ready("pre_roll", "cover-turn-next");
  await snap("turn-after-ack-ticker");
  await clickWhen("#rollDiceBtn"); await wait(2500);
  // discard: A must hand back cards
  for (let i = 0; i < 20; i++) { if (await G((g) => g.hsCoverOn != null)) break; await wait(300); }
  await tapCover("cover-discard");
  await snap("discard-sheet");
  for (let k = 0; k < 30; k++) { const dis = await G((g) => { const s = g.pendingDiscard; return !s || Object.values(s.selected).reduce((a, b) => a + b, 0) < s.count; }) ? true : false; if (!dis) break; await page.locator("#resourceCardStrip .card:not(.dev)").nth(k % 5).click({ timeout: 700 }).catch(() => {}); await wait(100); }
  await snap("discard-sheet-chosen");
  await click(".tbtn.primary"); await wait(1200);
  for (let i = 0; i < 20; i++) { if (await G((g) => g.hsCoverOn != null)) break; await wait(300); }
  await snap("after-discard-state");
  if (await G((g) => g.hsCoverOn != null)) await tapCover("cover-robber");
  await wait(800);
  await snap("robber-prompt-7");
  // robber after the 7: tap a tile next to the other human, rob
  const me2 = await G((g) => g.currentPlayer.id); const other = me2 === 0 ? 1 : 0;
  await robAt(other);
  await click(".tbtn.primary"); await wait(1200);
  await snap("steal-after-7");
  await snap("main-after-7");
  // win: hidden VP cards, then the end screen
  await G((g) => { g.settings.winPoints = 5; const p = g.currentPlayer; p.devVictoryPoints = 3; g.recomputeScores(); g.checkForWinner(p); });
  await wait(2500);
  await snap("end-1");
  const shots = ["race", "dice", "econ"];
  console.log(await page.evaluate(() => [...document.querySelectorAll(".game-over-overlay button")].map(b=>b.className+"|"+b.textContent.trim().slice(0,30)).join("\n")));
  await page.evaluate(() => document.querySelector(".gs-scroll").scrollTo(0, 400)); await wait(400);
  await snap("end-2");
  await page.evaluate(() => document.querySelector(".gs-scroll").scrollTo(0, 99999)); await wait(400);
  await snap("end-3");
  console.log("DONE");
  await browser.close();
})().catch((e) => { console.log('ERR', e); process.exit(1); });
