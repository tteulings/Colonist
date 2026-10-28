// THEME "Classic" — the original Colonist look: the existing hand-drawn canvas board, the
// original resource / development / UI icons and avatars from assets/, deep-sea chrome.
// The board itself is still drawn by the legacy canvas code in game.js (canvasArt: false).
import { RES_NAME, DEV_NAME, RESOURCE_KEYS } from "../art-util.js";
import sunny from "../sunny/art.js";

const img = (href, s = 80) => `<image href="${href}" x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}"/>`;
const RES_ICON = {
  wood: "./assets/icons/resource-wood-v3.svg", brick: "./assets/icons/resource-brick-v2.svg", sheep: "./assets/icons/resource-sheep-v2.svg",
  wheat: "./assets/icons/resource-wheat-v2.svg", ore: "./assets/icons/resource-ore-v2.svg",
};
const DEV_ICON = {
  knight: "./assets/icons/dev-knight.svg", roadBuilding: "./assets/icons/dev-road-building.svg",
  yearOfPlenty: "./assets/icons/dev-year-of-plenty.svg", monopoly: "./assets/icons/dev-monopoly.svg",
};
const RES_COLOR = { wood: "#4a7c3f", brick: "#c66536", sheep: "#7ec850", wheat: "#d9bc52", ore: "#8b96a8", desert: "#d6c28e" };
// Seats look the same in every theme (v0.75, colonist.io order): You red, Blaauw blue, Van Geelen orange, Groenewoud green
// (+ De Wit ivory, Pimpel purple in 5–6 player games, appended by src/themes/seats.js) — the Sunny Island piece
// colours and portraits, so switching themes never recolours a player.
const SEAT_COLORS = ["#D1453A", "#3C75C6", "#F08A2E", "#2A8556"]; // v0.78: the Sunny (light) piece colours
// the full piece shades per seat: the UI seat tokens are derived from these (src/themes/seats.js applySeatTokens)
const SEAT_PC = [{ base: "#D1453A", dark: "#A3302A", light: "#EB8070", line: "#4A1712" }, { base: "#3C75C6", dark: "#28569A", light: "#7FA6E0", line: "#14305A" }, { base: "#F08A2E", dark: "#BA6018", light: "#F8B670", line: "#552A08" }, { base: "#2A8556", dark: "#1D6340", light: "#66B58A", line: "#0E3020" }, { base: "#EFE7D4", dark: "#CEC3A8", light: "#FBF7EC", line: "#6B6253" }, { base: "#5A2C88", dark: "#43206A", light: "#9A76C6", line: "#1E0B33" }];
// Classic has no per-seat piece shades (theme.pc); the build / Seafarers ship icons use this neutral ink
const YOU_PC = { base: "#22313A", dark: "#16222A", light: "#4A5A64", line: "#0E161B" }; // v0.75: build icons in neutral ink (UI, not a seat colour)
const ink = "#1a3a52";

