// Headless solvability harness: loads the REAL engine (Matter UMD in Node) and confirms
// each level reaches "won" with its documented solution, placed EXACTLY the way the
// play UI places parts. Committed so it survives. Exit 0 only if every pass is green.
//
// Usage: node tools/solve-verify.mjs
//
// Pass 1 — player path: every solution part goes through Sim.addPlayerPart(type,x,y,
//          angle) — the only call input.js makes — so nothing the UI can't set (custom
//          w/boost/strength/…) can sneak into a "solution". The solution must also
//          respect the level's inventory (types + counts) and sit on the 20px grid.
// Pass 2 — reachable rotation: each angle must be the part's DEFAULT angle plus a whole
//          number of ROTATE_STEP (15°) turns; the angle is rebuilt from that model
//          (default + k·step, snapped exactly as the UI snaps) and the level re-verified.
// Pass 3 — fixed timestep: the level is driven through Sim.advance(frameDt) at 8.333 /
//          16.667 / 33.333 ms frame times (120/60/30 fps). advance() always steps the
//          physics at STEP_MS, so all three must win.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
globalThis.Matter = require("../vendor/matter.min.js");
const { Sim, STEP_MS } = await import("../js/engine.js");
const { makePart } = await import("../js/parts.js");
const { ROTATE_STEP, snapAngle, PLACE_GRID } = await import("../js/geom.js");
const { OFFICIAL_LEVELS } = await import("../js/levels/official.js");
const { DEMO_TRACK_D_LEVELS } = await import("../js/levels/demo-track-d.js");
const { DEMO_TRACK_E_LEVELS } = await import("../js/levels/demo-track-e.js");
const { validateLevel } = await import("../js/level.js");
import { SOLUTIONS, DEMO_SOLUTIONS, DEMO_SOLUTIONS_E } from "./solutions.mjs";

// Same default-angle lookup input.js uses when a tray part is first placed.
function defaultAngleFor(type) {
  try { return makePart(type, { x: 0, y: 0 }).bodies[0].angle || 0; } catch { return 0; }
}

// Check the solution only uses inventory the level actually gives the player, sits on
// the UI's placement grid, and carries no fields the UI can't set.
function checkInventory(level, solution) {
  const left = {};
  for (const i of level.inventory) left[i.type] = (left[i.type] || 0) + i.count;
  for (const p of solution) {
    if (!(p.type in left)) return `uses ${p.type}, not in inventory`;
    if (--left[p.type] < 0) return `uses more ${p.type} than inventory allows`;
    if (p.x % PLACE_GRID !== 0 || p.y % PLACE_GRID !== 0) return `${p.type} at (${p.x},${p.y}) is off the ${PLACE_GRID}px placement grid`;
    const extra = Object.keys(p).filter(k => !["type", "x", "y", "angle"].includes(k));
    if (extra.length) return `${p.type} carries non-UI fields: ${extra.join(",")}`;
  }
  return null;
}

// Run a level with a solution placed through the real player path.
// frameDt: if given, drive via Sim.advance(frameDt) (the rAF path); else step(STEP_MS).
export function verify(level, solution, { frameDt = null, maxMs = 40000 } = {}) {
  const invErr = checkInventory(level, solution || []);
  if (invErr) return { won: false, reason: invErr };
  const sim = new Sim(level);
  for (const p of (solution || [])) sim.addPlayerPart(p.type, p.x, p.y, p.angle || 0);
  sim.run();
  const ball = sim.bodies.find(b => b.plugin && b.plugin.tag === (level.goal.object || "ball"));
  const dt = frameDt || STEP_MS;
  const maxFrames = Math.ceil(maxMs / dt);
  for (let i = 0; i < maxFrames; i++) {
    const s = frameDt ? sim.advance(frameDt) : sim.step(STEP_MS);
    if (ball && (!isFinite(ball.position.x) || !isFinite(ball.position.y))) return { won: false, reason: "NaN position", ms: Math.round(sim.elapsed) };
    if (s === "won") return { won: true, ms: Math.round(sim.elapsed) };
    if (s === "lost") return { won: false, reason: "timeout", ms: Math.round(sim.elapsed) };
  }
  return { won: false, reason: "maxframes" };
}

