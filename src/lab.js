// AI Lab (lab.html), v0.87: two modes.
//  Analysis   — pick a board, drop pieces or load your game, tune "Your bot" (preset, five dimensions and the
//               Calculation weights) and see how it scores the board (heatmap) and how it decides (decision
//               tree: options → candidates → each score split into terms, the chosen path marked).
//  Tournament — Your bot vs a field of presets, or head-to-head A vs B (two seats each), 10-100 games with
//               seats rotated and common random boards (game i uses the same seed in every run), watched on
//               the board or instant; live standings with 95% bands, a results summary and a session history
//               that compares runs.
// The game runs in two iframes in lab mode (index.html?lab=view draws the board, ?lab=sim plays the
// headless games in short chunks so the page stays responsive). Lab mode never writes the saved game.

const $ = (s) => document.querySelector(s);
const KEY = "colonist.lab";
const WKEY = "colonist.lab.w";      // Calculation weights: this browser session only
const HKEY = "colonist.lab.hist";   // tournament history: this session only
const DIMS = [["placement", "Placement"], ["expansion", "Expansion"], ["trading", "Trading"], ["devCards", "Dev Cards"], ["awareness", "Awareness"]];
const PRESETS = ["beginner", "intermediate", "expert", "builder", "trader", "shark"];
const MODES = [["setup", "Start spots"], ["build", "Next build"], ["robber", "Robber"]];
const TOOLS = [["pan", "Move"], ["settlement", "Town"], ["city", "City"], ["road", "Road"], ["robber", "Robber"], ["erase", "Erase"]];
const MAPS = [["random", "Random"], ["balanced", "Balanced"], ["seed", "Seed"], ["game", "My game"]];
const PLAYERS = [["4", "4"], ["6", "6"], ["sea", "Seafarers"]];
const PIECES = [["start", "Bots' start"], ["none", "Empty"]];
const HANDS = [["keep", "As is"], ["0", "Empty"], ["1", "1 each"], ["3", "3 each"]];
const SPEEDS = [["watch", "Watch"], ["instant", "Instant"]];
const LINEUPS = [["field", "Your bot vs field"], ["h2h", "Head-to-head"]];
const GAMES = [["10", "10"], ["20", "20"], ["50", "50"], ["100", "100"]];
const TBOARDS = [["random", "Random"], ["balanced", "Balanced"]];
const TSEATS = [["rotate", "Rotate"], ["fixed", "Fixed"]];
// The Calculation weights (multipliers on the bot's own score terms, see AI_WEIGHT_KEYS in game.js)
const WEIGHTS = [
  ["Placement", [["num", "Number strength", "value of 6 / 8 over 2 / 12"], ["variety", "Resource variety", "bonus per different resource"], ["scarcity", "Scarcity", "resources it lacks or the board lacks count more"]]],
  ["Trading", [["port", "Port value", "3:1 and matching 2:1 harbours"], ["margin", "Deal margin", "gain needed to accept a player deal", true]]],
  ["Expansion", [["road", "Road distance", "penalty per road to reach a spot"], ["prod", "Production vs points", "long-term income against a VP now"], ["patience", "Patience", "wait for a bigger build vs build now"]]],
  ["Dev cards", [["card", "Card value", "what one card is worth in VP"]]],
  ["Awareness", [["leader", "Leader targeting", "robber and steals lean on the leader"]]],
];
const WNAME = Object.fromEntries(WEIGHTS.flatMap(([, ws]) => ws.map(([k, l]) => [k, l])));
const WSHORT = { num: "Numbers", variety: "Variety", scarcity: "Scarcity", port: "Port", margin: "Margin", road: "Road", prod: "Production", patience: "Patience", card: "Card value", leader: "Leader" };
const TURN_MS = 120; // Watch: one bot turn every ~0.12 s on the board
const SEED0 = 87087; // tournament game i uses seed SEED0 + i * 7919: the same boards in every run
const UNIT = "AI score: higher is better";
const fmt = (v) => (v == null || !Number.isFinite(v) ? "–" : (Math.round(v * 10) / 10).toFixed(1));
const f2 = (v) => (v == null || !Number.isFinite(v) ? "–" : v.toFixed(2).replace("-0.00", "0.00"));
const xfmt = (m) => `×${Number.isInteger(Math.round(m * 100) / 10) ? m.toFixed(1) : m.toFixed(2)}`;
const pct = (x) => `${Math.round(x * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = (k, area = localStorage) => { try { return JSON.parse(area.getItem(k) || "null"); } catch (_) { return null; } };
const put = (k, v, area = localStorage) => { try { area.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } };
const CHEV = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const st = {
  pane: "analysis", mode: "setup", seat: 1, tool: "pan", preset: "intermediate", strat: null, map: "random", seed: 42, players: "4", hand: "keep", pieces: "start", speed: "watch",
  lineup: "field", opp: ["intermediate", "intermediate", "intermediate"], botB: "expert", games: 20, tboard: "random", tseats: "rotate",
  ...(store(KEY) || {}),
};
if (st.speed === "fast") st.speed = "watch"; // v0.83-0.86 name
let W = store(WKEY, sessionStorage) || {}; // changed weights only ({} = defaults)
const hist = store(HKEY, sessionStorage) || [];
const save = () => { const { strat, ...rest } = st; put(KEY, { ...rest, strat: strat && Object.fromEntries(DIMS.map(([k]) => [k, strat[k]])), tool: "pan" }); };
const saveW = () => put(WKEY, W, sessionStorage);

let view = null; // the board game instance (iframe)
let H = null;    // its bot tables (presets, level names)
const tree = { open: new Set(), closed: new Set(), sel: null, data: null, mode: null };

function waitEngine(frame) {
  return new Promise((resolve) => {
    const tick = () => {
      const w = frame.contentWindow;
      if (w && w.__colonistGame && w.document.body?.dataset.gameReady) resolve(w.__colonistGame);
      else setTimeout(tick, 60);
    };
    tick();
  });
}

function seg(el, items, on, attr, fn, disabled = []) {
  el.innerHTML = items.map(([v, l]) => `<button type="button" role="radio" data-${attr}="${v}" aria-checked="${String(v) === String(on)}" class="${String(v) === String(on) ? "on" : ""}"${disabled.includes(v) ? " disabled" : ""}>${esc(l)}</button>`).join("");
  el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => fn(b.dataset[attr])));
}

const levelLabel = (lvl) => H.AI_LEVEL_LABEL[lvl] || lvl.charAt(0).toUpperCase() + lvl.slice(1);
const presetLabel = (p) => (p === "custom" ? "Custom" : H.AI_PRESET_INFO[p]?.label || p);
function presetOf(strat) {
  const m = PRESETS.find((p) => DIMS.every(([k]) => H.AI_PRESETS[p][k] === strat[k]));
  return m || "custom";
}
const changedW = () => Object.keys(W).filter((k) => W[k] != null && W[k] !== 1);
/** Your bot: the five dimensions plus the changed Calculation weights (none: no `w`, the exact default). */
function myBot() {
  const s = Object.fromEntries(DIMS.map(([k]) => [k, st.strat[k]]));
  const ch = changedW();
  if (ch.length) s.w = Object.fromEntries(ch.map((k) => [k, W[k]]));
  return s;
}
const myBotDesc = () => `${presetLabel(st.preset)}${changedW().length ? ` · ${changedW().length} weight${changedW().length > 1 ? "s" : ""}` : ""}`;

// ── Analysis ─────────────────────────────────────────────────────────────
function renderControls() {
  seg($("#labMode"), MODES, st.mode, "mode", (v) => { st.mode = v; tree.sel = null; update(); });
  const presetItems = PRESETS.map((p) => [p, H.AI_PRESET_INFO[p].label]);
  if (st.preset === "custom") presetItems.push(["custom", "Custom"]);
  seg($("#labPreset"), presetItems, st.preset, "preset", (v) => { if (v === "custom") return; st.preset = v; st.strat = { ...H.AI_PRESETS[v] }; update(); });
  $("#labDims").innerHTML = DIMS.map(([k, l]) => `<div class="lb-row lb-dim"><span title="${esc(H.AI_STRATEGY_CATEGORIES[k].descriptions[st.strat[k]])}">${l}</span><div class="lb-seg" data-dim="${k}" role="radiogroup" aria-label="${l}"></div></div>`).join("");
  DIMS.forEach(([k]) => seg($(`[data-dim="${k}"]`), H.AI_STRATEGY_CATEGORIES[k].levels.map((lv) => [lv, levelLabel(lv)]), st.strat[k], "lv", (v) => {
    st.strat = { ...st.strat, [k]: v };
    st.preset = presetOf(st.strat);
    update();
  }));
  renderCalcHead();
  seg($("#labMap"), MAPS, st.map, "map", (v) => { st.map = v; renderControls(); newBoard(); });
  $("#labSeedRow").hidden = st.map !== "seed";
  seg($("#labPlayers"), PLAYERS, st.players, "pl", (v) => { st.players = v; newBoard(); }, st.map === "game" ? PLAYERS.map((x) => x[0]) : []);
  seg($("#labPieces"), PIECES, st.pieces, "pc", (v) => { st.pieces = v; newBoard(); }, st.map === "game" ? PIECES.map((x) => x[0]) : []);
  seg($("#labHand"), HANDS, st.hand, "hand", (v) => { st.hand = v; applyHand(); update(); });
  seg($("#labTools"), TOOLS, st.tool, "tool", (v) => { st.tool = v; renderControls(); });
  const players = view?.players || [];
  $("#labSeats").innerHTML = players.map((p) => `<button type="button" role="radio" aria-checked="${p.id === st.seat}" class="${p.id === st.seat ? "on" : ""}" data-seat="${p.id}" title="${esc(p.name)}" style="--seat:${p.color}"><i></i>${esc(p.name)}</button>`).join("");
  $("#labSeats").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { st.seat = Number(b.dataset.seat); tree.sel = null; applyHand(); update(); }));
  renderTournamentSetup();
}

// Calculation: one slider per weight (×multiplier on the real term; Reset restores the exact defaults)
function wValue(k) {
  const m = W[k] ?? 1;
  if (k === "margin") {
    const t = st.strat.trading;
    if (t === "none" || t === "conservative") return `${xfmt(m)}`;
    return `${Math.round((t === "aggressive" ? 3 : 8) * m * 10) / 10}%`;
  }
  if (k === "card") return (H.AI_PLAN_WEIGHTS.devCard * m).toFixed(2);
  return xfmt(m);
}
function renderCalcHead() {
  const n = changedW().length;
  const open = !$("#labCalc").hidden;
  $("#labCalcBtn").setAttribute("aria-expanded", String(open));
  $("#labCalcSt").innerHTML = n ? `<button type="button" class="lb-link" id="labReset">Reset</button> · ${n} changed` : "default weights";
  $("#labReset")?.addEventListener("click", () => { W = {}; saveW(); renderCalc(); update(); });
}
function renderCalc() {
  const el = $("#labCalc");
  el.innerHTML = WEIGHTS.map(([g, ws]) => `<div class="lb-grp">${g}</div>${ws.map(([k, l, sub, play]) => {
    const m = W[k] ?? 1;
    return `<div class="lb-sl"><label for="w-${k}">${esc(l)}${play ? `<span class="lb-tagp" title="Only changes how it plays (deals with players), not the heatmap">play only</span>` : ""}<small>${esc(sub)}</small></label><output id="wo-${k}" class="${m !== 1 ? "chg" : ""}">${wValue(k)}</output><input type="range" id="w-${k}" data-w="${k}" min="0" max="2" step="0.05" value="${m}" aria-describedby="wo-${k}" /></div>`;
  }).join("")}`).join("");
  el.querySelectorAll("input[data-w]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const k = inp.dataset.w, v = Math.round(Number(inp.value) * 100) / 100;
      if (Math.abs(v - 1) < 1e-9) delete W[k]; else W[k] = v;
      saveW();
      const o = $(`#wo-${k}`); o.textContent = wValue(k); o.classList.toggle("chg", v !== 1);
      renderCalcHead();
      scheduleUpdate();
    });
  });
  renderCalcHead();
}
let upTimer = 0;
const scheduleUpdate = () => { clearTimeout(upTimer); upTimer = setTimeout(update, 60); };

