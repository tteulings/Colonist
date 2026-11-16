// node build-mock.mjs -> mock.html (all screens, both languages; ?s=card-geelen&lang=nl shows one)
import fs from "fs";
const D = (id) => JSON.parse(fs.readFileSync(`data/${id}.story.json`));
const BOARDS = JSON.parse(fs.readFileSync("boards.json"));
const G = { geelen: D("mwg5v7k7j2cc"), "72eb": D("mwg74y2d49gz"), comeback: D("mwb26snvis5o") };
const pct = (x) => Math.round(x * 100), pts = (x) => Math.round(x * 100);
const sg = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n);
const best = (it, q) => (it.d100 ? it.d100[q] : it.d[q]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const IC = {
  dice: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5.8" cy="5.8" r="1.05"/><circle cx="10.2" cy="5.8" r="1.05"/><circle cx="5.8" cy="10.2" r="1.05"/><circle cx="10.2" cy="10.2" r="1.05"/></svg>',
  pick: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.4l8.4 5.2-3.7 1 2 3.7-1.6.9-2-3.7L4.4 12z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  chev: '<svg class="ic chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const L = {
  nl: { you: "jij", You: "Jij", turn: "beurt", Turn: "Beurt", start: "beginopstelling", wc: "Winkans", legYou: "Jij", legOthers: "anderen", tap: "Tik op een stip om die beurt te openen", decided: "Waar het om draaide", open: "Open beurt",
    chance: "Kans", choice: "Keuze", chanceSub: "dobbelstenen, kaarten, pakken", choiceSub: "bouwen, ruilen, rover", other: "overige stappen", total: "Totaal", steps: "Stap voor stap", why: "Waarom", progress: "Wat bouwen opleverde",
    legend: ["kans", "keuze", "schatting"], noteA: "Kans en stappen: exact tot ±1,5 punten per stap.", noteB: "≈ is een schatting met marge (±), niet meegeteld in het totaal.", dots: "stippen", dot1: "stip", res: { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" }, needFor: "nodig voor een nederzetting",
    pointsWord: "punten", sub_vs: "t.o.v. de beurt overslaan", zone_out: "kansloos", zone_low: "dieptepunt", inc: "Jouw stippen per grondstof" },
  en: { you: "you", You: "You", turn: "turn", Turn: "Turn", start: "setup", wc: "Win chance", legYou: "You", legOthers: "others", tap: "Tap a dot to open that turn", decided: "What decided it", open: "Open turn",
    chance: "Chance", choice: "Choice", chanceSub: "dice, cards, steals", choiceSub: "building, trading, robber", other: "other steps", total: "Total", steps: "Step by step", why: "Why", progress: "What building earned",
    legend: ["chance", "choice", "estimate"], noteA: "Chance and steps: exact to ±1.5 points per step.", noteB: "≈ is an estimate with a margin (±), not counted in the total.", dots: "dots", dot1: "dot", res: { wood: "wood", brick: "brick", sheep: "wool", wheat: "grain", ore: "ore" }, needFor: "needed for a settlement",
    pointsWord: "points", sub_vs: "vs skipping the turn", zone_out: "out", zone_low: "low point", inc: "Your dots per resource" },
};
const short = (g, q, lang) => (q === g.me ? L[lang].you : g.names[q].replace(/^Van /, lang === "nl" ? "" : "Van "));
const nameHtml = (g, q, lang, cap) => `<span class="n n${q}">${esc(q === g.me ? (cap ? L[lang].You : L[lang].you) : short(g, q, lang))}</span>`;
const num = (g, q, v, lang, extra = "") => { const n = pts(v); return `<b class="d ${q === g.me ? (n > 0 ? "up" : n < 0 ? "dn" : "") : "o o" + q}">${sg(n)}${extra}</b>`; };
const posses = (g, q, lang) => (q === g.me ? (lang === "nl" ? "jouw" : "your") : lang === "nl" ? short(g, q, lang) + (/[sxz]$/.test(short(g, q, lang)) ? "" : "s") : short(g, q, lang) + "’s");
// ---------- chart
function series(S) { const out = Array.from({ length: S.n }, () => []); out.forEach((a, q) => { a.push(S.rounds[0].v0[q]); S.rounds.forEach((r) => a.push(r.v1[q])); }); return out; }
function chart(g, lang, opt) {
  const W = 316, Hh = 158, x0 = 24, x1 = W - 6, y0 = 24, y1 = Hh - 16, T = g.T, ser = series(g), X = (t) => x0 + ((x1 - x0) * t) / T, Y = (v) => y1 - (y1 - y0) * v;
  const path = (q) => "M" + ser[q].map((v, t) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join("L");
  const keys = opt.keys, others = g.names.map((_, q) => q).filter((q) => !keys.includes(q));
  let s = `<svg viewBox="0 0 ${W} ${Hh + 6}" class="wcs" role="img" aria-label="${L[lang].wc}">`;
  s += `<text x="2" y="9" class="ax b">${L[lang].wc}</text>`;
  [0, 0.5, 1].forEach((v) => { s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${x0 - 4}" y="${Y(v) + 3}" text-anchor="end" class="ax">${v * 100}</text>`; });
  if (opt.zone) { const z = opt.zone; s += `<rect x="${X(z.a)}" y="${Y(z.hi)}" width="${X(z.b) - X(z.a)}" height="${Y(0) - Y(z.hi)}" rx="3" class="zn"/><text x="${z.b < T ? X(z.b) + 4 : X(z.b) - 2}" y="${z.b < T ? Y(z.hi / 2) + 3 : Y(z.hi) - 3}" text-anchor="${z.b < T ? "start" : "end"}" class="zt" style="fill:${z.col}">${z.label}</text>`; }
  others.forEach((q) => { s += `<path d="${path(q)}" class="fd"/>`; });
  keys.slice().reverse().forEach((q) => { s += `<path d="${path(q)}" class="ln" style="stroke:var(--p${q})"/>`; });
  s += `<text x="${x0}" y="${Hh + 3}" class="ax">${L[lang].start}</text><text x="${x1}" y="${Hh + 3}" text-anchor="end" class="ax">${L[lang].turn} ${T}</text>`;
  opt.marks.forEach(([t, q]) => { s += `<g class="mk"><circle cx="${X(t)}" cy="${Y(ser[q][t])}" r="4.6" style="fill:var(--p${q})"/>${ser[q][t] > 0.8 ? `<text x="${X(t) - 8}" y="${Y(ser[q][t]) + 3}" text-anchor="end">B${t}</text>` : `<text x="${X(t)}" y="${Y(ser[q][t]) - 8}" text-anchor="middle">B${t}</text>`}</g>`; });
  return s + "</svg>";
}
const legend = (g, lang, keys) => `<div class="leg">${keys.map((q) => `<span><i class="dot" style="background:var(--p${q})"></i>${q === g.me ? L[lang].legYou : esc(short(g, q, lang))}</span>`).join("")}<span><i class="dot" style="background:var(--field)"></i>${L[lang].legOthers}</span></div>`;
// ---------- micro income bars (5 resources; the missing / scarce resource marked)
const RS = ["wood", "brick", "sheep", "wheat", "ore"];
function micro(dots, mark) { const mx = Math.max(8, ...RS.map((r) => dots[r])); return `<svg class="mi" viewBox="0 0 30 20" aria-hidden="true">${mark ? `<rect x="${RS.indexOf(mark) * 6 - 0.6}" y="17.2" width="5.4" height="2.2" rx="1" fill="var(--neg)"/>` : ""}${RS.map((r, i) => `<rect x="${i * 6}" y="${16 - Math.max(1, (dots[r] / mx) * 15)}" width="4.2" height="${Math.max(1, (dots[r] / mx) * 15)}" rx="1.2" class="${r === mark ? "mk" : ""}" style="fill:var(--r-${r})"/>`).join("")}</svg>`; }
// ---------- per game content
const T3 = (g, t) => g.focus.find((f) => f.t === t);
const byI = (R, i) => R.items.find((x) => x.i === i);
function cardGeelen(lang) {
  const g = G.geelen, nl = lang === "nl", R3 = T3(g, 3), R11 = T3(g, 11), me = g.me, wn = g.winner;
  const r3 = [32, 35, 41].map((i) => byI(R3, i)), geelen5 = byI(R3, 35), my5 = byI(R3, 41), a124 = byI(R11, 124), a130 = byI(R11, 130);
  const cards = (it) => (it.prod[wn] || []).length;
  const m3 = g.mech[3][me], m11 = g.mech[11];
  const lost = m3.lost.find((l) => l.n === 32);
  const rows = [
    { t: 3, subj: me, v0: R3.v0[me], v1: R3.v1[me], d: R3.d[me], icon: "dice",
      text: nl ? `${posses(g, wn, lang)} 5 (${num(g, me, best(geelen5, me), lang)}) en jouw 5 (${num(g, me, best(my5, me), lang)}) gaven hem graan en baksteen voor een stad.` : `${posses(g, wn, lang)} 5 (${num(g, me, best(geelen5, me), lang)}) and your 5 (${num(g, me, best(my5, me), lang)}) paid him grain and brick for a city.`,
      mech: nl ? `Jij had ${m3.inc.dots.brick} baksteenstip; ${esc(short(g, lost.by, lang))} nam je beste plek (${lost.n}) in beurt ${lost.turn}.` : `You had ${m3.inc.dots.brick} brick dot; ${esc(short(g, lost.by, lang))} took your best spot (${lost.n}) on turn ${lost.turn}.`, glyph: micro(m3.inc.dots, "brick") },
    { t: 11, subj: wn, v0: R11.v0[wn], v1: R11.v1[wn], d: R11.d[wn], icon: "dice",
      text: nl ? `Twee keer een 5 in beurt 11: ${cards(a124) + cards(a130)} kaarten voor ${short(g, wn, lang)} (${num(g, wn, best(a124, wn), lang)} en ${num(g, wn, best(a130, wn), lang)}).` : `Two 5s on turn 11: ${cards(a124) + cards(a130)} cards for ${g.names[wn]} (${num(g, wn, best(a124, wn), lang)} and ${num(g, wn, best(a130, wn), lang)}).`,
      mech: nl ? `Graanstippen: ${short(g, wn, lang)} ${m11[wn].inc.dots.wheat}, jij ${m11[me].inc.dots.wheat}.` : `Grain dots: ${g.names[wn]} ${m11[wn].inc.dots.wheat}, you ${m11[me].inc.dots.wheat}.` },
  ];
  const sh = g.shape, Yn = nameHtml(g, me, lang, true), Wn = nameHtml(g, wn, lang), tb = (t) => `<span class="tg">${L[lang].turn} ${t}</span>`;
  const title = nl ? `${Yn} viel op ${tb(sh.tOut)} uit en kwam niet boven ${sh.ceil}%; ${Wn} stond voor vanaf ${tb(sh.tLead)} en liep uit, vooral op ${tb(sh.step.t)}.` : `${Yn} fell out on ${tb(sh.tOut)} and never got above ${sh.ceil}%; ${Wn} led from ${tb(sh.tLead)} and pulled away, mostly on ${tb(sh.step.t)}.`;
  return gameCard(g, lang, title, { keys: [me, wn], zone: { a: sh.tOut, b: g.T, hi: (sh.ceil + 4) / 100, label: L[lang].zone_out, col: "var(--neg)" }, marks: [[sh.tOut, me], [sh.step.t, wn]] }, rows);
}
function card72(lang) {
  const g = G["72eb"], nl = lang === "nl", R = T3(g, 22), me = g.me, wn = g.winner, dv = byI(R, 288);
  const vb = dv.va, row = { t: 22, subj: me, v0: vb[me], v1: 0, d: best(dv, me), icon: "dice", pm: best(dv, me),
    text: nl ? `${nameHtml(g, wn, lang)} kocht een ontwikkelingskaart: een puntenkaart (kans 21%). Jij: ${num(g, me, best(dv, me), lang, `<small>±${Math.round(dv.se100[me] * 100)}</small>`)}.` : `${nameHtml(g, wn, lang)} bought a development card: a point card (21% chance). You: ${num(g, me, best(dv, me), lang, `<small>±${Math.round(dv.se100[me] * 100)}</small>`)}.`,
    mech: nl ? `Ervoor had ${short(g, wn, lang)} 9 punten en jij 9; de puntenkaart was zijn 10e.` : `Before it ${g.names[wn]} had 9 points and you 9; the point card was their 10th.` };
  const title = nl ? `De winkans van ${nameHtml(g, wn, lang)} steeg van ${pct(dv.va[wn])}% naar 100% op <span class="tg">beurt 22</span>; jouw winkans daalde van ${pct(dv.va[me])}% naar 0%.` : `${nameHtml(g, wn, lang)}’s win chance rose from ${pct(dv.va[wn])}% to 100% on <span class="tg">turn 22</span>; yours fell from ${pct(dv.va[me])}% to 0%.`;
  return gameCard(g, lang, title, { keys: [me, wn], marks: [[22, wn]] }, [row]);
}
function cardComeback(lang) {
  const g = G.comeback, nl = lang === "nl", R14 = T3(g, 14), R15 = T3(g, 15), me = g.me, sh = g.shape, ser = series(g);
  const a172 = byI(R14, 172), a174 = byI(R14, 174), b193 = byI(R15, 193), b194 = byI(R15, 194), tc = R15.turns.find((t) => t.pid === me), m15 = g.mech[15][me];
  const sheep = (a174.prod[me] || []).length + (a172.prod[me] || []).length;
  const rows = [
    { t: 14, subj: me, v0: R14.v0[me], v1: R14.v1[me], d: R14.d[me], icon: "dice",
      text: nl ? `Twee keer een 3: samen ${sheep} wol voor jou (${num(g, me, best(a172, me), lang)} en ${num(g, me, best(a174, me), lang)}).` : `Two 3s: ${sheep} wool for you in total (${num(g, me, best(a172, me), lang)} and ${num(g, me, best(a174, me), lang)}).`,
      mech: nl ? `Een 3 valt maar 2 van de 36 keer; twee op rij ongeveer 1 op 300.` : `A 3 comes up only 2 times in 36; two in a row about 1 in 300.` },
    { t: 15, subj: me, v0: R15.v0[me], v1: R15.v1[me], d: R15.d[me], icon: "pick",
      text: nl ? `Jouw beurt: monopolie, stad en weg samen <b class="d up">≈${sg(pts(tc.d[me]))}</b> <small>±${Math.round(tc.se[me] * 100)}</small>; hout ruilen en de weg alleen ${num(g, me, best(b193, me) + best(b194, me), lang)}.` : `Your turn: monopoly, city and road together <b class="d up">≈${sg(pts(tc.d[me]))}</b> <small>±${Math.round(tc.se[me] * 100)}</small>; trading for wood and the road alone ${num(g, me, best(b193, me) + best(b194, me), lang)}.`,
      mech: nl ? `Je had ${m15.inc.dots.wood} houtstippen: 4 wol → 1 hout bij de bank maakte de weg mogelijk.` : `You had ${m15.inc.dots.wood} wood dots: 4 wool → 1 wood at the bank made the road possible.`, glyph: micro(m15.inc.dots, "wood") },
  ];
  const lowv = Math.round(ser[me][sh.tLow] * 100);
  const title = nl ? `${nameHtml(g, me, lang, true)} zat op <span class="tg">beurt ${sh.tLow}</span> op ${lowv}% en kwam terug om te winnen.` : `${nameHtml(g, me, lang, true)} were down to ${lowv}% on <span class="tg">turn ${sh.tLow}</span> and came back to win.`;
  return gameCard(g, lang, title, { keys: [me], zone: { a: sh.tLow - 2, b: sh.tLow + 2, hi: (sh.low + 6) / 100, label: L[lang].zone_low, col: "var(--neg)" }, marks: [[sh.tLow, me], [15, me]] }, rows);
}
function gameCard(g, lang, title, ch, rows) {
  const l = L[lang];
  return `<div class="ap-c"><div class="hd"><span class="lv">${lang === "nl" ? "Spel" : "Game"}</span>${IC.chev.replace("chev", "chev dn")}</div>
<div class="ti">${title}</div>${chart(g, lang, ch)}${legend(g, lang, ch.keys)}<div class="hint">${l.tap}</div>
<div class="sec">${l.decided}</div>
${rows.map((r) => rowHtml(g, lang, r)).join("")}
<div class="key"><span>${IC.dice} ${l.legend[0]}</span><span>${IC.pick} ${l.legend[1]}</span><span><b>≈</b> ${l.legend[2]}</span></div></div>`;
}
function rowHtml(g, lang, r) {
  const q = r.subj, n = pts(r.d), nmH = q === g.me ? L[lang].You : short(g, q, lang);
  const pill = q === g.me ? `<span class="pill ${n >= 0 ? "up" : "dn"}">${sg(n)}</span>` : `<span class="pill o${q}"><i class="dot" style="background:var(--p${q})"></i>${esc(nmH)} ${sg(n)}</span>`;
  return `<button class="rr" data-round="${r.t}"><span class="rt">B${r.t}</span><div class="rm"><div class="r1"><span class="who ${q === g.me ? "me" : "n" + q}">${esc(nmH)}</span> <span class="fr">${pct(r.v0)}% → ${pct(r.v1)}%</span>${pill}</div>
<div class="r2"><span class="ri">${IC[r.icon]}</span><span>${r.text}</span></div><div class="r3">${r.glyph || ""}<span>${r.mech}</span></div></div>${IC.chev}</button>`;
}
// ---------- round detail (Geelen, round 3)
function roundDetail(lang) {
  const g = G.geelen, nl = lang === "nl", l = L[lang], R = T3(g, 3), me = g.me, wn = g.winner, m = g.mech[3][me], lost = m.lost.find((x) => x.n === 32);
  const items = R.items.filter((it) => it.type === "roll" && Math.max(Math.abs(best(it, me)), Math.abs(best(it, wn))) >= 0.025);
  const chance = R.items.filter((it) => it.chance).reduce((a, it) => a + best(it, me), 0), total = R.d[me], choice = total - chance;
  const shown = items.map((it) => pts(best(it, me))), other = pts(total) - shown.reduce((a, b) => a + b, 0);
  const mx = Math.max(10, ...items.map((it) => Math.abs(pts(best(it, me)))));
  const bar = (v, cls) => `<span class="bar"><i class="z"></i><b class="${cls}" style="${v >= 0 ? "left:50%" : "right:50%"};width:${Math.min(50, (Math.abs(v) / mx) * 50)}%"></b></span>`;
  const rollTxt = (it) => { const who = nameHtml(g, it.pid, lang, true), seats = Object.entries(it.prod || {}); const parts = seats.filter(([q]) => +q !== me && (it.pid === +q || seats.length <= 2 || +q === wn)).map(([q, c]) => `${esc(short(g, +q, lang))} ${c.length === 1 ? (l.res[c[0]]) : [...new Set(c)].map((r) => l.res[r]).join(" + ")}`); const youNone = !(it.prod || {})[me];
    return { a: nl ? `${who} gooit <b>${it.sum}</b>` : `${who} ${it.pid === me ? "roll" : "rolls"} <b>${it.sum}</b>`, b: it.sum === 7 ? "rover" : parts.join(" · ") + (youNone ? (nl ? " · jij niets" : " · you nothing") : "") }; };
  const rows = items.map((it) => { const t = rollTxt(it), v = pts(best(it, me)), o = it.pid !== me && Math.abs(pts(best(it, wn))) >= 3 && wn !== me ? pts(best(it, wn)) : null;
    return `<div class="wf"><span class="wi">${IC.dice}</span><div class="wt"><div>${t.a}</div><div class="ws">${t.b}</div></div><div class="wv">${bar(v, v >= 0 ? "up" : "dn")}<b class="d ${v >= 0 ? "up" : "dn"}">${sg(v)}</b>${o != null ? `<span class="wo n${wn}"><i class="dot" style="background:var(--p${wn})"></i>${esc(short(g, wn, lang))} ${sg(o)}</span>` : ""}</div></div>`; }).join("");
  const geeCity = R.turns.find((t) => t.pid === wn);
  const city = `<div class="wf est"><span class="wi">${IC.pick}</span><div class="wt"><div>${nameHtml(g, wn, lang, true)} ${nl ? "bouwt een stad" : "builds a city"}</div><div class="ws">≈ ${l.sub_vs}</div></div><div class="wv"><b class="d dn">≈${sg(pts(geeCity.d[me]))} <small>±${Math.max(1, Math.round(geeCity.se[me] * 100))}</small></b><span class="wo n${wn}"><i class="dot" style="background:var(--p${wn})"></i>${esc(short(g, wn, lang))} ≈${sg(pts(geeCity.d[wn]))}</span></div></div>`;
  const sub = nl ? `Vooral dobbelsteen: ${posses(g, wn, lang)} en jouw 5 gaven hem graan en baksteen voor een stad; jij kreeg niets.` : `Mostly dice: ${posses(g, wn, lang)} and your 5 gave him grain and brick for a city; you got nothing.`;
  const incBars = `<div class="ib">${RS.map((r) => { const v = m.inc.dots[r], need = r !== "ore", low = v <= 1 && need; return `<div class="ibr ${low ? "low" : ""}"><span class="ibn">${l.res[r]}</span><span class="ibt"><i style="width:${(v / 8) * 100}%;background:var(--r-${r})"></i></span><b>${v}</b></div>`; }).join("")}</div>`;
  const waited = m.need.need.find((x) => x.res === "brick");
  const cap1 = nl ? `Je bouwde pas in beurt ${m.need.turn} een nederzetting: in ${waited.turnsWithout} beurten kreeg je geen baksteen (1 stip ≈ 1 kaart per ${Math.round(waited.expectedTurns)} beurten).` : `You built a settlement only on turn ${m.need.turn}: ${waited.turnsWithout} turns without brick (1 dot ≈ 1 card per ${Math.round(waited.expectedTurns)} turns).`;
  const cap2 = nl ? `${esc(short(g, lost.by, lang))} bouwt in beurt ${lost.turn} op ${lost.n}, je beste plek (${lost.pips} stippen): nog ${m.reachAfter.w1} nederzettingsplekken binnen 1 weg, was ${m.reachBefore.w1}.` : `${esc(short(g, lost.by, lang))} builds on ${lost.n} on turn ${lost.turn}, your best spot (${lost.pips} dots): ${m.reachAfter.w1} spots within 1 road left, was ${m.reachBefore.w1}.`;
  const board = BOARDS.mwg5v7k7j2cc[0];
  return `<div class="top"><button class="bk">${IC.back}</button><div><div class="tt">${l.Turn} 3</div><div class="ts">${l.You} ${pct(R.v0[me])}% → ${pct(R.v1[me])}% · ${sg(pts(total))} ${l.pointsWord}</div></div></div>
<div class="ap-c"><div class="hd"><span class="lv">${l.Turn} 3</span></div><div class="ti sm">${sub}</div>
<div class="split"><div class="sb"><span class="sh">${IC.dice} ${l.chance}</span><b class="d ${chance >= 0 ? "up" : "dn"}">${sg(pts(chance))}</b><span class="ss">${l.chanceSub}</span></div><div class="sb"><span class="sh">${IC.pick} ${l.choice}</span><b class="d ${choice >= 0 ? "up" : "dn"}">${sg(pts(choice))}</b><span class="ss">${l.choiceSub}</span></div></div></div>
<div class="ap-c"><div class="sec first">${l.steps}</div>${rows}<div class="wf oth"><span class="wi"></span><div class="wt"><div>${l.other}</div></div><div class="wv"><b class="d ${other >= 0 ? "up" : "dn"}">${sg(other)}</b></div></div>
<div class="wf tot"><span class="wi"></span><div class="wt"><div>${l.total}</div></div><div class="wv"><b class="d ${total >= 0 ? "up" : "dn"}">${sg(pts(total))}</b></div></div>
<div class="note">${l.noteA}</div></div>
<div class="ap-c"><div class="sec first">${l.progress} <em>≈</em></div>${city}<div class="note">${l.noteB}</div></div>
<div class="ap-c"><div class="sec first">${l.why}</div><div class="mv"><div class="mh">${l.inc}</div>${incBars}<div class="cap">${cap1}</div></div>
<div class="mv"><div class="bd">${board}</div><div class="cap">${cap2}</div></div>
<div class="key"><span>${IC.dice} ${l.legend[0]}</span><span>${IC.pick} ${l.legend[1]}</span><span><b>≈</b> ${l.legend[2]}</span></div></div>`;
}
const SCREENS = {};
for (const lang of ["nl", "en"]) { SCREENS["card-geelen-" + lang] = cardGeelen(lang); SCREENS["card-72eb-" + lang] = card72(lang); SCREENS["card-comeback-" + lang] = cardComeback(lang); SCREENS["round-geelen-" + lang] = roundDetail(lang); }
const css = fs.readFileSync("mock.css", "utf8");
const html = `<!doctype html><html lang="nl" data-theme="A" data-palette="night"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Story ledger mockups</title><style>${css}</style></head><body>
${Object.entries(SCREENS).map(([k, v]) => `<section data-k="${k}">${v}</section>`).join("\n")}
<script>const k = new URLSearchParams(location.search).get("s") || "card-geelen-nl"; document.body.dataset.k = k; document.documentElement.lang = k.slice(-2);</script></body></html>`;
fs.writeFileSync("mock.html", html); console.log("mock.html", html.length);
