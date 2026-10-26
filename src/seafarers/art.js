// Seafarers art shared by every SVG theme: ship + pirate piece specs, gold-field tile, sea-hex marks and
// sprite icons. A theme can override any of it with its own `sea` block (Sunny Island does: ./sunny-sea.js
// is wired in src/themes/sunny/art.js); B and C reuse these shapes with their own colours, and C's sails
// also carry a per-seat fill pattern so seats differ by more than colour.
import { hexPath, f } from "../themes/art-util.js";

const HEX = hexPath(0, 0, 100);

/** Ship = upright hull in the seat colour + a light sail (shape clearly differs from a road bar). */
export function shipSpec(c, o = {}) {
  const sail = o.sail || "#FBF6EA", sail2 = o.sail2 || "#EFE6D2", line = c.line || c.dark || "#1E242B", shadow = o.shadow || "#14201F";
  const sailFill = o.pattern || sail;
  return [
    { el: "ellipse", cx: 3, cy: 15, rx: 22, ry: 4.5, fill: shadow, op: 0.3, shadow: true },
    { d: "M-22,2 L22,2 Q18,14 9,14 L-14,14 Q-20,11 -22,2Z", fill: c.base, stroke: line, sw: 2.2, body: true },
    { d: "M-1,2 V-30", stroke: line, sw: 2.4, cap: "round" },
    { d: "M1,-27 Q17,-14 15,-1 L1,-1Z", fill: sailFill, stroke: line, sw: 2, body: true },
    { d: "M-3,-23 Q-15,-12 -14,-1 L-3,-1Z", fill: o.pattern ? sailFill : sail2, stroke: line, sw: 2, body: true },
    { d: "M-1,-30 L-12,-26 L-1,-22Z", fill: c.base, stroke: line, sw: 1.4 },
    { d: "M-16,7 H14", stroke: c.light || sail, sw: 1.8, cap: "round", op: 0.9 },
  ];
}

/** Pirate = dark hull, dark square sail with a skull, mid-hex. */
export function pirateSpec(o = {}) {
  const hull = o.hull || "#2A2F33", ink = o.ink || "#0B0D0F", sail = o.sail || "#3A4046", bone = o.bone || "#F2E8D0";
  return [
    { el: "ellipse", cx: 3, cy: 16, rx: 26, ry: 5, fill: "#0B1416", op: 0.35, shadow: true },
    { d: "M-26,2 L26,2 Q21,15 11,15 L-16,15 Q-23,12 -26,2Z", fill: hull, stroke: ink, sw: 2.2, body: true },
    { d: "M0,2 V-34", stroke: ink, sw: 2.6, cap: "round" },
    { d: "M-18,-30 Q0,-24 18,-30 L16,-4 Q0,-1 -16,-4Z", fill: sail, stroke: ink, sw: 2, body: true },
    { el: "circle", cx: 0, cy: -18, r: 5.2, fill: bone },
    { d: "M-5,-10 L5,-6 M5,-10 L-5,-6", stroke: bone, sw: 1.8, cap: "round" },
    { el: "circle", cx: -1.9, cy: -18.5, r: 1.2, fill: hull }, { el: "circle", cx: 1.9, cy: -18.5, r: 1.2, fill: hull },
    { d: "M0,-34 L10,-37 L0,-40Z", fill: ink },
  ];
}

/** Serialise a spec to SVG (icons). Pattern fills fall back to their solid colour. */
export function specSvg(spec) {
  return spec.map((s) => {
    const fill = typeof s.fill === "string" ? s.fill : (s.fallback || "#FBF6EA");
    const paint = `fill="${s.fill ? fill : "none"}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.sw || 1}" stroke-linejoin="round"` : ""}${s.cap ? ` stroke-linecap="${s.cap}"` : ""}${s.op != null ? ` opacity="${s.op}"` : ""}`;
    if (s.el === "ellipse") return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" ${paint}/>`;
    if (s.el === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" ${paint}/>`;
    return `<path d="${s.d}" ${paint}/>`;
  }).join("");
}

