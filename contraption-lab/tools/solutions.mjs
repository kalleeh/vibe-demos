// Documented winning placements per official level id (used by solve-verify.mjs).
// Kept in sync as levels are added/redesigned.
export const SOLUTIONS = {
  "official-01":[{type:"ramp",x:200,y:100,angle:0.15}],
  "official-02":[{type:"bumper",x:240,y:120}],
  "official-03":[{type:"ramp",x:360,y:260,angle:0.2}],
  "official-04":[{type:"balloon",x:320,y:430,angle:0},{type:"fan",x:360,y:530,angle:2}],
  "official-05":[{type:"magnet",x:480,y:240}],
  "official-06":[{type:"conveyor",x:580,y:574,w:800,angle:0.02,surfaceSpeed:5}],
  "official-07":[{type:"fan",x:160,y:360,angle:1.5708},{type:"ramp",x:560,y:390,angle:0.1}],
  "official-08":[{type:"ramp",x:180,y:90,angle:0.16}],
  "official-09":[{type:"portal",x:280,y:520,link:"p1",angle:0},{type:"portal",x:960,y:360,link:"p1",angle:0}],
  "official-10":[{type:"ramp",x:260,y:307,angle:0.2}],
  "official-11":[{type:"conveyor",x:600,y:574,w:740,angle:0,surfaceSpeed:5},{type:"bumper",x:940,y:480}],
  "official-12":[{type:"fan",x:140,y:540,angle:1.5708},{type:"conveyor",x:640,y:574,w:800,angle:0.01,surfaceSpeed:5}],
};
