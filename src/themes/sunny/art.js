// THEME A — "Sunny Island"
// Light, warm, Mediterranean. Stylised-naturalistic terrain painted in flat tones with soft
// gradients; no black outlines — every shape is edged in a darker tint of its own colour.
// One light source (upper-left). UI accent = terracotta. All art is plain SVG strings in art
// units (hex radius 100); the board renderer rasterises it once per size (see board-renderer.js).
import { f, rng, HEX, hexPath, pipCount, wrap, RES_NAME, DEV_NAME, CARD_TEXT, RESOURCE_KEYS } from "../art-util.js";
import { UI_ICONS } from "./ui-icons.js";

const P = {
  sea0: "#2B8C98", sea1: "#3CA9B0", sea2: "#6ACBC3", shallow: "#A6E4D6", foam: "#D9F0E6", sand: "#E4D0A2", sand2: "#D3BA84",
  olive: ["#8AAE58", "#6A8E42", "#B5D184"], forest: ["#5E9A55", "#457A42", "#8CC077"], cypress: ["#4A8250", "#356A3D", "#73A86C"],
  pasture: ["#B8D57A", "#97B95C", "#D6EAA2"], wheat: ["#EDC25E", "#D3A341", "#F8DA8E"], terra: ["#E07E5A", "#C0623F", "#F0A584"],
  slate: ["#93A2B4", "#728399", "#C3CEDB"], desert: ["#F0DAA8", "#DCBF85", "#F8EBCB"], wall: "#F7F2E6", roof: "#D9714E", ink: "#2E3A3D",
};

// Piece colours — colour-blind safe by lightness: dark blue / mid orange / light ivory / near-black.
// The human is always blue; there is no red player.
const PC = {
  blue: { base: "#4A7FD6", dark: "#2C5BA8", light: "#7FA6EA" },
  orange: { base: "#F2934A", dark: "#B9651F", light: "#F9B880" },
  ivory: { base: "#F2ECDD", dark: "#A69A7E", light: "#FFFFFF" },
  slate: { base: "#3E4752", dark: "#232A31", light: "#6E7A87" },
};

