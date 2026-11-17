// Rehydrates a JSON fixture into the `fx` object the validator and recipes use (src/review/ai-page.js). fx.ref is a lookup in the table the
// builder filled by calling the app's own fx.ref over the whole ref space, so facts can never drift from ai-index.js.
let LG = null; try { LG = require("../../src/review/ai-lang.js"); } catch (e) { LG = null; }
function rehydrate(F) {
  const keys = F.keys, seatOf = (k) => keys.indexOf(String(k));
  const fx = { ...F, seatOf, nameOf: (q) => F.players[q].name, hasWc: F.hasWc, g: null };
  fx.log = F.hasLog ? {} : null;
  fx.lang = F.lang || "en"; fx.t = LG ? LG.langOf(fx.lang) : undefined; fx.board = F.board ? { ...F.board, hexName: (i) => `hex ${i}`, spotName: (i) => `spot ${i}` } : null;
  fx.ref = (r) => (Object.prototype.hasOwnProperty.call(F.refs, r) ? F.refs[r] : null);
  fx.wc = (q, t) => fx.ref(`wc.${keys[q]}@${t}`)?.v ?? null;
  fx.decAt = (t) => F.decs.find((d) => d.turn === t) || null;
  fx.swings = (q, k = 4) => { const out = []; for (let t = 1; t <= F.T; t++) { const c = fx.ref(`d.${keys[q]}@${t}`); if (c && c.v) out.push({ t, d: c.v }); } return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, k); };
  fx.change = (q, t) => { const c = fx.ref(`d.${keys[q]}@${t}`); return c ? { d: c.v } : null; };
  return fx;
}
/** v1.90 the same fx but with the win chance series of the step ledger (the game card reads that one): fx.wc and the wc.<p>@<t> refs come from ser (Map turn -> fractions). */
function withLedger(fx, ser) {
  const wcL = (q, t) => { let v = null; for (let k = t; k >= 0 && !v; k--) v = ser.by.get(k); return v ? Math.round(v[q] * 100) : null; };
  fx.wc = wcL; const old = fx.ref;
  fx.ref = (r) => { const m = /^wc\.([^@]+)@(\d+)$/.exec(r); if (m) { const q = fx.seatOf(m[1]), v = q < 0 ? null : wcL(q, +m[2]); return v == null ? null : { v, k: "pct" }; } return old(r); };
  return fx;
}
module.exports = { rehydrate, withLedger };
