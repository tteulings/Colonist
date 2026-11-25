// Builds tests/fixtures/analysis199-games.json.gz, the REAL games of tests/analysis199.js (node tests/evals/build-analysis199.mjs).
//  - reviewed: the saved reviewed game of tests/fixtures/ui191-game.json (4 players, all four seats reviewed, with the review's luck run and the recorder's own vp series)
//  - log: the three real games of tests/evals/ledger (full event log, no review results; final points from tests/evals/fixtures/<id>.json meta.pts)
// Only what the analysis reads is kept (state: board, players' final points, settings, stats; rv: reviews + luck).
import fs from "node:fs"; import zlib from "node:zlib";
const here = new URL("./", import.meta.url).pathname, fx = here + "../fixtures/";
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const games = [];
const u = J(fx + "ui191-game.json"), st = u.state, S = st.stats;
games.push({ id: u.meta.id, kind: "reviewed", n: S.n, me: u.meta.me, target: st.settings.winPoints, meta: { id: u.meta.id, me: u.meta.me, winner: u.meta.winner, result: u.meta.result, turns: u.meta.turns, acc: u.meta.acc, mode: u.meta.mode, pts: u.meta.pts, seats: u.meta.seats, rk: u.meta.rk },
  state: { hexes: st.hexes.map((h) => ({ resource: h.resource, number: h.number })), players: st.players.map((p) => ({ name: p.name, victoryPoints: p.victoryPoints })), settings: { winPoints: st.settings.winPoints, mode: st.settings.mode }, winnerId: st.winnerId, stats: S },
  rv: { reviews: u.rv.reviews, luck: u.rv.luck } });
for (const f of fs.readdirSync(here + "ledger").filter((x) => x.endsWith(".json")).sort()) {
  const l = J(here + "ledger/" + f), ev = J(here + "fixtures/" + f);
  games.push({ id: l.id, kind: "log", n: l.n, me: l.me, target: 10, finalPts: ev.meta.pts, names: l.names, winner: l.winner,
    state: { hexes: l.hexes.map((h) => ({ resource: h.resource, number: h.number })), players: l.names.map((name, q) => ({ name, victoryPoints: ev.meta.pts[q] })), settings: { winPoints: 10 }, winnerId: l.winner, stats: { v: 1, n: l.n, steps: l.steps, vp: null, ev: l.ev, r0: Math.max(0, l.hexes.findIndex((h) => h.resource === "desert")) } } });
}
const out = new URL("../fixtures/analysis199-games.json.gz", import.meta.url).pathname;
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify({ v: 1, games }), { level: 9 }));
console.log("wrote", out, fs.statSync(out).size, "bytes,", games.length, "games");
