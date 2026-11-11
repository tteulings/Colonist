// v1.23 The Bots page: a leaderboard of every bot (compact list), the strength ladder on top, strength against review
// accuracy below, and "You" from your own Past games. Opens from Home › Bots and Settings › Bots.
//
// Numbers: src/bot-stats.js (win chance, with interval, n, set-up, code version, label) and review/bands.js (accuracy).
// Only Classic (4 players) is measured; the other tabs say "Not measured yet" and have no ranking.
// "You": nothing new is stored. It is counted from the Past games entries (history.js: seats, winner, board, mode, n, hot,
// hn), per person (pass & play: by name), per bot level and per mode. A number shows from 5 games (YOU_MIN), else "few".
import { BOT_PROFILES as P, profileMini, gmFlag } from "./bot-profiles.js";
import { openProfileSheet } from "./bot-profile-ui.js";
import { BOT_STATS, SETUPS, accOf, winOf, rangesOverlap, tabOf, MEASURED_TABS, MODE_STATS, FAIR, metricOf, VS_EXPERTS, RATING } from "./bot-stats.js";

export const YOU_MIN = 5;
const KEYS = [...(gmFlag() ? ["grandmaster"] : []), "superplus", "super", "master", "expert", "builder", "trader", "shark", "intermediate", "beginner", "simple"];
const TABS = [["classic", "Classic"], ["rush", "Rush"], ["five", "5 players"], ["six", "6 players"], ["sea", "Seafarers"]]; // v1.34: 5 and 6 players apart (other fair share)
const SORTS = [["win", "Win chance"], ["acc", "Accuracy"], ["you", "You vs him"]];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x) => x.toFixed(1);
const CHEV_L = `<svg viewBox="0 0 20 20" class="ic" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEV_R = `<svg viewBox="0 0 20 20" class="ic bpg-chev" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The rows: every bot with its win and accuracy entries. */
const rows = (tab = "classic", metric = "win") => KEYS.map((key) => ({ key, p: P[key], win: tab === "classic" ? metricOf(key, metric) : winOf(key, tab), acc: accOf(key, P[key].label) }));
// v1.43 Classic: which figure the list's first column shows (and sorts by): win % against 3 Intermediates, against 3 Experts, or the rating
const METRICS = [["win", "vs Intermediates", "Win %"], ["vse", "vs Experts", "vs Exp"], ["rating", "Rating", "Rating"]];
const hasEst = () => rows().some((r) => r.win.label === "estimate"); // bot-125: the legend shows "estimate" only while one is left
const plain = (r) => r.win.v != null && r.win.label !== "early test"; // has a number to place (measured or estimate)

// ── "You" from Past games ────────────────────────────────────────────────────────────────────────
/** { people: [name…] (most games first), by(name, tab) → { g, w, exp, acc: [..], bots: { key: { g, w } } } } */
export function youIndex(metas) {
  const idx = new Map();
  const slot = (name, tab) => { let p = idx.get(name); if (!p) idx.set(name, (p = { name, n: 0, tabs: {} })); return (p.tabs[tab] ||= { g: 0, w: 0, exp: 0, acc: [], bots: {} }); };
  for (const m of metas || []) {
    if (!m || !Array.isArray(m.seats) || m.winner == null) continue;
    const tab = tabOf(m);
    const who = m.hot ? m.seats.map((s, i) => [s, i]).filter(([s]) => !s.prof && s.name) : m.seats.map((s, i) => [s, i]).filter(([s]) => s.you);
    const botKeys = [...new Set(m.seats.filter((s) => s.prof && !s.custom && P[s.prof]).map((s) => s.prof))];
    if (!botKeys.length) continue;
    for (const [s, i] of who) {
      const name = m.hot ? s.name : "You";
      const t = slot(name, tab);
      idx.get(name).n += 1;
      const won = m.winner === i;
      t.g += 1; t.w += won ? 1 : 0; t.exp += 1 / (m.n || m.seats.length || 4);
      const acc = m.hot ? m.hn?.find((h) => h.pid === i)?.acc : m.acc;
      if (acc != null && !(m.hot ? m.hn?.find((h) => h.pid === i)?.prov : m.prov)) t.acc.push(acc);
      const winKey = m.seats[m.winner]?.prof;
      for (const k of botKeys) { const b = (t.bots[k] ||= { g: 0, w: 0, bw: 0 }); b.g += 1; b.w += won ? 1 : 0; b.bw += winKey === k ? 1 : 0; }
    }
  }
  const people = [...idx.values()].sort((a, b) => b.n - a.n || (a.name === "You" ? -1 : 1)).map((p) => p.name);
  return { people, by: (name, tab) => idx.get(name)?.tabs[tab] || { g: 0, w: 0, exp: 0, acc: [], bots: {} } };
}

