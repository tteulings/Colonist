// Small helpers shared by the B/C art modules: canvas piece specs <-> SVG, path transforms.
// A "spec" is a list of primitive shapes in art units that board-renderer.js draws with Path2D:
// { d | el:"ellipse"/"circle", fill, stroke, sw, cap, op, body, shadow }.
import { f } from "./art-util.js";

/** Serialise a canvas spec to SVG markup (DOM icons use the same shapes as the board). */
export function specSvg(spec) {
  return spec.map((s) => {
    const paint = `fill="${s.fill || "none"}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw || 1}" stroke-linejoin="round"` : ""}${s.cap ? ` stroke-linecap="${s.cap}"` : ""}${s.op != null ? ` opacity="${s.op}"` : ""}`;
    if (s.el === "ellipse") return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${paint}/>`;
    if (s.el === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
    return `<path d="${s.d}" ${paint}/>`;
  }).join("");
}

/** Polygon point list → closed path. */
export const poly = (pts) => "M" + pts.map(([x, y]) => f(x) + "," + f(y)).join(" L") + "Z";

/**
 * Scale (s, with optional horizontal flip) and translate an SVG path. Handles M L H V C S Q T Z in
 * both absolute and relative form (no arcs) — enough for the hand-drawn silhouettes.
 */
export function tp(d, s = 1, tx = 0, ty = 0, flip = 1) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let out = "", cmd = "", i = 0;
  const sx = s * flip;
  const num = () => +toks[i++];
  const X = (v, rel) => f(rel ? v * sx : v * sx + tx), Y = (v, rel) => f(rel ? v * s : v * s + ty);
  const ARGS = { M: "xy", L: "xy", T: "xy", H: "x", V: "y", C: "xyxyxy", S: "xyxy", Q: "xyxy", Z: "" };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) { cmd = toks[i++]; out += cmd; if (/z/i.test(cmd)) continue; }
    const up = cmd.toUpperCase(), rel = cmd !== up, pat = ARGS[up];
    if (pat == null) throw new Error("tp: unsupported path command " + cmd);
    const parts = [];
    for (const c of pat) parts.push(c === "x" ? X(num(), rel) : Y(num(), rel));
    out += parts.join(",") + " ";
    if (up === "M") cmd = rel ? "l" : "L";
  }
  return out.trim();
}

/** Mix two #rrggbb colours (t = 0 → a, 1 → b). */
export function mix(a, b, t) {
  const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
