// Sound engine: soft, warm, tactile board-game sounds, synthesised with Web Audio.
// No samples and no raw square/saw beeps: wooden knocks are short sine "bodies" with a
// band-passed noise "contact", cards and paper are swept noise, chimes are low sines with a
// soft attack. Everything runs through a gentle low-pass, a small room reverb and a
// compressor, so nothing ever sounds harsh or clips.
//
// Usage (game.js): const snd = new SoundEngine({ enabled: () => game.soundEnabled });
//   snd.play("buildRoad"); snd.play("resourceGain", ["wood", "ore"]); snd.setVolume(0.6);
// The AudioContext is only created after the first user gesture (autoplay policy); calls
// before that are silently dropped. renderSound() draws any sound into an OfflineAudioContext
// (used by the sound test page).

const VOLUME_KEY = "colonist_volume";
export const DEFAULT_VOLUME = 0.6;

export function loadVolume() {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v == null || v === "") return DEFAULT_VOLUME;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_VOLUME;
  } catch (_) { return DEFAULT_VOLUME; }
}
export function saveVolume(v) {
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch (_) {}
}

// Perceptual slider → gain (slider 60% ≈ -9 dB below full scale of the mix)
const sliderToGain = (v) => Math.pow(Math.min(1, Math.max(0, v)), 1.7);

// ── Per-context shared buffers ─────────────────────────────────────────
const noiseCache = new WeakMap();
const irCache = new WeakMap();

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const len = Math.floor(ctx.sampleRate * 2);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  const r = rng(0xc0105);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  noiseCache.set(ctx, b);
  return b;
}

// Small warm room: decaying noise, darkened over time (one-pole low-pass with falling cutoff)
function roomIR(ctx) {
  let b = irCache.get(ctx);
  if (b) return b;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.9);
  b = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    const r = rng(0xbeef + ch * 977);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const k = Math.exp(-t * 9) * 0.55 + 0.04; // smoothing coefficient: duller as it decays
      y += k * ((r() * 2 - 1) - y);
      const pre = t < 0.008 ? t / 0.008 : 1;
      d[i] = y * Math.exp(-t / 0.16) * pre;
    }
  }
  irCache.set(ctx, b);
  return b;
}

// ── Output chain ───────────────────────────────────────────────────────
// bus → tone low-pass → master gain → compressor → out;  bus → reverb send → master
export function buildChain(ctx, destination = ctx.destination, volume = DEFAULT_VOLUME) {
  const bus = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 5200;
  tone.Q.value = 0.5;
  const master = ctx.createGain();
  master.gain.value = sliderToGain(volume);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  const send = ctx.createGain();
  send.gain.value = 0.16;
  const verb = ctx.createConvolver();
  verb.normalize = true;
  verb.buffer = roomIR(ctx);
  const verbLp = ctx.createBiquadFilter();
  verbLp.type = "lowpass";
  verbLp.frequency.value = 2600;
  bus.connect(tone).connect(master);
  bus.connect(send).connect(verb).connect(verbLp).connect(master);
  master.connect(comp).connect(destination);
  return { bus, master };
}

// ── Building blocks (all take an absolute start time t) ────────────────
class Synth {
  constructor(ctx, out) { this.ctx = ctx; this.out = out; }