// ── pieces ───────────────────────────────────────────────────────────────────────────────────────
const dotsHtml = (n, beyond) => `<span class="bpg-dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}${beyond ? `<i class="star"></i>` : ""}</span>`;
const lvText = (r) => `level ${r.p.level} of 5${r.p.beyond ? " plus a star" : ""}`;
const emb = (key, s = 20) => `<span class="bpg-em">${profileMini(key, s)}</span>`;
const inner = (key) => profileMini(key, 100).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const tag = (label) => `<span class="bpg-tag t-${label.replace(" ", "-")}">${label}</span>`;

function youCell(g) { // g: { g, w } for one bot (or undefined)
  if (!g || !g.g) return { html: `<span class="bpg-dash" aria-hidden="true">–</span>`, aria: "no games yet" };
  if (g.g < YOU_MIN) return { html: `<b class="bpg-num dim">${g.w}/${g.g}</b><span class="bpg-sub">few</span>`, aria: `${g.w} of ${g.g} games, too few to say` };
  const pc = Math.round((100 * g.w) / g.g);
  return { html: `<b class="bpg-num">${pc}%</b><span class="bpg-sub">${g.w} of ${g.g}</span>`, aria: `${pc} percent, ${g.w} of ${g.g} games` };
}
const winCell = (r, tab) => {
  const w = r.win; // v1.34: the other tabs carry figures for a few bots (MODE_STATS); the rest says "not measured"
  if (w.label === "measured" && w.rating) return { html: `<b class="bpg-num">${Math.round(w.v)}</b><span class="bpg-sub">±${Math.round(w.ci)}</span>`, aria: `rating ${Math.round(w.v)}, plus or minus ${Math.round(w.ci)}` };
  if (w.label === "measured") return { html: `<b class="bpg-num">${f1(w.v)}</b><span class="bpg-sub">±${f1(w.ci)}</span>`, aria: `${f1(w.v)} percent, plus or minus ${f1(w.ci)}, measured` };
  if (w.label === "estimate") return { html: `<b class="bpg-num">~${Math.round(w.v)}</b><span class="bpg-sub bpg-est">estimate</span>`, aria: `about ${Math.round(w.v)} percent, an estimate, not a measurement` };
  if (w.label === "early test") return { html: `<b class="bpg-num">${esc(w.text.replace(" vs Master", ""))}</b><span class="bpg-sub bpg-est">early test</span>`, aria: `${w.text}, early test` };
  return { html: `<span class="bpg-sub bpg-unk">not measured</span>`, aria: "not measured yet" };
};
const accCell = (r, tab) => {
  if (tab !== "classic") return { html: `<span class="bpg-dash" aria-hidden="true">–</span>`, aria: "not measured yet" };
  const a = r.acc;
  return a.v != null ? { html: `<b class="bpg-num">${a.v}</b><span class="bpg-sub">±${a.se}</span>`, aria: `${a.v}, plus or minus ${a.se}, measured` } : { html: `<span class="bpg-sub bpg-unk">unknown</span>`, aria: "unknown" };
};

/** Order of the rows for a tab and sort. A bot without a number (early test / unknown) has no rank; it leads the win sort and trails the others. */
function order(tab, sort, you, who, metric = "win") {
  const R = rows(tab, metric);
  const sy = (r) => { const g = you.by(who, tab).bots[r.key]; return g && g.g >= YOU_MIN ? g.w / g.g : g && g.g ? -0.5 + g.g / 100 : -1; };
  if (tab !== "classic") { // v1.34: the measured bots first, strongest first (ranked); then the rest by your games
    if (sort === "acc") sort = "win";
    if (sort === "win") return { list: R.sort((a, b) => (plain(b) ? b.win.v : -1e3 + sy(b)) - (plain(a) ? a.win.v : -1e3 + sy(a)) || KEYS.indexOf(a.key) - KEYS.indexOf(b.key)), ranked: true, sort };
    return { list: R.sort((a, b) => sy(b) - sy(a) || KEYS.indexOf(a.key) - KEYS.indexOf(b.key)), ranked: false, sort: "you" };
  }
  const key = { win: (r) => (plain(r) ? r.win.v : 1e3 - KEYS.indexOf(r.key)), acc: (r) => (r.acc.v == null ? -1 : r.acc.v), you: sy }[sort];
  return { list: R.sort((a, b) => key(b) - key(a) || KEYS.indexOf(a.key) - KEYS.indexOf(b.key)), ranked: true, sort };
}

