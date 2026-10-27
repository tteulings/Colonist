// Canvas board renderer for SVG-art themes (Sunny Island and later B/C).
//
// Performance model (see SPEC §1.3):
//  * The static board — island/shallows (with the SVG coast filter), ports, tiles, number tokens —
//    is rasterised ONCE into an offscreen "board layer" canvas at the current device scale and only
//    re-baked when the board, zoom bucket, size/DPR or theme changes. Panning never re-bakes.
//  * The visible canvas is redrawn only when something changed (dirty flag) or while an animation
//    or placement pulse is running: one drawImage of the board layer + pieces drawn as Path2D.
//  * Pieces / robber / hints are vector specs (Path2D) — crisp at any zoom, nothing to bake.
//  * The sea is a CSS layer behind the (transparent) canvas, so idle water costs no canvas work.
import { hexPath, pipCount, f, harbourBadges, harbourScale } from "./art-util.js";
import { motionReduced } from "./manager.js";
// ⚓ Seafarers drawing (only used while game.sea is set)
import { seaArt, portLandHex, bakeSeaMarks, drawShips, drawPirateAndChips, drawShipSpots, ghostShip, ghostPirate } from "../seafarers/render.js";

const path2d = new Map();
const P2D = (d) => {
  let p = path2d.get(d);
  if (!p) { p = new Path2D(d); path2d.set(d, p); }
  return p;
};
const HEX_P = (r = 100) => P2D(hexPath(0, 0, r));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// cubic-bezier easing (same curves as the CSS/WAAPI motion personalities)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const e = sx(t) - x;
      const d = dsx(t);
      if (Math.abs(e) < 1e-4 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(clamp01(t));
  };
}
const easeCache = new Map();
function easing(css) {
  if (!css || css === "linear") return (t) => t;
  let e = easeCache.get(css);
  if (!e) {
    const m = /cubic-bezier\(([^)]+)\)/.exec(css);
    const [a, b, c, d] = m ? m[1].split(",").map(Number) : [0.25, 0.1, 0.25, 1];
    e = bezier(a, b, c, d);
    easeCache.set(css, e);
  }
  return e;
}

/** Interpolate keyframes [{o, ...props, ease}] at progress t (0..1). */
function kf(t, frames) {
  if (t <= frames[0].o) return frames[0];
  for (let i = 1; i < frames.length; i += 1) {
    const b = frames[i];
    if (t <= b.o) {
      const a = frames[i - 1];
      const local = (t - a.o) / (b.o - a.o || 1);
      const e = easing(a.ease)(local);
      const out = {};
      for (const k of Object.keys(b)) if (k !== "o" && k !== "ease") out[k] = (a[k] ?? b[k]) + (b[k] - (a[k] ?? b[k])) * e;
      for (const k of Object.keys(a)) if (!(k in out) && k !== "o" && k !== "ease") out[k] = a[k];
      return out;
    }
  }
  return frames[frames.length - 1];
}

export function drawSpec(ctx, spec, { alpha = 1, k = 1, rim = null, rimW = 6 } = {}) {
  // light rim around the silhouette first, so the piece separates from busy or dark tiles
  if (rim) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rim;
    ctx.lineJoin = "round";
    for (const s of spec) {
      if (!s.body) continue;
      ctx.lineWidth = (s.sw || 1) + rimW;
      ctx.stroke(P2D(s.d));
    }
    ctx.restore();
  }
  for (const s of spec) {
    ctx.save();
    ctx.globalAlpha = alpha * (s.op ?? 1);
    if (s.dropShadow) {
      ctx.shadowColor = "rgba(27,42,42,.28)";
      ctx.shadowBlur = 4.8 * k;
      ctx.shadowOffsetX = 2 * k;
      ctx.shadowOffsetY = 3 * k;
    }
    let p;
    if (s.el === "ellipse") { p = new Path2D(); p.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2); }
    else if (s.el === "circle") { p = new Path2D(); p.arc(s.cx, s.cy, s.r, 0, Math.PI * 2); }
    else p = P2D(s.d);
    if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(p); }
    if (s.stroke) {
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = s.sw || 1;
      ctx.lineJoin = "round";
      ctx.lineCap = s.cap || "butt";
      ctx.stroke(p);
    }
    ctx.restore();
  }
}

/** Rasterise an SVG string into a canvas of w×h device pixels. */
async function rasterize(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const im = new Image();
    im.decoding = "async";
    im.src = url;
    await im.decode();
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Probability pips under a token's number, styled per theme (tokenStyle.pipStyle):
 *  "dot" round dots · "inlay" burned-in holes (dark core, light catch-light on the lower rim) ·
 *  "brush" ink dabs (slightly oval, each turned a little differently, fixed per number). */
function drawPips(ctx, s, n, col) {
  const p = pipCount(n), hot = n === 6 || n === 8, r = s.pipR, style = s.pipStyle || "dot";
  for (let i = 0; i < p; i += 1) {
    const x = (i - (p - 1) / 2) * s.pipGap, y = s.pipY;
    ctx.beginPath();
    if (style === "brush") {
      const rot = (((n * 7 + i * 13) % 9) - 4) * 0.2, jy = (((n + i * 5) % 3) - 1) * 0.3, sz = 0.9 + ((n * 3 + i * 7) % 4) * 0.08;
      ctx.ellipse(x, y + jy, r * 1.3 * sz, r * 0.82 * sz, rot, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
    } else if (style === "inlay") {
      const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, hot ? s.pipHotCore || col : s.pipCore || col); g.addColorStop(1, col);
      ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r + 0.15, Math.PI * 0.1, Math.PI * 0.9);
      ctx.lineWidth = 0.8; ctx.strokeStyle = s.pipLight || "rgba(255,250,235,.95)"; ctx.stroke();
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    }
  }
}

