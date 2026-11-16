// v1.86 One outline icon set for the UI chrome (Home, Menu, Lessons, build card, Bots): 24 x 24 grid, 2 px stroke,
// round caps and joins, currentColor, no fills (a dot is a filled circle of r 1.2 at most). Game pieces on the board
// and the player-coloured seat art keep their own colours; this set is for UI only. Styles: themes/base.css (.oi).
const P = {
  home: `<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>`,
  dice: `<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.6" cy="8.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.2" fill="currentColor" stroke="none"/>`,
  clock: `<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4.2l2.6 1.6"/><path d="M9.5 3h5M12 3v3"/>`,
  history: `<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4.5v4.2h4.2"/><path d="M12 8v4.4l3 1.8"/>`,
  lessons: `<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>`,
  book: `<path d="M3.5 5.5c3-1.4 5.8-1.2 8.5.8v13c-2.7-2-5.5-2.2-8.5-.8zM20.5 5.5c-3-1.4-5.8-1.2-8.5.8v13c2.7-2 5.5-2.2 8.5-.8z"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.6 2.6 3-.7.7 3 2.9 1.2-1 2.9 1 2.9-2.9 1.2-.7 3-3-.7L12 21.5l-1.6-2.6-3 .7-.7-3-2.9-1.2 1-2.9-1-2.9 2.9-1.2.7-3 3 .7z"/>`,
  sliders: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>`,
  bars: `<path d="M5 20V11M12 20V4M19 20v-6"/>`,
  lab: `<path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3l-5.5-9.5V3.5"/>`,
  trade: `<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/>`,
  build: `<path d="M5 19.5 13 11.5"/><path d="M10.5 6.5l3-3 7 7-3 3z"/><path d="M12.5 5 9 8.5"/>`,
  devcard: `<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M12 8l1.3 2.6 2.9.4-2.1 2 .5 2.9L12 14.6l-2.6 1.3.5-2.9-2.1-2 2.9-.4z"/>`,
  robber: `<circle cx="12" cy="6.8" r="2.8"/><path d="M9.2 20c0-4.5 1-7.5 2.8-7.5s2.8 3 2.8 7.5"/><path d="M7.5 20h9"/>`,
  target: `<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>`,
  trophy: `<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5v1.2a3.2 3.2 0 0 0 3.2 3.2M16 5.5h3v1.2a3.2 3.2 0 0 1-3.2 3.2"/><path d="M12 13.5V17M8.5 20h7M9.5 17h5"/>`,
  star: `<path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z"/>`,
  road: `<path d="M8 21 10.5 3M16 21 13.5 3"/><path d="M12 5v3M12 11v3M12 17v3"/>`,
  settlement: `<path d="M4 11.5 12 4.5l8 7"/><path d="M6 10v10h12V10"/>`,
  city: `<path d="M3 21V11h6v10M9 21V4l7 3v14M16 21v-8h5v8M2 21h20"/><path d="M12 10v.01M12 14v.01"/>`,
  ship: `<path d="M3.5 15h17l-2.5 5h-12z"/><path d="M12 3v12M12 4l6 8h-6M12 7 7 12h5"/>`,
  harbor: `<circle cx="12" cy="5" r="2"/><path d="M12 7v13M7 12h10M5 15c0 3 3 5 7 5s7-2 7-5"/>`,
  scale: `<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  explore: `<path d="M6 12.5l4 4 8-9"/>`,
};
/** 24-grid outline icon markup (the inner shapes). */
export const OI = P;
/** An outline icon as an inline SVG string; `cls` adds classes next to `oi`. */
export const oicon = (name, cls = "") => `<svg class="ic oi ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.info}</svg>`;
