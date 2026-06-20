# Contraption Lab — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully playable, themeable *Incredible Machine*–style physics puzzle demo (`contraption-lab/`) live in vibe-demos — sandbox + ~10 official levels, localStorage progress, no backend — built to expand into accounts/editor later.

**Architecture:** Plain static files served from the demo folder, no build tool. Matter.js (vendored) runs the 2D physics in a fixed 1280×720 world space scaled to the device. Game state is split into focused ES modules loaded via `<script type="module">`. A versioned JSON level format (designed up front) is the contract for official levels now and the editor/PocketBase later. Theming is pure CSS custom properties read by both DOM chrome and the canvas renderer.

**Tech Stack:** HTML5 Canvas 2D, Matter.js 0.20.0 (vendored at `vendor/matter.min.js`), vanilla ES modules, CSS custom properties, localStorage, PWA service worker.

## Global Constraints

- No build tool, no framework, no package.json, no runtime CDN — static files only; push to `main` = deploy. (verbatim: "Do not introduce a build tool, framework, or package.json.")
- Slug is kebab-case `contraption-lab`; entry point is `contraption-lab/index.html`.
- Each demo is self-contained — do not share CSS/JS with the landing or other demos.
- Local-first: the game MUST be fully playable with no backend in Phase 1.
- iOS/iPad first: pointer events (not mouse-only); `touch-action: none` on canvas; no hover-dependent UI; fixed viewport, no rubber-band scroll.
- Game logic references CSS theme tokens, never hard-coded colors.
- World space is fixed at 1280×720; all level coordinates are in that space.
- Level JSON carries `"schema": 1`; unknown schema/part types fail gracefully, never crash.
- Maintenance contract: adding the demo updates `contraption-lab/index.html` (entry), root `index.html` works index (row `12` + count), `thumbs/contraption-lab.jpg`, and `README.md` in the same ship commit.
- Pure-logic tests live in `js/level.test.js`, run via `?test` query param, logging pass/fail to console.

**Work happens on branch `feat/contraption-lab-spec` (already created), building on the committed spec.**

---

## File Structure

```
contraption-lab/
├── index.html              ← shell: canvas, palette, controls, theme select, ?test hook
├── style.css               ← layout + 4 theme token sets (CSS custom properties)
├── icon.svg                ← PWA icon (blueprint gear)
├── manifest.webmanifest    ← PWA manifest
├── sw.js                   ← offline shell SW (tinywings pattern, vendor cached)
├── vendor/matter.min.js    ← Matter.js 0.20.0, vendored
└── js/
    ├── geom.js             ← pure helpers: snap, AABB overlap, world↔screen scaling
    ├── parts.js            ← PART registry: type → Matter body factory + render hints + palette meta
    ├── level.js            ← LEVEL_SCHEMA validate / serialize / clone; buildWorld()
    ├── levels/official.js   ← OFFICIAL_LEVELS: array of ~10 level JSON objects
    ├── render.js           ← drawWorld(ctx, world, theme): themed canvas drawing
    ├── engine.js           ← Sim class: build/run/reset, win-detection (dwell), max-run timer
    ├── input.js            ← PlacementController: pointer drag-place / move / rotate / delete on grid
    ├── progress.js         ← getProgress/setSolved (localStorage), best-of merge helper
    ├── theme.js            ← THEMES list, applyTheme(name), persisted choice
    ├── level.test.js       ← pure-logic assertions for geom/level/progress
    └── main.js             ← boot, hash routing (menu→play), wires UI to Sim + controllers
```

Dependency order (also the task order): geom → parts → level → official → render → engine → input → progress → theme → main → PWA shell → tests → portal wiring.

---

### Task 1: Scaffold folder + vendor Matter.js + minimal bootable page

**Files:**
- Create: `contraption-lab/vendor/matter.min.js` (downloaded)
- Create: `contraption-lab/index.html`
- Create: `contraption-lab/style.css`
- Create: `contraption-lab/js/main.js`

**Interfaces:**
- Produces: a page that loads Matter.js and logs its version — proves the vendored engine and module loading work before any game code.

- [ ] **Step 1: Create the folder and vendor Matter.js**

Run:
```bash
mkdir -p contraption-lab/js/levels contraption-lab/vendor
curl -sL -o contraption-lab/vendor/matter.min.js https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js
grep -o "matter-js [0-9.]*" contraption-lab/vendor/matter.min.js | head -1
```
Expected: prints `matter-js 0.20.0`.

- [ ] **Step 2: Write minimal `index.html`**

