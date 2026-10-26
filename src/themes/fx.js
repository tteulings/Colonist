// DOM motion effects (Web Animations API) — dice, card flights, steal flip, development-card reveal,
// badge transfer, confetti, turn spotlight. Durations/easings come from the active theme's motion
// personality (theme.motion, see SPEC §2). With reduced motion every effect becomes a short
// cross-fade to its end state; the information (who got what) stays visible in the Journal.
// Effects never block input: game flow is driven by the game's own timers, not by these animations.
import { motionReduced, dieSvg, cardSvg, cardBackSvg, icon } from "./manager.js";
import { DEV_NAME } from "./art-util.js";

const rect = (el) => el?.getBoundingClientRect?.();
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export class Fx {
  constructor(game) {
    this.game = game;
    this.layer = document.getElementById("fxLayer");
    if (!this.layer) {
      this.layer = document.createElement("div");
      this.layer.id = "fxLayer";
      document.body.appendChild(this.layer);
    }
  }

  get M() { return this.game.theme.motion; }
  get reduced() { return motionReduced(); }

  /** WAAPI with the theme's tempo; reduced motion → 220 ms cross-fade to the end state. */
  A(el, frames, o) {
    if (this.reduced) {
      const last = frames[frames.length - 1];
      const end = Object.fromEntries(Object.entries(last).filter(([k]) => k !== "offset" && k !== "easing"));
      frames = [{ ...end, opacity: o.from0 ? 0 : last.opacity ?? 1 }, { ...end }];
      o = { ...o, duration: 220, delay: Math.min(o.delay || 0, 200), iterations: 1, easing: "linear" };
    } else {
      o = { ...o, duration: o.duration * this.M.k, delay: (o.delay || 0) * this.M.k };
    }
    delete o.from0;
    return el.animate(frames, { fill: "both", ...o });
  }

  actor(html, x, y, w, cls = "") {
    const el = document.createElement("div");
    el.className = `fx-actor ${cls}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (w) el.style.width = `${w}px`;
    el.innerHTML = html;
    this.layer.appendChild(el);
    return el;
  }

  /** Remove `els` once `ms` (theme tempo) has passed. */
  later(els, ms) {
    const k = this.reduced ? 0.4 : this.M.k;
    window.setTimeout(() => els.forEach((e) => e.remove()), ms * k + 60);
  }

  boardRect() { return rect(this.game.canvas) || { left: 0, top: 0, width: innerWidth, height: innerHeight }; }

  // ── dice tumble + bounce ────────────────────────────────────────────────
  /** Plays the dice landing on (d1, d2). Returns the time (ms) after which the result should apply. */
  diceRoll(d1, d2) {
    const br = this.boardRect();
    const size = Math.max(46, Math.min(64, br.width * 0.07));
    const ex = br.left + br.width / 2 - size, ey = br.top + br.height * 0.42;
    const dice = [d1, d2].map((fin, i) => {
      const el = this.actor(`<div class="die3">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face" data-n="${n}">${dieSvg(n)}</div>`).join("")}</div>`, 0, 0, size, "fx-die");
      el.style.height = `${size}px`;
      const tx = ex + i * size * 1.15, ty = ey + i * 6;
      const sx = br.left + br.width * 0.18, sy = br.top - size;
      const M = this.M;
      const kf = [{ transform: `translate(${sx}px,${sy - i * 20}px) rotate(${-200 + i * 40}deg) scale(.9)`, offset: 0, easing: M.fall }];
      for (let b = 0; b < M.bounces; b += 1) {
        const p = 0.45 + b * (0.4 / M.bounces), px = sx + (tx - sx) * (0.7 + (b * 0.3) / M.bounces), hy = size * 0.55 / (b + 1);
        kf.push({ transform: `translate(${px}px,${ty}px) rotate(${-60 + b * 50}deg) scale(${M.squash[0]},${M.squash[1]})`, offset: p, easing: M.out });
        kf.push({ transform: `translate(${px + 10}px,${ty - hy}px) rotate(${-20 + b * 20}deg) scale(1)`, offset: p + 0.2 / M.bounces, easing: M.fall });
      }
      kf.push({ transform: `translate(${tx}px,${ty}px) rotate(${i ? 6 : -4}deg) scale(1)`, offset: 1 });
      this.A(el, kf, { duration: 1000, delay: i * 70 });
      el.querySelectorAll(".face").forEach((fc, n) => {
        if (this.reduced) { fc.style.opacity = n + 1 === fin ? 1 : 0; return; }
        this.A(fc, Array.from({ length: 9 }, (_, s) => ({ opacity: s === 8 ? +(n + 1 === fin) : +((n + s * (i + 2)) % 6 === 0), offset: s / 8, easing: "steps(1,end)" })), { duration: 900, delay: i * 70 });
      });
      return el;
    });
    const sum = this.actor(`<span>${d1 + d2}</span>`, ex + size * 2.4, ey - size * 0.15, size * 0.95, "fx-sum");
    this.A(sum, [{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1)" }], { duration: 400, delay: 1050, easing: this.M.pop });
    const all = [...dice, sum];
    const out = 1500;
    window.setTimeout(() => all.forEach((e) => this.A(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 })), out * (this.reduced ? 0.3 : this.M.k));
    this.later(all, out + 320);
    return this.reduced ? 380 : 1150 * this.M.k;
  }

  // ── resources fly tile → hand (+n) ──────────────────────────────────────
  /** gainByPlayer: [{wood:1,...}, …] for the roll `number`. */
  flyResources(gainByPlayer, number) {
    const g = this.game;
    const br = this.boardRect();
    const cw = Math.max(30, Math.min(46, br.width * 0.04));
    let stagger = 0;
    gainByPlayer.forEach((gain, pid) => {
      Object.entries(gain).forEach(([res, n]) => {
        if (!n) return;
        // source: a producing hex of that resource next to this player
        const hex = g.geometry.hexes.find((h) => h.number === number && h.resource === res && h.id !== g.robberHexId && h.nodes.some((nid) => g.geometry.nodes[nid].owner === pid)) ||
          g.geometry.hexes.find((h) => h.number === number && h.resource === res);
        const cr = rect(g.canvas);
        const sp = hex ? g.worldToScreen(hex.center.x, hex.center.y) : { x: br.width / 2, y: br.height / 2 };
        const scaleX = cr.width / g.boardWidth, scaleY = cr.height / g.boardHeight;
        const src = { x: cr.left + sp.x * scaleX, y: cr.top + sp.y * scaleY };
        for (let i = 0; i < n; i += 1) {
          const delay = 250 + stagger * 160;
          stagger += 1;
          window.setTimeout(() => this.flyOne(res, src, pid, cw, i === n - 1 ? n : 0), delay * (this.reduced ? 0.2 : this.M.k));
        }
      });
    });
  }

  targetFor(pid, res) {
    const g = this.game;
    if (g.players[pid]?.isHuman) {
      const card = document.querySelector(`#resourceCardStrip .card[data-card="${res}"]`);
      if (card && card.offsetParent) return card;
    }
    return g.playerAnchor(pid);
  }

  flyOne(res, src, pid, cw, plusN) {
    const target = this.targetFor(pid, res);
    const tr = rect(target);
    if (!tr) return;
    const dst = center(tr);
    const el = this.actor(cardSvg(res), src.x - cw / 2, src.y - cw * 0.7, cw, "fx-card");
    const dx = dst.x - src.x, dy = dst.y - src.y;
    const human = this.game.players[pid]?.isHuman;
    const endScale = human ? Math.min(1.2, tr.width / cw) : 0.55;
    this.A(el, [
      { transform: "translate(0,0) scale(.2) rotate(0deg)", opacity: 0, offset: 0 },
      { transform: `translate(${dx * 0.06}px,${-cw * 1.1}px) scale(1.15) rotate(-8deg)`, opacity: 1, offset: 0.3, easing: this.M.inOut },
      { transform: `translate(${dx * 0.55}px,${dy * 0.35 - cw}px) scale(1) rotate(8deg)`, offset: 0.6, easing: this.M.inOut },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(0deg)`, opacity: 1, offset: 0.95 },
      { transform: `translate(${dx}px,${dy}px) scale(${endScale}) rotate(0deg)`, opacity: 0, offset: 1 },
    ], { duration: 1000 });
    this.later([el], 1050);
    window.setTimeout(() => {
      const t = this.targetFor(pid, res);
      if (!t) return;
      this.A(t, [{ transform: "scale(1)" }, { transform: "scale(1.16) rotate(-4deg)", offset: 0.5 }, { transform: "scale(1)" }], { duration: 400, easing: this.M.pop, fill: "none" });
      if (plusN) this.plus(t, plusN);
    }, 1000 * (this.reduced ? 0.25 : this.M.k));
  }

  plus(target, n) {
    const r = rect(target);
    if (!r) return;
    const el = this.actor(`+${n}`, r.left + r.width / 2, r.top - 6, 0, "fx-plus");
    this.A(el, [{ opacity: 0, transform: "translate(-50%,10px) scale(.6)" }, { opacity: 1, transform: "translate(-50%,-6px) scale(1.1)", offset: 0.4 }, { opacity: 1, transform: "translate(-50%,-14px) scale(1)", offset: 0.8 }, { opacity: 0, transform: "translate(-50%,-24px) scale(1)" }], { duration: 900, easing: this.M.out });
    this.later([el], 950);
  }

  // ── steal: card flips to the thief ──────────────────────────────────────
  steal(thiefId, victimId, res, showFace) {
    const g = this.game;
    const from = rect(g.playerAnchor(victimId)), to = rect(g.playerAnchor(thiefId));
    if (!from || !to) return;
    const cw = 52;
    const a = center(from), b = center(to);
    const el = this.actor(`<div class="flip"><div class="back">${cardBackSvg()}</div><div class="front">${cardSvg(res)}</div></div>`, a.x - cw / 2, a.y - cw * 0.7, cw, "fx-card fx-steal");
    const midX = (a.x + b.x) / 2 - a.x, midY = Math.min(a.y, b.y) - a.y + 90;
    this.A(el, [
      { transform: "translate(0,0) scale(.5) rotate(-10deg)", opacity: 0 },
      { transform: `translate(${midX}px,${midY}px) scale(1.2) rotate(0)`, opacity: 1, offset: 0.3, easing: this.M.pop },
      { transform: `translate(${midX}px,${midY}px) scale(1.25)`, offset: 0.7 },
      { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(.55) rotate(6deg)`, opacity: 0.9 },
    ], { duration: 1300, easing: this.M.inOut });
    if (showFace && !this.reduced) {
      this.A(el.querySelector(".back"), [{ transform: "rotateY(0)" }, { transform: "rotateY(0)", offset: 0.3 }, { transform: "rotateY(90deg)", offset: 0.45 }, { transform: "rotateY(90deg)" }], { duration: 1300 });
      this.A(el.querySelector(".front"), [{ transform: "rotateY(-90deg)" }, { transform: "rotateY(-90deg)", offset: 0.45 }, { transform: "rotateY(0)", offset: 0.6, easing: this.M.pop }, { transform: "rotateY(0)" }], { duration: 1300 });
    } else if (showFace) {
      el.querySelector(".back").style.opacity = 0;
    } else {
      el.querySelector(".front").style.opacity = 0;
    }
    this.later([el], 1350);
  }

  // ── development card reveal ─────────────────────────────────────────────
  devReveal(type) {
    const br = this.boardRect();
    const cw = Math.max(110, Math.min(170, br.width * 0.16));
    const cx = br.left + br.width / 2, cy = br.top + br.height * 0.45;
    const rays = this.actor("", cx, cy, 0, "fx-rays");
    const el = this.actor(`<div class="flip"><div class="back">${cardBackSvg()}</div><div class="front">${cardSvg(type, true)}</div></div>`, cx - cw / 2, cy - cw * 0.7, cw, "fx-card fx-dev");
    const lbl = this.actor(`${DEV_NAME[type] || "Card"}!`, cx, cy + cw * 0.78, 0, "fx-devlbl");
    this.A(el, [{ transform: "translateY(160px) scale(.6)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.35, easing: this.M.pop }, { transform: "translateY(-4px) scale(1.08)", offset: 0.7 }, { transform: "translateY(0) scale(1.05)" }], { duration: 1300, easing: this.M.out });
    if (!this.reduced) {
      this.A(el.querySelector(".back"), [{ transform: "rotateY(0)" }, { transform: "rotateY(0)", offset: 0.35 }, { transform: "rotateY(90deg)", offset: 0.5 }, { transform: "rotateY(90deg)" }], { duration: 1300 });
      this.A(el.querySelector(".front"), [{ transform: "rotateY(-90deg)" }, { transform: "rotateY(-90deg)", offset: 0.5 }, { transform: "rotateY(0)", offset: 0.68, easing: this.M.pop }, { transform: "rotateY(0)" }], { duration: 1300 });
      this.A(rays, [{ opacity: 0, transform: "translate(-50%,-50%) rotate(0) scale(.4)" }, { opacity: 0, offset: 0.45 }, { opacity: 1, transform: "translate(-50%,-50%) rotate(40deg) scale(1)", offset: 0.7 }, { opacity: 0.8, transform: "translate(-50%,-50%) rotate(80deg) scale(1.05)" }], { duration: 1500, easing: this.M.out });
    } else {
      el.querySelector(".back").style.opacity = 0;
      rays.style.display = "none";
    }
    this.A(lbl, [{ opacity: 0, transform: "translate(-50%,8px)" }, { opacity: 1, transform: "translate(-50%,0)" }], { duration: 400, delay: 950, easing: this.M.pop });
    const all = [rays, el, lbl];
    window.setTimeout(() => all.forEach((e) => this.A(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 })), 2300 * (this.reduced ? 0.6 : this.M.k));
    this.later(all, 2750);
  }

  /** A bought development card: face-up, it glides from the Buy button into your hand (no splash). */
  devToHand(type, fromRect) {
    const target = document.querySelector(`#resourceCardStrip .card[data-dev="${type}"]`) || document.querySelector("#resourceCardStrip");
    const tr = rect(target);
    if (!tr) return;
    const cw = Math.max(40, Math.min(64, tr.width || 56));
    const src = fromRect ? center(fromRect) : { x: innerWidth / 2, y: tr.top - 80 };
    const dst = center(tr);
    const el = this.actor(cardSvg(type), src.x - cw / 2, src.y - cw * 0.7, cw, "fx-card fx-devfly");
    const dx = dst.x - src.x, dy = dst.y - src.y;
    this.A(el, [
      { transform: "translate(0,0) scale(.5)", opacity: 0 },
      { transform: `translate(${dx * 0.4}px,${dy * 0.4 - 40}px) scale(1.1)`, opacity: 1, offset: 0.45, easing: this.M.inOut },
      { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 1, offset: 0.92 },
      { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 0 },
    ], { duration: 750, easing: this.M.out });
    this.later([el], 800);
  }

  // ── badge transfer (Longest Road / Largest Army) ────────────────────────
  badge(kind, fromId, toId) {
    const g = this.game;
    const to = rect(g.playerAnchor(toId));
    if (!to) return;
    const br = this.boardRect();
    const from = fromId != null ? rect(g.playerAnchor(fromId)) : { left: br.left + br.width / 2 - 20, top: br.top + br.height / 2 - 20, width: 40, height: 40 };
    const a = center(from), b = center(to);
    const s = 48;
    const el = this.actor(icon(kind), a.x - s / 2, a.y - s / 2, s, "fx-badge");
    el.style.height = `${s}px`;
    const dx = b.x - a.x, dy = b.y - a.y;
    this.A(el, [
      { transform: "translate(0,0) scale(1) rotate(0)", opacity: fromId != null ? 1 : 0 },
      { transform: "translate(0,-10px) scale(1.3) rotate(-10deg)", opacity: 1, offset: 0.2, easing: this.M.inOut },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 60}px) scale(1.5) rotate(10deg)`, offset: 0.55, easing: this.M.inOut },
      { transform: `translate(${dx}px,${dy}px) scale(1.1) rotate(0)`, offset: 0.85, easing: this.M.out },
      { transform: `translate(${dx}px,${dy}px) scale(.8) rotate(0)`, opacity: 0 },
    ], { duration: 1300 });
    this.later([el], 1350);
    window.setTimeout(() => {
      const t = g.playerAnchor(toId);
      if (t) this.A(t, [{ boxShadow: "0 0 0 0 rgba(255,210,70,0)" }, { boxShadow: "0 0 0 12px rgba(255,210,70,.6)", offset: 0.5 }, { boxShadow: "0 0 0 3px rgba(255,210,70,0)" }], { duration: 700, easing: this.M.out, fill: "none" });
    }, 1050 * (this.reduced ? 0.2 : this.M.k));
  }

  // ── victory confetti ────────────────────────────────────────────────────
  confetti(container) {
    if (this.reduced || !container) return;
    const cols = this.game.theme.confettiColors || ["#D9714E", "#E2C27A", "#3CA9B0"];
    const r = rect(container);
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 36; i += 1) {
      const el = document.createElement("i");
      el.className = "fx-conf";
      el.style.left = `${(i * 37) % Math.max(200, r.width)}px`;
      el.style.background = cols[i % cols.length];
      container.appendChild(el);
      const x = (rnd() - 0.5) * 160, rot = 360 + rnd() * 540, fall = r.height * (0.75 + rnd() * 0.2);
      el.animate([{ transform: "translate(0,-30px) rotate(0)", opacity: 1 }, { transform: `translate(${x * 0.6}px,${fall * 0.45}px) rotate(${rot * 0.5}deg)`, offset: 0.5 }, { transform: `translate(${x}px,${fall}px) rotate(${rot}deg)`, opacity: 0 }],
        { duration: (1500 + rnd() * 400) * this.M.k * 1.4, delay: 150 + rnd() * 300, easing: "cubic-bezier(.3,.1,.6,1)", fill: "both" });
      window.setTimeout(() => el.remove(), 3200);
    }
  }

  /** Pop-in for an element (game-over panel, trophy). */
  pop(el, delay = 0) {
    if (el) this.A(el, [{ transform: "scale(.7)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 600, delay, easing: this.M.pop, from0: true });
  }

  // ── turn spotlight ──────────────────────────────────────────────────────
  spotlight(pid) {
    const g = this.game;
    const anchor = g.playerAnchor(pid);
    const r = rect(anchor);
    if (r && g.isMobileLayout && !g.players[pid].isHuman) {
      const c = center(r);
      const el = this.actor("", 0, 0, 0, "fx-spot");
      el.style.setProperty("--sx", `${c.x}px`);
      el.style.setProperty("--sy", `${c.y}px`);
      this.A(el, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1300, easing: this.M.out });
      this.later([el], 1350);
    }
    if (anchor) this.A(anchor, [{ transform: "scale(1)" }, { transform: "scale(1.06)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 600, delay: 200, easing: this.M.pop, fill: "none" });
    const banner = document.getElementById("turnBanner");
    if (banner && banner.offsetParent) this.A(banner, [{ transform: "translateY(-12px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 600, easing: this.M.pop, fill: "none" });
  }
}
