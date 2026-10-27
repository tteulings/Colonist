// End-of-game statistics, part 2: what the player sees when the game is over.
//
//   1. the winning-move count — the winner's points counted ON the board (+1 per settlement, +2 per city,
//      the road network for Longest Road, +2 at the chip for Largest Army, +1 per VP card), ≤ 1.2 s
//   2. a short transition — you won: your portrait bounces in over a sunburst and a fast timelapse of the
//      game, confetti in the house colours; you lost: the winner's portrait slides in with a friendly nod
//   3. the recap (always on top): final scores, three one-line highlights, turns / time / your rank, and
//      below it "More stats": tabs Race · Dice · Cards · Maps · Moments, one chart per card, each card
//      titled with its takeaway; heat maps drawn on the real themed board (with a ▶ to watch them build up)
//   4. Replay (the whole game on the real board, play/pause, 1×/4×, scrubber) and Timelapse (2.5 s)
// Sticky footer: Replay + Rematch (one tap). Reduced motion: no count, no timelapse, a plain fade.
// Colours: player colours only where a player is meant (house colours, --pN); everything else the theme ink
// at low contrast with ONE accent (the theme's primary teal); heat = one warm gold ramp (--gs-heat).
// Styles: themes/stats.css.
import { icon, dieSvg, motionReduced } from "./themes/manager.js";
import { SEAT_PERSONAS } from "./themes/portraits.js";
import { TERRAIN_NAME } from "./themes/art-util.js";
import { RES, computeStats } from "./stats.js";

