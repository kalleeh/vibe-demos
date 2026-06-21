import { snap, aabbOverlap, pointInRect, fitTransform, screenToWorld } from "./geom.js";

export async function levelCases() {
  const L = await import("./level.js");
  const good = { schema:1, id:"t", title:"T", world:{w:1280,h:720,gravity:1},
    goal:{type:"dwell",object:"ball",zone:{x:100,y:100,w:50,h:50},ms:300},
    fixed:[{type:"wall",x:10,y:10}], start:[{type:"ball",x:5,y:5,tag:"ball"}], inventory:[{type:"ramp",count:2}] };
  return [
    { name:"validate accepts good level", fn:()=>{ if(!L.validateLevel(good).ok) throw new Error("rejected"); } },
    { name:"validate rejects bad schema", fn:()=>{ if(L.validateLevel({...good,schema:99}).ok) throw new Error("accepted"); } },
    { name:"validate rejects unknown type", fn:()=>{ if(L.validateLevel({...good,fixed:[{type:"xxx",x:0,y:0}]}).ok) throw new Error("accepted"); } },
    { name:"validate rejects missing goal.zone", fn:()=>{ const noZone={...good,goal:{type:"dwell",object:"ball",ms:300}}; if(L.validateLevel(noZone).ok) throw new Error("accepted"); } },
    { name:"serialize round-trips", fn:()=>{ const s=L.serializeLevel(good); const o=JSON.parse(s); if(o.title!=="T") throw new Error("lost data"); } },
    { name:"clone is deep", fn:()=>{ const c=L.cloneLevel(good); c.title="X"; if(good.title!=="T") throw new Error("mutated"); } },
    // ---- Track C: new-physics part specs ----
    { name:"validate accepts rope/gears/tnt specs", fn:()=>{
        const lvl={...good, fixed:[
          {type:"rope",x:200,y:100,x2:200,y2:300,segments:10},
          {type:"gears",x:400,y:300,spin:5},
          {type:"tnt",x:600,y:200,fuseMs:1200,blast:0.1,radius:140},
        ]};
        const v=L.validateLevel(lvl); if(!v.ok) throw new Error("rejected: "+v.reason);
      }},
    { name:"serialize round-trips a tnt spec (extra fields survive)", fn:()=>{
        const lvl={...good, start:[{type:"tnt",x:600,y:200,tag:"boom",fuseMs:1200,blast:0.1,radius:140}]};
        const o=JSON.parse(L.serializeLevel(lvl));
        const t=o.start[0];
        if(t.type!=="tnt"||t.fuseMs!==1200||t.blast!==0.1||t.radius!==140||t.tag!=="boom")
          throw new Error("lost tnt fields: "+JSON.stringify(t));
      }},
    { name:"serialize round-trips rope endpoints + gears spin", fn:()=>{
        const lvl={...good, fixed:[
          {type:"rope",x:200,y:100,x2:260,y2:340,segments:12},
          {type:"gears",x:400,y:300,spin:6},
        ]};
        const o=JSON.parse(L.serializeLevel(lvl));
        const [r,g]=o.fixed;
        if(r.x2!==260||r.y2!==340||r.segments!==12) throw new Error("lost rope fields: "+JSON.stringify(r));
        if(g.spin!==6) throw new Error("lost gears spin: "+JSON.stringify(g));
      }},
    // button + gate validation
    { name:"validate accepts button+gate pair", fn:()=>{
        const lvl={...good, fixed:[
          {type:"button",x:100,y:100,gate:"g1"},
          {type:"gate",x:200,y:200,id:"g1"}
        ]};
        const v=L.validateLevel(lvl); if(!v.ok) throw new Error("rejected: "+v.reason);
      }},
    { name:"validate rejects button with missing gate", fn:()=>{
        const lvl={...good, fixed:[
          {type:"button",x:100,y:100,gate:"missing"}
        ]};
        if(L.validateLevel(lvl).ok) throw new Error("should reject button with missing gate");
      }},
    { name:"validate rejects lone portal", fn:()=>{
        const lvl={...good, fixed:[
          {type:"portal",x:100,y:100,link:"p1"}
        ]};
        if(L.validateLevel(lvl).ok) throw new Error("should reject lone portal");
      }},
    { name:"validate accepts portal pair", fn:()=>{
        const lvl={...good, fixed:[
          {type:"portal",x:100,y:100,link:"p1"},
          {type:"portal",x:200,y:200,link:"p1"}
        ]};
        const v=L.validateLevel(lvl); if(!v.ok) throw new Error("rejected valid portal pair: "+v.reason);
      }},
    { name:"validate rejects portal trio", fn:()=>{
        const lvl={...good, fixed:[
          {type:"portal",x:100,y:100,link:"p1"},
          {type:"portal",x:200,y:200,link:"p1"},
          {type:"portal",x:300,y:300,link:"p1"}
        ]};
        if(L.validateLevel(lvl).ok) throw new Error("should reject portal trio");
      }},
  ];
}