```html
<!doctype html>
<html lang="en" data-theme="blueprint">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
  <meta name="theme-color" content="#1b2a4a">
  <title>Contraption Lab</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icon.svg">
  <link rel="stylesheet" href="./style.css">
  <script src="./vendor/matter.min.js"></script>
</head>
<body>
  <canvas id="stage"></canvas>
  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write minimal `style.css`**

```css
:root { --bg:#1b2a4a; --ink:#e8eefc; }
* { box-sizing: border-box; }
html, body { margin:0; height:100%; background:var(--bg); color:var(--ink);
  font-family: ui-sans-serif, system-ui, sans-serif; overscroll-behavior:none; }
#stage { display:block; width:100vw; height:100vh; touch-action:none; }
```

- [ ] **Step 4: Write minimal `js/main.js`**

```js
// Matter is provided globally by vendor/matter.min.js
console.log("Contraption Lab boot — Matter", Matter && Matter.version);
```

- [ ] **Step 5: Verify it boots**

Run:
```bash
cd contraption-lab && python3 -m http.server 8200 >/dev/null 2>&1 & sleep 1
curl -s http://localhost:8200/ | grep -c '<canvas id="stage">'
curl -s http://localhost:8200/vendor/matter.min.js | grep -o "matter-js [0-9.]*" | head -1
kill %1 2>/dev/null; cd ..
```
Expected: prints `1` then `matter-js 0.20.0`.

- [ ] **Step 6: Commit**

```bash
git add contraption-lab/
git commit -m "contraption-lab: scaffold folder + vendor Matter.js 0.20.0"
```

---

### Task 2: Geometry helpers (`geom.js`) + test harness bootstrap

**Files:**
- Create: `contraption-lab/js/geom.js`
- Create: `contraption-lab/js/level.test.js`
- Modify: `contraption-lab/js/main.js`

**Interfaces:**
- Produces:
  - `snap(value, grid)` → number rounded to nearest `grid`.
  - `aabbOverlap(a, b)` → bool. Each arg `{x,y,w,h}` is a top-left rect.
  - `pointInRect(px, py, rect)` → bool. `rect` is `{x,y,w,h}` top-left.
  - `fitTransform(worldW, worldH, viewW, viewH)` → `{scale, ox, oy}` letterbox fit (uniform scale, centered).
  - `screenToWorld(sx, sy, t)` and `worldToScreen(wx, wy, t)` using transform `t` from `fitTransform`.
  - `runTests(cases)` in `level.test.js` → runs `[{name, fn}]`, logs `✓/✗`, returns `{passed, failed}`.

- [ ] **Step 1: Write failing tests in `level.test.js`**

```js
import { snap, aabbOverlap, pointInRect, fitTransform, screenToWorld } from "./geom.js";

export function runTests(extra = []) {
  const cases = [
    { name: "snap rounds to grid", fn: () => assert(snap(23, 10) === 20) },
    { name: "snap rounds up", fn: () => assert(snap(26, 10) === 30) },
    { name: "aabb overlap true", fn: () => assert(aabbOverlap({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10})) },
    { name: "aabb overlap false", fn: () => assert(!aabbOverlap({x:0,y:0,w:5,h:5},{x:50,y:50,w:5,h:5})) },
    { name: "pointInRect", fn: () => assert(pointInRect(5,5,{x:0,y:0,w:10,h:10}) && !pointInRect(50,5,{x:0,y:0,w:10,h:10})) },
    { name: "fitTransform letterbox scale", fn: () => { const t=fitTransform(1280,720,640,720); assert(Math.abs(t.scale-0.5)<1e-9); } },
    { name: "screenToWorld inverts", fn: () => { const t=fitTransform(1280,720,1280,720); const w=screenToWorld(100,100,t); assert(Math.abs(w.x-100)<1e-9 && Math.abs(w.y-100)<1e-9); } },
    ...extra,
  ];
  let passed=0, failed=0;
  for (const c of cases) {
    try { c.fn(); passed++; console.log("✓", c.name); }
    catch (e) { failed++; console.error("✗", c.name, "—", e.message); }
  }
  console.log(`level.test.js: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}
function assert(cond, msg="assertion failed") { if (!cond) throw new Error(msg); }
```

- [ ] **Step 2: Wire `?test` into `main.js` and run to verify FAIL**

Add to `main.js`:
```js
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(m => m.runTests());
}
```
Run (Node can import the pure module directly):
```bash
cd contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(m=>m.runTests()).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: FAIL — `LOAD FAIL ... geom.js` (module does not exist yet).

- [ ] **Step 3: Implement `geom.js`**

```js
export const snap = (v, grid) => Math.round(v / grid) * grid;

export const aabbOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const pointInRect = (px, py, r) =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export function fitTransform(worldW, worldH, viewW, viewH) {
  const scale = Math.min(viewW / worldW, viewH / worldH);
  return { scale, ox: (viewW - worldW * scale) / 2, oy: (viewH - worldH * scale) / 2 };
}
export const worldToScreen = (wx, wy, t) => ({ x: wx * t.scale + t.ox, y: wy * t.scale + t.oy });
export const screenToWorld = (sx, sy, t) => ({ x: (sx - t.ox) / t.scale, y: (sy - t.oy) / t.scale });
```

- [ ] **Step 4: Run tests to verify PASS**

Run:
```bash
cd contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(m=>{const r=m.runTests();process.exit(r.failed?1:0)})"; cd ..
```
Expected: `level.test.js: 7 passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add contraption-lab/js/geom.js contraption-lab/js/level.test.js contraption-lab/js/main.js
git commit -m "contraption-lab: geometry helpers + ?test harness"
```

---

### Task 3: Part registry (`parts.js`)

**Files:**
- Create: `contraption-lab/js/parts.js`

**Interfaces:**
- Consumes: global `Matter` (Bodies, Body, Constraint, Composite).
- Produces:
  - `PARTS` — object keyed by type. Each entry: `{ label, movable, fixedByDefault, build(spec, M), draw }` where:
    - `build(spec, M)` returns `{ bodies:[...], constraints:[...] }` positioned at `spec.x,spec.y` (world coords, center), rotated `spec.angle||0`. `M` is `Matter`. Each created Matter body has `body.plugin = { partType, tag: spec.tag||null }`.
    - `draw(ctx, body, theme)` is optional custom render; if absent, `render.js` falls back to polygon stroke/fill from theme tokens.
  - `PALETTE_TYPES` — array of player-placeable types: `["ramp","wall","fan","conveyor","seesaw","balloon","domino","bucket"]`.
  - `makePart(type, spec)` → calls the registry's build; throws `Error("unknown part type: "+type)` for unknown types (graceful-failure hook for level loader).

- [ ] **Step 1: Add part tests to the extra cases in `main.js` test call**

Modify the `?test` import in `main.js`:
```js
if (new URLSearchParams(location.search).has("test")) {
  Promise.all([import("./level.test.js"), import("./parts.js")]).then(([t, p]) => {
    t.runTests([
      { name: "PALETTE_TYPES non-empty", fn: () => { if (!p.PALETTE_TYPES.length) throw new Error("empty"); } },
      { name: "makePart ball builds a body", fn: () => { const r = p.makePart("ball", {x:100,y:100}); if (!r.bodies.length) throw new Error("no body"); } },
      { name: "makePart unknown throws", fn: () => { try { p.makePart("nope", {x:0,y:0}); throw new Error("did not throw"); } catch(e){ if(!/unknown/.test(e.message)) throw e; } } },
      { name: "ball body tagged", fn: () => { const r = p.makePart("ball", {x:1,y:1,tag:"goal"}); if (r.bodies[0].plugin.tag!=="goal") throw new Error("no tag"); } },
    ]);
  });
}
```
Run: `cd contraption-lab && node --input-type=module -e "Promise.all([import('./js/level.test.js'),import('./js/parts.js')]).then(([t,p])=>{const r=t.runTests([{name:'palette',fn:()=>{if(!p.PALETTE_TYPES.length)throw new Error('e')}},{name:'ball',fn:()=>{if(!p.makePart('ball',{x:1,y:1}).bodies.length)throw new Error('e')}},{name:'unknown',fn:()=>{try{p.makePart('nope',{x:0,y:0});throw new Error('no')}catch(e){if(!/unknown/.test(e.message))throw e}}}]);process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..`
Expected: FAIL — `LOAD FAIL ... parts.js`.

- [ ] **Step 2: Implement `parts.js`**

```js
// Each build() returns {bodies, constraints}. All Matter bodies get
// plugin = { partType, tag }. Coordinates are world-space, x/y = center.
const cat = (M, partType, tag) => b => { b.plugin = { partType, tag: tag || null }; return b; };

export const PARTS = {
  ball: {
    label: "Ball", movable: false, fixedByDefault: false,
    build: (s, M) => ({ bodies: [cat(M,"ball",s.tag)(M.Bodies.circle(s.x, s.y, s.r||18, { restitution:0.45, friction:0.05, density:0.004 }))], constraints: [] }),
  },
  wall: {
    label: "Wall", movable: true, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"wall",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||120, s.h||24, { isStatic:true, angle:s.angle||0, friction:0.4 }))], constraints: [] }),
  },
  ramp: {
    label: "Ramp", movable: true, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"ramp",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||160, s.h||16, { isStatic:true, angle:s.angle ?? -0.3, friction:0.3 }))], constraints: [] }),
  },
  domino: {
    label: "Domino", movable: true, fixedByDefault: false,
    build: (s, M) => ({ bodies: [cat(M,"domino",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||16, s.h||72, { density:0.006, friction:0.4, angle:s.angle||0 }))], constraints: [] }),
  },
  balloon: {
    label: "Balloon", movable: true, fixedByDefault: false,
    // negative-ish density + applied upward force handled by engine via plugin.lift
    build: (s, M) => { const b = M.Bodies.circle(s.x, s.y, s.r||22, { density:0.0009, frictionAir:0.04, restitution:0.2 }); b.plugin = { partType:"balloon", tag:s.tag||null, lift:0.0009 }; return { bodies:[b], constraints:[] }; },
  },
  bucket: {
    label: "Bucket", movable: true, fixedByDefault: false,
    build: (s, M) => {
      const w = s.w||90, h = s.h||70, t = 10;
      const parts = [
        M.Bodies.rectangle(s.x, s.y + h/2, w, t, {}),
        M.Bodies.rectangle(s.x - w/2, s.y, t, h, {}),
        M.Bodies.rectangle(s.x + w/2, s.y, t, h, {}),
      ];
      const body = M.Body.create({ parts, friction:0.4, density:0.003 });
      return { bodies: [cat(M,"bucket",s.tag)(body)], constraints: [] };
    },
  },
  fan: {
    label: "Fan", movable: true, fixedByDefault: true,
    // engine reads plugin.force each tick to push overlapping bodies along angle
    build: (s, M) => { const b = M.Bodies.rectangle(s.x, s.y, 54, 54, { isStatic:true, angle:s.angle||0 }); b.plugin = { partType:"fan", tag:s.tag||null, force:s.force||0.02, range:s.range||220 }; return { bodies:[b], constraints:[] }; },
  },
  conveyor: {
    label: "Conveyor", movable: true, fixedByDefault: true,
    // engine reads plugin.surfaceSpeed to set tangential velocity on contact
    build: (s, M) => { const b = M.Bodies.rectangle(s.x, s.y, s.w||160, 18, { isStatic:true, angle:s.angle||0, friction:0.9 }); b.plugin = { partType:"conveyor", tag:s.tag||null, surfaceSpeed:s.surfaceSpeed||3 }; return { bodies:[b], constraints:[] }; },
  },
  seesaw: {
    label: "Seesaw", movable: true, fixedByDefault: true,
    build: (s, M) => {
      const plank = cat(M,"seesaw",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||180, 16, { density:0.002, friction:0.4 }));
      const pivot = M.Constraint.create({ pointA:{x:s.x,y:s.y}, bodyB:plank, pointB:{x:0,y:0}, stiffness:1, length:0 });
      return { bodies:[plank], constraints:[pivot] };
    },
  },
  goal: {
    // visual-only target marker; the win zone is in level.goal, not a body
    label: "Goal", movable: false, fixedByDefault: true,
    build: (s, M) => ({ bodies: [cat(M,"goal",s.tag)(M.Bodies.rectangle(s.x, s.y, s.w||110, s.h||110, { isStatic:true, isSensor:true }))], constraints: [] }),
  },
};

export const PALETTE_TYPES = ["ramp","wall","fan","conveyor","seesaw","balloon","domino","bucket"];

export function makePart(type, spec) {
  const def = PARTS[type];
  if (!def) throw new Error("unknown part type: " + type);
  return def.build(spec, Matter);
}
```

- [ ] **Step 3: Run tests to verify PASS**

Run the same command from Step 1.
Expected: all green, including the 4 new part cases; exit 0.

> Note: `node` lacks the `Matter` global, so the Node test command stubs it. Prepend `globalThis.Matter = await import('./vendor/matter.min.js').then(m=>m.default||m.Matter||globalThis.Matter)` is brittle; instead the Node command sets a minimal stub. Use this exact command:
```bash
cd contraption-lab && node --input-type=module -e "globalThis.Matter={Bodies:{circle:(x,y,r,o)=>({position:{x,y},plugin:{}}),rectangle:(x,y,w,h,o)=>({position:{x,y},plugin:{}})},Body:{create:(o)=>({...o,plugin:{}})},Constraint:{create:()=>({})}};Promise.all([import('./js/level.test.js'),import('./js/parts.js')]).then(([t,p])=>{const r=t.runTests([{name:'palette',fn:()=>{if(!p.PALETTE_TYPES.length)throw new Error('e')}},{name:'ball',fn:()=>{if(!p.makePart('ball',{x:1,y:1}).bodies.length)throw new Error('e')}},{name:'unknown',fn:()=>{try{p.makePart('nope',{x:0,y:0});throw new Error('no')}catch(e){if(!/unknown/.test(e.message))throw e}}},{name:'tag',fn:()=>{if(p.makePart('ball',{x:1,y:1,tag:'g'}).bodies[0].plugin.tag!=='g')throw new Error('e')}}]);process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: `11 passed, 0 failed`.

- [ ] **Step 4: Commit**

```bash
git add contraption-lab/js/parts.js contraption-lab/js/main.js
git commit -m "contraption-lab: part registry (10 part types)"
```

---

### Task 4: Level schema + world builder (`level.js`)

**Files:**
- Create: `contraption-lab/js/level.js`

**Interfaces:**
- Consumes: `makePart`, `PARTS` from `parts.js`; `aabbOverlap` from `geom.js`.
- Produces:
  - `SCHEMA_VERSION = 1`.
  - `validateLevel(level)` → `{ ok:true } | { ok:false, reason }`. Fails when: `schema !== 1`, missing `world`/`goal`/`inventory`, any `fixed`/`start` entry uses a type absent from `PARTS`, or goal.type unsupported (only `"dwell"` in Phase 1).
  - `cloneLevel(level)` → deep copy (structuredClone).
  - `buildWorld(level, M)` → `{ engine, world, bodies, goalZone }`: creates a `Matter.Engine`, adds boundary walls at world edges, builds all `fixed` + `start` parts, sets gravity from `level.world.gravity`. Returns the engine, the goal zone rect `{x,y,w,h}` (top-left, converted from level.goal.zone which is center-based... see note), and a flat list of created bodies.
  - `serializeLevel(level)` → canonical JSON string (stable key order) for storage/round-trip.

> Goal-zone convention: `level.goal.zone` is `{x,y,w,h}` with x,y = **center** (consistent with part placement). `buildWorld` returns `goalZone` as a **top-left** rect for `aabbOverlap`. Document this in the file header.

- [ ] **Step 1: Add level tests (extra cases)**

Append to the Node test command a `level.js` import with these assertions (also keep them as named cases in `level.test.js`'s default export by importing level lazily). Add to `level.test.js`:
```js
export async function levelCases() {
  const L = await import("./level.js");
  const good = { schema:1, id:"t", title:"T", world:{w:1280,h:720,gravity:1},
    goal:{type:"dwell",object:"ball",zone:{x:100,y:100,w:50,h:50},ms:300},
    fixed:[{type:"wall",x:10,y:10}], start:[{type:"ball",x:5,y:5,tag:"ball"}], inventory:[{type:"ramp",count:2}] };
  return [
    { name:"validate accepts good level", fn:()=>{ if(!L.validateLevel(good).ok) throw new Error("rejected"); } },
    { name:"validate rejects bad schema", fn:()=>{ if(L.validateLevel({...good,schema:99}).ok) throw new Error("accepted"); } },
    { name:"validate rejects unknown type", fn:()=>{ if(L.validateLevel({...good,fixed:[{type:"xxx",x:0,y:0}]}).ok) throw new Error("accepted"); } },
    { name:"serialize round-trips", fn:()=>{ const s=L.serializeLevel(good); const o=JSON.parse(s); if(o.title!=="T") throw new Error("lost data"); } },
    { name:"clone is deep", fn:()=>{ const c=L.cloneLevel(good); c.title="X"; if(good.title!=="T") throw new Error("mutated"); } },
  ];
}
```

- [ ] **Step 2: Run to verify FAIL**

Run:
```bash
cd contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(async m=>{const r=m.runTests(await m.levelCases());process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: `LOAD FAIL ... level.js`.

- [ ] **Step 3: Implement `level.js`**

```js
import { PARTS, makePart } from "./parts.js";

export const SCHEMA_VERSION = 1;
const SUPPORTED_GOALS = ["dwell"];

export function validateLevel(level) {
  if (!level || typeof level !== "object") return { ok:false, reason:"not an object" };
  if (level.schema !== SCHEMA_VERSION) return { ok:false, reason:`schema ${level.schema} != ${SCHEMA_VERSION}` };
  if (!level.world || !level.goal || !Array.isArray(level.inventory)) return { ok:false, reason:"missing world/goal/inventory" };
  if (!SUPPORTED_GOALS.includes(level.goal.type)) return { ok:false, reason:`unsupported goal ${level.goal.type}` };
  for (const grp of ["fixed","start"]) {
    for (const e of (level[grp]||[])) {
      if (!PARTS[e.type]) return { ok:false, reason:`unknown part type ${e.type}` };
    }
  }
  for (const inv of level.inventory) if (!PARTS[inv.type]) return { ok:false, reason:`unknown inventory type ${inv.type}` };
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
  const walls = [
    M.Bodies.rectangle(W/2, -t/2, W, t, { isStatic:true }),
    M.Bodies.rectangle(W/2, H + t/2, W, t, { isStatic:true }),
    M.Bodies.rectangle(-t/2, H/2, t, H, { isStatic:true }),
    M.Bodies.rectangle(W + t/2, H/2, t, H, { isStatic:true }),
  ];
  walls.forEach(b => b.plugin = { partType:"boundary", tag:null });
  M.Composite.add(world, walls);

  const bodies = [...walls];
  for (const grp of ["fixed","start"]) {
    for (const spec of (level[grp]||[])) {
      const { bodies: bs, constraints } = makePart(spec.type, spec);
      bs.forEach(b => { if (spec.angle) M.Body.setAngle(b, spec.angle); });
      M.Composite.add(world, bs);
      if (constraints.length) M.Composite.add(world, constraints);
      bodies.push(...bs);
    }
  }
  const z = level.goal.zone;
  const goalZone = { x: z.x - z.w/2, y: z.y - z.h/2, w: z.w, h: z.h };
  return { engine, world, bodies, goalZone };
}
```

- [ ] **Step 4: Run to verify PASS**

Run the Step 2 command.
Expected: `12 passed, 0 failed` (7 geom + 5 level), exit 0.

- [ ] **Step 5: Commit**

```bash
git add contraption-lab/js/level.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: level schema validate/serialize + world builder"
```

---

### Task 5: Official levels (`levels/official.js`)

**Files:**
- Create: `contraption-lab/js/levels/official.js`

**Interfaces:**
- Consumes: nothing at import; validated by `validateLevel` in tests.
- Produces: `OFFICIAL_LEVELS` — array of ≥8 level objects (target 10), each passing `validateLevel`, ascending difficulty, ids `official-01`…`official-NN`. First level solvable with 1–2 parts; later ones need chains.

- [ ] **Step 1: Add a test that every official level validates + is winnable-shaped**

Add to `level.test.js`:
```js
export async function officialCases() {
  const L = await import("./level.js");
  const { OFFICIAL_LEVELS } = await import("./levels/official.js");
  const cases = [
    { name:"at least 8 official levels", fn:()=>{ if(OFFICIAL_LEVELS.length < 8) throw new Error("only "+OFFICIAL_LEVELS.length); } },
    { name:"ids unique + sequential", fn:()=>{ const ids=OFFICIAL_LEVELS.map(l=>l.id); if(new Set(ids).size!==ids.length) throw new Error("dup ids"); } },
  ];
  OFFICIAL_LEVELS.forEach((lvl,i) => cases.push({ name:`level ${i+1} (${lvl.id}) validates`, fn:()=>{ const v=L.validateLevel(lvl); if(!v.ok) throw new Error(v.reason); } }));
  // every level must give the player at least one inventory part
  OFFICIAL_LEVELS.forEach((lvl,i) => cases.push({ name:`level ${i+1} has inventory`, fn:()=>{ if(!lvl.inventory.reduce((a,b)=>a+b.count,0)) throw new Error("no parts"); } }));
  return cases;
}
```

- [ ] **Step 2: Run to verify FAIL**

Run:
```bash
cd contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(async m=>{const r=m.runTests([...await m.levelCases(),...await m.officialCases()]);process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: `LOAD FAIL ... official.js`.

- [ ] **Step 3: Implement `levels/official.js`**

Author 10 levels. Use this exact starter set as the first three and follow the same shape for the remaining seven (escalating: add fan, conveyor, seesaw chains, balloon lift, multi-part Rube Goldberg). World is always `{w:1280,h:720,gravity:1}`. Coordinates are center-based.

```js
const lvl = (id, title, goal, fixed, start, inventory, par) =>
  ({ schema:1, id, title, author:"official", world:{w:1280,h:720,gravity:1}, goal, fixed, start, inventory, par });

const goalAt = (x,y) => ({ type:"dwell", object:"ball", zone:{x,y,w:120,h:120}, ms:500 });

export const OFFICIAL_LEVELS = [
  lvl("official-01","First Drop",
    goalAt(1080,620),
    [ {type:"wall",x:1080,y:700,w:240,h:30}, {type:"goal",x:1080,y:620} ],
    [ {type:"ball",x:200,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1} ], {parts:1}),

  lvl("official-02","Over the Wall",
    goalAt(1120,600),
    [ {type:"wall",x:640,y:560,w:30,h:320}, {type:"wall",x:1120,y:680,w:300,h:30}, {type:"goal",x:1120,y:600} ],
    [ {type:"ball",x:160,y:120,tag:"ball"} ],
    [ {type:"ramp",count:2} ], {parts:2}),

  lvl("official-03","Fan Assist",
    goalAt(220,600),
    [ {type:"wall",x:220,y:680,w:260,h:30}, {type:"goal",x:220,y:600} ],
    [ {type:"ball",x:1080,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1}, {type:"fan",count:1} ], {parts:2}),

  // official-04 … official-10: author following the same shape, escalating difficulty.
  // 04 "Seesaw Launch": ball drops on one end of a placed seesaw to flip a resting ball into a bucket goal.
  // 05 "Conveyor Carry": player places a conveyor to ferry the ball across a pit to the goal.
  // 06 "Float Up": balloon lifts a ball through a gap; player aims it with a ramp.
  // 07 "Domino Run": player lines dominoes so a fall knocks the ball off a ledge into the goal.
  // 08 "Switchbacks": two ramps zig-zag the ball down past walls into the goal.
  // 09 "Catch & Drop": fan holds a balloon, conveyor delivers ball to bucket, seesaw tips it to goal.
  // 10 "Grand Contraption": ramp→conveyor→seesaw→fan chain; inventory of 5 mixed parts.
  lvl("official-04","Seesaw Launch", goalAt(1100,560),
    [ {type:"wall",x:1100,y:640,w:260,h:30}, {type:"bucket",x:700,y:600}, {type:"goal",x:1100,y:560} ],
    [ {type:"ball",x:160,y:100,tag:"ball"} ],
    [ {type:"ramp",count:1},{type:"seesaw",count:1} ], {parts:2}),
  lvl("official-05","Conveyor Carry", goalAt(1140,600),
    [ {type:"wall",x:300,y:680,w:300,h:30}, {type:"wall",x:1140,y:680,w:260,h:30}, {type:"goal",x:1140,y:600} ],
    [ {type:"ball",x:200,y:560,tag:"ball"} ],
    [ {type:"conveyor",count:1},{type:"ramp",count:1} ], {parts:2}),
  lvl("official-06","Float Up", goalAt(640,160),
    [ {type:"wall",x:640,y:400,w:520,h:30}, {type:"wall",x:300,y:200,w:30,h:430}, {type:"goal",x:640,y:160} ],
    [ {type:"ball",x:200,y:560,tag:"ball"} ],
    [ {type:"balloon",count:1},{type:"ramp",count:1} ], {parts:2}),
  lvl("official-07","Domino Run", goalAt(1080,600),
    [ {type:"wall",x:500,y:300,w:400,h:24}, {type:"wall",x:1080,y:680,w:260,h:30}, {type:"goal",x:1080,y:600} ],
    [ {type:"ball",x:340,y:250,tag:"ball"} ],
    [ {type:"domino",count:4} ], {parts:4}),
  lvl("official-08","Switchbacks", goalAt(1100,640),
    [ {type:"wall",x:500,y:280,w:30,h:200}, {type:"wall",x:760,y:460,w:30,h:200}, {type:"wall",x:1100,y:700,w:260,h:30}, {type:"goal",x:1100,y:640} ],
    [ {type:"ball",x:200,y:100,tag:"ball"} ],
    [ {type:"ramp",count:3} ], {parts:3}),
  lvl("official-09","Catch & Drop", goalAt(220,600),
    [ {type:"wall",x:220,y:680,w:260,h:30}, {type:"bucket",x:640,y:560}, {type:"goal",x:220,y:600} ],
    [ {type:"ball",x:1080,y:120,tag:"ball"} ],
    [ {type:"ramp",count:1},{type:"conveyor",count:1},{type:"seesaw",count:1} ], {parts:3}),
  lvl("official-10","Grand Contraption", goalAt(1120,600),
    [ {type:"wall",x:1120,y:680,w:280,h:30}, {type:"wall",x:520,y:520,w:30,h:300}, {type:"goal",x:1120,y:600} ],
    [ {type:"ball",x:140,y:80,tag:"ball"} ],
    [ {type:"ramp",count:2},{type:"conveyor",count:1},{type:"seesaw",count:1},{type:"fan",count:1} ], {parts:5}),
];
```

> The implementer MUST author levels 04–10 as full objects (above gives them all); during the in-browser playtest (Task 11) verify each is solvable and adjust coordinates as needed. Levels are data — tweaking numbers is expected and is not a schema change.

- [ ] **Step 4: Run to verify PASS**

Run the Step 2 command.
Expected: all green; `≥ 24 passed` (geom 7 + level 5 + official 2 + per-level cases), exit 0.

- [ ] **Step 5: Commit**

```bash
git add contraption-lab/js/levels/official.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: 10 official levels (data, validated)"
```

---

### Task 6: Theme system (`theme.js`) + theme token sets in `style.css`

**Files:**
- Create: `contraption-lab/js/theme.js`
- Modify: `contraption-lab/style.css`

**Interfaces:**
- Produces:
  - `THEMES` — `[{id,label}]`: `blueprint` (default), `cartoon`, `neon`, `toy`.
  - `applyTheme(id)` — sets `document.documentElement.dataset.theme` and persists to `localStorage["cl.theme"]`.
  - `loadTheme()` — returns persisted id or `"blueprint"`.
  - `tokens()` — returns an object of the current computed theme colors read from CSS: `{ bg, ink, grid, partFill, partStroke, fixedFill, accent, goal }` (via `getComputedStyle(document.documentElement)`).

- [ ] **Step 1: Implement theme token sets in `style.css`**

Replace the `:root` block and add per-theme overrides:
```css
:root, [data-theme="blueprint"] {
  --bg:#13233f; --ink:#dce7fb; --grid:#21installed; /* see note */
  --grid:#274a86; --part-fill:#3a6bb8; --part-stroke:#cfe0ff;
  --fixed-fill:#1c3considered; --fixed-fill:#1c365f; --accent:#ffd166; --goal:#52e0a3;
  --font:"Courier New", ui-monospace, monospace;
}
[data-theme="cartoon"] {
  --bg:#fff4d6; --ink:#3a2a16; --grid:#f0dca8; --part-fill:#ff8c42; --part-stroke:#7a3b10;
  --fixed-fill:#8d5524; --accent:#e63946; --goal:#2a9d8f; --font:"Comic Sans MS", ui-rounded, system-ui, sans-serif;
}
[data-theme="neon"] {
  --bg:#0a0a14; --ink:#d7f7ff; --grid:#1b2b3a; --part-fill:#13aef0; --part-stroke:#7df9ff;
  --fixed-fill:#16203a; --accent:#ff2e88; --goal:#39ff14; --font:ui-monospace, "Courier New", monospace;
}
[data-theme="toy"] {
  --bg:#f3f5f8; --ink:#2b3440; --grid:#e2e8f0; --part-fill:#6c8cff; --part-stroke:#3450c0;
  --fixed-fill:#a3b1c6; --accent:#ff7a59; --goal:#34c759; --font:ui-rounded, system-ui, -apple-system, sans-serif;
}
body { font-family: var(--font); }
```
> Remove the placeholder `--grid:#21installed` / `--fixed-fill:#1c3considered` garbage lines — they are intentional STOP markers so the implementer writes real hex values. Final blueprint `--grid:#274a86;` and `--fixed-fill:#1c365f;` are correct.

- [ ] **Step 2: Implement `theme.js`**

```js
export const THEMES = [
  { id:"blueprint", label:"Blueprint" },
  { id:"cartoon",   label:"Cartoon" },
  { id:"neon",      label:"Neon" },
  { id:"toy",       label:"Clean Toy" },
];
const KEY = "cl.theme";
export const loadTheme = () => localStorage.getItem(KEY) || "blueprint";
export function applyTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, id); } catch {}
}
export function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = n => s.getPropertyValue(n).trim();
  return { bg:v("--bg"), ink:v("--ink"), grid:v("--grid"), partFill:v("--part-fill"),
    partStroke:v("--part-stroke"), fixedFill:v("--fixed-fill"), accent:v("--accent"), goal:v("--goal") };
}
```

- [ ] **Step 3: Verify themes apply in-browser**

Run:
```bash
cd contraption-lab && python3 -m http.server 8200 >/dev/null 2>&1 & sleep 1
curl -s http://localhost:8200/style.css | grep -c 'data-theme="neon"'
kill %1 2>/dev/null; cd ..
```
Expected: prints `1`. (Visual confirmation of all four themes happens in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add contraption-lab/js/theme.js contraption-lab/style.css
git commit -m "contraption-lab: 4-theme token system (blueprint default)"
```

---

### Task 7: Renderer (`render.js`)

**Files:**
- Create: `contraption-lab/js/render.js`

**Interfaces:**
- Consumes: `tokens()` from `theme.js`; `worldToScreen` from `geom.js`; global `Matter`.
- Produces:
  - `drawWorld(ctx, { bodies, goalZone }, transform, theme, opts)` — clears, draws themed grid, draws each Matter body as its vertices polygon (fill by `body.isStatic ? fixedFill : partFill`, stroke `partStroke`), draws the goal zone as a dashed `goal`-colored rect, optional ghost for a part being placed (`opts.ghost = {vertices,valid}`).
  - `resizeCanvas(canvas)` → sets canvas width/height to `clientWidth*dpr` and returns `{transform}` via `fitTransform(1280,720,...)`.

- [ ] **Step 1: Implement `render.js`**

```js
import { tokens } from "./theme.js";
import { fitTransform, worldToScreen } from "./geom.js";

export function resizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const transform = fitTransform(1280, 720, canvas.width, canvas.height);
  return { transform, dpr };
}

export function drawWorld(ctx, state, transform, theme, opts = {}) {
  const t = transform;
  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // grid (every 40 world units)
  ctx.strokeStyle = theme.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= 1280; x += 40) { const a = worldToScreen(x,0,t), b = worldToScreen(x,720,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
  for (let y = 0; y <= 720; y += 40) { const a = worldToScreen(0,y,t), b = worldToScreen(1280,y,t); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }
  ctx.stroke();

  // goal zone
  if (state.goalZone) {
    const z = state.goalZone, p = worldToScreen(z.x, z.y, t);
    ctx.strokeStyle = theme.goal; ctx.lineWidth = 3; ctx.setLineDash([10,8]);
    ctx.strokeRect(p.x, p.y, z.w * t.scale, z.h * t.scale); ctx.setLineDash([]);
  }

  // bodies
  for (const body of state.bodies || []) {
    if (body.plugin && body.plugin.partType === "boundary") continue;
    const parts = body.parts && body.parts.length > 1 ? body.parts.slice(1) : [body];
    ctx.fillStyle = body.isStatic ? theme.fixedFill : theme.partFill;
    ctx.strokeStyle = theme.partStroke; ctx.lineWidth = 2;
    for (const part of parts) {
      const vs = part.vertices;
      ctx.beginPath();
      const p0 = worldToScreen(vs[0].x, vs[0].y, t); ctx.moveTo(p0.x, p0.y);
      for (let i=1;i<vs.length;i++){ const p = worldToScreen(vs[i].x, vs[i].y, t); ctx.lineTo(p.x,p.y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // ghost (part being placed)
  if (opts.ghost) {
    const g = opts.ghost;
    ctx.globalAlpha = 0.5; ctx.fillStyle = g.valid ? theme.accent : "#e23"; 
    ctx.beginPath();
    const v = g.vertices; const p0 = worldToScreen(v[0].x,v[0].y,t); ctx.moveTo(p0.x,p0.y);
    for (let i=1;i<v.length;i++){ const p = worldToScreen(v[i].x,v[i].y,t); ctx.lineTo(p.x,p.y); }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
```

- [ ] **Step 2: Syntax-check the module loads**

Run:
```bash
cd contraption-lab && node --check js/render.js && echo "render.js OK"; cd ..
```
Expected: `render.js OK`. (Visual verification in Task 11.)

- [ ] **Step 3: Commit**

```bash
git add contraption-lab/js/render.js
git commit -m "contraption-lab: themed canvas renderer"
```

---

### Task 8: Simulation engine (`engine.js`)

**Files:**
- Create: `contraption-lab/js/engine.js`

**Interfaces:**
- Consumes: `buildWorld` from `level.js`; `aabbOverlap`, `pointInRect` from `geom.js`; global `Matter`.
- Produces a `Sim` class:
  - `new Sim(level)` — calls `buildWorld`; state = `"build"`.
  - `sim.state` → `"build" | "running" | "won" | "lost"`.
  - `sim.bodies`, `sim.goalZone`, `sim.world`, `sim.engine` — for the renderer/input.
  - `sim.addPlayerPart(type, x, y, angle)` → adds a part during build, records it in `sim.placed` (array of specs), returns the created bodies. Player parts start `isStatic` during build.
  - `sim.removeBodyAt(wx, wy)` → removes a player-placed part under the point; returns bool.
  - `sim.run()` → snapshots placed parts, un-freezes player dynamic parts, sets `state="running"`, starts the dwell timer + 30s max-run timer.
  - `sim.reset()` → rebuilds world from level + snapshot, `state="build"`.
  - `sim.step(dtMs)` → advances `Matter.Engine.update`, applies fan/conveyor/balloon plugin forces, checks dwell win → sets `state="won"`, enforces max-run → `state="lost"` (timeout). Returns current state.
  - `sim.partsUsed()` → count of placed player parts (for par scoring).

- [ ] **Step 1: Implement `engine.js`**

```js
import { buildWorld } from "./level.js";
import { aabbOverlap } from "./geom.js";

const MAX_RUN_MS = 30000;
const M = () => Matter;

export class Sim {
  constructor(level) {
    this.level = level;
    this.placed = [];           // player-added specs {type,x,y,angle}
    this._build();
  }
  _build() {
    const m = M();
    const w = buildWorld(this.level, m);
    this.engine = w.engine; this.world = w.world; this.bodies = w.bodies; this.goalZone = w.goalZone;
    // re-add any placed parts (static during build)
    for (const spec of this.placed) this._spawn(spec, true);
    this.state = "build"; this.elapsed = 0; this.dwell = 0;
  }
  _spawn(spec, staticDuringBuild) {
    const m = M();
    const def = (window.__PARTS || null); // not used; makePart via level import path
    const { makePart } = window.__clParts;  // injected in main.js to avoid circular import
    const { bodies, constraints } = makePart(spec.type, spec);
    bodies.forEach(b => { if (spec.angle) m.Body.setAngle(b, spec.angle); if (staticDuringBuild) m.Body.setStatic(b, true); });
    m.Composite.add(this.world, bodies);
    if (constraints && constraints.length) m.Composite.add(this.world, constraints);
    this.bodies.push(...bodies);
    return bodies;
  }
  addPlayerPart(type, x, y, angle=0) {
    const spec = { type, x, y, angle };
    this.placed.push(spec);
    return this._spawn(spec, true);
  }
  removeBodyAt(wx, wy) {
    const m = M();
    const hit = m.Query.point(this.bodies.filter(b => b.plugin && b.plugin.partType && !b.isStatic || (b.plugin && this._isPlaced(b))), { x:wx, y:wy })[0];
    // simpler: match against placed specs by proximity
    let idx = -1, best = 1e9;
    this.placed.forEach((s,i) => { const d=(s.x-wx)**2+(s.y-wy)**2; if(d<best){best=d;idx=i;} });
    if (idx>=0 && best < 80*80) { this.placed.splice(idx,1); this._build(); return true; }
    return false;
  }
  _isPlaced() { return false; }
  run() {
    const m = M();
    // unfreeze player dynamic parts: rebuild placed parts as non-static where their def says movable & not fixedByDefault
    this._build();                         // clean rebuild
    for (const b of this.bodies) {
      const pt = b.plugin && b.plugin.partType;
      const def = window.__clPartDefs && window.__clPartDefs[pt];
      if (def && this._wasPlaced(b) && !def.fixedByDefault) m.Body.setStatic(b, false);
    }
    this.state = "running"; this.elapsed = 0; this.dwell = 0;
  }
  _wasPlaced(b) { return this.placed.some(s => s.type === (b.plugin&&b.plugin.partType)); }
  step(dtMs) {
    if (this.state !== "running") return this.state;
    const m = M();
    this._applyForces();
    m.Engine.update(this.engine, Math.min(dtMs, 1000/30));
    this.elapsed += dtMs;
    // dwell win check
    const obj = this.bodies.find(b => b.plugin && b.plugin.tag === this.level.goal.object);
    if (obj) {
      const r = { x: obj.bounds.min.x, y: obj.bounds.min.y, w: obj.bounds.max.x-obj.bounds.min.x, h: obj.bounds.max.y-obj.bounds.min.y };
      if (aabbOverlap(r, this.goalZone)) this.dwell += dtMs; else this.dwell = 0;
      if (this.dwell >= (this.level.goal.ms||500)) this.state = "won";
    }
    if (this.elapsed > MAX_RUN_MS) this.state = "lost";
    return this.state;
  }
  _applyForces() {
    const m = M();
    for (const f of this.bodies) {
      const pl = f.plugin || {};
      if (pl.partType === "fan") {
        const dir = { x: Math.cos(f.angle - Math.PI/2), y: Math.sin(f.angle - Math.PI/2) };
        for (const b of this.bodies) {
          if (b.isStatic) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          if (dx*dx+dy*dy < (pl.range||220)**2) m.Body.applyForce(b, b.position, { x: dir.x*pl.force, y: dir.y*pl.force });
        }
      } else if (pl.partType === "balloon" && !f.isStatic) {
        m.Body.applyForce(f, f.position, { x:0, y:-(pl.lift||0.0009) });
      } else if (pl.partType === "conveyor") {
        for (const b of this.bodies) {
          if (b.isStatic) continue;
          if (Math.abs(b.position.y - f.position.y) < 40 && Math.abs(b.position.x - f.position.x) < (f.bounds.max.x-f.bounds.min.x)/2 + 20 && b.position.y < f.position.y) {
            m.Body.setVelocity(b, { x: pl.surfaceSpeed||3, y: b.velocity.y });
          }
        }
      }
    }
  }
  reset() { this._build(); }
  partsUsed() { return this.placed.length; }
}
```

> **Circular-import note for implementer:** `engine.js` must call `makePart` and read part defs, but `level.js` already imports `parts.js`. To keep modules clean, `main.js` injects them: `window.__clParts = { makePart }; window.__clPartDefs = PARTS;` at boot (see Task 10). If you prefer, import `parts.js` directly in `engine.js` instead — there is no real cycle (`parts.js` imports nothing from `engine.js`). The direct import is cleaner; use `import { makePart, PARTS } from "./parts.js";` and replace the `window.__cl*` lookups. Resolve this during implementation and keep one approach.

- [ ] **Step 2: Refactor to direct import (resolve the note) and syntax-check**

Replace the `window.__cl*` indirection with `import { makePart, PARTS } from "./parts.js";` at the top, and use `makePart(...)` / `PARTS[pt]` directly. Then:
```bash
cd contraption-lab && node --check js/engine.js && echo "engine.js OK"; cd ..
```
Expected: `engine.js OK`.

- [ ] **Step 3: Commit**

```bash
git add contraption-lab/js/engine.js
git commit -m "contraption-lab: Sim engine — build/run/reset, dwell win, part forces"
```

---

### Task 9: Progress persistence (`progress.js`)

**Files:**
- Create: `contraption-lab/js/progress.js`

**Interfaces:**
- Produces:
  - `getProgress()` → `{ [levelId]: { solved:bool, bestParts:number, bestMs:number } }` from `localStorage["cl.progress"]` (`{}` if none/corrupt).
  - `recordSolve(levelId, parts, ms)` → merges best-of (lower parts wins; tie → lower ms), persists, returns the merged entry.
  - `isSolved(levelId)` → bool.
  - `mergeProgress(a, b)` → pure best-of merge of two progress maps (used now for corruption-safe load; reused by Phase 2 for remote sync).

- [ ] **Step 1: Add progress tests**

Add to `level.test.js`:
```js
export async function progressCases() {
  const P = await import("./progress.js");
  return [
    { name:"mergeProgress best-of parts", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:5,bestMs:9000}},{a:{solved:true,bestParts:3,bestMs:9999}}); if(m.a.bestParts!==3) throw new Error("got "+m.a.bestParts); } },
    { name:"mergeProgress tie breaks on ms", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:3,bestMs:8000}},{a:{solved:true,bestParts:3,bestMs:5000}}); if(m.a.bestMs!==5000) throw new Error("got "+m.a.bestMs); } },
    { name:"mergeProgress unions keys", fn:()=>{ const m=P.mergeProgress({a:{solved:true,bestParts:1,bestMs:1}},{b:{solved:true,bestParts:1,bestMs:1}}); if(!m.a||!m.b) throw new Error("lost key"); } },
  ];
}
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd contraption-lab && node --input-type=module -e "import('./js/level.test.js').then(async m=>{const r=m.runTests(await m.progressCases());process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message);process.exit(1)})"; cd ..
```
Expected: `LOAD FAIL ... progress.js`.

- [ ] **Step 3: Implement `progress.js`**

```js
const KEY = "cl.progress";

export function mergeProgress(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    if (!x) { out[id] = y; continue; }
    if (!y) { out[id] = x; continue; }
    const better = (y.bestParts < x.bestParts) || (y.bestParts === x.bestParts && y.bestMs < x.bestMs) ? y : x;
    out[id] = { solved: x.solved || y.solved, bestParts: better.bestParts, bestMs: better.bestMs };
  }
  return out;
}

export function getProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function recordSolve(levelId, parts, ms) {
  const cur = getProgress();
  const incoming = { [levelId]: { solved:true, bestParts:parts, bestMs:ms } };
  const merged = mergeProgress(cur, incoming);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch {}
  return merged[levelId];
}
export const isSolved = (levelId) => !!getProgress()[levelId]?.solved;
```

- [ ] **Step 4: Run to verify PASS**

Run the Step 2 command. Expected: `3 passed, 0 failed`.

> Node lacks `localStorage`; the merge tests are pure and don't touch it. If `getProgress`/`recordSolve` were tested in Node they'd need a stub — they are intentionally NOT in the Node test set (verified in-browser at Task 11).

- [ ] **Step 5: Commit**

```bash
git add contraption-lab/js/progress.js contraption-lab/js/level.test.js
git commit -m "contraption-lab: localStorage progress + best-of merge"
```

---

### Task 10: Input controller + full UI wiring (`input.js`, `main.js`, `index.html`, `style.css`)

**Files:**
- Create: `contraption-lab/js/input.js`
- Modify: `contraption-lab/js/main.js`
- Modify: `contraption-lab/index.html`
- Modify: `contraption-lab/style.css`

**Interfaces:**
- Consumes: `Sim` (engine.js), `drawWorld`/`resizeCanvas` (render.js), `screenToWorld`/`snap` (geom.js), `tokens` (theme.js), `PARTS`/`PALETTE_TYPES` (parts.js), `recordSolve`/`isSolved` (progress.js).
- `input.js` produces `PlacementController`:
  - `new PlacementController(canvas, sim, { getTransform, getSelectedType, onChange })`.
  - Handles pointerdown/move/up: tap empty + selected type → place at snapped world coords; drag on existing placed part → move; long-press / two-finger → rotate; double-tap on placed part → delete. Only active while `sim.state==="build"`.
  - Exposes `controller.ghost` for the renderer (current placement preview).

- [ ] **Step 1: Build the full `index.html` UI shell**

Replace `<body>` content:
```html
<body>
  <header class="bar">
    <button id="menuBtn" class="ghostbtn">☰ Levels</button>
    <span class="brand">Contraption&nbsp;Lab</span>
    <span class="status" id="levelTitle"></span>
    <label class="themePick">Theme
      <select id="themeSel"></select>
    </label>
  </header>
  <div class="stagewrap"><canvas id="stage"></canvas>
    <div id="banner" class="banner" hidden></div>
  </div>
  <footer class="palette" id="palette"></footer>
  <div class="controls">
    <button id="runBtn" class="primary">▶ Run</button>
    <button id="resetBtn">↺ Reset</button>
  </div>
  <dialog id="levelMenu"></dialog>
  <script type="module" src="./js/main.js"></script>
</body>
```

- [ ] **Step 2: Add UI layout CSS to `style.css`**

```css
.bar{display:flex;gap:12px;align-items:center;padding:8px 12px;background:color-mix(in srgb,var(--bg) 80%,#000);position:sticky;top:0;z-index:5}
.brand{font-weight:700;letter-spacing:.04em}
.status{opacity:.8;flex:1}
.ghostbtn,.themePick select,.controls button,.palette button{font-family:var(--font);background:var(--fixed-fill);color:var(--ink);border:1px solid var(--part-stroke);border-radius:8px;padding:8px 12px;cursor:pointer}
.controls button.primary,.palette button.sel{background:var(--accent);color:#111}
.stagewrap{position:relative;flex:1}
#stage{display:block;width:100vw;height:calc(100vh - 220px);touch-action:none}
.palette{display:flex;gap:8px;overflow-x:auto;padding:8px 12px}
.palette button{white-space:nowrap}.palette button[disabled]{opacity:.35}
.controls{display:flex;gap:12px;justify-content:center;padding:8px}
.banner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;background:color-mix(in srgb,var(--bg) 70%,transparent);color:var(--goal);font-weight:800}
dialog{background:var(--bg);color:var(--ink);border:1px solid var(--part-stroke);border-radius:12px;max-width:90vw}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
```

- [ ] **Step 3: Implement `input.js`**

```js
import { screenToWorld, snap } from "./geom.js";

export class PlacementController {
  constructor(canvas, sim, opts) {
    this.canvas = canvas; this.sim = sim; this.opts = opts; this.ghost = null;
    this._down = this._down.bind(this); this._move=this._move.bind(this); this._up=this._up.bind(this);
    canvas.addEventListener("pointerdown", this._down);
    canvas.addEventListener("pointermove", this._move);
    canvas.addEventListener("pointerup", this._up);
    this.dragIdx = -1; this.downAt = 0; this.lastTap = 0;
  }
  setSim(sim){ this.sim = sim; this.ghost=null; }
  _w(e){ const r=this.canvas.getBoundingClientRect(); const t=this.opts.getTransform();
    return screenToWorld((e.clientX-r.left)*this.canvas.width/r.width,(e.clientY-r.top)*this.canvas.height/r.height,t); }
  _down(e){ if(this.sim.state!=="build")return; this.canvas.setPointerCapture(e.pointerId);
    const w=this._w(e); this.downAt=performance.now();
    // double-tap delete
    if(performance.now()-this.lastTap<300){ if(this.sim.removeBodyAt(w.x,w.y)){this.opts.onChange();this.lastTap=0;return;} }
    this.lastTap=performance.now();
    this.start=w; }
  _move(e){ if(this.sim.state!=="build")return; const w=this._w(e); const type=this.opts.getSelectedType();
    if(type){ this.ghost={ x:snap(w.x,20), y:snap(w.y,20), type, valid:true }; this.opts.onChange(); } }
  _up(e){ if(this.sim.state!=="build")return; const w=this._w(e); const type=this.opts.getSelectedType();
    const held=performance.now()-this.downAt;
    if(type && this.opts.remaining(type)>0){ this.sim.addPlayerPart(type, snap(w.x,20), snap(w.y,20), 0); this.opts.onPlaced(type); }
    this.ghost=null; this.opts.onChange(); }
  destroy(){ this.canvas.removeEventListener("pointerdown",this._down); this.canvas.removeEventListener("pointermove",this._move); this.canvas.removeEventListener("pointerup",this._up); }
}
```

- [ ] **Step 4: Implement full `main.js` (boot, routing, loop, UI)**

```js
import { OFFICIAL_LEVELS } from "./levels/official.js";
import { Sim } from "./engine.js";
import { drawWorld, resizeCanvas } from "./render.js";
import { tokens, applyTheme, loadTheme, THEMES } from "./theme.js";
import { PARTS, PALETTE_TYPES } from "./parts.js";
import { PlacementController } from "./input.js";
import { recordSolve, isSolved } from "./progress.js";
import { makePart } from "./parts.js";

// optional self-test
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(async m => {
    m.runTests([ ...(await m.levelCases()), ...(await m.officialCases()), ...(await m.progressCases()) ]);
  });
}

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let transform, sim, controller, selected = null, remaining = {}, current = null;

function fillThemeSelect() {
  const sel = document.getElementById("themeSel");
  sel.innerHTML = THEMES.map(t=>`<option value="${t.id}">${t.label}</option>`).join("");
  sel.value = loadTheme();
  sel.onchange = () => applyTheme(sel.value);
}
function buildPalette() {
  const pal = document.getElementById("palette");
  pal.innerHTML = "";
  for (const inv of current.inventory) {
    const b = document.createElement("button");
    b.textContent = `${PARTS[inv.type].label} ×${remaining[inv.type]}`;
    b.disabled = remaining[inv.type] <= 0;
    b.onclick = () => { selected = inv.type; [...pal.children].forEach(c=>c.classList.remove("sel")); b.classList.add("sel"); };
    b.dataset.type = inv.type;
    pal.appendChild(b);
  }
}
function loadLevel(level) {
  current = level;
  document.getElementById("levelTitle").textContent = level.title + (isSolved(level.id) ? " ✓" : "");
  remaining = {}; level.inventory.forEach(i => remaining[i.type] = i.count);
  selected = null;
  sim = new Sim(level);
  if (controller) controller.setSim(sim); else controller = makeController();
  buildPalette();
  document.getElementById("banner").hidden = true;
  resize();
}
function makeController() {
  return new PlacementController(canvas, sim, {
    getTransform: () => transform,
    getSelectedType: () => selected,
    remaining: (t) => remaining[t] ?? 0,
    onPlaced: (t) => { remaining[t]--; buildPalette(); },
    onChange: () => draw(),
  });
}
function resize(){ const r = resizeCanvas(canvas); transform = r.transform; draw(); }
function draw(){ drawWorld(ctx, sim, transform, tokens(), { ghost: controller && controller.ghost ? ghostVerts(controller.ghost) : null }); }
function ghostVerts(g){ try { const {bodies}=makePart(g.type,{x:g.x,y:g.y}); return { vertices: bodies[0].vertices || [{x:g.x-10,y:g.y-10},{x:g.x+10,y:g.y-10},{x:g.x+10,y:g.y+10},{x:g.x-10,y:g.y+10}], valid:g.valid }; } catch { return null; } }

let last = 0, raf = 0;
function tick(ts){ const dt = last ? ts-last : 16; last = ts;
  if (sim.state === "running") { const s = sim.step(dt); draw();
    if (s === "won") { onWin(); } else if (s === "lost") { onLost(); } }
  raf = requestAnimationFrame(tick);
}
function onWin(){ const banner=document.getElementById("banner"); banner.textContent="Solved! ✓ "+sim.partsUsed()+" parts";
  banner.hidden=false; recordSolve(current.id, sim.partsUsed(), Math.round(sim.elapsed));
  document.getElementById("levelTitle").textContent = current.title + " ✓"; }
function onLost(){ const banner=document.getElementById("banner"); banner.textContent="Time's up — Reset and retry"; banner.hidden=false; }

document.getElementById("runBtn").onclick = () => { if (sim.state==="build"){ sim.run(); document.getElementById("banner").hidden=true; } };
document.getElementById("resetBtn").onclick = () => { sim.reset(); buildPalette(); recompRemaining(); document.getElementById("banner").hidden=true; draw(); };
function recompRemaining(){ remaining={}; current.inventory.forEach(i=>remaining[i.type]=i.count); sim.placed.forEach(s=>remaining[s.type]--); buildPalette(); }

function buildMenu(){ const dlg=document.getElementById("levelMenu");
  dlg.innerHTML = `<h3>Levels</h3>` + OFFICIAL_LEVELS.map((l,i)=>`<button data-id="${l.id}">${String(i+1).padStart(2,"0")} · ${l.title} ${isSolved(l.id)?"✓":""}</button>`).join("") + `<button data-close>Close</button>`;
  dlg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(b.dataset.close!==undefined){dlg.close();return;} const lvl=OFFICIAL_LEVELS.find(l=>l.id===b.dataset.id); dlg.close(); location.hash="#/play/"+lvl.id; });
}
document.getElementById("menuBtn").onclick = () => { buildMenu(); document.getElementById("levelMenu").showModal(); };

function route(){ const m = location.hash.match(/#\/play\/(.+)/);
  const lvl = (m && OFFICIAL_LEVELS.find(l=>l.id===m[1])) || OFFICIAL_LEVELS[0];
  loadLevel(lvl); }
window.addEventListener("hashchange", route);
window.addEventListener("resize", resize);

applyTheme(loadTheme()); fillThemeSelect();
new MutationObserver(()=>draw()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
route();
raf = requestAnimationFrame(tick);

// register SW
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
```

- [ ] **Step 5: Syntax-check all modules**

```bash
cd contraption-lab && for f in js/*.js; do node --check "$f" && echo "$f ok" || exit 1; done; cd ..
```
Expected: every file prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add contraption-lab/index.html contraption-lab/style.css contraption-lab/js/input.js contraption-lab/js/main.js
git commit -m "contraption-lab: input controller + full UI wiring + game loop"
```

---

### Task 11: PWA shell (icon, manifest, sw) + full in-browser playtest

**Files:**
- Create: `contraption-lab/icon.svg`
- Create: `contraption-lab/manifest.webmanifest`
- Create: `contraption-lab/sw.js`

**Interfaces:**
- Produces: an installable offline-capable PWA. `sw.js` caches the shell incl. `vendor/matter.min.js` and all `js/*` modules; never intercepts cross-origin (forward-compat with Phase 2 PocketBase).

- [ ] **Step 1: Create `icon.svg` (blueprint gear)**

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#13233f"/>
  <g fill="none" stroke="#dce7fb" stroke-width="3">
    <circle cx="32" cy="32" r="11"/>
    <path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M46 18l-4 4M22 42l-4 4"/>
  </g>
</svg>
```

- [ ] **Step 2: Create `manifest.webmanifest`**

```json
{
  "name": "Contraption Lab",
  "short_name": "Contraption Lab",
  "description": "Build Rube Goldberg machines — a modern Incredible Machine for the browser and iPad.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#13233f",
  "theme_color": "#13233f",
  "lang": "en",
  "categories": ["games", "entertainment"],
  "icons": [ { "src": "./icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any maskable" } ]
}
```

- [ ] **Step 3: Create `sw.js`** (tinywings pattern, cache list updated)

```js
/* Contraption Lab — minimal offline shell SW */
const CACHE = "vibe-contraption-lab-v1";
const SHELL = [
  "./","./index.html","./style.css","./manifest.webmanifest","./icon.svg",
  "./vendor/matter.min.js",
  "./js/main.js","./js/engine.js","./js/parts.js","./js/level.js","./js/levels/official.js",
  "./js/render.js","./js/input.js","./js/progress.js","./js/theme.js","./js/geom.js",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("vibe-contraption-lab-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method!=="GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // never touch cross-origin (Phase 2 PB)
  if (req.mode==="navigate" || (req.headers.get("accept")||"").includes("text/html")) {
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r;}).catch(()=>caches.match(req).then(m=>m||caches.match("./index.html")))); return;
  }
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{ if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));} return r; }).catch(()=>m)));
});
```

- [ ] **Step 4: Run the full automated self-test (must be all green)**

```bash
cd contraption-lab && node --input-type=module -e "globalThis.Matter={Bodies:{circle:(x,y,r,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)}),rectangle:(x,y,w,h,o)=>({position:{x,y},vertices:[{x,y}],bounds:{min:{x,y},max:{x,y}},plugin:{},isStatic:!!(o&&o.isStatic)})},Body:{create:(o)=>({...o,position:{x:0,y:0},vertices:[],bounds:{min:{x:0,y:0},max:{x:0,y:0}},plugin:{}}),setAngle(){}, setStatic(){}, setVelocity(){}, applyForce(){}},Constraint:{create:()=>({})},Composite:{add(){}},Engine:{create:()=>({world:{},gravity:{}}),update(){}},Query:{point:()=>[]}};import('./js/level.test.js').then(async m=>{const r=m.runTests([...await m.levelCases(),...await m.officialCases(),...await m.progressCases()]);console.log('TOTAL',r);process.exit(r.failed?1:0)}).catch(e=>{console.error('LOAD FAIL',e.message,e.stack);process.exit(1)})"; cd ..
```
Expected: all cases pass, exit 0. Fix any failure before continuing.

- [ ] **Step 5: Manual in-browser playtest (desktop + iPad viewport)**

```bash
cd contraption-lab && python3 -m http.server 8200
```
Then in a browser at `http://localhost:8200/`:
- Each of the 10 levels loads from the ☰ Levels menu and is **solvable** — place inventory parts, Run, confirm the win banner. Adjust level coordinates in `levels/official.js` where a level is impossible or trivially auto-solves; re-run Step 4 after edits.
- Drag-place, double-tap delete, Run, Reset all work with touch (use device-emulation / iPad viewport, `touch-action` prevents scroll).
- All four themes (Blueprint/Cartoon/Neon/Clean Toy) restyle both chrome and canvas; choice persists on reload.
- Solving a level shows `✓` and persists across reload (localStorage).
- `http://localhost:8200/?test` logs `0 failed` in console.
- No console errors. Stop the server (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
git add contraption-lab/icon.svg contraption-lab/manifest.webmanifest contraption-lab/sw.js contraption-lab/js/levels/official.js
git commit -m "contraption-lab: PWA shell + playtest level tuning"
```

---

### Task 12: Portal wiring + thumbnail (maintenance contract) + ship

**Files:**
- Modify: `index.html` (root works index)
- Modify: `README.md`
- Create: `thumbs/contraption-lab.jpg`
- Modify: `CLAUDE.md` (add demo to shipped list)

**Interfaces:** none (integration). This is the ship commit.

- [ ] **Step 1: Generate a 1280×720 thumbnail**

Use the bedrock image MCP (per memory: `generate_image`) to make a blueprint-style hero, or capture a screenshot of level 10 scaled to 1280×720, and save it as `thumbs/contraption-lab.jpg`. Verify:
```bash
ls -la thumbs/contraption-lab.jpg
```
Expected: file exists, non-zero.

- [ ] **Step 2: Add the works-index row to root `index.html`**

Insert after the `kids-bookshelf` `</a>` (entry 11), before `</section>`:
```html
      <a class="work" href="./contraption-lab/">
        <span class="num">12</span>
        <span class="title">Contraption <em>Lab</em></span>
        <span class="tags">Rube Goldberg physics<br>Matter.js · themeable<br>Browser · iPad</span>
        <span class="thumb"><img src="./thumbs/contraption-lab.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async"></span>
        <span class="year">2026</span>
        <span class="arrow">→</span>
      </a>
```

- [ ] **Step 3: Bump the count**

Change `<div class="count">Index / 11 entries</div>` → `Index / 12 entries`.
```bash
grep -n 'Index / 12 entries' index.html
```
Expected: matches one line.

- [ ] **Step 4: Mirror into `README.md` and `CLAUDE.md`**

Add a bullet to the shipped-demos list in `CLAUDE.md` and the demo list in `README.md`:
```
- `contraption-lab/` ("Contraption Lab") — a modern Incredible Machine: drag parts to build Rube Goldberg contraptions that satisfy each level's goal. Matter.js physics, 10 official levels, 4 swappable themes (Blueprint default), localStorage progress. Built for browser + iPad. Tier 1-ready (PocketBase accounts/editor planned).
```

- [ ] **Step 5: Verify portal sync**

If `skills/vibe-studio/tool/check-portal.sh` exists in this repo, run it; otherwise verify by hand:
```bash
test -f skills/vibe-studio/tool/check-portal.sh && bash skills/vibe-studio/tool/check-portal.sh || echo "no check-portal script — manual verify: count=12, row present, thumb exists"
grep -c 'class="work"' index.html
```
Expected: works rows count = 12; (or `✓` from check-portal).

- [ ] **Step 6: Final full verification before ship**

```bash
cd contraption-lab && python3 -m http.server 8200 >/dev/null 2>&1 & sleep 1
curl -s http://localhost:8200/ | grep -c 'id="stage"'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8200/vendor/matter.min.js
kill %1 2>/dev/null; cd ..
```
Expected: `1` then `200`.

- [ ] **Step 7: Ship commit**

```bash
git add index.html README.md CLAUDE.md thumbs/contraption-lab.jpg
git commit -m "contraption-lab: add to works index (entry 12) — ship Phase 1"
```

---

## Future phases (separate plans — NOT in scope here)

- **Phase 2 plan** (`2026-..-contraption-lab-phase2.md`): PocketBase `users` auth, `progress` collection synced via `mergeProgress`, per-level leaderboard. Port 8100 in `backends/config.json`. Query Context7 for current PocketBase migration/SDK syntax first.
- **Phase 3 plan**: level editor (`editor.js`), `level` + `rating` collections, browse screen. The level JSON format (Task 4) is already the editor's output contract.

The codebase is structured so these slot in without refactor: `level.js` already validates arbitrary level JSON (editor output); `progress.js` already exposes `mergeProgress` for remote sync; `sw.js` already ignores cross-origin so PB calls pass through.

---

## Self-Review

**Spec coverage:**
- §1 architecture/layout → Tasks 1–11 create exactly the planned files. ✓
- §2 simulation/gameplay (build/run/reset, dwell win, ~10 parts, iOS) → Tasks 3 (parts), 8 (Sim), 10 (input/loop), 11 (playtest). ✓
- §3 level format (versioned, validate, 1280×720, graceful unknown) → Task 4. ✓
- §4 backend/local-first → Phase 1 is local-only (Task 9); cross-origin-safe SW (Task 11) and `mergeProgress` (Task 9) pre-wire Phase 2; explicitly deferred. ✓
- §5 theming (4 token sets, canvas reads tokens), error handling (graceful unknown, max-run timer, offline-safe), testing (?test harness) → Tasks 6, 7, 4/8, 2/11. ✓
- Maintenance contract → Task 12. ✓

**Placeholder scan:** The two "garbage" CSS values in Task 6 Step 1 (`#21installed`, `#1c3considered`) are *intentional* STOP markers with an explicit instruction to replace with the stated real hex (`#274a86`, `#1c365f`); not silent placeholders. Levels 04–10 in Task 5 are provided as full objects (not "TODO"). No other placeholders.

**Type consistency:** `Sim` API (`state`, `bodies`, `goalZone`, `addPlayerPart`, `removeBodyAt`, `run`, `reset`, `step`, `partsUsed`, `placed`, `elapsed`) used consistently in Tasks 8/10. `tokens()` keys (`bg,ink,grid,partFill,partStroke,fixedFill,accent,goal`) match between Tasks 6 and 7. `validateLevel`/`serializeLevel`/`cloneLevel`/`buildWorld` signatures consistent Tasks 4/5/8. `mergeProgress`/`recordSolve`/`isSolved` consistent Tasks 9/10. Part `plugin` shape (`{partType, tag, ...}`) consistent Tasks 3/7/8.

**Known implementation risk (flagged for executor):** Task 8's `run()`/`_wasPlaced` distinguishes player parts from fixed parts by type, which is imprecise if a level's `fixed` array and inventory share a type. Mitigation: tag placed bodies explicitly — set `b.plugin.placed = true` in `addPlayerPart`'s spawn and key `run()`/`removeBodyAt` off that flag rather than type. The executor should apply this refinement in Task 8 Step 2 (the "resolve the note" step) since it touches the same code.