function applyHand() {
  if (!view || st.hand === "keep" || sim.watching) return;
  const n = Number(st.hand);
  view._labSetHand(st.seat, { wood: n, brick: n, sheep: n, wheat: n, ore: n });
}

function update() {
  save();
  renderControls();
  if (!view || sim.watching) return; // the board shows a tournament game: your board (and its scores) come back afterwards
  if (!view.players[st.seat]) st.seat = view.players.length > 1 ? 1 : 0;
  if (st.pane !== "analysis") { view.analysis.lab = null; view.requestBoardDraw(); return; } // Tournament: a clean board
  const r = view._labExplain(st.mode, st.seat, myBot());
  const p = view.players[st.seat];
  const out = $("#labResult");
  $(".lb-treecard").style.setProperty("--seat", p.color);
  renderTree(r?.tree || null, p);
  if (!r) { out.innerHTML = `<p class="lb-note">Nothing to score here.</p>`; return; }
  const vals = DIMS.map(([k]) => r.dims?.[k] || 0);
  const max = Math.max(0.5, ...vals.map(Math.abs));
  out.innerHTML = `<div class="lb-rhead"><i class="lb-dot" style="background:${p.color}"></i><b>${esc(p.name)} · ${esc(r.title)}</b><span class="lb-sc" title="${UNIT}">${fmt(r.score)}</span></div>
    <div class="lb-bars" title="${UNIT}">${DIMS.map(([, l], i) => `<span class="lb-d${Math.abs(vals[i]) < 0.05 ? " zero" : ""}"><span class="l">${l}</span><span class="bar${vals[i] < 0 ? " neg" : ""}"><i style="width:${Math.round((Math.abs(vals[i]) / max) * 100)}%;background:${vals[i] < 0 ? "" : p.color}"></i></span><span class="v">${Math.abs(vals[i]) < 0.05 ? "–" : fmt(vals[i])}</span></span>`).join("")}</div>
    ${r.note ? `<p class="lb-note">${esc(r.note)}</p>` : ""}
    ${r.alts?.length ? `<div class="lb-alts" title="Next best (${UNIT})">${r.alts.map((a) => `<span><b>${fmt(a.score)}</b> ${esc(a.label)}</span>`).join("")}</div>` : ""}`;
}

