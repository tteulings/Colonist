// v1.80 AI tab "spots": the interpretive layer for set-up and settlement / city decisions. The review says THAT spot A beat spot B;
// this reads the position (rec.st of the stored review + the board geometry) and says WHY, as a factor table: dice dots per resource,
// how scarce each resource is on this board, the pair with the player's other set-up settlement, port access, room to expand,
// blocking, and the point plan / usual next build of the engine's futures. Pure reads, no engine: every number comes from here.
//   spotTable(game, e, lang, refs) -> { kind, opts:[{letter, ref, label, node, win}], rows:[{k, label, cells, win}], summary, rule } | null
const R5 = ["wood", "brick", "sheep", "wheat", "ore"];
const NAME = { en: { wood: "Lumber", brick: "Brick", sheep: "Wool", wheat: "Grain", ore: "Ore" }, nl: { wood: "Hout", brick: "Baksteen", sheep: "Wol", wheat: "Graan", ore: "Erts" } };
const LOW = { en: { wood: "lumber", brick: "brick", sheep: "wool", wheat: "grain", ore: "ore" }, nl: { wood: "hout", brick: "baksteen", sheep: "wol", wheat: "graan", ore: "erts" } };
const SRC = { en: { s: "Settlements", c: "Cities", lr: "Longest road", la: "Largest army", dv: "Point cards", is: "New islands" }, nl: { s: "Dorpen", c: "Steden", lr: "Langste weg", la: "Grootste leger", dv: "Puntenkaarten", is: "Nieuwe eilanden" } };
const TX = {
  en: { dots: "Dice dots", share: "Share of board", pair: "With your other settlement", port: "Port", room: "Room (2 roads)", block: "Blocking", plan: "Point plan", next: "Usually next", lean: "Leans to", dot: "dot", dots_: "dots", of: "of", on: "on board", covers: "covers", missing: "missing", all: "covers all 5 resources", repeats: "repeats", none: "none", portProd: "you make", portNo: "you don’t make", gap: "Gap",
    room_: (n, b) => (n ? `${n} free spot${n === 1 ? "" : "s"}${b ? ` (best ${b} dots)` : ""}` : "no free spot"), takes: (k, p) => `open spot #${k} (${p} dots)`, takes1: (p) => `the best open spot (${p} dots)`, kills: (p) => `blocks a ${p}-dot neighbour`, rival: (n) => `next to ${n}`, none_: "no effect",
    city: "cities (ore + grain)", road: "roads + settlements (lumber + brick)", bal: "a mix", cityTag: "city", fut: "of", futs: "futures",
    rule: "Rule of thumb: spread your numbers, cover brick + lumber early, and a port only pays if you produce its resource.",
    sPair: (c) => (c === 5 ? "better pair with your other settlement (all 5 resources)" : `better pair with your other settlement (${c} of 5 resources)`), sPort: (p) => p, sRes: (n) => `more variety (${n} resources)`, sDots: (d) => `${d} more dot${d === 1 ? "" : "s"}`, sShare: (r) => `takes scarce ${r}`, sRoom: (n) => `more room to grow (${n} spots)`, sBlock: "takes a spot rivals want", but: "but", dup: (r) => `duplicates ${r}`, miss: (r) => `misses ${r}`, edge: "no clear edge" },
  nl: { dots: "Stippen", share: "Aandeel bord", pair: "Met je andere dorp", port: "Haven", room: "Ruimte (2 wegen)", block: "Blokkeren", plan: "Puntenplan", next: "Meestal daarna", lean: "Neigt naar", dot: "stip", dots_: "stippen", of: "van", on: "op het bord", covers: "dekt", missing: "mist", all: "dekt alle 5 grondstoffen", repeats: "herhaalt", none: "geen", portProd: "je maakt", portNo: "je maakt geen", gap: "Verschil",
    room_: (n, b) => (n ? `${n} vrije plek${n === 1 ? "" : "ken"}${b ? ` (beste ${b} stippen)` : ""}` : "geen vrije plek"), takes: (k, p) => `open plek #${k} (${p} stippen)`, takes1: (p) => `beste open plek (${p} stippen)`, kills: (p) => `blokkeert buurplek van ${p} stippen`, rival: (n) => `naast ${n}`, none_: "geen effect",
    city: "steden (erts + graan)", road: "wegen + dorpen (hout + baksteen)", bal: "een mix", cityTag: "stad", fut: "van", futs: "toekomsten",
    rule: "Vuistregel: spreid je nummers, dek baksteen + hout vroeg en een haven loont alleen als je de grondstof maakt.",
    sPair: (c) => (c === 5 ? "beter paar met je andere dorp (alle 5 grondstoffen)" : `beter paar met je andere dorp (${c} van 5 grondstoffen)`), sPort: (p) => p, sRes: (n) => `meer variatie (${n} grondstoffen)`, sDots: (d) => `${d} stip${d === 1 ? "" : "pen"} meer`, sShare: (r) => `pakt schaarse ${r}`, sRoom: (n) => `meer ruimte (${n} plekken)`, sBlock: "pakt een plek die rivalen willen", but: "maar", dup: (r) => `dubbel ${r}`, miss: (r) => `mist ${r}`, edge: "geen duidelijk voordeel" },
};
const LET = ["A", "B", "C", "D"];
const pipsOf = (n) => (n ? 6 - Math.abs(7 - n) : 0);
const tryv = (f, d = null) => { try { return f(); } catch (_) { return d; } };

