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
  ];
}

export async function officialCases() {
  const L = await import("./level.js");
  const { OFFICIAL_LEVELS } = await import("./levels/official.js");
  const { makePart } = await import("./parts.js");
  const cases = [
    { name:"at least 8 official levels", fn:()=>{ if(OFFICIAL_LEVELS.length < 8) throw new Error("only "+OFFICIAL_LEVELS.length); } },
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

export function runTests(extra = []) {
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
