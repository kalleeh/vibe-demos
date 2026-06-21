// Documented winning placements per official level id (used by solve-verify.mjs).
// Kept in sync as levels are added/redesigned.
export const SOLUTIONS = {
  "official-01":[{type:"ramp",x:200,y:100,angle:0.15}],
  "official-02":[{type:"bumper",x:240,y:120}],
  "official-03":[{type:"ramp",x:360,y:260,angle:0.2}],
  "official-04":[{type:"balloon",x:320,y:430,angle:0},{type:"fan",x:360,y:530,angle:2}],
  "official-05":[{type:"magnet",x:480,y:240}],
  "official-06":[{type:"conveyor",x:520,y:574,w:760,angle:0,surfaceSpeed:6}],
  "official-07":[{type:"weight",x:430,y:80}],
  "official-08":[{type:"accelerator",x:480,y:360,w:90,angle:0.3,boost:13}],
  "official-09":[{type:"portal",x:280,y:520,link:"p1",angle:0},{type:"portal",x:1000,y:340,link:"p1",angle:0}],
  "official-10":[{type:"ramp",x:240,y:250,angle:0.22}],
  "official-11":[{type:"domino",x:200,y:480},{type:"domino",x:250,y:470},{type:"domino",x:300,y:460},{type:"domino",x:350,y:450}],
  "official-12":[{type:"vortex",x:420,y:300,strength:0.05,range:200}],
  // Band C: Multi-step chains
  "official-13":[{type:"weight",x:200,y:60}],
  "official-14":[{type:"domino",x:200,y:480},{type:"domino",x:250,y:475},{type:"pinwheel",x:620,y:480}],
  "official-15":[{type:"trampoline",x:600,y:650,angle:0}],
  "official-16":[{type:"weight",x:430,y:80},{type:"gears",x:700,y:500}],
  "official-17":[{type:"conveyor",x:360,y:574,w:640,angle:0,surfaceSpeed:6},{type:"portal",x:280,y:520,link:"p1",angle:0},{type:"portal",x:1000,y:480,link:"p1",angle:0}],
  "official-18":[{type:"magnet",x:440,y:240},{type:"accelerator",x:460,y:400,w:90,angle:-0.2,boost:13}],
  // Band D: Fiendish finale
  "official-19":[{type:"portal",x:240,y:480,link:"p1",angle:0},{type:"portal",x:780,y:260,link:"p1",angle:0},{type:"vortex",x:880,y:280,strength:0.05,range:200},{type:"accelerator",x:1020,y:280,w:100,angle:0,boost:10}],
  "official-20":[{type:"magnet",x:300,y:360,strength:0.02,range:280},{type:"portal",x:240,y:480,link:"p1",angle:0},{type:"portal",x:820,y:260,link:"p1",angle:0},{type:"vortex",x:920,y:280,strength:0.05,range:200},{type:"accelerator",x:1060,y:280,w:100,angle:0,boost:10}],
};
