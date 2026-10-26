// THEME B — "Wooden Board Game"
// A premium physical edition seen from above: a die-cut cardboard board with a printed aqua sea
// frame on a honey-oak table, printed lithograph terrain (flat tones, one light from the upper-left),
// ivory number discs, painted wooden pieces, linen / paper chrome. Ported from the approved mockup
// (scratchpad/themes/B/themeB.js) onto the shared board renderer, with the board learnings applied:
// calm tiles (few props, kept in the ring between the disc and the tile edge, nothing that looks like
// a building), continuous roads, pieces the most salient thing (dark same-hue outline, contact
// shadow, thin light rim). Seats and portraits are the same as in every other theme.
import { f, rng, hexPath, pipCount, wrap, RES_NAME, DEV_NAME, CARD_TEXT, RESOURCE_KEYS } from "../art-util.js";
import { specSvg, poly, tp, mix } from "../spec-util.js";
import sunny from "../sunny/art.js";

const INK = "#2A241E", INK2 = "#5E5245", IVORY = "#F3EBDA", RED = "#A8352B", ACC = "#2E6650", BRASS = "#D9AE4E";

// Seats (v0.78): the Sunny hues in B's wood-stain look — a touch warmer and more muted, as painted wooden
// pieces (You red · Blaauw blue · Van Geelen orange · Groenewoud green · De Wit ivory · Pimpel purple).
const PC = {
  red: { base: "#C4463A", dark: "#963026", light: "#DE7C6C", line: "#3E1610" },
  blue: { base: "#3B6FB5", dark: "#2A5288", light: "#7FA0D2", line: "#142B4E" },
  orange: { base: "#E3893A", dark: "#AE5F1C", light: "#F0B479", line: "#4E2A0C" },
  green: { base: "#2F8055", dark: "#1F6040", light: "#6AAE88", line: "#0F3020" },
  ivory: { base: "#EEE4CC", dark: "#CBBE9F", light: "#F8F2E2", line: "#6B5D46" },
  purple: { base: "#7A4BA6", dark: "#57337C", light: "#A886CC", line: "#26123C" },
};
const TEXT = { red: "#963026", blue: "#2A5288", orange: "#A0571A", green: "#1F6040", ivory: "#5E5139", purple: "#57337C" }; // seat hues as text on paper (applySeatTokens darkens further where AA needs it)

// printed terrain tones [shade, mid, light]
const TER = {
  wood: { base: "#5E9F58", c: ["#3E8048", "#78B965", "#A6D486"] },
  brick: { base: "#E27F57", c: ["#C9643F", "#EE9A72", "#F7C2A0"] },
  sheep: { base: "#B3D671", c: ["#97C25C", "#C8E38E", "#DDEFB0"] },
  wheat: { base: "#F2C552", c: ["#E4AE3C", "#F7D676", "#FBE6A4"] },
  ore: { base: "#94A5C0", c: ["#7086A6", "#B8C6DB", "#F7F9FA"] },
  desert: { base: "#F1DCA6", c: ["#E3C68A", "#F8E9C4", "#C9AB76"] },
};
// fallback board colours (drawn until the first bake lands)
const P = {
  ink: INK, sand: "#E6D8B8",
  forest: [TER.wood.base], terra: [TER.brick.base], pasture: [TER.sheep.base], wheat: [TER.wheat.base], slate: [TER.ore.base], desert: [TER.desert.base],
};

/* ======================= textures & defs =======================
   Every feTurbulence lives in a <pattern>; the browser bakes it when the board layer is rasterised. */
const grainTile = (id, w, h, bf, oct, seed, mat) => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
    <filter id="${id}-f" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="${mat}"/></filter>
    <rect width="${w}" height="${h}" filter="url(#${id}-f)"/></pattern>`;
const PAPER_M = "0 0 0 0 .2  0 0 0 0 .16  0 0 0 0 .1  0 0 0 -1.1 .62";
const GRAIN_M = "0 0 0 0 .1  0 0 0 0 .06  0 0 0 0 .02  0 0 0 2.2 -.95";

/* ======================= terrain illustrations =======================
   printed-lithograph look: flat shapes, 3–4 tones per terrain, lit from the upper-left. Props sit in
   the ring between the number disc (r ≈ 38 on phones) and the tile edge, away from the corners. */
const shadow = (x, y, rx, ry, o = 0.25, c = "#1A2414") => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}" opacity="${o}"/>`;
const conifer = (x, y, s, c1, c2) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})">${shadow(3, 1, 7, 2.4, 0.28)}<rect x="-1" y="-4" width="2" height="5" fill="#4A3A2A"/><path d="M0,-28 L9,-4 L-9,-4 Z" fill="${c2}"/><path d="M0,-28 L0,-4 L-9,-4 Z" fill="${c1}"/><path d="M0,-34 L7,-16 L-7,-16 Z" fill="${c2}"/><path d="M0,-34 L0,-16 L-7,-16 Z" fill="${c1}"/></g>`;
const roundTree = (x, y, r, c1, c2, sc = "#1A2414") => `<g transform="translate(${f(x)} ${f(y)})">${shadow(r * 0.35, r * 0.62, r * 1.05, r * 0.32, 0.28, sc)}<rect x="-1.2" y="${f(r * 0.1)}" width="2.4" height="${f(r * 0.55)}" fill="#5A4430"/><circle r="${f(r)}" fill="${c1}"/><circle cx="${f(-r * 0.32)}" cy="${f(-r * 0.32)}" r="${f(r * 0.52)}" fill="${c2}"/></g>`;
const sheep = (x, y, s = 1, fl = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * fl)} ${f(s)})">${shadow(3, 5, 9, 3, 0.25, "#3C4520")}<ellipse rx="8" ry="5.6" fill="#F4EEDD"/><ellipse cx="-1.5" cy="-1.6" rx="5" ry="2.6" fill="#FFFDF5"/><ellipse cx="8" cy="-1" rx="3" ry="2.4" fill="#3B342C"/></g>`;
const hay = (x, y, s = 1) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">${shadow(4, 4, 9, 3, 0.3, "#5A4318")}<path d="M-7,3 Q-7,-10 0,-12 Q7,-10 7,3 Z" fill="#E8C46A"/><path d="M-7,3 Q-7,-10 0,-12 L0,3 Z" fill="#F3D88E"/></g>`;
const bricks = (x, y) => {
  let b = `<g transform="translate(${x} ${y})"><path d="M-14,8 L18,8 L22,4 L22,-16 L-10,-16 L-14,-12 Z" fill="#3E1E10" opacity=".22" transform="translate(4 4)"/>`;
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4 - (r % 2); c += 1) b += `<rect x="${-14 + c * 8 + (r % 2) * 4}" y="${2 - r * 6}" width="7.4" height="5.4" fill="${(r + c) % 2 ? "#B9583E" : "#CC6D4E"}"/><rect x="${-14 + c * 8 + (r % 2) * 4}" y="${2 - r * 6}" width="7.4" height="1.4" fill="#F0AA88"/>`;
  return b + "</g>";
};
const rock = (x, y, r, c1 = "#BBA27A", c2 = "#D3BD94", sc = "#5A4422") => `<g transform="translate(${x} ${y})">${shadow(3, r * 0.5, r + 2, r * 0.4, 0.3, sc)}<path d="M-${r},${r * 0.4} Q-${r},-${r * 0.8} 0,-${r * 0.9} Q${r},-${r * 0.6} ${r},${r * 0.4} Z" fill="${c1}"/><path d="M-${r},${r * 0.4} Q-${r},-${r * 0.8} 0,-${r * 0.9} L0,${r * 0.4} Z" fill="${c2}"/></g>`;

