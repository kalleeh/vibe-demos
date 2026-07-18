// Core simulation: build/run/reset state machine, player part placement, dwell win.

import { buildWorld } from "./level.js";
import { makePart, PARTS } from "./parts.js";
import { aabbOverlap, reflect, raySegmentIntersect, rayCircleIntersect, pointInCone } from "./geom.js";

// Types the saw is allowed to destroy — an explicit allow-list, never the ball
// (or weight/gear/pinwheel/etc.), so it's a puzzle tool, not a hazard.
const SAW_CUTTABLE = new Set(["rope", "domino", "crate", "bowlingpin", "tnt"]);

// AABB (top-left form) of a body's current bounds — used by the mouse's manual
// ground/blocked-ahead probes, which need plain rect overlap checks rather than
// real collision response (a walker's turn-around must anticipate contact, not
// react to it after the fact).
const rectOf = (b) => ({ x: b.bounds.min.x, y: b.bounds.min.y, w: b.bounds.max.x - b.bounds.min.x, h: b.bounds.max.y - b.bounds.min.y });

// The only two part types whose build() returns more than one body (rope's
// segment chain, gears' driver+follower pair) — everything else is exactly
// one body, so a single Body.setAngle unambiguously rotates "the part". The
// two-finger rotate gesture is scoped to single-body parts only: rotating a
// multi-body part risks misaligning geometry computed for a fixed relative
// offset (e.g. gears' driver/follower gap), and neither is tray-placeable in
// a way where rotation is meaningful (rope is a fixed-only fixture; gears'
// two discs already auto-spin, angle doesn't change the mechanic).
const MULTI_BODY_TYPES = new Set(["rope", "gears"]);
export function isRotatable(type) { return !MULTI_BODY_TYPES.has(type); }

export function portalExit(toPortal) {
  // exit just outside the destination portal along its exit angle
  const r = (toPortal.plugin.r || 28) + 24;
  return { x: toPortal.position.x + Math.cos(toPortal.plugin.angle) * r, y: toPortal.position.y + Math.sin(toPortal.plugin.angle) * r };
}

export function gateOpen(buttonBody, bodies) {
  const z = { x: buttonBody.position.x - 45, y: buttonBody.position.y - 20, w: 90, h: 40 };
  for (const b of bodies) {
    if (b.isStatic || b.plugin?.partType === "button" || b.plugin?.partType === "gate") continue;
    if (b.position.x > z.x && b.position.x < z.x + z.w && b.position.y > z.y && b.position.y < z.y + z.h) return true;
  }
  return false;
}

const MAX_RUN_MS = 30000;
const M = () => Matter;

export class Sim {
  constructor(level) {
    this.level = level;
    this.placed = [];  // player-added specs {type,x,y,angle}
    this._specBodies = new Map();  // spec -> spawned bodies, kept in sync by _spawn/_build (rotate gesture support)
    this.onEvent = null;  // optional callback for sound/render events
    this._collisionHandler = null;  // stable listener ref (installed/removed across rebuilds)
    this._build();
  }