  _env(t, attack, peak, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  _osc(type, f, t, end) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end + 0.02);
    return o;
  }

  _noise(t, end) {
    const n = this.ctx.createBufferSource();
    n.buffer = noiseBuffer(this.ctx);
    const off = (t * 7.31) % 1.5; // different slice per hit, still deterministic
    n.start(t, off, end - t + 0.05);
    return n;
  }

  _filter(type, f, q = 0.707) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  /** Wooden knock: pitched sine body (with a quick downward bend) + a short noise contact. */
  knock(t, { f = 320, decay = 0.07, g = 0.3, click = 0.35, q = 3, bend = 1.35, partial = 0.25 } = {}) {
    const end = t + decay + 0.01;
    const body = this._osc("sine", f * bend, t, end);
    body.frequency.exponentialRampToValueAtTime(f, t + 0.018);
    body.connect(this._env(t, 0.002, g, decay)).connect(this.out);
    if (partial > 0) {
      const p = this._osc("sine", f * 2.76, t, end); // wood-bar overtone, dies fast
      p.connect(this._env(t, 0.0015, g * partial, decay * 0.4)).connect(this.out);
    }
    if (click > 0) {
      const n = this._noise(t, t + 0.03);
      n.connect(this._filter("bandpass", Math.min(f * 3.2, 3200), q))
        .connect(this._filter("lowpass", 3800))
        .connect(this._env(t, 0.001, g * click, 0.018)).connect(this.out);
    }
  }

  /** Soft low thud: felt-covered weight on a wooden table. */
  thud(t, { f = 95, decay = 0.22, g = 0.45, felt = 0.25 } = {}) {
    const end = t + decay + 0.02;
    const o = this._osc("sine", f * 1.9, t, end);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
    o.connect(this._env(t, 0.004, g, decay)).connect(this.out);
    if (felt > 0) {
      const n = this._noise(t, t + 0.06);
      n.connect(this._filter("lowpass", 420)).connect(this._env(t, 0.003, g * felt * 2, 0.05)).connect(this.out);
    }
  }

  /** Mellow mallet / bell tone: sine (or triangle) with soft attack, low-passed. */
  tone(t, { f = 392, decay = 0.6, g = 0.12, attack = 0.008, type = "sine", lp = 2400, overtone = 0.12 } = {}) {
    const end = t + attack + decay;
    const lpf = this._filter("lowpass", lp);
    lpf.connect(this.out);
    const o = this._osc(type, f, t, end);
    o.connect(this._env(t, attack, g, decay)).connect(lpf);
    if (overtone > 0) {
      const o2 = this._osc("sine", f * 3, t, end);
      o2.connect(this._env(t, attack * 0.7, g * overtone, decay * 0.25)).connect(lpf);
    }
  }

  /** Swept noise: paper, cards, sliding. */
  swish(t, { dur = 0.18, f0 = 2400, f1 = 1000, q = 1.1, g = 0.2, rise = 0.35, lp = 4200 } = {}) {
    const end = t + dur;
    const n = this._noise(t, end);
    const bp = this._filter("bandpass", f0, q);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, end);
    const e = this.ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(g, t + dur * rise);
    e.gain.exponentialRampToValueAtTime(0.0001, end);
    n.connect(bp).connect(this._filter("lowpass", lp)).connect(e).connect(this.out);
  }
}

const jitter = (x, amt) => x * (1 + (Math.random() * 2 - 1) * amt);

// Resource "marimba" pitches (a low pentatonic, so any mix sounds consonant)
const RES_PITCH = { ore: 165, wood: 196, brick: 220, wheat: 294, sheep: 330 };
const PENTA = [165, 196, 220, 262, 294, 330];