export class SvgBoardRenderer {
  constructor(game, theme) {
    this.game = game;
    this.theme = theme;
    this.layer = null; // { canvas, minX, minY, W, H, k, key }
    this.bakeGen = 0;
    this.baking = null;
    this.dirty = true;
    this.anims = [];
    this.known = null; // last seen board state for change → animation detection
    this.stats = { frames: 0, drawMs: 0, maxMs: 0, bakes: 0, bakeMs: 0 };
    this.lastKey = "";
  }

  setTheme(theme) {
    this.theme = theme;
    this.layer = null;
    this.invalidateStatic();
  }

  /** Board/theme/size changed: re-bake the static board layer (async). */
  invalidateStatic() {
    this.lastKey = "";
    this.requestDraw();
  }

  requestDraw() { this.dirty = true; }

  /** Forget the previous board state so the next draw does not animate (new game / reload). */
  resync() { this.known = null; this.anims = []; this.requestDraw(); }

  // ── geometry helpers ───────────────────────────────────────────────────
  get u() { return this.game.geometry.hexSize / 100; } // world px per art unit
  toArt(x, y) {
    const g = this.game.geometry;
    return { x: (x - g.centerX) / this.u, y: (y - g.centerY) / this.u };
  }
  hexArt(hex) { return this.toArt(hex.center.x, hex.center.y); }
  nodeArt(id) { const n = this.game.geometry.nodes[id]; return this.toArt(n.x, n.y); }

  artBounds() {
    const hs = this.game.geometry.hexes.map((h) => this.hexArt(h));
    const xs = hs.map((h) => h.x), ys = hs.map((h) => h.y);
    const m = 175;
    const minX = Math.min(...xs) - 100 - m, maxX = Math.max(...xs) + 100 + m;
    const minY = Math.min(...ys) - 100 - m, maxY = Math.max(...ys) + 100 + m;
    return { minX, minY, W: maxX - minX, H: maxY - minY };
  }

  /** Device pixels per art unit for the current view, bucketed so zooming re-bakes rarely.
   *  Capped by layer area (≈12 MP on phones, 16 MP on desktop) — enough for max zoom at 3x DPR. */
  targetK() {
    const g = this.game;
    const raw = this.u * g.view.scale * g.pixelRatio;
    const b = Math.pow(2, Math.ceil(Math.log2(raw) * 4) / 4);
    const { W, H } = this.artBounds();
    const cap = Math.sqrt((g.isMobileLayout ? 12e6 : 16e6) / (W * H));
    return Math.min(b, cap);
  }

  /** v0.76: one readable pill per harbour, placed fully in the sea (shared layout, see harbourBadges). */
  portData() {
    const badges = harbourBadges(this.game, harbourScale(this.game));
    return (this.game.ports || []).map((port, i) => {
      const q = badges[i];
      return { a: q.a, b: q.b, mx: q.mx, my: q.my, nx: q.nx, ny: q.ny, res: port.type === "any" ? null : port.type, ratio: port.type === "any" ? "3:1" : "2:1", noBoat: !!this.game.sea, s: harbourScale(this.game), badge: q, piers: q.piers };
    });
  }

  boardKey(k) {
    const g = this.game.geometry;
    return [this.theme.id, this.theme.paletteId || "", k.toFixed(3), this.tokenScale, harbourScale(this.game), !!this.game.sea, g.hexSize.toFixed(2), g.hexes.map((h) => h.resource + h.number).join(""), (this.game.ports || []).map((p) => p.edgeId + p.type).join(",")].join("|");
  }

