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
  // 01 — First Drop: teach ramp. The ball drops off the first slope's edge into a
  // gap it can't cross alone; the ramp bridges the drop onto the goal slope.
  lvl("official-01","First Drop", goalAt(1040,560),
    [ {type:"wall",x:300,y:300,w:300,h:28,angle:0.18},
      {type:"wall",x:900,y:560,w:540,h:28,angle:0.18},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:170,y:220,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 02 — Bounce: teach bumper. The ball falls off the first slope into open air; the
  // bumper redirects the fall onto the goal slope below.
  lvl("official-02","Bounce", goalAt(1000,660,220,120),
    [ {type:"wall",x:280,y:300,w:320,h:28,angle:0.17},
      {type:"wall",x:1180,y:680,w:24,h:80},
      {type:"goal",x:1000,y:660} ],
    [ {type:"ball",x:150,y:220,tag:"ball"} ],
    [ {type:"bumper",count:1} ], {parts:1}),

  // 03 — Slippery: teach ice. Two ice slopes with a gap between them; the ramp
  // bridges the gap so the ice can carry the ball on to the goal.
  lvl("official-03","Slippery", goalAt(1020,460,220,150),
    [ {type:"ice",x:420,y:330,w:320,h:28,angle:0.22,fixedByDefault:true},
      {type:"ice",x:940,y:460,w:420,h:28,angle:0.22,fixedByDefault:true},
      {type:"wall",x:1200,y:500,w:24,h:80},
      {type:"goal",x:1020,y:460} ],
    [ {type:"ball",x:280,y:260,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 04 — Fan Lift: teach fan+balloon. Balloon floats up with fan, carries ball over wall to goal.
  lvl("official-04","Fan Lift", goalAt(900,580,300,200),
    [ {type:"wall",x:240,y:600,w:360,h:28},
      {type:"wall",x:520,y:380,w:28,h:440},
      {type:"wall",x:880,y:580,w:560,h:28,angle:0.13},
      {type:"wall",x:1180,y:540,w:24,h:280},
      {type:"goal",x:900,y:580} ],
    [ {type:"ball",x:240,y:540,tag:"ball"} ],
    [ {type:"balloon",count:1}, {type:"fan",count:1} ], {parts:2}),

  // 05 — Magnet: teach magnet. Ball drops, magnet pulls it sideways onto goal slope.
  lvl("official-05","Magnet", goalAt(960,560),
    [ {type:"wall",x:880,y:560,w:680,h:28,angle:0.15},
      {type:"wall",x:1180,y:520,w:24,h:280},
      {type:"goal",x:960,y:560} ],
    [ {type:"ball",x:280,y:120,tag:"ball"} ],
    [ {type:"magnet",count:1} ], {parts:1}),

  // 06 — Conveyor Run: ball drops through a pipe chute, then a conveyor carries it
  // across a pit to the goal ledge.
  lvl("official-06","Conveyor Run", goalAt(1040,520,280,200),
    [ {type:"pipe",x:150,y:300,w:220,angle:0.35},
      {type:"wall",x:240,y:600,w:340,h:28},
      {type:"wall",x:1000,y:520,w:480,h:28,angle:0.12},
      {type:"wall",x:1200,y:480,w:24,h:240},
      {type:"goal",x:1040,y:520} ],
    [ {type:"ball",x:60,y:160,tag:"ball"} ],
    [ {type:"conveyor",count:1} ], {parts:1}),

  // 07 — Seesaw Launch: a weight drops onto one end of a seesaw, flinging the ball horizontally across a pit.
  // Layout: seesaw suspended over a pit, ball on right end, weight drops on left, goal on far platform.
  lvl("official-07","Seesaw Launch", goalAt(1000,560),
    [ {type:"wall",x:320,y:560,w:400,h:28},
      {type:"seesaw",x:520,y:480,w:220,fixedByDefault:true},
      {type:"wall",x:1000,y:560,w:480,h:28,angle:0.14},
      {type:"wall",x:1200,y:520,w:28,h:280},
      {type:"goal",x:1000,y:560} ],
    [ {type:"ball",x:610,y:440,tag:"ball"} ],
    [ {type:"weight",count:1} ], {parts:1}),

  // 08 — Accelerator Gap: a wedge redirects the ball down into a corner, then an
  // angled accelerator pad launches it up and across to the goal ledge.
  lvl("official-08","Accelerator Gap", goalAt(960,420,220,180),
    [ {type:"wedge",x:280,y:180,w:180,h:120,angle:-0.35},
      {type:"wall",x:940,y:420,w:600,h:28},
      {type:"wall",x:1220,y:510,w:28,h:420},
      {type:"goal",x:960,y:420} ],
    [ {type:"ball",x:260,y:80,tag:"ball"} ],
    [ {type:"accelerator",count:1} ], {parts:1}),

  // 09 — Portal Hop: a portal pair routes the ball through/over a tall wall to the goal.
  // Layout: DIVIDER WALL — a tall vertical wall splits the space; portals teleport left→right.
  lvl("official-09","Portal Hop", goalAt(1000,560),
    [ {type:"wall",x:640,y:360,w:28,h:720},
      {type:"wall",x:280,y:600,w:480,h:28},
      {type:"wall",x:1000,y:560,w:480,h:28,angle:0.13},
      {type:"wall",x:1200,y:520,w:24,h:280},
      {type:"goal",x:1000,y:560} ],
    [ {type:"ball",x:280,y:520,tag:"ball"} ],
    [ {type:"portal",count:2} ], {parts:2}),

  // 10 — Sticky Stop: ball slides down an ice slope, bounces off a spring mid-run,
  // then must stop on a sticky pad inside the goal zone.
  lvl("official-10","Sticky Stop", goalAt(1000,600),
    [ {type:"ice",x:420,y:380,w:600,h:28,angle:0.24,fixedByDefault:true},
      {type:"spring",x:760,y:600,h:80,fixedByDefault:true},
      {type:"sticky",x:1000,y:600,w:400,h:24,fixedByDefault:true},
      {type:"wall",x:1220,y:560,w:28,h:320},
      {type:"goal",x:1000,y:600} ],
    [ {type:"ball",x:130,y:230,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 11 — Domino Cascade: dominoes topple in sequence, last one knocks ball down slope to goal.
  // Layout: sloped platform, dominoes lined up, ball at end, goal at bottom of slope.
  lvl("official-11","Domino Cascade", goalAt(1000,580),
    [ {type:"wall",x:520,y:420,w:800,h:28,angle:0.16},
      {type:"wall",x:1000,y:580,w:480,h:28,angle:0.14},
      {type:"wall",x:1200,y:540,w:28,h:300},
      {type:"goal",x:1000,y:580} ],
    [ {type:"ball",x:860,y:340,tag:"ball"} ],
    [ {type:"domino",count:4} ], {parts:4}),

  // 12 — Vortex: a vortex bends a falling ball's trajectory into an otherwise-unreachable goal.
  // Layout: VERTICAL SHAFT — ball drops straight down, vortex pulls it sideways into a recessed goal alcove.
  lvl("official-12","Vortex", goalAt(380,560),
    [ {type:"wall",x:640,y:140,w:28,h:280},
      {type:"wall",x:380,y:560,w:600,h:28},
      {type:"wall",x:80,y:420,w:28,h:440},
      {type:"wall",x:640,y:680,w:28,h:80},
      {type:"gear",x:500,y:350,r:30},
      {type:"goal",x:380,y:560} ],
    [ {type:"ball",x:640,y:80,tag:"ball"} ],
    [ {type:"vortex",count:1} ], {parts:1}),

  // === BAND C: Multi-step chains (levels 13-18) ===

  // 13 — Button & Gate: a crate dropped on a side ledge presses the button, retracting
  // the gate so the ball (which starts left of the gate) can roll through to goal.
  lvl("official-13","Button & Gate", goalAt(960,560),
    [ {type:"wall",x:200,y:420,w:140,h:24,fixedByDefault:true},
      {type:"button",x:200,y:394,w:80,gate:"g1",fixedByDefault:true},
      {type:"wall",x:420,y:460,w:400,h:28,angle:0.16,fixedByDefault:true},
      {type:"gate",x:540,y:420,w:24,h:360,id:"g1",fixedByDefault:true},
      {type:"wall",x:880,y:560,w:680,h:28,angle:0.15},
      {type:"wall",x:1180,y:520,w:28,h:280},
      {type:"goal",x:960,y:560} ],
    [ {type:"ball",x:300,y:380,tag:"ball"} ],
    [ {type:"crate",count:1} ], {parts:1}),

  // 14 — Pinwheel Relay: a platform bridges the gap between the entry ramp and the
  // goal ledge; domino/pinwheel round out the inventory for style points.
  lvl("official-14","Pinwheel Relay", goalAt(1080,460,180,150),
    [ {type:"wall",x:420,y:420,w:680,h:28,angle:0.16},
      {type:"wall",x:1080,y:500,w:400,h:24},
      {type:"wall",x:1280,y:460,w:24,h:320},
      {type:"goal",x:1080,y:460} ],
    [ {type:"ball",x:220,y:300,tag:"ball"} ],
    [ {type:"domino",count:2}, {type:"pinwheel",count:1}, {type:"platform",count:1} ], {parts:4}),

  // 15 — Trampoline Bounce: ball rolls off a raised platform and falls short of the
  // goal; a trampoline on the floor bounces it the rest of the way across.
  lvl("official-15","Trampoline Bounce", goalAt(900,640,220,140),
    [ {type:"platform",x:420,y:300,w:220,angle:0.1},
      {type:"wall",x:1160,y:600,w:24,h:240},
      {type:"goal",x:900,y:640} ],
    [ {type:"ball",x:320,y:200,tag:"ball"} ],
    [ {type:"trampoline",count:1} ], {parts:1}),

  // 16 — Gear Drive: a weight tips the seesaw, launching the ball past a hanging rope
  // and onto the gears, which fling it across the gap to the goal ledge.
  lvl("official-16","Gear Drive", goalAt(1080,560,220,200),
    [ {type:"wall",x:320,y:560,w:400,h:28},
      {type:"seesaw",x:520,y:480,w:220,fixedByDefault:true},
      {type:"rope",x:780,y:180,x2:900,y2:320,segments:6,fixedByDefault:true},
      {type:"wall",x:960,y:560,w:640,h:28,angle:0.14},
      {type:"wall",x:1260,y:520,w:28,h:280},
      {type:"goal",x:1080,y:560} ],
    [ {type:"ball",x:610,y:440,tag:"ball"} ],
    [ {type:"weight",count:1}, {type:"gears",count:1} ], {parts:2}),

  // 17 — Two-Portal Maze: conveyor + portal through wall, then a pipe chute funnels
  // the ball down onto the goal ledge.
  lvl("official-17","Portal Maze", goalAt(1128,545,180,150),
    [ {type:"wall",x:640,y:360,w:28,h:720},
      {type:"wall",x:280,y:600,w:480,h:28},
      {type:"pipe",x:1000,y:510,w:180,angle:0.13},
      {type:"wall",x:1000,y:560,w:400,h:28,angle:0.13},
      {type:"wall",x:1230,y:540,w:28,h:320},
      {type:"goal",x:1128,y:545} ],
    [ {type:"ball",x:160,y:520,tag:"ball"} ],
    [ {type:"conveyor",count:1}, {type:"portal",count:2} ], {parts:3}),

  // 18 — Magnet + Accelerator: magnet pulls ball into position, accelerator launches to goal (model on L05+L08).
  lvl("official-18","Magnet + Accelerator", goalAt(960,360),
    [ {type:"wall",x:960,y:360,w:640,h:28},
      {type:"wall",x:80,y:360,w:28,h:720},
      {type:"wall",x:1200,y:460,w:28,h:200},
      {type:"goal",x:960,y:360} ],
    [ {type:"ball",x:280,y:120,tag:"ball"} ],
    [ {type:"magnet",count:1}, {type:"accelerator",count:1} ], {parts:2}),

  // === BAND D: Fiendish finale (levels 19-20) ===

  // 19 — The Gauntlet: portal teleport, a TNT charge to blast the ball forward, then an
  // accelerator launch across the final gap to the goal.
  lvl("official-19","The Gauntlet", goalAt(980,300),
    [ // Left: ball starts on platform
      {type:"wall",x:240,y:520,w:400,h:28},
      {type:"wall",x:80,y:480,w:28,h:160},
      // Portal pair bypasses middle zone
      {type:"wall",x:560,y:400,w:28,h:800},
      // Right: TNT + accelerator zone
      {type:"wall",x:980,y:300,w:640,h:28},
      {type:"wall",x:1240,y:260,w:28,h:80},
      {type:"goal",x:980,y:300} ],
    [ {type:"ball",x:240,y:460,tag:"ball"} ],
    [ {type:"portal",count:2}, {type:"tnt",count:1}, {type:"accelerator",count:1} ], {parts:4}),

  // 20 — Grand Contraption: grand finale — magnet + portal + vortex + accelerator (generous inventory, 5 distinct parts).
  // Layout: Similar proven structure to L19, but magnet adds positioning complexity before portal hop.
  lvl("official-20","Grand Contraption", goalAt(1020,300),
    [ // Left drop zone
      {type:"wall",x:200,y:600,w:320,h:28},
      {type:"wall",x:80,y:560,w:28,h:160},
      // Transition platform before portal
      {type:"wall",x:240,y:520,w:400,h:28},
      // Divider wall
      {type:"wall",x:560,y:400,w:28,h:800},
      // Right: vortex + accelerator zone (L19's proven right side)
      {type:"wall",x:1020,y:300,w:680,h:28},
      {type:"wall",x:1260,y:260,w:28,h:80},
      {type:"bowlingpin",x:1150,y:258},
      {type:"goal",x:1020,y:300} ],
    [ {type:"ball",x:200,y:100,tag:"ball"} ],
    [ {type:"magnet",count:1}, {type:"portal",count:2}, {type:"vortex",count:1}, {type:"accelerator",count:1} ], {parts:5}),
];