function listHtml(tab, sort, you, who, metric = "win") {
  if (tab !== "classic") metric = "win";
  const o = order(tab, sort, you, who, metric);
  let n = 0;
  const yt = you.by(who, tab);
  const yg = yt.g ? Math.round((100 * yt.w) / yt.g) : null;
  const yacc = yt.acc.length ? Math.round(yt.acc.reduce((a, b) => a + b, 0) / yt.acc.length) : null;
  const youRow = `<div class="bpg-row you" role="row"><span class="bpg-rk" aria-hidden="true">•</span><span class="bpg-me" aria-hidden="true">${esc((who || "You")[0].toUpperCase())}</span>
    <span class="bpg-nm"><b>${esc(who)}</b><span class="bpg-sub">${yt.g ? `${yt.g} game${yt.g > 1 ? "s" : ""}` : "no games yet"}</span></span>
    <span class="bpg-c">${yt.g ? `<b class="bpg-num">${yg}%</b><span class="bpg-sub">won</span>` : `<span class="bpg-dash">–</span>`}</span>
    <span class="bpg-c">${tab === "classic" && yacc != null ? `<b class="bpg-num">${yacc}</b><span class="bpg-sub">${yt.acc.length} rev.</span>` : `<span class="bpg-dash">–</span>`}</span>
    <span class="bpg-c"><span class="bpg-sub">vs bots</span></span></div>`;
  const body = o.list.map((r) => {
    const rank = o.ranked && plain(r) ? ++n : null;
    const w = winCell(r, tab), a = accCell(r, tab), y = youCell(yt.bots[r.key]);
    return `<button type="button" class="bpg-row" role="row" data-open="${r.key}" aria-label="${esc(`${rank ? `Rank ${rank}. ` : ""}${r.p.label}, ${lvText(r)}. Win chance ${w.aria}. Review accuracy ${a.aria}. You: ${y.aria}. Open profile`)}">
      <span class="bpg-rk" aria-hidden="true">${rank ?? "·"}</span>${emb(r.key, 20)}
      <span class="bpg-nm"><b>${r.p.label}</b>${dotsHtml(r.p.level, r.p.beyond)}</span>
      <span class="bpg-c">${w.html}</span><span class="bpg-c">${a.html}</span><span class="bpg-c">${y.html}</span></button>`;
  }).join("");
  const dis = tab !== "classic"; // accuracy is only measured in Classic
  const sorts = `<div class="bpg-sort" role="radiogroup" aria-label="Sort by"><span>Sort by</span>${SORTS.map(([k, l]) => `<button type="button" role="radio" aria-checked="${o.sort === k}" data-sort="${k}" class="${o.sort === k ? "on" : ""}"${dis && k === "acc" ? " disabled" : ""}>${l}</button>`).join("")}</div>`;
  const mets = tab === "classic" ? `<div class="bpg-sort bpg-met" role="radiogroup" aria-label="Show"><span>Show</span>${METRICS.map(([k, l]) => `<button type="button" role="radio" aria-checked="${metric === k}" data-metric="${k}" class="${metric === k ? "on" : ""}">${l}</button>`).join("")}</div>` : "";
  const head = (METRICS.find((m) => m[0] === metric) || METRICS[0])[2];
  return `${mets}${sorts}<div class="bpg-card bpg-list" role="table" aria-label="Bot leaderboard"><div class="bpg-hd" role="row"><span></span><span></span><span>Bot</span><span class="${o.sort === "win" ? "on" : ""}">${head}</span><span class="${o.sort === "acc" ? "on" : ""}">Acc</span><span class="${o.sort === "you" ? "on" : ""}">You</span></div>${youRow}${body}</div>`;
}