function terrainArt(t) {
  const R = rng({ wood: 3, brick: 5, sheep: 7, wheat: 9, ore: 13, desert: 17 }[t]);
  const T = TER[t], [d, m, l] = T.c;
  let s = `<rect x="-110" y="-110" width="220" height="220" fill="${T.base}"/>`;
  if (t === "wood") {
    // soft understorey, then three calm groups of printed conifers
    for (let i = 0; i < 6; i += 1) s += `<ellipse cx="${f(R() * 160 - 80)}" cy="${f(R() * 160 - 80)}" rx="${f(22 + R() * 16)}" ry="${f(12 + R() * 8)}" fill="${R() > 0.5 ? "#5A9853" : "#68AA5E"}" opacity=".7"/>`;
    const trees = [[-34, -42, 1.15], [-16, -48, 1.3], [2, -42, 1.1], [-64, 10, 1.15], [-50, 26, 1.3], [8, 70, 1.15], [26, 64, 1.3], [44, 58, 1.1], [66, 24, 1.05]];
    trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, sc], i) => { s += conifer(x, y, sc, i % 3 ? m : l, i % 2 ? "#4F8A4A" : d); });
    s += roundTree(-38, 62, 11, "#7DB862", "#A6D486");
  } else if (t === "sheep") {
    s += `<path d="M-110,-44 Q-40,-72 20,-50 T110,-62 V-110 H-110 Z" fill="${l}" opacity=".7"/><path d="M-110,40 Q-30,14 40,32 T110,22 V110 H-110 Z" fill="${d}" opacity=".45"/>`;
    s += `<path d="M-110,-6 Q-40,-30 30,-12 T110,-22" fill="none" stroke="#9AB866" stroke-width="2.4" stroke-dasharray="1 6" stroke-linecap="round" opacity=".7"/>`;
    [[-48, -40, 1.35, 1], [30, -50, 1.3, -1], [-56, 40, 1.35, 1], [42, 50, 1.4, -1]].forEach(([x, y, sc, fl]) => { s += sheep(x, y, sc, fl); });
    s += roundTree(-66, -4, 10, "#7FA35A", "#9CBE72", "#3C4520");
  } else if (t === "wheat") {
    for (let i = -9; i < 10; i += 1) { const y = i * 22; s += `<path d="M-130,${y} L130,${y - 70} L130,${y - 59} L-130,${y + 11} Z" fill="${i % 3 === 0 ? d : i % 3 === 1 ? l : m}" opacity=".55"/>`; }
    s += `<g opacity=".18" stroke="#B08A3A" stroke-width="1">${Array.from({ length: 40 }, (_, i) => `<path d="M-130,${-200 + i * 11} L130,${-270 + i * 11}"/>`).join("")}</g>`;
    s += hay(-50, -40, 1.25) + hay(-30, -50, 1.1) + hay(48, 44, 1.25) + hay(-40, 58, 1.15);
    s += roundTree(58, -36, 10, "#7FA35A", "#9CBE72", "#3C3014");
  } else if (t === "brick") {
    for (let i = 0; i < 6; i += 1) { const y = -96 + i * 38; s += `<path d="M-120,${y} Q-50,${y - 22} 10,${y - 6} T120,${y - 14} V${y + 18} Q60,${y + 8} 0,${y + 22} T-120,${y + 16} Z" fill="${i % 2 ? d : m}" opacity=".5"/>`; }
    s += `<ellipse cx="-30" cy="-50" rx="28" ry="13" fill="#B4603F"/><ellipse cx="-28" cy="-48" rx="22" ry="9" fill="#C8775A"/><ellipse cx="-27" cy="-46" rx="13" ry="5" fill="#B4634A"/>`;
    s += bricks(40, 52) + bricks(-52, 50);
  } else if (t === "ore") {
    const peak = (x, y, w, h, snow) => `<path d="M${x - w},${y} L${x},${y - h} L${x + w * 0.9},${y} Z" fill="${d}"/><path d="M${x - w},${y} L${x},${y - h} L${x - w * 0.1},${y} Z" fill="${l}"/>${snow ? `<path d="M${x},${y - h} L${x + w * 0.25},${y - h * 0.72} L${x + w * 0.05},${y - h * 0.76} L${x - w * 0.06},${y - h * 0.66} L${x - w * 0.22},${y - h * 0.74} Z" fill="${T.c[2]}"/>` : ""}`;
    s += `<rect x="-110" y="44" width="220" height="80" fill="#8B98AB" opacity=".8"/>`;
    s += peak(-40, -26, 38, 52, 1) + peak(30, -30, 42, 50, 1) + peak(-62, 64, 26, 30, 0) + peak(58, 66, 28, 30, 0);
    for (const [x, y] of [[-20, 64], [-8, 70], [20, 72]]) s += `<path transform="translate(${x} ${y})" d="M-5,2 L-2,-4 L4,-3 L6,2 Z" fill="#6E7B8C"/>`;
  } else {
    for (let i = 0; i < 7; i += 1) { const y = -100 + i * 32; s += `<path d="M-120,${y} Q-40,${y - 16} 20,${y} T120,${y - 4}" fill="none" stroke="${i % 2 ? d : m}" stroke-width="9" opacity=".7"/>`; }
    s += rock(-48, -44, 9) + rock(46, 50, 7) + rock(-30, 62, 5);
    for (const [x, y] of [[-66, 18], [30, -60]]) s += `<g transform="translate(${x} ${y})" stroke="#7E7A48" stroke-width="1.6" stroke-linecap="round"><path d="M0,0 l-5,-6 M0,0 l5,-7 M0,0 l0,-8 M0,0 l-7,-2 M0,0 l7,-2"/></g>`;
  }
  return s;
}
const terrSymbols = () => Object.keys(TER).map((t) => `<symbol id="bt-${t}" viewBox="-100 -100 200 200" overflow="hidden">${terrainArt(t)}</symbol>`).join("");