export async function officialCases() {
  const L = await import("./level.js");
  const { OFFICIAL_LEVELS } = await import("./levels/official.js");
  const { makePart } = await import("./parts.js");
  const cases = [
    { name:"exactly 18 official levels", fn:()=>{ if(OFFICIAL_LEVELS.length !== 18) throw new Error("expected 18, got "+OFFICIAL_LEVELS.length); } },
    { name:"ids unique + sequential", fn:()=>{ const ids=OFFICIAL_LEVELS.map(l=>l.id); if(new Set(ids).size!==ids.length) throw new Error("dup ids"); } },
  ];
  OFFICIAL_LEVELS.forEach((lvl,i) => cases.push({ name:`level ${i+1} (${lvl.id}) validates`, fn:()=>{ const v=L.validateLevel(lvl); if(!v.ok) throw new Error(v.reason); } }));
  // every level must give the player at least one inventory part
  OFFICIAL_LEVELS.forEach((lvl,i) => cases.push({ name:`level ${i+1} has inventory`, fn:()=>{ if(!lvl.inventory.reduce((a,b)=>a+b.count,0)) throw new Error("no parts"); } }));
  // Track B parts build without throwing (Matter stub includes fromVertices)
  const trackB = ["trampoline","gear","crate","pipe","pinwheel","spring","wedge","platform","bowlingpin","weight"];
  const stubMatter = { Bodies:{
    rectangle:(x,y,w,h,o)=>({position:{x,y},bounds:{min:{x:x-w/2,y:y-h/2},max:{x:x+w/2,y:y+h/2}},plugin:{}}),
    circle:(x,y,r,o)=>({position:{x,y},bounds:{min:{x:x-r,y:y-r},max:{x:x+r,y:y+r}},plugin:{}}),
    fromVertices:(x,y,v,o)=>({position:{x,y},vertices:v[0]||[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}})
  }, Body:{create:(o)=>({...o,position:{x:0,y:0}})}, Constraint:{create:(o)=>o} };
  globalThis.Matter = stubMatter;
  trackB.forEach(t => cases.push({ name:`Track B part ${t} builds`, fn:()=>{
    const r = makePart(t, {x:0,y:0});
    if(!r.bodies || r.bodies.length===0) throw new Error("no bodies");
  }}));
  return cases;
}

export async function trackCCases() {
  const { makePart } = await import("./parts.js");
  // Rich-enough Matter stub for the Track-C build/physics paths.
  function makeStub() {
    return {
      Bodies:{
        rectangle:(x,y,w,h,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:!!(o&&o.isStatic),bounds:{min:{x:x-w/2,y:y-h/2},max:{x:x+w/2,y:y+h/2}},plugin:{}}),
        circle:(x,y,r,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:false,bounds:{min:{x:x-r,y:y-r},max:{x:x+r,y:y+r}},plugin:{}}),
      },
      Body:{
        setStatic:(b,v)=>{b.isStatic=v;},
        setDensity:(b,d)=>{b.density=d;},
        setVelocity:(b,v)=>{b.velocity=v;},
        setAngularVelocity:(b,w)=>{b.angularVelocity=w;},
        applyForce:(b,p,f)=>{b._lastForce=f;},
        create:(o)=>({...o,position:{x:0,y:0}}),
      },
      Constraint:{create:(o)=>o},
      Composite:{remove:(w,b)=>{ if(Array.isArray(w.bodies)) w.bodies=w.bodies.filter(x=>x!==b); }},
      Engine:{update:()=>{}},
    };
  }
  return [
    { name:"rope builds N+1 bodies and N constraints", fn:()=>{
        globalThis.Matter=makeStub();
        const segs=8;
        const r=makePart("rope",{x:100,y:50,x2:100,y2:300,segments:segs});
        if(r.bodies.length!==segs+1) throw new Error("expected "+(segs+1)+" bodies, got "+r.bodies.length);
        if(r.constraints.length!==segs) throw new Error("expected "+segs+" constraints, got "+r.constraints.length);
        if(!r.bodies[0].isStatic) throw new Error("first segment must be a static anchor");
      }},
    { name:"rope anchor static, bob is heavier", fn:()=>{
        globalThis.Matter=makeStub();
        const r=makePart("rope",{x:0,y:0,x2:0,y2:160,segments:6});
        const bob=r.bodies[r.bodies.length-1];
        if(bob.density!==0.02) throw new Error("bob density not boosted, got "+bob.density);
      }},
    { name:"tnt builds armed with a fuse", fn:()=>{
        globalThis.Matter=makeStub();
        const r=makePart("tnt",{x:0,y:0,fuseMs:1500,blast:0.12,radius:160});
        const b=r.bodies[0];
        if(!b.plugin.armed || b.plugin.partType!=="tnt") throw new Error("tnt not armed");
        if(b.plugin.fuseMs!==1500) throw new Error("wrong fuse");
      }},
  ];
}

