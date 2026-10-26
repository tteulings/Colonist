// Seafarers drawing for the SVG-art board renderer (themes A/B/C) and the legacy Classic canvas.
// Called from small hooks in src/themes/board-renderer.js and game.drawCanvasScene(); `R` is the
// SvgBoardRenderer, coordinates are art units (hex radius 100) unless noted.
import { hexPath } from "../themes/art-util.js";
import { defaultSea } from "./art.js";

const P2 = new Map();
const path = (d) => { let p = P2.get(d); if (!p) { p = new Path2D(d); P2.set(d, p); } return p; };
const HEXP = (r) => path(hexPath(0, 0, r));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** The active theme's sea art (its own `sea` block, or one derived from it). */
export function seaArt(T) {
  if (T.sea) return T.sea;
  if (!T.__seaDefault) Object.defineProperty(T, "__seaDefault", { value: defaultSea(T), enumerable: false });
  return T.__seaDefault;
}

/** Land hex of a harbour edge (the port sits on its coast). */
export function portLandHex(g, edge) {
  return edge.hexIds.find((h) => g.geometry.hexes[h].resource !== "sea") ?? edge.hexIds[0];
}

// ── static layer (baked) ────────────────────────────────────────────────
/** Faint outlines + a little swell on every sea hex, so ship lanes (hex sides) can be read on the water. */
export function bakeSeaMarks(R, ctx, b, k) {
  const g = R.game, S = seaArt(R.theme).seaMark;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, -b.minX * k, -b.minY * k);
  g.geometry.hexes.forEach((h) => {
    if (h.resource !== "sea") return;
    const c = R.hexArt(h);
    ctx.save(); ctx.translate(c.x, c.y);
    ctx.lineJoin = "round";
    ctx.lineWidth = 2; ctx.strokeStyle = S.line; ctx.stroke(HEXP(98));
    ctx.lineCap = "round"; ctx.lineWidth = 3; ctx.strokeStyle = S.wave;
    const w = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.quadraticCurveTo(x - 7, y - 6, x, y); ctx.quadraticCurveTo(x + 7, y + 6, x + 14, y); ctx.stroke(); };
    const s = (h.id * 37) % 5;
    w(-22 + s * 4, -30 + s * 3); w(18 - s * 3, 26 - s * 2);
    ctx.restore();
  });
  ctx.restore();
}

