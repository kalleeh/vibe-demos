// Contraption Lab — Track D demo levels (DATA).
// One small level per new mechanic (saw, one-way gate, zipline, laser+mirror),
// verified solvable the same way as OFFICIAL_LEVELS by tools/solve-verify.mjs.
// Kept in a separate array/file so OFFICIAL_LEVELS stays exactly 20 (asserted by
// level.test.js and referenced in marketing copy) — these are proof-of-mechanic
// levels, not part of the official difficulty arc.

const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x, y, w=180, h=150) => ({ type:"dwell", object:"ball", zone:{x,y,w,h}, ms:400 });

export const DEMO_TRACK_D_LEVELS = [
  // Saw: a crate rests on a small pedestal blocking the ball's ramp. Placing a
  // saw well clear of the roll line (its cutting radius still reaches the
  // crate) removes it, opening the path to the goal.
  lvl("demo-saw-01","Cut It Loose", goalAt(1080,600,180,120),
    [ {type:"wall",x:700,y:280,w:80,h:20},
      {type:"wall",x:550,y:500,w:900,h:28,angle:0.1},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600} ],
    [ {type:"ball",x:150,y:420,tag:"ball"},
      {type:"crate",x:700,y:240,w:70,h:60} ],
    [ {type:"saw",count:1} ], {parts:1}),

  // One-way gate: the ball must drop straight down through a gate that only
  // allows downward travel, landing in the goal pocket below. Proves the gate
  // passes a falling ball while remaining solid the other direction.
  lvl("demo-oneway-01","Pass Through", goalAt(600,620,200,100),
    [ {type:"oneway",x:600,y:400,angle:1.5708,w:160},
      {type:"wall",x:520,y:660,w:220,h:28},
      {type:"wall",x:460,y:500,w:28,h:200},
      {type:"wall",x:740,y:500,w:28,h:200},
      {type:"goal",x:600,y:620} ],
    [ {type:"ball",x:600,y:250,tag:"ball"} ],
    [], {parts:0}),

  // Zipline: the ball starts in the zipline basket at the high anchor; the line
  // carries it across a pit it could never clear on its own to the goal ledge.
  lvl("demo-zipline-01","Ride the Line", goalAt(1080,560,200,140),
    [ {type:"zipline",x:200,y:200,x2:1000,y2:520,speed:0.22},
      {type:"wall",x:1180,y:600,w:200,h:28},
      {type:"wall",x:1260,y:560,w:28,h:120},
      {type:"goal",x:1080,y:560} ],
    [ {type:"ball",x:200,y:190,tag:"ball"} ],
    [], {parts:0}),

  // Laser + mirror: the beam fires straight down from the ceiling into open
  // space, missing everything — until the player angles a mirror underneath it
  // to redirect the beam sideways into a crate resting on its own pedestal.
  // Tripping the beam opens the gate the ball needs to reach the goal.
  lvl("demo-laser-01","Trip the Beam", goalAt(1080,600,180,120),
    [ {type:"laser",x:400,y:80,angle:1.5708,gate:"g1"},
      {type:"wall",x:700,y:175,w:80,h:20},
      {type:"wall",x:550,y:500,w:900,h:28,angle:0.1},
      {type:"gate",x:950,y:560,w:24,h:200,id:"g1"},
      {type:"wall",x:1080,y:600,w:400,h:28,angle:0.1},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600} ],
    [ {type:"ball",x:150,y:420,tag:"ball"},
      {type:"crate",x:700,y:135,w:50,h:50} ],
    [ {type:"mirror",count:1} ], {parts:1}),
];
