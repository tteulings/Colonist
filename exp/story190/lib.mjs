import fs from "fs";
import { unpackRecs } from "../wt-190/src/review/pack.js";
export const UP = "/root/.claude/uploads/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/";
export const EXP = { mwg5v7k7j2cc: "867ad748-colonist-2026-11-14-mwg5v7k7j2cc.json", mwg74y2d49gz: "72eb9b87-colonist-2026-11-14-mwg74y2d49gz.json", mwb26snvis5o: "c96a5156-colonist-2026-11-11-mwb26snvis5o.json" };
export const DIR = new URL("./data/", import.meta.url).pathname;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export function load(id) {
  const E = JSON.parse(fs.readFileSync(UP + EXP[id])), recs = unpackRecs(E.rv.recs), A = JSON.parse(fs.readFileSync(DIR + id + ".A.json")), n = E.state.players.length;
  const fin = Array.from({ length: n }, (_, q) => (q === E.state.winnerId ? 1 : 0));
  const W = A.W.slice(); W.push(Array.from({ length: A.F }, () => fin)); // W[i] = futures x seats ; last = final result
  const V = W.map((w) => (w ? Array.from({ length: n }, (_, q) => mean(w.map((f) => f[q]))) : null));
  const names = E.state.players.map((p) => p.name), me = E.state.players.findIndex((p) => !p.isAI && p.isHuman) ;
  return { id, E, recs, A, n, W, V, names, win: E.state.winnerId, steps: E.state.stats.steps, ev: E.state.stats.ev, me: me >= 0 ? me : 0 };
}
/** step delta with its standard error (paired futures): { d: [seats], se: [seats] } */
export function delta(G, i) {
  const a = G.W[i], b = G.W[i + 1]; if (!a || !b) return null; const F = Math.min(a.length, b.length), n = G.n, d = [], se = [];
  for (let q = 0; q < n; q++) { const x = Array.from({ length: F }, (_, j) => b[j][q] - a[j][q]), m = mean(x); d.push(m); se.push(Math.sqrt(x.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, F - 1) / F)); }
  return { d, se };
}
export const roundOf = (r) => (r.k === "setup" ? 1 : r.t);
