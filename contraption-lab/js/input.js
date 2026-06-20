import { screenToWorld, snap } from "./geom.js";

// Touch/pointer placement, only active in the "build" state.
// Tap model (no fragile double-tap timing):
//   • tap ON a placed part  → delete it (refunds inventory)
//   • tap on empty space with a selected part type and remaining > 0 → place it
// A tap that moved more than DRAG_SLOP between down and up is treated as a drag
// (ignored for now — kept simple), so a stray finger-slide never mis-places.
const DRAG_SLOP = 18; // world units

export class PlacementController {
  constructor(canvas, sim, opts) {
    this.canvas = canvas; this.sim = sim; this.opts = opts; this.ghost = null;
    this._down = this._down.bind(this); this._move = this._move.bind(this); this._up = this._up.bind(this);
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    this.start = null;
  }
  setSim(sim) { this.sim = sim; this.ghost = null; this.start = null; }
  _w(e) {
    const r = this.canvas.getBoundingClientRect(); const t = this.opts.getTransform();
    return screenToWorld((e.clientX - r.left) * this.canvas.width / r.width,
                         (e.clientY - r.top) * this.canvas.height / r.height, t);
  }
  _down(e) {
    if (this.sim.state !== "build") return;
    this.canvas.setPointerCapture(e.pointerId);
    this.start = this._w(e);
  }
  _move(e) {
    if (this.sim.state !== "build") return;
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
    if (this.sim.state !== "build") return;
    const w = this._w(e);
    const moved = this.start && (Math.abs(w.x - this.start.x) > DRAG_SLOP || Math.abs(w.y - this.start.y) > DRAG_SLOP);
    this.start = null; this.ghost = null;
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
      this.sim.addPlayerPart(type, snap(w.x, 20), snap(w.y, 20), 0);
      this.opts.onPlaced(type);
    }
    this.opts.onChange();
  }
  destroy() {
    this.canvas.removeEventListener("pointerdown", this._down);
    this.canvas.removeEventListener("pointermove", this._move);
    this.canvas.removeEventListener("pointerup", this._up);
  }
}