const nugget = (x, y, k, c1, c2, c3, ink) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-16,8 L-12,-8 L0,-14 L13,-7 L16,8 L4,13Z" fill="${c1}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/><path d="M0,-14 L13,-7 L16,8 L4,13 L2,-2Z" fill="${c2}"/><path d="M-12,-8 L0,-14 L2,-2 L-9,1Z" fill="${c3}"/></g>`;
const spark = (x, y, s = 1, c = "#FFFFFF", o = 0.9) => `<path d="M${x},${y - 6 * s} l${2 * s},${4 * s} ${4 * s},${2 * s} -${4 * s},${2 * s} -${2 * s},${4 * s} -${2 * s},-${4 * s} -${4 * s},-${2 * s} ${4 * s},-${2 * s}Z" fill="${c}" opacity="${o}"/>`;

/**
 * Gold field tile (hex radius 100, clipped to the hex by the caller's layer like any tile).
 * flavour: "printed" (B: a printed card tile with a cream rim), "flat" (C: one colour field + ink nuggets),
 * default: soft painted ground.
 */
export function goldTile(flavour = "soft") {
  const R = flavour === "flat" ? 95.5 : flavour === "printed" ? 96 : 100; // the theme's own tile size
  const under = flavour === "printed" ? `<path d="${hexPath(0, 6, 96)}" fill="#5E5040"/>` : "";
  const clip = (body) => `${under}<defs><clipPath id="sg-clip-${flavour}"><path d="${hexPath(0, 0, R)}"/></clipPath></defs><g clip-path="url(#sg-clip-${flavour})">${body}</g>`;
  if (flavour === "flat") {
    return clip(`<path d="${HEX}" fill="#E7A72C"/><path d="M-100,-30 Q-40,-56 20,-36 Q60,-24 100,-40 V-100 H-100Z" fill="#F1BE4A" opacity=".8"/>
      ${nugget(-40, -40, 1.25, "#F6D35B", "#D9A22A", "#FFF0B0", "#1C1A19")}${nugget(46, -26, 0.95, "#F6D35B", "#D9A22A", "#FFF0B0", "#1C1A19")}${nugget(-28, 62, 0.9, "#F6D35B", "#D9A22A", "#FFF0B0", "#1C1A19")}
      ${spark(32, 44, 1.2, "#FFF9EE")}${spark(-62, -4, 0.9, "#FFF9EE")}
      <path d="${hexPath(0, 0, 97)}" fill="none" stroke="#1C1A19" stroke-opacity=".5" stroke-width="2"/>`);
  }
  const base = flavour === "printed" ? ["#E4BC55", "#C49433", "#F4D98C"] : ["#E9C35A", "#C9962E", "#F6DE94"];
  return clip(`<defs><linearGradient id="sg-gold-${flavour}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${base[2]}"/><stop offset=".45" stop-color="${base[0]}"/><stop offset="1" stop-color="${base[1]}"/></linearGradient></defs>
    <path d="${HEX}" fill="url(#sg-gold-${flavour})"/>
    <path d="M-100,-30 Q-50,-58 10,-40 Q60,-54 100,-34 V-100 H-100Z" fill="#B98A2A" opacity=".22"/>
    <path d="M-100,58 Q-30,34 30,54 Q70,46 100,56 V100 H-100Z" fill="#B98A2A" opacity=".28"/>
    ${nugget(-44, -40, 1.25, "#F4D46A", "#D9A93A", "#FFF0B0", "#8A6420")}${nugget(48, -30, 0.95, "#F1CC5A", "#D19E32", "#FFEFAE", "#8A6420")}${nugget(-30, 62, 0.9, "#F1CC5A", "#D19E32", "#FFEFAE", "#8A6420")}
    ${spark(30, 46)}${spark(-62, -6, 0.7)}
    ${flavour === "printed" ? `<path d="${hexPath(0, 0, 93)}" fill="none" stroke="#F3EBDA" stroke-width="7" opacity=".85"/><path d="${hexPath(0, 0, 97)}" fill="none" stroke="#5E5040" stroke-width="2" opacity=".6"/>` : `<path d="${hexPath(0, 0, 96.8)}" fill="none" stroke="#5C5440" stroke-opacity=".35" stroke-width="1.4"/>`}`);
}

/** Sprite icons (viewBox -50..50) every theme gets unless it draws its own. */
export function seaIcons(pc = { base: "#3A76DC", dark: "#2557B0", light: "#7AA5F0", line: "#163777" }, ink = "#2E3A3D") {
  const ship = specSvg(shipSpec(pc));
  return {
    ship: `<g transform="translate(0 6) scale(1.65)">${ship}</g>`,
    pirate: `<g transform="translate(0 6) scale(1.45)">${specSvg(pirateSpec())}</g>`,
    gold: `<ellipse cx="4" cy="38" rx="38" ry="5" fill="#24301F" opacity=".14"/>${nugget(-14, 20, 1.25, "#F4D46A", "#D9A93A", "#FFF0B0", "#8A6420")}${nugget(18, 22, 1.0, "#F1CC5A", "#D19E32", "#FFEFAE", "#8A6420")}${nugget(2, -6, 1.3, "#F6DA7A", "#DDAE40", "#FFF4C4", "#8A6420")}${spark(0, -24, 1.1)}`,
    island: `<ellipse cx="0" cy="36" rx="40" ry="5" fill="#24301F" opacity=".14"/><path d="M-42,30 Q-20,8 4,14 Q26,6 42,26 Q20,38 -42,30Z" fill="#E4D0A2" stroke="#C9AE76" stroke-width="2" stroke-linejoin="round"/><path d="M2,16 Q4,-6 -4,-26" stroke="#7A5A3C" stroke-width="4.5" fill="none" stroke-linecap="round"/><g fill="#8AAE58" stroke="#6A8E42" stroke-width="1.6" stroke-linejoin="round"><path d="M-4,-26 Q-26,-34 -36,-18 Q-20,-26 -4,-26Z"/><path d="M-4,-26 Q18,-38 32,-22 Q14,-28 -4,-26Z"/><path d="M-4,-26 Q-14,-44 4,-48 Q-4,-38 -4,-26Z"/><path d="M-4,-26 Q10,-14 14,4 Q2,-12 -4,-26Z"/></g>`,
    tradeRoute: `<path d="M-42,30 Q-30,10 -10,12" fill="none" stroke="#C8B48A" stroke-width="12" stroke-linecap="round"/><path d="M-6,12 Q14,12 22,-6" fill="none" stroke="#3CA9B0" stroke-width="7" stroke-dasharray="2 8" stroke-linecap="round"/><g transform="translate(22 -14) scale(1.05)">${ship}</g>`,
    moveShip: `<path d="M-38,26 Q-6,40 30,22" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="3 7" stroke-linecap="round"/><path d="M22,12 L34,22 L20,30" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(-6 -6) scale(1.2)">${ship}</g>`,
  };
}

