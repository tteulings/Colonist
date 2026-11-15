// v1.71 Lessons: what your reviewed games teach. Pure data code (no DOM): every decision that was marked could be better / mistake /
// blunder / missed is filed under a category by its move kind, summed per category, and compared over time. The UI is src/lessons.js.
import { decide, rescoreReview } from "./review/evaluate.js";
import { tradeShow } from "./review/score.js";

export const CATS = [
  { id: "setup", name: "Set-up placement", kinds: ["setup"], recap: ["placement"],
    rule: "Spread your numbers and resources: a 6 or 8 is great, but three different resources beat three of the same. A port only pays if you produce that resource. Leave room to grow." },
  { id: "robber", name: "Robber", kinds: ["robber"], recap: ["robber"],
    rule: "Block the player who is winning, on a tile that pays them a lot and you little. Do not block yourself. Pick someone with many cards to steal from." },
  { id: "build", name: "Building choice", kinds: ["build", "shipmove"], recap: ["plan", "board_reading"],
    rule: "Build what brings points soonest. A city on your best numbers beats a road that goes nowhere. A road is worth it when it reaches a good spot." },
  { id: "dev", name: "Development cards", kinds: ["buy", "play"], recap: ["development_cards"],
    rule: "Development cards are slow but steady. Buy them with spare wheat, sheep and ore. Play a Knight early if the robber sits on you." },
  { id: "trade", name: "Trading", kinds: ["bank"], recap: ["trading"],
    rule: "Trade to finish a build, not just because you can. Four cards for one is expensive: use a port or another player when you can." },
  { id: "timing", name: "Timing", kinds: ["end"], recap: ["timing"],
    rule: "Before you end your turn, check what you could still build. Cards in hand are at risk when a 7 is rolled. Only save cards for a clear plan." },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
export const catOfKind = (k) => CATS.find((c) => c.kinds.includes(k))?.id || null;
export const catOfRecap = (k) => CATS.find((c) => c.recap.includes(k))?.id || null;
export const BAD = ["lean", "could", "mistake", "blunder", "missed"];
export const CLS_WORD = { lean: "Slightly better", could: "Could be better", mistake: "Mistake", blunder: "Blunder", missed: "Missed chance" };

/** The decisions of one reviewed game that cost win chance, filed by category. `rec` = the stored record, `m` = its list entry. */
export function gameLessons(m, rec) {
  const rv = rec?.rv; if (!rv || m.me == null) return null;
  const reviews = rv.reviews || (rv.review?.results?.length ? { [rv.review.pid]: rv.review } : {});
  const r = reviews[m.me]; if (!r?.results?.length) return null;
  try { rescoreReview(r); } catch (_) { /* shown as stored */ }
  const ds = decide(r.results.filter((x) => !x.skip || x.skip === "trivial"), m.n || 4, m.me);
  const out = { id: m.id, pid: m.me, end: m.end, mode: m.mode, ex: [], loss: {}, seen: {}, lesson: null };
  ds.forEach((d) => {
    const cat = catOfKind(d.k); if (!cat) return;
    out.seen[cat] = (out.seen[cat] || 0) + 1;
    if (!BAD.includes(d.cls) || d.gp < 1 || !d.x.best) return;
    out.loss[cat] = (out.loss[cat] || 0) + d.gp;
    out.ex.push({ gid: m.id, pid: m.me, end: m.end, i: d.i, t: d.x.t, k: d.k, cat, cls: d.cls, gp: d.gp, A: d.A, B: d.B, x: d.x });
  });
  const rc = rv.recap, S = rc && rc.pid === m.me ? rc.recap : null;
  if (S?.lessonTitle && S.lessonKind) out.lesson = { title: String(S.lessonTitle), cat: catOfRecap(S.lessonKind), kind: S.lessonKind, at: m.end };
  return out;
}

const RECENT = 5;
/** games: newest first (gameLessons results). Per category: n, lost, trend (last 5 games vs the games before), lesson titles, examples (biggest first). */
export function aggregate(games) {
  const cats = CATS.map((c) => {
    const ex = games.flatMap((g) => g.ex.filter((e) => e.cat === c.id)).sort((a, b) => b.gp - a.gp || b.end - a.end);
    const per = games.map((g) => g.loss[c.id] || 0), avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const rec = per.slice(0, RECENT), old = per.slice(RECENT);
    let trend = null;
    if (old.length) { const a = avg(rec), b = avg(old); trend = b - a >= 0.5 && a <= b * 0.8 ? "better" : a - b >= 0.5 && a >= b * 1.2 ? "worse" : "same"; }
    const titles = []; games.forEach((g) => { if (g.lesson?.cat === c.id && !titles.includes(g.lesson.title)) titles.push(g.lesson.title); });
    return { ...c, n: ex.length, lost: ex.reduce((s, e) => s + e.gp, 0), trend, titles, ex, games: games.filter((g) => g.loss[c.id]).length };
  });
  cats.sort((a, b) => b.lost - a.lost || b.n - a.n);
  return cats;
}

/** Move text in words for a list row: what you played, and what was better. */
export const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const moveText = (e) => (e.k === "end" || (e.cls === "missed" && e.k === "end") ? "Ended the turn" : tradeShow(e.x.label));
export const betterText = (e) => tradeShow(e.x.best.label);

/** The options of a practice question: B (played), A (better), and up to 2 other candidates, shuffled. rnd: () => [0,1). */
export function practiceOptions(e, rnd = Math.random) {
  const x = e.x, seen = new Set([x.label, x.best.label]);
  const pct = (w) => (w == null ? null : Math.round(w * 100));
  const opts = [{ label: tradeShow(x.label), win: e.B, kind: "B", focus: x.focus }, { label: tradeShow(x.best.label), win: e.A, kind: "A", focus: x.best.focus }];
  const others = (x.cands || []).filter((c) => !seen.has(c.label) && c.win != null && c.n >= 2).sort((a, b) => b.win - a.win);
  const take = others.length > 2 ? [others[0], others[others.length >> 1]] : others;
  take.slice(0, rnd() < 0.5 ? 2 : 1).forEach((c) => opts.push({ label: tradeShow(c.label), win: pct(c.win), kind: "O", focus: c.focus }));
  for (let i = opts.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts;
}

/** The practised positions kept on this device: [{ key, cat, ok, at }]. */
const PKEY = "colonist_lessons_practice";
export const exKey = (e) => `${e.gid}|${e.i}`;
export function loadPractice() { try { const a = JSON.parse(localStorage.getItem(PKEY) || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
export function savePractice(list) { try { localStorage.setItem(PKEY, JSON.stringify(list.slice(-300))); } catch (_) { /* private mode */ } }
export function practiceStats(list, cat) { const L = list.filter((p) => p.cat === cat); return { n: L.length, ok: L.filter((p) => p.ok).length }; }
/** The next position to train: not yet practised first, then the oldest; if all are done, the one practised longest ago. */
export function pickPractice(cat, list, practice, skipKey = null) {
  const last = new Map(); practice.forEach((p) => last.set(p.key, p.at));
  const pool = list.filter((e) => e.x.best && exKey(e) !== skipKey);
  const fresh = pool.filter((e) => !last.has(exKey(e))).sort((a, b) => a.end - b.end || a.i - b.i);
  if (fresh.length) return fresh[0];
  return pool.sort((a, b) => (last.get(exKey(a)) || 0) - (last.get(exKey(b)) || 0))[0] || list[0] || null;
}

/** The facts for the Ask call (a JSON string under 4k): category, your stats, the rule and your 3 worst examples. */
export function askFacts(c, practice, nameOf = (e) => e.gid) {
  const AIM = { s: "settlements", c: "cities", lr: "Longest road", la: "Largest army", dv: "point cards", is: "new islands" };
  const aim = (a) => (a?.src?.length ? a.src.slice(0, 2).map(([k, v]) => `${AIM[k] || k} ${v}%`).join(", ") : undefined);
  const ex = c.ex.slice(0, 3).map((e) => ({ game: nameOf(e), turn: e.k === "setup" ? "set-up" : e.t, played_B: moveText(e).slice(0, 90), better_A: betterText(e).slice(0, 90), winChance_B: `${e.B}%`, winChance_A: `${e.A}%`, aim_B: aim(e.x.aim?.B), aim_A: aim(e.x.aim?.A) }));
  const mk = (list) => JSON.stringify({ note: "These are the player's own mistakes of one kind over several reviewed games (not one moment). Answer the player's question from these facts and the rule; stay on this topic.", category: c.name,
    stats: { mistakes: c.n, winChanceLost: `${c.lost}%`, trend: c.trend || "not enough games", practised: practice.n, practisedCorrect: practice.ok }, rule: c.rule, lessonTitles: c.titles.slice(0, 3), worstExamples: list });
  let s = mk(ex); for (let k = ex.length; s.length > 3800 && k > 0; k -= 1) s = mk(ex.slice(0, k - 1));
  return s.slice(0, 3900);
}