/* ------------------------------------------------------------------ props */
const sh = (x, y, rx, ry, o = 0.18) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#24301F" opacity="${o}"/>`;
function roundTree(x, y, r, c = P.forest) {
  return sh(x + r * 0.5, y + 1, r * 1.05, r * 0.38) +
    `<path d="M${f(x)},${f(y)} V${f(y - r * 0.9)}" stroke="#6B5A43" stroke-width="${f(r * 0.18)}" stroke-linecap="round"/>` +
    `<circle cx="${f(x)}" cy="${f(y - r * 1.25)}" r="${f(r)}" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"/>` +
    `<path d="M${f(x + r * 0.1)},${f(y - r * 2.22)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y - r * 1.2)} A${f(r)},${f(r)} 0 0 1 ${f(x + r * 0.1)},${f(y - r * 0.27)} A${f(r * 1.3)},${f(r * 1.3)} 0 0 0 ${f(x + r * 0.1)},${f(y - r * 2.22)}Z" fill="${c[1]}" opacity=".55"/>` +
    `<circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 1.6)}" r="${f(r * 0.38)}" fill="${c[2]}" opacity=".7"/>`;
}
function cypress(x, y, h, c = P.cypress) {
  const w = h * 0.17;
  return sh(x + h * 0.22, y + 1, h * 0.3, h * 0.07) +
    `<path d="M${f(x)},${f(y - h)} C${f(x + w * 1.4)},${f(y - h * 0.55)} ${f(x + w * 1.2)},${f(y - h * 0.05)} ${f(x)},${f(y)} C${f(x - w * 1.2)},${f(y - h * 0.05)} ${f(x - w * 1.4)},${f(y - h * 0.55)} ${f(x)},${f(y - h)}Z" fill="${c[0]}" stroke="${c[1]}" stroke-width="1"/>` +
    `<path d="M${f(x)},${f(y - h)} C${f(x + w * 1.4)},${f(y - h * 0.55)} ${f(x + w * 1.2)},${f(y - h * 0.05)} ${f(x)},${f(y)} C${f(x + w * 0.5)},${f(y - h * 0.3)} ${f(x + w * 0.6)},${f(y - h * 0.7)} ${f(x)},${f(y - h)}Z" fill="${c[1]}" opacity=".6"/>` +
    `<path d="M${f(x - w * 0.5)},${f(y - h * 0.7)} Q${f(x - w * 0.8)},${f(y - h * 0.4)} ${f(x - w * 0.5)},${f(y - h * 0.15)}" stroke="${c[2]}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>`;
}
function stonePine(x, y, s) {
  return sh(x + 10 * s, y + 1, 22 * s, 5 * s) +
    `<path d="M${f(x)},${f(y)} Q${f(x + 2 * s)},${f(y - 14 * s)} ${f(x - 1 * s)},${f(y - 24 * s)}" stroke="#6B5A43" stroke-width="${f(2.6 * s)}" fill="none" stroke-linecap="round"/>` +
    `<path d="M${f(x - 22 * s)},${f(y - 24 * s)} Q${f(x - 20 * s)},${f(y - 38 * s)} ${f(x)},${f(y - 38 * s)} Q${f(x + 22 * s)},${f(y - 38 * s)} ${f(x + 24 * s)},${f(y - 25 * s)} Q${f(x)},${f(y - 20 * s)} ${f(x - 22 * s)},${f(y - 24 * s)}Z" fill="${P.olive[0]}" stroke="${P.olive[1]}" stroke-width="1"/>` +
    `<path d="M${f(x - 14 * s)},${f(y - 33 * s)} Q${f(x - 4 * s)},${f(y - 38 * s)} ${f(x + 6 * s)},${f(y - 35 * s)}" stroke="${P.olive[2]}" stroke-width="${f(2.4 * s)}" fill="none" stroke-linecap="round"/>`;
}
function sheep(x, y, s = 1, flip = false) {
  const k = flip ? -1 : 1;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s * k)} ${f(s)})">${sh(1.5, 4.5, 8, 2.2, 0.2)}
    <path d="M-4,3 v3.4 M3,3 v3.4" stroke="#4A4740" stroke-width="1.4" stroke-linecap="round"/>
    <ellipse cx="0" cy="0" rx="7.4" ry="5" fill="#F7F3EA" stroke="#BDB5A3" stroke-width=".9"/>
    <ellipse cx="1.6" cy="1.6" rx="5" ry="2.8" fill="#DCD5C6" opacity=".8"/>
    <ellipse cx="7.4" cy="-1.6" rx="2.6" ry="2.1" fill="#4A4740"/></g>`;
}
function house(x, y, s = 1, roof = P.roof) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">${sh(6, 1, 13, 3.2, 0.22)}
    <path d="M-9,0 V-9 H5 V0 Z" fill="${P.wall}" stroke="#B9AD94" stroke-width=".9"/><path d="M5,0 V-9 L11,-12 V-3 Z" fill="#D8CDB6" stroke="#B9AD94" stroke-width=".9"/>
    <path d="M-11,-8.5 L-2,-16 L7,-8.5 Z" fill="${roof}" stroke="#8E4429" stroke-width=".9" stroke-linejoin="round"/><path d="M-2,-16 L4,-19 L13,-11.5 L7,-8.5 Z" fill="#9C4A2C" stroke="#8E4429" stroke-width=".9" stroke-linejoin="round"/>
    <rect x="-5" y="-6" width="3" height="3.6" fill="#7A8A8E"/><rect x="0" y="-5" width="2.6" height="5" fill="#7A6450"/></g>`;
}
function rock(x, y, s, c = P.slate) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">${sh(2, 0, 8, 2, 0.2)}<path d="M-8,0 L-6,-5 L-1,-8 L6,-5 L8,0 Z" fill="${c[0]}" stroke="${c[1]}" stroke-width=".9" stroke-linejoin="round"/><path d="M-1,-8 L6,-5 L8,0 L1,0 Z" fill="${c[1]}" opacity=".7"/><path d="M-6,-5 L-1,-8 L-1.5,-3.5 Z" fill="${c[2]}"/></g>`;
}
const tuft = (x, y, c, s = 1) => `<path d="M${f(x - 3 * s)},${f(y)} q.6,-4 1.4,-5 M${f(x)},${f(y)} q0,-5 .4,-7 M${f(x + 2.6 * s)},${f(y)} q.4,-4 1.6,-5" stroke="${c}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
const clear = (x, y, r = 40) => Math.hypot(x, y - 6) > r;
const inHex = (x, y, m = 8) => Math.abs(x) <= 86.6 - m && Math.abs(y) + Math.abs(x) / 1.732 <= 100 - m;

/* ------------------------------------------------------------------ terrain scenes */
function ground(id, c, light = 0.55) {
  return `<defs><linearGradient id="ag-${id}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${c[2]}"/><stop offset="${light}" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect x="-120" y="-120" width="240" height="240" fill="url(#ag-${id})"/>`;
}
const sortY = (items) => items.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join("");
const SCN = {
  wood() {
    const r = rng(21);
    let s = ground("wood", P.forest, 0.5);
    s += `<path d="M-120,-30 Q-40,-60 30,-38 Q80,-24 120,-46 V-120 H-120Z" fill="${P.forest[1]}" opacity=".25"/>`;
    const it = [];
    for (let i = 0; i < 60; i += 1) {
      const x = (r() - 0.5) * 180, y = (r() - 0.5) * 210;
      if (!inHex(x, y, 6) || !clear(x, y, 42)) continue;
      const k = r();
      it.push([y, k < 0.28 ? cypress(x, y, 22 + r() * 10) : roundTree(x, y, 6 + r() * 4, r() > 0.5 ? P.forest : P.olive)]);
    }
    return s + sortY(it);
  },
  sheep() {
    const r = rng(5);
    let s = ground("sheep", P.pasture, 0.45);
    s += `<path d="M-120,-40 Q-50,-70 10,-50 Q60,-34 120,-60 V-120 H-120Z" fill="${P.pasture[2]}" opacity=".6"/>`;
    s += `<path d="M-120,54 Q-40,30 30,50 Q80,62 120,44 V120 H-120Z" fill="${P.pasture[1]}" opacity=".35"/>`;
    const wall = (d) => `<path d="${d}" stroke="#A39C88" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#E4DDCB" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="2.4 1.6"/>`;
    s += wall("M-90,-30 Q-40,-42 4,-36 Q50,-30 90,-42");
    for (let i = 0; i < 40; i += 1) { const x = (r() - 0.5) * 170, y = (r() - 0.5) * 200; if (inHex(x, y, 10) && clear(x, y, 38)) s += tuft(x, y, P.pasture[1], 0.9); }
    s += roundTree(58, -46, 8, P.olive) + stonePine(-56, 70, 0.8);
    s += [[-40, -52, 1.1], [-14, -60, 1, 1], [20, -50, 1.05], [-58, 6, 1, 1], [40, 30, 1.1, 1], [54, 52, 1], [20, 72, 0.95, 1], [-24, 50, 1]].map(([x, y, k, fl]) => sheep(x, y, k, fl)).join("");
    return s;
  },
  wheat() {
    let s = ground("wheat", P.wheat, 0.5);
    const rows = (id, c1, c2, ang, w = 7) => `<pattern id="${id}" width="${w}" height="${w}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><rect width="${w}" height="${w}" fill="${c1}"/><rect width="${w}" height="1.4" fill="${c2}"/></pattern>`;
    s += `<defs>${rows("awa", "#F0C964", "#D6AA45", -24)}${rows("awb", "#F8DD92", "#E3BC62", 30, 6)}${rows("awc", "#E6B352", "#C99838", -4, 8)}${rows("awd", "#CFC57C", "#B0A65A", 60, 6)}</defs>`;
    s += `<path d="M-120,-56 L-4,-120 L0,-30 L-120,-6Z" fill="url(#awa)"/><path d="M0,-30 L-4,-120 L120,-56 L120,-14Z" fill="url(#awb)"/>
          <path d="M-120,-6 L0,-30 L-34,42 L-120,64Z" fill="url(#awc)"/><path d="M120,-14 L0,-30 L36,42 L120,58Z" fill="url(#awd)"/>
          <path d="M-120,64 L-34,42 L36,42 L120,58 V120 H-120Z" fill="url(#awb)"/>`;
    s += `<g stroke="#9C8A55" stroke-width="1.2" fill="none" opacity=".7"><path d="M-120,-6 L0,-30 L120,-14 M0,-30 L-4,-120 M-120,64 L-34,42 L36,42 L120,58"/></g>`;
    s += [[-70, -16], [-48, -21], [-26, -26]].map(([x, y]) => cypress(x, y, 20)).join("");
    s += house(46, -44, 1.5) + roundTree(64, -40, 6, P.olive);
    s += [[-60, 62], [-44, 66], [56, 64]].map(([x, y]) => `${sh(x + 3, y + 1, 6, 1.6)}<path d="M${x - 5},${y} Q${x - 4},${y - 9} ${x},${y - 10} Q${x + 4},${y - 9} ${x + 5},${y} Z" fill="#E9CB7E" stroke="#B48F45" stroke-width=".9"/>`).join("");
    return s;
  },
  brick() {
    let s = ground("brick", P.terra, 0.5);
    for (let i = 0; i < 4; i += 1) {
      const y = -70 + i * 22;
      s += `<path d="M-120,${y} Q-30,${y - 22} 20,${y - 8} Q70,${y + 4} 120,${y - 16}" stroke="${P.terra[1]}" stroke-width="1.2" fill="none" opacity=".5"/><path d="M-120,${y + 2.4} Q-30,${y - 19.6} 20,${y - 5.6} Q70,${y + 6.4} 120,${y - 13.6}" stroke="${P.terra[2]}" stroke-width="1.4" fill="none" opacity=".5"/>`;
    }
    s += `<g transform="translate(-30 -54)"><ellipse rx="34" ry="15" fill="${P.terra[1]}" stroke="#8C4A2D" stroke-width="1"/><ellipse cy="3" rx="24" ry="9" fill="#93502F"/><ellipse cy="5" rx="12" ry="4" fill="#7A6A5A" opacity=".6"/><path d="M-34,0 A34,15 0 0 0 34,0" stroke="${P.terra[2]}" stroke-width="1.6" fill="none"/></g>`;
    s += `<g transform="translate(46 66)">${sh(10, 2, 22, 4.5, 0.22)}<path d="M-16,0 V-10 Q-16,-24 0,-24 Q16,-24 16,-10 V0 Z" fill="#D7C2A0" stroke="#A8916E" stroke-width="1"/><path d="M4,-24 Q16,-22 16,-10 V0 H8 Q12,-12 4,-24Z" fill="#BCA582"/><path d="M-5,0 V-6 Q0,-11 5,-6 V0Z" fill="#3E3128"/><path d="M-3,0 V-4 Q0,-7 3,-4 V0Z" fill="#E59A4E"/><rect x="6" y="-34" width="6" height="12" fill="#BCA582" stroke="#A8916E" stroke-width="1"/></g>`;
    s += `<g opacity=".5" fill="#F3EDE2"><circle cx="58" cy="-40" r="4"/><circle cx="63" cy="-48" r="5.4"/><circle cx="60" cy="-58" r="4.4"/></g>`;
    const stack = (x, y) => {
      let t = sh(x + 6, y + 1.5, 14, 3, 0.22);
      for (let row = 0; row < 3; row += 1) for (let i = 0; i < 3 - row; i += 1) {
        const bx = x - 12 + i * 8 + row * 4, by = y - 4 - row * 4;
        t += `<rect x="${bx}" y="${by}" width="8" height="4" fill="${P.terra[0]}" stroke="#8C4A2D" stroke-width=".7"/><rect x="${bx}" y="${by}" width="8" height="1.2" fill="${P.terra[2]}"/>`;
      }
      return t;
    };
    s += stack(-56, 60) + stack(-34, 74) + stack(20, 76);
    s += cypress(70, 24, 22) + cypress(-74, 20, 18);
    return s;
  },
  ore() {
    let s = ground("ore", P.slate, 0.45);
    const mtn = (px, py, base, half, k = 1) => {
      const L = px - half, R = px + half;
      return `<path d="M${f(L)},${f(base)} L${f(px)},${f(py)} L${f(R)},${f(base)}Z" fill="${P.slate[0]}" stroke="${P.slate[1]}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M${f(px)},${f(py)} L${f(R)},${f(base)} L${f(px + half * 0.15)},${f(base)} L${f(px + half * 0.05)},${f(py + (base - py) * 0.5)}Z" fill="${P.slate[1]}"/>
        <path d="M${f(px)},${f(py)} L${f(px - half * 0.45)},${f(py + (base - py) * 0.55)} L${f(px - half * 0.1)},${f(py + (base - py) * 0.45)}Z" fill="${P.slate[2]}"/>
        ${k ? `<path d="M${f(px)},${f(py)} L${f(px + half * 0.22)},${f(py + (base - py) * 0.2)} L${f(px + half * 0.05)},${f(py + (base - py) * 0.17)} L${f(px - half * 0.12)},${f(py + (base - py) * 0.24)} L${f(px - half * 0.22)},${f(py + (base - py) * 0.19)}Z" fill="#EEF0EE" opacity=".85"/>` : ""}`;
    };
    s += mtn(-36, -92, -20, 46) + mtn(28, -100, -22, 52) + mtn(-70, -40, -12, 26, 0) + mtn(70, -46, -10, 28, 0);
    s += mtn(-44, 34, 82, 34, 0) + mtn(-12, 50, 86, 24, 0);
    s += `<g transform="translate(46 64)">${sh(8, 6, 22, 4, 0.2)}<path d="M-18,6 L-14,-8 L0,-16 L14,-8 L18,6Z" fill="${P.slate[0]}" stroke="${P.slate[1]}" stroke-width="1"/><path d="M-6,6 V-2 Q0,-8 6,-2 V6Z" fill="#2F3436"/><path d="M-8,6 V-3 M8,6 V-3 M-9,-4 H9" stroke="#8C6E4E" stroke-width="2"/></g>`;
    s += `<path d="M30,76 L64,90" stroke="#8C6E4E" stroke-width="1.2"/><path d="M32,80 L62,92" stroke="#8C6E4E" stroke-width="1.2"/>`;
    s += rock(-66, 18, 1.2) + rock(70, 18, 1) + rock(8, 82, 0.9);
    return s;
  },
  desert() {
    let s = ground("desert", P.desert, 0.45);
    s += `<path d="M-120,-46 Q-50,-74 10,-50 Q60,-66 120,-44 V-120 H-120Z" fill="${P.desert[1]}" opacity=".45"/><path d="M-120,-46 Q-50,-74 10,-50 Q60,-66 120,-44" stroke="${P.desert[2]}" stroke-width="2" fill="none"/>`;
    s += `<path d="M-120,56 Q-30,26 30,50 Q70,40 120,52 V120 H-120Z" fill="${P.desert[1]}" opacity=".55"/><path d="M-120,56 Q-30,26 30,50 Q70,40 120,52" stroke="${P.desert[2]}" stroke-width="2" fill="none"/>`;
    for (let i = 0; i < 6; i += 1) s += `<path d="M${-74 + i * 10},${-18 + i * 3} q10,-4 20,0" stroke="${P.desert[1]}" stroke-width="1.1" fill="none"/>`;
    for (let i = 0; i < 5; i += 1) s += `<path d="M${18 + i * 9},${10 - i * 2} q9,-3 18,0" stroke="${P.desert[1]}" stroke-width="1.1" fill="none"/>`;
    const agave = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">${sh(4, 1, 10, 2.2)}${[-60, -30, 0, 30, 60].map((a) => `<path d="M0,0 Q${f(Math.sin((a * Math.PI) / 180) * 6)},-8 ${f(Math.sin((a * Math.PI) / 180) * 12)},${f(-14 + Math.abs(a) / 8)}" stroke="#7E9A78" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join("")}</g>`;
    s += agave(-44, -30, 1.2) + agave(52, 72, 1) + agave(-30, 76, 0.8) + rock(36, -62, 1.1, P.desert) + rock(-64, 32, 1, P.desert);
    return s;
  },
};

