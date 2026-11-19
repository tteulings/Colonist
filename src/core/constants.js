// The one table of rule constants (architecture step 1). Pure data, no DOM and no imports: the game, the bots, the Master search worker, the review
// and the Node harness (tests/golden, scripts) all read these instead of keeping their own copies. Display data (names, colours, icons) stays in
// src/resources.js; this file is what the RULES need.
//
// Modes. The base game (Classic, Rush, 5-6 players) has four things to build and buy: road, settlement, city, development card. Seafarers adds the
// ship (1 lumber + 1 wool, 15 of them). Anything that reads a cost by key looks up only the pieces its mode has, so COSTS_SEA ⊇ COSTS never
// changes a result; code that can see a Seafarers game (the game class, the review's evaluate, replay-odds) uses COSTS_SEA / costsFor(sea),
// code that is Classic-only keeps COSTS. (Before this file review/evaluate.js was the only copy that carried the ship; the others had none.)
// Nothing exported here is frozen on purpose: callers pass these objects around freely and none may mutate them (tests/golden would show it).

export const RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"];
/** The four development cards that are played; victoryPoint is only held (DEV_KEYS has all five). */
export const DEV_CARD_TYPES = ["knight", "roadBuilding", "yearOfPlenty", "monopoly"];
export const DEV_KEYS = [...DEV_CARD_TYPES, "victoryPoint"];

export const SHIP_COST = { wood: 1, sheep: 1 }; // Seafarers (rulebook p. 3)
export const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  development: { sheep: 1, wheat: 1, ore: 1 },
};
export const COSTS_SEA = { ...COSTS, ship: SHIP_COST };
/** The cost table of a mode: sea = a Seafarers game. */
export const costsFor = (sea) => (sea ? COSTS_SEA : COSTS);

export const SHIP_LIMIT = 15;
export const PIECE_LIMITS = { road: 15, settlement: 5, city: 4 };
export const PIECE_LIMITS_SEA = { ...PIECE_LIMITS, ship: SHIP_LIMIT };
export const limitsFor = (sea) => (sea ? PIECE_LIMITS_SEA : PIECE_LIMITS);

export const BANK_SIZE = 19;      // cards of each resource: 3-4 players
export const BIG_BANK_SIZE = 24;  // 5-6 players

/** Pips (dots) of a number token = ways to roll it out of 36. 7 has none (no token); see DICE_WAYS for the roll itself. */
export const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
/** Ways to roll a total with two dice out of 36, the 7 included. */
export const DICE_WAYS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Development deck contents: 25 cards (3-4 players), 34 for 5-6 players. */
export const DEV_DECK = { knight: 14, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2, victoryPoint: 5 };
export const BIG_DEV_DECK = { knight: 20, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3, victoryPoint: 5 };
/** A deck in dealing order (before the shuffle). */
export const deckList = (deck) => Object.entries(deck).flatMap(([k, n]) => Array(n).fill(k));
