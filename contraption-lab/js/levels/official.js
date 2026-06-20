// Contraption Lab — official levels (DATA).
// Every level is validated structurally (validateLevel) AND verified solvable by a
// headless Matter.js sweep (a known winning placement exists for each — see the
// solution note on each). World is fixed 1280×720, gravity 1; coordinates are
// center-based. Levels build a gentle sloped floor toward a goal pocket so a
// gravity-fed roll is the core mechanic; later levels add parts and steeper paths.

const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x, y, w=180, h=150) => ({ type:"dwell", object:"ball", zone:{x,y,w,h}, ms:400 });

export const OFFICIAL_LEVELS = [
  // 01 — drop the ball onto the slope; it rolls right into the pocket. Sol: ramp(200,200,0.2).
  lvl("official-01","First Drop", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.18},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:200,y:90,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  // 02 — longer roll, two ramps to keep it moving. Sol: ramp(180,200,0.3)+ramp(520,400,0.2).
  lvl("official-02","Long Roll", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.16},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:180,y:90,tag:"ball"} ],
    [ {type:"ramp",count:2} ], {parts:2}),

  // 03 — mirror: goal pocket bottom-left, ball starts top-right. Sol: ramp(1060,200,-0.2) (fan is an optional assist).
  lvl("official-03","Fan Assist", goalAt(220,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:-0.18},
      {type:"wall",x:80,y:520,w:24,h:260},
      {type:"goal",x:220,y:560} ],
    [ {type:"ball",x:1060,y:90,tag:"ball"} ],
    [ {type:"ramp",count:1}, {type:"fan",count:1} ], {parts:2}),

  // 04 — zigzag with two ramps. Sol: ramp(220,220,0.35)+ramp(600,380,0.25).
  lvl("official-04","Switchback", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.16},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:200,y:90,tag:"ball"} ],
    [ {type:"ramp",count:2} ], {parts:2}),

  // 05 — a conveyor helps ferry the ball along. Sol: ramp(200,220,0.3)+conveyor(600,420,0.1).
  lvl("official-05","Conveyor Carry", goalAt(1060,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.14},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1060,y:560} ],
    [ {type:"ball",x:200,y:90,tag:"ball"} ],
    [ {type:"ramp",count:1}, {type:"conveyor",count:1} ], {parts:2}),

  // 06 — cascade of two ramps from the far left. Sol: ramp(160,200,0.3)+ramp(520,380,0.2).
  lvl("official-06","Cascade", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.17},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:160,y:90,tag:"ball"} ],
    [ {type:"ramp",count:2} ], {parts:2}),

  // 07 — three-ramp chain. Sol: ramp(220,200,0.35)+ramp(520,360,0.25)+ramp(820,460,0.2).
  lvl("official-07","The Drop Chain", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.18},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:220,y:90,tag:"ball"} ],
    [ {type:"ramp",count:3} ], {parts:3}),

  // 08 — steeper slope, three switchbacks. Sol: ramp(180,200,0.4)+ramp(500,340,0.3)+ramp(820,450,0.2).
  lvl("official-08","Triple Switchback", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.2},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:180,y:90,tag:"ball"} ],
    [ {type:"ramp",count:3} ], {parts:3}),

  // 09 — left pocket, two ramps + conveyor. Sol: ramp(1060,200,-0.3)+ramp(640,360,-0.2)+conveyor(400,480,0).
  lvl("official-09","Headwind", goalAt(220,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:-0.18},
      {type:"wall",x:80,y:520,w:24,h:260},
      {type:"goal",x:220,y:560} ],
    [ {type:"ball",x:1060,y:90,tag:"ball"} ],
    [ {type:"ramp",count:2}, {type:"conveyor",count:1} ], {parts:3}),

  // 10 — grand finale: steep slope, four mixed parts. Sol: ramp(160,180,0.35)+ramp(500,340,0.25)+conveyor(820,460,0.1)+fan(300,300,0.3).
  lvl("official-10","Grand Contraption", goalAt(1040,560),
    [ {type:"wall",x:640,y:560,w:1100,h:28,angle:0.19},
      {type:"wall",x:1200,y:520,w:24,h:260},
      {type:"goal",x:1040,y:560} ],
    [ {type:"ball",x:160,y:80,tag:"ball"} ],
    [ {type:"ramp",count:2}, {type:"conveyor",count:1}, {type:"fan",count:1} ], {parts:4}),
];
