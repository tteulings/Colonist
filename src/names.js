// Pass & play names, remembered on this device (localStorage "colonist_names_v1").
//   { v: 1, me: "Tim", list: [{ n: "Tim", at: <last used>, g: <games> }] }  at most 12 names, newest first.
// `me` is the name of the person who starts the game (seat 0): the New game screen offers it again. Every
// function is try/catch: a private window just forgets the names.
import { oicon } from "./ui-icons.js";
import * as MGR from "./themes/manager.js"; // namespace import: a stale cached manager.js must not stop this module
import { PERSONAS } from "./themes/portraits.js";
const KEY = "colonist_names_v1";
const MAX = 12;
/** v1.87 the ONE display-name policy: a bot is always shown under the same short form (strip, end screen, Overview
 *  columns, headline, Luck tab, review prose, AI page, Past games). a bot is Blaauw / Geelen / Groen / De Wit / Pimpel, never "Van Geelen" in one place and "Geelen" in
 *  another; the full persona names stay in the profile sheet. Older saved games are mapped on read. */
const DISPLAY = { "Van Geelen": "Geelen", "Kolonel Van Geelen": "Geelen", "Groenewoud": "Groen", "Dominee Groenewoud": "Groen" };
export const dispName = (n) => (n != null && Object.prototype.hasOwnProperty.call(DISPLAY, n) ? DISPLAY[n] : n);
export const cleanName = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 14);
export const sameName = (a, b) => cleanName(a).toLowerCase() === cleanName(b).toLowerCase() && !!cleanName(a);

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && d.v === 1 && Array.isArray(d.list)) return { v: 1, me: cleanName(d.me), list: d.list.filter((x) => x && cleanName(x.n)).map((x) => ({ n: cleanName(x.n), at: +x.at || 0, g: +x.g || 0 })) };
  } catch (_) { /* none yet */ }
  return { v: 1, me: "", list: [] };
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { /* private mode */ } return d; }

export const Names = {
  list() { return load().list.sort((a, b) => b.at - a.at); },
  me() { return load().me; },
  /** v1.99.3: your own name, set from the character sheet (shown in Settings; the game still calls you "You"). */
  setMe(n) { const d = load(); d.me = cleanName(n); save(d); return d.me; },
  /** A game started with these people (seat order; the first is `me`). */
  remember(names, now = Date.now()) {
    const d = load();
    names.map(cleanName).filter(Boolean).forEach((n) => {
      const x = d.list.find((y) => sameName(y.n, n));
      if (x) { x.at = now; x.g += 1; } else d.list.push({ n, at: now, g: 1 });
    });
    const first = cleanName(names[0]);
    if (first) d.me = first;
    d.list.sort((a, b) => b.at - a.at);
    d.list = d.list.slice(0, MAX);
    save(d);
  },
  /** Names to offer as chips: not already at this table. */
  suggest(taken = [], n = 5) { return Names.list().map((x) => x.n).filter((x) => !taken.some((t) => sameName(t, x))).slice(0, n); },
  /** Rename; onto an existing name it merges the two. Returns the final name (or null when nothing changed). */
  rename(from, to) {
    to = cleanName(to);
    if (!to || sameName(from, to) && from === to) return null;
    const d = load();
    const a = d.list.find((x) => sameName(x.n, from));
    if (!a) return null;
    const b = d.list.find((x) => x !== a && sameName(x.n, to));
    if (b) { b.g += a.g; b.at = Math.max(a.at, b.at); b.n = to; d.list = d.list.filter((x) => x !== a); } else a.n = to;
    if (sameName(d.me, from)) d.me = to;
    save(d);
    return to;
  },
  remove(n) {
    const d = load();
    d.list = d.list.filter((x) => !sameName(x.n, n));
    if (sameName(d.me, n)) d.me = "";
    save(d);
  },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/** "Manage names" sheet: rename (onto another name = merge) and forget. onRename(from, to) lets the history follow. */
export function openNamesSheet({ onRename, onChange } = {}) {
  document.querySelector(".nm-sheet")?.remove();
  const el = document.createElement("div");
  el.className = "nm-sheet";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Names on this phone");
  let editing = null;
  const draw = () => {
    const list = Names.list();
    el.innerHTML = `<div class="nm-card"><div class="nm-h"><h3>Names on this phone</h3><button type="button" class="nm-x" data-close aria-label="Close">${oicon("close")}</button></div>
      ${list.length ? `<ul class="nm-list">${list.map((x, i) => `<li>${editing === i ? `<input class="nm-in" data-in="${i}" value="${esc(x.n)}" maxlength="14" aria-label="New name for ${esc(x.n)}"><button type="button" class="nm-b pri" data-save="${i}">Save</button>`
        : `<b>${esc(x.n)}</b><small>${x.g} game${x.g === 1 ? "" : "s"}</small><button type="button" class="nm-b" data-edit="${i}">Rename</button><button type="button" class="nm-b" data-del="${i}" aria-label="Forget ${esc(x.n)}">Forget</button>`}</li>`).join("")}</ul>
        <p class="nm-note">Renaming to a name that exists merges the two, also in Past games.</p>` : `<p class="nm-note">No names yet. They are kept after your first pass &amp; play game.</p>`}
      <button type="button" class="nm-done" data-close>Done</button></div>`;
    el.querySelector(".nm-in")?.focus();
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (e.target === el || b?.hasAttribute("data-close")) { el.remove(); onChange?.(); return; }
    if (!b) return;
    const list = Names.list();
    if (b.dataset.edit != null) { editing = +b.dataset.edit; draw(); }
    else if (b.dataset.del != null) { Names.remove(list[+b.dataset.del].n); onChange?.(); draw(); }
    else if (b.dataset.save != null) {
      const from = list[+b.dataset.save].n, to = Names.rename(from, el.querySelector(".nm-in").value);
      editing = null;
      if (to) { onRename?.(from, to); onChange?.(); }
      draw();
    }
  });
  document.body.appendChild(el);
  draw();
}

