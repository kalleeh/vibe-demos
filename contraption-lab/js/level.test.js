import { snap, aabbOverlap, pointInRect, fitTransform, screenToWorld } from "./geom.js";

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
