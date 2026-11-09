// AI Lab (lab.html), v0.87: two modes. (v0.88: the heatmap opens on what fits the board: Next build once set-up is over.)
// v0.89: Next build shows reach as a quiet extra layer (rings = roads needed, × = out of reach, a flag where a
// rival is as close) with a "Spots in reach" list (+roads · ~turns); a tap on a row or spot shows its road route.
//  Analysis   — pick a board, drop pieces or load your game, tune "Your bot" (preset, five dimensions and the
//               Calculation weights) and see how it scores the board (heatmap) and how it decides (decision
//               tree: options → candidates → each score split into terms, the chosen path marked).
//  Tournament — Your bot vs a field of presets, or head-to-head A vs B (two seats each), 10-100 games with
//               seats rotated and common random boards (game i uses the same seed in every run), watched on
//               the board or instant; live standings with 95% bands, a results summary and a session history
//               that compares runs.
// The game runs in two iframes in lab mode (index.html?lab=view draws the board, ?lab=sim plays the
// headless games in short chunks so the page stays responsive). Lab mode never writes the saved game.

import { stepStripHtml, stepCardHtml, stackHtml, TERM_COLOR, masterSteps, masterLineHtml } from "./ai-tree.js?v=124";
import { masterRequest, masterAvailable, MASTER_BUDGET, budgetFor } from "./master.js?v=124";
import { BOT_PROFILES, profileMini, levelFrame } from "./bot-profiles.js?v=124";
import { drawSeats, seatKeys, aggregate, verdict, compareRuns } from "./lab-stats.js?v=124";

const $ = (s) => document.querySelector(s);
const KEY = "colonist.lab";
const WKEY = "colonist.lab.w";      // Calculation weights: this browser session only
const DIMS = [["placement", "Placement"], ["expansion", "Expansion"], ["trading", "Trading"], ["devCards", "Dev Cards"], ["awareness", "Awareness"]];
const PRESETS = ["beginner", "simple", "intermediate", "expert", "builder", "trader", "shark", "master"]; // v0.87: + Simple (rulebook bot); v0.90: + Master (search)
const MODES = [["setup", "Start spots"], ["build", "Next build"], ["robber", "Robber"]];
const TOOLS = [["pan", "Move"], ["settlement", "Town"], ["city", "City"], ["road", "Road"], ["robber", "Robber"], ["erase", "Erase"]];
const MAPS = [["random", "Random"], ["balanced", "Balanced"], ["seed", "Seed"], ["game", "My game"]];
const PLAYERS = [["4", "4"], ["6", "6"], ["sea", "Seafarers"]];
const PIECES = [["start", "Bots' start"], ["none", "Empty"]];
const HANDS = [["keep", "As is"], ["0", "Empty"], ["1", "1 each"], ["3", "3 each"]];
const SPEEDS = [["watch", "Watch"], ["instant", "Instant"]];
const TBOARDS = [["random", "Random"], ["balanced", "Balanced"]];
// The Calculation weights (multipliers on the bot's own score terms, see AI_WEIGHT_KEYS in game.js)
const WEIGHTS = [
  ["Placement", [["num", "Number strength", "value of 6 / 8 over 2 / 12"], ["variety", "Resource variety", "bonus per different resource"], ["scarcity", "Scarcity", "resources it lacks or the board lacks count more"]]],
  ["Trading", [["port", "Port value", "3:1 and matching 2:1 harbours"], ["margin", "Deal margin", "gain needed to accept a deal (8%, Eager 3%)", true]]],
  ["Expansion", [["road", "Road distance", "penalty per road to reach a spot"], ["prod", "Production vs points", "long-term income against a VP now"], ["patience", "Patience", "wait for a bigger build vs build now"]]],
  ["Dev cards", [["card", "Card value", "what one card is worth (0.85 points)"]]],
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
  tseatN: 4, seats: ["expert", "intermediate", "intermediate", "intermediate"], distinct: false, mix: null, games: 100, tboard: "random", tseats: "rotate",
  ...(store(KEY) || {}),
};
if (st.speed === "fast") st.speed = "watch"; // v0.83-0.86 name
let W = store(WKEY, sessionStorage) || {}; // changed weights only ({} = defaults)
const save = () => { const { strat, ...rest } = st; put(KEY, { ...rest, strat: strat && { ...Object.fromEntries(DIMS.map(([k]) => [k, strat[k]])), ...(strat.policy ? { policy: strat.policy } : {}) }, tool: "pan" }); };
const saveW = () => put(WKEY, W, sessionStorage);

let view = null; // the board game instance (iframe)
let H = null;    // its bot tables (presets, level names)
const tree = { open: new Set(), closed: new Set(), sel: null, data: null, mode: null, view: "tree" };
// v0.88: the heatmap's default follows the board. Set-up is over when every seat has its 2 start pieces
// (settlements or cities). The default is re-chosen when the board changes (new board, or set-up turns
// over / back by placing or erasing); a mode the user picked stays while the board stays in that state.
let boardGen = 0, modeSig = null, modePicked = null;
const setupOver = () => !!view?.players?.length && view.players.every((p) => p.settlements.size + p.cities.size >= 2);
function autoMode() {
  if (!view || sim.watching) return;
  const sig = `${boardGen}:${setupOver()}`;
  if (sig === modeSig) return;
  modeSig = sig;
  if (modePicked !== sig) st.mode = setupOver() ? "build" : "setup";
}

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
  const m = PRESETS.find((p) => DIMS.every(([k]) => H.AI_PRESETS[p][k] === strat[k]) && (H.AI_PRESETS[p].policy || "score") === (strat.policy || "score"));
  return m || "custom";
}
const changedW = () => Object.keys(W).filter((k) => W[k] != null && W[k] !== 1);
/** Your bot: the five dimensions plus the changed Calculation weights (none: no `w`, the exact default). */
const isRules = () => st.strat?.policy === "rules";
function myBot() {
  const s = Object.fromEntries(DIMS.map(([k]) => [k, st.strat[k]]));
  if (isRules()) return { ...s, policy: "rules" }; // Simple: a rulebook, no weights
  if (st.strat.policy) s.policy = st.strat.policy; // v0.91: keep "master" (Your bot as Master used to play as the Expert)
  const ch = changedW();
  if (ch.length) s.w = Object.fromEntries(ch.map((k) => [k, W[k]]));
  return s;
}
const mixable = () => st.preset === "custom" || (changedW().length > 0 && !isRules());
const myBotDesc = () => `${presetLabel(st.preset)}${changedW().length && !isRules() ? ` · ${changedW().length} weight${changedW().length > 1 ? "s" : ""}` : ""}`;

