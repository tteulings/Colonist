// v1.90 the step ledger (src/review/ledger.js, ai-ledger.js, step-mc.js posValue) on the three real games of tests/evals/ledger (built by tests/evals/build-ledger190.mjs with the app's own code):
//  1 the store: one position per distinct record, packed futures decode, every stored value is the mean of its futures
//  2 TELESCOPING: the steps of a round add up to the round's change exactly, the rounds to the game's change; every state sums to 100%
//  3 ONE SOURCE: the chart series, the card rows, the round view and the facts (fx.ledger) read the same numbers; the shown numbers are the ledger's, the rest and the total add up
//  4 +-se of the shown steps is at most 2 points (or says so: the card prints the real +-), the progress credit B is re-derived from the futures and never in a total
//  5 words: NL and EN, no "viel uit" / "fell out", no "nederzetting", the headline says the fall in the round it happened; the questions the ledger answers itself
//  6 mechanism claims (C) are re-derived from the board and the event log by an independent oracle, and only made when they hold
//   node tests/ledger190.js
const fs = require("fs"), path = require("path");
process.removeAllListeners("warning");
let fails = 0; const ok = (c, m, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${m}${x !== "" ? "  " + (typeof x === "string" ? x : JSON.stringify(x)) : ""}`); if (!c) fails++; };
const R5 = ["wood", "brick", "sheep", "wheat", "ore"], PIP = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
(async () => {
  const L = await import("../src/review/ledger.js"), AL = await import("../src/review/ai-ledger.js"), M = await import("../src/review/ai-mech.js"), LANG = await import("../src/review/ai-lang.js"), SH = await import("../src/review/ai-shape.js"), AP = await import("../src/review/ai-page.js");
  const { rehydrate, withLedger } = require("./evals/fx.js");
  const D = path.join(__dirname, "evals", "ledger"), FXD = path.join(__dirname, "evals", "fixtures"), files = fs.readdirSync(D).filter((f) => f.endsWith(".json"));
  ok(files.length >= 3, "three real games with their ledger", files);
  const unpack = (s, n) => { const W = []; for (let p = 0; p + 2 * n <= s.length; p += 2 * n) W.push(Array.from({ length: n }, (_, q) => parseInt(s.slice(p + 2 * q, p + 2 * q + 2), 36) / 1295)); return W; }; // an independent decoder
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const timing = [];
  for (const f of files) {
    const G = JSON.parse(fs.readFileSync(path.join(D, f), "utf8")), F0 = JSON.parse(fs.readFileSync(path.join(FXD, f), "utf8")), tag = G.id, n = G.n, me = G.me, win = G.winner, seats = [me, ...(win !== me ? [win] : [])];
    const recs = G.recs, ctx = { recs, steps: G.steps, ev: G.ev, hexes: G.hexes }, led = L.makeLedger({ recs, n, winner: win, res: G.res });
    // ── 1 the store ──
    const ev = L.posEvents(recs), al = L.aliasOf(recs), canon = al.filter((c, i) => c === i).length, posN = Object.keys(G.res).filter((k) => k.startsWith("pos:")).length;
    ok(ev.length === canon && posN === canon && led.complete(), `${tag}: one stored position per distinct record (${canon} of ${recs.length}), complete`, [ev.length, posN]);
    let badW = 0, badMean = 0; for (const [k, e] of Object.entries(G.res)) { const W = unpack(e.w, n); if (W.length !== e.F) badW++; const m = Array.from({ length: n }, (_, q) => mean(W.map((w) => w[q]))); if (m.some((x, q) => Math.abs(x - e.v[q]) > 0.002)) badMean++; if (W.some((w) => Math.abs(w.reduce((a, c) => a + c, 0) - 1) > 0.01)) badW++; }
    ok(!badW && !badMean, `${tag}: every stored position decodes to its futures (each one sums to 100%) and its value is their mean (all ${Object.keys(G.res).length} entries)`, [badW, badMean]);
    // ── 2 telescoping ──
    const rounds = led.rounds(); let badTele = 0, badSum = 0, badContig = 0, last = null; const totalD = Array(n).fill(0);
    rounds.forEach((r) => { const rs = L.roundSteps(led, r.t); const s = Array(n).fill(0); rs.steps.forEach((st) => st.d.forEach((x, q) => { s[q] += x; })); if (s.some((x, q) => Math.abs(x - rs.d[q]) > 1e-12)) badTele++; if (Math.abs(rs.d.reduce((a, c) => a + c, 0)) > 1e-5) badSum++; if (last != null && r.a !== last + 1) badContig++; last = r.b; rs.d.forEach((x, q) => { totalD[q] += x; }); });
    const v0 = led.v(0), vN = led.v(recs.length);
    ok(!badTele && !badSum && !badContig, `${tag}: the steps of each of the ${rounds.length} rounds add up to the round's change exactly; each round's changes sum to 0; rounds are contiguous`, [badTele, badSum, badContig]);
    ok(totalD.every((x, q) => Math.abs(x - (vN[q] - v0[q])) < 1e-9) && vN[win] === 1, `${tag}: the rounds add up to the whole game (start -> result)`, totalD.map((x) => Math.round(x * 100)));
    // ── 3 one source ──
    const ser = led.series(); let badSer = 0; rounds.forEach((r) => { const v = ser.by.get(r.t); if (!v || v.some((x, q) => x !== led.v(r.b + 1)[q]) || Math.abs(v.reduce((a, c) => a + c, 0) - 1) > 1e-5) badSer++; });
    ok(!badSer && ser.by.size >= rounds.length, `${tag}: the chart's series is the ledger at the end of each round (sums to 100%)`, badSer);
    // an fx like the app's: the fixture's refs, plus the ledger (the shape, the headline and the card read the series of the ledger: wc comes from ser)
    const fx = withLedger(rehydrate(F0), ser);
    const shape = SH.gameShape(fx); fx.shape = shape;
    const marks = shape && shape.id !== "seesaw" ? SH.shapeChart(fx, shape, fx.keys[me], fx.keys[win]).marks || [] : [];
    const sxr = (k) => F0.refs[`sx.${k}`]?.v, sx = F0.refs["sx.t"] ? { turn: sxr("t"), mover: sxr("mover"), before: sxr("before"), after: sxr("after"), odds: F0.refs["sx.odds"] ? { pct: sxr("odds") } : null } : null;
    const raw = F0.behindRaw, built = {}; for (const lang of ["nl", "en"]) built[lang] = AL.ledgerModel({ led, ctx, raw, me, win, marks, sx, lang, lg: LANG.langOf(lang).lg });
    const m = built.nl, rows = m.rows();
    ok(rows.length >= 1 && rows.length <= 3, `${tag}: the card has ${rows.length} row(s)`, rows.map((r) => r.t));
    let badRow = 0; rows.forEach((r) => { const R = led.round(r.t); if (Math.abs(r.v0 - R.v0[r.subj]) > 1e-12 || Math.abs(r.v1 - R.v1[r.subj]) > 1e-12 || r.d !== Math.round(100 * (R.v1[r.subj] - R.v0[r.subj])) + 0) badRow++; if (Math.round(r.v0 * 100) !== (ser.by.get(r.t - 1) ? Math.round(ser.by.get(r.t - 1)[r.subj] * 100) : Math.round(r.v0 * 100))) badRow++; });
    ok(!badRow, `${tag}: a row's "31% -> 12%" and its change are the ledger's round values = the chart's points (no 60% vs 53%)`, badRow);
    // the round view of every round with steps: shown numbers = the ledger, the rest and the total add up
    let badView = 0, badSplit = 0, badSe = 0, views = 0, worst = 0; const focus = m.focus();
    for (const r of rounds.filter((x) => x.t >= 1)) {
      const v = m.view(r.t); if (!v) { badView++; continue; } views++;
      const sumShown = v.shown.reduce((a, s) => a + s.pts, 0);
      if (v.tot !== Math.round(100 * L.roundSteps(led, r.t).d[me]) + 0 || sumShown + v.other !== v.tot || v.chance + v.choice !== v.tot) badSplit++;
      v.shown.forEach((s) => { const st = led.step(s.i); if (s.pts !== Math.round(100 * st.d[me]) + 0 || s.seN !== Math.max(1, Math.round(100 * st.se[me]))) badView++; });
    }
    ok(!badView && !badSplit, `${tag}: all ${views} round views: each shown step = the ledger's step, shown + the rest = the total = the round's change, chance + choice = the total`, [badView, badSplit]);
    // facts for the composer / chat
    const fct = AL.ledgerFacts(m, { ...fx, keys: fx.keys, nameOf: (q) => G.names[q], lang: "nl", me });
    ok(fct.rows.length === rows.length && fct.top.length >= 1 && fct.top.every((t) => t.steps.every((s) => typeof s.d === "number")), `${tag}: fx.ledger carries the rows and the top rounds with their steps`, [fct.rows.length, fct.top.length]);
    ok(fct.top.every((t) => { const v = m.view(t.turn); return v.tot === t.d && t.other === v.other; }) && fct.rows.every((r) => { const rr = rows.find((x) => x.t === r.turn); return r.from === Math.round(rr.v0 * 100) && r.to === Math.round(rr.v1 * 100) && r.d === rr.d; }), `${tag}: ...and they are the same numbers as the view and the rows`);
    // ── 4 +-se ──
    for (const t of focus) { const se = L.roundMaxSe(led, t, seats); worst = Math.max(worst, se); const info = (G.refined || []).find((x) => x[0] === t); if (se > L.LG.SE_MAX + 1e-9 && !(info && info[3] > 0)) badSe++; }
    ok(!badSe, `${tag}: the shown steps of the ${focus.length} focus rounds have +-se <= 2 points, or the round says it stopped short (worst ${(worst * 100).toFixed(2)})`, focus.map((t) => [t, +(100 * L.roundMaxSe(led, t, seats)).toFixed(2)]));
    const rowSe = rows.map((r) => [100 * L.roundMaxSe(led, r.t, seats), (G.refined || []).find((x) => x[0] === r.t)]); ok(rowSe.every(([x, i]) => x <= 2.0001 || (i && i[3] > 0)), `${tag}: the rows' own rounds are at +-2 or better, or say so (the late, decisive rounds of a game stay noisier; the row prints the real +-)`, rowSe.map(([x, i]) => [+x.toFixed(2), i ? i[3] : null]));
    // B: re-derived from the futures of the two positions with the independent decoder; never in the total
    let credits = 0, badB = 0, badTot = 0;
    for (const t of m.creditTurns()) {
      const v = m.view(t); credits += v.credit.length;
      for (const c of v.credit) { const p = unpack(G.res[`pas:${c.from}`].w, n), e = c.to + 1 >= recs.length ? null : unpack((G.res[`ref:${al[c.to + 1]}`] && G.res[`ref:${al[c.to + 1]}`].F >= G.res[`pos:${al[c.to + 1]}`].F ? G.res[`ref:${al[c.to + 1]}`] : G.res[`pos:${al[c.to + 1]}`]).w, n), F = Math.min(p.length, e ? e.length : 1e9), d = mean(Array.from({ length: F }, (_, j) => (e ? e[j][me] : me === win ? 1 : 0) - p[j][me])); if (Math.abs(d - c.d[me]) > 1e-9) badB++; if (Math.abs(c.pts - Math.round(d * 100)) > 0) badB++; }
      if (v.tot !== Math.round(100 * L.roundSteps(led, t).d[me]) + 0) badTot++;
    }
    ok(!badB && !badTot, `${tag}: progress credit B (${credits} shown) = the paired futures of "end the turn instead" vs the position after the actions; the total of the round does not contain it`, [badB, badTot]);
    // ── 6 the mechanism claims, re-derived ──
    const world = (upto) => { const occ = {}, own = {}; let rob = raw.r0; raw.ev.filter((e) => e[0] <= upto).forEach((e) => { const [, c, a, k, id] = e; if (c === "b") { if (k === "r" || k === "h") own[id] = a; else occ[id] = [a, k === "c" ? 2 : 1]; } if (c === "u") { if (k === "r" || k === "h") delete own[id]; else if (k === "s") delete occ[id]; else if (k === "c" && occ[id]) occ[id] = [a, 1]; } if (c === "R") rob = k; }); return { occ, own, rob }; };
    const dotsOf = (t, q) => { const W = world(t), d = Object.fromEntries(R5.map((r) => [r, 0])); Object.entries(W.occ).forEach(([nd, [ow, mm]]) => { if (ow === q) raw.nodes[nd].hx.forEach((h) => { const x = raw.hexes[h]; if (x.num && R5.includes(x.res) && h !== W.rob) d[x.res] += PIP[x.num] * mm; }); }); return d; };
    let claims = 0, badC = [];
    const allClaims = []; rows.forEach((r) => { if (r.mech) allClaims.push([r.t, r.mech.claim]); }); for (const r of rounds.filter((x) => x.t >= 1)) { const v = m.view(r.t); if (v?.line) allClaims.push([r.t, v.line.claim]); if (v?.why.scarce) allClaims.push([r.t, { scarce: v.why.scarce }]); if (v?.why.spot) allClaims.push([r.t, { spot: v.why.spot }]); }
    for (const [t, c] of allClaims) {
      if (c.scarce) { claims++; const s = c.scarce, d = dotsOf(t, s.q); let without = 0, got = 0; for (let u = t + 1; u <= s.turn; u++) { const g = raw.ev.filter((e) => e[0] === u && e[1] === "P" && e[2] === s.q && R5[e[4]] === s.res).reduce((a, e) => a + (e[5] || 1), 0); got += g; if (!g) without++; }
        const nb = raw.ev.find((e) => e[0] > t && e[1] === "b" && e[2] === s.q && ["s", "c", "r"].includes(e[3])), kind = nb ? { s: "settlement", c: "city", r: "road" }[nb[3]] : null;
        if (!R5.every((x) => d[x] === s.all[x]) || s.dots !== d[s.res] || s.dots > 1 || s.without !== without || got !== 0 || without < 3 || !nb || nb[0] !== s.turn || kind !== s.kind || !M.COST[s.kind][s.res]) badC.push(["scarce", t, s]); }
      if (c.spot) { claims++; const s = c.spot, Wb = world(t - 1), pips = raw.nodes[s.n].hx.reduce((a, h) => a + (raw.hexes[h].num && R5.includes(raw.hexes[h].res) ? PIP[raw.hexes[h].num] : 0), 0);
        const free = !Wb.occ[s.n] && raw.nodes[s.n].nb.every((x) => !Wb.occ[x]); const seen = new Set(); Object.entries(Wb.occ).forEach(([nd, [ow]]) => { if (ow === s.q) seen.add(+nd); }); Object.entries(Wb.own).forEach(([e, ow]) => { if (ow === s.q) { seen.add(raw.edges[e].a); seen.add(raw.edges[e].b); } });
        const near = seen.has(s.n) || raw.edges.some((e, i) => Wb.own[i] == null && ((seen.has(e.a) && e.b === s.n) || (seen.has(e.b) && e.a === s.n))), b = raw.ev.find((e) => e[0] === s.turn && e[1] === "b" && (e[3] === "s" || e[3] === "c") && e[4] === s.n);
        if (!free || !near || pips !== s.pips || pips < 6 || !b || b[2] !== s.by || s.by === s.q || s.turn < t || s.turn > t + 3) badC.push(["spot", t, s]); }
      if (c.gap) { claims++; const g = c.gap; if (dotsOf(t, g.winner)[g.res] !== g.dots || dotsOf(t, me)[g.res] !== g.mine || g.dots < 4 || g.dots < 2 * g.mine + 2) badC.push(["gap", t, g]); }
      if (c.odds) { claims++; const o = c.odds, rolls = recs.map((r, i) => ({ r, i })).filter(({ r }) => (r.k === "roll" || r.k === "turn") && r.t === t).map(({ r }) => G.steps[r.s]).filter(Boolean).map((s) => s[2] + s[3]); if (rolls.filter((x) => x === o.sum).length < 2 || o.ways !== 6 - Math.abs(7 - o.sum) || Math.abs(o.oneIn - 1296 / (o.ways * o.ways)) > 10) badC.push(["odds", t, o]); }
      if (c.points) { claims++; const p = c.points; if (!sx || sx.turn !== t || sx.mover !== p.q || sx.before !== p.before || sx.after !== p.after || p.after <= p.before) badC.push(["points", t, p]); }
      if (c.bank) { claims++; const b = c.bank, r = recs.find((x, i) => x.k === "bank" && x.t === t && x.pid === b.q && x.a?.tr?.length), tr = r?.a.tr[0]; if (!tr || tr[0] !== b.give || tr[1] !== b.get || tr[2] !== b.ratio || dotsOf(t, b.q)[b.get] !== b.dots || b.dots > 2) badC.push(["bank", t, b]); }
    }
    ok(!badC.length, `${tag}: ${claims} mechanism claim(s) shown, each re-derived from the board and the event log by the oracle`, badC.slice(0, 2));
    // ── 5 words ──
    const texts = { nl: [], en: [] }, nameOf = (q) => (q === me ? (true ? "Jij" : "") : G.names[q]);
    for (const lang of ["nl", "en"]) { const mm = built[lang], f2 = { lang, me, nameOf: (q) => (q === me ? (lang === "nl" ? "Jij" : "You") : G.names[q]) }; mm.rows().forEach((r) => { texts[lang].push(AL.segsText(r.text, f2)); if (r.mech) texts[lang].push(AL.segsText(r.mech.segs, f2)); }); for (const r of rounds.filter((x) => x.t >= 1)) { const v = mm.view(r.t); if (!v) continue; texts[lang].push(AL.segsText(v.head, f2)); v.shown.forEach((s) => { texts[lang].push(AL.segsText(s.title.a, f2), AL.segsText(s.title.b, f2)); }); v.credit.forEach((c) => texts[lang].push(AL.segsText(c.title.a, f2))); if (v.why.scarce) texts[lang].push(AL.segsText(LANG.langOf(lang).lg.cap1(v.why.scarce), f2)); if (v.why.spot) texts[lang].push(AL.segsText(LANG.langOf(lang).lg.cap2(v.why.spot), f2)); } }
    const bad = (re, lang) => texts[lang].filter((t) => re.test(t));
    ok(texts.nl.length > 5 && !bad(/viel uit|nederzetting|\b1 (stippen|kaarten|beurten|punten|dorpen)\b|\b([2-9]|\d\d) (stip|kaart|beurt|punt|dorp|worp)\b(?!\w)/i, "nl").length, `${tag}: Dutch ledger words: no "viel uit", no "nederzetting", counts agree with their noun (${texts.nl.length} lines)`, bad(/viel uit|nederzetting|\b1 (stippen|kaarten|beurten|punten)\b/i, "nl").slice(0, 2));
    ok(texts.en.length > 5 && !bad(/fell out|settlement ?spot|\b1 (dots|cards|turns|points)\b/i, "en").length && !texts.en.some((t) => /\b(gooit|kaart|beurt|stip|jij)\b/i.test(t)), `${tag}: English ledger words: no "fell out", no Dutch left (${texts.en.length} lines)`);
    // the headline: the fall in the round it happened, concrete, never "fell out" (EN + NL), through the page's own parts and refs
    for (const lang of ["nl", "en"]) {
      const fl = { ...fx, lang, t: LANG.langOf(lang), lgCause: (t) => { const v = built[lang].view(t); if (!v || !v.tot) return null; const sh = (x) => (Math.sign(x) === Math.sign(v.tot) ? Math.abs(x) / Math.abs(v.tot) : 0); return sh(v.chance) >= 0.6 ? (v.steps.some((s) => s.type === "roll") ? "dice" : null) : null; }, players: F0.players };
      const P = (k) => ({ ref: `name.${k}`, fmt: "player" }), Rf = (ref, fmt) => ({ ref, ...(fmt ? { fmt } : {}) });
      if (shape && shape.id === "knockout") {
        const parts = SH.shapeTitle(fl, shape, P, Rf), txt = parts.map((p) => (typeof p === "string" ? p : p.ref.startsWith("wc.") ? `${fl.ref(p.ref).v}%` : p.ref.startsWith("turn.") ? `${lang === "nl" ? "beurt" : "turn"} ${p.ref.split(".")[1]}` : p.ref.startsWith("name.") ? "X" : "")).join("").replace(/\s+/g, " ");
        const a = Math.max(0, shape.tOut - 1), want = lang === "nl" ? new RegExp(`zakte in beurt ${shape.tOut} van ${fl.ref(`wc.you@${a}`).v}% naar ${fl.ref(`wc.you@${shape.tOut}`).v}%`) : new RegExp(`slid on turn ${shape.tOut} from ${fl.ref(`wc.you@${a}`).v}% to ${fl.ref(`wc.you@${shape.tOut}`).v}%`);
        ok(want.test(txt) && !/viel uit|fell out/i.test(txt), `${tag} ${lang}: the knockout headline says the fall: "${txt.slice(0, 120)}"`);
        ok(AP.partsOk(parts, fl) != null, `${tag} ${lang}: the headline passes the page's own validator (refs resolve, no digits or causal words in free text, within the word cap)`);
      }
    }
    timing.push([tag, G.T]);
    // the questions the ledger answers itself
    if (tag === files[0].replace(".json", "")) {
      const cases = [["Waarom zakte ik?", "behind"], ["why did I fall behind", "behind"], ["what happened in turn 5", "turn", 5], ["Wat gebeurde er in beurt 7?", "turn", 7], ["Waarom won ik?", null], ["What was my best move?", null], ["Waarom viel ik achter?", "behind"]];
      ok(cases.every(([q, k, t]) => { const r = AL.ledgerRoute(q); return k ? r && r.kind === k && (t == null || r.t === t) : r === null; }), "the ledger routes 'why did I fall behind' / 'what happened in turn N' (NL + EN) and leaves other questions alone");
    }
    // v1.90.1 the chat answers about the player ASKED (held-out phrasings, written before the router was changed): a name, a negation, a win question, another subject
    if (tag === files[0].replace(".json", "")) {
      const PL = [{ seat: 0, name: "Jij", you: true }, { seat: 1, name: "Geelen" }, { seat: 2, name: "Blaauw" }, { seat: 3, name: "Groenewoud" }], C = { me: 0, win: 1, players: PL };
      const H = [ // [question, expected route: null or { kind, seat, t? }]
        ["Waarom is Geelen zo ver teruggevallen?", { kind: "behind", seat: 1 }], ["Hoe kwam het dat Blaauw terugzakte?", { kind: "behind", seat: 2 }], ["Why did Blaauw lose so much ground in the middle of the game?", { kind: "behind", seat: 2 }],
        ["Waarom daalde mijn winkans zo hard?", { kind: "behind", seat: 0 }], ["Why did I get so far behind in the early game?", { kind: "behind", seat: 0 }], ["why did Groenewoud drop so much", { kind: "behind", seat: 3 }],
        ["Wat gebeurde er in beurt 9 met Blaauw?", { kind: "turn", seat: 2, t: 9 }], ["What happened to Geelen in round 6?", { kind: "turn", seat: 1, t: 6 }], ["Tell me what happened in turn 12 for me", { kind: "turn", seat: 0, t: 12 }], ["wat gebeurde er in beurt 4", { kind: "turn", seat: 0, t: 4 }],
        ["Waarom zakte ik eigenlijk niet verder?", null], ["Why didn't Geelen fall behind earlier?", null], ["Waarom zakte Blaauw niet?", null], ["Why did I never drop below 20%?", null],
        ["Why did I win after being behind for so long?", null], ["Waarom won ik terwijl ik achterstond?", null], ["Why did Geelen win?", null],
        ["Why did everyone else fall behind me?", null], ["Why did the other players drop so far behind?", null], ["Waarom zakte de bank achter met kaarten?", null], ["Waarom zakte Pieter?", null],
        ["What was my best move?", null], ["Wat was het plan van Geelen?", null], ["Who was luckiest?", null]];
      const bad = H.filter(([q, want]) => { const r = AL.ledgerRoute(q, C); return want ? !(r && r.kind === want.kind && r.seat === want.seat && (want.t == null || r.t === want.t)) : r !== null; });
      ok(!bad.length, `${tag}: the chat router: the asked player (a name, ik/mijn/I), no answer for a negated question, a win question or another subject (${H.length} held-out phrasings)`, bad.map((b) => [b[0], AL.ledgerRoute(b[0], C)]));
      // the answer is about that player, with that player's numbers from the ledger
      const fxA = { lang: "nl", me, T: G.T, keys: [], nameOf: (q) => (q === me ? "Jij" : G.names[q]) }, other = [...Array(n).keys()].filter((q) => q !== me);
      for (const q of [me, ...other]) {
        const a = AL.ledgerAnswer(m, fxA, { kind: "behind", seat: q }); if (!a) { ok(false, `${tag}: an answer for seat ${q}`); continue; }
        const R = led.round(a.t), lo = Math.min(...rounds.filter((x) => x.t >= 1).map((x) => led.round(x.t).d[q])), nm = q === me ? "Je" : G.names[q];
        ok(a.seat === q && Math.abs(R.d[q] - lo) < 1e-12 && a.answer.includes(`${Math.round(R.v0[q] * 100)}%`) && a.answer.includes(`${Math.round(R.v1[q] * 100)}%`) && a.answer.startsWith(nm) && (q === me || !/^Je /.test(a.answer)), `${tag}: the "fell behind" answer for seat ${q} is about ${nm}: its biggest fall in turn ${a.t}, its own numbers`, a.answer.slice(0, 110));
      }
    }
    // fx.behind
    const bh = m.behind(); ok(bh == null || (bh.d < 0 && bh.d === Math.round(100 * L.roundSteps(led, bh.t).d[me]) + 0 && bh.v0 === Math.round(led.round(bh.t).v0[me] * 100) && bh.v1 === Math.round(led.round(bh.t).v1[me] * 100)), `${tag}: fx.behind is the round with the biggest fall, with the ledger's numbers`, bh);
  }
  // the version and the files
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8"), idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), ui = fs.readFileSync(path.join(__dirname, "..", "src", "themes", "settings-ui.js"), "utf8");
  ok(/colonist-v190/.test(sw) && /APP_VERSION = "1\.90"/.test(ui) && /game\.js\?v=190/.test(idx), "version 1.90: APP_VERSION, ?v=190, cache colonist-v190");
  ok(["review/ledger.js", "review/ai-ledger.js", "review/step-mc.js", "review-ledger.js"].every((x) => sw.includes(`"./src/${x}"`)), "the new files are in the service worker's SHELL");
  console.log(fails ? `\n${fails} FAILED` : "\nall ok"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
