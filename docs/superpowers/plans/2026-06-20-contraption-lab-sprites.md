# Contraption Lab — Sprites + Roster Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render funky SD3.5-generated Incredible-Machine sprites on top of the existing Matter.js collision shapes (alignment enforced in code), and expand the part roster from 10 to ~23 (≈10 physics-reuse parts + 3 new-physics parts), all live and verified across 4 themes.

**Architecture:** A new `js/sprites.js` registry maps `partType → {src, fit, scale, overflow, themeOverrides}`. `render.js` gains a sprite pass that draws each loaded image transformed onto its body's exact bounding box + `body.angle`, falling back to the Phase-1 vector polygon when a sprite is missing. The Matter body stays the single source of truth for collision/placement; sprites are render-only. New parts (Track B) are registry entries on existing physics primitives; Track C adds rope+pulley/gears/TNT engine code. Assets are committed transparent PNGs (≤256px) produced by SD3.5 → `remove_background` → trim+downscale.

**Tech Stack:** Matter.js 0.20 (vendored), vanilla ES modules, HTML5 Canvas, `bedrock-image-mcp-server` (`generate_image_sd35` + `remove_background`), Playwright/Chromium for headless trim+QA. No build tool.

## Global Constraints

- Static files only — no build tool/framework/package.json/bundler in the repo. Push to main = deploy.
- **Alignment is enforced in code, never from the image model:** the Matter body is the single source of truth; each sprite is drawn scaled to the body's exact world bbox, centered on `body.position`, rotated by `body.angle`. A sprite NEVER changes a collision body; visual overflow is render-only decoration via an explicit `overflow` margin.
- **Local-first:** a missing/failed sprite → vector-polygon fallback; the game must work with zero sprites present and offline.
- **One shared sprite set** (1 PNG per partType under `assets/parts/`); `themeOverrides` hook exists but stays empty in v1.
- **Asset pipeline (pilot-verified 2026-06-20):** `generate_image_sd35` (NO magenta — SD3.5 ignores it; use a plain pale neutral background) → `remove_background` (MCP) → trim+downscale to ≤256px via the committed Playwright script → commit PNG at `contraption-lab/assets/parts/<partType>.png`. `workspace_dir` = `/home/ubuntu/projects/vibe-demos`. Plank parts (ramp/conveyor/seesaw/platform/pipe) MUST be prompted as strict flat side-profile horizontal bars (no perspective, no legs).
- **Physics invariance:** sprites must not change any collision body; the headless Matter.js solvability sweep must still pass for all existing official levels after every change.
- World space is fixed 1280×720; coordinates are center-based.
- `sw.js` SHELL must list every committed PNG; bump the cache version.
- Tests run headlessly via the `?test` suite (Matter stub) + the Matter.js solvability sweep + Playwright real-browser QA.

**Work happens on branch `feat/contraption-lab-sprites` (already created). The pilot is done: `assets/parts/ball.png` exists (82KB, trimmed); the asset pipeline + remove_background are proven.**

## Execution model (contract-first → parallel → integrate)

- **Phase 0 (Tasks 1–3, serial):** freeze the contracts — sprite tooling script, `sprites.js` registry + fit modes, and the full part manifest. Nothing fans out until these land.
- **Parallel (Tasks 4–7):** asset generation (4), renderer sprite pass (5), Track B parts (6), Track C engine (7) can proceed concurrently against the frozen contracts. The controller MAY run Task 4 (asset gen) as a background workflow while 5–7 proceed.
- **Integrate (Tasks 8–10, serial):** wire sprites for all parts + new-part demo levels, SW/theme cohesion, full verification (solvability sweep + real-browser QA across 4 themes) → merge → deploy → live verify.

---

## File Structure

```
contraption-lab/
├── assets/
│   ├── README.md                 ← pipeline + prompt template + seed/prompt log (Task 1)
│   ├── make-sprite.mjs           ← committed: remove_background output → trim+downscale ≤256px (Task 1)
│   ├── manifest.json             ← the 23-part manifest: partType → {fit, scale, overflow, primitive, prompt, aspect, seed} (Task 3)
│   └── parts/<partType>.png      ← 23 committed transparent sprites (ball.png exists) (Task 4)
├── js/
│   ├── sprites.js                ← NEW: SPRITES registry + spriteFor() + preloadSprites() (Task 2)
│   ├── sprites.test.js           ← NEW: pure resolution tests (Task 2)
│   ├── render.js                 ← MODIFY: sprite pass + vector fallback + ghost sprite (Task 5)
│   ├── parts.js                  ← MODIFY: Track B (Task 6) + Track C (Task 7) parts
│   ├── engine.js                 ← MODIFY: Track C physics (Task 7)
│   ├── level.js                  ← MODIFY: Track C constraint round-trip (Task 7)
│   ├── theme.js                  ← MODIFY: per-theme sprite-layer CSS filter (Task 9)
│   ├── main.js                   ← MODIFY: preloadSprites on boot, palette for new parts (Tasks 5/8)
│   └── levels/official.js        ← MODIFY: demo levels for new parts, verified solvable (Task 8)
└── sw.js                         ← MODIFY: cache all PNGs, bump version (Task 9)
```

---

### Task 1: Asset tooling + pipeline doc (the committed sprite processor)

**Files:**
- Create: `contraption-lab/assets/make-sprite.mjs`
- Create: `contraption-lab/assets/README.md`