// ── live pieces ─────────────────────────────────────────────────────────
function shipAt(R, edge) {
  const a = R.nodeArt(edge.nodes[0]), b = R.nodeArt(edge.nodes[1]);
  return { a, b, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Dotted lane along the hex side in the player's colour (the "shipping route"). */
function lane(R, ctx, p, color, alpha = 1, white = "rgba(255,255,255,.9)") {
  const k = R.game.isMobileLayout ? 1.25 : 1.05;
  const L = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) || 1, t = 16 / L;
  const ax = p.a.x + (p.b.x - p.a.x) * t, ay = p.a.y + (p.b.y - p.a.y) * t, bx = p.b.x - (p.b.x - p.a.x) * t, by = p.b.y - (p.b.y - p.a.y) * t;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = "round";
  ctx.setLineDash([2, 9 * k]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.strokeStyle = white; ctx.lineWidth = 9 * k; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 6 * k; ctx.stroke();
  ctx.restore();
}

function piece(R, ctx, spec, x, y, alpha, devK, s = 1, drawSpec) {
  ctx.save(); ctx.translate(x, y); ctx.scale(R.pieceScale * s, R.pieceScale * s); ctx.translate(0, -4);
  drawSpec(ctx, spec, { alpha, k: devK, rim: R.theme.rim, rimW: R.theme.rimW ?? 5 });
  ctx.restore();
}

/** Ships (lanes first, then hulls y-sorted), the lifted ship while moving one. */
export function drawShips(R, ctx, now, reduced, devK, drawSpec) {
  const g = R.game, S = seaArt(R.theme);
  const sel = g.pendingAction === "moveShip" ? g.sea.moveSel?.from : null;
  const ships = g.geometry.edges.filter((e) => e.owner != null && e.ship);
  ships.forEach((e) => lane(R, ctx, shipAt(R, e), R.pc(g.players[e.owner]).base, e.id === sel ? 0.35 : 1, S.lane));
  ships.map((e) => ({ e, p: shipAt(R, e) })).sort((a, b) => a.p.y - b.p.y).forEach(({ e, p }) => {
    const c = R.pc(g.players[e.owner]);
    const spec = S.ship(c, e.owner);
    if (e.id === sel) {
      const px = 1 / (R.u * g.view.scale);
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y - 6, 30, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fill();
      ctx.setLineDash([6 * px, 4 * px]); ctx.lineWidth = 2.6 * px; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.restore();
      piece(R, ctx, spec, p.x, p.y - 8, 0.6, devK, 1, drawSpec);
      return;
    }
    const an = R.animFor("road", e.id);
    let s = 1, a = 1, dy = 0;
    if (an) {
      const t = clamp01((now - an.start) / an.dur);
      if (reduced) a = clamp01(t / 0.3);
      else { s = 0.6 + 0.4 * Math.min(1, t * 1.6) + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.12; dy = -14 * (1 - Math.min(1, t * 1.4)); a = clamp01(t * 3); }
    }
    piece(R, ctx, spec, p.x, p.y + dy, a, devK, s, drawSpec);
  });
}

/** The pirate mid-hex (glides when moved), plus +2 island chips and the brief new-island outline. */
export function drawPirateAndChips(R, ctx, now, reduced, devK, drawSpec) {
  const g = R.game, sea = g.sea, S = seaArt(R.theme);
  if (sea.pirateHexId != null) {
    const to = R.hexArt(g.geometry.hexes[sea.pirateHexId]);
    let pos = to;
    const an = R._pirate;
    if (!an || an.to !== sea.pirateHexId) R._pirate = { from: an ? an.to : sea.pirateHexId, to: sea.pirateHexId, start: now, gen: g.gameGen };
    const A = R._pirate;
    if (A.from !== A.to && !reduced && A.gen === g.gameGen) {
      const t = clamp01((now - A.start) / 1100);
      if (t < 1) {
        const fr = R.hexArt(g.geometry.hexes[A.from]);
        const e = 1 - Math.pow(1 - t, 3);
        pos = { x: fr.x + (to.x - fr.x) * e, y: fr.y + (to.y - fr.y) * e - Math.sin(t * Math.PI) * 18 };
        R.requestDraw();
      }
    }
    ctx.save(); ctx.translate(pos.x, pos.y + 6); ctx.scale(R.pieceScale * 1.25, R.pieceScale * 1.25);
    drawSpec(ctx, S.pirate, { k: devK, rim: R.theme.rim, rimW: R.theme.rimW ?? 5 });
    ctx.restore();
  }
  // new island: a calm warm outline round the island for a moment
  const glow = sea.glow;
  if (glow && now < glow.until) {
    const a = clamp01((glow.until - now) / 600) * clamp01((now - (glow.until - 2600)) / 300);
    g.geometry.hexes.filter((h) => h.island === glow.island).forEach((h) => {
      const c = R.hexArt(h);
      ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = a; ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "rgba(255,247,222,.95)"; ctx.stroke(HEXP(91)); ctx.restore();
    });
    R.requestDraw();
  }
  // +2 chips under island-bonus settlements (the rulebook's catan chits)
  const font = R.theme.tokenStyle.labelFont;
  sea.bonusChips().forEach(({ nodeId }) => {
    const p = R.nodeArt(nodeId), k = R.pieceScale;
    ctx.save(); ctx.translate(p.x + 22 * k, p.y + 12 * k); ctx.scale(k, k);
    ctx.shadowColor = "rgba(27,42,42,.3)"; ctx.shadowBlur = 3 * devK; ctx.shadowOffsetY = 1.5 * devK;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = S.chip.fill; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.lineWidth = 1.6; ctx.strokeStyle = S.chip.ring; ctx.stroke();
    ctx.fillStyle = S.chip.ink; ctx.font = `800 12px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("+2", 0, 1);
    ctx.restore();
  });
}

/** Legal ship spots: dotted white lanes on the water (a road's spots are dashes). */
export function drawShipSpots(R, ctx, ids, cb, pulse, color) {
  const g = R.game, px = 1 / (R.u * g.view.scale);
  ids.forEach((id) => {
    if (cb && cb.type === "ship" && cb.id === id) return;
    const p = shipAt(R, g.geometry.edges[id]);
    const L = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) || 1, t = 22 / L;
    const ax = p.a.x + (p.b.x - p.a.x) * t, ay = p.a.y + (p.b.y - p.a.y) * t, bx = p.b.x - (p.b.x - p.a.x) * t, by = p.b.y - (p.b.y - p.a.y) * t;
    ctx.save(); ctx.lineCap = "round";
    if (pulse.a > 0) { ctx.globalAlpha = pulse.a * 0.8; ctx.lineWidth = (5 + 8 * pulse.e) * px; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.setLineDash([0.1, 9 * px]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.lineWidth = 8.5 * px; ctx.strokeStyle = "rgba(20,40,44,.35)"; ctx.stroke();
    ctx.lineWidth = 6 * px; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    ctx.restore();
  });
}

export function ghostShip(R, ctx, id, c, alpha, devK, drawSpec) {
  const g = R.game, S = seaArt(R.theme);
  const p = shipAt(R, g.geometry.edges[id]);
  lane(R, ctx, p, c.base, 0.7 * alpha, S.lane);
  piece(R, ctx, S.ship(c, g.currentPlayer?.id || 0), p.x, p.y, 0.85 * alpha, devK, 1, drawSpec);
}

export function ghostPirate(R, ctx, hexId, alpha, drawSpec) {
  const c = R.hexArt(R.game.geometry.hexes[hexId]);
  ctx.save(); ctx.translate(c.x, c.y + 6); ctx.scale(R.pieceScale * 1.25, R.pieceScale * 1.25);
  drawSpec(ctx, seaArt(R.theme).pirate, { alpha });
  ctx.restore();
}

// ── legacy Classic canvas (theme "Classic"): functional, plain ─────────────
export function drawClassicSea(g, ctx) {
  const sea = g.sea, s = g.geometry.hexSize / 74;
  // ships: thick dashed lane + a small hull/sail
  g.geometry.edges.forEach((e) => {
    if (e.owner == null || !e.ship) return;
    const a = g.geometry.nodes[e.nodes[0]], b = g.geometry.nodes[e.nodes[1]];
    const col = g.players[e.owner].color;
    ctx.save(); ctx.lineCap = "round"; ctx.setLineDash([2 * s, 6 * s]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 8 * s; ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 5 * s; ctx.stroke(); ctx.setLineDash([]);
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    ctx.translate(x, y); ctx.scale(s * 0.8, s * 0.8);
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.lineTo(11, -2); ctx.closePath(); ctx.fillStyle = "#fbf6ea"; ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  if (sea.pirateHexId != null) {
    const h = g.geometry.hexes[sea.pirateHexId];
    ctx.save(); ctx.translate(h.center.x, h.center.y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fillStyle = "#2a2f33"; ctx.fill();
    ctx.fillRect(-12, -24, 24, 20); ctx.fillStyle = "#f2e8d0"; ctx.beginPath(); ctx.arc(0, -15, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  sea.bonusChips().forEach(({ nodeId }) => {
    const n = g.geometry.nodes[nodeId];
    ctx.save(); ctx.translate(n.x + 14 * s, n.y + 9 * s);
    ctx.beginPath(); ctx.arc(0, 0, 8 * s, 0, Math.PI * 2); ctx.fillStyle = "#f3d27a"; ctx.fill(); ctx.strokeStyle = "#8a6a2c"; ctx.stroke();
    ctx.fillStyle = "#4a3a12"; ctx.font = `800 ${9 * s}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+2", 0, 0.5);
    ctx.restore();
  });
  // legal ship spots / move targets
  const spots = g._legalPlacementSpots?.();
  if (spots?.ships?.length) {
    const px = 1 / (g.view.scale || 1);
    ctx.save(); ctx.lineCap = "round"; ctx.setLineDash([0.1, 8 * px]);
    spots.ships.forEach((id) => {
      const e = g.geometry.edges[id], a = g.geometry.nodes[e.nodes[0]], b = g.geometry.nodes[e.nodes[1]];
      ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * 0.22, a.y + (b.y - a.y) * 0.22); ctx.lineTo(b.x - (b.x - a.x) * 0.22, b.y - (b.y - a.y) * 0.22);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 6 * px; ctx.stroke();
    });
    ctx.restore();
  }
}
