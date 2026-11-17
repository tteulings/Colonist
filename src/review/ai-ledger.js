// v1.90 The game card's LEDGER as facts and words (pure: no DOM, no engine): from the step ledger (src/review/ledger.js), the records and the statistics log it builds
//   rows        the rounds that decided the game ("what decided it"): who, win chance before -> after, what happened in words, and ONE mechanism line when the data supports it
//   view(t)     one round in detail: chance / choice split, the steps (each with its +-se), the rest, the exact total, the progress credit B (an estimate, outside the total), and why (C)
//   fx.ledger / fx.behind  the same, for the composer and the chat (refs lg.*)
// Words are segments (strings and { pl: seat } a name, { pos: seat } a possessive, { d: points, q: seat, se, est } a signed number, { x: text } bold), so the page can colour them and the chat can
// flatten them. Wording lives in src/review/ai-lang.js (lg). Mechanism claims (C) are only made when ai-mech.js can PROVE them from the board and the event log; else the line is left out.
import { LG, roundSteps, bigRounds, shownSteps, describeStep, actionTurns, progressOf, roundMaxSe } from "./ledger.js";
import * as M from "./ai-mech.js";

const pts = (x) => { const n = Math.round(x * 100); return n === 0 ? 0 : n; };
const seOf = (x) => Math.max(1, Math.round(x * 100));