// ── 1. the strength ladder (dot plot) ───────────────────────────────────────────────────────────
function ladderSvg(W) {
  const R = rows().filter(plain).sort((a, b) => b.win.v - a.win.v);
  // bot-125: the scale grows with the strongest bot's interval (the search bots reach past 70%), at least 0–55
  const D = Math.max(55, Math.ceil((Math.max(0, ...R.map((b) => b.win.v + (b.win.ci || 0))) + 2) / 5) * 5);
  const x0 = 104, x1 = W - 54, S = (x1 - x0) / D, X = (v) => x0 + v * S, top = 30, rh = 44, H = top + R.length * rh + 22, r = 9;
  let s = `<svg class="bpg-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Strength ladder: win chance of each bot with its 95 percent interval. Dashed line is the 25 percent fair share. Tap a bot to open its profile.">`;
  [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].filter((v) => v <= D).forEach((v) => (s += `<line class="g" x1="${X(v)}" x2="${X(v)}" y1="${top - 8}" y2="${H - 22}"/>`));
  s += `<line class="ref" x1="${X(25)}" x2="${X(25)}" y1="${top - 8}" y2="${H - 22}"/>`;
  [[0, "0"], [25, "25 fair share"], [50, "50"], [75, "75"]].filter(([v]) => v <= D).forEach(([v, t]) => (s += `<text x="${X(v)}" y="14" text-anchor="middle"${v === 25 ? ' class="b"' : ""}>${t}</text>`));
  R.forEach((b, i) => {
    const y = top + i * rh + rh / 2, w = b.win, est = w.label === "estimate";
    s += `<g class="hit" data-open="${b.key}" tabindex="0" role="button" aria-label="${esc(`${b.p.label}, ${lvText(b)}. Win chance ${est ? `about ${Math.round(w.v)} percent, an estimate` : `${f1(w.v)} percent, plus or minus ${f1(w.ci)}, measured`}. Open profile`)}">`;
    s += `<rect x="0" y="${y - rh / 2}" width="${W}" height="${rh}" fill="transparent"/>`;
    s += `<text class="b" x="0" y="${y - 2}">${i + 1}</text><text class="b" x="16" y="${y - 2}">${b.p.label}</text>`;
    for (let k = 0; k < 5; k++) s += `<rect class="dia${k < b.p.level ? " on" : ""}" x="${17 + k * 11}" y="${y + 6}" width="6.5" height="6.5" rx="1.5" transform="rotate(45 ${20.2 + k * 11} ${y + 9.2})"/>`;
    if (b.p.beyond) s += `<path class="dia star" transform="translate(${17 + 5 * 11 - 1},${y + 4.5})" d="M5 0l1.2 3.6H10L7 5.8 8.1 9.5 5 7.3 1.9 9.5 3 5.8 0 3.6h3.8z"/>`; // lab-131: the Supers' star, as in the list
    s += `<line class="stem" x1="${X(0)}" x2="${X(w.v)}" y1="${y}" y2="${y}"/>`;
    if (!est) s += `<g class="iv"><line x1="${X(w.v - w.ci)}" x2="${X(w.v + w.ci)}" y1="${y}" y2="${y}"/><line x1="${X(w.v - w.ci)}" x2="${X(w.v - w.ci)}" y1="${y - 14}" y2="${y + 14}"/><line x1="${X(w.v + w.ci)}" x2="${X(w.v + w.ci)}" y1="${y - 14}" y2="${y + 14}"/></g>`;
    s += `<g transform="translate(${X(w.v)},${y})"><circle r="${r}" class="disc"/><g transform="translate(${-r + 1.5},${-r + 1.5}) scale(${(2 * r - 3) / 100})">${inner(b.key)}</g><circle r="${r}" class="ring${est ? " est" : ""}" style="stroke-opacity:${0.4 + b.p.level * 0.12}"/></g>`;
    s += `<text class="v" x="${W}" y="${y - 1}" text-anchor="end">${est ? "~" + Math.round(w.v) : f1(w.v)}</text><text x="${W}" y="${y + 13}" text-anchor="end">${est ? "estimate" : "±" + f1(w.ci)}</text></g>`;
  });
  s += `<text x="${X(D / 2)}" y="${H - 3}" text-anchor="middle">win chance, %</text></svg>`;
  return s;
}
const ladderCard = (W) => `<section class="bpg-card bpg-hero" aria-labelledby="bpgLadH"><h2 id="bpgLadH">Strength ladder</h2>
  <p class="bpg-lede">Win chance of one bot against 3 Intermediates. A fair share is 25%.</p>${ladderSvg(W)}
  <ul class="bpg-leg"><li><i class="k-ring"></i>measured</li>${hasEst() ? `<li><i class="k-ring est"></i>estimate, not a measurement</li>` : ""}<li><i class="k-cap"></i>95% interval</li><li><span class="bpg-dots" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span>level 1 to 5</li></ul>
  ${ladderFoot()}
  ${numbersHtml("ladder")}</section>`;

/** Under the ladder: where a number is an estimate, and which bots are not on it (no number yet). */
function ladderFoot() {
  const R = rows(), est = R.filter((r) => r.win.label === "estimate"), off = R.filter((r) => !plain(r));
  return [...est.map((r) => `${r.p.label}: ${r.win.src}`),
    ...off.map((r) => `${r.p.label} is not on the ladder: ${r.win.label === "early test" ? `${r.win.text}, early test, no number yet` : "not measured yet"}.`)]
    .map((t) => `<p class="bpg-foot">${esc(t)}</p>`).join("");
}

