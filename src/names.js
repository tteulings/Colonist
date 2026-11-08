// Pass & play names, remembered on this device (localStorage "colonist_names_v1").
//   { v: 1, me: "Tim", list: [{ n: "Tim", at: <last used>, g: <games> }] }  at most 12 names, newest first.
// `me` is the name of the person who starts the game (seat 0): the New game screen offers it again. Every
// function is try/catch: a private window just forgets the names.
const KEY = "colonist_names_v1";
const MAX = 12;
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
    el.innerHTML = `<div class="nm-card"><div class="nm-h"><h3>Names on this phone</h3><button type="button" class="nm-x" data-close aria-label="Close">✕</button></div>
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
