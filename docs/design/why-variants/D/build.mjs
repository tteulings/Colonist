// Variant D renderer: data.json (from extract.mjs) -> self-contained HTML mockups (NL/EN, light/dark in one file, ?theme via #dark) + screenshots.
// usage: node build.mjs POST199_DIR   (writes ./html/*.html)
import fs from "fs"; import path from "path";
const POST = process.argv[2], D = JSON.parse(fs.readFileSync("data.json", "utf8"));
const font = (f) => fs.readFileSync(path.join(POST, "assets/fonts", f)).toString("base64");
const FONTS = `@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${font("Figtree.woff2")}) format("woff2");font-weight:400 800}@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${font("Outfit.woff2")}) format("woff2");font-weight:500 800}`;
const T = {
  nl: { app: "Review", tabs: ["Overzicht", "Zetten", "Strategie", "Geluk", "AI"], you: "Jij", youl: "jij", pts: "punten", won: "Waarom je won", lost: "Waarom je verloor", all: "Alle cijfers", next: "Winstkans per beurt",
    start: "Startwinkans", dots: "Stippen bij de start", city: "Eerste stad", cost: "Zetten kosten", luck: "Geluk", pts_: { opening: "Punten, opening", mid: "Punten, middenspel", end: "Punten, eindspel" }, inph: { opening: "in de opening", mid: "in het middenspel", end: "in het eindspel" },
    turn: "beurt", none: "geen", decided: "Beslissend", mLost: "Je duurste zet", mWon: "Je beste zet", mStart: "Start", mTurn: "Beurt", after: "Winkans", bestWas: "beste zet", nextBest: "op een na beste zet", vsOther: "t.o.v. de beste andere zet",
    s: { start: "{S} startte sterker: {sv}% tegen {ov}% winkans.", dots: "{S} had meer stippen bij de start: {sv} tegen {ov}.", city: "{S} bouwde de eerste stad eerder: beurt {sv} tegen {ov}.", city1: "{S} bouwde een stad (beurt {sv}), {o} geen.", pts: "{S} scoorde meer {ph}: +{sv} tegen +{ov} punten.", cost: "{S} gaf met zetten minder winkans weg: {sv}% tegen {ov}%.", luck: "{S} had meer geluk: {sv}% tegen {ov}%.",
      lostFar: "Op deze maten stond je niet achter {R}; het verlies zit elders.", wonBehind: "{R} stond op deze maten voor, toch won jij.", close: "Dicht bij {R}: geen maat verschilt duidelijk." },
    res: { Lumber: "hout", Wool: "wol", Grain: "graan", Brick: "baksteen", Ore: "erts" } },
  en: { app: "Review", tabs: ["Overview", "Moves", "Strategy", "Luck", "AI"], you: "You", youl: "you", pts: "points", won: "Why you won", lost: "Why you lost", all: "All numbers", next: "Win chance per turn",
    start: "Start win chance", dots: "Dots at the start", city: "First city", cost: "Moves cost", luck: "Luck", pts_: { opening: "Points, opening", mid: "Points, midgame", end: "Points, endgame" }, inph: { opening: "in the opening", mid: "in the midgame", end: "in the endgame" },
    turn: "turn", none: "none", decided: "Decisive", mLost: "Your costliest move", mWon: "Your best move", mStart: "Start", mTurn: "Turn", after: "Win chance", bestWas: "best move", nextBest: "next best move", vsOther: "vs the best other move",
    s: { start: "{S} started stronger: {sv}% vs {ov}% win chance.", dots: "{S} had more dots at the start: {sv} vs {ov}.", city: "{S} built the first city sooner: turn {sv} vs {ov}.", city1: "{S} built a city (turn {sv}), {o} none.", pts: "{S} scored more {ph}: +{sv} vs +{ov} points.", cost: "{S} gave away less win chance with moves: {sv}% vs {ov}%.", luck: "{S} had more luck: {sv}% vs {ov}%.",
      lostFar: "On these measures you were not behind {R}; the loss is elsewhere.", wonBehind: "{R} was ahead on these measures, yet you won.", close: "Close to {R}: no measure differs clearly." },
    res: { Lumber: "wood", Wool: "wool", Grain: "grain", Brick: "brick", Ore: "ore" } },
};
const MIN = "−", sg = (v) => (v > 0 ? "+" : v < 0 ? MIN : "") + Math.abs(v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");
function moveLabel(l, lang) {
  const t = T[lang]; let x = l; if (lang === "nl") {
    x = x.replace(/^Settlement on /, "Dorp op ").replace(/^City on /, "Stad op ").replace(/^Road toward /, "Weg richting ").replace(/^End turn.*/, "Einde beurt").replace(/^Bank trade (\d) /, "Bankruil $1 ").replace(/^Bank trade /, "Bankruil ").replace(/^Play Knight/, "Ridder gespeeld").replace(/^Development card/, "Ontwikkelkaart").replace(/^Dev card/, "Ontwikkelkaart");
    x = x.replace(/(Lumber|Wool|Grain|Brick|Ore)/g, (m) => t.res[m]);
  } else x = x.replace(/Lumber/g, t.res.Lumber).replace(/Wool/g, t.res.Wool).replace(/Grain/g, t.res.Grain).replace(/Brick/g, t.res.Brick).replace(/Ore/g, t.res.Ore).replace(/^Development card/, "Dev card");
  return x;
}
const val = (r, who, lang) => { const t = T[lang], v = r[who]; switch (r.id) { case "start": return v + "%"; case "dots": return String(v); case "city": return v == null ? t.none : `${t.turn} ${v}`; case "pts": return "+" + v; case "cost": return v ? MIN + v + "%" : "0%"; case "luck": return sg(v) + "%"; } };
function sentence(m, lang) {
  const t = T[lang], R = m.names[m.rival], dec = m.rows.find((r) => r.decisive);
  const nm = (side, low) => (side === "me" ? (low ? t.youl : t.you) : R);
  if (dec) { const S = dec.better, O = S === "me" ? "rival" : "me", o = nm(O === "me" ? "me" : "rival", true);
    const pv = (w) => (dec.id === "luck" ? sg(dec[w]) : dec[w]); const id = dec.id === "city" && dec[O] == null ? "city1" : dec.id;
    const sv = S === "me" ? dec.me : dec.rival, ov = S === "me" ? dec.rival : dec.me;
    return fill(t.s[id], { S: nm(S), o, sv: dec.id === "luck" ? sg(sv) : sv, ov: dec.id === "luck" ? sg(ov) : ov, ph: t.inph[dec.phase] || "" }); }
  const rivalAhead = m.rows.some((r) => r.better === "rival"), meAhead = m.rows.some((r) => r.better === "me");
  return fill(m.won ? (rivalAhead ? t.s.wonBehind : t.s.close) : (meAhead ? t.s.lostFar : t.s.close), { R });
}
const SEAT = (q) => `var(--p${q})`, SEATT = (q) => `var(--p${q}t)`;
function card(m, lang) {
  const t = T[lang], R = m.names[m.rival], rq = m.rival;
  const head = (q, name, sub) => `<div class="hc"><b style="color:${SEATT(q)}"><i style="background:${SEAT(q)}"></i>${esc(name)}</b><small>${sub}</small></div>`;
  const rows = m.rows.map((r) => {
    const mk = (who) => { const b = r.better === "eq" ? "" : r.better === who ? "up" : "dn"; const arrow = b === "up" ? "▲" : b === "dn" ? "▼" : ""; return `<b class="v ${b}">${arrow ? `<span aria-hidden="true">${arrow}</span>` : ""}${esc(val(r, who, lang))}</b>`; };
    const label = r.id === "pts" ? t.pts_[r.phase] : t[r.id];
    return `<button class="row${r.decisive ? " dec" : ""}" type="button"><span class="l"><span>${esc(label)}</span>${r.decisive ? `<em>${t.decided}</em>` : ""}</span>${mk("me")}${mk("rival")}</button>`;
  }).join("");
  let mom = "";
  if (m.moment) { const o = m.moment, turn = o.setup ? t.mStart : `${t.mTurn} ${o.turn}`;
    const lost = o.kind === "loss", chip = lost ? `<span class="pill dn">▼ ${MIN}${o.gp}%</span>` : `<span class="pill up">▲ +${o.gain}%</span>`;
    const l2 = lost ? `${t.after} ${o.B}%, ${t.bestWas} ${o.A}%` : `${t.after} ${o.B}%, ${t.nextBest} ${o.B - o.gain}%`;
    mom = `<button class="mom" type="button"><span class="mh">${lost ? t.mLost : t.mWon}<b class="tb">${esc(turn)}</b></span><span class="mt"><span class="m1">${esc(moveLabel(o.played, lang))}</span><span class="m2">${esc(l2)}</span></span>${chip}</button>`; }
  return `<section class="card"><div class="eb"><span>${m.won ? t.won : t.lost}</span><span class="vs"><i style="background:${SEAT(0)}"></i>${m.pts[0]}–${m.pts[1]}<i style="background:${SEAT(rq)}"></i></span></div>
<p class="sent">${esc(sentence(m, lang))}</p>
<div class="grid"><div class="hr"><span></span>${head(0, t.you, `${m.pts[0]} ${t.pts}`)}${head(rq, R, `${m.pts[1]} ${t.pts}`)}</div>${rows}</div>${mom}
<div class="foot"><button class="lnk" type="button">${t.all}</button></div></section>`;
}
const CSS = `
:root{--bg:#F7F2E8;--chrome:#EEF7F4;--panel:#FDFBF6;--pb:#E6DDCB;--chip:#fff;--ink:#2E3A3D;--soft:#5A6366;--faint:#687072;--head:#22302F;--accent:#D9714E;--atx:#A84E2F;--abg:#FCEBE3;--tealbg:#E6F4F1;--tealtx:#1F6E77;--good:#3A7324;--goodbg:#E5F0DC;--bad:#A8402C;--p0:#B81E2E;--p1:#3C75C6;--p2:#F08A2E;--p3:#1E9E8E;--p0t:#A01D18;--p1t:#1F4FAE;--p2t:#8F4710;--p3t:#0F6A5B;--sep:#E6DDCB}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0E1B22;--chrome:#13232B;--panel:#172630;--pb:#2A3D47;--chip:#1E303A;--ink:#E4ECEC;--soft:#A9BABE;--faint:#93A6AB;--head:#F3F4EE;--accent:#F0B45C;--atx:#F6C089;--abg:#33281F;--tealbg:#1D3A3E;--tealtx:#8ED8D3;--good:#6CC68E;--goodbg:#1F3A2B;--bad:#F2907A;--p0t:#F2828A;--p1t:#9DBBF0;--p2t:#F6A55A;--p3t:#4FC2B2;--sep:#2E414B}}
:root[data-theme=dark]{--bg:#0E1B22;--chrome:#13232B;--panel:#172630;--pb:#2A3D47;--chip:#1E303A;--ink:#E4ECEC;--soft:#A9BABE;--faint:#93A6AB;--head:#F3F4EE;--accent:#F0B45C;--atx:#F6C089;--abg:#33281F;--tealbg:#1D3A3E;--tealtx:#8ED8D3;--good:#6CC68E;--goodbg:#1F3A2B;--bad:#F2907A;--p0t:#F2828A;--p1t:#9DBBF0;--p2t:#F6A55A;--p3t:#4FC2B2;--sep:#2E414B}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:550 14px/1.35 Figtree,system-ui,sans-serif;font-variant-numeric:tabular-nums}
.app{max-width:440px;margin:0 auto;min-height:100vh}.bar{display:flex;align-items:center;gap:8px;height:56px;padding:0 8px;background:var(--chrome)}.bar b{font:650 20px Outfit,sans-serif;color:var(--head);flex:1}.ib{width:44px;height:44px;border:0;background:none;color:var(--head);font-size:22px}
.tabs{display:flex;gap:4px;padding:6px 8px 8px;background:var(--chrome);overflow:hidden}.tabs span{flex:1;min-height:40px;display:grid;place-items:center;border-radius:12px;font:750 12.5px Figtree;color:var(--soft)}.tabs .on{background:var(--tealbg);color:var(--tealtx)}
.card{margin:10px;padding:12px;background:var(--panel);border:1px solid var(--pb);border-radius:16px}
.eb{display:flex;justify-content:space-between;align-items:center;font:800 11.5px/1.2 Figtree;letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}.vs{display:inline-flex;align-items:center;gap:6px;letter-spacing:0;font:750 13px Outfit;color:var(--head)}.vs i{width:10px;height:10px;border-radius:50%}
.sent{margin:8px 0 10px;font:650 16px/1.3 Outfit,Figtree,sans-serif;color:var(--head);text-wrap:balance}
.grid{border-top:1px solid var(--sep)}.hr,.row{display:grid;grid-template-columns:minmax(0,1fr) 84px 84px;align-items:center;gap:4px}
.hr{padding:8px 0 6px}.hc{display:flex;flex-direction:column;align-items:flex-end;text-align:right;min-width:0}.hc b{display:inline-flex;align-items:center;gap:5px;font:750 13.5px Figtree;max-width:100%}.hc b i{width:10px;height:10px;border-radius:50%;flex:none}.hc small{font:650 11.5px/1.3 Figtree;color:var(--soft)}
.row{width:100%;min-height:48px;padding:0 6px;margin:0;border:0;border-top:1px solid var(--sep);border-radius:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.row .l{display:flex;flex-direction:column;gap:2px;font:650 13.5px/1.25 Figtree;color:var(--ink)}.row .l em{align-self:flex-start;font:800 11.5px/1 Figtree;font-style:normal;color:var(--atx);background:var(--abg);padding:3px 7px;border-radius:99px}
.row.dec{background:color-mix(in srgb,var(--accent) 11%,transparent);border-top-color:var(--sep);box-shadow:inset 3px 0 0 var(--accent);border-radius:8px;min-height:56px}
.v{justify-self:end;display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:0 8px;border-radius:99px;font:800 14px Outfit,Figtree}.v span{font-size:11.5px}.v.up{color:var(--good);background:var(--goodbg)}.v.dn{color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}
.mom{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"h h" "t p";gap:4px 8px;align-items:center;width:100%;margin-top:10px;padding:10px 12px;min-height:64px;border:1px solid var(--pb);border-radius:12px;background:color-mix(in srgb,var(--ink) 5%,transparent);color:inherit;font:inherit;text-align:left;cursor:pointer}
.mh{grid-area:h;display:flex;align-items:center;gap:8px;font:800 11.5px/1.2 Figtree;letter-spacing:.06em;text-transform:uppercase;color:var(--soft)}.tb{font:800 11.5px Figtree;letter-spacing:0;text-transform:none;color:var(--tealtx);background:var(--tealbg);padding:3px 8px;border-radius:99px}
.mt{grid-area:t;display:flex;flex-direction:column;min-width:0}.m1{font:750 14px/1.3 Figtree;color:var(--head)}.m2{font:550 12.5px/1.3 Figtree;color:var(--soft)}.pill{grid-area:p;font:800 15px Outfit;padding:5px 10px;border-radius:99px}.pill.dn{color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}.pill.up{color:var(--good);background:var(--goodbg)}
.foot{display:flex;justify-content:flex-end;margin-top:4px}.lnk{min-height:44px;padding:0 6px;border:0;background:none;color:var(--tealtx);font:800 14px Figtree;cursor:pointer}
.stub{margin:10px;padding:12px;background:var(--panel);border:1px solid var(--pb);border-radius:16px;font:650 15px Outfit;color:var(--head)}.stub div{height:56px;margin-top:8px;border-radius:10px;background:color-mix(in srgb,var(--ink) 6%,transparent)}
.thm{display:none}@media (min-width:600px){.thm{display:flex;justify-content:center;gap:8px;padding:12px}.thm button{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--pb);background:var(--chip);color:var(--ink);font:700 13px Figtree}}`;
export function page(m, lang, label) {
  const t = T[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Variant D ${esc(label)} ${lang}</title><style>${FONTS}${CSS}</style></head><body><div class="app"><div class="bar"><button class="ib" aria-label="back">‹</button><b>${t.app}</b><button class="ib" aria-label="info">ⓘ</button></div>
<div class="tabs">${t.tabs.map((x, i) => `<span class="${i ? "" : "on"}">${x}</span>`).join("")}</div>${card(m, lang)}<div class="stub">${t.next}<div></div></div><div class="thm"><button onclick="setT('light')">Light</button><button onclick="setT('dark')">Dark</button><button onclick="setT('')">Auto</button></div></div>
<script>function setT(v){v?document.documentElement.setAttribute("data-theme",v):document.documentElement.removeAttribute("data-theme")}if(/dark|light/.test(location.hash))setT(location.hash.slice(1))</script></body></html>`;
}
fs.mkdirSync("html", { recursive: true });
const picks = { win: "r1", loss: "r2", "calib-s122-factsmine": Object.keys(D).find((k) => k.startsWith("s122")), "calib-s115-cost": Object.keys(D).find((k) => k.startsWith("s115")), "calib-s126-luck": Object.keys(D).find((k) => k.startsWith("s126")), "calib-s1-blowout": Object.keys(D).find((k) => k.startsWith("s1-")) };
for (const [name, key] of Object.entries(picks)) for (const lang of ["nl", "en"]) { fs.writeFileSync(`html/${name}-${lang}.html`, page(D[key], lang, name)); }
console.log(Object.keys(picks).join(" "));
