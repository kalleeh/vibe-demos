import { tokens } from "./theme.js";
import { fitTransform, worldToScreen } from "./geom.js";
import { resolveSprite, getImage } from "./sprites.js";

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

function drawSprite(ctx, body, spr, transform, opts = {}) {
  const img = getImage(spr.src); if (!img) return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  let { w, h } = bodyDrawSize(body, spr.fit);
  w *= spr.scale * (1 + spr.overflow); h *= spr.scale * (1 + spr.overflow);
  const sw = w * t.scale, sh = h * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  const angle = spinAngle(body.angle || 0, spr.spin, opts.now, opts.running, opts.reducedMotion);
  ctx.rotate(angle);

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

export function drawWorld(ctx, state, transform, theme, opts = {}) {
  const t = transform;
  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // grid (every 40 world units)
  ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= 1280; x += 40) { const a = worldToScreen(x,0,t), b = worldToScreen(x,720,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
  for (let y = 0; y <= 720; y += 40) { const a = worldToScreen(0,y,t), b = worldToScreen(1280,y,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
  ctx.stroke();

  // goal zone
  if (state.goalZone) {
    const z = state.goalZone, p = worldToScreen(z.x, z.y, t);
    ctx.strokeStyle = theme.goal; ctx.lineWidth = 3; ctx.setLineDash([10,8]);
    ctx.strokeRect(p.x, p.y, z.w * t.scale, z.h * t.scale); ctx.setLineDash([]);
  }

  // bodies
  for (const body of state.bodies || []) {
    if (body.plugin && body.plugin.partType === "boundary") continue;
    const spr = resolveSprite(body.plugin && body.plugin.partType, opts.themeId);
    if (spr && drawSprite(ctx, body, spr, t, opts)) continue;   // sprite drawn → skip vector
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
  }

  // ghost (part being placed)
  if (opts.ghost) {
    const g = opts.ghost;
    const ghostSpr = g.partType ? resolveSprite(g.partType, opts.themeId) : null;
    if (ghostSpr && g.body) {
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
}
