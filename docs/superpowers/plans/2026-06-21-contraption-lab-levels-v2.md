# Contraption Lab — 20 Levels + New-Physics Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 14 near-identical official levels with 20 distinct, difficulty-arced levels — each themed on a star mechanic — and add 9 new parts (magnet, accelerator, vortex, ice, sticky, bumper, portal pair, button, gate) with unique interactions, all verified solvable and shipped with SD3.5 sprites.

**Architecture:** New parts are `parts.js` registry entries plus per-tick logic added to `engine.js`'s existing try-wrapped `_applyForces()` loop (forces, portals, button/gate) — extending the fan/conveyor/gears pattern, velocity-clamped, never touching the dwell win check. `level.js` gains link-integrity validation (portal pairs, button→gate). 20 new levels in `levels/official.js`, each solver-verified. Win stays `dwell` (ball→goal zone).

**Tech Stack:** Matter.js 0.20 (vendored), vanilla ES modules, the existing headless Matter solver harness (`/tmp/cl-diag`), `bedrock-image-mcp-server` for sprites, Playwright for browser QA. No build tool.

## Global Constraints

- Static files only — no build tool/framework/package.json; push to main = deploy.
- Win condition stays `goal.type:"dwell"` (tagged `ball` overlaps `goal.zone` ≥ `ms`). No new win types.
- **Every per-tick new-part effect MUST be wrapped in try/catch** (inside the existing `_applyForces` try block pattern) so a misfire can never throw into the rAF loop. Forces/teleports MUST clamp output velocity to a max (≈25 world-units/tick) so nothing produces NaN/explosive motion. Out-of-bounds cull + 30s max-run still apply.
- New parts must NOT alter the dwell/win logic; they only move/affect bodies.
- **SHIP GATE — solvability:** every one of the 20 levels must be proven winnable by the headless Matter.js sweep with a documented solution before shipping. New-physics levels especially: prove the intended path works; levels are data — tune coordinates until the solver wins.
- World is fixed 1280×720, center-based coords; `goal.zone` is center-based.
- `validateLevel` must reject broken links (portal without exactly one partner; button→nonexistent gate) so a bad level fails gracefully, never crashing.
- Sprites: SD3.5 → `remove_background` → `assets/make-sprite.mjs <cut> <part> 256`; commit `assets/parts/<part>.png`. Missing sprite → vector fallback. sw.js caches new PNGs + bump cache.
- Tests via the `?test` bundle (currently 100 cases) + the solvability sweep + Playwright browser QA.

**Branch `feat/contraption-lab-levels-v2` (created). The 14 old levels are REPLACED by the new 20.**

## File Structure

```
contraption-lab/
├── js/parts.js          ← +9 parts (magnet, accelerator, vortex, ice, sticky, bumper, portal, button, gate) + PALETTE_TYPES
├── js/engine.js         ← +per-tick: forces (magnet/vortex/accelerator), portal teleport, button/gate; in _applyForces try block
├── js/level.js          ← +validatePortalLinks/validateGateLinks inside validateLevel
├── js/sprites.js        ← +9 registry entries
├── js/levels/official.js← REWRITTEN: 20 levels (band A/B/C/D)
├── js/level.test.js     ← +new-part build cases, portalExit/gateOpen helpers, link-validation cases, 20-level structural cases
├── assets/parts/{magnet,accelerator,vortex,ice,sticky,bumper,portal,button,gate}.png
└── sw.js                ← cache 9 new PNGs + bump version
```

Order: parts+engine+validation (1–3) → sprites (4) → 20 levels in bands (5–8) → integration/QA/ship (9–11).

---

### Task 1: Surface + force parts (ice, sticky, bumper, magnet, accelerator, vortex)

**Files:** Modify `contraption-lab/js/parts.js`, `js/engine.js`, `js/level.test.js`

**Interfaces:**
- Consumes: `cat(M,partType,tag)`, `PARTS`, `makePart`, the `_applyForces` loop.
- Produces 6 new `PARTS` entries; engine per-tick force logic for magnet/vortex/accelerator. Surface parts (ice/sticky/bumper) are pure material bodies (no engine logic).

- [ ] **Step 1: Add the 6 part definitions to parts.js**