const boardDefs = () => `
  ${grainTile("b-paper", 240, 240, ".85", 2, 3, PAPER_M)}
  ${grainTile("b-fleck", 300, 300, ".035", 3, 6, "0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .12  0 0 0 2 -.9")}
  <pattern id="b-waves" width="56" height="28" patternUnits="userSpaceOnUse"><path d="M0,14 q7,-5 14,0 t14,0 t14,0 t14,0" fill="none" stroke="#E8F2F2" stroke-opacity=".22" stroke-width="1.4"/><path d="M-7,0 q7,5 14,0 t14,0 t14,0 t14,0 t14,0 M-7,28 q7,5 14,0 t14,0 t14,0 t14,0 t14,0" fill="none" stroke="#0E2433" stroke-opacity=".08" stroke-width="1.2"/></pattern>
  <radialGradient id="b-seaG" cx=".45" cy=".42" r=".7"><stop offset="0" stop-color="#86D3DA"/><stop offset=".7" stop-color="#62BCCB"/><stop offset="1" stop-color="#4AA6BA"/></radialGradient>
  <radialGradient id="b-tileV" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#FFF6DD" stop-opacity=".22"/><stop offset=".55" stop-color="#FFF6DD" stop-opacity="0"/><stop offset="1" stop-color="#1C140C" stop-opacity=".22"/></radialGradient>
  <radialGradient id="b-disc" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FBF6EA"/><stop offset=".7" stop-color="#F1E7D1"/><stop offset="1" stop-color="#E3D5B7"/></radialGradient>
  <filter id="b-blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="b-blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="b-blur12" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
  <clipPath id="b-hexclip"><path d="${hexPath(0, 0, 96)}"/></clipPath>
  ${terrSymbols()}`;

/* ======================= the board: die-cut sea frame on the table =======================
   The frame follows the island (union of grown hexes, rounded), so any map shape works. Rings are
   made by stacking fills, never by stroking the union (that would draw every inner hex edge). */
function island(centers) {
  const u = (grow, dx = 0, dy = 0) => centers.map((h) => hexPath(h.x + dx, h.y + dy, 100 + grow)).join(" ");
  const fillU = (grow, fill, extra = "", dx = 0, dy = 0, round = 26) => `<path d="${u(grow, dx, dy)}" fill="${fill}" stroke="${fill}" stroke-width="${round}" stroke-linejoin="round" ${extra}/>`;
  return `<g filter="url(#b-blur12)" opacity=".5">${fillU(132, "#120A04", "", 10, 18)}</g>
    ${fillU(132, "#7C6B52", "", 0, 7)}${fillU(132, "url(#b-fleck)", 'opacity=".7"', 0, 7)}
    ${fillU(132, "#E9DDC0")}
    ${fillU(128, "url(#b-seaG)")}${fillU(128, "url(#b-waves)")}
    ${fillU(118, "#F3EBDA", 'opacity=".55"')}${fillU(116, "url(#b-seaG)")}${fillU(116, "url(#b-waves)")}
    ${fillU(128, "url(#b-paper)", 'opacity=".45"')}
    ${fillU(30, "#9CDCE0", 'opacity=".55"', 0, 0, 12)}${fillU(14, "#BCE8E6", 'opacity=".6"', 0, 0, 8)}
    <g filter="url(#b-blur6)" opacity=".45">${centers.map((h) => `<path d="${hexPath(h.x + 5, h.y + 9, 97)}" fill="#0B1A22"/>`).join("")}</g>`;
}

/* tile: printed terrain on a cardboard hex with an edge, a bevel and one light from the upper-left */
const tile = (t) => `<path d="${hexPath(0, 6, 96)}" fill="#5E5040"/><path d="${hexPath(0, 6, 96)}" fill="url(#b-fleck)" opacity=".8"/>
  <path d="${hexPath(0, 3, 96)}" fill="${TER[t].c[0]}" opacity=".9"/>
  <g clip-path="url(#b-hexclip)"><use href="#bt-${t}" x="-100" y="-100" width="200" height="200"/>
    <path d="${hexPath(0, 0, 96)}" fill="url(#b-tileV)"/><path d="${hexPath(0, 0, 96)}" fill="url(#b-paper)" opacity=".5"/>
    <path d="${hexPath(0, 0, 88)}" fill="none" stroke="#FFF8E6" stroke-opacity=".32" stroke-width="1.4"/></g>
  <path d="M-83.1,48 L-83.1,-48 L0,-96 L83.1,-48" fill="none" stroke="#FFF9EA" stroke-opacity=".7" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M83.1,-48 L83.1,48 L0,96 L-83.1,48" fill="none" stroke="#1B140C" stroke-opacity=".28" stroke-width="2" stroke-linejoin="round"/>`;
const glow = () => `<path d="${hexPath(0, 0, 93)}" fill="none" stroke="#FFF8E6" stroke-width="3.5"/>`;

/* ======================= harbours: printed frame discs =======================
   Ratio label is drawn by the canvas with the page font (fonts don't load inside rasterised SVG). */
