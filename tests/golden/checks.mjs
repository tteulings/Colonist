// Every golden check: { id, group, run() -> JSON value }. run.mjs compares the value with tests/golden/<file>.json; regen.mjs writes them.
// Three files: games.json (move-log hashes of seeded bot games), replay.json (saved positions loaded through review/engine.js, then played on),
// review.json (the numbers of the review: step ledger series, Monte Carlo position values, one evaluated decision).
import fs from "node:fs";
import { g, hash, stateHash, playGame, playOn } from "./lib.mjs";
import { GAMES } from "./games.mjs";
import { unpackRecs } from "../../src/review/pack.js";
import { loadRecord, loadPosition } from "../../src/review/engine.js";
import { makeLedger, roundSteps } from "../../src/review/ledger.js";
import { posValue } from "../../src/review/step-mc.js";
import { evaluateRecord } from "../../src/review/evaluate.js";

const here = new URL("./", import.meta.url).pathname, repo = new URL("../../", import.meta.url).pathname;
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const r6 = (x) => Math.round(x * 1e6) / 1e6;

export const FILES = { games: "games.json", replay: "replay.json", review: "review.json" };
export const checks = [];

// ── 1 seeded games ──
for (const spec of GAMES) checks.push({ file: "games", id: spec.id, group: spec.group, run: () => { const r = playGame(spec); delete r.log; delete r.id; return r; } });

// ── 2 saved games: the position loaded through review/engine.js (hash of the whole state), then played on seeded ──
const LS = (f) => { const d = readJson(f); const m = d.origins ? Object.fromEntries(d.origins[0].localStorage.map((x) => [x.name, x.value])) : d; return JSON.parse(m.colonist_save_v3); };
const saves = [
  ["save-classic-t9", () => LS(here + "fixtures/classic-save.json")],
  ["save-rush", () => LS(here + "fixtures/rush-save.json")],
  ["save-sea", () => readJson(here + "fixtures/sea-save.json")],
  ["save-six", () => readJson(here + "fixtures/six-save.json")],
  ["save-upgrade1911", () => LS(repo + "tests/fixtures/upgrade1911-state.json")],
  ...[60, 120].map((i) => ["save-ui191-rec" + i, () => { const E = readJson(repo + "tests/fixtures/ui191-game.json"); loadRecord(g, E.rv.base, unpackRecs(E.rv.recs)[i]); return JSON.parse(JSON.stringify(g.serializeState())); }]),
];
for (const [id, get] of saves) checks.push({ file: "replay", id, group: "saved game", run: async () => {
  const st = get(), seat = st.currentPlayerIndex ?? 0, r = await playOn(JSON.parse(JSON.stringify(st)), { seat, turns: 30, seed: 7 });
  delete r.log; delete r.id; return { players: st.players.length, ...r };
} });
// the recorded decisions of the ui191 game: every record's position through loadRecord
checks.push({ file: "replay", id: "records-ui191", group: "saved game", run: () => {
  const E = readJson(repo + "tests/fixtures/ui191-game.json"), recs = unpackRecs(E.rv.recs), hs = [];
  for (const rec of recs) { loadRecord(g, E.rv.base, rec); hs.push(stateHash(g.serializeState())); }
  return { records: recs.length, all: hash(hs), first: hs[0], last: hs[hs.length - 1] };
} });

// ── 3 review numbers ──
const LEDGERS = fs.readdirSync(repo + "tests/evals/ledger").filter((f) => f.endsWith(".json")).sort();
for (const f of LEDGERS) checks.push({ file: "review", id: "ledger-" + f.replace(".json", ""), group: "review", run: () => {
  const G = readJson(repo + "tests/evals/ledger/" + f), led = makeLedger({ recs: G.recs, n: G.n, winner: G.winner, res: G.res }), ser = led.series();
  const rounds = led.rounds(), series = rounds.map((r) => [r.t, ...(ser.by.get(r.t) || []).map(r6)]);
  const steps = rounds.map((r) => roundSteps(led, r.t).steps.map((s) => s.d.map(r6)));
  return { rounds: rounds.length, series: hash(series), steps: hash(steps), first: series[0], last: series[series.length - 1] };
} });
const E191 = () => readJson(repo + "tests/fixtures/ui191-game.json");
checks.push({ file: "review", id: "posvalue-ui191", group: "review", run: () => { // Monte Carlo (gbm leaf, 6 futures): the same positions give the same numbers
  const E = E191(), recs = unpackRecs(E.rv.recs), out = [];
  for (const i of [0, 30, 90, 150]) { const x = posValue(g, E.rv.base, { rec: recs[i], F: 6 }); out.push({ i, v: x.v, se: x.se, w: hash(x.w) }); }
  return out;
} });
checks.push({ file: "review", id: "evaluate-ui191", group: "review", run: () => { // the Master evaluation of two recorded decisions (small fixed budget)
  const E = E191(), recs = unpackRecs(E.rv.recs), out = [];
  const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === "ms" ? undefined : v)));
  for (const i of recs.map((r, i) => [r, i]).filter(([r, i]) => i > 20 && ["build", "robber"].includes(r.k) && !r.a?.free).map(([, i]) => i).filter((_, j) => j % 9 === 0).slice(0, 3)) {
    const res = evaluateRecord(g, recs[i], (rec) => loadRecord(g, E.rv.base, rec), { budget: { nPer: 4, depth: 4, setupDepth: 4, timeMs: 0 } });
    out.push({ i, label: res.label, win: res.win, loss: res.loss, skip: res.skip, cands: hash(strip(res.cands || [])) });
  }
  return out;
} });
