import { fitTransform, worldToScreen } from "./geom.js";
import { resolveSprite, getImage } from "./sprites.js";
import { squashStretch } from "./fx.js";

// Pure helper: compute render-only sprite rotation (NEVER affects physics).
// Returns baseAngle when not running/reduced-motion/no-spin; else baseAngle + spin*time.
export function spinAngle(baseAngle, spin, nowMs, running, reduced) {
  if (!running || reduced || !spin) return baseAngle;
  return baseAngle + spin * (nowMs / 1000);
}

// world-space half-extents of a body for each fit mode
function bodyDrawSize(body, fit) {
  const b = body.bounds, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  if (fit === "circle") { const d = (body.circleRadius ? body.circleRadius*2 : Math.max(w,h)); return { w:d, h:d }; }
  if (fit === "plank" || fit === "box") {
    // use the body's own (unrotated) dimensions when available; bounds are AABB (post-rotation),
    // so prefer vertices-derived oriented size: width = max edge, height = min edge for plank.
    const verts = body.vertices;
    if (verts && verts.length >= 4) {
      const e1 = Math.hypot(verts[1].x-verts[0].x, verts[1].y-verts[0].y);
      const e2 = Math.hypot(verts[2].x-verts[1].x, verts[2].y-verts[1].y);
      return { w: Math.max(e1,e2), h: Math.min(e1,e2) };
    }
    return { w, h };
  }
  return { w, h }; // compound: AABB union
}

