// Event-stream golden (perf v1.99): like tests/golden, but at event granularity, for BOTH routes.
//   node tests/golden-events/run.mjs                 compare a fresh run with the stored baseline (exit 1 on any byte of difference)
//   node tests/golden-events/run.mjs --regen         write the baseline (only on a tree whose behaviour is the reference)
//   options: --only substr   --route old|host   --quiet-check (default on: host games are replayed with quiet apply and must give the same steps)
//
// host route: every applied action, in order: seat, prompt kind, canonical action, the engine's events of that apply (JSON, with seq),
//   the hash of the whole serialized game state after it, the Math.random call count after it; plus the final result.
// old route:  the legacy loop observed through engine.observe(): every move as an action with its prompt, legality, drawn chance, the state hash
//   after it, the random-call count; plus the golden move log text (every line) and the final result.
// Quiet check: the host route is played a second time with quiet apply (no event list, what a tournament does); its step lines must equal the
//   step lines of the events run (events are the only thing that differs).
import fs from "node:fs";
import zlib from "node:zlib";
import { g, playGame, stateHash, randomCalls, hostMode } from "../golden/lib.mjs";
import { GAMES } from "../golden/games.mjs";
import { createEngine } from "../../src/api/engine.js";
import { actionKey } from "../../src/api/actions.js";

const here = new URL("./", import.meta.url).pathname;
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const only = arg("--only"), routeOnly = arg("--route"), regen = process.argv.includes("--regen");
const G = (id, seed, seats, o = {}) => ({ id, group: "events", seed, seats, ...o });
// the golden's own games, and more seeds of the shapes that matter (dev cards, trades, robber, sea, 5-6)
const EXTRA = [
  G("x-expert-3", 103, ["expert", "expert", "expert", "expert"]),
  G("x-ladder-4", 104, ["expert", "intermediate", "simple", "beginner"], { map: "balanced" }),
  G("x-trader-5", 105, ["trader", "shark", "builder", "intermediate"]),
  G("x-inter-6", 106, ["intermediate", "intermediate", "expert", "expert"], { dice: "deck" }),
  G("x-sea-7", 107, ["expert", "intermediate", "expert"], { sea: true }),
  G("x-sea-8", 108, ["trader", "shark", "simple", "expert"], { sea: true }),
  G("x-six-9", 109, ["expert", "shark", "intermediate", "trader", "builder", "expert"]),
  G("x-master-10", 110, ["master", "intermediate", "expert", "trader"]),
  G("x-super-11", 111, ["super", "expert", "shark", "simple"]),
  G("x-rush-12", 112, ["expert", "trader", "intermediate", "shark"], { mode: "rush" }),
];
const ALL = [...GAMES, ...EXTRA].filter((s) => (!only || s.id.includes(only)));
const sj = (v) => JSON.stringify(v);
const finalLines = (r) => [`RESULT winner=${r.winner} turns=${r.turns} vp=${sj(r.vp)} moves=${r.moves} movesHash=${r.movesHash} decisions=${r.decisionsHash} state=${r.stateHash} random=${r.randomCalls}`];

function playHostEvents(spec, quiet) {
  const lines = []; let n = 0;
  const hostOpts = { onAction: (a, prompt, res) => {
    n++;
    const st = `${n} s${a.actor} ${prompt.kind} ${actionKey(a)} state=${stateHash(g.serializeState())} rc=${randomCalls()}`;
    lines.push(quiet ? st : st + " EV " + sj(res.events));
  } };
  if (!quiet) hostOpts.onEvent = () => {};
  hostMode.on = true;
  let r; try { r = playGame({ ...spec, hostOpts }); } finally { hostMode.on = false; }
  return [...lines, ...finalLines(r)];
}
function playOld(spec) {
  const lines = []; let eng = null, stop = null, n = 0;
  const onStart = () => {
    eng = createEngine(g);
    stop = eng.observe((e) => { // called when the move is over; failed moves are dropped by observe, they never change the state
      n++;
      lines.push(`${n} s${e.a.actor} ${e.prompt?.kind} ${actionKey(e.a)} ok=${e.ok} legal=${e.legal?.ok} chance=${sj(e.chance)} state=${stateHash(g.serializeState())} rc=${randomCalls()}`);
    });
  };
  let r; hostMode.on = false;
  try { r = playGame({ ...spec, onStart }); } finally { if (stop) stop(); if (eng) eng.dispose(); }
  return [...lines, ...r.log.map((l, i) => `L${i} ${l}`), ...finalLines(r)];
}

const hostOk = (s) => s.mode !== "rush"; // Rush has no host route (timers)
const out = { old: {}, host: {} }, t0 = Date.now(), bad = [];
for (const spec of ALL) {
  if (!routeOnly || routeOnly === "old") out.old[spec.id] = playOld(spec);
  if (hostOk(spec) && (!routeOnly || routeOnly === "host")) {
    const ev = playHostEvents(spec, false);
    out.host[spec.id] = ev;
    if (!regen && !process.argv.includes("--no-quiet-check")) {
      const q = playHostEvents(spec, true), strip = ev.map((l) => l.replace(/ EV .*$/, ""));
      if (sj(q) !== sj(strip)) { const i = strip.findIndex((l, k) => l !== q[k]); bad.push(`${spec.id}: quiet apply differs at line ${i}\n   events: ${strip[i]}\n   quiet:  ${q[i]}`); }
    }
  }
  process.stdout.write(`. ${spec.id} (${out.old[spec.id]?.length ?? "-"} old lines, ${out.host[spec.id]?.length ?? "-"} host lines)\n`);
}
const file = (route) => here + route + ".txt.gz";
const pack = (o) => zlib.gzipSync(Object.entries(o).map(([id, ls]) => `## ${id}\n${ls.join("\n")}\n`).join(""), { level: 9 });
const unpack = (buf) => { const m = {}; let cur = null; for (const l of zlib.gunzipSync(buf).toString("utf8").split("\n")) { if (l.startsWith("## ")) m[(cur = l.slice(3))] = []; else if (cur && l !== "") m[cur].push(l); } return m; };
if (regen) {
  for (const r of ["old", "host"]) if (!routeOnly || routeOnly === r) { if (only) { const prev = fs.existsSync(file(r)) ? unpack(fs.readFileSync(file(r))) : {}; fs.writeFileSync(file(r), pack({ ...prev, ...out[r] })); } else fs.writeFileSync(file(r), pack(out[r])); }
  console.log("baseline written"); process.exit(0);
}
let checked = 0;
for (const r of ["old", "host"]) {
  if (routeOnly && routeOnly !== r) continue;
  const want = fs.existsSync(file(r)) ? unpack(fs.readFileSync(file(r))) : {};
  for (const [id, ls] of Object.entries(out[r])) {
    checked++; const w = want[id];
    if (!w) { bad.push(`${r}/${id}: no baseline`); continue; }
    if (sj(w) === sj(ls)) continue;
    const i = ls.findIndex((l, k) => l !== w[k]), k = i < 0 ? ls.length : i;
    bad.push(`${r}/${id}: differs at line ${k} (got ${ls.length} lines, want ${w.length})\n   got:  ${(ls[k] ?? "<end>").slice(0, 400)}\n   want: ${(w[k] ?? "<end>").slice(0, 400)}`);
  }
}
console.log(bad.length ? bad.join("\n") + `\n${bad.length} FAILED of ${checked}` : `ALL ${checked} MATCH (event golden) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(bad.length ? 1 : 0);
