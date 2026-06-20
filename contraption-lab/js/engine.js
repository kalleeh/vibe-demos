// Core simulation: build/run/reset state machine, player part placement, dwell win.

import { buildWorld } from "./level.js";
import { makePart, PARTS } from "./parts.js";
import { aabbOverlap } from "./geom.js";

const MAX_RUN_MS = 30000;
const M = () => Matter;

export class Sim {
  constructor(level) {
    this.level = level;
    this.placed = [];  // player-added specs {type,x,y,angle}
    this._build();
  }

  _build() {
    const m = M();
    const w = buildWorld(this.level, m);
    this.engine = w.engine;
    this.world = w.world;
    this.bodies = w.bodies;
    this.goalZone = w.goalZone;

    // Re-add any placed parts (static during build phase)
    for (const spec of this.placed) {
      this._spawn(spec, true);
    }

    this.state = "build";
    this.elapsed = 0;
    this.dwell = 0;
  }

  _spawn(spec, staticDuringBuild) {
    const m = M();
    const { bodies, constraints } = makePart(spec.type, spec);

    // Mark these as player-placed
    bodies.forEach(b => {
      b.plugin.placed = true;
      if (spec.angle) m.Body.setAngle(b, spec.angle);
      if (staticDuringBuild) m.Body.setStatic(b, true);
    });

    m.Composite.add(this.world, bodies);
    if (constraints && constraints.length) m.Composite.add(this.world, constraints);
    this.bodies.push(...bodies);

    return bodies;
  }

  addPlayerPart(type, x, y, angle = 0) {
    const spec = { type, x, y, angle };
    this.placed.push(spec);
    return this._spawn(spec, true);
  }

  // Index of the closest placed part within tap range of (wx,wy), or -1.
  // 80 world-unit radius (comfortable tap target; ~40px at 0.5 letterbox scale).
  placedAt(wx, wy) {
    let idx = -1, best = 80 * 80;
    this.placed.forEach((s, i) => {
      const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
      if (d < best) { best = d; idx = i; }
    });
    return idx;
  }

  removeBodyAt(wx, wy) {
    const idx = this.placedAt(wx, wy);
    if (idx >= 0) {
      this.placed.splice(idx, 1);
      this._build();  // Rebuild to remove the part
      return true;
    }
    return false;
  }

  run() {
    const m = M();

    // Clean rebuild from level + placed snapshot
    this._build();

    // Unfreeze movable player parts: check placed flag & fixedByDefault
    for (const b of this.bodies) {
      if (b.plugin && b.plugin.placed) {
        const pt = b.plugin.partType;
        const def = PARTS[pt];
        if (def && !def.fixedByDefault) {
          m.Body.setStatic(b, false);
        }
      }
    }

    this.state = "running";
    this.elapsed = 0;
    this.dwell = 0;
  }

  step(dtMs) {
    if (this.state !== "running") return this.state;

    const m = M();

    this._applyForces();
    this._tickTNT(dtMs);
    m.Engine.update(this.engine, Math.min(dtMs, 1000 / 30));
    this.elapsed += dtMs;

    // Dwell win check
    const obj = this.bodies.find(b => b.plugin && b.plugin.tag === this.level.goal.object);
    if (obj) {
      const r = {
        x: obj.bounds.min.x,
        y: obj.bounds.min.y,
        w: obj.bounds.max.x - obj.bounds.min.x,
        h: obj.bounds.max.y - obj.bounds.min.y,
      };

      if (aabbOverlap(r, this.goalZone)) {
        this.dwell += dtMs;
      } else {
        this.dwell = 0;
      }

      if (this.dwell >= (this.level.goal.ms || 500)) {
        this.state = "won";
      }
    }

    // 30s max-run timeout
    if (this.elapsed > MAX_RUN_MS) {
      this.state = "lost";
    }

    return this.state;
  }

