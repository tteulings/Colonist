// Seats 5 and 6 (5–6 player games): one palette shared by every theme.
// v0.75: seat order follows colonist.io / classic Catan — You red · Marina blue · Bruno orange · Viktor green ·
// Nora white (ivory) · Hugo purple. Seats 1–4 are defined by each theme (art.js PC/seatKeys + theme CSS
// --p0..--p3); the themes also draw their own ivory, so this module only supplies the fallback pieces and the
// UI tokens --p4 / --p5. Ivory gets a dark outline on the board; purple is kept deep (dark against the mid blue)
// so the two stay apart under red–green colour blindness (see the cvd test).
export const EXTRA_SEATS = [
  // key: name in theme.pc; base/dark/light/line: piece colours; text: the seat colour as text on paper (AA);
  // ink: text on the seat colour (points badge)
  // ui: the seat colour as a UI token (--pN) — the ivory piece is near-white, its chip / ring token a warm grey
  { key: "ivory", base: "#EDE6D3", dark: "#C8BFAA", light: "#FBF7EC", line: "#6B6253", ui: "#D8CFBB", text: "#5E5139", ink: "#2E3A3D" },
  { key: "purple", base: "#72309F", dark: "#521E76", light: "#A872D0", line: "#1A1A1A", ui: "#72309F", text: "#72309F", ink: "#FFFFFF" },
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

/** CSS tokens --p4 / --p5 (+ -text, -ink) for the .pc-4 / .pc-5 classes (themes/six.css). */
export function applyExtraSeatTokens(root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root) return;
  EXTRA_SEATS.forEach((s, i) => {
    const n = 4 + i;
    root.style.setProperty(`--p${n}`, s.ui || s.base);
    root.style.setProperty(`--p${n}-text`, s.text);
    root.style.setProperty(`--p${n}-ink`, s.ink);
  });
}
