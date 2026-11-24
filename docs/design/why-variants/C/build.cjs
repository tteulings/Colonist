// Builds the self-contained mockups from data/*.json:  node build.cjs  ->  html/<tag>-<lang>-<theme>.html
const fs = require("fs"), path = require("path");
const D = path.join(__dirname, "data"), H = path.join(__dirname, "html"); fs.mkdirSync(H, { recursive: true });
const T = {
  nl: { title: (w) => (w ? "Waarom je won" : "Waarom je verloor"), unit: "winkans", fair: "Eerlijk deel", fairS: (n) => `1 van ${n} spelers`, start: "Start", moves: "Jouw zetten", luck: "Geluk", others: "Wat de anderen deden",
    end: (w, to) => (to >= 97 || to <= 3 ? (w ? "Einde: gewonnen" : "Einde: verloren") : "Na je laatste zet"), endS: (w) => (w ? "daarna won je" : "daarna verloor je"), othersS: "hun zetten en geluk, plus de rest",
    k: { settlement: "dorp", city: "stad", road: "weg", card: "ontwikkelkaart", bank: "bankruil", end: "beurt beëindigd" },
    startS: (a, b) => `startkeuzes: ${a}% i.p.v. ${b}%`, startOk: "startkeuzes in orde", movesOk: "geen misser van 1% of meer",
    miss: (t, w) => `grootste misser: beurt ${t}, ${w}`, instead: (a, b) => `${a} i.p.v. ${b}`, endW: (b) => `beurt beëindigd i.p.v. ${b}`, weak: "zwakkere zet",
    roll: (r, t) => `grootste worp: ${r} in beurt ${t}`, rollNone: "geen grote worp",
    own: { start: (v) => `Je grootste eigen verlies: je startkeuzes (${v}).`, moves: (v, t) => `Je grootste eigen verlies: je zetten (${v})${t ? `, vooral beurt ${t}` : ""}.`, none: (v) => `Je eigen keuzes kostten weinig (${v}).` } },
  en: { title: (w) => (w ? "Why you won" : "Why you lost"), unit: "win chance", fair: "Fair share", fairS: (n) => `1 of ${n} players`, start: "Start", moves: "Your moves", luck: "Luck", others: "What the others did",
    end: (w, to) => (to >= 97 || to <= 3 ? (w ? "End: won" : "End: lost") : "After your last move"), endS: (w) => (w ? "you won after that" : "you lost after that"), othersS: "their moves and luck, plus the remainder",
    k: { settlement: "settlement", city: "city", road: "road", card: "dev card", bank: "bank trade", end: "ending the turn" },
    startS: (a, b) => `start picks: ${a}% instead of ${b}%`, startOk: "start picks fine", movesOk: "no miss of 1% or more",
    miss: (t, w) => `biggest miss: turn ${t}, ${w}`, instead: (a, b) => `${a} instead of ${b}`, endW: (b) => `ended the turn instead of ${b}`, weak: "a weaker move",
    roll: (r, t) => `biggest roll: ${r} in turn ${t}`, rollNone: "no big roll",
    own: { start: (v) => `Your biggest own loss: your start picks (${v}).`, moves: (v, t) => `Your biggest own loss: your moves (${v})${t ? `, mostly turn ${t}` : ""}.`, none: (v) => `Your own choices cost little (${v}).` } },
};
const MINUS = "−";
const sg = (v) => (v > 0 ? `+${v}%` : v < 0 ? `${MINUS}${-v}%` : "±0%");
const chip = (v) => `<b class="pc ${v > 0 ? "up" : v < 0 ? "dn" : "ze"}">${v > 0 ? "▲ " : v < 0 ? "▼ " : ""}${sg(v)}</b>`;
const own = (v) => `<b class="${v > 0 ? "up" : v < 0 ? "dn" : "ze"}">${v > 0 ? "▲ " : v < 0 ? "▼ " : ""}${sg(v)}</b>`;

