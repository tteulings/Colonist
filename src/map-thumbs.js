// v1.99.3 map thumbnails (Island, Seafarers) as inline SVG, shared by the Home picker and, later, the New game sheet.
// Colours are CSS variables (--mt-*, defined in themes/shell.css for light and for night/dusk), so a palette change repaints them without a redraw.
// Rows: x offset in half-hex widths, then one char per hex: f forest p pasture w wheat b brick o ore d desert, "." = sea, "~" = the lake of the Lake map.
// v1.99.3 Lake, Isthmus and Random shape: the Isthmus and the Random shape card are drawn from the same hex lists the game builds them from (src/maps.js).
import { isthmusHexes, randomShapeHexes } from "./maps.js";
/** Hex list [{q, r}] -> rows; the terrain letters cycle so that no two neighbours match, `d` where `desert(c)`. */
const rowsOf = (cells, desert) => {
  const r0 = Math.min(...cells.map((c) => c.r)), x0 = Math.min(...cells.map((c) => c.q + c.r / 2)), rows = [];
  for (let r = r0; r <= Math.max(...cells.map((c) => c.r)); r += 1) {
    const row = cells.filter((c) => c.r === r), xs = row.map((c) => c.q + c.r / 2), a = Math.min(...xs), b = Math.max(...xs);
    let str = ""; for (let x = a; x <= b; x += 1) { const c = row.find((k) => k.q + k.r / 2 === x); str += c ? (desert(c) ? "d" : "fpwbo"[(((c.q * 3 + c.r * 2) % 5) + 5) % 5]) : "."; }
    rows.push([Math.round((a - x0) * 2), str]);
  }
  return rows;
};
const SHAPE_DEMO = randomShapeHexes(11); // one random land to stand for "a new shape every game"
const MAPS = {
  island: [[2, "opf"], [1, "wbwp"], [0, "fwdbp"], [1, "pofw"], [2, "wfb"]],
  seafarers: [[0, "pfw..ow"], [1, ".bd...p"], [0, "fpb...."], [1, "...dbw."], [0, "o...pf."]],
  lake: [[2, "opf"], [1, "wbwp"], [0, "fw~bp"], [1, "pofw"], [2, "wfb"]],
  isthmus: rowsOf(isthmusHexes(), (c) => c.neck),
  shape: rowsOf(SHAPE_DEMO, (c) => c === SHAPE_DEMO[9]),
};
const hexPts = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return (cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2); }).join(" ");
const v = (n, fb) => `var(--mt-${n},${fb})`;
const TERRAIN = { f: ["#5E9A55", "#457A42"], p: ["#B8D57A", "#97B95C"], w: ["#EDC25E", "#D3A341"], b: ["#E07E5A", "#C0623F"], o: ["#93A2B4", "#728399"], d: ["#F0DAA8", "#DCBF85"] };

/** The thumbnail of a map ("island" | "seafarers" | "lake" | "isthmus" | "shape") as an SVG string (decorative: the card carries the name). */
export function mapThumb(kind) {
  const rows = MAPS[kind] || MAPS.island, R = 10, W = Math.sqrt(3) * R, cells = [];
  rows.forEach(([off, s], ri) => [...s].forEach((ch, ci) => cells.push({ ri, ci, ch, x: off * W / 2 + ci * W + W / 2, y: ri * 1.5 * R + R })));
  const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y), pad = kind === "seafarers" ? 4 : kind === "isthmus" || kind === "shape" ? 3 : 6;
  const x0 = Math.min(...xs) - W / 2 - pad, x1 = Math.max(...xs) + W / 2 + pad, y0 = Math.min(...ys) - R - pad, y1 = Math.max(...ys) + R + pad;
  const land = cells.filter((c) => c.ch !== "." && c.ch !== "~"), lake = cells.filter((c) => c.ch === "~");
  let g = "";
  if (kind !== "island" && kind !== "lake") cells.filter((c) => c.ch === ".").forEach((c) => { g += `<polygon points="${hexPts(c.x, c.y, R - .6)}" fill="${v("sea", "#6ACBC3")}" fill-opacity=".30" stroke="${v("foam", "#D9F0E6")}" stroke-opacity=".45" stroke-width=".9"/>`; });
  land.forEach((c) => { g += `<polygon points="${hexPts(c.x, c.y, R + 2.2)}" fill="${v("shallow", "#A6E4D6")}" fill-opacity=".55" stroke="${v("shallow", "#A6E4D6")}" stroke-opacity=".55" stroke-width="3" stroke-linejoin="round"/>`; });
  land.forEach((c) => { const t = TERRAIN[c.ch]; g += `<polygon points="${hexPts(c.x, c.y, R - .5)}" fill="${v(c.ch + "0", t[0])}" stroke="${v(c.ch + "1", t[1])}" stroke-width="1.3" stroke-linejoin="round"/>`; });
  lake.forEach((c) => { g += `<polygon points="${hexPts(c.x, c.y, R - .5)}" fill="${v("lake", "#3CA9B0")}" stroke="${v("lake1", "#2B8C98")}" stroke-width="1.3" stroke-linejoin="round"/><path d="M${(c.x - 4.5).toFixed(1)} ${c.y.toFixed(1)} q2.2 -2.4 4.5 0 t4.5 0" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1.2" stroke-linecap="round"/>`; });
  if (kind === "shape") { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; g += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="${v("sail", "#F7F2E6")}" stroke="#26303A" stroke-opacity=".35"/><text x="${mx.toFixed(1)}" y="${(my + 5).toFixed(1)}" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="800" font-size="14" fill="#26303A">?</text>`; }
  if (kind === "seafarers") {
    const a = cells.find((c) => c.ri === 2 && c.ci === 4) || cells.find((c) => c.ch === ".");
    g += `<g transform="translate(${a.x} ${a.y}) scale(1.15)"><path d="M-6 3 L6 3 L4 6.5 L-4 6.5 Z" fill="${v("hull", "#8A5A3A")}" stroke="#000" stroke-opacity=".25" stroke-width=".6"/><path d="M0 -8 L0 2 L5.2 2 Z" fill="${v("sail", "#F7F2E6")}"/><path d="M-.8 -6 L-.8 2 L-5 2 Z" fill="${v("sail", "#F7F2E6")}" fill-opacity=".85"/></g>`;
  }
  return `<svg viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${g}</svg>`;
}