/** Per-seat sail patterns (Silhouette): solid, stripes, dots, checks — built lazily as CanvasPatterns. */
const patCache = new Map();
export function sailPattern(seat, fg, bg) {
  if (typeof document === "undefined") return null;
  const key = `${seat}|${fg}|${bg}`;
  if (patCache.has(key)) return patCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, 8, 8);
  x.fillStyle = fg;
  if (seat === 1) { x.fillRect(0, 0, 8, 3); }
  else if (seat === 2) { x.beginPath(); x.arc(4, 4, 1.8, 0, Math.PI * 2); x.fill(); }
  else if (seat === 3) { x.fillRect(0, 0, 4, 4); x.fillRect(4, 4, 4, 4); }
  const p = x.createPattern(c, "repeat");
  patCache.set(key, p);
  return p;
}

/** Default `sea` block for a theme without its own (B, C): colours derived from the theme. */
export function defaultSea(T) {
  const flat = T.id === "C";
  return {
    ship: (c, seat) => shipSpec(c, flat ? { sail: "#FBF1DC", sail2: "#FBF1DC", shadow: "#14120F", pattern: seat ? sailPattern(seat, c.line || "#1C1A19", "#FBF1DC") : null } : { sail: "#F3EBDA", sail2: "#E6D8B8" }),
    pirate: flat ? pirateSpec({ hull: "#1C1A19", ink: "#1C1A19", sail: "#1C1A19", bone: "#FFF9EE" }) : pirateSpec({ hull: "#3A2718", ink: "#1E140B", sail: "#4A3A2C", bone: "#F3EBDA" }),
    goldTile: () => goldTile(flat ? "flat" : T.id === "B" ? "printed" : "soft"),
    seaMark: flat ? { line: "rgba(255,249,238,.22)", wave: "rgba(255,249,238,.5)" } : { line: "rgba(255,255,255,.14)", wave: "rgba(255,255,255,.32)" },
    lane: flat ? "rgba(255,249,238,.95)" : "rgba(255,255,255,.9)",
    chip: flat ? { fill: "#F1BE4A", ring: "#1C1A19", ink: "#1C1A19" } : { fill: "#F3D27A", ring: "#8A6A2C", ink: "#4A3A12" },
  };
}

export { HEX as SEA_HEX, f as fmt };
