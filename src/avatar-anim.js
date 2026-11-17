// v1.91 avatar animations: the controller. The art (src/themes/portraits.js) carries the rig groups; themes/avatar.css animates them.
// This file only sets attributes on the inline avatars (.avatar.av-live) so the CSS knows what to play:
//   idle   .av-idle on avatars of 40px and up, with a random blink period (4-7 s) per seat, kept continuous across re-renders
//   turn   data-avt  ring pulse + hop on the seat whose turn it is
//   react  data-avr  happy | sad | seven, from the game log (build, big payout, robbed, a 7); one per avatar at a time, never queued
//   think  data-avk  three dots while a bot is on the move
// The strip is re-rendered on every change, so each effect lives in a small state table and is re-applied to the new elements with a
// negative animation delay (it carries on instead of restarting). Transform / opacity only: no layout shift.
import { avatarAnimOn, motionReduced } from "./themes/manager.js";

const REACT_MS = { happy: 1100, sad: 1500, seven: 1300 };
const TURN_MS = 1800, THINK_MS = 1800, COOLDOWN_MS = 500, BIG_PAYOUT = 3;
let rs = (Math.floor(performance.now() * 1000) % 2147483646) + 1;
const rnd = () => { rs = (rs * 48271) % 2147483647; return rs / 2147483647; }; // own stream: the game's dice are never touched
const seatOf = (el) => { const m = /\bpc-(\d)\b/.exec(el.className.baseVal ?? el.className); return m ? +m[1] : -1; };

const st = new Map(); // pid -> { react, turn, think, until, bp, off }
const seat = (pid) => { let s = st.get(pid); if (!s) { s = { react: null, turn: null, think: null, until: 0, bp: 4 + rnd() * 3, off: rnd() * 7000 }; st.set(pid, s); } return s; };
const now = () => performance.now();
let game = null, lastCur = null, lastCurAt = 0, queued = false;

export const avatarsOn = () => avatarAnimOn() && !(typeof document !== "undefined" && document.hidden);
const live = (pid) => document.querySelectorAll(pid == null ? ".avatar.av-live" : `.avatar.av-live.pc-${pid}`);

function paint(el, width) {
  const pid = seatOf(el), s = pid >= 0 ? seat(pid) : null, t = now(), on = avatarAnimOn();
  if (!s || !on) { for (const a of ["avr", "avt", "avk"]) delete el.dataset[a]; el.classList.remove("av-idle"); return; }
  const big = width >= 40; // lists and the 24-34px strip chips stay still; reactions still play on them
  el.classList.toggle("av-idle", big);
  if (big) {
    const ph = (period) => -(((t + s.off) % period) / 1000);
    el.style.setProperty("--av-bp", s.bp.toFixed(2) + "s");
    el.style.setProperty("--av-bd", (ph(s.bp * 1000)).toFixed(2) + "s");
    el.style.setProperty("--av-sd", ph(7400).toFixed(2) + "s");
  }
  const one = (key, v, dvar) => { if (v && t - v.t0 < v.dur) { el.dataset[key] = v.kind || "1"; el.style.setProperty(dvar, (-(t - v.t0) / 1000).toFixed(3) + "s"); } else delete el.dataset[key]; };
  one("avr", s.react, "--av-rd"); one("avt", s.turn, "--av-td"); one("avk", s.think, "--av-kd");
}
/** Apply the state to every live avatar that has not been painted yet (a re-render makes new ones). */
function sweep(all = false) {
  queued = false;
  if (typeof document === "undefined") return;
  const els = [...document.querySelectorAll(all ? ".avatar.av-live" : ".avatar.av-live:not([data-av-ok])")];
  const widths = els.map((el) => el.getBoundingClientRect().width); // all reads first, then the writes
  els.forEach((el, i) => { paint(el, widths[i]); el.dataset.avOk = "1"; });
  watchTurn();
}
const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => sweep()); } };

function endLater(pid, key, ms) {
  setTimeout(() => {
    const s = seat(pid);
    if (s[key] && now() - s[key].t0 >= s[key].dur - 30) { s[key] = null; live(pid).forEach((el) => { delete el.dataset[{ react: "avr", turn: "avt", think: "avk" }[key]]; }); }
  }, ms + 60);
}

