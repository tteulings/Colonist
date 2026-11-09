// v1.04 bot profiles in the UI: the level frame around a bot's avatar, the profile bottom sheet (tap a bot
// chip, an (i) in the new-game picker, a row in Settings › Bots) and the small pieces they share.
// Texts and illustrations live in bot-profiles.js; this file only builds DOM strings and wires the sheet.
import { BOT_PROFILES as P, profileArt, profileMini, levelFrame } from "./bot-profiles.js";
import { avatarSvg } from "./themes/manager.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The profile key a bot shows: its preset, or (hand-tuned mix) the closest preset with `custom` set. */
export function profileOf(game, player) {
  if (!player || player.isHuman || !player.strategy) return null;
  const key = player.personality;
  if (P[key]) return { key, custom: false };
  const closest = game._closestPreset?.(player.strategy);
  return { key: P[closest] ? closest : "intermediate", custom: true };
}

/** Strength dots (1–5). */
export const dots = (n, cls = "bp-dots", beyond = false) => `<span class="${cls}" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}${beyond ? `<i class="star"></i>` : ""}</span>`; // v1.10: "beyond" = the Super Expert's sixth mark, a star

/** "Wins 29% vs 3 Intermediate bots" or, for the Master (never measured against them), "+8 pp vs Expert". */
export function strengthLine(key) {
  const p = P[key];
  if (key === "super" || key === "superplus") return `<span class="bp-win">Win figure <b>not measured yet</b></span>`;
  if (key === "master") return `<span class="bp-win"><b>+8 pp</b> win chance vs an Expert</span>`;
  return p.win ? `<span class="bp-win">Wins <b>${Math.round(p.win.p)}%</b> vs 3 Intermediate bots <span class="bp-fair">(fair share 25%)</span></span>` : "";
}

/** An avatar with its profile frame (bots only; a human or a bot without a profile gets the plain avatar). */
export function framedAvatar(game, player, cls = "") {
  const html = avatarSvg(player.id, cls);
  const pr = profileOf(game, player);
  if (!pr) return html;
  const frame = levelFrame(pr.custom ? "custom" : pr.key, 40);
  return html.replace(/<\/span>\s*$/, `${frame}</span>`);
}

/** Spoken suffix for a chip's aria-label. */
export function profileLabel(game, player) {
  const pr = profileOf(game, player);
  return pr ? `, ${pr.custom ? "custom" : P[pr.key].label} bot` : "";
}

/** The Super Expert is searched on the island board (v1.17: Rush and 5–6 players too), not in Seafarers. With `why`: the sentence for this table when it isn't. */
export function superHere(game, why = false) {
  const ok = !game || !game.players || !game.sea;
  if (!why) return ok;
  return "Not searched at this table (Seafarers): here a Super Expert plays exactly like an Expert.";
}

const row = (cls, glyph, title, text) => `<div class="bp-row"><span class="ic2 ${cls}" aria-hidden="true">${glyph}</span><div><b>${title}</b>${text}</div></div>`;

/** What a bot did this game, counted from the stats event log. */
function soFar(game, pid) {
  const ev = game.stats?.ev || [];
  const me = game._me?.();
  const name = (id) => (game.players[id] === me ? "You" : game.players[id]?.short || game.players[id]?.name);
  let trades = 0, withYou = 0, bank = 0, robs = 0;
  const cards = {}, stole = {};
  ev.forEach((e) => {
    const [, c, a, b] = e;
    if (c === "x" && (a === pid || b === pid)) { trades += 1; if (game.players[a === pid ? b : a] === me) withYou += 1; }
    if (c === "k" && a === pid) bank += 1;
    if (c === "R" && a === pid) robs += 1;
    if (c === "t" && a === pid) stole[b] = (stole[b] || 0) + 1;
    if (c === "y" && a === pid) cards[b] = (cards[b] || 0) + 1;
  });
  const DEV = { knight: "Knight", monopoly: "Monopoly", yearOfPlenty: "Year of Plenty", roadBuilding: "Road Building" };
  const st = Object.entries(stole).sort((x, y) => y[1] - x[1]).map(([id, n]) => `${esc(name(+id))} ×${n}`).join(", ") || "nobody yet";
  const cd = Object.entries(cards).map(([t, n]) => `${DEV[t] || t} ×${n}`).join(", ") || "none yet";
  return `<div class="bp-game"><h4>This game so far</h4><ul>
    <li><span>Player trades</span><span>${trades}${withYou ? ` (${withYou} with you)` : ""}</span></li>
    <li><span>Bank &amp; harbour trades</span><span>${bank}</span></li>
    <li><span>Robber moves</span><span>${robs}</span></li>
    <li><span>Stole from</span><span>${st}</span></li>
    <li><span>Cards played</span><span>${cd}</span></li></ul></div>`;
}

