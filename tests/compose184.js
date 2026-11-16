// v1.84 compose mode: client module with a mocked fetch. No browser, no network. node tests/compose184.js
// (the src files are ES modules without a package "type", so they are copied into a temp dir next to a {"type":"module"} package.json)
const fs = require("fs"), path = require("path"), os = require("os"), { pathToFileURL } = require("url");
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + JSON.stringify(x) : ""}`); if (!c) fails++; };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compose184-")), src = path.join(__dirname, "..", "src", "review");
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  for (const f of ["ai-page.js", "ai-compose.js"]) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  const C = await import(pathToFileURL(path.join(dir, "ai-compose.js")).href);
  // a small fake fact index: refs resolve from a table
  const T = 30, tab = { "name.you": [0, "player"], "name.mila": [1, "player"], "pts.you": [8, "n"], "pts.mila": [10, "n"], "turn.30": [30, "turn"], "turn.12": [12, "turn"], "wc.you@11": [40, "pct"], "wc.you@12": [22, "pct"], "d.you@12": [-18, "pct"],
    "strat.you.idleN": [6, "n"], "strat.you.turns": [30, "n"], "strat.you.steady": [1, "b"], "strat.you.plan": ["cities", "x"], "luck.total.you": [-9, "pct"], "luck.total.mila": [9, "pct"], "luck.dominant": [1, "b"] };
  const fx = { T, me: 0, keys: ["you", "mila"], winner: 1, won: false, hasWc: true, near: null, luck: { tot: [-9, 9] }, dice: null, rate: null, log: {}, decs: [], decAt: () => null, swings: (q) => (q === 0 ? [{ t: 12, d: -18 }] : []),
    players: [{ seat: 0, key: "you", name: "You", you: true }, { seat: 1, key: "mila", name: "Mila", you: false }], nameOf: (q) => (q ? "Mila" : "You"), seatOf: (k) => ["you", "mila"].indexOf(String(k)),
    strat: [{ verdict: { label: "Solid plan" }, steady: true, plan: "cities", idleN: 6, turns: 30, srcTotal: 8, planFam: "cities", feeds: "yes" }, { verdict: null }],
    wc: () => 40, ref: (r) => { const e = tab[r]; return e ? { v: e[0], k: e[1] } : null; } };
  const T1 = (s) => ({ k: "s", s, ref: null, fmt: null, a: null, b: null, up: null, down: null, same: null }), R1 = (ref, fmt = null) => ({ k: "ref", s: null, ref, fmt, a: null, b: null, up: null, down: null, same: null });
  const blk = (o) => ({ p: "text", metric: null, player: null, players: [], range: [], marks: [], show: [], rows: [], diverging: false, unit: null, items: [], dec: null, turn: null, of: null, parts: [], link: false, ...o });
  const W = (id, title, blocks) => ({ id, level: "Strategy", short: "the plan", who: null, chip: null, title, requires: [], blocks, expand: [], notes: [] });
  const good1 = W("a", [T1("Points came from "), R1("strat.you.plan", "x"), T1(" and "), R1("strat.you.idleN"), T1(" turns stalled.")], [blk({ p: "tiles", items: [{ kind: "num", label: "Stalled turns", ref: "strat.you.idleN", of: "strat.you.turns", subIf: null, sub: [], player: null }] })]);
  const good2 = W("b", [R1("name.you", "player"), T1(" held "), R1("pts.you"), T1(" points against "), R1("pts.mila"), T1(".")], [blk({ p: "bars", rows: [{ player: "you", ref: "pts.you" }, { player: "mila", ref: "pts.mila" }] })]);
  const badRef = W("c", [T1("A claim about "), R1("pts.ghost")], [blk({ p: "bars", rows: [{ player: "you", ref: "pts.ghost" }] })]);
  const digit = W("d", [T1("Took 3 turns to settle")], [blk({ p: "text", parts: [T1("Four builds in 5 turns")] })]);
  const causal = W("e", [T1("Lost because of the robber")], [blk({ p: "badge", player: "mila" })]);
  const mk = (widgets, extra = {}) => ({ headline: [], widgets, follow: ["What was the plan?"], ...extra });
  let sent = null;
  const mock = (compose, status = 200) => async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: status === 200, status, json: async () => ({ compose }) }; };

  // payload
  const idx = C.composeIndex(fx);
  ok(idx.refs["name.you"] === "player:You" && idx.refs["strat.you.idleN"] === "n:6" && !("pts.ghost" in idx.refs), "index lists refs that resolve, with kind and hint", Object.keys(idx.refs).length);
  ok(idx.game.you === "you" && idx.game.winner === "mila" && idx.game.turns === 30, "index carries players and result");

  // 1. valid spec passes; bad ones are dropped
  let r = await C.composePage(null, "en", { fx, fetchFn: mock(mk([good1, good2, badRef, digit, causal])) });
  ok(sent.url === C.COMPOSE_URL && sent.body.mode === "compose" && sent.body.lang === "en" && sent.body.index && sent.body.examples, "request: mode compose, index, examples, lang");
  ok(r.source === "ai" && r.page.widgets.length === 2, "valid specs pass, 3 invalid dropped", r.page.widgets.map((w) => w.id));
  ok(!r.page.widgets.some((w) => ["c", "d", "e"].includes(w.id)), "unknown ref / digit in free text / causal word are dropped");
  ok(r.page.widgets[0].blocks[0].p === "tiles" && r.page.widgets[0].titleFallback === false, "good widget keeps its title and block");
  ok(r.page.follow.length === 1 && r.page.follow[0].q === "What was the plan?", "follow-up chip kept");
  r = await C.composePage(null, "nl", { fx, fetchFn: mock(mk([good1, good2])) });
  ok(sent.body.lang === "nl", "lang nl passed");

  // 2. fallback to recipes
  r = await C.composePage(null, "en", { fx, fetchFn: mock(mk([good1, badRef, digit])) });
  ok(r.source === "recipes" && r.page.widgets.length >= 1, "fewer than 2 valid -> recipes", [r.source, r.page.widgets.map((w) => w.id)]);
  r = await C.composePage(null, "en", { fx, fetchFn: mock(null, 429) });
  ok(r.source === "recipes", "endpoint error -> recipes");
  r = await C.composePage(null, "en", { fx, fetchFn: async () => { throw new Error("offline"); } });
  ok(r.source === "recipes", "offline -> recipes");
  r = await C.composePage(null, "en", { fx, fetchFn: mock({ widgets: "junk" }) });
  ok(r.source === "recipes", "garbage answer -> recipes");
  fs.rmSync(dir, { recursive: true });
  console.log(fails ? `${fails} FAILED` : "all ok"); process.exit(fails ? 1 : 0);
})();
