# Contraption Lab — Sprite Art + Roster Expansion design

**Date:** 2026-06-20
**Slug:** `contraption-lab` (existing tier-1 demo, Phases 1–2 shipped)
**Builds on:** `2026-06-20-contraption-lab-design.md` (the game), Phases 1–2 (gameplay + accounts).

## Summary

Give Contraption Lab real, characterful 2D art — funky in the spirit of the 1990s
*Incredible Machine* — generated with Stable Diffusion 3.5 Large (via the
`bedrock-image-mcp-server` MCP), and render those sprites **on top of the existing
Matter.js collision shapes** so placement stays pixel-accurate. In the same effort,
roughly **double the part roster**: ~10 new parts that reuse existing physics primitives
(art + registry only) plus 3 signature parts that need new engine code (rope+pulley,
connected gears/belts, TNT). One shared funky sprite set (one image per part type) with
an optional per-theme override hook; the four CSS themes keep re-skinning the
grid/UI/background/glow around the sprites.

## The non-negotiable constraint: art aligns to the collision shape

The renderer currently draws each part as a **vector polygon from its Matter.js
`body.vertices`** in a fixed 1280×720 world. SD3.5 produces painterly raster art, NOT a
pixel-exact 120×24 rectangle. Therefore **alignment is enforced in code, never expected
from the image model**:

- The Matter.js body remains the single source of truth for collision and placement.
- Each sprite is drawn scaled to its body's **exact world-space bounding box** and rotated
  by `body.angle`, centered on `body.position`.
- The image model supplies texture and funk; the renderer guarantees the sprite sits
  exactly on the collision shape. This keeps drag-to-place, snapping, and physics correct.

A sprite that visually overflows its collision box (a fan's blade tips, a balloon's string)
is allowed **only as non-collidable decoration** via an explicit per-part `overflow` margin
in the registry — the collision body never changes to match the art.

## Decisions locked during brainstorming

- **Art model:** SD3.5 (`generate_image_sd35`), AWS profile `default`, region us-east-1.
- **One shared funky sprite set** (one image per part type), NOT per-theme art — the roster
  is meant to grow, and per-theme art would multiply every future part by 4. A per-theme
  override hook exists in the registry for future bespoke art; default is the shared sprite.
- **Themes keep re-skinning** grid/UI/background/glow via the existing CSS tokens; sprites
  are constant across themes (a subtle theme-driven CSS filter on the sprite layer is
  allowed for cohesion — see Track A §4).
- **Three tracks, one spec, contract-first parallel execution** (see Execution model).
- **Local-first / static-only still hold:** no build tool; sprites are committed PNGs under
  `contraption-lab/assets/parts/`; the game still works if a sprite 404s (vector fallback).

## Track A — Sprite-on-body rendering + asset pipeline + art for the existing 10 parts

### A.1 Sprite registry (`js/sprites.js`) — the frozen contract

```js
// SPRITES[partType] = {
//   src: "./assets/parts/<file>.png",   // committed transparent PNG
//   fit: "box" | "circle" | "plank" | "compound",  // how to map sprite → body bounds
//   anchor: "center",                    // sprite anchor (center for all v1 parts)
//   scale: 1.0,                          // sprite drawn at scale× the body bbox
//   overflow: 0,                         // extra fraction drawn beyond bbox (decoration only)
//   themeOverrides?: { neon: "./assets/parts/neon/<file>.png", ... }  // optional bespoke art
// }
export function spriteFor(partType, themeId) { /* returns resolved {img, fit, scale, overflow} or null */ }
export function preloadSprites() { /* kick off Image() loads; resolve when all settle (errors OK) */ }
```

- Sprites are looked up by `body.plugin.partType`. Unknown/missing → renderer falls back to
  the Phase-1 vector polygon (so the game never breaks on a missing asset).
- `fit` modes — how `render.js` maps the loaded image onto the body each frame:
  - `circle`: draw the image into the square bounding the circle (diameter × diameter), centered, rotated by angle.
  - `box`: draw into the body's oriented bounding rect (width × height), rotated by angle.
  - `plank`: like box, but the sprite is authored as a long horizontal strip so a thin ramp/conveyor/seesaw reads correctly; width = body length, height = body thickness × `scale`.
  - `compound`: for multi-body parts (bucket): the sprite covers the union AABB of the compound, centered on the compound centroid.