// ── Analysis ─────────────────────────────────────────────────────────────
function renderControls() {
  seg($("#labMode"), MODES, st.mode, "mode", (v) => { st.mode = v; modePicked = modeSig; tree.sel = null; update(); });
  const presetItems = PRESETS.map((p) => [p, H.AI_PRESET_INFO[p].label]);
  if (st.preset === "custom") presetItems.push(["custom", "Custom"]);
  seg($("#labPreset"), presetItems, st.preset, "preset", (v) => { if (v === "custom") return; st.preset = v; st.strat = { ...H.AI_PRESETS[v] }; update(); });
  $("#labDims").hidden = isRules(); // Simple: a rulebook, the five dials don't apply
  $("#labDims").innerHTML = DIMS.map(([k, l]) => `<div class="lb-row lb-dim"><span title="${esc(H.AI_STRATEGY_CATEGORIES[k].descriptions[st.strat[k]])}">${l}</span><div class="lb-seg" data-dim="${k}" role="radiogroup" aria-label="${l}"></div></div>`).join("");
  DIMS.forEach(([k]) => seg($(`[data-dim="${k}"]`), H.AI_STRATEGY_CATEGORIES[k].levels.map((lv) => [lv, levelLabel(lv)]), st.strat[k], "lv", (v) => {
    st.strat = { ...st.strat, [k]: v };
    delete st.strat.policy; // a dial makes Simple a scoring bot again
    st.preset = presetOf(st.strat);
    update();
  }));
  renderCalcHead();
  $("#labMixRow").hidden = !(mixable() || st.mix);
  $("#labMixBtn").textContent = mixable() ? (st.mix ? "Update Custom mix" : "Save as Custom mix") : "Remove Custom mix";
  $("#labMixSt").textContent = st.mix ? "Custom mix saved" : "";
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
  return xfmt(m); // v0.87 review: every weight reads as a multiplier (the subtitle names the base value)
  // eslint-disable-next-line no-unreachable
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
  document.querySelector(".lb-calc").hidden = isRules(); // Simple: no weights at all
  $("#labCalcSt").innerHTML = isRules() ? "not used by Simple (no scores)" : n ? `<button type="button" class="lb-link" id="labReset">Reset</button> · ${n} changed` : "default weights";
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
  autoMode();
  save();
  renderControls();
  renderLegend();
  if (!view || sim.watching) return; // the board shows a tournament game: your board (and its scores) come back afterwards
  if (!view.players[st.seat]) st.seat = view.players.length > 1 ? 1 : 0;
  if (st.pane !== "analysis") { view.analysis.lab = null; view.requestBoardDraw(); return; } // Tournament: a clean board
  const r = view._labExplain(st.mode, st.seat, myBot());
  const p = view.players[st.seat];
  const out = $("#labResult");
  $(".lb-treecard").style.setProperty("--seat", p.color);
  out.style.setProperty("--seat", p.color);
  renderTree(r?.tree || null, p);
  reach.spots = null;
  if (!r) { out.innerHTML = `<p class="lb-note">Nothing to score here.</p>`; renderLegend(); return; }
  // v0.88: Start spots on a board past set-up stays available, but says what it is
  const late = st.mode === "setup" && setupOver() ? `<p class="lb-note lb-late">Set-up is over on this board. These are scores as if you could still place a start settlement.</p>` : "";
  if (r.rules) { // Simple: its checklist, the rule that fired lit
    out.innerHTML = `${late}<div class="lb-rhead"><i class="lb-dot" style="background:${p.color}"></i><b>${esc(p.name)} · ${esc(r.title)}</b></div>
      <p class="lb-note">${esc(r.note || "")} · the checklist below shows every rule it checked.</p>`;
    renderLegend();
    return;
  }
  // v0.88: only the dimensions that add to this score (set-up: placement + ports; robber: awareness)
  const used = DIMS.map(([k, l]) => [l, r.dims?.[k] || 0]).filter(([, v]) => Math.abs(v) >= 0.005); // two decimals, like the score they add up to
  const unused = DIMS.map(([, l]) => l).filter((l) => !used.some(([u]) => u === l));
  const max = Math.max(0.5, ...used.map(([, v]) => Math.abs(v)));
  out.innerHTML = `${late}<div class="lb-rhead"><i class="lb-dot" style="background:${p.color}"></i><b>${esc(p.name)} · ${esc(r.title)}</b><span class="lb-sc" title="${UNIT}">${r.fmt === "int" ? `${Math.round(r.score)} pips` : f2(r.score)}</span></div>
    ${used.length ? `<div class="lb-bars" title="${UNIT}${unused.length ? ` · not part of this score: ${unused.join(", ")}` : ""}">${used.map(([l, v]) => `<span class="lb-d"><span class="l">${l}</span><span class="bar${v < 0 ? " neg" : ""}"><i style="width:${Math.round((Math.abs(v) / max) * 100)}%;background:${v < 0 ? "" : p.color}"></i></span><span class="v">${f2(v)}</span></span>`).join("")}</div>` : ""}
    ${r.note ? `<p class="lb-note">${esc(r.note)}</p>` : ""}
    ${r.alts?.length ? `<div class="lb-alts" title="Next best (${UNIT})">${r.alts.map((a, i, all) => { const dup = all.filter((x) => x.label === a.label).length > 1 ? ` (${all.slice(0, i + 1).filter((x) => x.label === a.label).length})` : "";
      return `<span><b>${r.fmt === "int" ? Math.round(a.score) : f2(a.score)}</b> ${esc(a.label.replace(/ \(\+(\d) roads?\)/, " +$1r"))}${dup}</span>`; }).join("")}</div>` : ""}
    ${spotListHtml(r)}`;
  reach.spots = r.spots || null;
  if (reach.sel != null && !(r.spots || []).some((x) => x.id === reach.sel)) reach.sel = null;
  if (reach.sel != null) view._labRoute(reach.sel, st.seat);
  renderLegend();
  masterUpdate(p);
}

// ── v0.90 Master: the Expert's decision above, then the worker's search on the same position: a one-line
// verdict here, and the Race + Verdict steps appended to Step by step ──
const isMaster = () => st.strat?.policy === "master";
const ms = { token: 0, sig: null, rec: null, none: false, timer: 0, looking: false };
function masterSig() {
  const s = view.serializeState();
  return JSON.stringify([st.mode, st.seat, s.nodes, s.edges, s.robberHexId, s.players.map((q) => [q.resources, q.devCards]), myBot()]);
}
function masterBlock() {
  const el = $("#labResult");
  el.querySelector(".lb-master")?.remove();
  if (!isMaster()) return;
  const html = ms.rec ? `${masterLineHtml(ms.rec)}<small>Step by step shows the race and the verdict.</small>`
    : ms.none ? `<span class="mv-line"><b>Master</b>: only one sensible move here, so it plays the Expert's step (no search).</span><button type="button" class="lb-btn lb-contest" data-contest>${ms.looking ? "Looking for one…" : "Find a contested move"}</button>`
      : masterAvailable() ? `<span class="mv-line"><b>Master</b> is searching (about ${MASTER_BUDGET.timeMs / 1000} s)…</span>` : `<span class="mv-line"><b>Master</b> needs Web Workers: here it plays as the Expert.</span>`;
  el.insertAdjacentHTML("beforeend", `<div class="lb-master" aria-live="polite">${html}</div>`);
}
/** v0.91: look for a position where the race really runs: every seat of this board, then new boards (with
 *  "1 each" in hand after a few, so there is more to choose between). */
