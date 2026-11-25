// v1.99 The FACTS layer of the post-game analysis (pure data + formatting; no DOM reads). Every number that any post-game screen shows is a typed fact
//   { id, seat, unit, value, label, source }
// in ONE store per review and seat (built once with the model, src/post-model.js `build`, cached with it). The screens (src/post-ui.js, post-tabs.js, post-hist.js)
// may NOT do arithmetic on a displayed number: they ask the store for a fact and the formatter renders it by its unit. The glossary (docs/design/glossary-v199.md)
// defines every id; tests/facts199-ui.js checks that every number on a screen sits in an element with data-fact="<id>:<seat>" and equals the store.
//
// units: wc (win chance, %) · wcDelta (a change of win chance, signed %) · lead (how far a best move was ahead of the next option; NEVER win chance) · pts (game points)
//        count · cards (signed card difference) · acc (Accuracy/Precisie 0-100) · turn · margin (the ± of a move) · rate (win chance per move, 1 decimal)
import { isNL } from "./i18n.js";
import { seOf } from "./review/score.js";
import { inScope } from "./review/coach-rules.js";

const r0 = Math.round;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
export const UNITS = ["wc", "wcDelta", "lead", "pts", "count", "cards", "acc", "turn", "margin", "rate"];
const WORDS = {
  en: { wc: "win chance", lead: "lead", pt: "point", pts: "points", card: "card", cards: "cards", dots: "dots" },
  nl: { wc: "winkans", lead: "voorsprong", pt: "punt", pts: "punten", card: "kaart", cards: "kaarten", dots: "stippen" },
};
export const words = () => WORDS[isNL() ? "nl" : "en"];
const loc = () => (isNL() ? "nl-NL" : "en-US");
/** a magnitude in the language's number style (Dutch decimal comma), `dec` decimals */
export const numStr = (v, dec = 0) => { try { return Math.abs(v).toLocaleString(loc(), { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: false }); } catch (_) { return String(Math.abs(v)); } };
const sg = (v, dec = 0) => { const r = Math.round(Math.abs(v) * 10 ** dec) / 10 ** dec; return r === 0 ? "±" : v > 0 ? "+" : "−"; };
const ordinal = (n) => (isNL() ? `${n}e` : `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`);
/** the text of a fact by its unit. o: { word: add the unit word ("+7% win chance", "3 points"), abs: no sign, bare: no % sign } */
export function fmt(f, o = {}) {
  if (!f || !fin(f.value)) return "–";
  const v = f.value, dec = o.dec ?? f.dec ?? 0, W = words(), pct = o.bare ? "" : "%", n = numStr(v, dec), u = f.unit;
  switch (u) {
    case "wc": return `${n}${pct}`;
    case "wcDelta": { const t = `${o.abs ? "" : sg(v, dec)}${n}${pct}`; return o.word ? `${t} ${W.wc}` : t; }
    case "lead": return `+${n}${pct}${o.word === false ? "" : ` ${W.lead}`}`;
    case "pts": return o.word ? `${n} ${r0(v) === 1 ? W.pt : W.pts}` : `${o.plus && v > 0 ? "+" : ""}${n}`;
    case "cards": { const t = `${o.abs ? "" : sg(v, dec)}${n}`; return o.word ? `${t} ${Math.abs(r0(v)) === 1 ? W.card : W.cards}` : t; }
    case "count": return o.ord ? ordinal(v) : o.signed ? `${sg(v, dec)}${n}` : n;
    case "margin": return `±${numStr(v, 1)}${pct}`;
    case "rate": return `${numStr(v, 1)}${pct}`;
    default: return n; // acc, turn
  }
}

/** one store; ids are strings ("startCost"), seats are numbers (or "-" for facts of no seat). A ref is "id" or "id:seat". */
export class Facts {
  constructor(seat = 0, tag = "") { this.seat = seat; this.tag = tag; this.map = new Map(); this.data = {}; }
  key(id, seat) { return `${id}:${seat}`; }
  put(id, seat, unit, value, label = null, source = "post-facts", dec) {
    if (!fin(value)) return null;
    const f = { id, seat, unit, value, label: label || `fact.${id.replace(/\.\d+/g, "")}`, source }; if (dec != null) f.dec = dec;
    this.map.set(this.key(id, seat), f); return f;
  }
  ref(ref) { const i = String(ref).lastIndexOf(":"); return i > 0 && /^(\d+|-)$/.test(ref.slice(i + 1)) ? [ref.slice(0, i), ref.slice(i + 1) === "-" ? "-" : +ref.slice(i + 1)] : [ref, this.seat]; }
  get(ref) { const [id, seat] = this.ref(ref); return this.map.get(this.key(id, seat)) || null; }
  has(ref) { return !!this.get(ref); }
  v(ref) { const f = this.get(ref); return f ? f.value : null; }
  t(ref, o) { const f = this.get(ref); return f ? fmt(f, o) : "–"; }
  keyOf(ref) { const [id, seat] = this.ref(ref); return this.key(id, seat); }
  all() { return [...this.map.values()]; }
  // ── html: every number element carries data-fact ──
  /** a plain number */
  n(ref, o = {}) { const f = this.get(ref); if (!f) return `<span class="px-n z">–</span>`; return `<span class="px-n${o.cls ? ` ${o.cls}` : ""}" data-fact="${this.keyOf(ref)}"${o.word ? " data-i18n-skip" : ""}>${fmt(f, o)}</span>`; }
  /** a signed win-chance change as a pill: green ▲ / tinted ▼ for everybody; ±0 stays neutral */
  d(ref, o = {}) {
    const f = this.get(ref); if (!f) return `<b class="px-d z">–</b>`;
    const r = Math.round(f.value * 10 ** (o.dec ?? f.dec ?? 0)), cls = r > 0 ? "up" : r < 0 ? "dn" : "z", k = this.keyOf(ref);
    return `<b class="px-d ${cls}" data-fact="${k}"${o.word ? " data-i18n-skip" : ""}>${r > 0 ? `<i aria-hidden="true">▲</i>` : r < 0 ? `<i aria-hidden="true">▼</i>` : ""}${fmt(f, o)}</b>`;
  }
  /** "+14 lead": the lead of a best move over the next option (never a win-chance change) */
  lead(ref) { const f = this.get(ref); if (!f) return ""; return `<span class="px-lead" data-fact="${this.keyOf(ref)}" data-i18n-skip><b>${fmt(f, { word: false })}</b><small>${words().lead}</small></span>`; }
  /** a phrase with numbers in it: "{n} of {n2} decisions are scored". vars: [ref, opts?] = a number of the store; anything else is plain text (names are never read as refs). The whole phrase is ONE element
   *  with data-fact="ref ref ..." (the localizer reads the phrase as one text, so English templates still turn Dutch). */
  ph(tpl, vars = {}, o = {}) {
    const keys = []; const sub = {};
    Object.entries(vars).forEach(([k, v]) => {
      if (Array.isArray(v)) { const [ref, oo = {}] = v; if (this.has(ref)) { keys.push(this.keyOf(ref)); sub[k] = this.t(ref, oo); } else sub[k] = "–"; } else sub[k] = v == null ? "–" : String(v);
    });
    const text = tpl.replace(/\{(\w+)\}/g, (m, k) => (k in sub ? sub[k] : m));
    return keys.length ? `<span class="px-ph" data-fact="${keys.join(" ")}"${o.skip ? " data-i18n-skip" : ""}>${text}</span>` : text;
  }
  /** the same, for a sentence already in the app language (data-i18n-skip) built from `atr` keys: numbers in `vars` are replaced by their tagged element */
  tag(ref, o = {}) { return this.has(ref) ? this.n(ref, o) : "–"; }
}