// ── The sounds. Each: (synth, startTime, arg) → duration in seconds ────
export const SOUNDS = {
  diceRoll(s, t) {
    // two wooden dice tumbling on a board: irregular clacks that slow and soften
    const hits = [0, 0.055, 0.12, 0.165, 0.245, 0.3, 0.39, 0.47, 0.585];
    hits.forEach((dt, i) => {
      const k = 1 - i / hits.length;
      s.knock(t + dt + Math.random() * 0.012, {
        f: jitter(i % 2 ? 610 : 720, 0.12), decay: 0.035 + k * 0.02, g: 0.07 + 0.17 * k,
        click: 0.55, q: 2.5, partial: 0.18,
      });
    });
    s.thud(t, { f: 150, decay: 0.09, g: 0.16, felt: 0.15 }); // board answers the first drop
    s.swish(t + 0.03, { dur: 0.55, f0: 900, f1: 500, q: 0.8, g: 0.025, rise: 0.2 }); // rolling bed
    return 0.8;
  },
  diceResult(s, t) {
    // dice come to rest: two quiet low clacks
    s.knock(t, { f: 520, decay: 0.05, g: 0.11, click: 0.35, partial: 0.12 });
    s.knock(t + 0.07, { f: 470, decay: 0.06, g: 0.08, click: 0.3, partial: 0.1 });
    return 0.3;
  },
  resourceGain(s, t, list) {
    // soft wooden mallet notes, one per resource kind (max 3), pitch per resource
    const res = Array.isArray(list) && list.length ? [...new Set(list)].slice(0, 3) : null;
    const notes = res ? res.map((r) => RES_PITCH[r] || 262) : [PENTA[Math.floor(Math.random() * PENTA.length)]];
    const g = res ? 0.11 : 0.055; // bots-only gains are quieter
    notes.sort((a, b) => a - b).forEach((f, i) => {
      const at = t + i * 0.075 + Math.random() * 0.01;
      const ff = jitter(f, 0.012);
      s.tone(at, { f: ff, decay: 0.38, g: jitter(g, 0.1), attack: 0.004, lp: 1800, overtone: 0.18 });
      s.knock(at, { f: ff * 2, decay: 0.02, g: g * 0.35, click: 0.2, partial: 0 });
    });
    return 0.6 + notes.length * 0.075;
  },
  buildRoad(s, t) {
    s.knock(t, { f: 250, decay: 0.08, g: 0.36, click: 0.35, partial: 0.2 });
    s.knock(t + 0.045, { f: 290, decay: 0.05, g: 0.12, click: 0.3, partial: 0.15 });
    return 0.35;
  },
  buildSettlement(s, t) {
    s.thud(t, { f: 118, decay: 0.16, g: 0.36, felt: 0.18 });
    s.knock(t, { f: 330, decay: 0.09, g: 0.3, click: 0.35, partial: 0.22 });
    s.knock(t + 0.065, { f: 360, decay: 0.04, g: 0.08, click: 0.3, partial: 0.1 });
    return 0.45;
  },
  buildCity(s, t) {
    s.thud(t, { f: 100, decay: 0.2, g: 0.42, felt: 0.2 });
    s.knock(t, { f: 290, decay: 0.1, g: 0.3, click: 0.35, partial: 0.22 });
    s.knock(t + 0.09, { f: 370, decay: 0.08, g: 0.2, click: 0.3, partial: 0.18 });
    [196, 247, 294].forEach((f, i) => s.tone(t + 0.13 + i * 0.03, { f, decay: 0.9, g: 0.05, attack: 0.025, lp: 1600, overtone: 0.08 }));
    return 1.2;
  },
  robber(s, t) {
    s.thud(t, { f: 68, decay: 0.34, g: 0.42, felt: 0.3 });
    s.knock(t + 0.004, { f: 180, decay: 0.06, g: 0.1, click: 0.2, partial: 0 });
    return 0.5;
  },
  /** v0.81: "your move, robber" — a low knock and a soft two-note lift (the robber gets up). */
  robberPrompt(s, t) {
    s.knock(t, { f: 210, decay: 0.08, g: 0.22, click: 0.3, partial: 0.2 });
    s.tone(t + 0.08, { f: 294, decay: 0.5, g: 0.07, attack: 0.012, lp: 1800, overtone: 0.08 });
    s.tone(t + 0.2, { f: 392, decay: 0.6, g: 0.06, attack: 0.012, lp: 1800, overtone: 0.08 });
    return 0.9;
  },
  steal(s, t) {
    s.swish(t, { dur: 0.22, f0: 1500, f1: 650, q: 1.0, g: 0.24, rise: 0.4, lp: 2400 });
    s.swish(t + 0.1, { dur: 0.12, f0: 1100, f1: 600, q: 1.2, g: 0.07, rise: 0.3, lp: 2400 });
    return 0.35;
  },
  trade(s, t) {
    s.knock(t, { f: 560, decay: 0.045, g: 0.2, click: 0.3, partial: 0.15 });
    s.knock(t + 0.12, { f: 700, decay: 0.05, g: 0.18, click: 0.3, partial: 0.15 });
    return 0.3;
  },
  tradeReject(s, t) {
    s.thud(t, { f: 150, decay: 0.1, g: 0.26, felt: 0.12 });
    s.thud(t + 0.1, { f: 125, decay: 0.12, g: 0.18, felt: 0.1 });
    return 0.3;
  },
  devCard(s, t) {
    s.swish(t, { dur: 0.09, f0: 2000, f1: 1100, q: 1.3, g: 0.26, rise: 0.5, lp: 2800 }); // flick
    s.knock(t + 0.08, { f: 820, decay: 0.018, g: 0.06, click: 0.6, partial: 0 }); // card snaps over
    s.swish(t + 0.09, { dur: 0.15, f0: 1200, f1: 700, q: 1.0, g: 0.14, rise: 0.25, lp: 2400 }); // slides to rest
    return 0.3;
  },
  yourTurn(s, t) {
    // one gentle two-note mallet chime
    s.tone(t, { f: 392, decay: 0.7, g: 0.12, attack: 0.012, lp: 2000, overtone: 0.1 });
    s.tone(t + 0.14, { f: 523, decay: 0.9, g: 0.11, attack: 0.012, lp: 2000, overtone: 0.1 });
    return 1.1;
  },
  rushTick(s, t, last) {
    s.knock(t, { f: last ? 640 : 760, decay: 0.022, g: 0.07, click: 0.3, partial: 0 });
    return 0.1;
  },
  victory(s, t) {
    // short warm flourish: mallet arpeggio into a soft chord
    [262, 330, 392].forEach((f, i) => s.tone(t + i * 0.12, { f, decay: 0.6, g: 0.11, attack: 0.006, lp: 2200, overtone: 0.15 }));
    [262, 330, 392, 523].forEach((f) => s.tone(t + 0.38, { f, decay: 1.5, g: 0.055, attack: 0.04, lp: 1800, overtone: 0.06 }));
    s.knock(t + 0.38, { f: 262, decay: 0.08, g: 0.12, click: 0.2, partial: 0.1 });
    return 2.1;
  },
  click(s, t) {
    s.knock(t, { f: 480, decay: 0.025, g: 0.08, click: 0.25, partial: 0 });
    return 0.08;
  },
  error(s, t) {
    // muted soft bump, not a buzzer
    s.thud(t, { f: 140, decay: 0.11, g: 0.28, felt: 0.1 });
    return 0.2;
  },
};