async function findContested() {
  if (ms.looking) return;
  ms.looking = true; masterBlock();
  const kind = st.mode === "build" ? "main" : st.mode;
  const startHand = st.hand;
  try {
    for (let b = 0; b < 10; b++) {
      if (b) { if (b === 3 && st.hand === "keep") st.hand = "1"; await newBoard(); }
      const seats = view.players.map((p) => p.id);
      for (const seat of seats) {
        st.seat = seat; applyHand();
        view.players[seat].strategy = myBot();
        const m = await masterRequest({ type: "decide", kind, state: view.serializeState(), trk: null, turnSerial: view.turnSerial || 0, seat, opts: { ...MASTER_BUDGET }, lab: true });
        if (m?.record && m.record.K >= (b < 6 ? 3 : 2)) { ms.looking = false; ms.sig = null; tree.sel = null; update(); return true; }
      }
    }
  } finally { ms.looking = false; }
  if (st.hand !== startHand) { st.hand = startHand; applyHand(); }
  update();
  return false;
}
function masterApply(p) {
  if (!ms.rec || !tree.data?.steps || tree.data.masterDone) return;
  tree.data.steps = masterSteps(tree.data.steps, ms.rec, p.name);
  tree.data.masterDone = true;
  if (tree.view === "steps") renderSteps(tree.data);
}
function masterUpdate(p) {
  if (!isMaster() || st.pane !== "analysis" || !view || sim.watching) { ms.sig = null; return; }
  const sig = masterSig();
  if (sig === ms.sig) { masterBlock(); masterApply(p); return; }
  ms.sig = sig; ms.rec = null; ms.none = false;
  masterBlock();
  clearTimeout(ms.timer);
  const token = ++ms.token;
  ms.timer = setTimeout(() => {
    masterRequest({ type: "decide", kind: st.mode === "build" ? "main" : st.mode, state: view.serializeState(), trk: null, turnSerial: view.turnSerial || 0, seat: st.seat, opts: { ...MASTER_BUDGET }, lab: true })
      .then((m) => {
        if (token !== ms.token) return;
        if (m && m.record) ms.rec = m.record; else ms.none = true;
        masterBlock();
        masterApply(view.players[st.seat]);
      });
  }, 150);
}