// ── 2. strength against accuracy (scatter) ──────────────────────────────────────────────────────
function scatterPts(W, H) {
  const D = Math.max(60, Math.ceil(Math.max(0, ...rows().filter((r) => plain(r) && r.acc.v != null).map((r) => r.win.v + (r.win.ci || 0))) / 20) * 20);
  const l = 40, rgt = 14, t = 12, b = 36, XS = (v) => l + (v / D) * (W - l - rgt), YS = (v) => H - b - ((v - 50) / 30) * (H - t - b);
  const pts = rows().filter((r) => plain(r) && r.acc.v != null).map((r) => ({ r, x: XS(r.win.v), y: YS(r.acc.v), est: r.win.label === "estimate" }));
  // pixel clusters: markers closer than 20 px (touching) become one "n bots" marker (tap = a list), never moved apart
  const grp = pts.map((_, i) => i);
  const find = (i) => (grp[i] === i ? i : (grp[i] = find(grp[i])));
  pts.forEach((a, i) => pts.forEach((c, j) => { if (j > i && Math.hypot(a.x - c.x, a.y - c.y) < 20) grp[find(j)] = find(i); }));
  const cl = {};
  pts.forEach((p, i) => (cl[find(i)] ||= []).push(p));
  return { l, rgt, t, b, XS, YS, D, groups: Object.values(cl) };
}
function scatterSvg(W, sel) {
  const H = 320, g = scatterPts(W, H), { l, rgt, t, b, XS, YS } = g;
  let s = `<svg class="bpg-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Win chance against review accuracy for each bot. Tap a bot, or a group of bots, for its numbers.">`;
  [50, 60, 70, 80].forEach((v) => (s += `<line class="g" x1="${l}" x2="${W - rgt}" y1="${YS(v)}" y2="${YS(v)}"/><text x="${l - 6}" y="${YS(v) + 4}" text-anchor="end">${v}</text>`));
  [0, 20, 40, 60, 80].filter((v) => v <= g.D).forEach((v) => (s += `<line class="g" x1="${XS(v)}" x2="${XS(v)}" y1="${t}" y2="${H - b}"/><text x="${XS(v)}" y="${H - b + 16}" text-anchor="middle">${v}</text>`));
  s += `<line class="ref" x1="${XS(25)}" x2="${XS(25)}" y1="${t}" y2="${H - b}"/><text class="b" x="${XS(25) + 4}" y="${t + 11}">25 fair share</text>`;
  s += `<text x="${(l + W - rgt) / 2}" y="${H - 4}" text-anchor="middle">win chance, %</text><text transform="translate(11,${(t + H - b) / 2}) rotate(-90)" text-anchor="middle">review accuracy</text>`;
  const taken = []; // label boxes and markers, to keep labels apart
  g.groups.forEach((G) => G.forEach((p) => taken.push([p.x - 11, p.y - 11, p.x + 11, p.y + 11])));
  const hit = (a, c) => a[0] < c[2] && a[2] > c[0] && a[1] < c[3] && a[3] > c[1];
  g.groups.forEach((G) => G.forEach((p) => { // intervals first (thin, behind)
    const w = p.r.win, a = p.r.acc;
    if (w.ci) s += `<line class="cross" x1="${XS(w.v - w.ci)}" x2="${XS(w.v + w.ci)}" y1="${p.y}" y2="${p.y}"/>`;
    s += `<line class="cross" x1="${p.x}" x2="${p.x}" y1="${YS(a.v - a.se)}" y2="${YS(a.v + a.se)}"/>`;
  }));
  const marks = g.groups.map((G) => ({ x: G.reduce((a, p) => a + p.x, 0) / G.length, y: G.reduce((a, p) => a + p.y, 0) / G.length }));
  // tap area: 22 px round each marker, but never reaching into a neighbour's marker (so a tap on a marker is always that marker's)
  const tapR = (i) => Math.max(10, Math.min(22, ...marks.map((m, j) => (j === i ? 99 : Math.hypot(m.x - marks[i].x, m.y - marks[i].y) / 2))));
  g.groups.forEach((G, gi) => {
    const cx = G.reduce((a, p) => a + p.x, 0) / G.length, cy = G.reduce((a, p) => a + p.y, 0) / G.length;
    const on = sel && (sel.keys.length === G.length && sel.keys.every((k) => G.some((p) => p.r.key === k)));
    if (G.length === 1) {
      const p = G[0], b = p.r;
      s += `<g class="hit" data-pt="${b.key}" tabindex="0" role="button" aria-label="${esc(`${b.p.label}: win chance ${p.est ? `about ${Math.round(b.win.v)}, an estimate` : f1(b.win.v)}, review accuracy ${b.acc.v}. Show numbers`)}"><circle cx="${p.x}" cy="${p.y}" r="${tapR(gi)}" fill="transparent"/>
        <circle cx="${p.x}" cy="${p.y}" r="10" class="disc"/><g transform="translate(${p.x - 8.5},${p.y - 8.5}) scale(.17)">${inner(b.key)}</g><circle cx="${p.x}" cy="${p.y}" r="10" class="ring${p.est ? " est" : ""}" style="stroke-opacity:${0.4 + b.p.level * 0.12}"/>${on ? `<circle cx="${p.x}" cy="${p.y}" r="14" class="selr"/>` : ""}</g>`;
      const wd = b.p.label.length * 6.4 + 4, spots = [[14, 4, "start", [p.x + 12, p.y - 8, p.x + 14 + wd, p.y + 8]], [-14, 4, "end", [p.x - 14 - wd, p.y - 8, p.x - 12, p.y + 8]], [0, -17, "middle", [p.x - wd / 2, p.y - 25, p.x + wd / 2, p.y - 12]], [0, 24, "middle", [p.x - wd / 2, p.y + 13, p.x + wd / 2, p.y + 28]]];
      const sp = spots.find((q) => q[3][0] > l - 4 && q[3][2] < W && !taken.some((tk) => hit(q[3], tk))) || spots[0];
      taken.push(sp[3]);
      s += `<text class="b" x="${p.x + sp[0]}" y="${p.y + sp[1]}" text-anchor="${sp[2]}">${b.p.label}</text>`;
    } else {
      const keys = G.map((p) => p.r.key).join(",");
      s += `<g class="hit" data-grp="${keys}" tabindex="0" role="button" aria-label="${esc(`${G.length} bots with nearly the same numbers: ${G.map((p) => p.r.p.label).join(", ")}. Show the list`)}"><circle cx="${cx}" cy="${cy}" r="${tapR(gi)}" fill="transparent"/>
        <circle cx="${cx}" cy="${cy}" r="12" class="grp"/><text class="gn" x="${cx}" y="${cy + 4.5}" text-anchor="middle">${G.length}</text>${on ? `<circle cx="${cx}" cy="${cy}" r="16" class="selr"/>` : ""}</g>`;
      const q = [cx - 30, cy + 14, cx + 30, cy + 28]; s += `<text class="b" x="${cx}" y="${cy + 26}" text-anchor="middle">${G.length} bots</text>`; taken.push(q);
    }
  });
  return s + "</svg>";
}
/** The sentence under the chart: accuracy is not strength. Built from the data, so it stays true when the numbers change. */
function accNote() {
  const R = rows().filter((r) => r.win.label === "measured" && r.acc.v != null);
  let best = null;
  R.forEach((a) => R.forEach((c) => { if (a.win.v < c.win.v && a.acc.v > c.acc.v && (!best || a.acc.v - c.acc.v > best[0].acc.v - best[1].acc.v)) best = [a, c]; }));
  if (!best) return "Accuracy tells how cleanly a bot plays, not how often it wins.";
  const [a, c] = best, ov = rangesOverlap(a.acc.v, a.acc.se, c.acc.v, c.acc.se);
  return `Accuracy is not strength: ${a.p.label} (${a.acc.v}) scores above ${c.p.label} (${c.acc.v}) but wins less (${f1(a.win.v)}% against ${f1(c.win.v)}%). ${ov ? `Their ±1 SE ranges overlap (${a.acc.v - a.acc.se}–${a.acc.v + a.acc.se} and ${c.acc.v - c.acc.se}–${c.acc.v + c.acc.se}), so accuracy cannot tell them apart.` : `The gap is bigger than the error bars (±${a.acc.se} and ±${c.acc.se}).`}`;
}
function selPanel(sel) {
  if (!sel) return `<p class="bpg-tip" role="status">Tap a bot, or a group, for its numbers.</p>`;
  const R = rows(), one = (k) => { const r = R.find((x) => x.key === k); return `<button type="button" class="bpg-pick" data-open="${k}" aria-label="${esc(r.p.label + ": open profile")}">${emb(k, 20)}<span class="bpg-nm"><b>${r.p.label}</b><span class="bpg-sub">win ${r.win.label === "estimate" ? "~" + Math.round(r.win.v) + " (estimate)" : f1(r.win.v) + " ±" + f1(r.win.ci)} · accuracy ${r.acc.v} ±${r.acc.se}</span></span>${CHEV_R}</button>`; };
  return `<div class="bpg-tip" role="status">${sel.keys.length > 1 ? `<b>${sel.keys.length} bots with nearly the same numbers</b>` : ""}${sel.keys.map(one).join("")}</div>`;
}
const scatterCard = (W, sel) => `<section class="bpg-card bpg-hero" aria-labelledby="bpgScH"><h2 id="bpgScH">Strength against accuracy</h2>
  <p class="bpg-lede">Do the strong bots also play clean? Tap a bot.</p>${scatterSvg(W, sel)}
  <ul class="bpg-leg"><li><i class="k-cross"></i>interval (95% win, ±1 SE accuracy)</li>${hasEst() ? `<li><i class="k-ring est"></i>estimate</li>` : ""}<li><i class="k-grp">n</i>group of bots</li></ul>
  <div data-selpanel>${selPanel(sel)}</div>
  <p class="bpg-foot">${esc(accNote())}</p>${scatterFoot()}
  ${numbersHtml("scatter")}</section>`;