const RES_TONE = { wood: "#5F9A57", brick: "#D98260", sheep: "#9FBC6A", wheat: "#D9AE4E", ore: "#8E9AB0" };
// v0.78: a printed badge (the token's paper disc stretched to a lozenge) off the coast: the printed resource
// icon in a ring of its colour beside the ratio (3:1: just the ratio); dashed rope piers to the coast
// corners, each marked by a small dot of the harbour's colour. Geometry: harbourBadges (p.badge).
const PORT_ANY = "#2F6573"; // 3:1 corner dots
function port(p) {
  const q = p.badge, s = p.s || 1, tone = p.res ? RES_TONE[p.res] : PORT_ANY;
  const pier = ([c, e]) => `<path d="M${f(c.x)},${f(c.y)} L${f(e[0])},${f(e[1])}" stroke="#3F7D8C" stroke-width="${f(7 * s)}" stroke-linecap="round" opacity=".45"/><path d="M${f(c.x)},${f(c.y)} L${f(e[0])},${f(e[1])}" stroke="#E6D8B8" stroke-width="${f(3.8 * s)}" stroke-dasharray="${f(4 * s)} ${f(2.5 * s)}"/>`;
  const dot = (c) => `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(5.6 * s)}" fill="${tone}" stroke="${INK}" stroke-width="${f(1.6 * s)}"/>`;
  const x0 = q.x - q.w / 2, y0 = q.y - q.h / 2, ic = q.icon, rr = ic ? ic.size / 2 : 0;
  const rect = (dx, dy, fill, extra = "") => `<rect x="${f(x0 + dx)}" y="${f(y0 + dy)}" width="${f(q.w)}" height="${f(q.h)}" rx="${f(q.r)}" fill="${fill}" ${extra}/>`;
  const svg = `<g>${p.piers.map(pier).join("")}${dot(p.a)}${dot(p.b)}
    ${rect(2.5 * s, 4.5 * s, "#06121A", 'opacity=".45" filter="url(#b-blur3)"')}${rect(0, 2.5 * s, "#A8977A")}${rect(0, 0, "url(#b-disc)")}${rect(0, 0, "url(#b-paper)", 'opacity=".5"')}
    ${rect(0, 0, "none", `stroke="${p.res ? tone : "#9C8A6A"}" stroke-width="${f((p.res ? 2.4 : 1.6) * s)}"`)}
    ${p.res ? `<g transform="translate(${f(ic.x)} ${f(ic.y)})"><circle r="${f(rr)}" fill="#FBF6EA" stroke="${tone}" stroke-width="${f(2.2 * s)}"/><g transform="scale(${+(ic.size / 92).toFixed(4)})">${ICON_RAW[p.res]}</g></g>` : ""}</g>`;
  return { svg, labels: [{ x: q.text.x, y: q.text.y, text: p.ratio, size: q.text.size, color: INK, weight: 800 }] };
}

/* ======================= painted wooden pieces (canvas specs) =======================
   3/4 extrusion with depth up-right: front = base colour, left roof light, right roof and side dark.
   Every face carries the dark same-hue outline; a soft contact shadow sits under the base (y = 16). */
const DEP = [7, -6];
function house(c) {
  const w = 14, eave = -1, peak = -16, base = 16, [dx, dy] = DEP;
  const front = [[-w, base], [w, base], [w, eave], [0, peak], [-w, eave]];
  const roofR = [[0, peak], [w, eave], [w + dx, eave + dy], [dx, peak + dy]];
  const roofL = [[0, peak], [-w, eave], [-w + dx, eave + dy], [dx, peak + dy]];
  const side = [[w, base], [w, eave], [w + dx, eave + dy], [w + dx, base + dy]];
  return [
    { el: "ellipse", cx: 6, cy: 16, rx: 22, ry: 5.5, fill: "#14100B", op: 0.36, shadow: true },
    { d: poly(roofL), fill: c.light, stroke: c.line, sw: 2.2, body: true },
    { d: poly(side), fill: c.dark, stroke: c.line, sw: 2.2, body: true },
    { d: poly(roofR), fill: mix(c.base, c.dark, 0.35), stroke: c.line, sw: 2.2, body: true },
    { d: poly(front), fill: c.base, stroke: c.line, sw: 2.2, body: true },
    { d: "M-11.5,13.5 V0 L0,-12.5", stroke: "rgba(255,255,255,.4)", sw: 1.3, cap: "round" },
    { d: "M-4,16 V7 h8 V16Z", fill: c.line, op: 0.45 },
  ];
}
function cityArt(c) {
  const [dx, dy] = DEP, base = 16;
  const L = { x0: -22, x1: 2, eave: -8, peak: -27 }, mx = (L.x0 + L.x1) / 2;
  const lf = [[L.x0, base], [L.x1, base], [L.x1, L.eave], [mx, L.peak], [L.x0, L.eave]];
  const lroofL = [[mx, L.peak], [L.x0, L.eave], [L.x0 + dx, L.eave + dy], [mx + dx, L.peak + dy]];
  const lroofR = [[mx, L.peak], [L.x1, L.eave], [L.x1 + dx, L.eave + dy], [mx + dx, L.peak + dy]];
  const wf = [[L.x1, base], [22, base], [22, 1], [L.x1, 1]];
  const wtop = [[L.x1, 1], [22, 1], [22 + dx, 1 + dy], [L.x1 + dx, 1 + dy]];
  const wside = [[22, base], [22, 1], [22 + dx, 1 + dy], [22 + dx, base + dy]];
  return [
    { el: "ellipse", cx: 6, cy: 18, rx: 32, ry: 6.5, fill: "#14100B", op: 0.36, shadow: true },
    { d: poly(lroofL), fill: c.light, stroke: c.line, sw: 2.2, body: true },
    { d: poly(lroofR), fill: mix(c.base, c.dark, 0.35), stroke: c.line, sw: 2.2, body: true },
    { d: poly(wtop), fill: c.light, stroke: c.line, sw: 2.2, body: true },
    { d: poly(wside), fill: c.dark, stroke: c.line, sw: 2.2, body: true },
    { d: poly(wf), fill: mix(c.base, c.dark, 0.12), stroke: c.line, sw: 2.2, body: true },
    { d: poly(lf), fill: c.base, stroke: c.line, sw: 2.2, body: true },
    { d: `M${L.x0 + 2.5},13.5 V${L.eave + 1} L${mx},${L.peak + 3.5}`, stroke: "rgba(255,255,255,.4)", sw: 1.3, cap: "round" },
    { d: "M-14,16 V6 h8 V16Z", fill: c.line, op: 0.45 },
    { d: "M9,6 h6 v5 h-6Z", fill: c.line, op: 0.4 },
  ];
}
// the robber: a turned walnut pawn (lathe profile, lit from the upper-left)
const PAWN = "M-15,0 Q-15,-6 -9,-8 Q-5,-10 -6,-16 Q-9,-26 -6,-34 Q-11,-36 -11,-39 Q-11,-42 -6,-42 Q-12,-47 -11,-54 Q-9,-64 0,-64 Q9,-64 11,-54 Q12,-47 6,-42 Q11,-42 11,-39 Q11,-36 6,-34 Q9,-26 6,-16 Q5,-10 9,-8 Q15,-6 15,0 Q8,4 0,4 Q-8,4 -15,0 Z";
const PAWN_SHADE = "M2,-63 Q9,-62 11,-54 Q12,-47 6,-42 Q11,-42 11,-39 Q11,-36 6,-34 Q9,-26 6,-16 Q5,-10 9,-8 Q15,-6 15,0 Q8,4 0,4 Q7,0 5,-8 Q1,-10 2,-16 Q5,-26 2,-34 Q6,-38 3,-42 Q8,-50 2,-63Z";
const robberSpec = [
  { el: "ellipse", cx: 4, cy: 32, rx: 18, ry: 5, fill: "#14100B", op: 0.38, shadow: true },
  { d: tp(PAWN, 1, 0, 28), fill: "#6A4A30", stroke: "#1E140C", sw: 2, body: true },
  { d: tp(PAWN_SHADE, 1, 0, 28), fill: "#2E1E12", op: 0.55 },
  { el: "ellipse", cx: -4, cy: -27, rx: 3.2, ry: 4.6, fill: "#D8B48C", op: 0.6 },
  { d: "M-9,-10 H-3", stroke: "#D8B48C", sw: 1.6, cap: "round", op: 0.5 },
  { d: "M-10,24 Q-9,21 -6,20", stroke: "#D8B48C", sw: 1.6, cap: "round", op: 0.5 },
];

/* ======================= icons: printed two-tone (ink line + one muted fill) ======================= */
const st = `stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
const ICON_RAW = {
  wood: `<path d="M-6,34 h12 v-8 h-12 Z" fill="#7A5A3C" ${st}/><path d="M0,-40 L22,-8 H12 L28,16 H-28 L-12,-8 H-22 Z" fill="#5F9A57" ${st}/><path d="M0,-40 L-22,-8 H-12 L-28,16 H0 Z" fill="#8DBA72"/><path d="M0,-40 L22,-8 H12 L28,16 H-28 L-12,-8 H-22 Z" fill="none" ${st}/>`,
  brick: `<g ${st}><path d="M-34,6 h32 v14 h-32 Z M2,6 h32 v14 h-32 Z M-18,-10 h32 v14 h-32 Z" fill="#D98260"/><path d="M-34,24 h68 v12 h-68 Z" fill="#B9583E"/></g><path d="M-30,9 h24 M6,9 h24 M-14,-7 h24" stroke="#F0BC9E" stroke-width="3" stroke-linecap="round"/>`,
  sheep: `<g ${st}><path d="M-22,18 v12 M14,18 v12" fill="none"/><path d="M-30,6 q-6,-14 6,-20 q4,-14 20,-10 q12,-10 24,2 q14,2 10,18 q4,14 -10,18 q-8,8 -22,2 q-14,6 -22,-4 q-10,-2 -6,-6 Z" fill="#F2ECDC"/><path d="M24,-14 q14,-6 18,6 q2,12 -10,14 q-10,0 -12,-10 Z" fill="#3B342C"/></g><circle cx="34" cy="-4" r="2.2" fill="#F2ECDC"/>`,
  wheat: `<g ${st}><path d="M0,40 V-36 M-14,40 Q-14,0 -24,-24 M14,40 Q14,0 24,-24" fill="none"/>${[0, 1, 2, 3].map((i) => `<path d="M0,${-30 + i * 12} q-11,-3 -12,-13 q10,1 12,13 Z M0,${-30 + i * 12} q11,-3 12,-13 q-10,1 -12,13 Z" fill="#EBC566" stroke-width="3.2"/>`).join("")}<path d="M-6,-38 q6,-10 12,0 q-6,8 -12,0 Z" fill="#EBC566" stroke-width="3.2"/></g>`,
  ore: `<g ${st}><path d="M-36,30 L-20,-6 L-4,-14 L10,-34 L30,-10 L38,30 Z" fill="#8E9AB0"/></g><path d="M-20,-6 L-4,-14 L10,-34 L4,0 L-14,10 Z" fill="#BAC4D0"/><path d="M4,0 L30,-10 M4,0 L-2,30 M-14,10 L-30,22" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M-36,30 L-20,-6 L-4,-14 L10,-34 L30,-10 L38,30 Z" fill="none" ${st}/>`,
  desert: `<g ${st}><path d="M-40,26 Q-14,4 6,14 Q22,2 40,16 V30 H-40 Z" fill="#D9C391"/><circle cx="16" cy="-18" r="12" fill="#E8C46A"/></g>`,
};
const gearD = (() => { let d = ""; for (let i = 0; i < 16; i += 1) { const a = (i * Math.PI) / 8 + Math.PI / 16, r = i % 2 ? 26 : 36; d += (i ? "L" : "M") + f(r * Math.cos(a - 0.1)) + "," + f(r * Math.sin(a - 0.1)) + "L" + f(r * Math.cos(a + 0.1)) + "," + f(r * Math.sin(a + 0.1)); } return d + "Z"; })();
const BUILD_INK = { base: "#22313A", dark: "#16222A", light: "#4A5A64", line: "#0E161B" }; // v0.75: build / dock icons in neutral ink (UI, not a seat colour)
const ICONS = {
  ...ICON_RAW,
  knight: `<g ${st}><path d="M-24,-6 Q-24,-34 0,-36 Q24,-34 24,-6 V22 Q24,34 0,38 Q-24,34 -24,22 Z" fill="#9BA3AC"/><path d="M-24,0 H24" fill="none"/><path d="M-14,-6 H14 M-14,8 H-4 M4,8 H14" fill="none" stroke-width="5"/><path d="M0,-36 V-46 M-8,-46 Q0,-52 8,-46" fill="none"/></g><path d="M-18,-12 Q-16,-30 0,-31" fill="none" stroke="#DDE1E4" stroke-width="3" stroke-linecap="round"/><path d="M0,8 V34" stroke="${INK}" stroke-width="3"/>`,
  roadBuilding: `<g ${st}><path d="M-38,18 L-6,-26 L4,-18 L-28,26 Z" fill="${BUILD_INK.base}"/><path d="M-4,30 L28,-14 L38,-6 L6,38 Z" fill="${BUILD_INK.base}"/></g><path d="M-30,14 L-6,-18" stroke="${BUILD_INK.light}" stroke-width="3" stroke-linecap="round"/><path d="M2,26 L26,-6" stroke="${BUILD_INK.light}" stroke-width="3" stroke-linecap="round"/>`,
  yearOfPlenty: `<g ${st}><path d="M-34,-6 H34 L26,34 H-26 Z" fill="#B88A55"/><path d="M-34,-6 Q-20,-30 -6,-12 Q0,-34 14,-14 Q26,-28 34,-6" fill="#EBC566"/></g><path d="M-30,6 H30 M-28,18 H28" stroke="${INK}" stroke-width="2.6" opacity=".7"/>`,
  monopoly: `<g ${st}><path d="M0,-38 V30 M-22,36 H22 M-34,-24 H34" fill="none"/><path d="M-34,-24 L-46,4 H-22 Z M34,-24 L22,4 H46 Z" fill="${BRASS}"/><circle cy="-38" r="5" fill="${BRASS}"/></g>`,
  victoryPoint: `<g ${st}><path d="M-20,-36 H20 V-6 Q20,16 0,18 Q-20,16 -20,-6 Z" fill="${BRASS}"/><path d="M-20,-28 Q-36,-28 -34,-14 Q-32,-2 -18,0 M20,-28 Q36,-28 34,-14 Q32,-2 18,0" fill="none"/><path d="M0,18 V28 M-16,38 H16 L12,28 H-12 Z" fill="${BRASS}"/></g><path d="M-12,-30 V-10" stroke="#EAD08F" stroke-width="4" stroke-linecap="round"/>`,
  road: `<g ${st}><rect x="-40" y="-9" width="80" height="18" rx="3" fill="${BUILD_INK.base}" transform="rotate(-30)"/></g><path d="M-30,10 L28,-24" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`,
  settlement: `<g transform="translate(-6 2) scale(1.8)">${specSvg(house(BUILD_INK))}</g>`,
  city: `<g transform="translate(-2 4) scale(1.4)">${specSvg(cityArt(BUILD_INK))}</g>`,
  trade: `<g ${st}><path d="M-36,-18 H14 V-30 L36,-12 L14,6 V-6 H-36 Z" fill="#E8954A"/><path d="M36,18 H-14 V6 L-36,24 L-14,42 V30 H36 Z" fill="#62BCCB" transform="translate(0 -6)"/></g>`,
  bank: `<g ${st}><path d="M-36,-14 L0,-36 L36,-14 Z" fill="${BRASS}"/><path d="M-36,34 H36 V26 H-36 Z" fill="${BRASS}"/><path d="M-24,-8 V20 M-8,-8 V20 M8,-8 V20 M24,-8 V20" fill="none" stroke-width="6"/></g>`,
  dice: `<g ${st}><rect x="-36" y="-22" width="40" height="40" rx="7" fill="#E7D3A8" transform="rotate(-12 -16 -2)"/><rect x="0" y="-8" width="38" height="38" rx="7" fill="#F3E6C8" transform="rotate(10 19 11)"/></g><g fill="${INK}"><circle cx="-24" cy="-8" r="3.6"/><circle cx="-10" cy="4" r="3.6"/><circle cx="12" cy="4" r="3.4"/><circle cx="26" cy="20" r="3.4"/><circle cx="19" cy="12" r="3.4"/></g>`,
  endTurn: `<g ${st}><path d="M-22,-36 H22 M-22,36 H22" fill="none"/><path d="M-16,-36 Q-16,-10 0,0 Q16,-10 16,-36 Z M-16,36 Q-16,12 0,0 Q16,12 16,36 Z" fill="${IVORY}"/></g><path d="M-10,36 Q-6,22 0,20 Q6,22 10,36 Z M-8,-24 H8 Q4,-14 0,-12 Q-4,-14 -8,-24 Z" fill="${BRASS}"/>`,
  hint: `<g ${st}><path d="M-20,-6 Q-24,-36 0,-38 Q24,-36 20,-6 Q14,4 12,14 H-12 Q-14,4 -20,-6 Z" fill="#F7D676"/><path d="M-12,22 H12 M-8,32 H8" fill="none"/></g><path d="M-10,-24 Q-8,-30 -2,-31" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  settings: `<g ${st}><path d="${gearD}" fill="#B9A786"/><circle r="11" fill="${IVORY}"/></g>`,
  log: `<g ${st}><path d="M-26,-36 H26 V36 H-26 Z" fill="#FBF3E0"/><path d="M-14,-18 H14 M-14,-4 H14 M-14,10 H6" fill="none" stroke-width="3.6"/></g><path d="M-26,-36 V36" stroke="#E27F57" stroke-width="7"/>`,
  robber: `<g transform="translate(0 2) scale(1.05)">${specSvg(robberSpec.slice(1))}</g>`,
  longestRoad: `${[[-26, 16, -35], [0, -2, 30], [26, -20, -35]].map(([x, y, r]) => `<rect x="-17" y="-6.5" width="34" height="13" rx="2.5" transform="translate(${x} ${y}) rotate(${r})" fill="#C99A62" ${st}/>`).join("")}<path d="M-34,32 H34" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>`,
  largestArmy: `${[1, -1].map((k) => `<g transform="scale(${k} 1)"><path d="M-30,-34 L22,24" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M-30,-34 L22,24" stroke="#DDE1E4" stroke-width="4" stroke-linecap="round"/><path d="M12,32 L30,14" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>`).join("")}<path d="M-20,-20 H20 V0 Q20,18 0,28 Q-20,18 -20,0 Z" fill="${BRASS}" ${st}/><path d="M-10,-4 L0,6 L10,-4" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  vp: `<g ${st}><circle r="34" fill="${BRASS}"/></g><circle r="25" fill="none" stroke="${INK}" stroke-width="2" opacity=".6"/><path d="M0,-17 l5,10.5 11.5,1.6 -8.3,8 2,11.4 -10.2,-5.4 -10.2,5.4 2,-11.4 -8.3,-8 11.5,-1.6 Z" fill="${INK}"/>`,
  cards: `<g ${st}><rect x="-30" y="-30" width="38" height="54" rx="5" fill="#EBC566" transform="rotate(-12 -11 -3)"/><rect x="-10" y="-26" width="38" height="54" rx="5" fill="${IVORY}" transform="rotate(8 9 1)"/></g>`,
  devcard: `<g ${st}><rect x="-24" y="-34" width="48" height="68" rx="6" fill="#33405A"/></g><rect x="-16" y="-26" width="32" height="52" rx="3" fill="none" stroke="${BRASS}" stroke-width="2.4"/><path d="M0,-12 L10,0 L0,12 L-10,0 Z" fill="${BRASS}"/>`,
  build: `<g ${st}><path d="M-30,30 L8,-8" fill="none" stroke-width="10"/><path d="M-30,30 L8,-8" stroke="#D9A066" stroke-width="5" fill="none"/><path d="M-6,-22 L14,-42 L36,-20 L16,0 Z" fill="#94A5C0"/></g>`,
  fit: `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M-34,-14 V-34 H-14 M14,-34 H34 V-14 M34,14 V34 H14 M-14,34 H-34 V14"/></g><path d="${hexPath(0, 0, 15)}" fill="#5E9F58" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/>`,
  zoomIn: `<g stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="-6" cy="-6" r="24" fill="none"/><path d="M12,12 L32,32" stroke-width="8" fill="none"/><path d="M-16,-6 h20 M-6,-16 v20" fill="none"/></g>`,
  zoomOut: `<g stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="-6" cy="-6" r="24" fill="none"/><path d="M12,12 L32,32" stroke-width="8" fill="none"/><path d="M-16,-6 h20" fill="none"/></g>`,
  logo: `<path d="${hexPath(0, 3, 44)}" fill="#3B2617"/><path d="${hexPath(0, 0, 44)}" fill="#7A5236"/><path d="${hexPath(0, 0, 44)}" fill="url(#b-grain-ui)" opacity=".6"/><path d="${hexPath(0, 0, 36)}" fill="none" stroke="${IVORY}" stroke-opacity=".7" stroke-width="2"/><path d="M-14,16 V0 L0,-14 L14,0 V16 Z" fill="${IVORY}"/><rect x="-4" y="5" width="8" height="11" fill="#7A5236"/>`,
  undo: `<path d="M-14,-22 L-28,-8 L-14,6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M-26,-8 H8 Q28,-8 28,12 Q28,30 8,30 H-6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  close: `<path d="M-20,-20 L20,20 M20,-20 L-20,20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  check: `<path d="M-24,0 L-8,16 L24,-18" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  chevron: `<path d="M-16,-6 L0,10 L16,-6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<path d="M0,-20 V20 M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
  minus: `<path d="M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
};

/* ======================= cards: ivory card stock (resources) / navy with brass rules (development) ======================= */
const DEVC = {
  knight: ["#CFE5EE", "#F1E6CB"], roadBuilding: ["#D3ECE6", "#F6EAC8"], yearOfPlenty: ["#FCEAB8", "#F7DC97"],
  monopoly: ["#E9E0F2", "#F4E8D4"], victoryPoint: ["#FAEBC0", "#F2DCA2"],
};
const devScene = (k) => {
  const hills = `<path d="M-130,40 Q-60,10 0,30 T130,22 V130 H-130 Z" fill="#9CC27A"/><path d="M-130,64 Q-40,44 30,60 T130,54 V130 H-130 Z" fill="#7FAA63"/>`;
  if (k === "knight") return hills + `<g transform="translate(0 4)"><path d="M-38,40 Q-40,-20 0,-26 Q40,-20 38,40 Z" fill="#9BA3AC"/><path d="M-38,40 Q-40,-20 0,-26 L0,40 Z" fill="#B7BEC5"/><path d="M-26,6 H26" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M-20,22 H-6 M6,22 H20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M0,-26 V-44" stroke="${INK}" stroke-width="4"/><path d="M0,-44 Q-18,-62 -30,-50 Q-16,-46 0,-38 Z" fill="#E7E0CC" stroke="${INK}" stroke-width="2.6"/><path d="M-38,40 Q-40,-20 0,-26 Q40,-20 38,40 Z" fill="none" stroke="${INK}" stroke-width="3.5"/><path d="M0,30 V40" stroke="${INK}" stroke-width="3"/></g><g transform="translate(64 -6) rotate(8)"><path d="M0,-60 V60" stroke="#6B4C33" stroke-width="5"/><path d="M2,-58 L40,-48 L2,-38 Z" fill="#EDE5D2" stroke="${INK}" stroke-width="2.4"/></g>`;
  if (k === "roadBuilding") return hills + `<path d="M-20,130 Q-10,70 20,50 Q50,30 30,-10" fill="none" stroke="#D8C49A" stroke-width="22" stroke-linecap="round"/><path d="M-20,130 Q-10,70 20,50 Q50,30 30,-10" fill="none" stroke="#B8A27A" stroke-width="2" stroke-dasharray="6 7"/>` + [[-50, 20, -30], [56, 70, 24]].map(([x, y, a]) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-34" y="0" width="68" height="16" rx="3" fill="#7A5A3C"/><rect x="-34" y="-5" width="68" height="16" rx="3" fill="#B88A55"/><rect x="-34" y="-5" width="68" height="16" rx="3" fill="url(#b-grain-ui)" opacity=".6"/></g>`).join("");
  if (k === "yearOfPlenty") return hills + `<g transform="translate(0 20)">${[[-26, -22, "brick"], [24, -24, "ore"], [0, -36, "wheat"]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) scale(.62)">${ICON_RAW[r]}</g>`).join("")}<path d="M-50,-4 H50 L40,46 H-40 Z" fill="#C99A62" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-46,10 H46 M-44,24 H44" stroke="#8A6440" stroke-width="3"/></g>`;
  if (k === "monopoly") return hills + `<g transform="translate(0 4)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M0,-46 V44 M-26,48 H26 M-56,-30 H56" fill="none"/><path d="M-56,-30 L-72,8 H-40 Z M56,-30 L40,8 H72 Z" fill="${BRASS}"/><circle cy="-48" r="6" fill="${BRASS}"/></g><g transform="translate(-56 -2) scale(.3)">${ICON_RAW.sheep}</g><g transform="translate(56 -2) scale(.3)">${ICON_RAW.sheep}</g>`;
  return hills + `<g transform="translate(0 6)"><path d="M-64,8 Q-70,-36 -30,-56" fill="none" stroke="#7FAA63" stroke-width="5"/><path d="M64,8 Q70,-36 30,-56" fill="none" stroke="#7FAA63" stroke-width="5"/>${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${-66 + i * 4}" cy="${-4 - i * 13}" rx="9" ry="4.5" fill="#9CC27A" transform="rotate(${-60 + i * 12} ${-66 + i * 4} ${-4 - i * 13})"/><ellipse cx="${66 - i * 4}" cy="${-4 - i * 13}" rx="9" ry="4.5" fill="#9CC27A" transform="rotate(${60 - i * 12} ${66 - i * 4} ${-4 - i * 13})"/>`).join("")}<g transform="scale(1.05)">${ICONS.vp}</g></g>`;
};
function card(k, mini) {
  const res = RESOURCE_KEYS.includes(k), id = "cb-" + k + (mini ? "m" : ""), name = RES_NAME[k] || DEV_NAME[k];
  const frame = res ? IVORY : "#334766";
  const W = mini ? { x: 14, y: 14, w: 222, h: 262 } : { x: 20, y: 20, w: 210, h: 200 };
  const art = res
    ? `<g transform="translate(125 ${W.y + W.h / 2}) scale(${mini ? 1.45 : 1.2})"><use href="#bt-${k}" x="-100" y="-100" width="200" height="200"/></g>
       <g transform="translate(125 ${W.y + W.h / 2 + 4}) scale(${mini ? 1.5 : 1.2})"><circle r="44" fill="#FBF6EA" opacity=".94"/><circle r="44" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="1.4"/><g transform="scale(.82)">${ICON_RAW[k]}</g></g>`
    : `<rect x="0" y="0" width="250" height="350" fill="url(#${id}-sky)"/><g transform="translate(125 ${W.y + W.h / 2 + 10}) scale(${mini ? 1.25 : 1.05})">${devScene(k)}</g>`;
  const ty = mini ? 306 : 250;
  return `<defs><clipPath id="${id}-w"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="8"/></clipPath>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${res ? "#fff" : DEVC[k][0]}"/><stop offset="1" stop-color="${res ? "#fff" : DEVC[k][1]}"/></linearGradient></defs>
    <rect x="1" y="1" width="248" height="348" rx="16" fill="${frame}"/>
    <rect x="1" y="1" width="248" height="348" rx="16" fill="url(#b-paper-ui)" opacity=".6"/>
    ${res ? "" : `<rect x="9" y="9" width="232" height="332" rx="11" fill="none" stroke="${BRASS}" stroke-opacity=".7" stroke-width="1.6"/>`}
    <g clip-path="url(#${id}-w)">${art}</g>
    <rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="8" fill="none" stroke="${res ? "#BFAE8E" : BRASS}" stroke-width="1.6"/>
    ${mini ? `<text x="125" y="${ty + 22}" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-weight="700" font-size="${name.length > 11 ? 30 : 40}" fill="${res ? INK : IVORY}">${name}</text>`
      : `<text x="125" y="${ty + 6}" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-weight="700" font-size="${name.length > 11 ? 25 : 30}" fill="${res ? INK : IVORY}">${name}</text>
    <path d="M95,${ty + 20} H155" stroke="${BRASS}" stroke-width="1.4"/><circle cx="125" cy="${ty + 20}" r="2.4" fill="${BRASS}"/>
    <text x="125" y="${ty + 44}" text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="500" font-size="14" fill="${res ? INK2 : "#E2D8C4"}">${wrap(CARD_TEXT[k], 28).map((l, i) => `<tspan x="125" dy="${i ? 17 : 0}">${l}</tspan>`).join("")}</text>
    <text x="125" y="334" text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2.6" fill="${res ? "#8C7E68" : BRASS}">${res ? "RESOURCE" : "DEVELOPMENT"}</text>`}`;
}
const cardBack = () => `<rect x="1" y="1" width="248" height="348" rx="16" fill="#334766"/><rect x="1" y="1" width="248" height="348" rx="16" fill="url(#b-paper-ui)" opacity=".5"/>
  <rect x="12" y="12" width="226" height="326" rx="10" fill="none" stroke="${BRASS}" stroke-opacity=".8" stroke-width="2"/><rect x="18" y="18" width="214" height="314" rx="7" fill="none" stroke="${BRASS}" stroke-opacity=".4" stroke-width="1"/>
  <g opacity=".14" fill="none" stroke="${BRASS}">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="${hexPath(125, 175, 30 + i * 22)}"/>`).join("")}</g>
  <g transform="translate(125 175) scale(1.3)">${ICONS.logo}</g>`;