// Rebuild each angle the way the UI produces it: default angle + k rotate-steps.
// Returns {solution, error}: error if any angle is NOT a whole number of steps away.
function reachableSolution(solution) {
  const out = [];
  for (const p of (solution || [])) {
    const def = defaultAngleFor(p.type);
    const want = p.angle || 0;
    const k = Math.round((want - def) / ROTATE_STEP);
    if (Math.abs(def + k * ROTATE_STEP - want) > 1e-6) return { error: `${p.type} angle ${want.toFixed(4)} is not default(${def.toFixed(4)}) + n·15°` };
    let a = def;
    for (let i = 0; i < Math.abs(k); i++) a = snapAngle(a + Math.sign(k) * ROTATE_STEP); // exactly what ⟲/⟳ do
    out.push({ ...p, angle: a });
  }
  return { solution: out };
}

const FRAME_DTS = [1000 / 120, 1000 / 60, 1000 / 30];
let failures = 0;
const fail = (msg) => { failures++; console.log("  ✗ " + msg); };

function runBand(name, levels, solutions, { rotationPass = true } = {}) {
  console.log(`\n== ${name} (${levels.length} levels) ==`);
  for (const lvl of levels) {
    const v = validateLevel(lvl);
    if (!v.ok) { fail(`${lvl.id} VALIDATE: ${v.reason}`); continue; }
    const sol = solutions[lvl.id];
    if (!sol) { fail(`${lvl.id} has no documented solution`); continue; }

    // Pass 1: player path at the fixed step
    const r1 = verify(lvl, sol);
    if (!r1.won) { fail(`${lvl.id} pass1 player-path: ${r1.reason}`); continue; }

    // Pass 2: angles reachable from defaults via 15° rotate steps
    let r2 = { won: true, ms: r1.ms };
    if (rotationPass) {
      const rs = reachableSolution(sol);
      if (rs.error) { fail(`${lvl.id} pass2 rotation: ${rs.error}`); continue; }
      r2 = verify(lvl, rs.solution);
      if (!r2.won) { fail(`${lvl.id} pass2 rotation-rebuilt angles: ${r2.reason}`); continue; }
    }

    // Pass 3: frame-rate independence through Sim.advance
    const r3 = FRAME_DTS.map(dt => verify(lvl, sol, { frameDt: dt }));
    const bad = r3.findIndex(r => !r.won);
    if (bad >= 0) { fail(`${lvl.id} pass3 frameDt=${FRAME_DTS[bad].toFixed(3)}: ${r3[bad].reason}`); continue; }

    console.log(`  ✓ ${lvl.id.padEnd(18)} won in ${(r1.ms / 1000).toFixed(2)}s  (dt-variants: ${r3.map(r => (r.ms / 1000).toFixed(2) + "s").join(" / ")})`);
  }
}

runBand("OFFICIAL", OFFICIAL_LEVELS, SOLUTIONS);
runBand("LAB · Track D", DEMO_TRACK_D_LEVELS, DEMO_SOLUTIONS);
runBand("LAB · Track E", DEMO_TRACK_E_LEVELS, DEMO_SOLUTIONS_E);

if (OFFICIAL_LEVELS.length !== 20) fail(`expected exactly 20 official levels, got ${OFFICIAL_LEVELS.length}`);

console.log(failures === 0
  ? `\nALL GREEN — ${OFFICIAL_LEVELS.length} official + ${DEMO_TRACK_D_LEVELS.length + DEMO_TRACK_E_LEVELS.length} lab levels solvable via the player path, with reachable rotations, at 120/60/30 fps.`
  : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