/* ------------------------------------------------------------------ pieces (canvas specs)
   A spec is a list of primitive shapes in art units; the board renderer draws it with Path2D, the
   DOM icons serialise the same spec to SVG — one source for both. */
const home = (c) => [
  { el: "ellipse", cx: 6, cy: 15, rx: 20, ry: 5, fill: "#1B2A2A", op: 0.25, shadow: true },
  { d: "M5,16 V-1 L15,-7 V10Z", fill: c.dark, op: 0.9 },
  { d: "M5,16 V-1 L15,-7 V10Z", stroke: c.dark, sw: 1.2 },
  { d: "M-6,-18 L6,-2 L17,-8 L5,-24Z", fill: c.light, stroke: c.dark, sw: 1.2 },
  { d: "M-17,16 V-2 L-6,-18 L6,-2 V16Z", fill: c.base, stroke: c.dark, sw: 1.2 },
  { d: "M-9,5 h6 v11 h-6Z", fill: c.dark, op: 0.6 },
];
const cityArt = (c) => [
  { el: "ellipse", cx: 6, cy: 18, rx: 30, ry: 6, fill: "#1B2A2A", op: 0.25, shadow: true },
  { d: "M-28,18 V2 H-6 V18Z", fill: c.base, stroke: c.dark, sw: 1.2 },
  { d: "M-28,2 L-22,-5 H0 L-6,2Z", fill: c.light, stroke: c.dark, sw: 1.2 },
  { d: "M14,18 V-10 L23,-15 V13Z", fill: c.dark, stroke: c.dark, sw: 1.2 },
  { d: "M1,-30 L14,-10 L23,-15 L10,-34Z", fill: c.light, stroke: c.dark, sw: 1.2 },
  { d: "M-12,18 V-10 L1,-30 L14,-10 V18Z", fill: c.base, stroke: c.dark, sw: 1.2 },
  { el: "circle", cx: 1, cy: -10, r: 3.4, fill: c.dark, op: 0.55 },
  { d: "M-2,6 h6 v12 h-6Z", fill: c.dark, op: 0.6 },
  { d: "M-23,7 h4 v5 h-4Z M-15,7 h4 v5 h-4Z", fill: c.dark, op: 0.45 },
];
const robberSpec = [
  { d: "M-15,32 Q-17,10 -8,0 Q-14,-6 -12,-16 Q-9,-32 0,-32 Q9,-32 12,-16 Q14,-6 8,0 Q17,10 15,32 Z", fill: "#454D52", dropShadow: true },
  { d: "M0,-32 Q9,-32 12,-16 Q14,-6 8,0 Q17,10 15,32 L4,32 Q10,8 3,0 Q10,-12 0,-32Z", fill: "#2F3539" },
  { d: "M-8,-22 Q-5,-29 0,-29", stroke: "#6F7A80", sw: 2, cap: "round" },
  { d: "M-7,-12 Q0,-8 7,-12 V-8 Q0,-4 -7,-8Z", fill: "#1E2326" },
  { el: "circle", cx: -3, cy: -10, r: 1.2, fill: "#F2E8D0" },
  { el: "circle", cx: 3, cy: -10, r: 1.2, fill: "#F2E8D0" },
];

/** Serialise a canvas spec to SVG markup (used by DOM icons). */
function specSvg(spec) {
  return spec.map((s) => {
    const paint = `fill="${s.fill || "none"}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw || 1}" stroke-linejoin="round"` : ""}${s.cap ? ` stroke-linecap="${s.cap}"` : ""}${s.op != null ? ` opacity="${s.op}"` : ""}`;
    if (s.el === "ellipse") return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${paint}/>`;
    if (s.el === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
    return `<path d="${s.d}" ${paint}/>`;
  }).join("");
}
const homeSvg = (c) => specSvg(home(c));
const citySvg = (c) => specSvg(cityArt(c));
const robberSvg = specSvg(robberSpec);

/* ------------------------------------------------------------------ icons
   One style: flat two-tone fills, outline = darker tint of the fill, light from the upper-left. */
const o = (c, w = 2) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round"`;
const ICONS = {};
ICONS.wood = `${sh(4, 40, 34, 5, 0.14)}<g ${o("#4A3726")}><rect x="-34" y="18" width="64" height="12" rx="6" fill="#B48A5E"/><rect x="-26" y="6" width="58" height="12" rx="6" fill="#C79C6C"/></g><g ${o("#4A3726")}><circle cx="-34" cy="24" r="6" fill="#E3C9A0"/><circle cx="-26" cy="12" r="6" fill="#E3C9A0"/></g><circle cx="-34" cy="24" r="2.4" fill="none" stroke="#B48A5E" stroke-width="1.2"/><circle cx="-26" cy="12" r="2.4" fill="none" stroke="#B48A5E" stroke-width="1.2"/>
  <path d="M14,-44 C24,-30 26,-10 14,4 C2,-10 4,-30 14,-44Z" fill="${P.cypress[0]}" ${o(P.cypress[1])}/><path d="M14,-44 C24,-30 26,-10 14,4 C18,-14 18,-30 14,-44Z" fill="${P.cypress[1]}"/>
  <circle cx="-8" cy="-16" r="15" fill="${P.forest[0]}" ${o(P.forest[1])}/><path d="M-8,-1 V8" stroke="#6B5A43" stroke-width="3"/><circle cx="-13" cy="-21" r="6" fill="${P.forest[2]}"/>`;
