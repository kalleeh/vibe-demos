import { screenToWorld, snap } from "./geom.js";
import { makePart } from "./parts.js";
import { isRotatable } from "./engine.js";

// Touch/pointer placement, only active in the "build" state.
// Tap model (no fragile double-tap timing):
//   • tap ON a placed part  → delete it (refunds inventory)
//   • tap on empty space with a selected part type and remaining > 0 → place it
//   • two fingers down near a placed (single-body) part → twist to rotate it
// A tap that moved more than DRAG_SLOP between down and up is treated as a drag
// (ignored for now — kept simple), so a stray finger-slide never mis-places.
const DRAG_SLOP = 18; // world units

// Each part's own default angle (ramp tilts, mirror's 45°, etc. — see parts.js
// build() defaults) so a tray-placed part lands at the same tilt the ghost
// preview already shows while hovering, instead of always snapping flat.
function defaultAngleFor(type) {
  try { return makePart(type, { x: 0, y: 0 }).bodies[0].angle || 0; }
  catch { return 0; }
}

export class PlacementController {
  constructor(canvas, sim, opts) {
    this.canvas = canvas; this.sim = sim; this.opts = opts; this.ghost = null;
    this._down = this._down.bind(this); this._move = this._move.bind(this); this._up = this._up.bind(this);
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    canvas.addEventListener("pointercancel", this._up);
    this.pointers = new Map();  // pointerId -> world {x,y}, tracks concurrent touches
    this.rotating = null;       // {idx, pointerIds:[a,b], startAngle, startFingerAngle} while twisting
    this.rotatedIds = null;     // pointerIds from a just-ended twist still awaiting their own pointerup
  }
  setSim(sim) { this.sim = sim; this.ghost = null; this.pointers.clear(); this.rotating = null; this.rotatedIds = null; }
  _w(e) {
    const r = this.canvas.getBoundingClientRect(); const t = this.opts.getTransform();
    return screenToWorld((e.clientX - r.left) * this.canvas.width / r.width,
                         (e.clientY - r.top) * this.canvas.height / r.height, t);
  }
  _fingerAngle() {
    const pts = [...this.pointers.values()];
    return Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  }
  _down(e) {
    if (this.sim.state !== "build") return;
    // Guard: a pointer that's already been released by the time this fires
    // (rare event-ordering edge case, e.g. a very fast tap) throws here rather
    // than silently no-op-ing — a stray gesture must never break placement.
    try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    this.pointers.set(e.pointerId, this._w(e));
    // Second concurrent finger landing near a rotatable placed part starts a twist.
    if (this.pointers.size === 2 && !this.rotating) {
      const [a, b] = [...this.pointers.keys()];
      const [pa, pb] = [...this.pointers.values()];
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      const idx = this.sim.placedAt(mid.x, mid.y);
      const spec = idx >= 0 ? this.sim.placed[idx] : null;
      if (spec && isRotatable(spec.type)) {
        this.ghost = null;
        this.rotating = { idx, pointerIds: [a, b], startAngle: spec.angle || 0, startFingerAngle: this._fingerAngle() };
      }
    }
  }
  _move(e) {
    if (this.sim.state !== "build") return;
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, this._w(e));
    if (this.rotating && this.rotating.pointerIds.includes(e.pointerId)) {
      const delta = this._fingerAngle() - this.rotating.startFingerAngle;
      this.sim.rotatePlacedAt(this.rotating.idx, this.rotating.startAngle + delta);
      this.opts.onChange();
      return;
    }
    // Single-finger ghost preview only (never while a twist is in progress).
    if (this.pointers.size !== 1 || this.rotating) return;
    const w = this._w(e); const type = this.opts.getSelectedType();
    // ghost preview only when a type is selected and we're not hovering a deletable part
    if (type && this.sim.placedAt(w.x, w.y) < 0) {
      this.ghost = { x: snap(w.x, 20), y: snap(w.y, 20), type, valid: this.opts.remaining(type) > 0 };
    } else {
      this.ghost = null;
    }
    this.opts.onChange();
  }
  _up(e) {
    if (this.sim.state !== "build") { this.pointers.delete(e.pointerId); return; }
    const start = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    // Releasing either finger of an active twist ends the rotation — the angle
    // was already committed live, so both pointerIds are consumed with no
    // further tap-to-place/tap-to-delete action. The two fingers of a twist
    // virtually never lift in the exact same event; track BOTH pointerIds in
    // `this.rotatedIds` (not just clearing `this.rotating` on the first lift)
    // so the second finger's own pointerup — arriving after `rotating` is
    // already null — doesn't fall through and delete the part it just rotated.
    if (this.rotating && this.rotating.pointerIds.includes(e.pointerId)) {
      this.rotatedIds = new Set(this.rotating.pointerIds);
      this.rotating = null;
      this.opts.onChange();
      return;
    }
    if (this.rotatedIds && this.rotatedIds.has(e.pointerId)) {
      this.rotatedIds.delete(e.pointerId);
      return;
    }
    if (!start) return;
    const w = this._w(e);
    const moved = Math.abs(w.x - start.x) > DRAG_SLOP || Math.abs(w.y - start.y) > DRAG_SLOP;
    this.ghost = null;
    if (moved) { this.opts.onChange(); return; }
    // tap on an existing placed part → delete it
    if (this.sim.placedAt(w.x, w.y) >= 0) {
      if (this.sim.removeBodyAt(w.x, w.y) && this.opts.onCountsChanged) this.opts.onCountsChanged();
      this.opts.onChange();
      return;
    }
    // tap on empty space → place the selected part if any remain
    const type = this.opts.getSelectedType();
    if (type && this.opts.remaining(type) > 0) {
      this.sim.addPlayerPart(type, snap(w.x, 20), snap(w.y, 20), defaultAngleFor(type));
      this.opts.onPlaced(type);
    }
    this.opts.onChange();
  }
  destroy() {
    this.canvas.removeEventListener("pointerdown", this._down);
    this.canvas.removeEventListener("pointermove", this._move);
    this.canvas.removeEventListener("pointerup", this._up);
    this.canvas.removeEventListener("pointercancel", this._up);
  }
}
