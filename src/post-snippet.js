// v1.99.2 the board snippet of a real-error card (docs/design/analysis-v199.md, Lesson 1: "a board snippet with the played move and the better move ringed").
// One small crop of the real board per move that has a spot or a road: what you did (when it had one) next to what was better.
// A move with no spot (End turn, a bank trade) shows only the better one. No board (Seafarers, 5-6 players, old saves): nothing.
// Called by errorCard() in post-ui.js: errorSnippet(board, e, didWord) -> html ("" when there is nothing to draw).
import { cropSvg } from "./lessons-view.js";

const spot = (s) => (Array.isArray(s) && (s[0] === "n" || s[0] === "e" || s[0] === "h") && Number.isFinite(s[1]) ? s : null);

/** a city has its own focus key ({ city: node }); the model's spec only knows node / edge / hex */
const cityOf = (f) => (Number.isFinite(f?.city) ? ["n", f.city] : null);

export function errorSnippet(board, e, did = "You did") {
  if (!board || !e) return "";
  const p = spot(e.p) || cityOf(e.d?.x?.focus), q = spot(e.q) || cityOf(e.d?.x?.best?.focus);
  if (!p && !q) return "";
  const fig = (s, color, label, cap) => {
    let svg = "";
    try { svg = cropSvg(board, s, { w: 120, color, label }); } catch (_) { return ""; }
    return `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
  };
  const a = p ? fig(p, "#B45A3C", did, did) : "", b = q ? fig(q, "#2F7D6B", "Better", "Better (A)") : "";
  return a || b ? `<div class="px-crops${a && b ? "" : " one"}">${a}${b}</div>` : "";
}
