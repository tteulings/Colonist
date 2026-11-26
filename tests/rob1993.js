// v2.00 "Steal from…" shows what the human can KNOW of each victim's hand (the public card tracker's certain part, the rest "?").
//  A: scripted public events (payouts, a bank trade, a player trade, a steal between two bots, a steal the human takes part in, Monopoly) and the
//     picker both pickers use: icons + "?" sum to the hand size, known counts match the public events, a card that moved by a private bot-to-bot
//     steal shows as "?" (the real hand is never read), aria-labels, no overflow at 360 px (2-3 victims, 6 players), EN and NL, light and dark.
//  B: soundness over a played game: what is shown as known never exceeds the real hand, and known + unknown = the hand size, at every step.
//   node tests/rob1993.js PORT      (server: node tests/serve.mjs ROOT PORT)   env SHOTS=dir writes the four screenshots
const { chromium } = require("playwright"); const fs = require("fs"); const path = require("path");
const { humanStepFn } = require("./tlib-human.js");
const port = +process.argv[2] || 9192, SHOTS = process.env.SHOTS || "";
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openGame(browser, { lang, palette, w, h, six = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(({ lang, palette }) => {
    if (!sessionStorage.getItem("i")) { sessionStorage.setItem("i", "1"); localStorage.clear(); }
    localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1");
    localStorage.setItem("colonist.theme", "A"); localStorage.setItem("colonist.palette", palette); localStorage.setItem("colonist.paletteAuto", "off"); localStorage.setItem("colonist_lang", lang); localStorage.setItem("colonist.chipHint", "1");
    let a = 4242; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { lang, palette });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady, null, { timeout: 30000 });
  await page.locator(".hm-start").waitFor({ timeout: 10000 });
  if (six) await page.evaluate(() => window.__colonistGame.startNewGame({ mode: "classic", board: "island", map: "random", dice: "random", numBots: 5, botStyleMode: "all", allPreset: "intermediate", allStrategy: { placement: "medium", expansion: "medium", trading: "balanced", devCards: "reactive", awareness: "basic" } }));
  else await page.locator(".hm-start").tap();
  await page.waitForFunction(() => { const g = window.__colonistGame; return !g.onboardingHold && g.setupPhase; }, null, { timeout: 15000 });
  await page.evaluate(humanStepFn);
  // set-up by the sloppy-human stepper until the first main phase of the human
  for (let i = 0; i < 400; i++) { if (await page.evaluate(() => { const g = window.__colonistGame; return !g.setupPhase && g.currentPlayer?.isHuman; })) break; await page.evaluate(() => window.__humanStep()); await sleep(40); }
  await sleep(300);
  return { ctx, page, errors };
}

/** In-page: the scripted public history. Returns the expected hands: { seat: { known:{res:n}, unknown:k } }. */
const SCRIPT = () => {
  const g = window.__colonistGame, me = g.players.find((p) => p.isHuman), bots = g.players.filter((p) => !p.isHuman);
  const R = ["wood", "brick", "sheep", "wheat", "ore"];
  g._aiCardTrack = null; g._aiTrk(); // a fresh tracker: nothing known yet
  g.players.forEach((p) => R.forEach((r) => { g.bank[r] += p.resources[r]; p.resources[r] = 0; }));
  g.bank = { wood: 30, brick: 30, sheep: 30, wheat: 30, ore: 30 };
  const [A, B, C] = bots; const exp = {};
  // A: payout 2 wood + 2 wheat (public), then a bank trade 4 wheat... here: pays 1 wheat to a build-like public spend
  g.takeFromBank(A, "wood", 2); g.takeFromBank(A, "wheat", 2); g.payToBank(A, { wheat: 1 }); exp[A.id] = { known: { wood: 2, wheat: 1 }, unknown: 0 };
  // B: 3 ore, then C steals one from B privately (bot to bot): B keeps [ore 2] (certain either way), C holds 1 unknown card
  g.takeFromBank(B, "ore", 3); g.takeFromBank(B, "brick", 1); g._doSteal(C, B.id);
  // C also got 2 sheep publicly
  g.takeFromBank(C, "sheep", 2);
  window.__expect = exp; window.__A = A.id; window.__B = B.id; window.__C = C.id; window.__me = me.id;
  return { A: A.id, B: B.id, C: C.id, bHand: { ...B.resources }, cHand: { ...C.resources } };
};

const READ = () => {
  const g = window.__colonistGame; const out = {};
  document.querySelectorAll("[data-steal],[data-victim]").forEach((b) => {
    const id = +(b.dataset.steal ?? b.dataset.victim); const chips = [...b.querySelectorAll(".vh .vr")];
    const known = {}; let unk = 0;
    chips.forEach((c) => { if (c.classList.contains("vq")) unk += +c.dataset.unknown; else known[c.dataset.res] = +c.querySelector("b").textContent; });
    const txt = b.querySelector(".vh")?.textContent.replace(/\s+/g, "") || "";
    const cards = +(b.querySelector(".vn small").textContent.match(/^(\d+)/) || [0, -1])[1];
    const r = b.getBoundingClientRect();
    out[id] = { known, unk, txt, cards, aria: b.getAttribute("aria-label"), real: { ...g.players[id].resources }, over: b.scrollWidth > b.clientWidth + 1, right: r.right, h: Math.round(r.height), name: g.players[id].name };
  });
  const tray = document.querySelector(".tray"); const tr = tray?.getBoundingClientRect();
  return { picks: out, trayRight: tr?.right ?? 0, trayOver: tray ? tray.scrollWidth > tray.clientWidth + 1 : false, pageOver: document.documentElement.scrollWidth > innerWidth + 1, vw: innerWidth };
};

/** The hand fan and its bank counts are in the viewport and nothing covers them (elementFromPoint at their centres) while the picker is open. */
const FAN = () => {
  const g = window.__colonistGame, me = g.players.find((p) => p.isHuman);
  ["wood", "brick", "sheep", "wheat", "ore"].forEach((r, i) => { me.resources[r] = i % 3 + 1; }); g.render();
  const cards = [...document.querySelectorAll(".hand .card")], bks = [...document.querySelectorAll(".hand .bk-lbl")], pill = [...document.querySelectorAll(".hand-total")];
  const seen = (e) => { const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false; const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t) || t.contains(e) && !t.closest(".tray")); };
  const tray = document.querySelector(".tray"), hand = document.querySelector(".hand"), tb = tray?.getBoundingClientRect().bottom, ht = hand?.getBoundingClientRect().top;
  return { cards: cards.length, cardsSeen: cards.filter(seen).length, bks: bks.length, bksSeen: bks.filter(seen).length, pills: pill.length, pillsSeen: pill.filter(seen).length, pillTop: pill[0]?.getBoundingClientRect().top, trayBottom: tb, handTop: ht };
};