ICONS.brick = `${sh(4, 38, 38, 5, 0.14)}${[[-30, 16], [0, 16], [-15, -2], [15, -2], [0, -20]].map(([x, y]) => `<g ${o("#7E3C22")}><path d="M${x},${y} l6,-5 h24 l-6,5Z" fill="${P.terra[2]}"/><path d="M${x + 24},${y} l6,-5 v14 l-6,5Z" fill="${P.terra[1]}"/><rect x="${x}" y="${y}" width="24" height="14" fill="${P.terra[0]}"/></g>`).join("")}`;
ICONS.sheep = `${sh(4, 36, 34, 5, 0.14)}<path d="M-14,20 v14 M10,20 v14 M-4,22 v12 M20,18 v14" stroke="#4A4740" stroke-width="4" stroke-linecap="round"/>
  <path d="M-30,6 Q-34,-14 -16,-18 Q-10,-30 6,-24 Q22,-30 28,-14 Q38,-4 30,12 Q24,26 4,24 Q-18,28 -26,18 Q-36,16 -30,6Z" fill="#F7F3EA" ${o("#A9A190")}/>
  <path d="M30,-14 Q38,-4 30,12 Q24,26 4,24 Q20,14 30,-14Z" fill="#DDD6C6"/><ellipse cx="-30" cy="-6" rx="11" ry="9" fill="#4A4740" ${o("#2F2D29")}/><circle cx="-33" cy="-8" r="1.6" fill="#F7F3EA"/>`;
ICONS.wheat = `${sh(0, 40, 24, 4, 0.14)}${[[-16, -2, -16], [0, -10, 0], [16, -2, 16]].map(([, y, r]) => `<g transform="rotate(${r} 0 36)"><path d="M0,36 V${y + 30}" stroke="#A8833A" stroke-width="3"/><g transform="translate(0 ${y})">${[0, 1, 2, 3].map((k) => `<ellipse cx="-5" cy="${18 - k * 11}" rx="5.4" ry="8" fill="${P.wheat[k % 2 ? 0 : 2]}" stroke="#A8833A" stroke-width="1.6" transform="rotate(-24 -5 ${18 - k * 11})"/><ellipse cx="5" cy="${18 - k * 11}" rx="5.4" ry="8" fill="${P.wheat[k % 2 ? 2 : 0]}" stroke="#A8833A" stroke-width="1.6" transform="rotate(24 5 ${18 - k * 11})"/>`).join("")}<ellipse cx="0" cy="-26" rx="5" ry="8" fill="${P.wheat[2]}" stroke="#A8833A" stroke-width="1.6"/></g></g>`).join("")}<rect x="-12" y="26" width="24" height="6" rx="2" fill="${P.roof}" stroke="#8E4429" stroke-width="1.4"/>`;
const nug = (x, y, k, c1, c2, c3) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-16,8 L-12,-8 L0,-14 L13,-7 L16,8 L4,13Z" fill="${c1}" ${o("#4E5C6E", 1.8)}/><path d="M0,-14 L13,-7 L16,8 L4,13 L2,-2Z" fill="${c2}"/><path d="M-12,-8 L0,-14 L2,-2 L-9,1Z" fill="${c3}"/><path d="M-16,8 L-12,-8 L0,-14 L13,-7 L16,8 L4,13Z" fill="none" ${o("#4E5C6E", 1.8)}/></g>`;
ICONS.ore = `${sh(4, 38, 38, 5, 0.14)}${nug(-16, 22, 1.25, "#9AA9BB", "#71839A", "#D2DCE7")}${nug(18, 24, 1.05, "#8797AB", "#64758C", "#C6D2DE")}${nug(2, -4, 1.35, "#A9B7C7", "#7C8DA3", "#E3EAF1")}<path d="M-2,-22 l2,-6 2,6 6,2 -6,2 -2,6 -2,-6 -6,-2Z" fill="#FFFFFF"/><path d="M26,6 l1.4,-4 1.4,4 4,1.4 -4,1.4 -1.4,4 -1.4,-4 -4,-1.4Z" fill="#F4F7FA"/>`;
ICONS.desert = `${sh(0, 38, 40, 5, 0.14)}<path d="M-44,36 Q-20,10 6,22 Q26,8 44,24 V36Z" fill="${P.desert[0]}" ${o(P.desert[1])}/><g transform="translate(-6 18)">${[-60, -30, 0, 30, 60].map((a) => `<path d="M0,0 Q${f(Math.sin((a * Math.PI) / 180) * 10)},-14 ${f(Math.sin((a * Math.PI) / 180) * 22)},${f(-26 + Math.abs(a) / 6)}" stroke="#7E9A78" stroke-width="5" fill="none" stroke-linecap="round"/>`).join("")}</g><circle cx="24" cy="-26" r="10" fill="#EBC46A" opacity=".9"/>`;
ICONS.knight = `${sh(2, 42, 30, 5, 0.14)}<g transform="rotate(-36)"><rect x="-3" y="-50" width="6" height="64" rx="2" fill="#D9DEE0" ${o("#7F8A90", 1.6)}/><rect x="-12" y="14" width="24" height="5" rx="2" fill="#C9A04A" ${o("#8A6A2C", 1.4)}/><rect x="-2.5" y="19" width="5" height="14" fill="#7A5A3C"/></g>
  <path d="M-28,-28 H28 V0 Q28,28 0,40 Q-28,28 -28,0Z" fill="${PC.blue.base}" ${o(PC.blue.dark)}/><path d="M0,-28 H28 V0 Q28,28 0,40Z" fill="${PC.blue.dark}" opacity=".45"/><path d="M-22,-22 H22 V0 Q22,22 0,32 Q-22,22 -22,0Z" fill="none" stroke="#E2C27A" stroke-width="1.6"/>
  <path d="M-10,16 V-4 h-3 v-9 h5 v4 h4 v-4 h8 v4 h4 v-4 h5 v9 h-3 V16Z" fill="#F4EEE1" ${o("#A69A7E", 1.2)}/><path d="M-3,16 v-7 q3,-4 6,0 v7Z" fill="${PC.blue.dark}"/>`;
ICONS.roadBuilding = `${sh(0, 40, 40, 5, 0.14)}<path d="M-40,38 Q-16,20 0,4 Q14,-10 6,-30" stroke="#B9A57E" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M-40,38 Q-16,20 0,4 Q14,-10 6,-30" stroke="#E7D7B2" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M-36,34 Q-16,20 0,4 Q12,-8 6,-26" stroke="#FBF6EA" stroke-width="2" stroke-dasharray="5 5" fill="none"/>
  <path d="M24,40 V-36" stroke="#6B5A43" stroke-width="4"/><g ${o("#7A4A2C", 1.6)}><path d="M24,-34 H44 L50,-28 L44,-22 H24Z" fill="${P.roof}"/><path d="M24,-18 H6 L0,-12 L6,-6 H24Z" fill="${P.terra[2]}"/></g>`;