/** Under the scatter: the bots that are not on it, and why. */
function scatterFoot() {
  const off = rows().filter((r) => !(plain(r) && r.acc.v != null));
  return off.map((r) => `<p class="bpg-foot">${esc(`${r.p.label} is not on the chart: ${!plain(r) && r.acc.v == null ? "no win chance and no accuracy yet" : !plain(r) ? "no win chance yet" : "no review accuracy yet"}.`)}</p>`).join("");
}

// ── the numbers (hidden behind a <details>, for both charts) ─────────────────────────────────────
function numbersHtml(kind) {
  const R = rows().filter((r) => (kind === "ladder" ? plain(r) : plain(r) && r.acc.v != null));
  const rowsH = R.map((r) => `<tr><th scope="row">${r.p.label}</th><td>${r.win.v == null ? "–" : (r.win.label === "estimate" ? "~" : "") + f1(r.win.v)}</td><td>${r.win.ci ? "±" + f1(r.win.ci) : "–"}</td><td>${r.win.n ?? "–"}</td><td>${esc(r.win.code || "–")}</td><td>${r.win.label}</td>${kind === "ladder" ? `<td>${VS_EXPERTS[r.key] ? `${f1(VS_EXPERTS[r.key].v)} ±${f1(VS_EXPERTS[r.key].ci)}` : "–"}</td><td>${RATING[r.key] ? `${Math.round(RATING[r.key].v)} ±${Math.round(RATING[r.key].ci)}` : "–"}</td>` : ""}${kind === "scatter" ? `<td>${r.acc.v}</td><td>±${r.acc.se}</td>` : ""}</tr>`).join("");
  // every set-up the shown win figures come from (the classic 2000-game runs, and any smaller paired runs), with its code versions
  const setups = [...new Set(R.map((r) => r.win.setup).filter(Boolean))];
  const codes = (k) => [...new Set(R.filter((r) => r.win.setup === k).map((r) => r.win.code))].join(", ");
  const set = [...setups.map((k) => ["Win chance", `${SETUPS[k]} Code ${codes(k)}.`]), ...(kind === "scatter" ? [["Accuracy", SETUPS.review + " Code v1.21."]] : [])];
  const vsE = BOT_STATS.master?.vsExpert;
  return `<details class="bpg-nums"><summary>Show the numbers</summary><div class="bpg-tw" tabindex="0"><table><caption class="sr">${kind === "ladder" ? "Win chance per bot" : "Win chance and review accuracy per bot"}</caption>
    <thead><tr><th scope="col">Bot</th><th scope="col">Win %</th><th scope="col">±95%</th><th scope="col">n</th><th scope="col">Code</th><th scope="col">Label</th>${kind === "ladder" ? `<th scope="col">vs 3 Experts</th><th scope="col">Rating</th>` : ""}${kind === "scatter" ? `<th scope="col">Acc</th><th scope="col">±SE</th>` : ""}</tr></thead><tbody>${rowsH}</tbody></table></div>
    ${set.map(([a, b]) => `<p class="bpg-foot"><b>${a}:</b> ${esc(b)}</p>`).join("")}
    ${kind === "ladder" ? `<p class="bpg-foot"><b>vs 3 Experts:</b> ${esc(SETUPS.vsExperts || "")}</p><p class="bpg-foot"><b>Rating:</b> ${esc(SETUPS.rating || "")}</p>` : ""}
    ${rows().filter((r) => r.win.src || (r.key === "master" && vsE)).map((r) => `<p class="bpg-foot"><b>${r.p.label}:</b> ${esc([r.win.src, r.key === "master" && vsE ? `Measured on its own: +${f1(vsE.v)} pp (±${f1(vsE.ci)}) over an Expert in the same seat, ${vsE.n} games against 3 Experts; its own seat wins ${f1(vsE.own.v)}% (±${f1(vsE.own.ci)}) there.` : ""].filter(Boolean).join(" "))}</p>`).join("")}</details>`;
}

