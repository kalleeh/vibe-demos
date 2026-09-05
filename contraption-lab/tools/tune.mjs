// Manual tuning aid: node tools/tune.mjs <level.json> [solution.json] [maxSteps] [--trace]
// Places the solution through the SAME player path the UI and solve-verify.mjs use
// (Sim.addPlayerPart: type/x/y/angle only — part defaults for everything else).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Matter = require("../vendor/matter.min.js");
const { Sim, STEP_MS } = await import("../js/engine.js");
const fs = await import("fs");
const [levelPath, solPath, maxStepsArg] = process.argv.slice(2);
const level = JSON.parse(fs.readFileSync(levelPath, "utf8"));
const solution = solPath ? JSON.parse(fs.readFileSync(solPath, "utf8")) : [];
const maxSteps = Number(maxStepsArg) || 2000;
const trace = process.argv.includes("--trace");
const sim = new Sim(level);
for (const p of solution) sim.addPlayerPart(p.type, p.x, p.y, p.angle || 0);
sim.run();
const ball = sim.bodies.find(b => b.plugin && b.plugin.tag === (level.goal.object || "ball"));
for (let i = 0; i < maxSteps; i++) {
  const s = sim.step(STEP_MS);
  const b2 = sim.bodies.find(b => b.plugin && b.plugin.tag === (level.goal.object || "ball"));
  if (trace && i % 20 === 0 && b2) console.log(i, b2.position.x.toFixed(0), b2.position.y.toFixed(0), b2.velocity.x.toFixed(1), b2.velocity.y.toFixed(1));
  if (s === "won") { console.log("WON at step", i); process.exit(0); }
  if (s === "lost") { console.log("LOST at step", i); process.exit(1); }
}
console.log("MAXSTEPS reached");
process.exit(1);