/** The board, once: dots per resource over all hexes. */
function boardTotals(G) {
  const t = {}; G.hexes.forEach((h) => { if (h.number && R5.includes(h.resource)) t[h.resource] = (t[h.resource] || 0) + pipsOf(h.number); }); return t;
}
/** What a node yields: [{r, nums:[n..], dots}] per resource, total dots. */
function yieldOf(G, n) {
  const by = {}; let total = 0;
  (G.nodes[n].adjacentHexes || []).forEach((h) => { const hx = G.hexes[h]; if (!hx?.number || !R5.includes(hx.resource)) return; const e = (by[hx.resource] ||= { nums: [], dots: 0 }); e.nums.push(hx.number); e.dots += pipsOf(hx.number); total += pipsOf(hx.number); });
  return { by, total };
}
const dist = (G, a, occ, seat) => { // steps from a over nodes without a foreign structure
  const d = new Map([[a, 0]]), q = [a];
  while (q.length) { const u = q.shift(); G.nodes[u].neighbors.forEach((m) => { if (d.has(m)) return; const o = occ.get(m); if (o && o.owner !== seat) { d.set(m, d.get(u) + 1); return; } d.set(m, d.get(u) + 1); q.push(m); }); }
  return d;
};
const legal = (G, occ, n) => !occ.has(n) && G.nodes[n].neighbors.every((m) => !occ.has(m));

/** Facts of one candidate node. ctx: { G, occ, seat, totals, others:[node], free:[{n,dots}], lang } */
function factsOf(ctx, n, isCity) {
  const { G, occ, seat, totals, others, free } = ctx, y = yieldOf(G, n), node = G.nodes[n];
  const ownBy = {}; others.forEach((o) => { const q = yieldOf(G, o); Object.entries(q.by).forEach(([r, e]) => { ownBy[r] = (ownBy[r] || 0) + e.dots; }); });
  const kinds = Object.keys(y.by), covered = R5.filter((r) => y.by[r] || ownBy[r]), missing = R5.filter((r) => !covered.includes(r)), dup = isCity ? [] : kinds.filter((r) => ownBy[r]);
  let share = 0; kinds.forEach((r) => { share += y.by[r].dots / (totals[r] || 1); });
  const scarce = kinds.slice().sort((a, b) => (totals[a] || 99) - (totals[b] || 99))[0] || null;
  // port
  const ports = node.ports || [], two = ports.find((t) => t !== "any"), pType = two || (ports.includes("any") ? "any" : null);
  const made = two ? (y.by[two]?.dots || 0) + (ownBy[two] || 0) : 0;
  const portScore = !pType ? 0 : pType === "any" ? 2 : made > 0 ? 3 : 1;
  // room: legal spots 2 roads away once this one is placed; blocking: open spots it takes or kills
  let room = 0, roomBest = 0;
  if (!isCity) {
    const d = dist(G, n, occ, seat), gone = new Set([n, ...node.neighbors]);
    d.forEach((s, m) => { if (s !== 2 || gone.has(m) || !legal(G, occ, m)) return; const q = yieldOf(G, m); if (!q.total) return; room++; roomBest = Math.max(roomBest, q.total); });
  }
  const top = free.slice(0, 6), rank = isCity ? null : free.findIndex((f) => f.n === n) + 1 || null;
  const killed = isCity ? [] : node.neighbors.filter((m) => legal(G, occ, m)).map((m) => ({ n: m, dots: yieldOf(G, m).total })).filter((k) => k.dots > 0);
  const denied = isCity ? 0 : (top.some((f) => f.n === n) ? 1 : 0) + killed.filter((k) => top.some((f) => f.n === k.n)).length;
  const killMax = killed.reduce((a, k) => Math.max(a, k.dots), 0);
  const d3 = isCity ? new Map() : dist(G, n, occ, seat), rivals = []; d3.forEach((s, m) => { const o = occ.get(m); if (o && o.owner !== seat && s <= 3 && !rivals.includes(o.owner)) rivals.push(o.owner); });
  const lean = (() => { const all = { ...ownBy }; Object.entries(y.by).forEach(([r, e]) => { all[r] = (all[r] || 0) + e.dots; }); const t = R5.reduce((a, r) => a + (all[r] || 0), 0) || 1, c = ((all.ore || 0) + (all.wheat || 0)) / t, rd = ((all.wood || 0) + (all.brick || 0)) / t; return c >= 0.55 ? "city" : rd >= 0.55 ? "road" : "bal"; })();
  return { n, by: y.by, total: y.total, kinds, covered, missing, dup, share, scarce, pType, made, portScore, room, roomBest, rank, killMax, denied, rivals, lean, isCity, hasOthers: others.length > 0 };
}

