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
};
