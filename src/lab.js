// AI Lab (lab.html): pick a board, drop pieces or load the current game, tune a bot with the five
// dimensions and watch its scores as a heatmap on the board; "Play 20 quick games" pits it against
// Intermediate bots. The game itself runs in two iframes in lab mode (index.html?lab=view draws the
// board, ?lab=sim plays the headless games in short chunks so the page stays responsive). Lab mode
// never writes to storage, so your saved game is safe.

const $ = (s) => document.querySelector(s);
const KEY = "colonist.lab";
const DIMS = [["placement", "Placement"], ["expansion", "Expansion"], ["trading", "Trading"], ["devCards", "Dev Cards"], ["awareness", "Awareness"]];
const PRESETS = ["beginner", "intermediate", "expert", "builder", "trader", "shark"];
const MODES = [["setup", "Start spots"], ["build", "Next build"], ["robber", "Robber"]];
const TOOLS = [["pan", "Move"], ["settlement", "Town"], ["city", "City"], ["road", "Road"], ["robber", "Robber"], ["erase", "Erase"]];
const MAPS = [["random", "Random"], ["balanced", "Balanced"], ["seed", "Seed"], ["game", "My game"]];
const PLAYERS = [["4", "4"], ["6", "6"], ["sea", "Seafarers"]];
const PIECES = [["start", "Bots' start"], ["none", "Empty"]];
const HANDS = [["keep", "As is"], ["0", "Empty"], ["1", "1 each"], ["3", "3 each"]];
const UNIT = "AI score: higher is better";
const fmt = (v) => (v == null || !Number.isFinite(v) ? "–" : (Math.round(v * 10) / 10).toFixed(1));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const st = {
  mode: "setup", seat: 1, tool: "pan", preset: "intermediate", strat: null, map: "random", seed: 42, players: "4", hand: "keep", pieces: "start",
  ...(() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } })(),
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ ...st, tool: "pan" })); } catch (_) { /* ignore */ } };

let view = null; // the board game instance (iframe)
let H = null;    // its bot tables (presets, level names)

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
function presetOf(strat) {
  const m = PRESETS.find((p) => DIMS.every(([k]) => H.AI_PRESETS[p][k] === strat[k]));
  return m || "custom";
}

function renderControls() {
  seg($("#labMode"), MODES, st.mode, "mode", (v) => { st.mode = v; update(); });
  const presetItems = PRESETS.map((p) => [p, H.AI_PRESET_INFO[p].label]);
  if (st.preset === "custom") presetItems.push(["custom", "Custom"]);
  seg($("#labPreset"), presetItems, st.preset, "preset", (v) => { st.preset = v; st.strat = { ...H.AI_PRESETS[v] }; update(); });
  $("#labDims").innerHTML = DIMS.map(([k, l]) => `<div class="lb-row lb-dim"><span title="${esc(H.AI_STRATEGY_CATEGORIES[k].descriptions[st.strat[k]])}">${l}</span><div class="lb-seg" data-dim="${k}" role="radiogroup" aria-label="${l}"></div></div>`).join("");
  DIMS.forEach(([k]) => seg($(`[data-dim="${k}"]`), H.AI_STRATEGY_CATEGORIES[k].levels.map((lv) => [lv, levelLabel(lv)]), st.strat[k], "lv", (v) => {
    st.strat = { ...st.strat, [k]: v };
    st.preset = presetOf(st.strat);
    update();
  }));
  seg($("#labMap"), MAPS, st.map, "map", (v) => { st.map = v; renderControls(); newBoard(); });
  $("#labSeedRow").hidden = st.map !== "seed";
  seg($("#labPlayers"), PLAYERS, st.players, "pl", (v) => { st.players = v; newBoard(); }, st.map === "game" ? PLAYERS.map((x) => x[0]) : []);
  seg($("#labPieces"), PIECES, st.pieces, "pc", (v) => { st.pieces = v; newBoard(); }, st.map === "game" ? PIECES.map((x) => x[0]) : []);
  seg($("#labHand"), HANDS, st.hand, "hand", (v) => { st.hand = v; applyHand(); update(); });
  seg($("#labTools"), TOOLS, st.tool, "tool", (v) => { st.tool = v; renderControls(); });
  const players = view?.players || [];
  $("#labSeats").innerHTML = players.map((p) => `<button type="button" role="radio" aria-checked="${p.id === st.seat}" class="${p.id === st.seat ? "on" : ""}" data-seat="${p.id}" title="${esc(p.name)}" style="--seat:${p.color}"><i></i>${esc(p.name)}</button>`).join("");
  $("#labSeats").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { st.seat = Number(b.dataset.seat); applyHand(); update(); }));
  $("#labRun").textContent = sim.running ? `Stop (${sim.done}/${sim.n})` : `Play ${sim.n} quick games`;
}

function applyHand() {
  if (!view || st.hand === "keep") return;
  const n = Number(st.hand);
  view._labSetHand(st.seat, { wood: n, brick: n, sheep: n, wheat: n, ore: n });
}