/* ======================= wooden dice ======================= */
const PIPS = { 1: [[0, 0]], 2: [[-13, -13], [13, 13]], 3: [[-13, -13], [0, 0], [13, 13]], 4: [[-13, -13], [13, -13], [-13, 13], [13, 13]], 5: [[-13, -13], [13, -13], [0, 0], [-13, 13], [13, 13]], 6: [[-13, -15], [13, -15], [-13, 0], [13, 0], [-13, 15], [13, 15]] };
const die = (n) => `<rect x="-35" y="-32" width="72" height="72" rx="14" fill="#2B1A0E" opacity=".25"/>
  <rect x="-36" y="-34" width="72" height="72" rx="14" fill="#B8955F"/>
  <rect x="-38" y="-38" width="72" height="70" rx="13" fill="#E8D3A6"/><rect x="-38" y="-38" width="72" height="70" rx="13" fill="url(#b-grain-ui)" opacity=".6"/>
  <path d="M-30,-35 H22" stroke="#FFF6E0" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round"/>
  ${PIPS[n].map(([x, y]) => `<circle cx="${x - 2}" cy="${y - 3}" r="6.2" fill="#3A2718"/>`).join("")}`;

/** Settings › Look & feel thumbnail: seven printed tiles in the aqua frame on the oak table. */
function thumb() {
  const pos = [[0, 0, "desert"], [26, 0, "wheat"], [-26, 0, "wood"], [13, 22.5, "sheep"], [-13, 22.5, "ore"], [13, -22.5, "brick"], [-13, -22.5, "sheep"]];
  const hx = (cx, cy, r) => { let d = ""; for (let i = 0; i < 6; i += 1) { const a = ((60 * i - 30) * Math.PI) / 180; d += (i ? "L" : "M") + f(cx + r * Math.cos(a)) + "," + f(cy + r * Math.sin(a)); } return d + "Z"; };
  return `<svg viewBox="-80 -45 160 90" preserveAspectRatio="xMidYMid slice"><rect x="-80" y="-45" width="160" height="90" fill="#A8673A"/>
    <path d="M-80,-30 Q0,-36 80,-28 M-80,-8 Q0,-14 80,-6 M-80,16 Q0,10 80,18 M-80,36 Q0,30 80,38" stroke="#8E5530" stroke-width="2" fill="none" opacity=".6"/>
    <path d="${hx(1.5, 3, 50)}" fill="#3A2412" opacity=".35"/><path d="${hx(0, 1.5, 50)}" fill="#7C6B52"/><path d="${hx(0, 0, 50)}" fill="#62BCCB"/><path d="${hx(0, 0, 46)}" fill="none" stroke="#F3EBDA" stroke-opacity=".6" stroke-width=".8"/>
    ${pos.map(([x, y, t]) => `<path d="${hx(x, y + 1.6, 14.5)}" fill="#5E5040"/><path d="${hx(x, y, 14.5)}" fill="${TER[t].base}"/>`).join("")}
    <circle cx="0" cy="0" r="6" fill="#FBF6EA" stroke="#B9A786" stroke-width=".8"/><text x="0" y="2.6" text-anchor="middle" font-size="7.5" font-weight="700" font-family="Georgia,serif" fill="${RED}">8</text>
    <g transform="translate(13 -11) scale(.32)">${specSvg(house(PC.blue).slice(1))}</g><g transform="translate(-13 11) scale(.32)">${specSvg(house(PC.red).slice(1))}</g></svg>`;
}