// Procedural flat-shaded bar rendering for long "plank" parts (wall/ramp/seesaw/
// platform/conveyor/ice/sticky/accelerator/wedge/pipe). These bodies range from
// 24px uprights to 800px floors in the official levels, and a raster photo-texture
// sprite can only ever look right at ONE length — stretched it distorts, tiled it
// seams. The classic Incredible Machine drew planks/floors as flat 2D shapes with
// evenly-spaced detail (grain lines, rivets, cracks) computed from the body's own
// width, so they read as one continuous beam at any size. Same idea here: a solid
// gradient fill (always looks right, any length) + detail marks spaced by a fixed
// world-space period (never squashed/tiled-with-seams) — pure canvas vector, no PNG.
const BAR_STYLES = {
  wood: { top: ["#e6b478", "#a86d2c"], edge: "#3a2412", grainEvery: 42 },
  steel: { top: ["#eef3f7", "#aab8c6"], edge: "#2a3340", rivetEvery: 46 },
  ice: { top: ["#eaffff", "#8fd9ef"], edge: "#5aa8c8", crackEvery: 54 },
  sticky: { top: ["#ffd166", "#e08a1a"], edge: "#a04a10", dripEvery: 48 },
  dark: { top: ["#3a4452", "#1b222d"], edge: "#11161f", chevronEvery: 34 },
  mirror: { top: ["#f4fdff", "#b7e6f5"], edge: "#5aa8c8", sparkleEvery: 44 },
};
function drawBar(ctx, bw, bh, style) {
  const half = bw / 2, hh = bh / 2;
  // base fill: vertical gradient, flat across the whole length — never distorts.
  const grad = ctx.createLinearGradient(0, -hh, 0, hh);
  grad.addColorStop(0, style.top[0]);
  grad.addColorStop(1, style.top[1]);
  ctx.fillStyle = grad;
  const r = Math.min(6, hh * 0.5);
  ctx.beginPath();
  ctx.moveTo(-half + r, -hh);
  ctx.lineTo(half - r, -hh);
  ctx.quadraticCurveTo(half, -hh, half, -hh + r);
  ctx.lineTo(half, hh - r);
  ctx.quadraticCurveTo(half, hh, half - r, hh);
  ctx.lineTo(-half + r, hh);
  ctx.quadraticCurveTo(-half, hh, -half, hh - r);
  ctx.lineTo(-half, -hh + r);
  ctx.quadraticCurveTo(-half, -hh, -half + r, -hh);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, hh * 0.12);
  ctx.strokeStyle = style.edge;
  ctx.stroke();
  // top highlight sliver (reads as a lit top edge, like the hand-drawn icons)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(-half + r, -hh + hh * 0.18);
  ctx.lineTo(half - r, -hh + hh * 0.18);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1, hh * 0.1);
  ctx.stroke();
  ctx.restore();
  // detail marks at a fixed WORLD-space period so they never stretch/tile-seam —
  // they simply repeat more or fewer times depending on the bar's own length.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-half, -hh, bw, bh);
  ctx.clip();
  if (style.grainEvery) {
    ctx.strokeStyle = style.edge; ctx.globalAlpha = 0.3; ctx.lineWidth = Math.max(1, hh * 0.08);
    for (let x = -half + style.grainEvery * 0.5; x < half; x += style.grainEvery) {
      ctx.beginPath(); ctx.moveTo(x, -hh * 0.5); ctx.lineTo(x + hh * 0.3, hh * 0.6); ctx.stroke();
    }
  } else if (style.rivetEvery) {
    ctx.fillStyle = style.edge; ctx.globalAlpha = 0.55;
    const rr = Math.max(1.4, hh * 0.16);
    for (let x = -half + style.rivetEvery * 0.5; x < half; x += style.rivetEvery) {
      ctx.beginPath(); ctx.arc(x, 0, rr, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style.crackEvery) {
    ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, hh * 0.09); ctx.lineCap = "round";
    for (let x = -half + style.crackEvery * 0.5; x < half; x += style.crackEvery) {
      ctx.beginPath(); ctx.moveTo(x, -hh * 0.4); ctx.lineTo(x + hh * 0.35, hh * 0.4); ctx.stroke();
    }
  } else if (style.dripEvery) {
    ctx.fillStyle = style.edge; ctx.globalAlpha = 0.6;
    for (let x = -half + style.dripEvery * 0.5; x < half; x += style.dripEvery) {
      ctx.beginPath(); ctx.ellipse(x, hh * 0.55, hh * 0.22, hh * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style.chevronEvery) {
    ctx.strokeStyle = "#ffd45a"; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1.4, hh * 0.14);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let x = -half + style.chevronEvery * 0.5; x < half; x += style.chevronEvery) {
      ctx.beginPath(); ctx.moveTo(x - hh * 0.22, -hh * 0.4); ctx.lineTo(x + hh * 0.22, 0); ctx.lineTo(x - hh * 0.22, hh * 0.4); ctx.stroke();
    }
  } else if (style.sparkleEvery) {
    ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.65;
    for (let x = -half + style.sparkleEvery * 0.5; x < half; x += style.sparkleEvery) {
      const s = hh * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, -s); ctx.lineTo(x + s, 0); ctx.lineTo(x, s); ctx.lineTo(x - s, 0); ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}
// Per-part-type bar style + any extra decoration drawn after the base bar.
const BAR_PARTS = {
  wall: "steel", platform: "steel", ramp: "wood", seesaw: "wood", wedge: "wood",
  conveyor: "dark", ice: "ice", sticky: "sticky", accelerator: "dark", mirror: "mirror",
};
function drawBarPart(ctx, body, transform, opts = {}) {
  const key = body.plugin && body.plugin.partType;
  const styleKey = BAR_PARTS[key];
  if (!styleKey) return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const { w, h } = bodyDrawSize(body, "plank");
  const bw = w * t.scale, bh = Math.max(h * t.scale, 10);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(body.angle || 0);
  if (opts.squash) ctx.scale(opts.squash.sx, opts.squash.sy);
  drawBar(ctx, bw, bh, BAR_STYLES[styleKey]);
  // conveyor: small rolling belt arrows on top, in its direction of travel (render-only)
  if (key === "conveyor" && opts.running && !opts.reducedMotion) {
    const speed = (body.plugin && body.plugin.surfaceSpeed) || 3;
    const dir = speed < 0 ? -1 : 1;
    const period = 34, phase = ((opts.now || 0) / 12) % period;
    ctx.save();
    ctx.strokeStyle = "#ffd45a"; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(1.4, bh * 0.14);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let x = -bw / 2 + ((dir * phase) % period); x < bw / 2; x += period) {
      ctx.beginPath();
      ctx.moveTo(x - dir * bh * 0.22, -bh * 0.22); ctx.lineTo(x + dir * bh * 0.22, 0); ctx.lineTo(x - dir * bh * 0.22, bh * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return true;
}

// Saw: a steel disc with radial teeth, spinning via the same render-only
// spinAngle() helper the conveyor/fan sprites already use — never touches
// the (static) collision body.
function drawSaw(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "saw") return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const r = (body.plugin.r || 24) * t.scale;
  const angle = spinAngle(body.angle || 0, body.plugin.spin || 8, opts.now, opts.running, opts.reducedMotion);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  grad.addColorStop(0, "#eef3f7"); grad.addColorStop(1, "#8b9aab");
  ctx.fillStyle = grad;
  const teeth = 10;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / teeth * 0.5;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r * 1.18, Math.sin(a1) * r * 1.18);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#2a3340"; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = "#1c232e"; ctx.fill();
  ctx.restore();
  return true;
}

// Motor: gears-style spinning disc, dimmed/greyed when not currently powered by
// a nearby outlet (pl._powered, set live each tick by the engine) — the
// spinning/dimming pair reads as "on/off" with no HUD text needed.
function drawMotor(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "motor") return false;
  const t = transform;
  const pl = body.plugin;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const r = (pl.radius || 30) * t.scale;
  const angle = spinAngle(body.angle || 0, pl._powered ? (pl.spin || 4) : 0, opts.now, opts.running, opts.reducedMotion);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.globalAlpha = pl._powered ? 1 : 0.45;
  const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  grad.addColorStop(0, "#eef3f7"); grad.addColorStop(1, "#8b9aab");
  ctx.fillStyle = grad;
  const teeth = 8;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / teeth * 0.5;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r * 1.12, Math.sin(a1) * r * 1.12);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#2a3340"; ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = pl._powered ? "#ffd45a" : "#1c232e"; ctx.fill();
  ctx.restore();
  return true;
}

