// Seats 5 and 6 (5–6 player games) and (v0.78) the UI seat tokens derived from the board pieces.
// v0.75: seat order follows colonist.io / classic Catan — You red · Blaauw blue · Van Geelen orange · Groenewoud green ·
// De Wit white (ivory) · Pimpel purple. Seats 1–4 are defined by each theme (art.js PC/seatKeys + theme CSS
// --p0..--p3); the themes also draw their own ivory, so this module only supplies the fallback pieces and the
// UI tokens --p4 / --p5. Ivory gets a dark outline on the board; purple is kept deep (dark against the mid blue)
// so the two stay apart under red–green colour blindness (see the cvd test).
export const EXTRA_SEATS = [
  // key: name in theme.pc; base/dark/light/line: piece colours (fallback; every theme draws its own, tuned to
  // its board — see each art.js PC). UI tokens are derived from the theme's pieces (applySeatTokens).
  { key: "ivory", base: "#EFE7D4", dark: "#CEC3A8", light: "#FBF7EC", line: "#6B6253", text: "#5E5139" },
  { key: "purple", base: "#7E4AAE", dark: "#5A3282", light: "#AE88D6", line: "#2A1242", text: "#5A3282" },
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
/** UI tokens for one seat from its piece colours. */
export function seatTokens(c, text) {
  let t = text || c.dark || c.base;
  for (let i = 0; i < 12 && contrast(t, PAPER) < 4.6; i += 1) t = darken(t, 0.08);
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
    const tk = seatTokens(c, T.textColors?.[key]);
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
