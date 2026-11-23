// Step 5: events instead of addLog / DOM stubs. The log, the sounds, the stats recorder and the review recorder must not change.
//   node tests/events197.js BASE_ROOT [PORT] [--quick]      BASE_ROOT = a checkout of the code before the change (origin/main v1.96)
// The same seeded games (a person at seat 0, driven through the Action API like a user; the bots as usual) are played in the browser (360x780, NL and EN,
// timers 25x, Math.random seeded before the app loads) on THIS tree and on BASE_ROOT. Per game both give: every addLog text, every sound the game plays,
// every fx call, every placement animation, the stats events and steps, the review recorder's moves, the toasts, the final position.
// Also, on this tree only: the engine's own event stream is complete: the position is rebuilt from the events alone (hands, pieces, robber, holders).
// A run of BASE against BASE first shows the games are deterministic at all (otherwise a difference would mean nothing).
const { chromium } = (() => { try { return require("playwright"); } catch (_) { return require("/opt/node-tools/node_modules/playwright"); } })();
const http = require("http"), fs = require("fs"), path = require("path");
const mime = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".mjs": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const serve = (root, port) => new Promise((res) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": mime[path.extname(u)] || "application/octet-stream" }); r.end(d); }); }); s.listen(port, () => res(s)); });
const HERE = path.resolve(__dirname, "..");
const BASE = path.resolve(process.argv[2] || "");
const PORT = +(process.argv[3] && /^\d+$/.test(process.argv[3]) ? process.argv[3] : 8911);
const QUICK = process.argv.includes("--quick");
let fails = 0;
const check = (ok, m, x = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${m}${x !== "" ? "  (" + x + ")" : ""}`); if (!ok) fails++; };

const COMMON = { map: "random", dice: "random", botStyleMode: "all", allPreset: "intermediate" };
const GAMES = [
  { id: "classic", seed: 1961, turns: 22, settings: { ...COMMON, mode: "classic", numBots: 3 } },
  { id: "classic-balanced", seed: 1962, turns: 16, settings: { ...COMMON, mode: "classic", map: "balanced", dice: "balanced", numBots: 2 } },
  { id: "seafarers", seed: 1963, turns: 20, settings: { ...COMMON, mode: "classic", board: "seafarers", numBots: 2 } },
  { id: "five-six", seed: 1964, turns: 12, settings: { ...COMMON, mode: "classic", numBots: 5 } },
];

async function play(browser, port, g, lang, events) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: lang === "nl" ? "nl-NL" : "en-US" });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(({ seed, lang }) => {
    localStorage.clear(); localStorage.setItem("colonist_sound", "off"); localStorage.setItem("colonist.intro", "done"); localStorage.setItem("colonist.welcomed", "1"); localStorage.setItem("colonist_lang", lang);
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const st = window.setTimeout, si = window.setInterval, sp = 25;
    window.__realTimeout = st;
    window.setTimeout = (f, ms, ...r) => st(f, (ms || 0) / sp, ...r);
    window.setInterval = (f, ms, ...r) => si(f, Math.max(1, (ms || 0) / sp), ...r);
    Date.now = (() => { const d = Date.now.bind(Date); const t0 = d(); return () => 1.7e12 + Math.round((d() - t0) * sp); })(); // game time runs as fast as the timers (log stamps, undo windows)
  }, { seed: g.seed, lang });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__colonistGame && document.body.dataset.gameReady);
  await page.evaluate(async ({ settings, events, lang }) => {
    const g = window.__colonistGame, W = window;
    W.__rec = { log: [], sfx: [], fx: [], anim: [], toast: [], err: [] };
    const I18N = await import("/src/i18n.js");
    W.__tr = I18N.tr;
    if (events && g.events) {
      g.events.record = [];
      const E = await import("/src/core/events.js"); // the same sentences from the events, in the app language: what the display shows
      W.__evText = [];
      g.events.on("zz-test", (e) => { if (!W.__frozen) { const t = E.eventToText(e, lang, g); if (t != null) W.__evText.push(t); } });
    }
    W.__collect = () => { const R = W.__rec;
    const hand = (p) => ["wood", "brick", "sheep", "wheat", "ore"].map((k) => p.resources[k]).join("");
    const rv = (g._rv?.recs || []).map((x) => [x.k, x.pid, x.t, x.s, x.e, JSON.stringify(x.a)].join("|"));
    const final = { turn: g.turn, winner: g.winner ? g.winner.id : null, players: g.players.map((p) => [hand(p), p.victoryPoints, [...p.roads].sort((a, b) => a - b).join("."), [...p.settlements].sort((a, b) => a - b).join("."), [...p.cities].sort((a, b) => a - b).join("."), [...(p.ships || [])].sort((a, b) => a - b).join(".")].join("/")), robber: g.robberHexId, pirate: g.sea?.pirateHexId ?? null, bank: ["wood", "brick", "sheep", "wheat", "ore"].map((k) => g.bank[k]).join("") };
    const st = g.stats ? { ev: g.stats.ev, steps: g.stats.steps, vp: g.stats.vp } : null;
    const out = { log: R.log, sfx: R.sfx, fx: R.fx, anim: R.anim, toast: R.toast, err: R.err, stats: JSON.stringify(st), review: rv, final: JSON.stringify(final), nlog: g.logEntries.length };
    if (events && g.events?.record) { out.events = g.events.record.slice(); out.evText = W.__evText.slice(); out.logTr = R.log.map((l) => W.__tr(l.replace(/ \{"sbp":true\}$/, ""))); }
    if (events) out.summary = summarize(g);
    return out;
    function summarize(g) { // what the game says now, to compare with the position rebuilt from the events
      const o = { players: g.players.map((p) => ({ hand: hand(p), road: [...p.roads].sort((a, b) => a - b), set: [...p.settlements].sort((a, b) => a - b), city: [...p.cities].sort((a, b) => a - b), ship: [...(p.ships || [])].sort((a, b) => a - b), knights: p.knightsPlayed })), robber: g.robberHexId, pirate: g.sea?.pirateHexId ?? null, lr: g.longestRoadHolder, la: g.largestArmyHolder, winner: g.winner ? g.winner.id : null, bank: ["wood", "brick", "sheep", "wheat", "ore"].map((k) => g.bank[k]).join(","), rolls: Object.values(g.rollHistory).reduce((a, b) => a + b, 0) };
      return o;
    }
    };
    const al = g.addLog.bind(g);
    // the game is cut at one logical moment (the first roll of a turn past the limit): the bots would otherwise run on for a few real milliseconds
    g.addLog = (t, m) => { if (W.__frozen) return al(t, m); const x = /^(?:Turn |Roll #)(\d+):/.exec(t); if (x && +x[1] > W.__turns) { W.__out = W.__collect(); W.__frozen = true; W.__done = true; return al(t, m); } W.__rec.log.push(t + (m ? " " + JSON.stringify(m) : "")); return al(t, m); };
    const sp = g.sound.play.bind(g.sound); g.sound.play = (...a) => { if (!W.__frozen) W.__rec.sfx.push(JSON.stringify(a)); return sp(...a); };
    const pt = g.pushToast.bind(g); g.pushToast = (t, c) => { if (!W.__frozen) W.__rec.toast.push(String(t) + "|" + (c || "")); return pt(t, c); };
    const at = g._animateTradeCards.bind(g); g._animateTradeCards = (...a) => { if (!W.__frozen) W.__rec.fx.push("tradeCards" + JSON.stringify(a.slice(0, 2))); return at(...a); };
    const wrapFx = () => { const fx = g.fx; if (!fx || fx.__w) return; fx.__w = true;
      ["diceRoll", "freeRoad", "steal", "yearOfPlenty", "monopoly", "flyResources", "devToHand", "devReveal", "badge", "spotlight"].forEach((k) => { const o = fx[k]; if (typeof o !== "function") return;
        fx[k] = function (...a) { if (!W.__frozen) W.__rec.fx.push(k + JSON.stringify(a.map((x) => (x && typeof x === "object" && !Array.isArray(x) && !("length" in x) ? (x.nodeType ? "el" : x) : x)).filter((x) => x !== "el")).slice(0, 160)); return o.apply(this, a); }; }); };
    wrapFx();
    let pa = g.placementAnims; const hook = (arr) => { const o = arr.push.bind(arr); arr.push = (...x) => { x.forEach((e) => !W.__frozen && W.__rec.anim.push([Math.round(e.x), Math.round(e.y), e.type, e.color || ""].join(","))); return o(...x); }; return arr; };
    hook(pa);
    Object.defineProperty(g, "placementAnims", { configurable: true, get: () => pa, set: (v) => { pa = Array.isArray(v) && !v.push.__h ? hook(v) : v; if (pa.push) pa.push.__h = true; } });
    pa.push.__h = true;
    g.startNewGame(settings);
    wrapFx();
  }, { settings: g.settings, events, lang });
  // the person at the table: one action a tick, chosen by a fixed rule (never random)
  await page.evaluate(({ turns }) => {
    const W = window, g = W.__colonistGame; const rt = W.__realTimeout;
    W.__turns = turns;
    let me = g.players.findIndex((p) => p.isHuman), tradeTurn = -1, offerTurn = -1, roads = 0, roadTurn = -1, guard = 0;
    const order = { city: 0, settlement: 1, road: 2, ship: 3 };
    const tick = () => {
      if (g.winner) { if (!W.__frozen) { W.__out = W.__collect(); W.__frozen = true; } W.__done = true; return; }
      if (W.__frozen) return;
      let a = null;
      try {
        const api = g.api, prompts = api.prompts().filter((p) => p.actor === me);
        if (g.diceResult || g._aiDiceAnimating || g.robberBusy && !g.pendingAction && !g.pendingDiscard) { /* the dice are still tumbling */ }
        else if (prompts.length && !g.pendingIncomingTrade) {
          const p = prompts[0], acts = api.enumerate(me, { prompt: p, max: 80 });
          const pick = (f) => acts.find(f);
          switch (p.kind) {
            case "preRoll": a = pick((x) => x.type === "roll"); break;
            case "main": {
              if (g.turn !== roadTurn) { roadTurn = g.turn; roads = 0; }
              a = acts.filter((x) => x.type === "build" && x.piece !== "road" && x.piece !== "ship").sort((x, y) => order[x.piece] - order[y.piece])[0]
                || pick((x) => x.type === "playDev" && x.card === "knight")
                || pick((x) => x.type === "playDev" && x.card !== "knight")
                || pick((x) => x.type === "buyDev")
                || (roads < 2 ? pick((x) => x.type === "build" && (x.piece === "road" || x.piece === "ship")) : null)
                || (tradeTurn !== g.turn ? pick((x) => x.type === "tradeBank") : null)
                || (offerTurn < g.turn - 2 && !g.sea ? pick((x) => x.type === "offerTrade") : null)
                || pick((x) => x.type === "endTurn");
              if (a && a.type === "build") roads += a.piece === "road" || a.piece === "ship" ? 1 : 0;
              if (a && a.type === "tradeBank") tradeTurn = g.turn;
              if (a && a.type === "offerTrade") offerTurn = g.turn;
              break;
            }
            case "rushAny": {
              const key = g.rush ? g.rush.rollNo : -1;
              if (key !== roadTurn) { roadTurn = key; roads = 0; }
              a = acts.filter((x) => x.type === "build" && x.piece !== "road" && x.piece !== "ship").sort((x, y) => order[x.piece] - order[y.piece])[0]
                || pick((x) => x.type === "buyDev")
                || pick((x) => x.type === "playDev" && x.card === "knight")
                || (roads < 2 ? pick((x) => x.type === "build" && x.piece === "road") : null)
                || (tradeTurn !== key ? pick((x) => x.type === "tradeBank") : null);
              if (a && a.type === "build" && (a.piece === "road" || a.piece === "ship")) roads += 1;
              if (a && a.type === "tradeBank") tradeTurn = key;
              break;
            }
            case "respondTrade": a = pick((x) => x.answer === "accept") || acts[0]; break;
            case "sbp": a = pick((x) => x.type === "build") || pick((x) => x.type === "passSbp"); break;
            default: a = acts[0];
          }
        } else if (g.pendingIncomingTrade && g.currentPlayer !== g.players[me]) {
          g.resolveIncomingTrade(true); // a bot's offer on the table: yes
        } else if (g._tradeAnswers && g.currentPlayer === g.players[me]) {
          const t = g._tradeAnswers, ok = t.responses?.find((r) => r.accepts);
          if (ok) g._executePlayerTrade(ok.player, t.offer, t.request); else { g._clearTradeAnswers?.(); g.closeTradeModal?.(); }
        }
        if (a) { const r = g.api.act(a); if (!r.ok) { W.__rec.err.push(JSON.stringify([a, r.reason])); guard += 1; } }
      } catch (e) { W.__rec.err.push(String(e && e.stack || e).slice(0, 300)); guard += 5; }
      if (guard > 40) { W.__done = true; return; }
      rt(tick, a ? 45 : 14);
    };
    rt(tick, 50);
  }, { turns: g.turns });
  await page.waitForFunction(() => window.__done, null, { timeout: 280000, polling: 250 });
  const r = await page.evaluate(() => window.__out);
  await ctx.close();
  return { ...r, errors };
}

const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
/** The position, from the events alone. */
function rebuild(events, n, sea) {
  const P = Array.from({ length: n }, () => ({ h: Object.fromEntries(R5.map((r) => [r, 0])), road: new Set(), set: new Set(), city: new Set(), ship: new Set(), knights: 0 }));
  const S = { robber: null, pirate: null, lr: null, la: null, winner: null, rolls: 0 };
  const bank = Object.fromEntries(R5.map((r) => [r, 19]));
  const add = (seat, cards, sign) => { for (const r of R5) if (cards[r]) { P[seat].h[r] += sign * cards[r]; bank[r] -= sign * cards[r]; } };
  const sw = (a, b, ga, gb) => { for (const r of R5) { P[a].h[r] += (gb[r] || 0) - (ga[r] || 0); P[b].h[r] += (ga[r] || 0) - (gb[r] || 0); } };
  for (const e of events) {
    switch (e.type) {
      case "paid": add(e.seat, e.cost, -1); break;
      case "received": add(e.seat, e.cards, 1); break;
      case "placed": if (e.piece === "road") P[e.seat].road.add(e.at); else if (e.piece === "settlement") P[e.seat].set.add(e.at); else { P[e.seat].set.delete(e.at); P[e.seat].city.add(e.at); } break;
      case "built": if (e.piece === "ship") P[e.seat].ship.add(e.at); break;
      case "unbuilt": if (e.piece === "road") P[e.seat].road.delete(e.at); else if (e.piece === "ship") P[e.seat].ship.delete(e.at); else if (e.piece === "settlement") P[e.seat].set.delete(e.at); else { P[e.seat].city.delete(e.at); P[e.seat].set.add(e.at); } break;
      case "shipMoved": if (e.from != null) { P[e.seat].ship.delete(e.from); P[e.seat].ship.add(e.to); } break;
      case "robberMoved": if (e.pirate) S.pirate = e.hex; else S.robber = e.hex; break;
      case "stole": P[e.victim].h[e.res] -= 1; P[e.seat].h[e.res] += 1; break;
      case "traded": sw(e.seat, e.partner, e.gave, e.got); break;
      case "devPlayed": if (e.card === "knight") P[e.seat].knights += 1; if (e.card === "monopoly") { for (let i = 0; i < n; i++) if (i !== e.seat) P[i].h[e.res] = 0; P[e.seat].h[e.res] += e.collected; } break;
      case "award": if (e.award === "longestRoad") S.lr = e.seat; else S.la = e.seat; break;
      case "won": S.winner = e.seat; break;
      case "turnLimit": S.winner = e.seat; break;
      case "rolled": S.rolls += 1; break;
      default:
    }
  }
  return { players: P.map((p) => ({ hand: R5.map((r) => p.h[r]).join(""), road: [...p.road].sort((a, b) => a - b), set: [...p.set].sort((a, b) => a - b), city: [...p.city].sort((a, b) => a - b), ship: [...p.ship].sort((a, b) => a - b), knights: p.knights })),
    robber: S.robber, pirate: sea ? S.pirate : null, lr: S.lr, la: S.la, winner: S.winner, rolls: S.rolls };
}

const firstDiff = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return -1; };
function compare(tag, x, y) {
  let ok = true;
  for (const k of ["log", "sfx", "fx", "anim", "toast", "review"]) {
    const d = firstDiff(x[k], y[k]);
    if (d >= 0) { ok = false; check(false, `${tag}: ${k} stream identical`, `first difference at #${d} of ${x[k].length}/${y[k].length}: ${JSON.stringify(x[k][d])} vs ${JSON.stringify(y[k][d])}`); }
  }
  for (const k of ["stats", "final"]) if (x[k] !== y[k]) { ok = false; let i = 0; while (x[k][i] === y[k][i]) i++; check(false, `${tag}: ${k} identical`, `at char ${i}: ...${x[k].slice(Math.max(0, i - 40), i + 60)} vs ...${y[k].slice(Math.max(0, i - 40), i + 60)}`); }
  if (ok) check(true, `${tag}: log ${x.log.length} lines, sfx ${x.sfx.length}, fx ${x.fx.length}, anim ${x.anim.length}, toasts ${x.toast.length}, review ${x.review.length} moves, stats ${JSON.parse(x.stats).ev.length} events: identical`);
  return ok;
}