// ── v0.89 reach: the spots in reach as a list (same scores as the board's pills, + roads and turns); a tap on
// a row or on the spot on the board shows its whole road route, numbered in build order ──
const reach = { spots: null, sel: null };
const FLAG = (c) => `<svg class="lb-flag" viewBox="0 0 11 14" aria-hidden="true"><path d="M2 13V2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2.6 2 10.5 5 2.6 8Z" fill="${c}"/></svg>`;
function spotListHtml(r) {
  const all = r.spots || [];
  if (!all.length) return "";
  const dec = r.dec || 1;
  // the best four by rank, plus a flagged spot among the top six (a race the bot doesn't see)
  const rows = [...all.slice(0, 4), ...all.slice(4, 6).filter((x) => x.rival)].slice(0, 5);
  return `<div class="lb-reach"><div class="lb-reachh"><b>Spots in reach</b><small>${all.length} spot${all.length > 1 ? "s" : ""} · tap one for its roads</small></div>
    <p class="lb-fine lb-rscale">Pill = spot rank: how good the corner is (numbers, resources, harbour) minus a cost per road. It picks which spots get planned; the plan score above (${r.score != null ? f2(r.score) : "–"}) is a build's value per turn, a different scale.</p>
    ${rows.map((x) => `<button type="button" class="lb-rrow${reach.sel === x.id ? " sel" : ""}" data-spot="${x.id}" aria-pressed="${reach.sel === x.id}"><span class="lb-rsc">${x.h.toFixed(dec)}</span><span class="lb-rw"><span class="lb-r1"><b>Spot ${esc(x.label)}</b>${x.id === r.planNode ? `<span class="lt-tag plan">plan</span>` : ""}<span class="lb-rm">${esc(x.text)}</span></span>${x.rival ? `<small class="lb-riv" style="--rc:${x.rivalColor}">${FLAG(x.rivalColor)}${esc(x.rivalText)}</small>` : ""}</span></button>`).join("")}
    ${rows.some((x) => x.rival) ? `<p class="lb-fine lb-rfoot">Flag: a rival needs fewer roads to this spot (on a tie this bot builds first, as it is the one deciding now). Expert doesn't account for this.</p>` : ""}
  </div>`;
}
function selectSpot(id) {
  reach.sel = reach.sel === id ? null : id;
  view._labRoute(reach.sel, st.seat);
  document.querySelectorAll("#labResult .lb-rrow").forEach((b) => { const on = Number(b.dataset.spot) === reach.sel; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", String(on)); });
}
/** One line under the board: what the rings, × and flags mean (only while they are on the board). */
function renderLegend() {
  const el = $("#labLegend");
  // (Step by step: the pinned board keeps one height; the "spots in reach" step card says what the marks mean)
  const stepping = tree.view === "steps" && document.body.classList.contains("lb-stepping");
  const on = st.pane === "analysis" && st.mode === "build" && !sim.watching && !stepping && !!reach.spots?.length;
  el.hidden = !on;
  if (!on) return;
  const ring = (dash, w = 1.6) => `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}" stroke-linecap="round"` : ""}/></svg>`;
  el.innerHTML = `<span>Ring:</span><span>${ring("")}0</span><span>${ring("3 2")}1</span><span>${ring("0.01 3.2", 2)}2+ roads</span><span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>out of reach</span><span>${FLAG("var(--lb-flag, #E8873A)")}rival closer</span>`;
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
  else if (vt === "pips") val = `${Math.round(v)} pips`;
  else if (vt === "none") val = "";
  const col = n.term && TERM_COLOR[n.tk] ? `;background:${TERM_COLOR[n.tk]};opacity:.9` : "";
  const bar = n.stack?.length && siblingsMax > 0 ? stackHtml(n.stack, siblingsMax).replace("sx-bar stk", "lt-bar stk")
    : Number.isFinite(n.bar) && siblingsMax > 0 ? `<span class="lt-bar${n.bar < 0 ? " neg" : ""}"><i style="width:${Math.max(3, Math.round((Math.abs(n.bar) / siblingsMax) * 100))}%${n.bar < 0 ? "" : col}"></i></span>` : `<span class="lt-bar"></span>`;
  const wv = n.w ? (W[n.w] ?? 1) : null;
  const chip = n.w ? `<span class="lt-w${wv !== 1 ? " chg" : ""}" title="${esc(WNAME[n.w])} slider">${esc(WSHORT[n.w])} ${xfmt(wv)}</span>` : "";
  const tagTxt = { chosen: "chosen", plan: "plan", now: "does now", first: "first" }[n.tag];
  const tag = tagTxt ? `<span class="lt-tag ${n.tag}">${tagTxt}</span>` : "";
  const cls = ["lt-row", n.chosen ? "pick" : "", n.off ? "off" : "", n.term ? "lt-term" : "", tree.sel === n.id ? "sel" : "", !kids.length && !n.focus ? "static" : ""].filter(Boolean).join(" ");
  const label = `${n.label}${n.sub ? `, ${n.sub}` : ""}${val ? `, ${val}` : ""}${tagTxt ? `, ${tagTxt}` : ""}`;
  const chev = n.rule ? `<span class="lt-ok ${n.ok ? "y" : n.ok === false ? "n" : "q"}" aria-hidden="true">${n.ok ? "✓" : n.ok === false ? "✗" : "·"}</span>` : `<span class="lt-chev">${CHEV}</span>`;
  rows.push(`<div class="${cls}${n.rule ? " lt-rule" : ""}" role="treeitem" aria-level="${depth + 1}"${kids.length ? ` aria-expanded="${isOpen}"` : ""} style="--ind:${depth * 13}px"><span></span>${chev}<span class="lt-l"><span class="lt-n">${esc(n.label)}</span>${tag}${chip}${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</span>${bar}<span class="lt-v">${esc(val)}</span><button type="button" class="lt-hit" data-tid="${esc(n.id)}" aria-label="${esc(label)}"></button></div>`);
  if (isOpen) {
    const mx = Math.max(0, ...kids.map((c) => (Number.isFinite(c.bar) ? Math.abs(c.bar) : 0)));
    kids.forEach((c) => treeRows(c, depth + 1, rows, mx));
  }
}
function findNode(n, id) { if (!n) return null; if (n.id === id) return n; for (const c of n.children || []) { const x = findNode(c, id); if (x) return x; } return null; }
function renderTree(t, p) {
  if (tree.mode !== st.mode) { tree.open.clear(); tree.closed.clear(); tree.sel = null; tree.mode = st.mode; steps.cur = 0; steps.sel = null; stopPlay(); }
  tree.data = t;
  $(".lb-treecard h2").textContent = t?.rules ? (st.mode === "build" ? "Rulebook" : "Why this move (rule)") : "Why this move";
  seg($("#labTreeView"), [["tree", t?.rules && st.mode === "build" ? "Checklist" : "Tree"], ["steps", "Step by step"]], tree.view, "tv", (v) => { tree.view = v; steps.cur = 0; steps.sel = null; stopPlay(); renderTree(tree.data, view.players[st.seat]);
    if (v === "steps") requestAnimationFrame(keepCardInView); });
  if (tree.view === "steps") { renderSteps(t); return; }
  $("#labSteps").hidden = true; $("#labTree").hidden = false; $("#labTreeSum").hidden = false; $("#labTreeEq").hidden = false;
  setStepping(false);
  renderLegend();
  if (view?.analysis.lab?.kind === "step") view._labOverlay(null);
  $("#labTreeWho").textContent = p ? `${p.name} · tap a row` : "";
  if (!t) { $("#labTree").innerHTML = `<p class="lb-note">Nothing to decide here.</p>`; $("#labTreeSum").textContent = ""; $("#labTreeEq").textContent = ""; return; }
  const sc = t.score == null || t.noScore ? "" : t.rules ? ` · <b>${Math.round(t.score)} pips</b>` : ` · score <b>${f2(t.score)}</b>${st.mode === "build" ? " per turn" : ""}`;
  const plan = st.mode === "build" && t.target && !t.action.includes(t.target) ? ` · plan <b>${esc(t.target)}</b>` : "";
  $("#labTreeSum").innerHTML = `${t.rules && st.mode === "build" ? "Fires" : st.mode === "build" ? "Now:" : "Chooses"} <b>${esc(t.action)}</b>${plan}${sc}`;
  $("#labTreeEq").textContent = t.eq || "";
  const rows = [];
  treeRows(t.root, 0, rows, 0);
  $("#labTree").innerHTML = rows.join("");
  view?._labFocus(tree.sel ? findNode(t.root, tree.sel)?.focus || null : null);
}
// ── step through: the same decision as an ordered sequence. The board shrinks and stays on screen (sticky),
// a numbered strip under it shows where you are, ONE step card below; the board shows that step (letters on the
// candidates match the rows; tapping a row rings its candidate). ──
const steps = { cur: 0, timer: 0, sel: null };
function stopPlay() { clearInterval(steps.timer); steps.timer = 0; }
function stepOverlay(t) {
  const s = t?.steps?.[steps.cur];
  if (!s || !view) return;
  const row = steps.sel != null ? s.rows?.[steps.sel] : null;
  view._labOverlay({ ...(s.overlay || {}), ...(row?.focus ? { focus: row.focus } : {}) }, st.seat);
}
function setStepping(on) {
  document.body.classList.toggle("lb-stepping", on);
  $("#labStepStrip").hidden = !on;
}
function renderSteps(t) {
  $("#labTree").hidden = true; $("#labTreeSum").hidden = true;
  const el = $("#labSteps");
  el.hidden = false;
  const S = t?.steps || [];
  setStepping(S.length > 0 && st.pane === "analysis");
  if (!S.length) { el.innerHTML = `<p class="lb-note">No steps for this position.</p>`; $("#labStepStrip").innerHTML = ""; return; }
  steps.cur = Math.min(steps.cur, S.length - 1);
  $("#labTreeEq").hidden = ["race", "verdict"].includes(S[steps.cur].key); // v0.91: the score formula isn't what the search used
  $("#labStepStrip").innerHTML = stepStripHtml(S, steps.cur, "data-sg");
  alignStrip($("#labStepStrip .sx-strip"));
  renderLegend();
  el.innerHTML = `${stepCardHtml(S, steps.cur, steps.sel)}<div class="lb-snav"><button type="button" class="lb-btn" data-sn="prev"${steps.cur ? "" : " disabled"}>‹ Prev</button><button type="button" class="lb-btn" data-sn="play" aria-pressed="${!!steps.timer}">${steps.timer ? "Pause" : "Play"}</button><button type="button" class="lb-btn" data-sn="next"${steps.cur < S.length - 1 ? "" : " disabled"}>Next ›</button></div>`;
  stepOverlay(t);
}
/** v0.92: a strip wider than the screen scrolls by whole steps: the left edge always starts at a full step
 *  (no half-cut "1"), and the current one is fully visible. */
