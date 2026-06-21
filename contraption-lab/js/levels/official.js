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

  // 06 — Conveyor Run: conveyor carries ball across a pit to the goal ledge.
  // Layout: PIT in the middle, goal on a raised platform on the right.
  lvl("official-06","Conveyor Run", goalAt(1000,520),
    [ {type:"wall",x:240,y:600,w:340,h:28},
      {type:"wall",x:1000,y:520,w:480,h:28,angle:0.12},
      {type:"wall",x:1200,y:480,w:24,h:240},
      {type:"goal",x:1000,y:520} ],
    [ {type:"ball",x:240,y:520,tag:"ball"} ],
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

  // 08 — Accelerator Gap: ball drops straight onto an angled accelerator pad that launches it up and across to goal.
  // Layout: ball drops vertically, accelerator pad catches and launches at angle, goal on upper-right ledge.
  lvl("official-08","Accelerator Gap", goalAt(940,420),
    [ {type:"wall",x:940,y:420,w:600,h:28},
      {type:"wall",x:1220,y:510,w:28,h:420},
      {type:"goal",x:940,y:420} ],
    [ {type:"ball",x:480,y:100,tag:"ball"} ],
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

  // 10 — Sticky Stop: ball slides down an ice slope and must stop on a sticky pad inside the goal zone.
  // Layout: steep ice slope from upper-left to lower-right, sticky pad at bottom to catch the ball.
  lvl("official-10","Sticky Stop", goalAt(960,600),
    [ {type:"ice",x:560,y:400,w:800,h:28,angle:0.24,fixedByDefault:true},
      {type:"sticky",x:960,y:600,w:500,h:24,fixedByDefault:true},
      {type:"wall",x:1200,y:560,w:28,h:320},
      {type:"goal",x:960,y:600} ],
    [ {type:"ball",x:220,y:240,tag:"ball"} ],
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
      {type:"goal",x:380,y:560} ],
    [ {type:"ball",x:640,y:80,tag:"ball"} ],
    [ {type:"vortex",count:1} ], {parts:1}),

  // === BAND C: Multi-step chains (levels 13-18) ===

  // 13 — Button & Gate: ball drops, weight drops onto button to open gate, ball continues to goal.
  // Layout: Vertical drop with horizontal gate barrier mid-path (modeled on L05 drop pattern).
  lvl("official-13","Button & Gate", goalAt(960,560),
    [ {type:"wall",x:280,y:600,w:400,h:28},
      {type:"button",x:200,y:600,w:80,gate:"g1",fixedByDefault:true},
      {type:"gate",x:480,y:420,w:24,h:360,id:"g1",fixedByDefault:true},
      {type:"wall",x:880,y:560,w:680,h:28,angle:0.15},
      {type:"wall",x:1180,y:520,w:28,h:280},
      {type:"goal",x:960,y:560} ],
    [ {type:"ball",x:600,y:120,tag:"ball"} ],
    [ {type:"weight",count:1} ], {parts:1}),

  // 14 — Pinwheel Relay: domino + pinwheel - domino chain triggers pinwheel spin (simpler chain).
  lvl("official-14","Pinwheel Relay", goalAt(960,560),
    [ {type:"wall",x:420,y:520,w:680,h:28,angle:0.16},
      {type:"wall",x:880,y:560,w:680,h:28,angle:0.15},
      {type:"wall",x:1180,y:520,w:28,h:280},
      {type:"goal",x:960,y:560} ],
    [ {type:"ball",x:720,y:440,tag:"ball"} ],
    [ {type:"domino",count:2}, {type:"pinwheel",count:1} ], {parts:3}),

  // 15 — Trampoline Tower: like L11 but add a bumper mid-slope for multi-bounce (proven pattern + 1 part).
  // 15 — Trampoline Bounce: ball drops down a narrow shaft into a deep pocket; the player drops
  // a trampoline at the bottom so the ball bounces and settles in the goal pocket (the trampoline
  // is the star — without it the ball wouldn't dwell). Distinct vertical-shaft silhouette.
  lvl("official-15","Trampoline Bounce", goalAt(640,540,220,240),
    [ {type:"wall",x:640,y:700,w:1280,h:30},
      {type:"wall",x:520,y:520,w:24,h:360},
      {type:"wall",x:760,y:520,w:24,h:360},
      {type:"goal",x:640,y:540} ],
    [ {type:"ball",x:640,y:80,tag:"ball"} ],
    [ {type:"trampoline",count:1} ], {parts:1}),

  // 16 — Gear Drive: seesaw + gears - weight tips seesaw, launching ball to gears (like L07 pattern).
  lvl("official-16","Gear Drive", goalAt(940,560),
    [ {type:"wall",x:320,y:560,w:400,h:28},
      {type:"seesaw",x:520,y:480,w:220,fixedByDefault:true},
      {type:"wall",x:880,y:560,w:640,h:28,angle:0.14},
      {type:"wall",x:1160,y:520,w:28,h:280},
      {type:"goal",x:940,y:560} ],
    [ {type:"ball",x:610,y:440,tag:"ball"} ],
    [ {type:"weight",count:1}, {type:"gears",count:1} ], {parts:2}),

  // 17 — Two-Portal Maze: conveyor + portal through wall (exact L09 pattern with conveyor assist).
  lvl("official-17","Portal Maze", goalAt(1000,560),
    [ {type:"wall",x:640,y:360,w:28,h:720},
      {type:"wall",x:280,y:600,w:480,h:28},
      {type:"wall",x:1000,y:560,w:400,h:28,angle:0.13},
      {type:"wall",x:1160,y:520,w:28,h:280},
      {type:"goal",x:1000,y:560} ],
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
];