const dotsTxt = (L, f, lang) => (f.total ? `${R5.filter((r) => f.by[r]).sort((a, b) => f.by[b].dots - f.by[a].dots).map((r) => `${NAME[lang][r]} ${f.by[r].nums.join("+")}`).join(" · ")} = ${f.isCity ? "+" : ""}${f.total} ${f.total === 1 ? L.dot : L.dots_}` : "—");
const low = (lang, a) => a.map((r) => LOW[lang][r]).join(", ");

/** rows from the facts of >= 2 options. */
function buildRows(fs, aims, lang, nameOf) {
  const L = TX[lang] || TX.en, nOpt = fs.length, rows = [];
  const win = (vals, eps = 0) => { const mx = Math.max(...vals); const best = vals.map((v, i) => (v >= mx - 1e-9 ? i : -1)).filter((i) => i >= 0); return best.length === 1 && vals.filter((v) => mx - v > eps).length > 0 ? best[0] : -1; };
  const add = (k, label, cells, w = -1) => { if (cells.some((c) => c && c !== "—")) rows.push({ k, label, cells, win: w }); };
  add("dots", L.dots, fs.map((f) => dotsTxt(L, f, lang)), win(fs.map((f) => f.total), 0.5));
  add("variety", lang === "nl" ? "Grondstoffen" : "Resources", fs.map((f) => `${f.kinds.length}: ${low(lang, f.kinds)}`), win(fs.map((f) => f.kinds.length), 0.5));
  const totals = fs[0]._totals;
  add("share", L.share, fs.map((f) => (f.kinds.length ? f.kinds.slice().sort((a, b) => f.by[b].dots - f.by[a].dots).map((r) => `${NAME[lang][r]} ${f.by[r].dots} ${L.of} ${totals[r]}`).join(" · ") : "—")), win(fs.map((f) => f.share), 0.04));
  if (fs.some((f) => f.hasOthers && !f.isCity)) {
    const cell = (f) => (!f.hasOthers || f.isCity ? "—" : `${f.missing.length ? `${L.covers}: ${low(lang, f.covered)} · ${L.missing} ${low(lang, f.missing)}` : L.all}${f.dup.length ? ` · ${L.repeats} ${low(lang, f.dup)}` : ""}`);
    add("pair", L.pair, fs.map(cell), win(fs.map((f) => (f.hasOthers && !f.isCity ? f.covered.length * 10 - f.dup.length : -99)), 0.5));
  }
  if (fs.some((f) => f.pType)) {
    add("port", L.port, fs.map((f) => (f.pType === "any" ? "3:1 port" : f.pType ? `2:1 ${NAME[lang][f.pType]} · ${f.made ? `${L.portProd} ${NAME[lang][f.pType]} (${f.made} ${L.dots_})` : `${L.portNo} ${LOW[lang][f.pType]}`}` : L.none)), win(fs.map((f) => f.portScore), 0.5));
  }
  if (fs.some((f) => !f.isCity)) {
    add("room", L.room, fs.map((f) => (f.isCity ? "—" : L.room_(f.room, f.roomBest))), win(fs.map((f) => (f.isCity ? -1 : f.room)), 0.5));
    add("block", L.block, fs.map((f) => (f.isCity ? "—" : [f.rank === 1 ? L.takes1(f.total) : f.rank ? L.takes(f.rank, f.total) : L.none_, f.killMax ? L.kills(f.killMax) : null, f.rivals.length ? L.rival(f.rivals.slice(0, 2).map(nameOf).join(", ")) : null].filter(Boolean).join(" · ")), win(fs.map((f) => (f.isCity ? -1 : f.denied)), 0.5)));
  }
  if (aims.some((a) => a?.src?.length)) add("plan", L.plan, aims.map((a) => (a?.src?.length ? a.src.map(([k, p]) => `${SRC[lang][k] || k} ${p}%`).join(" · ") : "—")));
  if (aims.some((a) => a?.nx)) add("next", L.next, aims.map((a) => (a?.nx ? `${nl(lang, a.nx[0])} · ${a.nx[1]} ${L.fut} ${a.nx[2]} ${L.futs}` : "—")));
  else if (fs.every((f) => !f.isCity) && fs.some((f) => f.hasOthers || f.total)) add("lean", L.lean, fs.map((f) => L[f.lean]));
  return rows;
}
const nl = (lang, s) => (lang === "nl" ? String(s).replace(/^settlement on/, "dorp op").replace(/^city on/, "stad op").replace(/^road toward/, "weg richting").replace(/^ship toward/, "schip richting") : s);

