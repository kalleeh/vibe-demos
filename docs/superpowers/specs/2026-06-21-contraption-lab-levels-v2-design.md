# Contraption Lab — 20 Distinct Levels + New-Physics Parts design

**Date:** 2026-06-21
**Slug:** `contraption-lab`
**Builds on:** the shipped game (Phases 1–3 + sprites + editor). Replaces the current 14 official levels (which share one sloped-floor template) with 20 distinct, difficulty-arced levels, and adds ~9 new parts with unique interactions.

## Problem

All 14 current official levels are near-identical: one tilted floor wall + a catch wall + a goal pocket at (1040,560), differing only in the inventory handed to the player. This reads as "the same map 14 times." Fix: 20 genuinely distinct layouts on a difficulty arc, each themed around a different **star mechanic**, supported by new parts with behaviors the current 23 don't have.

## Decisions (locked in brainstorming)

- **20 levels**, difficulty-arced; the current 14 are replaced (not appended).
- **Win stays "ball rests in goal zone"** (`goal.type:"dwell"`, the tagged `ball` overlaps the zone ≥ `ms`). No new win types — keeps win-detection simple; variety comes from layout + mechanics.
- **~9 new parts** across 4 families, each Matter.js-feasible and the theme of ≥1 level:
  - **Force/field:** `magnet` (radial pull within range), `accelerator` (directional velocity kick on contact), `vortex` (strong radial pull, like a black hole).
  - **Surface:** `ice` (near-zero friction), `sticky` (very high friction, stops motion), `bumper` (high restitution, ricochets).
  - **Teleport:** `portal` A↔B pair (a ball entering one exits the other carrying velocity; cooldown prevents ping-pong).
  - **Switch logic:** `button` (pressure plate) + `gate` (barrier that opens when its linked button is pressed).
- **SD3.5 sprites** for every new part (same pipeline as the existing 23), so the roster stays visually consistent. Vector fallback still applies if a PNG is missing.
- **Solvability is the ship gate:** every one of the 20 must be proven winnable by the headless Matter.js sweep with a documented solution; new parts must not destabilize the sim.

## New parts — engine behavior (extends existing patterns)

`parts.js` registry entries + per-tick logic in `engine.js`. The engine already has `_applyForces()` (fan/balloon/conveyor) and a `step()` loop; new effects slot in there, each wrapped in try/catch so a misfire can never throw into the rAF loop (the established Track-C rule). None may alter the win/dwell logic.

