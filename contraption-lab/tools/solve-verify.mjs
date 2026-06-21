// Headless solvability harness: loads the REAL engine (Matter UMD in Node) and confirms
// each official level reaches "won" with its documented solution. Committed so it survives.
// Usage: node tools/solve-verify.mjs           (verifies all levels w/ embedded solutions)
import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Matter = require("../vendor/matter.min.js");
const { Sim } = await import("../js/engine.js");
const { OFFICIAL_LEVELS } = await import("../js/levels/official.js");
const { validateLevel } = await import("../js/level.js");

// Documented winning solutions per level id: array of {type,x,y,angle?}
import { SOLUTIONS } from "./solutions.mjs";

export function verify(level, solution, maxSteps = 2000) {
  const sim = new Sim(level);
  for (const p of (solution || [])) sim.addPlayerPart(p.type, p.x, p.y, p.angle || 0);
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
process.exit(vok === OFFICIAL_LEVELS.length && sok === OFFICIAL_LEVELS.length ? 0 : 1);
