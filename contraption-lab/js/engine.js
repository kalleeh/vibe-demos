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

  removeBodyAt(wx, wy) {
    // Find the closest placed part by proximity to the click point
    let idx = -1;
    let best = 1e9;

    this.placed.forEach((s, i) => {
      const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
      if (d < best) {
        best = d;
        idx = i;
      }
    });

    // 80px threshold (comfortable tap target)
    if (idx >= 0 && best < 80 * 80) {
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

      if (pl.partType === "fan") {
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
    }
  }

  reset() {
    this._build();
  }

  partsUsed() {
    return this.placed.length;
  }
}
