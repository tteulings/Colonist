// The seeded bot-vs-bot games of the golden net. `seats` are bot presets (src/game.js AI_PRESETS) or the search bots master / super / superplus / grandmaster
// (fixed counted budgets, see lib.mjs BUDGETS). group = the line of the table (levels x modes).
const G = (id, group, seed, seats, o = {}) => ({ id, group, seed, seats, ...o });
export const GAMES = [
  // classic, heuristic levels
  G("classic-beginner", "beginner", 11, ["beginner", "beginner", "beginner", "beginner"]),
  G("classic-simple", "simple", 12, ["simple", "simple", "simple", "simple"]),
  G("classic-intermediate", "intermediate", 13, ["intermediate", "intermediate", "intermediate", "intermediate"]),
  G("classic-expert", "expert", 14, ["expert", "expert", "expert", "expert"]),
  G("classic-styles", "expert", 15, ["trader", "builder", "shark", "expert"], { map: "balanced" }),
  G("classic-ladder", "mixed", 16, ["simple", "beginner", "intermediate", "expert"]),
  G("classic-rules8-deck", "mixed", 17, ["expert", "intermediate", "simple", "beginner"], { winPoints: 8, dice: "deck", map: "balanced" }),
  G("classic-2p", "mixed", 18, ["expert", "intermediate"], { dice: "balanced" }),
  // classic, search bots (counted budgets)
  G("classic-master", "master", 21, ["master", "expert", "intermediate", "master"]),
  G("classic-super", "super", 22, ["super", "expert", "superplus", "intermediate"]),
  G("classic-superplus", "super", 23, ["superplus", "superplus", "expert", "beginner"]),
  G("classic-grandmaster", "grandmaster", 24, ["grandmaster", "expert", "intermediate", "beginner"]),
  // Rush (virtual clock)
  G("rush-expert", "rush", 31, ["expert", "expert", "expert", "expert"], { mode: "rush" }),
  G("rush-ladder", "rush", 32, ["simple", "beginner", "intermediate", "expert"], { mode: "rush" }),
  G("rush-master", "rush", 33, ["master", "expert", "intermediate", "simple"], { mode: "rush" }),
  G("rush-6p", "rush", 34, ["expert", "intermediate", "expert", "beginner", "simple", "intermediate"], { mode: "rush" }),
  // Seafarers
  G("sea-expert", "seafarers", 41, ["expert", "expert", "expert"], { sea: true }),
  G("sea-ladder", "seafarers", 42, ["beginner", "intermediate", "expert", "simple"], { sea: true }),
  G("sea-master", "seafarers", 43, ["master", "expert", "superplus"], { sea: true }),
  G("sea-rush", "seafarers", 44, ["expert", "intermediate", "beginner"], { sea: true, mode: "rush" }),
  // 5-6 players (the bigger island + Special Building Phase)
  G("six-expert", "5-6 players", 51, ["expert", "expert", "expert", "expert", "expert", "expert"]),
  G("six-ladder", "5-6 players", 52, ["simple", "beginner", "intermediate", "expert", "trader", "shark"]),
  G("five-intermediate", "5-6 players", 53, ["intermediate", "intermediate", "intermediate", "expert", "builder"]),
  G("six-master", "5-6 players", 54, ["master", "expert", "intermediate", "beginner", "simple", "super"]),
];