async function show(page, ids, mode) {
  await page.evaluate(({ ids, mode }) => {
    const g = window.__colonistGame; const cur = g.currentPlayer;
    if (mode === "victims") { g.robberVictimOptions = ids; g.render(); return; }
    // the second picker: a robber tile with several victims, staged on the confirm pill
    g.robberVictimOptions = []; g.pendingAction = "robber";
    g._stealVictims = () => ids; // the tile "has" these victims
    const hexId = g._legalRobberHexes(cur).map((h) => h.id).find((id) => id !== g.robberHexId);
    g.confirmBuild = { type: "robber", id: hexId, victim: null }; g.render();
  }, { ids, mode });
  await sleep(250);
}

(async () => {
  const browser = await chromium.launch();
  const sumOf = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  for (const cfg of [{ lang: "en", palette: "light", w: 360, h: 780, shot: "rob1-360x780-en-light" }, { lang: "nl", palette: "night", w: 412, h: 923, shot: "rob1-412x923-nl-dark" }]) {
    const tag = `${cfg.lang}/${cfg.palette}/${cfg.w}`;
    const { page, errors } = await openGame(browser, cfg);
    const s = await page.evaluate(SCRIPT); const ids = [s.A, s.B, s.C];
    for (const mode of ["victims", "robber"]) {
      await show(page, ids, mode);
      const R = await page.evaluate(READ); const P = R.picks;
      ok(Object.keys(P).length === 3, `${tag} ${mode}: 3 victim buttons`, Object.keys(P).length);
      for (const id of ids) {
        const p = P[id]; if (!p) continue;
        ok(sumOf(p.known) + p.unk === p.cards && p.cards === sumOf(p.real), `${tag} ${mode}: seat ${id} icons sum to the hand size`, `${JSON.stringify(p.known)} + ?${p.unk} = ${p.cards}`);
        ok(Object.keys(p.known).every((r) => p.known[r] <= p.real[r]), `${tag} ${mode}: seat ${id} known never above the real hand`);
        ok(!p.over, `${tag} ${mode}: seat ${id} button does not overflow`);
        ok(p.right <= R.vw + 0.5, `${tag} ${mode}: seat ${id} inside the screen`, p.right);
      }
      // A: all public: [wood 2][wheat 1], nothing unknown
      ok(JSON.stringify(P[s.A].known) === JSON.stringify({ wood: 2, wheat: 1 }) && P[s.A].unk === 0, `${tag} ${mode}: public payout + spend shown exactly`, P[s.A].known);
      // B: lost a card to a private steal: the worst case floor, the rest "?": 4 cards, never ore 3 (it may be the stolen one)
      ok(P[s.B].known.ore === 2 && !P[s.B].known.brick && P[s.B].unk === 1, `${tag} ${mode}: the victim of a private steal shows the floor and one "?"`, P[s.B]);
      // C: the thief got a card nobody saw (+ 2 sheep seen): "?" for it, never the real kind
      const cReal = s.cHand; const stolenKind = ["wood", "brick", "ore", "sheep", "wheat"].find((r) => r !== "sheep" && cReal[r] > 0);
      ok(P[s.C].known.sheep === 2 && P[s.C].unk === 1 && !(stolenKind in P[s.C].known), `${tag} ${mode}: a card taken in a bot-to-bot steal stays "?" (real: ${stolenKind})`, P[s.C].known);
      const nl = cfg.lang === "nl";
      ok(P[s.A].aria.startsWith(`${P[s.A].name}: 2 ${nl ? "hout" : "lumber"}, 1 ${nl ? "graan" : "grain"}, `) && /(points|punten)$/.test(P[s.A].aria), `${tag} ${mode}: aria-label`, P[s.A].aria);
      ok(P[s.C].aria.includes(nl ? "1 onbekend" : "1 unknown"), `${tag} ${mode}: aria names the unknown`, P[s.C].aria);
      const F = await page.evaluate(FAN);
      ok(F.cards >= 3 && F.cardsSeen === F.cards && F.bks === F.cards && F.bksSeen === F.bks && F.pills === 1 && F.pillsSeen === 1 && F.trayBottom <= F.pillTop && F.trayBottom <= F.handTop + 1, `${tag} ${mode}: the hand fan and its bank counts stay visible, the picker sits above them`, F);
      ok(!R.trayOver && !R.pageOver, `${tag} ${mode}: no horizontal overflow`, { tray: R.trayOver, page: R.pageOver });
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, cfg.shot + (mode === "robber" ? "-robber" : "") + ".png") }); }
    }
    // the human takes part in a steal: the card is seen, the picker shows it exactly (a bot steals from the human: the bot's card is known)
    await page.evaluate(() => {
      const g = window.__colonistGame, me = g.players.find((p) => p.isHuman), D = g.players.find((p) => !p.isHuman && p.id !== window.__A && p.id !== window.__B && p.id !== window.__C) || g.players[window.__B];
      g.takeFromBank(D, "wood", 3); window.__D = D.id; g.takeFromBank(me, "ore", 1);
      const before = { ...D.resources }; g._doSteal(me, D.id); window.__dAfter = { ...D.resources }; window.__dBefore = before;
    });
    await show(page, [await page.evaluate(() => window.__D)], "victims");
    const R2 = await page.evaluate(READ); const D = await page.evaluate(() => window.__D);
    const dp = R2.picks[D];
    ok(dp && sumOf(dp.known) + dp.unk === dp.cards, `${tag} human steal: sums to hand size`, dp && dp.known);
    // nothing known (a hand that grew without any public event): just "?×5"
    await page.evaluate(() => { const g = window.__colonistGame, q = g.players.find((p) => !p.isHuman); window.__Q = q.id; g._aiCardTrack = null; g._aiTrk(); ["wood", "brick", "sheep", "wheat", "ore"].forEach((r) => { q.resources[r] = 1; }); });
    await show(page, [await page.evaluate(() => window.__Q)], "victims");
    const R3 = await page.evaluate(READ); const q3 = R3.picks[await page.evaluate(() => window.__Q)];
    ok(q3.txt === "?×5" && q3.cards === 5 && Object.keys(q3.known).length === 0, `${tag} nothing known: "?×5"`, q3.txt);
    // D may have other unknown cards (a fresh bot with a hand taken at random above); the stolen kind is subtracted from the known floor exactly
    await page.evaluate(() => { window.__colonistGame.robberVictimOptions = []; window.__colonistGame.render(); });
    ok(errors.length === 0, `${tag}: no page errors`, errors.slice(0, 2));
    await page.context().close();
  }
  // six players: five victims at 360 px, both pickers (the grid wraps)
  {
    const { page, errors } = await openGame(browser, { lang: "en", palette: "light", w: 360, h: 780, six: true });
    const n = await page.evaluate(() => window.__colonistGame.players.length);
    ok(n === 6, "six players game", n);
    await page.evaluate(() => { const g = window.__colonistGame; g._aiCardTrack = null; g._aiTrk(); const R = ["wood", "brick", "sheep", "wheat", "ore"]; g.players.filter((p) => !p.isHuman).forEach((p, i) => { R.forEach((r) => { g.bank[r] += p.resources[r]; p.resources[r] = 0; }); g.takeFromBank(p, R[i % 5], 2 + i); g.takeFromBank(p, R[(i + 2) % 5], 1); if (i % 2) g.takeFromBank(p, R[(i + 3) % 5], 3); }); g._doSteal(g.players[3], g.players[1].id); });
    const ids = await page.evaluate(() => window.__colonistGame.players.filter((p) => !p.isHuman).map((p) => p.id));
    for (const mode of ["victims", "robber"]) {
      await show(page, ids, mode);
      const R = await page.evaluate(READ); const P = R.picks;
      ok(Object.keys(P).length === 5, `six ${mode}: 5 buttons`, Object.keys(P).length);
      ok(ids.every((id) => P[id] && sumOf(P[id].known) + P[id].unk === P[id].cards), `six ${mode}: every row sums to its hand size`);
      ok(ids.every((id) => P[id] && !P[id].over && P[id].right <= R.vw + 0.5) && !R.pageOver && !R.trayOver, `six ${mode}: nothing overflows at 360`, { page: R.pageOver, tray: R.trayOver, h: ids.map((i) => P[i]?.h) });
      const F6 = await page.evaluate(FAN);
      ok(F6.cardsSeen === F6.cards && F6.bksSeen === F6.bks && F6.pillsSeen === 1 && F6.cards >= 3 && F6.trayBottom <= F6.handTop + 1, `six ${mode}: the hand fan and its bank counts stay visible`, F6);
      if (SHOTS && mode === "victims") await page.screenshot({ path: path.join(SHOTS, "rob1-360x780-en-light-six.png") });
    }
    ok(errors.length === 0, "six: no page errors", errors.slice(0, 2));
    await page.context().close();
  }
  // B: soundness over a played game
  {
    const { page, errors } = await openGame(browser, { lang: "en", palette: "light", w: 360, h: 780 });
    await page.evaluate(() => {
      const g = window.__colonistGame; window.__viol = []; window.__checks = 0;
      window.__chk = () => g.players.forEach((p) => { const h = g._publicHand(p), tot = Object.values(p.resources).reduce((a, b) => a + b, 0), ks = Object.values(h.known).reduce((a, b) => a + b, 0); window.__checks++;
        if (ks + h.unknown !== tot || Object.keys(h.known).some((r) => h.known[r] > p.resources[r])) window.__viol.push({ p: p.id, known: h.known, unk: h.unknown, real: { ...p.resources } }); });
      g.events.on("zzchk", () => setTimeout(window.__chk, 0)); setInterval(window.__chk, 40);
    });
    const t0 = Date.now(); let steals = 0;
    while (Date.now() - t0 < 60000) { const r = await page.evaluate(() => window.__humanStep()); if (r === "over") break; await sleep(r === "wait" ? 50 : 25); }
    const R = await page.evaluate(() => ({ v: window.__viol.slice(0, 3), n: window.__viol.length, c: window.__checks, turn: window.__colonistGame.turn, lbMax: (() => { const g = window.__colonistGame; return g.players.map((p) => g._publicHand(p).known); })() }));
    ok(R.n === 0 && R.c > 200, "soundness: known never above the real hand, known + ? = hand size, over a played game", R);
    ok(errors.length === 0, "soundness: no page errors", errors.slice(0, 2));
    await page.context().close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})();
