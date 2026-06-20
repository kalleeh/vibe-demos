export const snap = (v, grid) => Math.round(v / grid) * grid;

export const aabbOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const pointInRect = (px, py, r) =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export function fitTransform(worldW, worldH, viewW, viewH) {
  const scale = Math.min(viewW / worldW, viewH / worldH);
  return { scale, ox: (viewW - worldW * scale) / 2, oy: (viewH - worldH * scale) / 2 };
}
export const worldToScreen = (wx, wy, t) => ({ x: wx * t.scale + t.ox, y: wy * t.scale + t.oy });
export const screenToWorld = (sx, sy, t) => ({ x: (sx - t.ox) / t.scale, y: (sy - t.oy) / t.scale });