/** v1.34 a tab with figures for a few bots: what was measured, the fair share, the paired gaps, and the set-up (behind "Show the numbers"). */
function modeCard(tab) {
  const M = MODE_STATS[tab] || {}, keys = Object.keys(M);
  if (!keys.length) return "";
  const name = (k) => P[k]?.label || k;
  const rowsH = keys.map((k) => { const w = M[k]; return `<tr><th scope="row">${name(k)}</th><td>${f1(w.v)}</td><td>±${f1(w.ci)}</td><td>${w.n}</td><td>${w.vsE ? `${w.vsE.v > 0 ? "+" : ""}${f1(w.vsE.v)} ±${f1(w.vsE.ci)}` : "–"}</td></tr>`; }).join("");
  const setup = SETUPS[M[keys[0]].setup] || "";
  const code = M[keys[0]].code;
  return `<section class="bpg-card bpg-hero" aria-labelledby="bpgModeH"><h2 id="bpgModeH">Measured here</h2><p class="bpg-lede">${keys.map(name).join(", ")}: one bot against Intermediates; a fair share is ${FAIR[tab]}%. The other bots are not measured here yet.</p>
    <details class="bpg-nums"><summary>Show the numbers</summary><div class="bpg-tw" tabindex="0"><table><caption class="sr">Win chance per measured bot</caption>
    <thead><tr><th scope="col">Bot</th><th scope="col">Win %</th><th scope="col">±95%</th><th scope="col">n</th><th scope="col">vs Expert (pp)</th></tr></thead><tbody>${rowsH}</tbody></table></div>
    <p class="bpg-foot"><b>Win chance:</b> ${esc(setup)} Code ${esc(code)}.</p><p class="bpg-foot"><b>vs Expert:</b> the same boards and seats played by the Expert; the difference in win chance, in percentage points, ± 95%.</p></details></section>`;
}

const NOT = { rush: "Win chances were only measured in Classic. In Rush the Master and both Super Experts search for less time, so their numbers can differ.", five: "With 5 players a fair share is 20%.", six: "With 6 players a fair share is about 17%.", sea: "In Seafarers the Master and both Super Experts search too, with a model learned from Seafarers games. Nobody measured their win chances there yet." };

