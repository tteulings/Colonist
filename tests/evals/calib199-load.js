// Loads the v1.99 calibration games: node tests/evals/calib199-load.js [dir]   (prints one line per game; `require` it for the data)
//   const { load } = require("./calib199-load.js"); for (const g of load()) { g.calib, g.meta, g.state, g.rv.reviews[pid].results ... }
// The unpacked game is what the app's "Export file" writes ({ format, v, meta, state, rv }) plus `calib` (seed, levels per seat, timings).
// rv.recs is the packed decision record; use unpackRecs from src/review/pack.js (ES module: `await import`) when the positions are needed.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
function load(dir = path.join(__dirname, "calib199")) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort().map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))));
}
module.exports = { load };
if (require.main === module) {
  const gs = load(process.argv[2]); let n = 0;
  for (const g of gs) {
    const c = g.calib, rv = g.rv.reviews, res = (pid) => (rv[pid]?.results || []).length;
    console.log(`${c.tag.padEnd(52)} pts ${String(c.points).padStart(2)} turns ${String(c.turns).padStart(3)} win ${c.winner} vp ${c.seats.map((s) => s.vp).join("/")} decisions ${[0, 1, 2, 3].map(res).join("/")} play ${Math.round(c.playMs / 1000)}s review ${Math.round(c.reviewMs / 1000)}s`); n++;
  }
  console.log(n + " games");
}
