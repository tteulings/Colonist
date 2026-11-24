// Builds the self-contained mockups of variant B from the extracted data:  node build.cjs   (reads data-*.json, writes html/*.html)
// Theme: add #dark or #light to the URL (default: the system setting).  All numbers come from extract.cjs (the app's own analysis).
const fs = require("fs"), path = require("path"); const here = __dirname, APP = process.env.APP || path.join(here, "../../post199");
const font = (n) => "data:font/woff2;base64," + fs.readFileSync(path.join(APP, "assets/fonts", n)).toString("base64");
const T = {
  nl: { why: (w, you, nm) => (you ? (w ? "Waarom je won" : "Waarom je verloor") : `Waarom ${nm} ${w ? "won" : "verloor"}`), ph: { opening: "Opening", mid: "Middenspel", end: "Eindspel" }, phIn: { opening: "de opening", mid: "het middenspel", end: "het eindspel" },
    turns: (a, b) => `beurten ${a}–${b}`, turn: (t) => `Beurt ${t}`, mv: "zet", dice: "worp", rest: "rest", wc: "winkans", noMom: "Geen duidelijk moment", small: (d) => `grootste uitschieter ${sg(d)}%`, flat: (a) => `winkans bleef ${a}%`, quiet: "Geen fase gaf de doorslag: elke fase onder 5%.",
    won: (S) => `${S} won in`, lost: (S) => `${S} verloor in`, you: "Je", board: "Bekijk bord", lang: "nl" },
  en: { why: (w, you, nm) => (you ? (w ? "Why you won" : "Why you lost") : `Why ${nm} ${w ? "won" : "lost"}`), ph: { opening: "Opening", mid: "Midgame", end: "End game" }, phIn: { opening: "the opening", mid: "the midgame", end: "the end game" },
    turns: (a, b) => `turns ${a}–${b}`, turn: (t) => `Turn ${t}`, mv: "move", dice: "dice", rest: "rest", wc: "win chance", noMom: "No clear moment", small: (d) => `biggest swing ${sg(d)}%`, flat: (a) => `win chance stayed at ${a}%`, quiet: "No single phase decided it: every phase under 5%.",
    won: (S) => `${S} won in`, lost: (S) => `${S} lost in`, you: "You", board: "View board", lang: "en" } };