/** The long part, behind the (i): style, good at, weak spot, trading, robber, dev cards and where the figures come from. */
function details(key) {
  const p = P[key];
  const src = p.win ? `Measured: 2000 games against 3 Intermediate bots (±${p.win.ci} pts).` : key === "master" ? "Measured: 500 games against 3 Experts (±5.4 pts)." : key === "super" || key === "superplus" ? p.note : "";
  return `<p class="bp-style">${p.style}</p>
    <div class="bp-rows">${row("good", "+", "Good at", p.good)}${row("weak", "−", "Weak spot", p.weak)}
    ${row("trade", "⇄", "Trading", p.trades)}${row("rob", "♟", "Robber", p.robber)}${row("card", "★", "Dev cards", p.cards)}</div>
    <p class="bp-src">${src}${p.acc ? ` Review accuracy ${p.acc[0]} ± ${p.acc[1]}: its own moves checked by deep Monte Carlo (1000 futures), the same scale as the review screen.` : ""}</p>`;
}

let openEl = null;
export function closeSheet() {
  if (!openEl) return;
  document.removeEventListener("keydown", openEl.onKey);
  openEl.nodes.forEach((n) => n.remove());
  openEl = null;
}

/**
 * The profile sheet. opts: { player } for a bot at the table (avatar, "This game so far", Change style) or
 * { key } for a plain preset (new-game picker).
 */
