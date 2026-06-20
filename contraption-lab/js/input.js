import { screenToWorld, snap } from "./geom.js";

export class PlacementController {
  constructor(canvas, sim, opts) {
    this.canvas = canvas; this.sim = sim; this.opts = opts; this.ghost = null;
    this._down = this._down.bind(this); this._move=this._move.bind(this); this._up=this._up.bind(this);
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    this.dragIdx = -1; this.downAt = 0; this.lastTap = 0;
  }
  setSim(sim){ this.sim = sim; this.ghost=null; }
  _w(e){ const r=this.canvas.getBoundingClientRect(); const t=this.opts.getTransform();
    return screenToWorld((e.clientX-r.left)*this.canvas.width/r.width,(e.clientY-r.top)*this.canvas.height/r.height,t); }
  _down(e){ if(this.sim.state!=="build")return; this.canvas.setPointerCapture(e.pointerId);
    const w=this._w(e); this.downAt=performance.now();
    // double-tap delete
    if(performance.now()-this.lastTap<300){ if(this.sim.removeBodyAt(w.x,w.y)){this.opts.onChange();this.lastTap=0;return;} }
    this.lastTap=performance.now();
    this.start=w; }
  _move(e){ if(this.sim.state!=="build")return; const w=this._w(e); const type=this.opts.getSelectedType();
    if(type){ this.ghost={ x:snap(w.x,20), y:snap(w.y,20), type, valid:true }; this.opts.onChange(); } }
  _up(e){ if(this.sim.state!=="build")return; const w=this._w(e); const type=this.opts.getSelectedType();
    const held=performance.now()-this.downAt;
    if(type && this.opts.remaining(type)>0){ this.sim.addPlayerPart(type, snap(w.x,20), snap(w.y,20), 0); this.opts.onPlaced(type); }
    this.ghost=null; this.opts.onChange(); }
  destroy(){ this.canvas.removeEventListener("pointerdown",this._down); this.canvas.removeEventListener("pointermove",this._move); this.canvas.removeEventListener("pointerup",this._up); }
}