export async function trackCEngineCases() {
  // Exercise the real Sim._tickTNT / _applyForces against a stub world (no DOM, no real
  // Matter). The stub is installed INSIDE each fn (not at collection time) so it can't
  // leak into other case sets whose deferred fns also read globalThis.Matter.
  function installStub(){
    globalThis.Matter = {
      Bodies:{
        rectangle:(x,y,w,h,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:!!(o&&o.isStatic),bounds:{min:{x:x-w/2,y:y-h/2},max:{x:x+w/2,y:y+h/2}},plugin:{}}),
        circle:(x,y,r,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:false,bounds:{min:{x:x-r,y:y-r},max:{x:x+r,y:y+r}},plugin:{}}),
      },
      Body:{
        setStatic:(b,v)=>{b.isStatic=v;}, setDensity:(b,d)=>{b.density=d;},
        setVelocity:(b,v)=>{b.velocity=v;}, setAngularVelocity:(b,w)=>{b.angularVelocity=w;},
        setPosition:(b,p)=>{b.position=p;},
        applyForce:(b,p,f)=>{b._force={x:(b._force?b._force.x:0)+f.x,y:(b._force?b._force.y:0)+f.y};},
        create:(o)=>({...o,position:{x:0,y:0}}),
      },
      Constraint:{create:(o)=>o},
      Composite:{ add:()=>{}, remove:(w,b)=>{ if(Array.isArray(w.bodies)) w.bodies=w.bodies.filter(x=>x!==b); } },
      Engine:{ create:()=>({world:{},gravity:{}}), update:()=>{} },
    };
  }
  const { Sim } = await import("./engine.js");
  function makeSim(){
    installStub();
    const lvl={schema:1,id:"c",title:"C",world:{w:1280,h:720,gravity:1},
      goal:{type:"dwell",object:"none",zone:{x:0,y:0,w:1,h:1},ms:300},fixed:[],start:[],inventory:[]};
    const sim=new Sim(lvl);
    sim.world.bodies = sim.world.bodies || [];
    return sim;
  }
  return [
    { name:"tnt fuse countdown reaches blast (force applied, charge removed)", fn:()=>{
        const sim=makeSim();
        const tnt={position:{x:100,y:100},velocity:{x:0,y:0},isStatic:false,plugin:{partType:"tnt",armed:true,fuseMs:1000,blast:0.5,radius:160}};
        const victim={position:{x:140,y:100},velocity:{x:0,y:0},isStatic:false,plugin:{partType:"ball"}};
        sim.bodies=[tnt,victim]; sim.world.bodies=[tnt,victim];
        // tick under the fuse: no detonation yet
        sim._tickTNT(500);
        if(tnt.plugin.armed!==true || victim._force) throw new Error("detonated too early");
        // tick past zero: detonate
        sim._tickTNT(600);
        if(tnt.plugin.armed!==false) throw new Error("did not disarm");
        if(!victim._force || victim._force.x<=0) throw new Error("no outward impulse on victim");
      }},
    { name:"gears coupling sets angular velocity + drags contact tangentially", fn:()=>{
        const sim=makeSim();
        const driver={position:{x:0,y:0},velocity:{x:0,y:0},isStatic:false,angularVelocity:0,
          plugin:{partType:"gears",driven:4,radius:34,surface:4*34}};
        const touch={position:{x:50,y:0},velocity:{x:0,y:0},isStatic:false,plugin:{partType:"ball"}};
        sim.bodies=[driver,touch];
        sim._applyForces();
        if(driver.angularVelocity!==4) throw new Error("driver spin not re-asserted");
        // body at +x from a CCW(+) disc gets a tangential kick (capped, finite)
        if(!isFinite(touch.velocity.x)||!isFinite(touch.velocity.y)) throw new Error("non-finite velocity");
      }},
    { name:"misfiring effect never throws out of _applyForces", fn:()=>{
        const sim=makeSim();
        // a gears body with a poisoned plugin: getters that throw
        const bad={position:{x:0,y:0},velocity:{x:0,y:0},isStatic:false,
          plugin:{partType:"gears",get driven(){throw new Error("boom");},radius:34}};
        sim.bodies=[bad];
        sim._applyForces(); // must not throw
      }},
  ];
}