export function openProfileSheet(game, opts = {}) {
  closeSheet();
  const player = opts.player || null;
  const pr = player ? profileOf(game, player) : null;
  const key = pr ? pr.key : opts.key;
  const p = P[key];
  if (!p) return;
  const who = player
    ? `<span class="bp-av">${framedAvatar(game, player)}</span><div class="bp-id"><div class="nm">${esc(player.name)} · ${pr.custom ? `Custom <small>(like ${p.label})</small>` : p.label}</div><div class="sub">${p.tagline}</div></div>`
    : `<span class="bp-av bp-av-mini">${profileMini(key, 28)}</span><div class="bp-id"><div class="nm">${p.label}</div><div class="sub">${p.tagline}</div></div>`;
  const html = `<div class="bp-scrim" data-bp-close></div>
    <div class="bp-sheet" role="dialog" aria-label="${esc(player ? player.name + ": " : "")}${p.label} profile">
      <div class="bp-grab"></div>
      <div class="bp-who">${who}<button type="button" class="bp-x" data-bp-close aria-label="Close">✕</button></div>
      <div class="bp-hero">${profileArt(key, 132)}</div>
      <div class="bp-meter">${dots(p.level, "bp-dots", p.beyond)}<span>${p.beyond ? `Strength ${p.level}/5 + star` : `Strength ${p.level}/5`}</span></div>
      ${(key === "super" || key === "superplus") && player && !superHere(game) ? `<p class="bp-warn" role="status">${superHere(game, true).replace("a Super Expert", `a ${p.label}`)}</p>` : ""}
      ${(key === "master" || key === "super" || key === "superplus") && player && game?.players && !game.sea && (game.isRush?.() || game.players.length >= 5) ? `<p class="bp-warn" role="status">${game.isRush?.() ? "Rush: this bot's search is capped at a quarter of a second a move, and Rush is searched as turn-by-turn play (approximate). " : ""}${game.players.length >= 5 ? `${game.players.length} players: fewer playouts fit in the same time, so its edge is smaller (not measured).` : ""}</p>` : ""}
      <div class="bp-strength">${strengthLine(key)}</div>
      ${player ? soFar(game, player.id) : ""}
      <div class="bp-rows bp-beat">${row("beat", "✓", "How to beat it", p.beat)}</div>
      <button type="button" class="bp-more-btn" aria-expanded="false" data-bp-more><span class="bp-i" aria-hidden="true">i</span>About this profile<span class="bp-chev" aria-hidden="true">▾</span></button>
      <div class="bp-details" hidden>${details(key)}</div>
      <div class="bp-actions">${player ? `<button type="button" data-bp-style>Change style</button>` : ""}<button type="button" class="pri" data-bp-close>Close</button></div>
    </div>`;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const nodes = [...wrap.children];
  nodes.forEach((n) => document.body.appendChild(n));
  const sheet = nodes[1];
  const onKey = (e) => { if (e.key === "Escape") closeSheet(); };
  document.addEventListener("keydown", onKey);
  openEl = { nodes, onKey };
  nodes.forEach((n) => n.addEventListener("click", (e) => {
    if (e.target.closest("[data-bp-close]")) closeSheet();
    else if (e.target.closest("[data-bp-style]")) { closeSheet(); game.settingsUI?.open("bots"); }
    else if (e.target.closest("[data-bp-more]")) {
      const btn = sheet.querySelector("[data-bp-more]"), box = sheet.querySelector(".bp-details");
      const on = box.hidden;
      box.hidden = !on; btn.setAttribute("aria-expanded", String(on));
      if (on) box.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }));
  sheet.querySelector("button.pri")?.focus({ preventScroll: true });
}

/** Mini emblem + strength dots + (i) on a new-game preset button. */
export function pickerExtras(key) {
  const p = P[key];
  if (!p) return "";
  return `<span class="bp-pmini" aria-hidden="true">${profileMini(key, 20)}</span>${dots(p.level, "bp-pdots", p.beyond)}<span class="bp-pi" role="button" tabindex="0" data-info="${key}" aria-label="About the ${p.label} profile"><span aria-hidden="true">i</span></span>`;
}

/** Settings › Bots: "At this table", one row per bot. Tap the row = pick that bot; (i) = its profile sheet. */
export function tableList(game, { sel = null, onSelect = null } = {}) {
  const bots = game.players.filter((b) => b.strategy && !b.isHuman);
  if (!bots.length) return null;
  const box = document.createElement("div");
  box.className = "bt-table";
  const prs = bots.map((b) => profileOf(game, b));
  const same = prs.every((x) => !x.custom && x.key === prs[0].key);
  box.innerHTML = `<h4>${same && bots.length > 1 ? `${bots.length} × ${P[prs[0].key].label}` : "At this table"}</h4>` + bots.map((b, n) => {
    const pr = prs[n];
    const p = P[pr.key];
    const on = sel === b.id;
    return `<div class="bt-row${on ? " sel" : ""}"><button type="button" class="bt-bot pc-${b.id}" data-seat="${b.id}" aria-pressed="${on}" aria-label="${esc(b.name)}: ${pr.custom ? "custom mix" : p.label}. Pick this bot">
      <span class="bt-av">${framedAvatar(game, b)}</span>
      <span class="bt-txt"><span class="nm">${esc(b.name)}</span><span class="pf"><span class="bt-em">${profileMini(pr.key, 18)}</span><b>${pr.custom ? "Custom" : p.label}</b>${pr.custom ? `<small>like ${p.label}</small>` : ""}${dots(p.level, "bp-dots bs-dots", p.beyond)}</span></span></button>
      <button type="button" class="bt-info" data-info-seat="${b.id}" aria-label="${esc(b.name)}: profile"><span aria-hidden="true">i</span></button></div>`;
  }).join("");
  box.addEventListener("click", (e) => {
    const i = e.target.closest(".bt-info");
    if (i) return openProfileSheet(game, { player: game.players[Number(i.dataset.infoSeat)] });
    const t = e.target.closest(".bt-bot");
    if (t) { if (onSelect) onSelect(Number(t.dataset.seat)); else openProfileSheet(game, { player: game.players[Number(t.dataset.seat)] }); }
  });
  return box;
}

/**
 * Settings › Bots: the preset cards (2 columns). `hl` is presetHighlight() of the bots being edited;
 * the lit card is hl.active, a hand-tuned mix outlines its closest preset. onPick(key) applies, (i) opens the sheet.
 */
/** "Seafarers" / "Rush" / "5–6 players" when the Super Expert is not searched in this game, else "". */
export const superOff = (game) => (superHere(game) ? "" : "Seafarers");

export function presetCards(game, keys, hl, onPick) {
  const box = document.createElement("div");
  box.className = "bs-grid";
  box.innerHTML = keys.map((k) => {
    const p = P[k];
    const on = hl.active === k, near = hl.active === "custom" && hl.closest === k;
    const off = k === "super" || k === "superplus" ? superOff(game) : "";
    return `<div class="bs-cell"><button type="button" class="bs-card${on ? " on" : ""}${near ? " near" : ""}${off ? " off" : ""}" data-preset="${k}" aria-pressed="${on}"${off ? ` disabled aria-disabled="true"` : ""} aria-label="${p.label}, strength ${p.level} of 5${p.beyond ? " plus a star" : ""}, ${off ? `not in ${off}` : p.tagline}">
      <span class="bs-art">${profileArt(k, 56)}</span>
      <span class="bs-nm">${p.label}${on ? `<span class="bs-ck" aria-hidden="true">✓</span>` : ""}</span>
      ${dots(p.level, "bp-dots bs-dots", p.beyond)}
      <span class="bs-tag">${off ? `Not in ${off}` : p.tagline}</span></button>
      <button type="button" class="bs-i" data-info="${k}" aria-label="About the ${p.label} profile"><span aria-hidden="true">i</span></button></div>`;
  }).join("");
  box.addEventListener("click", (e) => {
    const i = e.target.closest(".bs-i");
    if (i) return openProfileSheet(game, { key: i.dataset.info });
    const c = e.target.closest(".bs-card");
    if (c) onPick(c.dataset.preset);
  });
  return box;
}
