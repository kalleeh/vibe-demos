# Contraption Lab — design & maintenance contract

A modern *Incredible Machine*: place parts from a tray, press **Run**, and the Matter.js
physics (vendored, `vendor/matter.min.js`, no build step) decides whether the tagged ball
dwells in the goal zone long enough to win. This file is the maintenance contract for the
demo; **read it before touching levels, parts, or the engine.**

## Files

| Path | Role |
| --- | --- |
| `index.html`, `style.css` | Shell: top bar, objective strip, playfield, tray, Run/Reset, coach card, editor + browse screens |
| `js/main.js` | Play screen: routing (`#/play/<id>`, `#/editor`, `#/browse`), level menu bands, rAF loop (fixed-step via `Sim.advance`), Run/Reset, rotate controls + keys |
| `js/engine.js` | `Sim`: build/run/reset state machine, `addPlayerPart`, per-tick part effects, dwell win, `STEP_MS`, `TAP_RADIUS` |
| `js/parts.js` | `PARTS` registry (every part's `build()` + **defaults**), `PALETTE_TYPES` (the 42 tray-placeable types) |
| `js/level.js` | Schema v1, `validateLevel` (+ `LEVEL_LIMITS` payload caps), `buildWorld` |
| `js/levels/official.js` | The 20 official levels (`OFFICIAL_LEVELS`, asserted to be exactly 20) |
| `js/levels/demo-track-d.js`, `demo-track-e.js` | 9 "Lab" proof-of-mechanic levels, one per experimental part |
| `js/input.js` | `PlacementController`: tap-to-place, select, rotate (buttons/keys/twist), delete |
| `js/render.js`, `js/sprites.js`, `js/part-icons.js`, `js/fx.js`, `js/sound.js` | Render-only. Nothing here may affect physics |
| `js/editor.js`, `js/browse.js`, `js/cloud.js`, `js/auth-ui.js`, `js/progress.js` | Community editor, browse, optional PocketBase layer, local progress |
| `tools/solve-verify.mjs`, `tools/solutions.mjs` | **The solvability verifier** and the documented solution per level |
| `pb/pb_migrations/` | PocketBase schema (progress, level, rating, play). Deploy via root `sync-backends.sh` |
| `sw.js` | Offline shell service worker (bump `CACHE` on any shell change; add new modules to `SHELL`) |

## Parts (42 tray-placeable, `PALETTE_TYPES`)

`ball` (the goal object) and `goal` (visual marker; the win zone is `level.goal`) are in
`PARTS` but not placeable by players. The editor additionally exposes `ball`.

| Part | One line |
| --- | --- |
| ramp | Static tilted plank (default −15°); bridges gaps |
| wall | Static plank, friction 0.4; scenery/floors |
| fan | Pushes bodies within `range` along its facing (angle − 90°) |
| conveyor | Static belt; sets horizontal velocity of bodies resting on it (`surfaceSpeed` 3) |
| seesaw | Plank pinned at its center; tips under load |
| balloon | Light body with constant upward lift |
| domino | Tall thin dynamic block; topples |
| bucket | U-shaped dynamic compound |
| trampoline | Static pad, restitution 0.95 |
| gear | Heavy dynamic disc (obstacle/weight) |
| crate | Dynamic box |
| pipe | Static low-friction chute (default 30°) |
| pinwheel | Light plank pinned at center; spins when struck |
| spring | Static pad, restitution 1.1 |
| wedge | Static right-triangle deflector |
| platform | Static plank, friction 0.6 (a ball stalls on a flat one — tilt it) |
| bowlingpin | Light dynamic pin |
| weight | Dense dynamic block (tips seesaws) |
| rope | Chain of linked segments from a static anchor; cut by saw/scissors |
| gears | Driver + follower discs, pinned, auto-spin; drag contacting bodies along the rim (chaotic on a ball) |
| tnt | One-shot radial blast after `fuseMs` (1500) |
| ice | Static near-frictionless plank |
| sticky | Static high-friction, no-bounce plank |
| bumper | Static disc, restitution 1.4 (bounce angle is very sensitive to contact offset) |
| magnet | Pulls bodies within `range` toward it (`strength` 0.015) |
| accelerator ("Booster") | Static pad; anything in its capture band is kicked along its facing (`boost` 9) |
| vortex | Sensor; pulls + swirls bodies within `range` (`strength` 0.03) |
| portal | Sensor pair sharing `link`; teleports to the partner's exit point, 500 ms cooldown |
| button | Sensor pad; any dynamic body on it retracts the gate with matching `gate` id |
| gate | Static bar that retracts while its button/laser is triggered |
| saw | Static blade; destroys rope/domino/crate/bowlingpin/tnt within radius (never the ball) |
| oneway | Sensor plate; passes bodies one way, soft-stops them the other |
| zipline | Basket that rides a line between two anchors, carrying what's in it |
| laser | Casts a beam that reflects off mirrors; a dynamic body blocking it opens its gate |
| mirror | Static reflective plank (default 45°) |
| cheese | Static lure for the mouse |
| mouse | Walker that paces a ledge or homes toward cheese; presses buttons |
| outlet | Powers any motor within `range` |
| motor | Pinned disc; spins and drags like gears only while an outlet is in range |
| cannon | One-shot: after `fuseMs` kicks whatever rests in the barrel along its facing |
| vacuum | Fan's inverse: pulls bodies inside a cone toward it |
| scissors | One-shot: snips the nearest rope segment in range |

## Levels

* **Official arc — exactly 20** (`OFFICIAL_LEVELS`), shown in the level menu as bands
  *Basics* 1–5, *Mechanics* 6–12, *Chains* 13–18, *Finale* 19–20. `level.test.js` asserts
  the count; the "Next" button chains only within this arc.
* **Lab — 9** (`DEMO_TRACK_D_LEVELS` + `DEMO_TRACK_E_LEVELS`), menu band *Lab · experimental
  parts*, numbered L1–L9. One proof-of-mechanic level per Track D/E part. Not part of the arc.
* World is fixed 1280×720 for all shipped levels (`level.world.w/h` is still what the
  renderer/editor/browse use — never hardcode it).

## The solvability contract

`node tools/solve-verify.mjs` must exit 0 **after ANY change to a level, a part default,
or the engine.** It loads the real engine in Node and, for every official and lab level,
runs the documented solution from `tools/solutions.mjs` through three passes:

1. **Player path** — each solution part is placed with `Sim.addPlayerPart(type, x, y,
   angle)`, the *only* call the UI makes. Solutions may contain nothing else (no
   `w`/`boost`/`strength`…), must respect the level's inventory types and counts, and
   must sit on the 20 px placement grid (`geom.js PLACE_GRID`). The level must reach
   `won` within the 30 s run limit.
2. **Reachable rotation** — every angle must equal the part's default angle plus a whole
   number of 15° steps (`geom.js ROTATE_STEP`); the angle is rebuilt by applying that many
   ⟲/⟳ steps with the UI's own `snapAngle`, and the level is re-verified.
3. **Fixed timestep** — the level is driven through `Sim.advance(frameDt)` at 120, 60 and
   30 fps frame times; all three must win (and, being fixed-step, in the same sim time).

Solutions were chosen from grid sweeps that also win when nudged ±2 px, so they are
robust rather than knife-edge. Two design notes worth knowing: `official-11` (Domino
Cascade) also wins with zero parts placed, and `official-16`'s documented solution uses the
weight alone — the gears are optional style inventory.

## The fixed-timestep rule

Physics always steps at `STEP_MS` (1000/60). Never call `sim.step()` with a frame dt:
rAF loops (`main.js tick`, the editor's Test loop) call `sim.advance(dt)`, which
accumulates wall-clock time and runs whole `STEP_MS` steps (max 4 per frame; a longer
stall drops the remainder instead of fast-forwarding). All per-tick timers (elapsed,
dwell, TNT/cannon fuses, portal cooldown) are in milliseconds of *sim* time. This is what
makes the verifier's result the player's result on any display.

## Player input model (`js/input.js`)

Tap empty space → place the selected tray type (snapped to the grid, at the part's
default angle) and select it. Tap a placed part → select it (dashed ring + ⟲ ✕ ⟳
controls); tap it again → delete. Rotate with ⟲/⟳, `R`/`]` (+15°), `Shift+R`/`[` (−15°),
or a two-finger twist — all snap to the absolute 15° grid. `Delete`/`Backspace` remove,
`Escape` deselects. Default angles in `parts.js` must stay on the 15° grid.

## Adding a part — checklist

1. `js/parts.js` — add the `PARTS` entry (`label`, `movable`, `fixedByDefault`, `build()` with
   defaults; default `angle` must be a multiple of π/12) and append the type to `PALETTE_TYPES`.
2. `js/engine.js` — per-tick behaviour in `_applyForces` (or a `_tickX` like TNT); if it
   returns more than one body, add it to `MULTI_BODY_TYPES` (not rotatable).
3. `js/render.js` / `js/sprites.js` / `js/part-icons.js` — how it draws (bar style, sprite, or
   a `drawX` routine) and its tray icon.
4. `js/level.test.js` — a "builds" case (and an engine case if it has per-tick logic).
5. A Lab level in `js/levels/demo-track-*.js` + its solution in `tools/solutions.mjs`.
6. `sw.js` — new asset paths in `SHELL`, bump `CACHE`.
7. This file's parts table, and root `CLAUDE.md`'s part count if it changed.
8. Run `node tools/solve-verify.mjs` and the Node/browser tests (below).

## Community level payload limits (`js/level.js LEVEL_LIMITS`)

`fixed` ≤ 200 · `start` ≤ 100 · `inventory` ≤ 60 entries, `count` 0–99 · `rope.segments`
≤ 60 · `world.w/h` 1–4000 · serialized JSON ≤ 64 KB. Every part needs numeric `x`/`y`.
`validateLevel` enforces these client-side (editor, browse, community play); PocketBase
enforces the 64 KB cap server-side via `pb_migrations/004_levels_data_maxsize.js`
(`level.data` JSON `maxSize`). Browse builds each card's thumbnail `Sim` lazily
(IntersectionObserver) so a page of levels doesn't simulate 24 worlds up front. The
"Most Played"/"Top Rated" tabs rank within the fetched page only (labelled as such).

## Tests

```
node tools/solve-verify.mjs         # solvability contract (must exit 0)
node js/run-editor-tests.js         # editor/browse pure helpers
node js/run-fx-tests.js             # fx math
node js/run-sound-tests.js          # sfx descriptors
# browser: open contraption-lab/?test and read the console (level.test.js: N passed, 0 failed)
```
