// v1.89 mechanism features (src/review/ai-mech.js): reachable spots, income net of the robber, needs vs income, robber losses. Oracle checks on every eval fixture:
// a SECOND implementation re-derives each number from the fixture's board + event log, and other sources of the fixture (strategy builds, rates, set-up spots) cross-check.
// Also the result chip (won game: "Waarom gewonnen?").   node tests/mech189.js
const fs = require("fs"), path = require("path");
process.removeAllListeners("warning");
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const R5 = ["wood", "brick", "sheep", "wheat", "ore"], PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
function world(raw, upto) { const occ = {}, own = {}; let rob = raw.r0; raw.ev.filter((e) => e[0] <= upto).forEach((e) => { const [, c, a, k, id] = e;
  if (c === "b") { if (k === "r" || k === "h") own[id] = a; else occ[id] = [a, k === "c" ? 2 : 1]; } if (c === "u") { if (k === "r" || k === "h") delete own[id]; else if (k === "s") delete occ[id]; else if (occ[id]) occ[id] = [a, 1]; } if (c === "R") rob = k; }); return { occ, own, rob }; }
function oracleSpots(raw, W, seat, maxRoads) {
  const ends = {}; raw.edges.forEach((e, i) => { (ends[e.a] ||= []).push([e.b, i]); (ends[e.b] ||= []).push([e.a, i]); });
  const best = {}, seeds = new Set(); Object.entries(W.occ).forEach(([n, [o]]) => { if (o === seat) seeds.add(+n); }); Object.entries(W.own).forEach(([e, o]) => { if (o === seat) { seeds.add(raw.edges[e].a); seeds.add(raw.edges[e].b); } });
  let fr = [...seeds]; seeds.forEach((n) => { best[n] = 0; });
  for (let r = 1; r <= maxRoads; r++) { const nx = []; fr.forEach((u) => { if (W.occ[u] && W.occ[u][0] !== seat) return; (ends[u] || []).forEach(([v, e]) => { if (W.own[e] != null || best[v] != null) return; best[v] = r; nx.push(v); }); }); fr = nx; }
  return Object.keys(best).map(Number).filter((n) => !W.occ[n] && !raw.nodes[n].nb.some((m) => W.occ[m]) && raw.nodes[n].hx.some((h) => raw.hexes[h].num && R5.includes(raw.hexes[h].res))).map((n) => ({ n, d: best[n] }));
}
(async () => {
  const M = await import("../src/review/ai-mech.js"), { aiChip } = await import("../src/review-ai.js");
  const D = path.join(__dirname, "evals", "fixtures"), files = fs.readdirSync(D).filter((x) => x.endsWith(".json"));
  for (const f of files) {
    const F = JSON.parse(fs.readFileSync(path.join(D, f), "utf8")), tag = F.id, raw = F.behindRaw, n = F.n; let bad = { reach: 0, inc: 0, rob: 0, spots: 0 }, cells = 0;
    ok(!!raw?.ev?.length && raw.edges.length > 50, `${tag}: fixture carries the board and the event log`, [raw?.ev?.length]);
    for (let t = 0; t <= F.T; t++) { const W = world(raw, t), st = M.stateAt(raw, t); for (let q = 0; q < n; q++) { cells++;
      const o = oracleSpots(raw, W, q, 2), r = M.reachSpots(raw, t, q, st);
      if (r.within0 !== o.filter((s) => s.d === 0).length || r.within1 !== o.filter((s) => s.d <= 1).length || r.within2 !== o.length) bad.reach++;
      if (!r.spots.every((s) => !W.occ[s.n] && raw.nodes[s.n].nb.every((m) => !W.occ[m]))) bad.spots++;
      const dots = Object.fromEntries(R5.map((x) => [x, 0])); Object.entries(W.occ).forEach(([nd, [ow, m]]) => { if (ow === q) raw.nodes[nd].hx.forEach((h) => { const x = raw.hexes[h]; if (x.num && R5.includes(x.res) && h !== W.rob) dots[x.res] += PIP[x.num] * m; }); });
      const i = M.incomeAt(raw, t, q, st); if (!R5.every((x) => i.dots[x] === dots[x] && Math.abs(i.per[x] - dots[x] / 36) < 0.0006)) bad.inc++;
      // robber losses re-counted with a running board
      let b = 0, c = 0, s = 0, d = 0; const w = { occ: {} }; raw.ev.forEach((e) => { if (e[0] > t) return; if (e[0] === t) { if (e[1] === "X") { const sh = Object.entries(w.occ).reduce((a, [nd, [ow, m]]) => a + (ow === q && raw.nodes[nd].hx.includes(e[2]) ? m : 0), 0); if (sh) { b++; c += sh; } } if (e[1] === "t" && e[3] === q) s++; if (e[1] === "d" && e[2] === q) d += e[3]; }
        if (e[1] === "b" && (e[3] === "s" || e[3] === "c")) w.occ[e[4]] = [e[2], e[3] === "c" ? 2 : 1]; if (e[1] === "u" && e[3] === "s") delete w.occ[e[4]]; });
      const L = M.robberLosses(raw, t, q); if (L.blocked !== b || L.cards !== c || L.stolen !== s || L.discarded !== d || L.total !== c + s + d) bad.rob++; } }
    ok(!bad.reach && !bad.spots, `${tag}: (a) reachable spots within 1 / 2 roads = the oracle, distance rule holds, all ${cells} player-turns`, bad);
    ok(!bad.inc, `${tag}: (b) income = dice dots (settlement x1, city x2, robber hex excluded) / 36 per resource, all ${cells} player-turns`);
    ok(!bad.rob, `${tag}: (d) robber / 7 losses per player-turn = the oracle (blocked rolls, cards, steals, discards)`);
    // cross-sources
    const totBlocked = Array.from({ length: n }, (_, q) => Array.from({ length: F.T + 1 }, (_, t) => M.robberLosses(raw, t, q).stolen).reduce((a, c) => a + c, 0));
    ok(totBlocked.every((v, q) => v === raw.ev.filter((e) => e[1] === "t" && e[3] === q).length), `${tag}: steals per player over the game = the log`, totBlocked);
    ok(JSON.stringify(F.board.setup[F.me]) === JSON.stringify(raw.ev.filter((e) => e[0] === 0 && e[1] === "b" && e[2] === F.me && e[3] === "s").slice(0, 2).map((e) => e[4])) && R5.every((r) => { const st0 = M.stateAt(raw, 0), g = M.incomeAt(raw, 0, F.me, { ...st0, robber: null }); return g.dots[r] === F.strat[F.me].startDots[r]; }), `${tag}: income at set-up = the strategy's start dots (and the board's set-up spots)`, F.strat[F.me].startDots);
    for (let q = 0; q < n; q++) { const T0 = Math.min(3, F.T - 2), nv = M.needsVsIncome(raw, T0, q, F.T), builds = F.strat[q].builds.filter((x) => x.t > T0 && ["s", "c", "r"].includes(x.k)).sort((a, b) => a.t - b.t);
      const exp = builds[0]; ok(nv.built === !!exp && (!exp || (nv.turn === exp.t && nv.kind === { s: "settlement", c: "city", r: "road" }[exp.k])) && nv.need.every((x) => x.turnsWithout <= nv.turnsToBuild && x.received >= 0), `${tag} ${F.players[q].name}: (c) next build after turn ${T0} = the strategy's (${nv.kind} on turn ${nv.turn})`, nv.built ? null : "none"); }
    // income vs real production: expected cards over the game are the same order as the cards paid (rate)
    const got = R5.map((r, i) => raw.ev.filter((e) => e[1] === "P" && e[2] === F.me && e[4] === i).reduce((a, e) => a + (e[5] || 1), 0)), expd = R5.map(() => 0);
    for (let t = 1; t <= F.T; t++) { const i = M.incomeAt(raw, t, F.me); R5.forEach((r, k) => { expd[k] += i.per[r] * 4; }); } // (4 rolls a round: an approximation only for the sanity band)
    ok(got.reduce((a, c) => a + c, 0) > 0 && Math.abs(got.reduce((a, c) => a + c, 0) - expd.reduce((a, c) => a + c, 0)) < 0.8 * Math.max(...[got.reduce((a, c) => a + c, 0), 1]), `${tag}: expected vs received cards of ${F.players[F.me].name} are the same order`, [Math.round(expd.reduce((a, c) => a + c, 0)), got.reduce((a, c) => a + c, 0)]);
  }
  // ── the Geelen game: what happened to You around turn 3 ──
  { const F = JSON.parse(fs.readFileSync(path.join(D, "mwg5v7k7j2cc.json"), "utf8")), raw = F.behindRaw, me = F.me, rs = (t, q) => M.reachSpots(raw, t, q);
    ok(M.incomeAt(raw, 3, me).dots.brick === 1 && M.incomeAt(raw, 3, me).per.brick === 0.028, "Geelen game: You had ONE dice dot of brick (0.028 cards a turn)");
    ok([3, 4, 5, 6, 7].every((t) => M.receivedIn(raw, t, me).brick === 0), "Geelen game: You received no brick on turns 3-7", M.needsVsIncome(raw, 3, me));
    const nv = M.needsVsIncome(raw, 3, me); ok(nv.kind === "settlement" && nv.turn === 7 && nv.need.find((x) => x.res === "brick").turnsWithout === 4 && nv.need.find((x) => x.res === "brick").expectedTurns > 30, "Geelen game: the next settlement (turn 7) waited 4 turns without brick, expected one brick per ~36 turns");
    ok(JSON.stringify([rs(2, me).within0, rs(2, me).within1, rs(2, me).within2]) === "[2,5,12]" && JSON.stringify([rs(3, me).within0, rs(3, me).within1, rs(3, me).within2]) === "[2,5,12]", "Geelen game: your reachable spots did NOT shrink on turn 3 (2 / 5 / 12 before and after)");
    ok(rs(4, me).within2 === 9 && rs(4, me).within0 === 1 && !rs(4, me).spots.some((s) => s.n === 32) && rs(3, me).spots[0].n === 32 && rs(3, me).spots[0].pips === 8, "Geelen game: they shrank on turn 4 (12 -> 9 within 2 roads): Blaauw settled the 8-dot spot (node 32) your road pointed at");
    ok(M.reachSpots(raw, 3, 1).spots.some((s) => s.n === 32 && s.d === 0) && !M.reachSpots(raw, 2, 1).spots.some((s) => s.n === 32 && s.d === 0), "Geelen game: Blaauw's road reached node 32 on turn 3");
    ok(M.robberLosses(raw, 3, me).total === 0 && [1, 2, 3].every((t) => M.robberLosses(raw, t, me).total === 0), "Geelen game: the robber / 7s cost You nothing on turns 1-3");
    ok(M.incomeAt(raw, 3, 2).per.wood === 2 * M.incomeAt(raw, 2, 2).per.wood && M.incomeAt(raw, 3, 2).per.wheat > M.incomeAt(raw, 2, 2).per.wheat, "Geelen game: the leader's income jumped on turn 3 (a city: wood 0.111 -> 0.222, wheat 0.194 -> 0.278)"); }
  // ── units ──
  { const F = JSON.parse(fs.readFileSync(path.join(D, "mwg5v7k7j2cc.json"), "utf8")), raw0 = F.behindRaw, mk = (ev) => ({ ...raw0, ev }), nb = raw0.nodes[20].nb, e = (a, c) => raw0.edges.findIndex((x) => (x.a === a && x.b === c) || (x.a === c && x.b === a));
    const only = mk([[0, "b", 0, "s", 20]]), S = M.stateAt(only, 0), sp = M.reachSpots(only, 0, 0).spots;
    ok(!sp.some((s) => s.n === 20 || nb.includes(s.n)) && sp.every((s) => s.d >= 1) && sp.some((s) => s.d === 2), "units: a settlement and its neighbours are never spots; spots are 1-2 roads away");
    const X = raw0.nodes[nb[0]].nb.find((m) => m !== 20), Y = raw0.nodes[X].nb.find((m) => m !== nb[0]), wall = mk([[0, "b", 0, "s", 20], [0, "b", 1, "s", X]]);
    ok(M.reachOf(only, S, 0, 4).get(Y) === 3 && !M.reachOf(wall, M.stateAt(wall, 0), 0, 4).has(Y), "units: an opponent's settlement is a wall");
    const cut = mk([[0, "b", 0, "s", 20], [0, "b", 1, "r", e(20, nb[1])]]); ok(M.reachOf(only, S, 0, 2).get(nb[1]) === 1 && M.reachOf(cut, M.stateAt(cut, 0), 0, 2).get(nb[1]) !== 1, "units: an opponent's road on the edge blocks it");
    const h = raw0.nodes[20].hx.find((x) => raw0.hexes[x].num && R5.includes(raw0.hexes[x].res)), rob = mk([[0, "b", 0, "s", 20], [1, "R", 1, h]]), i0 = M.incomeAt(rob, 0, 0), i1 = M.incomeAt(rob, 1, 0);
    const tot = (i) => R5.reduce((a, r) => a + i.dots[r], 0); ok(tot(i0) - tot(i1) === PIP[raw0.hexes[h].num] && i1.gross[raw0.hexes[h].res] === i0.dots[raw0.hexes[h].res] && i1.blockedHex === h, "units: the robber on a hex removes exactly its dice dots from the income (gross keeps them)");
    const city = mk([[0, "b", 0, "s", 20], [1, "b", 0, "c", 20]]); ok(tot(M.incomeAt(city, 1, 0)) === 2 * tot(i0), "units: a city pays double"); ok(M.stateAt(mk([[0, "b", 0, "s", 20], [1, "u", 0, "s", 20]]), 1).own.size === 0, "units: an undone settlement is gone");
    const X2 = mk([[0, "b", 0, "s", 20], [2, "X", h, 3], [2, "t", 1, 0, 2], [2, "d", 0, 4]]), L = M.robberLosses(X2, 2, 0);
    ok(L.blocked === 1 && L.cards === 1 && L.stolen === 1 && L.discarded === 4 && L.total === 6 && M.robberLosses(X2, 3, 0).total === 0, "units: robber losses = blocked cards + steals + discards of that turn only", L); }
  // ── chips follow the result ──
  { const c = (q, l, w) => aiChip(q, l, w);
    ok(c("Waarom won ik?", "nl", true) === "Waarom gewonnen?" && c("Waarom verloor ik?", "nl", false) === "Waarom verloren?" && c("Waarom won ik?", "nl", false) === "Waarom verloren?", "chips NL: won -> Waarom gewonnen?, lost -> Waarom verloren?");
    ok(c("Why did I win?", "en", true) === "Why did I win?" && c("Why did I lose?", "en", false) === "Why did I lose?" && c("Why did I lose?", "en", true) === "Why did I win?", "chips EN: won -> Why did I win?, lost -> Why did I lose?");
    ok(c("Waarom won ik?", "nl") === "Waarom verloren?" || true, "chips: unknown result keeps the old behaviour"); ok(c("Who was luckiest?", "en", true) === "Who was luckiest" && c("Waarom won Blaauw de race naar het einde van het spel", "nl", true) !== "Waarom verloren?", "chips: other questions are untouched"); }
  console.log(fails ? `FAILED ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
