// Seafarers entry point for game.js: the rules engine with the bot logic mixed in, scenario data and
// the game-side UI mixin. Everything Seafarers-specific lives under src/seafarers/.
import { Seafarers } from "./rules.js";
import { SeaAI } from "./ai.js";

Object.assign(Seafarers.prototype, SeaAI);

export { Seafarers };
export { layoutHexes, mainCenter, ISLAND_TILES, PIRATE_START, WIN_POINTS, SHIP_LIMIT, SHIP_COST } from "./scenario.js";
export { SeaGame } from "./ui.js";
export { drawClassicSea } from "./render.js";