function alignStrip(strip) {
  const bs = strip ? [...strip.querySelectorAll("button")] : [];
  const c = bs.findIndex((b) => b.classList.contains("cur"));
  if (c < 0 || strip.scrollWidth <= strip.clientWidth + 1) { if (strip) strip.scrollLeft = 0; return; }
  const left = (b) => b.offsetLeft - bs[0].offsetLeft;
  let k = 0;
  while (k < c && left(bs[c]) + bs[c].offsetWidth - left(bs[k]) > strip.clientWidth) k++;
  strip.scrollLeft = left(bs[k]);
}
function goStep(i) {
  const t = tree.data;
  if (!t?.steps) return;
  steps.cur = Math.max(0, Math.min(t.steps.length - 1, i));
  steps.sel = null;
  renderSteps(t);
  keepCardInView();
}
/** The step card starts right under the pinned board (its height changes from step to step). */
function keepCardInView() {
  if (!document.body.classList.contains("lb-stepping") || matchMedia("(min-width: 900px)").matches) return;
  const under = $(".lb-boardcol").getBoundingClientRect().bottom;
  const top = $("#labSteps").getBoundingClientRect().top;
  if (Math.abs(top - under - 8) > 4) scrollBy({ top: top - under - 8, behavior: "auto" });
}
function onStepsTap(e) {
  const t = tree.data;
  if (!t?.steps) return;
  const g = e.target.closest("[data-sg]");
  if (g) { stopPlay(); goStep(Number(g.dataset.sg)); return; }
  const r = e.target.closest("[data-row]");
  if (r) { const i = Number(r.dataset.row); steps.sel = steps.sel === i ? null : i; renderSteps(t); $(`#labSteps [data-row="${i}"]`)?.focus({ preventScroll: true }); return; }
  const b = e.target.closest("[data-sn]");
  if (!b) return;
  if (b.dataset.sn === "prev") { stopPlay(); goStep(steps.cur - 1); }
  else if (b.dataset.sn === "next") { stopPlay(); goStep(steps.cur + 1); }
  else if (steps.timer) { stopPlay(); renderSteps(t); }
  else {
    if (steps.cur >= t.steps.length - 1) steps.cur = 0;
    steps.timer = setInterval(() => { if (steps.cur >= t.steps.length - 1) { stopPlay(); renderSteps(t); return; } goStep(steps.cur + 1); }, 2400);
    renderSteps(t);
  }
  $(`#labSteps [data-sn="${b.dataset.sn}"]`)?.focus({ preventScroll: true });
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
  boardGen += 1; // v0.88: a new board picks its own heatmap default
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
  // v0.89: with "Move", a tap (not a drag) on a spot in reach shows its road route (the game still pans)
  let down = null;
  w.addEventListener("pointerdown", (e) => { down = e.target === canvas ? { x: e.clientX, y: e.clientY } : null; }, { capture: true });
  w.addEventListener("pointerup", (e) => {
    if (st.tool !== "pan" || !down || st.pane !== "analysis" || st.mode !== "build" || sim.watching || e.target !== canvas) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || document.body.classList.contains("lb-stepping")) return;
    const id = view._labHitSpot(e.clientX, e.clientY);
    if (id != null) selectSpot(id);
  });
  w.addEventListener("pointerup", (e) => {
    if (st.tool === "pan" || st.pane !== "analysis" || e.target !== canvas) return;
    e.stopImmediatePropagation();
    if (sim.watching) return;
    if (view._labTap(e.clientX, e.clientY, st.tool, st.seat)) { tree.sel = null; update(); }
  }, { capture: true });
}