// ── decision tree ──
function treeOpen(n, depth) {
  if (tree.open.has(n.id)) return true;
  if (tree.closed.has(n.id)) return false;
  return depth === 0 || (!!n.chosen && !n.term && depth < 3);
}
function treeRows(n, depth, rows, siblingsMax) {
  const kids = n.children || [];
  const isOpen = kids.length > 0 && treeOpen(n, depth);
  const v = n.v, vt = n.vt;
  let val = "–";
  if (vt === "score") val = f2(v);
  else if (vt === "signed") val = Math.abs(v) < 0.005 ? "0" : `${v > 0 ? "+" : "−"}${f2(Math.abs(v))}`;
  else if (vt === "div") val = `÷${f2(v)}`;
  else if (vt === "none") val = "";
  const bar = Number.isFinite(n.bar) && siblingsMax > 0 ? `<span class="lt-bar${n.bar < 0 ? " neg" : ""}"><i style="width:${Math.max(3, Math.round((Math.abs(n.bar) / siblingsMax) * 100))}%"></i></span>` : `<span class="lt-bar"></span>`;
  const wv = n.w ? (W[n.w] ?? 1) : null;
  const chip = n.w ? `<span class="lt-w${wv !== 1 ? " chg" : ""}" title="${esc(WNAME[n.w])} slider">${esc(WSHORT[n.w])} ${n.w === "card" ? (H.AI_PLAN_WEIGHTS.devCard * wv).toFixed(2) : xfmt(wv)}</span>` : "";
  const tagTxt = { chosen: "chosen", plan: "plan", now: "does now", first: "first" }[n.tag];
  const tag = tagTxt ? `<span class="lt-tag ${n.tag}">${tagTxt}</span>` : "";
  const cls = ["lt-row", n.chosen ? "pick" : "", n.off ? "off" : "", n.term ? "lt-term" : "", tree.sel === n.id ? "sel" : "", !kids.length && !n.focus ? "static" : ""].filter(Boolean).join(" ");
  const label = `${n.label}${n.sub ? `, ${n.sub}` : ""}${val ? `, ${val}` : ""}${tagTxt ? `, ${tagTxt}` : ""}`;
  rows.push(`<div class="${cls}" role="treeitem" aria-level="${depth + 1}"${kids.length ? ` aria-expanded="${isOpen}"` : ""} style="--ind:${depth * 13}px"><span></span><span class="lt-chev">${CHEV}</span><span class="lt-l"><span class="lt-n">${esc(n.label)}</span>${tag}${chip}${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</span>${bar}<span class="lt-v">${esc(val)}</span><button type="button" class="lt-hit" data-tid="${esc(n.id)}" aria-label="${esc(label)}"></button></div>`);
  if (isOpen) {
    const mx = Math.max(0, ...kids.map((c) => (Number.isFinite(c.bar) ? Math.abs(c.bar) : 0)));
    kids.forEach((c) => treeRows(c, depth + 1, rows, mx));
  }
}
function findNode(n, id) { if (!n) return null; if (n.id === id) return n; for (const c of n.children || []) { const x = findNode(c, id); if (x) return x; } return null; }
function renderTree(t, p) {
  if (tree.mode !== st.mode) { tree.open.clear(); tree.closed.clear(); tree.sel = null; tree.mode = st.mode; }
  tree.data = t;
  $("#labTreeWho").textContent = p ? `${p.name} · tap a row` : "";
  if (!t) { $("#labTree").innerHTML = `<p class="lb-note">Nothing to decide here.</p>`; $("#labTreeSum").textContent = ""; $("#labTreeEq").textContent = ""; return; }
  const sc = t.score != null ? ` · score <b>${f2(t.score)}</b>${st.mode === "build" ? " per turn" : ""}` : "";
  const plan = st.mode === "build" && t.target && !t.action.includes(t.target) ? ` · plan <b>${esc(t.target)}</b>` : "";
  $("#labTreeSum").innerHTML = `${st.mode === "build" ? "Does" : "Chooses"} <b>${esc(t.action)}</b>${plan}${sc}`;
  $("#labTreeEq").textContent = t.eq || "";
  const rows = [];
  treeRows(t.root, 0, rows, 0);
  $("#labTree").innerHTML = rows.join("");
  view?._labFocus(tree.sel ? findNode(t.root, tree.sel)?.focus || null : null);
}
function onTreeTap(e) {
  const b = e.target.closest(".lt-hit");
  if (!b || !tree.data) return;
  const n = findNode(tree.data.root, b.dataset.tid);
  if (!n) return;
  const depth = Number(b.parentElement.getAttribute("aria-level")) - 1;
  if (n.children?.length) {
    const was = treeOpen(n, depth);
    tree.open.delete(n.id); tree.closed.delete(n.id);
    (was ? tree.closed : tree.open).add(n.id);
  }
  if (n.focus) tree.sel = tree.sel === n.id && !n.children?.length ? null : n.id;
  const p = view.players[st.seat];
  renderTree(tree.data, p);
  $(`#labTree [data-tid="${CSS.escape(n.id)}"]`)?.focus({ preventScroll: true });
}

