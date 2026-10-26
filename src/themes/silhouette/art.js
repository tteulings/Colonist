// THEME C — "Silhouette" (after the graphic Dutch picture-book tradition of Fiep Westendorp)
// Rules of the medium: flat fields of gouache colour with slightly hand-cut edges, every figure a
// solid Indian-ink silhouette (detail only where it tells: an eye dot, a window), white paper
// everywhere else, one UI accent (vermilion). Ported from the approved mockup
// (scratchpad/themes/C/c-art.js, c-ui.js) onto the shared board renderer, with the board learnings
// applied: calm tiles (a few silhouettes above the number, nothing that looks like a house), pieces in
// the seat colours with a dark same-hue outline, continuous roads, robber beside the number.
// No characters or artworks are copied; figures are generic slender silhouettes.
import { f, rng, pipCount, wrap, RES_NAME, DEV_NAME, CARD_TEXT, RESOURCE_KEYS } from "../art-util.js";
import { specSvg, tp } from "../spec-util.js";
import { portrait } from "../portraits.js";

const B = "#1C1A19"; // Indian ink
const PA = "#FFF9EE"; // white-cream: only a highlight (tokens, eyes, wave curls)
const CREAM = "#FBF1DC"; // the paper of cards, beaches and chrome
const SEA = "#2E9FAC"; // one flat turquoise field (matches --c-sea in theme-silhouette.css)
const K = {
  orange: "#EC6A2C", red: "#D9412B", yellow: "#F5C02E", green: "#77B347", leaf: "#4E9A3E", lime: "#B7D257",
  turq: "#3BA7B8", sky: "#8FD0DC", blue: "#2F6BB3", pink: "#EE9AA8", sand: "#F1D6A4", ochre: "#E39B33", grey: "#8FA3B4", slate: "#5D7E99",
};
// Seats: identical to Sunny Island (light) so switching themes never recolours a player.
const PC = {
  blue: { base: "#3A76DC", dark: "#2557B0", light: "#7AA5F0", line: "#163777" },
  orange: { base: "#F68B3A", dark: "#BF6118", light: "#FBB57A", line: "#6E380C" },
  ivory: { base: "#FDFBF6", dark: "#C8BFAA", light: "#FFFFFF", line: "#4A443A" },
  plum: { base: "#A8306F", dark: "#7A1F50", light: "#D06A9E", line: "#3A0A24" },
};
const TEXT = { blue: "#2C5BA8", orange: "#A65314", ivory: "#7D6D4C", plum: "#8E2560" }; // seat hues, darkened to AA on paper
const TC = { wood: [K.green, K.leaf], brick: [K.orange, "#C8502A"], sheep: [K.lime, "#9FC24A"], wheat: [K.yellow, K.ochre], ore: [K.grey, K.slate], desert: [K.sand, "#E6C48A"] };
const P = { ink: B, sand: PA, forest: [K.green], terra: [K.orange], pasture: [K.lime], wheat: [K.yellow], slate: [K.grey], desert: [K.sand] };

/* ---------- primitives (plain path / circle markup, Path2D-friendly) ---------- */
let R = rng(3);
const seed = (n) => { R = rng(n); };
const j = (a = 1) => (R() - 0.5) * 2 * a;
const st = (d, w = 1.4, c = B, x = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x ? " " + x : ""}/>`;
const fl = (d, c = B, x = "") => `<path d="${d}" fill="${c}"${x ? " " + x : ""}/>`;
const circ = (x, y, r, c = B) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}"/>`;
const smooth = (pts) => { const n = pts.length, m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2]; const s = m(n - 1); let d = `M${f(s[0])},${f(s[1])}`; for (let i = 0; i < n; i += 1) { const q = m(i); d += ` Q${f(pts[i][0])},${f(pts[i][1])} ${f(q[0])},${f(q[1])}`; } return d + "Z"; };
const blob = (cx, cy, rx, ry, n = 9, a = 0.07) => smooth(Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2, k = 1 + j(a); return [cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]; }));
const cut = (s) => `<g filter="url(#c-cut)">${s}</g>`;
const hexD = (r, cx = 0, cy = 0) => "M" + Array.from({ length: 6 }, (_, i) => { const a = ((60 * i - 30) * Math.PI) / 180; return f(cx + r * Math.cos(a)) + "," + f(cy + r * Math.sin(a)); }).join("L") + "Z";

/* person: feet at 0, ~26 tall, round head, slender limbs. Returned as spec items so the same figure
   can be an SVG silhouette on a tile and a canvas piece (the robber). */