// ── Tournament ───────────────────────────────────────────────────────────
// v1.13: a free sandbox. 2-4 seats, each any preset (or Random: a different bot every game, drawn from a seeded
// stream so game i is the same line-up in every run), or the Custom mix you saved in Analysis (only then).
// Results are counted per bot PROFILE over every seat it played (src/lab-stats.js). Same boards and dice in every run.
const SEAT_COL = (i) => view?.players?.[i]?.color || ["#D1453A", "#3C75C6", "#F08A2E", "#2A8556"][i];
const P = BOT_PROFILES;
const DICE = `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/></svg>`;
const PEN = `<svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M2 11l7-7 3 3-7 7H2zM8 5l3 3"/></svg>`;
/** Presets a seat can pick, strongest first (a preset without a profile, e.g. a new one, comes first). */
function poolKeys() {
  const all = Object.keys(H.AI_PRESETS);
  return all.slice().sort((a, b) => (P[b]?.level ?? 6) - (P[a]?.level ?? 6) || all.indexOf(a) - all.indexOf(b));
}
const isSlow = (s) => s.policy === "master" || s.policy === "super"; // Master / Super Expert: they search, so the games run in the worker
const stratOf = (k) => (k === "mix" ? { ...st.mix } : { ...H.AI_PRESETS[k] });
const labelOf = (k) => (k === "mix" ? "Custom mix" : k === "random" ? "Random" : presetLabel(k));
const slowKey = (k) => (k === "mix" ? !!st.mix && isSlow(st.mix) : k !== "random" && !!H.AI_PRESETS[k] && isSlow(H.AI_PRESETS[k]));
const seatKey = (i) => { const k = st.seats[i]; return k === "random" || (k === "mix" && st.mix) || H.AI_PRESETS[k] ? k : "intermediate"; };
const seatSpec = () => Array.from({ length: st.tseatN }, (_, i) => seatKey(i));
function emblem(k, d = 40) {
  const key = k === "random" || k === "mix" ? "beginner" : P[k] ? k : "intermediate";
  const inner = k === "random" ? DICE : k === "mix" ? PEN : profileMini(key, Math.round(d * 0.55));
  return `<span class="lb-av" style="--d:${d}px">${levelFrame(key, d)}<span class="lb-em">${inner}</span></span>`;
}
const dotsHtml = (n) => `<span class="lb-dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const subOf = (k) => (k === "random" ? "draws a different bot every game" : k === "mix" ? "your mix from Analysis" : P[k] ? `${dotsHtml(P[k].level)} ${esc(P[k].tagline)}` : "");
const TPLS = [
  ["1v3", (n) => `1 vs ${n - 1}`, (n) => ["expert", ...Array(n - 1).fill("intermediate")], false],
  ["rr", () => "Round robin", (n) => ["expert", "builder", "trader", "shark"].slice(0, n), false],
  ["mirror", () => "Mirror", (n) => ["expert", "intermediate", "expert", "intermediate"].slice(0, n), false],
  ["rand", (n) => `${n} random bots`, (n) => Array(n).fill("random"), false],
  ["randd", () => "Random, all different", (n) => Array(n).fill("random"), true],
];
const tplOn = (t) => { const want = t[2](st.tseatN); return want.every((k, i) => k === seatKey(i)) && (want.includes("random") ? !!st.distinct === t[3] : true); };
const GAMES_ALLOWED = [20, 50, 100, 200];

function specTitle(spec, distinct) {
  if (spec.every((k) => k === "random")) return `${spec.length} random bots${distinct ? ", all different" : ""}`;
  const g = [];
  spec.forEach((k) => { const x = g.find((y) => y.k === k); if (x) x.c += 1; else g.push({ k, c: 1 }); });
  return g.map((x) => `${x.c > 1 ? `${x.c}× ` : ""}${labelOf(x.k)}`).join(" vs ");
}
const MKEY = "colonist.lab.masterMs";
function renderTournamentSetup() {
  if (!H) return;
  const n = st.tseatN, spec = seatSpec();
  if (sim.running) { // during a run only the button, the progress and Speed change (redrawing could swallow a tap)
    $("#labRun").textContent = `Stop (${sim.done}/${sim.n})`; $("#labRun").classList.add("stop");
    document.querySelectorAll("#paneTournament .lb-tsetup button:not(#labRun):not([data-speed]):not(.lb-ii)").forEach((b) => { b.disabled = true; });
    document.querySelectorAll("#labSpeed button").forEach((b) => { const on = b.dataset.speed === st.speed; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
    return;
  }
  seg($("#labNSeats"), [[2, "2"], [3, "3"], [4, "4"]], st.tseatN, "ns", (v) => { st.tseatN = Number(v); save(); renderTournamentSetup(); });
  $("#labTpl").innerHTML = TPLS.map((t) => `<button type="button" class="lb-chip${tplOn(t) ? " on" : ""}" data-tpl="${t[0]}">${esc(t[1](n))}</button>`).join("");
  $("#labTpl").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const t = TPLS.find((x) => x[0] === b.dataset.tpl);
    const seats = t[2](n); st.seats = [...seats, ...st.seats.slice(seats.length)]; st.distinct = t[3]; save(); renderTournamentSetup();
  }));
  $("#labSeatsT").innerHTML = spec.map((k, i) => `<button type="button" class="lb-tseat" data-seat="${i}" style="--seat:${SEAT_COL(i)}" aria-label="Seat ${i + 1}: ${esc(labelOf(k))}. Change"><i></i>${emblem(k, 40)}<b>${esc(labelOf(k))}<small>${subOf(k)}</small></b>${CHEV}</button>`).join("");
  $("#labSeatsT").querySelectorAll("[data-seat]").forEach((b) => b.addEventListener("click", () => openPick(Number(b.dataset.seat))));
  const rands = spec.filter((k) => k === "random").length;
  $("#labDistinctRow").hidden = rands < 2;
  $("#labDistinct").setAttribute("aria-checked", String(!!st.distinct));
  $("#labDistinct").classList.toggle("on", !!st.distinct);
  seg($("#labGames"), GAMES_ALLOWED.map((g) => [g, String(g)]), String(st.games), "g", (v) => { st.games = Number(v); save(); renderTournamentSetup(); });
  seg($("#labTBoard"), TBOARDS, st.tboard, "tb", (v) => { st.tboard = v; save(); renderTournamentSetup(); });
  const rot = st.tseats === "rotate";
  $("#labTSeats").setAttribute("aria-checked", String(rot)); $("#labTSeats").classList.toggle("on", rot);
  seg($("#labSpeed"), SPEEDS, st.speed, "speed", (v) => { st.speed = v; save(); renderTournamentSetup(); });
  const mayBeSlow = spec.some((k) => k === "random" ? poolKeys().some(slowKey) : slowKey(k));
  $("#labWatchNote").hidden = !mayBeSlow;
  $("#labRun").textContent = `Start ${st.games} games`; $("#labRun").classList.remove("stop");
  const ms = store(MKEY, sessionStorage);
  const tot = ms ? (ms * st.games) / 1000 : 0;
  $("#labRunNote").textContent = [mayBeSlow ? (masterAvailable() ? "Master and Super Expert seats are slower (Super about 3 s per move), so such games add minutes." : "Master and Super Expert need Web Workers: here they play as the Expert.") : "",
    ms ? `About ${tot < 90 ? `${Math.max(1, Math.round(tot))} s` : `${Math.round(tot / 60)} min`} (from your last run).` : ""].filter(Boolean).join(" ");
}

// the bot picker (a sheet): Random on top, then every preset, strongest first; the Custom mix only when one was saved
let pickSeat = 0;
function openPick(i) {
  pickSeat = i;
  const cur = seatKey(i);
  const opt = (k, name, sub, right) => `<button type="button" class="lb-opt${k === cur ? " on" : ""}" data-k="${k}" role="radio" aria-checked="${k === cur}">${emblem(k, 34)}<span><b>${esc(name)}</b><small>${sub}</small></span>${right || ""}</button>`;
  $("#labPickT").textContent = `Seat ${i + 1}: pick a bot`;
  $("#labPickList").innerHTML = opt("random", "Random", "draws a different bot every game")
    + poolKeys().map((k) => opt(k, presetLabel(k), esc(P[k]?.tagline || ""), P[k] ? dotsHtml(P[k].level) : "")).join("")
    + (st.mix ? opt("mix", "Custom mix", "saved in Analysis") : "");
  $("#labPickList").querySelectorAll(".lb-opt").forEach((b) => b.addEventListener("click", () => {
    st.seats[pickSeat] = b.dataset.k; save(); closePick(); renderTournamentSetup();
  }));
  const d = $("#labPick");
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}
function closePick() { const d = $("#labPick"); if (d.close) d.close(); else d.removeAttribute("open"); }

const sim = { n: 20, done: 0, running: false, game: 0, errors: 0, watching: false, restore: true, results: [], cfg: null, curKeys: null, saved: false };
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const band = (lo, hi, p, fair) => `<div class="lb-band bar" aria-hidden="true"><span style="left:${lo * 100}%;width:${(hi - lo) * 100}%"></span><u style="left:${fair * 100}%"></u><em style="left:calc(${p * 100}% - 1.5px)"></em></div>`;
const aggRows = () => aggregate(sim.results, labelOf);
const half = (r) => Math.round(((r.hi - r.lo) / 2) * 100);
function tableHtml(rows) {
  return `<div class="lb-rt"><span class="hd"></span><span class="hd">bot · n = seats played</span><span class="hd r">wins ±95%</span><span class="hd r">VP</span><span class="hd r">turns</span>`
    + rows.map((r, i) => `<b class="rk">${i + 1}</b><span class="who">${emblem(r.key, 26)}<span>${esc(r.label)}<small class="ci">n = ${r.n}</small></span></span><span class="num">${pct(r.p)}<small class="ci">±${half(r)}</small></span><span class="num">${r.avgVp.toFixed(1)}</span><span class="num">${Math.round(r.avgTurns)}</span>${band(r.lo, r.hi, r.p, r.fair)}`).join("")
    + `</div><p class="lb-fine">Line = even share (${pct(rows[0]?.fair ?? 0.25)}). Ranked by wins.</p>`;
}
const timeText = (s) => (s < 90 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`);
function renderStand(final = false) {
  const el = $("#labStand");
  if (!sim.results.length && !sim.running) { el.hidden = true; return; }
  el.hidden = final;
  if (final) return;
  const left = sim.done ? ((sim.msTotal / sim.done) * (sim.n - sim.done)) / 1000 : null;
  const rows = aggRows();
  el.innerHTML = `<div class="lt-head"><h2>Running</h2><small>${sim.done} of ${sim.n} · ${left == null ? "timing the first game…" : `about ${timeText(left)} left`}</small></div>
    <div class="lb-prog" aria-hidden="true"><i style="width:${(sim.done / sim.n) * 100}%"></i></div>
    ${rows.length ? tableHtml(rows) : ""}`;
}
function runText(rows, v, title, n) {
  return [`AI Lab · ${title} · ${n} games · 4-player base game`, v.line, ...rows.map((r, i) => `${i + 1}. ${r.label}: ${pct(r.p)} ±${half(r)} (n=${r.n}), ${r.avgVp.toFixed(1)} VP, ${Math.round(r.avgTurns)} turns`)].join("\n");
}
function renderSummary() {
  const el = $("#labSummary");
  if (!sim.results.length || sim.running) { el.hidden = true; return; }
  const rows = aggRows(), v = verdict(rows), cfg = sim.cfg;
  const title = specTitle(cfg.spec, cfg.distinct);
  const clear = rows.length > 2 ? v.pairs.filter((p) => p.sig && p.diff > 0).slice(0, 4).map((p) => `${labelOf(p.a)} > ${labelOf(p.b)}`).join(", ") : "";
  el.hidden = false;
  el.innerHTML = `<div class="lt-head"><h2>Result</h2><small>${sim.results.length} games · ${cfg.tboard === "balanced" ? "Balanced" : "Random"} · ${cfg.nSeats} seats</small></div>
    <p class="lb-verdict v-${v.kind}">${esc(v.line)}</p>
    ${clear ? `<p class="lb-fine">Clear gaps: ${esc(clear)}</p>` : ""}
    ${tableHtml(rows)}
    <div class="lb-btnrow"><button type="button" class="lb-btn primary" id="labSave"${sim.saved ? " disabled" : ""}>${sim.saved ? "Saved" : "Save run"}</button><button type="button" class="lb-btn" id="labAgain">Run again</button></div>
    <button type="button" class="lb-link" id="labCopy">Copy result as text</button>`;
  $("#labSave").addEventListener("click", () => { saveRun(); renderSummary(); renderHist(); });
  $("#labAgain").addEventListener("click", () => { $("#labRun").scrollIntoView({ block: "center", behavior: "smooth" }); runTournament(); });
  $("#labCopy").addEventListener("click", async () => {
    const t = runText(rows, v, title, sim.results.length);
    try { await navigator.clipboard.writeText(t); $("#labCopy").textContent = "Copied"; } catch (_) { $("#labCopy").textContent = "Copy failed"; }
  });
}

