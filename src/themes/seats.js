// Seats 5 and 6 (5–6 player games): one palette shared by every theme.
// plum and sky were picked for 5–6 players next to blue / orange / ivory / seat 4 (CVD-checked, see the
// m56 colour study); sky pieces get a dark outline so they read on the sea and on pasture tiles.
// Seats 1–4 stay defined by each theme (art.js PC/seatKeys + theme CSS --p0..--p3); this module only
// appends seats 5–6 to them, so a change to an existing seat colour never touches this file.

export const EXTRA_SEATS = [
  // key: name in theme.pc; base/dark/light/line: piece colours; text: the seat colour as text on paper (AA);
  // ink: text on the seat colour (points badge)
  { key: "plum", base: "#8F4B86", dark: "#6B3264", light: "#C08AB8", line: "#3A1235", text: "#7E3B75", ink: "#FFFFFF" },
  { key: "sky", base: "#7EC4EC", dark: "#4E9CCB", light: "#B8E2F7", line: "#1D4E6E", text: "#26719C", ink: "#12324A" },
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
    root.style.setProperty(`--p${n}`, s.base);
    root.style.setProperty(`--p${n}-text`, s.text);
    root.style.setProperty(`--p${n}-ink`, s.ink);
  });
}