ICONS.yearOfPlenty = `${sh(4, 40, 38, 5, 0.14)}<path d="M-40,-30 Q-44,-14 -30,-8 Q-14,-2 0,-14 L8,22 Q-20,30 -34,12 Q-48,-6 -40,-30Z" fill="#C9A06A" ${o("#7A5A3C")}/><path d="M-40,-30 Q-36,-20 -26,-18" stroke="#7A5A3C" stroke-width="2" fill="none"/>
  <path d="M-16,-4 Q-20,10 -26,14 M-6,-10 Q-6,6 -12,18" stroke="#A9834F" stroke-width="2" fill="none"/>
  <ellipse cx="4" cy="4" rx="9" ry="19" transform="rotate(-18 4 4)" fill="#E2C89A" ${o("#7A5A3C")}/>
  <circle cx="20" cy="-6" r="10" fill="${P.roof}" ${o("#8E4429", 1.6)}/><circle cx="17" cy="-9" r="3" fill="#E9A07E"/>
  <circle cx="28" cy="14" r="9" fill="${P.wheat[0]}" ${o("#8A6A2C", 1.6)}/><circle cx="12" cy="26" r="8" fill="${P.olive[0]}" ${o(P.olive[1], 1.6)}/><circle cx="34" cy="32" r="6" fill="#7E5A8A" ${o("#5A3E66", 1.4)}/>
  <path d="M20,-16 q2,-8 8,-10" stroke="${P.olive[1]}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
ICONS.monopoly = `${sh(0, 40, 36, 5, 0.14)}<path d="M-30,30 V22 H30 V30Z" fill="#B78D3E" ${o("#7A5A22")}/><path d="M-32,22 L-38,-16 L-18,0 L0,-30 L18,0 L38,-16 L32,22Z" fill="#E2C27A" ${o("#8A6A2C")}/><path d="M0,-30 L18,0 L38,-16 L32,22 H6Z" fill="#C9A04A" opacity=".7"/>
  <circle cx="0" cy="8" r="5" fill="${PC.blue.base}" ${o(PC.blue.dark, 1.2)}/><circle cx="-18" cy="10" r="3.6" fill="${P.roof}"/><circle cx="18" cy="10" r="3.6" fill="${P.olive[0]}"/>`;
ICONS.victoryPoint = `${sh(0, 42, 26, 4.5, 0.14)}<path d="M-20,-34 Q-40,-34 -34,-16 Q-30,-4 -14,-2 M20,-34 Q40,-34 34,-16 Q30,-4 14,-2" stroke="#B78D3E" stroke-width="4" fill="none"/><path d="M-24,-40 H24 Q24,4 0,10 Q-24,4 -24,-40Z" fill="#E2C27A" ${o("#8A6A2C")}/><path d="M2,-40 H24 Q24,4 2,10Z" fill="#C9A04A" opacity=".7"/>
  <path d="M-5,10 h10 l3,16 h-16Z" fill="#C9A04A" ${o("#8A6A2C", 1.6)}/><rect x="-20" y="26" width="40" height="10" rx="2" fill="#6B5A43" ${o("#4A3726", 1.6)}/><path d="M0,-30 l4,8 9,1.3 -6.5,6.3 1.5,9 -8,-4.2 -8,4.2 1.5,-9 -6.5,-6.3 9,-1.3Z" fill="#FBF6EA"/>`;
ICONS.road = `${sh(4, 26, 40, 5, 0.14)}<g transform="rotate(-22)"><rect x="-40" y="-8" width="80" height="16" rx="8" fill="${PC.blue.base}" ${o(PC.blue.dark)}/><path d="M-32,-3 H30" stroke="${PC.blue.light}" stroke-width="2.4" stroke-linecap="round"/></g>`;
ICONS.settlement = `<g transform="translate(-6 4) scale(1.9)">${homeSvg(PC.blue)}</g>`;
ICONS.city = `<g transform="translate(0 4) scale(1.45)">${citySvg(PC.blue)}</g>`;
ICONS.trade = `<path d="M-36,-10 Q-36,-28 -14,-28 H14 V-38 L36,-20 L14,-2 V-12 H-12 Q-20,-12 -20,-4Z" fill="${P.roof}" ${o("#8E4429")}/><path d="M36,10 Q36,28 14,28 H-14 V38 L-36,20 L-14,2 V12 H12 Q20,12 20,4Z" fill="${P.sea1}" ${o(P.sea0)}/>`;
ICONS.bank = `${sh(0, 42, 40, 5, 0.14)}<path d="M-40,-14 L0,-38 L40,-14Z" fill="${P.terra[0]}" ${o(P.terra[1])}/><rect x="-38" y="-14" width="76" height="7" fill="#F4EEE1" ${o("#A69A7E")}/><g fill="#F4EEE1" ${o("#A69A7E", 1.6)}>${[-28, -10, 6, 22].map((x) => `<rect x="${x}" y="-7" width="8" height="34"/>`).join("")}</g><rect x="-42" y="27" width="84" height="9" rx="1.5" fill="${P.wheat[2]}" ${o("#B48F45")}/><circle cx="0" cy="-22" r="5" fill="#E2C27A" ${o("#8A6A2C", 1.4)}/>`;
const PIPS = { 1: [[0, 0]], 2: [[-13, -13], [13, 13]], 3: [[-13, -13], [0, 0], [13, 13]], 4: [[-13, -13], [13, -13], [-13, 13], [13, 13]], 5: [[-13, -13], [13, -13], [0, 0], [-13, 13], [13, 13]], 6: [[-13, -15], [13, -15], [-13, 0], [13, 0], [-13, 15], [13, 15]] };
const dieFace = (n, x = 0, y = 0, r = 0, s = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><rect x="-32" y="-30" width="66" height="66" rx="14" fill="#D9CFB8"/><rect x="-34" y="-34" width="66" height="66" rx="14" fill="#FBF6EA" ${o("#A69A7E", 2)}/>${PIPS[n].map(([px, py]) => `<circle cx="${px - 1}" cy="${py - 1}" r="5.6" fill="${n === 1 ? P.roof : P.ink}"/>`).join("")}</g>`;
ICONS.dice = `${sh(2, 40, 40, 5, 0.14)}${dieFace(3, -16, 10, -10, 0.62)}${dieFace(5, 18, -8, 12, 0.58)}`;
ICONS.endTurn = `${sh(0, 42, 24, 4, 0.14)}<path d="M-20,-36 H20 M-20,36 H20" stroke="#B9651F" stroke-width="5" stroke-linecap="round"/><path d="M-16,-34 Q-16,-8 0,0 Q-16,8 -16,34 H16 Q16,8 0,0 Q16,-8 16,-34Z" fill="#F4EEE1" fill-opacity=".8" ${o("#A69A7E")}/><path d="M-9,-20 Q0,-12 9,-20Z M-12,30 Q0,14 12,30Z" fill="${P.wheat[0]}"/>`;
ICONS.hint = `<circle cy="-12" r="34" fill="#F8DA8E" opacity=".35"/><path d="M0,-36 Q24,-36 24,-12 Q24,2 12,12 V22 H-12 V12 Q-24,2 -24,-12 Q-24,-36 0,-36Z" fill="#F6CE6A" ${o("#B48F45")}/><rect x="-11" y="22" width="22" height="12" rx="3" fill="#A9B2B6" ${o("#6C777E", 1.6)}/><path d="M-10,-20 Q-8,-28 0,-28" stroke="#FBF6EA" stroke-width="3" fill="none" stroke-linecap="round"/>`;
const gear = (() => {
  let d = "";
  for (let i = 0; i < 16; i += 1) {
    const a = (i * Math.PI) / 8, r = i % 2 ? 28 : 36;
    d += (i ? "L" : "M") + f(Math.cos(a - 0.14) * r) + "," + f(Math.sin(a - 0.14) * r) + " L" + f(Math.cos(a + 0.14) * r) + "," + f(Math.sin(a + 0.14) * r) + " ";
  }
  return d + "Z";
})();
ICONS.settings = `<path d="${gear}" fill="#5DB3B5" ${o("#2B8C98")}/><circle r="20" fill="#3CA9B0" opacity=".35"/><circle r="11" fill="#FBF6EA" ${o("#2B8C98")}/>`;
ICONS.log = `<rect x="-30" y="-36" width="8" height="72" rx="3" fill="#3CA9B0" ${o("#2B8C98")}/><rect x="-26" y="-36" width="52" height="72" rx="4" fill="#FBF6EA" ${o("#2B8C98")}/><path d="M-16,-20 H16 M-16,-8 H16 M-16,4 H10 M-16,16 H14" stroke="#9CCFCB" stroke-width="3" stroke-linecap="round"/><path d="M14,-36 V-14 l6,-5 6,5 V-36" fill="${P.roof}"/>`;
ICONS.robber = `<g transform="scale(1.15)">${robberSvg}</g>`;
ICONS.longestRoad = `<path d="M-42,38 Q-36,8 -8,10 Q20,12 16,-10 Q12,-30 36,-36" fill="none" stroke="#B9A57E" stroke-width="16" stroke-linecap="round"/><path d="M-42,38 Q-36,8 -8,10 Q20,12 16,-10 Q12,-30 36,-36" fill="none" stroke="#E7D7B2" stroke-width="12" stroke-linecap="round"/>
  <g transform="translate(-18 -18)"><path d="M-7,6 L-12,26 -5,22 -2,28 2,10Z M7,6 L12,26 5,22 2,28 -2,10Z" fill="${P.roof}" ${o("#8E4429", 1.4)}/><circle r="14" fill="#E2C27A" ${o("#8A6A2C")}/><circle r="9" fill="none" stroke="#C9A04A" stroke-width="1.6"/></g>`;