// Saved runs: this phone only (localStorage)
const RKEY = "colonist.lab.runs";
let runs = store(RKEY) || [];
const picked = new Set();
function saveRun() {
  if (!sim.results.length || sim.saved) return;
  const rows = aggRows(), v = verdict(rows), cfg = sim.cfg;
  runs.unshift({ id: Date.now(), n: sim.results.length, title: specTitle(cfg.spec, cfg.distinct), board: cfg.tboard, nSeats: cfg.nSeats, line: v.line, who: cfg.spec,
    rows: rows.map(({ key, label, n, wins, p, lo, hi, fair, avgVp, avgTurns }) => ({ key, label, n, wins, p, lo, hi, fair, avgVp, avgTurns })) });
  runs = runs.slice(0, 30);
  put(RKEY, runs);
  sim.saved = true;
}
const when = (id) => { const d = new Date(id), t = new Date(), same = d.toDateString() === t.toDateString(); return `${same ? "Today" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`; };
function renderHist() {
  const el = $("#labHist");
  if (!runs.length) { el.hidden = true; return; }
  el.hidden = false;
  const sel = runs.filter((r) => picked.has(r.id));
  let cmp = "";
  if (sel.length === 2) {
    const c = compareRuns(sel[0], sel[1]);
    cmp = `<div class="lb-cmp"><b>${esc(sel[0].title)} vs ${esc(sel[1].title)}</b>${c.length ? c.map((x) => `<div>${esc(x.label)}: ${pct(x.a)} vs ${pct(x.b)} · ${x.sig ? `gap ${Math.abs(Math.round(x.diff * 100))} pts, 95% sure` : "no clear gap"}</div>`).join("") : "<div>No bot in common.</div>"}</div>`;
  }
  el.innerHTML = `<div class="lt-head"><h2>Saved runs</h2><small>on this phone · tick 2 to compare</small></div>
    <div class="lb-hist">${runs.map((r) => `<div class="lb-rr"><button type="button" class="lb-ck${picked.has(r.id) ? " on" : ""}" role="checkbox" aria-checked="${picked.has(r.id)}" data-pick="${r.id}" aria-label="Select ${esc(r.title)}"></button>
      <div><span class="tt">${esc(r.title)}</span><small>${esc(when(r.id))} · ${r.n} games · ${r.board === "balanced" ? "Balanced" : "Random"}</small><span class="lb-chips">${r.rows.map((x) => emblem(x.key, 20)).join("")}</span>
      <small class="lb-vl">${esc(r.line)}</small></div><b>${pct(r.rows[0]?.p ?? 0)}<small>${esc(r.rows[0]?.label || "")}</small></b></div>`).join("")}</div>
    ${cmp}
    <div class="lb-btnrow"><button type="button" class="lb-btn" id="labDelRuns"${picked.size ? "" : " disabled"}>Delete ticked</button></div>`;
  el.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
    const id = Number(b.dataset.pick);
    if (picked.has(id)) picked.delete(id); else { if (picked.size >= 2) picked.delete([...picked][0]); picked.add(id); }
    renderHist();
  }));
  $("#labDelRuns").addEventListener("click", () => { runs = runs.filter((r) => !picked.has(r.id)); picked.clear(); put(RKEY, runs); renderHist(); });
}

// Caption over the board while a game is watched: game n/N · turn · each seat's points
function renderWatch(g, final = null) {
  const el = $("#labWatch");
  renderLegend();
  if (!g) { el.hidden = true; document.querySelectorAll(".lb-read, .lb-tools").forEach((x) => x.classList.remove("lb-faded")); return; }
  const info = g._labSimInfo();
  const keys = sim.curKeys || [];
  const seats = info.players.map((p) => `<span class="lb-ws${final != null && p.id === final ? " won" : ""}" style="--seat:${view.players[p.id]?.color || p.color}" title="${esc(labelOf(keys[p.id] || ""))}"><i></i>${p.vp}</span>`).join("");
  const head = final === null ? `Turn ${info.turn}` : final < 0 ? "No winner" : `${labelOf(keys[final] || "?")} wins`;
  if (!el.querySelector(".lb-winfo")) el.innerHTML = `<span class="lb-winfo"></span><button type="button" class="lb-wstop" aria-label="Stop the tournament">Stop</button>`;
  el.querySelector(".lb-winfo").innerHTML = `<b>Game ${sim.game}/${sim.n}</b><span class="lb-wt">${esc(head)}</span><span class="lb-wseats">${seats}</span>`;
  el.hidden = false;
  document.querySelectorAll(".lb-read, .lb-tools").forEach((x) => x.classList.add("lb-faded"));
}