// ── registry: the test reads the text of any fact back from the page ──
const REG = typeof WeakMap !== "undefined" ? new WeakMap() : null; // review object -> Map(pid -> Facts)
const GLOBAL = { hist: null, bots: null, histrows: [] };
export const setGlobal = (k, S) => { if (k === "histrows") { GLOBAL.histrows.push(S); if (GLOBAL.histrows.length > 300) GLOBAL.histrows.shift(); } else GLOBAL[k] = S; };
if (typeof window !== "undefined") {
  window.__postFacts = {
    /** formatted text of a "id:seat" ref for the review that is open now (and the history / bots stores): the same string the screens show */
    text(ref, o) { const g = window.__colonistGame; const m = g?._rv && REG?.get(g._rv); const stores = [...(m ? m.values() : []), GLOBAL.hist, GLOBAL.bots, ...[...GLOBAL.histrows].reverse()].filter(Boolean); for (const S of stores) { if (S.has(ref)) return S.t(ref, o); } return null; },
    has(ref) { return this.text(ref) != null; },
    /** { value, unit, dec } of a ref, for the audit test */
    fact(ref) { const g = window.__colonistGame; const m = g?._rv && REG?.get(g._rv); const stores = [...(m ? m.values() : []), GLOBAL.hist, GLOBAL.bots, ...[...GLOBAL.histrows].reverse()].filter(Boolean); for (const S of stores) { const f = S.get(ref); if (f) return { value: f.value, unit: f.unit, dec: f.dec ?? 0, id: f.id, seat: f.seat }; } return null; },
  };
}
export const register = (R, pid, S) => { if (!R || !REG) return; let mm = REG.get(R); if (!mm) { mm = new Map(); REG.set(R, mm); } mm.set(pid, S); };