  _build() {
    const m = M();
    // Detach the collision listener from the engine we're about to replace, so old
    // engines (and their listener) don't accumulate across reset()/rebuild calls.
    if (this.engine && this._collisionHandler && m.Events) {
      try { m.Events.off(this.engine, "collisionStart", this._collisionHandler); } catch {}
    }
    const w = buildWorld(this.level, m);
    this.engine = w.engine;
    this.world = w.world;
    this.bodies = w.bodies;
    this.goalZone = w.goalZone;

    // Re-add any placed parts (static during build phase). Old bodies are gone
    // with the previous world, so the spec->bodies map is rebuilt from scratch.
    this._specBodies.clear();
    for (const spec of this.placed) {
      this._spawn(spec, true);
    }

    // Install collision listener for bounce events
    this._installCollisionListener(m);

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
    this._specBodies.set(spec, bodies);  // rotate gesture needs to find these later

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

  // Live-rotates the placed part at `idx` to `angle` (radians). Mutates the
  // stored spec directly so the new angle survives _build()/reset() (both
  // already read spec.angle fresh), and sets the angle on its already-spawned
  // bodies for immediate visual feedback without a full world rebuild (which
  // would be wasteful mid-gesture, called every pointermove frame).
  rotatePlacedAt(idx, angle) {
    const spec = this.placed[idx];
    if (!spec) return false;
    spec.angle = angle;
    const bodies = this._specBodies.get(spec);
    if (bodies) { const m = M(); for (const b of bodies) m.Body.setAngle(b, angle); }
    return true;
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

    this._applyForces(dtMs);
    this._tickTNT(dtMs);
    this._tickSaw();
    this._tickCannon(dtMs);
    this._tickScissors();
    m.Engine.update(this.engine, Math.min(dtMs, 1000 / 30));
    this.elapsed += dtMs;

    // Out-of-bounds: the world has no floor (a missed shot falls out and the level
    // is lost — matches the original design, not a safety net that catches every
    // miss). The tagged goal object falling past the bottom ends the run immediately;
    // any other dynamic body that wanders out is just culled (removed) so it can't
    // linger below the world and confuse later checks.
    const OOB_MARGIN = 200;
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.isStatic || (b.plugin && b.plugin.partType === "boundary")) continue;
      const p = b.position;
      const out = p.y > this.level.world.h + OOB_MARGIN || p.x < -OOB_MARGIN || p.x > this.level.world.w + OOB_MARGIN;
      if (!out) continue;
      if (b.plugin && b.plugin.tag === this.level.goal.object) { this.state = "lost"; break; }
      try { m.Composite.remove(this.world, b); } catch {}
      this.bodies.splice(i, 1);
    }
    if (this.state !== "running") return this.state;

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

