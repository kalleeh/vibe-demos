// Each build() returns {bodies, constraints}. All Matter bodies get
// plugin = { partType, tag }. Coordinates are world-space, x/y = center.
const cat = (M, partType, tag) => b => { b.plugin = { partType, tag: tag || null }; return b; };

export const PARTS = {
  ball: {
    label: "Ball", movable: false, fixedByDefault: false,
    // Low frictionAir + low surface friction so the ball actually ACCELERATES rolling down
    // a slope (Matter's defaults made it hit a low terminal speed and "never pick up speed").
    build: (s, M) => ({ bodies: [cat(M,"ball",s.tag)(M.Bodies.circle(s.x, s.y, s.r||18, { restitution:0.45, friction:0.02, frictionAir:0.002, density:0.004 }))], constraints: [] }),
  },
  wall: {
    label: "Wall", movable: true, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"wall",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||120, s.h||24, { isStatic:true, angle:s.angle||0, friction:0.4 }))], constraints: [] }),
  },
  ramp: {
    label: "Ramp", movable: true, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"ramp",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||160, s.h||16, { isStatic:true, angle:s.angle ?? -0.3, friction:0.3 }))], constraints: [] }),
  },
  domino: {
    label: "Domino", movable: true, fixedByDefault: false,
    build: (s, M) => ({ bodies: [cat(M,"domino",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||16, s.h||72, { density:0.006, friction:0.4, angle:s.angle||0 }))], constraints: [] }),
  },
  balloon: {
    label: "Balloon", movable: true, fixedByDefault: false,
    // negative-ish density + applied upward force handled by engine via plugin.lift
    build: (s, M) => { const b = M.Bodies.circle(s.x, s.y, s.r||22, { density:0.0009, frictionAir:0.04, restitution:0.2 }); b.plugin = { partType:"balloon", tag:s.tag||null, lift:0.0009 }; return { bodies:[b], constraints:[] }; },
  },
  bucket: {
    label: "Bucket", movable: true, fixedByDefault: false,
    build: (s, M) => {
      const w = s.w||90, h = s.h||70, t = 10;
      const parts = [
        M.Bodies.rectangle(s.x, s.y + h/2, w, t, {}),
        M.Bodies.rectangle(s.x - w/2, s.y, t, h, {}),
        M.Bodies.rectangle(s.x + w/2, s.y, t, h, {}),
      ];
      const body = M.Body.create({ parts, friction:0.4, density:0.003 });
      return { bodies: [cat(M,"bucket",s.tag)(body)], constraints: [] };
    },
  },
  fan: {
    label: "Fan", movable: true, fixedByDefault: true,
    // engine reads plugin.force each tick to push overlapping bodies along angle
    build: (s, M) => { const b = M.Bodies.rectangle(s.x, s.y, 54, 54, { isStatic:true, angle:s.angle||0 }); b.plugin = { partType:"fan", tag:s.tag||null, force:s.force||0.02, range:s.range||220 }; return { bodies:[b], constraints:[] }; },
  },
  conveyor: {
    label: "Conveyor", movable: true, fixedByDefault: true,
    // engine reads plugin.surfaceSpeed to set tangential velocity on contact
    build: (s, M) => { const b = M.Bodies.rectangle(s.x, s.y, s.w||160, 18, { isStatic:true, angle:s.angle||0, friction:0.9 }); b.plugin = { partType:"conveyor", tag:s.tag||null, surfaceSpeed:s.surfaceSpeed||3 }; return { bodies:[b], constraints:[] }; },
  },
  seesaw: {
    label: "Seesaw", movable: true, fixedByDefault: true,
    build: (s, M) => {
      const plank = cat(M,"seesaw",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||180, 16, { density:0.002, friction:0.4 }));
      const pivot = M.Constraint.create({ pointA:{x:s.x,y:s.y}, bodyB:plank, pointB:{x:0,y:0}, stiffness:1, length:0 });
      return { bodies:[plank], constraints:[pivot] };
    },
  },
  goal: {
    // visual-only target marker; the win zone is in level.goal, not a body
    label: "Goal", movable: false, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"goal",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||110, s.h||110, { isStatic:true, isSensor:true }))], constraints: [] }),
  },
  trampoline: { label:"Trampoline", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"trampoline",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||120,18,{isStatic:true,angle:s.angle||0,restitution:0.95,friction:0.2}))], constraints:[] }) },
  gear: { label:"Gear", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"gear",s.tag)(M.Bodies.circle(s.x,s.y,s.r||30,{density:0.01,friction:0.6,restitution:0.1}))], constraints:[] }) },
  crate: { label:"Crate", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"crate",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||56,s.h||56,{density:0.006,friction:0.5}))], constraints:[] }) },
  pipe: { label:"Pipe", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"pipe",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||160,16,{isStatic:true,angle:s.angle??0.5,friction:0.1}))], constraints:[] }) },
  pinwheel: { label:"Pinwheel", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const v=cat(M,"pinwheel",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||110,12,{density:0.002,friction:0.3}));
      const pivot=M.Constraint.create({pointA:{x:s.x,y:s.y},bodyB:v,pointB:{x:0,y:0},stiffness:1,length:0}); return {bodies:[v],constraints:[pivot]}; } },
  spring: { label:"Spring", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"spring",s.tag)(M.Bodies.rectangle(s.x,s.y,40,s.h||60,{isStatic:true,restitution:1.1,friction:0.2}))], constraints:[] }) },
  wedge: { label:"Wedge", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const w=s.w||80,h=s.h||80; const b=M.Bodies.fromVertices(s.x,s.y,[[{x:-w/2,y:h/2},{x:w/2,y:h/2},{x:w/2,y:-h/2}]],{isStatic:true,angle:s.angle||0,friction:0.3});
      return { bodies:[cat(M,"wedge",s.tag)(b)], constraints:[] }; } },
  platform: { label:"Platform", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"platform",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||200,18,{isStatic:true,angle:s.angle||0,friction:0.6}))], constraints:[] }) },
  bowlingpin: { label:"Pin", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"bowlingpin",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||22,s.h||66,{density:0.002,friction:0.4}))], constraints:[] }) },
  weight: { label:"Weight", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"weight",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||50,s.h||50,{density:0.03,friction:0.6}))], constraints:[] }) },
  // ---- Track C: new physics ----
  rope: { label:"Rope", movable:false, fixedByDefault:true,
    build:(s,M)=>{
      const segs=s.segments||8, x2=s.x2??s.x, y2=s.y2??(s.y+160);
      const bodies=[], constraints=[];
      let prev=null;
      for(let i=0;i<=segs;i++){
        const t=i/segs, x=s.x+(x2-s.x)*t, y=s.y+(y2-s.y)*t;
        const link=cat(M,"rope",s.tag)(M.Bodies.circle(x,y,5,{density:0.004,frictionAir:0.02}));
        if(i===0) M.Body.setStatic(link,true);            // anchor
        if(i===segs) M.Body.setDensity(link,0.02);         // heavy bob
        bodies.push(link);
        if(prev) constraints.push(M.Constraint.create({bodyA:prev,bodyB:link,stiffness:0.9,length:Math.hypot(x2-s.x,y2-s.y)/segs}));
        prev=link;
      }
      return {bodies,constraints};
    } },
  gears: { label:"Gears", movable:true, fixedByDefault:false,
    // Two discs each pinned at its center by a constraint; dynamic so they actually rotate.
    // The driver carries plugin.spin (rad/s) which the engine re-asserts each tick
    // (Body.setAngularVelocity) and uses to drag contacting bodies tangentially.
    build:(s,M)=>{
      const r=s.r||34, spin=s.spin??4, gap=r*2+6;
      const driver=M.Bodies.circle(s.x,s.y,r,{friction:0.9,density:0.02});
      const follower=M.Bodies.circle(s.x+gap,s.y,r,{friction:0.9,density:0.02});
      driver.plugin={partType:"gears",tag:s.tag||null,spin,driven:spin,role:"driver",radius:r,surface:Math.abs(spin)*r};
      follower.plugin={partType:"gears",tag:s.tag||null,spin:-spin,driven:-spin,role:"follower",radius:r,surface:Math.abs(spin)*r};
      const pin=(b,x)=>M.Constraint.create({pointA:{x,y:s.y},bodyB:b,pointB:{x:0,y:0},stiffness:1,length:0});
      return {bodies:[driver,follower],constraints:[pin(driver,s.x),pin(follower,s.x+gap)]};
    } },
  tnt: { label:"TNT", movable:true, fixedByDefault:false,
    build:(s,M)=>{
      const b=cat(M,"tnt",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||40,s.h||40,{density:0.006,friction:0.5}));
      b.plugin={partType:"tnt",tag:s.tag||null,fuseMs:s.fuseMs??1500,blast:s.blast??0.12,radius:s.radius??160,armed:true};
      return {bodies:[b],constraints:[]};
    } },
  ice: { label:"Ice", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"ice",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||160,16,{isStatic:true,angle:s.angle||0,friction:0.005,frictionStatic:0,restitution:0}))], constraints:[] }) },
  sticky: { label:"Sticky", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"sticky",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||120,18,{isStatic:true,angle:s.angle||0,friction:1,frictionStatic:1,restitution:0}))], constraints:[] }) },
  bumper: { label:"Bumper", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"bumper",s.tag)(M.Bodies.circle(s.x,s.y,s.r||26,{isStatic:true,restitution:1.4,friction:0.1}))], constraints:[] }) },
  magnet: { label:"Magnet", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,44,44,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"magnet",tag:s.tag||null,strength:s.strength||0.015,range:s.range||260,polarity:s.polarity||1}; return {bodies:[b],constraints:[]}; } },
  accelerator: { label:"Booster", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const w=s.w||90; const b=M.Bodies.rectangle(s.x,s.y,w,16,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"accelerator",tag:s.tag||null,boost:s.boost||9,angle:s.angle||0,w}; return {bodies:[b],constraints:[]}; } },
  vortex: { label:"Vortex", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.circle(s.x,s.y,s.r||30,{isStatic:true,isSensor:true}); b.plugin={partType:"vortex",tag:s.tag||null,strength:s.strength||0.03,range:s.range||180}; return {bodies:[b],constraints:[]}; } },
  portal: { label:"Portal", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const r=s.r||28; const b=M.Bodies.circle(s.x,s.y,r,{isStatic:true,isSensor:true}); b.plugin={partType:"portal",tag:s.tag||null,link:s.link||"p",angle:s.angle||0,r,_cool:0}; return {bodies:[b],constraints:[]}; } },
  button: { label:"Button", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,s.w||70,14,{isStatic:true,isSensor:true}); b.plugin={partType:"button",tag:s.tag||null,gate:s.gate||"g"}; return {bodies:[b],constraints:[]}; } },
  gate: { label:"Gate", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,s.w||24,s.h||140,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"gate",tag:s.tag||null,id:s.id||"g",_solidX:s.x,_solidY:s.y,_retracted:false}; return {bodies:[b],constraints:[]}; } },
  // ---- Track D: saw, one-way gate, zipline, laser+mirror ----
  saw: { label:"Saw", movable:true, fixedByDefault:true,
    // A spinning blade — puzzle tool, not a ball hazard. Each tick the engine checks
    // an explicit allow-list of destructible part types (rope/domino/crate/
    // bowlingpin/tnt) within its radius and removes them; the ball, weight, gear,
    // pinwheel etc. are untouched by design.
    build:(s,M)=>{ const r=s.r||24; const b=M.Bodies.circle(s.x,s.y,r,{isStatic:true}); b.plugin={partType:"saw",tag:s.tag||null,spin:s.spin??8,r}; return {bodies:[b],constraints:[]}; } },
  oneway: { label:"One-Way", movable:true, fixedByDefault:true,
    // A thin sensor plate: bodies moving with the plate's facing direction pass
    // freely; bodies moving against it get their along-normal velocity zeroed each
    // tick they're inside the band (a soft stop, not a teleport-back).
    build:(s,M)=>{ const w=s.w||110; const b=M.Bodies.rectangle(s.x,s.y,w,16,{isStatic:true,angle:s.angle||0,isSensor:true}); b.plugin={partType:"oneway",tag:s.tag||null,angle:s.angle||0,w}; return {bodies:[b],constraints:[]}; } },
  zipline: { label:"Zipline", movable:false, fixedByDefault:true,
    // A basket that slides along the line between (x,y) and (x2,y2) — no slider
    // constraint in this Matter.js build, so the engine sets its position directly
    // each tick from a stored 0..1 progress value, advancing faster on steeper lines
    // (gravity component along the line's own slope) and dragging along whatever's
    // resting in its footprint.
    build:(s,M)=>{
      const w=s.w||70, h=s.h||34, t=8;
      const parts=[
        M.Bodies.rectangle(s.x, s.y+h/2, w, t, {}),
        M.Bodies.rectangle(s.x-w/2, s.y, t, h, {}),
        M.Bodies.rectangle(s.x+w/2, s.y, t, h, {}),
      ];
      const body=M.Body.create({parts, isStatic:true, friction:0.4});
      body.plugin={partType:"zipline",tag:s.tag||null,x1:s.x,y1:s.y,x2:s.x2??s.x,y2:s.y2??(s.y+240),t:0,speed:s.speed??0.15};
      return {bodies:[body],constraints:[]};
    } },
  laser: { label:"Laser", movable:true, fixedByDefault:true,
    // Casts a beam each tick that reflects off mirror parts and stops at the first
    // non-mirror dynamic body it hits; the linked gate opens exactly while the beam
    // is blocked by something (a trip-wire, not a target-aiming puzzle).
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,26,26,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"laser",tag:s.tag||null,angle:s.angle||0,gate:s.gate||"g",maxBounces:s.maxBounces??6,_blocked:false,_beamPoints:null}; return {bodies:[b],constraints:[]}; } },
  mirror: { label:"Mirror", movable:true, fixedByDefault:true,
    // Default angle 45° (like ramp's default tilt) so a tray-placed mirror is
    // immediately useful for redirecting a beam without needing a rotate gesture.
    build:(s,M)=>({ bodies:[cat(M,"mirror",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||140,14,{isStatic:true,angle:s.angle??Math.PI/4,friction:0.1}))], constraints:[] }) },
};

export const PALETTE_TYPES = ["ramp","wall","fan","conveyor","seesaw","balloon","domino","bucket","trampoline","gear","crate","pipe","pinwheel","spring","wedge","platform","bowlingpin","weight","rope","gears","tnt","ice","sticky","bumper","magnet","accelerator","vortex","portal","button","gate","saw","oneway","zipline","laser","mirror"];

export function makePart(type, spec) {
  const def = PARTS[type];
  if (!def) throw new Error("unknown part type: " + type);
  return def.build(spec, Matter);
}
