// Contraption Lab — Track E demo levels (DATA).
// One small level per new mechanic (cheese+mouse, outlet+motor circuit, cannon,
// vacuum, scissors), verified solvable the same way as OFFICIAL_LEVELS by
// tools/solve-verify.mjs. Kept separate from OFFICIAL_LEVELS (must stay
// exactly 20) and from DEMO_TRACK_D_LEVELS (its own proof-of-mechanic set) —
// these are proof-of-mechanic levels, not part of the official difficulty arc.

const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x, y, w=180, h=150) => ({ type:"dwell", object:"ball", zone:{x,y,w,h}, ms:400 });

export const DEMO_TRACK_E_LEVELS = [
  // Mouse + cheese: the mouse paces its own raised ledge, well clear of the
  // ball's path. Luring it with a player-placed cheese sends it onto a
  // button, opening the gate the ball needs.
  lvl("demo-mouse-01","Follow the Cheese", goalAt(1080,600,180,120),
    [ {type:"wall",x:550,y:500,w:900,h:28,angle:0.08},
      {type:"wall",x:250,y:300,w:400,h:20},
      {type:"wall",x:60,y:250,w:20,h:100},
      {type:"wall",x:440,y:250,w:20,h:100},
      {type:"button",x:400,y:280,w:60,gate:"g1"},
      {type:"gate",x:1000,y:400,id:"g1",w:24,h:200},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600} ],
    [ {type:"ball",x:150,y:420,tag:"ball"},
      {type:"mouse",x:250,y:280,dir:1,speed:2} ],
    [ {type:"cheese",count:1} ], {parts:1}),

  // Outlet + motor circuit: the motor sits in its own sealed box, dead until
  // an outlet is placed in range — once powered, it drags the crate onto a
  // button that opens the gate before the ball arrives.
  lvl("demo-circuit-01","Power Up", goalAt(1080,600,180,120),
    [ {type:"wall",x:550,y:500,w:900,h:28,angle:0.14},
      {type:"gate",x:950,y:400,id:"g1",w:24,h:200},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600},
      {type:"platform",x:300,y:290,w:180,h:16},
      {type:"wall",x:300,y:212,w:180,h:16},
      {type:"wall",x:220,y:250,w:16,h:96},
      {type:"wall",x:380,y:250,w:16,h:96},
      {type:"motor",x:260,y:262,r:24,spin:5},
      {type:"button",x:355,y:282,w:36,gate:"g1"} ],
    [ {type:"ball",x:150,y:400,tag:"ball"},
      {type:"crate",x:260,y:230,w:22,h:22} ],
    [ {type:"outlet",count:1} ], {parts:1}),

  // Cannon: the ball starts resting in the cannon's barrel; the fuse fires
  // once, launching it clear across a gap to the goal ledge.
  lvl("demo-cannon-01","Fire!", goalAt(1080,300,200,150),
    [ {type:"wall",x:300,y:500,w:200,h:28},
      {type:"cannon",x:300,y:460,angle:-0.5,fuseMs:800,boost:20},
      {type:"wall",x:1180,y:380,w:220,h:28},
      {type:"goal",x:1080,y:300} ],
    [ {type:"ball",x:300,y:430,tag:"ball"} ],
    [], {parts:0}),

  // Vacuum: a crate rests off to the side, out of the ball's path. Placing a
  // vacuum pulls the crate across a short apparatus box onto a button,
  // opening the gate before the ball rolls past.
  lvl("demo-vacuum-01","Suck It In", goalAt(1080,600,180,120),
    [ {type:"wall",x:550,y:500,w:900,h:28,angle:0.1},
      {type:"gate",x:950,y:400,id:"g1",w:24,h:200},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600},
      {type:"platform",x:300,y:290,w:180,h:16},
      {type:"button",x:355,y:282,w:36,gate:"g1"},
      {type:"wall",x:380,y:262,w:16,h:60} ],
    [ {type:"ball",x:150,y:420,tag:"ball"},
      {type:"crate",x:230,y:262,w:22,h:22} ],
    [ {type:"vacuum",count:1} ], {parts:1}),

  // Scissors: a rope dangles above a button-lined alcove off the ball's path.
  // Snipping it drops the segments onto the button, opening the gate.
  lvl("demo-scissors-01","Snip", goalAt(1080,600,180,120),
    [ {type:"wall",x:550,y:500,w:900,h:28,angle:0.1},
      {type:"gate",x:950,y:400,id:"g1",w:24,h:200},
      {type:"wall",x:1260,y:560,w:28,h:280},
      {type:"goal",x:1080,y:600},
      {type:"platform",x:300,y:290,w:120,h:16},
      {type:"button",x:300,y:282,w:100,gate:"g1"},
      {type:"wall",x:246,y:262,w:12,h:60},
      {type:"wall",x:354,y:262,w:12,h:60},
      {type:"rope",x:300,y:100,x2:300,y2:180,segments:5} ],
    [ {type:"ball",x:150,y:420,tag:"ball"} ],
    [ {type:"scissors",count:1} ], {parts:1}),
];