function sg(v) { return (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(Math.round(v)); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const D = (v) => { const r = Math.round(v); return r > 0 ? `<b class="d up"><i aria-hidden="true">▲</i>+${r}%</b>` : r < 0 ? `<b class="d dn"><i aria-hidden="true">▼</i>−${-r}%</b>` : `<b class="d z">±0%</b>`; };
/** the verdict: the phase with the biggest net move of the win chance on the side of the result (>= 5%), else the "quiet" sentence */
function verdict(d, t) {
  const side = (p) => (d.won ? p.v1 - p.v0 : p.v0 - p.v1), best = d.phases.slice().sort((a, b) => side(b) - side(a))[0];
  if (!best || side(best) < 5) return { text: esc(t.quiet), phase: null };
  const S = d.you ? t.you : esc(d.name), net = best.v1 - best.v0;
  return { text: `${(d.won ? t.won : t.lost)(S)} ${t.phIn[best.k]}: <span class="nw">${t.wc} ${best.v0}% → ${best.v1}%</span> (<span class="${net >= 0 ? "up" : "dn"}">${sg(net)}%</span>).`, phase: best.k };
}
/** the moment of a phase: the biggest swing (>= 3%) that goes the way the phase's win chance went (net >= 3%), else the biggest swing either way; none = quiet row */
function pick(p) {
  const net = p.v1 - p.v0, dir = Math.abs(net) >= 3 ? Math.sign(net) : 0, cs = (p.cands || []).filter((c) => Math.abs(c.d) >= 3);
  return cs.find((c) => !dir || Math.sign(c.d) === dir) || null;
}
function spark(p, mom, T) {
  const W = 64, H = 34, vs = p.pts.map((q) => q[1]), lo0 = Math.min(...vs), hi0 = Math.max(...vs), span = Math.max(40, hi0 - lo0), c0 = (hi0 + lo0) / 2, lo = c0 - span / 2, x = (t) => 2 + ((t - (p.from - 1)) / Math.max(1, p.to - (p.from - 1))) * (W - 4), y = (v) => 4 + (1 - (v - lo) / span) * (H - 8);
  const pts = p.pts, path = pts.map((q, i) => `${i ? "L" : "M"}${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join("");
  const mid = 50 > lo && 50 < lo + span ? `<line x1="2" x2="${W - 2}" y1="${y(50)}" y2="${y(50)}" class="mid"/>` : "";
  let dot = ""; if (mom) { const last = pts.filter((q) => q[0] === mom.T).pop() || pts[pts.length - 1]; dot = `<circle cx="${x(last[0]).toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="3.4" class="dot ${mom.d >= 0 ? "up" : "dn"}"/>`; }
  return `<svg class="sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${mid}<path d="${path}" class="ln"/>${dot}</svg>`;
}
function row(p, d, t, hot) {
  const m = pick(p), big = !!m;
  const lab = `<span class="ph">${esc(t.ph[p.k])} · ${t.turns(p.from, p.to)}</span>`;
  if (!big) {
    const l2 = (p.v0 === p.v1 ? t.flat(p.v1) : `${t.wc} ${p.v0}% → ${p.v1}%`);
    return `<button type="button" class="row quiet${hot ? " hot" : ""}" data-stop="${p.to}">${lab}<span class="x"><b class="l1">${t.noMom}</b><span class="l2">${esc(l2)}</span></span>${spark(p, null, d.T)}</button>`;
  }
  const split = [[t.mv, m.move], [t.dice, m.dice], [t.rest, m.rest]].map(([k, v]) => `<span class="${v > 0 ? "up" : v < 0 ? "dn" : ""}">${k} ${sg(v)}%</span>`).join(" · ");
  return `<button type="button" class="row${hot ? " hot" : ""}" data-stop="${m.T}">${lab}<span class="x"><b class="l1">${t.turn(m.T)} · ${esc(m.text)}</b><span class="l2">${split}</span></span><span class="r">${D(m.d)}${spark(p, m, d.T)}</span></button>`;
}
const CSS = `
:root{--bg:#F7F2E8;--sheet:#FDFBF6;--sheet-border:#E6DDCB;--ink:#2E3A3D;--ink-soft:#5A6366;--ink-faint:#687072;--heading:#22302F;--sep:#E6DDCB;--chip:#fff;--good:#3A7324;--good-bg:#E5F0DC;--danger:#A8402C;--dnbg:rgba(168,64,44,.14);--soft:rgba(46,58,61,.08);--chrome:#EEF7F4;--teal-soft:#E6F4F1;--teal-ink:#1F6E77;--shadow:0 8px 28px rgba(0,30,60,.12)}
:root[data-theme=dark]{--bg:#0E1B22;--sheet:#172630;--sheet-border:#2A3D47;--ink:#E4ECEC;--ink-soft:#A9BABE;--ink-faint:#93A6AB;--heading:#F3F4EE;--sep:#2E414B;--chip:#1E303A;--good:#6CC68E;--good-bg:rgba(108,198,142,.16);--danger:#F2907A;--dnbg:rgba(242,144,122,.16);--soft:rgba(228,236,236,.09);--chrome:#13232B;--teal-soft:#1D3A3E;--teal-ink:#8ED8D3;--shadow:0 8px 28px rgba(0,0,0,.4)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:500 14px/1.35 Figtree,system-ui,sans-serif}
.page{max-width:460px;margin:0 auto;padding:0 0 16px}.bar{display:flex;align-items:center;gap:8px;padding:12px;background:var(--chrome);border-bottom:1px solid var(--sep)}.bar b{font:650 20px/1.2 Outfit,sans-serif;color:var(--heading);flex:1}.bar small{font:700 12px/1 Figtree;color:var(--ink-soft)}
.tabs{display:flex;gap:4px;padding:8px 12px;background:var(--chrome)}.tabs span{flex:1;min-height:40px;display:grid;place-items:center;border-radius:10px;font:700 13px/1 Figtree;color:var(--ink-soft)}.tabs .on{background:var(--sheet);color:var(--heading);box-shadow:0 1px 3px rgba(0,0,0,.15)}
.card{margin:12px 16px 0;padding:14px 14px 8px;border-radius:20px;background:var(--sheet);border:1px solid var(--sheet-border);box-shadow:var(--shadow)}
.gt{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.gt b{font:650 18px/1.2 Outfit,sans-serif;color:var(--heading)}.gt small{font:650 12px/1.2 Figtree;color:var(--ink-soft)}
.v{margin:6px 0 8px;font:700 15px/1.35 Figtree;color:var(--heading)}.nw{white-space:nowrap}.v .up,.l2 .up{color:var(--good)}.v .dn,.l2 .dn{color:var(--danger)}
.rows{display:grid}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"ph ph" "x r";column-gap:8px;row-gap:2px;align-items:center;width:100%;min-height:76px;padding:8px 2px 10px;border:0;border-top:1px solid var(--sep);background:none;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.row:active{background:var(--soft)}.ph{grid-area:ph;font:750 11.5px/1.2 Figtree;letter-spacing:.03em;text-transform:uppercase;color:var(--ink-soft)}.x{grid-area:x;min-width:0;display:grid;gap:1px}.r{grid-area:r;display:grid;justify-items:end;gap:3px}
.l1{font:750 13.5px/1.25 Figtree;color:var(--heading)}.l2{font:650 12px/1.3 Figtree;color:var(--ink-soft)}.quiet .l1{color:var(--ink-soft);font-weight:650}.quiet{grid-template-columns:minmax(0,1fr) auto}.quiet .sp{grid-area:r}
.d{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:99px;font:800 13px/1.25 Figtree;font-variant-numeric:tabular-nums;white-space:nowrap}.d i{font-style:normal;font-size:11.5px}.d.up{color:var(--good);background:var(--good-bg)}.d.dn{color:var(--danger);background:var(--dnbg)}.d.z{color:var(--ink-soft);background:var(--soft)}
.sp{display:block}.sp .ln{fill:none;stroke:var(--heading);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}.sp .mid{stroke:var(--sep);stroke-width:1;stroke-dasharray:2 2}.sp .dot{stroke:var(--sheet);stroke-width:1.5}.sp .dot.up{fill:var(--good)}.sp .dot.dn{fill:var(--danger)}
.row.hot .ph{color:var(--heading)}.row.hot .ph::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent,#D9714E);margin-right:6px;vertical-align:1px}
.link{display:flex;align-items:center;justify-content:flex-end;min-height:40px;border:0;border-top:1px solid var(--sep);background:none;color:var(--teal-ink);font:750 14px/1 Figtree;width:100%;padding:0 2px;cursor:pointer}
.ghost{margin:12px 16px 0;height:70px;border-radius:20px;background:var(--sheet);border:1px solid var(--sheet-border);opacity:.55;padding:14px;font:650 18px/1.2 Outfit;color:var(--heading)}`;
function page(g, lang, note) {
  const d = g.data, t = T[lang], v = verdict(d, t), you = d.you;
  const rows = d.phases.map((p) => row(p, d, t, v.phase === p.k)).join("");
  const tabs = lang === "nl" ? ["Overzicht", "Zetten", "Strategie", "Geluk", "AI"] : ["Overview", "Moves", "Strategy", "Luck", "AI"];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Variant B – ${esc(g.file)} ${lang}</title>
<style>@font-face{font-family:Figtree;src:url(${font("Figtree.woff2")}) format("woff2");font-weight:100 900}@font-face{font-family:Outfit;src:url(${font("Outfit.woff2")}) format("woff2");font-weight:100 900}${CSS}</style></head>
<body><div class="page"><div class="bar"><b>Review</b><small>${d.T} ${lang === "nl" ? "beurten" : "turns"}${note ? " · " + esc(note) : ""}</small></div><div class="tabs">${tabs.map((x, i) => `<span class="${i ? "" : "on"}">${x}</span>`).join("")}</div>
<section class="card" data-card><div class="gt"><b>${esc(t.why(d.won, you, d.name))}</b><small>${t.wc}</small></div><p class="v">${v.text}</p><div class="rows">${rows}</div><button type="button" class="link" data-board>${t.board} ›</button></section><div class="ghost">${lang === "nl" ? "Jouw winkans" : "Your win chance"}</div></div>
<script>(function(){var h=location.hash.replace("#",""),r=document.documentElement;if(h==="dark"||h==="light")r.setAttribute("data-theme",h);else if(matchMedia("(prefers-color-scheme: dark)").matches)r.setAttribute("data-theme","dark");})();</script></body></html>`;
}
module.exports = { page, verdict, T };
if (require.main === module) {
  const out = path.join(here, "html"); fs.mkdirSync(out, { recursive: true }); const L = (f) => JSON.parse(fs.readFileSync(path.join(here, f), "utf8")); const w = (n, h) => fs.writeFileSync(path.join(out, n), h);
  for (const lang of ["nl", "en"]) { const r = L(`data-main-${lang}.json`); r.forEach((g) => w(`${g.data.won ? "win" : "loss"}-${lang}.html`, page(g, lang))); }
  const cal = L("data-calib-nl.json"); for (const id of ["s103", "s107", "s114", "s128"]) { const g = cal.find((x) => x.file.startsWith(id + "-")); w(`calib-${id}-nl.html`, page(g, "nl", id)); }
  const b = L("data-bot-nl.json")[0]; w("bot-nl.html", page(b, "nl", "bot")); console.log("html written", fs.readdirSync(out).length);
}
