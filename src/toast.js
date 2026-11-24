// v1.99 Toast (design system 10): one style for every short notice. One at a time (a new one replaces the old), role="status",
// an optional action ("Undo", "Change") that is a 44 x 44 target, gone after 3 s (5 s with an action). It sits 12 px above the tab bar
// (or above the game's dock). Text is plain English: the localizer turns it into Dutch like every other text on the page.
const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const HISTORY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4h4M12 8v4.5l3 1.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const TOAST_ICONS = { moon: MOON, check: CHECK, history: HISTORY };

let cur = null;

/** toast({ text, icon: "moon" | "check" | "history" | svg, action: { label, onClick }, ms }) -> { close() } */
export function toast({ text, icon = "", action = null, ms } = {}) {
  if (typeof document === "undefined") return { close() {} };
  closeToast(true);
  const el = document.createElement("div");
  el.className = "sh-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  const ic = TOAST_ICONS[icon] || icon;
  el.innerHTML = `${ic ? `<span class="sh-toast-ic" aria-hidden="true">${ic}</span>` : ""}<span class="sh-toast-tx"></span>${action ? `<button type="button" class="sh-toast-act"></button>` : ""}`;
  el.querySelector(".sh-toast-tx").textContent = text;
  const t = { el, timer: 0, close: () => { if (cur === t) closeToast(); } };
  if (action) {
    const b = el.querySelector(".sh-toast-act");
    b.textContent = action.label;
    b.addEventListener("click", () => { t.close(); try { action.onClick?.(); } catch (_) { /* the action is the caller's */ } });
  }
  let sx = 0;
  el.addEventListener("pointerdown", (e) => { sx = e.clientX; });
  el.addEventListener("pointerup", (e) => { if (Math.abs(e.clientX - sx) > 60) t.close(); }); // swipe it away
  document.body.appendChild(el);
  cur = t;
  t.timer = window.setTimeout(() => t.close(), ms || (action ? 5000 : 3000));
  return t;
}

/** Fade the toast out (180 ms); `now`: gone at once (a new one is coming). */
export function closeToast(now = false) {
  const t = cur;
  if (!t) return;
  cur = null;
  clearTimeout(t.timer);
  if (now) { t.el.remove(); return; }
  t.el.classList.add("out");
  window.setTimeout(() => t.el.remove(), 190);
}

export const toastOpen = () => !!cur;