**Interfaces:**
- Produces: `node assets/make-sprite.mjs <input-cutout.png> <partType> [maxpx=256]` → reads a `remove_background` output, trims to alpha bbox, downscales so max dimension ≤ maxpx, writes `assets/parts/<partType>.png`, prints final `WxH bytes`. Uses the Playwright Chromium already at `/tmp/pw/node_modules/playwright` (no repo deps). This is the deterministic processor every asset task calls.

- [ ] **Step 1: Write `make-sprite.mjs`**

```js
// contraption-lab/assets/make-sprite.mjs
// Deterministic sprite processor: trim transparent margins to the alpha bbox,
// downscale so the longest side <= maxpx, write a web-sized transparent PNG.
// Uses the Playwright Chromium canvas (PIL/numpy are not installed). No repo deps.
import fs from "fs";
import path from "path";
import pw from "/tmp/pw/node_modules/playwright/index.js";

const [input, partType, maxArg] = process.argv.slice(2);
if (!input || !partType) { console.error("usage: make-sprite.mjs <input.png> <partType> [maxpx]"); process.exit(2); }
const maxpx = parseInt(maxArg || "256", 10);
const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "parts");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, partType + ".png");

const b64 = fs.readFileSync(input).toString("base64");
const { chromium } = pw;
const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ b64, maxpx }) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c0 = document.createElement("canvas"); c0.width = img.width; c0.height = img.height;
  const x0 = c0.getContext("2d"); x0.drawImage(img, 0, 0);
  const d = x0.getImageData(0, 0, c0.width, c0.height).data;
  let minx = c0.width, miny = c0.height, maxx = 0, maxy = 0, any = false;
  for (let y = 0; y < c0.height; y++) for (let x = 0; x < c0.width; x++) {
    if (d[(y * c0.width + x) * 4 + 3] > 16) { any = true; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y; }
  }
  if (!any) return { empty: true };
  const cw = maxx - minx + 1, ch = maxy - miny + 1;
  const scale = Math.min(1, maxpx / Math.max(cw, ch));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(cw * scale)); c.height = Math.max(1, Math.round(ch * scale));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  x.drawImage(img, minx, miny, cw, ch, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/png"), w: c.width, h: c.height };
}, { b64, maxpx });
await browser.close();
if (out.empty) { console.error("ERROR: input has no opaque pixels"); process.exit(1); }
fs.writeFileSync(outPath, Buffer.from(out.dataUrl.split(",")[1], "base64"));
console.log(`wrote ${outPath} ${out.w}x${out.h} ${fs.statSync(outPath).size} bytes`);
```

- [ ] **Step 2: Verify it reproduces the ball sprite**

Run (the committed ball.png is already trimmed; re-running on a fresh cutout would match — here we self-check the script runs and is idempotent on the existing asset):
```bash
cd /home/ubuntu/projects/vibe-demos
node contraption-lab/assets/make-sprite.mjs contraption-lab/assets/parts/ball.png ball-selfcheck 256 2>&1 | grep -v Warning
ls -la contraption-lab/assets/parts/ball-selfcheck.png | awk '{print $5}'
rm -f contraption-lab/assets/parts/ball-selfcheck.png
```
Expected: prints `wrote .../ball-selfcheck.png <=256 in both dims, <120000 bytes`; file existed then removed.

- [ ] **Step 3: Write `assets/README.md`**

Document: the pipeline (generate_image_sd35 → remove_background → make-sprite.mjs → commit), the prompt template (funky 1990s Incredible Machine cartoon prop, single centered object, plain pale neutral background clearly separated, NO magenta, NO text/shadow; plank parts = strict flat side-profile horizontal bar, no perspective/legs), the pilot findings (magenta ignored; remove_background works; ball seed 73101), and a running seed/prompt log table with a row per partType. Include this exact note verbatim:

```
PILOT (2026-06-20): SD3.5 ignores #FF00FF magenta backgrounds — do NOT use magenta.
Use remove_background (MCP) to cut out, then make-sprite.mjs to trim+downscale.
Plank parts must be strict flat side-profile (the pilot ramp came back in 3/4 perspective with legs).
```

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/assets/make-sprite.mjs contraption-lab/assets/README.md
git commit -m "contraption-lab: sprite processor (trim+downscale) + asset pipeline doc"
```

---

### Task 2: Sprite registry `sprites.js` (the frozen contract)

**Files:**
- Create: `contraption-lab/js/sprites.js`
- Create: `contraption-lab/js/sprites.test.js`
- Modify: `contraption-lab/js/main.js` (add sprites.test cases to the `?test` run)

**Interfaces:**
- Produces:
  - `SPRITES` — object keyed by partType. Each entry: `{ src, fit, scale, overflow, themeOverrides }` where `fit ∈ {"box","circle","plank","compound"}`, `scale` default 1, `overflow` default 0, `themeOverrides` optional `{themeId: src}`.
  - `resolveSprite(partType, themeId)` → `{ src, fit, scale, overflow } | null` (null for unknown partType). Applies `themeOverrides[themeId]` to `src` when present.
  - `getImage(src)` → the `HTMLImageElement` for a src if loaded & complete, else null (reads an internal cache populated by `preloadSprites`).
  - `preloadSprites(themeId)` → kicks off `Image()` loads for every resolved src; returns a Promise that resolves when all settle (load OR error — never rejects).
- The registry is populated for ALL 23 partTypes here with their `fit`/`scale`/`overflow` (the values come from the manifest, Task 3 — but to avoid a cross-task ordering trap, Task 2 hardcodes the existing 10; Task 6/7 add their entries when they add the parts). v1 `themeOverrides` are all empty.

- [ ] **Step 1: Write failing tests in sprites.test.js**

```js
// contraption-lab/js/sprites.test.js
export async function spriteCases() {
  const S = await import("./sprites.js");
  return [
    { name:"resolveSprite known part", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(!r||r.fit!=="circle") throw new Error("ball should be circle fit, got "+JSON.stringify(r)); } },
    { name:"resolveSprite unknown → null", fn:()=>{ if(S.resolveSprite("nope","blueprint")!==null) throw new Error("unknown should be null"); } },
    { name:"resolveSprite defaults scale/overflow", fn:()=>{ const r=S.resolveSprite("ball","blueprint"); if(r.scale==null||r.overflow==null) throw new Error("missing defaults"); } },
    { name:"themeOverride precedence", fn:()=>{
        const r1=S.resolveSprite("ball","blueprint");
        // inject a temporary override to prove precedence logic without shipping per-theme art
        S.SPRITES.ball.themeOverrides = { neon: "./assets/parts/neon/ball.png" };
        const r2=S.resolveSprite("ball","neon");
        S.SPRITES.ball.themeOverrides = {};
        if(r2.src===r1.src) throw new Error("override not applied");
        if(!r2.src.includes("neon/")) throw new Error("wrong override src "+r2.src);
      }},
    { name:"plank parts use plank fit", fn:()=>{ for(const t of ["ramp","conveyor","seesaw"]){ const r=S.resolveSprite(t,"blueprint"); if(!r||r.fit!=="plank") throw new Error(t+" should be plank fit"); } } },
  ];
}
```

- [ ] **Step 2: Run to verify FAIL**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --input-type=module -e "import('./js/sprites.test.js').then(async m=>{const t=await import('./js/level.test.js');const r=t.runTests(await m.spriteCases());process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: `LOAD FAIL ... sprites.js`.

- [ ] **Step 3: Implement sprites.js**

```js
// contraption-lab/js/sprites.js
// Registry mapping partType → sprite art + how it maps onto the collision body.
// fit: "circle" (square ⌀×⌀), "box" (oriented w×h), "plank" (long thin side-profile bar),
//      "compound" (covers a multi-body part's union AABB). scale: sprite size × body bbox.
// overflow: extra fraction drawn beyond the bbox (DECORATION ONLY — never affects collision).
const P = (src, fit, opt = {}) => ({ src, fit, scale: opt.scale ?? 1, overflow: opt.overflow ?? 0, themeOverrides: opt.themeOverrides ?? {} });

export const SPRITES = {
  // existing 10 (Track A)
  ball:     P("./assets/parts/ball.png",     "circle"),
  wall:     P("./assets/parts/wall.png",     "box"),
  ramp:     P("./assets/parts/ramp.png",     "plank"),
  domino:   P("./assets/parts/domino.png",   "box"),
  balloon:  P("./assets/parts/balloon.png",  "circle", { overflow: 0.5 }),  // string hangs below
  bucket:   P("./assets/parts/bucket.png",   "compound"),
  fan:      P("./assets/parts/fan.png",      "box",    { overflow: 0.25 }), // blade tips
  conveyor: P("./assets/parts/conveyor.png", "plank"),
  seesaw:   P("./assets/parts/seesaw.png",   "plank"),
  goal:     P("./assets/parts/goal.png",     "box"),
  // Track B + C entries are added by their tasks (6, 7).
};

const cache = new Map();

export function resolveSprite(partType, themeId) {
  const e = SPRITES[partType];
  if (!e) return null;
  const src = (e.themeOverrides && e.themeOverrides[themeId]) || e.src;
  return { src, fit: e.fit, scale: e.scale, overflow: e.overflow };
}