function update() {
  save();
  renderControls();
  if (!view) return;
  if (!view.players[st.seat]) st.seat = view.players.length > 1 ? 1 : 0;
  const r = view._labExplain(st.mode, st.seat, st.strat);
  const p = view.players[st.seat];
  const out = $("#labResult");
  if (!r) { out.innerHTML = `<p class="lb-note">Nothing to score here.</p>`; return; }
  const vals = DIMS.map(([k]) => r.dims?.[k] || 0);
  const max = Math.max(0.5, ...vals.map(Math.abs));
  out.innerHTML = `<div class="lb-rhead"><i class="lb-dot" style="background:${p.color}"></i><b>${esc(p.name)} · ${esc(r.title)}</b><span class="lb-sc" title="${UNIT}">${fmt(r.score)}</span></div>
    <div class="lb-bars" title="${UNIT}">${DIMS.map(([, l], i) => `<span class="lb-d${Math.abs(vals[i]) < 0.05 ? " zero" : ""}"><span class="l">${l}</span><span class="bar${vals[i] < 0 ? " neg" : ""}"><i style="width:${Math.round((Math.abs(vals[i]) / max) * 100)}%;background:${vals[i] < 0 ? "" : p.color}"></i></span><span class="v">${Math.abs(vals[i]) < 0.05 ? "–" : fmt(vals[i])}</span></span>`).join("")}</div>
    ${r.note ? `<p class="lb-note">${esc(r.note)}</p>` : ""}
    ${r.alts?.length ? `<div class="lb-alts" title="Next best (${UNIT})">${r.alts.map((a) => `<span><b>${fmt(a.score)}</b> ${esc(a.label)}</span>`).join("")}</div>` : ""}`;
}

async function newBoard() {
  if (!view) return;
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
  applyHand();
  update();
}

// Lab tools act on the board: a tap places / removes a piece (the game's own pan & zoom when "Move")
function bindBoardTools(frame) {
  const w = frame.contentWindow;
  const canvas = w.document.getElementById("board");
  // Window capture runs before the game's own canvas listeners, so a lab tool tap never pans or builds
  const block = (e) => {
    if (st.tool === "pan" || e.target !== canvas) return;
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };
  ["pointerdown", "mousedown", "mouseup", "touchstart", "touchmove", "touchend", "click", "dblclick", "wheel"].forEach((t) => w.addEventListener(t, block, { capture: true, passive: false }));
  w.addEventListener("pointerup", (e) => {
    if (st.tool === "pan" || e.target !== canvas) return;
    e.stopImmediatePropagation();
    if (view._labTap(e.clientX, e.clientY, st.tool, st.seat)) update();
  }, { capture: true });
}

// ── quick games ──
const sim = { n: 20, done: 0, wins: 0, running: false, game: null, errors: 0 };
function wilson(w, n) {
  if (!n) return [0, 1];
  const z = 1.96, p = w / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
function renderSim(players) {
  const el = $("#labCi");
  const base = 1 / players;
  if (!sim.done) { el.querySelector(".lb-cit").innerHTML = `Win rate vs Intermediate bots <small>(fair share ${Math.round(base * 100)}%)</small>`; return; }
  const [lo, hi] = wilson(sim.wins, sim.done);
  const p = sim.wins / sim.done;
  el.querySelector(".lb-cit").innerHTML = `Wins <b>${Math.round(p * 100)}%</b> <small>${sim.wins}/${sim.done} · 95% band ${Math.round(lo * 100)}–${Math.round(hi * 100)}% · fair share ${Math.round(base * 100)}%</small>`;
  const bar = el.querySelector(".lb-cibar");
  bar.querySelector("i").style.cssText = `left:${lo * 100}%;width:${(hi - lo) * 100}%`;
  bar.querySelector("em").style.left = `calc(${p * 100}% - 1.5px)`;
  bar.querySelector("u").style.left = `${base * 100}%`;
  bar.classList.add("on");
}
async function runGames(n = sim.n) {
  if (sim.running) { sim.running = false; return sim; }
  const frame = $("#labSim");
  if (!frame.src) frame.src = "./index.html?lab=sim";
  sim.running = true; sim.n = n; sim.done = 0; sim.wins = 0; sim.errors = 0;
  renderControls();
  $("#labCi").querySelector(".lb-cit").textContent = "Starting…";
  const g = await waitEngine(frame);
  const players = st.players === "6" ? 6 : 4;
  const opts = { players, sea: st.players === "sea", map: "random" };
  const strat = { ...st.strat };
  for (let i = 0; i < n && sim.running; i += 1) {
    try {
      g._labSimStart(strat, opts);
      let r;
      do {
        r = g._labSimStep(25);
        await new Promise((res) => setTimeout(res, 0)); // let the page breathe between chunks
      } while (!r.done && sim.running);
      if (!r.done) break;
      sim.done += 1;
      if (r.winner === 0) sim.wins += 1;
    } catch (e) { sim.errors += 1; console.error("quick game failed", e); }
    renderSim(players);
    renderControls();
  }
  sim.running = false;
  renderControls();
  renderSim(players);
  return { ...sim };
}

(async () => {
  const frame = $("#labView");
  view = await waitEngine(frame);
  H = view.constructor.labHelpers;
  if (!st.strat || !DIMS.every(([k]) => H.AI_STRATEGY_CATEGORIES[k].levels.includes(st.strat[k]))) st.strat = { ...H.AI_PRESETS[st.preset] || H.AI_PRESETS.intermediate };
  st.preset = presetOf(st.strat);
  bindBoardTools(frame);
  $("#labNew").addEventListener("click", () => { if (st.map === "game") st.map = "random"; newBoard(); });
  $("#labSeed").value = st.seed;
  $("#labSeed").addEventListener("change", () => { st.seed = Number($("#labSeed").value) || 0; newBoard(); });
  $("#labRun").addEventListener("click", () => runGames());
  await newBoard();
  renderSim(st.players === "6" ? 6 : 4);
  window.__lab = { ready: true, st, runGames, newBoard, update, view: () => view, sim };
})();
