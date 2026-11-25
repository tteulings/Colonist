// The engine's `_quick` judge (api/engine.js) must say yes only where the full scan says yes. Plays host games and, at every step, judges the bot's answer and a
// handful of mutated copies (other hex, victim, card, hand, a stray field) twice: as is, and with `_quick` switched off (the scan). Any difference is a failure.
//   node tests/quick199.mjs [games=20]
import { g, playGame, hostMode } from "./golden/lib.mjs";
import { Engine } from "../src/api/engine.js";
const N = +(process.argv[2] || 20);
const quick = Engine.prototype._quick;
let n = 0, yes = 0; const bad = [];
const both = (e, a, prompt) => {
  const r1 = e.isLegal(a, { prompt }).ok;
  Engine.prototype._quick = () => false; const r2 = e.isLegal(a, { prompt }).ok; Engine.prototype._quick = quick;
  n++; if (r1) yes++;
  if (r1 !== r2 && bad.length < 8) bad.push(`${JSON.stringify(a)} under ${prompt.kind}: quick ${r1}, scan ${r2}`);
};
const mutants = (a, e) => {
  const out = [];
  const H = g.geometry.hexes.length;
  if (a.type === "moveRobber") { out.push({ ...a, hex: (a.hex + 1) % H }, { ...a, hex: g.robberHexId }, { ...a, hex: H + 3 }, { ...a, target: "robber" }, { ...a, hex: 0 }, { ...a, hex: H - 1 }); }
  if (a.type === "steal") out.push({ ...a, victim: (a.victim + 1) % g.players.length }, { ...a, victim: a.actor });
  if (a.type === "discard") { const c = { ...a.cards }; const r = Object.keys(c)[0]; if (r) { out.push({ ...a, cards: { ...c, [r]: c[r] + 1 } }, { ...a, cards: { ...c, [r]: c[r] - 1 } }, { ...a, cards: { ore: 9 } }, { ...a, cards: {} }); } }
  if (a.type === "playDev") out.push({ ...a, card: "knight" }, { ...a, card: "monopoly" }, { ...a, card: "yearOfPlenty" }, { ...a, card: "roadBuilding" }, { ...a, card: "victoryPoint" });
  return out;
};
const orig = Engine.prototype.apply;
Engine.prototype.apply = function (a, o) { const pr = this.prompts().find((p) => p.actor === a.actor); if (pr) { both(this, a, pr); mutants(a, this).forEach((m) => both(this, m, pr)); } return orig.call(this, a, o); };
hostMode.on = true;
const SH = [["expert", "simple", "intermediate", "expert"], ["trader", "shark", "builder", "beginner"]];
for (let i = 0; i < N; i++) { playGame({ id: "q", seed: 31000 + i, seats: SH[i % 2], sea: false }); }
for (let i = 0; i < Math.ceil(N / 4); i++) playGame({ id: "q", seed: 32000 + i, seats: ["expert", "intermediate", "trader"], sea: true });
console.log(bad.length ? bad.join("\n") + "\nFAILED" : `ALL ${n} judgements equal (${yes} legal)`);
process.exit(bad.length ? 1 : 0);
