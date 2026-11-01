// Seats 5 and 6 (5–6 player games) and (v0.78) the UI seat tokens derived from the board pieces.
// v0.75: seat order follows colonist.io / classic Catan — You red · Blaauw blue · Van Geelen orange · Groenewoud green ·
// De Wit white (ivory) · Pimpel purple. Seats 1–4 are defined by each theme (art.js PC/seatKeys + theme CSS
// --p0..--p3); the themes also draw their own ivory, so this module only supplies the fallback pieces and the
// UI tokens --p4 / --p5. Ivory gets a dark outline on the board (v0.79: and on its chip ring / badge, themes/six.css);
// purple is kept deep (v0.79: deeper and a touch bluer, the blue a touch lighter, in every theme) so the two differ
// in lightness and stay apart under red–green colour blindness (blue/purple dE >= 15 under every CVD; see cvd6.js).
// v0.96 ownership readability: one set of stronger seat colours for every day board (Sunny Light / Vivid, Wood,
// Silhouette, Classic) and one for Night, chosen to sit apart from every terrain colour (who95 mockup variant A;
// measured in scratchpad/rel96/tools/colors.js). Purple is a light lilac by day and a deep violet at Night, so it
// differs from blue in lightness and stays apart under red–green colour blindness (CIEDE2000 >= 18 to every seat
// under protan / deutan simulation). The pieces carry a dark outline in a white / cream halo (board-renderer.js).
export const SEAT_PC_DAY = {
  red: { base: "#B81E2E", dark: "#8A1220", light: "#E25A66", line: "#33060B" },
  blue: { base: "#1F55B8", dark: "#163F8A", light: "#6A94E4", line: "#0A1D48" },
  orange: { base: "#FF8C1A", dark: "#C76200", light: "#FFBA6A", line: "#4A2100" },
  green: { base: "#0B5E44", dark: "#074632", light: "#45A07E", line: "#022016" },
  ivory: { base: "#FFFFFF", dark: "#D8D0BE", light: "#FFFFFF", line: "#4A4234" },
  purple: { base: "#D077E8", dark: "#A04CBE", light: "#EBB0F6", line: "#3A0F4A" },
};
export const SEAT_PC_NIGHT = {
  red: { base: "#FF4F5E", dark: "#C22E3C", light: "#FF9AA2", line: "#3E0A10" },
  blue: { base: "#6AB0FF", dark: "#3A78C8", light: "#B4D8FF", line: "#0D2552" },
  orange: { base: "#FF8A10", dark: "#C9650A", light: "#FFBE72", line: "#4A2406" },
  green: { base: "#45DC95", dark: "#22A066", light: "#9CEFC6", line: "#0A2E1D" },
  ivory: { base: "#FFFFFF", dark: "#D8D0BE", light: "#FFFFFF", line: "#4A4234" },
  purple: { base: "#6A3AA8", dark: "#4E2482", light: "#A07AD8", line: "#1C0A33" },
};
/** Seat hues as text: on paper (day; applySeatTokens darkens further where AA needs it) and on the Night sheet. */
export const SEAT_TEXT_DAY = { red: "#8A1220", blue: "#163F8A", orange: "#A3510A", green: "#074632", ivory: "#5E5139", purple: "#8A3AA6" };
export const SEAT_TEXT_NIGHT = { red: "#FF9AA2", blue: "#B4D8FF", orange: "#FFBE72", green: "#9CEFC6", ivory: "#F2EBDA", purple: "#C4A6F0" };
/** A fresh copy of a seat set (themes mutate their own piece objects). */
export const seatSet = (set, over = {}) => Object.fromEntries(Object.entries(set).map(([k, v]) => [k, { ...v, ...over }]));

export const EXTRA_SEATS = [
  // key: name in theme.pc; base/dark/light/line: piece colours (fallback; every theme draws its own, tuned to
  // its board — see each art.js PC). UI tokens are derived from the theme's pieces (applySeatTokens).
  { key: "ivory", ...SEAT_PC_DAY.ivory, text: SEAT_TEXT_DAY.ivory },
  { key: "purple", ...SEAT_PC_DAY.purple, text: SEAT_TEXT_DAY.purple },
];