// ── cost arithmetic: ONE place ──
const fit = (vals, total) => { // largest remainder: integers (same sign as total) that add up to `total`
  const base = vals.map((v) => Math.trunc(v)), rem = vals.map((v, i) => [Math.abs(v - base[i]), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let left = total - base.reduce((a, b) => a + b, 0); const step = left >= 0 ? 1 : -1;
  for (let k = 0; left !== 0 && k < 60; k += 1) { base[rem[k % rem.length][1]] += step; left -= step; }
  return base;
};
/** start picks, clear errors and other moves, in whole percent of win chance given up (raw, as the review measured them), the cap on the moves AFTER the start (the best win chance ever held).
 *  The start is shown raw (no scaling). Only the moves after it are limited by the cap, so start + moves = total always holds. */
export function costOf({ start = 0, errors = 0, other = 0, cap = 100 } = {}) {
  const zRaw = errors + other, zet = Math.min(zRaw, Math.max(0, cap - start));
  const [e, o] = zRaw === zet || !zRaw ? [errors, other] : fit([(errors * zet) / zRaw, (other * zet) / zRaw], zet);
  return { start, errors: e, other: o, moves: zet, total: start + zet, capped: zet < zRaw, cap, raw: zRaw };
}

/** the facts of the whole table (every seat): points, Accuracy, luck, cost split, counts. g: the game, tab: tableOf(g), A: the analysis data layer (or null) */
export function tableFacts(S, g, tab, A) {
  const P = (id, seat, unit, v, label, src, dec) => S.put(id, seat, unit, v, label, src, dec);
  tab.seats.forEach((s) => {
    const q = s.id;
    P("pts", q, "pts", s.pts, "fact.pts", "game");
    if (s.acc != null) P("acc", q, "acc", s.acc, "fact.acc", "summarize");
    const lk = A?.luck?.[q]; if (s.luck != null && lk) { P("luck", q, "wcDelta", lk.total, "fact.luck", "luckSplit"); P("lkSeat", q, "wcDelta", lk.seat, "fact.lkSeat", "luckSplit"); P("lkDice", q, "wcDelta", lk.dice, "fact.lkDice", "luckSplit"); P("lkSteal", q, "wcDelta", lk.steal, "fact.lkSteal", "luckSplit"); P("lkDraw", q, "wcDelta", lk.draw, "fact.lkDraw", "luckSplit"); }
    if (s.cards != null) P("cards", q, "cards", s.cards, "fact.cards", "luck");
    if (s.src) Object.entries(s.src).forEach(([k, v]) => { if (typeof v === "number") P(`src.${k}`, q, "pts", v, "fact.src", "stats.sources"); });
    const bs = A?.bySeat?.[q];
    if (bs?.raw) {
      const c = costOf(bs.raw);
      P("startCost", q, "wcDelta", -c.start, "fact.startCost", "decisions"); P("errCost", q, "wcDelta", -c.errors, "fact.errCost", "decisions"); P("otherCost", q, "wcDelta", -c.other, "fact.otherCost", "decisions");
      P("moveCost", q, "wcDelta", -c.moves, "fact.moveCost", "decisions"); P("movesTotal", q, "wcDelta", -c.total, "fact.movesTotal", "decisions");
      P("errors", q, "count", bs.errors, "fact.errors", "decisions");
      if (bs.cls) { ["best", "great", "good", "close", "lean"].forEach((k) => P(`cls.${k}`, q, "count", bs.cls[k], `num.cls.${k}`, "decisions")); P("cls.could", q, "count", bs.cls.could + bs.cls.mistake + bs.cls.blunder + bs.cls.missed - (bs.errors ?? 0), "num.cls.could", "decisions"); }
    }
    const bf = A?.facts?.[q]; if (bf) ["settlement", "city", "road", "cards", "bank", "player"].forEach((k) => P(`num.${k === "settlement" ? "settlements" : k === "city" ? "cities" : k === "road" ? "roads" : k}`, q, "count", bf[k], `num.${k}`, "stats")), P("num.firstCity", q, "turn", bf.firstCity, "num.firstCity", "stats");
  });
  tab.seats.forEach((s) => { if (s.luck != null && !S.has(`luck:${s.id}`)) P("luck", s.id, "wcDelta", s.luck, "fact.luck", "luckSplit"); if (s.running) { P("runJ", s.id, "count", s.running.j, "fact.run", "review"); P("runN", s.id, "count", s.running.n, "fact.run", "review"); } });
  return S;
}
export const tableStore = (g, tab) => { const S = new Facts(tab.me, "table"); tableFacts(S, g, tab, null); return S; };

// ───────────────────────── the builder ─────────────────────────
const NUMROW = { points: "pts", acc: "acc", cost: "movesTotal", luck: "luck", "cls.errors": "errors" };
/** the id a Numbers-sheet row reads (shared with the screens that show the same number) */
export const numRef = (id) => NUMROW[id] || (/^pts\.(opening|mid|end)$/.test(id) ? `tempo.${id.slice(4)}` : `num.${id}`);
const RES = ["wood", "brick", "sheep", "wheat", "ore"];

/** the whole table + the viewing seat's facts. g: the game, m: the model of seat m.pid (post-model build), tab: tableOf(g). */
export function buildFacts(g, m, tab) {
  const S = new Facts(m.pid), pid = m.pid, A = m.A, n = m.n, P = (id, seat, unit, v, label, src, dec) => S.put(id, seat, unit, v, label, src, dec);
  tableFacts(S, g, tab, A);
  if (A?.tempo?.phases) A.tempo.phases.forEach((ph) => ph.gain.forEach((v, q) => P(`tempo.${ph.id}`, q, "pts", v, "fact.tempo", "tempo")));
  if (A?.tempo?.setup) A.tempo.setup.forEach((v, q) => P("tempo.start", q, "pts", v, "fact.tempo", "tempo"));
  const target = g.winPoints || 10; P("target", "-", "pts", target, "fact.target", "settings");
  P("lim.small", "-", "wc", 1, "fact.lim", "constant"); P("lim.err", "-", "wc", 6, "fact.lim", "constant"); P("lim.set1", "-", "wc", 5, "fact.lim", "constant"); P("lim.set2", "-", "wc", 10, "fact.lim", "constant"); P("lim.set3", "-", "wc", 18, "fact.lim", "constant");
  if (A?.limits) { ["opening", "mid", "end"].forEach((k) => { P(`ph.${k}.from`, "-", "turn", A.limits[k][0], "fact.phRange", "limits"); P(`ph.${k}.to`, "-", "turn", A.limits[k][1], "fact.phRange", "limits"); }); P("lim.turns", "-", "count", A.limits.nTurns, "fact.lim", "limits"); }
  P("lim.dots", "-", "count", 6, "fact.lim", "constant"); P("lim.picks", "-", "count", 2, "fact.lim", "constant");
  // ── the viewing seat ──
  const me = pid, bsMe = A?.bySeat?.[me], ds = m.ds, errs = m.errs, c = m.counts;
  const cost = bsMe?.raw ? costOf(bsMe.raw) : null;
  S.cost = cost;
  if (cost) {
    P("capNote", me, "wc", cost.cap, "fact.cap", "decisions");
    P("moveRaw", me, "wcDelta", -cost.raw, "fact.moveRaw", "decisions");
  }
  // counts
  const startN = ds.filter((d) => d.k === "setup" && d.cls !== "triv").length;
  P("decisions", me, "count", c.total, "fact.decisions", "recorder"); P("scored", me, "count", c.scored, "fact.scored", "decisions"); P("oneOption", me, "count", Math.max(0, c.total - c.scored), "fact.oneOption", "recorder");
  P("startN", me, "count", startN, "fact.startN", "decisions"); P("otherN", me, "count", Math.max(0, c.scored - errs.length - startN), "fact.otherN", "decisions");
  P("notErrors", me, "count", c.notErrors || 0, "fact.notErrors", "decisions");
  const fam = { strong: 0, close: 0, costly: 0 }; const FAMILY = { best: "strong", great: "strong", good: "strong", close: "close", lean: "close", could: "costly", mistake: "costly", blunder: "costly", missed: "costly" };
  ds.filter((d) => d.cls !== "triv").forEach((d) => { if (FAMILY[d.cls]) fam[FAMILY[d.cls]] += 1; });
  P("fam.strong", me, "count", fam.strong, "fact.fam", "decisions"); P("fam.close", me, "count", fam.close, "fact.fam", "decisions"); P("fam.could", me, "count", Math.max(0, fam.costly - errs.length), "fact.fam", "decisions");
  const smallDiff = m.other.filter((d) => d.gp >= 1).length; P("smallDiff", me, "count", smallDiff, "fact.smallDiff", "decisions");
  // every decision: its cost, its margin, the win chance after it
  ds.forEach((d) => {
    P(`mv.${d.i}.cost`, me, "wcDelta", -d.gp, "fact.mvCost", "decisions"); P(`mv.${d.i}.B`, me, "wc", d.B, "fact.mvB", "decisions"); P(`mv.${d.i}.A`, me, "wc", d.A, "fact.mvA", "decisions");
    const se = seOf(d.x); if (se != null) P(`mv.${d.i}.margin`, me, "margin", Math.max(0.5, Math.round(se * 1000) / 10), "fact.margin", "decisions");
  });
  // visible points before an error / a rule chip
  const win = target;
  m.lesson1.forEach((e) => { if (e.vis != null) P(`mv.${e.i}.vis`, me, "pts", e.vis, "fact.vis", "stats.vp"); });
  (m.lesson3 || []).forEach((r, k) => { P(`rule.${r.phase}.cost`, me, "wcDelta", r.cost, "fact.ruleCost", "phaseCost"); r.chips.forEach((q, j) => { if (q.gp != null) P(`mv.${q.i}.cost`, me, "wcDelta", -q.gp, "fact.mvCost", "decisions"); if (q.pts != null) P(`rule.${r.phase}.pts.${j}`, me, "pts", q.pts, "fact.vis", "stats.vp"); }); });
  void win;
  // pillars and the phase costs
  const startC = cost ? cost.start : ds.filter((d) => d.k === "setup").reduce((a, d) => a + d.gp, 0);
  if (cost) {
    const lim = A.limits, phKey = (t) => (t <= lim.opening[1] ? "opening" : t <= lim.mid[1] ? "mid" : "end"), raw = { opening: 0, mid: 0, end: 0 };
    errs.forEach((d) => { raw[phKey(d.t)] += d.gp; });
    const tot = raw.opening + raw.mid + raw.end, ph = tot ? fit([raw.opening, raw.mid, raw.end].map((v) => (v * cost.errors) / tot), cost.errors) : [0, 0, 0];
    ["opening", "mid", "end"].forEach((k, i) => P(`phase.${k}`, me, "wcDelta", -ph[i], "fact.phaseCost", "decisions"));
  }
  // the start review: picks, the best spot, the shortlist
  const picks = m.start?.picks || [];
  picks.forEach((p) => {
    const nn = p.n; P(`pick${nn}.win`, me, "wc", p.win, "fact.pickWin", "review.cands"); P(`pick${nn}.best`, me, "wc", p.best, "fact.pickBest", "review.cands"); P(`pick${nn}.cost`, me, "wcDelta", -p.gp, "fact.pickCost", "review.cands"); P(`pick${nn}.gain`, me, "wcDelta", p.gp, "fact.pickGain", "review.cands");
    if (p.spot) { P(`pick${nn}.dots`, me, "count", p.spot.total, "fact.dots", "board"); RES.forEach((r) => { if (p.spot.dots?.[r] > 0) P(`pick${nn}.dots.${r}`, me, "count", p.spot.dots[r], "fact.dots", "board"); }); }
    const top = p.shortlist?.[0]; if (top?.spot) P(`pick${nn}.bestDots`, me, "count", top.spot.total, "fact.dots", "board");
    (p.shortlist || []).forEach((q, k) => { if (!(q.played || q.best)) { P(`sl${nn}.${k}.win`, me, "wc", q.win, "fact.slWin", "review.cands"); } if (q.spot) { P(`sl${nn}.${k}.dots`, me, "count", q.spot.total, "fact.dots", "board"); RES.forEach((r) => { if (q.spot.dots?.[r] > 0) P(`sl${nn}.${k}.dots.${r}`, me, "count", q.spot.dots[r], "fact.dots", "board"); }); } });
  });
  S.slRef = (nn, k, p) => { const q = p.shortlist[k]; return { win: q.played ? `pick${nn}.win` : q.best ? `pick${nn}.best` : `sl${nn}.${k}.win`, dots: q.spot ? (q.played ? `pick${nn}.dots` : k === 0 ? `pick${nn}.bestDots` : `sl${nn}.${k}.dots`) : null }; };
  // best moves: the lead over the next option
  (m.bestRows || []).forEach((o) => P(`lead.${o.d.i}`, me, "lead", o.gain, "fact.lead", "decisions"));
  // the moves lists (Moves tab): biggest misses, then the rest
  {
    const miss = [...errs.slice(0, 4), ...m.other.filter((d) => d.cls !== "triv" && inScope(d) && d.gp >= 1).sort((a, b) => b.gp - a.gp || a.i - b.i).slice(0, 3)];
    const shown = new Set(miss.map((d) => d.i));
    const rest = ds.filter((d) => !shown.has(d.i) && d.cls !== "triv" && d.k !== "setup" && inScope(d)).sort((a, b) => b.gp - a.gp || a.i - b.i);
    const restN = Math.max(0, S.v(`otherN:${me}`) - miss.filter((d) => !errs.includes(d)).length);
    P("restN", me, "count", restN, "fact.restN", "decisions");
    S.data.miss = miss; S.data.rest = rest; S.data.restLt1 = (rest.length ? Math.max(...rest.map((d) => d.gp)) : 0) < 1;
  }
  // tempo / builds / income / measures / rival
  m.builds?.rows?.forEach((rw, q) => P("builds", q, "count", rw.length, "fact.builds", "stats"));
  m.income?.forEach((r) => { r.res.forEach((v, k) => P(`inc.${RES[k]}`, r.id, "count", v, "fact.inc", "stats.prod")); P("inc.tot", r.id, "count", r.tot, "fact.inc", "stats.prod"); });
  m.measures?.forEach((r) => {
    r.vals.forEach((v, q) => { P(`meas.${r.k}`, q, "count", v, "fact.meas", "stats", Number.isInteger(v) ? 0 : 1); P(`rank.${r.k}`, q, "count", 1 + r.vals.filter((z) => z > v).length, "fact.rank", "stats"); });
    P(`measBest.${r.k}`, me, "count", r.bestOther, "fact.measBest", "stats", Number.isInteger(r.bestOther) ? 0 : 1); P(`measDiff.${r.k}`, me, "count", r.diff, "fact.measDiff", "stats", Number.isInteger(r.diff) ? 0 : 1);
  });
  if (m.measures?.length) { const up = m.measures.filter((r) => r.mark === "up").length, dn = m.measures.filter((r) => r.mark === "dn").length; P("planUp", me, "count", up, "fact.plan", "stats"); P("planDn", me, "count", dn, "fact.plan", "stats"); }
  if (m.rival) { const R = m.rival; P("rival.theirs", me, "pts", R.theirs, "fact.rival", "tempo"); P("rival.mine", me, "pts", R.mine, "fact.rival", "tempo"); P("rival.theirBuilds", me, "count", R.theirBuilds, "fact.builds", "stats"); P("rival.myBuilds", me, "count", R.myBuilds, "fact.builds", "stats"); }
  // the key moments: one fact set per step
  const tl = m.timeline;
  if (tl) {
    const put = (p) => { const dice = p.a - p.b, after = p.e - p.a, mv = p.move ? after : 0; P(`mom.${p.S}.d`, me, "wcDelta", p.d, "fact.momD", "win chance"); P(`mom.${p.S}.move`, me, "wcDelta", mv, "fact.momMove", "win chance"); P(`mom.${p.S}.dice`, me, "wcDelta", dice, "fact.momDice", "win chance"); P(`mom.${p.S}.rest`, me, "wcDelta", after - mv, "fact.momRest", "win chance"); const st = g._st?.steps?.[p.S - 1]; if (st && st[2] != null) P(`mom.${p.S}.roll`, me, "count", st[2] + st[3], "fact.roll", "stats"); };
    [...tl.pins, ...(tl.all || [])].forEach(put);
    P("momN", me, "count", tl.pins.length + (tl.all || []).filter((p) => !tl.pins.some((q) => q.T === p.T)).length, "fact.momN", "win chance");
    const mine = tl.lines[me]; if (mine?.length) { P("tl.from", me, "wc", r0(mine[0][1] * 100), "fact.tl", "win chance"); P("tl.to", me, "wc", r0(mine[mine.length - 1][1] * 100), "fact.tl", "win chance"); }
  }
  P("takeN", me, "count", (m.takeaway || []).length, "fact.takeN", "takeaway");
  // the waterfall: fair share, start picks, moves, luck, the others, the end
  waterfall(S, g, m, cost);
  headlineFacts(S, g, m);
  return S;
}

/** Fair share + start picks + moves + luck + others = end, exactly (whole percent). Luck is each seat's own estimate (seat order included); the others are the remainder. */
function waterfall(S, g, m, cost) {
  const me = m.pid, A = m.A, L = A?.you?.ledger; if (!L || !cost) { S.data.wf = null; return; }
  S.data.res = null;
  const P = (id, unit, v, label) => S.put(id, me, unit, v, label, "waterfall");
  const lk = A.luck?.[me], hasLuck = !!lk, from = L.from, to = L.to;
  const start = -cost.start, moves = -cost.moves, luck = hasLuck ? lk.total : 0, others = to - from - start - moves - luck;
  // the real result: the review's last measured point can be before the end of the game; the step to 100% (won) or 0% (lost) is its own fact
  const wId = g.winner?.id ?? null, fin0 = wId == null ? null : wId === me ? 100 : 0, after = fin0 != null && fin0 !== to ? fin0 - to : null, endV = after != null ? fin0 : to;
  P("fair", "wc", from, "fact.fair"); P("end", "wc", endV, "fact.end"); if (after != null) S.put("afterLast", me, "wcDelta", after, "fact.afterLast", "waterfall"); S.put("startCost", me, "wcDelta", start, "fact.startCost", "decisions"); S.put("moveCost", me, "wcDelta", moves, "fact.moveCost", "decisions");
  if (hasLuck) S.put("luck", me, "wcDelta", luck, "fact.luck", "luckSplit"); P("others", "wcDelta", others, "fact.others");
  const run = [from, from + start, from + start + moves, from + start + moves + luck, to]; if (after != null) run.push(endV); run.forEach((v, i) => P(`wf.run.${i}`, "wc", v, "fact.wfRun"));
  P("perMove", "rate", m.counts.scored ? Math.abs(moves) / m.counts.scored : null, "fact.perMove");
  const lo = Math.min(0, ...run), hi = Math.max(100, ...run), span = hi - lo || 1, pc = (v) => Math.round(((v - lo) / span) * 1000) / 10;
  const seg = (a, b) => ({ left: pc(Math.min(a, b)), width: Math.max(1.2, Math.round((Math.abs(b - a) / span) * 1000) / 10) });
  S.data.wf = { hasLuck, run, geo: { fair: seg(0, from), start: seg(run[0], run[1]), moves: seg(run[1], run[2]), luck: seg(run[2], run[3]), others: seg(run[3], run[4]), after: after != null ? seg(run[4], run[5]) : null, end: seg(0, endV) }, after: after != null };
  { const w = g.winner?.id ?? null; if (w != null) { const oth = tab0(S, g).filter((q) => q !== w).sort((a, b) => (S.v(`pts:${b}`) ?? 0) - (S.v(`pts:${a}`) ?? 0)); const won = w === me; S.data.res = { won, winner: g.players[w].name, left: `pts:${won ? me : w}`, right: won ? `pts:${oth[0]}` : `pts:${me}` }; } }
  // sub-lines: the start picks that cost, the biggest miss after the start, the biggest roll on the side of the luck total
  const costly = (m.start?.picks || []).filter((p) => p.gp >= 1); S.data.wf.picks = costly.map((p) => p.n);
  const miss = m.ds.filter((d) => d.k !== "setup" && d.cls !== "triv" && inScope(d) && d.gp >= 1).sort((a, b) => b.gp - a.gp || a.i - b.i)[0] || null; S.data.wf.miss = miss;
  const sw = swings(g, me), sign = luck >= 0 ? 1 : -1;
  const roll = sw.filter((x) => !x.seven && x.roll != null && Math.sign(x.dice) === sign && Math.abs(x.dice) >= 1).sort((p, q) => Math.abs(q.dice) - Math.abs(p.dice))[0] || null;
  { const oRolls = sw.filter((x) => x.actor !== me).reduce((a, x) => a + x.dice, 0); S.put("othRolls", me, "wcDelta", oRolls, "fact.othRolls", "swings"); S.put("othRest", me, "wcDelta", others - oRolls, "fact.othRest", "swings"); }
  if (roll) { S.put("roll1.d", me, "wcDelta", roll.dice, "fact.roll1", "win chance"); S.put("roll1.n", me, "count", roll.roll, "fact.roll", "stats"); S.data.wf.roll = roll; }
}

/** the piece a player built in a step ("settlement" | "city" | "road") or "card" for a development card bought, else null */
export const buildKindAt = (st, S, actor) => { let k = null; try { (st.stepEvents?.[S] || []).forEach((e) => { if (e[1] === "b" && e[2] === actor && ["s", "c", "r"].includes(e[3])) k = { s: "settlement", c: "city", r: "road" }[e[3]]; else if (e[1] === "v" && e[2] === actor && !k) k = "card"; }); } catch (_) { k = null; } return k; };
const tab0 = (S, g) => g.players.map((p) => p.id);
/** every step of the game as this seat's win-chance swing (the review's look), in whole percent: { S, T, actor, roll, seven, b, a, e, d, dice, move } */
export function swings(g, pid) {
  const st = g._st; let look = null; try { look = g._rvLook(); } catch (_) { look = null; }
  if (!look || !st) return [];
  const awards = new Set((st.awards || []).map((q) => q.s));
  return look.steps.map((x) => { const stp = st.steps[x.S - 1], b = r0(x.b[pid] * 100), a = r0(x.a[pid] * 100), e = r0(x.e[pid] * 100), actor = stp && stp[1] >= 0 ? stp[1] : null, roll = stp ? stp[2] + stp[3] : null;
    return { S: x.S, T: st.turnOf[x.S], actor, roll, seven: roll === 7, b, a, e, d: e - b, dice: a - b, move: actor === pid ? e - a : 0 }; }).filter((x) => x.actor != null && !awards.has(x.S));
}

/** What the headline says, from the numbers alone (A = the analysis data layer, pid = the seat): { won, own, luck }
 *  own: { k: "start" (pick: the one costly pick, or null) | "miss" (i: the decision) | "best" (S, T: the step) | "clean" }, the biggest OWN-controlled part
 *  luck: { k: "own", good } when the seat's own luck is large (8% or more), else { k: "roller", actor, Ts, steps, sum, good } = the rolls of ONE other player that moved this seat's win chance
 *  on the side of the result (8% or more together), else null. Luck is only named when it is large, and then with whose rolls they were. */
export function headPlan(g, pid, won, A) {
  const bs = A?.bySeat?.[pid], ds = A?.you?.ds; if (!bs?.raw || !ds) return null;
  const cost = costOf(bs.raw), side = (v) => (won ? v : -v), sw = swings(g, pid);
  const miss = ds.filter((d) => d.k !== "setup" && d.cls !== "triv" && inScope(d) && d.gp >= 1).sort((a, b) => b.gp - a.gp || a.i - b.i)[0] || null;
  const best = won ? sw.filter((x) => x.move >= 8).sort((a, b) => b.move - a.move)[0] || null : null;
  let own;
  if (won) own = cost.start >= 5 ? { k: "start" } : best ? { k: "best", S: best.S, T: best.T, kind: buildKindAt(g._st, best.S, pid) || "move" } : miss && miss.gp >= 5 ? { k: "miss", i: miss.i } : { k: "clean" };
  else { const mc = miss ? miss.gp : 0; own = cost.start >= 3 && cost.start >= mc ? { k: "start" } : mc >= 3 ? { k: "miss", i: miss.i } : cost.start >= 3 ? { k: "start" } : { k: "clean" }; }
  if (own.k === "start") { const cp = (A.you.startReview?.picks || []).filter((p) => p.gp >= 1).sort((a, b) => b.gp - a.gp); own.pick = cp[0]?.n ?? null; own.single = cp.length === 1 && cp[0].gp === cost.start; }
  const lkv = A.luck?.[pid]?.total; let luck = null;
  if (lkv != null && Math.abs(lkv) >= 8) luck = { k: "own", good: lkv > 0 };
  else {
    const byActor = new Map(); sw.filter((x) => !x.seven && x.actor !== pid && side(x.dice) >= 3).forEach((x) => { (byActor.get(x.actor) || byActor.set(x.actor, []).get(x.actor)).push(x); });
    let top = null; byActor.forEach((l, a) => { const t2 = l.sort((p, q) => side(q.dice) - side(p.dice)).slice(0, 2).filter((x, i, arr) => arr.findIndex((y) => y.T === x.T) === i), sum = t2.reduce((s, x) => s + x.dice, 0); if (Math.abs(sum) >= 8 && (!top || Math.abs(sum) > Math.abs(top.sum))) top = { actor: a, steps: t2.sort((p, q) => p.T - q.T), sum }; });
    if (top) luck = { k: "roller", actor: top.actor, Ts: top.steps.map((x) => x.T), steps: top.steps.map((x) => x.S), sum: top.sum, good: won };
  }
  return { won, own, luck };
}
function headlineFacts(S, g, m) {
  const plan = headPlan(g, m.pid, m.won, m.A); S.data.head = plan;
  if (plan?.luck?.k === "roller") { S.put("hl.rolls", m.pid, "wcDelta", plan.luck.sum, "fact.hlRolls", "headline"); if (S.data.wf) S.data.wf.rolls = plan.luck; }
}

// ── luck rows (Luck tab) ──
/** The rows of one seat's luck list, in the unit asked: win chance or cards. Every value is a fact in the store. Groups are one per TURN (a roll, a card and a steal of one turn add up).
 *  Cards mode: a group is in cards when one of its events has a card figure (a die roll), else in win chance (a 7, a steal, a drawn card: they have no card count). */
export function luckRows(S, g, m, q, unit, showOthers) {
  const cards = unit === "cards", pre = `lk${cards ? "c" : "w"}`;
  let list = []; try { list = g._lkList(q).filter((x) => x.own); } catch (_) { list = []; }
  const seatW = (() => { try { return g._lkSeat(q); } catch (_) { return 0; } })();
  const ev = list.map((x) => ({ x, win: Math.round(x.w * 1000) / 10, cards: x.ev.kind === "dice" && x.cards != null && x.exp != null && x.ev.roll !== 7 ? Math.round((x.cards - x.exp) * 10) / 10 : null, t: (() => { try { return g._lkWhen(x.ev); } catch (_) { return ""; } })() }));
  const isOwn = (e) => e.x.ev.kind !== "dice" || e.x.ev.roller === q;
  const group = (l, tag) => { const mp = new Map(); l.forEach((e) => { const k = String(e.t || ""); (mp.get(k) || mp.set(k, []).get(k)).push(e); }); return [...mp.entries()].map(([t, es]) => {
    const cv = cards ? es.filter((e) => e.cards != null) : [], inCards = cards && cv.length > 0, pool = inCards ? cv : es, val = (e) => (inCards ? e.cards : e.win);
    const dom = pool.slice().sort((a, b) => Math.abs(val(b)) - Math.abs(val(a)))[0], sum = Math.round(pool.reduce((a, e) => a + val(e), 0)), id = `${pre}${tag}.${t}`;
    S.put(id, q, inCards ? "cards" : "wcDelta", sum, "fact.lkRow", "luck"); if (es.length > 1) S.put(`${id}.more`, q, "count", es.length - 1, "fact.lkMore", "luck");
    const ev0 = dom.x.ev; let lab = null;
    if (ev0.kind === "dice") { const rid = `${id}.roll`; S.put(rid, q, "count", ev0.roll, "fact.roll", "luck"); lab = ev0.roll === 7 ? { k: "seven", n: `${rid}:${q}` } : { k: "dice", who: ev0.roller, n: `${rid}:${q}`, rush: !!ev0.rush }; }
    else if (ev0.kind === "steal") lab = { k: "steal", thief: ev0.thief, victim: ev0.victim }; else if (ev0.kind === "dev") lab = { k: "dev", who: ev0.pid, vp: ev0.card === "victoryPoint" };
    return { t, id: `${id}:${q}`, more: es.length > 1 ? `${id}.more:${q}` : null, sum, lab, inCards }; }); };
  const own = group(ev.filter(isOwn), ""), oth = group(ev.filter((e) => !isOwn(e)), "o");
  const big = own.filter((G) => Math.abs(G.sum) >= 0.5).sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum)), small = own.filter((G) => Math.abs(G.sum) < 0.5);
  S.put(`${pre}.${q}.more`, q, "count", Math.max(0, big.length - 8), "fact.lkMore", "luck"); S.put(`${pre}.${q}.nsmall`, q, "count", small.length, "fact.lkMore", "luck");
  const othEv = ev.filter((e) => !isOwn(e)), oval = (e) => (cards ? e.cards ?? 0 : e.win);
  S.put(`${pre}.${q}.nOth`, q, "count", othEv.length, "fact.lkMore", "luck");
  S.put(`${pre}.${q}.othSum`, q, cards ? "cards" : "wcDelta", Math.round(othEv.reduce((a, e) => a + oval(e), 0)), "fact.lkOth", "luck");
  let bigO = null; if (othEv.length) { const e = othEv.slice().sort((a, b) => Math.abs(oval(b)) - Math.abs(oval(a)))[0]; S.put(`${pre}.${q}.othBig`, q, cards ? "cards" : "wcDelta", Math.round(oval(e)), "fact.lkOthBig", "luck"); bigO = { id: `${pre}.${q}.othBig:${q}`, t: e.t }; }
  let total = null;
  if (cards) { S.put(`${pre}.${q}.total`, q, "cards", Math.round(ev.reduce((a, e) => a + (e.cards ?? 0), 0)), "fact.lkTotal", "luck"); total = `${pre}.${q}.total:${q}`; } else total = S.has(`luck:${q}`) ? `luck:${q}` : null;
  return { big, small, oth: showOthers ? oth.sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum)) : [], othN: othEv.length, bigO, seatId: seatW ? `lkSeat:${q}` : null, total, pre, nMore: big.length - 8, nSmall: small.length, nOthRef: `${pre}.${q}.nOth:${q}`, moreRef: `${pre}.${q}.more:${q}`, smallRef: `${pre}.${q}.nsmall:${q}`, othSum: `${pre}.${q}.othSum:${q}` };
}