// One-way gate: a static plank with a bold chevron pointing the allowed direction,
// drawn in the plate's own rotated frame (matches drawBarPart's plank sizing).
function drawOneway(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "oneway") return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const { w, h } = bodyDrawSize(body, "plank");
  const bw = w * t.scale, bh = Math.max(h * t.scale, 10);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(body.angle || 0);
  drawBar(ctx, bw, bh, BAR_STYLES.steel);
  // chevrons point along the plate's own +y (the allowed pass direction), i.e.
  // "down" in the plate's local frame before rotation — matches the engine's
  // `velNormal` sign convention in engine.js's oneway branch.
  ctx.strokeStyle = "#ffd45a"; ctx.globalAlpha = 0.95; ctx.lineWidth = Math.max(1.6, bh * 0.16);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const cw = bh * 0.3;
  ctx.beginPath(); ctx.moveTo(-cw, -cw * 0.8); ctx.lineTo(0, cw * 0.6); ctx.lineTo(cw, -cw * 0.8); ctx.stroke();
  ctx.restore();
  return true;
}

// Zipline: the static cable (a plain line between the two stored anchor points,
// drawn once from level data, not a body) plus the basket riding it.
function drawZipline(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "zipline") return false;
  const t = transform;
  const pl = body.plugin;
  const a = worldToScreen(pl.x1, pl.y1, t), b = worldToScreen(pl.x2, pl.y2, t);
  ctx.save();
  ctx.strokeStyle = "#5b6878"; ctx.lineWidth = Math.max(1.5, 2 * t.scale);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();

  const center = worldToScreen(body.position.x, body.position.y, t);
  const bw = 70 * t.scale, bh = 34 * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  const grad = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  grad.addColorStop(0, "#e6b478"); grad.addColorStop(1, "#a86d2c");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#3a2412"; ctx.lineWidth = Math.max(1.5, bh * 0.1);
  ctx.beginPath();
  ctx.moveTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2);
  ctx.lineTo(bw / 2, bh / 2); ctx.lineTo(-bw / 2, bh / 2);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  return true;
}