/** One sentence from the rows: the decisive factors of each option. */
function summarize(fs, rows, lang) {
  const L = TX[lang] || TX.en, order = ["pair", "port", "variety", "dots", "share", "room", "block"], by = Object.fromEntries(rows.map((r) => [r.k, r]));
  const phr = (k, i) => {
    const f = fs[i], oth = fs.filter((_, j) => j !== i);
    switch (k) {
      case "pair": return L.sPair(f.covered.length);
      case "port": return f.pType === "any" ? "3:1 port" : f.pType ? `2:1 ${NAME[lang][f.pType]} port${f.made ? ` (${lang === "nl" ? "je maakt het" : "you produce it"})` : ""}` : null;
      case "variety": return L.sRes(f.kinds.length);
      case "dots": return L.sDots(Math.max(1, Math.round(f.total - Math.max(...oth.map((o) => o.total)))));
      case "share": return f.scarce ? L.sShare(LOW[lang][f.scarce]) : null;
      case "room": return L.sRoom(f.room);
      case "block": return L.sBlock;
      default: return null;
    }
  };
  const parts = fs.map((f, i) => {
    const wins = order.filter((k) => by[k]?.win === i).map((k) => phr(k, i)).filter(Boolean).slice(0, 2);
    let tail = "";
    if (by.pair && by.pair.win !== i && f.hasOthers && !f.isCity) { if (f.missing.length && fs.some((o, j) => j !== i && o.missing.length < f.missing.length)) tail = L.miss(low(lang, f.missing)); else if (f.dup.length && fs.some((o, j) => j !== i && o.dup.length < f.dup.length)) tail = L.dup(low(lang, f.dup)); }
    if (!wins.length && !tail) return `${LET[i]}: ${L.edge}.`;
    return `${LET[i]}: ${wins.join(" + ")}${tail ? `${wins.length ? `, ${L.but} ` : ""}${tail}` : ""}.`;
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const nodeOf = (f) => (f ? (f.node ?? f.city ?? null) : null);
/** Is the decision about a place for a settlement / city? */
export function isSpotDecision(x) {
  if (!x?.cands?.length) return false;
  if (x.k === "setup") return true;
  const l = (s) => /^(?:settlement|city)\b/i.test(String(s || ""));
  return l(x.label) && !!x.best && l(x.best.label);
}

/** The factor table of one decision. e: { x, seat, d?, gap } (aiDecList entry or a block context entry); refs: ["best","played","alt1"..]. */
export function spotTable(game, e, lang = "en", refs = ["best", "played"], moves = null) {
  return tryv(() => {
    const x = e?.d?.x || e?.x || e; if (!isSpotDecision(x)) return null;
    const R = game._rv, rec = R?.recs?.[x.i]; if (!rec?.st) return null;
    const G = game.geometry, pos = JSON.parse(rec.st), seat = rec.pid, occ = new Map();
    (pos.nodes || []).forEach((n) => { if (n.structure && n.owner != null) occ.set(n.id, { owner: n.owner, structure: n.structure }); });
    const sel = [];
    refs.forEach((rf) => { const m = moves?.(rf); const node = nodeOf(m?.focus); if (m && node != null && G.nodes[node] && !sel.some((s) => s.node === node)) sel.push({ ref: rf, label: m.label, node, win: m.win, kind: m.kind }); });
    if (sel.length < 2) return null;
    const isCity = (s) => /^city\b/i.test(String(s.label || "")) || occ.get(s.node)?.owner === seat;
    let others;
    if (rec.k === "setup") others = [...new Set([...occ.entries()].filter(([, v]) => v.owner === seat).map(([k]) => k).concat(R.recs.filter((r) => r.k === "setup" && r.pid === seat && r !== rec && r.a?.n != null).map((r) => r.a.n)))].filter((n) => !sel.some((s) => s.node === n));
    else others = [...occ.entries()].filter(([, v]) => v.owner === seat).map(([k]) => k);
    const totals = boardTotals(G), free = []; G.nodes.forEach((nd, n) => { if (nd && legal(G, occ, n)) { const t = yieldOf(G, n).total; if (t) free.push({ n, dots: t }); } }); free.sort((a, b) => b.dots - a.dots);
    const ctx = { G, occ, seat, totals, others, free };
    const fs = sel.map((s) => { const c = isCity(s), f = factsOf({ ...ctx, others: c ? others.filter((o) => o !== s.node) : others }, s.node, c); f._totals = totals; return f; });
    // the aims of the engine's futures: A (better) and B (played) of the stored decision
    const aims = sel.map((s) => (s.kind === "best" ? x.aim?.A : s.kind === "played" ? x.aim?.B : null));
    const nameOf = (o) => tryv(() => game._rvIsYou?.(o) ? (lang === "nl" ? "jou" : "you") : String(game.players[o]?.name || `P${o + 1}`).replace(/<[^>]+>/g, ""), `P${o + 1}`);
    const rows = buildRows(fs, aims, lang, nameOf);
    return { kind: x.k === "setup" ? "setup" : "build", opts: sel.map((s, i) => ({ letter: LET[i], ref: s.ref, label: String(s.label || "").slice(0, 60), node: s.node, win: s.win, kind: s.kind })), rows, summary: summarize(fs, rows, lang), rule: x.k === "setup" ? (TX[lang] || TX.en).rule : null };
  });
}

/** The compact table the model reads (get_decision): the same rows as text. */
export function spotsForModel(table) {
  if (!table) return null;
  const wins = (i) => table.rows.filter((r) => r.win === i && r.k !== "plan").map((r) => r.label), tally = Object.fromEntries(table.opts.map((o, i) => [o.letter, wins(i).length]));
  return { tally, favourBetter: wins(0), favourPlayed: wins(1), options: table.opts.map((o) => ({ option: o.letter, move: o.label, winPct: o.win, is: o.kind === "best" ? "better" : o.kind })), factors: table.rows.map((r) => ({ factor: r.label, ...Object.fromEntries(table.opts.map((o, i) => [o.letter, r.cells[i]])), ...(r.win >= 0 ? { favours: table.opts[r.win].letter } : {}) })), appSummary: table.summary, ...(table.rule ? { ruleOfThumb: table.rule } : {}) };
}

/** Which refs a spots block shows. */
export const spotRefs = (raw) => {
  const r = (Array.isArray(raw) ? raw : []).map((o) => String(o?.ref ?? o ?? "").trim().toLowerCase()).filter((q) => /^(played|best|better|alt[1-3])$/.test(q)).map((q) => (q === "better" ? "best" : q));
  const u = [...new Set(r)]; return u.length >= 2 ? u.slice(0, 3) : ["best", "played"];
};