// ── history and bots (no review open: global stores, registered for the test hook) ──
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
/** Terugblik progress: Accuracy over the reviewed games, games won, marked moves per game, the selected game, the most missed kind. rev: reviewed games (oldest first), fin: finished games, sel: index in the chart. */
export function histProgress(rev, fin, sel, topKey) {
  const S = new Facts("-", "hist");
  S.put("h.accAvg", "-", "acc", rev.length ? r0(avg(rev.map((m) => m.acc))) : null, "fact.hAcc", "history"); S.put("h.nRev", "-", "count", rev.length, "fact.hN", "history");
  S.put("h.won", "-", "count", fin.filter((m) => m.result === "won").length, "fact.hWon", "history"); S.put("h.fin", "-", "count", fin.length, "fact.hFin", "history");
  const per = rev.map((m) => (m.cls ? (m.cls.lean || 0) + (m.cls.could || 0) + (m.cls.missed || 0) + (m.cls.mistake || 0) + (m.cls.blunder || 0) : null)).filter((v) => v != null);
  S.put("h.per", "-", "rate", per.length ? avg(per) : null, "fact.hPer", "history");
  const v = rev.slice(-12), s = v[Math.min(sel ?? v.length - 1, v.length - 1)];
  if (s) { S.put("h.selN", "-", "count", Math.min(sel ?? v.length - 1, v.length - 1) + 1, "fact.hSel", "history"); S.put("h.selAcc", "-", "acc", s.acc, "fact.hAcc", "history"); }
  if (topKey) { const l = rev.slice(-10); S.put("h.mk", "-", "count", l.filter((m) => (m.mist?.[topKey] || 0)).length, "fact.hMk", "history"); S.put("h.mn", "-", "count", Math.min(10, rev.length), "fact.hMk", "history"); }
  setGlobal("hist", S); return S;
}
/** the counts on the Terugblik screen: all / won / lost games on this device */
export function histCounts(pairs) { const S = new Facts("-", "histcnt"); pairs.forEach(([k, v]) => S.put(`h.cnt.${k}`, "-", "count", v, "fact.hCnt", "history")); setGlobal("histrows", S); return S; }
/** one game row of Terugblik: the points of every seat, the Accuracy */
export function histRow(m) {
  const S = new Facts("-", "histrow"); const id = m.id;
  if (m.acc != null) S.put(`h.acc.${id}`, "-", "acc", m.acc, "fact.hAcc", "history");
  (m.seats || []).forEach((s, i) => S.put(`h.vp.${id}.${i}`, "-", "pts", s.vp, "fact.pts", "history"));
  if (m.me != null && m.seats?.[m.me]) S.put(`h.vp.${id}.me`, "-", "pts", m.seats[m.me].vp, "fact.pts", "history");
  setGlobal("histrows", S); return S;
}
/** the Bots page: every number of the ladder, the precision list and "You vs them". rows: [{ key, win, acc }], you: { n, pct }, levels: youVsLevels() rows */
export function botsFacts(rows, you, levels, minGames) {
  const S = new Facts("-", "bots");
  rows.forEach((r) => { S.put(`bot.win.${r.key}`, "-", "wc", Math.round(r.win.v * 10) / 10, "fact.botWin", "bots", 1); if (r.acc?.v != null) { S.put(`bot.acc.${r.key}`, "-", "acc", r.acc.v, "fact.botAcc", "bots"); S.put(`bot.lo.${r.key}`, "-", "acc", r.acc.v - r.acc.se, "fact.botAcc", "bots"); S.put(`bot.hi.${r.key}`, "-", "acc", r.acc.v + r.acc.se, "fact.botAcc", "bots"); } });
  S.put("you.n", "-", "count", you.n, "fact.youN", "bots"); if (you.pct != null) S.put("you.pct", "-", "wc", you.pct, "fact.youPct", "bots"); S.put("bots.min", "-", "count", minGames, "fact.lim", "constant");
  (levels || []).forEach((r) => { const k = r.level; S.put(`vs.${k}.won`, "-", "count", r.won, "fact.vs", "bots"); S.put(`vs.${k}.n`, "-", "count", r.n, "fact.vs", "bots"); if (r.acc != null) S.put(`vs.${k}.acc`, "-", "acc", r.acc, "fact.vs", "bots"); if (r.n >= minGames) S.put(`vs.${k}.pct`, "-", "wc", r.pct, "fact.vs", "bots"); });
  setGlobal("bots", S); return S;
}
