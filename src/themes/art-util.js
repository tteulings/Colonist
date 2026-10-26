// Shared helpers for SVG theme art. Art is authored for pointy-top hexes of radius 100
// ("art units"), corner i at angle 60*i - 30 degrees — the same convention as the game board.

export const S = 100;
export const R3 = Math.sqrt(3);

/** Round to one decimal — keeps generated SVG strings short. */
export const f = (n) => +(+n).toFixed(1);

/** Deterministic RNG so baked art is identical on every load. */
export function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function hexPath(cx, cy, size = S) {
  let d = "";
  for (let i = 0; i < 6; i += 1) {
    const a = ((60 * i - 30) * Math.PI) / 180;
    d += (i ? "L" : "M") + f(cx + size * Math.cos(a)) + "," + f(cy + size * Math.sin(a));
  }
  return d + "Z";
}

export const HEX = hexPath(0, 0);

/** Number of probability pips under a number token (2/12 → 1 … 6/8 → 5). */
export const pipCount = (n) => 6 - Math.abs(7 - n);

/** Greedy word wrap for SVG <tspan> lines. */
export function wrap(text, n) {
  const out = [""];
  for (const w of text.split(" ")) {
    const cur = out[out.length - 1];
    if ((cur + " " + w).trim().length > n) out.push(w);
    else out[out.length - 1] = (cur + " " + w).trim();
  }
  return out;
}

export const RESOURCE_KEYS = ["wood", "brick", "sheep", "wheat", "ore"];
export const DEV_KEYS = ["knight", "roadBuilding", "yearOfPlenty", "monopoly", "victoryPoint"];

// Glossary (shared/glossary.md): friendly, consistent names.
export const RES_NAME = { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" };
export const TERRAIN_NAME = { wood: "Forest", brick: "Hills", sheep: "Pasture", wheat: "Fields", ore: "Mountains", desert: "Desert", gold: "Gold field", sea: "Sea" };
export const DEV_NAME = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "Victory Point" };
export const CARD_TEXT = {
  wood: "From the forest", brick: "From the hills", sheep: "From the pasture", wheat: "From the fields", ore: "From the mountains",
  knight: "Move the robber and steal 1 card", roadBuilding: "Build 2 roads for free", yearOfPlenty: "Take any 2 cards from the bank",
  monopoly: "Name a resource — everyone hands theirs to you", victoryPoint: "Worth 1 victory point",
};

/** Escape text for use inside SVG/HTML. */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
