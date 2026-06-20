#!/usr/bin/env node
// Headless test runner for editor.test.js

// Stub globalThis.Matter for Node (parts.js needs it)
globalThis.Matter = {
  Bodies: {
    rectangle: (x,y,w,h,o) => ({position:{x,y},bounds:{min:{x:x-w/2,y:y-h/2},max:{x:x+w/2,y:y+h/2}},plugin:{}}),
    circle: (x,y,r,o) => ({position:{x,y},bounds:{min:{x:x-r,y:y-r},max:{x:x+r,y:y+r}},plugin:{}}),
    fromVertices: (x,y,v,o) => ({position:{x,y},vertices:v[0]||[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}}),
  },
  Body: { create: (o) => ({...o,position:{x:0,y:0}}), setStatic: ()=>{}, setDensity: ()=>{} },
  Constraint: { create: (o) => o },
  Composite: { add: ()=>{}, remove: ()=>{} },
  Engine: { create: () => ({world:{},gravity:{}}), update: ()=>{} },
};

import { editorCases } from "./editor.test.js";

async function run() {
  console.log("Running editor tests...");
  const cases = await editorCases();
  let passed = 0, failed = 0;
  for (const c of cases) {
    try {
      c.fn();
      passed++;
      console.log("✓", c.name);
    } catch (e) {
      failed++;
      console.error("✗", c.name, "—", e.message);
    }
  }
  console.log(`\nEditor tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
