// Variant D "Jij tegen je grootste rivaal": language-neutral model built on the real analysis data (analyseGame + decisionsOf).
// usage: node extract.mjs POST199_DIR CALIB_DIR OUT_JSON      (reads tests/fixtures/post199/r1,r2 and calib199/*.json.gz)
import fs from "fs"; import path from "path"; import zlib from "zlib";
const [,, POST, CALIB, OUT] = process.argv;
const { analyseGame, decisionsOf, bestMoves } = await import(path.resolve(POST, "src/review/analysis-facts.js"));
const THR = { start: 5, dots: 3, city: 3, pts: 1, cost: 5, luck: 8 };            // a gap counts as a real difference from this size (score = gap / THR)
const ORDER = ["start", "dots", "city", "pts", "cost", "luck"];                  // game-flow order of the rows on screen
const LOWER_BETTER = { city: true, cost: true };

export function whyD(game) {
  const { meta, state, rv } = game, me = meta.me, names = meta.seats.map((s) => s.name);
  const a = analyseGame({ state, rv: { reviews: rv.reviews, luck: rv.luck, rk: rv.rk }, me, winner: meta.winner, names });
  if (!a || !a.you) return null;
  const n = a.n, tot = a.points.total, won = a.points.won;
  // the strongest OTHER player: most game points (final incl. hidden cards); tie -> the actual winner, then the more accurate one. Winner if you lost, runner-up if you won.
  const others = [...Array(n).keys()].filter((q) => q !== me).sort((x, y) => tot[y] - tot[x] || (a.points.winner === y ? -1 : a.points.winner === x ? 1 : 0) || (a.bySeat[y]?.acc ?? 0) - (a.bySeat[x]?.acc ?? 0));
  const rv_ = others[0], side = won ? "me" : "rival";                            // side = who the RESULT favours
  const setupWin = (q) => { const ds = decisionsOf(rv.reviews[q], n, q).ds.filter((d) => d.k === "setup").sort((x, y) => x.i - y.i); return ds.length ? ds[Math.min(1, ds.length - 1)].B : null; };
  const cand = [];
  const add = (id, m, r, extra = {}) => { if (m == null || r == null) return; const d = r - m; cand.push({ id, me: m, rival: r, gap: Math.abs(d), ...extra, better: id === "x" ? null : null, _d: d }); };
  add("start", setupWin(me), setupWin(rv_));
  if (a.start) add("dots", a.start[me].total, a.start[rv_].total, { missMe: a.start[me].missing, missRival: a.start[rv_].missing });
  const fc = (q) => a.facts?.[q]?.firstCity, fm = fc(me), fr = fc(rv_);
  if (fm != null && fr != null) add("city", fm, fr);
  else if ((fm == null) !== (fr == null) && a.T >= 12) { const T1 = a.T + 1; cand.push({ id: "city", me: fm, rival: fr, gap: Math.abs((fr ?? T1) - (fm ?? T1)), _d: (fr ?? T1) - (fm ?? T1) }); }
  // points per phase: only the phase where the two differ most (one row, not three)
  let bp = null; a.tempo?.phases.forEach((ph) => { if (ph.empty) return; const d = ph.gain[rv_] - ph.gain[me]; if (!bp || Math.abs(d) > Math.abs(bp._d)) bp = { id: "pts", phase: ph.id, from: ph.from, to: ph.to, me: ph.gain[me], rival: ph.gain[rv_], gap: Math.abs(d), _d: d }; });
  if (bp) cand.push(bp);
  const cs = (q) => a.bySeat[q]?.cost; if (cs(me) != null && cs(rv_) != null) add("cost", cs(me), cs(rv_));
  const lk = (q) => a.luck[q]?.total; if (lk(me) != null && lk(rv_) != null) add("luck", lk(me), lk(rv_));
  cand.forEach((c) => { c.score = c.gap / THR[c.id]; const lowBetter = !!LOWER_BETTER[c.id], d = c._d;   // d>0: rival's number is bigger
    c.better = c.score < 1 ? "eq" : (d > 0) === lowBetter ? "me" : "rival"; delete c._d; });
  let rows = cand.filter((c) => c.score >= 1).sort((x, y) => y.score - x.score).slice(0, 4);
  if (rows.length < 3) rows = [...rows, ...cand.filter((c) => c.score < 1).sort((x, y) => y.score - x.score)].slice(0, 3);
  rows.sort((x, y) => ORDER.indexOf(x.id) - ORDER.indexOf(y.id));
  const dec = rows.filter((c) => c.better === side).sort((x, y) => y.score - x.score)[0] || null;
  if (dec) dec.decisive = true;
  // the measured moment: your own move, in win chance
  let moment = null;
  const lab = (d) => d?.x?.label || "", ds = a.you.ds.filter((d) => d.cls !== "triv" && d.kind !== "robber");  // no robber moves in the moment (v1.99 scope)
  if (!won) { const d = [...ds].sort((x, y) => y.gp - x.gp || x.i - y.i)[0]; if (d && d.gp >= 3) moment = { kind: "loss", turn: d.t, setup: d.k === "setup", clear: d.vc === "clear" && ["could", "mistake", "blunder", "missed"].includes(d.cls), cls: d.cls, played: lab(d), better: d.x.best?.label || null, B: d.B, A: d.A, gp: d.gp }; }
  else { const b = bestMoves(a.you.ds.filter((d) => d.kind !== "robber"), 1)[0]; if (b && b.gain >= 3) moment = { kind: "gain", turn: b.d.t, setup: b.d.k === "setup", cls: b.d.cls, played: lab(b.d), B: b.d.B, gain: b.gain }; }
  return { won, me, rival: rv_, names, n, T: a.T, pts: [tot[me], tot[rv_]], target: a.target, side, rows, decisive: dec?.id ?? null, moment, nCand: cand.length };
}

const out = {}, fx = path.join(POST, "tests/fixtures/post199");
for (const f of ["r1", "r2"]) out[f] = whyD(JSON.parse(fs.readFileSync(path.join(fx, f + ".json"))));
for (const f of fs.readdirSync(CALIB).filter((x) => x.endsWith(".json.gz")).sort()) {
  try { const g = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(CALIB, f)))); out[f.replace(".json.gz", "")] = whyD(g); } catch (e) { out[f] = { error: String(e).slice(0, 120) }; }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k.slice(0, 40).padEnd(40), v?.error || (v ? `${v.won ? "W" : "L"} ${v.pts.join("-")} rows ${v.rows.map((r) => r.id + (r.decisive ? "*" : "") + ":" + r.better[0]).join(",")} mom ${v.moment ? v.moment.kind + v.moment.gp : "-"}${v.moment?.gain ?? ""}` : "null"));