function model(d, L) {
  const t = T[L], l = d.led, a0 = l.from;
  const steps = [["start", l.setup], ["moves", l.moves], ["luck", l.luck], ["others", l.rest]];
  let run = a0; const rows = steps.map(([k, v]) => { const from = run; run += v; return { k, v, from, to: run }; });
  if (run !== l.to) throw new Error("sum " + d.tag);
  // sub-lines
  const worst = (d.picks || []).filter((p) => p.gp > 0).sort((a, b) => b.gp - a.gp)[0];
  const sub = {};
  sub.start = worst && l.setup <= -1 ? t.startS(worst.win, worst.best) : t.startOk;
  if (d.move) { const m = d.move, what = m.kind === "end" ? t.endW(t.k[m.best] || t.weak) : m.kind !== m.best && t.k[m.kind] && t.k[m.best] ? t.instead(t.k[m.kind], t.k[m.best]) : t.weak; sub.moves = `${t.miss(m.T, what)} ${own(-m.gp)}`; } else sub.moves = t.movesOk;
  sub.luck = d.roll ? `${t.roll(d.roll.roll, d.roll.T)} ${own(d.roll.d)}` : t.rollNone;
  sub.others = t.othersS;
  // sentence: the biggest own-controlled step (start picks vs moves), both are costs against best play
  const s = l.setup, m = l.moves; let sentence;
  if (Math.min(s, m) > -3) sentence = t.own.none(own(s + m)); else if (s <= m) sentence = t.own.start(own(s)); else sentence = t.own.moves(own(m), d.move && d.move.gp >= 3 ? d.move.T : null);
  return { rows, sub, sentence, t, l };
}
const CSS = `
:root{--bg:#F7F2E8;--card:#fff;--bd:#E0D4BA;--ink:#2E3A3D;--soft:#6B7476;--head:#1B3B44;--track:#EFE7D7;--good:#3F7A28;--gbg:#E5F1DB;--gbar:#B9D9A3;--gbd:#4F8A33;--dng:#A8402C;--dbg:#FBE6DF;--dbar:#F3C3B4;--dbd:#C9694F;--neu:#C9C2B2;--neu2:#E2DCCD;--end:#1F5F66;--endl:#5B6468}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0E1B22}}
:root[data-theme=dark]{--bg:#0E1B22;--card:#172630;--bd:#2E414B;--ink:#E4ECEC;--soft:#9DB0B4;--head:#F3F4EE;--track:#22323A;--good:#6CC68E;--gbg:#1C3527;--gbar:#2F6B49;--gbd:#6CC68E;--dng:#F2907A;--dbg:#3B2420;--dbar:#7A3F33;--dbd:#F2907A;--neu:#4A5C64;--neu2:#2A3A42;--end:#3E9F9E;--endl:#8A9A9F}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.35 Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
.card{max-width:380px;margin:0 auto;background:var(--card);border:1px solid var(--bd);border-radius:20px;padding:14px;box-shadow:0 8px 28px rgba(0,30,60,.12)}
.gt{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.gt b{font:650 17px Outfit,Figtree,system-ui,sans-serif;color:var(--head)}.gt small{font-size:12px;color:var(--soft)}
.sent b,.sub b{white-space:nowrap}.sent{margin:6px 0 4px;font-size:14px;font-weight:600;color:var(--head)}.sent b.dn,.sub b.dn,.pc.dn{color:var(--dng)}.sent b.up,.sub b.up,.pc.up{color:var(--good)}.sub b.ze,.sent b.ze{color:var(--soft)}
.row{padding:9px 0 8px;border-top:1px solid var(--bd)}.row:first-of-type{border-top:0}
.hd{display:flex;align-items:center;gap:8px;min-height:24px}.hd .nm{font-weight:700;font-size:14px;color:var(--head);flex:1;min-width:0}
.run{font-size:12px;color:var(--soft);white-space:nowrap}
.pc{font-size:12.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}.pc.up{background:var(--gbg)}.pc.dn{background:var(--dbg)}.pc.ze{background:var(--track);color:var(--soft)}
.track{position:relative;height:14px;border-radius:7px;background:var(--track);margin:6px 0 5px}
.bar{position:absolute;top:0;bottom:0;border-radius:5px;min-width:3px}
.bar.up{background:var(--gbar);box-shadow:inset 0 0 0 1.5px var(--gbd)}.bar.dn{background:var(--dbar);box-shadow:inset 0 0 0 1.5px var(--dbd)}
.bar.ot{background:repeating-linear-gradient(135deg,var(--neu) 0 4px,var(--neu2) 4px 8px);box-shadow:inset 0 0 0 1px var(--neu);opacity:.9}
.bar.ze{background:var(--soft);width:3px}
.bar.fin{background:var(--end)}.bar.fin.lost{background:var(--endl)}.bar.fair{background:var(--soft);opacity:.55}
.tick{position:absolute;top:-3px;bottom:-3px;border-left:1.5px dashed var(--soft);opacity:.7}
.sub{font-size:12px;color:var(--soft);display:block;min-height:16px}
.row.oth .nm{font-weight:600;color:var(--soft)}
.axis{position:relative;height:16px;font-size:11.5px;color:var(--soft);margin-top:4px}.axis span{position:absolute;top:0;transform:translateX(-50%)}.axis span:first-child{transform:none;margin-left:-1px}.axis span:last-child{transform:translateX(-100%)}.gl{position:absolute;top:0;bottom:0;border-left:1px solid var(--bd)}
`;
function html(d, L, theme) {
  const { rows, sub, sentence, t, l } = model(d, L), won = d.won, n = d.n;
  // axis: 0..100%, widened only when the running total leaves it (bookkeeping totals can dip below 0%: honest scale, never clipped)
  const runs = [l.from, ...rows.map((r) => r.to)], AL = Math.min(0, ...runs), AH = Math.max(100, ...runs), P = (x) => ((x - AL) / (AH - AL)) * 100;
  const pos = (x) => `left:${P(x)}%`, grid = `<i class="gl" style="${pos(0)}"></i><i class="gl" style="${pos(100)}"></i>`;
  const bar = (r) => { const lo = Math.min(r.from, r.to), hi = Math.max(r.from, r.to); const cls = r.k === "others" ? "ot" : r.v > 0 ? "up" : r.v < 0 ? "dn" : "ze"; return `<i class="bar ${cls}" style="left:${P(lo)}%;width:${P(hi) - P(lo)}%"></i>`; };
  const step = (r) => `<div class="row${r.k === "others" ? " oth" : ""}" data-k="${r.k}"><div class="hd"><span class="nm">${t[r.k]}</span>${chip(r.v)}</div><div class="track">${grid}<i class="tick" style="${pos(r.from)}"></i>${bar(r)}</div><span class="sub">${sub[r.k]}</span></div>`;
  const fair = `<div class="row" data-k="fair"><div class="hd"><span class="nm">${t.fair}</span><span class="run">${t.fairS(n)}</span><b class="pc ze">${l.from}%</b></div><div class="track">${grid}<i class="bar fair" style="left:${P(0)}%;width:${P(l.from) - P(0)}%"></i></div></div>`;
  const end = `<div class="row" data-k="end"><div class="hd"><span class="nm">${t.end(won, l.to)}</span>${l.to > 3 && l.to < 97 ? `<span class="run">${t.endS(won)}</span>` : ""}<b class="pc ze">${l.to}%</b></div><div class="track">${grid}<i class="bar fin${won ? "" : " lost"}" style="left:${P(0)}%;width:${P(l.to) - P(0)}%"></i></div></div>`;
  return `<!doctype html><html lang="${L}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Waterval ${d.tag}</title><style>${CSS}</style></head><body><section class="card" id="why"><div class="gt"><b>${t.title(won)}</b><small>${t.unit}</small></div><p class="sent">${sentence}</p><div class="axis"><span style="${pos(0)}">0%</span><span style="${pos(100)}">100%</span></div>${fair}${rows.map(step).join("")}${end}</section></body></html>`;
}
const tags = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D).map((f) => f.replace(".json", ""));
for (const tag of tags) { const d = JSON.parse(fs.readFileSync(path.join(D, tag + ".json"), "utf8")); if (d.err) continue; for (const L of ["nl", "en"]) for (const th of ["light", "dark"]) fs.writeFileSync(path.join(H, `${tag.split("-")[0]}-${L}-${th}.html`), html(d, L, th)); }
