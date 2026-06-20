const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x,y) => ({ type:"dwell", object:"ball", zone:{x,y,w:120,h:120}, ms:500 });

export const OFFICIAL_LEVELS = [
  lvl("official-01","First Drop",
    goalAt(1080,620),
    [ {type:"wall",x:1080,y:700,w:240,h:30}, {type:"goal",x:1080,y:620} ],
    [ {type:"ball",x:200,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  lvl("official-02","Over the Wall",
    goalAt(1120,600),
    [ {type:"wall",x:640,y:560,w:30,h:320}, {type:"wall",x:1120,y:680,w:300,h:30}, {type:"goal",x:1120,y:600} ],
    [ {type:"ball",x:160,y:120,tag:"ball"} ],
    [ {type:"ramp",count:2} ], {parts:2}),

  lvl("official-03","Fan Assist",
    goalAt(220,600),
    [ {type:"wall",x:220,y:680,w:260,h:30}, {type:"goal",x:220,y:600} ],
    [ {type:"ball",x:1080,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1}, {type:"fan",count:1} ], {parts:2}),

  lvl("official-04","Seesaw Launch", goalAt(1100,560),
    [ {type:"wall",x:1100,y:640,w:260,h:30}, {type:"bucket",x:700,y:600}, {type:"goal",x:1100,y:560} ],
    [ {type:"ball",x:160,y:100,tag:"ball"} ],
    [ {type:"ramp",count:1},{type:"seesaw",count:1} ], {parts:2}),

  lvl("official-05","Conveyor Carry", goalAt(1140,600),
    [ {type:"wall",x:300,y:680,w:300,h:30}, {type:"wall",x:1140,y:680,w:260,h:30}, {type:"goal",x:1140,y:600} ],
    [ {type:"ball",x:200,y:560,tag:"ball"} ],
    [ {type:"conveyor",count:1},{type:"ramp",count:1} ], {parts:2}),

  lvl("official-06","Float Up", goalAt(640,160),
    [ {type:"wall",x:640,y:400,w:520,h:30}, {type:"wall",x:300,y:200,w:30,h:430}, {type:"goal",x:640,y:160} ],
    [ {type:"ball",x:200,y:560,tag:"ball"} ],
    [ {type:"balloon",count:1},{type:"ramp",count:1} ], {parts:2}),

  lvl("official-07","Domino Run", goalAt(1080,600),
    [ {type:"wall",x:500,y:300,w:400,h:24}, {type:"wall",x:1080,y:680,w:260,h:30}, {type:"goal",x:1080,y:600} ],
    [ {type:"ball",x:340,y:250,tag:"ball"} ],
    [ {type:"domino",count:4} ], {parts:4}),

  lvl("official-08","Switchbacks", goalAt(1100,640),
    [ {type:"wall",x:500,y:280,w:30,h:200}, {type:"wall",x:760,y:460,w:30,h:200}, {type:"wall",x:1100,y:700,w:260,h:30}, {type:"goal",x:1100,y:640} ],
    [ {type:"ball",x:200,y:100,tag:"ball"} ],
    [ {type:"ramp",count:3} ], {parts:3}),

  lvl("official-09","Catch & Drop", goalAt(220,600),
    [ {type:"wall",x:220,y:680,w:260,h:30}, {type:"bucket",x:640,y:560}, {type:"goal",x:220,y:600} ],
    [ {type:"ball",x:1080,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1},{type:"conveyor",count:1},{type:"seesaw",count:1} ], {parts:3}),

  lvl("official-10","Grand Contraption", goalAt(1120,600),
    [ {type:"wall",x:1120,y:680,w:280,h:30}, {type:"wall",x:520,y:520,w:30,h:300}, {type:"goal",x:1120,y:600} ],
    [ {type:"ball",x:140,y:80,tag:"ball"} ],
    [ {type:"ramp",count:2},{type:"conveyor",count:1},{type:"seesaw",count:1},{type:"fan",count:1} ], {parts:5}),
];