/** The model of a game. in: { led, ctx: { recs, steps, ev, hexes }, raw (ai-mech mechRaw, or null), me, win, n, marks (turns the headline names), sx (the surprise fact or null), lang, lg (the words) } */
export function ledgerModel(inp) {
  const { led, ctx, raw, me, win, lg } = inp, seats = [me, ...(win != null && win !== me ? [win] : [])];
  const items = (t) => { const rs = roundSteps(led, t); return rs ? { rs, its: rs.steps.map((s) => ({ ...describeStep(s.i, ctx), d: s.d, se: s.se })) } : null; };
  const out = { seats, led, me, win, lg, inp };
  const dOf = (r, q) => r.d[q];
  const big = (r) => Math.max(...seats.map((q) => Math.abs(r.d[q])));

  /** the round's rows on the card */
  out.rowTurns = () => {
    const rounds = led.rounds().filter((r) => r.t >= 1).map((r) => led.round(r.t)).filter(Boolean);
    const byBig = rounds.slice().sort((a, b) => big(b) - big(a) || a.t - b.t), mk = (inp.marks || []).filter((t) => rounds.some((r) => r.t === t));
    // the rounds the headline names come first, but only those that moved the game (>= 10 points); a round added for company must also be at least half the biggest
    const top = byBig[0] ? big(byBig[0]) : 0, pick = [];
    [...mk, ...byBig.map((r) => r.t)].forEach((t) => { if (!pick.includes(t) && pick.length < LG.ROWS) { const r = rounds.find((x) => x.t === t), named = mk.includes(t); if (r && big(r) >= LG.ROW_MIN && (named || big(r) >= 0.5 * top)) pick.push(t); } });
    if (!pick.length && byBig[0]) pick.push(byBig[0].t);
    return pick.sort((a, b) => a - b);
  };
  /** rounds whose steps are shown / refined / credited: the biggest rounds, the rows, the end of the game */
  out.focus = () => {
    const T = Math.max(...led.rounds().map((r) => r.t)), set = [...out.rowTurns(), ...bigRounds(led, seats).map((r) => r.t), T, T - 1].filter((t) => t >= 1 && led.round(t));
    return [...new Set(set)].sort((a, b) => a - b);
  };
  /** the rounds the progress credit (B) is valued for: the 3-5 biggest */
  out.creditTurns = () => bigRounds(led, seats, 4).map((r) => r.t).sort((a, b) => a - b);

  // ── C: the mechanism of a round, only what the data proves: facts of turns up to this round, and only in the direction the round moved ──
  const lv = (x) => Math.round(x * 100) + 0;
  /** (its: the round's items with their steps) */
  const mech = (t, q, its = []) => {
    if (!raw) return {};
    const r = led.round(t); if (!r) return {};
    const m = {}, dq = r.d[q];
    // scarce (only in a round the player lost ground): at the end of this round one resource is paid by at most one dot of the player's buildings
    if (dq <= -0.03) {
      const inc = M.incomeAt(raw, t, q), low = M.R5.slice().sort((a, b) => inc.dots[a] - inc.dots[b])[0];
      if (inc.dots[low] <= 1) m.scarce = { q, res: low, dots: inc.dots[low], all: inc.dots };
    }
    // spot: a spot within 1 road of the network before the round that somebody else built on IN this round, in a step that cost the player win chance
    if (dq <= -0.03) {
      const before = M.reachSpots(raw, t - 1, q), spots = before.spots.filter((s) => s.d <= 1 && s.pips >= 6), lost = [];
      spots.forEach((s) => { const b = raw.ev.find((e) => e[0] === t && e[1] === "b" && (e[3] === "s" || e[3] === "c") && e[4] === s.n && e[2] !== q), st = its.find((i) => i.type === "build" && i.at === s.n && i.pid !== q && i.d[q] <= -0.02); if (b && st) lost.push({ n: s.n, pips: s.pips, d: s.d, turn: t, by: b[2] }); });
      lost.sort((a, b) => b.pips - a.pips);
      if (lost[0]) { const after = M.reachSpots(raw, t, q); m.spot = { q, ...lost[0], before: before.within1, after: after.within1 }; }
    }
    return m;
  };
  out.mech = mech;
  /** one mechanism line + tiny visual for a round, for the subject seat; null when nothing is proven */
  const mechLine = (t, subj, its) => {
    const segs = [], c = {}, R = led.round(t); if (!R || Math.abs(R.d[subj]) < 0.03) return null;
    const mine = mech(t, subj, its), dir = Math.sign(R.d[subj]);
    if (mine.scarce || mine.spot) {
      if (mine.scarce) { segs.push(...lg.scarceShort(mine.scarce)); c.scarce = mine.scarce; }
      if (mine.spot) { if (segs.length) segs.push("; "); segs.push(...lg.spotShort(mine.spot)); c.spot = mine.spot; }
      return { segs, claim: c, glyph: mine.scarce ? { dots: mine.scarce.all, mark: mine.scarce.res } : null };
    }
    // the winner's dice: the resource of the biggest roll steps, dots of the winner against yours (only when the winner gained in this round, mostly on those rolls)
    const rolls = its.filter((x) => x.type === "roll" && x.d[subj] > 0 && x.prod?.[subj]?.length);
    if (raw && subj !== me && dir > 0 && rolls.length && rolls.reduce((a, x) => a + x.d[subj], 0) >= 0.05) {
      const cnt = {}; rolls.forEach((x) => x.prod[subj].forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; })); const res = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      const iw = M.incomeAt(raw, t, subj).dots[res], im = M.incomeAt(raw, t, me).dots[res];
      if (iw >= 4 && iw >= 2 * im + 2) { c.gap = { res, winner: subj, dots: iw, mine: im }; return { segs: lg.gapShort(c.gap), claim: c, glyph: null }; }
    }
    // (a point card's "before: 9 points" is said by the surprise line under the rows, so it is not repeated here)
    // the same number in two rolls right after each other, both moving the subject the way the round went: its odds, from the dice
    const seq = its.filter((x) => x.type === "roll"); let twice = null;
    for (let k = 1; k < seq.length && !twice; k++) { const a = seq[k - 1], b = seq[k]; if (a.sum && a.sum === b.sum && a.sum !== 7 && [a, b].every((x) => Math.abs(x.d[subj]) >= LG.SHOW_MIN && Math.sign(x.d[subj]) === dir)) twice = a.sum; }
    if (twice) { const k = 6 - Math.abs(7 - twice); c.odds = { sum: twice, ways: k, oneIn: Math.round(1296 / (k * k) / 10) * 10 || Math.round(1296 / (k * k)) }; return { segs: lg.oddsShort(c.odds), claim: c, glyph: null }; }
    // a bank trade for a resource the player's dots hardly pay, in that player's own turn, in a round the player lost ground
    const bk = its.find((x) => x.type === "bank" && x.pid === subj && x.tr?.length && raw);
    if (bk && dir < 0) { const [give, get, ratio] = bk.tr[0], i2 = M.incomeAt(raw, t, subj).dots; if (i2[get] <= 2 && ["wood", "brick", "sheep", "wheat", "ore"].includes(get)) { c.bank = { q: subj, give, get, ratio, dots: i2[get], all: i2 }; return { segs: lg.bankShort(c.bank), claim: c, glyph: { dots: i2, mark: get } }; } }
    return null;
  };

  // ── a round in detail ──
  const stepTitle = (it) => lg.step(it, me, win);
  out.view = (t) => {
    const x = items(t); if (!x) return null;
    const { rs, its } = x, total = rs.d, sh = shownSteps(led, t, seats), shownIds = new Set(sh.map((s) => s.i));
    const chance = its.filter((i) => i.chance).reduce((a, i) => a + i.d[me], 0), choice = total[me] - chance;
    const shown = its.filter((i) => shownIds.has(i.i)).map((i) => ({ ...i, pts: pts(i.d[me]), ptsW: win != null && win !== me ? pts(i.d[win]) : null, seN: seOf(i.se[me]), title: stepTitle(i) }));
    const other = pts(total[me]) - shown.reduce((a, s) => a + s.pts, 0);
    const maxSe = Math.max(0, ...shown.map((s) => Math.max(...seats.map((q) => s.se[q])))), tot = pts(total[me]);
    // B: the progress credit of the player-turns that did something (valued lazily, shown hatched, never in the total)
    const credit = actionTurns(led, t, ctx).map((tu) => progressOf(led, tu)).filter(Boolean).filter((c) => Math.abs(c.d[me]) >= LG.PASS_MIN || Math.abs(c.d[c.pid]) >= 2 * LG.PASS_MIN).sort((a, b) => Math.max(Math.abs(b.d[me]), Math.abs(b.d[b.pid])) - Math.max(Math.abs(a.d[me]), Math.abs(a.d[a.pid]))).slice(0, 3).sort((a, b) => a.from - b.from)
      .map((c) => { const acts = its.filter((i) => c.from <= i.i && i.i <= c.to && i.pid === c.pid && ["build", "bank", "play", "ptrade", "dev"].includes(i.type)); return { ...c, pts: pts(c.d[me]), ptsMover: pts(c.d[c.pid]), seN: seOf(Math.max(c.se[me], c.se[c.pid])), acts, title: lg.credit(c.pid, acts, me) }; });
    const subjQ = Math.abs(total[me]) >= Math.abs(total[win ?? me]) ? me : win;
    const ml = mech(t, me), mw = subjQ === me ? null : mech(t, subjQ);
    const why = { scarce: ml.scarce || null, spot: ml.spot || null };
    const line = mechLine(t, subjQ, its);
    const f = rowFacts(t, its, subjQ), share = (v) => (Math.abs(total[me]) > 0 && Math.sign(v) === Math.sign(total[me]) ? Math.abs(v) / Math.abs(total[me]) : 0);
    const topCh = its.filter((i) => i.chance).sort((a, b) => Math.abs(b.d[me]) - Math.abs(a.d[me]))[0], pre = share(chance) >= 0.6 ? (topCh && topCh.type === "dev" ? lg.mostlyCard : lg.mostlyDice) : share(total[me] - chance) >= 0.6 ? lg.mostlyChoice : "";
    const head = f.top.length ? [...(pre ? [pre] : []), ...lg.rowText(f, { sx: inp.sx, built: its.filter((i) => i.type === "build") })] : [lg.quiet];
    return { t, a: rs.a, b: rs.b, v0: rs.v0, v1: rs.v1, d: total, tot, chance: pts(chance), choice: tot - pts(chance), shown, other, maxSe, seN: seOf(maxSe), steps: its, credit, why, line, subj: subjQ, head, maxSeOk: maxSe <= LG.SE_MAX + 1e-9 };
  };

  // ── a row on the card ──
  const rowFacts = (t, its, subj) => {
    const sh = shownSteps(led, t, seats), shownIds = new Set(sh.map((s) => s.i)), top = its.filter((i) => shownIds.has(i.i)).sort((a, b) => Math.abs(b.d[subj]) - Math.abs(a.d[subj]));
    return { t, subj, top, its, me, win };
  };
  out.row = (t) => {
    const x = items(t); if (!x) return null; const { rs, its } = x;
    const subj = Math.abs(rs.d[me]) >= Math.abs(rs.d[win ?? me]) ? me : win, f = rowFacts(t, its, subj);
    const t0 = f.top[0], cr = t0 && !t0.chance ? actionTurns(led, t, ctx).map((tu) => progressOf(led, tu)).filter(Boolean).find((c) => c.pid === t0.pid && Math.abs(c.d[subj]) >= LG.PASS_MIN) : null;
    const credit = cr ? { title: lg.credit(cr.pid, its.filter((i) => cr.from <= i.i && i.i <= cr.to && i.pid === cr.pid && ["build", "bank", "play", "ptrade", "dev"].includes(i.type)), me).a, pts: pts(cr.d[subj]), se: seOf(cr.se[subj]) } : null;
    const text = f.top.length ? lg.rowText(f, { sx: inp.sx, built: its.filter((i) => i.type === "build"), credit }) : [lg.quiet];
    const ml = mechLine(t, subj, its);
    return { t, subj, v0: rs.v0[subj], v1: rs.v1[subj], d: pts(rs.d[subj]), icon: f.top[0] && !f.top[0].chance ? "pick" : "dice", text, mech: ml, maxSe: roundMaxSe(led, t, seats) };
  };
  out.rows = () => out.rowTurns().map(out.row).filter(Boolean);
  /** why the reviewed player fell behind: the round where their win chance fell most before the end (or null) */
  out.behind = () => {
    const rs = led.rounds().filter((r) => r.t >= 1).map((r) => led.round(r.t)).filter(Boolean).sort((a, b) => a.d[me] - b.d[me]);
    const r = rs[0]; if (!r || pts(r.d[me]) >= -3) return null;
    return { t: r.t, d: pts(r.d[me]), v0: Math.round(r.v0[me] * 100), v1: Math.round(r.v1[me] * 100) };
  };
  /** the status line of the numbers: how many positions are valued, and the largest +-se of the shown steps */
  out.status = () => ({ valued: led.valued(), total: led.total(), complete: led.complete(), maxSe: Math.max(0, ...out.rowTurns().map((t) => roundMaxSe(led, t, seats))) });
  return out;
}

