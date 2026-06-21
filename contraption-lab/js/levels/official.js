// Contraption Lab — official levels (DATA).
// Every level is validated structurally (validateLevel) AND verified solvable by a
// headless Matter.js sweep (a known winning placement of the inventory exists for
// each). World is fixed 1280×720, gravity 1; coordinates are
// center-based. Levels build a gentle sloped floor toward a goal pocket so a
// gravity-fed roll is the core mechanic; later levels add parts and steeper paths.

const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x, y, w=180, h=150) => ({ type:"dwell", object:"ball", zone:{x,y,w,h}, ms:400 });

export const OFFICIAL_LEVELS = [
  // 01 — First Drop: teach ramp. Ball drops, ramp smooths the landing onto goal slope.
  lvl("official-01","First Drop", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.18},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:200,y:90,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 02 — Bounce: teach bumper. Ball drops, bumper redirects it onto goal slope.
  lvl("official-02","Bounce", goalAt(1000,560),
    [ {type:"wall",x:660,y:560,w:1000,h:28,angle:0.17},
      {type:"wall",x:1180,y:520,w:24,h:260},
      {type:"goal",x:1000,y:560} ],
    [ {type:"ball",x:220,y:100,tag:"ball"} ],
    [ {type:"bumper",count:1} ], {parts:1}),

  // 03 — Slippery: teach ice. Ramp gets ball onto ice slope, ice carries it fast to goal.
  lvl("official-03","Slippery", goalAt(1020,590),
    [ {type:"ice",x:640,y:440,w:660,h:28,angle:0.22,fixedByDefault:true},
      {type:"wall",x:1160,y:560,w:24,h:300},
      {type:"goal",x:1020,y:590} ],
    [ {type:"ball",x:360,y:260,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 04 — Fan Lift: teach fan+balloon. Balloon floats up with fan, carries ball over wall to goal.
  lvl("official-04","Fan Lift", goalAt(960,580),
    [ {type:"wall",x:240,y:600,w:360,h:28},
      {type:"wall",x:520,y:380,w:28,h:440},
      {type:"wall",x:880,y:580,w:560,h:28,angle:0.13},
      {type:"wall",x:1180,y:540,w:24,h:280},
      {type:"goal",x:960,y:580} ],
    [ {type:"ball",x:240,y:540,tag:"ball"} ],
    [ {type:"balloon",count:1}, {type:"fan",count:1} ], {parts:2}),

  // 05 — Magnet: teach magnet. Ball drops, magnet pulls it sideways onto goal slope.
  lvl("official-05","Magnet", goalAt(960,560),
    [ {type:"wall",x:880,y:560,w:680,h:28,angle:0.15},
      {type:"wall",x:1180,y:520,w:24,h:280},
      {type:"goal",x:960,y:560} ],
    [ {type:"ball",x:280,y:120,tag:"ball"} ],
    [ {type:"magnet",count:1} ], {parts:1}),
];