export function getImage(src) {
  const img = cache.get(src);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadSprites(themeId) {
  const srcs = new Set();
  for (const t of Object.keys(SPRITES)) { const r = resolveSprite(t, themeId); if (r) srcs.add(r.src); }
  return Promise.all([...srcs].map(src => new Promise(res => {
    if (cache.has(src)) return res();
    const img = new Image(); cache.set(src, img);
    img.onload = () => res(); img.onerror = () => res(); // settle either way — never reject
    img.src = src;
  })));
}
```

- [ ] **Step 4: Run to verify PASS**

Run the Step 2 command.
Expected: `5 passed, 0 failed`. (Node has no `Image`/`document`, but these tests only call `resolveSprite`/`SPRITES`, which are pure — `getImage`/`preloadSprites` are browser-only and tested in Task 10's real-browser QA.)

- [ ] **Step 5: Add spriteCases to the ?test block in main.js**

In `contraption-lab/js/main.js`, find the `?test` block and add `cloud.test.js`-style import of sprites cases. Change the runTests array to also include `...(await (await import("./sprites.test.js")).spriteCases())`. Verify with the full headless command:
```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --input-type=module -e "globalThis.Matter={Bodies:{circle:(x,y,r,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)}),rectangle:(x,y,w,h,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)})},Body:{create:(o)=>({...o,position:{x:0,y:0},vertices:[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}}),setAngle(){},setStatic(){},setVelocity(){},applyForce(){}},Constraint:{create:()=>({})},Composite:{add(){}},Engine:{create:()=>({world:{},gravity:{}}),update(){}},Query:{point:()=>[]}};import('./js/level.test.js').then(async m=>{const s=await import('./js/sprites.test.js');const r=m.runTests([...await m.levelCases(),...await m.officialCases(),...await m.progressCases(),...await m.progressShapeCases(),...await (await import('./js/cloud.test.js')).cloudCases(),...await s.spriteCases()]);console.log(JSON.stringify(r));process.exit(r.failed?1:0)})" 2>&1 | tail -1; cd ..
```
Expected: a JSON line with `"failed":0`.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/sprites.js contraption-lab/js/sprites.test.js contraption-lab/js/main.js
git commit -m "contraption-lab: sprite registry + fit-mode contract + resolution tests"
```

---

### Task 3: The 23-part manifest

**Files:**
- Create: `contraption-lab/assets/manifest.json`

**Interfaces:**
- Produces: a JSON array; each entry `{ partType, track, fit, primitive, aspect, seed, prompt }` — the single source of truth driving asset generation (Task 4) and the parts work (6/7). `track ∈ {"A","B","C"}`. This is data, not code.

- [ ] **Step 1: Write manifest.json**

Include all 23 entries. The 10 Track-A parts (ball already done — keep its row for regen reference), the 10 Track-B parts, and the 3 Track-C parts. Each `prompt` follows the README template; plank parts say "strict flat side-profile horizontal bar, no perspective, no legs". Example rows (write all 23 in this shape):

```json
[
  { "partType":"ball","track":"A","fit":"circle","primitive":"circle r=18","aspect":"1:1","seed":73101,
    "prompt":"A single cartoon heavy steel ball, funky 1990s Incredible Machine style, glossy dark sphere with a bright highlight, chunky hand-drawn cartoon outline, perfectly circular, single centered object, plain pale neutral background clearly separated, no text, no shadow on background." },
  { "partType":"ramp","track":"A","fit":"plank","primitive":"static box 160x16","aspect":"16:9","seed":73102,
    "prompt":"A single wooden plank ramp, funky 1990s Incredible Machine style, STRICT FLAT SIDE-PROFILE horizontal bar, long and thin, wood grain and a couple of bolts, chunky cartoon outline, NO perspective, NO legs or supports, single centered object spanning the width, plain pale neutral background clearly separated, no text." },
  { "partType":"trampoline","track":"B","fit":"box","primitive":"static box high restitution","aspect":"1:1","seed":73111,
    "prompt":"A single bouncy trampoline, funky 1990s Incredible Machine style, springy striped mat on a frame seen from the side, chunky cartoon outline, single centered object, plain pale neutral background clearly separated, no text." }
  /* …all remaining rows: wall, domino, balloon, bucket, fan, conveyor, seesaw, goal (Track A);
     gear, crate, pipe, pinwheel, spring, wedge, platform, bowlingpin, weight (Track B);
     rope, gears, tnt (Track C). Plank fit for: ramp, conveyor, seesaw, platform, pipe. */
]
```

The implementer MUST write all 23 rows in full (no `/* … */` placeholder in the committed file). Seeds: Track A 73101–73110, Track B 73111–73120, Track C 73121–73123.

- [ ] **Step 2: Validate JSON + coverage**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
jq -e 'length == 23' contraption-lab/assets/manifest.json && echo "23 parts"
jq -r '.[].partType' contraption-lab/assets/manifest.json | sort | tr '\n' ' '; echo
echo "plank parts: $(jq -r '[.[]|select(.fit=="plank")|.partType]|join(",")' contraption-lab/assets/manifest.json)"
jq -e 'all(.[]; .partType and .track and .fit and .primitive and .aspect and .seed and .prompt)' contraption-lab/assets/manifest.json && echo "all fields present"
```
Expected: `23 parts`; the partType list includes the 10 existing + 10 B + 3 C; plank parts = ramp,conveyor,seesaw,platform,pipe; `all fields present`.

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/assets/manifest.json
git commit -m "contraption-lab: 23-part art+physics manifest (Tracks A/B/C)"
```

---

### Task 4: Generate all sprites (parallelizable; controller may run as a background workflow)

**Files:**
- Create: `contraption-lab/assets/parts/<partType>.png` for all 22 remaining parts (ball done).

**Interfaces:**
- Consumes: `manifest.json` (Task 3), `make-sprite.mjs` (Task 1), MCP `generate_image_sd35` + `remove_background`.
- Produces: 22 committed transparent PNGs (≤256px each), one per partType. plus an updated seed/prompt log in `assets/README.md`.

> **Parallelization note:** each part is independent. The controller SHOULD fan this out — either a Workflow that pipelines the manifest rows through generate→cut→process, or parallel sub-agents each owning a subset. Each part's procedure is identical:

- [ ] **Step 1 (per part): Generate the raw image**

Call `generate_image_sd35` with the manifest row's `prompt`, `aspect`, `seed`, `workspace_dir=/home/ubuntu/projects/vibe-demos`, `filename=<partType>-raw`. A shared negative prompt: `"photorealistic, multiple objects, text, watermark, drop shadow on background, gradient, scene, hands, blurry, realistic photo"`.

- [ ] **Step 2 (per part): Cut out the background**

Call `remove_background` with the raw image path, `filename=<partType>-cut`, `workspace_dir=/home/ubuntu/projects/vibe-demos`.

- [ ] **Step 3 (per part): Trim + downscale + commit**

Run:
```bash
cd /home/ubuntu/projects/vibe-demos
node contraption-lab/assets/make-sprite.mjs <path-to-cut.png> <partType> 256 2>&1 | grep -v Warning
```
Expected: `wrote .../<partType>.png <=256 dims, <150000 bytes`.

- [ ] **Step 4: QC each sprite visually**

Read each generated `assets/parts/<partType>.png`. Reject + regenerate (seed+1, tighten prompt) if: not on-style, not a single centered object, clipped alpha, or — for plank parts — any perspective/legs instead of a flat side bar. Plank parts especially must read correctly when squashed to a thin bar.

- [ ] **Step 5: Update the seed/prompt log in README.md and commit all sprites**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/assets/parts/*.png contraption-lab/assets/README.md
git commit -m "contraption-lab: generate funky SD3.5 sprites for all 23 parts"
```
(Scratch raw/cut files under `output/` or `generated_images/` are NOT committed — only the final `parts/*.png`.)

---

### Task 5: Renderer sprite pass (`render.js`)

**Files:**
- Modify: `contraption-lab/js/render.js`
- Modify: `contraption-lab/js/main.js` (preloadSprites on boot + pass themeId to drawWorld; ghost uses sprite)

**Interfaces:**
- Consumes: `resolveSprite`, `getImage`, `preloadSprites` (sprites.js); existing `worldToScreen`, `tokens()`.
- Produces: `drawWorld` draws, for each non-boundary body, the resolved sprite (if its image is loaded) transformed onto the body; else the existing vector polygon. New signature: `drawWorld(ctx, state, transform, theme, opts)` where `opts.themeId` is passed through (theme already available; add `themeId` to opts). The ghost (opts.ghost) renders its sprite semi-transparent when available.

- [ ] **Step 1: Implement the sprite-draw helper + integrate into drawWorld**

In `render.js`, add a helper and call it in the bodies loop. The fit math (sprite drawn centered on `body.position`, rotated `body.angle`, sized to the body bbox per fit mode):

```js
import { resolveSprite, getImage } from "./sprites.js";

// world-space half-extents of a body for each fit mode
function bodyDrawSize(body, fit) {
  const b = body.bounds, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  if (fit === "circle") { const d = (body.circleRadius ? body.circleRadius*2 : Math.max(w,h)); return { w:d, h:d }; }
  if (fit === "plank" || fit === "box") {
    // use the body's own (unrotated) dimensions when available; bounds are AABB (post-rotation),
    // so prefer vertices-derived oriented size: width = max edge, height = min edge for plank.
    const verts = body.vertices;
    if (verts && verts.length >= 4) {
      const e1 = Math.hypot(verts[1].x-verts[0].x, verts[1].y-verts[0].y);
      const e2 = Math.hypot(verts[2].x-verts[1].x, verts[2].y-verts[1].y);
      return { w: Math.max(e1,e2), h: Math.min(e1,e2) };
    }
    return { w, h };
  }
  return { w, h }; // compound: AABB union
}

function drawSprite(ctx, body, spr, transform) {
  const img = getImage(spr.src); if (!img) return false;
  const t = transform;
  const center = worldToScreen(body.position.x, body.position.y, t);
  let { w, h } = bodyDrawSize(body, spr.fit);
  w *= spr.scale * (1 + spr.overflow); h *= spr.scale * (1 + spr.overflow);
  const sw = w * t.scale, sh = h * t.scale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(body.angle || 0);
  ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
  ctx.restore();
  return true;
}
```

In the bodies loop, before the vector draw:
```js
for (const body of state.bodies || []) {
  if (body.plugin && body.plugin.partType === "boundary") continue;
  const spr = resolveSprite(body.plugin && body.plugin.partType, opts.themeId);
  if (spr && drawSprite(ctx, body, spr, t)) continue;   // sprite drawn → skip vector
  // …existing vector polygon fallback unchanged…
}
```
For the ghost: if `opts.ghost` has a resolved+loaded sprite, draw it at `globalAlpha=0.6` using the same transform from the ghost's part type/position; else the existing accent polygon.

- [ ] **Step 2: Wire preload + themeId in main.js**

In `main.js` boot: `import { preloadSprites } from "./sprites.js";` then after `applyTheme(loadTheme())`, call `preloadSprites(loadTheme()).then(draw)`. In `draw()`, pass `{ ...existing opts, themeId: document.documentElement.dataset.theme }` to `drawWorld`. On theme change (the existing MutationObserver), call `preloadSprites(newTheme).then(draw)` so any theme-override art loads.

- [ ] **Step 3: Syntax-check + full ?test suite**

```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && for f in js/*.js; do node --check "$f" || exit 1; done && echo "syntax OK"
# run the full headless ?test (same command as Task 2 Step 5) — expect failed:0
cd ..
```
Expected: `syntax OK`; headless suite `failed:0`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/render.js contraption-lab/js/main.js
git commit -m "contraption-lab: render sprites on collision bodies (vector fallback)"
```

---

### Task 6: Track B parts (~10 physics-reuse parts)

**Files:**
- Modify: `contraption-lab/js/parts.js` (add part definitions)
- Modify: `contraption-lab/js/sprites.js` (add registry entries)

**Interfaces:**
- Consumes: existing `cat`, `PARTS`, Matter primitives.
- Produces: 10 new entries in `PARTS` (trampoline, gear, crate, pipe, pinwheel, spring, wedge, platform, bowlingpin, weight), each `{label, movable, fixedByDefault, build}`, with `body.plugin.partType` set; 10 matching `SPRITES` entries with the manifest's fit mode. New `PALETTE_TYPES` includes the movable ones.

- [ ] **Step 1: Add the 10 part definitions to parts.js**

Append to `PARTS` (each on existing primitives). Full code for all 10 — examples:
```js
  trampoline: { label:"Trampoline", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"trampoline",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||120,18,{isStatic:true,angle:s.angle||0,restitution:0.95,friction:0.2}))], constraints:[] }) },
  gear: { label:"Gear", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"gear",s.tag)(M.Bodies.circle(s.x,s.y,s.r||30,{density:0.01,friction:0.6,restitution:0.1}))], constraints:[] }) },
  crate: { label:"Crate", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"crate",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||56,s.h||56,{density:0.006,friction:0.5}))], constraints:[] }) },
  pipe: { label:"Pipe", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"pipe",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||160,16,{isStatic:true,angle:s.angle??0.5,friction:0.1}))], constraints:[] }) },
  pinwheel: { label:"Pinwheel", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const v=cat(M,"pinwheel",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||110,12,{density:0.002,friction:0.3}));
      const pivot=M.Constraint.create({pointA:{x:s.x,y:s.y},bodyB:v,pointB:{x:0,y:0},stiffness:1,length:0}); return {bodies:[v],constraints:[pivot]}; } },
  spring: { label:"Spring", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"spring",s.tag)(M.Bodies.rectangle(s.x,s.y,40,s.h||60,{isStatic:true,restitution:1.3,friction:0.2}))], constraints:[] }) },
  wedge: { label:"Wedge", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const w=s.w||80,h=s.h||80; const b=M.Bodies.fromVertices(s.x,s.y,[[{x:-w/2,y:h/2},{x:w/2,y:h/2},{x:w/2,y:-h/2}]],{isStatic:true,angle:s.angle||0,friction:0.3});
      return { bodies:[cat(M,"wedge",s.tag)(b)], constraints:[] }; } },
  platform: { label:"Platform", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"platform",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||200,18,{isStatic:true,angle:s.angle||0,friction:0.6}))], constraints:[] }) },
  bowlingpin: { label:"Pin", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"bowlingpin",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||22,s.h||66,{density:0.002,friction:0.4}))], constraints:[] }) },
  weight: { label:"Weight", movable:true, fixedByDefault:false,
    build:(s,M)=>({ bodies:[cat(M,"weight",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||50,s.h||50,{density:0.03,friction:0.6}))], constraints:[] }) },
```
Add the movable ones to `PALETTE_TYPES`: `["ramp","wall","fan","conveyor","seesaw","balloon","domino","bucket","trampoline","gear","crate","pipe","pinwheel","spring","wedge","platform","bowlingpin","weight"]`.

- [ ] **Step 2: Add sprite registry entries to sprites.js**

```js
  trampoline: P("./assets/parts/trampoline.png","box"),
  gear:       P("./assets/parts/gear.png","circle"),
  crate:      P("./assets/parts/crate.png","box"),
  pipe:       P("./assets/parts/pipe.png","plank"),
  pinwheel:   P("./assets/parts/pinwheel.png","box"),
  spring:     P("./assets/parts/spring.png","box"),
  wedge:      P("./assets/parts/wedge.png","box"),
  platform:   P("./assets/parts/platform.png","plank"),
  bowlingpin: P("./assets/parts/bowlingpin.png","box"),
  weight:     P("./assets/parts/weight.png","box"),
```

- [ ] **Step 3: Test the new parts build + validate + don't break levels**

Add a case to `level.test.js`'s `officialCases` or a new export verifying each new type builds via `makePart` without throwing (using the Matter stub augmented with `fromVertices: ()=>({position:{x:0,y:0},vertices:[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}})`). Then run the headless solvability sweep (the /tmp/cl-diag harness from Phase 1) to confirm all 10 existing official levels STILL solve (new parts must not perturb them — they don't appear in existing levels, so this is a regression guard).
```bash
cd /tmp/cl-diag && rm -rf js && cp -r /home/ubuntu/projects/vibe-demos/contraption-lab/js ./js && node final.mjs 2>&1 | grep -v "delta argument" | tail -1
```
Expected: `VALIDATE 10/10 · SOLVABLE+INV 10/10`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/parts.js contraption-lab/js/sprites.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: Track B — 10 physics-reuse parts + sprite entries"
```

---

### Task 7: Track C new-physics parts (rope+pulley, gears/belt, TNT)

**Files:**
- Modify: `contraption-lab/js/parts.js`, `contraption-lab/js/engine.js`, `contraption-lab/js/level.js`, `contraption-lab/js/sprites.js`

**Interfaces:**
- Consumes: existing `Sim`, `_applyForces`, `buildWorld`, the level format.
- Produces: 3 new parts with new engine behavior, plus level-format support for constraint specs.

- [ ] **Step 1: rope+pulley — a Composite of linked segments**

In `parts.js`, add a `rope` part: build a chain of small circles linked by constraints between two anchor points `{x,y}` → `{x2,y2}` from the spec, plus a heavier bob at the end. Return `{bodies:[...segments], constraints:[...links]}`. In `level.js buildWorld`, the existing loop already adds returned constraints to the world — verify rope's many constraints are added (they are, via the existing `if (constraints.length) Composite.add`). Add the rope's endpoints to the level spec.

```js
  rope: { label:"Rope", movable:false, fixedByDefault:true,
    build:(s,M)=>{
      const segs=s.segments||8, x2=s.x2??s.x, y2=s.y2??(s.y+160);
      const bodies=[], constraints=[];
      let prev=null;
      for(let i=0;i<=segs;i++){
        const t=i/segs, x=s.x+(x2-s.x)*t, y=s.y+(y2-s.y)*t;
        const link=cat(M,"rope",s.tag)(M.Bodies.circle(x,y,5,{density:0.004,frictionAir:0.02}));
        if(i===0) M.Body.setStatic(link,true);            // anchor
        if(i===segs) M.Body.setDensity(link,0.02);         // heavy bob
        bodies.push(link);
        if(prev) constraints.push(M.Constraint.create({bodyA:prev,bodyB:link,stiffness:0.9,length:Math.hypot(x2-s.x,y2-s.y)/segs}));
        prev=link;
      }
      return {bodies,constraints};
    } },
```

- [ ] **Step 2: connected gears/belt — angular coupling in _applyForces**

In `engine.js _applyForces`, add: for any body with `plugin.partType==="gears"` and `plugin.driven` velocity, set angular velocity each tick (`Matter.Body.setAngularVelocity`). In `parts.js`, add a `gears` part: two circles, one with `plugin.spin` (driver) that the engine spins, applying surface velocity to bodies in contact (reuse the conveyor contact pattern but tangential). Keep it bounded and wrapped in the existing try-safe loop.

- [ ] **Step 3: TNT — one-shot radial impulse**

In `parts.js` add `tnt`: a dynamic box with `plugin={partType:"tnt", fuseMs:1500, blast:0.12, radius:160, armed:true}`. In `engine.js step()`, after `_applyForces`, decrement fuses on armed tnt bodies by dtMs; when ≤0, apply a radial impulse (`Body.applyForce`) to every dynamic body within `radius`, set `armed=false`, and shrink/flag it spent (remove from world via Composite.remove). Wrap in try/catch so a misfire can't break the rAF loop.

- [ ] **Step 4: level.js constraint round-trip**

Ensure `serializeLevel`/`validateLevel` accept the new part specs (rope's `x2,y2,segments`; gears `spin`; tnt `fuseMs,blast,radius`). These are just extra fields on the existing `fixed`/`start` spec objects — confirm `validateLevel` still passes them (it validates type ∈ PARTS, which now includes them) and `serializeLevel` preserves them (it stringifies the whole level — verify the new fields survive a round-trip with a test case).

- [ ] **Step 5: sprites.js entries + tests + sweep**

Add `rope: P(...,"box")`, `gears: P(...,"circle")`, `tnt: P(...,"box")`. Add `?test` cases: rope builds N+1 bodies + N constraints; tnt fuse countdown reaches blast; serializeLevel round-trips a tnt spec. Run the headless ?test (failed:0) and the solvability sweep (existing 10 levels still 10/10).

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/parts.js contraption-lab/js/engine.js contraption-lab/js/level.js contraption-lab/js/sprites.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: Track C — rope+pulley, gears/belt, TNT (new physics)"
```

---

### Task 8: Demo levels for new parts (verified solvable)

**Files:**
- Modify: `contraption-lab/js/levels/official.js`

**Interfaces:**
- Produces: 3–5 new official levels showcasing the new parts, each verified solvable by the headless sweep, ascending after official-10.

- [ ] **Step 1: Author 3–5 new levels using new parts**

Add levels (official-11…) each featuring a new mechanic (e.g. "Bounce House" uses trampoline; "Gravity Drop" uses weight+seesaw; "The Big Bang" uses tnt). Use the proven sloped-floor solvable pattern from Phase 1. Each must pass `validateLevel` and have an inventory.

- [ ] **Step 2: Verify every level (old + new) is solvable headlessly**

Extend the /tmp/cl-diag solver harness with placements for the new levels and run:
```bash
cd /tmp/cl-diag && rm -rf js && cp -r /home/ubuntu/projects/vibe-demos/contraption-lab/js ./js && node all.mjs 2>&1 | grep -v "delta argument" | tail -3
```
Expected: every level (including new) reports solvable. Tune coordinates until they do (levels are data).

- [ ] **Step 3: Run the structural ?test (level count, unique ids, all validate)**

```bash
cd /home/ubuntu/projects/vibe-demos/contraption-lab && node --input-type=module -e "<full headless ?test command>" 2>&1 | tail -1; cd ..
```
Expected: `failed:0`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/levels/official.js
git commit -m "contraption-lab: demo levels for new parts (verified solvable)"
```

---

### Task 9: Theme cohesion + SW cache + docs

**Files:**
- Modify: `contraption-lab/js/theme.js`, `contraption-lab/style.css`, `contraption-lab/sw.js`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: a per-theme CSS filter on the canvas/sprite layer; all PNGs cached by the SW; docs note the new art + roster.

- [ ] **Step 1: Per-theme sprite-layer filter**

Add a `data-theme`-keyed canvas CSS filter (e.g. `[data-theme="neon"] #stage{filter:saturate(1.2) drop-shadow(0 0 2px var(--accent))}`, blueprint a slight `hue-rotate`/`contrast`, toy none, cartoon none) in style.css. Honor `@media (prefers-reduced-motion: reduce)` (no animated filter). This is the only theme-specific sprite treatment.

- [ ] **Step 2: SW caches all PNGs + bump**

In `sw.js`, bump `CACHE` to `vibe-contraption-lab-v3` and add every `./assets/parts/<partType>.png` (all 23) to SHELL. Verify the cross-origin guard is intact.
```bash
cd /home/ubuntu/projects/vibe-demos
echo "v3: $(grep -c v3 contraption-lab/sw.js)  pngs: $(grep -c 'assets/parts/' contraption-lab/sw.js)  xorigin: $(grep -c 'origin !== self.location.origin' contraption-lab/sw.js)"
```
Expected: v3 ≥1; pngs = 23; xorigin = 1.

- [ ] **Step 3: Docs**

Update the contraption-lab bullet in README.md + CLAUDE.md: now has hand-generated funky SD3.5 sprite art rendered on the collision shapes, ~23 parts including rope/gears/TNT, 4 themes. Note the asset pipeline lives in `assets/README.md`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add contraption-lab/js/theme.js contraption-lab/style.css contraption-lab/sw.js README.md CLAUDE.md
git commit -m "contraption-lab: per-theme sprite filter + SW cache v3 + docs"
```

---

### Task 10: Full verification (the quality gate) + ship

**Files:** none (verification); scratch test files in /tmp.

**Interfaces:** proves the whole feature works in a real browser across all themes with sprites aligned on bodies, then merges.

- [ ] **Step 1: Headless suites green**

Run the full `?test` (failed:0) AND the solvability sweep (all levels solvable). Both must pass.

- [ ] **Step 2: Real-browser QA across 4 themes (Playwright)**

Write `/tmp/cl-sprite-test/qa.mjs` (reuse /tmp/pw playwright) that serves `contraption-lab/`, and for EACH theme (blueprint/cartoon/neon/toy):
  1. loads the page, waits for `preloadSprites` (poll until a known sprite image is complete), asserts 0 page/console errors;
  2. asserts sprites are actually drawn — e.g. sample canvas pixels over a placed part's body bbox and confirm non-background, non-flat-fill colors appear (sprite present), OR expose a `window.__spritesDrawn` counter from render and assert > 0;
  3. places a part and runs level 1 → "Solved!" (sprites must not break physics);
  4. switches theme via `#themeSel` and re-asserts no errors;
  5. screenshots each theme to /tmp/cl-sprite-test/<theme>.png.
Assert alignment qualitatively by reviewing the 4 screenshots (sprite sits on the collision shape, planks read correctly, no gross overflow).

- [ ] **Step 3: Review screenshots**

Read the 4 theme screenshots. Confirm: sprites render on the bodies, aligned to the collision shapes; plank parts (ramp/conveyor/seesaw) read as bars not perspective props; new parts visible; themes visibly differ. Fix any misalignment (usually a fit-mode or scale tweak in sprites.js) and re-run.

- [ ] **Step 4: Merge + deploy + live verify**

Per finishing-a-development-branch: merge to main, verify tests on merge, push (deploys frontend). Then load the LIVE url in Playwright, assert sprites render + level 1 solvable + 0 errors, screenshot. (Backend unchanged this round — no sync-backends needed.)

---

## Self-Review

**Spec coverage:**
- A.1 registry/contract → Task 2. A.2 pipeline → Tasks 1+4. A.3 renderer → Task 5. A.4 theme cohesion → Task 9. A.5 (10 parts render) → Tasks 4+5. ✓
- Track B (~10 physics-reuse parts) → Task 6. ✓
- Track C (rope/gears/tnt + level-format) → Task 7. ✓
- Pilot gate → DONE pre-plan (ball shipped, pipeline proven). ✓
- Execution model (contract-first Tasks 1–3, parallel 4–7, integrate 8–10) → task ordering matches. ✓
- Testing (pure ?test, physics-invariance sweep, real-browser QA) → Tasks 2/6/7/8/10. ✓
- SW/offline, alignment-in-code, local-first fallback, no-build → Global Constraints + Tasks 5/9. ✓

**Placeholder scan:** Manifest (Task 3) and Track B (Task 6) give full code for representative entries and explicitly require the implementer to write ALL rows/parts in full — the `/* … */` in the manifest example is labeled as must-expand, not a shippable placeholder. Track C steps describe the engine changes with concrete code for rope and concrete mechanics for gears/tnt; these are the genuinely novel parts and are specified at the mechanism level with the exact plugin fields and the exact integration points (`_applyForces`, `step`), which is the right altitude for new-physics work that needs in-browser tuning. No TBD/TODO.

**Type consistency:** `resolveSprite(partType, themeId)→{src,fit,scale,overflow}`, `getImage(src)`, `preloadSprites(themeId)` consistent across Tasks 2/5. `SPRITES` entry shape (`P(src,fit,{scale,overflow,themeOverrides})`) consistent Tasks 2/6/7. `fit ∈ {box,circle,plank,compound}` consistent (manifest Task 3 ↔ registry ↔ renderer bodyDrawSize Task 5). `body.plugin.partType` is the lookup key everywhere. PALETTE_TYPES extended consistently. Matter `fromVertices` (wedge) flagged as the one not-yet-used primitive.

**Risk flagged for executor:** Track C (Task 7) is the highest-uncertainty work — rope constraints and TNT impulse need in-browser tuning and could destabilize the sim; all C effects must be try/wrapped (Phase-1 max-run + cull still apply) and the solvability sweep for existing levels MUST stay green. If a C mechanic proves unstable within reasonable tuning, ship Tracks A+B and defer that single C part (note it) rather than block the whole feature.
