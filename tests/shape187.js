// v1.87 game shape: classifier + shape-aware headline on every eval fixture.   node tests/shape187.js
const fs = require("fs"), path = require("path"), { rehydrate } = require("./evals/fx.js");
process.removeAllListeners("warning");
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const EXPECT = { mwb26snvis5o: "comeback", mwbvik30avfn: "pullaway", mwfdvqb2dmnw: "takeover", mwg5v7k7j2cc: "knockout", mwg74y2d49gz: "sudden" }; // the last two: the Geelen game, 72eb
(async () => {
  const { aiDecisive } = await import("../src/review/ai-facts.js"), { gameShape, shapeTitle, SHAPE } = await import("../src/review/ai-shape.js"), { recipePage, validatePage } = await import("../src/review/ai-page.js");
  const D = path.join(__dirname, "evals", "fixtures"), P = (k) => ({ ref: `name.${k}`, fmt: "player" }), R = (ref, fmt) => ({ ref, ...(fmt ? { fmt } : {}) });
  for (const f of fs.readdirSync(D).filter((x) => x.endsWith(".json"))) {
    const F = JSON.parse(fs.readFileSync(path.join(D, f), "utf8")), fx = rehydrate(F), by = new Map(Array.from({ length: F.T + 1 }, (_, t) => [t, F.keys.map((k) => (fx.wc(F.keys.indexOf(k), t) ?? 0) / 100)])), sh = gameShape(fx);
    const d = aiDecisive({ winner: { id: F.winner } }, { by }, F.me); fx.decisive = d && { ...d, key: F.keys[d.seat], other: d.other && { ...d.other, key: F.keys[d.other.seat] } }; // the app computes this from the series; here from the fixture's refs
    ok(!!sh, `${F.id}: has a shape`, sh && sh.id);
    if (!sh) continue;
    if (EXPECT[F.id]) ok(sh.id === EXPECT[F.id], `${F.id}: shape is ${EXPECT[F.id]}`, sh.id);
    ok(sh.winner === F.winner && sh.won === F.won, `${F.id}: winner and result match the fixture`);
    ok(sh.tLead == null || (sh.tLead >= 1 && sh.tLead < F.T), `${F.id}: the winner's lead starts inside the game`, sh.tLead);
    if (sh.id === "knockout") ok(sh.ceil <= SHAPE.OUT + SHAPE.OUT_BAND && sh.tOut <= SHAPE.OUT_BY * F.T && !sh.won, `${F.id}: knockout = out early, never back above ${SHAPE.OUT + SHAPE.OUT_BAND}%`, [sh.tOut, sh.ceil]);
    if (sh.id === "sudden") ok(sh.step.d >= SHAPE.SUDDEN && sh.step.from < SHAPE.SUDDEN_FROM, `${F.id}: sudden = one step of ${sh.step.d} from ${sh.step.from}%`);
    const page = recipePage(fx), v = validatePage(page, fx), w = v.widgets.find((x) => x.id === "wc"), txt = shapeTitle(fx, sh, P, R);
    ok(!!w, `${F.id}: the game card validates`);
    ok(sh.id === "sudden" || sh.id === "seesaw" ? txt === null : Array.isArray(txt) && txt.length > 3, `${F.id}: headline ${txt ? "follows the shape" : "stays the decisive swing"}`);
    if (txt) ok(JSON.stringify(w.title).includes(`"turn.${sh.id === "comeback" ? sh.tLow : sh.id === "knockout" ? sh.tOut : sh.tLead}"`), `${F.id}: validated title carries the shape's turns`);
    console.log("    ", F.id, sh.id, "->", (w?.title || []).map((x) => (typeof x === "string" ? x : x.ref)).join(""));
  }
  console.log(fails ? `FAILED ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