/** Headless golden games (classic, Rush played as turns, Seafarers, 5-6): every journal line of both trees. Rush in the browser runs on wall-clock timers and is not
 *  reproducible even against itself, so its text is compared here, on the golden harness's virtual clock. */
function headlessCompare() {
  const { execFileSync } = require("child_process");
  const run = (root) => JSON.parse(execFileSync("node", [path.join(HERE, "tests/events197-headless.mjs"), root], { maxBuffer: 1 << 29 }).toString());
  const a = run(HERE), b = run(BASE);
  for (const id of Object.keys(b)) {
    const x = a[id], y = b[id], d = x ? firstDiff(x.lines, y.lines) : 0;
    check(!!x && d < 0 && x.winner === y.winner && x.turns === y.turns && y.lines.length > 30, `headless ${id}: ${y.lines.length} journal lines, winner ${y.winner}, turn ${y.turns}: identical`, d < 0 ? "" : `line ${d}: ${JSON.stringify(x?.lines[d])} vs ${JSON.stringify(y.lines[d])}`);
  }
}

(async () => {
  if (!BASE || !fs.existsSync(BASE)) { console.log("usage: node tests/events197.js BASE_ROOT [PORT]"); process.exit(2); }
  const sA = await serve(HERE, PORT), sB = await serve(BASE, PORT + 1);
  const browser = await chromium.launch();
  headlessCompare();
  const games = (QUICK ? GAMES.slice(0, 2) : GAMES).filter((x) => !process.env.ONLY || x.id === process.env.ONLY);
  const langs = process.env.LANG_ONLY ? [process.env.LANG_ONLY] : QUICK ? ["en"] : ["nl", "en"];
  for (const lang of langs) {
    for (const g of games) {
      const tag = `${g.id} ${lang}`;
      const mine = await play(browser, PORT, g, lang, true);
      const base = await play(browser, PORT + 1, g, lang, false);
      check(!mine.errors.length && !base.errors.length, `${tag}: no page errors`, [...mine.errors, ...base.errors].slice(0, 2).join(" | "));
      check(base.log.length > 40 && base.review.length > 5 && base.err.length === 0, `${tag}: the game is played (driver)`, `${base.log.length} log lines, ${base.review.length} review moves, errors: ${base.err.slice(0, 2).join(" ; ")}`);
      compare(tag, mine, base);
      // events complete: the position rebuilt from the event stream alone
      if (process.env.DUMP && mine.events) fs.writeFileSync(`${process.env.DUMP}/${g.id}-${lang}.json`, JSON.stringify({ events: mine.events, summary: mine.summary }));
      if (!mine.events) { check(true, `${tag}: (no event stream in this tree)`); continue; }
      { const a = mine.evText, b = mine.logTr, d = firstDiff(a, b);
        check(d < 0 && a.length > 40, `${tag}: eventToText(event, "${lang}") = the journal line the display translates (${a.length} lines)`, d < 0 ? "" : `#${d}: ${JSON.stringify(a[d])} vs ${JSON.stringify(b[d])}`); }
      const n = g.settings.numBots + 1, rb = rebuild(mine.events, n, !!g.settings.board);
      const want = mine.summary, got = rb;
      const strip = (s) => JSON.stringify({ players: s.players.map((p) => ({ hand: p.hand, road: p.road, set: p.set, city: p.city, ship: p.ship, knights: p.knights })), robber: s.robber, pirate: s.pirate, lr: s.lr, la: s.la, winner: s.winner, rolls: s.rolls });
      check(strip(want) === strip(got), `${tag}: the event stream alone rebuilds the final position (hands, pieces, robber, holders, rolls; ${mine.events.length} events)`, strip(want) === strip(got) ? "" : `\n  game ${strip(want)}\n  events ${strip(got)}`);
    }
  }
  if (!QUICK) { // the games are deterministic at all: BASE twice
    for (const g of games) {
      const a = await play(browser, PORT + 1, g, "en", false), b = await play(browser, PORT + 1, g, "en", false);
      check(compare(`BASE vs BASE (determinism) ${g.id}`, a, b), `${g.id}: the seeded browser game is reproducible`);
    }
  }
  console.log(fails ? `${fails} FAILED` : "ALL PASS");
  await browser.close(); sA.close(); sB.close();
  process.exit(fails ? 1 : 0);
})();