  /**
   * Bake the static layer in small pieces so no single main-thread task is long (a re-bake runs
   * right after every pinch / zoom): the island once at a modest resolution (soft shapes), each
   * harbour in its own small box, and ONE raster per terrain type stamped onto every hex of that
   * type. Each rasterize awaits an image decode, so the browser can paint in between.
   */
  async bake(k, key) {
    const T = this.theme;
    const gen = ++this.bakeGen;
    const t0 = performance.now();
    const b = this.artBounds();
    const sea = !!this.game.sea; // ⚓ Seafarers: beaches round the islands only; sea hexes get faint marks
    const centers = this.game.geometry.hexes.filter((h) => !sea || h.resource !== "sea").map((h) => this.hexArt(h));
    const portData = this.portData();
    const ports = portData.map((p) => T.port(p));
    const defs = `<defs>${T.boardDefs()}</defs>`;
    const svgOf = (x, y, w, h, kk, body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" width="${Math.round(w * kk)}" height="${Math.round(h * kk)}">${defs}${body}</svg>`;
    // Fonts must be ready before the token numbers are drawn into the layer.
    try { await Promise.all([document.fonts.load(`${T.tokenStyle.weight} ${T.tokenStyle.size}px ${T.tokenStyle.font}`), document.fonts.load(`700 12px ${T.tokenStyle.labelFont}`)]); } catch (_) { /* fallback font */ }
    if (gen !== this.bakeGen) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(b.W * k));
    canvas.height = Math.max(1, Math.round(b.H * k));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    const at = (x, y) => [(x - b.minX) * k, (y - b.minY) * k];
    if (sea) bakeSeaMarks(this, ctx, b, k);
    // 1. beach + shallows (blurry by design: half resolution is invisible, and much cheaper)
    const ki = Math.min(k, 1.2);
    const isl = await rasterize(svgOf(b.minX, b.minY, b.W, b.H, ki, T.island(centers)), b.W * ki, b.H * ki);
    if (gen !== this.bakeGen) return;
    ctx.drawImage(isl, 0, 0, canvas.width, canvas.height);
    // 2. harbours, each in a box around its piers + badge
    for (let i = 0; i < ports.length; i += 1) {
      const { a, b: bb, badge: q } = portData[i], M = 16, sh = q.ship || q;
      const x0 = Math.min(a.x, bb.x, q.x - q.w / 2, sh.x - sh.w / 2) - M, x1 = Math.max(a.x, bb.x, q.x + q.w / 2, sh.x + sh.w / 2) + M;
      const y0 = Math.min(a.y, bb.y, q.y - q.h / 2, sh.y - sh.h / 2) - M, y1 = Math.max(a.y, bb.y, q.y + q.h / 2, sh.y + sh.h / 2) + M;
      const pc = await rasterize(svgOf(x0, y0, x1 - x0, y1 - y0, k, ports[i].svg), (x1 - x0) * k, (y1 - y0) * k);
      if (gen !== this.bakeGen) return;
      ctx.drawImage(pc, ...at(x0, y0), (x1 - x0) * k, (y1 - y0) * k);
    }
    // 3. tiles: one raster per terrain type
    const S = 103;
    const sprites = {};
    for (const h of this.game.geometry.hexes) {
      if (h.resource === "sea") continue; // ⚓
      if (!sprites[h.resource]) {
        const art = h.resource === "gold" ? seaArt(T).goldTile() : T.tile(h.resource); // ⚓ gold field
        sprites[h.resource] = await rasterize(svgOf(-S, -S, 2 * S, 2 * S, k, art), 2 * S * k, 2 * S * k);
        if (gen !== this.bakeGen) return;
      }
      const c = this.hexArt(h);
      ctx.drawImage(sprites[h.resource], ...at(c.x - S, c.y - S), 2 * S * k, 2 * S * k);
    }
    ctx.setTransform(k, 0, 0, k, -b.minX * k, -b.minY * k);
    // number tokens
    this.game.geometry.hexes.forEach((hex) => {
      if (!hex.number) return;
      const c = this.hexArt(hex);
      this.drawToken(ctx, c.x, c.y + (T.tokenDy || 0), hex.number, k);
    });
    // port ratio labels (and the "?" of a 3:1 badge): drawn here so they use the page font
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ports.forEach(({ label, labels }) => (labels || [label]).forEach((l) => {
      ctx.fillStyle = l.color || T.palette.ink;
      ctx.font = `${l.weight || 700} ${l.size}px ${l.font || T.tokenStyle.labelFont}`;
      ctx.fillText(l.text, l.x, l.y);
    }));
    this.layer = { canvas, ...b, k, key };
    const ms = performance.now() - t0;
    this.stats.bakes += 1;
    this.stats.bakeMs += ms;
    this.requestDraw();
  }

  /** Pieces are drawn larger on phones so they read clearly against the tiles. */
  get pieceScale() { return this.game.isMobileLayout ? 1.34 : 1.12; }

  /** Number tokens grow on phones so the digits stay readable (≈14 px at 390 wide). */
  get tokenScale() { return this.game.isMobileLayout ? 1.38 : 1; }

