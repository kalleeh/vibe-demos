// Headless solvability harness: loads the REAL engine (Matter UMD in Node) and confirms
// each official level reaches "won" with its documented solution. Committed so it survives.
// Usage: node tools/solve-verify.mjs           (verifies all levels w/ embedded solutions)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Matter = require("../vendor/matter.min.js");
const { Sim } = await import("../js/engine.js");
const { OFFICIAL_LEVELS } = await import("../js/levels/official.js");
const { DEMO_TRACK_D_LEVELS } = await import("../js/levels/demo-track-d.js");
const { validateLevel } = await import("../js/level.js");

// Documented winning solutions per level id: array of {type,x,y,angle?}
import { SOLUTIONS, DEMO_SOLUTIONS } from "./solutions.mjs";

export function verify(level, solution, maxSteps = 2000) {
  const sim = new Sim(level);
  for (const p of (solution || [])) {
    // addPlayerPart only takes (type,x,y,angle), but _spawn passes the full spec to makePart.
    // So we rebuild the spec with all fields from the solution, then use _spawn directly.
    const spec = { ...p, angle: p.angle || 0 };
    sim.placed.push(spec);
    sim._spawn(spec, true);
  }
  sim.run();
  const ball = sim.bodies.find(b => b.plugin && b.plugin.tag === (level.goal.object || "ball"));
  for (let i = 0; i < maxSteps; i++) {
    const s = sim.step(16.667);
    if (ball && (!isFinite(ball.position.x) || !isFinite(ball.position.y))) return { won:false, reason:"NaN position", step:i };
    if (s === "won") return { won:true, step:i };
    if (s === "lost") return { won:false, reason:"timeout", step:i };
  }
  return { won:false, reason:"maxsteps" };
}

let vok = 0, sok = 0;
for (const lvl of OFFICIAL_LEVELS) {
  const v = validateLevel(lvl); if (v.ok) vok++; else console.log("VALIDATE FAIL", lvl.id, v.reason);
  const sol = SOLUTIONS[lvl.id];
  const r = verify(lvl, sol);
  console.log(`${r.won ? "✓" : "✗"} ${lvl.id}  won=${r.won} step=${r.step ?? "-"}${r.reason ? " ("+r.reason+")" : ""}`);
  if (r.won) sok++;
}
console.log(`\nVALIDATE ${vok}/${OFFICIAL_LEVELS.length} · SOLVABLE ${sok}/${OFFICIAL_LEVELS.length}`);

// Track D demo levels (one per new mechanic) — proof-of-mechanic, kept separate
// from the official 20-level arc so OFFICIAL_LEVELS.length stays exactly 20.
let dvok = 0, dsok = 0;
for (const lvl of DEMO_TRACK_D_LEVELS) {
  const v = validateLevel(lvl); if (v.ok) dvok++; else console.log("VALIDATE FAIL", lvl.id, v.reason);
  const sol = DEMO_SOLUTIONS[lvl.id];
  const r = verify(lvl, sol);
  console.log(`${r.won ? "✓" : "✗"} ${lvl.id}  won=${r.won} step=${r.step ?? "-"}${r.reason ? " ("+r.reason+")" : ""}`);
  if (r.won) dsok++;
}
console.log(`\nDEMO TRACK D — VALIDATE ${dvok}/${DEMO_TRACK_D_LEVELS.length} · SOLVABLE ${dsok}/${DEMO_TRACK_D_LEVELS.length}`);

const allOk = vok === OFFICIAL_LEVELS.length && sok === OFFICIAL_LEVELS.length
  && dvok === DEMO_TRACK_D_LEVELS.length && dsok === DEMO_TRACK_D_LEVELS.length;
process.exit(allOk ? 0 : 1);