function personItems(o = {}) {
  const w = 1.5, it = [];
  const F = (d, c = B) => it.push({ d, fill: c }), S = (d, sw = w, c = B) => it.push({ d, stroke: c, sw, cap: "round" }), Cc = (cx, cy, r, c = B) => it.push({ el: "circle", cx, cy, r, fill: c });
  Cc(0, -21.5, 4.6);
  const hat = o.hat || "hair";
  if (hat === "cap") F("M-4.8,-22.6 Q-4.6,-27.4 .4,-27.4 Q4.6,-27.2 5,-23.4 L8.2,-22.6 L4.6,-22 Z");
  if (hat === "helmet") { F("M-5,-22 Q-5,-28 0,-28 Q5,-28 5,-22 L6.6,-21.6 L-6.4,-21.6Z"); Cc(0, -27.6, 1.4, K.yellow); }
  if (hat === "beret") { F("M-5.4,-23.4 Q-3,-28.4 2,-27.6 Q6,-26.6 4.6,-24.2Z"); S("M1,-28 l.6,-1.6", 1); }
  if (hat === "scarf") F("M-5.4,-21 Q-6,-28 0,-27.8 Q6,-28 5.4,-21 Q5,-25 0,-25.4 Q-5,-25 -5.4,-21Z M-5,-19 l-3,4 l3.4,-1.2Z", o.hc || K.red);
  Cc(4.6, -21, 1.3);
  if (!o.mask) Cc(2, -22.6, 0.75, PA);
  F(o.dress ? "M-2.8,-17 Q-4.6,-10 -7,-4.6 L7,-4.6 Q4.6,-10 2.8,-17 Q0,-18 -2.8,-17Z" : "M-3,-17.2 Q-4.2,-12 -3.8,-7.6 L3.8,-7.6 Q4.2,-12 3,-17.2 Q0,-18.2 -3,-17.2Z", o.coat || B);
  const pose = o.pose || "stand";
  const legs = { stand: "M-1.6,-7.6 L-2,0 M1.8,-7.6 L2.4,0", walk: "M-1.4,-7.6 L-4.4,0 M1.6,-7.6 L4.4,-.4", push: "M-1,-7.6 L-5.6,0 M1.6,-7.6 L1.4,0", tiptoe: "M-1.4,-7.6 L-4.6,-1.4 L-3.6,.6 M1.6,-7.6 L4.6,-2 L7.4,-1" }[pose];
  S(o.dress ? "M-2.4,-4.6 L-2.6,0 M2.4,-4.6 L2.8,0" : legs);
  const arms = { stand: "M-3,-15.6 Q-5.4,-12 -5.4,-8.6 M3,-15.6 Q5.4,-12 5.6,-8.8", walk: "M-3,-15.6 Q-6,-12.6 -7.4,-10 M3,-15.6 Q6.4,-13.6 8.4,-11.4", push: "M3,-15 Q6.4,-13 9.4,-12.6 M-2,-15 Q3,-12.6 9,-12", wave: "M-3,-15.6 Q-5.4,-12 -5.4,-8.6 M3,-15.6 Q7,-19 8.4,-25", tiptoe: "M-3,-15.6 Q-7,-14.6 -9.6,-11 M3,-15.6 Q6,-19 7.6,-23" }[o.arms || pose] || o.arms;
  S(arms);
  S(o.dress ? "M-2.6,0 h-2 M2.8,0 h2.2" : pose === "walk" ? "M-4.4,0 h-2.2 M4.4,-.4 h2.4" : pose === "tiptoe" ? "M-3.6,.6 h-1.6 M7.4,-1 h1.8" : "M-2,0 h-2.2 M2.4,0 h2.4", 1.8);
  if (o.mask) { F("M-4.2,-23.4 L5.4,-23.4 L5.4,-21.2 L-4.2,-21.2Z", PA); Cc(2.2, -22.3, 0.8); }
  if (o.tool) it.push(...o.tool);
  return it;
}
const TOOLS = {
  axe: [{ d: "M7.6,-11 L5.4,-25", stroke: B, sw: 1.3, cap: "round" }, { d: "M4.6,-25.4 L8.6,-27.6 L7.8,-22.6Z", fill: B }],
  crook: [{ d: "M5.6,-8.8 L8,-30 Q8.6,-34 11.4,-33 Q13,-31.6 11.6,-29.6", stroke: B, sw: 1.2, cap: "round" }],
  scythe: [{ d: "M5.6,-8.8 L8,-30 M8,-30 Q1,-33.4 -6,-29.4", stroke: B, sw: 1.2, cap: "round" }],
  pick: [{ d: "M8,-11.4 L11,-22 M7,-23.4 Q10.6,-24.4 14,-21", stroke: B, sw: 1.3, cap: "round" }],
  lantern: [{ d: "M5.6,-8.8 l0,1.6", stroke: B, sw: 1, cap: "round" }, { d: "M3.6,-7.4 h4 v5 h-4Z", fill: K.yellow, stroke: B, sw: 0.9 }],
  sack: [{ d: "M6,-26 Q14,-32 16,-22 Q17,-14 9,-15 Q5,-17 6,-26Z", fill: B }],
};
const person = (x, y, o = {}) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f((o.s || 1) * (o.flip ? -1 : 1))} ${f(o.s || 1)})">${specSvg(personItems(o))}</g>`;
const tree = (x, y, h, kind = "round", c = B) => {
  let g;
  if (kind === "round") g = fl(`M-1.2,0 Q-1,${f(-h * 0.4)} -.6,${f(-h * 0.6)} L.6,${f(-h * 0.6)} Q1,${f(-h * 0.4)} 1.6,0Z`, c) + fl(blob(0, -h * 0.74, h * 0.27, h * 0.28, 9, 0.05), c);
  else if (kind === "poplar") g = fl(`M-1,0 L-.6,${f(-h * 0.3)} L.6,${f(-h * 0.3)} L1,0Z`, c) + fl(`M0,${f(-h)} Q${f(h * 0.17)},${f(-h * 0.6)} ${f(h * 0.1)},${f(-h * 0.24)} Q0,${f(-h * 0.18)} ${f(-h * 0.1)},${f(-h * 0.24)} Q${f(-h * 0.17)},${f(-h * 0.6)} 0,${f(-h)}Z`, c);
  else if (kind === "pine") { const w = h * 0.3; g = fl(`M-1,0 L-1,${f(-h * 0.2)} L1,${f(-h * 0.2)} L1,0Z`, c) + fl(`M0,${f(-h)} L${f(w * 0.5)},${f(-h * 0.7)} L${f(w * 0.3)},${f(-h * 0.7)} L${f(w * 0.8)},${f(-h * 0.42)} L${f(w * 0.5)},${f(-h * 0.42)} L${f(w)},${f(-h * 0.16)} L${f(-w)},${f(-h * 0.16)} L${f(-w * 0.5)},${f(-h * 0.42)} L${f(-w * 0.8)},${f(-h * 0.42)} L${f(-w * 0.3)},${f(-h * 0.7)} L${f(-w * 0.5)},${f(-h * 0.7)}Z`, c); }
  else { g = fl(`M-2.4,0 Q-2,${f(-h * 0.3)} -2.6,${f(-h * 0.48)} L2.6,${f(-h * 0.48)} Q2,${f(-h * 0.3)} 2.6,0Z`, c); let rays = ""; for (let i = 0; i < 11; i += 1) { const a = ((-160 + i * 14) * Math.PI) / 180, L = h * (0.42 + R() * 0.15); rays += `M${f(-1.6 + i * 0.32)},${f(-h * 0.48)} Q${f(Math.cos(a) * L * 0.5)},${f(-h * 0.48 + Math.sin(a) * L * 0.7)} ${f(Math.cos(a) * L)},${f(-h * 0.48 + Math.sin(a) * L)}`; } g += st(rays, 1, c); }
  return `<g transform="translate(${f(x)} ${f(y)})">${g}</g>`;
};
const sheep = (x, y, s = 1, flip = 1, body = PA) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">${st("M-5,-3 L-5.4,2 M-2.2,-2.6 L-2,2.2 M3.4,-3 L3.2,2 M5.6,-3 L6.2,1.8", 1.3)}${fl(blob(0, -7, 9, 5.8, 10, 0.05), body)}${fl("M7,-10 Q11,-12.6 13.2,-9.6 Q14,-7 11.6,-5.8 Q8.6,-5.4 7.6,-7.6Z")}${fl("M8.6,-11 l-1.6,-2.4 l2.6,.8Z")}</g>`;
const dog = (x, y, s = 1, flip = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">${fl("M-6,-5 Q0,-7.4 5,-5.6 Q6.6,-9.6 9,-8.8 Q11,-7.8 10.6,-6.4 L8.2,-5.2 Q6,-3 5.4,-2.6 L-5.4,-2.4Z")}${st("M-5,-3 L-6,0 M-3,-3 L-2.6,0 M3,-3 L2.6,0 M5,-3 L5.8,0 M-6,-4.6 Q-9,-7 -8.6,-9.4", 1.2)}${circ(8.6, -7.4, 0.5, PA)}</g>`;
const cat = (x, y, s = 1, flip = 1, c = B) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">${fl("M-4,0 Q-5,-4.6 -2,-5.4 Q-1.6,-8.4 0,-8.6 L.6,-10.4 L1.6,-8.6 L2.6,-8.6 L3.4,-10.4 L3.8,-8.2 Q4.8,-6.6 3,-5 Q4,-2.4 3,0 Z", c)}${st("M-4,0 Q-8,-.6 -7.4,-5", 1.1, c)}${circ(1.2, -7, 0.5, K.yellow)}${circ(2.8, -7, 0.5, K.yellow)}</g>`;
const bird = (x, y, s = 1, c = B) => st(`M${f(x - 4 * s)},${f(y)} q${f(2 * s)},${f(-2.6 * s)} ${f(4 * s)},0 q${f(2 * s)},${f(-2.6 * s)} ${f(4 * s)},0`, 1.1 * Math.sqrt(s), c);
const pigeon = (x, y, s = 1, flip = 1, c = B) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">${fl("M-4.4,-2 Q-2,-5.6 1.6,-5.4 Q3.4,-7.2 4.8,-5.6 L6.2,-5 L4.6,-4.4 Q4.2,-1 0,0 Q-3,0 -4.4,-2 L-7,-1.4Z", c)}${st("M-.6,0 l-.4,1.8 M1,0 l.2,1.8", 0.8, c)}</g>`;
const bike = (x, y, s = 1, c = B) => `<g transform="translate(${x} ${y}) scale(${s})">${st("M-9,-5 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M9,-5 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M-9,-5 L-3,-12 L6,-12 L9,-5 M-3,-12 L0,-5 L-9,-5 M6,-12 L5,-15 h-3 M-4,-12 l-1,-2.4 h3.4", 1.1, c)}</g>`;
const stook = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${fl("M-6,0 L-1,-15 L1,-15 L6,0Z")}${st("M-1,-15 l-2.4,-3 M1,-15 l2.4,-3 M0,-15 v-3.6", 1)}</g>`;
const brickStack = (x, y, c = PA) => { let d = ""; for (let r = 0; r < 3; r += 1) for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k += 1) { const bx = x + k * 8 + (r % 2) * 4, by = y - r * 5; d += `M${bx},${by} h7 v-4 h-7Z`; } return fl(d, c); };
const camel = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${fl("M-22,0 L-21,-12 Q-24,-22 -14,-26 Q-8,-34 -2,-26 Q4,-34 10,-26 Q16,-22 16,-16 L22,-22 Q24,-34 30,-36 Q38,-38 40,-32 Q41,-28 37,-28 L33,-28 Q30,-22 24,-12 Q22,-8 18,-8 L-18,-8Z")}${st("M-18,-8 L-20,0 M-14,-8 L-13,0 M14,-8 L13,0 M18,-8 L20,0 M-21,-12 Q-27,-8 -27,-2", 1.8)}${circ(35, -33, 0.8, PA)}</g>`;

/* ---------- filters (static: baked by the browser when the board layer is rasterised) ---------- */
const filters = () => `
  <filter id="c-cut" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="c-coast" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed="17" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="c-gouache" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.3 .62"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;

/* ---------- tile scenes: calm — one colour field, a second flat shape, a few silhouettes above the
   number (tokens sit low, tokenDy 24). Nothing near the corners, nothing that reads as a house. ---------- */
const TS = {
  wood() {
    seed(11);
    let g = fl("M-90,6 Q-40,-14 10,-2 Q50,8 90,-8 L90,90 L-90,90Z", TC.wood[1]);
    for (const [x, y, h, k] of [[-52, -16, 34, "pine"], [-28, -24, 42, "round"], [-4, -30, 38, "pine"], [22, -24, 40, "round"], [48, -18, 34, "poplar"], [-62, 50, 26, "round"]]) g += tree(x, y, h, k);
    return g + bird(14, -74, 1) + bird(26, -79, 0.8);
  },
  brick() {
    seed(12);
    let g = fl("M-130,-8 Q-30,2 30,-6 Q60,-10 130,0 L130,130 L-130,130Z", TC.brick[1]);
    g += fl("M-62,-34 Q-36,-46 -8,-36 Q-30,-28 -62,-34Z", "#C8502A") + brickStack(36, -18) + brickStack(-62, 46);
    g += person(-30, -16, { pose: "push", hat: "cap", s: 1.25 }) + fl("M-48,-22 L-50,-28 L-34,-28 L-36,-22Z") + circ(-48, -19, 2.6);
    return g;
  },
  sheep() {
    seed(13);
    let g = fl("M-90,-30 Q-20,-44 30,-34 Q60,-28 90,-36 L90,-110 L-90,-110Z", "#C9DD72");
    g += sheep(-34, -14, 1.45) + sheep(30, -18, 1.35, -1) + sheep(-58, 42, 1.3);
    return g;
  },
  wheat() {
    seed(14);
    let g = "";
    for (let i = 0; i < 5; i += 1) g += fl(`M-95,${-14 + i * 22} Q0,${-24 + i * 22} 95,${-20 + i * 22} L95,${-12 + i * 22} Q0,${-16 + i * 22} -95,${-6 + i * 22}Z`, TC.wheat[1], 'opacity=".75"');
    g += stook(-50, -20, 1.1) + stook(-30, -30, 0.95) + stook(36, -26, 1) + stook(54, -16, 0.9);
    return g + bird(-12, -62, 1.2) + bird(2, -68, 0.9);
  },
  ore() {
    seed(15);
    let g = fl("M-76,8 L-54,-20 L-42,-14 L-22,-58 L-6,-40 L4,-46 L30,8Z", TC.ore[1]) + fl("M4,8 L28,-30 L40,-44 L52,-33 L58,-37 L76,8Z");
    g += fl("M-22,-58 L-6,-40 L-12,-35 L-26,-45Z", PA, 'opacity=".9"') + fl("M40,-44 L52,-33 L46,-29 L37,-38Z", PA, 'opacity=".9"');
    g += fl(blob(-56, 50, 10, 7)) + fl(blob(-42, 54, 6, 4));
    return g;
  },
  desert() {
    seed(16);
    let g = fl("M-95,-34 Q0,-74 95,-40 L95,-24 Q0,-54 -95,-18Z", TC.desert[1]) + fl("M-95,30 Q-20,0 95,24 L95,40 Q-20,14 -95,44Z", TC.desert[1]) + fl("M-95,80 Q0,52 95,76 L95,95 L-95,95Z", TC.desert[1]);
    return g + camel(-30, 6, 1.05);
  },
};

/* ---------- the board ---------- */
const boardDefs = () => filters();
/** The sea: one flat cut-paper shape around the island on white paper, a few white wave curls. */
function island(centers) {
  const u = (grow) => centers.map((h) => hexD(100 + grow, h.x, h.y)).join(" ");
  // wave curls just off the outer coast
  const cx = centers.reduce((a, h) => a + h.x, 0) / centers.length, cy = centers.reduce((a, h) => a + h.y, 0) / centers.length;
  let waves = "";
  centers.forEach((h, i) => {
    const near = centers.filter((o) => Math.hypot(o.x - h.x, o.y - h.y) < 190).length;
    if (near >= 7 || i % 2) return;
    const dx = h.x - cx, dy = h.y - cy, L = Math.hypot(dx, dy) || 1, x = h.x + (dx / L) * 168, y = h.y + (dy / L) * 168 + 30;
    waves += `M${f(x - 12)},${f(y)} q6,-7 12,0 q6,7 12,0`;
  });
  // v0.71: no pale lagoon any more — the screen's flat turquoise is the sea; the island gets a cut-paper
  // cream beach and a few white wave curls
  return `${st(waves, 3, PA, 'opacity=".85"')}
    <g filter="url(#c-cut)"><path d="${u(16)}" fill="${CREAM}" stroke="${CREAM}" stroke-width="12" stroke-linejoin="round"/></g>`;
}
const tileCache = {};
const tile = (t) => tileCache[t] || (tileCache[t] = `${cut(`<path d="${hexD(95.5)}" fill="${TC[t][0]}"/>`)}
  <clipPath id="c-clip-${t}"><path d="${hexD(95)}"/></clipPath>
  <g clip-path="url(#c-clip-${t})">${cut(TS[t]())}<path d="${hexD(96)}" filter="url(#c-gouache)" opacity=".3"/></g>`);
const glow = () => `<path d="${hexD(101)}" fill="none" stroke="${K.yellow}" stroke-width="10" stroke-linejoin="round"/>`;

/* ---------- ports: a small black canal barge with a red pennant, a paper tag (icon + ratio) ---------- */
function port(p) {
  const px = p.mx + p.nx * 58, py = p.my + p.ny * 58;
  const pier = (c) => { const ex = px - p.nx * 20 + (c.x - p.mx) * 0.3, ey = py - p.ny * 20 + (c.y - p.my) * 0.3; return st(`M${f(c.x)},${f(c.y)} L${f(ex)},${f(ey)}`, 1.4) + circ(ex, ey, 2.4); };
  const fx = p.nx < -0.1 ? -1 : 1;
  const barge = fl("M-30,0 Q-32,-7 -26,-8 L24,-8 Q32,-8 32,-2 Q28,6 18,7 L-22,7 Q-29,6 -30,0Z") + fl("M-20,-8 L-20,-16 L-6,-16 L-6,-8Z") + fl("M-17,-13.5 h3 v3 h-3Z M-11,-13.5 h3 v3 h-3Z", K.yellow) + st("M8,-8 L8,-36", 1.6) + fl("M8,-35 L21,-31.5 L8,-28Z", K.red);
  const ic = p.res ? ICONS[p.res] : ICONS.trade;
  const svg = `<g>${pier(p.a)}${pier(p.b)}<g transform="translate(${f(px)} ${f(py - 8)})">${st("M-34,11 q5,-4 10,0 t10,0 M14,11 q5,-4 10,0 t10,0", 1.6, PA)}
      ${p.noBoat ? "" : `<g transform="scale(${fx * 0.78} .78)">${barge}</g>`}
      <g transform="translate(0 25)"><rect x="-31" y="-14" width="62" height="28" rx="14" fill="${CREAM}" stroke="${B}" stroke-width="1.4"/>
        <g transform="translate(-14.5 0) scale(.23)">${ic}</g></g></g></g>`;
  return { svg, label: { x: px + 11, y: py - 8 + 25 + 6.6, text: p.ratio, size: 19 } };
}

/* ---------- pieces (canvas specs): gabled canal house; tall flat + gable house; ink burglar ---------- */
const winFor = (c) => (c === PC.plum ? K.yellow : c === PC.ivory ? c.line : PA);
function house(c) {
  const wc = winFor(c);
  return [
    { el: "ellipse", cx: 3, cy: 16, rx: 17, ry: 4.5, fill: "#14120F", op: 0.32, shadow: true },
    { d: "M-12,16 V-4 L-10,-4 L0,-19 L10,-4 L12,-4 V16Z", fill: c.base, stroke: c.line, sw: 2.2, body: true },
    { d: "M-13.6,-3.2 L0,-21.4 L13.6,-3.2 L11.2,-2 L0,-16.6 L-11.2,-2Z", fill: c.line, stroke: c.line, sw: 1, body: true },
    { d: "M-7.5,0 h4.4 v5 h-4.4Z M3.1,0 h4.4 v5 h-4.4Z", fill: wc },
    { d: "M-2.6,16 V10.4 Q0,7.6 2.6,10.4 V16Z", fill: c === PC.plum ? K.yellow : c.line },
    { el: "circle", cx: 0, cy: -9, r: 1.8, fill: wc },
  ];
}
function cityArt(c) {
  const wc = winFor(c);
  let win = "";
  for (let r = 0; r < 4; r += 1) for (let k = 0; k < 3; k += 1) win += `M${f(-19 + k * 6)},${f(-24 + r * 8)} h3.6 v4.4 h-3.6Z`;
  return [
    { el: "ellipse", cx: 5, cy: 16, rx: 28, ry: 5.5, fill: "#14120F", op: 0.32, shadow: true },
    { d: "M-23,16 V-31 H-1 V16Z", fill: c.base, stroke: c.line, sw: 2.2, body: true },
    { d: "M-25,-31 H1 V-35 H-25Z M-17,-35 v-5 h4 v5Z", fill: c.line, stroke: c.line, sw: 1, body: true },
    { d: win, fill: wc },
    { d: "M-1,16 V-1 L1,-1 L10.5,-13.5 L20,-1 L22,-1 V16Z", fill: c.base, stroke: c.line, sw: 2.2, body: true },
    { d: "M-2.4,-.4 L10.5,-15.8 L23.4,-.4 L21.2,.8 L10.5,-11.4 L-.2,.8Z", fill: c.line, stroke: c.line, sw: 1, body: true },
    { d: "M5,3 h4 v4.6 h-4Z M12,3 h4 v4.6 h-4Z", fill: wc },
    { d: "M8.4,16 v-5.6 h4.2 V16Z", fill: c === PC.plum ? K.yellow : c.line },
    { d: "M-14.6,16 v-6 h4.2 V16Z", fill: c === PC.plum ? K.yellow : c.line },
  ];
}
// burglar on tiptoe with a sack: the person silhouette at 2.15x, feet on the ground line (y = 32)
const RS = 2.15;
const robberSpec = [
  { el: "ellipse", cx: 3, cy: 32, rx: 18, ry: 4.6, fill: "#14120F", op: 0.32, shadow: true },
  ...personItems({ pose: "tiptoe", hat: "cap", mask: true, tool: TOOLS.sack }).map((s) => {
    if (s.el === "circle") return { ...s, cx: f(s.cx * RS), cy: f(s.cy * RS + 32), r: f(s.r * RS), body: s.fill === B };
    return { ...s, d: tp(s.d, RS, 0, 32), sw: s.sw ? s.sw * RS : undefined, body: s.fill === B || s.stroke === B };
  }),
];

/* ---------- icons (v0.71): solid Indian-ink silhouettes with a slightly irregular, flowing contour,
   a small expressive detail where it still reads at 20 px (a bird on the bricks, a sheep's ear), and at
   most ONE flat colour accent. Cream (PA) only as a highlight: an eye, a snow cap, a dashed line.
   No outlines, no two-tone UI glyphs. Box: -50..50. ---------- */
const ICONS = {};
{
  const ic = ICONS;
  // scalloped contour (tree crowns, fleece): n lobes, depth = how far the dips go in
  const lobed = (cx, cy, rx, ry, n, depth, rot = 0) => smooth(Array.from({ length: n * 2 }, (_, i) => { const t = rot + (i / (n * 2)) * Math.PI * 2, k = i % 2 ? 1 - depth : 1 + depth * 0.6 + j(0.03); return [cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]; }));
  // rounded, hand-cut rectangle (bricks, cards, dice)
  const rr = (x, y, w, h, r = 4, a = 0.7) => { const J = () => j(a); return `M${f(x + r)},${f(y + J())} L${f(x + w - r)},${f(y + J())} Q${f(x + w + J())},${f(y + J())} ${f(x + w + J())},${f(y + r)} L${f(x + w + J())},${f(y + h - r)} Q${f(x + w + J())},${f(y + h + J())} ${f(x + w - r)},${f(y + h + J())} L${f(x + r)},${f(y + h + J())} Q${f(x + J())},${f(y + h + J())} ${f(x + J())},${f(y + h - r)} L${f(x + J())},${f(y + r)} Q${f(x + J())},${f(y + J())} ${f(x + r)},${f(y + J())}Z`; };
  const curl = (x, y, s = 1, c = PA, w = 3) => st(`M${f(x - 6 * s)},${f(y)} q${f(3 * s)},${f(-4 * s)} ${f(6 * s)},0 q${f(3 * s)},${f(-4 * s)} ${f(6 * s)},0`, w, c);
  const perch = (x, y, s = 1, flip = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * flip)} ${f(s)})">${fl("M-7,0 Q-9,-10 0,-12 Q2,-18 8,-17 Q11,-16 11,-13 L16,-12 L11,-10 Q12,-2 4,0Z M-7,-3 L-16,-8 L-8,1Z")}${circ(7, -14.4, 1.3, PA)}</g>`;
  const helmet = (plume) => fl("M-22,38 L-22,6 Q-22,-26 4,-28 Q28,-28 28,0 L28,14 Q28,23 20,25 L18,38Z") + fl("M6,-6 Q17,-8 28,-6 L28,-1 Q17,-3 6,-1Z M6,4 Q17,3 28,4 L28,8 Q17,7 6,8Z", PA)
    + (plume ? fl("M-2,-27 Q-6,-44 10,-46 Q28,-46 40,-32 Q28,-37 19,-33 Q32,-27 38,-14 Q25,-24 12,-25 Q4,-26 -2,-27Z", plume) : fl("M-2,-27 Q-4,-38 6,-40 Q16,-40 22,-32 Q14,-33 8,-28Z")) + fl("M-30,38 Q-4,35 26,38 L26,44 Q-4,41 -30,44Z");

  seed(31);
  ic.wood = fl("M-6,44 Q-3,22 -6,6 Q-14,0 -22,-4 Q-12,-3 -5,0 L-3,-8 L4,-8 Q2,18 6,44Z") + fl(lobed(-2, -20, 30, 25, 7, 0.13)) +
    fl("M10,31 L41,29 Q48,29 48,36.5 Q48,44 41,44 L10,44Z") + `<ellipse cx="11" cy="37.5" rx="6" ry="7.2" fill="${B}"/><ellipse cx="11" cy="37.5" rx="4" ry="5.2" fill="${K.ochre}"/>` + curl(32, -40, 0.9, B, 2.6);
  seed(32);
  ic.brick = fl(rr(-44, 18, 42, 20, 5)) + fl(rr(2, 18, 42, 20, 5), K.orange) + fl(rr(-21, -4, 42, 20, 5)) + perch(2, -4, 1.15);
  seed(33);
  ic.sheep = st("M-24,10 L-25,33 M-13,14 L-13,35 M5,14 L6,35 M17,10 L19,33", 4) + fl(lobed(-8, -2, 32, 21, 8, 0.14)) +
    fl("M14,-12 Q22,-24 33,-21 Q44,-17 45,-5 Q45,5 37,8 Q28,9 22,3 Q15,-3 14,-12Z") + fl("M21,-17 Q13,-27 6,-22 Q13,-17 20,-11Z") + circ(33, -9, 2.6, PA) +
    fl("M-48,40 Q-44,29 -40,40 Q-36,25 -31,40 Q-27,32 -23,40Z M12,40 Q16,30 20,40 Q25,24 29,40 Q33,31 37,40Z", K.lime);
  {
    const ear = (x, y, a, s = 1) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})">${fl("M0,-27 Q6,-23 5,-17 Q9,-13 5,-8.5 Q9,-4.5 4.5,0 Q2.5,3.5 0,4.5 Q-2.5,3.5 -4.5,0 Q-9,-4.5 -5,-8.5 Q-9,-13 -5,-17 Q-6,-23 0,-27Z")}${st("M0,-26 L0,-36 M3,-23 L8,-32 M-3,-23 L-8,-32", 1.6)}</g>`;
    ic.wheat = st("M0,46 Q-2,12 -17,-10 M0,46 L0,-14 M0,46 Q2,12 17,-10", 3.6) + ear(-17, -10, -30) + ear(0, -14, 0, 1.08) + ear(17, -10, 30) +
      fl("M0,32 Q-15,25 -22,34 Q-10,37 0,32Z") + fl("M-11,16 Q0,22 11,16 L11,24 Q0,30 -11,24Z", K.yellow);
  }
  ic.ore = fl("M-48,42 Q-40,22 -29,10 L-21,-2 Q-16,-7 -12,-2 L-6,4 L5,-29 Q9,-37 14,-29 L27,-7 L32,-13 Q36,-17 40,-11 L48,42Z") +
    fl("M5,-29 Q9,-37 14,-29 L20,-18 Q14,-21 10,-15 Q6,-21 1,-18Z", PA) + fl("M-31,40 L-26,28 L-15,26 L-10,36 L-18,43Z M-6,42 L-2,34 L8,33 L11,42Z", K.sky);
  ic.desert = fl("M-48,30 Q-24,2 0,16 Q22,-2 48,22 L48,40 L-48,40Z") + circ(20, -22, 12, K.yellow) + curl(-24, -22, 0.9, B, 2.6);
  // trade: two brush-stroke arrows, one ink, one orange
  const swoosh = "M-44,-6 Q-18,-30 18,-22 L16,-34 L45,-14 L12,4 L15,-9 Q-14,-16 -44,-6Z";
  ic.trade = `<g transform="translate(0 -6)">${fl(swoosh)}</g><g transform="rotate(180) translate(0 -6)">${fl(swoosh, K.orange)}</g>`;
  ic.bank = fl("M-44,-12 Q-20,-30 0,-44 Q20,-30 44,-12Z") + fl("M-46,32 Q0,29 46,32 L46,42 Q0,39 -46,42Z") + fl("M-34,-6 h11 v34 h-11Z M-14,-6 h11 v34 h-11Z M6,-6 h11 v34 h-11Z M24,-6 h11 v34 h-11Z") + circ(0, -23, 5.5, K.yellow);
  // build: a hammer with a wooden (orange) handle
  ic.build = `<g transform="rotate(-38)">${fl("M-5,-14 Q-2,12 -4.5,46 Q0,50 4.5,46 Q2,12 5,-14Z", K.orange)}${fl("M-30,-30 Q-32,-15 -23,-13 L20,-13 Q33,-14 35,-25 L35,-29 Q24,-30 18,-37 L-23,-37 Q-30,-37 -30,-30Z")}</g>`;
  // cards: two hand-cut cards, the front one with a cream bird
  seed(34);
  ic.cards = `<g transform="rotate(-14 -8 20)">${fl(rr(-38, -30, 40, 58, 7, 0.6), K.turq)}</g><g transform="rotate(9 10 20)">${fl(rr(-6, -32, 40, 58, 7, 0.6))}${curl(14, -2, 1.1, PA, 3.4)}</g>`;
  ic.devcard = fl(rr(-26, -38, 52, 76, 8, 0.6)) + fl(rr(-18, -30, 36, 60, 5, 0.5), K.turq) + perch(-1, 10, 1.05);
  ic.menu = fl("M-32,-26 Q-2,-31 30,-25 Q36,-22 31,-17 Q0,-21 -30,-16 Q-36,-20 -32,-26Z M-31,-5 Q0,-8 31,-4 Q36,0 31,4 Q2,1 -31,5 Q-36,0 -31,-5Z M-30,16 Q0,13 30,17 Q36,21 30,25 Q-2,22 -31,26 Q-36,21 -30,16Z", "currentColor");
  // dev cards
  ic.knight = helmet(K.red);
  ic.roadBuilding = fl("M-46,46 Q-6,12 -9,-36 L5,-36 Q12,12 40,46Z") + st("M-3,38 L-2,29 M0,17 L0,9 M0,-3 L-1,-10 M-2,-21 L-2,-27", 3.4, PA) +
    fl("M28,4 L35,-17 Q36,-19 37,-17 L44,4Z", K.orange) + fl("M25,3 Q36,1 47,3 L47,8 Q36,6 25,8Z") + tree(-34, -2, 32, "round");
  ic.yearOfPlenty = st("M-30,-2 Q-31,-42 0,-44 Q31,-42 30,-2", 4.4) + fl(blob(-14, -10, 14, 13, 9, 0.04), K.yellow) + fl(blob(12, -14, 12, 14, 9, 0.04), K.yellow) +
    fl("M12,-28 Q14,-36 22,-38 Q20,-30 12,-28Z") + fl("M-44,-4 Q0,-8 44,-4 Q41,36 0,41 Q-41,36 -44,-4Z") + st("M-32,10 Q0,16 32,10 M-25,24 Q0,30 25,24", 2.8, PA);
  ic.monopoly = fl("M-8,-17 Q-31,-7 -35,18 Q-37,45 0,45 Q37,45 35,18 Q31,-7 8,-17 Q14,-25 10,-29 L-10,-29 Q-14,-25 -8,-17Z") + st("M-13,-19 Q0,-13 13,-19", 3, PA) +
    fl("M-17,-33 L-21,-48 L-8,-40 L0,-53 L8,-40 L21,-48 L17,-33 Q0,-36 -17,-33Z", K.yellow);
  const star = (r1, r2, cy) => smooth(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? r2 : r1; return [Math.cos(a) * r * (1 + j(0.04)), cy + Math.sin(a) * r * (1 + j(0.04))]; }));
  seed(35);
  ic.victoryPoint = fl(star(58, 22, 6)) + circ(0, 7, 8.5, K.yellow);
  ic.vp = ic.victoryPoint;
  // the robber: a burglar in a flat cap, cream mask, red scarf
  ic.robber = fl("M-36,48 Q-36,20 -10,14 L12,14 Q36,18 38,48Z") + fl("M-20,-4 Q-22,-30 2,-32 Q22,-32 24,-12 Q31,-8 28,-2 Q25,1 22,2 Q20,14 2,16 Q-18,16 -20,-4Z") +
    fl("M-25,-14 Q-23,-38 3,-38 Q24,-36 26,-22 L41,-18 Q39,-13 24,-14Z") + fl("M-21,-11 Q2,-13 25,-11 L26,-2 Q2,-4 -21,-2Z", PA) + circ(13, -6.5, 3.2) +
    fl("M-15,13 Q2,21 19,13 L23,22 Q2,30 -19,22Z", K.red);
  // awards: a winding road to a red pennant; two helmets, one with the red plume
  ic.longestRoad = fl("M-46,46 Q-46,16 -14,12 Q14,10 12,-6 Q10,-19 20,-25 L30,-16 Q24,-12 26,-3 Q28,26 -4,26 Q-28,26 -30,46Z") +
    st("M-38,40 Q-34,26 -22,21 M-6,19 Q8,17 15,10", 2.6, PA) + st("M30,-18 L31,-50", 3.6) + fl("M31,-50 Q40,-49 48,-44 Q40,-40 31,-38Z", K.red);
  ic.largestArmy = `<g transform="translate(-18 0) scale(.64)">${helmet(null)}</g><g transform="translate(15 8) scale(.8)">${helmet(K.red)}</g>`;
  ic.settings = (() => { const pts = []; for (let i = 0; i < 8; i += 1) { const a = (i * Math.PI) / 4 + 0.2; for (const [r, da] of [[29, -0.32], [46, -0.17], [46, 0.17], [29, 0.32]]) pts.push([Math.cos(a + da) * r, Math.sin(a + da) * r]); } return fl(smooth(pts)) + circ(0, 0, 13, PA) + circ(0, 0, 6, K.red); })();
  seed(36);
  const dieI = (x, y, r, pips, c) => `<g transform="translate(${x} ${y}) rotate(${r})">${fl(rr(-21, -21, 42, 42, 9, 0.8), c)}${pips.map(([a, b]) => circ(a, b, 4.6, PA)).join("")}</g>`;
  ic.dice = dieI(-16, 9, -10, [[-9, -9], [0, 0], [9, 9]], B) + dieI(20, -11, 12, [[-8, -8], [8, -8], [-8, 8], [8, 8]], K.red);
  ic.endTurn = fl("M-24,-44 Q0,-46 24,-44 L24,-38 Q0,-40 -24,-38Z M-24,38 Q0,36 24,38 L24,44 Q0,42 -24,44Z") + fl("M-18,-38 Q-18,-8 -3,0 Q-18,8 -18,38 H18 Q18,8 3,0 Q18,-8 18,-38Z") + fl("M-10,38 Q-6,22 0,18 Q6,22 10,38Z M-9,-24 Q0,-14 9,-24Z", K.yellow);
  ic.hint = fl("M-16,16 Q-34,0 -28,-20 Q-20,-44 0,-44 Q20,-44 28,-20 Q34,0 16,16 V26 H-16Z", K.yellow) + fl("M-16,28 Q0,26 16,28 V34 Q0,32 -16,34Z M-10,38 H10 V44 H-10Z") + st("M-8,-24 Q-16,-20 -16,-8", 4, PA);
  ic.log = fl("M0,-30 Q-22,-40 -46,-34 V32 Q-22,26 0,36 Q22,26 46,32 V-34 Q22,-40 0,-30Z") + st("M-36,-18 Q-22,-23 -9,-17 M-36,-5 Q-22,-10 -9,-4 M-36,8 Q-22,3 -9,9 M9,-17 Q22,-23 36,-18 M9,-4 Q22,-10 36,-5", 3.2, PA) + fl("M24,-37 h8 v26 l-4,-4 l-4,4Z", K.red);
  ic.undo = fl("M-34,-6 L-10,-30 L-10,-17 Q32,-20 34,9 Q33,36 2,36 L-6,36 L-6,24 L2,24 Q21,24 21,9 Q20,-6 -10,-4 L-10,9Z");
  // home / menu glyphs in the same hand
  ic.clock = fl("M-7,-46 Q0,-48 7,-46 L7,-40 Q0,-41 -7,-40Z M-3,-41 h6 v8 h-6Z") + fl(blob(0, 6, 38, 37, 12, 0.02)) + fl(blob(0, 6, 29, 28, 12, 0.02), K.yellow) + st("M0,6 L0,-14 M0,6 L13,15", 5.4) + circ(0, 6, 4.5);
  ic.sliders = fl("M-40,-22 Q0,-26 40,-21 Q43,-17 40,-14 Q0,-17 -40,-13 Q-44,-17 -40,-22Z M-40,15 Q0,12 40,16 Q43,20 40,23 Q0,20 -40,24 Q-44,20 -40,15Z") + circ(14, -17.5, 10) + circ(-12, 19.5, 10) + circ(14, -17.5, 4, PA) + circ(-12, 19.5, 4, K.orange);
  ic.book = fl("M0,-30 Q-22,-40 -46,-34 V32 Q-22,26 0,36 Q22,26 46,32 V-34 Q22,-40 0,-30Z") + st("M-36,-16 Q-22,-21 -9,-15 M-36,-3 Q-22,-8 -9,-2 M9,-15 Q22,-21 36,-16 M9,-2 Q22,-8 36,-3", 3.2, PA);
  ic.info = fl(blob(0, 0, 42, 41, 12, 0.02)) + circ(0, -19, 6, PA) + fl("M-6,-6 Q0,-8 6,-6 L6,22 Q0,24 -6,22Z", PA);
  ic.road = fl("M-42,26 L26,-36 L42,-20 L-26,42Z", PC.blue.base) + st("M-42,26 L26,-36 L42,-20 L-26,42Z", 3, PC.blue.line);
  ic.settlement = `<g transform="translate(0 2) scale(2)">${specSvg(house(PC.blue).slice(1))}</g>`;
  ic.city = `<g transform="translate(0 4) scale(1.45)">${specSvg(cityArt(PC.blue).slice(1))}</g>`;
  ic.fit = `<path d="M-38,-16 V-38 H-16 M16,-38 H38 V-16 M38,16 V38 H16 M-16,38 H-38 V16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` + fl(hexD(17), K.green);
  const zoom = (plus) => `<g stroke="currentColor" stroke-linecap="round" fill="none"><circle cx="-6" cy="-6" r="22" stroke-width="7"/><path d="M14,14 L34,34" stroke-width="10"/><path d="M-16,-6 h20${plus ? " M-6,-16 v20" : ""}" stroke-width="5"/></g>`;
  ic.zoomIn = zoom(1); ic.zoomOut = zoom(0);
  ic.logo = fl(hexD(46), K.orange) + `<g transform="translate(0 30)">${fl("M-14,0 V-26 L0,-44 L14,-26 V0Z")}${fl("M-7,-20 h5 v6 h-5Z M2,-20 h5 v6 h-5Z M-3,0 v-8 h6 v8Z", K.yellow)}</g>` + bird(-20, -18, 2.2, B);
  ic.close = `<path d="M-20,-20 L20,20 M20,-20 L-20,20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`;
  ic.check = `<path d="M-26,0 L-8,18 L26,-22" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  ic.chevron = `<path d="M-18,-8 L0,10 L18,-8" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  ic.plus = `<path d="M0,-20 V20 M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`;
  ic.minus = `<path d="M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`;
}

