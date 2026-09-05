// Documented winning placements per level id (used by solve-verify.mjs).
// Kept in sync as levels are added/redesigned.
//
// CONTRACT: each entry is exactly what a player can do in the UI — {type,x,y,angle}
// only. No per-part physics params (w/boost/strength/…): every part uses its parts.js
// defaults, and the verifier places each one through Sim.addPlayerPart just like
// input.js does. x/y sit on the 20px placement grid (geom.js PLACE_GRID) and every
// angle is a multiple of 15° (geom.js ROTATE_STEP) — the only positions/angles the
// tap-to-place + ⟲/⟳/R/twist controls can produce. Positions were chosen from grid
// sweeps that also win when nudged ±2px, so they're robust, not knife-edge.
const D = Math.PI / 12; // one rotate-step (15°)

export const SOLUTIONS = {
  "official-01":[{type:"ramp",x:520,y:400,angle:D}],  // bridges the gap between the two slopes
  "official-02":[{type:"bumper",x:480,y:520}],  // deflects the fall right onto the goal slope
  "official-03":[{type:"ramp",x:640,y:380,angle:D}],  // bridges the gap between the two ice slopes
  "official-04":[{type:"balloon",x:240,y:500,angle:0},{type:"fan",x:240,y:600,angle:D}],
  "official-05":[{type:"magnet",x:440,y:200}],
  "official-06":[{type:"conveyor",x:480,y:560,angle:0}],  // pipe chute (fixed), conveyor bridges the pit
  "official-07":[{type:"weight",x:440,y:80}],
  "official-08":[{type:"accelerator",x:40,y:600,angle:-2*D}],  // wedge (fixed) redirects to the corner; -30° pad launches onto the ledge
  "official-09":[{type:"portal",x:280,y:520,angle:0},{type:"portal",x:1000,y:340,angle:0}],
  "official-10":[{type:"ramp",x:200,y:300,angle:D}],  // feeds ice slope; spring+sticky are fixed
  // 11 rolls to the goal on its own; the dominoes topple onto the slope behind the ball (style inventory).
  "official-11":[{type:"domino",x:700,y:300},{type:"domino",x:740,y:300},{type:"domino",x:780,y:300},{type:"domino",x:820,y:300}],
  "official-12":[{type:"vortex",x:540,y:320}],  // beside the shaft: bends the fall into the alcove
  // Band C: Multi-step chains
  "official-13":[{type:"crate",x:200,y:300}],  // lands on the button ledge, opens the gate
  "official-14":[{type:"platform",x:820,y:500,angle:D}],  // tilted bridge from ramp end to the lower ledge
  "official-15":[{type:"trampoline",x:520,y:680,angle:0}],
  "official-16":[{type:"weight",x:440,y:80}],  // weight tips the seesaw; gears are optional style inventory
  "official-17":[{type:"conveyor",x:160,y:580,angle:0},{type:"portal",x:260,y:560,angle:0},{type:"portal",x:1000,y:480,angle:0}],
  "official-18":[{type:"magnet",x:440,y:240},{type:"accelerator",x:560,y:360,angle:0}],
  // Band D: Fiendish finale
  "official-19":[{type:"portal",x:240,y:480,angle:0},{type:"portal",x:680,y:200,angle:0},{type:"tnt",x:700,y:260},{type:"accelerator",x:1020,y:280,angle:0}],  // TNT lands LEFT of the ball so the blast shoves it toward the pad
  "official-20":[{type:"magnet",x:300,y:360},{type:"portal",x:240,y:480,angle:0},{type:"portal",x:820,y:260,angle:0},{type:"vortex",x:920,y:280},{type:"accelerator",x:1060,y:280,angle:0}],
};

// Track D demo levels — one solution per new mechanic (js/levels/demo-track-d.js).
export const DEMO_SOLUTIONS = {
  "demo-saw-01":[{type:"saw",x:700,y:100}],  // reaches the pedestal crate without touching the roll line
  "demo-oneway-01":[],  // ball simply falls through the gate; no part needed
  "demo-zipline-01":[],  // ball rides the basket the whole way; no part needed
  "demo-laser-01":[{type:"mirror",x:400,y:140,angle:3*D}],  // 45° (mirror's default) redirects the downward beam into the pedestal crate
};

// Track E demo levels — one solution per new mechanic (js/levels/demo-track-e.js).
export const DEMO_SOLUTIONS_E = {
  "demo-mouse-01":[{type:"cheese",x:400,y:280}],  // lures the pacing mouse onto the button
  "demo-circuit-01":[{type:"outlet",x:260,y:160}],  // powers the motor, dragging the crate onto the button
  "demo-cannon-01":[],  // ball rests in the barrel; fuse fires on its own, no part needed
  "demo-vacuum-01":[{type:"vacuum",x:340,y:220,angle:-6*D}],  // -90° (faces left): pulls the crate onto the button, ball stays out of the cone
  "demo-scissors-01":[{type:"scissors",x:300,y:120,angle:0}],  // snips the rope, dropping segments onto the button
};