ICONS.largestArmy = `${sh(0, 40, 30, 5, 0.14)}<path d="M-24,32 V-6 Q-24,-34 0,-34 Q24,-34 24,-6 V32Z" fill="#C2C9CE" ${o("#6C777E")}/><path d="M0,-34 Q24,-34 24,-6 V32 H6 V-34Z" fill="#8C969C" opacity=".6"/><path d="M-16,-6 H16 M0,-6 V20" stroke="#3B444B" stroke-width="6" stroke-linecap="round"/><path d="M0,-34 Q10,-46 26,-42" stroke="${P.roof}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
ICONS.vp = `<path d="M0,-38 l11,22.6 25,3.6 -18,17.6 4.3,24.8 -22.3,-11.7 -22.3,11.7 4.3,-24.8 -18,-17.6 25,-3.6Z" fill="#E2C27A" ${o("#8A6A2C")}/><path d="M0,-38 l11,22.6 25,3.6 -18,17.6 4.3,24.8 -22.3,-11.7Z" fill="#C9A04A" opacity=".6"/>`;
ICONS.cards = `<g ${o("#B48F45")}><rect x="-30" y="-32" width="38" height="54" rx="5" fill="${P.wheat[0]}" transform="rotate(-14 -11 -5)"/><rect x="-14" y="-30" width="38" height="54" rx="5" fill="${P.olive[0]}" transform="rotate(3 5 -3)"/><rect x="-2" y="-24" width="38" height="54" rx="5" fill="#FBF6EA" transform="rotate(17 17 3)"/></g><circle cx="17" cy="4" r="7" fill="${P.terra[0]}" transform="rotate(17 17 3)"/>`;
ICONS.devcard = `<rect x="-24" y="-34" width="48" height="68" rx="6" fill="${P.sea0}" ${o("#1E4E55")}/><rect x="-17" y="-27" width="34" height="54" rx="3" fill="none" stroke="#E2C27A" stroke-width="1.6"/><path d="M0,-12 l4.6,9.4 10.4,1.5 -7.5,7.3 1.8,10.3 -9.3,-4.9 -9.3,4.9 1.8,-10.3 -7.5,-7.3 10.4,-1.5Z" fill="#E2C27A"/>`;
ICONS.build = `<g transform="rotate(-38)"><rect x="-4" y="-12" width="8" height="54" rx="3" fill="${P.terra[0]}" ${o(P.terra[1], 1.8)}/><path d="M-24,-28 H16 Q26,-28 26,-20 V-12 H-24Z" fill="#93A2B4" ${o("#62738A")}/></g><path d="M-34,40 H20" stroke="#EDC25E" stroke-width="3" stroke-linecap="round"/>`;
ICONS.fit = `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M-32,-12 V-32 H-12 M12,-32 H32 V-12 M32,12 V32 H12 M-12,32 H-32 V12"/></g><path d="${hexPath(0, 0, 14)}" fill="currentColor" opacity=".6"/>`;
const zoom = (plus) => `<circle cx="-6" cy="-6" r="22" fill="none" stroke="currentColor" stroke-width="6"/><path d="M10,10 L30,30" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M-16,-6 h20${plus ? " M-6,-16 v20" : ""}" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`;
ICONS.zoomIn = zoom(1);
ICONS.zoomOut = zoom(0);
ICONS.logo = `<path d="${hexPath(0, 0, 44)}" fill="${P.sea1}"/><path d="M-36,16 Q-24,-10 0,-6 Q22,-30 38,10 L38,22 L0,44 L-38,22Z" fill="${P.olive[0]}"/><path d="M-38,22 Q0,34 38,22 L0,44Z" fill="${P.sand}"/><circle cx="16" cy="-20" r="8" fill="#E9C46A"/><path d="${hexPath(0, 0, 44)}" fill="none" stroke="#1E4E55" stroke-width="2.4"/>`;
ICONS.close = `<path d="M-18,-18 L18,18 M18,-18 L-18,18" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`;
ICONS.check = `<path d="M-24,0 L-8,16 L24,-18" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
ICONS.chevron = `<path d="M-16,-6 L0,10 L16,-6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
ICONS.plus = `<path d="M0,-20 V20 M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`;
ICONS.minus = `<path d="M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`;

/* ------------------------------------------------------------------ avatars: flat illustrated portraits */
const face = (skin, sk2, ink, mood = 0) => `<ellipse cx="0" cy="-6" rx="17" ry="20" fill="${skin}" stroke="${sk2}" stroke-width="1.2"/>
  <path d="M6,-24 Q17,-18 17,-4 Q16,10 4,14 Q12,0 6,-24Z" fill="${sk2}" opacity=".35"/>
  <path d="M-10,-12 q4,-2.4 7,0 M3,-12 q4,-2.4 7,0" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="-6.5" cy="-6.5" rx="1.7" ry="2.1" fill="${ink}"/><ellipse cx="6.5" cy="-6.5" rx="1.7" ry="2.1" fill="${ink}"/>
  <path d="M0.5,-4 Q-1.5,2 1.5,3" stroke="${sk2}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <path d="M-5,${7 + mood} Q0,${10 - mood} 5,${7 + mood}" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="-10" cy="2" r="3.2" fill="#E8907A" opacity=".22"/><circle cx="10" cy="2" r="3.2" fill="#E8907A" opacity=".22"/>`;
