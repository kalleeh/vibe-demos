// Documented winning placements per official level id (used by solve-verify.mjs).
// Kept in sync as levels are added/redesigned.
export const SOLUTIONS = {
  "official-01":[{type:"ramp",x:530,y:410,angle:0.18}],  // bridges the gap between the two slopes
  "official-02":[{type:"bumper",x:480,y:510}],  // redirects the fall onto the floor feeding the goal
  "official-03":[{type:"ramp",x:650,y:380,angle:0.2}],  // bridges the gap between the two ice slopes
  "official-04":[{type:"balloon",x:250,y:500,angle:0},{type:"fan",x:250,y:590,angle:0.3}],
  "official-05":[{type:"magnet",x:440,y:200,strength:0.015}],
  "official-06":[{type:"conveyor",x:520,y:574,w:760,angle:0,surfaceSpeed:6}],  // pipe chute (fixed) then conveyor
  "official-07":[{type:"weight",x:430,y:80}],
  "official-08":[{type:"accelerator",x:40,y:650,w:100,angle:-0.9,boost:16}],  // wedge (fixed) redirects to corner, then boosts
  "official-09":[{type:"portal",x:280,y:520,link:"p1",angle:0},{type:"portal",x:1000,y:340,link:"p1",angle:0}],
  "official-10":[{type:"ramp",x:200,y:300,angle:0.22}],  // feeds ice slope; spring+sticky are fixed
  "official-11":[{type:"domino",x:200,y:480},{type:"domino",x:250,y:470},{type:"domino",x:300,y:460},{type:"domino",x:350,y:450}],
  "official-12":[{type:"vortex",x:420,y:300,strength:0.05,range:200}],
  // Band C: Multi-step chains
  "official-13":[{type:"crate",x:200,y:300}],  // lands on the button ledge, opens the gate
  "official-14":[{type:"platform",x:810,y:480,w:140,angle:0.1}],  // bridges the ramp-to-ledge gap
  "official-15":[{type:"trampoline",x:550,y:680,angle:0}],
  "official-16":[{type:"weight",x:430,y:80},{type:"gears",x:720,y:500}],
  "official-17":[{type:"conveyor",x:360,y:574,w:640,angle:0,surfaceSpeed:6},{type:"portal",x:280,y:520,link:"p1",angle:0},{type:"portal",x:1000,y:480,link:"p1",angle:0}],
  "official-18":[{type:"magnet",x:440,y:240},{type:"accelerator",x:460,y:400,w:90,angle:-0.2,boost:13}],
  // Band D: Fiendish finale
  "official-19":[{type:"portal",x:240,y:480,link:"p1",angle:0},{type:"portal",x:780,y:260,link:"p1",angle:0},{type:"tnt",x:870,y:268,fuseMs:500,blast:0.2,radius:200},{type:"accelerator",x:1020,y:280,w:100,angle:0,boost:10}],
  "official-20":[{type:"magnet",x:300,y:360,strength:0.02,range:280},{type:"portal",x:240,y:480,link:"p1",angle:0},{type:"portal",x:820,y:260,link:"p1",angle:0},{type:"vortex",x:920,y:280,strength:0.05,range:200},{type:"accelerator",x:1060,y:280,w:100,angle:0,boost:10}],
};

// Track D demo levels — one solution per new mechanic (js/levels/demo-track-d.js).
export const DEMO_SOLUTIONS = {
  "demo-saw-01":[{type:"saw",x:700,y:100,r:80,spin:8}],  // reaches the pedestal crate without touching the roll line
  "demo-oneway-01":[],  // ball simply falls through the gate; no part needed
  "demo-zipline-01":[],  // ball rides the basket the whole way; no part needed
  "demo-laser-01":[{type:"mirror",x:400,y:135,angle:Math.PI/4,w:100}],  // redirects the downward beam into the pedestal crate
};

// Track E demo levels — one solution per new mechanic (js/levels/demo-track-e.js).
export const DEMO_SOLUTIONS_E = {
  "demo-mouse-01":[{type:"cheese",x:400,y:280}],  // lures the pacing mouse onto the button
  "demo-circuit-01":[{type:"outlet",x:260,y:170,range:120}],  // powers the motor, dragging the crate onto the button
  "demo-cannon-01":[],  // ball rests in the barrel; fuse fires on its own, no part needed
  "demo-vacuum-01":[{type:"vacuum",x:360,y:262,angle:-1.5708,range:180,coneAngle:0.6}],  // pulls the crate onto the button
  "demo-scissors-01":[{type:"scissors",x:300,y:115,angle:0,range:35}],  // snips the rope, dropping segments onto the button
};
