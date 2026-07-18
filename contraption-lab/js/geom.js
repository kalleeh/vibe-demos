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

// Vector reflection of `dir` across a unit `normal` (standard d - 2(d.n)n).
export function reflect(dir, normal) {
  const dot = dir.x * normal.x + dir.y * normal.y;
  return { x: dir.x - 2 * dot * normal.x, y: dir.y - 2 * dot * normal.y };
}

// Nearest intersection of ray (origin + t*dir, t>0) with segment [a,b].
// Returns {t, point, normal} (normal is unit-length, facing against `dir`) or null.
// `dir` need not be unit length — t is in dir-units, only meaningful for ordering
// against other hits computed with the SAME dir (which is how the laser uses it).
export function raySegmentIntersect(origin, dir, a, b) {
  const ex = b.x - a.x, ey = b.y - a.y;
  const denom = dir.x * ey - dir.y * ex;
  if (Math.abs(denom) < 1e-9) return null; // parallel (or degenerate segment)
  const apx = a.x - origin.x, apy = a.y - origin.y;
  const t = (apx * ey - apy * ex) / denom;
  const s = (apx * dir.y - apy * dir.x) / denom;
  if (t <= 1e-6 || s < 0 || s > 1) return null;
  const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  let nx = -ey, ny = ex; // perpendicular to the segment
  const nlen = Math.hypot(nx, ny) || 1;
  nx /= nlen; ny /= nlen;
  if (nx * dir.x + ny * dir.y > 0) { nx = -nx; ny = -ny; } // face against the incoming ray
  return { t, point, normal: { x: nx, y: ny } };
}

// True if (px,py) lies within `halfAngle` radians of `dirAngle` as seen from
// (ox,oy) — the vacuum's suction cone check (fan uses a plain radius; this adds
// the directional gate on top of the same distance idea).
export function pointInCone(px, py, ox, oy, dirAngle, halfAngle) {
  const dx = px - ox, dy = py - oy;
  if (dx === 0 && dy === 0) return true;
  const angleTo = Math.atan2(dy, dx);
  let diff = angleTo - dirAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to [-PI, PI]
  return Math.abs(diff) <= halfAngle;
}

// Nearest intersection of ray (origin + t*dir, t>0) with a circle. Returns {t, point} or null.
export function rayCircleIntersect(origin, dir, center, radius) {
  const fx = origin.x - center.x, fy = origin.y - center.y;
  const a = dir.x * dir.x + dir.y * dir.y;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dir.x + fy * dir.y);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  const t = t1 > 1e-6 ? t1 : (t2 > 1e-6 ? t2 : null);
  if (t == null) return null;
  return { t, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t } };
}