const bust = (bg, cloth, cl2, skin, sk2) => `<circle r="50" fill="${bg}"/><path d="M-38,52 Q-38,20 0,18 Q38,20 38,52Z" fill="${cloth}" stroke="${cl2}" stroke-width="1.2"/><path d="M-7,8 h14 v12 q-7,5 -14,0Z" fill="${sk2}"/>`;
const AVP = {
  you: () => bust("#DEE8F8", "#4A7FD6", "#2C5BA8", "#EDC7A6", "#C9997A") + `<path d="M-19,-10 Q-22,-34 0,-32 Q22,-34 19,-10 Q14,-24 0,-22 Q-12,-24 -19,-10Z" fill="#5A3E2B" stroke="#3E2A1D" stroke-width="1.2"/>` + face("#EDC7A6", "#C9997A", "#3A2A20") + `<path d="M-17,-14 Q-10,-30 6,-26" stroke="#5A3E2B" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  trader: () => bust("#FBE6CF", "#F2934A", "#B9651F", "#C99372", "#A3705A") + `<path d="M-20,-16 Q-27,12 -21,30 Q-15,33 -11,26 Q-15,6 -13,-10Z M20,-16 Q27,12 21,30 Q15,33 11,26 Q15,6 13,-10Z" fill="#3A2722" stroke="#241815" stroke-width="1"/>` + face("#C99372", "#A3705A", "#2B1E1A", -1) + `<path d="M-30,-20 Q0,-30 30,-20 Q24,-16 0,-18 Q-24,-16 -30,-20Z" fill="#6B4425" stroke="#4A2E18" stroke-width="1.2"/><path d="M-15,-20 Q-14,-38 0,-38 Q14,-38 15,-20Z" fill="#7E5230" stroke="#4A2E18" stroke-width="1.2"/><path d="M-14,-24 H14" stroke="#E5B04A" stroke-width="2.4"/><circle cx="17" cy="0" r="2" fill="#E5B04A"/>`,
  builder: () => bust("#EEE7D8", "#7D6B52", "#55473A", "#E3B08C", "#BC8466") + face("#E3B08C", "#BC8466", "#33261E") + `<path d="M-15,4 Q-15,24 0,26 Q15,24 15,4 Q8,12 0,11 Q-8,12 -15,4Z" fill="#9A5B33" stroke="#6E3E22" stroke-width="1.2"/><path d="M-19,-16 Q-19,-36 0,-36 Q19,-36 19,-16Z" fill="#E1A93C" stroke="#A9781F" stroke-width="1.2"/><rect x="-23" y="-18" width="46" height="5" rx="2" fill="#C9902A" stroke="#A9781F" stroke-width="1"/>`,
  shark: () => bust("#E1E6EB", "#3E4752", "#232A31", "#EBC9AE", "#C49A80") + `<path d="M-8,18 L0,30 L8,18" fill="#F6F0E3" stroke="#9AA3AB" stroke-width="1"/>` + face("#EBC9AE", "#C49A80", "#22282E", -1.5) + `<path d="M-10,-12 q4,-4 7,-1 M3,-13 q4,-3 7,1" stroke="#22282E" stroke-width="1.8" fill="none"/><path d="M-19,-17 Q-21,-37 0,-37 Q21,-37 19,-17Z" fill="#2A323A" stroke="#11161A" stroke-width="1.2"/><path d="M-20,-18 Q0,-13 24,-20 L23,-14 Q2,-8 -20,-13Z" fill="#11161A"/><path d="M-19,-22 Q0,-17 19,-22" stroke="#E2C27A" stroke-width="1.6" fill="none"/><circle cx="0" cy="-28" r="2.6" fill="#E2C27A"/><path d="M-4,4 Q2,7 7,5" stroke="#22282E" stroke-width="1.2" fill="none"/>`,
  beginner: () => bust("#E9F2DA", "#8AAE58", "#6A8E42", "#F1D2B6", "#CFA588") + `<path d="M-19,-6 Q-24,-34 0,-32 Q24,-34 19,-6 Q18,-22 4,-24 Q-14,-26 -19,-6Z" fill="#C8873E" stroke="#9A6328" stroke-width="1.2"/>` + face("#F1D2B6", "#CFA588", "#3A2A20", 1) + `<path d="M0,-32 Q-3,-42 -11,-44 Q-5,-37 0,-32 Q4,-41 12,-41 Q6,-35 0,-32" fill="#5A7B34"/>`,
  intermediate: () => bust("#D8F0EE", "#3CA9B0", "#2B8C98", "#DDB08E", "#B88566") + `<path d="M-19,-8 Q-21,-34 0,-32 Q21,-34 19,-8 Q16,-20 6,-22 Q-4,-16 -19,-8Z" fill="#2C2622" stroke="#1A1614" stroke-width="1.2"/>` + face("#DDB08E", "#B88566", "#2A2420") + `<g fill="none" stroke="#5C4A3A" stroke-width="1.6"><circle cx="-6.5" cy="-6.5" r="5.4"/><circle cx="6.5" cy="-6.5" r="5.4"/><path d="M-1.2,-7 h2.4"/></g>`,
  expert: () => bust("#F5E7CC", "#8B5FA8", "#62407A", "#EED0B8", "#C8A48C") + `<path d="M-18,-8 Q-22,-32 0,-31 Q22,-32 18,-8 Q16,-18 0,-20 Q-16,-18 -18,-8Z" fill="#E6E2DA" stroke="#B8B2A6" stroke-width="1.2"/>` + face("#EED0B8", "#C8A48C", "#3A2E28") + `<path d="M-20,-22 Q-10,-30 0,-28 Q10,-30 20,-22" stroke="#C9A04A" stroke-width="3" fill="none"/>${[-16, -8, 8, 16].map((x) => `<ellipse cx="${x}" cy="${-26 - (Math.abs(x) < 10 ? 2 : 0)}" rx="3" ry="1.6" fill="#7A9B47" transform="rotate(${x * 2} ${x} -26)"/>`).join("")}`,
};

/* ------------------------------------------------------------------ cards */
const CARD = {
  wood: { acc: "#57744A" }, brick: { acc: "#A35837" }, sheep: { acc: "#7E8C4E" }, wheat: { acc: "#B08A3A" }, ore: { acc: "#5F6B72" },
  knight: { acc: "#2F5FA6", sky: ["#E9EEF2", "#C9D6DE"] }, roadBuilding: { acc: "#A35837", sky: ["#F4EBDA", "#E2D3B3"] }, yearOfPlenty: { acc: "#7E8C4E", sky: ["#F4EDD6", "#E6D9A8"] },
  monopoly: { acc: "#8A6A2C", sky: ["#F3E9D8", "#E3D0AE"] }, victoryPoint: { acc: "#B08A3A", sky: ["#F6EEDC", "#EAD9B2"] },
};
function card(k, mini) {
  const c = CARD[k], res = RESOURCE_KEYS.includes(k), id = "ca" + k + (mini ? "m" : ""), name = RES_NAME[k] || DEV_NAME[k];
  const W = mini ? { x: 14, y: 14, w: 222, h: 254 } : { x: 18, y: 18, w: 214, h: 196 };
  const cx = W.x + W.w / 2, cy = W.y + W.h / 2;
  const scene = res
    ? `<g transform="translate(${cx} ${cy + 6}) scale(${mini ? 1.55 : 1.35})"><use href="#ta-${k}" x="-87" y="-100" width="174" height="200"/></g>`
    : `<rect x="0" y="0" width="250" height="350" fill="url(#${id}-sky)"/><path d="M0,${cy + 40} Q60,${cy + 10} 120,${cy + 30} Q190,${cy + 6} 250,${cy + 28} V350 H0Z" fill="${P.olive[2]}" opacity=".55"/><path d="M0,${cy + 62} Q80,${cy + 44} 150,${cy + 58} Q210,${cy + 50} 250,${cy + 60} V350 H0Z" fill="${P.olive[0]}" opacity=".5"/>${cypress(cx - 78, cy + 52, 34)}${cypress(cx - 64, cy + 56, 26)}${cypress(cx + 80, cy + 50, 30)}`;
  const hero = res
    ? `<ellipse cx="${cx}" cy="${cy + (mini ? 70 : 56)}" rx="${mini ? 70 : 56}" ry="${mini ? 16 : 13}" fill="#FBF6EA" opacity=".35"/><g transform="translate(${cx} ${cy + (mini ? 34 : 26)}) scale(${mini ? 1.15 : 0.95})">${ICONS[k]}</g>`
    : `<g transform="translate(${cx} ${cy + (mini ? 0 : 2)}) scale(${mini ? 1.75 : 1.45})">${ICONS[k]}</g>`;
  const ty = mini ? 312 : 262;
  return `<defs><clipPath id="${id}-w"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="10"/></clipPath><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky ? c.sky[0] : "#fff"}"/><stop offset="1" stop-color="${c.sky ? c.sky[1] : "#fff"}"/></linearGradient>
    <linearGradient id="${id}-veil" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#FBF6EA" stop-opacity="0"/><stop offset="1" stop-color="#1E2A2E" stop-opacity=".18"/></linearGradient></defs>
    <rect x="1" y="1" width="248" height="348" rx="16" fill="#FBF6EA" stroke="#D8CCB0" stroke-width="1.4"/>
    <rect x="7" y="7" width="236" height="336" rx="12" fill="none" stroke="${c.acc}" stroke-opacity=".55" stroke-width="1"/>
    <g clip-path="url(#${id}-w)">${scene}${hero}<rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" fill="url(#${id}-veil)"/></g>
    <rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="10" fill="none" stroke="#5C5440" stroke-opacity=".25" stroke-width="1"/>
    ${mini ? `<text x="125" y="${ty}" text-anchor="middle" font-family="DM Serif Display, Georgia, serif" font-size="${name.length > 11 ? 27 : 34}" fill="${P.ink}">${name}</text>`
      : `<text x="125" y="240" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" font-weight="700" font-size="10" letter-spacing="2.6" fill="${c.acc}">${res ? "RESOURCE" : "DEVELOPMENT"}</text>
    <text x="125" y="${ty + 6}" text-anchor="middle" font-family="DM Serif Display, Georgia, serif" font-size="${name.length > 11 ? 25 : 30}" fill="${P.ink}">${name}</text>
    <path d="M78,${ty + 20} H116 M134,${ty + 20} H172" stroke="${c.acc}" stroke-opacity=".6" stroke-width="1"/><path d="M125,${ty + 16} l4,4 -4,4 -4,-4Z" fill="${c.acc}" opacity=".8"/>
    <text x="125" y="${ty + 44}" text-anchor="middle" font-family="DM Sans, system-ui, sans-serif" font-weight="500" font-size="13" fill="#5E676A">${wrap(CARD_TEXT[k], 30).map((l, i) => `<tspan x="125" dy="${i ? 16 : 0}">${l}</tspan>`).join("")}</text>`}`;
}
const cardBack = () => `<rect x="1" y="1" width="248" height="348" rx="16" fill="${P.sea0}" stroke="#1E4E55" stroke-width="1.4"/><rect x="9" y="9" width="232" height="332" rx="11" fill="none" stroke="#E2C27A" stroke-opacity=".7" stroke-width="1.2"/>
  <g opacity=".14" stroke="#fff" stroke-width="1.4" fill="none">${Array.from({ length: 12 }, (_, i) => `<path d="M20,${36 + i * 26} q13,-6 26,0 t26,0 t26,0 t26,0 t26,0 t26,0 t26,0 t26,0"/>`).join("")}</g>
  <g transform="translate(125 175) scale(1.5)">${ICONS.logo}</g>`;

/* ------------------------------------------------------------------ board layers (baked once per size) */
const boardDefs = () => `${Object.entries(SCN).map(([k, fn]) => `<symbol id="ta-${k}" viewBox="-87 -100 174 200" overflow="visible">${fn()}</symbol>`).join("")}
  <linearGradient id="a-light" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#FFF6DE" stop-opacity=".22"/><stop offset=".5" stop-color="#FFF6DE" stop-opacity="0"/><stop offset="1" stop-color="#14262A" stop-opacity=".16"/></linearGradient>
  <filter id="a-coast" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="30"/></filter>
  <filter id="a-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="a-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="3" stdDeviation="2.4" flood-color="#1B2A2A" flood-opacity=".28"/></filter>
  <clipPath id="a-hexclip"><path d="${HEX}"/></clipPath>`;

/** Shallows + beach under the tiles. `centers` = hex centres in art units. */
function island(centers) {
  const p = (grow) => centers.map((h) => hexPath(h.x, h.y, 100 + grow)).join(" ");
  return `<g filter="url(#a-coast)">
    <path d="${p(80)}" fill="${P.shallow}" stroke="${P.shallow}" stroke-width="40" stroke-linejoin="round" opacity=".35"/>
    <path d="${p(48)}" fill="${P.shallow}" stroke="${P.shallow}" stroke-width="26" stroke-linejoin="round" opacity=".6"/>
    <path d="${p(30)}" fill="none" stroke="${P.foam}" stroke-width="4" stroke-linejoin="round" opacity=".45"/>
    <path d="${p(22)}" fill="${P.sand2}" stroke="${P.sand2}" stroke-width="14" stroke-linejoin="round"/>
    <path d="${p(12)}" fill="${P.sand}" stroke="${P.sand}" stroke-width="10" stroke-linejoin="round"/></g>
    <path d="${p(3)}" fill="#CDB98C"/>`;
}
const tile = (t) => `<g clip-path="url(#a-hexclip)" transform="scale(.968)"><use href="#ta-${t}" x="-87" y="-100" width="174" height="200"/><path d="${HEX}" fill="url(#a-light)"/></g>
  <path d="${hexPath(0, 0, 96.8)}" fill="none" stroke="#5C5440" stroke-opacity=".35" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M-83,44 L-83,-47 L0,-95 L83,-47" fill="none" stroke="#FFF8E8" stroke-opacity=".35" stroke-width="1.4" stroke-linejoin="round"/>`;
const glow = () => `<path d="${hexPath(0, 0, 97)}" fill="none" stroke="#FFE9A8" stroke-width="16" filter="url(#a-glow)"/><path d="${hexPath(0, 0, 93)}" fill="#FFF4CF" opacity=".14" stroke="#FFF1C2" stroke-width="3.4"/>`;

/**
 * Port: boat + two piers to the coast corners. The ratio label is returned separately so the
 * canvas can draw it with the page font (fonts are not available inside rasterised SVG).
 * p = { a, b, mx, my, nx, ny, res, ratio } in art units.
 */
function port(p) {
  const px = p.mx + p.nx * 64, py = p.my + p.ny * 64, flip = p.nx < -0.1 ? -1 : 1;
  const pier = (c) => {
    const ex = px - p.nx * 10 + (c.x - p.mx) * 0.3, ey = py - p.ny * 10 + (c.y - p.my) * 0.3;
    const d = `M${f(c.x)},${f(c.y)} L${f(ex)},${f(ey)}`;
    return `<path d="${d}" stroke="#7E6A50" stroke-width="7" stroke-linecap="round"/><path d="${d}" stroke="#C7AE88" stroke-width="4.4" stroke-linecap="round"/><path d="${d}" stroke="#9C8564" stroke-width="4.4" stroke-dasharray="1 4"/>`;
  };
  const lx = px - flip * 30, ly = py - 22;
  const svg = `<g>${pier(p.a)}${pier(p.b)}<g transform="translate(${f(px)} ${f(py)})">
    <path d="M-34,16 q34,7 68,0" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
    <g transform="scale(${flip} 1)" filter="url(#a-shadow)"><path d="M-28,2 L28,2 Q24,14 16,14 L-20,14 Q-26,11 -28,2Z" fill="#9A6B45"/><path d="M-24,6 H24" stroke="#C49770" stroke-width="1.4"/>
      <path d="M-2,2 V-40" stroke="#5C4630" stroke-width="2"/><path d="M0,-38 Q22,-22 20,-2 L0,-2Z" fill="#F7F1E2"/><path d="M-4,-30 Q-18,-18 -16,-2 L-4,-2Z" fill="#EDE4CF"/></g></g>
    <g transform="translate(${f(lx)} ${f(ly)})"><circle r="16" fill="#FBF6EA" filter="url(#a-shadow)"/><circle r="16" fill="none" stroke="#CDBB94" stroke-width="1"/>${p.res ? `<g transform="translate(0 -3) scale(.2)">${ICONS[p.res]}</g>` : ""}</g></g>`;
  return { svg, label: { x: lx, y: ly + (p.res ? 11 : 5), text: p.ratio, size: p.res ? 9 : 12 } };
}

/** Number token, drawn on the canvas (so the number uses the loaded display font). */
const tokenStyle = {
  r: 27, fill: "#FBF6EA", ring: "#CDBB94", inner: "#E7DCC2", ink: P.ink, hot: "#B5452A",
  font: "'DM Serif Display', Georgia, serif", weight: "400", size: 25, hotSize: 29, dy: 7, hotDy: 8, pipY: 15.5, pipR: 1.9, pipGap: 5.4,
  labelFont: "'DM Sans', system-ui, sans-serif",
};

/* ------------------------------------------------------------------ the theme object */
const sunny = {
  id: "A",
  name: "Sunny Island",
  mood: "Soft-vivid Mediterranean light, calm illustrated terrain.",
  sample: "Aa",
  fonts: {
    url: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400..800&display=swap",
    families: ["DM Serif Display", "DM Sans"],
  },
  paletteDots: ["#3CA9B0", "#8AAE58", "#EDC25E", "#E07E5A", "#93A2B4"],
  confettiColors: ["#D9714E", "#E2C27A", "#3CA9B0", "#F4EEE1", "#7D8F55"],
  motion: { name: "Crisp & airy", k: 1, pop: "cubic-bezier(.3,1.3,.6,1)", out: "cubic-bezier(.22,1,.36,1)", inOut: "cubic-bezier(.65,0,.35,1)", fall: "cubic-bezier(.55,0,1,.45)", squash: [1.14, 0.88], bounces: 2, sway: 0 },
  // Seat → colour key / portrait. Seat 0 is the human (always blue).
  seatKeys: ["blue", "orange", "ivory", "slate"],
  textColors: { blue: "#2C5BA8", orange: "#C7661F", ivory: "#8C7B57", slate: "#3E4752" },
  pc: PC,
  palette: P,
  canvasArt: true, // uses the SVG board renderer
  boardDefs, island, tile, glow, port, tokenStyle,
  dimFill: "rgba(30,42,46,.38)",
  seaColors: [P.sea2, P.sea1, P.sea0],
  pieces: { settlement: home, city: cityArt, robber: robberSpec, settlementDy: -2, cityDy: -4 },
  road: { shadow: "rgba(27,42,42,.22)", outer: 12, inner: 9.6, hi: 2, trim: 19 },
  hint: { halo: "rgba(255,246,218,.35)", fill: "#FBF6EA", ring: "#D9714E", dot: "#D9714E" },
  confirm: { fill: "#D9714E", ring: "#FFF9F2" },
  robberDx: 46, robberDy: -12, tokenDy: 6,
  icons: { ...ICONS, ...UI_ICONS }, // DOM sprite: crisp UI glyphs; card art keeps using ICONS directly
  card, cardBack,
  avatar: (preset) => (AVP[preset] || AVP.you)(),
  die: (n) => dieFace(n, 2, 2, 0, 1.08),
  swatch: () => `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="${P.sea1}"/><path d="M0,24 Q10,16 18,20 Q26,12 36,18 V36 H0Z" fill="${P.olive[0]}"/><path d="M0,30 Q18,26 36,30 V36 H0Z" fill="${P.sand}"/><circle cx="25" cy="10" r="5" fill="#E9C46A"/></svg>`,
  uiDefs: () => boardDefs(),
  pipCount,
};

export default sunny;