// Minimum gap between two plays of the same sound (ms); everything else: 80 ms.
const MIN_GAP = { click: 60, rushTick: 300, diceRoll: 400, resourceGain: 500, yourTurn: 1500, victory: 3000 };
const LOW_PRIORITY = new Set(["click", "rushTick", "diceResult"]);

export class SoundEngine {
  constructor({ enabled = () => true, volume = loadVolume() } = {}) {
    this.enabled = enabled;
    this.volume = volume;
    this.ctx = null;
    this.chain = null;
    this.last = {};
    this.recent = [];
    this.pendingGain = null;
    this.unlocked = !!(typeof navigator !== "undefined" && navigator.userActivation && navigator.userActivation.hasBeenActive);
    if (typeof window !== "undefined") {
      const unlock = () => {
        this.unlocked = true;
        ["pointerdown", "keydown", "touchend"].forEach((ev) => window.removeEventListener(ev, unlock, true));
        // create/resume inside the gesture so the context starts "running"
        try { this._ensureCtx(); } catch (_) {}
      };
      ["pointerdown", "keydown", "touchend"].forEach((ev) => window.addEventListener(ev, unlock, true));
    }
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.chain = buildChain(this.ctx, this.ctx.destination, this.volume);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0));
    saveVolume(this.volume);
    if (this.chain) this.chain.master.gain.setTargetAtTime(sliderToGain(this.volume), this.ctx.currentTime, 0.03);
  }

  _canPlay() {
    return this.unlocked && this.volume > 0 && this.enabled();
  }

  /** Play a named sound. resourceGain takes the list of gained resource kinds and is
   *  coalesced: many gains within ~150 ms become one combined sound. */
  play(name, arg) {
    if (!SOUNDS[name] || !this._canPlay()) return;
    if (name === "resourceGain") {
      if (!this.pendingGain) {
        this.pendingGain = { list: [], any: false };
        setTimeout(() => {
          const p = this.pendingGain;
          this.pendingGain = null;
          this._start("resourceGain", p.list.length ? p.list : null);
        }, 150);
      }
      if (Array.isArray(arg)) this.pendingGain.list.push(...arg);
      return;
    }
    this._start(name, arg);
  }

  _start(name, arg) {
    if (!this._canPlay()) return;
    const now = Date.now();
    if (now - (this.last[name] || 0) < (MIN_GAP[name] ?? 80)) return;
    this.recent = this.recent.filter((x) => now - x < 200);
    if (this.recent.length >= 3 && LOW_PRIORITY.has(name)) return; // keep busy moments calm
    if (this.recent.length >= 5) return;
    try {
      const ctx = this._ensureCtx();
      if (!ctx) return;
      this.last[name] = now;
      this.recent.push(now);
      SOUNDS[name](new Synth(ctx, this.chain.bus), ctx.currentTime + 0.01, arg);
    } catch (_) {}
  }
}

/** Render one sound into an (Offline)AudioContext; returns the duration it needs. */
export function renderSound(ctx, name, arg, volume = DEFAULT_VOLUME) {
  const chain = buildChain(ctx, ctx.destination, volume);
  return SOUNDS[name](new Synth(ctx, chain.bus), 0.02, arg);
}