Append to `PARTS` (surface parts are plain static bodies; force parts carry plugin config the engine reads):
```js
  ice: { label:"Ice", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"ice",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||160,16,{isStatic:true,angle:s.angle||0,friction:0.005,frictionStatic:0,restitution:0}))], constraints:[] }) },
  sticky: { label:"Sticky", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"sticky",s.tag)(M.Bodies.rectangle(s.x,s.y,s.w||120,18,{isStatic:true,angle:s.angle||0,friction:1,frictionStatic:1,restitution:0}))], constraints:[] }) },
  bumper: { label:"Bumper", movable:true, fixedByDefault:true,
    build:(s,M)=>({ bodies:[cat(M,"bumper",s.tag)(M.Bodies.circle(s.x,s.y,s.r||26,{isStatic:true,restitution:1.4,friction:0.1}))], constraints:[] }) },
  magnet: { label:"Magnet", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,44,44,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"magnet",tag:s.tag||null,strength:s.strength||0.015,range:s.range||260,polarity:s.polarity||1}; return {bodies:[b],constraints:[]}; } },
  accelerator: { label:"Booster", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,s.w||90,16,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"accelerator",tag:s.tag||null,boost:s.boost||9,angle:s.angle||0}; return {bodies:[b],constraints:[]}; } },
  vortex: { label:"Vortex", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.circle(s.x,s.y,s.r||30,{isStatic:true,isSensor:true}); b.plugin={partType:"vortex",tag:s.tag||null,strength:s.strength||0.03,range:s.range||180}; return {bodies:[b],constraints:[]}; } },
```
Add the movable ones to `PALETTE_TYPES`.

- [ ] **Step 2: Add force logic to engine.js `_applyForces`**

Inside the existing `for (const f of this.bodies)` loop, inside its `try` block, after the `gears` branch, add:
```js
      else if (pl.partType === "magnet" || pl.partType === "vortex") {
        const range = pl.range || 200, strength = pl.strength || 0.02, pol = pl.polarity || 1;
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = f.position.x - b.position.x, dy = f.position.y - b.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist < range && dist > 1) {
            const falloff = 1 - dist / range;
            const mag = strength * falloff * pol;
            let fx = (dx / dist) * mag, fy = (dy / dist) * mag;
            if (pl.partType === "vortex") { fx += (-dy / dist) * mag * 0.4; fy += (dx / dist) * mag * 0.4; } // swirl
            m.Body.applyForce(b, b.position, { x: fx, y: fy });
          }
        }
      }
      else if (pl.partType === "accelerator") {
        const dir = { x: Math.cos(f.angle), y: Math.sin(f.angle) };
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          // on the pad's surface band
          if (Math.abs(b.position.y - f.position.y) < 34 && Math.abs(b.position.x - f.position.x) < (f.bounds.max.x - f.bounds.min.x) / 2 + 20) {
            const boost = pl.boost || 9;
            m.Body.setVelocity(b, { x: dir.x * boost, y: b.velocity.y - Math.abs(dir.y) * boost });
          }
        }
      }
```
Add a velocity clamp at the END of the per-body loop body (inside the try), so any effect (incl. bumper restitution) stays bounded:
```js
      // clamp any dynamic body to a sane max speed so no effect can explode/NaN
      if (!f.isStatic) {
        const sp = Math.hypot(f.velocity.x, f.velocity.y);
        if (sp > 25) m.Body.setVelocity(f, { x: f.velocity.x / sp * 25, y: f.velocity.y / sp * 25 });
      }
```

- [ ] **Step 3: Add build tests to level.test.js**

Add to a new exported `newPartsCases()`:
```js
export async function newPartsCases() {
  const { makePart, PARTS } = await import("./parts.js");
  const cases = [];
  for (const t of ["ice","sticky","bumper","magnet","accelerator","vortex"]) {
    cases.push({ name:`${t} builds`, fn:()=>{ const r=makePart(t,{x:100,y:100}); if(!r.bodies.length) throw new Error(t+" no body"); if(r.bodies[0].plugin.partType!==t) throw new Error(t+" wrong partType"); } });
  }
  return cases;
}
```