const star = `<path d="M0,-34 l10,20 22,3 -16,15 4,22 -20,-10 -20,10 4,-22 -16,-15 22,-3Z" fill="#c4a265" stroke="#8a6a2c" stroke-width="3" stroke-linejoin="round"/>`;
const house = (c) => `<path d="M-26,24 V-2 L0,-28 L26,-2 V24Z" fill="${c}" stroke="#0f1722" stroke-width="4" stroke-linejoin="round"/><rect x="-5" y="8" width="10" height="16" fill="rgba(0,0,0,.25)"/>`;
const ICONS = {
  ...Object.fromEntries(Object.entries(RES_ICON).map(([k, v]) => [k, img(v, 84)])),
  ...Object.fromEntries(Object.entries(DEV_ICON).map(([k, v]) => [k, img(v, 84)])),
  desert: `<rect x="-40" y="-40" width="80" height="80" rx="18" fill="${RES_COLOR.desert}" stroke="#a08a55" stroke-width="3"/><path d="M-30,20 Q-10,0 10,14 Q22,6 32,14" stroke="#9a7630" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  victoryPoint: `<rect x="-40" y="-40" width="80" height="80" rx="18" fill="#f5efe4" stroke="#c4a265" stroke-width="3"/>${star}`,
  road: `<rect x="-38" y="-8" width="76" height="16" rx="8" fill="${YOU_PC.base}" stroke="#0f1722" stroke-width="4" transform="rotate(-22)"/>`,
  settlement: house(YOU_PC.base),
  city: `<path d="M-32,26 V-4 H-10 V-22 L2,-34 L14,-22 V-4 H32 V26Z" fill="${YOU_PC.base}" stroke="#0f1722" stroke-width="4" stroke-linejoin="round"/>`,
  trade: img("./assets/icons/ui-trade.svg", 90),
  build: img("./assets/icons/ui-build.svg", 90),
  dice: img("./assets/icons/ui-dice.svg", 90),
  endTurn: img("./assets/icons/ui-end-turn.svg", 90),
  logo: `<g transform="scale(1.3)">${img("./assets/icons/ui-logo.svg", 64)}</g>`,
  bank: `<path d="M-38,-12 L0,-36 L38,-12Z" fill="#da7756"/><g fill="#f5efe4" stroke="#8a7a5a" stroke-width="2">${[-28, -10, 6, 22].map((x) => `<rect x="${x}" y="-10" width="8" height="34"/>`).join("")}</g><rect x="-40" y="24" width="80" height="8" rx="2" fill="#c4a265"/>`,
  hint: `<circle r="30" fill="#c4a265"/><text y="12" text-anchor="middle" font-size="40" font-weight="800" fill="#fff" font-family="Inter, sans-serif">?</text>`,
  settings: `<circle r="30" fill="none" stroke="currentColor" stroke-width="10" stroke-dasharray="12 7"/><circle r="12" fill="currentColor"/>`,
  log: `<rect x="-28" y="-36" width="56" height="72" rx="6" fill="#f5efe4" stroke="#8a7a5a" stroke-width="3"/><path d="M-16,-18 H16 M-16,-4 H16 M-16,10 H8" stroke="#8a7a5a" stroke-width="4" stroke-linecap="round"/>`,
  robber: `<circle cy="-20" r="12" fill="#1a2030"/><path d="M-20,30 L-12,4 L0,-8 L12,4 L20,30Z" fill="#1a2030" stroke="#8a95a5" stroke-width="2"/>`,
  longestRoad: `<rect x="-40" y="-24" width="80" height="48" rx="12" fill="#f0d070" stroke="#a08530" stroke-width="3"/><text y="10" text-anchor="middle" font-size="30" font-weight="800" fill="#6b5030" font-family="Inter, sans-serif">LR</text>`,
  largestArmy: `<rect x="-40" y="-24" width="80" height="48" rx="12" fill="#f0d070" stroke="#a08530" stroke-width="3"/><text y="10" text-anchor="middle" font-size="30" font-weight="800" fill="#6b5030" font-family="Inter, sans-serif">LA</text>`,
  vp: star,
  cards: `<rect x="-26" y="-34" width="40" height="58" rx="5" fill="#44965f" stroke="#2c5e3c" stroke-width="3" transform="rotate(-12)"/><rect x="-10" y="-30" width="40" height="58" rx="5" fill="#f5efe4" stroke="#8a7a5a" stroke-width="3" transform="rotate(10)"/>`,
  devcard: `<rect x="-24" y="-34" width="48" height="68" rx="6" fill="#7a5ec4" stroke="#4e3a8a" stroke-width="3"/><path d="M0,-12 l4.6,9.4 10.4,1.5 -7.5,7.3 1.8,10.3 -9.3,-4.9 -9.3,4.9 1.8,-10.3 -7.5,-7.3 10.4,-1.5Z" fill="#f0d070"/>`,
  fit: `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M-32,-12 V-32 H-12 M12,-32 H32 V-12 M32,12 V32 H12 M-12,32 H-32 V12"/></g>`,
  zoomIn: `<circle cx="-6" cy="-6" r="22" fill="none" stroke="currentColor" stroke-width="6"/><path d="M10,10 L30,30 M-16,-6 h20 M-6,-16 v20" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  zoomOut: `<circle cx="-6" cy="-6" r="22" fill="none" stroke="currentColor" stroke-width="6"/><path d="M10,10 L30,30 M-16,-6 h20" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  undo: `<path d="M-14,-22 L-28,-8 L-14,6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M-26,-8 H8 Q28,-8 28,12 Q28,30 8,30 H-6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  close: `<path d="M-18,-18 L18,18 M18,-18 L-18,18" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  check: `<path d="M-24,0 L-8,16 L24,-18" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  chevron: `<path d="M-16,-6 L0,10 L16,-6" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<path d="M0,-20 V20 M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
  minus: `<path d="M-20,0 H20" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
};

// mini cards (the hand): the icon sits a little smaller and lower, leaving the top-left corner to the count (v0.76)
function card(k, mini) {
  const res = RESOURCE_KEYS.includes(k), name = RES_NAME[k] || DEV_NAME[k];
  const bg = res ? RES_COLOR[k] : k === "victoryPoint" ? "#c4a265" : "#5a4a9a";
  const icon = res ? img(RES_ICON[k], 150) : DEV_ICON[k] ? img(DEV_ICON[k], 150) : `<g transform="scale(2.4)">${star}</g>`;
  return `<rect x="1" y="1" width="248" height="348" rx="18" fill="#f5efe4" stroke="#c4a265" stroke-width="3"/>
    <rect x="14" y="14" width="222" height="${mini ? 254 : 220}" rx="12" fill="${bg}"/>
    <g transform="${mini ? "translate(125 170) scale(.7)" : "translate(125 124)"}">${icon}</g>
    <text x="125" y="${mini ? 316 : 290}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="800" font-size="${name.length > 11 ? 24 : 32}" fill="${ink}">${name}</text>`;
}
const cardBack = () => `<rect x="1" y="1" width="248" height="348" rx="18" fill="#1a3a52" stroke="#c4a265" stroke-width="4"/><g transform="translate(125 175) scale(2.2)">${ICONS.logo}</g>`;