// ── the screen ────────────────────────────────────────────────────────────────────────────────────
export const BotsPageMixin = {
  botsClose() {
    this._bpgEl?.remove(); this._bpgEl = null;
    if (this._bpgResize) { removeEventListener("resize", this._bpgResize); this._bpgResize = null; }
    document.querySelector(".bp-sheet")?.remove(); document.querySelector(".bp-scrim")?.remove();
  },
  async botsOpen() {
    this.botsClose();
    this.settingsUI?.close?.();
    const el = document.createElement("div");
    el.className = "hs bpg tm";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bots");
    document.body.appendChild(el);
    this._bpgEl = el;
    this._bpg = this._bpg || { tab: "classic", sort: "win", who: "You", sel: null };
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") this.botsClose(); });
    el.addEventListener("click", (e) => this._botsClick(e));
    let tm = 0; this._bpgResize = () => { clearTimeout(tm); tm = setTimeout(() => this._botsDraw(), 120); };
    addEventListener("resize", this._bpgResize);
    this._bpgYou = youIndex([]);
    this._botsDraw();
    try { await this.hist.open(); this._bpgYou = youIndex(this.hist.metas); } catch (_) { /* no history: the You column stays empty */ }
    if (this._bpgEl === el) this._botsDraw();
  },
  _botsClick(e) {
    const S = this._bpg, t = e.target;
    const q = (sel) => t.closest(sel);
    let b;
    if (q("[data-bclose]")) return this.botsClose();
    if ((b = q("[data-btab]"))) { S.tab = b.dataset.btab; S.sel = null; return this._botsDraw(); }
    if ((b = q("[data-sort]")) && !b.disabled) { S.sort = b.dataset.sort; return this._botsDraw(); }
    if ((b = q("[data-metric]"))) { S.metric = b.dataset.metric; S.sort = "win"; return this._botsDraw(); }
    if ((b = q("[data-who]"))) { S.who = b.dataset.who; return this._botsDraw(); }
    if ((b = q("[data-pt]"))) { S.sel = { keys: [b.dataset.pt] }; return this._botsDraw(true); }
    if ((b = q("[data-grp]"))) { S.sel = { keys: b.dataset.grp.split(",") }; return this._botsDraw(true); }
    if ((b = q("[data-open]"))) return openProfileSheet(this, { key: b.dataset.open });
  },
  _botsDraw(keepScroll = true) {
    const el = this._bpgEl;
    if (!el) return;
    const S = this._bpg, you = this._bpgYou || youIndex([]);
    if (!you.people.includes(S.who)) S.who = you.people.includes("You") || !you.people.length ? "You" : you.people[0];
    const people = you.people.length ? you.people : ["You"];
    const sc = el.querySelector(".hs-scroll"), top = sc?.scrollTop || 0, open = [...el.querySelectorAll("details[open]")].map((d) => d.dataset.k);
    const W = Math.max(280, Math.min(460, el.clientWidth - 24) - 30);
    const measured = MEASURED_TABS.has(S.tab);
    el.innerHTML = `<div class="hs-bar"><button type="button" class="hs-x" data-bclose aria-label="Back">${CHEV_L}</button><div><h3>Bots</h3><small>Leaderboard and profiles</small></div></div>
      <div class="hs-scroll">
        ${people.length > 1 ? `<div class="bpg-who" role="radiogroup" aria-label="Results for"><span>Results for</span>${people.map((n) => `<button type="button" role="radio" aria-checked="${n === S.who}" data-who="${esc(n)}" class="${n === S.who ? "on" : ""}">${esc(n)}</button>`).join("")}</div>` : ""}
        <div class="bpg-tabs" role="tablist" aria-label="Game type">${TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === S.tab}" data-btab="${k}" class="${k === S.tab ? "on" : ""}">${l}</button>`).join("")}</div>
        ${measured ? ladderCard(W) : MODE_STATS[S.tab] ? modeCard(S.tab) : `<div class="bpg-notice" role="status"><b>Not measured yet</b>${NOT[S.tab] || ""} There is no ranking here; “You” still counts your own games.</div>`}
        ${listHtml(S.tab, S.sort, you, S.who, S.metric || "win")}
        <p class="bpg-foot">${measured ? `<b>Win %</b> = one bot against 3 Intermediates, 4 players, 10 VP, ± 95% interval (2000 games a bot; fewer for the search bots, see the numbers); a fair share is 25%. <b>Acc</b> = how often its moves match the best move (game review), ±1 SE. <b>You</b> = your wins in games where that bot sat at the table, from ${YOU_MIN} games (fewer: “few”).` : `<b>Win %</b> = one bot against Intermediates at this kind of table, ± 95% interval (see the numbers above); “not measured”: no figure for that bot here yet. Fair share: ${FAIR[S.tab]}%. Accuracy is only measured in Classic. <b>You</b> = your wins in games where that bot sat at the table, from ${YOU_MIN} games.`}</p>
        ${measured ? scatterCard(W, S.sel) : ""}
      </div>`;
    el.querySelectorAll("details").forEach((d, i) => { d.dataset.k = i; if (open.includes(String(i))) d.open = true; });
    if (keepScroll) el.querySelector(".hs-scroll").scrollTop = top;
  },
};