// ── segments -> HTML / plain text (names and numbers come from the caller: nameOf(seat), the language) ──
export function segsText(segs, fx) {
  const nl = fx.lang === "nl"; const sgn = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "±0");
  return (segs || []).map((s) => {
    if (typeof s === "string") return s;
    if (s.pl != null) return fx.nameOf(s.pl);
    if (s.pos != null) { const nm = fx.nameOf(s.pos); return s.pos === fx.me ? (nl ? "jouw" : "your") : nl ? nm + (/[sxz]$/i.test(nm) ? "" : "s") : `${nm}’s`; }
    if (s.d != null) return `${s.est ? "≈" : ""}${sgn(s.d)}${s.se ? ` ±${s.se}` : ""}`;
    return s.x != null ? String(s.x) : "";
  }).join("");
}
/** The facts the composer and the chat get (refs lg.*): the rows and the round numbers as one JSON-able object. */
export function ledgerFacts(model, fx) {
  const rows = model.rows().map((r) => ({ turn: r.t, who: fx.keys[r.subj], from: Math.round(r.v0 * 100), to: Math.round(r.v1 * 100), d: r.d, text: segsText(r.text, fx), mech: r.mech ? segsText(r.mech.segs, fx) : null }));
  const tops = model.focus().map((t) => model.view(t)).filter(Boolean).sort((a, b) => Math.abs(b.d[model.me]) - Math.abs(a.d[model.me])).slice(0, LG.TOP);
  return { rows, top: tops.map((v) => ({ turn: v.t, from: Math.round(v.v0[model.me] * 100), to: Math.round(v.v1[model.me] * 100), d: v.tot, chance: v.chance, choice: v.choice, se: v.seN, steps: v.shown.map((s) => ({ step: s.i, kind: s.type, d: s.pts, se: s.seN, text: segsText(s.title.a, fx) })), other: v.other })), status: model.status() };
}

const FALL = /\b(waarom|hoe)\b.*\b(zakte|zak|zakken|daalde|daalden|viel|achter\w*|achteruit)\b|\bwhy\b.*\b(fall|fell|falling|drop|dropped|slid|slide|behind|lose ground|lost ground)\b|\b(fall|fell|falling)\b.*\bbehind\b/i;
const TURNQ = /\b(?:what happened|wat (?:gebeurde|is er gebeurd|ging er)|what went on)\b.*\b(?:turn|beurt|ronde|round)\s*(\d+)\b/i;
/** The questions the ledger answers itself: { kind: "turn", t } (what happened in turn N), { kind: "behind" } (why did I fall behind / zakte ik), or null. The wording is Dutch or English. */
export function ledgerRoute(q) {
  q = String(q || ""); const m = TURNQ.exec(q); if (m) return { kind: "turn", t: +m[1] }; return FALL.test(q) ? { kind: "behind" } : null;
}