const avatar = (preset) => sunny.avatar(preset);

const PIPS = { 1: [[0, 0]], 2: [[-14, -14], [14, 14]], 3: [[-14, -14], [0, 0], [14, 14]], 4: [[-14, -14], [14, -14], [-14, 14], [14, 14]], 5: [[-14, -14], [14, -14], [0, 0], [-14, 14], [14, 14]], 6: [[-14, -16], [14, -16], [-14, 0], [14, 0], [-14, 16], [14, 16]] };
const die = (n) => `<rect x="-36" y="-36" width="72" height="72" rx="14" fill="#fffdf8" stroke="#8a7a5a" stroke-width="3"/>${PIPS[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.4" fill="#18212c"/>`).join("")}`;

const classic = {
  id: "classic",
  name: "Classic",
  mood: "The original Colonist board: deep sea, hand-drawn tiles.",
  sample: "Aa",
  fonts: null, // system / Inter stack, nothing to load
  paletteDots: ["#4090b0", "#4a7c3f", "#d9bc52", "#c66536", "#da7756"],
  confettiColors: [...SEAT_COLORS, "#f5efe4"],
  motion: { name: "Crisp & airy", k: 1, pop: "cubic-bezier(.3,1.3,.6,1)", out: "cubic-bezier(.22,1,.36,1)", inOut: "cubic-bezier(.65,0,.35,1)", fall: "cubic-bezier(.55,0,1,.45)", squash: [1.14, 0.88], bounces: 2, sway: 0 },
  seatColors: SEAT_COLORS,
  seatPc: SEAT_PC,
  youPc: YOU_PC,
  textColors: null, // seat colours are used as-is
  canvasArt: false, // legacy canvas renderer in game.js
  // v0.79: the legacy canvas draws the Sunny Island piece shapes (a lit 3-D house, a city with a tower) in the seat's
  // own piece shades (seatPc: base / light / dark / line) instead of its flat single-colour glyphs, so a seat looks
  // the same on the Classic board as on the themed boards and in the chips (game.js drawStructures / drawRoads).
  boardPieces: { settlement: sunny.pieces.plainSettlement, city: sunny.pieces.plainCity, settlementDy: sunny.pieces.settlementDy, cityDy: sunny.pieces.cityDy, rim: "rgba(255,252,242,.6)", rimW: 2.5 },
  icons: ICONS,
  card, cardBack, avatar, die,
  swatch: () => `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#2a6a88"/><path d="M8,12 L18,6 L28,12 V24 L18,30 L8,24Z" fill="#7cc844" stroke="#a08246" stroke-width="1.5"/><circle cx="18" cy="18" r="5" fill="#fffaee"/></svg>`,
  uiDefs: () => "",
};

export default classic;