  _applyForces() {
    const m = M();

    for (const f of this.bodies) {
      const pl = f.plugin || {};
      // Track-C per-tick effects must NEVER throw inside the rAF loop.
      try {

      if (pl.partType === "gears") {
        // Re-assert the driver/follower spin each tick (a pivot constraint holds the
        // center; this keeps it turning), then drag contacting dynamic bodies along
        // the disc's tangential surface direction — same idea as the conveyor.
        if (typeof pl.driven === "number") m.Body.setAngularVelocity(f, pl.driven);
        const r = pl.radius || 34;
        const surf = pl.surface || 0;            // tangential speed at the rim
        const w = pl.driven >= 0 ? 1 : -1;        // rotation sense
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x;
          const dy = b.position.y - f.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < r + 26 && dist > 1) {
            // tangent = perpendicular to the radius, scaled by sense of rotation
            const tx = (-dy / dist) * w, ty = (dx / dist) * w;
            const cap = 8;                          // bound the imparted speed
            const sp = Math.min(surf, cap);
            m.Body.setVelocity(b, {
              x: tx * sp,
              y: b.velocity.y + ty * sp * 0.5,      // gentler vertical kick
            });
          }
        }
      } else if (pl.partType === "fan") {
        // Push bodies in fan's facing direction
        const dir = {
          x: Math.cos(f.angle - Math.PI / 2),
          y: Math.sin(f.angle - Math.PI / 2),
        };

        for (const b of this.bodies) {
          if (b.isStatic) continue;
          const dx = b.position.x - f.position.x;
          const dy = b.position.y - f.position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < (pl.range || 220) ** 2) {
            m.Body.applyForce(b, b.position, {
              x: dir.x * pl.force,
              y: dir.y * pl.force,
            });
          }
        }
      } else if (pl.partType === "balloon" && !f.isStatic) {
        // Apply upward lift
        m.Body.applyForce(f, f.position, {
          x: 0,
          y: -(pl.lift || 0.0009),
        });
      } else if (pl.partType === "conveyor") {
        // Set surface velocity for bodies near the conveyor
        for (const b of this.bodies) {
          if (b.isStatic) continue;

          const nearY = Math.abs(b.position.y - f.position.y) < 40;
          const nearX = Math.abs(b.position.x - f.position.x) <
            (f.bounds.max.x - f.bounds.min.x) / 2 + 20;
          const above = b.position.y < f.position.y;

          if (nearY && nearX && above) {
            m.Body.setVelocity(b, {
              x: pl.surfaceSpeed || 3,
              y: b.velocity.y,
            });
          }
        }
      }

      } catch (_e) { /* a misfiring per-tick effect must not break the sim */ }
    }
  }

  // One-shot TNT: decrement fuses, detonate at <=0 with a bounded radial impulse,
  // then remove the spent charge from the world. Fully wrapped so a misfire can
  // never throw inside step()/the rAF loop.
  _tickTNT(dtMs) {
    const m = M();
    try {
      const armed = this.bodies.filter(b => b.plugin && b.plugin.partType === "tnt" && b.plugin.armed);
      for (const t of armed) {
        try {
          t.plugin.fuseMs -= dtMs;
          if (t.plugin.fuseMs > 0) continue;
          const radius = t.plugin.radius || 160;
          const blast = t.plugin.blast || 0.12;
          for (const b of this.bodies) {
            if (b.isStatic || b === t) continue;
            const dx = b.position.x - t.position.x;
            const dy = b.position.y - t.position.y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius && dist > 0.001) {
              const falloff = 1 - dist / radius;       // strongest at the core
              const mag = blast * falloff;
              m.Body.applyForce(b, b.position, { x: (dx / dist) * mag, y: (dy / dist) * mag });
            }
          }
          t.plugin.armed = false;
          t.plugin._spent = true;
          m.Composite.remove(this.world, t);
          // also drop it from the render/sim body list so the spent charge doesn't linger on screen
          const bi = this.bodies.indexOf(t);
          if (bi >= 0) this.bodies.splice(bi, 1);
        } catch (_inner) { /* one bad charge must not stop the others */ }
      }
    } catch (_e) { /* never throw into the loop */ }
  }

  reset() {
    this._build();
  }

  partsUsed() {
    return this.placed.length;
  }
}