// Laser: emitter housing (glowing nub) + the beam polyline computed each tick by
// the engine (pl._beamPoints/_blocked, render-only consumption). Beam tints
// success-green while blocked (gate open), warm accent otherwise, so the state
// reads at a glance with no HUD text.
function drawLaser(ctx, body, transform, theme, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "laser") return false;
  const t = transform;
  const pl = body.plugin;
  const now = opts.now || 0;
  const pulse = opts.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 220);

  if (pl._beamPoints && pl._beamPoints.length > 1) {
    ctx.save();
    ctx.strokeStyle = pl._blocked ? theme.goal : (theme.accent || "#ffd45a");
    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    ctx.lineWidth = Math.max(1.5, 2.4 * t.scale);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    const p0 = worldToScreen(pl._beamPoints[0].x, pl._beamPoints[0].y, t);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pl._beamPoints.length; i++) {
      const p = worldToScreen(pl._beamPoints[i].x, pl._beamPoints[i].y, t);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const center = worldToScreen(body.position.x, body.position.y, t);
  const s = 13 * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(body.angle || pl.angle || 0);
  const grad = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s);
  grad.addColorStop(0, "#ffd08a"); grad.addColorStop(1, "#d4561a");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2); ctx.fill();
  ctx.strokeStyle = "#7a1d12"; ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.stroke();
  ctx.fillStyle = pl._blocked ? theme.goal : "#fff8e6";
  ctx.globalAlpha = 0.8 + 0.2 * pulse;
  ctx.beginPath(); ctx.arc(s * 0.9, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return true;
}

// Mouse: two-tone body + ear + tail, walk-cycle leg wiggle driven by time
// (render-only — never touches the actual kinematic-walker physics).
function drawMouse(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "mouse") return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const w = (body.plugin.w || 34) * t.scale, h = (body.plugin.h || 20) * t.scale;
  const dir = body.plugin.dir || 1;
  const now = opts.now || 0;
  const walk = opts.running && !opts.reducedMotion ? Math.sin(now / 90) * 0.35 : 0;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(dir, 1);
  // tail
  ctx.strokeStyle = "#8b7a6b"; ctx.lineWidth = Math.max(1.2, h * 0.08); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-w * 0.42, 0); ctx.quadraticCurveTo(-w * 0.75, -h * 0.3, -w * 0.9, 0); ctx.stroke();
  // legs (wiggle)
  ctx.strokeStyle = "#5a4a3c"; ctx.lineWidth = Math.max(1.4, h * 0.14);
  ctx.beginPath(); ctx.moveTo(-w * 0.15, h * 0.4); ctx.lineTo(-w * 0.15 + walk * h, h * 0.65); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.4); ctx.lineTo(w * 0.15 - walk * h, h * 0.65); ctx.stroke();
  // body
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, "#c9bcae"); grad.addColorStop(1, "#8b7a6b");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(0, 0, w * 0.42, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#3a2f26"; ctx.lineWidth = Math.max(1.2, h * 0.08); ctx.stroke();
  // ear
  ctx.fillStyle = "#d9cfc4"; ctx.strokeStyle = "#3a2f26";
  ctx.beginPath(); ctx.arc(w * 0.28, -h * 0.35, h * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // eye + nose
  ctx.fillStyle = "#1c1512";
  ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.05, h * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.44, h * 0.02, h * 0.09, 0, Math.PI * 2); ctx.fillStyle = "#c0504a"; ctx.fill();
  ctx.restore();
  return true;
}

// Cannon: barrel + carriage rotated to its facing angle; recoils/flashes on
// fire (reads pl._spent), then renders an emptied dark barrel afterward.
function drawCannon(ctx, body, transform, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "cannon") return false;
  const t = transform;
  const pl = body.plugin;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const w = 64 * t.scale, h = 30 * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(body.angle || pl.angle || 0);
  // carriage
  ctx.fillStyle = "#5e3c18"; ctx.strokeStyle = "#3a2412"; ctx.lineWidth = Math.max(1.5, h * 0.1);
  ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.32, w * 0.22, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // barrel
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  if (pl._spent) { grad.addColorStop(0, "#3a4452"); grad.addColorStop(1, "#1b222d"); }
  else { grad.addColorStop(0, "#8b9aab"); grad.addColorStop(1, "#3a4452"); }
  ctx.fillStyle = grad;
  const r = Math.min(6, h * 0.3);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -h / 2); ctx.lineTo(w / 2 - r, -h / 2);
  ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  ctx.lineTo(w / 2, h / 2 - r); ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  ctx.lineTo(-w / 2 + r, h / 2); ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  ctx.lineTo(-w / 2, -h / 2 + r); ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#1b222d"; ctx.lineWidth = Math.max(1.5, h * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(w / 2 - h * 0.12, 0, h * 0.16, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = pl._spent ? "#0e1218" : "#11161f"; ctx.fill();
  ctx.restore();
  return true;
}