  _applyForces(dtMs) {
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
      }
      else if (pl.partType === "zipline") {
        // No slider constraint exists in this Matter.js build, so the basket's
        // position is set directly each tick from a stored 0..1 progress value —
        // the same "engine sets position" trick portal teleport already uses.
        // Progress advances faster on a steeper line (gravity's component along
        // the line's own slope), so a flatter zipline crawls and a steep one runs,
        // matching the "steepness should matter" fix applied to plain rolling.
        const x1 = pl.x1, y1 = pl.y1, x2 = pl.x2, y2 = pl.y2;
        const lineAngle = Math.atan2(y2 - y1, x2 - x1);
        const prevT = pl.t || 0;
        const advance = (dtMs / 1000) * (pl.speed || 0.15) * (0.3 + Math.abs(Math.sin(lineAngle)));
        pl.t = Math.min(1, prevT + advance);
        const prevPos = { x: x1 + (x2 - x1) * prevT, y: y1 + (y2 - y1) * prevT };
        const newPos = { x: x1 + (x2 - x1) * pl.t, y: y1 + (y2 - y1) * pl.t };
        const dx = newPos.x - prevPos.x, dy = newPos.y - prevPos.y;
        m.Body.setPosition(f, newPos);
        if (dx || dy) {
          const halfW = 35, halfH = 17; // half-extents of the basket footprint (parts.js zipline w/h)
          for (const b of this.bodies) {
            if (b.isStatic || b === f) continue;
            if (Math.abs(b.position.x - prevPos.x) < halfW && Math.abs(b.position.y - prevPos.y) < halfH) {
              m.Body.translate(b, { x: dx, y: dy });
            }
          }
        }
      }
      else if (pl.partType === "magnet" || pl.partType === "vortex") {
        const range = pl.range || 200, strength = pl.strength || 0.02, pol = pl.polarity || 1;
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = f.position.x - b.position.x, dy = f.position.y - b.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < range && dist > 1) {
            const falloff = 1 - dist / range;
            const mag = strength * falloff * pol;
            let fx = (dx / dist) * mag, fy = (dy / dist) * mag;
            if (pl.partType === "vortex") { fx += (-dy / dist) * mag * 0.4; fy += (dx / dist) * mag * 0.4; } // swirl
            m.Body.applyForce(b, b.position, { x: fx, y: fy });
          }
        }
      }
      else if (pl.partType === "accelerator") {
        // Capture any dynamic body near the pad (project into pad-local coords so it works
        // at an angle), then kick it along the pad's facing direction. Generous capture band
        // so a slow/resting ball still fires reliably.
        const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
        const halfLen = (pl.w || 90) / 2 + 22;
        const dir = { x: ca, y: sa };
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          const along = dx * ca + dy * sa;        // distance along the pad
          const perp = -dx * sa + dy * ca;         // distance off the pad surface
          if (Math.abs(along) < halfLen && perp > -40 && perp < 16) {
            const boost = pl.boost || 9;
            // kick along the pad facing + a small lift, replacing current velocity
            m.Body.setVelocity(b, { x: dir.x * boost, y: dir.y * boost - 2 });
          }
        }
      }
      else if (pl.partType === "portal") {
        pl._cool = Math.max(0, (pl._cool || 0) - 1);
        if (pl._cool > 0) continue;
        const partner = this.bodies.find(o => o !== f && o.plugin && o.plugin.partType === "portal" && o.plugin.link === pl.link);
        if (!partner) continue;
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          if (Math.hypot(dx, dy) < (pl.r || 28)) {
            const exit = portalExit(partner);
            m.Body.setPosition(b, exit);
            partner.plugin._cool = 30;  // ~0.5s at 60fps: stop immediate re-entry on the other side
            pl._cool = 30;
            break;
          }
        }
      }
      else if (pl.partType === "button") {
        const open = gateOpen(f, this.bodies);
        const gate = this.bodies.find(o => o.plugin && o.plugin.partType === "gate" && o.plugin.id === pl.gate);
        if (gate) {
          const gp = gate.plugin;
          // Toggle on an explicit flag (not on position thresholds) so a body nudging
          // the retracted gate near the threshold can't cause repeated setPosition/drift.
          if (open && !gp._retracted) { m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY - 10000 }); gp._retracted = true; }
          else if (!open && gp._retracted) { m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY }); gp._retracted = false; }
        }
      }
      else if (pl.partType === "fan") {
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
      else if (pl.partType === "oneway") {
        // Pad-local frame (same trick as accelerator): `along` is the plate's own
        // length axis, `normal` is perpendicular — the axis bodies pass THROUGH.
        // Moving with +normal is the allowed direction (free pass, sensor never
        // blocks); moving with -normal gets that velocity component zeroed each
        // tick it's inside the band, a soft stop rather than a teleport-back.
        const angle = pl.angle || 0;
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const halfLen = (pl.w || 110) / 2;
        const band = 28; // generous enough to catch a rolling ball's radius
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          const along = dx * ca + dy * sa;
          const perp = dx * -sa + dy * ca;
          if (Math.abs(along) > halfLen || Math.abs(perp) > band) continue;
          const velNormal = b.velocity.x * -sa + b.velocity.y * ca;
          if (velNormal < 0) {
            m.Body.setVelocity(b, {
              x: b.velocity.x - velNormal * -sa,
              y: b.velocity.y - velNormal * ca,
            });
          }
        }
      }
      else if (pl.partType === "laser") {
        // Cast a beam from the emitter, reflecting off mirror-part edges, until it
        // either hits a non-mirror DYNAMIC body (a trip — the beam is "blocked" and
        // the linked gate opens) or exits the level bounds untouched. Static level
        // geometry (walls, ramps, platforms) is intentionally transparent to the
        // beam — only things the player can place/move can trip it.
        const angle = f.angle || pl.angle || 0;
        let origin = { x: f.position.x, y: f.position.y };
        let dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const points = [origin];
        let blocked = false;
        const maxBounces = pl.maxBounces || 6;
        const W = this.level.world.w, H = this.level.world.h;
        const boundsEdges = [
          [{ x: 0, y: 0 }, { x: W, y: 0 }], [{ x: W, y: 0 }, { x: W, y: H }],
          [{ x: W, y: H }, { x: 0, y: H }], [{ x: 0, y: H }, { x: 0, y: 0 }],
        ];
        for (let bounce = 0; bounce < maxBounces; bounce++) {
          let best = null, bestKind = null;
          for (const b of this.bodies) {
            if (b === f) continue;
            const isMirror = b.plugin && b.plugin.partType === "mirror";
            if (!isMirror && b.isStatic) continue; // only mirrors + dynamic bodies interact with the beam
            if (b.circleRadius) {
              const hit = rayCircleIntersect(origin, dir, b.position, b.circleRadius);
              if (hit && (!best || hit.t < best.t)) { best = hit; bestKind = isMirror ? "mirror" : "body"; }
            } else if (b.vertices) {
              const vs = b.vertices;
              for (let i = 0; i < vs.length; i++) {
                const hit = raySegmentIntersect(origin, dir, vs[i], vs[(i + 1) % vs.length]);
                if (hit && (!best || hit.t < best.t)) { best = hit; bestKind = isMirror ? "mirror" : "body"; }
              }
            }
          }
          for (const [a, c] of boundsEdges) {
            const hit = raySegmentIntersect(origin, dir, a, c);
            if (hit && (!best || hit.t < best.t)) { best = hit; bestKind = "bounds"; }
          }
          if (!best) break; // shouldn't happen (bounds always eventually hit), but never hang
          points.push(best.point);
          if (bestKind === "mirror") { origin = best.point; dir = reflect(dir, best.normal); continue; }
          if (bestKind === "body") blocked = true;
          break; // body hit or bounds hit both terminate the beam
        }
        pl._blocked = blocked;
        pl._beamPoints = points;
        const gate = this.bodies.find(o => o.plugin && o.plugin.partType === "gate" && o.plugin.id === pl.gate);
        if (gate) {
          const gp = gate.plugin;
          if (blocked && !gp._retracted) { m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY - 10000 }); gp._retracted = true; }
          else if (!blocked && gp._retracted) { m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY }); gp._retracted = false; }
        }
      }
      else if (pl.partType === "mouse") {
        // Kinematic-feeling walker: grounded check via a probe rect just below its
        // feet (against STATIC bodies only — resting on a dynamic crate isn't
        // "ground" for pacing purposes), then either homes toward the nearest
        // cheese in range or paces, reversing off a probe box one step ahead.
        // Velocity (not position) is set each tick so Matter's own collision still
        // stops it at a wall — no tunneling risk from a teleport-style position set.
        const w = pl.w || 34, h = pl.h || 20;
        const groundProbe = { x: f.position.x - w / 2, y: f.bounds.max.y - 1, w, h: 6 };
        let grounded = false;
        for (const b of this.bodies) {
          if (b === f || !b.isStatic) continue;
          if (aabbOverlap(groundProbe, rectOf(b))) { grounded = true; break; }
        }
        if (grounded) {
          let dir = pl.dir || 1;
          let cheese = null, bestD = pl.attractRange || 260;
          for (const b of this.bodies) {
            if (!b.plugin || b.plugin.partType !== "cheese") continue;
            const d = Math.abs(b.position.x - f.position.x);
            if (d < bestD) { bestD = d; cheese = b; }
          }
          if (cheese) {
            dir = cheese.position.x >= f.position.x ? 1 : -1;
          } else {
            const probeDist = w / 2 + 8;
            const ahead = { x: f.position.x + dir * probeDist - w / 2, y: f.position.y - h / 2, w, h };
            for (const b of this.bodies) {
              if (b === f) continue;
              if (b.plugin && (b.plugin.partType === "cheese" || b.plugin.partType === "mouse")) continue;
              if (aabbOverlap(ahead, rectOf(b))) { dir = -dir; break; }
            }
          }
          pl.dir = dir;
          m.Body.setVelocity(f, { x: dir * (pl.speed || 2), y: f.velocity.y });
        }
      }
      else if (pl.partType === "motor") {
        // Dead until an outlet is in range; once powered, reuses gears' exact
        // tangential-drag-on-contact math (engine.js lines ~226-250), just gated.
        const outletInRange = this.bodies.some(o => o.plugin && o.plugin.partType === "outlet" &&
          Math.hypot(o.position.x - f.position.x, o.position.y - f.position.y) < (o.plugin.range || 220));
        pl._powered = outletInRange;
        if (outletInRange) {
          if (typeof pl.spin === "number") m.Body.setAngularVelocity(f, pl.spin);
          const r = pl.radius || 30;
          const surf = pl.surface || 0;
          const w = pl.spin >= 0 ? 1 : -1;
          for (const b of this.bodies) {
            if (b.isStatic || b === f) continue;
            const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
            const dist = Math.hypot(dx, dy);
            if (dist < r + 26 && dist > 1) {
              const tx = (-dy / dist) * w, ty = (dx / dist) * w;
              const cap = 8;
              const sp = Math.min(surf, cap);
              m.Body.setVelocity(b, { x: tx * sp, y: b.velocity.y + ty * sp * 0.5 });
            }
          }
        }
      }
      else if (pl.partType === "vacuum") {
        // Fan's inverse: same facing-direction convention (f.angle - PI/2) as fan,
        // but pulls bodies within a directional cone toward it instead of a plain
        // omnidirectional push-away.
        const faceAngle = f.angle - Math.PI / 2;
        const coneHalf = pl.coneAngle || Math.PI / 3;
        const range = pl.range || 220, mag = pl.force || 0.02;
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < range && dist > 1 && pointInCone(b.position.x, b.position.y, f.position.x, f.position.y, faceAngle, coneHalf)) {
            m.Body.applyForce(b, b.position, { x: -(dx / dist) * mag, y: -(dy / dist) * mag });
          }
        }
      }

      // Clamp any dynamic body to a sane max speed so a misconfigured magnet/vortex/
      // accelerator can't explode/NaN. 25 caught plain gravity roll on ordinary
      // slopes too (freefall alone reaches it in <2s), silently capping the ball
      // to a crawl before steepness could ever matter — 60 clears every real
      // accelerator boost (<=16) and TNT blast with headroom while still catching
      // runaway effects.
      if (!f.isStatic) {
        const sp = Math.hypot(f.velocity.x, f.velocity.y);
        if (sp > 60) m.Body.setVelocity(f, { x: f.velocity.x / sp * 60, y: f.velocity.y / sp * 60 });
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
          // Fire explode event (position+radius are render-only; physics ignores them)
          try { if (this.onEvent) this.onEvent("explode", { x: t.position.x, y: t.position.y, radius }); } catch {}
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

  // Saw blades cut anything on SAW_CUTTABLE's allow-list within range. Removing a
  // body via Composite.remove does NOT auto-clean constraints referencing it (a
  // severed rope's neighboring links would otherwise be pinned to a body that's no
  // longer meaningfully simulated and freeze in place instead of falling) — so any
  // constraint touching the cut body is found and removed first.
  _tickSaw() {
    const m = M();
    try {
      const saws = this.bodies.filter(b => b.plugin && b.plugin.partType === "saw");
      for (const s of saws) {
        try {
          const r = s.plugin.r || 24;
          for (let i = this.bodies.length - 1; i >= 0; i--) {
            const b = this.bodies[i];
            if (b === s || b.isStatic) continue;
            if (!b.plugin || !SAW_CUTTABLE.has(b.plugin.partType)) continue;
            const dx = b.position.x - s.position.x, dy = b.position.y - s.position.y;
            const reach = r + (b.circleRadius || Math.max(b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y) / 2);
            if (Math.hypot(dx, dy) > reach) continue;
            const danglers = m.Composite.allConstraints(this.world).filter(c => c.bodyA === b || c.bodyB === b);
            for (const c of danglers) m.Composite.remove(this.world, c);
            m.Composite.remove(this.world, b);
            this.bodies.splice(i, 1);
            try { if (this.onEvent) this.onEvent("cut", { x: b.position.x, y: b.position.y }); } catch {}
          }
        } catch (_inner) { /* one bad blade must not stop the others */ }
      }
    } catch (_e) { /* never throw into the loop */ }
  }

  // One-shot cannon: decrement fuses, and at <=0 kick the first dynamic body
  // resting in the barrel's capture band (pad-local projection, same ca/sa/
  // along/perp math as accelerator) along the barrel's facing direction, then
  // spend the charge. If nothing sits in the band when the fuse expires, it
  // still spends itself with no shot — matches TNT's "always detonates on
  // schedule" behavior.
  _tickCannon(dtMs) {
    const m = M();
    try {
      const armed = this.bodies.filter(b => b.plugin && b.plugin.partType === "cannon" && b.plugin.armed);
      for (const c of armed) {
        try {
          c.plugin.fuseMs -= dtMs;
          if (c.plugin.fuseMs > 0) continue;
          const angle = c.angle || c.plugin.angle || 0;
          const ca = Math.cos(angle), sa = Math.sin(angle);
          const halfLen = 32 + 22;
          for (const b of this.bodies) {
            if (b.isStatic || b === c) continue;
            const dx = b.position.x - c.position.x, dy = b.position.y - c.position.y;
            const along = dx * ca + dy * sa;
            const perp = -dx * sa + dy * ca;
            if (Math.abs(along) < halfLen && perp > -40 && perp < 16) {
              const boost = c.plugin.boost || 18;
              m.Body.setVelocity(b, { x: ca * boost, y: sa * boost - 2 });
              break; // one shot, one target
            }
          }
          try { if (this.onEvent) this.onEvent("cannon-fire", { x: c.position.x, y: c.position.y, angle }); } catch {}
          c.plugin.armed = false;
          c.plugin._spent = true;
        } catch (_inner) { /* one bad cannon must not stop the others */ }
      }
    } catch (_e) { /* never throw into the loop */ }
  }

  // One-shot scissors: on first tick, look for the nearest `rope` body within
  // range and cut it exactly once (identical constraint-cleanup step to
  // _tickSaw), then spend itself — narrower scope than the saw's full
  // allow-list, matching "snip a rope" rather than "destroy anything".
  _tickScissors() {
    const m = M();
    try {
      const armed = this.bodies.filter(b => b.plugin && b.plugin.partType === "scissors" && b.plugin.armed);
      for (const sc of armed) {
        try {
          const range = sc.plugin.range || 50;
          let target = null, bestD = range;
          for (const b of this.bodies) {
            if (b === sc || b.isStatic || !b.plugin || b.plugin.partType !== "rope") continue;
            const dx = b.position.x - sc.position.x, dy = b.position.y - sc.position.y;
            const d = Math.hypot(dx, dy);
            if (d < bestD) { bestD = d; target = b; }
          }
          if (!target) continue;
          const danglers = m.Composite.allConstraints(this.world).filter(c => c.bodyA === target || c.bodyB === target);
          for (const c of danglers) m.Composite.remove(this.world, c);
          m.Composite.remove(this.world, target);
          const bi = this.bodies.indexOf(target);
          if (bi >= 0) this.bodies.splice(bi, 1);
          try { if (this.onEvent) this.onEvent("cut", { x: target.position.x, y: target.position.y }); } catch {}
          sc.plugin.armed = false;
          sc.plugin._spent = true;
        } catch (_inner) { /* one bad pair of scissors must not stop the others */ }
      }
    } catch (_e) { /* never throw into the loop */ }
  }

  reset() {
    this._build();
  }

  partsUsed() {
    return this.placed.length;
  }

  // Install Matter collision listener for bounce events. Try-wrapped so sound
  // errors never break physics.
  _installCollisionListener(m) {
    try {
      if (!m.Events) return;
      // Build the handler once (stable reference, so it can be Events.off'd on rebuild).
      if (!this._collisionHandler) {
        this._collisionHandler = (event) => {
          try {
            if (!this.onEvent || this.state !== "running") return;
            for (const pair of event.pairs) {
              const { bodyA, bodyB } = pair;
              if (!bodyA || !bodyB) continue;
              const dvx = (bodyA.velocity?.x || 0) - (bodyB.velocity?.x || 0);
              const dvy = (bodyA.velocity?.y || 0) - (bodyB.velocity?.y || 0);
              const speed = Math.sqrt(dvx * dvx + dvy * dvy);
              if (speed > 3.5) {
                // contact point + the body ids are render-only hints for fx (flash/particles).
                const cx = (bodyA.position.x + bodyB.position.x) / 2;
                const cy = (bodyA.position.y + bodyB.position.y) / 2;
                this.onEvent("bounce", { speed, x: cx, y: cy, idA: bodyA.id, idB: bodyB.id });
                break;
              }
            }
          } catch {}
        };
      }
      m.Events.on(this.engine, "collisionStart", this._collisionHandler);
    } catch {}
  }
}
