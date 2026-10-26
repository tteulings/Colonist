// Seats 5 and 6 (5–6 player games): one palette shared by every theme.
// Red and sky: with blue / orange / ivory / plum (seat 4 since v0.73) taken, a search over the sRGB cube for
// colours that stay apart from every seat, the robber, the seas and the terrain under protanopia, deuteranopia
// and tritanopia (Machado 2009 + CIEDE2000; black/charcoal and greys excluded) leaves only a cyan-sky and a
// pure red (all seat pairs >= 15.8, robbers incl. the wooden pawn and seas >= 10.3; see the cvd test). Both get a dark outline on the board.
// Seats 1–4 stay defined by each theme (art.js PC/seatKeys + theme CSS --p0..--p3); this module only
// appends seats 5–6 to them, so a change to an existing seat colour never touches this file.

export const EXTRA_SEATS = [
  // key: name in theme.pc; base/dark/light/line: piece colours; text: the seat colour as text on paper (AA);
  // ink: text on the seat colour (points badge)
  { key: "red", base: "#E01000", dark: "#A30B00", light: "#FF6A5C", line: "#4A0500", text: "#B5000F", ink: "#FFFFFF" },
  { key: "sky", base: "#4CCBF5", dark: "#1E9CCB", light: "#9BE3FA", line: "#0B3550", text: "#0B6E96", ink: "#0B3550" },
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