/** Append seats 5–6 to a theme (idempotent): pc pieces, seat keys, text colours, flat seat colours. */
export function addExtraSeats(T) {
  if (!T || T.__extraSeats) return T;
  T.__extraSeats = true;
  const keys = Array.isArray(T.seatKeys) ? [...T.seatKeys] : [];
  EXTRA_SEATS.forEach((s, i) => {
    const seat = 4 + i;
    if (T.pc && !T.pc[s.key]) T.pc[s.key] = { base: s.base, dark: s.dark, light: s.light, line: s.line };
    keys[seat] = s.key;
    if (T.textColors && !T.textColors[s.key]) T.textColors[s.key] = s.text;
    if (Array.isArray(T.seatColors)) T.seatColors[seat] = s.base;
  });
  if (Array.isArray(T.seatKeys)) T.seatKeys = keys;
  return T;
}

// ── v0.78: UI seat colours = the board pieces ──────────────────────────────────────────────────────
// Every UI seat colour (chip rings, points badges, strip tints, portrait clothes, ticker dots, offer bar,
// game over) comes from the same values as that seat's houses on the board: base for fills, light for tints,
// dark for shading / outlines; -text is the piece's dark shade (darkened further only where it would miss AA
// on paper) and -ink (text on the seat colour) is white or the piece's own dark line, whichever reads at AA.
const hex2rgb = (h) => { const n = parseInt(h.replace("#", "").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgb2hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const darken = (h, k) => rgb2hex(hex2rgb(h).map((v) => v * (1 - k)));
const PAPER = "#FBF6EA";
const lighten = (h, k) => rgb2hex(hex2rgb(h).map((v) => v + (255 - v) * k));
/** UI tokens for one seat from its piece colours. `paper` = the surface its text sits on (default the light paper);
 *  v0.85: on a dark surface (Sunny Night's sheet) the text is the piece's LIGHT tone, lightened further only where it
 *  would miss AA on that surface. */
export function seatTokens(c, text, paper = PAPER) {
  const darkPaper = lum(paper) < 0.18;
  let t = text || (darkPaper ? c.light : c.dark) || c.base;
  for (let i = 0; i < 12 && contrast(t, paper) < 4.6; i += 1) t = darkPaper ? lighten(t, 0.1) : darken(t, 0.08);
  const dark = c.line && contrast(c.line, c.base) > contrast("#1F1A17", c.base) ? c.line : "#1F1A17";
  const ink = contrast("#FFFFFF", c.base) >= 4.5 ? "#FFFFFF" : contrast(dark, c.base) >= contrast("#FFFFFF", c.base) ? dark : "#FFFFFF";
  return { base: c.base, light: c.light || c.base, dark: c.dark || c.base, line: c.line || c.dark || c.base, text: t, ink };
}
/** Set --p0..--p5 (+ -text, -ink, -light, -dark, -line) on the root from the active theme's pieces. */
export function applySeatTokens(T, root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root || !T) return;
  for (let n = 0; n < 6; n += 1) {
    const key = T.seatKeys?.[n];
    const c = (T.pc && key && T.pc[key]) || (T.seatPc && T.seatPc[n]) || (n >= 4 ? EXTRA_SEATS[n - 4] : null);
    if (!c) continue;
    const tk = seatTokens(c, T.textColors?.[key], T.seatPaper || PAPER);
    root.style.setProperty(`--p${n}`, tk.base);
    root.style.setProperty(`--p${n}-text`, tk.text);
    root.style.setProperty(`--p${n}-ink`, tk.ink);
    root.style.setProperty(`--p${n}-light`, tk.light);
    root.style.setProperty(`--p${n}-dark`, tk.dark);
    root.style.setProperty(`--p${n}-line`, tk.line);
  }
}

/** First paint, before a theme is installed: seats 5–6 fallback tokens. */
export function applyExtraSeatTokens(root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return;
  EXTRA_SEATS.forEach((s, i) => {
    const tk = seatTokens(s, s.text), n = 4 + i;
    root.style.setProperty(`--p${n}`, tk.base);
    root.style.setProperty(`--p${n}-text`, tk.text);
    root.style.setProperty(`--p${n}-ink`, tk.ink);
  });
}