async function newBoard() {
  if (!view) return;
  if (sim.watching) { sim.restore = false; sim.running = false; } // a new board ends the watched run
  $("#labBusy").hidden = false;
  await new Promise((r) => setTimeout(r, 20));
  if (st.map === "game") {
    if (!view._labLoadGame()) { $("#labBusy").textContent = "No game in progress — showing a random board"; st.map = "random"; view._labNewBoard({ map: "random", players: 4 }); setTimeout(() => { $("#labBusy").hidden = true; $("#labBusy").textContent = "Loading board…"; }, 1600); }
    else $("#labBusy").hidden = true;
  } else {
    view._labNewBoard({ map: st.map === "seed" ? "random" : st.map, seed: st.map === "seed" ? Number($("#labSeed").value) || 0 : null,
      players: st.players === "6" ? 6 : 4, sea: st.players === "sea" });
    if (st.pieces === "start") view._labAutoSetup();
    $("#labBusy").hidden = true;
  }
  if (!view.players[st.seat]) st.seat = 1;
  tree.sel = null;
  applyHand();
  update();
}

// Lab tools act on the board: a tap places / removes a piece (the game's own pan & zoom when "Move")
function bindBoardTools(frame) {
  const w = frame.contentWindow;
  const canvas = w.document.getElementById("board");
  // Window capture runs before the game's own canvas listeners, so a lab tool tap never pans or builds
  const block = (e) => {
    if (st.tool === "pan" || st.pane !== "analysis" || e.target !== canvas) return;
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };
  ["pointerdown", "mousedown", "mouseup", "touchstart", "touchmove", "touchend", "click", "dblclick", "wheel"].forEach((t) => w.addEventListener(t, block, { capture: true, passive: false }));
  w.addEventListener("pointerup", (e) => {
    if (st.tool === "pan" || st.pane !== "analysis" || e.target !== canvas) return;
    e.stopImmediatePropagation();
    if (sim.watching) return;
    if (view._labTap(e.clientX, e.clientY, st.tool, st.seat)) { tree.sel = null; update(); }
  }, { capture: true });
}

