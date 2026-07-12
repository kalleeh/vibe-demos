// Versioned level schema, validation, serialization, and world builder.
//
// Goal-zone convention:
//   level.goal.zone is {x,y,w,h} with x,y = CENTER (consistent with part placement).
//   buildWorld() returns goalZone as TOP-LEFT {x,y,w,h} for aabbOverlap.

import { PARTS, makePart } from "./parts.js";

export const SCHEMA_VERSION = 1;
const SUPPORTED_GOALS = ["dwell"];

export function validateLevel(level) {
  if (!level || typeof level !== "object") return { ok:false, reason:"not an object" };
  if (level.schema !== SCHEMA_VERSION) return { ok:false, reason:`schema ${level.schema} != ${SCHEMA_VERSION}` };
  if (!level.world || !level.goal || !Array.isArray(level.inventory)) return { ok:false, reason:"missing world/goal/inventory" };
  if (!SUPPORTED_GOALS.includes(level.goal.type)) return { ok:false, reason:`unsupported goal ${level.goal.type}` };
  const z = level.goal.zone;
  if (!z || typeof z.x !== "number" || typeof z.y !== "number" || typeof z.w !== "number" || typeof z.h !== "number") {
    return { ok:false, reason:"goal.zone missing or invalid" };
  }
  for (const grp of ["fixed","start"]) {
    for (const e of (level[grp]||[])) {
      if (!PARTS[e.type]) return { ok:false, reason:`unknown part type ${e.type}` };
    }
  }
  for (const inv of level.inventory) if (!PARTS[inv.type]) return { ok:false, reason:`unknown inventory type ${inv.type}` };
  // link integrity for paired parts
  const all = [...(level.fixed||[]), ...(level.start||[])];
  const portals = all.filter(e => e.type === "portal");
  for (const p of portals) {
    const partners = portals.filter(o => o !== p && o.link === p.link);
    if (partners.length !== 1) return { ok:false, reason:`portal link "${p.link}" needs exactly one partner` };
  }
  const gateIds = new Set(all.filter(e => e.type === "gate").map(e => e.id));
  for (const b of all.filter(e => e.type === "button")) {
    if (!gateIds.has(b.gate)) return { ok:false, reason:`button references missing gate "${b.gate}"` };
  }
  return { ok:true };
}

export const cloneLevel = (level) => structuredClone(level);

export function serializeLevel(level) {
  // stable key order for deterministic round-trip
  const order = ["schema","id","title","author","world","goal","fixed","start","inventory","par"];
  const ordered = {};
  for (const k of order) if (k in level) ordered[k] = level[k];
  return JSON.stringify(ordered);
}

export function buildWorld(level, M) {
  const engine = M.Engine.create();
  engine.gravity.y = level.world.gravity ?? 1;
  const world = engine.world;
  const W = level.world.w, H = level.world.h, t = 60;
  // No floor: a missed shot falls out of the world and the level is lost (Sim.step
  // culls anything past H, matching the original design — a bottomless drop, not a
  // safety net that catches every miss). Left/right/top stay solid so parts can't
  // fly off in build mode or get shoved out sideways by forces.
  const walls = [
    M.Bodies.rectangle(W/2, -t/2, W, t, { isStatic:true }),
    M.Bodies.rectangle(-t/2, H/2, t, H, { isStatic:true }),
    M.Bodies.rectangle(W + t/2, H/2, t, H, { isStatic:true }),
  ];
  walls.forEach(b => b.plugin = { partType:"boundary", tag:null });
  M.Composite.add(world, walls);

  const bodies = [...walls];
  for (const grp of ["fixed","start"]) {
    for (const spec of (level[grp]||[])) {
      const { bodies: bs, constraints } = makePart(spec.type, spec);
      M.Composite.add(world, bs);
      if (constraints.length) M.Composite.add(world, constraints);
      bodies.push(...bs);
    }
  }
  const z = level.goal.zone;
  const goalZone = { x: z.x - z.w/2, y: z.y - z.h/2, w: z.w, h: z.h };
  return { engine, world, bodies, goalZone };
}