/** Play a reaction on one seat (all its live avatars). One at a time per avatar: a busy or cooling-down avatar ignores it (no queue). */
export function react(pid, kind, only = null) {
  if (!avatarsOn() || motionReduced()) return false;
  const s = seat(pid), t = now();
  if ((s.react && t - s.react.t0 < s.react.dur) || t < s.until) return false;
  const dur = REACT_MS[kind] || 1100;
  s.react = { kind, t0: t, dur }; s.until = t + dur + COOLDOWN_MS;
  (only ? [only] : [...live(pid)]).forEach((el) => { el.dataset.avr = kind; el.style.setProperty("--av-rd", "0s"); if (only) { setTimeout(() => { if (s.react && s.react.t0 === t) delete el.dataset.avr; }, dur + 60); } });
  if (!only) endLater(pid, "react", dur);
  return true;
}

function pidOf(text) {
  let best = null;
  for (const p of game?.players || []) { const n = p.name; if (n && text.startsWith(n + " ") && (!best || n.length > best.name.length)) best = p; }
  return best ? best.id : -1;
}
/** The game log is the event stream: builds, payouts, robberies and sevens all pass through addLog(). */
export function avatarLogEvent(g, text) {
  try {
    game = g;
    if (!g.fx || typeof text !== "string" || !avatarsOn() || !document.querySelector(".avatar.av-live")) return;
    if (/\brolled 7\.?$/.test(text)) { for (const p of g.players) react(p.id, "seven"); return; }
    const who = pidOf(text);
    if (/ (built a settlement|upgraded to a city)\.?$/.test(text)) { if (who >= 0) react(who, "happy"); return; }
    if (who >= 0 && /\bcollects?\b/.test(text)) { const n = (text.match(/\d+/g) || []).reduce((a, b) => a + +b, 0); if (n >= BIG_PAYOUT) react(who, "happy"); return; }
    const m = / stole .* from (.+?)\.?$/.exec(text);
    if (m) { const v = g.players.find((p) => p.name === m[1]); if (v) react(v.id, "sad"); }
  } catch (_) { /* an animation must never break the game */ }
}

/** Whose turn it is (ring pulse + hop) and whether that seat is a bot on the move (dots). Read after each re-render. */
function watchTurn() {
  const g = game;
  if (!g?.players || !avatarsOn()) return;
  const cur = g.currentPlayerIndex, t = now();
  if (cur !== lastCur) {
    if (lastCur != null) { const o = seat(lastCur); o.turn = null; o.think = null; live(lastCur).forEach((el) => { delete el.dataset.avt; delete el.dataset.avk; }); }
    lastCur = cur; lastCurAt = t;
    if (cur != null && cur >= 0 && !motionReduced()) {
      const s = seat(cur); s.turn = { t0: t, dur: TURN_MS }; endLater(cur, "turn", TURN_MS);
      live(cur).forEach((el) => { el.dataset.avt = "1"; el.style.setProperty("--av-td", "0s"); });
    }
  }
  const p = g.players[cur];
  if (p && !p.isHuman && !g.winner && !motionReduced() && !seat(cur).think && (t - lastCurAt < 400 || g._masterBusy?.pid === cur)) {
    const s = seat(cur); s.think = { t0: t, dur: THINK_MS }; endLater(cur, "think", THINK_MS);
    live(cur).forEach((el) => { el.dataset.avk = "1"; el.style.setProperty("--av-kd", "0s"); });
  }
}

/** Start watching the page: new avatars get their state; a tap on a past game's winner plays happy. */
export function initAvatarAnim(g) {
  game = g;
  if (typeof document === "undefined" || initAvatarAnim.done) return;
  initAvatarAnim.done = true;
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(".avatar.av-live.av-tap");
    if (el) react(seatOf(el), "happy", el);
  }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) sweep(true); });
  later();
}
/** Re-apply to every avatar (the Settings toggle, a language or theme change). */
export const refreshAvatars = () => sweep(true);
/** Test hook. */
export const _state = () => ({ st, lastCur });