// ── Tournament ───────────────────────────────────────────────────────────
// Field: [your bot, opp1, opp2, opp3]; head-to-head: [A, B, A, B]. Rotate: game i shifts every bot i seats
// on (your bot plays each seat equally often; in head-to-head A and B swap seats every game). Fixed: as listed.
const SEAT_COL = (i) => view?.players?.[i]?.color || ["#D1453A", "#3C75C6", "#F08A2E", "#2A8556"][i];
function lineupNow() {
  const me = { key: "you", label: st.lineup === "h2h" ? "Bot A" : "Your bot", sub: myBotDesc(), strat: myBot() };
  if (st.lineup === "h2h") {
    const b = { key: "b", label: "Bot B", sub: presetLabel(st.botB), strat: { ...H.AI_PRESETS[st.botB] } };
    return { seats: [me, b, me, b], entries: [{ ...me, seats: 2, col: SEAT_COL(0) }, { ...b, seats: 2, col: SEAT_COL(1) }] };
  }
  const opps = st.opp.map((p) => ({ key: `p:${p}`, label: presetLabel(p), strat: { ...H.AI_PRESETS[p] }, preset: p }));
  const groups = [];
  opps.forEach((o, i) => { const g = groups.find((x) => x.key === o.key); if (g) g.seats += 1; else groups.push({ ...o, seats: 1, col: SEAT_COL(i + 1) }); });
  // identical opponents are one row ("Field" when all three are the same bot)
  groups.forEach((g) => { if (g.seats === 3) { g.sub = `${g.label} ×3`; g.label = "Field"; } else if (g.seats === 2) g.sub = "×2"; });
  return { seats: [me, ...opps], entries: [{ ...me, seats: 1, col: SEAT_COL(0) }, ...groups] };
}
const vsText = () => {
  if (st.lineup === "h2h") return `vs ${presetLabel(st.botB)} · 2 seats each`;
  const s = new Set(st.opp);
  return s.size === 1 ? `vs 3× ${presetLabel(st.opp[0])}` : `vs ${st.opp.map((p) => presetLabel(p).slice(0, 3)).join("/")}`;
};

function renderTournamentSetup() {
  if (!H) return;
  seg($("#labLineup"), LINEUPS, st.lineup, "lu", (v) => { st.lineup = v; save(); renderTournamentSetup(); });
  const opt = (sel) => PRESETS.map((p) => `<option value="${p}"${p === sel ? " selected" : ""}>${esc(presetLabel(p))}</option>`).join("");
  const edit = `<button type="button" class="lb-link" data-edit>Edit</button>`;
  let html;
  if (st.lineup === "h2h") {
    html = `<div class="lb-tseat" style="--seat:${SEAT_COL(0)}"><i></i><b>Bot A<small>Your bot · ${esc(myBotDesc())}</small></b>${edit}</div>
      <div class="lb-tseat" style="--seat:${SEAT_COL(1)}"><i></i><b>Bot B</b><select data-b aria-label="Bot B">${opt(st.botB)}</select></div>
      <div class="lb-tseat" style="--seat:${SEAT_COL(2)}"><i></i><b>Bot A</b><span class="same">same as above</span></div>
      <div class="lb-tseat" style="--seat:${SEAT_COL(3)}"><i></i><b>Bot B</b><span class="same">same as above</span></div>
      <p class="lb-fine">Each bot takes 2 seats; ${st.tseats === "rotate" ? "seats swap every game" : "seats stay fixed"}.</p>`;
  } else {
    html = `<div class="lb-tseat" style="--seat:${SEAT_COL(0)}"><i></i><b>Your bot<small>${esc(myBotDesc())} · from Analysis</small></b>${edit}</div>
      ${st.opp.map((p, i) => `<div class="lb-tseat" style="--seat:${SEAT_COL(i + 1)}"><i></i><b>Opponent</b><select data-opp="${i}" aria-label="Opponent ${i + 1}">${opt(p)}</select></div>`).join("")}`;
  }
  $("#labSeatsT").innerHTML = html;
  $("#labSeatsT").querySelectorAll("select[data-opp]").forEach((s) => s.addEventListener("change", () => { st.opp[Number(s.dataset.opp)] = s.value; save(); renderTournamentSetup(); }));
  $("#labSeatsT").querySelector("select[data-b]")?.addEventListener("change", (e) => { st.botB = e.target.value; save(); renderTournamentSetup(); });
  $("#labSeatsT").querySelector("[data-edit]")?.addEventListener("click", () => { setPane("analysis"); $("#labBotCard").scrollIntoView({ block: "start", behavior: "smooth" }); });
  seg($("#labGames"), GAMES, String(st.games), "g", (v) => { st.games = Number(v); save(); renderTournamentSetup(); });
  seg($("#labTBoard"), TBOARDS, st.tboard, "tb", (v) => { st.tboard = v; save(); renderTournamentSetup(); });
  seg($("#labTSeats"), TSEATS, st.tseats, "ts", (v) => { st.tseats = v; save(); renderTournamentSetup(); });
  seg($("#labSpeed"), SPEEDS, st.speed, "speed", (v) => { st.speed = v; save(); renderTournamentSetup(); });
  $("#labRun").textContent = sim.running ? `Stop (${sim.done}/${sim.n})` : `Start ${st.games} games`;
  $("#labRun").classList.toggle("stop", sim.running);
  $("#labRunNote").textContent = st.players !== "4" ? "Tournaments are 4-player games on the classic island for now." : "";
  document.querySelectorAll(".lb-tsetup .lb-seg button, .lb-tsetup select, .lb-tsetup [data-edit]").forEach((b) => { if (sim.running && !b.closest("#labSpeed")) b.disabled = true; });
}