// Vacuum: housing + a faint translucent cone overlay showing the suction area
// (static per-frame alpha — reads clearly without extra animation budget).
function drawVacuum(ctx, body, transform, theme, opts = {}) {
  if (!body.plugin || body.plugin.partType !== "vacuum") return false;
  const t = transform;
  const pl = body.plugin;
  const center = worldToScreen(body.position.x, body.position.y, t);
  const r = 26 * t.scale;
  const faceAngle = (body.angle || pl.angle || 0) - Math.PI / 2;
  const coneHalf = pl.coneAngle || Math.PI / 3;
  const range = (pl.range || 220) * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  // cone overlay (drawn in world-facing direction, not rotated with the housing scale below)
  ctx.save();
  ctx.rotate(faceAngle);
  ctx.fillStyle = theme.accent || "#9ad6ff";
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -coneHalf, coneHalf);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // housing
  const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
  grad.addColorStop(0, "#eef3f7"); grad.addColorStop(1, "#697686");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#2a3340"; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fillStyle = "#1c232e"; ctx.fill();
  ctx.restore();
  return true;
}

function drawSprite(ctx, body, spr, transform, opts = {}) {
  const img = getImage(spr.src); if (!img) return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  let { w, h } = bodyDrawSize(body, spr.fit);
  w *= spr.scale * (1 + spr.overflow); h *= spr.scale * (1 + spr.overflow);
  let sw = w * t.scale, sh = h * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  const angle = spinAngle(body.angle || 0, spr.spin, opts.now, opts.running, opts.reducedMotion);
  ctx.rotate(angle);
  // Render-only squash & stretch (e.g. the ball deforms with speed). Applied as a
  // canvas scale around the body center — never touches the collision shape.
  if (opts.squash) { ctx.scale(opts.squash.sx, opts.squash.sy); }

  // Wide-wall tiling fix: for plank/box bodies whose width is >2.2× the sprite's natural aspect,
  // tile horizontally instead of stretching.
  if ((spr.fit === "plank" || spr.fit === "box") && img.naturalWidth && img.naturalHeight) {
    const ar = img.naturalWidth / img.naturalHeight;
    const naturalDrawWidth = sh * ar; // width sprite would have at body's height
    if (sw > 2.2 * naturalDrawWidth) {
      const tileCount = Math.ceil(sw / naturalDrawWidth);
      const tileW = naturalDrawWidth;
      const offsetX = -(tileCount * tileW) / 2;
      ctx.beginPath();
      ctx.rect(-sw/2, -sh/2, sw, sh);
      ctx.clip();
      for (let i = 0; i < tileCount; i++) {
        ctx.drawImage(img, offsetX + i * tileW, -sh/2, tileW, sh);
      }
      ctx.restore();
      return true;
    }
  }

  ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
  // Hit-flash: brief white wash on hard impact (uses the sprite as a mask).
  if (opts.flash > 0) {
    ctx.globalAlpha = opts.flash * 0.7;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  return true;
}

export function resizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const transform = fitTransform(1280, 720, canvas.width, canvas.height);
  return { transform, dpr };
}