### A.2 Asset pipeline (deterministic, documented in `assets/README.md`)

1. **Generate** with `generate_image_sd35`: a single prop, centered, **solid `#FF00FF`
   magenta background**, square aspect (`1:1`) unless the part is a long plank
   (use a wide ratio, e.g. `16:9`, for ramp/conveyor/seesaw so the strip authoring is natural).
   `workspace_dir` = `/home/ubuntu/projects/vibe-demos`. Log prompt + seed.
2. **Key out** the magenta → transparent: prefer `remove_background` (MCP) for clean edges;
   it outputs PNG+alpha directly. (We do NOT need the heavy generate2dsprite frame pipeline —
   these are single static props, not animation sheets.)
3. **Trim** transparent margins so the PNG's content bbox == the image bbox (this is what makes
   `fit` math exact). A tiny committed Node script `assets/trim.mjs` (uses no deps — reads PNG,
   finds alpha bbox, crops) does this deterministically; or, if Node PNG libs are unavailable,
   the renderer trims at load time by scanning alpha once and caching the content rect.
4. **Place** the final PNG at `contraption-lab/assets/parts/<partType>.png`, commit it.
5. **QC** each: on-style (funky TIM character, matches the part's role), centered, clean alpha,
   reads correctly when squashed to the body's aspect (esp. planks).

> Pipeline risk handled by the PILOT GATE below — we prove 2 sprites end-to-end before mass generation.

### A.3 Renderer integration (`js/render.js`)

`drawWorld` gains a sprite pass: for each non-boundary body, look up `spriteFor(partType, themeId)`.
If found and loaded, draw the image transformed to the body (translate to `body.position`,
rotate `body.angle`, draw centered at the `fit`-computed size); else fall back to the existing
vector polygon. The grid, goal zone, and ghost rendering are unchanged. The placement **ghost**
also uses the sprite (semi-transparent) so what you drag matches what you place.

### A.4 Theme cohesion

Sprites are shared, but each theme may apply a CSS-token-driven canvas filter to the sprite
layer (e.g. neon adds a slight glow/saturate, blueprint a slight desaturate/blue-tint) so the
shared art still feels at home. This is a single `theme`-keyed filter string, not per-part art.
Honors `prefers-reduced-motion` (no animated filters).

### A.5 Track A deliverable

Existing 10 parts (ball, wall, ramp, domino, balloon, bucket, fan, conveyor, seesaw, goal)
render as funky sprites on their exact collision shapes, across all 4 themes, with vector
fallback. This ships on its own as a visible upgrade.

## Track B — Roster expansion via physics-reuse (~10 new parts)

Each new part = a `parts.js` registry entry built on an EXISTING physics primitive + a sprite +
a `sprites.js` entry + a palette label. No new engine code. Candidates (final list locked in plan):

| Part | Physics primitive (reused) | Notes |
|---|---|---|
| trampoline | static box, high `restitution` (~0.95) | bounces the ball |
| gear / wheel | dynamic circle, higher density | rolls; visual spokes |
| crate | dynamic box, heavy | pushable weight |
| pipe / chute | angled static box (like ramp, steeper) | funnels |
| pinwheel | dynamic box on a pivot constraint (like seesaw, centered) | spins |
| spring | static box, very high restitution, tall | vertical launch |
| wedge | static right-triangle (vertices body) | deflects |
| platform | static box, wide/thin | resting surface |
| bowling-pin | dynamic box, tall/light, tippy | topples |
| heavy-weight | dynamic box, very high density | momentum |

Each gets a level or two using it (optional) and must not break existing levels. The triangle
wedge needs a `Bodies.fromVertices`/polygon body — still an existing Matter primitive, just not
yet used; flagged as the one mild novelty in B.

## Track C — New-physics parts (3 signature TIM mechanics)

New engine behavior in `engine.js`/`parts.js`, each developed against the vector renderer first
(orthogonal to sprites), then given a sprite:

- **rope + pulley:** a chain of Matter constraints (or a `Composite` of small linked segments)
  between two anchors; objects hung from it. Adds a `rope`/`pulley` part. New: constraint
  authoring + serialization in the level format (the level JSON must round-trip constraint specs).
- **connected gears / belt:** two circles whose rotation is linked (a constraint or a per-tick
  angular-velocity coupling in the `_applyForces` loop). Extends the existing fan/conveyor
  force-application pattern.
- **TNT:** on a trigger (timer or contact), apply a radial impulse to nearby dynamic bodies
  (extends `_applyForces`/a one-shot effect), then despawn. New: impulse + one-shot lifecycle.

Track C requires: level-format extension for constraints (versioned, `schema` bump or additive),
solvability re-verification of any new C levels, and careful non-blocking integration so C parts
never destabilize the existing sim.

## Execution model — contract-first, then parallel agent team

1. **Phase 0 (serial, in the plan):** freeze the contracts — `sprites.js` schema + `fit` modes,
   the asset-pipeline convention, and the full **part manifest** (all ~23 parts with physics
   primitive + art brief). Nothing downstream starts until these are written.
2. **Pilot gate (serial, cheap):** generate 2 pilot sprites — **ball (circle)** and **ramp
   (plank)**, the two hardest alignment cases — wire them onto live bodies via a minimal
   renderer path, and confirm in a real browser that they're on-style AND sit exactly on the
   collision shape. If SD3.5 can't deliver alignable on-style art, we learn it on 2 images.
3. **Fan out (parallel agent team):**
   - **Asset generation** — per-part SD3.5 → transparent → trim → QC. ~23 parts, I/O-bound,
     embarrassingly parallel. (A workflow pipelines these; each part is independent.)
   - **Renderer** — the sprite pass in `render.js` against the frozen registry.
   - **Track C engine code** — rope+pulley, gears/belt, TNT against the vector renderer.
4. **Integrate + verify (serial):** wire sprites onto all bodies; re-run the **headless
   Matter.js solvability sweep** for every level (sprites must not change physics; new parts
   need solvable demo levels); real-browser QA across all 4 themes; 0 console/page errors;
   merge → deploy → live verify.

## Architecture / file layout (additions)

```
contraption-lab/
├── assets/
│   ├── README.md            ← the asset pipeline + prompt template + seed log
│   ├── trim.mjs             ← deterministic transparent-margin trim (optional; or load-time trim)
│   └── parts/
│       ├── ball.png ... goal.png          (Track A: 10)
│       ├── trampoline.png ... weight.png  (Track B: ~10)
│       └── rope.png gears.png tnt.png     (Track C: 3)
├── js/
│   ├── sprites.js           ← NEW: registry + spriteFor + preloadSprites (the Phase-0 contract)
│   ├── render.js            ← MODIFY: sprite pass with vector fallback
│   ├── parts.js             ← MODIFY: Track B + C part definitions
│   ├── engine.js            ← MODIFY: Track C new physics (constraints/coupling/impulse)
│   ├── level.js             ← MODIFY (Track C only): constraint round-trip in level JSON
│   ├── theme.js             ← MODIFY: per-theme sprite-layer filter string
│   └── levels/official.js   ← MODIFY: optional demo levels for new parts (verified solvable)
```

## Error handling / resilience

- Missing/failed sprite load → vector-polygon fallback (game never breaks; this is also the
  offline/SW-cold path). `preloadSprites` resolves even if some images error.
- A sprite must NEVER alter a collision body; decoration overflow is render-only.
- New Track-C parts must not destabilize the sim: max-run timeout and out-of-bounds culling
  from Phase 1 still apply; C effects are wrapped so a misfire can't throw in the rAF loop.
- SW (`sw.js`) SHELL list must add every committed PNG so the PWA still works offline; bump cache.

## Testing

- **Pure logic (`?test`):** `sprites.js` resolution (partType→entry, theme override precedence,
  unknown→null), and any Track-C pure helpers (e.g. rope segment math, impulse falloff). Added to
  the existing headless `?test` suite.
- **Physics invariance:** the headless Matter.js sweep re-confirms all existing official levels
  remain solvable after Track B/C changes (sprites are render-only and must not affect it).
- **New-part levels:** any demo level added for a new part is verified solvable by the sweep.
- **Real-browser QA (Playwright, headless Chromium):** sprites render on bodies across all 4
  themes; ghost matches placed sprite; a placement + run still wins level 1; 0 page/console
  errors; screenshot per theme. Live-deploy verification after merge.

## Out of scope (future)

- Per-theme bespoke sprite sets (the override hook exists; populating it is a later pass).
- Sprite animation (spinning gears as animated frames) — v1 rotates the static sprite with the
  body, which already reads as motion. Frame animation is a future enhancement.
- Sound.