// ── v1.99.3 characters: pick your own character, and who sits against you ─────────────────────────────
// A look is a permutation of the six characters, look[seat] = the character in that seat (seat 0 is you). Each character has one fixed
// colour, so a pick is a colour too; every character sits at most once, so picking one that already sits elsewhere swaps the two.
const CHAR_KEYS = ["rosa", "blaauw", "geelen", "groenewoud", "dewit", "pimpel"];
const CHAR_LABEL = ["Rosa", "Blaauw", "Geelen", "Groen", "De Wit", "Pimpel"];
const CHAR_COLOUR = ["Red", "Blue", "Orange", "Green", "Ivory", "Purple"];
export const charLabel = (c) => CHAR_LABEL[c] || PERSONAS[CHAR_KEYS[c]]?.name || "";
/** The grid of characters. mode "me": every character can be picked (one at the table swaps with you); mode "seat" (an opponent): the characters already at the table are greyed. */
export function charGridHtml({ look, numBots, mode = "me", seat = 0 }) {
  const here = look[seat], inUse = (c) => look.indexOf(c) <= numBots;
  return `<div class="ch-grid" role="radiogroup" aria-label="${mode === "me" ? "Your character" : "Opponent"}">${CHAR_KEYS.map((_, c) => {
    const on = c === here, used = mode === "seat" && !on && inUse(c);
    const av = MGR.avatarChar ? MGR.avatarChar(c, "ch-av", true) : "";
    return `<button type="button" role="radio" class="ch-opt${on ? " on" : ""}${used ? " used" : ""}" data-ch="${c}" aria-checked="${on}"${used ? " disabled" : ""}>${av}<b>${esc(charLabel(c))}</b><small>${CHAR_COLOUR[c]}</small>${used ? `<small class="ch-u">At the table</small>` : ""}</button>`;
  }).join("")}</div>`;
}
/** The look after picking character c for a seat: c swaps places with whoever has it now. */
export function pickChar(look, seat, c) {
  const out = look.slice(), from = out.indexOf(c);
  if (from < 0 || from === seat) return out;
  [out[seat], out[from]] = [out[from], out[seat]];
  return out;
}
/** Standalone sheet (Settings): your character and name. onLook(look) saves the pick; it starts with your next game. */
export function openCharacterSheet({ look, numBots = 3, onLook, onClose } = {}) {
  document.querySelector(".ch-sheet")?.remove();
  const el = document.createElement("div");
  el.className = "nm-sheet ch-sheet";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Your character");
  let cur = look.slice();
  const draw = () => {
    el.innerHTML = `<div class="nm-card"><div class="nm-h"><h3>Your character</h3><button type="button" class="nm-x" data-close aria-label="Close">${oicon("close")}</button></div>
      <p class="nm-note ch-note">Your character has its own colour. Bots play the others. Starts with your next game.</p>
      ${charGridHtml({ look: cur, numBots, mode: "me", seat: 0 })}
      <label class="ch-name"><span>Your name</span><input class="nm-in" data-me value="${esc(Names.me())}" placeholder="You" maxlength="14" autocomplete="off" spellcheck="false"></label>
      <button type="button" class="nm-done" data-close>Done</button></div>`;
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (e.target === el || b?.hasAttribute("data-close")) { el.remove(); onClose?.(); return; }
    if (b?.dataset.ch != null) { cur = pickChar(cur, 0, +b.dataset.ch); onLook?.(cur); draw(); el.querySelector(".ch-opt.on")?.focus({ preventScroll: true }); }
  });
  el.addEventListener("input", (e) => { if (e.target.matches("[data-me]")) Names.setMe(e.target.value); });
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { el.remove(); onClose?.(); } });
  document.body.appendChild(el);
  draw();
  el.querySelector(".ch-opt.on")?.focus({ preventScroll: true });
  return el;
}