// Goal target: a soft pulsing fill + a static dashed frame (marching-ants dash
// offset only — the frame itself never rotates, so it always reads as the win
// RECTANGLE, never as a stray rotating diamond) with a centered bullseye ring
// sized to the zone. Brightens with dwell progress so "where do I get the
// ball" reads instantly and the near-win moment is legible. Pure-visual; this
// fully replaces the old separate goal-sprite body (a trophy PNG that had its
// own fixed 110x110 footprint, mismatched against the level's actual zone
// size — the "cup inside an odd frame" look).
function drawGoal(ctx, z, t, theme, opts) {
  const p = worldToScreen(z.x, z.y, t);
  const w = z.w * t.scale, h = z.h * t.scale;
  const cx = p.x + w / 2, cy = p.y + h / 2;
  const now = opts.now || 0;
  const pulse = opts.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 480);
  const dwell = opts.dwell || 0; // 0..1 progress toward the dwell win

  ctx.save();
  // soft glow fill (stronger as the ball dwells in-zone)
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(w, h) * 0.7);
  const glowA = 0.10 + 0.22 * pulse + 0.30 * dwell;
  grad.addColorStop(0, withAlpha(theme.goal, glowA));
  grad.addColorStop(1, withAlpha(theme.goal, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(p.x - w * 0.3, p.y - h * 0.3, w * 1.6, h * 1.6);

  ctx.translate(cx, cy);

  // static dashed frame (dash pattern marches, the rectangle itself holds still)
  ctx.strokeStyle = theme.goal;
  ctx.lineWidth = 2 + 1.5 * dwell;
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = opts.reducedMotion ? 0 : -now / 60;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);

  // centered bullseye: two concentric rings + a core dot, radius tied to the
  // zone's own size so it always reads as "land in the middle of THIS zone".
  const ringR = Math.min(w, h) * 0.32;
  ctx.lineWidth = 2 + 1.5 * dwell;
  ctx.globalAlpha = 0.55 + 0.35 * pulse + 0.1 * dwell;
  ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, ringR * 0.6, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.85 + 0.15 * dwell;
  ctx.fillStyle = theme.goal;
  ctx.beginPath(); ctx.arc(0, 0, ringR * 0.16 + ringR * 0.1 * dwell, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// Parse a CSS color token to {r,g,b}; supports #rgb/#rrggbb and rgb()/rgba().
// Falls back to mid-grey so a malformed token never throws in the render loop.
function parseColor(c) {
  if (!c) return { r: 128, g: 128, b: 128 };
  c = c.trim();
  if (c[0] === "#") {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
    const n = parseInt(hex, 16);
    if (!isFinite(n)) return { r: 128, g: 128, b: 128 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const [r, g, b] = m[1].split(",").map(s => parseInt(s, 10)); return { r: r || 0, g: g || 0, b: b || 0 }; }
  return { r: 128, g: 128, b: 128 };
}
function withAlpha(c, a) {
  const { r, g, b } = parseColor(c);
  const al = Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 0; // never emit NaN
  return `rgba(${r},${g},${b},${al})`;
}
// Scale a color toward black (f<1) or white (f>1) — for cheap gradient stops.
function shade(c, f) {
  const { r, g, b } = parseColor(c);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  if (f <= 1) return `rgb(${cl(r * f)},${cl(g * f)},${cl(b * f)})`;
  const t = f - 1;
  return `rgb(${cl(r + (255 - r) * t)},${cl(g + (255 - g) * t)},${cl(b + (255 - b) * t)})`;
}

// Themed atmospheric backdrop: a soft vertical gradient (depth) plus a few slow
// drifting motes (parallax dust). Screen-space, drawn behind the shaken world so
// it stays steady while the camera kicks. Deterministic from `now` (no state).
function drawBackground(ctx, theme, now, reduced) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(theme.bg, 1.18));
  g.addColorStop(0.55, theme.bg);
  g.addColorStop(1, shade(theme.bg, 0.82));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (reduced) return;
  // drifting motes — incommensurate sines so they wander, low alpha so they whisper
  ctx.save();
  ctx.fillStyle = withAlpha(theme.accent, 0.06);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const px = (0.5 + 0.5 * Math.sin(now / (5200 + i * 240) + i * 1.7)) * w;
    const py = (0.5 + 0.5 * Math.sin(now / (6100 + i * 180) + i * 0.9)) * h;
    const r = (1.5 + (i % 4)) * (w / 1280);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Screen-space vignette: darkens the corners to focus the eye on the playfield.
// Drawn last (over the shaken world) so it never moves.
function drawVignette(ctx) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Offscreen grid cache: the static grid is re-strokeable every frame, but caching
// it to an offscreen canvas (keyed by size+theme) removes ~66 line strokes/frame —
// the research's top Canvas2D perf win, and headroom for the new effects.
let _gridCache = null, _gridKey = "";
function getGrid(theme, transform, w, h) {
  const key = `${w}x${h}:${theme.grid}`;
  if (_gridCache && _gridKey === key) return _gridCache;
  const off = (typeof OffscreenCanvas !== "undefined")
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const g = off.getContext("2d");
  g.strokeStyle = theme.grid; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= 1280; x += 40) { const a = worldToScreen(x, 0, transform), b = worldToScreen(x, 720, transform); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
  for (let y = 0; y <= 720; y += 40) { const a = worldToScreen(0, y, transform), b = worldToScreen(1280, y, transform); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
  g.stroke();
  _gridCache = off; _gridKey = key;
  return off;
}

// Soft contact shadow blob under a body (cheap depth cue; static parts get a
// flatter shadow, dynamic parts a rounder one). World-space, behind everything.
function drawBodyShadow(ctx, body, t) {
  const b = body.bounds;
  const w = (b.max.x - b.min.x) * t.scale;
  const cx = body.position.x * t.scale + t.ox;
  const top = b.max.y * t.scale + t.oy;
  const rx = Math.max(6, w * 0.45), ry = Math.max(3, rx * 0.22);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx, top + ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, state, transform, theme, opts = {}) {
  const t = transform;
  const fx = opts.fx || null;
  const shake = fx ? fx.shakeOffset(22) : { x: 0, y: 0, angle: 0 };

  // Steady backdrop (does NOT shake) — gradient depth + drifting motes.
  drawBackground(ctx, theme, opts.now || 0, opts.reducedMotion);

  ctx.save();
  // Everything below the chrome shakes together (camera trauma). Rotate/translate
  // around the canvas center so the shake reads as a camera kick, not a slide.
  if (shake.x || shake.y || shake.angle) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.translate(cw / 2 + shake.x, ch / 2 + shake.y);
    ctx.rotate(shake.angle);
    ctx.translate(-cw / 2, -ch / 2);
  }

  // grid (cached offscreen; re-rendered only when size/theme changes)
  try { ctx.drawImage(getGrid(theme, t, ctx.canvas.width, ctx.canvas.height), 0, 0); }
  catch { // fallback to direct strokes if OffscreenCanvas/cache fails
    ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= 1280; x += 40) { const a = worldToScreen(x,0,t), b = worldToScreen(x,720,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
    for (let y = 0; y <= 720; y += 40) { const a = worldToScreen(0,y,t), b = worldToScreen(1280,y,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
    ctx.stroke();
  }

  // goal zone (animated target)
  if (state.goalZone) drawGoal(ctx, state.goalZone, t, theme, opts);

  // soft shadows first (so they sit under every body)
  for (const body of state.bodies || []) {
    if (body.plugin && body.plugin.partType === "boundary") continue;
    if (body.plugin && (body.plugin.partType === "goal")) continue;
    drawBodyShadow(ctx, body, t);
  }

  // bodies
  for (const body of state.bodies || []) {
    if (body.plugin && body.plugin.partType === "boundary") continue;
    // The goal body is a sensor-only marker; drawGoal() above already drew the
    // zone's bullseye sized to the real win rectangle — never draw the old
    // fixed-size trophy sprite/vector shape on top of it.
    if (body.plugin && body.plugin.partType === "goal") continue;
    const bodyOpts = bodyFxOpts(body, fx, opts);
    if (drawBarPart(ctx, body, t, bodyOpts)) continue;   // procedural bar → skip sprite/vector
    if (drawSaw(ctx, body, t, bodyOpts)) continue;
    if (drawOneway(ctx, body, t, bodyOpts)) continue;
    if (drawZipline(ctx, body, t, bodyOpts)) continue;
    if (drawLaser(ctx, body, t, theme, bodyOpts)) continue;
    if (drawMouse(ctx, body, t, bodyOpts)) continue;
    if (drawMotor(ctx, body, t, bodyOpts)) continue;
    if (drawCannon(ctx, body, t, bodyOpts)) continue;
    if (drawVacuum(ctx, body, t, theme, bodyOpts)) continue;
    const spr = resolveSprite(body.plugin && body.plugin.partType, opts.themeId);
    if (spr && drawSprite(ctx, body, spr, t, bodyOpts)) continue;   // sprite drawn → skip vector
    const parts = body.parts && body.parts.length > 1 ? body.parts.slice(1) : [body];
    ctx.fillStyle = body.isStatic ? theme.fixedFill : theme.partFill;
    ctx.strokeStyle = theme.partStroke; ctx.lineWidth = 2;
    for (const part of parts) {
      const vs = part.vertices;
      ctx.beginPath();
      const p0 = worldToScreen(vs[0].x, vs[0].y, t); ctx.moveTo(p0.x, p0.y);
      for (let i=1;i<vs.length;i++){ const p = worldToScreen(vs[i].x, vs[i].y, t); ctx.lineTo(p.x,p.y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // vector hit-flash overlay
    if (bodyOpts.flash > 0) {
      ctx.save(); ctx.globalAlpha = bodyOpts.flash * 0.6; ctx.fillStyle = "#fff";
      for (const part of parts) {
        const vs = part.vertices; ctx.beginPath();
        const p0 = worldToScreen(vs[0].x, vs[0].y, t); ctx.moveTo(p0.x, p0.y);
        for (let i=1;i<vs.length;i++){ const p = worldToScreen(vs[i].x, vs[i].y, t); ctx.lineTo(p.x,p.y); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Spark-line between a powered outlet/motor pair — same world-to-screen line
  // drawing the laser beam already uses, just one fixed segment instead of a
  // polyline. Pure render pass, reads the engine's own pl._powered flag.
  for (const body of state.bodies || []) {
    if (!body.plugin || body.plugin.partType !== "motor" || !body.plugin._powered) continue;
    let nearest = null, bestD = Infinity;
    for (const o of state.bodies || []) {
      if (!o.plugin || o.plugin.partType !== "outlet") continue;
      const d = Math.hypot(o.position.x - body.position.x, o.position.y - body.position.y);
      if (d < (o.plugin.range || 220) && d < bestD) { bestD = d; nearest = o; }
    }
    if (!nearest) continue;
    const now = opts.now || 0;
    const pulse = opts.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 90);
    const a = worldToScreen(body.position.x, body.position.y, t), b = worldToScreen(nearest.position.x, nearest.position.y, t);
    ctx.save();
    ctx.strokeStyle = theme.accent || "#ffd45a";
    ctx.globalAlpha = 0.4 + 0.5 * pulse;
    ctx.lineWidth = Math.max(1.2, 1.8 * t.scale);
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // particles (impacts, explosions, confetti) ride above the bodies
  if (fx) fx.drawParticles(ctx, t);

  // ghost (part being placed)
  if (opts.ghost) {
    const g = opts.ghost;
    const ghostSpr = g.partType ? resolveSprite(g.partType, opts.themeId) : null;
    if (g.body && BAR_PARTS[g.partType]) {
      ctx.globalAlpha = 0.6;
      drawBarPart(ctx, g.body, t, opts);
      ctx.globalAlpha = 1;
    } else if (ghostSpr && g.body) {
      ctx.globalAlpha = 0.6;
      drawSprite(ctx, g.body, ghostSpr, t, opts);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.5; ctx.fillStyle = g.valid ? theme.accent : "#e23";
      ctx.beginPath();
      const v = g.vertices; const p0 = worldToScreen(v[0].x,v[0].y,t); ctx.moveTo(p0.x,p0.y);
      for (let i=1;i<v.length;i++){ const p = worldToScreen(v[i].x,v[i].y,t); ctx.lineTo(p.x,p.y); }
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // vignette sits over the (shaken) world, in steady screen space
  drawVignette(ctx);
}

// Per-body fx options: flash level (from collision) + ball squash-stretch by speed.
function bodyFxOpts(body, fx, opts) {
  const o = { now: opts.now, running: opts.running, reducedMotion: opts.reducedMotion, flash: 0, squash: null };
  if (!fx) return o;
  o.flash = fx.flashLevel(body.id);
  if (opts.running && !opts.reducedMotion && body.plugin && body.plugin.partType === "ball" && body.velocity) {
    const sp = Math.hypot(body.velocity.x, body.velocity.y);
    if (sp > 4) o.squash = squashStretch(sp, 25, 0.16);
  }
  return o;
}