const sim = { n: 20, done: 0, running: false, game: 0, errors: 0, watching: false, restore: true, results: [], lu: null, cfg: null };
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
function wilson(w, n) {
  if (!n) return [0, 1];
  const z = 1.96, p = w / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const band = (lo, hi, p, fair, col) => `<div class="lb-band" style="--seat:${col}" aria-hidden="true"><span style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></span><u style="left:${fair * 100}%"></u><em style="left:calc(${p * 100}% - 1.5px)"></em></div>`;

/** Line-up index for each seat in game i */
function seatMap(i, cfg) { return [0, 1, 2, 3].map((k) => (cfg.tseats === "rotate" ? (k - (i % 4) + 4) % 4 : k)); }

function stats(results, lu) {
  return lu.entries.map((e) => {
    let wins = 0;
    results.forEach((r) => { if (r.winner != null && lu.seats[r.map[r.winner]]?.key === e.key) wins += 1; });
    const n = results.length, p = n ? wins / n : 0, [lo, hi] = wilson(wins, n);
    return { ...e, wins, n, p, lo, hi, fair: e.seats / 4 };
  });
}
function renderStand(final = false) {
  const el = $("#labStand");
  const lu = sim.lu;
  if (!lu) { el.hidden = true; return; }
  const rows = stats(sim.results, lu).sort((a, b) => b.p - a.p || (a.key === "you" ? -1 : 1));
  el.hidden = false;
  el.innerHTML = `<div class="lt-head"><h2>${final ? "Standings" : "Live standings"}</h2><small>${sim.done} of ${sim.n} played</small></div>
    ${final ? "" : `<div class="lb-prog" aria-hidden="true"><i style="width:${(sim.done / sim.n) * 100}%"></i></div>`}
    <div class="lb-st"><span></span><span class="hd">bot</span><span class="hd" style="text-align:right">wins</span><span class="hd">95% band</span>
    ${rows.map((r) => `<i style="--seat:${r.col}"></i><span class="nm">${esc(r.label)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ""} <small>· ${r.wins}/${r.n}</small></span><span class="pc">${r.n ? pct(r.p) : "–"}</span>${r.n ? band(r.lo, r.hi, r.p, r.fair, r.col) : `<span></span>`}`).join("")}</div>
    <p class="lb-fine">Line = fair share (${lu.entries.map((e) => `${e.label} ${pct(e.seats / 4)}`).filter((x, i, a) => a.indexOf(x) === i).join(", ")}).</p>`;
}
function verdict(s) {
  const f = pct(s.fair);
  if (s.lo > s.fair) return `Clearly above its fair share (${f}): the whole band is above the line.`;
  if (s.hi < s.fair) return `Clearly below its fair share (${f}): the whole band is under the line.`;
  if (s.n < 100) return `Not clearly ${s.p >= s.fair ? "above" : "below"} fair share yet — try ${s.n < 50 ? "50 or 100" : "100"} games.`;
  return `About its fair share (${f}): no clear difference after ${s.n} games.`;
}
function renderSummary() {
  const el = $("#labSummary");
  const lu = sim.lu;
  if (!lu || !sim.results.length) { el.hidden = true; return; }
  const me = stats(sim.results, lu).find((e) => e.key === "you");
  let vp = 0, turns = 0, place = 0, k = 0;
  sim.results.forEach((r) => {
    turns += r.turns;
    r.map.forEach((li, seat) => {
      if (lu.seats[li].key !== "you") return;
      k += 1;
      vp += r.vp[seat];
      place += 1 + r.vp.filter((v, j) => j !== seat && v > r.vp[seat]).length + 0.5 * r.vp.filter((v, j) => j !== seat && v === r.vp[seat]).length;
    });
  });
  el.hidden = false;
  el.innerHTML = `<div class="lt-head"><h2>${esc(me.label)}</h2><small>${me.n} games · 4 players</small></div>
    <div class="lb-big"><b>${pct(me.p)}</b><span>wins · 95% band ${pct(me.lo)}–${pct(me.hi)} · fair share ${pct(me.fair)}</span></div>
    ${band(me.lo, me.hi, me.p, me.fair, me.col)}
    <div class="lb-kpis"><div class="lb-kpi"><b>${(vp / k).toFixed(1)}</b><span>avg VP</span></div><div class="lb-kpi"><b>${Math.round(turns / sim.results.length)}</b><span>avg turns</span></div><div class="lb-kpi"><b>${(place / k).toFixed(1)}</b><span>avg place</span></div></div>
    <p class="lb-verdict">${esc(verdict(me))}</p>`;
}

// History: every finished run of this session; each compares with the run before it
function diffText(a, b) {
  if (a.vsKey !== b.vsKey || a.kind !== b.kind) return "different line-up";
  const ch = [...DIMS.filter(([k]) => a.strat[k] !== b.strat[k]).map(([, l]) => l),
    ...[...new Set([...Object.keys(a.strat.w || {}), ...Object.keys(b.strat.w || {})])].filter((k) => (a.strat.w?.[k] ?? 1) !== (b.strat.w?.[k] ?? 1)).map((k) => WNAME[k])];
  const extra = [a.board !== b.board ? "board" : null, a.tseats !== b.tseats ? "seats" : null].filter(Boolean);
  const what = ch.length === 0 ? "same bot" : ch.length === 1 ? `only ${ch[0]} changed` : `${ch.slice(0, 2).join(", ")}${ch.length > 2 ? ` +${ch.length - 2}` : ""} changed`;
  return extra.length ? `${what} · ${extra.join(" and ")} differ` : what;
}
function renderHist() {
  const el = $("#labHist");
  if (!hist.length) { el.hidden = true; return; }
  el.hidden = false;
  const rows = hist.slice().reverse().map((h, i) => {
    const prev = hist[hist.length - 2 - i];
    let diff = "";
    if (prev) {
      const pts = Math.round((h.p - prev.p) * 100);
      const overlap = h.lo <= prev.hi && prev.lo <= h.hi;
      diff = `<div class="lb-diff">vs #${prev.no}: <b>${pts > 0 ? "+" : pts < 0 ? "−" : "±"}${Math.abs(pts)} pts</b> · ${esc(diffText(h, prev))} · ${overlap ? "bands overlap" : "bands apart"}</div>`;
    }
    return `<div class="lb-hr${i === 0 ? " cur" : ""}"><span class="no">#${h.no}</span><span class="ds">${esc(h.label)} <small>${esc(h.desc)} · ${esc(h.vs)} · ${h.n}</small></span><span class="pc">${pct(h.p)}</span>${band(h.lo, h.hi, h.p, h.fair, h.col)}${diff}</div>`;
  });
  el.innerHTML = `<div class="lt-head"><h2>This session</h2><small>95% bands · line = fair share</small></div><div class="lb-hist">${rows.join("")}</div>`;
}

// Caption over the board while a game is watched: game n/N · turn · each seat's points (your bot's seats ringed)
function renderWatch(g, final = null) {
  const el = $("#labWatch");
  if (!g) { el.hidden = true; document.querySelectorAll(".lb-read, .lb-tools").forEach((x) => x.classList.remove("lb-faded")); return; }
  const info = g._labSimInfo();
  const map = sim.curMap || [0, 1, 2, 3];
  const isMe = (seat) => sim.lu?.seats[map[seat]]?.key === "you";
  const seats = info.players.map((p) => `<span class="lb-ws${isMe(p.id) ? " me" : ""}${final != null && p.id === final ? " won" : ""}" style="--seat:${view.players[p.id]?.color || p.color}" title="${esc(sim.lu?.seats[map[p.id]]?.label || "")}"><i></i>${p.vp}</span>`).join("");
  const head = final === null ? `Turn ${info.turn}` : final < 0 ? "No winner" : `${sim.lu?.seats[map[final]]?.label || "?"} wins`;
  if (!el.querySelector(".lb-winfo")) el.innerHTML = `<span class="lb-winfo"></span><button type="button" class="lb-wstop" aria-label="Stop the tournament">Stop</button>`;
  el.querySelector(".lb-winfo").innerHTML = `<b>Game ${sim.game}/${sim.n}</b><span class="lb-wt">${esc(head)}</span><span class="lb-wseats">${seats}</span>`;
  el.hidden = false;
  document.querySelectorAll(".lb-read, .lb-tools").forEach((x) => x.classList.add("lb-faded"));
}

async function runTournament(over = {}) {
  if (sim.running) { sim.running = false; return sim; }
  const frame = $("#labSim");
  if (!frame.src) frame.src = "./index.html?lab=sim";
  const cfg = { n: st.games, tboard: st.tboard, tseats: st.tseats, ...over };
  const lu = lineupNow();
  Object.assign(sim, { running: true, n: cfg.n, done: 0, errors: 0, game: 0, restore: true, results: [], lu, cfg, curMap: null });
  $("#labSummary").hidden = true;
  renderTournamentSetup();
  renderStand();
  const g = await waitEngine(frame);
  let saved = null; // your board while games are watched
  const watchOn = () => st.speed === "watch" && !!view;
  try {
    for (let i = 0; i < cfg.n && sim.running; i += 1) {
      sim.game = i + 1;
      const map = seatMap(i, cfg);
      sim.curMap = map;
      try {
        g._labSimStart(map.map((li) => lu.seats[li].strat), { players: 4, map: cfg.tboard, seed: SEED0 + i * 7919 });
        let r = { done: false }, shown = false;
        do {
          if (watchOn()) {
            if (!saved) {
              saved = view.serializeState(); sim.watching = true;
              const br = $(".lb-board").getBoundingClientRect();
              if (br.top < 100 || br.bottom > innerHeight) $(".lb-board").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            }
            if (!shown) { view._labWatch(g, true); shown = true; }
            else { r = g._labSimStep(1); view._labWatch(g); }
            renderWatch(g);
            await sleep(TURN_MS);
          } else {
            if (sim.watching) renderWatch(null);
            r = g._labSimStep(25);
            await sleep(0); // let the page breathe between chunks
          }
        } while (!r.done && sim.running);
        if (!r.done) break;
        const info = g._labSimInfo();
        sim.results.push({ map, winner: r.winner, turns: r.turns, vp: info.players.map((p) => p.vp) });
        sim.done += 1;
        renderStand();
        renderTournamentSetup();
        if (watchOn() && sim.running) { view._labWatch(g); renderWatch(g, r.winner ?? -1); await sleep(i + 1 < cfg.n ? 900 : 1400); }
      } catch (e) { sim.errors += 1; console.error("tournament game failed", e); }
    }
  } finally {
    sim.running = false;
    sim.watching = false;
    renderWatch(null);
    if (saved && sim.restore) {
      view.loadFromStorage(saved);
      view._labAfterLoad(true);
      applyHand();
    }
    if (sim.results.length) {
      const me = stats(sim.results, lu).find((e) => e.key === "you");
      hist.push({ no: (hist[hist.length - 1]?.no || 0) + 1, label: lu.entries[0].label === "Bot A" ? "Bot A" : "Your bot", desc: myBotDesc(), vs: vsText(), vsKey: `${st.lineup}:${st.lineup === "h2h" ? st.botB : st.opp.join(",")}`,
        kind: st.lineup, n: me.n, p: me.p, lo: me.lo, hi: me.hi, fair: me.fair, col: me.col, strat: lu.seats[0].strat, board: cfg.tboard, tseats: cfg.tseats });
      while (hist.length > 12) hist.shift();
      put(HKEY, hist, sessionStorage);
    }
    renderSummary();
    renderStand(true);
    renderHist();
    renderTournamentSetup();
    update();
  }
  const all = sim.lu ? stats(sim.results, sim.lu) : [];
  return { ...sim, stats: all, wins: all.find((e) => e.key === "you")?.wins ?? 0 };
}

function setPane(p) {
  st.pane = p;
  document.body.dataset.pane = p;
  document.querySelectorAll("#labPanes button").forEach((b) => { const on = b.dataset.pane === p; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $("#paneAnalysis").hidden = p !== "analysis";
  $("#paneTournament").hidden = p !== "tournament";
  if (view && !sim.watching) { view.analysis.lab = p === "analysis" ? view.analysis.lab : null; if (p === "analysis") update(); else view.requestBoardDraw(); }
  save();
}

(async () => {
  const frame = $("#labView");
  view = await waitEngine(frame);
  H = view.constructor.labHelpers;
  if (!st.strat || !DIMS.every(([k]) => H.AI_STRATEGY_CATEGORIES[k].levels.includes(st.strat[k]))) st.strat = { ...H.AI_PRESETS[st.preset] || H.AI_PRESETS.intermediate };
  st.preset = presetOf(st.strat);
  if (!Array.isArray(st.opp) || st.opp.length !== 3 || !st.opp.every((p) => PRESETS.includes(p))) st.opp = ["intermediate", "intermediate", "intermediate"];
  if (!PRESETS.includes(st.botB)) st.botB = "expert";
  if (![10, 20, 50, 100].includes(Number(st.games))) st.games = 20;
  W = Object.fromEntries(Object.entries(W).filter(([k, v]) => H.AI_WEIGHT_KEYS.includes(k) && Number.isFinite(v) && v >= 0 && v <= 2));
  bindBoardTools(frame);
  $("#labNew").addEventListener("click", () => { if (st.map === "game") st.map = "random"; newBoard(); });
  $("#labSeed").value = st.seed;
  $("#labSeed").addEventListener("change", () => { st.seed = Number($("#labSeed").value) || 0; newBoard(); });
  $("#labRun").addEventListener("click", () => runTournament());
  $("#labWatch").addEventListener("click", (e) => { if (e.target.closest(".lb-wstop")) sim.running = false; });
  $("#labTree").addEventListener("click", onTreeTap);
  $("#labCalcBtn").addEventListener("click", () => { const el = $("#labCalc"); el.hidden = !el.hidden; if (!el.hidden) renderCalc(); renderCalcHead(); });
  document.querySelectorAll("#labPanes button").forEach((b) => b.addEventListener("click", () => setPane(b.dataset.pane)));
  $("#labPanes").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const p = st.pane === "analysis" ? "tournament" : "analysis";
    setPane(p); $(`#labPanes [data-pane="${p}"]`).focus();
  });
  setPane(st.pane === "tournament" ? "tournament" : "analysis");
  await newBoard();
  renderHist();
  window.__lab = { ready: true, st, W: () => W, runTournament, runGames: (n) => runTournament({ n }), newBoard, update, view: () => view, sim, hist, tree, setPane, myBot };
})();