/** Number disc, drawn on the canvas with lining figures (WoodNumerals = Playfair Display bold digits). */
const tokenStyle = {
  r: 27, fill: "#FBF6EA", ring: "#B9A786", inner: "#D8C9A8", ink: INK, hot: RED,
  font: "'Colonist Wood Numerals', 'Playfair Display', Georgia, serif", weight: "700", size: 24, hotSize: 28, dy: 8, hotDy: 9.5, pipY: 16.3, pipR: 2.25, pipGap: 5.7,
  pipStyle: "inlay", pipInk: "#4A3A2A", pipCore: "#1E1610", pipHot: RED, pipHotCore: "#5A1810", // burned-in holes
  labelFont: "'Source Sans 3', system-ui, sans-serif",
};

const wood = {
  id: "B",
  name: "Wooden Board Game",
  mood: "Printed tiles in a cardboard frame on an oak table; painted wooden pieces.",
  sample: "Aa",
  sampleFont: "'Playfair Display', Georgia, serif",
  // local font files (assets/fonts, declared in themes/theme-wood.css): work offline, nothing to fetch from Google
  fonts: { families: ["Playfair Display", "Source Sans 3", "Colonist Wood Numerals"] },
  paletteDots: ["#A8673A", "#62BCCB", "#5E9F58", "#F2C552", "#2E6650"],
  confettiColors: [BRASS, "#F3EBDA", PC.red.base, PC.blue.base, ACC, "#9FBC6A"],
  motion: { name: "Weighty & tactile", k: 1.08, pop: "cubic-bezier(.34,1.2,.64,1)", out: "cubic-bezier(.2,.9,.3,1)", inOut: "cubic-bezier(.65,0,.35,1)", fall: "cubic-bezier(.55,0,1,.45)", squash: [1.08, 0.93], bounces: 1, sway: 0 },
  seatKeys: ["red", "blue", "orange", "green"], // v0.75 colonist.io order; seats 5–6 (ivory, purple) via src/themes/seats.js
  textColors: TEXT,
  pc: PC,
  palette: P,
  canvasArt: true,
  boardDefs, island, tile, glow, port, tokenStyle,
  dimFill: "rgba(24,16,8,.42)",
  pieces: { settlement: house, city: cityArt, robber: robberSpec, settlementDy: -2, cityDy: -4 },
  road: { shadow: "rgba(22,14,6,.32)", outer: 14, inner: 10, hi: 2.2, trim: 21, rim: "rgba(255,250,236,.5)", rimW: 2.5 },
  rim: "rgba(255,250,236,.55)", rimW: 2.5,
  hint: { halo: "rgba(255,246,218,.35)", fill: "#FBF6EA", ring: ACC, dot: ACC },
  confirm: { fill: ACC, ring: "#F6EFDF" },
  robberDx: 46, robberDy: -12, tokenDy: 0,
  icons: ICONS,
  card, cardBack,
  avatar: (preset) => sunny.avatar(preset, "B"), // v0.78: the shared portraits in B's wood-stain warmth
  die,
  thumb,
  swatch: () => `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#A8673A"/><path d="M0,8 Q18,4 36,9 M0,20 Q18,16 36,22 M0,30 Q18,27 36,32" stroke="#7E4C2A" stroke-width="1.4" fill="none"/><path d="${hexPath(18, 18, 11)}" fill="#62BCCB"/><path d="${hexPath(18, 18, 6.5)}" fill="#F3EBDA"/></svg>`,
  uiDefs: () => boardDefs() + grainTile("b-grain-ui", 120, 120, "0.012 0.32", 3, 8, GRAIN_M) + grainTile("b-paper-ui", 240, 240, ".85", 2, 3, PAPER_M),
  pipCount,
};

export default wood;