  drawToken(ctx, x, y, n, k) {
    const s = this.theme.tokenStyle;
    const hot = n === 6 || n === 8;
    const col = hot ? s.hot : s.ink;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.tokenScale, this.tokenScale);
    ctx.shadowColor = "rgba(27,42,42,.28)";
    ctx.shadowBlur = 4.8 * k;
    ctx.shadowOffsetX = 2 * k;
    ctx.shadowOffsetY = 3 * k;
    ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.fillStyle = s.fill; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 1.2; ctx.strokeStyle = s.ring; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s.r - 4, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = s.inner; ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `${s.weight} ${hot ? s.hotSize : s.size}px ${s.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(n), 0, hot ? s.hotDy : s.dy);
    drawPips(ctx, s, n, hot ? s.pipHot || col : s.pipInk || col);
    ctx.restore();
  }

  // ── change detection → animations ──────────────────────────────────────
  snapshot() {
    const g = this.game.geometry;
    const nodes = new Map();
    g.nodes.forEach((n) => { if (n.structure) nodes.set(n.id, n.structure + ":" + n.owner); });
    const edges = new Set(g.edges.filter((e) => e.owner != null).map((e) => e.id));
    return { nodes, edges, robber: this.game.robberHexId, gen: this.game.gameGen, roll: this.game.highlightRoll };
  }

  detectChanges(now) {
    const cur = this.snapshot();
    const prev = this.known;
    this.known = cur;
    if (!prev || prev.gen !== cur.gen) return;
    const M = this.theme.motion;
    for (const [id, v] of cur.nodes) {
      const old = prev.nodes.get(id);
      if (old === v) continue;
      const [type] = v.split(":");
      if (type === "settlement" && old && old.startsWith("city")) continue; // Undo of a city: no drop
      if (type === "city" && old && old.startsWith("settlement")) this.anims.push({ kind: "city", id, start: now, dur: 1350 * M.k });
      else this.anims.push({ kind: "drop", id, start: now, dur: 1100 * M.k });
    }
    for (const id of cur.edges) if (!prev.edges.has(id)) this.anims.push({ kind: "road", id, start: now, dur: 700 * M.k });
    if (prev.robber != null && cur.robber !== prev.robber) this.anims.push({ kind: "robber", from: prev.robber, to: cur.robber, start: now, dur: 1400 * M.k });
    if (cur.roll && cur.roll !== prev.roll && cur.roll.number) this.anims.push({ kind: "glow", number: cur.roll.number, start: now, dur: 2500 });
  }

  animFor(kind, id) { return this.anims.find((a) => a.kind === kind && a.id === id); }

  // ── frame ────────────────────────────────────────────────────────────────
  /** Called from the game's rAF loop. Draws only when needed. */
  frame(now) {
    const g = this.game;
    if (!g.geometry) return;
    const k = this.targetK();
    const key = this.boardKey(k);
    // While a pinch / pan / zoom animation runs, keep drawing the cached layer scaled (cheap, 60 fps);
    // re-rasterise at the new scale once the view comes to rest.
    if (key !== this.lastKey && !(g.viewMoving && this.layer)) {
      this.lastKey = key;
      clearTimeout(this._bakeTimer);
      const delay = this.layer ? 90 : 0;
      this._bakeTimer = setTimeout(() => this.bake(k, key).catch((e) => console.warn("board bake failed", e)), delay);
    }
    this.detectChanges(now);
    this.anims = this.anims.filter((a) => now - a.start < a.dur);
    // Placement: redraw only while the one-off pulse runs (and for the bobbing ✓ on desktop)
    const pulsing = this.placementActive() && (now - (this._placeStart || 0) < 1300 || (g.confirmBuild && !g.isMobileLayout));
    if (!this.dirty && !this.anims.length && !pulsing) return;
    this.dirty = false;
    const t0 = performance.now();
    this.draw(now);
    const ms = performance.now() - t0;
    this.stats.frames += 1;
    this.stats.drawMs += ms;
    if (ms > this.stats.maxMs) this.stats.maxMs = ms;
  }

  placementActive() {
    const g = this.game;
    const human = g.currentPlayer?.isHuman;
    if (g.winner) return false;
    if (g.setupPhase) return !!(human && g.setupAction);
    return !!(human && g.pendingAction);
  }

  draw(now) {
    const g = this.game, T = this.theme, ctx = g.ctx, u = this.u;
    const reduced = motionReduced();
    ctx.setTransform(g.pixelRatio, 0, 0, g.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, g.boardWidth, g.boardHeight);
    ctx.save();
    ctx.translate(g.view.offsetX, g.view.offsetY);
    ctx.scale(g.view.scale, g.view.scale);
    ctx.translate(g.geometry.centerX, g.geometry.centerY);
    ctx.scale(u, u);
    const devK = u * g.view.scale * g.pixelRatio; // device px per art unit (for shadows)

    // 1. static board layer
    const L = this.layer;
    if (L) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(L.canvas, L.minX, L.minY, L.W, L.H);
    } else {
      this.drawFallbackBoard(ctx, devK);
    }

    // 2. rolled number: calm outline on the producing tiles
    const glow = this.anims.find((a) => a.kind === "glow");
    if (glow) this.drawGlow(ctx, glow, now, reduced);

    // 3. robber dim (cross-fades while the robber moves)
    const rob = this.anims.find((a) => a.kind === "robber");
    const robT = rob ? clamp01((now - rob.start) / rob.dur) : 1;
    if (rob && !reduced) {
      this.dimHex(rob.from, 1 - clamp01((robT * 1400 - 200) / 500));
      this.dimHex(rob.to, clamp01((robT * 1400 - 900) / 500));
    } else this.dimHex(g.robberHexId, 1);

    // 4. robber-mode targets
    if (g.pendingAction === "robber" && g.currentPlayer?.isHuman) this.drawRobberTargets(ctx);


    // 5. roads
    this.drawRoads(ctx, now, reduced);
    if (g.sea) drawShips(this, ctx, now, reduced, devK, drawSpec); // ⚓ ships sail between roads and buildings

    // 6. buildings, y-sorted
    const blds = g.geometry.nodes.filter((n) => n.structure).sort((a, b) => a.y - b.y);
    blds.forEach((n) => this.drawBuilding(ctx, n, now, reduced, devK));

    // 7. robber
    this.drawRobber(ctx, rob, robT, reduced, devK);
    if (g.sea) drawPirateAndChips(this, ctx, now, reduced, devK, drawSpec); // ⚓ pirate, +2 island chips

    // 8. placement hints + ghost + confirm
    if (this.placementActive()) this.drawPlacement(ctx, now, reduced, devK);
    if (g.pendingAction === "robber" && g.confirmBuild?.type === "robber" && !g.isMobileLayout && g.currentPlayer?.isHuman) this.drawConfirm(ctx, now, reduced, devK);

    // 8b. analysis mode: the bot's candidate scores (calm glows, dashed roads, robber damage)
    g.drawAnalysisOverlayArt?.(ctx);

    // 9. dust / sparks
    this.anims.forEach((a) => this.drawParticles(ctx, a, now, reduced));
    ctx.restore();
  }

  drawFallbackBoard(ctx) {
    const T = this.theme, P = T.palette;
    const fill = { wood: P.forest[0], brick: P.terra[0], sheep: P.pasture[0], wheat: P.wheat[0], ore: P.slate[0], desert: P.desert[0], gold: "#E5BC52" };
    this.game.geometry.hexes.forEach((h) => {
      if (h.resource === "sea") return; // ⚓
      const c = this.hexArt(h);
      ctx.save(); ctx.translate(c.x, c.y);
      ctx.fillStyle = P.sand; ctx.fill(HEX_P(110));
      ctx.fillStyle = fill[h.resource] || P.sand; ctx.fill(HEX_P(97));
      ctx.restore();
      if (h.number) this.drawToken(ctx, c.x, c.y + (T.tokenDy || 0), h.number, 1);
    });
  }

  dimHex(hexId, a) {
    if (hexId == null || a <= 0) return;
    const ctx = this.game.ctx;
    const c = this.hexArt(this.game.geometry.hexes[hexId]);
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.theme.dimFill;
    ctx.fill(HEX_P(97));
    ctx.restore();
  }

  /** Rolled number: a calm warm outline on the producing tiles that fades in and out (no glow, no flashing). */
  drawGlow(ctx, a, now, reduced) {
    const g = this.game;
    const el = now - a.start;
    const fadeIn = reduced ? 1 : clamp01(el / 300);
    const fadeOut = 1 - clamp01((el - 1900) / 600);
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) return;
    g.geometry.hexes.forEach((h) => {
      if (h.number !== a.number || h.id === g.robberHexId) return;
      const c = this.hexArt(h);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = alpha;
      ctx.lineJoin = "round";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(255,247,222,.95)";
      ctx.stroke(HEX_P(91));
      ctx.restore();
    });
  }

  /**
   * Robber mode, calm: tiles the robber may not go to are dimmed, candidate tiles carry no marks
   * (who you could rob is listed in the robber sheet), and the chosen (or hovered) tile gets a white
   * outline plus a ghost robber. Nothing pulses.
   */
  drawRobberTargets(ctx) {
    const g = this.game, mover = g.currentPlayer;
    const legal = new Set(g._legalRobberHexes(mover).map((h) => h.id));
    const sel = g.confirmBuild?.type === "robber" ? g.confirmBuild.id : null;
    const px = 1 / (this.u * g.view.scale);
    g.geometry.hexes.forEach((h) => {
      // ⚓ Seafarers: the sea is never dimmed (robber mode simply ignores it; pirate mode dims the land)
      if (!legal.has(h.id)) { if (h.id !== g.robberHexId && !(g.sea && h.resource === "sea")) this.dimHex(h.id, 1); return; }
      const c = this.hexArt(h);
      if (h.id === sel || h.id === g.hoverHexId) {
        ctx.save(); ctx.translate(c.x, c.y);
        ctx.lineWidth = Math.max(5, 3.5 * px); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineJoin = "round";
        ctx.stroke(HEX_P(91));
        ctx.restore();
      }
    });
    const ghostAt = sel ?? (g.hoverHexId != null && legal.has(g.hoverHexId) ? g.hoverHexId : null);
    if (ghostAt != null && g.sea && g.geometry.hexes[ghostAt].resource === "sea") ghostPirate(this, ctx, ghostAt, sel != null ? 0.75 : 0.5, drawSpec); // ⚓
    else if (ghostAt != null) {
      const rp = this.robberPos(ghostAt);
      ctx.save(); ctx.translate(rp.x, rp.y + 32); ctx.scale(this.pieceScale, this.pieceScale); ctx.translate(0, -32);
      drawSpec(ctx, this.theme.pieces.robber, { alpha: sel != null ? 0.75 : 0.5 });
      ctx.restore();
    }
  }

  roadEnds(edge, trim = this.theme.road.trim) {
    const a = this.nodeArt(edge.nodes[0]), b = this.nodeArt(edge.nodes[1]);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), k = trim / L;
    return [{ x: a.x + dx * k, y: a.y + dy * k }, { x: b.x - dx * k, y: b.y - dy * k }];
  }

  /** A road segment, or (a = [[a, b], ...]) several stroked as one path. `pass` (0 shadow, 1 rim,
   *  2 outline, 3 body, 4 highlight) draws a single layer: the board draws all roads layer by layer
   *  as joined paths, so touching segments meet seamlessly and translucent layers never double up. */
  strokeRoad(ctx, a, b, c, alpha = 1, rim = true, pass = null) {
    const R = this.theme.road;
    const w = this.game.isMobileLayout ? 1.25 : 1.05;
    const on = (i) => pass == null || pass === i;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    const list = Array.isArray(a) ? a : [[a, b]];
    const line = () => { ctx.beginPath(); list.forEach(([p, q]) => { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }); };
    if (on(0)) { ctx.save(); ctx.translate(2, 3.5); line(); ctx.strokeStyle = R.shadow; ctx.lineWidth = R.outer * w + 2; ctx.stroke(); ctx.restore(); }
    if (on(1) && rim && R.rim) { line(); ctx.strokeStyle = R.rim; ctx.lineWidth = R.outer * w + (R.rimW ?? 5); ctx.stroke(); }
    if (on(2)) { line(); ctx.strokeStyle = c.line || c.dark; ctx.lineWidth = R.outer * w; ctx.stroke(); }
    if (on(3)) { line(); ctx.strokeStyle = c.base; ctx.lineWidth = R.inner * w; ctx.stroke(); }
    if (on(4)) { ctx.save(); ctx.translate(-0.8, -1.4); ctx.globalAlpha = alpha * 0.85; line(); ctx.strokeStyle = c.light; ctx.lineWidth = R.hi * w; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }

  pc(player) { return this.theme.pc[this.theme.seatKeys[player.id]] || this.theme.pc.blue; }

  /** All built roads, node centre to node centre, layer by layer: a player's network reads as one
   *  continuous line with rounded joints, and buildings (drawn after) sit on top of the ends. */
  drawRoads(ctx, now, reduced) {
    const g = this.game;
    const segs = g.geometry.edges.filter((e) => e.owner != null && !e.ship).map((e) => this.roadSeg(e, g.players[e.owner], now, reduced)); // ⚓ ships drawn apart
    // shadow + rim: one path for every settled road; outline/body/highlight: one path per player
    const settled = segs.filter((s) => s.alpha >= 1), fading = segs.filter((s) => s.alpha < 1);
    const groups = new Map();
    settled.forEach((s) => { if (!groups.has(s.c)) groups.set(s.c, []); groups.get(s.c).push([s.a, s.b]); });
    const all = settled.map((s) => [s.a, s.b]);
    if (all.length) { this.strokeRoad(ctx, all, null, null, 1, true, 0); this.strokeRoad(ctx, all, null, null, 1, true, 1); }
    for (let pass = 2; pass <= 4; pass += 1) groups.forEach((list, c) => this.strokeRoad(ctx, list, null, c, 1, true, pass));
    fading.forEach((s) => this.strokeRoad(ctx, s.a, s.b, s.c, s.alpha, true));
  }

  roadSeg(edge, player, now, reduced) {
    let [a, b] = this.roadEnds(edge, 0);
    const an = this.animFor("road", edge.id);
    let alpha = 1;
    if (an) {
      const t = clamp01((now - an.start) / an.dur);
      if (reduced) alpha = clamp01(t / 0.3);
      else {
        const p = Math.max(0.02, easing(this.theme.motion.out)(t));
        b = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
        alpha = 0.4 + 0.6 * clamp01(t / 0.2);
      }
    }
    return { a, b, c: this.pc(player), alpha };
  }

  drawBuilding(ctx, node, now, reduced, devK) {
    const T = this.theme, g = this.game;
    const player = g.players[node.owner];
    const c = this.pc(player);
    const p = this.toArt(node.x, node.y);
    const M = T.motion;
    const drop = this.animFor("drop", node.id);
    const city = this.animFor("city", node.id);
    const isCity = node.structure === "city";
    const spec = isCity ? T.pieces.city(c) : T.pieces.settlement(c);
    const dy = isCity ? T.pieces.cityDy : T.pieces.settlementDy;
    if (city && !reduced) {
      const t = now - city.start;
      // old settlement sinks (0..450ms), city rises (380..1130ms)
      const o = kf(clamp01(t / (450 * M.k)), [{ o: 0, sx: 1, sy: 1, y: 0, a: 1, ease: M.inOut }, { o: 0.4, sx: 1.1, sy: 0.85, y: 0, a: 1, ease: M.inOut }, { o: 1, sx: 0.2, sy: 0.2, y: 30, a: 0 }]);
      if (o.a > 0.01) this.stamp(ctx, T.pieces.settlement(c), p.x, p.y + T.pieces.settlementDy, o, devK);
      const n = kf(clamp01((t - 380 * M.k) / (750 * M.k)), [{ o: 0, sx: 0.2, sy: 0.4, y: 40, a: 0, ease: M.pop }, { o: 0.55, sx: 0.95, sy: 1.15, y: -14, a: 1, ease: M.pop }, { o: 0.75, sx: M.squash[0] * 0.95, sy: M.squash[1] * 1.05, y: 0, a: 1, ease: M.pop }, { o: 1, sx: 1, sy: 1, y: 0, a: 1 }]);
      if (t > 380 * M.k) this.stamp(ctx, spec, p.x, p.y + dy, n, devK);
      return;
    }
    if (drop && !reduced) {
      const t = clamp01((now - drop.start) / (900 * M.k));
      const [sx, sy] = M.squash;
      const s = kf(t, [{ o: 0, y: -110, sx: 0.9, sy: 1.12, a: 0, ease: M.fall }, { o: 0.15, a: 1, y: -88, sx: 0.9, sy: 1.12, ease: M.fall }, { o: 0.45, y: 0, sx: 0.92, sy: 1.1, a: 1, ease: "linear" }, { o: 0.55, y: 0, sx, sy, a: 1, ease: M.out }, { o: 0.72, y: -8, sx: 0.96, sy: 1.05, a: 1, ease: M.inOut }, { o: 1, y: 0, sx: 1, sy: 1, a: 1 }]);
      this.stamp(ctx, spec, p.x, p.y + dy, s, devK);
      return;
    }
    const fade = (drop || city) && reduced ? clamp01((now - (drop || city).start) / 220) : 1;
    this.stamp(ctx, spec, p.x, p.y + dy, { sx: 1, sy: 1, y: 0, a: fade }, devK);
  }

  /** Draw a piece spec (scaled for the device) with squash/stretch around its base (y≈+16). */
  stamp(ctx, spec, x, y, s, devK) {
    const a = s.a ?? 1;
    ctx.save();
    ctx.translate(x, y + (s.y || 0));
    ctx.scale(this.pieceScale, this.pieceScale);
    ctx.translate(0, 16);
    ctx.scale(s.sx ?? 1, s.sy ?? 1);
    ctx.translate(0, -16);
    drawSpec(ctx, spec, { alpha: a, k: devK, rim: this.theme.rim, rimW: this.theme.rimW ?? 6 });
    ctx.restore();
  }

  robberPos(hexId) {
    const c = this.hexArt(this.game.geometry.hexes[hexId]);
    const extra = (this.tokenScale - 1) * this.theme.tokenStyle.r;
    return { x: c.x + this.theme.robberDx + extra, y: c.y + this.theme.robberDy };
  }

  drawRobber(ctx, rob, t, reduced, devK) {
    const g = this.game, T = this.theme, M = T.motion;
    if (g.robberHexId == null) return;
    let pos = this.robberPos(g.robberHexId), s = { sx: 1, sy: 1, rot: 0 }, sh = 1;
    if (rob && !reduced) {
      const a = this.robberPos(rob.from), b = this.robberPos(rob.to);
      const tt = clamp01(t * 1400 / 1100);
      const v = kf(tt, [{ o: 0, p: 0, lift: 0, rot: 0, sx: 1, sy: 1, ease: M.out }, { o: 0.12, p: 0.15, lift: -14, rot: -8, sx: 1.05, sy: 0.95, ease: M.inOut }, { o: 0.5, p: 0.5, lift: -80, rot: 8, sx: 1.08, sy: 1.08, ease: M.fall }, { o: 0.85, p: 1, lift: 0, rot: 0, sx: M.squash[0], sy: M.squash[1], ease: M.out }, { o: 1, p: 1, lift: 0, rot: 0, sx: 1, sy: 1 }]);
      pos = { x: a.x + (b.x - a.x) * v.p, y: a.y + (b.y - a.y) * v.p };
      sh = 1 + v.lift / 160;
      // shadow on the ground, robber lifted above it
      ctx.save(); ctx.globalAlpha = 0.25 * sh; ctx.fillStyle = "#1B2A2A";
      ctx.beginPath(); ctx.ellipse(pos.x + 2, pos.y + 32, 16 * sh, 5 * sh, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      s = { sx: v.sx, sy: v.sy, rot: v.rot };
      pos = { x: pos.x, y: pos.y + v.lift };
    }
    const k = this.pieceScale;
    ctx.save();
    ctx.translate(pos.x, pos.y + 32);
    ctx.rotate((s.rot * Math.PI) / 180);
    ctx.scale(s.sx * k, s.sy * k);
    ctx.translate(0, -32);
    drawSpec(ctx, T.pieces.robber, { k: devK, rim: T.rim, rimW: T.rimW ?? 5 });
    ctx.restore();
  }

  legalSpots() {
    return this.game._legalPlacementSpots() || { nodes: [], cities: [], edges: [], type: null };
  }

  /**
   * Legal spots only: calm white rings (~14 px) on nodes, dashed ghost segments on edges, a dashed
   * ring around settlements that can become cities. When the spots appear they get ONE gentle pulse
   * in the player's colour, then stay still (no looping glow, no flashing). Sizes are in screen pixels
   * so they read the same at every zoom.
   */
  drawPlacement(ctx, now, reduced, devK) {
    const g = this.game;
    const { nodes, edges, type, cities = [], ships = [] } = this.legalSpots();
    if (!type || type === "robber") return;
    const cb = g.confirmBuild;
    const px = 1 / (this.u * g.view.scale); // art units per CSS pixel
    const human = g.players[0];
    const c = this.pc(g.currentPlayer || human);
    const key = `${type}:${nodes.join(",")}:${cities.join(",")}:${edges.join(",")}:${ships.join(",")}`;
    if (key !== this._placeKey) { this._placeKey = key; this._placeStart = now; }
    const t = reduced ? 1 : clamp01((now - this._placeStart) / 1100);
    const e = easing(this.theme.motion.out)(t);
    const pulseA = t < 1 ? 0.6 * (1 - t) : 0; // fades out once; nothing afterwards
    const ink = "rgba(20,40,44,.32)";
    const ring = (x, y, r) => {
      ctx.save(); ctx.translate(x, y);
      if (pulseA > 0) {
        ctx.beginPath(); ctx.arc(0, 0, r + 10 * e * px, 0, Math.PI * 2);
        ctx.globalAlpha = pulseA; ctx.lineWidth = 3 * px; ctx.strokeStyle = c.base; ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(0, 0, r + 1.6 * px, 0, Math.PI * 2); ctx.lineWidth = 1.4 * px; ctx.strokeStyle = ink; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.24)"; ctx.fill();
      ctx.lineWidth = 2.6 * px; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
      ctx.restore();
    };
    edges.forEach((id) => {
      if (cb && cb.type === "road" && cb.id === id) return;
      const [a, b] = this.roadEnds(g.geometry.edges[id]);
      ctx.save(); ctx.lineCap = "round";
      if (pulseA > 0) {
        ctx.globalAlpha = pulseA * 0.8; ctx.lineWidth = (5 + 8 * e) * px; ctx.strokeStyle = c.base;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.setLineDash([6 * px, 5 * px]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 6 * px; ctx.strokeStyle = ink; ctx.stroke();
      ctx.lineWidth = 3.6 * px; ctx.strokeStyle = "rgba(255,255,255,.96)"; ctx.stroke();
      ctx.restore();
    });
    if (ships.length) drawShipSpots(this, ctx, ships, cb, { a: pulseA, e }, c.base); // ⚓ dotted spots on the water
    nodes.forEach((id) => {
      if (cb && cb.id === id && !["road", "ship"].includes(cb.type)) return;
      const p = this.nodeArt(id);
      ring(p.x, p.y, 7 * px);
    });
    cities.forEach((id) => {
      if (cb && cb.id === id && cb.type !== "road") return;
      const p = this.nodeArt(id);
      ring(p.x, p.y - 4, 30); // around the settlement itself
    });
    // hover preview (desktop) — a fainter ghost
    const hoverNode = g.hoverNodeId != null && (!cb || cb.id !== g.hoverNodeId) && (nodes.includes(g.hoverNodeId) || cities.includes(g.hoverNodeId)) ? g.hoverNodeId : null;
    const hoverEdge = g.hoverEdgeId != null && (!cb || cb.id !== g.hoverEdgeId) && (edges.includes(g.hoverEdgeId) || ships.includes(g.hoverEdgeId)) ? g.hoverEdgeId : null;
    if (hoverNode != null) this.ghost(ctx, cities.includes(hoverNode) ? "city" : "settlement", hoverNode, c, 0.45, devK);
    if (hoverEdge != null) this.ghost(ctx, edges.includes(hoverEdge) ? "road" : "ship", hoverEdge, c, 0.45, devK);
    if (cb && cb.type !== "robber") {
      this.ghost(ctx, cb.type, cb.id, c, 1, devK);
      if (!g.isMobileLayout) this.drawConfirm(ctx, now, reduced, devK);
    }
  }


  ghost(ctx, type, id, c, alpha, devK) {
    const g = this.game, T = this.theme;
    if (type === "ship") { ghostShip(this, ctx, id, c, alpha, devK, drawSpec); return; } // ⚓
    if (type === "road") {
      const [a, b] = this.roadEnds(g.geometry.edges[id]);
      this.strokeRoad(ctx, a, b, c, 0.6 * alpha, false);
      return;
    }
    const p = this.nodeArt(id);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fillStyle = "rgba(251,246,234,.3)"; ctx.fill();
    ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.strokeStyle = "#FBF6EA"; ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(0, type === "city" ? -4 : -3);
    ctx.scale(this.pieceScale, this.pieceScale);
    drawSpec(ctx, type === "city" ? T.pieces.city(c) : T.pieces.settlement(c), { alpha: 0.75 * alpha, k: devK });
    ctx.restore();
  }

  /** Confirm button above the selected spot (desktop). Same hit area as game.getConfirmIconCenter(). */
  drawConfirm(ctx, now, reduced, devK) {
    const g = this.game, icon = g.getConfirmIconCenter();
    if (!icon) return;
    const p = this.toArt(icon.x, icon.y);
    const r = icon.r / this.u;
    const bob = reduced ? 0 : Math.sin(now / 260) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.shadowColor = "rgba(27,42,42,.3)"; ctx.shadowBlur = 6 * devK; ctx.shadowOffsetY = 2 * devK;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = this.theme.confirm.fill; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 2.5; ctx.strokeStyle = this.theme.confirm.ring; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.42, 0); ctx.lineTo(-r * 0.12, r * 0.3); ctx.lineTo(r * 0.45, -r * 0.32);
    ctx.lineWidth = r * 0.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = this.theme.confirm.ring; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, r - 1); ctx.lineTo(6, r - 1); ctx.lineTo(0, r + 8); ctx.closePath(); ctx.fillStyle = this.theme.confirm.fill; ctx.fill();
    ctx.restore();
  }

  drawParticles(ctx, a, now, reduced) {
    if (reduced) return;
    const M = this.theme.motion;
    const el = now - a.start;
    if (a.kind === "drop") {
      const t = (el - 460 * M.k) / (600 * M.k);
      if (t <= 0 || t >= 1) return;
      const p = this.nodeArt(a.id);
      const e = easing(M.out)(t);
      for (let i = 0; i < 5; i += 1) {
        const ang = ((i * 72 + 20) * Math.PI) / 180;
        const d = 4 + (30 + i * 3) * e;
        ctx.save();
        ctx.globalAlpha = t < 0.2 ? (t / 0.2) * 0.9 : 0.9 * (1 - (t - 0.2) / 0.8);
        ctx.translate(p.x + Math.cos(ang) * d, p.y + 14 + Math.sin(ang) * d * 0.45);
        const r = 7 * (0.3 + 1.1 * e);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = "#F4EEE1"; ctx.fill();
        ctx.beginPath(); ctx.arc(1.5, 1.5, r * 0.7, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.05)"; ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Screen (CSS px, relative to the canvas) position of a hex centre — used by DOM effects. */
  hexScreen(hexId) {
    const g = this.game, h = g.geometry.hexes[hexId];
    return g.worldToScreen(h.center.x, h.center.y);
  }
}