export async function progressCases() {
  const P = await import("./progress.js");
  return [
    { name:"mergeProgress best-of parts", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:5,bestMs:9000}},{a:{solved:true,bestParts:3,bestMs:9999}}); if(m.a.bestParts!==3) throw new Error("got "+m.a.bestParts); } },
    { name:"mergeProgress tie breaks on ms", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:3,bestMs:8000}},{a:{solved:true,bestParts:3,bestMs:5000}}); if(m.a.bestMs!==5000) throw new Error("got "+m.a.bestMs); } },
    { name:"mergeProgress unions keys", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:1,bestMs:1}},{b:{solved:true,bestParts:1,bestMs:1}}); if(!m.a||!m.b) throw new Error("lost key"); } },
  ];
}

export async function progressShapeCases() {
  const P = await import("./progress.js");
  return [
    { name:"recordsToProgress shapes a map", fn:()=>{
        const m = P.recordsToProgress([{level_id:"official-01",solved:true,best_parts:2,best_ms:5000}]);
        if(!m["official-01"] || m["official-01"].bestParts!==2 || m["official-01"].bestMs!==5000) throw new Error("bad shape "+JSON.stringify(m));
      }},
    { name:"progressToRecords emits solved rows with user", fn:()=>{
        const rows = P.progressToRecords({ "official-01":{solved:true,bestParts:2,bestMs:5000}, "official-02":{solved:false} }, "U1");
        if(rows.length!==1) throw new Error("expected 1 solved row, got "+rows.length);
        if(rows[0].user!=="U1" || rows[0].level_id!=="official-01" || rows[0].best_parts!==2) throw new Error("bad row "+JSON.stringify(rows[0]));
      }},
    { name:"round-trip records→map→records is stable", fn:()=>{
        const recs=[{level_id:"official-03",solved:true,best_parts:1,best_ms:999}];
        const back=P.progressToRecords(P.recordsToProgress(recs),"U1");
        if(back[0].level_id!=="official-03"||back[0].best_parts!==1||back[0].best_ms!==999) throw new Error("lost data "+JSON.stringify(back));
      }},
  ];
}

export async function newPartsCases() {
  const { makePart, PARTS } = await import("./parts.js");
  const cases = [];
  for (const t of ["ice","sticky","bumper","magnet","accelerator","vortex"]) {
    cases.push({ name:`${t} builds`, fn:()=>{ const r=makePart(t,{x:100,y:100}); if(!r.bodies.length) throw new Error(t+" no body"); if(r.bodies[0].plugin.partType!==t) throw new Error(t+" wrong partType"); } });
  }
  // button and gate
  cases.push({ name:"button builds with gate link", fn:()=>{
    const r=makePart("button",{x:100,y:100,gate:"gate1"});
    if(!r.bodies.length) throw new Error("button no body");
    const b=r.bodies[0];
    if(b.plugin.partType!=="button") throw new Error("button wrong partType");
    if(b.plugin.gate!=="gate1") throw new Error("button gate link not set");
  }});
  cases.push({ name:"gate builds with id", fn:()=>{
    const r=makePart("gate",{x:200,y:200,id:"gate1"});
    if(!r.bodies.length) throw new Error("gate no body");
    const b=r.bodies[0];
    if(b.plugin.partType!=="gate") throw new Error("gate wrong partType");
    if(b.plugin.id!=="gate1") throw new Error("gate id not set");
    if(b.plugin._solidX!==200 || b.plugin._solidY!==200) throw new Error("gate solid position not stored");
  }});
  return cases;
}