- [ ] **Step 4: Verify** — `node --check js/parts.js js/engine.js`; run the Node test harness (Matter stub augmented with `setVelocity`, `applyForce`, `setAngularVelocity`) including `newPartsCases` → all pass. Then the existing solvability sweep on the CURRENT levels still passes (these parts aren't used yet → regression guard): `cd /tmp/cl-diag && rm -rf js && cp -r .../js ./js && node final.mjs 2>&1 | grep -v delta | tail -1` → still `VALIDATE 14/14 · SOLVABLE+INV 14/14` (levels unchanged this task).

- [ ] **Step 5: Commit** — `contraption-lab: surface + force parts (ice/sticky/bumper/magnet/accelerator/vortex)`

---

### Task 2: Portal pair (teleport with cooldown)

**Files:** Modify `contraption-lab/js/parts.js`, `js/engine.js`, `js/level.test.js`

**Interfaces:**
- Produces a `portal` part (sensor) carrying `{link, angle}`; engine teleport logic in `_applyForces`; pure helper `portalExit(fromPos, toPortal)` → `{x,y}` exit position.

- [ ] **Step 1: Add the portal part**
```js
  portal: { label:"Portal", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.circle(s.x,s.y,s.r||28,{isStatic:true,isSensor:true}); b.plugin={partType:"portal",tag:s.tag||null,link:s.link||"p",angle:s.angle||0,_cool:0}; return {bodies:[b],constraints:[]}; } },
```
Add `"portal"` to PALETTE_TYPES.

- [ ] **Step 2: Add a pure `portalExit` helper to engine.js (exported)**
```js
export function portalExit(toPortal) {
  // exit just outside the destination portal along its exit angle
  const r = (toPortal.plugin.r || 28) + 24;
  return { x: toPortal.position.x + Math.cos(toPortal.plugin.angle) * r, y: toPortal.position.y + Math.sin(toPortal.plugin.angle) * r };
}
```

- [ ] **Step 3: Add teleport logic in `_applyForces` (inside the try)**
```js
      else if (pl.partType === "portal") {
        pl._cool = Math.max(0, (pl._cool || 0) - 1);
        if (pl._cool > 0) continue;
        const partner = this.bodies.find(o => o !== f && o.plugin && o.plugin.partType === "portal" && o.plugin.link === pl.link);
        if (!partner) continue;
        for (const b of this.bodies) {
          if (b.isStatic || b === f) continue;
          const dx = b.position.x - f.position.x, dy = b.position.y - f.position.y;
          if (Math.hypot(dx, dy) < (pl.r || 28)) {
            const exit = portalExit(partner);
            m.Body.setPosition(b, exit);
            partner.plugin._cool = 30;  // ~0.5s at 60fps: stop immediate re-entry on the other side
            pl._cool = 30;
            break;
          }
        }
      }
```

- [ ] **Step 4: Tests** — add to `newPartsCases` (or a `portalCases`): `portal` builds with a `link`; `portalExit` returns a point offset from the partner center (distance ≈ r+24). Run → pass.

- [ ] **Step 5: Verify + Commit** — `node --check`; tests pass; sweep still 14/14. Commit `contraption-lab: portal pair teleport (cooldown-guarded)`.

---

### Task 3: Button + gate (switch logic) + level.js link validation

**Files:** Modify `contraption-lab/js/parts.js`, `js/engine.js`, `js/level.js`, `js/level.test.js`

**Interfaces:**
- Produces `button` (sensor plate, `{gate}`) and `gate` (barrier, `{id}`) parts; engine logic toggling the gate when the button is pressed; pure `gateOpen(buttonBody, bodies)` → bool; `validateLevel` link checks.

- [ ] **Step 1: Add button + gate parts**
```js
  button: { label:"Button", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,s.w||70,14,{isStatic:true,isSensor:true}); b.plugin={partType:"button",tag:s.tag||null,gate:s.gate||"g"}; return {bodies:[b],constraints:[]}; } },
  gate: { label:"Gate", movable:true, fixedByDefault:true,
    build:(s,M)=>{ const b=M.Bodies.rectangle(s.x,s.y,s.w||24,s.h||140,{isStatic:true,angle:s.angle||0}); b.plugin={partType:"gate",tag:s.tag||null,id:s.id||"g",_solidX:s.x,_solidY:s.y}; return {bodies:[b],constraints:[]}; } },
```
Add both to PALETTE_TYPES.

- [ ] **Step 2: Pure `gateOpen` helper (exported from engine.js)**
```js
export function gateOpen(buttonBody, bodies) {
  const z = { x: buttonBody.position.x - 45, y: buttonBody.position.y - 20, w: 90, h: 40 };
  for (const b of bodies) {
    if (b.isStatic || b.plugin?.partType === "button" || b.plugin?.partType === "gate") continue;
    if (b.position.x > z.x && b.position.x < z.x + z.w && b.position.y > z.y && b.position.y < z.y + z.h) return true;
  }
  return false;
}
```

- [ ] **Step 3: Engine logic in `_applyForces` (inside the try)** — when a button is pressed, move its linked gate far off-screen (open); else restore it:
```js
      else if (pl.partType === "button") {
        const open = gateOpen(f, this.bodies);
        const gate = this.bodies.find(o => o.plugin && o.plugin.partType === "gate" && o.plugin.id === pl.gate);
        if (gate) {
          const gp = gate.plugin;
          if (open && gate.position.y > -5000) m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY - 10000 });   // retract up
          else if (!open && gate.position.y < -5000) m.Body.setPosition(gate, { x: gp._solidX, y: gp._solidY });      // restore
        }
      }
```

- [ ] **Step 4: Link validation in level.js** — inside `validateLevel`, before the final `return {ok:true}`, add:
```js
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
```

- [ ] **Step 5: Tests** — `button`/`gate` build; `gateOpen` true when a dynamic body is over the plate, false otherwise; `validateLevel` rejects a lone portal and a button→missing-gate; accepts a valid portal pair + button/gate. Run → pass.

- [ ] **Step 6: Verify + Commit** — `node --check`; tests pass; sweep still 14/14. Commit `contraption-lab: button+gate switch logic + portal/gate link validation`.

---

### Task 4: SD3.5 sprites for the 9 new parts (controller-run asset gen)

**Files:** Create `contraption-lab/assets/parts/{ice,sticky,bumper,magnet,accelerator,vortex,portal,button,gate}.png`; modify `js/sprites.js`.

**Interfaces:** 9 committed transparent PNGs + 9 `SPRITES` registry entries (fit: bumper/vortex/portal=circle; ice/sticky/accelerator=plank; magnet/button/gate=box).

> CONTROLLER NOTE: asset generation runs through the MCP (controller-run), like prior sprite phases. Each part: `generate_image_sd35` (funky 1990s Incredible-Machine style, plain neutral bg, NO magenta) → `remove_background` → `assets/make-sprite.mjs <cut> <part> 256`.

- [ ] **Step 1: Add sprite registry entries to sprites.js**
```js
  ice:         P("./assets/parts/ice.png","plank"),
  sticky:      P("./assets/parts/sticky.png","plank"),
  bumper:      P("./assets/parts/bumper.png","circle"),
  magnet:      P("./assets/parts/magnet.png","box"),
  accelerator: P("./assets/parts/accelerator.png","plank"),
  vortex:      P("./assets/parts/vortex.png","circle"),
  portal:      P("./assets/parts/portal.png","circle"),
  button:      P("./assets/parts/button.png","box"),
  gate:        P("./assets/parts/gate.png","box"),
```

- [ ] **Step 2: Generate + process each of the 9 sprites** (prompts: magnet=red/blue horseshoe magnet; accelerator=glowing chevron boost pad; vortex=swirling purple spiral; ice=pale blue icy block; sticky=amber goo pad; bumper=round springy peg; portal=glowing ring gateway; button=red press plate; gate=portcullis bar). Plain neutral bg, single centered object, no magenta. QC each visually; regen (seed+1) if off.

- [ ] **Step 3: Verify** — all 9 PNGs exist ≤256px; `node --check js/sprites.js`; resolveSprite returns each new part's src + fit.

- [ ] **Step 4: Commit** — `contraption-lab: SD3.5 sprites for 9 new parts`. (scratch raw/cut NOT committed.)

---

### Task 5: Levels Band A (L1–5, teach one mechanic) — verified solvable

**Files:** Modify `contraption-lab/js/levels/official.js` (begin the rewrite), `js/level.test.js`

**Interfaces:** `OFFICIAL_LEVELS` begins as 5 levels (the rewrite; bands B–D append). Each: `{schema:1, id:"official-01"…, title, world, goal(dwell), fixed[], start[ball tagged], inventory[], par}`.

- [ ] **Step 1: Author L1–5** — distinct layouts, each themed: 01 First Drop (a short ledge + ramp inventory); 02 Bounce (a pit with a bumper to ricochet the ball across); 03 Slippery (an ice slope the ball slides down into a goal pocket); 04 Fan Lift (a tall wall, balloon+fan to float the ball over); 05 Magnet (a gap the magnet pulls the ball across). Use the `lvl()`/`goalAt()` helpers. Vary goal position + scenery — NOT the single sloped-floor template.

- [ ] **Step 2: Solver-verify each** — extend the `/tmp/cl-diag` harness (`verify(level, solution)`) with a documented solution per level; confirm each reaches `"won"`. Tune coordinates until solvable. Record the winning placement per level.

- [ ] **Step 3: Structural test** — update the `officialCases()` count assertion progressively (this task: ≥5 levels validate, unique ids, non-empty inventory). Run → pass.

- [ ] **Step 4: Commit** — `contraption-lab: levels band A (L1-5, teach mechanics) — solver-verified`

---

### Task 6: Levels Band B (L6–12, combine two) — verified solvable

**Files:** Modify `js/levels/official.js`, `js/level.test.js`

- [ ] **Step 1: Author L6–12** — 06 Conveyor Run; 07 Seesaw Launch (seesaw+weight flings the ball); 08 Accelerator Gap (boost pad over a pit); 09 Portal Hop (portal pair through/over a wall); 10 Sticky Stop (ice run into a sticky landing in the goal); 11 Domino Cascade (dominoes knock the ball off a ledge); 12 Vortex (a vortex bends the ball's fall into the goal). Distinct scenery each.
- [ ] **Step 2: Solver-verify** each with a documented solution; tune until solvable. (Portal/vortex levels especially — confirm the intended path actually wins headlessly.)
- [ ] **Step 3: Structural test** updated (≥12 levels). Run → pass.
- [ ] **Step 4: Commit** — `contraption-lab: levels band B (L6-12, combine two) — solver-verified`

---

### Task 7: Levels Band C (L13–18, multi-step chains) — verified solvable

**Files:** Modify `js/levels/official.js`, `js/level.test.js`

- [ ] **Step 1: Author L13–18** — 13 Button & Gate (press a plate to open the path to the goal); 14 Pinwheel Relay; 15 Trampoline Tower (stacked trampolines bounce the ball up to a high goal); 16 Gear Drive; 17 Two-Portal Maze (two portal pairs route through a maze); 18 Magnet + Accelerator (magnet positions, booster launches). 2–4 inventory parts each; real multi-step solutions.
- [ ] **Step 2: Solver-verify** each (these are the hardest to solve headlessly — budget time to tune; a level that can't be made solvable within reason gets its layout simplified, not shipped broken).
- [ ] **Step 3: Structural test** updated (≥18 levels). Run → pass.
- [ ] **Step 4: Commit** — `contraption-lab: levels band C (L13-18, chains) — solver-verified`

---

### Task 8: Levels Band D (L19–20, fiendish) — verified solvable

**Files:** Modify `js/levels/official.js`, `js/level.test.js`

- [ ] **Step 1: Author L19–20** — 19 The Gauntlet (portal + button/gate + accelerator in sequence); 20 Grand Contraption v2 (a long chain using ≥5 distinct mechanics). Generous inventories; genuinely hard but solver-proven.
- [ ] **Step 2: Solver-verify** both with documented solutions.
- [ ] **Step 3: Final structural test** — `officialCases()` asserts EXACTLY 20 levels, ids `official-01..official-20` unique + sequential, every one validates with non-empty inventory + a dwell goal with a zone. Run → pass.
- [ ] **Step 4: Commit** — `contraption-lab: levels band D (L19-20, fiendish) — solver-verified; 20 levels total`

---

### Task 9: Full solvability sweep + headless test suite

**Files:** none (verification); the `/tmp/cl-diag` harness.

- [ ] **Step 1: All-20 solver sweep** — run the harness with every level's documented solution; assert ALL 20 reach `"won"`, none produce NaN positions, and an empty-placement run ends `"lost"` (not hung) on a sample. Output a per-level table.
- [ ] **Step 2: Full `?test`** — the bundle (levelCases, officialCases [now 20], progressCases, progressShapeCases, cloudCases, cloudLevelCases, spriteCases, editorCases, soundCases, newPartsCases) → `failed:0`.
- [ ] **Step 3: Record** the per-level solvability table in the task report. If any level fails, fix its data (Task 5–8 owner) and re-sweep. No commit (verification).

---

### Task 10: Sprites in SW + level-menu count + docs

**Files:** Modify `contraption-lab/sw.js`, `README.md`, `CLAUDE.md`

- [ ] **Step 1: SW** — add the 9 new `./assets/parts/<part>.png` to SHELL; bump `CACHE` to the next version. Verify the new PNGs are listed + cross-origin guard intact.
- [ ] **Step 2: Docs** — update README + CLAUDE contraption-lab bullets: now 20 distinct difficulty-arced levels + new mechanics (magnet/accelerator/vortex/ice/sticky/bumper/portal/button+gate); ~32 parts total.
- [ ] **Step 3: Commit** — `contraption-lab: SW cache new sprites + docs for 20-level redesign`

---

### Task 11: Real-browser QA + ship (controller-run gate)

**Files:** none (verification); scratch in /tmp.

- [ ] **Step 1: Headless gates green** — all-20 sweep + full `?test failed:0`.
- [ ] **Step 2: Playwright QA** — serve `contraption-lab/`; across all 4 themes load 3 levels spanning the arc (L1, a mid-band, L20): assert new-part sprites render on bodies, place→run→win on L1 with its documented solution via REAL clicks (per the recent touch fix — use real `.click()`/pointer at computed screen coords, not synthetic-only), 0 page/console errors. Phone-viewport (390×844) check that buttons respond and the canvas fills. Screenshot a couple of new-mechanic levels.
- [ ] **Step 3: Review screenshots** — new parts look right + on-theme; levels visibly distinct. Fix + re-run if needed.
- [ ] **Step 4: Merge + deploy + live verify** — merge `feat/contraption-lab-levels-v2`→main, verify tests on merge, push (deploys). Load the LIVE site, confirm a level loads + a documented solution wins + 0 errors; screenshot. (No backend change this round.)

---

## Self-Review

**Spec coverage:** New parts (4 families/9 parts) → Tasks 1–3; sprites → Task 4; 20 levels difficulty arc → Tasks 5–8 (bands A/B/C/D match the spec's bands exactly); link validation → Task 3; velocity-clamp/try-wrap safety → Task 1 Step 2 (+ portals/gate in 2–3); solvability gate → Tasks 5–9 (every band solver-verifies, Task 9 sweeps all 20); testing (pure + sweep + browser + phone) → Tasks 1–3/9/11; SW + docs → Task 10; ship + live verify → Task 11. All spec sections covered.

**Placeholder scan:** Part code, engine logic, helpers (`portalExit`/`gateOpen`), and validation are written in full. Level *coordinates* are intentionally authored-then-solver-tuned (the spec fixes each level's THEME + intended path; exact x/y is a level-design activity, not a code placeholder) — every band task requires a documented winning solution before commit, which is the real spec. No TBD/TODO.

**Type consistency:** plugin shapes consistent (`{partType,tag,...}`); `portalExit(toPortal)`, `gateOpen(buttonBody,bodies)` signatures consistent across engine + tests; `validateLevel` link checks use the same field names the parts read (`link`, `gate`, `id`). `OFFICIAL_LEVELS` grows 5→12→18→20 across Tasks 5–8 with the structural test count updated each task; final assert is exactly 20. Fit modes in sprites.js (Task 4) match the part geometries (circle/plank/box). `_applyForces` additions sit inside the existing per-body `try` block (consistent with the gears/TNT safety pattern).

**Risk flagged for executor:** Bands C/D (Tasks 7–8) and the portal/vortex levels are the hardest to make solver-solvable — budget tuning time; if a specific multi-mechanic level resists within reason, SIMPLIFY its layout rather than ship it unverified (solvability is the hard gate). Velocity clamping (Task 1 Step 2) is load-bearing for bumper/accelerator/vortex stability — keep it. Task 4 + Task 11 are controller-run (MCP asset gen; production deploy).
