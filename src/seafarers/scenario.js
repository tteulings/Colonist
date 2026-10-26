// Seafarers scenario data: "Heading for New Shores" (Catan: Seafarers 5th ed., scenario 1, 4-player set-up).
//
// Rulebook (Catan Seafarers 5th English ed., 2015 — world-of-board-games.com.sg/docs/Catan-Seafarers-5ed.pdf), p. 8:
//  * main island = the 19 positions of a basic Catan board (desert 1, fields 4, hills 3, mountains 3, pasture 4, forest 4)
//    with 9 harbours (5 special 2:1 + 4 generic 3:1) placed as in basic Catan;
//  * small islands: gold field 2, fields 1, hills 2, mountains 2, pasture 1, forest 1 with the red numbers
//    2 3 4 5 6 8 9 10 11 (one each);
//  * set-up phase only on the main island; the robber starts in the desert, the pirate on its marked sea hex;
//  * first settlement on each small island: +2 special VP (per player, per island); the game ends at 14 VP.
//
// Our board is the approved portrait layout (tall on phones): the main island on top, one row of open sea,
// then three small islands (west, south, east) below. Rows are "odd-r" offset rows of 6 columns:
// L = main island, s = sea, W/S/E = small island hexes.
export const ROWS = [
  "sLLLss",
  "sLLLLs",
  "LLLLLs",
  "sLLLLs",
  "sLLLss",
  "ssssss",
  "WssssE",
  "WssSsE",
  "WsSSsE",
];

// Fixed small-island tiles (Beginner map; Random/Balanced shuffle them within the island positions).
// key = "row,col" (row 0 = first entry of ROWS)
export const ISLAND_TILES = {
  "6,0": ["brick", 4], "7,0": ["ore", 9], "8,0": ["sheep", 3],
  "7,3": ["gold", 5], "8,2": ["wheat", 10], "8,3": ["brick", 8],
  "6,5": ["ore", 6], "7,5": ["gold", 11], "8,5": ["wood", 2],
};
export const ISLANDS = { W: { id: 1, name: "West Isle" }, S: { id: 2, name: "South Isle" }, E: { id: 3, name: "East Isle" } };
export const ISLAND_NAMES = { 0: "the main island", 1: "West Isle", 2: "South Isle", 3: "East Isle" };
export const PIRATE_START = "8,4"; // open sea between South and East Isle
export const WIN_POINTS = 14;
export const SHIP_LIMIT = 15;
export const SHIP_COST = { wood: 1, sheep: 1 }; // 1 lumber + 1 wool (rulebook p. 3)

/**
 * Hex list for createBoardGeometry: axial (q, r) per position, plus its kind and key.
 * Odd-r offset → axial: q = col - (r - (r & 1)) / 2. Row index ri maps to r = ri - 3 (the mock-ups numbered
 * rows from 1, so r = row - 4: an even shift keeps the stagger, and therefore every adjacency, as approved).
 */
export function layoutHexes() {
  const out = [];
  ROWS.forEach((row, ri) => {
    const r = ri - 3;
    [...row].forEach((ch, col) => {
      out.push({ q: col - 3 - (r - (r & 1)) / 2, r, kind: ch, key: `${ri},${col}` });
    });
  });
  return out;
}

/** Axial coordinates of the main island's centre hex (row 2, col 2), to map a basic 19-hex board onto it. */
export function mainCenter() {
  const r = 2 - 3;
  return { q: 2 - 3 - (r - (r & 1)) / 2, r };
}