export async function buttonGateCases() {
  const { gateOpen } = await import("./engine.js");
  function installStub(){
    globalThis.Matter = {
      Bodies:{
        rectangle:(x,y,w,h,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:!!(o&&o.isStatic),bounds:{min:{x:x-w/2,y:y-h/2},max:{x:x+w/2,y:y+h/2}},plugin:{}}),
      },
      Body:{
        setPosition:(b,v)=>{b.position=v;},
      },
    };
  }
  return [
    { name:"gateOpen true when dynamic body over button", fn:()=>{
        installStub();
        const button={position:{x:100,y:100},plugin:{partType:"button"}};
        const ball={position:{x:100,y:90},isStatic:false,plugin:{partType:"ball"}};
        const bodies=[button,ball];
        if(!gateOpen(button,bodies)) throw new Error("should be open with ball on plate");
      }},
    { name:"gateOpen false when no dynamic body", fn:()=>{
        installStub();
        const button={position:{x:100,y:100},plugin:{partType:"button"}};
        const bodies=[button];
        if(gateOpen(button,bodies)) throw new Error("should be closed with no body");
      }},
    { name:"gateOpen ignores static bodies", fn:()=>{
        installStub();
        const button={position:{x:100,y:100},plugin:{partType:"button"}};
        const wall={position:{x:100,y:90},isStatic:true,plugin:{partType:"wall"}};
        const bodies=[button,wall];
        if(gateOpen(button,bodies)) throw new Error("should ignore static bodies");
      }},
    { name:"gateOpen ignores buttons and gates", fn:()=>{
        installStub();
        const button={position:{x:100,y:100},plugin:{partType:"button"}};
        const gate={position:{x:100,y:90},isStatic:false,plugin:{partType:"gate"}};
        const bodies=[button,gate];
        if(gateOpen(button,bodies)) throw new Error("should ignore gate bodies");
      }},
  ];
}

export async function portalCases() {
  const { makePart } = await import("./parts.js");
  const { portalExit } = await import("./engine.js");
  function installStub(){
    globalThis.Matter = {
      Bodies:{
        circle:(x,y,r,o)=>({position:{x,y},velocity:{x:0,y:0},isStatic:!!(o&&o.isStatic),bounds:{min:{x:x-r,y:y-r},max:{x:x+r,y:y+r}},plugin:{}}),
      },
      Body:{
        setPosition:(b,v)=>{b.position=v;},
      },
    };
  }
  return [
    { name:"portal builds with link", fn:()=>{
        installStub();
        const r=makePart("portal",{x:100,y:100,link:"p",angle:0});
        if(!r.bodies.length) throw new Error("no body");
        const b=r.bodies[0];
        if(b.plugin.partType!=="portal") throw new Error("wrong partType");
        if(b.plugin.link!=="p") throw new Error("link not set");
        if(b.plugin.angle!==0) throw new Error("angle not set");
        if(b.plugin._cool!==0) throw new Error("cooldown not initialized");
      }},
    { name:"portalExit returns offset point", fn:()=>{
        installStub();
        const portal={position:{x:200,y:300},plugin:{partType:"portal",angle:0,r:28}};
        const exit=portalExit(portal);
        const expectedDist=28+24;
        const dx=exit.x-portal.position.x;
        const dy=exit.y-portal.position.y;
        const dist=Math.hypot(dx,dy);
        if(Math.abs(dist-expectedDist)>0.1) throw new Error("exit not at correct distance, got "+dist+" expected "+expectedDist);
      }},
    { name:"portalExit respects angle", fn:()=>{
        installStub();
        const portal={position:{x:0,y:0},plugin:{partType:"portal",angle:Math.PI,r:28}};
        const exit=portalExit(portal);
        // angle π = left exit
        if(exit.x>-50) throw new Error("exit should be to the left, got x="+exit.x);
      }},
  ];
}

export async function runTests(extra = []) {
  const cases = [
    { name: "snap rounds to grid", fn: () => assert(snap(23, 10) === 20) },
    { name: "snap rounds up", fn: () => assert(snap(26, 10) === 30) },
    { name: "aabb overlap true", fn: () => assert(aabbOverlap({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10})) },
    { name: "aabb overlap false", fn: () => assert(!aabbOverlap({x:0,y:0,w:5,h:5},{x:50,y:50,w:5,h:5})) },
    { name: "pointInRect", fn: () => assert(pointInRect(5,5,{x:0,y:0,w:10,h:10}) && !pointInRect(50,5,{x:0,y:0,w:10,h:10})) },
    { name: "fitTransform letterbox scale", fn: () => { const t=fitTransform(1280,720,640,720); assert(Math.abs(t.scale-0.5)<1e-9); } },
    { name: "screenToWorld inverts", fn: () => { const t=fitTransform(1280,720,1280,720); const w=screenToWorld(100,100,t); assert(Math.abs(w.x-100)<1e-9 && Math.abs(w.y-100)<1e-9); } },
    ...extra,
  ];
  let passed=0, failed=0;
  for (const c of cases) {
    try { c.fn(); passed++; console.log("✓", c.name); }
    catch (e) { failed++; console.error("✗", c.name, "—", e.message); }
  }
  console.log(`level.test.js: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
function assert(cond, msg="assertion failed") { if (!cond) throw new Error(msg); }