const NUMW = { 2: "twos", 3: "threes", 4: "fours", 5: "fives", 6: "sixes", 7: "sevens", 8: "eights", 9: "nines", 10: "tens", 11: "elevens", 12: "twelves" };
const NUM1 = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve" };
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const ord = (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const TABS = [["race", "Race"], ["dice", "Dice"], ["cards", "Cards"], ["maps", "Maps"], ["moments", "Moments"]];
const W = 300; // chart viewBox width
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? "<1 min" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const nf = (x) => (Math.round(x * 10) / 10).toString();

/** Split the brooch (the persona's emblem disc, always at translate(-21 36)) off a portrait, so it can pop on its own. */
function splitBrooch(svg) {
  const at = svg.indexOf('<g transform="translate(-21 36)"');
  if (at < 0) return { body: svg, brooch: "" };
  let i = at, depth = 0;
  const re = /<\/?g\b[^>]*>/g;
  re.lastIndex = at;
  let m;
  while ((m = re.exec(svg))) {
    if (m[0].startsWith("</")) depth -= 1; else if (!m[0].endsWith("/>")) depth += 1;
    if (depth === 0) { i = re.lastIndex; break; }
  }
  const whole = svg.slice(at, i);
  const open = whole.indexOf(">") + 1;
  return { body: svg.slice(0, at) + svg.slice(i), brooch: `<g${whole.slice(2, open - 1).replace(/transform="translate\(-21 36\)"/, "")}>${whole.slice(open, -4)}</g>` };
}

export const StatsUiMixin = {
  // ── small helpers ────────────────────────────────────────────────────────────────────────────
  // "You" is the one person playing against bots; in pass & play (2+ people on one phone) everyone is named
  _stName(p) { return this._you(p) ? "You" : p.name; },
  /** The person whose view the recap takes ("you finished 2nd", "your luck"): none in pass & play. */
  _stMe() { return this.hotseat ? null : this._me(); },
  _stWinsText(w) { return this._you(w) ? "You win!" : `${w.name} wins${w.isHuman ? "!" : ""}`; },
  _stTurnWord() { return this.isRush() ? "roll" : "turn"; },

  /** Inline portrait (themed) with the head and the brooch as separate groups for the animations. */
  _stPortrait(pid, cls = "", size = 44) {
    let inner = "";
    try { inner = this.theme?.avatar ? this.theme.avatar(SEAT_PERSONAS[pid]) : ""; } catch (_) { inner = ""; }
    if (!inner) return `<span class="avatar pc-${pid} gs-por ${cls}" style="--av:${size}px"><svg viewBox="-50 -50 100 100" aria-hidden="true"><use href="#av-${pid}" x="-50" y="-50" width="100" height="100"/></svg></span>`;
    const { body, brooch } = splitBrooch(inner);
    return `<span class="avatar pc-${pid} gs-por ${cls}" style="--av:${size}px"><svg viewBox="-50 -50 100 100" aria-hidden="true"><g class="gs-head">${body}</g>${brooch ? `<g transform="translate(-21 36)"><g class="gs-brooch">${brooch}</g></g>` : ""}</svg></span>`;
  },

  _stTile(hexId) {
    const h = this.geometry.hexes[hexId];
    if (!h) return "a tile";
    if (h.resource === "sea") return "the sea";
    return `${(TERRAIN_NAME[h.resource] || h.resource).toLowerCase()}${h.number ? " " + h.number : ""}`;
  },

  _stCompute() {
    try { this._stSync(); return computeStats(this); } catch (e) { console.warn("stats failed", e); return null; }
  },

  // ── the flow ─────────────────────────────────────────────────────────────────────────────────
  showGameOverOverlay() {
    if (document.querySelector(".game-over-overlay")) return;
    this.hideTradePanel();
    this.toggleBuildSheet?.(false);
    const st = this._stCompute();
    this._st = st;
    const reduced = motionReduced();
    // a tap during the count means "get on with it": straight to the recap, no transition
    const go = (skip = false) => { if (this.winner && !document.querySelector(".game-over-overlay")) this._stShowOverlay(st, reduced, skip); };
    if (reduced || !st) { go(); return; }
    this._stCountOnBoard(go);
  },

  removeGameOverOverlay() {
    this._stCountDone?.();
    this._rpExit?.(true);
    document.querySelectorAll(".game-over-overlay, .gs-count, .gs-replay").forEach((el) => el.remove());
  },

  _stHost() { return (this.isMobileLayout ? this.app : document.querySelector(".board-panel")) || document.body; },

  /** 1. The winner's points counted on the board, ≤ 1.2 s; any tap skips. */
  _stCountOnBoard(done) {
    const p = this.winner, g = this.geometry;
    const cr = this.canvas.getBoundingClientRect();
    const at = (x, y) => { const s = this.worldToScreen(x, y); return { x: cr.left + s.x, y: cr.top + s.y }; };
    const chipEl = document.querySelector(`#playerStrip [data-seat="${p.id}"], #scoreboard [data-seat="${p.id}"]`);
    const chip = chipEl && chipEl.getBoundingClientRect().width ? chipEl.getBoundingClientRect() : { left: innerWidth / 2 - 30, top: 12, width: 60, height: 40 };
    const items = [];
    p.settlements.forEach((id) => items.push({ n: 1, ...at(g.nodes[id].x, g.nodes[id].y) }));
    p.cities.forEach((id) => items.push({ n: 2, ...at(g.nodes[id].x, g.nodes[id].y), city: true }));
    if (this.sea) Object.entries(this.sea.bonusNode || {}).forEach(([k, nid]) => { if (k.split(":")[0] === String(p.id) && g.nodes[nid]) items.push({ n: 2, ...at(g.nodes[nid].x, g.nodes[nid].y - g.hexSize * 0.35) }); });
    if (this.longestRoadHolder === p.id) {
      const edges = [...p.roads, ...(p.ships || [])].map((id) => g.edges[id]);
      const mid = edges[Math.floor(edges.length / 2)];
      if (mid) { const [a, b] = mid.nodes.map((n) => g.nodes[n]); items.push({ n: 2, ...at((a.x + b.x) / 2, (a.y + b.y) / 2), road: edges }); }
    }
    if (this.largestArmyHolder === p.id) items.push({ n: 2, x: chip.left + chip.width / 2, y: chip.top + chip.height + 14, ic: "largestArmy" });
    for (let k = 0; k < p.devVictoryPoints; k += 1) items.push({ n: 1, x: innerWidth / 2 + (k - (p.devVictoryPoints - 1) / 2) * 34, y: innerHeight - 120, ic: "vp" });
    const layer = document.createElement("div");
    layer.className = "gs-count tm";
    layer.setAttribute("aria-hidden", "true");
    let svg = "";
    const road = items.find((i) => i.road);
    if (road) {
      svg = `<svg class="gs-count-road" width="${innerWidth}" height="${innerHeight}">${road.road.map((e) => { const [a, b] = e.nodes.map((n) => at(g.nodes[n].x, g.nodes[n].y)); return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }).join("")}</svg>`;
    }
    const total = items.reduce((a, i) => a + i.n, 0);
    const base = Math.max(0, p.victoryPoints - total);
    layer.innerHTML = `${svg}<div class="gs-count-vp pc-${p.id}" style="left:${chip.left + chip.width - 6}px;top:${Math.max(4, chip.top - 6)}px"><b>${base}</b></div>`
      + items.map((it, i) => `<span class="gs-plus pc-${p.id}${it.city ? " big" : ""}" style="left:${it.x}px;top:${it.y}px;--d:${i * 70}ms">${it.ic ? icon(it.ic) : ""}+${it.n}</span>`).join("");
    document.body.appendChild(layer);
    if (road) layer.querySelector(".gs-count-road").style.setProperty("--d", `${items.indexOf(road) * 70}ms`);
    const vpEl = layer.querySelector(".gs-count-vp b");
    const timers = [];
    let run = base;
    items.forEach((it, i) => timers.push(window.setTimeout(() => { run += it.n; vpEl.textContent = run; vpEl.parentElement.classList.remove("tick"); void vpEl.offsetWidth; vpEl.parentElement.classList.add("tick"); }, i * 70 + 160)));
    let finished = false;
    const finish = (skip = false) => {
      if (finished) return;
      finished = true;
      this._stCountDone = null;
      timers.forEach((t) => window.clearTimeout(t));
      layer.classList.add("out");
      window.setTimeout(() => layer.remove(), 220);
      done(skip);
    };
    this._stCountDone = () => { finished = true; timers.forEach((t) => window.clearTimeout(t)); layer.remove(); this._stCountDone = null; };
    layer.addEventListener("pointerdown", () => finish(true));
    timers.push(window.setTimeout(() => finish(false), Math.min(1050, items.length * 70 + 520)));
    if (p.isHuman) this.sfx.victory();
  },

  /** 2 + 3: the overlay with its transition, then the recap. */
  _stShowOverlay(st, reduced, skipIntro = false) {
    const winner = this.winner;
    const human = this._stMe();
    // the game's winner is always 1st (it won by the game's rule: reaching the target on its own turn / the turn limit); then by points
    const ranked = [winner, ...this.players.filter((p) => p !== winner).sort((a, b) => b.victoryPoints - a.victoryPoints)];
    const rank = human ? ranked.indexOf(human) + 1 : 0;
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay tm gs-over";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Game over");
    const turns = this.isRush() ? `${this.rush?.rollNo ?? st?.N ?? 0}` : `${this.turn}`;
    const hl = st ? this._stHighlights(st) : [];
    overlay.innerHTML = `
      <div class="gs-scroll">
        <section class="gs-recap over-panel" aria-label="Recap">
          <div class="gs-rhead">${this._stPortrait(winner.id, "gs-win-por", 52)}<div><h3>${this._stWinsText(winner)}</h3>
            <p class="lead">${winner.isHuman || !human ? `${winner.victoryPoints} points${this.isRush() ? "" : ` on turn ${this.turn}`}` : `You finished ${ord(rank)}`}</p></div></div>
          <div class="podium gs-rank">${ranked.map((p, k) => `<div class="r${p === winner ? " win" : ""}" data-pid="${p.id}"><span class="pl">${k + 1}</span>${this._stPortrait(p.id, p === winner ? "gs-emb" : "", 30)}<span class="nmc"><span class="pname">${this._stName(p)}</span></span><span class="s">${p.victoryPoints}</span></div>`).join("")}</div>
          <div class="gs-ov"><span><b>${turns}</b>${this.isRush() ? "rolls" : "turns"}</span><span><b>${fmtDur(st?.ms || 0)}</b>played</span>${human ? `<span><b>${rank ? ord(rank) : "—"}</b>your rank</span>` : `<span><b>${this.players.length}</b>players</span>`}</div>
          ${hl.length ? `<ul class="gs-hl">${hl.map((h) => `<li>${icon(h.ic)}<span>${h.text}</span></li>`).join("")}</ul>` : ""}
          <div class="gs-rbtns">${st && st.N > 2 && !reduced ? `<button type="button" class="gs-chip" data-timelapse><svg class="ic" viewBox="0 0 20 16" aria-hidden="true"><path fill="currentColor" d="M1 2v12l8-6zM10 2v12l8-6z"/></svg>Timelapse</button>` : ""}<button type="button" class="gs-chip" data-see>${icon("fit")}See board</button><button type="button" class="gs-chip" data-change>${icon("settings")}Change settings</button></div>
        </section>
        ${st ? `<h4 class="gs-more"><span>More stats</span></h4>
        <div class="gs-tabs" role="tablist">${TABS.map(([k, l], i) => `<button type="button" role="tab" class="gs-tab${i ? "" : " on"}" data-tab="${k}" aria-selected="${i ? "false" : "true"}">${l}</button>`).join("")}</div>
        <div class="gs-pane" role="tabpanel"></div>` : ""}
      </div>
      <div class="gs-foot">
        ${st && st.N > 0 ? `<button type="button" class="btn gs-replay-btn" data-replay><svg class="gs-tri" viewBox="0 0 14 16" aria-hidden="true"><path d="M1 1.2v13.6c0 .8.9 1.3 1.6.8l10.2-6.8c.6-.4.6-1.2 0-1.6L2.6.4C1.9-.1 1 .4 1 1.2z"/></svg>Replay</button>` : ""}
        <button type="button" class="btn primary game-over-btn rematch-btn" id="newGameBtn" data-rematch>Rematch<small>same settings</small></button>
      </div>`;
    this._stHost().appendChild(overlay);
    this._stOverlay = overlay;
    overlay.querySelector("[data-rematch]").addEventListener("click", () => { this.removeGameOverOverlay(); this.stopAutoplay(); this.startNewGame({ ...this.settings }); });
    overlay.querySelector("[data-change]").addEventListener("click", () => { this.removeGameOverOverlay(); this.stopAutoplay(); this._showDifficultyModal(); });
    overlay.querySelector("[data-see]").addEventListener("click", () => { this.removeGameOverOverlay(); this.render(); });
    overlay.querySelector("[data-replay]")?.addEventListener("click", () => this._rpStart("replay"));
    overlay.querySelector("[data-timelapse]")?.addEventListener("click", () => this._rpStart("timelapse"));
    overlay.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => this._stTab(b.dataset.tab)));
    if (st) this._stTab("race", true);
    if (skipIntro) this._stAnimateIn(overlay.querySelector(".gs-pane"));
    else this._stIntro(overlay, st, reduced, rank);
  },

  _stHighlights(st) {
    const out = [];
    const w = this.players[st.winner], human = this._stMe();
    out.push({ ic: "vp", text: this._stLeadText(st) });
    if (human) {
      const ph = st.pHex[human.id];
      const best = ph.indexOf(Math.max(...ph));
      if (ph[best] > 0) out.push({ ic: "settlement", text: `Your best tile: ${this._stTile(best)} · ${ph[best]} cards` });
    } else if (w) out.push({ ic: "cards", text: `${w.name} collected ${st.prodTot[w.id]} cards` });
    if (st.N) out.push({ ic: "dice", text: this._stDiceText(st) });
    return out.slice(0, 3);
  },

  _stLeadText(st) {
    const w = this.players[st.winner];
    const nm = this._stName(w);
    if (st.N <= 1 || st.leadFrom <= 1) return `${nm} led from start to finish`;
    if (st.leadFrom >= st.N) return `${nm} took the lead at the very end`;
    return `${nm} led from ${this._stTurnWord()} ${st.turnOf[st.leadFrom]}`;
  },

  _stDiceText(st) {
    const d = st.diceDev, c = st.dice[d.k];
    return d.d >= 0 ? `${cap(NUMW[d.k])} came ${c}×, expected ${Math.round(d.e)}` : (c === 0 ? `No ${NUM1[d.k]} at all, expected ${Math.round(d.e)}` : `Only ${c} ${c === 1 ? NUM1[d.k] : NUMW[d.k]}, expected ${Math.round(d.e)}`);
  },

  /** The transition: you won → bounce + sunburst + confetti over the timelapse; you lost → kind slide-in. */
  _stIntro(overlay, st, reduced, rank) {
    const winner = this.winner, human = this._stMe();
    const won = !!winner.isHuman; // a person won (pass & play: celebrated under their name)
    const intro = document.createElement("div");
    intro.className = `gs-intro ${won ? "win" : "lose"}${reduced ? " reduced" : ""}`;
    const rays = Array.from({ length: 16 }, (_, k) => { const a0 = k * Math.PI / 8 - 0.09, a1 = k * Math.PI / 8 + 0.09; return `<path d="M0,0 L${210 * Math.cos(a0)},${210 * Math.sin(a0)} A210,210 0 0 1 ${210 * Math.cos(a1)},${210 * Math.sin(a1)}Z"/>`; }).join("");
    intro.innerHTML = `${st && !reduced ? `<canvas class="gs-tl-bg"></canvas>` : ""}<div class="gs-intro-dim"></div>
      ${won ? `<svg class="gs-rays" viewBox="-210 -210 420 420" aria-hidden="true"><defs><radialGradient id="stRayG"><stop offset=".15" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="stRayM"><circle r="210" fill="url(#stRayG)"/></mask></defs><g mask="url(#stRayM)">${rays}</g></svg><div class="gs-confetti"></div>
        <div class="gs-hero">${this._stPortrait(winner.id, "gs-hero-por", 150)}</div><h2>${this._stWinsText(winner)}</h2><div class="gs-vpn"><b>0</b> points</div>`
        : `<div class="gs-lose-card">${this._stPortrait(winner.id, "gs-nod", 96)}<h2>${winner.name} wins</h2><p>${human ? `Well played · you finished ${ord(rank)}` : `${winner.victoryPoints} points`}</p>${human ? this._stPortrait(human.id, "gs-shrug", 40) : ""}</div>`}
      <div class="gs-skip">tap to continue</div>`;
    overlay.appendChild(intro);
    overlay.classList.add("intro");
    const dur = reduced ? 1100 : won ? 2050 : 1600;
    let tl = null;
    if (st && !reduced) {
      const cv = intro.querySelector(".gs-tl-bg");
      tl = this._rpTimelapse(cv, Math.min(dur, 2400), null);
    }
    if (won && !reduced) {
      const b = intro.querySelector(".gs-vpn b");
      const t0 = performance.now(), target = winner.victoryPoints;
      const tick = () => { const k = Math.min(1, (performance.now() - t0 - 350) / 900); b.textContent = Math.max(0, Math.round(target * Math.max(0, k))); if (k < 1 && intro.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      this._stConfetti(intro.querySelector(".gs-confetti"));
    } else if (won) intro.querySelector(".gs-vpn b").textContent = winner.victoryPoints;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      tl?.stop();
      intro.classList.add("out");
      overlay.classList.remove("intro");
      window.setTimeout(() => intro.remove(), reduced ? 250 : 380);
      this._stAnimateIn(overlay.querySelector(".gs-pane"));
    };
    intro.addEventListener("pointerdown", end);
    window.setTimeout(end, dur);
  },

  _stConfetti(box) {
    if (!box) return;
    const cs = getComputedStyle(document.documentElement);
    const cols = this.players.map((p) => cs.getPropertyValue(`--p${p.id}`).trim() || "#D9714E");
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 34; i += 1) {
      const el = document.createElement("i");
      el.style.left = `${rnd() * 100}%`;
      el.style.background = cols[i % cols.length];
      box.appendChild(el);
      const x = (rnd() - 0.5) * 120, rot = 240 + rnd() * 500, fall = innerHeight * (0.7 + rnd() * 0.3);
      el.animate([{ transform: "translate(0,-20px) rotate(0)", opacity: 1 }, { transform: `translate(${x}px,${fall}px) rotate(${rot}deg)`, opacity: 0.1 }],
        { duration: 1600 + rnd() * 600, delay: 120 + rnd() * 420, easing: "cubic-bezier(.3,.1,.6,1)", fill: "both" });
    }
  },

  // ── tabs and cards ───────────────────────────────────────────────────────────────────────────
  _stTab(key, silent = false) {
    const ov = this._stOverlay, st = this._st;
    if (!ov || !st) return;
    ov.querySelectorAll("[data-tab]").forEach((b) => { const on = b.dataset.tab === key; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    const pane = ov.querySelector(".gs-pane");
    this._stMapStop?.();
    const cards = {
      race: () => [this._stCardRace(st), this._stCardSources(st)],
      dice: () => [this._stCardDice(st), this._stCardStrip(st)],
      cards: () => [this._stCardRes(st), this._stCardRobbed(st), this._stCardTrades(st)],
      maps: () => [this._stCardMap(st, "prod"), this._stCardMap(st, "income"), this._stCardMap(st, "robber")],
      moments: () => [this._stCardMoments(st)],
    }[key]();
    pane.dataset.tab = key;
    pane.innerHTML = cards.join("");
    if (key === "maps") this._stMapsInit(pane, st);
    if (!silent) this._stAnimateIn(pane);
  },

  _stAnimateIn(pane) {
    if (!pane) return;
    pane.classList.remove("gs-in");
    void pane.offsetWidth;
    pane.classList.add("gs-in");
  },

  _stCard(id, title, sub, body, extra = "") {
    return `<article class="gs-card" data-card="${id}"${extra}><h2>${title}</h2>${sub ? `<div class="gs-sub">${sub}</div>` : ""}${body}</article>`;
  },

  /** VP over time: one line per player in the house colours, award moments marked. */
  _stCardRace(st) {
    const H = 150, N = Math.max(1, st.N);
    const maxV = Math.max(this.winPoints, ...st.vp[st.N]);
    const x = (s) => 6 + (s * (W - 30)) / N, y = (v) => H - 18 - (v * (H - 30)) / maxV;
    const path = (pid) => { let d = `M${x(0)},${y(st.vp[0][pid])}`; for (let s = 1; s <= st.N; s += 1) d += `H${x(s).toFixed(1)}V${y(st.vp[s][pid]).toFixed(1)}`; return d; };
    const order = this.players.map((p) => p.id).filter((i) => i !== st.winner).concat([st.winner]);
    const grid = [0, Math.round(this.winPoints / 2), this.winPoints].map((v) => `<line class="gs-grid${v === this.winPoints ? " goal" : ""}" x1="6" x2="${W - 24}" y1="${y(v)}" y2="${y(v)}"/><text class="gs-ax" x="${W - 2}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`).join("");
    const marks = st.awards.filter((a) => a.pid >= 0).map((a) => `<g class="gs-award pc-${a.pid}" transform="translate(${x(a.s).toFixed(1)} ${y(st.vp[a.s][a.pid]).toFixed(1)})"><circle r="8"/><svg x="-6" y="-6" width="12" height="12" viewBox="-50 -50 100 100"><use href="#ic-${a.kind === "A" ? "largestArmy" : "longestRoad"}" x="-50" y="-50" width="100" height="100"/></svg></g>`).join("");
    const lines = order.map((pid) => `<path class="gs-line pc-${pid}${pid === st.winner ? " win" : ""}" pathLength="1" d="${path(pid)}"/>`).join("");
    const end = this.isRush() ? `roll ${st.N}` : `turn ${st.turnOf[st.N]}`;
    const body = `<svg class="gs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Points over time">${grid}${lines}${marks}<text class="gs-ax" x="6" y="${H - 3}">${this.isRush() ? "roll 1" : "turn 1"}</text><text class="gs-ax" x="${W - 24}" y="${H - 3}" text-anchor="end">${end}</text></svg>
      <div class="gs-legend">${this.players.map((p) => `<span class="pc-${p.id}"><i></i>${this._stName(p)}</span>`).join("")}</div>`;
    return this._stCard("race", this._stLeadText(st), "Points over time", body);
  },

  /** Where the points came from (final): adds up to every player's score. */
  _stCardSources(st) {
    const parts = [["settlements", "settlement", "Settlements"], ["cities", "city", "Cities"], ["road", "longestRoad", this.sea ? "Longest Trade Route" : "Longest Road"], ["army", "largestArmy", "Largest Army"], ["cards", "vp", "VP cards"], ["islands", "settlement", "Islands"]];
    const used = parts.filter(([k]) => st.sources.some((s) => s[k] > 0));
    const maxV = Math.max(...st.sources.map((s) => s.total), 1);
    const ranked = [...this.players].sort((a, b) => b.victoryPoints - a.victoryPoints);
    const rows = ranked.map((p) => {
      const s = st.sources[p.id];
      let acc = 0;
      const segs = used.map(([k], i) => { const v = s[k]; if (!v) return ""; const seg = `<rect class="gs-seg s${i}" x="${(acc / maxV) * 100}%" width="calc(${(v / maxV) * 100}% - 2px)" height="16" rx="4"/>`; acc += v; return seg; }).join("");
      return `<div class="gs-row" data-pid="${p.id}" data-sum="${s.total}" data-vp="${p.victoryPoints}">${this._stPortrait(p.id, "", 26)}<svg class="gs-bar" height="16">${segs}</svg><b>${s.total}</b></div>`;
    }).join("");
    const w = st.sources[st.winner], wn = this._stName(this.players[st.winner]);
    const top = used.reduce((b, [k, , l]) => (w[k] > (b?.v || 0) ? { k, l, v: w[k] } : b), null);
    const title = top ? `${top.l} gave ${wn === "You" ? "you" : wn} ${top.v} of ${w.total} points` : "Where the points came from";
    const legend = `<div class="gs-legend neutral">${used.map(([, ic, l], i) => `<span><i class="s${i}"></i>${l}</span>`).join("")}</div>`;
    return this._stCard("sources", title, "Points by source", `<div class="gs-rows">${rows}</div>${legend}`);
  },

  /** Dice histogram with the expected curve; the bar the title talks about carries the accent. */
  _stCardDice(st) {
    const H = 132, n = st.N, bw = (W - 8) / 11;
    const exp = (k) => (n * PIPS[k]) / 36;
    const maxC = Math.max(1, ...Object.values(st.dice), exp(7));
    const ys = (v) => (v * (H - 32)) / maxC;
    let bars = "";
    for (let k = 2; k <= 12; k += 1) {
      const xx = 4 + (k - 2) * bw, c = st.dice[k] || 0;
      bars += `<g class="gs-dbar${k === st.diceDev.k ? " hi" : ""}" style="--i:${k - 2}"><rect x="${(xx + 3).toFixed(1)}" y="${(H - 18 - ys(c)).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(0.5, ys(c)).toFixed(1)}" rx="4"/><text class="gs-ax n" x="${(xx + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${k}</text>${c ? `<text class="gs-ax c" x="${(xx + bw / 2).toFixed(1)}" y="${(H - 22 - ys(c)).toFixed(1)}" text-anchor="middle">${c}</text>` : ""}</g>`;
    }
    const pts = [];
    // v0.82 "stepped, not a pyramid": a flat step at each number's expected count across its bar's slot,
    // joined by vertical risers at the slot edges (no sloped segments)
    for (let k = 2; k <= 12; k += 1) { const yk = (H - 18 - ys(exp(k))).toFixed(1); pts.push(`${(4 + (k - 2) * bw).toFixed(1)},${yk}`, `${(4 + (k - 1) * bw).toFixed(1)},${yk}`); }
    const human = this._stMe();
    const luck = human && st.expected[human.id] > 0.5 ? Math.round(st.luck[human.id] * 100) : null;
    const sub = `Rolls vs expected${luck != null ? ` <span class="gs-tag">Your luck ${luck >= 0 ? "+" : "−"}${Math.abs(luck)}%</span>` : ""}`;
    const body = `<svg class="gs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dice rolls">${bars}<polyline class="gs-exp" points="${pts.join(" ")}"/></svg>`;
    return this._stCard("dice", this._stDiceText(st), sub, body, ` data-rolls="${n}"`);
  },

  /** Every roll, turn by turn: streaks and droughts. */
  _stCardStrip(st) {
    const cols = st.strip, C = Math.max(1, cols.length), lw = 16, cw = (W - lw) / C, ch = 10, H = 11 * ch + 14;
    let cells = "";
    const maxC = Math.max(1, ...cols.flatMap((c) => Object.values(c.n)));
    for (let k = 2; k <= 12; k += 1) {
      cells += `<text class="gs-ax" x="${lw - 4}" y="${(k - 2) * ch + 8}" text-anchor="end">${k}</text>`;
      cols.forEach((c, i) => { const v = c.n[k] || 0; cells += `<rect class="gs-cell${v ? " on" : ""}" x="${(lw + i * cw).toFixed(1)}" y="${(k - 2) * ch}" width="${Math.max(1, cw - 1.2).toFixed(1)}" height="${ch - 1.2}" rx="2"${v ? ` style="opacity:${(0.28 + (0.72 * v) / maxC).toFixed(2)}"` : ""}/>`; });
    }
    const unit = this.isRush() ? "rolls" : "turns";
    const d = st.drought;
    let title;
    if (d && d.len >= 4) {
      cells += `<rect class="gs-mark" x="${(lw + d.start * cw - 1).toFixed(1)}" y="${(d.k - 2) * ch - 1}" width="${((d.end - d.start + 1) * cw + 0.8).toFixed(1)}" height="${ch + 0.8}" rx="3"/>`;
      title = `No ${d.k} for ${d.len * (st.stripUnit || 1)} ${unit}`;
    } else {
      let hot = { k: 8, v: 0, c: 0 };
      cols.forEach((c) => Object.entries(c.n).forEach(([k, v]) => { if (v > hot.v) hot = { k: +k, v, c: c.c }; }));
      title = hot.v > 1 ? `${cap(NUMW[hot.k])} came ${hot.v}× in ${this.isRush() ? "a row of rolls" : `turn ${hot.c}`}` : "The dice spread out evenly";
    }
    cells += `<text class="gs-ax" x="${lw}" y="${H - 1}">${this.isRush() ? "first roll" : "turn 1"}</text><text class="gs-ax" x="${W}" y="${H - 1}" text-anchor="end">${this.isRush() ? "last roll" : `turn ${cols[cols.length - 1]?.c ?? ""}`}</text>`;
    return this._stCard("strip", title, `Every roll, ${this.isRush() ? "roll" : "turn"} by ${this.isRush() ? "roll" : "turn"}`, `<svg class="gs-chart gs-strip" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rolls over time">${cells}</svg>`);
  },

  _stResCol() {
    const P = this.theme?.palette || {};
    const pick = (a, fb) => (Array.isArray(a) ? a[0] : a) || fb;
    return { wood: pick(P.forest, "#4F8A3A"), brick: pick(P.terra, "#C8643B"), sheep: pick(P.pasture, "#9CC95B"), wheat: pick(P.wheat, "#E8B33A"), ore: pick(P.slate, "#8C9AAE") };
  },

  /** Resources from the dice, stacked by resource. */
  _stCardRes(st) {
    const col = this._stResCol();
    const maxV = Math.max(1, ...st.prodTot);
    const ranked = [...this.players].sort((a, b) => st.prodTot[b.id] - st.prodTot[a.id]);
    const rows = ranked.map((p) => {
      let acc = 0;
      const segs = RES.map((r, ri) => { const v = st.prod[p.id][ri]; if (!v) return ""; const s = `<rect class="gs-seg" x="${(acc / maxV) * 100}%" width="calc(${(v / maxV) * 100}% - 1.5px)" height="16" rx="3" style="fill:${col[r]}"/>`; acc += v; return s; }).join("");
      return `<div class="gs-row" data-pid="${p.id}" data-total="${st.prodTot[p.id]}">${this._stPortrait(p.id, "", 26)}<svg class="gs-bar" height="16">${segs}</svg><b>${st.prodTot[p.id]}</b></div>`;
    }).join("");
    const top = ranked[0];
    const legend = `<div class="gs-legend res">${RES.map((r) => `<span>${icon(r)}</span>`).join("")}</div>`;
    const title = st.prodTot[top.id] ? `${this._stName(top)} earned the most: ${st.prodTot[top.id]} cards` : "Nobody earned cards from the dice";
    return this._stCard("res", title, "Cards from the dice", `<div class="gs-rows">${rows}</div>${legend}`);
  },

  /** Robber, discards, Monopoly: what each player lost (left) and took (right). */
  _stCardRobbed(st) {
    const lost = this.players.map((p) => st.stolenFrom[p.id] + st.discarded[p.id] + st.monoLost[p.id]);
    const took = this.players.map((p) => st.stole[p.id] + st.monoGot[p.id]);
    const maxV = Math.max(1, ...lost, ...took);
    const rows = this.players.map((p) => `<div class="gs-row dv" data-pid="${p.id}">${this._stPortrait(p.id, "", 26)}<span class="gs-num l">${lost[p.id] || ""}</span><svg class="gs-bar" height="16"><rect class="gs-seg lost" x="${50 - (lost[p.id] / maxV) * 50}%" width="${(lost[p.id] / maxV) * 50}%" height="16" rx="3"/><rect class="gs-seg took" x="50%" width="${(took[p.id] / maxV) * 50}%" height="16" rx="3"/><line class="gs-axis" x1="50%" x2="50%" y1="0" y2="16"/></svg><span class="gs-num r">${took[p.id] || ""}</span></div>`).join("");
    const worst = lost.indexOf(Math.max(...lost));
    const title = lost[worst] ? `${this._stName(this.players[worst])} lost the most: ${lost[worst]} card${lost[worst] === 1 ? "" : "s"}` : "Nobody lost a card";
    return this._stCard("robbed", title, `<span class="gs-key lost"></span>stolen, discarded <span class="gs-key took"></span>taken`, `<div class="gs-rows">${rows}</div>`);
  },

  _stCardTrades(st) {
    const tot = this.players.map((p) => st.bankTrades[p.id] + st.playerTrades[p.id]);
    const maxV = Math.max(1, ...tot);
    const rows = this.players.map((p) => `<div class="gs-row" data-pid="${p.id}">${this._stPortrait(p.id, "", 26)}<svg class="gs-bar" height="16">${st.bankTrades[p.id] ? `<rect class="gs-seg bank" width="calc(${(st.bankTrades[p.id] / maxV) * 100}% - 1.5px)" height="16" rx="3"/>` : ""}${st.playerTrades[p.id] ? `<rect class="gs-seg ply" x="${(st.bankTrades[p.id] / maxV) * 100}%" width="${(st.playerTrades[p.id] / maxV) * 100}%" height="16" rx="3"/>` : ""}</svg><b>${tot[p.id]}</b></div>`).join("");
    const top = tot.indexOf(Math.max(...tot));
    const title = tot[top] ? `${this._stName(this.players[top])} traded most: ${tot[top]} trades` : "No trades this game";
    return this._stCard("trades", title, `<span class="gs-key bank"></span>bank &amp; harbours <span class="gs-key ply"></span>players`, `<div class="gs-rows">${rows}</div>`);
  },

  _stCardMoments(st) {
    const tw = this._stTurnWord();
    const P = (i) => this.players[i];
    const rows = [];
    const sw = st.swing;
    if (sw.d > 0) rows.push({ ic: "vp", text: `${this._stName(P(sw.pid))} +${sw.d} points in ${tw} ${st.turnOf[sw.s]}` });
    rows.push({ ic: "dice", text: st.leadChanges ? `The lead changed hands ${st.leadChanges}×` : "One leader all game" });
    const lr = st.awards.filter((a) => a.kind === "L");
    if (lr.length) { const last = lr[lr.length - 1]; rows.push({ ic: "longestRoad", text: `${this.sea ? "Longest Trade Route" : "Longest Road"}: ${lr.length > 1 ? `${lr.length} changes, ` : ""}${last.pid >= 0 ? `${this._stName(P(last.pid))} from ${tw} ${st.turnOf[last.s]}` : "nobody at the end"}` }); }
    const la = st.awards.filter((a) => a.kind === "A");
    if (la.length) { const last = la[la.length - 1]; rows.push({ ic: "largestArmy", text: `Largest Army: ${last.pid >= 0 ? `${this._stName(P(last.pid))} from ${tw} ${st.turnOf[last.s]}` : "nobody at the end"}` }); }
    const rt = st.robberTurns, rb = rt.indexOf(Math.max(...rt));
    if (rt[rb] > 0) rows.push({ ic: "robber", text: `The robber sat on ${this._stTile(rb)} for ${rt[rb]} ${tw}s${st.hexBlocked[rb] ? `, blocking ${st.hexBlocked[rb]} cards` : ""}` });
    const builds = this.players.map((p) => { const b = st.built[p.id]; return b.road + b.settlement + b.city + b.ship; });
    const bb = builds.indexOf(Math.max(...builds));
    if (builds[bb]) rows.push({ ic: "build", text: `${this._stName(P(bb))} built the most: ${builds[bb]} pieces` });
    const dv = this.players.map((p) => st.devBought[p.id]); const db = dv.indexOf(Math.max(...dv));
    if (dv[db]) rows.push({ ic: "devcard", text: `${this._stName(P(db))} bought ${dv[db]} development card${dv[db] > 1 ? "s" : ""}` });
    const title = sw.d >= 2 ? `Biggest jump: ${this._stName(P(sw.pid))} +${sw.d} in one ${tw}` : st.leadChanges ? `The lead changed hands ${st.leadChanges}×` : `${this._stName(P(st.winner))} led all game`;
    return this._stCard("moments", title, "", `<ul class="gs-moments">${rows.map((r, i) => `<li style="--i:${i}">${icon(r.ic)}<span>${r.text}</span></li>`).join("")}</ul>`);
  },

  // ── heat maps on the real board ─────────────────────────────────────────────────────────────
  _stCardMap(st, kind) {
    const human = this._stMe() || this.winner || this.players[0];
    const chips = kind === "income" ? `<div class="gs-pchips">${this.players.map((p) => `<button type="button" class="gs-pchip pc-${p.id}${p === human ? " on" : ""}" data-pid="${p.id}">${this._stName(p)}</button>`).join("")}</div>` : "";
    const sub = { prod: "Cards each tile paid out · tap a tile", income: "Which tiles paid whom", robber: `${this.sea ? "Robber and pirate" : "Robber"}: ${this._stTurnWord()}s per tile` }[kind];
    return this._stCard(`map-${kind}`, "", sub, `${chips}<div class="gs-map" data-map="${kind}"${kind === "income" ? ` data-pid="${human.id}"` : ""}><canvas></canvas><div class="gs-best" hidden></div><div class="gs-tip" hidden></div>${st.N > 1 && !motionReduced() ? `<button type="button" class="gs-play" aria-label="Watch it build up">${icon("dice")}<span>▶</span></button>` : ""}</div>`);
  },

  /** Per-hex values up to step t (null = the whole game). */
  _stHeat(st, kind, pid, t = null) {
    const n = this.geometry.hexes.length;
    const v = new Array(n).fill(0);
    const T = t == null ? st.N : t;
    if (kind === "robber") {
      for (let s = 1; s <= T; s += 1) { const r = st.robberAt[s], q = st.pirateAt[s]; if (r != null) v[r] += 1; if (q != null) v[q] += 1; }
      return v;
    }
    for (let s = 0; s <= T; s += 1) st.stepEvents[s].forEach((e) => { if (e[1] === "P" && e[3] >= 0 && (kind === "prod" || e[2] === pid)) v[e[3]] += e[5]; });
    return v;
  },

  _stMapTitle(st, kind, pid, v) {
    // the robber card is titled by land (the pirate's sea tiles show on the map too)
    const land = kind === "robber" && st.sea ? v.map((x, i) => (this.geometry.hexes[i].resource === "sea" ? 0 : x)) : v;
    const best = land.indexOf(Math.max(...land));
    v = land;
    if (!v[best]) return kind === "robber" ? "The robber stayed home" : kind === "income" ? `${this._stName(this.players[pid])} got nothing from the dice` : "No tile paid out";
    const tile = this._stTile(best);
    if (kind === "prod") return `${cap(tile)} paid out most: ${v[best]} cards`;
    if (kind === "robber") return !this.winner && !st.robberMoves && best === st.r0 ? `The robber hasn't moved yet` : `The robber liked ${tile}: ${v[best]} ${this._stTurnWord()}s`;
    const p = this.players[pid];
    return `${this._you(p) ? "Your" : `${p.name}'s`} best tile: ${tile} · ${v[best]} cards`;
  },

  /** A still of the real board (themed renderer, with the pieces) at w×h CSS px, fitted. */
  _stBoardImage(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const view = this._rpFitView(w, h, 4);
    const save = { ctx: this.ctx, bw: this.boardWidth, bh: this.boardHeight, pr: this.pixelRatio, view: this.view, hl: this.highlightRoll };
    this.ctx = c.getContext("2d"); this.boardWidth = w; this.boardHeight = h; this.pixelRatio = dpr; this.view = view; this.highlightRoll = null;
    const anims = this.boardRenderer?.anims;
    try {
      if (this.boardRenderer) { this.boardRenderer.anims = []; this.boardRenderer.draw(performance.now()); } else this.drawCanvasScene();
    } catch (e) { console.warn("board still failed", e); } finally {
      this.ctx = save.ctx; this.boardWidth = save.bw; this.boardHeight = save.bh; this.pixelRatio = save.pr; this.view = save.view; this.highlightRoll = save.hl;
      if (this.boardRenderer) { this.boardRenderer.anims = anims || []; this.boardRenderer.requestDraw(); }
    }
    return { canvas: c, view, dpr };
  },

  _rpFitView(w, h, pad = 6) {
    const g = this.geometry, hs = g.hexSize;
    const xs = g.hexes.map((x) => x.center.x), ys = g.hexes.map((x) => x.center.y);
    const mx = hs * (this.sea ? 0.92 : 1.48), my = hs * (this.sea ? 1.0 : 1.62); // harbour pills included
    const minX = Math.min(...xs) - mx, maxX = Math.max(...xs) + mx, minY = Math.min(...ys) - my, maxY = Math.max(...ys) + my;
    const scale = Math.min((w - 2 * pad) / (maxX - minX), (h - 2 * pad) / (maxY - minY));
    return { scale, offsetX: w / 2 - ((minX + maxX) / 2) * scale, offsetY: h / 2 - ((minY + maxY) / 2) * scale };
  },

  _stMapsInit(pane, st) {
    const maps = [...pane.querySelectorAll(".gs-map")];
    if (!maps.length) return;
    const w = Math.round(maps[0].getBoundingClientRect().width) || 300;
    const h = Math.round(w * (this.sea ? 0.8 : 0.96));
    const img = this._stBoardImage(w, h);
    const heat = getComputedStyle(pane).getPropertyValue("--gs-heat").trim() || "#F5C24A";
    const shade = getComputedStyle(pane).getPropertyValue("--gs-shade").trim() || "#1A2428";
    const g = this.geometry;
    const hexPts = (hex) => (hex.corners || []).map((c) => ({ x: c.x * img.view.scale + img.view.offsetX, y: c.y * img.view.scale + img.view.offsetY }));
    const draw = (el, t = null) => {
      const kind = el.dataset.map, pid = +(el.dataset.pid ?? -1);
      const cv = el.querySelector("canvas");
      if (cv.width !== img.canvas.width) { cv.width = img.canvas.width; cv.height = img.canvas.height; cv.style.aspectRatio = `${w} / ${h}`; }
      const ctx = cv.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img.canvas, 0, 0);
      ctx.setTransform(img.dpr, 0, 0, img.dpr, 0, 0);
      // a calm base: the board slightly desaturated and dimmed, so one warm ramp reads on every terrain
      ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "rgba(128,128,128,.62)"; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      const v = this._stHeat(st, kind, pid, t), vAll = t == null ? v : this._stHeat(st, kind, pid, null);
      const max = Math.max(1, ...vAll);
      if (kind !== "robber") { ctx.fillStyle = "rgba(20,28,32,.22)"; ctx.fillRect(0, 0, w, h); }
      g.hexes.forEach((hex, i) => {
        if (!v[i]) return;
        const pts = hexPts(hex);
        if (!pts.length) return;
        const k = v[i] / max;
        const c = { x: hex.center.x * img.view.scale + img.view.offsetX, y: hex.center.y * img.view.scale + img.view.offsetY };
        const r = g.hexSize * img.view.scale;
        ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        if (kind === "robber") {
          ctx.globalAlpha = 0.12 + 0.5 * k; ctx.fillStyle = shade; ctx.fill(); ctx.globalAlpha = 1;
        } else {
          const gr = ctx.createRadialGradient(c.x, c.y, r * 0.1, c.x, c.y, r);
          gr.addColorStop(0, heat); gr.addColorStop(0.75, heat); gr.addColorStop(1, heat + "99");
          // the tile gets its own colours back, warmed by the gold, in proportion to its value
          ctx.save(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.35 + 0.65 * k; ctx.drawImage(img.canvas, 0, 0); ctx.restore();
          ctx.globalAlpha = 0.12 + 0.48 * k; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
        }
      });
      // the best tile: outlined, labelled on the tile
      const best = vAll.indexOf(Math.max(...vAll));
      const bestEl = el.querySelector(".gs-best");
      if (vAll[best] > 0) {
        const pts = hexPts(g.hexes[best]);
        ctx.beginPath(); pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        ctx.lineWidth = 2.5; ctx.strokeStyle = kind === "robber" ? "rgba(255,255,255,.9)" : "#FFF6D8"; ctx.stroke();
        const c = g.hexes[best].center;
        bestEl.hidden = false;
        bestEl.textContent = kind === "robber" ? `${v[best]} ${this._stTurnWord()}s` : `${v[best]} cards`;
        bestEl.style.left = `${((c.x * img.view.scale + img.view.offsetX) / w) * 100}%`;
        bestEl.style.top = `${((c.y * img.view.scale + img.view.offsetY) / h) * 100}%`;
      } else bestEl.hidden = true;
      const card = el.closest(".gs-card");
      if (t == null) { card.querySelector("h2").textContent = this._stMapTitle(st, kind, pid, vAll); el.dataset.best = String(vAll[best] > 0 ? best : -1); el.dataset.max = String(vAll[best]); }
    };
    maps.forEach((el) => {
      draw(el);
      // tap a tile: its number
      el.querySelector("canvas").addEventListener("click", (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const sx = ((e.clientX - r.left) / r.width) * w, sy = ((e.clientY - r.top) / r.height) * h;
        const wx = (sx - img.view.offsetX) / img.view.scale, wy = (sy - img.view.offsetY) / img.view.scale;
        let hit = null, bd = Infinity;
        g.hexes.forEach((hx) => { const d = Math.hypot(hx.center.x - wx, hx.center.y - wy); if (d < bd) { bd = d; hit = hx; } });
        const tip = el.querySelector(".gs-tip");
        if (!hit || bd > g.hexSize) { tip.hidden = true; return; }
        const v = this._stHeat(st, el.dataset.map, +(el.dataset.pid ?? -1));
        tip.hidden = false;
        tip.textContent = `${cap(this._stTile(hit.id))}: ${v[hit.id]} ${el.dataset.map === "robber" ? `${this._stTurnWord()}s` : "cards"}`;
        tip.style.left = `${(sx / w) * 100}%`; tip.style.top = `${(sy / h) * 100}%`;
      });
      // ▶: watch the heat build up over the game
      el.querySelector(".gs-play")?.addEventListener("click", () => {
        this._stMapStop?.();
        const t0 = performance.now(), dur = 2600;
        el.classList.add("playing");
        let raf = 0;
        const stepF = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          draw(el, Math.round(k * st.N));
          if (k < 1) raf = requestAnimationFrame(stepF); else { el.classList.remove("playing"); draw(el); this._stMapStop = null; }
        };
        raf = requestAnimationFrame(stepF);
        this._stMapStop = () => { cancelAnimationFrame(raf); el.classList.remove("playing"); draw(el); this._stMapStop = null; };
      });
    });
    pane.querySelectorAll(".gs-pchip").forEach((b) => b.addEventListener("click", () => {
      pane.querySelectorAll(".gs-pchip").forEach((x) => x.classList.toggle("on", x === b));
      const el = pane.querySelector('.gs-map[data-map="income"]');
      this._stMapStop?.();
      el.dataset.pid = b.dataset.pid;
      draw(el);
    }));
  },

  // ── replay engine: the real renderer drawing into our own canvas ─────────────────────────────
  _rpOpen(canvas, w, h) {
    if (this._rpSaved) this._rpClose();
    const g = this.geometry;
    this._rpSaved = {
      ctx: this.ctx, bw: this.boardWidth, bh: this.boardHeight, pr: this.pixelRatio, view: this.view, hl: this.highlightRoll,
      robber: this.robberHexId, pirate: this.sea?.pirateHexId ?? null, bonusNode: this.sea ? this.sea.bonusNode : null,
      nodes: g.nodes.map((n) => [n.owner, n.structure]), edges: g.edges.map((e) => [e.owner, !!e.ship]),
      sets: this.players.map((p) => ({ roads: p.roads, ships: p.ships, settlements: p.settlements, cities: p.cities })),
    };
    this._replay = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    this.ctx = canvas.getContext("2d");
    this.boardWidth = w; this.boardHeight = h; this.pixelRatio = dpr;
    this.view = this._rpFitView(w, h, 8);
    this.highlightRoll = null;
    if (this.sea) this.sea.bonusNode = {};
    this.players.forEach((p) => { p.roads = new Set(); p.ships = new Set(); p.settlements = new Set(); p.cities = new Set(); });
    this._rpCur = -1;
    this.boardRenderer?.resync();
    this._rpSeek(0);
  },

  /** Board state after the events of step s. */
  _rpSeek(s) {
    const st = this._st, g = this.geometry;
    if (!st || !this._rpSaved) return;
    s = Math.max(0, Math.min(st.N, s));
    if (s < this._rpCur || this._rpCur < 0) {
      g.nodes.forEach((n) => { n.owner = null; n.structure = null; });
      g.edges.forEach((e) => { e.owner = null; if (e.ship) e.ship = false; });
      this.players.forEach((p) => { p.roads.clear(); p.ships.clear(); p.settlements.clear(); p.cities.clear(); });
      this.robberHexId = st.r0; if (this.sea) this.sea.pirateHexId = st.p0;
      this._rpCur = -1;
      if (s === 0 || this._rpCur < 0) this.boardRenderer?.resync();
    }
    for (let k = this._rpCur + 1; k <= s; k += 1) {
      st.stepEvents[k].forEach((e) => {
        const [, c, a, b, x] = e;
        const p = this.players[a];
        if (c === "b" || c === "u") {
          const add = c === "b";
          if (b === "r" || b === "h") {
            const ed = g.edges[x]; if (!ed) return;
            ed.owner = add ? a : null; if (b === "h") ed.ship = add;
            (b === "h" ? p.ships : p.roads)[add ? "add" : "delete"](x);
          } else {
            const nd = g.nodes[x]; if (!nd) return;
            if (b === "s") { nd.owner = add ? a : null; nd.structure = add ? "settlement" : null; p.settlements[add ? "add" : "delete"](x); if (!add) p.cities.delete(x); }
            else { nd.owner = a; nd.structure = add ? "city" : "settlement"; p.cities[add ? "add" : "delete"](x); p.settlements[add ? "delete" : "add"](x); }
          }
        } else if (c === "R") this.robberHexId = b;
        else if (c === "Q" && this.sea) this.sea.pirateHexId = b;
      });
    }
    this._rpCur = s;
    this.boardRenderer?.requestDraw();
    this._classicDirty = true;
  },

  _rpClose() {
    const S = this._rpSaved;
    if (!S) return;
    const g = this.geometry;
    g.nodes.forEach((n, i) => { [n.owner, n.structure] = S.nodes[i]; });
    g.edges.forEach((e, i) => { e.owner = S.edges[i][0]; if (S.edges[i][1]) e.ship = true; else if (e.ship) e.ship = false; });
    this.players.forEach((p, i) => Object.assign(p, S.sets[i]));
    this.robberHexId = S.robber;
    if (this.sea) { this.sea.pirateHexId = S.pirate; this.sea.bonusNode = S.bonusNode; }
    this.ctx = S.ctx; this.boardWidth = S.bw; this.boardHeight = S.bh; this.pixelRatio = S.pr; this.view = S.view; this.highlightRoll = S.hl;
    this._rpSaved = null;
    this._replay = false;
    this._rpCur = -1;
    this.boardRenderer?.resync();
    this.boardRenderer?.invalidateStatic();
    this._classicDirty = true;
    try { this.drawCanvasScene(); } catch (_) {}
  },

  /** A fast timelapse of the builds into a canvas; returns { stop }. */
  _rpTimelapse(canvas, dur = 2500, onEnd = null) {
    const st = this._st;
    if (!st || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    this._rpOpen(canvas, Math.round(r.width) || innerWidth, Math.round(r.height) || innerHeight);
    const t0 = performance.now();
    let raf = 0, stopped = false;
    const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); this._rpClose(); };
    const stepF = () => {
      if (stopped) return;
      const k = Math.min(1, (performance.now() - t0) / dur);
      this._rpSeek(Math.round(k * st.N));
      if (k < 1) raf = requestAnimationFrame(stepF); else { raf = 0; onEnd?.(); }
    };
    raf = requestAnimationFrame(stepF);
    return { stop };
  },

  /** Replay (slow, controllable) or Timelapse (2.5 s, full screen). */
  _rpStart(mode = "replay") {
    const st = this._st;
    if (!st || this._rpUi) return;
    const ov = this._stOverlay;
    if (ov) ov.hidden = true;
    const ui = document.createElement("div");
    ui.className = `gs-replay tm ${mode}`;
    const maxV = Math.max(this.winPoints, ...st.vp[st.N]);
    ui.innerHTML = mode === "replay" ? `
      <div class="gs-rp-top">${this.players.map((p) => `<div class="gs-vpr pc-${p.id}" data-pid="${p.id}">${this._stPortrait(p.id, "", 24)}<span class="gs-vpt"><b style="width:0%"></b></span><span class="gs-vpv">0</span></div>`).join("")}</div>
      <div class="gs-rp-board"><canvas></canvas><svg class="gs-rp-glow" aria-hidden="true"></svg><div class="gs-rp-dice"></div></div>
      <div class="gs-rp-ctl">
        <div class="gs-rp-row"><button type="button" class="gs-rp-play" aria-label="Pause"><svg viewBox="0 0 20 20" aria-hidden="true"><path class="pz" d="M5 3h3.4v14H5zM11.6 3H15v14h-3.4z"/><path class="pl" d="M6 3.2v13.6c0 .8.9 1.3 1.6.8l9.4-6.8c.6-.4.6-1.2 0-1.6L7.6 2.4C6.9 1.9 6 2.4 6 3.2z"/></svg></button>
          <div class="gs-rp-cap"><b></b><span></span></div>
          <div class="gs-rp-speed" role="group" aria-label="Speed"><button type="button" data-speed="1" class="on">1×</button><button type="button" data-speed="4">4×</button></div>
          <button type="button" class="gs-rp-x" aria-label="Close replay">✕</button></div>
        <input type="range" class="gs-rp-scrub" min="0" max="${st.N}" value="0" aria-label="Turn">
      </div>`
      : `<div class="gs-rp-board"><canvas></canvas></div><div class="gs-skip">tap to close</div>`;
    this._stHost().appendChild(ui);
    this._rpUi = ui;
    const cv = ui.querySelector("canvas");
    const exit = () => this._rpExit();
    if (mode === "timelapse") {
      const tl = this._rpTimelapse(cv, 2500, () => window.setTimeout(exit, 700));
      this._rpStopTl = () => tl?.stop();
      ui.addEventListener("pointerdown", exit);
      return;
    }
    const br = cv.parentElement.getBoundingClientRect();
    this._rpOpen(cv, Math.round(br.width), Math.round(br.height));
    const glow = ui.querySelector(".gs-rp-glow");
    glow.setAttribute("viewBox", `0 0 ${Math.round(br.width)} ${Math.round(br.height)}`);
    const reduced = motionReduced();
    const R = { s: 0, playing: true, speed: 1, timer: 0 };
    this._rp = R;
    const playBtn = ui.querySelector(".gs-rp-play"), scrub = ui.querySelector(".gs-rp-scrub");
    const cap1 = ui.querySelector(".gs-rp-cap b"), cap2 = ui.querySelector(".gs-rp-cap span"), dice = ui.querySelector(".gs-rp-dice");
    const show = (s, animate) => {
      this._rpSeek(s);
      R.s = s;
      scrub.value = String(s);
      const step = st.steps?.[s - 1] || this.stats.steps[s - 1];
      cap1.textContent = s === 0 ? "Set-up" : this.isRush() ? `Roll ${s}` : `Turn ${step[0]}`;
      const roller = step && step[1] >= 0 ? this.players[step[1]] : null;
      cap2.textContent = s === 0 ? "first settlements" : `${roller ? `${this._stName(roller)} rolled` : "rolled"} ${step[2] + step[3]}`;
      dice.innerHTML = step ? dieSvg(step[2]) + dieSvg(step[3]) : "";
      // VP bars
      ui.querySelectorAll(".gs-vpr").forEach((row) => { const v = st.vp[s][+row.dataset.pid]; row.querySelector("b").style.width = `${(v / maxV) * 100}%`; row.querySelector(".gs-vpv").textContent = v; });
      // producing tiles glow (a calm warm outline), the robber's tile excluded
      glow.innerHTML = "";
      if (step && step[2] + step[3] !== 7) {
        const roll = step[2] + step[3], robber = st.robberAt[s];
        const V = this.view;
        glow.innerHTML = this.geometry.hexes.filter((h) => h.number === roll && h.id !== robber).map((h) => `<polygon class="${animate && !reduced ? "fade" : ""}" points="${(h.corners || []).map((c) => `${(c.x * V.scale + V.offsetX).toFixed(1)},${(c.y * V.scale + V.offsetY).toFixed(1)}`).join(" ")}"/>`).join("");
      }
      // awards fly to their new holder
      if (animate && !reduced) st.stepEvents[s].filter((e) => e[1] === "a" && e[3] >= 0).forEach((e) => this._rpFlyAward(ui, e[2], e[3]));
    };
    const stepMs = () => (R.s === 0 ? 1100 : 700) / R.speed;
    const loop = () => {
      window.clearTimeout(R.timer);
      if (!R.playing) return;
      R.timer = window.setTimeout(() => {
        if (!this._rpUi || !R.playing) return;
        if (R.s >= st.N) { R.playing = false; playBtn.classList.add("paused"); playBtn.setAttribute("aria-label", "Play"); return; }
        show(R.s + 1, true);
        loop();
      }, stepMs());
    };
    playBtn.addEventListener("click", () => {
      R.playing = !R.playing;
      if (R.playing && R.s >= st.N) show(0, false);
      playBtn.classList.toggle("paused", !R.playing);
      playBtn.setAttribute("aria-label", R.playing ? "Pause" : "Play");
      loop();
    });
    ui.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
      R.speed = +b.dataset.speed;
      ui.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("on", x === b));
      loop();
    }));
    scrub.addEventListener("input", () => { show(+scrub.value, false); loop(); });
    ui.querySelector(".gs-rp-x").addEventListener("click", exit);
    ui.querySelector(".gs-rp-board").addEventListener("click", exit);
    show(0, true);
    loop();
  },

  _rpFlyAward(ui, kind, pid) {
    const row = ui.querySelector(`.gs-vpr[data-pid="${pid}"]`), board = ui.querySelector(".gs-rp-board");
    if (!row || !board) return;
    const a = board.getBoundingClientRect(), b = row.getBoundingClientRect(), u = ui.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = `gs-fly pc-${pid}`;
    el.innerHTML = icon(kind === "A" ? "largestArmy" : "longestRoad") + "+2";
    el.style.left = `${a.left - u.left + a.width / 2}px`; el.style.top = `${a.top - u.top + a.height / 2}px`;
    ui.appendChild(el);
    const dx = b.right - 40 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    el.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 1, offset: 0.25 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 }],
      { duration: 900, easing: "cubic-bezier(.3,.1,.3,1)", fill: "forwards" }).onfinish = () => el.remove();
  },

  _rpExit(silent = false) {
    const ui = this._rpUi;
    if (this._rp) { window.clearTimeout(this._rp.timer); this._rp = null; }
    this._rpStopTl?.(); this._rpStopTl = null;
    if (this._rpSaved) this._rpClose();
    if (!ui) return;
    this._rpUi = null;
    ui.remove();
    if (!silent && this._stOverlay) { this._stOverlay.hidden = false; this.render(); }
  },
};