async function runTournament(over = {}) {
  if (sim.running) { sim.running = false; return sim; }
  const frame = $("#labSim");
  if (!frame.src) frame.src = "./index.html?lab=sim";
  const spec = over.spec || seatSpec();
  const cfg = { n: st.games, tboard: st.tboard, rotate: st.tseats === "rotate", distinct: !!st.distinct, ...over, spec, nSeats: spec.length };
  const pool = poolKeys();
  Object.assign(sim, { running: true, n: cfg.n, done: 0, errors: 0, game: 0, restore: true, results: [], cfg, curKeys: null, msTotal: 0, saved: false });
  $("#labSummary").hidden = true;
  renderTournamentSetup();
  renderStand();
  const g = await waitEngine(frame);
  let saved = null; // your board while games are watched
  const watchOn = () => st.speed === "watch" && !!view;
  let slowGames = 0;
  try {
    for (let i = 0; i < cfg.n && sim.running; i += 1) {
      sim.game = i + 1;
      const t0 = performance.now();
      const keys = seatKeys(drawSeats(cfg.spec, i, pool, cfg.distinct), i, cfg.rotate);
      const strategies = keys.map(stratOf);
      sim.curKeys = keys;
      const seed = SEED0 + i * 7919;
      // a game with a Master / Super seat is played whole in the Web Worker (same boards and dice), in the background: no Watch
      if (strategies.some(isSlow) && masterAvailable()) {
        const m = await masterRequest({ type: "game", seed, strategies, map: cfg.tboard, opts: { ...MASTER_BUDGET }, budgets: strategies.map((x) => (isSlow(x) ? budgetFor(x.policy) : null)) }, 0);
        if (!sim.running) break;
        if (!m || m.type !== "game") { sim.errors += 1; continue; }
        slowGames += 1;
        sim.results.push({ keys, winner: m.winner, turns: m.turns, vp: m.vp });
        sim.done += 1; sim.msTotal += performance.now() - t0;
        renderStand(); renderTournamentSetup();
        continue;
      }
      try {
        g._labSimStart(strategies, { players: keys.length, map: cfg.tboard, seed });
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
            r = g._labSimStep(12);
            await sleep(0); // let the page breathe between chunks
          }
        } while (!r.done && sim.running);
        if (!r.done) break;
        const info = g._labSimInfo();
        sim.results.push({ keys, winner: r.winner, turns: r.turns, vp: info.players.map((p) => p.vp) });
        sim.done += 1; sim.msTotal += performance.now() - t0;
        renderStand(); renderTournamentSetup();
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
    if (sim.done && !watchOn()) put(MKEY, Math.round(sim.msTotal / sim.done), sessionStorage);
    renderStand(true);
    renderSummary();
    renderHist();
    renderTournamentSetup();
    update();
  }
  const rows = aggRows();
  return { ...sim, rows, slowGames, verdict: verdict(rows) };
}

const preloadSim = () => { const f = $("#labSim"); if (!f.src) f.src = "./index.html?lab=sim"; };
function setPane(p) {
  if (p === "tournament") preloadSim();
  st.pane = p;
  document.body.dataset.pane = p;
  if (p !== "analysis") setStepping(false);
  else if (tree.view === "steps" && tree.data?.steps?.length) setStepping(true);
  document.querySelectorAll("#labPanes button").forEach((b) => { const on = b.dataset.pane === p; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $("#paneAnalysis").hidden = p !== "analysis";
  $("#paneTournament").hidden = p !== "tournament";
  renderLegend();
  if (view && !sim.watching) { view.analysis.lab = p === "analysis" ? view.analysis.lab : null; if (p === "analysis") update(); else view.requestBoardDraw(); }
  save();
}

(async () => {
  const frame = $("#labView");
  view = await waitEngine(frame);
  H = view.constructor.labHelpers;
  if (!st.strat || !DIMS.every(([k]) => H.AI_STRATEGY_CATEGORIES[k].levels.includes(st.strat[k]))) st.strat = { ...H.AI_PRESETS[st.preset] || H.AI_PRESETS.intermediate };
  st.preset = presetOf(st.strat);
  if (!st.mix || !DIMS.every(([k]) => H.AI_STRATEGY_CATEGORIES[k].levels.includes(st.mix[k]))) st.mix = null;
  st.tseatN = [2, 3, 4].includes(Number(st.tseatN)) ? Number(st.tseatN) : 4;
  if (!Array.isArray(st.seats) || st.seats.length !== 4) st.seats = ["expert", "intermediate", "intermediate", "intermediate"];
  st.seats = st.seats.map((k, i) => (k === "random" || (k === "mix" && st.mix) || H.AI_PRESETS[k] ? k : i ? "intermediate" : "expert"));
  if (!GAMES_ALLOWED.includes(Number(st.games))) st.games = 100;
  st.games = Number(st.games);
  W = Object.fromEntries(Object.entries(W).filter(([k, v]) => H.AI_WEIGHT_KEYS.includes(k) && Number.isFinite(v) && v >= 0 && v <= 2));
  bindBoardTools(frame);
  $("#labNew").addEventListener("click", () => { if (st.map === "game") st.map = "random"; newBoard(); });
  $("#labSeed").value = st.seed;
  $("#labSeed").addEventListener("change", () => { st.seed = Number($("#labSeed").value) || 0; newBoard(); });
  $("#labRun").addEventListener("click", () => runTournament());
  $("#labTSeats").addEventListener("click", () => { st.tseats = st.tseats === "rotate" ? "fixed" : "rotate"; save(); renderTournamentSetup(); });
  $("#labDistinct").addEventListener("click", () => { st.distinct = !st.distinct; save(); renderTournamentSetup(); });
  $("#labPickClose").addEventListener("click", closePick);
  $("#labPick").addEventListener("click", (e) => { if (e.target === $("#labPick")) closePick(); });
  $("#paneTournament").addEventListener("click", (e) => { const b = e.target.closest(".lb-ii"); if (b) { const t = document.getElementById(b.dataset.info); if (t) t.hidden = !t.hidden; } });
  $("#labMixBtn").addEventListener("click", () => { st.mix = mixable() ? myBot() : null; update(); });
  $("#labWatch").addEventListener("click", (e) => { if (e.target.closest(".lb-wstop")) sim.running = false; });
  $("#labTree").addEventListener("click", onTreeTap);
  $("#labResult").addEventListener("click", (e) => { if (e.target.closest("[data-contest]")) { findContested(); return; } const b = e.target.closest("[data-spot]"); if (b) selectSpot(Number(b.dataset.spot)); });
  $("#labStepStrip").addEventListener("click", onStepsTap);
  // Board settings live in a sheet next to the board (keeps Analysis short)
  const sheet = $("#labBoardSheet");
  $("#labBoardBtn").addEventListener("click", () => { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", ""); });
  $("#labBoardClose").addEventListener("click", () => sheet.close ? sheet.close() : sheet.removeAttribute("open"));
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
  // the sticky top bar's height (the stepping board pins right under it)
  const topH = () => document.documentElement.style.setProperty("--lb-top", `${Math.round($(".lb-top").getBoundingClientRect().height)}px`);
  topH(); addEventListener("resize", topH);
  $("#labSteps").addEventListener("click", onStepsTap);
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
  // load the tournament engine while idle, so pressing Start never waits for it (it froze the page ~1 s)
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(preloadSim, { timeout: 4000 });
  window.__lab = { ready: true, steps, st, reach, selectSpot, findContested, ms, W: () => W, runTournament, runGames: (n, o = {}) => runTournament({ n, ...o }), newBoard, update, view: () => view, sim, runs: () => runs, tree, setPane, myBot, aggRows };
})();
