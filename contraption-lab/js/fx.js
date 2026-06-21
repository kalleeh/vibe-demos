// contraption-lab/js/fx.js
// Render-only "juice" layer: screen shake, particles, hit-flash, and easing/tween
// helpers. NOTHING here touches the physics simulation — fx is fed by sim.onEvent
// and the render loop, and only ever produces visual offsets and overlays. The
// headless solvability harness (tools/solve-verify.mjs) never imports this file,
// so the physics contract is preserved by construction.
//
// All time is milliseconds. World coordinates match the sim/render space (1280×720).

// ----------------------------------------------------------------------------
// Pure helpers (Node-safe, deterministic — unit-tested in fx.test.js)
// ----------------------------------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Easing curves, mapped to purpose per the game-feel research:
//   outBack    — overshoot-and-settle: popups, buttons, pickups (the "pop")
//   outQuad    — gentle decel: sliding panels / trays
//   outCubic   — slightly stronger decel: camera / value counters
//   outElastic — springy wobble: use sparingly (win flourish)
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

// Trauma → shake magnitude. Squaring makes small trauma barely shake and large
// trauma kick hard, which reads as "weighty" rather than a constant jitter
// (Eiserloh, GDC 2016). Returns 0..1.
export const traumaToMagnitude = (trauma) => {
  const c = clamp01(trauma);
  return c * c;
};

// Deterministic smooth pseudo-noise in [-1, 1]. Sum of incommensurate sines so it
// drifts smoothly (not a per-frame random strobe) yet needs no Perlin table.
export function shakeNoise(seed, t) {
  return (
    0.6 * Math.sin(t * 0.045 + seed * 12.9898) +
    0.3 * Math.sin(t * 0.113 + seed * 78.233) +
    0.1 * Math.sin(t * 0.250 + seed * 37.719)
  );
}

// Speed-driven squash & stretch that preserves area (sy = 1/sx). Faster ⇒ taller
// & thinner along travel; capped so it never looks like a glitch. amount≈0.18 is
// a subtle default. Returns {sx, sy} multipliers around 1.
export function squashStretch(speed, maxSpeed, amount = 0.18) {
  const r = maxSpeed > 0 ? clamp01(speed / maxSpeed) : 0;
  const stretch = 1 + r * amount;
  return { sx: 1 / stretch, sy: stretch };
}

// Map a collision speed (Matter velocity-delta units) to a 0..1 intensity. ~3.5 is
// the audible-bounce threshold used by the engine; ~22 is a hard slam.
export const impactIntensity = (speed) => clamp01((speed - 3.5) / 18);

// Advance one particle by dt; mutates in place, returns true while still alive.
// Pure (no globals/time) so it is unit-testable. gravity is world-units/s².
export function stepParticle(p, dtMs, gravity = 900) {
  const dt = dtMs / 1000;
  p.vy += gravity * dt;
  p.vx *= 1 - p.drag * dt;
  p.vy *= 1 - p.drag * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= dtMs;
  return p.life > 0;
}

// ----------------------------------------------------------------------------
// Stateful FX manager (browser-side; holds particles, trauma, hit-flashes)
// ----------------------------------------------------------------------------

const MAX_PARTICLES = 400; // hard cap so a chain reaction can never tank the frame

export class Fx {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.trauma = 0;
    this.seed = 1;
    this.particles = [];
    this.flashes = new Map(); // body.id → {until, dur}
    this._t = 0;
  }

  setReducedMotion(v) { this.reducedMotion = !!v; }

  // Add camera trauma (0..1, clamped). No-op under reduced motion.
  addTrauma(amount) {
    if (this.reducedMotion) return;
    this.trauma = clamp01(this.trauma + amount);
    this.seed = (this.seed % 1000) + 1; // re-seed so successive shakes differ
  }

  // Current screen-shake offset in *screen pixels*, given a max magnitude.
  shakeOffset(maxPx = 22) {
    if (this.reducedMotion || this.trauma <= 0) return { x: 0, y: 0, angle: 0 };
    const m = traumaToMagnitude(this.trauma) * maxPx;
    return {
      x: m * shakeNoise(this.seed, this._t),
      y: m * shakeNoise(this.seed + 100, this._t),
      angle: traumaToMagnitude(this.trauma) * 0.025 * shakeNoise(this.seed + 200, this._t),
    };
  }

  // Register a brief white/brighten flash on a body (by Matter body id).
  flash(bodyId, durMs = 110) {
    if (bodyId == null) return;
    this.flashes.set(bodyId, { until: this._t + durMs, dur: durMs });
  }

  // 0..1 flash brightness for a body right now (1 = just hit, fades out).
  flashLevel(bodyId) {
    const f = this.flashes.get(bodyId);
    if (!f) return 0;
    const remain = f.until - this._t;
    if (remain <= 0) return 0;
    return clamp01(remain / f.dur);
  }

  // Spawn a radial spray of particles at world (x,y). Used for impacts / explosions.
  burst(x, y, { count = 10, color = "#fff", speed = 220, spread = Math.PI * 2, dir = 0, size = 3, life = 480, gravity = 900, drag = 1.6 } = {}) {
    if (this.reducedMotion) count = Math.min(count, 4); // calmer, never zero
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = dir + (Math.random() - 0.5) * spread;
      const sp = speed * (0.5 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: life * (0.7 + Math.random() * 0.5),
        maxLife: life,
        size: size * (0.7 + Math.random() * 0.7),
        color, drag, gravity,
      });
    }
  }

  // Confetti fountain for the win moment — upward cone, slow gravity, longer life.
  confetti(x, y, colors) {
    const n = this.reducedMotion ? 16 : 90;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 280 + Math.random() * 360;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1100 + Math.random() * 700,
        maxLife: 1800,
        size: 3 + Math.random() * 4,
        color: colors[(Math.random() * colors.length) | 0],
        drag: 0.8, gravity: 520,
      });
    }
  }

  // Advance trauma decay, particles, and flash expiry. Call once per frame.
  update(dtMs) {
    this._t += dtMs;
    // trauma decays linearly (~over 0.9s) so a single event eases back, not snaps
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - dtMs / 900);
    // particles
    const live = [];
    for (const p of this.particles) if (stepParticle(p, dtMs, p.gravity)) live.push(p);
    this.particles = live;
    // expire flashes
    if (this.flashes.size) {
      for (const [id, f] of this.flashes) if (f.until <= this._t) this.flashes.delete(id);
    }
  }

  hasActiveParticles() { return this.particles.length > 0; }

  // Draw particles in *world* space using the same transform as the renderer.
  drawParticles(ctx, transform) {
    if (!this.particles.length) return;
    const t = transform;
    ctx.save();
    for (const p of this.particles) {
      const alpha = clamp01(p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const sx = p.x * t.scale + t.ox, sy = p.y * t.scale + t.oy;
      const r = Math.max(1, p.size * t.scale);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear() {
    this.particles.length = 0;
    this.flashes.clear();
    this.trauma = 0;
  }
}