- **magnet** (static): each tick, for dynamic bodies within `range`, apply a force toward the magnet center scaled by `strength` (mirror of the fan's outward push). `polarity:+1` pull / `-1` push.
- **accelerator** (static pad): on contact (within a thin band, like conveyor), set the body's velocity along the pad's `angle` to `boost` (a one-shot kick, capped).
- **vortex** (static): like magnet but stronger and shorter-range, with a slight tangential component for a "swirl" read; capped so it can't fling to NaN.
- **ice** (static surface): a platform/plank with `friction≈0.01, frictionStatic≈0` — the ball slides.
- **sticky** (static surface): `friction≈1, frictionStatic≈1, restitution:0` — the ball halts on contact.
- **bumper** (static circle): `restitution≈1.4` (capped via velocity clamp) — ricochets the ball.
- **portal** (sensor pair): two parts sharing a `link` id. Each tick, if the tagged dynamic body overlaps portal-A and a per-body cooldown has elapsed, set its position to portal-B (offset outside B's radius along its exit `angle`) preserving velocity, and start the cooldown (≈400ms) to stop immediate re-entry. Pure helper `portalExit(bodyPos, A, B)` computes the exit transform (testable).
- **button + gate**: `button` is a static sensor plate with a `gate` link id; `gate` is a static barrier body. Each tick, if any dynamic body overlaps the button's plate zone, the linked gate becomes a sensor (passable) or retracts (move off-screen); else it's solid. Pure helper `gateOpen(buttonZone, bodies)` → bool (testable).

**Velocity safety:** accelerator/bumper/vortex outputs are clamped to a max speed so no part can produce NaN/explosive velocities; out-of-bounds bodies are still culled (existing).

## Level format additions (additive, schema stays 1)

New parts carry their config as ordinary spec fields (the format already passes arbitrary fields through `serializeLevel`/`buildWorld`):
- `magnet`/`vortex`: `{strength, range, polarity}`. `accelerator`: `{angle, boost}`.
- `portal`: `{link:"p1", angle}` — two parts with the same `link` are paired. `validateLevel` adds a check: a `portal` part requires exactly one matching partner with the same `link`.
- `button`: `{gate:"g1"}`; `gate`: `{id:"g1"}`. `validateLevel` checks a `button`'s `gate` references an existing `gate` `id`.

`validateLevel` gains these link-integrity checks so a malformed community/official level fails gracefully rather than running a broken sim.

## The 20 levels — difficulty arc (each themed on a star mechanic)

Layouts vary the scenery, not just the inventory: pits, stacked ledges, vertical shafts, mazes, mirrored goals, multi-zone. Exact coordinates are tuned during the build until the solver finds a solution; the THEME and intended path are fixed here.

- **Band A — teach one mechanic (L1–5, 1–2 parts):** 1 First Drop (ramp), 2 Bounce (bumper), 3 Slippery (ice slope), 4 Fan Lift (fan+balloon), 5 Magnet (magnet pulls ball across a gap).
- **Band B — combine two (L6–12):** 6 Conveyor Run, 7 Seesaw Launch (seesaw+weight), 8 Accelerator Gap (boost pad over a pit), 9 Portal Hop (portal pair across a wall), 10 Sticky Stop (ice→sticky landing), 11 Domino Cascade, 12 Vortex (vortex redirects a falling ball).
- **Band C — multi-step chains (L13–18):** 13 Button & Gate (press a plate to open the path), 14 Pinwheel Relay, 15 Trampoline Tower (stacked trampolines), 16 Gear Drive, 17 Two-Portal Maze, 18 Magnet + Accelerator combo.
- **Band D — fiendish (L19–20):** 19 The Gauntlet (portal + button/gate + accelerator), 20 Grand Contraption v2 (a long Rube-Goldberg chain using ≥5 distinct mechanics).

Each level: a `dwell` goal, a tagged `ball` start, distinct `fixed` scenery, an inventory chosen so a real solution exists, ascending `par`.

## Architecture / files

```
contraption-lab/
├── js/parts.js          ← +9 new part definitions (+PALETTE_TYPES)
├── js/engine.js         ← +per-tick logic: magnet/vortex/accelerator force, portal teleport, button/gate; all try-wrapped
├── js/level.js          ← +link-integrity validation (portal pairs, button→gate)
├── js/sprites.js        ← +9 registry entries (fit modes)
├── js/levels/official.js← REWRITTEN: 20 levels (replaces 14)
├── js/level.test.js     ← + new-part build cases, portal/gate pure-helper cases, "20 levels validate + unique" cases
├── assets/parts/*.png   ← +9 new SD3.5 sprites
└── sw.js                ← cache the 9 new PNGs, bump version
```

## Error handling / resilience

- Every new per-tick effect is try/catch-wrapped (a bad part can't break the loop); velocity clamping prevents explosions; 30s max-run + out-of-bounds cull still apply.
- A new part with a missing sprite → vector-polygon fallback (game still playable).
- A level with a broken link (portal without partner, button→missing gate) fails `validateLevel` → the existing "needs a newer version / invalid" card, never a crash.
- Portals/buttons must never affect the `dwell` win check (only the ball's position/velocity, which the win check already reads).

## Testing

- **Pure `?test`:** each new part builds via `makePart` without throwing; `portalExit` and `gateOpen` helpers; `validateLevel` rejects broken portal/gate links; the 20 levels all `validateLevel`-pass with unique ids and non-empty inventories.
- **Solvability sweep (the gate):** a headless harness places each level's documented solution and confirms `Sim` reaches `"won"` within the time limit — for ALL 20. New-physics parts especially: prove the intended path actually works; tune coordinates until it does. Also assert no NaN positions and that an empty placement ends `"lost"` not hung.
- **Real-browser QA (Playwright):** load a sampling of levels across the difficulty arc and all 4 themes; place→run→win on at least L1, a mid, and L20; sprites render on the new parts; 0 console/page errors; phone-viewport check (taps work — the recent touch fix).
- Deploy → live verify a level loads + solves, 0 errors.

## Build phases (for the plan)

1. **New parts + engine + sprites + validation** (the foundation; verified by part-build tests + a couple of hand-authored sanity levels per mechanic, each solver-verified).
2. **The 20 levels** authored in difficulty bands, each solver-verified as written.
3. **Integration + full verification + ship** (all-20 sweep, browser QA across themes, SW bump, docs, deploy, live verify).

## Out of scope

- New win-condition types (objective stays ball-to-goal).
- Editor UI for the new parts beyond their appearing in the palette (they work in the editor automatically via the registry).
- Animated/multi-frame sprites for the new parts (static sprite + existing spin where apt).