/* ---------- avatars: the six seat personas (src/themes/portraits.js) as Fiep-style ink silhouettes:
   black hair and face with cream eyes, clothes in the seat colour, an emblem brooch ---------- */
const avatar6 = (preset) => portrait(preset, { style: "ink", ink: B, paper: PA });

/* ---------- cards: one flat colour field, a silhouette scene, hand-lettered title on paper ---------- */
// card scenes may be busier than tiles (they are pictures, not a playing surface)
const sceneBrick = () => {
  seed(12);
  let g = fl("M-130,-6 Q-30,4 30,-4 Q60,-8 130,2 L130,130 L-130,130Z", TC.brick[1]);
  g += fl("M-68,-6 L-68,-36 L-46,-50 L-12,-50 L-12,-6Z") + fl("M4,-6 L7,-86 L17,-86 L20,-6Z") + fl("M5,-86 h14 v4 h-14Z");
  for (let i = 0; i < 3; i += 1) { const x = -62 + i * 16; g += fl(`M${x},-6 L${x},-16 Q${x + 5},-23 ${x + 10},-16 L${x + 10},-6Z`, K.yellow); }
  g += fl("M16,-94 Q4,-102 14,-110 Q24,-116 34,-112 Q44,-118 50,-110 Q44,-104 34,-106 Q24,-102 20,-96Z", PA, 'opacity=".95"');
  return g + brickStack(46, 20) + brickStack(-70, 62) + person(36, 70, { pose: "push", hat: "cap", flip: true }) + fl("M18,64 L16,58 L32,58 L30,64Z") + circ(18, 67, 2.6);
};
const sceneWheat = () => {
  seed(14);
  let g = "";
  for (let i = 0; i < 5; i += 1) g += fl(`M-95,${-14 + i * 22} Q0,${-24 + i * 22} 95,${-20 + i * 22} L95,${-12 + i * 22} Q0,${-16 + i * 22} -95,${-6 + i * 22}Z`, TC.wheat[1], 'opacity=".75"');
  const mx = 34, my = -30;
  g += fl(`M${mx - 11},${my} L${mx - 6},${my - 34} L${mx + 6},${my - 34} L${mx + 11},${my}Z`) + fl(`M${mx - 8},${my - 34} Q${mx},${my - 44} ${mx + 8},${my - 34}Z`) + fl(`M${mx - 15},${my - 12} h30 v3 h-30Z`) + fl(`M${mx - 2.4},${my} v-7 h4.8 v7Z`, K.yellow);
  const hx = mx, hy = my - 36;
  for (const a of [-58, 32, 122, 212]) {
    const r = (a * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r), nx = -uy, ny = ux, L = 32;
    g += st(`M${f(hx)},${f(hy)} L${f(hx + ux * L)},${f(hy + uy * L)}`, 1.6);
    let lat = `M${f(hx + ux * 8 + nx * 6)},${f(hy + uy * 8 + ny * 6)} L${f(hx + ux * L + nx * 6)},${f(hy + uy * L + ny * 6)}`;
    for (let k = 0; k < 7; k += 1) { const t = 8 + k * 4; lat += `M${f(hx + ux * t)},${f(hy + uy * t)} l${f(nx * 6)},${f(ny * 6)}`; }
    g += st(lat, 0.9);
  }
  g += circ(hx, hy, 2.2) + stook(-58, -26, 1) + stook(-38, -34, 0.9) + stook(-70, 0, 1.1) + stook(-18, -44, 0.8);
  return g + person(-36, 68, { dress: true, hat: "scarf", hc: K.red, pose: "walk", tool: TOOLS.scythe }) + bird(-40, -72, 1.2) + bird(-26, -78, 0.9);
};
const sceneOre = () => {
  seed(15);
  let g = fl("M-92,10 L-60,-30 L-46,-24 L-20,-78 L-4,-58 L6,-66 L36,-12 L44,10Z", TC.ore[1]) + fl("M2,10 L30,-42 L44,-58 L58,-44 L66,-50 L92,4 L92,10Z");
  g += fl("M-20,-78 L-4,-58 L-12,-50 L-26,-62Z", PA, 'opacity=".9"') + fl("M44,-58 L58,-44 L50,-40 L40,-50Z", PA, 'opacity=".9"') + fl("M-22,10 L-22,-8 Q-12,-20 -2,-8 L-2,10Z");
  g += st("M-14,12 L-40,64 M-4,12 L-30,66", 1.2) + st("M-16,20 h10 M-20,30 h10 M-24,40 h10 M-29,50 h10 M-33,60 h10", 1);
  g += fl("M-40,40 L-22,40 L-24,50 L-38,50Z") + circ(-36, 52, 2.4) + circ(-26, 52, 2.4);
  g += person(-56, 60, { pose: "push", hat: "helmet" }) + person(10, 52, { pose: "walk", hat: "helmet", tool: TOOLS.pick, flip: true });
  return g + fl(blob(52, 64, 12, 8)) + fl(blob(68, 68, 7, 5));
};
const sc = (fn, s, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy}) scale(${s})">${fn()}</g>`;
const CS = {
  wood: [K.green, () => `<g transform="translate(0 6)">${tree(-60, 60, 120, "pine")}${tree(-14, 64, 140, "round")}${tree(44, 62, 116, "poplar")}${tree(84, 66, 80, "round")}</g>` + person(-70, 96, { s: 2.3, pose: "walk", hat: "cap", tool: TOOLS.axe, arms: "M-3,-15.6 Q1,-15 5,-16 M3,-15.6 Q5.4,-16 6.4,-16.6" }) + fl("M10,96 h70 v-6 h-70Z M18,88 h56 v-6 h-56Z M28,80 h36 v-6 h-36Z") + cat(-20, 96, 2)],
  brick: [K.orange, () => sc(sceneBrick, 1.15, 0, 38)],
  sheep: [K.lime, () => tree(-74, 20, 90, "willow") + sheep(-26, 30, 3) + sheep(48, 2, 2.2, -1) + sheep(-62, 98, 2.3) + person(64, 98, { s: 2.6, hat: "beret", tool: TOOLS.crook, flip: true }) + dog(28, 98, 2.4, -1)],
  wheat: [K.yellow, () => sc(sceneWheat, 1.4, 0, 22)],
  ore: [K.grey, () => sc(sceneOre, 1.35, 0, 20)],
  knight: [K.turq, () => fl("M-110,96 V-20 H-74 V-34 H-62 V-46 H-50 V-34 H-38 V-20 H-34 V96Z") + fl("M-100,0 h10 v14 h-10Z M-62,0 h10 v14 h-10Z M-100,34 h10 v14 h-10Z", K.yellow) + circ(54, -70, 18, K.yellow) + fl("M70,96 V-8 Q68,-24 84,-28 Q94,-46 106,-28 Q120,-24 118,-8 V96Z")
    + person(-4, 96, { s: 4, pose: "walk", hat: "cap", tool: TOOLS.lantern, arms: "M-3,-15.6 Q-6,-12.6 -7.4,-10 M3,-15.6 Q6,-14 5.6,-9.6" }) + cat(-60, 96, 2.6, -1)],
  roadBuilding: [K.ochre, () => fl("M-40,100 Q-14,20 -6,-40 L6,-40 Q14,20 50,100Z", PA) + st("M4,90 v-14 M2,60 v-12 M1,34 v-10 M0,12 v-8 M0,-8 v-6 M0,-26 v-4", 3) + tree(-80, -30, 50, "round") + tree(-58, -36, 34, "poplar") + tree(80, -32, 46, "pine") + person(-64, 98, { s: 2.8, pose: "push", hat: "cap", arms: "M3,-15 Q7,-12 9,-6 M-2,-15 Q3,-12 9,-7" }) + person(82, 96, { s: 2.6, pose: "push", hat: "cap", flip: true }) + fl("M30,90 L28,80 L56,80 L54,90Z") + circ(32, 94, 5)],
  yearOfPlenty: [K.pink, () => { let s = fl("M-98,-30 H54 L46,-56 H-90Z") + fl("M-90,-56 L-68,-56 L-72,-30 L-98,-30Z M-46,-56 L-24,-56 L-24,-30 L-48,-30Z M-2,-56 L20,-56 L22,-30 L0,-30Z", PA) + st("M-90,-30 V96 M44,-30 V96", 4) + fl("M-92,30 H46 V38 H-92Z");
    for (const [x, c] of [[-72, K.yellow], [-40, K.green], [-8, K.red], [24, K.orange]]) s += fl(blob(x, 20, 15, 10, 9, 0.05), c);
    return s + person(-22, 96, { s: 3, dress: true, hat: "scarf", hc: K.yellow, arms: "wave" }) + bike(86, 96, 2.4) + fl(blob(102, 58, 12, 8), K.green); }],
  monopoly: [K.red, () => { let s = ""; for (let i = 0; i < 10; i += 1) { const r = Math.floor(i / 4), x = -56 + (i % 4) * 26 + r * 12, y = 88 - r * 22; s += fl(blob(x, y, 15, 11, 10, 0.04), PA); } return s + person(70, 96, { s: 3.6, hat: "cap", arms: "M-3,-15.6 Q-8,-18 -9,-22 M3,-15.6 Q5.4,-12 5.6,-8.8" }) + pigeon(-86, 96, 2.4) + pigeon(-102, 98, 2, -1); }],
  victoryPoint: [K.blue, () => fl("M-30,100 V-14 H30 V100Z M-36,-14 H36 V-20 H-36Z M-24,-20 V-50 H24 V-20Z M-28,-50 L0,-92 L28,-50Z") + st("M0,-92 V-108", 3) + fl("M0,-108 L26,-102 L0,-96Z", K.red) + circ(0, -34, 10, PA) + st("M0,-34 v-6 M0,-34 l4,3", 2) + fl("M-18,10 h10 v18 h-10Z M8,10 h10 v18 h-10Z M-8,100 V70 Q0,58 8,70 V100Z", K.yellow) + tree(-76, 100, 100, "round") + tree(80, 100, 90, "poplar") + pigeon(-20, -50, 2) + pigeon(20, -50, 2, -1) + bird(-60, -80, 3) + bird(-34, -96, 2.2)],
};
const cardCache = {};
function card(k, mini) {
  const key = k + (mini ? "m" : "");
  if (cardCache[key]) return cardCache[key];
  seed(k.length * 13 + 5);
  const res = RESOURCE_KEYS.includes(k), name = RES_NAME[k] || DEV_NAME[k], [col, art] = CS[k];
  const h = mini ? 236 : 222;
  const scene = `<clipPath id="cc-${key}"><rect x="14" y="14" width="222" height="${h}" rx="6"/></clipPath><g clip-path="url(#cc-${key})"><rect x="14" y="14" width="222" height="${h}" fill="${col}"/><g filter="url(#c-cut)"><g transform="translate(125 ${mini ? 140 : 130}) scale(${mini ? 1.02 : 0.96})">${art()}</g></g><rect x="14" y="14" width="222" height="${h}" filter="url(#c-gouache)" opacity=".3"/></g>`;
  const base = `<rect x="2" y="2" width="246" height="346" rx="12" fill="${CREAM}" stroke="${B}" stroke-width="3"/>`;
  const label = col === K.yellow ? "#9A5A10" : col === K.lime ? "#5E7A1E" : col === K.grey ? "#4A6278" : col === K.ochre ? "#9A5A10" : col === K.pink ? "#B0485A" : col === K.green ? "#3C7A2E" : col === K.turq ? "#1E7584" : col;
  const out = mini
    ? base + scene + `<text x="125" y="${name.length > 11 ? 300 : 306}" text-anchor="middle" font-family="Kalam, cursive" font-weight="700" font-size="${name.length > 11 ? 36 : name.length > 8 ? 44 : 52}" fill="${B}">${name}</text>`
    : base + scene + `<text x="125" y="276" text-anchor="middle" font-family="Kalam, cursive" font-weight="700" font-size="${name.length > 11 ? 32 : 38}" fill="${B}">${name}</text>
      <text x="125" y="${CARD_TEXT[k].length > 30 ? 298 : 306}" text-anchor="middle" font-family="Alegreya Sans, sans-serif" font-weight="500" font-size="15" fill="#5E5852">${wrap(CARD_TEXT[k], 30).map((l, i) => `<tspan x="125" dy="${i ? 17 : 0}">${l}</tspan>`).join("")}</text>
      <text x="125" y="338" text-anchor="middle" font-family="Alegreya Sans, sans-serif" font-weight="800" font-size="10" letter-spacing="2.6" fill="${label}">${res ? "RESOURCE" : "DEVELOPMENT"}</text>
      <g transform="translate(40 40)"><circle r="17" fill="${PA}"/><g transform="scale(.24)">${ICONS[k]}</g></g>`;
  return (cardCache[key] = out);
}
const cardBack = () => `<rect x="1" y="1" width="248" height="348" rx="12" fill="${K.orange}"/><rect x="14" y="14" width="222" height="322" rx="6" fill="none" stroke="${PA}" stroke-width="2"/>
  ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<g transform="translate(${50 + c * 50} ${50 + r * 62})" opacity=".55">${bird(0, 0, 1.5, PA)}</g>`).join("")).join("")}
  <circle cx="125" cy="175" r="54" fill="${PA}"/><g transform="translate(125 175) scale(.92)">${ICONS.logo}</g>`;

/* ---------- paper dice ---------- */
const PIPS = { 1: [[0, 0]], 2: [[-14, -14], [14, 14]], 3: [[-14, -14], [0, 0], [14, 14]], 4: [[-14, -14], [14, -14], [-14, 14], [14, 14]], 5: [[-14, -14], [14, -14], [0, 0], [-14, 14], [14, 14]], 6: [[-14, -16], [14, -16], [-14, 0], [14, 0], [-14, 16], [14, 16]] };
const die = (n) => `<rect x="-36" y="-36" width="72" height="72" rx="14" fill="${PA}" stroke="${B}" stroke-width="3"/>${PIPS[n].map(([x, y]) => circ(x, y, 6.4, n === 1 ? K.red : B)).join("")}`;

/** Settings › Look & feel thumbnail: seven flat colour hexes on a cut-paper sea, a canal house. */
function thumb() {
  const pos = [[0, 0, "desert"], [26, 0, "wheat"], [-26, 0, "wood"], [13, 22.5, "sheep"], [-13, 22.5, "ore"], [13, -22.5, "brick"], [-13, -22.5, "sheep"]];
  seed(5);
  return `<svg viewBox="-80 -45 160 90" preserveAspectRatio="xMidYMid slice"><rect x="-80" y="-45" width="160" height="90" fill="${SEA}"/>
    <path d="${[[0, 0], [26, 0], [-26, 0], [13, 22.5], [-13, 22.5], [13, -22.5], [-13, -22.5]].map(([x, y]) => hexD(17.5, x, y)).join(" ")}" fill="${CREAM}" stroke="${CREAM}" stroke-width="3" stroke-linejoin="round"/>${st("M-62,-30 q3,-3 6,0 q3,3 6,0 M48,28 q3,-3 6,0 q3,3 6,0", 1.2, PA)}
    ${pos.map(([x, y, t]) => `<path d="${hexD(14.6, x, y)}" fill="${TC[t][0]}"/>`).join("")}
    <circle cx="0" cy="3" r="5.6" fill="${PA}"/><text x="0" y="5.6" text-anchor="middle" font-size="7.5" font-weight="700" font-family="Kalam, cursive" fill="${K.red}">8</text>
    <g transform="translate(-26 -6) scale(.62)">${tree(0, 6, 18, "pine")}</g><g transform="translate(13 -12) scale(.42)">${specSvg(house(PC.orange).slice(1))}</g><g transform="translate(-13 12) scale(.42)">${specSvg(house(PC.blue).slice(1))}</g>${bird(-48, -30, 1)}${bird(-38, -34, 0.8)}</svg>`;
}

const tokenStyle = {
  r: 25, fill: PA, ring: "#3A3633", inner: "rgba(0,0,0,0)", ink: B, hot: K.red,
  font: "'Kalam', cursive", weight: "700", size: 24, hotSize: 27, dy: 6, hotDy: 7, pipY: 15, pipR: 1.7, pipGap: 4.6,
  labelFont: "'Kalam', cursive",
};

const silhouette = {
  id: "C",
  name: "Silhouette",
  mood: "Bold flat colour fields, a turquoise sea and black ink silhouettes.",
  sample: "Aa",
  sampleFont: "'Kalam', cursive",
  fonts: { families: ["Kalam", "Alegreya Sans"] },
  paletteDots: [SEA, K.orange, K.yellow, K.green, B],
  confettiColors: [K.orange, K.yellow, K.turq, K.green, K.pink, B],
  motion: { name: "Gentle, page-like", k: 1.05, pop: "cubic-bezier(.3,1.35,.5,1)", out: "cubic-bezier(.22,.8,.3,1)", inOut: "cubic-bezier(.65,0,.35,1)", fall: "cubic-bezier(.55,0,1,.45)", squash: [1.1, 0.9], bounces: 1, sway: 0 },
  seatKeys: ["blue", "orange", "ivory", "plum"],
  textColors: TEXT,
  pc: PC,
  palette: P,
  canvasArt: true,
  boardDefs, island, tile, glow, port, tokenStyle,
  dimFill: "rgba(255,253,246,.6)",
  pieces: { settlement: house, city: cityArt, robber: robberSpec, settlementDy: -2, cityDy: -4 },
  road: { shadow: "rgba(28,26,25,.22)", outer: 14, inner: 10, hi: 0.01, trim: 21, rim: "rgba(255,253,246,.7)", rimW: 2.5 },
  rim: "rgba(255,253,246,.7)", rimW: 2.5,
  hint: { halo: "rgba(255,253,246,.4)", fill: PA, ring: K.red, dot: K.red },
  confirm: { fill: K.red, ring: PA },
  robberDx: 46, robberDy: 8, tokenDy: 24,
  icons: ICONS,
  card, cardBack,
  avatar: avatar6,
  die,
  thumb,
  swatch: () => `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="${K.orange}"/><path d="M11,30 V18 L18,10 L25,18 V30Z" fill="${B}"/><rect x="16" y="23" width="4" height="7" fill="${K.yellow}"/></svg>`,
  uiDefs: () => filters(),
  pipCount,
};

export default silhouette;
