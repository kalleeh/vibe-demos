import { tokens } from "./theme.js";
import { fitTransform, worldToScreen } from "./geom.js";

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
    ctx.globalAlpha = 0.5; ctx.fillStyle = g.valid ? theme.accent : "#e23";
    ctx.beginPath();
    const v = g.vertices; const p0 = worldToScreen(v[0].x,v[0].y,t); ctx.moveTo(p0.x,p0.y);
    for (let i=1;i<v.length;i++){ const p = worldToScreen(v[i].x,v[i].y,t); ctx.lineTo(p.x,p.y); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
